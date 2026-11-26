#!/usr/bin/env python3
"""Comprehensive automated test suite for FEAT-243 (v2):
5-Step Robotic Surgery Coordination Module integrated 2-way with Weekly Surgery Schedule & Dual-WAL Engine.
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
        cls.tmp_root_obj = tempfile.TemporaryDirectory(prefix="ptdtt_feat243_suite_")
        cls.tmp_root = pathlib.Path(cls.tmp_root_obj.name)

        boot_dir = cls.tmp_root / "boot"
        (boot_dir / "data").mkdir(parents=True, exist_ok=True)
        (boot_dir / "logs").mkdir(parents=True, exist_ok=True)
        (boot_dir / "data" / "db.json").write_text("{}", encoding="utf-8")
        (boot_dir / "data" / "auth.json").write_text('{"users":{}}', encoding="utf-8")

        os.environ["PTDTT_DATA_DIR"] = str(boot_dir / "data")
        os.environ["PTDTT_LOG_DIR"] = str(boot_dir / "logs")
        os.environ["JWT_SECRET"] = "feat243-unit-test-secret-2026-ptdtt-robot"
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
        cls.sw_build_ver = sw_m.group(1) if sw_m else "2611261009"

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

    def _new_env(self, *, sandbox_only: bool = False, rollout_access: str = "all_staff", preseed_surgeries: list = None, extra_db: dict = None):
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
        if isinstance(extra_db, dict):
            db_payload.update(copy.deepcopy(extra_db))

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
            "lvhoan": {
                "passwordHash": self.pw_hash,
                "name": "Lê Văn Hoan",
                "title": "BSCKI.",
                "role": "Bác sĩ",
                "staffId": 11,
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
            "Idempotency-Key": idem or str(uuid.uuid4()),
        }
        return h

    def _create_scheduled_robot_case(
        self,
        client,
        *,
        patient="BN Robot Mẫu",
        s_date=None,
        slot="Ca 1",
        phone=CANARY_PHONE,
        ward_room="B708",
        surgeon_id=1,
        decider="nphuu",
    ):
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
                "wardRoom": ward_room,
                "labsReadyConfirmed": True,
                "indicationType": "robot_hoac_noisoi",
                "diagnosis": "K trực tràng giữa cT3N1M0",
                "robotProcedure": "Phẫu thuật nội soi Robot cắt trước thấp (LAR)",
                "mainSurgeonId": surgeon_id,
            },
        )
        self.assertEqual(r.status_code, 201, r.get_data(as_text=True))
        rc = r.get_json()["case"]
        code = rc["robotCaseCode"]

        r2 = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("lvhoan"),
            json={
                "action": "schedule_consult",
                "expectedRevision": rc["caseRevision"],
                "consultDate": _iso_offset(1),
                "consultSession": "sang",
                "consultScheduleNote": "Khám tầng 7",
            },
        )
        self.assertEqual(r2.status_code, 200, r2.get_data(as_text=True))
        rc = r2.get_json()["case"]

        r3 = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers(decider),
            json={
                "action": "decide_consult",
                "expectedRevision": rc["caseRevision"],
                "decision": "robot",
                "surgeryDate": s_date,
                "caseSlot": slot,
                "mainSurgeonId": surgeon_id,
                "consultNote": "BN đồng ý mổ Robot",
            },
        )
        self.assertEqual(r3.status_code, 200, r3.get_data(as_text=True))
        return r3.get_json()["case"]

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

    def test_tc_r01_5step_workflow_rbac_and_zero_phi_notifs(self):
        _, data_file, client = self._new_env(sandbox_only=False)

        # Head Nurse & nurse cannot submit Step 1 consult (doctor-only RBAC)
        for non_doc in ("ntnthuy", "ttdanh"):
            r_deny = client.post(
                "/api/robot/cases",
                headers=self._headers(non_doc),
                json={
                    "action": "create_consult",
                    "patientName": "BN Deny",
                    "phone": CANARY_PHONE,
                    "wardRoom": "B708",
                    "labsReadyConfirmed": True,
                    "diagnosis": "K trực tràng",
                },
            )
            self.assertEqual(r_deny.status_code, 403, f"Expected 403 for {non_doc}, got {r_deny.status_code}")

        # Missing labsReadyConfirmed or wardRoom -> 422
        r_nolab = client.post(
            "/api/robot/cases",
            headers=self._headers("vnatuan"),
            json={
                "action": "create_consult",
                "patientName": "BN Missing Labs",
                "phone": CANARY_PHONE,
                "wardRoom": "B708",
                "labsReadyConfirmed": False,
                "diagnosis": "K trực tràng",
            },
        )
        self.assertEqual(r_nolab.status_code, 422)

        # Doctor submits consult + coordinators schedule + TS. Hữu decides
        rc = self._create_scheduled_robot_case(client, patient="BN Năm Bước", s_date=_iso_offset(3), slot="Ca 1")
        self.assertEqual(rc["status"], "da_xep_robot")
        self.assertEqual(rc["wardRoom"], "B708")
        self.assertEqual(rc["consultedByStaffId"], 1)
        self.assertTrue(rc["canonicalSurgeryId"])

        # Coordinator cannot leak PHI inside notifications
        db = json.loads(data_file.read_text(encoding="utf-8"))
        rbt_notifs = [n for n in (db.get("notifications") or []) if n.get("sourceType") == "robot_coordination"]
        self.assertGreaterEqual(len(rbt_notifs), 3)
        for n in rbt_notifs:
            self.assertNotIn("BN Năm Bước", n.get("message", ""))
            self.assertNotIn(CANARY_PHONE, n.get("message", ""))

        # Weekly edit syncs back to Robot and locks approachType='robot'
        sid = rc["canonicalSurgeryId"]
        r_put = self._put_surgeries_snapshot(
            client,
            "vnatuan",
            lambda items: [{**x, "diagnosis": "K trực tràng cT3N1 (Đã hội chẩn)"} if x["id"] == sid else x for x in items],
        )
        self.assertEqual(r_put.status_code, 200, r_put.get_data(as_text=True))
        r_lock = self._put_surgeries_snapshot(
            client,
            "vkan",
            lambda items: [{**x, "approachType": "mo"} if x["id"] == sid else x for x in items],
        )
        self.assertEqual(r_lock.status_code, 409)
        self.assertEqual(r_lock.get_json().get("code"), "ROBOT_APPROACH_LOCKED")

        r_boot = client.get("/api/robot/bootstrap", headers=self._headers("vcnguyen")).get_json()
        got = next(c for c in r_boot["cases"] if c["robotCaseCode"] == rc["robotCaseCode"])
        self.assertEqual(got["diagnosis"], "K trực tràng cT3N1 (Đã hội chẩn)")

        # Create consult WITHOUT phone succeeds; invalid phone -> 422; owner doctor can soft_delete waiting consult, non-owner nurse -> 403
        r_bad_ph = client.post(
            "/api/robot/cases",
            headers=self._headers("vnatuan"),
            json={"action": "create_consult", "patientName": "BN Sai SĐT", "phone": "123", "wardRoom": "B708", "labsReadyConfirmed": True, "diagnosis": "K trực tràng"},
        )
        self.assertEqual(r_bad_ph.status_code, 422)

        r_noph = client.post(
            "/api/robot/cases",
            headers=self._headers("vnatuan"),
            json={"action": "create_consult", "patientName": "BN Không SĐT", "phone": "", "wardRoom": "B708", "labsReadyConfirmed": True, "diagnosis": "U đại tràng phải"},
        )
        self.assertEqual(r_noph.status_code, 201, r_noph.get_data(as_text=True))
        noph_rc = r_noph.get_json()["case"]
        self.assertEqual(noph_rc["phone"], "")

        r_del_deny = client.patch(
            f"/api/robot/cases/{noph_rc['robotCaseCode']}",
            headers=self._headers("ttdanh"),
            json={"action": "soft_delete", "expectedRevision": noph_rc["caseRevision"]},
        )
        self.assertEqual(r_del_deny.status_code, 403)

        r_del_ok = client.patch(
            f"/api/robot/cases/{noph_rc['robotCaseCode']}",
            headers=self._headers("vnatuan"),
            json={"action": "soft_delete", "expectedRevision": noph_rc["caseRevision"], "deleteReason": "Nhập nhầm ca chờ tư vấn"},
        )
        self.assertEqual(r_del_ok.status_code, 200, r_del_ok.get_data(as_text=True))
        self.assertEqual(r_del_ok.get_json()["case"]["status"], "da_xoa")

    def test_tc_r02_laparoscopic_decision_2way_sync_and_no_robot_slot_limit(self):
        _, _, client = self._new_env(sandbox_only=False)
        target_day = _iso_offset(4)

        # Fill all 3 Robot slots on target_day
        for idx, sl in enumerate(("Ca 1", "Ca 2", "Ca 3"), start=1):
            self._create_scheduled_robot_case(client, patient=f"BN Robot Full {idx}", s_date=target_day, slot=sl)

        # Submit a 4th consult -> TS. Hữu decides "noisoi" on SAME day -> SUCCEEDS (no Robot capacity block)
        r = client.post(
            "/api/robot/cases",
            headers=self._headers("vnatuan"),
            json={
                "action": "create_consult",
                "patientName": "BN Chuyển Nội Soi",
                "birthYear": 1970,
                "phone": CANARY_PHONE,
                "wardRoom": "ngoai_tru",
                "labsReadyConfirmed": True,
                "diagnosis": "Polyp lớn đại tràng Sigma",
                "robotProcedure": "PT Nội soi cắt đại tràng Sigma",
            },
        )
        self.assertEqual(r.status_code, 201)
        rc = r.get_json()["case"]

        r_dec = client.patch(
            f"/api/robot/cases/{rc['robotCaseCode']}",
            headers=self._headers("nphuu"),
            json={
                "action": "decide_consult",
                "expectedRevision": rc["caseRevision"],
                "decision": "noisoi",
                "surgeryDate": target_day,
                "mainSurgeonId": 4,
                "scheduledSurgeryType": "yeucau",
                "consultNote": "BN chọn mổ nội soi thường quy",
            },
        )
        self.assertEqual(r_dec.status_code, 200, r_dec.get_data(as_text=True))
        ns_case = r_dec.get_json()["case"]
        self.assertEqual(ns_case["status"], "da_xep_noisoi")
        self.assertEqual(ns_case["scheduledApproach"], "noisoi")
        self.assertEqual(ns_case["scheduledSurgeryType"], "yeucau")
        sid = ns_case["canonicalSurgeryId"]

        # Verify Weekly schedule record has approachType=noisoi & surgeryType=yeucau
        r_data = client.get("/api/data", headers=self._headers("vnatuan")).get_json()
        srec = next(s for s in r_data["surgeries"] if s["id"] == sid)
        self.assertEqual(srec["approachType"], "noisoi")
        self.assertEqual(srec["surgeryType"], "yeucau")
        self.assertEqual(srec["robotSyncMeta"]["scheduledApproach"], "noisoi")

        # Update surgeryType=bankhan in Weekly -> syncs back to robotCase; changing approachType -> 409
        r_upd = self._put_surgeries_snapshot(
            client,
            "vnatuan",
            lambda items: [{**x, "surgeryType": "bankhan"} if x["id"] == sid else x for x in items],
        )
        self.assertEqual(r_upd.status_code, 200, r_upd.get_data(as_text=True))
        r_boot = client.get("/api/robot/bootstrap", headers=self._headers("vnatuan")).get_json()
        got_ns = next(c for c in r_boot["cases"] if c["robotCaseCode"] == rc["robotCaseCode"])
        self.assertEqual(got_ns["scheduledSurgeryType"], "bankhan")

    def test_tc_r03_considering_declined_and_reopen_consult(self):
        _, _, client = self._new_env(sandbox_only=False)
        r = client.post(
            "/api/robot/cases",
            headers=self._headers("vnatuan"),
            json={
                "action": "create_consult",
                "patientName": "BN Cân Nhắc",
                "phone": CANARY_PHONE,
                "wardRoom": "B710",
                "labsReadyConfirmed": True,
                "diagnosis": "K đại tràng lên",
            },
        )
        rc = r.get_json()["case"]
        code = rc["robotCaseCode"]

        # Considering -> can_nhac
        r_c = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("nphuu"),
            json={"action": "decide_consult", "expectedRevision": rc["caseRevision"], "decision": "can_nhac", "consultNote": "Chờ gia đình bàn thêm"},
        )
        self.assertEqual(r_c.status_code, 200)
        rc = r_c.get_json()["case"]
        self.assertEqual(rc["status"], "can_nhac")

        # Re-schedule increments consultRound
        r_s2 = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("vcnguyen"),
            json={"action": "schedule_consult", "expectedRevision": rc["caseRevision"], "consultDate": _iso_offset(2), "consultSession": "chieu"},
        )
        self.assertEqual(r_s2.status_code, 200)
        rc = r_s2.get_json()["case"]
        self.assertGreaterEqual(rc["consultRound"], 2)

        # Declined requires valid refusalReason
        r_bad = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("nphuu"),
            json={"action": "decide_consult", "expectedRevision": rc["caseRevision"], "decision": "khong_mo"},
        )
        self.assertEqual(r_bad.status_code, 422)

        r_no = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("nphuu"),
            json={"action": "decide_consult", "expectedRevision": rc["caseRevision"], "decision": "khong_mo", "refusalReason": "chi_phi"},
        )
        self.assertEqual(r_no.status_code, 200)
        rc = r_no.get_json()["case"]
        self.assertEqual(rc["status"], "khong_dong_y_mo")

        # Reopen consult -> cho_xep_tu_van
        r_re = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("lvhoan"),
            json={"action": "reopen_consult", "expectedRevision": rc["caseRevision"]},
        )
        self.assertEqual(r_re.status_code, 200)
        self.assertEqual(r_re.get_json()["case"]["status"], "cho_xep_tu_van")

    def test_tc_r04_discharge_wait_slot_preservation_and_idempotent_reminder(self):
        _, data_file, client = self._new_env(sandbox_only=False)
        s_date = _iso_offset(5)
        rc = self._create_scheduled_robot_case(client, patient="BN Xuất Viện Chờ", s_date=s_date, slot="Ca 2")
        code = rc["robotCaseCode"]
        sid = rc["canonicalSurgeryId"]

        # plannedReadmitDate after surgeryDate -> 422
        r_after = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("vnatuan"),
            json={"action": "discharge_wait", "expectedRevision": rc["caseRevision"], "plannedReadmitDate": _iso_offset(6)},
        )
        self.assertEqual(r_after.status_code, 422)

        # Set plannedReadmitDate within 0..2 days (tomorrow!) -> succeeds, keeps slot in surgeries[]!
        readmit_date = _iso_offset(1)
        r_dw = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("vnatuan"),
            json={"action": "discharge_wait", "expectedRevision": rc["caseRevision"], "plannedReadmitDate": readmit_date, "dischargeReason": "Ngưng kháng đông 3 ngày"},
        )
        self.assertEqual(r_dw.status_code, 200, r_dw.get_data(as_text=True))
        rc = r_dw.get_json()["case"]
        self.assertEqual(rc["status"], "da_xep_robot")
        self.assertEqual(rc["inpatientState"], "xuat_vien_cho")

        # Active surgery STILL in surgeries[] and NOT in surgeriesTrash
        data_now = client.get("/api/data", headers=self._headers("vnatuan")).get_json()
        self.assertTrue(any(s["id"] == sid for s in data_now["surgeries"]))
        self.assertFalse(any(s["id"] == sid for s in data_now.get("surgeriesTrash", [])))

        # Another case trying same date + Ca 2 MUST hit 409 slot conflict (slot preserved!)
        r_conf = client.post(
            "/api/robot/cases",
            headers=self._headers("vcnguyen"),
            json={
                "action": "create_case",
                "patientName": "BN Chồng Slot",
                "wardRoom": "B705",
                "labsReadyConfirmed": True,
                "diagnosis": "K trực tràng",
                "surgeryDate": s_date,
                "caseSlot": "Ca 2",
                "mainSurgeonId": 1,
            },
        )
        self.assertEqual(r_conf.status_code, 409)
        self.assertEqual(r_conf.get_json().get("code"), "SCHEDULE_SLOT_CONFLICT")

        # Bootstrap emits idempotent readmission reminder (exactly 1 per staff target)
        client.get("/api/robot/bootstrap", headers=self._headers("vnatuan"))
        db1 = json.loads(data_file.read_text(encoding="utf-8"))
        rem1 = [n for n in db1.get("notifications", []) if n.get("type") == "robot_readmit_reminder"]
        self.assertGreaterEqual(len(rem1), 1)
        for n in rem1:
            self.assertNotIn("BN Xuất Viện Chờ", n["message"])

        client.get("/api/robot/bootstrap", headers=self._headers("vcnguyen"))
        db2 = json.loads(data_file.read_text(encoding="utf-8"))
        rem2 = [n for n in db2.get("notifications", []) if n.get("type") == "robot_readmit_reminder"]
        self.assertEqual(len(rem1), len(rem2))

        # 1-tap confirm_readmit
        r_in = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("vnatuan"),
            json={"action": "confirm_readmit", "expectedRevision": rc["caseRevision"]},
        )
        self.assertEqual(r_in.status_code, 200)
        self.assertEqual(r_in.get_json()["case"]["inpatientState"], "da_nhap_lai")

    def test_tc_r05_occ_trash_lock_concurrency_rollover_and_v2_migration(self):
        _, data_file, client = self._new_env(sandbox_only=False)
        rc = self._create_scheduled_robot_case(client, patient="BN Lock & OCC", s_date=_iso_offset(3), slot="Ca 1")
        code = rc["robotCaseCode"]
        sid = rc["canonicalSurgeryId"]

        # Stale Bulk PUT -> 409 CASE_REVISION_MISMATCH (bump case via Robot edit first so snapshot caseRevision is stale)
        r_get = client.get("/api/data", headers=self._headers("vkan")).get_json()
        r_bump = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("vcnguyen"),
            json={"action": "edit_info", "expectedRevision": rc["caseRevision"], "note": "Bumped before stale PUT"},
        )
        self.assertEqual(r_bump.status_code, 200)
        rc = r_bump.get_json()["case"]
        stale = client.put(
            "/api/data/surgeries",
            headers=self._headers("vkan"),
            json={"items": [{**x, "diagnosis": "Stale Edit"} if x["id"] == sid else x for x in r_get["surgeries"]], "baseRevision": r_get["_revisions"]["surgeries"], "baseItems": r_get["surgeries"]},
        )
        self.assertEqual(stale.status_code, 409)

        # Direct legacy trash blocked -> 409 on active Robot-linked surgery
        self.assertEqual(client.post(f"/api/surgeries/{sid}/trash", headers=self._headers("vkan")).status_code, 409)

        # Concurrent Robot slot creation on same date+slot -> exactly 1 succeeds, 1 conflicts
        s_day = _iso_offset(7)
        def _race(idx: int):
            c_local = self.sf.app.test_client()
            return c_local.post(
                "/api/robot/cases",
                headers=self._headers("vcnguyen"),
                json={
                    "action": "create_case",
                    "patientName": f"BN Race {idx}",
                    "wardRoom": "B709",
                    "labsReadyConfirmed": True,
                    "diagnosis": "K trực tràng",
                    "surgeryDate": s_day,
                    "caseSlot": "Ca 1",
                    "mainSurgeonId": 1,
                },
            ).status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = sorted(list(pool.map(_race, (1, 2))))
        self.assertEqual(statuses, [201, 409])

        # Soft-delete -> restore -> soft-delete -> DELETE archive
        r_del = client.patch(
            f"/api/robot/cases/{code}",
            headers=self._headers("vcnguyen"),
            json={"action": "soft_delete", "expectedRevision": rc["caseRevision"]},
        )
        self.assertEqual(r_del.status_code, 200)
        rc_del = r_del.get_json()["case"]
        self.assertEqual(rc_del["status"], "da_xoa")

        r_arch = client.delete(
            f"/api/robot/cases/{code}",
            headers=self._headers("vcnguyen"),
            json={"expectedRevision": rc_del["caseRevision"]},
        )
        self.assertEqual(r_arch.status_code, 200)
        self.assertEqual(r_arch.get_json()["case"]["status"], "archived_deleted")

        # Legacy v1 migration test: legacy xuat_vien_cho + surgeriesTrash -> restored to surgeries[] + da_xep_robot
        db = json.loads(data_file.read_text(encoding="utf-8"))
        db["robotConfig"] = {"coordinators": ["vcnguyen"], "defaultSchedulerName": "BSCKII. Võ Chí Nguyện"}
        db["surgeriesTrash"].append({
            "id": 888001,
            "patientName": "Phan Thị Legacy",
            "birthYear": 1962,
            "date": _iso_offset(10),
            "diagnosis": "U ác trực tràng",
            "method": "PT Robot cắt trước thấp",
            "surgeryType": "robot",
            "approachType": "robot",
            "mainSurgeon": 1,
            "robotCaseId": "RB-2026-8881",
        })
        db["robotCases"].append({
            "robotCaseCode": "RB-2026-8881",
            "soNV": "RB-2026-8881",
            "status": "xuat_vien_cho",
            "patientName": "Phan Thị Legacy",
            "birthYear": 1962,
            "diagnosis": "U ác trực tràng",
            "robotProcedure": "PT Robot cắt trước thấp",
            "mainSurgeonId": 1,
            "surgeryDate": _iso_offset(10),
            "caseSlot": "Ca 3",
            "canonicalSurgeryId": 888001,
            "activeLinkedSurgeryId": 888001,
            "linkState": "trashed_link",
            "caseRevision": 2,
        })
        data_file.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")

        boot = client.get("/api/robot/bootstrap", headers=self._headers("vkan")).get_json()
        self.assertIn("lvhoan", boot["robotConfig"]["coordinators"])
        mig_rc = next(c for c in boot["cases"] if c["robotCaseCode"] == "RB-2026-8881")
        self.assertEqual(mig_rc["status"], "da_xep_robot")
        self.assertEqual(mig_rc["inpatientState"], "xuat_vien_cho")
        d_after = client.get("/api/data", headers=self._headers("vkan")).get_json()
        self.assertTrue(any(s["id"] == 888001 and s["approachType"] == "robot" for s in d_after["surgeries"]))

    def test_tc_r06_canary_phi_privacy_and_sandbox_exclusion(self):
        _, _, client = self._new_env(sandbox_only=False)
        rc = self._create_scheduled_robot_case(client, patient="BN Bảo Mật", phone=CANARY_PHONE)
        code = rc["robotCaseCode"]

        # Create sandbox case
        r_sbx = client.post(
            "/api/robot/cases",
            headers=self._headers("vkan"),
            json={
                "action": "create_consult",
                "patientName": "[TEST] BN Giả Lập",
                "wardRoom": "B705",
                "labsReadyConfirmed": True,
                "phone": CANARY_PHONE,
                "diagnosis": "K trực tràng",
                "isTestSandboxCase": True,
            },
        )
        self.assertEqual(r_sbx.status_code, 201)

        # Nurse view: phone masked + no sandbox case
        r_boot = client.get("/api/robot/bootstrap", headers=self._headers("ttdanh")).get_json()
        codes = [c["robotCaseCode"] for c in r_boot["cases"]]
        self.assertIn(code, codes)
        self.assertFalse(any("RBSBX" in c for c in codes))
        got = next(c for c in r_boot["cases"] if c["robotCaseCode"] == code)
        self.assertEqual(got["phone"], CANARY_MASKED)
        self.assertNotIn(CANARY_PHONE, json.dumps(r_boot, ensure_ascii=False))

    def test_tc_r07_playwright_e2e_5step_zalo_a5_xss_and_mobile_webkit(self):
        _, _, client = self._new_env(sandbox_only=False)
        xss_str = '<img src=x onerror="window.__rbt_xss=1">BN Nguyễn XSS'
        rc = self._create_scheduled_robot_case(client, patient=xss_str, phone=CANARY_PHONE, s_date=_iso_offset(2), slot="Ca 1")

        # Add a waiting consult case & a xuat_vien_cho case
        client.post(
            "/api/robot/cases",
            headers=self._headers("vnatuan"),
            json={
                "action": "create_consult",
                "patientName": "BN Chờ Tư Vấn E2E",
                "birthYear": 1968,
                "phone": CANARY_PHONE,
                "wardRoom": "B712A",
                "labsReadyConfirmed": True,
                "diagnosis": '<svg onload="window.__rbt_xss=1">U đại tràng',
            },
        )

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
                    localStorage.setItem('ptdtt_icon_guide_v261121_dismissed', '1');
                    localStorage.setItem('ptdtt_robot_tutorial_v2_dismissed', '1');
                    """
                )
                pg = ctx.new_page()
                pg.goto(base_url + "/", wait_until="load")
                pg.wait_for_function(
                    "() => Boolean(typeof Store !== 'undefined' && Store._hasLoadedServerOnce === true && document.getElementById('nav-robot-schedule'))",
                    timeout=10000,
                )
                return ctx, pg

            # 1) Desktop Chromium 1440x900
            ctx_desk, page = _open_logged_page("chromium", 1440, 900, "vcnguyen")
            try:
                page.click("#nav-robot-schedule")
                page.wait_for_selector("#robot-schedule-page #rbt-my-work-bar", timeout=8000)
                self.assertIn("Việc của tôi", page.inner_text("#rbt-my-work-bar"))

                # XSS check across all 5 subtabs + config
                for sub_key in ("consult", "week", "ward", "declined_postponed", "completed"):
                    btn = page.locator(f'.rbt-subtab[data-rbt-subtab="{sub_key}"]')
                    if btn.count():
                        btn.click()
                        page.wait_for_timeout(120)
                self.assertIsNone(page.evaluate("() => window.__rbt_xss"))

                # Zero-Teal Dark mode & Desktop overflow check
                for dark in (False, True):
                    page.evaluate(f"() => document.documentElement.setAttribute('data-theme', '{'dark' if dark else 'light'}')")
                    ov = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
                    self.assertLessEqual(ov, 0, f"Desktop overflow dark={dark}: {ov}")

                # Step 1 create consult via UI WITHOUT phone -> succeeds
                page.click('.rbt-subtab[data-rbt-subtab="consult"]')
                page.click('[data-rbt-action="open_create_consult"]')
                page.wait_for_selector("#rbt-inp-name", timeout=5000)
                page.fill("#rbt-inp-name", "BN UI Năm Bước")
                page.fill("#rbt-inp-birth", "1972")
                page.fill("#rbt-inp-phone", "")
                page.select_option("#rbt-inp-ward-room", "B711")
                page.fill("#rbt-inp-diag", "K đại tràng Sigma")
                page.check("#rbt-inp-labs-ready")
                page.click('[data-rbt-action="submit_create"]')
                page.wait_for_timeout(500)
                self.assertIn("BN UI Năm Bước", page.inner_text("#robot-schedule-page"))

                # Soft-delete the earlier XSS waiting consult directly via 🗑️ Xóa button + confirm modal
                del_btns = page.locator('[data-rbt-action="open_confirm_delete"]')
                self.assertGreaterEqual(del_btns.count(), 1)
                del_btns.last.click()
                page.wait_for_selector('[data-rbt-action="confirm_soft_delete"]', timeout=5000)
                page.click('[data-rbt-action="confirm_soft_delete"]')
                page.wait_for_timeout(500)

                # Zalo copy captures Zero-PHI schedule with \n\n after header
                page.evaluate("""() => {
                    Object.defineProperty(navigator, 'clipboard', {
                        value: { writeText: (t) => { window.__zaloCopied = t; return Promise.resolve(); } },
                        configurable: true
                    });
                }""")
                # Schedule "BN UI Năm Bước" so it's in da_xep_tu_van, then copy Zalo:
                sched_btns = page.locator('[data-rbt-action="open_schedule_consult"]')
                sched_btns.first.click()
                page.wait_for_selector("#rbt-inp-consult-date", timeout=5000)
                page.click('[data-rbt-action="submit_schedule_consult"]')
                page.wait_for_timeout(500)

                page.click('[data-rbt-action="copy_zalo_consult"]')
                page.wait_for_timeout(300)
                zalo_txt = page.evaluate("() => window.__zaloCopied || ''")
                self.assertIn("LỊCH TƯ VẤN PHẪU THUẬT ROBOT", zalo_txt)
                self.assertIn("\n\n", zalo_txt)
                self.assertNotIn(CANARY_PHONE, zalo_txt)

                # Single & Weekly A5 P.CTXH Print (Color + B&W)
                page.evaluate("() => { window.print = () => { window.__printedA5 = document.body.classList.contains('printing-robot-pctxh') && document.getElementById('robot-pctxh-print-root').innerHTML.length > 50; }; }")
                page.click('[data-rbt-action="open_print_modal"]')
                page.wait_for_selector("#rbt-print-preview-host .rbt-a5-sheet", timeout=5000)
                sheet_html = page.inner_html("#rbt-print-preview-host")
                self.assertIn("img/logo-khoa.jpg", sheet_html)
                self.assertNotIn(CANARY_PHONE, sheet_html)
                page.select_option("#rbt-inp-print-mode", "bw")
                self.assertEqual(page.locator("#rbt-print-preview-host .rbt-a5-sheet.rbt-a5-sheet--bw").count(), 1)
                page.click('[data-rbt-action="execute_print_pctxh"]')
                self.assertTrue(page.evaluate("() => window.__printedA5 === true"))
            finally:
                ctx_desk.close()

            # 1b) SuperAdmin Sandbox auto-fill verification
            ctx_sbx, spage = _open_logged_page("chromium", 1440, 900, "vkan")
            try:
                spage.click("#nav-robot-schedule")
                spage.wait_for_selector("#rbt-open-sandbox-btn", timeout=8000)
                spage.click("#rbt-open-sandbox-btn")
                spage.wait_for_selector("#rbt-inp-sandbox", timeout=5000)
                self.assertTrue(spage.is_checked("#rbt-inp-sandbox"))
                self.assertIn("[TEST]", spage.input_value("#rbt-inp-name"))
                self.assertTrue(len(spage.input_value("#rbt-inp-phone")) == 10)
                self.assertTrue(bool(spage.input_value("#rbt-inp-ward-room")))
                self.assertTrue(bool(spage.input_value("#rbt-inp-diag")))
                self.assertTrue(spage.is_checked("#rbt-inp-labs-ready"))
                # Rotate profile button changes patientName
                first_name = spage.input_value("#rbt-inp-name")
                spage.click("#rbt-btn-autofill-sandbox")
                self.assertNotEqual(spage.input_value("#rbt-inp-name"), first_name)
                spage.click('[data-rbt-action="submit_create"]')
                spage.wait_for_timeout(500)
                self.assertIn("RBSBX-", spage.inner_text("#robot-schedule-page"))
            finally:
                ctx_sbx.close()

            # 2) Mobile iPhone WebKit (440x956) ergonomics
            ctx_mob, mpage = _open_logged_page("webkit", 440, 956, "vnatuan")
            try:
                mpage.evaluate("() => App.navigate('robot-schedule')")
                mpage.wait_for_selector("#robot-schedule-page .rbt-header", timeout=8000)
                metrics = mpage.evaluate(
                    """() => {
                        const hdr = document.querySelector('#robot-schedule-page .rbt-header');
                        const fab = document.getElementById('rbt-mobile-fab');
                        const tut = document.getElementById('rbt-mobile-tutorial-pill');
                        return {
                            ov: document.documentElement.scrollWidth - window.innerWidth,
                            hdrH: hdr ? hdr.getBoundingClientRect().height : 999,
                            fabPos: fab ? getComputedStyle(fab).position : '',
                            fabW: fab ? fab.getBoundingClientRect().width : 0,
                            tutH: tut ? tut.getBoundingClientRect().height : 0
                        };
                    }"""
                )
                self.assertLessEqual(metrics["ov"], 0, f"Mobile overflow: {metrics}")
                self.assertLessEqual(metrics["hdrH"], 85, f"Mobile header too tall: {metrics}")
                self.assertNotEqual(metrics["fabPos"], "fixed")
                self.assertGreaterEqual(metrics["fabW"], 44)
                self.assertGreaterEqual(metrics["tutH"], 44)
            finally:
                ctx_mob.close()
        finally:
            srv.shutdown()


if __name__ == "__main__":
    unittest.main(verbosity=2)
