# AGENTS.md — PTDTT Manager Project Rules

## Thống kê phẫu thuật

### Phân nhóm phẫu thuật khi báo cáo

Khi thống kê và trình bày số liệu phẫu thuật từ db.json, **BẮT BUỘC** tách riêng các nhóm sau:

| Nhóm | Định nghĩa | Field DB |
|---|---|---|
| **Phẫu thuật mở** | approachType = `mo` | approachType |
| **Phẫu thuật nội soi** | approachType = `noisoi` + `nsth` | approachType |
| **Phẫu thuật Robot** | approachType = `robot` | approachType |
| **Nội soi tiêu hoá** | method chứa: `ESD`, `ERCP`, `nội soi tiêu hóa`, `nội soi nong`... | method |

> ❌ KHÔNG gộp "Nội soi tiêu hoá" vào "Phẫu thuật nội soi"
> - Nội soi tiêu hoá = thủ thuật qua đường tự nhiên (ESD, ERCP, nong thực quản...)
> - Phẫu thuật nội soi = PTNS laparoscopic (cắt đại tràng, cắt túi mật...)

### Phân nhóm theo loại mổ

| Nhóm | surgeryType |
|---|---|
| Phẫu thuật chương trình | `chuongtrinh` |
| Phẫu thuật dịch vụ (= mổ yêu cầu) | `yeucau` |
| Bán khẩn | `bankhan` |

"Phẫu thuật dịch vụ" = mổ yêu cầu (surgeryType = yeucau)

### Keywords nhận diện Nội soi tiêu hoá
ESD, ERCP, "nội soi tiêu hóa", "nội soi nong", "cắt polyp qua ngã hậu môn", "Nội soi trực tràng cắt polyp"

---

## Phân Loại Phẫu Thuật & Quy Tắc Xếp Cột Bác Sĩ Mổ Chính (SSoT 2026)

> 📋 **NGUỒN SỰ THẬT DUY NHẤT (SSoT):** Cập nhật ngày 28/10/2026 từ `BVBD_PHÂN LOẠI PHẪU THUẬT_nhóm NGOẠI TIÊU HOÁ.xls` (`309` kỹ thuật: `118` Nội soi + `191` dòng Mở), `Quyết định 1073/QĐ-BVBD` và `KẾT QUẢ XẾP CỘT BÁC SĨ KHOA PT-ĐTT 2026.xlsx`. Tra cứu toàn bộ danh mục 309 kỹ thuật tại `docs/PHAN_LOAI_PHAU_THUAT_VA_XEP_COT_BS_PTDTT.md` (đồng bộ tại `PROJECT_CONTEXT/PHAN_LOAI_PHAU_THUAT_VA_XEP_COT_BS_PTDTT.md`).

### 1. Nguyên tắc "Bác sĩ chính cột nào mổ được phẫu thuật loại đó"
- Đối chiếu song song theo **Đường mổ** (`Mổ mở` tra Sheet `PHẪU THUẬT MỞ`; `Mổ nội soi` tra Sheet `PHẪU THUẬT NỘI SOI`) và **Cột chuyên môn** của `BS mổ chính` (`mainSurgeon`):
  - **Cột Đặc biệt (`Cột ĐB`):** Mổ chính đúng cột `PT-ĐB`, `PT-I`, `PT-II`, `PT-III` (+ Thủ thuật các loại). Riêng **Phẫu thuật Robot** yêu cầu chứng nhận phê duyệt riêng (`TS. BSCKII. Nguyễn Phú Hữu`).
  - **Cột I (`Cột 1`):** Mổ chính đúng cột `PT-I`, `PT-II`, `PT-III` (`PT-ĐB` cần duyệt vượt cột theo từng DVKT cụ thể).
  - **Cột II (`Cột 2`):** Mổ chính đúng cột `PT-II`, `PT-III` (`PT-I`, `PT-ĐB` cần duyệt vượt cột theo từng DVKT cụ thể).
  - **Cột III (`Cột 3`):** Mổ chính đúng cột `PT-III` (`PT-II`, `PT-I`, `PT-ĐB` cần duyệt vượt cột theo từng DVKT cụ thể).
  - **Bác sĩ nội trú & Bác sĩ học viên (`Chưa xếp cột`):** Cấm đứng tên `BS mổ chính`; chỉ phụ mổ và chuẩn bị hồ sơ tiền phẫu.

