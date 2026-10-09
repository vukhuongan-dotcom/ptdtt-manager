# BẢNG TỔNG HỢP LỖI & CÁC GIẢI PHÁP KHẮC PHỤC (BUG & RCA REGISTRY)
## Hệ thống Quản lý Chuyên môn Khoa Phẫu thuật Đại trực tràng (PTDTT Manager)

> 📌 **Canonical Project Brain Registry:** Tài liệu này là Nguồn Lưu Trữ Trí Tuệ (Project Brain) ghi nhận toàn diện 100% các sự cố kỹ thuật, lỗi phát sinh và phương án khắc phục từ khi khởi tạo dự án đến nay.
> 🤖 **Quy tắc Vận hành Tự động (Auto-Registry Mandate):** Mỗi khi phát sinh và khắc phục lỗi mới trong dự án, Agent **BẮT BUỘC** tự động cập nhật thêm dòng mới vào bảng này để hệ thống tích lũy tri thức và chống tái diễn lỗi.

---

## 📊 TỔNG QUAN THỐNG KÊ LỖI ĐÃ KHẮC PHỤC

- **Tổng số lỗi kỹ thuật đã giải quyết:** **156 lỗi** (100% đã kiểm chứng và deploy production).
- **Thời gian ghi nhận:** Từ **26/03/2026** đến **28/09/2026** (toàn bộ lịch sử mã nguồn).
- **Tỷ lệ phân bổ theo phân hệ:**
  1. **Nghiệp vụ Phẫu thuật & Thống kê lâm sàng:** ~35% (Lọc số liệu, gom nhóm ca mổ, kíp trực, phân loại mổ).
  2. **Dữ liệu, Đồng bộ & Cache Service Worker:** ~22% (Cache buster, SW migration, race condition, data version).
  3. **Giao diện UI/UX, Dark Mode & Trải nghiệm Di động:** ~24% (WCAG contrast, touch targets 44px, responsive, font).
  4. **Backend Flask, Server & Bảo mật:** ~15% (File locking, EMR proxy, JWT auth, RBAC permissions).
  5. **Báo cáo, Xuất file & Đồ họa:** ~4% (Watermark ma trận, xuất ảnh JPEG 2K, format ngày tháng).

---

## 🌟 PHẦN I: TOP 15 SỰ CỐ KIẾN TRÚC ĐIỂN HÌNH & BÀI HỌC KINH NGHIỆM (DEEP-DIVE RCAs)

### RCA-001: Xung đột ghi đồng thời (Race Condition) làm mất dữ liệu trên Gunicorn
- **Phân hệ:** `Backend / DB` | **Commit:** [`971bf60`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/971bf60)
- **Triệu chứng (Symptoms):** Khi nhiều bác sĩ/điều dưỡng cùng lưu báo cáo hoặc cập nhật lịch mổ cùng một thời điểm, dữ liệu của người này bị người kia ghi đè, gây mất thông tin ngẫu nhiên trong `db.json`.
- **Nguyên nhân gốc rễ (RCA):** Máy chủ Gunicorn chạy chế độ multi-worker (`4 workers`). Khi 2 worker cùng xử lý 2 request ghi, cả hai cùng đọc `db.json` cũ vào bộ nhớ rồi ghi đè file theo kiểu `write()`, triệt tiêu dữ liệu của nhau.
- **Giải pháp khắc phục:** Áp dụng cơ chế khóa file liên tiến trình cấp hệ điều hành bằng `fcntl.flock(f, fcntl.LOCK_EX)` trong `server_flask.py`. Mọi thao tác ghi DB bắt buộc phải sở hữu độc quyền lock trước khi ghi.

### RCA-002: Trình duyệt lưu Cache Service Worker cũ vĩnh viễn (Stale Cache Deadlock)
- **Phân hệ:** `Cache & SW` | **Commit:** [`e824d75 / eb905b6`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/e824d75 / eb905b6)
- **Triệu chứng (Symptoms):** Sau khi deploy tính năng mới hoặc fix bug lên server, điện thoại và máy tính của bác sĩ vẫn chạy phiên bản cũ nhiều tuần dù đã refresh nhiều lần.
- **Nguyên nhân gốc rễ (RCA):** Service Worker lưu cache static assets (`index.html`, `js/*.js`) theo `CACHE_NAME` tĩnh. Khi client không refresh ép buộc, Service Worker tiếp tục trả cache cũ từ Cache Storage mà không gọi mạng.
- **Giải pháp khắc phục:** 1. Thiết kế script khẩn cấp `ptdtt_cache_ver` chạy ngay trong thẻ `<head>` trước mọi script khác để unregister SW cũ và xóa sạch Cache Storage khi có build khẩn cấp.<br>2. Thêm query string phiên bản thời gian thực `?v=YYMMDDHHMM` cho mọi file JS/CSS.

### RCA-003: Client bị từ chối lưu dữ liệu hàng loạt với mã HTTP 409 Conflict
- **Phân hệ:** `Store / Versioning` | **Commit:** [`47b6bb1 / 22bb318`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/47b6bb1 / 22bb318)
- **Triệu chứng (Symptoms):** Bác sĩ thực hiện chỉnh sửa lịch mổ hoặc nhập báo cáo nhưng bấm Lưu thì nhận thông báo lỗi, backend từ chối lưu toàn bộ các thay đổi.
- **Nguyên nhân gốc rễ (RCA):** Backend `server_flask.py` có cơ chế bảo vệ `MIN_CLIENT_BUILD`. Sau đợt security hardening deploy, backend nâng `MIN_CLIENT_BUILD` nhưng frontend `js/store.js` chưa được bump `CLIENT_BUILD` tương ứng, khiến backend nhận định client là phiên bản cũ không an toàn và trả mã HTTP 409.
- **Giải pháp khắc phục:** Đồng bộ hóa quy trình bump version bắt buộc: Mỗi lần deploy phải đồng bộ cả 4 vị trí: `index.html` (REQUIRED_VER), `js/store.js` (CLIENT_BUILD), `sw.js` (CACHE_NAME), và `build-css.sh`.

### RCA-004: Biến mất các bác sĩ cơ hữu có 0 ca mổ trong Thống kê Phẫu thuật
- **Phân hệ:** `Thống kê PT` | **Commit:** [`d73ee2c`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/d73ee2c)
- **Triệu chứng (Symptoms):** Trong tab Thống kê PT, các bác sĩ cơ hữu của khoa như BS. Lê Văn Hoan, BS. Phạm Thị Tuyết Minh hoàn toàn không xuất hiện trên Bảng tổng hợp năng lực.
- **Nguyên nhân gốc rễ (RCA):** Hàm `computeDetailedStats()` trong `surgery-stats.js` chứa bộ lọc `.filter(d => d.total > 0)`. Do trong tuần khảo sát các bác sĩ này chỉ tham gia mổ phụ hoặc không đứng mổ chính, bộ lọc đã xóa sạch họ khỏi danh sách.
- **Giải pháp khắc phục:** 1. Giữ nguyên 100% 11 Bác sĩ chính và BCN khoa trong bảng tổng hợp bất kể số ca mổ chính.<br>2. Bổ sung cột và chỉ số `Mổ phụ` (`assistTotal`) để phản ánh đầy đủ khối lượng công việc lâm sàng.

