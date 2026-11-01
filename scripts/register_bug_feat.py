#!/usr/bin/env python3
"""
PTDTT Manager — Automated Bug & Feature Registry Engine + Git Gate (Schema v3.1 / Rule v2:R45 & v2:R47).

Commands:
  1. python3 scripts/register_bug_feat.py add --kind {BUG,FEAT} --scope "..." --title "..." --context "..." --solution "..." [--build 2611010955] [--version-note "..."]
  2. python3 scripts/register_bug_feat.py backfill-sha [--id BUG-206] [--sha HEAD]
  3. python3 scripts/register_bug_feat.py sync
  4. python3 scripts/register_bug_feat.py verify [--staged-gate] [--commit-msg-file .git/COMMIT_EDITMSG]
"""
from __future__ import annotations

import argparse
import ast
import datetime as dt
import hashlib
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

GITHUB_COMMIT_BASE = "https://github.com/vukhuongan-dotcom/ptdtt-manager/commit"
REG_PRIMARY_REL = "docs/BUG_FIX_REGISTRY.md"
REG_MIRROR_REL = "PROJECT_CONTEXT/BANG_TONG_HOP_LOI_VA_KHAC_PHUC.md"
VERSION_MD_REL = "version.md"

PRODUCTION_CODE_PATHS = {
    "index.html",
    "sw.js",
    "manifest.json",
    "server_flask.py",
    "surgery_approval_engine.py",
    "surgery_approval_routes.py",
}
PRODUCTION_CODE_PREFIXES = ("js/", "css/")


def split_md_row(line: str) -> list[str] | None:
    s = line.strip()
    if not (s.startswith("|") and s.endswith("|")):
        return None
    inner = s[1:-1]
    return [c.strip() for c in re.split(r"(?<!\\)\|", inner)]


def is_data_row(line: str) -> bool:
    s = line.strip()
    if not s.startswith("|") or s.startswith("| STT") or s.startswith("|:---"):
        return False
    return True


def sanitize_cell(text: str) -> str:
    cleaned = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    cleaned = re.sub(r"\n+", "<br>", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"(?<!\\)\|", r"\|", cleaned)
    return cleaned


def parse_registry_rows(content: str) -> tuple[list[tuple[int, list[str]]], list[str]]:
    rows: list[tuple[int, list[str]]] = []
    errors: list[str] = []
    for lineno, line in enumerate(content.splitlines(), 1):
        if not is_data_row(line):
            continue
        cols = split_md_row(line)
        if cols is None or len(cols) != 14:
            col_cnt = 0 if cols is None else len(cols)
            errors.append(f"Dòng {lineno} có {col_cnt} cột (bắt buộc đúng 14 cột Schema v3.1 — kiểm tra ký tự `|` chưa escape `\\|`).")
            continue
        rows.append((lineno, cols))
    return rows, errors


def compute_registry_stats(rows: list[tuple[int, list[str]]]) -> dict[str, object]:
    total = len(rows)
    bug_count = 0
    feat_count = 0
    status_counts = {
        "UNVERIFIED_HISTORICAL": 0,
        "FIXED_PENDING_VERIFY": 0,
        "VERIFIED_CLOSED": 0,
        "OPEN": 0,
        "CONTAINED": 0,
        "REOPENED": 0,
    }
    last_verified_id = "BUG-163"
    latest_date = "2026-03-26"
    max_stt = 0
    max_id_num = 0

    for _, cols in rows:
        try:
            max_stt = max(max_stt, int(cols[0]))
        except ValueError:
            pass
        raw_id = cols[1].strip("` ")
        m = re.match(r"^(BUG|FEAT)-(\d+)$", raw_id)
        if m:
            if m.group(1) == "BUG":
                bug_count += 1
            else:
                feat_count += 1
            max_id_num = max(max_id_num, int(m.group(2)))
        date_str = cols[2].strip()
        if re.match(r"^\d{4}-\d{2}-\d{2}$", date_str) and date_str > latest_date:
            latest_date = date_str
        tech_status = cols[10].strip()
        if tech_status in status_counts:
            status_counts[tech_status] += 1
        if tech_status == "VERIFIED_CLOSED":
            last_verified_id = raw_id

    yyyy, mm, dd = latest_date.split("-")
    return {
        "total": total,
        "bug_count": bug_count,
        "feat_count": feat_count,
        "status_counts": status_counts,
        "last_verified_id": last_verified_id,
        "latest_date_vn": f"{dd}/{mm}/{yyyy}",
        "max_stt": max_stt,
        "max_id_num": max_id_num,
    }


