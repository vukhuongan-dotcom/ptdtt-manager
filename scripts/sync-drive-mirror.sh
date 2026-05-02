#!/bin/bash
# ================================================================
# PTDTT — Sync committed git HEAD to the Google Drive mirror
# Uses commit-based incremental sync to avoid re-copying the repo.
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
SYNC_STATE_DIR="$DRIVE_REPO/.ptdtt-sync"
SYNC_STATE_FILE="$SYNC_STATE_DIR/last_synced_head"
FALLBACK_BASE_COMMIT="${PTDTT_DRIVE_BASE_COMMIT:-}"
CURRENT_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD)"

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

commit_exists() {
    git -C "$REPO_ROOT" rev-parse --verify --quiet "$1^{commit}" >/dev/null
}

short_commit() {
    git -C "$REPO_ROOT" rev-parse --short "$1"
}

should_skip_path() {
    case "$1" in
        .git|.git/*|backups|backups/*|.DS_Store|node_modules|node_modules/*|__pycache__|__pycache__/*)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

purge_stale_git_metadata() {
    local git_dir="$DRIVE_REPO/.git"

    if [ ! -e "$git_dir" ]; then
        return 0
    fi

    if [ "$MODE" = "dry" ]; then
        log "DRY RUN: would remove stale .git metadata from Drive mirror"
        return 0
    fi

    rm -rf "$git_dir"
    log "🧹 Removed stale .git metadata from Drive mirror"
}

infer_last_synced_head_from_log() {
    [ -f "$LOG_FILE" ] || return 1

    awk '
        /Local HEAD:/ { head=$NF }
        /✅ Drive mirror updated at/ && head { last=head }
        END {
            if (last != "") {
                print last
            }
        }
    ' "$LOG_FILE"
}

resolve_base_commit() {
    local candidate=""

    if [ -f "$SYNC_STATE_FILE" ]; then
        candidate="$(tr -d '[:space:]' < "$SYNC_STATE_FILE")"
        if [ -n "$candidate" ] && commit_exists "$candidate"; then
            printf '%s\n' "$candidate"
            return 0
        fi
    fi

    candidate="$(infer_last_synced_head_from_log || true)"
    if [ -n "$candidate" ] && commit_exists "$candidate"; then
        printf '%s\n' "$candidate"
        return 0
    fi

    if [ -n "$FALLBACK_BASE_COMMIT" ] && commit_exists "$FALLBACK_BASE_COMMIT"; then
        printf '%s\n' "$FALLBACK_BASE_COMMIT"
        return 0
    fi

    return 1
}

write_sync_state() {
    mkdir -p "$SYNC_STATE_DIR"
    printf '%s\n' "$CURRENT_HEAD" > "$SYNC_STATE_FILE"
}

prune_empty_parent_dirs() {
    local target="$1"
    local dir

    dir="$(dirname "$target")"
    while [ "$dir" != "$DRIVE_REPO" ] && [ "$dir" != "." ]; do
        if ! rmdir "$dir" 2>/dev/null; then
            break
        fi
        dir="$(dirname "$dir")"
    done
}

delete_path_from_drive() {
    local rel_path="$1"
    local target="$DRIVE_REPO/$rel_path"

    if should_skip_path "$rel_path"; then
        return 0
    fi

    if [ "$MODE" = "dry" ]; then
        log "DRY RUN: delete $rel_path"
        return 0
    fi

    rm -rf "$target"
    prune_empty_parent_dirs "$target"
}

sync_path_from_head() {
    local rel_path="$1"

    if should_skip_path "$rel_path"; then
        return 0
    fi

    if [ "$MODE" = "dry" ]; then
        log "DRY RUN: update $rel_path"
        return 0
    fi

    mkdir -p "$(dirname "$DRIVE_REPO/$rel_path")"
    git -C "$REPO_ROOT" archive --format=tar HEAD -- "$rel_path" | tar -xf - -C "$DRIVE_REPO"
}

full_snapshot_sync() {
    if [ "$MODE" = "dry" ]; then
        log "DRY RUN: no prior sync state found; would bootstrap full snapshot from $(short_commit "$CURRENT_HEAD")"
        return 0
    fi

    log "SYNC: no prior sync state found; bootstrapping full snapshot from $(short_commit "$CURRENT_HEAD")"
    git -C "$REPO_ROOT" archive --format=tar HEAD | tar -xf - -C "$DRIVE_REPO"
    write_sync_state
    log "✅ Drive mirror bootstrapped at $DRIVE_REPO"
}

incremental_sync() {
    local base_commit="$1"
    local changed_count=0
    local deleted_count=0
    local updated_count=0
    local status
    local path_a
    local path_b

    if [ "$base_commit" = "$CURRENT_HEAD" ]; then
        log "✅ Drive mirror already up to date at $(short_commit "$CURRENT_HEAD")"
        [ "$MODE" = "dry" ] || write_sync_state
        return 0
    fi

    log "SYNC: incremental mirror from $(short_commit "$base_commit") -> $(short_commit "$CURRENT_HEAD")"

    while IFS= read -r -d '' status; do
        case "$status" in
            R*|C*)
                IFS= read -r -d '' path_a || break
                IFS= read -r -d '' path_b || break
                delete_path_from_drive "$path_a"
                sync_path_from_head "$path_b"
                changed_count=$((changed_count + 1))
                deleted_count=$((deleted_count + 1))
                updated_count=$((updated_count + 1))
                ;;
            D)
                IFS= read -r -d '' path_a || break
                delete_path_from_drive "$path_a"
                changed_count=$((changed_count + 1))
                deleted_count=$((deleted_count + 1))
                ;;
            *)
                IFS= read -r -d '' path_a || break
                sync_path_from_head "$path_a"
                changed_count=$((changed_count + 1))
                updated_count=$((updated_count + 1))
                ;;
        esac
    done < <(git -C "$REPO_ROOT" diff --name-status -z --find-renames "$base_commit" "$CURRENT_HEAD")

    if [ "$MODE" = "dry" ]; then
        log "DRY RUN: $changed_count changed paths ($updated_count updates, $deleted_count deletions)"
        return 0
    fi

    write_sync_state
    log "✅ Drive mirror updated at $DRIVE_REPO ($changed_count changed paths; $updated_count updates, $deleted_count deletions)"
}

case "$MODE" in
    status)
        require_drive_access
        log "Local HEAD: $(short_commit "$CURRENT_HEAD")"
        if [ -f "$SYNC_STATE_FILE" ]; then
            log "Drive mirror synced HEAD: $(short_commit "$(tr -d '[:space:]' < "$SYNC_STATE_FILE")")"
        else
            log "Drive mirror synced HEAD: unknown (no sync state file yet)"
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

purge_stale_git_metadata

BASE_COMMIT="$(resolve_base_commit || true)"

if [ -z "$BASE_COMMIT" ]; then
    full_snapshot_sync
else
    incremental_sync "$BASE_COMMIT"
fi
