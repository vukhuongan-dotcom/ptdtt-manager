// ===== WEEKLY SCHEDULE PAGE =====
const SCHEDULE_POSITIONS = [
    { key: 'trucKhoa', label: 'Trực khoa', slots: 4, staffFilter: 'bs', color: '#06b6d4' },
    { key: 'sieuAm', label: 'Siêu âm', slots: 1, staffFilter: 'bs', color: '#8b5cf6' },
    { key: 'pkB023', label: 'P. Khám B023', slots: 2, slotLabels: ['Sáng', 'Chiều'], staffFilter: 'bs', color: '#f59e0b' },
    { key: 'pkB020', label: 'P. Khám B020', slots: 2, slotLabels: ['Sáng', 'Chiều'], staffFilter: 'bs', color: '#ec4899' },
    { key: 'pkK001', label: 'P. Khám K001', slots: 2, slotLabels: ['Sáng', 'Chiều'], staffFilter: 'bs', color: '#10b981' },
    { key: 'mo', label: 'Mổ', slots: 9, staffFilter: 'bs', color: '#ef4444' },
    { key: 'trucBCN', label: 'Trực BCN khoa', slots: 1, staffFilter: 'bcn', color: '#14b8a6' },
    { key: 'trucBV', label: 'Trực BV', slots: 3, staffFilter: 'bs', color: '#3b82f6' },
    { key: 'trucDD', label: 'Trực Đ.D', slots: 3, staffFilter: 'dd', color: '#f97316' },
    { key: 'trucHL', label: 'Trực Hộ lý', slots: 1, staffFilter: 'hl', color: '#84cc16' },
];

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const SchedulePage = {
    weekOffset: 0,

    // Staff with schedule editing permission (in addition to admins)
    _scheduleEditors: [7], // staffId 7 = Phạm Vĩnh Phú

    canEditSchedule(targetWeekKey) {
        const session = Auth.getSession();
        if (!session) return false;
        const hasEditPermission = session.isAdmin || this._scheduleEditors.includes(session.staffId);
        if (!hasEditPermission) return false;

        // Super Admin (vkan) có quyền chỉnh sửa tất cả các tuần
        if (session.isSuperAdmin) return true;

        // Tự động tính weekKey nếu chưa truyền vào
        let weekKey = targetWeekKey;
        if (!weekKey) {
            const dates = this.getWeekDates(this.weekOffset);
            weekKey = this.getWeekKey(dates);
        }

        const currentWeekKey = this.getWeekKey(this.getWeekDates(0));
        // Khóa không cho sửa các tuần đã kết thúc và tuần hiện tại (weekKey <= currentWeekKey) ngoại trừ Super Admin
        if (weekKey <= currentWeekKey) {
            return false;
        }

        return true;
    },

    isWeekLocked(targetWeekKey) {
        let weekKey = targetWeekKey;
        if (!weekKey) {
            const dates = this.getWeekDates(this.weekOffset);
            weekKey = this.getWeekKey(dates);
        }
        const currentWeekKey = this.getWeekKey(this.getWeekDates(0));
        return weekKey <= currentWeekKey;
    },

    // Timezone-safe YYYY-MM-DD formatter (avoids UTC shift from toISOString)
    _localDateStr(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    getWeekDates(offset) {
        const now = new Date();
        const day = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + (offset * 7));
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            dates.push(d);
        }
        return dates;
    },

    getWeekKey(dates) {
        return this._localDateStr(dates[0]);
    },

    getScheduleData(weekKey) {
        const all = Store.getAll('schedules');
        return all.find(s => s.weekKey === weekKey) || null;
    },

    getDefaultCellVal(posKey, cellKey, weekKey) {
        if (posKey === 'sieuAm') {
            return this.getDefaultCellVal('trucKhoa', cellKey, weekKey);
        }
        // Quy tắc phân công Học viên cố định (bắt đầu từ tuần 2026-08-03)
        if (weekKey >= '2026-08-03') {
            // Trực BCN Khoa cố định: An (T2, T5, CN), Hữu (T3, T4, T6, T7)
            if (posKey === 'trucBCN') {
                if (cellKey === 'T2_0') return 2; // BS Khương An
                if (cellKey === 'T3_0') return 1; // BS Hữu
                if (cellKey === 'T4_0') return 1; // BS Hữu
                if (cellKey === 'T5_0') return 2; // BS Khương An
                if (cellKey === 'T6_0') return 1; // BS Hữu
                if (cellKey === 'T7_0') return 1; // BS Hữu
                if (cellKey === 'CN_0') return 2; // BS Khương An
            }

            // Mổ chính ca đầu tiên mỗi ngày (Slot 0 T2-T6): Hữu (T2, T5), Tuấn (T3), An (T4), Hậu (T6)
            if (posKey === 'mo' && !cellKey.startsWith('T7_') && cellKey.endsWith('_0')) {
                if (cellKey === 'T2_0') return 1; // BS Hữu
                if (cellKey === 'T3_0') return 4; // BS Tuấn
                if (cellKey === 'T4_0') return 2; // BS Khương An
                if (cellKey === 'T5_0') return 1; // BS Hữu
                if (cellKey === 'T6_0') return 5; // BS Hậu
            }

            if (posKey === 'trucKhoa') {
                // Vị trí BS thứ 1 (Slot 0 - Trưởng kíp trực khoa): Tuấn - M.Đức - Nguyện - Quy - V. Phú (T2 -> T6)
                if (cellKey === 'T2_0') return 4; // BS Tuấn
                if (cellKey === 'T3_0') return 9; // BS M.Đức
                if (cellKey === 'T4_0') return 6; // BS Nguyện
                if (cellKey === 'T5_0') return 8; // BS Quy
                if (cellKey === 'T6_0') return 7; // BS V. Phú

                // Vị trí BS thứ 3 (Slot 2): Khôi - Kiệt - Phương - Luân - Phú (T2 -> T6)
                if (cellKey === 'T2_2') return 46; // Khôi
                if (cellKey === 'T3_2') return 44; // Kiệt
                if (cellKey === 'T4_2') return 16; // Phương
                if (cellKey === 'T5_2') return 45; // Luân
                if (cellKey === 'T6_2') return 43; // Phú

                // Vị trí BS thứ 4 (Slot 3): Thành - Tú - Sang (T2 -> T4)
                if (cellKey === 'T2_3') return 48; // Thành
                if (cellKey === 'T3_3') return 50; // Tú
                if (cellKey === 'T4_3') return 47; // Sang
            }

            if (posKey === 'mo' && cellKey.startsWith('T7_')) {
                // Phân công mổ thứ 7: chừa trống vị trí đầu tiên dành cho BS chính, luân phiên 1 kíp mỗi tuần
                const monday = new Date((weekKey || '2026-08-03') + 'T00:00:00');
                const baseMonday = new Date('2026-08-03T00:00:00');
                const diffWeeks = Math.round((monday - baseMonday) / (7 * 24 * 3600 * 1000));
                const isKip1 = (Math.abs(diffWeeks) % 2 === 0);

                if (cellKey === 'T7_0') return ''; // Vị trí đầu tiên chừa trống cho bác sĩ chính
                if (isKip1) {
                    // Kíp 1: Khôi (46), Luân (45), Thành (48)
                    if (cellKey === 'T7_1') return 46;
                    if (cellKey === 'T7_2') return 45;
                    if (cellKey === 'T7_3') return 48;
                } else {
                    // Kíp 2: Kiệt (44), Phú (43), Sang (47)
                    if (cellKey === 'T7_1') return 44;
                    if (cellKey === 'T7_2') return 43;
                    if (cellKey === 'T7_3') return 47;
                }
            }
        }

        if (weekKey >= '2026-10-26') {
            if (posKey === 'pkK001') {
                if (cellKey === 'T2_0') return 2; // BS Khương An
                if (cellKey === 'T2_1') return 9; // BS Minh Đức
                if (cellKey === 'T6_0' || cellKey === 'T6_1') return 7; // BS Vĩnh Phú (đổi lại sau 3 tháng)
            }
            if (posKey === 'pkB020') {
                if (cellKey === 'T2_0' || cellKey === 'T2_1') return 8; // BS Quy (đổi lại sau 3 tháng)
                if (cellKey === 'T3_0') return 2; // BS Khương An
            }
            if (posKey === 'trucKhoa') {
                if (cellKey === 'T5_0') return 7; // BS Vĩnh Phú (đổi lại sau 3 tháng)
                if (cellKey === 'T6_0') return 8; // BS Quy (đổi lại sau 3 tháng)
            }
            if (posKey === 'pkB023') {
                if (cellKey === 'T2_0' || cellKey === 'T2_1') return 5; // BS Hậu
                if (cellKey === 'T3_0' || cellKey === 'T3_1') return 1; // BS Hữu
                if (cellKey === 'T4_0' || cellKey === 'T4_1') return 4; // BS Tuấn
                if (cellKey === 'T5_0' || cellKey === 'T5_1') return 2; // BS Khương An
                if (cellKey === 'T6_0' || cellKey === 'T6_1') return 6; // BS Nguyện
            }
        } else {
            if (posKey === 'pkK001') {
                if (cellKey === 'T2_0') return 2; // BS Khương An
                if (cellKey === 'T2_1') return 9; // BS Minh Đức
                if (cellKey === 'T6_0' || cellKey === 'T6_1') return 8; // BS Quy (từ 27/07)
            }
            if (posKey === 'pkB020') {
                if (cellKey === 'T2_0' || cellKey === 'T2_1') return 7; // BS Vĩnh Phú (từ 27/07)
                if (cellKey === 'T3_0') return 2; // BS Khương An
            }
            if (posKey === 'trucKhoa') {
                if (cellKey === 'T5_0') return 8; // BS Quy (từ 27/07)
                if (cellKey === 'T6_0') return 7; // BS Vĩnh Phú (từ 27/07)
            }
            if (posKey === 'pkB023') {
                if (cellKey === 'T2_0' || cellKey === 'T2_1') return 5; // BS Hậu
                if (cellKey === 'T3_0' || cellKey === 'T3_1') return 1; // BS Hữu
                if (cellKey === 'T4_0' || cellKey === 'T4_1') return 4; // BS Tuấn
                if (cellKey === 'T5_0' || cellKey === 'T5_1') return 2; // BS Khương An
                if (cellKey === 'T6_0' || cellKey === 'T6_1') return 6; // BS Nguyện
            }
        }
        return '';
    },

    getStaffOptions(filterType) {
        const staff = Store.getAll('staff');
        switch (filterType) {
            case 'bs':
                return staff.filter(s =>
                    s.role.includes('Bác sĩ') || s.role.includes('Trưởng khoa') || s.role.includes('Phó trưởng khoa')
                );
            case 'bcn':
                return staff.filter(s =>
                    s.role.includes('Trưởng khoa') || s.role.includes('Phó trưởng khoa') || s.role === 'Điều dưỡng trưởng'
                );
            case 'dd':
                return staff.filter(s =>
                    s.role.includes('Điều dưỡng') || s.role === 'Điều dưỡng trưởng'
                );
            case 'hl':
                return staff.filter(s =>
                    s.role.includes('Hộ lý')
                );
            default:
                return staff;
        }
    },

    // Build short name map: detects duplicates and adds middle-name prefix
    _shortNameCache: null,
    // Custom short names for specific staff
    _customShortNames: { 2: 'An', 5: 'BHM.Hậu', 9: 'M.Đức', 10: 'N.Đức', 23: 'LM.Hậu', 27: 'C.Tiên', 29: 'T.Tiên' },
    _buildShortNames() {
        const staff = Store.getAll('staff');
        const lastNames = {};
        staff.forEach(s => {
            const parts = s.name.trim().split(/\s+/);
            const last = parts[parts.length - 1];
            if (!lastNames[last]) lastNames[last] = [];
            lastNames[last].push(s);
        });
        const map = {};
        Object.entries(lastNames).forEach(([last, people]) => {
            if (people.length === 1) {
                map[people[0].id] = last;
            } else {
                people.forEach(s => {
                    // Use custom name if defined
                    if (this._customShortNames[s.id]) {
                        map[s.id] = this._customShortNames[s.id];
                    } else {
                        const parts = s.name.trim().split(/\s+/);
                        if (parts.length >= 3) {
                            const mid = parts[parts.length - 2];
                            map[s.id] = `${mid.charAt(0)}. ${last}`;
                        } else if (parts.length === 2) {
                            map[s.id] = `${parts[0].charAt(0)}. ${last}`;
                        } else {
                            map[s.id] = last;
                        }
                    }
                });
            }
        });
        this._shortNameCache = map;
    },

    getShortName(staffId) {
        if (!this._shortNameCache) this._buildShortNames();
        return this._shortNameCache[staffId] || '';
    },

    checkScheduleConflicts(positions) {
        if (!positions) return [];
        const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
        const dayNames = { T2: 'Thứ 2', T3: 'Thứ 3', T4: 'Thứ 4', T5: 'Thứ 5', T6: 'Thứ 6', T7: 'Thứ 7', CN: 'Chủ nhật' };
        const posLabels = {
            trucKhoa: 'Trực Khoa',
            sieuAm: 'Siêu âm',
            pkB023: 'P.Khám B023',
            pkB020: 'P.Khám B020',
            pkK001: 'P.Khám K001',
            mo: 'Lịch Mổ',
            trucBCN: 'Trực BCN khoa',
            trucBV: 'Trực Bệnh viện',
            trucDD: 'Trực Đ.D',
            trucHL: 'Trực Hộ lý'
        };

        const conflicts = [];

        days.forEach((d) => {
            const staffDuties = {};

            // 1. Chỉ thu thập các vị trí phân công trên Bảng Phân Công Tuần
            Object.keys(posLabels).forEach(posKey => {
                const cells = positions[posKey] || {};
                Object.keys(cells).forEach(cellKey => {
                    if (cellKey.indexOf(`${d}_`) === 0) {
                        const val = cells[cellKey];
                        if (val && !isNaN(val)) {
                            const sid = parseInt(val);
                            if (sid > 0) {
                                const slot = cellKey.split('_')[1] || '0';
                                if (!staffDuties[sid]) staffDuties[sid] = [];
                                staffDuties[sid].push({
                                    posKey,
                                    posLabel: posLabels[posKey],
                                    slot,
                                    cellKey
                                });
                            }
                        }
                    }
                });
            });

            Object.keys(staffDuties).forEach(sidStr => {
                const sid = parseInt(sidStr);
                const duties = staffDuties[sid];

                // CHỈ kiểm tra xung đột giữa các ô vị trí trên Bảng Phân Công Tuần
                const hasTrucKhoa = duties.some(x => x.posKey === 'trucKhoa');
                const hasTrucBV = duties.some(x => x.posKey === 'trucBV');
                const hasMo = duties.some(x => x.posKey === 'mo');

                let isHardBlock = false;
                let isRelevantConflict = false;
                let targetDuties = duties;

                // QUY TẮC PHÂN ĐỊNH 2 CẶP VỊ TRÍ TRÊN BẢNG PHÂN CÔNG:
                // 1. Trực Khoa (TOÀN BỘ VỊ TRÍ) - Lịch Mổ: Không cho phép trùng, không được lưu (isHardBlock = true)
                // 2. Trực BV - Lịch Mổ: Cho phép trùng, hiện cảnh báo (*), cho phép lưu (isHardBlock = false)
                if (hasTrucKhoa && hasMo) {
                    isRelevantConflict = true;
                    isHardBlock = true;
                    targetDuties = duties.filter(x => x.posKey === 'trucKhoa' || x.posKey === 'mo');
                } else if (hasTrucBV && hasMo) {
                    isRelevantConflict = true;
                    isHardBlock = false;
                    targetDuties = duties.filter(x => x.posKey === 'trucBV' || x.posKey === 'mo');
                }

                if (!isRelevantConflict) return;

                const staffName = this.getShortName(sid);
                conflicts.push({
                    day: d,
                    dayName: dayNames[d],
                    staffId: sid,
                    staffName,
                    duties: targetDuties,
                    isHardBlock,
                    details: targetDuties.map(x => {
                        const slotStr = x.posKey === 'mo' ? `Kíp #${parseInt(x.slot) + 1}` : (x.posKey === 'trucKhoa' ? `Trực khoa Vị trí #${parseInt(x.slot) + 1}` : 'Trực BV');
                        return `${x.posLabel} (${slotStr})`;
                    }).join(' & ')
                });
            });
        });

        return conflicts;
    },

    render() {
        const dates = this.getWeekDates(this.weekOffset);
        const weekKey = this.getWeekKey(dates);
        const isAdmin = this.canEditSchedule(weekKey);
        const isLocked = this.isWeekLocked(weekKey);
        const session = Auth.getSession();
        const isSuperAdmin = session?.isSuperAdmin || false;

        const schedule = this.getScheduleData(weekKey);
        const today = this._localDateStr(new Date());

        const startStr = dates[0].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const endStr = dates[6].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

        const showReminder = (weekKey >= '2026-10-19' && weekKey <= '2026-11-08') || (today >= '2026-10-19' && today <= '2026-11-08');

        const effectivePositions = {};
        SCHEDULE_POSITIONS.forEach(pos => {
            effectivePositions[pos.key] = {};
            const data = schedule?.positions?.[pos.key] || {};
            for (let slot = 0; slot < pos.slots; slot++) {
                DAYS.forEach((d, dayIdx) => {
                    const cellKey = `${d}_${slot}`;
                    const val = (data && cellKey in data) ? data[cellKey] : (schedule ? '' : this.getDefaultCellVal(pos.key, cellKey, weekKey));
                    if (val) effectivePositions[pos.key][cellKey] = parseInt(val);
                });
            }
        });

        const activeConflicts = this.checkScheduleConflicts(effectivePositions);

        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Lịch phân công tuần</h1>
                <p class="page-subtitle">
                    Khoa Phẫu thuật Đại trực tràng — ${startStr} – ${endStr}
                    ${isLocked ? `<span class="schedule-locked-badge" style="margin-left:8px;padding:3px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;background:${isSuperAdmin ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.12)'};color:${isSuperAdmin ? '#d97706' : '#dc2626'};border:1px solid ${isSuperAdmin ? 'rgba(234,179,8,0.3)' : 'rgba(239,68,68,0.3)'}">🔒 Lịch tuần đã khóa ${isSuperAdmin ? '(Super Admin đang mở quyền)' : '(Chỉ Super Admin mới được sửa)'}</span>` : ''}
                </p>
            </div>
            <div class="flex items-center gap-8">
                <button class="btn btn-secondary" onclick="SchedulePage.exportPDF()" id="export-pdf-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
                    Xuất ảnh
                </button>
                ${isAdmin ? `<button class="btn btn-secondary" onclick="SchedulePage.undo()" id="undo-schedule-btn" ${(this._undoStack && this._undoStack.length > 0) ? '' : 'disabled style="opacity:0.5;cursor:not-allowed"'}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                    Hoàn tác ${(this._undoStack && this._undoStack.length > 0) ? `(${this._undoStack.length})` : ''}
                </button>
                <button class="btn btn-secondary" onclick="SchedulePage.copyFromPrevWeek()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Sao chép tuần trước
                </button>
                <button class="btn btn-danger" onclick="SchedulePage.clearSchedule()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Xoá lịch
                </button>
                <button class="btn btn-primary" onclick="SchedulePage.saveSchedule()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Lưu lịch
                </button>` : ''}
            </div>
        </div>

        ${activeConflicts.length > 0 ? `
        <div class="schedule-conflict-banner">
            <div class="schedule-alert-icon">⚠️</div>
            <div class="schedule-alert-content">
                <div class="schedule-alert-title">CẢNH BÁO TRÙNG LẶP LỊCH MỔ & LỊCH TRỰC (${activeConflicts.length} TRƯỜNG HỢP *):</div>
                <ul class="schedule-alert-list">
                    ${activeConflicts.map(c => `
                        <li><strong>${c.dayName}:</strong> <span style="font-weight:700">${c.staffName}</span> bị trùng: <em>${c.details}</em></li>
                    `).join('')}
                </ul>
                <div class="schedule-alert-sub">⚠️ Các bác sĩ bị trùng lịch mổ & trực được tô màu cảnh báo kèm dấu (*). Lịch vẫn cho phép lưu bình thường.</div>
            </div>
        </div>
        ` : ''}

        ${showReminder ? `
        <div class="schedule-alert-banner">
            <div class="schedule-alert-icon">🔔</div>
            <div class="schedule-alert-content">
                <div class="schedule-alert-title">THÔNG BÁO THAY ĐỔI LỊCH PHÒNG KHÁM & TRỰC KHOA (Áp dụng từ 26/10/2026):</div>
                <ul class="schedule-alert-list">
                    <li><strong>P. Khám B020 (Thứ 2):</strong> BSCKI Giao Hữu Trường Quy thay BSCKI Phạm Vĩnh Phú (Sáng & Chiều).</li>
                    <li><strong>P. Khám K001 (Thứ 6):</strong> BSCKI Phạm Vĩnh Phú thay BSCKI Giao Hữu Trường Quy (Sáng & Chiều).</li>
                    <li><strong>Trực Khoa:</strong> BSCKI Phạm Vĩnh Phú trực Thứ 5, BSCKI Giao Hữu Trường Quy trực Thứ 6.</li>
                </ul>
                <div class="schedule-alert-sub">Vui lòng kiểm tra và cập nhật khi soạn lịch phân công tuần!</div>
            </div>
        </div>
        ` : ''}

        <div class="schedule-nav">
            <button class="btn-icon" onclick="SchedulePage.prevWeek()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="schedule-week-label">${startStr} — ${endStr}</span>
            <button class="btn-icon" onclick="SchedulePage.nextWeek()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="SchedulePage.thisWeek()">Tuần này</button>
        </div>

        <div class="schedule-table-wrap">
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th class="schedule-pos-header">Vị trí</th>
                        ${dates.map((d, i) => {
            const dateStr = SchedulePage._localDateStr(d);
            const isToday = dateStr === today;
            const dayNum = d.getDate();
            return `<th class="schedule-day-header ${isToday ? 'today' : ''} ${i >= 5 ? 'weekend' : ''}">
                                <span class="schedule-day-name">${DAY_LABELS[i]}</span>
                                <span class="schedule-day-date">${dayNum}/${d.getMonth() + 1}</span>
                            </th>`;
        }).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${SCHEDULE_POSITIONS.map(pos => this.renderPositionRow(pos, dates, schedule, isAdmin, weekKey, activeConflicts)).join('')}
                </tbody>
            </table>
        </div>

        <div class="schedule-notes card schedule-notes--mt">
            <h3 class="schedule-notes-heading">📝 Ghi chú</h3>
            ${isAdmin
                ? `<textarea class="form-textarea schedule-notes-textarea" id="schedule-notes" placeholder="Ghi chú tuần này...">${schedule?.notes || ''}</textarea>`
                : `<p class="schedule-notes-readonly">${schedule?.notes ? schedule.notes.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : 'Không có ghi chú'}</p>`
            }
        </div>

        ${this.renderRobotSection(schedule, dates, isAdmin)}
        `;
    },

    renderPositionRow(pos, dates, schedule, isAdmin, weekKey, activeConflicts = []) {
        const staffOptions = this.getStaffOptions(pos.staffFilter);
        const data = schedule?.positions?.[pos.key] || {};

        let rows = '';
        for (let slot = 0; slot < pos.slots; slot++) {
            rows += `<tr class="${slot === 0 ? 'schedule-pos-first' : 'schedule-pos-sub'}" data-group="${pos.key}">`;

            // Position label (only on first slot, rowspan)
            if (slot === 0) {
                rows += `<td class="schedule-pos-label schedule-pos-label--colored" rowspan="${pos.slots}" style="border-left:3px solid ${pos.color}">
                    <span class="schedule-pos-name">${pos.label}</span>
                    ${pos.slotLabels ? '' : (pos.slots > 1 ? `<span class="schedule-pos-slots">${pos.slots} vị trí</span>` : '')}
                </td>`;
            }

            // Each day
            const isLeadSlot = slot === 0 && (pos.key === 'trucKhoa' || pos.key === 'mo');
            dates.forEach((d, dayIdx) => {
                const cellKey = `${DAYS[dayIdx]}_${slot}`;
                const val = (data && cellKey in data) ? data[cellKey] : (schedule ? '' : this.getDefaultCellVal(pos.key, cellKey, weekKey));
                const slotLabel = pos.slotLabels ? pos.slotLabels[slot] : '';
                const leadClass = isLeadSlot ? ' schedule-lead-slot' : '';

                const cellConf = activeConflicts.find(c => c.duties.some(dt => dt.posKey === pos.key && dt.cellKey === cellKey));
                const isHardCell = cellConf?.isHardBlock;
                const isSoftCell = cellConf && !cellConf.isHardBlock;
                const conflictCls = isHardCell ? ' schedule-select--conflict-block' : (isSoftCell ? ' schedule-select--conflict' : '');

                if (isAdmin) {
                    rows += `<td class="schedule-cell ${dayIdx >= 5 ? 'weekend' : ''}${leadClass}">
                        ${slotLabel ? `<span class="schedule-slot-label">${slotLabel}</span>` : ''}
                        <select class="schedule-select${conflictCls}" data-pos="${pos.key}" data-cell="${cellKey}" onchange="SchedulePage.onCellChange(this)">
                            <option value="">—</option>
                            ${staffOptions.map(s => {
                                const stConf = activeConflicts.find(c => c.day === DAYS[dayIdx] && c.staffId === s.id && c.duties.some(dt => dt.cellKey === cellKey));
                                const symbol = stConf ? (stConf.isHardBlock ? ' 🛑' : '*') : '';
                                return `<option value="${s.id}" ${val == s.id ? 'selected' : ''}>${this.getShortName(s.id)}${symbol}</option>`;
                            }).join('')}
                        </select>
                    </td>`;
                } else {
                    const baseName = val ? this.getShortName(parseInt(val)) : '—';
                    let name = baseName;
                    let confClass = '';
                    if (val && cellConf) {
                        confClass = isHardCell ? ' schedule-name--conflict-block' : ' schedule-name--conflict';
                        name = `${baseName}${isHardCell ? ' 🛑' : '*'}`;
                    }
                    rows += `<td class="schedule-cell ${dayIdx >= 5 ? 'weekend' : ''} readonly${leadClass}">
                        ${slotLabel ? `<span class="schedule-slot-label">${slotLabel}</span>` : ''}
                        <span class="schedule-name${confClass}">${name}</span>
                    </td>`;
                }
            });

            rows += '</tr>';
        }
        return rows;
    },

    _undoStack: [],

    pushUndoState() {
        if (!this._undoStack) this._undoStack = [];
        const dates = this.getWeekDates(this.weekOffset);
        const weekKey = this.getWeekKey(dates);
        const schedule = this.getScheduleData(weekKey);
        
        const positions = {};
        const selects = document.querySelectorAll('.schedule-select');
        if (selects.length > 0) {
            selects.forEach(sel => {
                const pos = sel.dataset.pos;
                const cell = sel.dataset.cell;
                if (!positions[pos]) positions[pos] = {};
                if (sel.value) positions[pos][cell] = parseInt(sel.value);
            });
        } else if (schedule?.positions) {
            Object.assign(positions, JSON.parse(JSON.stringify(schedule.positions)));
        }

        const notesEl = document.getElementById('schedule-notes');
        const notes = notesEl ? notesEl.value : (schedule?.notes || '');
        const robotSurgery = schedule?.robotSurgery ? JSON.parse(JSON.stringify(schedule.robotSurgery)) : [];

        const lastState = this._undoStack[this._undoStack.length - 1];
        if (lastState && JSON.stringify(lastState.positions) === JSON.stringify(positions) && lastState.notes === notes) {
            return;
        }

        this._undoStack.push({
            weekKey,
            positions,
            notes,
            robotSurgery
        });
        if (this._undoStack.length > 30) this._undoStack.shift();
        this._updateUndoButton();
    },

    _updateUndoButton() {
        const btn = document.getElementById('undo-schedule-btn');
        if (!btn) return;
        const count = (this._undoStack || []).length;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg> Hoàn tác ${count > 0 ? `(${count})` : ''}`;
        if (count > 0) {
            btn.removeAttribute('disabled');
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        } else {
            btn.setAttribute('disabled', 'true');
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        }
    },

    async undo() {
        if (!this._undoStack || this._undoStack.length === 0) {
            Toast.info('Không có thao tác nào để hoàn tác.');
            return;
        }

        const state = this._undoStack.pop();
        const dates = this.getWeekDates(this.weekOffset);
        const weekKey = this.getWeekKey(dates);

        const saved = await this._upsertSchedule(weekKey, dates, {
            positions: state.positions,
            notes: state.notes,
            robotSurgery: state.robotSurgery
        });

        if (!saved?.ok) {
            Toast.error('Lỗi khi hoàn tác lịch phân công.');
            return;
        }

        App.renderCurrentPage();
        Toast.info('Đã hoàn tác thao tác vừa rồi!', 'Hoàn tác');
    },

    onCellChange(el) {
        this.pushUndoState();
        const pos = el.dataset.pos;
        const cell = el.dataset.cell;

        // Auto-sync between trucKhoa (slot 0) and sieuAm
        if (cell && cell.endsWith('_0')) {
            const dayCode = cell.split('_')[0];
            const targetCell = `${dayCode}_0`;
            let partnerPos = null;

            if (pos === 'trucKhoa') partnerPos = 'sieuAm';
            else if (pos === 'sieuAm') partnerPos = 'trucKhoa';

            if (partnerPos) {
                const partnerSelect = document.querySelector(`.schedule-select[data-pos="${partnerPos}"][data-cell="${targetCell}"]`);
                if (partnerSelect && partnerSelect.value !== el.value) {
                    partnerSelect.value = el.value;
                    if (el.value) partnerSelect.classList.add('has-value');
                    else partnerSelect.classList.remove('has-value');
                }
            }
        }

        if (el.value) {
            el.classList.add('has-value');
        } else {
            el.classList.remove('has-value');
        }

        const positions = {};
        document.querySelectorAll('.schedule-select').forEach(sel => {
            const pos = sel.dataset.pos;
            const cell = sel.dataset.cell;
            if (!positions[pos]) positions[pos] = {};
            if (sel.value) positions[pos][cell] = parseInt(sel.value);
        });

        const conflicts = this.checkScheduleConflicts(positions);

        document.querySelectorAll('.schedule-select').forEach(sel => {
            const pos = sel.dataset.pos;
            const cell = sel.dataset.cell;
            const dayCode = cell.split('_')[0];
            const cellConf = conflicts.find(c => c.duties.some(d => d.posKey === pos && d.cellKey === cell));

            sel.classList.remove('schedule-select--conflict', 'schedule-select--conflict-block');
            if (cellConf) {
                sel.classList.add(cellConf.isHardBlock ? 'schedule-select--conflict-block' : 'schedule-select--conflict');
            }

            // Dynamic update of option text with 🛑 or *
            Array.from(sel.options).forEach(opt => {
                if (!opt.value) return;
                const sid = parseInt(opt.value);
                const baseName = SchedulePage.getShortName(sid);
                const stConf = conflicts.find(c => c.day === dayCode && c.staffId === sid && c.duties.some(d => d.cellKey === cell));
                const symbol = stConf ? (stConf.isHardBlock ? ' 🛑' : '*') : '';
                opt.textContent = baseName + symbol;
            });
        });

        let bannerEl = document.querySelector('.schedule-conflict-banner');
        if (conflicts.length > 0) {
            const hardCount = conflicts.filter(c => c.isHardBlock).length;
            const html = `
                <div class="schedule-alert-icon">${hardCount > 0 ? '🛑' : '⚠️'}</div>
                <div class="schedule-alert-content">
                    <div class="schedule-alert-title">CẢNH BÁO XUNG ĐỘT LỊCH PHÂN CÔNG (${conflicts.length} TRƯỜNG HỢP):</div>
                    <ul class="schedule-alert-list">
                        ${conflicts.map(c => `<li><strong>${c.dayName}:</strong> <span style="font-weight:700">${c.staffName}</span> bị trùng: <em>${c.details}</em> ${c.isHardBlock ? '<strong style="color:#b91c1c">[CẤM LƯU 🛑]</strong>' : '<span style="color:#b45309">[CẢNH BÁO *]</span>'}</li>`).join('')}
                    </ul>
                    <div class="schedule-alert-sub">${hardCount > 0 ? '🛑 TRỰC KHOA không được trùng với Lịch mổ. Vui lòng điều chỉnh lại trước khi lưu!' : '⚠️ Trực BV trùng với Lịch mổ: Đã đánh dấu (*) cảnh báo nhưng vẫn cho phép lưu lịch.'}</div>
                </div>
            `;
            if (bannerEl) {
                bannerEl.innerHTML = html;
                bannerEl.style.display = 'flex';
            } else {
                const navEl = document.querySelector('.schedule-nav');
                if (navEl) {
                    const newBanner = document.createElement('div');
                    newBanner.className = 'schedule-conflict-banner';
                    newBanner.innerHTML = html;
                    navEl.parentNode.insertBefore(newBanner, navEl);
                }
            }
            
            const currentCell = el.dataset.cell;
            const currentPos = el.dataset.pos;
            const matchedConf = conflicts.find(c => c.duties.some(d => d.posKey === currentPos && d.cellKey === currentCell));
            if (matchedConf && el.value) {
                if (matchedConf.isHardBlock) {
                    Toast.error(`🛑 TRỰC KHOA TRÙNG LỊCH MỔ: ${matchedConf.staffName} (${matchedConf.dayName}). Vui lòng sửa lại vì không thể lưu!`);
                } else {
                    Toast.warning(`⚠️ TRỰC BV TRÙNG LỊCH MỔ (*): ${matchedConf.staffName} (${matchedConf.dayName}). Cảnh báo dấu (*) nhưng vẫn cho phép lưu.`);
                }
            }
        } else if (bannerEl) {
            bannerEl.style.display = 'none';
        }
    },

    _upsertSchedule(weekKey, dates, updates) {
        const schedules = [...Store.getAll('schedules')];
        const existing = schedules.findIndex(s => s.weekKey === weekKey);
        if (!Store._data.nextIds) Store._data.nextIds = {};
        if (!Number.isFinite(Store._data.nextIds.schedules)) {
            Store._data.nextIds.schedules = Math.max(0, ...schedules.map(s => s?.id || 0)) + 1;
        }

        if (existing >= 0) {
            schedules[existing] = { ...schedules[existing], ...updates };
        } else {
            schedules.push({
                id: Store._data.nextIds.schedules++,
                weekKey,
                startDate: this._localDateStr(dates[0]),
                endDate: this._localDateStr(dates[6]),
                positions: {},
                robotSurgery: [],
                notes: '',
                ...updates
            });
        }

        Store.replaceCollection('schedules', schedules);
        return Store.saveCollections(['schedules']);
    },

    showConflictModal(conflicts, isBlock = false) {
        Modal.open(isBlock ? '🛑 Vi phạm Quy chế: Trực Khoa trùng Lịch Mổ' : '⚠️ Cảnh báo trùng lặp Trực BV & Lịch Mổ', `
            <div style="padding:4px 0">
                <div style="color:${isBlock ? 'var(--danger,#dc2626)' : 'var(--warning-dark,#b45309)'};font-weight:700;font-size:0.92rem;margin-bottom:12px;display:flex;align-items:center;gap:6px">
                    <span>${isBlock ? '🛑 KHÔNG THỂ LƯU LỊCH PHÂN CÔNG' : '⚠️ PHÁT HIỆN TRÙNG LỊCH MỔ & TRỰC BV (*)'}</span>
                </div>
                <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:14px;line-height:1.5">
                    ${isBlock
                        ? `Phát hiện <strong>${conflicts.length} trường hợp TRỰC KHOA bị trùng với Lịch mổ/Khám</strong>. Theo quy chế Khoa, bác sĩ Trực khoa không được thực hiện mổ. Vui lòng điều chỉnh lại.`
                        : `Hệ thống ghi nhận <strong>${conflicts.length} trường hợp Trực BV trùng với Lịch mổ</strong>. Các vị trí được đánh dấu (*). Lịch vẫn cho phép lưu bình thường.`
                    }
                </p>
                <div style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:10px;padding:14px 16px;max-height:260px;overflow-y:auto">
                    ${conflicts.map(c => `
                        <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border-light)">
                            <div style="display:flex;justify-content:space-between;align-items:center">
                                <span style="font-weight:700;color:var(--primary)">📅 ${c.dayName}</span>
                                <span style="background:${c.isHardBlock ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'};color:${c.isHardBlock ? '#dc2626' : '#b45309'};font-size:0.75rem;font-weight:700;padding:2px 8px;border-radius:12px">${c.isHardBlock ? '🛑 Cấm lưu' : 'Trùng mổ/trực *'}</span>
                            </div>
                            <div style="font-weight:700;font-size:0.9rem;color:var(--text-primary);margin:4px 0 2px 0">${c.staffName}${c.isHardBlock ? ' 🛑' : '*'}</div>
                            <div style="font-size:0.82rem;color:${c.isHardBlock ? '#dc2626' : '#b45309'};line-height:1.4">👉 Trùng vị trí: <strong>${c.details}</strong></div>
                        </div>
                    `).join('')}
                </div>
                <div class="modal-footer" style="margin-top:16px">
                    <button class="btn btn-primary" onclick="Modal.close()">${isBlock ? 'Đã hiểu & Sửa lại' : 'Đã hiểu'}</button>
                </div>
            </div>
        `);
    },

    async saveSchedule() {
        const dates = this.getWeekDates(this.weekOffset);
        const weekKey = this.getWeekKey(dates);
        if (!this.canEditSchedule(weekKey)) {
            Toast.warning('🔒 Lịch tuần này đã kết thúc & khóa. Chỉ Super Admin mới được phép chỉnh sửa.');
            return;
        }

        const positions = {};
        document.querySelectorAll('.schedule-select').forEach(sel => {
            const pos = sel.dataset.pos;
            const cell = sel.dataset.cell;
            if (!positions[pos]) positions[pos] = {};
            if (sel.value) positions[pos][cell] = parseInt(sel.value);
        });

        const conflicts = this.checkScheduleConflicts(positions);

        const hardBlocks = conflicts.filter(c => c.isHardBlock);
        const softWarnings = conflicts.filter(c => !c.isHardBlock);

        // 1. HARD BLOCKS: Stop saving immediately if Trực Khoa overlaps with Lịch Mổ!
        if (hardBlocks.length > 0) {
            Toast.error(`❌ QUY CHẾ KHOA: Không thể lưu lịch! Bác sĩ Trực Khoa không được trùng lịch mổ.`);
            this.showConflictModal(hardBlocks, true);
            return;
        }

        // 2. SOFT WARNINGS: Trực BV trùng Lịch Mổ -> Ask confirmation with warning (*), BUT ALLOW SAVING!
        let confirmMsg = 'Xác nhận lưu lịch phân công tuần này?<br>Dữ liệu hiện tại trên bảng sẽ được ghi nhận.';
        if (softWarnings.length > 0) {
            confirmMsg = `⚠️ <strong>Phát hiện ${softWarnings.length} trường hợp Trực BV trùng Lịch mổ (đánh dấu *):</strong><br>` +
                `<ul style="text-align:left;font-size:0.82rem;margin:8px 0;padding-left:20px;color:var(--warning-dark,#b45309)">` +
                softWarnings.map(c => `<li><strong>${c.dayName}:</strong> ${c.staffName} (${c.details})</li>`).join('') +
                `</ul>Hệ thống cảnh báo dấu (*) nhưng vẫn cho phép lưu. Bạn có chắc chắn muốn lưu lịch không?`;
        }

        const confirmed = await Confirm.show({
            title: softWarnings.length > 0 ? '⚠️ Lưu lịch (Trực BV trùng Lịch mổ *)' : 'Lưu lịch phân công',
            message: confirmMsg,
            icon: softWarnings.length > 0 ? '⚠️' : '💾',
            type: softWarnings.length > 0 ? 'warning' : 'info',
            confirmText: 'Lưu lịch ngay',
            cancelText: 'Huỷ'
        });
        if (!confirmed) return;

        const notes = document.getElementById('schedule-notes')?.value || '';
        const robotSurgery = this._collectRobotData();

        const saved = await this._upsertSchedule(weekKey, dates, { positions, notes, robotSurgery });
        if (!saved?.ok) {
            return Toast.error(saved?.errors?.[0]?.message || 'Chưa lưu được lịch phân công. Vui lòng thử lại.');
        }

        if (softWarnings.length > 0) {
            Toast.warning(`⚠️ Đã lưu lịch phân công (ghi nhận ${softWarnings.length} trường hợp Trực BV trùng mổ có dấu *).`);
        } else {
            Toast.success('Đã lưu lịch phân công tuần thành công!', 'Lưu lịch');
        }
    },

    async clearSchedule() {
        const dates = this.getWeekDates(this.weekOffset);
        const weekKey = this.getWeekKey(dates);
        if (!this.canEditSchedule(weekKey)) {
            Toast.warning('🔒 Lịch tuần này đã kết thúc & khóa. Chỉ Super Admin mới được phép chỉnh sửa.');
            return;
        }
        const confirmed = await Confirm.show({
            title: 'Xoà lịch phân công tuần',
            message: 'Xoà các vị trí linh hoạt trên lịch tuần này?<br>Các <strong>vị trí trực khoa cố định và lịch mổ Thứ 7</strong> sẽ được giữ nguyên.',
            icon: '⚠️',
            type: 'warning',
            confirmText: 'Xoà các vị trí linh hoạt',
            cancelText: 'Giữ lại'
        });
        if (!confirmed) return;

        this.pushUndoState();

        const clearedPositions = {};
        if (weekKey >= '2026-08-03') {
            clearedPositions.trucBCN = {
                T2_0: 2, T3_0: 1, T4_0: 1, T5_0: 2, T6_0: 1, T7_0: 1, CN_0: 2
            };

            clearedPositions.trucKhoa = {
                T2_0: 4, T3_0: 9, T4_0: 6, T5_0: 8, T6_0: 7,
                T2_2: 46, T3_2: 44, T4_2: 16, T5_2: 45, T6_2: 43,
                T2_3: 48, T3_3: 50, T4_3: 47
            };

            clearedPositions.sieuAm = {
                T2_0: 4, T3_0: 9, T4_0: 6, T5_0: 8, T6_0: 7
            };

            clearedPositions.pkB023 = {
                T2_0: 5, T2_1: 5,
                T3_0: 1, T3_1: 1,
                T4_0: 4, T4_1: 4,
                T5_0: 2, T5_1: 2,
                T6_0: 6, T6_1: 6
            };
            clearedPositions.pkB020 = { T2_0: 7, T2_1: 7, T3_0: 2 };
            clearedPositions.pkK001 = { T2_0: 2, T2_1: 9, T6_0: 8, T6_1: 8 };

            const monday = new Date((weekKey || '2026-08-03') + 'T00:00:00');
            const baseMonday = new Date('2026-08-03T00:00:00');
            const diffWeeks = Math.round((monday - baseMonday) / (7 * 24 * 3600 * 1000));
            const isKip1 = (Math.abs(diffWeeks) % 2 === 0);

            clearedPositions.mo = {
                T2_0: 1, T3_0: 4, T4_0: 2, T5_0: 1, T6_0: 5,
                ...(isKip1 ? { T7_1: 46, T7_2: 45, T7_3: 48 } : { T7_1: 44, T7_2: 43, T7_3: 47 })
            };
        }

        const saved = await this._upsertSchedule(weekKey, dates, { positions: clearedPositions, notes: '', robotSurgery: [] });
        if (!saved?.ok) {
            return Toast.error(saved?.errors?.[0]?.message || 'Chưa xoá được lịch phân công. Vui lòng thử lại.');
        }
        App.renderCurrentPage();
        Toast.success('Đã xoá các vị trí linh hoạt (giữ nguyên vị trí cố định).', 'Xoá lịch');
    },

    prevWeek() { this.weekOffset--; App.renderCurrentPage(); },
    nextWeek() { this.weekOffset++; App.renderCurrentPage(); },
    thisWeek() { this.weekOffset = 0; App.renderCurrentPage(); },

    // ===== ROBOT SURGERY SECTION =====
    renderRobotSection(schedule, dates, isAdmin) {
        const robotEntries = schedule?.robotSurgery || [];
        const bsOptions = this.getStaffOptions('bs');

        return `
        <div class="card robot-surgery-card robot-surgery-card--mt">
            <div class="flex justify-between items-center robot-card-header">
                <h3 class="robot-card-title">🤖 Lịch phụ mổ Robot</h3>
                ${isAdmin ? `<button class="btn btn-secondary btn-sm" onclick="SchedulePage.addRobotEntry()">
                    ${Utils.plusIcon()} Thêm ca
                </button>` : ''}
            </div>
            <table class="schedule-table robot-table">
                <thead>
                    <tr>
                        <th class="robot-th-day">Ngày mổ</th>
                        ${isAdmin ? '<th class="robot-th-session">Ca</th>' : ''}
                        <th>BS phụ 1</th>
                        <th>BS phụ 2</th>
                        <th>BS phụ 3</th>
                        ${isAdmin ? '<th class="robot-th-action"></th>' : ''}
                    </tr>
                </thead>
                <tbody id="robot-tbody">
                    ${robotEntries.length ? robotEntries.map((entry, idx) => {
            if (isAdmin) {
                return `<tr>
                                <td>
                                    <select class="schedule-select has-value" data-robot="day" data-idx="${idx}">
                                        ${dates.map((d, i) => {
                    const dStr = SchedulePage._localDateStr(d);
                    const label = `${DAY_LABELS[i]}, ${d.getDate()}/${d.getMonth() + 1}`;
                    return `<option value="${dStr}" ${entry.day === dStr ? 'selected' : ''}>${label}</option>`;
                }).join('')}
                                    </select>
                                </td>
                                <td>
                                    <select class="schedule-select has-value" data-robot="session" data-idx="${idx}">
                                        <option value="1" ${entry.session == 1 ? 'selected' : ''}>Ca 1</option>
                                        <option value="2" ${entry.session == 2 ? 'selected' : ''}>Ca 2</option>
                                        <option value="3" ${entry.session == 3 ? 'selected' : ''}>Ca 3</option>
                                    </select>
                                </td>
                                ${[0, 1, 2].map(slot => `<td>
                                    <select class="schedule-select ${entry.doctors?.[slot] ? 'has-value' : ''}" data-robot="doc${slot}" data-idx="${idx}" onchange="SchedulePage.onCellChange(this)">
                                        <option value="">—</option>
                                        ${bsOptions.map(s => `<option value="${s.id}" ${entry.doctors?.[slot] == s.id ? 'selected' : ''}>${this.getShortName(s.id)}</option>`).join('')}
                                    </select>
                                </td>`).join('')}
                                <td><button class="btn-icon" onclick="SchedulePage.removeRobotEntry(${idx})" title="Xoá">${Utils.deleteIcon()}</button></td>
                            </tr>`;
            } else {
                const dayDate = new Date(entry.day);
                const dayLabel = DAY_LABELS[dates.findIndex(d => SchedulePage._localDateStr(d) === entry.day)] || entry.day;
                const dayNum = dayDate.getDate();
                const dayMonth = dayDate.getMonth() + 1;
                return `<tr>
                                <td>${dayLabel}, ${dayNum}/${dayMonth}</td>
                                ${isAdmin ? `<td>Ca ${entry.session}</td>` : ''}
                                ${[0, 1, 2].map(slot => `<td>${entry.doctors?.[slot] ? this.getShortName(entry.doctors[slot]) : '—'}</td>`).join('')}
                            </tr>`;
            }
        }).join('') : `<tr><td colspan="${isAdmin ? 6 : 4}" class="robot-empty-cell">Chưa có lịch mổ Robot tuần này</td></tr>`}
                </tbody>
            </table>
        </div>`;
    },

    async addRobotEntry() {
        if (!this.canEditSchedule()) return;
        const dates = this.getWeekDates(this.weekOffset);
        const weekKey = this.getWeekKey(dates);
        const schedule = this.getScheduleData(weekKey);

        const robotSurgery = schedule?.robotSurgery ? [...schedule.robotSurgery] : [];
        robotSurgery.push({
            day: this._localDateStr(dates[0]),
            session: 1,
            doctors: [null, null, null]
        });

        const saved = await this._saveRobotToSchedule(weekKey, dates, robotSurgery);
        if (!saved?.ok) return Toast.error(saved?.errors?.[0]?.message || 'Chưa lưu được lịch Robot.');
        App.renderCurrentPage();
    },

    async removeRobotEntry(idx) {
        if (!this.canEditSchedule()) return;
        const dates = this.getWeekDates(this.weekOffset);
        const weekKey = this.getWeekKey(dates);
        const schedule = this.getScheduleData(weekKey);
        if (!schedule?.robotSurgery) return;

        const robotSurgery = [...schedule.robotSurgery];
        robotSurgery.splice(idx, 1);

        const saved = await this._saveRobotToSchedule(weekKey, dates, robotSurgery);
        if (!saved?.ok) return Toast.error(saved?.errors?.[0]?.message || 'Chưa lưu được lịch Robot.');
        App.renderCurrentPage();
    },

    _saveRobotToSchedule(weekKey, dates, robotSurgery) {
        return this._upsertSchedule(weekKey, dates, { robotSurgery });
    },

    _collectRobotData() {
        const entries = [];
        const rows = document.querySelectorAll('#robot-tbody tr');
        rows.forEach((row, idx) => {
            const dayEl = row.querySelector('[data-robot="day"]');
            const sessionEl = row.querySelector('[data-robot="session"]');
            if (!dayEl || !sessionEl) return;
            entries.push({
                day: dayEl.value,
                session: parseInt(sessionEl.value),
                doctors: [0, 1, 2].map(slot => {
                    const el = row.querySelector(`[data-robot="doc${slot}"]`);
                    return el && el.value ? parseInt(el.value) : null;
                })
            });
        });
        return entries;
    },

    async copyFromPrevWeek() {
        const dates = this.getWeekDates(this.weekOffset);
        const weekKey = this.getWeekKey(dates);
        if (!this.canEditSchedule(weekKey)) {
            Toast.warning('🔒 Lịch tuần này đã kết thúc & khóa. Chỉ Super Admin mới được phép chỉnh sửa.');
            return;
        }

        const prevDates = this.getWeekDates(this.weekOffset - 1);
        const prevKey = this.getWeekKey(prevDates);
        const allSchedules = Store.getAll('schedules');
        const prevSchedule = allSchedules.find(s => s.weekKey === prevKey);

        if (!prevSchedule || !prevSchedule.positions) {
            const prevStart = prevDates[0].toLocaleDateString('vi-VN');
            const prevEnd = prevDates[6].toLocaleDateString('vi-VN');
            Toast.warning(`Không có dữ liệu lịch tuần trước (${prevStart} – ${prevEnd}) để sao chép.`);
            return;
        }

        const confirmed = await Confirm.show({
            title: 'Sao chép lịch tuần trước',
            message: 'Sao chép các vị trí linh hoạt từ tuần trước vào tuần này?<br>Các <strong>vị trí trực khoa cố định và lịch mổ Thứ 7</strong> sẽ được giữ nguyên không bị ghi đè.',
            icon: '📋',
            type: 'warning',
            confirmText: 'Sao chép lịch',
            cancelText: 'Huỷ'
        });
        if (!confirmed) return;

        this.pushUndoState();

        // Copy data directly in store
        const copiedPositions = JSON.parse(JSON.stringify(prevSchedule.positions));
        const copiedNotes = prevSchedule.notes || '';
        const copiedRobot = prevSchedule.robotSurgery ? JSON.parse(JSON.stringify(prevSchedule.robotSurgery)) : [];

        // Bảo vệ các vị trí cố định từ tuần 2026-08-03 không bị ghi đè
        if (weekKey >= '2026-08-03') {
            // Trực BCN Khoa cố định: An (T2, T5, CN), Hữu (T3, T4, T6, T7)
            copiedPositions.trucBCN = {
                'T2_0': 2, 'T3_0': 1, 'T4_0': 1, 'T5_0': 2, 'T6_0': 1, 'T7_0': 1, 'CN_0': 2
            };

            if (!copiedPositions.trucKhoa) copiedPositions.trucKhoa = {};
            // Trưởng kíp Trực khoa (Slot 0): Tuấn - M.Đức - Nguyện - Quy - V.Phú
            copiedPositions.trucKhoa['T2_0'] = 4; // Tuấn
            copiedPositions.trucKhoa['T3_0'] = 9; // M.Đức
            copiedPositions.trucKhoa['T4_0'] = 6; // Nguyện
            copiedPositions.trucKhoa['T5_0'] = 8; // Quy
            copiedPositions.trucKhoa['T6_0'] = 7; // V.Phú

            // Vị trí BS thứ 3 (Slot 2): Khôi - Kiệt - Phương - Luân - Phú
            copiedPositions.trucKhoa['T2_2'] = 46; // Khôi
            copiedPositions.trucKhoa['T3_2'] = 44; // Kiệt
            copiedPositions.trucKhoa['T4_2'] = 16; // Phương
            copiedPositions.trucKhoa['T5_2'] = 45; // Luân
            copiedPositions.trucKhoa['T6_2'] = 43; // Phú

            // Vị trí BS thứ 4 (Slot 3): Thành - Tú - Sang
            copiedPositions.trucKhoa['T2_3'] = 48; // Thành
            copiedPositions.trucKhoa['T3_3'] = 50; // Tú
            copiedPositions.trucKhoa['T4_3'] = 47; // Sang

            // Siêu âm sáng (đồng bộ với Trưởng kíp)
            copiedPositions.sieuAm = {
                'T2_0': 4, 'T3_0': 9, 'T4_0': 6, 'T5_0': 8, 'T6_0': 7
            };

            // Lịch phòng khám cố định (xóa hoàn toàn dữ liệu phòng khám từ tuần cũ để không bị ghi đè)
            copiedPositions.pkB023 = {
                'T2_0': 5, 'T2_1': 5, // BS Hậu
                'T3_0': 1, 'T3_1': 1, // BS Hữu
                'T4_0': 4, 'T4_1': 4, // BS Tuấn
                'T5_0': 2, 'T5_1': 2, // BS Khương An
                'T6_0': 6, 'T6_1': 6  // BS Nguyện
            };
            copiedPositions.pkB020 = {
                'T2_0': 7, 'T2_1': 7, // BS Vĩnh Phú
                'T3_0': 2            // BS Khương An
            };
            copiedPositions.pkK001 = {
                'T2_0': 2, 'T2_1': 9, // BS Khương An & BS Minh Đức
                'T6_0': 8, 'T6_1': 8  // BS Quy
            };

            // Mổ chính ca đầu tiên mỗi ngày (Slot 0 T2-T6): Hữu (T2, T5), Tuấn (T3), An (T4), Hậu (T6)
            if (!copiedPositions.mo) copiedPositions.mo = {};
            copiedPositions.mo['T2_0'] = 1; // Hữu
            copiedPositions.mo['T3_0'] = 4; // Tuấn
            copiedPositions.mo['T4_0'] = 2; // An
            copiedPositions.mo['T5_0'] = 1; // Hữu
            copiedPositions.mo['T6_0'] = 5; // Hậu

            // Lịch mổ Thứ 7 (T7): chừa trống vị trí đầu tiên, luân phiên Kíp 1 & Kíp 2
            const monday = new Date((weekKey || '2026-08-03') + 'T00:00:00');
            const baseMonday = new Date('2026-08-03T00:00:00');
            const diffWeeks = Math.round((monday - baseMonday) / (7 * 24 * 3600 * 1000));
            const isKip1 = (Math.abs(diffWeeks) % 2 === 0);

            // Clear previous T7 slots
            Object.keys(copiedPositions.mo).forEach(k => {
                if (k.startsWith('T7_')) delete copiedPositions.mo[k];
            });

            if (isKip1) {
                copiedPositions.mo['T7_1'] = 46; // Khôi
                copiedPositions.mo['T7_2'] = 45; // Luân
                copiedPositions.mo['T7_3'] = 48; // Thành
            } else {
                copiedPositions.mo['T7_1'] = 44; // Kiệt
                copiedPositions.mo['T7_2'] = 43; // Phú
                copiedPositions.mo['T7_3'] = 47; // Sang
            }
        }

        const saved = await this._upsertSchedule(weekKey, dates, { positions: copiedPositions, notes: copiedNotes, robotSurgery: copiedRobot });
        if (!saved?.ok) {
            return Toast.error(saved?.errors?.[0]?.message || 'Chưa sao chép được lịch tuần.');
        }

        // Re-render to show copied data
        App.renderCurrentPage();
        Toast.success('Đã sao chép lịch tuần trước thành công!', 'Sao chép lịch');
    },

    afterRender() {
        // Reset name cache (staff may have changed)
        this._shortNameCache = null;
        // Mark selects that have values
        document.querySelectorAll('.schedule-select').forEach(sel => {
            if (sel.value) sel.classList.add('has-value');
        });
    },

    // ===== PDF EXPORT =====
    async exportPDF() {
        const btn = document.getElementById('export-pdf-btn');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang xuất...'; }

        // Temporarily disable confirm/alert to prevent html2canvas triggering dialogs
        const origConfirm = window.confirm;
        const origAlert = window.alert;
        window.confirm = () => false;

        try {
            const dates = this.getWeekDates(this.weekOffset);
            const weekKey = this.getWeekKey(dates);
            const schedule = this.getScheduleData(weekKey);
            const staff = Store.getAll('staff');

            // Build standalone HTML page for iframe rendering
            const tableRows = [];
            SCHEDULE_POSITIONS.forEach(pos => {
                for (let slot = 0; slot < pos.slots; slot++) {
                    let row = '<tr>';
                    if (slot === 0) {
                        row += `<td rowspan="${pos.slots}" style="border:1.5px solid #94a3b8;padding:8px 10px;background:${pos.color}15;font-weight:700;color:${pos.color};vertical-align:middle;font-size:13px">${pos.label}</td>`;
                    }
                    dates.forEach((d, dayIdx) => {
                        const dayKey = DAYS[dayIdx];
                        const cellKey = `${dayKey}_${slot}`;
                        const posData = schedule?.positions?.[pos.key];
                        const staffId = (posData && cellKey in posData) ? posData[cellKey] : (schedule ? '' : this.getDefaultCellVal(pos.key, cellKey, weekKey));
                        let name = '';
                        if (staffId) {
                            const member = staff.find(s => s.id === parseInt(staffId));
                            if (member) name = this.getShortName(member.id) || member.name.split(' ').pop();
                        }
                        const bg = dayIdx >= 5 ? '#fffbeb' : '#fff';
                        row += `<td style="border:1px solid #cbd5e1;padding:7px 8px;text-align:center;background:${bg};font-size:13px;color:#000;font-weight:600">${name}</td>`;
                    });
                    row += '</tr>';
                    tableRows.push(row);
                }
            });

            const notes = schedule?.notes || '';
            const dateRange = `${dates[0].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} – ${dates[6].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

            const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
            <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff;font-family:Arial,Helvetica,sans-serif}</style>
            </head><body>
            <div id="capture" style="padding:28px;width:1120px;background:#fff">
                <div style="text-align:center;margin-bottom:18px">
                    <h2 style="font-size:22px;color:#000;font-weight:800">LỊCH PHÂN CÔNG TUẦN</h2>
                    <p style="margin:6px 0 0;font-size:14px;color:#222;font-weight:600">Khoa Phẫu thuật Đại trực tràng — Bệnh viện Bình Dân</p>
                    <p style="margin:3px 0 0;font-size:15px;color:#000;font-weight:800">${dateRange}</p>
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead><tr>
                        <th style="border:1.5px solid #94a3b8;background:#1e293b;color:#fff;padding:10px 8px;text-align:left;width:120px;font-size:13px;font-weight:700">Vị trí</th>
                        ${dates.map((d, i) => `<th style="border:1.5px solid #94a3b8;background:${i >= 5 ? '#fef3c7' : '#e2e8f0'};padding:10px 6px;text-align:center">
                            <div style="font-weight:700;font-size:13px;color:#000">${DAY_LABELS[i]}</div>
                            <div style="color:#111;font-size:13px;font-weight:700">${d.getDate()}/${d.getMonth() + 1}</div>
                        </th>`).join('')}
                    </tr></thead>
                    <tbody>
                        ${tableRows.join('')}
                        <tr><td colspan="8" style="border:1.5px solid #94a3b8;padding:10px 12px;font-size:12px;color:#111;font-weight:500;vertical-align:top"><strong>Ghi chú:</strong><br>${notes ? notes.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>') : '—'}</td></tr>
                    </tbody>
                </table>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:11px;color:#333">
                    <span>Xuất bởi: ${Auth.getSession()?.name || Auth.getSession()?.username || 'Hệ thống'}</span>
                    <span>Xuất lúc ${new Date().toLocaleTimeString('vi-VN')} — ${new Date().toLocaleDateString('vi-VN')}</span>
                </div>
            </div></body></html>`;

            // Render in isolated iframe (prevents interaction with live DOM)
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1200px;height:3000px;border:none;opacity:0;pointer-events:none';
            document.body.appendChild(iframe);

            await new Promise((resolve) => {
                iframe.onload = resolve;
                iframe.srcdoc = fullHtml;
            });

            // Wait for fonts/styles to settle
            await new Promise(r => setTimeout(r, 500));

            const captureEl = iframe.contentDocument.getElementById('capture');
            await Utils.loadScript('html2canvas');
            const EXPORT_SCALE = Math.max(Math.ceil(2560 / 1400), 2); // ≥ 2800px (2K) cho template ~1400px
            const canvas = await html2canvas(captureEl, {
                scale: EXPORT_SCALE,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                letterRendering: true,
                allowTaint: false,
                imageTimeout: 15000,
                windowHeight: captureEl.scrollHeight + 100
            });

            document.body.removeChild(iframe);

            // Add watermark to schedule canvas
            this._addWatermark(canvas);

            // Helper: download image via server
            const downloadImage = async (canvasEl, fname) => {
                const dataUrl = canvasEl.toDataURL('image/png');
                const dlHeaders = { 'Content-Type': 'application/json' };
                const dlToken = (typeof Auth !== 'undefined') ? Auth.getToken() : null;
                if (dlToken) dlHeaders['Authorization'] = 'Bearer ' + dlToken;
                const resp = await fetch('/api/download-image', {
                    method: 'POST',
                    headers: dlHeaders,
                    body: JSON.stringify({ image: dataUrl, filename: fname })
                });
                if (resp.ok) {
                    const blob = await resp.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fname;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    await new Promise(r => setTimeout(r, 500));
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } else {
                    throw new Error('Server download failed: ' + resp.status);
                }
            };

            // Build filenames
            const pad = n => String(n).padStart(2, '0');
            const d0 = dates[0], d6 = dates[6];
            const startFmt = `${pad(d0.getDate())}-${pad(d0.getMonth() + 1)}`;
            const endFmt = `${pad(d6.getDate())}-${pad(d6.getMonth() + 1)}-${d6.getFullYear()}`;

            // 1) Download schedule image
            const scheduleFilename = `Phan_cong_tuan_${startFmt}_${endFmt}.png`;
            await downloadImage(canvas, scheduleFilename);

            // 2) Build & download robot surgery image
            const robotEntries = schedule?.robotSurgery || [];
            if (robotEntries.length > 0) {
                const robotRows = robotEntries.map(entry => {
                    const dayDate = new Date(entry.day);
                    const dayIdx = dates.findIndex(d => SchedulePage._localDateStr(d) === entry.day);
                    const dayLabel = dayIdx >= 0 ? DAY_LABELS[dayIdx] : '';
                    const dayNum = dayDate.getDate();
                    const dayMonth = dayDate.getMonth() + 1;
                    const docs = [0, 1, 2].map(slot => {
                        if (entry.doctors?.[slot]) {
                            const member = staff.find(s => s.id === parseInt(entry.doctors[slot]));
                            return member ? (this.getShortName(member.id) || member.name.split(' ').pop()) : '—';
                        }
                        return '—';
                    });
                    return `<tr>
                        <td style="border:1px solid #cbd5e1;padding:8px 12px;font-size:12px;color:#334155">${dayLabel}, ${dayNum}/${dayMonth}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px 12px;font-size:12px;color:#334155;text-align:center">Ca ${entry.session}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px 12px;font-size:12px;color:#334155;text-align:center">${docs[0]}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px 12px;font-size:12px;color:#334155;text-align:center">${docs[1]}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px 12px;font-size:12px;color:#334155;text-align:center">${docs[2]}</td>
                    </tr>`;
                }).join('');

                const robotHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
                <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff;font-family:Arial,Helvetica,sans-serif}</style>
                </head><body>
                <div id="capture" style="padding:28px;width:800px;background:#fff">
                    <div style="text-align:center;margin-bottom:18px">
                        <h2 style="font-size:20px;color:#1e293b">🤖 LỊCH PHỤ MỔ ROBOT</h2>
                        <p style="margin:6px 0 0;font-size:14px;color:#64748b">Khoa Phẫu thuật Đại trực tràng — Bệnh viện Bình Dân</p>
                        <p style="margin:3px 0 0;font-size:14px;color:#334155;font-weight:600">${dateRange}</p>
                    </div>
                    <table style="width:100%;border-collapse:collapse;font-size:12px">
                        <thead><tr>
                            <th style="border:1.5px solid #94a3b8;background:#1e293b;color:#fff;padding:10px 12px;text-align:left">Ngày mổ</th>
                            <th style="border:1.5px solid #94a3b8;background:#1e293b;color:#fff;padding:10px 8px;text-align:center;width:70px">Ca</th>
                            <th style="border:1.5px solid #94a3b8;background:#e2e8f0;padding:10px 8px;text-align:center">BS phụ 1</th>
                            <th style="border:1.5px solid #94a3b8;background:#e2e8f0;padding:10px 8px;text-align:center">BS phụ 2</th>
                            <th style="border:1.5px solid #94a3b8;background:#e2e8f0;padding:10px 8px;text-align:center">BS phụ 3</th>
                        </tr></thead>
                        <tbody>${robotRows}</tbody>
                    </table>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:10px;color:#94a3b8">
                        <span>Xuất bởi: ${Auth.getSession()?.name || Auth.getSession()?.username || 'Hệ thống'}</span>
                        <span>Xuất lúc ${new Date().toLocaleTimeString('vi-VN')} — ${new Date().toLocaleDateString('vi-VN')}</span>
                    </div>
                </div></body></html>`;

                const iframe2 = document.createElement('iframe');
                iframe2.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:900px;height:1500px;border:none;opacity:0;pointer-events:none';
                document.body.appendChild(iframe2);
                await new Promise(resolve => { iframe2.onload = resolve; iframe2.srcdoc = robotHtml; });
                await new Promise(r => setTimeout(r, 500));

                const ROBOT_SCALE = Math.max(Math.ceil(2560 / 800), 4); // ≥ 3200px (2K+) cho robot template 800px
                const robotCanvas = await html2canvas(iframe2.contentDocument.getElementById('capture'), {
                    scale: ROBOT_SCALE,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    letterRendering: true,
                    allowTaint: false,
                    imageTimeout: 15000,
                    windowHeight: iframe2.contentDocument.getElementById('capture').scrollHeight + 100
                });
                document.body.removeChild(iframe2);

                // Add watermark to robot surgery canvas
                this._addWatermark(robotCanvas);

                const robotFilename = `Lich_mo_robot_${startFmt}_${endFmt}.png`;
                await downloadImage(robotCanvas, robotFilename);
            }

        } catch (err) {
            console.error('Export error:', err);
            window.alert = origAlert;
            Toast.error('Lỗi khi xuất ảnh. Vui lòng thử lại.');
        } finally {
            window.confirm = origConfirm;
            window.alert = origAlert;
            if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg> Xuất ảnh`; }
        }
    },

    // Add watermark to any canvas (used for schedule + robot surgery exports)
    _addWatermark(canvas) {
        Utils.applyExportWatermark(canvas);
    }
};
