# Changelog — PTDTT Manager

Mọi thay đổi đáng chú ý về tính năng, giao diện, quy trình nghiệp vụ và bảo mật của hệ thống **PTDTT Manager** (Hệ thống Quản lý Khoa Phẫu thuật Đại trực tràng — Bệnh viện Bình Dân) đều được ghi nhận tại tài liệu này.

Định dạng tuân thủ tiêu chuẩn [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) và quy tắc đánh số phiên bản [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html). Truy vết kỹ thuật chi tiết (RCA, mã commit Git, biên lai kiểm thử) được lưu trữ song hành tại `docs/BUG_FIX_REGISTRY.md` và `PROJECT_CONTEXT/BANG_TONG_HOP_LOI_VA_KHAC_PHUC.md`.

> 📌 **Current Build Stamp:** `2610312358`

---

**1. Phân Loại 6 Version Markers Trong Hệ Thống**

| # | Marker | Vị trí File | Kiểu dữ liệu / Format | Mục đích & Phạm vi tác động | Quy tắc Bump khi Phát hành |
|---|---|---|---|---|---|
| **1** | **`CACHE_NAME`** | `sw.js` (dòng 2) | String (`'ptdtt-vYYMMDDHHMM'`) | Tên Service Worker cache bucket lưu trữ static assets | **BẮT BUỘC BUMP** mỗi lần release frontend để SW kích hoạt và dọn cache cũ. |
| **2** | **`app.bundle.css?v=`** & **`js/*.js?v=`** | `index.html` (header & footer scripts) | Query String (`?v=YYMMDDHHMM`) | Cache buster ngăn HTTP cache của browser tải asset cũ | **BẮT BUỘC BUMP** cho các bundle/script có thay đổi mã nguồn trong release. |
| **3** | **`window.REQUIRED_VER`** | `index.html` (footer script) | String (`'YYMMDDHHMM'`) | Định danh phiên bản frontend đang hoạt động cho app logic | **BẮT BUỘC BUMP** đồng bộ với release build stamp. |
| **4** | **`CLIENT_BUILD`** | `js/store.js` (dòng 4) | Integer (`YYMMDDHHMM`) | Gửi lên backend qua HTTP header `X-Client-Build` | **BẮT BUỘC BUMP** khi có thay đổi frontend logic/store. |
| **5** | **`MIN_CLIENT_BUILD`** | `server_flask.py` / systemd | Integer (`YYMMDDHHMM`) | Ngưỡng build tối thiểu backend chấp nhận (trả HTTP 409/426 nếu cũ hơn) | **CHỈ BUMP** khi có breaking change trong API contract hoặc cấu trúc DB. Không bump khi release UI thông thường. |
| **6** | **`SW_BUILD_VER` / `ptdtt_cache_ver`** | `index.html` (trong `<head>`) | String (`'YYMMDDHHMM'`) | Script kiểm soát đồng bộ Service Worker và bộ nhớ đệm trình duyệt | **BẮT BUỘC ĐỒNG BỘ** với `REQUIRED_VER` khi phát hành bản cập nhật tài nguyên/giao diện. |

**2. Chuẩn Định Dạng Build Stamp (`YYMMDDHHMM`)**

```text
YYMMDDHHMM (10 chữ số, không leading zero)
- YY: 2 chữ số năm (ví dụ: 26 cho năm 2026)
- MM: 2 chữ số tháng (01–12)
- DD: 2 chữ số ngày (01–31)
- HH: 2 chữ số giờ (00–23)
- MM: 2 chữ số phút (00–59)
```

> ⚠️ **Lưu ý kỹ thuật:** `CLIENT_BUILD` là số nguyên (Integer) trong JavaScript, không được có leading zero để tránh bị parse sai.

**3. Quy Trình 3 Bước Đồng Bộ Build Stamp Khi Phát Hành**

