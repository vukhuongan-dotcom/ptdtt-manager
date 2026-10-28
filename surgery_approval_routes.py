#!/usr/bin/env python3
"""
Flask Route Handlers & 5-Step WAL-First Atomic Transaction Coordinator
for Departmental Online Surgery Approval (Khoa PTĐTT — Bệnh viện Bình Dân).
"""

import copy
import fcntl
import json
import os
import uuid
from datetime import datetime, timezone

from flask import jsonify, request

from surgery_approval_engine import (
    APPROVAL_METADATA_FIELDS_TO_STRIP,
    ATTENDING_STAFF_IDS,
    BCN_STAFF_IDS,
    CHIEF_STAFF_ID,
    CK_CODES,
    DEFAULT_SURGERY_APPROVAL_CONFIG,
    DEPUTY_STAFF_ID,
    PROTECTED_APPROVAL_COLLECTIONS,
    RULE_VERSION,
    SCHEMA_VERSION,
    TRAINEE_STAFF_IDS,
    ApprovalEngineError,
    append_wal_journal_entry,
    apply_draft_updates,
    build_approval_notifications,
    build_idempotency_record,
    build_initial_unverified_structures,
    build_sandbox_sample_surgeries,
    check_idempotency,
    compute_sla_status,
    find_active_delegation_for_deputy,
    get_approval_config,
    get_journal_path,
    get_pod_room_info,
    is_attending_user,
    is_bcn_user,
    is_pos_int,
    is_same_pod_attending,
    is_strict_int,
    is_valid_iso_date,
    load_procedure_catalog,
    now_vn,
    now_vn_iso,
    parse_iso_dt,
    reconcile_journal_and_db,
    resolve_effective_actor,
    resolve_live_user_fail_closed,
    run_surgery_approval_migration,
    stamp_badge_fields,
    strip_approval_metadata_from_real_surgeries,
    suggest_urgency_level,
    validate_routine_submit_gate,
    verify_approval_journal_chain,
)


def _atomic_write_json(path: str, payload: dict):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as wf:
        json.dump(payload, wf, ensure_ascii=False, indent=2)
        wf.flush()
        os.fsync(wf.fileno())
    os.replace(tmp, path)


def ensure_approval_bootstrapped(sf_mod) -> dict:
    """
    Acquires LOCK_EX on _DB_LOCK_FILE, runs WAL crash reconciliation + M1..M5 idempotent migration,
    and persists db.json only if changes occurred.
    """
    os.makedirs(sf_mod.DATA_DIR, exist_ok=True)
    if not os.path.exists(sf_mod.DATA_FILE):
        _atomic_write_json(sf_mod.DATA_FILE, {})

    lock_fd = open(sf_mod._DB_LOCK_FILE, "a+")
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        with open(sf_mod.DATA_FILE, "r", encoding="utf-8") as rf:
            db = json.load(rf)

        had_cfg = isinstance(db.get("surgeryApprovalConfig"), dict)
        journal_rep = reconcile_journal_and_db(db, get_journal_path(sf_mod.DATA_DIR))
        mig_rep = run_surgery_approval_migration(db, sf_mod.DATA_DIR, sf_mod.BASE_DIR)

        migrated_any = any(v > 0 for k, v in mig_rep["counts"].items() if k != "alreadyMigrated")
        if journal_rep["replayedEvents"] > 0 or migrated_any or not had_cfg:
            db["_lastModified"] = datetime.now().isoformat()
            _atomic_write_json(sf_mod.DATA_FILE, db)

        return {"journal": journal_rep, "migration": mig_rep}
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        lock_fd.close()


