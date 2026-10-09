# BỘ NHẬN DIỆN THƯƠNG HIỆU — PTDTT Manager (khoaptdtt.info.vn) · v1.1

| Mục | Nội dung |
| :--- | :--- |
| **Dự án** | PTDTT Manager · repo `~/Projects/ptdtt-manager` · production `khoaptdtt.info.vn` |
| **Phiên bản** | **v1.1 — 08/10/2026**: cập nhật theo bản AG đã áp (commit `e575402` → `d14a2c7`, build `2610041106`). v1.0 — 03/10/2026 (Claude, Cowork) |
| **Yêu cầu** | Tạo bộ nhận diện cho website, **giữ nguyên logo** |
| **BS. An đã chốt** | 03/10: (1) Bảng màu **rút từ logo khoa** · (2) **Giữ dark mode** · (3) **Giữ 4 sắc độ cách mổ** · (4) **Logo đầy đủ ở mọi vị trí** (sidebar, header, icon app) — không dùng bản cắt. 04/10: (5) **Mổ yêu cầu = vàng `#FFC107`** chữ navy |
| **Gói tài nguyên** | `docs/brand/` trong repo: `css/` (tokens, variables, fonts) · `fonts/` (16 woff2 + OFL) · `img/` (icon, favicon, biểu tượng) · `brand-board.png` · `tools/` (sinh token, đo tương phản, `check_brand.sh`) |
| **Đã kiểm chứng** | 110/110 cặp màu đạt ngưỡng (chữ ≥4,5:1, viền/biểu đồ ≥3:1) ở **cả sáng lẫn tối**. Các nhóm màu phân loại vẫn phân biệt được khi mô phỏng mù màu đỏ-lục (ΔE ≥ 7). `logo-khoa.jpg` không đổi (md5 `db144bb4…`). |
| **Trạng thái 08/10** | Đã áp lên mã nguồn. `check_brand.sh`: teal cũ 0 · Google Fonts 0 · `background:var(--primary)` 0 · màu cách mổ gán cứng 0 · logo md5 đúng. **Còn 1 cặp dưới chuẩn:** chấm/cột vàng Yêu cầu trên nền trắng 1,63:1 (cần viền, §2.4). |
| **Giới hạn** | Chưa kiểm được production đang chạy bản nào (máy không truy cập được khoaptdtt.info.vn từ phiên này). Logo gốc chỉ có **JPEG 480×480** — đã xác nhận là tệp gốc duy nhất (§1.1), nên icon 512 px là ảnh đặt trên nền trắng 512, không phóng to. |

## Lịch sử thay đổi

| Ngày | Phiên bản | Nội dung | Commit |
| :--- | :--- | :--- | :--- |
| 03/10 | v1.0 | Bộ nhận diện gốc: bảng màu từ logo, token sáng/tối, font tự host, icon | `400003a` |
| 03/10 | — | AG áp token, font, icon, theme-color (Bước 1) | `e575402` |
| 03/10 | — | AG thay mã màu cứng theo ngữ nghĩa, màu cách mổ đọc từ CSS var, báo cáo xuất ảnh (Bước 2) | `9acb49b` |
| 03/10 | — | Ghi nhận tệp logo gốc chính thức trên Google Drive | `6f18540` |
| 03/10 | — | **BS. An: dùng logo đầy đủ** ở sidebar và header điện thoại (bỏ bản cắt `logo-mark`) — BUG-155 | `822e2ea` |
| 03/10 | — | DESIGN.md + quy tắc nhận diện vào AGENTS.md | `38e04bf` |
| 03/10 | — | Icon PWA / apple-touch tạo lại từ **logo đầy đủ** | `69a575a` |
| 04/10 | — | Sửa chữ tàng hình do thiếu biến (`--accent-hover`, `--bg-card`, `--text`, `--primary-color`, `--border-color`) — BUG-156 | `2e6af50` |
| 04/10 | — | **Mổ yêu cầu → vàng `#FFC107`** chữ navy — BUG-157 | `d14a2c7` |
| 08/10 | **v1.1** | Cập nhật tài liệu này + ảnh mẫu theo bản đã áp; thêm quy tắc viền cho vàng; sửa `check_brand.sh` (mục 6 đếm nhầm `clearInterval`) | (chờ AG commit) |

