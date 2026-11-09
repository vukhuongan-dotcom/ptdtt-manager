#!/usr/bin/env python3
"""
PTDTT Manager — Backward-Compatible Bug & Feature Registry Adapter (Schema v3.1 / Rule v2:R45 & v2:R47).

Upgrades legacy `ptdtt-manager/scripts/register_bug_feat.py` while preserving 100% CLI compatibility:
  1. Supports 2-stage lifecycle upsert (`OPEN` -> `VERIFIED_CLOSED`) on existing `--id` without row-count block.
  2. Eliminates worktree fallback (`p1.read_bytes()`) during `--staged-gate`; reads strictly Git index `:path` blobs.
  3. Enforces `VerificationReceipt v1` (`--receipt-id`) when closing via `project_registry_gate.py` receipts,
     and suppresses premature `version.md` `### Fixed` entries while `tech_status == OPEN`.
  4. Logs `PTDTT_SKIP_REGISTRY_GATE=1` / `AG_SKIP_REGISTRY_GATE=1` / `Merge` / `Revert` to `.ag_registry_state/bypass_audit.jsonl`,
     maintains `.ag_registry_state/sync_anchor.json`, and preserves `PHẦN II` counters & `post-push` hook compatibility.
"""

from __future__ import annotations

import argparse
import ast
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

AGENTS_SCRIPTS_DIR = Path(os.environ.get("AGENTS_ROOT", os.path.expanduser("~/Projects/_agents"))) / "scripts"
if str(AGENTS_SCRIPTS_DIR) not in sys.path and AGENTS_SCRIPTS_DIR.is_dir():
    sys.path.insert(0, str(AGENTS_SCRIPTS_DIR))

import project_registry_gate as prg  # noqa: E402

GITHUB_COMMIT_BASE = "https://github.com/vukhuongan-dotcom/ptdtt-manager/commit"
REG_PRIMARY_REL = prg.REG_PRIMARY_REL
REG_MIRROR_REL = prg.REG_MIRROR_REL
VERSION_MD_REL = prg.VERSION_MD_REL

PRODUCTION_CODE_PATHS = {
    "index.html",
    "sw.js",
    "manifest.json",
    "server_flask.py",
    "surgery_approval_engine.py",
    "surgery_approval_routes.py",
}
PRODUCTION_CODE_PREFIXES = ("js/", "css/")


def normalize_build_tag(build: str | None) -> tuple[str | None, str | None]:
    if not build:
        return None, None
    b = build.strip()
    digits = b[1:] if b.lower().startswith("v") else b
    if not re.match(r"^\d{10}$", digits):
        raise ValueError(f"--build phải có định dạng 10 chữ số YYMMDDHHMM (nhận được: {build!r})")
    return digits, f"v{digits}"


def is_production_code_file(rel: str) -> bool:
    if rel in PRODUCTION_CODE_PATHS:
        return True
    if any(rel.startswith(p) for p in PRODUCTION_CODE_PREFIXES):
        return rel.endswith((".js", ".css"))
    return False


