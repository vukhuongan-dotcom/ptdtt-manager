#!/usr/bin/env python3
"""
Flask Route Handlers for Robotic Surgery Coordination Module v2 (FEAT-243).
Implements the 5-step clinical coordination workflow:
  Step 1: Ward doctors submit lab-ready surgical consults with wardRoom + creator attribution.
  Step 2: Coordinators (vcnguyen, lvhoan) schedule TS. Nguyễn Phú Hữu consult (Date + Sáng/Chiều).
  Step 3: TS. Hữu (or authorized proxy) decides:
          - Robot surgery (Date + Ca 1–Ca 3, max 3/day) -> atomic sync to Weekly Schedule + A5 P.CTXH
          - Laparoscopic surgery (Date + attending surgeon + type) -> atomic 2-way sync (no Robot slot)
          - Considering (re-schedule consult) / Declined surgery (with reason)
  Step 4: Ward doctors track outcomes & record discharge-wait with planned readmission date
          (preserving the booked surgical slot on Weekly Schedule) + 1-tap confirm readmit.
  Step 5: Server-issued Zero-PHI Dual-WAL notifications & idempotent v2 data migration.
"""

import copy
import fcntl
import json
import os
import re
from datetime import datetime, timezone

from flask import jsonify, request

from surgery_approval_engine import (
    APPROVAL_METADATA_FIELDS_TO_STRIP,
    CHIEF_STAFF_ID,
    DEFAULT_ROBOT_CONFIG,
    ROBOT_POSTPONE_REASONS,
    ROBOT_REFUSAL_REASONS,
    ROBOT_SLOT_HOLDING_STATUSES,
    ROBOT_VALID_SLOTS,
    ROBOT_WARD_ROOMS,
    TRAINEE_STAFF_IDS,
    ApprovalEngineError,
    allocate_next_surgery_id,
    apply_tier_a_and_schedule_invalidation,
    build_robot_handoff_notifications,
    build_robot_surgery_payload,
    can_user_access_sandbox,
    check_robot_slot_conflicts_in_lock,
    format_doctor_full_name,
    get_approval_config,
    get_robot_config,
    initialize_new_surgery_record,
    is_pos_int,
    is_strict_int,
    is_valid_iso_date,
    load_procedure_catalog,
    mask_phone_vn,
    normalize_phone_vn,
    now_vn,
    now_vn_iso,
    parse_iso_dt,
    reconcile_dual_journals_and_db,
    resolve_live_user_fail_closed,
    resolve_robot_permissions,
    resolve_staff_name_by_id,
    serialize_robot_case_for_user,
    stamp_badge_fields,
)

ROBOT_ALL_STATUSES = {
    "cho_xep_tu_van",
    "da_xep_tu_van",
    "can_nhac",
    "da_xep_robot",
    "da_xep_noisoi",
    "khong_dong_y_mo",
    "hoan_mo",
    "da_mo",
    "da_xoa",
    "archived_deleted",
}

ROBOT_LEGACY_STATUSES = {
    "tu_van",
    "cho_xep_lich",
    "cho_duyet_tien_phau",
    "cho_duyet_luu_vien",
    "cho_mo",
    "xuat_vien_cho",
    "tu_choi",
}

ROBOT_ACTIVE_SCHEDULE_STATUSES = {"da_xep_robot", "da_xep_noisoi"}
ROBOT_INPATIENT_STATES = {"noi_tru", "xuat_vien_cho", "da_nhap_lai"}
ROBOT_VALID_CONSULT_SESSIONS = ("sang", "chieu")
ROBOT_INDICATION_TYPES = ("robot_hoac_noisoi", "uu_tien_robot", "uu_tien_noisoi")
ROBOT_ADMISSION_SOURCES = ("", "cap_cuu", "phong_kham")
ROBOT_ADMITTING_DOCTOR_TYPES = ("", "staff", "external", "manual")

_HHMM_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


def _atomic_write_json(path: str, payload: dict):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as wf:
        json.dump(payload, wf, ensure_ascii=False, indent=2)
        wf.flush()
        os.fsync(wf.fileno())
    os.replace(tmp, path)


def _today_vn_iso() -> str:
    return now_vn().strftime("%Y-%m-%d")


def _fmt_vi_date(iso_str: str) -> str:
    s = str(iso_str or "").strip()
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return f"{s[8:10]}/{s[5:7]}/{s[0:4]}"
    return s or "—"


def _is_robot_surgery(rec: dict) -> bool:
    return isinstance(rec, dict) and (rec.get("approachType") == "robot" or rec.get("surgeryType") == "robot")


def _robot_code_of(rcase: dict) -> str:
    if not isinstance(rcase, dict):
        return ""
    return str(rcase.get("robotCaseCode") or rcase.get("soNV") or "").strip()


def _staff_display_name(db: dict, staff_id, fallback: str = "") -> str:
    if is_pos_int(staff_id):
        sid = int(staff_id)
        for st in (db.get("staff") or []) + (db.get("departedStaff") or []):
            if isinstance(st, dict) and st.get("id") == sid:
                return format_doctor_full_name(st) or str(st.get("name") or "")
    return str(fallback or "").strip()


def _room_label(ward_room: str) -> str:
    wr = str(ward_room or "").strip()
    if not wr:
        return "Chưa rõ phòng"
    if wr == "ngoai_tru":
        return "Ngoại trú"
    return f"Phòng {wr}" if wr.startswith("B") else f"Phòng B{wr}"


def _normalize_ward_room(raw_room, *, required: bool = False) -> str:
    val = str(raw_room or "").strip()
    if not val:
        if required:
            raise ApprovalEngineError(422, "WARD_ROOM_REQUIRED", "Vui lòng chọn Phòng bệnh (B705–B719) hoặc Ngoại trú.")
        return ""
    low = val.lower()
    if low in ("ngoai_tru", "ngoại trú", "ngoai tru"):
        return "ngoai_tru"
    up = val.upper()
    if up in ROBOT_WARD_ROOMS:
        return up
    if f"B{up}" in ROBOT_WARD_ROOMS:
        return f"B{up}"
    raise ApprovalEngineError(
        422,
        "INVALID_WARD_ROOM",
        f"Phòng bệnh phải thuộc khoa ({', '.join(ROBOT_WARD_ROOMS)}).",
    )


def _format_external_doctor_name(ext: dict) -> str:
    name = str(ext.get("name") or "").strip()
    title = str(ext.get("title") or "").strip().rstrip(".")
    if not title:
        return name
    if not name:
        return title
    return f"{title}. {name}"


def _is_eligible_internal_admitting_doctor(st: dict, today_str: str) -> bool:
    if not isinstance(st, dict) or not is_pos_int(st.get("id")):
        return False
    if int(st["id"]) in TRAINEE_STAFF_IDS:
        return False
    if str(st.get("status") or "active").strip().lower() == "inactive":
        return False
    start_d = str(st.get("startDate") or "").strip()
    if start_d and is_valid_iso_date(start_d) and start_d > today_str:
        return False
    role_lc = str(st.get("role") or "").strip().lower()
    if any(bad in role_lc for bad in ("điều dưỡng", "hộ lý", "thư ký", "học viên", "nội trú")):
        return False
    return (
        "bác sĩ chính" in role_lc
        or "bs chính" in role_lc
        or "bs trưởng khoa" in role_lc
        or "bs phó trưởng khoa" in role_lc
    )


def _build_admitting_doctors_catalog(db: dict, today_str: str) -> dict:
    raw_internal = [
        st for st in (db.get("staff") or [])
        if _is_eligible_internal_admitting_doctor(st, today_str)
    ]
    last_counts = {}
    for st in raw_internal:
        parts = [p for p in str(st.get("name") or "").strip().split() if p]
        if parts:
            lw = parts[-1].lower()
            last_counts[lw] = last_counts.get(lw, 0) + 1

    internal = []
    for st in raw_internal:
        sid = int(st["id"])
        name = str(st.get("name") or "").strip()
        title = str(st.get("title") or "").strip()
        role = str(st.get("role") or "").strip()
        parts = [p for p in name.split() if p]
        if sid == CHIEF_STAFF_ID:
            short_name = f"TS. {parts[-1]}" if parts else "TS. Hữu"
        elif parts and (len(parts) >= 2 and (sid in (7, 12) or last_counts.get(parts[-1].lower(), 0) > 1)):
            short_name = f"BS. {' '.join(parts[-2:])}"
        elif parts:
            short_name = f"BS. {parts[-1]}"
        else:
            short_name = name
        internal.append({
            "id": sid,
            "name": name,
            "title": title,
            "fullName": format_doctor_full_name(st) or name,
            "shortName": short_name,
            "role": role,
            "group": "internal",
        })

    external = []
    for d in (db.get("externalDoctors") or []):
        if not isinstance(d, dict) or not is_pos_int(d.get("id")):
            continue
        name = str(d.get("name") or "").strip()
        if not name:
            continue
        title = str(d.get("title") or "").strip()
        external.append({
            "id": int(d["id"]),
            "name": name,
            "title": title,
            "fullName": _format_external_doctor_name(d),
            "department": str(d.get("department") or "").strip(),
            "position": str(d.get("position") or "").strip(),
            "group": "external",
        })
    return {"internal": internal, "external": external}


def _normalize_admission_source_and_doctor(db: dict, body: dict, *, existing_case: dict = None) -> dict:
    raw_src = body["admissionSource"] if "admissionSource" in body else (existing_case or {}).get("admissionSource", "")
    src = str(raw_src or "").strip().lower()
    if src not in ROBOT_ADMISSION_SOURCES:
        raise ApprovalEngineError(
            422,
            "INVALID_ADMISSION_SOURCE",
            "Nguồn bệnh nhân phải là Cấp cứu (cap_cuu), Phòng khám (phong_kham) hoặc để trống.",
        )
    if src != "phong_kham":
        return {
            "admissionSource": src,
            "admittingDoctorType": "",
            "admittingDoctorId": None,
            "admittingDoctorName": "",
        }

    has_doc_keys = any(k in body for k in ("admittingDoctorType", "admittingDoctorId", "admittingDoctorName"))
    if not has_doc_keys and isinstance(existing_case, dict) and existing_case.get("admissionSource") == "phong_kham":
        return {
            "admissionSource": "phong_kham",
            "admittingDoctorType": str(existing_case.get("admittingDoctorType") or "").strip(),
            "admittingDoctorId": existing_case.get("admittingDoctorId"),
            "admittingDoctorName": str(existing_case.get("admittingDoctorName") or "").strip(),
        }

    dtype = str(body.get("admittingDoctorType") or "").strip().lower()
    raw_did = body.get("admittingDoctorId")
    dname = str(body.get("admittingDoctorName") or "").strip()

    if dtype not in ROBOT_ADMITTING_DOCTOR_TYPES:
        raise ApprovalEngineError(422, "INVALID_ADMITTING_DOCTOR_TYPE", "Loại bác sĩ cho nhập không hợp lệ.")
    if dtype == "" and dname:
        dtype = "manual"
    if dtype == "" and raw_did not in ("", None):
        raise ApprovalEngineError(422, "INVALID_ADMITTING_DOCTOR_TYPE", "Vui lòng chọn nhóm Bác sĩ cho nhập hợp lệ.")

    if dtype == "staff":
        if not is_pos_int(raw_did):
            raise ApprovalEngineError(422, "INVALID_ADMITTING_DOCTOR", "Mã Bác sĩ chính cho nhập không hợp lệ.")
        sid = int(raw_did)
        today_str = _today_vn_iso()
        st = next((x for x in (db.get("staff") or []) if isinstance(x, dict) and x.get("id") == sid), None)
        if not st or not _is_eligible_internal_admitting_doctor(st, today_str):
            raise ApprovalEngineError(
                422,
                "INVALID_ADMITTING_DOCTOR",
                "Bác sĩ cho nhập không thuộc danh sách Bác sĩ chính trong khoa.",
            )
        return {
            "admissionSource": "phong_kham",
            "admittingDoctorType": "staff",
            "admittingDoctorId": sid,
            "admittingDoctorName": format_doctor_full_name(st) or str(st.get("name") or "").strip(),
        }

    if dtype == "external":
        if not is_pos_int(raw_did):
            raise ApprovalEngineError(422, "INVALID_ADMITTING_DOCTOR", "Mã Bác sĩ ngoài khoa không hợp lệ.")
        eid = int(raw_did)
        ext = next((x for x in (db.get("externalDoctors") or []) if isinstance(x, dict) and x.get("id") == eid), None)
        if not ext or not str(ext.get("name") or "").strip():
            raise ApprovalEngineError(
                422,
                "INVALID_ADMITTING_DOCTOR",
                "Không tìm thấy Bác sĩ ngoài khoa trong danh sách Nhân sự.",
            )
        return {
            "admissionSource": "phong_kham",
            "admittingDoctorType": "external",
            "admittingDoctorId": eid,
            "admittingDoctorName": _format_external_doctor_name(ext),
        }

    if dtype == "manual":
        if len(dname) < 2:
            raise ApprovalEngineError(
                422,
                "ADMITTING_DOCTOR_NAME_REQUIRED",
                "Vui lòng nhập tên Bác sĩ phòng khám cho nhập (tối thiểu 2 ký tự).",
            )
        if len(dname) > 120:
            raise ApprovalEngineError(422, "INVALID_ADMITTING_DOCTOR", "Tên Bác sĩ cho nhập tối đa 120 ký tự.")
        return {
            "admissionSource": "phong_kham",
            "admittingDoctorType": "manual",
            "admittingDoctorId": None,
            "admittingDoctorName": dname,
        }

    return {
        "admissionSource": "phong_kham",
        "admittingDoctorType": "",
        "admittingDoctorId": None,
        "admittingDoctorName": "",
    }


def _coordinator_staff_ids(db: dict, sf_mod=None) -> list:
    cfg = get_robot_config(db)
    coord_unames = {str(x or "").strip().lower() for x in (cfg.get("coordinators") or []) if str(x or "").strip()}
    out = []
    if sf_mod is not None and hasattr(sf_mod, "_load_auth"):
        users = (sf_mod._load_auth() or {}).get("users") or {}
        for uname in sorted(coord_unames):
            uobj = users.get(uname)
            if isinstance(uobj, dict) and uobj.get("disabled") is not True and is_pos_int(uobj.get("staffId")):
                sid = int(uobj["staffId"])
                if sid not in out:
                    out.append(sid)
    # Fallback well-known coordinators (vcnguyen=6, lvhoan=11) if auth lookup unavailable
    if not out:
        for default_u, default_id in (("vcnguyen", 6), ("lvhoan", 11)):
            if default_u in coord_unames and default_id not in out:
                out.append(default_id)
    return out


def _extended_robot_permissions(real_user: dict, db: dict) -> dict:
    perms = resolve_robot_permissions(real_user, db)
    can_manage = bool(perms.get("canManageRobot"))
    is_bcn = bool(perms.get("isBcn"))
    return {
        **perms,
        "canCreateConsult": bool(perms.get("canCreate")),
        "canDirectCreateCase": can_manage,
        "canLinkExistingSurgery": can_manage,
        "canSoftDelete": can_manage,
        "canArchiveDeleted": can_manage,
        "canConfigureCoordinators": is_bcn,
        "canAccessSandbox": can_user_access_sandbox(real_user, db),
        "canPrintPctxh": True,
    }


def _mask_conflict_list(conflicts: list, perms: dict) -> list:
    if not isinstance(conflicts, list):
        return []
    out = []
    can_phone = bool((perms or {}).get("canViewFullPhone"))
    for c in conflicts:
        if not isinstance(c, dict):
            continue
        item = copy.deepcopy(c)
        if "phone" in item and not can_phone:
            item["phone"] = mask_phone_vn(item.get("phone") or "")
            item["phoneMasked"] = bool(item.get("phone"))
        out.append(item)
    return out


