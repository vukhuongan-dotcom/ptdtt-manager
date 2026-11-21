// ===== STAFF TRACKING PAGE =====
const StaffTrackingPage = {
    viewMode: 'week', // 'week' | 'month'
    offset: 0,
    currentFilter: 'all',
    mobileViewMode: 'day', // 'day' | 'grid' (Mobile <= 768px)
    selectedMobileDate: null,
    onlyAbsent: false,
    searchQuery: '',
    mobileSearchOpen: false,

    _localDateStr(d) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    },

    _parseLocalDate(dateStr) {
        const parts = String(dateStr || '').split('-').map(Number);
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
            return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        return new Date();
    },

    _stripVn(str) {
        return String(str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D')
            .toLowerCase();
    },

    _esc(str) {
        if (typeof Utils !== 'undefined' && typeof Utils.escapeHtml === 'function') {
            return Utils.escapeHtml(String(str ?? ''));
        }
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
    _renderTodaySummary(allStaff, isAdmin = false) {
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
        const pct = allStaff.length > 0 ? Math.round((present / allStaff.length) * 100) : 100;
        const isLow = pct < 80;

        const absentCards = absent.length ? absent.map(a => {
            const editAttrs = isAdmin
                ? `role="button" tabindex="0" onclick="StaffTrackingPage.openDayStatus(${a.id},'${today}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();StaffTrackingPage.openDayStatus(${a.id},'${today}');}" title="Chạm để sửa trạng thái hôm nay"`
                : '';
            return `
            <div class="st-absent-item ${isAdmin ? 'st-absent-item-editable' : ''}" data-st-absent-id="${a.id}" ${editAttrs} style="background:${this._statusColor(a.status)}12;border:1px solid ${this._statusColor(a.status)}30">
                ${Utils.renderAvatar(a, 'sm', { extraClass: 'st-staff-avatar st-absent-avatar-wrapper' })}
                <div class="st-absent-info">
                    <div class="st-absent-name">${this._esc(a.name)}</div>
                    <div class="st-absent-role">${this._esc(a.role)}</div>
                </div>
                <span style="font-size:0.72rem;padding:2px 6px;border-radius:4px;background:${this._statusColor(a.status)};color:#fff;white-space:nowrap">${a.statusInfo.icon} ${a.statusInfo.label}${isAdmin ? ' ✏️' : ''}</span>
            </div>`;
        }).join('') : '<span class="td-muted">✅ Tất cả nhân viên có mặt</span>';

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

    _getWeekMeta(allStaff, today) {
        const weekDates = this.getWeekDates(this.offset);
        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const ws = weekDates[0];
        const we = weekDates[6];
        const weekLabel = `${ws.getDate()}/${ws.getMonth()+1} — ${we.getDate()}/${we.getMonth()+1}/${we.getFullYear()}`;

        const validDates = weekDates.map(d => this._localDateStr(d));
        let selectedDate = this.selectedMobileDate;
        if (!selectedDate || !validDates.includes(selectedDate)) {
            selectedDate = validDates.includes(today) ? today : validDates[0];
            this.selectedMobileDate = selectedDate;
        }
        return { weekDates, dayNames, weekLabel, selectedDate };
    },

    _getMobileFilteredStaff(allStaff, selectedDate) {
        let list = this._getFilteredStaff(allStaff);
        const q = this._stripVn((this.searchQuery || '').trim());
        if (q) {
            list = list.filter(s => {
                const hay = this._stripVn(`${s.title || ''} ${s.name || ''} ${s.role || ''}`);
                return hay.includes(q);
            });
        }
        if (this.onlyAbsent && selectedDate) {
            list = list.filter(s => this.getStatusForDay(s.id, selectedDate) !== 'active');
        }
        return list;
    },

    _renderMobileCardsHtml(allStaff, selectedDate, isAdmin) {
        const filtered = this._getMobileFilteredStaff(allStaff, selectedDate);
        if (!filtered.length) {
            const msg = this.onlyAbsent
                ? '✅ Không có nhân viên vắng trong ngày đang chọn.'
                : '🔍 Không tìm thấy nhân viên phù hợp từ khóa/bộ lọc.';
            return `<div class="st-mcard-empty">${msg}</div>`;
        }

        return filtered.map(s => {
            const status = this.getStatusForDay(s.id, selectedDate);
            const info = STAFF_STATUSES[status] || STAFF_STATUSES.active;
            const statusText = status === 'active' ? 'Có mặt' : info.label;
            const note = this._getNoteForDay(s.id, selectedDate);
            const fullName = `${s.title ? s.title + ' ' : ''}${s.name}`;
            const adminAttrs = isAdmin
                ? `role="button" tabindex="0" onclick="StaffTrackingPage.openDayStatus(${s.id},'${selectedDate}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();StaffTrackingPage.openDayStatus(${s.id},'${selectedDate}');}" title="Chạm để cập nhật trạng thái"`
                : '';
            return `
            <div class="st-mcard st-mcard-${status} ${isAdmin ? 'is-editable' : ''}" data-st-staff-id="${s.id}" ${adminAttrs}>
                <div class="st-mcard-left">
                    ${Utils.renderAvatar(s, 'sm', { extraClass: 'st-mcard-avatar' })}
                    <div class="st-mcard-info">
                        <div class="st-mcard-name">${this._esc(fullName)}</div>
                        <div class="st-mcard-role">${this._esc(s.role)}</div>
                        ${note ? `<div class="st-mcard-note">📝 ${this._esc(note)}</div>` : ''}
                    </div>
                </div>
                <div class="st-mcard-right">
                    <span class="st-mcard-badge st-mcard-badge-${status}">${info.icon} ${statusText}</span>
                    ${isAdmin ? '<span class="st-mcard-edit-hint" aria-hidden="true">Sửa ›</span>' : ''}
                </div>
            </div>`;
        }).join('');
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
                        ${Utils.renderAvatar(s, 'sm', { extraClass: 'st-staff-avatar' })}
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
            `<button type="button" class="filter-btn ${this.currentFilter===r.key?'active':''}" onclick="StaffTrackingPage.setFilter('${r.key}')">${r.label} (${getCatCount(r.key)})</button>`
        ).join('');

        const presentToday = allStaff.filter(s => this.getStatusForDay(s.id, today) === 'active').length;
        const { weekDates, dayNames: weekDayNames, weekLabel, selectedDate } = this._getWeekMeta(allStaff, today);
        const dayPillsHtml = weekDates.map(d => {
            const ds = this._localDateStr(d);
            const isTodayPill = ds === today;
            const isActivePill = ds === selectedDate;
            const absentCount = allStaff.filter(s => this.getStatusForDay(s.id, ds) !== 'active').length;
            return `
            <button type="button" class="st-day-pill ${isTodayPill ? 'is-today' : ''} ${isActivePill ? 'is-active' : ''}" data-st-date="${ds}" onclick="StaffTrackingPage.selectMobileDate('${ds}')">
                <span class="st-day-pill-name">${weekDayNames[d.getDay()]}</span>
                <span class="st-day-pill-date">${d.getDate()}/${d.getMonth()+1}</span>
                <span class="st-day-pill-badge ${absentCount > 0 ? 'has-absent' : ''}">${absentCount > 0 ? `${absentCount} vắng` : '✔'}</span>
            </button>`;
        }).join('');

        const mobileFilterStrip = `
            <div class="st-mobile-filter-strip" role="region" aria-label="Bộ lọc nhanh nhân sự">
                ${filterBtns}
                <button type="button" class="filter-btn st-only-absent-btn ${this.onlyAbsent ? 'active' : ''}" data-st-only-absent="1" onclick="StaffTrackingPage.toggleOnlyAbsent()">🔴 Chỉ xem người vắng</button>
            </div>`;

        const mobileSearchBar = (this.mobileSearchOpen || this.searchQuery) ? `
            <div class="st-mobile-search-bar">
                <input type="search" id="st-mobile-search-input" class="form-input st-mobile-search-input" value="${this._esc(this.searchQuery)}" placeholder="Tìm theo tên hoặc chức danh..." aria-label="Tìm nhân viên" oninput="StaffTrackingPage.setSearchQuery(this.value)">
                <button type="button" id="st-mobile-search-clear" class="btn btn-secondary btn-sm st-mobile-search-clear" onclick="StaffTrackingPage.clearSearchQuery()" ${this.searchQuery ? '' : 'hidden'}>Xóa</button>
            </div>` : '';

        return `
        <div id="staff-tracking-page" class="st-page" data-mobile-view="${this.mobileViewMode}">
        <div class="page-header">
            <div class="st-header-title-wrap">
                <h1 class="page-title">Theo dõi nhân viên <span class="st-hdr-ratio-pill">${presentToday}/${allStaff.length}</span></h1>
                <p class="page-subtitle">Trạng thái nhân viên theo ${this.viewMode === 'week' ? 'tuần' : 'tháng'}</p>
            </div>
            <div class="st-mobile-hdr-tools">
                <button type="button" class="st-mobile-icon-btn ${this.mobileSearchOpen || this.searchQuery ? 'is-active' : ''}" data-st-action="toggle-search" onclick="StaffTrackingPage.toggleMobileSearch()" aria-label="Tìm kiếm nhân viên" title="Tìm kiếm">${this.mobileSearchOpen ? '✕' : '🔍'}</button>
                <button type="button" class="st-mobile-icon-btn ${this.onlyAbsent ? 'is-active' : ''}" data-st-action="toggle-absent-hdr" onclick="StaffTrackingPage.toggleOnlyAbsent()" aria-label="Chỉ xem người vắng" title="Chỉ xem người vắng">🔴</button>
            </div>
        </div>

        <div class="st-mobile-mode-bar" role="tablist" aria-label="Chế độ xem di động">
            <button type="button" class="st-mobile-mode-btn ${this.mobileViewMode === 'day' ? 'is-active' : ''}" role="tab" aria-selected="${this.mobileViewMode === 'day' ? 'true' : 'false'}" data-st-mode="day" onclick="StaffTrackingPage.setMobileView('day')">📅 Theo ngày</button>
            <button type="button" class="st-mobile-mode-btn ${this.mobileViewMode === 'grid' ? 'is-active' : ''}" role="tab" aria-selected="${this.mobileViewMode === 'grid' ? 'true' : 'false'}" data-st-mode="grid" onclick="StaffTrackingPage.setMobileView('grid')">📋 Lưới tuần/tháng</button>
        </div>

        ${this._renderTodaySummary(allStaff, isAdmin)}

        <div class="st-mobile-day-view">
            <div class="st-mobile-week-bar">
                <button type="button" class="btn-icon st-mobile-week-nav" onclick="StaffTrackingPage.prev()" aria-label="Tuần trước" title="Tuần trước">${Utils.chevronLeft()}</button>
                <span class="st-mobile-week-label">${weekLabel}</span>
                <button type="button" class="btn-icon st-mobile-week-nav" onclick="StaffTrackingPage.next()" aria-label="Tuần sau" title="Tuần sau">${Utils.chevronRight()}</button>
                <button type="button" class="btn btn-secondary btn-sm st-mobile-today-btn" onclick="StaffTrackingPage.goToday()">Hôm nay</button>
            </div>
            <div class="st-day-strip" role="listbox" aria-label="Chọn ngày trong tuần">${dayPillsHtml}</div>
            ${mobileFilterStrip}
            ${mobileSearchBar}
            <div id="st-mobile-cards-container" class="st-mcard-list">
                ${this._renderMobileCardsHtml(allStaff, selectedDate, isAdmin)}
            </div>
        </div>

        <div class="st-controls">
            <div class="st-view-tabs">
                <button class="st-tab ${this.viewMode === 'week' ? 'active' : ''}" onclick="StaffTrackingPage.setView('week')">📅 Tuần</button>
                <button class="st-tab ${this.viewMode === 'month' ? 'active' : ''}" onclick="StaffTrackingPage.setView('month')">🗓 Tháng</button>
            </div>
            <div class="calendar-nav">
                <button class="btn-icon" onclick="StaffTrackingPage.prev()" aria-label="Kỳ trước" title="Kỳ trước">${Utils.chevronLeft()}</button>
                <span class="calendar-month-label">${periodLabel}</span>
                <button class="btn-icon" onclick="StaffTrackingPage.next()" aria-label="Kỳ sau" title="Kỳ sau">${Utils.chevronRight()}</button>
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
        this.selectedMobileDate = null;
        App.renderCurrentPage();
    },

    setMobileView(mode) {
        this.mobileViewMode = mode === 'grid' ? 'grid' : 'day';
        const page = document.getElementById('staff-tracking-page');
        if (page) {
            page.setAttribute('data-mobile-view', this.mobileViewMode);
            document.querySelectorAll('.st-mobile-mode-btn').forEach(btn => {
                const active = btn.getAttribute('data-st-mode') === this.mobileViewMode;
                btn.classList.toggle('is-active', active);
                btn.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            return;
        }
        App.renderCurrentPage();
    },

    selectMobileDate(dateStr) {
        this.selectedMobileDate = dateStr;
        App.renderCurrentPage();
    },

    toggleOnlyAbsent() {
        this.onlyAbsent = !this.onlyAbsent;
        App.renderCurrentPage();
    },

    toggleMobileSearch() {
        this.mobileSearchOpen = !this.mobileSearchOpen;
        if (!this.mobileSearchOpen) {
            this.searchQuery = '';
        }
        App.renderCurrentPage();
        if (this.mobileSearchOpen) {
            setTimeout(() => {
                const inp = document.getElementById('st-mobile-search-input');
                if (inp) inp.focus();
            }, 30);
        }
    },

    setSearchQuery(val) {
        this.searchQuery = val || '';
        const clearBtn = document.getElementById('st-mobile-search-clear');
        if (clearBtn) clearBtn.hidden = !this.searchQuery;
        const container = document.getElementById('st-mobile-cards-container');
        if (container) {
            const allStaff = Store.getAll('staff');
            const today = this._localDateStr(new Date());
            const isAdmin = !!(Auth.getSession()?.isAdmin);
            const { selectedDate } = this._getWeekMeta(allStaff, today);
            container.innerHTML = this._renderMobileCardsHtml(allStaff, selectedDate, isAdmin);
            return;
        }
        App.renderCurrentPage();
    },

    clearSearchQuery() {
        this.searchQuery = '';
        App.renderCurrentPage();
        setTimeout(() => {
            const inp = document.getElementById('st-mobile-search-input');
            if (inp) inp.focus();
        }, 30);
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

    prev() { this.offset--; this.selectedMobileDate = null; App.renderCurrentPage(); },
    next() { this.offset++; this.selectedMobileDate = null; App.renderCurrentPage(); },
    goToday() { this.offset = 0; this.selectedMobileDate = this._localDateStr(new Date()); App.renderCurrentPage(); },

    openDayStatus(staffId, dateStr, staffName) {
        const staffObj = Store.getById('staff', staffId);
        const resolvedName = staffName || (staffObj ? `${staffObj.title ? staffObj.title + ' ' : ''}${staffObj.name}` : 'Nhân viên');
        const currentStatus = this.getStatusForDay(staffId, dateStr);
        const parts = dateStr.split('-');
        const dateLabel = `${parts[2]}/${parts[1]}/${parts[0]}`;

        Modal.open(`${this._esc(resolvedName)} — ${dateLabel}`, `
            <form id="st-day-status-form" onsubmit="StaffTrackingPage.saveDayStatus(event, ${staffId}, '${dateStr}')">
                <input type="hidden" name="status" id="tracking-status-input" value="${currentStatus}">
                
                <label class="form-label" style="margin-bottom:8px">Chọn trạng thái nhanh</label>
                <div class="st-quick-status-selector">
                    ${Object.entries(STAFF_STATUSES).map(([key, val]) => {
                        const displayLabel = key === 'active' ? 'Có mặt' : val.label;
                        return `
                        <button type="button" class="st-quick-status-btn ${currentStatus === key ? 'active' : ''} st-btn-${key}" 
                                data-st-status-btn="${key}"
                                onclick="StaffTrackingPage._selectQuickStatus('${key}')">
                            <span class="st-status-icon">${val.icon}</span>
                            <span class="st-status-text">${displayLabel}</span>
                        </button>`;
                    }).join('')}
                </div>

                <div id="tracking-range-fields" style="${currentStatus !== 'active' ? '' : 'display:none'};margin-top:14px">
                    <label class="form-label" style="margin-bottom:6px">Khoảng thời gian nhanh</label>
                    <div class="st-range-chips">
                        <button type="button" class="st-range-chip is-active" data-st-range="1d" onclick="StaffTrackingPage._applyQuickRange('1d', '${dateStr}')">Chỉ ngày này</button>
                        <button type="button" class="st-range-chip" data-st-range="2d" onclick="StaffTrackingPage._applyQuickRange('2d', '${dateStr}')">2 ngày</button>
                        <button type="button" class="st-range-chip" data-st-range="3d" onclick="StaffTrackingPage._applyQuickRange('3d', '${dateStr}')">3 ngày</button>
                        <button type="button" class="st-range-chip" data-st-range="week" onclick="StaffTrackingPage._applyQuickRange('week', '${dateStr}')">Hết tuần</button>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" for="tracking-from-date">Từ ngày</label>
                            <input class="form-input st-date-picker-only" type="date" name="fromDate" id="tracking-from-date" value="${dateStr}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="tracking-to-date">Đến ngày</label>
                            <input class="form-input st-date-picker-only" type="date" name="toDate" id="tracking-to-date" value="${dateStr}">
                        </div>
                    </div>
                </div>

                <div class="form-group" style="margin-top:10px">
                    <label class="form-label" for="tracking-note-input">Ghi chú (tuỳ chọn)</label>
                    <input class="form-input" id="tracking-note-input" name="note" placeholder="Lý do nghỉ, nơi công tác..." value="${this._esc(this._getNoteForDay(staffId, dateStr))}">
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">Lưu trạng thái</button>
                </div>
            </form>
        `);
        this._bindModalUX();
    },

    _applyQuickRange(mode, fallbackDate) {
        const fromInp = document.getElementById('tracking-from-date');
        const toInp = document.getElementById('tracking-to-date');
        if (!fromInp || !toInp) return;
        const startStr = fromInp.value || fallbackDate;
        if (!fromInp.value) fromInp.value = startStr;
        const d = this._parseLocalDate(startStr);
        if (mode === '2d') {
            d.setDate(d.getDate() + 1);
        } else if (mode === '3d') {
            d.setDate(d.getDate() + 2);
        } else if (mode === 'week') {
            const dow = d.getDay();
            const add = dow === 0 ? 0 : (7 - dow);
            d.setDate(d.getDate() + add);
        }
        toInp.value = this._localDateStr(d);
        document.querySelectorAll('.st-range-chip').forEach(btn => {
            btn.classList.toggle('is-active', btn.getAttribute('data-st-range') === mode);
        });
    },

    _bindModalUX() {
        const body = document.getElementById('modal-body');
        if (!body) return;
        const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
        const plat = (typeof navigator !== 'undefined' && navigator.platform) ? navigator.platform : '';
        const isIosWebKit = /iP(hone|ad|od)/.test(ua) || (plat === 'MacIntel' && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
        body.querySelectorAll('input[type="date"].st-date-picker-only').forEach(el => {
            if (el.dataset.stPickerBound === '1') return;
            el.dataset.stPickerBound = '1';
            el.addEventListener('click', () => {
                if (isIosWebKit) return;
                try {
                    if (typeof el.showPicker === 'function') el.showPicker();
                } catch (_) { /* Fallback */ }
            });
            el.addEventListener('keydown', (ev) => {
                if (ev.key === 'Tab' || ev.key === 'Escape') return;
                if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    if (!isIosWebKit) {
                        try {
                            if (typeof el.showPicker === 'function') el.showPicker();
                        } catch (_) {}
                    }
                    return;
                }
                ev.preventDefault();
            });
            el.addEventListener('change', () => {
                document.querySelectorAll('.st-range-chip').forEach(b => b.classList.remove('is-active'));
            });
        });
    },

    _selectQuickStatus(statusKey) {
        const inp = document.getElementById('tracking-status-input');
        if (inp) inp.value = statusKey;
        
        document.querySelectorAll('.st-quick-status-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.classList.contains('st-btn-' + statusKey)) {
                btn.classList.add('active');
            }
        });

        const rangeFields = document.getElementById('tracking-range-fields');
        if (rangeFields) {
            rangeFields.style.display = statusKey === 'active' ? 'none' : '';
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
            // Remove entries for the range (local calendar parsing avoids UTC day shift)
            const d = this._parseLocalDate(fromDate);
            const end = this._parseLocalDate(toDate);
            while (d <= end) {
                const ds = this._localDateStr(d);
                entries = entries.filter(e => !(e.staffId === staffId && e.date === ds));
                d.setDate(d.getDate() + 1);
            }
        } else {
            // Create/update entries for each day in range
            const d = this._parseLocalDate(fromDate);
            const end = this._parseLocalDate(toDate);
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
