# VERSION & BUILD LIFECYCLE SPECIFICATION — PTDTT Manager

> 📌 **Canonical SSoT:** File này là Nguồn Sự Thật duy nhất (Single Source of Truth) về kiến trúc phiên bản và quy trình bump version của PTDTT Manager.
> ⚠️ File `docs/VERSION.md` đã được hợp nhất và trỏ về file này.

---

## 1. Phân Loại 6 Version Markers Trong Hệ Thống

| # | Marker | Vị trí File | Kiểu dữ liệu / Format | Mục đích & Phạm vi tác động | Quy tắc Bump khi Phát hành |
|---|---|---|---|---|---|
| **1** | **`CACHE_NAME`** | `sw.js` (dòng 2) | String (`'ptdtt-vYYMMDDHHMM'`) | Tên Service Worker cache bucket lưu trữ static assets | **BẮT BUỘC BUMP** mỗi lần release frontend để SW kích hoạt và dọn cache cũ. |
| **2** | **`app.bundle.css?v=`** & **`js/*.js?v=`** | `index.html` (dòng 43 & footer scripts) | Query String (`?v=YYMMDDHHMM`) | Cache buster ngăn HTTP cache của browser tải asset cũ | **BẮT BUỘC BUMP** cho các bundle/script có thay đổi mã nguồn trong release. |
| **3** | **`window.REQUIRED_VER`** | `index.html` (dòng 244) | String (`'YYMMDDHHMM'`) | Định danh phiên bản frontend đang hoạt động cho app logic | **BẮT BUỘC BUMP** đồng bộ với release version tag. |
| **4** | **`CLIENT_BUILD`** | `js/store.js` (dòng 4) | Integer (`YYMMDDHHMM`) | Gửi lên backend qua HTTP header `X-Client-Build` | **BẮT BUỘC BUMP** khi có thay đổi frontend logic/store. |
| **5** | **`MIN_CLIENT_BUILD`** | `server_flask.py` / systemd | Integer (`YYMMDDHHMM`) | Ngưỡng build tối thiểu backend chấp nhận (trả HTTP 426 nếu cũ hơn) | **CHỈ BUMP** khi có breaking change trong API contract hoặc cấu trúc DB. Không bump khi release UI thông thường. |
| **6** | **`ptdtt_cache_ver`** (Emergency Migration) | `index.html` (dòng 8 trong `<head>`) | String (`'YYMMDDHHMM'`) | Script khẩn cấp nuke toàn bộ Service Worker, cache và `localStorage.removeItem('ptdtt_manager')` | **TUYỆT ĐỐI KHÔNG BUMP** trong các release UI thông thường. Chỉ bump khi phát hiện lỗi dữ liệu cục bộ nghiêm trọng cần xóa trắng DB local của client. |

---

## 2. Chuẩn Định Dạng Phiên Bản (Version Format)

```
YYMMDDHHMM (10 chữ số, không leading zero)
```
- **YY:** 2 chữ số năm (ví dụ: `26` cho năm 2026)
- **MM:** 2 chữ số tháng (`01`–`12`)
- **DD:** 2 chữ số ngày (`01`–`31`)
- **HH:** 2 chữ số giờ (`00`–`23`)
- **MM:** 2 chữ số phút (`00`–`59`)

> ⚠️ **Lưu ý kỹ thuật:** `CLIENT_BUILD` là số nguyên (Integer) trong JavaScript, không được có leading zero để tránh bị parse sai.

---

## 3. Quy Trình Bump Version Chuẩn Cho Release Candidate

Mỗi khi chuẩn bị release bản build mới (ví dụ: `NEW_VER=2608251015`):

### Bước 1: Build CSS Bundle
```bash
bash build-css.sh $NEW_VER
```

### Bước 2: Đồng Bộ Mã Nguồn Frontend (4 vị trí release)
```bash
# 1. Update CLIENT_BUILD trong js/store.js
sed -i '' "s/const CLIENT_BUILD = [0-9]*/const CLIENT_BUILD = $NEW_VER/" js/store.js

# 2. Update app.bundle.css?v= trong index.html
sed -i '' "s/app.bundle.css?v=[0-9]*/app.bundle.css?v=$NEW_VER/" index.html

# 3. Update window.REQUIRED_VER và js/?v= trong index.html
sed -i '' "s/var REQUIRED_VER = '[0-9]*'/var REQUIRED_VER = '$NEW_VER'/" index.html
sed -i '' "s/\.js?v=[0-9]*/.js?v=$NEW_VER/g" index.html

# 4. Update CACHE_NAME trong sw.js
sed -i '' "s/const CACHE_NAME = 'ptdtt-v[0-9]*'/const CACHE_NAME = 'ptdtt-v$NEW_VER'/" sw.js
```

### Bước 3: Chạy Toàn Bộ Verification Suite
- Chạy `verify-all.js` (gồm cả upgrade-path test `TC-13` từ cache cũ lên candidate mới).
- Đảm bảo 100% test cases PASS trước khi tạo biên bản nghiệm thu.

---

## 4. Lịch Sử Phiên Bản (Release Changelog)

| Version | Ngày | Phạm vi | Mô tả chi tiết |
|---|---|---|---|
| `2608252103` | 25/08/2026 | Surgery Stats | Giới hạn thống kê phẫu thuật Toàn bộ và theo kỳ tối đa đến ngày hiện tại (chặn ca tương lai lọt vào thống kê lâm sàng). |
| `2608251015` | 25/08/2026 | Full Release | Nâng cấp Lịch mổ Robot (responsive mobile cards + filter theo ngày), Birthday protocol (demo handler qua URL query & console), fix CSS canvas overlay. |
| `2608231548` | 23/08/2026 | Full Release | Báo cáo 16h Thứ 7 (22/08/2026), nâng cấp Lịch mổ & Phân công tuần, Undo isolation theo tuần, upgrade-path verification. |
| `2608221515` | 22/08/2026 | UI/Schedule | Schedule Undo multi-week isolation, peek-before-save guard, touch targets $\ge 44\text{px}$. |
| `2608221436` | 22/08/2026 | UI/CSS | Refactor CSS components, surgery metrics card updates. |
| `2606080930` | 08/06/2026 | Reports | Chuẩn hóa transitions và báo cáo print template. |
| `2606062130` | 06/06/2026 | Foundation | Đồng bộ hệ thống versioning toàn diện Phase 1.6. |
