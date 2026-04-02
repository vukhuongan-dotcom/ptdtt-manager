# PROJECT CONTEXT — PTDTT Manager (Phần 2: UX Upgrade + Security)

> **Mục đích file này**: Context cho Agent AI, tiếp nối [PROJECT_CONTEXT_P1.md](./PROJECT_CONTEXT_P1.md) (Phần 1).
> **Cuộc trò chuyện gốc**: `a4193c67` — "Implementing Daily Report Module"
> **Xem trước**: [PROJECT_CONTEXT_P1.md](./PROJECT_CONTEXT_P1.md) — Phần 1: Nền tảng
> Khi muốn tiếp tục dự án, paste: _"Đọc PROJECT_CONTEXT_P1.md và PROJECT_CONTEXT_P2.md trong folder PROJECT_CONTEXT của ptdtt-manager rồi tiếp tục"_

---

## 1. Tổng quan Phần 2

Phần 2 triển khai **UX Audit + Nâng cấp** dựa trên đánh giá Nielsen Heuristics & SUS benchmark. Chia 4 phase, hiện đã hoàn thành Phase 1-2, đang triển khai Phase 3.

- **SUS Score ban đầu**: ~72.5/100 (Grade B — "Tốt")
- **Mục tiêu**: ≥ 80 (Grade A)

---

## 2. Các file MỚI so với Phần 1

### JS modules mới (+5 files)
```
js/
├── search.js         # Global search (⌘K/Ctrl+K), Spotlight-style
├── onboarding.js     # Interactive tour 7 bước cho first-time users
├── reports.js        # Module Báo cáo hàng ngày (7h + 16h)
├── audit-log.js      # Lịch sử hoạt động (audit trail)
└── xlsx.full.min.js  # SheetJS library cho Export Excel
```

### CSS files mới (+4 files)
```
css/
├── search.css        # Search overlay UI
├── onboarding.css    # Tour spotlight + tooltip
├── reports.css       # Report page styling
├── charts.css        # Trend chart styling
└── toast.css         # Toast notification component
```

### Files gốc mới (+4 files)
```
ptdtt-manager/
├── manifest.json               # PWA config (installable app)
├── sw.js                       # Service Worker (offline mode)
├── huong_dan_bao_cao.html      # Trang hướng dẫn báo cáo (standalone)
├── Huong_dan_bao_cao_Khoa_PTDTT.pdf  # PDF hướng dẫn
└── img/
    ├── icon-192.png            # PWA icon
    └── icon-512.png            # PWA icon
```

### Backend nâng cấp
```
server_flask.py  # Flask version — nâng cấp đáng kể:
  - /api/data GET/PUT: CRUD data (db.json)
  - /api/audit: Audit log endpoint
  - /api/auth: Login/logout/me (JWT + bcrypt) ← đang triển khai
  - Auto backup trước khi save
  - Audit logging middleware
```

---

## 3. Tính năng đã hoàn thành (Phần 2)

### Phase 1 — Quick Wins ✅
- [x] Toast notifications (thay thế `alert()`)
- [x] Confirm dialogs nâng cao (double-confirm cho destructive actions)
- [x] Loading states (skeleton + spinner)
- [x] Form validation (inline messages)
- [x] "Cập nhật lúc" timestamp trên data cards

### Phase 2 — Core UX ✅
- [x] **Trend Charts**: Biểu đồ xu hướng PT 6 tháng (Canvas API, bezier curves)
- [x] **Export Excel**: Surgery stats + Staff → workbook multi-sheet (SheetJS)
- [x] **Global Search** (⌘K): Spotlight-style, tìm cross-module, Vietnamese normalization
- [x] **Onboarding Tour**: 7 bước interactive, auto-start first-time
- [x] **PWA**: manifest.json + Service Worker → installable trên mobile
- [x] **Offline Mode**: Cache-first static, network-first API, offline banner

### Phase 3 — Security & Infrastructure (đang triển khai)
- [x] **Audit Logging**: Middleware log mọi PUT/DELETE, UI "Lịch sử hoạt động" (superadmin)
- [x] **Module Báo cáo hàng ngày** (reports.js): Form 7h + 16h, auto-fill từ surgery data
- [ ] **Server-side Authentication**: JWT + bcrypt (đang code)
    - [x] Backend endpoints: login, logout, me, password (server_flask.py)
    - [ ] Frontend: Cập nhật auth.js dùng server API
    - [ ] Frontend: store.js gửi JWT trong headers
    - [ ] JWT middleware protect API routes
    - [ ] Deploy và test