```bash
NEW_VER=2610312158
bash build-css.sh $NEW_VER

# 1. Update CLIENT_BUILD trong js/store.js
sed -i '' "s/const CLIENT_BUILD = [0-9]*/const CLIENT_BUILD = $NEW_VER/" js/store.js

# 2. Update SW_BUILD_VER, app.bundle.css?v=, window.REQUIRED_VER và js/?v= trong index.html
sed -i '' "s/var SW_BUILD_VER = '[0-9]*'/var SW_BUILD_VER = '$NEW_VER'/" index.html
sed -i '' "s/app.bundle.css?v=[0-9]*/app.bundle.css?v=$NEW_VER/" index.html
sed -i '' "s/var REQUIRED_VER = '[0-9]*'/var REQUIRED_VER = '$NEW_VER'/" index.html
sed -i '' "s/\.js?v=[0-9]*/.js?v=$NEW_VER/g" index.html

# 3. Update CACHE_NAME trong sw.js
sed -i '' "s/const CACHE_NAME = 'ptdtt-v[0-9]*'/const CACHE_NAME = 'ptdtt-v$NEW_VER'/" sw.js
```

---

## [Unreleased]

### Added
- Tối ưu toàn diện UI/UX Tab Duyệt mổ tại khoa (`Crosscheck 31/10`, bảo toàn 100% logic máy chủ & cô lập Canary `sandboxOnlyMode`): hàng đợi `"Việc của tôi"` theo vai trò với 1 hàng chip lọc có số đếm, gom nhóm theo ngày mổ dính đầu trang và thẻ ca 3 dòng gọn; Drawer trượt phải 2 cột `1040px` trên Desktop / toàn màn hình 1 cột trên Mobile `390px` theo 3 bước tư duy lâm sàng tự thu gọn, khử trùng lặp Chip Bước ② sang `CK-03/05/07` (`✓ theo mục ②`), điều khiển phân đoạn 3 nấc, thanh Hoàn tác 10 giây, gợi ý 5 kỹ thuật hay dùng 90 ngày, màn Tóm tắt 1 trang BCN kèm khung vàng so sánh `Cũ → Mới` và nút `Duyệt & mở ca kế tiếp`, cùng 6 nhãn ngắn trên `Lịch mổ tuần` giảm `52,6%` số chạm ca lành tính HM và `44,4%` ca K trực tràng (`[FEAT-201]`, build `v2610312358`).
- Xác nhận hiệu lực `Quyết định 1073/QĐ-BVBD` (`12/06/2024` — chưa có văn bản thay thế) và bảng xếp cột bác sĩ chính Khoa PTĐTT năm 2026 (`KẾT QUẢ XẾP CỘT BÁC SĨ KHOA PT-ĐTT 2026.xlsx`, thời hạn 01 năm, mỗi năm Bệnh viện xếp cột lại); bổ sung kiểm soát vượt cột theo tính chất mổ: mổ chương trình & mổ yêu cầu không được phép vượt cột (`422 OVER_COLUMN_FORBIDDEN_FOR_ELECTIVE`), mổ bán khẩn do Ban Chủ nhiệm khoa cân nhắc và chỉ được phép vượt tối đa 01 cột khi không có nhân sự phù hợp (`422 OVER_COLUMN_EXCEEDS_MAX_ONE_STEP` nếu vượt từ 02 cột trở lên) (`[FEAT-200]`, build `v2610312158`).

### Fixed
- Khôi phục đường truyền sao lưu xác thực qua SSH (`StrictHostKeyChecking=yes`) ngoài thư mục web, bổ sung kiểm thử giải nén `data/db.json` trong sandbox `0700` và bảo vệ bản sao lưu hợp lệ gần nhất (`LKG`) trên Local & Google Drive (`[BUG-199]`).
- Gỡ bỏ và cách ly tệp stub/pointer thừa `docs/VERSION.md`, triệt tiêu trùng lặp cấu trúc và duy trì duy nhất 01 tệp SSoT `version.md` tại gốc dự án (`[BUG-198]`, build `v2610300355`).

