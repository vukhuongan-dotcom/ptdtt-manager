#!/usr/bin/env python3
"""
Surgery Approval Engine — Khoa Phẫu thuật Đại trực tràng (Bệnh viện Bình Dân)
Implements Plan 1 (Core Departmental Online Surgery Approval Workflow) &
Plan 2 (Pre-op Checklist CK-01..08 & 1-Tap Clinical Chips C-01..10 + B1..B4).

Boundary: Purely internal Step 1 at Khoa PTĐTT (Zero HIS / BM01 coupling, no ASA/Mallampati).
"""

import copy
import fcntl
import gzip
import hashlib
import json
import os
import random
import re
import shutil
import unicodedata
import uuid
from datetime import date, datetime, timedelta, timezone

VN_TZ = timezone(timedelta(hours=7))
RULE_VERSION = "2026.11.v5"
SCHEMA_VERSION = 2
GENESIS_HASH = "0" * 64
ATTRIBUTION_UUID_NS = uuid.UUID("a3f0c8d2-957b-4f1a-b91a-1d2357b40211")

PROTECTED_APPROVAL_COLLECTIONS = {
    "surgeries",
    "surgeriesTrash",
    "_approvalIdempotency",
    "approvalDelegations",
    "surgeryApprovalConfig",
}

SERVER_OWNED_SURGERY_FIELDS = {
    "approval",
    "preopChecklist",
    "clinicalChips",
    "clinicalClassification",
    "podAssignment",
    "archivedGroupData",
    "caseRevision",
    "schemaVersion",
    "ruleVersion",
    "lastJournalSeq",
    "lastAttributionSeq",
    "preparationContributors",
    "episodeId",
    "priorEpisodeId",
    "duplicateOverride",
    "_bulkUndoSnapshot",
}

APPROVAL_METADATA_FIELDS_TO_STRIP = (
    "approval",
    "preopChecklist",
    "clinicalChips",
    "clinicalClassification",
    "podAssignment",
    "archivedGroupData",
    "caseRevision",
    "schemaVersion",
    "ruleVersion",
    "lastJournalSeq",
    "lastAttributionSeq",
    "preparationContributors",
    "_bulkUndoSnapshot",
    "previousApprovalStatus",
    "interdisciplinaryCoordination",
    "coordinatingAttendingStaffId",
    "mainSurgeonStaffId",
    "assistSurgeonStaffId",
)

TIER_A_SCHEDULE_FIELDS = (
    "date",
    "surgeryType",
    "approachType",
    "mainSurgeon",
    "method",
    "diagnosis",
    "interdisciplinaryCoordination",
    "coordinatingAttendingStaffId",
)

ATTENDING_STAFF_IDS = {1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12}
BCN_STAFF_IDS = {1, 2}
CHIEF_STAFF_ID = 1
DEPUTY_STAFF_ID = 2
TRAINEE_STAFF_IDS = {16, 43, 44, 45, 46, 47, 48, 50}
ROBOT_CERTIFIED_STAFF_IDS = {1}

COLUMN_RANK = {"DB": 4, "PT-ĐB": 4, "I": 3, "PT-I": 3, "II": 2, "PT-II": 2, "III": 1, "PT-III": 1}

CK_CODES = ("CK-01", "CK-02", "CK-03", "CK-04", "CK-05", "CK-06", "CK-07", "CK-08")
VALID_CK_STATES = {
    "unverified",
    "prepared_ok",
    "verified_ok",
    "verified_abnormal_planned",
    "not_indicated",
    "not_applicable",
    "deferred_emergency",
}
VALID_SUBCHECK_STATES = VALID_CK_STATES | {"ready_for_preanesthesia"}
ROUTINE_SUBMIT_CK_STATES = {"verified_ok", "verified_abnormal_planned", "not_indicated", "not_applicable"}
ALLOWED_ROUTINE_CK_STATES_BY_CODE = {
    "CK-01": {"verified_ok", "verified_abnormal_planned", "not_indicated"},
    "CK-02": {"verified_ok", "verified_abnormal_planned"},
    "CK-03": {"verified_ok", "verified_abnormal_planned"},
    "CK-04": {"verified_ok", "verified_abnormal_planned", "not_applicable"},
    "CK-05": {"verified_ok", "verified_abnormal_planned", "not_applicable"},
    "CK-06": {"verified_ok", "verified_abnormal_planned", "not_indicated", "not_applicable"},
    "CK-07": {"verified_ok", "verified_abnormal_planned"},
    "CK-08": {"verified_ok", "verified_abnormal_planned"},
}

VALID_PATHOLOGY_GROUPS = {
    "unknown",
    "benign_anorectal",
    "benign_colorectal_abdominal",
    "cancer_confirmed",
    "neoplasm_suspected_or_special",
    "other_confirmed",
}
VALID_URGENCY_LEVELS = {"elective", "elective_service", "semi_urgent", "emergency_exception"}
VALID_WARD_ROOMS = {
    "705", "706", "707", "708", "709", "710",
    "711", "712", "712A", "718", "719", "unassigned",
}
VALID_COMORBIDITIES = {
    "none",
    "hypertension",
    "diabetes",
    "ischemic_heart_cad",
    "cad_stent",  # legacy alias preserved for v4 compatibility
    "arrhythmia",
    "valvular_heart_hf",
    "afib_hf",  # legacy alias preserved for v4 compatibility
    "thyroid_disease",
    "copd_asthma",
    "pulmonary_tb_sequelae",
    "stroke_cva_sequelae",
    "ckd",
    "cirrhosis",
    "anemia_malnutrition",
    "other",
}
VALID_SURGICAL_HISTORY_STATUS = {"none", "present", "unknown"}
VALID_SURGICAL_HISTORY_CATEGORIES = {
    "prior_colorectal_stoma",
    "prior_abdominal_pelvic",
    "prior_anorectal_perineal",
    "prior_extra_abdominal",
    "prior_anesthesia_or_transfusion_event",
}
VALID_ABDOMINAL_SCAR_TYPES = {"laparoscopic_scar", "open_laparotomy_scar", "not_applicable"}
VALID_ALLERGY_STATUS = {"none", "present", "unknown"}
VALID_ALLERGY_GROUPS = {"drug", "food", "latex_antiseptic_other"}
VALID_ALLERGY_SEVERITIES = {"mild_moderate", "severe_anaphylaxis"}
VALID_ALCOHOL_USE = {"none", "occasional", "dependent", "unknown"}
VALID_SMOKING_STATUS = {"no", "current", "former", "unknown"}
VALID_SUBSTANCE_STATUS = {"no", "yes", "unknown"}
VALID_ANTITHROMBOTIC_MODES = {
    "none_confirmed",
    "continued_per_plan",
    "held_per_plan",
    "bridging_per_plan",  # Dự trữ (shelved trên UI theo chỉ đạo 02/11/2026 — giữ nguyên schema backend để bật lại sau này)
    "unheld_urgent_risk",
}
VALID_BLOOD_DEVICES = {
    "basic_instruments_only", "prbc_reserved", "ffp_platelets_reserved",
    "circular_linear_stapler", "longo_stapler", "laser_rfa",
    "energy_device", "mesh", "icg", "robot_instruments", "other_device",
}
VALID_STOMA_PLANS = {
    "no_stoma", "protective_temp_stoma_risk", "planned_permanent_stoma",
    "stoma_closure", "other_stoma_plan",
}
VALID_CUSTOM_REASON_CHIPS = {
    "combined_multiorgan",
    "combined_multi_procedure",
    "interdisciplinary_combined",
    "modified_technique",
    "not_in_dm309_yet",
    "variant_outside_dm309",
    "staging_diagnostic_lap",
    "revisional_stoma_complex",
    "other",
}
VALID_VERIFIED_BASIS_CODES = {
    "tt50_by_analogy",
    "bvbd_privilege_decision",
    "joint_specialty_board",
    "other_note",
    "equivalent_dm309_complexity",
    "hospital_technical_council",
    "equivalent_bvbd_class",
    "highest_component_procedure",
    "moh_catalog_reference",
    "equivalent_dm309",
    "hospital_privilege_grant",
    "interdisciplinary_board",
    "chief_clinical_decision",
    "other",
}
VALID_PROXY_REASON_CODES = {
    "main_surgeon_in_or",
    "main_surgeon_in_clinic",
    "main_surgeon_on_leave_or_duty",
    "main_surgeon_outpatient_clinic",
    "main_surgeon_conference_leave",
    "pod_cross_cover",
    "in_operating_room",
    "outpatient_or_consult",
    "post_call_or_leave",
    "other",
}
VALID_DUPLICATE_RESOLUTIONS = {
    "new_episode_same_patient",
    "same_admission_multistage",
    "different_patient_same_name",
}
VALID_DUPLICATE_REASON_CHIPS = {
    "planned_two_stage",
    "reoperation_complication",
    "combined_staged_procedure",
    "stoma_closure_reversal",
    "recurrence_or_metastasis",
    "new_condition_separate_admission",
    "same_name_different_person",
    "other",
}
STALE_VERIFICATION_LABEL_VI = "Dữ liệu vừa thay đổi — cần BS chính xác nhận lại"

DEFAULT_POD_ROSTER_ROOMS = {
    "718": {"podId": 1, "attendingStaffIds": [2, 12], "residentStaffIds": [46]},
    "707": {"podId": 1, "attendingStaffIds": [9], "residentStaffIds": [45]},
    "705": {"podId": 2, "attendingStaffIds": [8], "residentStaffIds": [50]},
    "706": {"podId": 2, "attendingStaffIds": [8], "residentStaffIds": [44]},
    "711": {"podId": 2, "attendingStaffIds": [10], "residentStaffIds": []},
    "712": {"podId": 2, "attendingStaffIds": [10], "residentStaffIds": [16]},
    "712A": {"podId": 2, "attendingStaffIds": [6], "residentStaffIds": [16]},
    "719": {"podId": 2, "attendingStaffIds": [6], "residentStaffIds": [16]},
    "708": {"podId": 3, "attendingStaffIds": [4], "residentStaffIds": [43]},
    "709": {"podId": 3, "attendingStaffIds": [11], "residentStaffIds": [48]},
    "710": {"podId": 3, "attendingStaffIds": [7], "residentStaffIds": [47]},
}

DEFAULT_SURGERY_APPROVAL_CONFIG = {
    "scope": "departmental_step1_only",
    "zeroHisCoupling": True,
    "ruleVersion": RULE_VERSION,
    "rolloutAccessMode": "superadmin_only",  # "superadmin_only" | "all_staff"
    "sandboxOnlyMode": True,                 # True = Tab Duyệt mổ CHỈ dùng ca TEST giả lập đến hết CN 08/11/2026 (0% bệnh nhân thật)
    "checklistMode": "enforced_gate",        # "off" | "shadow_optional" | "enforced_gate"
    "rolloutEffectiveSurgeryDate": "2026-11-09",  # Dự kiến Thứ Hai 09/11/2026 áp dụng thực tế cho ca mổ chương trình có lịch
    "nsthInternalPrecheckEnabled": False,
    "enableAutoStageDerivation": False,      # Tắt mặc định cho tới khi BCN thẩm định chuyên môn bảng quy chiếu TNM
    "clinicalStagingApprovedBy": None,
    "clinicalStagingApprovedAt": None,
    "approvedRuleSetIds": [],
    "signedVignetteDigest": None,
    "analCanalSccRuleSet": "AJCC_V9_2023_ANUS",
    "podRosters": [],
    "journalRotateMaxBytes": 50 * 1024 * 1024,
    "privilegeMatrixVersion": "BVBD-PTDTT-2026.v2",
    "privilegeMatrix2026Status": "confirmed_active_2026",
    "privilegeValidityYears": 1,
    "privilegeRenewalCycle": "annual_hospital_review",
    "onCallDutyHours": "08:00-18:00",
    "scopeLegendText": "✅ Đã duyệt tại khoa: Xác nhận hoàn tất bước duyệt chuyên môn nội bộ tại Khoa PTĐTT (độc lập với tiến trình duyệt trên phần mềm HIS của Bệnh viện)",
    "slaConfig": {
        "electiveDeadlineHour": 16,
        "electiveDaysBefore": 2,
        "serviceDeadlineHour": 13,
        "serviceDaysBefore": 1,
        "semiUrgentHoursBefore": 2,
        "graceWindowHours": 48,
    },
}

# Fault-injection hooks ONLY for automated test suite (never set in production)
TEST_FAULT_HOOKS = {
    "fail_journal_write": False,
    "crash_after_wal_append": False,
    "crash_between_s1_and_s2": False,
    "crash_between_s2_and_s3": False,
}

_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_CATALOG_CACHE = {"path": None, "mtime": None, "data": None}


class ApprovalEngineError(Exception):
    def __init__(self, status_code: int, error_code: str, message: str, extra: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code
        self.code = error_code
        self.message = message
        self.extra = extra or {}

    def to_dict(self):
        out = {
            "error": self.message,
            "code": self.error_code,
            "errorCode": self.error_code,
        }
        out.update(self.extra)
        return out


class SimulatedCrashAfterWal(Exception):
    """Raised only in automated tests to simulate SIGKILL between Step 3 (WAL) and Step 4 (DB swap)."""


def now_vn() -> datetime:
    return datetime.now(VN_TZ)


def now_vn_iso() -> str:
    return now_vn().isoformat(timespec="seconds")


def is_strict_int(val) -> bool:
    return isinstance(val, int) and not isinstance(val, bool)


def is_pos_int(val) -> bool:
    return is_strict_int(val) and val > 0


def is_valid_iso_date(val) -> bool:
    if not isinstance(val, str) or not _ISO_DATE_RE.fullmatch(val):
        return False
    try:
        datetime.strptime(val, "%Y-%m-%d").date()
        return True
    except ValueError:
        return False


def parse_iso_dt(val: str):
    if not isinstance(val, str) or not val.strip():
        return None
    s = val.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=VN_TZ)
        return dt.astimezone(VN_TZ)
    except ValueError:
        return None


def canonical_json(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def normalize_vn_text(s: str) -> str:
    s = unicodedata.normalize("NFC", str(s or "")).strip().lower()
    return re.sub(r"\s+", " ", s)


def get_approval_config(db: dict) -> dict:
    cfg = copy.deepcopy(DEFAULT_SURGERY_APPROVAL_CONFIG)
    stored = (db or {}).get("surgeryApprovalConfig")
    if isinstance(stored, dict):
        for k, v in stored.items():
            if k == "slaConfig" and isinstance(v, dict):
                cfg["slaConfig"].update(v)
            else:
                cfg[k] = copy.deepcopy(v)
        if "sandboxOnlyMode" not in stored:
            cfg["sandboxOnlyMode"] = (cfg.get("rolloutAccessMode") == "superadmin_only")
    cfg["sandboxOnlyMode"] = bool(cfg.get("sandboxOnlyMode", cfg.get("rolloutAccessMode") == "superadmin_only"))
    cfg["scope"] = "departmental_step1_only"
    cfg["zeroHisCoupling"] = True
    cfg["ruleVersion"] = RULE_VERSION
    return cfg


def can_user_access_sandbox(user: dict, db: dict) -> bool:
    """
    Returns True when `user` is permitted to view/create/practice on `[TEST]` sandbox cases:
    - Super Admin (`isSuperAdmin == True`): ALWAYS True.
    - Authenticated staff: ONLY when `rolloutAccessMode == "all_staff"` AND `sandboxOnlyMode is True`
      (Department Training Sandbox Mode — 100% isolated from real patients).
    - In `superadmin_only` OR Full Live Clinical Mode (`sandboxOnlyMode is False`): False for non-SuperAdmins.
    """
    if not isinstance(user, dict):
        return False
    if bool(user.get("isSuperAdmin")):
        return True
    cfg = get_approval_config(db)
    return cfg.get("rolloutAccessMode") == "all_staff" and cfg.get("sandboxOnlyMode") is True


def strip_approval_metadata_from_real_surgeries(db: dict) -> int:
    """
    Removes all approval-engine metadata from real patient records (isTestSandboxCase != True)
    in surgeries and surgeriesTrash, preserving 100% of real clinical schedule fields untouched.
    """
    stripped_records = 0
    for col_name in ("surgeries", "surgeriesTrash"):
        items = (db or {}).get(col_name)
        if not isinstance(items, list):
            continue
        for rec in items:
            if not isinstance(rec, dict) or rec.get("isTestSandboxCase") is True:
                continue
            touched = False
            for key in APPROVAL_METADATA_FIELDS_TO_STRIP:
                if key in rec:
                    rec.pop(key, None)
                    touched = True
            if touched:
                stripped_records += 1
    return stripped_records


def load_procedure_catalog(data_dir: str, base_dir: str) -> dict:
    cand1 = os.path.join(data_dir, "procedure_catalog_2026_v1.json")
    cand2 = os.path.join(base_dir, "data", "procedure_catalog_2026_v1.json")
    path = cand1 if os.path.isfile(cand1) else cand2
    if not os.path.isfile(path):
        return {
            "catalogVersion": "2026.v1",
            "privilegeMatrix": {
                "privilegeMatrixVersion": "BVBD-PTDTT-2026.v2",
                "privilegeMatrix2026Status": "confirmed_active_2026",
                "validityPeriodYears": 1,
                "renewalCycle": "annual_hospital_review",
                "effectiveFrom": "2026-01-01",
                "effectiveTo": "2026-12-31",
                "attendingColumns": {
                    "1": {"open": "DB", "lap": "DB", "robot": True},
                    "2": {"open": "DB", "lap": "DB", "robot": False},
                    "4": {"open": "DB", "lap": "DB", "robot": False},
                    "5": {"open": "DB", "lap": "DB", "robot": False},
                    "6": {"open": "I", "lap": "I", "robot": False},
                    "7": {"open": "II", "lap": "II", "robot": False},
                    "8": {"open": "II", "lap": "II", "robot": False},
                    "9": {"open": "II", "lap": "II", "robot": False},
                    "10": {"open": "III", "lap": "III", "robot": False},
                    "11": {"open": "III", "lap": "III", "robot": False},
                    "12": {"open": "III", "lap": "III", "robot": False},
                },
                "traineeStaffIds": sorted(TRAINEE_STAFF_IDS),
                "robotCertifiedStaffIds": sorted(ROBOT_CERTIFIED_STAFF_IDS),
                "approvedOverColumnGrants": [],
            },
            "podRoster": {
                "rosterPeriod": "2026-10-05_2026-12-13",
                "effectiveFrom": "2026-10-05",
                "effectiveTo": "2026-12-13",
                "rooms": {},
            },
            "procedures": [],
        }
    mtime = os.path.getmtime(path)
    if _CATALOG_CACHE["path"] == path and _CATALOG_CACHE["mtime"] == mtime and _CATALOG_CACHE["data"]:
        return _CATALOG_CACHE["data"]
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    _CATALOG_CACHE["path"] = path
    _CATALOG_CACHE["mtime"] = mtime
    _CATALOG_CACHE["data"] = data
    return data


# ───────────────────────── Truth Table & Green Tick Predicate ─────────────────────────

def is_approval_green_tick_valid(surgery: dict) -> bool:
    """Exact 6-condition departmental predicate (Zero HIS coupling)."""
    if not isinstance(surgery, dict):
        return False
    if surgery.get("approachType") not in ("mo", "noisoi", "robot"):
        return False
    case_rev = surgery.get("caseRevision")
    if not is_strict_int(case_rev) or case_rev < 1:
        return False
    approval = surgery.get("approval")
    if not isinstance(approval, dict):
        return False
    if approval.get("status") != "approved":
        return False
    if approval.get("activeHold") is not None:
        return False
    snap = approval.get("approvedSnapshot")
    if not isinstance(snap, dict):
        return False
    snap_rev = snap.get("caseRevision")
    if not is_strict_int(snap_rev) or snap_rev != case_rev:
        return False
    return True


def is_in_phase1_approval_scope(surgery: dict, cfg: dict = None) -> tuple:
    """
    QĐ3 Phase-1 Scope Predicate (BS. Vũ Khương An chốt 02/11/2026):
      - Applies ONLY when: valid ISO date AND surgeryType in {'chuongtrinh', 'robot'} AND approachType != 'nsth'.
      - Excludes: Mổ yêu cầu ('yeucau'), Bán khẩn ('bankhan'), Cấp cứu, Nội soi tiêu hóa ('nsth').
      - For real patient surgeries (isTestSandboxCase != True), also requires date >= rolloutEffectiveSurgeryDate.
    """
    if not isinstance(surgery, dict):
        return False, "invalid_record"
    if surgery.get("approachType") == "nsth":
        return False, "nsth_external_authority"
    st = str(surgery.get("surgeryType") or "chuongtrinh").strip()
    if st not in ("chuongtrinh", "robot"):
        return False, "not_in_scope"
    d_str = surgery.get("date", "")
    if not is_valid_iso_date(d_str):
        return False, "invalid_date"
    if surgery.get("isTestSandboxCase") is not True and isinstance(cfg, dict):
        rollout_str = cfg.get("rolloutEffectiveSurgeryDate", "2026-11-09")
        if is_valid_iso_date(rollout_str) and d_str < rollout_str:
            return False, "before_rollout"
    return True, "in_scope"


def get_approval_badge_meta(surgery: dict) -> dict:
    """Implements all Departmental Truth Table rows + QĐ3 'not_in_scope' cleanly and identically to client JS."""
    if not isinstance(surgery, dict):
        return {"row": 10, "badgeCode": "SYNC_ERROR", "badgeLabel": "⚠️ Lỗi đồng bộ phiên bản duyệt", "isGreenTickValid": False}

    approach = surgery.get("approachType")
    approval = surgery.get("approval") if isinstance(surgery.get("approval"), dict) else {}
    status = approval.get("status")
    active_hold = approval.get("activeHold")

    if status == "trashed_inactive":
        return {"row": 12, "badgeCode": "TRASHED_INACTIVE", "badgeLabel": "", "isGreenTickValid": False}

    if approach == "nsth" or status == "nsth_external_authority":
        return {"row": 12, "badgeCode": "NSTH_EXTERNAL", "badgeLabel": "🔹 Thẩm quyền Khoa NSTH", "isGreenTickValid": False}

    if status == "not_in_scope" or str(surgery.get("surgeryType") or "chuongtrinh").strip() not in ("chuongtrinh", "robot"):
        return {"row": 12, "badgeCode": "NOT_IN_SCOPE", "badgeLabel": "", "isGreenTickValid": False}

    if status == "legacy_exempt":
        return {"row": 11, "badgeCode": "LEGACY_EXEMPT", "badgeLabel": "", "isGreenTickValid": False}

    if status == "legacy_unverified_manual_review":
        return {"row": 11, "badgeCode": "LEGACY_MANUAL_REVIEW", "badgeLabel": "⚠️ Cần rà soát dữ liệu lịch sử", "isGreenTickValid": False}

    if status == "post_approval_hold" or active_hold is not None:
        return {"row": 2, "badgeCode": "DEPT_POST_APPROVAL_HOLD", "badgeLabel": "⏸️ Tạm hoãn tại khoa", "isGreenTickValid": False}

    if is_approval_green_tick_valid(surgery):
        return {"row": 1, "badgeCode": "DEPT_APPROVED_STANDARD", "badgeLabel": "✅ Đã duyệt tại khoa", "isGreenTickValid": True}

    if status == "approved":
        # Row 10: status says approved, but failed strict integer/snapshot/approach check!
        return {"row": 10, "badgeCode": "SYNC_VERSION_CORRUPT", "badgeLabel": "⚠️ Lỗi đồng bộ phiên bản duyệt", "isGreenTickValid": False}

    if status == "approved_with_exception":
        return {"row": 3, "badgeCode": "DEPT_APPROVED_EMERGENCY_EXCEPTION", "badgeLabel": "⚡ Duyệt ngoại lệ cấp cứu (Khoa)", "isGreenTickValid": False}

    if status == "reapproval_required":
        return {"row": 4, "badgeCode": "DEPT_REAPPROVAL_REQUIRED", "badgeLabel": "🔄 Chờ duyệt lại thay đổi", "isGreenTickValid": False}

    if status == "returned_for_revision":
        return {"row": 5, "badgeCode": "DEPT_RETURNED_FOR_REVISION", "badgeLabel": "↩️ BCN yêu cầu bổ sung", "isGreenTickValid": False}

    if status == "revoked_by_bcn":
        return {"row": 6, "badgeCode": "DEPT_REVOKED_BY_BCN", "badgeLabel": "🚫 Đã thu hồi duyệt khoa", "isGreenTickValid": False}

    if status == "preapproved":
        return {"row": 7, "badgeCode": "DEPT_PREAPPROVED", "badgeLabel": "☑️ Đạt tiền duyệt — Chờ Trưởng khoa", "isGreenTickValid": False}

    if status in ("submitted", "emergency_exception_pending_ack"):
        return {"row": 8, "badgeCode": "DEPT_SUBMITTED_PENDING_BCN", "badgeLabel": "⏳ Chờ BCN duyệt khoa", "isGreenTickValid": False}

    return {"row": 9, "badgeCode": "DEPT_DRAFT_UNSUBMITTED", "badgeLabel": "📝 Chưa trình duyệt khoa", "isGreenTickValid": False}


def stamp_badge_fields(surgery: dict) -> dict:
    if not isinstance(surgery, dict):
        return surgery
    approval = surgery.setdefault("approval", {})
    meta = get_approval_badge_meta(surgery)
    approval["badgeCode"] = meta["badgeCode"]
    approval["badgeLabel"] = meta["badgeLabel"]
    approval["isGreenTickValid"] = meta["isGreenTickValid"]
    approval["isApprovalGreenTickValid"] = meta["isGreenTickValid"]
    return surgery


# ───────────────────────── Fail-Closed Auth & Role Lookup ─────────────────────────

def resolve_live_user_fail_closed(
    auth_header: str,
    verify_jwt_fn,
    auth_file: str,
    db: dict,
    save_auth_fn=None,
    *,
    http_method: str = None,
    request_path: str = "",
) -> dict:
    """Fail-Closed authentication: NEVER falls back to stale JWT claims if auth.json or staff check fails.
    Enforces QĐ2 sessionEpoch revocation (401) and mustChangePassword write guard (403).
    """
    if not auth_header or not auth_header.startswith("Bearer "):
        raise ApprovalEngineError(401, "AUTH_REQUIRED", "Vui lòng đăng nhập để thực hiện thao tác.")

    payload = verify_jwt_fn(auth_header[7:])
    if not payload or not isinstance(payload, dict):
        raise ApprovalEngineError(401, "INVALID_TOKEN", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.")

    if not os.path.isfile(auth_file):
        raise ApprovalEngineError(503, "AUTH_STORE_UNAVAILABLE", "Không đọc được kho tài khoản xác thực (Fail-Closed).")

    try:
        with open(auth_file, "r", encoding="utf-8") as f:
            auth_data = json.load(f)
    except Exception:
        raise ApprovalEngineError(503, "AUTH_STORE_UNAVAILABLE", "Kho xác thực tạm thời không truy cập được (Fail-Closed).")

    username = payload.get("sub")
    users = auth_data.get("users") if isinstance(auth_data, dict) else None
    if not isinstance(users, dict) or username not in users:
        raise ApprovalEngineError(401, "ACCOUNT_INACTIVE", "Tài khoản không tồn tại hoặc đã bị thu hồi.")

    user_rec = users[username]
    if not isinstance(user_rec, dict):
        raise ApprovalEngineError(401, "ACCOUNT_INACTIVE", "Dữ liệu tài khoản không hợp lệ.")

    live_epoch = int(user_rec.get("sessionEpoch", 1) or 1)
    jwt_epoch = payload.get("sessionEpoch")
    if (jwt_epoch is None and live_epoch != 1) or (jwt_epoch is not None and int(jwt_epoch) != live_epoch):
        raise ApprovalEngineError(
            401,
            "SESSION_REVOKED_PASSWORD_CHANGED",
            "Mật khẩu tài khoản vừa được thay đổi ở thiết bị khác. Vui lòng đăng nhập lại.",
        )

    if user_rec.get("disabled"):
        active_from = user_rec.get("activeFrom")
        activated = False
        if active_from and is_valid_iso_date(active_from):
            if now_vn().date() >= date.fromisoformat(active_from):
                user_rec["disabled"] = False
                user_rec.pop("activeFrom", None)
                if callable(save_auth_fn):
                    save_auth_fn(auth_data)
                activated = True
        if not activated:
            raise ApprovalEngineError(401, "ACCOUNT_INACTIVE", "Tài khoản đã bị vô hiệu hóa.")

    must_change_pw = bool(user_rec.get("mustChangePassword", False))
    if must_change_pw:
        eff_method = http_method
        eff_path = request_path
        if eff_method is None:
            try:
                from flask import has_request_context, request as _fl_req
                if has_request_context():
                    eff_method = _fl_req.method
                    eff_path = _fl_req.path or ""
            except Exception:
                eff_method = None
        if eff_method in ("POST", "PUT", "DELETE", "PATCH") and eff_path not in ("/api/auth/password", "/api/auth/logout"):
            raise ApprovalEngineError(
                403,
                "PASSWORD_CHANGE_REQUIRED",
                "Tài khoản đang dùng mật khẩu mặc định. Vui lòng đổi mật khẩu cá nhân trước khi thao tác.",
                {"mustChangePassword": True},
            )

    staff_id = user_rec.get("staffId", payload.get("staffId", 0))
    staff_list = (db or {}).get("staff") or []
    departed_list = (db or {}).get("departedStaff") or []

    if is_pos_int(staff_id):
        if any(isinstance(d, dict) and d.get("id") == staff_id for d in departed_list):
            raise ApprovalEngineError(401, "ACCOUNT_INACTIVE", "Nhân sự đã chuyển công tác / nghỉ việc.")
        staff_obj = next((s for s in staff_list if isinstance(s, dict) and s.get("id") == staff_id), None)
        if staff_obj is not None:
            if staff_obj.get("active") is False or str(staff_obj.get("status", "")).lower() == "inactive":
                raise ApprovalEngineError(401, "ACCOUNT_INACTIVE", "Hồ sơ nhân sự hiện không hoạt động.")
            live_role = str(staff_obj.get("role") or user_rec.get("role") or "")
            live_name = str(staff_obj.get("name") or user_rec.get("name") or username)
            live_title = str(staff_obj.get("title") or user_rec.get("title") or "")
        else:
            live_role = str(user_rec.get("role") or "")
            live_name = str(user_rec.get("name") or username)
            live_title = str(user_rec.get("title") or "")
    else:
        live_role = str(user_rec.get("role") or "")
        live_name = str(user_rec.get("name") or username)
        live_title = str(user_rec.get("title") or "")

    jwt_role = str(payload.get("role") or "")
    auth_account_role = str(user_rec.get("role") or "")
    if jwt_role and auth_account_role and jwt_role != auth_account_role:
        # Compare against auth.json account role (source of JWT claim) so display-role wording in db.json never causes false mismatch
        if jwt_role.strip().lower() != auth_account_role.strip().lower():
            raise ApprovalEngineError(401, "ACCOUNT_ROLE_CHANGED", "Vai trò tài khoản đã thay đổi. Vui lòng đăng nhập lại.")

    return {
        "sub": username,
        "username": username,
        "staffId": int(staff_id) if is_pos_int(staff_id) else 0,
        "name": live_name,
        "title": live_title,
        "role": live_role,
        "isAdmin": bool(user_rec.get("isAdmin", False)),
        "isSuperAdmin": bool(user_rec.get("isSuperAdmin", False)),
        "mustChangePassword": must_change_pw,
        "sessionEpoch": live_epoch,
    }


def resolve_effective_actor(
    real_user: dict,
    simulate_header: str,
    target_surgery: dict,
    db: dict,
    *,
    allow_sandbox_delegation_sim: bool = False,
) -> dict:
    """Allows X-Simulate-Staff-Id STRICTLY when real_user.isSuperAdmin == True AND (target_surgery.isTestSandboxCase == True OR sandbox delegation test in Canary/Demo sandbox mode)."""
    if not simulate_header or not str(simulate_header).strip():
        return real_user
    try:
        sim_id = int(str(simulate_header).strip())
    except ValueError:
        raise ApprovalEngineError(400, "INVALID_SIMULATED_STAFF", "X-Simulate-Staff-Id không hợp lệ.")

    if sim_id == real_user.get("staffId"):
        return real_user

    if not real_user.get("isSuperAdmin"):
        raise ApprovalEngineError(403, "FORBIDDEN", "Chỉ Super Admin mới có quyền giả lập vai trò thử nghiệm.")

    cfg = get_approval_config(db)
    is_valid_sandbox_target = isinstance(target_surgery, dict) and target_surgery.get("isTestSandboxCase") is True
    is_valid_del_sim = bool(
        allow_sandbox_delegation_sim
        and (cfg.get("rolloutAccessMode") == "superadmin_only" or cfg.get("sandboxOnlyMode") is True)
    )
    if not (is_valid_sandbox_target or is_valid_del_sim):
        raise ApprovalEngineError(
            403,
            "SANDBOX_ONLY_SIMULATION",
            "Chế độ giả lập vai trò chỉ áp dụng trên các ca mẫu thử nghiệm [TEST], không áp dụng trên ca lâm sàng thật.",
        )

    staff_obj = next((s for s in (db.get("staff") or []) if isinstance(s, dict) and s.get("id") == sim_id), None)
    if not staff_obj:
        raise ApprovalEngineError(404, "SIMULATED_STAFF_NOT_FOUND", f"Không tìm thấy nhân sự giả lập id={sim_id}.")

    return {
        "sub": f"sim_staff_{sim_id}_by_{real_user.get('username')}",
        "username": f"sim_{sim_id}",
        "staffId": sim_id,
        "name": staff_obj.get("name", f"Staff #{sim_id}"),
        "title": staff_obj.get("title", ""),
        "role": staff_obj.get("role", ""),
        "isAdmin": sim_id in (1, 2, 3),
        "isSuperAdmin": False,
        "isSimulated": True,
        "simulatedBySuperAdminStaffId": real_user.get("staffId"),
    }


def is_trainee_user(user: dict) -> bool:
    sid = (user or {}).get("staffId")
    role = str((user or {}).get("role") or "").lower()
    return (sid in TRAINEE_STAFF_IDS) or ("học viên" in role) or ("nội trú" in role)


def is_attending_user(user: dict) -> bool:
    sid = (user or {}).get("staffId")
    if sid in ATTENDING_STAFF_IDS:
        return True
    role = str((user or {}).get("role") or "")
    return ("Bác sĩ chính" in role or "Trưởng khoa" in role or "Phó trưởng khoa" in role) and not is_trainee_user(user)


def is_bcn_user(user: dict) -> bool:
    return (user or {}).get("staffId") in BCN_STAFF_IDS


# ───────────────────────── Dual WAL-First Hash-Chained Journals, Rotation & Pagination ─────────────────────────

def get_journal_path(data_dir: str) -> str:
    return os.path.join(data_dir, "surgery_approval_logs.jsonl")


def get_attribution_journal_path(data_dir: str) -> str:
    return os.path.join(data_dir, "surgery_attribution.jsonl")


def get_checkpoint_path(data_dir: str) -> str:
    return os.path.join(data_dir, "journal_checkpoint.json")


def get_archive_dir(data_dir: str) -> str:
    return os.path.join(data_dir, "journal_archive")


def compute_journal_entry_hash(entry_without_hash: dict) -> str:
    clean = {k: v for k, v in entry_without_hash.items() if k != "entryHash"}
    return sha256_hex(canonical_json(clean))


def _atomic_write_json_internal(path: str, payload: dict, mode: int = 0o600):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.tmp.{os.getpid()}"
    with open(tmp, "w", encoding="utf-8") as wf:
        json.dump(payload, wf, ensure_ascii=False, indent=2)
        wf.flush()
        os.fsync(wf.fileno())
    try:
        os.chmod(tmp, mode)
    except OSError:
        pass
    os.replace(tmp, path)


def load_or_init_journal_checkpoint(data_dir: str) -> dict:
    cp_path = get_checkpoint_path(data_dir)
    if os.path.isfile(cp_path):
        try:
            with open(cp_path, "r", encoding="utf-8") as rf:
                data = json.load(rf)
            if isinstance(data, dict):
                data.setdefault("approval", {"activeBaseSeq": 0, "activeGenesisHash": GENESIS_HASH, "segments": []})
                data.setdefault("attribution", {"activeBaseSeq": 0, "activeGenesisHash": GENESIS_HASH, "segments": []})
                data.setdefault("pendingRotation", None)
                return data
        except Exception as e:
            raise ApprovalEngineError(
                503,
                "AUDIT_CHECKPOINT_CORRUPTED",
                f"Không đọc được tệp journal_checkpoint.json (Fail-Closed): {e}",
            )
    return {
        "schemaVersion": 1,
        "approval": {"activeBaseSeq": 0, "activeGenesisHash": GENESIS_HASH, "segments": []},
        "attribution": {"activeBaseSeq": 0, "activeGenesisHash": GENESIS_HASH, "segments": []},
        "pendingRotation": None,
    }


def compute_recursive_changed_fields(before_obj, after_obj):
    """
    Computes exact recursive delta between before_obj and after_obj.
    Deleted dict keys emit {"__op__": "delete_key"} so replay restores 100% identical structures.
    Lists and scalars replace atomically.
    """
    if isinstance(before_obj, dict) and isinstance(after_obj, dict):
        delta = {}
        all_keys = set(before_obj.keys()) | set(after_obj.keys())
        for k in sorted(all_keys):
            if k not in after_obj:
                delta[k] = {"__op__": "delete_key"}
            elif k not in before_obj:
                delta[k] = copy.deepcopy(after_obj[k])
            else:
                sub = compute_recursive_changed_fields(before_obj[k], after_obj[k])
                if sub is not None:
                    delta[k] = sub
        return delta if delta else None
    if before_obj != after_obj:
        return copy.deepcopy(after_obj)
    return None


def apply_recursive_changed_fields(base_obj: dict, delta_obj: dict) -> dict:
    """Applies recursive delta (including {"__op__": "delete_key"}) onto base_obj deterministically."""
    if not isinstance(delta_obj, dict):
        return copy.deepcopy(delta_obj)
    out = copy.deepcopy(base_obj) if isinstance(base_obj, dict) else {}
    for k, v in delta_obj.items():
        if isinstance(v, dict) and v.get("__op__") == "delete_key":
            out.pop(k, None)
        elif isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = apply_recursive_changed_fields(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out


def format_doctor_full_name(actor: dict) -> str:
    title = str((actor or {}).get("title") or "").strip()
    name = str((actor or {}).get("name") or (actor or {}).get("username") or "").strip()
    if title and name and not name.lower().startswith(title.lower()):
        return f"{title} {name}"
    return name or "Bác sĩ"


def record_contributor_on_surgery(
    surgery: dict,
    actor: dict,
    *,
    role_in_case: str,
    action_type: str,
    timestamp_iso: str,
    source_key: str = None,
) -> None:
    """
    Updates surgery['preparationContributors'] cleanly (1 entry per distinct staffId, chronological by firstTouchedAt).
    Deduplicates replay via _lastAppliedSourceKey without storing unbounded event arrays in db.json!
    """
    if not isinstance(surgery, dict) or not isinstance(actor, dict):
        return
    staff_id = actor.get("staffId")
    if not is_pos_int(staff_id):
        return
    contribs = surgery.setdefault("preparationContributors", [])
    existing = next((c for c in contribs if isinstance(c, dict) and c.get("staffId") == int(staff_id)), None)
    full_name = format_doctor_full_name(actor)
    uname = str(actor.get("username") or actor.get("sub") or "")
    if existing is None:
        contribs.append({
            "staffId": int(staff_id),
            "username": uname,
            "fullNameWithDegree": full_name,
            "roleInCase": role_in_case,
            "firstTouchedAt": timestamp_iso,
            "lastTouchedAt": timestamp_iso,
            "touchCount": 1,
            "lastActionType": action_type,
            "_lastSourceKey": source_key,
        })
    else:
        if source_key and existing.get("_lastSourceKey") == source_key:
            return
        existing["username"] = uname or existing.get("username", "")
        existing["fullNameWithDegree"] = full_name or existing.get("fullNameWithDegree", "")
        existing["roleInCase"] = role_in_case or existing.get("roleInCase", "")
        existing["lastTouchedAt"] = timestamp_iso
        existing["touchCount"] = int(existing.get("touchCount", 1) or 1) + 1
        existing["lastActionType"] = action_type
        if source_key:
            existing["_lastSourceKey"] = source_key


def read_last_valid_jsonl_record_adaptive(path: str, *, initial_window: int = 65536, truncate_torn: bool = True) -> tuple:
    """
    Adaptive O(last_line) backward tail scanner:
      - Expands window 64 KiB -> 128 KiB -> 256 KiB ... to BOF so valid lines > 64 KiB are NEVER misclassified as torn!
      - If the final line is genuinely torn (missing trailing newline or invalid JSON/hash), truncates torn bytes + fsync
        and returns (last_valid_entry_or_None, True).
      - Raises ApprovalEngineError(503, 'AUDIT_CHAIN_CORRUPTED', ...) if a complete newline-terminated line is corrupted.
    """
    if not os.path.isfile(path):
        return None, False
    size = os.path.getsize(path)
    if size == 0:
        return None, False

    truncated_torn = False
    with open(path, "rb+") as bf:
        bf.seek(size - 1)
        ends_with_nl = (bf.read(1) == b"\n")

        if not ends_with_nl:
            # Locate the start of the trailing incomplete chunk by expanding backwards
            win = min(initial_window, size)
            while True:
                pos = max(0, size - win)
                bf.seek(pos)
                buf = bf.read(size - pos)
                nl_idx = buf.rfind(b"\n")
                if nl_idx >= 0 or pos == 0:
                    last_start = (pos + nl_idx + 1) if nl_idx >= 0 else 0
                    torn_bytes = buf[nl_idx + 1:] if nl_idx >= 0 else buf
                    is_torn = False
                    try:
                        parsed_tail = json.loads(torn_bytes.decode("utf-8"))
                        if parsed_tail.get("entryHash") != compute_journal_entry_hash(parsed_tail):
                            is_torn = True
                    except Exception:
                        is_torn = True
                    if is_torn and truncate_torn:
                        bf.seek(last_start)
                        bf.truncate(last_start)
                        bf.flush()
                        os.fsync(bf.fileno())
                        truncated_torn = True
                        size = last_start
                    elif not is_torn and truncate_torn:
                        # Valid JSON + hash missing only '\n': heal trailing newline cleanly
                        bf.seek(size)
                        bf.write(b"\n")
                        bf.flush()
                        os.fsync(bf.fileno())
                        size += 1
                    break
                win = min(size, win * 2)

        if size == 0:
            return None, truncated_torn

        # Now size > 0 and file ends cleanly with '\n'. Expand window until we find the preceding '\n' or BOF (pos == 0).
        win = min(initial_window, size)
        while True:
            pos = max(0, size - win)
            bf.seek(pos)
            buf = bf.read(size - pos)
            # Strip trailing '\n'
            body = buf[:-1] if buf.endswith(b"\n") else buf
            prev_nl = body.rfind(b"\n")
            if prev_nl >= 0 or pos == 0:
                line_bytes = body[prev_nl + 1:] if prev_nl >= 0 else body
                if not line_bytes.strip():
                    return None, truncated_torn
                try:
                    obj = json.loads(line_bytes.decode("utf-8"))
                except Exception as e:
                    raise ApprovalEngineError(
                        503,
                        "AUDIT_CHAIN_CORRUPTED",
                        f"Dòng cuối sổ nhật ký không đọc được JSON hợp lệ: {e}",
                    )
                if obj.get("entryHash") != compute_journal_entry_hash(obj):
                    raise ApprovalEngineError(
                        503,
                        "AUDIT_CHAIN_CORRUPTED",
                        "Mã băm entryHash ở dòng cuối sổ nhật ký không khớp.",
                    )
                return obj, truncated_torn
            win = min(size, win * 2)


def verify_journal_stream_streaming(
    journal_path: str,
    *,
    expected_start_seq: int = 1,
    expected_genesis_hash: str = GENESIS_HASH,
    seq_field: str = "eventSeq",
    collect_entries: bool = True,
):
    """
    Streaming SHA-256 hash-chain verifier supporting rotated base sequences & .jsonl.gz files.
    When collect_entries=False, uses O(single_line) RAM even on 500 MB journals!
    """
    if not os.path.isfile(journal_path):
        return True, ([] if collect_entries else None), None, 0, expected_genesis_hash

    entries = [] if collect_entries else None
    expected_seq = int(expected_start_seq)
    expected_prev = str(expected_genesis_hash or GENESIS_HASH)
    count = 0
    opener = gzip.open if journal_path.endswith(".gz") else open

    with opener(journal_path, "rt", encoding="utf-8") as f:
        for line_no, raw in enumerate(f, start=1):
            stripped = raw.strip()
            if not stripped:
                continue
            try:
                obj = json.loads(stripped)
            except json.JSONDecodeError as e:
                return False, entries, {
                    "line": line_no,
                    "reason": "INVALID_JSON",
                    "detail": str(e),
                    "hasNewline": raw.endswith("\n"),
                }, count, expected_prev
            seq = obj.get(seq_field)
            prev_h = obj.get("prevHash")
            entry_h = obj.get("entryHash")
            computed = compute_journal_entry_hash(obj)
            if seq != expected_seq or prev_h != expected_prev or entry_h != computed:
                return False, entries, {
                    "line": line_no,
                    seq_field: seq,
                    "expectedSeq": expected_seq,
                    "reason": "HASH_OR_SEQ_MISMATCH",
                    "prevHashMatch": prev_h == expected_prev,
                    "entryHashMatch": entry_h == computed,
                    "hasNewline": raw.endswith("\n"),
                }, count, expected_prev
            if collect_entries:
                entries.append(obj)
            count += 1
            expected_seq += 1
            expected_prev = entry_h

    return True, entries, None, count, expected_prev


def verify_approval_journal_chain(journal_path: str, checkpoint: dict = None):
    """Verify full SHA-256 hash chain and sequential eventSeq of surgery_approval_logs.jsonl (rotation-aware)."""
    data_dir = os.path.dirname(os.path.abspath(journal_path))
    cp = checkpoint if isinstance(checkpoint, dict) else (
        load_or_init_journal_checkpoint(data_dir) if os.path.isfile(get_checkpoint_path(data_dir)) else None
    )
    base_seq = int(((cp or {}).get("approval") or {}).get("activeBaseSeq", 0) or 0)
    genesis_h = str(((cp or {}).get("approval") or {}).get("activeGenesisHash") or GENESIS_HASH)
    ok, entries, err, _, _ = verify_journal_stream_streaming(
        journal_path,
        expected_start_seq=base_seq + 1,
        expected_genesis_hash=genesis_h,
        seq_field="eventSeq",
        collect_entries=True,
    )
    return ok, (entries or []), err


def verify_attribution_journal_chain(attr_path: str, checkpoint: dict = None):
    """Verify full SHA-256 hash chain and sequential attributionSeq of surgery_attribution.jsonl (rotation-aware)."""
    data_dir = os.path.dirname(os.path.abspath(attr_path))
    cp = checkpoint if isinstance(checkpoint, dict) else (
        load_or_init_journal_checkpoint(data_dir) if os.path.isfile(get_checkpoint_path(data_dir)) else None
    )
    base_seq = int(((cp or {}).get("attribution") or {}).get("activeBaseSeq", 0) or 0)
    genesis_h = str(((cp or {}).get("attribution") or {}).get("activeGenesisHash") or GENESIS_HASH)
    ok, entries, err, _, _ = verify_journal_stream_streaming(
        attr_path,
        expected_start_seq=base_seq + 1,
        expected_genesis_hash=genesis_h,
        seq_field="attributionSeq",
        collect_entries=True,
    )
    return ok, (entries or []), err


def _quarter_label(dt: datetime = None) -> str:
    d = dt or now_vn()
    q = ((d.month - 1) // 3) + 1
    return f"{d.year}-Q{q}"


def _complete_pending_rotation_if_any(data_dir: str, cp: dict) -> bool:
    pending = cp.get("pendingRotation")
    if not isinstance(pending, dict):
        return False

    stream_key = pending["streamKey"]
    hot_path = get_journal_path(data_dir) if stream_key == "approval" else get_attribution_journal_path(data_dir)
    staging_path = pending["stagingPath"]
    gz_path = pending["archiveGzPath"]
    sha_path = gz_path + ".sha256"
    os.makedirs(os.path.dirname(gz_path), exist_ok=True)

    # Step R2: If staging raw exists and gz/sha not yet finalized, write gz + sha256
    if os.path.isfile(staging_path) and (not os.path.isfile(gz_path) or not os.path.isfile(sha_path)):
        tmp_gz = gz_path + f".tmp.{os.getpid()}"
        with open(staging_path, "rb") as rf, gzip.open(tmp_gz, "wb", compresslevel=6) as gf:
            shutil.copyfileobj(rf, gf)
        with open(tmp_gz, "rb") as gf_check:
            digest = hashlib.sha256(gf_check.read()).hexdigest()
        os.chmod(tmp_gz, 0o600)
        os.replace(tmp_gz, gz_path)
        tmp_sha = sha_path + f".tmp.{os.getpid()}"
        with open(tmp_sha, "w", encoding="utf-8") as sf:
            sf.write(f"{digest}  {os.path.basename(gz_path)}\n")
            sf.flush()
            os.fsync(sf.fileno())
        os.chmod(tmp_sha, 0o600)
        os.replace(tmp_sha, sha_path)

    # Step R3: Update checkpoint activeBaseSeq / activeGenesisHash & create fresh empty hot file if hot still points to old file
    stream_meta = cp.setdefault(stream_key, {"activeBaseSeq": 0, "activeGenesisHash": GENESIS_HASH, "segments": []})
    seg_info = {
        "fileName": os.path.basename(gz_path),
        "quarter": pending["quarter"],
        "startSeq": pending["startSeq"],
        "endSeq": pending["endSeq"],
        "genesisHash": pending["genesisHash"],
        "headHash": pending["headHash"],
        "rotatedAt": pending["startedAt"],
    }
    if not any(s.get("fileName") == seg_info["fileName"] for s in stream_meta.get("segments", [])):
        stream_meta.setdefault("segments", []).append(seg_info)
    stream_meta["activeBaseSeq"] = pending["endSeq"]
    stream_meta["activeGenesisHash"] = pending["headHash"]

    if os.path.isfile(hot_path):
        tail_rec, _ = read_last_valid_jsonl_record_adaptive(hot_path, truncate_torn=True)
        seq_field = "eventSeq" if stream_key == "approval" else "attributionSeq"
        if tail_rec and int(tail_rec.get(seq_field, 0)) == int(pending["endSeq"]):
            fd = os.open(hot_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            try:
                os.fsync(fd)
            finally:
                os.close(fd)

    # Step R4: Remove staging file & clear pendingRotation
    if os.path.isfile(staging_path):
        try:
            os.remove(staging_path)
        except OSError:
            pass
    cp["pendingRotation"] = None
    _atomic_write_json_internal(get_checkpoint_path(data_dir), cp)
    return True


def rotate_journal_stream(data_dir: str, stream_key: str, *, quarter_override: str = None) -> dict:
    """
    4-Step Crash-Safe Sequence-Range Journal Rotation (R1..R4):
      <stem>.<YYYY-QN>.seq_<startSeq:09d>_<endSeq:09d>.jsonl.gz + .sha256
    Prevents any filename collision even when rotating multiple times within the same quarter.
    """
    if stream_key not in ("approval", "attribution"):
        raise ValueError(f"Unsupported stream_key: {stream_key}")
    cp = load_or_init_journal_checkpoint(data_dir)
    _complete_pending_rotation_if_any(data_dir, cp)

    hot_path = get_journal_path(data_dir) if stream_key == "approval" else get_attribution_journal_path(data_dir)
    if not os.path.isfile(hot_path) or os.path.getsize(hot_path) == 0:
        return {"rotated": False}

    seq_field = "eventSeq" if stream_key == "approval" else "attributionSeq"
    stream_meta = cp.setdefault(stream_key, {"activeBaseSeq": 0, "activeGenesisHash": GENESIS_HASH, "segments": []})
    start_seq = int(stream_meta.get("activeBaseSeq", 0) or 0) + 1
    genesis_h = str(stream_meta.get("activeGenesisHash") or GENESIS_HASH)

    tail_rec, _ = read_last_valid_jsonl_record_adaptive(hot_path, truncate_torn=True)
    if not tail_rec:
        return {"rotated": False}
    ok, _, err, count, head_hash = verify_journal_stream_streaming(
        hot_path,
        expected_start_seq=start_seq,
        expected_genesis_hash=genesis_h,
        seq_field=seq_field,
        collect_entries=False,
    )
    if not ok or count == 0:
        raise ApprovalEngineError(503, "AUDIT_CHAIN_CORRUPTED", "Không thể xoay sổ khi chuỗi băm đang lỗi.", {"chainError": err})

    end_seq = int(tail_rec[seq_field])
    q_label = quarter_override or _quarter_label()
    stem = "surgery_approval_logs" if stream_key == "approval" else "surgery_attribution"
    archive_dir = get_archive_dir(data_dir)
    staging_dir = os.path.join(data_dir, ".rotation_staging")
    os.makedirs(archive_dir, exist_ok=True)
    os.makedirs(staging_dir, exist_ok=True)

    seg_name = f"{stem}.{q_label}.seq_{start_seq:09d}_{end_seq:09d}.jsonl.gz"
    gz_path = os.path.join(archive_dir, seg_name)
    staging_path = os.path.join(staging_dir, f"{stem}.seq_{start_seq:09d}_{end_seq:09d}.raw.jsonl")

    # Step R1: Move/copy hot file to staging and record pendingRotation in checkpoint before truncating hot file
    shutil.copy2(hot_path, staging_path)
    cp["pendingRotation"] = {
        "streamKey": stream_key,
        "quarter": q_label,
        "startSeq": start_seq,
        "endSeq": end_seq,
        "genesisHash": genesis_h,
        "headHash": head_hash,
        "stagingPath": staging_path,
        "archiveGzPath": gz_path,
        "startedAt": now_vn_iso(),
    }
    _atomic_write_json_internal(get_checkpoint_path(data_dir), cp)

    # Steps R2..R4
    _complete_pending_rotation_if_any(data_dir, cp)
    return {
        "rotated": True,
        "streamKey": stream_key,
        "segmentFile": seg_name,
        "startSeq": start_seq,
        "endSeq": end_seq,
        "headHash": head_hash,
    }


def maybe_rotate_journals_under_lock(data_dir: str, db: dict = None, *, max_bytes: int = None) -> list:
    cfg = get_approval_config(db or {})
    limit_bytes = int(max_bytes if max_bytes is not None else (cfg.get("journalRotateMaxBytes") or (50 * 1024 * 1024)))
    cp = load_or_init_journal_checkpoint(data_dir)
    _complete_pending_rotation_if_any(data_dir, cp)

    rotated_reports = []
    if limit_bytes > 0:
        for skey, pth in (("approval", get_journal_path(data_dir)), ("attribution", get_attribution_journal_path(data_dir))):
            if os.path.isfile(pth) and os.path.getsize(pth) >= limit_bytes:
                rep = rotate_journal_stream(data_dir, skey)
                if rep.get("rotated"):
                    rotated_reports.append(rep)
    return rotated_reports


def _append_jsonl_record_fsync(path: str, entry: dict):
    is_new = not os.path.exists(path)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    try:
        line_bytes = (canonical_json(entry) + "\n").encode("utf-8")
        os.write(fd, line_bytes)
        os.fsync(fd)
    finally:
        os.close(fd)
    if is_new:
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass


def reconcile_dual_journals_and_db(db: dict, data_dir: str) -> dict:
    """
    Crash-Consistent Dual-Journal Recovery & Replay Coordinator (S1 -> S2 -> S3):
      1. Completes any interrupted pendingRotation (R1..R4).
      2. Truncates torn EOF tails (adaptive >64 KiB window) on both journals.
      3. Fail-Closed 503 AUDIT_JOURNAL_BEHIND_DB if WAL lags behind db['_lastApprovalJournalSeq'] without valid rotation checkpoint.
      4. Replays committed S1 events > db['_lastApprovalJournalSeq'] onto db (both surgery_upsert and surgery_delta changedFields).
      5. Reconciles missing S2 attribution records from S1 embeddedAttributionBatch[] deduplicated by (sourceWalEventId, attrSubIndex)
         and updates surgery['preparationContributors'] + surgery['lastAttributionSeq'] idempotently (Replay #1 == Replay #2).
    """
    os.makedirs(data_dir, exist_ok=True)
    cp = load_or_init_journal_checkpoint(data_dir)
    resumed_rotation = _complete_pending_rotation_if_any(data_dir, cp)

    app_path = get_journal_path(data_dir)
    attr_path = get_attribution_journal_path(data_dir)

    app_tail, app_torn = read_last_valid_jsonl_record_adaptive(app_path, truncate_torn=True)
    attr_tail, attr_torn = read_last_valid_jsonl_record_adaptive(attr_path, truncate_torn=True)

    cp_app = cp.get("approval") or {}
    cp_attr = cp.get("attribution") or {}
    app_base_seq = int(cp_app.get("activeBaseSeq", 0) or 0)
    app_genesis = str(cp_app.get("activeGenesisHash") or GENESIS_HASH)
    attr_base_seq = int(cp_attr.get("activeBaseSeq", 0) or 0)
    attr_genesis = str(cp_attr.get("activeGenesisHash") or GENESIS_HASH)

    max_rec_seq = max(
        [
            int(s.get("lastJournalSeq", 0) or 0)
            for s in ((db.get("surgeries") or []) + (db.get("surgeriesTrash") or []))
            if isinstance(s, dict)
        ]
        or [0]
    )
    db_last_seq = max(int(db.get("_lastApprovalJournalSeq", 0) or 0), max_rec_seq)
    db_last_hash = db.get("_lastApprovalJournalHash")
    eff_app_seq = int(app_tail["eventSeq"]) if app_tail else app_base_seq
    eff_app_hash = app_tail["entryHash"] if app_tail else app_genesis

    if db_last_seq > eff_app_seq:
        raise ApprovalEngineError(
            503,
            "AUDIT_JOURNAL_BEHIND_DB",
            "Sổ nhật ký duyệt mổ đang lùi sau trạng thái db.json mà không có checkpoint xoay sổ hợp lệ (Fail-Closed).",
            {"dbLastApprovalJournalSeq": db_last_seq, "journalHeadSeq": eff_app_seq},
        )
    if db_last_seq > 0 and db_last_seq == eff_app_seq and db_last_hash and db_last_hash != eff_app_hash:
        raise ApprovalEngineError(
            503,
            "AUDIT_JOURNAL_BEHIND_DB",
            "Mã băm đầu sổ nhật ký không khớp với db.json / checkpoint xoay sổ (Fail-Closed).",
        )

    report = {
        "truncatedTornTail": bool(app_torn or attr_torn),
        "truncatedApprovalTail": bool(app_torn),
        "truncatedAttributionTail": bool(attr_torn),
        "resumedRotation": resumed_rotation,
        "replayedEvents": 0,
        "replayedAttributionEvents": 0,
        "chainValid": True,
        "chainError": None,
    }

    db_last_attr_seq = int(db.get("_lastAttributionJournalSeq", 0) or 0)
    curr_attr_seq = int(attr_tail["attributionSeq"]) if attr_tail else attr_base_seq
    curr_attr_hash = attr_tail["entryHash"] if attr_tail else attr_genesis
    tail_tx_id = (app_tail.get("txEventId") or app_tail.get("eventId")) if app_tail else None
    tail_has_unflushed_attr = bool(
        app_tail
        and (app_tail.get("embeddedAttributionBatch") or [])
        and (attr_tail is None or attr_tail.get("sourceWalEventId") != tail_tx_id)
    )
    need_replay = (
        (eff_app_seq > db_last_seq)
        or (curr_attr_seq != db_last_attr_seq)
        or tail_has_unflushed_attr
    )

    # Verify active chains only if non-empty (streaming O(1) RAM when need_replay is False!)
    if app_tail is not None:
        ok_app, app_entries, err_app, _, _ = verify_journal_stream_streaming(
            app_path,
            expected_start_seq=app_base_seq + 1,
            expected_genesis_hash=app_genesis,
            seq_field="eventSeq",
            collect_entries=need_replay,
        )
        report["chainValid"] = ok_app
        report["chainError"] = err_app
        if not ok_app:
            raise ApprovalEngineError(
                503,
                "AUDIT_CHAIN_CORRUPTED",
                "Phát hiện chuỗi băm Sổ nhật ký duyệt mổ bị gián đoạn hoặc can thiệp.",
                {"chainError": err_app},
            )
    else:
        app_entries = []

    # Check if attribution journal needs catch-up from S1 embeddedAttributionBatch (e.g., crash between S1 and S2)
    existing_attr_keys = set()
    if attr_tail is not None:
        ok_at, attr_entries, err_at, _, _ = verify_journal_stream_streaming(
            attr_path,
            expected_start_seq=attr_base_seq + 1,
            expected_genesis_hash=attr_genesis,
            seq_field="attributionSeq",
            collect_entries=bool(need_replay or app_entries),
        )
        if not ok_at:
            raise ApprovalEngineError(
                503,
                "AUDIT_CHAIN_CORRUPTED",
                "Phát hiện chuỗi băm Sổ nhật ký trách nhiệm bị gián đoạn hoặc can thiệp.",
                {"chainError": err_at},
            )
        for ae in (attr_entries or []):
            if ae.get("sourceWalEventId") is not None:
                existing_attr_keys.add((ae.get("sourceWalEventId"), int(ae.get("attrSubIndex", 0))))

    surgeries = db.setdefault("surgeries", [])
    trash = db.setdefault("surgeriesTrash", [])
    notifs = db.setdefault("notifications", [])
    idem_store = db.setdefault("_approvalIdempotency", {})
    existing_event_ids = {n.get("sourceEventId") for n in notifs if isinstance(n, dict) and n.get("sourceEventId")}

    # Replay all S1 entries where eventSeq > db_last_seq OR where embeddedAttributionBatch was not yet flushed to S2
    for entry in (app_entries or []):
        seq = int(entry["eventSeq"])
        tx_id = entry.get("txEventId") or entry.get("eventId")
        embedded_batch = entry.get("embeddedAttributionBatch") or []

        # Ensure S2 has all embeddedAttributionBatch entries from this S1 entry (handles crash between S1 & S2)
        last_attr_seq_for_entry = None
        for raw_attr in embedded_batch:
            sub_idx = int(raw_attr.get("attrSubIndex", 0))
            dedup_k = (tx_id, sub_idx)
            if dedup_k not in existing_attr_keys:
                curr_attr_seq += 1
                attr_rec = copy.deepcopy(raw_attr)
                attr_rec.pop("entryHash", None)
                attr_rec["attributionSeq"] = curr_attr_seq
                attr_rec["sourceWalEventId"] = tx_id
                attr_rec["sourceWalSeq"] = seq
                attr_rec["prevHash"] = curr_attr_hash
                attr_rec["entryHash"] = compute_journal_entry_hash(attr_rec)
                _append_jsonl_record_fsync(attr_path, attr_rec)
                curr_attr_hash = attr_rec["entryHash"]
                existing_attr_keys.add(dedup_k)
                last_attr_seq_for_entry = curr_attr_seq
                report["replayedAttributionEvents"] += 1

        if seq <= db_last_seq:
            continue

        patch = entry.get("committedStatePatch") or {}
        kind = patch.get("patchKind")
        sid = entry.get("surgeryId")

        if kind == "surgery_upsert" and isinstance(patch.get("surgeryRecord"), dict):
            rec = copy.deepcopy(patch["surgeryRecord"])
            rec["lastJournalSeq"] = seq
            if last_attr_seq_for_entry is not None:
                rec["lastAttributionSeq"] = max(int(rec.get("lastAttributionSeq", 0) or 0), last_attr_seq_for_entry)
            for raw_attr in embedded_batch:
                a_obj = raw_attr.get("actor") or entry.get("actor") or {}
                record_contributor_on_surgery(
                    rec,
                    a_obj,
                    role_in_case=raw_attr.get("actorRoleInCase", "attending"),
                    action_type=raw_attr.get("actionType", entry.get("action", "edit")),
                    timestamp_iso=raw_attr.get("timestamp", entry.get("timestamp", now_vn_iso())),
                    source_key=f"{tx_id}:{int(raw_attr.get('attrSubIndex', 0))}",
                )
            idx = next((i for i, s in enumerate(surgeries) if isinstance(s, dict) and s.get("id") == sid), -1)
            if idx >= 0:
                surgeries[idx] = rec
            else:
                surgeries.append(rec)
            if patch.get("removeFromTrash"):
                db["surgeriesTrash"] = [t for t in trash if not (isinstance(t, dict) and t.get("id") == sid)]
                trash = db["surgeriesTrash"]
        elif kind in ("surgery_delta", "surgery_field_delta") and isinstance(patch.get("changedFields"), dict):
            idx = next((i for i, s in enumerate(surgeries) if isinstance(s, dict) and s.get("id") == sid), -1)
            base_rec = surgeries[idx] if idx >= 0 else {"id": sid}
            rec = apply_recursive_changed_fields(base_rec, patch["changedFields"])
            rec["lastJournalSeq"] = seq
            for raw_attr in embedded_batch:
                a_obj = raw_attr.get("actor") or entry.get("actor") or {}
                record_contributor_on_surgery(
                    rec,
                    a_obj,
                    role_in_case=raw_attr.get("actorRoleInCase", "attending"),
                    action_type=raw_attr.get("actionType", entry.get("action", "edit")),
                    timestamp_iso=raw_attr.get("timestamp", entry.get("timestamp", now_vn_iso())),
                    source_key=f"{tx_id}:{int(raw_attr.get('attrSubIndex', 0))}",
                )
            if last_attr_seq_for_entry is not None:
                rec["lastAttributionSeq"] = max(int(rec.get("lastAttributionSeq", 0) or 0), last_attr_seq_for_entry)
            elif embedded_batch and curr_attr_seq > 0:
                rec["lastAttributionSeq"] = max(int(rec.get("lastAttributionSeq", 0) or 0), curr_attr_seq)
            stamp_badge_fields(rec)
            if idx >= 0:
                surgeries[idx] = rec
            else:
                surgeries.append(rec)
        elif kind == "surgery_trash" and isinstance(patch.get("trashRecord"), dict):
            db["surgeries"] = [s for s in surgeries if not (isinstance(s, dict) and s.get("id") == sid)]
            surgeries = db["surgeries"]
            t_rec = copy.deepcopy(patch["trashRecord"])
            t_rec["lastJournalSeq"] = seq
            t_idx = next((i for i, t in enumerate(trash) if isinstance(t, dict) and t.get("id") == sid), -1)
            if t_idx >= 0:
                trash[t_idx] = t_rec
            else:
                trash.append(t_rec)
        elif kind == "trash_purge":
            db["surgeriesTrash"] = [t for t in trash if not (isinstance(t, dict) and t.get("id") == sid)]
            trash = db["surgeriesTrash"]
        elif kind == "delegation_upsert" and isinstance(patch.get("delegationRecord"), dict):
            dels = db.setdefault("approvalDelegations", [])
            d_rec = copy.deepcopy(patch["delegationRecord"])
            d_idx = next((i for i, d in enumerate(dels) if isinstance(d, dict) and d.get("delegationId") == d_rec.get("delegationId")), -1)
            if d_idx >= 0:
                dels[d_idx] = d_rec
            else:
                dels.append(d_rec)
        elif kind == "config_update" and isinstance(patch.get("configRecord"), dict):
            db["surgeryApprovalConfig"] = copy.deepcopy(patch["configRecord"])

        for n in entry.get("committedNotifications") or []:
            if isinstance(n, dict) and n.get("sourceEventId") not in existing_event_ids:
                notifs.append(copy.deepcopy(n))
                if n.get("sourceEventId"):
                    existing_event_ids.add(n["sourceEventId"])

        idem_rec = entry.get("idempotencyRecord")
        if isinstance(idem_rec, dict) and idem_rec.get("scopeKey") and isinstance(idem_rec.get("value"), dict):
            idem_val = copy.deepcopy(idem_rec["value"])
            # Rehydrate surgery snapshot on draft idempotent replay if lightweight delta was stored in WAL
            if (
                isinstance(idem_val.get("responseSnapshot"), dict)
                and idem_val["responseSnapshot"].get("_rehydrateSurgeryId") == sid
            ):
                cur_s = next((s for s in surgeries if isinstance(s, dict) and s.get("id") == sid), None)
                snap_copy = copy.deepcopy(idem_val["responseSnapshot"])
                snap_copy.pop("_rehydrateSurgeryId", None)
                if cur_s is not None:
                    snap_copy["surgery"] = copy.deepcopy(cur_s)
                snap_copy["journalSeq"] = seq
                idem_val["responseSnapshot"] = snap_copy
            idem_store[idem_rec["scopeKey"]] = idem_val

        db["_lastApprovalJournalSeq"] = seq
        db["_lastApprovalJournalHash"] = entry["entryHash"]
        report["replayedEvents"] += 1

    if curr_attr_seq > int(db.get("_lastAttributionJournalSeq", 0) or 0):
        db["_lastAttributionJournalSeq"] = curr_attr_seq
        db["_lastAttributionJournalHash"] = curr_attr_hash

    if report["replayedEvents"] > 0 or report["replayedAttributionEvents"] > 0:
        revs = db.setdefault("_revisions", {})
        revs["surgeries"] = int(revs.get("surgeries", 1)) + 1
        revs["notifications"] = int(revs.get("notifications", 1)) + 1

    return report


def reconcile_journal_and_db(db: dict, journal_path: str) -> dict:
    """Backward-compatible wrapper invoking full Dual-Journal Crash Recovery."""
    data_dir = os.path.dirname(os.path.abspath(journal_path))
    return reconcile_dual_journals_and_db(db, data_dir)


def append_dual_wal_transaction(
    data_dir: str,
    db: dict,
    *,
    action: str,
    actor: dict,
    surgery_id=None,
    case_rev_before=None,
    case_rev_after=None,
    delegation_id=None,
    summary: dict = None,
    committed_state_patch: dict = None,
    committed_notifications: list = None,
    idempotency_record: dict = None,
    attribution_specs: list = None,
    attribution_Specs: list = None,
) -> tuple:
    """
    Executes Steps S1 & S2 of the 3-Step Dual-Journal Atomic Write Coordinator (under _DB_LOCK_FILE):
      Step S1: Append + fsync to surgery_approval_logs.jsonl (with txEventId, changedFields, embeddedAttributionBatch).
      Step S2: Append + fsync to surgery_attribution.jsonl (with sourceWalEventId=txEventId, attrSubIndex).
    Returns (approval_entry, attribution_entries).
    """
    if TEST_FAULT_HOOKS.get("fail_journal_write"):
        raise ApprovalEngineError(503, "AUDIT_WRITE_FAILED", "Không thể ghi Sổ nhật ký chuỗi băm (Fail-Closed).")

    os.makedirs(data_dir, exist_ok=True)
    maybe_rotate_journals_under_lock(data_dir, db)
    cp = load_or_init_journal_checkpoint(data_dir)

    app_path = get_journal_path(data_dir)
    attr_path = get_attribution_journal_path(data_dir)

    app_tail, _ = read_last_valid_jsonl_record_adaptive(app_path, truncate_torn=True)
    attr_tail, _ = read_last_valid_jsonl_record_adaptive(attr_path, truncate_torn=True)

    cp_app = cp.get("approval") or {}
    cp_attr = cp.get("attribution") or {}

    prev_hash = app_tail["entryHash"] if app_tail else str(cp_app.get("activeGenesisHash") or GENESIS_HASH)
    next_seq = (int(app_tail["eventSeq"]) + 1) if app_tail else (int(cp_app.get("activeBaseSeq", 0) or 0) + 1)

    tx_event_id = str(uuid.uuid4())
    ts_now = now_vn_iso()

    actor_meta = {
        "staffId": actor.get("staffId"),
        "username": actor.get("username") or actor.get("sub"),
        "name": actor.get("name"),
        "title": actor.get("title", ""),
        "fullNameWithDegree": format_doctor_full_name(actor),
        "role": actor.get("role"),
        "isSimulated": bool(actor.get("isSimulated") or actor.get("simulatedBySuperAdminStaffId")),
        "simulatedBySuperAdminStaffId": actor.get("simulatedBySuperAdminStaffId"),
    }

    effective_specs = attribution_specs if attribution_specs is not None else attribution_Specs
    embedded_batch = []
    for sub_idx, spec in enumerate(effective_specs or []):
        if not isinstance(spec, dict):
            continue
        det_id = str(uuid.uuid5(ATTRIBUTION_UUID_NS, f"{tx_event_id}:{sub_idx}"))
        embedded_batch.append({
            "attributionId": det_id,
            "attrSubIndex": sub_idx,
            "sourceWalEventId": tx_event_id,
            "surgeryId": surgery_id,
            "episodeId": spec.get("episodeId"),
            "caseRevisionBefore": case_rev_before,
            "caseRevisionAfter": case_rev_after,
            "timestamp": ts_now,
            "actor": copy.deepcopy(actor_meta),
            "actorRoleInCase": spec.get("actorRoleInCase", "attending"),
            "roleContextSource": spec.get("roleContextSource", "server_roster"),
            "attestationScope": spec.get("attestationScope"),
            "actionType": spec.get("actionType", action),
            "touchedSections": spec.get("touchedSections") or [],
            "invalidatedChecklistCodes": spec.get("invalidatedChecklistCodes") or [],
            "snapshotDigest": spec.get("snapshotDigest"),
            "proxyMeta": spec.get("proxyMeta"),
        })

    # Compact idempotencyRecord inside WAL on draft saves so we never store duplicate full surgeryRecord copies
    wal_idem = None
    if isinstance(idempotency_record, dict):
        wal_idem = copy.deepcopy(idempotency_record)
        snap = (wal_idem.get("value") or {}).get("responseSnapshot")
        if isinstance(snap, dict) and "surgery" in snap and is_pos_int(surgery_id):
            compact_snap = {k: v for k, v in snap.items() if k != "surgery"}
            compact_snap["_rehydrateSurgeryId"] = surgery_id
            wal_idem["value"]["responseSnapshot"] = compact_snap

    patch_copy = copy.deepcopy(committed_state_patch or {})
    if isinstance(patch_copy.get("surgeryRecord"), dict):
        patch_copy["surgeryRecord"]["lastJournalSeq"] = next_seq
        if embedded_batch:
            base_attr_seq = int(attr_tail["attributionSeq"]) if attr_tail else int(cp_attr.get("activeBaseSeq", 0) or 0)
            patch_copy["surgeryRecord"]["lastAttributionSeq"] = base_attr_seq + len(embedded_batch)

    entry = {
        "eventId": tx_event_id,
        "txEventId": tx_event_id,
        "eventSeq": next_seq,
        "timestamp": ts_now,
        "surgeryId": surgery_id,
        "caseRevisionBefore": case_rev_before,
        "caseRevisionAfter": case_rev_after,
        "action": action,
        "actor": actor_meta,
        "delegationId": delegation_id,
        "statePatchSummary": summary or {},
        "committedStatePatch": patch_copy,
        "embeddedAttributionBatch": embedded_batch,
        "committedNotifications": committed_notifications or [],
        "idempotencyRecord": wal_idem,
        "prevHash": prev_hash,
    }
    entry["entryHash"] = compute_journal_entry_hash(entry)

    try:
        _append_jsonl_record_fsync(app_path, entry)
    except Exception as e:
        raise ApprovalEngineError(503, "AUDIT_WRITE_FAILED", f"Lỗi ghi Sổ nhật ký chuỗi băm (Step S1): {e}")

    if TEST_FAULT_HOOKS.get("crash_between_s1_and_s2") or TEST_FAULT_HOOKS.get("crash_after_wal_append"):
        raise SimulatedCrashAfterWal("Simulated SIGKILL immediately after Step S1 WAL fsync before Step S2/S3")

    # Step S2: Append hash-chained attribution entries
    attr_written = []
    curr_attr_prev = attr_tail["entryHash"] if attr_tail else str(cp_attr.get("activeGenesisHash") or GENESIS_HASH)
    curr_attr_seq = int(attr_tail["attributionSeq"]) if attr_tail else int(cp_attr.get("activeBaseSeq", 0) or 0)

    try:
        for item in embedded_batch:
            curr_attr_seq += 1
            attr_entry = copy.deepcopy(item)
            attr_entry["attributionSeq"] = curr_attr_seq
            attr_entry["sourceWalSeq"] = next_seq
            attr_entry["prevHash"] = curr_attr_prev
            attr_entry["entryHash"] = compute_journal_entry_hash(attr_entry)
            _append_jsonl_record_fsync(attr_path, attr_entry)
            curr_attr_prev = attr_entry["entryHash"]
            attr_written.append(attr_entry)
    except Exception as e:
        raise ApprovalEngineError(503, "AUDIT_WRITE_FAILED", f"Lỗi ghi Sổ nhật ký trách nhiệm (Step S2): {e}")

    if TEST_FAULT_HOOKS.get("crash_between_s2_and_s3"):
        raise SimulatedCrashAfterWal("Simulated SIGKILL immediately after Step S2 fsync before Step S3 db.json swap")

    db["_lastApprovalJournalSeq"] = next_seq
    db["_lastApprovalJournalHash"] = entry["entryHash"]
    if attr_written:
        db["_lastAttributionJournalSeq"] = curr_attr_seq
        db["_lastAttributionJournalHash"] = curr_attr_prev

    return entry, attr_written


def append_wal_journal_entry(
    data_dir: str,
    db: dict,
    *,
    action: str,
    actor: dict,
    surgery_id=None,
    case_rev_before=None,
    case_rev_after=None,
    delegation_id=None,
    summary: dict = None,
    committed_state_patch: dict = None,
    committed_notifications: list = None,
    idempotency_record: dict = None,
    attribution_specs: list = None,
) -> dict:
    """Backward-compatible wrapper around append_dual_wal_transaction returning the Step S1 approval entry."""
    entry, _ = append_dual_wal_transaction(
        data_dir,
        db,
        action=action,
        actor=actor,
        surgery_id=surgery_id,
        case_rev_before=case_rev_before,
        case_rev_after=case_rev_after,
        delegation_id=delegation_id,
        summary=summary,
        committed_state_patch=committed_state_patch,
        committed_notifications=committed_notifications,
        idempotency_record=idempotency_record,
        attribution_Specs=attribution_specs,
    )
    return entry


def _iter_jsonl_reverse_chunks(path: str, chunk_size: int = 65536):
    """Yields parsed JSON dicts from a plain .jsonl file in reverse order using bounded O(line) RAM."""
    if not os.path.isfile(path):
        return
    size = os.path.getsize(path)
    if size == 0:
        return
    with open(path, "rb") as bf:
        pos = size
        carry = b""
        while pos > 0:
            read_len = min(chunk_size, pos)
            pos -= read_len
            bf.seek(pos)
            data = bf.read(read_len) + carry
            lines = data.split(b"\n")
            if pos > 0:
                carry = lines[0]
                complete_lines = lines[1:]
            else:
                carry = b""
                complete_lines = lines
            for raw in reversed(complete_lines):
                s = raw.strip()
                if not s:
                    continue
                try:
                    yield json.loads(s.decode("utf-8"))
                except Exception:
                    continue


def _iter_gzip_segment_reverse(gz_path: str):
    """Reads a single bounded (<=50 MB raw) .jsonl.gz archive segment and yields parsed JSON dicts newest-first."""
    if not os.path.isfile(gz_path):
        return
    lines = []
    with gzip.open(gz_path, "rt", encoding="utf-8") as gf:
        for raw in gf:
            s = raw.strip()
            if s:
                lines.append(s)
    for raw_s in reversed(lines):
        try:
            yield json.loads(raw_s)
        except Exception:
            continue


def query_journal_reverse_paginated(
    data_dir: str,
    stream_key: str,
    *,
    limit: int = 200,
    before_seq: int = None,
    surgery_id: int = None,
    filter_fn=None,
) -> dict:
    """
    Reverse-paginated reader across hot .jsonl + rotated .jsonl.gz segments in data/journal_archive/.
    Stops immediately once `limit + 1` matching items are collected (O(limit) memory on hot journal).
    """
    cp = load_or_init_journal_checkpoint(data_dir)
    hot_path = get_journal_path(data_dir) if stream_key == "approval" else get_attribution_journal_path(data_dir)
    seq_field = "eventSeq" if stream_key == "approval" else "attributionSeq"
    stream_meta = cp.get(stream_key) or {}
    segments = list(stream_meta.get("segments") or [])

    tail_rec, _ = read_last_valid_jsonl_record_adaptive(hot_path, truncate_torn=False)
    head_seq = int(tail_rec[seq_field]) if tail_rec else int(stream_meta.get("activeBaseSeq", 0) or 0)
    head_hash = tail_rec["entryHash"] if tail_rec else str(stream_meta.get("activeGenesisHash") or GENESIS_HASH)

    cap = min(max(int(limit or 200), 1), 1000)
    collected = []
    has_more = False

    def _accept(obj: dict) -> bool:
        sq = int(obj.get(seq_field, 0) or 0)
        if before_seq is not None and sq >= before_seq:
            return False
        if surgery_id is not None and obj.get("surgeryId") != surgery_id:
            return False
        if callable(filter_fn) and not filter_fn(obj):
            return False
        return True

    for obj in _iter_jsonl_reverse_chunks(hot_path):
        if _accept(obj):
            if len(collected) < cap:
                collected.append(obj)
            else:
                has_more = True
                break

    if not has_more and len(collected) <= cap:
        archive_dir = get_archive_dir(data_dir)
        # Iterate segments from highest endSeq down to lowest
        for seg in sorted(segments, key=lambda x: int(x.get("endSeq", 0)), reverse=True):
            if before_seq is not None and int(seg.get("startSeq", 0)) >= before_seq:
                continue
            gz_path = os.path.join(archive_dir, seg.get("fileName", ""))
            for obj in _iter_gzip_segment_reverse(gz_path):
                if _accept(obj):
                    if len(collected) < cap:
                        collected.append(obj)
                    else:
                        has_more = True
                        break
            if has_more:
                break

    next_cursor = int(collected[-1][seq_field]) if (has_more and collected) else None
    return {
        "headSeq": head_seq,
        "headHash": head_hash,
        "totalApprox": head_seq,
        "hasMore": has_more,
        "nextBeforeSeq": next_cursor,
        "items": collected,
    }


# ───────────────────────── Persistent 72h Idempotency-Key ─────────────────────────

def check_idempotency(db: dict, actor_staff_id: int, surgery_id, action: str, idem_key: str, payload_obj):
    """
    Returns cached (status_code, response_dict) if exact replay within 72h.
    Raises 422 IDEMPOTENCY_KEY_PAYLOAD_MISMATCH if key reused with different payload.
    """
    if not idem_key or not str(idem_key).strip():
        return None, None, None
    clean_key = str(idem_key).strip()
    if len(clean_key) > 200:
        raise ApprovalEngineError(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key vượt quá độ dài cho phép.")

    store = db.setdefault("_approvalIdempotency", {})
    now_ts = now_vn()

    # Purge expired (> 72h)
    expired_keys = []
    for k, rec in list(store.items()):
        exp = parse_iso_dt((rec or {}).get("expiresAt", ""))
        if exp and exp < now_ts:
            expired_keys.append(k)
    for k in expired_keys:
        store.pop(k, None)

    scope_key = f"{actor_staff_id}:{surgery_id}:{action}:{clean_key}"
    fingerprint = sha256_hex(canonical_json(payload_obj if payload_obj is not None else {}))

    existing = store.get(scope_key)
    if existing:
        if existing.get("payloadFingerprint") != fingerprint:
            raise ApprovalEngineError(
                422,
                "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
                "Idempotency-Key đã được dùng cho một nội dung yêu cầu khác.",
            )
        replay = copy.deepcopy(existing.get("responseSnapshot") or {})
        replay["idempotentReplay"] = True
        return int(existing.get("httpStatus", 200)), replay, scope_key

    return None, None, scope_key


def build_idempotency_record(scope_key: str, fingerprint: str, http_status: int, response_snapshot: dict):
    if not scope_key or not fingerprint:
        return None
    val = {
        "payloadFingerprint": fingerprint,
        "httpStatus": http_status,
        "responseSnapshot": copy.deepcopy(response_snapshot),
        "createdAt": now_vn_iso(),
        "expiresAt": (now_vn() + timedelta(hours=72)).isoformat(timespec="seconds"),
    }
    return {"scopeKey": scope_key, "value": val}


# ───────────────────────── Suggestions, Catalog & POD Helpers ─────────────────────────

def strip_vn_accents(s: str) -> str:
    base = unicodedata.normalize("NFD", normalize_vn_text(s)).replace("đ", "d")
    return "".join(ch for ch in base if unicodedata.category(ch) != "Mn")


def suggest_pathology_group(diagnosis: str) -> str:
    txt = strip_vn_accents(diagnosis)
    if not txt:
        return "unknown"
    # Ambiguous abbreviations ("td u ...", "theo doi u ...") -> unknown (TC-09)
    if re.search(r"\b(td|theo doi|nghi)\b", txt) and ("u " in txt or txt.startswith("u")):
        return "unknown"
    if any(k in txt for k in ("gist", "net", "than kinh noi tiet", "duoi niem", "loan san do cao", "chua gpb", "nghi ac")):
        return "neoplasm_suspected_or_special"
    if any(k in txt for k in ("ung thu", "carcinom", "k truc trang", "k dai trang", "k manh trang", "k sigma", "k ong hau mon", "ac tinh")):
        return "cancer_confirmed"
    if any(k in txt for k in ("ro hau mon", "tri ", "cat tri", "nut ke", "ap xe canh hau mon", "ap-xe canh hau mon", "hep hau mon", "condylom", "da thua canh hau mon")):
        return "benign_anorectal"
    if txt.startswith("tri") or "bui tri" in txt or "ro xuyen co that" in txt:
        return "benign_anorectal"
    if any(k in txt for k in ("dong hau mon nhan tao", "dong hmnt", "hau mon nhan tao", "sa truc trang", "tui thua", "xoan dai trang", "tac ruot", "thoat vi", "ro truc trang am dao", "ro dai trang")):
        return "benign_colorectal_abdominal"
    return "unknown"


def suggest_urgency_level(surgery_type: str, current_urgency: str = None) -> str:
    if current_urgency in VALID_URGENCY_LEVELS:
        return current_urgency
    st = str(surgery_type or "chuongtrinh")
    if st == "yeucau":
        return "elective_service"
    if st == "bankhan":
        return "semi_urgent"
    return "elective"


def lookup_catalog_entry(catalog: dict, entry_id: str):
    if not entry_id:
        return None
    target = str(entry_id).strip().upper()
    # Allow -ROBOT suffix mapped onto PTNS entry (e.g., PTNS-234-ROBOT -> PTNS-234)
    stripped_robot = target[:-6] if target.endswith("-ROBOT") else target
    for p in catalog.get("procedures") or []:
        cid = str(p.get("catalogEntryId", "")).upper()
        aliases = [str(a).upper() for a in (p.get("aliases") or [])]
        if target == cid or stripped_robot == cid or target in aliases or stripped_robot in aliases:
            return p
    return None


def _normalize_method_for_catalog_match(s: str) -> str:
    txt = normalize_vn_text(s)
    if not txt:
        return ""
    txt = re.sub(r"\s*\+\s*", " + ", txt)
    txt = re.sub(r"\s*[–—-]\s*", " - ", txt)
    txt = txt.replace("phẫu thuật robot", "phẫu thuật nội soi").replace("robot ", "phẫu thuật nội soi ")
    txt = txt.replace("đại tràng sigma", "đại tràng chậu hông")
    txt = re.sub(r"\bsigma\b", "chậu hông", txt)
    txt = txt.replace("cắt trước thấp trực tràng", "cắt trực tràng thấp")
    txt = re.sub(r"\(\s*lar\s*\)", "", txt)
    txt = re.sub(r"\+\s*tme\b", "+ nạo vét hạch", txt)
    txt = re.sub(r"\bhmnt\b", "hậu môn nhân tạo", txt)
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt


def suggest_procedure_from_method(catalog: dict, method: str, approach_type: str):
    """
    Matches free-text method against 309-procedure catalog.
    Never auto-confirms; returns (suggestedCatalogCode, suggestedClass, candidateMatches).
    If method matches multiple entries of DIFFERENT classes (e.g. 'Cắt đại tràng') or 0 entries -> 'unknown_ambiguous'.
    """
    if approach_type == "nsth":
        return None, None, []
    norm = normalize_vn_text(method)
    if not norm:
        return None, "unknown_ambiguous", []

    group = "noisoi" if approach_type in ("noisoi", "robot") else "mo"
    group_procs = [p for p in (catalog.get("procedures") or []) if p.get("approachGroup") == group]

    # Normalize Robot wording & colorectal clinical synonyms for matching against Catalog 309 equivalents
    search_norm = _normalize_method_for_catalog_match(method)

    exact = [
        p for p in group_procs
        if p.get("normalizedName") == norm
        or _normalize_method_for_catalog_match(p.get("officialName") or p.get("normalizedName", "")) == search_norm
    ]
    if exact:
        classes = {p["procedureClass"] for p in exact}
        if len(classes) == 1:
            return exact[0]["catalogEntryId"], exact[0]["procedureClass"], exact[:10]
        return None, "unknown_ambiguous", exact[:10]

    substr_matches = [
        p for p in group_procs
        if (norm in p.get("normalizedName", ""))
        or (search_norm and search_norm in _normalize_method_for_catalog_match(p.get("officialName") or p.get("normalizedName", "")))
        or (p.get("normalizedName", "") in norm and len(p.get("normalizedName", "")) >= 12)
        or (
            _normalize_method_for_catalog_match(p.get("officialName") or p.get("normalizedName", "")) in search_norm
            and len(_normalize_method_for_catalog_match(p.get("officialName") or p.get("normalizedName", ""))) >= 14
        )
    ]
    if len(substr_matches) == 1:
        return substr_matches[0]["catalogEntryId"], substr_matches[0]["procedureClass"], substr_matches
    if len(substr_matches) > 1:
        # Prefer the longest (most specific) officialName match when e.g. '+ nạo vét hạch' contains base procedure
        ranked_substr = sorted(
            substr_matches,
            key=lambda x: len(_normalize_method_for_catalog_match(x.get("officialName") or x.get("normalizedName", ""))),
            reverse=True,
        )
        top_len = len(_normalize_method_for_catalog_match(ranked_substr[0].get("officialName") or ranked_substr[0].get("normalizedName", "")))
        top_ties = [
            x for x in ranked_substr
            if len(_normalize_method_for_catalog_match(x.get("officialName") or x.get("normalizedName", ""))) == top_len
        ]
        if len({x["procedureClass"] for x in top_ties}) == 1 and top_len >= 18:
            return top_ties[0]["catalogEntryId"], top_ties[0]["procedureClass"], ranked_substr[:10]
        classes = {p["procedureClass"] for p in substr_matches}
        if len(classes) == 1 and len(norm) >= 18:
            return substr_matches[0]["catalogEntryId"], substr_matches[0]["procedureClass"], substr_matches[:10]
        return None, "unknown_ambiguous", substr_matches[:15]

    return None, "unknown_ambiguous", []


def evaluate_column_compliance(
    catalog: dict,
    db: dict,
    *,
    main_surgeon_id,
    approach_type: str,
    surgery_date: str,
    confirmed_class: str = None,
    confirmed_catalog_id: str = None,
    is_custom_procedure: bool = False,
    is_custom_outside_catalog: bool = False,
    proposed_class: str = None,
    verified_class: str = None,
) -> dict:
    """Computes columnCompliance metadata & systemCheck according to QĐ 1073 & 2026 Privilege Matrix."""
    is_custom_procedure = bool(is_custom_procedure or is_custom_outside_catalog)
    matrix = (catalog or {}).get("privilegeMatrix") or {}
    eff_from = matrix.get("effectiveFrom", "2026-01-01")
    eff_to = matrix.get("effectiveTo", "2026-12-31")
    attending_cols = matrix.get("attendingColumns") or {}
    robot_ids = set(matrix.get("robotCertifiedStaffIds") or ROBOT_CERTIFIED_STAFF_IDS)
    ext_ids = {d.get("id") for d in (db.get("externalDoctors") or []) if isinstance(d, dict) and is_pos_int(d.get("id"))}

    res = {
        "privilegeMatrixVersion": matrix.get("privilegeMatrixVersion", "BVBD-PTDTT-2026.v2"),
        "validityPeriodYears": int(matrix.get("validityPeriodYears", 1) or 1),
        "surgeonBaseColumn2026": None,
        "columnStepDelta": 0,
        "robotCertified": bool(main_surgeon_id in robot_ids),
        "systemCheck": "unverified",
    }

    if approach_type == "nsth":
        res["systemCheck"] = "nsth_external"
        return res

    if not is_pos_int(main_surgeon_id):
        res["systemCheck"] = "missing_surgeon"
        return res

    if main_surgeon_id in TRAINEE_STAFF_IDS:
        res["systemCheck"] = "invalid_trainee_main_surgeon"
        return res

    if main_surgeon_id in ext_ids or main_surgeon_id >= 100:
        res["systemCheck"] = "external_surgeon_verify_privilege"
        return res

    col_entry = attending_cols.get(str(main_surgeon_id))
    if not col_entry:
        res["systemCheck"] = "unknown_surgeon_privilege"
        return res

    base_col = col_entry.get("lap") if approach_type in ("noisoi", "robot") else col_entry.get("open")
    res["surgeonBaseColumn2026"] = base_col

    if is_valid_iso_date(surgery_date) and not (eff_from <= surgery_date <= eff_to):
        res["systemCheck"] = "matrix_expired_manual_verify"
        return res

    if approach_type == "robot" and main_surgeon_id not in robot_ids:
        res["systemCheck"] = "robot_certification_required"
        return res

    if is_custom_procedure and not verified_class:
        if proposed_class in ("PT-ĐB", "PT-I", "PT-II", "PT-III"):
            s_rank_prop = COLUMN_RANK.get(base_col, 0)
            p_rank_prop = COLUMN_RANK.get(proposed_class, 99)
            res["columnStepDelta"] = max(0, p_rank_prop - s_rank_prop) if (1 <= s_rank_prop <= 4 and 1 <= p_rank_prop <= 4) else None
            if s_rank_prop < p_rank_prop:
                res["systemCheck"] = "over_column"
                return res
        res["systemCheck"] = "custom_pending_bcn_verification"
        return res

    effective_class = verified_class if (is_custom_procedure and verified_class) else confirmed_class

    if not effective_class or effective_class == "unknown_ambiguous":
        res["systemCheck"] = "ambiguous_procedure_class"
        return res

    if effective_class == "unclassified":
        res["systemCheck"] = "unclassified_manual_verify"
        return res

    s_rank = COLUMN_RANK.get(base_col, 0)
    p_rank = COLUMN_RANK.get(effective_class, 99)
    step_delta = max(0, p_rank - s_rank) if (1 <= s_rank <= 4 and 1 <= p_rank <= 4) else None
    res["columnStepDelta"] = step_delta
    if s_rank >= p_rank:
        res["systemCheck"] = "within_column"
    else:
        # Check if approvedOverColumnGrants covers this (staffId, catalogEntryId, date)
        grants = matrix.get("approvedOverColumnGrants") or []
        has_grant = False
        for g in grants:
            if (
                isinstance(g, dict)
                and g.get("staffId") == main_surgeon_id
                and str(g.get("catalogEntryId", "")).upper() == str(confirmed_catalog_id or "").upper()
                and (not g.get("effectiveFrom") or surgery_date >= g["effectiveFrom"])
                and (not g.get("effectiveTo") or surgery_date <= g["effectiveTo"])
            ):
                has_grant = True
                res["matchedGrantDecision"] = g.get("decisionNumber")
                break
        res["systemCheck"] = "approved_over_column_matched" if has_grant else "over_column"
    return res


def _normalize_pod_id(val):
    if val is None:
        return None
    if isinstance(val, int) and not isinstance(val, bool):
        return val
    s = str(val).strip().upper().replace("POD", "").strip()
    return int(s) if s.isdigit() else val


def get_active_pod_roster(catalog: dict, db: dict = None, ref_date: str = None) -> dict:
    """
    Resolves active server-side POD roster at `ref_date` (or today in UTC+7):
      1. First checks `surgeryApprovalConfig.podRosters[]` matching `[effectiveFrom, effectiveTo]`.
      2. Falls back to `catalog['podRoster']`, then `DEFAULT_POD_ROSTER_ROOMS`.
    """
    target_day = ref_date if is_valid_iso_date(ref_date or "") else now_vn().strftime("%Y-%m-%d")
    cfg = get_approval_config(db or {}) if isinstance(db, dict) else {}
    for entry in (cfg.get("podRosters") or []):
        if not isinstance(entry, dict) or not isinstance(entry.get("rooms"), dict):
            continue
        ef = str(entry.get("effectiveFrom") or "")
        et = str(entry.get("effectiveTo") or "")
        if (not ef or target_day >= ef) and (not et or target_day <= et):
            return entry
    cat_roster = (catalog or {}).get("podRoster")
    if isinstance(cat_roster, dict) and isinstance(cat_roster.get("rooms"), dict) and cat_roster["rooms"]:
        return cat_roster
    return {
        "rosterPeriod": "2026-Q4-default",
        "effectiveFrom": "2026-01-01",
        "effectiveTo": "2026-12-31",
        "rooms": copy.deepcopy(DEFAULT_POD_ROSTER_ROOMS),
    }


def get_pod_room_info(
    catalog: dict,
    ward_room: str,
    db: dict = None,
    ref_date: str = None,
    *,
    surgery_date: str = None,
    strict: bool = True,
) -> dict:
    if ward_room and ward_room not in VALID_WARD_ROOMS:
        if strict:
            raise ApprovalEngineError(422, "INVALID_WARD_ROOM", f"Phòng bệnh '{ward_room}' không tồn tại trong sơ đồ 3 POD của Khoa.")
        return {"podId": None, "attendingStaffIds": [], "residentStaffIds": []}
    eff_date = ref_date or surgery_date
    roster = get_active_pod_roster(catalog, db, eff_date)
    rooms = roster.get("rooms") or DEFAULT_POD_ROSTER_ROOMS
    if ward_room and ward_room in rooms and ward_room != "unassigned":
        info = copy.deepcopy(rooms[ward_room])
        info["podId"] = _normalize_pod_id(info.get("podId"))
        return info
    if ward_room and ward_room in DEFAULT_POD_ROSTER_ROOMS:
        return copy.deepcopy(DEFAULT_POD_ROSTER_ROOMS[ward_room])
    return {"podId": None, "attendingStaffIds": [], "residentStaffIds": []}


def is_same_pod_attending(catalog: dict, surgery: dict, actor_staff_id: int, db: dict = None, *, surgery_date: str = None) -> bool:
    """
    True iff `actor_staff_id` is an attending surgeon assigned on the active server-side `podRosters`
    to the POD covering `surgery.podAssignment.wardRoom` (or `mainSurgeon`'s POD if room unassigned).
    NEVER trusts any client `self_reported` flag!
    """
    if actor_staff_id not in ATTENDING_STAFF_IDS:
        return False
    pod_assign = surgery.get("podAssignment") or {}
    ward_room = pod_assign.get("wardRoom") or surgery.get("wardRoom")
    roster = get_active_pod_roster(catalog, db, surgery_date or surgery.get("date"))
    rooms = roster.get("rooms") or DEFAULT_POD_ROSTER_ROOMS
    target_pod = _normalize_pod_id((rooms.get(ward_room) or {}).get("podId")) if (ward_room and ward_room != "unassigned") else None
    if not target_pod:
        ms = surgery.get("mainSurgeon")
        for r_info in rooms.values():
            if isinstance(r_info, dict) and ms in (r_info.get("attendingStaffIds") or []):
                target_pod = _normalize_pod_id(r_info.get("podId"))
                break
    if not target_pod:
        return False
    for r_info in rooms.values():
        if isinstance(r_info, dict) and _normalize_pod_id(r_info.get("podId")) == target_pod and actor_staff_id in (r_info.get("attendingStaffIds") or []):
            return True
    return False


# ───────────────────────── Site-Locked TNM Engine & Dual KPIs ─────────────────────────

TNM_RULESET_REGISTRY = {
    "AJCC_8_CH20_COLORECTAL": {
        "ruleSetId": "AJCC_8_CH20_COLORECTAL",
        "systemLabel": "AJCC 8th Edition · Colon and Rectum (Ch.20, hiệu lực từ 2018)",
        "effectiveYear": 2018,
        "sourceUrl": "https://www.facs.org/quality-programs/cancer-programs/american-joint-committee-on-cancer/version-9/",
        "sourceCitation": "AJCC Cancer Staging Manual, 8th Ed., Chapter 20 (Colon and Rectum); ACS AJCC Version 9 Roster (C18–C20 remains 8th Ed.)",
    },
    "AJCC_V9_2023_ANUS": {
        "ruleSetId": "AJCC_V9_2023_ANUS",
        "systemLabel": "AJCC Version 9 · Anus (hiệu lực từ 01/01/2023)",
        "effectiveYear": 2023,
        "sourceUrl": "https://www.facs.org/quality-programs/cancer-programs/american-joint-committee-on-cancer/version-9/",
        "sourceCitation": "American College of Surgeons — AJCC Version 9 Cancer Staging System: Anus (effective Jan 1, 2023)",
    },
    "AJCC_8_CH21_ANUS_LEGACY": {
        "ruleSetId": "AJCC_8_CH21_ANUS_LEGACY",
        "systemLabel": "AJCC 8th Edition · Chương 21 (Anal Canal — Hồ sơ lịch sử)",
        "effectiveYear": 2018,
        "sourceUrl": "https://www.facs.org/quality-programs/cancer-programs/american-joint-committee-on-cancer/",
        "sourceCitation": "AJCC Cancer Staging Manual, 8th Ed., Chapter 21 (superseded by AJCC Version 9 on 01/01/2023)",
    },
}

COLORECTAL_TNM_SITES = {
    "right_colon", "cecum_right_colon", "cecum", "ascending_colon",
    "transverse_colon", "left_colon", "descending_colon",
    "sigmoid", "sigmoid_colon",
    "rectum_upper", "rectum_high", "high_rectum",
    "rectum_mid", "mid_rectum",
    "rectum_low", "low_rectum",
}
NEOADJUVANT_MULTIMODAL_MODES = {
    "post_neoadjuvant_crt",
    "post_long_course_crt",
    "post_short_course_rt",
    "post_tnt",
    "tnt_completed",
    "post_systemic_chemo",
}


def normalize_tnm_axis_token(tok) -> str:
    if not tok:
        return None
    s = str(tok).strip()
    if not s:
        return None
    if s in ("Tx", "TX"):
        return "Tx"
    if s in ("Nx", "NX"):
        return "Nx"
    if s in ("Mx", "MX"):
        return "Mx"
    if s.lower().endswith("tis"):
        return "Tis"
    for pfx in ("yc", "c", "p"):
        if s.startswith(pfx) and len(s) > len(pfx) and s[len(pfx)].upper() in ("T", "N", "M"):
            rest = s[len(pfx):]
            if rest in ("TX", "Tx"):
                return "Tx"
            if rest in ("NX", "Nx"):
                return "Nx"
            if rest in ("MX", "Mx"):
                return "Mx"
            return rest
    return s


def evaluate_tnm_assessment(
    cancer_ctx: dict,
    *,
    config: dict = None,
    is_historical_record: bool = False,
) -> dict:
    """
    Site- & Histology-Locked TNM Engine (Mục 3.B–3.C):
      - Never assumes `upfront_surgery` when `multimodalStatus` is empty.
      - Never flips `baselineClinicalStage` (`cTNM`) into `ycTNM` when switching to neoadjuvant.
      - Keeps `CRM` and `EMVI` as separate local risk indicators outside `0..IVC`.
      - Enforces `enableAutoStageDerivation` + `clinicalStagingApprovedBy` specialist gate before auto-deriving Roman stages.
    """
    cfg = config if isinstance(config, dict) else DEFAULT_SURGERY_APPROVAL_CONFIG
    ctx = cancer_ctx if isinstance(cancer_ctx, dict) else {}
    locs = list(ctx.get("tumorLocation") or [])
    hist = ctx.get("preopHistology")
    mm_status = ctx.get("multimodalStatus")
    crm = ctx.get("crmStatus")
    emvi = ctx.get("emviStatus")

    legacy_stage = ctx.get("clinicalStage") if isinstance(ctx.get("clinicalStage"), dict) else {}
    baseline_slot = ctx.get("baselineClinicalStage") if isinstance(ctx.get("baselineClinicalStage"), dict) else None
    restage_slot = ctx.get("restagingPostNeoadjuvant") if isinstance(ctx.get("restagingPostNeoadjuvant"), dict) else None

    if baseline_slot is None and legacy_stage and mm_status == "upfront_surgery":
        baseline_slot = legacy_stage
    elif restage_slot is None and legacy_stage and mm_status in NEOADJUVANT_MULTIMODAL_MODES and "restagingPostNeoadjuvant" not in ctx:
        restage_slot = legacy_stage

    baseline_slot = baseline_slot or {}
    restage_slot = restage_slot or {}

    local_risk_badges = []
    if crm and crm != "not_applicable":
        local_risk_badges.append(f"CRM: {crm}")
    if emvi and emvi != "not_applicable":
        local_risk_badges.append(f"EMVI: {emvi}")

    if not mm_status:
        return {
            "status": "treatment_status_unconfirmed",
            "prefix": None,
            "assessmentTimepoint": None,
            "headingLabel": "Chưa chọn tình trạng điều trị trước mổ — cần xác nhận Mổ kỳ đầu (cTNM) hoặc Sau tân hỗ trợ (ycTNM)",
            "formulaDisplay": None,
            "stageGroup": "Giai đoạn chưa xác định (chưa chọn tình trạng điều trị trước mổ)",
            "ruleSetId": None,
            "ruleSetLabel": None,
            "ruleSetEffectiveYear": None,
            "ruleSetSourceUrl": None,
            "sourceCitation": None,
            "baselinePreserved": copy.deepcopy(baseline_slot) if baseline_slot else None,
            "separateLocalRiskIndicators": local_risk_badges,
        }

    is_neoadjuvant = mm_status in NEOADJUVANT_MULTIMODAL_MODES
    active_prefix = "yc" if is_neoadjuvant else "c"
    active_slot = restage_slot if is_neoadjuvant else baseline_slot
    assessment_timepoint = "post_neoadjuvant_restaging" if is_neoadjuvant else "pre_treatment_clinical"

    raw_t = normalize_tnm_axis_token(active_slot.get("T") or active_slot.get("t") or active_slot.get("cT") or active_slot.get("ycT"))
    raw_n = normalize_tnm_axis_token(active_slot.get("N") or active_slot.get("n") or active_slot.get("cN") or active_slot.get("ycN"))
    raw_m = normalize_tnm_axis_token(active_slot.get("M") or active_slot.get("m") or active_slot.get("cM") or active_slot.get("ycM"))

    def _fmt_tok(base_tok):
        if not base_tok:
            return "?"
        if base_tok in ("Tx", "Nx", "Mx"):
            return f"{active_prefix}{base_tok}" if is_neoadjuvant else base_tok
        return f"{active_prefix}{base_tok}"

    formula_display = f"{_fmt_tok(raw_t)} · {_fmt_tok(raw_n)} · {_fmt_tok(raw_m)}"

    primary_site = ctx.get("primaryIndexSite")
    eval_locs = [primary_site] if (primary_site and primary_site in locs) else locs
    has_anal = "anal_canal" in eval_locs
    has_colorectal = any(l in COLORECTAL_TNM_SITES for l in eval_locs)

    if has_anal and has_colorectal and hist == "scc":
        return {
            "status": "multi_site_discordant_staging",
            "prefix": active_prefix,
            "assessmentTimepoint": assessment_timepoint,
            "headingLabel": "Đa vị trí khác hệ phân loại — cần chọn vị trí u chỉ điểm chính",
            "formulaDisplay": formula_display,
            "stageGroup": "Giai đoạn chưa xác định (đa vị trí khác hệ phân loại — cần chọn u chỉ điểm chính)",
            "ruleSetId": None,
            "ruleSetLabel": None,
            "ruleSetEffectiveYear": None,
            "ruleSetSourceUrl": None,
            "sourceCitation": None,
            "baselinePreserved": copy.deepcopy(baseline_slot) if baseline_slot else None,
            "separateLocalRiskIndicators": local_risk_badges,
        }

    if hist == "neuroendocrine_gist_other":
        return {
            "status": "special_histology_manual_staging",
            "prefix": active_prefix,
            "assessmentTimepoint": assessment_timepoint,
            "headingLabel": "Mô học đặc thù (NET / GIST) — phân loại riêng theo kích thước & độ mô học",
            "formulaDisplay": formula_display,
            "stageGroup": "Giai đoạn chưa xác định (NET Đại trực tràng AJCC v9 [2024] / GIST AJCC 8 Ch.43 cần kích thước & độ mô học riêng)",
            "ruleSetId": "SPECIAL_HISTOLOGY_NO_AUTO_MERGE",
            "ruleSetLabel": "AJCC Version 9 Colorectal NET (2024) / AJCC 8th Ed. Ch.43 GIST",
            "ruleSetEffectiveYear": 2024,
            "ruleSetSourceUrl": "https://www.facs.org/quality-programs/cancer-programs/american-joint-committee-on-cancer/version-9/",
            "sourceCitation": "AJCC Version 9 Colorectal NET (2024) / AJCC 8th Ed. Ch.43 GIST",
            "baselinePreserved": copy.deepcopy(baseline_slot) if baseline_slot else None,
            "separateLocalRiskIndicators": local_risk_badges,
        }

    if has_anal and hist == "scc":
        locked_rule_id = (
            ctx.get("lockedRuleSetId")
            if (is_historical_record and ctx.get("lockedRuleSetId") in TNM_RULESET_REGISTRY)
            else cfg.get("analCanalSccRuleSet", "AJCC_V9_2023_ANUS")
        )
    elif hist in ("adenocarcinoma", "adenocarcinoma_well_mod", "mucinous_signet", "adenocarcinoma_poor_mucinous_signet") and (has_colorectal or has_anal):
        locked_rule_id = "AJCC_8_CH20_COLORECTAL"
    else:
        locked_rule_id = None

    rule_meta = TNM_RULESET_REGISTRY.get(locked_rule_id or "", {})
    heading_label = (
        f"Giai đoạn đánh giá lại sau tân hỗ trợ (yc) — {rule_meta.get('systemLabel', 'Chưa khóa bộ quy tắc')}"
        if is_neoadjuvant
        else f"Giai đoạn lâm sàng trước điều trị (c) — {rule_meta.get('systemLabel', 'Chưa khóa bộ quy tắc')}"
    )

    if not (cfg.get("enableAutoStageDerivation") and cfg.get("clinicalStagingApprovedBy")):
        return {
            "status": "pending_clinical_signoff_gate",
            "prefix": active_prefix,
            "assessmentTimepoint": assessment_timepoint,
            "headingLabel": heading_label,
            "formulaDisplay": formula_display,
            "stageGroup": "Chờ BCN nghiệm thu bộ quy tắc phân giai đoạn tự động",
            "ruleSetId": locked_rule_id,
            "ruleSetLabel": rule_meta.get("systemLabel"),
            "ruleSetEffectiveYear": rule_meta.get("effectiveYear"),
            "ruleSetSourceUrl": rule_meta.get("sourceUrl"),
            "sourceCitation": rule_meta.get("sourceCitation"),
            "baselinePreserved": copy.deepcopy(baseline_slot) if baseline_slot else None,
            "separateLocalRiskIndicators": local_risk_badges,
        }

    if not (raw_t and raw_n and raw_m):
        missing_parts = [ax for ax, v in (("T", raw_t), ("N", raw_n), ("M", raw_m)) if not v]
        reason_suffix = (
            " (chưa nhập kết quả đánh giá lại ycT·ycN·ycM sau tân hỗ trợ)"
            if is_neoadjuvant
            else f" (thiếu thành tố {'/'.join(missing_parts)})"
        )
        return {
            "status": "incomplete_axes",
            "prefix": active_prefix,
            "assessmentTimepoint": assessment_timepoint,
            "headingLabel": heading_label,
            "formulaDisplay": formula_display,
            "stageGroup": f"Giai đoạn chưa xác định{reason_suffix}",
            "ruleSetId": locked_rule_id,
            "ruleSetLabel": rule_meta.get("systemLabel"),
            "ruleSetEffectiveYear": rule_meta.get("effectiveYear"),
            "ruleSetSourceUrl": rule_meta.get("sourceUrl"),
            "sourceCitation": rule_meta.get("sourceCitation"),
            "baselinePreserved": copy.deepcopy(baseline_slot) if baseline_slot else None,
            "separateLocalRiskIndicators": local_risk_badges,
        }

    stage_group = "Giai đoạn chưa xác định"
    if locked_rule_id == "AJCC_V9_2023_ANUS":
        if raw_t == "Tis":
            stage_group = "Không phân giai đoạn carcinôm xâm lấn (HSIL / AIN II–III đã loại khỏi Stage 0 trong AJCC Version 9)"
        elif raw_m == "M1":
            stage_group = "Giai đoạn IV"
        elif raw_m == "M0" and raw_t != "Tx" and raw_n != "Nx":
            if raw_t == "T1" and raw_n == "N0":
                stage_group = "Giai đoạn I"
            elif raw_t == "T2" and raw_n == "N0":
                stage_group = "Giai đoạn IIA"
            elif raw_t in ("T1", "T2") and raw_n in ("N1", "N1a", "N1b", "N1c"):
                stage_group = "Giai đoạn IIB"
            elif raw_t == "T3" and raw_n in ("N0", "N1", "N1a", "N1b", "N1c"):
                stage_group = "Giai đoạn IIIA"
            elif raw_t == "T4" and raw_n == "N0":
                stage_group = "Giai đoạn IIIB"
            elif raw_t == "T4" and raw_n in ("N1", "N1a", "N1b", "N1c"):
                stage_group = "Giai đoạn IIIC"
    elif locked_rule_id == "AJCC_8_CH21_ANUS_LEGACY":
        if raw_m == "M1":
            stage_group = "Giai đoạn IV"
        elif raw_m == "M0" and raw_t != "Tx" and raw_n != "Nx":
            if raw_t == "Tis" and raw_n == "N0":
                stage_group = "Giai đoạn 0"
            elif raw_t == "T1" and raw_n == "N0":
                stage_group = "Giai đoạn I"
            elif raw_t == "T2" and raw_n == "N0":
                stage_group = "Giai đoạn IIA"
            elif raw_t == "T3" and raw_n == "N0":
                stage_group = "Giai đoạn IIB"
            elif raw_t in ("T1", "T2") and raw_n in ("N1", "N1a", "N1b", "N1c"):
                stage_group = "Giai đoạn IIIA"
            elif raw_t == "T4" and raw_n == "N0":
                stage_group = "Giai đoạn IIIB"
            elif raw_t in ("T3", "T4") and raw_n in ("N1", "N1a", "N1b", "N1c"):
                stage_group = "Giai đoạn IIIC"
    elif locked_rule_id == "AJCC_8_CH20_COLORECTAL":
        if raw_m == "M1a":
            stage_group = "Giai đoạn IVA"
        elif raw_m == "M1b":
            stage_group = "Giai đoạn IVB"
        elif raw_m == "M1c":
            stage_group = "Giai đoạn IVC"
        elif raw_m == "M0" and raw_t != "Tx" and raw_n != "Nx" and not (raw_n == "N2" and raw_t in ("T1", "T3")):
            if raw_t == "Tis" and raw_n == "N0":
                stage_group = "Giai đoạn 0"
            elif raw_t in ("T1", "T2") and raw_n == "N0":
                stage_group = "Giai đoạn I"
            elif raw_t == "T3" and raw_n == "N0":
                stage_group = "Giai đoạn IIA"
            elif raw_t == "T4a" and raw_n == "N0":
                stage_group = "Giai đoạn IIB"
            elif raw_t == "T4b" and raw_n == "N0":
                stage_group = "Giai đoạn IIC"
            elif (raw_t in ("T1", "T2") and raw_n in ("N1", "N1a", "N1b", "N1c")) or (raw_t == "T1" and raw_n == "N2a"):
                stage_group = "Giai đoạn IIIA"
            elif (
                (raw_t in ("T3", "T4a") and raw_n in ("N1", "N1a", "N1b", "N1c"))
                or (raw_t in ("T2", "T3") and raw_n == "N2a")
                or (raw_t in ("T1", "T2") and raw_n in ("N2b", "N2"))
            ):
                stage_group = "Giai đoạn IIIB"
            elif (
                (raw_t == "T4a" and raw_n in ("N2a", "N2"))
                or (raw_t in ("T3", "T4a") and raw_n == "N2b")
                or (raw_t == "T4b" and raw_n in ("N1", "N1a", "N1b", "N1c", "N2a", "N2b", "N2"))
            ):
                stage_group = "Giai đoạn IIIC"

    return {
        "status": "derived",
        "prefix": active_prefix,
        "assessmentTimepoint": assessment_timepoint,
        "headingLabel": heading_label,
        "formulaDisplay": formula_display,
        "stageGroup": stage_group,
        "ruleSetId": locked_rule_id,
        "ruleSetLabel": rule_meta.get("systemLabel"),
        "ruleSetEffectiveYear": rule_meta.get("effectiveYear"),
        "ruleSetSourceUrl": rule_meta.get("sourceUrl"),
        "sourceCitation": rule_meta.get("sourceCitation"),
        "baselinePreserved": copy.deepcopy(baseline_slot) if baseline_slot else None,
        "separateLocalRiskIndicators": local_risk_badges,
    }


def compute_schedule_cohort_kpi(
    surgeries: list,
    period_start: str,
    period_end: str,
    *,
    include_sandbox: bool = False,
    cfg: dict = None,
) -> dict:
    """KPI 1 — Báo cáo theo Ngày mổ hiện hành (`surgery.date in [period_start, period_end]`)."""
    seen_ids = set()
    approved_ids = set()
    reapproved_case_ids = set()
    self_approved_ids = set()
    total_reapproval_cycles = 0

    for s in (surgeries or []):
        if not isinstance(s, dict) or not is_pos_int(s.get("id")):
            continue
        if not include_sandbox and s.get("isTestSandboxCase") is True:
            continue
        in_scope, _ = is_in_phase1_approval_scope(s, cfg)
        if not in_scope:
            continue
        appr = s.get("approval") or {}
        if appr.get("status") in ("not_in_scope", "nsth_external_authority", "legacy_exempt", "trashed_inactive"):
            continue
        s_date = str(s.get("date") or "")
        if not (period_start <= s_date <= period_end):
            continue
        sid = int(s["id"])
        if sid in seen_ids:
            continue
        seen_ids.add(sid)
        if appr.get("status") == "approved":
            approved_ids.add(sid)
            if ((appr.get("approvedSnapshot") or {}).get("approvalMode")) == "self_approval_main_surgeon":
                self_approved_ids.add(sid)
        cycles = int(appr.get("approvalCycleCount", 0) or 0)
        if cycles >= 2:
            reapproved_case_ids.add(sid)
            total_reapproval_cycles += (cycles - 1)

    return {
        "kpiType": "schedule_cohort_by_surgery_date",
        "periodStart": period_start,
        "periodEnd": period_end,
        "scheduledUniqueCases": len(seen_ids),
        "scheduledApprovedCases": len(approved_ids),
        "scheduledSelfApprovedCases": len(self_approved_ids),
        "scheduledCasesWithReapproval": len(reapproved_case_ids),
        "scheduledTotalReapprovalCycles": total_reapproval_cycles,
        "caseIds": sorted(seen_ids),
    }


def _iter_all_approval_journal_events(data_dir: str):
    """Streams approval journal entries chronologically across archived `.jsonl.gz` segments + hot `.jsonl` in O(1) RAM."""
    ckpt = load_or_init_journal_checkpoint(data_dir)
    slot = (ckpt.get("approval") or {})
    archive_dir = get_archive_dir(data_dir)
    for seg in sorted(slot.get("segments") or [], key=lambda x: int(x.get("startSeq", 0))):
        gz_path = os.path.join(archive_dir, seg.get("fileName", ""))
        if os.path.isfile(gz_path):
            with gzip.open(gz_path, "rt", encoding="utf-8") as gf:
                for line in gf:
                    raw = line.strip()
                    if raw:
                        yield json.loads(raw)
    hot_path = get_journal_path(data_dir)
    if os.path.isfile(hot_path):
        with open(hot_path, "r", encoding="utf-8") as hf:
            for line in hf:
                raw = line.strip()
                if raw:
                    try:
                        yield json.loads(raw)
                    except json.JSONDecodeError:
                        continue


def compute_approval_activity_kpi(
    journal_entries,
    period_start: str,
    period_end: str,
    *,
    include_sandbox: bool = False,
) -> dict:
    """KPI 2 — Báo cáo hoạt động xét duyệt của BCN theo Ngày duyệt bất biến (`entry.timestamp[:10]`)."""
    distinct_approved_sids = set()
    distinct_reapproved_sids = set()
    self_approval_actions = 0
    initial_approvals = 0
    reapproval_events = 0

    for ev in journal_entries:
        if not isinstance(ev, dict):
            continue
        summary = ev.get("statePatchSummary") if isinstance(ev.get("statePatchSummary"), dict) else (
            ev.get("summary") if isinstance(ev.get("summary"), dict) else {}
        )
        patch_rec = (ev.get("committedStatePatch") or {}).get("surgeryRecord") or {}
        is_sbx = bool(
            ev.get("isTestSandboxCase") is True
            or summary.get("isTestSandboxCase") is True
            or patch_rec.get("isTestSandboxCase") is True
        )
        if not include_sandbox and is_sbx:
            continue
        act = ev.get("action")
        if act not in ("approve", "approve_routine", "approve_initial", "approve_reapproval"):
            continue
        ev_day = str(ev.get("timestamp") or "")[:10]
        if not (period_start <= ev_day <= period_end):
            continue
        sid = ev.get("surgeryId")
        if not is_pos_int(sid):
            continue
        distinct_approved_sids.add(int(sid))
        if summary.get("approvalMode") == "self_approval_main_surgeon":
            self_approval_actions += 1
        if act == "approve_reapproval" or int(summary.get("reapprovalIndex", 0) or 0) >= 1:
            reapproval_events += 1
            distinct_reapproved_sids.add(int(sid))
        else:
            initial_approvals += 1

    return {
        "kpiType": "approval_activity_by_event_timestamp",
        "periodStart": period_start,
        "periodEnd": period_end,
        "actedDistinctApprovedCases": len(distinct_approved_sids),
        "actedInitialApprovals": initial_approvals,
        "actedReapprovalEvents": reapproval_events,
        "actedDistinctReapprovedCases": len(distinct_reapproved_sids),
        "actedSelfApprovalActions": self_approval_actions,
        "actedTotalApprovalActions": initial_approvals + reapproval_events,
        "distinctSurgeryIds": sorted(distinct_approved_sids),
    }


def compute_dual_approval_kpis(
    db: dict,
    data_dir: str,
    period_start: str,
    period_end: str,
    *,
    include_sandbox: bool = False,
) -> dict:
    cfg = get_approval_config(db)
    by_surgery_date = compute_schedule_cohort_kpi(
        db.get("surgeries") or [],
        period_start,
        period_end,
        include_sandbox=include_sandbox,
        cfg=cfg,
    )
    by_approval_date = compute_approval_activity_kpi(
        _iter_all_approval_journal_events(data_dir),
        period_start,
        period_end,
        include_sandbox=include_sandbox,
    )
    return {
        "periodStart": period_start,
        "periodEnd": period_end,
        "includeSandbox": include_sandbox,
        "sandboxOnlyMode": bool(cfg.get("sandboxOnlyMode")),
        "bySurgeryDate": by_surgery_date,
        "byApprovalDate": by_approval_date,
    }


def suggest_surgical_history(diagnosis: str, method: str) -> dict:
    """Smart suggestion for C-08 Surgical History from diagnosis & method."""
    txt = normalize_vn_text(f"{diagnosis or ''} {method or ''}")
    if any(k in txt for k in ("đóng hmnt", "đóng hậu môn nhân tạo", "lập lại lưu thông", "miệng nối cũ")):
        return {"suggestedStatus": "present", "suggestedCategories": ["prior_colorectal_stoma"]}
    if "tái phát" in txt:
        if any(k in txt for k in ("rò hậu môn", "trĩ", "hậu môn", "tầng sinh môn")):
            return {"suggestedStatus": "present", "suggestedCategories": ["prior_anorectal_perineal"]}
        return {"suggestedStatus": "present", "suggestedCategories": ["prior_abdominal_pelvic"]}
    return {"suggestedStatus": "none", "suggestedCategories": []}


def has_high_risk_preop_history(chips: dict) -> bool:
    """True when pre-op history has critical anesthesia/surgical safety risks requiring an explicit CK-03 plan."""
    if not isinstance(chips, dict):
        return False
    anti = chips.get("antithromboticPlan") or {}
    if anti.get("mode") == "unheld_urgent_risk":
        return True
    al = chips.get("allergyHistory") or {}
    if al.get("status") == "present" and al.get("reactionSeverity") == "severe_anaphylaxis":
        return True
    sh = chips.get("surgicalHistory") or {}
    if sh.get("status") == "present" and "prior_anesthesia_or_transfusion_event" in (sh.get("categories") or []):
        return True
    soc = chips.get("socialHabits") or {}
    if soc.get("alcoholUse") == "dependent":
        return True
    if ((soc.get("substanceAbuse") or {}).get("status")) == "yes":
        return True
    return False


def are_step2_history_chips_routine_confirmed(chips: dict) -> bool:
    """True only when C-04, C-05, C-08, C-09, C-10 are all routine-confirmed (no 'unknown') AND zero high-risk flags."""
    if not isinstance(chips, dict) or has_high_risk_preop_history(chips):
        return False
    comorb = chips.get("comorbidities") or {}
    if not comorb.get("confirmed") or not (comorb.get("values") or []):
        return False
    anti = chips.get("antithromboticPlan") or {}
    if not anti.get("confirmed") or anti.get("mode") not in VALID_ANTITHROMBOTIC_MODES:
        return False
    sh = chips.get("surgicalHistory") or {}
    if not sh.get("confirmed") or sh.get("status") not in ("none", "present"):
        return False
    al = chips.get("allergyHistory") or {}
    if not al.get("confirmed") or al.get("status") not in ("none", "present"):
        return False
    soc = chips.get("socialHabits") or {}
    smk = soc.get("smoking") or {}
    sub = soc.get("substanceAbuse") or {}
    if (
        not soc.get("confirmed")
        or soc.get("alcoholUse") not in ("none", "occasional", "dependent")
        or smk.get("status") not in ("no", "current", "former")
        or sub.get("status") not in ("no", "yes")
    ):
        return False
    return True


def build_initial_unverified_structures(surgery: dict, catalog: dict, db: dict) -> dict:
    """Builds clean unverified Stage 1 + Stage 2 structures (all states = unverified, confirmed = False)."""
    approach = surgery.get("approachType") or "mo"
    sug_group = suggest_pathology_group(surgery.get("diagnosis", ""))
    sug_code, sug_class, _ = suggest_procedure_from_method(catalog, surgery.get("method", ""), approach)
    col_meta = evaluate_column_compliance(
        catalog,
        db,
        main_surgeon_id=surgery.get("mainSurgeon"),
        approach_type=approach,
        surgery_date=surgery.get("date", ""),
        confirmed_class=None,
        confirmed_catalog_id=None,
    )
    urgency = suggest_urgency_level(surgery.get("surgeryType"))
    sug_sh = suggest_surgical_history(surgery.get("diagnosis", ""), surgery.get("method", ""))

    ck = {}
    for code in CK_CODES:
        item = {"state": "unverified", "preparedByStaffId": None, "verifiedByStaffId": None}
        if code == "CK-02":
            item["subChecks"] = {
                "preAnesthesiaExam": "unverified",
                "ecg": "unverified",
                "chestImaging": "unverified",
                "echo": "unverified",
            }
        ck[code] = item

    return {
        "podAssignment": {
            "wardRoom": None,
            "suggestedPodId": None,
            "preparedByStaffId": None,
            "podSnapshot": None,
        },
        "clinicalClassification": {
            "approachType": approach,
            "pathologyGroup": {
                "suggestedValue": sug_group,
                "confirmedValue": None,
                "confirmedByStaffId": None,
            },
            "procedureClass": {
                "suggestedCatalogCode": sug_code,
                "suggestedClass": sug_class,
                "confirmedCatalogEntryId": None,
                "confirmedClass": None,
                "confirmedByStaffId": None,
            },
            "columnCompliance": {
                **col_meta,
                "declaredMode": None,
            },
            "urgencyLevel": urgency,
        },
        "preopChecklist": ck,
        "clinicalChips": {
            "comorbidities": {
                "confirmed": False,
                "suggestedValues": ["none"],
                "values": [],
                "medicalTreatmentNote": None,
                "otherComorbidityNote": "",
            },
            "surgicalHistory": {
                "confirmed": False,
                "suggestedStatus": sug_sh["suggestedStatus"],
                "suggestedCategories": sug_sh["suggestedCategories"],
                "status": None,
                "categories": [],
                "abdominalScarType": "not_applicable",
                "detailNote": None,
            },
            "allergyHistory": {
                "confirmed": False,
                "suggestedStatus": "none",
                "status": None,
                "allergenGroups": [],
                "reactionSeverity": None,
                "allergenDetail": None,
            },
            "socialHabits": {
                "confirmed": False,
                "alcoholUse": None,
                "smoking": {"status": None, "packYears": None, "packYearsUnknown": False},
                "substanceAbuse": {"status": None, "substanceNote": None},
            },
            "antithromboticPlan": {"confirmed": False, "mode": None},
            "bloodAndDevices": {"confirmed": False, "values": []},
            "stomaPlan": {"confirmed": False, "value": None},
            "contextChips": {},
        },
        "archivedGroupData": [],
    }


def normalize_admission_id(raw_adm) -> str:
    s = str(raw_adm or "").strip().upper()
    return re.sub(r"[^A-Z0-9]", "", s)


def normalize_patient_name_key(raw_name) -> str:
    txt = str(raw_name or "")
    txt = re.sub(r"^\s*\[test\]\s*", "", txt, flags=re.I)
    return strip_vn_accents(txt)


def _slim_conflict_case(rec: dict) -> dict:
    return {
        "id": rec.get("id"),
        "episodeId": rec.get("episodeId"),
        "patientName": rec.get("patientName"),
        "birthYear": rec.get("birthYear"),
        "admissionId": rec.get("admissionId"),
        "date": rec.get("date"),
        "surgeryType": rec.get("surgeryType"),
        "approachType": rec.get("approachType"),
        "method": rec.get("method"),
        "diagnosis": rec.get("diagnosis"),
        "mainSurgeon": rec.get("mainSurgeon"),
        "approvalStatus": ((rec.get("approval") or {}).get("status")),
    }


def _days_between_iso(d1: str, d2: str):
    if not (is_valid_iso_date(d1 or "") and is_valid_iso_date(d2 or "")):
        return None
    dt1 = datetime.strptime(d1, "%Y-%m-%d").date()
    dt2 = datetime.strptime(d2, "%Y-%m-%d").date()
    return abs((dt1 - dt2).days)


def validate_and_assign_episode_identity(
    *,
    rec: dict,
    raw_client_override,
    active_pool: list,
    user: dict,
    old_rec: dict = None,
) -> None:
    """
    2-Tier Server-Side Multi-Episode Duplicate Protection inside `_DB_LOCK_FILE` (Mục 2.D, SYN-TC-34..35):
      - NEVER auto-merges by `patientName + birthYear`.
      - Isolates `isTestSandboxCase == True` from real patients and ignores `surgeriesTrash`.
      - Tier 1 (`admissionId` normalized):
          * `409 ADMISSION_ID_PATIENT_MISMATCH` if active `admissionId` belongs to a different patient name.
          * `409 DUPLICATE_ACTIVE_ADMISSION_CASE` if same patient within `<= 60` days without `same_admission_multistage`.
      - Tier 2 (`patientName + birthYear` accent-stripped within `365` days, or same-day missing `birthYear`):
          * `409 POTENTIAL_DUPLICATE_CONFIRM_REQUIRED` unless valid `duplicateOverride` is provided.
      - Strips any client-supplied `confirmedByStaffId`/`confirmedBy` and stamps real JWT actor identity.
    """
    is_sbx = bool(rec.get("isTestSandboxCase") is True)
    sid = rec.get("id")
    norm_adm = normalize_admission_id(rec.get("admissionId"))
    norm_name = normalize_patient_name_key(rec.get("patientName"))
    rec_by = rec.get("birthYear")
    rec_date = str(rec.get("date") or "")

    # Check if identity/date fields are unchanged on an existing surgery -> preserve existing episodeId without re-prompting
    if isinstance(old_rec, dict):
        unchanged_identity = (
            normalize_patient_name_key(old_rec.get("patientName")) == norm_name
            and (old_rec.get("birthYear") or None) == (rec_by or None)
            and normalize_admission_id(old_rec.get("admissionId")) == norm_adm
            and str(old_rec.get("date") or "") == rec_date
        )
        if unchanged_identity:
            if not rec.get("episodeId"):
                rec["episodeId"] = old_rec.get("episodeId") or str(uuid.uuid4())
            return

    same_partition = [
        o for o in (active_pool or [])
        if isinstance(o, dict)
        and o.get("id") != sid
        and bool(o.get("isTestSandboxCase") is True) == is_sbx
    ]

    clean_ov = raw_client_override if isinstance(raw_client_override, dict) else None
    actor_staff_id = int(user["staffId"]) if (isinstance(user, dict) and is_pos_int(user.get("staffId"))) else None
    actor_username = str((user or {}).get("sub") or (user or {}).get("username") or "")

    def _stamp_override(res_code: str, matched_case: dict, reason_chip: str, note_txt: str) -> dict:
        return {
            "resolution": res_code,
            "matchedWithId": matched_case.get("id"),
            "reasonChip": reason_chip,
            "note": note_txt or None,
            "confirmedByStaffId": actor_staff_id,
            "confirmedByUsername": actor_username,
            "confirmedAt": now_vn_iso(),
        }

    tier1_matched_same_patient = None

    # ── Tier 1: Normalized `admissionId` conflict check ──
    if norm_adm:
        for other in same_partition:
            other_adm = normalize_admission_id(other.get("admissionId"))
            if other_adm != norm_adm:
                continue
            other_name = normalize_patient_name_key(other.get("patientName"))
            if norm_name and other_name and norm_name != other_name:
                raise ApprovalEngineError(
                    409,
                    "ADMISSION_ID_PATIENT_MISMATCH",
                    f"Số nhập viện '{norm_adm}' đang thuộc về người bệnh '{other.get('patientName')}' (ca #{other.get('id')}). Vui lòng kiểm tra lại số nhập viện.",
                    {"tier": 1, "matchedCase": _slim_conflict_case(other)},
                )
            d_gap = _days_between_iso(rec_date, str(other.get("date") or ""))
            if d_gap is None or d_gap <= 60:
                tier1_matched_same_patient = other
                break

    if tier1_matched_same_patient is not None:
        other = tier1_matched_same_patient
        ov_res = (clean_ov or {}).get("resolution")
        ov_match = (clean_ov or {}).get("matchedWithId")
        ov_chip = str((clean_ov or {}).get("reasonChip") or "planned_two_stage").strip()
        ov_note = str((clean_ov or {}).get("note") or "").strip()
        valid_t1_chips = {"planned_two_stage", "reoperation_complication", "combined_staged_procedure", "other"}
        if (
            ov_res == "same_admission_multistage"
            and (ov_match is None or ov_match == other.get("id"))
            and ov_chip in valid_t1_chips
            and (ov_chip != "other" or len(ov_note) >= 5)
        ):
            shared_ep = other.get("episodeId") or str(uuid.uuid4())
            other["episodeId"] = shared_ep
            rec["episodeId"] = shared_ep
            rec["priorEpisodeId"] = None
            rec["duplicateOverride"] = _stamp_override("same_admission_multistage", other, ov_chip, ov_note)
            return
        raise ApprovalEngineError(
            409,
            "DUPLICATE_ACTIVE_ADMISSION_CASE",
            f"Người bệnh '{rec.get('patientName')}' đã có ca mổ đang hoạt động cùng số nhập viện '{norm_adm}' (ca #{other.get('id')} ngày {other.get('date')}).",
            {
                "tier": 1,
                "matchedCase": _slim_conflict_case(other),
                "allowedResolutions": ["same_admission_multistage"],
            },
        )

    # ── Tier 2: Normalized `patientName + birthYear` within 365 days (or same-day missing birthYear) ──
    tier2_match = None
    if norm_name:
        for other in same_partition:
            other_name = normalize_patient_name_key(other.get("patientName"))
            if other_name != norm_name:
                continue
            other_by = other.get("birthYear")
            other_date = str(other.get("date") or "")
            if is_pos_int(rec_by) and is_pos_int(other_by):
                if int(rec_by) != int(other_by):
                    continue
                d_gap = _days_between_iso(rec_date, other_date)
                if d_gap is None or d_gap <= 365:
                    tier2_match = other
                    break
            else:
                if rec_date and other_date and rec_date == other_date:
                    tier2_match = other
                    break

    if tier2_match is not None:
        other = tier2_match
        ov_res = (clean_ov or {}).get("resolution")
        ov_match = (clean_ov or {}).get("matchedWithId")
        ov_chip = str((clean_ov or {}).get("reasonChip") or "").strip()
        ov_note = str((clean_ov or {}).get("note") or "").strip()
        if ov_res in VALID_DUPLICATE_RESOLUTIONS and (ov_match is None or ov_match == other.get("id")):
            if ov_res == "new_episode_same_patient":
                chip_eff = ov_chip or "stoma_closure_reversal"
                if chip_eff not in VALID_DUPLICATE_REASON_CHIPS or (chip_eff == "other" and len(ov_note) < 5):
                    raise ApprovalEngineError(422, "DUPLICATE_REASON_NOTE_REQUIRED", "Vui lòng chọn lý do đợt điều trị mới hợp lệ.")
                other_ep = other.get("episodeId") or str(uuid.uuid4())
                other["episodeId"] = other_ep
                rec["episodeId"] = str(uuid.uuid4())
                rec["priorEpisodeId"] = other_ep
                rec["duplicateOverride"] = _stamp_override("new_episode_same_patient", other, chip_eff, ov_note)
                return
            if ov_res == "same_admission_multistage":
                chip_eff = ov_chip or "planned_two_stage"
                if chip_eff not in VALID_DUPLICATE_REASON_CHIPS or (chip_eff == "other" and len(ov_note) < 5):
                    raise ApprovalEngineError(422, "DUPLICATE_REASON_NOTE_REQUIRED", "Vui lòng chọn lý do mổ nhiều thì hợp lệ.")
                shared_ep = other.get("episodeId") or str(uuid.uuid4())
                other["episodeId"] = shared_ep
                rec["episodeId"] = shared_ep
                rec["priorEpisodeId"] = None
                rec["duplicateOverride"] = _stamp_override("same_admission_multistage", other, chip_eff, ov_note)
                return
            if ov_res == "different_patient_same_name":
                chip_eff = ov_chip or "same_name_different_person"
                rec["episodeId"] = str(uuid.uuid4())
                rec["priorEpisodeId"] = None
                rec["duplicateOverride"] = _stamp_override("different_patient_same_name", other, chip_eff, ov_note)
                return

        raise ApprovalEngineError(
            409,
            "POTENTIAL_DUPLICATE_CONFIRM_REQUIRED",
            f"Phát hiện hồ sơ trùng Họ tên & Năm sinh trong vòng 365 ngày với ca #{other.get('id')} ({other.get('patientName')}, ngày mổ {other.get('date')}). Vui lòng chọn hướng xử lý.",
            {
                "tier": 2,
                "matchedCase": _slim_conflict_case(other),
                "allowedResolutions": [
                    "new_episode_same_patient",
                    "same_admission_multistage",
                    "different_patient_same_name",
                ],
            },
        )

    if not rec.get("episodeId"):
        rec["episodeId"] = (old_rec or {}).get("episodeId") or str(uuid.uuid4())


def initialize_new_surgery_record(rec: dict, catalog: dict, db: dict) -> dict:
    """Initializes a brand-new or cloned surgery record cleanly.
    When sandboxOnlyMode is True, real surgeries (isTestSandboxCase != True) stay 100% free of approval metadata,
    while receiving an immutable `episodeId` (`UUID v4`).
    """
    rec = normalize_surgery_aliases(rec, None)
    for f in SERVER_OWNED_SURGERY_FIELDS:
        rec.pop(f, None)

    main_surgeon = rec.get("mainSurgeon")
    if is_pos_int(main_surgeon) and main_surgeon in TRAINEE_STAFF_IDS:
        raise ApprovalEngineError(
            422,
            "INVALID_MAIN_SURGEON",
            "Bác sĩ học viên / Bác sĩ nội trú chưa xếp cột không được đứng tên BS mổ chính.",
        )

    rec["episodeId"] = str(uuid.uuid4())
    rec["priorEpisodeId"] = None

    cfg = get_approval_config(db)
    if cfg.get("sandboxOnlyMode") is True and rec.get("isTestSandboxCase") is not True:
        for k in APPROVAL_METADATA_FIELDS_TO_STRIP:
            rec.pop(k, None)
        return rec

    rec["schemaVersion"] = SCHEMA_VERSION
    rec["ruleVersion"] = RULE_VERSION
    rec["caseRevision"] = 1
    rec["lastJournalSeq"] = int(db.get("_lastApprovalJournalSeq", 0) or 0)
    rec["lastAttributionSeq"] = int(db.get("_lastAttributionJournalSeq", 0) or 0)
    rec["preparationContributors"] = []

    in_scope, scope_reason = is_in_phase1_approval_scope(rec, cfg)

    if rec.get("approachType") == "nsth":
        rec["podAssignment"] = None
        rec["clinicalClassification"] = None
        rec["preopChecklist"] = None
        rec["clinicalChips"] = None
        rec["archivedGroupData"] = []
        rec["approval"] = {
            "status": "nsth_external_authority",
            "activeHold": None,
            "slaStatus": "not_applicable",
            "blockingReasons": [],
            "submittedSnapshot": None,
            "approvedSnapshot": None,
        }
    elif not in_scope:
        if rec.get("isTestSandboxCase") is True:
            init_parts = build_initial_unverified_structures(rec, catalog, db)
            rec.update(init_parts)
        else:
            rec["podAssignment"] = None
            rec["clinicalClassification"] = None
            rec["preopChecklist"] = None
            rec["clinicalChips"] = None
            rec["archivedGroupData"] = []
        rec["approval"] = {
            "status": "legacy_exempt" if scope_reason == "before_rollout" else "not_in_scope",
            "activeHold": None,
            "slaStatus": "not_applicable",
            "blockingReasons": [],
            "submittedSnapshot": None,
            "approvedSnapshot": None,
        }
    else:
        init_parts = build_initial_unverified_structures(rec, catalog, db)
        rec.update(init_parts)
        rec["approval"] = {
            "status": "draft_unsubmitted",
            "activeHold": None,
            "slaStatus": "pending",
            "blockingReasons": [],
            "submittedSnapshot": None,
            "approvedSnapshot": None,
        }
    return stamp_badge_fields(rec)


# ───────────────────────── Alias Normalization & Write-Path Guard ─────────────────────────

def normalize_surgery_aliases(new_rec: dict, old_rec: dict = None) -> dict:
    """
    Bidirectional alias normalization BEFORE Tier A comparison (CORE-TC-06b):
    surgeon <-> mainSurgeon
    procedure <-> method
    assistant <-> assistSurgeon1
    admissionNumber <-> admissionId
    yearOfBirth <-> birthYear
    If a client sends a modified legacy alias while canonical field was untouched, the modified alias wins!
    """
    r = copy.deepcopy(new_rec)
    pairs = [
        ("mainSurgeon", "surgeon", True),
        ("method", "procedure", False),
        ("assistSurgeon1", "assistant", True),
        ("admissionId", "admissionNumber", False),
        ("birthYear", "yearOfBirth", True),
    ]
    for canon, alias, is_int_field in pairs:
        has_canon = canon in r and r[canon] not in (None, "")
        has_alias = alias in r and r[alias] not in (None, "")
        old_canon = (old_rec or {}).get(canon)
        if has_alias and (not has_canon or (old_rec is not None and r.get(canon) == old_canon and r.get(alias) != old_canon)):
            val = r[alias]
            if is_int_field and isinstance(val, str) and val.strip().isdigit():
                val = int(val.strip())
            r[canon] = val
        elif has_canon and is_int_field and isinstance(r[canon], str) and r[canon].strip().isdigit():
            r[canon] = int(r[canon].strip())
        r.pop(alias, None)

    if is_pos_int(r.get("mainSurgeon")):
        r["mainSurgeonStaffId"] = int(r["mainSurgeon"])
    else:
        r.pop("mainSurgeonStaffId", None)

    if is_pos_int(r.get("assistSurgeon1")):
        r["assistSurgeonStaffId"] = int(r["assistSurgeon1"])
    else:
        r.pop("assistSurgeonStaffId", None)

    return r


def protect_and_reconcile_surgeries_put(
    *,
    user: dict,
    old_items: list,
    candidate_items: list,
    db: dict,
    data_dir: str,
    base_dir: str,
) -> list:
    """
    Zero-Bypass Guard on PUT /api/data/surgeries (covers both atomic merge & direct paths):
    1. Rejects any ID currently sitting in surgeriesTrash (409 USE_DEDICATED_TRASH_RESTORE_API).
    2. Normalizes legacy aliases (surgeon, procedure, assistant, admissionNumber, yearOfBirth).
    3. Blocks trainee as mainSurgeon (422 INVALID_MAIN_SURGEON).
    4. Strips 100% of SERVER_OWNED_SURGERY_FIELDS from client payload.
    5. Runs 2-Tier Server-Side Multi-Episode Duplicate Check (`episodeId` + `admissionId`, zero auto-merge).
    6. Detects QĐ3 scope transitions (`in_scope` <-> `not_in_scope`), Tier A schedule modifications,
       `assistSurgeon1` proxy-submit invalidation, custom procedure `verifiedClass` invalidation,
       and writes dual-journal WAL entries atomically.
    """
    catalog = load_procedure_catalog(data_dir, base_dir)
    cfg = get_approval_config(db)
    rollout_date = cfg.get("rolloutEffectiveSurgeryDate", "2026-11-09")

    trash_ids = {t.get("id") for t in (db.get("surgeriesTrash") or []) if isinstance(t, dict) and is_pos_int(t.get("id"))}
    old_map = {r.get("id"): r for r in (old_items or []) if isinstance(r, dict) and is_pos_int(r.get("id"))}

    allow_sbx = can_user_access_sandbox(user, db)
    candidate_ids = {r.get("id") for r in candidate_items if isinstance(r, dict) and is_pos_int(r.get("id"))}
    hidden_sandbox_records = []
    for old_r in (old_items or []):
        if not isinstance(old_r, dict) or not is_pos_int(old_r.get("id")):
            continue
        oid = old_r.get("id")
        if oid not in candidate_ids:
            if old_r.get("isTestSandboxCase") is True and not allow_sbx:
                hidden_sandbox_records.append(copy.deepcopy(old_r))
            else:
                raise ApprovalEngineError(
                    409,
                    "USE_ATOMIC_TRASH_ENDPOINT",
                    f"Không được xóa trực tiếp ca mổ #{oid} qua PUT hàng loạt. Vui lòng dùng API nguyên tử POST /api/surgeries/{oid}/trash.",
                )

    out_items = []
    pending_wal_events = []
    # Pool of active surgeries for duplicate detection (already-processed `out_items` + remaining `old_items`)
    processed_ids = set()

    for raw_new in candidate_items:
        sid = raw_new.get("id")
        if sid in trash_ids and sid not in old_map:
            raise ApprovalEngineError(
                409,
                "USE_DEDICATED_TRASH_RESTORE_API",
                f"Ca mổ #{sid} đang nằm trong Thùng rác. Vui lòng khôi phục qua POST /api/surgeries/{sid}/restore.",
            )

        raw_client_override = raw_new.get("duplicateOverride") if isinstance(raw_new, dict) else None
        remaining_old = [
            r for r in (old_items or [])
            if isinstance(r, dict) and r.get("id") not in processed_ids and r.get("id") != sid and r.get("id") in candidate_ids
        ]
        active_pool = out_items + remaining_old + hidden_sandbox_records

        if sid not in old_map:
            raw_clean = copy.deepcopy(raw_new)
            wants_sandbox = raw_clean.get("isTestSandboxCase") is True
            if wants_sandbox and allow_sbx:
                raw_clean["isTestSandboxCase"] = True
                pname = str(raw_clean.get("patientName") or "").strip()
                if pname and "[test]" not in pname.lower():
                    raw_clean["patientName"] = f"[TEST] {pname}"
            else:
                raw_clean.pop("isTestSandboxCase", None)
            fresh = initialize_new_surgery_record(raw_clean, catalog, db)
            validate_and_assign_episode_identity(
                rec=fresh,
                raw_client_override=raw_client_override,
                active_pool=active_pool,
                user=user,
                old_rec=None,
            )
            out_items.append(fresh)
            processed_ids.add(sid)
            if fresh.get("isTestSandboxCase") is True:
                pending_wal_events.append((fresh, 0, int(fresh.get("caseRevision", 1) or 1), "sandbox_create_from_schedule", [], None))
            continue

        old_r = old_map[sid]
        norm_new = normalize_surgery_aliases(raw_new, old_r)

        ms = norm_new.get("mainSurgeon")
        if is_pos_int(ms) and ms in TRAINEE_STAFF_IDS:
            raise ApprovalEngineError(
                422,
                "INVALID_MAIN_SURGEON",
                "Bác sĩ học viên / Bác sĩ nội trú chưa xếp cột không được đứng tên BS mổ chính.",
            )

        merged = copy.deepcopy(norm_new)
        if old_r.get("isTestSandboxCase") is True:
            merged["isTestSandboxCase"] = True
            pname = str(merged.get("patientName") or "").strip()
            if pname and "[test]" not in pname.lower():
                merged["patientName"] = f"[TEST] {pname}"
        else:
            merged.pop("isTestSandboxCase", None)

        for sf in SERVER_OWNED_SURGERY_FIELDS:
            if sf in old_r:
                merged[sf] = copy.deepcopy(old_r[sf])
            else:
                merged.pop(sf, None)

        validate_and_assign_episode_identity(
            rec=merged,
            raw_client_override=raw_client_override,
            active_pool=active_pool,
            user=user,
            old_rec=old_r,
        )

        if cfg.get("sandboxOnlyMode") is True and merged.get("isTestSandboxCase") is not True and old_r.get("isTestSandboxCase") is not True:
            for k in APPROVAL_METADATA_FIELDS_TO_STRIP:
                merged.pop(k, None)
            out_items.append(merged)
            processed_ids.add(sid)
            continue

        if not is_strict_int(merged.get("caseRevision")) or merged.get("caseRevision", 0) < 1:
            merged["caseRevision"] = 1
        merged["schemaVersion"] = SCHEMA_VERSION
        merged["ruleVersion"] = RULE_VERSION
        merged.setdefault("preparationContributors", [])
        merged.setdefault("lastAttributionSeq", int(old_r.get("lastAttributionSeq", 0) or 0))

        changed_tier_a = []
        for tf in TIER_A_SCHEDULE_FIELDS:
            if (old_r.get(tf) or None) != (merged.get(tf) or None):
                changed_tier_a.append(tf)

        assist1_changed = (old_r.get("assistSurgeon1") or None) != (merged.get("assistSurgeon1") or None)
        approval_cur = merged.get("approval") or {}
        proxy_assist1_active = (
            assist1_changed
            and approval_cur.get("status") in ("submitted", "preapproved")
            and ((approval_cur.get("submittedSnapshot") or {}).get("proxySubmitterSource")) == "assist_surgeon_1"
        )

        if changed_tier_a or proxy_assist1_active:
            rev_before = int(merged.get("caseRevision", 1))
            rev_after = rev_before + 1
            merged["caseRevision"] = rev_after

            approval = merged.setdefault("approval", {"status": "draft_unsubmitted", "activeHold": None})
            old_status = approval.get("status", "draft_unsubmitted")
            old_approach = old_r.get("approachType")
            new_approach = merged.get("approachType")
            new_date = merged.get("date", "")
            in_scope_now, scope_reason_now = is_in_phase1_approval_scope(merged, cfg)

            transition_action = None

            if new_approach == "nsth" and old_approach != "nsth":
                if approval.get("approvedSnapshot"):
                    approval["lastApprovedSnapshot"] = copy.deepcopy(approval["approvedSnapshot"])
                approval["approvedSnapshot"] = None
                approval["activeHold"] = None
                approval["status"] = "nsth_external_authority"
                transition_action = "schedule_switch_to_nsth"
            elif not in_scope_now and new_approach != "nsth":
                if approval.get("approvedSnapshot"):
                    approval["lastApprovedSnapshot"] = copy.deepcopy(approval["approvedSnapshot"])
                approval["approvedSnapshot"] = None
                approval["activeHold"] = None
                approval["status"] = "legacy_exempt" if scope_reason_now == "before_rollout" else "not_in_scope"
                approval["slaStatus"] = "not_applicable"
                transition_action = "schedule_switch_to_not_in_scope"
            elif old_approach == "nsth" and new_approach in ("mo", "noisoi", "robot") and in_scope_now:
                init_parts = build_initial_unverified_structures(merged, catalog, db)
                for k_init, v_init in init_parts.items():
                    if merged.get(k_init) is None:
                        merged[k_init] = v_init
                approval["approvedSnapshot"] = None
                approval["activeHold"] = None
                approval["status"] = "draft_unsubmitted"
                transition_action = "schedule_switch_from_nsth_to_surgical"
            elif old_status == "not_in_scope" and in_scope_now:
                init_parts = build_initial_unverified_structures(merged, catalog, db)
                for k_init, v_init in init_parts.items():
                    if merged.get(k_init) is None:
                        merged[k_init] = v_init
                approval["approvedSnapshot"] = None
                approval["activeHold"] = None
                approval["status"] = "draft_unsubmitted"
                approval["slaStatus"] = "pending"
                transition_action = "schedule_switch_from_not_in_scope_to_elective"
            elif old_status in ("legacy_exempt", "legacy_unverified_manual_review") and is_valid_iso_date(new_date) and new_date >= rollout_date and in_scope_now:
                init_parts = build_initial_unverified_structures(merged, catalog, db)
                merged.update(init_parts)
                approval["approvedSnapshot"] = None
                approval["activeHold"] = None
                approval["status"] = "draft_unsubmitted"
                transition_action = "legacy_rescheduled_into_active_gate_m6"
            elif proxy_assist1_active and not changed_tier_a:
                approval["status"] = "resubmit_required"
                approval["invalidationReason"] = "Đổi BS phụ mổ 1 sau khi đã trình duyệt thay — cần trình duyệt lại"
                transition_action = "assist_surgeon_1_changed_after_proxy_submit"
            elif old_status in ("approved", "approved_with_exception", "post_approval_hold"):
                if approval.get("approvedSnapshot"):
                    approval["lastApprovedSnapshot"] = copy.deepcopy(approval["approvedSnapshot"])
                approval["approvedSnapshot"] = None
                approval["activeHold"] = None
                approval["status"] = "reapproval_required"
                approval["invalidationReason"] = f"Thay đổi trường trọng yếu trên lịch mổ: {', '.join(changed_tier_a)}"
                transition_action = "tier_a_schedule_edit_invalidated_approval"
            elif old_status in ("submitted", "preapproved", "emergency_exception_pending_ack"):
                approval["status"] = "resubmit_required"
                approval["invalidationReason"] = f"Thay đổi trường trọng yếu khi đang trình duyệt: {', '.join(changed_tier_a or ['assistSurgeon1'])}"
                transition_action = "tier_a_schedule_edit_requires_resubmit"

            # Refresh suggestions, invalidate custom verifiedClass & CK-08 on method/approach/surgeon change (SYN-TC-13 & Mục 4.C)
            if merged.get("approachType") in ("mo", "noisoi", "robot") and isinstance(merged.get("clinicalClassification"), dict):
                cc = merged["clinicalClassification"]
                cc["approachType"] = merged.get("approachType")
                sug_code, sug_class, _ = suggest_procedure_from_method(catalog, merged.get("method", ""), merged.get("approachType"))
                pc = cc.setdefault("procedureClass", {})
                pc["suggestedCatalogCode"] = sug_code
                pc["suggestedClass"] = sug_class
                if any(f in changed_tier_a for f in ("method", "approachType", "mainSurgeon")):
                    if "method" in changed_tier_a or "approachType" in changed_tier_a:
                        pc["confirmedCatalogEntryId"] = None
                        pc["confirmedClass"] = None
                        pc["confirmedByStaffId"] = None
                    if pc.get("verifiedClass") is not None or pc.get("isCustomProcedure"):
                        pc["verifiedClass"] = None
                        pc["verifiedBasisCode"] = None
                        pc["verifiedBasisNote"] = None
                        pc["verifiedByStaffId"] = None
                        pc["verifiedAt"] = None
                        if pc.get("isCustomProcedure") and pc.get("proposedClass"):
                            pc["confirmedClass"] = pc.get("proposedClass")
                    ck08 = (merged.get("preopChecklist") or {}).get("CK-08")
                    if isinstance(ck08, dict) and ck08.get("verifiedByStaffId") is not None:
                        ck08["verifiedByStaffId"] = None
                        ck08["state"] = "unverified"
                        ck08["needsReverify"] = True
                        ck08["uiBannerText"] = STALE_VERIFICATION_LABEL_VI
                col_meta = evaluate_column_compliance(
                    catalog,
                    db,
                    main_surgeon_id=merged.get("mainSurgeon"),
                    approach_type=merged.get("approachType"),
                    surgery_date=merged.get("date", ""),
                    confirmed_class=pc.get("confirmedClass"),
                    confirmed_catalog_id=pc.get("confirmedCatalogEntryId"),
                    is_custom_procedure=bool(pc.get("isCustomProcedure")),
                    proposed_class=pc.get("proposedClass"),
                    verified_class=pc.get("verifiedClass"),
                )
                old_decl = (cc.get("columnCompliance") or {}).get("declaredMode")
                cc["columnCompliance"] = {
                    **col_meta,
                    "declaredMode": None if any(f in changed_tier_a for f in ("mainSurgeon", "method", "approachType")) else old_decl,
                }

            stamp_badge_fields(merged)

            if transition_action or old_status != approval.get("status"):
                pending_wal_events.append((
                    merged,
                    rev_before,
                    rev_after,
                    transition_action or "tier_a_schedule_edit",
                    changed_tier_a or (["assistSurgeon1"] if proxy_assist1_active else []),
                    old_status,
                ))
        else:
            stamp_badge_fields(merged)

        out_items.append(merged)
        processed_ids.add(sid)

    out_items.extend(hidden_sandbox_records)

    for rec_ref, rev_b, rev_a, act_name, changed_fields, prev_st in pending_wal_events:
        entry = append_wal_journal_entry(
            data_dir,
            db,
            action=act_name,
            actor=user,
            surgery_id=rec_ref.get("id"),
            case_rev_before=rev_b,
            case_rev_after=rev_a,
            summary={
                "changedTierAFields": changed_fields,
                "statusBefore": prev_st,
                "statusAfter": (rec_ref.get("approval") or {}).get("status"),
                "isTestSandboxCase": bool(rec_ref.get("isTestSandboxCase") is True),
            },
            committed_state_patch={
                "patchKind": "surgery_upsert",
                "surgeryRecord": copy.deepcopy(rec_ref),
            },
        )
        rec_ref["lastJournalSeq"] = entry["eventSeq"]

    return out_items


# ───────────────────────── Migration M1..M6 + QĐ3 Scope & EpisodeId ─────────────────────────

def run_surgery_approval_migration(db: dict, data_dir: str, base_dir: str, *, force: bool = False) -> dict:
    """
    Idempotent Migration M1..M5 + QĐ3 (`not_in_scope`) + `episodeId` minting across surgeries & surgeriesTrash.
    Invariants:
      - count_before == count_after
      - Mints unique `episodeId` (`UUID v4`) per record lacking one (zero auto-merge!)
      - M1/M2 past surgeries -> legacy_exempt
      - M3 pre-created in-scope surgeries with date >= rolloutEffectiveSurgeryDate -> draft_unsubmitted
      - Out-of-scope (`yeucau`, `bankhan`) -> not_in_scope
      - M4 approachType == 'nsth' -> nsth_external_authority
      - M5 missing/invalid date or future missing mainSurgeon/method -> legacy_unverified_manual_review
    """
    cfg_prior_rule = (db.get("surgeryApprovalConfig") or {}).get("ruleVersion") if isinstance(db.get("surgeryApprovalConfig"), dict) else None
    cfg = get_approval_config(db)
    db.setdefault("surgeryApprovalConfig", copy.deepcopy(cfg))
    cfg_rule_upgraded = 0
    if isinstance(db.get("surgeryApprovalConfig"), dict):
        if cfg_prior_rule is not None and cfg_prior_rule != RULE_VERSION:
            cfg_rule_upgraded = 1
        db["surgeryApprovalConfig"]["ruleVersion"] = RULE_VERSION
    db.setdefault("approvalDelegations", [])
    db.setdefault("_approvalIdempotency", {})

    catalog = load_procedure_catalog(data_dir, base_dir)
    rollout_str = cfg.get("rolloutEffectiveSurgeryDate", "2026-11-09")
    rollout_dt = datetime.strptime(rollout_str, "%Y-%m-%d").date()
    m2_start_str = (rollout_dt - timedelta(days=2)).strftime("%Y-%m-%d")

    surgeries = db.setdefault("surgeries", [])
    trash = db.setdefault("surgeriesTrash", [])
    count_before = len(surgeries)
    trash_before = len(trash)

    sandbox_only = bool(cfg.get("sandboxOnlyMode"))
    stripped_real = strip_approval_metadata_from_real_surgeries(db) if sandbox_only else 0

    counts = {
        "M1": 0,
        "M2": 0,
        "M3": 0,
        "M4": 0,
        "M5": 0,
        "notInScope": 0,
        "mintedEpisodeIds": 0,
        "alreadyMigrated": 0,
        "upgradedV5HistoryFields": 0,
        "upgradedConfigRuleVersion": cfg_rule_upgraded,
        "strippedRealSurgeries": stripped_real,
    }

    for s in surgeries:
        if not isinstance(s, dict):
            continue
        if not s.get("episodeId"):
            s["episodeId"] = str(uuid.uuid4())
            counts["mintedEpisodeIds"] += 1
        if sandbox_only and s.get("isTestSandboxCase") is not True:
            continue
        if not force and s.get("schemaVersion") == SCHEMA_VERSION and isinstance(s.get("approval"), dict) and s["approval"].get("status"):
            if s.get("ruleVersion") != RULE_VERSION:
                if s.get("approachType") in ("mo", "noisoi", "robot") and isinstance(s.get("clinicalChips"), dict):
                    chips_m = s["clinicalChips"]
                    cm_m = chips_m.setdefault("comorbidities", {"confirmed": False, "values": []})
                    cm_m.setdefault("medicalTreatmentNote", None)
                    cm_m.setdefault("otherComorbidityNote", "")
                    app_st = s["approval"].get("status", "draft_unsubmitted")
                    sug_sh_m = suggest_surgical_history(s.get("diagnosis", ""), s.get("method", ""))
                    if app_st in ("emergency_exception_pending_ack", "approved_with_exception"):
                        chips_m.setdefault("surgicalHistory", {
                            "confirmed": True,
                            "status": "unknown",
                            "categories": [],
                            "abdominalScarType": "not_applicable",
                            "detailNote": None,
                        })
                        chips_m.setdefault("allergyHistory", {
                            "confirmed": True,
                            "status": "unknown",
                            "allergenGroups": [],
                            "reactionSeverity": None,
                            "allergenDetail": None,
                        })
                        chips_m.setdefault("socialHabits", {
                            "confirmed": True,
                            "alcoholUse": "unknown",
                            "smoking": {"status": "unknown", "packYears": None, "packYearsUnknown": False},
                            "substanceAbuse": {"status": "unknown", "substanceNote": None},
                        })
                    elif app_st in ("submitted", "preapproved", "approved", "post_approval_hold", "reapproval_required", "ready_for_attending") or cm_m.get("confirmed"):
                        chips_m.setdefault("surgicalHistory", {
                            "confirmed": True,
                            "status": "none",
                            "categories": [],
                            "abdominalScarType": "not_applicable",
                            "detailNote": None,
                        })
                        chips_m.setdefault("allergyHistory", {
                            "confirmed": True,
                            "status": "none",
                            "allergenGroups": [],
                            "reactionSeverity": None,
                            "allergenDetail": None,
                        })
                        chips_m.setdefault("socialHabits", {
                            "confirmed": True,
                            "alcoholUse": "none",
                            "smoking": {"status": "no", "packYears": None, "packYearsUnknown": False},
                            "substanceAbuse": {"status": "no", "substanceNote": None},
                        })
                    else:
                        chips_m.setdefault("surgicalHistory", {
                            "confirmed": False,
                            "suggestedStatus": sug_sh_m["suggestedStatus"],
                            "suggestedCategories": sug_sh_m["suggestedCategories"],
                            "status": None,
                            "categories": [],
                            "abdominalScarType": "not_applicable",
                            "detailNote": None,
                        })
                        chips_m.setdefault("allergyHistory", {
                            "confirmed": False,
                            "suggestedStatus": "none",
                            "status": None,
                            "allergenGroups": [],
                            "reactionSeverity": None,
                            "allergenDetail": None,
                        })
                        chips_m.setdefault("socialHabits", {
                            "confirmed": False,
                            "alcoholUse": None,
                            "smoking": {"status": None, "packYears": None, "packYearsUnknown": False},
                            "substanceAbuse": {"status": None, "substanceNote": None},
                        })
                s["ruleVersion"] = RULE_VERSION
                counts["upgradedV5HistoryFields"] += 1
            counts["alreadyMigrated"] += 1
            continue

        norm = normalize_surgery_aliases(s, None)
        s.clear()
        s.update(norm)

        s["schemaVersion"] = SCHEMA_VERSION
        s["ruleVersion"] = RULE_VERSION
        if not s.get("episodeId"):
            s["episodeId"] = str(uuid.uuid4())
        if not is_strict_int(s.get("caseRevision")) or s.get("caseRevision", 0) < 1:
            s["caseRevision"] = 1
        s["lastJournalSeq"] = int(s.get("lastJournalSeq", 0) or 0)
        s["lastAttributionSeq"] = int(s.get("lastAttributionSeq", 0) or 0)
        s.setdefault("preparationContributors", [])

        approach = s.get("approachType")
        st_type = str(s.get("surgeryType") or "chuongtrinh").strip()
        d_str = s.get("date", "")

        if approach == "nsth":
            s["podAssignment"] = None
            s["clinicalClassification"] = None
            s["preopChecklist"] = None
            s["clinicalChips"] = None
            s["archivedGroupData"] = []
            s["approval"] = {
                "status": "nsth_external_authority",
                "migrationGroup": "M4",
                "activeHold": None,
                "approvedSnapshot": None,
            }
            counts["M4"] += 1
        elif st_type not in ("chuongtrinh", "robot"):
            s["podAssignment"] = None
            s["clinicalClassification"] = None
            s["preopChecklist"] = None
            s["clinicalChips"] = None
            s["archivedGroupData"] = []
            s["approval"] = {
                "status": "not_in_scope",
                "migrationGroup": "OUT_OF_SCOPE_QD3",
                "activeHold": None,
                "approvedSnapshot": None,
            }
            counts["notInScope"] += 1
        elif not is_valid_iso_date(d_str) or (d_str >= rollout_str and (not is_pos_int(s.get("mainSurgeon")) or not str(s.get("method") or "").strip())):
            s["podAssignment"] = None
            s["clinicalClassification"] = None
            s["preopChecklist"] = None
            s["clinicalChips"] = None
            s["archivedGroupData"] = []
            s["approval"] = {
                "status": "legacy_unverified_manual_review",
                "migrationGroup": "M5",
                "activeHold": None,
                "approvedSnapshot": None,
            }
            counts["M5"] += 1
        elif d_str < m2_start_str:
            s["podAssignment"] = None
            s["clinicalClassification"] = None
            s["preopChecklist"] = None
            s["clinicalChips"] = None
            s["archivedGroupData"] = []
            s["approval"] = {
                "status": "legacy_exempt",
                "migrationGroup": "M1",
                "transitionWindowCase": False,
                "activeHold": None,
                "approvedSnapshot": None,
            }
            counts["M1"] += 1
        elif d_str < rollout_str:
            s["podAssignment"] = None
            s["clinicalClassification"] = None
            s["preopChecklist"] = None
            s["clinicalChips"] = None
            s["archivedGroupData"] = []
            s["approval"] = {
                "status": "legacy_exempt",
                "migrationGroup": "M2",
                "transitionWindowCase": True,
                "activeHold": None,
                "approvedSnapshot": None,
            }
            counts["M2"] += 1
        else:
            init_parts = build_initial_unverified_structures(s, catalog, db)
            s.update(init_parts)
            s["approval"] = {
                "status": "draft_unsubmitted",
                "migrationGroup": "M3",
                "slaGraceWindow": True,
                "activeHold": None,
                "slaStatus": "pending",
                "blockingReasons": [],
                "submittedSnapshot": None,
                "approvedSnapshot": None,
            }
            counts["M3"] += 1

        stamp_badge_fields(s)

    for t in trash:
        if not isinstance(t, dict):
            continue
        if not t.get("episodeId"):
            t["episodeId"] = str(uuid.uuid4())
            counts["mintedEpisodeIds"] += 1
        if sandbox_only and t.get("isTestSandboxCase") is not True:
            continue
        if t.get("schemaVersion") != SCHEMA_VERSION:
            prev_st = ((t.get("approval") or {}).get("status")) or ("nsth_external_authority" if t.get("approachType") == "nsth" else "legacy_exempt")
            t["schemaVersion"] = SCHEMA_VERSION
            t["ruleVersion"] = RULE_VERSION
            t["caseRevision"] = int(t.get("caseRevision", 1) or 1)
            t["previousApprovalStatus"] = prev_st
            t["approval"] = {"status": "trashed_inactive", "activeHold": None, "approvedSnapshot": None}
            stamp_badge_fields(t)

    assert len(surgeries) == count_before, "Migration invariant violated on surgeries count!"
    assert len(trash) == trash_before, "Migration invariant violated on surgeriesTrash count!"
    return {
        "rolloutEffectiveSurgeryDate": rollout_str,
        "surgeriesTotal": len(surgeries),
        "trashTotal": len(trash),
        "counts": counts,
    }


# ───────────────────────── Notification Builder & Server Filtering ─────────────────────────

def build_approval_notifications(
    db: dict,
    surgery: dict,
    *,
    actor_staff_id: int,
    event_id: str,
    notif_type: str,
    short_status_text: str,
    recipient_staff_ids: list,
) -> list:
    """
    Data-Minimized Server Notifications:
    - Never embeds full patient name + sensitive diagnosis/pathology in notification text!
    - Uses date, wardRoom/case #id, and status label only.
    - Deduplicates recipients and excludes actor_staff_id.
    - In superadmin_only mode or sandbox test case, routes strictly to superadmin (staffId=2) or simulated test scope.
    """
    cfg = get_approval_config(db)
    is_sandbox = surgery.get("isTestSandboxCase") is True
    internal_staff_ids = {
        s.get("id") for s in (db.get("staff") or [])
        if isinstance(s, dict) and is_pos_int(s.get("id"))
    }

    dedup_targets = []
    for rid in recipient_staff_ids:
        if is_pos_int(rid) and rid != actor_staff_id and rid not in dedup_targets:
            if internal_staff_ids and rid not in internal_staff_ids:
                # Skip external doctors (101..206) who do not have internal accounts
                continue
            if cfg.get("rolloutAccessMode") == "superadmin_only" and rid != DEPUTY_STAFF_ID:
                # Never leak canary notifications to non-superadmin staff bells!
                continue
            if is_sandbox and cfg.get("sandboxOnlyMode") is not True and rid != DEPUTY_STAFF_ID:
                # In Live Clinical Mode (sandboxOnlyMode == False), keep any [TEST] notifications strictly on Super Admin!
                continue
            dedup_targets.append(rid)

    if not dedup_targets:
        return []

    existing_notifs = db.get("notifications") or []
    max_nid = max([int(n["id"]) for n in existing_notifs if isinstance(n, dict) and is_pos_int(n.get("id"))], default=0)
    raw_next = int((db.get("nextIds") or {}).get("notifications", 1) or 1)
    next_id = max(raw_next, max_nid + 1)

    ward_room = ((surgery.get("podAssignment") or {}).get("wardRoom")) or "—"
    room_tag = f"P.{ward_room}" if ward_room and ward_room != "unassigned" else "Chưa xếp phòng"
    prefix = "[TEST] " if is_sandbox else ""
    msg = f"{prefix}Ca mổ #{surgery.get('id')} ({surgery.get('date') or '—'} • {room_tag}): {short_status_text}"

    created = []
    ts = now_vn_iso()
    for target_id in dedup_targets:
        created.append({
            "id": next_id,
            "sourceType": "surgery_approval",
            "sourceEventId": f"{event_id}:to:{target_id}",
            "type": notif_type,
            "surgeryId": surgery.get("id"),
            "fromStaffId": actor_staff_id,
            "toStaffId": target_id,
            "message": msg,
            "category": "📋 Duyệt mổ tại khoa",
            "createdAt": ts,
            "read": False,
            "isTestSandboxCase": is_sandbox,
        })
        next_id += 1

    db.setdefault("nextIds", {})["notifications"] = next_id
    return created


def filter_db_payload_for_user(raw_data: dict, user: dict, strip_fields: set) -> dict:
    """
    Filters GET /api/data per authenticated user:
    1. Strips sensitive server-only collections (_approvalIdempotency, surgeryApprovalLogs, etc.).
    2. Filters notifications strictly to n.toStaffId == user.staffId (CORE-TC-17, TC-17).
    3. Hides synthetic sandbox cases (isTestSandboxCase == True) from non-superadmin users!
    """
    staff_id = (user or {}).get("staffId")
    is_sa = bool((user or {}).get("isSuperAdmin"))
    allow_sbx = can_user_access_sandbox(user, raw_data)

    out = {}
    for k, v in raw_data.items():
        if k in strip_fields:
            continue
        if k == "notifications" and isinstance(v, list):
            out[k] = [
                n for n in v
                if isinstance(n, dict)
                and n.get("toStaffId") == staff_id
                and (allow_sbx or n.get("isTestSandboxCase") is not True)
            ]
        elif k in ("surgeries", "surgeriesTrash") and isinstance(v, list) and not allow_sbx:
            out[k] = [s for s in v if isinstance(s, dict) and s.get("isTestSandboxCase") is not True]
        elif k == "approvalDelegations" and isinstance(v, list):
            cfg_mode = get_approval_config(raw_data).get("rolloutAccessMode", "superadmin_only")
            if not is_sa and cfg_mode == "superadmin_only":
                out[k] = []
            elif not is_sa:
                out[k] = [d for d in v if isinstance(d, dict) and d.get("isTestSandboxDelegation") is not True]
            else:
                out[k] = v
        elif k == "surgeryApprovalConfig" and isinstance(v, dict) and not is_sa:
            if v.get("rolloutAccessMode") == "superadmin_only":
                out[k] = {"rolloutAccessMode": "superadmin_only", "zeroHisCoupling": True}
            else:
                out[k] = v
        else:
            out[k] = v
    return out


# ───────────────────────── Gate Validation (Stage 1 + Stage 2) ─────────────────────────

def compute_sla_status(surgery: dict, cfg: dict, urgency: str) -> str:
    """Computes milestone compliance against Phase-1 single deadline: 16:00 ngày N-2."""
    if urgency == "emergency_exception":
        return "emergency_exempt"
    in_scope, _ = is_in_phase1_approval_scope(surgery, cfg)
    if not in_scope:
        return "not_in_scope"
    approval = surgery.get("approval") or {}
    if approval.get("slaGraceWindow") is True:
        return "grace_window_on_time"
    d_str = surgery.get("date", "")
    if not is_valid_iso_date(d_str):
        return "unknown"
    s_date = datetime.strptime(d_str, "%Y-%m-%d").date()
    now = now_vn()
    sla_cfg = cfg.get("slaConfig") or {}
    dl_date = s_date - timedelta(days=int(sla_cfg.get("electiveDaysBefore", 2)))
    dl = datetime(dl_date.year, dl_date.month, dl_date.day, int(sla_cfg.get("electiveDeadlineHour", 16)), 0, tzinfo=VN_TZ)
    return "on_time" if now <= dl else "late"


def resolve_case_actor_role(surgery: dict, actor: dict, catalog: dict, db: dict) -> str:
    """Resolves the exact case-scoped role of actor for attribution & RBAC."""
    if is_trainee_user(actor):
        return "trainee"
    actor_id = (actor or {}).get("staffId")
    ms_id = surgery.get("mainSurgeon")
    coord_id = surgery.get("coordinatingAttendingStaffId") or (surgery.get("interdisciplinaryCoordination") or {}).get("coordinatingAttendingStaffId")
    if is_pos_int(actor_id) and actor_id == ms_id:
        return "main_surgeon"
    if is_pos_int(actor_id) and actor_id == coord_id:
        return "coordinating_attending"
    if is_pos_int(actor_id) and actor_id == surgery.get("assistSurgeon1") and actor_id in ATTENDING_STAFF_IDS:
        return "assist_surgeon_1"
    if is_pos_int(actor_id) and is_same_pod_attending(catalog, surgery, actor_id, surgery_date=surgery.get("date"), db=db):
        return "pod_attending"
    if actor_id == CHIEF_STAFF_ID:
        return "bcn_chief"
    if actor_id == DEPUTY_STAFF_ID:
        return "bcn_deputy"
    if is_attending_user(actor):
        return "other_attending"
    return "staff"


def can_verify_restricted_checklist_item(surgery: dict, actor: dict, catalog: dict, db: dict) -> bool:
    """
    Restricted items (CK-04 Phim / nội soi gốc & CK-08 Cam kết phẫu thuật) may ONLY be verified by:
      - mainSurgeon (internal attending)
      - coordinatingAttendingStaffId (for external surgeon cases)
      - assistSurgeon1 (when attending)
      - POD server_roster attending of the patient's wardRoom
    """
    if is_trainee_user(actor):
        return False
    actor_id = (actor or {}).get("staffId")
    if not is_pos_int(actor_id) or actor_id not in ATTENDING_STAFF_IDS:
        return False
    ms_id = surgery.get("mainSurgeon")
    coord_id = surgery.get("coordinatingAttendingStaffId") or (surgery.get("interdisciplinaryCoordination") or {}).get("coordinatingAttendingStaffId")
    ext_ids = {d.get("id") for d in (db.get("externalDoctors") or []) if isinstance(d, dict) and is_pos_int(d.get("id"))}
    is_external_surgeon = is_pos_int(ms_id) and ((ms_id in ext_ids) or (ms_id >= 100))
    if is_external_surgeon:
        return bool(
            actor_id == coord_id
            or (actor_id == surgery.get("assistSurgeon1") and actor_id in ATTENDING_STAFF_IDS)
            or is_same_pod_attending(catalog, surgery, actor_id, surgery_date=surgery.get("date"), db=db)
        )
    return bool(
        actor_id == ms_id
        or actor_id == coord_id
        or (actor_id == surgery.get("assistSurgeon1") and actor_id in ATTENDING_STAFF_IDS)
        or is_same_pod_attending(catalog, surgery, actor_id, surgery_date=surgery.get("date"), db=db)
    )


def resolve_submit_authorization(
    surgery: dict,
    actor: dict,
    payload: dict,
    catalog: dict,
    db: dict,
    *,
    allow_bcn_gate_recheck: bool = False,
) -> dict:
    """
    Enforces QĐ4 Case-Level Submit Authorization:
      - Trainees (even if assistSurgeon1) -> 403 FORBIDDEN
      - Self-reported POD swap (`podMembershipSource == 'self_reported'` or `roleContextSource == 'self_reported'`) -> 403 NOT_AUTHORIZED_PROXY_SUBMITTER
      - External surgeon (`mainSurgeon >= 100`) -> requires coordinatingAttendingStaffId (`422 COORDINATING_ATTENDING_REQUIRED`),
        only `coordinatingAttendingStaffId` may submit (`403 NOT_CASE_ATTENDING`).
      - Internal surgeon -> ONLY:
          (a) `mainSurgeon` directly
          (b) `assistSurgeon1` (must be internal attending in ATTENDING_STAFF_IDS) + 1-tap `proxyReasonCode`
          (c) `POD attending` on active `server_roster` of patient's `wardRoom` + 1-tap `proxyReasonCode`
    """
    ms_id = surgery.get("mainSurgeon")
    if not is_pos_int(ms_id):
        raise ApprovalEngineError(422, "MISSING_MAIN_SURGEON", "Vui lòng chọn BS mổ chính trước khi trình duyệt.")
    if ms_id in TRAINEE_STAFF_IDS:
        raise ApprovalEngineError(422, "INVALID_MAIN_SURGEON", "Bác sĩ học viên không được đứng tên BS mổ chính.")

    if is_trainee_user(actor):
        raise ApprovalEngineError(
            403,
            "FORBIDDEN",
            "Bác sĩ học viên không có quyền bấm Trình duyệt mổ (vui lòng dùng nút Gửi BS chính xác nhận).",
        )

    actor_id = (actor or {}).get("staffId")
    body = payload or {}
    if body.get("podMembershipSource") == "self_reported" or body.get("roleContextSource") == "self_reported":
        raise ApprovalEngineError(
            403,
            "NOT_AUTHORIZED_PROXY_SUBMITTER",
            "Nhãn trực thay / hỗ trợ tự khai không mở quyền trình duyệt mổ thay. Chỉ BS Phụ mổ 1 trên lịch mổ hoặc BS chính khu vực theo phân công máy chủ mới được trình thay.",
        )

    ext_ids = {d.get("id") for d in (db.get("externalDoctors") or []) if isinstance(d, dict) and is_pos_int(d.get("id"))}
    is_external_surgeon = (ms_id in ext_ids) or (ms_id >= 100)
    coord_id = surgery.get("coordinatingAttendingStaffId") or (surgery.get("interdisciplinaryCoordination") or {}).get("coordinatingAttendingStaffId")

    if is_external_surgeon:
        if not is_pos_int(coord_id) or coord_id not in ATTENDING_STAFF_IDS:
            raise ApprovalEngineError(
                422,
                "COORDINATING_ATTENDING_REQUIRED",
                "Ca có PTV ngoài khoa bắt buộc chỉ định 01 Bác sĩ chính cơ hữu Khoa PTĐTT điều phối.",
            )
        if allow_bcn_gate_recheck and actor_id in BCN_STAFF_IDS:
            return {
                "submitterMode": "bcn_gate_recheck",
                "proxySubmitterSource": None,
                "proxyReasonCode": None,
                "actingForMainSurgeonReason": None,
                "podMembershipSource": None,
            }
        if actor_id != coord_id:
            raise ApprovalEngineError(
                403,
                "NOT_CASE_ATTENDING",
                "Ca có phẫu thuật viên mời ngoài khoa chỉ do Bác sĩ chính điều phối của khoa bấm trình duyệt mổ.",
            )
        return {
            "submitterMode": "coordinating_attending",
            "proxySubmitterSource": None,
            "proxyReasonCode": None,
            "actingForMainSurgeonReason": None,
            "podMembershipSource": None,
        }

    if actor_id == ms_id:
        return {
            "submitterMode": "main_surgeon",
            "proxySubmitterSource": None,
            "proxyReasonCode": None,
            "actingForMainSurgeonReason": None,
            "podMembershipSource": None,
        }

    if allow_bcn_gate_recheck and actor_id in BCN_STAFF_IDS:
        return {
            "submitterMode": "bcn_gate_recheck",
            "proxySubmitterSource": None,
            "proxyReasonCode": None,
            "actingForMainSurgeonReason": None,
            "podMembershipSource": None,
        }

    proxy_source = None
    pod_source = None
    assist1_id = surgery.get("assistSurgeon1")
    if is_pos_int(actor_id) and actor_id == assist1_id and actor_id in ATTENDING_STAFF_IDS:
        proxy_source = "assist_surgeon_1"
    elif is_pos_int(actor_id) and is_same_pod_attending(catalog, surgery, actor_id, surgery_date=surgery.get("date"), db=db):
        proxy_source = "pod_attending"
        pod_source = "server_roster"
    else:
        raise ApprovalEngineError(
            403,
            "NOT_AUTHORIZED_PROXY_SUBMITTER",
            "Chỉ BS mổ chính, BS chính đứng Phụ mổ 1 trên lịch mổ hoặc BS chính khu vực POD của buồng bệnh mới có quyền trình duyệt mổ.",
        )

    reason_code = str(body.get("proxyReasonCode") or body.get("proxyReasonChip") or "").strip() or None
    acting_reason = str(body.get("actingForMainSurgeonReason") or "").strip()
    if reason_code and reason_code not in VALID_PROXY_REASON_CODES:
        raise ApprovalEngineError(422, "INVALID_PROXY_REASON", "Lý do trình thay không hợp lệ.")
    if reason_code == "other" and len(acting_reason) < 5:
        raise ApprovalEngineError(
            422,
            "ACTING_REASON_REQUIRED",
            "Khi chọn lý do trình thay 'Khác', vui lòng nhập ghi chú tối thiểu 5 ký tự.",
        )
    if not reason_code:
        if len(acting_reason) >= 5:
            reason_code = "other"
        else:
            raise ApprovalEngineError(
                422,
                "ACTING_REASON_REQUIRED",
                "Khi trình duyệt thay BS mổ chính, vui lòng chạm chọn 01 lý do trình thay.",
            )

    reason_label_map = {
        "main_surgeon_in_or": "BS mổ chính đang trong phòng mổ",
        "main_surgeon_in_clinic": "BS mổ chính đang ngồi phòng khám",
        "main_surgeon_on_leave_or_duty": "BS mổ chính đi công tác / nghỉ trực",
        "main_surgeon_outpatient_clinic": "BS mổ chính đang ngồi phòng khám",
        "main_surgeon_conference_leave": "BS mổ chính đi công tác / hội nghị",
        "pod_cross_cover": "BS chính cùng khu vực POD hỗ trợ trình thay",
        "in_operating_room": "BS mổ chính đang trong phòng mổ",
        "outpatient_or_consult": "BS mổ chính đang hội chẩn viện / khám ngoại trú",
        "post_call_or_leave": "BS mổ chính ra trực / nghỉ phép / đi công tác",
        "other": acting_reason,
    }
    resolved_text = acting_reason or reason_label_map.get(reason_code, "")
    return {
        "submitterMode": "proxy_attending",
        "proxySubmitterSource": proxy_source,
        "proxyReasonCode": reason_code,
        "actingForMainSurgeonReason": resolved_text,
        "podMembershipSource": pod_source,
    }


def validate_routine_submit_gate(
    surgery: dict,
    actor: dict,
    payload: dict,
    catalog: dict,
    db: dict,
    cfg: dict,
    *,
    allow_bcn_gate_recheck: bool = False,
) -> list:
    """
    Validates Stage 1 (Privilege Matrix, Custom Outside-Catalog Proposed vs Verified Class, Interdisciplinary,
    Mốc hạn trình duyệt) + Stage 2 (Checklist CK-01..08 & Clinical Chips C-01..10 + B1..B4).
    Raises ApprovalEngineError(422/403, ...) with exact errorCode on violation.
    """
    if surgery.get("approachType") == "nsth":
        raise ApprovalEngineError(422, "NSTH_EXTERNAL_AUTHORITY", "Ca Nội soi tiêu hóa thuộc thẩm quyền Trưởng khoa NSTH.")

    in_scope, scope_reason = is_in_phase1_approval_scope(surgery, cfg)
    if not in_scope:
        raise ApprovalEngineError(
            403,
            "NOT_IN_PHASE1_SCOPE",
            "Ca mổ không thuộc phạm vi áp dụng luồng duyệt mổ chương trình Đợt 1.",
            {"scopeReason": scope_reason},
        )

    bcn_recheck = bool(allow_bcn_gate_recheck or (payload or {}).get("actingForMainSurgeonReason") == "BCN_APPROVAL_CHECK")
    resolve_submit_authorization(surgery, actor, payload, catalog, db, allow_bcn_gate_recheck=bcn_recheck)

    ms_id = surgery.get("mainSurgeon")
    cc = surgery.get("clinicalClassification") or {}
    pg_obj = cc.get("pathologyGroup") or {}
    pc_obj = cc.get("procedureClass") or {}
    col_obj = cc.get("columnCompliance") or {}
    urgency = cc.get("urgencyLevel") or suggest_urgency_level(surgery.get("surgeryType"))

    # Stage 1: Procedure catalog OR Custom outside-DM309 verification
    is_custom = bool(pc_obj.get("isCustomOutsideCatalog") is True or pc_obj.get("confirmedCatalogEntryId") == "CUSTOM_OUTSIDE_DM309")
    conf_cat_id = pc_obj.get("confirmedCatalogEntryId")
    conf_class = pc_obj.get("confirmedClass")
    proposed_class = pc_obj.get("proposedClass")
    verified_class = pc_obj.get("verifiedClass")

    if is_custom:
        custom_name = str(pc_obj.get("customProcedureName") or "").strip()
        if len(custom_name) < 5 or len(custom_name) > 240:
            raise ApprovalEngineError(
                422,
                "CUSTOM_PROCEDURE_NAME_REQUIRED",
                "Kỹ thuật ngoài Danh mục 309 bắt buộc có tên kỹ thuật rõ ràng (từ 5 đến 240 ký tự).",
            )
        reason_chip = pc_obj.get("customReasonChip")
        if reason_chip not in VALID_CUSTOM_REASON_CHIPS:
            raise ApprovalEngineError(
                422,
                "CUSTOM_REASON_CHIP_REQUIRED",
                "Vui lòng chạm chọn 01 lý do kỹ thuật chưa có trong Danh mục 309.",
            )
        if reason_chip == "other" and len(str(pc_obj.get("customReasonNote") or "").strip()) < 5:
            raise ApprovalEngineError(
                422,
                "CUSTOM_REASON_NOTE_REQUIRED",
                "Khi chọn lý do 'Khác', vui lòng nhập thuyết minh ngắn gọn (tối thiểu 5 ký tự).",
            )
        eff_proposed = proposed_class or conf_class
        if eff_proposed not in ("PT-ĐB", "PT-I", "PT-II", "PT-III", "unclassified"):
            raise ApprovalEngineError(
                422,
                "CUSTOM_PROPOSED_CLASS_REQUIRED",
                "Vui lòng chọn hạng kỹ thuật đề xuất (hoặc chọn 'Chưa rõ hạng — nhờ BCN xếp hạng').",
            )
    else:
        if not conf_class or conf_class == "unknown_ambiguous":
            raise ApprovalEngineError(
                422,
                "PROCEDURE_CATALOG_DISAMBIGUATION_REQUIRED",
                "Phương pháp phẫu thuật chưa được xác nhận hạng/mã danh mục chuẩn (đang ở trạng thái gợi ý hoặc mơ hồ).",
            )
        if conf_class == "unclassified":
            unc_note = str(pc_obj.get("unclassifiedNote") or "").strip()
            reason_chip = pc_obj.get("customReasonChip")
            if len(unc_note) < 5 and reason_chip not in VALID_CUSTOM_REASON_CHIPS:
                raise ApprovalEngineError(
                    422,
                    "UNCLASSIFIED_PROCEDURE_NOTE_REQUIRED",
                    "Kỹ thuật 'Không phân loại' bắt buộc chọn lý do hoặc nhập thuyết minh chuyên môn để BCN thẩm định.",
                )

    live_col = evaluate_column_compliance(
        catalog,
        db,
        main_surgeon_id=ms_id,
        approach_type=surgery.get("approachType", "mo"),
        surgery_date=surgery.get("date", ""),
        confirmed_class=conf_class,
        confirmed_catalog_id=conf_cat_id,
        is_custom_outside_catalog=is_custom,
        proposed_class=proposed_class or (conf_class if is_custom else None),
        verified_class=verified_class,
    )
    sys_check = live_col["systemCheck"]
    decl_mode = col_obj.get("declaredMode")

    if sys_check == "robot_certification_required":
        raise ApprovalEngineError(
            422,
            "ROBOT_CERTIFICATION_REQUIRED",
            "BS mổ chính chưa có trong danh sách chứng nhận Phẫu thuật viên Robot hiện hành.",
        )
    elif sys_check == "over_column":
        base_col_str = live_col.get("surgeonBaseColumn2026") or "hiện tại"
        eff_cls_label = verified_class or proposed_class or conf_class
        raise ApprovalEngineError(
            422,
            "OVER_COLUMN_FORBIDDEN_FOR_ELECTIVE",
            f"Theo Quyết định 1073/QĐ-BVBD & Bảng xếp cột 2026, ca mổ chương trình phải đúng cột (BS mổ chính Cột {base_col_str} chỉ mổ từ loại tương ứng trở xuống, không mổ {eff_cls_label}). Vui lòng phân công BS mổ chính đúng cột.",
        )
    elif sys_check == "custom_pending_bcn_verification":
        col_obj["declaredMode"] = decl_mode or "custom_pending_bcn_verification"
    elif sys_check == "matrix_expired_manual_verify":
        if decl_mode not in ("matrix_expired_manual_verify", "propose_over_column"):
            col_obj["declaredMode"] = "matrix_expired_manual_verify"
    elif sys_check == "external_surgeon_verify_privilege":
        col_obj["declaredMode"] = "external_surgeon_verify_privilege"
    elif sys_check in ("within_column", "approved_over_column_matched") and not decl_mode and not is_custom:
        raise ApprovalEngineError(422, "UNVERIFIED_REQUIRED_FIELDS", "Chưa xác nhận tuân thủ cột phẫu thuật (C-03).")

    checklist_mode = cfg.get("checklistMode", "enforced_gate")
    if checklist_mode != "enforced_gate":
        return []

    # ── Stage 2 Enforced Gate: C-01..C-10 + B1..B4 + CK-01..CK-08 ──
    blocking = []

    pod_assign = surgery.get("podAssignment") or {}
    ward_room = pod_assign.get("wardRoom")
    if ward_room not in VALID_WARD_ROOMS:
        blocking.append("C-01_WARD_ROOM_UNCONFIRMED")

    pg_val = pg_obj.get("confirmedValue")
    if not pg_val or pg_val == "unknown":
        raise ApprovalEngineError(
            422,
            "PATHOLOGY_GROUP_UNCONFIRMED",
            "Vui lòng chạm xác nhận Nhóm bệnh lý cụ thể (không để Chưa rõ) trước khi trình duyệt.",
        )
    if pg_val == "other_confirmed" and len(str(pg_obj.get("otherPathologyNote") or "").strip()) < 10:
        raise ApprovalEngineError(422, "OTHER_PATHOLOGY_NOTE_REQUIRED", "Nhóm bệnh lý 'Khác' bắt buộc nhập ghi chú tối thiểu 10 ký tự.")

    chips = surgery.get("clinicalChips") or {}

    comorb = chips.get("comorbidities") or {}
    c_vals = comorb.get("values") or []
    if not comorb.get("confirmed") or not c_vals:
        blocking.append("C-04_COMORBIDITIES_UNCONFIRMED")
    for v_cm in c_vals:
        if v_cm not in VALID_COMORBIDITIES:
            raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Giá trị bệnh nền nội khoa '{v_cm}' không hợp lệ.")
    if "none" in c_vals and len(c_vals) > 1:
        raise ApprovalEngineError(422, "MUTUALLY_EXCLUSIVE_CHIPS", "Chip 'Chưa ghi nhận' không thể chọn đồng thời với bệnh nền khác.")
    if "other" in c_vals and len(str(comorb.get("otherComorbidityNote") or "").strip()) < 3:
        blocking.append("C-04_OTHER_NOTE_REQUIRED")
    med_tx_note = str(comorb.get("medicalTreatmentNote") or "").strip()
    if len(med_tx_note) > 240:
        raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", "Ghi chú tình trạng điều trị nội khoa tối đa 240 ký tự.")

    sh = chips.get("surgicalHistory") or {}
    sh_status = sh.get("status")
    if not sh.get("confirmed") or sh_status not in ("none", "present"):
        blocking.append("C-08_SURGICAL_HISTORY_UNCONFIRMED")
    elif sh_status == "present":
        sh_cats = sh.get("categories") or []
        if not sh_cats or any(c not in VALID_SURGICAL_HISTORY_CATEGORIES for c in sh_cats):
            blocking.append("C-08_SURGICAL_CATEGORIES_REQUIRED")
        else:
            needs_scar = ("prior_colorectal_stoma" in sh_cats) or ("prior_abdominal_pelvic" in sh_cats)
            if needs_scar and sh.get("abdominalScarType") not in ("laparoscopic_scar", "open_laparotomy_scar"):
                blocking.append("C-08_ABDOMINAL_SCAR_REQUIRED")
            needs_sh_detail = ("prior_extra_abdominal" in sh_cats) or ("prior_anesthesia_or_transfusion_event" in sh_cats)
            if needs_sh_detail and len(str(sh.get("detailNote") or "").strip()) < 3:
                blocking.append("C-08_SURGICAL_DETAIL_REQUIRED")

    al = chips.get("allergyHistory") or {}
    al_status = al.get("status")
    if al_status == "present":
        al_grps = al.get("allergenGroups") or []
        al_sev = al.get("reactionSeverity")
        al_det = str(al.get("allergenDetail") or "").strip()
        if ("drug" in al_grps or al_sev == "severe_anaphylaxis") and len(al_det) < 2:
            raise ApprovalEngineError(
                422,
                "ALLERGY_DETAIL_REQUIRED",
                "Khi ghi nhận dị ứng Thuốc hoặc Phản vệ / Phù mạch nặng, bắt buộc ghi rõ tên thuốc / tác nhân dị ứng (tối thiểu 2 ký tự).",
            )
        if not al.get("confirmed"):
            blocking.append("C-09_ALLERGY_HISTORY_UNCONFIRMED")
        else:
            if not al_grps or any(g not in VALID_ALLERGY_GROUPS for g in al_grps):
                blocking.append("C-09_ALLERGY_GROUP_REQUIRED")
            if al_sev not in VALID_ALLERGY_SEVERITIES:
                blocking.append("C-09_ALLERGY_SEVERITY_REQUIRED")
    elif not al.get("confirmed") or al_status != "none":
        blocking.append("C-09_ALLERGY_HISTORY_UNCONFIRMED")

    soc = chips.get("socialHabits") or {}
    alc_val = soc.get("alcoholUse")
    smk_obj = soc.get("smoking") or {}
    smk_st = smk_obj.get("status")
    sub_obj = soc.get("substanceAbuse") or {}
    sub_st = sub_obj.get("status")

    if smk_st in ("current", "former"):
        py_val = smk_obj.get("packYears")
        py_unk = bool(smk_obj.get("packYearsUnknown") is True)
        valid_py = isinstance(py_val, (int, float)) and not isinstance(py_val, bool) and (0.1 <= float(py_val) <= 200.0)
        if not valid_py and not py_unk:
            raise ApprovalEngineError(
                422,
                "SMOKING_PACK_YEARS_REQUIRED",
                "Khi chọn Hút thuốc lá (Đang hút / Đã ngưng), bắt buộc nhập số gói/năm (0.1–200) hoặc chọn 'Chưa rõ số gói/năm'.",
            )
    if sub_st == "yes":
        sub_note = str(sub_obj.get("substanceNote") or "").strip()
        if not sub_note:
            raise ApprovalEngineError(
                422,
                "SUBSTANCE_DETAIL_REQUIRED",
                "Khi ghi nhận Có lạm dụng chất gây nghiện, bắt buộc ghi rõ loại chất và tình trạng hiện tại.",
            )
    if (
        not soc.get("confirmed")
        or alc_val not in ("none", "occasional", "dependent")
        or smk_st not in ("no", "current", "former")
        or sub_st not in ("no", "yes")
    ):
        blocking.append("C-10_SOCIAL_HABITS_UNCONFIRMED")

    anti = chips.get("antithromboticPlan") or {}
    a_mode = anti.get("mode")
    if not anti.get("confirmed") or a_mode not in VALID_ANTITHROMBOTIC_MODES:
        blocking.append("C-05_ANTITHROMBOTIC_UNCONFIRMED")
    elif a_mode == "continued_per_plan":
        if not str(anti.get("drugName") or "").strip() or not str(anti.get("approvingSpecialtyOrDoctor") or "").strip() or not str(anti.get("planReferenceNote") or "").strip():
            raise ApprovalEngineError(422, "ANTITHROMBOTIC_DETAILS_REQUIRED", "Chế độ tiếp tục dùng thuốc bắt buộc ghi tên thuốc, chuyên khoa/bác sĩ duyệt và kế hoạch cầm máu.")
    elif a_mode == "held_per_plan":
        if not str(anti.get("drugName") or "").strip() or not str(anti.get("lastDoseAt") or "").strip() or not str(anti.get("approvingSpecialtyOrDoctor") or "").strip():
            raise ApprovalEngineError(422, "ANTITHROMBOTIC_DETAILS_REQUIRED", "Chế độ ngưng thuốc theo kế hoạch bắt buộc ghi tên thuốc, liều cuối và chuyên khoa/bác sĩ duyệt.")
    elif a_mode == "bridging_per_plan":
        if not str(anti.get("drugName") or "").strip() or not str(anti.get("bridgingAgent") or "").strip() or not str(anti.get("lastDoseAt") or "").strip() or not str(anti.get("approvingSpecialtyOrDoctor") or "").strip():
            raise ApprovalEngineError(422, "ANTITHROMBOTIC_DETAILS_REQUIRED", "Chế độ bắc cầu bắt buộc ghi đủ tên thuốc, thuốc bắc cầu, liều cuối và người duyệt.")
    elif a_mode == "unheld_urgent_risk":
        raise ApprovalEngineError(422, "UNHELD_DRUG_NOT_FOR_ELECTIVE", "Thuốc chống huyết khối chưa ngưng đủ thời gian không được trình theo luồng mổ chương trình thường quy.")

    bd = chips.get("bloodAndDevices") or {}
    bd_vals = bd.get("values") or []
    if not bd.get("confirmed") or not bd_vals:
        blocking.append("C-06_BLOOD_DEVICES_UNCONFIRMED")
    if "basic_instruments_only" in bd_vals and len(bd_vals) > 1:
        raise ApprovalEngineError(422, "MUTUALLY_EXCLUSIVE_CHIPS", "'Chỉ dụng cụ cơ bản' không thể chọn cùng thiết bị/máu dự trù khác.")
    if surgery.get("approachType") == "robot" and "basic_instruments_only" in bd_vals:
        raise ApprovalEngineError(422, "MUTUALLY_EXCLUSIVE_CHIPS", "Ca phẫu thuật Robot không được chọn 'Chỉ dụng cụ cơ bản'.")

    stoma = chips.get("stomaPlan") or {}
    stoma_val = stoma.get("value")
    if not stoma.get("confirmed") or stoma_val not in VALID_STOMA_PLANS:
        blocking.append("C-07_STOMA_UNCONFIRMED")

    ctx = chips.get("contextChips") or {}
    if pg_val == "benign_anorectal":
        b1 = ctx.get("fistulaContext") or {}
        f_cls = b1.get("fistulaClassification")
        if f_cls not in ("not_fistula", "simple_fistula", "complex_or_recurrent_fistula"):
            blocking.append("B1_FISTULA_CLASSIFICATION_REQUIRED")
        elif f_cls in ("simple_fistula", "complex_or_recurrent_fistula"):
            f_img = b1.get("fistulaImaging")
            if f_img not in ("mri_fistula_done", "endoanal_us_done", "not_indicated_simple", "other_note"):
                blocking.append("B1_FISTULA_IMAGING_REQUIRED")
            if f_cls == "complex_or_recurrent_fistula" and f_img == "not_indicated_simple" and not str(b1.get("missingMriReason") or "").strip():
                blocking.append("B1_COMPLEX_FISTULA_MISSING_MRI_REASON")

    if pg_val == "benign_colorectal_abdominal" or stoma_val == "stoma_closure":
        b2 = ctx.get("benignAbdominalContext") or {}
        if stoma_val == "stoma_closure":
            if b2.get("distalLimbCheck") not in ("endoscopy_or_contrast_patent", "stricture_planned_resection"):
                blocking.append("B2_DISTAL_LIMB_CHECK_REQUIRED")
        if pg_val == "benign_colorectal_abdominal":
            if not b2.get("subType"):
                blocking.append("B2_SUBTYPE_REQUIRED")
            if not b2.get("bowelPrepPlan"):
                blocking.append("B2_BOWEL_PREP_REQUIRED")

    if pg_val == "cancer_confirmed":
        b3 = ctx.get("cancerContext") or {}
        locs = b3.get("tumorLocation") or []
        if not locs:
            blocking.append("B3_TUMOR_LOCATION_REQUIRED")
        if not b3.get("preopHistology"):
            blocking.append("B3_HISTOLOGY_REQUIRED")
        mm_status = b3.get("multimodalStatus")
        if not mm_status:
            blocking.append("B3_MULTIMODAL_STATUS_REQUIRED")
        is_post_neoadj = mm_status in ("post_neoadjuvant_crt", "post_long_course_crt", "post_short_course_rt", "post_tnt", "post_chemo")
        base_st = b3.get("baselineClinicalStage") or b3.get("clinicalStage") or {}
        rest_st = b3.get("restagingPostNeoadjuvant") or (b3.get("clinicalStage") if is_post_neoadj and not b3.get("restagingPostNeoadjuvant") else {}) or {}
        active_st = rest_st if (is_post_neoadj and rest_st) else base_st
        ct = active_st.get("T") or active_st.get("cT") or active_st.get("ycT")
        cn = active_st.get("N") or active_st.get("cN") or active_st.get("ycN")
        cm = active_st.get("M") or active_st.get("cM") or active_st.get("ycM")
        if not (ct and cn and cm):
            blocking.append("B3_CLINICAL_STAGE_REQUIRED")
        if is_post_neoadj and b3.get("baselineClinicalStage") and b3.get("restagingPostNeoadjuvant") is not None:
            rt_t = rest_st.get("T") or rest_st.get("ycT") or rest_st.get("cT")
            rt_n = rest_st.get("N") or rest_st.get("ycN") or rest_st.get("cN")
            rt_m = rest_st.get("M") or rest_st.get("ycM") or rest_st.get("cM")
            if not (rt_t and rt_n and rt_m):
                blocking.append("B3_RESTAGING_POST_NEOADJUVANT_REQUIRED")
        staging_note_txt = str(active_st.get("stagingNote") or (b3.get("clinicalStage") or {}).get("stagingNote") or "").strip()
        if any(str(x).upper().endswith("X") for x in (ct, cn, cm) if x) and not staging_note_txt:
            blocking.append("B3_UNKNOWN_STAGE_NOTE_REQUIRED")
        is_rectal_or_anal = any(str(l).startswith("rectum_") or l == "anal_canal" for l in locs)
        if is_rectal_or_anal:
            crm = b3.get("crmStatus")
            if crm not in ("crm_clear", "crm_threatened_or_positive", "unknown_no_pelvic_mri"):
                raise ApprovalEngineError(
                    422,
                    "CANCER_RECTAL_CRM_REQUIRED",
                    "Ung thư trực tràng / ống hậu môn bắt buộc xác nhận tình trạng diện cắt vòng quanh (CRM).",
                )
            if crm == "unknown_no_pelvic_mri" and not str(b3.get("crmNote") or staging_note_txt).strip():
                blocking.append("B3_CRM_NOTE_REQUIRED")
        if not b3.get("mdtReviewStatus"):
            blocking.append("B3_MDT_STATUS_REQUIRED")

    if pg_val == "neoplasm_suspected_or_special":
        b4 = ctx.get("specialNeoplasmContext") or {}
        if not b4.get("neoplasmCategory"):
            blocking.append("B4_CATEGORY_REQUIRED")
        b_stat = b4.get("biopsyStatus")
        if b_stat not in ("biopsy_confirmed_special", "submucosal_not_biopsied", "stenotic_or_bleeding_failed_biopsy"):
            blocking.append("B4_BIOPSY_STATUS_REQUIRED")
        if b_stat == "stenotic_or_bleeding_failed_biopsy" and not str(b4.get("missingBiopsyReason") or "").strip():
            blocking.append("B4_MISSING_BIOPSY_REASON_REQUIRED")
        if not b4.get("extentEvaluation"):
            blocking.append("B4_EXTENT_REQUIRED")
        if not b4.get("mdtReviewStatus"):
            blocking.append("B4_MDT_STATUS_REQUIRED")

    ck = surgery.get("preopChecklist") or {}
    actor_id_submit = actor.get("staffId")
    eff_proc_cls_for_ck04 = verified_class or proposed_class or conf_class
    ck04_unverified_flag = False
    for code in CK_CODES:
        item = ck.get(code) or {}
        st_val = item.get("state", "unverified")
        if item.get("needsReverify") is True:
            blocking.append(f"{code}_NEEDS_REVERIFY")
            if code == "CK-04":
                ck04_unverified_flag = True
            continue
        allowed_for_code = ALLOWED_ROUTINE_CK_STATES_BY_CODE.get(code, {"verified_ok"})
        if st_val not in allowed_for_code:
            blocking.append(f"{code}_INVALID_STATE:{st_val}")
            if code == "CK-04":
                ck04_unverified_flag = True
            continue
        if st_val == "verified_abnormal_planned" and not str(item.get("clinicalPlanNote") or "").strip():
            blocking.append(f"{code}_CLINICAL_PLAN_NOTE_REQUIRED")
        if code == "CK-03" and has_high_risk_preop_history(chips):
            if st_val != "verified_abnormal_planned" or not str(item.get("clinicalPlanNote") or "").strip():
                blocking.append("CK-03_HIGH_RISK_HISTORY_PLAN_REQUIRED")
        if code == "CK-01" and st_val == "not_indicated" and len(str(item.get("clinicalPlanNote") or "").strip()) < 5:
            blocking.append("CK-01_NOT_INDICATED_REASON_REQUIRED")
        if code == "CK-04" and st_val == "not_applicable":
            if not (pg_val == "benign_anorectal" and eff_proc_cls_for_ck04 in ("PT-II", "PT-III")):
                blocking.append("CK-04_IMAGING_REQUIRED_FOR_CASE")
        if code == "CK-05":
            if pg_val in ("cancer_confirmed", "neoplasm_suspected_or_special") and st_val not in ("verified_ok", "verified_abnormal_planned"):
                blocking.append("CK-05_REQUIRED_FOR_NEOPLASM")
            elif st_val == "not_applicable" and pg_val not in ("benign_anorectal", "benign_colorectal_abdominal"):
                blocking.append("CK-05_NA_ONLY_FOR_BENIGN")
            elif st_val == "not_applicable" and pg_val in ("benign_anorectal", "benign_colorectal_abdominal") and is_pos_int(actor_id_submit) and actor_id_submit in ATTENDING_STAFF_IDS:
                if not item.get("verifiedByStaffId"):
                    item["verifiedByStaffId"] = actor_id_submit
        v_by = item.get("verifiedByStaffId")
        if not is_pos_int(v_by) or v_by not in ATTENDING_STAFF_IDS:
            blocking.append(f"{code}_REQUIRES_ATTENDING_VERIFICATION")
            if code == "CK-04":
                ck04_unverified_flag = True
        if code == "CK-02":
            subs = item.get("subChecks") or {}
            pre_a = subs.get("preAnesthesiaExam")
            if pre_a not in ("verified_ok", "ready_for_preanesthesia", "verified_abnormal_planned"):
                blocking.append("CK-02_PREANESTHESIA_UNVERIFIED")
            for sub_k in ("ecg", "chestImaging", "echo"):
                if subs.get(sub_k) not in ("verified_ok", "verified_abnormal_planned", "not_indicated"):
                    blocking.append(f"CK-02_{sub_k}_UNVERIFIED")

    if blocking:
        if ck04_unverified_flag and not any(b.startswith(("C-", "B1_", "B2_", "B3_", "B4_", "CK-03_HIGH_RISK")) for b in blocking):
            raise ApprovalEngineError(
                422,
                "CK-04_ATTENDING_VERIFICATION_REQUIRED",
                "Mục Phim / nội soi gốc bắt buộc được Bác sĩ chính có thẩm quyền trực tiếp xác nhận trước khi trình duyệt mổ.",
                {"blockingReasons": blocking},
            )
        raise ApprovalEngineError(
            422,
            "UNVERIFIED_REQUIRED_FIELDS",
            "Hồ sơ còn mục Bảng kiểm hoặc thông tin lâm sàng bắt buộc chưa được BS chính xác nhận.",
            {"blockingReasons": blocking},
        )
    return blocking


def validate_bcn_approve_gate(surgery: dict, actor: dict, body: dict, catalog: dict, db: dict, cfg: dict) -> dict:
    """
    Enforces BCN Approval Gate (Mục 3.A & SYN-TC-09..12):
      1. Custom outside-DM309 or unclassified procedures MUST have BCN-verified `verifiedClass` in
         {'PT-ĐB', 'PT-I', 'PT-II', 'PT-III'} + `verifiedBasisCode`.
      2. Re-evaluates column compliance using `verifiedClass` -> blocks 422 OVER_COLUMN_FORBIDDEN_FOR_ELECTIVE or ROBOT_CERTIFICATION_REQUIRED.
      3. External surgeon (`mainSurgeon >= 100`) requires `externalPrivilegeConfirmed == True`.
    """
    cc = surgery.setdefault("clinicalClassification", {})
    pc_obj = cc.setdefault("procedureClass", {})
    col_obj = cc.setdefault("columnCompliance", {})
    payload = body or {}

    # Allow BCN 2-tap inline verification on POST /approve (or pre-verified via /verify-procedure-class)
    if payload.get("verifiedClass") is not None:
        v_cls = payload.get("verifiedClass")
        v_basis = payload.get("verifiedBasisCode") or pc_obj.get("verifiedBasisCode") or "equivalent_dm309_complexity"
        if v_cls not in ("PT-ĐB", "PT-I", "PT-II", "PT-III"):
            raise ApprovalEngineError(
                422,
                "CUSTOM_PROCEDURE_VERIFICATION_REQUIRED",
                "Ban Chủ nhiệm bắt buộc chọn hạng phẫu thuật xác minh cụ thể (PT-ĐB, PT-I, PT-II hoặc PT-III) trước khi phê duyệt.",
            )
        if v_basis not in VALID_VERIFIED_BASIS_CODES:
            raise ApprovalEngineError(422, "INVALID_VERIFIED_BASIS", "Căn cứ xác minh hạng kỹ thuật không hợp lệ.")
        v_note = str(payload.get("verifiedNote") or pc_obj.get("verifiedNote") or "").strip()
        if v_basis in ("other", "other_note") and len(v_note) < 5:
            raise ApprovalEngineError(
                422,
                "VERIFIED_BASIS_NOTE_REQUIRED",
                "Khi chọn 'Căn cứ khác', vui lòng nhập ghi chú căn cứ xác minh tối thiểu 5 ký tự.",
            )
        pc_obj["verifiedClass"] = v_cls
        pc_obj["verifiedBasisCode"] = v_basis
        pc_obj["verifiedByStaffId"] = actor.get("staffId")
        pc_obj["verifiedAt"] = now_vn_iso()
        pc_obj["verifiedNote"] = v_note or None
        if pc_obj.get("isCustomOutsideCatalog") is not True and pc_obj.get("confirmedClass") == "unclassified":
            pc_obj["confirmedClass"] = v_cls

    is_custom = bool(pc_obj.get("isCustomOutsideCatalog") is True or pc_obj.get("confirmedCatalogEntryId") == "CUSTOM_OUTSIDE_DM309")
    eff_verified = pc_obj.get("verifiedClass")
    conf_cls = pc_obj.get("confirmedClass")

    if is_custom:
        if eff_verified not in ("PT-ĐB", "PT-I", "PT-II", "PT-III"):
            raise ApprovalEngineError(
                422,
                "CUSTOM_PROCEDURE_VERIFICATION_REQUIRED",
                "Kỹ thuật ngoài Danh mục 309 chưa được Ban Chủ nhiệm xác minh hạng thực tế. Vui lòng chọn hạng xác minh và căn cứ xếp hạng.",
            )
    elif conf_cls in (None, "unknown_ambiguous", "unclassified") and eff_verified not in ("PT-ĐB", "PT-I", "PT-II", "PT-III"):
        raise ApprovalEngineError(
            422,
            "CUSTOM_PROCEDURE_VERIFICATION_REQUIRED",
            "Kỹ thuật chưa rõ phân hạng bắt buộc được Ban Chủ nhiệm xác minh hạng cụ thể trước khi phê duyệt.",
        )

    ms_id = surgery.get("mainSurgeon")
    live_col = evaluate_column_compliance(
        catalog,
        db,
        main_surgeon_id=ms_id,
        approach_type=surgery.get("approachType", "mo"),
        surgery_date=surgery.get("date", ""),
        confirmed_class=eff_verified or conf_cls,
        confirmed_catalog_id=pc_obj.get("confirmedCatalogEntryId"),
        is_custom_outside_catalog=is_custom,
        proposed_class=pc_obj.get("proposedClass"),
        verified_class=eff_verified,
    )
    col_obj.update(live_col)
    sys_check = live_col.get("systemCheck")
    if sys_check == "robot_certification_required":
        raise ApprovalEngineError(
            422,
            "ROBOT_CERTIFICATION_REQUIRED",
            "BS mổ chính chưa có trong danh sách chứng nhận Phẫu thuật viên Robot hiện hành.",
        )
    if sys_check == "over_column":
        base_col_str = live_col.get("surgeonBaseColumn2026") or "hiện tại"
        raise ApprovalEngineError(
            422,
            "OVER_COLUMN_FORBIDDEN_FOR_ELECTIVE",
            f"Hạng kỹ thuật thực tế ({eff_verified or conf_cls}) vượt quá phân cột hiện tại của BS mổ chính (Cột {base_col_str}) đối với ca mổ chương trình.",
        )
    if sys_check == "external_surgeon_verify_privilege":
        ext_ok = bool(payload.get("externalPrivilegeConfirmed") is True or col_obj.get("externalPrivilegeConfirmed") is True)
        if not ext_ok:
            raise ApprovalEngineError(
                422,
                "EXTERNAL_SURGEON_PRIVILEGE_CONFIRM_REQUIRED",
                "Ca có phẫu thuật viên mời ngoài khoa bắt buộc Ban Chủ nhiệm tích xác nhận năng lực / hồ sơ mời hội chẩn trước khi phê duyệt.",
            )
        col_obj["externalPrivilegeConfirmed"] = True
        col_obj["privilegeVerifiedByStaffId"] = actor.get("staffId")
    elif sys_check in ("within_column", "approved_over_column_matched"):
        col_obj["declaredMode"] = "within_column"
        col_obj["privilegeVerifiedByStaffId"] = actor.get("staffId")

    validate_routine_submit_gate(surgery, actor, payload, catalog, db, cfg, allow_bcn_gate_recheck=True)
    return live_col


# ───────────────────────── Draft Patch & Bulk Confirm / Undo ─────────────────────────

REVERIFY_UI_BANNER = "Dữ liệu vừa thay đổi — cần BS chính xác nhận lại"


def _invalidate_ck_item_for_reverify(ck_dict: dict, code: str, invalidated_codes: list):
    """Clears active attending verification and stamps clean Vietnamese reverify banner (zero raw codes)."""
    item = (ck_dict or {}).get(code)
    if not isinstance(item, dict):
        return
    prev_v = item.get("verifiedByStaffId")
    cur_st = item.get("state", "unverified")
    if prev_v is not None or cur_st in ("verified_ok", "verified_abnormal_planned", "not_indicated"):
        if prev_v is not None:
            item["previousVerifiedByStaffId"] = prev_v
        item["verifiedByStaffId"] = None
        if cur_st in ("verified_ok", "verified_abnormal_planned", "not_indicated"):
            item["state"] = "unverified" if code in ("CK-04", "CK-08") else "prepared_ok"
        item["needsReverify"] = True
        item["uiBannerText"] = REVERIFY_UI_BANNER
        if code not in invalidated_codes:
            invalidated_codes.append(code)


def apply_draft_updates(surgery: dict, actor: dict, payload: dict, catalog: dict, db: dict) -> tuple:
    """
    Applies draft edits to clinicalClassification, podAssignment, clinicalChips, preopChecklist,
    interdisciplinaryCoordination, or bulkAction ('bulk_confirm_routine' | 'undo_bulk_confirm').
    Enforces:
      - Zero fake resident auto-attribution (SYN-TC-26).
      - Strips client-forged verifiedClass / verifiedByStaffId on procedureClass (SYN-TC-08).
      - Trainees cannot touch CK-04 / CK-08 or set verified_* states.
      - 'other_attending' may verify CK-01,02,03,05,06,07 with direct_clinical_exam_by_attending, blocked 403 on CK-04,08 (SYN-TC-25).
      - Site-locked TNM (AJCC 8 Ch.20 & AJCC v9 Anus), separate baselineClinicalStage (cTNM) vs restagingPostNeoadjuvant (ycTNM).
      - Stale verification invalidation with clean Vietnamese banner (Mục 4.C & SYN-TC-30).
    Returns (tier_a_changed: bool, action_name: str, summary: dict).
    """
    actor_id = actor.get("staffId")
    trainee = is_trainee_user(actor)
    attending = is_attending_user(actor)
    cfg = get_approval_config(db)

    if not (trainee or attending or actor.get("isSuperAdmin")):
        raise ApprovalEngineError(403, "FORBIDDEN", "Chỉ Bác sĩ học viên, Bác sĩ chính và Ban Chủ nhiệm mới được chuẩn bị hồ sơ duyệt mổ.")

    role_ctx_src = str((payload or {}).get("roleContextSource") or "server_roster").strip()
    if role_ctx_src not in ("server_roster", "self_reported"):
        role_ctx_src = "server_roster"

    if surgery.get("podAssignment") is None:
        init_parts = build_initial_unverified_structures(surgery, catalog, db)
        for k_i, v_i in init_parts.items():
            if surgery.get(k_i) is None:
                surgery[k_i] = v_i

    before_all_fp = canonical_json({
        "pa": surgery.get("podAssignment"),
        "cc": surgery.get("clinicalClassification"),
        "ck": surgery.get("preopChecklist"),
        "chips": surgery.get("clinicalChips"),
        "ic": surgery.get("interdisciplinaryCoordination"),
        "coord": surgery.get("coordinatingAttendingStaffId"),
    })
    before_tier_a_fp = canonical_json({
        "cc": surgery.get("clinicalClassification"),
        "ck": surgery.get("preopChecklist"),
        "chips": surgery.get("clinicalChips"),
        "ic": surgery.get("interdisciplinaryCoordination"),
        "coord": surgery.get("coordinatingAttendingStaffId"),
    })

    actor_role_in_case = resolve_case_actor_role(surgery, actor, catalog, db)
    can_restricted_ck = can_verify_restricted_checklist_item(surgery, actor, catalog, db)
    touched_sections = []
    invalidated_codes = []
    attestation_scope_used = None

    bulk_op = (payload or {}).get("bulkAction")
    if bulk_op == "bulk_confirm_routine":
        cc = surgery.get("clinicalClassification") or {}
        pg_conf = (cc.get("pathologyGroup") or {}).get("confirmedValue")
        pc_obj_b = cc.get("procedureClass") or {}
        pc_conf = pc_obj_b.get("confirmedClass") or pc_obj_b.get("proposedClass")
        if not pg_conf or pg_conf == "unknown" or not pc_conf:
            raise ApprovalEngineError(
                422,
                "BULK_PRECONDITION_UNMET",
                "Vui lòng xác nhận Nhóm bệnh lý và Hạng phẫu thuật trước khi dùng Xác nhận nhanh.",
            )
        ck = surgery.setdefault("preopChecklist", {})
        surgery["_bulkUndoSnapshot"] = copy.deepcopy(ck)
        target_state = "prepared_ok" if trainee else "verified_ok"
        step2_history_ready = are_step2_history_chips_routine_confirmed(surgery.get("clinicalChips") or {})
        changed_codes = []

        if pg_conf in ("benign_anorectal", "benign_colorectal_abdominal"):
            ck05 = ck.setdefault("CK-05", {})
            if ck05.get("state") in (None, "unverified", "not_applicable"):
                ck05["state"] = "not_applicable"
                ck05["autoDerivedFrom"] = f"pathologyGroup={pg_conf}"
                ck05["needsReverify"] = False
                ck05.pop("uiBannerText", None)
                if not trainee and actor_id in ATTENDING_STAFF_IDS:
                    ck05["verifiedByStaffId"] = actor_id
                    if actor_role_in_case == "other_attending":
                        ck05["attestationScope"] = "direct_clinical_exam_by_attending"
                        attestation_scope_used = "direct_clinical_exam_by_attending"

        for code in ("CK-01", "CK-02", "CK-03", "CK-06", "CK-07"):
            item = ck.setdefault(code, {"state": "unverified"})
            cur_st = item.get("state", "unverified")
            if cur_st in ("not_applicable", "not_indicated", "verified_abnormal_planned", "deferred_emergency"):
                continue
            if code == "CK-03" and not step2_history_ready:
                continue
            if code == "CK-02":
                subs = item.setdefault("subChecks", {})
                if any(v in ("verified_abnormal_planned", "deferred_emergency") for v in subs.values()):
                    continue
                for sk in ("preAnesthesiaExam", "ecg", "chestImaging", "echo"):
                    sv = subs.get(sk, "unverified")
                    if sv in ("unverified", "prepared_ok"):
                        subs[sk] = target_state
            if cur_st in ("unverified", "prepared_ok"):
                item["state"] = target_state
                if trainee:
                    item["preparedByStaffId"] = actor_id
                else:
                    if not item.get("preparedByStaffId"):
                        item["preparedByStaffId"] = actor_id
                    item["verifiedByStaffId"] = actor_id
                    item["needsReverify"] = False
                    item.pop("uiBannerText", None)
                    if actor_role_in_case == "other_attending":
                        item["attestationScope"] = "direct_clinical_exam_by_attending"
                        attestation_scope_used = "direct_clinical_exam_by_attending"
                changed_codes.append(code)

        after_fp = canonical_json({
            "cc": surgery.get("clinicalClassification"),
            "ck": surgery.get("preopChecklist"),
            "chips": surgery.get("clinicalChips"),
            "ic": surgery.get("interdisciplinaryCoordination"),
            "coord": surgery.get("coordinatingAttendingStaffId"),
        })
        after_all_fp = canonical_json({
            "pa": surgery.get("podAssignment"),
            "cc": surgery.get("clinicalClassification"),
            "ck": surgery.get("preopChecklist"),
            "chips": surgery.get("clinicalChips"),
            "ic": surgery.get("interdisciplinaryCoordination"),
            "coord": surgery.get("coordinatingAttendingStaffId"),
        })
        attr_ops = []
        if changed_codes:
            attr_ops.append({
                "episodeId": surgery.get("episodeId"),
                "actorRoleInCase": actor_role_in_case,
                "roleContextSource": role_ctx_src,
                "attestationScope": attestation_scope_used,
                "actionType": "bulk_confirm_routine",
                "touchedSections": [f"preopChecklist.{c}" for c in changed_codes],
                "invalidatedChecklistCodes": [],
                "snapshotDigest": sha256_hex(after_fp)[:16],
            })
        return (
            (after_fp != before_tier_a_fp),
            "bulk_confirm_routine",
            {
                "changedCodes": changed_codes,
                "isNoOp": (after_all_fp == before_all_fp),
                "touchedSections": [f"preopChecklist.{c}" for c in changed_codes],
                "invalidatedChecklistCodes": [],
                "attributionOps": attr_ops,
            },
        )

    if bulk_op == "undo_bulk_confirm":
        undo_snap = surgery.pop("_bulkUndoSnapshot", None)
        if not isinstance(undo_snap, dict):
            raise ApprovalEngineError(422, "NO_BULK_UNDO_AVAILABLE", "Không có thao tác xác nhận nhanh nào để hoàn tác.")
        surgery["preopChecklist"] = copy.deepcopy(undo_snap)
        return True, "undo_bulk_confirm", {
            "restored": True,
            "isNoOp": False,
            "touchedSections": ["preopChecklist"],
            "invalidatedChecklistCodes": [],
            "attributionOps": [{
                "episodeId": surgery.get("episodeId"),
                "actorRoleInCase": actor_role_in_case,
                "roleContextSource": role_ctx_src,
                "actionType": "undo_bulk_confirm",
                "touchedSections": ["preopChecklist"],
                "invalidatedChecklistCodes": [],
            }],
        }

    explicit_ck_verifies = set()
    if isinstance((payload or {}).get("preopChecklist"), dict):
        for k_ck, v_ck in payload["preopChecklist"].items():
            if isinstance(v_ck, dict) and not trainee and v_ck.get("state") in ("verified_ok", "verified_abnormal_planned", "not_indicated", "not_applicable"):
                explicit_ck_verifies.add(k_ck)

    # 1. Interdisciplinary coordination & coordinatingAttendingStaffId
    if "interdisciplinaryCoordination" in payload:
        ic = payload["interdisciplinaryCoordination"]
        if isinstance(ic, dict) or ic is None:
            if canonical_json(surgery.get("interdisciplinaryCoordination")) != canonical_json(ic):
                touched_sections.append("interdisciplinaryCoordination")
            surgery["interdisciplinaryCoordination"] = copy.deepcopy(ic)
            if isinstance(ic, dict) and is_pos_int(ic.get("coordinatingAttendingStaffId")):
                surgery["coordinatingAttendingStaffId"] = int(ic["coordinatingAttendingStaffId"])
    if "coordinatingAttendingStaffId" in payload:
        cid = payload["coordinatingAttendingStaffId"]
        new_cid = int(cid) if is_pos_int(cid) else None
        if surgery.get("coordinatingAttendingStaffId") != new_cid:
            touched_sections.append("coordinatingAttendingStaffId")
        surgery["coordinatingAttendingStaffId"] = new_cid
        actor_role_in_case = resolve_case_actor_role(surgery, actor, catalog, db)
        can_restricted_ck = can_verify_restricted_checklist_item(surgery, actor, catalog, db)

    # 2. POD Assignment (C-01 — zero fake residentStaffIds[0] auto-attribution!)
    if isinstance(payload.get("podAssignment"), dict):
        pa_in = payload["podAssignment"]
        pa = surgery.setdefault("podAssignment", {})
        if "wardRoom" in pa_in:
            wr = pa_in["wardRoom"]
            r_info = get_pod_room_info(catalog, wr, surgery_date=surgery.get("date"), db=db, strict=(wr is not None))
            if pa.get("wardRoom") != wr:
                touched_sections.append("podAssignment.wardRoom")
            pa["wardRoom"] = wr
            pa["suggestedPodId"] = r_info.get("podId")
            pa["roleContextSource"] = role_ctx_src
            if not pa.get("preparedByStaffId") and is_pos_int(actor_id):
                pa["preparedByStaffId"] = actor_id
        actor_role_in_case = resolve_case_actor_role(surgery, actor, catalog, db)
        can_restricted_ck = can_verify_restricted_checklist_item(surgery, actor, catalog, db)

    # 3. Clinical Classification (C-02, C-03, Custom Outside DM 309)
    action_override = None
    if isinstance(payload.get("clinicalClassification"), dict):
        cc_in = payload["clinicalClassification"]
        cc = surgery.setdefault("clinicalClassification", {})

        if isinstance(cc_in.get("pathologyGroup"), dict):
            pg_in = cc_in["pathologyGroup"]
            pg_cur = cc.setdefault("pathologyGroup", {})
            old_group = pg_cur.get("confirmedValue")
            new_group = pg_in.get("confirmedValue")
            if new_group is not None:
                if new_group not in VALID_PATHOLOGY_GROUPS:
                    raise ApprovalEngineError(422, "INVALID_PATHOLOGY_GROUP", f"Nhóm bệnh lý '{new_group}' không hợp lệ.")
                existing_ctx = ((surgery.get("clinicalChips") or {}).get("contextChips")) or {}
                if old_group and old_group != "unknown" and new_group != old_group and existing_ctx:
                    reason = str(payload.get("groupChangeReason") or pg_in.get("groupChangeReason") or "").strip()
                    if len(reason) < 5:
                        raise ApprovalEngineError(
                            422,
                            "REASON_REQUIRED",
                            "Khi đổi Nhóm bệnh lý sau khi đã nhập dữ liệu chuyên biệt, bắt buộc nhập lý do chuyển nhóm.",
                        )
                    surgery.setdefault("archivedGroupData", []).append({
                        "fromGroup": old_group,
                        "toGroup": new_group,
                        "archivedAt": now_vn_iso(),
                        "archivedByStaffId": actor_id,
                        "reason": reason,
                        "payload": copy.deepcopy(existing_ctx),
                    })
                    surgery.setdefault("clinicalChips", {})["contextChips"] = {}
                    action_override = "change_pathology_group"

                if old_group != new_group:
                    touched_sections.append("clinicalClassification.pathologyGroup")
                    if old_group and old_group != "unknown":
                        ck_map = surgery.setdefault("preopChecklist", {})
                        if "CK-04" not in explicit_ck_verifies:
                            _invalidate_ck_item_for_reverify(ck_map, "CK-04", invalidated_codes)
                        if "CK-05" not in explicit_ck_verifies and new_group not in ("benign_anorectal", "benign_colorectal_abdominal"):
                            _invalidate_ck_item_for_reverify(ck_map, "CK-05", invalidated_codes)

                pg_cur["confirmedValue"] = new_group
                pg_cur["confirmedByStaffId"] = actor_id
                if "otherPathologyNote" in pg_in:
                    pg_cur["otherPathologyNote"] = str(pg_in.get("otherPathologyNote") or "").strip()

                ck05 = surgery.setdefault("preopChecklist", {}).setdefault("CK-05", {"state": "unverified"})
                if new_group in ("benign_anorectal", "benign_colorectal_abdominal"):
                    ck05["state"] = "not_applicable"
                    ck05["autoDerivedFrom"] = f"pathologyGroup={new_group}"
                    ck05["needsReverify"] = False
                    ck05.pop("uiBannerText", None)
                    if not trainee and actor_id in ATTENDING_STAFF_IDS:
                        ck05["verifiedByStaffId"] = actor_id
                elif ck05.get("state") == "not_applicable":
                    ck05["state"] = "unverified"
                    ck05["verifiedByStaffId"] = None
                    ck05.pop("autoDerivedFrom", None)

        if isinstance(cc_in.get("procedureClass"), dict):
            pc_in = copy.deepcopy(cc_in["procedureClass"])
            # SYN-TC-08: NEVER trust client-supplied verifiedClass / verifiedByStaffId / verifiedBasisCode / verifiedAt!
            for strip_k in ("verifiedClass", "verifiedByStaffId", "verifiedBasisCode", "verifiedAt", "verifiedNote"):
                pc_in.pop(strip_k, None)

            pc_cur = cc.setdefault("procedureClass", {})
            before_pc_sig = canonical_json({
                "cat": pc_cur.get("confirmedCatalogEntryId"),
                "cls": pc_cur.get("confirmedClass"),
                "cust": pc_cur.get("isCustomOutsideCatalog"),
                "cname": pc_cur.get("customProcedureName"),
                "prop": pc_cur.get("proposedClass"),
            })

            wants_custom = bool(
                pc_in.get("isCustomOutsideCatalog") is True
                or pc_in.get("confirmedCatalogEntryId") == "CUSTOM_OUTSIDE_DM309"
                or (pc_cur.get("isCustomOutsideCatalog") is True and "isCustomOutsideCatalog" not in pc_in and "confirmedCatalogEntryId" not in pc_in)
            )
            if pc_in.get("isCustomOutsideCatalog") is False:
                wants_custom = False

            if wants_custom:
                pc_cur["isCustomOutsideCatalog"] = True
                pc_cur["confirmedCatalogEntryId"] = "CUSTOM_OUTSIDE_DM309"
                prefill_name = str(
                    pc_in.get("customProcedureName")
                    if "customProcedureName" in pc_in and str(pc_in.get("customProcedureName") or "").strip()
                    else (pc_cur.get("customProcedureName") or surgery.get("method") or "")
                ).strip()[:240]
                pc_cur["customProcedureName"] = prefill_name
                if "customReasonChip" in pc_in:
                    r_chip = pc_in.get("customReasonChip")
                    if r_chip is not None and r_chip not in VALID_CUSTOM_REASON_CHIPS:
                        raise ApprovalEngineError(422, "INVALID_CUSTOM_REASON_CHIP", f"Lý do ngoài danh mục '{r_chip}' không hợp lệ.")
                    pc_cur["customReasonChip"] = r_chip
                if "customReasonNote" in pc_in:
                    pc_cur["customReasonNote"] = str(pc_in.get("customReasonNote") or "").strip()[:240]
                prop_cls = pc_in.get("proposedClass") or pc_in.get("confirmedClass") or pc_cur.get("proposedClass")
                if prop_cls is not None:
                    if prop_cls not in ("PT-ĐB", "PT-I", "PT-II", "PT-III", "unclassified"):
                        raise ApprovalEngineError(422, "INVALID_PROPOSED_CLASS", f"Hạng đề xuất '{prop_cls}' không hợp lệ.")
                    pc_cur["proposedClass"] = prop_cls
                    pc_cur["confirmedClass"] = prop_cls
                pc_cur["confirmedByStaffId"] = actor_id
                pc_cur.setdefault("verifiedClass", None)
                pc_cur.setdefault("verifiedByStaffId", None)
                pc_cur.setdefault("verifiedBasisCode", None)
            else:
                pc_cur["isCustomOutsideCatalog"] = False
                pc_cur["customProcedureName"] = None
                pc_cur["proposedClass"] = None
                if "confirmedCatalogEntryId" in pc_in:
                    entry_id = pc_in.get("confirmedCatalogEntryId")
                    entry = lookup_catalog_entry(catalog, entry_id) if entry_id else None
                    if entry:
                        pc_cur["confirmedCatalogEntryId"] = entry_id
                        pc_cur["confirmedClass"] = entry["procedureClass"]
                        pc_cur["confirmedByStaffId"] = actor_id
                    elif entry_id:
                        pc_cur["confirmedCatalogEntryId"] = entry_id
                        if pc_in.get("confirmedClass") in ("PT-ĐB", "PT-I", "PT-II", "PT-III", "unclassified"):
                            pc_cur["confirmedClass"] = pc_in["confirmedClass"]
                            pc_cur["confirmedByStaffId"] = actor_id
                elif pc_in.get("confirmedClass") in ("PT-ĐB", "PT-I", "PT-II", "PT-III", "unclassified"):
                    pc_cur["confirmedClass"] = pc_in["confirmedClass"]
                    pc_cur["confirmedByStaffId"] = actor_id
                if "customReasonChip" in pc_in:
                    r_chip = pc_in.get("customReasonChip")
                    if r_chip is not None and r_chip not in VALID_CUSTOM_REASON_CHIPS:
                        raise ApprovalEngineError(422, "INVALID_CUSTOM_REASON_CHIP", f"Lý do '{r_chip}' không hợp lệ.")
                    pc_cur["customReasonChip"] = r_chip
                if "unclassifiedNote" in pc_in:
                    pc_cur["unclassifiedNote"] = str(pc_in.get("unclassifiedNote") or "").strip()

            after_pc_sig = canonical_json({
                "cat": pc_cur.get("confirmedCatalogEntryId"),
                "cls": pc_cur.get("confirmedClass"),
                "cust": pc_cur.get("isCustomOutsideCatalog"),
                "cname": pc_cur.get("customProcedureName"),
                "prop": pc_cur.get("proposedClass"),
            })
            if after_pc_sig != before_pc_sig:
                touched_sections.append("clinicalClassification.procedureClass")
                if pc_cur.get("verifiedClass") is not None:
                    pc_cur["verifiedClass"] = None
                    pc_cur["verifiedByStaffId"] = None
                    pc_cur["verifiedBasisCode"] = None
                    pc_cur["verifiedAt"] = None
                if "CK-08" not in explicit_ck_verifies:
                    _invalidate_ck_item_for_reverify(surgery.setdefault("preopChecklist", {}), "CK-08", invalidated_codes)

        if isinstance(cc_in.get("columnCompliance"), dict):
            col_in = cc_in["columnCompliance"]
            col_cur = cc.setdefault("columnCompliance", {})
            if "declaredMode" in col_in:
                col_cur["declaredMode"] = col_in["declaredMode"]
            if "overColumnRef" in col_in:
                col_cur["overColumnRef"] = str(col_in.get("overColumnRef") or "").strip()

        pc_cur = cc.get("procedureClass") or {}
        is_cust_now = bool(pc_cur.get("isCustomOutsideCatalog") is True)
        live_col = evaluate_column_compliance(
            catalog,
            db,
            main_surgeon_id=surgery.get("mainSurgeon"),
            approach_type=surgery.get("approachType", "mo"),
            surgery_date=surgery.get("date", ""),
            confirmed_class=pc_cur.get("confirmedClass"),
            confirmed_catalog_id=pc_cur.get("confirmedCatalogEntryId"),
            is_custom_outside_catalog=is_cust_now,
            proposed_class=pc_cur.get("proposedClass"),
            verified_class=pc_cur.get("verifiedClass"),
        )
        col_cur = cc.setdefault("columnCompliance", {})
        col_cur.update(live_col)

        if "urgencyLevel" in cc_in and cc_in["urgencyLevel"] in VALID_URGENCY_LEVELS:
            cc["urgencyLevel"] = cc_in["urgencyLevel"]
        if "semiUrgentClinicalReason" in cc_in:
            cc["semiUrgentClinicalReason"] = str(cc_in.get("semiUrgentClinicalReason") or "").strip()

    # 4. Clinical Chips (C-04..C-10 & Context B1..B4 + Site-locked TNM + Stale Verification Invalidation)
    if isinstance(payload.get("clinicalChips"), dict):
        chips_in = payload["clinicalChips"]
        chips = surgery.setdefault("clinicalChips", {})
        ck_map = surgery.setdefault("preopChecklist", {})

        def _maybe_invalidate_ck03_on_history_change():
            if "CK-03" in explicit_ck_verifies:
                return
            ck03 = ck_map.get("CK-03") or {}
            v_by = ck03.get("verifiedByStaffId")
            if v_by is not None and (trainee or actor_id != v_by):
                _invalidate_ck_item_for_reverify(ck_map, "CK-03", invalidated_codes)

        if isinstance(chips_in.get("comorbidities"), dict):
            cm_in = chips_in["comorbidities"]
            prev_cm = chips.get("comorbidities") or {}
            vals = cm_in.get("values") if isinstance(cm_in.get("values"), list) else []
            if "none" in vals and len(vals) > 1:
                raise ApprovalEngineError(422, "MUTUALLY_EXCLUSIVE_CHIPS", "Chip 'Chưa ghi nhận' loại trừ các bệnh nền khác.")
            for v in vals:
                if v not in VALID_COMORBIDITIES:
                    raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Giá trị bệnh nền '{v}' không hợp lệ.")
            has_real_comorb = any(v != "none" for v in vals)
            med_note_raw = str(
                cm_in.get("medicalTreatmentNote")
                if "medicalTreatmentNote" in cm_in
                else (prev_cm.get("medicalTreatmentNote") or "")
            ).strip()[:240]
            new_cm = {
                "confirmed": bool(cm_in.get("confirmed", len(vals) > 0)),
                "suggestedValues": prev_cm.get("suggestedValues") or ["none"],
                "values": vals,
                "medicalTreatmentNote": (med_note_raw or None) if has_real_comorb else None,
                "otherComorbidityNote": str(cm_in.get("otherComorbidityNote") or "").strip()[:160] if "other" in vals else "",
            }
            if canonical_json(prev_cm) != canonical_json(new_cm):
                touched_sections.append("clinicalChips.comorbidities")
                _maybe_invalidate_ck03_on_history_change()
            chips["comorbidities"] = new_cm

        if isinstance(chips_in.get("surgicalHistory"), dict):
            sh_in = chips_in["surgicalHistory"]
            prev_sh = chips.get("surgicalHistory") or {}
            sh_status = sh_in.get("status")
            if sh_status is not None and sh_status not in VALID_SURGICAL_HISTORY_STATUS:
                raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Trạng thái tiền sử ngoại khoa '{sh_status}' không hợp lệ.")
            raw_cats = sh_in.get("categories") if isinstance(sh_in.get("categories"), list) else []
            for c_val in raw_cats:
                if c_val not in VALID_SURGICAL_HISTORY_CATEGORIES:
                    raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Phân nhóm tiền sử ngoại khoa '{c_val}' không hợp lệ.")
            cats = raw_cats if sh_status == "present" else []
            has_abd = any(c in ("prior_colorectal_stoma", "prior_abdominal_pelvic") for c in cats)
            scar_in = sh_in.get("abdominalScarType", prev_sh.get("abdominalScarType", "not_applicable"))
            if scar_in not in VALID_ABDOMINAL_SCAR_TYPES:
                raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Loại sẹo mổ bụng '{scar_in}' không hợp lệ.")
            scar_val = scar_in if (sh_status == "present" and has_abd) else "not_applicable"
            det_raw = str(
                sh_in.get("detailNote")
                if "detailNote" in sh_in
                else (prev_sh.get("detailNote") or "")
            ).strip()[:200]
            sug_sh = suggest_surgical_history(surgery.get("diagnosis", ""), surgery.get("method", ""))
            new_sh = {
                "confirmed": bool(sh_in.get("confirmed", sh_status is not None)),
                "suggestedStatus": prev_sh.get("suggestedStatus") or sug_sh["suggestedStatus"],
                "suggestedCategories": prev_sh.get("suggestedCategories") if "suggestedCategories" in prev_sh else sug_sh["suggestedCategories"],
                "status": sh_status,
                "categories": cats,
                "abdominalScarType": scar_val,
                "detailNote": (det_raw or None) if sh_status == "present" else None,
            }
            if canonical_json(prev_sh) != canonical_json(new_sh):
                touched_sections.append("clinicalChips.surgicalHistory")
                _maybe_invalidate_ck03_on_history_change()
            chips["surgicalHistory"] = new_sh

        if isinstance(chips_in.get("allergyHistory"), dict):
            al_in = chips_in["allergyHistory"]
            prev_al = chips.get("allergyHistory") or {}
            al_status = al_in.get("status")
            if al_status is not None and al_status not in VALID_ALLERGY_STATUS:
                raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Trạng thái tiền sử dị ứng '{al_status}' không hợp lệ.")
            raw_grps = al_in.get("allergenGroups") if isinstance(al_in.get("allergenGroups"), list) else []
            for g_val in raw_grps:
                if g_val not in VALID_ALLERGY_GROUPS:
                    raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Nhóm dị nguyên '{g_val}' không hợp lệ.")
            sev_in = al_in.get("reactionSeverity", prev_al.get("reactionSeverity"))
            if sev_in is not None and sev_in not in VALID_ALLERGY_SEVERITIES:
                raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Mức độ phản ứng dị ứng '{sev_in}' không hợp lệ.")
            det_al = str(
                al_in.get("allergenDetail")
                if "allergenDetail" in al_in
                else (prev_al.get("allergenDetail") or "")
            ).strip()[:160]
            new_al = {
                "confirmed": bool(al_in.get("confirmed", al_status is not None)),
                "suggestedStatus": prev_al.get("suggestedStatus") or "none",
                "status": al_status,
                "allergenGroups": raw_grps if al_status == "present" else [],
                "reactionSeverity": (sev_in or "mild_moderate") if al_status == "present" else None,
                "allergenDetail": (det_al or None) if al_status == "present" else None,
            }
            if canonical_json(prev_al) != canonical_json(new_al):
                touched_sections.append("clinicalChips.allergyHistory")
                _maybe_invalidate_ck03_on_history_change()
            chips["allergyHistory"] = new_al

        if isinstance(chips_in.get("socialHabits"), dict):
            soc_in = chips_in["socialHabits"]
            prev_soc = chips.get("socialHabits") or {}
            prev_smk = prev_soc.get("smoking") or {}
            prev_sub = prev_soc.get("substanceAbuse") or {}
            alc = soc_in.get("alcoholUse", prev_soc.get("alcoholUse"))
            if alc is not None and alc not in VALID_ALCOHOL_USE:
                raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Mức sử dụng rượu bia '{alc}' không hợp lệ.")
            smk_in = soc_in.get("smoking") if isinstance(soc_in.get("smoking"), dict) else {}
            smk_st = smk_in.get("status", prev_smk.get("status"))
            if smk_st is not None and smk_st not in VALID_SMOKING_STATUS:
                raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Tình trạng hút thuốc lá '{smk_st}' không hợp lệ.")
            py_unk = bool(smk_in.get("packYearsUnknown", prev_smk.get("packYearsUnknown", False))) if smk_st in ("current", "former") else False
            py_raw = smk_in.get("packYears", prev_smk.get("packYears")) if smk_st in ("current", "former") else None
            py_val = None
            if smk_st in ("current", "former") and not py_unk and py_raw is not None and str(py_raw).strip() != "":
                try:
                    py_num = round(float(py_raw), 1)
                except (TypeError, ValueError):
                    raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", "Số gói/năm phải là số hợp lệ (0.1 – 200).")
                if py_num < 0.1 or py_num > 200.0:
                    raise ApprovalEngineError(422, "SMOKING_PACK_YEARS_REQUIRED", "Số gói/năm phải nằm trong khoảng 0.1 – 200.")
                py_val = py_num
            sub_in = soc_in.get("substanceAbuse") if isinstance(soc_in.get("substanceAbuse"), dict) else {}
            sub_st = sub_in.get("status", prev_sub.get("status"))
            if sub_st is not None and sub_st not in VALID_SUBSTANCE_STATUS:
                raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Tình trạng chất gây nghiện '{sub_st}' không hợp lệ.")
            sub_note_raw = str(
                sub_in.get("substanceNote")
                if "substanceNote" in sub_in
                else (prev_sub.get("substanceNote") or "")
            ).strip()[:160]
            all_filled = alc is not None and smk_st is not None and sub_st is not None
            new_soc = {
                "confirmed": bool(soc_in.get("confirmed", all_filled)),
                "alcoholUse": alc,
                "smoking": {
                    "status": smk_st,
                    "packYears": py_val,
                    "packYearsUnknown": py_unk,
                },
                "substanceAbuse": {
                    "status": sub_st,
                    "substanceNote": (sub_note_raw or None) if sub_st == "yes" else None,
                },
            }
            if canonical_json(prev_soc) != canonical_json(new_soc):
                touched_sections.append("clinicalChips.socialHabits")
                _maybe_invalidate_ck03_on_history_change()
            chips["socialHabits"] = new_soc

        if isinstance(chips_in.get("antithromboticPlan"), dict):
            at_in = chips_in["antithromboticPlan"]
            prev_at = chips.get("antithromboticPlan") or {}
            mode = at_in.get("mode")
            if mode is not None and mode not in VALID_ANTITHROMBOTIC_MODES:
                raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Chế độ thuốc chống huyết khối '{mode}' không hợp lệ.")
            new_at = {
                "confirmed": bool(at_in.get("confirmed", mode is not None)),
                "mode": mode,
                "drugName": str(at_in.get("drugName") or "").strip(),
                "bridgingAgent": str(at_in.get("bridgingAgent") or "").strip(),
                "lastDoseAt": str(at_in.get("lastDoseAt") or "").strip(),
                "approvingSpecialtyOrDoctor": str(at_in.get("approvingSpecialtyOrDoctor") or "").strip(),
                "planReferenceNote": str(at_in.get("planReferenceNote") or "").strip(),
            }
            if canonical_json(prev_at) != canonical_json(new_at):
                touched_sections.append("clinicalChips.antithromboticPlan")
                # Mục 4.C Row 2 & SYN-TC-30: invalidate CK-01 & CK-03 unless explicitly re-verified in same save!
                if "CK-01" not in explicit_ck_verifies:
                    _invalidate_ck_item_for_reverify(ck_map, "CK-01", invalidated_codes)
                if "CK-03" not in explicit_ck_verifies:
                    _invalidate_ck_item_for_reverify(ck_map, "CK-03", invalidated_codes)
            chips["antithromboticPlan"] = new_at

        if isinstance(chips_in.get("bloodAndDevices"), dict):
            bd_in = chips_in["bloodAndDevices"]
            prev_bd = chips.get("bloodAndDevices") or {}
            vals = bd_in.get("values") if isinstance(bd_in.get("values"), list) else []
            if "basic_instruments_only" in vals and len(vals) > 1:
                raise ApprovalEngineError(422, "MUTUALLY_EXCLUSIVE_CHIPS", "'Chỉ dụng cụ cơ bản' loại trừ các thiết bị đặc thù khác.")
            if surgery.get("approachType") == "robot" and "basic_instruments_only" in vals:
                raise ApprovalEngineError(422, "MUTUALLY_EXCLUSIVE_CHIPS", "Ca phẫu thuật Robot không được chọn 'Chỉ dụng cụ cơ bản'.")
            for v in vals:
                if v not in VALID_BLOOD_DEVICES:
                    raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Thiết bị/máu '{v}' không hợp lệ.")
            new_bd = {
                "confirmed": bool(bd_in.get("confirmed", len(vals) > 0)),
                "values": vals,
                "otherDeviceNote": str(bd_in.get("otherDeviceNote") or "").strip(),
            }
            if canonical_json(prev_bd) != canonical_json(new_bd):
                touched_sections.append("clinicalChips.bloodAndDevices")
                if "CK-07" not in explicit_ck_verifies and (trainee or actor_id != (ck_map.get("CK-07") or {}).get("verifiedByStaffId")):
                    _invalidate_ck_item_for_reverify(ck_map, "CK-07", invalidated_codes)
            chips["bloodAndDevices"] = new_bd

        if isinstance(chips_in.get("stomaPlan"), dict):
            st_in = chips_in["stomaPlan"]
            prev_st_plan = chips.get("stomaPlan") or {}
            sval = st_in.get("value")
            if sval is not None and sval not in VALID_STOMA_PLANS:
                raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Kế hoạch HMNT '{sval}' không hợp lệ.")
            new_st_plan = {
                "confirmed": bool(st_in.get("confirmed", sval is not None)),
                "value": sval,
                "stomaNote": str(st_in.get("stomaNote") or "").strip(),
            }
            if canonical_json(prev_st_plan) != canonical_json(new_st_plan):
                touched_sections.append("clinicalChips.stomaPlan")
            chips["stomaPlan"] = new_st_plan

        if isinstance(chips_in.get("contextChips"), dict):
            ctx_cur = chips.setdefault("contextChips", {})
            for ctx_key in ("fistulaContext", "benignAbdominalContext", "cancerContext", "specialNeoplasmContext"):
                if isinstance(chips_in["contextChips"].get(ctx_key), dict):
                    prev_ctx = copy.deepcopy(ctx_cur.get(ctx_key) or {})
                    ctx_in_val = copy.deepcopy(chips_in["contextChips"][ctx_key])

                    if ctx_key == "cancerContext":
                        # Merge safely onto existing cancerContext so switching multimodalStatus NEVER wipes baselineClinicalStage (V2-G3)
                        merged_c = copy.deepcopy(prev_ctx)
                        prev_mm = prev_ctx.get("multimodalStatus")
                        for k_c, v_c in ctx_in_val.items():
                            merged_c[k_c] = copy.deepcopy(v_c)

                        locs = merged_c.get("tumorLocation") or []
                        merged_c["isSynchronousMultiSite"] = len(locs) >= 2
                        is_rectal_or_anal = any(str(l).startswith("rectum_") or l == "anal_canal" for l in locs)
                        if not is_rectal_or_anal and not merged_c.get("crmStatus"):
                            merged_c["crmStatus"] = "not_applicable"

                        new_mm = merged_c.get("multimodalStatus")
                        neoadj_set = {"post_neoadjuvant_crt", "post_long_course_crt", "post_short_course_rt", "post_tnt", "post_chemo"}

                        # Sync baselineClinicalStage <-> clinicalStage cleanly without flipping prefix c -> yc!
                        if "clinicalStage" in ctx_in_val and isinstance(ctx_in_val["clinicalStage"], dict):
                            cs_in = ctx_in_val["clinicalStage"]
                            if new_mm in neoadj_set and merged_c.get("baselineClinicalStage") and "baselineClinicalStage" not in ctx_in_val:
                                # Keep prior baselineClinicalStage intact if restaging is being updated
                                if "restagingPostNeoadjuvant" not in ctx_in_val:
                                    merged_c["restagingPostNeoadjuvant"] = {
                                        "T": cs_in.get("T") or cs_in.get("ycT") or cs_in.get("cT"),
                                        "N": cs_in.get("N") or cs_in.get("ycN") or cs_in.get("cN"),
                                        "M": cs_in.get("M") or cs_in.get("ycM") or cs_in.get("cM"),
                                        "stagingNote": str(cs_in.get("stagingNote") or "").strip(),
                                    }
                            else:
                                merged_c["baselineClinicalStage"] = {
                                    "T": cs_in.get("T") or cs_in.get("cT"),
                                    "N": cs_in.get("N") or cs_in.get("cN"),
                                    "M": cs_in.get("M") or cs_in.get("cM"),
                                    "stagingNote": str(cs_in.get("stagingNote") or "").strip(),
                                }

                        if prev_mm == "upfront_surgery" and new_mm in neoadj_set:
                            # V2-G3: Preserve baselineClinicalStage (cTNM), open empty restagingPostNeoadjuvant if not explicitly provided!
                            if not merged_c.get("baselineClinicalStage") and isinstance(prev_ctx.get("clinicalStage"), dict):
                                pcs = prev_ctx["clinicalStage"]
                                merged_c["baselineClinicalStage"] = {
                                    "T": pcs.get("T") or pcs.get("cT"),
                                    "N": pcs.get("N") or pcs.get("cN"),
                                    "M": pcs.get("M") or pcs.get("cM"),
                                    "stagingNote": str(pcs.get("stagingNote") or "").strip(),
                                }
                            if "restagingPostNeoadjuvant" not in ctx_in_val:
                                merged_c["restagingPostNeoadjuvant"] = {
                                    "T": None,
                                    "N": None,
                                    "M": None,
                                    "stagingNote": "",
                                }
                            for inv_c in ("CK-04", "CK-05", "CK-06"):
                                if inv_c not in explicit_ck_verifies:
                                    _invalidate_ck_item_for_reverify(ck_map, inv_c, invalidated_codes)

                        # Keep legacy clinicalStage mirror populated for backward compatibility
                        if new_mm in neoadj_set and isinstance(merged_c.get("restagingPostNeoadjuvant"), dict):
                            rst = merged_c["restagingPostNeoadjuvant"]
                            if rst.get("T") or rst.get("N") or rst.get("M") or rst.get("ycT") or rst.get("cT"):
                                merged_c["clinicalStage"] = {
                                    "cT": rst.get("T") or rst.get("ycT") or rst.get("cT"),
                                    "cN": rst.get("N") or rst.get("ycN") or rst.get("cN"),
                                    "cM": rst.get("M") or rst.get("ycM") or rst.get("cM"),
                                    "stagingNote": str(rst.get("stagingNote") or (merged_c.get("clinicalStage") or {}).get("stagingNote") or "").strip(),
                                }
                        elif isinstance(merged_c.get("baselineClinicalStage"), dict):
                            bst = merged_c["baselineClinicalStage"]
                            if bst.get("T") or bst.get("N") or bst.get("M") or bst.get("cT"):
                                merged_c["clinicalStage"] = {
                                    "cT": bst.get("T") or bst.get("cT"),
                                    "cN": bst.get("N") or bst.get("cN"),
                                    "cM": bst.get("M") or bst.get("cM"),
                                    "stagingNote": str(bst.get("stagingNote") or (merged_c.get("clinicalStage") or {}).get("stagingNote") or "").strip(),
                                }

                        tnm_eval = evaluate_tnm_assessment(merged_c, config=cfg)
                        merged_c["tnmEvaluation"] = tnm_eval
                        if not merged_c.get("lockedRuleSetId") and tnm_eval.get("ruleSetId"):
                            merged_c["lockedRuleSetId"] = tnm_eval["ruleSetId"]
                        elif prev_ctx.get("tumorLocation") != merged_c.get("tumorLocation") or prev_ctx.get("preopHistology") != merged_c.get("preopHistology"):
                            merged_c["lockedRuleSetId"] = tnm_eval.get("ruleSetId")

                        prev_cmp = {k: v for k, v in prev_ctx.items() if k != "tnmEvaluation"}
                        new_cmp = {k: v for k, v in merged_c.items() if k != "tnmEvaluation"}
                        if canonical_json(prev_cmp) != canonical_json(new_cmp):
                            touched_sections.append("clinicalChips.contextChips.cancerContext")
                            for inv_c in ("CK-04", "CK-05"):
                                if inv_c not in explicit_ck_verifies:
                                    _invalidate_ck_item_for_reverify(ck_map, inv_c, invalidated_codes)
                        ctx_cur[ctx_key] = merged_c
                    else:
                        if canonical_json(prev_ctx) != canonical_json(ctx_in_val):
                            touched_sections.append(f"clinicalChips.contextChips.{ctx_key}")
                            if ctx_key == "specialNeoplasmContext":
                                for inv_c in ("CK-04", "CK-05"):
                                    if inv_c not in explicit_ck_verifies:
                                        _invalidate_ck_item_for_reverify(ck_map, inv_c, invalidated_codes)
                        ctx_cur[ctx_key] = ctx_in_val

    # 5. Pre-op Checklist CK-01..CK-08 (Trainee guard + 'other_attending' direct exam scope + Reverify banner clearance)
    if isinstance(payload.get("preopChecklist"), dict):
        ck_in = payload["preopChecklist"]
        ck_cur = surgery.setdefault("preopChecklist", {})
        for code in CK_CODES:
            if code not in ck_in or not isinstance(ck_in[code], dict):
                continue
            item_in = ck_in[code]
            item_cur = ck_cur.setdefault(code, {"state": "unverified", "preparedByStaffId": None, "verifiedByStaffId": None})
            before_item_fp = canonical_json(item_cur)
            req_state = item_in.get("state", item_cur.get("state", "unverified"))
            if req_state not in VALID_CK_STATES:
                raise ApprovalEngineError(422, "INVALID_CK_STATE", f"Trạng thái '{req_state}' của {code} không hợp lệ.")

            if trainee:
                if code in ("CK-04", "CK-08"):
                    raise ApprovalEngineError(
                        403,
                        "FORBIDDEN",
                        f"Bác sĩ học viên không có quyền xác nhận mục {code} (dành riêng cho BS chính).",
                    )
                if req_state not in ("unverified", "prepared_ok"):
                    raise ApprovalEngineError(
                        403,
                        "FORBIDDEN",
                        f"Bác sĩ học viên chỉ được đánh dấu 'HV đã rà sơ bộ' (prepared_ok), không được chốt '{req_state}'.",
                    )
                had_verified = item_cur.get("verifiedByStaffId") is not None
                item_cur["state"] = req_state
                if req_state == "prepared_ok":
                    item_cur["preparedByStaffId"] = actor_id
                if "clinicalPlanNote" in item_in:
                    item_cur["clinicalPlanNote"] = str(item_in.get("clinicalPlanNote") or "").strip()
                if had_verified:
                    item_cur["previousVerifiedByStaffId"] = item_cur.get("verifiedByStaffId")
                    item_cur["verifiedByStaffId"] = None
                    item_cur["needsReverify"] = True
                    item_cur["uiBannerText"] = REVERIFY_UI_BANNER
                    if code not in invalidated_codes:
                        invalidated_codes.append(code)
            else:
                if code in ("CK-04", "CK-08") and not can_restricted_ck:
                    raise ApprovalEngineError(
                        403,
                        "NOT_AUTHORIZED_FOR_RESTRICTED_CHECKLIST",
                        "Chỉ BS mổ chính, BS phụ mổ 1, BS chính khu vực POD hoặc BS chính điều phối của ca mổ mới được xác nhận Phim / nội soi gốc và Cam kết phẫu thuật.",
                    )
                prev_verifier = item_cur.get("verifiedByStaffId")
                item_cur["state"] = req_state
                if req_state in ("verified_ok", "verified_abnormal_planned", "not_indicated", "not_applicable", "deferred_emergency"):
                    item_cur["verifiedByStaffId"] = actor_id
                    item_cur["needsReverify"] = False
                    item_cur.pop("uiBannerText", None)
                    if not item_cur.get("preparedByStaffId") and code not in ("CK-04", "CK-08"):
                        item_cur["preparedByStaffId"] = actor_id
                    if actor_role_in_case == "other_attending":
                        item_cur["attestationScope"] = "direct_clinical_exam_by_attending"
                        attestation_scope_used = "direct_clinical_exam_by_attending"
                    else:
                        item_cur["attestationScope"] = "case_attending_responsibility"
                elif req_state in ("unverified", "prepared_ok"):
                    if prev_verifier is not None and prev_verifier != actor_id:
                        item_cur["previousVerifiedByStaffId"] = prev_verifier
                        item_cur["needsReverify"] = True
                        item_cur["uiBannerText"] = REVERIFY_UI_BANNER
                        if code not in invalidated_codes:
                            invalidated_codes.append(code)
                    item_cur["verifiedByStaffId"] = None
                if "clinicalPlanNote" in item_in:
                    item_cur["clinicalPlanNote"] = str(item_in.get("clinicalPlanNote") or "").strip()

            if code == "CK-02" and isinstance(item_in.get("subChecks"), dict):
                subs_cur = item_cur.setdefault("subChecks", {})
                for sk in ("preAnesthesiaExam", "ecg", "chestImaging", "echo"):
                    if sk in item_in["subChecks"]:
                        sv = item_in["subChecks"][sk]
                        if sv not in VALID_SUBCHECK_STATES:
                            raise ApprovalEngineError(422, "INVALID_SUBCHECK_STATE", f"Trạng thái con {sk}='{sv}' không hợp lệ.")
                        if trainee and sv not in ("unverified", "prepared_ok"):
                            raise ApprovalEngineError(403, "FORBIDDEN", "Bác sĩ học viên chỉ được lưu trạng thái rà sơ bộ (prepared_ok).")
                        subs_cur[sk] = sv

            if canonical_json(item_cur) != before_item_fp:
                touched_sections.append(f"preopChecklist.{code}")

    after_tier_a_fp = canonical_json({
        "cc": surgery.get("clinicalClassification"),
        "ck": surgery.get("preopChecklist"),
        "chips": surgery.get("clinicalChips"),
        "ic": surgery.get("interdisciplinaryCoordination"),
        "coord": surgery.get("coordinatingAttendingStaffId"),
    })
    after_all_fp = canonical_json({
        "pa": surgery.get("podAssignment"),
        "cc": surgery.get("clinicalClassification"),
        "ck": surgery.get("preopChecklist"),
        "chips": surgery.get("clinicalChips"),
        "ic": surgery.get("interdisciplinaryCoordination"),
        "coord": surgery.get("coordinatingAttendingStaffId"),
    })
    is_no_op = (after_all_fp == before_all_fp)
    resolved_action = action_override or "save_draft"
    attr_ops = []
    if not is_no_op:
        attr_ops.append({
            "episodeId": surgery.get("episodeId"),
            "actorRoleInCase": actor_role_in_case,
            "roleContextSource": role_ctx_src,
            "attestationScope": attestation_scope_used,
            "actionType": resolved_action,
            "touchedSections": list(dict.fromkeys(touched_sections)),
            "invalidatedChecklistCodes": list(invalidated_codes),
            "snapshotDigest": sha256_hex(after_tier_a_fp)[:16],
        })

    return (
        (after_tier_a_fp != before_tier_a_fp),
        resolved_action,
        {
            "isNoOp": is_no_op,
            "touchedSections": list(dict.fromkeys(touched_sections)),
            "invalidatedChecklistCodes": list(invalidated_codes),
            "attestationScope": attestation_scope_used,
            "attributionOps": attr_ops,
        },
    )


# ───────────────────────── Delegation Validation ─────────────────────────

def find_active_delegation_for_deputy(
    db: dict,
    surgery_id: int,
    urgency_level: str,
    *,
    is_sandbox_case: bool = False,
) -> dict:
    """Checks server-side approvalDelegations at exact current timestamp (CORE-TC-16).
    Never allows a sandbox delegation (isTestSandboxDelegation == True) to authorize real clinical surgeries!
    """
    now = now_vn()
    for d in (db.get("approvalDelegations") or []):
        if not isinstance(d, dict):
            continue
        if d.get("isTestSandboxDelegation") is True and not is_sandbox_case:
            continue
        if d.get("delegateStaffId") != DEPUTY_STAFF_ID or d.get("grantorStaffId") != CHIEF_STAFF_ID:
            continue
        if d.get("revokedAt") is not None:
            continue
        eff_from = parse_iso_dt(d.get("effectiveFrom", ""))
        eff_to = parse_iso_dt(d.get("effectiveTo", ""))
        if not eff_from or not eff_to:
            continue
        if not (eff_from <= now <= eff_to):
            continue
        scope = d.get("scope", "all_departmental_surgeries")
        if scope == "routine_only" and urgency_level == "emergency_exception":
            continue
        if scope == "specific_surgery_ids":
            allowed = d.get("allowedSurgeryIds") or []
            if surgery_id not in allowed:
                continue
        return d
    return None


# ───────────────────────── Sandbox Seed & Cleanup (Zero-PHI) ─────────────────────────

def _build_verified_checklist_for_sandbox(
    attending_id: int,
    trainee_id: int = None,
    *,
    benign: bool = False,
    minor_anorectal_na_ck04: bool = False,
    ck01_abnormal_note: str = None,
    ck05_abnormal_note: str = None,
) -> dict:
    prep_id = trainee_id if is_pos_int(trainee_id) else attending_id
    ck = {}
    for code in CK_CODES:
        if code == "CK-01" and ck01_abnormal_note:
            ck[code] = {
                "state": "verified_abnormal_planned",
                "preparedByStaffId": prep_id,
                "verifiedByStaffId": attending_id,
                "clinicalPlanNote": ck01_abnormal_note,
            }
        elif code == "CK-04" and minor_anorectal_na_ck04:
            ck[code] = {
                "state": "not_applicable",
                "preparedByStaffId": None,
                "verifiedByStaffId": attending_id,
            }
        elif code == "CK-05" and benign:
            ck[code] = {
                "state": "not_applicable",
                "preparedByStaffId": None,
                "verifiedByStaffId": attending_id,
                "autoDerivedFrom": "pathologyGroup=benign",
            }
        elif code == "CK-05" and ck05_abnormal_note:
            ck[code] = {
                "state": "verified_abnormal_planned",
                "preparedByStaffId": prep_id,
                "verifiedByStaffId": attending_id,
                "clinicalPlanNote": ck05_abnormal_note,
            }
        else:
            item = {
                "state": "verified_ok",
                "preparedByStaffId": None if code in ("CK-04", "CK-08") else prep_id,
                "verifiedByStaffId": attending_id,
            }
            if code == "CK-02":
                item["subChecks"] = {
                    "preAnesthesiaExam": "verified_ok",
                    "ecg": "verified_ok",
                    "chestImaging": "verified_ok",
                    "echo": "verified_ok" if not benign else "not_indicated",
                }
            ck[code] = item
    return ck


def _default_v5_history_for_sandbox() -> dict:
    """Clean routine-confirmed C-08..C-10 history baseline for sandbox test cases."""
    return {
        "surgicalHistory": {
            "confirmed": True,
            "suggestedStatus": "none",
            "suggestedCategories": [],
            "status": "none",
            "categories": [],
            "abdominalScarType": "not_applicable",
            "detailNote": None,
        },
        "allergyHistory": {
            "confirmed": True,
            "suggestedStatus": "none",
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
    }


def _stamp_pod_for_sandbox(rec: dict, catalog: dict, ward_room: str, trainee_id: int = None, freeze_snapshot: bool = False):
    r_info = get_pod_room_info(catalog, ward_room, db=None, ref_date=rec.get("date"))
    res_list = r_info.get("residentStaffIds") or []
    prep_id = trainee_id if is_pos_int(trainee_id) else None
    pa = {
        "wardRoom": ward_room,
        "suggestedPodId": r_info.get("podId"),
        "preparedByStaffId": prep_id,
        "podSnapshot": {
            "rosterPeriod": r_info.get("rosterPeriod") or ((catalog.get("podRoster") or {}).get("rosterPeriod")) or "2026-10-05_2026-12-13",
            "rosterSource": r_info.get("rosterSource", "server_roster"),
            "podId": r_info.get("podId"),
            "wardRoom": ward_room,
            "attendingStaffIds": r_info.get("attendingStaffIds", []),
            "residentStaffIds": res_list,
            "capturedAt": now_vn_iso(),
        } if freeze_snapshot else None,
    }
    rec["podAssignment"] = pa


def _finalize_classification_for_sandbox(
    rec: dict,
    catalog: dict,
    db: dict,
    *,
    actor_id: int,
    pathology_group: str,
    catalog_entry_id: str,
    proc_class: str,
    declared_mode: str,
    urgency_level: str = None,
    over_column_ref: str = "",
    semi_urgent_reason: str = "",
    privilege_verified_by: int = None,
):
    cc = rec.setdefault("clinicalClassification", {})
    cc["approachType"] = rec.get("approachType", "mo")
    pg = cc.setdefault("pathologyGroup", {})
    pg["confirmedValue"] = pathology_group
    pg["confirmedByStaffId"] = actor_id
    pc = cc.setdefault("procedureClass", {})
    pc["confirmedCatalogEntryId"] = catalog_entry_id
    pc["confirmedClass"] = proc_class
    pc["confirmedByStaffId"] = actor_id
    live_col = evaluate_column_compliance(
        catalog,
        db,
        main_surgeon_id=rec.get("mainSurgeon"),
        approach_type=rec.get("approachType", "mo"),
        surgery_date=rec.get("date", ""),
        confirmed_class=proc_class,
        confirmed_catalog_id=catalog_entry_id,
    )
    col = {**live_col, "declaredMode": declared_mode}
    if over_column_ref:
        col["overColumnRef"] = over_column_ref
    if is_pos_int(privilege_verified_by):
        col["privilegeVerifiedByStaffId"] = privilege_verified_by
    cc["columnCompliance"] = col
    if urgency_level:
        cc["urgencyLevel"] = urgency_level
    if semi_urgent_reason:
        cc["semiUrgentClinicalReason"] = semi_urgent_reason


def build_sandbox_sample_surgeries(db: dict, data_dir: str, base_dir: str) -> list:
    """
    Generates 16 Randomized Comprehensive Zero-PHI Test Scenarios (100% synthetic, 0% real patients)
    covering every surgical approach (Mổ mở, PTNS, Robot, NSTH), every surgeon column (ĐB, I, II, III,
    Over-column II->I & III->II, Robot certified vs uncertified, External interdisciplinary),
    all clinical modules (B1..B4), antithrombotic modes, and all 10 approval lifecycle states.
    """
    rng = random.SystemRandom()
    catalog = load_procedure_catalog(data_dir, base_dir)
    cfg = get_approval_config(db)

    existing = (db.get("surgeries") or []) + (db.get("surgeriesTrash") or [])
    max_id = max([int(r["id"]) for r in existing if isinstance(r, dict) and is_pos_int(r.get("id"))], default=900000)
    base_id = max(max_id + 1, int(db.get("_nextSandboxSurgeryId") or 0), 990001)

    avail_staff = {int(s["id"]) for s in (db.get("staff") or []) if isinstance(s, dict) and is_pos_int(s.get("id"))}
    ext_docs = [int(d["id"]) for d in (db.get("externalDoctors") or []) if isinstance(d, dict) and is_pos_int(d.get("id"))]

    def pick_staff(pool):
        valid = [x for x in pool if x in avail_staff] if avail_staff else list(pool)
        return rng.choice(valid or list(pool))

    trainee_pool = [16, 43, 44, 45, 46, 47, 48, 50]
    rooms_pod1 = ["707", "718"]
    rooms_pod2 = ["705", "706", "711", "712", "712A", "719"]
    rooms_pod3 = ["708", "709", "710"]
    all_rooms = rooms_pod1 + rooms_pod2 + rooms_pod3

    synthetic_aliases = [
        "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel",
        "India", "Juliet", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa",
        "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey", "Xray",
    ]
    rng.shuffle(synthetic_aliases)

    today = now_vn().date()
    ts_now = now_vn_iso()
    batch_tag = f"{rng.randint(100, 999)}"

    def d_off(min_d: int, max_d: int) -> str:
        return (today + timedelta(days=rng.randint(min_d, max_d))).strftime("%Y-%m-%d")

    def mock_nv(idx: int) -> str:
        return f"MOCK-NV-{batch_tag}{idx:02d}"

    def mock_name(idx: int, scenario_tag: str) -> str:
        code = synthetic_aliases[(idx - 1) % len(synthetic_aliases)]
        return f"Bệnh Nhân Giả Lập {idx:02d} ({code}-{batch_tag}) - {scenario_tag}"

    def _seed_contrib(rec: dict, sid: int, role_in_case: str, action_type: str):
        st = next((x for x in (db.get("staff") or []) if isinstance(x, dict) and x.get("id") == sid), None) or {}
        full_name = f"{st.get('title', '')} {st.get('name', '')}".strip() or f"BS #{sid}"
        record_contributor_on_surgery(
            rec,
            {"staffId": sid, "name": full_name, "username": st.get("username") or f"staff_{sid}", "role": st.get("role") or ""},
            role_in_case=role_in_case,
            action_type=action_type,
            timestamp_iso=ts_now,
        )

    cases = []

    # ── CA TEST 01: Draft mới tinh — Mổ mở Cột II đúng cột, B1 Rò hậu môn đơn giản (để bấm thử từ đầu A->Z) ──
    c01 = initialize_new_surgery_record({
        "id": base_id,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-01_DRAFT_OPEN_COL2_FISTULA",
        "patientName": mock_name(1, "Rò HM Đơn Giản [Mới tạo]"),
        "birthYear": rng.randint(1982, 2001),
        "admissionId": mock_nv(1),
        "date": d_off(3, 5),
        "duration": rng.choice([45, 60]),
        "surgeryType": "chuongtrinh",
        "approachType": "mo",
        "mainSurgeon": 8 if (not avail_staff or 8 in avail_staff) else pick_staff([7, 8, 9]),
        "assistSurgeon1": 44 if (not avail_staff or 44 in avail_staff) else pick_staff(trainee_pool),
        "diagnosis": "Rò hậu môn xuyên cơ thắt thấp chưa biến chứng",
        "method": "Phẫu thuật điều trị rò hậu môn đơn giản",
        "notes": "[CA TEST #01 — Mới khởi tạo: bấm mở để thử luồng HV rà sơ bộ -> BS chính xác nhận B1 MRI -> Trình -> Duyệt]",
    }, catalog, db)
    cases.append(c01)

    # ── CA TEST 02: Draft mới tinh — Mổ mở Cột III đúng cột, Tiểu phẫu HM-TT (CK-04 CĐHA cho phép N/A) ──
    ms02 = pick_staff([10, 11, 12])
    c02 = initialize_new_surgery_record({
        "id": base_id + 1,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-02_DRAFT_OPEN_COL3_MINOR",
        "patientName": mock_name(2, "Trĩ Tắc Mạch [Cột III - Tiểu phẫu]"),
        "birthYear": rng.randint(1975, 1999),
        "admissionId": mock_nv(2),
        "date": d_off(3, 6),
        "duration": rng.choice([30, 45]),
        "surgeryType": "chuongtrinh",
        "approachType": "mo",
        "mainSurgeon": ms02,
        "assistSurgeon1": pick_staff(trainee_pool),
        "diagnosis": "Trĩ ngoại tắc mạch cấp giờ thứ 36",
        "method": "Phẫu thuật lấy trĩ tắc mạch",
        "notes": "[CA TEST #02 — Kiểm thử PTV Cột III đứng mổ mở PT-III đúng cột & mục CK-04 CĐHA Không áp dụng]",
    }, catalog, db)
    cases.append(c02)

    # ── CA TEST 03: Ready for Attending (🩺 HV đã rà sơ bộ) — Mổ chương trình Cột I, Rò HM phức tạp tái phát + Đã chụp MRI đường rò ──
    ms03 = pick_staff([6, 4])
    tr03 = pick_staff(trainee_pool)
    rm03 = rng.choice(["712A", "719", "706"])
    c03 = initialize_new_surgery_record({
        "id": base_id + 2,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-03_HV_PREPARED_COMPLEX_FISTULA_MRI",
        "patientName": mock_name(3, "Rò HM Tái Phát Hình Móng Ngựa [HV đã rà]"),
        "birthYear": rng.randint(1968, 1992),
        "admissionId": mock_nv(3),
        "date": d_off(3, 5),
        "duration": rng.choice([75, 90]),
        "surgeryType": "chuongtrinh",
        "approachType": "mo",
        "mainSurgeon": ms03,
        "assistSurgeon1": tr03,
        "diagnosis": "Rò hậu môn phức tạp tái phát lần 2 đường rò hình móng ngựa",
        "method": "Phẫu thuật điều trị rò hậu môn phức tạp",
        "notes": "[CA TEST #03 — BS học viên đã rà sơ bộ CK-01..03/06/07 & chọn Đã chụp MRI đường rò; chờ BS chính xác nhận CK-04 & CK-08]",
    }, catalog, db)
    _stamp_pod_for_sandbox(c03, catalog, rm03, trainee_id=tr03, freeze_snapshot=False)
    _finalize_classification_for_sandbox(
        c03, catalog, db, actor_id=tr03, pathology_group="benign_anorectal",
        catalog_entry_id="MO-145", proc_class="PT-I", declared_mode="within_column", urgency_level="elective",
    )
    c03["clinicalChips"] = {
        **_default_v5_history_for_sandbox(),
        "comorbidities": {
            "confirmed": True,
            "suggestedValues": ["none"],
            "values": ["diabetes"],
            "medicalTreatmentNote": "Metformin 1000mg/ngày, đường huyết ổn định (HbA1c 6.8%)",
            "otherComorbidityNote": "",
        },
        "surgicalHistory": {
            "confirmed": True,
            "suggestedStatus": "present",
            "suggestedCategories": ["prior_anorectal_perineal"],
            "status": "present",
            "categories": ["prior_anorectal_perineal"],
            "abdominalScarType": "not_applicable",
            "detailNote": "Đã mổ rò hậu môn 2 lần năm 2023–2025",
        },
        "socialHabits": {
            "confirmed": True,
            "alcoholUse": "none",
            "smoking": {"status": "former", "packYears": 10.0, "packYearsUnknown": False},
            "substanceAbuse": {"status": "no", "substanceNote": None},
        },
        "antithromboticPlan": {"confirmed": True, "mode": "none_confirmed"},
        "bloodAndDevices": {"confirmed": True, "values": ["energy_device"], "otherDeviceNote": ""},
        "stomaPlan": {"confirmed": True, "value": "no_stoma", "stomaNote": ""},
        "contextChips": {
            "fistulaContext": {
                "fistulaClassification": "complex_or_recurrent_fistula",
                "fistulaImaging": "mri_fistula_done",
            }
        },
    }
    for ck_c in ("CK-01", "CK-02", "CK-03", "CK-06", "CK-07"):
        c03["preopChecklist"][ck_c]["state"] = "prepared_ok"
        c03["preopChecklist"][ck_c]["preparedByStaffId"] = tr03
    c03["preopChecklist"]["CK-02"]["subChecks"] = {
        "preAnesthesiaExam": "prepared_ok", "ecg": "prepared_ok", "chestImaging": "prepared_ok", "echo": "prepared_ok",
    }
    c03["preopChecklist"]["CK-05"] = {"state": "not_applicable", "preparedByStaffId": None, "verifiedByStaffId": None, "autoDerivedFrom": "pathologyGroup=benign_anorectal"}
    c03["caseRevision"] = 2
    c03["approval"]["status"] = "ready_for_attending"
    c03["approval"]["readyRequestedAt"] = ts_now
    c03["approval"]["readyRequestedByStaffId"] = tr03
    stamp_badge_fields(c03)
    cases.append(c03)

    # ── CA TEST 04: Submitted (⏳ Chờ BCN duyệt) — Phẫu thuật Robot lành tính sa trực tràng, PTV #1 có chứng chỉ Robot ──
    tr04 = pick_staff(trainee_pool)
    rm04 = rng.choice(rooms_pod1 + rooms_pod3)
    c04 = initialize_new_surgery_record({
        "id": base_id + 3,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-04_SUBMITTED_ROBOT_CERTIFIED_BENIGN",
        "patientName": mock_name(4, "Robot Sa Trực Tràng Độ III [Chờ BCN duyệt]"),
        "birthYear": rng.randint(1955, 1974),
        "admissionId": mock_nv(4),
        "date": d_off(3, 6),
        "duration": rng.choice([180, 210]),
        "surgeryType": "robot",
        "approachType": "robot",
        "mainSurgeon": 1,
        "assistSurgeon1": pick_staff([6, 8]),
        "diagnosis": "Sa trực tràng toàn bộ độ III lành tính",
        "method": "Phẫu thuật nội soi cố định trực tràng bằng lưới trong điều trị sa trực tràng",
        "notes": "[CA TEST #04 — Robot lành tính (CK-05 GPB tự động N/A), PTV #1 có chứng nhận Robot, dự trù lưới Mesh + dụng cụ Robot]",
    }, catalog, db)
    _stamp_pod_for_sandbox(c04, catalog, rm04, trainee_id=tr04, freeze_snapshot=True)
    _finalize_classification_for_sandbox(
        c04, catalog, db, actor_id=1, pathology_group="benign_colorectal_abdominal",
        catalog_entry_id="PTNS-235", proc_class="PT-I", declared_mode="within_column", urgency_level="elective",
    )
    c04["clinicalChips"] = {
        **_default_v5_history_for_sandbox(),
        "comorbidities": {
            "confirmed": True,
            "suggestedValues": ["none"],
            "values": ["hypertension", "thyroid_disease"],
            "medicalTreatmentNote": "Amlodipin 5mg + Levothyroxin 50mcg sáng, FT4/TSH bình giáp",
            "otherComorbidityNote": "",
        },
        "surgicalHistory": {
            "confirmed": True,
            "suggestedStatus": "none",
            "suggestedCategories": [],
            "status": "present",
            "categories": ["prior_abdominal_pelvic"],
            "abdominalScarType": "open_laparotomy_scar",
            "detailNote": "Mổ mở cắt tử cung đường giữa dưới rốn năm 2014",
        },
        "antithromboticPlan": {"confirmed": True, "mode": "none_confirmed"},
        "bloodAndDevices": {"confirmed": True, "values": ["robot_instruments", "mesh", "energy_device"], "otherDeviceNote": ""},
        "stomaPlan": {"confirmed": True, "value": "no_stoma", "stomaNote": ""},
        "contextChips": {
            "benignAbdominalContext": {"subType": "rectal_prolapse", "bowelPrepPlan": "oral_mechanical_prep"}
        },
    }
    c04["preopChecklist"] = _build_verified_checklist_for_sandbox(1, tr04, benign=True)
    c04["caseRevision"] = 2
    c04["approval"]["status"] = "submitted"
    c04["approval"]["slaStatus"] = "on_time"
    c04["approval"]["submittedSnapshot"] = {"caseRevision": 2, "submittedAt": ts_now, "submittedByStaffId": 1, "actingForMainSurgeonReason": None}
    stamp_badge_fields(c04)
    cases.append(c04)

    # ── CA TEST 05: Draft cảnh báo Robot — PTV Cột ĐB nhưng chưa có trong danh sách chứng nhận Robot hiện hành ──
    ms05 = pick_staff([4, 5])
    c05 = initialize_new_surgery_record({
        "id": base_id + 4,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-05_DRAFT_ROBOT_UNCERTIFIED_ALERT",
        "patientName": mock_name(5, "Robot K Đại Tràng Sigma [Cảnh báo Chứng chỉ Robot]"),
        "birthYear": rng.randint(1952, 1978),
        "admissionId": mock_nv(5),
        "date": d_off(4, 6),
        "duration": rng.choice([210, 240]),
        "surgeryType": "robot",
        "approachType": "robot",
        "mainSurgeon": ms05,
        "assistSurgeon1": pick_staff(trainee_pool),
        "diagnosis": "Ung thư biểu mô tuyến đại tràng Sigma cT3N1M0",
        "method": "Phẫu thuật nội soi cắt đại tràng chậu hông+ nạo vét hạch",
        "notes": "[CA TEST #05 — Kiểm thử chặn tự động khi PTV chưa có chứng nhận mổ chính Robot tại khoa]",
    }, catalog, db)
    _stamp_pod_for_sandbox(c05, catalog, rng.choice(rooms_pod3), trainee_id=c05.get("assistSurgeon1"), freeze_snapshot=False)
    _finalize_classification_for_sandbox(
        c05, catalog, db, actor_id=ms05, pathology_group="cancer_confirmed",
        catalog_entry_id="PTNS-202", proc_class="PT-ĐB", declared_mode="within_column", urgency_level="elective",
    )
    stamp_badge_fields(c05)
    cases.append(c05)

    # ── CA TEST 06: Preapproved (☑️ Đạt tiền duyệt Phó TK — Chờ Trưởng khoa) — K trực tràng giữa sau TNT + Duy trì Aspirin 81mg ──
    ms06 = pick_staff([2, 4])
    tr06 = pick_staff(trainee_pool)
    rm06 = rng.choice(["718", "708"])
    c06 = initialize_new_surgery_record({
        "id": base_id + 5,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-06_PREAPPROVED_RECTAL_TNT_ASPIRIN",
        "patientName": mock_name(6, "K Trực Tràng Giữa Sau TNT [Đã Tiền duyệt]"),
        "birthYear": rng.randint(1950, 1972),
        "admissionId": mock_nv(6),
        "date": d_off(3, 6),
        "duration": rng.choice([210, 240]),
        "surgeryType": "chuongtrinh",
        "approachType": "noisoi",
        "mainSurgeon": ms06,
        "assistSurgeon1": tr06,
        "diagnosis": "Ung thư trực tràng giữa sau hóa xạ toàn diện TNT (ycT3NxM0, CRM âm tính)",
        "method": "Phẫu thuật nội soi cắt trực tràng thấp+ nạo vét hạch",
        "notes": "[CA TEST #06 — Stent mạch vành duy trì Aspirin 81mg theo HC Tim mạch + dự kiến mở HMNT hồi tràng bảo vệ; Phó TK đã Tiền duyệt]",
    }, catalog, db)
    _stamp_pod_for_sandbox(c06, catalog, rm06, trainee_id=tr06, freeze_snapshot=True)
    _finalize_classification_for_sandbox(
        c06, catalog, db, actor_id=ms06, pathology_group="cancer_confirmed",
        catalog_entry_id="PTNS-218", proc_class="PT-ĐB", declared_mode="within_column", urgency_level="elective",
    )
    c06["clinicalChips"] = {
        **_default_v5_history_for_sandbox(),
        "comorbidities": {
            "confirmed": True,
            "suggestedValues": ["none"],
            "values": ["hypertension", "ischemic_heart_cad"],
            "medicalTreatmentNote": "Amlodipin/Valsartan 5/80mg, Isosorbid dinitrat, Stent LAD năm 2024 ổn định",
            "otherComorbidityNote": "",
        },
        "allergyHistory": {
            "confirmed": True,
            "suggestedStatus": "none",
            "status": "present",
            "allergenGroups": ["drug"],
            "reactionSeverity": "mild_moderate",
            "allergenDetail": "Cefazolin (phát ban mề đay — đổi kháng sinh dự phòng Ciprofloxacin + Metronidazol)",
        },
        "socialHabits": {
            "confirmed": True,
            "alcoholUse": "occasional",
            "smoking": {"status": "former", "packYears": 20.0, "packYearsUnknown": False},
            "substanceAbuse": {"status": "no", "substanceNote": None},
        },
        "antithromboticPlan": {
            "confirmed": True,
            "mode": "continued_per_plan",
            "drugName": "Aspirin 81mg",
            "bridgingAgent": "",
            "lastDoseAt": "Uống sáng hôm trước mổ",
            "approvingSpecialtyOrDoctor": "BS Nội Tim mạch & BS Gây mê hồi sức",
            "planReferenceNote": "Stent phủ thuốc LAD — duy trì Aspirin 81mg chu phẫu, cầm máu kỹ bằng dao siêu âm",
        },
        "bloodAndDevices": {"confirmed": True, "values": ["prbc_reserved", "circular_linear_stapler", "icg", "energy_device"], "otherDeviceNote": ""},
        "stomaPlan": {"confirmed": True, "value": "protective_temp_stoma_risk", "stomaNote": "Dự kiến mở HMNT hồi tràng quai bảo vệ miệng nối thấp"},
        "contextChips": {
            "cancerContext": {
                "tumorLocation": ["rectum_mid"],
                "isSynchronousMultiSite": False,
                "preopHistology": "adenocarcinoma",
                "lockedRuleSetId": "AJCC_8_CH20_COLORECTAL",
                "lockedRuleSetVersion": "8th Edition (2017)",
                "baselineClinicalStage": {
                    "cT": "T3",
                    "cN": "N1",
                    "cM": "M0",
                    "stagingNote": "Trước TNT — MRI tiểu khung ban đầu cT3N1M0",
                },
                "restagingPostNeoadjuvant": {
                    "cT": "T3",
                    "cN": "Nx",
                    "cM": "M0",
                    "stagingNote": "Sau TNT hóa xạ toàn diện — hạch mạc treo trực tràng thoái triển xơ hóa trên MRI tái đánh giá",
                },
                "clinicalStage": {
                    "cT": "T3",
                    "cN": "Nx",
                    "cM": "M0",
                    "stagingNote": "Sau TNT hóa xạ toàn diện — hạch mạc treo trực tràng thoái triển xơ hóa trên MRI tái đánh giá",
                },
                "crmStatus": "crm_clear",
                "emviStatus": "emvi_negative",
                "multimodalStatus": "post_tnt",
                "mdtReviewStatus": "mdt_completed",
            }
        },
    }
    c06["preopChecklist"] = _build_verified_checklist_for_sandbox(ms06, tr06, benign=False)
    _seed_contrib(c06, tr06, "trainee_pod_resident", "prepare_checklist")
    _seed_contrib(c06, ms06, "main_surgeon", "submit_case")
    c06["caseRevision"] = 3
    c06["approval"]["status"] = "preapproved"
    c06["approval"]["slaStatus"] = "on_time"
    c06["approval"]["submittedSnapshot"] = {"caseRevision": 2, "submittedAt": ts_now, "submittedByStaffId": ms06, "actingForMainSurgeonReason": None}
    c06["approval"]["preapprovedSnapshot"] = {
        "caseRevision": 3,
        "preapprovedAt": ts_now,
        "preapprovedByStaffId": DEPUTY_STAFF_ID,
        "note": "Hồ sơ ung thư trực tràng sau TNT đầy đủ MRI đánh giá lại & hội chẩn Tim mạch, kính trình Trưởng khoa phê duyệt.",
    }
    stamp_badge_fields(c06)
    cases.append(c06)

    # ── CA TEST 07: Approved (✅ Đã duyệt tại khoa) — K đại tràng đồng thời đa ổ + Đã ngưng kháng đông đủ ngày + Thiếu máu đã bù máu ──
    ms07 = pick_staff([1, 2, 4, 5])
    tr07 = pick_staff(trainee_pool)
    rm07 = rng.choice(all_rooms)
    c07 = initialize_new_surgery_record({
        "id": base_id + 6,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-07_APPROVED_SYNCHRONOUS_CANCER_HELD_ANTICOAG",
        "patientName": mock_name(7, "K Đại Tràng Đa Ổ Đồng Thời [✅ Đã duyệt khoa]"),
        "birthYear": rng.randint(1948, 1968),
        "admissionId": mock_nv(7),
        "date": d_off(2, 5),
        "duration": rng.choice([240, 270]),
        "surgeryType": "chuongtrinh",
        "approachType": "noisoi",
        "mainSurgeon": ms07,
        "assistSurgeon1": tr07,
        "diagnosis": "Ung thư biểu mô tuyến đồng thời đại tràng phải và đại tràng Sigma trên nền rung nhĩ mạn",
        "method": "Phẫu thuật nội soi cắt toàn bộ đại tràng + nạo vét hạch",
        "notes": "[CA TEST #07 — Đã duyệt tại khoa (Tích xanh hợp lệ 6 điều kiện): Đa BS tham gia chuẩn bị + K đa ổ + Đã ngưng Rivaroxaban đủ 72h]",
    }, catalog, db)
    _stamp_pod_for_sandbox(c07, catalog, rm07, trainee_id=tr07, freeze_snapshot=True)
    _finalize_classification_for_sandbox(
        c07, catalog, db, actor_id=ms07, pathology_group="cancer_confirmed",
        catalog_entry_id="PTNS-204", proc_class="PT-ĐB", declared_mode="within_column", urgency_level="elective",
    )
    c07["clinicalChips"] = {
        **_default_v5_history_for_sandbox(),
        "comorbidities": {
            "confirmed": True,
            "suggestedValues": ["none"],
            "values": ["valvular_heart_hf", "arrhythmia", "anemia_malnutrition"],
            "medicalTreatmentNote": "Rung nhĩ đáp ứng thất trung bình 76 l/p, Bisoprolol 2.5mg",
            "otherComorbidityNote": "",
        },
        "antithromboticPlan": {
            "confirmed": True,
            "mode": "held_per_plan",
            "drugName": "Rivaroxaban 20mg",
            "bridgingAgent": "",
            "lastDoseAt": "Ngưng Rivaroxaban trước mổ 72 giờ theo hội chẩn",
            "approvingSpecialtyOrDoctor": "Hội chẩn Tim mạch & Gây mê hồi sức",
            "planReferenceNote": "Xét nghiệm đông máu sáng ngày mổ INR 1.08",
        },
        "bloodAndDevices": {"confirmed": True, "values": ["prbc_reserved", "circular_linear_stapler", "energy_device"], "otherDeviceNote": ""},
        "stomaPlan": {"confirmed": True, "value": "no_stoma", "stomaNote": ""},
        "contextChips": {
            "cancerContext": {
                "tumorLocation": ["right_colon", "sigmoid"],
                "isSynchronousMultiSite": True,
                "preopHistology": "adenocarcinoma",
                "lockedRuleSetId": "AJCC_8_CH20_COLORECTAL",
                "lockedRuleSetVersion": "8th Edition (2017)",
                "baselineClinicalStage": {"cT": "T3", "cN": "N1", "cM": "M0", "stagingNote": ""},
                "clinicalStage": {"cT": "T3", "cN": "N1", "cM": "M0", "stagingNote": ""},
                "crmStatus": "not_applicable",
                "emviStatus": "not_assessed",
                "multimodalStatus": "upfront_surgery",
                "mdtReviewStatus": "mdt_completed",
            }
        },
    }
    c07["preopChecklist"] = _build_verified_checklist_for_sandbox(
        ms07, tr07, benign=False,
        ck01_abnormal_note="Hb lúc nhập viện 8.8 g/dL — đã truyền 02 ĐV HC lắng nâng Hb lên 10.9 g/dL, dự trù sẵn 02 ĐV tại phòng mổ",
    )
    pod_att_07 = pick_staff([x for x in [6, 7, 8] if x != ms07] or [6])
    _seed_contrib(c07, tr07, "trainee_pod_resident", "prepare_checklist")
    _seed_contrib(c07, pod_att_07, "pod_attending", "verify_checklist")
    _seed_contrib(c07, ms07, "main_surgeon", "submit_case")
    c07["caseRevision"] = 3
    c07["approval"]["status"] = "approved"
    c07["approval"]["slaStatus"] = "on_time"
    c07["approval"]["firstApprovedAt"] = ts_now
    c07["approval"]["latestApprovedAt"] = ts_now
    c07["approval"]["approvalCycleCount"] = 1
    c07["approval"]["submittedSnapshot"] = {"caseRevision": 2, "submittedAt": ts_now, "submittedByStaffId": ms07, "actingForMainSurgeonReason": None}
    c07["approval"]["approvedSnapshot"] = {
        "caseRevision": 3,
        "approvedAt": ts_now,
        "approvedByStaffId": CHIEF_STAFF_ID,
        "approvalMode": "standard_chief",
        "delegationId": None,
        "note": "Đồng ý phẫu thuật cắt toàn bộ đại tràng nối hồi - trực tràng; kiểm tra lại đông máu sáng ngày mổ.",
    }
    stamp_badge_fields(c07)
    cases.append(c07)

    # ── CA TEST 08: Submitted (⏳ Chờ BCN duyệt) — Module B4 U dưới niêm GIST trực tràng không sinh thiết xuyên niêm ──
    ms08 = pick_staff([5, 6, 4])
    tr08 = pick_staff(trainee_pool)
    c08 = initialize_new_surgery_record({
        "id": base_id + 7,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-08_SUBMITTED_B4_GIST_SUBMUCOSAL",
        "patientName": mock_name(8, "U Dưới Niêm GIST Trực Tràng [Module B4]"),
        "birthYear": rng.randint(1956, 1980),
        "admissionId": mock_nv(8),
        "date": d_off(3, 6),
        "duration": rng.choice([150, 180]),
        "surgeryType": "chuongtrinh",
        "approachType": "noisoi",
        "mainSurgeon": ms08,
        "assistSurgeon1": tr08,
        "diagnosis": "U mô đệm đường tiêu hóa (GIST) dưới niêm trực tràng thấp 3.5cm vỏ bao nguyên vẹn",
        "method": "Phẫu thuật nội soi cắt trực tràng thấp",
        "notes": "[CA TEST #08 — Module B4: U dưới niêm không sinh thiết xuyên niêm trước mổ để tránh vỡ vỏ bao gieo rắc u]",
    }, catalog, db)
    _stamp_pod_for_sandbox(c08, catalog, rng.choice(rooms_pod2), trainee_id=tr08, freeze_snapshot=True)
    _finalize_classification_for_sandbox(
        c08, catalog, db, actor_id=ms08, pathology_group="neoplasm_suspected_or_special",
        catalog_entry_id="PTNS-217", proc_class="PT-I", declared_mode="within_column", urgency_level="elective",
    )
    c08["clinicalChips"] = {
        **_default_v5_history_for_sandbox(),
        "comorbidities": {"confirmed": True, "suggestedValues": ["none"], "values": ["none"], "medicalTreatmentNote": None, "otherComorbidityNote": ""},
        "antithromboticPlan": {"confirmed": True, "mode": "none_confirmed"},
        "bloodAndDevices": {"confirmed": True, "values": ["circular_linear_stapler", "energy_device"], "otherDeviceNote": ""},
        "stomaPlan": {"confirmed": True, "value": "protective_temp_stoma_risk", "stomaNote": "Cân nhắc mở HMNT bảo vệ nếu miệng nối sát đường lược"},
        "contextChips": {
            "specialNeoplasmContext": {
                "neoplasmCategory": "gist_submucosal",
                "biopsyStatus": "submucosal_not_biopsied",
                "extentEvaluation": "pelvic_mri_eus_done",
                "mdtReviewStatus": "mdt_completed",
            }
        },
    }
    c08["preopChecklist"] = _build_verified_checklist_for_sandbox(
        ms08, tr08, benign=False,
        ck05_abnormal_note="Hình ảnh EUS & MRI tiểu khung điển hình GIST lớp cơ trực tràng vỏ bao nguyên vẹn — hội chẩn MDT thống nhất mổ cắt trọn không sinh thiết xuyên niêm",
    )
    c08["caseRevision"] = 2
    c08["approval"]["status"] = "submitted"
    c08["approval"]["slaStatus"] = "on_time"
    c08["approval"]["submittedSnapshot"] = {"caseRevision": 2, "submittedAt": ts_now, "submittedByStaffId": ms08, "actingForMainSurgeonReason": None}
    stamp_badge_fields(c08)
    cases.append(c08)

    # ── CA TEST 09: Submitted (⏳ Ngoài DM 309 chờ BCN xác minh hạng) — PT kết hợp đa cơ quan ngoài Danh mục 309 ──
    ms09 = pick_staff([2, 4, 5])
    tr09 = pick_staff(trainee_pool)
    c09 = initialize_new_surgery_record({
        "id": base_id + 8,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-09_SUBMITTED_CUSTOM_OUTSIDE_CATALOG_309",
        "patientName": mock_name(9, "Rò Đại Tràng Bàng Quang [Ngoài DM 309 - Chờ BCN]"),
        "birthYear": rng.randint(1960, 1986),
        "admissionId": mock_nv(9),
        "date": d_off(3, 5),
        "duration": rng.choice([150, 180]),
        "surgeryType": "chuongtrinh",
        "approachType": "noisoi",
        "mainSurgeon": ms09,
        "assistSurgeon1": pick_staff([6, 7, 8]),
        "diagnosis": "Rò đại tràng Sigma - bàng quang sau viêm túi thừa đại tràng mạn tính",
        "method": "Phẫu thuật nội soi cắt đoạn đại tràng Sigma kết hợp cắt chóp bàng quang khâu phục hồi hai lớp",
        "notes": "[CA TEST #09 — Phẫu thuật ngoài Danh mục 309 (proposedClass=PT-I, verifiedClass=None): chờ BCN 2-chạm xác minh hạng phẫu thuật trước khi duyệt]",
    }, catalog, db)
    _stamp_pod_for_sandbox(c09, catalog, rng.choice(["705", "706", "710", "707"]), trainee_id=tr09, freeze_snapshot=True)
    cc09 = c09["clinicalClassification"]
    cc09["approachType"] = "noisoi"
    cc09["pathologyGroup"]["confirmedValue"] = "benign_colorectal_abdominal"
    cc09["pathologyGroup"]["confirmedByStaffId"] = ms09
    cc09["procedureClass"].update({
        "isCustomOutsideCatalog": True,
        "confirmedCatalogEntryId": None,
        "confirmedClass": None,
        "confirmedByStaffId": ms09,
        "customProcedureName": c09["method"],
        "customReasonChip": "combined_multiorgan",
        "customReasonNote": None,
        "proposedClass": "PT-I",
        "proposedByStaffId": ms09,
        "proposedAt": ts_now,
        "verifiedClass": None,
        "verifiedByStaffId": None,
        "verifiedAt": None,
        "verifiedBasisCode": None,
    })
    cc09["columnCompliance"] = {
        **evaluate_column_compliance(
            catalog, db, main_surgeon_id=ms09, approach_type="noisoi", surgery_date=c09["date"],
            confirmed_class="PT-I", confirmed_catalog_id=None, is_custom_procedure=True, proposed_class="PT-I", verified_class=None,
        ),
        "declaredMode": "within_column",
    }
    cc09["urgencyLevel"] = "elective"
    c09["clinicalChips"] = {
        **_default_v5_history_for_sandbox(),
        "comorbidities": {"confirmed": True, "suggestedValues": ["none"], "values": ["none"], "medicalTreatmentNote": None, "otherComorbidityNote": ""},
        "surgicalHistory": {
            "confirmed": True,
            "suggestedStatus": "none",
            "suggestedCategories": [],
            "status": "none",
            "categories": [],
            "abdominalScarType": "not_applicable",
            "detailNote": None,
        },
        "antithromboticPlan": {"confirmed": True, "mode": "none_confirmed"},
        "bloodAndDevices": {"confirmed": True, "values": ["circular_linear_stapler", "energy_device"], "otherDeviceNote": ""},
        "stomaPlan": {"confirmed": True, "value": "no_stoma", "stomaNote": ""},
        "contextChips": {
            "benignAbdominalContext": {
                "subType": "diverticulitis_appendicitis",
                "bowelPrepPlan": "oral_mechanical_prep",
            }
        },
    }
    c09["preopChecklist"] = _build_verified_checklist_for_sandbox(ms09, tr09, benign=True)
    _seed_contrib(c09, tr09, "trainee_pod_resident", "prepare_checklist")
    _seed_contrib(c09, ms09, "main_surgeon", "submit_case")
    c09["caseRevision"] = 2
    c09["approval"]["status"] = "submitted"
    c09["approval"]["slaStatus"] = "on_time"
    c09["approval"]["submittedSnapshot"] = {"caseRevision": 2, "submittedAt": ts_now, "submittedByStaffId": ms09, "actingForMainSurgeonReason": None}
    stamp_badge_fields(c09)
    cases.append(c09)

    # ── CA TEST 10: Submitted (⏳ Trình thay bởi BS Phụ 1 khi PTV chính đang trong phòng mổ) ──
    ms10 = pick_staff([4, 5])
    as10 = pick_staff([6, 7, 8])
    tr10 = pick_staff(trainee_pool)
    c10 = initialize_new_surgery_record({
        "id": base_id + 9,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-10_SUBMITTED_PROXY_BY_ASSIST_SURGEON_1",
        "patientName": mock_name(10, "Đóng HMNT Hồi Tràng Chương Trình [Trình thay Phụ 1]"),
        "birthYear": rng.randint(1970, 1998),
        "admissionId": mock_nv(10),
        "date": d_off(3, 5),
        "duration": rng.choice([75, 90]),
        "surgeryType": "chuongtrinh",
        "approachType": "noisoi",
        "mainSurgeon": ms10,
        "assistSurgeon1": as10,
        "diagnosis": "Hậu môn nhân tạo hồi tràng quai ổn định sau mổ cắt trước thấp 4 tháng",
        "method": "Phẫu thuật nội soi đóng hậu môn nhân tạo",
        "notes": "[CA TEST #10 — Kiểm thử Trình thay hợp lệ bởi BS chính Phụ mổ 1 trên lịch mổ khi PTV chính đang trong phòng mổ]",
    }, catalog, db)
    _stamp_pod_for_sandbox(c10, catalog, rng.choice(["711", "712", "709", "718"]), trainee_id=tr10, freeze_snapshot=True)
    _finalize_classification_for_sandbox(
        c10, catalog, db, actor_id=as10, pathology_group="benign_colorectal_abdominal",
        catalog_entry_id="PTNS-214", proc_class="PT-I", declared_mode="within_column", urgency_level="elective",
    )
    c10["clinicalChips"] = {
        **_default_v5_history_for_sandbox(),
        "comorbidities": {"confirmed": True, "suggestedValues": ["none"], "values": ["none"], "medicalTreatmentNote": None, "otherComorbidityNote": ""},
        "surgicalHistory": {
            "confirmed": True,
            "suggestedStatus": "present",
            "suggestedCategories": ["prior_colorectal_stoma"],
            "status": "present",
            "categories": ["prior_colorectal_stoma"],
            "abdominalScarType": "laparoscopic_scar",
            "detailNote": "PTNS cắt trước thấp mở HMNT hồi tràng quai cách 4 tháng",
        },
        "antithromboticPlan": {"confirmed": True, "mode": "none_confirmed"},
        "bloodAndDevices": {"confirmed": True, "values": ["circular_linear_stapler"], "otherDeviceNote": ""},
        "stomaPlan": {"confirmed": True, "value": "stoma_closure", "stomaNote": "Đóng HMNT hồi tràng quai nối máy Stapler thẳng"},
        "contextChips": {
            "benignAbdominalContext": {
                "subType": "stoma_management",
                "distalLimbCheck": "endoscopy_or_contrast_patent",
                "bowelPrepPlan": "enema_only",
            }
        },
    }
    c10["preopChecklist"] = _build_verified_checklist_for_sandbox(as10, tr10, benign=True)
    _seed_contrib(c10, tr10, "trainee_pod_resident", "prepare_checklist")
    _seed_contrib(c10, as10, "assist_surgeon_1", "proxy_submit_case")
    c10["caseRevision"] = 2
    c10["approval"]["status"] = "submitted"
    c10["approval"]["slaStatus"] = "on_time"
    c10["approval"]["submittedSnapshot"] = {
        "caseRevision": 2,
        "submittedAt": ts_now,
        "submittedByStaffId": as10,
        "proxySubmitterSource": "assist_surgeon_1",
        "proxyReasonCode": "in_operating_room",
        "podMembershipSource": None,
        "actingForMainSurgeonReason": "PTV chính đang trong phòng mổ",
    }
    stamp_badge_fields(c10)
    cases.append(c10)

    # ── CA TEST 11: Returned for Revision (↩️ BCN yêu cầu bổ sung) — Mổ chương trình Rò HM trên nền ĐTĐ + Clopidogrel ──
    ms11 = pick_staff([7, 8, 9])
    tr11 = pick_staff(trainee_pool)
    c11 = initialize_new_surgery_record({
        "id": base_id + 10,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-11_RETURNED_BY_BCN_NEEDS_REVISION",
        "patientName": mock_name(11, "Rò Hậu Môn Kèm ĐTĐ [↩️ BCN trả bổ sung]"),
        "birthYear": rng.randint(1950, 1972),
        "admissionId": mock_nv(11),
        "date": d_off(3, 5),
        "duration": rng.choice([45, 60]),
        "surgeryType": "chuongtrinh",
        "approachType": "mo",
        "mainSurgeon": ms11,
        "assistSurgeon1": tr11,
        "diagnosis": "Rò hậu môn xuyên cơ thắt thấp kèm ổ tồn lưu mạn tính trên nền Đái tháo đường típ 2",
        "method": "Phẫu thuật điều trị rò hậu môn đơn giản",
        "notes": "[CA TEST #11 — BCN yêu cầu bổ sung kết quả Siêu âm tim tại mục CK-02 trước khi trình lại]",
    }, catalog, db)
    _stamp_pod_for_sandbox(c11, catalog, rng.choice(rooms_pod2), trainee_id=tr11, freeze_snapshot=False)
    _finalize_classification_for_sandbox(
        c11, catalog, db, actor_id=ms11, pathology_group="benign_anorectal",
        catalog_entry_id="MO-144", proc_class="PT-II", declared_mode="within_column",
        urgency_level="elective",
    )
    c11["clinicalChips"] = {
        **_default_v5_history_for_sandbox(),
        "comorbidities": {
            "confirmed": True,
            "suggestedValues": ["none"],
            "values": ["diabetes", "hypertension"],
            "medicalTreatmentNote": "Insulin Mixtard sáng 24 UI - chiều 12 UI, Amlodipin 5mg",
            "otherComorbidityNote": "",
        },
        "socialHabits": {
            "confirmed": True,
            "alcoholUse": "occasional",
            "smoking": {"status": "current", "packYears": 15.0, "packYearsUnknown": False},
            "substanceAbuse": {"status": "no", "substanceNote": None},
        },
        "antithromboticPlan": {
            "confirmed": True,
            "mode": "held_per_plan",
            "drugName": "Clopidogrel 75mg",
            "bridgingAgent": "",
            "lastDoseAt": "Đã ngưng 5 ngày trước nhập viện",
            "approvingSpecialtyOrDoctor": "BS Nội Tim mạch",
            "planReferenceNote": "",
        },
        "bloodAndDevices": {"confirmed": True, "values": ["basic_instruments_only"], "otherDeviceNote": ""},
        "stomaPlan": {"confirmed": True, "value": "no_stoma", "stomaNote": ""},
        "contextChips": {"fistulaContext": {"fistulaClassification": "simple_fistula"}},
    }
    c11["preopChecklist"] = _build_verified_checklist_for_sandbox(ms11, tr11, benign=True)
    c11["preopChecklist"]["CK-02"]["subChecks"]["echo"] = "unverified"
    c11["caseRevision"] = 3
    c11["approval"]["status"] = "returned_for_revision"
    c11["approval"]["returnFeedback"] = {
        "chips": [
            "Thiếu khám tiền mê / thăm dò tim phổi",
            "Chưa rõ kế hoạch ngưng/duy trì thuốc chống huyết khối",
        ],
        "note": "Đề nghị bổ sung kết quả Siêu âm tim tại mục CK-02 và kiểm tra đường huyết mao mạch < 10 mmol/L trước trình lại.",
        "returnedAt": ts_now,
        "returnedByStaffId": DEPUTY_STAFF_ID,
    }
    stamp_badge_fields(c11)
    cases.append(c11)

    # ── CA TEST 12: Out-of-Scope Phase 1 (QĐ3 — Mổ bán khẩn `not_in_scope`: không gắn nhãn Chưa trình duyệt, không chặn mổ, không tính KPI) ──
    ms12 = pick_staff([4, 5, 6])
    tr12 = pick_staff(trainee_pool)
    c12 = initialize_new_surgery_record({
        "id": base_id + 11,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-12_OUT_OF_PHASE1_SCOPE_SEMI_URGENT",
        "patientName": mock_name(12, "Tắc Ruột Quai Kín U Sigma [Ngoài phạm vi Đợt 1]"),
        "birthYear": rng.randint(1945, 1966),
        "admissionId": mock_nv(12),
        "date": d_off(0, 1),
        "duration": rng.choice([150, 180]),
        "surgeryType": "bankhan",
        "approachType": "mo",
        "mainSurgeon": ms12,
        "assistSurgeon1": tr12,
        "diagnosis": "Tắc ruột già quai kín do u đại tràng Sigma dọa vỡ manh tràng (đường kính manh tràng 10.5cm)",
        "method": "Cắt đoạn đại tràng, đóng đầu dưới, đưa đầu trên ra ngoài ổ bụng kiểu Hartmann",
        "notes": "[CA TEST #12 — QĐ3: Ca mổ bán khẩn nằm ngoài phạm vi duyệt mổ Đợt 1 (not_in_scope): không gắn nhãn Chưa trình duyệt, không chặn mổ, không tính KPI]",
    }, catalog, db)
    c12["clinicalChips"] = {
        **_default_v5_history_for_sandbox(),
        "comorbidities": {"confirmed": True, "suggestedValues": ["none"], "values": ["none"], "medicalTreatmentNote": None, "otherComorbidityNote": ""},
        "antithromboticPlan": {"confirmed": False, "mode": "unconfirmed"},
        "bloodAndDevices": {"confirmed": False, "values": [], "otherDeviceNote": ""},
        "stomaPlan": {"confirmed": False, "value": "unconfirmed", "stomaNote": ""},
        "contextChips": {},
    }
    c12["approval"]["status"] = "not_in_scope"
    stamp_badge_fields(c12)
    cases.append(c12)

    # ── CA TEST 13: Submitted (⏳ Liên chuyên khoa) — PTV chính Ngoài khoa + BS chính Khoa PTĐTT điều phối ──
    ext_surgeon_id = rng.choice([x for x in ext_docs if x != 116] or ext_docs or [111])
    coord_id = pick_staff([2, 4])
    tr13 = pick_staff(trainee_pool)
    c13 = initialize_new_surgery_record({
        "id": base_id + 12,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-13_SUBMITTED_INTERDISCIPLINARY_EXTERNAL_SURGEON",
        "patientName": mock_name(13, "U Tiểu Khung Xâm Lấn Niệu Quản [Liên Chuyên Khoa]"),
        "birthYear": rng.randint(1954, 1979),
        "admissionId": mock_nv(13),
        "date": d_off(3, 6),
        "duration": rng.choice([210, 240]),
        "surgeryType": "chuongtrinh",
        "approachType": "mo",
        "mainSurgeon": ext_surgeon_id,
        "assistSurgeon1": coord_id,
        "diagnosis": "U sau phúc mạc tiểu khung tái phát dính niệu quản trái & đại tràng chậu hông",
        "method": "Lấy u sau phúc mạc",
        "notes": "[CA TEST #13 — PTV ngoài khoa phối hợp liên chuyên khoa Tiết niệu + BS chính Khoa PTĐTT điều phối hồ sơ]",
    }, catalog, db)
    c13["coordinatingAttendingStaffId"] = coord_id
    c13["interdisciplinaryCoordination"] = {
        "isInterdisciplinary": True,
        "specialty": "Ngoại Tiết niệu & Ngoại Tiêu hóa",
        "coordinatingAttendingStaffId": coord_id,
        "planNote": "Phối hợp soi bàng quang đặt thông JJ niệu quản hai bên trước khi phẫu tích khối u tiểu khung",
    }
    _stamp_pod_for_sandbox(c13, catalog, rng.choice(rooms_pod1 + rooms_pod3), trainee_id=tr13, freeze_snapshot=True)
    _finalize_classification_for_sandbox(
        c13, catalog, db, actor_id=coord_id, pathology_group="neoplasm_suspected_or_special",
        catalog_entry_id="MO-191", proc_class="PT-I", declared_mode="external_surgeon_verify_privilege", urgency_level="elective",
    )
    c13["clinicalChips"] = {
        **_default_v5_history_for_sandbox(),
        "comorbidities": {
            "confirmed": True,
            "suggestedValues": ["none"],
            "values": ["hypertension"],
            "medicalTreatmentNote": "Telmisartan 40mg sáng, HA 125/80 mmHg",
            "otherComorbidityNote": "",
        },
        "surgicalHistory": {
            "confirmed": True,
            "suggestedStatus": "present",
            "suggestedCategories": ["prior_abdominal_pelvic"],
            "status": "present",
            "categories": ["prior_abdominal_pelvic", "prior_anesthesia_or_transfusion_event"],
            "abdominalScarType": "open_laparotomy_scar",
            "detailNote": "Mổ mở lấy u sau phúc mạc 2022; từng sốt rét run khi truyền HC lắng (đã dự trù HC lắng lọc bạch cầu)",
        },
        "antithromboticPlan": {"confirmed": True, "mode": "none_confirmed"},
        "bloodAndDevices": {"confirmed": True, "values": ["prbc_reserved", "energy_device"], "otherDeviceNote": ""},
        "stomaPlan": {"confirmed": True, "value": "protective_temp_stoma_risk", "stomaNote": "Dự phòng mở HMNT nếu phải cắt đoạn đại tràng Sigma dính u"},
        "contextChips": {
            "specialNeoplasmContext": {
                "neoplasmCategory": "recurrent_pelvic_tumor",
                "biopsyStatus": "biopsy_confirmed_special",
                "extentEvaluation": "ct_mri_multiphase_done",
                "mdtReviewStatus": "mdt_completed",
            }
        },
    }
    c13["preopChecklist"] = _build_verified_checklist_for_sandbox(coord_id, tr13, benign=False)
    c13["preopChecklist"]["CK-03"] = {
        "state": "verified_abnormal_planned",
        "preparedByStaffId": tr13,
        "verifiedByStaffId": coord_id,
        "clinicalPlanNote": "Tiền sử phản ứng truyền máu năm 2022 — đã hội chẩn GMHS dự trù 02 ĐV hồng cầu lắng lọc bạch cầu & tiền mê Corticoid",
    }
    c13["caseRevision"] = 2
    c13["approval"]["status"] = "submitted"
    c13["approval"]["slaStatus"] = "on_time"
    c13["approval"]["submittedSnapshot"] = {"caseRevision": 2, "submittedAt": ts_now, "submittedByStaffId": coord_id, "actingForMainSurgeonReason": None}
    stamp_badge_fields(c13)
    cases.append(c13)

    # ── CA TEST 14: Post-Approval Hold (⏸️ Tạm hoãn tại khoa sau khi duyệt) — sẵn sàng bấm Gỡ hoãn khôi phục tích xanh ──
    ms14 = pick_staff([1, 2, 4, 5])
    tr14 = pick_staff(trainee_pool)
    c14 = initialize_new_surgery_record({
        "id": base_id + 13,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-14_POST_APPROVAL_HOLD_ANESTHESIA",
        "patientName": mock_name(14, "K Đại Tràng Phải [⏸️ Tạm hoãn sau duyệt]"),
        "birthYear": rng.randint(1949, 1971),
        "admissionId": mock_nv(14),
        "date": d_off(2, 5),
        "duration": rng.choice([180, 210]),
        "surgeryType": "chuongtrinh",
        "approachType": "noisoi",
        "mainSurgeon": ms14,
        "assistSurgeon1": tr14,
        "diagnosis": "Ung thư biểu mô tuyến đại tràng lên cT3N0M0 kèm cơn tăng huyết áp trước mổ",
        "method": "Phẫu thuật nội soi cắt đại tràng phải + nạo vét hạch",
        "notes": "[CA TEST #14 — Đã duyệt nhưng Gây mê đề nghị tạm hoãn tối ưu huyết áp; BCN có thể bấm Gỡ tạm hoãn để khôi phục tích xanh]",
    }, catalog, db)
    _stamp_pod_for_sandbox(c14, catalog, rng.choice(all_rooms), trainee_id=tr14, freeze_snapshot=True)
    _finalize_classification_for_sandbox(
        c14, catalog, db, actor_id=ms14, pathology_group="cancer_confirmed",
        catalog_entry_id="PTNS-194", proc_class="PT-ĐB", declared_mode="within_column", urgency_level="elective",
    )
    c14["clinicalChips"] = {
        **_default_v5_history_for_sandbox(),
        "comorbidities": {
            "confirmed": True,
            "suggestedValues": ["none"],
            "values": ["hypertension", "diabetes", "stroke_cva_sequelae"],
            "medicalTreatmentNote": "TBMMN cũ năm 2021 hồi phục không yếu liệt, Perindopril 5mg + Metformin 850mg",
            "otherComorbidityNote": "",
        },
        "antithromboticPlan": {"confirmed": True, "mode": "none_confirmed"},
        "bloodAndDevices": {"confirmed": True, "values": ["circular_linear_stapler", "energy_device"], "otherDeviceNote": ""},
        "stomaPlan": {"confirmed": True, "value": "no_stoma", "stomaNote": ""},
        "contextChips": {
            "cancerContext": {
                "tumorLocation": ["right_colon"],
                "isSynchronousMultiSite": False,
                "preopHistology": "adenocarcinoma",
                "clinicalStage": {"cT": "T3", "cN": "N0", "cM": "M0", "stagingNote": ""},
                "crmStatus": "not_applicable",
                "multimodalStatus": "upfront_surgery",
                "mdtReviewStatus": "mdt_completed",
            }
        },
    }
    c14["preopChecklist"] = _build_verified_checklist_for_sandbox(ms14, tr14, benign=False)
    c14["caseRevision"] = 3
    c14["approval"]["previousApprovedStatus"] = "approved"
    c14["approval"]["status"] = "post_approval_hold"
    c14["approval"]["slaStatus"] = "on_time"
    c14["approval"]["approvedSnapshot"] = {
        "caseRevision": 3,
        "approvedAt": ts_now,
        "approvedByStaffId": CHIEF_STAFF_ID,
        "approvalMode": "standard_chief",
        "delegationId": None,
        "note": "Đã duyệt chuyên môn tại khoa.",
    }
    c14["approval"]["activeHold"] = {
        "holdCategory": "anesthesia_hold",
        "holdReason": "Huyết áp sáng trước mổ 185/105 mmHg — BS Gây mê đề nghị tạm hoãn 24–48h kiểm soát huyết áp nội khoa",
        "heldAt": ts_now,
        "heldByStaffId": ms14,
        "caseRevisionAtHold": 3,
    }
    stamp_badge_fields(c14)
    cases.append(c14)

    # ── CA TEST 15: Reapproval Required (🔄 Chờ duyệt lại do thay đổi Tier A sau duyệt) ──
    ms15 = pick_staff([1, 2, 4, 5])
    tr15 = pick_staff(trainee_pool)
    c15 = initialize_new_surgery_record({
        "id": base_id + 14,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-15_REAPPROVAL_REQUIRED_AFTER_TIER_A_CHANGE",
        "patientName": mock_name(15, "K Trực Tràng Thấp Đổi Lịch/PP [🔄 Chờ duyệt lại]"),
        "birthYear": rng.randint(1951, 1975),
        "admissionId": mock_nv(15),
        "date": d_off(4, 6),
        "duration": rng.choice([210, 240]),
        "surgeryType": "chuongtrinh",
        "approachType": "noisoi",
        "mainSurgeon": ms15,
        "assistSurgeon1": tr15,
        "diagnosis": "Ung thư trực tràng thấp sát ống hậu môn cT3bN1M0 (đổi lịch & kế hoạch HMNT sau hội chẩn lại MRI)",
        "method": "Phẫu thuật nội soi cắt trực tràng thấp+ nạo vét hạch",
        "notes": "[CA TEST #15 — Ca từng được duyệt nhưng thay đổi trường Tier A (dời ngày mổ & cập nhật CRM bị đe dọa) làm tự động thu hồi tích xanh]",
    }, catalog, db)
    _stamp_pod_for_sandbox(c15, catalog, rng.choice(rooms_pod1 + rooms_pod3), trainee_id=tr15, freeze_snapshot=False)
    _finalize_classification_for_sandbox(
        c15, catalog, db, actor_id=ms15, pathology_group="cancer_confirmed",
        catalog_entry_id="PTNS-218", proc_class="PT-ĐB", declared_mode="within_column", urgency_level="elective",
    )
    c15["clinicalChips"] = {
        **_default_v5_history_for_sandbox(),
        "comorbidities": {"confirmed": True, "suggestedValues": ["none"], "values": ["none"], "medicalTreatmentNote": None, "otherComorbidityNote": ""},
        "socialHabits": {
            "confirmed": True,
            "alcoholUse": "none",
            "smoking": {"status": "former", "packYears": 30.0, "packYearsUnknown": False},
            "substanceAbuse": {"status": "no", "substanceNote": None},
        },
        "antithromboticPlan": {"confirmed": True, "mode": "none_confirmed"},
        "bloodAndDevices": {"confirmed": True, "values": ["prbc_reserved", "circular_linear_stapler", "energy_device"], "otherDeviceNote": ""},
        "stomaPlan": {"confirmed": True, "value": "planned_permanent_stoma", "stomaNote": "Nguy cơ chuyển APR mở HMNT vĩnh viễn nếu diện cắt dưới dương tính trên sinh thiết tức thì"},
        "contextChips": {
            "cancerContext": {
                "tumorLocation": ["rectum_low"],
                "isSynchronousMultiSite": False,
                "preopHistology": "adenocarcinoma",
                "clinicalStage": {"cT": "T3", "cN": "N1", "cM": "M0", "stagingNote": ""},
                "crmStatus": "crm_threatened_or_positive",
                "multimodalStatus": "post_long_course_crt",
                "mdtReviewStatus": "mdt_completed",
            }
        },
    }
    c15["preopChecklist"] = _build_verified_checklist_for_sandbox(ms15, tr15, benign=False)
    c15["caseRevision"] = 4
    c15["approval"]["status"] = "reapproval_required"
    c15["approval"]["lastApprovedSnapshot"] = {
        "caseRevision": 3,
        "approvedAt": ts_now,
        "approvedByStaffId": CHIEF_STAFF_ID,
        "approvalMode": "standard_chief",
    }
    c15["approval"]["approvedSnapshot"] = None
    c15["approval"]["invalidationReason"] = "Thay đổi trường chuyên môn Tier A sau khi duyệt (date, kế hoạch HMNT & đánh giá CRM) — cần trình & duyệt lại"
    stamp_badge_fields(c15)
    cases.append(c15)

    # ── CA TEST 16: NSTH External Authority (🔹 Thẩm quyền Khoa Nội soi tiêu hóa — ngoài luồng duyệt PTĐTT) ──
    nsth_doc = 116 if 116 in ext_docs else (ext_docs[0] if ext_docs else pick_staff([6, 8]))
    c16 = initialize_new_surgery_record({
        "id": base_id + 15,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-16_NSTH_EXTERNAL_AUTHORITY",
        "patientName": mock_name(16, "Cắt Polyp Phẳng ESD Đại Tràng [🔹 Khoa NSTH]"),
        "birthYear": rng.randint(1958, 1985),
        "admissionId": mock_nv(16),
        "date": d_off(2, 5),
        "duration": rng.choice([60, 90]),
        "surgeryType": "chuongtrinh",
        "approachType": "nsth",
        "mainSurgeon": nsth_doc,
        "assistSurgeon1": None,
        "diagnosis": "Polyp phẳng lớn đại tràng ngang LST-NG 25mm",
        "method": "Cắt tách dưới niêm mạc qua nội soi ống mềm (ESD)",
        "notes": "[CA TEST #16 — Đường mổ Nội soi tiêu hóa: hiển thị rõ nhãn Thẩm quyền Khoa NSTH, không tính vào cổng duyệt mổ Khoa PTĐTT]",
    }, catalog, db)
    cases.append(c16)

    # Self-verify all routine submitted/preapproved/approved/held/reapproval cases against Gate 1+2!
    bcn_actor = {"staffId": CHIEF_STAFF_ID, "isAdmin": True, "role": "Trưởng khoa"}
    for sc in (c04, c06, c07, c08, c09, c10, c13, c14, c15):
        validate_routine_submit_gate(
            sc, bcn_actor, {"actingForMainSurgeonReason": "BCN_APPROVAL_CHECK"},
            catalog, db, cfg, allow_bcn_gate_recheck=True,
        )
    assert is_approval_green_tick_valid(c07) is True, "Sandbox SC-07 must satisfy 6-condition green tick predicate!"
    db["_nextSandboxSurgeryId"] = base_id + len(cases) + 4

    return cases