- [ ] **Database Migration**: JSON → SQLite
    - [ ] Design schema
    - [ ] Migration script
    - [ ] Update server_flask.py
    - [ ] Deploy

### Phase 4 — Advanced (chưa bắt đầu)
- [ ] Dashboard tùy chỉnh (drag-drop widgets)
- [ ] WebSocket real-time collaboration
- [ ] AI-powered insights
- [ ] Push Notifications

---

## 4. Module Báo cáo hàng ngày (reports.js — 85KB)

Module lớn nhất, cần đặc biệt lưu ý:

### Chức năng
- **Form 7h sáng**: Báo cáo đầu ngày (BN tổng, mổ chưa về, nhập/xuất viện, BN nặng, kế hoạch mổ)
- **Form 16h chiều**: Cập nhật cuối ngày (BN đi-về, diễn biến nặng, PT trong ngày chi tiết)
- **Auto-fill**: Tự điền số liệu từ surgery data trong store
- **Xem lịch sử**: Danh sách báo cáo đã nộp theo ngày
- **Copy text**: Copy nội dung báo cáo dạng text để paste vào group chat

### Mobile UI fixes đã làm
- Form 16h: Grid 2 cột thay vì 3 cột trên mobile (tên BS bị cắt)
- Modal: Sticky footer cho nút Lưu/Huỷ
- Bottom nav: Fade gradient cho scroll indicator
- Stat cards: Grid wrap 3+2 trên mobile
- Stepper buttons: Touch target lớn hơn

---

## 5. Kiến trúc cập nhật (so với Phần 1)

### Data flow (cập nhật)
```
Browser localStorage ←→ store.js ←→ UI modules
                          ↕ (polling 10s)
                    server_flask.py ←→ db.json (file)
                          ↕
                    EMR BV Bình Dân (emr.com.vn:83)
```

### Deploy flow (cập nhật)
```
Local (Google Drive) → git push → Cron auto-deploy mỗi phút → VPS → Nginx → khoaptdtt.info.vn
```

### Auth flow (đang chuyển đổi)
```
Hiện tại: Client-side password check (data.js) → localStorage session
Mục tiêu: POST /api/auth/login → JWT token → Bearer header → server verify
```

---

## 6. UX Audit Scores (tham khảo)

| Nielsen Heuristic | Trước | Sau Phase 2 |
|---|---|---|
| H1 Visibility of System Status | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (toast, loading, timestamps) |
| H2 Match System ↔ Real World | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| H5 Error Prevention | ⭐⭐ | ⭐⭐⭐ (validation, confirm) |
| H7 Flexibility & Efficiency | ⭐⭐⭐ | ⭐⭐⭐⭐ (⌘K search, export) |
| H9 Error Recovery | ⭐⭐ | ⭐⭐⭐ (toast, offline banner) |
| H10 Help & Documentation | ⭐ | ⭐⭐⭐ (onboarding tour) |
| **SUS Score** | **~72.5** | **~78** (ước tính) |

---

## 7. Lệnh thường dùng (cập nhật)

```bash
# Deploy lên production (auto-deploy qua git)
git add -A && git commit -m "message" && git push

# Hoặc deploy thủ công
bash deploy/auto-deploy.sh

# Chạy local (Flask version — khuyến nghị)
python3 server_flask.py

# SSH vào server
ssh root@180.93.138.83

# Kiểm tra audit log trên server
cat /var/www/ptdtt-manager/data/audit.log | tail -20

# Restart service
systemctl restart ptdtt
```

---

## 8. Lưu ý khi code (bổ sung)

- **reports.js** là module lớn nhất (~85KB) — cẩn thận khi sửa, chia nhỏ edit
- **server_flask.py** đã nâng lên ~24KB, có audit middleware
- **Version cache**: bump `?v=DDMMHHMM` trên tất cả CSS/JS includes trong index.html khi deploy
- **SheetJS** (xlsx.full.min.js) = 945KB — đã include trực tiếp, không dùng CDN
- **PWA**: Khi thay đổi file static, cần update `CACHE_VERSION` trong sw.js
- **Audit trail**: Mọi PUT/DELETE request được log vào `/data/audit.log` trên server
- **Mobile testing**: Dùng viewport 390×844 (iPhone 14 Pro) cho responsive