def _mask_robot_response_payload(payload: dict, real_user: dict, db: dict) -> dict:
    if not isinstance(payload, dict):
        return payload
    perms = _extended_robot_permissions(real_user, db)
    out = copy.deepcopy(payload)
    if isinstance(out.get("case"), dict):
        out["case"] = serialize_robot_case_for_user(out["case"], real_user, db)
    if isinstance(out.get("serverCase"), dict):
        out["serverCase"] = serialize_robot_case_for_user(out["serverCase"], real_user, db)
    if isinstance(out.get("cases"), list):
        out["cases"] = [serialize_robot_case_for_user(c, real_user, db) for c in out["cases"] if isinstance(c, dict)]
    if isinstance(out.get("conflicts"), list):
        out["conflicts"] = _mask_conflict_list(out["conflicts"], perms)
    if isinstance(out.get("permissions"), dict):
        out["permissions"] = perms
    return out


def _validate_allowed_fields(body: dict, allowed: set):
    ignore = {"_clientBuild"}
    extra = sorted(k for k in body.keys() if k not in allowed and k not in ignore)
    if extra:
        raise ApprovalEngineError(
            422,
            "DISALLOWED_FIELDS",
            f"Yêu cầu chứa trường không được phép cho thao tác này: {', '.join(extra)}.",
            {"disallowedFields": extra},
        )


def _find_robot_case(db: dict, robot_code: str):
    code_norm = str(robot_code or "").strip()
    for rc in (db.get("robotCases") or []):
        if isinstance(rc, dict) and _robot_code_of(rc) == code_norm:
            return rc
    return None


def _next_robot_code(db: dict, is_sandbox: bool = False) -> str:
    yr = now_vn().strftime("%Y")
    prefix = f"RBSBX-{yr}-" if is_sandbox else f"RB-{yr}-"
    max_seq = 0
    for rc in (db.get("robotCases") or []):
        if not isinstance(rc, dict):
            continue
        code = _robot_code_of(rc)
        if code.startswith(prefix):
            tail = code[len(prefix):]
            if tail.isdigit():
                max_seq = max(max_seq, int(tail))
    key_name = "robotCasesSandbox" if is_sandbox else "robotCases"
    next_ids = db.setdefault("nextIds", {})
    raw_next = next_ids.get(key_name, 1)
    cur_next = int(raw_next) if is_pos_int(raw_next) else 1
    seq = max(cur_next, max_seq + 1)
    next_ids[key_name] = seq + 1
    return f"{prefix}{seq:04d}"


def _enforce_case_occ(rcase: dict, body: dict, real_user: dict, db: dict):
    cur_rev = int(rcase.get("caseRevision", 1) or 1)
    exp_rev = body.get("expectedRevision")
    if not is_strict_int(exp_rev):
        raise ApprovalEngineError(
            422,
            "EXPECTED_REVISION_REQUIRED",
            "Thiếu số phiên bản hồ sơ hợp lệ (expectedRevision).",
            {"currentRevision": cur_rev},
        )
    if int(exp_rev) != cur_rev:
        raise ApprovalEngineError(
            409,
            "CASE_REVISION_MISMATCH",
            "Hồ sơ Robot vừa được cập nhật ở phiên hoặc tab khác. Vui lòng tải lại dữ liệu mới nhất.",
            {
                "currentRevision": cur_rev,
                "expectedRevision": int(exp_rev),
                "serverCase": serialize_robot_case_for_user(rcase, real_user, db),
            },
        )
    return cur_rev


def _validate_birth_year(raw_val) -> object:
    if raw_val in ("", None):
        return ""
    if isinstance(raw_val, bool):
        raise ApprovalEngineError(422, "INVALID_BIRTH_YEAR", "Năm sinh phải là số nguyên từ 1900 đến hiện tại.")
    try:
        yr = int(str(raw_val).strip())
    except (ValueError, TypeError):
        raise ApprovalEngineError(422, "INVALID_BIRTH_YEAR", "Năm sinh phải là số nguyên từ 1900 đến hiện tại.")
    max_yr = now_vn().year + 1
    if yr < 1900 or yr > max_yr:
        raise ApprovalEngineError(422, "INVALID_BIRTH_YEAR", f"Năm sinh phải nằm trong khoảng 1900–{max_yr}.")
    return yr


def _validate_gender(raw_gender) -> str:
    txt = str(raw_gender or "").strip()
    if txt in ("", "Nam", "Nữ"):
        return txt
    raise ApprovalEngineError(422, "INVALID_GENDER", "Giới tính chỉ chấp nhận 'Nam', 'Nữ' hoặc để trống.")


def _validate_surgeon_id(db: dict, raw_sid, *, required: bool = False) -> tuple:
    if raw_sid in ("", None):
        if required:
            raise ApprovalEngineError(422, "SURGEON_REQUIRED", "Vui lòng chọn Phẫu thuật viên chính.")
        return None, ""
    if not is_pos_int(raw_sid):
        raise ApprovalEngineError(422, "INVALID_SURGEON", "Mã Phẫu thuật viên chính không hợp lệ.")
    sid = int(raw_sid)
    if sid in TRAINEE_STAFF_IDS:
        raise ApprovalEngineError(422, "INVALID_MAIN_SURGEON", "Bác sĩ học viên / Bác sĩ nội trú chưa xếp cột không được đứng tên BS mổ chính.")
    name = resolve_staff_name_by_id(db, sid)
    if not name:
        raise ApprovalEngineError(422, "INVALID_SURGEON", "Không tìm thấy Phẫu thuật viên trong danh sách nhân sự khoa.")
    return sid, name


def _validate_assist_surgeon(db: dict, raw_sid):
    if raw_sid in ("", None):
        return None
    if not is_pos_int(raw_sid):
        raise ApprovalEngineError(422, "INVALID_ASSISTANT_SURGEON", "Mã BS phụ mổ 1 không hợp lệ.")
    sid = int(raw_sid)
    if not resolve_staff_name_by_id(db, sid):
        raise ApprovalEngineError(422, "INVALID_ASSISTANT_SURGEON", "Không tìm thấy BS phụ mổ 1 trong danh sách nhân sự khoa.")
    return sid


def _validate_expected_timeframe(raw_val) -> str:
    val = str(raw_val or "").strip()
    if not val:
        return ""
    if not is_valid_iso_date(val):
        raise ApprovalEngineError(
            422,
            "INVALID_EXPECTED_DATE",
            "Ngày dự kiến phải chọn trên lịch hợp lệ (YYYY-MM-DD).",
        )
    return val


def _validate_schedule_fields(
    body: dict,
    db: dict,
    *,
    existing_case: dict = None,
    require_date_slot: bool = True,
    allow_past_date: bool = False,
    approach: str = "robot",
) -> dict:
    cfg = get_robot_config(db)
    s_date = str(body["surgeryDate"] if "surgeryDate" in body else (existing_case or {}).get("surgeryDate") or "").strip()
    s_slot = str(body["caseSlot"] if "caseSlot" in body else (existing_case or {}).get("caseSlot") or "").strip()
    s_room = str(
        body["operatingRoom"]
        if "operatingRoom" in body
        else (existing_case or {}).get("operatingRoom") or cfg.get("defaultOperatingRoom") or "PM Robot"
    ).strip() or "PM Robot"
    s_time = str(body["surgeryTime"] if "surgeryTime" in body else (existing_case or {}).get("surgeryTime") or "").strip()
    default_dur = 120 if approach == "noisoi" else (cfg.get("defaultDurationMinutes") or 180)
    raw_dur = body["durationMinutes"] if "durationMinutes" in body else (existing_case or {}).get("durationMinutes") or default_dur

    if approach == "robot":
        if require_date_slot and (not s_date or not s_slot):
            raise ApprovalEngineError(422, "SCHEDULE_DATE_SLOT_REQUIRED", "Vui lòng chọn đầy đủ Ngày mổ dự kiến và Ca mổ (Ca 1–Ca 3, tối đa 3 ca/ngày).")
    else:
        if not s_date:
            raise ApprovalEngineError(422, "SURGERY_DATE_REQUIRED", "Vui lòng chọn Ngày mổ Nội soi dự kiến.")
        s_slot = ""
        s_room = ""

    if s_date:
        if not is_valid_iso_date(s_date):
            raise ApprovalEngineError(422, "INVALID_SURGERY_DATE", "Ngày mổ phải theo định dạng YYYY-MM-DD.")
        if not allow_past_date and s_date < _today_vn_iso():
            raise ApprovalEngineError(422, "SURGERY_DATE_IN_PAST", "Không thể xếp lịch mổ về ngày trong quá khứ.")
    if approach == "robot" and s_slot and s_slot not in ROBOT_VALID_SLOTS:
        raise ApprovalEngineError(422, "INVALID_CASE_SLOT", f"Ca mổ phải là một trong các giá trị: {', '.join(ROBOT_VALID_SLOTS)}.")
    if s_time and not _HHMM_RE.fullmatch(s_time):
        raise ApprovalEngineError(422, "INVALID_SURGERY_TIME", "Giờ mổ dự kiến phải đúng định dạng HH:MM (24 giờ).")
    if isinstance(raw_dur, bool):
        raise ApprovalEngineError(422, "INVALID_DURATION", "Thời lượng mổ dự kiến phải là số phút dương.")
    try:
        dur_int = int(raw_dur)
    except (ValueError, TypeError):
        raise ApprovalEngineError(422, "INVALID_DURATION", "Thời lượng mổ dự kiến phải là số phút hợp lệ.")
    if dur_int < 15 or dur_int > 900:
        raise ApprovalEngineError(422, "INVALID_DURATION", "Thời lượng mổ dự kiến phải trong khoảng 15–900 phút.")

    if approach == "robot":
        valid_rooms = list(cfg.get("robotRooms") or ["PM Robot"])
        if s_room not in valid_rooms:
            raise ApprovalEngineError(422, "INVALID_OPERATING_ROOM", f"Phòng mổ Robot hợp lệ gồm: {', '.join(valid_rooms)}.")

    return {
        "surgeryDate": s_date,
        "caseSlot": s_slot,
        "operatingRoom": s_room,
        "surgeryTime": s_time,
        "durationMinutes": dur_int,
    }


def _check_conflict_or_override(
    db: dict,
    *,
    candidate: dict,
    exclude_robot_code: str,
    exclude_surgery_id,
    body: dict,
    perms: dict,
):
    blocking, warnings, fp = check_robot_slot_conflicts_in_lock(
        db,
        candidate=candidate,
        exclude_robot_code=exclude_robot_code,
        exclude_surgery_id=exclude_surgery_id,
    )
    if not blocking:
        return None

    if any(c.get("conflictType") == "ROBOT_DAILY_CAPACITY_EXCEEDED" for c in blocking):
        raise ApprovalEngineError(
            409,
            "ROBOT_DAILY_CAPACITY_EXCEEDED",
            "Hệ thống Robot đã đạt công suất tối đa 3 ca/ngày. Vui lòng chọn ngày khác.",
            {
                "conflicts": _mask_conflict_list(blocking, perms),
                "warnings": warnings,
                "conflictFingerprint": fp,
                "canOverrideConflict": False,
            },
        )

    if body.get("confirmConflict") is True:
        if not perms.get("canOverrideConflict"):
            raise ApprovalEngineError(
                403,
                "CONFLICT_OVERRIDE_FORBIDDEN",
                "Chỉ Ban Chủ nhiệm hoặc Điều phối viên Robot mới có quyền xác nhận xếp trùng khung giờ.",
                {
                    "conflicts": _mask_conflict_list(blocking, perms),
                    "conflictFingerprint": fp,
                },
            )
        reason = str(body.get("conflictOverrideReason") or "").strip()
        if len(reason) < 5:
            raise ApprovalEngineError(
                422,
                "CONFLICT_OVERRIDE_REASON_REQUIRED",
                "Vui lòng nhập lý do xác nhận xếp trùng lịch (tối thiểu 5 ký tự).",
                {
                    "conflicts": _mask_conflict_list(blocking, perms),
                    "conflictFingerprint": fp,
                },
            )
        exp_fp = str(body.get("expectedConflictFingerprint") or "").strip()
        if not exp_fp or exp_fp != fp:
            raise ApprovalEngineError(
                409,
                "CONFLICT_FINGERPRINT_MISMATCH",
                "Tình trạng trùng lịch vừa thay đổi trong lúc bạn thao tác. Vui lòng kiểm tra lại danh sách ca trùng.",
                {
                    "conflicts": _mask_conflict_list(blocking, perms),
                    "conflictFingerprint": fp,
                },
            )
        return {
            "at": now_vn_iso(),
            "by": perms.get("username") or "",
            "reason": reason,
            "fingerprint": fp,
            "conflictsCount": len(blocking),
        }

    raise ApprovalEngineError(
        409,
        "SCHEDULE_SLOT_CONFLICT",
        "Khung giờ hoặc phòng mổ Robot / PTV chính đang có ca trùng lịch.",
        {
            "conflicts": _mask_conflict_list(blocking, perms),
            "warnings": warnings,
            "conflictFingerprint": fp,
            "canOverrideConflict": bool(perms.get("canOverrideConflict")),
        },
    )


def _ensure_single_active_surgery_invariant(db: dict, rcase: dict, active_sid: int):
    code = _robot_code_of(rcase)
    surgeries = db.setdefault("surgeries", [])
    trash = db.setdefault("surgeriesTrash", [])
    arch = db.setdefault("surgeriesArchivedInactive", [])

    found_idx = -1
    for i, s in enumerate(surgeries):
        if isinstance(s, dict) and s.get("id") == active_sid:
            found_idx = i
            break
    if found_idx < 0:
        raise ApprovalEngineError(500, "LINKED_SURGERY_INVARIANT_ERROR", "Không tìm thấy ca hoạt động sau khi đồng bộ.")

    kept_surgeries = []
    for s in surgeries:
        if isinstance(s, dict) and s.get("id") != active_sid and str(s.get("robotCaseId") or "").strip() == code:
            s_copy = copy.deepcopy(s)
            s_copy["archivedInactiveAt"] = now_vn_iso()
            s_copy["archivedReason"] = "duplicate_active_link_cleanup"
            arch.append(s_copy)
        else:
            kept_surgeries.append(s)
    db["surgeries"] = kept_surgeries
    db["surgeriesTrash"] = [t for t in trash if not (isinstance(t, dict) and t.get("id") == active_sid)]
    db["surgeriesArchivedInactive"] = [a for a in arch if not (isinstance(a, dict) and a.get("id") == active_sid)]


