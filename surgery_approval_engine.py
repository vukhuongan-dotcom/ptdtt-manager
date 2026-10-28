#!/usr/bin/env python3
"""
Surgery Approval Engine — Khoa Phẫu thuật Đại trực tràng (Bệnh viện Bình Dân)
Implements Plan 1 (Core Departmental Online Surgery Approval Workflow) &
Plan 2 (Pre-op Checklist CK-01..08 & 1-Tap Clinical Chips C-01..07 + B1..B4).

Boundary: Purely internal Step 1 at Khoa PTĐTT (Zero HIS / BM01 coupling).
"""

import copy
import fcntl
import hashlib
import json
import os
import random
import re
import unicodedata
import uuid
from datetime import date, datetime, timedelta, timezone

VN_TZ = timezone(timedelta(hours=7))
RULE_VERSION = "2026.10.v4"
SCHEMA_VERSION = 2
GENESIS_HASH = "0" * 64

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
    "none", "hypertension", "diabetes", "cad_stent", "afib_hf",
    "copd_asthma", "ckd", "cirrhosis", "anemia_malnutrition", "other",
}
VALID_ANTITHROMBOTIC_MODES = {
    "none_confirmed",
    "continued_per_plan",
    "held_per_plan",
    "bridging_per_plan",
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

DEFAULT_SURGERY_APPROVAL_CONFIG = {
    "scope": "departmental_step1_only",
    "zeroHisCoupling": True,
    "ruleVersion": RULE_VERSION,
    "rolloutAccessMode": "superadmin_only",  # "superadmin_only" | "all_staff"
    "sandboxOnlyMode": True,                 # True = Tab Duyệt mổ CHỈ dùng ca TEST giả lập (0% bệnh nhân thật)
    "checklistMode": "enforced_gate",        # "off" | "shadow_optional" | "enforced_gate"
    "rolloutEffectiveSurgeryDate": "2026-11-02",
    "nsthInternalPrecheckEnabled": False,
    "privilegeMatrixVersion": "BVBD-PTDTT-2026.v1",
    "privilegeMatrix2026Status": "pending_signed_decision",
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
}

_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_CATALOG_CACHE = {"path": None, "mtime": None, "data": None}


class ApprovalEngineError(Exception):
    def __init__(self, status_code: int, error_code: str, message: str, extra: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code
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
                "privilegeMatrixVersion": "BVBD-PTDTT-2026.v1",
                "privilegeMatrix2026Status": "pending_signed_decision",
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


def get_approval_badge_meta(surgery: dict) -> dict:
    """Implements all 12 rows of the Departmental Truth Table identically to client JS."""
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

def resolve_live_user_fail_closed(auth_header: str, verify_jwt_fn, auth_file: str, db: dict, save_auth_fn=None) -> dict:
    """Fail-Closed authentication: NEVER falls back to stale JWT claims if auth.json or staff check fails."""
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
    if jwt_role and live_role and jwt_role != live_role:
        # Allow minor casing difference, reject real role change
        if jwt_role.strip().lower() != live_role.strip().lower():
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
    }


def resolve_effective_actor(
    real_user: dict,
    simulate_header: str,
    target_surgery: dict,
    db: dict,
    *,
    allow_sandbox_delegation_sim: bool = False,
) -> dict:
    """Allows X-Simulate-Staff-Id STRICTLY when real_user.isSuperAdmin == True AND (target_surgery.isTestSandboxCase == True OR sandbox delegation test in superadmin_only mode)."""
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
    is_valid_del_sim = bool(allow_sandbox_delegation_sim and cfg.get("rolloutAccessMode") == "superadmin_only")
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


# ───────────────────────── WAL-First Hash-Chained Journal ─────────────────────────

def get_journal_path(data_dir: str) -> str:
    return os.path.join(data_dir, "surgery_approval_logs.jsonl")


def compute_journal_entry_hash(entry_without_hash: dict) -> str:
    clean = {k: v for k, v in entry_without_hash.items() if k != "entryHash"}
    return sha256_hex(canonical_json(clean))


def verify_approval_journal_chain(journal_path: str):
    """Verify full SHA-256 hash chain and sequential eventSeq of surgery_approval_logs.jsonl."""
    if not os.path.isfile(journal_path):
        return True, [], None

    entries = []
    expected_seq = 1
    expected_prev = GENESIS_HASH

    with open(journal_path, "r", encoding="utf-8") as f:
        raw_lines = f.readlines()

    for line_no, raw in enumerate(raw_lines, start=1):
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
            }
        seq = obj.get("eventSeq")
        prev_h = obj.get("prevHash")
        entry_h = obj.get("entryHash")
        computed = compute_journal_entry_hash(obj)
        if seq != expected_seq or prev_h != expected_prev or entry_h != computed:
            return False, entries, {
                "line": line_no,
                "eventSeq": seq,
                "expectedSeq": expected_seq,
                "reason": "HASH_OR_SEQ_MISMATCH",
                "prevHashMatch": prev_h == expected_prev,
                "entryHashMatch": entry_h == computed,
                "hasNewline": raw.endswith("\n"),
            }
        entries.append(obj)
        expected_seq += 1
        expected_prev = entry_h

    return True, entries, None


