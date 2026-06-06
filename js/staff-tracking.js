// ===== STAFF TRACKING PAGE =====
const StaffTrackingPage = {
    viewMode: 'week', // 'week' | 'month'
    offset: 0,
    currentFilter: 'all',

    _localDateStr(d) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    },

    // Get all per-day status entries
    getAllEntries() {
        return Store.getAll('staffStatuses') || [];
    },

    getStatusForDay(staffId, dateStr) {
        const entries = this.getAllEntries();
        const entry = entries.find(e => e.staffId === staffId && e.date === dateStr);
        if (entry) return entry.status;
        // Fallback: check staff object date range
        const s = Store.getById('staff', staffId);
        if (s && s.statusType && s.statusType !== 'active' && s.statusFrom && s.statusTo) {
            if (dateStr >= s.statusFrom && dateStr <= s.statusTo) return s.statusType;
        }
        return 'active';
    },

    // ===== DATE HELPERS =====
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

    getMonthDates(offset) {
        const now = new Date();
        const targetMonth = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        const year = targetMonth.getFullYear();
        const month = targetMonth.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const dates = [];
        for (let i = 1; i <= daysInMonth; i++) {
            dates.push(new Date(year, month, i));
        }
        return dates;
    },

    // ===== TODAY SUMMARY =====
    _renderTodaySummary(allStaff) {
        const today = this._localDateStr(new Date());
        const absent = [];
        allStaff.forEach(s => {
            const status = this.getStatusForDay(s.id, today);
            if (status !== 'active') {
                const info = STAFF_STATUSES[status] || STAFF_STATUSES.active;
                absent.push({ ...s, status, statusInfo: info });
            }
        });

        const present = allStaff.length - absent.length;
        const pct = Math.round((present / allStaff.length) * 100);
        const isLow = pct < 80;

        const absentCards = absent.length ? absent.map(a => `
            <div class="st-absent-item" style="background:${this._statusColor(a.status)}12;border:1px solid ${this._statusColor(a.status)}30">
                <div class="st-staff-avatar st-absent-avatar-wrapper" style="background:${a.color}">${Utils.getInitials(a.name)}</div>
                <div class="st-absent-info">
                    <div class="st-absent-name">${a.name}</div>
                    <div class="st-absent-role">${a.role}</div>
                </div>
                <span style="font-size:0.72rem;padding:2px 6px;border-radius:4px;background:${this._statusColor(a.status)};color:#fff;white-space:nowrap">${a.statusInfo.icon} ${a.statusInfo.label}</span>
            </div>
        `).join('') : '<span class="td-muted">✅ Tất cả nhân viên có mặt</span>';

        return `
        <div class="card st-summary-card" style="border-left:4px solid ${isLow ? '#ef4444' : '#22c55e'}">
            <div class="st-summary-header" style="margin-bottom:${absent.length ? '12px' : '0'}">
                <div>
                    <div class="st-summary-title">📊 Nhân sự hôm nay</div>
                    <div class="st-summary-date">${new Date().toLocaleDateString('vi-VN', {weekday:'long', day:'numeric', month:'numeric', year:'numeric'})}</div>
                </div>
                <div class="st-summary-ratio-right">
                    <div style="font-size:1.4rem;font-weight:800;color:${isLow ? '#ef4444' : '#22c55e'}">${present}/${allStaff.length}</div>
                    <div class="st-summary-pct">có mặt (${pct}%)</div>
                </div>
            </div>
            ${absent.length ? `
            <div class="st-absent-grid">
                ${absentCards}
            </div>
            ${isLow ? '<div class="st-warn-low">⚠️ Cảnh báo: Vắng &gt;20% nhân sự — kiểm tra nhân lực!</div>' : ''}
            ` : ''}
        </div>`;
    },

    // ===== RENDER =====
    render() {
        const session = Auth.getSession();
        const isAdmin = session?.isAdmin;
        const allStaff = Store.getAll('staff');
        const staff = this._getFilteredStaff(allStaff);
        const today = this._localDateStr(new Date());

        const dates = this.viewMode === 'week'
            ? this.getWeekDates(this.offset)
            : this.getMonthDates(this.offset);

        const dayNames = ['CN','T2','T3','T4','T5','T6','T7'];

        // Period label
        let periodLabel = '';
        if (this.viewMode === 'week') {
            const s = dates[0], e = dates[6];
            periodLabel = `${s.getDate()}/${s.getMonth()+1} — ${e.getDate()}/${e.getMonth()+1}/${e.getFullYear()}`;
        } else {
            const d = dates[0];
            periodLabel = `Tháng ${d.getMonth()+1}/${d.getFullYear()}`;
        }

        // Status legend
        const legend = Object.entries(STAFF_STATUSES).map(([k,v]) =>
            `<span class="st-legend-item"><span class="st-legend-chip st-chip-${k}">${v.abbr || '✔'}</span>${v.label}</span>`
        ).join('');

        // Summary counts for this period
        const summary = this._periodSummary(staff, dates);

        // Table headers
        const headers = dates.map(d => {
            const ds = this._localDateStr(d);
            const isToday = ds === today;
            const dayName = dayNames[d.getDay()];
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return `<th class="st-day-header ${isToday ? 'st-today' : ''} ${isWeekend ? 'st-weekend' : ''}">
                <div class="st-day-name">${dayName}</div>
                <div class="st-day-num">${d.getDate()}</div>
            </th>`;
        }).join('');

        // Table rows
        const rows = staff.map(s => {
            const todayStatus = this.getStatusForDay(s.id, today);
            const isAbsentToday = todayStatus !== 'active';
            const cells = dates.map(d => {
                const ds = this._localDateStr(d);
                const isToday = ds === today;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const status = this.getStatusForDay(s.id, ds);
                const statusInfo = STAFF_STATUSES[status] || STAFF_STATUSES.active;
                const clickHandler = isAdmin ? `onclick="StaffTrackingPage.openDayStatus(${s.id},'${ds}','${s.name}')"` : '';
                const abbr = statusInfo.abbr || '';
                return `<td class="st-cell st-status-${status} ${isToday ? 'st-today' : ''} ${isWeekend ? 'st-weekend' : ''}" ${clickHandler} title="${s.name} — ${statusInfo.label}">
                    <span class="st-status-label">${abbr || '✔'}</span>
                </td>`;
            }).join('');

            return `<tr${isAbsentToday ? ' class="st-absent-today"' : ''}>
                <td class="st-staff-cell">
                    <div class="st-staff-info">
                        <div class="st-staff-avatar" style="background:${s.color}">${Utils.getInitials(s.name)}</div>
                        <div>
                            <div class="st-staff-name">${s.name}</div>
                            <div class="st-staff-role">${s.role}</div>
                        </div>
                    </div>
                </td>
                ${cells}
            </tr>`;
        }).join('');

        // Role filters
        const roleDefs = [
            { key: 'all', label: 'Tất cả' },
            { key: 'BCN', label: 'BCN khoa' },
            { key: 'Bác sĩ chính', label: 'BS chính' },
            { key: 'học viên', label: 'BS học viên' },
            { key: 'Điều dưỡng', label: 'ĐD' },
            { key: 'Hộ lý', label: 'Hộ lý' },
            { key: 'Thư ký', label: 'Thư ký' }
        ];
        const getCatCount = (key) => {
            if (key === 'all') return allStaff.length;
            if (key === 'BCN') return allStaff.filter(s => s.role.includes('Trưởng khoa') || s.role.includes('Phó trưởng khoa') || s.role === 'Điều dưỡng trưởng').length;
            return allStaff.filter(s => s.role.includes(key)).length;
        };
        const filterBtns = roleDefs.map(r =>
            `<button class="filter-btn ${this.currentFilter===r.key?'active':''}" onclick="StaffTrackingPage.setFilter('${r.key}')">${r.label} (${getCatCount(r.key)})</button>`
        ).join('');

        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Theo dõi nhân viên</h1>
                <p class="page-subtitle">Trạng thái nhân viên theo ${this.viewMode === 'week' ? 'tuần' : 'tháng'}</p>
            </div>
        </div>

        ${this._renderTodaySummary(allStaff)}

        <div class="st-controls">
            <div class="st-view-tabs">
                <button class="st-tab ${this.viewMode === 'week' ? 'active' : ''}" onclick="StaffTrackingPage.setView('week')">📅 Tuần</button>
                <button class="st-tab ${this.viewMode === 'month' ? 'active' : ''}" onclick="StaffTrackingPage.setView('month')">🗓 Tháng</button>
            </div>
            <div class="calendar-nav">
                <button class="btn-icon" onclick="StaffTrackingPage.prev()">${Utils.chevronLeft()}</button>
                <span class="calendar-month-label">${periodLabel}</span>
                <button class="btn-icon" onclick="StaffTrackingPage.next()">${Utils.chevronRight()}</button>
                <button class="btn btn-secondary btn-sm" onclick="StaffTrackingPage.goToday()">${this.viewMode === 'week' ? 'Tuần này' : 'Tháng này'}</button>
            </div>
            <div class="st-legend">${legend}</div>
        </div>

        <!-- Filters -->
        <div class="staff-filters st-filter-bar">${filterBtns}</div>

        <!-- Summary -->
        <div class="st-summary">${summary}</div>

        <!-- Grid -->
        <div class="card st-grid-card">
            <div class="st-table-wrapper">
                <table class="st-table">
                    <thead>
                        <tr>
                            <th class="st-staff-header">Nhân viên</th>
                            ${headers}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
        `;
    },

    _statusColor(status) {
        const map = { active: '#16a34a', leave: '#ca8a04', sick: '#dc2626', business: '#7c3aed', dayoff: '#2563eb' };
        return map[status] || '#16a34a';
    },

    _periodSummary(staff, dates) {
        const counts = {};
        Object.keys(STAFF_STATUSES).forEach(k => { counts[k] = 0; });
        let totalAbsent = 0;

        staff.forEach(s => {
            dates.forEach(d => {
                const ds = this._localDateStr(d);
                const status = this.getStatusForDay(s.id, ds);
                if (status !== 'active') {
                    counts[status] = (counts[status] || 0) + 1;
                    totalAbsent++;
                }
            });
        });

        const chips = Object.entries(STAFF_STATUSES)
            .filter(([k]) => k !== 'active' && counts[k] > 0)
            .map(([k, v]) => `<span class="st-summary-chip" style="background:${this._statusColor(k)}20;color:${this._statusColor(k)};border:1px solid ${this._statusColor(k)}40">${v.icon} ${v.label}: ${counts[k]} lượt</span>`)
            .join('');

        return totalAbsent > 0
            ? `<div class="st-summary-row">${chips}</div>`
            : '<div class="st-summary-row"><span style="color:var(--text-muted)">✅ Tất cả nhân viên hoạt động bình thường trong kỳ này</span></div>';
    },

    // ===== ACTIONS =====
    setView(mode) {
        this.viewMode = mode;
        this.offset = 0;
        App.renderCurrentPage();
    },

    setFilter(key) {
        this.currentFilter = key;
        App.renderCurrentPage();
    },

    _getFilteredStaff(allStaff) {
        const f = this.currentFilter;
        if (f === 'all') return allStaff;
        if (f === 'BCN') return allStaff.filter(s => s.role.includes('Trưởng khoa') || s.role.includes('Phó trưởng khoa') || s.role === 'Điều dưỡng trưởng');
        return allStaff.filter(s => s.role.includes(f));
    },

    prev() { this.offset--; App.renderCurrentPage(); },
    next() { this.offset++; App.renderCurrentPage(); },
    goToday() { this.offset = 0; App.renderCurrentPage(); },

    openDayStatus(staffId, dateStr, staffName) {
        const currentStatus = this.getStatusForDay(staffId, dateStr);
        const parts = dateStr.split('-');
        const dateLabel = `${parts[2]}/${parts[1]}/${parts[0]}`;

        const options = Object.entries(STAFF_STATUSES).map(([key, val]) =>
            `<option value="${key}" ${currentStatus === key ? 'selected' : ''}>${val.icon} ${val.label}</option>`
        ).join('');

        Modal.open(`${staffName} — ${dateLabel}`, `
            <form onsubmit="StaffTrackingPage.saveDayStatus(event, ${staffId}, '${dateStr}')">
                <div class="form-group">
                    <label class="form-label">Trạng thái</label>
                    <select class="form-select" name="status" style="font-size:15px;padding:10px" onchange="StaffTrackingPage._toggleRangeFields()">
                        ${options}
                    </select>
                </div>
                <div id="tracking-range-fields" style="${currentStatus !== 'active' ? '' : 'display:none'}">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Từ ngày</label>
                            <input class="form-input" type="date" name="fromDate" value="${dateStr}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Đến ngày</label>
                            <input class="form-input" type="date" name="toDate" value="${dateStr}">
                        </div>
                    </div>
                    <div style="font-size:0.72rem;color:var(--text-muted);margin-top:-4px;margin-bottom:8px">
                        💡 Để khoảng ngày giống nhau nếu chỉ cập nhật 1 ngày
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Ghi chú</label>
                    <input class="form-input" name="note" placeholder="Lý do..." value="${this._getNoteForDay(staffId, dateStr)}">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">Lưu</button>
                </div>
            </form>
        `);
    },

    _toggleRangeFields() {
        const sel = document.querySelector('select[name="status"]');
        const fields = document.getElementById('tracking-range-fields');
        if (sel && fields) {
            fields.style.display = sel.value === 'active' ? 'none' : '';
        }
    },

    _getNoteForDay(staffId, dateStr) {
        const entries = this.getAllEntries();
        const entry = entries.find(e => e.staffId === staffId && e.date === dateStr);
        return entry?.note || '';
    },

    saveDayStatus(e, staffId, dateStr) {
        e.preventDefault();
        const f = new FormData(e.target);
        const status = f.get('status');
        const note = f.get('note') || '';
        const fromDate = f.get('fromDate') || dateStr;
        const toDate = f.get('toDate') || dateStr;
        const today = this._localDateStr(new Date());

        if (!fromDate || !toDate || fromDate > toDate) {
            Toast.warning('Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc');
            return;
        }

        let entries = [...this.getAllEntries()];

        if (status === 'active') {
            // Remove entries for the range
            const d = new Date(fromDate);
            const end = new Date(toDate);
            while (d <= end) {
                const ds = this._localDateStr(d);
                entries = entries.filter(e => !(e.staffId === staffId && e.date === ds));
                d.setDate(d.getDate() + 1);
            }
        } else {
            // Create/update entries for each day in range
            const d = new Date(fromDate);
            const end = new Date(toDate);
            while (d <= end) {
                const ds = this._localDateStr(d);
                const idx = entries.findIndex(e => e.staffId === staffId && e.date === ds);
                const entry = { staffId, date: ds, status, note };
                if (idx !== -1) {
                    entries[idx] = entry;
                } else {
                    entries.push(entry);
                }
                d.setDate(d.getDate() + 1);
            }
        }

        Store.replaceCollection('staffStatuses', entries);
        Store.syncStaffLegacyStatus(staffId, today);
        Store.saveCollections(['staffStatuses', 'staff']);
        Modal.close();
        App.renderCurrentPage();
        Toast.success('Đã cập nhật tình trạng nhân viên');
    },

    afterRender() {}
};