---

## 0. Mốc ban đầu (đo 03/10, trước khi áp)

- **Màu thương hiệu hiện tại (teal `#0891B2`) không đủ tương phản khi làm chữ:** chỉ đạt 3,68:1 trên nền trắng và 3,53:1 trên nền trang, trong khi `var(--primary)` được dùng làm màu chữ hoặc icon ở **131 chỗ**. Navy mới đạt 14,68:1.
- **Thẻ "Loại mổ" có chữ trắng dưới chuẩn:** Yêu cầu `#f59e0b` 2,15:1 · Chương trình `#3b82f6` 3,68:1 · Bán khẩn `#ef4444` 3,76:1. Bảng mới đạt 4,9–9,9:1.
- **Màu cách mổ đang có hai bộ mâu thuẫn nhau:**
  - `tokens.css` khai báo Robot tím / Nội soi xanh lá / Mổ mở xanh dương / NSTH cam, nhưng lớp `.badge-*` dùng các màu này **không được JS nào gọi**, tức là mã chết.
  - Giao diện người dùng thực sự thấy đến từ `surgery.js:369`, `surgery-stats.js:1259`, `.approach-tag`: **Mổ mở đỏ `#e11d48` · Nội soi xanh lá `#16a34a` · NSTH tím `#8b5cf6` · Robot navy `#1e3a5f`**.
  - Bộ nhận diện giữ **4 sắc độ mà người dùng đang thấy** (bộ thứ hai).
- **Mã màu gán cứng:** 739 mã hex trong CSS nguồn và 889 trong JS. Riêng teal cũ còn **136 chỗ (CSS) và 105 chỗ (JS)**, cộng `rgba(8,145,178,…)`.
- **Font:**
  - Be Vietnam Pro và Noto Sans đang nạp từ Google Fonts (3 dòng trong `index.html`).
  - Biểu đồ canvas ở `dashboard.js` gọi font **Inter**, nhưng Inter không được nạp nên trình duyệt rơi về font hệ thống. Tổng cộng có 78 chỗ ghi "Inter".
- **Icon:**
  - `img/icon-192.png` và `icon-512.png` thực chất là **JPEG 480×480, trùng y hệt `logo-khoa.jpg`** (cùng md5). Trong khi đó `manifest.json` lại khai báo chúng là PNG 192/512.
  - `manifest.json` vẫn dùng theme `#0891b2`.
  - Header trên điện thoại hiển thị **logo đầy đủ ở 28 px**, nên dòng chữ "COLORECTAL SURGERY DEPARTMENT" không đọc được.

---

## 1. Logo (giữ nguyên, không vẽ lại)

### 1.1 Tệp gốc chính thức

- `z7671210353977_f44e88d91f47e3616ae9e99a5b74ebb8.jpg` — Google Drive: `AN/01. CÔNG VIỆC/KHOA PTDTT/06. WEB APP /3. LOGO KHOA/`.
- JPEG 480 × 480 px, md5 `db144bb49b076d907881e6b04f96f478`. Trùng byte với `img/logo-khoa.jpg` trên web.
- BS. An chỉ định là logo chính thức duy nhất của Khoa cho web app (03/10/2026).

### 1.2 Dùng ở đâu (v1.1)