def _upsert_active_linked_surgery(
    db: dict,
    rcase: dict,
    *,
    catalog: dict,
    cfg: dict,
    actor_username: str,
    event_label: str,
) -> tuple:
    """
    Shared engine upsert when a case enters or updates while in `da_xep_robot` or `da_xep_noisoi`.
    NEVER grants `approval.status = 'approved'`.
    Returns (active_surgery_ref, linked_surgery_op_dict).
    """
    code = _robot_code_of(rcase)
    canon_sid = rcase.get("canonicalSurgeryId")
    surgeries = db.setdefault("surgeries", [])
    trash = db.setdefault("surgeriesTrash", [])
    arch = db.setdefault("surgeriesArchivedInactive", [])

    existing = None
    origin = None
    if is_pos_int(canon_sid):
        for s in surgeries:
            if isinstance(s, dict) and s.get("id") == int(canon_sid):
                existing = s
                origin = "surgeries"
                break
        if existing is None:
            for t in trash:
                if isinstance(t, dict) and t.get("id") == int(canon_sid):
                    existing = t
                    origin = "surgeriesTrash"
                    break
        if existing is None:
            for a in arch:
                if isinstance(a, dict) and a.get("id") == int(canon_sid):
                    existing = a
                    origin = "surgeriesArchivedInactive"
                    break

    if isinstance(existing, dict):
        old_snap = copy.deepcopy(existing)
        merged = build_robot_surgery_payload(rcase, existing_surgery=existing)
        for del_k in ("deletedAt", "deletedBy", "deletedReason", "archivedInactiveAt", "archivedInactiveBy", "archivedReason", "episodeSuperseded"):
            merged.pop(del_k, None)

        if cfg.get("sandboxOnlyMode") is True and merged.get("isTestSandboxCase") is not True:
            for k in APPROVAL_METADATA_FIELDS_TO_STRIP:
                merged.pop(k, None)
        else:
            apply_tier_a_and_schedule_invalidation(merged, old_snap, catalog, db, cfg)
            if origin != "surgeries" and (merged.get("approval") or {}).get("status") == "approved":
                merged["approval"]["status"] = "reapproval_required"
                merged["approval"]["approvedSnapshot"] = None
        if rcase.get("gender"):
            merged["gender"] = rcase["gender"]

        if origin == "surgeries":
            for idx, item in enumerate(surgeries):
                if isinstance(item, dict) and item.get("id") == merged["id"]:
                    surgeries[idx] = merged
                    break
        else:
            db["surgeriesTrash"] = [t for t in trash if not (isinstance(t, dict) and t.get("id") == merged["id"])]
            db["surgeriesArchivedInactive"] = [a for a in arch if not (isinstance(a, dict) and a.get("id") == merged["id"])]
            surgeries.append(merged)
        sid = int(merged["id"])
    else:
        sid = allocate_next_surgery_id(db)
        draft = build_robot_surgery_payload(rcase, existing_surgery=None)
        draft["id"] = sid
        saved_rc_id = draft.get("robotCaseId")
        saved_meta = copy.deepcopy(draft.get("robotSyncMeta"))
        merged = initialize_new_surgery_record(draft, catalog, db)
        merged["id"] = sid
        merged["robotCaseId"] = saved_rc_id
        merged["robotSyncMeta"] = saved_meta
        stamp_badge_fields(merged)
        surgeries.append(merged)

    _ensure_single_active_surgery_invariant(db, rcase, sid)
    rcase["canonicalSurgeryId"] = sid
    rcase["activeLinkedSurgeryId"] = sid
    rcase["linkState"] = "active"
    rcase.setdefault("linkedSurgeryHistory", []).append({
        "surgeryId": sid,
        "episodeId": int(rcase.get("episodeId", 1) or 1),
        "event": event_label,
        "at": now_vn_iso(),
        "by": actor_username,
    })
    revs = db.setdefault("_revisions", {})
    revs["surgeries"] = int(revs.get("surgeries", 1)) + 1
    revs["surgeriesTrash"] = int(revs.get("surgeriesTrash", 1)) + 1
    return merged, {"op": "upsert_active", "record": copy.deepcopy(merged)}


def _move_active_surgery_to_trash(
    db: dict,
    rcase: dict,
    *,
    actor_username: str,
    deleted_reason: str,
    event_label: str,
):
    code = _robot_code_of(rcase)
    surgeries = db.setdefault("surgeries", [])
    trash = db.setdefault("surgeriesTrash", [])
    target = None
    kept = []
    for s in surgeries:
        if not isinstance(s, dict):
            continue
        is_match = (
            (is_pos_int(rcase.get("activeLinkedSurgeryId")) and s.get("id") == rcase.get("activeLinkedSurgeryId"))
            or (is_pos_int(rcase.get("canonicalSurgeryId")) and s.get("id") == rcase.get("canonicalSurgeryId"))
            or (code and str(s.get("robotCaseId") or "").strip() == code)
        )
        if is_match and target is None:
            target = copy.deepcopy(s)
        elif not is_match:
            kept.append(s)

    rcase["activeLinkedSurgeryId"] = None
    if target is None:
        if is_pos_int(rcase.get("canonicalSurgeryId")):
            rcase["linkState"] = "trashed_link"
        return None

    target["deletedAt"] = now_vn_iso()
    target["deletedBy"] = actor_username
    target["deletedReason"] = deleted_reason
    target["robotCaseId"] = code
    sid = target.get("id")
    db["surgeries"] = kept
    db["surgeriesTrash"] = [t for t in trash if not (isinstance(t, dict) and t.get("id") == sid)]
    db["surgeriesTrash"].append(target)

    rcase["canonicalSurgeryId"] = sid
    rcase["linkState"] = "trashed_link"
    rcase.setdefault("linkedSurgeryHistory", []).append({
        "surgeryId": sid,
        "episodeId": int(rcase.get("episodeId", 1) or 1),
        "event": event_label,
        "reason": deleted_reason,
        "at": now_vn_iso(),
        "by": actor_username,
    })
    revs = db.setdefault("_revisions", {})
    revs["surgeries"] = int(revs.get("surgeries", 1)) + 1
    revs["surgeriesTrash"] = int(revs.get("surgeriesTrash", 1)) + 1
    return {"op": "move_to_trash", "record": copy.deepcopy(target)}


def _archive_linked_surgery_inactive(
    db: dict,
    rcase: dict,
    *,
    actor_username: str,
    reason: str,
    superseded: bool = False,
):
    code = _robot_code_of(rcase)
    canon_sid = rcase.get("canonicalSurgeryId")
    surgeries = db.setdefault("surgeries", [])
    trash = db.setdefault("surgeriesTrash", [])
    arch = db.setdefault("surgeriesArchivedInactive", [])

    found = None
    for s in surgeries:
        if isinstance(s, dict) and ((is_pos_int(canon_sid) and s.get("id") == canon_sid) or (code and str(s.get("robotCaseId") or "").strip() == code)):
            found = copy.deepcopy(s)
            break
    if found is None:
        for t in trash:
            if isinstance(t, dict) and ((is_pos_int(canon_sid) and t.get("id") == canon_sid) or (code and str(t.get("robotCaseId") or "").strip() == code)):
                found = copy.deepcopy(t)
                break

    if found is None:
        if superseded:
            rcase["episodeId"] = int(rcase.get("episodeId", 1) or 1) + 1
            rcase["canonicalSurgeryId"] = None
            rcase["activeLinkedSurgeryId"] = None
            rcase["linkState"] = "none"
        return None

    sid = found.get("id")
    found["archivedInactiveAt"] = now_vn_iso()
    found["archivedInactiveBy"] = actor_username
    found["archivedReason"] = reason
    if superseded:
        found["episodeSuperseded"] = True
    db["surgeries"] = [s for s in surgeries if not (isinstance(s, dict) and s.get("id") == sid)]
    db["surgeriesTrash"] = [t for t in trash if not (isinstance(t, dict) and t.get("id") == sid)]
    db["surgeriesArchivedInactive"] = [a for a in arch if not (isinstance(a, dict) and a.get("id") == sid)]
    db["surgeriesArchivedInactive"].append(found)

    rcase["activeLinkedSurgeryId"] = None
    rcase.setdefault("linkedSurgeryHistory", []).append({
        "surgeryId": sid,
        "episodeId": int(rcase.get("episodeId", 1) or 1),
        "event": "episode_superseded" if superseded else "archived_inactive",
        "at": now_vn_iso(),
        "by": actor_username,
    })
    if superseded:
        rcase["episodeId"] = int(rcase.get("episodeId", 1) or 1) + 1
        rcase["canonicalSurgeryId"] = None
        rcase["linkState"] = "none"
    else:
        rcase["linkState"] = "inactive_archived"

    revs = db.setdefault("_revisions", {})
    revs["surgeries"] = int(revs.get("surgeries", 1)) + 1
    revs["surgeriesTrash"] = int(revs.get("surgeriesTrash", 1)) + 1
    return {"op": "archive_inactive", "record": copy.deepcopy(found)}


def _build_wal_spec(
    *,
    action: str,
    rcase: dict,
    rev_before: int,
    rev_after: int,
    linked_ops: list = None,
    config_rec: dict = None,
    summary_extra: dict = None,
    record_ref: dict = None,
    committed_notifications: list = None,
) -> dict:
    code = _robot_code_of(rcase) if isinstance(rcase, dict) else None
    is_sbx = bool(rcase.get("isTestSandboxCase") is True) if isinstance(rcase, dict) else False
    patch = {"patchKind": "robot_tx"}
    if isinstance(rcase, dict):
        patch["robotCaseRecords"] = [copy.deepcopy(rcase)]
    if linked_ops:
        patch["linkedSurgeryOps"] = copy.deepcopy(linked_ops)
    if isinstance(config_rec, dict):
        patch["robotConfigRecord"] = copy.deepcopy(config_rec)
    summary = {
        "robotCaseCode": code,
        "statusAfter": rcase.get("status") if isinstance(rcase, dict) else None,
        "isTestSandboxCase": is_sbx,
        **(summary_extra or {}),
    }
    out = {
        "action": action,
        "surgeryId": rcase.get("canonicalSurgeryId") if isinstance(rcase, dict) else None,
        "caseRevBefore": rev_before,
        "caseRevAfter": rev_after,
        "summary": summary,
        "committedStatePatch": patch,
    }
    if isinstance(record_ref, dict):
        out["recordRef"] = record_ref
    if committed_notifications:
        out["committedNotifications"] = copy.deepcopy(committed_notifications)
    return out


def migrate_robot_cases_v2(db: dict, catalog: dict = None, cfg: dict = None, sf_mod=None) -> dict:
    """
    Idempotent v2 migration (FEAT-243):
      - Ensures default coordinators include vcnguyen and lvhoan (when present in auth/staff).
      - Maps legacy robotCases statuses to v2 5-step statuses (`cho_xep_tu_van`, `da_xep_robot`, `khong_dong_y_mo`).
      - Converts legacy `xuat_vien_cho` cases (`RB-2026-0001`, `RB-2026-0002`) into `da_xep_robot`
        with `inpatientState='xuat_vien_cho'` AND restores their linked surgeries from surgeriesTrash
        back to active `surgeries[]` so slots stay reserved & visible on Weekly Schedule.
    Returns dict {changedCases, linkedOps, configRecord, configChanged}.
    """
    changed_cases = []
    linked_ops = []
    config_changed = False
    now_iso = now_vn_iso()

    raw_cfg = (db or {}).get("robotConfig")
    rcfg = get_robot_config(db)
    raw_ver = int(raw_cfg.get("robotConfigSchemaVersion") or 1) if isinstance(raw_cfg, dict) else 0
    if raw_ver < 2:
        auth_users = ((sf_mod._load_auth() or {}).get("users") or {}) if (sf_mod and hasattr(sf_mod, "_load_auth")) else {}
        coords = list(rcfg.get("coordinators") or [])
        for req_u in ("vcnguyen", "lvhoan"):
            if req_u not in coords and (not auth_users or (isinstance(auth_users.get(req_u), dict) and auth_users[req_u].get("disabled") is not True)):
                coords.append(req_u)
        rcfg["coordinators"] = coords
        rcfg["robotConfigSchemaVersion"] = 2
        db["robotConfig"] = rcfg
        config_changed = True

    for rc in (db.get("robotCases") or []):
        if not isinstance(rc, dict):
            continue
        if rc.get("status") == "archived_deleted":
            continue
        cur_st = str(rc.get("status") or "").strip()
        needs_mig = int(rc.get("schemaVersion") or 1) < 2 or cur_st in ROBOT_LEGACY_STATUSES
        if not needs_mig:
            continue

        if cur_st in ("tu_van", "cho_xep_lich"):
            rc["status"] = "cho_xep_tu_van"
            rc["consultOutcome"] = "pending"
            rc["inpatientState"] = "noi_tru"
            rc["scheduledApproach"] = ""
        elif cur_st == "tu_choi":
            rc["status"] = "khong_dong_y_mo"
            rc["consultOutcome"] = "khong_mo"
            rc["refusalReason"] = rc.get("refusalReason") or "ly_do_khac"
            rc["inpatientState"] = "noi_tru"
            rc["scheduledApproach"] = ""
        elif cur_st in ("cho_duyet_tien_phau", "cho_duyet_luu_vien", "cho_mo"):
            rc["status"] = "da_xep_robot"
            rc["consultOutcome"] = "robot"
            rc["scheduledApproach"] = "robot"
            rc["scheduledSurgeryType"] = "robot"
            if rc.get("inpatientState") not in ROBOT_INPATIENT_STATES:
                rc["inpatientState"] = "noi_tru"
            if catalog is not None and cfg is not None and is_valid_iso_date(rc.get("surgeryDate")):
                _, s_op = _upsert_active_linked_surgery(
                    db,
                    rc,
                    catalog=catalog,
                    cfg=cfg,
                    actor_username="system:migrate_v2",
                    event_label="robot_migrate_v2_active",
                )
                linked_ops.append(s_op)
        elif cur_st == "xuat_vien_cho":
            rc["status"] = "da_xep_robot"
            rc["consultOutcome"] = "robot"
            rc["scheduledApproach"] = "robot"
            rc["scheduledSurgeryType"] = "robot"
            rc["inpatientState"] = "xuat_vien_cho"
            rc.setdefault("plannedReadmitDate", "")
            if catalog is not None and cfg is not None and is_valid_iso_date(rc.get("surgeryDate")):
                _, s_op = _upsert_active_linked_surgery(
                    db,
                    rc,
                    catalog=catalog,
                    cfg=cfg,
                    actor_username="system:migrate_v2",
                    event_label="robot_migrate_v2_restore_wait",
                )
                linked_ops.append(s_op)
        elif cur_st == "hoan_mo":
            rc.setdefault("consultOutcome", "robot")
            rc.setdefault("scheduledApproach", "robot")
            rc["inpatientState"] = "noi_tru"
        elif cur_st == "da_mo":
            rc.setdefault("consultOutcome", "robot")
            rc.setdefault("scheduledApproach", "robot")
            rc.setdefault("inpatientState", "noi_tru")
        elif cur_st == "can_nhac":
            rc["consultOutcome"] = "can_nhac"
            rc.setdefault("inpatientState", "noi_tru")

        if not rc.get("createdByName"):
            rc["createdByName"] = _staff_display_name(db, rc.get("createdByStaffId"), rc.get("createdByUsername") or "")
        rc.setdefault("labsReadyConfirmed", True)
        rc.setdefault("indicationType", "robot_hoac_noisoi")
        rc.setdefault("consultedByStaffId", CHIEF_STAFF_ID)
        rc.setdefault("consultedByName", _staff_display_name(db, CHIEF_STAFF_ID, "TS. BSCKII. Nguyễn Phú Hữu"))
        rc.setdefault("consultRound", 1)
        rc.setdefault("inpatientState", "noi_tru")
        rc["schemaVersion"] = 2
        rc["migratedV2At"] = now_iso
        rc["caseRevision"] = int(rc.get("caseRevision", 1) or 1) + 1
        rc["updatedAt"] = now_iso
        changed_cases.append(copy.deepcopy(rc))

    revs = db.setdefault("_revisions", {})
    if config_changed:
        revs["robotConfig"] = int(revs.get("robotConfig", 1)) + 1
    if changed_cases:
        revs["robotCases"] = int(revs.get("robotCases", 1)) + 1

    return {
        "changedCases": changed_cases,
        "linkedOps": linked_ops,
        "configRecord": copy.deepcopy(db.get("robotConfig")) if config_changed else None,
        "configChanged": config_changed,
    }


def _needs_lazy_rollover(db: dict, today_str: str) -> bool:
    raw_cfg = (db or {}).get("robotConfig")
    robot_cfg = get_robot_config(db)
    if not isinstance(raw_cfg, dict) or int(raw_cfg.get("robotConfigSchemaVersion") or 1) < 2:
        return True
    archive_days = int(robot_cfg.get("trashAutoArchiveDays") or 14)
    now_utc = datetime.now(timezone.utc)
    today_dt = datetime.strptime(today_str, "%Y-%m-%d").date() if is_valid_iso_date(today_str) else None
    existing_dedups = {
        n.get("dedupKey")
        for n in (db.get("notifications") or [])
        if isinstance(n, dict) and n.get("dedupKey")
    }

    for rc in (db.get("robotCases") or []):
        if not isinstance(rc, dict):
            continue
        st = rc.get("status")
        if st != "archived_deleted" and (int(rc.get("schemaVersion") or 1) < 2 or st in ROBOT_LEGACY_STATUSES):
            return True
        if st in ROBOT_ACTIVE_SCHEDULE_STATUSES and is_valid_iso_date(rc.get("surgeryDate")) and rc["surgeryDate"] < today_str:
            return True
        if (
            today_dt is not None
            and st in ROBOT_ACTIVE_SCHEDULE_STATUSES
            and rc.get("inpatientState") == "xuat_vien_cho"
            and is_valid_iso_date(rc.get("plannedReadmitDate"))
        ):
            r_dt = datetime.strptime(rc["plannedReadmitDate"], "%Y-%m-%d").date()
            diff_d = (r_dt - today_dt).days
            code = _robot_code_of(rc)
            if 0 <= diff_d <= 2 and f"readmit:{code}:{rc['plannedReadmitDate']}" not in existing_dedups:
                return True
        if st == "da_xoa":
            dt_del = parse_iso_dt(rc.get("deletedAt"))
            if dt_del is not None and (now_utc - dt_del).total_seconds() > archive_days * 86400:
                return True
    for item in (db.get("surgeriesTrash") or []):
        if isinstance(item, dict) and str(item.get("robotCaseId") or "").strip():
            dt_del = parse_iso_dt(item.get("deletedAt"))
            if dt_del is not None and (now_utc - dt_del).total_seconds() > archive_days * 86400:
                return True
    return False