def recompute_summary_counters(content: str) -> str:
    rows, errors = parse_registry_rows(content)
    if errors:
        raise ValueError("\n".join(errors))
    st = compute_registry_stats(rows)
    sc = st["status_counts"]

    updated = re.sub(
        r"^- \*\*Tổng số sự cố & tính năng ghi nhận:\*\* .*$",
        f"- **Tổng số sự cố & tính năng ghi nhận:** **{st['total']} mục** ({st['bug_count']} BUG, {st['feat_count']} FEAT).",
        content,
        count=1,
        flags=re.MULTILINE,
    )
    updated = re.sub(
        r"^- \*\*Lịch sử kế thừa chưa thẩm tra \(`UNVERIFIED_HISTORICAL`\):\*\* \*\*\d+ mục\*\*",
        f"- **Lịch sử kế thừa chưa thẩm tra (`UNVERIFIED_HISTORICAL`):** **{sc['UNVERIFIED_HISTORICAL']} mục**",
        updated,
        count=1,
        flags=re.MULTILINE,
    )
    updated = re.sub(
        r"^- \*\*Đã sửa, chờ kiểm chứng độc lập \(`FIXED_PENDING_VERIFY`\):\*\* \*\*\d+ mục\*\*",
        f"- **Đã sửa, chờ kiểm chứng độc lập (`FIXED_PENDING_VERIFY`):** **{sc['FIXED_PENDING_VERIFY']} mục**",
        updated,
        count=1,
        flags=re.MULTILINE,
    )
    updated = re.sub(
        r"^- \*\*Đã xác minh hoàn tất \(`VERIFIED_CLOSED`\):\*\* \*\*\d+ mục\*\* \(BUG-163 đến [A-Z]+-\d+",
        f"- **Đã xác minh hoàn tất (`VERIFIED_CLOSED`):** **{sc['VERIFIED_CLOSED']} mục** (BUG-163 đến {st['last_verified_id']}",
        updated,
        count=1,
        flags=re.MULTILINE,
    )
    updated = re.sub(
        r"^- \*\*Đang xử lý \(`OPEN`\):\*\* \d+$",
        f"- **Đang xử lý (`OPEN`):** {sc['OPEN']}",
        updated,
        count=1,
        flags=re.MULTILINE,
    )
    updated = re.sub(
        r"^- \*\*Đã phong tỏa an toàn \(`CONTAINED`\):\*\* \d+$",
        f"- **Đã phong tỏa an toàn (`CONTAINED`):** {sc['CONTAINED']}",
        updated,
        count=1,
        flags=re.MULTILINE,
    )
    updated = re.sub(
        r"^- \*\*Mở lại sau đóng \(`REOPENED`\):\*\* \d+$",
        f"- **Mở lại sau đóng (`REOPENED`):** {sc['REOPENED']}",
        updated,
        count=1,
        flags=re.MULTILINE,
    )
    updated = re.sub(
        r"^- \*\*Thời gian ghi nhận:\*\* Từ \*\*26/03/2026\*\* đến \*\*\d{2}/\d{2}/\d{4}\*\*",
        f"- **Thời gian ghi nhận:** Từ **26/03/2026** đến **{st['latest_date_vn']}**",
        updated,
        count=1,
        flags=re.MULTILINE,
    )
    updated = re.sub(
        r"^## 📋 PHẦN II: MA TRẬN TOÀN BỘ \d+ SỰ CỐ & TÍNH NĂNG MỚI",
        f"## 📋 PHẦN II: MA TRẬN TOÀN BỘ {st['total']} SỰ CỐ & TÍNH NĂNG MỚI",
        updated,
        count=1,
        flags=re.MULTILINE,
    )
    return updated


