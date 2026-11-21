#!/usr/bin/env python3
"""Comprehensive automated test suite for FEAT-231:
Robotic Surgery Coordination Module integrated 2-way with Weekly Surgery Schedule & Dual-WAL Engine.

Covers all 16 scenarios TC-R01 .. TC-R16:
- TC-R01: 2-way sync Weekly <-> Robot, approachType='robot' 409 lock, non-coordinator date edit 403.
- TC-R02: Stale Bulk PUT OCC rejection (409 CASE_REVISION_MISMATCH).
- TC-R03: Legacy trash/restore/purge endpoints return 409 on robotCaseId surgeries.
- TC-R04: Concurrent slot race & unlinked Robot surgery collision -> only 1 succeeds, 1 gets 409.
- TC-R05: confirmConflict RBAC (403 non-coordinator), reason >= 5 chars (422), fingerprint mismatch (409).
- TC-R06: Shared engine + B2/B3 NEVER grant surgery.approval='approved', Tier-A invalidates approved, post-B2 edit lowers to cho_duyet_tien_phau + postB2ClinicalDirty.
- TC-R07: Dual-WAL crash replay (`reconcile_dual_journals_and_db`) + Idempotency-Key replay with live phone masking.
- TC-R08: Zero-RM 7d exemption, >14d archive_inactive migration, same-episode vs newEpisode recovery (<=1 active invariant), soft-archive DELETE.
- TC-R09: Field injection (422 DISALLOWED_FIELDS), consult dong_y stops at cho_xep_lich, live coordinator revocation takes immediate effect.
- TC-R10: Lazy date-rollover on GET /api/robot/bootstrap (cho_mo -> da_mo only), post-hoc postpone day 7 PASS vs day 8 422.
- TC-R11: Zero-Local-PHI canary phone 0987654321 masked across bootstrap, 409 serverCase, audit logs & 0 browser storage traces after logout.
- TC-R12: Baseline 122 historical Robot surgeries + strict sandbox [TEST] exclusion even for SuperAdmin.
- TC-R13: link_existing_surgery attaches code without duplicating record or wiping surgery.approval.
- TC-R14: DOM/Stored XSS escaping verification in Playwright.
- TC-R15: A5 P.CTXH print preview (Brand v1 #1D2357/#1878B4, B&W #000000 toggle, default "Quang", zero phone on slip, clean teardown).
- TC-R16: Playwright Desktop 1440x900 Light/Dark + iPhone Air 440x956 WebKit .kb-open + Negative Overflow Probe (600px element).
"""

from __future__ import annotations

import copy
import importlib
import json
import os
import pathlib
import re
import shutil
import socket
import sys
import tempfile
import threading
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from playwright.sync_api import sync_playwright
from werkzeug.serving import make_server

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
CANARY_PHONE = "0987654321"
CANARY_MASKED = "098****321"


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def _iso_offset(days_delta: int) -> str:
    vn_now = datetime.now(timezone(timedelta(hours=7))).date() + timedelta(days=days_delta)
    return vn_now.isoformat()


