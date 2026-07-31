// ===== REAL STAFF DATA FROM DS NHÂN VIÊN KHOA ĐTT.xlsx =====
const SAMPLE_STAFF = [
    { id: 1, name: 'Nguyễn Phú Hữu', role: 'BS Trưởng khoa', title: 'TS. BSCKII', phone: '0918650345', email: 'bsphuhuu2012@gmail.com', status: 'active', color: '#8b5cf6', cơHữu: true },
    { id: 2, name: 'Vũ Khương An', role: 'BS Phó trưởng khoa', title: 'BSCKII', phone: '0909927154', email: 'vukhuongan@gmail.com', status: 'active', color: '#06b6d4', cơHữu: true },
    { id: 3, name: 'Nguyễn Thị Ngọc Thùy', role: 'Điều dưỡng trưởng', title: 'ĐD', phone: '0908261563', email: 'teresathuynguyen82@gmail.com', status: 'active', color: '#ec4899', cơHữu: true },
    { id: 4, name: 'Vũ Ngọc Anh Tuấn', role: 'Bác sĩ chính', title: 'BSCKII', phone: '0902770599', email: 'drdomtuan29@gmail.com', status: 'active', color: '#f59e0b', cơHữu: false, note: 'Giảng viên PNT' },
    { id: 5, name: 'Bùi Hồng Minh Hậu', role: 'Bác sĩ chính', title: 'BSCKII', phone: '0933024160', email: 'drhaubui@gmail.com', status: 'active', color: '#3b82f6', cơHữu: false, note: 'BS phòng KHTH' },
    { id: 6, name: 'Võ Chí Nguyện', role: 'Bác sĩ chính', title: 'BSCKII', phone: '0939530499', email: 'chinguyenvo@outlook.com', status: 'active', color: '#14b8a6', cơHữu: false, note: 'Giảng viên Tân Tạo' },
    { id: 7, name: 'Phạm Vĩnh Phú', role: 'Bác sĩ chính', title: 'BSCKI', phone: '0937462877', email: 'dr.phamvinhphu@gmail.com', status: 'active', color: '#f97316', cơHữu: true },
    { id: 8, name: 'Giao Hữu Trường Quy', role: 'Bác sĩ chính', title: 'BSCKI', phone: '0975739589', email: 'drgiaoquy@gmail.com', status: 'active', color: '#a855f7', cơHữu: true },
    { id: 9, name: 'Trịnh Hoàng Minh Đức', role: 'Bác sĩ chính', title: 'BSCKI', phone: '0906072054', email: 'drminhducth@gmail.com', status: 'active', color: '#10b981', cơHữu: true },
    { id: 10, name: 'Trần Như Đức', role: 'Bác sĩ chính', title: 'BSCKI', phone: '0349982469', email: 'trannhuduc97@gmail.com', status: 'active', color: '#06b6d4', cơHữu: true },
    { id: 11, name: 'Lê Văn Hoan', role: 'Bác sĩ chính', title: 'BSCKI', phone: '0344254024', email: 'chicothelalehoan@gmail.com', status: 'active', color: '#8b5cf6', cơHữu: true },
    { id: 12, name: 'Phạm Thị Tuyết Minh', role: 'Bác sĩ chính', title: 'BSCKI', phone: '0775696917', email: 'tuyetminh061297@gmail.com', status: 'active', color: '#ec4899', cơHữu: true },
    { id: 13, name: 'Hồ Minh Huy', role: 'Bác sĩ học viên', title: 'BSNT', phone: '0355511263', email: 'dr.hmhuy@gmail.com', status: 'active', color: '#f59e0b', cơHữu: true },
    { id: 14, name: 'Nguyễn Huy Hoàng', role: 'Bác sĩ học viên', title: 'BSNT', phone: '0704725070', email: 'nguyenhuyhoang82914@gmail.com', status: 'active', color: '#3b82f6', cơHữu: true },
    { id: 15, name: 'Nguyễn Hà Trâm Anh', role: 'Bác sĩ học viên', title: 'BSNT', phone: '0943923539', email: 'nguyenhatramanh.131@gmail.com', status: 'active', color: '#14b8a6', cơHữu: true },
    { id: 16, name: 'Nguyễn Minh Nguyên Phương', role: 'Bác sĩ học viên', title: 'BS. Học viên', phone: '0977347794', email: 'nmnp252@gmail.com', status: 'active', color: '#f97316', cơHữu: false },
    { id: 17, name: 'Nguyễn Thanh Ý', role: 'Bác sĩ học viên', title: 'BSNT', phone: '', email: '', status: 'active', color: '#a855f7', cơHữu: true },
    { id: 18, name: 'Nguyễn Hải Linh', role: 'Bác sĩ học viên', title: 'BSNT', phone: '0908504532', email: 'ntng2507.hv@uhsvnu.edu.vn', status: 'active', color: '#10b981', cơHữu: false },
    { id: 19, name: 'Trương Minh Trọng', role: 'Bác sĩ học viên', title: 'BSNT', phone: '0971946970', email: 'minhtrong10c1@gmail.com', status: 'active', color: '#06b6d4', cơHữu: false },
    { id: 20, name: 'Bùi Nguyễn Sơn Nam', role: 'Bác sĩ học viên', title: 'BSNT', phone: '', email: '', status: 'active', color: '#8b5cf6', cơHữu: false },
    { id: 21, name: 'Nguyễn Thị Mỹ Ngọc', role: 'Bác sĩ học viên', title: 'BSNT', phone: '0902340216', email: 'chaumingoc2011@gmail.com', status: 'active', color: '#ec4899', cơHữu: false },
    { id: 22, name: 'Nguyễn Tấn Định', role: 'Bác sĩ học viên', title: 'BSNT', phone: '0981139485', email: 'bsntnguyentandinh@gmail.com', status: 'active', color: '#f59e0b', cơHữu: true },
    { id: 23, name: 'Lê Minh Hậu', role: 'Bác sĩ học viên', title: 'BSNT', phone: '0374807641', email: 'lucvu19012001@gmail.com', status: 'active', color: '#3b82f6', cơHữu: true },
    { id: 24, name: 'Phạm Thị Thanh Thảo', role: 'Điều dưỡng', title: 'ĐD', phone: '0938231578', email: 'phamthaot84@gmail.com', status: 'active', color: '#14b8a6', cơHữu: true },
    { id: 25, name: 'Trần Phương Quan', role: 'Điều dưỡng', title: 'ĐD', phone: '0328288328', email: 'tranphuongquan45@gmail.com', status: 'active', color: '#f97316', cơHữu: true },
    { id: 26, name: 'Nguyễn Như Hiền', role: 'Điều dưỡng', title: 'ĐD', phone: '0765825528', email: 'hien.nguyen.nhu84@gmail.com', status: 'active', color: '#a855f7', cơHữu: true },
    { id: 27, name: 'Phan Thị Cẩm Tiên', role: 'Điều dưỡng', title: 'ĐD', phone: '0903640318', email: 'Phant151096@gmail.com', status: 'active', color: '#10b981', cơHữu: true },
    { id: 28, name: 'Trần Thanh Danh', role: 'Điều dưỡng', title: 'ĐD', phone: '0903390991', email: 'tranthanhdanh9191@gmail.com', status: 'active', color: '#06b6d4', cơHữu: true },
    { id: 29, name: 'Phan Thị Thủy Tiên', role: 'Điều dưỡng', title: 'ĐD', phone: '0392400393', email: 'phanthithuytien1606@gmail.com', status: 'active', color: '#8b5cf6', cơHữu: true },
    { id: 30, name: 'Nguyễn Thị Huyền', role: 'Điều dưỡng', title: 'ĐD', phone: '0327091879', email: 'huyennguyen195177@gmal.com', status: 'active', color: '#ec4899', cơHữu: true },
    { id: 31, name: 'Huỳnh Kim Xuân Hằng', role: 'Điều dưỡng', title: 'ĐD', phone: '0773136412', email: 'huynhkimxuanhang@gmail.com', status: 'active', color: '#f59e0b', cơHữu: true },
    { id: 32, name: 'Bùi Thị Mộng Trinh', role: 'Điều dưỡng', title: 'ĐD', phone: '0392371516', email: 'trinhbtm123@gmail.com', status: 'active', color: '#3b82f6', cơHữu: true },
    { id: 33, name: 'Lê Thị Thu Trang', role: 'Điều dưỡng', title: 'ĐD', phone: '0987239059', email: 'thutranglee1102@gmail.com', status: 'active', color: '#14b8a6', cơHữu: true },
    { id: 34, name: 'Lê Thị Như Thảo', role: 'Điều dưỡng', title: 'ĐD', phone: '0386733697', email: 'nhthao2008@gmail.com', status: 'active', color: '#f97316', cơHữu: true },
    { id: 35, name: 'Nguyễn Hoàng Diệu Trâm', role: 'Điều dưỡng', title: 'ĐD', phone: '0703613583', email: 'nguyenhoangdieutram.2b@gmail.com', status: 'active', color: '#a855f7', cơHữu: true },
    { id: 36, name: 'Lý Hoàng Duy', role: 'Điều dưỡng', title: 'ĐD', phone: '0796647516', email: 'lyhoangduy522002@gmail.com', status: 'active', color: '#10b981', cơHữu: true },
    { id: 37, name: 'Bùi Thị Trưng', role: 'Hộ lý', title: 'HL', phone: '0982553527', email: 'buithitran070291@gmail.com', status: 'active', color: '#06b6d4', cơHữu: true },
    { id: 38, name: 'Lê Thị Thúy An', role: 'Hộ lý', title: 'HL', phone: '0907052388', email: 'nguenanh2701@gmail.com', status: 'active', color: '#8b5cf6', cơHữu: true },
    { id: 39, name: 'Huỳnh Văn Hiếu', role: 'Hộ lý', title: 'HL', phone: '0907473372', email: 'hieuhuynh311281@gmail.com', status: 'active', color: '#ec4899', cơHữu: true },
    { id: 40, name: 'Nguyễn Thị Hoa', role: 'Thư ký', title: 'TK', phone: '0909324233', email: 'nguyenthihoa3121983@gmail.com', status: 'active', color: '#f59e0b', cơHữu: true },
    { id: 43, name: 'Nguyễn Đức Thiên Phú', role: 'Bác sĩ học viên', title: 'BSNT', phone: '0917365115', email: '', status: 'active', color: '#a855f7', cơHữu: true, startDate: '2026-07-30' },
    { id: 44, name: 'Phùng Bùi Tuấn Kiệt', role: 'Bác sĩ học viên', title: 'BSNT', phone: '0903006976', email: '', status: 'active', color: '#f59e0b', cơHữu: true, startDate: '2026-07-30' },
    { id: 45, name: 'Nguyễn Đức Luân', role: 'Bác sĩ học viên', title: 'BSNT', phone: '0346814876', email: '', status: 'active', color: '#f59e0b', cơHữu: true, startDate: '2026-07-30' },
    { id: 46, name: 'Nguyễn Ngọc Minh Khôi', role: 'Bác sĩ học viên', title: 'BSNT', phone: '0848635567', email: '', status: 'active', color: '#3b82f6', cơHữu: true, startDate: '2026-07-30' },
    { id: 47, name: 'Hoàng Bá Sang', role: 'Bác sĩ học viên', title: 'BSNT', phone: '0335846050', email: '', status: 'active', color: '#10b981', cơHữu: false, startDate: '2026-07-31', mshv: 'NTNG2503' },
    { id: 48, name: 'Lê Minh Thành', role: 'Bác sĩ học viên', title: 'BSNT', phone: '0965663267', email: '', status: 'active', color: '#f59e0b', cơHữu: false, startDate: '2026-07-31', mshv: 'NTNG2505' },
    { id: 49, name: 'Ừng Phương Minh Oanh', role: 'Điều dưỡng', title: 'CNĐD', phone: '0931042403', email: 'oanhu642003@gamil.com', status: 'active', color: '#10b981', cơHữu: true, startDate: '2026-07-31' },
    { id: 50, name: 'Đặng Cẩm Tú', role: 'Bác sĩ học viên', title: 'BS. Học viên', phone: '0836629554', email: 'dctu@ptdtt.info.vn', status: 'active', color: '#f97316', cơHữu: false, startDate: '2026-07-31' },
];