---

## [2.6.0] - 2026-10-29

### Added
- Ghi nhận bài báo cáo khoa học của TS. BSCKII. Nguyễn Phú Hữu tại Hội nghị Cần Thơ 2026 vào phân hệ Báo cáo khoa học & Hội nghị (`[FEAT-197]`, build `v2610291102`).
- Xây dựng phân hệ Duyệt mổ chuyên môn nội bộ tại Khoa PTĐTT kèm Checklist tiền phẫu 8 mục (`CK-01..CK-08`) và hệ thống Clinical Chips (`[FEAT-195]`, build `v2610281755`).
- Cập nhật đầy đủ bộ ảnh chân dung chuẩn studio (`256×256` `.webp` và `480×600` `-lg.webp`) cho 10 Bác sĩ cơ hữu, BS. Phương và 15 Điều dưỡng, Hộ lý, Thư ký y khoa (`[FEAT-186]`, `[FEAT-189]`, `[FEAT-190]`).
- Nâng cấp phân hệ Thống kê Phẫu thuật v2.0 với Ma trận 6 trục lâm sàng thuần Việt, chuẩn hóa `dept_avg` (`M=11`) và xuất hồ sơ năng lực bác sĩ 2 trang (`[FEAT-182]`, `[FEAT-185]`).

### Changed
- Tinh chỉnh bố cục toàn chiều rộng cho Bảng Phân Tích Cơ Cấu 6 Trục Lâm Sàng và biểu đồ Radar (`[BUG-184]`).
- Chuẩn hóa khung cắt trung tâm và phông nền chân dung modal cho toàn bộ 26 nhân sự khoa (`[BUG-191]`, `[BUG-192]`, `[BUG-193]`, `[BUG-194]`).

### Fixed
- Cô lập hoàn toàn chế độ thử nghiệm (`sandboxOnlyMode`, 0% bệnh nhân thật) và sinh ngẫu nhiên 16 kịch bản kiểm thử tại Tab Duyệt mổ (`[BUG-196]`, build `v2610281835`).
- Khắc phục lỗi đầy bộ nhớ cục bộ (`QuotaExceededError`) khi lưu lịch mổ tuần và căn thẳng hàng tiêu đề thẻ ca mổ (`[BUG-187]`, `[BUG-188]`).
- Khử trùng lắp thống kê giữa nhóm Phẫu thuật Robot và Phẫu thuật nội soi (`[BUG-183]`).

### Security
- Chuẩn hóa kiểm tra `_client_build() < MIN_CLIENT_BUILD` trả về `409 Conflict` (`STALE_CLIENT`) và hoàn thành đợt kiểm toán bảo mật – giao diện tổng thể (`[BUG-163]` đến `[BUG-181]`).

---

## [2.5.0] - 2026-08-25

### Added
- Nâng cấp giao diện Lịch mổ Robot trên thiết bị di động và trình xử lý sự kiện chúc mừng sinh nhật nhân sự (`v2608251015`).
- Hợp nhất đặc tả SSoT 6 Version Markers và hoàn thiện Báo cáo 16h Thứ 7 cùng tính năng phân công lịch tuần (`v2608231548`).

### Changed
- Tái cấu trúc các thành phần CSS và nâng kích thước vùng chạm tương tác đạt chuẩn $\ge 44\text{px}$ (`v2608221436`, `v2608221515`).

### Fixed
- Giới hạn bộ lọc thống kê phẫu thuật toàn bộ tối đa đến ngày hiện tại, ngăn đếm nhầm ca dự kiến tương lai (`v2608252103`).
- Cô lập lịch sử hoàn tác (`Undo`) theo từng tuần độc lập và kiểm tra dữ liệu trước khi lưu (`v2608221515`).