def cmd_add(args: argparse.Namespace) -> int:
    canon_root, proj_id = prg.resolve_canonical_project(args.repo_root)
    if getattr(args, "payload_stdin", False):
        ns_rec = argparse.Namespace(
            repo_root=str(canon_root),
            payload_stdin=True,
            payload_file=None,
            mode="normal",
            auto_init=False,
            confirm_owned=True,
            lock_timeout_ms=5000,
            policy_path=None,
        )
        scrubbed = prg._parse_and_scrub_record_payload(ns_rec)
        idem_key = prg._compute_idempotency_key(proj_id, scrubbed)
        alloc_id, stt = prg._apply_record_to_repo(
            canon_root,
            proj_id,
            scrubbed,
            idem_key=idem_key,
            auto_init=False,
            policy_entry={"github_commit_base": GITHUB_COMMIT_BASE},
            allow_pending_verify_version=True,
        )
        print(f"✅ Đã ghi nhận/cập nhật `{alloc_id}` (STT {stt}, trạng thái `{scrubbed['tech_status']}`) và đồng bộ 100% Dual SSoT.")
        return 0

    for req_arg in ("kind", "scope", "title", "context", "solution"):
        if not getattr(args, req_arg, None):
            raise prg.GateError(f"Thiếu tham số bắt buộc `--{req_arg}` (hoặc truyền JSON qua `--payload-stdin`).", prg.EXIT_SCHEMA_UNKNOWN_FIELD)

    digits, _ = normalize_build_tag(args.build)
    if args.tech_status:
        tech_status = args.tech_status.strip().upper()
    elif args.receipt_id:
        tech_status = "VERIFIED_CLOSED"
    elif args.version_note or digits:
        tech_status = "FIXED_PENDING_VERIFY"
    else:
        tech_status = "OPEN"

    payload = {
        "kind": args.kind.upper(),
        "id": args.id.strip().upper() if args.id else None,
        "source_event": "FEATURE_IMPLEMENTATION" if args.kind.upper() == "FEAT" else "USER_REPORTED_DEFECT",
        "scope": args.scope,
        "affected_paths": args.affected_paths or [],
        "title": args.title,
        "symptom": args.context,
        "severity": args.severity,
        "rca_status": args.rca_status,
        "solution": args.solution,
        "tech_status": tech_status,
        "vcs_state": args.commit,
        "receipt_id": args.receipt_id,
        "evidence_note": args.evidence,
        "residual_risk": args.risk,
        "owner": args.approver,
        "discovered_date": args.date,
        "version_note": args.version_note or args.title,
        "build_tag": digits,
    }
    scrubbed = {
        k: ([prg.scrub_sensitive_text(x) for x in v] if isinstance(v, list) else (prg.scrub_sensitive_text(v) if v is not None else None))
        for k, v in payload.items()
    }
    scrubbed["kind"] = args.kind.upper()
    scrubbed["tech_status"] = tech_status
    default_rca = (
        "HYPOTHESIS_PENDING_VERIFY"
        if (scrubbed["kind"] == "BUG" and tech_status == "OPEN")
        else ("VERIFIED_ROOT_CAUSE" if scrubbed["kind"] == "BUG" else "N/A")
    )
    scrubbed["rca_status"] = (scrubbed.get("rca_status") or default_rca).strip().upper()
    idem_key = prg._compute_idempotency_key(proj_id, scrubbed)

    alloc_id, stt = prg._apply_record_to_repo(
        canon_root,
        proj_id,
        scrubbed,
        idem_key=idem_key,
        auto_init=False,
        policy_entry={"github_commit_base": GITHUB_COMMIT_BASE},
        allow_pending_verify_version=True,
    )
    print(f"✅ Đã ghi nhận/cập nhật `{alloc_id}` (STT {stt}, trạng thái `{tech_status}`) và đồng bộ 100% Dual SSoT.")
    return 0


def cmd_backfill_sha(args: argparse.Namespace) -> int:
    ns = argparse.Namespace(
        repo_root=args.repo_root,
        id=args.id,
        sha=args.sha or "HEAD",
        policy_path=None,
        github_commit_base=GITHUB_COMMIT_BASE,
    )
    return prg.cmd_backfill_sha(ns)


def cmd_sync(args: argparse.Namespace) -> int:
    ns = argparse.Namespace(repo_root=args.repo_root, resolve=args.resolve)
    return prg.cmd_sync(ns)


