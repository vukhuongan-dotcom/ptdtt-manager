#!/bin/bash
# ══════════════════════════════════════════════════════════════════
# PTDTT Manager — VPS One-Time Setup Script
# Run on the VPS: bash /var/www/ptdtt-manager/deploy/setup.sh
# ══════════════════════════════════════════════════════════════════

set -e
APP_DIR="/var/www/ptdtt-manager"
DOMAIN="khoaptdtt.info.vn"

echo ""
echo "  🏥 PTDTT Manager — VPS Setup"
echo "  ═══════════════════════════════"
echo ""

# ─── 1. System packages ───
echo "📦 [1/7] Cài đặt packages..."
apt update -y
apt install -y nginx python3 python3-venv python3-pip git ufw

# ─── 2. Firewall ───
echo "🔥 [2/7] Cấu hình Firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
echo "   ✅ Firewall: SSH + Nginx enabled"

# ─── 3. App directory ───
echo "📁 [3/7] Thiết lập thư mục app..."
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/data"
mkdir -p /var/log/ptdtt

# If repo not cloned yet, user must do it manually
if [ ! -f "$APP_DIR/server_flask.py" ]; then
    echo ""
    echo "   ⚠️  Chưa có code. Hãy clone repo trước:"
    echo "   git clone https://github.com/<username>/ptdtt-manager.git $APP_DIR"
    echo "   Rồi chạy lại script này."
    echo ""
    exit 1
fi

# ─── 4. Python venv ───
echo "🐍 [4/7] Tạo Python virtual environment..."
python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --upgrade pip
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt"
echo "   ✅ Installed: flask, gunicorn"

# ─── 5. Permissions ───
echo "🔐 [5/7] Cấu hình quyền..."
chown -R www-data:www-data "$APP_DIR"
chown -R www-data:www-data /var/log/ptdtt
chmod +x "$APP_DIR/deploy/auto-deploy.sh"
chmod +x "$APP_DIR/deploy/ssl-setup.sh"

# ─── 6. Systemd service ───
echo "⚙️  [6/7] Cài systemd service..."
cp "$APP_DIR/deploy/ptdtt.service" /etc/systemd/system/ptdtt.service
systemctl daemon-reload
systemctl enable ptdtt
systemctl start ptdtt
echo "   ✅ Service ptdtt started"

# ─── 7. Nginx ───
echo "🌐 [7/7] Cấu hình Nginx..."
cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/ptdtt
ln -sf /etc/nginx/sites-available/ptdtt /etc/nginx/sites-enabled/ptdtt
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "   ✅ Nginx configured"

# ─── 8. Auto-deploy cron ───
echo "🔄 Cài auto-deploy cron..."
(crontab -l 2>/dev/null | grep -v auto-deploy; echo "* * * * * $APP_DIR/deploy/auto-deploy.sh >> /var/log/ptdtt/deploy.log 2>&1") | crontab -
echo "   ✅ Auto-deploy: mỗi phút kiểm tra GitHub"

# ─── Done ───
echo ""
echo "  ══════════════════════════════════════"
echo "  ✅ Setup hoàn tất!"
echo ""
echo "  🌐 Web: http://$DOMAIN"
echo "  📊 IP:  http://180.93.138.83"
echo ""
echo "  🔧 Các lệnh hữu ích:"
echo "     systemctl status ptdtt     # Xem trạng thái"
echo "     systemctl restart ptdtt    # Restart app"
echo "     journalctl -u ptdtt -f     # Xem log realtime"
echo "     tail -f /var/log/ptdtt/deploy.log  # Log auto-deploy"
echo ""
echo "  🔐 Để cài SSL (sau khi trỏ domain):"
echo "     bash $APP_DIR/deploy/ssl-setup.sh"
echo "  ══════════════════════════════════════"
echo ""
