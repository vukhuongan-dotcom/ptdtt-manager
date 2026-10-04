# BỘ NHẬN DIỆN & LỆNH CHO AG — PTDTT Manager (khoaptdtt.info.vn)

| Mục | Nội dung |
| :--- | :--- |
| **Dự án** | PTDTT Manager · repo `~/Projects/ptdtt-manager` · production `khoaptdtt.info.vn` |
| **Người lập / Ngày** | Claude (Cowork), 03/10/2026 |
| **Yêu cầu** | Tạo bộ nhận diện cho website, **giữ nguyên logo** |
| **BS. An đã chốt (03/10)** | (1) Bảng màu **rút từ logo khoa** · (2) **Giữ dark mode**, đổi sang màu mới · (3) **Giữ 4 sắc độ màu cách mổ**, chỉ tinh chỉnh |
| **Gói tài nguyên** | `docs/brand/` trong repo: `css/` (tokens, variables, fonts) · `fonts/` (16 woff2 + OFL) · `img/` (icon, favicon, biểu tượng) · `brand-board.png` · `tools/` (sinh token, đo tương phản, `check_brand.sh`) |
| **Đã kiểm chứng** | 110/110 cặp màu đạt ngưỡng (chữ ≥4,5:1, viền/biểu đồ ≥3:1) ở **cả sáng lẫn tối**. Các nhóm màu phân loại vẫn phân biệt được khi mô phỏng mù màu đỏ-lục (ΔE ≥ 7). `logo-khoa.jpg` không đổi (md5 `db144bb4…`). |
| **Giới hạn** | Chưa thấy giao diện thật sau khi áp (chưa sửa mã nguồn). Logo gốc chỉ có **JPEG 480×480**, nên icon 512 px là ảnh phóng to, hơi mềm. |

---

## 0. Đã đo trên mã nguồn hiện tại

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

### 1.1 Tệp nguồn gốc chính thức (Canonical Master Source)

- **Tệp nguồn chính thức:** `z7671210353977_f44e88d91f47e3616ae9e99a5b74ebb8.jpg`
- **Vị trí lưu trữ gốc trên Google Drive:**  
  `/Users/khuonganvu/Library/CloudStorage/GoogleDrive-vukhuongan@gmail.com/Drive của tôi/AN/01. CÔNG VIỆC/KHOA PTDTT/06. WEB APP /3. LOGO KHOA/z7671210353977_f44e88d91f47e3616ae9e99a5b74ebb8.jpg`
- **Định dạng & Thông số:** JPEG (JFIF standard 1.01), `480 × 480 px`, RGB 24-bit, dung lượng 28.738 bytes.
- **Mã băm MD5 chuẩn:** `db144bb49b076d907881e6b04f96f478` (bảo toàn 100% tính toàn vẹn).
- **Phê duyệt:** BS. Vũ Khương An phê duyệt và chỉ định làm logo chính thức duy nhất của Khoa Phẫu thuật Đại trực tràng — Bệnh viện Bình Dân cho hệ thống Web App và bộ nhận diện thương hiệu (03/10/2026).
- **Dẫn xuất:** Cả 3 biến thể dùng trên web (`img/logo-khoa.jpg`, `img/logo-mark.png`, `img/logo-symbol.png`), các icon PWA (`icon-192`, `icon-512`, `apple-touch-icon`, `favicon`), và bộ 5 màu thương hiệu (Navy `#1D2357`, Xanh dương `#1878B4`, Xanh lá `#54A83C`, Nõn chuối `#90C03C`) đều được trích xuất trực tiếp từ tệp nguồn gốc này.

### 1.2 Các biến thể hiển thị

Cả ba tệp đều cắt từ đúng các pixel của `logo-khoa.jpg`, không đổi màu hay nét nào.

| Tệp | Nội dung | Dùng ở đâu |
| :--- | :--- | :--- |
| `img/logo-khoa.jpg` (giữ nguyên) và `docs/brand/img/logo-khoa.png` (cùng ảnh, định dạng PNG) | Logo đầy đủ: biểu tượng, vòng cung, BINH DAN HOSPITAL, Colorectal Surgery Department | Trang đăng nhập, bản in, báo cáo xuất ảnh. **Tối thiểu 96 px** |
| `logo-mark.png` | Biểu tượng và vòng cung, không có chữ | Sidebar (40–48 px), header điện thoại (32 px), icon app, apple-touch-icon |
| `logo-symbol.png` | Chỉ biểu tượng hình đại tràng | Favicon 16/32/48 px, `favicon.ico` |

