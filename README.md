# 🏥 Khoa Phẫu thuật Đại trực tràng — Hệ thống Quản lý

**Bệnh viện Bình Dân, TP. HCM**

Ứng dụng web quản lý nội bộ khoa Phẫu thuật Đại trực tràng (PTDTT), hỗ trợ quản lý nhân sự, lịch trực, lịch mổ, bệnh nhân, công việc, kế hoạch và thống kê phẫu thuật.

## 📸 Tính năng chính

| Tính năng | Mô tả |
|-----------|-------|
| **Tổng quan** | Dashboard hiển thị số liệu bệnh nhân, lịch trực hôm nay, thống kê ca mổ |
| **Nhân sự** | Quản lý danh sách BS, ĐD, HL, TK của khoa |
| **Công việc** | Phân công và theo dõi nhiệm vụ |
| **Kế hoạch** | Lập và quản lý kế hoạch tuần/tháng |
| **Bệnh nhân** | Danh sách bệnh nhân khoa, tích hợp EMR |
| **Phân công tuần** | Lịch trực Mổ / BCN khoa / BV / Điều dưỡng |
| **Lịch mổ tuần** | Lịch phẫu thuật hàng tuần, thêm/sửa/xóa ca mổ |
| **Thống kê PT** | Thống kê chi tiết ca PT theo BS mổ chính |

## 🛠 Công nghệ

- **Frontend**: Vanilla HTML/CSS/JavaScript (không framework)
- **Backend**: Python HTTP server đơn giản (proxy EMR)
- **Lưu trữ**: localStorage (client-side)
- **Tích hợp**: EMR BV Bình Dân (auto-login, proxy CORS)

## 📁 Cấu trúc thư mục

```
ptdtt-manager/
├── index.html          # Entry point - Single Page Application
├── server.py           # Python server (EMR proxy + static files)
├── server.js           # Node.js server (backup alternative)
├── README.md
├── .gitignore
├── css/
│   ├── variables.css   # CSS custom properties (theme colors)
│   ├── base.css        # Reset, typography, shared components
│   ├── sidebar.css     # Sidebar navigation
│   ├── modal.css       # Modal dialogs
│   ├── login.css       # Login page
│   ├── dashboard.css   # Dashboard
│   ├── staff.css       # Staff management
│   ├── tasks.css       # Task management
│   ├── plans.css       # Plans management
│   ├── patients.css    # Patient list
│   ├── schedule.css    # Weekly schedule
│   ├── surgery.css     # Surgery schedule
│   └── surgery-stats.css # Surgery statistics
└── js/
    ├── data.js         # Sample data (staff, schedules, tasks)
    ├── store.js        # localStorage wrapper
    ├── utils.js        # Utility functions, icons
    ├── auth.js         # Authentication & login
    ├── emr.js          # EMR integration module
    ├── app.js          # Main app controller, routing
    ├── dashboard.js    # Dashboard page
    ├── staff.js        # Staff management page
    ├── tasks.js        # Task management page
    ├── plans.js        # Plans management page
    ├── patients.js     # Patient list page
    ├── schedule.js     # Weekly schedule page
    ├── surgery.js      # Surgery schedule page
    └── surgery-stats.js # Surgery statistics page
```

## 🚀 Cài đặt & Chạy

### Yêu cầu
- Python 3.6+

### Chạy ứng dụng

```bash
# Clone repo
git clone https://github.com/<username>/ptdtt-manager.git
cd ptdtt-manager

# Khởi chạy server
python3 server.py

# Truy cập
# http://localhost:3000
```

### Tài khoản mặc định

| Vai trò | Tài khoản | Mật khẩu | Quyền |
|---------|-----------|----------|-------|
| Trưởng khoa | `huu.nph` | `huu123` | Admin ✅ |
| Phó trưởng khoa | `an.vk` | `an123` | Admin ✅ |
| ĐD trưởng | `thuy.ntnt` | `thuy123` | Admin ✅ |
| Bác sĩ/ĐD/HL | `<tên>.<viết_tắt>` | `<tên>123` | Xem ❌ |

> **Tra cứu tài khoản**: Trang đăng nhập có chức năng tra cứu — nhập tên để tìm tài khoản.

## 🔐 Phân quyền

- **Admin** (Trưởng/Phó TK, ĐD trưởng):
  - Chỉnh sửa lịch phân công tuần
  - CRUD nhân sự, công việc, kế hoạch
  - Thêm/sửa/xóa ca mổ
- **User** (BS, ĐD, HL, TK):
  - Chỉ xem (read-only)

## 🏥 Tích hợp EMR

Server Python tự động đăng nhập EMR BV Bình Dân để lấy dữ liệu bệnh nhân:
- Proxy request qua `http://localhost:3000/api/emr`
- Tự động re-login khi session hết hạn
- Lọc bệnh nhân khoa (loại bỏ phòng CC)

## 📝 Ghi chú phát triển

- Dữ liệu lưu trữ trong `localStorage` — xoá browser data sẽ mất dữ liệu
- `DATA_VERSION` trong `store.js` dùng để force-refresh dữ liệu mẫu
- Tên viết tắt trên lịch phân công có custom overrides trong `schedule.js`

## 📄 License

Private — Khoa Phẫu thuật Đại trực tràng, Bệnh viện Bình Dân