// ===== EXTERNAL DOCTORS (BS ngoài khoa hỗ trợ) =====
const SAMPLE_EXTERNAL_DOCTORS = [
    { id: 101, name: 'Lương Thanh Tùng', title: 'BSCKII', position: 'Phó Giám đốc', department: 'Ban Giám đốc', note: 'Phó giám đốc', color: '#6366f1' },
    { id: 102, name: 'Hoàng Vĩnh Chúc', title: 'BSCKII', position: 'BS Tham vấn', department: 'Khoa PTĐTT', note: '', color: '#0ea5e9' },
    { id: 103, name: 'Trần Thiện Hoà', title: 'BS', position: 'Bác sĩ', department: 'Ngoại Tiêu hoá', note: 'Ngoại Tiêu hoá', color: '#22c55e' },
];

const SAMPLE_TASKS = [
    { id: 1, title: 'Chuẩn bị hội chẩn ca BN Nguyễn Văn A', desc: 'Ung thư trực tràng T3N1M0', assignee: 1, priority: 'high', deadline: '2026-03-24', status: 'todo' },
    { id: 2, title: 'Hoàn thành báo cáo ca mổ robot tháng 3', desc: 'Tổng hợp số liệu 15 ca mổ robot', assignee: 2, priority: 'medium', deadline: '2026-03-28', status: 'todo' },
    { id: 3, title: 'Cập nhật protocol chăm sóc sau mổ', desc: 'Chỉnh sửa theo guideline ACS 2026', assignee: 7, priority: 'medium', deadline: '2026-03-30', status: 'doing' },
    { id: 4, title: 'Phẫu thuật nội soi cắt đại tràng phải', desc: 'BN Trần Thị B, giường 12', assignee: 9, priority: 'high', deadline: '2026-03-23', status: 'doing' },
    { id: 5, title: 'Viết đề cương NCKH robot phẫu thuật', desc: 'Đề tài so sánh robot vs nội soi', assignee: 2, priority: 'low', deadline: '2026-04-15', status: 'todo' },
    { id: 6, title: 'Đào tạo ĐDV kỹ thuật chăm sóc stoma', desc: 'Buổi training cho 5 điều dưỡng mới', assignee: 3, priority: 'medium', deadline: '2026-03-25', status: 'done' },
    { id: 7, title: 'Kiểm kê vật tư tiêu hao tháng 3', desc: 'Stapler, trocar, mesh', assignee: 40, priority: 'low', deadline: '2026-03-31', status: 'done' },
    { id: 8, title: 'Hội chẩn đa chuyên khoa - BN ung thư', desc: 'Ca phức tạp cần hội chẩn UHBM, Nội soi, CĐHA', assignee: 1, priority: 'high', deadline: '2026-03-24', status: 'doing' },
];

