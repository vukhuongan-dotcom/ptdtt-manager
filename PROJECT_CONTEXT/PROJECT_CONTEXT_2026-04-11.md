# PROJECT CONTEXT — PTDTT Manager

> **Mục đích file này**: Cung cấp toàn bộ context cho Agent AI khi bắt đầu cuộc trò chuyện mới.
> **Cập nhật lần cuối**: 2026-04-11

---

## 1. Tổng quan dự án
- **Mô tả**: Ứng dụng web quản lý nội bộ Khoa Phẫu thuật Đại trực tràng, BV Bình Dân
- **URL Production**: https://khoaptdtt.info.vn
- **Server**: VPS (triển khai qua nginx + gunicorn)
- **Tech stack**: Vanilla HTML/CSS/JS (frontend) + Flask/Python (backend) + JSON file DB
- **Workspace path**: `~/Projects/ptdtt-manager`

---

## 2. Cấu trúc file

```
ptdtt-manager/
├── index.html              # Entry point — SPA
├── huong_dan_bao_cao.html  # Trang hướng dẫn riêng
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (offline)
├── server.py               # Python HTTP server (dev, EMR proxy)
├── server.js               # Node.js server (backup)
├── server_flask.py         # Flask production server (700 dòng)
│                             ├── JSON Data API (/api/data)
│                             ├── Auth API (/api/auth/* — JWT + bcrypt)
│                             ├── EMR Proxy (/api/emr)
│                             ├── Audit Logging (/api/audit)
│                             └── Static files serving
├── requirements.txt        # flask, pyjwt, bcrypt
├── README.md
├── css/                    # 22 CSS files
│   ├── variables.css       # Design tokens (colors, spacing)
│   ├── base.css            # Reset, typography, shared
│   ├── sidebar.css         # Navigation
│   ├── login.css, modal.css, toast.css
│   ├── dashboard.css, reports.css
│   ├── staff.css, staff-tracking.css
│   ├── surgery.css, surgery-stats.css
│   ├── schedule.css, plans.css
│   ├── patients.css, rooms.css
│   ├── search.css, charts.css
│   ├── notifications.css, onboarding.css
│   └── mobile.css          # Responsive breakpoints
├── js/                     # 22 JS files
│   ├── data.js             # Sample data (staff, schedules)
│   ├── store.js            # localStorage wrapper + DATA_VERSION
│   ├── utils.js            # Utilities, icons
│   ├── auth.js             # JWT auth client (21KB)
│   ├── emr.js              # EMR integration
│   ├── app.js              # Main controller, routing
│   ├── dashboard.js        # Dashboard + KPI cards (24KB)
│   ├── reports.js          # Báo cáo 7g + 16g (85KB — file lớn nhất)
│   ├── staff.js            # Nhân sự (34KB)
│   ├── surgery.js          # Lịch mổ (37KB)
│   ├── schedule.js         # Lịch trực tuần (36KB)
│   ├── surgery-stats.js    # Thống kê PT (21KB)
│   ├── tasks.js            # Công việc (24KB)
│   ├── plans.js            # Kế hoạch (15KB)
│   ├── staff-tracking.js   # Theo dõi nhân sự
│   ├── patients.js         # Bệnh nhân
│   ├── rooms.js            # Phòng bệnh
│   ├── search.js           # Tìm kiếm
│   ├── notifications.js    # Thông báo
│   ├── onboarding.js       # Onboarding
│   ├── audit-log.js        # Audit log viewer
│   └── xlsx.full.min.js    # SheetJS (Excel export)
├── img/                    # Icons, assets
└── deploy/                 # Server deployment
    ├── setup.sh            # Initial server setup
    ├── auto-deploy.sh      # Auto deploy script
    ├── nginx.conf          # Nginx reverse proxy
    ├── ptdtt.service       # systemd service
    └── ssl-setup.sh        # SSL certificate
```

---

## 3. Kiến trúc kỹ thuật

### Frontend
- **Routing**: Hash-based SPA routing trong `app.js`
- **State**: `localStorage` wrapped by `store.js` + `DATA_VERSION` flag
- **Auth**: JWT token stored in localStorage, sent as `Bearer` header
- **UI**: Sidebar navigation, responsive via `mobile.css`
- **Theme**: CSS custom properties trong `variables.css`