def _build_lazy_rollover_tx(sf_mod):
    def _apply_lazy_rollover_tx(*, db: dict, body: dict, real_user: dict, actor: dict, catalog: dict, cfg: dict):
        today_str = str(body.get("todayVn") or _today_vn_iso())
        now_iso = now_vn_iso()
        now_utc = datetime.now(timezone.utc)
        robot_cfg = get_robot_config(db)
        archive_days = int(robot_cfg.get("trashAutoArchiveDays") or 14)

        mig = migrate_robot_cases_v2(db, catalog=catalog, cfg=cfg, sf_mod=sf_mod)
        rolled_cases = []
        linked_ops = list(mig["linkedOps"])
        changed_records = list(mig["changedCases"])
        emitted_notifs = []

        rc_by_code = {}
        for rc in (db.get("robotCases") or []):
            if isinstance(rc, dict) and _robot_code_of(rc):
                rc_by_code[_robot_code_of(rc)] = rc

        # 1. Auto-rollover scheduled Robot/Laparoscopic cases -> da_mo ONLY when surgeryDate < today_vn
        for rc in (db.get("robotCases") or []):
            if not isinstance(rc, dict):
                continue
            if rc.get("status") in ROBOT_ACTIVE_SCHEDULE_STATUSES and is_valid_iso_date(rc.get("surgeryDate")) and rc["surgeryDate"] < today_str:
                rc["status"] = "da_mo"
                rc["completionSource"] = "auto_date_rollover"
                rc["rolledOverAt"] = now_iso
                rc["caseRevision"] = int(rc.get("caseRevision", 1) or 1) + 1
                rc["updatedAt"] = now_iso
                rc["updatedBy"] = "system:auto_date_rollover"
                rolled_cases.append(_robot_code_of(rc))
                changed_records.append(copy.deepcopy(rc))

        # 2. Idempotent readmission reminders (0..2 days before plannedReadmitDate)
        today_dt = datetime.strptime(today_str, "%Y-%m-%d").date() if is_valid_iso_date(today_str) else None
        if today_dt is not None:
            coord_ids = _coordinator_staff_ids(db, sf_mod)
            for rc in (db.get("robotCases") or []):
                if not isinstance(rc, dict):
                    continue
                if rc.get("status") not in ROBOT_ACTIVE_SCHEDULE_STATUSES:
                    continue
                if rc.get("inpatientState") != "xuat_vien_cho":
                    continue
                p_date = str(rc.get("plannedReadmitDate") or "").strip()
                if not is_valid_iso_date(p_date):
                    continue
                r_dt = datetime.strptime(p_date, "%Y-%m-%d").date()
                diff_d = (r_dt - today_dt).days
                if 0 <= diff_d <= 2:
                    code = _robot_code_of(rc)
                    dkey = f"readmit:{code}:{p_date}"
                    targets = ([rc.get("createdByStaffId")] if is_pos_int(rc.get("createdByStaffId")) else []) + coord_ids
                    msg = f"Nhắc hẹn nhập viện lại ({_fmt_vi_date(p_date)}) chuẩn bị mổ {_fmt_vi_date(rc.get('surgeryDate'))} · {_room_label(rc.get('wardRoom'))} ({code})."
                    notes = build_robot_handoff_notifications(
                        db,
                        rc,
                        actor_staff_id=0,
                        event_id=dkey,
                        notif_type="robot_readmit_reminder",
                        message=msg,
                        recipient_staff_ids=targets,
                        dedup_key=dkey,
                        include_actor=True,
                    )
                    if notes:
                        emitted_notifs.extend(notes)

        if emitted_notifs:
            db.setdefault("notifications", []).extend(copy.deepcopy(emitted_notifs))
            revs_n = db.setdefault("_revisions", {})
            revs_n["notifications"] = int(revs_n.get("notifications", 1)) + 1

        # 3. Archive expired surgeriesTrash with robotCaseId & da_xoa robotCases (> trashAutoArchiveDays)
        trash = db.get("surgeriesTrash") or []
        kept_trash = []
        arch_list = db.setdefault("surgeriesArchivedInactive", [])
        arch_ids = {a.get("id") for a in arch_list if isinstance(a, dict) and is_pos_int(a.get("id"))}
        touched_trash = False
        for item in trash:
            if not isinstance(item, dict):
                continue
            rc_code = str(item.get("robotCaseId") or "").strip()
            if not rc_code:
                kept_trash.append(item)
                continue
            dt_del = parse_iso_dt(item.get("deletedAt"))
            if dt_del is not None and (now_utc - dt_del).total_seconds() > archive_days * 86400:
                arch_item = copy.deepcopy(item)
                arch_item["archivedInactiveAt"] = now_iso
                sid = arch_item.get("id")
                if is_pos_int(sid) and sid not in arch_ids:
                    arch_list.append(arch_item)
                    arch_ids.add(sid)
                linked_ops.append({"op": "archive_inactive", "record": arch_item})
                rc = rc_by_code.get(rc_code)
                if isinstance(rc, dict):
                    if rc.get("status") == "da_xoa":
                        rc["status"] = "archived_deleted"
                        rc["archivedAt"] = now_iso
                    if rc.get("canonicalSurgeryId") == sid:
                        rc["linkState"] = "inactive_archived"
                    rc["caseRevision"] = int(rc.get("caseRevision", 1) or 1) + 1
                    changed_records.append(copy.deepcopy(rc))
                touched_trash = True
            else:
                kept_trash.append(item)

        if touched_trash:
            db["surgeriesTrash"] = kept_trash

        for rc in (db.get("robotCases") or []):
            if isinstance(rc, dict) and rc.get("status") == "da_xoa":
                dt_del = parse_iso_dt(rc.get("deletedAt"))
                if dt_del is not None and (now_utc - dt_del).total_seconds() > archive_days * 86400:
                    rc["status"] = "archived_deleted"
                    rc["archivedAt"] = now_iso
                    rc["caseRevision"] = int(rc.get("caseRevision", 1) or 1) + 1
                    changed_records.append(copy.deepcopy(rc))

        if not changed_records and not linked_ops and not mig["configChanged"] and not emitted_notifs:
            return {
                "httpStatus": 200,
                "skipDbWrite": True,
                "response": {"ok": True, "rolledOverCodes": [], "archivedCount": 0, "migratedCount": 0},
                "wal": None,
            }

        revs = db.setdefault("_revisions", {})
        if changed_records:
            revs["robotCases"] = int(revs.get("robotCases", 1)) + 1
        if touched_trash:
            revs["surgeriesTrash"] = int(revs.get("surgeriesTrash", 1)) + 1

        dedup_rc = {}
        for rc in changed_records:
            dedup_rc[_robot_code_of(rc)] = rc
        rc_list = list(dedup_rc.values())

        return {
            "httpStatus": 200,
            "response": {
                "ok": True,
                "rolledOverCodes": rolled_cases,
                "archivedCount": len([x for x in linked_ops if x.get("op") == "archive_inactive"]),
                "migratedCount": len(mig["changedCases"]),
            },
            "wal": {
                "action": "robot_auto_rollover",
                "surgeryId": None,
                "caseRevBefore": None,
                "caseRevAfter": None,
                "summary": {
                    "rolledOverCodes": rolled_cases,
                    "migratedCount": len(mig["changedCases"]),
                    "reminderCount": len(emitted_notifs),
                    "isTestSandboxCase": False,
                },
                "committedStatePatch": {
                    "patchKind": "robot_tx",
                    "robotCaseRecords": rc_list,
                    "linkedSurgeryOps": linked_ops,
                    **({"robotConfigRecord": mig["configRecord"]} if mig["configRecord"] else {}),
                },
                **({"committedNotifications": copy.deepcopy(emitted_notifs)} if emitted_notifs else {}),
            },
        }
    return _apply_lazy_rollover_tx


def _validate_coordinator_usernames(sf_mod, db: dict, coordinators: list) -> tuple:
    auth = sf_mod._load_auth() or {}
    users = auth.get("users") or {}
    staff_ids = {s.get("id") for s in (db.get("staff") or []) if isinstance(s, dict) and is_pos_int(s.get("id"))}
    cleaned = []
    seen = set()
    invalid = []
    for raw_u in coordinators:
        u = str(raw_u or "").strip().lower()
        if not u or u in seen:
            continue
        u_obj = users.get(u)
        if not isinstance(u_obj, dict) or u_obj.get("disabled") is True:
            invalid.append(u)
            continue
        sid = u_obj.get("staffId")
        if is_pos_int(sid) and staff_ids and int(sid) not in staff_ids:
            invalid.append(u)
            continue
        seen.add(u)
        cleaned.append(u)
    return cleaned, invalid


def ensure_robot_bootstrapped(sf_mod) -> dict:
    """
    Safely initializes robotConfig, robotCases, surgeriesArchivedInactive, _revisions.robotCases,
    and runs idempotent v2 migration under _DB_LOCK_FILE without printing PHI.
    """
    os.makedirs(sf_mod.DATA_DIR, exist_ok=True)
    if not os.path.exists(sf_mod.DATA_FILE):
        _atomic_write_json(sf_mod.DATA_FILE, {})

    lock_fd = open(sf_mod._DB_LOCK_FILE, "a+")
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        with open(sf_mod.DATA_FILE, "r", encoding="utf-8") as rf:
            db = json.load(rf)

        journal_rep = reconcile_dual_journals_and_db(db, sf_mod.DATA_DIR)
        changed = journal_rep.get("replayedEvents", 0) > 0 or journal_rep.get("replayedAttributionEvents", 0) > 0

        if not isinstance(db.get("robotConfig"), dict):
            cfg = copy.deepcopy(DEFAULT_ROBOT_CONFIG)
            valid_coords, _ = _validate_coordinator_usernames(sf_mod, db, cfg["coordinators"])
            if valid_coords:
                cfg["coordinators"] = valid_coords
            db["robotConfig"] = cfg
            changed = True
        if not isinstance(db.get("robotCases"), list):
            db["robotCases"] = []
            changed = True
        if not isinstance(db.get("surgeriesArchivedInactive"), list):
            db["surgeriesArchivedInactive"] = []
            changed = True
        revs = db.setdefault("_revisions", {})
        if not is_pos_int(revs.get("robotCases")):
            revs["robotCases"] = 1
            changed = True

        catalog = load_procedure_catalog(sf_mod.DATA_DIR, sf_mod.BASE_DIR)
        ap_cfg = get_approval_config(db)
        mig = migrate_robot_cases_v2(db, catalog=catalog, cfg=ap_cfg, sf_mod=sf_mod)
        if mig["changedCases"] or mig["linkedOps"] or mig["configChanged"]:
            changed = True

        if changed:
            db["_lastModified"] = datetime.now().isoformat()
            _atomic_write_json(sf_mod.DATA_FILE, db)

        return {"bootstrapped": changed, "robotCasesCount": len(db.get("robotCases") or []), "migratedV2": len(mig["changedCases"])}
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        lock_fd.close()


