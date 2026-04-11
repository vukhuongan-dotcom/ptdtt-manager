#!/bin/bash
# PTDTT Daily Backup Script — v2 (with GitHub + SHCM files + Google Drive)

BACKUP_DIR="/var/www/ptdtt-manager/backups"
DATA_DIR="/var/www/ptdtt-manager/data"
APP_DIR="/var/www/ptdtt-manager"
DATE=$(date +%Y-%m-%d_%H%M)
LOG_PREFIX="[$(date)]"

mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/shcm-files"

# 1. Backup db.json
cp "$DATA_DIR/db.json" "$BACKUP_DIR/db_${DATE}.json"
echo "$LOG_PREFIX Backup: db_${DATE}.json ($(du -h "$BACKUP_DIR/db_${DATE}.json" | cut -f1))"

# 2. Backup auth.json
cp "$DATA_DIR/auth.json" "$BACKUP_DIR/auth_${DATE}.json"
echo "$LOG_PREFIX Backup: auth_${DATE}.json ($(du -h "$BACKUP_DIR/auth_${DATE}.json" | cut -f1))"



# 4. Push to GitHub backup branch
(
    cd "$APP_DIR"
    git stash --quiet 2>/dev/null || true
    CURRENT_BRANCH=$(git branch --show-current)

    if ! git show-ref --verify --quiet refs/heads/backup-data; then
        git checkout --orphan backup-data --quiet 2>/dev/null
        git rm -rf . --quiet 2>/dev/null || true
    else
        git checkout backup-data --quiet 2>/dev/null
    fi

    mkdir -p github-backup
    cp "$BACKUP_DIR/db_${DATE}.json" github-backup/db_latest.json
    cp "$BACKUP_DIR/auth_${DATE}.json" github-backup/auth_latest.json


    git add github-backup/ 2>/dev/null
    git commit -m "backup: $DATE" --quiet 2>/dev/null || true
    git push origin backup-data --force --quiet 2>/dev/null || true
    echo "$LOG_PREFIX GitHub backup-data branch pushed"

    git checkout "$CURRENT_BRANCH" --quiet 2>/dev/null
    git stash pop --quiet 2>/dev/null || true
) || echo "$LOG_PREFIX WARNING: GitHub backup failed"

# 5. Sync to Google Drive via rclone (if configured)
if command -v rclone &>/dev/null && rclone listremotes 2>/dev/null | grep -q "gdrive:"; then
    GDRIVE_BACKUP="gdrive:KHOA PTDTT/99. BACKUP/ptdtt-manager"
    rclone mkdir "$GDRIVE_BACKUP" 2>/dev/null || true
    rclone copy "$BACKUP_DIR/db_${DATE}.json" "$GDRIVE_BACKUP/" 2>/dev/null || true
    rclone copy "$BACKUP_DIR/auth_${DATE}.json" "$GDRIVE_BACKUP/" 2>/dev/null || true
    # Sync SHCM PDFs to Google Drive only
    if [ -d "$DATA_DIR/shcm-files" ] && [ "$(ls -A $DATA_DIR/shcm-files 2>/dev/null)" ]; then
        GDRIVE_SHCM="gdrive:KHOA PTDTT/03. ĐÀO TẠO - NGHIÊN CỨU/Sinh hoạt chuyên môn/BÀI ĐÃ TRÌNH"
        rclone copy "$DATA_DIR/shcm-files/" "$GDRIVE_SHCM/" 2>/dev/null || true
        PDF_COUNT=$(ls "$DATA_DIR/shcm-files/"*.pdf 2>/dev/null | wc -l)
        echo "$LOG_PREFIX Google Drive: $PDF_COUNT PDF files synced"
    fi
    echo "$LOG_PREFIX Google Drive backup synced"
else
    echo "$LOG_PREFIX SKIP: rclone/gdrive not configured"
fi

# 6. Cleanup: keep only last 30 backups per type
ls -t "$BACKUP_DIR"/db_*.json 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null
ls -t "$BACKUP_DIR"/auth_*.json 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null

echo "$LOG_PREFIX Backup complete"