### Backend (server_flask.py)
- **Framework**: Flask (production mode via gunicorn)
- **Database**: JSON flat-file (`data/db.json`) — thread-safe with `_data_lock`
- **Auth**: JWT (pyjwt) + bcrypt password hashing, stored in `data/auth.json`
- **EMR Proxy**: CORS bypass for BV Bình Dân EMR system (auto-login, session management)
- **Audit**: JSON Lines format (`logs/audit_YYYY-MM-DD.jsonl`), auto-cleanup 90 days
- **Port**: 5000 (configurable via `PORT` env)

### Data flow
```
Browser → Flask API (/api/data) → db.json
Browser → Flask API (/api/auth/*) → auth.json (bcrypt + JWT)
Browser → Flask API (/api/emr) → EMR BV Bình Dân (proxy)
```

### Deploy flow
```
Local dev → git push → SSH to VPS → git pull → systemctl restart ptdtt
```

---

## 4. Hệ thống tài khoản

| Vai trò | Username | Quyền |
|---------|----------|-------|
| Super Admin | `vkan` | Full control |
| Admin | `huu.nph`, `an.vk`, `thuy.ntnt` | CRUD operations |
| User | Auto-generated from staff list | Read-only |
| Guest | `guest` / `12345` | Read-only |

---

## 5. Tính năng đã hoàn thành
- [x] Dashboard + KPI cards (reorderable)
- [x] Quản lý nhân sự (CRUD, colorblind-safe)
- [x] Staff tracking board (NV, XV, BN nặng)
- [x] Lịch trực tuần (4 ca: Mổ, BCN khoa, BV, ĐD)
- [x] Lịch mổ tuần (CRUD, color-coded by surgeon)
- [x] Thống kê phẫu thuật (theo BS mổ chính)
- [x] Công việc (assign, deadline, status)
- [x] Kế hoạch tuần/tháng
- [x] Bệnh nhân (tích hợp EMR auto-fetch)
- [x] Báo cáo 16g (BS trực khoa) + Báo cáo 7g (ĐD trực BV)
- [x] Robot surgery + ICU categories trong reports
- [x] PDF/Canvas export (A4, print-ready)
- [x] JWT + bcrypt authentication
- [x] Audit logging (JSON Lines)
- [x] PWA (Service Worker, offline capable)
- [x] Hướng dẫn sử dụng (PDF + HTML)
- [x] Search toàn cục
- [x] Notifications system
- [x] Onboarding flow

---

## 6. TODO / Đang phát triển
- [ ] SQLite migration (thay JSON flat-file)
- [ ] Mobile CSS fixes (cần test thực tế)
- [ ] Weekly surgery/schedule reports: nâng resolution cho A4

---

## 7. Quyết định kiến trúc quan trọng
1. **Vanilla JS thay vì React/Vue** — nhẹ, không build step, dễ deploy
2. **JSON flat-file thay vì SQLite/Postgres** — đơn giản, nhưng cần migrate sớm
3. **JWT + bcrypt server-side** — security Phase 2-3 đã hoàn thành
4. **EMR proxy qua Flask** — bypass CORS restriction của hệ thống BV
5. **localStorage cho client state** — DATA_VERSION flag để force refresh

---

## 8. Lệnh thường dùng

```bash
# Dev local
cd ~/Projects/ptdtt-manager && python3 server_flask.py

# Truy cập
# http://localhost:5000

# Deploy
ssh vps 'cd /path/to/ptdtt-manager && git pull && sudo systemctl restart ptdtt'

# Backup data
scp vps:/path/to/data/db.json ./backup/
```

---

## 9. Lưu ý khi code
- **reports.js là file lớn nhất** (85KB) — cẩn thận khi edit, dễ conflict
- **DATA_VERSION** trong `store.js` — tăng version sẽ reset localStorage cho tất cả users
- **Custom tên viết tắt** trong `schedule.js` — có override map riêng
- **Không dùng shell loop trên Google Drive path** — FUSE filesystem chậm 10-100x
- **JWT_SECRET** hardcoded trong server — cần chuyển sang env var trên production
- **EMR credentials** trong code — cần chuyển sang env var
