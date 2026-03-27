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
            `<span class="st-legend-item"><span class="st-legend-dot" style="background:${this._statusColor(k)}"></span>${v.label}</span>`
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
            const cells = dates.map(d => {
                const ds = this._localDateStr(d);
                const isToday = ds === today;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const status = this.getStatusForDay(s.id, ds);
                const statusInfo = STAFF_STATUSES[status] || STAFF_STATUSES.active;
                const clickHandler = isAdmin ? `onclick="StaffTrackingPage.openDayStatus(${s.id},'${ds}','${s.name}')"` : '';
                return `<td class="st-cell ${isToday ? 'st-today' : ''} ${isWeekend ? 'st-weekend' : ''} ${status !== 'active' ? 'st-absent' : ''}" ${clickHandler} title="${s.name} — ${statusInfo.label}">
                    <span class="st-status-icon">${statusInfo.icon}</span>
                </td>`;
            }).join('');

            return `<tr>
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

        // Role filters (same as staff page)
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
        <div class="staff-filters" style="margin-bottom:12px">${filterBtns}</div>

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
        const map = { active: '#22c55e', leave: '#eab308', sick: '#ef4444', business: '#a855f7', dayoff: '#3b82f6' };
        return map[status] || '#22c55e';
    },

    _periodSummary(staff, dates) {
        // Count absent days per status type across the period
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
                    <select class="form-select" name="status" style="font-size:15px;padding:10px">
                        ${options}
                    </select>
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

        let entries = this.getAllEntries();
        const idx = entries.findIndex(e => e.staffId === staffId && e.date === dateStr);

        if (status === 'active') {
            // Remove the entry if exists — active is default
            if (idx !== -1) entries.splice(idx, 1);
        } else {
            const entry = { staffId, date: dateStr, status, note };
            if (idx !== -1) {
                entries[idx] = entry;
            } else {
                entries.push(entry);
            }
        }

        Store._data.staffStatuses = entries;
        Store.save();
        Modal.close();
        App.renderCurrentPage();
    },

    afterRender() {}
};
