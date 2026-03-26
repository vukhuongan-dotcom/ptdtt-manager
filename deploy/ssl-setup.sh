#!/bin/bash
# SSL setup using Let's Encrypt / Certbot
# Run after DNS has been pointed to this server

DOMAIN="khoaptdtt.info.vn"
EMAIL="vukhuongan@gmail.com"

echo "🔐 Cài đặt SSL cho $DOMAIN"

# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
    --non-interactive --agree-tos --email "$EMAIL" \
    --redirect

# Auto-renew (certbot auto-adds cron, but verify)
systemctl enable certbot.timer
systemctl start certbot.timer

echo "✅ SSL đã cài xong!"
echo "🔄 Tự động gia hạn: systemctl status certbot.timer"