def cmd_verify(args: argparse.Namespace) -> int:
    canon_root, proj_id = prg.resolve_canonical_project(args.repo_root)
    if not args.staged_gate:
        ns = argparse.Namespace(
            repo_root=str(canon_root),
            staged_gate=False,
            syntax_and_schema_only=False,
            commit_msg_file=None,
            check_source_mutation=False,
        )
        return prg.cmd_verify(ns)

    # Staged gate: delegate pure index `:path` syntax + schema + Dual-SSoT check first
    staged_tuples = prg.git_staged_changes(canon_root)
    if not staged_tuples:
        return 0
    staged_all = [p for _, p in staged_tuples]
    staged_live = [p for sc, p in staged_tuples if sc != "D"]
    staged_set = set(staged_all)

    syntax_errs = prg._verify_staged_blobs_syntax(canon_root, staged_live)
    if syntax_errs:
        for e in syntax_errs:
            prg.eprint(f"❌ [SYNTAX GATE] {e}")
        return 1

    if (REG_PRIMARY_REL in staged_set) ^ (REG_MIRROR_REL in staged_set):
        prg.eprint(f"❌ [DUAL SSoT GATE] Phải stage đồng thời cả `{REG_PRIMARY_REL}` và `{REG_MIRROR_REL}`.")
        return 1

    b1 = prg.git_read_object_bytes(canon_root, f":{REG_PRIMARY_REL}")
    b2 = prg.git_read_object_bytes(canon_root, f":{REG_MIRROR_REL}")
    if b1 is None or b2 is None:
        prg.eprint("❌ [DUAL SSoT INDEX GATE] Không tìm thấy blob sổ lỗi trong Git index (không fallback worktree).")
        return 1

    reg_errs = prg.validate_registry_pair_contents(canon_root, b1.decode("utf-8"), b2.decode("utf-8"), check_git_shas=True)
    if reg_errs:
        for e in reg_errs:
            prg.eprint(f"❌ [REGISTRY SCHEMA GATE] {e}")
        return 1

    ag_skip = os.environ.get("AG_SKIP_REGISTRY_GATE") == "1"
    ptdtt_skip = os.environ.get("PTDTT_SKIP_REGISTRY_GATE") == "1"
    merge_head = prg.git_resolve_path(canon_root, "MERGE_HEAD")
    revert_head = prg.git_resolve_path(canon_root, "REVERT_HEAD")
    has_bypass = ag_skip or ptdtt_skip or merge_head.exists() or revert_head.exists()

    if not has_bypass and REG_PRIMARY_REL in staged_set:
        head_b_pre = (
            prg.git_read_object_bytes(canon_root, f"HEAD:{REG_PRIMARY_REL}")
            if prg.git_head_sha(canon_root) != "UNBORN_HEAD"
            else None
        )
        m_pre = prg._extract_meaningful_updated_ids(
            head_b_pre.decode("utf-8") if head_b_pre is not None else None,
            b1.decode("utf-8"),
        )
        closed_pre = {rid: cols for rid, cols in m_pre.items() if prg.normalize_status_token(cols[10]) == "VERIFIED_CLOSED"}
        if closed_pre:
            staged_src_dig = prg.compute_staged_source_tree_digest(canon_root, staged_tuples)
            for rid, cols in closed_pre.items():
                rcpt_err = prg.validate_receipt_for_closed_row(
                    canon_root, proj_id, rid, cols, expected_source_digest=staged_src_dig
                )
                if rcpt_err:
                    prg.eprint(f"🛑 [R45 RECEIPT GATE] {rcpt_err}")
                    return prg.EXIT_UNVERIFIED_CLOSURE

    if args.syntax_and_schema_only:
        return 0

    if ag_skip or ptdtt_skip:
        reason = (os.environ.get("AG_SKIP_REASON") or os.environ.get("PTDTT_SKIP_REASON") or "").strip()
        if ag_skip and len(reason) < 15:
            prg.eprint("❌ `AG_SKIP_REGISTRY_GATE=1` bắt buộc kèm `AG_SKIP_REASON` >= 15 ký tự.")
            return 1
        prg._append_bypass_audit(canon_root, "ENV_SKIP_GATE", reason or "Legacy PTDTT_SKIP_REGISTRY_GATE=1", staged_all)
        return 0

    if merge_head.exists():
        prg._append_bypass_audit(canon_root, "GIT_MERGE", "Active MERGE_HEAD", staged_all)
        return 0
    if revert_head.exists():
        prg._append_bypass_audit(canon_root, "GIT_REVERT", "Active REVERT_HEAD", staged_all)
        return 0

    commit_msg_full = ""
    commit_subject = ""
    if args.commit_msg_file:
        raw_m = Path(args.commit_msg_file).read_text(encoding="utf-8", errors="replace")
        non_c = [ln for ln in raw_m.splitlines() if not ln.strip().startswith("#")]
        commit_msg_full = "\n".join(non_c).strip()
        for ln in non_c:
            if ln.strip():
                commit_subject = ln.strip()
                break

    non_meta = [p for p in staged_all if not prg.is_meta_rel_path(p)]
    if re.match(r"^docs\((?:registry|ssot)\)\s*:", commit_subject, flags=re.IGNORECASE) and not non_meta:
        return 0

    is_fix_or_feat = bool(re.match(r"^(?:fix|feat|hotfix|bugfix)(\([^)]+\))?!?\s*:", commit_subject, flags=re.IGNORECASE))
    prod_touched = [f for f in staged_all if is_production_code_file(f)]
    if is_fix_or_feat or prod_touched or non_meta:
        if REG_PRIMARY_REL not in staged_set or REG_MIRROR_REL not in staged_set:
            prg.eprint("🛑 [AUTO-REGISTRY GATE CHẶN COMMIT] Chưa stage cặp sổ lỗi SSoT cho thay đổi mã nguồn!")
            return 1
        head_b = (
            prg.git_read_object_bytes(canon_root, f"HEAD:{REG_PRIMARY_REL}")
            if prg.git_head_sha(canon_root) != "UNBORN_HEAD"
            else None
        )
        m_ids = prg._extract_meaningful_updated_ids(head_b.decode("utf-8") if head_b else None, b1.decode("utf-8"))
        if not m_ids:
            prg.eprint("🛑 [AUTO-REGISTRY GATE] Không có dòng BUG/FEAT thêm mới hoặc chuyển trạng thái nghiệp vụ hợp lệ!")
            return 1

        # Require version.md ONLY when at least one updated row is FIXED_PENDING_VERIFY or VERIFIED_CLOSED
        needs_version_md = any(
            prg.normalize_status_token(cols[10]) in ("FIXED_PENDING_VERIFY", "VERIFIED_CLOSED")
            for cols in m_ids.values()
        )
        if needs_version_md and VERSION_MD_REL not in staged_set:
            prg.eprint(f"🛑 [AUTO-REGISTRY GATE] Đóng lỗi/tính năng bắt buộc stage kèm `{VERSION_MD_REL}`!")
            return 1

        if commit_msg_full:
            if not any(re.search(rf"\b{re.escape(rid)}\b", commit_msg_full, flags=re.IGNORECASE) for rid in m_ids):
                prg.eprint(f"🛑 [COMMIT-MSG BINDING] Thông điệp commit phải dẫn chiếu mã `{', '.join(m_ids)}` (ví dụ `Refs: {next(iter(m_ids))}`).")
                return 1
    return 0