| Vị trí | Tệp | Cách đặt |
| :--- | :--- | :--- |
| Sidebar | `img/logo-khoa.jpg` (logo đầy đủ) | Ô trắng 44 × 44 px, bo 10 px, viền `0 0 0 1px var(--border)`, `object-fit: contain` |
| Header điện thoại | `img/logo-khoa.jpg` | 32 × 32 px, `object-fit: contain` |
| Trang đăng nhập | `img/logo-khoa.jpg` | 120 px, nền trắng, bo 16 px, không cắt tròn |
| Icon app (PWA 192/512, maskable, apple-touch 180) | Tạo từ logo đầy đủ trên nền trắng (`scripts/generate_full_logo_icons.py`) | Maskable: logo thu về 390 px trong khung 512 (vùng an toàn 80%) |
| Favicon 16/32/48, `favicon.ico` | `img/logo-symbol.png` (chỉ biểu tượng, cắt từ đúng pixel logo) | **Ngoại lệ duy nhất**: ở 16 px logo đầy đủ chỉ còn một chấm |
| `img/logo-mark.png` | Biểu tượng + vòng cung | **Không dùng trên giao diện** (giữ trong bộ tài nguyên để in ấn nếu cần) |

**Quy tắc dùng logo:**

- Chỉ một logo chính thức. Không vẽ lại, không tạo SVG, không đổi màu pixel, không đổ bóng màu, không kéo méo.
- **Không dùng bản cắt** (`logo-mark`, `logo-symbol`) thay logo ở sidebar, header, đăng nhập hay icon app.
- Logo **luôn đặt trên ô trắng**, kể cả dark mode. Không cắt tròn sát mép.
- Ở cỡ ≤ 48 px dòng chữ "BINH DAN HOSPITAL / COLORECTAL SURGERY DEPARTMENT" không đọc được. BS. An chấp nhận đánh đổi này để logo luôn nguyên vẹn; tên khoa đã có chữ HTML bên cạnh ("Khoa Phẫu thuật / Đại trực tràng").

---

## 2. Màu

### 2.1 Năm màu gốc rút từ logo

| Màu | Mã | Lấy từ | Vai trò | Làm chữ được? |
| :--- | :--- | :--- | :--- | :--- |
| Navy | `#1D2357` (navy-900) | Chữ "BINH DAN HOSPITAL" | **Màu chủ đạo:** nút chính, mục menu đang chọn, tiêu đề | ✅ 14,68:1 |
| Xanh dương | `#1878B4` (ocean-600) | Thân biểu tượng | Nhấn phụ, thông tin. Chữ/liên kết dùng ocean-700 `#006095` | ✅ 4,79 (ocean-700: 6,76) |
| Xanh lá | `#54A83C` (leaf-500) | Lá, dấu + | Vạch mục đang chọn, trang trí. Trạng thái thành công dùng leaf-700 | ❌ 2,98 (leaf-700: 6,54) |
| Xanh nõn chuối | `#90C03C` (lime-400) | Vòng cung | Chỉ trang trí | ❌ 2,14 |
| Trung tính | slate ngả navy | — | Nền, viền, chữ thường | slate-600 trở lên ✅ |

**Gradient thương hiệu:** ocean-600 → leaf-500, giống chuyển màu trong logo. Chỉ dùng **trang trí** (dải mỏng, nền trang đăng nhập), **không đặt chữ lên**.

### 2.2 Thang màu dẫn xuất

Mỗi màu có 11 nấc 50→950, dựng theo OKLCH và giữ đúng mã logo ở nấc gốc. Các thang: `navy`, `ocean`, `leaf`, `lime`, `slate`, cùng 5 thang chức năng `green`, `rose`, `violet`, `amber`, `red`. Xem `docs/brand/css/tokens.css` hoặc `brand-board.png`.

### 2.3 Token ngữ nghĩa

Giữ nguyên **tên biến cũ** (`--primary`, `--bg-*`, `--text-*`, `--border`, `--surface-*`, `--state-*`, `--surgery-*`…), vì vậy hơn 1.000 chỗ `var(--…)` trong CSS tự đổi màu.

