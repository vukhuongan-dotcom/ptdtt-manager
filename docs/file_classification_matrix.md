# BẢNG MA TRẬN PHÂN LOẠI TỆP TIN DỰ ÁN (FILE CLASSIFICATION MATRIX)
**Hệ thống:** Quản lý Chuyên môn Khoa Phẫu thuật Đại trực tràng (PTDTT Manager)  
**Phiên bản:** 1.0 (Chuẩn hóa Tuân thủ Rule v2:R47 [T3-DEV])  
**Tiêu chuẩn tham khảo:** ISO 15489-1:2016 Records Management (§8.3 Business Classification System & §9.4 Classification and Indexing)  
**Căn cứ pháp lý bảo vệ dữ liệu:** Luật Khám bệnh, chữa bệnh số 15/2023/QH15, Luật Bảo vệ Dữ liệu Cá nhân số 91/2025/QH15, Nghị định số 356/2025/NĐ-CP

---

## 📊 1. MA TRẬN PHÂN LOẠI TỆP TIN (FILE TAXONOMY MATRIX)

| Mã Nhóm | Phân Loại Nghiệp Vụ | Định Dạng Cho Phép | Thư Mục Bắt Buộc | Điểm Đến Lưu Trữ & Chính Sách Git | Mức Độ Bảo Mật & Quyền Hạn |
|:---:|---|---|---|---|:---:|
| **CLS-01** | **Mã nguồn Frontend & Backend** | `.html`, `.js`, `.css`, `.py`, `.json`, `.sh` | Thư mục gốc (`/`), `js/`, `css/`, `fonts/` | `CODE_REPOSITORY` — Git Versioned | Nội bộ (Internal) |
| **CLS-02** | **Đặc tả & Kiến trúc dự án** | `.md`, `.json`, `.yaml` | `PROJECT_CONTEXT/`, `docs/` | `CODE_REPOSITORY` — Git Versioned (SSoT Brain) | Nội bộ (Internal) |
| **CLS-03** | **Quy tắc nội bộ dự án** | `AGENTS.md` (symlink `.agents/AGENTS.md`) | Thư mục gốc (`project_root/`), `.agents/` | `CODE_REPOSITORY` — Git Versioned (Tự nạp tự động) | Nội bộ (Internal) |
| **CLS-04** | **Cơ sở dữ liệu lâm sàng thô (Raw PHI)** | `.json` (`db.json`), `.json` snapshot | `data/` (`db.json`), `data/snapshots/`, `data_backups/` | `LOCAL_SANDBOX` / VPS Local — **BẮT BUỘC nằm trong `.gitignore`**. Tuyệt đối cấm commit Git/Git LFS hay đẩy lên Cloud công cộng. | **Tuyệt mật (Strict Zero-PHI)** |
| **CLS-05** | **Tài nguyên hình ảnh & Nhận diện** | `.jpg`, `.png`, `.webp` | `img/`, `img/staff/` | `CODE_REPOSITORY` — Git Versioned | Nội bộ (Internal) |
| **CLS-06** | **Tài liệu hướng dẫn & Báo cáo** | `.html`, `.pdf`, `.docx` | `huong_dan_bao_cao.html`, `Huong_dan_bao_cao_Khoa_PTDTT.pdf` (gốc PWA) | `CODE_REPOSITORY` — Tài liệu PWA offline phục vụ Khoa. Tuân thủ thể thức hành chính (Rule `v2:R43`). | Hạn chế (Restricted) |
| **CLS-07** | **Sổ theo dõi sự cố & Tính năng** | `.md` | `docs/BUG_FIX_REGISTRY.md` & `PROJECT_CONTEXT/BANG_TONG_HOP_LOI_VA_KHAC_PHUC.md` | `CODE_REPOSITORY` — Git Versioned theo Rule `v2:R45 [T3-QA]`. Cập nhật đồng bộ trong cùng 1 commit. | Nội bộ (Internal) |

---

## 🔒 2. CHÍNH SÁCH ĐIỂM ĐẾN DỮ LIỆU & BẢO VỆ PHI
1. **`LOCAL_SANDBOX` & VPS Protected:** Thư mục `data/` chứa `db.json` và `data/snapshots/` được phân quyền chặt chẽ trên máy chủ (`chmod 775 data && chmod 664 data/*.json`), không bao giờ rsync trực tiếp từ local đè lên production (`--exclude="data/"`), và nằm trong danh sách loại trừ của `.gitignore`.
2. **`CODE_REPOSITORY`:** Kho mã nguồn Git nội bộ của dự án. Mọi tệp tin trước khi commit bắt buộc phải được quét sạch thông tin định danh bệnh nhân (Zero-PHI) và bí mật hệ thống (API keys, passwords, credentials).

---

## 🚫 3. QUY ĐỊNH VỀ TỆP TIN Ở THƯ MỤC GỐC (ROOT HYGIENE)
* Thư mục gốc (`/`) chứa các tệp tin quản trị hệ thống chuẩn: `AGENTS.md`, `README.md`, `.gitignore`, `package.json`, và các tệp cấu hình runtime của PWA Web (`manifest.json`, `sw.js`, `index.html`, `server_flask.py`).
* Tệp `Huong_dan_bao_cao_Khoa_PTDTT.pdf` được lưu giữ tại thư mục gốc như một tài nguyên tĩnh phục vụ tính năng tải tài liệu hướng dẫn ngoại tuyến của PWA theo tài liệu kiến trúc `PROJECT_CONTEXT_2026-04-03_P2.md:47`.
