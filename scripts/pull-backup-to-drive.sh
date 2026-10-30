#!/bin/bash
# ================================================================
# PTDTT — Authenticated Pull Backup from VPS to Local & Google Drive
# Scheduled via launchd (vn.khoaptdtt.backup-pull)
# Safety Contract (5 Gates):
#   1. Authenticated SSH/SCP with StrictHostKeyChecking=yes (NO public HTTP)
#   2. Isolated 0700 staging + Freshness (<36h) + SHA-256 verification
#   3. Tar traversal/symlink rejection + Sandbox db.json restore smoke check
#   4. Atomic publish (0600) + Last-Known-Good preservation before prune
#   5. Drive SHA-256 readback + Receipt JSON + Exit 2 on Drive mirror failure
# ================================================================
set -euo pipefail

CONFIG_FILE="${PTDTT_OPS_ENV:-$HOME/.config/ptdtt-manager/ops.env}"
[ -f "$CONFIG_FILE" ] || { echo "Missing config: $CONFIG_FILE" >&2; exit 1; }
. "$CONFIG_FILE"

PYTHON_BIN="${PTDTT_PYTHON_BIN:-$HOME/.ag-venv/bin/python3}"
[ -x "$PYTHON_BIN" ] || PYTHON_BIN="$(command -v python3)"

LOCAL_BACKUP_DIR="${PTDTT_LOCAL_BACKUP_DIR:-$HOME/Projects/ptdtt-backups}"
CANONICAL_DRIVE_PARENT="$HOME/Library/CloudStorage/GoogleDrive-vukhuongan@gmail.com/Drive của tôi/AN/01. CÔNG VIỆC/KHOA PTDTT/99. BACKUP/ptdtt-manager"
DRIVE_BACKUP_DIR="${PTDTT_DRIVE_BACKUP_DIR:-$CANONICAL_DRIVE_PARENT/backups}"

# Remap retired legacy Drive root path only when canonical reorganized parent exists (prevents recreating stale root folder)
if [[ "$DRIVE_BACKUP_DIR" == *"/Drive của tôi/01. CÔNG VIỆC BỆNH VIỆN/ptdtt-manager/backups" ]] && [ ! -d "$DRIVE_BACKUP_DIR" ] && [ -d "$CANONICAL_DRIVE_PARENT" ]; then
    DRIVE_BACKUP_DIR="$CANONICAL_DRIVE_PARENT/backups"
fi

DRIVE_KEEP_COUNT="${PTDTT_DRIVE_BACKUP_KEEP_COUNT:-7}"
LOCAL_KEEP_DAYS="${PTDTT_LOCAL_BACKUP_KEEP_DAYS:-30}"
LOCAL_MIN_KEEP="${PTDTT_LOCAL_MIN_KEEP_COUNT:-2}"
MAX_AGE_SECONDS="${PTDTT_MAX_BACKUP_AGE_SECONDS:-129600}" # 36 hours
NOW_EPOCH_OVERRIDE="${PTDTT_NOW_EPOCH_OVERRIDE:-}"
RECEIPT_PATH="${PTDTT_PULL_RECEIPT_PATH:-$HOME/.gemini/antigravity/logs/ptdtt_backup_pull_receipt.json}"
REMOTE_PULL_DIR="${PTDTT_REMOTE_PULL_DIR:-/var/backups/ptdtt/pull_ready}"
LOCAL_SOURCE_DIR="${PTDTT_LOCAL_SOURCE_DIR:-}"
DECRYPT_KEY_FILE="${PTDTT_BACKUP_DECRYPT_KEY_FILE:-}"

RAW_HOST="${PTDTT_SSH_TARGET:-${PTDTT_VPS_HOST:-root@180.93.138.83}}"
if [[ "$RAW_HOST" == *"@"* ]]; then
    SSH_TARGET="$RAW_HOST"
else
    SSH_TARGET="${PTDTT_SSH_USER:-root}@${RAW_HOST}"
fi

SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=20)
if [ -n "${PTDTT_SSH_PORT:-}" ]; then
    SSH_OPTS+=(-p "$PTDTT_SSH_PORT")
fi
if [ -n "${PTDTT_SSH_KNOWN_HOSTS:-}" ]; then
    SSH_OPTS+=(-o "UserKnownHostsFile=$PTDTT_SSH_KNOWN_HOSTS")
fi
if [ -n "${PTDTT_SSH_IDENTITY_FILE:-}" ]; then
    SSH_OPTS+=(-i "$PTDTT_SSH_IDENTITY_FILE")
fi

SCP_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=20)
if [ -n "${PTDTT_SSH_PORT:-}" ]; then
    SCP_OPTS+=(-P "$PTDTT_SSH_PORT")
fi
if [ -n "${PTDTT_SSH_KNOWN_HOSTS:-}" ]; then
    SCP_OPTS+=(-o "UserKnownHostsFile=$PTDTT_SSH_KNOWN_HOSTS")
fi
if [ -n "${PTDTT_SSH_IDENTITY_FILE:-}" ]; then
    SCP_OPTS+=(-i "$PTDTT_SSH_IDENTITY_FILE")
fi

DATE_TAG="${PTDTT_DATE_TAG_OVERRIDE:-$(date '+%Y-%m-%d')}"
mkdir -p "$LOCAL_BACKUP_DIR"
chmod 0700 "$LOCAL_BACKUP_DIR" 2>/dev/null || true
LOG="$LOCAL_BACKUP_DIR/pull.log"

STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ptdtt_pull_stage.XXXXXX")"
chmod 0700 "$STAGE_DIR"
cleanup() { rm -rf "$STAGE_DIR" 2>/dev/null || true; }
trap cleanup EXIT

log() {
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" | tee -a "$LOG"
}

# ── Gate 1: Discover & Pull Remote Artifact + Sidecar SHA-256 ────────────────
ARTIFACT_NAME=""
SOURCE_MTIME_EPOCH=""

if [ -n "$LOCAL_SOURCE_DIR" ]; then
    log "Pulling latest backup from isolated local source..."
    for cand in "latest_backup.tar.gz.enc" "latest_backup.tar.gz"; do
        if [ -f "$LOCAL_SOURCE_DIR/$cand" ] && [ -f "$LOCAL_SOURCE_DIR/${cand}.sha256" ]; then
            ARTIFACT_NAME="$cand"
            SOURCE_MTIME_EPOCH="$("$PYTHON_BIN" -B -c 'import os,sys; print(int(os.path.getmtime(sys.argv[1])))' "$LOCAL_SOURCE_DIR/$cand")"
            cp -p "$LOCAL_SOURCE_DIR/$cand" "$STAGE_DIR/$cand"
            cp -p "$LOCAL_SOURCE_DIR/${cand}.sha256" "$STAGE_DIR/${cand}.sha256"
            break
        fi
    done