| Token | Sáng | Tối |
| :--- | :--- | :--- |
| Nền trang `--bg-primary` | `#F4F7FD` | `#0C1022` (navy đậm, không dùng đen tuyền) |
| Thẻ / sidebar `--bg-secondary` | `#FFFFFF` | `#141A30` |
| Chữ chính / phụ / mờ | `#262D40` / `#535A6E` / `#697082` (4,61 trên nền trang) | `#EEF1FB` / `#C3C9DA` / `#97A0B7` |
| Tiêu đề `--text-heading` | `#1D2357` | `#FFFFFF` |
| `--primary` (chữ/icon) | `#1D2357` | `#B2C1FD` (9,78:1) |
| **`--primary-fill` (MỚI, nền nút)** + `--on-primary` | `#1D2357` + trắng | `#5867C0` + trắng (5,10:1) |
| Liên kết `--text-link` | `#006095` | `#96CBF5` |
| Thành công / Cảnh báo / Nguy hiểm / Thông tin (chữ) | `#316A20` / `#7E4F00` / `#CB242D` / `#006095` | `#A0D593` / `#EEB97C` / `#FFABA3` / `#96CBF5` |
| Vòng focus `--focus-ring` | `#1878B4` | `#96CBF5` |

**Biến bí danh (thêm 04/10, BUG-156)** để mã cũ không mất màu: `--accent-hover` (ocean-800 / ocean-400), `--bg-card`, `--text`, `--primary-color`, `--border-color` — trỏ về token chuẩn. Mã mới không dùng bí danh.

> **Vì sao cần `--primary-fill`:** ở dark mode không có một màu nào vừa làm chữ trên nền tối vừa làm nền cho chữ trắng mà đạt chuẩn ở cả hai vai. Hiện có 31 chỗ `background: var(--primary)` cần đổi sang `var(--primary-fill)`.

### 2.4 Màu phân loại phẫu thuật

Giữ sắc độ cũ và luôn kèm chữ. Mỗi màu có biến `-on` cho màu chữ đặt trên nó.

| Cách mổ (approachType) | Cũ | Mới (sáng) | Chữ trên nền | Thẻ nhạt (bg / chữ) |
| :--- | :--- | :--- | :--- | :--- |
| Mổ mở | `#e11d48` | `#A90042` rose-700 | trắng 7,59 | `#FFE6E8` / `#830031` |
| Nội soi | `#16a34a` | `#34A357` green-500 | **navy `#111542`** 5,39 | `#DEF4E1` / `#005423` |
| NS tiêu hoá | `#8b5cf6` | `#7C4CD5` violet-600 | trắng 5,45 | `#EEE9FF` / `#4F2494` |
| Robot | `#1e3a5f` | `#333C83` navy-800 | trắng 9,93 | `#E7ECFF` / `#333C83` |

| Loại mổ (surgeryType) | Cũ (chữ trắng) | Mới | Chữ trên nền |
| :--- | :--- | :--- | :--- |
| Chương trình | `#3b82f6` (3,68 ❌) | `#1878B4` ocean-600 | trắng 4,79 |
| Yêu cầu | `#f59e0b` (2,15 ❌) | **`#FFC107` vàng** (BS. An chọn 04/10; v1.0 là `#BF7900`) | **navy `#111542`** 10,65 |
| Bán khẩn | `#ef4444` (3,76 ❌) | `#AC011A` red-700 | trắng 7,57 |
| Robot | `#1e3a5f` | `#333C83` navy-800 | trắng 9,93 |

**Quy tắc riêng cho vàng `#FFC107`:** chữ navy trên vàng đạt 10,65:1. Nhưng **chấm, cột biểu đồ, vạch không có chữ** đặt trên nền trắng chỉ đạt **1,63:1** (chuẩn đồ hoạ ≥ 3:1). Ở light mode các phần tử này phải có **viền 1 px `--stype-yeucau-ring` = `#9B6200`** (5,07:1). Dark mode không cần viền (vàng trên `#141A30` đạt 10,56:1). Áp cho: chấm loại mổ, chấm tổng hợp, chấm chú giải, cột chồng ở biểu đồ xu hướng.

