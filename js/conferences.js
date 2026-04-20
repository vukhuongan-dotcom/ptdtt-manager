// ===== CONFERENCES PAGE =====
const CONF_REGIONS = {
    international: { label: 'Quốc tế', icon: '🌍', badgeClass: 'conf-badge-intl' },
    domestic: { label: 'Trong nước', icon: '🇻🇳', badgeClass: 'conf-badge-domestic' },
    asean: { label: 'ASEAN', icon: '🌏', badgeClass: 'conf-badge-asean' }
};

const CONF_CATEGORIES = {
    colorectal: { label: 'Đại trực tràng', badgeClass: 'conf-badge-colorectal' },
    'gi-surgery': { label: 'Ngoại Tiêu hoá', badgeClass: 'conf-badge-gi' },
    gastro: { label: 'Tiêu hoá', badgeClass: 'conf-badge-gastro' },
    'surgical-oncology': { label: 'Ngoại Ung bướu', badgeClass: 'conf-badge-onco' },
    other: { label: 'Khác', badgeClass: 'conf-badge-other' }
};

const CONF_SEED_DATA = [
    {
        name: "Coloproctology 2026 / 13th ASEAN CRS Congress",
        nameVi: "Đại hội Hậu môn Trực tràng 2026 / Hội nghị ASEAN CRS lần 13",
        dates: "24–26/04/2026",
        startDate: "2026-04-24",
        endDate: "2026-04-26",
        location: "Penang, Malaysia",
        region: "asean",
        category: "colorectal",
        organizer: "Malaysian Society of Colorectal Surgeons & ASEAN CRS",
        website: "https://colorectalmy.org/coloproctology2026/",
        note: "",
        deadlines: ""
    },
    {
        name: "Digestive Disease Week (DDW) 2026",
        nameVi: "Tuần lễ Bệnh Tiêu hoá 2026",
        dates: "02–05/05/2026",
        startDate: "2026-05-02",
        endDate: "2026-05-05",
        location: "Chicago, IL, USA",
        region: "international",
        category: "gastro",
        organizer: "AASLD & partner societies",
        website: "https://ddw.org",
        note: "Hội nghị tiêu hoá lớn nhất thế giới",
        deadlines: ""
    },
    {
        name: "APAGE IBD Forum 2026",
        nameVi: "Diễn đàn IBD Châu Á – Thái Bình Dương",
        dates: "16–17/07/2026",
        startDate: "2026-07-16",
        endDate: "2026-07-17",
        location: "Bangkok, Thailand",
        region: "asean",
        category: "gastro",
        organizer: "Asia Pacific Association of Gastroenterology",
        website: "https://www.apage.org",
        note: "Chuyên đề bệnh viêm ruột (IBD)",
        deadlines: ""
    },
    {
        name: "ISUCRS 2026 Congress",
        nameVi: "Đại hội Phẫu thuật viên Đại trực tràng Đại học Quốc tế",
        dates: "23–26/07/2026",
        startDate: "2026-07-23",
        endDate: "2026-07-26",
        location: "Kuala Lumpur, Malaysia",
        region: "international",
        category: "colorectal",
        organizer: "International Society of University Colon & Rectal Surgeons",
        website: "https://isucrs2026.com",
        note: "Theme: Innovations and Collaborations in Colorectal Surgery",
        deadlines: ""
    },
    {
        name: "IFSO 29th World Congress",
        nameVi: "Đại hội Thế giới về Phẫu thuật Béo phì lần 29",
        dates: "01–04/09/2026",
        startDate: "2026-09-01",
        endDate: "2026-09-04",
        location: "Toronto, Canada",
        region: "international",
        category: "gi-surgery",
        organizer: "International Federation for the Surgery of Obesity",
        website: "https://ifso2026.org",
        note: "",
        deadlines: ""
    },
    {
        name: "ISDE 22nd World Congress — Esophageal Diseases",
        nameVi: "Đại hội Thế giới Bệnh Thực quản lần 22",
        dates: "16–18/09/2026",
        startDate: "2026-09-16",
        endDate: "2026-09-18",
        location: "Kyoto, Japan",
        region: "international",
        category: "gi-surgery",
        organizer: "International Society for Diseases of the Esophagus",
        website: "https://isde-congress.net",
        note: "",
        deadlines: "Early registration: 11/06/2026"
    },
    {
        name: "ESCP 21st Scientific Meeting",
        nameVi: "Hội nghị Khoa học ESCP lần 21",
        dates: "23–25/09/2026",
        startDate: "2026-09-23",
        endDate: "2026-09-25",
        location: "Prague, Czech Republic",
        region: "international",
        category: "colorectal",
        organizer: "European Society of Coloproctology",
        website: "https://escp.eu.com",
        note: "Hội nghị đại trực tràng hàng đầu châu Âu",
        deadlines: "Abstract: 27/04/2026"
    },
    {
        name: "ACS Clinical Congress 2026",
        nameVi: "Đại hội Lâm sàng Hội Phẫu thuật Hoa Kỳ",
        dates: "26–29/09/2026",
        startDate: "2026-09-26",
        endDate: "2026-09-29",
        location: "Washington, DC, USA",
        region: "international",
        category: "gi-surgery",
        organizer: "American College of Surgeons",
        website: "https://facs.org/clincon2026",
        note: "",
        deadlines: "Submissions: 01/07 – 01/08/2026"
    },
    {
        name: "WCOG 2026 — World Congress of Gastroenterology",
        nameVi: "Đại hội Tiêu hoá Thế giới 2026",
        dates: "30/09–03/10/2026",
        startDate: "2026-09-30",
        endDate: "2026-10-03",
        location: "New Delhi, India",
        region: "international",
        category: "gastro",
        organizer: "APAGE / WGO",
        website: "https://www.apage.org",
        note: "",
        deadlines: ""
    },
    {
        name: "UEG Week 2026",
        nameVi: "Tuần Tiêu hoá Châu Âu 2026",
        dates: "17–20/10/2026",
        startDate: "2026-10-17",
        endDate: "2026-10-20",
        location: "Barcelona, Spain",
        region: "international",
        category: "gastro",
        organizer: "United European Gastroenterology",
        website: "https://ueg.eu/week",
        note: "Hybrid — tham dự online hoặc tại chỗ",
        deadlines: ""
    },
    {
        name: "ESSO 45th Congress — Surgical Oncology Without Borders",
        nameVi: "Đại hội Ngoại Ung bướu Châu Âu lần 45",
        dates: "04–06/11/2026",
        startDate: "2026-11-04",
        endDate: "2026-11-06",
        location: "Madrid, Spain",
        region: "international",
        category: "surgical-oncology",
        organizer: "European Society of Surgical Oncology",
        website: "https://esso45.essoweb.org",
        note: "Theme: Innovations and Challenges Worldwide",
        deadlines: ""
    },
    {
        name: "81st Japan Society of Coloproctology Annual Meeting",
        nameVi: "Hội nghị thường niên Hội Hậu môn Trực tràng Nhật Bản lần 81",
        dates: "20–21/11/2026",
        startDate: "2026-11-20",
        endDate: "2026-11-21",
        location: "Nagasaki, Japan",
        region: "international",
        category: "colorectal",
        organizer: "Japan Society of Coloproctology",
        website: "https://www.coloproctology.gr.jp/modules/en/",
        note: "",
        deadlines: ""
    },
    {
        name: "SAGES Annual Meeting 2027",
        nameVi: "Hội nghị SAGES thường niên 2027",
        dates: "06–09/04/2027",
        startDate: "2027-04-06",
        endDate: "2027-04-09",
        location: "Las Vegas, NV, USA",
        region: "international",
        category: "gi-surgery",
        organizer: "Society of American Gastrointestinal and Endoscopic Surgeons",
        website: "https://sages.org/meetings",
        note: "",
        deadlines: ""
    },
    {
        name: "Hội nghị Phẫu thuật Đại trực tràng Việt Nam 2026",
        nameVi: "",
        dates: "2026 (TBD)",
        startDate: "2026-08-01",
        endDate: "2026-08-01",
        location: "Việt Nam (TBD)",
        region: "domestic",
        category: "colorectal",
        organizer: "Hội Phẫu thuật viên Đại trực tràng Việt Nam",
        website: "https://vscs.com.vn/en",
        note: "Ngày và địa điểm chưa công bố chính thức",
        deadlines: ""
    },
    {
        name: "APFCP 2027 & 15th ASSR Congress",
        nameVi: "Đại hội Liên đoàn Hậu môn TT Châu Á – TBD 2027",
        dates: "16–19/11/2027",
        startDate: "2027-11-16",
        endDate: "2027-11-19",
        location: "Sydney, Australia",
        region: "international",
        category: "colorectal",
        organizer: "Asia Pacific Federation of Coloproctology",
        website: "https://www.apfcp2027.org",
        note: "Ngoài khoảng 1 năm nhưng đáng theo dõi",
        deadlines: ""
    }
];