else
    log "Pulling latest backup over authenticated SSH ($SSH_TARGET)..."
    REMOTE_META="$(ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "
        set -e
        for cand in latest_backup.tar.gz.enc latest_backup.tar.gz; do
            p=\"${REMOTE_PULL_DIR}/\${cand}\"
            if [ -f \"\$p\" ] && [ -f \"\${p}.sha256\" ]; then
                mt=\$(stat -c %Y \"\$p\" 2>/dev/null || stat -f %m \"\$p\")
                printf '%s|%s\n' \"\$cand\" \"\$mt\"
                exit 0
            fi
        done
        exit 44
    ")" || {
        log "❌ Remote backup artifact or .sha256 missing in $REMOTE_PULL_DIR"
        exit 1
    }
    ARTIFACT_NAME="${REMOTE_META%%|*}"
    SOURCE_MTIME_EPOCH="${REMOTE_META##*|}"
    scp -q "${SCP_OPTS[@]}" \
        "${SSH_TARGET}:${REMOTE_PULL_DIR}/${ARTIFACT_NAME}" \
        "${SSH_TARGET}:${REMOTE_PULL_DIR}/${ARTIFACT_NAME}.sha256" \
        "$STAGE_DIR/" || {
        log "❌ SCP download failed from $SSH_TARGET"
        exit 1
    }
fi

if [ -z "$ARTIFACT_NAME" ] || [ ! -s "$STAGE_DIR/$ARTIFACT_NAME" ] || [ ! -s "$STAGE_DIR/${ARTIFACT_NAME}.sha256" ]; then
    log "❌ Staged backup or .sha256 file missing/empty"
    exit 1
fi

if [[ "$ARTIFACT_NAME" == *.tar.gz.enc ]]; then
    EXT="tar.gz.enc"
    TAR_FOR_VERIFY="$STAGE_DIR/decrypted_verify.tar.gz"
    if [ -z "$DECRYPT_KEY_FILE" ] || [ ! -s "$DECRYPT_KEY_FILE" ]; then
        log "❌ Encrypted backup received ($ARTIFACT_NAME) but PTDTT_BACKUP_DECRYPT_KEY_FILE is missing"
        exit 1
    fi
else
    EXT="tar.gz"
    TAR_FOR_VERIFY="$STAGE_DIR/$ARTIFACT_NAME"
fi

# ── Gate 2 & 3: Freshness, SHA-256 & Isolated Sandbox Restore Verification ───
VERIFY_JSON="$("$PYTHON_BIN" -B - "$STAGE_DIR/$ARTIFACT_NAME" "$STAGE_DIR/${ARTIFACT_NAME}.sha256" "$SOURCE_MTIME_EPOCH" "$MAX_AGE_SECONDS" "$NOW_EPOCH_OVERRIDE" "$EXT" "$DECRYPT_KEY_FILE" "$TAR_FOR_VERIFY" "$STAGE_DIR/sandbox_restore" <<'PYEOF'
import hashlib, json, os, pathlib, shutil, stat, subprocess, sys, tarfile, time

(
    artifact_path,
    sha_file_path,
    mtime_str,
    max_age_str,
    now_override_str,
    ext,
    decrypt_key_file,
    tar_for_verify,
    sandbox_dir,
) = sys.argv[1:10]

def fail(msg):
    sys.stderr.write(msg + "\n")
    sys.exit(1)

now_epoch = int(now_override_str) if now_override_str else int(time.time())
src_mtime = int(mtime_str)
max_age = int(max_age_str)
age_sec = now_epoch - src_mtime
if age_sec < -600:
    fail(f"Source backup timestamp is in the future (skew={-age_sec}s)")
if age_sec > max_age:
    fail(f"Source backup is stale (age={age_sec}s > max={max_age}s)")

expected_sha = pathlib.Path(sha_file_path).read_text(encoding="utf-8").strip().split()[0].lower()
if len(expected_sha) != 64 or any(c not in "0123456789abcdef" for c in expected_sha):
    fail("Invalid .sha256 sidecar format")

h = hashlib.sha256()
with open(artifact_path, "rb") as f:
    while chunk := f.read(65536):
        h.update(chunk)
actual_sha = h.hexdigest()
if actual_sha != expected_sha:
    fail(f"SHA-256 mismatch: expected {expected_sha}, got {actual_sha}")

if ext == "tar.gz.enc":
    res = subprocess.run(
        [
            "openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2",
            "-pass", f"file:{decrypt_key_file}",
            "-in", artifact_path, "-out", tar_for_verify,
        ],
        capture_output=True, text=True,
    )
    if res.returncode != 0 or not os.path.exists(tar_for_verify):
        fail(f"OpenSSL test decryption failed: {res.stderr.strip()}")
    os.chmod(tar_for_verify, 0o600)

os.makedirs(sandbox_dir, mode=0o700, exist_ok=True)
real_sb = os.path.realpath(sandbox_dir)
db_member = None
member_count = 0

try:
    with tarfile.open(tar_for_verify, "r:gz") as tf:
        members = tf.getmembers()
        if not members:
            fail("Archive is empty")
        for m in members:
            member_count += 1
            norm_parts = pathlib.PurePosixPath(m.name).parts
            if not norm_parts or m.name.startswith("/") or ".." in norm_parts:
                fail(f"Unsafe tar member path rejected: {m.name}")
            if m.issym() or m.islnk() or m.ischr() or m.isblk() or m.isfifo() or m.isdev():
                fail(f"Unsafe tar special/link member rejected: {m.name}")
            dest = os.path.realpath(os.path.join(real_sb, m.name))
            if not (dest == real_sb or dest.startswith(real_sb + os.sep)):
                fail(f"Tar path escapes sandbox: {m.name}")
            if pathlib.PurePosixPath(m.name).as_posix().lstrip("./") == "data/db.json" and m.isfile():
                db_member = m
        if db_member is None:
            fail("Required runtime database entry data/db.json missing from backup archive")
        try:
            tf.extract(db_member, path=real_sb, filter="data")
        except TypeError:
            tf.extract(db_member, path=real_sb)
    extracted_db = os.path.join(real_sb, db_member.name)
    with open(extracted_db, "r", encoding="utf-8") as dbf:
        db_obj = json.load(dbf)
    if not isinstance(db_obj, dict) or len(db_obj) == 0:
        fail("Restored data/db.json is not a non-empty JSON object")
    db_keys_count = len(db_obj)
finally:
    shutil.rmtree(sandbox_dir, ignore_errors=True)
    if ext == "tar.gz.enc" and os.path.exists(tar_for_verify):
        os.remove(tar_for_verify)

print(json.dumps({
    "sha256": actual_sha,
    "bytes": os.path.getsize(artifact_path),
    "age_seconds": age_sec,
    "tar_members": member_count,
    "db_top_keys_count": db_keys_count,
}))
PYEOF
)" || {
    log "❌ Pre-publish verification failed; existing backups untouched"
    exit 1
}