**Vì sao Mổ mở/Nội soi và Yêu cầu/Bán khẩn được tách theo độ sáng:** khi mô phỏng mù màu đỏ-lục, cặp cũ gần như trùng nhau (ΔE 1,6–1,8). Cặp mới cách nhau ΔE 15,5–16,3 (với vàng `#FFC107`, nhóm Loại mổ ở dark mode còn tách tốt hơn: ΔE ≥ 21). Ở dark mode, Robot dùng navy-300 với chữ navy để khỏi lẫn với NSTH.

### 2.5 Biểu đồ

Thứ tự series dùng biến `--chart-1…6`:

- **Sáng:** `#333C83` · `#3492D3` · `#41822E` · `#613B00` · `#EC3E6D` · `#848A9B` (xám dành cho mục "khác").
- **Tối:** `#7182DF` · `#96CBF5` · `#C6E8BD` · `#BF7900` · `#FF708D` · `#A0A6B5`.

Tối đa 5 series có màu. Từ series thứ 6 trở đi gộp vào "Khác" (xám).

---

## 3. Chữ

| Vai | Font | Độ đậm | Ghi chú |
| :--- | :--- | :--- | :--- |
| Tiêu đề, tên trang, nút, menu, tên khoa cạnh logo | **Be Vietnam Pro** (`--font-display`) | 600/700 | Font do người Việt thiết kế, nét gần với chữ trong logo |
| Nội dung, bảng (kể cả tiêu đề cột), biểu mẫu, nhãn, **số KPI** | **Noto Sans** (`--font-body`) | 400/500/600/700 | **Chữ số đều độ rộng sẵn**, nên số liệu trong bảng thẳng cột. Be Vietnam Pro không có tính năng này |

- **Cả hai font tự host:** 16 tệp woff2, gồm bộ latin và tiếng Việt, 4 độ đậm, giấy phép OFL. Bỏ 3 dòng Google Fonts.
- **Canvas biểu đồ:** đổi `Inter` thành `'Noto Sans'`.
- **Cỡ chữ tối thiểu:** 11 px. Cỡ 10 px (`--text-xxs`) chỉ dùng cho nhãn IN HOA.

---

## 4. Thành phần giao diện

| Thành phần | Đặc tả |
| :--- | :--- |
| **Sidebar** | Nền `--bg-secondary`. **Logo đầy đủ** `logo-khoa.jpg` trong ô trắng 44 px bo 10 px, chữ "Khoa Phẫu thuật / Đại trực tràng" Be Vietnam Pro 700 màu `--text-heading`. Mục đang chọn: nền `--primary-soft`, chữ `--primary` 600, **vạch trái 3 px `--brand-leaf`** (lấy màu lá của logo) |
| **Header điện thoại** | **Logo đầy đủ** `logo-khoa.jpg` 32 px (trước đây 28 px) |
| **Trang đăng nhập** | Logo đầy đủ 120 px, `object-fit: contain`, nền trắng, không cắt tròn. Tiêu đề navy đặc. Hai quầng sáng nền đổi sang ocean và leaf (alpha ≤ 0,12) |
| **Nút** | Chính: `--primary-fill` / `--on-primary`, nền đặc, bỏ glow teal. Phụ: nền trắng, viền `--border-strong`, chữ `--primary`. Cao ≥ 40 px (≥ 44 px trên điện thoại) |
| **Focus** | `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }` |
| **Thẻ loại mổ / cách mổ** | Nền `--stype-*` / `--surgery-*`, chữ `--stype-*-on` / `--surgery-*-on`. Thẻ nhạt dùng `-bg` / `-fg` |
| **Trạng thái** | Nền `--state-*-bg`, chữ `--state-*`, kèm ký hiệu (✓ ! ×). Không truyền nghĩa chỉ bằng màu |
| **PWA** | `theme_color` `#1D2357`, `background_color` `#F4F7FD`. Thêm `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0C1022">` |

