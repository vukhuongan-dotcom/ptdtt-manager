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
        deadlines: "",
        presentations: []
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
        deadlines: "",
        presentations: []
    },
    {
        name: "VSCS 2026 & UCSC 2026 — Hội nghị Phẫu thuật Đại trực tràng Việt Nam thường niên",
        nameVi: "Hội nghị Phẫu thuật Đại trực tràng Việt Nam: Phẫu thuật Đại trực tràng trong kỉ nguyên hiện đại",
        dates: "05–06/06/2026",
        startDate: "2026-06-05",
        endDate: "2026-06-06",
        location: "Nha Trang, Khánh Hoà — Khách sạn InterContinental",
        region: "domestic",
        category: "colorectal",
        organizer: "Chi hội Phẫu thuật Đại trực tràng Việt Nam & Bệnh viện Đại học Y Dược TP.HCM",
        website: "https://vscs.com.vn/en",
        note: "",
        deadlines: "",
        presentations: [
            {
                date: "2026-06-05",
                session: "Báo cáo khoa học: Đại trực tràng 1",
                time: "13:00–13:10",
                title: "Ung thư chính giữa đại tràng ngang: Đâu là cách tiếp cận tối ưu?",
                titleEn: "",
                presenter: "BS CKII Phạm Thị Tuyết Minh",
                language: "vi",
                role: "speaker"
            },
            {
                date: "2026-06-05",
                session: "Scientific Session: Colorectal Surgery 2",
                time: "13:00–13:10",
                title: "Low Gastrointestinal Bleeding Due To Meckel's Diverticulum In Adult Patients: A Case Report",
                titleEn: "",
                presenter: "BS Nguyễn Tấn Định",
                language: "en",
                role: "speaker"
            },
            {
                date: "2026-06-05",
                session: "Scientific Session: Colorectal Surgery 2",
                time: "13:10–13:20",
                title: "Surgical Outcomes of Sigmoid Colon–Bladder Fistula Management at Binh Dan Hospital",
                titleEn: "",
                presenter: "BS Phạm Vĩnh Phú",
                language: "en",
                role: "speaker"
            },
            {
                date: "2026-06-05",
                session: "Scientific Session: Colorectal Surgery 2",
                time: "13:20–13:30",
                title: "Early Outcomes of Robot-Assisted Laparoscopic Surgery for Rectal Cancer With or Without Neoadjuvant Therapy",
                titleEn: "",
                presenter: "BS CKII Vũ Khương An",
                language: "en",
                role: "speaker"
            },
            {
                date: "2026-06-05",
                session: "Báo cáo khoa học: Đại trực tràng 3",
                time: "14:45–14:55",
                title: "Kết quả sớm ứng dụng kỹ thuật nối đại trực tràng hai stapler cải tiến trong phẫu thuật nội soi cắt trước",
                titleEn: "",
                presenter: "BS CKII Vũ Ngọc Anh Tuấn",
                language: "vi",
                role: "speaker"
            },
            {
                date: "2026-06-05",
                session: "Colorectal Surgery Video Session",
                time: "15:25–15:35",
                title: "Robot-assisted Low Anterior Resection for Rectal Cancer with side-to-end anastomosis",
                titleEn: "",
                presenter: "BS CKII Nguyễn Phú Hữu",
                language: "en",
                role: "speaker",
                note: "Đồng thời là Chủ tọa phiên Video Session"
            },
            {
                date: "2026-06-05",
                session: "Hội thảo: Nâng cao chăm sóc người bệnh PT Đại trực tràng có lỗ mở ra da",
                time: "16:10–16:40",
                title: "Kết quả chăm sóc viêm da quanh hậu môn nhân tạo mức độ trung bình tại Khoa Phẫu thuật Đại trực tràng Bệnh viện Bình Dân",
                titleEn: "",
                presenter: "CNĐD Nguyễn Thị Ngọc Thùy",
                language: "vi",
                role: "speaker"
            },
            {
                date: "2026-06-06",
                session: "Phiên 1: Điều trị Phẫu thuật Ung thư Đại trực tràng",
                time: "09:00–09:15",
                title: "Kết quả dài hạn của phẫu thuật đại tràng trực tràng bằng robot so với phẫu thuật nội soi thông thường: Kinh nghiệm tại Việt Nam",
                titleEn: "",
                presenter: "BS CKII Nguyễn Phú Hữu",
                language: "vi",
                role: "speaker"
            }
        ]
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
        deadlines: "",
        presentations: []
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
        deadlines: "",
        presentations: []
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
        deadlines: "",
        presentations: []
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
        deadlines: "Early registration: 11/06/2026",
        presentations: []
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
        deadlines: "Abstract: 27/04/2026",
        presentations: []
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
        deadlines: "Submissions: 01/07 – 01/08/2026",
        presentations: []
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
        deadlines: "",
        presentations: []
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
        deadlines: "",
        presentations: []
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
        deadlines: "",
        presentations: []
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
        deadlines: "",
        presentations: []
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
        deadlines: "",
        presentations: []
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
        deadlines: "",
        presentations: []
    }
];

