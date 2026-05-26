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

    // ── Unique presenters across a list of presentations ──
    _uniquePresenters(presentations) {
        return [...new Set(presentations.map(p => p.presenter))];
    },

    render() {
        this._ensureSeedData();
        const canEdit = this._canEdit();

        // Only show conferences WITH presentations
        const all = Store.getAll('conferences')
            .filter(c => c.presentations && c.presentations.length > 0)
            .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')); // newest first

        // Year filter
        const years = [...new Set(all.map(c => new Date(c.startDate).getFullYear()))].sort((a,b) => b-a);
        let items = this._filterYear === 'all' ? all
            : all.filter(c => new Date(c.startDate).getFullYear() === parseInt(this._filterYear));

        // Global stats
        const totalConf   = all.length;
        const totalPres   = all.reduce((s, c) => s + c.presentations.length, 0);
        const totalPresenterSet = new Set(all.flatMap(c => c.presentations.map(p => p.presenter)));
        const totalPresenterCount = totalPresenterSet.size;
        const upcoming = all.filter(c => { const s = this._getStatus(c); return s === 'soon' || s === 'now' || s === 'upcoming'; }).length;

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
            const presenters = this._uniquePresenters(pres);

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
                const label = `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}`;
                const rows = byDate[d].map(p => `
                    <div class="cp-pres-row">
                        <span class="cp-pres-time">${p.time}</span>
                        <span class="cp-pres-lang ${p.language === 'en' ? 'cp-lang-en' : 'cp-lang-vi'}">${p.language.toUpperCase()}</span>
                        <span class="cp-pres-title">${p.title}</span>
                        <span class="cp-pres-who">— ${p.presenter}</span>
                    </div>`).join('');
                return `<div class="cp-day-block">
                    <div class="cp-day-label">📅 Ngày ${label}</div>
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
                    <div class="cp-stat-pill cp-stat-person">
                        <span class="cp-stat-num">${presenters.length}</span>
                        <span class="cp-stat-unit">báo cáo viên</span>
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

                <div class="cp-presenter-chips">
                    ${presenters.map(p => `<span class="cp-presenter-chip">🎤 ${p}</span>`).join('')}
                </div>

                <div class="cp-pres-list">${presPreview}</div>

                ${item.website ? `<div class="cp-card-footer">
                    <a href="${item.website}" target="_blank" rel="noopener" class="cp-link">🔗 ${item.website.replace(/^https?:\/\//,'')}</a>
                    ${canEdit ? `<div style="display:flex;gap:6px">
                        <button class="btn btn-secondary btn-sm" onclick="ConferencesPage.openForm(${item.id})">✏️ Sửa</button>
                        <button class="btn btn-danger btn-sm" onclick="ConferencesPage.deleteItem(${item.id})">🗑️</button>
                    </div>` : ''}
                </div>` : canEdit ? `<div class="cp-card-footer" style="justify-content:flex-end">
                    <button class="btn btn-secondary btn-sm" onclick="ConferencesPage.openForm(${item.id})">✏️ Sửa</button>
                    <button class="btn btn-danger btn-sm" onclick="ConferencesPage.deleteItem(${item.id})">🗑️</button>
                </div>` : ''}
            </div>`;
        }).join('');

        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Báo cáo khoa học — Khoa PTĐTT</h1>
                <p class="page-subtitle">Thống kê tham gia báo cáo tại hội nghị trong nước & quốc tế</p>
            </div>
            ${canEdit ? `<button class="btn btn-primary" onclick="ConferencesPage.openForm()">
                ${Utils.plusIcon()} Thêm hội nghị
            </button>` : ''}
        </div>

        <!-- Summary stats -->
        <div class="cp-stats-row">
            <div class="cp-stat-card">
                <span class="cp-stat-big">${totalConf}</span>
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
        <div class="conf-time-tabs" style="margin-bottom:20px">${yearTabs}</div>

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
    }
};