const ConferencesPage = {
    _filters: { region: 'all', category: 'all', status: 'all' },

    _canEdit() {
        const s = Auth.getSession();
        if (!s) return false;
        if (s.isAdmin) return true;
        const staff = Store.getAll('staff').find(st => st.id === s.staffId);
        if (!staff) return false;
        return staff.role.includes('Bác sĩ chính') || staff.role.includes('Trưởng khoa') || staff.role.includes('Phó trưởng khoa');
    },

    _ensureSeedData() {
        const items = Store.getAll('conferences');
        if (items && items.length > 0) return;
        CONF_SEED_DATA.forEach(d => Store.add('conferences', d));
        console.log('[Conferences] Seeded', CONF_SEED_DATA.length, 'conferences');
    },

    _getStatus(item) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        end.setHours(23, 59, 59, 999);
        if (now > end) return 'past';
        if (now >= start && now <= end) return 'now';
        const diff = Math.ceil((start - now) / 86400000);
        if (diff <= 30) return 'soon';
        return 'upcoming';
    },

    _countdown(item) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        const status = this._getStatus(item);
        if (status === 'past') {
            const daysAgo = Math.ceil((now - end) / 86400000);
            return { text: `Đã qua ${daysAgo} ngày`, cls: 'conf-countdown-past' };
        }
        if (status === 'now') {
            return { text: '🔴 Đang diễn ra', cls: 'conf-countdown-now' };
        }
        const diff = Math.ceil((start - now) / 86400000);
        if (diff <= 30) {
            return { text: `⏰ Còn ${diff} ngày`, cls: 'conf-countdown-soon' };
        }
        return { text: `Còn ${diff} ngày`, cls: '' };
    },

    _monthLabel(dateStr) {
        const d = new Date(dateStr);
        const months = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
            'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
        return `${months[d.getMonth()]} ${d.getFullYear()}`;
    },

    render() {
        this._ensureSeedData();
        const canEdit = this._canEdit();
        const all = Store.getAll('conferences').sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

        // Filter
        let items = all;
        if (this._filters.region !== 'all') items = items.filter(i => i.region === this._filters.region);
        if (this._filters.category !== 'all') items = items.filter(i => i.category === this._filters.category);
        if (this._filters.status !== 'all') {
            items = items.filter(i => {
                const s = this._getStatus(i);
                if (this._filters.status === 'upcoming') return s === 'upcoming' || s === 'soon' || s === 'now';
                return s === this._filters.status;
            });
        }

        // Stats
        const total = all.length;
        const intl = all.filter(i => i.region === 'international').length;
        const domestic = all.filter(i => i.region === 'domestic' || i.region === 'asean').length;
        const soon = all.filter(i => { const s = this._getStatus(i); return s === 'soon' || s === 'now'; }).length;

        // Group by month
        let lastMonth = '';
        const cardsHtml = items.map(item => {
            const status = this._getStatus(item);
            const cd = this._countdown(item);
            const rg = CONF_REGIONS[item.region] || CONF_REGIONS.international;
            const cat = CONF_CATEGORIES[item.category] || CONF_CATEGORIES.other;

            let monthHeader = '';
            const thisMonth = this._monthLabel(item.startDate);
            if (thisMonth !== lastMonth) {
                lastMonth = thisMonth;
                monthHeader = `<div class="conf-month-header"><span class="conf-month-label">📅 ${thisMonth} <span class="conf-month-line"></span></span></div>`;
            }

            const statusBadge = status === 'past' ? `<span class="conf-badge conf-badge-past">Đã qua</span>` :
                status === 'now' ? `<span class="conf-badge conf-badge-now">🔴 Đang diễn ra</span>` :
                    status === 'soon' ? `<span class="conf-badge conf-badge-soon">🔥 Sắp diễn ra</span>` : '';

            return `${monthHeader}
            <div class="conf-card ${status === 'past' ? 'conf-past' : ''} ${status === 'soon' ? 'conf-soon' : ''} ${status === 'now' ? 'conf-now' : ''}" data-region="${item.region}">
                <div class="conf-badges">
                    <span class="conf-badge ${rg.badgeClass}">${rg.icon} ${rg.label}</span>
                    <span class="conf-badge ${cat.badgeClass}">${cat.label}</span>
                    ${statusBadge}
                </div>
                <div class="conf-name">${item.name}</div>
                ${item.nameVi ? `<div class="conf-name-vi">${item.nameVi}</div>` : ''}
                <div class="conf-info">
                    <div class="conf-info-row">
                        <span class="conf-info-icon">📅</span>
                        <span>${item.dates}</span>
                        <span class="conf-countdown ${cd.cls}" style="margin-left:auto;white-space:nowrap">${cd.text}</span>
                    </div>
                    <div class="conf-info-row">
                        <span class="conf-info-icon">📍</span>
                        <span>${item.location}</span>
                    </div>
                    <div class="conf-info-row">
                        <span class="conf-info-icon">🏛️</span>
                        <span>${item.organizer}</span>
                    </div>
                    ${item.website ? `<div class="conf-info-row conf-website">
                        <span class="conf-info-icon">🔗</span>
                        <a href="${item.website}" target="_blank" rel="noopener">${item.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>
                    </div>` : ''}
                    ${item.deadlines ? `<div class="conf-info-row">
                        <span class="conf-info-icon">⏳</span>
                        <span style="color:var(--danger);font-weight:600">${item.deadlines}</span>
                    </div>` : ''}
                    ${item.note ? `<div class="conf-info-row">
                        <span class="conf-info-icon">📝</span>
                        <span style="font-style:italic">${item.note}</span>
                    </div>` : ''}
                </div>
                ${canEdit ? `<div class="conf-actions">
                    <button class="btn btn-secondary btn-sm" onclick="ConferencesPage.openForm(${item.id})" title="Sửa">✏️ Sửa</button>
                    <button class="btn btn-danger btn-sm" onclick="ConferencesPage.deleteItem(${item.id})" title="Xoá">🗑️</button>
                </div>` : ''}
            </div>`;
        }).join('');

        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Hội nghị Đại trực tràng & Ngoại Tiêu hoá</h1>
                <p class="page-subtitle">Lịch hội nghị trong nước & quốc tế · 04/2026 – 04/2027</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                ${canEdit ? `<button class="btn btn-primary" onclick="ConferencesPage.openForm()">
                    ${Utils.plusIcon()} Thêm hội nghị
                </button>` : ''}
            </div>
        </div>

        <!-- Stats -->
        <div class="conf-stats">
            <div class="conf-stat-card"><span class="conf-stat-val">${total}</span><span class="conf-stat-lbl">Tổng cộng</span></div>
            <div class="conf-stat-card conf-stat-intl"><span class="conf-stat-val">${intl}</span><span class="conf-stat-lbl">Quốc tế</span></div>
            <div class="conf-stat-card conf-stat-asean"><span class="conf-stat-val">${domestic}</span><span class="conf-stat-lbl">Trong nước / ASEAN</span></div>
            <div class="conf-stat-card conf-stat-soon"><span class="conf-stat-val">${soon}</span><span class="conf-stat-lbl">Sắp diễn ra</span></div>
        </div>

        <!-- Filters -->
        <div class="conf-filters">
            <div class="conf-filter-group">
                <span class="conf-filter-label">Khu vực:</span>
                <select class="conf-filter-select" id="conf-filter-region" onchange="ConferencesPage.applyFilters()">
                    <option value="all" ${this._filters.region === 'all' ? 'selected' : ''}>Tất cả</option>
                    <option value="international" ${this._filters.region === 'international' ? 'selected' : ''}>🌍 Quốc tế</option>
                    <option value="domestic" ${this._filters.region === 'domestic' ? 'selected' : ''}>🇻🇳 Trong nước</option>
                    <option value="asean" ${this._filters.region === 'asean' ? 'selected' : ''}>🌏 ASEAN</option>
                </select>
            </div>
            <div class="conf-filter-group">
                <span class="conf-filter-label">Chuyên ngành:</span>
                <select class="conf-filter-select" id="conf-filter-category" onchange="ConferencesPage.applyFilters()">
                    <option value="all" ${this._filters.category === 'all' ? 'selected' : ''}>Tất cả</option>
                    <option value="colorectal" ${this._filters.category === 'colorectal' ? 'selected' : ''}>Đại trực tràng</option>
                    <option value="gi-surgery" ${this._filters.category === 'gi-surgery' ? 'selected' : ''}>Ngoại Tiêu hoá</option>
                    <option value="gastro" ${this._filters.category === 'gastro' ? 'selected' : ''}>Tiêu hoá</option>
                    <option value="surgical-oncology" ${this._filters.category === 'surgical-oncology' ? 'selected' : ''}>Ngoại Ung bướu</option>
                </select>
            </div>
            <div class="conf-filter-group">
                <span class="conf-filter-label">Trạng thái:</span>
                <select class="conf-filter-select" id="conf-filter-status" onchange="ConferencesPage.applyFilters()">
                    <option value="all" ${this._filters.status === 'all' ? 'selected' : ''}>Tất cả</option>
                    <option value="upcoming" ${this._filters.status === 'upcoming' ? 'selected' : ''}>Sắp tới</option>
                    <option value="past" ${this._filters.status === 'past' ? 'selected' : ''}>Đã qua</option>
                </select>
            </div>
        </div>

        <!-- Cards grid -->
        ${items.length > 0 ? `<div class="conf-grid">${cardsHtml}</div>` :
                `<div class="conf-empty">
                <div class="conf-empty-icon">🔍</div>
                <div class="conf-empty-text">Không tìm thấy hội nghị phù hợp</div>
            </div>`}
        `;
    },

    applyFilters() {
        this._filters.region = document.getElementById('conf-filter-region')?.value || 'all';
        this._filters.category = document.getElementById('conf-filter-category')?.value || 'all';
        this._filters.status = document.getElementById('conf-filter-status')?.value || 'all';
        App.renderCurrentPage();
    },

    // ===== CRUD =====
    openForm(id) {
        if (!this._canEdit()) return;
        const item = id ? Store.getById('conferences', id) : null;

        Modal.open(item ? 'Sửa hội nghị' : 'Thêm hội nghị', `
            <form onsubmit="ConferencesPage.save(event, ${id || 0})">
                <div class="form-group">
                    <label class="form-label">Tên hội nghị (EN) *</label>
                    <input class="form-input" name="name" required value="${item?.name || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Tên tiếng Việt</label>
                    <input class="form-input" name="nameVi" value="${item?.nameVi || ''}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Ngày bắt đầu *</label>
                        <input class="form-input" type="date" name="startDate" required value="${item?.startDate || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ngày kết thúc *</label>
                        <input class="form-input" type="date" name="endDate" required value="${item?.endDate || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Ngày hiển thị (VD: 23–25/09/2026)</label>
                    <input class="form-input" name="dates" value="${item?.dates || ''}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Khu vực *</label>
                        <select class="form-select" name="region" required>
                            ${Object.entries(CONF_REGIONS).map(([k, v]) => `<option value="${k}" ${item?.region === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Chuyên ngành *</label>
                        <select class="form-select" name="category" required>
                            ${Object.entries(CONF_CATEGORIES).map(([k, v]) => `<option value="${k}" ${item?.category === k ? 'selected' : ''}>${v.label}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Địa điểm *</label>
                    <input class="form-input" name="location" required value="${item?.location || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Tổ chức</label>
                    <input class="form-input" name="organizer" value="${item?.organizer || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Website</label>
                    <input class="form-input" type="url" name="website" value="${item?.website || ''}" placeholder="https://...">
                </div>
                <div class="form-group">
                    <label class="form-label">Deadline quan trọng</label>
                    <input class="form-input" name="deadlines" value="${item?.deadlines || ''}" placeholder="Abstract: dd/mm/yyyy, Early reg: ...">
                </div>
                <div class="form-group">
                    <label class="form-label">Ghi chú</label>
                    <textarea class="form-textarea" name="note" style="min-height:50px">${item?.note || ''}</textarea>
                </div>
                <div class="modal-footer">
                    ${item ? `<button type="button" class="btn btn-danger" onclick="ConferencesPage.deleteItem(${id});Modal.close()">Xoá</button>` : ''}
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">${item ? 'Cập nhật' : 'Thêm'}</button>
                </div>
            </form>
        `);
    },

    save(e, id) {
        if (!this._canEdit()) return;
        e.preventDefault();
        const f = new FormData(e.target);
        const data = {
            name: f.get('name'),
            nameVi: f.get('nameVi') || '',
            startDate: f.get('startDate'),
            endDate: f.get('endDate'),
            dates: f.get('dates') || '',
            location: f.get('location'),
            region: f.get('region'),
            category: f.get('category'),
            organizer: f.get('organizer') || '',
            website: f.get('website') || '',
            deadlines: f.get('deadlines') || '',
            note: f.get('note') || ''
        };

        // Auto-generate dates display if empty
        if (!data.dates && data.startDate && data.endDate) {
            const s = new Date(data.startDate);
            const e2 = new Date(data.endDate);
            const pad = n => String(n).padStart(2, '0');
            if (s.getMonth() === e2.getMonth()) {
                data.dates = `${pad(s.getDate())}–${pad(e2.getDate())}/${pad(s.getMonth() + 1)}/${s.getFullYear()}`;
            } else {
                data.dates = `${pad(s.getDate())}/${pad(s.getMonth() + 1)}–${pad(e2.getDate())}/${pad(e2.getMonth() + 1)}/${s.getFullYear()}`;
            }
        }

        if (id) {
            Store.update('conferences', id, data);
        } else {
            Store.add('conferences', data);
        }

        Modal.close();
        App.renderCurrentPage();
        Toast.success(id ? 'Đã cập nhật hội nghị' : 'Đã thêm hội nghị mới');
    },

    deleteItem(id) {
        if (!this._canEdit()) return;
        if (!confirm('Xoá hội nghị này?')) return;
        Store.remove('conferences', id);
        Modal.close();
        App.renderCurrentPage();
        Toast.success('Đã xoá hội nghị');
    }
};
