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
    sf_mod._client_build = lambda: int(request.headers.get("X-Client-Build", "2611021215"))
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
                "X-Client-Build": "2611021215",
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
            # QĐ3 (BS. Vũ Khương An chốt 02/11/2026): Đợt 1 chỉ áp luồng duyệt cho ca mổ chương trình đã có lịch;
            # /submit-emergency bị khóa 403 NOT_IN_PHASE1_SCOPE, ca cấp cứu/bán khẩn mang trạng thái not_in_scope (không chặn mổ).
            self.assertEqual(em_res.status_code, 403, em_res.get_data(as_text=True))
            self.assertEqual(em_res.get_json().get("code"), "NOT_IN_PHASE1_SCOPE")
            sample_em = copy.deepcopy(c_draft_after)
            sample_em["surgeryType"] = "bankhan"
            in_sc, sc_reason = eng.is_in_phase1_approval_scope(sample_em, eng.DEFAULT_SURGERY_APPROVAL_CONFIG)
            self.assertFalse(in_sc)
            self.assertEqual(sc_reason, "not_in_scope")
            badge_meta = eng.get_approval_badge_meta(sample_em)
            self.assertEqual(badge_meta.get("badgeCode"), "NOT_IN_SCOPE")
            self.assertEqual(badge_meta.get("badgeLabel"), "")

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
                "X-Client-Build": "2611021215",
                "X-Simulate-Staff-Id": "44",
            }
            seed_res = client.post(
                "/api/surgery-approval/sandbox/seed",
                json={},
                headers={
                    "Authorization": "Bearer test-token-anvk",
                    "X-Client-Build": "2611021215",
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

    def test_11_shelved_bridging_antithrombotic_mode_hidden_on_ui_preserved_in_schema(self):
        js_src = (REPO_ROOT / "js" / "surgery-approval.js").read_text(encoding="utf-8")
        self.assertIn("{ value: 'bridging_per_plan', label: 'Bắc cầu Heparin / LMWH', shelved: true }", js_src)
        self.assertIn("SAP_ANTITHROMBOTIC_MODES.filter(m => !m.shelved).map", js_src)
        self.assertIn("bridging_per_plan", eng.VALID_ANTITHROMBOTIC_MODES)

        cases = eng.build_sandbox_sample_surgeries(self.db, str(REPO_ROOT / "data"), str(REPO_ROOT))
        self.assertEqual(len(cases), 16)
        for c in cases:
            anti_mode = ((c.get("clinicalChips") or {}).get("antithromboticPlan") or {}).get("mode")
            self.assertNotEqual(anti_mode, "bridging_per_plan", f"Sandbox case {c.get('scenarioCode')} still uses shelved bridging_per_plan")
        c07 = cases[6]
        self.assertEqual(c07["approval"]["status"], "approved")
        self.assertTrue(c07["approval"]["isApprovalGreenTickValid"])

    def test_12_create_sandbox_case_from_schedule_and_department_training_visibility(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            tmp_dir = pathlib.Path(td)
            data_path = tmp_dir / "data"
            data_path.mkdir(parents=True, exist_ok=True)
            data_dir = str(data_path)
            db = {
                "staff": copy.deepcopy(self.db["staff"]) + [
                    {"id": 1, "name": "Nguyễn Phú Hữu", "title": "TS.BSCKII.", "role": "Trưởng khoa"},
                    {"id": 2, "name": "Vũ Khương An", "title": "BSCKII.", "role": "Phó trưởng khoa"},
                    {"id": 4, "name": "Vũ Ngọc Anh Tuấn", "title": "BSCKII.", "role": "Bác sĩ chính"},
                    {"id": 45, "name": "Nguyễn Đức Thiên Phú", "title": "BSNT.", "role": "Bác sĩ nội trú"},
                ],
                "surgeries": [
                    {
                        "id": 1001,
                        "patientName": "Lê Thị Bệnh Nhân Thật",
                        "birthYear": 1972,
                        "surgeryType": "chuongtrinh",
                        "approachType": "noisoi",
                        "date": "2026-11-05",
                        "mainSurgeon": 4,
                        "diagnosis": "Polyp đại tràng",
                        "method": "PTNS cắt đoạn đại tràng",
                    }
                ],
                "surgeriesTrash": [],
                "notifications": [],
                "surgeryApprovalConfig": {
                    "rolloutAccessMode": "superadmin_only",
                    "sandboxOnlyMode": True,
                    "checklistMode": "enforced_gate",
                    "rolloutEffectiveSurgeryDate": "2026-11-02",
                },
            }
            sa_user = {"staffId": 2, "username": "vkan", "name": "BSCKII. Vũ Khương An", "role": "Phó trưởng khoa", "isSuperAdmin": True}
            staff_doc = {"staffId": 4, "username": "tuanvna", "name": "BSCKII. Vũ Ngọc Anh Tuấn", "role": "Bác sĩ chính", "isSuperAdmin": False}

            # 1. Super Admin creates a [TEST] case directly from Lịch mổ tuần
            old_items = copy.deepcopy(db["surgeries"])
            cand = copy.deepcopy(old_items) + [
                {
                    "id": 990001,
                    "patientName": "Nguyễn Văn Minh",
                    "birthYear": 1964,
                    "admissionId": "TEST-261101",
                    "surgeryType": "chuongtrinh",
                    "approachType": "noisoi",
                    "date": "2026-11-05",
                    "duration": 150,
                    "mainSurgeon": 4,
                    "assistSurgeon1": 45,
                    "diagnosis": "Ung thư đại tràng Sigma cT3N1M0",
                    "method": "Phẫu thuật nội soi cắt đại tràng Sigma + nạo vét hạch",
                    "isTestSandboxCase": True,
                }
            ]
            reconciled = eng.protect_and_reconcile_surgeries_put(
                user=sa_user,
                old_items=old_items,
                candidate_items=cand,
                db=db,
                data_dir=data_dir,
                base_dir=str(REPO_ROOT),
            )
            db["surgeries"] = reconciled
            real_after = next(s for s in reconciled if s["id"] == 1001)
            sbx_after = next(s for s in reconciled if s["id"] == 990001)

            # Real patient stays 100% untouched (no approval metadata in sandboxOnlyMode)
            self.assertNotIn("approval", real_after)
            self.assertNotIn("isTestSandboxCase", real_after)

            # Sandbox case gets [TEST] prefix + full approval draft initialization + exact Catalog 309 Sigma->Chậu hông suggestion + WAL hash chain
            self.assertTrue(sbx_after.get("isTestSandboxCase"))
            self.assertEqual(sbx_after["patientName"], "[TEST] Nguyễn Văn Minh")
            self.assertEqual(sbx_after["approval"]["status"], "draft_unsubmitted")
            self.assertEqual(sbx_after["caseRevision"], 1)
            self.assertEqual(
                sbx_after["clinicalClassification"]["procedureClass"]["suggestedCatalogCode"],
                "PTNS-202",
            )
            self.assertEqual(
                sbx_after["clinicalClassification"]["procedureClass"]["suggestedClass"],
                "PT-ĐB",
            )
            self.assertIsNotNone(sbx_after.get("preopChecklist"))
            self.assertIsNotNone(sbx_after.get("clinicalChips"))
            ok_chain, entries, err = eng.verify_approval_journal_chain(eng.get_journal_path(data_dir))
            self.assertTrue(ok_chain, err)
            self.assertEqual(entries[-1]["action"], "sandbox_create_from_schedule")

            # 2. In superadmin_only mode, non-superadmin staff CANNOT see [TEST] cases
            filtered_canary = eng.filter_db_payload_for_user(db, staff_doc, set())
            self.assertEqual([s["id"] for s in filtered_canary["surgeries"]], [1001])

            # 3. Switch to Department Training Mode (rolloutAccessMode='all_staff', sandboxOnlyMode=True)
            db["surgeryApprovalConfig"]["rolloutAccessMode"] = "all_staff"
            db["surgeryApprovalConfig"]["sandboxOnlyMode"] = True
            self.assertTrue(eng.can_user_access_sandbox(staff_doc, db))
            filtered_training = eng.filter_db_payload_for_user(db, staff_doc, set())
            self.assertIn(990001, [s["id"] for s in filtered_training["surgeries"]])

            # Non-superadmin attending doctor creates a [TEST] case in Department Training Mode -> allowed!
            cand_staff = copy.deepcopy(db["surgeries"]) + [
                {
                    "id": 990002,
                    "patientName": "[TEST] Trần Thị Tập Huấn",
                    "birthYear": 1970,
                    "surgeryType": "chuongtrinh",
                    "approachType": "noisoi",
                    "date": "2026-11-06",
                    "mainSurgeon": 4,
                    "diagnosis": "U trực tràng giữa",
                    "method": "PTNS cắt trước thấp trực tràng",
                    "isTestSandboxCase": True,
                }
            ]
            reconciled_staff = eng.protect_and_reconcile_surgeries_put(
                user=staff_doc,
                old_items=db["surgeries"],
                candidate_items=cand_staff,
                db=db,
                data_dir=data_dir,
                base_dir=str(REPO_ROOT),
            )
            db["surgeries"] = reconciled_staff
            sbx_staff = next(s for s in reconciled_staff if s["id"] == 990002)
            self.assertTrue(sbx_staff.get("isTestSandboxCase"))
            self.assertEqual(sbx_staff["approval"]["status"], "draft_unsubmitted")

            # Notifications in Department Training Mode deliver [TEST] alerts to internal staff, skipping external doctor 105
            notifs = eng.build_approval_notifications(
                db,
                sbx_staff,
                actor_staff_id=45,
                event_id="evt-train-1",
                notif_type="surgery_ready_for_attending",
                short_status_text="BS học viên đã chuẩn bị xong — mời BS chính kiểm tra",
                recipient_staff_ids=[4, 105],
            )
            self.assertEqual([n["toStaffId"] for n in notifs], [4])
            self.assertTrue(notifs[0]["message"].startswith("[TEST] "))

            # 4. Switch to Full Live Clinical Mode (rolloutAccessMode='all_staff', sandboxOnlyMode=False):
            # non-superadmin staff no longer see residual [TEST] cases!
            db["surgeryApprovalConfig"]["sandboxOnlyMode"] = False
            self.assertFalse(eng.can_user_access_sandbox(staff_doc, db))
            filtered_live = eng.filter_db_payload_for_user(db, staff_doc, set())
            self.assertEqual([s["id"] for s in filtered_live["surgeries"]], [1001])


if __name__ == "__main__":
    unittest.main()