# ── Gate 4 & 5: Atomic Local Publish, Safe Retention, Drive Mirror & Receipt ─
rc=0
"$PYTHON_BIN" -B - "$STAGE_DIR/$ARTIFACT_NAME" "$LOCAL_BACKUP_DIR" "$DRIVE_BACKUP_DIR" "$DATE_TAG" "$EXT" "$LOCAL_KEEP_DAYS" "$LOCAL_MIN_KEEP" "$DRIVE_KEEP_COUNT" "$NOW_EPOCH_OVERRIDE" "$RECEIPT_PATH" "$VERIFY_JSON" <<'PYEOF' || rc=$?
import datetime, hashlib, json, os, pathlib, re, shutil, stat, sys, time

(
    staged_file,
    local_dir,
    drive_dir,
    date_tag,
    ext,
    local_keep_days_s,
    local_min_keep_s,
    drive_keep_cnt_s,
    now_override_s,
    receipt_path,
    verify_json_s,
) = sys.argv[1:12]

vinfo = json.loads(verify_json_s)
expected_sha = vinfo["sha256"]
now_epoch = int(now_override_s) if now_override_s else int(time.time())
local_keep_days = max(1, int(local_keep_days_s))
local_min_keep = max(1, int(local_min_keep_s))
drive_keep_cnt = max(1, int(drive_keep_cnt_s))
OWNED_RE = re.compile(r"^backup_\d{4}-\d{2}-\d{2}\.tar\.gz(?:\.enc)?$")

def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def atomic_copy_verified(src: str, dst_dir: str, dst_name: str, exp_sha: str) -> str:
    tmp_p = os.path.join(dst_dir, f".{dst_name}.tmp.{os.getpid()}")
    shutil.copy2(src, tmp_p)
    os.chmod(tmp_p, 0o600)
    dst_p = os.path.join(dst_dir, dst_name)
    os.replace(tmp_p, dst_p)
    if sha256_file(dst_p) != exp_sha:
        raise RuntimeError(f"Readback SHA-256 mismatch at {dst_p}")
    return dst_p