### RCA-005: Các ca mổ của cùng 1 bác sĩ bị xé lẻ, không nằm liền kề trong Lịch mổ
- **Phân hệ:** `Lịch mổ` | **Commit:** [`d73ee2c`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/d73ee2c)
- **Triệu chứng (Symptoms):** Ví dụ ngày 23/09/2026, BS. Trịnh Hoàng Minh Đức có 3 ca mổ nhưng bị xếp ở hàng 11, 12 và hàng 16, xen giữa là các ca của bác sĩ khác, gây khó theo dõi.
- **Nguyên nhân gốc rễ (RCA):** Thuật toán sắp xếp cũ chỉ ưu tiên BS kíp chính ngày, các ca còn lại được sắp xếp theo thời lượng ca mổ giảm dần (`duration desc`). Do đó ca mổ ngắn 30 phút của BS. Đức bị trôi xuống sau các ca 60-120 phút của BS khác.
- **Giải pháp khắc phục:** Xây dựng thuật toán sắp xếp phân tầng 4 cấp trong `sortSurgeries(surgeries, date)`: Tầng 1 (Loại mổ) → Tầng 2 (Gom nhóm theo bác sĩ bằng `Map<docId, Surgery[]>`) → Tầng 3 (Thứ tự nhóm bác sĩ) → Tầng 4 (Thứ tự ca trong cùng 1 bác sĩ). Đảm bảo 100% các ca cùng BS nằm liền kề.

### RCA-006: Cắt cụt ca mổ dự kiến trong tuần hiện tại tại phân hệ Thống kê
- **Phân hệ:** `Thống kê PT` | **Commit:** [`254bb04`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/254bb04)
- **Triệu chứng (Symptoms):** Xem thống kê tuần hiện tại chỉ hiển thị 19 ca (thay vì 47 ca đã lên lịch đầy đủ cho cả tuần Thứ 2 đến Thứ 6).
- **Nguyên nhân gốc rễ (RCA):** Hàm `getSurgeriesInRange()` trong `surgery-stats.js` chứa điều kiện `if (this.offset <= 0 && d > todayEnd) return false;`. Khi xem tuần hiện tại (`offset = 0`), mã nguồn đã loại bỏ các ca của các ngày sau hôm nay.
- **Giải pháp khắc phục:** Gỡ bỏ điều kiện cắt cụt ngày cho các kỳ có biên giới thời gian xác định (`week`, `month`, `quarter`, `year`), chỉ áp dụng `todayEnd` cho tùy chọn xem 'Toàn bộ' (`period === 'all'`).

### RCA-007: Đụng độ mã số định danh (ID Collision 47) giữa hai nhân sự
- **Phân hệ:** `Nhân sự` | **Commit:** [`e1c5564`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/e1c5564)
- **Triệu chứng (Symptoms):** Điều dưỡng Bích Châu và BSNT Sang cùng mang ID 47 trong cơ sở dữ liệu, dẫn đến việc phân công trực và thống kê của người này bị gán sang người kia.
- **Nguyên nhân gốc rễ (RCA):** Cơ chế sinh ID cũ dùng `Math.max(...staff.map(s => s.id)) + 1` khi có nhân sự bị xóa hoặc rời khoa (`departedStaff`) không nằm trong mảng `staff` chính, dẫn đến việc cấp phát trùng ID đã tồn tại trong lịch sử.
- **Giải pháp khắc phục:** Đổi ID của ĐD Bích Châu thành 51, chuẩn hóa thuật toán tính `nextId` quét hợp nhất cả `staff` hiện tại và `departedStaff`, đồng thời tăng `DATA_VERSION = 11` để client migrate dữ liệu.

### RCA-008: Treo tìm kiếm (IME Deadlock) khi gõ tiếng Việt có dấu
- **Phân hệ:** `Tìm kiếm` | **Commit:** [`d230f62`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/d230f62)
- **Triệu chứng (Symptoms):** Khi người dùng gõ tìm kiếm bệnh nhân hoặc nhân sự bằng bộ gõ tiếng Việt (Telex/VNI), ô tìm kiếm bị khựng, mất chữ hoặc không trả về kết quả.
- **Nguyên nhân gốc rễ (RCA):** Sự kiện `input` kích hoạt re-render DOM liên tục trong lúc bộ gõ đang trong trạng thái gộp âm tiết (`compositionupdate`), làm mất focus và đứt gãy chuỗi ký tự đang gõ.
- **Giải pháp khắc phục:** Bổ sung cờ lắng nghe `compositionstart` và `compositionend`. Chỉ thực hiện lọc dữ liệu và re-render khi quá trình gõ tiếng Việt hoàn tất (`!e.isComposing`).

### RCA-009: Chữ mờ và vỡ hình khi xuất file ảnh JPEG lịch mổ / báo cáo trên iOS
- **Phân hệ:** `Xuất ảnh` | **Commit:** [`d18a419 / 65344a9`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/d18a419 / 65344a9)
- **Triệu chứng (Symptoms):** Xuất ảnh lịch mổ để gửi Zalo trên iPhone bị mờ nhạt, vỡ hạt, hoặc canvas trắng toát không tải được nội dung.
- **Nguyên nhân gốc rễ (RCA):** 1. `html2canvas` trên iOS Safari bị lỗi giới hạn bộ nhớ canvas khi độ phân giải vượt quá mức cho phép.<br>2. Lời gọi bất đồng bộ `toBlob()` kèm `setTimeout` không tương thích hoàn toàn với WebKit Safari trên iOS.
- **Giải pháp khắc phục:** Chuyển sang cơ chế export đồng bộ (synchronous export), tối ưu scale hệ số 2-3 tương ứng chuẩn màn hình Retina, và áp dụng fallback chuyển đổi trực tiếp `toDataURL('image/jpeg', 0.95)`.

### RCA-010: Lỗi ngày tháng hiển thị NaN/NaN/NaN do sai lệch múi giờ UTC/Local
- **Phân hệ:** `Báo cáo / Chung` | **Commit:** [`e326cfc / d0aab37`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/e326cfc / d0aab37)
- **Triệu chứng (Symptoms):** Các ngày phân công hoặc ngày phẫu thuật hiển thị thành `NaN/NaN/NaN` hoặc bị nhảy lùi về ngày hôm trước sau khi lưu.
- **Nguyên nhân gốc rễ (RCA):** Chuỗi ngày tháng dạng `YYYY-MM-DD` khi parse bằng `new Date('YYYY-MM-DD')` trong JavaScript mặc định coi là 00:00:00 giờ UTC. Khi chuyển sang múi giờ Việt Nam (UTC+7), thời gian có thể bị lệch hoặc trả về Invalid Date nếu chuỗi chứa định dạng không chuẩn.
- **Giải pháp khắc phục:** Viết hàm tiện ích chuẩn hóa `Utils.parseLocalDate()` tách thủ công các thành phần năm, tháng, ngày bằng `split('-')` và khởi tạo đối tượng `Date(y, m - 1, d)` theo giờ cục bộ.

### RCA-011: Lỗi độ tương phản màu chữ (Contrast) không đạt chuẩn WCAG trong Dark Mode
- **Phân hệ:** `Giao diện UI/UX` | **Commit:** [`954223c / dea8e05`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/954223c / dea8e05)
- **Triệu chứng (Symptoms):** Chế độ giao diện tối (Dark Mode) có chữ xanh lead-slot hoặc cảnh báo màu đỏ `--state-danger` trên nền thẻ card chỉ đạt tỷ lệ tương phản 3.89:1, rất khó đọc dưới ánh sáng phòng mổ.
- **Nguyên nhân gốc rễ (RCA):** Các biến màu Dark Mode được chỉnh cảm tính, chưa qua đo đạc công thức độ sáng tương đối (Relative Luminance) chuẩn WCAG 2.1.
- **Giải pháp khắc phục:** Đo lường toán học toàn bộ bảng màu, nâng tỷ lệ tương phản của toàn bộ text và badge trong Dark Mode lên $\ge 4.5:1$ (đạt chuẩn AA) và các thông số lâm sàng chính $\ge 7:1$ (đạt chuẩn AAA).

