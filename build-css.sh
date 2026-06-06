#!/usr/bin/env bash
# build-css.sh — Bundle tất cả CSS theo thứ tự cứng
# Chạy từ thư mục gốc project: bash build-css.sh
# Sau khi chạy: commit css/app.bundle.css cùng với index.html + sw.js

set -e

OUT="css/app.bundle.css"
VER="${1:-$(date +%y%m%d%H%M)}"

echo "=== Building CSS bundle (version: $VER) ==="

# Thứ tự cứng: variables PHẢI đầu tiên (các file khác dùng CSS vars)
cat \
  css/variables.css \
  css/base.css \
  css/sidebar.css \
  css/login.css \
  css/modal.css \
  css/components.css \
  css/toast.css \
  css/search.css \
  css/dashboard.css \
  css/staff.css \
  css/staff-tracking.css \
  css/tasks.css \
  css/plans.css \
  css/patients.css \
  css/schedule.css \
  css/surgery.css \
  css/surgery-stats.css \
  css/rooms.css \
  css/research.css \
  css/conferences.css \
  css/notifications.css \
  css/charts.css \
  css/onboarding.css \
  css/reports.css \
  css/mobile.css \
  > "$OUT"

SIZE=$(wc -c < "$OUT")
echo "✅ Bundle created: $OUT ($SIZE bytes)"
echo "   Files: $(grep -c '@' $OUT || echo 'many') @ rules included"
echo ""
echo "Next steps:"
echo "  1. Test visual regression trên browser"
echo "  2. Nếu OK: update index.html + sw.js, commit với version $VER"
