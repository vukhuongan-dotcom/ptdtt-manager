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

