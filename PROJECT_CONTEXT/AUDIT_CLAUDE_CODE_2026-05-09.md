# AUDIT REPORT — PTDTT Manager
> Ngày: 09/05/2026  
> Thực hiện bởi: Claude Code  
> Dành cho: Antigravity (session tiếp theo)

---

## ĐÃ SỬA TRONG SESSION NÀY

### FIX-01 — Stale text idle timeout (`js/app.js`)

**Commit cần tạo**: `fix: sync idle timeout text from 15 min to 5 min`

| Dòng | Trước | Sau |
|------|-------|-----|
| 195 | `(15 phút)` | `(5 phút)` |
| 203 | `// Warning at 14 min` | `// Warning at 4 min (1 min before logout)` |

**Lý do**: Commit `de4663b` tháng trước đổi `IDLE_TIMEOUT` từ 15→5 phút nhưng bỏ sót 2 chỗ text hiển thị.  
**Trạng thái**: Đã sửa local, **chưa commit, chưa deploy**.

---

## BUGS CÒN LẠI (chưa sửa)

### BUG-02 — Module `conferences` orphaned (MEDIUM)

`conferences.js` (28KB) và `conferences.css` (327 dòng) đã được build hoàn chỉnh nhưng **chưa được tích hợp** vào app:

- `index.html`: thiếu `<script src="js/conferences.js">` và `<link href="css/conferences.css">`
- `js/app.js` pages object: không có `conferences` entry
- Sidebar nav: không có nav-item

Seed data có `startDate: "2026-04-24"` (đã qua). Cần quyết định: wire vào app hay để pending?

### BUG-03 — Inconsistent CSS/JS cache version strings (LOW)

index.html dùng 3 version groups: `v=14041632`, `v=2804281740`, `v=2804281755`.  
CSS files vẫn ở `v=14041632` trong khi JS đã được bump. Cần bump đồng bộ khi deploy.

---

## SECURITY — CẦN LÀM

### SEC-01 — Thiếu Content-Security-Policy header

Không có CSP trong `nginx.conf` hoặc `server_flask.py`. App load 3 CDN scripts không có bảo vệ origin.

**Fix nginx.conf** — thêm vào block `server` HTTPS:
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';" always;
```

### SEC-02 — Thiếu Subresource Integrity (SRI) cho 3 CDN scripts

```html
<!-- index.html:265-267 — cần thêm integrity attribute -->
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js">
<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js">
```

Lấy hash tại: `https://www.srihash.org/` hoặc `openssl dgst -sha384 -binary file.js | openssl base64 -A`

---

## ACCESSIBILITY — P0 (toàn bộ chưa làm)

### A1 — `:focus-visible` chưa có ở đâu ngoài form inputs

`css/base.css:150` chỉ style `:focus` cho `.form-input`, `.form-select`, `.form-textarea`.  
Buttons (`.btn`), nav items (`.nav-item`), modal close, bell button — không có focus ring.

**Fix**: Thêm vào `css/base.css`:
```css
:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
}
```

### A2 — Modal thiếu ARIA semantics

`index.html:255-263` — thiếu `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title"`.  
Close button `&times;` thiếu `aria-label="Đóng"`.

**Fix** `index.html`:
```html
<div class="modal-overlay" id="modal-overlay">
    <div class="modal" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
            <h3 class="modal-title" id="modal-title"></h3>
            <button class="modal-close" id="modal-close" aria-label="Đóng">&times;</button>
```

### A3 — Touch targets dưới 44×44px

| Element | Kích thước thực | Chuẩn WCAG |
|---------|----------------|------------|
| `.btn-icon` | 32×32px | 44×44px |
| `.nav-item` mobile | ~40px height | 44px |
| `.mobile-logout-btn` | ~28px height | 44px |

### A4 — Nav thiếu ARIA

`<nav class="sidebar-nav">` thiếu `aria-label="Menu chính"`.  
Nav item active thiếu `aria-current="page"`.

---

## PERFORMANCE — GHI NHẬN

| Vấn đề | Data | Priority |
|--------|------|----------|
| 24 JS files load đồng bộ | ~548KB unminified | P1 |
| 3 CDN scripts | ~600KB thêm | P1 |
| `xlsx.full.min.js` luôn load | Chỉ cần khi export | P2 |
| Lazy load: chưa có | `index.html`: 24 `<script>` tags | P1 |

---

## TRẠNG THÁI PENDING TASKS (đối chiếu HANDOFF)

| Task gốc | Trạng thái thực tế |
|----------|-------------------|
| P0: focus-visible | ❌ Chưa làm |
| P0: touch targets 44px | ❌ Chưa làm |
| P0: modal semantics | ❌ Chưa làm |
| P0: screen reader labels | ❌ Chưa làm |
| P1: Mobile bottom nav | ✅ **ĐÃ XONG** — `mobile.css:92-151` (sidebar → bottom scrollable) |
| P1: Form auto-save | ❌ Chưa làm — risk cao với idle timeout 5 phút |
| P1: Lazy load modules | ❌ Chưa làm |
| P1: Global FormController | ❌ Chưa làm |

---

## CODE QUALITY — GHI NHẬN

- `server.py` (263 dòng) và `server.js` là dev artifacts còn trong repo, có thể gây nhầm lẫn
- Inline styles nặng trong JS-generated HTML (`app.js`, `auth.js` modals)
- `manifest.json`: `"purpose": "any maskable"` sai cú pháp → phải tách thành 2 entries riêng

---

## WORKFLOW TIẾP THEO

```bash
# 1. Commit fix đã làm
cd ~/Projects/ptdtt-manager
git add js/app.js
git commit -m "fix: sync idle timeout text from 15 min to 5 min"

# 2. Deploy
git push origin main
ssh root@180.93.138.83
cd /var/www/ptdtt-manager && git pull origin main && systemctl restart ptdtt
```

---

*Audit thực hiện bởi Claude Code session ngày 09/05/2026*  
*File handoff gốc: `PROJECT_CONTEXT/HANDOFF_CLAUDE_CODE_2026-05-09.md`*
