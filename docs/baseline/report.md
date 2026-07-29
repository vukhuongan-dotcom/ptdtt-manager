# 📊 Báo cáo Baseline & Đo lường Phase 0 — PTDTT Manager

**Ngày đo lường**: 2026-07-29  
**Môi trường**: Production Web (`khoaptdtt.info.vn`) & Codebase `/Users/khuonganvu/Projects/ptdtt-manager`

---

## 1. 🎨 AUDIT MÃ HEX AD-HOC TRONG CSS

- **Tổng số mã hex ad-hoc duy nhất được tìm thấy**: **98 mã hex** trong thư mục `css/`.
- **Top 15 mã hex xuất hiện nhiều nhất**:
  1. `#fff` / `#ffffff` (84 lần)
  2. `#eff6ff` (24 lần)
  3. `#7c3aed` (24 lần)
  4. `#34d399` (22 lần)
  5. `#fef2f2` (20 lần)
  6. `#fbbf24` (20 lần)
  7. `#f59e0b` (20 lần)
  8. `#a78bfa` (20 lần)
  9. `#94a3b8` (18 lần)
  10. `#60a5fa` (18 lần)
  11. `#fca5a5` (16 lần)
  12. `#f87171` (16 lần)
  13. `#ef4444` (16 lần)
  14. `#d97706` (16 lần)
  15. `#ecfdf5` (14 lần)

> 📌 **Hành động Phase 1**: Toàn bộ 98 mã hex ad-hoc này sẽ được thay thế hoàn toàn bằng hệ thống **Token Ngữ Nghĩa (Semantic Tokens)** trong `css/tokens.css`.

---

## 2. 🔤 KẾT QUẢ KIỂM TRA SUBSET FONT

- **Figtree (Google Fonts)**: ❌ **KHÔNG có subset `vietnamese`** (thiếu dấu tiếng Việt như ư, ơ, ê, ô, ấ, ầ, ẵ, ặ, ệ, ỗ...).
- **Be Vietnam Pro (Google Fonts)**: ✅ **CÓ đầy đủ subset `vietnamese`** chuẩn bộ dấu tiếng Việt y khoa.
- **Noto Sans (Google Fonts)**: ✅ **CÓ đầy đủ subset `vietnamese`** chuẩn body text.

> 📌 **Kết luận Font**: Sử dụng **Be Vietnam Pro** cho Headings & UI Elements và **Noto Sans** cho Body Text.

---

## 3. ⚡ ĐO THỜI GIAN RENDER THỰC TẾ

- **Hàm `SchedulePage.render()`**: **0.844 ms** (Trung bình 100 lần chạy).
- **Ngưỡng quy định**: < 300 ms.

> 📌 **Kết luận Motion/Loader**: Thời gian render của Bảng phân công tuần siêu nhanh (**0.844 ms**), do đó **CHÍNH THỨC LOẠI BỎ SKELETON LOADER** khỏi kế hoạch theo đúng quy tắc Phase 0 DoD.

---

## 📋 NỔI BẬT NÂNG CẤP DÀNH CHO PHASE 1 NEXT:
- Tạo `css/tokens.css` với 2 lớp Token (Palette thô + Semantic Tokens).
- Nối Google Fonts bằng thẻ `<link rel="preconnect">` và `<link rel="stylesheet">`.
- Gán `font-variant-numeric: tabular-nums` cho mọi bảng số.
- Remap Dark mode token chuẩn WCAG AAA.