def write_dual_ssot(repo_root: Path, content: str) -> None:
    p1 = repo_root / REG_PRIMARY_REL
    p2 = repo_root / REG_MIRROR_REL
    p2.parent.mkdir(parents=True, exist_ok=True)
    p1.write_text(content, encoding="utf-8")
    p2.write_text(content, encoding="utf-8")
    if hashlib.sha256(p1.read_bytes()).hexdigest() != hashlib.sha256(p2.read_bytes()).hexdigest():
        raise RuntimeError("SHA-256 mismatch sau khi ghi Dual SSoT!")


def normalize_build_tag(build: str | None) -> tuple[str | None, str | None]:
    if not build:
        return None, None
    b = build.strip()
    digits = b[1:] if b.lower().startswith("v") else b
    if not re.match(r"^\d{10}$", digits):
        raise ValueError(f"--build phải có định dạng 10 chữ số YYMMDDHHMM (nhận được: {build!r})")
    return digits, f"v{digits}"


def resolve_git_sha(repo_root: Path, ref: str) -> str:
    cp = subprocess.run(
        ["git", "rev-parse", "--verify", "--short", f"{ref}^{{commit}}"],
        cwd=str(repo_root),
        capture_output=True,
        text=True,
    )
    if cp.returncode != 0:
        raise ValueError(f"Commit `{ref}` không tồn tại trong lịch sử Git của {repo_root}.")
    return cp.stdout.strip()


def update_version_md_on_add(
    repo_root: Path,
    incident_id: str,
    kind: str,
    note: str,
    build_digits: str | None,
    commit_sha: str | None,
) -> None:
    vpath = repo_root / VERSION_MD_REL
    if not vpath.exists():
        return
    vtext = vpath.read_text(encoding="utf-8")
    if build_digits:
        vtext = re.sub(
            r"^> 📌 \*\*Current Build Stamp:\*\* `[0-9]+`",
            f"> 📌 **Current Build Stamp:** `{build_digits}`",
            vtext,
            count=1,
            flags=re.MULTILINE,
        )
    if f"[`{incident_id}`]" in vtext or f"`[{incident_id}]`" in vtext:
        vpath.write_text(vtext, encoding="utf-8")
        return

    meta_parts = [f"`[{incident_id}]`"]
    if commit_sha:
        meta_parts.append(f"commit `{commit_sha}`")
    if build_digits:
        meta_parts.append(f"build `v{build_digits}`")
    clean_note = note.strip().rstrip(".")
    bullet = f"- {clean_note} ({', '.join(meta_parts)})."

    section_heading = "### Added" if kind == "FEAT" else "### Fixed"
    unreleased_match = re.search(r"^## \[Unreleased\]\s*$", vtext, flags=re.MULTILINE)
    if not unreleased_match:
        raise ValueError("version.md thiếu mục `## [Unreleased]`.")

    after_unreleased = vtext[unreleased_match.end():]
    next_rel = re.search(r"^## \[", after_unreleased, flags=re.MULTILINE)
    unrel_block = after_unreleased[: next_rel.start()] if next_rel else after_unreleased
    rest_block = after_unreleased[next_rel.start():] if next_rel else ""

    sec_match = re.search(rf"^{re.escape(section_heading)}\s*$", unrel_block, flags=re.MULTILINE)
    if sec_match:
        insert_pos = sec_match.end()
        unrel_block = unrel_block[:insert_pos] + f"\n{bullet}" + unrel_block[insert_pos:]
    else:
        unrel_block = f"\n\n{section_heading}\n{bullet}" + unrel_block

    vpath.write_text(vtext[: unreleased_match.end()] + unrel_block + rest_block, encoding="utf-8")