Mẫu trực quan: `docs/brand/brand-board.png`.

---

## 5. Trạng thái triển khai (08/10)

| Bước | Nội dung | Trạng thái |
| :--- | :--- | :--- |
| 1 | Token, font tự host, icon, manifest, theme-color, `--primary-fill` | ✅ `e575402` |
| 2 | Thay teal cũ, màu cách mổ/loại mổ đọc từ CSS var, biểu đồ, dark override | ✅ `9acb49b` (+ sửa `2e6af50`) |
| 3 | `reports.js` — màu thương hiệu trong ảnh báo cáo xuất | ✅ phần màu thương hiệu (`9acb49b`) |
| 4 | Viền vàng cho chấm/cột Yêu cầu; `.text-amber`/`.text-blue` còn hex cũ | ⏳ lệnh v1.1 |
| — | Mã hex Tailwind cũ không phải teal (≈ 588 trong CSS, ≈ 820 trong JS: amber/violet/blue cũ) | Chưa làm — không chặn nhận diện; xử lý dần khi sửa từng trang |

**Không làm:** không vẽ lại hay sửa logo · không bỏ dark mode · không đổi ý nghĩa màu phân loại · không dùng leaf-500, lime-400, ocean nhạt hay vàng `#FFC107` làm màu **chữ** trên nền sáng.

---

## 6. Quyết định

| # | Câu hỏi (v1.0) | Kết quả |
| :--- | :--- | :--- |
| 1 | Dùng biểu tượng cắt cho chỗ nhỏ? | **Không** — logo đầy đủ ở sidebar, header, icon app; chỉ favicon dùng biểu tượng (03/10) |
| 2 | Có tệp logo độ phân giải cao? | Không — tệp gốc chính thức là JPEG 480 px (§1.1) |
| 3 | Dừng sau Bước 1 để duyệt? | AG đã áp Bước 1–2 trong ngày 03/10, có ảnh trước/sau ở `screenshots/` |
| 4 | Màu Mổ yêu cầu | **Vàng `#FFC107`** chữ navy (04/10) |

---

# PHẦN II — LỆNH CHO AG (v1.1)

*(Trùng khớp với khối copy-paste trong chat.)*