**Quy tắc dùng logo:**

- Chừa khoảng trống quanh logo ≥ ¼ chiều rộng biểu tượng.
- Không kéo méo, không đổi màu, không đổ bóng màu.
- Không cắt tròn sát mép. Hiện `.login-logo-icon` đang `border-radius:50%` + `object-fit:cover`; cần đổi sang `contain` và nền trắng.
- Logo **luôn đặt trên ô trắng**. Ở dark mode, đặt logo trong ô trắng bo góc 10 px, không đặt trực tiếp lên nền tối.

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
| Yêu cầu | `#f59e0b` (2,15 ❌) | `#FFC107` vàng tươi (Material Yellow) | **navy** 10,65 (WCAG AAA) |
| Bán khẩn | `#ef4444` (3,76 ❌) | `#AC011A` red-700 | trắng 7,57 |
| Robot | `#1e3a5f` | `#333C83` navy-800 | trắng 9,93 |

**Vì sao Mổ mở/Nội soi và Yêu cầu/Bán khẩn được tách theo độ sáng:** khi mô phỏng mù màu đỏ-lục, cặp cũ gần như trùng nhau (ΔE 1,6–1,8). Cặp mới cách nhau ΔE 15,5–16,3. Ở dark mode, Robot dùng navy-300 với chữ navy để khỏi lẫn với NSTH.

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
| **Sidebar** | Nền `--bg-secondary`. Logo `logo-mark.png` 40 px đặt trong ô trắng 44 px bo 10 px, chữ "Khoa Phẫu thuật / Đại trực tràng" Be Vietnam Pro 700 màu `--text-heading`. Mục đang chọn: nền `--primary-soft`, chữ `--primary` 600, **vạch trái 3 px `--brand-leaf`** (lấy màu lá của logo) |
| **Header điện thoại** | `logo-mark.png` 32 px thay cho logo đầy đủ 28 px |
| **Trang đăng nhập** | Logo đầy đủ 120 px, `object-fit: contain`, nền trắng, không cắt tròn. Tiêu đề navy đặc. Hai quầng sáng nền đổi sang ocean và leaf (alpha ≤ 0,12) |
| **Nút** | Chính: `--primary-fill` / `--on-primary`, nền đặc, bỏ glow teal. Phụ: nền trắng, viền `--border-strong`, chữ `--primary`. Cao ≥ 40 px (≥ 44 px trên điện thoại) |
| **Focus** | `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }` |
| **Thẻ loại mổ / cách mổ** | Nền `--stype-*` / `--surgery-*`, chữ `--stype-*-on` / `--surgery-*-on`. Thẻ nhạt dùng `-bg` / `-fg` |
| **Trạng thái** | Nền `--state-*-bg`, chữ `--state-*`, kèm ký hiệu (✓ ! ×). Không truyền nghĩa chỉ bằng màu |
| **PWA** | `theme_color` `#1D2357`, `background_color` `#F4F7FD`. Thêm `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0C1022">` |

Mẫu trực quan: `docs/brand/brand-board.png`.

---

## 5. Triển khai: 3 bước, mỗi bước 1 commit hoàn tác được

- **Bước 1 — đổi toàn cục qua token, gần như không sửa markup:** thay `tokens.css` và `variables.css`, tự host font, đổi icon/manifest/logo, đổi 31 chỗ `--primary` → `--primary-fill`. Riêng bước này đã đổi màu được ~70% giao diện. **Dừng lại, gửi ảnh trước/sau.**
- **Bước 2 — thay mã màu cứng theo ngữ nghĩa:**
  - Teal cũ trong CSS và JS.
  - Màu loại mổ và cách mổ trong JS đọc từ CSS var.
  - Màu biểu đồ.
  - Phần dark override riêng của từng module.
- **Bước 3 (tuỳ chọn):** rà nốt các mã hex còn lại trong `reports.js` (269 mã, chủ yếu vẽ ảnh báo cáo nền trắng để in, chỉ đổi màu thương hiệu).

