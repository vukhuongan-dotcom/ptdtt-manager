#!/usr/bin/env python3
"""
Flask Route Handlers for Robotic Surgery Coordination Module (FEAT-231).
2-way atomic integration with Weekly Surgery Schedule (`surgeries[]`) and Dual-WAL Engine.
Zero-Local-PHI compliant: patient phone numbers are stored server-side and masked for
non-authorized roles across all 2xx/4xx responses, idempotency replays, and audit logs.
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
    DEFAULT_ROBOT_CONFIG,
    ROBOT_POSTPONE_REASONS,
    ROBOT_SLOT_HOLDING_STATUSES,
    ROBOT_VALID_SLOTS,
    TRAINEE_STAFF_IDS,
    ApprovalEngineError,
    allocate_next_surgery_id,
    apply_tier_a_and_schedule_invalidation,
    build_robot_surgery_payload,
    can_user_access_sandbox,
    check_robot_slot_conflicts_in_lock,
    get_approval_config,
    get_robot_config,
    initialize_new_surgery_record,
    is_pos_int,
    is_strict_int,
    is_valid_iso_date,
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
    "tu_van",
    "can_nhac",
    "tu_choi",
    "cho_xep_lich",
    "cho_duyet_tien_phau",
    "cho_duyet_luu_vien",
    "cho_mo",
    "da_mo",
    "hoan_mo",
    "xuat_vien_cho",
    "da_xoa",
    "archived_deleted",
}

ROBOT_CONSULT_STATUSES = {"tu_van", "can_nhac", "tu_choi", "cho_xep_lich"}
ROBOT_CLINICAL_CORE_FIELDS = (
    "patientName",
    "birthYear",
    "gender",
    "admissionId",
    "diagnosis",
    "robotProcedure",
    "mainSurgeonId",
)

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


def _is_robot_surgery(rec: dict) -> bool:
    return isinstance(rec, dict) and (rec.get("approachType") == "robot" or rec.get("surgeryType") == "robot")


def _robot_code_of(rcase: dict) -> str:
    if not isinstance(rcase, dict):
        return ""
    return str(rcase.get("robotCaseCode") or rcase.get("soNV") or "").strip()


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


def _validate_schedule_fields(
    body: dict,
    db: dict,
    *,
    existing_case: dict = None,
    require_date_slot: bool = True,
    allow_past_date: bool = False,
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
    raw_dur = body["durationMinutes"] if "durationMinutes" in body else (existing_case or {}).get("durationMinutes") or cfg.get("defaultDurationMinutes") or 180

    if require_date_slot and (not s_date or not s_slot):
        raise ApprovalEngineError(422, "SCHEDULE_DATE_SLOT_REQUIRED", "Vui lòng chọn đầy đủ Ngày mổ dự kiến và Ca mổ (Ca 1–Ca 6).")
    if s_date:
        if not is_valid_iso_date(s_date):
            raise ApprovalEngineError(422, "INVALID_SURGERY_DATE", "Ngày mổ phải theo định dạng YYYY-MM-DD.")
        if not allow_past_date and s_date < _today_vn_iso():
            raise ApprovalEngineError(422, "SURGERY_DATE_IN_PAST", "Không thể xếp lịch mổ về ngày trong quá khứ.")
    if s_slot and s_slot not in ROBOT_VALID_SLOTS:
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

    # Never allow a second active record with the same robotCaseId or different active record
    found_idx = -1
    for i, s in enumerate(surgeries):
        if isinstance(s, dict) and s.get("id") == active_sid:
            found_idx = i
            break
    if found_idx < 0:
        raise ApprovalEngineError(500, "LINKED_SURGERY_INVARIANT_ERROR", "Không tìm thấy ca hoạt động sau khi đồng bộ.")

    # Move any accidental stray active duplicates with same robotCaseId to surgeriesArchivedInactive
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
    Shared engine upsert when a Robot case enters or updates while in `cho_mo` (or active link).
    NEVER grants `approval.status = 'approved'`.
    Invokes `apply_tier_a_and_schedule_invalidation` so Tier-A changes revoke prior BCN approval.
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
            # Invariant: B2/B3 or Robot restore from trash/archive NEVER carries stale 'approved'
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
    hist = rcase.setdefault("linkedSurgeryHistory", [])
    hist.append({
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
    return out


def _apply_lazy_rollover_tx(*, db: dict, body: dict, real_user: dict, actor: dict, catalog: dict, cfg: dict):
    today_str = str(body.get("todayVn") or _today_vn_iso())
    now_iso = now_vn_iso()
    now_utc = datetime.now(timezone.utc)
    robot_cfg = get_robot_config(db)
    archive_days = int(robot_cfg.get("trashAutoArchiveDays") or 14)

    rolled_cases = []
    linked_ops = []
    changed_records = []

    rc_by_code = {}
    for rc in (db.get("robotCases") or []):
        if isinstance(rc, dict) and _robot_code_of(rc):
            rc_by_code[_robot_code_of(rc)] = rc

    # 1. Auto-rollover cho_mo -> da_mo ONLY when surgeryDate < today_vn
    for rc in (db.get("robotCases") or []):
        if not isinstance(rc, dict):
            continue
        if rc.get("status") == "cho_mo" and is_valid_iso_date(rc.get("surgeryDate")) and rc["surgeryDate"] < today_str:
            rc["status"] = "da_mo"
            rc["completionSource"] = "auto_date_rollover"
            rc["rolledOverAt"] = now_iso
            rc["caseRevision"] = int(rc.get("caseRevision", 1) or 1) + 1
            rc["updatedAt"] = now_iso
            rc["updatedBy"] = "system:auto_date_rollover"
            rolled_cases.append(_robot_code_of(rc))
            changed_records.append(copy.deepcopy(rc))

    # 2. Archive expired surgeriesTrash with robotCaseId & da_xoa robotCases (> trashAutoArchiveDays)
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

    # Also archive standalone da_xoa robotCases older than archive_days without trash item
    for rc in (db.get("robotCases") or []):
        if isinstance(rc, dict) and rc.get("status") == "da_xoa":
            dt_del = parse_iso_dt(rc.get("deletedAt"))
            if dt_del is not None and (now_utc - dt_del).total_seconds() > archive_days * 86400:
                rc["status"] = "archived_deleted"
                rc["archivedAt"] = now_iso
                rc["caseRevision"] = int(rc.get("caseRevision", 1) or 1) + 1
                changed_records.append(copy.deepcopy(rc))

    if not changed_records and not linked_ops:
        return {
            "httpStatus": 200,
            "skipDbWrite": True,
            "response": {"ok": True, "rolledOverCodes": [], "archivedCount": len(linked_ops)},
            "wal": None,
        }

    revs = db.setdefault("_revisions", {})
    revs["robotCases"] = int(revs.get("robotCases", 1)) + 1
    if touched_trash:
        revs["surgeriesTrash"] = int(revs.get("surgeriesTrash", 1)) + 1

    # Deduplicate changed_records by code
    dedup_rc = {}
    for rc in changed_records:
        dedup_rc[_robot_code_of(rc)] = rc
    rc_list = list(dedup_rc.values())

    return {
        "httpStatus": 200,
        "response": {
            "ok": True,
            "rolledOverCodes": rolled_cases,
            "archivedCount": len(linked_ops),
        },
        "wal": {
            "action": "robot_auto_rollover",
            "surgeryId": None,
            "caseRevBefore": None,
            "caseRevAfter": None,
            "summary": {
                "rolledOverCodes": rolled_cases,
                "archivedCount": len(linked_ops),
                "isTestSandboxCase": False,
            },
            "committedStatePatch": {
                "patchKind": "robot_tx",
                "robotCaseRecords": rc_list,
                "linkedSurgeryOps": linked_ops,
            },
        },
    }


def _needs_lazy_rollover(db: dict, today_str: str) -> bool:
    robot_cfg = get_robot_config(db)
    archive_days = int(robot_cfg.get("trashAutoArchiveDays") or 14)
    now_utc = datetime.now(timezone.utc)
    for rc in (db.get("robotCases") or []):
        if not isinstance(rc, dict):
            continue
        if rc.get("status") == "cho_mo" and is_valid_iso_date(rc.get("surgeryDate")) and rc["surgeryDate"] < today_str:
            return True
        if rc.get("status") == "da_xoa":
            dt_del = parse_iso_dt(rc.get("deletedAt"))
            if dt_del is not None and (now_utc - dt_del).total_seconds() > archive_days * 86400:
                return True
    for item in (db.get("surgeriesTrash") or []):
        if isinstance(item, dict) and str(item.get("robotCaseId") or "").strip():
            dt_del = parse_iso_dt(item.get("deletedAt"))
            if dt_del is not None and (now_utc - dt_del).total_seconds() > archive_days * 86400:
                return True
    return False


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
    Safely initializes robotConfig, robotCases, surgeriesArchivedInactive, and _revisions.robotCases
    under _DB_LOCK_FILE without mutating or printing any real PHI records.
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

        if changed:
            db["_lastModified"] = datetime.now().isoformat()
            _atomic_write_json(sf_mod.DATA_FILE, db)

        return {"bootstrapped": changed, "robotCasesCount": len(db.get("robotCases") or [])}
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

    # ───────────────────────── Bootstrap & Read ─────────────────────────

    @app.route("/api/robot/bootstrap", methods=["GET"])
    def get_robot_bootstrap():
        os.makedirs(sf_mod.DATA_DIR, exist_ok=True)
        if not os.path.exists(sf_mod.DATA_FILE):
            _atomic_write_json(sf_mod.DATA_FILE, {})

        today_str = _today_vn_iso()

        # Pass 1: Fail-closed auth + detect if lazy rollover needs WAL commit
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
                handler_fn=_apply_lazy_rollover_tx,
            )

        # Pass 2: Read authoritative snapshot under lock and serialize per user
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
                # Baseline KPIs and historical list ALWAYS exclude sandbox records for ALL users including SuperAdmin
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

            return jsonify({
                "ok": True,
                "todayVn": today_str,
                "permissions": perms,
                "robotConfig": get_robot_config(db),
                "cases": visible_cases,
                "historicalRobotSurgeries": historical_robot,
                "unlinkedFutureRobotSurgeries": unlinked_future_robot,
                "surgeons": surgeons,
                "staffAccounts": staff_accounts,
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
                "expectedTimeframe",
                "consultResult",
                "consultNote",
                "wardRoom",
                "note",
                "isTestSandboxCase",
            }
            sched_fields = {
                "surgeryDate",
                "caseSlot",
                "operatingRoom",
                "surgeryTime",
                "durationMinutes",
                "skipStep1",
                "confirmConflict",
                "conflictOverrideReason",
                "expectedConflictFingerprint",
            }
            if action == "create_consult":
                if not perms["canCreateConsult"]:
                    raise ApprovalEngineError(403, "ROBOT_CONSULT_FORBIDDEN", "Tài khoản không có quyền tạo ca tư vấn phẫu thuật Robot.")
                _validate_allowed_fields(body, common_fields)
            else:
                if not perms["canDirectCreateCase"]:
                    raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm hoặc Điều phối viên Robot mới được phép tạo trực tiếp ca xếp lịch Robot.")
                _validate_allowed_fields(body, common_fields | sched_fields)

            patient_name = str(body.get("patientName") or "").strip()
            if not patient_name:
                raise ApprovalEngineError(422, "PATIENT_NAME_REQUIRED", "Vui lòng nhập họ tên bệnh nhân.")
            if is_sbx and "[test]" not in patient_name.lower():
                patient_name = f"[TEST] {patient_name}"

            birth_year = _validate_birth_year(body.get("birthYear"))
            gender = _validate_gender(body.get("gender"))
            phone = normalize_phone_vn(body.get("phone"), required=(action == "create_consult"))
            admission_id = str(body.get("admissionId") or "").strip()
            diagnosis = str(body.get("diagnosis") or "").strip()
            robot_proc = str(body.get("robotProcedure") or "").strip()
            surgeon_id, surgeon_name = _validate_surgeon_id(db, body.get("mainSurgeonId"), required=True)
            assist1 = _validate_assist_surgeon(db, body.get("assistSurgeon1"))

            code = _next_robot_code(db, is_sandbox=is_sbx)
            now_iso = now_vn_iso()
            uname = perms["username"]

            rcase = {
                "robotCaseCode": code,
                "soNV": code,
                "status": "tu_van",
                "patientName": patient_name,
                "birthYear": birth_year,
                "gender": gender,
                "phone": phone,
                "admissionId": admission_id,
                "diagnosis": diagnosis,
                "robotProcedure": robot_proc,
                "mainSurgeonId": surgeon_id,
                "mainSurgeonName": surgeon_name,
                "assistSurgeon1": assist1,
                "expectedTimeframe": str(body.get("expectedTimeframe") or "").strip(),
                "consultResult": str(body.get("consultResult") or "cho").strip() or "cho",
                "consultNote": str(body.get("consultNote") or "").strip(),
                "surgeryDate": "",
                "caseSlot": "",
                "operatingRoom": get_robot_config(db).get("defaultOperatingRoom") or "PM Robot",
                "surgeryTime": "",
                "durationMinutes": int(get_robot_config(db).get("defaultDurationMinutes") or 180),
                "wardRoom": str(body.get("wardRoom") or "").strip(),
                "note": str(body.get("note") or "").strip(),
                "postB2ClinicalDirty": False,
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
                "updatedAt": now_iso,
                "updatedBy": uname,
            }

            override_audit = None
            if action == "create_consult":
                cr = rcase["consultResult"]
                if cr not in ("cho", "dong_y", "can_nhac", "tu_choi"):
                    raise ApprovalEngineError(422, "INVALID_CONSULT_RESULT", "Kết quả tư vấn không hợp lệ.")
                # Security invariant: consult dong_y ALWAYS lands in cho_xep_lich, NEVER skips to B2
                rcase["status"] = {"cho": "tu_van", "dong_y": "cho_xep_lich", "can_nhac": "can_nhac", "tu_choi": "tu_choi"}[cr]
                wal_act = "robot_case_created"
            else:
                has_slot_input = bool(str(body.get("surgeryDate") or "").strip() or str(body.get("caseSlot") or "").strip())
                skip_step1 = bool(body.get("skipStep1") is True)
                if skip_step1 or has_slot_input:
                    sched = _validate_schedule_fields(body, db, require_date_slot=True, allow_past_date=False)
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
                    rcase["status"] = "cho_duyet_tien_phau"
                    rcase["step1ScheduledAt"] = now_iso
                    rcase["step1ScheduledBy"] = uname
                else:
                    rcase["status"] = "cho_xep_lich"
                if rcase["consultResult"] == "cho":
                    rcase["consultResult"] = "dong_y"
                wal_act = "robot_case_created"

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
                    action=wal_act,
                    rcase=rcase,
                    rev_before=0,
                    rev_after=1,
                    summary_extra={"createAction": action},
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

            _validate_allowed_fields(body, {"action", "surgeryId", "phone", "caseSlot", "operatingRoom", "note", "expectedSurgeryRevision"})
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
                raise ApprovalEngineError(422, "INVALID_CASE_SLOT", "Ca mổ không hợp lệ (Ca 1–Ca 6).")
            room = str(body.get("operatingRoom") or get_robot_config(db).get("defaultOperatingRoom") or "PM Robot").strip()

            is_sbx = bool(surg.get("isTestSandboxCase") is True)
            code = _next_robot_code(db, is_sandbox=is_sbx)
            now_iso = now_vn_iso()
            uname = perms["username"]
            s_date = str(surg.get("date") or "").strip()
            today_str = _today_vn_iso()
            is_hist = bool(is_valid_iso_date(s_date) and s_date < today_str)

            rcase = {
                "robotCaseCode": code,
                "soNV": code,
                "status": "da_mo" if is_hist else "cho_mo",
                "completionSource": "linked_historical" if is_hist else None,
                "patientName": str(surg.get("patientName") or "").strip(),
                "birthYear": surg.get("birthYear") if is_pos_int(surg.get("birthYear")) else "",
                "gender": str(surg.get("gender") or ""),
                "phone": phone,
                "admissionId": str(surg.get("admissionId") or "").strip(),
                "diagnosis": str(surg.get("diagnosis") or "").strip(),
                "robotProcedure": str(surg.get("method") or "").strip(),
                "mainSurgeonId": surg.get("mainSurgeon"),
                "mainSurgeonName": resolve_staff_name_by_id(db, surg.get("mainSurgeon")),
                "assistSurgeon1": surg.get("assistSurgeon1") if is_pos_int(surg.get("assistSurgeon1")) else None,
                "consultResult": "dong_y",
                "surgeryDate": s_date,
                "caseSlot": slot,
                "operatingRoom": room,
                "surgeryTime": str(surg.get("surgeryTime") or "").strip(),
                "durationMinutes": int(surg.get("duration") or 180),
                "note": str(body.get("note") or "").strip(),
                "postB2ClinicalDirty": False,
                "inpatientConfirmedAt": now_iso if not is_hist else None,
                "inpatientConfirmedBy": uname if not is_hist else None,
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
                "updatedAt": now_iso,
                "updatedBy": uname,
            }

            # Attach reverse pointer WITHOUT altering surg["approval"]
            surg["robotCaseId"] = code
            surg["robotSyncMeta"] = {
                "operatingRoom": room,
                "caseSlot": slot,
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
            code = _robot_code_of(rcase)
            linked_ops = []
            rec_ref = None
            override_audit = None

            if action == "consult_result":
                _validate_allowed_fields(body, {"action", "expectedRevision", "consultResult", "consultNote", "expectedTimeframe"})
                is_owner = (
                    (rcase.get("createdByUsername") == uname and uname)
                    or (is_pos_int(perms["staffId"]) and rcase.get("mainSurgeonId") == perms["staffId"])
                )
                if not (perms["canManageRobot"] or is_owner):
                    raise ApprovalEngineError(403, "ROBOT_CONSULT_FORBIDDEN", "Chỉ BS phụ trách ca, người tạo hoặc Điều phối viên mới được cập nhật kết quả tư vấn.")
                if cur_status not in ("tu_van", "can_nhac", "tu_choi"):
                    raise ApprovalEngineError(409, "INVALID_STATE_TRANSITION", f"Không thể cập nhật kết quả tư vấn khi ca đang ở trạng thái {cur_status}.")
                cr = str(body.get("consultResult") or "").strip()
                if cr not in ("dong_y", "can_nhac", "tu_choi"):
                    raise ApprovalEngineError(422, "INVALID_CONSULT_RESULT", "Kết quả tư vấn phải là dong_y, can_nhac hoặc tu_choi.")
                rcase["consultResult"] = cr
                if "consultNote" in body:
                    rcase["consultNote"] = str(body.get("consultNote") or "").strip()
                if "expectedTimeframe" in body:
                    rcase["expectedTimeframe"] = str(body.get("expectedTimeframe") or "").strip()
                # Security invariant: dong_y always routes to cho_xep_lich (Step 1 queue), never Step 2
                rcase["status"] = {"dong_y": "cho_xep_lich", "can_nhac": "can_nhac", "tu_choi": "tu_choi"}[cr]
                wal_action = "robot_consult_updated"

            elif action == "schedule_step1":
                _validate_allowed_fields(
                    body,
                    {"action", "expectedRevision", "surgeryDate", "caseSlot", "operatingRoom", "surgeryTime", "durationMinutes", "mainSurgeonId", "assistSurgeon1", "note", "confirmConflict", "conflictOverrideReason", "expectedConflictFingerprint"},
                )
                if not perms["canEditSchedule"]:
                    raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm hoặc Điều phối viên Robot mới có quyền xếp lịch Bước 1.")
                if cur_status not in ("tu_van", "can_nhac", "cho_xep_lich"):
                    raise ApprovalEngineError(409, "INVALID_STATE_TRANSITION", f"Không thể xếp lịch B1 từ trạng thái {cur_status}.")
                if "mainSurgeonId" in body:
                    sid, sname = _validate_surgeon_id(db, body.get("mainSurgeonId"), required=True)
                    rcase["mainSurgeonId"] = sid
                    rcase["mainSurgeonName"] = sname
                if "assistSurgeon1" in body:
                    rcase["assistSurgeon1"] = _validate_assist_surgeon(db, body.get("assistSurgeon1"))
                sched = _validate_schedule_fields(body, db, existing_case=rcase, require_date_slot=True, allow_past_date=False)
                override_audit = _check_conflict_or_override(
                    db,
                    candidate={**rcase, **sched},
                    exclude_robot_code=code,
                    exclude_surgery_id=rcase.get("canonicalSurgeryId"),
                    body=body,
                    perms=perms,
                )
                rcase.update(sched)
                if "note" in body:
                    rcase["note"] = str(body.get("note") or "").strip()
                if override_audit:
                    rcase.setdefault("conflictOverrideHistory", []).append(override_audit)
                rcase["status"] = "cho_duyet_tien_phau"
                rcase["consultResult"] = "dong_y"
                rcase["postB2ClinicalDirty"] = False
                rcase["step1ScheduledAt"] = now_iso
                rcase["step1ScheduledBy"] = uname
                wal_action = "robot_step1_scheduled"

            elif action == "preop_step2":
                _validate_allowed_fields(body, {"action", "expectedRevision", "note"})
                if not perms["canApproveSteps"]:
                    raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm hoặc Điều phối viên Robot mới có quyền xác nhận Tiền phẫu (B2).")
                if cur_status != "cho_duyet_tien_phau":
                    raise ApprovalEngineError(409, "INVALID_STATE_TRANSITION", f"Ca phải đang ở bước Chờ duyệt tiền phẫu để thực hiện B2 (hiện tại: {cur_status}).")
                if not is_valid_iso_date(rcase.get("surgeryDate")) or not rcase.get("caseSlot"):
                    raise ApprovalEngineError(422, "SCHEDULE_DATE_SLOT_REQUIRED", "Ca chưa có đầy đủ ngày mổ và ca mổ.")
                if "note" in body:
                    rcase["note"] = str(body.get("note") or "").strip()
                rcase["preopApprovedAt"] = now_iso
                rcase["preopApprovedBy"] = uname
                rcase["postB2ClinicalDirty"] = False
                rcase["status"] = "cho_duyet_luu_vien"
                wal_action = "robot_step2_preop"

            elif action == "inpatient_step3":
                _validate_allowed_fields(body, {"action", "expectedRevision", "admissionId", "wardRoom", "note", "confirmConflict", "conflictOverrideReason", "expectedConflictFingerprint"})
                if not perms["canApproveSteps"]:
                    raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm hoặc Điều phối viên Robot mới có quyền xác nhận Ở lại chờ mổ (B3).")
                if cur_status != "cho_duyet_luu_vien":
                    raise ApprovalEngineError(409, "INVALID_STATE_TRANSITION", f"Ca phải đang ở bước Chờ duyệt lưu viện để lên B3 (hiện tại: {cur_status}).")
                if rcase.get("postB2ClinicalDirty") is True:
                    raise ApprovalEngineError(409, "PREOP_REAPPROVAL_REQUIRED", "Thông tin lâm sàng đã sửa sau bước B2 — cần duyệt lại Tiền phẫu (B2) trước khi lên B3.")
                if "admissionId" in body:
                    rcase["admissionId"] = str(body.get("admissionId") or "").strip()
                if "wardRoom" in body:
                    rcase["wardRoom"] = str(body.get("wardRoom") or "").strip()
                if "note" in body:
                    rcase["note"] = str(body.get("note") or "").strip()

                override_audit = _check_conflict_or_override(
                    db,
                    candidate=rcase,
                    exclude_robot_code=code,
                    exclude_surgery_id=rcase.get("canonicalSurgeryId"),
                    body=body,
                    perms=perms,
                )
                if override_audit:
                    rcase.setdefault("conflictOverrideHistory", []).append(override_audit)

                rcase["status"] = "cho_mo"
                rcase["inpatientConfirmedAt"] = now_iso
                rcase["inpatientConfirmedBy"] = uname
                rcase["caseRevision"] = rev_before + 1
                rcase["updatedAt"] = now_iso
                rcase["updatedBy"] = uname

                rec_ref, s_op = _upsert_active_linked_surgery(
                    db,
                    rcase,
                    catalog=catalog,
                    cfg=cfg,
                    actor_username=uname,
                    event_label="robot_step3_inpatient",
                )
                linked_ops.append(s_op)
                wal_action = "robot_step3_inpatient"

            elif action == "edit_info":
                _validate_allowed_fields(
                    body,
                    {"action", "expectedRevision", "patientName", "birthYear", "gender", "phone", "admissionId", "diagnosis", "robotProcedure", "mainSurgeonId", "assistSurgeon1", "wardRoom", "note", "expectedTimeframe", "consultNote"},
                )
                is_owner = (
                    (rcase.get("createdByUsername") == uname and uname)
                    or (is_pos_int(perms["staffId"]) and rcase.get("mainSurgeonId") == perms["staffId"])
                )
                if cur_status == "da_mo":
                    if not perms["canManageRobot"]:
                        raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Ca đã mổ chỉ Ban Chủ nhiệm hoặc Điều phối viên Robot mới được chỉnh sửa.")
                elif cur_status in ("cho_mo", "hoan_mo", "xuat_vien_cho"):
                    if not (perms["canManageRobot"] or is_owner):
                        raise ApprovalEngineError(403, "ROBOT_EDIT_FORBIDDEN", "Chỉ BS phụ trách ca hoặc Điều phối viên Robot mới được sửa thông tin ở trạng thái này.")
                else:
                    if not perms["canEditInfo"]:
                        raise ApprovalEngineError(403, "ROBOT_EDIT_FORBIDDEN", "Tài khoản không có quyền chỉnh sửa thông tin ca Robot.")

                if "mainSurgeonId" in body and not perms["canEditSchedule"] and body.get("mainSurgeonId") != rcase.get("mainSurgeonId") and cur_status in ("cho_mo", "cho_duyet_tien_phau", "cho_duyet_luu_vien"):
                    raise ApprovalEngineError(403, "ROBOT_SCHEDULE_COORDINATOR_REQUIRED", "Chỉ Điều phối viên Robot hoặc Ban Chủ nhiệm mới được đổi PTV chính sau khi đã xếp lịch.")

                old_core = {f: rcase.get(f) for f in ROBOT_CLINICAL_CORE_FIELDS}
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
                if "wardRoom" in body:
                    rcase["wardRoom"] = str(body.get("wardRoom") or "").strip()
                if "note" in body:
                    rcase["note"] = str(body.get("note") or "").strip()
                if "expectedTimeframe" in body:
                    rcase["expectedTimeframe"] = str(body.get("expectedTimeframe") or "").strip()
                if "consultNote" in body:
                    rcase["consultNote"] = str(body.get("consultNote") or "").strip()

                clinical_changed = [f for f in ROBOT_CLINICAL_CORE_FIELDS if (old_core.get(f) or None) != (rcase.get(f) or None)]
                if clinical_changed and cur_status == "cho_duyet_luu_vien":
                    rcase["status"] = "cho_duyet_tien_phau"
                    rcase["postB2ClinicalDirty"] = True
                    rcase["preopApprovedAt"] = None
                    rcase["preopApprovedBy"] = None

                rcase["caseRevision"] = rev_before + 1
                rcase["updatedAt"] = now_iso
                rcase["updatedBy"] = uname

                if rcase.get("status") == "cho_mo" and is_pos_int(rcase.get("activeLinkedSurgeryId")):
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
                    {"action", "expectedRevision", "surgeryDate", "caseSlot", "operatingRoom", "surgeryTime", "durationMinutes", "mainSurgeonId", "assistSurgeon1", "note", "confirmConflict", "conflictOverrideReason", "expectedConflictFingerprint"},
                )
                if not perms["canEditSchedule"]:
                    raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm hoặc Điều phối viên Robot mới có quyền điều chỉnh lịch mổ Robot.")
                if cur_status not in ("cho_duyet_tien_phau", "cho_duyet_luu_vien", "cho_mo"):
                    raise ApprovalEngineError(409, "INVALID_STATE_TRANSITION", f"Chỉ chỉnh lịch trực tiếp cho ca đang chờ mổ/duyệt (hiện tại: {cur_status}).")

                if "mainSurgeonId" in body:
                    sid, sname = _validate_surgeon_id(db, body.get("mainSurgeonId"), required=True)
                    rcase["mainSurgeonId"] = sid
                    rcase["mainSurgeonName"] = sname
                if "assistSurgeon1" in body:
                    rcase["assistSurgeon1"] = _validate_assist_surgeon(db, body.get("assistSurgeon1"))

                sched = _validate_schedule_fields(body, db, existing_case=rcase, require_date_slot=True, allow_past_date=False)
                override_audit = _check_conflict_or_override(
                    db,
                    candidate={**rcase, **sched, "mainSurgeonId": rcase.get("mainSurgeonId")},
                    exclude_robot_code=code,
                    exclude_surgery_id=rcase.get("canonicalSurgeryId"),
                    body=body,
                    perms=perms,
                )
                rcase.update(sched)
                if "note" in body:
                    rcase["note"] = str(body.get("note") or "").strip()
                if override_audit:
                    rcase.setdefault("conflictOverrideHistory", []).append(override_audit)

                rcase["caseRevision"] = rev_before + 1
                rcase["updatedAt"] = now_iso
                rcase["updatedBy"] = uname

                if cur_status == "cho_mo" or is_pos_int(rcase.get("activeLinkedSurgeryId")):
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

            elif action == "inline_note":
                _validate_allowed_fields(body, {"action", "expectedRevision", "note", "wardRoom"})
                if not perms["canInlineNote"]:
                    raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm hoặc Điều phối viên Robot mới có quyền ghi chú nhanh trên lưới lịch.")
                if "note" in body:
                    rcase["note"] = str(body.get("note") or "").strip()
                if "wardRoom" in body:
                    rcase["wardRoom"] = str(body.get("wardRoom") or "").strip()
                wal_action = "robot_note_updated"

            elif action == "discharge_wait":
                _validate_allowed_fields(body, {"action", "expectedRevision", "dischargeReason", "note"})
                if not perms["canPostponeOrDischarge"]:
                    raise ApprovalEngineError(403, "ROBOT_DISCHARGE_FORBIDDEN", "Tài khoản không có quyền chuyển ca sang Xuất viện chờ.")
                if cur_status not in ("cho_duyet_tien_phau", "cho_duyet_luu_vien", "cho_mo"):
                    raise ApprovalEngineError(409, "INVALID_STATE_TRANSITION", f"Không thể xuất viện chờ từ trạng thái {cur_status}.")
                reason = str(body.get("dischargeReason") or "").strip()
                if len(reason) < 3:
                    raise ApprovalEngineError(422, "DISCHARGE_REASON_REQUIRED", "Vui lòng nhập lý do cho xuất viện chờ (tối thiểu 3 ký tự).")
                rcase["status"] = "xuat_vien_cho"
                rcase["dischargeReason"] = reason
                rcase["dischargedWaitAt"] = now_iso
                rcase["dischargedWaitBy"] = uname
                rcase["previousScheduleSnapshot"] = {
                    "surgeryDate": rcase.get("surgeryDate"),
                    "caseSlot": rcase.get("caseSlot"),
                    "operatingRoom": rcase.get("operatingRoom"),
                    "statusBefore": cur_status,
                }
                if "note" in body:
                    rcase["note"] = str(body.get("note") or "").strip()
                t_op = _move_active_surgery_to_trash(
                    db,
                    rcase,
                    actor_username=uname,
                    deleted_reason=f"robot_discharge_wait:{reason}",
                    event_label="robot_discharged_wait",
                )
                if t_op:
                    linked_ops.append(t_op)
                wal_action = "robot_discharged_wait"

            elif action == "readmit":
                _validate_allowed_fields(body, {"action", "expectedRevision", "surgeryDate", "caseSlot", "operatingRoom", "surgeryTime", "durationMinutes", "newEpisode", "note", "confirmConflict", "conflictOverrideReason", "expectedConflictFingerprint"})
                if not perms["canEditSchedule"]:
                    raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm hoặc Điều phối viên Robot mới có quyền nhập lại bệnh nhân chờ.")
                if cur_status != "xuat_vien_cho":
                    raise ApprovalEngineError(409, "INVALID_STATE_TRANSITION", "Chỉ thực hiện nhập lại từ trạng thái Xuất viện chờ.")
                sched = _validate_schedule_fields(body, db, existing_case=rcase, require_date_slot=True, allow_past_date=False)
                new_episode = bool(body.get("newEpisode") is True)
                if new_episode and is_pos_int(rcase.get("canonicalSurgeryId")):
                    arch_op = _archive_linked_surgery_inactive(
                        db,
                        rcase,
                        actor_username=uname,
                        reason="robot_readmit_new_episode",
                        superseded=True,
                    )
                    if arch_op:
                        linked_ops.append(arch_op)
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
                if "note" in body:
                    rcase["note"] = str(body.get("note") or "").strip()
                rcase["status"] = "cho_duyet_tien_phau"
                rcase["preopApprovedAt"] = None
                rcase["preopApprovedBy"] = None
                rcase["inpatientConfirmedAt"] = None
                rcase["inpatientConfirmedBy"] = None
                rcase["postB2ClinicalDirty"] = False
                wal_action = "robot_readmitted"

            elif action == "postpone":
                _validate_allowed_fields(body, {"action", "expectedRevision", "postponeReasonCode", "postponeReasonNote", "forceLookbackOverride", "note"})
                is_surgeon_owner = is_pos_int(perms["staffId"]) and rcase.get("mainSurgeonId") == perms["staffId"]
                if not (perms["canManageRobot"] or is_surgeon_owner or perms["canPostponeOrDischarge"]):
                    raise ApprovalEngineError(403, "ROBOT_POSTPONE_FORBIDDEN", "Tài khoản không có quyền hoãn ca phẫu thuật Robot.")
                if cur_status not in ("cho_duyet_tien_phau", "cho_duyet_luu_vien", "cho_mo", "da_mo"):
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
                    "statusBefore": cur_status,
                }
                rcase["status"] = "hoan_mo"
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

            elif action == "restore_to_schedule":
                _validate_allowed_fields(
                    body,
                    {"action", "expectedRevision", "surgeryDate", "caseSlot", "operatingRoom", "surgeryTime", "durationMinutes", "targetStep", "newEpisode", "note", "confirmConflict", "conflictOverrideReason", "expectedConflictFingerprint"},
                )
                if not perms["canEditSchedule"]:
                    raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm hoặc Điều phối viên Robot mới có quyền xếp lịch lại cho ca hoãn/chờ.")
                if cur_status not in ("hoan_mo", "xuat_vien_cho"):
                    raise ApprovalEngineError(409, "INVALID_STATE_TRANSITION", f"Chỉ xếp lịch lại từ trạng thái Hoãn mổ hoặc Xuất viện chờ (hiện tại: {cur_status}).")

                target_step = str(body.get("targetStep") or "cho_duyet_tien_phau").strip()
                if target_step not in ("cho_duyet_tien_phau", "cho_mo"):
                    raise ApprovalEngineError(422, "INVALID_TARGET_STEP", "Bước đích chỉ hỗ trợ cho_duyet_tien_phau hoặc cho_mo.")
                new_episode = bool(body.get("newEpisode") is True)
                if new_episode and target_step == "cho_mo":
                    raise ApprovalEngineError(422, "NEW_EPISODE_MUST_RECHECK_PREOP", "Khi tạo đợt điều trị mới (newEpisode=true), ca bệnh bắt buộc đi qua bước Khám tiền phẫu B2.")

                sched = _validate_schedule_fields(body, db, existing_case=rcase, require_date_slot=True, allow_past_date=False)
                if new_episode and is_pos_int(rcase.get("canonicalSurgeryId")):
                    arch_op = _archive_linked_surgery_inactive(
                        db,
                        rcase,
                        actor_username=uname,
                        reason="robot_restore_new_episode",
                        superseded=True,
                    )
                    if arch_op:
                        linked_ops.append(arch_op)

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
                if "note" in body:
                    rcase["note"] = str(body.get("note") or "").strip()

                rcase["status"] = target_step
                rcase["caseRevision"] = rev_before + 1
                rcase["updatedAt"] = now_iso
                rcase["updatedBy"] = uname

                if target_step == "cho_mo":
                    rcase["inpatientConfirmedAt"] = now_iso
                    rcase["inpatientConfirmedBy"] = uname
                    rec_ref, s_op = _upsert_active_linked_surgery(
                        db,
                        rcase,
                        catalog=catalog,
                        cfg=cfg,
                        actor_username=uname,
                        event_label="robot_restored_to_schedule",
                    )
                    linked_ops.append(s_op)
                else:
                    rcase["preopApprovedAt"] = None
                    rcase["preopApprovedBy"] = None
                    rcase["inpatientConfirmedAt"] = None
                    rcase["inpatientConfirmedBy"] = None
                    rcase["postB2ClinicalDirty"] = False

                wal_action = "robot_restored_to_schedule"

            elif action == "soft_delete":
                _validate_allowed_fields(body, {"action", "expectedRevision", "deleteReason"})
                if not perms["canSoftDelete"]:
                    raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm hoặc Điều phối viên Robot mới có quyền đưa ca vào Thùng rác.")
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
                _validate_allowed_fields(body, {"action", "expectedRevision", "surgeryDate", "caseSlot", "operatingRoom", "confirmConflict", "conflictOverrideReason", "expectedConflictFingerprint"})
                if not perms["canSoftDelete"]:
                    raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm hoặc Điều phối viên Robot mới có quyền khôi phục ca từ Thùng rác.")
                if cur_status != "da_xoa":
                    raise ApprovalEngineError(409, "NOT_IN_TRASH", "Ca bệnh không ở trạng thái Thùng rác.")

                prev_st = rcase.get("preDeleteStatus") or "cho_xep_lich"
                if "surgeryDate" in body or "caseSlot" in body:
                    sched = _validate_schedule_fields(body, db, existing_case=rcase, require_date_slot=True, allow_past_date=False)
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
                    rcase["status"] = "cho_duyet_tien_phau"
                elif prev_st in ("tu_van", "can_nhac", "tu_choi", "cho_xep_lich", "hoan_mo", "xuat_vien_cho"):
                    rcase["status"] = prev_st
                else:
                    # Safe anti-collision restore: slot-holding active states return to cho_xep_lich rather than auto-reoccupying a slot or surgeries[]
                    rcase["status"] = "cho_xep_lich"
                rcase["preopApprovedAt"] = None
                rcase["preopApprovedBy"] = None
                rcase["inpatientConfirmedAt"] = None
                rcase["inpatientConfirmedBy"] = None
                rcase["deletedAt"] = None
                rcase["deletedBy"] = None
                rcase["deleteReason"] = None
                wal_action = "robot_restored_trash"

            else:
                raise ApprovalEngineError(422, "INVALID_ACTION", f"Hành động cập nhật không hợp lệ: {action}.")

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
                raise ApprovalEngineError(403, "ROBOT_COORDINATOR_REQUIRED", "Chỉ Ban Chủ nhiệm hoặc Điều phối viên Robot mới có quyền lưu trữ ẩn hồ sơ từ Thùng rác.")
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

            # Zero-RM invariant: NEVER remove from db["robotCases"]; transition to archived_deleted & archive any trash surgery
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
                raise ApprovalEngineError(403, "ROBOT_BCN_REQUIRED", "Chỉ Ban Chủ nhiệm khoa hoặc Super Admin mới có quyền cấu hình Điều phối viên Robot.")

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