def reconcile_journal_and_db(db: dict, journal_path: str) -> dict:
    """
    Startup & Pre-Write Crash Reconciliation:
    1. If last line of journal was torn mid-write (no trailing newline + invalid JSON/hash), truncate torn tail.
    2. If journal has valid committed entries ahead of db['_lastApprovalJournalSeq'], replay state patches,
       notifications (deduplicated by sourceEventId), and idempotency records onto db.
    """
    report = {"truncatedTornTail": False, "replayedEvents": 0, "chainValid": True, "chainError": None}
    if not os.path.isfile(journal_path):
        return report

    with open(journal_path, "rb") as bf:
        raw_bytes = bf.read()
    if not raw_bytes:
        return report

    # Check if trailing line is incomplete (no \n at EOF) and invalid JSON/hash
    if not raw_bytes.endswith(b"\n"):
        lines = raw_bytes.split(b"\n")
        last_chunk = lines[-1]
        is_torn = False
        try:
            parsed = json.loads(last_chunk.decode("utf-8"))
            if parsed.get("entryHash") != compute_journal_entry_hash(parsed):
                is_torn = True
        except Exception:
            is_torn = True
        if is_torn:
            clean_bytes = b"\n".join(lines[:-1]) + (b"\n" if len(lines) > 1 else b"")
            with open(journal_path, "wb") as wf:
                wf.write(clean_bytes)
                wf.flush()
                os.fsync(wf.fileno())
            report["truncatedTornTail"] = True

    ok, entries, err = verify_approval_journal_chain(journal_path)
    report["chainValid"] = ok
    report["chainError"] = err
    if not ok or not entries:
        return report

    db_last_seq = int(db.get("_lastApprovalJournalSeq", 0) or 0)
    if entries[-1]["eventSeq"] <= db_last_seq:
        return report

    surgeries = db.setdefault("surgeries", [])
    trash = db.setdefault("surgeriesTrash", [])
    notifs = db.setdefault("notifications", [])
    idem_store = db.setdefault("_approvalIdempotency", {})
    existing_event_ids = {n.get("sourceEventId") for n in notifs if isinstance(n, dict) and n.get("sourceEventId")}

    for entry in entries:
        seq = entry["eventSeq"]
        if seq <= db_last_seq:
            continue

        patch = entry.get("committedStatePatch") or {}
        kind = patch.get("patchKind")
        sid = entry.get("surgeryId")

        if kind == "surgery_upsert" and isinstance(patch.get("surgeryRecord"), dict):
            rec = copy.deepcopy(patch["surgeryRecord"])
            rec["lastJournalSeq"] = seq
            idx = next((i for i, s in enumerate(surgeries) if isinstance(s, dict) and s.get("id") == sid), -1)
            if idx >= 0:
                surgeries[idx] = rec
            else:
                surgeries.append(rec)
            # Ensure removed from trash if restored
            if patch.get("removeFromTrash"):
                db["surgeriesTrash"] = [t for t in trash if not (isinstance(t, dict) and t.get("id") == sid)]
                trash = db["surgeriesTrash"]
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
        if isinstance(idem_rec, dict) and idem_rec.get("scopeKey"):
            idem_store[idem_rec["scopeKey"]] = copy.deepcopy(idem_rec["value"])

        db["_lastApprovalJournalSeq"] = seq
        report["replayedEvents"] += 1

    # Bump revisions if replayed
    if report["replayedEvents"] > 0:
        revs = db.setdefault("_revisions", {})
        revs["surgeries"] = int(revs.get("surgeries", 1)) + 1
        revs["notifications"] = int(revs.get("notifications", 1)) + 1

    return report


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
) -> dict:
    """
    Step 3 of 5-step atomic WAL protocol:
    Appends hash-chained event to data/surgery_approval_logs.jsonl + flush + os.fsync BEFORE db.json swap.
    Fail-Closed: raises ApprovalEngineError(503, 'AUDIT_WRITE_FAILED', ...) if write/fsync fails.
    """
    if TEST_FAULT_HOOKS.get("fail_journal_write"):
        raise ApprovalEngineError(503, "AUDIT_WRITE_FAILED", "Không thể ghi Sổ nhật ký chuỗi băm (Fail-Closed).")

    journal_path = get_journal_path(data_dir)
    os.makedirs(data_dir, exist_ok=True)

    ok, entries, err = verify_approval_journal_chain(journal_path)
    if not ok:
        raise ApprovalEngineError(
            503,
            "AUDIT_CHAIN_CORRUPTED",
            "Phát hiện chuỗi băm Sổ nhật ký bị gián đoạn hoặc can thiệp.",
            {"chainError": err},
        )

    prev_hash = entries[-1]["entryHash"] if entries else GENESIS_HASH
    next_seq = (entries[-1]["eventSeq"] + 1) if entries else 1
    event_id = str(uuid.uuid4())

    entry = {
        "eventId": event_id,
        "eventSeq": next_seq,
        "timestamp": now_vn_iso(),
        "surgeryId": surgery_id,
        "caseRevisionBefore": case_rev_before,
        "caseRevisionAfter": case_rev_after,
        "action": action,
        "actor": {
            "staffId": actor.get("staffId"),
            "username": actor.get("username") or actor.get("sub"),
            "name": actor.get("name"),
            "role": actor.get("role"),
            "isSimulated": bool(actor.get("isSimulated") or actor.get("simulatedBySuperAdminStaffId")),
            "simulatedBySuperAdminStaffId": actor.get("simulatedBySuperAdminStaffId"),
        },
        "delegationId": delegation_id,
        "statePatchSummary": summary or {},
        "committedStatePatch": committed_state_patch or {},
        "committedNotifications": committed_notifications or [],
        "idempotencyRecord": idempotency_record,
        "prevHash": prev_hash,
    }
    entry["entryHash"] = compute_journal_entry_hash(entry)

    # Stamp lastJournalSeq into embedded snapshot if present so replay matches Step 4
    if isinstance(entry["committedStatePatch"].get("surgeryRecord"), dict):
        entry["committedStatePatch"]["surgeryRecord"]["lastJournalSeq"] = next_seq
        entry["entryHash"] = compute_journal_entry_hash(entry)

    try:
        is_new = not os.path.exists(journal_path)
        fd = os.open(journal_path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        try:
            line_bytes = (canonical_json(entry) + "\n").encode("utf-8")
            os.write(fd, line_bytes)
            os.fsync(fd)
        finally:
            os.close(fd)
        if is_new:
            try:
                os.chmod(journal_path, 0o600)
            except OSError:
                pass
    except Exception as e:
        raise ApprovalEngineError(503, "AUDIT_WRITE_FAILED", f"Lỗi ghi Sổ nhật ký chuỗi băm: {e}")

    if TEST_FAULT_HOOKS.get("crash_after_wal_append"):
        raise SimulatedCrashAfterWal("Simulated SIGKILL immediately after WAL fsync before db.json replace")

    db["_lastApprovalJournalSeq"] = next_seq
    return entry


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

    # Normalize Robot wording for matching against laparoscopic equivalents
    search_norm = norm.replace("phau thuat robot", "phau thuat noi soi").replace("robot ", "phau thuat noi soi ")

    exact = [p for p in group_procs if p.get("normalizedName") == norm or p.get("normalizedName") == search_norm]
    if exact:
        classes = {p["procedureClass"] for p in exact}
        if len(classes) == 1:
            return exact[0]["catalogEntryId"], exact[0]["procedureClass"], exact[:10]
        return None, "unknown_ambiguous", exact[:10]

    substr_matches = [
        p for p in group_procs
        if (norm in p.get("normalizedName", "")) or (search_norm in p.get("normalizedName", "")) or (p.get("normalizedName", "") in norm and len(p.get("normalizedName", "")) >= 12)
    ]
    if len(substr_matches) == 1:
        return substr_matches[0]["catalogEntryId"], substr_matches[0]["procedureClass"], substr_matches
    if len(substr_matches) > 1:
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
    confirmed_class: str,
    confirmed_catalog_id: str,
) -> dict:
    """Computes columnCompliance metadata & systemCheck according to QĐ 1073 & 2026 Privilege Matrix."""
    matrix = (catalog or {}).get("privilegeMatrix") or {}
    eff_from = matrix.get("effectiveFrom", "2026-01-01")
    eff_to = matrix.get("effectiveTo", "2026-12-31")
    attending_cols = matrix.get("attendingColumns") or {}
    robot_ids = set(matrix.get("robotCertifiedStaffIds") or ROBOT_CERTIFIED_STAFF_IDS)
    ext_ids = {d.get("id") for d in (db.get("externalDoctors") or []) if isinstance(d, dict) and is_pos_int(d.get("id"))}

    res = {
        "privilegeMatrixVersion": matrix.get("privilegeMatrixVersion", "BVBD-PTDTT-2026.v1"),
        "surgeonBaseColumn2026": None,
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

    if not confirmed_class or confirmed_class == "unknown_ambiguous":
        res["systemCheck"] = "ambiguous_procedure_class"
        return res

    if confirmed_class == "unclassified":
        res["systemCheck"] = "unclassified_manual_verify"
        return res

    s_rank = COLUMN_RANK.get(base_col, 0)
    p_rank = COLUMN_RANK.get(confirmed_class, 99)
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


def get_pod_room_info(catalog: dict, ward_room: str) -> dict:
    rooms = ((catalog or {}).get("podRoster") or {}).get("rooms") or {}
    if ward_room and ward_room in rooms:
        return rooms[ward_room]
    return {"podId": None, "attendingStaffIds": [], "residentStaffIds": []}


def is_same_pod_attending(catalog: dict, surgery: dict, actor_staff_id: int) -> bool:
    if actor_staff_id not in ATTENDING_STAFF_IDS:
        return False
    pod_assign = surgery.get("podAssignment") or {}
    ward_room = pod_assign.get("wardRoom")
    rooms = ((catalog or {}).get("podRoster") or {}).get("rooms") or {}
    target_pod = (rooms.get(ward_room) or {}).get("podId") if ward_room else None
    if not target_pod:
        # Fallback: find pod of mainSurgeon
        ms = surgery.get("mainSurgeon")
        for r_info in rooms.values():
            if ms in (r_info.get("attendingStaffIds") or []):
                target_pod = r_info.get("podId")
                break
    if not target_pod:
        return False
    for r_info in rooms.values():
        if r_info.get("podId") == target_pod and actor_staff_id in (r_info.get("attendingStaffIds") or []):
            return True
    return False


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
            "comorbidities": {"confirmed": False, "suggestedValues": ["none"], "values": []},
            "antithromboticPlan": {"confirmed": False, "mode": None},
            "bloodAndDevices": {"confirmed": False, "values": []},
            "stomaPlan": {"confirmed": False, "value": None},
            "contextChips": {},
        },
        "archivedGroupData": [],
    }


