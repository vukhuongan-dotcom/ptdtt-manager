# NGUỒN SỰ THẬT DUY NHẤT (SSoT): PHÂN LOẠI PHẪU THUẬT NGOẠI TIÊU HÓA & PHÂN QUYỀN MỔ CHÍNH THEO CỘT BÁC SĨ — KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG

> **Cơ sở pháp lý & Dữ liệu gốc (SSoT):**
> 1. `BVBD_PHÂN LOẠI PHẪU THUẬT_nhóm NGOẠI TIÊU HOÁ.xls` (`309` dòng kỹ thuật: `118` Phẫu thuật nội soi + `191` dòng Phẫu thuật mở — Danh mục DVKT Bệnh viện Bình Dân đối chiếu Thông tư 50/2014/TT-BYT).
> 2. `Quyết định số 1073/QĐ-BVBD` ngày 12/06/2024 của Giám đốc Bệnh viện Bình Dân ban hành Quy chế xếp cột Bác sĩ phẫu thuật, thủ thuật.
> 3. `KẾT QUẢ XẾP CỘT BÁC SĨ KHOA PT-ĐTT 2026.xlsx` (Hội đồng xếp cột Bệnh viện Bình Dân phê duyệt năm 2026 cho `11` Bác sĩ Khoa Phẫu thuật Đại trực tràng).
> 4. `29.12.2025_DMKT - MÃ PHẪU THUẬT KHOA PTĐTT.xlsx` (Bảng mã DVKT nội bộ tham chiếu của Khoa Phẫu thuật Đại trực tràng).
> 5. **Chỉ đạo nghiệp vụ:** `BSCKII. Vũ Khương An` — Phó Trưởng khoa Phẫu thuật Đại trực tràng cập nhật vào Brain dự án ngày `28/10/2026`.

---

## I. NGUYÊN TẮC CỐT LÕI: BÁC SĨ CHÍNH CỘT NÀO MỔ ĐƯỢC PHẪU THUẬT LOẠI ĐÓ

### 1. Quy tắc đối chiếu song song 02 trục (Đường tiếp cận & Hạng phẫu thuật)

Quyền đứng tên **Phẫu thuật viên chính (`BS mổ chính` / `mainSurgeon`)** tại Khoa Phẫu thuật Đại trực tràng được kiểm soát đồng thời theo **02 điều kiện bắt buộc**:

1. **Trục 1 — Đúng đường tiếp cận phẫu thuật (`approachType`):**
   - **Phẫu thuật mở (`approachType = "mo"`):** Tra cứu phân loại tại **Sheet `PHẪU THUẬT MỞ`** và đối chiếu với **Cột Mổ mở** của bác sĩ.
   - **Phẫu thuật nội soi (`approachType = "noisoi"`):** Tra cứu phân loại tại **Sheet `PHẪU THUẬT NỘI SOI`** và đối chiếu với **Cột Mổ nội soi** của bác sĩ.
   - **Phẫu thuật Robot (`approachType = "robot"`):** Kỹ thuật chuyên sâu phức tạp được phê duyệt theo chứng nhận đào tạo riêng của Bệnh viện Bình Dân (không tự động suy từ cột mổ mở/nội soi thông thường). Hiện tại tại Khoa Phẫu thuật Đại trực tràng có **`TS. BSCKII. Nguyễn Phú Hữu`** được phê duyệt thực hiện phẫu thuật Robot (`PHA814`).
   - **Nội soi tiêu hóa (`approachType = "nsth"`):** Thủ thuật/can thiệp qua đường tự nhiên (`ESD`, `ERCP`, nội soi nong, cắt polyp qua nội soi ống mềm...) thuộc thẩm quyền duyệt mổ của **Trưởng khoa Nội soi tiêu hóa**.

2. **Trục 2 — Đúng thứ bậc Cột chuyên môn (`Cột ĐB` > `Cột I` > `Cột II` > `Cột III`):**
   - Bác sĩ chính được Hội đồng Bệnh viện xếp ở **cột nào** thì đương nhiên đủ điều kiện đứng tên **BS mổ chính** cho phẫu thuật thuộc **loại tương ứng cột đó và tất cả các loại thấp hơn** (nguyên tắc bao hàm từ cao xuống thấp theo Thông tư 50/2014/TT-BYT và Mục IV Quyết định 1073/QĐ-BVBD):

| Cột của Bác sĩ chính | Mổ chính ĐÚNG CỘT (Tự động hợp lệ) | Mổ chính CẦN DUYỆT VƯỢT CỘT (Theo từng DVKT cụ thể) | Phạm vi Thủ thuật đi kèm |
|:---:|:---|:---|:---|
| **Cột Đặc biệt (`Cột ĐB`)** | **`PT-ĐB`, `PT-I`, `PT-II`, `PT-III`** | Không *(trừ Phẫu thuật Robot cần chứng nhận riêng)* | Thủ thuật các loại (`ĐB, I, II, III`) |
| **Cột I (`Cột 1`)** | **`PT-I`, `PT-II`, `PT-III`** | **`PT-ĐB`** | Thủ thuật từ loại `ĐB` trở xuống |
| **Cột II (`Cột 2`)** | **`PT-II`, `PT-III`** | **`PT-ĐB`, `PT-I`** | Thủ thuật từ loại `I` trở xuống |
| **Cột III (`Cột 3`)** | **`PT-III`** | **`PT-ĐB`, `PT-I`, `PT-II`** | Thủ thuật từ loại `II` trở xuống |
| **Chưa xếp cột** *(BSNT / BS Học viên)* | **Không được đứng tên `BS mổ chính`** | Không áp dụng | Tham gia phụ mổ & chuẩn bị hồ sơ tiền phẫu |

### 2. Quy chế Xét Vượt Cột & Hậu Kiểm An Toàn (`Quyết định 1073/QĐ-BVBD` Mục III)

- **Không vượt cột tràn lan theo hạng:** Quyền mổ vượt cột **chỉ được xét duyệt đích danh theo từng Dịch vụ Kỹ thuật (DVKT) cụ thể** khi Ban Chủ nhiệm khoa đánh giá bác sĩ nắm vững quy trình kỹ thuật và đảm bảo an toàn người bệnh.
- **Trạng thái kiểm soát trên hệ thống `PTDTT Manager` (`Tab Duyệt mổ`):**
  1. `Đúng cột`: Hạng phẫu thuật ≤ Cột hiện tại của `BS mổ chính` (theo đúng đường Mổ mở / Mổ nội soi).
  2. `Vượt cột đã duyệt`: Hạng phẫu thuật cao hơn cột hiện tại nhưng bác sĩ đã có quyết định phê duyệt vượt cột của Bệnh viện cho đúng mã DVKT đó.
  3. `Đề xuất vượt cột`: Ca mổ vượt cột chưa nằm trong danh mục vượt cột thường quy của bác sĩ → hệ thống bật cảnh báo nổi bật để Phó Trưởng khoa thẩm định tiền duyệt và Trưởng khoa quyết định phê duyệt hoặc yêu cầu đổi `BS mổ chính` đúng cột.
- **Chế độ hậu kiểm & thu hồi:** Ban Chủ nhiệm khoa báo cáo kết quả thực hiện kỹ thuật vượt cột về Phòng Kế hoạch tổng hợp **mỗi 06 tháng/lần**. Trong vòng 01 năm, nếu xảy ra biến chứng mức độ **3, 4, 5 theo phân độ Clavien-Dindo** hoặc tỷ lệ biến chứng cao bất thường do lỗi kỹ thuật, quyền vượt cột bị xem xét thu hồi.

---

## II. BẢNG PHÂN CỘT CHÍNH THỨC NĂM 2026 CỦA BÁC SĨ KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG

### 1. Khối 11 Bác sĩ Cơ hữu (Ban Chủ nhiệm & Bác sĩ chính — Có quyền đứng `BS mổ chính`)