def list_owned_backups(directory: str) -> list[str]:
    out = []
    if not os.path.isdir(directory):
        return out
    for name in sorted(os.listdir(directory)):
        if not OWNED_RE.match(name):
            continue
        full = os.path.join(directory, name)
        if os.path.islink(full) or not os.path.isfile(full):
            continue
        out.append(full)
    return out

# 1. Atomic publish to Local
archive_name = f"backup_{date_tag}.{ext}"
local_final = atomic_copy_verified(staged_file, local_dir, archive_name, expected_sha)

# 2. Local retention: ONLY after verified publish, ALWAYS preserve >= local_min_keep (>=1 LKG)
owned_local = list_owned_backups(local_dir)
local_pruned = 0
if len(owned_local) > local_min_keep:
    candidates_to_check = owned_local[:-local_min_keep]
    cutoff = now_epoch - (local_keep_days * 86400)
    for old_p in candidates_to_check:
        if os.path.getmtime(old_p) < cutoff:
            os.remove(old_p)
            local_pruned += 1

# 3. Drive mirror (ONLY if parent mount exists; NEVER create unmounted parent tree)
drive_mirrored = False
drive_final = None
drive_error = None
drive_pruned = 0
drive_parent = os.path.dirname(os.path.abspath(drive_dir))

if os.path.isdir(drive_parent) and not os.path.islink(drive_dir):
    try:
        os.makedirs(drive_dir, exist_ok=True)
        drive_final = atomic_copy_verified(local_final, drive_dir, archive_name, expected_sha)
        drive_mirrored = True
        owned_drive = list_owned_backups(drive_dir)
        if len(owned_drive) > drive_keep_cnt:
            for old_dp in owned_drive[:-drive_keep_cnt]:
                os.remove(old_dp)
                drive_pruned += 1
    except Exception as exc:
        drive_error = str(exc)
else:
    drive_error = f"Drive parent mount unavailable: {drive_parent}"

# 4. Write atomic receipt JSON (0600)
rcpt = {
    "schema": "ptdtt.backup-pull-receipt.v1",
    "status": "PASS" if drive_mirrored else "DEGRADED_DRIVE_UNAVAILABLE",
    "timestamp": datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat(),
    "archive_name": archive_name,
    "archive_bytes": vinfo["bytes"],
    "archive_sha256": expected_sha,
    "remote_age_seconds": vinfo["age_seconds"],
    "tar_members": vinfo["tar_members"],
    "sandbox_restore_verified": True,
    "db_top_keys_count": vinfo["db_top_keys_count"],
    "local_verified": True,
    "local_path": local_final,
    "local_pruned_count": local_pruned,
    "drive_mirrored": drive_mirrored,
    "drive_path": drive_final,
    "drive_pruned_count": drive_pruned,
    "drive_error": drive_error,
}

rcpt_file = pathlib.Path(os.path.expanduser(receipt_path))
rcpt_file.parent.mkdir(parents=True, exist_ok=True)
tmp_rcpt = rcpt_file.parent / f".{rcpt_file.name}.tmp.{os.getpid()}"
tmp_rcpt.write_text(json.dumps(rcpt, ensure_ascii=False, indent=2), encoding="utf-8")
os.chmod(tmp_rcpt, 0o600)
os.replace(tmp_rcpt, rcpt_file)

if not drive_mirrored:
    sys.stderr.write(f"WARN_DEGRADED: Local backup verified ({local_final}), but Drive mirror failed: {drive_error}\n")
    sys.exit(2)

print(f"OK: Local={local_final} | Drive={drive_final} | SHA256={expected_sha[:16]}...")
PYEOF
if [ "$rc" -eq 2 ]; then
    log "⚠️ Saved verified local backup ($DATE_TAG), but Drive mirror failed — exiting 2"
    exit 2
elif [ "$rc" -ne 0 ]; then
    log "❌ Atomic publish or receipt write failed (rc=$rc)"
    exit "$rc"
fi

log "✅ Backup verified (SHA-256 + sandbox db.json restore) and mirrored to Local & Google Drive ($DATE_TAG)"
