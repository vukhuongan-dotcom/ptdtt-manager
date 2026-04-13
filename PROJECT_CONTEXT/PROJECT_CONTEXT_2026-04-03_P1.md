# PROJECT CONTEXT — PTDTT Manager (Phần 1: Nền tảng)

> **Mục đích file này**: Cung cấp context cho Agent AI khi bắt đầu cuộc trò chuyện mới.
> **Cuộc trò chuyện gốc**: `9b56c37f` — "Finalizing Surgery Schedule And Statistics"
> **Xem tiếp**: [PROJECT_CONTEXT_P2.md](./PROJECT_CONTEXT_P2.md) — Phần 2: UX Upgrade + Security
> Khi muốn tiếp tục dự án, paste: _"Đọc PROJECT_CONTEXT_P1.md và PROJECT_CONTEXT_P2.md trong folder PROJECT_CONTEXT của ptdtt-manager rồi tiếp tục"_

---

## 1. Tổng quan dự án

**PTDTT Manager** — Web app quản lý nội bộ Khoa Phẫu thuật Đại trực tràng, Bệnh viện Bình Dân, TP.HCM.

- **URL Production**: https://khoaptdtt.info.vn/
- **VPS**: `root@180.93.138.83` (Ubuntu, Nginx + Python)
- **Tech stack**: Vanilla HTML/CSS/JS (SPA), Python backend (EMR proxy), localStorage
- **Workspace**: `~/Library/CloudStorage/GoogleDrive-vukhuongan@gmail.com/Drive của tôi/01. CÔNG VIỆC BỆNH VIỆN/ptdtt-manager/`

---

## 2. Cấu trúc file

```
ptdtt-manager/
├── index.html              # SPA entry point
├── server.py               # Python backend (EMR proxy, static files, port 3000)
├── server.js               # Node.js backup server
├── server_flask.py          # Flask version
├── README.md
├── requirements.txt         # Python dependencies
├── .gitignore
│
├── css/                     # 17 CSS files
│   ├── variables.css        # Theme CSS custom properties (dark/light mode)
│   ├── base.css             # Reset, typography, shared components
│   ├── sidebar.css          # Navigation sidebar
│   ├── modal.css            # Modal dialogs
│   ├── login.css            # Login page
│   ├── dashboard.css        # Dashboard
│   ├── staff.css            # Staff management
│   ├── staff-tracking.css   # Staff status tracking calendar
│   ├── tasks.css            # Task management
│   ├── plans.css            # Plans management
│   ├── patients.css         # Patient list
│   ├── rooms.css            # Room map (sơ đồ phòng)
│   ├── schedule.css         # Weekly duty schedule
│   ├── surgery.css          # Surgery schedule
│   ├── surgery-stats.css    # Surgery statistics
│   ├── notifications.css    # Notification bell
│   └── mobile.css           # Responsive mobile styles
│
├── js/                      # 17 JS modules
│   ├── data.js              # Default data (staff list, schedules)
│   ├── store.js             # localStorage wrapper, data persistence
│   ├── utils.js             # Utility functions, icons, helpers
│   ├── auth.js              # Authentication & login system
│   ├── app.js               # Main app controller, routing, page registration
│   ├── emr.js               # EMR BV Bình Dân integration
│   ├── dashboard.js         # Dashboard page (KPIs, duty roster, stats chart)
│   ├── staff.js             # Staff management (CRUD, status tracking)
│   ├── staff-tracking.js    # Staff status calendar (week/month view)
│   ├── tasks.js             # Task management (assign, trash, notifications)
│   ├── plans.js             # Plans management (weekly/monthly plans)
│   ├── patients.js          # Patient list (EMR integration)
│   ├── rooms.js             # Room map display
│   ├── schedule.js          # Weekly duty schedule (Mổ/BCN/BV/ĐD)
│   ├── surgery.js           # Surgery schedule (add/edit/delete cases)
│   ├── surgery-stats.js     # Surgery statistics (by surgeon, period)
│   └── notifications.js    # Notification bell (task assignments)
│
└── deploy/                  # Deployment config
    ├── auto-deploy.sh       # Deploy script (rsync to VPS)
    ├── nginx.conf           # Nginx site config
    ├── ptdtt.service         # systemd service file
    ├── setup.sh             # Initial server setup
    └── ssl-setup.sh         # Let's Encrypt SSL
```

---

## 3. Kiến trúc kỹ thuật

### Frontend (SPA)
- **Routing**: Hash-based (`#dashboard`, `#staff`, `#surgery`...)
- **State**: `store.js` wraps `localStorage`, auto-save on change
- **Auth**: Client-side, accounts defined in `data.js`, 3 admin roles
- **Theme**: Dark/Light mode via CSS custom properties in `variables.css`
- **No build step**: Direct `<script>` tags in `index.html`