class TestFeat231RobotSchedule(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._orig_env = {
            k: os.environ.get(k)
            for k in ("PTDTT_DATA_DIR", "PTDTT_LOG_DIR", "JWT_SECRET", "PTDTT_TESTING")
        }
        cls.tmp_root_obj = tempfile.TemporaryDirectory(prefix="ptdtt_feat231_suite_")
        cls.tmp_root = pathlib.Path(cls.tmp_root_obj.name)

        boot_dir = cls.tmp_root / "boot"
        (boot_dir / "data").mkdir(parents=True, exist_ok=True)
        (boot_dir / "logs").mkdir(parents=True, exist_ok=True)
        (boot_dir / "data" / "db.json").write_text("{}", encoding="utf-8")
        (boot_dir / "data" / "auth.json").write_text('{"users":{}}', encoding="utf-8")

        os.environ["PTDTT_DATA_DIR"] = str(boot_dir / "data")
        os.environ["PTDTT_LOG_DIR"] = str(boot_dir / "logs")
        os.environ["JWT_SECRET"] = "feat231-unit-test-secret-2026-ptdtt-robot"
        os.environ["PTDTT_TESTING"] = "1"

        if str(REPO_ROOT) not in sys.path:
            sys.path.insert(0, str(REPO_ROOT))
        if "server_flask" in sys.modules:
            cls.sf = importlib.reload(sys.modules["server_flask"])
        else:
            cls.sf = importlib.import_module("server_flask")
        cls.eng = importlib.import_module("surgery_approval_engine")
        cls.rroutes = importlib.import_module("robot_schedule_routes")
        cls.sroutes = importlib.import_module("surgery_approval_routes")

        cls.src_db = json.loads((REPO_ROOT / "data" / "db.json").read_text(encoding="utf-8"))
        cls.pw_hash = cls.sf._hash_password("RobotStrong2026")
        sw_m = re.search(r"SW_BUILD_VER\s*=\s*'(\d+)'", (REPO_ROOT / "index.html").read_text(encoding="utf-8"))
        cls.sw_build_ver = sw_m.group(1) if sw_m else "2611211215"

        cls.pw = sync_playwright().start()
        cls.browsers = {
            "chromium": cls.pw.chromium.launch(headless=True),
            "webkit": cls.pw.webkit.launch(headless=True),
        }

    @classmethod
    def tearDownClass(cls):
        for b in cls.browsers.values():
            try:
                b.close()
            except Exception:
                pass
        try:
            cls.pw.stop()
        except Exception:
            pass
        for k, val in cls._orig_env.items():
            if val is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = val
        cls.tmp_root_obj.cleanup()

    def _new_env(self, *, sandbox_only: bool = False, rollout_access: str = "all_staff", preseed_surgeries: list = None):
        case_dir = self.tmp_root / f"case_{uuid.uuid4().hex[:10]}"
        data_dir = case_dir / "data"
        log_dir = case_dir / "logs"
        data_dir.mkdir(parents=True, exist_ok=True)
        log_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(
            REPO_ROOT / "data" / "procedure_catalog_2026_v1.json",
            data_dir / "procedure_catalog_2026_v1.json",
        )

        cfg = copy.deepcopy(self.eng.DEFAULT_SURGERY_APPROVAL_CONFIG)
        cfg["sandboxOnlyMode"] = sandbox_only
        cfg["rolloutAccessMode"] = rollout_access
        cfg["rolloutEffectiveSurgeryDate"] = "2026-11-09"
        cfg["checklistMode"] = "enforced_gate"

        db_payload = {
            "_version": 12,
            "staff": copy.deepcopy(self.src_db.get("staff") or []),
            "departedStaff": copy.deepcopy(self.src_db.get("departedStaff") or []),
            "rooms": copy.deepcopy(self.src_db.get("rooms") or []),
            "externalDoctors": copy.deepcopy(self.src_db.get("externalDoctors") or []),
            "surgeries": copy.deepcopy(preseed_surgeries or []),
            "surgeriesTrash": [],
            "surgeriesArchivedInactive": [],
            "notifications": [],
            "approvalDelegations": [],
            "surgeryApprovalConfig": cfg,
            "nextIds": {"staff": 100, "surgeries": 1001, "notifications": 1},
            "_revisions": {"staff": 1, "surgeries": 1, "surgeriesTrash": 1, "notifications": 1, "robotCases": 1},
        }
        data_file = data_dir / "db.json"
        data_file.write_text(json.dumps(db_payload, ensure_ascii=False, indent=2), encoding="utf-8")

        users = {
            "nphuu": {
                "passwordHash": self.pw_hash,
                "name": "Nguyễn Phú Hữu",
                "title": "TS. BSCKII.",
                "role": "BS Trưởng khoa",
                "staffId": 1,
                "isAdmin": True,
                "isSuperAdmin": False,
                "disabled": False,
                "mustChangePassword": False,
                "sessionEpoch": 1,
            },
            "vkan": {
                "passwordHash": self.pw_hash,
                "name": "Vũ Khương An",
                "title": "BSCKII.",
                "role": "BS Phó trưởng khoa",
                "staffId": 2,
                "isAdmin": True,
                "isSuperAdmin": True,
                "disabled": False,
                "mustChangePassword": False,
                "sessionEpoch": 1,
            },
            "vcnguyen": {
                "passwordHash": self.pw_hash,
                "name": "Võ Chí Nguyện",
                "title": "BSCKII.",
                "role": "Bác sĩ chính",
                "staffId": 6,
                "isAdmin": False,
                "isSuperAdmin": False,
                "disabled": False,
                "mustChangePassword": False,
                "sessionEpoch": 1,
            },
            "vnatuan": {
                "passwordHash": self.pw_hash,
                "name": "Vũ Ngọc Anh Tuấn",
                "title": "BSCKII.",
                "role": "Bác sĩ chính",
                "staffId": 4,
                "isAdmin": False,
                "isSuperAdmin": False,
                "disabled": False,
                "mustChangePassword": False,
                "sessionEpoch": 1,
            },
            "ntnthuy": {
                "passwordHash": self.pw_hash,
                "name": "Nguyễn Thị Ngọc Thùy",
                "title": "ThS. ĐD",
                "role": "Điều dưỡng trưởng",
                "staffId": 3,
                "isAdmin": True,
                "isSuperAdmin": False,
                "disabled": False,
                "mustChangePassword": False,
                "sessionEpoch": 1,
            },
            "ttdanh": {
                "passwordHash": self.pw_hash,
                "name": "Trần Thanh Danh",
                "title": "CNĐD",
                "role": "Điều dưỡng",
                "staffId": 28,
                "isAdmin": False,
                "isSuperAdmin": False,
                "disabled": False,
                "mustChangePassword": False,
                "sessionEpoch": 1,
            },
        }
        auth_file = data_dir / "auth.json"
        auth_file.write_text(json.dumps({"users": users}, ensure_ascii=False, indent=2), encoding="utf-8")

        os.environ["PTDTT_DATA_DIR"] = str(data_dir)
        os.environ["PTDTT_LOG_DIR"] = str(log_dir)
        self.sf.DATA_DIR = str(data_dir)
        self.sf.DATA_FILE = str(data_file)
        self.sf.AUTH_FILE = str(auth_file)
        self.sf.LOG_DIR = str(log_dir)
        self.sf._DB_LOCK_FILE = str(data_dir / ".db.lock")
        self.sf._data_lock = self.sf._CrossProcessLock(self.sf._DB_LOCK_FILE)
        self.sf._login_attempts.clear()
        self.sf.app.config["TESTING"] = True

        self.sroutes.ensure_approval_bootstrapped(self.sf)
        self.rroutes.ensure_robot_bootstrapped(self.sf)
        self._users = users
        return data_dir, data_file, self.sf.app.test_client()

    def _headers(self, username: str, *, idem: str = None) -> dict:
        token = self.sf._create_jwt(username, self._users[username])
        h = {
            "Authorization": f"Bearer {token}",
            "X-Client-Build": self.sw_build_ver,
            "Content-Type": "application/json",
        }
        if idem is not None:
            h["Idempotency-Key"] = idem
        else:
            h["Idempotency-Key"] = str(uuid.uuid4())
        return h

    def _create_full_b3_case(self, client, *, patient="BN Robot Mẫu", s_date=None, slot="Ca 1", phone=CANARY_PHONE, surgeon_id=6):
        s_date = s_date or _iso_offset(2)
        r = client.post(
            "/api/robot/cases",
            headers=self._headers("vnatuan"),
            json={
                "action": "create_consult",
                "patientName": patient,
                "birthYear": 1966,
                "gender": "Nam",
                "phone": phone,
                "admissionId": f"NV{uuid.uuid4().hex[:6].upper()}",
                "diagnosis": "K trực tràng giữa cT3N1M0",
                "robotProcedure": "Phẫu thuật nội soi Robot cắt trước thấp (LAR)",
                "mainSurgeonId": surgeon_id,
                "consultResult": "dong_y",
            },
        )
        self.assertEqual(r.status_code, 201, r.get_data(as_text=True))
        rc = r.get_json()["case"]
        code = rc["robotCaseCode"]

        r = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("vcnguyen"),
            json={
                "action": "schedule_step1",
                "expectedRevision": rc["caseRevision"],
                "surgeryDate": s_date,
                "caseSlot": slot,
                "operatingRoom": "PM Robot",
            },
        )
        self.assertEqual(r.status_code, 200, r.get_data(as_text=True))
        rc = r.get_json()["case"]

        r = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("vcnguyen"),
            json={"action": "preop_step2", "expectedRevision": rc["caseRevision"]},
        )
        self.assertEqual(r.status_code, 200, r.get_data(as_text=True))
        rc = r.get_json()["case"]

        r = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("vcnguyen"),
            json={"action": "inpatient_step3", "expectedRevision": rc["caseRevision"], "wardRoom": "712"},
        )
        self.assertEqual(r.status_code, 200, r.get_data(as_text=True))
        return r.get_json()["case"]

    def _put_surgeries_snapshot(self, client, username: str, transform_fn):
        r_get = client.get("/api/data", headers=self._headers(username))
        self.assertEqual(r_get.status_code, 200)
        full = r_get.get_json()
        items = copy.deepcopy(full.get("surgeries") or [])
        base_rev = int((full.get("_revisions") or {}).get("surgeries", 1))
        new_items = transform_fn(items)
        return client.put(
            "/api/data/surgeries",
            headers=self._headers(username),
            json={
                "items": new_items,
                "baseRevision": base_rev,
                "baseItems": full.get("surgeries") or [],
            },
        )

    # ─── TC-R01 & TC-R02 & TC-R03 ───

    def test_tc_r01_two_way_sync_and_locks(self):
        _, _, client = self._new_env(sandbox_only=False)
        rc = self._create_full_b3_case(client, s_date=_iso_offset(3), slot="Ca 1")
        code = rc["robotCaseCode"]
        sid = rc["canonicalSurgeryId"]
        self.assertTrue(sid)

        # Weekly edit of diagnosis syncs back to robotCase and bumps both revisions
        r_put = self._put_surgeries_snapshot(
            client,
            "vnatuan",
            lambda items: [{**x, "diagnosis": "K trực tràng thấp cT3N1 (Cập nhật)"} if x["id"] == sid else x for x in items],
        )
        self.assertEqual(r_put.status_code, 200, r_put.get_data(as_text=True))

        bs = client.get("/api/robot/bootstrap", headers=self._headers("vcnguyen")).get_json()
        rc_now = next(c for c in bs["cases"] if c["robotCaseCode"] == code)
        self.assertEqual(rc_now["diagnosis"], "K trực tràng thấp cT3N1 (Cập nhật)")
        self.assertEqual(rc_now["caseRevision"], rc["caseRevision"] + 1)

        # Non-coordinator (vnatuan) CANNOT change date on Weekly Schedule for Robot-linked surgery (403)
        r_forbidden_date = self._put_surgeries_snapshot(
            client,
            "vnatuan",
            lambda items: [{**x, "date": _iso_offset(5)} if x["id"] == sid else x for x in items],
        )
        self.assertEqual(r_forbidden_date.status_code, 403)
        self.assertEqual(r_forbidden_date.get_json().get("code"), "ROBOT_SCHEDULE_COORDINATOR_REQUIRED")

        # Nobody can change approachType away from 'robot' on linked surgery (409)
        r_locked = self._put_surgeries_snapshot(
            client,
            "vkan",
            lambda items: [{**x, "approachType": "noisoi", "surgeryType": "chuongtrinh"} if x["id"] == sid else x for x in items],
        )
        self.assertEqual(r_locked.status_code, 409)
        self.assertEqual(r_locked.get_json().get("code"), "ROBOT_APPROACH_LOCKED")

        # Robot edit_schedule syncs back to Weekly Schedule surgeries[]
        new_date = _iso_offset(6)
        r_sched = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("vcnguyen"),
            json={"action": "edit_schedule", "expectedRevision": rc_now["caseRevision"], "surgeryDate": new_date, "caseSlot": "Ca 2"},
        )
        self.assertEqual(r_sched.status_code, 200, r_sched.get_data(as_text=True))
        full_after = client.get("/api/data", headers=self._headers("vkan")).get_json()
        s_after = next(s for s in full_after["surgeries"] if s["id"] == sid)
        self.assertEqual(s_after["date"], new_date)
        self.assertFalse(s_after["isFirstCase"])

    def test_tc_r02_stale_bulk_put_occ_guard(self):
        _, _, client = self._new_env(sandbox_only=False)
        rc = self._create_full_b3_case(client, s_date=_iso_offset(3), slot="Ca 1")
        code = rc["robotCaseCode"]
        sid = rc["canonicalSurgeryId"]

        stale_full = client.get("/api/data", headers=self._headers("vcnguyen")).get_json()
        stale_items = copy.deepcopy(stale_full["surgeries"])
        base_rev = int(stale_full["_revisions"]["surgeries"])

        # Coordinator moves surgery date from Robot module
        moved_date = _iso_offset(4)
        r_mv = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("nphuu"),
            json={"action": "edit_schedule", "expectedRevision": rc["caseRevision"], "surgeryDate": moved_date, "caseSlot": "Ca 1"},
        )
        self.assertEqual(r_mv.status_code, 200)

        # Replay stale bulk snapshot (even if force-passing old items with old robotSyncMeta.robotCaseRevision)
        patched_stale = [{**x, "diagnosis": "Cũ bị ghi đè"} if x["id"] == sid else x for x in stale_items]
        r_stale = client.put(
            "/api/data/surgeries",
            headers=self._headers("vkan"),
            json={"items": patched_stale, "baseRevision": base_rev, "baseItems": stale_items},
        )
        self.assertIn(r_stale.status_code, (409,))

        # Direct non-merge stale PUT against old caseRevision / robotCaseRevision
        r_direct_stale = client.put(
            "/api/data/surgeries",
            headers=self._headers("vkan"),
            json={"items": patched_stale},
        )
        self.assertEqual(r_direct_stale.status_code, 409)
        self.assertEqual(r_direct_stale.get_json().get("code"), "CASE_REVISION_MISMATCH")

    def test_tc_r03_weekly_trash_restore_purge_blocked(self):
        _, data_file, client = self._new_env(sandbox_only=False)
        rc = self._create_full_b3_case(client, s_date=_iso_offset(3), slot="Ca 1")
        sid = rc["canonicalSurgeryId"]

        r_trash = client.post(f"/api/surgeries/{sid}/trash", headers=self._headers("vkan"), json={})
        self.assertEqual(r_trash.status_code, 409)
        self.assertEqual(r_trash.get_json().get("code"), "ROBOT_CASE_USE_COORDINATOR_FLOW")

        # Postpone cleanly from Robot module (which moves linked surgery to surgeriesTrash)
        r_post = client.patch(
            f"/api/robot/cases/{rc['robotCaseCode']}",
            headers=self._headers("vcnguyen"),
            json={"action": "postpone", "expectedRevision": rc["caseRevision"], "postponeReasonCode": "chua_ngung_khang_dong"},
        )
        self.assertEqual(r_post.status_code, 200)

        r_res = client.post(f"/api/surgeries/{sid}/restore", headers=self._headers("vkan"), json={})
        self.assertEqual(r_res.status_code, 409)
        self.assertEqual(r_res.get_json().get("code"), "ROBOT_CASE_USE_COORDINATOR_FLOW")

        r_purge = client.delete(f"/api/surgeries-trash/{sid}", headers=self._headers("vkan"), json={})
        self.assertEqual(r_purge.status_code, 409)
        self.assertEqual(r_purge.get_json().get("code"), "ROBOT_CASE_PROTECTED_ZERO_RM")

    # ─── TC-R04 & TC-R05 ───

    def test_tc_r04_concurrent_slot_conflict_and_unlinked_robot(self):
        slot_date = _iso_offset(5)
        # Include an unlinked Robot surgery directly in Weekly Schedule on another date to verify cross-table conflict
        unlinked_date = _iso_offset(7)
        preseed = [{
            "id": 9001,
            "patientName": "BN Robot Ngoài Module",
            "birthYear": 1970,
            "admissionId": "NVEXT9001",
            "diagnosis": "U trực tràng",
            "method": "Robot cắt trực tràng",
            "surgeryType": "robot",
            "approachType": "robot",
            "date": unlinked_date,
            "mainSurgeon": 4,
            "isFirstCase": True,
        }]
        _, _, client = self._new_env(sandbox_only=False, preseed_surgeries=preseed)

        # First consult collides with unlinked Robot surgery on unlinked_date
        r_unlinked = client.post(
            "/api/robot/cases",
            headers=self._headers("vcnguyen"),
            json={
                "action": "create_case",
                "patientName": "BN Thử Đụng Ngoài",
                "mainSurgeonId": 6,
                "surgeryDate": unlinked_date,
                "caseSlot": "Ca 1",
                "operatingRoom": "PM Robot",
            },
        )
        self.assertEqual(r_unlinked.status_code, 409)
        self.assertEqual(r_unlinked.get_json().get("code"), "SCHEDULE_SLOT_CONFLICT")

        # Concurrent race: 2 simultaneous requests booking the exact same slotDate + Ca 1
        def _book(idx: int):
            c = self.sf.app.test_client()
            resp = c.post(
                "/api/robot/cases",
                headers=self._headers("vcnguyen"),
                json={
                    "action": "create_case",
                    "patientName": f"BN Race {idx}",
                    "mainSurgeonId": 6 if idx == 1 else 4,
                    "surgeryDate": slot_date,
                    "caseSlot": "Ca 1",
                    "operatingRoom": "PM Robot",
                },
            )
            return resp.status_code, resp.get_json()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(_book, (1, 2)))

        statuses = sorted(st for st, _ in results)
        self.assertEqual(statuses, [201, 409], results)

    def test_tc_r05_confirm_conflict_rbac_reason_and_fingerprint(self):
        target_date = _iso_offset(4)
        _, _, client = self._new_env(sandbox_only=False)

        r1 = client.post(
            "/api/robot/cases",
            headers=self._headers("vcnguyen"),
            json={
                "action": "create_case",
                "patientName": "BN Ca 1 Gốc",
                "mainSurgeonId": 6,
                "surgeryDate": target_date,
                "caseSlot": "Ca 1",
                "operatingRoom": "PM Robot",
            },
        )
        self.assertEqual(r1.status_code, 201)

        # Prepare second consult waiting for Step 1
        r2 = client.post(
            "/api/robot/cases",
            headers=self._headers("vnatuan"),
            json={
                "action": "create_consult",
                "patientName": "BN Ca 2 Bị Trùng",
                "phone": "0909111222",
                "mainSurgeonId": 4,
                "consultResult": "dong_y",
            },
        )
        c2 = r2.get_json()["case"]

        # Trigger conflict to get fingerprint
        r_conf = client.patch(
            f"/api/robot/cases/{c2['robotCaseCode']}",
            headers=self._headers("vcnguyen"),
            json={"action": "schedule_step1", "expectedRevision": c2["caseRevision"], "surgeryDate": target_date, "caseSlot": "Ca 1"},
        )
        self.assertEqual(r_conf.status_code, 409)
        fp = r_conf.get_json()["conflictFingerprint"]

        # Too-short reason -> 422
        r_short = client.patch(
            f"/api/robot/cases/{c2['robotCaseCode']}",
            headers=self._headers("vcnguyen"),
            json={
                "action": "schedule_step1",
                "expectedRevision": c2["caseRevision"],
                "surgeryDate": target_date,
                "caseSlot": "Ca 1",
                "confirmConflict": True,
                "conflictOverrideReason": "abc",
                "expectedConflictFingerprint": fp,
            },
        )
        self.assertEqual(r_short.status_code, 422)

        # Wrong fingerprint -> 409 CONFLICT_FINGERPRINT_MISMATCH
        r_bad_fp = client.patch(
            f"/api/robot/cases/{c2['robotCaseCode']}",
            headers=self._headers("vcnguyen"),
            json={
                "action": "schedule_step1",
                "expectedRevision": c2["caseRevision"],
                "surgeryDate": target_date,
                "caseSlot": "Ca 1",
                "confirmConflict": True,
                "conflictOverrideReason": "Sếp đồng ý mổ nối ca 1 ngày thứ 5",
                "expectedConflictFingerprint": "stale_fp_hash",
            },
        )
        self.assertEqual(r_bad_fp.status_code, 409)
        self.assertEqual(r_bad_fp.get_json().get("code"), "CONFLICT_FINGERPRINT_MISMATCH")

        # Non-coordinator cannot schedule_step1 or override conflict -> 403
        r_doc_forbidden = client.patch(
            f"/api/robot/cases/{c2['robotCaseCode']}",
            headers=self._headers("vnatuan"),
            json={
                "action": "schedule_step1",
                "expectedRevision": c2["caseRevision"],
                "surgeryDate": target_date,
                "caseSlot": "Ca 1",
                "confirmConflict": True,
                "conflictOverrideReason": "Sếp đồng ý mổ nối ca 1 ngày thứ 5",
                "expectedConflictFingerprint": fp,
            },
        )
        self.assertEqual(r_doc_forbidden.status_code, 403)

        # Valid coordinator override with matching fingerprint succeeds
        r_ok = client.patch(
            f"/api/robot/cases/{c2['robotCaseCode']}",
            headers=self._headers("vcnguyen"),
            json={
                "action": "schedule_step1",
                "expectedRevision": c2["caseRevision"],
                "surgeryDate": target_date,
                "caseSlot": "Ca 1",
                "confirmConflict": True,
                "conflictOverrideReason": "Trưởng khoa đồng ý tăng cường 2 kíp cùng ngày",
                "expectedConflictFingerprint": fp,
            },
        )
        self.assertEqual(r_ok.status_code, 200)
        self.assertEqual(r_ok.get_json()["case"]["status"], "cho_duyet_tien_phau")

    # ─── TC-R06 & TC-R07 ───

    def test_tc_r06_shared_engine_departmental_approval_independence(self):
        _, data_file, client = self._new_env(sandbox_only=False)
        rc = self._create_full_b3_case(client, s_date=_iso_offset(4), slot="Ca 1")
        sid = rc["canonicalSurgeryId"]

        # Verify B2 & B3 NEVER minted 'approved' on linked surgery
        full = client.get("/api/data", headers=self._headers("vkan")).get_json()
        surg = next(s for s in full["surgeries"] if s["id"] == sid)
        self.assertEqual(surg["approval"]["status"], "draft_unsubmitted")

        # Mark linked surgery as BCN approved directly on test fixture to test Tier-A revocation from Robot edit
        db_raw = json.loads(data_file.read_text(encoding="utf-8"))
        for s in db_raw["surgeries"]:
            if s["id"] == sid:
                s["approval"]["status"] = "approved"
                s["approval"]["approvedSnapshot"] = {"caseRevision": s.get("caseRevision", 1)}
        data_file.write_text(json.dumps(db_raw, ensure_ascii=False, indent=2), encoding="utf-8")

        # Editing diagnosis from Robot module revokes BCN approval to reapproval_required
        r_edit = client.patch(
            f"/api/robot/cases/{rc['robotCaseCode']}",
            headers=self._headers("vcnguyen"),
            json={"action": "edit_info", "expectedRevision": rc["caseRevision"], "diagnosis": "Thay đổi chẩn đoán tiền phẫu"},
        )
        self.assertEqual(r_edit.status_code, 200)
        full2 = client.get("/api/data", headers=self._headers("vkan")).get_json()
        surg2 = next(s for s in full2["surgeries"] if s["id"] == sid)
        self.assertEqual(surg2["approval"]["status"], "reapproval_required")

        # Test post-B2 clinical edit drops cho_duyet_luu_vien -> cho_duyet_tien_phau + sets postB2ClinicalDirty
        r_c = client.post(
            "/api/robot/cases",
            headers=self._headers("vcnguyen"),
            json={"action": "create_case", "patientName": "BN B2 Dirty", "mainSurgeonId": 6, "surgeryDate": _iso_offset(6), "caseSlot": "Ca 1"},
        )
        c2 = r_c.get_json()["case"]
        c2 = client.patch(
            f"/api/robot/cases/{c2['robotCaseCode']}",
            headers=self._headers("vcnguyen"),
            json={"action": "preop_step2", "expectedRevision": c2["caseRevision"]},
        ).get_json()["case"]
        self.assertEqual(c2["status"], "cho_duyet_luu_vien")

        c2_edited = client.patch(
            f"/api/robot/cases/{c2['robotCaseCode']}",
            headers=self._headers("vcnguyen"),
            json={"action": "edit_info", "expectedRevision": c2["caseRevision"], "diagnosis": "Sửa chẩn đoán sau B2"},
        ).get_json()["case"]
        self.assertEqual(c2_edited["status"], "cho_duyet_tien_phau")
        self.assertTrue(c2_edited["postB2ClinicalDirty"])

    def test_tc_r07_dual_wal_crash_replay_and_idempotency_masking(self):
        data_dir, data_file, client = self._new_env(sandbox_only=False)
        rc = self._create_full_b3_case(client, patient="BN Crash Pre", s_date=_iso_offset(3), slot="Ca 1")

        # Snapshot db.json BEFORE next mutation
        pre_crash_db = data_file.read_text(encoding="utf-8")

        # Perform another B1->B2->B3 create + idempotent replay
        idem_key = f"idem-robot-{uuid.uuid4().hex[:8]}"
        h_replay = self._headers("vcnguyen", idem=idem_key)
        r_new = client.post(
            "/api/robot/cases",
            headers=h_replay,
            json={
                "action": "create_consult",
                "patientName": "BN Crash WAL",
                "phone": CANARY_PHONE,
                "mainSurgeonId": 6,
                "consultResult": "dong_y",
            },
        )
        self.assertEqual(r_new.status_code, 201)
        new_code = r_new.get_json()["case"]["robotCaseCode"]

        # Exact Idempotency-Key retry must return the exact same code and not duplicate
        r_rep = client.post(
            "/api/robot/cases",
            headers=self._headers("vcnguyen", idem=idem_key),
            json={
                "action": "create_consult",
                "patientName": "BN Crash WAL",
                "phone": CANARY_PHONE,
                "mainSurgeonId": 6,
                "consultResult": "dong_y",
            },
        )
        self.assertEqual(r_rep.status_code, 201)
        self.assertEqual(r_rep.get_json()["case"]["robotCaseCode"], new_code)

        # Simulate crash: revert db.json to pre-mutation snapshot while WAL holds the committed entry
        data_file.write_text(pre_crash_db, encoding="utf-8")
        bs_recovered = client.get("/api/robot/bootstrap", headers=self._headers("ttdanh")).get_json()
        rec_case = next((c for c in bs_recovered["cases"] if c["robotCaseCode"] == new_code), None)
        self.assertIsNotNone(rec_case, "Dual-WAL crash recovery failed to replay robot_tx!")
        # And recovered case returned to nurse ttdanh must mask phone!
        self.assertEqual(rec_case["phone"], CANARY_MASKED)

    # ─── TC-R08 & TC-R09 & TC-R10 ───

    def test_tc_r08_zero_rm_7d_14d_trash_and_episode_recovery(self):
        _, data_file, client = self._new_env(sandbox_only=False)
        rc = self._create_full_b3_case(client, s_date=_iso_offset(4), slot="Ca 1")
        code = rc["robotCaseCode"]
        orig_sid = rc["canonicalSurgeryId"]

        # Postpone puts surgery in surgeriesTrash
        r_post = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("vcnguyen"),
            json={"action": "postpone", "expectedRevision": rc["caseRevision"], "postponeReasonCode": "benh_nhan_xin_hoan"},
        )
        rc = r_post.get_json()["case"]

        # Age trash timestamp to 8 days (>7d) -> MUST be EXEMPT from 7d deletion
        db = json.loads(data_file.read_text(encoding="utf-8"))
        for t in db["surgeriesTrash"]:
            if t["id"] == orig_sid:
                t["deletedAt"] = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
        data_file.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")

        db_loaded = json.loads(data_file.read_text(encoding="utf-8"))
        self.sroutes._purge_expired_trash_in_place(db_loaded, days=7)
        self.assertTrue(any(t["id"] == orig_sid for t in db_loaded["surgeriesTrash"]), "7d purge deleted a Robot-linked trash item!")

        # Restore same episode directly to cho_mo -> recovers EXACT canonicalSurgeryId, <=1 active
        r_rest = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("vcnguyen"),
            json={
                "action": "restore_to_schedule",
                "expectedRevision": rc["caseRevision"],
                "surgeryDate": _iso_offset(5),
                "caseSlot": "Ca 1",
                "targetStep": "cho_mo",
                "newEpisode": False,
            },
        )
        self.assertEqual(r_rest.status_code, 200)
        rc = r_rest.get_json()["case"]
        self.assertEqual(rc["canonicalSurgeryId"], orig_sid)
        self.assertEqual(rc["activeLinkedSurgeryId"], orig_sid)

        # Discharge wait, then readmit with newEpisode=True -> archives old ID & issues new ID on step3
        rc = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("vcnguyen"),
            json={"action": "discharge_wait", "expectedRevision": rc["caseRevision"], "dischargeReason": "Về điều trị nội khoa"},
        ).get_json()["case"]
        rc = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("vcnguyen"),
            json={"action": "readmit", "expectedRevision": rc["caseRevision"], "surgeryDate": _iso_offset(8), "caseSlot": "Ca 1", "newEpisode": True},
        ).get_json()["case"]
        self.assertIsNone(rc["canonicalSurgeryId"])
        self.assertEqual(rc["episodeId"], 2)

        rc = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("vcnguyen"),
            json={"action": "preop_step2", "expectedRevision": rc["caseRevision"]},
        ).get_json()["case"]
        rc = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("vcnguyen"),
            json={"action": "inpatient_step3", "expectedRevision": rc["caseRevision"]},
        ).get_json()["case"]
        new_sid = rc["canonicalSurgeryId"]
        self.assertNotEqual(new_sid, orig_sid)

        # Invariant: <= 1 active record in surgeries[] and old ID in surgeriesArchivedInactive
        db_now = json.loads(data_file.read_text(encoding="utf-8"))
        active_matches = [s for s in db_now["surgeries"] if s.get("robotCaseId") == code]
        self.assertEqual(len(active_matches), 1)
        self.assertTrue(any(a["id"] == orig_sid for a in db_now["surgeriesArchivedInactive"]))

        # Test >14d trash auto-archive via GET /api/robot/bootstrap
        rc = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("vcnguyen"),
            json={"action": "soft_delete", "expectedRevision": rc["caseRevision"], "deleteReason": "Test archive 14d"},
        ).get_json()["case"]
        db_15 = json.loads(data_file.read_text(encoding="utf-8"))
        for t in db_15["surgeriesTrash"]:
            if t["id"] == new_sid:
                t["deletedAt"] = (datetime.now(timezone.utc) - timedelta(days=15)).isoformat()
        for ritem in db_15["robotCases"]:
            if ritem["robotCaseCode"] == code:
                ritem["deletedAt"] = (datetime.now(timezone.utc) - timedelta(days=15)).isoformat()
        data_file.write_text(json.dumps(db_15, ensure_ascii=False, indent=2), encoding="utf-8")

        bs_15 = client.get("/api/robot/bootstrap", headers=self._headers("vcnguyen")).get_json()
        self.assertFalse(any(c["robotCaseCode"] == code for c in bs_15["cases"]))
        db_after_15 = json.loads(data_file.read_text(encoding="utf-8"))
        archived_rc = next(c for c in db_after_15["robotCases"] if c["robotCaseCode"] == code)
        self.assertEqual(archived_rc["status"], "archived_deleted")  # Zero-RM: record still retained!

    def test_tc_r09_field_injection_and_live_coordinator_revocation(self):
        _, _, client = self._new_env(sandbox_only=False)

        # Field injection rejected immediately with 422 DISALLOWED_FIELDS
        r_inj = client.post(
            "/api/robot/cases",
            headers=self._headers("vnatuan"),
            json={
                "action": "create_consult",
                "patientName": "BN Inject",
                "phone": CANARY_PHONE,
                "mainSurgeonId": 4,
                "status": "cho_mo",
                "preopApprovedBy": "vkan",
                "linkedSurgeryId": 999,
                "coordinators": ["vnatuan"],
            },
        )
        self.assertEqual(r_inj.status_code, 422)
        self.assertEqual(r_inj.get_json().get("code"), "DISALLOWED_FIELDS")

        # Consult result 'dong_y' ALWAYS lands on 'cho_xep_lich' even when called by coordinator
        r_con = client.post(
            "/api/robot/cases",
            headers=self._headers("vcnguyen"),
            json={
                "action": "create_consult",
                "patientName": "BN Tư Vấn Đồng Ý",
                "phone": CANARY_PHONE,
                "mainSurgeonId": 6,
                "consultResult": "dong_y",
            },
        )
        self.assertEqual(r_con.status_code, 201)
        rc = r_con.get_json()["case"]
        self.assertEqual(rc["status"], "cho_xep_lich")

        # Live coordinator revocation by BCN takes effect immediately even with old JWT
        vc_token = self.sf._create_jwt("vcnguyen", self._users["vcnguyen"])
        r_cfg = client.put(
            "/api/robot/config",
            headers=self._headers("nphuu"),
            json={"coordinators": []},
        )
        self.assertEqual(r_cfg.status_code, 200)

        r_revoked = client.patch(
            f"/api/robot/cases/{rc['robotCaseCode']}",
            headers={"Authorization": f"Bearer {vc_token}", "X-Client-Build": self.sw_build_ver, "Content-Type": "application/json", "Idempotency-Key": str(uuid.uuid4())},
            json={"action": "schedule_step1", "expectedRevision": rc["caseRevision"], "surgeryDate": _iso_offset(4), "caseSlot": "Ca 1"},
        )
        self.assertEqual(r_revoked.status_code, 403)

    def test_tc_r10_lazy_rollover_and_posthoc_postpone_7d_vs_8d(self):
        _, data_file, client = self._new_env(sandbox_only=False)
        rc_b3 = self._create_full_b3_case(client, patient="BN Quá Ngày B3", s_date=_iso_offset(2), slot="Ca 1")

        # Create a B2 case (cho_duyet_luu_vien) that must NOT auto-rollover
        r_b2 = client.post(
            "/api/robot/cases",
            headers=self._headers("vcnguyen"),
            json={"action": "create_case", "patientName": "BN B2 Quá Ngày", "mainSurgeonId": 6, "surgeryDate": _iso_offset(2), "caseSlot": "Ca 2"},
        )
        rc_b2 = client.patch(
            f"/api/robot/cases/{r_b2.get_json()['case']['robotCaseCode']}",
            headers=self._headers("vcnguyen"),
            json={"action": "preop_step2", "expectedRevision": r_b2.get_json()["case"]["caseRevision"]},
        ).get_json()["case"]

        # Shift both dates to yesterday (-1 day) -> only cho_mo auto-rolls over to da_mo
        db = json.loads(data_file.read_text(encoding="utf-8"))
        for ritem in db["robotCases"]:
            ritem["surgeryDate"] = _iso_offset(-1)
        data_file.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")

        bs = client.get("/api/robot/bootstrap", headers=self._headers("vcnguyen")).get_json()
        got_b3 = next(c for c in bs["cases"] if c["robotCaseCode"] == rc_b3["robotCaseCode"])
        got_b2 = next(c for c in bs["cases"] if c["robotCaseCode"] == rc_b2["robotCaseCode"])
        self.assertEqual(got_b3["status"], "da_mo")
        self.assertEqual(got_b3["completionSource"], "auto_date_rollover")
        self.assertEqual(got_b2["status"], "cho_duyet_luu_vien")

        # Shift two completed cases to day -7 and day -8 to verify lookback boundary
        db = json.loads(data_file.read_text(encoding="utf-8"))
        for ritem in db["robotCases"]:
            if ritem["robotCaseCode"] == rc_b3["robotCaseCode"]:
                ritem["surgeryDate"] = _iso_offset(-7)
        data_file.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")

        # Day 7 succeeds
        r_ok_7 = client.patch(
            f"/api/robot/cases/{rc_b3['robotCaseCode']}",
            headers=self._headers("vcnguyen"),
            json={"action": "postpone", "expectedRevision": got_b3["caseRevision"], "postponeReasonCode": "cho_cls_hoi_chan"},
        )
        self.assertEqual(r_ok_7.status_code, 200)
        self.assertEqual(r_ok_7.get_json()["case"]["status"], "hoan_mo")

        # Create another completed case at day -8 -> rejected with 422 POSTPONE_LOOKBACK_EXCEEDED
        rc_8 = self._create_full_b3_case(client, patient="BN Ngày Thứ 8", s_date=_iso_offset(2), slot="Ca 1")
        db = json.loads(data_file.read_text(encoding="utf-8"))
        for ritem in db["robotCases"]:
            if ritem["robotCaseCode"] == rc_8["robotCaseCode"]:
                ritem["surgeryDate"] = _iso_offset(-8)
                ritem["status"] = "da_mo"
        data_file.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")

        r_fail_8 = client.patch(
            f"/api/robot/cases/{rc_8['robotCaseCode']}",
            headers=self._headers("vcnguyen"),
            json={"action": "postpone", "expectedRevision": rc_8["caseRevision"], "postponeReasonCode": "cho_cls_hoi_chan"},
        )
        self.assertEqual(r_fail_8.status_code, 422)
        self.assertEqual(r_fail_8.get_json().get("code"), "POSTPONE_LOOKBACK_EXCEEDED")

    # ─── TC-R11 & TC-R12 & TC-R13 ───

    def test_tc_r11_canary_phone_privacy_zero_local_phi(self):
        _, _, client = self._new_env(sandbox_only=False)
        rc = self._create_full_b3_case(client, phone=CANARY_PHONE, s_date=_iso_offset(4), slot="Ca 1")

        # Nurse ttdanh sees masked phone in bootstrap
        bs_nurse = client.get("/api/robot/bootstrap", headers=self._headers("ttdanh")).get_json()
        raw_text_bs = json.dumps(bs_nurse, ensure_ascii=False)
        self.assertNotIn(CANARY_PHONE, raw_text_bs)
        self.assertIn(CANARY_MASKED, raw_text_bs)

        # GET /api/data must NEVER include robotCases, robotConfig, surgeriesArchivedInactive, or canary phone
        data_resp = client.get("/api/data", headers=self._headers("vkan")).get_json()
        for forbidden_key in ("robotCases", "robotConfig", "surgeriesArchivedInactive"):
            self.assertNotIn(forbidden_key, data_resp)
        self.assertNotIn(CANARY_PHONE, json.dumps(data_resp, ensure_ascii=False))

        # 409 error serverCase must mask phone for unauthorized caller
        r_409 = client.patch(
            f"/api/robot/cases/{rc['robotCaseCode']}",
            headers=self._headers("ttdanh"),
            json={"action": "edit_info", "expectedRevision": 99999, "patientName": "Probe"},
        )
        self.assertEqual(r_409.status_code, 409)
        raw_409 = r_409.get_data(as_text=True)
        self.assertNotIn(CANARY_PHONE, raw_409)
        self.assertIn(CANARY_MASKED, raw_409)

        # Audit log API masks phone in snapshot for non-full-phone viewers
        r_logs = client.get("/api/surgery-approval/logs?includeSnapshot=1&limit=50", headers=self._headers("ttdanh"))
        if r_logs.status_code == 200:
            self.assertNotIn(CANARY_PHONE, r_logs.get_data(as_text=True))

    def test_tc_r12_historical_122_baseline_and_sandbox_exclusion(self):
        hist_date = _iso_offset(-10)
        surgeries = [
            {
                "id": 2000 + i,
                "patientName": f"BN Robot Lịch Sử {i}",
                "birthYear": 1960 + (i % 20),
                "admissionId": f"NVH{i:04d}",
                "diagnosis": "K đại trực tràng",
                "method": "Phẫu thuật Robot",
                "surgeryType": "robot",
                "approachType": "robot",
                "date": hist_date,
                "mainSurgeon": 6,
            }
            for i in range(122)
        ] + [
            {
                "id": 9500 + j,
                "patientName": f"[TEST] BN Robot Sandbox {j}",
                "birthYear": 1980,
                "admissionId": f"SBX{j:03d}",
                "diagnosis": "[TEST] Demo",
                "method": "Robot Demo",
                "surgeryType": "robot",
                "approachType": "robot",
                "date": hist_date,
                "mainSurgeon": 2,
                "isTestSandboxCase": True,
            }
            for j in range(3)
        ]
        _, _, client = self._new_env(sandbox_only=True, rollout_access="all_staff", preseed_surgeries=surgeries)

        # Even SuperAdmin MUST see exactly 122 historical Robot cases (3 sandbox cases excluded!)
        bs_sa = client.get("/api/robot/bootstrap", headers=self._headers("vkan")).get_json()
        self.assertEqual(len(bs_sa["historicalRobotSurgeries"]), 122)
        self.assertFalse(any("Sandbox" in (h.get("patientName") or "") for h in bs_sa["historicalRobotSurgeries"]))

        bs_coord = client.get("/api/robot/bootstrap", headers=self._headers("vcnguyen")).get_json()
        self.assertEqual(len(bs_coord["historicalRobotSurgeries"]), 122)

    def test_tc_r13_link_existing_future_surgery(self):
        fut_date = _iso_offset(5)
        preseed = [{
            "id": 3101,
            "patientName": "BN Có Sẵn Lịch Tuần",
            "birthYear": 1968,
            "admissionId": "NV3101",
            "diagnosis": "K đại tràng sigma",
            "method": "Robot cắt đại tràng sigma",
            "surgeryType": "robot",
            "approachType": "robot",
            "date": fut_date,
            "mainSurgeon": 6,
            "isFirstCase": True,
            "schemaVersion": self.eng.SCHEMA_VERSION,
            "ruleVersion": self.eng.RULE_VERSION,
            "caseRevision": 2,
            "approval": {"status": "submitted", "activeHold": None},
        }]
        _, _, client = self._new_env(sandbox_only=False, preseed_surgeries=preseed)

        r_link = client.post(
            "/api/robot/cases/link-surgery",
            headers=self._headers("vcnguyen"),
            json={"action": "link_existing_surgery", "surgeryId": 3101, "phone": "0912345678", "caseSlot": "Ca 1"},
        )
        self.assertEqual(r_link.status_code, 201, r_link.get_data(as_text=True))
        rc = r_link.get_json()["case"]
        self.assertEqual(rc["canonicalSurgeryId"], 3101)
        self.assertEqual(rc["status"], "cho_mo")

        # Confirm NO duplicate record was created and approval.status remained untouched ('submitted')
        full = client.get("/api/data", headers=self._headers("vkan")).get_json()
        matches = [s for s in full["surgeries"] if s["id"] == 3101 or s.get("robotCaseId") == rc["robotCaseCode"]]
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]["approval"]["status"], "submitted")

    # ─── TC-R14 & TC-R15 & TC-R16 (Playwright Multi-Engine E2E) ───

    def test_tc_r14_r15_r16_playwright_xss_print_a5_and_mobile_desktop_e2e(self):
        data_dir, data_file, client = self._new_env(sandbox_only=False)
        xss_str = '<img src=x onerror="window.__rbt_xss=1">BN Nguyễn XSS'
        rc = self._create_full_b3_case(client, patient=xss_str, phone=CANARY_PHONE, s_date=_iso_offset(0), slot="Ca 1")

        # Seed a consult case & postponed case too for subtabs coverage
        client.post(
            "/api/robot/cases",
            headers=self._headers("vnatuan"),
            json={"action": "create_consult", "patientName": "BN Tư Vấn E2E", "phone": CANARY_PHONE, "mainSurgeonId": 6, "diagnosis": '<svg onload="window.__rbt_xss=1">'},
        )

        # Configure P.CTXH XSS test in defaultSchedulerName? No, keep default "Quang" first for TC-R15 default check
        port = _find_free_port()
        srv = make_server("127.0.0.1", port, self.sf.app, threaded=True)
        srv_thread = threading.Thread(target=srv.serve_forever, daemon=True)
        srv_thread.start()
        base_url = f"http://127.0.0.1:{port}"

        try:
            def _open_logged_page(browser_name: str, width: int, height: int, username: str):
                u = self._users[username]
                token = self.sf._create_jwt(username, u)
                session_obj = {
                    "staffId": u["staffId"],
                    "username": username,
                    "name": u["name"],
                    "role": u["role"],
                    "title": u["title"],
                    "isAdmin": u["isAdmin"],
                    "isSuperAdmin": u["isSuperAdmin"],
                    "isRobotCoordinator": True,
                    "mustChangePassword": False,
                }
                session_json = json.dumps(session_obj, ensure_ascii=False)
                ctx = self.browsers[browser_name].new_context(
                    viewport={"width": width, "height": height},
                    service_workers="block",
                )
                ctx.route("**/api/emr*", lambda route: route.fulfill(status=200, content_type="application/json", body='{"patients":[]}'))
                ctx.add_init_script(
                    f"""
                    localStorage.setItem('ptdtt_cache_ver', '2609281105');
                    localStorage.setItem('ptdtt_sw_build', {json.dumps(self.sw_build_ver)});
                    localStorage.setItem('ptdtt_jwt', {json.dumps(token)});
                    sessionStorage.setItem('ptdtt_jwt', {json.dumps(token)});
                    localStorage.setItem('ptdtt_session', {json.dumps(session_json)});
                    sessionStorage.setItem('ptdtt_session', {json.dumps(session_json)});
                    localStorage.setItem('ptdtt_onboarding_done', 'true');
                    """
                )
                pg = ctx.new_page()
                pg.goto(base_url + "/", wait_until="load")
                pg.wait_for_function(
                    "() => Boolean(typeof Store !== 'undefined' && Store._hasLoadedServerOnce === true && document.getElementById('nav-robot-schedule'))",
                    timeout=10000,
                )
                return ctx, pg

            # 1) Desktop Chromium 1440x900 — XSS, A5 P.CTXH Print, Color/BW toggle, Dark Mode, Negative Overflow Probe & Zero-PHI Logout Check
            ctx_desk, page = _open_logged_page("chromium", 1440, 900, "vcnguyen")
            try:
                page.click("#nav-robot-schedule")
                page.wait_for_selector("#robot-schedule-page .rbt-case-card", timeout=8000)

                # TC-R14: Verify zero XSS execution across subtabs
                for sub_key in ("week", "consult", "postponed", "completed", "trash"):
                    btn = page.locator(f'.rbt-subtab[data-rbt-code="{sub_key}"]')
                    if btn.count():
                        btn.click()
                        page.wait_for_timeout(120)
                self.assertIsNone(page.evaluate("() => window.__rbt_xss"))

                # Back to week tab and verify Brand palette (zero teal)
                page.click('.rbt-subtab[data-rbt-code="week"]')
                header_bg = page.evaluate("() => getComputedStyle(document.querySelector('.rbt-header')).backgroundImage")
                self.assertIn("29, 35, 87", header_bg)  # #1D2357

                # TC-R16 Desktop Light & Dark overflow check
                for dark in (False, True):
                    page.evaluate(f"() => document.documentElement.setAttribute('data-theme', '{'dark' if dark else 'light'}')")
                    ov = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
                    self.assertLessEqual(ov, 0, f"Desktop overflow in theme dark={dark}: {ov}")

                # TC-R15 A5 P.CTXH print preview & B&W toggle & clean phone omission
                page.evaluate("() => { window.print = () => { window.__printedA5 = document.body.classList.contains('printing-robot-pctxh') && document.getElementById('robot-pctxh-print-root').innerHTML.length > 50; }; }")
                page.click('[data-rbt-action="open_print_pctxh"]')
                page.wait_for_selector("#rbt-a5-pctxh-sheet", timeout=5000)
                sched_val = page.input_value("#rbt-pctxh-scheduler")
                self.assertEqual(sched_val, "Quang")
                sheet_html = page.inner_html("#rbt-a5-pctxh-sheet")
                self.assertIn("img/logo-khoa.jpg", sheet_html)
                self.assertNotIn(CANARY_PHONE, sheet_html)

                page.select_option("#rbt-pctxh-mode", "bw")
                self.assertTrue(page.locator("#rbt-a5-pctxh-sheet.rbt-a5-sheet--bw").count() == 1)

                page.click("#rbt-pctxh-do-print")
                self.assertTrue(page.evaluate("() => window.__printedA5"))
                # Trigger afterprint cleanup
                page.evaluate("() => window.dispatchEvent(new Event('afterprint'))")
                self.assertFalse(page.evaluate("() => document.body.classList.contains('printing-robot-pctxh')"))
                self.assertEqual(page.evaluate("() => document.getElementById('robot-pctxh-print-root').innerHTML"), "")
                page.evaluate("() => Modal.close(true)")

                # Verify Weekly Surgery Schedule shows Robot badge & clicking opens Robot tab
                page.click("#nav-surgery")
                page.wait_for_selector(".rbt-weekly-link-badge", timeout=6000)
                page.click(".rbt-weekly-link-badge")
                page.wait_for_selector("#robot-schedule-page", timeout=6000)

                # TC-R11 Zero-Local-PHI check after coordinator logout
                page.evaluate("() => { Auth.logout(); App.showLogin(); }")
                leaks = page.evaluate(
                    f"""async () => {{
                        const phone = {json.dumps(CANARY_PHONE)};
                        const ls = JSON.stringify(localStorage);
                        const ss = JSON.stringify(sessionStorage);
                        const domRoot = document.getElementById('robot-pctxh-print-root')?.innerHTML || '';
                        let cacheHits = 0;
                        if ('caches' in window) {{
                            const keys = await caches.keys();
                            for (const k of keys) {{
                                const c = await caches.open(k);
                                const reqs = await c.keys();
                                for (const rq of reqs) {{
                                    if (rq.url.includes('/api/robot')) cacheHits++;
                                }}
                            }}
                        }}
                        return {{
                            inLocalStorage: ls.includes(phone),
                            inSessionStorage: ss.includes(phone),
                            inPrintRoot: domRoot.includes(phone),
                            robotMemCleared: RobotSchedulePage._bootstrap === null,
                            cacheHits
                        }};
                    }}"""
                )
                self.assertFalse(leaks["inLocalStorage"])
                self.assertFalse(leaks["inSessionStorage"])
                self.assertFalse(leaks["inPrintRoot"])
                self.assertTrue(leaks["robotMemCleared"])
                self.assertEqual(leaks["cacheHits"], 0)
            finally:
                ctx_desk.close()

            # 2) Mobile WebKit iPhone Air 440x956 + .kb-open modal + Negative Overflow Probe (TC-R16)
            ctx_mob, mpage = _open_logged_page("webkit", 440, 956, "vcnguyen")
            try:
                mpage.click("#nav-robot-schedule")
                mpage.wait_for_selector("#robot-schedule-page .rbt-header", timeout=8000)

                def _measure_mobile_overflow():
                    return mpage.evaluate(
                        """() => {
                            const vw = window.innerWidth;
                            const docOv = document.documentElement.scrollWidth - vw;
                            const bodyOv = document.body.scrollWidth - vw;
                            const mc = document.getElementById('main-content');
                            const rbt = document.getElementById('robot-schedule-page');
                            const modal = document.getElementById('modal');
                            const mb = document.getElementById('modal-body');
                            const overlay = document.getElementById('modal-overlay');
                            const mcOv = mc ? (mc.scrollWidth - mc.clientWidth) : 0;
                            const rbtOv = rbt ? (rbt.scrollWidth - rbt.clientWidth) : 0;
                            const modalOpen = Boolean(overlay && overlay.classList.contains('active'));
                            const modalOv = (modalOpen && modal) ? (modal.scrollWidth - modal.clientWidth) : 0;
                            const mbOv = (modalOpen && mb) ? (mb.scrollWidth - mb.clientWidth) : 0;
                            let maxRight = 0;
                            if (rbt && !modalOpen) {
                                for (const el of rbt.querySelectorAll('.rbt-header, .rbt-kpi-grid, .rbt-subtabs-wrap, .rbt-week-grid, .rbt-case-card, #rbt-neg-probe')) {
                                    const r = el.getBoundingClientRect();
                                    if (r.width > 0) maxRight = Math.max(maxRight, Math.round(r.right - vw));
                                }
                            }
                            if (modalOpen && modal) {
                                for (const el of modal.querySelectorAll('#rbt-case-form, .rbt-form-grid, #rbt-neg-probe-modal')) {
                                    const r = el.getBoundingClientRect();
                                    if (r.width > 0) maxRight = Math.max(maxRight, Math.round(r.right - vw));
                                }
                            }
                            return {
                                docOv,
                                bodyOv,
                                mcOv,
                                rbtOv,
                                modalOv,
                                mbOv,
                                maxRight,
                                worst: Math.max(docOv, bodyOv, mcOv, rbtOv, modalOv, mbOv, maxRight),
                            };
                        }"""
                    )

                mob_ov = _measure_mobile_overflow()
                self.assertLessEqual(mob_ov["worst"], 0, f"Mobile WebKit overflow: {mob_ov}")

                # Negative Overflow Probe on mobile page (#robot-schedule-page)
                mpage.evaluate(
                    """() => {
                        const p = document.createElement('div');
                        p.id = 'rbt-neg-probe';
                        p.style.cssText = 'width:600px;min-width:600px;height:12px;flex-shrink:0;';
                        document.getElementById('robot-schedule-page').appendChild(p);
                    }"""
                )
                probe_page = _measure_mobile_overflow()
                self.assertGreater(probe_page["worst"], 100, f"Negative Overflow Probe (page) failed: {probe_page}")
                mpage.evaluate("() => document.getElementById('rbt-neg-probe')?.remove()")
                self.assertLessEqual(_measure_mobile_overflow()["worst"], 0)

                # Open create consult modal, simulate .kb-open, test zero overflow + Negative Overflow Probe inside modal
                mpage.click('[data-rbt-action="open_create_consult"]')
                mpage.wait_for_selector("#rbt-case-form", timeout=5000)
                mpage.evaluate("() => document.getElementById('modal-overlay').classList.add('kb-open')")
                kb_ov = _measure_mobile_overflow()
                self.assertLessEqual(kb_ov["worst"], 0, f"Mobile WebKit .kb-open overflow: {kb_ov}")

                mpage.evaluate(
                    """() => {
                        const p = document.createElement('div');
                        p.id = 'rbt-neg-probe-modal';
                        p.style.cssText = 'width:600px;min-width:600px;height:12px;';
                        document.getElementById('rbt-case-form').appendChild(p);
                    }"""
                )
                probe_modal = _measure_mobile_overflow()
                self.assertGreater(probe_modal["worst"], 100, f"Negative Overflow Probe (modal) failed: {probe_modal}")
                mpage.evaluate("() => document.getElementById('rbt-neg-probe-modal')?.remove()")
                self.assertLessEqual(_measure_mobile_overflow()["worst"], 0)
            finally:
                ctx_mob.close()
        finally:
            srv.shutdown()
            srv.server_close()


if __name__ == "__main__":
    unittest.main()