| STT | `staffId` (`db.json`) | Học hàm / Học vị & Họ tên | Chức vụ | Cột Mổ mở (2026) | Cột Mổ nội soi (2026) | PT Robot | Loại phẫu thuật được đứng `BS mổ chính` ĐÚNG CỘT |
|:---:|:---:|:---|:---|:---:|:---:|:---:|:---|
| 01 | `1` | **TS. BSCKII. Nguyễn Phú Hữu** | Trưởng khoa | **Đặc biệt** | **Đặc biệt** | **Có (`x`)** | Mổ mở & PTNS: **`PT-ĐB`, `PT-I`, `PT-II`, `PT-III`** + **PT Robot** |
| 02 | `2` | **BSCKII. Vũ Khương An** | Phó Trưởng khoa | **Đặc biệt** | **Đặc biệt** | — | Mổ mở & PTNS: **`PT-ĐB`, `PT-I`, `PT-II`, `PT-III`** |
| 03 | `4` | **BSCKII. Vũ Ngọc Anh Tuấn** | Bác sĩ chính | **Đặc biệt** | **Đặc biệt** | — | Mổ mở & PTNS: **`PT-ĐB`, `PT-I`, `PT-II`, `PT-III`** |
| 04 | `5` | **BSCKII. Bùi Hồng Minh Hậu** | Bác sĩ chính | **Đặc biệt** | **Đặc biệt** | — | Mổ mở & PTNS: **`PT-ĐB`, `PT-I`, `PT-II`, `PT-III`** |
| 05 | `6` | **BSCKII. Võ Chí Nguyện** | Bác sĩ chính | **I** | **I** | — | Mổ mở & PTNS: **`PT-I`, `PT-II`, `PT-III`** *(`PT-ĐB` cần duyệt vượt cột)* |
| 06 | `7` | **ThS. BSCKI. Phạm Vĩnh Phú** *(DB: `BSCKI`)* | Bác sĩ chính | **II** | **II** | — | Mổ mở & PTNS: **`PT-II`, `PT-III`** *(`PT-I`, `PT-ĐB` cần duyệt vượt cột)* |
| 07 | `8` | **ThS. BSCKI. Giao Hữu Trường Quy** *(DB: `BSCKI`)* | Bác sĩ chính | **II** | **II** | — | Mổ mở & PTNS: **`PT-II`, `PT-III`** *(`PT-I`, `PT-ĐB` cần duyệt vượt cột)* |
| 08 | `9` | **ThS. BSCKI. Trịnh Hoàng Minh Đức** *(DB: `BSCKI`)* | Bác sĩ chính | **II** | **II** | — | Mổ mở & PTNS: **`PT-II`, `PT-III`** *(`PT-I`, `PT-ĐB` cần duyệt vượt cột)* |
| 09 | `10` | **BSCKI. Trần Như Đức** | Bác sĩ chính | **III** | **III** | — | Mổ mở: **`PT-III`** (`07` kỹ thuật); PTNS: `0` kỹ thuật `PT-III` *(từ `PT-II` trở lên cần duyệt vượt cột)* |
| 10 | `11` | **BSCKI. Lê Văn Hoan** | Bác sĩ chính | **III** | **III** | — | Mổ mở: **`PT-III`** (`07` kỹ thuật); PTNS: `0` kỹ thuật `PT-III` *(từ `PT-II` trở lên cần duyệt vượt cột)* |
| 11 | `12` | **BSCKI. Phạm Thị Tuyết Minh** | Bác sĩ chính | **III** | **III** | — | Mổ mở: **`PT-III`** (`07` kỹ thuật); PTNS: `0` kỹ thuật `PT-III` *(từ `PT-II` trở lên cần duyệt vượt cột)* |

> **Ghi chú đồng bộ dữ liệu nhân sự:** Trong bảng kết quả xếp cột năm 2026 của Phòng KHTH và tài liệu lịch khám ngoại trú chuẩn hóa (19/10/2026), 03 bác sĩ `Phạm Vĩnh Phú` (`id: 7`), `Giao Hữu Trường Quy` (`id: 8`), `Trịnh Hoàng Minh Đức` (`id: 9`) có học vị đầy đủ là `ThS. BSCKI.`. Trong `data/db.json` hiện đang lưu trường `title` ngắn gọn là `BSCKI`.

### 2. Khối 08 Bác sĩ Nội trú & Bác sĩ Học viên (Không xếp cột mổ chính)

- Danh sách (`staffId` trong `db.json`): `BS. Học viên Nguyễn Minh Nguyên Phương` (`16`), `BSNT. Nguyễn Đức Thiên Phú` (`43`), `BSNT. Phùng Bùi Tuấn Kiệt` (`44`), `BSNT. Nguyễn Đức Luân` (`45`), `BSNT. Nguyễn Ngọc Minh Khôi` (`46`), `BSNT. Hoàng Bá Sang` (`47`), `BSNT. Lê Minh Thành` (`48`), `BS. Học viên Đặng Cẩm Tú` (`50`).
- **Quy tắc khóa cứng:** Hệ thống chặn không cho phép gán nhóm nhân sự này vào ô `BS mổ chính` (`mainSurgeon`); chỉ cho phép gán vào vị trí Phụ mổ (`assistSurgeon`) và thực hiện bước chuẩn bị hồ sơ tiền phẫu tại 3 POD bệnh phòng.

---

## III. TỔNG HỢP THỐNG KÊ & LƯU Ý LÂM SÀNG TRỌNG YẾU TỪ DANH MỤC 309 PHẪU THUẬT BVBD

### 1. Thống kê phân bố theo Đường mổ và Phân loại phẫu thuật

| Nhóm danh mục (Sheet gốc `.xls`) | `PT-ĐB` | `PT-I` | `PT-II` | `PT-III` | `Không phân loại` | Tổng số dòng |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **1. PHẪU THUẬT NỘI SOI** (`STT 118 – 236`, khuyết mã `232`) | **34** | **80** | **3** | **0** | **1** | **118** |
| **2. PHẪU THUẬT MỞ** (`190` tên kỹ thuật duy nhất; dòng *"Làm hậu môn nhân tạo"* lặp 2 lần) | **39** | **87** | **58** *(57 kỹ thuật)* | **7** | **0** | **191** |
| **TỔNG CỘNG TOÀN DANH MỤC** | **73** | **167** | **61** *(60 kỹ thuật)* | **7** | **1** | **309** |

### 2. Bốn (04) Điểm Lưu Ý Hệ Trọng Khi Xếp Lịch Mổ & Duyệt Mổ Tại Khoa PTĐTT

1. **Nhóm `PHẪU THUẬT NỘI SOI` hoàn toàn KHÔNG CÓ `PT-III` (`0` kỹ thuật) và chỉ có `03` kỹ thuật `PT-II`:**
   - Ba kỹ thuật PTNS duy nhất thuộc `PT-II` gồm: `147` (*Phẫu thuật nội soi mở thông dạ dày*), `187` (*Phẫu thuật nội soi cắt ruột thừa*) và `188` (*Phẫu thuật nội soi cắt ruột thừa + rửa bụng*).
   - Do đó:
     - **03 Bác sĩ `Cột III` (`Trần Như Đức`, `Lê Văn Hoan`, `Phạm Thị Tuyết Minh`):** Không có kỹ thuật PTNS nào tự động đúng cột; nếu đứng `BS mổ chính` bất kỳ ca PTNS nào đều phải có phê duyệt **Vượt cột**.
     - **03 Bác sĩ `Cột II` (`Phạm Vĩnh Phú`, `Giao Hữu Trường Quy`, `Trịnh Hoàng Minh Đức`):** Trong PTNS chỉ tự động đúng cột với PTNS cắt ruột thừa / rửa bụng / mở thông dạ dày (`PT-II`). Các ca `PTNS làm HMNT` (`212`), `PTNS đóng HMNT` (`214`), `PTNS gỡ dính ruột` (`177`), `PTNS điều trị sa trực tràng` (`233–235`), `PTNS cắt đại tràng không nạo hạch` đều thuộc **`PT-I`** → muốn đứng `BS mổ chính` bắt buộc phải có quyết định **Vượt cột** theo từng DVKT.