### Backend (server.py)
- Port 3000, serves static files
- EMR proxy: `/api/emr` endpoints
- Auto-login to EMR BV Bình Dân (session management)
- CORS handling for cross-origin EMR requests

### Data flow
```
Browser localStorage ←→ store.js ←→ UI modules
                         ↕
                    server.py (proxy) ←→ EMR BV Bình Dân (emr.com.vn:83)
```

### Deploy flow
```
Local (Google Drive) → auto-deploy.sh (rsync) → VPS → Nginx (HTTPS) → khoaptdtt.info.vn
```

---

## 4. Hệ thống tài khoản

| Vai trò | Username | Password | Admin |
|---------|----------|----------|-------|
| Trưởng khoa | `huu.nph` | `huu123` | ✅ |
| Phó trưởng khoa | `an.vk` | `an123` | ✅ |
| ĐD trưởng | `thuy.ntnt` | `thuy123` | ✅ |
| BS/ĐD/HL | `<tên>.<viết_tắt>` | `<tên>123` | ❌ |

---

## 5. Backup system

| Tầng | Nơi lưu | Tần suất |
|------|---------|----------|
| Server | `/var/www/ptdtt-manager/backups/` | Cron 2:00 AM hàng ngày |
| Laptop | Google Drive `KHOA PTDTT/06. WEB APP/backup/` | Thủ công |

Data cần backup: `db.json` (~556KB) chứa toàn bộ dữ liệu.

---

## 6. Tính năng đã hoàn thành (tính đến 29/03/2026)

- [x] Hệ thống đăng nhập + phân quyền admin/user
- [x] Dashboard tổng quan (KPIs, duty roster, surgery chart)
- [x] Quản lý nhân sự (CRUD, trạng thái: đi làm/nghỉ phép/trực/hội nghị/nghỉ bù)
- [x] Theo dõi trạng thái NV theo tuần/tháng (staff-tracking calendar)
- [x] Quản lý công việc (CRUD, assign, trash, search)
- [x] Notification bell (task assignment alerts)
- [x] Kế hoạch tuần/tháng
- [x] Danh sách bệnh nhân + tích hợp EMR BV Bình Dân
- [x] Sơ đồ phòng khoa (room map)
- [x] Lịch phân công tuần (Mổ/BCN Khoa/BCN BV/ĐD)
- [x] Lịch mổ tuần (add/edit/delete surgery cases)
- [x] Thống kê phẫu thuật (by surgeon, week/month/custom period)
- [x] Export PDF & Image cho thống kê
- [x] Dark/Light theme
- [x] Responsive mobile layout
- [x] Deploy VPS + HTTPS (khoaptdtt.info.vn)
- [x] Auto backup server (cron)
- [x] Video tutorial + kịch bản lồng tiếng + phụ đề .srt

---

## 7. Implementation plan đang thực hiện

### Staff Status Tracking (đã xong)
- Thêm trạng thái "Nghỉ bù" (dayoff)
- Trang theo dõi NV theo tuần/tháng (grid calendar)
- Data model: `staffStatuses` array, mỗi entry = `{ staffId, date, status, note }`

---

## 8. Các quyết định kiến trúc quan trọng

1. **Vanilla JS, không framework** — đơn giản, dễ maintain cho team y tế
2. **localStorage thay vì database** — đủ dùng cho ~30 NV, dữ liệu nhẹ
3. **SPA hash routing** — tránh server-side routing phức tạp
4. **EMR proxy qua Python** — bypass CORS, auto session management
5. **Google Drive làm workspace** — đồng bộ tự động giữa các máy
6. **Deploy bằng rsync** — đơn giản, nhanh, không cần CI/CD

---

## 9. Lệnh thường dùng

```bash
# Deploy lên production
bash deploy/auto-deploy.sh

# Chạy local
python3 server.py

# SSH vào server  
ssh root@180.93.138.83

# Backup data về laptop
bash "KHOA PTDTT/06. WEB APP/backup/sync_backup.sh"

# Restart service trên server
systemctl restart ptdtt
```

---

## 10. Lưu ý khi code

- `DATA_VERSION` trong `store.js` — tăng khi muốn force-refresh default data
- Tên viết tắt trên lịch phân công có custom overrides trong `schedule.js`
- EMR session hết hạn → server.py auto re-login
- Mobile breakpoint: 768px (css/mobile.css)
- Luôn test trên cả dark mode và light mode
- Deploy xong → hard refresh (`Cmd+Shift+R`) để clear cache