def build_parser(default_root: str | None = None) -> argparse.ArgumentParser:
    eff_root = default_root or str(Path(__file__).resolve().parent.parent)
    parser = argparse.ArgumentParser(description="PTDTT Auto-Registry Compatibility Adapter (Schema v3.1 / Rule v2:R45)")
    parser.add_argument("--repo-root", default=eff_root, help="Đường dẫn gốc dự án ptdtt-manager")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_add = sub.add_parser("add", help="Thêm hoặc cập nhật (upsert) bản ghi BUG-xxx / FEAT-xxx")
    p_add.add_argument("--payload-stdin", action="store_true", help="Nạp JSON chuẩn R45 qua stdin (Zero-PHI/Zero-Secret)")
    p_add.add_argument("--kind", choices=["BUG", "FEAT", "bug", "feat"], required=False)
    p_add.add_argument("--id", help="Mã định danh (nếu đã tồn tại sẽ upsert chuyển trạng thái)")
    p_add.add_argument("--date", help="Ngày YYYY-MM-DD")
    p_add.add_argument("--commit", help="Mã commit Git")
    p_add.add_argument("--build", help="Mã build 10 chữ số YYMMDDHHMM")
    p_add.add_argument("--scope", required=False, help="Phân hệ ảnh hưởng")
    p_add.add_argument("--affected-paths", nargs="*", default=None, help="Danh sách đường dẫn ảnh hưởng")
    p_add.add_argument("--title", required=False, help="Tiêu đề tóm tắt")
    p_add.add_argument("--context", required=False, help="Hiện tượng / Bối cảnh / RCA")
    p_add.add_argument("--severity", help="Mức độ")
    p_add.add_argument("--rca-status", help="Trạng thái RCA")
    p_add.add_argument("--solution", required=False, help="Giải pháp kỹ thuật")
    p_add.add_argument("--tech-status", default=None, help="Trạng thái kỹ thuật (mặc định OPEN, hoặc FIXED_PENDING_VERIFY khi truyền --build/--version-note; dùng --receipt-id cho VERIFIED_CLOSED)")
    p_add.add_argument("--receipt-id", help="Mã biên lai VerificationReceipt v1 (bắt buộc khi VERIFIED_CLOSED)")
    p_add.add_argument("--evidence", default="PENDING", help="Ghi chú bằng chứng bổ sung")
    p_add.add_argument("--risk", default="Thấp (Đã kiểm chứng)", help="Rủi ro tồn dư")
    p_add.add_argument("--approver", default="BSCKII. Vũ Khương An", help="Người duyệt")
    p_add.add_argument("--version-note", help="Ghi chú vào version.md khi đóng lỗi")
    p_add.set_defaults(func=cmd_add)

    p_sha = sub.add_parser("backfill-sha")
    p_sha.add_argument("--id")
    p_sha.add_argument("--sha", default="HEAD")
    p_sha.set_defaults(func=cmd_backfill_sha)

    p_sync = sub.add_parser("sync")
    p_sync.add_argument("--resolve", choices=["keep-primary", "keep-mirror"])
    p_sync.set_defaults(func=cmd_sync)

    p_ver = sub.add_parser("verify")
    p_ver.add_argument("--staged-gate", action="store_true")
    p_ver.add_argument("--syntax-and-schema-only", action="store_true")
    p_ver.add_argument("--commit-msg-file")
    p_ver.set_defaults(func=cmd_verify)

    return parser


def main(argv: list[str] | None = None, default_root: str | None = None) -> int:
    parser = build_parser(default_root=default_root)
    args = parser.parse_args(argv)
    try:
        return int(args.func(args))
    except prg.GateError as exc:
        prg.eprint(f"❌ {exc}")
        return int(exc.exit_code)
    except Exception as exc:
        prg.eprint(f"❌ Lỗi: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
