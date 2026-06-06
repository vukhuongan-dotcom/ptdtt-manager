# VERSION — PTDTT Manager

## Cách bump version

**Format:** `YYMMDDHHMM` (ví dụ: `2606061450` = 2026-06-06 14:50)

### Checklist mỗi lần build mới

Chạy lệnh build:
```bash
bash build-css.sh <VERSION>
```

Sau đó cập nhật **đồng bộ** tất cả 2 nơi:

| File | Vị trí | Pattern |
|---|---|---|
| `index.html` | `<link href="css/app.bundle.css?v=...">` | `app.bundle.css?v=XXXXXXXXXX` |
| `sw.js` | dòng 2 | `const CACHE_NAME = 'ptdtt-vXXXXXXXXXX';` |

### Lệnh nhanh

```bash
# Thay OLD_VER bằng version cũ, NEW_VER bằng version mới
OLD_VER=2606061440
NEW_VER=2606061500
sed -i '' "s/app.bundle.css?v=$OLD_VER/app.bundle.css?v=$NEW_VER/" index.html
sed -i '' "s/ptdtt-v$OLD_VER/ptdtt-v$NEW_VER/" sw.js
```

---

## Lịch sử version

| Version | Ngày | Phase | Mô tả |
|---|---|---|---|
| `2606061413` | 06/06/2026 | U0 | Critical fixes — stat-icon red, keyframes, btn-icon 44px, modal-close 44px, prefers-reduced-motion |
| `2606061419` | 06/06/2026 | U1 | Design tokens — dark palette, text-subtle, shadow-xl, transition-expressive, surface tokens |
| `2606061424` | 06/06/2026 | U2 | Base 15px, dark mode toggle, btn states, ::selection, logo alt text |
| `2606061429` | 06/06/2026 | U2 fix | Fix toggle button bị overwrite bởi updateSidebarUser().innerHTML |
| `2606061432` | 06/06/2026 | U2 | Thêm chú thích label toggle sidebar |
| `2606061436` | 06/06/2026 | U3 | Focus trap modal, pill nav, card elevation, modal 860px + variants, components.css |
| `2606061440` | 06/06/2026 | U4 | Chuẩn hóa transitions — 28 → 0 instance `transition: all` |
| `2606061450` | 06/06/2026 | U4 fix | Fix font-size < 0.72rem còn sót trong mobile.css (10 instances) |
