// ===== CONFERENCES PAGE — Thống kê báo cáo khoa học Khoa PTĐTT =====

const CONF_REGIONS = {
    international: { label: 'Quốc tế', icon: '🌍' },
    domestic:      { label: 'Trong nước', icon: '🇻🇳' },
    asean:         { label: 'ASEAN', icon: '🌏' }
};

// Chỉ lưu hội nghị mà khoa có báo cáo
const CONF_SEED_DATA = [
    {
        name: "VSCS 2026 & UCSC 2026",
        nameVi: "Hội nghị Phẫu thuật Đại trực tràng Việt Nam: Phẫu thuật Đại trực tràng trong kỉ nguyên hiện đại",
        dates: "05–06/06/2026",
        startDate: "2026-06-05",
        endDate: "2026-06-06",
        location: "Nha Trang, Khánh Hoà",
        venue: "Khách sạn InterContinental Nha Trang",
        region: "domestic",
        organizer: "Chi hội PT Đại trực tràng Việt Nam & BV Đại học Y Dược TP.HCM",
        website: "https://vscs.com.vn/en",
        note: "",
        presentations: [
            {
                date: "2026-06-05",
                session: "Báo cáo khoa học: Đại trực tràng 1",
                time: "13:00–13:10",
                title: "Ung thư chính giữa đại tràng ngang: Đâu là cách tiếp cận tối ưu?",
                presenter: "BS CKII Phạm Thị Tuyết Minh",
                language: "vi",
                note: ""
            },
            {
                date: "2026-06-05",
                session: "Scientific Session: Colorectal Surgery 2",
                time: "13:00–13:10",
                title: "Low Gastrointestinal Bleeding Due To Meckel's Diverticulum In Adult Patients: A Case Report",
                presenter: "BS Nguyễn Tấn Định",
                language: "en",
                note: ""
            },
            {
                date: "2026-06-05",
                session: "Scientific Session: Colorectal Surgery 2",
                time: "13:10–13:20",
                title: "Surgical Outcomes of Sigmoid Colon–Bladder Fistula Management at Binh Dan Hospital",
                presenter: "BS Phạm Vĩnh Phú",
                language: "en",
                note: ""
            },
            {
                date: "2026-06-05",
                session: "Scientific Session: Colorectal Surgery 2",
                time: "13:20–13:30",
                title: "Early Outcomes of Robot-Assisted Laparoscopic Surgery for Rectal Cancer With or Without Neoadjuvant Therapy",
                presenter: "BS CKII Vũ Khương An",
                language: "en",
                note: ""
            },
            {
                date: "2026-06-05",
                session: "Báo cáo khoa học: Đại trực tràng 3",
                time: "14:45–14:55",
                title: "Kết quả sớm ứng dụng kỹ thuật nối đại trực tràng hai stapler cải tiến trong phẫu thuật nội soi cắt trước",
                presenter: "BS CKII Vũ Ngọc Anh Tuấn",
                language: "vi",
                note: ""
            },
            {
                date: "2026-06-05",
                session: "Colorectal Surgery Video Session",
                time: "15:25–15:35",
                title: "Robot-assisted Low Anterior Resection for Rectal Cancer with side-to-end anastomosis",
                presenter: "BS CKII Nguyễn Phú Hữu",
                language: "en",
                note: "Đồng thời là Chủ tọa phiên Video Session"
            },
            {
                date: "2026-06-05",
                session: "Hội thảo: Nâng cao chăm sóc người bệnh PT Đại trực tràng có lỗ mở ra da",
                time: "16:10–16:40",
                title: "Kết quả chăm sóc viêm da quanh hậu môn nhân tạo mức độ trung bình tại Khoa PTĐTT Bệnh viện Bình Dân",
                presenter: "CNĐD Nguyễn Thị Ngọc Thùy",
                language: "vi",
                note: ""
            },
            {
                date: "2026-06-06",
                session: "Phiên 1: Điều trị Phẫu thuật Ung thư Đại trực tràng",
                time: "09:00–09:15",
                title: "Kết quả dài hạn của phẫu thuật đại tràng trực tràng bằng robot so với phẫu thuật nội soi thông thường: Kinh nghiệm tại Việt Nam",
                presenter: "BS CKII Nguyễn Phú Hữu",
                language: "vi",
                note: ""
            }
        ]
    }
];

