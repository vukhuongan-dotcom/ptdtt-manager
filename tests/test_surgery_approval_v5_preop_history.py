#!/usr/bin/env python3
"""Comprehensive regression & contract test suite for Departmental Online Surgery Approval v5 (2026.11.v5):
- C-04 Comorbidities (13 clinical chips from BVBD Phieu Kham Tien Me, Covid-19 excluded, medicalTreatmentNote)
- C-08 Surgical/Anesthesia History (abdominalScarType, detailNote)
- C-09 Allergy History (TC-21a: drug/severe_anaphylaxis requires allergenDetail >= 2 chars)
- C-10 Social Habits (TC-21b: smoking packYears or packYearsUnknown; TC-21c: substanceNote)
- TC-21d: High-risk preop history skips CK-03 in bulk_confirm_routine & requires verified_abnormal_planned + clinicalPlanNote
- TC-22a: Post-approval Tier A edit of C-04/C-08/C-09/C-10 bumps caseRevision & downgrades approved -> reapproval_required
- TC-22b: POST /submit-emergency allows 'unknown' on C-08..C-10 and appends deferredItems
- Phuong an 1 wording & pure Vietnamese 'Moc han trinh duyet' (zero visible English 'SLA')
"""

from __future__ import annotations

import copy
import json
import pathlib
import re
import sys
import tempfile
import types
import unittest

from flask import Flask, request

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import surgery_approval_engine as eng  # noqa: E402
from surgery_approval_routes import (  # noqa: E402
    ensure_approval_bootstrapped,
    register_surgery_approval_routes,
)