def cmd_add(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo_root).resolve()
    p1 = repo_root / REG_PRIMARY_REL
    content = p1.read_text(encoding="utf-8")
    rows, errors = parse_registry_rows(content)
    if errors:
        raise ValueError("\n".join(errors))
    st = compute_registry_stats(rows)

    next_stt = st["max_stt"] + 1
    next_id_num = st["max_id_num"] + 1
    kind = args.kind.upper()
    incident_id = args.id.strip().upper() if args.id else f"{kind}-{next_id_num:03d}"

    for _, cols in rows:
        if cols[1].strip("` ") == incident_id:
            raise ValueError(f"Mã `{incident_id}` đã tồn tại trong sổ theo dõi lỗi!")

    build_digits, build_vtag = normalize_build_tag(args.build)
    commit_sha = resolve_git_sha(repo_root, args.commit) if args.commit else None
    if commit_sha:
        commit_cell = f"[`{commit_sha}`]({GITHUB_COMMIT_BASE}/{commit_sha})"
    elif build_vtag:
        commit_cell = f"`{build_vtag}`"
    else:
        commit_cell = "`PENDING_COMMIT`"

    date_str = args.date or dt.date.today().isoformat()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        raise ValueError(f"--date phải có định dạng YYYY-MM-DD (nhận được: {date_str!r})")

    scope_raw = sanitize_cell(args.scope)
    scope_cell = scope_raw if scope_raw.startswith("**") else f"**{scope_raw}**"
    severity = sanitize_cell(args.severity or ("P2 - Medium" if kind == "BUG" else "N/A"))
    rca_status = sanitize_cell(args.rca_status or ("VERIFIED_ROOT_CAUSE" if kind == "BUG" else "N/A"))
    solution_raw = sanitize_cell(args.solution)
    if build_vtag and build_vtag not in solution_raw:
        solution_raw = f"{solution_raw} (`{build_vtag}`)"

    approver_cell = sanitize_cell(f"{date_str} — {args.approver}")
    new_row_cells = [
        str(next_stt),
        f"`{incident_id}`",
        date_str,
        commit_cell,
        scope_cell,
        sanitize_cell(args.title),
        sanitize_cell(args.context),
        severity,
        rca_status,
        solution_raw,
        sanitize_cell(args.tech_status),
        sanitize_cell(args.evidence),
        sanitize_cell(args.risk),
        approver_cell,
    ]
    new_row_line = "| " + " | ".join(new_row_cells) + " |"

    last_lineno = rows[-1][0]
    lines = content.splitlines()
    lines.insert(last_lineno, new_row_line)
    updated_content = "\n".join(lines) + ("\n" if content.endswith("\n") else "")
    updated_content = recompute_summary_counters(updated_content)
    write_dual_ssot(repo_root, updated_content)

    if args.version_note:
        update_version_md_on_add(repo_root, incident_id, kind, args.version_note, build_digits, commit_sha)

    print(f"✅ Đã ghi nhận `{incident_id}` (STT {next_stt}) và đồng bộ 100% sang 2 tệp Dual SSoT.")
    return 0


