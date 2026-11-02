#!/usr/bin/env python3
"""
Flask Route Handlers & 5-Step WAL-First Atomic Transaction Coordinator
for Departmental Online Surgery Approval (Khoa PTĐTT — Bệnh viện Bình Dân).
"""

import copy
import fcntl
import gzip
import hashlib
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
    GENESIS_HASH,
    PROTECTED_APPROVAL_COLLECTIONS,
    RULE_VERSION,
    SCHEMA_VERSION,
    TRAINEE_STAFF_IDS,
    TNM_RULESET_REGISTRY,
    VALID_VERIFIED_BASIS_CODES,
    ApprovalEngineError,
    append_dual_wal_transaction,
    append_wal_journal_entry,
    apply_draft_updates,
    build_approval_notifications,
    build_idempotency_record,
    build_initial_unverified_structures,
    build_sandbox_sample_surgeries,
    can_user_access_sandbox,
    canonical_json,
    check_idempotency,
    compute_dual_approval_kpis,
    compute_journal_entry_hash,
    compute_recursive_changed_fields,
    compute_sla_status,
    evaluate_column_compliance,
    evaluate_tnm_assessment,
    find_active_delegation_for_deputy,
    get_approval_config,
    get_archive_dir,
    get_attribution_journal_path,
    get_journal_path,
    get_pod_room_info,
    is_attending_user,
    is_bcn_user,
    is_in_phase1_approval_scope,
    is_pos_int,
    is_same_pod_attending,
    is_strict_int,
    is_valid_iso_date,
    load_or_init_journal_checkpoint,
    load_procedure_catalog,
    now_vn,
    now_vn_iso,
    parse_iso_dt,
    query_journal_reverse_paginated,
    read_last_valid_jsonl_record_adaptive,
    reconcile_dual_journals_and_db,
    reconcile_journal_and_db,
    record_contributor_on_surgery,
    resolve_case_actor_role,
    resolve_effective_actor,
    resolve_live_user_fail_closed,
    resolve_submit_authorization,
    run_surgery_approval_migration,
    sha256_hex,
    stamp_badge_fields,
    strip_approval_metadata_from_real_surgeries,
    suggest_urgency_level,
    validate_bcn_approve_gate,
    validate_routine_submit_gate,
    verify_approval_journal_chain,
    verify_journal_stream_streaming,
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
    Acquires LOCK_EX on _DB_LOCK_FILE, runs Dual-Journal WAL crash reconciliation + M1..M5 idempotent migration,
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
        journal_rep = reconcile_dual_journals_and_db(db, sf_mod.DATA_DIR)
        mig_rep = run_surgery_approval_migration(db, sf_mod.DATA_DIR, sf_mod.BASE_DIR)

        migrated_any = any(v > 0 for k, v in mig_rep["counts"].items() if k != "alreadyMigrated")
        if (
            journal_rep.get("replayedEvents", 0) > 0
            or journal_rep.get("replayedAttributionEvents", 0) > 0
            or migrated_any
            or not had_cfg
        ):
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

    def _require_in_phase1_scope(surgery: dict, cfg: dict):
        if surgery.get("approachType") == "nsth" and not cfg.get("nsthInternalPrecheckEnabled"):
            raise ApprovalEngineError(422, "NSTH_EXTERNAL_AUTHORITY", "Ca Nội soi tiêu hóa không thuộc luồng duyệt Khoa PTĐTT.")
        in_scope, reason_code = is_in_phase1_approval_scope(surgery, cfg)
        if not in_scope:
            raise ApprovalEngineError(
                403,
                "NOT_IN_PHASE1_SCOPE",
                "Ca mổ không thuộc phạm vi duyệt mổ Đợt 1 (chỉ áp dụng ca mổ chương trình / Robot chương trình đã có lịch mổ).",
                {"scopeReason": reason_code},
            )

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
        Dual-Journal Atomic Transaction Coordinator (S1 -> S2 -> S3):
          Step 1: Acquire LOCK_EX on _DB_LOCK_FILE -> load db.json -> reconcile Dual WAL -> Fail-Closed Auth -> Idempotency check.
          Step 2: Execute handler_fn in memory (RBAC + OCC + validation + notifications).
          Step S1: Append & fsync hash-chained entry (txEventId + embeddedAttributionBatch) to surgery_approval_logs.jsonl.
          Step S2: Append & fsync hash-chained attribution entries to surgery_attribution.jsonl.
          Step S3: Apply contributor summary + write & fsync db.json.tmp -> os.replace(tmp, db.json).
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

            reconcile_dual_journals_and_db(db, sf_mod.DATA_DIR)
            if not isinstance(db.get("surgeryApprovalConfig"), dict):
                run_surgery_approval_migration(db, sf_mod.DATA_DIR, sf_mod.BASE_DIR)

            real_user = resolve_live_user_fail_closed(
                request.headers.get("Authorization", ""),
                sf_mod._verify_jwt,
                sf_mod.AUTH_FILE,
                db,
                sf_mod._save_auth,
                http_method=request.method,
                request_path=request.path,
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
                if (
                    isinstance(target_surgery, dict)
                    and target_surgery.get("isTestSandboxCase") is True
                    and not can_user_access_sandbox(real_user, db)
                ):
                    raise ApprovalEngineError(404, "SURGERY_NOT_FOUND", f"Không tìm thấy ca mổ #{surgery_id}.")

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
                "verify_procedure_class",
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

            idem_key = request.headers.get("Idempotency-Key") or request.headers.get("X-Idempotency-Key") or ""
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

            fingerprint = sha256_hex(canonical_json(body)) if scope_key else None

            catalog = load_procedure_catalog(sf_mod.DATA_DIR, sf_mod.BASE_DIR)
            tx_out = handler_fn(db=db, body=body, real_user=real_user, actor=actor, catalog=catalog, cfg=cfg)

            http_status = int(tx_out.get("httpStatus", 200))
            resp_payload = tx_out["response"]
            wal_spec = tx_out.get("wal")

            if tx_out.get("skipDbWrite") is True and wal_spec is None:
                if isinstance(resp_payload, dict) and isinstance(db.get("_revisions"), dict):
                    resp_payload.setdefault("revisions", copy.deepcopy(db["_revisions"]))
                resp_payload["version"] = sf_mod._get_file_version()
                return jsonify(resp_payload), http_status

            idem_rec = build_idempotency_record(scope_key, fingerprint, http_status, resp_payload)
            if idem_rec:
                db.setdefault("_approvalIdempotency", {})[idem_rec["scopeKey"]] = copy.deepcopy(idem_rec["value"])

            if wal_spec:
                entry, attr_written = append_dual_wal_transaction(
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
                    attribution_specs=wal_spec.get("attributionSpecs"),
                )
                rec_in_db = wal_spec.get("recordRef")
                if isinstance(rec_in_db, dict):
                    tx_id = entry.get("txEventId") or entry.get("eventId")
                    for raw_attr in entry.get("embeddedAttributionBatch") or []:
                        record_contributor_on_surgery(
                            rec_in_db,
                            raw_attr.get("actor") or entry.get("actor") or actor,
                            role_in_case=raw_attr.get("actorRoleInCase", "attending"),
                            action_type=raw_attr.get("actionType", entry.get("action", "edit")),
                            timestamp_iso=raw_attr.get("timestamp", entry.get("timestamp", now_vn_iso())),
                            source_key=f"{tx_id}:{int(raw_attr.get('attrSubIndex', 0))}",
                        )
                    rec_in_db["lastJournalSeq"] = entry["eventSeq"]
                    if attr_written:
                        rec_in_db["lastAttributionSeq"] = attr_written[-1]["attributionSeq"]
                    if isinstance(resp_payload.get("surgery"), dict) and resp_payload["surgery"].get("id") == rec_in_db.get("id"):
                        resp_payload["surgery"] = copy.deepcopy(rec_in_db)
                resp_payload["journalSeq"] = entry["eventSeq"]
                if attr_written:
                    resp_payload["attributionSeqs"] = [a["attributionSeq"] for a in attr_written]

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

            if "approvedRuleSetIds" in body:
                rids = body["approvedRuleSetIds"]
                if not isinstance(rids, list) or any(r not in TNM_RULESET_REGISTRY for r in rids):
                    raise ApprovalEngineError(422, "INVALID_CONFIG", "approvedRuleSetIds chứa mã bộ quy tắc TNM không hợp lệ.")
                new_cfg["approvedRuleSetIds"] = list(dict.fromkeys(rids))
            if "signedVignetteDigest" in body:
                new_cfg["signedVignetteDigest"] = str(body["signedVignetteDigest"] or "").strip() or None
            if "clinicalStagingApprovedBy" in body:
                app_by = body["clinicalStagingApprovedBy"]
                if app_by is not None and (not is_pos_int(app_by) or int(app_by) not in ATTENDING_STAFF_IDS):
                    raise ApprovalEngineError(422, "INVALID_CONFIG", "clinicalStagingApprovedBy phải là BS chính / BCN hợp lệ.")
                new_cfg["clinicalStagingApprovedBy"] = int(app_by) if is_pos_int(app_by) else None
            if "clinicalStagingApprovedAt" in body:
                new_cfg["clinicalStagingApprovedAt"] = str(body["clinicalStagingApprovedAt"] or "").strip() or None
            if "enableAutoStageDerivation" in body:
                if not isinstance(body["enableAutoStageDerivation"], bool):
                    raise ApprovalEngineError(422, "INVALID_CONFIG", "enableAutoStageDerivation phải là boolean.")
                if body["enableAutoStageDerivation"] is True:
                    if (
                        not new_cfg.get("approvedRuleSetIds")
                        or not new_cfg.get("signedVignetteDigest")
                        or not is_pos_int(new_cfg.get("clinicalStagingApprovedBy"))
                    ):
                        raise ApprovalEngineError(
                            422,
                            "CLINICAL_STAGING_SIGNOFF_REQUIRED",
                            "Cần thẩm định chuyên môn (approvedRuleSetIds, signedVignetteDigest, clinicalStagingApprovedBy) trước khi bật tính giai đoạn TNM tự động.",
                        )
                    if not new_cfg.get("clinicalStagingApprovedAt"):
                        new_cfg["clinicalStagingApprovedAt"] = now_vn_iso()
                new_cfg["enableAutoStageDerivation"] = body["enableAutoStageDerivation"]

            if "podRosters" in body:
                rosters = body["podRosters"]
                if not isinstance(rosters, list):
                    raise ApprovalEngineError(422, "INVALID_CONFIG", "podRosters phải là danh sách các kỳ phân công khu vực.")
                norm_rosters = []
                for idx_r, r_item in enumerate(rosters):
                    if not isinstance(r_item, dict):
                        raise ApprovalEngineError(422, "INVALID_CONFIG", f"podRosters[{idx_r}] không hợp lệ.")
                    ef = str(r_item.get("effectiveFrom") or "").strip()
                    et = str(r_item.get("effectiveTo") or "").strip()
                    if not is_valid_iso_date(ef) or not is_valid_iso_date(et) or et < ef:
                        raise ApprovalEngineError(422, "INVALID_POD_ROSTER_WINDOW", "Khoảng ngày hiệu lực podRosters không hợp lệ.")
                    for prev_r in norm_rosters:
                        if not (et < prev_r["effectiveFrom"] or ef > prev_r["effectiveTo"]):
                            raise ApprovalEngineError(422, "OVERLAPPING_POD_ROSTERS", "Hai kỳ phân công POD bị chồng lắp ngày hiệu lực.")
                    norm_rosters.append({
                        "rosterPeriod": str(r_item.get("rosterPeriod") or f"{ef}_{et}"),
                        "effectiveFrom": ef,
                        "effectiveTo": et,
                        "approvedByStaffId": actor.get("staffId"),
                        "rooms": copy.deepcopy(r_item.get("rooms") or {}),
                    })
                new_cfg["podRosters"] = norm_rosters

            if "journalRotateMaxBytes" in body:
                j_max = body["journalRotateMaxBytes"]
                if not is_pos_int(j_max) or int(j_max) < 1024:
                    raise ApprovalEngineError(422, "INVALID_CONFIG", "journalRotateMaxBytes phải >= 1024 bytes.")
                new_cfg["journalRotateMaxBytes"] = int(j_max)

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
                        "enableAutoStageDerivation": new_cfg.get("enableAutoStageDerivation", False),
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
            _require_in_phase1_scope(surgery, cfg)
            _require_expected_revision(body, surgery)

            before_surgery = copy.deepcopy(surgery)
            rev_before = int(surgery.get("caseRevision", 1))
            approval = surgery.setdefault("approval", {"status": "draft_unsubmitted", "activeHold": None})
            old_status = approval.get("status", "draft_unsubmitted")

            tier_a_changed, act_name, summary = apply_draft_updates(surgery, actor, body, catalog, db)

            if summary.get("isNoOp") is True:
                return {
                    "httpStatus": 200,
                    "response": {"ok": True, "noOp": True, "surgery": copy.deepcopy(surgery)},
                    "wal": None,
                    "skipDbWrite": True,
                }

            attr_ops = summary.pop("attributionOps", None) or []

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
            changed_fields = compute_recursive_changed_fields(before_surgery, surgery)
            if not isinstance(changed_fields, dict):
                changed_fields = {}

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
                    "committedStatePatch": {"patchKind": "surgery_field_delta", "changedFields": changed_fields},
                    "attributionSpecs": attr_ops,
                    "recordRef": surgery,
                },
            }

        return _run_wal_tx(action_key="draft", surgery_id=sid, handler_fn=_handler)

    @app.route("/api/surgery-approval/<int:sid>/request-verify", methods=["POST"])
    def request_attending_verify(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            surgery = _find_surgery_or_404(db, sid)
            _require_in_phase1_scope(surgery, cfg)
            _require_expected_revision(body, surgery)
            draft_attr_ops = []
            if isinstance(body.get("draft"), dict):
                _, _, d_sum = apply_draft_updates(surgery, actor, body["draft"], catalog, db)
                draft_attr_ops = d_sum.get("attributionOps") or []

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

            role_in_case = resolve_case_actor_role(surgery, actor, catalog, db)
            attr_specs = list(draft_attr_ops) + [{
                "episodeId": surgery.get("episodeId"),
                "actorRoleInCase": role_in_case,
                "roleContextSource": "server_roster",
                "actionType": "request_attending_verify",
                "touchedSections": ["approval.readyForAttending"],
            }]

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
                    "attributionSpecs": attr_specs,
                    "recordRef": surgery,
                },
            }

        return _run_wal_tx(action_key="request_verify", surgery_id=sid, handler_fn=_handler)

    @app.route("/api/surgery-approval/<int:sid>/submit", methods=["POST"])
    def submit_surgery_for_approval(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            surgery = _find_surgery_or_404(db, sid)
            _require_in_phase1_scope(surgery, cfg)
            _require_expected_revision(body, surgery)

            if not (is_attending_user(actor) or is_bcn_user(actor)):
                raise ApprovalEngineError(
                    403,
                    "ATTENDING_REQUIRED",
                    "Chỉ Bác sĩ chính phụ trách ca mổ (hoặc BCN) mới có quyền bấm Trình duyệt mổ.",
                )

            draft_attr_ops = []
            if isinstance(body.get("draft"), dict):
                _, _, d_sum = apply_draft_updates(surgery, actor, body["draft"], catalog, db)
                draft_attr_ops = d_sum.get("attributionOps") or []

            approval = surgery.setdefault("approval", {"status": "draft_unsubmitted", "activeHold": None})
            old_status = approval.get("status", "draft_unsubmitted")
            if old_status in ("approved", "post_approval_hold", "trashed_inactive", "nsth_external_authority", "not_in_scope"):
                raise ApprovalEngineError(409, "INVALID_STATUS_TRANSITION", f"Không thể trình duyệt từ trạng thái '{old_status}'.")

            submit_auth = resolve_submit_authorization(surgery, actor, body, catalog, db)
            validate_routine_submit_gate(surgery, actor, body, catalog, db, cfg)

            cc = surgery.get("clinicalClassification") or {}
            urgency = cc.get("urgencyLevel") or suggest_urgency_level(surgery.get("surgeryType"))
            sla_status = compute_sla_status(surgery, cfg, urgency)
            late_reason = str(body.get("lateReason") or approval.get("lateReason") or "").strip()
            if sla_status == "late" and len(late_reason) < 5:
                raise ApprovalEngineError(
                    422,
                    "LATE_REASON_REQUIRED",
                    "Ca mổ trình sau mốc 16:00 ngày N-2 — vui lòng nhập lý do trình trễ hạn.",
                )

            # Freeze POD Snapshot against active server-side podRosters
            pa = surgery.setdefault("podAssignment", {})
            r_info = get_pod_room_info(catalog, pa.get("wardRoom"), db=db, ref_date=surgery.get("date"))
            pa["podSnapshot"] = {
                "rosterPeriod": r_info.get("rosterPeriod") or ((catalog.get("podRoster") or {}).get("rosterPeriod")) or "2026-10-05_2026-12-13",
                "rosterSource": r_info.get("rosterSource", "server_roster"),
                "podId": r_info.get("podId"),
                "wardRoom": pa.get("wardRoom"),
                "attendingStaffIds": r_info.get("attendingStaffIds", []),
                "residentStaffIds": r_info.get("residentStaffIds", []),
                "capturedAt": now_vn_iso(),
            }

            rev_before = int(surgery.get("caseRevision", 1))
            rev_after = rev_before + 1
            surgery["caseRevision"] = rev_after

            acting_reason = submit_auth.get("actingForMainSurgeonReason")
            proxy_source = submit_auth.get("proxySubmitterSource")
            proxy_reason_code = submit_auth.get("proxyReasonCode")
            pod_src = submit_auth.get("podMembershipSource")

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
                "submitterMode": submit_auth.get("submitterMode"),
                "proxySubmitterSource": proxy_source,
                "proxyReasonCode": proxy_reason_code,
                "podMembershipSource": pod_src,
                "actingForMainSurgeonReason": acting_reason,
            }
            stamp_badge_fields(surgery)

            event_seed = str(uuid.uuid4())
            recipients = [CHIEF_STAFF_ID, DEPUTY_STAFF_ID]
            if is_pos_int(surgery.get("mainSurgeon")) and surgery.get("mainSurgeon") != actor.get("staffId"):
                recipients.append(surgery["mainSurgeon"])
            short_txt = (
                f"Đã trình duyệt thay ({acting_reason}) — Chờ BCN phê duyệt"
                if proxy_source
                else "Đã trình duyệt mổ tại khoa — Chờ BCN phê duyệt"
            )
            notifs = build_approval_notifications(
                db,
                surgery,
                actor_staff_id=actor.get("staffId"),
                event_id=event_seed,
                notif_type="surgery_submitted",
                short_status_text=short_txt,
                recipient_staff_ids=recipients,
            )
            if notifs:
                db.setdefault("notifications", []).extend(notifs)
                db.setdefault("_revisions", {})["notifications"] = int(db.get("_revisions", {}).get("notifications", 1)) + 1

            revs = db.setdefault("_revisions", {})
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1

            role_in_case = resolve_case_actor_role(surgery, actor, catalog, db)
            attr_specs = list(draft_attr_ops) + [{
                "episodeId": surgery.get("episodeId"),
                "actorRoleInCase": proxy_source or role_in_case,
                "roleContextSource": pod_src or "server_roster",
                "actionType": "proxy_submit_case" if proxy_source else "submit_case",
                "touchedSections": ["approval.submittedSnapshot"],
                "proxyMeta": {
                    "proxySubmitterSource": proxy_source,
                    "proxyReasonCode": proxy_reason_code,
                    "actingForMainSurgeonReason": acting_reason,
                    "mainSurgeonStaffId": surgery.get("mainSurgeon"),
                } if proxy_source else None,
            }]

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
                        "submitterMode": submit_auth.get("submitterMode"),
                        "proxySubmitterSource": proxy_source,
                        "proxyReasonCode": proxy_reason_code,
                        "actingForMainSurgeonReason": acting_reason,
                    },
                    "committedStatePatch": {"patchKind": "surgery_upsert", "surgeryRecord": copy.deepcopy(surgery)},
                    "committedNotifications": notifs,
                    "attributionSpecs": attr_specs,
                    "recordRef": surgery,
                },
            }

        return _run_wal_tx(action_key="submit", surgery_id=sid, handler_fn=_handler)

    @app.route("/api/surgery-approval/<int:sid>/submit-emergency", methods=["POST"])
    def submit_emergency_exception(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            surgery = _find_surgery_or_404(db, sid)
            _require_expected_revision(body, surgery)

            # Strictly Attending / On-call Doctor / BCN (blocks trainees & nurses -> 403 first)
            if not (is_attending_user(actor) or is_bcn_user(actor)):
                raise ApprovalEngineError(
                    403,
                    "FORBIDDEN",
                    "Chỉ Bác sĩ chính / Bác sĩ trực khoa (08:00–18:00) hoặc BCN mới có quyền thao tác.",
                )

            # QĐ3 (BS. An chốt 02/11/2026): Cấp cứu & Bán khẩn nằm ngoài luồng duyệt Đợt 1 (`not_in_scope`)
            raise ApprovalEngineError(
                403,
                "NOT_IN_PHASE1_SCOPE",
                "Theo Quyết định Đợt 1, ca mổ cấp cứu / bán khẩn không áp luồng trình duyệt mổ chương trình (hiển thị bình thường, không chặn mổ).",
            )

        return _run_wal_tx(action_key="submit_emergency", surgery_id=sid, handler_fn=_handler)

    @app.route("/api/surgery-approval/<int:sid>/verify-procedure-class", methods=["POST"])
    def verify_custom_procedure_class(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            actor_id = actor.get("staffId")
            if actor_id not in BCN_STAFF_IDS:
                raise ApprovalEngineError(
                    403,
                    "FORBIDDEN",
                    "Chỉ Trưởng khoa (hoặc Phó Trưởng khoa có ủy quyền hợp lệ) mới được xác minh hạng kỹ thuật.",
                )

            surgery = _find_surgery_or_404(db, sid)
            _require_expected_revision(body, surgery)
            _require_in_phase1_scope(surgery, cfg)
            before_surgery = copy.deepcopy(surgery)

            urgency = ((surgery.get("clinicalClassification") or {}).get("urgencyLevel")) or "elective"
            delegation_id = None
            if actor_id == DEPUTY_STAFF_ID:
                active_del = find_active_delegation_for_deputy(
                    db, sid, urgency, is_sandbox_case=bool(surgery.get("isTestSandboxCase"))
                )
                if not active_del:
                    raise ApprovalEngineError(
                        403,
                        "DELEGATION_NOT_ACTIVE",
                        "Phó Trưởng khoa cần Ủy quyền đang hiệu lực của Trưởng khoa để chốt xác minh hạng kỹ thuật.",
                    )
                delegation_id = active_del.get("delegationId")

            v_cls = body.get("verifiedClass")
            v_basis = body.get("verifiedBasisCode") or "equivalent_dm309_complexity"
            if v_cls not in ("PT-ĐB", "PT-I", "PT-II", "PT-III"):
                raise ApprovalEngineError(
                    422,
                    "CUSTOM_PROCEDURE_VERIFICATION_REQUIRED",
                    "Vui lòng chọn hạng kỹ thuật xác minh cụ thể (PT-ĐB, PT-I, PT-II hoặc PT-III).",
                )
            if v_basis not in VALID_VERIFIED_BASIS_CODES:
                raise ApprovalEngineError(422, "INVALID_VERIFIED_BASIS", "Căn cứ xác minh hạng kỹ thuật không hợp lệ.")
            v_note = str(body.get("verifiedNote") or "").strip()
            if v_basis in ("other", "other_note") and len(v_note) < 5:
                raise ApprovalEngineError(
                    422,
                    "VERIFIED_BASIS_NOTE_REQUIRED",
                    "Khi chọn 'Căn cứ khác', vui lòng nhập ghi chú căn cứ xác minh tối thiểu 5 ký tự.",
                )

            cc = surgery.setdefault("clinicalClassification", {})
            pc_obj = cc.setdefault("procedureClass", {})
            col_obj = cc.setdefault("columnCompliance", {})
            pc_obj["verifiedClass"] = v_cls
            pc_obj["verifiedBasisCode"] = v_basis
            pc_obj["verifiedByStaffId"] = actor_id
            pc_obj["verifiedAt"] = now_vn_iso()
            pc_obj["verifiedNote"] = v_note or None
            is_custom = bool(pc_obj.get("isCustomOutsideCatalog") is True or pc_obj.get("confirmedCatalogEntryId") == "CUSTOM_OUTSIDE_DM309")
            if not is_custom and pc_obj.get("confirmedClass") in (None, "unclassified", "unknown_ambiguous"):
                pc_obj["confirmedClass"] = v_cls

            live_col = evaluate_column_compliance(
                catalog,
                db,
                main_surgeon_id=surgery.get("mainSurgeon"),
                approach_type=surgery.get("approachType", "mo"),
                surgery_date=surgery.get("date", ""),
                confirmed_class=v_cls,
                confirmed_catalog_id=pc_obj.get("confirmedCatalogEntryId"),
                is_custom_outside_catalog=is_custom,
                proposed_class=pc_obj.get("proposedClass"),
                verified_class=v_cls,
            )
            col_obj.update(live_col)
            if body.get("externalPrivilegeConfirmed") is True:
                col_obj["externalPrivilegeConfirmed"] = True
                col_obj["privilegeVerifiedByStaffId"] = actor_id

            rev_before = int(surgery.get("caseRevision", 1))
            rev_after = rev_before + 1
            surgery["caseRevision"] = rev_after
            stamp_badge_fields(surgery)

            revs = db.setdefault("_revisions", {})
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1
            delta = compute_recursive_changed_fields(before_surgery, surgery)

            return {
                "httpStatus": 200,
                "response": {"ok": True, "surgery": copy.deepcopy(surgery)},
                "wal": {
                    "action": "verify_custom_procedure_class",
                    "surgeryId": sid,
                    "caseRevBefore": rev_before,
                    "caseRevAfter": rev_after,
                    "delegationId": delegation_id,
                    "summary": {
                        "verifiedClass": v_cls,
                        "verifiedBasisCode": v_basis,
                        "systemCheck": col_obj.get("systemCheck"),
                    },
                    "committedStatePatch": {
                        "patchKind": "surgery_field_delta",
                        "surgeryId": sid,
                        "changedFields": delta if isinstance(delta, dict) else {},
                    },
                    "attributionSpecs": [
                        {
                            "actionCode": "verify_custom_procedure_class",
                            "targetScope": "procedureClass",
                            "metadata": {"verifiedClass": v_cls, "verifiedBasisCode": v_basis},
                        }
                    ],
                    "recordRef": surgery,
                },
            }

        return _run_wal_tx(action_key="verify_procedure_class", surgery_id=sid, handler_fn=_handler)

    @app.route("/api/surgery-approval/<int:sid>/preapprove", methods=["POST"])
    def preapprove_surgery(sid):
        def _handler(db, body, real_user, actor, catalog, cfg):
            if actor.get("staffId") != DEPUTY_STAFF_ID:
                raise ApprovalEngineError(403, "FORBIDDEN", "Chỉ Phó Trưởng khoa mới thực hiện bước Tiền duyệt.")

            surgery = _find_surgery_or_404(db, sid)
            _require_expected_revision(body, surgery)
            _require_in_phase1_scope(surgery, cfg)

            approval = surgery.setdefault("approval", {})
            old_status = approval.get("status")
            if old_status not in ("submitted", "preapproved"):
                raise ApprovalEngineError(409, "INVALID_STATUS_TRANSITION", f"Chỉ tiền duyệt ca đang ở trạng thái 'submitted' (hiện tại: '{old_status}').")

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
                    "attributionSpecs": [{"actionCode": "preapprove_deputy", "targetScope": "approval"}],
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
            if old_status != "emergency_exception_pending_ack":
                _require_in_phase1_scope(surgery, cfg)
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
                    "attributionSpecs": [
                        {"actionCode": "return_for_revision", "targetScope": "approval", "metadata": {"chips": chips}}
                    ],
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
            _require_in_phase1_scope(surgery, cfg)
            if old_status not in ("submitted", "preapproved"):
                raise ApprovalEngineError(
                    409,
                    "INVALID_STATUS_TRANSITION",
                    f"Chỉ phê duyệt ca đã trình duyệt ('submitted' hoặc 'preapproved', hiện tại: '{old_status}').",
                )

            cc = surgery.setdefault("clinicalClassification", {})
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

            # Enforce BCN Verification Gate + Full Clinical Submit Gate (Zero-Bypass)
            validate_bcn_approve_gate(surgery, actor, body, catalog, db, cfg)

            ck_map = surgery.get("preopChecklist") or {}
            sub_snap = approval.get("submittedSnapshot") or {}
            is_self_involved = (
                actor_id == surgery.get("mainSurgeon")
                or actor_id == sub_snap.get("submittedByStaffId")
                or actor_id == ((ck_map.get("CK-04") or {}).get("verifiedByStaffId"))
                or actor_id == ((ck_map.get("CK-08") or {}).get("verifiedByStaffId"))
            )
            if is_self_involved:
                approval_mode = "self_approval_main_surgeon"

            prev_cycles = int(approval.get("approvalCycleCount", 0) or 0)
            was_prev_approved = bool(approval.get("firstApprovedAt") or approval.get("lastApprovedSnapshot") or prev_cycles >= 1)
            new_cycles = (max(prev_cycles, 1) + 1) if was_prev_approved else 1
            is_reapproval = new_cycles >= 2
            reapproval_idx = max(0, new_cycles - 1)
            approved_ts = now_vn_iso()

            rev_before = int(surgery.get("caseRevision", 1))
            rev_after = rev_before + 1
            surgery["caseRevision"] = rev_after

            note = str(body.get("note") or "").strip()
            approval["status"] = "approved"
            approval["activeHold"] = None
            if not approval.get("firstApprovedAt"):
                approval["firstApprovedAt"] = approved_ts
            approval["latestApprovedAt"] = approved_ts
            approval["approvalCycleCount"] = new_cycles
            approval["approvedSnapshot"] = {
                "caseRevision": rev_after,
                "approvedAt": approved_ts,
                "approvedByStaffId": actor_id,
                "approvalMode": approval_mode,
                "delegationId": delegation_id,
                "approvalCycleCount": new_cycles,
                "isReapproval": is_reapproval,
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
                short_status_text="✅ Đã duyệt lại tại khoa" if is_reapproval else "✅ Đã duyệt tại khoa",
                recipient_staff_ids=targets,
            )
            if notifs:
                db.setdefault("notifications", []).extend(notifs)
                db.setdefault("_revisions", {})["notifications"] = int(db.get("_revisions", {}).get("notifications", 1)) + 1

            revs = db.setdefault("_revisions", {})
            revs["surgeries"] = int(revs.get("surgeries", 1)) + 1

            wal_action = "approve_reapproval" if is_reapproval else "approve_initial"
            resp = {"ok": True, "surgery": copy.deepcopy(surgery)}
            return {
                "httpStatus": 200,
                "response": resp,
                "wal": {
                    "action": wal_action,
                    "surgeryId": sid,
                    "caseRevBefore": rev_before,
                    "caseRevAfter": rev_after,
                    "delegationId": delegation_id,
                    "summary": {
                        "statusBefore": old_status,
                        "statusAfter": "approved",
                        "approvalMode": approval_mode,
                        "approvalCycleCount": new_cycles,
                        "reapprovalIndex": reapproval_idx,
                        "isTestSandboxCase": bool(surgery.get("isTestSandboxCase")),
                    },
                    "committedStatePatch": {"patchKind": "surgery_upsert", "surgeryRecord": copy.deepcopy(surgery)},
                    "committedNotifications": notifs,
                    "attributionSpecs": [
                        {
                            "actionCode": wal_action,
                            "targetScope": "approval",
                            "metadata": {"approvalMode": approval_mode, "approvalCycleCount": new_cycles},
                        }
                    ],
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
                or is_same_pod_attending(catalog, surgery, actor_id, db=db)
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

            sid_filter = request.args.get("surgeryId", "").strip()
            target_sid = int(sid_filter) if sid_filter.isdigit() else None
            before_raw = request.args.get("beforeSeq", "").strip()
            before_seq = int(before_raw) if before_raw.isdigit() else None
            limit = min(max(int(request.args.get("limit", "200") or 200), 1), 1000)
            include_snapshot = request.args.get("includeSnapshot") == "1"
            verify_requested = request.args.get("verifyChain") == "1"

            sandbox_ids = {
                s.get("id")
                for s in ((db.get("surgeries") or []) + (db.get("surgeriesTrash") or []))
                if isinstance(s, dict) and s.get("isTestSandboxCase") is True
            }
            allow_sbx = can_user_access_sandbox(real_user, db)

            def _accept_ev(ev):
                if allow_sbx:
                    return True
                act = str(ev.get("action") or "")
                if act.startswith("sandbox_"):
                    return False
                if ev.get("surgeryId") in sandbox_ids:
                    return False
                actor_ev = ev.get("actor") or {}
                if actor_ev.get("isSimulated") or actor_ev.get("simulatedBySuperAdminStaffId"):
                    return False
                patch = ev.get("committedStatePatch") or {}
                if (patch.get("surgeryRecord") or {}).get("isTestSandboxCase") is True:
                    return False
                if (patch.get("delegationRecord") or {}).get("isTestSandboxDelegation") is True:
                    return False
                return True

            page = query_journal_reverse_paginated(
                sf_mod.DATA_DIR,
                "approval",
                limit=limit,
                before_seq=before_seq,
                surgery_id=target_sid,
                filter_fn=_accept_ev,
            )

            journal_path = get_journal_path(sf_mod.DATA_DIR)
            hot_size = os.path.getsize(journal_path) if os.path.isfile(journal_path) else 0
            chain_ok = True
            chain_err = None
            if verify_requested or hot_size <= 5 * 1024 * 1024:
                cp = load_or_init_journal_checkpoint(sf_mod.DATA_DIR)
                base_seq = int(((cp.get("approval") or {}).get("activeBaseSeq", 0)) or 0)
                gen_hash = str(((cp.get("approval") or {}).get("activeGenesisHash")) or GENESIS_HASH)
                chain_ok, _, chain_err, _, _ = verify_journal_stream_streaming(
                    journal_path,
                    expected_start_seq=base_seq + 1,
                    expected_genesis_hash=gen_hash,
                    seq_field="eventSeq",
                    collect_entries=False,
                )

            sanitized = []
            for e in page["items"]:
                item = {
                    "eventId": e.get("eventId"),
                    "txEventId": e.get("txEventId") or e.get("eventId"),
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
                }
                if include_snapshot:
                    item["committedStatePatch"] = e.get("committedStatePatch")
                sanitized.append(item)

            return jsonify({
                "chainValid": chain_ok,
                "totalEvents": page["headSeq"],
                "headHash": page["headHash"],
                "chainError": chain_err,
                "hasMore": page["hasMore"],
                "nextBeforeSeq": page["nextBeforeSeq"],
                "entries": sanitized,
            })
        except ApprovalEngineError as e:
            return jsonify(e.to_dict()), e.status_code

    @app.route("/api/surgery-approval/<int:sid>/attribution", methods=["GET"])
    def get_surgery_attribution_history(sid):
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

            surgery = _find_surgery_or_404(db, sid)
            if surgery.get("isTestSandboxCase") is True and not can_user_access_sandbox(real_user, db):
                raise ApprovalEngineError(404, "SURGERY_NOT_FOUND", f"Không tìm thấy ca mổ #{sid}.")

            before_raw = request.args.get("beforeSeq", "").strip()
            before_seq = int(before_raw) if before_raw.isdigit() else None
            limit = min(max(int(request.args.get("limit", "100") or 100), 1), 500)

            page = query_journal_reverse_paginated(
                sf_mod.DATA_DIR,
                "attribution",
                limit=limit,
                before_seq=before_seq,
                surgery_id=sid,
            )
            return jsonify({
                "ok": True,
                "surgeryId": sid,
                "preparationContributors": surgery.get("preparationContributors") or [],
                "lastAttributionSeq": int(surgery.get("lastAttributionSeq", 0) or 0),
                "hasMore": page["hasMore"],
                "nextBeforeSeq": page["nextBeforeSeq"],
                "events": page["items"],
            })
        except ApprovalEngineError as e:
            return jsonify(e.to_dict()), e.status_code

    @app.route("/api/surgery-approval/kpi", methods=["GET"])
    def get_dual_surgery_approval_kpi():
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

            today_dt = now_vn()
            default_start = f"{today_dt.year:04d}-{today_dt.month:02d}-01"
            if today_dt.month == 12:
                default_end = f"{today_dt.year:04d}-12-31"
            else:
                from datetime import timedelta as _td
                next_m = today_dt.replace(year=today_dt.year, month=today_dt.month + 1, day=1)
                last_d = next_m - _td(days=1)
                default_end = f"{last_d.year:04d}-{last_d.month:02d}-{last_d.day:02d}"

            p_start = request.args.get("periodStart", default_start).strip()
            p_end = request.args.get("periodEnd", default_end).strip()
            if not is_valid_iso_date(p_start) or not is_valid_iso_date(p_end) or p_start > p_end:
                raise ApprovalEngineError(422, "INVALID_PERIOD", "Khoảng thời gian báo cáo (periodStart..periodEnd) không hợp lệ.")

            want_sbx = request.args.get("includeSandbox") == "1"
            allow_sbx = can_user_access_sandbox(real_user, db)
            inc_sbx = bool(want_sbx and allow_sbx)
            kpis = compute_dual_approval_kpis(
                db,
                sf_mod.DATA_DIR,
                p_start,
                p_end,
                include_sandbox=inc_sbx,
            )
            return jsonify({"ok": True, **kpis})
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
            if rec.get("isTestSandboxCase") is True and not can_user_access_sandbox(real_user, db):
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
            if rec.get("isTestSandboxCase") is True and not can_user_access_sandbox(real_user, db):
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

            rollout_date = cfg.get("rolloutEffectiveSurgeryDate", "2026-11-09")
            d_str = rec.get("date", "")
            approval = rec.setdefault("approval", {})
            approval["approvedSnapshot"] = None
            approval["activeHold"] = None

            in_scope, scope_reason = is_in_phase1_approval_scope(rec, cfg)
            if scope_reason == "nsth_external_authority":
                approval["status"] = "nsth_external_authority"
            elif not in_scope:
                if scope_reason == "before_rollout_date" and prev_status in ("legacy_exempt", "legacy_unverified_manual_review"):
                    approval["status"] = prev_status
                else:
                    approval["status"] = "not_in_scope"
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
            if rec.get("isTestSandboxCase") is True and not can_user_access_sandbox(real_user, db):
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
            allow_sbx = can_user_access_sandbox(real_user, db)
            my_items = [
                n for n in notifs
                if isinstance(n, dict)
                and n.get("toStaffId") == my_id
                and (allow_sbx or n.get("isTestSandboxCase") is not True)
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
            allow_sbx = can_user_access_sandbox(real_user, db)
            my_items = [
                n for n in kept
                if isinstance(n, dict)
                and n.get("toStaffId") == my_id
                and (allow_sbx or n.get("isTestSandboxCase") is not True)
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

            import re as _re
            archive_dir = get_archive_dir(sf_mod.DATA_DIR)
            cp = load_or_init_journal_checkpoint(sf_mod.DATA_DIR)

            def _stream_verify_all_segments(stem_prefix: str, hot_path: str, seq_field: str):
                seg_pat = _re.compile(rf"^{_re.escape(stem_prefix)}\.([0-9]{{4}}-Q[1-4])\.seq_([0-9]+)_([0-9]+)\.jsonl\.gz$")
                seg_files = []
                if os.path.isdir(archive_dir):
                    for fn in os.listdir(archive_dir):
                        m = seg_pat.match(fn)
                        if m:
                            seg_files.append((int(m.group(2)), int(m.group(3)), m.group(1), fn))
                seg_files.sort(key=lambda x: (x[0], x[1]))

                exp_seq = 1
                exp_prev = GENESIS_HASH
                max_seq_map = {}
                max_rev_map = {}
                rebuilt_segments = []

                for s_seq_start, s_seq_end, q_lbl, fn in seg_files:
                    gz_p = os.path.join(archive_dir, fn)
                    sha_p = gz_p + ".sha256"
                    h_calc = hashlib.sha256()
                    with open(gz_p, "rb") as rbf:
                        while True:
                            blk = rbf.read(65536)
                            if not blk:
                                break
                            h_calc.update(blk)
                    gz_sha = h_calc.hexdigest()
                    if os.path.isfile(sha_p):
                        with open(sha_p, "r", encoding="utf-8") as sfh:
                            recorded_sha = sfh.read().strip().split()[0]
                        if recorded_sha != gz_sha:
                            raise ApprovalEngineError(
                                503,
                                "AUDIT_ARCHIVE_SHA256_MISMATCH",
                                f"Tệp nén lưu trữ {fn} không khớp mã kiểm tra SHA-256.",
                                {"fileName": fn},
                            )
                    seg_first_prev = exp_prev
                    with gzip.open(gz_p, "rt", encoding="utf-8") as gzf:
                        for line_no, raw in enumerate(gzf, start=1):
                            st = raw.strip()
                            if not st:
                                continue
                            obj = json.loads(st)
                            sq = obj.get(seq_field)
                            if sq != exp_seq or obj.get("prevHash") != exp_prev or obj.get("entryHash") != compute_journal_entry_hash(obj):
                                raise ApprovalEngineError(
                                    503,
                                    "AUDIT_CHAIN_CORRUPTED",
                                    f"Chuỗi băm phân đoạn lưu trữ {fn} bị đứt gãy ở dòng {line_no}.",
                                    {"fileName": fn, "line": line_no, "expectedSeq": exp_seq, "actualSeq": sq},
                                )
                            esid = obj.get("surgeryId")
                            if is_pos_int(esid):
                                max_seq_map[esid] = max(max_seq_map.get(esid, 0), int(sq))
                                r_after = obj.get("caseRevisionAfter")
                                if is_strict_int(r_after):
                                    max_rev_map[esid] = max(max_rev_map.get(esid, 1), r_after)
                            exp_seq += 1
                            exp_prev = obj["entryHash"]
                    if exp_seq - 1 != s_seq_end or s_seq_start != (exp_seq - (s_seq_end - s_seq_start + 1)):
                        raise ApprovalEngineError(503, "AUDIT_CHAIN_CORRUPTED", f"Dải sequence của {fn} không khớp dữ liệu bên trong.")
                    rebuilt_segments.append({
                        "fileName": fn,
                        "quarter": q_lbl,
                        "startSeq": s_seq_start,
                        "endSeq": s_seq_end,
                        "firstPrevHash": seg_first_prev,
                        "lastEntryHash": exp_prev,
                        "gzipSha256": gz_sha,
                        "byteSize": os.path.getsize(gz_p),
                    })

                active_base_seq = exp_seq - 1
                active_genesis = exp_prev
                if os.path.isfile(hot_path):
                    read_last_valid_jsonl_record_adaptive(hot_path, truncate_torn=True)
                    with open(hot_path, "r", encoding="utf-8") as hf:
                        for line_no, raw in enumerate(hf, start=1):
                            st = raw.strip()
                            if not st:
                                continue
                            obj = json.loads(st)
                            sq = obj.get(seq_field)
                            if sq != exp_seq or obj.get("prevHash") != exp_prev or obj.get("entryHash") != compute_journal_entry_hash(obj):
                                raise ApprovalEngineError(
                                    503,
                                    "AUDIT_CHAIN_CORRUPTED",
                                    f"Chuỗi băm nhật ký nóng {os.path.basename(hot_path)} không toàn vẹn ở dòng {line_no}.",
                                    {"line": line_no, "expectedSeq": exp_seq, "actualSeq": sq},
                                )
                            esid = obj.get("surgeryId")
                            if is_pos_int(esid):
                                max_seq_map[esid] = max(max_seq_map.get(esid, 0), int(sq))
                                r_after = obj.get("caseRevisionAfter")
                                if is_strict_int(r_after):
                                    max_rev_map[esid] = max(max_rev_map.get(esid, 1), r_after)
                            exp_seq += 1
                            exp_prev = obj["entryHash"]

                return max_seq_map, max_rev_map, active_base_seq, active_genesis, rebuilt_segments, (exp_seq - 1)

            max_seq_by_sid, max_rev_by_sid, app_base_seq, app_gen_hash, app_segs, total_verified_events = _stream_verify_all_segments(
                "surgery_approval_logs",
                get_journal_path(sf_mod.DATA_DIR),
                "eventSeq",
            )
            max_attr_by_sid, _, attr_base_seq, attr_gen_hash, attr_segs, total_verified_attr = _stream_verify_all_segments(
                "surgery_attribution",
                get_attribution_journal_path(sf_mod.DATA_DIR),
                "attributionSeq",
            )

            cp.setdefault("approval", {})["activeBaseSeq"] = app_base_seq
            cp["approval"]["activeGenesisHash"] = app_gen_hash
            cp["approval"]["segments"] = app_segs
            cp.setdefault("attribution", {})["activeBaseSeq"] = attr_base_seq
            cp["attribution"]["activeGenesisHash"] = attr_gen_hash
            cp["attribution"]["segments"] = attr_segs
            _atomic_write_json(os.path.join(sf_mod.DATA_DIR, "journal_checkpoint.json"), cp)

            # Replace db contents from backup (excluding raw credential fields) while preserving journal seq
            db.clear()
            for k, v in backup_db.items():
                if k not in ("customPasswords", "customAdmins", "disabledAccounts"):
                    db[k] = copy.deepcopy(v)

            run_surgery_approval_migration(db, sf_mod.DATA_DIR, sf_mod.BASE_DIR)
            eff_cfg = get_approval_config(db)

            downgraded_ids = []
            for s in (db.get("surgeries") or []):
                if not isinstance(s, dict):
                    continue
                sid_val = s.get("id")
                j_seq = max_seq_by_sid.get(sid_val, 0)
                s_seq = int(s.get("lastJournalSeq", 0) or 0)
                a_seq = max_attr_by_sid.get(sid_val, 0)
                if a_seq > int(s.get("lastAttributionSeq", 0) or 0):
                    s["lastAttributionSeq"] = a_seq
                if j_seq > s_seq:
                    # Stale backup relative to WAL journal -> NEVER resurrect green tick silently!
                    s["caseRevision"] = max(int(s.get("caseRevision", 1) or 1), max_rev_by_sid.get(sid_val, 1)) + 1
                    s["lastJournalSeq"] = j_seq
                    app_obj = s.setdefault("approval", {})
                    if app_obj.get("approvedSnapshot"):
                        app_obj["lastApprovedSnapshot"] = copy.deepcopy(app_obj["approvedSnapshot"])
                    app_obj["approvedSnapshot"] = None
                    app_obj["activeHold"] = None
                    in_sc, sc_reason = is_in_phase1_approval_scope(s, eff_cfg)
                    if sc_reason == "nsth_external_authority":
                        app_obj["status"] = "nsth_external_authority"
                    elif not in_sc:
                        app_obj["status"] = "not_in_scope"
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
                "verifiedApprovalEvents": total_verified_events,
                "verifiedAttributionEvents": total_verified_attr,
                "verifiedArchiveSegments": len(app_segs),
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
