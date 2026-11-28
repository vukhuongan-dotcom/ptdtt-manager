// ===== SURGERY SCHEDULE PAGE =====
const SURGERY_TYPES = {
    'chuongtrinh': {
        label: 'Chương trình',
        get color() { return Utils.cssVar('--stype-chuongtrinh') || '#1878B4'; },
        get onColor() { return Utils.cssVar('--stype-chuongtrinh-on') || '#FFFFFF'; }
    },
    'yeucau': {
        label: 'Yêu cầu',
        get color() { return Utils.cssVar('--stype-yeucau') || '#FFC107'; },
        get onColor() { return Utils.cssVar('--stype-yeucau-on') || '#111542'; }
    },
    'bankhan': {
        label: 'Bán khẩn',
        get color() { return Utils.cssVar('--stype-bankhan') || '#AC011A'; },
        get onColor() { return Utils.cssVar('--stype-bankhan-on') || '#FFFFFF'; }
    },
    'robot': {
        label: 'Robot',
        get color() { return Utils.cssVar('--stype-robot') || '#333C83'; },
        get onColor() { return Utils.cssVar('--stype-robot-on') || '#FFFFFF'; }
    }
};

// Priority doctor per day of week (getDay(): 0=Sun, 1=Mon...6=Sat)
// staffId: 1=Hữu, 2=An, 4=Tuấn, 5=Hậu(Bùi Hồng Minh Hậu)
const PRIORITY_DOCTOR_BY_DAY = {
    1: 1,  // Thứ 2: BS Hữu
    2: 4,  // Thứ 3: BS Tuấn
    3: 2,  // Thứ 4: BS An
    4: 1,  // Thứ 5: BS Hữu
    5: 5,  // Thứ 6: BS Hậu
};

const _typePriority = { robot: 0, bankhan: 1, chuongtrinh: 2, yeucau: 3 };

// Sort surgeries:
// 1. By surgery type priority: robot > bankhan > chuongtrinh > yeucau
// 2. Within same type: group cases of the same doctor together
//    - Doctor order: has "Ca đầu tiên" (isFirstCase) > priority doctor of the day (PRIORITY_DOCTOR_BY_DAY) > max duration (desc) > total duration (desc) > doctor ID
//    - Within each doctor: isFirstCase first > duration (desc)
function sortSurgeries(surgeries, date) {
    if (!Array.isArray(surgeries) || surgeries.length === 0) return [];

    let dayOfWeek;
    if (date instanceof Date) {
        dayOfWeek = date.getDay();
    } else if (typeof date === 'string' && date.includes('-')) {
        const parts = date.split('T')[0].split('-');
        dayOfWeek = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getDay();
    } else {
        dayOfWeek = new Date(date).getDay();
    }

    const priorityDocId = PRIORITY_DOCTOR_BY_DAY[dayOfWeek] || null;

    // 1. Group surgeries by surgeryType
    const typeGroups = {};
    for (const s of surgeries) {
        const t = s.surgeryType || 'chuongtrinh';
        if (!typeGroups[t]) typeGroups[t] = [];
        typeGroups[t].push(s);
    }

    const sortedTypes = Object.keys(typeGroups).sort((a, b) => {
        return (_typePriority[a] ?? 9) - (_typePriority[b] ?? 9);
    });

    const result = [];

    for (const type of sortedTypes) {
        const typeSurgeries = typeGroups[type];

        // 2. Group by doctor (mainSurgeon)
        const docGroups = new Map();
        for (const s of typeSurgeries) {
            const docId = s.mainSurgeon || 0;
            if (!docGroups.has(docId)) docGroups.set(docId, []);
            docGroups.get(docId).push(s);
        }

        // Sort each doctor's cases: isFirstCase first, then duration desc
        for (const [docId, cases] of docGroups.entries()) {
            cases.sort((a, b) => {
                const aFirst = a.isFirstCase ? 0 : 1;
                const bFirst = b.isFirstCase ? 0 : 1;
                if (aFirst !== bFirst) return aFirst - bFirst;
                const aDur = parseInt(a.duration, 10) || 0;
                const bDur = parseInt(b.duration, 10) || 0;
                if (bDur !== aDur) return bDur - aDur;
                return (a.id || 0) - (b.id || 0);
            });
        }

        // 3. Order doctor groups
        const sortedDocs = [...docGroups.keys()].sort((docA, docB) => {
            // Unassigned doctor (0) always goes last
            if (!docA && docB) return 1;
            if (docA && !docB) return -1;

            const casesA = docGroups.get(docA);
            const casesB = docGroups.get(docB);

            // A doctor with "Ca đầu tiên" (isFirstCase) goes first
            const aHasFirst = casesA.some(c => c.isFirstCase) ? 0 : 1;
            const bHasFirst = casesB.some(c => c.isFirstCase) ? 0 : 1;
            if (aHasFirst !== bHasFirst) return aHasFirst - bHasFirst;

            // Priority doctor of the day (BS chính kíp mổ ngày đó theo ghi nhớ)
            if (priorityDocId) {
                const aIsPriority = docA === priorityDocId ? 0 : 1;
                const bIsPriority = docB === priorityDocId ? 0 : 1;
                if (aIsPriority !== bIsPriority) return aIsPriority - bIsPriority;
            }

            // Doctor with longest single surgery first
            const aMaxDur = Math.max(...casesA.map(c => parseInt(c.duration, 10) || 0));
            const bMaxDur = Math.max(...casesB.map(c => parseInt(c.duration, 10) || 0));
            if (bMaxDur !== aMaxDur) return bMaxDur - aMaxDur;

            // Doctor with larger total duration
            const aTotalDur = casesA.reduce((sum, c) => sum + (parseInt(c.duration, 10) || 0), 0);
            const bTotalDur = casesB.reduce((sum, c) => sum + (parseInt(c.duration, 10) || 0), 0);
            if (bTotalDur !== aTotalDur) return bTotalDur - aTotalDur;

            return (parseInt(docA, 10) || 0) - (parseInt(docB, 10) || 0);
        });

        // 4. Flatten doctor cases into result
        for (const docId of sortedDocs) {
            result.push(...docGroups.get(docId));
        }
    }

    surgeries.length = 0;
    surgeries.push(...result);
    return surgeries;
}

// Check if a week is locked (more than 7 days since Monday of that week)
// Only super admin can edit locked weeks
function isWeekLocked(weekMondayStr) {
    if (!weekMondayStr) return false;
    const monday = new Date(weekMondayStr + 'T00:00:00');
    const now = new Date();
    const daysSince = (now - monday) / (1000 * 60 * 60 * 24);
    return daysSince > 7;
}

// Check if current user can edit surgery schedule for a given week
function canEditSurgery(weekMondayStr) {
    const session = Auth.getSession();
    if (!session) return false;
    // Super admin can always edit
    if (session.isSuperAdmin) return true;
    // Check week lock
    if (weekMondayStr && isWeekLocked(weekMondayStr)) return false;
    // Admin or doctor can edit current/future weeks
    if (session.isAdmin) return true;
    const role = session.role || '';
    return role.includes('Bác sĩ') || role.includes('Trưởng khoa') || role.includes('Phó trưởng khoa');
}

const SURGERY_APPROACH_META = {
    mo:     { label: 'Mổ mở',   color: '#A90042', onColor: '#FFFFFF' },
    noisoi: { label: 'Nội soi', color: '#34A357', onColor: '#111542' },
    nsth:   { label: 'NSTH',    color: '#7C4CD5', onColor: '#FFFFFF' },
    robot:  { label: 'Robot',   color: '#333C83', onColor: '#FFFFFF' }
};

const SURGERY_FALLBACK_ATTENDING_COLUMNS = {
    1:  { name: 'TS. BSCKII. Nguyễn Phú Hữu', open: 'DB',  lap: 'DB',  robot: true },
    2:  { name: 'BSCKII. Vũ Khương An',       open: 'DB',  lap: 'DB',  robot: false },
    4:  { name: 'BSCKI. Nguyễn Vũ Tuấn',      open: 'DB',  lap: 'I',   robot: false },
    5:  { name: 'ThS. BS. Phan Văn Sử',       open: 'I',   lap: 'I',   robot: false },
    6:  { name: 'ThS. BS. Lê Chí Nguyện',     open: 'I',   lap: 'I',   robot: false },
    7:  { name: 'ThS. BS. Võ Nguyên Trung',   open: 'I',   lap: 'II',  robot: false },
    8:  { name: 'ThS. BS. Nguyễn Thanh Quy',  open: 'I',   lap: 'II',  robot: false },
    9:  { name: 'ThS. BS. Nguyễn Ngọc Phú',   open: 'II',  lap: 'II',  robot: false },
    10: { name: 'BS. Trần Minh Đức',          open: 'III', lap: 'III', robot: false },
    11: { name: 'BS. Nguyễn Quốc Hoan',       open: 'III', lap: 'III', robot: false },
    12: { name: 'ThS. BS. Nguyễn Minh Đức',   open: 'III', lap: 'III', robot: false }
};