def cmd_backfill_sha(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo_root).resolve()
    sha = resolve_git_sha(repo_root, args.sha or "HEAD")
    p1 = repo_root / REG_PRIMARY_REL
    content = p1.read_text(encoding="utf-8")
    rows, errors = parse_registry_rows(content)
    if errors:
        raise ValueError("\n".join(errors))

    target_id = args.id.strip().upper() if args.id else rows[-1][1][1].strip("` ")
    target_lineno = None
    target_cols = None
    for lineno, cols in rows:
        if cols[1].strip("` ") == target_id:
            target_lineno = lineno
            target_cols = cols
            break
    if target_lineno is None or target_cols is None:
        raise ValueError(f"Không tìm thấy `{target_id}` trong `{REG_PRIMARY_REL}`.")

    target_cols[3] = f"[`{sha}`]({GITHUB_COMMIT_BASE}/{sha})"
    lines = content.splitlines()
    lines[target_lineno - 1] = "| " + " | ".join(target_cols) + " |"
    updated_content = "\n".join(lines) + ("\n" if content.endswith("\n") else "")
    updated_content = recompute_summary_counters(updated_content)
    write_dual_ssot(repo_root, updated_content)

    vpath = repo_root / VERSION_MD_REL
    if vpath.exists():
        vtext = vpath.read_text(encoding="utf-8")
        pattern = re.compile(rf"(`\[{re.escape(target_id)}\]`)(?!,\s*commit\s+`)")
        new_vtext = pattern.sub(rf"\1, commit `{sha}`", vtext, count=1)
        if new_vtext != vtext:
            vpath.write_text(new_vtext, encoding="utf-8")

    print(f"✅ Đã cập nhật commit [`{sha}`] cho `{target_id}` trên cả 2 tệp Dual SSoT và `version.md`.")
    return 0


def cmd_sync(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo_root).resolve()
    p1 = repo_root / REG_PRIMARY_REL
    updated = recompute_summary_counters(p1.read_text(encoding="utf-8"))
    write_dual_ssot(repo_root, updated)
    print("✅ Đã tính lại bộ đếm thống kê và đồng bộ SHA-256 giữa 2 tệp Dual SSoT.")
    return 0


def validate_registry_pair(repo_root: Path, content1: str, content2: str, check_git_shas: bool = True) -> list[str]:
    errors: list[str] = []
    if hashlib.sha256(content1.encode("utf-8")).hexdigest() != hashlib.sha256(content2.encode("utf-8")).hexdigest():
        errors.append(
            f"Lệch nội dung/SHA-256 giữa `{REG_PRIMARY_REL}` và `{REG_MIRROR_REL}`. "
            f"Hãy chạy: python3 scripts/register_bug_feat.py sync"
        )
    rows, row_errors = parse_registry_rows(content1)
    errors.extend(row_errors)
    if not rows:
        errors.append("Không tìm thấy hàng dữ liệu nào trong sổ lỗi.")
        return errors

    stts = []
    for lineno, cols in rows:
        try:
            stts.append(int(cols[0]))
        except ValueError:
            errors.append(f"Dòng {lineno}: STT `{cols[0]}` không phải số nguyên.")
    if stts and stts != list(range(1, len(rows) + 1)):
        errors.append(f"Chuỗi STT trong `{REG_PRIMARY_REL}` không liên tục từ 1..{len(rows)}.")

    expected = recompute_summary_counters(content1)
    if expected != content1:
        errors.append(
            "Bộ đếm thống kê ở phần TỔNG QUAN hoặc tiêu đề PHẦN II chưa khớp số hàng thực tế. "
            "Hãy chạy: python3 scripts/register_bug_feat.py sync"
        )

    if check_git_shas and (repo_root / ".git").exists():
        for lineno, cols in rows:
            for sha in re.findall(r"\b([0-9a-f]{7,40})\b", cols[3]):
                cp = subprocess.run(
                    ["git", "cat-file", "-e", f"{sha}^{{commit}}"],
                    cwd=str(repo_root),
                    capture_output=True,
                    text=True,
                )
                if cp.returncode != 0:
                    errors.append(f"Dòng {lineno} ({cols[1]}): Ghost commit SHA `{sha}` không tồn tại trong Git.")
    return errors


