#!/bin/bash
# ================================================================
# PTDTT — Pull backup from VPS to Google Drive (runs on Mac)
# Scheduled via launchd daily at 23:00 (after VPS backup at 22:30)
# ================================================================

VPS_HOST="root@180.93.138.83"
VPS_PASS="zE_d?1Qa4gCV8V*-"
DRIVE_DIR="$HOME/Library/CloudStorage/GoogleDrive-vukhuongan@gmail.com/Drive của tôi/01. CÔNG VIỆC BỆNH VIỆN/ptdtt-manager/backups"
LOG="$DRIVE_DIR/pull.log"
DATE=$(date '+%Y-%m-%d')

mkdir -p "$DRIVE_DIR"

echo "[$(date '+%H:%M:%S')] Pulling backup from VPS..." >> "$LOG"

# Pull latest backup via expect+scp
expect -c "
spawn scp -o StrictHostKeyChecking=no $VPS_HOST:/var/backups/ptdtt/ptdtt_full_*.tar.gz /tmp/ptdtt_latest.tar.gz
expect \"password:\"
send \"$VPS_PASS\r\"
expect eof
" 2>/dev/null

# Get the most recent file from VPS
expect -c "
spawn scp -o StrictHostKeyChecking=no $VPS_HOST:/var/www/ptdtt-manager/data/backups/latest_backup.tar.gz /tmp/ptdtt_latest.tar.gz
expect \"password:\"
send \"$VPS_PASS\r\"
expect eof
" 2>/dev/null

if [ -f /tmp/ptdtt_latest.tar.gz ]; then
    cp /tmp/ptdtt_latest.tar.gz "$DRIVE_DIR/backup_${DATE}.tar.gz"
    rm -f /tmp/ptdtt_latest.tar.gz
    # Keep 30 days on Drive
    find "$DRIVE_DIR" -name "backup_*.tar.gz" -mtime +30 -delete 2>/dev/null
    SIZE=$(du -h "$DRIVE_DIR/backup_${DATE}.tar.gz" | cut -f1)
    echo "[$(date '+%H:%M:%S')] ✅ Saved: backup_${DATE}.tar.gz ($SIZE)" >> "$LOG"
else
    echo "[$(date '+%H:%M:%S')] ❌ Failed to pull backup" >> "$LOG"
fi