2. **Ranh giới giữa `PT-I` và `PT-ĐB` trong Phẫu thuật Đại trực tràng (Giữa Bác sĩ `Cột I` và `Cột ĐB`):**
   - **Trong Phẫu thuật nội soi:**
     - Các ca PTNS cắt đại tràng (phải, phải mở rộng, ngang, trái, chậu hông, đoạn ĐT), PTNS cắt đoạn ĐTT, PTNS cắt trực tràng thấp, PTNS cắt trực tràng ống hậu môn ngả bụng-TSM, PTNS Hartmann **KHÔNG kèm nạo vét hạch** + PTNS làm/đóng HMNT + PTNS cố định trực tràng thuộc **`PT-I`** → `BSCKII. Võ Chí Nguyện` (`Cột I`) đứng mổ chính **Đúng cột**.
     - Toàn bộ các ca PTNS cắt đại tràng / đại trực tràng / trực tràng thấp / Miles / Hartmann **CÓ kèm nạo vét hạch** (phẫu thuật ung thư triệt căn), PTNS cắt toàn bộ đại tràng (`203, 204`), và PTNS cắt trực tràng nối đại tràng – ống hậu môn (`219, 220`) đều thuộc **`PT-ĐB`** → mặc định chỉ **04 Bác sĩ `Cột ĐB`** (`Nguyễn Phú Hữu`, `Vũ Khương An`, `Vũ Ngọc Anh Tuấn`, `Bùi Hồng Minh Hậu`) mổ chính đúng cột; Bác sĩ `Cột I` đứng mổ chính phải thuộc diện **Vượt cột**.
   - **Trong Phẫu thuật mở:**
     - Cắt đoạn đại tràng / đại tràng phải / đại tràng trái (nối ngay, đưa 2 đầu ra ngoài hoặc Hartmann), cắt đoạn trực tràng nối ngay hoặc Hartmann, cắt toàn bộ mạc treo trực tràng thuộc **`PT-I`** (`Cột I` và `Cột ĐB` mổ chính đúng cột).
     - Cắt toàn bộ đại tràng / toàn bộ đại trực tràng, cắt đoạn trực tràng miệng nối thấp, nối đại tràng – ống hậu môn, cắt cơ thắt trong bảo tồn cơ thắt ngoài (ISR), cắt cụt trực tràng đường bụng – tầng sinh môn (Miles), bóc phúc mạc kèm cắt các tạng khác thuộc **`PT-ĐB`** (chỉ `Cột ĐB` mặc định đúng cột).

3. **Phân tầng rõ rệt trong nhóm Phẫu thuật Hậu môn – Sàn chậu – Thoát vị (Mổ mở):**
   - **`PT-III` (`07` kỹ thuật — Bác sĩ `Cột III`, `II`, `I`, `ĐB` đều mổ chính đúng cột):**
     1. *Phẫu thuật lấy trĩ tắc mạch* (`PH0980` / `PH2367`)
     2. *Phẫu thuật cắt u nhú ống hậu môn (condylome)* (`PH1313`)
     3. *Mở thông hỗng tràng hoặc mở thông hồi tràng* (`MO0073`)
     4. *Mở thông dạ dày* (`MO0067`)
     5. *Mở bụng thăm dò*
     6. *Mở bụng thăm dò, sinh thiết*
     7. *Nối vị tràng*
   - **`PT-II` (Bác sĩ từ `Cột II` trở lên mổ chính đúng cột; Bác sĩ `Cột III` đứng mổ chính là Vượt cột):**
     - Cắt 1 búi trĩ; Cắt trĩ kinh điển Milligan-Morgan / Ferguson (có hoặc không dụng cụ hỗ trợ); Phẫu thuật Longo; Longo kết hợp khâu treo trĩ; Phẫu thuật THD; Chích/dẫn lưu áp xe cạnh hậu môn đơn giản; Điều trị rò hậu môn đơn giản; Điều trị bệnh Verneuil; Điều trị nứt kẽ hậu môn bằng cắt cơ tròn trong (3h-9h hoặc 6h tạo hình); Cắt da thừa cạnh hậu môn; Cắt u lành tính ống hậu môn; Cắt u, polyp trực tràng đường hậu môn; Làm hậu môn nhân tạo; Thoát vị bẹn 1 bên (Bassini, Shouldice, kết hợp, Lichtenstein); Thoát vị đùi; Cắt ruột thừa mở.
   - **`PT-I` (Bác sĩ từ `Cột I` trở lên mổ chính đúng cột; Bác sĩ `Cột II` & `Cột III` đứng mổ chính là Vượt cột):**
     - Lấy toàn bộ trĩ vòng; Áp xe hậu môn phức tạp; Rò hậu môn phức tạp; Rò hậu môn cắt cơ thắt trên chỉ chờ (Seton); Hẹp hậu môn cắt vòng xơ tạo hình; Phẫu thuật Rectocele; Rối loạn co thắt cơ mu – trực tràng (Anismus); Đứt cơ thắt hậu môn; Đại tiện mất tự chủ; Vết thương tầng sinh môn phức tạp; Sa trực tràng (đường bụng / đường hậu môn); Đóng rò trực tràng – âm đạo / bàng quang / niệu quản / niệu đạo / tầng sinh môn / tiểu khung; Thoát vị bẹn tái phát; Thoát vị bẹn 2 bên; Thoát vị vết mổ thành bụng / thành bụng khác.

4. **Trường hợp `Không phân loại` trong file gốc:**
   - Mã `213` ở Sheet `PHẪU THUẬT NỘI SOI` (*Phẫu thuật nội soi Điều trị Megacolon (phẫu thuật Soave đường hậu môn một thì)*) ghi giá trị `Không phân loại` → khi phát sinh ca mổ này cần xin ý kiến trực tiếp Trưởng khoa / Phòng KHTH.

---

## IV. DANH MỤC ĐẦY ĐỦ 118 KỸ THUẬT PHẪU THUẬT NỘI SOI (NGUYÊN VĂN SSoT)