**Không làm:**

- Không vẽ lại hay sửa logo.
- Không bỏ dark mode.
- Không đổi ý nghĩa màu phân loại.
- Không dùng leaf-500, lime-400 hay ocean nhạt làm màu chữ trên nền sáng.

---

## 6. Cần BS. An quyết

1. **Dùng biểu tượng cắt từ logo** (không có dòng chữ) cho favicon, icon app, sidebar và header điện thoại. Đề xuất: **có**, vì logo đầy đủ ở ≤ 48 px thì chữ không đọc được. Nếu không đồng ý, các vị trí này giữ logo đầy đủ.
2. **Tệp logo gốc độ phân giải cao** (AI/SVG/PDF hoặc PNG ≥ 1024 px). Hiện chỉ có JPEG 480 px. Khi có tệp gốc, chạy lại phần xuất icon, không phải đổi gì khác.
3. **Thứ tự triển khai:** đề xuất dừng sau Bước 1 để duyệt ảnh trước khi deploy, thay vì để AG tự deploy theo quy tắc hiện hành.

---

# PHẦN II — LỆNH CHO AG

*(Trùng khớp với khối copy-paste trong chat.)*

````markdown
# LỆNH CHO AG — Áp bộ nhận diện PTDTT Manager (bảng màu rút từ logo, giữ nguyên logo)
Gói tài nguyên: docs/brand/   (đặc tả: docs/brand/BRAND.md · ảnh mẫu: docs/brand/brand-board.png)
Màu gốc: Navy #1D2357 (chủ đạo) · Xanh dương #1878B4 · Xanh lá #54A83C · Nõn chuối #90C03C
BS. An đã chốt 03/10: màu rút từ logo · GIỮ dark mode · GIỮ 4 sắc độ cách mổ (Mổ mở đỏ, Nội soi xanh lá, NSTH tím, Robot navy)

NGUYÊN TẮC
1. Không bịa. Dán NGUYÊN VĂN output mọi lệnh kiểm chứng.
2. Làm BƯỚC 0 → 1, DỪNG. KHÔNG push/deploy BƯỚC 1 cho tới khi BS. An duyệt ảnh
   (lệnh này ghi đè quy tắc Auto-Deploy trong AGENTS.md cho riêng đợt đổi nhận diện).
3. KHÔNG sửa/thay img/logo-khoa.jpg (md5 phải giữ db144bb49b076d907881e6b04f96f478). KHÔNG vẽ lại logo, KHÔNG tạo logo SVG.
4. KHÔNG sửa tệp trong docs/brand/ (token đã đo tương phản 110/110 cặp). Chỉ COPY ra.
5. Mỗi chỗ sửa vì tương phản dưới chuẩn → ghi BUG-155… vào BANG_TONG_HOP_LOI_VA_KHAC_PHUC.md + docs/BUG_FIX_REGISTRY.md.

BƯỚC 0 — Tiên quyết
- git status sạch (ngoài docs/brand/ mới). Commit riêng: `docs(brand): add brand kit v1` (chỉ docs/brand/).
- Chụp trước: Tổng quan, Lịch mổ, Thống kê PT, Phân công tuần, Báo cáo, Đăng nhập × (390px, 1440px) × (sáng, tối) → screenshots/before_brand/.
- bash docs/brand/tools/check_brand.sh   → dán output (mốc: 136 / 105 / 3 / 0 / 31 / 78 / md5 đúng / 11).