const ConferencesPage = {
    _filters: { region: 'all', category: 'all', status: 'all', time: 'all' },

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

    // ── Time filter helpers ──
    _inThisWeek(item) {
        const now = new Date();
        const day = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        return start <= sunday && end >= monday;
    },
    _inThisMonth(item) {
        const now = new Date();
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        return start <= monthEnd && end >= monthStart;
    },
    _inThisYear(item) {
        const yr = new Date().getFullYear();
        return new Date(item.startDate).getFullYear() === yr ||
               new Date(item.endDate).getFullYear() === yr;
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
        if (this._filters.time === 'week')  items = items.filter(i => this._inThisWeek(i));
        if (this._filters.time === 'month') items = items.filter(i => this._inThisMonth(i));
        if (this._filters.time === 'year')  items = items.filter(i => this._inThisYear(i));

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
            const presentations = item.presentations || [];
            const presCount = presentations.length;

            let monthHeader = '';
            const thisMonth = this._monthLabel(item.startDate);
            if (thisMonth !== lastMonth) {
                lastMonth = thisMonth;
                monthHeader = `<div class="conf-month-header"><span class="conf-month-label">📅 ${thisMonth} <span class="conf-month-line"></span></span></div>`;
            }

            const statusBadge = status === 'past' ? `<span class="conf-badge conf-badge-past">Đã qua</span>` :
                status === 'now' ? `<span class="conf-badge conf-badge-now">🔴 Đang diễn ra</span>` :
                    status === 'soon' ? `<span class="conf-badge conf-badge-soon">🔥 Sắp diễn ra</span>` : '';

            const presBadge = presCount > 0
                ? `<button class="conf-pres-badge" onclick="event.stopPropagation();ConferencesPage.openPresentations(${item.id})" title="Xem bài báo cáo của khoa">
                       🎤 <strong>${presCount}</strong> bài báo cáo
                   </button>`
                : '';

            return `${monthHeader}
            <div class="conf-card ${status === 'past' ? 'conf-past' : ''} ${status === 'soon' ? 'conf-soon' : ''} ${status === 'now' ? 'conf-now' : ''}" data-region="${item.region}">
                <div class="conf-badges">
                    <span class="conf-badge ${rg.badgeClass}">${rg.icon} ${rg.label}</span>
                    <span class="conf-badge ${cat.badgeClass}">${cat.label}</span>
                    ${statusBadge}
                    ${presBadge}
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

        // Time filter tab pills
        const timeTabs = [
            { key: 'all',   label: 'Tất cả' },
            { key: 'week',  label: 'Tuần này' },
            { key: 'month', label: 'Tháng này' },
            { key: 'year',  label: 'Năm này' },
        ].map(t => `<button class="conf-time-tab ${this._filters.time === t.key ? 'active' : ''}"
            onclick="ConferencesPage.setTimeFilter('${t.key}')">${t.label}</button>`).join('');

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

        <!-- Time tabs -->
        <div class="conf-time-tabs">${timeTabs}</div>

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

    setTimeFilter(key) {
        this._filters.time = key;
        App.renderCurrentPage();
    },

    applyFilters() {
        this._filters.region = document.getElementById('conf-filter-region')?.value || 'all';
        this._filters.category = document.getElementById('conf-filter-category')?.value || 'all';
        this._filters.status = document.getElementById('conf-filter-status')?.value || 'all';
        App.renderCurrentPage();
    },

    // ── Presentations modal ──
    openPresentations(id) {
        const item = Store.getById('conferences', id);
        if (!item) return;
        const presentations = item.presentations || [];
        if (!presentations.length) return;

        // Group by date
        const byDate = {};
        presentations.forEach(p => {
            const key = p.date || 'other';
            if (!byDate[key]) byDate[key] = [];
            byDate[key].push(p);
        });

        const fmtDate = d => {
            if (!d || d === 'other') return 'Không rõ ngày';
            const dt = new Date(d);
            const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
            return `${days[dt.getDay()]}, ${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}/${dt.getFullYear()}`;
        };

        const contentHtml = Object.keys(byDate).sort().map(date => {
            const dayPres = byDate[date].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
            const rows = dayPres.map(p => `
                <div class="conf-pres-item">
                    <div class="conf-pres-meta">
                        <span class="conf-pres-time">⏰ ${p.time || '—'}</span>
                        <span class="conf-pres-session">📋 ${p.session || ''}</span>
                        ${p.language === 'en'
                            ? '<span class="conf-pres-lang conf-pres-lang-en">EN</span>'
                            : '<span class="conf-pres-lang conf-pres-lang-vi">VI</span>'}
                    </div>
                    <div class="conf-pres-title">${p.title}</div>
                    <div class="conf-pres-presenter">🎤 ${p.presenter}</div>
                    ${p.note ? `<div class="conf-pres-note">📝 ${p.note}</div>` : ''}
                </div>`).join('');

            return `
                <div class="conf-pres-day">
                    <div class="conf-pres-day-header">📅 ${fmtDate(date)}</div>
                    ${rows}
                </div>`;
        }).join('');

        Modal.open(`🎤 Bài báo cáo của khoa — ${item.name}`, `
            <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:16px">
                ${presentations.length} bài báo cáo · ${item.location}
            </div>
            <div class="conf-pres-list">${contentHtml}</div>
        `);
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
        const existing = id ? Store.getById('conferences', id) : null;
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
            note: f.get('note') || '',
            presentations: existing?.presentations || []  // preserve existing presentations
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