| STT dòng | Mã số (Sheet 1) | Tên kỹ thuật phẫu thuật nội soi (Theo danh mục gốc BVBD) | Phân loại | Cột BS chính tối thiểu (Đúng cột) | Mã DVKT tham chiếu |
|:---:|:---:|:---|:---:|:---|:---|
| 1 | `118` | Cắt thực quản nội soi ngực và bụng | **PT-ĐB** | Cột ĐB | — |
| 2 | `119` | Cắt thực quản nội soi ngực phải | **PT-ĐB** | Cột ĐB | — |
| 3 | `120` | Cắt thực quản nội soi qua khe hoành | **PT-ĐB** | Cột ĐB | — |
| 4 | `121` | Cắt thực quản nội soi bụng – ngực phải với miệng nối ở ngực phải (phẫu thuật Lewis – Santy) | **PT-ĐB** | Cột ĐB | — |
| 5 | `122` | Cắt u lành thực quản nội soi ngực phải | PT-I | Cột ĐB, Cột I | — |
| 6 | `123` | Cắt u lành thực quản nội soi ngực trái | PT-I | Cột ĐB, Cột I | — |
| 7 | `124` | Cắt u lành thực quản nội soi bụng | PT-I | Cột ĐB, Cột I | — |
| 8 | `125` | Cắt thực quản đôi dạng nang qua nội soi ngực phải | PT-I | Cột ĐB, Cột I | — |
| 9 | `126` | Cắt thực quản đôi dạng nang qua nội soi ngực trái | PT-I | Cột ĐB, Cột I | — |
| 10 | `127` | Cắt thực quản đôi dạng nang qua nội soi bụng | PT-I | Cột ĐB, Cột I | — |
| 11 | `128` | Cắt túi thừa thực quản qua nội soi ngực phải | PT-I | Cột ĐB, Cột I | — |
| 12 | `129` | Cắt túi thừa thực quản qua nội soi ngực trái | PT-I | Cột ĐB, Cột I | — |
| 13 | `130` | Cắt túi thừa thực quản qua nội soi bụng | PT-I | Cột ĐB, Cột I | — |
| 14 | `131` | Phẫu thuật nội soi điều trị teo thực quản bẩm sinh | **PT-ĐB** | Cột ĐB | — |
| 15 | `132` | Phẫu thuật Heller qua nội soi ngực trái | PT-I | Cột ĐB, Cột I | — |
| 16 | `133` | Phẫu thuật Heller qua nội soi bụng | PT-I | Cột ĐB, Cột I | — |
| 17 | `134` | Phẫu thuật Heller  kết hợp tạo van chống trào ngược qua nội soi bụng | **PT-ĐB** | Cột ĐB | — |
| 18 | `135` | Phẫu thuật mở cơ thực quản nội soi ngực phải điều trị bệnh co thắt thực quản nan tỏa | **PT-ĐB** | Cột ĐB | — |
| 19 | `136` | Phẫu thuật tạo van chống trào ngược dạ dày – thực quản qua nội soi | PT-I | Cột ĐB, Cột I | `PH0784` |
| 20 | `137` | Phẫu thuật nội soi điều trị thoát vị khe hoành | PT-I | Cột ĐB, Cột I | `PH1369` |
| 21 | `138` | Phẫu thuật nội soi tạo hình thực quản bằng dạ dày | **PT-ĐB** | Cột ĐB | `PH0790` |
| 22 | `139` | Phẫu thuật nội soi tạo hình thực quản bằng đại tràng | **PT-ĐB** | Cột ĐB | `PH0791` |
| 23 | `140` | Phẫu thuật nội soi cố định dạ dày | PT-I | Cột ĐB, Cột I | `PH1370` |
| 24 | `141` | Phẫu thuật nội soi điều trị hẹp môn vị phì đại | PT-I | Cột ĐB, Cột I | — |
| 25 | `142` | Phẫu thuật nội soi khâu thủng dạ dày | PT-I | Cột ĐB, Cột I | `KH0072` |
| 26 | `143` | Phẫu thuật nội soi khâu thủng dạ dày + nối dạ dày-hỗng tràng | PT-I | Cột ĐB, Cột I | `PH1371` |
| 27 | `144` | Phẫu thuật nội soi khâu vết thương dạ dày | PT-I | Cột ĐB, Cột I | `PH0786` |
| 28 | `145` | Phẫu thuật nội soi khâu vết thương dạ dày + nối dạ dày-hỗng tràng | PT-I | Cột ĐB, Cột I | `PH1372` |
| 29 | `146` | Phẫu thuật nội soi qua dạ dày cắt polyp dạ dày (Intraluminal Lap Surgery) | PT-I | Cột ĐB, Cột I | — |
| 30 | `147` | Phẫu thuật nội soi mở thông dạ dày | PT-II | Cột ĐB, Cột I, Cột II | `PH1373` |
| 31 | `148` | Phẫu thuật nội soi cắt thân thần kinh X | PT-I | Cột ĐB, Cột I | — |
| 32 | `149` | Phẫu thuật nội soi cắt thần kinh X chọn lọc | PT-I | Cột ĐB, Cột I | — |
| 33 | `150` | Phẫu thuật nội soi cắt thần kinh X siêu chọn lọc | PT-I | Cột ĐB, Cột I | — |
| 34 | `151` | Phẫu thuật nội soi điều trị xoắn dạ dày  có kèm cắt dạ dày | PT-I | Cột ĐB, Cột I | `PH0806` |
| 35 | `152` | Phẫu thuật nội soi nối dạ dày - hỗng tràng | PT-I | Cột ĐB, Cột I | `PH0835` |
| 36 | `153` | Phẫu thuật nội soi nối dạ dày - hỗng tràng, nối túi mật-hỗng tràng | PT-I | Cột ĐB, Cột I | `PH0836` |
| 37 | `154` | Phẫu thuật nội soi cắt dạ dày không điển hình | PT-I | Cột ĐB, Cột I | `PH0798` |
| 38 | `155` | Phẫu thuật nội soi cắt 2/3 dạ dày | PT-I | Cột ĐB, Cột I | `PH0807` |
| 39 | `156` | Phẫu thuật nội soi cắt 3/4 dạ dày | PT-I | Cột ĐB, Cột I | `PH0808` |
| 40 | `157` | Phẫu thuật nội soi cắt toàn bộ dạ dày | **PT-ĐB** | Cột ĐB | `PH0799` |
| 41 | `158` | Phẫu thuật nội soi cắt toàn bộ dạ dày + cắt lách | **PT-ĐB** | Cột ĐB | `PH0800` |
| 42 | `159` | Phẫu thuật nội soi cắt bán phần dưới dạ dày + nạo hạch D1 | **PT-ĐB** | Cột ĐB | `PH0811` |
| 43 | `160` | Phẫu thuật nội soi cắt bán phần dưới dạ dày + nạo hạch D1α | **PT-ĐB** | Cột ĐB | `PH0812` |
| 44 | `161` | Phẫu thuật nội soi cắt bán phần dưới dạ dày + nạo hạch D1β | **PT-ĐB** | Cột ĐB | `PH0813` |
| 45 | `162` | Phẫu thuật nội soi cắt bán phần dưới dạ dày + nạo hạch D2 | **PT-ĐB** | Cột ĐB | `PH0809` |
| 46 | `163` | Phẫu thuật nội soi cắt bán phần dưới dạ dày + nạo hạch D3 | **PT-ĐB** | Cột ĐB | `PH0810` |
| 47 | `164` | Phẫu thuật nội soi cắt toàn bộ dạ dày + nạo hạch D2 | **PT-ĐB** | Cột ĐB | `PH0802` |
| 48 | `165` | Phẫu thuật nội soi cắt toàn bộ dạ dày + cắt lách + nạo hạch D2 | **PT-ĐB** | Cột ĐB | `PH0801` |
| 49 | `166` | Phẫu thuật nội soi khâu thủng tá tràng | PT-I | Cột ĐB, Cột I | — |
| 50 | `167` | Phẫu thuật nội soi khâu vết thương tá tràng | PT-I | Cột ĐB, Cột I | — |
| 51 | `168` | Phẫu thuật nội soi khâu thủng tá tràng + nối dạ dày-hỗng tràng | PT-I | Cột ĐB, Cột I | `PH0852` |
| 52 | `169` | Phẫu thuật nội soi khâu vết thương tá tràng + nối dạ dày-hỗng tràng | PT-I | Cột ĐB, Cột I | `PH0834` |
| 53 | `170` | Phẫu thuật nội soi cắt túi thừa tá tràng | **PT-ĐB** | Cột ĐB | — |
| 54 | `171` | Phẫu thuật nội soi cắt đoạn tá tràng | **PT-ĐB** | Cột ĐB | — |
| 55 | `172` | Phẫu thuật nội soi khâu thủng ruột non | PT-I | Cột ĐB, Cột I | — |
| 56 | `173` | Phẫu thuật nội soi khâu vết thương ruột non | PT-I | Cột ĐB, Cột I | — |
| 57 | `174` | Phẫu thuật nội soi khâu thủng ruột non + đưa ruột non ra da trên dòng | PT-I | Cột ĐB, Cột I | — |
| 58 | `175` | Phẫu thuật nội soi khâu vết thương ruột non + đưa ruột non ra da trên dòng | PT-I | Cột ĐB, Cột I | — |
| 59 | `176` | Phẫu thuật nội soi nối tắt ruột non - ruột non | PT-I | Cột ĐB, Cột I | — |
| 60 | `177` | Phẫu thuật nội soi gỡ dính ruột | PT-I | Cột ĐB, Cột I | — |
| 61 | `178` | Phẫu thuật nội soi cắt dây dính hay dây chằng | PT-I | Cột ĐB, Cột I | — |
| 62 | `179` | Phẫu thuật nội soi mở hỗng tràng ra da | PT-I | Cột ĐB, Cột I | — |
| 63 | `180` | Phẫu thuật nội soi mở hồi tràng ra da | PT-I | Cột ĐB, Cột I | `PH1382` |
| 64 | `181` | Phẫu thuật nội soi mở ruột lấy dị vật | PT-I | Cột ĐB, Cột I | — |
| 65 | `182` | Phẫu thuật nội soi điều trị hẹp môn vị phì đại | PT-I | Cột ĐB, Cột I | — |
| 66 | `183` | Phẫu thuật nội soi tháo lồng ruột và cố định manh tràng | PT-I | Cột ĐB, Cột I | `PH0859` |
| 67 | `184` | Phẫu thuật nội soi cắt túi thừa Meckel | PT-I | Cột ĐB, Cột I | — |
| 68 | `185` | Phẫu thuật nội soi cắt đoạn ruột non | PT-I | Cột ĐB, Cột I | — |
| 69 | `186` | Phẫu thuật nội soi cắt gần toàn bộ ruột non | **PT-ĐB** | Cột ĐB | — |
| 70 | `187` | Phẫu thuật nội soi cắt ruột thừa | PT-II | Cột ĐB, Cột I, Cột II | — |
| 71 | `188` | Phẫu thuật nội soi cắt ruột thừa + rửa bụng | PT-II | Cột ĐB, Cột I, Cột II | — |
| 72 | `189` | Phẫu thuật nội soi cắt lại mỏm ruột thừa | PT-I | Cột ĐB, Cột I | — |
| 73 | `190` | Phẫu thuật nội soi điều trị áp xe ruột thừa trong ổ bụng | PT-I | Cột ĐB, Cột I | — |
| 74 | `191` | Phẫu thuật nội soi viêm phúc mạc do viêm ruột thừa | PT-I | Cột ĐB, Cột I | — |
| 75 | `192` | Phẫu thuật nội soi cắt manh tràng | PT-I | Cột ĐB, Cột I | — |
| 76 | `193` | Phẫu thuật nội soi cắt đại tràng phải | PT-I | Cột ĐB, Cột I | — |
| 77 | `194` | Phẫu thuật nội soi cắt đại tràng phải + nạo vét hạch | **PT-ĐB** | Cột ĐB | `PH0868` |
| 78 | `195` | Phẫu thuật nội soi cắt đại tràng phải mở rộng | PT-I | Cột ĐB, Cột I | `PH0830` |
| 79 | `196` | Phẫu thuật nội soi cắt đại tràng phải mở + nạo vét hạch rộng | **PT-ĐB** | Cột ĐB | `PH0869` |
| 80 | `197` | Phẫu thuật nội soi cắt đại tràng ngang | PT-I | Cột ĐB, Cột I | `PH0829` |
| 81 | `198` | Phẫu thuật nội soi cắt đại tràng ngang + nạo vét hạch | **PT-ĐB** | Cột ĐB | `PH0867` |
| 82 | `199` | Phẫu thuật nội soi cắt đại tràng trái | PT-I | Cột ĐB, Cột I | `PH0831` |
| 83 | `200` | Phẫu thuật nội soi cắt đại tràng trái+ nạo vét hạch | **PT-ĐB** | Cột ĐB | `PH0870` |
| 84 | `201` | Phẫu thuật nội soi cắt đại tràng chậu hông | PT-I | Cột ĐB, Cột I | `PH0828` |
| 85 | `202` | Phẫu thuật nội soi cắt đại tràng chậu hông+ nạo vét hạch | **PT-ĐB** | Cột ĐB | `PH0866` |
| 86 | `203` | Phẫu thuật nội soi cắt toàn bộ đại tràng | **PT-ĐB** | Cột ĐB | `PH0839` |
| 87 | `204` | Phẫu thuật nội soi cắt toàn bộ đại tràng + nạo vét hạch | **PT-ĐB** | Cột ĐB | `PH0864` |
| 88 | `205` | Phẫu thuật nội soi cắt đoạn đại tràng | PT-I | Cột ĐB, Cột I | `PH0832` |
| 89 | `206` | Phẫu thuật nội soi cắt túi thừa đại tràng | PT-I | Cột ĐB, Cột I | `PH1391` |
| 90 | `207` | Phẫu thuật nội soi khâu thủng đại tràng | PT-I | Cột ĐB, Cột I | `PH1392` |
| 91 | `208` | Phẫu thuật nội soi khâu thủng đại tràng + hậu môn nhân tạo trên dòng | PT-I | Cột ĐB, Cột I | `PH0814` |
| 92 | `209` | Phẫu thuật nội soi khâu vết thương đại tràng + hậu môn nhân tạo | PT-I | Cột ĐB, Cột I | `PH1395` |
| 93 | `210` | Phẫu thuật nội soi nối tắt hồi tràng - đại tràng ngang | PT-I | Cột ĐB, Cột I | `PH0838` |
| 94 | `211` | Phẫu thuật nội soi nối tắt đại tràng - đại tràng | PT-I | Cột ĐB, Cột I | `PH0837` |
| 95 | `212` | Phẫu thuật nội soi làm hậu môn nhân tạo | PT-I | Cột ĐB, Cột I | `PH1396` |
| 96 | `213` | Phẫu thuật nội soi Điều trị Megacolon (phẫu thuật Soave đường hậu môn một thì) | Không phân loại | Xin ý kiến BCN / KHTH | — |
| 97 | `214` | Phẫu thuật nội soi đóng hậu môn nhân tạo | PT-I | Cột ĐB, Cột I | — |
| 98 | `215` | Phẫu thuật nội soi cắt đoạn đại trực tràng | PT-I | Cột ĐB, Cột I | `PH0833` |
| 99 | `216` | Phẫu thuật nội soi cắt đoạn đại trực tràng+ nạo vét hạch | **PT-ĐB** | Cột ĐB | `PH0872` |
| 100 | `217` | Phẫu thuật nội soi cắt trực tràng thấp | PT-I | Cột ĐB, Cột I | `PH0846` |
| 101 | `218` | Phẫu thuật nội soi cắt trực tràng thấp+ nạo vét hạch | **PT-ĐB** | Cột ĐB | `PH0865` |
| 102 | `219` | Phẫu thuật nội soi cắt trực tràng, nối đại tràng - ống hậu môn | **PT-ĐB** | Cột ĐB | `PH0847` |
| 103 | `220` | Phẫu thuật nội soi cắt trực tràng, nối đại tràng - ống hậu môn+ nạo vét hạch+ nạo vét hạch | **PT-ĐB** | Cột ĐB | `PH0871` |
| 104 | `221` | Phẫu thuật nội soi cắt trực tràng, ống hậu môn ngả bụng và tầng sinh môn | PT-I | Cột ĐB, Cột I | `PH1397` |
| 105 | `222` | Phẫu thuật nội soi cắt trực tràng, ống hậu môn ngả bụng và tầng sinh môn + nạo vét hạch | **PT-ĐB** | Cột ĐB | `PH0874` |
| 106 | `223` | Phẫu thuật nội soi cắt trực tràng, đóng mỏm cụt trực tràng, mở hậu môn nhân tạo | PT-I | Cột ĐB, Cột I | `PH1398` |
| 107 | `224` | Phẫu thuật nội soi cắt trực tràng, đóng mỏm cụt trực tràng, mở hậu môn nhân tạo+ nạo vét hạch | **PT-ĐB** | Cột ĐB | `PH0873` |
| 108 | `225` | Phẫu thuật nội soi cố định trực tràng | PT-I | Cột ĐB, Cột I | `PH0859` |
| 109 | `226` | Phẫu thuật nội soi cố định trực tràng + cắt đoạn đại tràng | PT-I | Cột ĐB, Cột I | `PH0860` |
| 110 | `227` | Phẫu thuật nội soi khâu thủng trực tràng | PT-I | Cột ĐB, Cột I | `PH1399` |
| 111 | `228` | Phẫu thuật nội soi khâu thủng trực tràng + hậu môn nhân tạo | PT-I | Cột ĐB, Cột I | `PH1400` |
| 112 | `229` | Phẫu thuật nội soi khâu vết thương trực tràng | PT-I | Cột ĐB, Cột I | `PH1401` |
| 113 | `230` | Phẫu thuật nội soi khâu vết thương trực tràng + hậu môn nhân tạo trên dòng | PT-I | Cột ĐB, Cột I | `PH1402` |
| 114 | `231` | Phẫu thuật nội soi khâu miệng nối đại-trực tràng, rửa bụng, dẫn lưu (xì miệng nối đại - trực tràng) | PT-I | Cột ĐB, Cột I | — |
| 115 | `233` | Phẫu thuật nội soi cắt đoạn trực tràng trong điều trị sa trực tràng | PT-I | Cột ĐB, Cột I | `PH0843` |
| 116 | `234` | Phẫu thuật nội soi cố định trực tràng trong điều trị sa trực tràng | PT-I | Cột ĐB, Cột I | `PH0862` |
| 117 | `235` | Phẫu thuật nội soi cố định trực tràng bằng lưới trong điều trị sa trực tràng | PT-I | Cột ĐB, Cột I | `PH0861` |
| 118 | `236` | Phẫu thuật nội soi điều trị rò hậu môn | PT-I | Cột ĐB, Cột I | — |


