#!/usr/bin/env bash
# Kiểm chứng sau khi áp bộ nhận diện. Chạy từ gốc repo: bash docs/brand/tools/check_brand.sh
cd "$(dirname "$0")/../../.." || exit 1
SRC_CSS=$(ls css/*.css | grep -v app.bundle.css)
OLD='#0891b2|#0e7490|#06b6d4|#0284c7|#155e75|#22d3ee|#164e63|#0369a1|#0c4a6e|#38bdf8|8, ?145, ?178|6, ?182, ?212'
echo "1. Mã teal cũ còn lại (CSS nguồn):  $(grep -oiE "$OLD" $SRC_CSS | wc -l)   (mục tiêu 0)"
echo "2. Mã teal cũ còn lại (JS):         $(grep -oiE "$OLD" js/*.js | wc -l)   (mục tiêu 0)"
echo "3. Google Fonts trong index.html:   $(grep -c 'fonts.googleapis\|fonts.gstatic' index.html)   (mục tiêu 0)"
echo "4. theme-color = #1D2357:           $(grep -ci 'theme-color" content="#1D2357' index.html)   (mục tiêu 1)"
echo "5. background:var(--primary) còn:   $(grep -E 'background(-color)?:\s*var\(--primary\)' $SRC_CSS | wc -l)   (mục tiêu 0 — đổi sang --primary-fill)"
echo "6. font 'Inter' còn:                $(grep -oE "['\"]Inter['\"]|[ ,]Inter[ ,]" $SRC_CSS js/*.js | wc -l)   (mục tiêu 0)"
echo "7. logo-khoa.jpg không đổi:         $( (md5sum img/logo-khoa.jpg 2>/dev/null || md5 -r img/logo-khoa.jpg) | cut -c1-32)   (phải = db144bb49b076d907881e6b04f96f478)"
echo "8b. Chấm/cột vàng Yêu cầu có viền (light): $(grep -c "stype-yeucau-ring" css/tokens.css)   (mục tiêu ≥1)"
echo "8. Màu cách mổ còn gán cứng trong JS: $(grep -nE "color: ?'#(e11d48|16a34a|8b5cf6|1e3a5f|3b82f6|f59e0b|ef4444)'" js/surgery.js js/surgery-stats.js js/dashboard.js | wc -l)   (mục tiêu 0 — đọc từ CSS var)"
node --check js/*.js 2>&1 | head -3 && echo "9. node --check: OK"