const SAMPLE_PLANS = [
    { id: 1, title: 'Họp giao ban khoa', date: '2026-03-24', time: '07:30', location: 'Phòng họp khoa', type: 'meeting', responsible: 1, note: '' },
    { id: 2, title: 'Hội chẩn GS Ninh', date: '2026-03-25', time: '10:00', location: 'Phòng hội chẩn', type: 'consultation', responsible: 2, note: '3 ca phức tạp' },
    { id: 3, title: 'Đào tạo kỹ thuật khâu nối', date: '2026-03-26', time: '14:00', location: 'Phòng mổ Lab', type: 'training', responsible: 7, note: 'Cho BSNT năm 2' },
    { id: 4, title: 'Hội nghị VASEL 2026', date: '2026-03-28', time: '08:00', location: 'Khách sạn Rex', type: 'conference', responsible: 2, note: 'Báo cáo robot' },
    { id: 5, title: 'Sinh hoạt chuyên môn', date: '2026-03-27', time: '13:30', location: 'Phòng họp khoa', type: 'meeting', responsible: 1, note: 'Review ca biến chứng' },
    { id: 6, title: 'Khám đoàn Côn Đảo', date: '2026-04-01', time: '06:00', location: 'Côn Đảo', type: 'other', responsible: 2, note: 'Đợt 2 năm 2026' },
    { id: 7, title: 'Họp khoa hàng tuần', date: '2026-03-31', time: '07:30', location: 'Phòng họp khoa', type: 'meeting', responsible: 1, note: '' },
    { id: 8, title: 'Tập huấn ACS', date: '2026-04-03', time: '09:00', location: 'Hội trường BV', type: 'training', responsible: 1, note: 'Module Patient Safety' },
];

