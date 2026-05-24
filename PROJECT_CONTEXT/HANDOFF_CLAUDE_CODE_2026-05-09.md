# HANDOFF — PTDTT Manager → Claude Code
> Ngày bàn giao: 09/05/2026  
> Từ: Antigravity (session 0fd0727a)  
> Cho: Claude Code  
> Đọc file này **trước khi làm bất kỳ điều gì**.

---

## 1. THÔNG TIN CỐT LÕI

| Hạng mục | Giá trị |
|----------|---------|
| Production URL | https://khoaptdtt.info.vn |
| VPS | root@180.93.138.83 |
| VPS password | `KJQwgRcUDS6AlpQLJQvI` |
| Local workspace | `~/Projects/ptdtt-manager` |
| Git remote | `git@github.com:vukhuongan-dotcom/ptdtt-manager.git` |
| Tech stack | Vanilla HTML/CSS/JS + Flask/Python + JSON DB |
| Deployment | nginx + gunicorn (systemd service: `ptdtt`) |
| Cron backup | `30 22 * * *` → `/var/www/ptdtt-manager/scripts/backup.sh` |

---

## 2. CẤU TRÚC PROJECT

```
ptdtt-manager/
├── index.html              # SPA entry point
├── server_flask.py         # Flask production server (~700 dòng)
│   ├── /api/data           # JSON data API (GET/POST)
│   ├── /api/auth/*         # JWT + bcrypt auth
│   ├── /api/emr            # EMR proxy (pending approval)
│   └── /api/audit          # Audit logging
├── js/                     # 24 JS files
│   ├── app.js              # Main controller, routing, session mgmt
│   ├── auth.js             # JWT client
│   ├── reports.js          # Báo cáo 7h/16h (file lớn nhất ~85KB)
│   ├── dashboard.js        # Dashboard + charts
│   ├── staff.js            # Nhân sự
│   ├── surgery.js          # Lịch mổ
│   ├── schedule.js         # Lịch trực tuần
│   ├── surgery-stats.js    # Thống kê phẫu thuật
│   └── ...
├── css/                    # 24 CSS files
│   ├── variables.css       # Design tokens (MỌI màu/spacing định nghĩa ở đây)
│   └── ...
├── data/
│   ├── db.json             # Database chính (~768KB)
│   ├── auth.json           # User accounts + JWT secrets
│   ├── backups/            # Daily tarballs (KHÔNG đưa vào tarball)
│   └── snapshots/          # KHÔNG backup (đã xóa)
└── scripts/
    ├── backup.sh           # Backup script (cron 22:30)
    ├── pull-backup-to-drive.sh
    └── sync-drive-mirror.sh
```

---

## 3. NHỮNG THAY ĐỔI ĐÃ THỰC HIỆN TRONG SESSION NÀY

### 3.1 Code changes (committed)
| Commit | Nội dung |
|--------|---------|
| `6853c43` | feat(reports): surgery Total là read-only, auto-calc từ CT+YC+Robot |
| `de4663b` | config: giảm idle auto-logout từ 15 phút → 5 phút |
| `95ea975` | fix: cập nhật comment idle timeout (sync rule) |
| `fcb9e45` | ops: giảm Drive backup churn |
| `334611e` | ops: chuyển Drive mirror sang incremental sync |

### 3.2 Infrastructure changes (VPS)
- **Backup script** (`scripts/backup.sh`): Đã loại `data/snapshots/`, `data/shcm-files/` và `data/backups/` khỏi tarball → mỗi backup chỉ còn ~160KB (trước: 2.4MB)
- **GitHub remote VPS**: Chuyển từ HTTPS+PAT sang **SSH key** (`~/.ssh/github_deploy`) → tránh token hết hạn
- **Drive cleanup**: Đã xóa 32,591 file browser_recordings (3.1GB) khỏi Drive và local
- **`backup_antigravity.sh`**: Đã tắt `sync_browser_recordings` (không còn sync 3.1GB screenshots lên Drive)
- **Snapshots VPS**: Đã xóa thủ công (21MB → 0)

### 3.3 Files uncommitted (local only)
```
PROJECT_CONTEXT/AG_DRIVE_SYNC_FEEDBACK_2026-05-03.md  (new)
```

---

## 4. TRẠNG THÁI HIỆN TẠI

### ✅ Đang hoạt động tốt
- Service `ptdtt` uptime: 40+ ngày
- Backup hàng đêm 22:30: ✅ chạy đúng
- GitHub backup branch: ✅ push qua SSH thành công
- 39 tài khoản người dùng
- Disk VPS: 25% (4.6GB/19GB)