def initialize_new_surgery_record(rec: dict, catalog: dict, db: dict) -> dict:
    """Initializes a brand-new or cloned surgery record cleanly.
    When sandboxOnlyMode is True, real surgeries (isTestSandboxCase != True) stay 100% free of approval metadata.
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

    cfg = get_approval_config(db)
    if cfg.get("sandboxOnlyMode") is True and rec.get("isTestSandboxCase") is not True:
        for k in APPROVAL_METADATA_FIELDS_TO_STRIP:
            rec.pop(k, None)
        return rec

    rec["schemaVersion"] = SCHEMA_VERSION
    rec["ruleVersion"] = RULE_VERSION
    rec["caseRevision"] = 1
    rec["lastJournalSeq"] = int(db.get("_lastApprovalJournalSeq", 0) or 0)

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
        # Keep mainSurgeonStaffId / assistSurgeonStaffId synchronized for readability
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
    5. Initializes brand-new / cloned IDs cleanly (draft_unsubmitted, caseRevision=1).
    6. Detects Tier A schedule modifications, M6 legacy date moves, and nsth <-> surgical transitions,
       bumping caseRevision + downgrading approval status + writing WAL Journal atomically.
    """
    catalog = load_procedure_catalog(data_dir, base_dir)
    cfg = get_approval_config(db)
    rollout_date = cfg.get("rolloutEffectiveSurgeryDate", "2026-11-02")

    trash_ids = {t.get("id") for t in (db.get("surgeriesTrash") or []) if isinstance(t, dict) and is_pos_int(t.get("id"))}
    old_map = {r.get("id"): r for r in (old_items or []) if isinstance(r, dict) and is_pos_int(r.get("id"))}

    # Ensure non-superadmin cannot accidentally delete hidden sandbox cases when saving surgeries collection,
    # AND forbid bypassing atomic trash by omitting any existing non-sandbox surgery record via bulk PUT!
    candidate_ids = {r.get("id") for r in candidate_items if isinstance(r, dict) and is_pos_int(r.get("id"))}
    hidden_sandbox_records = []
    for old_r in (old_items or []):
        if not isinstance(old_r, dict) or not is_pos_int(old_r.get("id")):
            continue
        oid = old_r.get("id")
        if oid not in candidate_ids:
            if old_r.get("isTestSandboxCase") is True and not user.get("isSuperAdmin"):
                hidden_sandbox_records.append(copy.deepcopy(old_r))
            else:
                raise ApprovalEngineError(
                    409,
                    "USE_ATOMIC_TRASH_ENDPOINT",
                    f"Không được xóa trực tiếp ca mổ #{oid} qua PUT hàng loạt. Vui lòng dùng API nguyên tử POST /api/surgeries/{oid}/trash.",
                )

    out_items = []
    pending_wal_events = []

    for raw_new in candidate_items:
        sid = raw_new.get("id")
        if sid in trash_ids and sid not in old_map:
            raise ApprovalEngineError(
                409,
                "USE_DEDICATED_TRASH_RESTORE_API",
                f"Ca mổ #{sid} đang nằm trong Thùng rác. Vui lòng khôi phục qua POST /api/surgeries/{sid}/restore.",
            )

        if sid not in old_map:
            # Brand-new or Cloned case -> clean birth!
            fresh = initialize_new_surgery_record(raw_new, catalog, db)
            out_items.append(fresh)
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

        # Strip all server-owned fields from client payload and restore from old_r
        merged = copy.deepcopy(norm_new)
        if cfg.get("sandboxOnlyMode") is True and merged.get("isTestSandboxCase") is not True and old_r.get("isTestSandboxCase") is not True:
            for k in APPROVAL_METADATA_FIELDS_TO_STRIP:
                merged.pop(k, None)
            out_items.append(merged)
            continue

        for sf in SERVER_OWNED_SURGERY_FIELDS:
            if sf in old_r:
                merged[sf] = copy.deepcopy(old_r[sf])
            else:
                merged.pop(sf, None)

        if not is_strict_int(merged.get("caseRevision")) or merged.get("caseRevision", 0) < 1:
            merged["caseRevision"] = 1
        merged["schemaVersion"] = SCHEMA_VERSION
        merged["ruleVersion"] = RULE_VERSION

        # Compare Tier A schedule fields
        changed_tier_a = []
        for tf in TIER_A_SCHEDULE_FIELDS:
            if (old_r.get(tf) or None) != (merged.get(tf) or None):
                changed_tier_a.append(tf)

        if changed_tier_a:
            rev_before = int(merged.get("caseRevision", 1))
            rev_after = rev_before + 1
            merged["caseRevision"] = rev_after

            approval = merged.setdefault("approval", {"status": "draft_unsubmitted", "activeHold": None})
            old_status = approval.get("status", "draft_unsubmitted")
            old_approach = old_r.get("approachType")
            new_approach = merged.get("approachType")
            new_date = merged.get("date", "")

            transition_action = None

            # Bidirectional nsth <-> mo/noisoi/robot transitions (CORE-TC-20)
            if new_approach == "nsth" and old_approach != "nsth":
                if approval.get("approvedSnapshot"):
                    approval["lastApprovedSnapshot"] = copy.deepcopy(approval["approvedSnapshot"])
                approval["approvedSnapshot"] = None
                approval["activeHold"] = None
                approval["status"] = "nsth_external_authority"
                transition_action = "schedule_switch_to_nsth"
            elif old_approach == "nsth" and new_approach in ("mo", "noisoi", "robot"):
                init_parts = build_initial_unverified_structures(merged, catalog, db)
                for k_init, v_init in init_parts.items():
                    if merged.get(k_init) is None:
                        merged[k_init] = v_init
                approval["approvedSnapshot"] = None
                approval["activeHold"] = None
                approval["status"] = "draft_unsubmitted"
                transition_action = "schedule_switch_from_nsth_to_surgical"
            # Rule M6: legacy_exempt / legacy_unverified moved to >= rolloutEffectiveSurgeryDate (CORE-TC-14)
            elif old_status in ("legacy_exempt", "legacy_unverified_manual_review") and is_valid_iso_date(new_date) and new_date >= rollout_date:
                init_parts = build_initial_unverified_structures(merged, catalog, db)
                merged.update(init_parts)
                approval["approvedSnapshot"] = None
                approval["activeHold"] = None
                approval["status"] = "draft_unsubmitted"
                transition_action = "legacy_rescheduled_into_active_gate_m6"
            elif old_status in ("approved", "approved_with_exception", "post_approval_hold"):
                if approval.get("approvedSnapshot"):
                    approval["lastApprovedSnapshot"] = copy.deepcopy(approval["approvedSnapshot"])
                approval["approvedSnapshot"] = None
                approval["activeHold"] = None
                approval["status"] = "reapproval_required"
                approval["invalidationReason"] = f"Thay đổi trường Tier A trên lịch mổ: {', '.join(changed_tier_a)}"
                transition_action = "tier_a_schedule_edit_invalidated_approval"
            elif old_status in ("submitted", "preapproved", "emergency_exception_pending_ack"):
                approval["status"] = "resubmit_required"
                approval["invalidationReason"] = f"Thay đổi trường Tier A khi đang trình duyệt: {', '.join(changed_tier_a)}"
                transition_action = "tier_a_schedule_edit_requires_resubmit"

            # Refresh suggestions & column systemCheck for updated method/approach/surgeon/date
            if merged.get("approachType") in ("mo", "noisoi", "robot") and isinstance(merged.get("clinicalClassification"), dict):
                cc = merged["clinicalClassification"]
                cc["approachType"] = merged.get("approachType")
                sug_code, sug_class, _ = suggest_procedure_from_method(catalog, merged.get("method", ""), merged.get("approachType"))
                pc = cc.setdefault("procedureClass", {})
                pc["suggestedCatalogCode"] = sug_code
                pc["suggestedClass"] = sug_class
                if "method" in changed_tier_a or "approachType" in changed_tier_a:
                    pc["confirmedCatalogEntryId"] = None
                    pc["confirmedClass"] = None
                    pc["confirmedByStaffId"] = None
                col_meta = evaluate_column_compliance(
                    catalog,
                    db,
                    main_surgeon_id=merged.get("mainSurgeon"),
                    approach_type=merged.get("approachType"),
                    surgery_date=merged.get("date", ""),
                    confirmed_class=pc.get("confirmedClass"),
                    confirmed_catalog_id=pc.get("confirmedCatalogEntryId"),
                )
                old_decl = (cc.get("columnCompliance") or {}).get("declaredMode")
                cc["columnCompliance"] = {**col_meta, "declaredMode": None if ("mainSurgeon" in changed_tier_a or "method" in changed_tier_a or "approachType" in changed_tier_a) else old_decl}

            stamp_badge_fields(merged)

            if transition_action or old_status != approval.get("status"):
                pending_wal_events.append((merged, rev_before, rev_after, transition_action or "tier_a_schedule_edit", changed_tier_a, old_status))
        else:
            stamp_badge_fields(merged)

        out_items.append(merged)

    out_items.extend(hidden_sandbox_records)

    # Append WAL entries BEFORE atomic_update swaps db.json
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
            },
            committed_state_patch={
                "patchKind": "surgery_upsert",
                "surgeryRecord": copy.deepcopy(rec_ref),
            },
        )
        rec_ref["lastJournalSeq"] = entry["eventSeq"]

    return out_items


# ───────────────────────── Migration M1..M6 ─────────────────────────

def run_surgery_approval_migration(db: dict, data_dir: str, base_dir: str, *, force: bool = False) -> dict:
    """
    Idempotent Migration M1..M5 across surgeries & surgeriesTrash based on rolloutEffectiveSurgeryDate (UTC+7).
    Invariants:
      - count_before == count_after
      - M1/M2 past surgeries -> legacy_exempt (NEVER fake approved or fake verified actors)
      - M3 pre-created surgeries with date >= rolloutEffectiveSurgeryDate -> draft_unsubmitted (slaGraceWindow=True)
      - M4 approachType == 'nsth' -> nsth_external_authority
      - M5 missing/invalid date or future missing mainSurgeon/method -> legacy_unverified_manual_review
    """
    cfg = get_approval_config(db)
    db.setdefault("surgeryApprovalConfig", copy.deepcopy(cfg))
    db.setdefault("approvalDelegations", [])
    db.setdefault("_approvalIdempotency", {})

    catalog = load_procedure_catalog(data_dir, base_dir)
    rollout_str = cfg.get("rolloutEffectiveSurgeryDate", "2026-11-02")
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
        "alreadyMigrated": 0,
        "strippedRealSurgeries": stripped_real,
    }

    for s in surgeries:
        if not isinstance(s, dict):
            continue
        if sandbox_only and s.get("isTestSandboxCase") is not True:
            continue
        if not force and s.get("schemaVersion") == SCHEMA_VERSION and isinstance(s.get("approval"), dict) and s["approval"].get("status"):
            counts["alreadyMigrated"] += 1
            continue

        norm = normalize_surgery_aliases(s, None)
        s.clear()
        s.update(norm)

        s["schemaVersion"] = SCHEMA_VERSION
        s["ruleVersion"] = RULE_VERSION
        if not is_strict_int(s.get("caseRevision")) or s.get("caseRevision", 0) < 1:
            s["caseRevision"] = 1
        s["lastJournalSeq"] = int(s.get("lastJournalSeq", 0) or 0)

        approach = s.get("approachType")
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

    dedup_targets = []
    for rid in recipient_staff_ids:
        if is_pos_int(rid) and rid != actor_staff_id and rid not in dedup_targets:
            if (cfg.get("rolloutAccessMode") == "superadmin_only" or is_sandbox) and rid != DEPUTY_STAFF_ID:
                # Never leak canary/test notifications to non-superadmin staff bells!
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

    out = {}
    for k, v in raw_data.items():
        if k in strip_fields:
            continue
        if k == "notifications" and isinstance(v, list):
            out[k] = [
                n for n in v
                if isinstance(n, dict)
                and n.get("toStaffId") == staff_id
                and (is_sa or n.get("isTestSandboxCase") is not True)
            ]
        elif k in ("surgeries", "surgeriesTrash") and isinstance(v, list) and not is_sa:
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
    if urgency == "emergency_exception":
        return "emergency_exempt"
    approval = surgery.get("approval") or {}
    if approval.get("slaGraceWindow") is True:
        return "grace_window_on_time"
    d_str = surgery.get("date", "")
    if not is_valid_iso_date(d_str):
        return "unknown"
    s_date = datetime.strptime(d_str, "%Y-%m-%d").date()
    now = now_vn()
    sla = cfg.get("slaConfig") or {}

    if urgency == "semi_urgent":
        return "semi_urgent_window"
    if urgency == "elective_service":
        dl_date = s_date - timedelta(days=int(sla.get("serviceDaysBefore", 1)))
        dl = datetime(dl_date.year, dl_date.month, dl_date.day, int(sla.get("serviceDeadlineHour", 13)), 0, tzinfo=VN_TZ)
        return "on_time" if now <= dl else "late"
    dl_date = s_date - timedelta(days=int(sla.get("electiveDaysBefore", 2)))
    dl = datetime(dl_date.year, dl_date.month, dl_date.day, int(sla.get("electiveDeadlineHour", 16)), 0, tzinfo=VN_TZ)
    return "on_time" if now <= dl else "late"