const SAMPLE_PATIENTS = [
    { id: 1, name: 'Nguyễn Văn A', age: 58, gender: 'Nam', bed: 'G1-01', diagnosis: 'K trực tràng 1/3 giữa', admitDate: '2026-03-18', status: 'pre-op', doctor: 2 },
    { id: 2, name: 'Trần Thị B', age: 65, gender: 'Nữ', bed: 'G1-03', diagnosis: 'K đại tràng phải', admitDate: '2026-03-20', status: 'post-op', doctor: 9 },
    { id: 3, name: 'Lê Văn C', age: 72, gender: 'Nam', bed: 'G1-05', diagnosis: 'K đại tràng sigma', admitDate: '2026-03-15', status: 'active', doctor: 1 },
    { id: 4, name: 'Phạm Thị D', age: 45, gender: 'Nữ', bed: 'G2-02', diagnosis: 'Polyp đại tràng', admitDate: '2026-03-22', status: 'pre-op', doctor: 7 },
    { id: 5, name: 'Hoàng Văn E', age: 55, gender: 'Nam', bed: 'G2-04', diagnosis: 'Trĩ nội độ IV', admitDate: '2026-03-21', status: 'post-op', doctor: 8 },
    { id: 6, name: 'Đỗ Thị F', age: 63, gender: 'Nữ', bed: 'G1-07', diagnosis: 'K trực tràng 1/3 dưới', admitDate: '2026-03-17', status: 'active', doctor: 2 },
    { id: 7, name: 'Vương Văn G', age: 48, gender: 'Nam', bed: 'G2-06', diagnosis: 'Rò hậu môn phức tạp', admitDate: '2026-03-22', status: 'pre-op', doctor: 10 },
    { id: 8, name: 'Mai Thị H', age: 70, gender: 'Nữ', bed: 'G1-09', diagnosis: 'Tắc ruột do dính', admitDate: '2026-03-19', status: 'active', doctor: 1 },
];