### 2. Bảng Xếp Cột Năm 2026 Của 11 Bác Sĩ Khoa Phẫu Thuật Đại Trực Tràng
- **Cột Đặc biệt (Mổ mở `ĐB` / Nội soi `ĐB` — 04 BS):** `TS. BSCKII. Nguyễn Phú Hữu` (`id: 1`, Trưởng khoa — có chứng nhận **PT Robot**), `BSCKII. Vũ Khương An` (`id: 2`, Phó Trưởng khoa), `BSCKII. Vũ Ngọc Anh Tuấn` (`id: 4`), `BSCKII. Bùi Hồng Minh Hậu` (`id: 5`).
- **Cột I (Mổ mở `I` / Nội soi `I` — 01 BS):** `BSCKII. Võ Chí Nguyện` (`id: 6`).
- **Cột II (Mổ mở `II` / Nội soi `II` — 03 BS):** `ThS. BSCKI. Phạm Vĩnh Phú` (`id: 7`), `ThS. BSCKI. Giao Hữu Trường Quy` (`id: 8`), `ThS. BSCKI. Trịnh Hoàng Minh Đức` (`id: 9`).
- **Cột III (Mổ mở `III` / Nội soi `III` — 03 BS):** `BSCKI. Trần Như Đức` (`id: 10`), `BSCKI. Lê Văn Hoan` (`id: 11`), `BSCKI. Phạm Thị Tuyết Minh` (`id: 12`).
- **Lưu ý lâm sàng trọng yếu:** Danh mục `PHẪU THUẬT NỘI SOI` có **`0` kỹ thuật `PT-III`** và chỉ **`03` kỹ thuật `PT-II`** (PTNS mở thông dạ dày, PTNS cắt ruột thừa, PTNS cắt ruột thừa + rửa bụng); danh mục `PHẪU THUẬT MỞ` chỉ có **`07` kỹ thuật `PT-III`** (lấy trĩ tắc mạch, cắt u nhú condylome ống hậu môn, mở thông hồi/hỗng tràng, mở thông dạ dày, mở bụng thăm dò/sinh thiết, nối vị tràng). Trong PTNS Đại trực tràng, các ca không nạo hạch thuộc `PT-I`, còn toàn bộ các ca có nạo vét hạch ung thư / cắt toàn bộ đại tràng / nối đại tràng – ống hậu môn thuộc `PT-ĐB`.

---

## Bộ Nhận Diện Thương Hiệu (Brand Identity Standards v1)

> 🎨 **NGUỒN SỰ THẬT DUY NHẤT (SSoT):** Ban hành ngày 03/10/2026 bởi BS. Vũ Khương An. Chi tiết xem tại `docs/brand/BRAND.md` và `DESIGN.md`.

### 1. Logo Khoa — Nguyên Bản & Đầy Đủ
- **Tệp nguồn chính thức:** `z7671210353977_f44e88d91f47e3616ae9e99a5b74ebb8.jpg` (Google Drive: `.../06. WEB APP/3. LOGO KHOA/`)
- **Tệp phân phối trên Web:** `img/logo-khoa.jpg` (MD5: `db144bb49b076d907881e6b04f96f478`).
- 🛑 **Quy tắc bất biến:**
  - Luôn sử dụng **Logo gốc đầy đủ** có chữ *"BINH DAN HOSPITAL"* và *"COLORECTAL SURGERY DEPARTMENT"* (`img/logo-khoa.jpg`) trên cả **Sidebar desktop** và **Mobile header**.
  - **TUYỆT ĐỐI KHÔNG** dùng bản cắt xén `logo-mark.png` hay `logo-symbol.png` thay thế logo trên sidebar/header.
  - Logo luôn đặt trong ô nền trắng (`#FFFFFF`), bo góc `10px`, có viền `1px solid var(--border)` trên cả nền sáng và dark mode.
  - Không vẽ lại SVG, không đổi màu pixel gốc, không cắt tròn sát viền.

### 2. Hệ Màu Thương Hiệu Rút Từ Logo
- **Navy `#1D2357` (Chủ đạo):** Nút chính (`var(--primary-fill)`), tiêu đề, menu active, header mobile dark mode.
- **Ocean `#1878B4` (Nhấn phụ):** Biểu tượng, box Tổng BN trong báo cáo, link nhấn.
- **Leaf `#54A83C` (Xanh lá):** Vạch chỉ thị menu active (`3px`), trạng thái thành công.
- **Lime `#90C03C` (Nõn chuối):** Vòng cung nhận diện, dải gradient trang trí.
- **Nền & Bề mặt:** Sáng `#F4F7FD` (trang) / `#FFFFFF` (card) · Tối `#0C1022` (trang) / `#141A30` (card). Tuyệt đối không dùng đen tuyền `#000000`.
- ❌ **CẤM:** Không dùng mã màu teal cũ (`#0891b2`, `#06b6d4`, `#0e7490`, `#155e75`). Tất cả phải dùng CSS variables (`var(--primary)`, `var(--primary-fill)`, `var(--accent)`).