````markdown
# LỆNH CHO AG — Bộ nhận diện PTDTT v1.1: vá 3 điểm sau đợt áp 03–04/10
Đặc tả: docs/brand/BRAND.md (v1.1, 08/10/2026) · ảnh mẫu: docs/brand/brand-board.png (đã vẽ lại theo logo đầy đủ + vàng #FFC107)
Claude đã sửa sẵn (chưa commit): docs/brand/BRAND.md, docs/brand/brand-board.png, docs/brand/tools/brand-board.html, docs/brand/tools/check_brand.sh

NGUYÊN TẮC
1. Không bịa. Dán NGUYÊN VĂN output mọi lệnh kiểm chứng.
2. Giữ nguyên quyết định của BS. An: logo đầy đủ ở sidebar/header/icon app; Yêu cầu = #FFC107 + chữ navy #111542. KHÔNG đổi lại.
3. Mỗi lỗi sửa → ghi BUG-158… vào cả 2 sổ lỗi (đúng hash thật, không ghi "HEAD").

BƯỚC 0
- Commit riêng 4 tệp docs/brand ở trên: `docs(brand): brand book v1.1 — logo đầy đủ, vàng Yêu cầu, sửa check_brand`.
- bash docs/brand/tools/check_brand.sh → dán output (mốc: mọi mục đạt, trừ 8b = 0).

LỆNH 1 — Vàng #FFC107 trên nền trắng chỉ đạt 1,63:1 (chuẩn đồ hoạ cần ≥3:1)  [BUG-158]
Chữ trên thẻ vàng đã đạt (10,65:1) — KHÔNG đổi. Chỉ chấm/cột/vạch KHÔNG có chữ mới cần viền.
- css/tokens.css (và docs/brand/css/tokens.css cho khớp): thêm `--stype-yeucau-ring: #9B6200;` (light, 5,07:1 trên trắng)
  và `--stype-yeucau-ring: transparent;` trong [data-theme="dark"] (vàng trên nền tối đã 10,56:1).
- Thêm viền `box-shadow: inset 0 0 0 1px var(--stype-yeucau-ring)` cho: .surgery-type-dot, .surgery-summary-dot (khi là Yêu cầu),
  .trend-dot-yeucau (dashboard.css:806), chấm chú giải inline surgery.js:~1588 (thẻ có chữ ở surgery-stats.js:1438 KHÔNG cần).
- Canvas: dashboard.js (~dòng 562, cột chồng) và biểu đồ loại mổ trong surgery-stats.js: khi vẽ series yeucau ở light mode,
  `ctx.strokeStyle = Utils.cssVar('--stype-yeucau-ring'); ctx.lineWidth = 1; ctx.strokeRect(...)` sau fillRect.
- Kiểm chứng: check_brand.sh mục 8b ≥ 1; chụp Tổng quan (biểu đồ xu hướng) + Lịch mổ có ca Yêu cầu, light + dark, 1440px.

LỆNH 2 — Màu chữ tiện ích còn hex Tailwind cũ, dưới chuẩn  [BUG-159]
- dashboard.css:1137 `.text-amber { color:#d97706 }` = 3,19:1 ❌ → `color: var(--state-warning)`; dark (#fbbf24) → bỏ, token đã có bản tối.
- dashboard.css:1140 `.text-blue { color:#2563eb }` → `var(--accent)`; dark → bỏ.
- Rà các lớp `.text-*` liền kề cùng khối, đổi sang token tương ứng (success/danger/info). Không đụng chỗ khác.

LỆNH 3 — Hồ sơ lệch với mã thật (chỉ sửa tài liệu)
- DESIGN.md bảng Semantic Tokens: `--primary-soft` thật là `#F4F6FF` (light) / `#1E2547` (dark), KHÔNG phải rgba;
  `--border` thật là `#D8DCE7` / `#2A3250`. Thêm dòng Loại mổ: Chương trình #1878B4/trắng · Yêu cầu #FFC107/navy (+viền #9B6200 khi không có chữ) ·
  Bán khẩn #AC011A/trắng · Robot #333C83/trắng. Ghi rõ favicon dùng logo-symbol.png (ngoại lệ duy nhất của quy tắc "logo đầy đủ").
- Sổ lỗi (cả 2 tệp): BUG-156 hash `23e4677` không tồn tại → `2e6af50`; BUG-157 `HEAD` → `d14a2c7`.
- sw.js: bỏ '/img/logo-mark.png' khỏi STATIC_ASSETS (không còn trang nào dùng). Giữ tệp trong img/ và docs/brand/img/.

KIỂM CHỨNG CUỐI
  bash docs/brand/tools/check_brand.sh            # tất cả đạt, 8b ≥ 1
  cd docs/brand/tools && python3 build_tokens.py | tail -1   # sau khi thêm ring vẫn phải "FAILS 1 / 110" (cặp vàng/trắng — đã xử lý bằng viền, ghi chú ở BRAND.md §2.4)
  node --check js/*.js ; grep -n "BUG-15[6-9]" docs/BUG_FIX_REGISTRY.md
  curl -s https://khoaptdtt.info.vn/ | grep -oE "REQUIRED_VER = '[0-9]+'"   # phải khớp version mới → xác nhận production đã lên

ĐẦU RA: output nguyên văn + 4 ảnh (light/dark × Tổng quan/Lịch mổ) + version đang chạy trên production.
````