def register_robot_schedule_routes(app, sf_mod):
    def _run_wal_tx(**kwargs):
        runner = app.extensions.get("ptdtt_run_domain_wal_tx")
        if not callable(runner):
            raise RuntimeError("ptdtt_run_domain_wal_tx is not registered; register_surgery_approval_routes must run first")
        kwargs.setdefault("enforce_canary_gate", False)
        return runner(**kwargs)

    lazy_rollover_handler = _build_lazy_rollover_tx(sf_mod)

    # ───────────────────────── Bootstrap & Read ─────────────────────────

    @app.route("/api/robot/bootstrap", methods=["GET"])
    def get_robot_bootstrap():
        os.makedirs(sf_mod.DATA_DIR, exist_ok=True)
        if not os.path.exists(sf_mod.DATA_FILE):
            _atomic_write_json(sf_mod.DATA_FILE, {})

        today_str = _today_vn_iso()

        lock_fd = open(sf_mod._DB_LOCK_FILE, "a+")
        need_rollover = False
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_EX)
            with open(sf_mod.DATA_FILE, "r", encoding="utf-8") as rf:
                db = json.load(rf)
            reconcile_dual_journals_and_db(db, sf_mod.DATA_DIR)
            resolve_live_user_fail_closed(
                request.headers.get("Authorization", ""),
                sf_mod._verify_jwt,
                sf_mod.AUTH_FILE,
                db,
                sf_mod._save_auth,
                http_method=request.method,
                request_path=request.path,
            )
            need_rollover = _needs_lazy_rollover(db, today_str)
        except ApprovalEngineError as e:
            return jsonify(e.to_dict()), e.status_code
        finally:
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
            lock_fd.close()

        if need_rollover:
            _run_wal_tx(
                action_key="robot_auto_rollover",
                enforce_canary_gate=False,
                require_build_header=False,
                body_override={"todayVn": today_str},
                handler_fn=lazy_rollover_handler,
            )

        lock_fd = open(sf_mod._DB_LOCK_FILE, "a+")
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_EX)
            with open(sf_mod.DATA_FILE, "r", encoding="utf-8") as rf:
                db = json.load(rf)
            reconcile_dual_journals_and_db(db, sf_mod.DATA_DIR)
            real_user = resolve_live_user_fail_closed(
                request.headers.get("Authorization", ""),
                sf_mod._verify_jwt,
                sf_mod.AUTH_FILE,
                db,
                sf_mod._save_auth,
                http_method=request.method,
                request_path=request.path,
            )

            perms = _extended_robot_permissions(real_user, db)
            allow_sbx = bool(perms.get("canAccessSandbox"))
            raw_cases = db.get("robotCases") or []
            visible_cases = []
            linked_sids = set()
            linked_codes = set()
            for rc in raw_cases:
                if not isinstance(rc, dict):
                    continue
                if rc.get("isTestSandboxCase") is not True:
                    if is_pos_int(rc.get("canonicalSurgeryId")):
                        linked_sids.add(int(rc["canonicalSurgeryId"]))
                    if is_pos_int(rc.get("activeLinkedSurgeryId")):
                        linked_sids.add(int(rc["activeLinkedSurgeryId"]))
                    if _robot_code_of(rc):
                        linked_codes.add(_robot_code_of(rc))
                if rc.get("status") == "archived_deleted":
                    continue
                if rc.get("isTestSandboxCase") is True and not allow_sbx:
                    continue
                visible_cases.append(serialize_robot_case_for_user(rc, real_user, db))

            historical_robot = []
            unlinked_future_robot = []
            for s in (db.get("surgeries") or []):
                if not _is_robot_surgery(s):
                    continue
                if s.get("isTestSandboxCase") is True:
                    continue
                sid = s.get("id")
                s_rc_code = str(s.get("robotCaseId") or "").strip()
                if (is_pos_int(sid) and int(sid) in linked_sids) or (s_rc_code and s_rc_code in linked_codes) or s_rc_code:
                    continue
                s_date = str(s.get("date") or "").strip()
                row = {
                    "id": sid,
                    "patientName": s.get("patientName") or "",
                    "birthYear": s.get("birthYear") or "",
                    "gender": s.get("gender") or "",
                    "admissionId": s.get("admissionId") or "",
                    "diagnosis": s.get("diagnosis") or "",
                    "method": s.get("method") or "",
                    "approachType": s.get("approachType") or "",
                    "surgeryType": s.get("surgeryType") or "",
                    "mainSurgeon": s.get("mainSurgeon"),
                    "mainSurgeonName": resolve_staff_name_by_id(db, s.get("mainSurgeon")),
                    "assistSurgeon1": s.get("assistSurgeon1"),
                    "date": s_date,
                    "surgeryTime": s.get("surgeryTime") or "",
                    "duration": s.get("duration") or 180,
                    "isFirstCase": bool(s.get("isFirstCase")),
                    "approvalStatus": ((s.get("approval") or {}).get("status") if isinstance(s.get("approval"), dict) else None),
                }
                if is_valid_iso_date(s_date) and s_date < today_str:
                    historical_robot.append(row)
                else:
                    unlinked_future_robot.append(row)

            surgeons = [
                {
                    "id": st.get("id"),
                    "name": st.get("name") or "",
                    "role": st.get("role") or "",
                    "title": st.get("title") or "",
                }
                for st in (db.get("staff") or [])
                if isinstance(st, dict)
                and is_pos_int(st.get("id"))
                and int(st["id"]) not in TRAINEE_STAFF_IDS
                and (
                    "bác sĩ" in str(st.get("role") or "").lower()
                    or "trưởng khoa" in str(st.get("role") or "").lower()
                    or "phó trưởng khoa" in str(st.get("role") or "").lower()
                )
            ]

            staff_accounts = []
            if perms.get("canConfigureCoordinators"):
                auth_data = sf_mod._load_auth() or {}
                users_map = auth_data.get("users") or {}
                coord_set = set(get_robot_config(db).get("coordinators") or [])
                for uname, uinfo in sorted(users_map.items()):
                    if not isinstance(uinfo, dict) or uinfo.get("disabled") is True:
                        continue
                    role_lc = str(uinfo.get("role") or "").lower()
                    if (
                        "bác sĩ" in role_lc
                        or "bs " in role_lc
                        or role_lc == "bs"
                        or "trưởng" in role_lc
                        or "phó" in role_lc
                        or uinfo.get("isAdmin")
                        or uinfo.get("isSuperAdmin")
                        or uname.lower() in coord_set
                    ):
                        staff_accounts.append({
                            "username": uname,
                            "name": uinfo.get("name") or "",
                            "title": uinfo.get("title") or "",
                            "role": uinfo.get("role") or "",
                            "staffId": uinfo.get("staffId") or 0,
                        })

            my_uname = perms["username"]
            my_cases = [c for c in visible_cases if c.get("createdByUsername") == my_uname and not c.get("isTestSandboxCase")]
            real_vis = [c for c in visible_cases if not c.get("isTestSandboxCase")]
            my_action_counts = {
                "needScheduleConsult": sum(1 for c in real_vis if c.get("status") in ("cho_xep_tu_van", "can_nhac")),
                "needDecideConsult": sum(1 for c in real_vis if c.get("status") == "da_xep_tu_van"),
                "myCasesDecided": sum(1 for c in my_cases if c.get("status") in ("da_xep_robot", "da_xep_noisoi", "khong_dong_y_mo", "can_nhac")),
                "upcomingReadmit": sum(1 for c in real_vis if c.get("status") in ROBOT_ACTIVE_SCHEDULE_STATUSES and c.get("inpatientState") == "xuat_vien_cho"),
            }

            return jsonify({
                "ok": True,
                "todayVn": today_str,
                "permissions": perms,
                "robotConfig": get_robot_config(db),
                "cases": visible_cases,
                "myActionCounts": my_action_counts,
                "historicalRobotSurgeries": historical_robot,
                "unlinkedFutureRobotSurgeries": unlinked_future_robot,
                "surgeons": surgeons,
                "admittingDoctors": _build_admitting_doctors_catalog(db, today_str),
                "staffAccounts": staff_accounts,
                "wardRooms": list(ROBOT_WARD_ROOMS),
                "refusalReasons": ROBOT_REFUSAL_REASONS,
                "postponeReasons": ROBOT_POSTPONE_REASONS,
                "validSlots": list(ROBOT_VALID_SLOTS),
                "robotCasesRevision": int((db.get("_revisions") or {}).get("robotCases", 1)),
                "configRevision": int((db.get("_revisions") or {}).get("robotConfig", 1)),
                "version": sf_mod._get_file_version(),
            }), 200
        except ApprovalEngineError as e:
            return jsonify(e.to_dict()), e.status_code
        finally:
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
            lock_fd.close()

    # ───────────────────────── Create Cases & Consults ─────────────────────────

    @app.route("/api/robot/cases", methods=["POST"])
    def create_robot_case():
        body_raw = request.get_json(force=True, silent=True) or {}
        action = str(body_raw.get("action") or "create_consult").strip()
        if action not in ("create_consult", "create_case"):
            return jsonify({"error": f"Hành động tạo ca không hợp lệ: {action}.", "code": "INVALID_ACTION"}), 422

        def _tx(*, db, body, real_user, actor, catalog, cfg):
            perms = _extended_robot_permissions(real_user, db)
            is_sbx = bool(body.get("isTestSandboxCase") is True)
            if is_sbx and not perms["canAccessSandbox"]:
                raise ApprovalEngineError(403, "SANDBOX_FORBIDDEN", "Chỉ Super Admin mới được phép tạo ca Robot giả lập [TEST].")

            common_fields = {
                "action",
                "patientName",
                "birthYear",
                "gender",
                "phone",
                "admissionId",
                "diagnosis",
                "robotProcedure",
                "mainSurgeonId",
                "assistSurgeon1",
                "wardRoom",
                "labsReadyConfirmed",
                "indicationType",
                "expectedTimeframe",
                "consultNote",
                "note",
                "isTestSandboxCase",
                "admissionSource",
                "admittingDoctorType",
                "admittingDoctorId",
                "admittingDoctorName",
            }
            sched_fields = {
                "surgeryDate",
                "caseSlot",
                "operatingRoom",
                "surgeryTime",
                "durationMinutes",
                "confirmConflict",
                "conflictOverrideReason",
                "expectedConflictFingerprint",
            }
            if action == "create_consult":
                if not perms["canCreateConsult"]:
                    raise ApprovalEngineError(403, "ROBOT_CONSULT_FORBIDDEN", "Chỉ Bác sĩ trong khoa mới có quyền gửi bệnh nhân tư vấn phẫu thuật.")
                _validate_allowed_fields(body, common_fields)
            else:
                if not perms["canDirectCreateCase"]:
                    raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm hoặc Điều phối viên Robot mới được tạo trực tiếp ca lịch mổ Robot.")
                _validate_allowed_fields(body, common_fields | sched_fields)

            patient_name = str(body.get("patientName") or "").strip()
            if not patient_name:
                raise ApprovalEngineError(422, "PATIENT_NAME_REQUIRED", "Vui lòng nhập họ tên bệnh nhân.")
            if is_sbx and "[test]" not in patient_name.lower():
                patient_name = f"[TEST] {patient_name}"

            ward_room = _normalize_ward_room(body.get("wardRoom"), required=(action == "create_consult"))
            labs_ok = body.get("labsReadyConfirmed")
            if action == "create_consult" and labs_ok is not True:
                raise ApprovalEngineError(422, "LABS_CONFIRMATION_REQUIRED", "Vui lòng xác nhận bệnh nhân đã đủ xét nghiệm tiền phẫu & có chỉ định PT Nội soi/Robot.")

            ind_type = str(body.get("indicationType") or "robot_hoac_noisoi").strip()
            if ind_type not in ROBOT_INDICATION_TYPES:
                ind_type = "robot_hoac_noisoi"

            birth_year = _validate_birth_year(body.get("birthYear"))
            gender = _validate_gender(body.get("gender"))
            phone = normalize_phone_vn(body.get("phone"), required=False)
            adm_source_info = _normalize_admission_source_and_doctor(db, body)
            admission_id = str(body.get("admissionId") or "").strip()
            diagnosis = str(body.get("diagnosis") or "").strip()
            robot_proc = str(body.get("robotProcedure") or "").strip()
            if action == "create_consult" and not diagnosis:
                raise ApprovalEngineError(422, "DIAGNOSIS_REQUIRED", "Vui lòng nhập chẩn đoán bệnh nhân.")

            raw_sid = body.get("mainSurgeonId")
            if action == "create_consult" and raw_sid in ("", None):
                raw_sid = CHIEF_STAFF_ID
            surgeon_id, surgeon_name = _validate_surgeon_id(db, raw_sid, required=True)
            assist1 = _validate_assist_surgeon(db, body.get("assistSurgeon1"))

            code = _next_robot_code(db, is_sandbox=is_sbx)
            now_iso = now_vn_iso()
            uname = perms["username"]
            creator_display = format_doctor_full_name(actor) or _staff_display_name(db, perms["staffId"], uname)
            chief_display = _staff_display_name(db, CHIEF_STAFF_ID, "TS. BSCKII. Nguyễn Phú Hữu")

            rcase = {
                "schemaVersion": 2,
                "robotCaseCode": code,
                "soNV": code,
                "status": "cho_xep_tu_van",
                "patientName": patient_name,
                "birthYear": birth_year,
                "gender": gender,
                "phone": phone,
                "admissionId": admission_id,
                "wardRoom": ward_room,
                "admissionSource": adm_source_info["admissionSource"],
                "admittingDoctorType": adm_source_info["admittingDoctorType"],
                "admittingDoctorId": adm_source_info["admittingDoctorId"],
                "admittingDoctorName": adm_source_info["admittingDoctorName"],
                "labsReadyConfirmed": bool(labs_ok is not False),
                "indicationType": ind_type,
                "diagnosis": diagnosis,
                "robotProcedure": robot_proc,
                "mainSurgeonId": surgeon_id,
                "mainSurgeonName": surgeon_name,
                "assistSurgeon1": assist1,
                "expectedTimeframe": _validate_expected_timeframe(body.get("expectedTimeframe")),
                "consultDate": "",
                "consultSession": "",
                "consultScheduledAt": None,
                "consultScheduledBy": None,
                "consultScheduledByName": "",
                "consultScheduleNote": "",
                "consultRound": 1,
                "consultOutcome": "pending",
                "consultedByStaffId": CHIEF_STAFF_ID,
                "consultedByName": chief_display,
                "consultDecidedAt": None,
                "consultDecidedByUsername": None,
                "consultDecidedByName": "",
                "refusalReason": "",
                "consultNote": str(body.get("consultNote") or "").strip(),
                "scheduledApproach": "",
                "scheduledSurgeryType": "",
                "surgeryDate": "",
                "caseSlot": "",
                "operatingRoom": get_robot_config(db).get("defaultOperatingRoom") or "PM Robot",
                "surgeryTime": "",
                "durationMinutes": int(get_robot_config(db).get("defaultDurationMinutes") or 180),
                "inpatientState": "noi_tru",
                "plannedReadmitDate": "",
                "note": str(body.get("note") or "").strip(),
                "canonicalSurgeryId": None,
                "activeLinkedSurgeryId": None,
                "episodeId": 1,
                "linkState": "none",
                "linkedSurgeryHistory": [],
                "caseRevision": 1,
                "isTestSandboxCase": is_sbx,
                "createdAt": now_iso,
                "createdByUsername": uname,
                "createdByStaffId": perms["staffId"],
                "createdByName": creator_display,
                "updatedAt": now_iso,
                "updatedBy": uname,
            }

            override_audit = None
            linked_ops = []
            rec_ref = None
            committed_notifs = []

            if action == "create_consult":
                coord_ids = _coordinator_staff_ids(db, sf_mod)
                msg = f"BN mới tại {_room_label(ward_room)} chờ xếp lịch tư vấn ({code}) — Người gửi: {creator_display}."
                committed_notifs = build_robot_handoff_notifications(
                    db,
                    rcase,
                    actor_staff_id=perms["staffId"],
                    event_id=f"rbt_req:{code}:v1",
                    notif_type="robot_consult_requested",
                    message=msg,
                    recipient_staff_ids=coord_ids,
                )
                if committed_notifs:
                    db.setdefault("notifications", []).extend(copy.deepcopy(committed_notifs))
                    db.setdefault("_revisions", {})["notifications"] = int(db.get("_revisions", {}).get("notifications", 1)) + 1
            else:
                sched = _validate_schedule_fields(body, db, require_date_slot=True, allow_past_date=False, approach="robot")
                rcase.update(sched)
                override_audit = _check_conflict_or_override(
                    db,
                    candidate=rcase,
                    exclude_robot_code=code,
                    exclude_surgery_id=None,
                    body=body,
                    perms=perms,
                )
                if override_audit:
                    rcase["conflictOverrideHistory"] = [override_audit]
                rcase["status"] = "da_xep_robot"
                rcase["consultOutcome"] = "robot"
                rcase["scheduledApproach"] = "robot"
                rcase["scheduledSurgeryType"] = "robot"
                rcase["consultDecidedAt"] = now_iso
                rcase["consultDecidedByUsername"] = uname
                rcase["consultDecidedByName"] = creator_display
                db.setdefault("robotCases", []).append(rcase)
                rec_ref, s_op = _upsert_active_linked_surgery(
                    db,
                    rcase,
                    catalog=catalog,
                    cfg=cfg,
                    actor_username=uname,
                    event_label="robot_direct_create",
                )
                linked_ops.append(s_op)

            if action == "create_consult":
                db.setdefault("robotCases", []).append(rcase)
            revs = db.setdefault("_revisions", {})
            revs["robotCases"] = int(revs.get("robotCases", 1)) + 1

            return {
                "httpStatus": 201,
                "response": {
                    "ok": True,
                    "case": copy.deepcopy(rcase),
                    "overrideAudit": override_audit,
                },
                "wal": _build_wal_spec(
                    action="robot_case_created",
                    rcase=rcase,
                    rev_before=0,
                    rev_after=1,
                    linked_ops=linked_ops,
                    summary_extra={"createAction": action},
                    record_ref=rec_ref,
                    committed_notifications=committed_notifs,
                ),
            }

        return _run_wal_tx(
            action_key=f"robot_{action}",
            response_post_serializer=_mask_robot_response_payload,
            handler_fn=_tx,
        )

    @app.route("/api/robot/cases/link-surgery", methods=["POST"])
    def link_existing_surgery_to_robot():
        def _tx(*, db, body, real_user, actor, catalog, cfg):
            perms = _extended_robot_permissions(real_user, db)
            if not perms["canLinkExistingSurgery"]:
                raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm hoặc Điều phối viên Robot mới có quyền liên kết ca mổ sẵn có.")

            _validate_allowed_fields(body, {"action", "surgeryId", "phone", "caseSlot", "operatingRoom", "wardRoom", "note", "expectedSurgeryRevision"})
            act = str(body.get("action") or "link_existing_surgery").strip()
            if act != "link_existing_surgery":
                raise ApprovalEngineError(422, "INVALID_ACTION", "Action phải là link_existing_surgery.")

            sid = body.get("surgeryId")
            if not is_pos_int(sid):
                raise ApprovalEngineError(422, "SURGERY_ID_REQUIRED", "Thiếu mã ca mổ hợp lệ (surgeryId).")
            sid = int(sid)

            surg = next((s for s in (db.get("surgeries") or []) if isinstance(s, dict) and s.get("id") == sid), None)
            if surg is None:
                raise ApprovalEngineError(404, "SURGERY_NOT_FOUND", f"Không tìm thấy ca mổ #{sid} trên Lịch mổ tuần hoạt động.")
            if not _is_robot_surgery(surg):
                raise ApprovalEngineError(422, "NOT_ROBOT_SURGERY", f"Ca mổ #{sid} không phải phẫu thuật Robot.")
            if surg.get("robotCaseId"):
                raise ApprovalEngineError(409, "SURGERY_ALREADY_LINKED", f"Ca mổ #{sid} đã liên kết với hồ sơ Robot {surg['robotCaseId']}.")
            if surg.get("isTestSandboxCase") is True and not perms["canAccessSandbox"]:
                raise ApprovalEngineError(403, "SANDBOX_FORBIDDEN", "Không có quyền liên kết ca sandbox.")

            if "expectedSurgeryRevision" in body and body.get("expectedSurgeryRevision") is not None:
                exp_srev = body.get("expectedSurgeryRevision")
                cur_srev = int(surg.get("caseRevision", 1) or 1)
                if not is_strict_int(exp_srev) or int(exp_srev) != cur_srev:
                    raise ApprovalEngineError(409, "SURGERY_REVISION_MISMATCH", "Ca mổ trên Lịch mổ tuần vừa thay đổi — vui lòng tải lại.")

            existing_link = next(
                (rc for rc in (db.get("robotCases") or []) if isinstance(rc, dict) and rc.get("canonicalSurgeryId") == sid),
                None,
            )
            if existing_link is not None:
                raise ApprovalEngineError(409, "SURGERY_ALREADY_LINKED", f"Ca mổ #{sid} đã tồn tại liên kết {_robot_code_of(existing_link)}.")

            phone = normalize_phone_vn(body.get("phone"), required=False)
            slot = str(body.get("caseSlot") or ("Ca 1" if surg.get("isFirstCase") else "Ca 2")).strip()
            if slot not in ROBOT_VALID_SLOTS:
                raise ApprovalEngineError(422, "INVALID_CASE_SLOT", "Ca mổ không hợp lệ (Ca 1–Ca 3, tối đa 3 ca/ngày).")
            room = str(body.get("operatingRoom") or get_robot_config(db).get("defaultOperatingRoom") or "PM Robot").strip()
            ward_room = _normalize_ward_room(body.get("wardRoom"), required=False)

            is_sbx = bool(surg.get("isTestSandboxCase") is True)
            code = _next_robot_code(db, is_sandbox=is_sbx)
            now_iso = now_vn_iso()
            uname = perms["username"]
            actor_name = format_doctor_full_name(actor) or _staff_display_name(db, perms["staffId"], uname)
            s_date = str(surg.get("date") or "").strip()
            today_str = _today_vn_iso()
            is_hist = bool(is_valid_iso_date(s_date) and s_date < today_str)

            rcase = {
                "schemaVersion": 2,
                "robotCaseCode": code,
                "soNV": code,
                "status": "da_mo" if is_hist else "da_xep_robot",
                "completionSource": "linked_historical" if is_hist else None,
                "patientName": str(surg.get("patientName") or "").strip(),
                "birthYear": surg.get("birthYear") if is_pos_int(surg.get("birthYear")) else "",
                "gender": str(surg.get("gender") or ""),
                "phone": phone,
                "admissionId": str(surg.get("admissionId") or "").strip(),
                "wardRoom": ward_room,
                "labsReadyConfirmed": True,
                "indicationType": "uu_tien_robot",
                "diagnosis": str(surg.get("diagnosis") or "").strip(),
                "robotProcedure": str(surg.get("method") or "").strip(),
                "mainSurgeonId": surg.get("mainSurgeon"),
                "mainSurgeonName": resolve_staff_name_by_id(db, surg.get("mainSurgeon")),
                "assistSurgeon1": surg.get("assistSurgeon1") if is_pos_int(surg.get("assistSurgeon1")) else None,
                "consultOutcome": "robot",
                "consultedByStaffId": CHIEF_STAFF_ID,
                "consultedByName": _staff_display_name(db, CHIEF_STAFF_ID, "TS. BSCKII. Nguyễn Phú Hữu"),
                "consultDecidedAt": now_iso,
                "consultDecidedByUsername": uname,
                "consultDecidedByName": actor_name,
                "scheduledApproach": "robot",
                "scheduledSurgeryType": "robot",
                "surgeryDate": s_date,
                "caseSlot": slot,
                "operatingRoom": room,
                "surgeryTime": str(surg.get("surgeryTime") or "").strip(),
                "durationMinutes": int(surg.get("duration") or 180),
                "inpatientState": "noi_tru",
                "plannedReadmitDate": "",
                "note": str(body.get("note") or "").strip(),
                "canonicalSurgeryId": sid,
                "activeLinkedSurgeryId": sid,
                "episodeId": 1,
                "linkState": "active",
                "linkedSurgeryHistory": [{
                    "surgeryId": sid,
                    "episodeId": 1,
                    "event": "link_existing_surgery",
                    "at": now_iso,
                    "by": uname,
                }],
                "caseRevision": 1,
                "isTestSandboxCase": is_sbx,
                "createdAt": now_iso,
                "createdByUsername": uname,
                "createdByStaffId": perms["staffId"],
                "createdByName": actor_name,
                "updatedAt": now_iso,
                "updatedBy": uname,
            }

            surg["robotCaseId"] = code
            surg["robotSyncMeta"] = {
                "scheduledApproach": "robot",
                "operatingRoom": room,
                "caseSlot": slot,
                "wardRoom": ward_room,
                "inpatientState": "noi_tru",
                "plannedReadmitDate": "",
                "consultOutcome": "robot",
                "createdByName": actor_name,
                "robotCaseRevision": 1,
                "syncedAt": now_iso,
            }

            db.setdefault("robotCases", []).append(rcase)
            revs = db.setdefault("_revisions", {})
            revs["robotCases"] = int(revs.get("robotCases", 1)) + 1
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1

            return {
                "httpStatus": 201,
                "response": {
                    "ok": True,
                    "case": copy.deepcopy(rcase),
                    "linkedSurgeryId": sid,
                },
                "wal": _build_wal_spec(
                    action="robot_linked_existing_surgery",
                    rcase=rcase,
                    rev_before=0,
                    rev_after=1,
                    linked_ops=[{"op": "upsert_active", "record": copy.deepcopy(surg)}],
                    summary_extra={"linkedSurgeryId": sid},
                ),
            }

        return _run_wal_tx(
            action_key="robot_link_existing_surgery",
            response_post_serializer=_mask_robot_response_payload,
            handler_fn=_tx,
        )

    # ───────────────────────── State Transitions & Edits ─────────────────────────

    @app.route("/api/robot/cases/<robot_code>", methods=["PATCH"])
    def update_robot_case(robot_code: str):
        body_raw = request.get_json(force=True, silent=True) or {}
        action = str(body_raw.get("action") or "").strip()

        def _tx(*, db, body, real_user, actor, catalog, cfg):
            perms = _extended_robot_permissions(real_user, db)
            rcase = _find_robot_case(db, robot_code)
            if rcase is None or rcase.get("status") == "archived_deleted":
                raise ApprovalEngineError(404, "ROBOT_CASE_NOT_FOUND", f"Không tìm thấy hồ sơ Robot {robot_code}.")
            if rcase.get("isTestSandboxCase") is True and not perms["canAccessSandbox"]:
                raise ApprovalEngineError(404, "ROBOT_CASE_NOT_FOUND", f"Không tìm thấy hồ sơ Robot {robot_code}.")

            if not action:
                raise ApprovalEngineError(422, "ACTION_REQUIRED", "Thiếu tham số action.")

            rev_before = _enforce_case_occ(rcase, body, real_user, db)
            cur_status = rcase.get("status")
            now_iso = now_vn_iso()
            uname = perms["username"]
            actor_name = format_doctor_full_name(actor) or _staff_display_name(db, perms["staffId"], uname)
            code = _robot_code_of(rcase)
            linked_ops = []
            rec_ref = None
            override_audit = None
            committed_notifs = []

            if action == "schedule_consult":
                _validate_allowed_fields(body, {"action", "expectedRevision", "consultDate", "consultSession", "consultScheduleNote"})
                if not perms["canScheduleConsult"]:
                    raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ BS Nguyện, BS Hoan hoặc Ban Chủ nhiệm mới được xếp lịch tư vấn phẫu thuật.")
                if cur_status not in ("cho_xep_tu_van", "da_xep_tu_van", "can_nhac"):
                    raise ApprovalEngineError(409, "INVALID_STATE_TRANSITION", f"Không thể xếp lịch tư vấn từ trạng thái {cur_status}.")
                c_date = str(body.get("consultDate") or "").strip()
                if not is_valid_iso_date(c_date):
                    raise ApprovalEngineError(422, "INVALID_CONSULT_DATE", "Vui lòng chọn Ngày tư vấn hợp lệ trên lịch (YYYY-MM-DD).")
                if c_date < _today_vn_iso() and not perms["isSuperAdmin"]:
                    raise ApprovalEngineError(422, "CONSULT_DATE_IN_PAST", "Không thể xếp lịch tư vấn về ngày trong quá khứ.")
                c_sess = str(body.get("consultSession") or "").strip().lower()
                if c_sess not in ROBOT_VALID_CONSULT_SESSIONS:
                    raise ApprovalEngineError(422, "INVALID_CONSULT_SESSION", "Vui lòng chọn Buổi tư vấn: Sáng hoặc Chiều.")

                if cur_status == "can_nhac":
                    rcase["consultRound"] = int(rcase.get("consultRound") or 1) + 1
                rcase["consultDate"] = c_date
                rcase["consultSession"] = c_sess
                rcase["consultScheduledAt"] = now_iso
                rcase["consultScheduledBy"] = uname
                rcase["consultScheduledByName"] = actor_name
                if "consultScheduleNote" in body:
                    rcase["consultScheduleNote"] = str(body.get("consultScheduleNote") or "").strip()
                rcase["status"] = "da_xep_tu_van"
                rcase["consultOutcome"] = "pending"

                sess_lbl = "Sáng" if c_sess == "sang" else "Chiều"
                targets = [CHIEF_STAFF_ID]
                if is_pos_int(rcase.get("createdByStaffId")):
                    targets.append(int(rcase["createdByStaffId"]))
                msg = f"Lịch tư vấn {sess_lbl} {_fmt_vi_date(c_date)} với TS. Hữu · {_room_label(rcase.get('wardRoom'))} ({code})."
                committed_notifs = build_robot_handoff_notifications(
                    db,
                    rcase,
                    actor_staff_id=perms["staffId"],
                    event_id=f"rbt_csch:{code}:v{rev_before + 1}",
                    notif_type="robot_consult_scheduled",
                    message=msg,
                    recipient_staff_ids=targets,
                )
                wal_action = "robot_consult_scheduled"

            elif action == "decide_consult":
                _validate_allowed_fields(
                    body,
                    {
                        "action",
                        "expectedRevision",
                        "decision",
                        "surgeryDate",
                        "caseSlot",
                        "operatingRoom",
                        "surgeryTime",
                        "durationMinutes",
                        "mainSurgeonId",
                        "assistSurgeon1",
                        "scheduledSurgeryType",
                        "robotProcedure",
                        "refusalReason",
                        "consultNote",
                        "confirmConflict",
                        "conflictOverrideReason",
                        "expectedConflictFingerprint",
                    },
                )
                if not perms["canDecideConsult"]:
                    raise ApprovalEngineError(403, "ROBOT_DECIDE_FORBIDDEN", "Chỉ TS. BSCKII. Nguyễn Phú Hữu hoặc Điều phối viên / BCN mới được chốt kết quả tư vấn.")
                if cur_status not in ("cho_xep_tu_van", "da_xep_tu_van", "can_nhac", "khong_dong_y_mo", "hoan_mo"):
                    raise ApprovalEngineError(409, "INVALID_STATE_TRANSITION", f"Không thể chốt kết quả tư vấn khi ca đang ở trạng thái {cur_status}.")

                decision = str(body.get("decision") or "").strip()
                if decision not in ("robot", "noisoi", "khong_mo", "can_nhac"):
                    raise ApprovalEngineError(422, "INVALID_CONSULT_DECISION", "Kết quả tư vấn phải là robot, noisoi, can_nhac hoặc khong_mo.")

                if "consultNote" in body:
                    rcase["consultNote"] = str(body.get("consultNote") or "").strip()
                if "robotProcedure" in body and str(body.get("robotProcedure") or "").strip():
                    rcase["robotProcedure"] = str(body.get("robotProcedure") or "").strip()

                rcase["consultedByStaffId"] = CHIEF_STAFF_ID
                rcase["consultedByName"] = _staff_display_name(db, CHIEF_STAFF_ID, "TS. BSCKII. Nguyễn Phú Hữu")
                rcase["consultDecidedAt"] = now_iso
                rcase["consultDecidedByUsername"] = uname
                rcase["consultDecidedByName"] = actor_name
                rcase["consultOutcome"] = decision
                rcase["caseRevision"] = rev_before + 1
                rcase["updatedAt"] = now_iso
                rcase["updatedBy"] = uname

                targets = []
                if is_pos_int(rcase.get("createdByStaffId")):
                    targets.append(int(rcase["createdByStaffId"]))
                room_lbl = _room_label(rcase.get("wardRoom"))

                if decision == "robot":
                    raw_sid = body.get("mainSurgeonId") if body.get("mainSurgeonId") not in ("", None) else (rcase.get("mainSurgeonId") or CHIEF_STAFF_ID)
                    sid, sname = _validate_surgeon_id(db, raw_sid, required=True)
                    rcase["mainSurgeonId"] = sid
                    rcase["mainSurgeonName"] = sname
                    if "assistSurgeon1" in body:
                        rcase["assistSurgeon1"] = _validate_assist_surgeon(db, body.get("assistSurgeon1"))

                    sched = _validate_schedule_fields(body, db, existing_case=rcase, require_date_slot=True, allow_past_date=False, approach="robot")
                    override_audit = _check_conflict_or_override(
                        db,
                        candidate={**rcase, **sched},
                        exclude_robot_code=code,
                        exclude_surgery_id=rcase.get("canonicalSurgeryId"),
                        body=body,
                        perms=perms,
                    )
                    rcase.update(sched)
                    if override_audit:
                        rcase.setdefault("conflictOverrideHistory", []).append(override_audit)
                    rcase["status"] = "da_xep_robot"
                    rcase["scheduledApproach"] = "robot"
                    rcase["scheduledSurgeryType"] = "robot"
                    rcase["refusalReason"] = ""
                    if rcase.get("inpatientState") not in ROBOT_INPATIENT_STATES:
                        rcase["inpatientState"] = "noi_tru"

                    rec_ref, s_op = _upsert_active_linked_surgery(
                        db,
                        rcase,
                        catalog=catalog,
                        cfg=cfg,
                        actor_username=uname,
                        event_label="robot_decided_robot",
                    )
                    linked_ops.append(s_op)
                    msg = f"TS. Hữu chốt Mổ Robot {_fmt_vi_date(rcase['surgeryDate'])} ({rcase['caseSlot']}) · {room_lbl} ({code})."

                elif decision == "noisoi":
                    raw_sid = body.get("mainSurgeonId")
                    sid, sname = _validate_surgeon_id(db, raw_sid, required=True)
                    rcase["mainSurgeonId"] = sid
                    rcase["mainSurgeonName"] = sname
                    if "assistSurgeon1" in body:
                        rcase["assistSurgeon1"] = _validate_assist_surgeon(db, body.get("assistSurgeon1"))
                    s_type = str(body.get("scheduledSurgeryType") or "chuongtrinh").strip()
                    if s_type not in ("chuongtrinh", "yeucau", "bankhan"):
                        raise ApprovalEngineError(422, "INVALID_SURGERY_TYPE", "Loại phẫu thuật Nội soi phải là chuongtrinh, yeucau hoặc bankhan.")

                    sched = _validate_schedule_fields(body, db, existing_case=rcase, require_date_slot=False, allow_past_date=False, approach="noisoi")
                    rcase.update(sched)
                    rcase["status"] = "da_xep_noisoi"
                    rcase["scheduledApproach"] = "noisoi"
                    rcase["scheduledSurgeryType"] = s_type
                    rcase["refusalReason"] = ""
                    if rcase.get("inpatientState") not in ROBOT_INPATIENT_STATES:
                        rcase["inpatientState"] = "noi_tru"

                    rec_ref, s_op = _upsert_active_linked_surgery(
                        db,
                        rcase,
                        catalog=catalog,
                        cfg=cfg,
                        actor_username=uname,
                        event_label="robot_decided_laparoscopic",
                    )
                    linked_ops.append(s_op)
                    if sid not in targets:
                        targets.append(sid)
                    msg = f"TS. Hữu chốt Chuyển mổ Nội soi {_fmt_vi_date(rcase['surgeryDate'])} (PTV: {sname}) · {room_lbl} ({code})."

                elif decision == "khong_mo":
                    r_code = str(body.get("refusalReason") or "").strip()
                    if r_code not in ROBOT_REFUSAL_REASONS:
                        raise ApprovalEngineError(422, "REFUSAL_REASON_REQUIRED", "Vui lòng chọn lý do bệnh nhân không đồng ý mổ.")
                    rcase["status"] = "khong_dong_y_mo"
                    rcase["refusalReason"] = r_code
                    rcase["scheduledApproach"] = ""
                    rcase["scheduledSurgeryType"] = ""
                    rcase["surgeryDate"] = ""
                    rcase["caseSlot"] = ""
                    rcase["inpatientState"] = "noi_tru"
                    rcase["plannedReadmitDate"] = ""
                    t_op = _move_active_surgery_to_trash(
                        db,
                        rcase,
                        actor_username=uname,
                        deleted_reason=f"robot_declined:{r_code}",
                        event_label="robot_decided_declined",
                    )
                    if t_op:
                        linked_ops.append(t_op)
                    msg = f"KQ tư vấn: Không đồng ý mổ ({ROBOT_REFUSAL_REASONS[r_code]}) · {room_lbl} ({code})."

                else:  # can_nhac
                    rcase["status"] = "can_nhac"
                    rcase["scheduledApproach"] = ""
                    rcase["scheduledSurgeryType"] = ""
                    rcase["inpatientState"] = "noi_tru"
                    t_op = _move_active_surgery_to_trash(
                        db,
                        rcase,
                        actor_username=uname,
                        deleted_reason="robot_considering_reconsult",
                        event_label="robot_decided_considering",
                    )
                    if t_op:
                        linked_ops.append(t_op)
                    targets.extend(_coordinator_staff_ids(db, sf_mod))
                    msg = f"KQ tư vấn: BN đang cân nhắc, cần xếp lịch tư vấn lại · {room_lbl} ({code})."

                committed_notifs = build_robot_handoff_notifications(
                    db,
                    rcase,
                    actor_staff_id=perms["staffId"],
                    event_id=f"rbt_dec:{code}:v{rev_before + 1}",
                    notif_type="robot_consult_decided",
                    message=msg,
                    recipient_staff_ids=targets,
                )
                wal_action = f"robot_consult_decided_{decision}"

            elif action == "edit_info":
                _validate_allowed_fields(
                    body,
                    {"action", "expectedRevision", "patientName", "birthYear", "gender", "phone", "admissionId", "wardRoom", "admissionSource", "admittingDoctorType", "admittingDoctorId", "admittingDoctorName", "indicationType", "labsReadyConfirmed", "diagnosis", "robotProcedure", "mainSurgeonId", "assistSurgeon1", "note", "expectedTimeframe", "consultNote"},
                )
                is_owner = (
                    (rcase.get("createdByUsername") == uname and uname)
                    or (is_pos_int(perms["staffId"]) and rcase.get("mainSurgeonId") == perms["staffId"])
                )
                if cur_status == "da_mo":
                    if not perms["canManageRobot"]:
                        raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Ca đã mổ chỉ Ban Chủ nhiệm hoặc Điều phối viên Robot mới được chỉnh sửa.")
                elif cur_status in ("da_xep_robot", "da_xep_noisoi", "hoan_mo", "khong_dong_y_mo"):
                    if not (perms["canManageRobot"] or is_owner):
                        raise ApprovalEngineError(403, "ROBOT_EDIT_FORBIDDEN", "Chỉ BS phụ trách ca, người gửi hoặc Điều phối viên mới được sửa thông tin ca ở trạng thái này.")
                else:
                    if not (perms["canManageRobot"] or is_owner or perms["canEditInfo"]):
                        raise ApprovalEngineError(403, "ROBOT_EDIT_FORBIDDEN", "Tài khoản không có quyền chỉnh sửa thông tin ca này.")

                if "mainSurgeonId" in body and not perms["canEditSchedule"] and body.get("mainSurgeonId") != rcase.get("mainSurgeonId") and cur_status in ROBOT_ACTIVE_SCHEDULE_STATUSES:
                    raise ApprovalEngineError(403, "ROBOT_SCHEDULE_COORDINATOR_REQUIRED", "Chỉ Điều phối viên hoặc Ban Chủ nhiệm mới được đổi PTV chính sau khi đã xếp lịch mổ.")

                if "patientName" in body:
                    pname = str(body.get("patientName") or "").strip()
                    if not pname:
                        raise ApprovalEngineError(422, "PATIENT_NAME_REQUIRED", "Họ tên bệnh nhân không được để trống.")
                    if rcase.get("isTestSandboxCase") is True and "[test]" not in pname.lower():
                        pname = f"[TEST] {pname}"
                    rcase["patientName"] = pname
                if "birthYear" in body:
                    rcase["birthYear"] = _validate_birth_year(body.get("birthYear"))
                if "gender" in body:
                    rcase["gender"] = _validate_gender(body.get("gender"))
                if "phone" in body:
                    rcase["phone"] = normalize_phone_vn(body.get("phone"), required=False)
                if "admissionId" in body:
                    rcase["admissionId"] = str(body.get("admissionId") or "").strip()
                if "wardRoom" in body:
                    rcase["wardRoom"] = _normalize_ward_room(body.get("wardRoom"), required=False)
                if any(k in body for k in ("admissionSource", "admittingDoctorType", "admittingDoctorId", "admittingDoctorName")):
                    rcase.update(_normalize_admission_source_and_doctor(db, body, existing_case=rcase))
                if "indicationType" in body and str(body.get("indicationType") or "").strip() in ROBOT_INDICATION_TYPES:
                    rcase["indicationType"] = str(body.get("indicationType")).strip()
                if "labsReadyConfirmed" in body:
                    rcase["labsReadyConfirmed"] = bool(body.get("labsReadyConfirmed"))
                if "diagnosis" in body:
                    rcase["diagnosis"] = str(body.get("diagnosis") or "").strip()
                if "robotProcedure" in body:
                    rcase["robotProcedure"] = str(body.get("robotProcedure") or "").strip()
                if "mainSurgeonId" in body:
                    sid, sname = _validate_surgeon_id(db, body.get("mainSurgeonId"), required=True)
                    rcase["mainSurgeonId"] = sid
                    rcase["mainSurgeonName"] = sname
                if "assistSurgeon1" in body:
                    rcase["assistSurgeon1"] = _validate_assist_surgeon(db, body.get("assistSurgeon1"))
                if "note" in body:
                    rcase["note"] = str(body.get("note") or "").strip()
                if "expectedTimeframe" in body:
                    rcase["expectedTimeframe"] = _validate_expected_timeframe(body.get("expectedTimeframe"))
                if "consultNote" in body:
                    rcase["consultNote"] = str(body.get("consultNote") or "").strip()

                rcase["caseRevision"] = rev_before + 1
                rcase["updatedAt"] = now_iso
                rcase["updatedBy"] = uname

                if rcase.get("status") in ROBOT_ACTIVE_SCHEDULE_STATUSES and is_pos_int(rcase.get("activeLinkedSurgeryId")):
                    rec_ref, s_op = _upsert_active_linked_surgery(
                        db,
                        rcase,
                        catalog=catalog,
                        cfg=cfg,
                        actor_username=uname,
                        event_label="robot_case_info_updated",
                    )
                    linked_ops.append(s_op)
                wal_action = "robot_case_info_updated"

            elif action == "edit_schedule":
                _validate_allowed_fields(
                    body,
                    {"action", "expectedRevision", "surgeryDate", "caseSlot", "operatingRoom", "surgeryTime", "durationMinutes", "mainSurgeonId", "assistSurgeon1", "scheduledSurgeryType", "note", "confirmConflict", "conflictOverrideReason", "expectedConflictFingerprint"},
                )
                if not perms["canEditSchedule"]:
                    raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm hoặc Điều phối viên mới có quyền điều chỉnh lịch mổ.")
                if cur_status not in ROBOT_ACTIVE_SCHEDULE_STATUSES:
                    raise ApprovalEngineError(409, "INVALID_STATE_TRANSITION", f"Chỉ chỉnh lịch cho ca đã xếp lịch mổ (hiện tại: {cur_status}).")

                approach = "noisoi" if cur_status == "da_xep_noisoi" else "robot"
                if "mainSurgeonId" in body:
                    sid, sname = _validate_surgeon_id(db, body.get("mainSurgeonId"), required=True)
                    rcase["mainSurgeonId"] = sid
                    rcase["mainSurgeonName"] = sname
                if "assistSurgeon1" in body:
                    rcase["assistSurgeon1"] = _validate_assist_surgeon(db, body.get("assistSurgeon1"))
                if approach == "noisoi" and "scheduledSurgeryType" in body:
                    st_val = str(body.get("scheduledSurgeryType") or "").strip()
                    if st_val not in ("chuongtrinh", "yeucau", "bankhan"):
                        raise ApprovalEngineError(422, "INVALID_SURGERY_TYPE", "Loại phẫu thuật Nội soi không hợp lệ.")
                    rcase["scheduledSurgeryType"] = st_val

                sched = _validate_schedule_fields(body, db, existing_case=rcase, require_date_slot=(approach == "robot"), allow_past_date=False, approach=approach)
                if approach == "robot":
                    override_audit = _check_conflict_or_override(
                        db,
                        candidate={**rcase, **sched, "mainSurgeonId": rcase.get("mainSurgeonId")},
                        exclude_robot_code=code,
                        exclude_surgery_id=rcase.get("canonicalSurgeryId"),
                        body=body,
                        perms=perms,
                    )
                    if override_audit:
                        rcase.setdefault("conflictOverrideHistory", []).append(override_audit)
                rcase.update(sched)
                if rcase.get("inpatientState") == "xuat_vien_cho" and is_valid_iso_date(rcase.get("plannedReadmitDate")) and rcase["plannedReadmitDate"] > rcase["surgeryDate"]:
                    rcase["plannedReadmitDate"] = rcase["surgeryDate"]
                if "note" in body:
                    rcase["note"] = str(body.get("note") or "").strip()

                rcase["caseRevision"] = rev_before + 1
                rcase["updatedAt"] = now_iso
                rcase["updatedBy"] = uname

                rec_ref, s_op = _upsert_active_linked_surgery(
                    db,
                    rcase,
                    catalog=catalog,
                    cfg=cfg,
                    actor_username=uname,
                    event_label="robot_schedule_updated",
                )
                linked_ops.append(s_op)
                wal_action = "robot_schedule_updated"

            elif action == "discharge_wait":
                _validate_allowed_fields(body, {"action", "expectedRevision", "plannedReadmitDate", "dischargeReason", "note"})
                if not perms["canManageInpatientWait"]:
                    raise ApprovalEngineError(403, "ROBOT_DISCHARGE_FORBIDDEN", "Chỉ Bác sĩ mới có quyền ghi nhận Xuất viện chờ & Hẹn ngày nhập lại.")
                if cur_status not in ROBOT_ACTIVE_SCHEDULE_STATUSES:
                    raise ApprovalEngineError(409, "INVALID_STATE_TRANSITION", f"Chỉ thực hiện Xuất viện chờ cho ca đã xếp lịch mổ (hiện tại: {cur_status}).")
                p_readmit = str(body.get("plannedReadmitDate") or "").strip()
                if not is_valid_iso_date(p_readmit):
                    raise ApprovalEngineError(422, "READMIT_DATE_REQUIRED", "Vui lòng chọn Ngày nhập viện trở lại trên lịch (YYYY-MM-DD).")
                if p_readmit < _today_vn_iso() and not perms["isSuperAdmin"]:
                    raise ApprovalEngineError(422, "READMIT_DATE_IN_PAST", "Ngày nhập viện trở lại không thể ở quá khứ.")
                s_date = str(rcase.get("surgeryDate") or "").strip()
                if is_valid_iso_date(s_date) and p_readmit > s_date:
                    raise ApprovalEngineError(422, "READMIT_AFTER_SURGERY_DATE", f"Ngày nhập viện trở lại ({_fmt_vi_date(p_readmit)}) phải trước hoặc bằng ngày mổ ({_fmt_vi_date(s_date)}).")

                reason = str(body.get("dischargeReason") or "").strip() or "Lịch mổ còn xa — cho xuất viện chờ hẹn nhập lại"
                rcase["inpatientState"] = "xuat_vien_cho"
                rcase["plannedReadmitDate"] = p_readmit
                rcase["dischargeReason"] = reason
                rcase["dischargedWaitAt"] = now_iso
                rcase["dischargedWaitBy"] = uname
                rcase["dischargedWaitByName"] = actor_name
                if "note" in body:
                    rcase["note"] = str(body.get("note") or "").strip()

                rcase["caseRevision"] = rev_before + 1
                rcase["updatedAt"] = now_iso
                rcase["updatedBy"] = uname

                # Slot preservation: keep active record in surgeries[] with updated robotSyncMeta
                rec_ref, s_op = _upsert_active_linked_surgery(
                    db,
                    rcase,
                    catalog=catalog,
                    cfg=cfg,
                    actor_username=uname,
                    event_label="robot_discharged_wait_slot_kept",
                )
                linked_ops.append(s_op)
                wal_action = "robot_discharged_wait"

            elif action == "confirm_readmit":
                _validate_allowed_fields(body, {"action", "expectedRevision", "wardRoom", "note"})
                if not perms["canManageInpatientWait"]:
                    raise ApprovalEngineError(403, "ROBOT_READMIT_FORBIDDEN", "Chỉ Bác sĩ mới có quyền xác nhận bệnh nhân đã nhập viện lại.")
                if cur_status not in ROBOT_ACTIVE_SCHEDULE_STATUSES or rcase.get("inpatientState") != "xuat_vien_cho":
                    raise ApprovalEngineError(409, "INVALID_STATE_TRANSITION", "Chỉ xác nhận nhập lại khi ca đang ở trạng thái Xuất viện chờ.")
                if "wardRoom" in body and str(body.get("wardRoom") or "").strip():
                    rcase["wardRoom"] = _normalize_ward_room(body.get("wardRoom"), required=False)
                if "note" in body:
                    rcase["note"] = str(body.get("note") or "").strip()

                rcase["inpatientState"] = "da_nhap_lai"
                rcase["readmittedAt"] = now_iso
                rcase["readmittedBy"] = uname
                rcase["readmittedByName"] = actor_name
                rcase["caseRevision"] = rev_before + 1
                rcase["updatedAt"] = now_iso
                rcase["updatedBy"] = uname

                rec_ref, s_op = _upsert_active_linked_surgery(
                    db,
                    rcase,
                    catalog=catalog,
                    cfg=cfg,
                    actor_username=uname,
                    event_label="robot_confirmed_readmit",
                )
                linked_ops.append(s_op)
                wal_action = "robot_confirmed_readmit"

            elif action == "postpone":
                _validate_allowed_fields(body, {"action", "expectedRevision", "postponeReasonCode", "postponeReasonNote", "forceLookbackOverride", "note"})
                is_surgeon_owner = is_pos_int(perms["staffId"]) and rcase.get("mainSurgeonId") == perms["staffId"]
                is_creator_owner = bool(uname and rcase.get("createdByUsername") == uname)
                if not (perms["canManageRobot"] or is_surgeon_owner or is_creator_owner or perms["canPostponeOrDischarge"]):
                    raise ApprovalEngineError(403, "ROBOT_POSTPONE_FORBIDDEN", "Tài khoản không có quyền hoãn ca phẫu thuật này.")
                if cur_status not in ("da_xep_robot", "da_xep_noisoi", "da_mo"):
                    raise ApprovalEngineError(409, "INVALID_STATE_TRANSITION", f"Không thể hoãn mổ từ trạng thái {cur_status}.")

                rcode = str(body.get("postponeReasonCode") or "").strip()
                if rcode not in ROBOT_POSTPONE_REASONS:
                    raise ApprovalEngineError(422, "INVALID_POSTPONE_REASON", "Vui lòng chọn lý do hoãn mổ chuẩn trong danh sách 7 lý do.")
                rnote = str(body.get("postponeReasonNote") or "").strip()
                if rcode == "ly_do_khac" and len(rnote) < 3:
                    raise ApprovalEngineError(422, "POSTPONE_NOTE_REQUIRED", "Khi chọn 'Lý do khác', vui lòng ghi cụ thể lý do hoãn (tối thiểu 3 ký tự).")

                robot_cfg = get_robot_config(db)
                lookback_days = int(robot_cfg.get("postponeLookbackDays") or 7)
                if cur_status == "da_mo":
                    s_date = str(rcase.get("surgeryDate") or "").strip()
                    if not is_valid_iso_date(s_date):
                        raise ApprovalEngineError(422, "INVALID_SURGERY_DATE", "Ca thiếu ngày mổ hợp lệ để tính giới hạn hoãn hậu kiểm.")
                    today_dt = datetime.strptime(_today_vn_iso(), "%Y-%m-%d").date()
                    surg_dt = datetime.strptime(s_date, "%Y-%m-%d").date()
                    diff_days = (today_dt - surg_dt).days
                    force_sa = bool(body.get("forceLookbackOverride") is True and perms["isSuperAdmin"])
                    if not force_sa and (diff_days < 0 or diff_days > lookback_days):
                        raise ApprovalEngineError(
                            422,
                            "POSTPONE_LOOKBACK_EXCEEDED",
                            f"Ca đã qua ngày mổ {diff_days} ngày (vượt quá giới hạn {lookback_days} ngày cho phép hoãn mổ hậu kiểm).",
                            {"diffDays": diff_days, "lookbackLimitDays": lookback_days},
                        )

                rcase["previousScheduleSnapshot"] = {
                    "surgeryDate": rcase.get("surgeryDate"),
                    "caseSlot": rcase.get("caseSlot"),
                    "operatingRoom": rcase.get("operatingRoom"),
                    "scheduledApproach": rcase.get("scheduledApproach") or ("noisoi" if cur_status == "da_xep_noisoi" else "robot"),
                    "statusBefore": cur_status,
                }
                rcase["status"] = "hoan_mo"
                rcase["inpatientState"] = "noi_tru"
                rcase["postponedAt"] = now_iso
                rcase["postponedBy"] = uname
                rcase["postponedFromStatus"] = cur_status
                rcase["postponeReasonCode"] = rcode
                rcase["postponeReasonLabel"] = ROBOT_POSTPONE_REASONS[rcode]
                rcase["postponeReasonNote"] = rnote
                rcase["completionSource"] = None
                rcase.setdefault("postponeHistory", []).append({
                    "at": now_iso,
                    "by": uname,
                    "fromStatus": cur_status,
                    "reasonCode": rcode,
                    "reasonLabel": ROBOT_POSTPONE_REASONS[rcode],
                    "reasonNote": rnote,
                    "previousDate": rcase.get("surgeryDate"),
                    "previousSlot": rcase.get("caseSlot"),
                })
                if "note" in body:
                    rcase["note"] = str(body.get("note") or "").strip()

                t_op = _move_active_surgery_to_trash(
                    db,
                    rcase,
                    actor_username=uname,
                    deleted_reason=f"robot_postponed:{rcode}",
                    event_label="robot_postponed",
                )
                if t_op:
                    linked_ops.append(t_op)
                wal_action = "robot_postponed"

            elif action == "mark_completed":
                _validate_allowed_fields(body, {"action", "expectedRevision", "note"})
                if not perms["canEditSchedule"]:
                    raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm hoặc Điều phối viên mới được xác nhận ca đã phẫu thuật.")
                if cur_status not in ROBOT_ACTIVE_SCHEDULE_STATUSES:
                    raise ApprovalEngineError(409, "INVALID_STATE_TRANSITION", f"Chỉ đánh dấu đã mổ từ trạng thái đang xếp lịch (hiện tại: {cur_status}).")
                if "note" in body:
                    rcase["note"] = str(body.get("note") or "").strip()
                rcase["status"] = "da_mo"
                rcase["completionSource"] = "manual_confirm"
                rcase["completedAt"] = now_iso
                rcase["completedBy"] = uname
                wal_action = "robot_marked_completed"

            elif action == "reopen_consult":
                _validate_allowed_fields(body, {"action", "expectedRevision", "note"})
                if not (perms["canScheduleConsult"] or perms["canDecideConsult"]):
                    raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Điều phối viên hoặc Ban Chủ nhiệm mới được mở lại bước tư vấn.")
                if cur_status not in ("khong_dong_y_mo", "hoan_mo", "can_nhac"):
                    raise ApprovalEngineError(409, "INVALID_STATE_TRANSITION", f"Không thể mở lại tư vấn từ trạng thái {cur_status}.")
                if "note" in body:
                    rcase["note"] = str(body.get("note") or "").strip()
                rcase["status"] = "cho_xep_tu_van"
                rcase["consultOutcome"] = "pending"
                rcase["inpatientState"] = "noi_tru"
                wal_action = "robot_reopened_consult"

            elif action == "soft_delete":
                _validate_allowed_fields(body, {"action", "expectedRevision", "deleteReason"})
                is_wait_owner = bool(
                    cur_status in ("cho_xep_tu_van", "da_xep_tu_van", "can_nhac")
                    and uname
                    and str(rcase.get("createdByUsername") or "").strip().lower() == uname.lower()
                )
                if not (perms["canSoftDelete"] or is_wait_owner):
                    raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm, Điều phối viên hoặc Bác sĩ tạo ca chờ tư vấn mới có quyền đưa ca này vào Thùng rác.")
                if cur_status == "da_xoa":
                    raise ApprovalEngineError(409, "ALREADY_IN_TRASH", "Ca này đã nằm trong Thùng rác.")
                rcase["preDeleteStatus"] = cur_status
                rcase["status"] = "da_xoa"
                rcase["deletedAt"] = now_iso
                rcase["deletedBy"] = uname
                rcase["deleteReason"] = str(body.get("deleteReason") or "Đưa vào thùng rác từ Điều phối Robot").strip()
                t_op = _move_active_surgery_to_trash(
                    db,
                    rcase,
                    actor_username=uname,
                    deleted_reason=rcase["deleteReason"],
                    event_label="robot_soft_deleted",
                )
                if t_op:
                    linked_ops.append(t_op)
                wal_action = "robot_soft_deleted"

            elif action == "restore_trash":
                _validate_allowed_fields(body, {"action", "expectedRevision"})
                if not perms["canSoftDelete"]:
                    raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm hoặc Điều phối viên mới có quyền khôi phục ca từ Thùng rác.")
                if cur_status != "da_xoa":
                    raise ApprovalEngineError(409, "NOT_IN_TRASH", "Ca bệnh không ở trạng thái Thùng rác.")

                prev_st = rcase.get("preDeleteStatus") or "cho_xep_tu_van"
                if prev_st in ("cho_xep_tu_van", "da_xep_tu_van", "can_nhac", "khong_dong_y_mo", "hoan_mo"):
                    rcase["status"] = prev_st
                else:
                    # Anti-collision restore: return previously scheduled cases to consult scheduling rather than silently occupying a slot
                    rcase["status"] = "da_xep_tu_van" if rcase.get("consultDate") else "cho_xep_tu_van"
                    rcase["consultOutcome"] = "pending"
                    rcase["scheduledApproach"] = ""
                    rcase["inpatientState"] = "noi_tru"
                rcase["deletedAt"] = None
                rcase["deletedBy"] = None
                rcase["deleteReason"] = None
                wal_action = "robot_restored_trash"

            else:
                raise ApprovalEngineError(422, "INVALID_ACTION", f"Hành động cập nhật không hợp lệ: {action}.")

            if committed_notifs:
                db.setdefault("notifications", []).extend(copy.deepcopy(committed_notifs))
                db.setdefault("_revisions", {})["notifications"] = int(db.get("_revisions", {}).get("notifications", 1)) + 1

            rcase["caseRevision"] = rev_before + 1
            rcase["updatedAt"] = now_iso
            rcase["updatedBy"] = uname
            revs = db.setdefault("_revisions", {})
            revs["robotCases"] = int(revs.get("robotCases", 1)) + 1

            return {
                "httpStatus": 200,
                "response": {
                    "ok": True,
                    "case": copy.deepcopy(rcase),
                    "overrideAudit": override_audit,
                },
                "wal": _build_wal_spec(
                    action=wal_action,
                    rcase=rcase,
                    rev_before=rev_before,
                    rev_after=rcase["caseRevision"],
                    linked_ops=linked_ops,
                    summary_extra={"patchAction": action},
                    record_ref=rec_ref,
                    committed_notifications=committed_notifs,
                ),
            }

        return _run_wal_tx(
            action_key=f"robot_patch_{action or 'unknown'}",
            response_post_serializer=_mask_robot_response_payload,
            handler_fn=_tx,
        )

    # ───────────────────────── Zero-RM Soft Archive Delete ─────────────────────────

    @app.route("/api/robot/cases/<robot_code>", methods=["DELETE"])
    def archive_delete_robot_case(robot_code: str):
        body_raw = request.get_json(force=True, silent=True) or {}
        if "expectedRevision" not in body_raw and request.args.get("expectedRevision"):
            try:
                body_raw["expectedRevision"] = int(request.args.get("expectedRevision"))
            except ValueError:
                pass

        def _tx(*, db, body, real_user, actor, catalog, cfg):
            perms = _extended_robot_permissions(real_user, db)
            if not perms["canArchiveDeleted"]:
                raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm hoặc Điều phối viên mới có quyền lưu trữ ẩn hồ sơ từ Thùng rác.")
            _validate_allowed_fields(body, {"action", "expectedRevision"})
            rcase = _find_robot_case(db, robot_code)
            if rcase is None:
                raise ApprovalEngineError(404, "ROBOT_CASE_NOT_FOUND", f"Không tìm thấy hồ sơ Robot {robot_code}.")
            if rcase.get("isTestSandboxCase") is True and not perms["canAccessSandbox"]:
                raise ApprovalEngineError(404, "ROBOT_CASE_NOT_FOUND", f"Không tìm thấy hồ sơ Robot {robot_code}.")
            if rcase.get("status") != "da_xoa":
                raise ApprovalEngineError(409, "MUST_SOFT_DELETE_FIRST", "Cần đưa hồ sơ vào Thùng rác (da_xoa) trước khi lưu trữ ẩn (Zero-RM).")

            rev_before = _enforce_case_occ(rcase, body, real_user, db)
            now_iso = now_vn_iso()
            uname = perms["username"]

            rcase["status"] = "archived_deleted"
            rcase["archivedAt"] = now_iso
            rcase["archivedBy"] = uname
            linked_ops = []
            arch_op = _archive_linked_surgery_inactive(
                db,
                rcase,
                actor_username=uname,
                reason="robot_trash_zero_rm_archive",
                superseded=False,
            )
            if arch_op:
                linked_ops.append(arch_op)

            rcase["caseRevision"] = rev_before + 1
            rcase["updatedAt"] = now_iso
            rcase["updatedBy"] = uname
            revs = db.setdefault("_revisions", {})
            revs["robotCases"] = int(revs.get("robotCases", 1)) + 1

            return {
                "httpStatus": 200,
                "response": {
                    "ok": True,
                    "archived": True,
                    "robotCaseCode": _robot_code_of(rcase),
                    "case": copy.deepcopy(rcase),
                },
                "wal": _build_wal_spec(
                    action="robot_archived_deleted",
                    rcase=rcase,
                    rev_before=rev_before,
                    rev_after=rcase["caseRevision"],
                    linked_ops=linked_ops,
                ),
            }

        return _run_wal_tx(
            action_key="robot_archive_delete",
            body_override=body_raw,
            response_post_serializer=_mask_robot_response_payload,
            handler_fn=_tx,
        )

    # ───────────────────────── Coordinator & Print Config ─────────────────────────

    @app.route("/api/robot/config", methods=["PUT"])
    def update_robot_config():
        def _tx(*, db, body, real_user, actor, catalog, cfg):
            perms = _extended_robot_permissions(real_user, db)
            if not perms["canConfigureCoordinators"]:
                raise ApprovalEngineError(403, "ROBOT_BCN_REQUIRED", "Chỉ Ban Chủ nhiệm khoa hoặc Super Admin mới có quyền cấu hình Điều phối viên.")

            _validate_allowed_fields(
                body,
                {"action", "coordinators", "defaultSchedulerName", "postponeLookbackDays", "trashAutoArchiveDays", "expectedConfigRevision"},
            )
            revs = db.setdefault("_revisions", {})
            cur_cfg_rev = int(revs.get("robotConfig", 1) or 1)
            if "expectedConfigRevision" in body and body.get("expectedConfigRevision") is not None:
                exp_cr = body.get("expectedConfigRevision")
                if not is_strict_int(exp_cr) or int(exp_cr) != cur_cfg_rev:
                    raise ApprovalEngineError(409, "CONFIG_REVISION_MISMATCH", "Cấu hình Robot vừa được thay đổi ở phiên khác — vui lòng tải lại.")

            rcfg = get_robot_config(db)
            if "coordinators" in body:
                raw_coords = body.get("coordinators")
                if not isinstance(raw_coords, list):
                    raise ApprovalEngineError(422, "INVALID_COORDINATORS", "Danh sách coordinators phải là mảng tên đăng nhập.")
                cleaned, invalid = _validate_coordinator_usernames(sf_mod, db, raw_coords)
                if invalid:
                    raise ApprovalEngineError(
                        422,
                        "INVALID_COORDINATOR_ACCOUNT",
                        f"Tài khoản điều phối viên không tồn tại hoặc đang bị vô hiệu hóa: {', '.join(invalid)}.",
                        {"invalidAccounts": invalid},
                    )
                rcfg["coordinators"] = cleaned

            if "defaultSchedulerName" in body:
                sname = str(body.get("defaultSchedulerName") or "").strip()
                if not sname or len(sname) > 60:
                    raise ApprovalEngineError(422, "INVALID_SCHEDULER_NAME", "Tên người nhận/xếp lịch P.CTXH phải từ 1–60 ký tự.")
                rcfg["defaultSchedulerName"] = sname

            if "postponeLookbackDays" in body:
                try:
                    ld = int(body.get("postponeLookbackDays"))
                except (ValueError, TypeError):
                    raise ApprovalEngineError(422, "INVALID_LOOKBACK_DAYS", "Giới hạn ngày hoãn hậu kiểm phải từ 1–30 ngày.")
                if ld < 1 or ld > 30:
                    raise ApprovalEngineError(422, "INVALID_LOOKBACK_DAYS", "Giới hạn ngày hoãn hậu kiểm phải từ 1–30 ngày.")
                rcfg["postponeLookbackDays"] = ld

            if "trashAutoArchiveDays" in body:
                try:
                    ad = int(body.get("trashAutoArchiveDays"))
                except (ValueError, TypeError):
                    raise ApprovalEngineError(422, "INVALID_ARCHIVE_DAYS", "Số ngày tự động lưu trữ thùng rác phải từ 7–90 ngày.")
                if ad < 7 or ad > 90:
                    raise ApprovalEngineError(422, "INVALID_ARCHIVE_DAYS", "Số ngày tự động lưu trữ thùng rác phải từ 7–90 ngày.")
                rcfg["trashAutoArchiveDays"] = ad

            rcfg["robotConfigSchemaVersion"] = 2
            db["robotConfig"] = rcfg
            revs["robotConfig"] = cur_cfg_rev + 1

            return {
                "httpStatus": 200,
                "response": {
                    "ok": True,
                    "robotConfig": copy.deepcopy(rcfg),
                    "configRevision": revs["robotConfig"],
                },
                "wal": _build_wal_spec(
                    action="robot_config_updated",
                    rcase=None,
                    rev_before=cur_cfg_rev,
                    rev_after=revs["robotConfig"],
                    config_rec=rcfg,
                    summary_extra={"coordinators": rcfg["coordinators"], "defaultSchedulerName": rcfg["defaultSchedulerName"]},
                ),
            }

        return _run_wal_tx(
            action_key="robot_config_update",
            response_post_serializer=_mask_robot_response_payload,
            handler_fn=_tx,
        )