---
---

# PHỤ LỤC: BÁO CÁO ĐÁNH GIÁ UX & CHIẾN LƯỢC NÂNG CẤP
## Website Quản lý Khoa Phẫu thuật Đại trực tràng — Bệnh viện Bình Dân
### https://khoaptdtt.info.vn

> Ngày đánh giá: 30/03/2026
> Phương pháp: Evidence-based, Data-driven Analysis
> Khung đánh giá: Nielsen's 10 Heuristics + SUS Benchmark + HIMSS Stage Model

---

## A1. Hiện trạng hệ thống

### A1.1 Kiến trúc kỹ thuật

| Thông số | Chi tiết |
|---|---|
| **Kiến trúc** | Single-Page Application (SPA) — Vanilla JS |
| **Backend** | Python Flask (server_flask.py) với JSON file storage |
| **Hosting** | VPS Ubuntu 24.04 trên Tino.vn (180.93.138.83) |
| **Triển khai** | GitHub → Cron auto-deploy mỗi phút |
| **Codebase** | 17 JS modules (~270KB), 17 CSS files (~76KB) |
| **Storage** | localStorage (client) + JSON file (server) — KHÔNG dùng database |
| **Authentication** | Client-side password check, localStorage sessions |

### A1.2 Modules hiện có

| Module | Chức năng | Mức hoàn thiện |
|---|---|---|
| **Dashboard** (Tổng quan) | KPIs, thống kê PT tuần/tháng, trực hôm nay | ⭐⭐⭐⭐ |
| **Staff** (Nhân sự) | Danh sách 40 NV, lọc theo vai trò, tìm kiếm | ⭐⭐⭐⭐ |
| **Staff Tracking** (Theo dõi NV) | Trạng thái nhân viên theo ngày | ⭐⭐⭐ |
| **Rooms** (Phòng bệnh) | Sơ đồ 11 phòng, 73 BN, BS phụ trách | ⭐⭐⭐⭐⭐ |
| **Tasks** (Công việc) | Kanban board 3 cột | ⭐⭐⭐ |
| **Plans** (Kế hoạch) | Lịch kế hoạch tháng | ⭐⭐⭐ |
| **Patients** (Bệnh nhân) | Danh sách BN điều trị | ⭐⭐⭐ |
| **Schedule** (Lịch mổ tuần) | Timeline 7 ngày, phân loại PT, xuất hình | ⭐⭐⭐⭐⭐ |
| **Surgery Stats** (Thống kê PT) | Tuần/tháng/quý/năm, theo BS mổ chính | ⭐⭐⭐⭐ |
| **Notifications** (Thông báo) | In-app notifications | ⭐⭐⭐ |

---

## A2. Khung đánh giá & Tham chiếu chuẩn

### A2.1 Khung đánh giá sử dụng

| Khung | Mục đích | Nguồn |
|---|---|---|
| **Nielsen's 10 Usability Heuristics** | Đánh giá UX chuyên sâu qua 10 tiêu chí | Nielsen Norman Group (1994, updated 2020) |
| **System Usability Scale (SUS)** | Điểm benchmark so sánh với ngành | Brooke (1996), SUS benchmark = 68/100 |
| **HIMSS Stage Model** | Đánh giá trưởng thành CNTT y tế | HIMSS Analytics (2024) |
| **Google Lighthouse** | Đánh giá kỹ thuật web (Performance, SEO, A11y) | Google (2024) |
| **IEC 62366** | Tiêu chuẩn Usability Engineering cho thiết bị y tế | ISO/IEC |

### A2.2 SUS Benchmark cho Healthcare Apps

| Loại ứng dụng | SUS trung bình | Nguồn |
|---|---|---|
| **Tất cả phần mềm** (toàn cầu) | 68 | Bangor et al., 2008 |
| **Digital Health Apps** (tổng hợp) | 70.5 | JMIR Meta-analysis, 2024 |
| **Clinical Management Systems** | 62–72 | ResearchGate reviews |
| **Mục tiêu "Tốt"** | ≥ 72 | — |
| **Mục tiêu "Xuất sắc"** | ≥ 85 | — |

### A2.3 Quy mô đánh giá (Rating Scale)