BƯỚC 1 — Đổi toàn cục qua token + font + logo/icon (1 commit)
1. cp docs/brand/css/tokens.css css/tokens.css
   cp docs/brand/css/variables.css css/variables.css
   cp docs/brand/css/fonts.css css/fonts.css
   mkdir -p fonts && cp docs/brand/fonts/* fonts/
   cp docs/brand/img/{favicon-16.png,favicon-32.png,favicon-48.png,favicon.ico,apple-touch-icon.png,icon-192.png,icon-512.png,icon-maskable-192.png,icon-maskable-512.png,logo-mark.png,logo-symbol.png} img/
   (icon-192.png/icon-512.png cũ thực chất là JPEG trùng logo → được ghi đè bằng PNG thật.)
2. build-css.sh: thêm `css/fonts.css` làm dòng ĐẦU TIÊN của lệnh cat (trước tokens.css).
   Kiểm tra fonts.css dùng url('../fonts/…') — đúng vì bundle nằm ở css/.
3. index.html <head>:
   - XOÁ 3 dòng Google Fonts (preconnect ×2 + link css2?family=Be+Vietnam+Pro…Noto+Sans).
   - theme-color: `<meta name="theme-color" content="#1D2357" media="(prefers-color-scheme: light)">`
                  `<meta name="theme-color" content="#0C1022" media="(prefers-color-scheme: dark)">`
   - Thêm: `<link rel="icon" href="img/favicon.ico" sizes="any">`, `<link rel="icon" type="image/png" sizes="32x32" href="img/favicon-32.png">`,
     apple-touch-icon → img/apple-touch-icon.png.
   - Header điện thoại (dòng ~60): src → img/logo-mark.png, CSS .mobile-header-logo 32×32.
   - Sidebar .logo-icon (dòng ~70): src → img/logo-mark.png; .logo-icon = ô 44×44, nền #FFFFFF, bo 10px, box-shadow 0 0 0 1px var(--border); img 40px.
4. js/auth.js:508 (trang đăng nhập) GIỮ img/logo-khoa.jpg (logo đầy đủ). css/login.css .login-logo-icon: 120×120,
   bỏ border-radius:50%, nền #FFFFFF, bo 16px; img object-fit: contain (KHÔNG cover).
   .login-page::before/::after: đổi rgba(6,182,212,.12) → rgba(24,120,180,.10); rgba(139,92,246,.1) → rgba(84,168,60,.10).
5. manifest.json: theme_color "#1D2357", background_color "#F4F7FD"; icons = icon-192.png & icon-512.png purpose "any",
   icon-maskable-192.png & icon-maskable-512.png purpose "maskable" (tách 4 mục, type image/png).
6. 31 chỗ `background: var(--primary)` → `background: var(--primary-fill)` (liệt kê: grep -nE "background(-color)?:\s*var\(--primary\)" css/*.css | grep -v bundle).
   Nơi có chữ trên nền đó đang ghi `color: #fff`/`white` → `color: var(--on-primary)`.
7. Font: css/base.css body → `font-family: var(--font-body);`. base.css:35 (h1–h6, .page-title, .brand-name, .btn, .nav-item, th)
   → `font-family: var(--font-display);` và BỎ `th` khỏi danh sách đó (Be Vietnam Pro KHÔNG có chữ số đều độ rộng → base.css:39 tabular-nums
   chỉ có tác dụng với Noto Sans). Số KPI (.stat-value, .kpi-value) giữ Noto Sans 700. Thêm .logo-title, .modal-title vào nhóm display.
   Mọi 'Inter' trong css/*.css và js/dashboard.js → 'Noto Sans' (canvas: `'11px "Noto Sans", sans-serif'`).
8. sidebar.css .nav-item.active: background var(--primary-soft); color var(--primary); box-shadow: inset 3px 0 0 var(--brand-leaf).
   base.css: thêm `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }`.
   .btn-primary: background var(--primary-fill); color var(--on-primary); box-shadow var(--shadow-glow-primary);
   hover: background var(--brand-hover); bỏ rgba(8,145,178,.3).
9. Bump version theo VERSION.md (6 marker; KHÔNG bump ptdtt_cache_ver). sw.js STATIC_ASSETS: thêm fonts/*.woff2 đang dùng + favicon.
KIỂM CHỨNG BƯỚC 1:
  bash docs/brand/tools/check_brand.sh          # mục 3 = 0, 4 = 1, 5 = 0, 6 = 0, 7 md5 đúng
  grep -c "fonts.googleapis\|fonts.gstatic" css/app.bundle.css index.html   # 0
  file img/icon-192.png img/icon-512.png        # PHẢI "PNG image data, 192 x 192" / "512 x 512"
  node --check js/*.js
  python3 -m http.server → mở DevTools Network: KHÔNG có request tới fonts.googleapis/gstatic; font tải từ /fonts/.
  Chụp lại đúng bộ ảnh BƯỚC 0 → screenshots/after_brand_step1/. DỪNG, gửi ảnh trước/sau (sáng + tối) cho BS. An.

BƯỚC 2 — Thay mã màu cứng theo ngữ nghĩa (sau khi BS. An duyệt BƯỚC 1)
1. Thêm Utils.cssVar(name) = getComputedStyle(document.documentElement).getPropertyValue(name).trim().
   Màu phân loại trong JS ĐỌC từ CSS var, không gán hex:
   - surgery.js:2-7 SURGERY_TYPES: color → cssVar('--stype-chuongtrinh'|'--stype-yeucau'|'--stype-bankhan'|'--stype-robot'),
     thêm onColor → cssVar('--stype-*-on'). Mọi nơi render `background:${typeInfo.color}` phải kèm `color:${typeInfo.onColor}`
     (gồm dòng 407, 458, 606, 1569 — dòng 1569 đang ghi cứng color:#fff).
   - surgery.js:369, surgery-stats.js:1259-1261, dashboard.js:564: mo/noisoi/nsth/robot → --surgery-* (+ --surgery-*-on).
   - surgery-stats.css .approach-tag.approach-* → background var(--surgery-*-bg); color var(--surgery-*-fg). Xoá override dark riêng (token đã có bản tối).
   - Xoá lớp chết .badge-robot/.badge-noisoi/.badge-mo/.badge-nsth trong surgery.css (0 lần dùng trong JS) — hoặc trỏ sang token mới.
   Kiểm chứng: grep -nE "'#(e11d48|16a34a|8b5cf6|1e3a5f|3b82f6|f59e0b|ef4444)'" js/surgery.js js/surgery-stats.js js/dashboard.js   # 0 dòng
2. Teal cũ → token (CSS nguồn + JS, TRỪ reports.js để BƯỚC 3):
   #0891b2,#0e7490,#06b6d4,#155e75,#164e63 → var(--primary) (chữ/viền) hoặc var(--primary-fill) (nền)
   #0284c7,#0369a1,#0c4a6e → var(--accent);  #38bdf8 (dark) → bỏ, dùng token;  rgba(8,145,178,.1x) → var(--primary-a10); .2x–.3x → var(--primary-a20)
   rgba(6,182,212,…) → var(--primary-a10/a20).
   Trong JS template string: dùng var(--…) trong style="" được; trên canvas dùng Utils.cssVar().
3. Biểu đồ (dashboard.js, surgery-stats.js, charts.css): mảng màu series = cssVar('--chart-1')…('--chart-6') theo đúng thứ tự,
   đọc lại khi đổi theme (đang có nhánh isDark — thay bằng đọc token).
4. Override dark từng module ([data-theme="dark"] … #0f172a/#1e293b/#334155/#f8fafc) → var(--bg-primary)/var(--bg-secondary)/var(--border)/var(--text-primary).
KIỂM CHỨNG BƯỚC 2:
  bash docs/brand/tools/check_brand.sh          # mục 1 = 0; mục 2 = chỉ còn reports.js; mục 8 = 0
  node --check js/*.js ; node scripts/test_duplicate_warning.js
  Chụp after_brand_step2/ (cả sáng + tối, có Thống kê PT và Lịch mổ có đủ 4 loại mổ).

BƯỚC 3 — Tuỳ chọn: reports.js (269 hex — vẽ ảnh báo cáo nền trắng để in). Chỉ đổi màu THƯƠNG HIỆU (teal → navy/ocean);
  giữ đen/xám của bảng in. Xuất thử 1 báo cáo 7h + 1 báo cáo 16h, so ảnh.

GIỮ NGUYÊN — KHÔNG "SỬA"
- Logo, tên biến CSS cũ, cơ chế dark mode (data-theme), ý nghĩa màu phân loại.
- KHÔNG dùng #54A83C / #90C03C / #1878B4 / ocean-500 làm màu CHỮ trên nền sáng (2,1–3,4:1) — dùng nấc 700.
- KHÔNG đặt chữ lên --gradient-brand (xanh dương→xanh lá). Gradient chỉ trang trí.
- Thẻ Nội soi & Yêu cầu dùng CHỮ NAVY (--*-on), không phải chữ trắng — đã đo, đây là chủ đích.
- KHÔNG dùng đen tuyền cho nền tối.

ĐẦU RA: output kiểm chứng nguyên văn + ảnh trước/sau mỗi bước (sáng + tối) + danh sách BUG mới đã ghi.
````
