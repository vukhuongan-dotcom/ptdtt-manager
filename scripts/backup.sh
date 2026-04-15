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
NOW=$(date '+%Y-%m-%d %H:%M:%S')

log() { echo "[$NOW] $1" | tee -a "$LOG"; }

mkdir -p "$BACKUP_DIR"

log "═══════════════════════════════════════"
log "💾 BẮT ĐẦU BACKUP HÀNG NGÀY"
log "═══════════════════════════════════════"

# ════════════════════════════════════
# 1. LOCAL BACKUP
# ════════════════════════════════════
log "1/3 📁 Local backup..."

# Backup data directory (db.json, auth.json, shcm-files)
BACKUP_FILE="$BACKUP_DIR/ptdtt_full_${DATE}.tar.gz"
tar -czf "$BACKUP_FILE" \
    -C "$APP_DIR" \
    data/ \
    logs/ \
    2>/dev/null || true

BACKUP_SIZE=$(du -h "$BACKUP_FILE" 2>/dev/null | cut -f1)
log "  ✅ Local: $BACKUP_FILE ($BACKUP_SIZE)"

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

# Copy data files to backup worktree
cp -r "$APP_DIR/data/" "$BACKUP_WORKTREE/data/" 2>/dev/null || true
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
# 3. GOOGLE DRIVE BACKUP (via SCP to Mac)
# ════════════════════════════════════
log "3/3 ☁️ Google Drive backup..."

# Method: Push backup to a known path that Google Drive syncs
# This requires the Mac to have an SSH key authorized on the VPS (or vice versa)
# Alternative: place backup file in web-accessible temp path for Mac to pull
DRIVE_BACKUP_DIR="$APP_DIR/data/backups"
mkdir -p "$DRIVE_BACKUP_DIR"

# Copy today's backup to a web-servable location (will be pulled by Mac cron)
cp "$BACKUP_FILE" "$DRIVE_BACKUP_DIR/latest_backup.tar.gz" 2>/dev/null
# Also keep dated copy (max 7 in this dir to save disk)
cp "$BACKUP_FILE" "$DRIVE_BACKUP_DIR/backup_${DAY_TAG}.tar.gz" 2>/dev/null
find "$DRIVE_BACKUP_DIR" -name "backup_*.tar.gz" -mtime +7 -delete 2>/dev/null

log "  ✅ Backup sẵn sàng cho Google Drive pull"

# ════════════════════════════════════
# Summary
# ════════════════════════════════════
DB_SIZE=$(du -h "$APP_DIR/data/db.json" 2>/dev/null | cut -f1)
log "═══════════════════════════════════════"
log "✅ BACKUP HOÀN TẤT"
log "   DB size: $DB_SIZE | Archive: $BACKUP_SIZE"
log "   Local: $BACKUP_DIR | GitHub: backup branch"
log "═══════════════════════════════════════"