| Điểm | Đánh giá | Mô tả |
|---|---|---|
| ⭐⭐⭐⭐⭐ | Xuất sắc | Vượt trội so với chuẩn ngành |
| ⭐⭐⭐⭐ | Tốt | Đạt chuẩn, có vài điểm cần cải thiện nhỏ |
| ⭐⭐⭐ | Trung bình | Hoạt động nhưng cần cải thiện rõ ràng |
| ⭐⭐ | Yếu | Ảnh hưởng đáng kể đến trải nghiệm |
| ⭐ | Kém | Cần sửa ngay lập tức |

---

## A3. Phân tích đối thủ & Giải pháp tương tự

### A3.1 So sánh với giải pháp HIS tại Việt Nam

| Tính năng | **khoaptdtt.info.vn** | **FPT eHospital** | **Viettel HIS** | **NANO Hospital** |
|---|---|---|---|---|
| **Quản lý nhân sự khoa** | ✅ Tốt | ✅ Toàn BV | ✅ Toàn BV | ✅ |
| **Sơ đồ phòng bệnh** | ✅ Trực quan | ⚠️ Cơ bản | ⚠️ Cơ bản | ✅ |
| **Lịch mổ tuần** | ✅ Chuyên biệt | ✅ Tích hợp OR | ✅ | ❌ |
| **Thống kê PT** | ✅ Tuần/tháng/quý | ✅ Nâng cao + BI | ✅ | ⚠️ |
| **Kanban công việc** | ✅ | ❌ | ❌ | ❌ |
| **Bệnh án điện tử (EMR)** | ❌ | ✅ Đầy đủ | ✅ Đầy đủ | ✅ |
| **Kết nối BHYT** | ❌ | ✅ | ✅ | ✅ |
| **Database backend** | ❌ JSON file | ✅ Oracle/MySQL | ✅ PostgreSQL | ✅ |
| **Multi-user realtime** | ⚠️ Polling 10s | ✅ WebSocket | ✅ | ✅ |
| **PWA/Offline** | ✅ | ⚠️ | ❌ | ❌ |
| **Chi phí** | Miễn phí | >500M VNĐ/năm | >300M VNĐ/năm | >200M VNĐ/năm |

### A3.2 Giải pháp quốc tế tương đương

| Giải pháp | Đặc điểm nổi bật | Học hỏi được |
|---|---|---|
| **Epic OpTime** | Quản lý phòng mổ hàng đầu thế giới, scheduling algorithm | Thuật toán xếp lịch tự động |
| **MEDITECH Expanse** | Clinical documentation, care coordination | Giao diện clinician-centric |
| **Qventus** | AI-powered surgical scheduling | Dự đoán volume, tối ưu OR time |
| **AvaSure** | Real-time monitoring, dashboard analytics | Data visualization patterns |

### A3.3 Lợi thế cạnh tranh của khoaptdtt.info.vn

Website hiện tại có **lợi thế cạnh tranh độc đáo** mà các HIS lớn KHÔNG có:
- **Chuyên biệt cho 1 khoa** → UX tối ưu, không thừa tính năng
- **Chi phí = 0** (VPS ~200K/tháng)
- **Tự chủ 100%** → thay đổi tức thì, không phụ thuộc vendor
- **Sơ đồ phòng bệnh visual** → trực quan hơn mọi HIS lớn
- **Kanban công việc** → workflow riêng không HIS nào có

---

## A4. Đánh giá chi tiết theo Nielsen Heuristics

### H1. Visibility of System Status ⭐⭐⭐⭐
**Dashboard hiển thị tốt các KPIs quan trọng** — Nhân sự, BN đang điều trị, PT trong tuần, Trực hôm nay.

| Điểm mạnh | Gap |
|---|---|
| ✅ Real-time sync indicator (green dot) | ❌ Không có loading state rõ ràng khi chuyển page |
| ✅ Badge counts trên sidebar | ❌ Thiếu timestamp "cập nhật lúc..." trên data cards |
| ✅ Color-coded tags | ❌ Không có toast notification khi save thành công |

