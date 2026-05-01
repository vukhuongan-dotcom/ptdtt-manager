#!/bin/bash
# ================================================================
# PTDTT — Pull backup from VPS to Google Drive (runs on Mac)
# Scheduled via launchd daily at 23:00 (after VPS backup at 22:30)
# ================================================================
set -euo pipefail

CONFIG_FILE="${PTDTT_OPS_ENV:-$HOME/.config/ptdtt-manager/ops.env}"
[ -f "$CONFIG_FILE" ] || { echo "Missing config: $CONFIG_FILE" >&2; exit 1; }
. "$CONFIG_FILE"

BACKUP_URL="${PTDTT_BACKUP_URL:-https://khoaptdtt.info.vn/data/backups/latest_backup.tar.gz}"
LOCAL_BACKUP_DIR="${PTDTT_LOCAL_BACKUP_DIR:-$HOME/Projects/ptdtt-backups}"
DRIVE_BACKUP_DIR="${PTDTT_DRIVE_BACKUP_DIR:-$HOME/Library/CloudStorage/GoogleDrive-vukhuongan@gmail.com/Drive của tôi/01. CÔNG VIỆC BỆNH VIỆN/ptdtt-manager/backups}"
DRIVE_KEEP_COUNT="${PTDTT_DRIVE_BACKUP_KEEP_COUNT:-7}"
DATE_TAG=$(date '+%Y-%m-%d')
LOCAL_FILE="$LOCAL_BACKUP_DIR/backup_${DATE_TAG}.tar.gz"
TMP_FILE="$(mktemp -t ptdtt_latest)"
LOG="$LOCAL_BACKUP_DIR/pull.log"

mkdir -p "$LOCAL_BACKUP_DIR"
trap 'rm -f "$TMP_FILE"' EXIT

log() {
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" | tee -a "$LOG"
}

prune_drive_backups() {
    local dir="$1"
    local keep_count="$2"
    local files=()
    local file
    local i

    [ -d "$dir" ] || return 0
    [ "$keep_count" -gt 0 ] 2>/dev/null || return 0

    while IFS= read -r file; do
        files+=("$file")
    done < <(find "$dir" -maxdepth 1 -type f -name 'backup_*.tar.gz' | sort)

    if [ "${#files[@]}" -le "$keep_count" ]; then
        return 0
    fi

    for ((i = 0; i < ${#files[@]} - keep_count; i++)); do
        rm -f -- "${files[$i]}"
    done
}

command -v curl >/dev/null 2>&1 || {
    log "❌ Missing dependency: curl"
    exit 1
}

log "Pulling latest backup over HTTPS..."

if ! curl -fsSL --retry 3 --connect-timeout 20 --max-time 300 -o "$TMP_FILE" "$BACKUP_URL" >> "$LOG" 2>&1; then
    log "❌ Failed to download backup from $BACKUP_URL"
    exit 1
fi

if [ ! -f "$TMP_FILE" ] || [ ! -s "$TMP_FILE" ]; then
    log "❌ Failed to pull backup"
    exit 1
fi

cp "$TMP_FILE" "$LOCAL_FILE"
find "$LOCAL_BACKUP_DIR" -name "backup_*.tar.gz" -mtime +30 -delete 2>/dev/null || true
LOCAL_SIZE=$(du -h "$LOCAL_FILE" | cut -f1)
log "✅ Saved local backup: $(basename "$LOCAL_FILE") ($LOCAL_SIZE)"

if mkdir -p "$DRIVE_BACKUP_DIR" 2>/dev/null && cp "$TMP_FILE" "$DRIVE_BACKUP_DIR/backup_${DATE_TAG}.tar.gz" 2>/dev/null; then
    prune_drive_backups "$DRIVE_BACKUP_DIR" "$DRIVE_KEEP_COUNT"
    DRIVE_SIZE=$(du -h "$DRIVE_BACKUP_DIR/backup_${DATE_TAG}.tar.gz" | cut -f1)
    log "✅ Mirrored to Drive: backup_${DATE_TAG}.tar.gz ($DRIVE_SIZE, keep latest $DRIVE_KEEP_COUNT)"
else
    log "⚠️ Drive mirror unavailable from this launchd context; local staging copy kept at $LOCAL_FILE"
fi
