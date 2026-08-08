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
