# Changelog — PTDTT Manager

Mọi thay đổi đáng chú ý về tính năng, giao diện, quy trình nghiệp vụ và bảo mật của hệ thống **PTDTT Manager** (Hệ thống Quản lý Khoa Phẫu thuật Đại trực tràng — Bệnh viện Bình Dân) đều được ghi nhận tại tài liệu này.

Định dạng tuân thủ tiêu chuẩn [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) và quy tắc đánh số phiên bản [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html). Truy vết kỹ thuật chi tiết (RCA, mã commit Git, biên lai kiểm thử) được lưu trữ song hành tại `docs/BUG_FIX_REGISTRY.md` và `PROJECT_CONTEXT/BANG_TONG_HOP_LOI_VA_KHAC_PHUC.md`.

> 📌 **Current Build Stamp:** `2611271155`

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
- Bổ sung nguồn bệnh nhân (Cấp cứu/Phòng khám + chip BS cho nhập), tối ưu bảng nhập liệu Mobile/Laptop và cập nhật Tutorial 7 bước (`[FEAT-246]`, commit `2588f72`, build `v2611261952`).
- Bổ sung nút Xóa ca chờ tư vấn (Zero-RM) và chuyển số điện thoại khi nhập ca tư vấn sang không bắt buộc (`[FEAT-245]`, commit `73f9404`, build `v2611261009`).
- Sửa nhãn 'Việc của tôi' trên Tutorial/thanh việc cần làm & tự động điền đầy đủ dữ liệu khi tạo ca giả lập [TEST] Điều phối Robot (`[FEAT-244]`, commit `e5e91f3`, build `v2611251839`).
- Xây dựng lại phân hệ Điều phối Lịch mổ Robot theo quy trình 5 bước, nhánh Nội soi 2 chiều, Xuất viện chờ giữ nguyên slot, thông báo Dual-WAL & Tutorial v2 (`[FEAT-243]`, commit `cd1862d`, build `v2611251807`).
- Tutorial hướng dẫn thao tác vĩnh viễn trực tiếp trên tab Điều phối Lịch mổ Robot (`[FEAT-242]`, commit `31467ef`, build `v2611250843`).
- Thiết kế lại giao diện Mobile (Android & iPhone, Sáng/Tối #0C1022) cho 6 tab: Lịch mổ tuần, Duyệt mổ, Nhân sự, Kế hoạch hoạt động, Báo cáo khoa học & Nghiên cứu khoa học (`[FEAT-241]`, commit `b95d47a`, build `v2611212135`).
- Thiết kế lại giao diện Mobile (Android Chrome & iPhone WebKit, Sáng/Tối #0C1022) cho 4 tab Báo cáo, Lịch phân công tuần, Thống kê phẫu thuật và Sinh hoạt chuyên môn: Header Navy-Ocean <=80px, Bottom Sheet •••, form 1 tay 44px, sửa Day View + Lịch của tôi, bỏ nút Xuất hồ sơ BS trùng, Ranking/Logbook Cards + bộ lọc, SHCM spotlight + đổi trạng thái 1 chạm (FEAT-239) (`[FEAT-239]`, commit `b1305cc`, build `v2611211822`).
- Thêm thông báo giới thiệu bộ 14 icon điều hướng mới kèm ý nghĩa (hiển thị tự động trong 1 tuần 21/11–28/11/2026 khi đăng nhập, user tự tắt từng lần hoặc vĩnh viễn theo tài khoản) (FEAT-238) (`[FEAT-238]`, commit `7717737`, build `v2611211733`).
- Thiết kế lại thanh tab Mobile dạng Icon-Only (bỏ tên tab, giữ chiều cao thoải mái), tái thiết kế bộ 14 icon Duotone Y khoa không trùng lặp dùng chung Desktop & Mobile, đồng bộ thứ tự 14 tab ưu tiên lâm sàng trên cả Laptop lẫn Mobile, kèm tên tab động trên Mobile Header và tooltip nhấn giữ 350ms (FEAT-237) (`[FEAT-237]`, commit `b48be84`, build `v2611211720`).
- Bỏ thẻ Hoạt động sắp tới khỏi tab Tổng quan trên cả Desktop/Laptop và Mobile; cân bằng bố cục .duty-grid thành 2 cột đều nhau (Trực khoa hôm nay & Trực cấp cứu hôm nay) (FEAT-236) (`[FEAT-236]`, commit `63059d3`, build `v2611211653`).
- Thiết kế lại giao diện Mobile (Android & iPhone) 3 tab Tổng quan, Theo dõi nhân sự, Phòng bệnh (kèm đưa lọc POD/tìm kiếm/BS vắng & modal phòng lên Desktop) và đưa nút + tab Mổ Robot vào thanh header (FEAT-235) (`[FEAT-235]`, commit `f8fe725`, build `v2611211452`).
- Thiết kế lại giao diện Mobile (Android Chrome & iPhone WebKit) tab Điều phối Lịch mổ Robot: Header gọn, KPI chip, Day-Pill + Cả tuần, Mobile Cards cho 4 tab bảng, Bottom Sheet •••, FAB +, Gọi tel: theo RBAC, Segmented Pill Ca 1–Ca 3 + gợi ý x/3 ca và chống iOS zoom (FEAT-234) (`[FEAT-234]`, commit `1724c87`, build `v2611211420`).
- Chuẩn hóa ô Thời gian dự kiến & Ngày mổ bằng lịch chọn ngày không nhập tay và giới hạn công suất Robot tối đa 3 ca/ngày (Ca 1–Ca 3) (FEAT-232) (`[FEAT-232]`, commit `d5fb107`, build `v2611211250`).
- Tích hợp phân hệ Điều phối Lịch mổ Robot liên thông nguyên tử 2 chiều với Lịch mổ tuần, Dual-WAL, Zero-Local-PHI & Mẫu in A5 P.CTXH (FEAT-231) (`[FEAT-231]`, commit `f212713`, build `v2611211215`).
- Đồng bộ quy chuẩn khuyến nghị 7 mô hình Plan theo Google Antigravity v2.34.0 (`[FEAT-230]`, commit `f212713`).
- Đồng bộ quy chuẩn Plan V3 từ 5 lên 7 cấu hình nội sinh AG (bổ sung Gemini 4 Neon & Orchestrator Neon) (`[FEAT-229]`, commit `af4dd66`).
- Cập nhật lịch SHCM Khoa PTĐTT đến 07/06/2027: bổ sung 3 buổi 19/10, 02/11, 16/11 và tịnh tiến +6 tuần cho 14 buổi tiếp theo (FEAT-228) (`[FEAT-228]`, commit `478a689`, build `v2611160654`).
- Bổ sung Tab Nghiên cứu khoa học (NCKH) dành riêng cho Ban Chủ nhiệm (5 sub-tabs: Dashboard, Đề tài xét duyệt, Đề tài nghiệm thu, Sáng kiến xét duyệt, Sáng kiến công nhận; form CRUD, Chia đều %, chuyển trạng thái 1 chạm, xuất ảnh 2K PNG và 8 bản ghi QĐ 2026) (`[FEAT-226]`, commit `8f98799`, build `v2611122150`).
- Bổ sung bài báo cáo khoa học "Kết quả Bệnh viện Bình Dân 10 năm đầu tiên triển khai phẫu thuật Robot tại Việt Nam" của TS.BSCKII. Nguyễn Phú Hữu và vai trò Đồng Chủ tọa đoàn Phiên 1 Chuyên đề Ngoại khoa tại HNKHKT BVĐKKV Thủ Đức 2026 (ID 36), cập nhật seed data và bump build v2611092230 (`[FEAT-224]`, commit `276c9e0`, build `v2611092230`).
- Nâng cấp cổng Auto-Registry và Hook Chaining Dispatcher theo chuẩn Rule v2:R45 (hỗ trợ upsert 2 giai đoạn, kiểm chứng biên lai VerificationReceipt v1 và tương thích đa môi trường) (`[FEAT-223]`, commit `276c9e0`).
- Cập nhật ảnh đại diện & chân dung quy chuẩn cho ĐD. Ừng Phương Minh Oanh (ID 49) [FEAT-222] (v2611060526) (`[FEAT-222]`, commit `6c97918`, build `v2611060526`).
- Cập nhật ảnh đại diện & chân dung studio quy chuẩn cho ĐD Trưởng Nguyễn Thị Ngọc Thùy (ID 3) và ĐD Nguyễn Thị Thanh Trúc (ID 52) gồm ảnh tròn 256x256 và chân dung 480x600, bổ sung vào STAFF_PHOTO_IDS, STAFF_PHOTO_DIMS và bộ kiểm thử TC-16 (build v2611031508) (`[FEAT-219]`, commit `3f38009`, build `v2611031508`).
- Triển khai Đợt 1 Ghi nhận trách nhiệm đa bác sĩ chuẩn bị mổ, xác thực tài khoản cá nhân 1 lần (`mustChangePassword`, `sessionEpoch`, cô lập đa tab `_authEpoch`, thẻ tên 1 chạm), kiểm tra chống trùng đa đợt 2 tầng phía máy chủ (`episodeId` + `admissionId`), tách `proposedClass`/`verifiedClass` kỹ thuật ngoài DM 309, giao diện thẻ `TNM` chuẩn SurgiLog khóa phiên bản (`AJCC 8 Ch.20` & `AJCC Version 9 Anus`, tách `cTNM`/`ycTNM`), nhật ký chuỗi băm kép (`txEventId`, đọc đuôi thích ứng `>64 KiB`, xoay sổ `.seq_*.jsonl.gz`), quy chế trình thay (`assistSurgeon1` & `BS chính POD`), BCN tự duyệt minh bạch và 02 hệ KPI độc lập; giữ nguyên chế độ Demo trên bệnh nhân giả `[TEST]` (`sandboxOnlyMode = true`) đến hết `08/11/2026` (dự kiến áp dụng thực tế từ Thứ Hai `09/11/2026`) (`[FEAT-216]`, commit `79ee1dc`, build `v2611030107`).
- FEAT: Nâng thời gian tự đăng xuất khi không hoạt động từ 5 phút lên 10 phút, cảnh báo trước 1 phút ở phút thứ 9 trong js/app.js (`[FEAT-215]`, commit `9ec1ff6`, build `v2611021947`).
- FEAT: Tạo ca giả lập [TEST] trực tiếp từ Lịch mổ tuần liên thông sang Tab Duyệt mổ để tập huấn quy trình (0% ảnh hưởng bệnh nhân thật) (`[FEAT-212]`, commit `fbcd9bc`, build `v2611021246`).
- Tạm cất dự trữ chip Bắc cầu Heparin / LMWH (shelved: true) tại Cụm 2B Thuốc chống huyết khối để sử dụng sau (`[FEAT-211]`, commit `61e3a4d`, build `v2611021215`).
- Nâng cấp toàn diện Tab Duyệt mổ nội bộ Khoa PTĐTT lên phiên bản quy tắc `2026.11.v5` theo Phiếu khám tiền mê mẫu BVBD (Zero HIS Coupling, không nhập ASA/Mallampati): mở rộng `C-04` lên 13 bệnh nội khoa chọn lọc (lược bỏ Covid 19) kèm ghi chú điều trị; bổ sung `C-08` Tiền sử ngoại khoa/vô cảm & loại sẹo ổ bụng (cảnh báo đặt trocar khi mổ Nội soi/Robot trên nền sẹo mổ mở cũ), `C-09` Tiền sử dị ứng (`TC-21a` bắt buộc tên tác nhân khi chọn Thuốc/Phản vệ), `C-10` Thói quen rượu bia, thuốc lá kèm chip nhanh `[5] [10] [20] [30] gói/năm` (`TC-21b`) và chất gây nghiện (`TC-21c`); chia Bước ② thành Cụm 2A & Cụm 2B bảo toàn `9 chạm` ca thường quy, đồng bộ khóa an toàn `CK-03` (`TC-21d`), duyệt lại `Cũ → Mới` (`TC-22a`), hoãn cấp cứu (`TC-22b`), chuẩn hóa `Phương án 1` (tách riêng Quy ước điều phối bán khẩn nội bộ tại Khoa khỏi `QĐ 1073/QĐ-BVBD`) và Việt hóa 100% `Mốc hạn trình duyệt` (`[FEAT-209]`, commit `ccdef62`, build `v2611021115`).
- Cập nhật ảnh chân dung studio chính thức cho ĐD. Đỗ Thị Bích Châu (ID 51) gồm 51.webp (256×256) và 51-lg.webp (480×600), bổ sung vào STAFF_PHOTO_IDS và STAFF_PHOTO_DIMS trong js/staff-photos.js (`[FEAT-208]`, commit `c91c8e9`, build `v2611011726`).
- Thiết lập hệ thống tự động ghi sổ lỗi/tính năng (`scripts/register_bug_feat.py`) kết hợp chốt chặn Git Hooks (`.git/hooks/pre-commit` & `commit-msg`, cài đặt qua `scripts/install-git-hooks.sh`) tự động kiểm tra cú pháp JS/Python, tự tính bộ đếm thống kê Schema v3.1, nhân bản khớp SHA-256 2 tệp Dual SSoT và chặn cứng mọi commit sửa mã nguồn hoặc `fix:`/`feat:` nếu quên ghi sổ; đồng bộ quy trình vào `SKILL.md`, `ptdtt-deploy.md` và `hotfix.md` (`[FEAT-207]`, commit `643041c`).
- Bổ sung bộ duyệt cuộn dọc toàn bộ **309 kỹ thuật phẫu thuật Ngoại tiêu hóa BVBD** ngay tại Bước ① Tab Duyệt mổ (`#sap-f-catalog`) cho người dùng không nhớ từ khóa: tự động mở ngay khi chạm vào ô tìm kiếm (bảo toàn 100% focus/bàn phím di động) hoặc bấm nút `📋 Danh sách 309 kỹ thuật ▾`, hỗ trợ chip lọc nhanh theo đường mổ (`Mổ mở 191` / `Nội soi 118`) và phân hạng (`PT-ĐB`, `PT-I..III`) với `0` thẻ `<select>`, tiêu đề nhóm dính đầu khi cuộn và tìm kiếm tiếng Việt không dấu (`[FEAT-205]`, commit `e291d75`, build `v2611010920`).
- Tối ưu toàn diện UI/UX Tab Duyệt mổ tại khoa (`Crosscheck 31/10`, bảo toàn 100% logic máy chủ & cô lập Canary `sandboxOnlyMode`): hàng đợi `"Việc của tôi"` theo vai trò với 1 hàng chip lọc có số đếm, gom nhóm theo ngày mổ dính đầu trang và thẻ ca 3 dòng gọn; Drawer trượt phải 2 cột `1040px` trên Desktop / toàn màn hình 1 cột trên Mobile `390px` theo 3 bước tư duy lâm sàng tự thu gọn, khử trùng lặp Chip Bước ② sang `CK-03/05/07` (`✓ theo mục ②`), điều khiển phân đoạn 3 nấc, thanh Hoàn tác 10 giây, gợi ý 5 kỹ thuật hay dùng 90 ngày, màn Tóm tắt 1 trang BCN kèm khung vàng so sánh `Cũ → Mới` và nút `Duyệt & mở ca kế tiếp`, cùng 6 nhãn ngắn trên `Lịch mổ tuần` giảm `52,6%` số chạm ca lành tính HM và `44,4%` ca K trực tràng (`[FEAT-201]`, build `v2610312358`).
- Xác nhận hiệu lực `Quyết định 1073/QĐ-BVBD` (`12/06/2024` — chưa có văn bản thay thế) và bảng xếp cột bác sĩ chính Khoa PTĐTT năm 2026 (`KẾT QUẢ XẾP CỘT BÁC SĨ KHOA PT-ĐTT 2026.xlsx`, thời hạn 01 năm, mỗi năm Bệnh viện xếp cột lại); bổ sung kiểm soát vượt cột theo tính chất mổ: mổ chương trình & mổ yêu cầu không được phép vượt cột (`422 OVER_COLUMN_FORBIDDEN_FOR_ELECTIVE`), mổ bán khẩn do Ban Chủ nhiệm khoa cân nhắc và chỉ được phép vượt tối đa 01 cột khi không có nhân sự phù hợp (`422 OVER_COLUMN_EXCEEDS_MAX_ONE_STEP` nếu vượt từ 02 cột trở lên) (`[FEAT-200]`, build `v2610312158`).

### Fixed
- Sửa lỗi mất chữ tiêu đề banner tab Điều phối Robot trên giao diện Android (360px) và iPhone Air (420px), gia cố đồng bộ tiêu đề thanh trên cùng di động và bổ sung test hồi quy đa màn hình (BUG-247) (`[BUG-247]`, build `v2611271155`).
- Sửa lỗi tàng hình tiêu đề .page-title trên header Navy-Ocean Mobile ở cả 7 tab (gỡ -webkit-text-fill-color: transparent / background-clip: text ở chế độ <=768px, bảo toàn 100% Desktop) (BUG-240) (`[BUG-240]`, commit `65e42e0`, build `v2611212030`).
- Điều chỉnh độ rộng cột bảng Điều phối Lịch mổ Robot & Phiếu in A5 chống rớt chữ cột PTV chính, mã ca, ngày mổ và dòng tên bệnh nhân (BUG-233) (`[BUG-233]`, commit `8f81b64`, build `v2611211315`).
- Sửa sao lưu off-site bị kẹt từ 31/10: bước GitHub không còn chặn bước pull_ready (`[BUG-228]`, commit `ecbcac1`) (`[BUG-228]`).
- BUG-227: Chuẩn hóa nhãn 'Ngày nộp xét duyệt' cho Sáng kiến cải tiến (SKCT) và tái cấu trúc bảng SKCT Desktop sang bố cục 5 cột cố định (table-layout: fixed, lưới tác giả 2 cột .nckh-author-grid, dải meta-tag Khoa/Khối 1 dòng, khử lặp ghi chú Quyết định) (`[BUG-227]`, commit `c68ba5d`, build `v2611131015`).
- Chuẩn hóa toàn diện giao diện modal Thêm ca mổ trên iPhone Air (iOS WebKit) so với Android (Blink): chống tràn ngang input[type=date], nâng z-index .modal-overlay lên 1100, xóa khe hở 16px dưới .modal-footer sticky và bổ sung đồng bộ VisualViewport (.kb-open) khi mở bàn phím ảo (BUG-225, commit 95a6bbc, build v2611122040) (`[BUG-225]`).
- Khắc phục triệt để lỗi cắt cụt họ tên bệnh nhân (`Nguyễn...`, `Phạm T...`) và cắt bớt chẩn đoán/phương pháp trên thẻ Lịch mổ tuần giao diện Laptop: chuyển dòng tiêu đề thẻ sang dòng chảy văn bản tự nhiên hiển thị trọn vẹn 100% họ tên + năm sinh + huy hiệu trên cả 7 cột (`1280px..1920px`), hiển thị đầy đủ 100% loại mổ, đường mổ, thời lượng, chẩn đoán, phương pháp PT, phẫu thuật viên khi mở rộng thẻ, chống gãy dọc 3 nút thao tác và giữ nguyên trạng thái mở rộng khi lọc/đồng bộ (`[BUG-221]`, commit `4ca82ff`, build `v2611031611`).
- Khắc phục lỗi vỡ khung thẻ mổ trên lưới lịch tuần: tên bệnh nhân bị co về 0px và huy hiệu đợt mới [🔄 Đợt mới] bị biến dạng thành hình bầu dục đứng hai dòng; bổ sung flex-wrap tự nhiên, khóa min-width 50px cho tên bệnh nhân, khóa nowrap và chống co giãn cho .badge-duplicate-patient/.badge-different-patient, đồng bộ ngoặc đơn năm sinh trên view tuần (build v2611031531) (`[BUG-220]`, commit `e100c90`, build `v2611031531`).
- Khóa chặt mỗi tài khoản nhân sự chỉ kiểm thử đúng quyền thuộc vai trò cá nhân của mình (hiển thị tóm tắt quyền riêng, tự gán đúng tên bác sĩ khi tạo ca [TEST], chặn 403 mọi header giả lập từ tài khoản thường), đồng thời giữ trọn Bảng Cấu hình & Giả lập toàn bộ vị trí (kể cả Ủy quyền BCN [TEST]) dành riêng cho Super Admin trong vai trò xây dựng phần mềm (`[BUG-218]`, commit `8b91107`, build `v2611030656`).
- Gỡ bỏ khung Chạm chọn nhanh tài khoản khỏi màn hình đăng nhập và xóa API công khai /api/auth/staff-cards để mỗi nhân sự tự đăng nhập trực tiếp bằng tài khoản cá nhân của chính họ trên giao diện chuẩn gọn sạch (`[BUG-217]`, commit `9b07111`, build `v2611030526`).
- fix(surgery-approval): đối chiếu rõ Duyệt mổ nội bộ Khoa = Bước 01–04 toàn viện (HD.04.KHTH) trước Bước 05 Khám tiền mê GMHS 1 [BUG-214] (`[BUG-214]`, commit `51d06d0`, build `v2611021348`).
- Việt hóa 100% nhãn unknown_ambiguous thành Chưa chọn kỹ thuật trên thẻ ca & Bước ① Tab Duyệt mổ, đồng thời chuẩn hóa từ đồng nghĩa lâm sàng chuyên khoa ĐTT (đại tràng Sigma ↔ đại tràng chậu hông, LAR/TME, HMNT) khi tự động gợi ý Danh mục 309 kỹ thuật từ Lịch mổ tuần (`[BUG-213]`, build `v2611021316`) (`[BUG-213]`, build `v2611021316`).
- Khắc phục lỗi cắt danh sách `.slice(0, 9)` trên Bảng Kiểm Thử Super Admin (`BUG-210`): hiển thị đầy đủ 08 tài khoản **Bác sĩ học viên / BSNT** (theo Tổ đặc trách 1–2–3), **BS chính Cột III** và **Điều dưỡng trưởng (Chỉ xem)**; tự động ghim đúng BS chính & Học viên phụ trách ca đang mở trong ngăn kéo chi tiết, đồng thời hiển thị trực quan thẻ đối chiếu **Quyền được thực hiện (✅) vs Quyền bị khóa 403 (🔒)** ngay khi chuyển vai trò giả lập (`[BUG-210]`, commit `299ab3f`, build `v2611021146`).
- Mở rộng độ rộng Drawer hồ sơ Duyệt mổ trên giao diện Laptop/Desktop (`>= 960px`: `#modal.sap-drawer-right` từ `1040px` lên `min(1560px, 96vw)`, cột tóm tắt trái `.sap-left-rail` từ `280px` lên `clamp(385px, 28.5vw, 420px)` và lưới `.sap-exec-grid` cố định `2` cột rộng) giúp huy hiệu trạng thái + `TEST`, họ tên Bác sĩ mổ chính / Học viên chuẩn bị, nút điều hướng `⚡ Tóm tắt duyệt BCN` và các dòng thông tin lâm sàng nằm gọn trên 1 hàng, triệt tiêu rớt chữ đơn lẻ; bảo toàn nguyên trạng 100% bố cục Mobile (`<= 959px`) (`[BUG-206]`, commit `318bbb9`, build `v2611010935`).
- Việt hóa 100% toàn bộ mã ngữ cảnh lâm sàng (`SAP_CONTEXT_ENUM_LABELS` cho `B1..B4` gồm `stoma_management` → `"Quản lý / Đóng hậu môn nhân tạo"`, `diverticulitis_appendicitis`, `rectal_prolapse`, `right_colon`, `adenocarcinoma`, `gist_submucosal`, `recurrent_pelvic_tumor`, `mri_fistula_done`...), kênh hội chẩn cấp cứu (`phone` → `"Điện thoại trực tiếp"`), trạng thái hoãn bảng kiểm cấp cứu (`deferred_emergency`), mã hạng `unclassified` và toàn bộ 26 mã hành động trong tab `Nhật ký duyệt` (`SAP_WAL_ACTION_LABELS`) trên cả 16 kịch bản Sandbox mà không thay đổi bất kỳ dòng code máy chủ nào (`[BUG-204]`, commit `e291d75`, build `v2611010920`).
- Khắc phục triệt để lỗi chính tả biến dạng chữ hoa chữ số La Mã và từ viết tắt y khoa trong `Utils.toProperCase()` (`[Cột III Vượt 01 Cột PT-II]`, `PTNS`, `HV`, `TNT`, `GIST`, `PP`, `ESD`, `NSTH`, `CĐHA`, mã `TNM`), nhận diện đúng ranh giới sau dấu ngoặc `(`, `[`, `/` mà không làm ảnh hưởng tên riêng tiếng Việt (`[BUG-203]`, commit `84dfc26`, build `v2611010019`).
- Khắc phục triệt để lỗi nút đóng (`×`) của Drawer hồ sơ ca Duyệt mổ bị che khuất / đẩy cao lên không bấm được trên giao diện di động (`z-index: 1200` vượt lên trên `.mobile-header` `1001`, cố định `inset: 0; height: 100%` chống tràn `100dvh` trên iOS/Android, bổ sung đệm `env(safe-area-inset-top)` chống tai thỏ/Dynamic Island và gom gọn thanh hành động đáy 1 hàng) (`[BUG-202]`, commit `4a95998`, build `v2611010015`).
- Khôi phục đường truyền sao lưu xác thực qua SSH (`StrictHostKeyChecking=yes`) ngoài thư mục web, bổ sung kiểm thử giải nén `data/db.json` trong sandbox `0700` và bảo vệ bản sao lưu hợp lệ gần nhất (`LKG`) trên Local & Google Drive (`[BUG-199]`).
- Gỡ bỏ và cách ly tệp stub/pointer thừa `docs/VERSION.md`, triệt tiêu trùng lặp cấu trúc và duy trì duy nhất 01 tệp SSoT `version.md` tại gốc dự án (`[BUG-198]`, build `v2610300355`).

---

## [2.6.0] - 2026-10-29

### Added
- Bổ sung bài báo cáo khoa học "Kết quả Bệnh viện Bình Dân 10 năm đầu tiên triển khai phẫu thuật Robot tại Việt Nam" của TS.BSCKII. Nguyễn Phú Hữu và vai trò Đồng Chủ tọa đoàn Phiên 1 Chuyên đề Ngoại khoa tại HNKHKT BVĐKKV Thủ Đức 2026 (ID 36), cập nhật seed data và bump build v2611092230 (`[FEAT-224]`, build `v2611092230`).
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
- Bổ sung bài báo cáo khoa học "Kết quả Bệnh viện Bình Dân 10 năm đầu tiên triển khai phẫu thuật Robot tại Việt Nam" của TS.BSCKII. Nguyễn Phú Hữu và vai trò Đồng Chủ tọa đoàn Phiên 1 Chuyên đề Ngoại khoa tại HNKHKT BVĐKKV Thủ Đức 2026 (ID 36), cập nhật seed data và bump build v2611092230 (`[FEAT-224]`, build `v2611092230`).
- Nâng cấp giao diện Lịch mổ Robot trên thiết bị di động và trình xử lý sự kiện chúc mừng sinh nhật nhân sự (`v2608251015`).
- Hợp nhất đặc tả SSoT 6 Version Markers và hoàn thiện Báo cáo 16h Thứ 7 cùng tính năng phân công lịch tuần (`v2608231548`).

### Changed
- Tái cấu trúc các thành phần CSS và nâng kích thước vùng chạm tương tác đạt chuẩn $\ge 44\text{px}$ (`v2608221436`, `v2608221515`).

### Fixed
- Giới hạn bộ lọc thống kê phẫu thuật toàn bộ tối đa đến ngày hiện tại, ngăn đếm nhầm ca dự kiến tương lai (`v2608252103`).
- Cô lập lịch sử hoàn tác (`Undo`) theo từng tuần độc lập và kiểm tra dữ liệu trước khi lưu (`v2608221515`).