### RCA-012: Xung đột Modal Overlay bị chặn vĩnh viễn không mở được
- **Phân hệ:** `Giao diện UI/UX` | **Commit:** [`70f7176 / 0b42260`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/70f7176 / 0b42260)
- **Triệu chứng (Symptoms):** Người dùng bấm vào nút sửa ca mổ hoặc xem chi tiết bệnh nhân nhưng không có bất kỳ phản hồi nào xuất hiện trên màn hình.
- **Nguyên nhân gốc rễ (RCA):** Trong hàm `showApp()`, modal-overlay bị gán cứng thuộc tính `style.display = 'none'` nhưng khi gọi mở modal hàm mở lại không xóa thuộc tính inline này, khiến CSS class `.active` bị ghi đè.
- **Giải pháp khắc phục:** Xóa sạch thuộc tính inline `display` trên modal overlay và chuyển 100% quyền điều khiển ẩn/hiện cho class CSS chuyên biệt.

### RCA-013: Nút bấm quá nhỏ (< 44px) gây khó khăn khi thao tác trên điện thoại cảm ứng
- **Phân hệ:** `Mobile & A11y` | **Commit:** [`128ff3d / 69c5d34`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/128ff3d / 69c5d34)
- **Triệu chứng (Symptoms):** Bác sĩ thao tác trên điện thoại trong phòng mổ thường bấm nhầm nút hoặc bấm không ăn vào các nút icon nhỏ.
- **Nguyên nhân gốc rễ (RCA):** CSS cũ định nghĩa kích thước nút icon là 32×32px, vi phạm tiêu chuẩn vùng chạm tối thiểu WCAG 2.5.5 Touch Target (tối thiểu 44×44px).
- **Giải pháp khắc phục:** Quy hoạch lại toàn bộ nút icon (`.btn-icon`, nút đóng modal, nút chuyển tuần) với `min-width: 44px; min-height: 44px;` trong `base.css` và `mobile.css`.

### RCA-014: Lỗi Font tiếng Việt bị vỡ dấu trên Banner xuất ảnh
- **Phân hệ:** `Font & In ấn` | **Commit:** [`8d57e1f`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/8d57e1f)
- **Triệu chứng (Symptoms):** Khi xuất ảnh báo cáo hoặc lịch mổ, các chữ hoa có dấu đặc biệt (Ẫ, Ạ, Ệ, Ợ) bị biến dạng, nhảy font chân phương hoặc rớt dấu xuống hàng.
- **Nguyên nhân gốc rễ (RCA):** Font web Figtree không hỗ trợ đầy đủ subset `vietnamese`. Đồng thời thuộc tính `letter-spacing` can thiệp vào canvas gây lỗi ngắt ký tự ghép dấu.
- **Giải pháp khắc phục:** Thay thế sang Google Fonts hỗ trợ 100% tiếng Việt chuẩn y khoa: **Be Vietnam Pro** (cho Tiêu đề & UI) và **Noto Sans** (cho Body Text), loại bỏ `letter-spacing` trên canvas xuất ảnh.

### RCA-015: Mất phiên đăng nhập sau mỗi lần refresh trình duyệt
- **Phân hệ:** `Xác thực & Store` | **Commit:** [`d706f56 / a2bdb37`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/d706f56 / a2bdb37)
- **Triệu chứng (Symptoms):** Bác sĩ vừa đăng nhập xong, bấm F5 hoặc chuyển mạng 4G/Wifi thì bị văng ra màn hình đăng nhập lại từ đầu.
- **Nguyên nhân gốc rễ (RCA):** Hàm `Store.init()` chạy lúc khởi động ứng dụng tự động xóa key `ptdtt_session` nếu việc đồng bộ server lần đầu chưa hoàn tất (do chưa kịp gửi JWT token trong header).
- **Giải pháp khắc phục:** Tách biệt hoàn toàn tầng lưu trữ session cục bộ `localStorage` với tầng sync server. Khởi động ứng dụng bằng `Store.startAuthenticatedSync()` chỉ sau khi đã nạp phiên hợp lệ.

---

## 📋 PHẦN II: MA TRẬN TOÀN BỘ 153 SỰ CỐ & GIẢI PHÁP ĐÃ ĐƯỢC KHẮC PHỤC (1 — 153)

