#!/bin/bash
# Auto-deploy: Checks GitHub for changes and deploys automatically
# Cron: * * * * * /var/www/ptdtt-manager/deploy/auto-deploy.sh >> /var/log/ptdtt/deploy.log 2>&1

APP_DIR="/var/www/ptdtt-manager"
BRANCH="main"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

cd "$APP_DIR" || exit 1

# Fetch latest from GitHub
git fetch origin "$BRANCH" --quiet

LOCAL=$(git rev-parse "$BRANCH" 2>/dev/null)
REMOTE=$(git rev-parse "origin/$BRANCH" 2>/dev/null)

if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0  # No changes
fi

echo "$LOG_PREFIX 🔄 New changes detected, deploying..."
echo "$LOG_PREFIX Local:  $LOCAL"
echo "$LOG_PREFIX Remote: $REMOTE"

# Pull changes
git reset --hard "origin/$BRANCH"

# Install/update dependencies if requirements changed
if git diff "$LOCAL" "$REMOTE" --name-only | grep -q "requirements.txt"; then
    echo "$LOG_PREFIX 📦 Updating Python dependencies..."
    "$APP_DIR/venv/bin/pip" install -r requirements.txt --quiet
fi

# Fix permissions
chown -R www-data:www-data "$APP_DIR"

# Restart service
systemctl restart ptdtt
echo "$LOG_PREFIX ✅ Deploy complete! Service restarted."