def _purge_expired_trash_in_place(db: dict, days: int = 7) -> int:
    trash = db.get("surgeriesTrash")
    if not isinstance(trash, list) or not trash:
        return 0
    now_utc = datetime.now(timezone.utc)
    kept = []
    purged = 0
    for item in trash:
        if not isinstance(item, dict):
            continue
        del_at = item.get("deletedAt")
        expired = False
        if isinstance(del_at, str) and del_at.strip():
            try:
                dt = datetime.fromisoformat(del_at.strip().replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if (now_utc - dt).total_seconds() > days * 86400:
                    expired = True
            except ValueError:
                pass
        if expired:
            purged += 1
        else:
            kept.append(item)
    if purged > 0:
        db["surgeriesTrash"] = kept
        revs = db.setdefault("_revisions", {})
        revs["surgeriesTrash"] = int(revs.get("surgeriesTrash", 1)) + 1
    return purged


def register_surgery_approval_routes(app, sf_mod):
    """Registers all Departmental Surgery Approval, Atomic Trash/Restore, Notification & Disaster-Restore APIs."""

    def _check_client_build_or_raise(user_label: str, action_label: str):
        cb = sf_mod._client_build()
        if cb < sf_mod.MIN_CLIENT_BUILD:
            sf_mod.audit_log(user_label, f"{action_label}.stale_client", {"clientBuild": cb, "requiredBuild": sf_mod.MIN_CLIENT_BUILD})
            raise ApprovalEngineError(
                409,
                "STALE_CLIENT",
                "Phiên bản ứng dụng đã cũ. Vui lòng tải lại trang trước khi thao tác.",
                {"requiredBuild": sf_mod.MIN_CLIENT_BUILD},
            )

    def _require_expected_revision(body: dict, surgery: dict):
        exp = (body or {}).get("expectedCaseRevision")
        cur = surgery.get("caseRevision", 1)
        if not is_strict_int(exp) or exp != cur:
            raise ApprovalEngineError(
                409,
                "CASE_REVISION_MISMATCH",
                "Dữ liệu ca mổ vừa được cập nhật ở phiên làm việc khác. Vui lòng tải lại bản mới nhất.",
                {
                    "currentCaseRevision": cur,
                    "expectedCaseRevision": exp,
                    "serverSurgery": copy.deepcopy(surgery),
                },
            )

    def _find_surgery_or_404(db: dict, sid: int) -> dict:
        for s in (db.get("surgeries") or []):
            if isinstance(s, dict) and s.get("id") == sid:
                return s
        raise ApprovalEngineError(404, "SURGERY_NOT_FOUND", f"Không tìm thấy ca mổ #{sid}.")

    def _run_wal_tx(
        *,
        action_key: str,
        surgery_id=None,
        enforce_canary_gate: bool = True,
        require_build_header: bool = True,
        allow_sandbox_delegation_sim: bool = False,
        handler_fn,
    ):
        """
        5-Step WAL-First Atomic Transaction Coordinator:
          Step 1: Acquire LOCK_EX on _DB_LOCK_FILE -> load db.json -> reconcile WAL -> Fail-Closed Auth -> Idempotency check.
          Step 2: Execute handler_fn in memory (RBAC + OCC + validation + notifications).
          Step 3: Append & fsync hash-chained entry to data/surgery_approval_logs.jsonl BEFORE touching db.json.
          Step 4: Write + fsync db.json.tmp -> os.replace(tmp, db.json).
          Step 5: Release LOCK_EX and return HTTP JSON response.
        """
        body = request.get_json(force=True, silent=True)
        if body is None:
            body = {}
        if not isinstance(body, dict):
            return jsonify({"error": "JSON body phải là object.", "code": "INVALID_PAYLOAD", "errorCode": "INVALID_PAYLOAD"}), 400

        os.makedirs(sf_mod.DATA_DIR, exist_ok=True)
        if not os.path.exists(sf_mod.DATA_FILE):
            _atomic_write_json(sf_mod.DATA_FILE, {})

        lock_fd = open(sf_mod._DB_LOCK_FILE, "a+")
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_EX)
            with open(sf_mod.DATA_FILE, "r", encoding="utf-8") as rf:
                db = json.load(rf)

            reconcile_journal_and_db(db, get_journal_path(sf_mod.DATA_DIR))
            if not isinstance(db.get("surgeryApprovalConfig"), dict):
                run_surgery_approval_migration(db, sf_mod.DATA_DIR, sf_mod.BASE_DIR)

            real_user = resolve_live_user_fail_closed(
                request.headers.get("Authorization", ""),
                sf_mod._verify_jwt,
                sf_mod.AUTH_FILE,
                db,
                sf_mod._save_auth,
            )

            if require_build_header:
                _check_client_build_or_raise(real_user.get("username", "unknown"), action_key)

            cfg = get_approval_config(db)
            if enforce_canary_gate and cfg.get("rolloutAccessMode") == "superadmin_only" and not real_user.get("isSuperAdmin"):
                raise ApprovalEngineError(
                    403,
                    "CANARY_SUPERADMIN_ONLY",
                    "Tính năng Duyệt mổ tại khoa đang ở chế độ thử nghiệm dành riêng cho Super Admin.",
                )

            target_surgery = None
            if is_pos_int(surgery_id):
                target_surgery = next(
                    (s for s in (db.get("surgeries") or []) if isinstance(s, dict) and s.get("id") == surgery_id),
                    None,
                )
                if target_surgery is None:
                    target_surgery = next(
                        (t for t in (db.get("surgeriesTrash") or []) if isinstance(t, dict) and t.get("id") == surgery_id),
                        None,
                    )

            actor = resolve_effective_actor(
                real_user,
                request.headers.get("X-Simulate-Staff-Id", ""),
                target_surgery,
                db,
                allow_sandbox_delegation_sim=allow_sandbox_delegation_sim,
            )

            case_approval_actions = {
                "draft",
                "request_verify",
                "submit",
                "submit_emergency",
                "preapprove",
                "approve",
                "return",
                "hold_post_approval",
                "release_hold",
                "revoke",
            }
            if (
                action_key in case_approval_actions
                and cfg.get("sandboxOnlyMode") is True
                and target_surgery is not None
                and target_surgery.get("isTestSandboxCase") is not True
            ):
                raise ApprovalEngineError(
                    403,
                    "SANDBOX_ONLY_MODE",
                    "Tab Duyệt mổ đang ở chế độ Chỉ dùng ca TEST giả lập — không thao tác trên bệnh nhân thật.",
                )

            idem_key = request.headers.get("Idempotency-Key", "")
            cached_status, cached_resp, scope_key = check_idempotency(
                db,
                actor.get("staffId", 0),
                surgery_id if surgery_id is not None else "global",
                action_key,
                idem_key,
                body,
            )
            if cached_resp is not None:
                return jsonify(cached_resp), cached_status

            fingerprint = None
            if scope_key:
                from surgery_approval_engine import canonical_json, sha256_hex
                fingerprint = sha256_hex(canonical_json(body))

            catalog = load_procedure_catalog(sf_mod.DATA_DIR, sf_mod.BASE_DIR)
            tx_out = handler_fn(db=db, body=body, real_user=real_user, actor=actor, catalog=catalog, cfg=cfg)

            http_status = int(tx_out.get("httpStatus", 200))
            resp_payload = tx_out["response"]
            wal_spec = tx_out.get("wal")

            idem_rec = build_idempotency_record(scope_key, fingerprint, http_status, resp_payload)
            if idem_rec:
                db.setdefault("_approvalIdempotency", {})[idem_rec["scopeKey"]] = copy.deepcopy(idem_rec["value"])

            if wal_spec:
                entry = append_wal_journal_entry(
                    sf_mod.DATA_DIR,
                    db,
                    action=wal_spec["action"],
                    actor=actor,
                    surgery_id=wal_spec.get("surgeryId", surgery_id),
                    case_rev_before=wal_spec.get("caseRevBefore"),
                    case_rev_after=wal_spec.get("caseRevAfter"),
                    delegation_id=wal_spec.get("delegationId"),
                    summary=wal_spec.get("summary"),
                    committed_state_patch=wal_spec.get("committedStatePatch"),
                    committed_notifications=wal_spec.get("committedNotifications"),
                    idempotency_record=idem_rec,
                )
                rec_in_db = wal_spec.get("recordRef")
                if isinstance(rec_in_db, dict):
                    rec_in_db["lastJournalSeq"] = entry["eventSeq"]
                    if isinstance(resp_payload.get("surgery"), dict) and resp_payload["surgery"].get("id") == rec_in_db.get("id"):
                        resp_payload["surgery"]["lastJournalSeq"] = entry["eventSeq"]
                resp_payload["journalSeq"] = entry["eventSeq"]

                # Re-sync idempotency snapshot with journalSeq
                if idem_rec:
                    idem_rec["value"]["responseSnapshot"] = copy.deepcopy(resp_payload)
                    db["_approvalIdempotency"][idem_rec["scopeKey"]] = copy.deepcopy(idem_rec["value"])

            if isinstance(resp_payload, dict) and isinstance(db.get("_revisions"), dict):
                resp_payload.setdefault("revisions", copy.deepcopy(db["_revisions"]))
            db["_lastModified"] = datetime.now().isoformat()
            _atomic_write_json(sf_mod.DATA_FILE, db)
            resp_payload["version"] = sf_mod._get_file_version()
            return jsonify(resp_payload), http_status

        except ApprovalEngineError as e:
            return jsonify(e.to_dict()), e.status_code
        finally:
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
            lock_fd.close()

    # ───────────────────────── Catalog & Config Endpoints ─────────────────────────

    @app.route("/api/surgery-approval/catalog", methods=["GET"])
    def get_surgery_approval_catalog():
        try:
            db = sf_mod.load_data()
            real_user = resolve_live_user_fail_closed(
                request.headers.get("Authorization", ""),
                sf_mod._verify_jwt,
                sf_mod.AUTH_FILE,
                db,
                sf_mod._save_auth,
            )
            cfg = get_approval_config(db)
            if cfg.get("rolloutAccessMode") == "superadmin_only" and not real_user.get("isSuperAdmin"):
                return jsonify({
                    "enabledForCurrentUser": False,
                    "config": {"rolloutAccessMode": "superadmin_only", "zeroHisCoupling": True},
                })
            catalog = load_procedure_catalog(sf_mod.DATA_DIR, sf_mod.BASE_DIR)
            return jsonify({
                "enabledForCurrentUser": True,
                "config": cfg,
                "catalog": catalog,
            })
        except ApprovalEngineError as e:
            return jsonify(e.to_dict()), e.status_code

    @app.route("/api/surgery-approval/config", methods=["GET"])
    def get_surgery_approval_config_route():
        try:
            db = sf_mod.load_data()
            real_user = resolve_live_user_fail_closed(
                request.headers.get("Authorization", ""),
                sf_mod._verify_jwt,
                sf_mod.AUTH_FILE,
                db,
                sf_mod._save_auth,
            )
            cfg = get_approval_config(db)
            if cfg.get("rolloutAccessMode") == "superadmin_only" and not real_user.get("isSuperAdmin"):
                return jsonify({
                    "enabledForCurrentUser": False,
                    "config": {"rolloutAccessMode": "superadmin_only", "zeroHisCoupling": True},
                })
            return jsonify({"enabledForCurrentUser": True, "config": cfg})
        except ApprovalEngineError as e:
            return jsonify(e.to_dict()), e.status_code

    @app.route("/api/surgery-approval/config", methods=["PUT"])
    def put_surgery_approval_config_route():
        def _handler(db, body, real_user, actor, catalog, cfg):
            if not real_user.get("isSuperAdmin"):
                raise ApprovalEngineError(403, "SUPERADMIN_REQUIRED", "Chỉ Super Admin mới có quyền cập nhật cấu hình Duyệt mổ.")
            new_cfg = copy.deepcopy(cfg)
            remigrate = False
            if "rolloutAccessMode" in body:
                if body["rolloutAccessMode"] not in ("superadmin_only", "all_staff"):
                    raise ApprovalEngineError(422, "INVALID_CONFIG", "rolloutAccessMode phải là 'superadmin_only' hoặc 'all_staff'.")
                if body["rolloutAccessMode"] != cfg.get("rolloutAccessMode"):
                    remigrate = True
                    if "sandboxOnlyMode" not in body:
                        new_cfg["sandboxOnlyMode"] = (body["rolloutAccessMode"] == "superadmin_only")
                new_cfg["rolloutAccessMode"] = body["rolloutAccessMode"]
            if "sandboxOnlyMode" in body:
                if not isinstance(body["sandboxOnlyMode"], bool):
                    raise ApprovalEngineError(422, "INVALID_CONFIG", "sandboxOnlyMode phải là kiểu boolean (true/false).")
                if body["sandboxOnlyMode"] != cfg.get("sandboxOnlyMode"):
                    remigrate = True
                new_cfg["sandboxOnlyMode"] = body["sandboxOnlyMode"]
            if "checklistMode" in body:
                if body["checklistMode"] not in ("off", "shadow_optional", "enforced_gate"):
                    raise ApprovalEngineError(422, "INVALID_CONFIG", "checklistMode phải là 'off', 'shadow_optional' hoặc 'enforced_gate'.")
                new_cfg["checklistMode"] = body["checklistMode"]
            if "rolloutEffectiveSurgeryDate" in body:
                if not is_valid_iso_date(body["rolloutEffectiveSurgeryDate"]):
                    raise ApprovalEngineError(422, "INVALID_CONFIG", "rolloutEffectiveSurgeryDate phải có định dạng YYYY-MM-DD.")
                if body["rolloutEffectiveSurgeryDate"] != cfg.get("rolloutEffectiveSurgeryDate"):
                    remigrate = True
                new_cfg["rolloutEffectiveSurgeryDate"] = body["rolloutEffectiveSurgeryDate"]
            if "nsthInternalPrecheckEnabled" in body:
                new_cfg["nsthInternalPrecheckEnabled"] = bool(body["nsthInternalPrecheckEnabled"])

            db["surgeryApprovalConfig"] = new_cfg
            mig_summary = None
            if remigrate:
                mig_summary = run_surgery_approval_migration(db, sf_mod.DATA_DIR, sf_mod.BASE_DIR)

            resp = {"ok": True, "config": new_cfg, "migration": mig_summary}
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": "update_approval_config",
                    "surgeryId": None,
                    "summary": {
                        "rolloutAccessMode": new_cfg["rolloutAccessMode"],
                        "sandboxOnlyMode": new_cfg.get("sandboxOnlyMode"),
                        "checklistMode": new_cfg["checklistMode"],
                        "rolloutEffectiveSurgeryDate": new_cfg["rolloutEffectiveSurgeryDate"],
                    },
                    "committedStatePatch": {"patchKind": "config_update", "configRecord": copy.deepcopy(new_cfg)},
                },
            }

        return _run_wal_tx(action_key="config.put", enforce_canary_gate=False, handler_fn=_handler)

    # ───────────────────────── Case Lifecycle Endpoints ─────────────────────────

    @app.route("/api/surgery-approval/<int:sid>/draft", methods=["POST"])
    def save_surgery_approval_draft(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            surgery = _find_surgery_or_404(db, sid)
            if surgery.get("approachType") == "nsth" and not cfg.get("nsthInternalPrecheckEnabled"):
                raise ApprovalEngineError(422, "NSTH_EXTERNAL_AUTHORITY", "Ca Nội soi tiêu hóa không thuộc luồng duyệt Khoa PTĐTT.")
            _require_expected_revision(body, surgery)

            rev_before = int(surgery.get("caseRevision", 1))
            approval = surgery.setdefault("approval", {"status": "draft_unsubmitted", "activeHold": None})
            old_status = approval.get("status", "draft_unsubmitted")

            tier_a_changed, act_name, summary = apply_draft_updates(surgery, actor, body, catalog, db)

            if old_status in ("approved", "approved_with_exception", "post_approval_hold"):
                if tier_a_changed:
                    rev_after = rev_before + 1
                    surgery["caseRevision"] = rev_after
                    if approval.get("approvedSnapshot"):
                        approval["lastApprovedSnapshot"] = copy.deepcopy(approval["approvedSnapshot"])
                    approval["approvedSnapshot"] = None
                    approval["activeHold"] = None
                    approval["status"] = "reapproval_required"
                    approval["invalidationReason"] = "Chỉnh sửa thông tin phân loại / checklist / chip lâm sàng sau khi đã duyệt"
                    act_name = "tier_a_draft_edit_invalidated_approval"
                else:
                    # Tier B only (e.g. wardRoom assignment) -> keep caseRevision & approval intact (CORE-TC-07)
                    rev_after = rev_before
            elif old_status in ("submitted", "preapproved", "emergency_exception_pending_ack"):
                if tier_a_changed:
                    rev_after = rev_before + 1
                    surgery["caseRevision"] = rev_after
                    approval["status"] = "resubmit_required"
                    act_name = "tier_a_draft_edit_requires_resubmit"
                else:
                    rev_after = rev_before
            else:
                rev_after = rev_before + 1
                surgery["caseRevision"] = rev_after
                if old_status in ("legacy_exempt", "legacy_unverified_manual_review"):
                    approval["status"] = "draft_unsubmitted"

            stamp_badge_fields(surgery)
            revs = db.setdefault("_revisions", {})
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1

            resp = {"ok": True, "surgery": copy.deepcopy(surgery)}
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": act_name,
                    "surgeryId": sid,
                    "caseRevBefore": rev_before,
                    "caseRevAfter": rev_after,
                    "summary": {**summary, "statusBefore": old_status, "statusAfter": approval.get("status")},
                    "committedStatePatch": {"patchKind": "surgery_upsert", "surgeryRecord": copy.deepcopy(surgery)},
                    "recordRef": surgery,
                },
            }

        return _run_wal_tx(action_key="draft", surgery_id=sid, handler_fn=_handler)

    @app.route("/api/surgery-approval/<int:sid>/request-verify", methods=["POST"])
    def request_attending_verify(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            surgery = _find_surgery_or_404(db, sid)
            _require_expected_revision(body, surgery)
            if isinstance(body.get("draft"), dict):
                apply_draft_updates(surgery, actor, body["draft"], catalog, db)

            approval = surgery.setdefault("approval", {"status": "draft_unsubmitted", "activeHold": None})
            old_status = approval.get("status", "draft_unsubmitted")
            if old_status not in ("draft_unsubmitted", "ready_for_attending", "returned_for_revision", "resubmit_required", "reapproval_required"):
                raise ApprovalEngineError(409, "INVALID_STATUS_TRANSITION", f"Không thể gửi BS chính xác nhận từ trạng thái '{old_status}'.")

            rev_before = int(surgery.get("caseRevision", 1))
            rev_after = rev_before + 1
            surgery["caseRevision"] = rev_after
            approval["status"] = "ready_for_attending"
            approval["readyRequestedAt"] = now_vn_iso()
            approval["readyRequestedByStaffId"] = actor.get("staffId")
            stamp_badge_fields(surgery)

            event_seed = str(uuid.uuid4())
            targets = [surgery.get("mainSurgeon"), surgery.get("coordinatingAttendingStaffId")]
            notifs = build_approval_notifications(
                db,
                surgery,
                actor_staff_id=actor.get("staffId"),
                event_id=event_seed,
                notif_type="surgery_ready_for_attending",
                short_status_text="BS học viên đã rà sơ bộ, chờ BS chính xác nhận & trình duyệt",
                recipient_staff_ids=targets,
            )
            if notifs:
                db.setdefault("notifications", []).extend(notifs)
                db.setdefault("_revisions", {})["notifications"] = int(db.get("_revisions", {}).get("notifications", 1)) + 1

            revs = db.setdefault("_revisions", {})
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1

            resp = {"ok": True, "surgery": copy.deepcopy(surgery)}
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": "request_attending_verify",
                    "surgeryId": sid,
                    "caseRevBefore": rev_before,
                    "caseRevAfter": rev_after,
                    "summary": {"statusBefore": old_status, "statusAfter": "ready_for_attending"},
                    "committedStatePatch": {"patchKind": "surgery_upsert", "surgeryRecord": copy.deepcopy(surgery)},
                    "committedNotifications": notifs,
                    "recordRef": surgery,
                },
            }

        return _run_wal_tx(action_key="request_verify", surgery_id=sid, handler_fn=_handler)

    @app.route("/api/surgery-approval/<int:sid>/submit", methods=["POST"])
    def submit_surgery_for_approval(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            surgery = _find_surgery_or_404(db, sid)
            _require_expected_revision(body, surgery)

            if not (is_attending_user(actor) or is_bcn_user(actor)):
                raise ApprovalEngineError(
                    403,
                    "ATTENDING_REQUIRED",
                    "Chỉ Bác sĩ chính phụ trách ca mổ (hoặc BCN) mới có quyền bấm Trình duyệt mổ.",
                )

            if isinstance(body.get("draft"), dict):
                apply_draft_updates(surgery, actor, body["draft"], catalog, db)

            approval = surgery.setdefault("approval", {"status": "draft_unsubmitted", "activeHold": None})
            old_status = approval.get("status", "draft_unsubmitted")
            if old_status in ("approved", "post_approval_hold", "trashed_inactive", "nsth_external_authority"):
                raise ApprovalEngineError(409, "INVALID_STATUS_TRANSITION", f"Không thể trình duyệt từ trạng thái '{old_status}'.")

            validate_routine_submit_gate(surgery, actor, body, catalog, db, cfg)

            cc = surgery.get("clinicalClassification") or {}
            urgency = cc.get("urgencyLevel") or suggest_urgency_level(surgery.get("surgeryType"))
            sla_status = compute_sla_status(surgery, cfg, urgency)
            late_reason = str(body.get("lateReason") or approval.get("lateReason") or "").strip()
            if sla_status == "late" and urgency in ("elective", "elective_service") and len(late_reason) < 5:
                raise ApprovalEngineError(
                    422,
                    "LATE_REASON_REQUIRED",
                    "Ca mổ trình sau thời hạn SLA quy định — vui lòng nhập lý do trình trễ hạn.",
                )

            # Freeze POD Snapshot
            pa = surgery.setdefault("podAssignment", {})
            r_info = get_pod_room_info(catalog, pa.get("wardRoom"))
            pa["podSnapshot"] = {
                "rosterPeriod": ((catalog.get("podRoster") or {}).get("rosterPeriod")) or "2026-10-05_2026-12-13",
                "podId": r_info.get("podId"),
                "wardRoom": pa.get("wardRoom"),
                "attendingStaffIds": r_info.get("attendingStaffIds", []),
                "residentStaffIds": r_info.get("residentStaffIds", []),
                "capturedAt": now_vn_iso(),
            }

            rev_before = int(surgery.get("caseRevision", 1))
            rev_after = rev_before + 1
            surgery["caseRevision"] = rev_after

            acting_reason = str(body.get("actingForMainSurgeonReason") or "").strip() or None
            approval["status"] = "submitted"
            approval["slaStatus"] = sla_status
            approval["lateReason"] = late_reason or None
            approval["blockingReasons"] = []
            approval["activeHold"] = None
            approval["approvedSnapshot"] = None
            approval["submittedSnapshot"] = {
                "caseRevision": rev_after,
                "submittedAt": now_vn_iso(),
                "submittedByStaffId": actor.get("staffId"),
                "actingForMainSurgeonReason": acting_reason,
            }
            stamp_badge_fields(surgery)

            event_seed = str(uuid.uuid4())
            recipients = [CHIEF_STAFF_ID, DEPUTY_STAFF_ID]
            if is_pos_int(surgery.get("mainSurgeon")) and surgery.get("mainSurgeon") != actor.get("staffId"):
                recipients.append(surgery["mainSurgeon"])
            notifs = build_approval_notifications(
                db,
                surgery,
                actor_staff_id=actor.get("staffId"),
                event_id=event_seed,
                notif_type="surgery_submitted",
                short_status_text="Đã trình duyệt mổ tại khoa — Chờ BCN phê duyệt",
                recipient_staff_ids=recipients,
            )
            if notifs:
                db.setdefault("notifications", []).extend(notifs)
                db.setdefault("_revisions", {})["notifications"] = int(db.get("_revisions", {}).get("notifications", 1)) + 1

            revs = db.setdefault("_revisions", {})
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1

            resp = {"ok": True, "surgery": copy.deepcopy(surgery)}
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": "submit_routine",
                    "surgeryId": sid,
                    "caseRevBefore": rev_before,
                    "caseRevAfter": rev_after,
                    "summary": {
                        "statusBefore": old_status,
                        "statusAfter": "submitted",
                        "slaStatus": sla_status,
                        "actingForMainSurgeonReason": acting_reason,
                    },
                    "committedStatePatch": {"patchKind": "surgery_upsert", "surgeryRecord": copy.deepcopy(surgery)},
                    "committedNotifications": notifs,
                    "recordRef": surgery,
                },
            }

        return _run_wal_tx(action_key="submit", surgery_id=sid, handler_fn=_handler)

    @app.route("/api/surgery-approval/<int:sid>/submit-emergency", methods=["POST"])
    def submit_emergency_exception(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            surgery = _find_surgery_or_404(db, sid)
            _require_expected_revision(body, surgery)

            # Strictly Attending / On-call Doctor / BCN (blocks trainees & nurses -> 403, TC-13)
            if not (is_attending_user(actor) or is_bcn_user(actor)):
                raise ApprovalEngineError(
                    403,
                    "FORBIDDEN",
                    "Chỉ Bác sĩ chính / Bác sĩ trực khoa (08:00–18:00) hoặc BCN mới có quyền mở Cổng Ngoại lệ Cấp cứu.",
                )

            if surgery.get("approachType") == "nsth":
                raise ApprovalEngineError(422, "NSTH_EXTERNAL_AUTHORITY", "Ca Nội soi tiêu hóa thuộc thẩm quyền Khoa NSTH.")

            ms_id = surgery.get("mainSurgeon")
            if not is_pos_int(ms_id) or ms_id in TRAINEE_STAFF_IDS:
                raise ApprovalEngineError(422, "INVALID_MAIN_SURGEON", "Vui lòng chọn BS chính đứng tên mổ cấp cứu hợp lệ.")

            if isinstance(body.get("draft"), dict):
                apply_draft_updates(surgery, actor, body["draft"], catalog, db)

            em_note = str(body.get("emergencyReasonNote") or "").strip()
            if len(em_note) < 10:
                raise ApprovalEngineError(422, "EMERGENCY_REASON_REQUIRED", "Vui lòng ghi rõ chỉ định mổ cấp cứu / đe dọa tính mạng (tối thiểu 10 ký tự).")

            verbal = body.get("verbalConsultRecord")
            if (
                not isinstance(verbal, dict)
                or verbal.get("contactedLeaderStaffId") not in BCN_STAFF_IDS
                or verbal.get("contactChannel") not in ("phone", "in_person", "zalo_duty")
                or not str(verbal.get("contactedAt") or "").strip()
            ):
                raise ApprovalEngineError(
                    422,
                    "VERBAL_CONSULT_REQUIRED",
                    "Bắt buộc ghi nhận báo cáo trực tiếp / điện thoại với Trưởng khoa hoặc Phó Trưởng khoa.",
                )

            followup_owner = body.get("postOpFollowUpOwnerStaffId")
            if not is_pos_int(followup_owner) or followup_owner not in ATTENDING_STAFF_IDS:
                raise ApprovalEngineError(
                    422,
                    "FOLLOWUP_OWNER_REQUIRED",
                    "Bắt buộc chỉ định BS chính chịu trách nhiệm hoàn tất hồ sơ sau mổ cấp cứu.",
                )

            if surgery.get("preopChecklist") is None:
                init_parts = build_initial_unverified_structures(surgery, catalog, db)
                for k_i, v_i in init_parts.items():
                    if surgery.get(k_i) is None:
                        surgery[k_i] = v_i

            ck = surgery.setdefault("preopChecklist", {})
            deferred_items = []
            for code in CK_CODES:
                item = ck.setdefault(code, {"state": "unverified", "preparedByStaffId": None, "verifiedByStaffId": None})
                if item.get("state") in ("unverified", "prepared_ok", "deferred_emergency"):
                    item["state"] = "deferred_emergency"
                    item["verifiedByStaffId"] = actor.get("staffId")
                    deferred_items.append(code)

            cc = surgery.setdefault("clinicalClassification", {})
            cc["urgencyLevel"] = "emergency_exception"

            rev_before = int(surgery.get("caseRevision", 1))
            rev_after = rev_before + 1
            surgery["caseRevision"] = rev_after

            approval = surgery.setdefault("approval", {})
            old_status = approval.get("status", "draft_unsubmitted")
            approval["status"] = "emergency_exception_pending_ack"
            approval["slaStatus"] = "emergency_exempt"
            approval["activeHold"] = None
            approval["approvedSnapshot"] = None
            approval["deferredItems"] = deferred_items
            approval["emergencyException"] = {
                "emergencyReasonNote": em_note,
                "verbalConsultRecord": {
                    "contactedLeaderStaffId": int(verbal["contactedLeaderStaffId"]),
                    "contactChannel": verbal["contactChannel"],
                    "contactedAt": str(verbal["contactedAt"]).strip(),
                },
                "postOpFollowUpOwnerStaffId": int(followup_owner),
                "submittedByStaffId": actor.get("staffId"),
                "submittedAt": now_vn_iso(),
            }
            stamp_badge_fields(surgery)

            event_seed = str(uuid.uuid4())
            notifs = build_approval_notifications(
                db,
                surgery,
                actor_staff_id=actor.get("staffId"),
                event_id=event_seed,
                notif_type="surgery_emergency_exception",
                short_status_text="⚡ Ngoại lệ cấp cứu — Chờ BCN xác nhận ngoại lệ",
                recipient_staff_ids=[CHIEF_STAFF_ID, DEPUTY_STAFF_ID, int(followup_owner)],
            )
            if notifs:
                db.setdefault("notifications", []).extend(notifs)
                db.setdefault("_revisions", {})["notifications"] = int(db.get("_revisions", {}).get("notifications", 1)) + 1

            revs = db.setdefault("_revisions", {})
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1

            resp = {"ok": True, "surgery": copy.deepcopy(surgery)}
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": "submit_emergency_exception",
                    "surgeryId": sid,
                    "caseRevBefore": rev_before,
                    "caseRevAfter": rev_after,
                    "summary": {
                        "statusBefore": old_status,
                        "statusAfter": "emergency_exception_pending_ack",
                        "deferredItems": deferred_items,
                    },
                    "committedStatePatch": {"patchKind": "surgery_upsert", "surgeryRecord": copy.deepcopy(surgery)},
                    "committedNotifications": notifs,
                    "recordRef": surgery,
                },
            }

        return _run_wal_tx(action_key="submit_emergency", surgery_id=sid, handler_fn=_handler)

    @app.route("/api/surgery-approval/<int:sid>/preapprove", methods=["POST"])
    def preapprove_surgery(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            if actor.get("staffId") != DEPUTY_STAFF_ID:
                raise ApprovalEngineError(403, "FORBIDDEN", "Chỉ Phó Trưởng khoa mới thực hiện bước Tiền duyệt.")

            surgery = _find_surgery_or_404(db, sid)
            _require_expected_revision(body, surgery)

            approval = surgery.setdefault("approval", {})
            old_status = approval.get("status")
            if old_status not in ("submitted", "preapproved"):
                raise ApprovalEngineError(409, "INVALID_STATUS_TRANSITION", f"Chỉ tiền duyệt ca đang ở trạng thái 'submitted' (hiện tại: '{old_status}').")

            cc = surgery.get("clinicalClassification") or {}
            col_obj = cc.get("columnCompliance") or {}
            if (
                body.get("verifyPrivilege")
                or col_obj.get("declaredMode") in ("approved_over_column", "propose_over_column")
                or col_obj.get("systemCheck") in ("matrix_expired_manual_verify", "external_surgeon_verify_privilege", "unclassified_manual_verify")
            ):
                col_obj["privilegeVerifiedByStaffId"] = DEPUTY_STAFF_ID

            rev_before = int(surgery.get("caseRevision", 1))
            rev_after = rev_before + 1
            surgery["caseRevision"] = rev_after

            note = str(body.get("note") or "").strip()
            approval["status"] = "preapproved"
            approval["preapprovedSnapshot"] = {
                "caseRevision": rev_after,
                "preapprovedAt": now_vn_iso(),
                "preapprovedByStaffId": DEPUTY_STAFF_ID,
                "note": note,
            }
            stamp_badge_fields(surgery)

            event_seed = str(uuid.uuid4())
            notifs = build_approval_notifications(
                db,
                surgery,
                actor_staff_id=DEPUTY_STAFF_ID,
                event_id=event_seed,
                notif_type="surgery_preapproved",
                short_status_text="☑️ Đạt tiền duyệt (Phó TK) — Chờ Trưởng khoa phê duyệt",
                recipient_staff_ids=[CHIEF_STAFF_ID, surgery.get("mainSurgeon")],
            )
            if notifs:
                db.setdefault("notifications", []).extend(notifs)
                db.setdefault("_revisions", {})["notifications"] = int(db.get("_revisions", {}).get("notifications", 1)) + 1

            revs = db.setdefault("_revisions", {})
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1

            resp = {"ok": True, "surgery": copy.deepcopy(surgery)}
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": "preapprove_deputy",
                    "surgeryId": sid,
                    "caseRevBefore": rev_before,
                    "caseRevAfter": rev_after,
                    "summary": {"statusBefore": old_status, "statusAfter": "preapproved", "note": note},
                    "committedStatePatch": {"patchKind": "surgery_upsert", "surgeryRecord": copy.deepcopy(surgery)},
                    "committedNotifications": notifs,
                    "recordRef": surgery,
                },
            }

        return _run_wal_tx(action_key="preapprove", surgery_id=sid, handler_fn=_handler)

    @app.route("/api/surgery-approval/<int:sid>/return", methods=["POST"])
    def return_surgery_for_revision(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            if actor.get("staffId") not in BCN_STAFF_IDS:
                raise ApprovalEngineError(403, "FORBIDDEN", "Chỉ Ban Chủ nhiệm khoa mới có quyền yêu cầu bổ sung hồ sơ.")

            surgery = _find_surgery_or_404(db, sid)
            _require_expected_revision(body, surgery)

            approval = surgery.setdefault("approval", {})
            old_status = approval.get("status")
            if old_status not in ("submitted", "preapproved", "emergency_exception_pending_ack"):
                raise ApprovalEngineError(409, "INVALID_STATUS_TRANSITION", f"Không thể trả hồ sơ từ trạng thái '{old_status}'.")

            chips = body.get("feedbackChips") if isinstance(body.get("feedbackChips"), list) else []
            chips = [str(c).strip() for c in chips if str(c).strip()]
            note = str(body.get("feedbackNote") or "").strip()

            if not chips and not note:
                raise ApprovalEngineError(422, "FEEDBACK_REASON_REQUIRED", "Vui lòng chọn ít nhất 01 chip góp ý hoặc nhập nội dung yêu cầu bổ sung.")
            if ("other" in chips or "Khác" in chips) and not note:
                raise ApprovalEngineError(422, "FEEDBACK_NOTE_REQUIRED", "Khi chọn chip 'Khác', bắt buộc nhập nội dung hướng dẫn cụ thể.")

            rev_before = int(surgery.get("caseRevision", 1))
            rev_after = rev_before + 1
            surgery["caseRevision"] = rev_after

            approval["status"] = "returned_for_revision"
            approval["approvedSnapshot"] = None
            approval["returnFeedback"] = {
                "chips": chips,
                "note": note,
                "returnedAt": now_vn_iso(),
                "returnedByStaffId": actor.get("staffId"),
            }
            stamp_badge_fields(surgery)

            pa = surgery.get("podAssignment") or {}
            targets = [surgery.get("mainSurgeon"), pa.get("preparedByStaffId"), surgery.get("coordinatingAttendingStaffId")]
            event_seed = str(uuid.uuid4())
            notifs = build_approval_notifications(
                db,
                surgery,
                actor_staff_id=actor.get("staffId"),
                event_id=event_seed,
                notif_type="surgery_returned_for_revision",
                short_status_text="↩️ BCN yêu cầu bổ sung hồ sơ duyệt mổ",
                recipient_staff_ids=targets,
            )
            if notifs:
                db.setdefault("notifications", []).extend(notifs)
                db.setdefault("_revisions", {})["notifications"] = int(db.get("_revisions", {}).get("notifications", 1)) + 1

            revs = db.setdefault("_revisions", {})
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1

            resp = {"ok": True, "surgery": copy.deepcopy(surgery)}
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": "return_for_revision",
                    "surgeryId": sid,
                    "caseRevBefore": rev_before,
                    "caseRevAfter": rev_after,
                    "summary": {"statusBefore": old_status, "statusAfter": "returned_for_revision", "chips": chips},
                    "committedStatePatch": {"patchKind": "surgery_upsert", "surgeryRecord": copy.deepcopy(surgery)},
                    "committedNotifications": notifs,
                    "recordRef": surgery,
                },
            }

        return _run_wal_tx(action_key="return", surgery_id=sid, handler_fn=_handler)

    @app.route("/api/surgery-approval/<int:sid>/approve", methods=["POST"])
    def approve_surgery_at_department(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            actor_id = actor.get("staffId")
            if actor_id not in BCN_STAFF_IDS:
                raise ApprovalEngineError(403, "FORBIDDEN", "Chỉ Trưởng khoa (hoặc Phó Trưởng khoa có ủy quyền hợp lệ) mới có quyền phê duyệt tại khoa.")

            surgery = _find_surgery_or_404(db, sid)
            _require_expected_revision(body, surgery)

            if surgery.get("approachType") == "nsth":
                raise ApprovalEngineError(422, "NSTH_EXTERNAL_AUTHORITY", "Ca Nội soi tiêu hóa thuộc thẩm quyền Trưởng khoa NSTH.")

            approval = surgery.setdefault("approval", {})
            old_status = approval.get("status")

            # ── Branch A: Emergency Exception Acknowledgement -> approved_with_exception (NO green tick!) ──
            if old_status == "emergency_exception_pending_ack":
                delegation_id = None
                backup_reason = str(body.get("emergencyBackupReason") or "").strip() or None
                if actor_id == CHIEF_STAFF_ID:
                    approval_mode = "standard_chief"
                else:
                    active_del = find_active_delegation_for_deputy(
                        db, sid, "emergency_exception", is_sandbox_case=bool(surgery.get("isTestSandboxCase"))
                    )
                    if active_del:
                        approval_mode = "delegated_deputy"
                        delegation_id = active_del.get("delegationId")
                    elif backup_reason and len(backup_reason) >= 10:
                        approval_mode = "emergency_backup_deputy"
                    else:
                        raise ApprovalEngineError(
                            403,
                            "EMERGENCY_BACKUP_REASON_REQUIRED",
                            "Phó Trưởng khoa xác nhận ngoại lệ cấp cứu khi chưa có ủy quyền bắt buộc ghi rõ lý do dự phòng khẩn cấp (tối thiểu 10 ký tự).",
                        )

                rev_before = int(surgery.get("caseRevision", 1))
                rev_after = rev_before + 1
                surgery["caseRevision"] = rev_after

                approval["status"] = "approved_with_exception"
                approval["activeHold"] = None
                approval["approvedSnapshot"] = None
                approval["exceptionAckSnapshot"] = {
                    "caseRevision": rev_after,
                    "acknowledgedAt": now_vn_iso(),
                    "acknowledgedByStaffId": actor_id,
                    "approvalMode": approval_mode,
                    "delegationId": delegation_id,
                    "emergencyBackupReason": backup_reason,
                    "note": str(body.get("note") or "").strip(),
                }
                stamp_badge_fields(surgery)

                em_info = approval.get("emergencyException") or {}
                targets = [surgery.get("mainSurgeon"), em_info.get("postOpFollowUpOwnerStaffId"), CHIEF_STAFF_ID, DEPUTY_STAFF_ID]
                event_seed = str(uuid.uuid4())
                notifs = build_approval_notifications(
                    db,
                    surgery,
                    actor_staff_id=actor_id,
                    event_id=event_seed,
                    notif_type="surgery_approved_with_exception",
                    short_status_text="⚡ Đã xác nhận Duyệt ngoại lệ cấp cứu (Khoa)",
                    recipient_staff_ids=targets,
                )
                if notifs:
                    db.setdefault("notifications", []).extend(notifs)
                    db.setdefault("_revisions", {})["notifications"] = int(db.get("_revisions", {}).get("notifications", 1)) + 1

                revs = db.setdefault("_revisions", {})
                revs["surgeries"] = int(revs.get("surgeries", 1)) + 1

                resp = {"ok": True, "surgery": copy.deepcopy(surgery)}
                return {
                    "httpStatus": 200,
                    "response": resp,
                    "wal": {
                        "action": "approve_emergency_exception",
                        "surgeryId": sid,
                        "caseRevBefore": rev_before,
                        "caseRevAfter": rev_after,
                        "delegationId": delegation_id,
                        "summary": {
                            "statusBefore": old_status,
                            "statusAfter": "approved_with_exception",
                            "approvalMode": approval_mode,
                        },
                        "committedStatePatch": {"patchKind": "surgery_upsert", "surgeryRecord": copy.deepcopy(surgery)},
                        "committedNotifications": notifs,
                        "recordRef": surgery,
                    },
                }

            # ── Branch B: Standard Routine Approval -> approved (✅ Đã duyệt tại khoa) ──
            if old_status not in ("submitted", "preapproved"):
                raise ApprovalEngineError(
                    409,
                    "INVALID_STATUS_TRANSITION",
                    f"Chỉ phê duyệt ca đã trình duyệt ('submitted' hoặc 'preapproved', hiện tại: '{old_status}').",
                )

            cc = surgery.get("clinicalClassification") or {}
            col_obj = cc.get("columnCompliance") or {}
            if (
                col_obj.get("declaredMode") in ("approved_over_column", "propose_over_column")
                or col_obj.get("systemCheck") in ("matrix_expired_manual_verify", "external_surgeon_verify_privilege", "unclassified_manual_verify")
            ):
                col_obj["privilegeVerifiedByStaffId"] = actor_id

            # Re-verify full gate integrity at approval time (Zero-Bypass)
            validate_routine_submit_gate(surgery, actor, {"actingForMainSurgeonReason": "BCN_APPROVAL_CHECK"}, catalog, db, cfg)

            urgency = cc.get("urgencyLevel") or "elective"
            delegation_id = None
            if actor_id == CHIEF_STAFF_ID:
                approval_mode = "standard_chief"
            else:
                active_del = find_active_delegation_for_deputy(
                    db, sid, urgency, is_sandbox_case=bool(surgery.get("isTestSandboxCase"))
                )
                if not active_del:
                    raise ApprovalEngineError(
                        403,
                        "DELEGATION_NOT_ACTIVE",
                        "Phó Trưởng khoa chỉ chốt duyệt thường quy khi có Ủy quyền đang có hiệu lực của Trưởng khoa.",
                    )
                approval_mode = "delegated_deputy"
                delegation_id = active_del.get("delegationId")

            rev_before = int(surgery.get("caseRevision", 1))
            rev_after = rev_before + 1
            surgery["caseRevision"] = rev_after

            note = str(body.get("note") or "").strip()
            approval["status"] = "approved"
            approval["activeHold"] = None
            approval["approvedSnapshot"] = {
                "caseRevision": rev_after,
                "approvedAt": now_vn_iso(),
                "approvedByStaffId": actor_id,
                "approvalMode": approval_mode,
                "delegationId": delegation_id,
                "note": note,
            }
            stamp_badge_fields(surgery)

            pa = surgery.get("podAssignment") or {}
            targets = [surgery.get("mainSurgeon"), pa.get("preparedByStaffId"), surgery.get("coordinatingAttendingStaffId")]
            if actor_id == DEPUTY_STAFF_ID:
                targets.append(CHIEF_STAFF_ID)
            event_seed = str(uuid.uuid4())
            notifs = build_approval_notifications(
                db,
                surgery,
                actor_staff_id=actor_id,
                event_id=event_seed,
                notif_type="surgery_approved",
                short_status_text="✅ Đã duyệt tại khoa",
                recipient_staff_ids=targets,
            )
            if notifs:
                db.setdefault("notifications", []).extend(notifs)
                db.setdefault("_revisions", {})["notifications"] = int(db.get("_revisions", {}).get("notifications", 1)) + 1

            revs = db.setdefault("_revisions", {})
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1

            resp = {"ok": True, "surgery": copy.deepcopy(surgery)}
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": "approve_routine",
                    "surgeryId": sid,
                    "caseRevBefore": rev_before,
                    "caseRevAfter": rev_after,
                    "delegationId": delegation_id,
                    "summary": {
                        "statusBefore": old_status,
                        "statusAfter": "approved",
                        "approvalMode": approval_mode,
                    },
                    "committedStatePatch": {"patchKind": "surgery_upsert", "surgeryRecord": copy.deepcopy(surgery)},
                    "committedNotifications": notifs,
                    "recordRef": surgery,
                },
            }

        return _run_wal_tx(action_key="approve", surgery_id=sid, handler_fn=_handler)

    @app.route("/api/surgery-approval/<int:sid>/hold-post-approval", methods=["POST"])
    def hold_post_approval(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            surgery = _find_surgery_or_404(db, sid)
            _require_expected_revision(body, surgery)

            actor_id = actor.get("staffId")
            allowed_actor = (
                actor_id in BCN_STAFF_IDS
                or actor_id == surgery.get("mainSurgeon")
                or actor_id == surgery.get("coordinatingAttendingStaffId")
                or is_same_pod_attending(catalog, surgery, actor_id)
            )
            if not allowed_actor:
                raise ApprovalEngineError(
                    403,
                    "FORBIDDEN",
                    "Chỉ BS mổ chính, BS chính cùng POD hoặc Ban Chủ nhiệm mới được đặt Tạm hoãn sau duyệt.",
                )

            approval = surgery.setdefault("approval", {})
            old_status = approval.get("status")
            if old_status not in ("approved", "approved_with_exception"):
                raise ApprovalEngineError(409, "INVALID_STATUS_TRANSITION", f"Chỉ đặt Tạm hoãn cho ca đã duyệt (hiện tại: '{old_status}').")

            valid_cats = {
                "clinical_change",
                "patient_declined_or_deferred",
                "missing_blood_or_device",
                "anesthesia_hold",
                "or_capacity_hold",
                "other",
            }
            cat = body.get("holdCategory")
            reason = str(body.get("holdReason") or "").strip()
            if cat not in valid_cats or len(reason) < 10:
                raise ApprovalEngineError(
                    422,
                    "HOLD_REASON_REQUIRED",
                    "Bắt buộc chọn phân loại tạm hoãn hợp lệ và nhập lý do tối thiểu 10 ký tự.",
                )

            cur_rev = int(surgery.get("caseRevision", 1))
            approval["previousApprovedStatus"] = old_status
            approval["status"] = "post_approval_hold"
            approval["activeHold"] = {
                "holdCategory": cat,
                "holdReason": reason,
                "heldAt": now_vn_iso(),
                "heldByStaffId": actor_id,
                "caseRevisionAtHold": cur_rev,
            }
            stamp_badge_fields(surgery)

            event_seed = str(uuid.uuid4())
            notifs = build_approval_notifications(
                db,
                surgery,
                actor_staff_id=actor_id,
                event_id=event_seed,
                notif_type="surgery_post_approval_hold",
                short_status_text="⏸️ Tạm hoãn tại khoa sau khi duyệt",
                recipient_staff_ids=[CHIEF_STAFF_ID, DEPUTY_STAFF_ID, surgery.get("mainSurgeon")],
            )
            if notifs:
                db.setdefault("notifications", []).extend(notifs)
                db.setdefault("_revisions", {})["notifications"] = int(db.get("_revisions", {}).get("notifications", 1)) + 1

            revs = db.setdefault("_revisions", {})
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1

            resp = {"ok": True, "surgery": copy.deepcopy(surgery)}
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": "hold_post_approval",
                    "surgeryId": sid,
                    "caseRevBefore": cur_rev,
                    "caseRevAfter": cur_rev,
                    "summary": {"statusBefore": old_status, "statusAfter": "post_approval_hold", "holdCategory": cat},
                    "committedStatePatch": {"patchKind": "surgery_upsert", "surgeryRecord": copy.deepcopy(surgery)},
                    "committedNotifications": notifs,
                    "recordRef": surgery,
                },
            }

        return _run_wal_tx(action_key="hold_post_approval", surgery_id=sid, handler_fn=_handler)

    @app.route("/api/surgery-approval/<int:sid>/release-hold", methods=["POST"])
    def release_post_approval_hold(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            actor_id = actor.get("staffId")
            surgery = _find_surgery_or_404(db, sid)
            _require_expected_revision(body, surgery)

            urgency = ((surgery.get("clinicalClassification") or {}).get("urgencyLevel")) or "elective"
            delegation_id = None
            if actor_id == CHIEF_STAFF_ID:
                approval_mode = "standard_chief"
            elif actor_id == DEPUTY_STAFF_ID:
                active_del = find_active_delegation_for_deputy(
                    db, sid, urgency, is_sandbox_case=bool(surgery.get("isTestSandboxCase"))
                )
                if not active_del:
                    raise ApprovalEngineError(403, "DELEGATION_NOT_ACTIVE", "Phó Trưởng khoa cần ủy quyền đang hiệu lực để mở lại ca Tạm hoãn.")
                approval_mode = "delegated_deputy"
                delegation_id = active_del.get("delegationId")
            else:
                raise ApprovalEngineError(
                    403,
                    "FORBIDDEN",
                    "Chỉ Trưởng khoa (hoặc Phó Trưởng khoa được ủy quyền) mới có quyền mở lại ca Tạm hoãn.",
                )

            approval = surgery.setdefault("approval", {})
            old_status = approval.get("status")
            if old_status == "reapproval_required":
                raise ApprovalEngineError(
                    409,
                    "MUST_REAPPROVE_AFTER_TIER_A_CHANGE",
                    "Ca mổ đã có thay đổi chuyên môn (Tier A) trong thời gian tạm hoãn — bắt buộc trình và duyệt lại từ đầu.",
                )
            active_hold = approval.get("activeHold")
            if old_status != "post_approval_hold" or not isinstance(active_hold, dict):
                raise ApprovalEngineError(409, "NO_ACTIVE_HOLD", "Ca mổ hiện không ở trạng thái Tạm hoãn tại khoa.")

            rev_before = int(surgery.get("caseRevision", 1))
            if active_hold.get("caseRevisionAtHold") != rev_before:
                raise ApprovalEngineError(
                    409,
                    "MUST_REAPPROVE_AFTER_TIER_A_CHANGE",
                    "Phiên bản hồ sơ đã thay đổi sau khi đặt Hold — bắt buộc duyệt lại đầy đủ.",
                )

            rel_note = str(body.get("releaseNote") or "").strip()
            if len(rel_note) < 5:
                raise ApprovalEngineError(422, "RELEASE_NOTE_REQUIRED", "Vui lòng ghi chú xác nhận an toàn khi mở lại ca Tạm hoãn (tối thiểu 5 ký tự).")

            rev_after = rev_before + 1
            surgery["caseRevision"] = rev_after
            prev_st = approval.pop("previousApprovedStatus", "approved")
            approval["activeHold"] = None

            if prev_st == "approved_with_exception":
                approval["status"] = "approved_with_exception"
                ack = approval.setdefault("exceptionAckSnapshot", {})
                ack["caseRevision"] = rev_after
                ack["releasedHoldAt"] = now_vn_iso()
                ack["releasedHoldByStaffId"] = actor_id
                ack["releaseNote"] = rel_note
            else:
                approval["status"] = "approved"
                approval["approvedSnapshot"] = {
                    "caseRevision": rev_after,
                    "approvedAt": now_vn_iso(),
                    "approvedByStaffId": actor_id,
                    "approvalMode": approval_mode,
                    "delegationId": delegation_id,
                    "releasedFromHoldNote": rel_note,
                }
            stamp_badge_fields(surgery)

            event_seed = str(uuid.uuid4())
            notifs = build_approval_notifications(
                db,
                surgery,
                actor_staff_id=actor_id,
                event_id=event_seed,
                notif_type="surgery_hold_released",
                short_status_text="✅ BCN đã gỡ Tạm hoãn — Khôi phục trạng thái duyệt tại khoa",
                recipient_staff_ids=[surgery.get("mainSurgeon"), DEPUTY_STAFF_ID, CHIEF_STAFF_ID],
            )
            if notifs:
                db.setdefault("notifications", []).extend(notifs)
                db.setdefault("_revisions", {})["notifications"] = int(db.get("_revisions", {}).get("notifications", 1)) + 1

            revs = db.setdefault("_revisions", {})
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1

            resp = {"ok": True, "surgery": copy.deepcopy(surgery)}
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": "release_post_approval_hold",
                    "surgeryId": sid,
                    "caseRevBefore": rev_before,
                    "caseRevAfter": rev_after,
                    "delegationId": delegation_id,
                    "summary": {"statusBefore": "post_approval_hold", "statusAfter": approval["status"], "releaseNote": rel_note},
                    "committedStatePatch": {"patchKind": "surgery_upsert", "surgeryRecord": copy.deepcopy(surgery)},
                    "committedNotifications": notifs,
                    "recordRef": surgery,
                },
            }

        return _run_wal_tx(action_key="release_hold", surgery_id=sid, handler_fn=_handler)

    @app.route("/api/surgery-approval/<int:sid>/revoke", methods=["POST"])
    def revoke_departmental_approval(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            actor_id = actor.get("staffId")
            surgery = _find_surgery_or_404(db, sid)
            _require_expected_revision(body, surgery)

            urgency = ((surgery.get("clinicalClassification") or {}).get("urgencyLevel")) or "elective"
            delegation_id = None
            if actor_id == CHIEF_STAFF_ID:
                pass
            elif actor_id == DEPUTY_STAFF_ID:
                active_del = find_active_delegation_for_deputy(
                    db, sid, urgency, is_sandbox_case=bool(surgery.get("isTestSandboxCase"))
                )
                if not active_del:
                    raise ApprovalEngineError(403, "DELEGATION_NOT_ACTIVE", "Phó Trưởng khoa cần ủy quyền đang hiệu lực để thu hồi duyệt.")
                delegation_id = active_del.get("delegationId")
            else:
                raise ApprovalEngineError(403, "FORBIDDEN", "Chỉ Ban Chủ nhiệm mới có quyền thu hồi phê duyệt tại khoa.")

            approval = surgery.setdefault("approval", {})
            old_status = approval.get("status")
            if old_status not in ("approved", "approved_with_exception", "post_approval_hold", "preapproved"):
                raise ApprovalEngineError(409, "INVALID_STATUS_TRANSITION", f"Không thể thu hồi từ trạng thái '{old_status}'.")

            reason = str(body.get("revokeReason") or "").strip()
            if len(reason) < 5:
                raise ApprovalEngineError(422, "REVOKE_REASON_REQUIRED", "Vui lòng nhập lý do thu hồi phê duyệt (tối thiểu 5 ký tự).")

            rev_before = int(surgery.get("caseRevision", 1))
            rev_after = rev_before + 1
            surgery["caseRevision"] = rev_after

            if approval.get("approvedSnapshot"):
                approval["lastApprovedSnapshot"] = copy.deepcopy(approval["approvedSnapshot"])
            approval["approvedSnapshot"] = None
            approval["activeHold"] = None
            approval["status"] = "revoked_by_bcn"
            approval["revokeRecord"] = {
                "revokedAt": now_vn_iso(),
                "revokedByStaffId": actor_id,
                "delegationId": delegation_id,
                "revokeReason": reason,
            }
            stamp_badge_fields(surgery)

            pa = surgery.get("podAssignment") or {}
            event_seed = str(uuid.uuid4())
            notifs = build_approval_notifications(
                db,
                surgery,
                actor_staff_id=actor_id,
                event_id=event_seed,
                notif_type="surgery_revoked",
                short_status_text="🚫 BCN đã thu hồi phê duyệt tại khoa",
                recipient_staff_ids=[surgery.get("mainSurgeon"), pa.get("preparedByStaffId"), DEPUTY_STAFF_ID, CHIEF_STAFF_ID],
            )
            if notifs:
                db.setdefault("notifications", []).extend(notifs)
                db.setdefault("_revisions", {})["notifications"] = int(db.get("_revisions", {}).get("notifications", 1)) + 1

            revs = db.setdefault("_revisions", {})
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1

            resp = {"ok": True, "surgery": copy.deepcopy(surgery)}
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": "revoke_approval",
                    "surgeryId": sid,
                    "caseRevBefore": rev_before,
                    "caseRevAfter": rev_after,
                    "delegationId": delegation_id,
                    "summary": {"statusBefore": old_status, "statusAfter": "revoked_by_bcn", "revokeReason": reason},
                    "committedStatePatch": {"patchKind": "surgery_upsert", "surgeryRecord": copy.deepcopy(surgery)},
                    "committedNotifications": notifs,
                    "recordRef": surgery,
                },
            }

        return _run_wal_tx(action_key="revoke", surgery_id=sid, handler_fn=_handler)

    # ───────────────────────── BCN Delegations & Audit Logs ─────────────────────────

    @app.route("/api/surgery-approval/delegations", methods=["GET"])
    def list_approval_delegations():
        try:
            db = sf_mod.load_data()
            real_user = resolve_live_user_fail_closed(
                request.headers.get("Authorization", ""),
                sf_mod._verify_jwt,
                sf_mod.AUTH_FILE,
                db,
                sf_mod._save_auth,
            )
            cfg = get_approval_config(db)
            if cfg.get("rolloutAccessMode") == "superadmin_only" and not real_user.get("isSuperAdmin"):
                raise ApprovalEngineError(403, "CANARY_SUPERADMIN_ONLY", "Chế độ thử nghiệm Super Admin.")
            dels = db.get("approvalDelegations") or []
            if not real_user.get("isSuperAdmin"):
                dels = [d for d in dels if isinstance(d, dict) and d.get("isTestSandboxDelegation") is not True]
            return jsonify({"delegations": dels})
        except ApprovalEngineError as e:
            return jsonify(e.to_dict()), e.status_code

    @app.route("/api/surgery-approval/delegations", methods=["POST"])
    def create_approval_delegation():
        def _handler(db, body, real_user, actor, catalog, cfg):
            # Allow Chief (staffId=1) OR Superadmin explicitly creating a [TEST] sandbox delegation ONLY in superadmin_only mode
            is_sim = bool(actor.get("isSimulated") or actor.get("simulatedBySuperAdminStaffId"))
            is_sandbox_del = bool(
                (body.get("isTestSandboxDelegation") or is_sim)
                and real_user.get("isSuperAdmin")
                and cfg.get("rolloutAccessMode") == "superadmin_only"
            )
            if (actor.get("staffId") != CHIEF_STAFF_ID or is_sim) and not is_sandbox_del:
                raise ApprovalEngineError(403, "CHIEF_ONLY", "Chỉ Trưởng khoa (TS. BSCKII. Nguyễn Phú Hữu) mới có quyền lập Ủy quyền duyệt mổ.")

            eff_from = parse_iso_dt(body.get("effectiveFrom", ""))
            eff_to = parse_iso_dt(body.get("effectiveTo", ""))
            if not eff_from or not eff_to or eff_to <= eff_from:
                raise ApprovalEngineError(422, "INVALID_TIME_WINDOW", "Khoảng thời gian hiệu lực ủy quyền (effectiveFrom < effectiveTo) không hợp lệ.")

            reason = str(body.get("reason") or "").strip()
            if len(reason) < 5:
                raise ApprovalEngineError(422, "REASON_REQUIRED", "Vui lòng nhập lý do ủy quyền (công tác, hội nghị, nghỉ phép...).")

            scope = body.get("scope", "all_departmental_surgeries")
            if scope not in ("all_departmental_surgeries", "routine_only", "specific_surgery_ids"):
                raise ApprovalEngineError(422, "INVALID_SCOPE", "Phạm vi ủy quyền không hợp lệ.")

            del_rec = {
                "delegationId": f"DEL-{now_vn().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}",
                "grantorStaffId": CHIEF_STAFF_ID,
                "delegateStaffId": DEPUTY_STAFF_ID,
                "effectiveFrom": eff_from.isoformat(timespec="seconds"),
                "effectiveTo": eff_to.isoformat(timespec="seconds"),
                "scope": scope,
                "allowedSurgeryIds": body.get("allowedSurgeryIds") if scope == "specific_surgery_ids" else None,
                "reason": reason,
                "createdAt": now_vn_iso(),
                "createdByStaffId": actor.get("staffId"),
                "isTestSandboxDelegation": is_sandbox_del,
                "revokedAt": None,
                "revokedByStaffId": None,
            }
            db.setdefault("approvalDelegations", []).append(del_rec)

            resp = {"ok": True, "delegation": copy.deepcopy(del_rec)}
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": "create_delegation",
                    "surgeryId": None,
                    "delegationId": del_rec["delegationId"],
                    "summary": {"effectiveFrom": del_rec["effectiveFrom"], "effectiveTo": del_rec["effectiveTo"], "scope": scope},
                    "committedStatePatch": {"patchKind": "delegation_upsert", "delegationRecord": copy.deepcopy(del_rec)},
                },
            }

        return _run_wal_tx(action_key="delegation.create", allow_sandbox_delegation_sim=True, handler_fn=_handler)

    @app.route("/api/surgery-approval/delegations/<string:del_id>/revoke", methods=["POST"])
    def revoke_approval_delegation(del_id):
        def _handler(db, body, real_user, actor, catalog, cfg):
            dels = db.setdefault("approvalDelegations", [])
            target = next((d for d in dels if isinstance(d, dict) and d.get("delegationId") == del_id), None)
            if not target:
                raise ApprovalEngineError(404, "DELEGATION_NOT_FOUND", f"Không tìm thấy bản ghi ủy quyền {del_id}.")

            is_sim = bool(actor.get("isSimulated") or actor.get("simulatedBySuperAdminStaffId"))
            if is_sim and not target.get("isTestSandboxDelegation"):
                raise ApprovalEngineError(403, "SANDBOX_ONLY_SIMULATION", "Chế độ giả lập vai trò chỉ được thu hồi ủy quyền mẫu [TEST].")

            can_revoke = (actor.get("staffId") == CHIEF_STAFF_ID and not is_sim) or (
                target.get("isTestSandboxDelegation")
                and real_user.get("isSuperAdmin")
                and cfg.get("rolloutAccessMode") == "superadmin_only"
            )
            if not can_revoke:
                raise ApprovalEngineError(403, "CHIEF_ONLY", "Chỉ Trưởng khoa mới có quyền thu hồi ủy quyền duyệt mổ.")

            target["revokedAt"] = now_vn_iso()
            target["revokedByStaffId"] = actor.get("staffId")
            target["revokeReason"] = str(body.get("reason") or "Thu hồi ủy quyền sớm").strip()

            resp = {"ok": True, "delegation": copy.deepcopy(target)}
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": "revoke_delegation",
                    "surgeryId": None,
                    "delegationId": del_id,
                    "summary": {"revokedAt": target["revokedAt"]},
                    "committedStatePatch": {"patchKind": "delegation_upsert", "delegationRecord": copy.deepcopy(target)},
                },
            }

        return _run_wal_tx(action_key=f"delegation.revoke.{del_id}", allow_sandbox_delegation_sim=True, handler_fn=_handler)

    @app.route("/api/surgery-approval/logs", methods=["GET"])
    def get_surgery_approval_logs():
        """Strictly restricted to BCN (staffId 1 & 2) — returns 403 for all other roles including Head Nurse (staffId=3)."""
        try:
            db = sf_mod.load_data()
            real_user = resolve_live_user_fail_closed(
                request.headers.get("Authorization", ""),
                sf_mod._verify_jwt,
                sf_mod.AUTH_FILE,
                db,
                sf_mod._save_auth,
            )
            cfg = get_approval_config(db)
            if cfg.get("rolloutAccessMode") == "superadmin_only" and not real_user.get("isSuperAdmin"):
                raise ApprovalEngineError(
                    403,
                    "CANARY_SUPERADMIN_ONLY",
                    "Tính năng Duyệt mổ tại khoa đang ở chế độ thử nghiệm dành riêng cho Super Admin.",
                )

            # Check simulated role if provided by superadmin so Role Simulator accurately tests 403 for non-BCN!
            sim_hdr = request.headers.get("X-Simulate-Staff-Id", "").strip()
            effective_staff_id = real_user.get("staffId")
            if sim_hdr and real_user.get("isSuperAdmin"):
                try:
                    effective_staff_id = int(sim_hdr)
                except ValueError:
                    raise ApprovalEngineError(400, "INVALID_SIMULATED_STAFF", "X-Simulate-Staff-Id không hợp lệ.")

            if effective_staff_id not in BCN_STAFF_IDS:
                raise ApprovalEngineError(
                    403,
                    "BCN_ONLY_LOGS",
                    "Sổ nhật ký chuỗi băm Duyệt mổ chỉ dành riêng cho Ban Chủ nhiệm khoa (Trưởng khoa & Phó Trưởng khoa).",
                )

            journal_path = get_journal_path(sf_mod.DATA_DIR)
            ok, entries, chain_err = verify_approval_journal_chain(journal_path)

            sid_filter = request.args.get("surgeryId", "").strip()
            limit = min(max(int(request.args.get("limit", "200") or 200), 1), 1000)

            sandbox_ids = {
                s.get("id")
                for s in ((db.get("surgeries") or []) + (db.get("surgeriesTrash") or []))
                if isinstance(s, dict) and s.get("isTestSandboxCase") is True
            }
            filtered = entries
            if not real_user.get("isSuperAdmin"):
                def _is_sandbox_log(ev):
                    act = str(ev.get("action") or "")
                    if act.startswith("sandbox_"):
                        return True
                    if ev.get("surgeryId") in sandbox_ids:
                        return True
                    actor_ev = ev.get("actor") or {}
                    if actor_ev.get("isSimulated") or actor_ev.get("simulatedBySuperAdminStaffId"):
                        return True
                    patch = ev.get("committedStatePatch") or {}
                    if (patch.get("surgeryRecord") or {}).get("isTestSandboxCase") is True:
                        return True
                    if (patch.get("delegationRecord") or {}).get("isTestSandboxDelegation") is True:
                        return True
                    return False
                filtered = [e for e in filtered if not _is_sandbox_log(e)]
            if sid_filter.isdigit():
                target_sid = int(sid_filter)
                filtered = [e for e in filtered if e.get("surgeryId") == target_sid]

            sanitized = []
            for e in reversed(filtered[-limit:]):
                sanitized.append({
                    "eventId": e.get("eventId"),
                    "eventSeq": e.get("eventSeq"),
                    "timestamp": e.get("timestamp"),
                    "surgeryId": e.get("surgeryId"),
                    "caseRevisionBefore": e.get("caseRevisionBefore"),
                    "caseRevisionAfter": e.get("caseRevisionAfter"),
                    "action": e.get("action"),
                    "actor": e.get("actor"),
                    "delegationId": e.get("delegationId"),
                    "statePatchSummary": e.get("statePatchSummary"),
                    "prevHash": e.get("prevHash"),
                    "entryHash": e.get("entryHash"),
                })

            return jsonify({
                "chainValid": ok,
                "totalEvents": len(entries),
                "headHash": entries[-1]["entryHash"] if entries else ("0" * 64),
                "chainError": chain_err,
                "entries": sanitized,
            })
        except ApprovalEngineError as e:
            return jsonify(e.to_dict()), e.status_code

    # ───────────────────────── Atomic Trash, Restore & Purge APIs ─────────────────────────

    @app.route("/api/surgeries/<int:sid>/trash", methods=["POST"])
    def atomic_trash_surgery(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            if not (sf_mod._is_admin(real_user) or sf_mod._is_doctor(real_user)):
                raise ApprovalEngineError(403, "FORBIDDEN", "Chỉ Bác sĩ và Quản trị viên mới có quyền xóa ca mổ vào thùng rác.")

            _purge_expired_trash_in_place(db, 7)

            surgeries = db.setdefault("surgeries", [])
            trash = db.setdefault("surgeriesTrash", [])
            idx = next((i for i, s in enumerate(surgeries) if isinstance(s, dict) and s.get("id") == sid), -1)
            if idx < 0:
                raise ApprovalEngineError(404, "SURGERY_NOT_FOUND", f"Không tìm thấy ca mổ #{sid}.")

            rec = copy.deepcopy(surgeries[idx])
            if rec.get("isTestSandboxCase") is True and not real_user.get("isSuperAdmin"):
                raise ApprovalEngineError(404, "SURGERY_NOT_FOUND", f"Không tìm thấy ca mổ #{sid}.")
            if not real_user.get("isSuperAdmin") and sf_mod.is_surgery_week_locked(rec.get("date", "")):
                raise ApprovalEngineError(403, "WEEK_LOCKED", "Ca mổ thuộc tuần đã khóa (> 7 ngày). Chỉ Super Admin mới có quyền xóa.")

            if cfg.get("sandboxOnlyMode") is True and rec.get("isTestSandboxCase") is not True:
                for k_strip in APPROVAL_METADATA_FIELDS_TO_STRIP:
                    rec.pop(k_strip, None)
                rec["deletedAt"] = now_vn_iso()
                rec["deletedBy"] = {
                    "name": real_user.get("name") or real_user.get("username"),
                    "username": real_user.get("username"),
                    "staffId": real_user.get("staffId"),
                }
                rec["deletedByStaffId"] = real_user.get("staffId")
                surgeries.pop(idx)
                trash.append(rec)
                revs = db.setdefault("_revisions", {})
                revs["surgeries"] = int(revs.get("surgeries", 1)) + 1
                revs["surgeriesTrash"] = int(revs.get("surgeriesTrash", 1)) + 1
                return {
                    "httpStatus": 200,
                    "response": {
                        "ok": True,
                        "trashed": copy.deepcopy(rec),
                        "surgeriesRevision": revs["surgeries"],
                        "surgeriesTrashRevision": revs["surgeriesTrash"],
                    },
                    "wal": None,
                }

            rev_before = int(rec.get("caseRevision", 1) or 1)
            rev_after = rev_before + 1
            prev_status = ((rec.get("approval") or {}).get("status")) or "draft_unsubmitted"

            rec["caseRevision"] = rev_after
            rec["previousApprovalStatus"] = prev_status
            rec["deletedAt"] = now_vn_iso()
            rec["deletedBy"] = {
                "name": real_user.get("name") or real_user.get("username"),
                "username": real_user.get("username"),
                "staffId": real_user.get("staffId"),
            }
            rec["deletedByStaffId"] = real_user.get("staffId")

            approval = rec.setdefault("approval", {})
            if approval.get("approvedSnapshot"):
                approval["lastApprovedSnapshot"] = copy.deepcopy(approval["approvedSnapshot"])
            approval["approvedSnapshot"] = None
            approval["activeHold"] = None
            approval["status"] = "trashed_inactive"
            stamp_badge_fields(rec)

            surgeries.pop(idx)
            trash.append(rec)

            revs = db.setdefault("_revisions", {})
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1
            revs["surgeriesTrash"] = int(revs.get("surgeriesTrash", 1)) + 1

            resp = {
                "ok": True,
                "trashed": copy.deepcopy(rec),
                "surgeriesRevision": revs["surgeries"],
                "surgeriesTrashRevision": revs["surgeriesTrash"],
            }
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": "move_to_trash",
                    "surgeryId": sid,
                    "caseRevBefore": rev_before,
                    "caseRevAfter": rev_after,
                    "summary": {"previousApprovalStatus": prev_status, "statusAfter": "trashed_inactive"},
                    "committedStatePatch": {"patchKind": "surgery_trash", "trashRecord": copy.deepcopy(rec)},
                    "recordRef": rec,
                },
            }

        return _run_wal_tx(action_key="surgery.trash", surgery_id=sid, enforce_canary_gate=False, handler_fn=_handler)

    @app.route("/api/surgeries/<int:sid>/restore", methods=["POST"])
    def atomic_restore_surgery(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            if not (sf_mod._is_admin(real_user) or sf_mod._is_doctor(real_user)):
                raise ApprovalEngineError(403, "FORBIDDEN", "Chỉ Bác sĩ và Quản trị viên mới có quyền khôi phục ca mổ.")

            _purge_expired_trash_in_place(db, 7)

            surgeries = db.setdefault("surgeries", [])
            trash = db.setdefault("surgeriesTrash", [])
            t_idx = next((i for i, t in enumerate(trash) if isinstance(t, dict) and t.get("id") == sid), -1)
            if t_idx < 0:
                raise ApprovalEngineError(404, "TRASH_RECORD_NOT_FOUND", f"Không tìm thấy ca mổ #{sid} trong Thùng rác.")

            rec = copy.deepcopy(trash[t_idx])
            if rec.get("isTestSandboxCase") is True and not real_user.get("isSuperAdmin"):
                raise ApprovalEngineError(404, "TRASH_RECORD_NOT_FOUND", f"Không tìm thấy ca mổ #{sid} trong Thùng rác.")
            if not real_user.get("isSuperAdmin") and sf_mod.is_surgery_week_locked(rec.get("date", "")):
                raise ApprovalEngineError(403, "WEEK_LOCKED", "Ca mổ thuộc tuần đã khóa (> 7 ngày). Chỉ Super Admin mới có quyền khôi phục.")

            if cfg.get("sandboxOnlyMode") is True and rec.get("isTestSandboxCase") is not True:
                for k_strip in APPROVAL_METADATA_FIELDS_TO_STRIP:
                    rec.pop(k_strip, None)
                rec.pop("deletedAt", None)
                rec.pop("deletedBy", None)
                rec.pop("deletedByStaffId", None)
                trash.pop(t_idx)
                db["surgeries"] = [s for s in surgeries if not (isinstance(s, dict) and s.get("id") == sid)]
                db["surgeries"].append(rec)
                revs = db.setdefault("_revisions", {})
                revs["surgeries"] = int(revs.get("surgeries", 1)) + 1
                revs["surgeriesTrash"] = int(revs.get("surgeriesTrash", 1)) + 1
                return {
                    "httpStatus": 200,
                    "response": {
                        "ok": True,
                        "restored": copy.deepcopy(rec),
                        "surgeriesRevision": revs["surgeries"],
                        "surgeriesTrashRevision": revs["surgeriesTrash"],
                    },
                    "wal": None,
                }

            rev_before = int(rec.get("caseRevision", 1) or 1)
            rev_after = rev_before + 1
            rec["caseRevision"] = rev_after

            prev_status = rec.pop("previousApprovalStatus", "draft_unsubmitted")
            rec.pop("deletedAt", None)
            rec.pop("deletedBy", None)
            rec.pop("deletedByStaffId", None)

            rollout_date = cfg.get("rolloutEffectiveSurgeryDate", "2026-11-02")
            d_str = rec.get("date", "")
            approval = rec.setdefault("approval", {})
            approval["approvedSnapshot"] = None
            approval["activeHold"] = None

            if rec.get("approachType") == "nsth":
                approval["status"] = "nsth_external_authority"
            elif prev_status in ("legacy_exempt", "legacy_unverified_manual_review"):
                if is_valid_iso_date(d_str) and d_str >= rollout_date:
                    init_parts = build_initial_unverified_structures(rec, catalog, db)
                    rec.update(init_parts)
                    approval["status"] = "draft_unsubmitted"
                else:
                    approval["status"] = prev_status
            elif prev_status in ("approved", "approved_with_exception", "post_approval_hold", "reapproval_required"):
                approval["status"] = "reapproval_required"
                approval["invalidationReason"] = "Khôi phục từ Thùng rác — bắt buộc BCN xác nhận lại trước khi hiệu lực tích xanh"
            elif prev_status in ("submitted", "preapproved", "emergency_exception_pending_ack", "resubmit_required"):
                approval["status"] = "resubmit_required"
            else:
                if rec.get("preopChecklist") is None:
                    init_parts = build_initial_unverified_structures(rec, catalog, db)
                    rec.update(init_parts)
                approval["status"] = "draft_unsubmitted"

            stamp_badge_fields(rec)

            trash.pop(t_idx)
            # Avoid duplicate ID in surgeries
            db["surgeries"] = [s for s in surgeries if not (isinstance(s, dict) and s.get("id") == sid)]
            db["surgeries"].append(rec)

            revs = db.setdefault("_revisions", {})
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1
            revs["surgeriesTrash"] = int(revs.get("surgeriesTrash", 1)) + 1

            resp = {
                "ok": True,
                "restored": copy.deepcopy(rec),
                "surgeriesRevision": revs["surgeries"],
                "surgeriesTrashRevision": revs["surgeriesTrash"],
            }
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": "restore_from_trash",
                    "surgeryId": sid,
                    "caseRevBefore": rev_before,
                    "caseRevAfter": rev_after,
                    "summary": {"previousApprovalStatus": prev_status, "statusAfter": approval["status"]},
                    "committedStatePatch": {
                        "patchKind": "surgery_upsert",
                        "surgeryRecord": copy.deepcopy(rec),
                        "removeFromTrash": True,
                    },
                    "recordRef": rec,
                },
            }

        return _run_wal_tx(action_key="surgery.restore", surgery_id=sid, enforce_canary_gate=False, handler_fn=_handler)

    @app.route("/api/surgeries-trash/<int:sid>", methods=["DELETE"])
    def permanent_delete_trashed_surgery(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            if not (sf_mod._is_admin(real_user) or sf_mod._is_doctor(real_user)):
                raise ApprovalEngineError(403, "FORBIDDEN", "Chỉ Bác sĩ và Quản trị viên mới có quyền xóa vĩnh viễn ca mổ trong thùng rác.")

            _purge_expired_trash_in_place(db, 7)

            trash = db.setdefault("surgeriesTrash", [])
            t_idx = next((i for i, t in enumerate(trash) if isinstance(t, dict) and t.get("id") == sid), -1)
            if t_idx < 0:
                raise ApprovalEngineError(404, "TRASH_RECORD_NOT_FOUND", f"Không tìm thấy ca mổ #{sid} trong Thùng rác.")

            rec = trash[t_idx]
            if rec.get("isTestSandboxCase") is True and not real_user.get("isSuperAdmin"):
                raise ApprovalEngineError(404, "TRASH_RECORD_NOT_FOUND", f"Không tìm thấy ca mổ #{sid} trong Thùng rác.")
            if not real_user.get("isSuperAdmin") and sf_mod.is_surgery_week_locked(rec.get("date", "")):
                raise ApprovalEngineError(403, "WEEK_LOCKED", "Ca mổ thuộc tuần đã khóa (> 7 ngày). Chỉ Super Admin mới có quyền xóa vĩnh viễn.")

            if cfg.get("sandboxOnlyMode") is True and rec.get("isTestSandboxCase") is not True:
                trash.pop(t_idx)
                revs = db.setdefault("_revisions", {})
                revs["surgeriesTrash"] = int(revs.get("surgeriesTrash", 1)) + 1
                return {
                    "httpStatus": 200,
                    "response": {"ok": True, "deletedId": sid, "surgeriesTrashRevision": revs["surgeriesTrash"]},
                    "wal": None,
                }

            rev_before = int(rec.get("caseRevision", 1) or 1)
            trash.pop(t_idx)

            revs = db.setdefault("_revisions", {})
            revs["surgeriesTrash"] = int(revs.get("surgeriesTrash", 1)) + 1

            resp = {"ok": True, "deletedId": sid, "surgeriesTrashRevision": revs["surgeriesTrash"]}
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": "purge_from_trash",
                    "surgeryId": sid,
                    "caseRevBefore": rev_before,
                    "caseRevAfter": rev_before,
                    "summary": {"purgedPermanently": True},
                    "committedStatePatch": {"patchKind": "trash_purge"},
                },
            }

        return _run_wal_tx(action_key="surgery.purge", surgery_id=sid, enforce_canary_gate=False, handler_fn=_handler)

    # ───────────────────────── Per-User Safe Notification Mutations ─────────────────────────

    @app.route("/api/notifications/mark-read", methods=["POST"])
    def mark_my_notifications_read():
        def _handler(db, body, real_user, actor, catalog, cfg):
            my_id = real_user.get("staffId")
            ids = body.get("ids")
            mark_all = bool(body.get("all"))
            notifs = db.setdefault("notifications", [])
            updated = 0
            id_set = {int(x) for x in ids if is_pos_int(x)} if isinstance(ids, list) else set()
            for n in notifs:
                if isinstance(n, dict) and n.get("toStaffId") == my_id and not n.get("read"):
                    if mark_all or n.get("id") in id_set:
                        n["read"] = True
                        updated += 1
            revs = db.setdefault("_revisions", {})
            if updated > 0:
                revs["notifications"] = int(revs.get("notifications", 1)) + 1
            my_items = [
                n for n in notifs
                if isinstance(n, dict)
                and n.get("toStaffId") == my_id
                and (real_user.get("isSuperAdmin") or n.get("isTestSandboxCase") is not True)
            ]
            return {
                "httpStatus": 200,
                "response": {
                    "ok": True,
                    "updated": updated,
                    "revision": int(revs.get("notifications", 1)),
                    "items": my_items,
                },
                "wal": None,
            }

        return _run_wal_tx(action_key="notifications.mark_read", enforce_canary_gate=False, require_build_header=False, handler_fn=_handler)

    @app.route("/api/notifications/delete-read", methods=["POST"])
    def delete_my_read_notifications():
        def _handler(db, body, real_user, actor, catalog, cfg):
            my_id = real_user.get("staffId")
            ids = body.get("ids")
            id_set = {int(x) for x in ids if is_pos_int(x)} if isinstance(ids, list) else None
            notifs = db.setdefault("notifications", [])
            kept = []
            removed = 0
            for n in notifs:
                if (
                    isinstance(n, dict)
                    and n.get("toStaffId") == my_id
                    and n.get("read") is True
                    and (id_set is None or n.get("id") in id_set)
                ):
                    removed += 1
                else:
                    kept.append(n)
            db["notifications"] = kept
            revs = db.setdefault("_revisions", {})
            if removed > 0:
                revs["notifications"] = int(revs.get("notifications", 1)) + 1
            my_items = [
                n for n in kept
                if isinstance(n, dict)
                and n.get("toStaffId") == my_id
                and (real_user.get("isSuperAdmin") or n.get("isTestSandboxCase") is not True)
            ]
            return {
                "httpStatus": 200,
                "response": {
                    "ok": True,
                    "removed": removed,
                    "revision": int(revs.get("notifications", 1)),
                    "items": my_items,
                },
                "wal": None,
            }

        return _run_wal_tx(action_key="notifications.delete_read", enforce_canary_gate=False, require_build_header=False, handler_fn=_handler)

    # ───────────────────────── Superadmin Canary Sandbox Endpoints ─────────────────────────

    @app.route("/api/surgery-approval/sandbox/seed", methods=["POST"])
    def seed_sandbox_surgeries():
        def _handler(db, body, real_user, actor, catalog, cfg):
            if not real_user.get("isSuperAdmin"):
                raise ApprovalEngineError(403, "SUPERADMIN_REQUIRED", "Chỉ Super Admin mới được khởi tạo ca mẫu thử nghiệm.")
            replace_existing = bool((body or {}).get("replaceExisting"))
            surgeries = db.setdefault("surgeries", [])
            existing_sandbox = [s for s in surgeries if isinstance(s, dict) and s.get("isTestSandboxCase") is True]
            if existing_sandbox and not replace_existing:
                return {
                    "httpStatus": 200,
                    "response": {"ok": True, "alreadySeeded": True, "cases": existing_sandbox},
                    "wal": None,
                }

            replaced_count = 0
            if replace_existing:
                before_s = len(db.get("surgeries") or [])
                before_t = len(db.get("surgeriesTrash") or [])
                db["surgeries"] = [s for s in (db.get("surgeries") or []) if not (isinstance(s, dict) and s.get("isTestSandboxCase") is True)]
                db["surgeriesTrash"] = [t for t in (db.get("surgeriesTrash") or []) if not (isinstance(t, dict) and t.get("isTestSandboxCase") is True)]
                db["notifications"] = [n for n in (db.get("notifications") or []) if not (isinstance(n, dict) and n.get("isTestSandboxCase") is True)]
                replaced_count = (before_s - len(db["surgeries"])) + (before_t - len(db["surgeriesTrash"]))
                surgeries = db["surgeries"]

            if cfg.get("sandboxOnlyMode") is True:
                strip_approval_metadata_from_real_surgeries(db)

            samples = build_sandbox_sample_surgeries(db, sf_mod.DATA_DIR, sf_mod.BASE_DIR)
            surgeries.extend(samples)
            revs = db.setdefault("_revisions", {})
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1
            if replace_existing:
                revs["surgeriesTrash"] = int(revs.get("surgeriesTrash", 1)) + 1
                revs["notifications"] = int(revs.get("notifications", 1)) + 1
            db.setdefault("nextIds", {})["surgeries"] = max(
                [int(r["id"]) for r in surgeries if isinstance(r, dict) and is_pos_int(r.get("id"))], default=0
            ) + 1

            return {
                "httpStatus": 200,
                "response": {
                    "ok": True,
                    "alreadySeeded": False,
                    "replacedCount": replaced_count,
                    "cases": samples,
                    "revision": revs["surgeries"],
                },
                "wal": {
                    "action": "sandbox_reseed_samples" if replace_existing else "sandbox_seed_samples",
                    "surgeryId": None,
                    "summary": {
                        "count": len(samples),
                        "replacedCount": replaced_count,
                        "ids": [c["id"] for c in samples],
                    },
                    "committedStatePatch": {"patchKind": "sandbox_seed"},
                },
            }

        return _run_wal_tx(action_key="sandbox.seed", enforce_canary_gate=False, handler_fn=_handler)

    @app.route("/api/surgery-approval/sandbox/cleanup", methods=["DELETE"])
    def cleanup_sandbox_surgeries():
        def _handler(db, body, real_user, actor, catalog, cfg):
            if not real_user.get("isSuperAdmin"):
                raise ApprovalEngineError(403, "SUPERADMIN_REQUIRED", "Chỉ Super Admin mới được dọn ca mẫu thử nghiệm.")
            before_s = len(db.get("surgeries") or [])
            before_t = len(db.get("surgeriesTrash") or [])
            db["surgeries"] = [s for s in (db.get("surgeries") or []) if not (isinstance(s, dict) and s.get("isTestSandboxCase") is True)]
            db["surgeriesTrash"] = [t for t in (db.get("surgeriesTrash") or []) if not (isinstance(t, dict) and t.get("isTestSandboxCase") is True)]
            db["notifications"] = [n for n in (db.get("notifications") or []) if not (isinstance(n, dict) and n.get("isTestSandboxCase") is True)]
            db["approvalDelegations"] = [d for d in (db.get("approvalDelegations") or []) if not (isinstance(d, dict) and d.get("isTestSandboxDelegation") is True)]
            removed_count = (before_s - len(db["surgeries"])) + (before_t - len(db["surgeriesTrash"]))
            revs = db.setdefault("_revisions", {})
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1
            revs["surgeriesTrash"] = int(revs.get("surgeriesTrash", 1)) + 1
            revs["notifications"] = int(revs.get("notifications", 1)) + 1
            return {
                "httpStatus": 200,
                "response": {"ok": True, "removedCount": removed_count, "revision": revs["surgeries"]},
                "wal": {
                    "action": "sandbox_cleanup_samples",
                    "surgeryId": None,
                    "summary": {"removedCount": removed_count},
                    "committedStatePatch": {"patchKind": "sandbox_cleanup"},
                },
            }

        return _run_wal_tx(action_key="sandbox.cleanup", enforce_canary_gate=False, handler_fn=_handler)

    # ───────────────────────── Controlled Disaster-Restore API (CORE-TC-08) ─────────────────────────

    @app.route("/api/admin/disaster-restore", methods=["POST"])
    def controlled_disaster_restore():
        def _handler(db, body, real_user, actor, catalog, cfg):
            if not real_user.get("isSuperAdmin"):
                raise ApprovalEngineError(403, "SUPERADMIN_REQUIRED", "Chỉ Super Admin mới có quyền khôi phục thảm họa.")
            if body.get("confirmPhrase") != "RESTORE_PTDTT_DB":
                raise ApprovalEngineError(422, "CONFIRMATION_REQUIRED", "Vui lòng truyền confirmPhrase='RESTORE_PTDTT_DB'.")
            backup_db = body.get("database")
            if not isinstance(backup_db, dict):
                raise ApprovalEngineError(400, "INVALID_BACKUP_PAYLOAD", "Thiếu trường database hợp lệ.")

            reason = str(body.get("reason") or "Disaster recovery restore").strip()
            sf_mod.snapshot_data_file("pre-disaster-restore")

            journal_path = get_journal_path(sf_mod.DATA_DIR)
            ok, entries, chain_err = verify_approval_journal_chain(journal_path)
            if not ok:
                raise ApprovalEngineError(503, "AUDIT_CHAIN_CORRUPTED", "Chuỗi băm nhật ký hiện tại không toàn vẹn.", {"chainError": chain_err})

            # Find max eventSeq and max caseRevision per surgeryId in append-only WAL journal
            max_seq_by_sid = {}
            max_rev_by_sid = {}
            for e in entries:
                esid = e.get("surgeryId")
                if is_pos_int(esid):
                    max_seq_by_sid[esid] = max(max_seq_by_sid.get(esid, 0), int(e.get("eventSeq", 0)))
                    r_after = e.get("caseRevisionAfter")
                    if is_strict_int(r_after):
                        max_rev_by_sid[esid] = max(max_rev_by_sid.get(esid, 1), r_after)

            # Replace db contents from backup (excluding raw credential fields) while preserving journal seq
            db.clear()
            for k, v in backup_db.items():
                if k not in ("customPasswords", "customAdmins", "disabledAccounts"):
                    db[k] = copy.deepcopy(v)

            run_surgery_approval_migration(db, sf_mod.DATA_DIR, sf_mod.BASE_DIR)

            downgraded_ids = []
            for s in (db.get("surgeries") or []):
                if not isinstance(s, dict):
                    continue
                sid_val = s.get("id")
                j_seq = max_seq_by_sid.get(sid_val, 0)
                s_seq = int(s.get("lastJournalSeq", 0) or 0)
                if j_seq > s_seq:
                    # Stale backup relative to WAL journal -> NEVER resurrect green tick silently!
                    s["caseRevision"] = max(int(s.get("caseRevision", 1) or 1), max_rev_by_sid.get(sid_val, 1)) + 1
                    s["lastJournalSeq"] = j_seq
                    app_obj = s.setdefault("approval", {})
                    if app_obj.get("approvedSnapshot"):
                        app_obj["lastApprovedSnapshot"] = copy.deepcopy(app_obj["approvedSnapshot"])
                    app_obj["approvedSnapshot"] = None
                    app_obj["activeHold"] = None
                    if s.get("approachType") == "nsth":
                        app_obj["status"] = "nsth_external_authority"
                    else:
                        app_obj["status"] = "reapproval_required"
                        app_obj["invalidationReason"] = "Khôi phục từ bản sao lưu cũ hơn Sổ nhật ký chuỗi băm — bắt buộc BCN xác nhận lại"
                    stamp_badge_fields(s)
                    downgraded_ids.append(sid_val)
                else:
                    stamp_badge_fields(s)

            revs = db.setdefault("_revisions", {})
            for col in sf_mod.WRITE_COLLECTIONS:
                revs[col] = int(revs.get(col, 1)) + 1

            resp = {
                "ok": True,
                "downgradedStaleApprovalIds": downgraded_ids,
                "restoredSurgeriesCount": len(db.get("surgeries") or []),
            }
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": "disaster_restore_reconciled",
                    "surgeryId": None,
                    "summary": {"reason": reason, "downgradedStaleApprovalIds": downgraded_ids},
                    "committedStatePatch": {"patchKind": "disaster_restore"},
                },
            }

        return _run_wal_tx(action_key="admin.disaster_restore", enforce_canary_gate=False, handler_fn=_handler)