def validate_routine_submit_gate(surgery: dict, actor: dict, payload: dict, catalog: dict, db: dict, cfg: dict) -> list:
    """
    Validates Stage 1 (Privilege Matrix, Catalog Disambiguation, Interdisciplinary, SLA) +
    Stage 2 (Checklist CK-01..08 & Clinical Chips C-01..07 + B1..B4 when checklistMode == 'enforced_gate').
    Raises ApprovalEngineError(422/403, ...) with exact errorCode on violation.
    """
    if surgery.get("approachType") == "nsth":
        raise ApprovalEngineError(422, "NSTH_EXTERNAL_AUTHORITY", "Ca Nội soi tiêu hóa thuộc thẩm quyền Trưởng khoa NSTH.")

    ms_id = surgery.get("mainSurgeon")
    if not is_pos_int(ms_id):
        raise ApprovalEngineError(422, "MISSING_MAIN_SURGEON", "Vui lòng chọn BS mổ chính trước khi trình duyệt.")
    if ms_id in TRAINEE_STAFF_IDS:
        raise ApprovalEngineError(422, "INVALID_MAIN_SURGEON", "Bác sĩ học viên không được đứng tên BS mổ chính.")

    # Case-level RBAC check (CORE-TC-15)
    actor_id = actor.get("staffId")
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
        if actor_id != coord_id and actor_id not in BCN_STAFF_IDS:
            raise ApprovalEngineError(403, "NOT_CASE_ATTENDING", "Chỉ BS chính điều phối ca liên chuyên khoa hoặc BCN được trình duyệt.")
    else:
        if actor_id != ms_id and actor_id not in BCN_STAFF_IDS:
            if is_same_pod_attending(catalog, surgery, actor_id):
                acting_reason = str((payload or {}).get("actingForMainSurgeonReason") or "").strip()
                if len(acting_reason) < 10:
                    raise ApprovalEngineError(
                        422,
                        "ACTING_REASON_REQUIRED",
                        "BS chính cùng POD trình thay bắt buộc nhập lý do trình thay (tối thiểu 10 ký tự).",
                    )
            else:
                raise ApprovalEngineError(403, "NOT_CASE_ATTENDING", "Bạn không phải BS mổ chính hoặc BS chính cùng POD của ca mổ này.")

    cc = surgery.get("clinicalClassification") or {}
    pg_obj = cc.get("pathologyGroup") or {}
    pc_obj = cc.get("procedureClass") or {}
    col_obj = cc.get("columnCompliance") or {}
    urgency = cc.get("urgencyLevel") or suggest_urgency_level(surgery.get("surgeryType"))

    if urgency == "semi_urgent":
        su_reason = str((payload or {}).get("semiUrgentClinicalReason") or cc.get("semiUrgentClinicalReason") or "").strip()
        if len(su_reason) < 5:
            raise ApprovalEngineError(422, "SEMI_URGENT_REASON_REQUIRED", "Ca bán khẩn bắt buộc ghi rõ lý do lâm sàng bán khẩn.")

    # Stage 1: Procedure catalog & Column compliance verification (always enforced!)
    conf_cat_id = pc_obj.get("confirmedCatalogEntryId")
    conf_class = pc_obj.get("confirmedClass")
    if not conf_class or conf_class == "unknown_ambiguous":
        raise ApprovalEngineError(
            422,
            "PROCEDURE_CATALOG_DISAMBIGUATION_REQUIRED",
            "Phương pháp phẫu thuật chưa được xác nhận hạng/mã danh mục chuẩn (đang ở trạng thái gợi ý hoặc mơ hồ).",
        )
    if conf_class == "unclassified":
        unc_note = str(pc_obj.get("unclassifiedNote") or "").strip()
        if len(unc_note) < 5:
            raise ApprovalEngineError(
                422,
                "UNCLASSIFIED_PROCEDURE_NOTE_REQUIRED",
                "Kỹ thuật 'Không phân loại' bắt buộc nhập thuyết minh chuyên môn để BCN thẩm định.",
            )

    live_col = evaluate_column_compliance(
        catalog,
        db,
        main_surgeon_id=ms_id,
        approach_type=surgery.get("approachType", "mo"),
        surgery_date=surgery.get("date", ""),
        confirmed_class=conf_class,
        confirmed_catalog_id=conf_cat_id,
    )
    sys_check = live_col["systemCheck"]
    decl_mode = col_obj.get("declaredMode")

    if sys_check == "robot_certification_required":
        if decl_mode != "propose_over_column":
            raise ApprovalEngineError(
                422,
                "ROBOT_CERTIFICATION_REQUIRED",
                "BS mổ chính chưa có trong danh sách chứng nhận Phẫu thuật viên Robot hiện hành.",
            )
    elif sys_check == "over_column":
        if decl_mode == "within_column" or not decl_mode:
            raise ApprovalEngineError(
                422,
                "OVER_COLUMN_DETECTED",
                "Phẫu thuật cao hơn cột hiện tại của BS mổ chính; không thể chọn 'Đúng cột'.",
            )
        if decl_mode == "approved_over_column":
            if col_obj.get("privilegeVerifiedByStaffId") not in BCN_STAFF_IDS:
                raise ApprovalEngineError(
                    422,
                    "OVER_COLUMN_PROOF_REQUIRED",
                    "Kỹ thuật chưa có trong danh mục DVKT vượt cột đã cấu hình; vui lòng chọn 'Đề xuất vượt cột' để BCN xét duyệt.",
                )
    elif sys_check == "matrix_expired_manual_verify":
        if decl_mode not in ("matrix_expired_manual_verify", "propose_over_column"):
            decl_mode = "matrix_expired_manual_verify"
            col_obj["declaredMode"] = decl_mode
    elif sys_check == "external_surgeon_verify_privilege":
        col_obj["declaredMode"] = "external_surgeon_verify_privilege"
    elif sys_check in ("within_column", "approved_over_column_matched") and not decl_mode:
        raise ApprovalEngineError(422, "UNVERIFIED_REQUIRED_FIELDS", "Chưa xác nhận tuân thủ cột phẫu thuật (C-03).")

    # If checklistMode != 'enforced_gate', Stage 1 checks above are complete!
    checklist_mode = cfg.get("checklistMode", "enforced_gate")
    if checklist_mode != "enforced_gate":
        return []

    # ── Stage 2 Enforced Gate: C-01..C-07 + B1..B4 + CK-01..CK-08 ──
    blocking = []

    # C-01 Ward room
    pod_assign = surgery.get("podAssignment") or {}
    ward_room = pod_assign.get("wardRoom")
    if ward_room not in VALID_WARD_ROOMS:
        blocking.append("C-01_WARD_ROOM_UNCONFIRMED")

    # C-02 Pathology Group
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

    # C-04 Comorbidities
    comorb = chips.get("comorbidities") or {}
    c_vals = comorb.get("values") or []
    if not comorb.get("confirmed") or not c_vals:
        blocking.append("C-04_COMORBIDITIES_UNCONFIRMED")
    if "none" in c_vals and len(c_vals) > 1:
        raise ApprovalEngineError(422, "MUTUALLY_EXCLUSIVE_CHIPS", "Chip 'Không bệnh nền' không thể chọn đồng thời với bệnh nền khác.")
    if "other" in c_vals and not str(comorb.get("otherComorbidityNote") or "").strip():
        blocking.append("C-04_OTHER_NOTE_REQUIRED")

    # C-05 Antithrombotic Plan
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
        if urgency == "elective":
            raise ApprovalEngineError(422, "UNHELD_DRUG_NOT_FOR_ELECTIVE", "Thuốc chống huyết khối chưa ngưng đủ thời gian không được trình theo luồng mổ chương trình thường quy.")
        if not str(anti.get("drugName") or "").strip() or not str(anti.get("lastDoseAt") or "").strip() or not str(anti.get("planReferenceNote") or "").strip():
            raise ApprovalEngineError(422, "ANTITHROMBOTIC_DETAILS_REQUIRED", "Vui lòng ghi rõ tên thuốc, liều cuối và phương án dự phòng chảy máu.")

    # C-06 Blood & Devices
    bd = chips.get("bloodAndDevices") or {}
    bd_vals = bd.get("values") or []
    if not bd.get("confirmed") or not bd_vals:
        blocking.append("C-06_BLOOD_DEVICES_UNCONFIRMED")
    if "basic_instruments_only" in bd_vals and len(bd_vals) > 1:
        raise ApprovalEngineError(422, "MUTUALLY_EXCLUSIVE_CHIPS", "'Chỉ dụng cụ cơ bản' không thể chọn cùng thiết bị/máu dự trù khác.")
    if surgery.get("approachType") == "robot" and "basic_instruments_only" in bd_vals:
        raise ApprovalEngineError(422, "MUTUALLY_EXCLUSIVE_CHIPS", "Ca phẫu thuật Robot không được chọn 'Chỉ dụng cụ cơ bản'.")

    # C-07 Stoma Plan
    stoma = chips.get("stomaPlan") or {}
    stoma_val = stoma.get("value")
    if not stoma.get("confirmed") or stoma_val not in VALID_STOMA_PLANS:
        blocking.append("C-07_STOMA_UNCONFIRMED")

    # Context Modules B1..B4
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
        st = b3.get("clinicalStage") or {}
        ct, cn, cm = st.get("cT"), st.get("cN"), st.get("cM")
        if not (ct and cn and cm):
            blocking.append("B3_CLINICAL_STAGE_REQUIRED")
        if any(x in ("Tx", "Nx", "Mx") for x in (ct, cn, cm)) and not str(st.get("stagingNote") or "").strip():
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
            if crm == "unknown_no_pelvic_mri" and not str(b3.get("crmNote") or st.get("stagingNote") or "").strip():
                blocking.append("B3_CRM_NOTE_REQUIRED")
        if not b3.get("multimodalStatus"):
            blocking.append("B3_MULTIMODAL_STATUS_REQUIRED")
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

    # Checklist CK-01..CK-08 (Per-code clinical state gate + Attending verification mandate)
    ck = surgery.get("preopChecklist") or {}
    actor_id_submit = actor.get("staffId")
    for code in CK_CODES:
        item = ck.get(code) or {}
        st_val = item.get("state", "unverified")
        allowed_for_code = ALLOWED_ROUTINE_CK_STATES_BY_CODE.get(code, {"verified_ok"})
        if st_val not in allowed_for_code:
            blocking.append(f"{code}_INVALID_STATE:{st_val}")
            continue
        if st_val == "verified_abnormal_planned" and not str(item.get("clinicalPlanNote") or "").strip():
            blocking.append(f"{code}_CLINICAL_PLAN_NOTE_REQUIRED")
        if code == "CK-01" and st_val == "not_indicated" and len(str(item.get("clinicalPlanNote") or "").strip()) < 5:
            blocking.append("CK-01_NOT_INDICATED_REASON_REQUIRED")
        if code == "CK-04" and st_val == "not_applicable":
            if not (pg_val == "benign_anorectal" and conf_class in ("PT-II", "PT-III")):
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
        if code == "CK-02":
            subs = item.get("subChecks") or {}
            pre_a = subs.get("preAnesthesiaExam")
            if pre_a not in ("verified_ok", "ready_for_preanesthesia", "verified_abnormal_planned"):
                blocking.append("CK-02_PREANESTHESIA_UNVERIFIED")
            for sub_k in ("ecg", "chestImaging", "echo"):
                if subs.get(sub_k) not in ("verified_ok", "verified_abnormal_planned", "not_indicated"):
                    blocking.append(f"CK-02_{sub_k}_UNVERIFIED")

    if blocking:
        raise ApprovalEngineError(
            422,
            "UNVERIFIED_REQUIRED_FIELDS",
            "Hồ sơ còn mục Checklist hoặc Chip bắt buộc chưa được BS chính xác nhận.",
            {"blockingReasons": blocking},
        )
    return blocking


