#!/usr/bin/env python3
"""Seed SHCM data into server db.json"""
import json, os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'db.json')

SHCM_DATA = [
    {"id":1,"doctorName":"BS. Vũ Ngọc Anh Tuấn","doctorId":4,"title":"Phân giai đoạn ung thư đường tiêu hóa và cách làm hồ sơ xuất viện","status":"done","presentDate":"2025-04-15"},
    {"id":2,"doctorName":"BS. Võ Chí Nguyện","doctorId":6,"title":"Chuẩn bị bệnh nhân trước phẫu thuật ung thư đại trực tràng","status":"done","presentDate":"2025-04-29"},
    {"id":3,"doctorName":"BS. Giao Hữu Trường Quy","doctorId":8,"title":"Chăm sóc bệnh nhân sau phẫu thuật ung thư đại trực tràng","status":"done","presentDate":"2025-06-17"},
    {"id":4,"doctorName":"BS. Vũ Khương An","doctorId":2,"title":"Cập nhật trong chẩn đoán và điều trị ung thư đại trực tràng 2025","status":"done","presentDate":"2025-05-07"},
    {"id":5,"doctorName":"BS. Vũ Khương An","doctorId":2,"title":"Hội chẩn tham vấn (Thầy Chúc) trường hợp rò tiêu hóa. Kinh nghiệm xử trí u đại tràng ngang.","status":"done","presentDate":"2025-07-24"},
    {"id":6,"doctorName":"BS. Vũ Ngọc Anh Tuấn","doctorId":4,"title":"Ứng dụng laser trong phẫu thuật trĩ, rò","status":"done","presentDate":"2025-11-06"},
    {"id":7,"doctorName":"BS. Phạm Vĩnh Phú","doctorId":7,"title":"Một số kinh nghiệm trong công bố và báo cáo quốc tế","status":"done","presentDate":"2025-12-22"},
    {"id":8,"doctorName":"BS. Vũ Khương An","doctorId":2,"title":"Ý tưởng báo cáo khoa học trong năm 2026, các lỗi thường gặp khi thực hiện BAĐT","status":"done","presentDate":"2026-01-26"},
    {"id":9,"doctorName":"BS. Vũ Khương An","doctorId":2,"title":"Tổng kết triển khai mô hình POD bệnh phòng & Định hướng luân chuyển Nội trú kỳ mới","status":"done","presentDate":"2026-02-23"},
    {"id":10,"doctorName":"BS. Trịnh Hoàng Minh Đức","doctorId":9,"title":"Cập nhật điều trị polyp đại trực tràng","status":"done","presentDate":"2026-03-09"},
    {"id":11,"doctorName":"BS. Phạm Vĩnh Phú","doctorId":7,"title":"Cập nhật hướng dẫn chẩn đoán và điều trị Helicobacter pylori","status":"done","presentDate":"2026-03-23"},
    {"id":12,"doctorName":"BS. Võ Chí Nguyện","doctorId":6,"title":"Có nên hạ góc lách thường quy trong phẫu thuật cắt trực tràng?","status":"pending","presentDate":"2026-04-06"},
    {"id":13,"doctorName":"BS. Vũ Ngọc Anh Tuấn","doctorId":4,"title":"Ứng dụng laser trong điều trị bệnh lý condyloma","status":"pending","presentDate":"2026-04-20"},
    {"id":14,"doctorName":"BS. Bùi Hồng Minh Hậu","doctorId":5,"title":"Cập nhật hướng dẫn sử dụng kháng sinh dự phòng, kháng sinh điều trị","status":"pending","presentDate":"2026-05-04"},
    {"id":15,"doctorName":"BS. Lê Văn Hoan","doctorId":11,"title":"Cập nhật hướng dẫn chẩn đoán và điều trị viêm túi thừa đại tràng","status":"pending","presentDate":"2026-05-18"},
    {"id":16,"doctorName":"BS. Giao Hữu Trường Quy","doctorId":8,"title":"Phẫu thuật nội soi điều trị thoát vị bẹn - TAPP vs TEP","status":"pending","presentDate":"2026-06-01"},
    {"id":17,"doctorName":"BS. Võ Chí Nguyện","doctorId":6,"title":"Hồi tràng ra da/ Phẫu thuật cắt trực tràng: Kỹ thuật và biến chứng liên quan","status":"pending","presentDate":"2026-06-15"},
    {"id":18,"doctorName":"BS. Trần Như Đức","doctorId":10,"title":"Xử trí u dưới niêm dạ dày, tá tràng với các kích thước khác nhau","status":"pending","presentDate":"2026-06-29"},
    {"id":19,"doctorName":"BS. Phạm Thị Tuyết Minh","doctorId":12,"title":"Ứng dụng giảm đau đa mô thức trong hậu phẫu","status":"pending","presentDate":"2026-07-13"},
    {"id":20,"doctorName":"BS. Trịnh Hoàng Minh Đức","doctorId":9,"title":"Chẩn đoán và xử trí tắc mạch máu mạc treo ruột","status":"pending","presentDate":"2026-07-27"},
    {"id":21,"doctorName":"BS. Bùi Hồng Minh Hậu","doctorId":5,"title":"Xử trí tắc ruột do u đại trực tràng: PTNS mở HMNT trên dòng?","status":"pending","presentDate":"2026-08-10"},
    {"id":22,"doctorName":"BS. Lê Văn Hoan","doctorId":11,"title":"Ung thư đại trực tràng đồng thời: Tiếp cận và xử trí","status":"pending","presentDate":"2026-08-24"},
    {"id":23,"doctorName":"BS. Trần Như Đức","doctorId":10,"title":"DNA tự do của khối u trong máu (ctDNA) và quản lý ung thư đại trực tràng.","status":"registered","presentDate":"2026-09-07"},
    {"id":24,"doctorName":"BS. Phạm Thị Tuyết Minh","doctorId":12,"title":"Hiệu quả của tư vấn di truyền trong điều trị và dự phòng ung thư đại trực tràng có tính chất gia đình.","status":"registered","presentDate":"2026-09-21"},
]

SHCM_SETTINGS = [{"id": 1, "defaultTime": "15:30", "defaultDuration": "30m"}]

with open(DB_PATH, 'r') as f:
    db = json.load(f)

db['shcmSchedule'] = SHCM_DATA
db['shcmSettings'] = SHCM_SETTINGS
if 'nextIds' not in db:
    db['nextIds'] = {}
db['nextIds']['shcmSchedule'] = 25
db['nextIds']['shcmSettings'] = 2

with open(DB_PATH, 'w') as f:
    json.dump(db, f, ensure_ascii=False, indent=2)

print(f"OK: seeded {len(SHCM_DATA)} SHCM entries + settings")
