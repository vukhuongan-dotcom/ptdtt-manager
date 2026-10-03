#!/usr/bin/env python3
"""Seed SHCM data into server db.json"""
import json, os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'db.json')

SHCM_DATA = [
    {
        "id": 1,
        "presentDate": "2025-04-15",
        "doctorName": "Bs. Vũ Ngọc Anh Tuấn",
        "doctorId": 4,
        "title": "Phân giai đoạn ung thư đường tiêu hóa và cách làm hồ sơ xuất viện",
        "status": "done",
        "planId": 84
    },
    {
        "id": 2,
        "presentDate": "2025-04-29",
        "doctorName": "BS. Võ Chí Nguyện",
        "doctorId": 6,
        "title": "Chuẩn bị bệnh nhân trước phẫu thuật ung thư đại trực tràng",
        "status": "done",
        "planId": 85
    },
    {
        "id": 3,
        "presentDate": "2025-06-17",
        "doctorName": "BS. Giao Hữu Trường Quy",
        "doctorId": 8,
        "title": "Chăm sóc bệnh nhân sau phẫu thuật ung thư đại trực tràng",
        "status": "done",
        "planId": 86
    },
    {
        "id": 4,
        "presentDate": "2025-05-07",
        "doctorName": "BS. Vũ Khương An",
        "doctorId": 2,
        "title": "Cập nhật trong chẩn đoán và điều trị ung thư đại trực tràng 2025",
        "status": "done",
        "planId": 87
    },
    {
        "id": 5,
        "presentDate": "2025-07-24",
        "doctorName": "BS. Vũ Khương An",
        "doctorId": 2,
        "title": "Hội chẩn tham vấn (Thầy Chúc) trường hợp rò tiêu hóa. Kinh nghiệm xử trí u đại tràng ngang.",
        "status": "done",
        "planId": 88
    },
    {
        "id": 6,
        "presentDate": "2025-11-06",
        "doctorName": "BS. Vũ Ngọc Anh Tuấn",
        "doctorId": 4,
        "title": "Ứng dụng laser trong phẫu thuật trĩ, rò",
        "status": "done",
        "planId": 89
    },
    {
        "id": 7,
        "presentDate": "2025-12-22",
        "doctorName": "BS. Phạm Vĩnh Phú",
        "doctorId": 7,
        "title": "Một số kinh nghiệm trong công bố và báo cáo quốc tế",
        "status": "done",
        "planId": 90
    },
    {
        "id": 8,
        "presentDate": "2026-01-26",
        "doctorName": "BS. Vũ Khương An",
        "doctorId": 2,
        "title": "Ý tưởng báo cáo khoa học trong năm 2026, các lỗi thường gặp khi thực hiện BAĐT",
        "status": "done",
        "planId": 91
    },
    {
        "id": 9,
        "presentDate": "2026-02-23",
        "doctorName": "BS. Vũ Khương An",
        "doctorId": 2,
        "title": "Tổng kết triển khai mô hình POD bệnh phòng & Định hướng luân chuyển Nội trú kỳ mới",
        "status": "done",
        "planId": 92
    },
    {
        "id": 10,
        "presentDate": "2026-03-09",
        "doctorName": "BS. Trịnh Hoàng Minh Đức",
        "doctorId": 9,
        "title": "Cập nhật điều trị polyp đại trực tràng",
        "status": "done",
        "planId": 93
    },
    {
        "id": 11,
        "presentDate": "2026-03-23",
        "doctorName": "BS. Phạm Vĩnh Phú",
        "doctorId": 7,
        "title": "Cập nhật hướng dẫn chẩn đoán và điều trị Helicobacter pylori",
        "status": "done",
        "planId": 94
    },
    {
        "id": 12,
        "presentDate": "2026-04-06",
        "doctorName": "BS. Võ Chí Nguyện",
        "doctorId": 6,
        "title": "Có nên hạ góc lách thường quy trong phẫu thuật cắt trực tràng?",
        "status": "done",
        "planId": 95
    },
    {
        "id": 13,
        "presentDate": "2026-04-20",
        "doctorName": "BS. Võ Chí Nguyện",
        "doctorId": 6,
        "title": "Hồi tràng ra da/ Phẫu thuật cắt trực tràng: Kỹ thuật và biến chứng liên quan",
        "status": "done",
        "planId": 96
    },
    {
        "id": 14,
        "presentDate": "2026-05-04",
        "doctorName": "BS. Vũ Ngọc Anh Tuấn",
        "doctorId": 4,
        "title": "Ứng dụng laser trong điều trị bệnh lý condyloma",
        "status": "done",
        "planId": 97
    },
    {
        "id": 15,
        "presentDate": "2026-05-25",
        "doctorName": "TS. BS Nguyễn Phú Hữu - BS. Vũ Khương An",
        "doctorId": 1,
        "title": "Tổng duyệt chuẩn bị cho “Hội nghị khoa học thường niên phẫu thuật Đại trực tràng Việt Nam năm 2026”",
        "status": "done",
        "planId": 98
    },
    {
        "id": 16,
        "presentDate": "2026-06-01",
        "doctorName": "Khoa PTĐTT",
        "doctorId": 2,
        "title": "Tổng duyệt chuẩn bị cho Hội nghị khoa học thường niên phẫu thuật Đại trực tràng Việt Nam năm 2026 (Đợt 2)",
        "status": "done",
        "planId": 99
    },
    {
        "id": 17,
        "presentDate": "2026-06-25",
        "doctorName": "Bs. Vũ Khương An",
        "doctorId": 2,
        "title": "Can thiệp ngoại khoa trong xuất huyết tiêu hoá từ Ruột non (SHCM BV)",
        "status": "done",
        "planId": 100
    },
    {
        "id": 18,
        "presentDate": "2026-07-06",
        "doctorName": "BS. Võ Chí Nguyện - BS. Vũ Khương An - BSNT. Trâm Anh",
        "doctorId": 6,
        "title": "Chuẩn bị bệnh nhân mổ chương trình: các phẫu thuật lớn",
        "status": "done",
        "planId": 101
    },
    {
        "id": 19,
        "presentDate": "2026-07-18",
        "doctorName": "Khoa PTĐTT",
        "doctorId": 2,
        "title": "Sinh hoạt CLB “Hậu môn nhân tạo” Bệnh viện Bình Dân 2026",
        "status": "done",
        "planId": 102
    },
    {
        "id": 20,
        "presentDate": "2026-08-24",
        "doctorName": "BS. Phạm Vĩnh Phú",
        "doctorId": 7,
        "title": "Thao tác cơ bản tại phòng mổ",
        "status": "done",
        "planId": 103
    },
    {
        "id": 21,
        "presentDate": "2026-09-07",
        "doctorName": "BS. Lê Văn Hoan",
        "doctorId": 11,
        "title": "Quy trình CODE BLUE",
        "status": "done",
        "planId": 104
    },
    {
        "id": 22,
        "presentDate": "2026-10-19",
        "doctorName": "BS. Trần Như Đức",
        "doctorId": 10,
        "title": "Xử trí u dưới niêm dạ dày, tá tràng với các kích thước khác nhau",
        "status": "pending",
        "planId": 105
    },
    {
        "id": 23,
        "presentDate": "2026-11-02",
        "doctorName": "BS. Giao Hữu Trường Quy",
        "doctorId": 8,
        "title": "Phẫu thuật nội soi điều trị thoát vị bẹn - TAPP vs TEP",
        "status": "pending",
        "planId": 106
    },
    {
        "id": 24,
        "presentDate": "2026-11-16",
        "doctorName": "BS. Lê Văn Hoan",
        "doctorId": 11,
        "title": "Cập nhật hướng dẫn sử dụng kháng sinh dự phòng, kháng sinh điều trị",
        "status": "pending",
        "planId": 107
    },
    {
        "id": 25,
        "presentDate": "2026-11-30",
        "doctorName": "BS. Phạm Thị Tuyết Minh",
        "doctorId": 12,
        "title": "Ứng dụng giảm đau đa mô thức trong hậu phẫu",
        "status": "pending",
        "planId": 108
    },
    {
        "id": 26,
        "presentDate": "2026-12-14",
        "doctorName": "BS. Lê Văn Hoan",
        "doctorId": 11,
        "title": "Cập nhật hướng dẫn chẩn đoán và điều trị viêm túi thừa đại tràng",
        "status": "pending",
        "planId": 109
    },
    {
        "id": 27,
        "presentDate": "2026-12-28",
        "doctorName": "BS. Võ Chí Nguyện",
        "doctorId": 6,
        "title": "Cập nhật chẩn đoán điều trị IBS",
        "status": "pending",
        "planId": 110
    },
    {
        "id": 28,
        "presentDate": "2027-01-11",
        "doctorName": "BS. Lê Văn Hoan",
        "doctorId": 11,
        "title": "Xử trí tắc ruột do u đại trực tràng: PTNS mở HMNT trên dòng?",
        "status": "pending",
        "planId": 111
    },
    {
        "id": 29,
        "presentDate": "2027-01-25",
        "doctorName": "BS. Trịnh Hoàng Minh Đức",
        "doctorId": 9,
        "title": "Chẩn đoán và xử trí tắc mạch máu mạc treo ruột",
        "status": "pending",
        "planId": 112
    },
    {
        "id": 30,
        "presentDate": "2027-02-15",
        "doctorName": "BS. Lê Văn Hoan",
        "doctorId": 11,
        "title": "Ung thư đại trực tràng đồng thời: Tiếp cận và xử trí",
        "status": "pending",
        "planId": 113
    },
    {
        "id": 31,
        "presentDate": "2027-03-01",
        "doctorName": "BS. Trần Như Đức",
        "doctorId": 10,
        "title": "DNA tự do của khối u trong máu (ctDNA) và quản lý ung thư đại trực tràng.",
        "status": "pending",
        "planId": 114
    },
    {
        "id": 32,
        "presentDate": "2027-03-15",
        "doctorName": "BS. Phạm Thị Tuyết Minh",
        "doctorId": 12,
        "title": "Hiệu quả của tư vấn di truyền trong điều trị và dự phòng ung thư đại trực tràng có tính chất gia đình.",
        "status": "pending",
        "planId": 115
    },
    {
        "id": 33,
        "presentDate": "2027-03-29",
        "doctorName": "BS. Giao Hữu Trường Quy",
        "doctorId": 8,
        "title": "Động mạch đại tràng trái: Các biến thể giải phẫu và cách xác định chúng",
        "status": "pending",
        "planId": 116
    },
    {
        "id": 34,
        "presentDate": "2027-04-12",
        "doctorName": "BS. Giao Hữu Trường Quy",
        "doctorId": 8,
        "title": "Các cách tiếp cận trong phẫu thuật cắt đại tràng phải",
        "status": "pending",
        "planId": 117
    },
    {
        "id": 35,
        "presentDate": "2027-04-26",
        "doctorName": "Bs. Vũ Khương An",
        "doctorId": 2,
        "title": "Sinh lý bệnh của sự lành miệng nối tiêu hoá và ứng dụng thực tiễn",
        "status": "pending",
        "planId": 118
    },
    {
        "id": 36,
        "doctorName": "BCN Khoa",
        "doctorId": 1,
        "title": "Sinh hoạt về: “Tổ chức hoạt động truyền thông của khoa PT Đại trực tràng”",
        "status": "pending",
        "presentDate": "2026-10-05",
        "planId": 119
    }
]

SHCM_SETTINGS = [{"id": 1, "defaultTime": "15:30", "defaultDuration": "30m"}]

with open(DB_PATH, 'r') as f:
    db = json.load(f)

db['shcmSchedule'] = SHCM_DATA
db['shcmSettings'] = SHCM_SETTINGS
if 'nextIds' not in db:
    db['nextIds'] = {}
db['nextIds']['shcmSchedule'] = 37
db['nextIds']['shcmSettings'] = 2

with open(DB_PATH, 'w') as f:
    json.dump(db, f, ensure_ascii=False, indent=2)

print(f"OK: seeded {len(SHCM_DATA)} SHCM entries + settings")