### 3. Typography Cục Bộ (Zero External CDN)
- ❌ **KHÔNG nạp Google Fonts qua mạng:** Không dùng `fonts.googleapis.com` hay `fonts.gstatic.com`.
- **Phông Display / Tiêu đề:** `Be Vietnam Pro` (WOFF2 cục bộ tại `/fonts/`) cho `h1–h6`, `.page-title`, `.btn`, `.nav-item`, `.logo-title`, `.modal-title`.
- **Phông Body / Số liệu / Canvas:** `Noto Sans` (WOFF2 cục bộ tại `/fonts/`) cho nội dung văn bản, bảng dữ liệu, KPI tabular-nums, biểu đồ Chart.js/Canvas, và xuất báo cáo 16h / 7h.

### 4. Quy Chuẩn 4 Cách Mổ (Sắc Độ Lâm Sàng Chuẩn)
- **Mổ mở:** Đỏ Rose `#A90042` (`--surgery-mo-bg` / `--surgery-mo-fg`) — Chữ trắng.
- **Nội soi:** Xanh lá Green `#34A357` (`--surgery-noisoi-bg` / `--surgery-noisoi-fg`) — ⚠️ **Chữ Navy `#111542`** (`--surgery-noisoi-on`) để đạt chuẩn tương phản.
- **Nội soi tiêu hóa (NSTH):** Tím Violet `#7C4CD5` (`--surgery-nsth-bg` / `--surgery-nsth-fg`) — Chữ trắng.
- **Robot:** Navy đậm `#333C83` (`--surgery-robot-bg` / `--surgery-robot-fg`) — Chữ trắng.

---

## Quy tắc Vận hành & Triển khai (Deployment Protocol)

### Quy tắc Auto-Deploy sau khi điều chỉnh xong (Auto-Deploy on Adjustment Done)

> 🛑 **NGUYÊN TẮC BẮT BUỘC RIÊNG CHO DỰ ÁN PTDTT MANAGER**
> - **Ban hành:** 22/09/2026 theo chỉ đạo của User.
> - **Phạm vi áp dụng:** Codebase `ptdtt-manager` và máy chủ `khoaptdtt.info.vn`.
> - **Ủy quyền đặc quyền:** Được miễn trừ bước dừng lại xin lệnh duyệt deploy thủ công tại R01 Phase 2 (Deployment Gate) của `rules.md`.

Mỗi khi Agent thực hiện bất kỳ điều chỉnh, nâng cấp tính năng, sửa lỗi logic hoặc cập nhật giao diện nào trong dự án:

1. **Syntax Verification Gate (BẮT BUỘC 100%):**
   - Quét kiểm tra cú pháp toàn bộ file JS: `node --check js/*.js`.
   - Nếu có bất kỳ lỗi cú pháp nào: **DỪNG LẠI NGAY LẬP TỨC**, sửa lỗi triệt để, tuyệt đối KHÔNG commit hoặc deploy mã nguồn lỗi.
2. **Đồng bộ Phiên bản & Build CSS (nếu có sửa CSS/JS):**
   - Sinh version mới theo thời gian thực: `YYMMDDHHMM` (ví dụ: `2609221246`).
   - Cập nhật đồng bộ 3 vị trí: `index.html` (REQUIRED_VER & app.bundle.css), `sw.js` (CACHE_NAME), `js/store.js` (CLIENT_BUILD).
3. **Tự Động Commit & Push Git:**
   - Commit với thông điệp rõ ràng theo chuẩn Conventional Commits (`fix:`, `feat:`, `style:`, `refactor:`).
   - Push lên nhánh `main` của GitHub (`git push origin main`).
4. **Tự Động Deploy lên Máy chủ Production (Zero-Prompt Auto-Deploy):**
   - Tự động chạy lệnh deploy lên máy chủ `root@180.93.138.83`:
     ```bash
     ssh -o StrictHostKeyChecking=no root@180.93.138.83 \
       "cd /var/www/ptdtt-manager && git pull origin main && systemctl restart ptdtt"
     ```
   - **TUYỆT ĐỐI KHÔNG DỪNG LẠI HỎI LỆNH DUYỆT DEPLOY TỪ USER.**
