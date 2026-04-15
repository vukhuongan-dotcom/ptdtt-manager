#!/bin/bash
# ================================================================
# PTDTT Manager — Weekly Maintenance Script
# Runs every Saturday at 23:30 via cron
# ================================================================
set -euo pipefail

LOG="/var/log/ptdtt/maintenance.log"
NOW=$(date '+%Y-%m-%d %H:%M:%S')

log() { echo "[$NOW] $1" | tee -a "$LOG"; }

log "═══════════════════════════════════════"
log "🔧 BẮT ĐẦU BẢO TRÌ ĐỊNH KỲ"
log "═══════════════════════════════════════"

# 1. Restart service
log "1/6 Khởi động lại Gunicorn..."
systemctl restart ptdtt
sleep 3
if systemctl is-active --quiet ptdtt; then
    log "  ✅ ptdtt service: active"
else
    log "  ❌ ptdtt service: FAILED"
fi

# 2. Clean old audit logs (>90 days)
log "2/6 Dọn audit logs cũ (>90 ngày)..."
CLEANED=$(find /var/www/ptdtt-manager/logs -name "audit_*.jsonl" -mtime +90 -delete -print 2>/dev/null | wc -l)
log "  ✅ Đã xoá $CLEANED file audit log cũ"

# 3. Clean old backups (>30 days)
log "3/6 Dọn backup cũ (>30 ngày)..."
CLEANED_BK=$(find /var/backups/ptdtt -mtime +30 -delete -print 2>/dev/null | wc -l)
log "  ✅ Đã xoá $CLEANED_BK file backup cũ"

# 4. Rotate logs immediately
log "4/6 Xoay log Nginx + PTDTT..."
logrotate -f /etc/logrotate.d/ptdtt 2>/dev/null || true
log "  ✅ Logrotate done"

# 5. Check disk, RAM, swap
log "5/6 Kiểm tra tài nguyên hệ thống..."
DISK_USAGE=$(df -h / | awk 'NR==2{print $5}')
RAM_USAGE=$(free -h | awk 'NR==2{printf "%s/%s", $3, $2}')
SWAP_USAGE=$(free -h | awk 'NR==3{printf "%s/%s", $3, $2}')
log "  📀 Disk: $DISK_USAGE | 🧠 RAM: $RAM_USAGE | 💾 Swap: $SWAP_USAGE"

# 6. Check SSL expiry
log "6/6 Kiểm tra SSL certificate..."
SSL_EXPIRY=$(echo | openssl s_client -connect khoaptdtt.info.vn:443 -servername khoaptdtt.info.vn 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$SSL_EXPIRY" ]; then
    DAYS_LEFT=$(( ($(date -d "$SSL_EXPIRY" +%s) - $(date +%s)) / 86400 ))
    if [ "$DAYS_LEFT" -lt 14 ]; then
        log "  ⚠️ SSL hết hạn trong $DAYS_LEFT ngày! Đang gia hạn..."
        certbot renew --quiet 2>/dev/null || log "  ❌ Certbot renew failed"
    else
        log "  ✅ SSL còn $DAYS_LEFT ngày"
    fi
else
    log "  ⚠️ Không đọc được SSL cert"
fi

# Summary
log "═══════════════════════════════════════"
log "✅ BẢO TRÌ HOÀN TẤT"
log "═══════════════════════════════════════"