// ===== SAMPLE SCHEDULE: 23.03.2026 – 29.03.2026 =====
const SAMPLE_SCHEDULES = [{
    id: 1,
    weekKey: '2026-03-23',
    startDate: '2026-03-23',
    endDate: '2026-03-29',
    notes: 'BS Hữu nghỉ phép thứ 6',
    positions: {
        trucKhoa: {
            // T2: Tuấn, N.Đức, Định, Hậu NT
            T2_0:4, T2_1:10, T2_2:22, T2_3:23,
            // T3: M.Đức, Hoan, Hoàng
            T3_0:9, T3_1:11, T3_2:14,
            // T4: Nguyện, Minh, Trâm Anh
            T4_0:6, T4_1:12, T4_2:15,
            // T5: Quy, N.Đức, Huy
            T5_0:8, T5_1:10, T5_2:13,
            // T6: Phú, Hoan, Ý
            T6_0:7, T6_1:11, T6_2:17,
        },
        sieuAm: {
            T2_0:4, T3_0:9, T4_0:6, T5_0:7, T6_0:8,
        },
        pkB023: {
            T2_0:5, T3_0:1, T4_0:4, T5_0:2, T6_0:6,
        },
        pkB020: {
            // T2: Sáng + Chiều Vĩnh Phú | T3: Sáng An
            T2_0:7, T2_1:7,
            T3_0:2,
        },
        pkK001: {
            // T2: Sáng An, Chiều M.Đức | T6: Sáng + Chiều Quy
            T2_0:2, T2_1:9,
            T6_0:8, T6_1:8,
        },
        mo: {
            // T2: Hữu, Nguyện, M.Đức, Hoan, Trâm Anh, Hoàng, Huy, Ý
            T2_0:1, T2_1:6, T2_2:9, T2_3:11, T2_4:15, T2_5:14, T2_6:13, T2_7:17,
            // T3: Tuấn, Phú, Quy, N.Đức, Huy, Định, Ý
            T3_0:4, T3_1:7, T3_2:8, T3_3:10, T3_4:13, T3_5:22, T3_6:17,
            // T4: An, Phú, M.Đức, Hoan, Huy, Ý, Hậu NT
            T4_0:2, T4_1:7, T4_2:9, T4_3:11, T4_4:13, T4_5:17, T4_6:23,
            // T5: Hữu, Tuấn, Quy, Minh, Trâm Anh, Hoàng, Định, Hậu NT
            T5_0:1, T5_1:4, T5_2:8, T5_3:12, T5_4:15, T5_5:14, T5_6:22, T5_7:23,
            // T6: Hậu, Nguyện, Minh, Trâm Anh, Hoàng, Định, Hậu NT
            T6_0:5, T6_1:6, T6_2:12, T6_3:15, T6_4:14, T6_5:22, T6_6:23,
            // T7: M.Đức, Hoàng, Định
            T7_0:9, T7_1:14, T7_2:22,
        },
        trucBCN: {
            T2_0:2, T3_0:1, T4_0:1, T5_0:2, T6_0:2, T7_0:1, CN_0:2,
        },
        trucBV: {
            // T2: Phú, Hoàng
            T2_0:7, T2_1:14,
            // T3: M.Đức
            T3_0:9,
            // T4: Định
            T4_0:22,
            // T5: An, N.Đức
            T5_0:2, T5_1:10,
            // T6: Hoan, Hậu NT
            T6_0:11, T6_1:23,
            // T7: Minh, Trâm Anh
            T7_0:12, T7_1:15,
            // CN: Quy, Ý
            CN_0:8, CN_1:17,
        },
        trucDD: {
            // T2: Hiền, Trinh
            T2_0:26, T2_1:32,
            // T3: Huyền, Trang
            T3_0:30, T3_1:33,
            // T4: Tiên, C.Tiên
            T4_0:29, T4_1:27,
            // T5: Danh, Hằng
            T5_0:28, T5_1:31,
            // T6: Hiền, Trinh
            T6_0:26, T6_1:32,
            // T7: Huyền, Trang
            T7_0:30, T7_1:33,
            // CN: Tiên, C.Tiên
            CN_0:29, CN_1:27,
        },
    }
}];