const SurgeryPage = {
    currentWeekStart: null,
    _filterDoctor: 'all',
    _filterType: 'all',
    _selectedDayStr: null,
    _mobileViewMode: 'day', // 'day' | 'week'
    _mobileQuickFilter: 'all', // 'all' | 'mine' | 'robot' | 'yeucau'
    _showSandboxOnSchedule: false,
    _openApprovalAfterSave: false,
    _addNextAfterSave: false,
    _pendingDvktConfirmed: false,
    _dvktDialogMatches: [],
    _dvktDialogContext: null,
    _dvktEscHandler: null,
    _sampleSandboxIdx: 0,
    _allExpanded: false,
    _expandedCardIds: new Set(),
    _procedureCatalogCache: null,
    _procedureCatalogPromise: null,
    _acState: { diagnosis: { items: [], activeIdx: -1 }, method: { items: [], activeIdx: -1 } },
    _docPickerTabs: { mainSurgeon: 'khoa', assistSurgeon1: 'khoa' },
    _docPickerQueries: { mainSurgeon: '', assistSurgeon1: '' },
    _formAssistExpanded: false,

    canUseSandboxSchedule() {
        if (typeof SurgeryApprovalPage === 'undefined') return false;
        return Boolean(SurgeryApprovalPage.canAccessSandboxCases && SurgeryApprovalPage.canAccessSandboxCases());
    },

    toggleSandboxSchedulePreview() {
        this._showSandboxOnSchedule = !this._showSandboxOnSchedule;
        App.renderCurrentPage();
    },

    init() {
        const today = new Date();
        const day = today.getDay();
        this.currentWeekStart = new Date(today);
        this.currentWeekStart.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
        this.currentWeekStart.setHours(0, 0, 0, 0);
    },

    _jumpToDate(isoDateStr) {
        if (!isoDateStr || typeof isoDateStr !== 'string') return;
        const parts = isoDateStr.split('T')[0].split('-');
        if (parts.length !== 3) return;
        const target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (isNaN(target.getTime())) return;
        const day = target.getDay();
        this.currentWeekStart = new Date(target);
        this.currentWeekStart.setDate(target.getDate() - (day === 0 ? 6 : day - 1));
        this.currentWeekStart.setHours(0, 0, 0, 0);
        this._selectedDayStr = isoDateStr.split('T')[0];
        if (typeof App !== 'undefined' && App.renderCurrentPage) {
            App.renderCurrentPage();
        }
    },

    getWeekDates() {
        if (!this.currentWeekStart) this.init();
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(this.currentWeekStart);
            d.setDate(this.currentWeekStart.getDate() + i);
            return d;
        });
    },

    getWeekKey() {
        if (!this.currentWeekStart) this.init();
        const d = this.currentWeekStart;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    dateStr(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    fmtDate(d) {
        const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        return `${days[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
    },

    getSurgeries() {
        const all = this.getAllSurgeries();
        const weekDates = this.getWeekDates().map(d => this.dateStr(d));
        const allowSandboxPreview = Boolean(this._showSandboxOnSchedule && this.canUseSandboxSchedule());
        return all.filter(s => weekDates.includes(s.date) && (!s.isTestSandboxCase || allowSandboxPreview));
    },

    getFilteredSurgeries(dateStr = null) {
        let list = this.getSurgeries();
        if (dateStr) {
            list = list.filter(s => s.date === dateStr);
        }
        if (this._filterDoctor && this._filterDoctor !== 'all') {
            const docId = parseInt(this._filterDoctor);
            list = list.filter(s => s.mainSurgeon === docId);
        }
        if (this._filterType && this._filterType !== 'all') {
            list = list.filter(s => s.surgeryType === this._filterType);
        }
        return list;
    },

    getAllSurgeries() {
        // Migration: move old localStorage data into Store (one-time)
        const legacy = localStorage.getItem('ptdtt_surgeries');
        if (legacy) {
            const items = JSON.parse(legacy);
            if (items.length > 0 && (!Store._data.surgeries || Store._data.surgeries.length === 0)) {
                Store._data.surgeries = items;
                Store.saveCollections(['surgeries']);
            }
            localStorage.removeItem('ptdtt_surgeries');
        }
        return Store._data.surgeries || [];
    },

    saveSurgeries(all) {
        Store._data.surgeries = all;
        return Store.saveCollections(['surgeries']);
    },

    setDoctorFilter(docId) {
        this._filterDoctor = docId;
        App.renderCurrentPage();
    },

    setTypeFilter(typeKey) {
        this._filterType = typeKey;
        App.renderCurrentPage();
    },

    selectDay(dateStr) {
        this._selectedDayStr = dateStr;
        App.renderCurrentPage();
    },

    setMobileViewMode(mode) {
        this._mobileViewMode = mode;
        App.renderCurrentPage();
    },

    setMobileQuickFilter(q) {
        this._mobileQuickFilter = q || 'all';
        App.renderCurrentPage();
    },

    render() {
        if (!this.currentWeekStart) this.init();
        const weekKey = this.getWeekKey();
        const locked = isWeekLocked(weekKey);
        const canEdit = canEditSurgery(weekKey);
        const weekDates = this.getWeekDates();
        const surgeries = this.getSurgeries();
        const filteredSurgeries = this.getFilteredSurgeries();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = this.dateStr(today);

        // Determine selected day for mobile day-view
        if (!this._selectedDayStr || !weekDates.map(d => this.dateStr(d)).includes(this._selectedDayStr)) {
            const hasToday = weekDates.some(d => this.dateStr(d) === todayStr);
            this._selectedDayStr = hasToday ? todayStr : this.dateStr(weekDates[0]);
        }
        const selectedDayStr = this._selectedDayStr;

        const weekLabel = `${weekDates[0].getDate()}/${weekDates[0].getMonth() + 1} — ${weekDates[6].getDate()}/${weekDates[6].getMonth() + 1}/${weekDates[6].getFullYear()}`;

        // Stats (using filtered collection)
        const totalCases = filteredSurgeries.length;
        const totalUnfiltered = surgeries.length;
        const todayCases = filteredSurgeries.filter(s => s.date === todayStr).length;

        // Doctors for filter dropdown
        const allStaff = Store.getAll('staff') || [];
        const doctors = allStaff.filter(s => (s.role || '').toLowerCase().includes('bác sĩ') || (s.role || '').toLowerCase().includes('trưởng khoa') || (s.role || '').toLowerCase().includes('phó trưởng khoa'));
        const showApproval = typeof SurgeryApprovalPage !== 'undefined' && SurgeryApprovalPage.isFeatureVisibleForCurrentUser();

        return `
        <div id="surgery-page" class="surg-page">
        <div class="surgery-sticky-header">
        <div class="page-header">
            <div>
                <h1 class="page-title">Lịch mổ tuần</h1>
                <p class="page-subtitle">Lịch phẫu thuật khoa PT Đại trực tràng</p>
            </div>
            <div class="surg-header-actions">
                ${showApproval ? `<button class="btn btn-secondary" onclick="App.navigate('surgery-approval')" aria-label="Mở Tab Duyệt mổ tại khoa">
                    <span aria-hidden="true">📋</span> Duyệt mổ khoa
                </button>` : ''}
                ${(this.canUseSandboxSchedule() && (Store._data?.surgeries || []).some(s => s.isTestSandboxCase)) ? `
                <button type="button" id="surg-toggle-sandbox-preview" class="btn btn-secondary"
                    onclick="SurgeryPage.toggleSandboxSchedulePreview()">
                    <span aria-hidden="true">${this._showSandboxOnSchedule ? '🙈' : '🧪'}</span> ${this._showSandboxOnSchedule ? 'Ẩn ca [TEST]' : 'Xem ca [TEST]'}
                </button>` : ''}
                ${(canEdit && this.canUseSandboxSchedule()) ? `
                <button type="button" id="surg-create-sandbox-btn" class="btn btn-secondary"
                    style="border-color:#d97706;color:#b45309;background:rgba(245,158,11,0.1);font-weight:600;"
                    onclick="SurgeryPage.openForm(0, null, { sandbox: true })"
                    aria-label="Tạo ca giả lập từ lịch mổ để thực hành quy trình duyệt mổ">
                    <span aria-hidden="true">🧪</span> Tạo ca giả lập
                </button>` : ''}
                <button class="btn btn-secondary" onclick="SurgeryPage.openTrashModal()" title="Thùng rác ca mổ đã hủy (Tự động xóa vĩnh viễn sau 7 ngày)" aria-label="Thùng rác ca mổ đã hủy">
                    🗑️ Thùng rác ${Store.cleanSurgeriesTrash(7).length > 0 ? `<span class="badge badge-danger" style="background:#ef4444;color:#fff;font-size:0.75rem;padding:2px 6px;border-radius:10px;margin-left:4px;">${Store.cleanSurgeriesTrash(7).length}</span>` : ''}
                </button>
                <button class="btn btn-secondary" onclick="SurgeryPage.exportTomorrowImage()" aria-label="Xuất danh sách ca mổ ngày mai">
                    📷 Xuất DS ngày mai
                </button>
                <button class="btn btn-secondary" onclick="SurgeryPage.exportCustomDateImage()" aria-label="Xuất danh sách ca mổ theo ngày">
                    📅 Xuất theo ngày
                </button>
                ${canEdit ? `<button class="btn btn-primary" onclick="SurgeryPage.openForm()" aria-label="Thêm ca phẫu thuật mới">
                    ${Utils.plusIcon()} Thêm ca mổ
                </button>` : ''}
            </div>
            <div class="surg-mobile-hdr-tools">
                ${canEdit ? `<button type="button" class="surg-mobile-primary-btn" onclick="SurgeryPage.openForm(null, '${selectedDayStr}')" aria-label="Thêm ca phẫu thuật mới">＋ Thêm ca</button>` : ''}
                <button type="button" class="surg-mobile-more-btn" id="surg-mobile-more-btn" onclick="SurgeryPage.openMobileToolsSheet()" aria-label="Tiện ích lịch mổ tuần" title="Tiện ích">⋮</button>
            </div>
        </div>

        ${locked ? `<div class="surg-locked-banner">
            🔒 <strong>Tuần này đã bị khoá</strong> — Dữ liệu lịch mổ sau 1 tuần không thể chỉnh sửa. Chỉ Super Admin mới có thể mở khoá.
        </div>` : ''}

        <div class="surgery-controls">
            <div class="calendar-nav">
                <button class="btn-icon" onclick="SurgeryPage.prevWeek()" aria-label="Xem lịch mổ tuần trước">${Utils.chevronLeft()}</button>
                <span class="calendar-month-label">${weekLabel}</span>
                <button class="btn-icon" onclick="SurgeryPage.nextWeek()" aria-label="Xem lịch mổ tuần sau">${Utils.chevronRight()}</button>
                <button class="btn btn-secondary btn-sm" onclick="SurgeryPage.thisWeek()" aria-label="Xem lịch mổ tuần này">Tuần này</button>
            </div>
            <div class="surgery-filters-bar">
                <div class="surgery-filter-group">
                    <label class="surgery-filter-label" for="surg-filter-doc">🔍 BS mổ chính:</label>
                    <select id="surg-filter-doc" class="form-select form-select-sm surgery-filter-select" onchange="SurgeryPage.setDoctorFilter(this.value)" aria-label="Lọc theo bác sĩ mổ chính">
                        <option value="all" ${this._filterDoctor === 'all' ? 'selected' : ''}>Tất cả bác sĩ</option>
                        ${doctors.map(d => `<option value="${d.id}" ${String(this._filterDoctor) === String(d.id) ? 'selected' : ''}>${d.name}</option>`).join('')}
                    </select>
                </div>
                <div class="surgery-filter-group">
                    <label class="surgery-filter-label" for="surg-filter-type">🏷️ Loại mổ:</label>
                    <select id="surg-filter-type" class="form-select form-select-sm surgery-filter-select" onchange="SurgeryPage.setTypeFilter(this.value)" aria-label="Lọc theo loại phẫu thuật">
                        <option value="all" ${this._filterType === 'all' ? 'selected' : ''}>Tất cả loại mổ</option>
                        ${Object.entries(SURGERY_TYPES).map(([k, t]) => `<option value="${k}" ${this._filterType === k ? 'selected' : ''}>${t.label}</option>`).join('')}
                    </select>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="SurgeryPage.toggleAllCards()" id="surgery-toggle-btn" title="Thu gọn / Mở rộng tất cả" aria-label="Thu gọn hoặc mở rộng tất cả thẻ ca mổ">
                    <span id="surgery-toggle-icon">${this._allExpanded ? '📁' : '📂'}</span> <span id="surgery-toggle-text">${this._allExpanded ? 'Thu gọn' : 'Mở rộng'}</span>
                </button>
            </div>
        </div>

        <!-- MOBILE DAY PICKER BAR -->
        <div class="surgery-mobile-day-picker">
            <div class="surgery-mobile-view-toggle">
                <button type="button" class="surg-view-btn ${this._mobileViewMode === 'day' ? 'active' : ''}" onclick="SurgeryPage.setMobileViewMode('day')">
                    📱 Xem theo ngày
                </button>
                <button type="button" class="surg-view-btn ${this._mobileViewMode === 'week' ? 'active' : ''}" onclick="SurgeryPage.setMobileViewMode('week')">
                    📊 Xem bảng tuần
                </button>
            </div>
            <div class="surgery-day-pills-row">
                ${weekDates.map(d => {
                    const ds = this.dateStr(d);
                    const isSelected = ds === selectedDayStr;
                    const isToday = ds === todayStr;
                    const daySurgeries = this.getFilteredSurgeries(ds);
                    const dayName = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];
                    return `
                    <button type="button" class="surgery-day-pill ${isSelected ? 'active' : ''} ${isToday ? 'today' : ''}" onclick="SurgeryPage.selectDay('${ds}')" aria-label="${dayName} ${d.getDate()}/${d.getMonth()+1}, ${daySurgeries.length} ca">
                        <span class="surg-pill-name">${dayName}</span>
                        <span class="surg-pill-date">${d.getDate()}/${d.getMonth()+1}</span>
                        <span class="surg-pill-badge ${daySurgeries.length > 0 ? 'has-cases' : ''}">${daySurgeries.length}</span>
                    </button>`;
                }).join('')}
            </div>
            <div class="surg-mobile-quick-filters" role="group" aria-label="Lọc nhanh ca mổ">
                ${[
                    { key: 'all', label: 'Tất cả' },
                    { key: 'mine', label: '👤 Ca của tôi' },
                    { key: 'robot', label: '🤖 Robot' },
                    { key: 'yeucau', label: '⭐ Yêu cầu' }
                ].map(q => `<button type="button" class="surg-qfilter-pill ${this._mobileQuickFilter === q.key ? 'active' : ''}" data-surg-qfilter="${q.key}" onclick="SurgeryPage.setMobileQuickFilter('${q.key}')">${q.label}</button>`).join('')}
            </div>
        </div>

        <div class="surgery-summary-panel">
            <div class="surgery-summary-chips">
                ${Object.entries(SURGERY_TYPES).map(([key, t]) => {
                    const cnt = filteredSurgeries.filter(s => s.surgeryType === key).length;
                    return `<div class="surgery-summary-chip">
                                <span class="surgery-summary-dot" style="background:${t.color}"></span>
                                <span class="surgery-summary-label">${t.label}</span>
                                <span class="surgery-summary-count">${cnt}</span>
                            </div>`;
                }).join('')}
                ${[
                    { key: 'mo', label: 'Mổ mở', color: Utils.cssVar('--surgery-mo') || '#A90042' },
                    { key: 'noisoi', label: 'Nội soi', color: Utils.cssVar('--surgery-noisoi') || '#34A357' },
                    { key: 'nsth', label: 'NSTH', color: Utils.cssVar('--surgery-nsth') || '#7C4CD5' },
                    { key: 'robot', label: 'Robot', color: Utils.cssVar('--surgery-robot') || '#333C83' }
                ].map(a => {
                    const cnt = filteredSurgeries.filter(s => s.approachType === a.key).length;
                    return `<div class="surgery-summary-chip">
                                <span class="surgery-summary-dot" style="background:${a.color}"></span>
                                <span class="surgery-summary-label">${a.label}</span>
                                <span class="surgery-summary-count">${cnt}</span>
                            </div>`;
                }).join('')}
                <div class="surgery-summary-chip surgery-summary-total">
                    <span class="surgery-summary-label"><strong>${this._filterDoctor !== 'all' || this._filterType !== 'all' ? 'Tổng đã lọc' : 'Tổng tuần'}</strong></span>
                    <span class="surgery-summary-count"><strong>${totalCases}</strong>${(this._filterDoctor !== 'all' || this._filterType !== 'all') ? `<span style="font-size:0.7rem;font-weight:400;opacity:0.75;margin-left:3px;">/${totalUnfiltered}</span>` : ''}</span>
                </div>
            </div>
        </div>
        </div><!-- end .surgery-sticky-header -->

        <!-- MOBILE DAY FOCUS VIEW (Active when _mobileViewMode === 'day' on mobile) -->
        <div class="surgery-mobile-day-view ${this._mobileViewMode === 'day' ? 'active' : ''}">
            ${(() => {
                const selDateObj = weekDates.find(d => this.dateStr(d) === selectedDayStr) || weekDates[0];
                const sessionStaffId = Number(Auth.getSession()?.staffId || 0);
                const rawDaySurgeries = sortSurgeries(this.getFilteredSurgeries(selectedDayStr), selDateObj);
                const daySurgeries = rawDaySurgeries.filter(s => {
                    if (this._mobileQuickFilter === 'mine') {
                        if (!sessionStaffId) return false;
                        return [s.mainSurgeon, s.assistSurgeon1, s.assistSurgeon2, s.assistSurgeon3].some(id => Number(id) === sessionStaffId);
                    }
                    if (this._mobileQuickFilter === 'robot') {
                        return s.surgeryType === 'robot' || s.approachType === 'robot' || Boolean(s.robotCaseId);
                    }
                    if (this._mobileQuickFilter === 'yeucau') {
                        return s.surgeryType === 'yeucau';
                    }
                    return true;
                });
                const dayNameLong = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][selDateObj.getDay()];
                return `
                <div class="surg-day-focus-card card">
                    <div class="surg-day-focus-header">
                        <div>
                            <div class="surg-day-focus-title">📅 ${dayNameLong} — ${selDateObj.getDate()}/${selDateObj.getMonth() + 1}/${selDateObj.getFullYear()}</div>
                            <div class="surg-day-focus-subtitle">${daySurgeries.length} ca phẫu thuật ${this._mobileQuickFilter !== 'all' ? `(lọc từ ${rawDaySurgeries.length} ca)` : (this._filterDoctor !== 'all' ? '(đã lọc theo BS)' : '')}</div>
                        </div>
                        ${canEdit ? `<button class="btn btn-primary btn-sm" onclick="SurgeryPage.openForm(null,'${selectedDayStr}')">+ Thêm ca</button>` : ''}
                    </div>
                    <div class="surg-day-focus-list">
                        ${daySurgeries.length ? daySurgeries.map((s, idx) => {
                            const typeInfo = SURGERY_TYPES[s.surgeryType] || SURGERY_TYPES.chuongtrinh;
                            const showCaseApproval = showApproval && SurgeryApprovalPage.isCaseApprovalEnabled(s);
                            const mainDocName = Utils.getStaffName(s.mainSurgeon);
                            const assistName = s.assistSurgeon1 ? Utils.getStaffName(s.assistSurgeon1) : '';
                            const clinicalText = [s.diagnosis, s.method].filter(Boolean).join(' · ');
                            return `
                            <div class="surgery-card surgery-expanded surg-mobile-full-card" data-surgery-id="${s.id}" role="button" tabindex="0" onclick="SurgeryPage.viewDetail(${s.id})">
                                <div class="surg-mc-top">
                                    <div class="surg-mc-top-left">
                                        <span class="surgery-card-order">${idx + 1}</span>
                                        <span class="surgery-card-type-tag" style="background:${typeInfo.color};color:${typeInfo.onColor}">${typeInfo.label}</span>
                                        ${SurgeryPage._renderPatientWeeklyBadge(s, surgeries)}
                                    </div>
                                    ${showCaseApproval ? `<div class="surg-mc-top-right">${s.isTestSandboxCase ? '<span class="sap-tag sap-tag--sandbox">TEST</span> ' : ''}${SurgeryApprovalPage.renderScheduleBadge(s)}</div>` : ''}
                                </div>
                                <div class="surg-mc-mid">
                                    <div class="surg-mc-patient">${Utils.toProperCase(s.patientName)} <span class="surgery-card-yob">${s.birthYear ? `(${s.birthYear})` : ''}</span></div>
                                    ${clinicalText ? `<div class="surg-mc-clinical">${Utils.escapeHtml(clinicalText)}</div>` : ''}
                                </div>
                                <div class="surg-mc-bottom">
                                    <div class="surg-mc-surgeon">🔪 <strong>${mainDocName}</strong>${assistName ? ` · Phụ: ${assistName}` : ''}${s.duration ? ` · ⏱ ${s.duration}p` : ''}</div>
                                    <button type="button" class="surg-card-more-btn" data-surg-more="${s.id}" onclick="event.stopPropagation();SurgeryPage.openMobileCardSheet(${s.id})" aria-label="Thao tác ca mổ ${Utils.escapeHtml(s.patientName || '')}">⋮</button>
                                </div>
                            </div>`;
                        }).join('') : `<div class="surgery-empty">Không có ca mổ phù hợp trong ngày này</div>`}
                    </div>
                </div>`;
            })()}
        </div>

        <div class="surgery-scroll-zone ${this._mobileViewMode === 'day' ? 'mobile-hidden' : ''}">
        <div class="surgery-week-grid">
            ${weekDates.map(d => {
            const ds = this.dateStr(d);
            const isToday = d.getTime() === today.getTime();
            const daySurgeries = sortSurgeries(this.getFilteredSurgeries(ds), d);

            return `
                <div class="surgery-day ${isToday ? 'today' : ''} ${d.getDay() === 0 || d.getDay() === 6 ? 'weekend' : ''}">
                    <div class="surgery-day-header">
                        <span class="surgery-day-name">${this.fmtDate(d)}</span>
                        <span class="surgery-day-count">${daySurgeries.length} ca</span>
                    </div>
                    <div class="surgery-day-body">
                        ${daySurgeries.length ? daySurgeries.map((s, idx) => {
                const typeInfo = SURGERY_TYPES[s.surgeryType] || SURGERY_TYPES.chuongtrinh;
                const approachLabel = (s.surgeryType === 'robot' && s.approachType === 'robot')
                    ? ''
                    : (({ mo: 'Mổ mở', noisoi: 'Nội soi', nsth: 'NSTH', robot: 'Robot' })[s.approachType] || '');
                const showCaseApproval = showApproval && SurgeryApprovalPage.isCaseApprovalEnabled(s);
                const isCardExpanded = Boolean(this._allExpanded || (this._expandedCardIds && this._expandedCardIds.has(String(s.id))));
                return `
                            <div class="surgery-card ${isCardExpanded ? 'surgery-expanded' : 'surgery-compact'}" data-surgery-id="${s.id}" onclick="SurgeryPage.toggleCard(this, event)">
                                <div class="surgery-card-compact-row">
                                    <span class="surgery-card-order">${idx + 1}</span>
                                    <span class="surgery-type-dot" style="background:${typeInfo.color}" title="${typeInfo.label}"></span>
                                    <span class="surgery-card-compact-name">${Utils.toProperCase(s.patientName)}</span>
                                    <span class="surgery-card-yob">${s.birthYear ? `(${s.birthYear})` : ''}</span>
                                    ${SurgeryPage._renderPatientWeeklyBadge(s, surgeries)}
                                </div>
                                ${s.robotCaseId ? (() => {
                                    const isNsSync = (s.robotSyncMeta && s.robotSyncMeta.scheduledApproach === 'noisoi') || s.approachType === 'noisoi';
                                    const isXvWait = s.robotSyncMeta && s.robotSyncMeta.inpatientState === 'xuat_vien_cho';
                                    const rd = (s.robotSyncMeta && s.robotSyncMeta.plannedReadmitDate) ? `${s.robotSyncMeta.plannedReadmitDate.slice(8, 10)}/${s.robotSyncMeta.plannedReadmitDate.slice(5, 7)}` : '';
                                    return `<div><button type="button" class="rbt-weekly-link-badge" onclick="event.stopPropagation();RobotSchedulePage.openFromWeeklySchedule('${Utils.escapeHtml(s.robotCaseId)}')" title="Mở hồ sơ Điều phối Robot liên kết">${isNsSync ? '🔬 ĐP Nội soi' : '🤖 Điều phối Robot'} (${Utils.escapeHtml(s.robotCaseId)})</button>${isXvWait ? ` <span class="rbt-badge rbt-badge--amber">🏠 XV chờ${rd ? ` · Nhập ${rd}` : ''}</span>` : ''}</div>`;
                                })() : ''}
                                ${showCaseApproval ? `<div class="surgery-card-compact-approval">${s.isTestSandboxCase ? '<span class="sap-tag sap-tag--sandbox">TEST</span> ' : ''}${SurgeryApprovalPage.renderScheduleBadge(s)}</div>` : ''}
                                <div class="surgery-card-detail">
                                    <div class="surgery-card-meta-row">
                                        <span class="surgery-card-type-tag" style="background:${typeInfo.color};color:${typeInfo.onColor}">${typeInfo.label}</span>
                                        ${approachLabel ? `<span class="surgery-card-approach-tag">${approachLabel}</span>` : ''}
                                    </div>
                                    ${s.duration ? `<div class="surg-card-duration">⏱ ${s.duration} phút</div>` : ''}
                                    ${s.diagnosis ? `<div class="surgery-card-diagnosis">📋 ${Utils.escapeHtml(s.diagnosis)}</div>` : ''}
                                    ${s.method ? `<div class="surgery-card-method">🔬 ${Utils.escapeHtml(s.method)}</div>` : ''}
                                    <div class="surgery-card-footer">
                                        <span class="surgery-card-surgeons">🔪 ${Utils.getStaffName(s.mainSurgeon)}${s.assistSurgeon1 ? ' / ' + Utils.getStaffName(s.assistSurgeon1) : ''}</span>
                                    </div>
                                    ${canEdit ? `<div class="surg-card-actions">
                                        <button class="btn btn-secondary btn-sm btn-card-action" aria-label="Sửa ca mổ của bệnh nhân ${Utils.toProperCase(s.patientName)}" onclick="event.stopPropagation();SurgeryPage.openForm(${s.id})">✏ Sửa</button>
                                        <button class="btn btn-secondary btn-sm btn-card-action" aria-label="Xem chi tiết ca mổ của bệnh nhân ${Utils.toProperCase(s.patientName)}" onclick="event.stopPropagation();SurgeryPage.viewDetail(${s.id})">🔍 Chi tiết</button>
                                        <button class="btn btn-secondary btn-sm btn-card-action-danger" aria-label="Xoá ca mổ của bệnh nhân ${Utils.toProperCase(s.patientName)}" onclick="event.stopPropagation();SurgeryPage.deleteSurgery(${s.id})">🗑 Xoá</button>
                                    </div>` : `<div class="surg-card-actions-single">
                                        <button class="btn btn-secondary btn-sm btn-card-action" aria-label="Xem chi tiết ca mổ của bệnh nhân ${Utils.toProperCase(s.patientName)}" onclick="event.stopPropagation();SurgeryPage.viewDetail(${s.id})">🔍 Chi tiết</button>
                                    </div>`}
                                </div>
                            </div>`;
            }).join('') : `<div class="surgery-empty">Không có ca mổ</div>`}
                        ${canEdit ? `<button class="surgery-add-btn" aria-label="Thêm ca mổ mới cho ngày ${this.fmtDate(d)}" onclick="SurgeryPage.openForm(null,'${ds}')">+ Thêm ca</button>` : ''}
                    </div>
                </div>`;
        }).join('')}
        </div>
        </div><!-- end .surgery-scroll-zone -->
        ${showApproval ? `<div class="sap-schedule-footer-legend" role="note">
            <strong>Chú giải (Duyệt nội bộ Khoa = Bước 01–04 toàn viện, độc lập HIS):</strong>
            <span><span aria-hidden="true">✅</span> Đã duyệt</span> ·
            <span><span aria-hidden="true">⏳</span> Chờ duyệt</span> ·
            <span><span aria-hidden="true">📝</span> Chưa trình</span> ·
            <span><span aria-hidden="true">↩️</span> Trả về</span> ·
            <span><span aria-hidden="true">⏸️</span> Tạm hoãn</span> ·
            <span><span aria-hidden="true">⚡</span> Ngoại lệ</span>
            <span class="sap-schedule-footer-hint">(Bấm vào nhãn trên thẻ để mở thẳng hồ sơ duyệt ca mổ)</span>
        </div>` : ''}
        </div>
        `;
    },

    // Navigation
    prevWeek() {
        this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
        App.renderCurrentPage();
    },
    nextWeek() {
        this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
        App.renderCurrentPage();
    },
    thisWeek() {
        this.currentWeekStart = null;
        this.init();
        App.renderCurrentPage();
    },

    // Card expand/collapse
    toggleCard(el, event) {
        event.stopPropagation();
        el.classList.toggle('surgery-compact');
        const expanded = el.classList.toggle('surgery-expanded');
        const sid = el.getAttribute('data-surgery-id');
        if (sid && this._expandedCardIds) {
            if (expanded) this._expandedCardIds.add(String(sid));
            else this._expandedCardIds.delete(String(sid));
        }
    },

    toggleAllCards() {
        const cards = document.querySelectorAll('.surgery-week-grid .surgery-card');
        const allExpanded = cards.length > 0 && [...cards].every(c => c.classList.contains('surgery-expanded'));
        this._allExpanded = !allExpanded;
        if (!this._allExpanded && this._expandedCardIds) {
            this._expandedCardIds.clear();
        }
        cards.forEach(c => {
            if (allExpanded) {
                c.classList.add('surgery-compact');
                c.classList.remove('surgery-expanded');
            } else {
                c.classList.remove('surgery-compact');
                c.classList.add('surgery-expanded');
                const sid = c.getAttribute('data-surgery-id');
                if (sid && this._expandedCardIds) this._expandedCardIds.add(String(sid));
            }
        });
        const icon = document.getElementById('surgery-toggle-icon');
        const text = document.getElementById('surgery-toggle-text');
        if (icon && text) {
            if (allExpanded) { icon.textContent = '📂'; text.textContent = 'Mở rộng'; }
            else { icon.textContent = '📁'; text.textContent = 'Thu gọn'; }
        }
    },

    // ===== STATS HELPERS =====
    getWeeklyStats() {
        const weekDates = this.getWeekDates().map(d => this.dateStr(d));
        const surgeries = this.getAllSurgeries().filter(s => !s.isTestSandboxCase && weekDates.includes(s.date));
        const stats = { total: surgeries.length };
        Object.keys(SURGERY_TYPES).forEach(k => {
            stats[k] = surgeries.filter(s => s.surgeryType === k).length;
        });
        return stats;
    },

    getDailyStats() {
        const all = this.getAllSurgeries();
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const todaySurgeries = all.filter(s => !s.isTestSandboxCase && s.date === today);
        const stats = { total: todaySurgeries.length };
        Object.keys(SURGERY_TYPES).forEach(k => {
            stats[k] = todaySurgeries.filter(s => s.surgeryType === k).length;
        });
        return stats;
    },

    getMonthlyStats() {
        const all = this.getAllSurgeries();
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();
        const monthSurgeries = all.filter(s => {
            if (s.isTestSandboxCase) return false;
            const d = new Date(s.date);
            return d.getMonth() === month && d.getFullYear() === year;
        });
        const stats = { total: monthSurgeries.length };
        Object.keys(SURGERY_TYPES).forEach(k => {
            stats[k] = monthSurgeries.filter(s => s.surgeryType === k).length;
        });
        return stats;
    },

    // View detail / edit
    viewDetail(id) {
        const all = this.getAllSurgeries();
        const s = all.find(x => String(x.id) === String(id));
        if (!s) return;
        const canEdit = canEditSurgery(s.date ? s.date.substring(0,10) : this.getWeekKey());
        const typeInfo = SURGERY_TYPES[s.surgeryType] || SURGERY_TYPES.chuongtrinh;

        Modal.open('Chi tiết ca mổ', `
            <div class="surgery-detail">
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">Bệnh nhân</div>
                    <div class="surgery-detail-value"><strong>${Utils.toProperCase(s.patientName)}</strong> — NS: ${s.birthYear || '—'}</div>
                </div>
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">Số nhập viện</div>
                    <div class="surgery-detail-value">${s.admissionId || '—'}</div>
                </div>
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">Ngày mổ</div>
                    <div class="surgery-detail-value">${Utils.formatDate(s.date)}</div>
                </div>
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">Thời gian cuộc mổ</div>
                    <div class="surgery-detail-value">${s.duration ? s.duration + ' phút' : '—'}</div>
                </div>
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">Chẩn đoán</div>
                    <div class="surgery-detail-value">${s.diagnosis || '—'}</div>
                </div>
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">Phương pháp PT</div>
                    <div class="surgery-detail-value">${s.method || '—'}</div>
                </div>
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">BS mổ chính</div>
                    <div class="surgery-detail-value">${Utils.getStaffName(s.mainSurgeon) || '—'}</div>
                </div>
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">BS phụ 1</div>
                    <div class="surgery-detail-value">${s.assistSurgeon1 ? Utils.getStaffName(s.assistSurgeon1) : '—'}</div>
                </div>
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">Loại phẫu thuật</div>
                    <div class="surgery-detail-value"><span class="surgery-type-badge" style="background:${typeInfo.color};color:${typeInfo.onColor}">${typeInfo.label}</span></div>
                </div>
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">Đường mổ</div>
                    <div class="surgery-detail-value">${({ mo: 'Mổ mở', noisoi: 'Nội soi', nsth: 'Nội soi tiêu hoá', robot: 'Robot' })[s.approachType] || '—'}</div>
                </div>
                ${s.robotCaseId ? (() => {
                    const isNsSync = (s.robotSyncMeta && s.robotSyncMeta.scheduledApproach === 'noisoi') || s.approachType === 'noisoi';
                    const isXvWait = s.robotSyncMeta && s.robotSyncMeta.inpatientState === 'xuat_vien_cho';
                    const rd = (s.robotSyncMeta && s.robotSyncMeta.plannedReadmitDate) ? `${s.robotSyncMeta.plannedReadmitDate.slice(8, 10)}/${s.robotSyncMeta.plannedReadmitDate.slice(5, 7)}` : '';
                    return `<div class="surgery-detail-row">
                    <div class="surgery-detail-label">Điều phối Robot / Nội soi</div>
                    <div class="surgery-detail-value"><button type="button" class="rbt-weekly-link-badge" onclick="Modal.close();RobotSchedulePage.openFromWeeklySchedule('${Utils.escapeHtml(s.robotCaseId)}')">${isNsSync ? '🔬 ĐP Nội soi' : '🤖'} ${Utils.escapeHtml(s.robotCaseId)}${s.robotSyncMeta?.caseSlot ? ` · ${Utils.escapeHtml(s.robotSyncMeta.caseSlot)}` : ''}</button>${isXvWait ? ` <span class="rbt-badge rbt-badge--amber">🏠 XV chờ${rd ? ` · Nhập ${rd}` : ''}</span>` : ''}</div>
                </div>`;
                })() : ''}
                ${(typeof SurgeryApprovalPage !== 'undefined' && SurgeryApprovalPage.isCaseApprovalEnabled(s)) ? `<div class="surgery-detail-row">
                    <div class="surgery-detail-label">Duyệt mổ tại khoa</div>
                    <div class="surgery-detail-value">${SurgeryApprovalPage.renderBadge(s) || 'Miễn trừ dữ liệu lịch sử'}</div>
                </div>` : ''}
                ${s.notes ? `<div class="surgery-detail-row">
                    <div class="surgery-detail-label">Ghi chú</div>
                    <div class="surgery-detail-value">${Utils.escapeHtml(s.notes)}</div>
                </div>` : ''}
                ${s.rescheduledFrom ? `<div class="surgery-detail-row">
                    <div class="surgery-detail-label">Lịch sử dời ca</div>
                    <div class="surgery-detail-value"><span style="color:#b45309;font-weight:600">🔄 Dời từ ngày ${Utils.formatDate(s.rescheduledFrom.fromDate)} sang ngày ${Utils.formatDate(s.rescheduledFrom.toDate)}</span> <span style="font-size:0.8rem;color:var(--text-secondary)">(${s.rescheduledFrom.by || 'BS'})</span></div>
                </div>` : ''}
                ${s.duplicateOverride ? `<div class="surgery-detail-row">
                    <div class="surgery-detail-label">Ghi nhận trùng</div>
                    <div class="surgery-detail-value">${s.duplicateOverride.type === 'same_patient_multicase' ? '<span class="badge-duplicate-patient">⚡ Cùng bệnh nhân (Mổ 2 thì)</span>' : '<span class="badge-different-patient">👥 Khác bệnh nhân (Trùng tên)</span>'} <span style="font-size:0.8rem;color:var(--text-secondary)">(Xác nhận bởi ${s.duplicateOverride.confirmedBy || 'BS'})</span></div>
                </div>` : ''}
            </div>
            <div class="modal-footer">
                ${s.robotCaseId ? `
                    <button type="button" class="btn btn-secondary" onclick="Modal.close();RobotSchedulePage.openFromWeeklySchedule('${Utils.escapeHtml(s.robotCaseId)}')">🤖 Điều phối Robot</button>
                ` : ''}
                ${(typeof SurgeryApprovalPage !== 'undefined' && SurgeryApprovalPage.isCaseApprovalEnabled(s) && s.approachType !== 'nsth') ? `
                    <button type="button" class="btn btn-secondary" onclick="Modal.close();SurgeryApprovalPage.openCaseModal(${s.id})">📋 Hồ sơ duyệt mổ</button>
                ` : ''}
                ${canEdit ? `
                    <button type="button" class="btn btn-danger" onclick="SurgeryPage.deleteSurgery(${s.id})">Xoá</button>
                    <button type="button" class="btn btn-secondary" onclick="Modal.close();SurgeryPage.openForm(${s.id})">Chỉnh sửa</button>
                ` : ''}
                <button type="button" class="btn btn-primary" onclick="Modal.close()">Đóng</button>
            </div>
        `);
    },

    _normSearch(str) {
        return String(str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[đĐ]/g, 'd')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    },

    _ensureProcedureCatalog() {
        if (this._procedureCatalogCache) return Promise.resolve(this._procedureCatalogCache);
        if (this._procedureCatalogPromise) return this._procedureCatalogPromise;
        if (typeof window === 'undefined' || (window.location && window.location.protocol === 'file:')) {
            return Promise.resolve(null);
        }
        const token = (typeof Auth !== 'undefined' && Auth.getToken) ? Auth.getToken() : '';
        if (!token) return Promise.resolve(null);

        this._procedureCatalogPromise = fetch('/api/surgery/procedure-catalog', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        })
            .then(resp => (resp.ok ? resp.json() : null))
            .then(data => {
                if (data && Array.isArray(data.procedures)) {
                    this._procedureCatalogCache = {
                        catalogVersion: data.catalogVersion || '',
                        procedures: data.procedures,
                        attendingColumns: data.attendingColumns || {},
                        robotCertifiedStaffIds: Array.isArray(data.robotCertifiedStaffIds) ? data.robotCertifiedStaffIds : [1],
                        overColumnPolicy: data.overColumnPolicy || {}
                    };
                    if (document.querySelector('#modal form[data-autosave-key^="surgery-"]')) {
                        this._updateColumnHint();
                        const activeEl = document.activeElement;
                        if (activeEl && activeEl.name === 'method') {
                            this._onAcInput('method', activeEl);
                        }
                    }
                }
                this._procedureCatalogPromise = null;
                return this._procedureCatalogCache;
            })
            .catch(() => {
                this._procedureCatalogPromise = null;
                return null;
            });
        return this._procedureCatalogPromise;
    },

    _getAttendingColumnsMap() {
        const merged = { ...SURGERY_FALLBACK_ATTENDING_COLUMNS };
        const remote = this._procedureCatalogCache?.attendingColumns;
        if (remote && typeof remote === 'object') {
            Object.entries(remote).forEach(([k, v]) => {
                if (v && typeof v === 'object') merged[k] = v;
            });
        }
        return merged;
    },

    _getRobotCertifiedSet() {
        const ids = this._procedureCatalogCache?.robotCertifiedStaffIds;
        return new Set(Array.isArray(ids) && ids.length ? ids.map(Number) : [1]);
    },

    _getSurgeryWeekDays(baseDateStr) {
        let base;
        if (baseDateStr && /^\d{4}-\d{2}-\d{2}/.test(baseDateStr)) {
            const parts = baseDateStr.split('T')[0].split('-');
            base = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
            base = new Date();
        }
        if (isNaN(base.getTime())) base = new Date();
        const dow = base.getDay();
        const monday = new Date(base);
        monday.setDate(base.getDate() - (dow === 0 ? 6 : dow - 1));
        monday.setHours(0, 0, 0, 0);
        const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        return Array.from({ length: 6 }, (_, idx) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + idx);
            return {
                iso: this.dateStr(d),
                dayLabel: dayNames[idx],
                dateLabel: `${d.getDate()}/${d.getMonth() + 1}`
            };
        });
    },

    _shortDocLabel(doc, allDocs) {
        if (!doc) return '';
        const rawTitle = String(doc.title || '').trim();
        let shortTitle = rawTitle;
        if (/TS\.\s*BSCKII/i.test(rawTitle)) shortTitle = 'TS.';
        else if (/BSCKII/i.test(rawTitle)) shortTitle = 'CKII.';
        else if (/BSCKI/i.test(rawTitle)) shortTitle = 'CKI.';
        else if (/ThS/i.test(rawTitle)) shortTitle = 'ThS.';
        else if (/BS/i.test(rawTitle)) shortTitle = 'BS.';

        const parts = String(doc.name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return shortTitle || '';
        const lastWord = parts[parts.length - 1];
        const normLast = this._normSearch(lastWord);
        const dupCount = Array.isArray(allDocs)
            ? allDocs.filter(other => {
                const op = String(other?.name || '').trim().split(/\s+/).filter(Boolean);
                return op.length && this._normSearch(op[op.length - 1]) === normLast;
            }).length
            : 0;

        let displayName = lastWord;
        if (dupCount > 1 && parts.length >= 2) {
            const initials = parts.slice(0, -1).map(p => p.charAt(0).toUpperCase() + '.').join('');
            displayName = `${initials} ${lastWord}`;
        }
        return shortTitle ? `${shortTitle} ${displayName}` : displayName;
    },

    _getFormDoctorsContext() {
        const staff = Store.getAll('staff').filter(st =>
            st.role && (st.role.includes('Bác sĩ') || st.role.includes('Trưởng khoa') || st.role.includes('Phó trưởng khoa'))
        );
        const mainSurgeonStaff = staff.filter(st => {
            if (typeof SAP_TRAINEE_IDS !== 'undefined' && SAP_TRAINEE_IDS.has(Number(st.id))) return false;
            const rl = String(st.role || '').toLowerCase();
            return !rl.includes('học viên') && !rl.includes('nội trú');
        });
        const extDocs = Store.getAll('externalDoctors') || [];
        return { staff, mainSurgeonStaff, extDocs };
    },

    _renderDocPickerChips(fieldName) {
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        if (!form) return;
        const { staff, mainSurgeonStaff, extDocs } = this._getFormDoctorsContext();
        const khoaDocs = fieldName === 'mainSurgeon' ? mainSurgeonStaff : staff;
        const allDocs = [...khoaDocs, ...extDocs];
        const selectEl = form.querySelector(`select[name="${fieldName}"]`);
        const selectedVal = selectEl ? String(selectEl.value || '') : '';
        const activeTab = (this._docPickerTabs && this._docPickerTabs[fieldName]) || 'khoa';
        const qNorm = this._normSearch((this._docPickerQueries && this._docPickerQueries[fieldName]) || '');

        let listDocs = qNorm
            ? allDocs.filter(d => this._normSearch(`${d.title || ''} ${d.name || ''}`).includes(qNorm))
            : (activeTab === 'ext' ? extDocs : khoaDocs);

        // Render selected indicator pill
        const selBox = document.getElementById(`surg-doc-selected-${fieldName}`);
        if (selBox) {
            const matchedDoc = allDocs.find(d => String(d.id) === selectedVal);
            if (matchedDoc) {
                const fullName = Utils.escapeHtml(`${matchedDoc.title ? matchedDoc.title + ' ' : ''}${matchedDoc.name || ''}`.trim());
                selBox.innerHTML = `<span class="surg-doc-picked-pill" title="${fullName}"><span>✓ ${fullName}</span><button type="button" class="surg-doc-clear-btn" onclick="SurgeryPage._clearDocChip('${fieldName}')" aria-label="Bỏ chọn bác sĩ">×</button></span>`;
            } else {
                selBox.innerHTML = `<span class="surg-doc-picked-empty">Chưa chọn — chạm chip bên dưới</span>`;
            }
        }

        // Sync tab pill states
        const pickerEl = document.querySelector(`.surg-doc-picker[data-target="${fieldName}"]`);
        if (pickerEl) {
            pickerEl.querySelectorAll('.surg-doc-tab').forEach(btn => {
                const isActive = !qNorm && btn.dataset.tab === activeTab;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });
        }

        const chipsWrap = document.getElementById(`surg-doc-chips-${fieldName}`);
        if (!chipsWrap) return;
        if (!listDocs.length) {
            chipsWrap.innerHTML = `<div class="surg-doc-empty">Không tìm thấy bác sĩ phù hợp</div>`;
            return;
        }
        chipsWrap.innerHTML = listDocs.map(doc => {
            const isSel = selectedVal && String(doc.id) === selectedVal;
            const fullName = Utils.escapeHtml(`${doc.title ? doc.title + ' ' : ''}${doc.name || ''}`.trim());
            const shortLabel = Utils.escapeHtml(this._shortDocLabel(doc, allDocs));
            return `<button type="button" class="surg-doc-chip ${isSel ? 'active' : ''}" data-doc-id="${doc.id}" aria-pressed="${isSel ? 'true' : 'false'}" title="${fullName}" onclick="SurgeryPage._selectDocChip('${fieldName}', ${doc.id})">${shortLabel}</button>`;
        }).join('');
    },

    _switchDocTab(fieldName, tab) {
        if (!this._docPickerTabs) this._docPickerTabs = {};
        if (!this._docPickerQueries) this._docPickerQueries = {};
        this._docPickerTabs[fieldName] = tab;
        this._docPickerQueries[fieldName] = '';
        const searchInp = document.querySelector(`.surg-doc-picker[data-target="${fieldName}"] .surg-doc-search`);
        if (searchInp) searchInp.value = '';
        this._renderDocPickerChips(fieldName);
    },

    _filterDocChips(fieldName, val) {
        if (!this._docPickerQueries) this._docPickerQueries = {};
        this._docPickerQueries[fieldName] = val || '';
        this._renderDocPickerChips(fieldName);
    },

    _selectDocChip(fieldName, docId) {
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        if (!form) return;
        const selectEl = form.querySelector(`select[name="${fieldName}"]`);
        if (!selectEl) return;
        const targetVal = String(docId);
        selectEl.value = (String(selectEl.value) === targetVal) ? '' : targetVal;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        this._renderDocPickerChips(fieldName);
        if (fieldName === 'mainSurgeon') this._updateColumnHint();
    },

    _clearDocChip(fieldName) {
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        if (!form) return;
        const selectEl = form.querySelector(`select[name="${fieldName}"]`);
        if (!selectEl) return;
        selectEl.value = '';
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        this._renderDocPickerChips(fieldName);
        if (fieldName === 'mainSurgeon') this._updateColumnHint();
    },

    _toggleAssistPicker(forceOpen) {
        const body = document.getElementById('surg-assist-picker-body');
        const toggleBtn = document.getElementById('surg-assist-toggle-btn');
        if (!body || !toggleBtn) return;
        const nextOpen = (typeof forceOpen === 'boolean') ? forceOpen : body.classList.contains('is-collapsed-mobile');
        this._formAssistExpanded = nextOpen;
        body.classList.toggle('is-collapsed-mobile', !nextOpen);
        toggleBtn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
        toggleBtn.textContent = nextOpen ? '▾ Thu gọn BS phụ 1' : '＋ Chọn BS phụ 1 (tùy chọn)';
    },

    _selectSurgeryType(typeKey) {
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        if (!form) return;
        const sel = form.querySelector('select[name="surgeryType"]');
        if (!sel || sel.disabled) return;
        sel.value = typeKey;
        this._onSurgeryTypeChange(sel);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        this._syncSegmentedControls();
        this._updateColumnHint();
    },

    _selectApproachType(approachKey) {
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        if (!form) return;
        const sel = document.getElementById('surgery-approach');
        if (!sel || sel.disabled) return;
        sel.value = approachKey;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        this._syncSegmentedControls();
        this._updateColumnHint();
        const methodInput = form.querySelector('input[name="method"]');
        const methodList = document.getElementById('surg-ac-method');
        if (methodInput && methodList && !methodList.hidden) {
            this._onAcInput('method', methodInput);
        }
    },

    _renderDayChipsForDate(isoDateStr) {
        const wrap = document.getElementById('surg-day-chips');
        if (!wrap) return;
        const days = this._getSurgeryWeekDays(isoDateStr);
        wrap.dataset.weekKey = days[0]?.iso || '';
        wrap.innerHTML = days.map(d => {
            const active = d.iso === isoDateStr;
            return `<button type="button" class="surg-day-chip ${active ? 'active' : ''}" data-date="${d.iso}" aria-pressed="${active ? 'true' : 'false'}" onclick="SurgeryPage._selectSurgeryDateChip('${d.iso}')"><span>${d.dayLabel}</span><small>${d.dateLabel}</small></button>`;
        }).join('');
    },

    _syncDayChips() {
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        const wrap = document.getElementById('surg-day-chips');
        if (!form || !wrap) return;
        const dateVal = form.querySelector('input[name="date"]')?.value || '';
        const hasChip = dateVal && Boolean(wrap.querySelector(`.surg-day-chip[data-date="${dateVal}"]`));
        if (dateVal && !hasChip) {
            this._renderDayChipsForDate(dateVal);
            return;
        }
        wrap.querySelectorAll('.surg-day-chip').forEach(btn => {
            const active = btn.dataset.date === dateVal;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    },

    _selectSurgeryDateChip(isoDate) {
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        if (!form) return;
        const dateInp = form.querySelector('input[name="date"]');
        if (!dateInp) return;
        dateInp.value = isoDate;
        dateInp.dispatchEvent(new Event('change', { bubbles: true }));
        this._syncDayChips();
    },

    _selectDurationChip(mins) {
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        if (!form) return;
        const durInp = form.querySelector('input[name="duration"]');
        if (!durInp) return;
        durInp.value = String(mins);
        durInp.dispatchEvent(new Event('input', { bubbles: true }));
        durInp.dispatchEvent(new Event('change', { bubbles: true }));
        this._syncDurationChips();
    },

    _syncDurationChips() {
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        if (!form) return;
        const durVal = String(form.querySelector('input[name="duration"]')?.value || '').trim();
        form.querySelectorAll('.surg-dur-chip').forEach(btn => {
            const active = durVal !== '' && btn.dataset.dur === durVal;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    },

    _syncSegmentedControls() {
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        if (!form) return;
        const typeSel = form.querySelector('select[name="surgeryType"]');
        const appSel = document.getElementById('surgery-approach');
        const typeVal = typeSel ? typeSel.value : 'chuongtrinh';
        const appVal = appSel ? appSel.value : '';
        const typeDisabled = Boolean(typeSel && typeSel.disabled);
        const appDisabled = Boolean(appSel && appSel.disabled);

        form.querySelectorAll('.surg-seg-btn[data-surg-type]').forEach(btn => {
            const active = btn.dataset.surgType === typeVal;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            btn.disabled = typeDisabled && !active;
        });

        form.querySelectorAll('.surg-approach-btn[data-approach]').forEach(btn => {
            const active = btn.dataset.approach === appVal;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            btn.disabled = appDisabled && !active;
        });
    },

    _getDiagnosisSuggestions(query) {
        const qNorm = this._normSearch(query);
        const tokens = qNorm ? qNorm.split(' ').filter(Boolean) : [];
        const freq = new Map();
        const all = this.getAllSurgeries();
        for (let i = all.length - 1; i >= 0; i--) {
            const raw = String(all[i]?.diagnosis || '').trim();
            if (!raw || raw.length < 3) continue;
            const key = this._normSearch(raw);
            if (!key) continue;
            if (!freq.has(key)) freq.set(key, { value: raw, count: 0 });
            freq.get(key).count += 1;
        }
        let entries = Array.from(freq.values());
        if (tokens.length) {
            entries = entries.filter(item => {
                const hay = this._normSearch(item.value);
                return tokens.every(tk => hay.includes(tk));
            });
        }
        entries.sort((a, b) => {
            if (qNorm) {
                const aStarts = this._normSearch(a.value).startsWith(qNorm) ? 0 : 1;
                const bStarts = this._normSearch(b.value).startsWith(qNorm) ? 0 : 1;
                if (aStarts !== bStarts) return aStarts - bStarts;
            }
            return b.count - a.count;
        });
        return entries.slice(0, 8).map(e => ({
            value: e.value,
            meta: '',
            procClass: ''
        }));
    },

    _mapApproachToCatalogGroup(approachType) {
        if (approachType === 'noisoi' || approachType === 'robot') return 'noisoi';
        if (approachType === 'mo') return 'mo';
        return '';
    },

    _getMethodSuggestions(query, activeApproach) {
        const qNorm = this._normSearch(query);
        const tokens = qNorm ? qNorm.split(' ').filter(Boolean) : [];
        const targetGroup = this._mapApproachToCatalogGroup(activeApproach);
        const seen = new Set();
        const items = [];

        const catalogProcs = Array.isArray(this._procedureCatalogCache?.procedures)
            ? this._procedureCatalogCache.procedures
            : [];

        const matchTokens = (text) => {
            if (!tokens.length) return true;
            const hay = this._normSearch(text);
            return tokens.every(tk => hay.includes(tk));
        };

        // 1. Prioritize BVBD catalog matching activeApproach, preserving PT classification badge
        const sortedCatalog = [...catalogProcs].sort((a, b) => {
            const aMatch = targetGroup && a.approachGroup === targetGroup ? 0 : 1;
            const bMatch = targetGroup && b.approachGroup === targetGroup ? 0 : 1;
            if (aMatch !== bMatch) return aMatch - bMatch;
            return (a.rowIndex || 999) - (b.rowIndex || 999);
        });
        for (const p of sortedCatalog) {
            const name = String(p.officialName || '').trim();
            if (!name) continue;
            const key = this._normSearch(name);
            if (seen.has(key)) continue;
            const aliasText = Array.isArray(p.aliases) ? p.aliases.join(' ') : '';
            if (!matchTokens(`${name} ${p.sheetCode || ''} ${aliasText}`)) continue;
            seen.add(key);
            const cls = (p.procedureClass && p.procedureClass !== 'unclassified') ? p.procedureClass : '';
            items.push({
                value: name,
                meta: cls,
                procClass: cls,
                approachGroup: p.approachGroup || '',
                priorityBoost: (targetGroup && p.approachGroup === targetGroup) ? 2 : 1
            });
            if (items.length >= 10) break;
        }

        // 2. Complement with historical method strings from surgeries[] without case count
        if (items.length < 10) {
            const freq = new Map();
            const all = this.getAllSurgeries();
            for (let i = all.length - 1; i >= 0; i--) {
                const s = all[i];
                const raw = String(s?.method || '').trim();
                if (!raw || raw.length < 4) continue;
                const key = this._normSearch(raw);
                if (!key || seen.has(key)) continue;
                if (!matchTokens(raw)) continue;
                if (!freq.has(key)) freq.set(key, { value: raw, count: 0, sameApp: 0 });
                const entry = freq.get(key);
                entry.count += 1;
                if (activeApproach && s?.approachType === activeApproach) entry.sameApp += 1;
            }
            const hist = Array.from(freq.values()).sort((a, b) => (b.sameApp - a.sameApp) || (b.count - a.count));
            for (const h of hist) {
                items.push({
                    value: h.value,
                    meta: '',
                    procClass: '',
                    priorityBoost: 0
                });
                if (items.length >= 10) break;
            }
        }
        return items.slice(0, 10);
    },

    _findExactDvktProcedure(methodStr) {
        const procs = this._procedureCatalogCache?.procedures;
        if (!Array.isArray(procs) || !procs.length) return null;
        const norm = this._normSearch(methodStr);
        if (!norm) return null;
        return procs.find(p => this._normSearch(p.officialName) === norm) || null;
    },

    _findSimilarDvktProcedures(query, approachType, limit = 5, strictSearch = false) {
        const procs = this._procedureCatalogCache?.procedures;
        if (!Array.isArray(procs) || !procs.length) return [];
        const qNorm = this._normSearch(query);
        const stopWords = new Set(['phau', 'thuat', 'pt', 'ptns', 'va', 'voi', 'bang', 'qua', 'co', 'khong', 'tu', 'cho', 'cua', 'cac', 'mot', 'nhom', 'phuong', 'phap']);
        const allQTokens = qNorm ? qNorm.split(' ').filter(Boolean) : [];
        const contentQTokens = allQTokens.filter(t => t.length >= 2 && !stopWords.has(t));
        const qTokens = contentQTokens.length ? contentQTokens : allQTokens;
        const targetGroup = this._mapApproachToCatalogGroup(approachType);

        const scored = [];
        for (const p of procs) {
            const name = String(p.officialName || '').trim();
            if (!name) continue;
            const pn = this._normSearch(name);
            const aliasText = Array.isArray(p.aliases) ? p.aliases.join(' ') : '';
            const hay = aliasText ? `${pn} ${this._normSearch(aliasText)}` : pn;

            if (strictSearch && qTokens.length && !qTokens.every(tk => hay.includes(tk))) {
                continue;
            }

            let score = 0;
            let hits = 0;
            if (targetGroup && p.approachGroup === targetGroup) score += 12;
            if (qNorm && (pn.includes(qNorm) || (pn.length >= 8 && qNorm.includes(pn)))) {
                score += 35;
            }
            if (qTokens.length) {
                for (const tk of qTokens) {
                    if (pn.includes(tk)) hits += 1;
                }
                if (hits > 0) {
                    const pTokens = pn.split(' ').filter(t => t.length >= 2 && !stopWords.has(t));
                    score += (hits / qTokens.length) * 40 + (hits / Math.max(1, pTokens.length)) * 12;
                }
            }
            scored.push({
                proc: p,
                hits,
                score,
                groupMatch: targetGroup && p.approachGroup === targetGroup ? 1 : 0
            });
        }

        scored.sort((a, b) => {
            if (b.hits !== a.hits && !strictSearch) return b.hits - a.hits;
            if (Math.abs(b.score - a.score) > 0.01) return b.score - a.score;
            if (b.groupMatch !== a.groupMatch) return b.groupMatch - a.groupMatch;
            return (a.proc.rowIndex || 999) - (b.proc.rowIndex || 999);
        });

        return scored.slice(0, limit).map(x => x.proc);
    },

    _renderDvktDialogList(procs) {
        this._dvktDialogMatches = procs || [];
        const listEl = document.getElementById('surg-dvkt-list');
        if (!listEl) return;
        if (!this._dvktDialogMatches.length) {
            listEl.innerHTML = '<div class="surg-dvkt-empty">Không tìm thấy DVKT BVBD khớp từ khóa — bạn có thể xoá bớt từ khóa hoặc bấm &ldquo;Vẫn lưu phương án tự nhập&rdquo;.</div>';
            return;
        }
        listEl.innerHTML = this._dvktDialogMatches.map((p, idx) => {
            const cls = (p.procedureClass && p.procedureClass !== 'unclassified') ? p.procedureClass : '';
            const appLabel = p.approachGroup === 'noisoi' ? 'Nội soi' : (p.approachGroup === 'mo' ? 'Mổ mở' : '');
            return `
                <button type="button" class="surg-dvkt-item" data-dvkt-idx="${idx}" onclick="SurgeryPage._applyDvktAndSave(${idx})">
                    <span class="surg-dvkt-item-name">${Utils.escapeHtml(p.officialName || '')}</span>
                    <span class="surg-dvkt-item-badges">
                        ${cls ? `<span class="surg-dvkt-class-badge">${Utils.escapeHtml(cls)}</span>` : ''}
                        ${appLabel ? `<span class="surg-dvkt-app-tag">${Utils.escapeHtml(appLabel)}</span>` : ''}
                    </span>
                </button>
            `;
        }).join('');
    },

    _showDvktConfirmDialog(rawMethod, approachType, currentId) {
        this._closeDvktConfirmDialog(false);
        this._dvktDialogContext = { rawMethod, approachType, currentId: currentId || 0 };
        const initialMatches = this._findSimilarDvktProcedures(rawMethod, approachType, 5, false);

        const overlay = document.createElement('div');
        overlay.id = 'surgery-dvkt-dialog';
        overlay.className = 'surg-dvkt-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'surg-dvkt-title');
        overlay.innerHTML = `
            <div class="surg-dvkt-dialog">
                <div class="surg-dvkt-head">
                    <h4 id="surg-dvkt-title" class="surg-dvkt-title">📋 Đối chiếu Dịch vụ kỹ thuật (DVKT) BVBD</h4>
                    <p class="surg-dvkt-desc">Chọn 1 DVKT tương đương trong danh mục BVBD để BCN khoa đánh giá đúng phân cột phẫu thuật, hoặc giữ nguyên phương án tự nhập.</p>
                </div>
                <div class="surg-dvkt-current">
                    Phương án tự nhập: <strong>${Utils.escapeHtml(rawMethod)}</strong>
                </div>
                <input type="search" id="surg-dvkt-search" class="surg-dvkt-search" placeholder="Tìm nhanh trong 309 DVKT BVBD..." aria-label="Tìm trong 309 dịch vụ kỹ thuật BVBD" oninput="SurgeryPage._filterDvktDialog(this.value)">
                <div id="surg-dvkt-list" class="surg-dvkt-list" role="listbox"></div>
                <div class="surg-dvkt-footer">
                    <button type="button" class="btn btn-secondary" onclick="SurgeryPage._closeDvktConfirmDialog(true)">Quay lại sửa</button>
                    <button type="button" id="surg-dvkt-keep-custom-btn" class="btn btn-primary" onclick="SurgeryPage._keepCustomMethodAndSave()">Vẫn lưu phương án tự nhập</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this._renderDvktDialogList(initialMatches);

        if (this._dvktEscHandler) {
            document.removeEventListener('keydown', this._dvktEscHandler, true);
        }
        this._dvktEscHandler = (ev) => {
            if (ev.key === 'Escape' && document.getElementById('surgery-dvkt-dialog')) {
                ev.preventDefault();
                ev.stopPropagation();
                this._closeDvktConfirmDialog(true);
            }
        };
        document.addEventListener('keydown', this._dvktEscHandler, true);
    },

    _filterDvktDialog(searchStr) {
        const ctx = this._dvktDialogContext || {};
        const q = String(searchStr || '').trim();
        const matches = q
            ? this._findSimilarDvktProcedures(q, ctx.approachType || '', 8, true)
            : this._findSimilarDvktProcedures(ctx.rawMethod || '', ctx.approachType || '', 5, false);
        this._renderDvktDialogList(matches);
    },

    _closeDvktConfirmDialog(refocusMethod = false) {
        const dialog = document.getElementById('surgery-dvkt-dialog');
        if (dialog) dialog.remove();
        if (this._dvktEscHandler) {
            document.removeEventListener('keydown', this._dvktEscHandler, true);
            this._dvktEscHandler = null;
        }
        if (refocusMethod) {
            this._openApprovalAfterSave = false;
            this._addNextAfterSave = false;
            setTimeout(() => {
                document.querySelector('#modal form[data-autosave-key^="surgery-"] input[name="method"]')?.focus();
            }, 20);
        }
    },

    _applyDvktAndSave(idx) {
        const proc = this._dvktDialogMatches && this._dvktDialogMatches[idx];
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        if (proc && form) {
            const methodInp = form.querySelector('input[name="method"]');
            if (methodInp) {
                methodInp.value = proc.officialName || '';
                if (proc.procedureClass && proc.procedureClass !== 'unclassified') {
                    methodInp.dataset.matchedClass = proc.procedureClass;
                } else {
                    delete methodInp.dataset.matchedClass;
                }
                methodInp.dispatchEvent(new Event('input', { bubbles: true }));
                methodInp.dispatchEvent(new Event('change', { bubbles: true }));
            }
            this._updateColumnHint();
        }
        this._pendingDvktConfirmed = true;
        this._closeDvktConfirmDialog(false);
        if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
    },

    _keepCustomMethodAndSave() {
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        this._pendingDvktConfirmed = true;
        this._closeDvktConfirmDialog(false);
        if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
    },

    _recommendDvktFromDiagnosis(diagnosisStr, activeApproach, limit = 5) {
        const procs = this._procedureCatalogCache?.procedures;
        if (!Array.isArray(procs) || !procs.length) return [];

        const rawDiag = String(diagnosisStr || '').trim();
        const dNorm = this._normSearch(rawDiag);
        if (!dNorm) return [];

        const targetGroup = this._mapApproachToCatalogGroup(activeApproach);
        const isCancer = /(^|\s)(k|ca)\s+|ung\s*thu|carcinoma|sarcoma|u\s*ac|ct[1-4]|pt[1-4]|t[1-4]n[0-3]/i.test(dNorm);

        const isStomaClosure = dNorm.includes('hoi trang ra da')
            || dNorm.includes('hau mon nhan tao')
            || dNorm.includes('hmnt')
            || dNorm.includes('dong hmnt')
            || dNorm.includes('mo thong hoi trang')
            || (dNorm.includes('dong ') && dNorm.includes('ra da'));

        const isHemorrhoid = /(^|[\s,/-])trĩ(\s|$|[,/-])|búi\s*trĩ|trĩ\s*(nội|ngoại|hỗn\s*hợp|tắc\s*mạch|vòng|độ)|^trĩ$/i.test(rawDiag)
            || /\b(longo|milligan|ferguson)\b/i.test(dNorm);

        const isFistula = dNorm.includes('ro hau mon') || dNorm.includes('duong ro');
        const isAbscessHauMon = dNorm.includes('ap xe') && (dNorm.includes('hau mon') || dNorm.includes('canh hau mon'));
        const isInguinalHernia = dNorm.includes('thoat vi ben');
        const isUmbilicalHernia = dNorm.includes('thoat vi ron');
        const isVentralHernia = dNorm.includes('thoat vi thanh bung') || dNorm.includes('thoat vi vet mo');
        const isSigmaOrLeft = dNorm.includes('sigma')
            || dNorm.includes('xich ma')
            || dNorm.includes('dai trang trai')
            || dNorm.includes('goc lach')
            || dNorm.includes('dai trang xuong')
            || dNorm.includes('dai trang chau hong');
        const isRightColon = dNorm.includes('dai trang phai')
            || dNorm.includes('goc gan')
            || dNorm.includes('manh trang')
            || dNorm.includes('dai trang len');
        const isTransverseColon = dNorm.includes('dai trang ngang');
        const isRectal = !isStomaClosure && (dNorm.includes('truc trang') || dNorm.includes('ong hau mon'));
        const isAppendix = dNorm.includes('ruot thua');
        const isGastric = dNorm.includes('da day') || dNorm.includes('hang vi') || dNorm.includes('tam vi') || dNorm.includes('mon vi');
        const isGallbladder = dNorm.includes('tui mat') || dNorm.includes('duong mat');

        // Historical co-occurrence boost mapped strictly onto official BVBD catalog entries
        const histBoostByNorm = new Map();
        const stopWords = new Set(['benh', 'nhan', 'theo', 'doi', 'da', 'mo', 'hien', 'tai', 'viem', 'nhiem', 'do', 'cap', 'man', 'tinh', 'hai', 'ben', 'trai', 'phai', 'giua', 'tren', 'duoi', 'sau', 'truoc', 'kem', 'va', 'voi', 'hoac', 'tai', 'phat', 'giai', 'doan', 'ung', 'thu', 'k']);
        const rawDiagTokens = dNorm.split(/[^a-z0-9]+/).filter(Boolean);
        const contentDiagTokens = rawDiagTokens.filter(t => t.length >= 2 && !stopWords.has(t) && t !== 'tri');

        const catalogNormMap = new Map();
        for (const p of procs) {
            const pn = this._normSearch(p.officialName);
            if (pn) catalogNormMap.set(pn, pn);
        }

        const allSurgeries = this.getAllSurgeries();
        for (let i = allSurgeries.length - 1; i >= 0; i--) {
            const s = allSurgeries[i];
            const sd = this._normSearch(s?.diagnosis);
            const sm = this._normSearch(s?.method);
            if (!sd || !sm) continue;
            const matchedOfficial = catalogNormMap.get(sm);
            if (!matchedOfficial) continue;

            const sameDiag = sd === dNorm
                || (sd.length >= 6 && dNorm.includes(sd))
                || (dNorm.length >= 6 && sd.includes(dNorm))
                || (contentDiagTokens.length >= 2 && contentDiagTokens.every(t => sd.includes(t)));
            if (sameDiag) {
                const prev = histBoostByNorm.get(matchedOfficial) || 0;
                histBoostByNorm.set(matchedOfficial, Math.min(18, prev + 2));
            }
        }

        const scored = [];
        for (const p of procs) {
            const pRaw = String(p.officialName || '').trim();
            if (!pRaw) continue;
            const pn = this._normSearch(pRaw);
            let score = 0;

            if (isStomaClosure) {
                if (pn.includes('dong hau mon nhan tao') || pn.includes('dong hoi trang') || pn.includes('noi ruot')) {
                    score += 65;
                } else if (pn.includes('hau mon nhan tao')) {
                    score += 35;
                } else if (pn.includes('cat truc trang') || pn.includes('cat dai trang')) {
                    score -= 30;
                }
            }

            if (isHemorrhoid) {
                const pIsTri = /(^|[\s,/-])trĩ(\s|$|[,/-])|búi\s*trĩ|trĩ\s*(kinh\s*điển|vòng|tắc\s*mạch)|longo|milligan|ferguson/i.test(pRaw);
                if (pIsTri) {
                    score += 65;
                    if (dNorm.includes('tac mach') && pn.includes('tac mach')) score += 20;
                    if (dNorm.includes('vong') && pn.includes('vong')) score += 15;
                }
            }

            if (isFistula && (pn.includes('ro hau mon') || pn.includes('duong ro'))) {
                score += 65;
                if ((dNorm.includes('phuc tap') || dNorm.includes('cao')) && pn.includes('phuc tap')) score += 15;
                if ((dNorm.includes('don gian') || dNorm.includes('thap')) && pn.includes('don gian')) score += 15;
            }

            if (isAbscessHauMon) {
                if (pn.includes('ap xe')) score += 35;
                if (pn.includes('hau mon')) score += 25;
                if (pn.includes('ro hau mon')) score += 30;
            }

            if (isInguinalHernia && pn.includes('thoat vi ben')) {
                score += 65;
                if (dNorm.includes('tai phat') && pn.includes('tai phat')) score += 15;
            }
            if (isUmbilicalHernia && (pn.includes('thoat vi ron') || pn.includes('thoat vi thanh bung'))) {
                score += 60;
            }
            if (isVentralHernia && (pn.includes('thoat vi thanh bung') || pn.includes('thoat vi vet mo'))) {
                score += 60;
            }

            if (isSigmaOrLeft) {
                if (pn.includes('dai trang chau hong') || pn.includes('dai trang trai') || pn.includes('sigma')) {
                    score += 55;
                    if (isCancer && pn.includes('nao vet hach')) score += 18;
                } else if (pn.includes('dai trang phai') && !pn.includes('dai trang trai')) {
                    score -= 10;
                }
            }

            if (isRightColon) {
                if (pn.includes('dai trang phai') || pn.includes('manh trang')) {
                    score += 55;
                    if (isCancer && pn.includes('nao vet hach')) score += 18;
                } else if (pn.includes('dai trang trai') && !pn.includes('dai trang phai')) {
                    score -= 10;
                }
            }

            if (isTransverseColon && pn.includes('dai trang ngang')) {
                score += 55;
                if (isCancer && pn.includes('nao vet hach')) score += 18;
            }

            if (isRectal && (pn.includes('truc trang') || pn.includes('miles') || pn.includes('ong hau mon'))) {
                score += 55;
                if ((dNorm.includes('thap') || dNorm.includes('ong hau mon')) && (pn.includes('thap') || pn.includes('miles') || pn.includes('ong hau mon'))) {
                    score += 18;
                }
                if (isCancer && pn.includes('nao vet hach')) score += 18;
            }

            if (isAppendix && pn.includes('ruot thua')) {
                score += 65;
                if (dNorm.includes('ap xe') && pn.includes('ap xe')) score += 15;
            }

            if (isGastric && pn.includes('da day')) {
                score += 55;
                if (isCancer && pn.includes('nao vet hach')) score += 18;
                if (dNorm.includes('thung') && pn.includes('thung')) score += 20;
            }

            if (isGallbladder && (pn.includes('tui mat') || pn.includes('duong mat'))) {
                score += 45;
            }

            // General token overlap (excluding false 'tri' match unless real hemorrhoid)
            if (contentDiagTokens.length) {
                let tkHits = 0;
                for (const tk of contentDiagTokens) {
                    if (pn.includes(tk)) tkHits += 1;
                }
                if (tkHits > 0) {
                    score += (tkHits / contentDiagTokens.length) * 28;
                }
            }

            // Historical co-occurrence boost from Khoa practice
            const hBoost = histBoostByNorm.get(pn) || 0;
            if (hBoost > 0) score += hBoost;

            // Active approach tie-breaker & bonus
            const groupMatch = Boolean(targetGroup && p.approachGroup === targetGroup);
            if (groupMatch) score += 20;

            scored.push({
                proc: p,
                score,
                groupMatch: groupMatch ? 1 : 0,
                rowIndex: p.rowIndex || 999
            });
        }

        scored.sort((a, b) => {
            if (Math.abs(b.score - a.score) > 0.01) return b.score - a.score;
            if (b.groupMatch !== a.groupMatch) return b.groupMatch - a.groupMatch;
            return a.rowIndex - b.rowIndex;
        });

        // Prefer entries with clinical/keyword/history match (score > 20, or fallback if few)
        const relevant = scored.filter(x => x.score > 20);
        const picked = (relevant.length >= limit ? relevant : scored).slice(0, limit);
        return picked.map(({ proc }) => {
            const cls = (proc.procedureClass && proc.procedureClass !== 'unclassified') ? proc.procedureClass : '';
            return {
                value: String(proc.officialName || '').trim(),
                meta: cls,
                procClass: cls,
                approachGroup: proc.approachGroup || '',
                fromDiag: true
            };
        });
    },

    _onAcInput(field, inputEl) {
        if (!inputEl) return;
        const form = inputEl.closest('form');
        const activeApproach = form ? (form.querySelector('#surgery-approach')?.value || '') : '';
        const query = inputEl.value || '';

        if (field === 'diagnosis') {
            const items = this._getDiagnosisSuggestions(query);
            this._showAutocomplete('diagnosis', items, '');
            return;
        }

        const diagVal = String(form?.querySelector('input[name="diagnosis"]')?.value || '').trim();
        const hasCatalog = Array.isArray(this._procedureCatalogCache?.procedures) && this._procedureCatalogCache.procedures.length > 0;
        let items;
        let headerText = '';
        if (query.trim() === '' && diagVal !== '' && hasCatalog) {
            items = this._recommendDvktFromDiagnosis(diagVal, activeApproach, 5);
            if (items.length) {
                headerText = '💡 5 DVKT BVBD phù hợp theo chẩn đoán';
            }
        } else {
            items = this._getMethodSuggestions(query, activeApproach);
        }
        this._showAutocomplete('method', items, headerText);
        delete inputEl.dataset.matchedClass;
        this._updateColumnHint();
    },

    _showAutocomplete(field, items, headerText = '') {
        const listEl = document.getElementById(`surg-ac-${field}`);
        if (!listEl) return;
        if (!this._acState) this._acState = { diagnosis: { items: [], activeIdx: -1 }, method: { items: [], activeIdx: -1 } };
        this._acState[field] = { items: items || [], activeIdx: (items && items.length) ? 0 : -1 };
        if (!items || !items.length) {
            listEl.hidden = true;
            listEl.innerHTML = '';
            return;
        }
        const headerHtml = headerText
            ? `<div class="surg-ac-header">${Utils.escapeHtml(headerText)}</div>`
            : '';
        listEl.innerHTML = headerHtml + items.map((item, idx) => `
            <button type="button" class="surg-ac-item ${idx === 0 ? 'is-active' : ''}" role="option" aria-selected="${idx === 0 ? 'true' : 'false'}"
                onmousedown="event.preventDefault(); SurgeryPage._pickAcItem('${field}', ${idx})">
                <span class="surg-ac-text">${Utils.escapeHtml(item.value)}</span>
                ${item.meta ? `<span class="surg-ac-meta ${item.procClass ? 'is-catalog' : ''}">${Utils.escapeHtml(item.meta)}</span>` : ''}
            </button>
        `).join('');
        listEl.hidden = false;
    },

    _hideAutocomplete(field) {
        const listEl = document.getElementById(`surg-ac-${field}`);
        if (listEl) listEl.hidden = true;
        if (this._acState && this._acState[field]) {
            this._acState[field].activeIdx = -1;
        }
    },

    _pickAcItem(field, idx) {
        const state = this._acState && this._acState[field];
        if (!state || !state.items || !state.items[idx]) return;
        const item = state.items[idx];
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        const inp = form ? form.querySelector(`input[name="${field}"]`) : null;
        if (inp) {
            inp.value = item.value;
            if (field === 'method') {
                if (item.procClass) inp.dataset.matchedClass = item.procClass;
                else delete inp.dataset.matchedClass;
            }
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
        this._hideAutocomplete(field);
        if (field === 'method') this._updateColumnHint();
    },

    _onAcKeydown(field, e) {
        const listEl = document.getElementById(`surg-ac-${field}`);
        const isOpen = Boolean(listEl && !listEl.hidden);
        if (!isOpen) return;
        const state = (this._acState && this._acState[field]) || { items: [], activeIdx: -1 };
        const count = state.items.length;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!count) return;
            state.activeIdx = (state.activeIdx + 1) % count;
            this._highlightAcItem(listEl, state.activeIdx);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!count) return;
            state.activeIdx = (state.activeIdx - 1 + count) % count;
            this._highlightAcItem(listEl, state.activeIdx);
        } else if (e.key === 'Enter') {
            if (count > 0) {
                e.preventDefault();
                e.stopPropagation();
                this._pickAcItem(field, state.activeIdx >= 0 ? state.activeIdx : 0);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this._hideAutocomplete(field);
        }
    },

    _highlightAcItem(listEl, activeIdx) {
        if (!listEl) return;
        listEl.querySelectorAll('.surg-ac-item').forEach((el, idx) => {
            const on = idx === activeIdx;
            el.classList.toggle('is-active', on);
            el.setAttribute('aria-selected', on ? 'true' : 'false');
            if (on && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ block: 'nearest' });
            }
        });
    },

    _colRankScore(raw) {
        const s = String(raw || '').toUpperCase().replace('PT-', '').replace('ĐB', 'DB').trim();
        if (s === 'DB') return 4;
        if (s === 'I') return 3;
        if (s === 'II') return 2;
        if (s === 'III') return 1;
        return 0;
    },

    _updateColumnHint() {
        const box = document.getElementById('surg-column-hint');
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        if (!box || !form) return;

        const mainIdRaw = form.querySelector('select[name="mainSurgeon"]')?.value || '';
        if (!mainIdRaw) {
            box.style.display = 'none';
            box.className = 'surg-col-hint';
            box.innerHTML = '';
            return;
        }

        const colsMap = this._getAttendingColumnsMap();
        const col = colsMap[String(mainIdRaw)] || colsMap[Number(mainIdRaw)];
        if (!col) {
            box.style.display = '';
            box.className = 'surg-col-hint is-info';
            box.innerHTML = 'ℹ️ <span>BS ngoài khoa — vui lòng kiểm tra phân quyền liên khoa nếu cần (không chặn lưu lịch).</span>';
            return;
        }

        const { mainSurgeonStaff } = this._getFormDoctorsContext();
        const docObj = mainSurgeonStaff.find(d => String(d.id) === String(mainIdRaw)) || { title: '', name: col.name || '' };
        const shortName = Utils.escapeHtml(this._shortDocLabel(docObj, mainSurgeonStaff) || col.name || 'BS');
        const approachVal = form.querySelector('#surgery-approach')?.value || '';
        const methodInp = form.querySelector('input[name="method"]');
        const methodVal = String(methodInp?.value || '').trim();
        const robotSet = this._getRobotCertifiedSet();

        if (approachVal === 'robot') {
            const hasRobotCert = Boolean(col.robot) || robotSet.has(Number(mainIdRaw));
            box.style.display = '';
            if (hasRobotCert) {
                box.className = 'surg-col-hint is-ok';
                box.innerHTML = `✅ <span><strong>${shortName}</strong> đủ chứng chỉ mổ chính <strong>Robot</strong>.</span>`;
            } else {
                box.className = 'surg-col-hint is-warn';
                box.innerHTML = `⚠️ <span>Lưu ý mềm: <strong>${shortName}</strong> chưa có chứng chỉ mổ chính <strong>Robot</strong> (chỉ cảnh báo, vẫn lưu được).</span>`;
            }
            return;
        }

        // Match method against catalog or explicit dataset class
        let matchedClass = methodInp?.dataset?.matchedClass || '';
        const catalogProcs = Array.isArray(this._procedureCatalogCache?.procedures)
            ? this._procedureCatalogCache.procedures
            : [];
        const normMethod = this._normSearch(methodVal);
        if (!matchedClass && normMethod && catalogProcs.length) {
            const exact = catalogProcs.find(p => this._normSearch(p.officialName) === normMethod);
            if (exact) {
                matchedClass = exact.procedureClass || '';
            } else if (normMethod.length >= 8) {
                const fuzzy = catalogProcs.find(p => {
                    const pn = this._normSearch(p.officialName);
                    const appOk = !approachVal || p.approachGroup === approachVal;
                    return appOk && pn.length >= 8 && (pn.includes(normMethod) || normMethod.includes(pn));
                });
                if (fuzzy) matchedClass = fuzzy.procedureClass || '';
            }
        }

        if (matchedClass) {
            const procScore = this._colRankScore(matchedClass);
            const openScore = this._colRankScore(col.open);
            const lapScore = this._colRankScore(col.lap);
            let colCode = col.open || col.lap || '';
            let surgeonScore = Math.max(openScore, lapScore);
            if (approachVal === 'mo') {
                colCode = col.open;
                surgeonScore = openScore;
            } else if (approachVal === 'noisoi' || approachVal === 'nsth') {
                colCode = col.lap;
                surgeonScore = lapScore;
            }

            if (procScore > 0 && surgeonScore > 0) {
                box.style.display = '';
                const safeClass = Utils.escapeHtml(matchedClass);
                const safeCol = Utils.escapeHtml(colCode === 'DB' ? 'ĐB' : colCode);
                if (surgeonScore >= procScore) {
                    box.className = 'surg-col-hint is-ok';
                    box.innerHTML = `✅ <span>Đúng phân cột BVBD: <strong>${safeClass}</strong> · ${shortName} (Cột ${safeCol}).</span>`;
                } else {
                    box.className = 'surg-col-hint is-warn';
                    box.innerHTML = `⚠️ <span>Lưu ý mềm vượt cột: <strong>${safeClass}</strong> vượt Cột ${safeCol} của <strong>${shortName}</strong> — cần duyệt vượt cột khi trình mổ (vẫn lưu lịch được).</span>`;
                }
                return;
            }
        }

        box.style.display = '';
        box.className = 'surg-col-hint is-info';
        const openLbl = col.open === 'DB' ? 'ĐB' : col.open;
        const lapLbl = col.lap === 'DB' ? 'ĐB' : col.lap;
        box.innerHTML = `🏷️ <span>Phân cột <strong>${shortName}</strong>: Mở <strong>${Utils.escapeHtml(openLbl)}</strong> · Nội soi <strong>${Utils.escapeHtml(lapLbl)}</strong>${col.robot ? ' · 🤖 Robot' : ''}</span>`;
    },

    _syncAllFormWidgetsFromInputs() {
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        if (!form) return;
        this._syncSegmentedControls();
        this._syncDayChips();
        this._syncDurationChips();
        this._renderDocPickerChips('mainSurgeon');
        this._renderDocPickerChips('assistSurgeon1');

        const assistVal = form.querySelector('select[name="assistSurgeon1"]')?.value || '';
        if (assistVal) {
            this._toggleAssistPicker(true);
        }

        const notesVal = form.querySelector('textarea[name="notes"]')?.value || '';
        const sbxChecked = Boolean(document.getElementById('surg-is-sandbox-case')?.checked);
        const optDetails = document.getElementById('surg-optional-details');
        if (optDetails && (notesVal.trim() || sbxChecked)) {
            optDetails.open = true;
        }
        this._updateColumnHint();
    },

    // Form
    openForm(id, date, opts = {}) {
        this._openApprovalAfterSave = false;
        this._addNextAfterSave = false;
        this._pendingDvktConfirmed = false;
        const all = this.getAllSurgeries();
        const s = id ? all.find(x => String(x.id) === String(id)) : null;
        const targetWeekKey = s?.date ? s.date.substring(0, 10) : this.getWeekKey();
        if (!canEditSurgery(targetWeekKey)) { Toast.show('🔒 Tuần này đã bị khoá. Không thể chỉnh sửa.', 'error'); return; }
        const defaultDate = s?.date || date || new Date().toISOString().split('T')[0];
        const { staff, mainSurgeonStaff, extDocs } = this._getFormDoctorsContext();
        const canSandbox = this.canUseSandboxSchedule();
        const isSandboxDefault = s ? Boolean(s.isTestSandboxCase) : Boolean(opts && opts.sandbox && canSandbox);
        const defaultMainSurgeonId = s ? s.mainSurgeon : '';
        const defaultAssistSurgeonId = s ? s.assistSurgeon1 : '';
        this._docPickerTabs = {
            mainSurgeon: (defaultMainSurgeonId && extDocs.some(d => String(d.id) === String(defaultMainSurgeonId))) ? 'ext' : 'khoa',
            assistSurgeon1: (defaultAssistSurgeonId && extDocs.some(d => String(d.id) === String(defaultAssistSurgeonId))) ? 'ext' : 'khoa'
        };
        this._docPickerQueries = { mainSurgeon: '', assistSurgeon1: '' };
        this._formAssistExpanded = Boolean(defaultAssistSurgeonId);

        const formKey = `surgery-${id || (isSandboxDefault ? 'new-sandbox' : 'new')}`;
        const modalTitle = s
            ? (s.isTestSandboxCase ? '🧪 Chỉnh sửa ca giả lập [TEST]' : 'Chỉnh sửa ca mổ')
            : (isSandboxDefault ? '🧪 Tạo ca giả lập từ Lịch mổ [TEST]' : 'Thêm ca mổ');

        const sandboxBannerHtml = (!s && canSandbox) ? `
            <div id="surg-sandbox-mode-box" style="margin-top:10px;padding:10px 12px;border-radius:10px;border:1.5px dashed ${isSandboxDefault ? '#d97706' : 'var(--border-default)'};background:${isSandboxDefault ? 'rgba(245,158,11,0.09)' : 'var(--bg-secondary)'};display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;min-width:0;max-width:100%;">
                <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin:0;flex:1 1 180px;min-width:0;max-width:100%;">
                    <input type="checkbox" id="surg-is-sandbox-case" name="isTestSandboxCase" value="1" ${isSandboxDefault ? 'checked' : ''} onchange="SurgeryPage._onSandboxModeToggle(this)" style="margin-top:3px;width:18px;height:18px;flex-shrink:0;accent-color:#d97706;">
                    <span>
                        <strong style="display:block;font-size:0.9rem;color:var(--text-primary);">🧪 Ca giả lập đào tạo quy trình [TEST]</strong>
                        <span style="display:block;font-size:0.78rem;color:var(--text-secondary);line-height:1.38;">Tự động gắn nhãn <code>[TEST]</code> & đồng bộ <strong>Tab Duyệt mổ</strong> · Tách biệt 100% khỏi bệnh nhân thật.</span>
                    </span>
                </label>
                <button type="button" class="btn btn-secondary btn-sm" onclick="SurgeryPage.fillSampleSandboxForm()" style="border-color:#d97706;color:#b45309;font-weight:600;white-space:nowrap;">
                    ⚡ Điền nhanh ca mẫu
                </button>
            </div>
        ` : (s && s.isTestSandboxCase ? `
            <input type="hidden" name="isTestSandboxCase" value="1">
            <div style="margin-bottom:12px;padding:10px 14px;border-radius:10px;border:1px solid #d97706;background:rgba(245,158,11,0.09);font-size:0.85rem;color:var(--text-primary);">
                🧪 <strong>Ca giả lập đào tạo [TEST]</strong> — Mọi thay đổi trên lịch mổ sẽ đồng bộ trực tiếp sang <strong>Tab Duyệt mổ</strong> (0% ảnh hưởng bệnh nhân thật).
            </div>
        ` : '');

        const lockedApproach = s?.robotCaseId ? (s?.robotSyncMeta?.scheduledApproach || s?.approachType || 'robot') : '';
        const lockedBannerText = s?.robotCaseId
            ? (lockedApproach === 'noisoi'
                ? `🔬 Ca chuyển mổ Nội soi từ Điều phối Robot (<strong>${Utils.escapeHtml(s.robotCaseId)}</strong>) — Đường mổ cố định Nội soi. Mọi thay đổi được đồng bộ 2 chiều.`
                : `🤖 Ca đang liên thông Điều phối Robot (<strong>${Utils.escapeHtml(s.robotCaseId)}</strong>) — Đường mổ cố định Robot. Mọi thay đổi được đồng bộ 2 chiều.`)
            : '';

        const initSurgeryType = lockedApproach === 'robot' ? 'robot' : (s?.surgeryType || 'chuongtrinh');
        const initApproach = lockedApproach || (initSurgeryType === 'robot' ? 'robot' : (s?.approachType || ''));
        const weekDays = this._getSurgeryWeekDays(defaultDate);
        const durPresets = [30, 60, 90, 120, 150, 180];
        const openOptionalByDefault = Boolean((s && s.notes && String(s.notes).trim()) || isSandboxDefault);

        Modal.open(modalTitle, `
            <form class="surg-form-v2" onsubmit="SurgeryPage.save(event, ${id || 0})" data-autosave-key="${formKey}">
                ${s?.robotCaseId ? `<div class="rbt-dirty-banner" style="margin-bottom:12px;">${lockedBannerText}</div>` : ''}
                ${(s && s.isTestSandboxCase) ? sandboxBannerHtml : ''}

                <!-- Card 1: Thông tin Bệnh nhân -->
                <div class="surg-section-card surg-card-patient">
                    <div class="surg-card-head">
                        <span class="surg-card-title">1. Bệnh nhân</span>
                        <span class="surg-card-hint">Họ tên bắt buộc · tự kiểm tra trùng hồ sơ</span>
                    </div>
                    <div class="form-row surg-row-patient-3col">
                        <div class="form-group">
                            <label class="form-label">Họ tên bệnh nhân <span class="form-required">*</span></label>
                            <input class="form-input" name="patientName" value="${Utils.escapeHtml(s?.patientName || '')}" required autocomplete="off" placeholder="${isSandboxDefault ? '[TEST] Nguyễn Văn Minh' : 'Nguyễn Văn A'}">
                        </div>
                        <div class="form-group surg-patient-pair">
                            <div class="surg-subgrid-2">
                                <div class="form-group">
                                    <label class="form-label">Năm sinh</label>
                                    <input class="form-input" name="birthYear" value="${s?.birthYear || ''}" placeholder="1964" type="number" inputmode="numeric" min="1900" max="2026">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Số nhập viện</label>
                                    <input class="form-input" name="admissionId" value="${Utils.escapeHtml(s?.admissionId || '')}" placeholder="26014285" inputmode="numeric" autocomplete="off">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="surgery-duplicate-banner" class="surgery-duplicate-banner" style="display:none;"></div>
                </div>

                <!-- Card 2: Phân loại & Lịch mổ -->
                <div class="surg-section-card surg-card-schedule">
                    <div class="surg-card-head">
                        <span class="surg-card-title">2. Phân loại &amp; Lịch mổ</span>
                        <span class="surg-card-hint">Chạm nhanh 1 lần để chọn</span>
                    </div>

                    <div class="form-row surg-row-classify-2col">
                        <div class="form-group surg-sr-anchor">
                            <label class="form-label">Loại phẫu thuật</label>
                            <select class="surg-sr-select" name="surgeryType" onchange="SurgeryPage._onSurgeryTypeChange(this)" ${lockedApproach === 'robot' ? 'disabled' : ''}>
                                ${Object.entries(SURGERY_TYPES).map(([key, t]) =>
                                    `<option value="${key}" ${initSurgeryType === key ? 'selected' : ''}>${t.label}</option>`
                                ).join('')}
                            </select>
                            <div class="surg-seg-group" role="group" aria-label="Loại phẫu thuật">
                                ${Object.entries(SURGERY_TYPES).map(([key, t]) => {
                                    const active = initSurgeryType === key;
                                    const disabled = lockedApproach === 'robot' && !active;
                                    return `<button type="button" class="surg-seg-btn ${active ? 'active' : ''}" data-surg-type="${key}" aria-pressed="${active ? 'true' : 'false'}" ${disabled ? 'disabled' : ''} onclick="SurgeryPage._selectSurgeryType('${key}')">${t.label}</button>`;
                                }).join('')}
                            </div>
                        </div>

                        <div class="form-group surg-sr-anchor">
                            <label class="form-label">Đường mổ <span class="form-required">*</span></label>
                            <select class="surg-sr-select" name="approachType" id="surgery-approach" required ${(Boolean(lockedApproach) || initSurgeryType === 'robot') ? 'disabled' : ''}>
                                <option value="">— Chọn —</option>
                                <option value="mo" ${initApproach === 'mo' ? 'selected' : ''}>Mổ mở</option>
                                <option value="noisoi" ${initApproach === 'noisoi' ? 'selected' : ''}>Nội soi</option>
                                <option value="nsth" ${initApproach === 'nsth' ? 'selected' : ''}>Nội soi tiêu hoá</option>
                                <option value="robot" ${initApproach === 'robot' ? 'selected' : ''}>Robot</option>
                            </select>
                            <div class="surg-seg-group surg-approach-group" role="group" aria-label="Đường mổ">
                                ${Object.entries(SURGERY_APPROACH_META).map(([key, meta]) => {
                                    const active = initApproach === key;
                                    const locked = Boolean(lockedApproach) || initSurgeryType === 'robot';
                                    return `<button type="button" class="surg-approach-btn ${active ? 'active' : ''}" data-approach="${key}" aria-pressed="${active ? 'true' : 'false'}" ${(locked && !active) ? 'disabled' : ''} onclick="SurgeryPage._selectApproachType('${key}')">${meta.label}</button>`;
                                }).join('')}
                            </div>
                        </div>
                    </div>

                    <div class="form-row surg-row-datetime">
                        <div class="form-group">
                            <label class="form-label">Ngày mổ <span class="form-required">*</span></label>
                            <div id="surg-day-chips" class="surg-day-chips" role="group" aria-label="Chọn nhanh ngày trong tuần">
                                ${weekDays.map(d => {
                                    const active = d.iso === defaultDate;
                                    return `<button type="button" class="surg-day-chip ${active ? 'active' : ''}" data-date="${d.iso}" aria-pressed="${active ? 'true' : 'false'}" onclick="SurgeryPage._selectSurgeryDateChip('${d.iso}')"><span>${d.dayLabel}</span><small>${d.dateLabel}</small></button>`;
                                }).join('')}
                            </div>
                            <input class="form-input" type="date" name="date" value="${defaultDate}" required onchange="SurgeryPage._syncDayChips()">
                        </div>

                        <div class="form-group">
                            <label class="form-label">Thời gian cuộc mổ (phút)</label>
                            <div class="surg-dur-chips" role="group" aria-label="Thời lượng nhanh">
                                ${durPresets.map(m => {
                                    const active = String(s?.duration || '') === String(m);
                                    return `<button type="button" class="surg-dur-chip ${active ? 'active' : ''}" data-dur="${m}" aria-pressed="${active ? 'true' : 'false'}" onclick="SurgeryPage._selectDurationChip(${m})">${m}p</button>`;
                                }).join('')}
                            </div>
                            <input class="form-input" name="duration" type="number" inputmode="numeric" min="10" max="720" value="${s?.duration || ''}" placeholder="Phút (VD: 120)" oninput="SurgeryPage._syncDurationChips()">
                        </div>
                    </div>

                    <div class="form-group surg-first-case-slot" id="first-case-group"></div>
                </div>

                <!-- Card 3: Chẩn đoán & Phương pháp PT -->
                <div class="surg-section-card surg-card-clinical">
                    <div class="surg-card-head">
                        <span class="surg-card-title">3. Chẩn đoán &amp; Phương pháp phẫu thuật</span>
                        <span class="surg-card-hint">Gõ không dấu để lọc gợi ý BVBD</span>
                    </div>
                    <div class="form-row surg-row-clinical-2col">
                        <div class="form-group">
                            <label class="form-label">Chẩn đoán</label>
                            <div class="surg-ac-wrap">
                                <input class="form-input" name="diagnosis" value="${Utils.escapeHtml(s?.diagnosis || '')}" autocomplete="off" placeholder="Ung thư đại tràng Sigma cT3N1M0"
                                    onfocus="SurgeryPage._onAcInput('diagnosis', this)"
                                    oninput="SurgeryPage._onAcInput('diagnosis', this)"
                                    onkeydown="SurgeryPage._onAcKeydown('diagnosis', event)"
                                    onblur="setTimeout(() => SurgeryPage._hideAutocomplete('diagnosis'), 140)">
                                <div class="surg-ac-list" id="surg-ac-diagnosis" role="listbox" hidden></div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Phương pháp phẫu thuật</label>
                            <div class="surg-ac-wrap">
                                <input class="form-input" name="method" value="${Utils.escapeHtml(s?.method || '')}" autocomplete="off" placeholder="Phẫu thuật nội soi cắt đại tràng Sigma + nạo vét hạch"
                                    onclick="if (document.getElementById('surg-ac-method')?.hidden) SurgeryPage._onAcInput('method', this)"
                                    onfocus="SurgeryPage._onAcInput('method', this)"
                                    oninput="SurgeryPage._onAcInput('method', this)"
                                    onkeydown="SurgeryPage._onAcKeydown('method', event)"
                                    onblur="setTimeout(() => SurgeryPage._hideAutocomplete('method'), 140)">
                                <div class="surg-ac-list" id="surg-ac-method" role="listbox" hidden></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Card 4: Ê-kíp Phẫu thuật & Phân cột -->
                <div class="surg-section-card surg-card-team">
                    <div class="surg-card-head">
                        <span class="surg-card-title">4. Ê-kíp phẫu thuật</span>
                        <span class="surg-card-hint">Không tự điền mặc định để tránh nhập nhầm BS</span>
                    </div>
                    <div class="form-row surg-row-team-2col">
                        <div class="form-group surg-sr-anchor">
                            <label class="form-label">BS mổ chính</label>
                            <select class="surg-sr-select" name="mainSurgeon" aria-hidden="true" tabindex="-1" onchange="SurgeryPage._renderDocPickerChips('mainSurgeon'); SurgeryPage._updateColumnHint();">
                                <option value="">— Chọn —</option>
                                <optgroup label="BS chính trong khoa">
                                ${mainSurgeonStaff.map(st => `<option value="${st.id}" ${defaultMainSurgeonId == st.id ? 'selected' : ''}>${st.title} ${st.name}</option>`).join('')}
                                </optgroup>
                                ${extDocs.length ? `<optgroup label="BS ngoài khoa">
                                ${extDocs.map(d => `<option value="${d.id}" ${defaultMainSurgeonId == d.id ? 'selected' : ''}>${d.title} ${d.name}</option>`).join('')}
                                </optgroup>` : ''}
                            </select>
                            <div class="surg-doc-picker" data-target="mainSurgeon">
                                <div class="surg-doc-bar">
                                    <div id="surg-doc-selected-mainSurgeon" class="surg-doc-selected"></div>
                                    <div class="surg-doc-tabs" role="tablist">
                                        <button type="button" class="surg-doc-tab active" data-tab="khoa" role="tab" aria-selected="true" onclick="SurgeryPage._switchDocTab('mainSurgeon', 'khoa')">Khoa (${mainSurgeonStaff.length})</button>
                                        <button type="button" class="surg-doc-tab" data-tab="ext" role="tab" aria-selected="false" onclick="SurgeryPage._switchDocTab('mainSurgeon', 'ext')">Ngoài (${extDocs.length})</button>
                                    </div>
                                </div>
                                <input type="search" class="surg-doc-search" placeholder="Tìm nhanh BS mổ chính..." aria-label="Tìm nhanh bác sĩ mổ chính" oninput="SurgeryPage._filterDocChips('mainSurgeon', this.value)">
                                <div id="surg-doc-chips-mainSurgeon" class="surg-doc-chips"></div>
                            </div>
                        </div>

                        <div class="form-group surg-sr-anchor">
                            <div class="surg-assist-header">
                                <label class="form-label" style="margin:0;">BS phụ 1</label>
                                <button type="button" id="surg-assist-toggle-btn" class="surg-assist-toggle-btn" aria-expanded="${this._formAssistExpanded ? 'true' : 'false'}" onclick="SurgeryPage._toggleAssistPicker()">
                                    ${this._formAssistExpanded ? '▾ Thu gọn BS phụ 1' : '＋ Chọn BS phụ 1 (tùy chọn)'}
                                </button>
                            </div>
                            <select class="surg-sr-select" name="assistSurgeon1" aria-hidden="true" tabindex="-1" onchange="SurgeryPage._renderDocPickerChips('assistSurgeon1');">
                                <option value="">— Chọn —</option>
                                <optgroup label="BS trong khoa">
                                ${staff.map(st => `<option value="${st.id}" ${defaultAssistSurgeonId == st.id ? 'selected' : ''}>${st.title} ${st.name}</option>`).join('')}
                                </optgroup>
                                ${extDocs.length ? `<optgroup label="BS ngoài khoa">
                                ${extDocs.map(d => `<option value="${d.id}" ${defaultAssistSurgeonId == d.id ? 'selected' : ''}>${d.title} ${d.name}</option>`).join('')}
                                </optgroup>` : ''}
                            </select>
                            <div id="surg-assist-picker-body" class="surg-doc-picker ${this._formAssistExpanded ? '' : 'is-collapsed-mobile'}" data-target="assistSurgeon1">
                                <div class="surg-doc-bar">
                                    <div id="surg-doc-selected-assistSurgeon1" class="surg-doc-selected"></div>
                                    <div class="surg-doc-tabs" role="tablist">
                                        <button type="button" class="surg-doc-tab active" data-tab="khoa" role="tab" aria-selected="true" onclick="SurgeryPage._switchDocTab('assistSurgeon1', 'khoa')">Khoa (${staff.length})</button>
                                        <button type="button" class="surg-doc-tab" data-tab="ext" role="tab" aria-selected="false" onclick="SurgeryPage._switchDocTab('assistSurgeon1', 'ext')">Ngoài (${extDocs.length})</button>
                                    </div>
                                </div>
                                <input type="search" class="surg-doc-search" placeholder="Tìm nhanh BS phụ 1..." aria-label="Tìm nhanh bác sĩ phụ 1" oninput="SurgeryPage._filterDocChips('assistSurgeon1', this.value)">
                                <div id="surg-doc-chips-assistSurgeon1" class="surg-doc-chips"></div>
                            </div>
                        </div>
                    </div>
                    <div id="surg-column-hint" class="surg-col-hint" aria-live="polite" style="display:none;"></div>
                </div>

                <!-- Card 5: Ghi chú & Tùy chọn nâng cao -->
                <details id="surg-optional-details" class="surg-optional-details" ${openOptionalByDefault ? 'open' : ''}>
                    <summary class="surg-optional-summary">
                        <span>📝 Ghi chú &amp; tùy chọn nâng cao</span>
                        <span class="surg-opt-meta">${isSandboxDefault ? 'Đang bật [TEST]' : 'Ghi chú · Ca giả lập'}</span>
                    </summary>
                    <div class="surg-optional-body">
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="form-label">Ghi chú</label>
                            <textarea class="form-textarea" name="notes" rows="2" placeholder="Yêu cầu dụng cụ đặc biệt, ghi chú kíp mổ...">${Utils.escapeHtml(s?.notes || '')}</textarea>
                        </div>
                        ${(!s && canSandbox) ? sandboxBannerHtml : ''}
                    </div>
                </details>

                <div class="modal-footer surg-modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="button" id="surg-submit-open-approval-btn" class="btn btn-secondary"
                        style="${isSandboxDefault ? 'border-color:#0284c7;color:#0369a1;background:rgba(14,165,233,0.1);font-weight:600;' : 'display:none;'}"
                        onclick="SurgeryPage.submitAndOpenApproval(this)">
                        📋 ${s ? 'Cập nhật & Sang Duyệt mổ' : 'Lưu & Sang Tab Duyệt mổ'}
                    </button>
                    ${!id ? `<button type="button" id="surg-submit-add-next-btn" class="btn btn-secondary surg-btn-add-next" onclick="SurgeryPage.submitAndAddNext(this)">➕ Lưu &amp; thêm ca tiếp</button>` : ''}
                    <button type="submit" id="surg-submit-primary-btn" class="btn btn-primary">${s ? 'Cập nhật' : (isSandboxDefault ? '🧪 Lưu lên Lịch mổ' : 'Thêm ca mổ')}</button>
                </div>
            </form>
        `);

        const modalEl = document.getElementById('modal');
        if (modalEl) modalEl.classList.add('surg-modal-wide');

        this._ensureProcedureCatalog();
        this._initFirstCaseCheckbox(s, defaultDate);
        this._syncAllFormWidgetsFromInputs();
        setTimeout(() => {
            if (document.querySelector(`#modal form[data-autosave-key="${formKey}"]`)) {
                this._syncAllFormWidgetsFromInputs();
            }
        }, 180);

        // Init realtime duplicate check
        this._pendingOverride = null;
        this._bindRealtimeDuplicateCheck(id);
        this._checkAndShowInlineBanner(id);
    },

    submitAndAddNext(btnEl) {
        const form = btnEl ? btnEl.closest('form') : document.querySelector('#modal form');
        if (!form) return;
        this._addNextAfterSave = true;
        this._openApprovalAfterSave = false;
        if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
        } else {
            form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
    },

    _onSandboxModeToggle(checkboxEl) {
        const checked = Boolean(checkboxEl && checkboxEl.checked);
        const box = document.getElementById('surg-sandbox-mode-box');
        if (box) {
            box.style.borderColor = checked ? '#d97706' : 'var(--border-default)';
            box.style.background = checked ? 'rgba(245,158,11,0.09)' : 'var(--bg-secondary)';
        }
        const optDetails = document.getElementById('surg-optional-details');
        if (optDetails && checked) optDetails.open = true;
        const primaryBtn = document.getElementById('surg-submit-primary-btn');
        if (primaryBtn) primaryBtn.textContent = checked ? '🧪 Lưu lên Lịch mổ' : 'Thêm ca mổ';
        const openAppBtn = document.getElementById('surg-submit-open-approval-btn');
        if (openAppBtn) {
            openAppBtn.style.display = checked ? '' : 'none';
            if (checked) {
                openAppBtn.style.borderColor = '#0284c7';
                openAppBtn.style.color = '#0369a1';
                openAppBtn.style.background = 'rgba(14,165,233,0.1)';
                openAppBtn.style.fontWeight = '600';
            }
        }
        const nameInput = document.querySelector('#modal input[name="patientName"]');
        if (nameInput) nameInput.placeholder = checked ? '[TEST] Nguyễn Văn Minh' : 'Nguyễn Văn A';
        const dateInput = document.querySelector('#modal input[name="date"]');
        this._initFirstCaseCheckbox(null, dateInput ? dateInput.value : new Date().toISOString().split('T')[0]);
        this._checkAndShowInlineBanner(0);
    },

    submitAndOpenApproval(btnEl) {
        const form = btnEl ? btnEl.closest('form') : document.querySelector('#modal form');
        if (!form) return;
        this._openApprovalAfterSave = true;
        this._addNextAfterSave = false;
        if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
        } else {
            form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
    },

    fillSampleSandboxForm() {
        const form = document.querySelector('#modal form');
        if (!form) return;
        const optDetails = document.getElementById('surg-optional-details');
        if (optDetails) optDetails.open = true;
        const sbxCheckbox = document.getElementById('surg-is-sandbox-case');
        if (sbxCheckbox && !sbxCheckbox.checked) {
            sbxCheckbox.checked = true;
            this._onSandboxModeToggle(sbxCheckbox);
        }
        const weekDates = this.getWeekDates();
        const thursdayStr = weekDates[3] ? this.dateStr(weekDates[3]) : new Date().toISOString().split('T')[0];
        const session = (typeof Auth !== 'undefined' && Auth.getSession) ? (Auth.getSession() || {}) : {};
        const simId = (typeof App !== 'undefined' && App.isSuperAdmin && App.isSuperAdmin() && typeof SurgeryApprovalPage !== 'undefined')
            ? Number(SurgeryApprovalPage._simulatedStaffId || 0)
            : 0;
        const mySid = simId > 0 ? simId : Number(session.staffId || 0);
        const myStaffObj = Store.getById('staff', mySid);
        const myRoleLc = String((myStaffObj && myStaffObj.role) || session.role || '').toLowerCase();
        const isTrainee = (typeof SAP_TRAINEE_IDS !== 'undefined' && SAP_TRAINEE_IDS.has(mySid))
            || myRoleLc.includes('học viên') || myRoleLc.includes('nội trú');
        const traineeDefaultAttending = { 45: 4, 46: 5, 16: 6, 44: 6, 50: 8, 43: 7, 47: 9, 48: 10 };
        const attendingDefaultTrainee = { 1: 45, 2: 44, 4: 45, 5: 46, 6: 44, 7: 43, 8: 50, 9: 47, 10: 48, 11: 45, 12: 44 };
        const effMainId = isTrainee ? (traineeDefaultAttending[mySid] || 4) : (mySid > 0 && mySid !== 3 ? mySid : 4);
        const effAssistId = isTrainee ? mySid : (attendingDefaultTrainee[effMainId] || 45);
        const isCol3Surgeon = [10, 11, 12].includes(effMainId);
        const uniqTag = String(Date.now()).slice(-4);

        const samples = isCol3Surgeon ? [
            {
                patientName: `[TEST] Lê Hoàng Khôi ${uniqTag}`,
                birthYear: 1981,
                admissionId: `TEST-${effMainId}-${uniqTag}`,
                surgeryType: 'chuongtrinh',
                approachType: 'mo',
                date: thursdayStr,
                duration: 60,
                mainSurgeon: effMainId,
                assistSurgeon1: effAssistId,
                diagnosis: 'Rò hậu môn thấp đơn giản',
                method: 'Phẫu thuật cắt đường rò hậu môn đơn giản',
                notes: 'Ca giả lập tự kiểm thử đúng phân quyền cá nhân (Cột III - PT-III)'
            }
        ] : [
            {
                patientName: `[TEST] Nguyễn Văn Minh ${uniqTag}`,
                birthYear: 1964,
                admissionId: `TEST-${effMainId}-${uniqTag}`,
                surgeryType: 'chuongtrinh',
                approachType: 'noisoi',
                date: thursdayStr,
                duration: 150,
                mainSurgeon: effMainId,
                assistSurgeon1: effAssistId,
                diagnosis: 'Ung thư đại tràng Sigma cT3N1M0',
                method: 'Phẫu thuật nội soi cắt đại tràng Sigma + nạo vét hạch',
                notes: 'Ca giả lập tự kiểm thử đúng phân quyền cá nhân từ Lịch mổ → Tab Duyệt mổ'
            },
            {
                patientName: `[TEST] Trần Thị Thu Hà ${uniqTag}`,
                birthYear: 1968,
                admissionId: `TEST-${effMainId}-${uniqTag}`,
                surgeryType: 'chuongtrinh',
                approachType: 'mo',
                date: thursdayStr,
                duration: 60,
                mainSurgeon: effMainId,
                assistSurgeon1: effAssistId,
                diagnosis: 'Rò hậu môn thấp đơn giản',
                method: 'Phẫu thuật cắt đường rò hậu môn đơn giản',
                notes: 'Ca giả lập tự kiểm thử đúng phân quyền cá nhân từ Lịch mổ → Tab Duyệt mổ'
            }
        ];
        const sample = samples[this._sampleSandboxIdx % samples.length];
        this._sampleSandboxIdx += 1;

        const setVal = (name, val) => {
            const el = form.querySelector(`[name="${name}"]`);
            if (el) el.value = val ?? '';
        };
        setVal('patientName', sample.patientName);
        setVal('birthYear', sample.birthYear);
        setVal('admissionId', sample.admissionId);
        setVal('surgeryType', sample.surgeryType);
        const typeEl = form.querySelector('[name="surgeryType"]');
        if (typeEl) this._onSurgeryTypeChange(typeEl);
        setVal('approachType', sample.approachType);
        setVal('date', sample.date);
        setVal('duration', sample.duration);
        setVal('mainSurgeon', sample.mainSurgeon);
        setVal('assistSurgeon1', sample.assistSurgeon1);
        setVal('diagnosis', sample.diagnosis);
        setVal('method', sample.method);
        setVal('notes', sample.notes);

        this._initFirstCaseCheckbox(null, sample.date);
        this._syncAllFormWidgetsFromInputs();
        this._checkAndShowInlineBanner(0);
    },

    _initFirstCaseCheckbox(s, dateStr) {
        const group = document.getElementById('first-case-group');
        if (!group) return;

        const sbxEl = document.getElementById('surg-is-sandbox-case');
        const isSandbox = s ? Boolean(s.isTestSandboxCase) : Boolean(sbxEl && sbxEl.checked);
        const all = this.getAllSurgeries();
        const existingFirst = all.find(x => x.date === dateStr && Boolean(x.isTestSandboxCase) === isSandbox && x.isFirstCase && (!s || String(x.id) !== String(s?.id)));

        if (existingFirst) {
            const name = Utils.escapeHtml(existingFirst.patientName || '');
            group.innerHTML = `
                <label class="first-case-label-disabled">
                    <input type="checkbox" disabled checked>
                    <span class="first-case-label span">⭐ Ca đầu tiên trong ngày${isSandbox ? ' [TEST]' : ''}</span>
                </label>
                <div class="first-case-warning">⚠️ Đã có ca đầu tiên${isSandbox ? ' [TEST]' : ''}: <strong>${name}</strong></div>
            `;
        } else {
            group.innerHTML = `
                <label class="first-case-label">
                    <input type="checkbox" id="is-first-case" name="isFirstCase" ${s && s.isFirstCase ? 'checked' : ''}>
                    <span class="first-case-label span">⭐ Ca đầu tiên trong ngày${isSandbox ? ' [TEST]' : ''}</span>
                </label>
            `;
        }

        // Re-check when date changes
        const dateInput = document.querySelector('#modal input[name="date"]');
        if (dateInput) {
            dateInput.onchange = () => {
                this._initFirstCaseCheckbox(s, dateInput.value);
                this._syncDayChips();
            };
        }
    },

    // ── Duplicate Detection & Resolution ──
    _normalizePatientName(str) {
        if (!str) return '';
        return str.trim()
            .replace(/^\[test\]\s*/i, '')
            .replace(/\s+/g, ' ')
            .toLowerCase()
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'd')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    },

    _getMondayOfWeek(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('T')[0].split('-');
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const day = d.getDay();
        d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    _getSundayOfWeek(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('T')[0].split('-');
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const day = d.getDay();
        d.setDate(d.getDate() + (day === 0 ? 0 : 7 - day));
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    _daysBetweenIso(d1, d2) {
        if (!d1 || !d2) return null;
        const p1 = String(d1).split('T')[0].split('-');
        const p2 = String(d2).split('T')[0].split('-');
        if (p1.length !== 3 || p2.length !== 3) return null;
        const t1 = Date.UTC(parseInt(p1[0], 10), parseInt(p1[1], 10) - 1, parseInt(p1[2], 10));
        const t2 = Date.UTC(parseInt(p2[0], 10), parseInt(p2[1], 10) - 1, parseInt(p2[2], 10));
        if (!Number.isFinite(t1) || !Number.isFinite(t2)) return null;
        return Math.round(Math.abs((t1 - t2) / 86400000));
    },

    _normalizeAdmissionKey(raw) {
        return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    },

    _findDuplicateSurgeries(candidate, currentId) {
        if (!candidate || !candidate.patientName) return [];
        const candName = this._normalizePatientName(candidate.patientName);
        if (!candName) return [];

        const candAdm = this._normalizeAdmissionKey(candidate.admissionId);
        const candYear = candidate.birthYear ? parseInt(candidate.birthYear, 10) : null;
        const candDate = candidate.date || '';
        const monday = this._getMondayOfWeek(candDate);
        const sunday = this._getSundayOfWeek(candDate);

        const all = this.getAllSurgeries();
        const matches = [];
        const candSandbox = Boolean(candidate.isTestSandboxCase);

        for (const s of all) {
            if (currentId && String(s.id) === String(currentId)) continue;
            if (Boolean(s.isTestSandboxCase) !== candSandbox) continue;
            const existName = this._normalizePatientName(s.patientName);
            const existAdm = this._normalizeAdmissionKey(s.admissionId);
            const existYear = s.birthYear ? parseInt(s.birthYear, 10) : null;
            const existDate = s.date || '';
            const gapDays = this._daysBetweenIso(candDate, existDate);

            // Tier 1A: Số nhập viện trùng nhưng KHÁC họ tên bệnh nhân -> Chặn tuyệt đối
            if (candAdm && existAdm && candAdm === existAdm && existName && candName !== existName) {
                matches.push({
                    level: 0,
                    tier: 1,
                    blockMismatch: true,
                    levelLabel: 'Số nhập viện đang thuộc bệnh nhân khác',
                    severity: 'danger',
                    surgery: s,
                    reason: `Số nhập viện (${s.admissionId || existAdm}) đang gắn với người bệnh ${s.patientName}.`
                });
                continue;
            }

            // Tier 1B: Cùng Số nhập viện & cùng bệnh nhân trong vòng <= 60 ngày
            if (candAdm && existAdm && candAdm === existAdm && (gapDays === null || gapDays <= 60)) {
                const sameDay = existDate === candDate;
                matches.push({
                    level: sameDay ? 1 : 2,
                    tier: 1,
                    levelLabel: sameDay ? 'Trùng số nhập viện cùng ngày' : 'Cùng số nhập viện trong đợt điều trị (≤60 ngày)',
                    severity: sameDay ? 'danger' : 'warning',
                    surgery: s,
                    inSameWeek: existDate >= monday && existDate <= sunday,
                    reason: `Cùng số nhập viện (${s.admissionId || existAdm}) với ca ngày ${Utils.formatDate(existDate)}.`
                });
                continue;
            }

            // Tier 2A: Cùng Họ tên + Năm sinh trong vòng <= 365 ngày (đa đợt điều trị / đóng HMNT / trùng tên)
            if (candName === existName && candYear && existYear && candYear === existYear && (gapDays === null || gapDays <= 365)) {
                const sameDay = existDate === candDate;
                matches.push({
                    level: sameDay ? 3 : 4,
                    tier: 2,
                    levelLabel: sameDay ? 'Trùng họ tên và năm sinh cùng ngày' : 'Trùng họ tên và năm sinh (≤365 ngày)',
                    severity: sameDay ? 'danger' : 'warning',
                    surgery: s,
                    inSameWeek: existDate >= monday && existDate <= sunday,
                    reason: `Bệnh nhân cùng họ tên và năm sinh (${existYear}) đã có ca ngày ${Utils.formatDate(existDate)}.`
                });
                continue;
            }

            // Tier 2B: Trùng họ tên thiếu năm sinh trong cùng ngày mổ
            if (candName === existName && (!candYear || !existYear) && existDate === candDate) {
                matches.push({
                    level: 5,
                    tier: 2,
                    levelLabel: 'Trùng họ tên cùng ngày (chưa đủ năm sinh)',
                    severity: 'info',
                    surgery: s,
                    reason: `Trùng họ tên với ca ngày ${Utils.formatDate(candDate)} (chưa đủ năm sinh đối chiếu).`
                });
                continue;
            }
        }

        matches.sort((a, b) => a.level - b.level);
        return matches;
    },

    _bindRealtimeDuplicateCheck(currentId) {
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        if (!form) return;

        const checkFn = () => {
            clearTimeout(form._dupTimer);
            form._dupTimer = setTimeout(() => {
                this._checkAndShowInlineBanner(currentId);
            }, 250);
        };

        const inputs = form.querySelectorAll('input[name="patientName"], input[name="birthYear"], input[name="admissionId"]');
        inputs.forEach(input => input.addEventListener('input', checkFn));

        const dateInput = form.querySelector('input[name="date"]');
        if (dateInput) dateInput.addEventListener('change', checkFn);
    },

    _checkAndShowInlineBanner(currentId) {
        const banner = document.getElementById('surgery-duplicate-banner');
        if (!banner) return;
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        if (!form) return;

        const formData = new FormData(form);
        const candidate = {
            patientName: formData.get('patientName'),
            birthYear: formData.get('birthYear'),
            admissionId: formData.get('admissionId'),
            date: formData.get('date'),
            isTestSandboxCase: Boolean(formData.get('isTestSandboxCase'))
        };

        const matches = this._findDuplicateSurgeries(candidate, currentId);
        if (!matches || matches.length === 0) {
            banner.style.display = 'none';
            banner.innerHTML = '';
            return;
        }

        const top = matches[0];
        const s = top.surgery;
        const safeName = Utils.escapeHtml(s.patientName);
        const safeDate = Utils.formatDate(s.date);
        const safeDoc = Utils.escapeHtml(Utils.getStaffName(s.mainSurgeon) || 'Chưa phân công');
        const safeDiag = Utils.escapeHtml(s.diagnosis || '—');
        const moreCount = matches.length > 1 ? ` <span style="font-weight:400;color:var(--text-secondary)">(và ${matches.length - 1} ca khác)</span>` : '';

        banner.style.display = 'block';
        banner.innerHTML = `
            <div class="dup-banner-title">
                <span>⚠️ ${top.levelLabel}: <strong>${safeName}</strong>${s.birthYear ? ` (${s.birthYear})` : ''}${moreCount}</span>
            </div>
            <div class="dup-banner-details">
                • <strong>Đã lên lịch:</strong> ${safeDate} — <strong>BS:</strong> ${safeDoc}<br>
                • <strong>Chẩn đoán:</strong> ${safeDiag}
            </div>
            <div class="dup-banner-actions">
                <span class="dup-banner-link" onclick="SurgeryPage.viewDetail(${s.id})">🔍 Xem chi tiết ca đã có</span>
            </div>
        `;
    },

    _showDuplicateConfirmDialog(matches, candidateData, currentId) {
        const modal = document.getElementById('modal');
        if (!modal) return;

        const existingDialog = document.getElementById('surgery-duplicate-dialog');
        if (existingDialog) existingDialog.remove();

        const topMatch = matches[0];
        const s = topMatch.surgery;
        const isNew = !currentId || currentId === 0;
        const targetDate = candidateData.date;

        const dialog = document.createElement('div');
        dialog.id = 'surgery-duplicate-dialog';
        dialog.className = 'surgery-duplicate-dialog';

        const safeCandName = Utils.escapeHtml(candidateData.patientName || '');
        const safeCandAdm = Utils.escapeHtml(candidateData.admissionId || '—');
        const safeCandDate = Utils.formatDate(candidateData.date);
        const safeCandDoc = Utils.escapeHtml(Utils.getStaffName(candidateData.mainSurgeon) || '—');
        const safeCandDiag = Utils.escapeHtml(candidateData.diagnosis || '—');

        const safeExistName = Utils.escapeHtml(s.patientName || '');
        const safeExistAdm = Utils.escapeHtml(s.admissionId || '—');
        const safeExistDate = Utils.formatDate(s.date);
        const safeExistDoc = Utils.escapeHtml(Utils.getStaffName(s.mainSurgeon) || '—');
        const safeExistDiag = Utils.escapeHtml(s.diagnosis || '—');

        dialog.innerHTML = `
            <div class="dup-dialog-header">
                <div class="dup-dialog-title">
                    <span>⚠️ Phát hiện ca mổ trùng thông tin (${topMatch.levelLabel})</span>
                </div>
                <div class="dup-dialog-desc">
                    Hệ thống phát hiện thông tin ca mổ bạn đang nhập trùng với ca đã có trong hệ thống. Vui lòng đối chiếu và chọn phương án xử lý:
                </div>
            </div>

            <table class="duplicate-compare-table">
                <thead>
                    <tr>
                        <th style="width:25%;">Thông tin</th>
                        <th style="width:37.5%;" class="dup-col-exist">Ca đã có trên lịch</th>
                        <th style="width:37.5%;" class="dup-col-new">Ca bạn đang nhập</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Họ tên & Tuổi</strong></td>
                        <td class="dup-col-exist"><strong>${safeExistName}</strong> ${s.birthYear ? `(${s.birthYear})` : ''}</td>
                        <td class="dup-col-new"><strong>${safeCandName}</strong> ${candidateData.birthYear ? `(${candidateData.birthYear})` : ''}</td>
                    </tr>
                    <tr>
                        <td><strong>Số nhập viện</strong></td>
                        <td class="dup-col-exist">${safeExistAdm}</td>
                        <td class="dup-col-new">${safeCandAdm}</td>
                    </tr>
                    <tr>
                        <td><strong>Ngày mổ</strong></td>
                        <td class="dup-col-exist"><span class="badge" style="background:#fef3c7;color:#b45309">${safeExistDate}</span></td>
                        <td class="dup-col-new"><span class="badge" style="background:#dbeafe;color:#1e40af">${safeCandDate}</span></td>
                    </tr>
                    <tr>
                        <td><strong>BS mổ chính</strong></td>
                        <td class="dup-col-exist">${safeExistDoc}</td>
                        <td class="dup-col-new">${safeCandDoc}</td>
                    </tr>
                    <tr>
                        <td><strong>Chẩn đoán</strong></td>
                        <td class="dup-col-exist">${safeExistDiag}</td>
                        <td class="dup-col-new">${safeCandDiag}</td>
                    </tr>
                </tbody>
            </table>

            <div class="dup-options-box">
                ${topMatch.blockMismatch ? `
                <div style="padding:10px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:0.86rem;line-height:1.45;">
                    ⛔ <strong>Không thể dùng chung Số nhập viện cho hai người bệnh khác nhau.</strong> Vui lòng bấm quay lại để kiểm tra và nhập đúng Số nhập viện trên hồ sơ bệnh án.
                </div>
                ` : `
                <div style="font-weight:700;font-size:0.88rem;margin-bottom:8px;color:var(--text-primary)">👉 Chọn hướng xử lý (1 chạm):</div>

                ${isNew && topMatch.surgery.date !== targetDate ? `
                <div style="margin-bottom:12px;padding:8px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;">
                    <button type="button" class="btn btn-success" style="width:100%;font-weight:600;" onclick="SurgeryPage._rescheduleSurgery(${s.id}, '${targetDate}')">
                        🔄 Dời ca cũ sang ngày ${safeCandDate} (Khuyến nghị nếu đổi lịch)
                    </button>
                    <div style="font-size:0.78rem;color:#166534;margin-top:4px;">
                        Chuyển ngày mổ của ca cũ sang ngày ${safeCandDate}, giữ nguyên hồ sơ và không tạo ca trùng.
                    </div>
                </div>
                ` : ''}

                <div style="margin-bottom:10px;">
                    ${topMatch.tier !== 1 ? `
                    <label class="dup-option-item">
                        <input type="radio" name="dupOverrideType" value="new_episode_same_patient" ${topMatch.surgery.date !== targetDate ? 'checked' : ''}>
                        <div>
                            <div class="dup-option-title">🔄 Cùng người bệnh — Đợt điều trị mới (đóng HMNT / tái nhập viện / mổ thì 2 khác đợt)</div>
                            <div class="dup-option-sub">Tạo hồ sơ đợt mổ mới độc lập và liên kết lịch sử đợt trước, không ghi đè ca cũ.</div>
                        </div>
                    </label>
                    ` : ''}
                    <label class="dup-option-item">
                        <input type="radio" name="dupOverrideType" value="same_admission_multistage" ${(topMatch.tier === 1 || topMatch.surgery.date === targetDate) ? 'checked' : ''}>
                        <div>
                            <div class="dup-option-title">⚡ Cùng đợt nằm viện — Mổ nhiều thì / mổ lại</div>
                            <div class="dup-option-sub">Dùng chung mã đợt điều trị hiện tại và gắn nhãn ⚡ Mổ nhiều thì trên lịch mổ.</div>
                        </div>
                    </label>
                    ${topMatch.tier !== 1 ? `
                    <label class="dup-option-item">
                        <input type="radio" name="dupOverrideType" value="different_patient_same_name">
                        <div>
                            <div class="dup-option-title">👥 Hai người bệnh khác nhau — Trùng họ tên & năm sinh</div>
                            <div class="dup-option-sub">Tạo mã đợt độc lập hoàn toàn và gắn nhãn 👥 Trùng tên để phân biệt.</div>
                        </div>
                    </label>
                    ` : ''}
                </div>
                `}
            </div>

            <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:auto;">
                <button type="button" class="btn btn-secondary" onclick="SurgeryPage._closeDuplicateConfirmDialog()">
                    ❌ Quay lại chỉnh sửa
                </button>
                ${topMatch.blockMismatch ? '' : `
                <button type="button" class="btn btn-primary" onclick="SurgeryPage._confirmDuplicateOverride(${currentId || 0}, ${s.id})">
                    ${isNew ? '➕ Xác nhận & Tạo ca này' : '💾 Xác nhận & Lưu ca này'}
                </button>
                `}
            </div>
        `;

        modal.appendChild(dialog);
    },

    _closeDuplicateConfirmDialog() {
        const dialog = document.getElementById('surgery-duplicate-dialog');
        if (dialog) dialog.remove();
    },

    _rescheduleSurgery(existingSurgeryId, targetDate) {
        const all = this.getAllSurgeries();
        const idx = all.findIndex(x => String(x.id) === String(existingSurgeryId));
        if (idx === -1) {
            Toast.show('Không tìm thấy ca mổ cũ để dời.', 'error');
            return;
        }

        const existing = all[idx];
        const sourceMonday = this._getMondayOfWeek(existing.date);
        const targetMonday = this._getMondayOfWeek(targetDate);

        if (!canEditSurgery(sourceMonday)) {
            Toast.show('🔒 Tuần nguồn của ca mổ cũ đã bị khoá. Không thể dời ca.', 'error');
            return;
        }
        if (!canEditSurgery(targetMonday)) {
            Toast.show('🔒 Tuần đích đã bị khoá. Không thể dời ca tới tuần này.', 'error');
            return;
        }

        const session = Auth.getSession();
        const actorMeta = session ? {
            username: session.username,
            name: session.name || session.username,
            at: new Date().toISOString()
        } : { username: 'unknown', name: 'Không xác định', at: new Date().toISOString() };

        // Read user inputs from the open form to merge updated fields if entered
        const form = document.querySelector('form[data-autosave-key="surgery-new"], form[data-autosave-key="surgery-0"]');
        let formObj = {};
        if (form) {
            const f = new FormData(form);
            formObj = {
                patientName: f.get('patientName') ? Utils.toProperCase(f.get('patientName')) : null,
                birthYear: f.get('birthYear') ? parseInt(f.get('birthYear'), 10) : null,
                admissionId: f.get('admissionId') ? f.get('admissionId').trim() : null,
                duration: f.get('duration') ? parseInt(f.get('duration'), 10) : null,
                mainSurgeon: f.get('mainSurgeon') ? parseInt(f.get('mainSurgeon'), 10) : null,
                assistSurgeon1: f.get('assistSurgeon1') ? parseInt(f.get('assistSurgeon1'), 10) : null,
                diagnosis: f.get('diagnosis') ? f.get('diagnosis').trim() : null,
                method: f.get('method') ? f.get('method').trim() : null,
                notes: f.get('notes') ? f.get('notes').trim() : null,
                isFirstCase: !!f.get('isFirstCase')
            };
        }

        // Check if target date already has another first case
        const targetHasFirst = all.some(x => x.date === targetDate && x.isFirstCase && String(x.id) !== String(existing.id));
        let finalIsFirstCase = formObj.isFirstCase !== undefined ? formObj.isFirstCase : existing.isFirstCase;
        if (targetHasFirst) {
            finalIsFirstCase = false;
        }

        const oldDate = existing.date;
        all[idx] = {
            ...existing,
            ...(formObj.patientName ? { patientName: formObj.patientName } : {}),
            ...(formObj.birthYear ? { birthYear: formObj.birthYear } : {}),
            ...(formObj.admissionId ? { admissionId: formObj.admissionId } : {}),
            ...(formObj.duration ? { duration: formObj.duration } : {}),
            ...(formObj.mainSurgeon ? { mainSurgeon: formObj.mainSurgeon } : {}),
            ...(formObj.assistSurgeon1 ? { assistSurgeon1: formObj.assistSurgeon1 } : {}),
            ...(formObj.diagnosis ? { diagnosis: formObj.diagnosis } : {}),
            ...(formObj.method ? { method: formObj.method } : {}),
            ...(formObj.notes ? { notes: formObj.notes } : {}),
            date: targetDate,
            isFirstCase: finalIsFirstCase,
            updatedBy: actorMeta,
            rescheduledFrom: {
                fromDate: oldDate,
                toDate: targetDate,
                at: new Date().toISOString(),
                by: actorMeta.username
            }
        };

        try {
            this.saveSurgeries(all);
            try { Modal.clearDraft('surgery-new'); } catch (_) {}
            try { Modal.clearDraft('surgery-0'); } catch (_) {}
            this._closeDuplicateConfirmDialog();
            try { Modal.close(); } catch (_) {}
            if (targetDate) this._selectedDayStr = targetDate;
            App.renderCurrentPage();

            if (targetHasFirst && (formObj.isFirstCase || existing.isFirstCase)) {
                Toast.show(`Đã dời ca sang ngày ${Utils.formatDate(targetDate)}. Lưu ý: Ngày đích đã có ca đầu tiên nên ca dời không gắn ca đầu ngày.`, 'info');
            } else {
                Toast.show(`Đã dời ca mổ sang ngày ${Utils.formatDate(targetDate)} thành công.`, 'success');
            }
        } catch (err) {
            console.error('[SurgeryPage] _rescheduleSurgery error:', err);
            Toast.error('Không thể dời ca mổ: ' + (err.message || 'Lỗi không xác định'));
        }
    },

    _confirmDuplicateOverride(currentId, matchedWithId) {
        const dialog = document.getElementById('surgery-duplicate-dialog');
        const selectedType = dialog
            ? dialog.querySelector('input[name="dupOverrideType"]:checked')?.value
            : 'new_episode_same_patient';

        const resolution = selectedType || 'new_episode_same_patient';
        const defaultChipMap = {
            new_episode_same_patient: 'stoma_closure_reversal',
            same_admission_multistage: 'planned_two_stage',
            different_patient_same_name: 'same_name_different_person'
        };

        this._pendingOverride = {
            resolution,
            type: resolution,
            matchedWithId,
            reasonChip: defaultChipMap[resolution] || 'planned_two_stage'
        };

        this._pendingDvktConfirmed = true;
        this._closeDuplicateConfirmDialog();

        // Submit form again with override enabled
        const form = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
        if (form) {
            const submitEvent = new Event('submit', { cancelable: true });
            form.dispatchEvent(submitEvent);
        }
    },

    _renderPatientWeeklyBadge(s, weekSurgeries) {
        if (!s || !s.duplicateOverride) return '';
        const ovType = s.duplicateOverride.resolution || s.duplicateOverride.type;
        if (ovType === 'different_patient_same_name') {
            return `<span class="badge-different-patient" title="Bệnh nhân trùng họ tên với ca khác trên lịch">👥 Trùng tên</span>`;
        }
        if (ovType === 'new_episode_same_patient') {
            return `<span class="badge-duplicate-patient" title="Cùng người bệnh — Đợt điều trị mới (đóng HMNT / tái nhập viện)">🔄 Đợt mới</span>`;
        }
        if (ovType === 'same_admission_multistage' || ovType === 'same_patient_multicase') {
            if (!Array.isArray(weekSurgeries)) return `<span class="badge-duplicate-patient" title="Bệnh nhân mổ nhiều thì trong đợt nằm viện">⚡ Mổ nhiều thì</span>`;
            const candName = this._normalizePatientName(s.patientName);
            const candAdm = this._normalizeAdmissionKey(s.admissionId);
            const candYear = s.birthYear ? parseInt(s.birthYear, 10) : null;

            const count = weekSurgeries.filter(x => {
                const existAdm = this._normalizeAdmissionKey(x.admissionId);
                if (candAdm && existAdm && candAdm === existAdm) return true;
                const existName = this._normalizePatientName(x.patientName);
                const existYear = x.birthYear ? parseInt(x.birthYear, 10) : null;
                return candName === existName && candYear && existYear && candYear === existYear;
            }).length;

            if (count >= 2) {
                return `<span class="badge-duplicate-patient" title="Bệnh nhân có ${count} ca mổ trong tuần này">⚡ ${count} ca/tuần</span>`;
            }
            return `<span class="badge-duplicate-patient" title="Bệnh nhân mổ nhiều thì trong đợt nằm viện">⚡ Mổ nhiều thì</span>`;
        }

        return '';
    },

    save(e, id) {
        e.preventDefault();
        const openApprovalAfter = Boolean(this._openApprovalAfterSave);
        const addNextAfter = Boolean(this._addNextAfterSave && !id);
        this._openApprovalAfterSave = false;
        this._addNextAfterSave = false;
        const form = e.target;
        const submitBtn = form?.querySelector('button[type="submit"]');
        const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="fc-spinner" style="display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;margin-right:6px;vertical-align:middle;"></span> Đang lưu...';
        }

        const restoreBtn = () => {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = origBtnHtml;
            }
        };

        try {
            const f = new FormData(form);
            const surgeryDate = f.get('date') || new Date().toISOString().split('T')[0];
            const targetWeekKey = surgeryDate ? surgeryDate.substring(0, 10) : this.getWeekKey();
            if (!canEditSurgery(targetWeekKey)) {
                Toast.show('🔒 Tuần này đã bị khoá. Không thể chỉnh sửa.', 'error');
                restoreBtn();
                return;
            }

            const all = this.getAllSurgeries();
            const existingRec = id ? all.find(x => String(x.id) === String(id)) : null;
            const isLinkedRobot = Boolean(existingRec && existingRec.robotCaseId);

            // approachType: respect linked Robot vs Laparoscopic approach
            const linkedApproach = isLinkedRobot
                ? ((existingRec.robotSyncMeta && existingRec.robotSyncMeta.scheduledApproach) || existingRec.approachType || 'robot')
                : '';
            const surgeryType = linkedApproach === 'robot' ? 'robot' : f.get('surgeryType');
            const approachType = linkedApproach || (surgeryType === 'robot' ? 'robot' : f.get('approachType'));
            if (!approachType) {
                Toast.warning('Vui lòng chọn đường mổ: Mổ mở / Nội soi / Robot');
                restoreBtn();
                return;
            }

            const rawMethod = String(f.get('method') || '').trim();
            const hasCatalog = Array.isArray(this._procedureCatalogCache?.procedures) && this._procedureCatalogCache.procedures.length > 0;
            const needDvktCheck = !this._pendingDvktConfirmed
                && approachType !== 'nsth'
                && Boolean(rawMethod)
                && hasCatalog
                && !this._findExactDvktProcedure(rawMethod);
            this._pendingDvktConfirmed = false;
            if (needDvktCheck) {
                if (openApprovalAfter) this._openApprovalAfterSave = true;
                if (addNextAfter) this._addNextAfterSave = true;
                restoreBtn();
                this._showDvktConfirmDialog(rawMethod, approachType, id);
                return;
            }

            // Item 7: Audit trail — who created/updated this record
            const session = Auth.getSession();
            const actorMeta = session ? {
                username: session.username,
                name: session.name || session.username,
                at: new Date().toISOString()
            } : { username: 'unknown', name: 'Không xác định', at: new Date().toISOString() };

            const rawDuration = f.get('duration');
            const durationVal = rawDuration ? (parseInt(rawDuration, 10) || null) : null;
            const isSandboxCase = existingRec
                ? Boolean(existingRec.isTestSandboxCase)
                : Boolean(f.get('isTestSandboxCase') && this.canUseSandboxSchedule());

            const rawProperName = Utils.toProperCase(f.get('patientName'));
            const normalizedPatientName = isSandboxCase
                ? (/\[test\]/i.test(rawProperName) ? rawProperName : `[TEST] ${rawProperName}`)
                : rawProperName.replace(/^\[test\]\s*/i, '');

            const candidateData = {
                patientName: normalizedPatientName,
                birthYear: f.get('birthYear') ? parseInt(f.get('birthYear'), 10) : '',
                admissionId: f.get('admissionId') ? f.get('admissionId').trim() : '',
                surgeryType: surgeryType,
                approachType: approachType,
                date: surgeryDate,
                duration: durationVal,
                mainSurgeon: f.get('mainSurgeon') ? parseInt(f.get('mainSurgeon'), 10) : null,
                assistSurgeon1: f.get('assistSurgeon1') ? parseInt(f.get('assistSurgeon1'), 10) : null,
                diagnosis: f.get('diagnosis') || '',
                method: f.get('method') || '',
                notes: f.get('notes') || '',
                isFirstCase: !!f.get('isFirstCase'),
                ...(isSandboxCase ? { isTestSandboxCase: true } : {})
            };

            // Check for duplicates if not already overridden in this submit cycle
            if (!this._pendingOverride) {
                if (openApprovalAfter) this._openApprovalAfterSave = true;
                if (addNextAfter) this._addNextAfterSave = true;
                const matches = this._findDuplicateSurgeries(candidateData, id);
                if (matches && matches.length > 0) {
                    restoreBtn();
                    this._showDuplicateConfirmDialog(matches, candidateData, id);
                    return;
                }
                this._openApprovalAfterSave = false;
                this._addNextAfterSave = false;
            }

            const data = {
                ...candidateData
            };

            if (this._pendingOverride) {
                data.duplicateOverride = this._pendingOverride;
                this._pendingOverride = null;
            }

            let savedId = id;
            if (id) {
                const idx = all.findIndex(x => String(x.id) === String(id));
                if (idx !== -1) {
                    all[idx] = {
                        ...all[idx],
                        ...data,
                        updatedBy: actorMeta   // audit trail: who last edited
                    };
                } else {
                    data.id = id;
                    data.createdBy = actorMeta;
                    all.push(data);
                }
            } else {
                data.id = Date.now();
                savedId = data.id;
                data.createdBy = actorMeta;    // audit trail: who created
                all.push(data);
            }
            const syncPromise = this.saveSurgeries(all);
            Promise.resolve(syncPromise).then(syncRes => {
                if (typeof RobotSchedulePage !== 'undefined' && isLinkedRobot) {
                    RobotSchedulePage._bootstrap = null;
                }
                const robotErr = syncRes?.errors?.find(x =>
                    ['ROBOT_APPROACH_LOCKED', 'ROBOT_SCHEDULE_COORDINATOR_REQUIRED', 'CASE_REVISION_MISMATCH', 'SCHEDULE_SLOT_CONFLICT'].includes(x?.error?.errorCode || x?.error?.code)
                );
                if (robotErr) {
                    Toast.error(robotErr.error?.message || robotErr.message || 'Lỗi đồng bộ Điều phối Robot.');
                }
                const dupErrEntry = syncRes?.errors?.find(x =>
                    x?.error?.status === 409 && [
                        'POTENTIAL_DUPLICATE_CONFIRM_REQUIRED',
                        'DUPLICATE_ACTIVE_ADMISSION_CASE',
                        'ADMISSION_ID_PATIENT_MISMATCH'
                    ].includes(x?.error?.errorCode || x?.error?.code)
                );
                if (!dupErrEntry) return;
                const srvErr = dupErrEntry.error;
                const errCode = srvErr.errorCode || srvErr.code;
                const matchedCase = srvErr.detail?.details?.matchedCase;
                this.openForm(id || null, surgeryDate);
                setTimeout(() => {
                    const reopenedForm = document.querySelector('#modal form[data-autosave-key^="surgery-"]');
                    if (reopenedForm) {
                        Object.entries(candidateData).forEach(([k, v]) => {
                            const inp = reopenedForm.querySelector(`[name="${k}"]`);
                            if (!inp) return;
                            if (inp.type === 'checkbox') inp.checked = Boolean(v);
                            else if (v != null) inp.value = String(v);
                        });
                        this._syncAllFormWidgetsFromInputs();
                    }
                    if (matchedCase) {
                        this._showDuplicateConfirmDialog([{
                            level: errCode === 'ADMISSION_ID_PATIENT_MISMATCH' ? 0 : 1,
                            tier: errCode === 'POTENTIAL_DUPLICATE_CONFIRM_REQUIRED' ? 2 : 1,
                            blockMismatch: errCode === 'ADMISSION_ID_PATIENT_MISMATCH',
                            levelLabel: errCode === 'ADMISSION_ID_PATIENT_MISMATCH'
                                ? 'Số nhập viện đang thuộc bệnh nhân khác'
                                : (errCode === 'DUPLICATE_ACTIVE_ADMISSION_CASE' ? 'Cùng số nhập viện đang hoạt động' : 'Trùng họ tên và năm sinh (≤365 ngày)'),
                            surgery: matchedCase
                        }], candidateData, id);
                    } else {
                        Toast.warning(srvErr.message || 'Phát hiện hồ sơ trùng trên máy chủ.');
                    }
                }, 80);
            });

            // P1: Clear auto-save draft on successful save
            const formKey = form?.getAttribute('data-autosave-key') || `surgery-${id || 'new'}`;
            try { Modal.clearDraft(formKey); } catch (_) {}
            if (!addNextAfter) {
                try { Modal.close(); } catch (_) {}
            }

            if (isSandboxCase) {
                this._showSandboxOnSchedule = true;
            }

            // Switch selected week & day focus to the surgery's date so the user immediately sees the updated case
            if (surgeryDate) {
                const parts = surgeryDate.split('T')[0].split('-');
                if (parts.length === 3) {
                    const target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                    if (!isNaN(target.getTime())) {
                        const day = target.getDay();
                        this.currentWeekStart = new Date(target);
                        this.currentWeekStart.setDate(target.getDate() - (day === 0 ? 6 : day - 1));
                        this.currentWeekStart.setHours(0, 0, 0, 0);
                    }
                }
                this._selectedDayStr = surgeryDate;
            }

            if (openApprovalAfter && typeof SurgeryApprovalPage !== 'undefined') {
                App.navigate('surgery-approval');
                Promise.resolve(syncPromise).then(() => {
                    if (typeof App !== 'undefined' && App.currentPage === 'surgery-approval') {
                        App.renderCurrentPage();
                    }
                    SurgeryApprovalPage.openCaseModal(savedId, { source: 'schedule' });
                });
                Toast.success(id ? 'Đã cập nhật & mở hồ sơ trên Tab Duyệt mổ' : '🧪 Đã lưu ca giả lập & chuyển sang Tab Duyệt mổ');
            } else if (addNextAfter) {
                App.renderCurrentPage();
                Toast.success(isSandboxCase
                    ? '🧪 Đã lưu ca giả lập — tiếp tục nhập ca tiếp theo'
                    : '✅ Đã lưu ca mổ — tiếp tục nhập ca mới');
                this.openForm(null, surgeryDate, { sandbox: isSandboxCase });
                if (window.innerWidth > 768) {
                    setTimeout(() => {
                        document.querySelector('#modal input[name="patientName"]')?.focus();
                    }, 90);
                }
            } else {
                App.renderCurrentPage();
                if (isSandboxCase) {
                    Promise.resolve(syncPromise).then(() => {
                        if (typeof App !== 'undefined' && App.currentPage === 'surgery') {
                            App.renderCurrentPage();
                        }
                    });
                    Toast.success(id
                        ? '🧪 Đã cập nhật ca giả lập [TEST] trên Lịch mổ'
                        : '🧪 Đã thêm ca giả lập [TEST] lên Lịch mổ — Bấm nhãn 📝 Chưa trình trên thẻ ca hoặc mở Tab Duyệt mổ để thực hành!');
                } else {
                    Toast.success(id ? 'Đã cập nhật ca mổ' : 'Đã thêm ca mổ');
                }
            }
        } catch (err) {
            console.error('[SurgeryPage] save error:', err);
            Toast.error('Không thể lưu ca mổ: ' + (err.message || 'Lỗi không xác định'));
            restoreBtn();
        }
    },

    async _callAtomicTrashEndpoint(path, method = 'POST') {
        const token = Auth.getToken();
        const idem = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? `trash_${crypto.randomUUID()}`
            : `trash_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const resp = await fetch(path, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Client-Build': String(CLIENT_BUILD),
                'Idempotency-Key': idem
            },
            body: method === 'DELETE' ? JSON.stringify({}) : JSON.stringify({})
        });
        let payload = {};
        try { payload = await resp.json(); } catch (_) {}
        if (!resp.ok) {
            throw new Error(payload.error || `Lỗi máy chủ (HTTP ${resp.status})`);
        }
        if (payload.version) Store._serverVersion = payload.version;
        if (payload.revisions && typeof payload.revisions === 'object') {
            Store._serverRevisions = Object.assign(Store._serverRevisions || {}, payload.revisions);
        }
        Store._lastEtag = null;
        return payload;
    },

    async deleteSurgery(id) {
        const all = this.getAllSurgeries();
        const s = all.find(x => String(x.id) === String(id));
        if (!s) return;
        if (s.robotCaseId) {
            if (typeof Modal !== 'undefined' && document.querySelector('.modal-overlay.active')) Modal.close();
            Toast.info(`Ca mổ liên kết Điều phối Robot (${s.robotCaseId}) — vui lòng thực hiện Hoãn mổ / Xuất viện chờ / Xóa tại Tab Điều phối Robot.`);
            if (typeof RobotSchedulePage !== 'undefined') {
                RobotSchedulePage.openFromWeeklySchedule(s.robotCaseId);
            }
            return;
        }
        const targetWeekKey = s.date ? s.date.substring(0, 10) : this.getWeekKey();
        if (!canEditSurgery(targetWeekKey)) { Toast.show('🔒 Tuần này đã bị khoá. Không thể chỉnh sửa.', 'error'); return; }

        const confirmed = await Confirm.show({
            title: 'Hủy / Xóa ca mổ',
            message: `Bạn có chắc chắn muốn hủy ca mổ của BN <strong>${Utils.toProperCase(s.patientName)}</strong>?<br>Ca mổ sẽ được chuyển vào <strong>Thùng rác</strong> và tự động xóa vĩnh viễn sau 7 ngày (có thể hoàn tác khôi phục).`,
            icon: '🗑️',
            type: 'danger',
            confirmText: 'Chuyển vào thùng rác',
            cancelText: 'Giữ lại'
        });
        if (!confirmed) return;

        try {
            const res = await this._callAtomicTrashEndpoint(`/api/surgeries/${encodeURIComponent(id)}/trash`, 'POST');
            const nextSurgeries = all.filter(x => String(x.id) !== String(id));
            const nextTrash = (Store._data.surgeriesTrash || []).filter(x => String(x.id) !== String(id));
            if (res.trashed) nextTrash.push(res.trashed);
            Store._data.surgeries = nextSurgeries;
            Store._data.surgeriesTrash = nextTrash;
            if (Store._serverSyncedData) {
                Store._serverSyncedData.surgeries = Store._clone(nextSurgeries);
                Store._serverSyncedData.surgeriesTrash = Store._clone(nextTrash);
            }
            Store._saveLocal();

            if (typeof Modal !== 'undefined' && document.querySelector('.modal-overlay')) Modal.close();
            App.renderCurrentPage();
            Toast.success(`Đã chuyển ca mổ của BN <strong>${Utils.toProperCase(s.patientName)}</strong> vào Thùng rác <button class="btn btn-sm btn-secondary" style="margin-left:8px;padding:2px 8px;font-size:0.75rem;" onclick="SurgeryPage.restoreSurgery('${s.id}')">↺ Hoàn tác ngay</button>`);
        } catch (err) {
            Toast.error('Không thể chuyển vào thùng rác: ' + err.message);
        }
    },

    openTrashModal() {
        const trash = Store.cleanSurgeriesTrash(7);
        if (trash.length === 0) {
            Modal.open('🗑️ Thùng rác ca mổ đã hủy', `
                <div class="empty-state" style="padding:40px;text-align:center;">
                    <div style="font-size:3rem;margin-bottom:12px;">🗑️</div>
                    <h3 style="margin-bottom:8px;">Thùng rác trống</h3>
                    <p class="text-secondary" style="font-size:0.9rem;">Không có ca mổ nào bị hủy trong vòng 7 ngày qua.</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="Modal.close()">Đóng</button>
                </div>
            `);
            return;
        }

        const rowsHtml = trash.map(s => {
            const dateFmt = Utils.formatDate(s.date);
            const delDateFmt = s.deletedAt ? new Date(s.deletedAt).toLocaleString('vi-VN') : '—';
            const mainSurgeonName = s.mainSurgeon ? Store.getStaffName(s.mainSurgeon) : '—';
            const assistSurgeonName = s.assistSurgeon1 ? Store.getStaffName(s.assistSurgeon1) : '';
            const staffInfo = [mainSurgeonName, assistSurgeonName].filter(x => x && x !== '—').join(' & ');
            const delUser = (typeof s.deletedBy === 'string' ? s.deletedBy : s.deletedBy?.name) || 'NĐT';

            return `
                <tr>
                    <td><strong>${dateFmt}</strong></td>
                    <td>
                        <div style="font-weight:600;">${Utils.toProperCase(s.patientName || 'Chưa tên')}</div>
                        <div class="text-secondary" style="font-size:0.75rem;">${s.birthYear || ''} ${s.admissionId ? `• ${s.admissionId}` : ''}</div>
                    </td>
                    <td>
                        <div style="font-size:0.85rem;">${s.diagnosis || '—'}</div>
                        <div class="text-secondary" style="font-size:0.75rem;">${s.method || '—'}</div>
                    </td>
                    <td style="font-size:0.85rem;">${staffInfo || '—'}</td>
                    <td>
                        <div style="font-size:0.78rem;">${delDateFmt}</div>
                        <div class="text-secondary" style="font-size:0.72rem;">Bởi: ${delUser}</div>
                    </td>
                    <td style="text-align:right;white-space:nowrap;">
                        <button class="btn btn-secondary btn-sm" onclick="SurgeryPage.restoreSurgery('${s.id}')" title="Hoàn tác khôi phục ca mổ">
                            ↺ Hoàn tác
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="SurgeryPage.permanentlyDeleteSurgery('${s.id}')" title="Xóa vĩnh viễn" style="margin-left:4px;">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        Modal.open('🗑️ Thùng rác ca mổ đã hủy (Lưu giữ 7 ngày)', `
            <div style="margin-bottom:12px;font-size:0.85rem;" class="text-secondary">
                💡 Các ca mổ bị hủy được lưu tại đây trong <strong>7 ngày</strong>. Bạn có thể bấm <strong>Hoàn tác</strong> để đưa ca mổ trở lại Lịch mổ. Sau 7 ngày hệ thống sẽ tự động xóa vĩnh viễn.
            </div>
            <div style="max-height:420px;overflow-y:auto;">
                <table class="table" style="width:100%;font-size:0.85rem;">
                    <thead>
                        <tr>
                            <th>Ngày mổ</th>
                            <th>Bệnh nhân</th>
                            <th>Chẩn đoán & PT</th>
                            <th>Kíp mổ</th>
                            <th>Thời gian hủy</th>
                            <th style="text-align:right;">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
            <div class="modal-footer" style="margin-top:16px;">
                <button class="btn btn-secondary" onclick="Modal.close()">Đóng</button>
            </div>
        `);
    },

    async restoreSurgery(id) {
        const trash = Store.cleanSurgeriesTrash(14);
        const item = trash.find(x => String(x.id) === String(id));
        if (!item) return;
        if (item.robotCaseId) {
            if (typeof Modal !== 'undefined' && document.querySelector('.modal-overlay.active')) Modal.close();
            Toast.info(`Ca mổ Robot (${item.robotCaseId}) cần xếp lịch lại qua Tab Điều phối Robot.`);
            if (typeof RobotSchedulePage !== 'undefined') {
                RobotSchedulePage.openFromWeeklySchedule(item.robotCaseId);
            }
            return;
        }

        try {
            const res = await this._callAtomicTrashEndpoint(`/api/surgeries/${encodeURIComponent(id)}/restore`, 'POST');
            const newTrash = (Store._data.surgeriesTrash || []).filter(x => String(x.id) !== String(id));
            const allSurgeries = this.getAllSurgeries().filter(x => String(x.id) !== String(id));
            if (res.restored) allSurgeries.push(res.restored);
            Store._data.surgeriesTrash = newTrash;
            Store._data.surgeries = allSurgeries;
            if (Store._serverSyncedData) {
                Store._serverSyncedData.surgeriesTrash = Store._clone(newTrash);
                Store._serverSyncedData.surgeries = Store._clone(allSurgeries);
            }
            Store._saveLocal();

            Toast.success(`Đã hoàn tác khôi phục ca mổ của BN <strong>${Utils.toProperCase(item.patientName)}</strong>`);
            Modal.close();
            App.renderCurrentPage();
        } catch (err) {
            Toast.error('Không thể khôi phục ca mổ: ' + err.message);
        }
    },

    async permanentlyDeleteSurgery(id) {
        const trash = Store.cleanSurgeriesTrash(14);
        const item = trash.find(x => String(x.id) === String(id));
        if (!item) return;
        if (item.robotCaseId) {
            Toast.warning(`Ca mổ Robot (${item.robotCaseId}) được bảo vệ theo quy tắc Zero-RM — vui lòng xử lý tại Tab Điều phối Robot.`);
            if (typeof Modal !== 'undefined' && document.querySelector('.modal-overlay.active')) Modal.close();
            if (typeof RobotSchedulePage !== 'undefined') {
                RobotSchedulePage.openFromWeeklySchedule(item.robotCaseId);
            }
            return;
        }

        const confirmed = await Confirm.show({
            title: 'Xóa vĩnh viễn ca mổ',
            message: `Bạn có chắc chắn muốn XÓA VĨNH VIỄN ca mổ của BN <strong>${Utils.toProperCase(item.patientName)}</strong>?<br>Hành động này <strong>không thể hoàn tác</strong>.`,
            icon: '🗑️',
            type: 'danger',
            confirmText: 'Xóa vĩnh viễn',
            cancelText: 'Giữ lại trong thùng rác'
        });
        if (!confirmed) return;

        try {
            await this._callAtomicTrashEndpoint(`/api/surgeries-trash/${encodeURIComponent(id)}`, 'DELETE');
            const newTrash = (Store._data.surgeriesTrash || []).filter(x => String(x.id) !== String(id));
            Store._data.surgeriesTrash = newTrash;
            if (Store._serverSyncedData) {
                Store._serverSyncedData.surgeriesTrash = Store._clone(newTrash);
            }
            Store._saveLocal();
            Toast.success('Đã xóa vĩnh viễn ca mổ khỏi thùng rác');
            this.openTrashModal();
            App.renderCurrentPage();
        } catch (err) {
            Toast.error('Không thể xóa vĩnh viễn: ' + err.message);
        }
    },

    // Auto-select approach when surgery type changes (allows Robot approach under any surgeryType!)
    _onSurgeryTypeChange(sel) {
        const approach = document.getElementById('surgery-approach');
        if (!approach) return;
        if (sel.value === 'robot') {
            approach.value = 'robot';
            approach.disabled = true;
        } else {
            const form = sel.closest('form');
            const isLocked = Boolean(form && form.querySelector('.rbt-dirty-banner'));
            if (!isLocked) approach.disabled = false;
        }
        this._syncSegmentedControls();
        this._updateColumnHint();
    },

    afterRender() { },

    // ===== EXPORT SURGERY LIST AS JPEG =====
    exportTomorrowImage() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        this._exportImageForDate(tomorrow);
    },

    exportCustomDateImage() {
        // Show a modal with date picker
        Modal.open('Xuất lịch mổ theo ngày', `
            <div class="export-date-section">
                <label class="form-label">Chọn ngày cần xuất:</label>
                <input class="form-input" type="date" id="export-date-picker" value="${new Date().toISOString().split('T')[0]}" style="font-size:16px;padding:10px">
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                <button type="button" class="btn btn-primary" onclick="SurgeryPage._doCustomExport()">Xuất JPEG</button>
            </div>
        `);
    },

    _doCustomExport() {
        const val = document.getElementById('export-date-picker')?.value;
        if (!val) return;
        const parts = val.split('-');
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        d.setHours(0, 0, 0, 0);
        Modal.close();
        this._exportImageForDate(d);
    },

    async _exportImageForDate(targetDate) {
        const ds = this.dateStr(targetDate);
        const surgeries = this.getAllSurgeries();
        const todaySurgeries = sortSurgeries(surgeries.filter(s => !s.isTestSandboxCase && s.date === ds), targetDate);

        const dateLabel = `${targetDate.getDate()}/${targetDate.getMonth() + 1}/${targetDate.getFullYear()}`;
        const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
        const dayName = dayNames[targetDate.getDay()];

        // Count by type
        const typeCounts = {};
        Object.keys(SURGERY_TYPES).forEach(k => { typeCounts[k] = todaySurgeries.filter(s => s.surgeryType === k).length; });

        // Build surgery rows - complete info
        const showApproval = typeof SurgeryApprovalPage !== 'undefined' && SurgeryApprovalPage.isFeatureVisibleForCurrentUser() && SurgeryApprovalPage.getConfig().sandboxOnlyMode === false;
        const totalCols = showApproval ? 10 : 9;
        let rows = '';
        if (todaySurgeries.length === 0) {
            rows = `<tr><td colspan="${totalCols}" style="text-align:center;padding:24px;color:#333;font-style:italic;font-size:14px">Không có ca mổ hôm nay</td></tr>`;
        } else {
            todaySurgeries.forEach((s, i) => {
                const typeInfo = SURGERY_TYPES[s.surgeryType] || SURGERY_TYPES.chuongtrinh;
                const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';
                const approvalMeta = showApproval ? SurgeryApprovalPage.getScheduleShortBadgeMeta(s) : null;
                const approvalCellHtml = showApproval
                    ? `<td style="padding:12px 8px;text-align:center;font-size:13px;font-weight:700;color:${approvalMeta && approvalMeta.isGreenTickValid ? '#14532d' : '#1e293b'};white-space:nowrap">${approvalMeta && approvalMeta.shortLabel ? Utils.escapeHtml(approvalMeta.icon + ' ' + approvalMeta.shortLabel) : '—'}</td>`
                    : '';
                rows += `<tr style="background:${bgColor};border-bottom:1px solid #cbd5e1">
                    <td style="padding:12px 10px;text-align:center;font-weight:700;color:#000;font-size:14px">${i + 1}</td>
                    <td style="padding:12px 10px;font-size:14px"><strong style="color:#000">${Utils.toProperCase(s.patientName)}</strong></td>
                    <td style="padding:12px 10px;text-align:center;font-size:13px;color:#111">${s.birthYear || '—'}</td>
                    <td style="padding:12px 10px;font-size:13px;color:#111">${s.admissionId || '—'}</td>
                    <td style="padding:12px 10px;font-size:13px;color:#0a1628;font-weight:600">${s.diagnosis || '—'}</td>
                    <td style="padding:12px 10px;font-size:13px;color:#111;font-style:italic">${s.method || '—'}</td>
                    <td style="padding:12px 10px;text-align:center"><span style="background:${typeInfo.color};color:${typeInfo.onColor};padding:4px 12px;border-radius:12px;font-size:12px;font-weight:700;white-space:nowrap">${typeInfo.label}</span></td>
                    <td style="padding:12px 10px;font-size:13px;color:#111">${Utils.getStaffName(s.mainSurgeon) || '—'}${s.assistSurgeon1 ? '<br><span style="color:#333;font-size:12px">Phụ: ' + Utils.getStaffName(s.assistSurgeon1) + '</span>' : ''}</td>
                    <td style="padding:12px 10px;text-align:center;font-size:13px;color:#000;font-weight:600">${s.duration ? s.duration + 'p' : '—'}</td>
                    ${approvalCellHtml}
                </tr>`;
                // Notes row if exists
                if (s.notes) {
                    rows += `<tr style="background:${bgColor};border-bottom:1px solid #cbd5e1">
                        <td style="padding:0"></td>
                        <td colspan="${totalCols - 1}" style="padding:0 10px 10px;font-size:12px;color:#333"><em>📝 ${s.notes}</em></td>
                    </tr>`;
                }
            });
        }

        // Type summary chips
        let typeChips = '';
        Object.entries(SURGERY_TYPES).forEach(([key, t]) => {
            if (typeCounts[key] > 0) {
                typeChips += `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:16px;font-size:13px;color:#000;font-weight:700">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${t.color}"></span>
                    ${t.label}: <strong>${typeCounts[key]}</strong>
                </span>`;
            }
        });

        const exportWidthPx = showApproval ? 1220 : 1100;
        const scopeLegendText = showApproval ? 'Chú giải (Duyệt nội bộ Khoa = Bước 01–04 toàn viện, độc lập HIS): ✅ Đã duyệt · ⏳ Chờ duyệt · 📝 Chưa trình · ↩️ Trả về · ⏸️ Tạm hoãn · ⚡ Ngoại lệ' : '';
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
        container.innerHTML = `
        <div id="surgery-export-target" style="width:${exportWidthPx}px;padding:0;background:#fff;font-family:'Be Vietnam Pro','Noto Sans',-apple-system,BlinkMacSystemFont,sans-serif;color:#0f172a;">
            <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&family=Noto+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
            <!-- Header with dark navy background for high contrast -->
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:24px 36px;display:flex;justify-content:space-between;align-items:center">
                <div>
                    <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:normal">KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG</div>
                    <div style="font-size:14px;color:#cbd5e1;margin-top:3px">Bệnh viện Bình Dân</div>
                </div>
                <div style="text-align:right">
                    <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:normal">LỊCH MỔ NGÀY ${dateLabel}</div>
                    <div style="font-size:14px;color:#67e8f9;font-weight:600">${dayName}</div>
                </div>
            </div>

            <!-- Summary bar -->
            <div style="padding:14px 36px;background:#f0f9ff;border-bottom:2px solid #bae6fd;display:flex;justify-content:space-between;align-items:center">
                <div style="font-size:15px;font-weight:800;color:#000">
                    📋 Tổng số: ${todaySurgeries.length} ca phẫu thuật
                </div>
                <div>${typeChips}</div>
            </div>

            <!-- Table -->
            <div style="padding:0 36px 20px">
                <table style="width:100%;border-collapse:collapse;margin-top:16px">
                    <thead>
                        <tr style="background:#0f172a">
                            <th style="padding:12px 10px;text-align:center;color:#f1f5f9;font-size:13px;font-weight:700;width:36px">STT</th>
                            <th style="padding:12px 10px;text-align:left;color:#f1f5f9;font-size:13px;font-weight:700;min-width:110px">BỆNH NHÂN</th>
                            <th style="padding:12px 10px;text-align:center;color:#f1f5f9;font-size:13px;font-weight:700;width:46px">NS</th>
                            <th style="padding:12px 10px;text-align:left;color:#f1f5f9;font-size:13px;font-weight:700;width:82px">SỐ NV</th>
                            <th style="padding:12px 10px;text-align:left;color:#f1f5f9;font-size:13px;font-weight:700">CHẨN ĐOÁN</th>
                            <th style="padding:12px 10px;text-align:left;color:#f1f5f9;font-size:13px;font-weight:700">PHƯƠNG PHÁP PT</th>
                            <th style="padding:12px 10px;text-align:center;color:#f1f5f9;font-size:13px;font-weight:700;width:85px">LOẠI</th>
                            <th style="padding:12px 10px;text-align:left;color:#f1f5f9;font-size:13px;font-weight:700;min-width:110px">Ê-KÍP MỔ</th>
                            <th style="padding:12px 10px;text-align:center;color:#f1f5f9;font-size:13px;font-weight:700;width:46px">TG</th>
                            ${showApproval ? `<th style="padding:12px 8px;text-align:center;color:#f1f5f9;font-size:13px;font-weight:700;width:130px">DUYỆT KHOA</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>

            ${showApproval ? `<div style="padding:8px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11.5px;color:#334155;font-weight:600;">${Utils.escapeHtml(scopeLegendText)}</div>` : ''}

            <!-- Footer -->
            <div style="padding:12px 36px;border-top:2px solid #cbd5e1;display:flex;justify-content:space-between;font-size:12px;color:#333;background:#f8fafc">
                <span>Xuất bởi: ${Auth.getSession()?.name || Auth.getSession()?.username || 'Hệ thống'}</span>
                <span>Xuất lúc ${new Date().toLocaleTimeString('vi-VN')} ngày ${dateLabel}</span>
            </div>
        </div>`;
        document.body.appendChild(container);

        const target = container.querySelector('#surgery-export-target');
        await Utils.loadScript('html2canvas');

        // 2K export: tính scale động để output luôn ≥ 2560px wide bất kể số ca
        const TEMPLATE_WIDTH = exportWidthPx;   // px lógic của template
        const TARGET_2K_WIDTH = 2560;  // độ phân giải 2K (2560 × ?) 
        const minScale = Math.ceil(TARGET_2K_WIDTH / TEMPLATE_WIDTH); // = 3 (2640px)
        const EXPORT_SCALE = Math.max(minScale, 3); // luôn ≥ 3 → ≥ 2640px

        html2canvas(target, {
            scale: EXPORT_SCALE,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            letterRendering: true,       // render từng ký tự riêng — text sắc nét hơn
            allowTaint: false,
            imageTimeout: 15000,
        }).then(canvasEl => {
            Utils.applyExportWatermark(canvasEl);

            // Xuất PNG (lossless) thay JPEG — không bị artifact nén làm nhòe text
            canvasEl.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Lich_mo_${ds.replace(/-/g, '')}.png`;  // PNG thay JPG
                a.click();
                URL.revokeObjectURL(url);
                document.body.removeChild(container);
                Toast.success(`Đã xuất hình lịch mổ (${EXPORT_SCALE}x — ${canvasEl.width}×${canvasEl.height}px)!`);
            }, 'image/png');  // PNG: lossless, không nhòe
        }).catch(err => {
            console.error('Export failed:', err);
            Toast.error('Không thể xuất ảnh. Vui lòng thử lại.');
            document.body.removeChild(container);
        });
    },

    // ===== FEAT-241: MOBILE TOOLS & CARD SHEETS =====
    openMobileToolsSheet() {
        const weekKey = this.getWeekKey();
        const canEdit = canEditSurgery(weekKey);
        const showApproval = typeof SurgeryApprovalPage !== 'undefined' && SurgeryApprovalPage.isFeatureVisibleForCurrentUser();
        const canSandbox = this.canUseSandboxSchedule();
        const hasSandboxCases = (Store._data?.surgeries || []).some(s => s.isTestSandboxCase);
        const trashCount = Store.cleanSurgeriesTrash(7).length;
        Modal.open('Tiện ích Lịch mổ tuần', `
            <div class="surg-sheet-actions">
                ${showApproval ? `
                <button type="button" class="surg-sheet-btn" onclick="Modal.close();App.navigate('surgery-approval')">
                    <span>📋 Duyệt mổ tại khoa</span><span>Mở tab</span>
                </button>` : ''}
                <button type="button" class="surg-sheet-btn" onclick="Modal.close();SurgeryPage.exportTomorrowImage()">
                    <span>📷 Xuất danh sách ngày mai</span><span>PNG 2K</span>
                </button>
                <button type="button" class="surg-sheet-btn" onclick="Modal.close();SurgeryPage.exportCustomDateImage()">
                    <span>📅 Xuất lịch mổ theo ngày</span><span>Chọn ngày</span>
                </button>
                <button type="button" class="surg-sheet-btn" onclick="Modal.close();SurgeryPage.openTrashModal()">
                    <span>🗑️ Thùng rác ca mổ đã hủy</span><span>${trashCount} ca</span>
                </button>
                ${canSandbox && hasSandboxCases ? `
                <button type="button" class="surg-sheet-btn ${this._showSandboxOnSchedule ? 'is-active' : ''}" onclick="Modal.close();SurgeryPage.toggleSandboxSchedulePreview()">
                    <span>${this._showSandboxOnSchedule ? '🙈 Ẩn ca [TEST]' : '🧪 Xem ca [TEST] trên lịch'}</span><span>Sandbox</span>
                </button>` : ''}
                ${canEdit && canSandbox ? `
                <button type="button" class="surg-sheet-btn" onclick="Modal.close();SurgeryPage.openForm(0, null, { sandbox: true })">
                    <span>🧪 Tạo ca giả lập duyệt mổ</span><span>Demo</span>
                </button>` : ''}
            </div>
        `);
    },

    openMobileCardSheet(id) {
        const s = this.getAllSurgeries().find(x => Number(x.id) === Number(id));
        if (!s) return;
        const weekKey = this.getWeekKey();
        const canEdit = canEditSurgery(weekKey);
        const showApproval = typeof SurgeryApprovalPage !== 'undefined'
            && SurgeryApprovalPage.isFeatureVisibleForCurrentUser()
            && SurgeryApprovalPage.isCaseApprovalEnabled(s)
            && s.approachType !== 'nsth';
        Modal.open(`${Utils.toProperCase(s.patientName || 'Ca phẫu thuật')}`, `
            <div class="surg-sheet-actions">
                <button type="button" class="surg-sheet-btn" onclick="Modal.close();SurgeryPage.viewDetail(${s.id})">
                    <span>🔍 Xem chi tiết ca mổ</span><span>Chi tiết</span>
                </button>
                ${showApproval ? `
                <button type="button" class="surg-sheet-btn" onclick="Modal.close();SurgeryApprovalPage.openCaseModal(${s.id})">
                    <span>🩺 Mở hồ sơ duyệt mổ khoa</span><span>Duyệt mổ</span>
                </button>` : ''}
                ${canEdit ? `
                <button type="button" class="surg-sheet-btn" onclick="Modal.close();SurgeryPage.openForm(${s.id})">
                    <span>✏️ Sửa thông tin ca mổ</span><span>Chỉnh sửa</span>
                </button>
                <button type="button" class="surg-sheet-btn is-danger" onclick="Modal.close();SurgeryPage.deleteSurgery(${s.id})">
                    <span>🗑️ Đưa vào thùng rác</span><span>Xoá</span>
                </button>` : ''}
            </div>
        `);
    }
};