def git_staged_files(repo_root: Path) -> list[str]:
    cp = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
        cwd=str(repo_root),
        capture_output=True,
        text=True,
        check=True,
    )
    return [f.strip() for f in cp.stdout.splitlines() if f.strip()]


def git_read_blob(repo_root: Path, spec: str) -> bytes | None:
    cp = subprocess.run(
        ["git", "show", spec],
        cwd=str(repo_root),
        capture_output=True,
    )
    return cp.stdout if cp.returncode == 0 else None


def verify_staged_syntax(repo_root: Path, staged: list[str]) -> list[str]:
    errors: list[str] = []
    for rel in staged:
        if rel.startswith("js/") and rel.endswith(".js"):
            blob = git_read_blob(repo_root, f":{rel}")
            if blob is None:
                continue
            with tempfile.NamedTemporaryFile(suffix=".js", delete=False) as tf:
                tf.write(blob)
                tmp_path = tf.name
            try:
                cp = subprocess.run(["node", "--check", tmp_path], capture_output=True, text=True)
                if cp.returncode != 0:
                    errors.append(f"Lỗi cú pháp JS trong `{rel}`:\n{cp.stderr.strip()}")
            finally:
                Path(tmp_path).unlink(missing_ok=True)
        elif rel.endswith(".py"):
            blob = git_read_blob(repo_root, f":{rel}")
            if blob is None:
                continue
            try:
                ast.parse(blob.decode("utf-8"), filename=rel)
            except SyntaxError as exc:
                errors.append(f"Lỗi cú pháp Python trong `{rel}` (dòng {exc.lineno}): {exc.msg}")
    return errors


def is_production_code_file(rel: str) -> bool:
    if rel in PRODUCTION_CODE_PATHS:
        return True
    if any(rel.startswith(p) for p in PRODUCTION_CODE_PREFIXES):
        return rel.endswith((".js", ".css"))
    return False