### H2. Match Between System and Real World ⭐⭐⭐⭐⭐
**Xuất sắc nhất.** Thuật ngữ, layout hoàn toàn phản ánh workflow thực tế của khoa:
- Sơ đồ phòng bệnh = đúng layout vật lý (B705→B718, Tầng 7, Tòa B)
- Phân loại PT = Chương trình / Yêu cầu / Bán khẩn / Robot / Mổ mở / Nội soi
- Vai trò NV = BSCKI, BSCKII, TS, ĐD, Hộ lý, Thư ký

### H3. User Control and Freedom ⭐⭐⭐
| Điểm mạnh | Gap |
|---|---|
| ✅ Sidebar navigation rõ ràng, dễ quay lại | ❌ Không có Undo/Redo khi thao tác sai |
| ✅ Bộ lọc (tabs) để lọc dữ liệu | ❌ Không có breadcrumb navigation |
| | ❌ Confirm dialog trước khi xóa chưa đầy đủ |

### H4. Consistency and Standards ⭐⭐⭐⭐
| Điểm mạnh | Gap |
|---|---|
| ✅ Hệ thống design tokens nhất quán (CSS variables) | ⚠️ Một số button styles chưa thống nhất |
| ✅ Icon system nhất quán | ⚠️ Font size hierarchy chưa hoàn toàn chuẩn |
| ✅ Color-coding cho roles/status thống nhất toàn app | |

### H5. Error Prevention ⭐⭐
> **Đây là điểm yếu đáng chú ý nhất từ góc độ an toàn y tế:**

| Vấn đề | Mức nghiêm trọng | Giải pháp đề xuất |
|---|---|---|
| Không validate đầu vào form BN | Cao | Form validation, required fields |
| Không confirm trước khi xóa ca mổ | Cao | Double-confirm dialog cho thao tác critical |
| Password không hash, plaintext trong JS | Cao | Server-side authentication |
| Không có data backup tự động | Trung bình | Automated backup strategy |

### H6. Recognition Rather Than Recall ⭐⭐⭐⭐
| Điểm mạnh | Gap |
|---|---|
| ✅ Color avatar initials → nhận diện nhanh | ❌ Thiếu recent/favorite items |
| ✅ Visual room map → không cần nhớ số phòng | ❌ Thiếu search global |
| ✅ Tab filters → lọc trực quan | |

### H7. Flexibility and Efficiency of Use ⭐⭐⭐
| Điểm mạnh | Gap |
|---|---|
| ✅ Xuất hình lịch mổ, xuất Excel | ❌ Không có keyboard shortcuts |
| ✅ Quick filters (tabs) | ❌ Không có batch operations |
| | ❌ Thiếu customizable dashboard |

### H8. Aesthetic and Minimalist Design ⭐⭐⭐⭐
| Điểm mạnh | Gap |
|---|---|
| ✅ Clean white-space, không thừa thông tin | ⚠️ Dashboard có thể thêm data visualization |
| ✅ Card-based layout hiện đại | ⚠️ Thiếu micro-animations |
| ✅ Color palette chuyên nghiệp y tế |  |

### H9. Help Users Recognize, Diagnose, and Recover from Errors ⭐⭐
| Vấn đề | Gap |
|---|---|
| ❌ Error messages chỉ dùng `alert()` | Cần inline validation messages |
| ❌ Không có error logging / reporting | Cần error tracking (Sentry) |
| ❌ Khi mất kết nối server: không thông báo rõ | Cần offline indicator |

### H10. Help and Documentation ⭐
> **Không có bất kỳ tài liệu hướng dẫn nào** — không có help center, FAQ, tooltips, onboarding flow, hoặc user manual.

---

### Tổng hợp điểm Nielsen

| # | Tiêu chí | Điểm | Trọng số (Y tế) |
|---|---|---|---|
| H1 | Visibility of System Status | ⭐⭐⭐⭐ (4/5) | Cao |
| H2 | Match System ↔ Real World | ⭐⭐⭐⭐⭐ (5/5) | Rất cao |
| H3 | User Control & Freedom | ⭐⭐⭐ (3/5) | Cao |
| H4 | Consistency & Standards | ⭐⭐⭐⭐ (4/5) | Trung bình |
| H5 | Error Prevention | ⭐⭐ (2/5) | **Rất cao (Y tế)** |
| H6 | Recognition vs Recall | ⭐⭐⭐⭐ (4/5) | Trung bình |
| H7 | Flexibility & Efficiency | ⭐⭐⭐ (3/5) | Cao |
| H8 | Aesthetic & Minimalist | ⭐⭐⭐⭐ (4/5) | Thấp |
| H9 | Error Recovery | ⭐⭐ (2/5) | **Rất cao (Y tế)** |
| H10 | Help & Documentation | ⭐ (1/5) | Cao |
| | **Trung bình có trọng số** | **3.1/5** | |

