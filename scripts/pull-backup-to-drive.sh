#!/bin/bash
# ================================================================
# PTDTT — Pull backup from VPS to Google Drive (runs on Mac)
# Scheduled via launchd daily at 23:00 (after VPS backup at 22:30)
# ================================================================
set -euo pipefail

CONFIG_FILE="${PTDTT_OPS_ENV:-$HOME/.config/ptdtt-manager/ops.env}"
[ -f "$CONFIG_FILE" ] || { echo "Missing config: $CONFIG_FILE" >&2; exit 1; }
. "$CONFIG_FILE"

: "${PTDTT_VPS_HOST:?Missing PTDTT_VPS_HOST in $CONFIG_FILE}"
: "${PTDTT_VPS_PASS:?Missing PTDTT_VPS_PASS in $CONFIG_FILE}"

LOCAL_BACKUP_DIR="${PTDTT_LOCAL_BACKUP_DIR:-$HOME/Projects/ptdtt-backups}"
DRIVE_BACKUP_DIR="${PTDTT_DRIVE_BACKUP_DIR:-$HOME/Library/CloudStorage/GoogleDrive-vukhuongan@gmail.com/Drive của tôi/01. CÔNG VIỆC BỆNH VIỆN/ptdtt-manager/backups}"
DATE_TAG=$(date '+%Y-%m-%d')
LOCAL_FILE="$LOCAL_BACKUP_DIR/backup_${DATE_TAG}.tar.gz"
TMP_FILE="$(mktemp /tmp/ptdtt_latest.XXXXXX.tar.gz)"
LOG="$LOCAL_BACKUP_DIR/pull.log"

mkdir -p "$LOCAL_BACKUP_DIR"
trap 'rm -f "$TMP_FILE"' EXIT

log() {
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" | tee -a "$LOG"
}

command -v expect >/dev/null 2>&1 || {
    log "❌ Missing dependency: expect"
    exit 1
}

log "Pulling latest backup from VPS..."

expect -c "
log_user 0
spawn scp -o StrictHostKeyChecking=no $PTDTT_VPS_HOST:/var/www/ptdtt-manager/data/backups/latest_backup.tar.gz $TMP_FILE
expect \"password:\"
send \"$PTDTT_VPS_PASS\r\"
expect eof
" >> "$LOG" 2>&1

if [ ! -f "$TMP_FILE" ] || [ ! -s "$TMP_FILE" ]; then
    log "❌ Failed to pull backup"
    exit 1
fi

cp "$TMP_FILE" "$LOCAL_FILE"
find "$LOCAL_BACKUP_DIR" -name "backup_*.tar.gz" -mtime +30 -delete 2>/dev/null || true
LOCAL_SIZE=$(du -h "$LOCAL_FILE" | cut -f1)
log "✅ Saved local backup: $(basename "$LOCAL_FILE") ($LOCAL_SIZE)"

if mkdir -p "$DRIVE_BACKUP_DIR" 2>/dev/null && cp "$TMP_FILE" "$DRIVE_BACKUP_DIR/backup_${DATE_TAG}.tar.gz" 2>/dev/null; then
    find "$DRIVE_BACKUP_DIR" -name "backup_*.tar.gz" -mtime +30 -delete 2>/dev/null || true
    DRIVE_SIZE=$(du -h "$DRIVE_BACKUP_DIR/backup_${DATE_TAG}.tar.gz" | cut -f1)
    log "✅ Mirrored to Drive: backup_${DATE_TAG}.tar.gz ($DRIVE_SIZE)"
else
    log "⚠️ Drive mirror unavailable from this launchd context; local staging copy kept at $LOCAL_FILE"
fi