def cmd_verify(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo_root).resolve()
    p1 = repo_root / REG_PRIMARY_REL
    p2 = repo_root / REG_MIRROR_REL

    for p in (p1, p2):
        if not p.exists():
            print(f"❌ Thiếu tệp SSoT bắt buộc: {p}", file=sys.stderr)
            return 1
        if p.is_symlink():
            print(f"❌ Tệp SSoT không được phép là symlink (Rule v2:R47): {p}", file=sys.stderr)
            return 1

    if not args.staged_gate:
        errs = validate_registry_pair(
            repo_root,
            p1.read_text(encoding="utf-8"),
            p2.read_text(encoding="utf-8"),
            check_git_shas=True,
        )
        if errs:
            for e in errs:
                print(f"❌ [REGISTRY VERIFY] {e}", file=sys.stderr)
            return 1
        print("✅ Sổ theo dõi lỗi Dual SSoT đạt chuẩn 100% (Schema v3.1, 14 cột, khớp SHA-256).")
        return 0

    # ── Git Staged Gate Mode (pre-commit & commit-msg) ──
    staged = git_staged_files(repo_root)
    if not staged:
        return 0

    syntax_errs = verify_staged_syntax(repo_root, staged)
    if syntax_errs:
        for e in syntax_errs:
            print(f"❌ [SYNTAX GATE] {e}", file=sys.stderr)
        return 1

    staged_set = set(staged)
    if (REG_PRIMARY_REL in staged_set) ^ (REG_MIRROR_REL in staged_set):
        print(
            f"❌ [DUAL SSoT GATE] Phải stage đồng thời cả `{REG_PRIMARY_REL}` và `{REG_MIRROR_REL}`.\n"
            f"   Gợi ý: python3 scripts/register_bug_feat.py sync && git add {REG_PRIMARY_REL} {REG_MIRROR_REL}",
            file=sys.stderr,
        )
        return 1

    b1 = git_read_blob(repo_root, f":{REG_PRIMARY_REL}") or p1.read_bytes()
    b2 = git_read_blob(repo_root, f":{REG_MIRROR_REL}") or p2.read_bytes()
    reg_errs = validate_registry_pair(repo_root, b1.decode("utf-8"), b2.decode("utf-8"), check_git_shas=True)
    if reg_errs:
        for e in reg_errs:
            print(f"❌ [REGISTRY SCHEMA GATE] {e}", file=sys.stderr)
        return 1

    if args.syntax_and_schema_only:
        return 0

    if os.environ.get("PTDTT_SKIP_REGISTRY_GATE") == "1":
        print("⚠️ [REGISTRY GATE] Đã bỏ qua kiểm tra bắt buộc ghi sổ theo biến PTDTT_SKIP_REGISTRY_GATE=1.", file=sys.stderr)
        return 0

    git_dir = repo_root / ".git"
    if (git_dir / "MERGE_HEAD").exists() or (git_dir / "REVERT_HEAD").exists():
        return 0

    commit_subject = ""
    if args.commit_msg_file:
        msg_lines = [
            ln.strip()
            for ln in Path(args.commit_msg_file).read_text(encoding="utf-8", errors="replace").splitlines()
            if ln.strip() and not ln.strip().startswith("#")
        ]
        commit_subject = msg_lines[0] if msg_lines else ""
        if re.match(r"^(Revert\b|Merge\b|revert(\([^)]+\))?:)", commit_subject):
            return 0

    is_fix_or_feat_msg = bool(re.match(r"^(fix|feat)(\([^)]+\))?!?\s*:", commit_subject, flags=re.IGNORECASE))
    prod_touched = [f for f in staged if is_production_code_file(f)]
    requires_entry = is_fix_or_feat_msg or bool(prod_touched)

    if requires_entry:
        missing_targets = [
            t for t in (REG_PRIMARY_REL, REG_MIRROR_REL, VERSION_MD_REL) if t not in staged_set
        ]
        head_reg_blob = git_read_blob(repo_root, f"HEAD:{REG_PRIMARY_REL}")
        head_rows_count = len(parse_registry_rows(head_reg_blob.decode("utf-8"))[0]) if head_reg_blob else 0
        staged_rows_count = len(parse_registry_rows(b1.decode("utf-8"))[0])
        has_new_row = staged_rows_count > head_rows_count

        if missing_targets or not has_new_row:
            reason = (
                f"commit `{commit_subject}`" if is_fix_or_feat_msg else f"thay đổi mã nguồn sản xuất ({', '.join(prod_touched[:4])})"
            )
            print(
                f"\n🛑 [AUTO-REGISTRY GATE CHẶN COMMIT] Phát hiện {reason} nhưng chưa ghi sổ lỗi/tính năng!\n"
                f"   • Thiếu file trong git stage: {', '.join(missing_targets) if missing_targets else '(đã stage nhưng chưa thêm dòng BUG/FEAT mới)'}\n"
                f"   • Số dòng sổ lỗi: HEAD={head_rows_count} -> Staged={staged_rows_count} (yêu cầu >= {head_rows_count + 1})\n\n"
                f"👉 Chạy lệnh sau để tự động cấp mã BUG/FEAT, cập nhật version.md và đồng bộ 2 sổ SSoT:\n"
                f"   python3 scripts/register_bug_feat.py add \\\n"
                f"     --kind {'FEAT' if commit_subject.lower().startswith('feat') else 'BUG'} \\\n"
                f"     --scope \"Phân hệ ảnh hưởng\" \\\n"
                f"     --title \"Tóm tắt ngắn gọn\" \\\n"
                f"     --context \"Hiện tượng / Nguyên nhân gốc rễ (RCA)\" \\\n"
                f"     --solution \"Giải pháp kỹ thuật đã áp dụng\" \\\n"
                f"     --build <YYMMDDHHMM> \\\n"
                f"     --version-note \"Mô tả ghi vào version.md\"\n"
                f"   git add {REG_PRIMARY_REL} {REG_MIRROR_REL} {VERSION_MD_REL}\n",
                file=sys.stderr,
            )
            return 1

    return 0