### ⚠️ Vấn đề cần theo dõi
1. **Conversations backup** trên Drive: 4 snapshots × 247MB = ~1GB vì `backup_antigravity.sh` vẫn copy `~/.gemini/antigravity/conversations/` (227MB) vào mỗi snapshot. Cân nhắc loại bỏ.
2. **EMR module**: Giao diện đã code xong, đang chờ phê duyệt Giám đốc để kết nối với hệ thống EMR bệnh viện.
3. **Idle timeout UI**: Code đã set 5 phút (`IDLE_TIMEOUT = 5 * 60 * 1000` trong `app.js`), nhưng chưa xác minh text hiển thị trong UI đã đồng bộ (cần grep "15 phút" để check).

### ❌ Đã biết bị lỗi
- Không có lỗi blocking nào hiện tại.

---

## 5. QUY TẮC BẮT BUỘC

### 5.1 Synchronous Change Principle
> **Khi thay đổi bất kỳ giá trị nào (constant, timeout, label...), PHẢI grep toàn codebase** để tìm và cập nhật TẤT CẢ nơi tham chiếu trong cùng 1 commit — bao gồm comment, toast message, UI label, README.

```bash
# Ví dụ: trước khi đổi timeout
grep -r "5 phút\|5 minutes\|300000\|IDLE_TIMEOUT" js/ css/ *.html
```

### 5.2 Deploy workflow
```bash
# Local → VPS
git add . && git commit -m "feat/fix: mô tả"
git push origin main

# Trên VPS
ssh root@180.93.138.83
cd /var/www/ptdtt-manager
git pull origin main
systemctl restart ptdtt
```

### 5.3 Không sửa trực tiếp trên VPS
- Mọi thay đổi code phải qua git, không edit file trực tiếp trên server.
- Ngoại lệ: cấu hình nginx, systemd — nhưng cũng phải document lại.

### 5.4 Data files
- `data/db.json` và `data/auth.json` là source of truth — KHÔNG commit vào git.
- Đã được liệt kê trong `.gitignore`.

---

## 6. PENDING TASKS (từ UI/UX Audit 28/04/2026)

Có file audit đầy đủ tại:
`~/Documents/Codex/2026-04-20-ti-p-qu-n-c-ng/ptdtt_uiux_audit_2026-04-28.md`

### P0 — Bảo mật/Accessibility (chưa làm)
- [ ] Focus visible (`:focus-visible`) cho mọi interactive element
- [ ] Touch targets tối thiểu 44×44px trên mobile
- [ ] Modal semantics (`role="dialog"`, `aria-modal`, focus trap)
- [ ] Screen reader labels cho icon-only buttons

### P1 — UX cải thiện (chưa làm)
- [ ] Mobile navigation: chuyển từ sidebar sang bottom navigation (5 items)
- [ ] Form auto-save: bảo vệ dữ liệu đang nhập khi idle timeout hoặc chuyển trang
- [ ] Lazy load modules (hiện tại load tất cả 24 JS files khi khởi động)
- [ ] Global `FormController` để quản lý state form nhất quán

### P2 — Nice to have
- [ ] Thiết kế giao diện thống nhất hơn (hiện tại mỗi module có style riêng)
- [ ] Automated testing

---

## 7. VÍ DỤ THAO TÁC THƯỜNG DÙNG

### Kiểm tra log VPS
```bash
ssh root@180.93.138.83 "tail -50 /var/log/ptdtt/backup.log"
ssh root@180.93.138.83 "journalctl -u ptdtt -n 30 --no-pager"
```

### Chạy backup thủ công
```bash
ssh root@180.93.138.83 "/var/www/ptdtt-manager/scripts/backup.sh"
```

### Xem data hiện tại
```bash
ssh root@180.93.138.83 "du -sh /var/www/ptdtt-manager/data/*"
```

### Restart service
```bash
ssh root@180.93.138.83 "systemctl restart ptdtt && systemctl status ptdtt --no-pager | head -5"
```

---

## 8. FILES QUAN TRỌNG CẦN ĐỌC KHI CÓ TASK MỚI

| File | Khi nào đọc |
|------|-------------|
| `PROJECT_CONTEXT/PROJECT_CONTEXT_2026-04-11.md` | Context tổng quan đầy đủ nhất |
| `PROJECT_CONTEXT/BACKUP_DRIVE_AUDIT_2026-05-02.md` | Khi làm việc liên quan backup/Drive |
| `PROJECT_CONTEXT/AG_DRIVE_SYNC_FEEDBACK_2026-05-03.md` | Phân tích Drive sync issue |
| `PROJECT_CONTEXT/DEPLOY_SECRETS.md` | Credentials, cấu hình server |
| `js/app.js` (lines 65-220) | Session management, routing |
| `server_flask.py` | API endpoints, auth logic |

---

*Handoff tạo bởi Antigravity session `0fd0727a-48bd-4df8-b6cb-9d7666a4b97f`*  
*Claude Code đọc xong file này thì báo xác nhận trước khi bắt đầu task.*
