#!/bin/bash
# ================================================================
# PTDTT Manager — Daily Backup Script
# Runs daily at 22:30 via cron
# Backup to: 1) Local  2) GitHub (backup branch)  3) Google Drive
# ================================================================
set -euo pipefail

# ── Config ──
APP_DIR="/var/www/ptdtt-manager"
BACKUP_DIR="/var/backups/ptdtt"
LOG="/var/log/ptdtt/backup.log"
DATE=$(date '+%Y%m%d_%H%M')
DAY_TAG=$(date '+%Y-%m-%d')

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"; }

mkdir -p "$BACKUP_DIR"

log "═══════════════════════════════════════"
log "💾 BẮT ĐẦU BACKUP HÀNG NGÀY"
log "═══════════════════════════════════════"

# ════════════════════════════════════
# 1. LOCAL BACKUP (Atomic Snapshot under Shared Lock)
# ════════════════════════════════════
log "1/3 📁 Local backup..."

BACKUP_FILE="$BACKUP_DIR/ptdtt_full_${DATE}.tar.gz"
STAGING_DIR="$(mktemp -d /tmp/ptdtt_backup_stage.XXXXXX)"
cleanup_staging() { rm -rf "$STAGING_DIR" 2>/dev/null || true; }
trap cleanup_staging EXIT

mkdir -p "$STAGING_DIR/data"
LOCK_FILE="$APP_DIR/data/.db.lock"
touch "$LOCK_FILE" 2>/dev/null || true

# Acquire shared lock (flock -s) when available so db.json and surgery_approval_logs.jsonl
# are snapshotted at an exact transactionally consistent boundary (CORE-TC-12).
copy_runtime_data() {
    shopt -s nullglob
    for path in "$APP_DIR"/data/*; do
        base="${path##*/}"
        [ "$base" = "backups" ] && continue
        [ "$base" = "snapshots" ] && continue
        cp -R "$path" "$STAGING_DIR/data/" 2>/dev/null || true
    done
    shopt -u nullglob
}

if command -v flock >/dev/null 2>&1; then
    (
        flock -s -w 15 9 || log "  ⚠️ Không lấy được shared lock sau 15s, tiếp tục snapshot best-effort"
        copy_runtime_data
    ) 9>"$LOCK_FILE"
else
    python3 -c '
import fcntl, os, shutil, sys
app_dir, stage_dir, lock_path = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(os.path.dirname(lock_path), exist_ok=True)
with open(lock_path, "a+") as lf:
    fcntl.flock(lf, fcntl.LOCK_SH)
    try:
        for name in os.listdir(os.path.join(app_dir, "data")):
            if name in ("backups", "snapshots") or name.startswith("."):
                continue
            src = os.path.join(app_dir, "data", name)
            dst = os.path.join(stage_dir, "data", name)
            if os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                shutil.copy2(src, dst)
    finally:
        fcntl.flock(lf, fcntl.LOCK_UN)
' "$APP_DIR" "$STAGING_DIR" "$LOCK_FILE"
fi

