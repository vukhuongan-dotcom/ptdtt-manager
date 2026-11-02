#!/usr/bin/env python3
"""End-to-end verification suite for Phase-1 Accountability, Personal Auth & Crosscheck Vòng 2:
- QĐ1 & QĐ2: Login-once JWT (no /api/auth/verify-actor, no public /api/auth/staff-cards picker),
  mustChangePassword gate, 10-char password policy, sessionEpoch cross-device revocation.
- QĐ3: Phase-1 scope filter (elective scheduled only), 403 NOT_IN_PHASE1_SCOPE on /submit-emergency,
  sandboxOnlyMode 0% real patient touch.
- Mục 2.D: 2-tier server-side multi-episode duplicate protection (episodeId, priorEpisodeId,
  Tier 1 admissionId, Tier 2 patientName+birthYear, sandbox & trash isolation).
- Mục 3.A: Custom procedure outside DM 309 (proposedClass vs BCN verifiedClass).
- Mục 3.B–3.C: 18 TNM vignettes across AJCC 8 Ch.20 Colorectal & AJCC v9 (2023) Anal Canal SCC,
  discordant multi-site, special histology, cTNM vs ycTNM preservation, and specialist sign-off gate.
- Mục 4 & Mục 8 (V2-G1..V2-G4): Dual hash-chained journals (S1 -> S2 -> S3), crash injection +
  idempotent double replay (Replay #1 == Replay #2), > 64 KiB adaptive tail scan + torn-line truncation,
  2 rotations in same quarter + reverse pagination across .jsonl.gz + Host-B disaster restore.
- QĐ4 & V2-G4: Stale re-verification, proxy-submit (ONLY assistSurgeon1 & server_roster POD attending),
  BCN self-approval, Ca #9021 Dual KPIs across months, and concurrency benchmark (c=1, 4, 8).
"""

from __future__ import annotations

import concurrent.futures
import copy
import gzip
import hashlib
import json
import os
import pathlib
import resource
import shutil
import statistics
import sys
import tempfile
import time
import unittest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Configure isolated boot directory BEFORE importing server_flask so repo data/ is never touched
_BOOT_TMP = tempfile.TemporaryDirectory()
_BOOT_DATA = pathlib.Path(_BOOT_TMP.name) / "data"
_BOOT_LOGS = pathlib.Path(_BOOT_TMP.name) / "logs"
_BOOT_DATA.mkdir(parents=True, exist_ok=True)
_BOOT_LOGS.mkdir(parents=True, exist_ok=True)
shutil.copy2(REPO_ROOT / "data" / "procedure_catalog_2026_v1.json", _BOOT_DATA / "procedure_catalog_2026_v1.json")
(_BOOT_DATA / "db.json").write_text(
    json.dumps({"staff": [], "rooms": [], "surgeries": [], "surgeriesTrash": [], "notifications": []}, ensure_ascii=False),
    encoding="utf-8",
)

os.environ["PTDTT_TESTING"] = "1"
os.environ["PTDTT_DATA_DIR"] = str(_BOOT_DATA)
os.environ["PTDTT_LOG_DIR"] = str(_BOOT_LOGS)
os.environ.setdefault("JWT_SECRET", "unit-test-jwt-secret-2026-ptdtt-only")

import server_flask as sf  # noqa: E402
import surgery_approval_engine as eng  # noqa: E402
from surgery_approval_routes import ensure_approval_bootstrapped  # noqa: E402

_CACHED_PW_HASHES = {
    pw: sf._hash_password(pw)
    for pw in (
        "HuuStrong2026",
        "AnStrong2026",
        "TuanStrong2026",
        "PhuStrong2026",
        "QuyStrong2026",
        "DucStrong2026",
        "ndtphu",
    )
}


def _pw_hash(pw: str) -> str:
    return _CACHED_PW_HASHES.get(pw) or sf._hash_password(pw)