# ───────────────────────── Draft Patch & Bulk Confirm / Undo ─────────────────────────

def apply_draft_updates(surgery: dict, actor: dict, payload: dict, catalog: dict, db: dict) -> tuple:
    """
    Applies draft edits to clinicalClassification, podAssignment, clinicalChips, preopChecklist,
    interdisciplinaryCoordination, or bulkAction ('bulk_confirm_routine' | 'undo_bulk_confirm').
    Enforces:
      - Trainees cannot set verifiedByStaffId on CK-04 / CK-08 or set verified_* states (capped at prepared_ok).
      - Changing pathologyGroup after context data exists requires groupChangeReason and archives to archivedGroupData[].
      - Mutual exclusion on chips validated immediately if confirmed.
    Returns (tier_a_changed: bool, action_name: str, summary: dict).
    """
    actor_id = actor.get("staffId")
    trainee = is_trainee_user(actor)
    attending = is_attending_user(actor)

    if not (trainee or attending or actor.get("isSuperAdmin")):
        raise ApprovalEngineError(403, "FORBIDDEN", "Chỉ Bác sĩ học viên, Bác sĩ chính và Ban Chủ nhiệm mới được chuẩn bị hồ sơ duyệt mổ.")

    if surgery.get("podAssignment") is None:
        init_parts = build_initial_unverified_structures(surgery, catalog, db)
        for k_i, v_i in init_parts.items():
            if surgery.get(k_i) is None:
                surgery[k_i] = v_i

    before_tier_a_fp = canonical_json({
        "cc": surgery.get("clinicalClassification"),
        "ck": surgery.get("preopChecklist"),
        "chips": surgery.get("clinicalChips"),
        "ic": surgery.get("interdisciplinaryCoordination"),
        "coord": surgery.get("coordinatingAttendingStaffId"),
    })

    bulk_op = (payload or {}).get("bulkAction")
    if bulk_op == "bulk_confirm_routine":
        cc = surgery.get("clinicalClassification") or {}
        pg_conf = (cc.get("pathologyGroup") or {}).get("confirmedValue")
        pc_conf = (cc.get("procedureClass") or {}).get("confirmedClass")
        if not pg_conf or pg_conf == "unknown" or not pc_conf:
            raise ApprovalEngineError(
                422,
                "BULK_PRECONDITION_UNMET",
                "Vui lòng xác nhận Nhóm bệnh lý và Hạng phẫu thuật trước khi dùng Xác nhận nhanh.",
            )
        ck = surgery.setdefault("preopChecklist", {})
        surgery["_bulkUndoSnapshot"] = copy.deepcopy(ck)
        target_state = "prepared_ok" if trainee else "verified_ok"
        anti_mode = ((surgery.get("clinicalChips") or {}).get("antithromboticPlan") or {}).get("mode")
        anti_conf = ((surgery.get("clinicalChips") or {}).get("antithromboticPlan") or {}).get("confirmed")
        changed_codes = []

        # Auto-derive CK-05 = not_applicable ONLY for confirmed benign groups
        if pg_conf in ("benign_anorectal", "benign_colorectal_abdominal"):
            ck05 = ck.setdefault("CK-05", {})
            if ck05.get("state") in (None, "unverified", "not_applicable"):
                ck05["state"] = "not_applicable"
                ck05["autoDerivedFrom"] = f"pathologyGroup={pg_conf}"
                if not trainee and actor_id in ATTENDING_STAFF_IDS:
                    ck05["verifiedByStaffId"] = actor_id

        for code in ("CK-01", "CK-02", "CK-03", "CK-06", "CK-07"):
            item = ck.setdefault(code, {"state": "unverified"})
            cur_st = item.get("state", "unverified")
            # Protected states: NEVER overwrite!
            if cur_st in ("not_applicable", "not_indicated", "verified_abnormal_planned", "deferred_emergency"):
                continue
            if code == "CK-03" and (not anti_conf or anti_mode == "unheld_urgent_risk"):
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
                changed_codes.append(code)

        after_fp = canonical_json({
            "cc": surgery.get("clinicalClassification"),
            "ck": surgery.get("preopChecklist"),
            "chips": surgery.get("clinicalChips"),
            "ic": surgery.get("interdisciplinaryCoordination"),
            "coord": surgery.get("coordinatingAttendingStaffId"),
        })
        return (after_fp != before_tier_a_fp), "bulk_confirm_routine", {"changedCodes": changed_codes}

    if bulk_op == "undo_bulk_confirm":
        undo_snap = surgery.pop("_bulkUndoSnapshot", None)
        if not isinstance(undo_snap, dict):
            raise ApprovalEngineError(422, "NO_BULK_UNDO_AVAILABLE", "Không có thao tác xác nhận nhanh nào để hoàn tác.")
        surgery["preopChecklist"] = copy.deepcopy(undo_snap)
        return True, "undo_bulk_confirm", {"restored": True}

    # 1. Interdisciplinary coordination & coordinatingAttendingStaffId
    if "interdisciplinaryCoordination" in payload:
        ic = payload["interdisciplinaryCoordination"]
        if isinstance(ic, dict) or ic is None:
            surgery["interdisciplinaryCoordination"] = copy.deepcopy(ic)
            if isinstance(ic, dict) and is_pos_int(ic.get("coordinatingAttendingStaffId")):
                surgery["coordinatingAttendingStaffId"] = int(ic["coordinatingAttendingStaffId"])
    if "coordinatingAttendingStaffId" in payload:
        cid = payload["coordinatingAttendingStaffId"]
        surgery["coordinatingAttendingStaffId"] = int(cid) if is_pos_int(cid) else None

    # 2. POD Assignment (C-01 — Tier B administrative room/resident assignment)
    if isinstance(payload.get("podAssignment"), dict):
        pa_in = payload["podAssignment"]
        pa = surgery.setdefault("podAssignment", {})
        if "wardRoom" in pa_in:
            wr = pa_in["wardRoom"]
            if wr is not None and wr not in VALID_WARD_ROOMS:
                raise ApprovalEngineError(422, "INVALID_WARD_ROOM", f"Phòng bệnh '{wr}' không hợp lệ.")
            pa["wardRoom"] = wr
            r_info = get_pod_room_info(catalog, wr)
            pa["suggestedPodId"] = r_info.get("podId")
            if not pa.get("preparedByStaffId"):
                res_ids = r_info.get("residentStaffIds") or []
                pa["preparedByStaffId"] = res_ids[0] if res_ids else (actor_id if trainee else surgery.get("mainSurgeon"))
        if "preparedByStaffId" in pa_in and (is_pos_int(pa_in["preparedByStaffId"]) or pa_in["preparedByStaffId"] is None):
            pa["preparedByStaffId"] = pa_in["preparedByStaffId"]

    # 3. Clinical Classification (C-02, C-03, Urgency)
    action_override = None
    if isinstance(payload.get("clinicalClassification"), dict):
        cc_in = payload["clinicalClassification"]
        cc = surgery.setdefault("clinicalClassification", {})

        # Pathology group change with archive protection (TC-12)
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

                pg_cur["confirmedValue"] = new_group
                pg_cur["confirmedByStaffId"] = actor_id
                if "otherPathologyNote" in pg_in:
                    pg_cur["otherPathologyNote"] = str(pg_in.get("otherPathologyNote") or "").strip()

                # Recalculate CK-05 auto-applicability
                ck05 = surgery.setdefault("preopChecklist", {}).setdefault("CK-05", {"state": "unverified"})
                if new_group in ("benign_anorectal", "benign_colorectal_abdominal"):
                    ck05["state"] = "not_applicable"
                    ck05["autoDerivedFrom"] = f"pathologyGroup={new_group}"
                    if not trainee and actor_id in ATTENDING_STAFF_IDS:
                        ck05["verifiedByStaffId"] = actor_id
                elif ck05.get("state") == "not_applicable":
                    ck05["state"] = "unverified"
                    ck05["verifiedByStaffId"] = None
                    ck05.pop("autoDerivedFrom", None)

        if isinstance(cc_in.get("procedureClass"), dict):
            pc_in = cc_in["procedureClass"]
            pc_cur = cc.setdefault("procedureClass", {})
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
            if "unclassifiedNote" in pc_in:
                pc_cur["unclassifiedNote"] = str(pc_in.get("unclassifiedNote") or "").strip()

        if isinstance(cc_in.get("columnCompliance"), dict):
            col_in = cc_in["columnCompliance"]
            col_cur = cc.setdefault("columnCompliance", {})
            if "declaredMode" in col_in:
                col_cur["declaredMode"] = col_in["declaredMode"]
            if "overColumnRef" in col_in:
                col_cur["overColumnRef"] = str(col_in.get("overColumnRef") or "").strip()
            if "privilegeVerifiedByStaffId" in col_in and actor_id in BCN_STAFF_IDS:
                col_cur["privilegeVerifiedByStaffId"] = actor_id

        # Refresh live column evaluation
        pc_cur = cc.get("procedureClass") or {}
        live_col = evaluate_column_compliance(
            catalog,
            db,
            main_surgeon_id=surgery.get("mainSurgeon"),
            approach_type=surgery.get("approachType", "mo"),
            surgery_date=surgery.get("date", ""),
            confirmed_class=pc_cur.get("confirmedClass"),
            confirmed_catalog_id=pc_cur.get("confirmedCatalogEntryId"),
        )
        col_cur = cc.setdefault("columnCompliance", {})
        col_cur.update(live_col)

        if "urgencyLevel" in cc_in and cc_in["urgencyLevel"] in VALID_URGENCY_LEVELS:
            cc["urgencyLevel"] = cc_in["urgencyLevel"]
        if "semiUrgentClinicalReason" in cc_in:
            cc["semiUrgentClinicalReason"] = str(cc_in.get("semiUrgentClinicalReason") or "").strip()

    # 4. Clinical Chips (C-04..C-07 & Context B1..B4)
    if isinstance(payload.get("clinicalChips"), dict):
        chips_in = payload["clinicalChips"]
        chips = surgery.setdefault("clinicalChips", {})

        if isinstance(chips_in.get("comorbidities"), dict):
            cm_in = chips_in["comorbidities"]
            vals = cm_in.get("values") if isinstance(cm_in.get("values"), list) else []
            if "none" in vals and len(vals) > 1:
                raise ApprovalEngineError(422, "MUTUALLY_EXCLUSIVE_CHIPS", "Chip 'Không bệnh nền' loại trừ các bệnh nền khác.")
            for v in vals:
                if v not in VALID_COMORBIDITIES:
                    raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Giá trị bệnh nền '{v}' không hợp lệ.")
            chips["comorbidities"] = {
                "confirmed": bool(cm_in.get("confirmed", len(vals) > 0)),
                "values": vals,
                "otherComorbidityNote": str(cm_in.get("otherComorbidityNote") or "").strip(),
            }

        if isinstance(chips_in.get("antithromboticPlan"), dict):
            at_in = chips_in["antithromboticPlan"]
            mode = at_in.get("mode")
            if mode is not None and mode not in VALID_ANTITHROMBOTIC_MODES:
                raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Chế độ thuốc chống huyết khối '{mode}' không hợp lệ.")
            chips["antithromboticPlan"] = {
                "confirmed": bool(at_in.get("confirmed", mode is not None)),
                "mode": mode,
                "drugName": str(at_in.get("drugName") or "").strip(),
                "bridgingAgent": str(at_in.get("bridgingAgent") or "").strip(),
                "lastDoseAt": str(at_in.get("lastDoseAt") or "").strip(),
                "approvingSpecialtyOrDoctor": str(at_in.get("approvingSpecialtyOrDoctor") or "").strip(),
                "planReferenceNote": str(at_in.get("planReferenceNote") or "").strip(),
            }

        if isinstance(chips_in.get("bloodAndDevices"), dict):
            bd_in = chips_in["bloodAndDevices"]
            vals = bd_in.get("values") if isinstance(bd_in.get("values"), list) else []
            if "basic_instruments_only" in vals and len(vals) > 1:
                raise ApprovalEngineError(422, "MUTUALLY_EXCLUSIVE_CHIPS", "'Chỉ dụng cụ cơ bản' loại trừ các thiết bị đặc thù khác.")
            if surgery.get("approachType") == "robot" and "basic_instruments_only" in vals:
                raise ApprovalEngineError(422, "MUTUALLY_EXCLUSIVE_CHIPS", "Ca phẫu thuật Robot không được chọn 'Chỉ dụng cụ cơ bản'.")
            for v in vals:
                if v not in VALID_BLOOD_DEVICES:
                    raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Thiết bị/máu '{v}' không hợp lệ.")
            chips["bloodAndDevices"] = {
                "confirmed": bool(bd_in.get("confirmed", len(vals) > 0)),
                "values": vals,
                "otherDeviceNote": str(bd_in.get("otherDeviceNote") or "").strip(),
            }

        if isinstance(chips_in.get("stomaPlan"), dict):
            st_in = chips_in["stomaPlan"]
            sval = st_in.get("value")
            if sval is not None and sval not in VALID_STOMA_PLANS:
                raise ApprovalEngineError(422, "INVALID_CHIP_VALUE", f"Kế hoạch HMNT '{sval}' không hợp lệ.")
            chips["stomaPlan"] = {
                "confirmed": bool(st_in.get("confirmed", sval is not None)),
                "value": sval,
                "stomaNote": str(st_in.get("stomaNote") or "").strip(),
            }

        if isinstance(chips_in.get("contextChips"), dict):
            ctx_cur = chips.setdefault("contextChips", {})
            for ctx_key in ("fistulaContext", "benignAbdominalContext", "cancerContext", "specialNeoplasmContext"):
                if isinstance(chips_in["contextChips"].get(ctx_key), dict):
                    ctx_val = copy.deepcopy(chips_in["contextChips"][ctx_key])
                    # Never coerce Nx/Tx/Mx into N0/T0/M0! Preserve exact strings and compute synchronous flag.
                    if ctx_key == "cancerContext":
                        locs = ctx_val.get("tumorLocation") or []
                        ctx_val["isSynchronousMultiSite"] = len(locs) >= 2
                        is_rectal_or_anal = any(str(l).startswith("rectum_") or l == "anal_canal" for l in locs)
                        if not is_rectal_or_anal and not ctx_val.get("crmStatus"):
                            ctx_val["crmStatus"] = "not_applicable"
                    ctx_cur[ctx_key] = ctx_val

    # 5. Pre-op Checklist CK-01..CK-08 (with strict trainee guard — TC-03!)
    if isinstance(payload.get("preopChecklist"), dict):
        ck_in = payload["preopChecklist"]
        ck_cur = surgery.setdefault("preopChecklist", {})
        for code in CK_CODES:
            if code not in ck_in or not isinstance(ck_in[code], dict):
                continue
            item_in = ck_in[code]
            item_cur = ck_cur.setdefault(code, {"state": "unverified", "preparedByStaffId": None, "verifiedByStaffId": None})
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
                item_cur["state"] = req_state
                if req_state == "prepared_ok":
                    item_cur["preparedByStaffId"] = actor_id
                if "clinicalPlanNote" in item_in:
                    item_cur["clinicalPlanNote"] = str(item_in.get("clinicalPlanNote") or "").strip()
            else:
                item_cur["state"] = req_state
                if req_state in ("verified_ok", "verified_abnormal_planned", "not_indicated", "not_applicable", "deferred_emergency"):
                    item_cur["verifiedByStaffId"] = actor_id
                    if not item_cur.get("preparedByStaffId") and code not in ("CK-04", "CK-08"):
                        item_cur["preparedByStaffId"] = actor_id
                elif req_state in ("unverified", "prepared_ok"):
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

    after_tier_a_fp = canonical_json({
        "cc": surgery.get("clinicalClassification"),
        "ck": surgery.get("preopChecklist"),
        "chips": surgery.get("clinicalChips"),
        "ic": surgery.get("interdisciplinaryCoordination"),
        "coord": surgery.get("coordinatingAttendingStaffId"),
    })
    return (after_tier_a_fp != before_tier_a_fp), (action_override or "save_draft"), {}


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