---

## A5. Đánh giá SUS (System Usability Scale)

### A5.1 SUS Ước tính (Expert Evaluation)

Dựa trên phân tích heuristic và so sánh với chuẩn ngành:

| Tiêu chí SUS | Điểm ước tính (1-5) |
|---|---|
| 1. Tôi muốn sử dụng hệ thống này thường xuyên | 4 |
| 2. Hệ thống phức tạp không cần thiết | 2 (= tốt) |
| 3. Hệ thống dễ sử dụng | 4 |
| 4. Cần hỗ trợ kỹ thuật để sử dụng | 2 (= tốt) |
| 5. Các chức năng tích hợp tốt | 4 |
| 6. Thiếu nhất quán trong hệ thống | 2 (= tốt) |
| 7. Đa số người dùng sẽ học nhanh | 4 |
| 8. Hệ thống cồng kềnh | 1 (= tốt) |
| 9. Tôi tự tin khi sử dụng | 3 |
| 10. Cần học nhiều trước khi sử dụng | 2 (= trung bình) |

**→ SUS Score ước tính: ~72.5/100**

### A5.2 So sánh Benchmark

```
SUS Score Spectrum:
[< 50 Kém] → [50-68 Dưới TB] → [68-72 Trung bình] → [72-85 Tốt ✅] → [> 85 Xuất sắc]
```

> **SUS ~72.5** = Nằm ở đầu vùng "Tốt" (Grade B), trên mức trung bình ngành Digital Health (70.5).
> Mục tiêu nâng cấp: đạt ≥80 (Grade A) qua các cải thiện Error Prevention và Help/Documentation.

---

## A6. Chiến lược nâng cấp

### A6.1 Ma trận ưu tiên (Impact × Effort)

```
Impact vs Effort Matrix:
🔥 LÀM NGAY (High Impact, Low Effort):
  - Toast notifications, Loading states, Confirm dialogs, Form validation

📋 LÊN KẾ HOẠCH (High Impact, High Effort):
  - PWA + Offline, Server-side auth, Trend charts, Help/Onboarding, Global search

💡 CÂN NHẮC (Low Impact, High Effort):
  - Database migration, EMR integration
```

---

### A6.2 Phase 1 — Quick Wins (1-2 tuần) 🔥

> **Mục tiêu: SUS +3 điểm → ~75.5 | Effort: Thấp | Impact: Cao**

| # | Hạng mục | Lý do (Evidence) | Thay đổi cụ thể |
|---|---|---|---|
| 1.1 | **Toast notifications** | Nielsen H1, H9: Thiếu feedback khi save/delete | Thêm toast component thay cho `alert()` |
| 1.2 | **Confirm dialogs nâng cao** | Nielsen H5: Thiếu confirm khi xóa ca mổ/BN | Double-confirm cho destructive actions |
| 1.3 | **Loading states** | Nielsen H1: User không biết app đang load | Skeleton loading + spinner |
| 1.4 | **Form validation** | Nielsen H5: Không validate inputs | Inline validation messages |
| 1.5 | **"Cập nhật lúc" timestamp** | Nielsen H1: Thiếu thông tin độ tươi dữ liệu | Hiện timestamp trên data cards |

---

### A6.3 Phase 2 — Core UX Improvements (2-4 tuần) 📋

> **Mục tiêu: SUS +5 điểm → ~77.5 | Effort: Trung bình | Impact: Cao**

| # | Hạng mục | Lý do (Evidence) | Thay đổi cụ thể |
|---|---|---|---|
| 2.1 | **PWA (Progressive Web App)** | Mobile usage chiếm >60% trong clinical workflow (HIMSS data) | Service Worker, manifest.json, installable |
| 2.2 | **Offline mode cơ bản** | Bác sĩ thường mất sóng trong phòng mổ | Cache Last-Known-Good data, offline banner |
| 2.3 | **Trend charts** | Nielsen H6, Competition gap: Thiếu data visualization | Chart.js cho PT trends theo tháng/quý |
| 2.4 | **Global search** | Nielsen H7: Thiếu tìm kiếm toàn app | `Cmd+K` style search bar |
| 2.5 | **Help tooltips + Onboarding** | Nielsen H10: Score 1/5 — nghiêm trọng | Interactive onboarding tour, tooltip hints |
| 2.6 | **Export nâng cao** | User feedback cần export Excel cho báo cáo | Export Excel cho tất cả data tables |