def _setup_isolated_server_env(tmp_dir: pathlib.Path, *, sandbox_only: bool = False, rollout_access: str = "all_staff"):
    """Redirects server_flask globals to a fresh temporary directory with realistic staff & auth fixtures."""
    src_db = json.loads((REPO_ROOT / "data" / "db.json").read_text(encoding="utf-8"))
    data_dir = tmp_dir / "data"
    log_dir = tmp_dir / "logs"
    data_dir.mkdir(parents=True, exist_ok=True)
    log_dir.mkdir(parents=True, exist_ok=True)

    shutil.copy2(
        REPO_ROOT / "data" / "procedure_catalog_2026_v1.json",
        data_dir / "procedure_catalog_2026_v1.json",
    )

    cfg = copy.deepcopy(eng.DEFAULT_SURGERY_APPROVAL_CONFIG)
    cfg["sandboxOnlyMode"] = sandbox_only
    cfg["rolloutAccessMode"] = rollout_access
    cfg["rolloutEffectiveSurgeryDate"] = "2026-11-09"
    cfg["checklistMode"] = "enforced_gate"
    cfg["enableAutoStageDerivation"] = False

    db_payload = {
        "staff": copy.deepcopy(src_db.get("staff") or []),
        "departedStaff": copy.deepcopy(src_db.get("departedStaff") or []),
        "rooms": copy.deepcopy(src_db.get("rooms") or []),
        "externalDoctors": copy.deepcopy(src_db.get("externalDoctors") or [{"id": 101, "name": "PGS.TS. Bác sĩ Ngoài Khoa"}]),
        "surgeries": [],
        "surgeriesTrash": [],
        "notifications": [],
        "approvalDelegations": [],
        "surgeryApprovalConfig": cfg,
        "nextIds": {"surgeries": 1001, "notifications": 1},
        "_revisions": {"surgeries": 1, "surgeriesTrash": 1, "notifications": 1},
    }
    data_file = data_dir / "db.json"
    data_file.write_text(json.dumps(db_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    users = {
        "nphuu": {
            "passwordHash": _pw_hash("HuuStrong2026"),
            "name": "Nguyễn Phú Hữu",
            "title": "TS. BSCKII.",
            "role": "Trưởng khoa",
            "staffId": 1,
            "isAdmin": True,
            "isSuperAdmin": False,
            "disabled": False,
            "mustChangePassword": False,
            "sessionEpoch": 1,
        },
        "vkan": {
            "passwordHash": _pw_hash("AnStrong2026"),
            "name": "Vũ Khương An",
            "title": "BSCKII.",
            "role": "Phó trưởng khoa",
            "staffId": 2,
            "isAdmin": True,
            "isSuperAdmin": True,
            "disabled": False,
            "mustChangePassword": False,
            "sessionEpoch": 1,
        },
        "vnatu": {
            "passwordHash": _pw_hash("TuanStrong2026"),
            "name": "Vũ Ngọc Anh Tuấn",
            "title": "BSCKII.",
            "role": "Bác sĩ điều trị",
            "staffId": 4,
            "isAdmin": False,
            "isSuperAdmin": False,
            "disabled": False,
            "mustChangePassword": False,
            "sessionEpoch": 1,
        },
        "pvphu": {
            "passwordHash": _pw_hash("PhuStrong2026"),
            "name": "Phạm Vĩnh Phú",
            "title": "ThS. BSCKI.",
            "role": "Bác sĩ điều trị",
            "staffId": 7,
            "isAdmin": False,
            "isSuperAdmin": False,
            "disabled": False,
            "mustChangePassword": False,
            "sessionEpoch": 1,
        },
        "ghtquy": {
            "passwordHash": _pw_hash("QuyStrong2026"),
            "name": "Giao Hữu Trường Quy",
            "title": "ThS. BSCKI.",
            "role": "Bác sĩ điều trị",
            "staffId": 8,
            "isAdmin": False,
            "isSuperAdmin": False,
            "disabled": False,
            "mustChangePassword": False,
            "sessionEpoch": 1,
        },
        "thmduc": {
            "passwordHash": _pw_hash("DucStrong2026"),
            "name": "Trịnh Hoàng Minh Đức",
            "title": "ThS. BSCKI.",
            "role": "Bác sĩ điều trị",
            "staffId": 9,
            "isAdmin": False,
            "isSuperAdmin": False,
            "disabled": False,
            "mustChangePassword": False,
            "sessionEpoch": 1,
        },
        "ndtphu": {
            # Default password == username -> must trigger mustChangePassword on login!
            "passwordHash": _pw_hash("ndtphu"),
            "name": "Nguyễn Đức Thiên Phú",
            "title": "BSNT.",
            "role": "Bác sĩ nội trú",
            "staffId": 45,
            "isAdmin": False,
            "isSuperAdmin": False,
            "disabled": False,
            "mustChangePassword": False,
            "sessionEpoch": 1,
        },
        "ntnthuy": {
            "passwordHash": _pw_hash("ThuyStrong2026"),
            "name": "Nguyễn Thị Ngọc Thùy",
            "title": "CNĐD.",
            "role": "Điều dưỡng trưởng",
            "staffId": 3,
            "isAdmin": True,
            "isSuperAdmin": False,
            "disabled": False,
            "mustChangePassword": False,
            "sessionEpoch": 1,
        },
    }
    auth_file = data_dir / "auth.json"
    auth_file.write_text(json.dumps({"users": users}, ensure_ascii=False, indent=2), encoding="utf-8")

    sf.DATA_DIR = str(data_dir)
    sf.DATA_FILE = str(data_file)
    sf.AUTH_FILE = str(auth_file)
    sf.LOG_DIR = str(log_dir)
    sf._DB_LOCK_FILE = str(data_dir / ".db.lock")
    sf._data_lock = sf._CrossProcessLock(sf._DB_LOCK_FILE)
    sf._login_attempts.clear()
    sf.app.config["TESTING"] = True

    ensure_approval_bootstrapped(sf)
    return sf.app.test_client(), data_dir


def _build_complete_routine_draft_payload(
    expected_rev: int,
    *,
    ward_room: str = "718",
    include_restricted_ck: bool = True,
) -> dict:
    """Builds a complete valid benign elective draft payload ready for routine submit."""
    ck = {
        "CK-01": {"state": "verified_ok"},
        "CK-02": {
            "state": "verified_ok",
            "subChecks": {
                "preAnesthesiaExam": "verified_ok",
                "ecg": "verified_ok",
                "chestImaging": "verified_ok",
                "echo": "not_indicated",
            },
        },
        "CK-03": {"state": "verified_ok"},
        "CK-05": {"state": "not_applicable"},
        "CK-06": {"state": "not_applicable"},
        "CK-07": {"state": "verified_ok"},
    }
    if include_restricted_ck:
        ck["CK-04"] = {"state": "verified_ok"}
        ck["CK-08"] = {"state": "verified_ok"}
    return {
        "expectedCaseRevision": expected_rev,
        "podAssignment": {"wardRoom": ward_room},
        "clinicalClassification": {
            "pathologyGroup": {"confirmedValue": "benign_anorectal"},
            "urgencyLevel": "elective",
            "procedureClass": {
                "confirmedCatalogEntryId": "MO-001",
                "confirmedClass": "PT-II",
            },
            "columnCompliance": {"declaredMode": "within_column"},
        },
        "clinicalChips": {
            "comorbidities": {"confirmed": True, "values": ["none"], "medicalTreatmentNote": None},
            "surgicalHistory": {
                "confirmed": True,
                "status": "none",
                "categories": [],
                "abdominalScarType": "not_applicable",
                "detailNote": None,
            },
            "allergyHistory": {
                "confirmed": True,
                "status": "none",
                "allergenGroups": [],
                "reactionSeverity": None,
                "allergenDetail": None,
            },
            "socialHabits": {
                "confirmed": True,
                "alcoholUse": "none",
                "smoking": {"status": "no", "packYears": None, "packYearsUnknown": False},
                "substanceAbuse": {"status": "no", "substanceNote": None},
            },
            "antithromboticPlan": {"confirmed": True, "mode": "none_confirmed"},
            "bloodAndDevices": {"confirmed": True, "values": ["basic_instruments_only"]},
            "stomaPlan": {"confirmed": True, "value": "no_stoma"},
            "contextChips": {
                "fistulaContext": {"fistulaClassification": "not_fistula"},
            },
        },
        "preopChecklist": ck,
    }


class Phase1AccountabilityAndVong2Tests(unittest.TestCase):
    """Comprehensive contract & adversarial verification suite for Phase 1 + Crosscheck Vòng 2."""

    def _hdr(self, token: str, idem: str | None = None, sim_staff_id: int | None = None) -> dict:
        h = {
            "Authorization": f"Bearer {token}",
            "X-Client-Build": "2611021947",
        }
        if idem:
            h["X-Idempotency-Key"] = idem
        if sim_staff_id is not None:
            h["X-Simulate-Staff-Id"] = str(sim_staff_id)
        return h

    def _login_token(self, client, username: str, password: str) -> dict:
        res = client.post("/api/auth/login", json={"username": username, "password": password})
        self.assertEqual(res.status_code, 200, res.get_data(as_text=True))
        return res.get_json()

    def test_01_qd1_qd2_auth_login_once_must_change_password_and_session_epoch_revocation(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            client, _ = _setup_isolated_server_env(pathlib.Path(td))

            # 1. Verify QĐ1: NO /api/auth/verify-actor endpoint exists (static fallback or 404/405, never JSON 200 token)
            reauth_res = client.post("/api/auth/verify-actor", json={"password": "AnStrong2026"})
            self.assertIn(reauth_res.status_code, (404, 405))

            # 2. Verify NO public /api/auth/staff-cards picker exists — each user logs in with their own personal account
            cards_res = client.get("/api/auth/staff-cards")
            self.assertIn(cards_res.status_code, (404, 405))

            # 3. Verify QĐ2: Login with default password == username ('ndtphu') sets mustChangePassword = True
            login_default = self._login_token(client, "ndtphu", "ndtphu")
            self.assertTrue(login_default["mustChangePassword"])
            self.assertEqual(login_default["sessionEpoch"], 1)
            tok_restricted = login_default["token"]

            # Restricted session is blocked from write endpoints (403 PASSWORD_CHANGE_REQUIRED)
            put_blocked = client.put(
                "/api/data/surgeries",
                json={"items": []},
                headers=self._hdr(tok_restricted),
            )
            self.assertEqual(put_blocked.status_code, 403)
            self.assertEqual(put_blocked.get_json().get("code"), "PASSWORD_CHANGE_REQUIRED")

            # Allowed endpoints while restricted: /api/auth/me, /api/auth/password, /api/auth/logout
            me_res = client.get("/api/auth/me", headers=self._hdr(tok_restricted))
            self.assertEqual(me_res.status_code, 200)
            self.assertTrue(me_res.get_json()["mustChangePassword"])

            # Password policy: < 10 chars rejected, missing digit rejected, == username rejected
            for bad_pw in ("Short123", "AllLettersNoDigits", "ndtphu"):
                bad_res = client.put(
                    "/api/auth/password",
                    json={"oldPassword": "ndtphu", "newPassword": bad_pw},
                    headers=self._hdr(tok_restricted),
                )
                self.assertEqual(bad_res.status_code, 400)
                self.assertEqual(bad_res.get_json().get("code"), "WEAK_PASSWORD")

            # Valid password change (>= 10 chars, letter + digit) clears mustChangePassword & bumps sessionEpoch 1 -> 2
            ok_pw = client.put(
                "/api/auth/password",
                json={"oldPassword": "ndtphu", "newPassword": "ThienPhu2026"},
                headers=self._hdr(tok_restricted),
            )
            self.assertEqual(ok_pw.status_code, 200, ok_pw.get_data(as_text=True))
            pw_body = ok_pw.get_json()
            self.assertFalse(pw_body["mustChangePassword"])
            self.assertEqual(pw_body["sessionEpoch"], 2)
            tok_fresh = pw_body["token"]

            # Old token from Device A (sessionEpoch == 1) is immediately revoked across endpoints!
            revoked_me = client.get("/api/auth/me", headers=self._hdr(tok_restricted))
            self.assertEqual(revoked_me.status_code, 401)
            self.assertEqual(revoked_me.get_json().get("code"), "SESSION_REVOKED_PASSWORD_CHANGED")

            revoked_sap = client.get("/api/surgery-approval/config", headers=self._hdr(tok_restricted))
            self.assertEqual(revoked_sap.status_code, 401)
            self.assertEqual(revoked_sap.get_json().get("code"), "SESSION_REVOKED_PASSWORD_CHANGED")

            # Fresh token (sessionEpoch == 2) works cleanly
            valid_me = client.get("/api/auth/me", headers=self._hdr(tok_fresh))
            self.assertEqual(valid_me.status_code, 200)
            self.assertEqual(valid_me.get_json()["sessionEpoch"], 2)

            logout_res = client.post("/api/auth/logout", headers=self._hdr(tok_fresh))
            self.assertEqual(logout_res.status_code, 200)

    def test_02_qd3_phase1_scope_filter_and_demo_sandbox_isolation(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            client, data_dir = _setup_isolated_server_env(pathlib.Path(td), sandbox_only=True, rollout_access="all_staff")
            tok_an = self._login_token(client, "vkan", "AnStrong2026")["token"]

            cfg = eng.DEFAULT_SURGERY_APPROVAL_CONFIG
            # In-scope cases: chuongtrinh & robot >= rollout date
            self.assertEqual(
                eng.is_in_phase1_approval_scope({"date": "2026-11-12", "surgeryType": "chuongtrinh", "approachType": "noisoi"}, cfg),
                (True, "in_scope"),
            )
            self.assertEqual(
                eng.is_in_phase1_approval_scope({"date": "2026-11-12", "surgeryType": "robot", "approachType": "robot"}, cfg),
                (True, "in_scope"),
            )

            # Out-of-scope cases: yeucau, bankhan, nsth, missing date
            for st_out, exp_reason in (
                ({"date": "2026-11-12", "surgeryType": "yeucau", "approachType": "noisoi"}, "not_in_scope"),
                ({"date": "2026-11-12", "surgeryType": "bankhan", "approachType": "mo"}, "not_in_scope"),
                ({"date": "2026-11-12", "surgeryType": "chuongtrinh", "approachType": "nsth"}, "nsth_external_authority"),
                ({"date": "", "surgeryType": "chuongtrinh", "approachType": "mo"}, "invalid_date"),
            ):
                in_sc, rsn = eng.is_in_phase1_approval_scope(st_out, cfg)
                self.assertFalse(in_sc)
                self.assertEqual(rsn, exp_reason)
                if exp_reason == "not_in_scope":
                    bm = eng.get_approval_badge_meta(st_out)
                    self.assertEqual(bm["badgeCode"], "NOT_IN_SCOPE")
                    self.assertEqual(bm["badgeLabel"], "")

            # In sandboxOnlyMode=True, creating a real patient on PUT /api/data/surgeries strips all approval badges
            put_real = client.put(
                "/api/data/surgeries",
                json={
                    "items": [
                        {
                            "id": 501,
                            "date": "2026-11-12",
                            "patientName": "Lê Thị Thật",
                            "birthYear": 1968,
                            "admissionId": "NV-REAL-501",
                            "surgeryType": "chuongtrinh",
                            "approachType": "noisoi",
                            "diagnosis": "K đại tràng Sigma",
                            "method": "Cắt đại tràng Sigma nội soi",
                            "mainSurgeon": 2,
                        }
                    ]
                },
                headers=self._hdr(tok_an),
            )
            self.assertEqual(put_real.status_code, 200, put_real.get_data(as_text=True))
            saved_db = json.loads((data_dir / "db.json").read_text(encoding="utf-8"))
            real_case = next(s for s in saved_db["surgeries"] if s["id"] == 501)
            self.assertNotIn("approval", real_case)
            self.assertTrue(real_case.get("episodeId"))

            # Attempting /draft on real patient while sandboxOnlyMode=True -> 403 SANDBOX_ONLY_MODE
            blk_real = client.post(
                "/api/surgery-approval/501/draft",
                json={"expectedCaseRevision": 1},
                headers=self._hdr(tok_an, "sbx-guard-1"),
            )
            self.assertEqual(blk_real.status_code, 403)
            self.assertEqual(blk_real.get_json().get("code"), "SANDBOX_ONLY_MODE")

            # Seed [TEST] sandbox cases -> works cleanly while real_case still has ZERO approval metadata
            seed_res = client.post("/api/surgery-approval/sandbox/seed", json={}, headers=self._hdr(tok_an, "sbx-seed-1"))
            self.assertEqual(seed_res.status_code, 200)
            saved_after_seed = json.loads((data_dir / "db.json").read_text(encoding="utf-8"))
            real_after = next(s for s in saved_after_seed["surgeries"] if s["id"] == 501)
            self.assertNotIn("approval", real_after)

            # BUG-218: Non-SuperAdmin accounts test ONLY their own role; X-Simulate-Staff-Id is strictly 403 FORBIDDEN
            sbx_case = next(s for s in saved_after_seed["surgeries"] if s.get("isTestSandboxCase") is True)
            sbx_id = sbx_case["id"]
            sbx_rev = sbx_case.get("caseRevision", 1)
            tok_quy = self._login_token(client, "ghtquy", "QuyStrong2026")["token"]
            tok_thuy = self._login_token(client, "ntnthuy", "ThuyStrong2026")["token"]

            sim_denied_draft = client.post(
                f"/api/surgery-approval/{sbx_id}/draft",
                json={"expectedCaseRevision": sbx_rev},
                headers=self._hdr(tok_quy, "non-sa-sim-1", sim_staff_id=1),
            )
            self.assertEqual(sim_denied_draft.status_code, 403)
            self.assertEqual(sim_denied_draft.get_json().get("code"), "FORBIDDEN")

            sim_denied_logs = client.get(
                "/api/surgery-approval/logs",
                headers=self._hdr(tok_quy, sim_staff_id=1),
            )
            self.assertEqual(sim_denied_logs.status_code, 403)
            self.assertEqual(sim_denied_logs.get_json().get("code"), "FORBIDDEN")

            # Read-only nursing role is blocked 403 on request-verify even when omitting "draft"
            ro_denied_rv = client.post(
                f"/api/surgery-approval/{sbx_id}/request-verify",
                json={"expectedCaseRevision": sbx_rev},
                headers=self._hdr(tok_thuy, "ro-rv-1"),
            )
            self.assertEqual(ro_denied_rv.status_code, 403)
            self.assertEqual(ro_denied_rv.get_json().get("code"), "FORBIDDEN")

            # SuperAdmin CAN simulate roles and create/revoke [TEST] sandbox delegations in Demo mode (all_staff + sandboxOnlyMode=True)
            from datetime import timedelta as _td
            now_dt = eng.now_vn()
            eff_from = (now_dt - _td(hours=1)).isoformat(timespec="seconds")
            eff_to = (now_dt + _td(hours=6)).isoformat(timespec="seconds")
            sa_del_create = client.post(
                "/api/surgery-approval/delegations",
                json={
                    "effectiveFrom": eff_from,
                    "effectiveTo": eff_to,
                    "scope": "all_departmental_surgeries",
                    "reason": "Kiểm thử ủy quyền mẫu [TEST] trong vai trò xây dựng phần mềm",
                    "isTestSandboxDelegation": True,
                },
                headers=self._hdr(tok_an, "sa-del-sbx-1", sim_staff_id=1),
            )
            self.assertEqual(sa_del_create.status_code, 200, sa_del_create.get_data(as_text=True))
            del_id = sa_del_create.get_json()["delegation"]["delegationId"]
            self.assertTrue(sa_del_create.get_json()["delegation"]["isTestSandboxDelegation"])

            sa_del_revoke = client.post(
                f"/api/surgery-approval/delegations/{del_id}/revoke",
                json={"reason": "Kết thúc kiểm thử giả lập ủy quyền"},
                headers=self._hdr(tok_an, "sa-del-sbx-rev-1", sim_staff_id=1),
            )
            self.assertEqual(sa_del_revoke.status_code, 200, sa_del_revoke.get_data(as_text=True))

    def test_03_muc2d_two_tier_multi_episode_duplicate_protection(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            client, _ = _setup_isolated_server_env(pathlib.Path(td), sandbox_only=False)
            tok_an = self._login_token(client, "vkan", "AnStrong2026")["token"]

            case_a = {
                "id": 1001,
                "date": "2026-11-12",
                "patientName": "Nguyễn Văn Minh",
                "birthYear": 1965,
                "admissionId": "NV-2026-8801",
                "surgeryType": "chuongtrinh",
                "approachType": "noisoi",
                "diagnosis": "U trực tràng giữa",
                "method": "LAR mở HMNT hồi tràng bảo vệ",
                "mainSurgeon": 2,
            }
            r1 = client.put("/api/data/surgeries", json={"items": [case_a]}, headers=self._hdr(tok_an))
            self.assertEqual(r1.status_code, 200, r1.get_data(as_text=True))
            items_1 = r1.get_json()["items"]
            ep_a = items_1[0]["episodeId"]
            self.assertTrue(ep_a)

            # Updating method on same surgery preserves episodeId without duplicate prompt
            case_a_edit = copy.deepcopy(items_1[0])
            case_a_edit["method"] = "LAR nội soi + mở HMNT hồi tràng"
            r1b = client.put("/api/data/surgeries", json={"items": [case_a_edit]}, headers=self._hdr(tok_an))
            self.assertEqual(r1b.status_code, 200)
            self.assertEqual(r1b.get_json()["items"][0]["episodeId"], ep_a)

            # Tier 1a: Same normalized admissionId ('nv 2026 8801') but DIFFERENT patient name -> 409 ADMISSION_ID_PATIENT_MISMATCH
            case_wrong_pt = {
                "id": 1002,
                "date": "2026-11-14",
                "patientName": "Trần Văn Khác",
                "birthYear": 1970,
                "admissionId": "nv 2026 8801",
                "surgeryType": "chuongtrinh",
                "approachType": "mo",
                "diagnosis": "Trĩ độ IV",
                "method": "Milligan-Morgan",
                "mainSurgeon": 2,
            }
            r_t1_mismatch = client.put(
                "/api/data/surgeries",
                json={"items": [r1b.get_json()["items"][0], case_wrong_pt]},
                headers=self._hdr(tok_an),
            )
            self.assertEqual(r_t1_mismatch.status_code, 409)
            self.assertEqual(r_t1_mismatch.get_json().get("code"), "ADMISSION_ID_PATIENT_MISMATCH")

            # Tier 1b: Same admissionId + same patient within 60 days without override -> 409 DUPLICATE_ACTIVE_ADMISSION_CASE
            case_same_adm = {
                "id": 1002,
                "date": "2026-11-18",
                "patientName": "NGUYỄN VĂN MINH",
                "birthYear": 1965,
                "admissionId": "nv-2026-8801",
                "surgeryType": "chuongtrinh",
                "approachType": "mo",
                "diagnosis": "Áp xe tồn lưu vùng chậu",
                "method": "Dẫn lưu ổ áp xe thì 2",
                "mainSurgeon": 2,
            }
            r_t1_dup = client.put(
                "/api/data/surgeries",
                json={"items": [r1b.get_json()["items"][0], case_same_adm]},
                headers=self._hdr(tok_an),
            )
            self.assertEqual(r_t1_dup.status_code, 409)
            self.assertEqual(r_t1_dup.get_json().get("code"), "DUPLICATE_ACTIVE_ADMISSION_CASE")

            # Tier 1b resolved with same_admission_multistage -> shares exact episodeId & stamps real JWT staffId=2
            case_same_adm_ov = copy.deepcopy(case_same_adm)
            case_same_adm_ov["duplicateOverride"] = {
                "resolution": "same_admission_multistage",
                "matchedWithId": 1001,
                "reasonChip": "planned_two_stage",
                "confirmedByStaffId": 999,  # spoofed client value must be overwritten
            }
            r_t1_ok = client.put(
                "/api/data/surgeries",
                json={"items": [r1b.get_json()["items"][0], case_same_adm_ov]},
                headers=self._hdr(tok_an),
            )
            self.assertEqual(r_t1_ok.status_code, 200, r_t1_ok.get_data(as_text=True))
            items_t1 = {s["id"]: s for s in r_t1_ok.get_json()["items"]}
            self.assertEqual(items_t1[1002]["episodeId"], ep_a)
            self.assertEqual(items_t1[1002]["duplicateOverride"]["confirmedByStaffId"], 2)

            # Tier 2: Different admissionId, same normalized patientName + birthYear 90 days later (stoma closure!)
            case_stoma = {
                "id": 1003,
                "date": "2027-02-10",
                "patientName": "Nguyen Van Minh",
                "birthYear": 1965,
                "admissionId": "NV-2027-0199",
                "surgeryType": "chuongtrinh",
                "approachType": "mo",
                "diagnosis": "Hậu môn nhân tạo hồi tràng sau LAR",
                "method": "Đóng hậu môn nhân tạo hồi tràng",
                "mainSurgeon": 2,
            }
            r_t2_prompt = client.put(
                "/api/data/surgeries",
                json={"items": list(items_t1.values()) + [case_stoma]},
                headers=self._hdr(tok_an),
            )
            self.assertEqual(r_t2_prompt.status_code, 409)
            self.assertEqual(r_t2_prompt.get_json().get("code"), "POTENTIAL_DUPLICATE_CONFIRM_REQUIRED")

            # Resolve Tier 2 as new_episode_same_patient -> mints NEW episodeId & sets priorEpisodeId = ep_a
            case_stoma_ov = copy.deepcopy(case_stoma)
            case_stoma_ov["duplicateOverride"] = {
                "resolution": "new_episode_same_patient",
                "matchedWithId": 1001,
                "reasonChip": "stoma_closure_reversal",
            }
            r_t2_ok = client.put(
                "/api/data/surgeries",
                json={"items": list(items_t1.values()) + [case_stoma_ov]},
                headers=self._hdr(tok_an),
            )
            self.assertEqual(r_t2_ok.status_code, 200, r_t2_ok.get_data(as_text=True))
            items_t2 = {s["id"]: s for s in r_t2_ok.get_json()["items"]}
            self.assertNotEqual(items_t2[1003]["episodeId"], ep_a)
            self.assertEqual(items_t2[1003]["priorEpisodeId"], ep_a)

            # [TEST] sandbox case with identical name + birthYear NEVER collides with real patient partition
            sbx_same_name = {
                "id": 9901,
                "date": "2026-11-12",
                "patientName": "[TEST] Nguyễn Văn Minh",
                "birthYear": 1965,
                "isTestSandboxCase": True,
                "surgeryType": "chuongtrinh",
                "approachType": "mo",
                "diagnosis": "Trĩ",
                "method": "Milligan-Morgan",
                "mainSurgeon": 2,
            }
            r_sbx_iso = client.put(
                "/api/data/surgeries",
                json={"items": list(items_t2.values()) + [sbx_same_name]},
                headers=self._hdr(tok_an),
            )
            self.assertEqual(r_sbx_iso.status_code, 200)

    def test_04_muc3a_custom_procedure_outside_dm309_proposed_vs_verified(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            client, _ = _setup_isolated_server_env(pathlib.Path(td), sandbox_only=False)
            tok_quy = self._login_token(client, "ghtquy", "QuyStrong2026")["token"]  # StaffId=8, Column II
            tok_huu = self._login_token(client, "nphuu", "HuuStrong2026")["token"]   # StaffId=1, Chief

            # Create scheduled elective case for BS Quy (Column II)
            put_res = client.put(
                "/api/data/surgeries",
                json={
                    "items": [
                        {
                            "id": 2001,
                            "date": "2026-11-16",
                            "patientName": "Phạm Thị Kỹ Thuật Mới",
                            "birthYear": 1974,
                            "surgeryType": "chuongtrinh",
                            "approachType": "noisoi",
                            "diagnosis": "Sa sàn chậu phức tạp tái phát",
                            "method": "Treo sàn chậu phối hợp vạt cân tự thân ngoài DM 309",
                            "mainSurgeon": 8,
                        }
                    ]
                },
                headers=self._hdr(tok_quy),
            )
            self.assertEqual(put_res.status_code, 200)
            c0 = put_res.get_json()["items"][0]

            draft_body = _build_complete_routine_draft_payload(c0["caseRevision"], ward_room="705")
            draft_body["clinicalClassification"]["procedureClass"] = {
                "isCustomOutsideCatalog": True,
                "confirmedCatalogEntryId": "CUSTOM_OUTSIDE_DM309",
                "customProcedureName": "Treo sàn chậu phối hợp vạt cân tự thân ngoài DM 309",
                "customReasonChip": "combined_multi_procedure",
                "proposedClass": "PT-II",
                "verifiedClass": "PT-III",  # forged client field -> must be stripped!
            }
            d_res = client.post("/api/surgery-approval/2001/draft", json=draft_body, headers=self._hdr(tok_quy, "cust-d1"))
            self.assertEqual(d_res.status_code, 200, d_res.get_data(as_text=True))
            s_draft = d_res.get_json()["surgery"]
            pc = s_draft["clinicalClassification"]["procedureClass"]
            self.assertIsNone(pc.get("verifiedClass"))
            self.assertEqual(pc.get("proposedClass"), "PT-II")
            self.assertEqual(
                s_draft["clinicalClassification"]["columnCompliance"]["systemCheck"],
                "custom_pending_bcn_verification",
            )

            # BS Quy submits -> allowed into BCN queue (200)
            sub_res = client.post(
                "/api/surgery-approval/2001/submit",
                json={"expectedCaseRevision": s_draft["caseRevision"]},
                headers=self._hdr(tok_quy, "cust-sub1"),
            )
            self.assertEqual(sub_res.status_code, 200, sub_res.get_data(as_text=True))
            s_sub = sub_res.get_json()["surgery"]

            # Chief attempts /approve BEFORE verifying custom procedure class -> 422 CUSTOM_PROCEDURE_VERIFICATION_REQUIRED
            app_premature = client.post(
                "/api/surgery-approval/2001/approve",
                json={"expectedCaseRevision": s_sub["caseRevision"]},
                headers=self._hdr(tok_huu, "cust-app-block"),
            )
            self.assertEqual(app_premature.status_code, 422)
            self.assertEqual(app_premature.get_json().get("code"), "CUSTOM_PROCEDURE_VERIFICATION_REQUIRED")

            # Chief verifies as PT-ĐB -> exceeds BS Quy's Column II -> /approve blocked with 422 OVER_COLUMN_FORBIDDEN_FOR_ELECTIVE
            ver_db = client.post(
                "/api/surgery-approval/2001/verify-procedure-class",
                json={
                    "expectedCaseRevision": s_sub["caseRevision"],
                    "verifiedClass": "PT-ĐB",
                    "verifiedBasisCode": "equivalent_dm309_complexity",
                },
                headers=self._hdr(tok_huu, "cust-ver-db"),
            )
            self.assertEqual(ver_db.status_code, 200)
            s_ver_db = ver_db.get_json()["surgery"]
            self.assertEqual(s_ver_db["clinicalClassification"]["columnCompliance"]["systemCheck"], "over_column")

            app_over = client.post(
                "/api/surgery-approval/2001/approve",
                json={"expectedCaseRevision": s_ver_db["caseRevision"]},
                headers=self._hdr(tok_huu, "cust-app-over"),
            )
            self.assertEqual(app_over.status_code, 422)
            self.assertEqual(app_over.get_json().get("code"), "OVER_COLUMN_FORBIDDEN_FOR_ELECTIVE")

            # Chief re-verifies as PT-II -> within Column II -> /approve succeeds with green tick!
            ver_ok = client.post(
                "/api/surgery-approval/2001/verify-procedure-class",
                json={
                    "expectedCaseRevision": s_ver_db["caseRevision"],
                    "verifiedClass": "PT-II",
                    "verifiedBasisCode": "hospital_technical_council",
                },
                headers=self._hdr(tok_huu, "cust-ver-ok"),
            )
            self.assertEqual(ver_ok.status_code, 200)
            s_ver_ok = ver_ok.get_json()["surgery"]

            app_ok = client.post(
                "/api/surgery-approval/2001/approve",
                json={"expectedCaseRevision": s_ver_ok["caseRevision"]},
                headers=self._hdr(tok_huu, "cust-app-ok"),
            )
            self.assertEqual(app_ok.status_code, 200, app_ok.get_data(as_text=True))
            self.assertEqual(app_ok.get_json()["surgery"]["approval"]["status"], "approved")
            self.assertTrue(eng.is_approval_green_tick_valid(app_ok.get_json()["surgery"]))

    def test_05_muc3b_3c_tnm_18_vignettes_site_lock_ctnm_vs_yctnm_and_signoff_gate(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            client, _ = _setup_isolated_server_env(pathlib.Path(td))
            tok_an = self._login_token(client, "vkan", "AnStrong2026")["token"]

            # 1. Default config has enableAutoStageDerivation=False -> pending_clinical_signoff_gate
            default_eval = eng.evaluate_tnm_assessment(
                {
                    "tumorLocation": ["mid_rectum"],
                    "preopHistology": "adenocarcinoma",
                    "multimodalStatus": "upfront_surgery",
                    "baselineClinicalStage": {"T": "T3", "N": "N1b", "M": "M0"},
                },
                config=eng.DEFAULT_SURGERY_APPROVAL_CONFIG,
            )
            self.assertEqual(default_eval["status"], "pending_clinical_signoff_gate")
            self.assertEqual(default_eval["ruleSetId"], "AJCC_8_CH20_COLORECTAL")

            # Cannot flip enableAutoStageDerivation=True via API without specialist sign-off metadata
            bad_cfg_res = client.put(
                "/api/surgery-approval/config",
                json={"enableAutoStageDerivation": True},
                headers=self._hdr(tok_an, "cfg-tnm-bad"),
            )
            self.assertEqual(bad_cfg_res.status_code, 422)
            self.assertEqual(bad_cfg_res.get_json().get("code"), "CLINICAL_STAGING_SIGNOFF_REQUIRED")

            # Enabling with full specialist sign-off succeeds
            ok_cfg_res = client.put(
                "/api/surgery-approval/config",
                json={
                    "approvedRuleSetIds": ["AJCC_8_CH20_COLORECTAL", "AJCC_V9_2023_ANUS"],
                    "signedVignetteDigest": "sha256:18-vignettes-v2-verified",
                    "clinicalStagingApprovedBy": 1,
                    "enableAutoStageDerivation": True,
                },
                headers=self._hdr(tok_an, "cfg-tnm-ok"),
            )
            self.assertEqual(ok_cfg_res.status_code, 200, ok_cfg_res.get_data(as_text=True))
            signed_cfg = ok_cfg_res.get_json()["config"]

            # 2. Empty multimodalStatus never assumes upfront cTNM
            unconf = eng.evaluate_tnm_assessment(
                {
                    "tumorLocation": ["sigmoid"],
                    "preopHistology": "adenocarcinoma",
                    "multimodalStatus": "",
                    "baselineClinicalStage": {"T": "T3", "N": "N0", "M": "M0"},
                },
                config=signed_cfg,
            )
            self.assertEqual(unconf["status"], "treatment_status_unconfirmed")
            self.assertIsNone(unconf["prefix"])

            # 3. 18 Canonical Clinical Vignettes across Colorectal AJCC 8 Ch.20 & Anal Canal SCC AJCC v9 (2023)
            vignettes = [
                # Colorectal Adenocarcinoma (AJCC_8_CH20_COLORECTAL) — 10 vignettes
                (["sigmoid"], "adenocarcinoma", "Tis", "N0", "M0", "AJCC_8_CH20_COLORECTAL", "Giai đoạn 0"),
                (["ascending_colon"], "adenocarcinoma", "T2", "N0", "M0", "AJCC_8_CH20_COLORECTAL", "Giai đoạn I"),
                (["high_rectum"], "adenocarcinoma", "T3", "N0", "M0", "AJCC_8_CH20_COLORECTAL", "Giai đoạn IIA"),
                (["sigmoid"], "adenocarcinoma", "T4a", "N0", "M0", "AJCC_8_CH20_COLORECTAL", "Giai đoạn IIB"),
                (["low_rectum"], "adenocarcinoma", "T4b", "N0", "M0", "AJCC_8_CH20_COLORECTAL", "Giai đoạn IIC"),
                (["mid_rectum"], "adenocarcinoma", "T1", "N2a", "M0", "AJCC_8_CH20_COLORECTAL", "Giai đoạn IIIA"),
                (["mid_rectum"], "adenocarcinoma", "T3", "N1b", "M0", "AJCC_8_CH20_COLORECTAL", "Giai đoạn IIIB"),
                (["low_rectum"], "mucinous_signet", "T4a", "N2a", "M0", "AJCC_8_CH20_COLORECTAL", "Giai đoạn IIIC"),
                (["sigmoid"], "adenocarcinoma", "T3", "N1a", "M1a", "AJCC_8_CH20_COLORECTAL", "Giai đoạn IVA"),
                (["cecum"], "adenocarcinoma", "T4a", "N2b", "M1c", "AJCC_8_CH20_COLORECTAL", "Giai đoạn IVC"),
                # Coarse T3N2M0 without N2a/N2b -> must NOT guess IIIB vs IIIC!
                (["mid_rectum"], "adenocarcinoma", "T3", "N2", "M0", "AJCC_8_CH20_COLORECTAL", "Giai đoạn chưa xác định"),
                # Anal Canal SCC (AJCC_V9_2023_ANUS) — 7 vignettes (incl. v9 downstaging T3N0 & T3N1a -> IIIA, Tis exclusion)
                (["anal_canal"], "scc", "Tis", "N0", "M0", "AJCC_V9_2023_ANUS", "Không phân giai đoạn carcinôm xâm lấn (HSIL / AIN II–III đã loại khỏi Stage 0 trong AJCC Version 9)"),
                (["anal_canal"], "scc", "T1", "N0", "M0", "AJCC_V9_2023_ANUS", "Giai đoạn I"),
                (["anal_canal"], "scc", "T2", "N0", "M0", "AJCC_V9_2023_ANUS", "Giai đoạn IIA"),
                (["anal_canal"], "scc", "T2", "N1a", "M0", "AJCC_V9_2023_ANUS", "Giai đoạn IIB"),
                (["anal_canal"], "scc", "T3", "N0", "M0", "AJCC_V9_2023_ANUS", "Giai đoạn IIIA"),
                (["anal_canal"], "scc", "T3", "N1a", "M0", "AJCC_V9_2023_ANUS", "Giai đoạn IIIA"),
                (["anal_canal"], "scc", "T4", "N1a", "M0", "AJCC_V9_2023_ANUS", "Giai đoạn IIIC"),
            ]
            self.assertEqual(len(vignettes), 18)
            for locs, hist, t_v, n_v, m_v, exp_rule, exp_stage in vignettes:
                ev = eng.evaluate_tnm_assessment(
                    {
                        "tumorLocation": locs,
                        "preopHistology": hist,
                        "multimodalStatus": "upfront_surgery",
                        "baselineClinicalStage": {"T": t_v, "N": n_v, "M": m_v},
                    },
                    config=signed_cfg,
                )
                self.assertEqual(ev["ruleSetId"], exp_rule)
                self.assertEqual(ev["stageGroup"], exp_stage)

            # 4. Discordant multi-site (anal_canal + low_rectum + scc without primaryIndexSite) & Special Histology
            disc = eng.evaluate_tnm_assessment(
                {
                    "tumorLocation": ["low_rectum", "anal_canal"],
                    "preopHistology": "scc",
                    "multimodalStatus": "upfront_surgery",
                    "baselineClinicalStage": {"T": "T3", "N": "N0", "M": "M0"},
                },
                config=signed_cfg,
            )
            self.assertEqual(disc["status"], "multi_site_discordant_staging")
            self.assertIsNone(disc["ruleSetId"])

            spec_h = eng.evaluate_tnm_assessment(
                {
                    "tumorLocation": ["mid_rectum"],
                    "preopHistology": "neuroendocrine_gist_other",
                    "multimodalStatus": "upfront_surgery",
                    "baselineClinicalStage": {"T": "T2", "N": "N0", "M": "M0"},
                },
                config=signed_cfg,
            )
            self.assertEqual(spec_h["ruleSetId"], "SPECIAL_HISTOLOGY_NO_AUTO_MERGE")

            # 5. Switching to TNT preserves baseline cTNM while evaluating restaging ycTNM + separate CRM/EMVI
            yc_eval = eng.evaluate_tnm_assessment(
                {
                    "tumorLocation": ["low_rectum"],
                    "preopHistology": "adenocarcinoma",
                    "multimodalStatus": "tnt_completed",
                    "baselineClinicalStage": {"T": "T3", "N": "N1b", "M": "M0"},
                    "restagingPostNeoadjuvant": {"T": "T2", "N": "N0", "M": "M0"},
                    "crmStatus": "threatened_positive",
                    "emviStatus": "positive",
                },
                config=signed_cfg,
            )
            self.assertEqual(yc_eval["prefix"], "yc")
            self.assertEqual(yc_eval["formulaDisplay"], "ycT2 · ycN0 · ycM0")
            self.assertEqual(yc_eval["stageGroup"], "Giai đoạn I")
            self.assertEqual(yc_eval["baselinePreserved"], {"T": "T3", "N": "N1b", "M": "M0"})
            self.assertEqual(len(yc_eval["separateLocalRiskIndicators"]), 2)

    def test_06_v2_g1_dual_journal_crash_recovery_and_double_replay_idempotency(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            client, data_dir = _setup_isolated_server_env(pathlib.Path(td), sandbox_only=False)
            tok_an = self._login_token(client, "vkan", "AnStrong2026")["token"]
            tok_quy = self._login_token(client, "ghtquy", "QuyStrong2026")["token"]
            tok_phu_pw = client.put(
                "/api/auth/password",
                json={"oldPassword": "ndtphu", "newPassword": "ThienPhu2026"},
                headers=self._hdr(self._login_token(client, "ndtphu", "ndtphu")["token"]),
            ).get_json()["token"]

            put_res = client.put(
                "/api/data/surgeries",
                json={
                    "items": [
                        {
                            "id": 3001,
                            "date": "2026-11-18",
                            "patientName": "Trần Văn Phục Hồi Nhật Ký",
                            "birthYear": 1962,
                            "surgeryType": "chuongtrinh",
                            "approachType": "mo",
                            "diagnosis": "Trĩ hỗn hợp độ IV",
                            "method": "Phẫu thuật Milligan-Morgan",
                            "mainSurgeon": 2,
                        }
                    ]
                },
                headers=self._hdr(tok_an),
            )
            self.assertEqual(put_res.status_code, 200)
            rev0 = put_res.get_json()["items"][0]["caseRevision"]

            # Snapshot pre-S1 state of db.json and surgery_attribution.jsonl
            db_before_tx = json.loads((data_dir / "db.json").read_text(encoding="utf-8"))
            attr_path = pathlib.Path(eng.get_attribution_journal_path(str(data_dir)))
            app_path = pathlib.Path(eng.get_journal_path(str(data_dir)))
            attr_bytes_before = attr_path.read_bytes() if attr_path.exists() else b""

            # Perform multi-doctor operations: Trainee draft -> BS Quy draft -> BS An submit
            r_tr = client.post(
                "/api/surgery-approval/3001/draft",
                json={
                    "expectedCaseRevision": rev0,
                    "podAssignment": {"wardRoom": "718"},
                    "clinicalChips": {
                        "socialHabits": {
                            "confirmed": True,
                            "alcoholUse": "occasional",
                            "smoking": {"status": "no", "packYears": None, "packYearsUnknown": False},
                            "substanceAbuse": {"status": "no", "substanceNote": None},
                        }
                    },
                },
                headers=self._hdr(tok_phu_pw, "g1-tr"),
            )
            self.assertEqual(r_tr.status_code, 200)
            rev1 = r_tr.get_json()["surgery"]["caseRevision"]

            r_quy = client.post(
                "/api/surgery-approval/3001/draft",
                json=_build_complete_routine_draft_payload(rev1, ward_room="718", include_restricted_ck=False),
                headers=self._hdr(tok_quy, "g1-quy"),
            )
            self.assertEqual(r_quy.status_code, 200)
            rev2 = r_quy.get_json()["surgery"]["caseRevision"]

            r_an_sub = client.post(
                "/api/surgery-approval/3001/draft",
                json={"expectedCaseRevision": rev2, "preopChecklist": {"CK-04": {"state": "verified_ok"}, "CK-08": {"state": "verified_ok"}}},
                headers=self._hdr(tok_an, "g1-an-ck"),
            )
            self.assertEqual(r_an_sub.status_code, 200)
            rev3 = r_an_sub.get_json()["surgery"]["caseRevision"]

            r_sub = client.post(
                "/api/surgery-approval/3001/submit",
                json={"expectedCaseRevision": rev3},
                headers=self._hdr(tok_an, "g1-sub"),
            )
            self.assertEqual(r_sub.status_code, 200, r_sub.get_data(as_text=True))

            # Verify zero attributionEvents[] bloat in db.json while preparationContributors[] has all 3 doctors
            golden_db = json.loads((data_dir / "db.json").read_text(encoding="utf-8"))
            golden_case = next(s for s in golden_db["surgeries"] if s["id"] == 3001)
            self.assertNotIn("attributionEvents", golden_case)
            contrib_ids = [c["staffId"] for c in golden_case["preparationContributors"]]
            self.assertEqual(contrib_ids, [45, 8, 2])
            golden_attr_lines = attr_path.read_text(encoding="utf-8").splitlines()
            golden_app_lines = app_path.read_text(encoding="utf-8").splitlines()

            # ── CRASH POINT A: Process dies right AFTER S1 (approval log written, attribution log & db.json NOT updated) ──
            if attr_bytes_before:
                attr_path.write_bytes(attr_bytes_before)
            else:
                attr_path.unlink(missing_ok=True)
            db_crash_a = copy.deepcopy(db_before_tx)
            rep_a1 = eng.reconcile_dual_journals_and_db(db_crash_a, str(data_dir))
            self.assertGreaterEqual(rep_a1["replayedEvents"], 4)
            self.assertGreaterEqual(rep_a1["replayedAttributionEvents"], 4)
            snap_after_replay1 = copy.deepcopy(db_crash_a)
            attr_lines_after_r1 = attr_path.read_text(encoding="utf-8").splitlines()

            # Replay #2 immediately on already-recovered state -> MUST be 100% idempotent!
            rep_a2 = eng.reconcile_dual_journals_and_db(db_crash_a, str(data_dir))
            self.assertEqual(rep_a2["replayedEvents"], 0)
            self.assertEqual(rep_a2["replayedAttributionEvents"], 0)
            self.assertEqual(db_crash_a, snap_after_replay1)
            self.assertEqual(attr_path.read_text(encoding="utf-8").splitlines(), attr_lines_after_r1)
            self.assertEqual(len(attr_lines_after_r1), len(golden_attr_lines))
            self.assertEqual(len(app_path.read_text(encoding="utf-8").splitlines()), len(golden_app_lines))

            rec_case_a = next(s for s in db_crash_a["surgeries"] if s["id"] == 3001)
            self.assertEqual(rec_case_a["caseRevision"], golden_case["caseRevision"])
            self.assertEqual(rec_case_a["approval"]["status"], "submitted")
            self.assertEqual([c["staffId"] for c in rec_case_a["preparationContributors"]], [45, 8, 2])
            self.assertEqual(rec_case_a["lastAttributionSeq"], golden_case["lastAttributionSeq"])

            # ── CRASH POINT B: Process dies AFTER S2 (both journals intact, db.json stale) ──
            db_crash_b = copy.deepcopy(db_before_tx)
            rep_b1 = eng.reconcile_dual_journals_and_db(db_crash_b, str(data_dir))
            self.assertGreaterEqual(rep_b1["replayedEvents"], 4)
            self.assertEqual(rep_b1["replayedAttributionEvents"], 0)
            snap_b1 = copy.deepcopy(db_crash_b)
            rep_b2 = eng.reconcile_dual_journals_and_db(db_crash_b, str(data_dir))
            self.assertEqual(db_crash_b, snap_b1)

            # ── FAIL-CLOSED GUARD: db.json ahead of journal -> 503 AUDIT_JOURNAL_BEHIND_DB ──
            ahead_db = copy.deepcopy(db_crash_b)
            ahead_db["surgeries"][0]["lastJournalSeq"] = 999999
            with self.assertRaises(eng.ApprovalEngineError) as cm_ahead:
                eng.reconcile_dual_journals_and_db(ahead_db, str(data_dir))
            self.assertEqual(cm_ahead.exception.status_code, 503)
            self.assertEqual(cm_ahead.exception.code, "AUDIT_JOURNAL_BEHIND_DB")

    def test_07_v2_g2_oversize_64kib_record_torn_tail_two_rotations_same_quarter_and_host_b_restore(self) -> None:
        with tempfile.TemporaryDirectory() as td, tempfile.TemporaryDirectory() as td_host_b:
            client, data_dir = _setup_isolated_server_env(pathlib.Path(td), sandbox_only=False)
            tok_an = self._login_token(client, "vkan", "AnStrong2026")["token"]
            tok_huu = self._login_token(client, "nphuu", "HuuStrong2026")["token"]

            put_res = client.put(
                "/api/data/surgeries",
                json={
                    "items": [
                        {
                            "id": 4001,
                            "date": "2026-11-20",
                            "patientName": "Lê Văn Dòng Dài 80KiB",
                            "birthYear": 1959,
                            "surgeryType": "chuongtrinh",
                            "approachType": "mo",
                            "diagnosis": "Trĩ vòng độ IV",
                            "method": "Phẫu thuật Longo",
                            "mainSurgeon": 2,
                        }
                    ]
                },
                headers=self._hdr(tok_an),
            )
            self.assertEqual(put_res.status_code, 200)
            c0 = put_res.get_json()["items"][0]

            # 1. Append a valid > 75 KiB journal entry via append_dual_wal_transaction and verify adaptive reader
            db_live = json.loads((data_dir / "db.json").read_text(encoding="utf-8"))
            huge_blob = "X" * 76000
            big_entry, _ = eng.append_dual_wal_transaction(
                str(data_dir),
                db_live,
                action="oversize_record_test",
                actor={"staffId": 2, "username": "vkan", "name": "Vũ Khương An", "title": "BSCKII."},
                surgery_id=4001,
                case_rev_before=c0["caseRevision"],
                case_rev_after=c0["caseRevision"],
                summary={"hugePadding": huge_blob},
                committed_state_patch={"patchKind": "surgery_field_delta", "changedFields": {}},
                attribution_specs=[{"actionType": "oversize_attr_test", "touchedSections": ["notes"], "extra": huge_blob}],
            )
            (data_dir / "db.json").write_text(json.dumps(db_live, ensure_ascii=False), encoding="utf-8")

            j_path = eng.get_journal_path(str(data_dir))
            self.assertGreater(os.path.getsize(j_path), 76000)

            # Adaptive reader reads > 64 KiB record cleanly without truncation!
            last_rec, was_trunc = eng.read_last_valid_jsonl_record_adaptive(j_path, initial_window=65536, truncate_torn=True)
            self.assertFalse(was_trunc)
            self.assertEqual(last_rec["eventSeq"], big_entry["eventSeq"])

            # Append a torn partial UTF-8 line at EOF -> adaptive reader truncates ONLY the torn tail
            size_before_torn = os.path.getsize(j_path)
            with open(j_path, "ab") as bf:
                bf.write('{"eventSeq": 9999, "broken": "dòng ghi dở giữa chừ'.encode("utf-8")[:-1])
            rec_after_torn, trunc_flag = eng.read_last_valid_jsonl_record_adaptive(j_path, initial_window=65536, truncate_torn=True)
            self.assertTrue(trunc_flag)
            self.assertEqual(rec_after_torn["eventSeq"], big_entry["eventSeq"])
            self.assertEqual(os.path.getsize(j_path), size_before_torn)

            # 2. Rotate #1 in 2026-Q4
            rot1_app = eng.rotate_journal_stream(str(data_dir), "approval", quarter_override="2026-Q4")
            rot1_attr = eng.rotate_journal_stream(str(data_dir), "attribution", quarter_override="2026-Q4")
            self.assertTrue(rot1_app["rotated"])
            self.assertTrue(rot1_attr["rotated"])

            # Complete draft + submit + approve to generate new events, then Rotate #2 in SAME quarter 2026-Q4!
            db_curr = json.loads((data_dir / "db.json").read_text(encoding="utf-8"))
            s_curr = next(s for s in db_curr["surgeries"] if s["id"] == 4001)
            d_res = client.post(
                "/api/surgery-approval/4001/draft",
                json=_build_complete_routine_draft_payload(s_curr["caseRevision"]),
                headers=self._hdr(tok_an, "g2-d1"),
            )
            self.assertEqual(d_res.status_code, 200, d_res.get_data(as_text=True))
            sub_res = client.post(
                "/api/surgery-approval/4001/submit",
                json={"expectedCaseRevision": d_res.get_json()["surgery"]["caseRevision"]},
                headers=self._hdr(tok_an, "g2-sub1"),
            )
            self.assertEqual(sub_res.status_code, 200)
            app_res = client.post(
                "/api/surgery-approval/4001/approve",
                json={"expectedCaseRevision": sub_res.get_json()["surgery"]["caseRevision"]},
                headers=self._hdr(tok_huu, "g2-app1"),
            )
            self.assertEqual(app_res.status_code, 200)
            stale_approved_db_snapshot = json.loads((data_dir / "db.json").read_text(encoding="utf-8"))

            rot2_app = eng.rotate_journal_stream(str(data_dir), "approval", quarter_override="2026-Q4")
            rot2_attr = eng.rotate_journal_stream(str(data_dir), "attribution", quarter_override="2026-Q4")
            self.assertTrue(rot2_app["rotated"])
            self.assertTrue(rot2_attr["rotated"])
            self.assertNotEqual(rot1_app["segmentFile"], rot2_app["segmentFile"])

            # Add one more post-approval edit in hot .jsonl so Case 4001 has higher seq in hot journal than stale_approved_db_snapshot
            post_edit = client.post(
                "/api/surgery-approval/4001/draft",
                json={
                    "expectedCaseRevision": app_res.get_json()["surgery"]["caseRevision"],
                    "clinicalChips": {"stomaPlan": {"confirmed": True, "value": "protective_temp_stoma_risk", "stomaNote": "Dự phòng"}},
                },
                headers=self._hdr(tok_an, "g2-post-edit"),
            )
            self.assertEqual(post_edit.status_code, 200)

            # Reverse pagination traverses across hot .jsonl + BOTH 2026-Q4 .jsonl.gz segments seamlessly!
            p1 = client.get("/api/surgery-approval/logs?limit=2&verifyChain=1", headers=self._hdr(tok_huu)).get_json()
            self.assertTrue(p1["chainValid"])
            self.assertTrue(p1["hasMore"])
            p2 = client.get(f"/api/surgery-approval/logs?limit=50&beforeSeq={p1['nextBeforeSeq']}", headers=self._hdr(tok_huu)).get_json()
            all_seqs = [e["eventSeq"] for e in (p1["entries"] + p2["entries"])]
            self.assertIn(1, all_seqs)

            attr_page = client.get("/api/surgery-approval/4001/attribution?limit=50", headers=self._hdr(tok_an)).get_json()
            self.assertGreaterEqual(len(attr_page["events"]), 3)

            # 3. Simulate Host-B Disaster Restore from off-host archive + hot journal + older db snapshot
            src_archive = pathlib.Path(eng.get_archive_dir(str(data_dir)))
            src_hot_app = pathlib.Path(eng.get_journal_path(str(data_dir))).read_bytes()
            src_hot_attr = pathlib.Path(eng.get_attribution_journal_path(str(data_dir))).read_bytes()
            src_cp = pathlib.Path(eng.get_checkpoint_path(str(data_dir))).read_bytes()
            archived_files = list(src_archive.iterdir())

            client_b, data_dir_b = _setup_isolated_server_env(pathlib.Path(td_host_b), sandbox_only=False)
            tok_an_b = self._login_token(client_b, "vkan", "AnStrong2026")["token"]
            dst_archive = pathlib.Path(eng.get_archive_dir(str(data_dir_b)))
            dst_archive.mkdir(parents=True, exist_ok=True)
            for af in archived_files:
                shutil.copy2(af, dst_archive / af.name)
            pathlib.Path(eng.get_journal_path(str(data_dir_b))).write_bytes(src_hot_app)
            pathlib.Path(eng.get_attribution_journal_path(str(data_dir_b))).write_bytes(src_hot_attr)
            pathlib.Path(eng.get_checkpoint_path(str(data_dir_b))).write_bytes(src_cp)

            dr_res = client_b.post(
                "/api/admin/disaster-restore",
                json={
                    "confirmPhrase": "RESTORE_PTDTT_DB",
                    "reason": "Kiểm thử phục hồi kho lưu trữ trên Host B",
                    "database": stale_approved_db_snapshot,
                },
                headers=self._hdr(tok_an_b, "g2-hostb-dr"),
            )
            self.assertEqual(dr_res.status_code, 200, dr_res.get_data(as_text=True))
            dr_body = dr_res.get_json()
            self.assertEqual(dr_body["verifiedArchiveSegments"], 2)
            self.assertIn(4001, dr_body["downgradedStaleApprovalIds"])

            # Verify scripts/backup.sh includes closed journal_archive .jsonl.gz + .sha256 sync
            backup_sh = (REPO_ROOT / "scripts" / "backup.sh").read_text(encoding="utf-8")
            self.assertIn("journal_archive", backup_sh)
            self.assertIn(".jsonl.gz", backup_sh)

    def test_08_stale_reverify_proxy_submit_bcn_self_approval_and_ca9021_dual_kpis(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            client, data_dir = _setup_isolated_server_env(pathlib.Path(td), sandbox_only=False)
            tok_huu = self._login_token(client, "nphuu", "HuuStrong2026")["token"]   # id=1 Chief
            tok_an = self._login_token(client, "vkan", "AnStrong2026")["token"]     # id=2 Deputy
            tok_tuan = self._login_token(client, "vnatu", "TuanStrong2026")["token"]  # id=4 POD 3 Room 708
            tok_phu7 = self._login_token(client, "pvphu", "PhuStrong2026")["token"]   # id=7 POD 3 Room 710
            tok_quy = self._login_token(client, "ghtquy", "QuyStrong2026")["token"]   # id=8 Assist1
            tok_duc = self._login_token(client, "thmduc", "DucStrong2026")["token"]   # id=9 POD 1 (unrelated)
            tok_nt = client.put(
                "/api/auth/password",
                json={"oldPassword": "ndtphu", "newPassword": "ThienPhu2026"},
                headers=self._hdr(self._login_token(client, "ndtphu", "ndtphu")["token"]),
            ).get_json()["token"]  # id=45 Trainee

            # ── A. Stale Re-verification + Proxy-Submit Policy (Case #5001: mainSurgeon=4, assistSurgeon1=8, Room 708 POD 3) ──
            put_5001 = client.put(
                "/api/data/surgeries",
                json={
                    "items": [
                        {
                            "id": 5001,
                            "date": "2026-11-22",
                            "patientName": "Hoàng Văn Trình Thay",
                            "birthYear": 1971,
                            "surgeryType": "chuongtrinh",
                            "approachType": "mo",
                            "diagnosis": "Trĩ độ IV",
                            "method": "Milligan-Morgan",
                            "mainSurgeon": 4,
                            "assistSurgeon1": 8,
                        },
                        {
                            "id": 9021,
                            "date": "2026-11-28",
                            "patientName": "Đặng Thị Dời Lịch Qua Tháng",
                            "birthYear": 1966,
                            "surgeryType": "chuongtrinh",
                            "approachType": "mo",
                            "diagnosis": "Rò hậu môn phức tạp",
                            "method": "Cắt đường rò hậu môn",
                            "mainSurgeon": 1,
                        },
                    ]
                },
                headers=self._hdr(tok_tuan),
            )
            self.assertEqual(put_5001.status_code, 200)
            c5001 = next(s for s in put_5001.get_json()["items"] if s["id"] == 5001)

            # BS Tuấn (id=4) fills & verifies CK-01..CK-08
            d1 = client.post(
                "/api/surgery-approval/5001/draft",
                json=_build_complete_routine_draft_payload(c5001["caseRevision"], ward_room="708"),
                headers=self._hdr(tok_tuan, "s5001-d1"),
            ).get_json()["surgery"]

            # Trainee (id=45) later changes allergyHistory -> invalidates CK-03 with needsReverify=True!
            d2 = client.post(
                "/api/surgery-approval/5001/draft",
                json={
                    "expectedCaseRevision": d1["caseRevision"],
                    "clinicalChips": {
                        "allergyHistory": {
                            "confirmed": True,
                            "status": "present",
                            "allergenGroups": ["food"],
                            "reactionSeverity": "mild_moderate",
                            "allergenDetail": "Hải sản (nổi mề đay nhẹ)",
                        }
                    },
                },
                headers=self._hdr(tok_nt, "s5001-nt-edit"),
            ).get_json()["surgery"]
            self.assertTrue(d2["preopChecklist"]["CK-03"].get("needsReverify"))

            # Submitting while CK-03 needsReverify == True -> blocked 422!
            sub_stale = client.post(
                "/api/surgery-approval/5001/submit",
                json={"expectedCaseRevision": d2["caseRevision"]},
                headers=self._hdr(tok_tuan, "s5001-sub-stale"),
            )
            self.assertEqual(sub_stale.status_code, 422)

            # Re-verify CK-03 as attending
            d3 = client.post(
                "/api/surgery-approval/5001/draft",
                json={"expectedCaseRevision": d2["caseRevision"], "preopChecklist": {"CK-03": {"state": "verified_ok"}}},
                headers=self._hdr(tok_tuan, "s5001-reverify"),
            ).get_json()["surgery"]

            # Unrelated attending BS Đức (id=9, POD 1) CANNOT proxy-submit even if claiming self_reported POD swap!
            sub_unrel = client.post(
                "/api/surgery-approval/5001/submit",
                json={
                    "expectedCaseRevision": d3["caseRevision"],
                    "proxyReasonCode": "in_operating_room",
                    "podMembershipSource": "self_reported",
                },
                headers=self._hdr(tok_duc, "s5001-duc-block"),
            )
            self.assertEqual(sub_unrel.status_code, 403)
            self.assertEqual(sub_unrel.get_json().get("code"), "NOT_AUTHORIZED_PROXY_SUBMITTER")

            # AssistSurgeon1 BS Quy (id=8) CAN proxy-submit with 1-tap proxyReasonCode!
            sub_assist = client.post(
                "/api/surgery-approval/5001/submit",
                json={"expectedCaseRevision": d3["caseRevision"], "proxyReasonCode": "in_operating_room"},
                headers=self._hdr(tok_quy, "s5001-quy-proxy"),
            )
            self.assertEqual(sub_assist.status_code, 200, sub_assist.get_data(as_text=True))
            snap_assist = sub_assist.get_json()["surgery"]["approval"]["submittedSnapshot"]
            self.assertEqual(snap_assist["proxySubmitterSource"], "assist_surgeon_1")

            # Return for revision, then POD 3 attending BS Vĩnh Phú (id=7, server_roster POD 3) proxy-submits!
            ret_5001 = client.post(
                "/api/surgery-approval/5001/return",
                json={"expectedCaseRevision": sub_assist.get_json()["surgery"]["caseRevision"], "feedbackChips": ["clarify_plan"]},
                headers=self._hdr(tok_huu, "s5001-ret"),
            ).get_json()["surgery"]
            sub_pod = client.post(
                "/api/surgery-approval/5001/submit",
                json={"expectedCaseRevision": ret_5001["caseRevision"], "proxyReasonCode": "outpatient_or_consult"},
                headers=self._hdr(tok_phu7, "s5001-pod-proxy"),
            )
            self.assertEqual(sub_pod.status_code, 200, sub_pod.get_data(as_text=True))
            snap_pod = sub_pod.get_json()["surgery"]["approval"]["submittedSnapshot"]
            self.assertEqual(snap_pod["proxySubmitterSource"], "pod_attending")
            self.assertEqual(snap_pod["podMembershipSource"], "server_roster")

            # ── B. BCN Self-Approval + Ca #9021 Rescheduled Across Months Dual KPIs ──
            db_now = json.loads((data_dir / "db.json").read_text(encoding="utf-8"))
            c9021 = next(s for s in db_now["surgeries"] if s["id"] == 9021)
            d9021 = client.post(
                "/api/surgery-approval/9021/draft",
                json=_build_complete_routine_draft_payload(c9021["caseRevision"], ward_room="718"),
                headers=self._hdr(tok_huu, "c9021-d1"),
            ).get_json()["surgery"]
            sub9021 = client.post(
                "/api/surgery-approval/9021/submit",
                json={"expectedCaseRevision": d9021["caseRevision"]},
                headers=self._hdr(tok_huu, "c9021-sub1"),
            ).get_json()["surgery"]
            app9021_nov = client.post(
                "/api/surgery-approval/9021/approve",
                json={"expectedCaseRevision": sub9021["caseRevision"]},
                headers=self._hdr(tok_huu, "c9021-app1"),
            )
            self.assertEqual(app9021_nov.status_code, 200)
            s9021_nov = app9021_nov.get_json()["surgery"]
            self.assertEqual(s9021_nov["approval"]["approvedSnapshot"]["approvalMode"], "self_approval_main_surgeon")
            self.assertEqual(s9021_nov["approval"]["approvalCycleCount"], 1)

            # Stamp the initial approval journal timestamp to 2026-11-26, then reschedule #9021 to 2026-12-05 & re-approve on 2026-12-02
            j_path = pathlib.Path(eng.get_journal_path(str(data_dir)))
            lines = [json.loads(line) for line in j_path.read_text(encoding="utf-8").splitlines() if line.strip()]
            for item in lines:
                if item.get("surgeryId") == 9021 and item.get("action") in ("approve_initial", "approve_routine", "approve"):
                    item["timestamp"] = "2026-11-26T15:00:00+07:00"
            # Rechain hashes cleanly after setting synthetic historical date for Ca #9021 KPI test
            prev_h = eng.GENESIS_HASH
            for item in lines:
                item["prevHash"] = prev_h
                item["entryHash"] = eng.compute_journal_entry_hash(item)
                prev_h = item["entryHash"]
            j_path.write_text("".join(json.dumps(x, ensure_ascii=False) + "\n" for x in lines), encoding="utf-8")

            # Reschedule #9021 to 2026-12-05 via PUT /api/data/surgeries -> downgrades approved -> reapproval_required
            db_mid = json.loads((data_dir / "db.json").read_text(encoding="utf-8"))
            db_mid["_lastApprovalJournalHash"] = prev_h
            (data_dir / "db.json").write_text(json.dumps(db_mid, ensure_ascii=False), encoding="utf-8")
            for s in db_mid["surgeries"]:
                if s["id"] == 9021:
                    s["date"] = "2026-12-05"
            resched = client.put("/api/data/surgeries", json={"items": db_mid["surgeries"]}, headers=self._hdr(tok_huu))
            self.assertEqual(resched.status_code, 200, resched.get_data(as_text=True))
            s9021_resched = next(s for s in resched.get_json()["items"] if s["id"] == 9021)
            self.assertEqual(s9021_resched["approval"]["status"], "reapproval_required")

            # Re-submit & re-approve #9021 (stamped 2026-12-02)
            sub9021_dec = client.post(
                "/api/surgery-approval/9021/submit",
                json={"expectedCaseRevision": s9021_resched["caseRevision"]},
                headers=self._hdr(tok_huu, "c9021-sub2"),
            ).get_json()["surgery"]
            app9021_dec = client.post(
                "/api/surgery-approval/9021/approve",
                json={"expectedCaseRevision": sub9021_dec["caseRevision"]},
                headers=self._hdr(tok_huu, "c9021-app2"),
            ).get_json()["surgery"]
            self.assertEqual(app9021_dec["approval"]["approvalCycleCount"], 2)

            lines2 = [json.loads(line) for line in j_path.read_text(encoding="utf-8").splitlines() if line.strip()]
            for item in lines2:
                if item.get("surgeryId") == 9021 and item.get("action") in ("approve_reapproval", "approve_routine", "approve"):
                    if int((item.get("statePatchSummary") or item.get("summary") or {}).get("reapprovalIndex", 0) or 0) >= 1 or item.get("action") == "approve_reapproval":
                        item["timestamp"] = "2026-12-02T10:15:00+07:00"
            prev_h = eng.GENESIS_HASH
            for item in lines2:
                item["prevHash"] = prev_h
                item["entryHash"] = eng.compute_journal_entry_hash(item)
                prev_h = item["entryHash"]
            j_path.write_text("".join(json.dumps(x, ensure_ascii=False) + "\n" for x in lines2), encoding="utf-8")
            db_dec = json.loads((data_dir / "db.json").read_text(encoding="utf-8"))
            db_dec["_lastApprovalJournalHash"] = prev_h
            (data_dir / "db.json").write_text(json.dumps(db_dec, ensure_ascii=False), encoding="utf-8")

            # Verify Dual KPIs for November vs December
            kpi_nov = client.get(
                "/api/surgery-approval/kpi?periodStart=2026-11-01&periodEnd=2026-11-30",
                headers=self._hdr(tok_huu),
            ).get_json()
            kpi_dec = client.get(
                "/api/surgery-approval/kpi?periodStart=2026-12-01&periodEnd=2026-12-31",
                headers=self._hdr(tok_huu),
            ).get_json()

            # Nov: Case #5001 is scheduled in Nov (unapproved), #9021 moved to Dec; Nov approval activity has #9021 initial approval!
            self.assertNotIn(9021, kpi_nov["bySurgeryDate"]["caseIds"])
            self.assertEqual(kpi_nov["byApprovalDate"]["actedInitialApprovals"], 1)
            self.assertEqual(kpi_nov["byApprovalDate"]["actedReapprovalEvents"], 0)
            self.assertIn(9021, kpi_nov["byApprovalDate"]["distinctSurgeryIds"])

            # Dec: Case #9021 is scheduled & approved in Dec with 1 reapproval cycle; Dec approval activity has 1 reapproval event!
            self.assertEqual(kpi_dec["bySurgeryDate"]["scheduledUniqueCases"], 1)
            self.assertEqual(kpi_dec["bySurgeryDate"]["scheduledApprovedCases"], 1)
            self.assertEqual(kpi_dec["bySurgeryDate"]["scheduledCasesWithReapproval"], 1)
            self.assertEqual(kpi_dec["bySurgeryDate"]["scheduledTotalReapprovalCycles"], 1)
            self.assertEqual(kpi_dec["byApprovalDate"]["actedInitialApprovals"], 0)
            self.assertEqual(kpi_dec["byApprovalDate"]["actedReapprovalEvents"], 1)

    def test_09_staging_concurrency_benchmark_c1_c4_c8(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            client, data_dir = _setup_isolated_server_env(pathlib.Path(td), sandbox_only=False)
            tok_an = self._login_token(client, "vkan", "AnStrong2026")["token"]

            # Seed 8 independent surgeries so 8 concurrent doctors can save drafts simultaneously under _DB_LOCK_FILE
            items = [
                {
                    "id": 6000 + i,
                    "date": "2026-11-24",
                    "patientName": f"Bệnh Nhân Đồng Thời Số {i}",
                    "birthYear": 1960 + i,
                    "admissionId": f"NV-CONC-{i:02d}",
                    "surgeryType": "chuongtrinh",
                    "approachType": "mo",
                    "diagnosis": "Trĩ hỗn hợp",
                    "method": "Milligan-Morgan",
                    "mainSurgeon": 2,
                }
                for i in range(1, 9)
            ]
            put_res = client.put("/api/data/surgeries", json={"items": items}, headers=self._hdr(tok_an))
            self.assertEqual(put_res.status_code, 200)

            def _worker_write(conc_level: int, sid: int, round_idx: int) -> float:
                w_client = sf.app.test_client()
                t0 = time.perf_counter()
                # Fetch latest revision then write under lock
                cur_db = json.loads((data_dir / "db.json").read_text(encoding="utf-8"))
                cur_s = next(s for s in cur_db["surgeries"] if s["id"] == sid)
                res = w_client.post(
                    f"/api/surgery-approval/{sid}/draft",
                    json={
                        "expectedCaseRevision": cur_s["caseRevision"],
                        "podAssignment": {"wardRoom": "718"},
                        "clinicalChips": {
                            "socialHabits": {
                                "confirmed": True,
                                "alcoholUse": "none" if round_idx % 2 == 0 else "occasional",
                                "smoking": {"status": "no", "packYears": None, "packYearsUnknown": False},
                                "substanceAbuse": {"status": "no", "substanceNote": None},
                            }
                        },
                    },
                    headers=self._hdr(tok_an, f"conc-{conc_level}-{sid}-{round_idx}"),
                )
                elapsed_ms = (time.perf_counter() - t0) * 1000.0
                self.assertEqual(res.status_code, 200, res.get_data(as_text=True))
                return elapsed_ms

            bench_report = {}
            for conc in (1, 4, 8):
                latencies = []
                rounds = max(1, 24 // conc)
                for r_idx in range(rounds):
                    with concurrent.futures.ThreadPoolExecutor(max_workers=conc) as pool:
                        futs = [
                            pool.submit(_worker_write, conc, 6000 + ((w % 8) + 1), r_idx * 100 + w)
                            for w in range(conc)
                        ]
                        # Note: when conc == 1..8 each worker in a batch hits a distinct surgery 6001..6008!
                        for f in concurrent.futures.as_completed(futs):
                            latencies.append(f.result())
                lat_sorted = sorted(latencies)
                p50 = statistics.median(lat_sorted)
                p95 = lat_sorted[min(len(lat_sorted) - 1, int(len(lat_sorted) * 0.95))]
                rss_raw = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
                rss_mib = (rss_raw / (1024 * 1024)) if sys.platform == "darwin" else (rss_raw / 1024.0)
                bench_report[f"c={conc}"] = {
                    "requests": len(lat_sorted),
                    "p50_ms": round(p50, 2),
                    "p95_ms": round(p95, 2),
                    "max_ms": round(max(lat_sorted), 2),
                    "peak_rss_mib": round(rss_mib, 1),
                }

            # Verify both hash chains are 100% intact after 72 concurrent lock-serialized writes!
            ok_app, _, err_app, _, _ = eng.verify_journal_stream_streaming(
                eng.get_journal_path(str(data_dir)),
                expected_start_seq=1,
                expected_genesis_hash=eng.GENESIS_HASH,
                seq_field="eventSeq",
                collect_entries=False,
            )
            ok_attr, _, err_attr, _, _ = eng.verify_journal_stream_streaming(
                eng.get_attribution_journal_path(str(data_dir)),
                expected_start_seq=1,
                expected_genesis_hash=eng.GENESIS_HASH,
                seq_field="attributionSeq",
                collect_entries=False,
            )
            self.assertTrue(ok_app, err_app)
            self.assertTrue(ok_attr, err_attr)
            print("\n[STAGING_CONCURRENCY_BENCHMARK]", json.dumps(bench_report, ensure_ascii=False))


if __name__ == "__main__":
    unittest.main()