5. **Live Smoke Test & Tự Động Mở Chrome (Rule 1.5):**
   - Kiểm tra HTTP Status: `curl -sI https://khoaptdtt.info.vn/` (phải trả về `200 OK`).
   - Tự động mở Google Chrome: `open -a "Google Chrome" "https://khoaptdtt.info.vn/"`.
   - Báo cáo kết quả hoàn thành trong khung chat kèm đường dẫn trực tiếp có thể bấm được: `👉 https://khoaptdtt.info.vn/`.

---

## Quy tắc Học tập & Quản trị Lỗi & Tính Năng Mới liên tục (Continuous Bug & Feature Learning Protocol)

### Quy tắc Tự động Ghi nhận 100% Lỗi & Tính Năng Mới vào Bảng Tổng hợp (Auto-Registry Mandate 100%)

> 🛑 **NGUYÊN TẮC BẮT BUỘC RIÊNG CHO DỰ ÁN PTDTT MANAGER**
> - **Ban hành ban đầu:** 27/09/2026.
> - **Kiện toàn & Nâng cấp 100% Lỗi & Tính năng:** 09/10/2026 theo chỉ đạo của BS. Vũ Khương An.
> - **Hồ sơ lưu trữ Single Source of Truth (SSoT):** `PROJECT_CONTEXT/BANG_TONG_HOP_LOI_VA_KHAC_PHUC.md` (đồng bộ tại `docs/BUG_FIX_REGISTRY.md`).

Mỗi khi Agent thực hiện bất kỳ việc **SỬA LỖI (BUG)** hoặc **PHÁT TRIỂN / NÂNG CẤP TÍNH NĂNG MỚI (FEAT)** nào trong dự án `ptdtt-manager`, Agent **BẮT BUỘC TỰ ĐỘNG GHI NHẬN 100%** vào Bảng tổng hợp lỗi & tính năng của dự án ngay trong đợt commit/deploy đó, tuyệt đối không được bỏ sót:
1. **Mã số tiếp nối liên tục:** `BUG-xxx` cho sửa lỗi hoặc `FEAT-xxx` cho tính năng mới (ví dụ: `BUG-161`, `FEAT-162`, `FEAT-163`, `FEAT-164`...). Cả lỗi và tính năng dùng chung một chuỗi STT tăng dần.
2. **Thời gian ghi nhận:** `YYYY-MM-DD`.
3. **Commit Hash & Liên kết commit:** [`<short-hash>`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/<hash>).
4. **Phân hệ bị ảnh hưởng:** (Lịch mổ, Thống kê PT, Lịch trực, Báo cáo 7h/16h, Nhân sự, Tổ đặc trách, Auth, VPS, UI/UX...).
5. **Nội dung tóm tắt & Bản chất kỹ thuật:**
   - Đối với BUG: Nêu rõ hiện tượng (symptoms), nguyên nhân gốc rễ (Root Cause Analysis - RCA) và giải pháp kỹ thuật đã áp dụng.
   - Đối với FEAT: Nêu rõ mục tiêu tính năng, kiến trúc thay đổi, các file sửa đổi và phiên bản build (`vYYMMDDHHMM`).
6. **Đồng bộ song hành 100%:** Luôn ghi đồng thời vào cả 2 file:
   - `docs/BUG_FIX_REGISTRY.md`
   - `PROJECT_CONTEXT/BANG_TONG_HOP_LOI_VA_KHAC_PHUC.md`

> ⚠️ **Quy chuẩn thực thi:** Thao tác ghi nhận này diễn ra đồng thời với bước commit và auto-deploy, đảm bảo tri thức kỹ thuật được tích lũy liên tục vào Brain của dự án, ngăn chặn triệt để nguy cơ tái diễn lỗi cũ trong tương lai.

---

## Cam kết Bảo vệ Dữ liệu Cá nhân & An ninh Y tế (Strict Zero-PHI Protocol)

> 🔒 **NGUYÊN TẮC BẢO MẬT & ZERO-PHI BẮT BUỘC (LUẬT 91/2025/QH15)**
1. **Tuân thủ pháp luật:** Nghiêm ngặt tuân thủ Luật Khám bệnh, chữa bệnh số 15/2023/QH15, Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định số 356/2025/NĐ-CP.
2. **Chế độ Strict Zero-PHI:** Toàn bộ dữ liệu phẫu thuật lưu trữ trong `data/db.json` và các bản sao lưu `data/snapshots/`, `data_backups/` phải được khử định danh (De-identified); tuyệt đối cấm đưa thông tin định danh cá nhân nhạy cảm của người bệnh (số CCCD/CMND, địa chỉ nhà riêng, số điện thoại) vào kho lưu trữ mã nguồn Git công khai.