def build_parser() -> argparse.ArgumentParser:
    default_root = str(Path(__file__).resolve().parent.parent)
    parser = argparse.ArgumentParser(description="PTDTT Auto-Registry CLI & Git Gate")
    parser.add_argument("--repo-root", default=default_root, help="Đường dẫn gốc dự án ptdtt-manager")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_add = sub.add_parser("add", help="Thêm bản ghi BUG-xxx / FEAT-xxx mới và đồng bộ Dual SSoT")
    p_add.add_argument("--kind", choices=["BUG", "FEAT", "bug", "feat"], required=True)
    p_add.add_argument("--id", help="Ghi đè mã định danh (mặc định tự động tăng dần)")
    p_add.add_argument("--date", help="Ngày YYYY-MM-DD (mặc định hôm nay)")
    p_add.add_argument("--commit", help="Mã commit Git (nếu đã có; mặc định dùng v<build> trước khi commit)")
    p_add.add_argument("--build", help="Mã build 10 chữ số YYMMDDHHMM")
    p_add.add_argument("--scope", required=True, help="Phân hệ ảnh hưởng")
    p_add.add_argument("--title", required=True, help="Tiêu đề tóm tắt")
    p_add.add_argument("--context", required=True, help="Hiện tượng / Bối cảnh / Nguyên nhân gốc rễ (RCA)")
    p_add.add_argument("--severity", help="Mức độ (mặc định P2 - Medium cho BUG, N/A cho FEAT)")
    p_add.add_argument("--rca-status", help="Trạng thái RCA (mặc định VERIFIED_ROOT_CAUSE cho BUG, N/A cho FEAT)")
    p_add.add_argument("--solution", required=True, help="Giải pháp khắc phục / Kiến trúc triển khai")
    p_add.add_argument("--tech-status", default="VERIFIED_CLOSED", help="Trạng thái kỹ thuật")
    p_add.add_argument("--evidence", default="Automated Test Suite & ag_lint PASS", help="Biên lai xác minh")
    p_add.add_argument("--risk", default="Thấp (Đã kiểm chứng)", help="Rủi ro tồn dư")
    p_add.add_argument("--approver", default="BSCKII. Vũ Khương An", help="Người duyệt")
    p_add.add_argument("--version-note", help="Tự động chèn dòng changelog vào version.md mục [Unreleased]")
    p_add.set_defaults(func=cmd_add)

    p_sha = sub.add_parser("backfill-sha", help="Điền link commit GitHub thực tế sau khi git commit")
    p_sha.add_argument("--id", help="Mã BUG-xxx / FEAT-xxx (mặc định dòng cuối cùng)")
    p_sha.add_argument("--sha", default="HEAD", help="Commit ref (mặc định HEAD)")
    p_sha.set_defaults(func=cmd_backfill_sha)

    p_sync = sub.add_parser("sync", help="Tính lại bộ đếm thống kê và đồng bộ 2 tệp Dual SSoT")
    p_sync.set_defaults(func=cmd_sync)

    p_ver = sub.add_parser("verify", help="Kiểm tra tính toàn vẹn Schema v3.1 & Git Staged Gate")
    p_ver.add_argument("--staged-gate", action="store_true", help="Chạy kiểm tra các file đang git stage")
    p_ver.add_argument("--syntax-and-schema-only", action="store_true", help="Chỉ kiểm tra syntax + Dual SSoT + Schema v3.1 (dùng cho pre-commit)")
    p_ver.add_argument("--commit-msg-file", help="Đường dẫn tới COMMIT_EDITMSG khi gọi từ commit-msg hook")
    p_ver.set_defaults(func=cmd_verify)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return args.func(args)
    except Exception as exc:
        print(f"❌ Lỗi: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