def _make_isolated_flask_env(tmp_dir: pathlib.Path):
    """Creates an isolated Flask test client wired to a temp data dir without touching production data/db.json."""
    src_db = json.loads((REPO_ROOT / "data" / "db.json").read_text(encoding="utf-8"))
    isolated_db = {
        "staff": copy.deepcopy(src_db.get("staff") or []),
        "rooms": copy.deepcopy(src_db.get("rooms") or []),
        "externalDoctors": copy.deepcopy(src_db.get("externalDoctors") or []),
        "surgeries": [],
        "surgeriesTrash": [],
        "notifications": [],
        "_revisions": {"surgeries": 1, "notifications": 1},
    }
    data_dir = tmp_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    src_cat = REPO_ROOT / "data" / "procedure_catalog_2026_v1.json"
    (data_dir / "procedure_catalog_2026_v1.json").write_text(
        src_cat.read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    data_file = data_dir / "db.json"
    data_file.write_text(json.dumps(isolated_db, ensure_ascii=False, indent=2), encoding="utf-8")

    auth_payload = {
        "users": {
            "anvk": {
                "username": "anvk",
                "staffId": 2,
                "role": "admin",
                "isSuperAdmin": True,
                "disabled": False,
                "tokenVersion": 1,
                "name": "BSCKII. Vũ Khương An",
            },
            "huunp": {
                "username": "huunp",
                "staffId": 1,
                "role": "admin",
                "isSuperAdmin": False,
                "disabled": False,
                "tokenVersion": 1,
                "name": "TS.BS. Nguyễn Phú Hữu",
            },
        }
    }
    auth_file = data_dir / "auth.json"
    auth_file.write_text(json.dumps(auth_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    sf_mod = types.SimpleNamespace()
    sf_mod.BASE_DIR = str(REPO_ROOT)
    sf_mod.DATA_DIR = str(data_dir)
    sf_mod.DATA_FILE = str(data_file)
    sf_mod.AUTH_FILE = str(auth_file)
    sf_mod._DB_LOCK_FILE = str(data_dir / ".db.lock")
    sf_mod.MIN_CLIENT_BUILD = 2610312158
    sf_mod.WRITE_COLLECTIONS = {"surgeries", "surgeriesTrash", "notifications"}
    sf_mod._client_build = lambda: int(request.headers.get("X-Client-Build", "2611021115"))
    sf_mod._verify_jwt = lambda token: {"sub": "anvk", "tv": 1} if token == "test-token-anvk" else None
    sf_mod._save_auth = lambda payload: auth_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    sf_mod._get_file_version = lambda: "test-ver"
    sf_mod.load_data = lambda: json.loads(data_file.read_text(encoding="utf-8"))
    sf_mod.audit_log = lambda *args, **kwargs: None
    sf_mod._is_admin = lambda u: u.get("role") == "admin"
    sf_mod._is_doctor = lambda u: True
    sf_mod.is_surgery_week_locked = lambda d: False
    sf_mod.snapshot_data_file = lambda label: None

    test_app = Flask("test_surgery_approval_v5")
    test_app.config["TESTING"] = True
    ensure_approval_bootstrapped(sf_mod)
    register_surgery_approval_routes(test_app, sf_mod)
    return test_app, sf_mod


class SurgeryApprovalV5PreopHistoryTests(unittest.TestCase):
    """Verifies all v5 clinical history variables, validation gates, migration, and HTTP workflows."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.catalog = eng.load_procedure_catalog(str(REPO_ROOT / "data"), str(REPO_ROOT))
        cls.db = json.loads((REPO_ROOT / "data" / "db.json").read_text(encoding="utf-8"))
        cls.cfg = copy.deepcopy(eng.DEFAULT_SURGERY_APPROVAL_CONFIG)
        cls.actor_attending = {"staffId": 2, "role": "admin", "isSuperAdmin": True, "username": "anvk"}

    def _fresh_routine_case(self) -> dict:
        """Builds a clean routine case with Step 1, Step 2, and Step 3 verified and zero high-risk flags."""
        samples = eng.build_sandbox_sample_surgeries(self.db, str(REPO_ROOT / "data"), str(REPO_ROOT))
        base = copy.deepcopy(samples[6])  # Scenario 07: fully verified case
        base["mainSurgeon"] = 2
        base["approval"]["status"] = "draft_unsubmitted"
        base["approval"]["approvedSnapshot"] = None
        base["clinicalChips"]["comorbidities"] = {
            "confirmed": True,
            "values": ["none"],
            "otherComorbidityNote": None,
            "medicalTreatmentNote": None,
        }
        base["clinicalChips"]["surgicalHistory"] = {
            "confirmed": True,
            "status": "none",
            "categories": [],
            "abdominalScarType": "not_applicable",
            "detailNote": None,
        }
        base["clinicalChips"]["allergyHistory"] = {
            "confirmed": True,
            "status": "none",
            "allergenGroups": [],
            "reactionSeverity": None,
            "allergenDetail": None,
        }
        base["clinicalChips"]["socialHabits"] = {
            "confirmed": True,
            "alcoholUse": "none",
            "smoking": {"status": "no", "packYears": None, "packYearsUnknown": False},
            "substanceAbuse": {"status": "no", "substanceNote": None},
        }
        base["clinicalChips"]["antithromboticPlan"] = {
            "confirmed": True,
            "mode": "none_confirmed",
            "drugName": "",
            "bridgingAgent": "",
            "lastDoseAt": "",
            "approvingSpecialtyOrDoctor": "",
            "planReferenceNote": "",
        }
        base["preopChecklist"]["CK-03"] = {
            "state": "verified_ok",
            "preparedByStaffId": 2,
            "verifiedByStaffId": 2,
            "clinicalPlanNote": None,
        }
        return base

    def test_01_rule_version_canary_isolation_and_16_sandbox_scenarios(self) -> None:
        self.assertEqual(eng.RULE_VERSION, "2026.11.v5")
        self.assertTrue(eng.DEFAULT_SURGERY_APPROVAL_CONFIG["sandboxOnlyMode"])
        self.assertEqual(eng.DEFAULT_SURGERY_APPROVAL_CONFIG["rolloutAccessMode"], "superadmin_only")

        samples = eng.build_sandbox_sample_surgeries(self.db, str(REPO_ROOT / "data"), str(REPO_ROOT))
        self.assertEqual(len(samples), 16)
        internal_samples = [s for s in samples if s.get("approachType") != "nsth"]
        self.assertEqual(len(internal_samples), 15)
        for s in internal_samples:
            chips = s.get("clinicalChips") or {}
            for key in ("comorbidities", "surgicalHistory", "allergyHistory", "socialHabits"):
                self.assertIn(key, chips, f"Sandbox {s.get('patientName')} missing {key}")
        self.assertEqual(samples[15].get("approachType"), "nsth")
        self.assertIsNone(samples[15].get("clinicalChips"))

    def test_02_c04_comorbidities_13_chips_covid_excluded_and_treatment_note(self) -> None:
        case = self._fresh_routine_case()
        expected_13 = {
            "hypertension",
            "diabetes",
            "ischemic_heart_cad",
            "arrhythmia",
            "valvular_heart_hf",
            "thyroid_disease",
            "copd_asthma",
            "pulmonary_tb_sequelae",
            "stroke_cva_sequelae",
            "ckd",
            "cirrhosis",
            "anemia_malnutrition",
            "other",
        }
        self.assertTrue(expected_13.issubset(eng.VALID_COMORBIDITIES))
        self.assertNotIn("covid_19", eng.VALID_COMORBIDITIES)

        # Reject covid_19
        with self.assertRaises(eng.ApprovalEngineError) as cm_cov:
            eng.apply_draft_updates(
                case,
                self.actor_attending,
                {"clinicalChips": {"comorbidities": {"confirmed": True, "values": ["covid_19"]}}},
                self.catalog,
                self.db,
            )
        self.assertEqual(cm_cov.exception.error_code, "INVALID_CHIP_VALUE")

        # Reject 'none' + another chip
        with self.assertRaises(eng.ApprovalEngineError) as cm_mut:
            eng.apply_draft_updates(
                case,
                self.actor_attending,
                {"clinicalChips": {"comorbidities": {"confirmed": True, "values": ["none", "hypertension"]}}},
                self.catalog,
                self.db,
            )
        self.assertEqual(cm_mut.exception.error_code, "MUTUALLY_EXCLUSIVE_CHIPS")

        # Accept 12 clinical chips + 'other' with note + medicalTreatmentNote
        eng.apply_draft_updates(
            case,
            self.actor_attending,
            {
                "clinicalChips": {
                    "comorbidities": {
                        "confirmed": True,
                        "values": sorted(expected_13),
                        "otherComorbidityNote": "Hội chứng ngưng thở khi ngủ",
                        "medicalTreatmentNote": "Amlodipin 5mg sáng, Insulin 20 UI, HA/ĐH ổn",
                    }
                }
            },
            self.catalog,
            self.db,
        )
        cm_saved = case["clinicalChips"]["comorbidities"]
        self.assertEqual(cm_saved["medicalTreatmentNote"], "Amlodipin 5mg sáng, Insulin 20 UI, HA/ĐH ổn")

        # Selecting 'none' clears notes cleanly
        eng.apply_draft_updates(
            case,
            self.actor_attending,
            {"clinicalChips": {"comorbidities": {"confirmed": True, "values": ["none"]}}},
            self.catalog,
            self.db,
        )
        self.assertIsNone(case["clinicalChips"]["comorbidities"]["medicalTreatmentNote"])
        self.assertFalse(bool(case["clinicalChips"]["comorbidities"]["otherComorbidityNote"]))

    def test_03_c08_surgical_history_gates(self) -> None:
        case = self._fresh_routine_case()
        # Unknown blocked on routine submit -> C-08_SURGICAL_HISTORY_UNCONFIRMED in blockingReasons
        eng.apply_draft_updates(
            case,
            self.actor_attending,
            {
                "clinicalChips": {
                    "surgicalHistory": {
                        "confirmed": True,
                        "status": "unknown",
                        "categories": [],
                        "abdominalScarType": "not_applicable",
                        "detailNote": None,
                    }
                }
            },
            self.catalog,
            self.db,
        )
        with self.assertRaises(eng.ApprovalEngineError) as cm_unk:
            eng.validate_routine_submit_gate(case, self.actor_attending, {}, self.catalog, self.db, self.cfg)
        self.assertIn("C-08_SURGICAL_HISTORY_UNCONFIRMED", cm_unk.exception.extra.get("blockingReasons", []))

        # Abdominal surgery without abdominalScarType -> C-08_ABDOMINAL_SCAR_REQUIRED
        eng.apply_draft_updates(
            case,
            self.actor_attending,
            {
                "clinicalChips": {
                    "surgicalHistory": {
                        "confirmed": True,
                        "status": "present",
                        "categories": ["prior_abdominal_pelvic"],
                        "abdominalScarType": "not_applicable",
                        "detailNote": None,
                    }
                }
            },
            self.catalog,
            self.db,
        )
        with self.assertRaises(eng.ApprovalEngineError) as cm_scar:
            eng.validate_routine_submit_gate(case, self.actor_attending, {}, self.catalog, self.db, self.cfg)
        self.assertIn("C-08_ABDOMINAL_SCAR_REQUIRED", cm_scar.exception.extra.get("blockingReasons", []))

        # Anesthesia/transfusion event without detailNote >= 3 chars -> C-08_SURGICAL_DETAIL_REQUIRED
        eng.apply_draft_updates(
            case,
            self.actor_attending,
            {
                "clinicalChips": {
                    "surgicalHistory": {
                        "confirmed": True,
                        "status": "present",
                        "categories": ["prior_anesthesia_or_transfusion_event"],
                        "abdominalScarType": "not_applicable",
                        "detailNote": " ",
                    }
                }
            },
            self.catalog,
            self.db,
        )
        with self.assertRaises(eng.ApprovalEngineError) as cm_det:
            eng.validate_routine_submit_gate(case, self.actor_attending, {}, self.catalog, self.db, self.cfg)
        self.assertIn("C-08_SURGICAL_DETAIL_REQUIRED", cm_det.exception.extra.get("blockingReasons", []))

    def test_04_tc21a_allergy_detail_required_for_drug_or_anaphylaxis(self) -> None:
        case = self._fresh_routine_case()
        # Drug allergy without allergenDetail -> 422 ALLERGY_DETAIL_REQUIRED on submit gate
        eng.apply_draft_updates(
            case,
            self.actor_attending,
            {
                "clinicalChips": {
                    "allergyHistory": {
                        "confirmed": True,
                        "status": "present",
                        "allergenGroups": ["drug"],
                        "reactionSeverity": "mild_moderate",
                        "allergenDetail": "",
                    }
                }
            },
            self.catalog,
            self.db,
        )
        with self.assertRaises(eng.ApprovalEngineError) as cm_drug:
            eng.validate_routine_submit_gate(case, self.actor_attending, {}, self.catalog, self.db, self.cfg)
        self.assertEqual(cm_drug.exception.error_code, "ALLERGY_DETAIL_REQUIRED")

        # Severe anaphylaxis (even food) without allergenDetail >= 2 chars -> 422 ALLERGY_DETAIL_REQUIRED
        eng.apply_draft_updates(
            case,
            self.actor_attending,
            {
                "clinicalChips": {
                    "allergyHistory": {
                        "confirmed": True,
                        "status": "present",
                        "allergenGroups": ["food"],
                        "reactionSeverity": "severe_anaphylaxis",
                        "allergenDetail": "X",
                    }
                }
            },
            self.catalog,
            self.db,
        )
        with self.assertRaises(eng.ApprovalEngineError) as cm_ana:
            eng.validate_routine_submit_gate(case, self.actor_attending, {}, self.catalog, self.db, self.cfg)
        self.assertEqual(cm_ana.exception.error_code, "ALLERGY_DETAIL_REQUIRED")

        # Valid mild drug allergy with allergenDetail='Cefazolin' passes submit gate cleanly
        eng.apply_draft_updates(
            case,
            self.actor_attending,
            {
                "clinicalChips": {
                    "allergyHistory": {
                        "confirmed": True,
                        "status": "present",
                        "allergenGroups": ["drug"],
                        "reactionSeverity": "mild_moderate",
                        "allergenDetail": "Cefazolin (nổi mề đay)",
                    }
                }
            },
            self.catalog,
            self.db,
        )
        self.assertEqual(case["clinicalChips"]["allergyHistory"]["allergenDetail"], "Cefazolin (nổi mề đay)")
        eng.validate_routine_submit_gate(case, self.actor_attending, {}, self.catalog, self.db, self.cfg)

    def test_05_tc21b_tc21c_social_habits_pack_years_and_substance_note(self) -> None:
        case = self._fresh_routine_case()
        # TC-21b: Current smoker without packYears and packYearsUnknown=False -> 422 SMOKING_PACK_YEARS_REQUIRED
        eng.apply_draft_updates(
            case,
            self.actor_attending,
            {
                "clinicalChips": {
                    "socialHabits": {
                        "confirmed": True,
                        "alcoholUse": "none",
                        "smoking": {"status": "current", "packYears": None, "packYearsUnknown": False},
                        "substanceAbuse": {"status": "no", "substanceNote": None},
                    }
                }
            },
            self.catalog,
            self.db,
        )
        with self.assertRaises(eng.ApprovalEngineError) as cm_smk:
            eng.validate_routine_submit_gate(case, self.actor_attending, {}, self.catalog, self.db, self.cfg)
        self.assertEqual(cm_smk.exception.error_code, "SMOKING_PACK_YEARS_REQUIRED")

        # Numeric out-of-range (e.g. 250 > 200) rejected immediately on draft update
        with self.assertRaises(eng.ApprovalEngineError) as cm_range:
            eng.apply_draft_updates(
                case,
                self.actor_attending,
                {
                    "clinicalChips": {
                        "socialHabits": {
                            "confirmed": True,
                            "alcoholUse": "none",
                            "smoking": {"status": "current", "packYears": 250, "packYearsUnknown": False},
                            "substanceAbuse": {"status": "no", "substanceNote": None},
                        }
                    }
                },
                self.catalog,
                self.db,
            )
        self.assertEqual(cm_range.exception.error_code, "SMOKING_PACK_YEARS_REQUIRED")

        # Valid with packYears = 20 passes submit gate
        eng.apply_draft_updates(
            case,
            self.actor_attending,
            {
                "clinicalChips": {
                    "socialHabits": {
                        "confirmed": True,
                        "alcoholUse": "occasional",
                        "smoking": {"status": "current", "packYears": 20, "packYearsUnknown": False},
                        "substanceAbuse": {"status": "no", "substanceNote": None},
                    }
                }
            },
            self.catalog,
            self.db,
        )
        self.assertEqual(case["clinicalChips"]["socialHabits"]["smoking"]["packYears"], 20.0)
        eng.validate_routine_submit_gate(case, self.actor_attending, {}, self.catalog, self.db, self.cfg)

        # Valid with packYearsUnknown = True passes submit gate
        eng.apply_draft_updates(
            case,
            self.actor_attending,
            {
                "clinicalChips": {
                    "socialHabits": {
                        "confirmed": True,
                        "alcoholUse": "none",
                        "smoking": {"status": "former", "packYears": None, "packYearsUnknown": True},
                        "substanceAbuse": {"status": "no", "substanceNote": None},
                    }
                }
            },
            self.catalog,
            self.db,
        )
        self.assertTrue(case["clinicalChips"]["socialHabits"]["smoking"]["packYearsUnknown"])
        eng.validate_routine_submit_gate(case, self.actor_attending, {}, self.catalog, self.db, self.cfg)

        # TC-21c: Substance abuse 'yes' without substanceNote -> 422 SUBSTANCE_DETAIL_REQUIRED
        eng.apply_draft_updates(
            case,
            self.actor_attending,
            {
                "clinicalChips": {
                    "socialHabits": {
                        "confirmed": True,
                        "alcoholUse": "none",
                        "smoking": {"status": "no", "packYears": None, "packYearsUnknown": False},
                        "substanceAbuse": {"status": "yes", "substanceNote": " "},
                    }
                }
            },
            self.catalog,
            self.db,
        )
        with self.assertRaises(eng.ApprovalEngineError) as cm_sub:
            eng.validate_routine_submit_gate(case, self.actor_attending, {}, self.catalog, self.db, self.cfg)
        self.assertEqual(cm_sub.exception.error_code, "SUBSTANCE_DETAIL_REQUIRED")

    def test_06_tc21d_high_risk_history_skips_bulk_ck03_and_enforces_abnormal_plan(self) -> None:
        case = self._fresh_routine_case()
        case["preopChecklist"]["CK-03"] = {"state": "unverified", "clinicalPlanNote": None}
        eng.apply_draft_updates(
            case,
            self.actor_attending,
            {
                "clinicalChips": {
                    "allergyHistory": {
                        "confirmed": True,
                        "status": "present",
                        "allergenGroups": ["drug"],
                        "reactionSeverity": "severe_anaphylaxis",
                        "allergenDetail": "Ceftriaxone (phản vệ độ II)",
                    }
                }
            },
            self.catalog,
            self.db,
        )
        # Run bulk_confirm_routine -> CK-03 must remain unverified!
        eng.apply_draft_updates(case, self.actor_attending, {"bulkAction": "bulk_confirm_routine"}, self.catalog, self.db)
        self.assertEqual(case["preopChecklist"]["CK-03"]["state"], "unverified")

        # Even if CK-03 = verified_ok, routine submit gate MUST block with CK-03_HIGH_RISK_HISTORY_PLAN_REQUIRED
        case["preopChecklist"]["CK-03"] = {"state": "verified_ok", "verifiedByStaffId": 2, "clinicalPlanNote": None}
        with self.assertRaises(eng.ApprovalEngineError) as cm_gate:
            eng.validate_routine_submit_gate(case, self.actor_attending, {}, self.catalog, self.db, self.cfg)
        self.assertIn("CK-03_HIGH_RISK_HISTORY_PLAN_REQUIRED", cm_gate.exception.extra.get("blockingReasons", []))

        # Once CK-03 = verified_abnormal_planned with clinicalPlanNote, routine submit gate passes!
        case["preopChecklist"]["CK-03"] = {
            "state": "verified_abnormal_planned",
            "verifiedByStaffId": 2,
            "clinicalPlanNote": "Báo BS GMHS đổi sang Ciprofloxacin + Metronidazole dự phòng",
        }
        eng.validate_routine_submit_gate(case, self.actor_attending, {}, self.catalog, self.db, self.cfg)

    def test_07_tc22a_tc22b_flask_routes_post_approval_invalidation_and_emergency_deferral(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            app, _ = _make_isolated_flask_env(pathlib.Path(td))
            client = app.test_client()
            base_headers = {
                "Authorization": "Bearer test-token-anvk",
                "X-Client-Build": "2611021115",
            }

            # Seed 16 sandbox scenarios
            seed_res = client.post(
                "/api/surgery-approval/sandbox/seed",
                json={},
                headers={**base_headers, "X-Idempotency-Key": "seed-1"},
            )
            self.assertEqual(seed_res.status_code, 200, seed_res.get_data(as_text=True))
            surgeries = seed_res.get_json()["cases"]
            self.assertEqual(len(surgeries), 16)

            # TC-22a: Find an 'approved' case and edit allergyHistory -> bumps caseRevision & becomes reapproval_required
            c_approved = next(s for s in surgeries if (s.get("approval") or {}).get("status") == "approved")
            rev_before = c_approved["caseRevision"]

            patch_res = client.post(
                f"/api/surgery-approval/{c_approved['id']}/draft",
                json={
                    "expectedCaseRevision": rev_before,
                    "clinicalChips": {
                        "allergyHistory": {
                            "confirmed": True,
                            "status": "present",
                            "allergenGroups": ["drug"],
                            "reactionSeverity": "mild_moderate",
                            "allergenDetail": "Ibuprofen (phù mi mắt)",
                        }
                    },
                },
                headers={**base_headers, "X-Idempotency-Key": "tc22a-patch"},
            )
            self.assertEqual(patch_res.status_code, 200, patch_res.get_data(as_text=True))
            updated_approved = patch_res.get_json()["surgery"]
            self.assertEqual(updated_approved["caseRevision"], rev_before + 1)
            self.assertEqual(updated_approved["approval"]["status"], "reapproval_required")
            self.assertIsNotNone(updated_approved["approval"].get("lastApprovedSnapshot"))

            # TC-22b: Set urgency='emergency' + C-08..C-10 'unknown' -> submit-emergency populates deferredItems
            c_draft = surgeries[0]
            prep_res = client.post(
                f"/api/surgery-approval/{c_draft['id']}/draft",
                json={
                    "expectedCaseRevision": c_draft["caseRevision"],
                    "clinicalClassification": {"urgencyLevel": "emergency"},
                    "clinicalChips": {
                        "surgicalHistory": {
                            "confirmed": True,
                            "status": "unknown",
                            "categories": [],
                            "abdominalScarType": "not_applicable",
                            "detailNote": None,
                        },
                        "allergyHistory": {
                            "confirmed": True,
                            "status": "unknown",
                            "allergenGroups": [],
                            "reactionSeverity": None,
                            "allergenDetail": None,
                        },
                        "socialHabits": {
                            "confirmed": True,
                            "alcoholUse": "unknown",
                            "smoking": {"status": "unknown", "packYears": None, "packYearsUnknown": False},
                            "substanceAbuse": {"status": "unknown", "substanceNote": None},
                        },
                    },
                },
                headers={**base_headers, "X-Idempotency-Key": "tc22b-prep"},
            )
            self.assertEqual(prep_res.status_code, 200, prep_res.get_data(as_text=True))
            c_draft_after = prep_res.get_json()["surgery"]

            em_res = client.post(
                f"/api/surgery-approval/{c_draft['id']}/submit-emergency",
                json={
                    "expectedCaseRevision": c_draft_after["caseRevision"],
                    "emergencyReasonNote": "Thủng tạng rỗng viêm phúc mạc toàn thể — bệnh nhân lơ mơ chưa khai thác đủ tiền sử",
                    "verbalConsultRecord": {
                        "contactedLeaderStaffId": 1,
                        "contactChannel": "phone",
                        "contactedAt": "2026-11-02T10:30:00+07:00",
                    },
                    "postOpFollowUpOwnerStaffId": 2,
                },
                headers={**base_headers, "X-Idempotency-Key": "tc22b-em"},
            )
            self.assertEqual(em_res.status_code, 200, em_res.get_data(as_text=True))
            em_surg = em_res.get_json()["surgery"]
            self.assertEqual(em_surg["approval"]["status"], "emergency_exception_pending_ack")
            def_top = em_surg["approval"].get("deferredItems") or []
            def_em = em_surg["approval"]["emergencyException"].get("deferredItems") or []
            for expected_def in (
                "clinicalChips.surgicalHistory",
                "clinicalChips.allergyHistory",
                "clinicalChips.socialHabits",
            ):
                self.assertIn(expected_def, def_top)
                self.assertIn(expected_def, def_em)

    def test_08_v4_to_v5_migration_idempotency(self) -> None:
        samples = eng.build_sandbox_sample_surgeries(self.db, str(REPO_ROOT / "data"), str(REPO_ROOT))
        legacy_s = copy.deepcopy(samples[0])
        legacy_s["ruleVersion"] = "2026.10.v4"
        legacy_s["clinicalChips"].pop("surgicalHistory", None)
        legacy_s["clinicalChips"].pop("allergyHistory", None)
        legacy_s["clinicalChips"].pop("socialHabits", None)
        legacy_s["clinicalChips"]["comorbidities"].pop("medicalTreatmentNote", None)

        mock_db = {
            "staff": copy.deepcopy(self.db.get("staff") or []),
            "rooms": copy.deepcopy(self.db.get("rooms") or []),
            "surgeryApprovalConfig": copy.deepcopy(eng.DEFAULT_SURGERY_APPROVAL_CONFIG),
            "surgeries": [legacy_s],
        }
        mock_db["surgeryApprovalConfig"]["ruleVersion"] = "2026.10.v4"

        rep1 = eng.run_surgery_approval_migration(mock_db, str(REPO_ROOT / "data"), str(REPO_ROOT))
        self.assertEqual(mock_db["surgeryApprovalConfig"]["ruleVersion"], "2026.11.v5")
        self.assertEqual(mock_db["surgeries"][0]["ruleVersion"], "2026.11.v5")
        for k in ("surgicalHistory", "allergyHistory", "socialHabits"):
            self.assertIn(k, mock_db["surgeries"][0]["clinicalChips"])
        self.assertGreaterEqual(rep1["counts"].get("upgradedV5HistoryFields", 0), 1)

        snap_after_first = copy.deepcopy(mock_db)
        rep2 = eng.run_surgery_approval_migration(mock_db, str(REPO_ROOT / "data"), str(REPO_ROOT))
        self.assertEqual(rep2["counts"].get("upgradedV5HistoryFields", 0), 0)
        self.assertEqual(rep2["counts"].get("upgradedConfigRuleVersion", 0), 0)
        self.assertEqual(mock_db, snap_after_first)

    def test_09_phuong_an_1_no_visible_sla_and_zero_asa_mallampati_boundary(self) -> None:
        js_txt = (REPO_ROOT / "js" / "surgery-approval.js").read_text(encoding="utf-8")
        eng_txt = (REPO_ROOT / "surgery_approval_engine.py").read_text(encoding="utf-8")
        routes_txt = (REPO_ROOT / "surgery_approval_routes.py").read_text(encoding="utf-8")
        doc_txt = (REPO_ROOT / "docs" / "PHAN_LOAI_PHAU_THUAT_VA_XEP_COT_BS_PTDTT.md").read_text(encoding="utf-8")

        for label, content in (
            ("js/surgery-approval.js", js_txt),
            ("surgery_approval_engine.py", eng_txt),
            ("surgery_approval_routes.py", routes_txt),
            ("docs/PHAN_LOAI_PHAU_THUAT_VA_XEP_COT_BS_PTDTT.md", doc_txt),
        ):
            self.assertNotIn("chặn vượt ≥02 cột", content, f"{label} still contains technical phrase 'chặn vượt ≥02 cột'")
            self.assertIsNone(
                re.search(r"\bSLA\b", content),
                f"{label} still contains English acronym 'SLA'",
            )

        self.assertIn("Quy ước điều phối nội bộ tại Khoa Phẫu thuật Đại trực tràng", doc_txt)
        eng_code_after_docstring = eng_txt.split('"""', 2)[2]
        self.assertIsNone(re.search(r"\bmallampati\b", js_txt, re.I))
        self.assertIsNone(re.search(r"\bmallampati\b", eng_code_after_docstring, re.I))
        self.assertIsNone(r"\basaScore\b|\basaClass\b" if False else re.search(r"\basaScore\b|\basaClass\b", js_txt))

    def test_10_bug210_simulator_exposes_all_trainees_and_enforces_trainee_rbac_matrix(self) -> None:
        js_txt = (REPO_ROOT / "js" / "surgery-approval.js").read_text(encoding="utf-8")
        self.assertNotIn("simOptions.slice(0, 9)", js_txt)
        self.assertNotIn("_getSimulatorRoleOptions().slice(0, 7)", js_txt)
        self.assertIn("sap-sim-trainee-row", js_txt)
        self.assertIn("sap-sim-perm-card", js_txt)
        self.assertIn("_getDrawerSimulatorRoleOptions", js_txt)
        for tid in (16, 43, 44, 45, 46, 47, 48, 50):
            self.assertIn(f"{tid}:", js_txt)

        with tempfile.TemporaryDirectory() as td:
            app, _ = _make_isolated_flask_env(pathlib.Path(td))
            client = app.test_client()
            trainee_headers = {
                "Authorization": "Bearer test-token-anvk",
                "X-Client-Build": "2611021146",
                "X-Simulate-Staff-Id": "44",
            }
            seed_res = client.post(
                "/api/surgery-approval/sandbox/seed",
                json={},
                headers={
                    "Authorization": "Bearer test-token-anvk",
                    "X-Client-Build": "2611021146",
                    "X-Idempotency-Key": "seed-bug210",
                },
            )
            self.assertEqual(seed_res.status_code, 200)
            c0 = seed_res.get_json()["cases"][0]
            sid = c0["id"]
            rev = c0["caseRevision"]

            # 1. ALLOWED: Trainee saves draft + marks CK-01 prepared_ok
            ok_draft = client.post(
                f"/api/surgery-approval/{sid}/draft",
                json={
                    "expectedCaseRevision": rev,
                    "preopChecklist": {"CK-01": {"state": "prepared_ok"}},
                },
                headers={**trainee_headers, "X-Idempotency-Key": "tr-draft-ok"},
            )
            self.assertEqual(ok_draft.status_code, 200, ok_draft.get_data(as_text=True))
            s_after = ok_draft.get_json()["surgery"]
            self.assertEqual(s_after["preopChecklist"]["CK-01"]["state"], "prepared_ok")
            self.assertEqual(s_after["preopChecklist"]["CK-01"]["preparedByStaffId"], 44)
            rev = s_after["caseRevision"]

            # 2. FORBIDDEN (403): Trainee cannot touch attending-only CK-04 / CK-08 or set verified_ok
            for bad_payload, key in (
                ({"preopChecklist": {"CK-04": {"state": "prepared_ok"}}}, "tr-ck04"),
                ({"preopChecklist": {"CK-08": {"state": "prepared_ok"}}}, "tr-ck08"),
                ({"preopChecklist": {"CK-01": {"state": "verified_ok"}}}, "tr-ver"),
            ):
                bad_res = client.post(
                    f"/api/surgery-approval/{sid}/draft",
                    json={"expectedCaseRevision": rev, **bad_payload},
                    headers={**trainee_headers, "X-Idempotency-Key": key},
                )
                self.assertEqual(bad_res.status_code, 403, bad_res.get_data(as_text=True))

            # 3. ALLOWED: Trainee calls /request-verify -> ready_for_attending
            req_ver = client.post(
                f"/api/surgery-approval/{sid}/request-verify",
                json={"expectedCaseRevision": rev},
                headers={**trainee_headers, "X-Idempotency-Key": "tr-req-ver"},
            )
            self.assertEqual(req_ver.status_code, 200, req_ver.get_data(as_text=True))
            s_ready = req_ver.get_json()["surgery"]
            self.assertEqual(s_ready["approval"]["status"], "ready_for_attending")
            rev = s_ready["caseRevision"]

            # 4. FORBIDDEN (403): Trainee cannot /submit, /submit-emergency, /approve, /return, /revoke
            for ep in ("submit", "submit-emergency", "approve", "return", "revoke"):
                ep_res = client.post(
                    f"/api/surgery-approval/{sid}/{ep}",
                    json={"expectedCaseRevision": rev},
                    headers={**trainee_headers, "X-Idempotency-Key": f"tr-forbid-{ep}"},
                )
                self.assertEqual(ep_res.status_code, 403, f"{ep} must return 403 for trainee, got {ep_res.status_code}")


if __name__ == "__main__":
    unittest.main()