| STT | Mã lỗi | Ngày | Commit | Phân hệ | Tóm tắt sự cố & Giải pháp kỹ thuật đã áp dụng |
|:---:|:---:|:---:|:---:|:---:|---|
| 1 | `BUG-001` | 2026-03-26 | [`eb461b0`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/eb461b0) | **Lưu trữ & Cache SW** | Add cache-busting to all JS/CSS, fix delete by ensuring fresh code loads |
| 2 | `BUG-002` | 2026-03-27 | [`0b42260`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/0b42260) | **Lịch mổ** | delete surgery: add confirm dialog, fix Modal.close issue |
| 3 | `BUG-003` | 2026-03-31 | [`4123618`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/4123618) | **Lưu trữ & Cache SW** | sync passwords + admin status across devices via server |
| 4 | `BUG-004` | 2026-04-02 | [`d59dc2f`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/d59dc2f) | **Báo cáo 7h / 16h** | report contrast, JPEG export, auto reporter & EMR sync |
| 5 | `BUG-005` | 2026-04-02 | [`24575e2`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/24575e2) | **Tích hợp EMR** | remove emoji from canvas export, add EMR sync button in edit form |
| 6 | `BUG-006` | 2026-04-02 | [`8e9fa7b`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/8e9fa7b) | **Lưu trữ & Cache SW** | restore Vietnamese diacritics in JPEG export canvas |
| 7 | `BUG-007` | 2026-04-02 | [`e326cfc`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/e326cfc) | **Báo cáo 7h / 16h** | timezone-safe date parsing, viewDate scroll-to-report, fix NaN dates |
| 8 | `BUG-008` | 2026-04-02 | [`a06500c`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/a06500c) | **Xuất ảnh & File** | remove obsolete severePatients height from canvas, fix JPEG whitespace |
| 9 | `BUG-009` | 2026-04-02 | [`8c93671`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/8c93671) | **Lưu trữ & Cache SW** | synchronous JPEG export for mobile/PWA, remove setTimeout+toBlob |
| 10 | `BUG-010` | 2026-04-02 | [`d18a419`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/d18a419) | **Xuất ảnh & File** | cross-platform JPEG export (iOS Safari + PWA + desktop) |
| 11 | `BUG-011` | 2026-04-02 | [`41d2a00`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/41d2a00) | **Lịch mổ** | save time=latest, full surgery type names, watermark for surgery export |
| 12 | `BUG-012` | 2026-04-02 | [`ce3221d`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/ce3221d) | **Giao diện UI/UX & Mobile** | watermark full name, account footer, responsive sizing for all exports |
| 13 | `BUG-013` | 2026-04-02 | [`8539731`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/8539731) | **Lịch mổ** | robot surgery export footer with account + timestamp |
| 14 | `BUG-014` | 2026-04-02 | [`59048e2`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/59048e2) | **Xuất ảnh & File** | watermark true diagonal (bottom-left to top-right) for all exports |
| 15 | `BUG-015` | 2026-04-02 | [`3c52be7`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/3c52be7) | **Giao diện UI/UX & Mobile** | tab labels BS trực khoa / ĐD trực BV + date font Inter |
| 16 | `BUG-016` | 2026-04-02 | [`b72d69c`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/b72d69c) | **Hệ thống chung** | remove Hộ lý from 7h chips, 4-col grid layout, short names |
| 17 | `BUG-017` | 2026-04-02 | [`0ddd825`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/0ddd825) | **Giao diện UI/UX & Mobile** | exclude Thùy from ĐD list, increase chip font to 0.82rem |
| 18 | `BUG-018` | 2026-04-02 | [`269bc18`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/269bc18) | **Giao diện UI/UX & Mobile** | widen modal to 680px, fit 16h form without scroll |
| 19 | `BUG-019` | 2026-04-02 | [`0418763`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/0418763) | **Giao diện UI/UX & Mobile** | full doctor names, 3-col grid, modal 780px |
| 20 | `BUG-020` | 2026-04-02 | [`774b421`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/774b421) | **Giao diện UI/UX & Mobile** | increase 7h form font sizes, full nurse names, 3-col grid |
| 21 | `BUG-021` | 2026-04-02 | [`2ffe32a`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/2ffe32a) | **Giao diện UI/UX & Mobile** | mobile responsive - 2col chips, sticky modal footer, nav scroll indicator |
| 22 | `BUG-022` | 2026-04-02 | [`562a529`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/562a529) | **Giao diện UI/UX & Mobile** | align stat card numbers on same row with flexbox |
| 23 | `BUG-023` | 2026-04-02 | [`58a1196`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/58a1196) | **Xác thực & Bảo mật** | async login fetches fresh server data before password check - fixes admin password change not taking effect |
| 24 | `BUG-024` | 2026-04-03 | [`6cf61a6`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/6cf61a6) | **Xác thực & Bảo mật** | Phase 3: JWT Auth + Security Hardening |
| 25 | `BUG-025` | 2026-04-09 | [`65344a9`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/65344a9) | **Giao diện UI/UX & Mobile** | Export: 2K resolution (scale 3), đậm chữ, to font A4, fix cắt nội dung |
| 26 | `BUG-026` | 2026-04-10 | [`94e2e19`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/94e2e19) | **Lưu trữ & Cache SW** | cache bust v10041805, add research to SW assets |
| 27 | `BUG-027` | 2026-04-10 | [`7d523cd`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/7d523cd) | **Lưu trữ & Cache SW** | SHCM data in data.js, seed migration, cache bust v10041806 |
| 28 | `BUG-028` | 2026-04-10 | [`a342e52`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/a342e52) | **Hệ thống chung** | remove duplicate SAMPLE_SHCM causing fatal JS error |
| 29 | `BUG-029` | 2026-04-11 | [`0594cd1`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/0594cd1) | **Lưu trữ & Cache SW** | SHCM→Plans bulk sync + upload/delete API signature |
| 30 | `BUG-030` | 2026-04-11 | [`f9ee1fb`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/f9ee1fb) | **Hệ thống chung** | date dd/mm/yyyy, duration phút, location Phòng 7.14 |
| 31 | `BUG-031` | 2026-04-11 | [`faecc67`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/faecc67) | **Lưu trữ & Cache SW** | force re-sync all SHCM plans (update location+duration) |
| 32 | `BUG-032` | 2026-04-11 | [`697a35f`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/697a35f) | **Backend & Hạ tầng** | backup script robustness (no set -e, subshell git) |
| 33 | `BUG-033` | 2026-04-11 | [`bc2b0b4`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/bc2b0b4) | **Xuất ảnh & File** | SHCM PDF backup only on Google Drive |
| 34 | `BUG-034` | 2026-04-13 | [`66442bb`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/66442bb) | **Giao diện UI/UX & Mobile** | comprehensive mobile CSS — all 8 components |
| 35 | `BUG-035` | 2026-04-13 | [`111e68a`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/111e68a) | **Hệ thống chung** | SHCM date input dd/mm/yyyy format |
| 36 | `BUG-036` | 2026-04-14 | [`ed02117`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/ed02117) | **Tích hợp EMR** | EMR dual-path + non-blocking proxy + 8s timeout + localStorage |
| 37 | `BUG-037` | 2026-04-14 | [`625fce3`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/625fce3) | **Hệ thống chung** | calendar week Mon-Sun + colorblind-safe Wong palette + enhanced tooltips |
| 38 | `BUG-038` | 2026-04-14 | [`11c77c2`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/11c77c2) | **Hệ thống chung** | auto-scale Y-axis to data range for visible trends |
| 39 | `BUG-039` | 2026-04-14 | [`7268fe4`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/7268fe4) | **Lịch mổ** | avg surgery/day + annotations + remove report count card |
| 40 | `BUG-040` | 2026-04-14 | [`8b46dd9`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/8b46dd9) | **Giao diện UI/UX & Mobile** | update card annotations |
| 41 | `BUG-041` | 2026-04-15 | [`1ddaa01`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/1ddaa01) | **Tích hợp EMR** | start EMR background thread at module-level for Gunicorn + add error recovery |
| 42 | `BUG-042` | 2026-04-20 | [`e02d28a`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/e02d28a) | **Lưu trữ & Cache SW** | ops: fix duplicate logs, exclude logs/ from backup, add Drive sync mirror script |
| 43 | `BUG-043` | 2026-04-20 | [`20edd39`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/20edd39) | **Lịch trực Tuần** | reports archive/history, stale-client protection (409), saveCollections, mergeSchedules |
| 44 | `BUG-044` | 2026-04-20 | [`d0aab37`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/d0aab37) | **Nhân sự & Sơ đồ** | staff status save via saveCollections, fix UTC→local date in staff/dashboard |
| 45 | `BUG-045` | 2026-04-20 | [`ccfd33e`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/ccfd33e) | **Lịch trực Tuần** | weekly schedule via collection save, add conferences nav, bump asset versions |
| 46 | `BUG-046` | 2026-04-20 | [`2557d52`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/2557d52) | **Lưu trữ & Cache SW** | security(pha0): RBAC write APIs, lock audit endpoint, remove plaintext passwords, disable guest, env-only secrets, no API cache in SW |
| 47 | `BUG-047` | 2026-04-20 | [`22bb318`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/22bb318) | **Lưu trữ & Cache SW** | bump CLIENT_BUILD to 2004202110 to match MIN_CLIENT_BUILD |
| 48 | `BUG-048` | 2026-04-20 | [`c0f456c`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/c0f456c) | **Báo cáo 7h / 16h** | collection PUT auth for non-admin, remove conferences tab, reports use saveCollections |
| 49 | `BUG-049` | 2026-04-21 | [`400279e`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/400279e) | **Hệ thống chung** | remove ConferencesPage reference from app.js — was crashing entire app init |
| 50 | `BUG-050` | 2026-04-21 | [`3b29b1a`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/3b29b1a) | **Lịch mổ** | surgery + staff save via saveCollections, add surgeries/departedStaff/externalDoctors to WRITE_COLLECTIONS — eliminates all dangerous Store.save() calls |
| 51 | `BUG-051` | 2026-04-21 | [`d230f62`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/d230f62) | **Nhân sự & Sơ đồ** | prevent _composing deadlock in patient & staff search — IME composition interrupted by re-render caused permanent search failure |
| 52 | `BUG-052` | 2026-04-21 | [`6575316`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/6575316) | **Tích hợp EMR** | decode HTML entities in EMR patient names — &#xE0; → à, fixes search not finding Vietnamese names |
| 53 | `BUG-053` | 2026-04-22 | [`971bf60`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/971bf60) | **Lưu trữ & Cache SW** | add cross-process file locking (fcntl.flock) for db.json — prevents concurrent Gunicorn workers from overwriting each other's data |
| 54 | `BUG-054` | 2026-04-23 | [`47b6bb1`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/47b6bb1) | **Lưu trữ & Cache SW** | sync CLIENT_BUILD to match MIN_CLIENT_BUILD — all saves were silently rejected with 409 since hardening deploy |
| 55 | `BUG-055` | 2026-04-23 | [`30bdfc5`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/30bdfc5) | **Lưu trữ & Cache SW** | bump SW CACHE_NAME to force client cache invalidation |
| 56 | `BUG-056` | 2026-04-23 | [`a2bdb37`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/a2bdb37) | **Xác thực & Bảo mật** | re-sync Store from server after login — initial sync fails because no JWT exists yet during init() |
| 57 | `BUG-057` | 2026-04-24 | [`b877e78`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/b877e78) | **Lịch mổ** | unified repeating diagonal watermark via Utils.applyExportWatermark — replaces invisible single-line watermark in surgery/schedule/research exports |
| 58 | `BUG-058` | 2026-04-28 | [`ca00f98`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/ca00f98) | **Báo cáo 7h / 16h** | initialize reports16h/reports7h collections in Store.init() |
| 59 | `BUG-059` | 2026-04-28 | [`7e6f776`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/7e6f776) | **Lưu trữ & Cache SW** | P0 regression — sync-dedup, error handling, dirty collection retry |
| 60 | `BUG-060` | 2026-04-28 | [`749b47f`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/749b47f) | **Báo cáo 7h / 16h** | v2 — promise-based save tracking, better retry and error reporting |
| 61 | `BUG-061` | 2026-04-28 | [`9088e94`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/9088e94) | **Lịch trực Tuần** | async save for reports+schedule, server-confirmed UI feedback, build 2804281805 |
| 62 | `BUG-062` | 2026-04-28 | [`3c2161f`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/3c2161f) | **Xác thực & Bảo mật** | await Store.startAuthenticatedSync() before rendering dashboard |
| 63 | `BUG-063` | 2026-04-28 | [`d706f56`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/d706f56) | **Xác thực & Bảo mật** | stop Store.init() from wiping ptdtt_session, remove auth-checking overlay on showApp |
| 64 | `BUG-064` | 2026-04-28 | [`eb905b6`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/eb905b6) | **Lưu trữ & Cache SW** | bump all cache versions to 2804281740 to purge stale SW cache |
| 65 | `BUG-065` | 2026-04-28 | [`e824d75`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/e824d75) | **Lưu trữ & Cache SW** | add one-time cache migration to auto-purge stale SW caches on first load |
| 66 | `BUG-066` | 2026-04-28 | [`70f7176`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/70f7176) | **Giao diện UI/UX & Mobile** | clear inline display:none on modal-overlay in showApp — modals were permanently blocked |
| 67 | `BUG-067` | 2026-04-28 | [`7560b40`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/7560b40) | **Lưu trữ & Cache SW** | bump cache migration + app.js to 2804281755 |
| 68 | `BUG-068` | 2026-04-28 | [`95ea975`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/95ea975) | **Hệ thống chung** | update idle timeout comments from 15 min to 5 min |
| 69 | `BUG-069` | 2026-05-09 | [`a411e8d`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/a411e8d) | **Lưu trữ & Cache SW** | sync idle timeout text from 15 min to 5 min |
| 70 | `BUG-070` | 2026-05-15 | [`b1ca020`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/b1ca020) | **Lưu trữ & Cache SW** | BUG-01/02/03 — cache version, conferences module, manifest.json |
| 71 | `BUG-071` | 2026-05-15 | [`530f176`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/530f176) | **Lịch mổ** | security: 1-month items — SRI hashes + surgery audit trail |
| 72 | `BUG-072` | 2026-05-15 | [`4d98653`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/4d98653) | **Lịch mổ** | feat: lịch mổ tuần — sticky header + horizontal scroll |
| 73 | `BUG-073` | 2026-05-18 | [`3f68fcb`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/3f68fcb) | **Lịch mổ** | hiển thị đầy đủ tên bệnh nhân trong lịch mổ tuần |
| 74 | `BUG-074` | 2026-05-26 | [`9633a5e`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/9633a5e) | **Hệ thống chung** | bỏ bảng inline + bỏ badge chức vụ trên chips |
| 75 | `BUG-075` | 2026-05-26 | [`151ef27`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/151ef27) | **Báo cáo 7h / 16h** | hiện bảng chương trình inline, bỏ chip tên báo cáo viên trên card |
| 76 | `BUG-076` | 2026-05-26 | [`22bb79e`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/22bb79e) | **Hệ thống chung** | cải thiện layout xuất ảnh hội nghị |
| 77 | `BUG-077` | 2026-05-26 | [`db263c1`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/db263c1) | **Hệ thống chung** | tên file xuất ảnh theo format BaoCaoKhoaHoc_[HoiNghi]_[DDMMYYYY].jpg |
| 78 | `BUG-078` | 2026-05-26 | [`15f806b`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/15f806b) | **Hệ thống chung** | bỏ tên phiên khỏi bảng inline trên web |
| 79 | `BUG-079` | 2026-05-26 | [`66bf0a7`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/66bf0a7) | **Thống kê Phẫu thuật** | thống kê hội nghị theo thời gian thực |
| 80 | `BUG-080` | 2026-05-31 | [`447c630`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/447c630) | **Hệ thống chung** | ghi chú xuất lịch tuần giữ đúng xuống dòng và đủ nội dung |
| 81 | `BUG-081` | 2026-06-06 | [`c9e8b47`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/c9e8b47) | **Lưu trữ & Cache SW** | thêm conferences.css + conferences.js vào STATIC_ASSETS |
| 82 | `BUG-082` | 2026-06-06 | [`5ccee6d`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/5ccee6d) | **Hệ thống chung** | 3 vấn đề Claude nghiệm thu Phase 1.6 |
| 83 | `BUG-083` | 2026-06-06 | [`7aefe57`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/7aefe57) | **Hệ thống chung** | 6 issues từ backlog |
| 84 | `BUG-084` | 2026-06-06 | [`128ff3d`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/128ff3d) | **Giao diện UI/UX & Mobile** | U0: Critical fixes — stat-icon red, pulse/shake keyframes, btn-icon 44px, mobile font sizes, modal-close 44px, prefers-reduced-motion, dark mode anti-flash |
| 85 | `BUG-085` | 2026-06-06 | [`d391035`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/d391035) | **Giao diện UI/UX & Mobile** | U2 fix: theme-toggle-btn bị xóa bởi updateSidebarUser().innerHTML |
| 86 | `BUG-086` | 2026-06-06 | [`69c5d34`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/69c5d34) | **Giao diện UI/UX & Mobile** | U4 fix: Font-size WCAG audit — 10 instances < 0.72rem còn sót trong mobile.css |
| 87 | `BUG-087` | 2026-06-06 | [`67ce43d`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/67ce43d) | **Thống kê Phẫu thuật** | U5 batch-2: Extract inline styles — dashboard.js, tasks.js, surgery-stats.js |
| 88 | `BUG-088` | 2026-06-08 | [`f10ba6a`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/f10ba6a) | **Xác thực & Bảo mật** | UI: fix login title wrap — thêm text-wrap:balance cho .login-logo h1 |
| 89 | `BUG-089` | 2026-06-11 | [`6193e30`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/6193e30) | **Giao diện UI/UX & Mobile** | team card header min-height + xuất hình danh sách tổ đặc trách |
| 90 | `BUG-090` | 2026-06-11 | [`9a8682d`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/9a8682d) | **Xuất ảnh & File** | exportTeamImage — tuân thủ format chuẩn của hệ thống |
| 91 | `BUG-091` | 2026-06-11 | [`d0a5321`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/d0a5321) | **Giao diện UI/UX & Mobile** | team card name — xuống dòng tại dấu & |
| 92 | `BUG-092` | 2026-06-11 | [`aef5400`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/aef5400) | **Hệ thống chung** | xuống dòng tại dấu & trong hình xuất các tổ đặc trách |
| 93 | `BUG-093` | 2026-06-12 | [`85ae6ca`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/85ae6ca) | **Giao diện UI/UX & Mobile** | dark mode contrast + mobile theme toggle |
| 94 | `BUG-094` | 2026-06-12 | [`782d52c`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/782d52c) | **Giao diện UI/UX & Mobile** | dark mode contrast — toàn diện 4 module |
| 95 | `BUG-095` | 2026-06-12 | [`9cb0530`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/9cb0530) | **Báo cáo 7h / 16h** | dark mode contrast toàn diện — reports + research |
| 96 | `BUG-096` | 2026-06-12 | [`91e9229`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/91e9229) | **Giao diện UI/UX & Mobile** | bỏ auto theme theo OS — người dùng tự chọn theme |
| 97 | `BUG-097` | 2026-06-12 | [`33aa216`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/33aa216) | **Giao diện UI/UX & Mobile** | tương phản màu calendar events trong dark mode |
| 98 | `BUG-098` | 2026-06-12 | [`954223c`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/954223c) | **Giao diện UI/UX & Mobile** | tái đánh giá + fix contrast toàn diện round 2 |
| 99 | `BUG-099` | 2026-06-12 | [`4eba667`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/4eba667) | **Lịch trực Tuần** | tăng contrast chữ xanh lead-slot trong lịch phân công |
| 100 | `BUG-100` | 2026-06-19 | [`defbfc3`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/defbfc3) | **Giao diện UI/UX & Mobile** | mobile UX audit — WCAG 2.1 AA + Apple HIG + MD3 (19/06/2026) |
| 101 | `BUG-101` | 2026-06-19 | [`833fbfd`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/833fbfd) | **Nhân sự & Sơ đồ** | mobile layout — tab Nhân sự + tab Hội nghị |
| 102 | `BUG-102` | 2026-06-19 | [`635ef39`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/635ef39) | **Báo cáo 7h / 16h** | hội nghị mobile — hiện tên báo cáo viên xuống dòng bên dưới tiêu đề |
| 103 | `BUG-103` | 2026-07-03 | [`e09cda7`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/e09cda7) | **Lịch mổ** | xuất lịch mổ chất lượng 2K cố định, đổi PNG (lossless) |
| 104 | `BUG-104` | 2026-07-03 | [`f0b8891`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/f0b8891) | **Hệ thống chung** | toàn bộ xuất ảnh → 2K PNG (lossless) — 6 files |
| 105 | `BUG-105` | 2026-07-24 | [`7ef5787`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/7ef5787) | **Báo cáo 7h / 16h** | hiển thị tất cả hội nghị và thêm chức năng nhập bài báo cáo & báo cáo viên |
| 106 | `BUG-106` | 2026-07-24 | [`04e7971`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/04e7971) | **Lịch mổ** | nâng cấp thứ tự kiểm tra xung đột và bổ sung Modal popup khi trùng lịch mổ, trực khoa, phòng khám |
| 107 | `BUG-107` | 2026-07-24 | [`969a1bc`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/969a1bc) | **Hệ thống chung** | loại bỏ hoàn toàn việc tính xung đột giữa Siêu âm và Trực khoa |
| 108 | `BUG-108` | 2026-07-30 | [`367ad72`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/367ad72) | **Nhân sự & Sơ đồ** | khôi phục BSNT Nguyễn Đức Luân và kích hoạt tài khoản 4 BSNT từ 30/07/2026 |
| 109 | `BUG-109` | 2026-07-31 | [`231629b`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/231629b) | **Xác thực & Bảo mật** | chuẩn hóa username 6 BSNT mới theo định dạng hbsang (ndtphu, pbtkiet, ndluan, nnmkhoi, hbsang, lmthanh) |
| 110 | `BUG-110` | 2026-07-31 | [`93a2f22`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/93a2f22) | **Nhân sự & Sơ đồ** | cập nhật phòng B712 do 1 mình BSCKI Trần Như Đức phụ trách (BS điều trị chính) |
| 111 | `BUG-111` | 2026-07-31 | [`b85594a`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/b85594a) | **Lịch trực Tuần** | cập nhật phòng B708 phân công BSNT Nguyễn Ngọc Minh Khôi đi chung với BSCKII Vũ Ngọc Anh Tuấn |
| 112 | `BUG-112` | 2026-07-31 | [`8d57e1f`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/8d57e1f) | **Giao diện UI/UX & Mobile** | khắc phục triệt để lỗi font tiếng Việt (Ẫ, Ạ) trên banner xuất ảnh (bổ sung Be Vietnam Pro, Noto Sans & bỏ letter-spacing) |
| 113 | `BUG-113` | 2026-07-31 | [`71c4e77`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/71c4e77) | **Nhân sự & Sơ đồ** | bump DATA_VERSION v8 ép làm mới cache nhân sự trên tất cả các tab (Dashboard, Nhân sự, Sơ đồ phòng) |
| 114 | `BUG-114` | 2026-07-31 | [`4e54682`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/4e54682) | **Nhân sự & Sơ đồ** | chuẩn hóa chức danh BS. Học viên và badge Học viên cho BS. Phương (id 16) & BS. Tú (id 50) |
| 115 | `BUG-115` | 2026-07-31 | [`d770eaf`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/d770eaf) | **Nhân sự & Sơ đồ** | xóa badge BS cử nhân khỏi chú thích và gia hạn 9 tài khoản BSNT hoạt động đến 8g sáng 03/08/2026 |
| 116 | `BUG-116` | 2026-07-31 | [`680ee81`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/680ee81) | **Xác thực & Bảo mật** | bổ sung kiểm tra activeUntil tự động khóa tài khoản sau thời hạn |
| 117 | `BUG-117` | 2026-08-01 | [`0d3d81f`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/0d3d81f) | **Giao diện UI/UX & Mobile** | khắc phục lỗi modal hiển thị cuộn lỡ dở ở giữa form, cuộn chuẩn từ dòng 1 trên cả laptop & mobile |
| 118 | `BUG-118` | 2026-08-01 | [`b465366`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/b465366) | **Lịch mổ** | khắc phục lỗi cập nhật thời gian mổ không lưu được do lệch kiểu dữ liệu ID và kiểm tra tuần khoá |
| 119 | `BUG-119` | 2026-08-03 | [`4b47227`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/4b47227) | **Nhân sự & Sơ đồ** | sửa lỗi không lưu departedStaff khi chuyển nhân sự rời khoa và khôi phục 9 BSNT vào danh sách Rời khoa |
| 120 | `BUG-120` | 2026-08-04 | [`b2d1e06`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/b2d1e06) | **Lịch trực Tuần** | cấm lưu khi Trực Khoa trùng Mổ/Khám; cho phép lưu kèm cảnh báo * khi Trực BV trùng Mổ |
| 121 | `BUG-121` | 2026-08-04 | [`3dbf7d7`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/3dbf7d7) | **Lịch trực Tuần** | sửa lỗi cú pháp JS trong schedule.js khiến website không load được và nâng cấp cache ver |
| 122 | `BUG-122` | 2026-08-04 | [`e1c5564`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/e1c5564) | **Nhân sự & Sơ đồ** | khắc phục trùng ID 47 giữa Châu & Sang, cập nhật ID Châu thành 51, tính nextIds động và tăng DATA_VERSION v11 |
| 123 | `BUG-123` | 2026-08-04 | [`cc1b154`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/cc1b154) | **Lịch mổ** | chỉ tính slot 0 (BS Trực chính Khoa) là Trực Khoa cấm trùng lịch mổ, bỏ cảnh báo sai cho slot 1, 2, 3 |
| 124 | `BUG-124` | 2026-08-04 | [`cdd9e9f`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/cdd9e9f) | **Lịch trực Tuần** | loại bỏ quét EMR surgeries ngầm, kiểm tra xung đột chuẩn 100% trực tiếp giữa các vị trí phân công trên Bảng Phân Công Tuần |
| 125 | `BUG-125` | 2026-08-04 | [`cad768a`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/cad768a) | **Lịch mổ** | thêm Store.getStaffName, bổ sung nút Thùng rác vào toolbar + Toast hoàn tác nhanh, tối ưu responsive trên mobile |
| 126 | `BUG-126` | 2026-08-08 | [`f6a126b`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/f6a126b) | **Giao diện UI/UX & Mobile** | Remove Top Utility Bar v2608080808 |
| 127 | `BUG-127` | 2026-08-08 | [`0840a8e`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/0840a8e) | **Lịch mổ** | feat(schedule): Update trainees assignment rules for Saturday surgery & fixed department duty v2608080819 |
| 128 | `BUG-128` | 2026-08-08 | [`3daf7a2`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/3daf7a2) | **Lịch trực Tuần** | feat(schedule): Set fixed Lead Doctors for Department Duty v2608080822 |
| 129 | `BUG-129` | 2026-08-08 | [`1e17187`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/1e17187) | **Lịch trực Tuần** | feat(schedule): Protect fixed positions on copy & add Undo feature v2608080831 |
| 130 | `BUG-130` | 2026-08-08 | [`ab7e54c`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/ab7e54c) | **Lịch trực Tuần** | feat(schedule): Update clearSchedule to preserve fixed positions v2608080837 |
| 131 | `BUG-131` | 2026-08-08 | [`86f2fac`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/86f2fac) | **Lịch trực Tuần** | feat(schedule): Protect 100% fixed positions on copyFromPrevWeek v2608080843 |
| 132 | `BUG-132` | 2026-08-08 | [`26e1ca2`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/26e1ca2) | **Lịch trực Tuần** | feat(schedule): Populate and protect fixed clinic schedule v2608080853 |
| 133 | `BUG-133` | 2026-08-08 | [`3874ae9`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/3874ae9) | **Lịch trực Tuần** | feat(schedule): Prevent copying previous week clinic data over fixed clinic positions v2608080858 |
| 134 | `BUG-134` | 2026-08-08 | [`9918da1`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/9918da1) | **Lịch trực Tuần** | feat(schedule): Fix BCN and main surgeon slot 0 schedule & protect all fixed slots v2608080938 |
| 135 | `BUG-135` | 2026-08-08 | [`c5a2e7a`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/c5a2e7a) | **Lịch trực Tuần** | Correct main surgeon slot 0 schedule (Huu T2/T5, Tuan T3, An T4, Hau T6) v2608080941 |
| 136 | `BUG-136` | 2026-08-08 | [`6c254dd`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/6c254dd) | **Hệ thống chung** | Standardize date display format to dd.mm.yyyy across all views v2608081014 |
| 137 | `BUG-137` | 2026-08-09 | [`3a77f11`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/3a77f11) | **Lịch mổ** | Restore Robot Surgery assignment table on weekly schedule page v2608091314 |
| 138 | `BUG-138` | 2026-08-09 | [`edc708d`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/edc708d) | **Lịch trực Tuần** | Make Xuất lịch tuần button export ONLY the weekly schedule image v2608091328 |
| 139 | `BUG-139` | 2026-08-10 | [`43ef33c`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/43ef33c) | **Lịch trực Tuần** | Unlock weekly schedule editing for the current week v2608101001 |
| 140 | `BUG-140` | 2026-08-10 | [`2a198ad`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/2a198ad) | **Lịch trực Tuần** | Do not copy nurse (trucDD) and nursing aide (trucHL) duties when copying previous week schedule starting from week 2026-08-10 v2608101010 |
| 141 | `BUG-141` | 2026-08-10 | [`7eed62f`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/7eed62f) | **Lịch trực Tuần** | Remove schedule editing permission from Dr. Vĩnh Phú account (staffId 7) v2608101445 |
| 142 | `BUG-142` | 2026-08-16 | [`7059c5e`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/7059c5e) | **Giao diện UI/UX & Mobile** | sửa lỗi chính tả Xoà thành Xoá đồng bộ toàn bộ ứng dụng v2608161144 |
| 143 | `BUG-143` | 2026-08-16 | [`02fd906`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/02fd906) | **Xác thực & Bảo mật** | adjust login form spacing and lower login button position for balanced vertical rhythm v2608161316 |
| 144 | `BUG-144` | 2026-08-16 | [`98ee7b2`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/98ee7b2) | **Thống kê Phẫu thuật** | fix classifySurgery syntax and renderCurrentPage animation (v2608161817) |
| 145 | `BUG-145` | 2026-08-16 | [`41e3ace`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/41e3ace) | **Thống kê Phẫu thuật** | precision clinical classification algorithm for all 6 axes (v2608161840) |
| 146 | `BUG-146` | 2026-08-16 | [`5c1e5e7`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/5c1e5e7) | **Thống kê Phẫu thuật** | resolve numSurgeons is not defined error (v2608161857) |
| 147 | `BUG-147` | 2026-08-21 | [`c3c56fb`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/c3c56fb) | **Hệ thống chung** | resolve key property error on trend month filters (v2608211236) |
| 148 | `BUG-148` | 2026-08-21 | [`dea8e05`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/dea8e05) | **Giao diện UI/UX & Mobile** | fix dark mode rendering for spline line, total labels, legend dots and donut SVG (v2608212151) |
| 149 | `BUG-149` | 2026-08-21 | [`81609b1`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/81609b1) | **Hệ thống chung** | fix input box width and layout in default time and duration settings v2608212232 |
| 150 | `BUG-150` | 2026-08-22 | [`c4b8baf`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/c4b8baf) | **Hệ thống chung** | cập nhật số liệu BN hiện diện và buồng bệnh luôn lấy từ BC 16h hoặc 7h gần nhất v2608221058 |
| 151 | `BUG-151` | 2026-08-25 | [`771f760`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/771f760) | **Thống kê Phẫu thuật** | giới hạn thống kê phẫu thuật toàn bộ tối đa đến ngày hiện tại v2608252103 |
| 152 | `BUG-152` | 2026-09-22 | [`254bb04`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/254bb04) | **Thống kê Phẫu thuật** | include projected week surgeries in current period without todayEnd cutoff (v2609221220) |
| 153 | `BUG-153` | 2026-09-22 | [`d73ee2c`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/d73ee2c) | **Thống kê Phẫu thuật** | include all department doctors, add assist surgery stats, and group radar dropdown (v2609221246) |
| 154 | `BUG-154` | 2026-09-28 | [`fea1bfe`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/fea1bfe) | **Lịch mổ & Cảnh báo** | Phát hiện trùng ca mổ thông minh 5 cấp độ, hợp đồng dời ca bảo toàn ID/audit/isFirstCase, sub-dialog bảo toàn form/draft, phân biệt mổ nhiều thì vs trùng tên, và bổ sung Utils.escapeHtml (v2609281105) |
| 155 | `BUG-155` | 2026-10-03 | [`822e2ea`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/822e2ea) | **Giao diện & Nhận diện** | Khôi phục logo khoa đầy đủ chữ (img/logo-khoa.jpg) trên Sidebar và Mobile Header, loại bỏ biến thể rút gọn logo-mark.png (v2610031758) |
| 156 | `BUG-156` | 2026-10-04 | [`23e4677`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/23e4677) | **Giao diện & Tương phản** | Khắc phục triệt để lỗi không thấy chữ chế độ sáng (tàng hình do thiếu biến --accent-hover trong linear-gradient), rà soát định nghĩa 100% CSS vars (--accent-hover, --bg-card, --text, --primary-color, --border-color), chuẩn hóa WCAG AA cho toàn bộ badge, pill, tag và avatar (v2610041055) |
| 157 | `BUG-157` | 2026-10-04 | [`d14a2c7`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/d14a2c7b467f9282a44836afda928556b40ec6ad) | **Nhận diện & Màu sắc** | Chuyển đổi màu loại mổ 'Yêu cầu' từ nâu hổ phách (#BF7900) sang màu vàng tươi (#FFC107), đảm bảo độ tương phản WCAG AAA (10.65:1) với chữ Navy (#111542), đồng bộ toàn bộ CSS tokens, JS fallbacks, summary chips, tags, badges và tooltips (v2610041106) |
| 158 | `FEAT-158` | 2026-10-09 | [`14e98cb`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/14e98cb) | **Nhân sự & Nhận diện** | Cập nhật hình ảnh nhận diện thực tế cho 29 nhân sự đang công tác theo ID (img/staff/<id>.webp & <id>-lg.webp), bảo toàn huy hiệu chữ viết tắt cho 10 nhân sự đã chuyển đi, chuẩn hóa Utils.renderAvatar trên 9 module, bổ sung modal phóng to ảnh chuẩn ARIA dialog và responsive 1440/390 (v2610091653) |
| 159 | `BUG-159` | 2026-10-09 | [`49fad78`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/49fad78) | **Nhân sự & Nhận diện** | Khắc phục triệt để lỗi hoán đổi ảnh các cặp nhân sự liền kề do Word OpenXML tuần tự hóa ảnh cột phải trước ảnh cột trái. Định vị chính xác tọa độ hoành độ X (pos_h) của 40 drawings trong DOCX để ghép chuẩn xác 100% cho toàn bộ 29 nhân sự (v2610091710) |
| 160 | `FEAT-160` | 2026-10-09 | [`1c85e2e`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/1c85e2e) | **Nhân sự & Nhận diện** | Khắc phục ảnh nhòe bằng xuất 1:1 không phóng đại (WebP q92/q90), giới hạn max-height theo pixel gốc; triển khai album ảnh chỉ ở tab Nhân sự với điều hướng phím ←/→, vuốt cảm ứng, nút chuyển navy-950, cập nhật tại chỗ DOM chống XSS và bộ đếm động theo bộ lọc/tìm kiếm (v2610091740) |
| 161 | `BUG-161` | 2026-10-09 | [`7ddd56f`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/7ddd56f) | **Hạ tầng & Phân quyền VPS** | Khắc phục sự cố mất số liệu Dashboard (HTTP 500 trên /api/data) do lệnh chown nhầm sang www-data khiến tiến trình Flask (user ptdtt) bị PermissionError [Errno 13] trên .db.lock và .gunicorn.ctl. Đồng bộ quyền ptdtt:www-data (chmod 775), thêm ptdtt vào nhóm www-data, sửa triệt để auto-deploy.sh và setup.sh, cập nhật cảnh báo vào quy trình deploy.md (BUG-161) |
| 162 | `FEAT-162` | 2026-10-09 | [`0fac989`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/0fac989) | **Nhân sự & Tổ đặc trách** | Kiện toàn Tổ Truyền thông với 8 nhân sự nòng cốt (TS. BSCKII Nguyễn Phú Hữu - Tổng phụ trách; BSCKII Vũ Khương An - Quản lý nội dung & Fanpage; BSCKI Trịnh Hoàng Minh Đức - Fanpage; BSCKI Phạm Vĩnh Phú & BSCKI Phạm Thị Tuyết Minh - Zalo; Ths.ĐD Nguyễn Thị Ngọc Thùy, CNĐD Huỳnh Kim Xuân Hằng, ĐDCKI Trần Phương Quan - CLB HMNT), cập nhật CSS white-space: pre-line cho ghi chú nhiều dòng, chuyển đổi input ghi chú sang textarea tiện dụng và hỗ trợ xuất ảnh danh sách (v2610091755) |
| 163 | `FEAT-163` | 2026-10-09 | [`86c52ec`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/86c52ec) | **Nhân sự & Phân cấp vai trò** | Sắp xếp danh sách nhân sự theo phân cấp vai trò lâm sàng chuẩn (BCN khoa [Trưởng khoa -> Phó trưởng khoa -> ĐD Trưởng] -> Bác sĩ chính [9 BS] -> Bác sĩ học viên & BSNT [8 BS] -> Điều dưỡng [14 ĐD] -> Hộ lý [3 HL] -> Thư ký y khoa [1 TK]), gom nhóm liền mạch thay vì rải rác theo thứ tự tạo ID trong database; tích hợp hàm Utils.getStaffRoleRank và Utils.sortStaffByRole xuyên suốt hiển thị Desktop, Mobile, xuất Excel và chọn nhân sự tổ đặc trách (v2610091805) |

---

## 🛡️ PHẦN III: QUY CHUẨN TỰ ĐỘNG GHI NHẬN LỖI (SOP CONTINUOUS LEARNING)

Để đảm bảo hệ thống không bao giờ lặp lại các sai lầm cũ:
1. **Kích hoạt tự động:** Mỗi khi Agent hoàn tất điều chỉnh một lỗi (bug fix) trong dự án `ptdtt-manager`, Agent **BẮT BUỘC** tự động mở file này và chèn thêm 1 hàng mới vào cuối Bảng Ma Trận.
2. **Định dạng chuẩn:** Gồm STT tiếp theo (`BUG-154`, `BUG-155`...), Ngày, Commit Hash, Phân hệ, Triệu chứng, Nguyên nhân gốc rễ và Giải pháp xử lý.
3. **Đồng bộ song hành:** Cập nhật đồng thời tại:
   - `PROJECT_CONTEXT/BANG_TONG_HOP_LOI_VA_KHAC_PHUC.md`
   - `docs/BUG_FIX_REGISTRY.md`