---

## V. DANH MỤC ĐẦY ĐỦ 191 DÒNG KỸ THUẬT PHẪU THUẬT MỞ (NGUYÊN VĂN SSoT)

> *Ghi chú đối chiếu dữ liệu gốc:* Trong tệp `BVBD_PHÂN LOẠI PHẪU THUẬT_nhóm NGOẠI TIÊU HOÁ.xls` (Sheet `PHẪU THUẬT MỞ`), dòng kỹ thuật **`Làm hậu môn nhân tạo` (`PT-II`)** xuất hiện 02 lần liên tiếp tại dòng 111 và dòng 112 của bảng dưới đây (tương ứng hàng 112–113 trong Excel). Bảng dưới giữ nguyên vẹn 100% thứ tự `191` dòng của tệp gốc để đảm bảo tính toàn vẹn đối chiếu kiểm toán.

| STT dòng | Tên kỹ thuật phẫu thuật mở (Theo danh mục gốc BVBD) | Phân loại | Cột BS chính tối thiểu (Đúng cột) | Mã DVKT tham chiếu |
|:---:|:---|:---:|:---|:---|
| 1 | Mở ngực thăm dò | PT-II | Cột ĐB, Cột I, Cột II | — |
| 2 | Mở ngực thăm dò, sinh thiết | PT-II | Cột ĐB, Cột I, Cột II | — |
| 3 | Mở thông dạ dày | PT-III | Cột ĐB, Cột I, Cột II, Cột III | `MO0067` |
| 4 | Đưa thực quản ra ngoài | PT-I | Cột ĐB, Cột I | — |
| 5 | Dẫn lưu áp xe thực quản, trung thất | PT-I | Cột ĐB, Cột I | — |
| 6 | Khâu lỗ thủng hoặc vết thương thực quản | PT-I | Cột ĐB, Cột I | — |
| 7 | Lấy dị vật thực quản đường cổ | PT-I | Cột ĐB, Cột I | — |
| 8 | Lấy dị vật thực quản đường ngực | PT-I | Cột ĐB, Cột I | — |
| 9 | Lấy dị vật thực quản đường bụng | PT-I | Cột ĐB, Cột I | — |
| 10 | Đóng rò thực quản | **PT-ĐB** | Cột ĐB | `DO0069` |
| 11 | Đóng lỗ rò thực quản – khí quản | **PT-ĐB** | Cột ĐB | `DO0070` |
| 12 | Cắt túi thừa thực quản cổ | PT-I | Cột ĐB, Cột I | — |
| 13 | Cắt túi thừa thực quản ngực | **PT-ĐB** | Cột ĐB | — |
| 14 | Lấy u cơ, xơ…thực quản đường ngực | PT-I | Cột ĐB, Cột I | — |
| 15 | Lấy u cơ, xơ…thực quản đường cổ hoặc đường bụng | PT-I | Cột ĐB, Cột I | — |
| 16 | Cắt đoạn thực quản, dẫn lưu hai đầu ra ngoài | **PT-ĐB** | Cột ĐB | — |
| 17 | Cắt nối thực quản | **PT-ĐB** | Cột ĐB | — |
| 18 | Cắt thực quản, tạo hình thực quản bằng dạ dày không mở ngực | **PT-ĐB** | Cột ĐB | `CA0557` |
| 19 | Cắt thực quản, tạo hình thực quản bằng dạ dày đường bụng, ngực, cổ | **PT-ĐB** | Cột ĐB | `CA0556` |
| 20 | Cắt thực quản, tạo hình thực quản bằng dạ dày đường bụng, ngực | **PT-ĐB** | Cột ĐB | `CA0555` |
| 21 | Cắt thực quản, tạo hình thực quản bằng đại tràng không mở ngực | **PT-ĐB** | Cột ĐB | `CA0545` |
| 22 | Cắt thực quản, tạo hình thực quản bằng đại tràng đường bụng, ngực, cổ | **PT-ĐB** | Cột ĐB | `CA0559` |
| 23 | Cắt thực quản, tạo hình thực quản bằng đại tràng đường bụng, ngực | **PT-ĐB** | Cột ĐB | `CA0558` |
| 24 | Cắt thực quản, cắt toàn bộ dạ dày, tạo hình thực quản bằng đoạn đại tràng hoặc ruột non | **PT-ĐB** | Cột ĐB | `CA0554` |
| 25 | Cắt thực quản, hạ họng, thanh quản | **PT-ĐB** | Cột ĐB | — |
| 26 | Cắt thực quản, tạo hình thực quản bằng quai ruột (ruột non, đại tràng vi phẫu) | **PT-ĐB** | Cột ĐB | — |
| 27 | Tạo hình thực quản bằng dạ dày không cắt thực quản | **PT-ĐB** | Cột ĐB | `TA0117` |
| 28 | Tạo hình thực quản bằng đại tràng không cắt thực quản | **PT-ĐB** | Cột ĐB | `TA0118` |
| 29 | Phẫu thuật điều trị thực quản đôi | PT-I | Cột ĐB, Cột I | — |
| 30 | Phẫu thuật điều trị teo thực quản | **PT-ĐB** | Cột ĐB | — |
| 31 | Nạo vét hạch trung thất | PT-I | Cột ĐB, Cột I | — |
| 32 | Nạo vét hạch cổ | PT-I | Cột ĐB, Cột I | — |
| 33 | Phẫu thuật điều trị co thắt thực quản lan tỏa | **PT-ĐB** | Cột ĐB | — |
| 34 | Phẫu thuật Heller | PT-I | Cột ĐB, Cột I | — |
| 35 | Tạo van chống trào ngược dạ dày – thực quản | PT-I | Cột ĐB, Cột I | — |
| 36 | Tạo hình tại chỗ sẹo hẹp thực quản đường cổ | PT-I | Cột ĐB, Cột I | — |
| 37 | Các phẫu thuật thực quản khác | PT-I | Cột ĐB, Cột I | — |
| 38 | Mở bụng thăm dò | PT-III | Cột ĐB, Cột I, Cột II, Cột III | — |
| 39 | Mở bụng thăm dò, sinh thiết | PT-III | Cột ĐB, Cột I, Cột II, Cột III | — |
| 40 | Nối vị tràng | PT-III | Cột ĐB, Cột I, Cột II, Cột III | — |
| 41 | Cắt dạ dày hình chêm | PT-II | Cột ĐB, Cột I, Cột II | `CA0875` |
| 42 | Cắt đoạn dạ dày | PT-I | Cột ĐB, Cột I | `CA0575` |
| 43 | Cắt đoạn dạ dày và mạc nối lớn | PT-I | Cột ĐB, Cột I | `CA0576` |
| 44 | Cắt toàn bộ dạ dày | **PT-ĐB** | Cột ĐB | `CA0578` |
| 45 | Cắt lại dạ dày | **PT-ĐB** | Cột ĐB | `CA0577` |
| 46 | Nạo vét hạch D1 | PT-II | Cột ĐB, Cột I, Cột II | — |
| 47 | Nạo vét hạch D2 | PT-I | Cột ĐB, Cột I | — |
| 48 | Nạo vét hạch D3 | **PT-ĐB** | Cột ĐB | — |
| 49 | Nạo vét hạch D4 | **PT-ĐB** | Cột ĐB | — |
| 50 | Khâu lỗ thủng dạ dày tá tràng | PT-II | Cột ĐB, Cột I, Cột II | `KH0076` |
| 51 | Phẫu thuật Newmann | PT-II | Cột ĐB, Cột I, Cột II | — |
| 52 | Khâu cầm máu ổ loét dạ dày | PT-II | Cột ĐB, Cột I, Cột II | `KH0075` |
| 53 | Cắt thần kinh X toàn bộ | PT-I | Cột ĐB, Cột I | — |
| 54 | Cắt thần kinh X chọn lọc | PT-I | Cột ĐB, Cột I | — |
| 55 | Cắt thần kinh X siêu chọn lọc | PT-I | Cột ĐB, Cột I | — |
| 56 | Mở cơ môn vị | PT-II | Cột ĐB, Cột I, Cột II | — |
| 57 | Tạo hình môn vị | PT-II | Cột ĐB, Cột I, Cột II | — |
| 58 | Mở dạ dày xử lý tổn thương | PT-II | Cột ĐB, Cột I, Cột II | `MO0102` |
| 59 | Các phẫu thuật dạ dày khác | PT-II | Cột ĐB, Cột I, Cột II | — |
| 60 | Cắt u tá tràng | PT-I | Cột ĐB, Cột I | — |
| 61 | Cắt tá tràng bảo tồn đầu tụy | **PT-ĐB** | Cột ĐB | — |
| 62 | Khâu vùi túi thừa tá tràng | PT-I | Cột ĐB, Cột I | — |
| 63 | Cắt túi thừa tá tràng | PT-I | Cột ĐB, Cột I | — |
| 64 | Cắt bóng Vater và tạo hình ống mật chủ, ống Wirsung qua đường mở D2 tá tràng | **PT-ĐB** | Cột ĐB | — |
| 65 | Cắt màng ngăn tá tràng | PT-I | Cột ĐB, Cột I | — |
| 66 | Mở thông hỗng tràng hoặc mở thông hồi tràng | PT-III | Cột ĐB, Cột I, Cột II, Cột III | `MO0073` |
| 67 | Khâu lỗ thủng hoặc khâu vết thương ruột non | PT-II | Cột ĐB, Cột I, Cột II | — |
| 68 | Cắt dây chằng, gỡ dính ruột | PT-II | Cột ĐB, Cột I, Cột II | — |
| 69 | Tháo xoắn ruột non | PT-II | Cột ĐB, Cột I, Cột II | — |
| 70 | Tháo lồng ruột non | PT-II | Cột ĐB, Cột I, Cột II | — |
| 71 | Đẩy bã thức ăn xuống đại tràng | PT-II | Cột ĐB, Cột I, Cột II | `DA0126` |
| 72 | Mở ruột non lấy dị vật (bã thức ăn, giun, mảnh kim loại,…) | PT-I | Cột ĐB, Cột I | — |
| 73 | Cắt ruột non hình chêm | PT-II | Cột ĐB, Cột I, Cột II | — |
| 74 | Cắt đoạn ruột non, lập lại lưu thông | PT-I | Cột ĐB, Cột I | — |
| 75 | Cắt đoạn ruột non, đưa hai đầu ruột ra ngoài | PT-I | Cột ĐB, Cột I | — |
| 76 | Cắt đoạn ruột non, nối tận bên, đưa 1 đầu  ra ngoài (Quénue) | PT-I | Cột ĐB, Cột I | — |
| 77 | Cắt nhiều đoạn ruột non | **PT-ĐB** | Cột ĐB | — |
| 78 | Gỡ dính sau mổ lại | PT-I | Cột ĐB, Cột I | — |
| 79 | Phẫu thuật điều trị apxe tồn dư, dẫn lưu ổ bụng | PT-I | Cột ĐB, Cột I | — |
| 80 | Đóng mở thông ruột non | PT-II | Cột ĐB, Cột I, Cột II | — |
| 81 | Nối tắt ruột non - đại tràng hoặc trực tràng | PT-II | Cột ĐB, Cột I, Cột II | `NO0287` |
| 82 | Nối tắt ruột non - ruột non | PT-II | Cột ĐB, Cột I, Cột II | — |
| 83 | Cắt mạc nối lớn | PT-II | Cột ĐB, Cột I, Cột II | — |
| 84 | Cắt bỏ u mạc nối lớn | PT-II | Cột ĐB, Cột I, Cột II | — |
| 85 | Cắt u mạc treo ruột | PT-I | Cột ĐB, Cột I | — |
| 86 | Khâu vết thương tĩnh mạch mạc treo tràng trên | **PT-ĐB** | Cột ĐB | — |
| 87 | Khâu vết thương động mạch mạc treo tràng trên | **PT-ĐB** | Cột ĐB | — |
| 88 | Bắc cầu động mạch mạc treo tràng trên bằng đoạn tĩnh mạch hiển hoặc đoạn mạch nhân tạo | **PT-ĐB** | Cột ĐB | — |
| 89 | Cắt đoạn động mạch mạc treo tràng trên, nối động mạch trực tiếp | **PT-ĐB** | Cột ĐB | — |
| 90 | Cắt toàn bộ ruột non | **PT-ĐB** | Cột ĐB | — |
| 91 | Ghép ruột non | **PT-ĐB** | Cột ĐB | — |
| 92 | Các phẫu thuật tá tràng  khác | PT-I | Cột ĐB, Cột I | — |
| 93 | Cắt ruột thừa đơn thuần | PT-II | Cột ĐB, Cột I, Cột II | — |
| 94 | Cắt ruột thừa, lau rửa ổ bụng | PT-II | Cột ĐB, Cột I, Cột II | — |
| 95 | Cắt ruột thừa, dẫn lưu ổ apxe | PT-II | Cột ĐB, Cột I, Cột II | — |
| 96 | Dẫn lưu áp xe ruột thừa | PT-II | Cột ĐB, Cột I, Cột II | — |
| 97 | Các phẫu thuật ruột thừa khác | PT-II | Cột ĐB, Cột I, Cột II | — |
| 98 | Dẫn lưu hoặc mở thông manh tràng | PT-II | Cột ĐB, Cột I, Cột II | — |
| 99 | Khâu lỗ thủng đại tràng | PT-II | Cột ĐB, Cột I, Cột II | `KH0077` |
| 100 | Cắt túi thừa đại tràng | PT-II | Cột ĐB, Cột I, Cột II | `CA0885` |
| 101 | Cắt đoạn đại tràng nối ngay | PT-I | Cột ĐB, Cột I | `CA0598` |
| 102 | Cắt đoạn đại tràng, đưa 2 đầu đại tràng ra ngoài | PT-I | Cột ĐB, Cột I | `CA0588` |
| 103 | Cắt đoạn đại tràng, đóng đầu dưới, đưa đầu trên ra ngoài ổ bụng kiểu Hartmann | PT-I | Cột ĐB, Cột I | `CA0587` |
| 104 | Cắt manh tràng và đoạn cuối hồi tràng | PT-I | Cột ĐB, Cột I | `CA0594` |
| 105 | Cắt đại tràng phải hoặc đại tràng trái nối ngay | PT-I | Cột ĐB, Cột I | `CA0583` |
| 106 | Cắt đại tràng phải hoặc đại tràng trái, đưa 2 đầu ruột ra ngoài | PT-I | Cột ĐB, Cột I | `CA0597` |
| 107 | Cắt đại tràng phải hoặc đại tràng trái, đóng đầu dưới, đưa đầu trên ra ngoài kiểu Hartmann | PT-I | Cột ĐB, Cột I | `CA0584` |
| 108 | Cắt toàn bộ đại tràng, nối ngay ruột non – trực tràng | **PT-ĐB** | Cột ĐB | `CA0595` |
| 109 | Cắt toàn bộ đại trực tràng, nối ngay ruột non - ống hậu môn | **PT-ĐB** | Cột ĐB | `CA0585` |
| 110 | Cắt toàn bộ đại trực tràng, đưa hồi tràng ra làm hậu môn nhân tạo | **PT-ĐB** | Cột ĐB | `CA0596` |
| 111 | Làm hậu môn nhân tạo | PT-II | Cột ĐB, Cột I, Cột II | `LA0099` |
| 112 | Làm hậu môn nhân tạo | PT-II | Cột ĐB, Cột I, Cột II | `LA0099` |
| 113 | Lấy dị vật trực tràng | PT-II | Cột ĐB, Cột I, Cột II | `LA0089` |
| 114 | Cắt đoạn trực tràng nối ngay | PT-I | Cột ĐB, Cột I | `CA0589` |
| 115 | Cắt đoạn trực tràng, đóng đầu dưới đưa đầu trên ra ngoài kiểu Hartmann | PT-I | Cột ĐB, Cột I | `CA0591` |
| 116 | Cắt đoạn trực tràng, miệng nối đại trực tràng thấp | **PT-ĐB** | Cột ĐB | `CA0593` |
| 117 | Cắt đoạn trực tràng, miệng nối đại tràng - ống hậu môn | **PT-ĐB** | Cột ĐB | `CA0592` |
| 118 | Cắt đoạn trực tràng, cơ thắt trong bảo tồn cơ thắt ngoài đường tầng sinh môn | **PT-ĐB** | Cột ĐB | `CA0590` |
| 119 | Cắt cụt trực tràng đường bụng, tầng sinh môn | **PT-ĐB** | Cột ĐB | `CA0606` |
| 120 | Cắt u, polyp trực tràng đường hậu môn | PT-II | Cột ĐB, Cột I, Cột II | `CA1417`, `PH0963` |
| 121 | Khâu lỗ thủng, vết thương trực tràng | PT-I | Cột ĐB, Cột I | `KH0073` |
| 122 | Phẫu thuật điều trị sa trực tràng đường bụng | PT-I | Cột ĐB, Cột I | `PH1309` |
| 123 | Phẫu thuật điều trị sa trực tràng qua đường hậu môn | PT-I | Cột ĐB, Cột I | `PH1310` |
| 124 | Cắt toàn bộ mạc treo trực tràng | PT-I | Cột ĐB, Cột I | `CA0887` |
| 125 | Bóc u xơ, cơ..trực tràng đường bụng | PT-I | Cột ĐB, Cột I | `BO0030` |
| 126 | Bóc u xơ, cơ..trực tràng đường tầng sinh môn | PT-I | Cột ĐB, Cột I | `BO0087`, `BO0051` |
| 127 | Đóng rò trực tràng – âm đạo | PT-I | Cột ĐB, Cột I | `DO0042` |
| 128 | Đóng rò trực tràng – bàng quang | PT-I | Cột ĐB, Cột I | `DO0043` |
| 129 | Phẫu thuật điều trị rò trực tràng – niệu quản | PT-I | Cột ĐB, Cột I | `PH0879` |
| 130 | Phẫu thuật điều trị rò trực tràng – niệu đạo | PT-I | Cột ĐB, Cột I | `PH0878` |
| 131 | Phẫu thuật điều trị rò trực tràng – tầng sinh môn | PT-I | Cột ĐB, Cột I | `PH0880` |
| 132 | Phẫu thuật điều trị rò trực tràng – tiểu khung | PT-I | Cột ĐB, Cột I | `PH0881` |
| 133 | Các phẫu thuật trực tràng khác | PT-II | Cột ĐB, Cột I, Cột II | — |
| 134 | Phẫu thuật cắt 1 búi trĩ | PT-II | Cột ĐB, Cột I, Cột II | `PH2360`, `PH0964` |
| 135 | Phẫu thuật lấy trĩ tắc mạch | PT-III | Cột ĐB, Cột I, Cột II, Cột III | `PH2367`, `PH0980` |
| 136 | Phẫu thuật cắt trĩ kinh điển (phương pháp Milligan – Morgan hoặc Ferguson) | PT-II | Cột ĐB, Cột I, Cột II | `PH2362`, `PH0969` |
| 137 | Phẫu thuật cắt trĩ kinh điển có sử dụng dụng cụ hỗ trợ | PT-II | Cột ĐB, Cột I, Cột II | `PH2331`, `PH0970` |
| 138 | Phẫu thuật lấy toàn bộ trĩ vòng | PT-I | Cột ĐB, Cột I | `PH2333`, `PH0975` |
| 139 | Phẫu thuật Longo | PT-II | Cột ĐB, Cột I, Cột II | — |
| 140 | Phẫu thuật Longo kết hợp với khâu treo trĩ | PT-II | Cột ĐB, Cột I, Cột II | `PH0983` |
| 141 | Phẫu thuật khâu treo và triệt mạch trĩ (THD) | PT-II | Cột ĐB, Cột I, Cột II | `PH2334`, `PH0974` |
| 142 | Phẫu thuật chích, dẫn lưu áp xe cạnh hậu môn đơn giản | PT-II | Cột ĐB, Cột I, Cột II | — |
| 143 | Phẫu thuật điều trị áp xe hậu môn phức tạp | PT-I | Cột ĐB, Cột I | — |
| 144 | Phẫu thuật điều trị rò hậu môn đơn giản | PT-II | Cột ĐB, Cột I, Cột II | `PH2337`, `PH0979` |
| 145 | Phẫu thuật điều trị rò hậu môn phức tạp | PT-I | Cột ĐB, Cột I | `PH2354`, `PH0973` |
| 146 | Phẫu thuật điều trị rò hậu môn cắt cơ thắt trên chỉ chờ | PT-I | Cột ĐB, Cột I | `PH2356`, `PH0972` |
| 147 | Phẫu thuật điều trị bệnh Verneuil | PT-II | Cột ĐB, Cột I, Cột II | — |
| 148 | Điều trị nứt kẽ hậu môn bằng cắt cơ tròn trong (vị trí 3 giờ và 9 giờ) | PT-II | Cột ĐB, Cột I, Cột II | `DI0307`, `CA0679` |
| 149 | Điều trị nứt kẽ hậu môn bằng cắt cơ tròn trong vị trí 6 giờ, tạo hình hậu môn | PT-II | Cột ĐB, Cột I, Cột II | `DI0305`, `DI0104` |
| 150 | Điều trị hẹp hậu môn bằng cắt vòng xơ, tạo hình hậu môn | PT-I | Cột ĐB, Cột I | — |
| 151 | Phẫu thuật điều trị bệnh Rectocelle | PT-I | Cột ĐB, Cột I | — |
| 152 | Phẫu thuật cắt da thừa cạnh hậu môn | PT-II | Cột ĐB, Cột I, Cột II | — |
| 153 | Phẫu thuật cắt u nhú ống hậu môn (condylome) | PT-III | Cột ĐB, Cột I, Cột II, Cột III | `PH1313` |
| 154 | Cắt u lành tính ống hậu môn (u cơ, polyp…) | PT-II | Cột ĐB, Cột I, Cột II | `CA0888` |
| 155 | Phẫu thuật điều trị táo bón do rối loạn co thắt cơ mu – trực tràng (Anismus) | PT-I | Cột ĐB, Cột I | — |
| 156 | Phẫu thuật điều trị đứt cơ thắt hậu môn | PT-I | Cột ĐB, Cột I | — |
| 157 | Phẫu thuật điều trị đại tiện mất tự chủ | PT-I | Cột ĐB, Cột I | — |
| 158 | Phẫu thuật cắt lọc, xử lý vết thương tầng sinh môn đơn giản | PT-II | Cột ĐB, Cột I, Cột II | — |
| 159 | Phẫu thuật cắt lọc, xử lý vết thương tầng sinh môn phức tạp | PT-I | Cột ĐB, Cột I | — |
| 160 | Các phẫu thuật hậu môn khác | PT-II | Cột ĐB, Cột I, Cột II | — |
| 161 | Phẫu thuật điều trị thoát vị bẹn bằng phương pháp Bassini | PT-II | Cột ĐB, Cột I, Cột II | `PH2355`, `PH0952` |
| 162 | Phẫu thuật điều trị thoát vị bẹn bằng phương pháp Shouldice | PT-II | Cột ĐB, Cột I, Cột II | `PH2340`, `PH0957` |
| 163 | Phẫu thuật điều trị thoát vị bẹn bằng phương pháp  kết hợp  Bassini và Shouldice | PT-II | Cột ĐB, Cột I, Cột II | `PH2357`, `PH0954` |
| 164 | Phẫu thuật điều trị thoát vị bẹn bằng phương pháp Lichtenstein | PT-II | Cột ĐB, Cột I, Cột II | `PH2358`, `PH0956` |
| 165 | Phẫu thuật điều trị thoát vị bẹn tái phát | PT-I | Cột ĐB, Cột I | `PH2346`, `PH0958` |
| 166 | Phẫu thuật điều trị thoát vị bẹn 2 bên | PT-I | Cột ĐB, Cột I | `PH2366`, `PHA810` |
| 167 | Phẫu thuật điều trị thoát vị đùi | PT-II | Cột ĐB, Cột I, Cột II | `PH2349`, `PH0959` |
| 168 | Phẫu thuật điều trị thoát vị vết mổ thành bụng | PT-I | Cột ĐB, Cột I | `PH0961` |
| 169 | Phẫu thuật điều trị thoát vị thành bụng khác | PT-I | Cột ĐB, Cột I | `PH0960` |
| 170 | Phẫu thuật rò, nang ống rốn tràng, niệu rốn | PT-II | Cột ĐB, Cột I, Cột II | `PH1323` |
| 171 | Phẫu thuật khâu lỗ thủng cơ hoành do vết thương | PT-I | Cột ĐB, Cột I | — |
| 172 | Phẫu thuật khâu vỡ cơ hoành | PT-I | Cột ĐB, Cột I | — |
| 173 | Phẫu thuật điều trị thoát vị cơ hoành | PT-I | Cột ĐB, Cột I | `PH1326` |
| 174 | Phẫu thuật điều trị thoát vị khe hoành | PT-I | Cột ĐB, Cột I | `PH1327` |
| 175 | Phẫu thuật điều trị thoát vị hoành bẩm sinh (Bochdalek) | PT-I | Cột ĐB, Cột I | `PH1328` |
| 176 | Phẫu thuật điều trị nhão cơ hoành | PT-I | Cột ĐB, Cột I | — |
| 177 | Phẫu thuật cắt u cơ hoành | PT-I | Cột ĐB, Cột I | — |
| 178 | Các phẫu thuật cơ hoành khác | PT-I | Cột ĐB, Cột I | — |
| 179 | Phẫu thuật cắt u thành bụng | PT-I | Cột ĐB, Cột I | — |
| 180 | Phẫu thuật khâu phục hồi thành bụng do toác vết mổ | PT-I | Cột ĐB, Cột I | — |
| 181 | Khâu vết thương thành bụng | PT-II | Cột ĐB, Cột I, Cột II | — |
| 182 | Các phẫu thuật thành bụng khác | PT-II | Cột ĐB, Cột I, Cột II | — |
| 183 | Mở bụng thăm dò, lau rửa ổ bụng, đặt dẫn lưu | PT-I | Cột ĐB, Cột I | — |
| 184 | Bóc phúc mạc douglas | PT-I | Cột ĐB, Cột I | — |
| 185 | Lấy mạc nối lớn và mạc nối nhỏ | PT-I | Cột ĐB, Cột I | — |
| 186 | Bóc phúc mạc bên trái | PT-I | Cột ĐB, Cột I | — |
| 187 | Bóc phúc mạc bên phải | PT-I | Cột ĐB, Cột I | — |
| 188 | Bóc phúc mạc phủ tạng | PT-I | Cột ĐB, Cột I | — |
| 189 | Bóc phúc mạc kèm cắt các tạng khác | **PT-ĐB** | Cột ĐB | — |
| 190 | Lấy u phúc mạc | PT-I | Cột ĐB, Cột I | — |
| 191 | Lấy u sau phúc mạc | PT-I | Cột ĐB, Cột I | — |


---

*Tài liệu này là Nguồn Sự Thật Duy Nhất (SSoT) về Phân loại Phẫu thuật Ngoại Tiêu hóa & Phân quyền Mổ chính theo Cột Bác sĩ của dự án `ptdtt-manager` (Khoa Phẫu thuật Đại trực tràng — Bệnh viện Bình Dân).*
