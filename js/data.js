// ===== REAL STAFF DATA FROM DS NHÂN VIÊN KHOA ĐTT.xlsx =====
const SAMPLE_STAFF = [
    { id: 1, name: 'Nguyễn Phú Hữu', role: 'BS Trưởng khoa', title: 'TS. BSCKII', phone: '', status: 'active', color: '#8b5cf6', cơHữu: true },
    { id: 2, name: 'Vũ Khương An', role: 'BS Phó trưởng khoa', title: 'BSCKII', phone: '', status: 'active', color: '#06b6d4', cơHữu: true },
    { id: 3, name: 'Nguyễn Thị Ngọc Thùy', role: 'Điều dưỡng trưởng', title: 'ĐD', phone: '', status: 'active', color: '#ec4899', cơHữu: true },
    { id: 4, name: 'Vũ Ngọc Anh Tuấn', role: 'Bác sĩ chính', title: 'BSCKII', phone: '', status: 'active', color: '#f59e0b', cơHữu: false, note: 'Giảng viên PNT' },
    { id: 5, name: 'Bùi Hồng Minh Hậu', role: 'Bác sĩ chính', title: 'BSCKII', phone: '', status: 'active', color: '#3b82f6', cơHữu: false, note: 'BS phòng KHTH' },
    { id: 6, name: 'Võ Chí Nguyện', role: 'Bác sĩ chính', title: 'BSCKII', phone: '', status: 'active', color: '#14b8a6', cơHữu: false, note: 'Giảng viên Tân Tạo' },
    { id: 7, name: 'Phạm Vĩnh Phú', role: 'Bác sĩ chính', title: 'BSCKI', phone: '', status: 'active', color: '#f97316', cơHữu: true },
    { id: 8, name: 'Giao Hữu Trường Quy', role: 'Bác sĩ chính', title: 'BSCKI', phone: '', status: 'active', color: '#a855f7', cơHữu: true },
    { id: 9, name: 'Trịnh Hoàng Minh Đức', role: 'Bác sĩ chính', title: 'BSCKI', phone: '', status: 'active', color: '#10b981', cơHữu: true },
    { id: 10, name: 'Trần Như Đức', role: 'Bác sĩ chính', title: 'BSCKI', phone: '', status: 'active', color: '#06b6d4', cơHữu: true },
    { id: 11, name: 'Lê Văn Hoan', role: 'Bác sĩ chính', title: 'BSCKI', phone: '', status: 'active', color: '#8b5cf6', cơHữu: true },
    { id: 12, name: 'Phạm Thị Tuyết Minh', role: 'Bác sĩ chính', title: 'BSCKI', phone: '', status: 'active', color: '#ec4899', cơHữu: true },
    { id: 13, name: 'Hồ Minh Huy', role: 'Bác sĩ học viên', title: 'BSNT', phone: '', status: 'active', color: '#f59e0b', cơHữu: true },
    { id: 14, name: 'Nguyễn Huy Hoàng', role: 'Bác sĩ học viên', title: 'BSNT', phone: '', status: 'active', color: '#3b82f6', cơHữu: true },
    { id: 15, name: 'Nguyễn Hà Trâm Anh', role: 'Bác sĩ học viên', title: 'BSNT', phone: '', status: 'active', color: '#14b8a6', cơHữu: true },
    { id: 16, name: 'Nguyễn Minh Nguyên Phương', role: 'Bác sĩ học viên', title: 'Học viên', phone: '', status: 'active', color: '#f97316', cơHữu: false },
    { id: 17, name: 'Nguyễn Thanh Ý', role: 'Bác sĩ học viên', title: 'BSNT', phone: '', status: 'active', color: '#a855f7', cơHữu: true },
    { id: 18, name: 'Nguyễn Hải Linh', role: 'Bác sĩ học viên', title: 'BSNT', phone: '', status: 'active', color: '#10b981', cơHữu: false },
    { id: 19, name: 'Trương Minh Trọng', role: 'Bác sĩ học viên', title: 'BSNT', phone: '', status: 'active', color: '#06b6d4', cơHữu: false },
    { id: 20, name: 'Bùi Nguyễn Sơn Nam', role: 'Bác sĩ học viên', title: 'BSNT', phone: '', status: 'active', color: '#8b5cf6', cơHữu: false },
    { id: 21, name: 'Nguyễn Thị Mỹ Ngọc', role: 'Bác sĩ học viên', title: 'BSNT', phone: '', status: 'active', color: '#ec4899', cơHữu: false },
    { id: 22, name: 'Nguyễn Tấn Định', role: 'Bác sĩ học viên', title: 'BSNT', phone: '', status: 'active', color: '#f59e0b', cơHữu: true },
    { id: 23, name: 'Lê Minh Hậu', role: 'Bác sĩ học viên', title: 'BSNT', phone: '', status: 'active', color: '#3b82f6', cơHữu: true },
    { id: 24, name: 'Phạm Thị Thanh Thảo', role: 'Điều dưỡng', title: 'ĐD', phone: '', status: 'active', color: '#14b8a6', cơHữu: true },
    { id: 25, name: 'Trần Phương Quan', role: 'Điều dưỡng', title: 'ĐD', phone: '', status: 'active', color: '#f97316', cơHữu: true },
    { id: 26, name: 'Nguyễn Như Hiền', role: 'Điều dưỡng', title: 'ĐD', phone: '', status: 'active', color: '#a855f7', cơHữu: true },
    { id: 27, name: 'Phan Thị Cẩm Tiên', role: 'Điều dưỡng', title: 'ĐD', phone: '', status: 'active', color: '#10b981', cơHữu: true },
    { id: 28, name: 'Trần Thanh Danh', role: 'Điều dưỡng', title: 'ĐD', phone: '', status: 'active', color: '#06b6d4', cơHữu: true },
    { id: 29, name: 'Phan Thị Thủy Tiên', role: 'Điều dưỡng', title: 'ĐD', phone: '', status: 'active', color: '#8b5cf6', cơHữu: true },
    { id: 30, name: 'Nguyễn Thị Huyền', role: 'Điều dưỡng', title: 'ĐD', phone: '', status: 'active', color: '#ec4899', cơHữu: true },
    { id: 31, name: 'Huỳnh Kim Xuân Hằng', role: 'Điều dưỡng', title: 'ĐD', phone: '', status: 'active', color: '#f59e0b', cơHữu: true },
    { id: 32, name: 'Bùi Thị Mộng Trinh', role: 'Điều dưỡng', title: 'ĐD', phone: '', status: 'active', color: '#3b82f6', cơHữu: true },
    { id: 33, name: 'Lê Thị Thu Trang', role: 'Điều dưỡng', title: 'ĐD', phone: '', status: 'active', color: '#14b8a6', cơHữu: true },
    { id: 34, name: 'Lê Thị Như Thảo', role: 'Điều dưỡng', title: 'ĐD', phone: '', status: 'active', color: '#f97316', cơHữu: true },
    { id: 35, name: 'Nguyễn Hoàng Diệu Trâm', role: 'Điều dưỡng', title: 'ĐD', phone: '', status: 'active', color: '#a855f7', cơHữu: true },
    { id: 36, name: 'Lý Hoàng Duy', role: 'Điều dưỡng', title: 'ĐD', phone: '', status: 'active', color: '#10b981', cơHữu: true },
    { id: 37, name: 'Bùi Thị Trưng', role: 'Hộ lý', title: 'HL', phone: '', status: 'active', color: '#06b6d4', cơHữu: true },
    { id: 38, name: 'Lê Thị Thúy An', role: 'Hộ lý', title: 'HL', phone: '', status: 'active', color: '#8b5cf6', cơHữu: true },
    { id: 39, name: 'Huỳnh Văn Hiếu', role: 'Hộ lý', title: 'HL', phone: '', status: 'active', color: '#ec4899', cơHữu: true },
    { id: 40, name: 'Nguyễn Thị Hoa', role: 'Thư ký', title: 'TK', phone: '', status: 'active', color: '#f59e0b', cơHữu: true },
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
            // T5: Phú, N.Đức, Huy
            T5_0:7, T5_1:10, T5_2:13,
            // T6: Quy, Hoan, Ý
            T6_0:8, T6_1:11, T6_2:17,
        },
        sieuAm: {
            T2_0:4, T3_0:9, T4_0:6, T5_0:7, T6_0:8,
        },
        pkB023: {
            T2_0:5, T3_0:1, T4_0:4, T5_0:6, T6_0:2,
        },
        pkB020: {
            // T2: Sáng Phú, Chiều Quy
            T2_0:7, T2_1:8,
            // T3: Sáng An
            T3_0:2,
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