const MONTHLY_SURGERIES = [22, 18, 25, 20, 28, 24, 30, 26, 32, 28, 24, 27];
const MONTH_LABELS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

// ===== SAMPLE SHCM (Sinh hoạt Chuyên môn) =====
const SAMPLE_SHCM = [
    { id:1, doctorName:'BS. Vũ Ngọc Anh Tuấn', doctorId:4, title:'Phân giai đoạn ung thư đường tiêu hóa và cách làm hồ sơ xuất viện', status:'done', presentDate:'2025-04-15' },
    { id:2, doctorName:'BS. Võ Chí Nguyện', doctorId:6, title:'Chuẩn bị bệnh nhân trước phẫu thuật ung thư đại trực tràng', status:'done', presentDate:'2025-04-29' },
    { id:3, doctorName:'BS. Giao Hữu Trường Quy', doctorId:8, title:'Chăm sóc bệnh nhân sau phẫu thuật ung thư đại trực tràng', status:'done', presentDate:'2025-06-17' },
    { id:4, doctorName:'BS. Vũ Khương An', doctorId:2, title:'Cập nhật trong chẩn đoán và điều trị ung thư đại trực tràng 2025', status:'done', presentDate:'2025-05-07' },
    { id:5, doctorName:'BS. Vũ Khương An', doctorId:2, title:'Hội chẩn tham vấn (Thầy Chúc) trường hợp rò tiêu hóa. Kinh nghiệm xử trí u đại tràng ngang.', status:'done', presentDate:'2025-07-24' },
    { id:6, doctorName:'BS. Vũ Ngọc Anh Tuấn', doctorId:4, title:'Ứng dụng laser trong phẫu thuật trĩ, rò', status:'done', presentDate:'2025-11-06' },
    { id:7, doctorName:'BS. Phạm Vĩnh Phú', doctorId:7, title:'Một số kinh nghiệm trong công bố và báo cáo quốc tế', status:'done', presentDate:'2025-12-22' },
    { id:8, doctorName:'BS. Vũ Khương An', doctorId:2, title:'Ý tưởng báo cáo khoa học trong năm 2026, các lỗi thường gặp khi thực hiện BAĐT', status:'done', presentDate:'2026-01-26' },
    { id:9, doctorName:'BS. Vũ Khương An', doctorId:2, title:'Tổng kết triển khai mô hình POD bệnh phòng & Định hướng luân chuyển Nội trú kỳ mới', status:'done', presentDate:'2026-02-23' },
    { id:10, doctorName:'BS. Trịnh Hoàng Minh Đức', doctorId:9, title:'Cập nhật điều trị polyp đại trực tràng', status:'done', presentDate:'2026-03-09' },
    { id:11, doctorName:'BS. Phạm Vĩnh Phú', doctorId:7, title:'Cập nhật hướng dẫn chẩn đoán và điều trị Helicobacter pylori', status:'done', presentDate:'2026-03-23' },
    { id:12, doctorName:'BS. Võ Chí Nguyện', doctorId:6, title:'Có nên hạ góc lách thường quy trong phẫu thuật cắt trực tràng?', status:'done', presentDate:'2026-04-06' },
    { id:13, doctorName:'BS. Võ Chí Nguyện', doctorId:6, title:'Hồi tràng ra da/ Phẫu thuật cắt trực tràng: Kỹ thuật và biến chứng liên quan', status:'done', presentDate:'2026-04-20' },
    { id:14, doctorName:'BS. Vũ Ngọc Anh Tuấn', doctorId:4, title:'Ứng dụng laser trong điều trị bệnh lý condyloma', status:'done', presentDate:'2026-05-04' },
    { id:15, doctorName:'BS. Võ Chí Nguyện, BS. Vũ Khương An, BSNT. Trâm Anh', doctorId:6, title:'Chuẩn bị bệnh nhân mổ chương trình: các phẫu thuật lớn', status:'pending', presentDate:'2026-05-18' },
    { id:16, doctorName:'BS. Bùi Hồng Minh Hậu', doctorId:5, title:'Cập nhật hướng dẫn sử dụng kháng sinh dự phòng, kháng sinh điều trị', status:'pending', presentDate:'2026-06-01' },
    { id:17, doctorName:'BS. Lê Văn Hoan', doctorId:11, title:'Cập nhật hướng dẫn chẩn đoán và điều trị viêm túi thừa đại tràng', status:'pending', presentDate:'2026-06-15' },
    { id:18, doctorName:'BS. Giao Hữu Trường Quy', doctorId:8, title:'Phẫu thuật nội soi điều trị thoát vị bẹn - TAPP vs TEP', status:'pending', presentDate:'2026-06-29' },
    { id:19, doctorName:'BS. Trần Như Đức', doctorId:10, title:'Xử trí u dưới niêm dạ dày, tá tràng với các kích thước khác nhau', status:'pending', presentDate:'2026-07-13' },
    { id:20, doctorName:'BS. Phạm Thị Tuyết Minh', doctorId:12, title:'Ứng dụng giảm đau đa mô thức trong hậu phẫu', status:'pending', presentDate:'2026-07-27' },
    { id:21, doctorName:'BS. Trịnh Hoàng Minh Đức', doctorId:9, title:'Chẩn đoán và xử trí tắc mạch máu mạc treo ruột', status:'pending', presentDate:'2026-08-10' },
    { id:22, doctorName:'BS. Bùi Hồng Minh Hậu', doctorId:5, title:'Xử trí tắc ruột do u đại trực tràng: PTNS mở HMNT trên dòng?', status:'pending', presentDate:'2026-08-24' },
    { id:23, doctorName:'BS. Lê Văn Hoan', doctorId:11, title:'Ung thư đại trực tràng đồng thời: Tiếp cận và xử trí', status:'pending', presentDate:'2026-09-07' },
    { id:24, doctorName:'BS. Trần Như Đức', doctorId:10, title:'DNA tự do của khối u trong máu (ctDNA) và quản lý ung thư đại trực tràng.', status:'pending', presentDate:'2026-09-21' },
    { id:25, doctorName:'BS. Phạm Thị Tuyết Minh', doctorId:12, title:'Hiệu quả của tư vấn di truyền trong điều trị và dự phòng ung thư đại trực tràng có tính chất gia đình.', status:'pending', presentDate:'2026-10-05' },
    { id:26, doctorName:'BS. Giao Hữu Trường Quy', doctorId:8, title:'Động mạch đại tràng trái: Các biến thể giải phẫu và cách xác định chúng', status:'pending', presentDate:'2026-10-19' },
    { id:27, doctorName:'BS. Giao Hữu Trường Quy', doctorId:8, title:'Các cách tiếp cận trong phẫu thuật cắt đại tràng phải', status:'registered', presentDate:'2026-11-02' },
    { id:28, doctorName:'BS. Vũ Khương An', doctorId:2, title:'Sinh lý bệnh của sự lành miệng nối tiêu hoá và ứng dụng thực tiễn', status:'registered', presentDate:'2026-11-16' },
];