shopt -s nullglob
STAGED_ITEMS=("$STAGING_DIR"/data/*)
shopt -u nullglob
if [ "${#STAGED_ITEMS[@]}" -eq 0 ]; then
    log "  ❌ Không tìm thấy dữ liệu để backup trong $APP_DIR/data"
    exit 1
fi

if tar -czf "$BACKUP_FILE" -C "$STAGING_DIR" data 2>/dev/null; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" 2>/dev/null | cut -f1)
    log "  ✅ Local: $BACKUP_FILE ($BACKUP_SIZE)"
else
    log "  ❌ Tạo archive thất bại"
    exit 1
fi

# Keep only 30 days of local backups
find "$BACKUP_DIR" -name "ptdtt_full_*.tar.gz" -mtime +30 -delete 2>/dev/null
REMAINING=$(ls -1 "$BACKUP_DIR"/ptdtt_full_*.tar.gz 2>/dev/null | wc -l)
log "  📊 Tổng backup local: $REMAINING files"

# ════════════════════════════════════
# 2. GITHUB BACKUP (backup branch)
# ════════════════════════════════════
log "2/3 🐙 GitHub backup..."

cd "$APP_DIR"

# Ensure backup branch exists
if ! git show-ref --verify --quiet refs/heads/backup 2>/dev/null; then
    git branch backup 2>/dev/null || true
fi

# Stash current state, switch to backup branch, commit data, switch back
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")

# Use worktree to avoid disrupting the running service
BACKUP_WORKTREE="/tmp/ptdtt-backup-worktree"
rm -rf "$BACKUP_WORKTREE"

git worktree add "$BACKUP_WORKTREE" backup 2>/dev/null || {
    # If worktree fails, create backup branch from main
    git branch -D backup 2>/dev/null || true
    git branch backup
    git worktree add "$BACKUP_WORKTREE" backup
}

# Copy consistent staged runtime data to backup worktree
mkdir -p "$BACKUP_WORKTREE/data"
shopt -s nullglob
for path in "$STAGING_DIR"/data/*; do
    cp -R "$path" "$BACKUP_WORKTREE/data/" 2>/dev/null || true
done
shopt -u nullglob
mkdir -p "$BACKUP_WORKTREE/logs-snapshot"
# Only copy latest audit log (not all)
cp "$APP_DIR/logs/audit_${DAY_TAG}.jsonl" "$BACKUP_WORKTREE/logs-snapshot/" 2>/dev/null || true

cd "$BACKUP_WORKTREE"
git add -A 2>/dev/null
if git diff --cached --quiet 2>/dev/null; then
    log "  ℹ️ Không có thay đổi — skip commit"
else
    git commit -m "backup: ${DAY_TAG} daily backup" --author="PTDTT Backup <backup@khoaptdtt.info.vn>" 2>/dev/null
    git push origin backup --force 2>/dev/null && \
        log "  ✅ GitHub: pushed to 'backup' branch" || \
        log "  ❌ GitHub push failed"
fi

# Cleanup worktree
cd "$APP_DIR"
git worktree remove "$BACKUP_WORKTREE" --force 2>/dev/null || rm -rf "$BACKUP_WORKTREE"

# ════════════════════════════════════
# 3. STAGE VERIFIED PULL ARTIFACT OUTSIDE WEB ROOT (for authenticated Mac SSH pull)
# ════════════════════════════════════
log "3/3 🔐 Chuẩn bị artifact kéo qua SSH xác thực (ngoài web root)..."

PULL_STAGE_DIR="$BACKUP_DIR/pull_ready"
mkdir -p "$PULL_STAGE_DIR"
chmod 0700 "$PULL_STAGE_DIR"

BACKUP_ENCRYPTION_KEY_FILE="${BACKUP_ENCRYPTION_KEY_FILE:-/etc/ptdtt/backup.key}"
if [ -s "$BACKUP_ENCRYPTION_KEY_FILE" ] && command -v openssl >/dev/null 2>&1; then
    ARTIFACT_EXT="tar.gz.enc"
    STAGE_TMP="$PULL_STAGE_DIR/.latest_backup.${ARTIFACT_EXT}.tmp.$$"
    openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$BACKUP_ENCRYPTION_KEY_FILE" \
        -in "$BACKUP_FILE" -out "$STAGE_TMP"
else
    ARTIFACT_EXT="tar.gz"
    STAGE_TMP="$PULL_STAGE_DIR/.latest_backup.${ARTIFACT_EXT}.tmp.$$"
    cp -p "$BACKUP_FILE" "$STAGE_TMP"
fi
chmod 0600 "$STAGE_TMP"
FINAL_PULL_FILE="$PULL_STAGE_DIR/latest_backup.${ARTIFACT_EXT}"
mv -f "$STAGE_TMP" "$FINAL_PULL_FILE"
sha256sum "$FINAL_PULL_FILE" | awk '{print $1}' > "${FINAL_PULL_FILE}.sha256"
chmod 0600 "${FINAL_PULL_FILE}.sha256"
log "  ✅ Sẵn sàng tại $FINAL_PULL_FILE (kèm .sha256, quyền 0600)"

# ════════════════════════════════════
# Summary
# ════════════════════════════════════
DB_SIZE=$(du -h "$APP_DIR/data/db.json" 2>/dev/null | cut -f1)
log "═══════════════════════════════════════"
log "✅ BACKUP HOÀN TẤT"
log "   DB size: $DB_SIZE | Archive: $BACKUP_SIZE"
log "   Local: $BACKUP_DIR | GitHub: backup branch"
log "═══════════════════════════════════════"
