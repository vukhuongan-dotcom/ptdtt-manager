#!/bin/bash
# ================================================================
# PTDTT — Sync pushed git HEAD to the Google Drive mirror
# Avoids split-brain by exporting committed HEAD only.
# Usage:
#   bash scripts/sync-drive-mirror.sh push
#   bash scripts/sync-drive-mirror.sh dry
#   bash scripts/sync-drive-mirror.sh status
# ================================================================
set -euo pipefail

MODE="${1:-push}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRIVE_REPO="${PTDTT_DRIVE_REPO:-$HOME/Library/CloudStorage/GoogleDrive-vukhuongan@gmail.com/Drive của tôi/01. CÔNG VIỆC BỆNH VIỆN/ptdtt-manager}"
LOG_DIR="${PTDTT_LOCAL_LOG_DIR:-$HOME/Library/Logs/ptdtt-manager}"
LOG_FILE="$LOG_DIR/drive-mirror.log"
RSYNC_OPTS=(-a --delete --exclude='.git' --exclude='backups/' --exclude='.DS_Store' --exclude='node_modules' --exclude='__pycache__')

mkdir -p "$LOG_DIR"

log() {
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" | tee -a "$LOG_FILE"
}

require_drive_access() {
    if [ ! -d "$DRIVE_REPO" ]; then
        log "❌ Drive mirror path not found: $DRIVE_REPO"
        exit 1
    fi

    if ! ls "$DRIVE_REPO" >/dev/null 2>&1; then
        log "❌ Drive mirror path is not readable from this session: $DRIVE_REPO"
        exit 1
    fi
}

if ! command -v rsync >/dev/null 2>&1; then
    log "❌ Missing dependency: rsync"
    exit 1
fi

case "$MODE" in
    status)
        require_drive_access
        log "Local HEAD: $(git -C "$REPO_ROOT" rev-parse --short HEAD)"
        if git -C "$DRIVE_REPO" rev-parse --short HEAD >/dev/null 2>&1; then
            log "Drive HEAD: $(git -C "$DRIVE_REPO" rev-parse --short HEAD)"
        else
            log "Drive mirror is not a git repo; syncing as plain filesystem mirror."
        fi
        exit 0
        ;;
    push|dry)
        ;;
    *)
        log "❌ Unknown mode: $MODE"
        exit 1
        ;;
esac

require_drive_access

if ! git -C "$REPO_ROOT" diff --quiet --ignore-submodules HEAD -- || [ -n "$(git -C "$REPO_ROOT" ls-files --others --exclude-standard)" ]; then
    log "ℹ️ Local repo has uncommitted changes; Drive mirror will sync committed HEAD only."
fi

TMP_DIR="$(mktemp -d /tmp/ptdtt-drive-export.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

git -C "$REPO_ROOT" archive --format=tar HEAD | tar -xf - -C "$TMP_DIR"

if [ "$MODE" = "dry" ]; then
    log "DRY RUN: syncing pushed HEAD snapshot to Drive mirror"
    rsync "${RSYNC_OPTS[@]}" --dry-run "$TMP_DIR/" "$DRIVE_REPO/"
else
    log "SYNC: exporting pushed HEAD snapshot to Drive mirror"
    rsync "${RSYNC_OPTS[@]}" "$TMP_DIR/" "$DRIVE_REPO/"
    log "✅ Drive mirror updated at $DRIVE_REPO"
fi