def _stamp_pod_for_sandbox(rec: dict, catalog: dict, ward_room: str, trainee_id: int = None, freeze_snapshot: bool = False):
    r_info = get_pod_room_info(catalog, ward_room)
    res_list = r_info.get("residentStaffIds") or []
    prep_id = trainee_id if is_pos_int(trainee_id) else (res_list[0] if res_list else rec.get("mainSurgeon"))
    pa = {
        "wardRoom": ward_room,
        "suggestedPodId": r_info.get("podId"),
        "preparedByStaffId": prep_id,
        "podSnapshot": {
            "rosterPeriod": ((catalog.get("podRoster") or {}).get("rosterPeriod")) or "2026-10-05_2026-12-13",
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

    # ── CA TEST 03: Ready for Attending (🩺 HV đã rà sơ bộ) — Mổ yêu cầu Cột I, Rò HM phức tạp tái phát + Đã chụp MRI đường rò ──
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
        "surgeryType": "yeucau",
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
        catalog_entry_id="MO-145", proc_class="PT-I", declared_mode="within_column", urgency_level="elective_service",
    )
    c03["clinicalChips"] = {
        "comorbidities": {"confirmed": True, "values": ["diabetes"], "otherComorbidityNote": ""},
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
        "comorbidities": {"confirmed": True, "values": ["hypertension"], "otherComorbidityNote": ""},
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
        "comorbidities": {"confirmed": True, "values": ["hypertension", "cad_stent"], "otherComorbidityNote": ""},
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
                "clinicalStage": {
                    "cT": "T3",
                    "cN": "Nx",
                    "cM": "M0",
                    "stagingNote": "Sau TNT hóa xạ toàn diện — hạch mạc treo trực tràng thoái triển xơ hóa trên MRI tái đánh giá",
                },
                "crmStatus": "crm_clear",
                "multimodalStatus": "post_tnt",
                "mdtReviewStatus": "mdt_completed",
            }
        },
    }
    c06["preopChecklist"] = _build_verified_checklist_for_sandbox(ms06, tr06, benign=False)
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

    # ── CA TEST 07: Approved (✅ Đã duyệt tại khoa) — K đại tràng đồng thời đa ổ + Bắc cầu Enoxaparin + Thiếu máu đã bù máu ──
    ms07 = pick_staff([1, 2, 4, 5])
    tr07 = pick_staff(trainee_pool)
    rm07 = rng.choice(all_rooms)
    c07 = initialize_new_surgery_record({
        "id": base_id + 6,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-07_APPROVED_SYNCHRONOUS_CANCER_BRIDGING",
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
        "notes": "[CA TEST #07 — Đã duyệt tại khoa (Tích xanh hợp lệ 6 điều kiện): K đa ổ + Bắc cầu Lovenox + CK-01 bất thường đã truyền máu]",
    }, catalog, db)
    _stamp_pod_for_sandbox(c07, catalog, rm07, trainee_id=tr07, freeze_snapshot=True)
    _finalize_classification_for_sandbox(
        c07, catalog, db, actor_id=ms07, pathology_group="cancer_confirmed",
        catalog_entry_id="PTNS-204", proc_class="PT-ĐB", declared_mode="within_column", urgency_level="elective",
    )
    c07["clinicalChips"] = {
        "comorbidities": {"confirmed": True, "values": ["afib_hf", "anemia_malnutrition"], "otherComorbidityNote": ""},
        "antithromboticPlan": {
            "confirmed": True,
            "mode": "bridging_per_plan",
            "drugName": "Rivaroxaban 20mg",
            "bridgingAgent": "Enoxaparin (Lovenox) 40mg TDD",
            "lastDoseAt": "Ngưng Rivaroxaban trước mổ 72h, ngưng Lovenox trước mổ 24h",
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
                "clinicalStage": {"cT": "T3", "cN": "N1", "cM": "M0", "stagingNote": ""},
                "crmStatus": "not_applicable",
                "multimodalStatus": "upfront_surgery",
                "mdtReviewStatus": "mdt_completed",
            }
        },
    }
    c07["preopChecklist"] = _build_verified_checklist_for_sandbox(
        ms07, tr07, benign=False,
        ck01_abnormal_note="Hb lúc nhập viện 8.8 g/dL — đã truyền 02 ĐV HC lắng nâng Hb lên 10.9 g/dL, dự trù sẵn 02 ĐV tại phòng mổ",
    )
    c07["caseRevision"] = 3
    c07["approval"]["status"] = "approved"
    c07["approval"]["slaStatus"] = "on_time"
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
        "comorbidities": {"confirmed": True, "values": ["none"], "otherComorbidityNote": ""},
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

    # ── CA TEST 09: Submitted (⏳ Chờ BCN xét Vượt Cột) — PTV Cột II đề xuất Vượt Cột lên PT-I (PTNS Đóng HMNT + B2 kiểm tra đầu dưới) ──
    ms09 = pick_staff([7, 8, 9])
    tr09 = pick_staff(trainee_pool)
    c09 = initialize_new_surgery_record({
        "id": base_id + 8,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-09_SUBMITTED_OVER_COLUMN_COL2_TO_PT1",
        "patientName": mock_name(9, "PTNS Đóng HMNT [Cột II Đề xuất Vượt Cột PT-I]"),
        "birthYear": rng.randint(1960, 1986),
        "admissionId": mock_nv(9),
        "date": d_off(3, 6),
        "duration": rng.choice([90, 120]),
        "surgeryType": "yeucau",
        "approachType": "noisoi",
        "mainSurgeon": ms09,
        "assistSurgeon1": pick_staff([2, 4, 6]),
        "diagnosis": "Hậu môn nhân tạo hồi tràng kiểu quai sau mổ cắt trước thấp 4 tháng",
        "method": "Phẫu thuật nội soi đóng hậu môn nhân tạo",
        "notes": "[CA TEST #09 — PTV Cột II đề xuất vượt cột thực hiện PTNS Loại I có BS Cột ĐB/I hỗ trợ; đã nội soi kiểm tra miệng nối thông tốt]",
    }, catalog, db)
    _stamp_pod_for_sandbox(c09, catalog, rng.choice(["705", "706", "710", "707"]), trainee_id=tr09, freeze_snapshot=True)
    _finalize_classification_for_sandbox(
        c09, catalog, db, actor_id=ms09, pathology_group="benign_colorectal_abdominal",
        catalog_entry_id="PTNS-214", proc_class="PT-I", declared_mode="propose_over_column",
        urgency_level="elective_service",
        over_column_ref="Đề xuất BCN phê duyệt vượt cột ca đóng HMNT hồi tràng (có BS Cột ĐB/I cùng kíp hỗ trợ)",
    )
    c09["clinicalChips"] = {
        "comorbidities": {"confirmed": True, "values": ["none"], "otherComorbidityNote": ""},
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
    c09["preopChecklist"] = _build_verified_checklist_for_sandbox(ms09, tr09, benign=True)
    c09["caseRevision"] = 2
    c09["approval"]["status"] = "submitted"
    c09["approval"]["slaStatus"] = "on_time"
    c09["approval"]["submittedSnapshot"] = {"caseRevision": 2, "submittedAt": ts_now, "submittedByStaffId": ms09, "actingForMainSurgeonReason": None}
    stamp_badge_fields(c09)
    cases.append(c09)

    # ── CA TEST 10: Submitted (⏳ Chờ BCN xét Vượt Cột) — PTV Cột III đề xuất Vượt Cột PTNS PT-II (do PTNS có 0 kỹ thuật PT-III) ──
    ms10 = pick_staff([10, 11, 12])
    tr10 = pick_staff(trainee_pool)
    c10 = initialize_new_surgery_record({
        "id": base_id + 9,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-10_SUBMITTED_OVER_COLUMN_COL3_LAP_PT2",
        "patientName": mock_name(10, "PTNS Ruột Thừa / Túi Thừa [Cột III Vượt Cột PTNS]"),
        "birthYear": rng.randint(1978, 2003),
        "admissionId": mock_nv(10),
        "date": d_off(2, 4),
        "duration": rng.choice([60, 75]),
        "surgeryType": "bankhan",
        "approachType": "noisoi",
        "mainSurgeon": ms10,
        "assistSurgeon1": pick_staff([6, 8]),
        "diagnosis": "Viêm ruột thừa cấp mủ khu trú hố chậu phải",
        "method": "Phẫu thuật nội soi cắt ruột thừa",
        "notes": "[CA TEST #10 — Phụ lục PTNS không có kỹ thuật PT-III; PTV Cột III trình BCN xét duyệt thực hiện PTNS hạng II bán khẩn]",
    }, catalog, db)
    _stamp_pod_for_sandbox(c10, catalog, rng.choice(["711", "712", "709", "718"]), trainee_id=tr10, freeze_snapshot=True)
    _finalize_classification_for_sandbox(
        c10, catalog, db, actor_id=ms10, pathology_group="benign_colorectal_abdominal",
        catalog_entry_id="PTNS-187", proc_class="PT-II", declared_mode="propose_over_column",
        urgency_level="semi_urgent",
        semi_urgent_reason="Đau khu trú HCP tăng dần, BC 14.8 G/L, CRP 68 mg/L, siêu âm/CT ruột thừa đường kính 11mm",
        over_column_ref="PTV Cột III trình BCN duyệt thực hiện PTNS cắt ruột thừa (PT-II) có BS Cột I/II hỗ trợ tại phòng mổ",
    )
    c10["clinicalChips"] = {
        "comorbidities": {"confirmed": True, "values": ["none"], "otherComorbidityNote": ""},
        "antithromboticPlan": {"confirmed": True, "mode": "none_confirmed"},
        "bloodAndDevices": {"confirmed": True, "values": ["basic_instruments_only"], "otherDeviceNote": ""},
        "stomaPlan": {"confirmed": True, "value": "no_stoma", "stomaNote": ""},
        "contextChips": {
            "benignAbdominalContext": {"subType": "diverticulitis_appendicitis", "bowelPrepPlan": "no_prep_eras"}
        },
    }
    c10["preopChecklist"] = _build_verified_checklist_for_sandbox(ms10, tr10, benign=True)
    c10["caseRevision"] = 2
    c10["approval"]["status"] = "submitted"
    c10["approval"]["slaStatus"] = "semi_urgent_window"
    c10["approval"]["submittedSnapshot"] = {"caseRevision": 2, "submittedAt": ts_now, "submittedByStaffId": ms10, "actingForMainSurgeonReason": None}
    stamp_badge_fields(c10)
    cases.append(c10)

    # ── CA TEST 11: Returned for Revision (↩️ BCN yêu cầu bổ sung) — Bán khẩn Áp-xe cạnh HM sâu trên nền ĐTĐ + Clopidogrel ──
    ms11 = pick_staff([7, 8, 9])
    tr11 = pick_staff(trainee_pool)
    c11 = initialize_new_surgery_record({
        "id": base_id + 10,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-11_RETURNED_BY_BCN_NEEDS_REVISION",
        "patientName": mock_name(11, "Áp-Xe Khoang Ngồi Trực Tràng [↩️ BCN trả bổ sung]"),
        "birthYear": rng.randint(1950, 1972),
        "admissionId": mock_nv(11),
        "date": d_off(1, 3),
        "duration": rng.choice([45, 60]),
        "surgeryType": "bankhan",
        "approachType": "mo",
        "mainSurgeon": ms11,
        "assistSurgeon1": tr11,
        "diagnosis": "Áp-xe cạnh hậu môn sâu lan khoang ngồi - trực tràng trên nền Đái tháo đường típ 2",
        "method": "Phẫu thuật chích, dẫn lưu áp xe cạnh hậu môn đơn giản",
        "notes": "[CA TEST #11 — BCN yêu cầu bổ sung khám tiền mê tim phổi & làm rõ thời điểm ngưng Clopidogrel trước khi trình lại]",
    }, catalog, db)
    _stamp_pod_for_sandbox(c11, catalog, rng.choice(rooms_pod2), trainee_id=tr11, freeze_snapshot=False)
    _finalize_classification_for_sandbox(
        c11, catalog, db, actor_id=ms11, pathology_group="benign_anorectal",
        catalog_entry_id="MO-142", proc_class="PT-II", declared_mode="within_column",
        urgency_level="semi_urgent",
        semi_urgent_reason="Áp-xe cạnh hậu môn căng đau, sốt 38.5°C trên bệnh nhân đái tháo đường cần dẫn lưu sớm",
    )
    c11["clinicalChips"] = {
        "comorbidities": {"confirmed": True, "values": ["diabetes", "hypertension"], "otherComorbidityNote": ""},
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
        "contextChips": {"fistulaContext": {"fistulaClassification": "not_fistula"}},
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

    # ── CA TEST 12: Emergency Exception Pending Ack (⚡ Ngoại lệ cấp cứu chờ BCN xác nhận) — Tắc ruột quai kín mổ Hartmann ──
    ms12 = pick_staff([4, 5, 6])
    tr12 = pick_staff(trainee_pool)
    c12 = initialize_new_surgery_record({
        "id": base_id + 11,
        "isTestSandboxCase": True,
        "scenarioCode": "SC-12_EMERGENCY_EXCEPTION_HARTMANN",
        "patientName": mock_name(12, "Tắc Ruột Quai Kín U Sigma [⚡ Ngoại lệ Cấp cứu]"),
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
        "notes": "[CA TEST #12 — Cổng Ngoại lệ Cấp cứu: BS trực khoa 08:00–18:00 đã báo điện thoại Trưởng khoa, chờ BCN bấm Xác nhận ngoại lệ]",
    }, catalog, db)
    _stamp_pod_for_sandbox(c12, catalog, rng.choice(rooms_pod3), trainee_id=tr12, freeze_snapshot=False)
    c12["clinicalClassification"]["urgencyLevel"] = "emergency_exception"
    for ck_c in CK_CODES:
        c12["preopChecklist"][ck_c]["state"] = "deferred_emergency"
        c12["preopChecklist"][ck_c]["verifiedByStaffId"] = ms12
    c12["caseRevision"] = 2
    c12["approval"]["status"] = "emergency_exception_pending_ack"
    c12["approval"]["slaStatus"] = "emergency_exempt"
    c12["approval"]["deferredItems"] = list(CK_CODES)
    c12["approval"]["emergencyException"] = {
        "emergencyReasonNote": "Tắc ruột đại tràng quai kín dọa vỡ manh tràng đau phản ứng thành bụng HCP — chỉ định mổ cấp cứu khẩn giải áp & cắt đoạn Hartmann.",
        "verbalConsultRecord": {
            "contactedLeaderStaffId": CHIEF_STAFF_ID,
            "contactChannel": "phone",
            "contactedAt": ts_now,
        },
        "postOpFollowUpOwnerStaffId": ms12,
        "submittedByStaffId": ms12,
        "submittedAt": ts_now,
    }
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
        "comorbidities": {"confirmed": True, "values": ["hypertension"], "otherComorbidityNote": ""},
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
        "comorbidities": {"confirmed": True, "values": ["hypertension", "diabetes"], "otherComorbidityNote": ""},
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
        "comorbidities": {"confirmed": True, "values": ["none"], "otherComorbidityNote": ""},
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

    # Self-verify all routine submitted/preapproved/approved/held/reapproval cases against Gate 1+2 so 1-click BCN Approve ALWAYS succeeds!
    bcn_actor = {"staffId": CHIEF_STAFF_ID, "isAdmin": True, "role": "Trưởng khoa"}
    for sc in (c04, c06, c07, c08, c09, c10, c13, c14, c15):
        validate_routine_submit_gate(sc, bcn_actor, {"actingForMainSurgeonReason": "BCN_APPROVAL_CHECK"}, catalog, db, cfg)
    assert is_approval_green_tick_valid(c07) is True, "Sandbox SC-07 must satisfy 6-condition green tick predicate!"
    db["_nextSandboxSurgeryId"] = base_id + len(cases) + 4

    return cases