---

### A6.4 Phase 3 — Security & Infrastructure (4-8 tuần) 🔐

> **Mục tiêu: Compliance + Scalability | Effort: Cao | Impact: Rất cao**

| # | Hạng mục | Lý do (Evidence) | Thay đổi cụ thể |
|---|---|---|---|
| 3.1 | **Server-side authentication** | IEC 62366, HIPAA: Password plaintext unacceptable | JWT tokens, bcrypt password hashing |
| 3.2 | **Database migration** | JSON file = single point of failure, no concurrency | SQLite → PostgreSQL |
| 3.3 | **Audit logging** | Y tế yêu cầu truy vết mọi thay đổi | Log mọi action: ai, lúc nào, thay đổi gì |
| 3.4 | **Data backup automated** | Không có backup = rủi ro mất toàn bộ data | Cron backup + off-site storage |
| 3.5 | **Role-based access control** | Hiện tại phân quyền sơ sài | Granular permissions per module |

---

### A6.5 Phase 4 — Advanced Features (2-3 tháng) 🚀

> **Mục tiêu: SUS ≥ 85 (Xuất sắc) | Effort: Cao | Impact: Biến đổi**

| # | Hạng mục | Lý do (Evidence) | Thay đổi cụ thể |
|---|---|---|---|
| 4.1 | **Dashboard tùy chỉnh** | Nielsen H7: Mỗi BS cần thông tin khác nhau | Drag-drop widgets, saved layouts |
| 4.2 | **Real-time collaboration** | Current polling 10s = lag | WebSocket cho instant sync |
| 4.3 | **AI-powered insights** | Xu hướng toàn cầu (Epic, Qventus) | Dự đoán volume PT, gợi ý phân bổ |
| 4.4 | **EMR light integration** | Giảm nhập liệu trùng với HIS chính | API đọc dữ liệu từ HIS bệnh viện |
| 4.5 | **Notification push** | Mobile users bỏ lỡ thông báo | Web Push Notifications |

---

### A6.6 KPIs đo lường hiệu quả

| Metric | Hiện tại | Mục tiêu Phase 2 | Mục tiêu Phase 4 |
|---|---|---|---|
| **SUS Score** | ~72.5 | ≥ 78 | ≥ 85 |
| **Nielsen trung bình** | 3.1/5 | ≥ 3.8/5 | ≥ 4.3/5 |
| **Lighthouse Performance** | Chưa đo | ≥ 85 | ≥ 95 |
| **Lighthouse Accessibility** | Chưa đo | ≥ 80 | ≥ 95 |
| **Time to Task (xem lịch mổ)** | ~3 clicks | ≤ 2 clicks | ≤ 1 click (PWA shortcut) |
| **User Adoption Rate** | ~5 users | ≥ 20 users | ≥ 35 users (gần full khoa) |
| **Data Sync Latency** | 10s polling | ≤ 5s | ≤ 1s (WebSocket) |

---

## Kết luận

> **Website khoaptdtt.info.vn hiện ở mức "Tốt" (SUS ~72.5)** — trên trung bình ngành, và có lợi thế cạnh tranh rõ ràng so với các HIS lớn nhờ tính chuyên biệt và chi phí gần bằng 0.
>
> **3 điểm cần ưu tiên nhất** (data-driven):
> 1. **Error Prevention** (H5 = 2/5) — Nguy cơ an toàn y tế
> 2. **Help & Documentation** (H10 = 1/5) — Rào cản adoption cho user mới
> 3. **PWA + Offline** — Phù hợp workflow thực tế BS trong phòng mổ

---

*Báo cáo được xây dựng dựa trên deep research từ Nielsen Norman Group, JMIR meta-analysis on SUS benchmarks for Digital Health Apps, HIMSS Stage Model, so sánh giải pháp HIS Việt Nam (FPT eHospital, Viettel HIS, NANO Hospital), và giải pháp quốc tế (Epic OpTime, MEDITECH Expanse, Qventus).*