const ConferencesPage = {
    _filterYear: 'all',   // 'all' | '2026' | '2027' | ...

    _canEdit() {
        const s = Auth.getSession();
        if (!s) return false;
        return s.isAdmin === true;
    },

    // Mọi user đăng nhập đều xuất được ảnh
    _canExport() {
        return !!Auth.getSession();
    },

    _ensureSeedData() {
        const items = Store.getAll('conferences');
        // Only seed if completely empty
        if (items && items.length > 0) return;
        CONF_SEED_DATA.forEach(d => Store.add('conferences', d));
        console.log('[Conferences] Seeded', CONF_SEED_DATA.length, 'conferences');
    },

    _getStatus(item) {
        const now = new Date(); now.setHours(0,0,0,0);
        const start = new Date(item.startDate);
        const end   = new Date(item.endDate); end.setHours(23,59,59,999);
        if (now > end)               return 'past';
        if (now >= start && now <= end) return 'now';
        const diff = Math.ceil((start - now) / 86400000);
        return diff <= 30 ? 'soon' : 'upcoming';
    },

    _countdown(item) {
        const now = new Date(); now.setHours(0,0,0,0);
        const start = new Date(item.startDate);
        const end   = new Date(item.endDate);
        const status = this._getStatus(item);
        if (status === 'past') {
            return { text: `Đã diễn ra`, cls: 'conf-cd-past' };
        }
        if (status === 'now') return { text: '🔴 Đang diễn ra', cls: 'conf-cd-now' };
        const diff = Math.ceil((start - now) / 86400000);
        if (diff <= 30) return { text: `⏰ Còn ${diff} ngày`, cls: 'conf-cd-soon' };
        return { text: `Còn ${diff} ngày`, cls: 'conf-cd-upcoming' };
    },

    // ── Ban chủ nhiệm khoa — thứ tự ưu tiên ──
    _LEADERSHIP_ORDER: [
        { match: 'Nguyễn Phú Hữu',        rank: 0, badge: 'Trưởng khoa' },
        { match: 'Vũ Khương An',           rank: 1, badge: 'Phó trưởng khoa' },
        { match: 'Nguyễn Thị Ngọc Thùy',  rank: 2, badge: 'Điều dưỡng trưởng' }
    ],

    // ── Unique presenters, sorted: leadership first ──
    _uniquePresenters(presentations) {
        return [...new Set(presentations.map(p => p.presenter))];
    },

    _sortedPresenters(presentations) {
        const unique = this._uniquePresenters(presentations);
        const order = this._LEADERSHIP_ORDER;
        return unique.sort((a, b) => {
            const ra = order.find(l => a.includes(l.match));
            const rb = order.find(l => b.includes(l.match));
            if (ra && rb) return ra.rank - rb.rank;
            if (ra) return -1;
            if (rb) return 1;
            return a.localeCompare(b, 'vi');
        });
    },

    // ── Modal: danh sách báo cáo viên thông minh ──
    openPresenterModal(confId) {
        const item = Store.getById('conferences', confId);
        if (!item) return;
        const pres = item.presentations || [];
        const sorted = this._sortedPresenters(pres);
        const order = this._LEADERSHIP_ORDER;

        // For each presenter: count presentations, collect sessions
        const presMap = {};
        pres.forEach(p => {
            if (!presMap[p.presenter]) presMap[p.presenter] = { count: 0, sessions: [], langs: { en: 0, vi: 0 } };
            presMap[p.presenter].count++;
            presMap[p.presenter].sessions.push({ time: p.time, session: p.session, date: p.date, lang: p.language });
            presMap[p.presenter].langs[p.language]++;
        });

        const fmtDate = d => {
            if (!d) return '';
            const dt = new Date(d);
            return `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}`;
        };

        const rows = sorted.map(name => {
            const info    = presMap[name];
            const leader  = order.find(l => name.includes(l.match));
            const sessions = info.sessions
                .sort((a,b) => (a.date||'').localeCompare(b.date||'') || (a.time||'').localeCompare(b.time||''))
                .map(s => `<div class="cp-pm-session">
                    <span class="cp-pres-time">${fmtDate(s.date)} ${s.time}</span>
                    <span class="cp-pres-lang ${s.lang==='en'?'cp-lang-en':'cp-lang-vi'}">${s.lang.toUpperCase()}</span>
                </div>`).join('');

            return `<div class="cp-pm-row ${leader ? 'cp-pm-leader' : ''}">
                <div class="cp-pm-avatar">${this._presenterInitial(name)}</div>
                <div class="cp-pm-info">
                    <div class="cp-pm-name">${name}</div>
                    <div class="cp-pm-stats">
                        <span>${info.count} bài báo cáo</span>
                        ${info.langs.en > 0 ? `<span class="cp-lang-en cp-lang-count">${info.langs.en} EN</span>` : ''}
                        ${info.langs.vi > 0 ? `<span class="cp-lang-vi cp-lang-count">${info.langs.vi} VI</span>` : ''}
                    </div>
                    <div class="cp-pm-sessions">${sessions}</div>
                </div>
            </div>`;
        }).join('');

        Modal.open(`🎤 Báo cáo viên — ${item.name}`, `
            <div class="cp-pm-subtitle">
                ${sorted.length} báo cáo viên · ${pres.length} bài báo cáo
            </div>
            <div class="cp-pm-list">${rows}</div>
        `);
    },

    _presenterInitial(name) {
        // Lấy chữ cái cuối của họ tên (thường là tên)
        const parts = name.replace(/^(BS|CKII|CKI|CNĐD|ThS|TS|GS|PGS)\s*/gi,'').trim().split(/\s+/);
        return (parts[parts.length - 1] || name)[0].toUpperCase();
    },

    render() {
        this._ensureSeedData();
        const canEdit   = this._canEdit();
        const canExport = this._canExport();

        // Only show conferences WITH presentations
        const all = Store.getAll('conferences')
            .filter(c => c.presentations && c.presentations.length > 0)
            .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')); // newest first

        // Year filter
        const years = [...new Set(all.map(c => new Date(c.startDate).getFullYear()))].sort((a,b) => b-a);
        let items = this._filterYear === 'all' ? all
            : all.filter(c => new Date(c.startDate).getFullYear() === parseInt(this._filterYear));

        // Global stats — tính theo thời gian thực
        const pastConf    = all.filter(c => this._getStatus(c) === 'past').length;
        const totalPres   = all.reduce((s, c) => s + c.presentations.length, 0);
        const totalPresenterSet = new Set(all.flatMap(c => c.presentations.map(p => p.presenter)));
        const totalPresenterCount = totalPresenterSet.size;
        // Fix #1: 'now' (đang diễn ra) không tính vào 'sắp tới'
        const upcoming    = all.filter(c => { const s = this._getStatus(c); return s === 'soon' || s === 'upcoming'; }).length;

        // Year tab pills
        const yearTabs = [
            { key: 'all', label: 'Tất cả' },
            ...years.map(y => ({ key: String(y), label: String(y) }))
        ].map(t => `<button class="conf-time-tab ${this._filterYear === t.key ? 'active' : ''}"
            onclick="ConferencesPage.setYear('${t.key}')">${t.label}</button>`).join('');

        // Cards
        const cardsHtml = items.map(item => {
            const status = this._getStatus(item);
            const cd     = this._countdown(item);
            const rg     = CONF_REGIONS[item.region] || CONF_REGIONS.domestic;
            const pres   = item.presentations || [];
            const presenters = this._sortedPresenters(pres);

            // Group presentations by date for preview
            const byDate = {};
            pres.forEach(p => {
                const k = p.date || '';
                if (!byDate[k]) byDate[k] = [];
                byDate[k].push(p);
            });

            const dateKeys = Object.keys(byDate).sort();
            const presPreview = dateKeys.map(d => {
                const dt = new Date(d);
                const days = ['CN','T2','T3','T4','T5','T6','T7'];
                const label = `${days[dt.getDay()]} ${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}`;
                const rows = byDate[d].sort((a,b) => (a.time||'').localeCompare(b.time||'')).map(p => `
                    <div class="cp-pres-row">
                        <span class="cp-pres-time">${p.time}</span>
                        <span class="cp-pres-lang ${p.language === 'en' ? 'cp-lang-en' : 'cp-lang-vi'}">${p.language.toUpperCase()}</span>
                        <span class="cp-pres-title">${p.title}</span>
                        <span class="cp-pres-who">— ${p.presenter}</span>
                    </div>`).join('');
                return `<div class="cp-day-block">
                    <div class="cp-day-label">📅 ${label}</div>
                    ${rows}
                </div>`;
            }).join('');

            const statusCls = status === 'past' ? 'cp-card-past' : status === 'now' ? 'cp-card-now' : status === 'soon' ? 'cp-card-soon' : '';

            return `
            <div class="cp-card ${statusCls}">
                <div class="cp-card-head">
                    <div class="cp-card-title-block">
                        <div class="cp-conf-name">${item.name}</div>
                        ${item.nameVi ? `<div class="cp-conf-name-vi">${item.nameVi}</div>` : ''}
                    </div>
                    <div class="cp-card-meta-right">
                        <span class="cp-countdown ${cd.cls}">${cd.text}</span>
                    </div>
                </div>

                <div class="cp-card-info">
                    <span class="cp-info-chip">📅 ${item.dates}</span>
                    <span class="cp-info-chip">📍 ${item.location}</span>
                    <span class="cp-info-chip">${rg.icon} ${rg.label}</span>
                    ${item.venue ? `<span class="cp-info-chip">🏨 ${item.venue}</span>` : ''}
                </div>

                <div class="cp-stat-row">
                    <div class="cp-stat-pill cp-stat-pres">
                        <span class="cp-stat-num">${pres.length}</span>
                        <span class="cp-stat-unit">bài báo cáo</span>
                    </div>
                    <div class="cp-stat-pill cp-stat-person cp-stat-person-btn" onclick="ConferencesPage.openPresenterModal(${item.id})" title="Xem danh sách báo cáo viên">
                        <span class="cp-stat-num">${presenters.length}</span>
                        <span class="cp-stat-unit">báo cáo viên ↗</span>
                    </div>
                    <div class="cp-stat-pill cp-stat-lang">
                        <span class="cp-stat-num">${pres.filter(p=>p.language==='en').length}</span>
                        <span class="cp-stat-unit">bài EN</span>
                    </div>
                    <div class="cp-stat-pill cp-stat-lang-vi">
                        <span class="cp-stat-num">${pres.filter(p=>p.language==='vi').length}</span>
                        <span class="cp-stat-unit">bài VI</span>
                    </div>
                </div>

                <div class="cp-pres-list">${presPreview}</div>

                <div class="cp-card-footer">
                    <div class="cp-footer-left">
                        ${item.website ? `<a href="${item.website}" target="_blank" rel="noopener" class="cp-link">🔗 ${item.website.replace(/^https?:\/\//,'')}</a>` : ''}
                        ${canExport ? `<button class="btn btn-secondary btn-sm" onclick="ConferencesPage.exportImage(${item.id})" title="Xuất ảnh lịch báo cáo">📷 Xuất ảnh</button>` : ''}
                    </div>
                    ${canEdit ? `<div class="cp-footer-actions">
                        <button class="btn btn-secondary btn-sm" onclick="ConferencesPage.openForm(${item.id})">✏️ Sửa</button>
                        <button class="btn btn-danger btn-sm" onclick="ConferencesPage.deleteItem(${item.id})">🗑️</button>
                    </div>` : ''}
                </div>
            </div>`;
        }).join('');

        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Báo cáo khoa học</h1>
                <p class="page-subtitle">Thống kê tham gia báo cáo tại hội nghị trong nước & quốc tế</p>
            </div>
            ${canEdit ? `<button class="btn btn-primary" onclick="ConferencesPage.openForm()">
                ${Utils.plusIcon()} Thêm hội nghị
            </button>` : ''}
        </div>

        <!-- Summary stats -->
        <div class="cp-stats-row">
            <div class="cp-stat-card">
                <span class="cp-stat-big">${pastConf}</span>
                <span class="cp-stat-label">Hội nghị đã tham gia</span>
            </div>
            <div class="cp-stat-card cp-stat-highlight">
                <span class="cp-stat-big">${totalPres}</span>
                <span class="cp-stat-label">Tổng bài báo cáo</span>
            </div>
            <div class="cp-stat-card">
                <span class="cp-stat-big">${totalPresenterCount}</span>
                <span class="cp-stat-label">Báo cáo viên của khoa</span>
            </div>
            <div class="cp-stat-card ${upcoming > 0 ? 'cp-stat-upcoming' : ''}">
                <span class="cp-stat-big">${upcoming}</span>
                <span class="cp-stat-label">Hội nghị sắp tới</span>
            </div>
        </div>

        <!-- Year filter -->
        <div class="conf-time-tabs conf-time-tabs--spaced">${yearTabs}</div>

        <!-- Conference cards -->
        ${items.length > 0
            ? `<div class="cp-cards">${cardsHtml}</div>`
            : `<div class="conf-empty">
                <div class="conf-empty-icon">📋</div>
                <div class="conf-empty-text">Chưa có hội nghị nào trong năm ${this._filterYear}</div>
               </div>`
        }`;
    },

    setYear(yr) {
        this._filterYear = yr;
        App.renderCurrentPage();
    },

    // ===== CRUD =====
    openForm(id) {
        if (!this._canEdit()) return;
        const item = id ? Store.getById('conferences', id) : null;

        Modal.open(item ? 'Sửa hội nghị' : 'Thêm hội nghị', `
            <form onsubmit="ConferencesPage.save(event, ${id || 0})">
                <div class="form-group">
                    <label class="form-label">Tên hội nghị *</label>
                    <input class="form-input" name="name" required value="${item?.name || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Tên đầy đủ / tiếng Việt</label>
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
                    <label class="form-label">Ngày hiển thị (VD: 05–06/06/2026)</label>
                    <input class="form-input" name="dates" value="${item?.dates || ''}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Khu vực *</label>
                        <select class="form-select" name="region" required>
                            ${Object.entries(CONF_REGIONS).map(([k,v]) =>
                                `<option value="${k}" ${item?.region===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Địa điểm (thành phố) *</label>
                        <input class="form-input" name="location" required value="${item?.location || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Địa điểm cụ thể (khách sạn / hội trường)</label>
                    <input class="form-input" name="venue" value="${item?.venue || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Đơn vị tổ chức</label>
                    <input class="form-input" name="organizer" value="${item?.organizer || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Website</label>
                    <input class="form-input" type="url" name="website" value="${item?.website || ''}" placeholder="https://...">
                </div>
                <div class="form-group">
                    <label class="form-label">Ghi chú</label>
                    <textarea class="form-textarea form-textarea--short" name="note">${item?.note || ''}</textarea>
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
            name:       f.get('name'),
            nameVi:     f.get('nameVi') || '',
            startDate:  f.get('startDate'),
            endDate:    f.get('endDate'),
            dates:      f.get('dates') || '',
            location:   f.get('location'),
            venue:      f.get('venue') || '',
            region:     f.get('region'),
            organizer:  f.get('organizer') || '',
            website:    f.get('website') || '',
            note:       f.get('note') || '',
            presentations: existing?.presentations || []
        };

        if (!data.dates && data.startDate && data.endDate) {
            const s = new Date(data.startDate), e2 = new Date(data.endDate);
            const pad = n => String(n).padStart(2,'0');
            data.dates = s.getMonth()===e2.getMonth()
                ? `${pad(s.getDate())}–${pad(e2.getDate())}/${pad(s.getMonth()+1)}/${s.getFullYear()}`
                : `${pad(s.getDate())}/${pad(s.getMonth()+1)}–${pad(e2.getDate())}/${pad(e2.getMonth()+1)}/${s.getFullYear()}`;
        }

        if (id) Store.update('conferences', id, data);
        else     Store.add('conferences', data);

        Modal.close();
        App.renderCurrentPage();
        Toast.success(id ? 'Đã cập nhật hội nghị' : 'Đã thêm hội nghị');
    },

    deleteItem(id) {
        if (!this._canEdit()) return;
        if (!confirm('Xoá hội nghị này?')) return;
        Store.remove('conferences', id);
        Modal.close();
        App.renderCurrentPage();
        Toast.success('Đã xoá hội nghị');
    },

    // ── Xuất ảnh lịch báo cáo ──
    async exportImage(confId) {
        const item = Store.getById('conferences', confId);
        if (!item) return;
        const pres = item.presentations || [];
        if (!pres.length) { Toast.error('Không có bài báo cáo để xuất!'); return; }

        // Group by date
        const byDate = {};
        pres.forEach(p => {
            const k = p.date || '';
            if (!byDate[k]) byDate[k] = [];
            byDate[k].push(p);
        });
        const dateKeys = Object.keys(byDate).sort();

        const fmtDateFull = d => {
            if (!d) return '';
            const dt  = new Date(d);
            const days = ['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
            return `${days[dt.getDay()]}, ${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}/${dt.getFullYear()}`;
        };

        // Build table rows for each day
        const dayBlocks = dateKeys.map(d => {
            const dayPres = byDate[d].sort((a,b) => (a.time||'').localeCompare(b.time||''));
            const rows = dayPres.map((p, i) => {
                const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
                const langBg  = p.language === 'en' ? '#dbeafe' : '#dcfce7';
                const langClr = p.language === 'en' ? '#1d4ed8' : '#15803d';
                return `<tr style="background:${bg};border-bottom:1px solid #e2e8f0">
                    <td style="padding:10px 12px;white-space:nowrap;font-size:13px;font-weight:700;color:#0891b2;width:100px">${p.time || '—'}</td>
                    <td style="padding:10px 12px;width:36px;text-align:center">
                        <span style="background:${langBg};color:${langClr};font-size:10px;font-weight:800;padding:2px 6px;border-radius:5px">${p.language.toUpperCase()}</span>
                    </td>
                    <td style="padding:10px 12px;font-size:13px;color:#0f172a;line-height:1.45">${p.title}</td>
                    <td style="padding:10px 12px;font-size:12px;color:#475569;white-space:nowrap;min-width:160px">${p.presenter}</td>
                    <td style="padding:10px 12px;font-size:11px;color:#94a3b8;font-style:italic">${p.session || ''}</td>
                </tr>`;
            }).join('');
            return `
                <div style="margin-bottom:20px">
                    <div style="background:linear-gradient(90deg,#0f172a,#1e3a5f);padding:9px 16px;border-radius:8px 8px 0 0">
                        <span style="color:#67e8f9;font-size:13px;font-weight:700">📅 ${fmtDateFull(d)}</span>
                        <span style="color:#94a3b8;font-size:12px;margin-left:10px">${dayPres.length} bài báo cáo</span>
                    </div>
                    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;overflow:hidden">
                        <thead>
                            <tr style="background:#f1f5f9">
                                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Giờ</th>
                                <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase"></th>
                                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Tiêu đề báo cáo</th>
                                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Báo cáo viên</th>
                                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Phiên</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
        }).join('');

        const sorted = this._sortedPresenters(pres);
        const presenterChips = sorted.map(name => {
            const leader = this._LEADERSHIP_ORDER.find(l => name.includes(l.match));
            return `<span style="display:inline-flex;align-items:center;gap:5px;background:${leader?'#fef3c7':'#f8fafc'};border:1px solid ${leader?'#fde68a':'#e2e8f0'};padding:4px 12px;border-radius:20px;font-size:12px;color:#0f172a;font-weight:600;margin:3px">
                ${leader?'⭐':'🎤'} ${name}${leader?` <span style="font-size:10px;color:#92400e;font-weight:700">${leader.badge}</span>`:''}
            </span>`;
        }).join('');

        const exportDate = new Date().toLocaleDateString('vi-VN');
        const exporter = Auth.getSession()?.name || Auth.getSession()?.username || 'Hệ thống';

        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
        container.innerHTML = `
        <div id="conf-export-target" style="width:1100px;padding:0;background:#fff;font-family:'Inter',Arial,sans-serif;color:#0f172a;">
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:24px 36px;display:flex;justify-content:space-between;align-items:center">
                <div>
                    <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:0.5px">KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG</div>
                    <div style="font-size:13px;color:#cbd5e1;margin-top:2px">Bệnh viện Bình Dân · TP. Hồ Chí Minh</div>
                </div>
                <div style="text-align:right">
                    <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:0.5px">BÁO CÁO KHOA HỌC</div>
                    <div style="font-size:13px;color:#cbd5e1;margin-top:2px">&nbsp;</div>
                </div>
            </div>

            <!-- Conference info bar: tên hội nghị nổi bật + ngày + địa điểm -->
            <div style="padding:14px 36px;background:#f0f9ff;border-bottom:2px solid #bae6fd">
                <div style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:6px">${item.name}</div>
                <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center">
                    <span style="font-size:13px;font-weight:600;color:#334155">📅 ${item.dates}</span>
                    <span style="font-size:13px;color:#334155">📍 ${item.location}${item.venue?' — '+item.venue:''}</span>
                    <span style="margin-left:auto;font-size:13px;font-weight:700;color:#0891b2">Tổng: ${pres.length} bài báo cáo · ${sorted.length} báo cáo viên</span>
                </div>
            </div>

            <!-- Content -->
            <div style="padding:20px 36px 8px">${dayBlocks}</div>

            <!-- Presenter summary -->
            <div style="padding:12px 36px 20px">
                <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Báo cáo viên của khoa</div>
                <div style="display:flex;flex-wrap:wrap;gap:0">${presenterChips}</div>
            </div>

            <!-- Footer -->
            <div style="padding:10px 36px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;background:#f8fafc">
                <span>Khoa Phẫu thuật Đại trực tràng — Bệnh viện Bình Dân · Xuất bởi: ${exporter}</span>
                <span>Xuất lúc ${new Date().toLocaleTimeString('vi-VN')} ngày ${exportDate}</span>
            </div>
        </div>`;
        document.body.appendChild(container);

        const target = container.querySelector('#conf-export-target');
        await Utils.loadScript('html2canvas');
        html2canvas(target, { scale: 3, useCORS: true, backgroundColor: '#ffffff' }).then(canvasEl => {
            Utils.applyExportWatermark(canvasEl);
            canvasEl.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const a   = document.createElement('a');
                a.href    = url;
                const confNameSlug = (item.name || 'HoiNghi')
                    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                    .replace(/đ/gi,'d').replace(/[^a-zA-Z0-9\s]/g,'')
                    .trim().replace(/\s+/g,'_');
                const todaySlug = new Date().toLocaleDateString('vi-VN').replace(/\//g,'');
                a.download = `BaoCaoKhoaHoc_${confNameSlug}_${todaySlug}.jpg`;
                a.click();
                URL.revokeObjectURL(url);
                document.body.removeChild(container);
                Toast.success('Đã xuất ảnh lịch báo cáo!');
            }, 'image/jpeg', 0.95);
        }).catch(err => {
            console.error('Conf export failed:', err);
            Toast.error('Không thể xuất ảnh. Vui lòng thử lại.');
            document.body.removeChild(container);
        });
    }
};

