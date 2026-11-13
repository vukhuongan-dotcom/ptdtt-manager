// ===== NGHIÊN CỨU KHOA HỌC & SÁNG KIẾN CẢI TIẾN (BCN ONLY — FEAT-226) =====

const NCKH_LEVEL_LABELS = {
    cap_co_so: 'Cấp cơ sở',
    cap_so: 'Cấp Sở / Thành phố',
    cap_bo: 'Cấp Bộ / Nhà nước',
};

const NCKH_SUBTABS = [
    { key: 'dashboard', label: 'Dashboard', shortLabel: 'Dashboard' },
    { key: 'topic_approved', label: 'Đề tài xét duyệt', shortLabel: 'ĐT xét duyệt' },
    { key: 'topic_accepted', label: 'Đề tài nghiệm thu', shortLabel: 'ĐT nghiệm thu' },
    { key: 'initiative_approved', label: 'Sáng kiến cải tiến xét duyệt', shortLabel: 'SKCT xét duyệt' },
    { key: 'initiative_recognized', label: 'Sáng kiến cải tiến được công nhận', shortLabel: 'SKCT công nhận' },
];

const NCKH_SEED_DATA = [
    {
        id: 1,
        category: 'topic_approved',
        title: 'So sánh kết quả giữa thực hiện miệng nối trong và ngoài ổ bụng trong phẫu thuật nội soi điều trị ung thư đại tràng trái tại Bệnh viện Bình Dân',
        level: 'cap_co_so',
        year: 2026,
        principalInvestigator: 'TS.BS. Nguyễn Phú Hữu',
        collaborators: ['BS.CKII. Nguyễn Chí Nguyện', 'BS. Giao Hữu Trường Quy'],
        decisionNumber: '417/QĐ-BVBD',
        decisionDate: '2026-03-20',
        councilDate: '2026-03-25',
        status: 'accepted',
        linkedRecordId: 3,
        note: 'Đã nghiệm thu theo Quyết định số 1895/QĐ-BVBD ngày 23/09/2026'
    },
    {
        id: 2,
        category: 'topic_approved',
        title: 'So sánh kết quả sớm phẫu thuật nội soi bảo tồn và không bảo tồn động mạch đại tràng trái trong điều trị ung thư trực tràng',
        level: 'cap_co_so',
        year: 2026,
        principalInvestigator: 'BS.CKII. Nguyễn Phú Hữu',
        collaborators: ['BS. Giao Hữu Trường Quy', 'BS. Nguyễn Hùng Phúc'],
        decisionNumber: '2125/QĐ-BVBD',
        decisionDate: '2025-12-12',
        councilDate: '2025-12-17',
        status: 'accepted',
        linkedRecordId: 4,
        note: 'Đề tài kế hoạch năm 2026; đã nghiệm thu theo Quyết định số 1896/QĐ-BVBD ngày 23/09/2026'
    },
    {
        id: 3,
        category: 'topic_accepted',
        title: 'So sánh kết quả giữa thực hiện miệng nối trong và ngoài ổ bụng trong phẫu thuật nội soi điều trị ung thư đại tràng trái tại Bệnh viện Bình Dân',
        level: 'cap_co_so',
        year: 2026,
        principalInvestigator: 'TS.BS. Nguyễn Phú Hữu',
        collaborators: ['BS.CKII. Nguyễn Chí Nguyện', 'BS. Giao Hữu Trường Quy'],
        decisionNumber: '1895/QĐ-BVBD',
        decisionDate: '2026-09-23',
        councilDate: '2026-09-25',
        rating: 'Đạt',
        status: 'accepted',
        linkedRecordId: 1,
        sourceDecisionNumber: '417/QĐ-BVBD',
        note: 'Xét duyệt đề cương theo Quyết định số 417/QĐ-BVBD ngày 20/03/2026'
    },
    {
        id: 4,
        category: 'topic_accepted',
        title: 'So sánh kết quả sớm phẫu thuật nội soi bảo tồn và không bảo tồn động mạch đại tràng trái trong điều trị ung thư đại tràng sigma và trực tràng tại Bệnh viện Bình Dân',
        level: 'cap_co_so',
        year: 2026,
        principalInvestigator: 'TS.BS. Nguyễn Phú Hữu',
        collaborators: [
            'BS. Giao Hữu Trường Quy',
            'BS. Nguyễn Hùng Phúc',
            'BS.CKII. Nguyễn Chí Nguyện',
            'ĐD. Nguyễn Thị Ngọc Thùy',
            'ĐD. Trần Thanh Danh'
        ],
        decisionNumber: '1896/QĐ-BVBD',
        decisionDate: '2026-09-23',
        councilDate: '2026-09-25',
        rating: 'Đạt',
        status: 'accepted',
        linkedRecordId: 2,
        sourceDecisionNumber: '2125/QĐ-BVBD',
        note: 'Xét duyệt đề cương theo Quyết định số 2125/QĐ-BVBD ngày 12/12/2025'
    },
    {
        id: 5,
        category: 'initiative_approved',
        title: 'Phiếu thông tin hướng dẫn chăm sóc hậu môn nhân tạo tại nhà',
        year: 2026,
        block: 'Khối Tổng quát',
        department: 'Phẫu Thuật Đại Trực tràng',
        submissionDate: '',
        authors: [
            { name: 'Nguyễn Thị Ngọc Thùy', contributionPercent: 20 },
            { name: 'Trần Thanh Danh', contributionPercent: 20 },
            { name: 'Bùi Thị Mộng Trinh', contributionPercent: 20 },
            { name: 'Nguyễn Thị Huyền', contributionPercent: 20 },
            { name: 'Huỳnh Kim Xuân Hằng', contributionPercent: 20 }
        ],
        status: 'recognized',
        linkedRecordId: 7,
        note: 'Đã được công nhận theo Quyết định số 1905/QĐ-BVBD ngày 25/09/2026'
    },
    {
        id: 6,
        category: 'initiative_approved',
        title: 'Nâng cao hiệu quả, chất lượng chăm sóc hậu môn nhân tạo thông qua việc thành lập câu lạc bộ hậu môn nhân tạo hoạt động tại khoa',
        year: 2026,
        block: 'Khối Tổng quát',
        department: 'Phẫu Thuật Đại Trực tràng',
        submissionDate: '',
        authors: [
            { name: 'Phạm Thị Thanh Thảo', contributionPercent: 20 },
            { name: 'Phan Thị Thủy Tiên', contributionPercent: 20 },
            { name: 'Phan Thị Cẩm Tiên', contributionPercent: 20 },
            { name: 'Nguyễn Như Hiền', contributionPercent: 20 },
            { name: 'Lê Thị Thu Trang', contributionPercent: 20 }
        ],
        status: 'recognized',
        linkedRecordId: 8,
        note: 'Đã được công nhận theo Quyết định số 1905/QĐ-BVBD ngày 25/09/2026'
    },
    {
        id: 7,
        category: 'initiative_recognized',
        title: 'Phiếu thông tin hướng dẫn chăm sóc hậu môn nhân tạo tại nhà',
        year: 2026,
        block: 'Khối Tổng quát',
        department: 'Phẫu Thuật Đại Trực tràng',
        decisionNumber: '1905/QĐ-BVBD',
        decisionDate: '2026-09-25',
        sttInDecision: 4,
        authors: [
            { name: 'Nguyễn Thị Ngọc Thùy', contributionPercent: 20 },
            { name: 'Trần Thanh Danh', contributionPercent: 20 },
            { name: 'Bùi Thị Mộng Trinh', contributionPercent: 20 },
            { name: 'Nguyễn Thị Huyền', contributionPercent: 20 },
            { name: 'Huỳnh Kim Xuân Hằng', contributionPercent: 20 }
        ],
        status: 'recognized',
        linkedRecordId: 5,
        note: 'Đính kèm Quyết định 1905/QĐ-BVBD ngày 25/09/2026 của Bệnh viện Bình Dân'
    },
    {
        id: 8,
        category: 'initiative_recognized',
        title: 'Nâng cao hiệu quả, chất lượng chăm sóc hậu môn nhân tạo thông qua việc thành lập câu lạc bộ hậu môn nhân tạo hoạt động tại khoa',
        year: 2026,
        block: 'Khối Tổng quát',
        department: 'Phẫu Thuật Đại Trực tràng',
        decisionNumber: '1905/QĐ-BVBD',
        decisionDate: '2026-09-25',
        sttInDecision: 5,
        authors: [
            { name: 'Phạm Thị Thanh Thảo', contributionPercent: 20 },
            { name: 'Phan Thị Thủy Tiên', contributionPercent: 20 },
            { name: 'Phan Thị Cẩm Tiên', contributionPercent: 20 },
            { name: 'Nguyễn Như Hiền', contributionPercent: 20 },
            { name: 'Lê Thị Thu Trang', contributionPercent: 20 }
        ],
        status: 'recognized',
        linkedRecordId: 6,
        note: 'Đính kèm Quyết định 1905/QĐ-BVBD ngày 25/09/2026 của Bệnh viện Bình Dân'
    }
];

const NckhPage = {
    _activeTab: 'dashboard',
    _filterYear: 'all',
    _searchQuery: '',

    _canAccess() {
        return typeof App !== 'undefined' && typeof App.isAdmin === 'function' && App.isAdmin();
    },

    _normalize(str) {
        return String(str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D')
            .toLowerCase()
            .trim();
    },

    _fmtDate(isoStr) {
        if (!isoStr) return '';
        const parts = String(isoStr).split('T')[0].split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return String(isoStr);
    },

    _esc(val) {
        return Utils.escapeHtml(val == null ? '' : String(val));
    },

    _getInitiativeSubmissionDate(item, linkedRec = null) {
        if (!item) return '';
        if (typeof item.submissionDate === 'string' && item.submissionDate.trim()) {
            return item.submissionDate.trim();
        }
        // Ignore legacy seed decisionDate ('2026-09-25') on seed items 5 & 6 when submissionDate was not yet entered
        if ((item.id === 5 || item.id === 6) && item.reviewDate === '2026-09-25' && !('submissionDate' in item)) {
            return '';
        }
        if (typeof item.reviewDate === 'string' && item.reviewDate.trim()) {
            return item.reviewDate.trim();
        }
        if (linkedRec) {
            return this._getInitiativeSubmissionDate(linkedRec, null);
        }
        return '';
    },

    _getCustomInitiativeNote(item) {
        const raw = String(item?.note || '').trim();
        if (!raw) return '';
        // Suppress auto-generated notes that duplicate the Decision column/badge
        if (/^(Đã được công nhận theo Quyết định số|Đính kèm Quyết định)\s+/i.test(raw)) {
            return '';
        }
        return raw;
    },

    _ensureOfflineSeed() {
        if (!this._canAccess()) return;
        const existing = Store.getAll('nckhItems');
        if (existing.length === 0 && !Store._hasLoadedServerOnce && !Store._serverAvailable && !localStorage.getItem('ptdtt_nckh_seeded_v1')) {
            if (Store._data) {
                Store._data.nckhItems = JSON.parse(JSON.stringify(NCKH_SEED_DATA));
                if (!Store._data.nextIds) Store._data.nextIds = {};
                Store._data.nextIds.nckhItems = 9;
                Store._saveLocal();
                localStorage.setItem('ptdtt_nckh_seeded_v1', '1');
            }
        }
    },

    _getAllItems() {
        this._ensureOfflineSeed();
        const raw = Store.getAll('nckhItems') || [];
        return [...raw].sort((a, b) => {
            const ya = Number(a.year || 0);
            const yb = Number(b.year || 0);
            if (yb !== ya) return yb - ya;
            const da = a.decisionDate || a.councilDate || a.submissionDate || a.reviewDate || '';
            const db = b.decisionDate || b.councilDate || b.submissionDate || b.reviewDate || '';
            if (db !== da) return db.localeCompare(da);
            return (Number(a.sttInDecision || 999) - Number(b.sttInDecision || 999)) || (Number(b.id || 0) - Number(a.id || 0));
        });
    },

    _getFilteredItems(category = null) {
        const all = this._getAllItems();
        const nq = this._normalize(this._searchQuery);
        return all.filter(item => {
            if (category && item.category !== category) return false;
            if (this._filterYear !== 'all' && String(item.year) !== String(this._filterYear)) return false;
            if (!nq) return true;
            const hay = [
                item.title,
                item.decisionNumber,
                item.sourceDecisionNumber,
                item.principalInvestigator,
                ...(Array.isArray(item.collaborators) ? item.collaborators : []),
                ...(Array.isArray(item.authors) ? item.authors.map(a => a.name) : []),
                item.department,
                item.block,
                item.note
            ].map(x => this._normalize(x)).join(' ');
            return hay.includes(nq);
        });
    },

    _getAvailableYears(allItems) {
        const curYear = new Date().getFullYear();
        const set = new Set([curYear, 2026]);
        (allItems || []).forEach(it => {
            if (it && it.year) set.add(Number(it.year));
        });
        return [...set].filter(Boolean).sort((a, b) => b - a);
    },

    _getStaffSuggestions() {
        const staff = Store.getAll('staff') || [];
        const sorted = Utils.sortStaffByRole ? Utils.sortStaffByRole(staff) : staff;
        const withTitle = [];
        const plainNames = [];
        sorted.forEach(s => {
            if (!s || !s.name) return;
            const full = s.title ? `${s.title}. ${s.name}`.replace(/\.\./g, '.') : s.name;
            withTitle.push(full);
            plainNames.push(s.name);
        });
        return {
            withTitle: [...new Set(withTitle)],
            plainNames: [...new Set(plainNames)]
        };
    },

    setTab(tabKey) {
        if (!NCKH_SUBTABS.some(t => t.key === tabKey)) return;
        this._activeTab = tabKey;
        App.renderCurrentPage();
    },

    setYear(yearVal) {
        this._filterYear = String(yearVal);
        App.renderCurrentPage();
    },

    onSearchInput(val) {
        this._searchQuery = val || '';
        const bodyEl = document.getElementById('nckh-tab-body');
        if (bodyEl) {
            bodyEl.innerHTML = this._renderActiveTabContent();
            this._updateSubtabCountsDom();
        }
    },

    clearSearch() {
        this._searchQuery = '';
        App.renderCurrentPage();
    },

    _updateSubtabCountsDom() {
        ['topic_approved', 'topic_accepted', 'initiative_approved', 'initiative_recognized'].forEach(cat => {
            const badge = document.getElementById(`nckh-count-${cat}`);
            if (badge) badge.textContent = String(this._getFilteredItems(cat).length);
        });
    },

    _renderPrimaryAddButton() {
        const map = {
            topic_approved: {
                label: '+ Thêm đề tài xét duyệt',
                fn: "NckhPage.openTopicForm('topic_approved')"
            },
            topic_accepted: {
                label: '+ Thêm đề tài nghiệm thu',
                fn: "NckhPage.openTopicForm('topic_accepted')"
            },
            initiative_approved: {
                label: '+ Thêm SKCT xét duyệt',
                fn: "NckhPage.openInitiativeForm('initiative_approved')"
            },
            initiative_recognized: {
                label: '+ Thêm SKCT công nhận',
                fn: "NckhPage.openInitiativeForm('initiative_recognized')"
            }
        };
        const cfg = map[this._activeTab];
        if (cfg) {
            return `<button type="button" class="btn btn-primary nckh-primary-cta" id="nckh-primary-add-btn" onclick="${cfg.fn}">${cfg.label}</button>`;
        }
        return `<button type="button" class="btn btn-primary nckh-primary-cta" id="nckh-primary-add-btn" onclick="NckhPage.openQuickCreateModal()">+ Thêm mới NCKH / SKCT</button>`;
    },

    render() {
        if (!this._canAccess()) {
            return `
                <div class="card nckh-restricted-card">
                    <div class="nckh-restricted-icon">🔒</div>
                    <h3>Chức năng dành riêng cho Ban Chủ nhiệm Khoa</h3>
                    <p>Chỉ Trưởng khoa, Phó Trưởng khoa và Điều dưỡng trưởng mới có quyền xem và quản lý dữ liệu Nghiên cứu khoa học & Sáng kiến cải tiến.</p>
                </div>
            `;
        }

        const allItems = this._getAllItems();
        const years = this._getAvailableYears(allItems);

        const subtabsHtml = NCKH_SUBTABS.map(tab => {
            const isActive = this._activeTab === tab.key;
            const count = tab.key === 'dashboard' ? null : this._getFilteredItems(tab.key).length;
            return `
                <button type="button"
                    class="nckh-subtab ${isActive ? 'active' : ''}"
                    data-subtab="${tab.key}"
                    aria-selected="${isActive ? 'true' : 'false'}"
                    onclick="NckhPage.setTab('${tab.key}')">
                    <span class="nckh-subtab-label-full">${this._esc(tab.label)}</span>
                    <span class="nckh-subtab-label-short">${this._esc(tab.shortLabel)}</span>
                    ${count !== null ? `<span class="nckh-subtab-badge" id="nckh-count-${tab.key}">${count}</span>` : ''}
                </button>
            `;
        }).join('');

        const yearPillsHtml = [
            `<button type="button" class="nckh-year-pill ${this._filterYear === 'all' ? 'active' : ''}" onclick="NckhPage.setYear('all')">Tất cả năm</button>`,
            ...years.map(yr => `
                <button type="button" class="nckh-year-pill ${String(this._filterYear) === String(yr) ? 'active' : ''}" onclick="NckhPage.setYear('${yr}')">Năm ${yr}</button>
            `)
        ].join('');

        return `
            <div class="nckh-page" id="nckh-page">
                <div class="page-header nckh-header">
                    <div>
                        <div class="nckh-bcn-pill">🛡️ Nội bộ Ban Chủ nhiệm Khoa</div>
                        <h1 class="page-title">Nghiên cứu khoa học & Sáng kiến</h1>
                        <p class="page-subtitle">Quản lý đề tài NCKH cấp cơ sở và sáng kiến cải tiến kỹ thuật — Khoa Phẫu thuật Đại trực tràng</p>
                    </div>
                    <div class="page-actions nckh-header-actions">
                        <button type="button" class="btn btn-secondary" onclick="NckhPage.exportImage()" title="Xuất ảnh báo cáo 2K PNG">
                            📷 Xuất ảnh
                        </button>
                        ${this._renderPrimaryAddButton()}
                    </div>
                </div>

                <!-- 5 Sub-tabs Navigation -->
                <div class="nckh-subtabs-wrap" role="tablist" aria-label="Phân mục Nghiên cứu khoa học">
                    ${subtabsHtml}
                </div>

                <!-- Filter & Search Toolbar -->
                <div class="nckh-toolbar">
                    <div class="nckh-year-pills" role="group" aria-label="Lọc theo năm">
                        ${yearPillsHtml}
                    </div>
                    <div class="nckh-search-box">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input type="search"
                            id="nckh-search-input"
                            class="nckh-search-input"
                            placeholder="Tìm đề tài, sáng kiến, tác giả, số QĐ..."
                            value="${this._esc(this._searchQuery)}"
                            oninput="NckhPage.onSearchInput(this.value)"
                            aria-label="Tìm kiếm đề tài và sáng kiến">
                        ${this._searchQuery ? `<button type="button" class="nckh-search-clear" onclick="NckhPage.clearSearch()" aria-label="Xoá từ khoá">&times;</button>` : ''}
                    </div>
                </div>

                <!-- Active Sub-tab Body -->
                <div id="nckh-tab-body" class="nckh-tab-body">
                    ${this._renderActiveTabContent()}
                </div>
            </div>
        `;
    },

    _renderActiveTabContent() {
        switch (this._activeTab) {
            case 'topic_approved':
                return this._renderTopicList('topic_approved');
            case 'topic_accepted':
                return this._renderTopicList('topic_accepted');
            case 'initiative_approved':
                return this._renderInitiativeList('initiative_approved');
            case 'initiative_recognized':
                return this._renderInitiativeList('initiative_recognized');
            case 'dashboard':
            default:
                return this._renderDashboard();
        }
    },

    // ==================== 1. DASHBOARD ====================
    _computeStaffStats(items) {
        const map = new Map();
        const stripTitle = (raw) => {
            return String(raw || '')
                .replace(/^(PGS\.TS\.BS\.|TS\.BSCKII\.|TS\.BS\.CKII\.|TS\.BS\.|BSCKII\.|BS\.CKII\.|BSCKI\.|BS\.CKI\.|ThS\.BS\.|ThS\.ĐD\.|ThS\.\s*ĐD\.|BSNT\.|BS\.|ĐD\.|CNĐD\.)\s*/iu, '')
                .trim();
        };
        const ensureEntry = (rawName) => {
            const cleanKey = this._normalize(stripTitle(rawName));
            if (!cleanKey) return null;
            if (!map.has(cleanKey)) {
                map.set(cleanKey, {
                    displayName: rawName.trim(),
                    piCount: 0,
                    collabCount: 0,
                    initCount: 0,
                    countedTopics: new Set(),
                    countedInits: new Set()
                });
            }
            const entry = map.get(cleanKey);
            if (rawName.trim().length > entry.displayName.length) {
                entry.displayName = rawName.trim();
            }
            return entry;
        };

        // Deduplicate linked topics (count unique research projects across approved/accepted)
        const topicProjects = [];
        const acceptedLinkedIds = new Set(
            items.filter(i => i.category === 'topic_accepted' && i.linkedRecordId).map(i => Number(i.linkedRecordId))
        );
        items.forEach(it => {
            if (it.category === 'topic_accepted') {
                topicProjects.push(it);
            } else if (it.category === 'topic_approved' && !acceptedLinkedIds.has(Number(it.id))) {
                topicProjects.push(it);
            }
        });

        topicProjects.forEach(tp => {
            const pid = `tp_${tp.id}`;
            if (tp.principalInvestigator) {
                const e = ensureEntry(tp.principalInvestigator);
                if (e && !e.countedTopics.has(pid + '_pi')) {
                    e.countedTopics.add(pid + '_pi');
                    e.piCount += 1;
                }
            }
            (tp.collaborators || []).forEach(col => {
                const e = ensureEntry(col);
                if (e && !e.countedTopics.has(pid + '_co')) {
                    e.countedTopics.add(pid + '_co');
                    e.collabCount += 1;
                }
            });
        });

        // Deduplicate linked initiatives (prefer recognized record when linked)
        const initProjects = [];
        const recognizedLinkedIds = new Set(
            items.filter(i => i.category === 'initiative_recognized' && i.linkedRecordId).map(i => Number(i.linkedRecordId))
        );
        items.forEach(it => {
            if (it.category === 'initiative_recognized') {
                initProjects.push(it);
            } else if (it.category === 'initiative_approved' && !recognizedLinkedIds.has(Number(it.id))) {
                initProjects.push(it);
            }
        });

        initProjects.forEach(ini => {
            const iid = `in_${ini.id}`;
            (ini.authors || []).forEach(au => {
                if (!au || !au.name) return;
                const e = ensureEntry(au.name);
                if (e && !e.countedInits.has(iid)) {
                    e.countedInits.add(iid);
                    e.initCount += 1;
                }
            });
        });

        return [...map.values()]
            .map(e => ({
                name: e.displayName,
                piCount: e.piCount,
                collabCount: e.collabCount,
                initCount: e.initCount,
                total: e.piCount + e.collabCount + e.initCount
            }))
            .sort((a, b) => (b.total - a.total) || (b.piCount - a.piCount) || a.name.localeCompare(b.name, 'vi'));
    },

    _renderDashboard() {
        const topicApproved = this._getFilteredItems('topic_approved');
        const topicAccepted = this._getFilteredItems('topic_accepted');
        const initApproved = this._getFilteredItems('initiative_approved');
        const initRecognized = this._getFilteredItems('initiative_recognized');
        const allFiltered = this._getFilteredItems();

        const targetYear = this._filterYear === 'all' ? 2026 : Number(this._filterYear);
        const yearTopicAccepted = this._getAllItems().filter(i => i.category === 'topic_accepted' && Number(i.year) === targetYear).length;
        const yearTopicApproved = this._getAllItems().filter(i => i.category === 'topic_approved' && Number(i.year) === targetYear).length;
        const yearInitRecognized = this._getAllItems().filter(i => i.category === 'initiative_recognized' && Number(i.year) === targetYear).length;

        const topicTarget = 2;
        const initTarget = 2;
        const topicPct = Math.min(100, Math.round((yearTopicAccepted / topicTarget) * 100));
        const initPct = Math.min(100, Math.round((yearInitRecognized / initTarget) * 100));

        const staffStats = this._computeStaffStats(allFiltered);

        const quickActionsHtml = `
            <div class="nckh-quick-add-bar">
                <span class="nckh-quick-add-label">Nhập nhanh hồ sơ:</span>
                <div class="nckh-quick-add-btns">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="NckhPage.openTopicForm('topic_approved')">+ Đề tài xét duyệt</button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="NckhPage.openTopicForm('topic_accepted')">+ Đề tài nghiệm thu</button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="NckhPage.openInitiativeForm('initiative_approved')">+ SKCT xét duyệt</button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="NckhPage.openInitiativeForm('initiative_recognized')">+ SKCT công nhận</button>
                </div>
            </div>
        `;

        return `
            ${quickActionsHtml}

            <!-- 4 KPI Cards -->
            <div class="nckh-kpi-grid">
                <button type="button" class="nckh-kpi-card nckh-kpi--navy" onclick="NckhPage.setTab('topic_approved')">
                    <div class="nckh-kpi-top">
                        <span class="nckh-kpi-title">Đề tài xét duyệt</span>
                        <span class="nckh-kpi-icon">📋</span>
                    </div>
                    <div class="nckh-kpi-value">${topicApproved.length}</div>
                    <div class="nckh-kpi-sub">Đề cương cấp cơ sở đã duyệt</div>
                </button>

                <button type="button" class="nckh-kpi-card nckh-kpi--leaf" onclick="NckhPage.setTab('topic_accepted')">
                    <div class="nckh-kpi-top">
                        <span class="nckh-kpi-title">Đề tài nghiệm thu</span>
                        <span class="nckh-kpi-icon">✅</span>
                    </div>
                    <div class="nckh-kpi-value">${topicAccepted.length}</div>
                    <div class="nckh-kpi-sub">${topicApproved.length > 0 ? `Hoàn thành ${Math.min(100, Math.round((topicAccepted.length / topicApproved.length) * 100))}% đề tài duyệt` : 'Đã nghiệm thu đạt yêu cầu'}</div>
                </button>

                <button type="button" class="nckh-kpi-card nckh-kpi--ocean" onclick="NckhPage.setTab('initiative_approved')">
                    <div class="nckh-kpi-top">
                        <span class="nckh-kpi-title">SKCT xét duyệt</span>
                        <span class="nckh-kpi-icon">💡</span>
                    </div>
                    <div class="nckh-kpi-value">${initApproved.length}</div>
                    <div class="nckh-kpi-sub">Sáng kiến cải tiến xét duyệt</div>
                </button>

                <button type="button" class="nckh-kpi-card nckh-kpi--amber" onclick="NckhPage.setTab('initiative_recognized')">
                    <div class="nckh-kpi-top">
                        <span class="nckh-kpi-title">SKCT được công nhận</span>
                        <span class="nckh-kpi-icon">🏆</span>
                    </div>
                    <div class="nckh-kpi-value">${initRecognized.length}</div>
                    <div class="nckh-kpi-sub">Công nhận theo QĐ Bệnh viện</div>
                </button>
            </div>

            <!-- Dashboard Two-Column Summary -->
            <div class="nckh-dash-grid">
                <!-- Left: Target Progress & Recent Highlights -->
                <div class="card nckh-dash-panel">
                    <div class="nckh-panel-head">
                        <h3 class="nckh-panel-title">🎯 Tiến độ chỉ tiêu kế hoạch năm ${targetYear}</h3>
                        <span class="nckh-badge nckh-badge--navy">Khoa PTĐTT</span>
                    </div>

                    <div class="nckh-progress-block">
                        <div class="nckh-progress-row">
                            <span class="nckh-progress-name">Đề tài NCKH cấp cơ sở nghiệm thu</span>
                            <span class="nckh-progress-stat">
                                <strong>${yearTopicAccepted}</strong> / ${topicTarget} đề tài
                                <span class="nckh-status-pill ${yearTopicAccepted >= topicTarget ? 'is-success' : 'is-pending'}">
                                    ${yearTopicAccepted >= topicTarget ? 'Đạt chỉ tiêu' : `Đã duyệt ${yearTopicApproved} đề cương`}
                                </span>
                            </span>
                        </div>
                        <div class="nckh-progress-track">
                            <div class="nckh-progress-fill is-leaf" style="width:${topicPct}%"></div>
                        </div>
                    </div>

                    <div class="nckh-progress-block">
                        <div class="nckh-progress-row">
                            <span class="nckh-progress-name">Sáng kiến cải tiến được công nhận</span>
                            <span class="nckh-progress-stat">
                                <strong>${yearInitRecognized}</strong> / ${initTarget} sáng kiến
                                <span class="nckh-status-pill ${yearInitRecognized >= initTarget ? 'is-success' : 'is-pending'}">
                                    ${yearInitRecognized >= initTarget ? 'Đạt chỉ tiêu' : 'Đang triển khai'}
                                </span>
                            </span>
                        </div>
                        <div class="nckh-progress-track">
                            <div class="nckh-progress-fill is-ocean" style="width:${initPct}%"></div>
                        </div>
                    </div>

                    <div class="nckh-dash-highlights">
                        <div class="nckh-subhead">Điểm nhấn học thuật (${this._filterYear === 'all' ? 'Tất cả' : 'Năm ' + this._filterYear})</div>
                        ${topicAccepted.length === 0 && initRecognized.length === 0
                            ? `<div class="nckh-muted-empty">Chưa có đề tài nghiệm thu hoặc sáng kiến công nhận trong bộ lọc hiện tại.</div>`
                            : `
                            <ul class="nckh-highlight-list">
                                ${topicAccepted.slice(0, 3).map(t => `
                                    <li>
                                        <span class="nckh-hl-tag is-topic">Nghiệm thu</span>
                                        <div class="nckh-hl-body">
                                            <div class="nckh-hl-title">${this._esc(t.title)}</div>
                                            <div class="nckh-hl-meta">CNĐT: <strong>${this._esc(t.principalInvestigator)}</strong> ${t.decisionNumber ? `· QĐ ${this._esc(t.decisionNumber)}` : ''} ${t.councilDate ? `· Họp HĐ: ${this._fmtDate(t.councilDate)}` : ''}</div>
                                        </div>
                                    </li>
                                `).join('')}
                                ${initRecognized.slice(0, 3).map(s => `
                                    <li>
                                        <span class="nckh-hl-tag is-init">Công nhận</span>
                                        <div class="nckh-hl-body">
                                            <div class="nckh-hl-title">${this._esc(s.title)}</div>
                                            <div class="nckh-hl-meta">${(s.authors || []).length} tác giả ${s.decisionNumber ? `· QĐ ${this._esc(s.decisionNumber)}` : ''} ${s.decisionDate ? `(${this._fmtDate(s.decisionDate)})` : ''}</div>
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        `}
                    </div>
                </div>

                <!-- Right: Staff Participation Leaderboard -->
                <div class="card nckh-dash-panel">
                    <div class="nckh-panel-head">
                        <h3 class="nckh-panel-title">👩‍⚕️ Nhân sự tham gia NCKH & SKCT</h3>
                        <span class="nckh-badge nckh-badge--muted">${staffStats.length} nhân sự</span>
                    </div>
                    ${staffStats.length === 0
                        ? `<div class="nckh-muted-empty">Chưa có dữ liệu nhân sự tham gia.</div>`
                        : `
                        <div class="nckh-staff-table-wrap">
                            <table class="nckh-staff-table">
                                <thead>
                                    <tr>
                                        <th>Nhân sự</th>
                                        <th class="text-center">CNĐT</th>
                                        <th class="text-center">CTV</th>
                                        <th class="text-center">SKCT</th>
                                        <th class="text-center">Tổng</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${staffStats.map(st => `
                                        <tr>
                                            <td class="nckh-staff-name-cell">${this._esc(st.name)}</td>
                                            <td class="text-center">${st.piCount || '—'}</td>
                                            <td class="text-center">${st.collabCount || '—'}</td>
                                            <td class="text-center">${st.initCount || '—'}</td>
                                            <td class="text-center"><span class="nckh-total-pill">${st.total}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;
    },

    // ==================== 2 & 3. ĐỀ TÀI XÉT DUYỆT & NGHIỆM THU ====================
    _renderTopicList(category) {
        const isAcceptedTab = category === 'topic_accepted';
        const items = this._getFilteredItems(category);
        const sectionTitle = isAcceptedTab ? 'Danh sách đề tài NCKH đã nghiệm thu' : 'Danh sách đề tài NCKH xét duyệt';
        const addBtnLabel = isAcceptedTab ? '+ Thêm đề tài nghiệm thu' : '+ Thêm đề tài xét duyệt';

        if (items.length === 0) {
            return `
                <div class="card nckh-empty-card">
                    <div class="nckh-empty-icon">${isAcceptedTab ? '✅' : '📋'}</div>
                    <div class="nckh-empty-title">Chưa có ${isAcceptedTab ? 'đề tài nghiệm thu' : 'đề tài xét duyệt'} nào</div>
                    <div class="nckh-empty-desc">Nhấn nút bên dưới để thêm hồ sơ đề tài nghiên cứu khoa học mới.</div>
                    <button type="button" class="btn btn-primary" onclick="NckhPage.openTopicForm('${category}')">${addBtnLabel}</button>
                </div>
            `;
        }

        const cardsHtml = items.map((item, idx) => {
            const levelLabel = NCKH_LEVEL_LABELS[item.level] || 'Cấp cơ sở';
            const collabs = Array.isArray(item.collaborators) ? item.collaborators.filter(Boolean) : [];
            const linkedRec = item.linkedRecordId ? Store.getById('nckhItems', Number(item.linkedRecordId)) : null;
            const isAlreadyAccepted = item.status === 'accepted' || Boolean(linkedRec && linkedRec.category === 'topic_accepted');

            return `
                <article class="nckh-topic-card ${isAcceptedTab ? 'is-accepted' : ''}" data-record-id="${item.id}">
                    <div class="nckh-topic-card-top">
                        <div class="nckh-topic-badges">
                            <span class="nckh-badge nckh-badge--navy">#${idx + 1} · Năm ${this._esc(item.year || '')}</span>
                            <span class="nckh-badge nckh-badge--muted">${this._esc(levelLabel)}</span>
                            ${item.decisionNumber ? `<span class="nckh-badge nckh-badge--decision">📜 QĐ ${this._esc(item.decisionNumber)}${item.decisionDate ? ` · ${this._fmtDate(item.decisionDate)}` : ''}</span>` : ''}
                            ${item.councilDate ? `<span class="nckh-badge nckh-badge--council">🗓️ Họp HĐ: ${this._fmtDate(item.councilDate)}</span>` : ''}
                        </div>
                        <div class="nckh-topic-status-area">
                            ${isAcceptedTab
                                ? `<span class="nckh-status-pill is-success">✅ Nghiệm thu: ${this._esc(item.rating || 'Đạt')}</span>`
                                : (isAlreadyAccepted
                                    ? `<span class="nckh-status-pill is-success">✅ Đã nghiệm thu${linkedRec?.decisionNumber ? ` (${this._esc(linkedRec.decisionNumber)})` : ''}</span>`
                                    : `<span class="nckh-status-pill is-pending">⏳ Đang thực hiện</span>`)
                            }
                        </div>
                    </div>

                    <h3 class="nckh-topic-title">${this._esc(item.title)}</h3>

                    <div class="nckh-topic-people">
                        <div class="nckh-person-row">
                            <span class="nckh-person-label">Chủ nhiệm đề tài:</span>
                            <span class="nckh-pi-chip">👨‍⚕️ ${this._esc(item.principalInvestigator || '—')}</span>
                        </div>
                        ${collabs.length > 0 ? `
                        <div class="nckh-person-row">
                            <span class="nckh-person-label">Cộng tác viên (${collabs.length}):</span>
                            <div class="nckh-collab-chips">
                                ${collabs.map(c => `<span class="nckh-collab-chip">${this._esc(c)}</span>`).join('')}
                            </div>
                        </div>` : ''}
                    </div>

                    ${(item.sourceDecisionNumber || item.note) ? `
                        <div class="nckh-topic-footnote">
                            ${item.sourceDecisionNumber ? `<span>🔗 Xét duyệt theo QĐ: <strong>${this._esc(item.sourceDecisionNumber)}</strong></span>` : ''}
                            ${item.note ? `<span>📝 ${this._esc(item.note)}</span>` : ''}
                        </div>
                    ` : ''}

                    <div class="nckh-card-actions">
                        ${(!isAcceptedTab && !isAlreadyAccepted) ? `
                            <button type="button" class="btn btn-secondary btn-sm nckh-promote-btn" onclick="NckhPage.promoteTopicToAccepted(${item.id})">
                                ⚡ Chuyển nghiệm thu
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-secondary btn-sm" onclick="NckhPage.openTopicForm('${category}', ${item.id})">
                            ✏️ Sửa
                        </button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="NckhPage.deleteItem(${item.id})">
                            🗑️ Xoá
                        </button>
                    </div>
                </article>
            `;
        }).join('');

        return `
            <div class="nckh-section-bar">
                <h2 class="nckh-section-heading">${sectionTitle} (${items.length})</h2>
                <button type="button" class="btn btn-primary btn-sm" onclick="NckhPage.openTopicForm('${category}')">${addBtnLabel}</button>
            </div>
            <div class="nckh-topic-list">
                ${cardsHtml}
            </div>
        `;
    },

    // ==================== 4 & 5. SÁNG KIẾN CẢI TIẾN (XÉT DUYỆT & CÔNG NHẬN) ====================
    _renderInitiativeList(category) {
        const isRecognizedTab = category === 'initiative_recognized';
        const items = this._getFilteredItems(category);
        const sectionTitle = isRecognizedTab
            ? 'Danh sách sáng kiến cải tiến được công nhận'
            : 'Danh sách sáng kiến cải tiến xét duyệt';
        const addBtnLabel = isRecognizedTab
            ? '+ Thêm SKCT công nhận'
            : '+ Thêm SKCT xét duyệt';

        if (items.length === 0) {
            return `
                <div class="card nckh-empty-card">
                    <div class="nckh-empty-icon">${isRecognizedTab ? '🏆' : '💡'}</div>
                    <div class="nckh-empty-title">Chưa có ${isRecognizedTab ? 'sáng kiến được công nhận' : 'sáng kiến xét duyệt'} nào</div>
                    <div class="nckh-empty-desc">Nhấn nút bên dưới để thêm hồ sơ sáng kiến cải tiến mới.</div>
                    <button type="button" class="btn btn-primary" onclick="NckhPage.openInitiativeForm('${category}')">${addBtnLabel}</button>
                </div>
            `;
        }

        const tableRowsHtml = items.map((item, idx) => {
            const authors = Array.isArray(item.authors) ? item.authors : [];
            const linkedRec = item.linkedRecordId ? Store.getById('nckhItems', Number(item.linkedRecordId)) : null;
            const isAlreadyRecognized = item.status === 'recognized' || Boolean(linkedRec && linkedRec.category === 'initiative_recognized');
            const sttDisplay = isRecognizedTab && item.sttInDecision ? `${idx + 1} (QĐ #${item.sttInDecision})` : `${idx + 1}`;
            const subDate = this._getInitiativeSubmissionDate(item, linkedRec);
            const customNote = this._getCustomInitiativeNote(item);

            const authorsGridHtml = authors.length
                ? `<div class="nckh-author-grid">${authors.map(a => `
                    <div class="nckh-author-chip">
                        <span class="nckh-author-chip-name">${this._esc(a.name)}</span>
                        <span class="nckh-author-chip-pct">${a.contributionPercent != null ? `${this._esc(a.contributionPercent)}%` : '—'}</span>
                    </div>
                `).join('')}</div>`
                : '—';

            const decisionMeta = isRecognizedTab
                ? `
                    ${item.decisionNumber ? `<div class="nckh-dec-strong">📜 ${this._esc(item.decisionNumber)}</div>` : ''}
                    ${item.decisionDate ? `<div class="nckh-dec-sub">Ngày ký: ${this._fmtDate(item.decisionDate)}</div>` : ''}
                    ${subDate ? `<div class="nckh-dec-sub">🗓️ Nộp xét duyệt: ${this._fmtDate(subDate)}</div>` : ''}
                    <span class="nckh-status-pill is-success">🏆 Công nhận</span>
                `
                : `
                    <div class="nckh-dec-sub">🗓️ Nộp xét duyệt: <strong>${subDate ? this._fmtDate(subDate) : 'Chưa cập nhật'}</strong></div>
                    ${isAlreadyRecognized
                        ? `
                            <div class="nckh-status-stack">
                                <span class="nckh-status-pill is-success">✅ Đã công nhận</span>
                                ${linkedRec?.decisionNumber ? `<div class="nckh-dec-ref">📜 QĐ ${this._esc(linkedRec.decisionNumber)}</div>` : ''}
                            </div>
                        `
                        : `<span class="nckh-status-pill is-pending">⏳ Chờ công nhận</span>`}
                `;

            return `
                <tr data-record-id="${item.id}">
                    <td class="text-center nckh-col-stt">${sttDisplay}</td>
                    <td class="nckh-col-title">
                        <div class="nckh-init-title">${this._esc(item.title)}</div>
                        <div class="nckh-init-submeta">
                            <span class="nckh-meta-tag">Năm ${this._esc(item.year || '')}</span>
                            ${item.block ? `<span class="nckh-meta-tag">${this._esc(item.block)}</span>` : ''}
                            <span class="nckh-meta-tag">🏥 ${this._esc(item.department || 'Phẫu Thuật Đại Trực tràng')}</span>
                        </div>
                        ${customNote ? `<div class="nckh-init-note">📝 ${this._esc(customNote)}</div>` : ''}
                    </td>
                    <td class="nckh-col-authors">${authorsGridHtml}</td>
                    <td class="nckh-col-decision">${decisionMeta}</td>
                    <td class="nckh-col-actions">
                        <div class="nckh-table-actions">
                            ${(!isRecognizedTab && !isAlreadyRecognized) ? `
                                <button type="button" class="btn btn-secondary btn-sm nckh-promote-btn" onclick="NckhPage.promoteInitiativeToRecognized(${item.id})" title="Công nhận sáng kiến">
                                    ⚡ Công nhận
                                </button>
                            ` : ''}
                            <button type="button" class="btn btn-secondary btn-sm" onclick="NckhPage.openInitiativeForm('${category}', ${item.id})">Sửa</button>
                            <button type="button" class="btn btn-danger btn-sm" onclick="NckhPage.deleteItem(${item.id})">Xoá</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const mobileCardsHtml = items.map((item, idx) => {
            const authors = Array.isArray(item.authors) ? item.authors : [];
            const linkedRec = item.linkedRecordId ? Store.getById('nckhItems', Number(item.linkedRecordId)) : null;
            const isAlreadyRecognized = item.status === 'recognized' || Boolean(linkedRec && linkedRec.category === 'initiative_recognized');
            const subDate = this._getInitiativeSubmissionDate(item, linkedRec);
            const customNote = this._getCustomInitiativeNote(item);

            return `
                <article class="nckh-init-mobile-card" data-record-id="${item.id}">
                    <div class="nckh-topic-card-top">
                        <div class="nckh-topic-badges">
                            <span class="nckh-badge nckh-badge--navy">#${idx + 1}${isRecognizedTab && item.sttInDecision ? ` (STT QĐ: ${item.sttInDecision})` : ''} · Năm ${this._esc(item.year || '')}</span>
                            ${item.block ? `<span class="nckh-badge nckh-badge--muted">${this._esc(item.block)}</span>` : ''}
                            ${item.decisionNumber ? `<span class="nckh-badge nckh-badge--decision">📜 ${this._esc(item.decisionNumber)}${item.decisionDate ? ` · ${this._fmtDate(item.decisionDate)}` : ''}</span>` : ''}
                            ${subDate ? `<span class="nckh-badge nckh-badge--council">🗓️ Ngày nộp xét duyệt: ${this._fmtDate(subDate)}</span>` : ''}
                        </div>
                        <div>
                            ${isRecognizedTab
                                ? `<span class="nckh-status-pill is-success">🏆 Công nhận</span>`
                                : (isAlreadyRecognized
                                    ? `<span class="nckh-status-pill is-success">✅ Đã công nhận</span>`
                                    : `<span class="nckh-status-pill is-pending">⏳ Chờ công nhận</span>`)
                            }
                        </div>
                    </div>

                    <h3 class="nckh-topic-title">${this._esc(item.title)}</h3>
                    <div class="nckh-init-dept-line">🏥 Khoa/Phòng: <strong>${this._esc(item.department || 'Phẫu Thuật Đại Trực tràng')}</strong></div>

                    <div class="nckh-mobile-authors-box">
                        <div class="nckh-mobile-authors-head">
                            <span>Tác giả (${authors.length})</span>
                            <span>Tỉ lệ đóng góp</span>
                        </div>
                        ${authors.map(a => `
                            <div class="nckh-mobile-author-row">
                                <span>${this._esc(a.name)}</span>
                                <span class="nckh-pct-pill">${a.contributionPercent != null ? `${this._esc(a.contributionPercent)}%` : '—'}</span>
                            </div>
                        `).join('')}
                    </div>

                    ${customNote ? `<div class="nckh-topic-footnote"><span>📝 ${this._esc(customNote)}</span></div>` : ''}

                    <div class="nckh-card-actions">
                        ${(!isRecognizedTab && !isAlreadyRecognized) ? `
                            <button type="button" class="btn btn-secondary btn-sm nckh-promote-btn" onclick="NckhPage.promoteInitiativeToRecognized(${item.id})">
                                ⚡ Công nhận sáng kiến
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-secondary btn-sm" onclick="NckhPage.openInitiativeForm('${category}', ${item.id})">
                            ✏️ Sửa
                        </button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="NckhPage.deleteItem(${item.id})">
                            🗑️ Xoá
                        </button>
                    </div>
                </article>
            `;
        }).join('');

        return `
            <div class="nckh-section-bar">
                <h2 class="nckh-section-heading">${sectionTitle} (${items.length})</h2>
                <button type="button" class="btn btn-primary btn-sm" onclick="NckhPage.openInitiativeForm('${category}')">${addBtnLabel}</button>
            </div>

            <!-- Desktop Official Table -->
            <div class="card nckh-table-card nckh-desktop-only">
                <table class="nckh-init-table">
                    <thead>
                        <tr>
                            <th class="text-center nckh-col-stt">STT</th>
                            <th class="nckh-col-title">Tên sáng kiến cải tiến</th>
                            <th class="nckh-col-authors">Nhóm tác giả & Tỉ lệ đóng góp (%)</th>
                            <th class="nckh-col-decision">${isRecognizedTab ? 'Quyết định công nhận' : 'Ngày nộp & Trạng thái'}</th>
                            <th class="nckh-col-actions">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
            </div>

            <!-- Mobile Responsive Cards -->
            <div class="nckh-mobile-only nckh-mobile-cards-list">
                ${mobileCardsHtml}
            </div>
        `;
    },

    // ==================== QUICK CREATE CHOOSER (FROM DASHBOARD) ====================
    openQuickCreateModal() {
        if (!this._canAccess()) return;
        Modal.open('Thêm mới hồ sơ NCKH / Sáng kiến', `
            <div class="nckh-chooser-grid">
                <button type="button" class="nckh-chooser-btn" onclick="NckhPage.openTopicForm('topic_approved')">
                    <span class="nckh-chooser-icon">📋</span>
                    <span class="nckh-chooser-title">Đề tài xét duyệt</span>
                    <span class="nckh-chooser-desc">Nhập quyết định xét duyệt đề cương NCKH mới</span>
                </button>
                <button type="button" class="nckh-chooser-btn" onclick="NckhPage.openTopicForm('topic_accepted')">
                    <span class="nckh-chooser-icon">✅</span>
                    <span class="nckh-chooser-title">Đề tài nghiệm thu</span>
                    <span class="nckh-chooser-desc">Ghi nhận đề tài đã họp Hội đồng nghiệm thu</span>
                </button>
                <button type="button" class="nckh-chooser-btn" onclick="NckhPage.openInitiativeForm('initiative_approved')">
                    <span class="nckh-chooser-icon">💡</span>
                    <span class="nckh-chooser-title">Sáng kiến cải tiến xét duyệt</span>
                    <span class="nckh-chooser-desc">Đăng ký sáng kiến cải tiến kỹ thuật & tỉ lệ %</span>
                </button>
                <button type="button" class="nckh-chooser-btn" onclick="NckhPage.openInitiativeForm('initiative_recognized')">
                    <span class="nckh-chooser-icon">🏆</span>
                    <span class="nckh-chooser-title">Sáng kiến được công nhận</span>
                    <span class="nckh-chooser-desc">Nhập quyết định công nhận sáng kiến cấp Bệnh viện</span>
                </button>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="Modal.close()">Đóng</button>
            </div>
        `);
    },

    // ==================== TOPIC CRUD MODAL ====================
    _renderCollabRowHtml(val = '') {
        return `
            <div class="nckh-dynamic-row nckh-collab-row">
                <input type="text" class="form-input nckh-collab-input" list="nckh-staff-title-datalist" value="${this._esc(val)}" placeholder="VD: BS.CKII. Nguyễn Chí Nguyện">
                <button type="button" class="btn btn-secondary nckh-row-remove-btn" onclick="this.closest('.nckh-collab-row').remove()" aria-label="Xoá cộng tác viên">&times;</button>
            </div>
        `;
    },

    addCollabRow(val = '') {
        const list = document.getElementById('nckh-collab-rows');
        if (!list) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = this._renderCollabRowHtml(val);
        const row = wrap.firstElementChild;
        list.appendChild(row);
        const inp = row?.querySelector('input');
        if (inp) inp.focus();
    },

    onSelectSourceApprovedTopic(sourceIdStr) {
        const sourceId = Number(sourceIdStr || 0);
        if (!sourceId) return;
        const src = Store.getById('nckhItems', sourceId);
        if (!src) return;
        const form = document.getElementById('nckh-topic-form');
        if (!form) return;
        const setVal = (name, val) => {
            const el = form.querySelector(`[name="${name}"]`);
            if (el && val != null) el.value = val;
        };
        setVal('title', src.title || '');
        setVal('year', src.year || new Date().getFullYear());
        setVal('level', src.level || 'cap_co_so');
        setVal('principalInvestigator', src.principalInvestigator || '');
        setVal('linkedRecordId', src.id);
        setVal('sourceDecisionNumber', src.decisionNumber || '');
        const rowsEl = document.getElementById('nckh-collab-rows');
        if (rowsEl) {
            const collabs = Array.isArray(src.collaborators) && src.collaborators.length ? src.collaborators : [''];
            rowsEl.innerHTML = collabs.map(c => this._renderCollabRowHtml(c)).join('');
        }
    },

    promoteTopicToAccepted(approvedId) {
        this.openTopicForm('topic_accepted', 0, approvedId);
    },

    openTopicForm(category, id = 0, prefillApprovedId = 0) {
        if (!this._canAccess()) return;
        const isAccepted = category === 'topic_accepted';
        const existing = id ? Store.getById('nckhItems', Number(id)) : null;
        const prefillSrc = (!existing && prefillApprovedId) ? Store.getById('nckhItems', Number(prefillApprovedId)) : null;
        const seed = existing || prefillSrc || null;

        const defaultYear = this._filterYear !== 'all' ? Number(this._filterYear) : 2026;
        const staffSugs = this._getStaffSuggestions();
        const datalistHtml = `
            <datalist id="nckh-staff-title-datalist">
                ${staffSugs.withTitle.map(n => `<option value="${this._esc(n)}"></option>`).join('')}
            </datalist>
        `;

        const approvedCandidates = isAccepted && !existing
            ? this._getAllItems().filter(it => it.category === 'topic_approved')
            : [];

        const collabs = Array.isArray(seed?.collaborators) && seed.collaborators.length > 0
            ? seed.collaborators
            : [''];

        const modalTitle = existing
            ? (isAccepted ? 'Sửa đề tài nghiệm thu' : 'Sửa đề tài xét duyệt')
            : (isAccepted ? 'Thêm đề tài nghiệm thu' : 'Thêm đề tài xét duyệt');

        Modal.open(modalTitle, `
            <form id="nckh-topic-form" onsubmit="NckhPage.saveTopic(event, '${category}', ${Number(id || 0)})">
                ${datalistHtml}
                <input type="hidden" name="linkedRecordId" value="${existing ? (existing.linkedRecordId || '') : (prefillSrc ? prefillSrc.id : '')}">
                <input type="hidden" name="sourceDecisionNumber" value="${this._esc(existing ? (existing.sourceDecisionNumber || '') : (prefillSrc ? (prefillSrc.decisionNumber || '') : ''))}">

                ${approvedCandidates.length > 0 ? `
                    <div class="form-group nckh-prefill-banner">
                        <label class="form-label">⚡ Điền nhanh từ đề tài đã xét duyệt (tuỳ chọn)</label>
                        <select class="form-select" onchange="NckhPage.onSelectSourceApprovedTopic(this.value)">
                            <option value="">— Nhập thủ công hoặc chọn đề tài đã xét duyệt —</option>
                            ${approvedCandidates.map(c => `
                                <option value="${c.id}" ${prefillSrc && prefillSrc.id === c.id ? 'selected' : ''}>
                                    ${c.decisionNumber ? `[${this._esc(c.decisionNumber)}] ` : ''}${this._esc(c.title)}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                ` : ''}

                <div class="form-group">
                    <label class="form-label">Tên đề tài nghiên cứu khoa học *</label>
                    <textarea class="form-textarea form-textarea--short" name="title" rows="3" required placeholder="Nhập đầy đủ tên đề tài theo Quyết định...">${this._esc(seed?.title || '')}</textarea>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Năm kế hoạch / báo cáo *</label>
                        <input type="number" class="form-input" name="year" min="2020" max="2040" required value="${this._esc(seed?.year || defaultYear)}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Cấp đề tài</label>
                        <select class="form-select" name="level">
                            ${Object.entries(NCKH_LEVEL_LABELS).map(([k, lbl]) => `
                                <option value="${k}" ${(seed?.level || 'cap_co_so') === k ? 'selected' : ''}>${this._esc(lbl)}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Chủ nhiệm đề tài *</label>
                    <input type="text" class="form-input" name="principalInvestigator" list="nckh-staff-title-datalist" required value="${this._esc(seed?.principalInvestigator || '')}" placeholder="VD: TS.BS. Nguyễn Phú Hữu">
                </div>

                <div class="form-group">
                    <div class="nckh-field-head">
                        <label class="form-label" style="margin-bottom:0">Cộng tác viên</label>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="NckhPage.addCollabRow()">+ Thêm CTV</button>
                    </div>
                    <div id="nckh-collab-rows" class="nckh-dynamic-list">
                        ${collabs.map(c => this._renderCollabRowHtml(c)).join('')}
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Số Quyết định ${isAccepted ? 'nghiệm thu' : 'xét duyệt'}</label>
                        <input type="text" class="form-input" name="decisionNumber" value="${this._esc(existing ? (existing.decisionNumber || '') : '')}" placeholder="${isAccepted ? 'VD: 1895/QĐ-BVBD' : 'VD: 417/QĐ-BVBD'}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ngày ký Quyết định</label>
                        <input type="date" class="form-input" name="decisionDate" value="${this._esc(existing ? (existing.decisionDate || '') : '')}">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Ngày họp Hội đồng</label>
                        <input type="date" class="form-input" name="councilDate" value="${this._esc(existing ? (existing.councilDate || '') : '')}">
                    </div>
                    ${isAccepted ? `
                        <div class="form-group">
                            <label class="form-label">Kết quả nghiệm thu</label>
                            <select class="form-select" name="rating">
                                ${['Đạt', 'Tốt', 'Xuất sắc'].map(r => `
                                    <option value="${r}" ${(existing?.rating || 'Đạt') === r ? 'selected' : ''}>${r}</option>
                                `).join('')}
                            </select>
                        </div>
                    ` : `
                        <div class="form-group">
                            <label class="form-label">Trạng thái thực hiện</label>
                            <select class="form-select" name="status">
                                <option value="approved" ${(existing?.status || 'approved') === 'approved' ? 'selected' : ''}>Đang thực hiện</option>
                                <option value="accepted" ${existing?.status === 'accepted' ? 'selected' : ''}>Đã nghiệm thu</option>
                            </select>
                        </div>
                    `}
                </div>

                <div class="form-group">
                    <label class="form-label">Ghi chú</label>
                    <textarea class="form-textarea form-textarea--short" name="note" rows="2" placeholder="Ghi chú bổ sung (nếu có)...">${this._esc(existing ? (existing.note || '') : (prefillSrc?.decisionNumber ? `Xét duyệt đề cương theo Quyết định số ${prefillSrc.decisionNumber}` : ''))}</textarea>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">${existing ? 'Cập nhật' : 'Lưu đề tài'}</button>
                </div>
            </form>
        `);
    },

    saveTopic(e, category, id) {
        e.preventDefault();
        if (!this._canAccess()) return;
        const form = e.target;
        const fd = new FormData(form);
        const title = String(fd.get('title') || '').trim();
        const pi = String(fd.get('principalInvestigator') || '').trim();
        const year = parseInt(fd.get('year'), 10);

        if (!title) {
            Toast.error('Vui lòng nhập tên đề tài nghiên cứu khoa học.');
            return;
        }
        if (!pi) {
            Toast.error('Vui lòng nhập họ tên Chủ nhiệm đề tài.');
            return;
        }
        if (!year || year < 2000 || year > 2100) {
            Toast.error('Năm kế hoạch không hợp lệ.');
            return;
        }

        const collaborators = Array.from(form.querySelectorAll('.nckh-collab-input'))
            .map(inp => inp.value.trim())
            .filter(Boolean);

        const linkedIdRaw = parseInt(fd.get('linkedRecordId'), 10);
        const linkedRecordId = Number.isFinite(linkedIdRaw) && linkedIdRaw > 0 ? linkedIdRaw : null;

        const recordData = {
            category,
            title,
            year,
            level: String(fd.get('level') || 'cap_co_so'),
            principalInvestigator: pi,
            collaborators,
            decisionNumber: String(fd.get('decisionNumber') || '').trim(),
            decisionDate: String(fd.get('decisionDate') || '').trim(),
            councilDate: String(fd.get('councilDate') || '').trim(),
            note: String(fd.get('note') || '').trim()
        };

        if (category === 'topic_accepted') {
            recordData.rating = String(fd.get('rating') || 'Đạt');
            recordData.status = 'accepted';
            if (linkedRecordId) recordData.linkedRecordId = linkedRecordId;
            const srcDec = String(fd.get('sourceDecisionNumber') || '').trim();
            if (srcDec) recordData.sourceDecisionNumber = srcDec;
        } else {
            recordData.status = String(fd.get('status') || 'approved');
            if (linkedRecordId) recordData.linkedRecordId = linkedRecordId;
        }

        let savedItem;
        if (id) {
            savedItem = Store.update('nckhItems', Number(id), recordData);
        } else {
            savedItem = Store.add('nckhItems', recordData);
        }

        // Cross-link source approved topic when saving accepted topic
        if (category === 'topic_accepted' && linkedRecordId && savedItem) {
            const srcTopic = Store.getById('nckhItems', linkedRecordId);
            if (srcTopic && srcTopic.category === 'topic_approved') {
                Store.update('nckhItems', linkedRecordId, {
                    status: 'accepted',
                    linkedRecordId: savedItem.id
                });
            }
        }

        this._activeTab = category;
        Modal.close();
        App.renderCurrentPage();
        Toast.success(id ? 'Đã cập nhật hồ sơ đề tài NCKH' : 'Đã thêm hồ sơ đề tài NCKH mới');
    },

    // ==================== INITIATIVE CRUD MODAL ====================
    _renderAuthorRowHtml(name = '', pct = '') {
        return `
            <div class="nckh-dynamic-row nckh-author-row">
                <input type="text" class="form-input nckh-author-name-input" list="nckh-staff-plain-datalist" value="${this._esc(name)}" placeholder="Họ và tên tác giả">
                <div class="nckh-author-pct-wrap">
                    <input type="number" class="form-input nckh-author-pct-input" min="1" max="100" step="1" value="${this._esc(pct)}" placeholder="%" oninput="NckhPage.updateAuthorPercentTotal()">
                    <span class="nckh-pct-suffix">%</span>
                </div>
                <button type="button" class="btn btn-secondary nckh-row-remove-btn" onclick="NckhPage.removeAuthorRow(this)" aria-label="Xoá tác giả">&times;</button>
            </div>
        `;
    },

    addAuthorRow(name = '', pct = '') {
        const list = document.getElementById('nckh-author-rows');
        if (!list) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = this._renderAuthorRowHtml(name, pct);
        const row = wrap.firstElementChild;
        list.appendChild(row);
        this.updateAuthorPercentTotal();
        const inp = row?.querySelector('.nckh-author-name-input');
        if (inp) inp.focus();
    },

    removeAuthorRow(btnEl) {
        const list = document.getElementById('nckh-author-rows');
        if (!list) return;
        const rows = list.querySelectorAll('.nckh-author-row');
        if (rows.length <= 1) {
            const nameInp = rows[0].querySelector('.nckh-author-name-input');
            const pctInp = rows[0].querySelector('.nckh-author-pct-input');
            if (nameInp) nameInp.value = '';
            if (pctInp) pctInp.value = '100';
        } else {
            btnEl.closest('.nckh-author-row')?.remove();
        }
        this.updateAuthorPercentTotal();
    },

    distributeEqualPercent() {
        const list = document.getElementById('nckh-author-rows');
        if (!list) return;
        const pctInputs = Array.from(list.querySelectorAll('.nckh-author-pct-input'));
        const n = pctInputs.length;
        if (!n) return;
        const base = Math.floor(100 / n);
        let remainder = 100 - base * n;
        pctInputs.forEach((inp) => {
            const add = remainder > 0 ? 1 : 0;
            if (remainder > 0) remainder -= 1;
            inp.value = String(base + add);
        });
        this.updateAuthorPercentTotal();
    },

    updateAuthorPercentTotal() {
        const list = document.getElementById('nckh-author-rows');
        const badge = document.getElementById('nckh-pct-total-badge');
        if (!list || !badge) return;
        const total = Array.from(list.querySelectorAll('.nckh-author-pct-input'))
            .reduce((sum, inp) => sum + (Number(inp.value) || 0), 0);
        badge.textContent = `Tổng: ${total}%`;
        badge.className = `nckh-pct-total-badge ${total === 100 ? 'is-valid' : 'is-invalid'}`;
    },

    onSelectSourceApprovedInitiative(sourceIdStr) {
        const sourceId = Number(sourceIdStr || 0);
        if (!sourceId) return;
        const src = Store.getById('nckhItems', sourceId);
        if (!src) return;
        const form = document.getElementById('nckh-initiative-form');
        if (!form) return;
        const setVal = (name, val) => {
            const el = form.querySelector(`[name="${name}"]`);
            if (el && val != null) el.value = val;
        };
        setVal('title', src.title || '');
        setVal('year', src.year || new Date().getFullYear());
        setVal('block', src.block || 'Khối Tổng quát');
        setVal('department', src.department || 'Phẫu Thuật Đại Trực tràng');
        setVal('linkedRecordId', src.id);
        setVal('submissionDate', this._getInitiativeSubmissionDate(src));

        const rowsEl = document.getElementById('nckh-author-rows');
        if (rowsEl && Array.isArray(src.authors) && src.authors.length > 0) {
            rowsEl.innerHTML = src.authors.map(a => this._renderAuthorRowHtml(a.name, a.contributionPercent)).join('');
            this.updateAuthorPercentTotal();
        }
    },

    promoteInitiativeToRecognized(approvedId) {
        this.openInitiativeForm('initiative_recognized', 0, approvedId);
    },

    openInitiativeForm(category, id = 0, prefillApprovedId = 0) {
        if (!this._canAccess()) return;
        const isRecognized = category === 'initiative_recognized';
        const existing = id ? Store.getById('nckhItems', Number(id)) : null;
        const prefillSrc = (!existing && prefillApprovedId) ? Store.getById('nckhItems', Number(prefillApprovedId)) : null;
        const seed = existing || prefillSrc || null;

        const defaultYear = this._filterYear !== 'all' ? Number(this._filterYear) : 2026;
        const staffSugs = this._getStaffSuggestions();
        const datalistHtml = `
            <datalist id="nckh-staff-plain-datalist">
                ${staffSugs.plainNames.map(n => `<option value="${this._esc(n)}"></option>`).join('')}
            </datalist>
        `;

        const approvedCandidates = isRecognized && !existing
            ? this._getAllItems().filter(it => it.category === 'initiative_approved')
            : [];

        const authors = Array.isArray(seed?.authors) && seed.authors.length > 0
            ? seed.authors
            : [{ name: '', contributionPercent: 100 }];

        const initTotal = authors.reduce((s, a) => s + (Number(a.contributionPercent) || 0), 0);

        const modalTitle = existing
            ? (isRecognized ? 'Sửa sáng kiến được công nhận' : 'Sửa sáng kiến cải tiến xét duyệt')
            : (isRecognized ? 'Thêm sáng kiến được công nhận' : 'Thêm sáng kiến cải tiến xét duyệt');

        Modal.open(modalTitle, `
            <form id="nckh-initiative-form" onsubmit="NckhPage.saveInitiative(event, '${category}', ${Number(id || 0)})">
                ${datalistHtml}
                <input type="hidden" name="linkedRecordId" value="${existing ? (existing.linkedRecordId || '') : (prefillSrc ? prefillSrc.id : '')}">

                ${approvedCandidates.length > 0 ? `
                    <div class="form-group nckh-prefill-banner">
                        <label class="form-label">⚡ Điền nhanh từ SKCT đã xét duyệt (tuỳ chọn)</label>
                        <select class="form-select" onchange="NckhPage.onSelectSourceApprovedInitiative(this.value)">
                            <option value="">— Nhập thủ công hoặc chọn sáng kiến đã xét duyệt —</option>
                            ${approvedCandidates.map(c => `
                                <option value="${c.id}" ${prefillSrc && prefillSrc.id === c.id ? 'selected' : ''}>
                                    [Năm ${this._esc(c.year)}] ${this._esc(c.title)}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                ` : ''}

                <div class="form-group">
                    <label class="form-label">Tên sáng kiến cải tiến *</label>
                    <textarea class="form-textarea form-textarea--short" name="title" rows="3" required placeholder="Nhập đầy đủ tên sáng kiến cải tiến...">${this._esc(seed?.title || '')}</textarea>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Năm *</label>
                        <input type="number" class="form-input" name="year" min="2020" max="2040" required value="${this._esc(seed?.year || defaultYear)}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Khối xét duyệt</label>
                        <select class="form-select" name="block">
                            ${['Khối Tổng quát', 'Khối Ngoại', 'Khối Điều dưỡng', 'Toàn viện'].map(b => `
                                <option value="${b}" ${(seed?.block || 'Khối Tổng quát') === b ? 'selected' : ''}>${b}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Khoa / Phòng</label>
                    <input type="text" class="form-input" name="department" value="${this._esc(seed?.department || 'Phẫu Thuật Đại Trực tràng')}">
                </div>

                <div class="form-group">
                    <div class="nckh-field-head">
                        <div class="nckh-author-head-left">
                            <label class="form-label" style="margin-bottom:0">Nhóm tác giả & Tỉ lệ đóng góp *</label>
                            <span id="nckh-pct-total-badge" class="nckh-pct-total-badge ${initTotal === 100 ? 'is-valid' : 'is-invalid'}">Tổng: ${initTotal}%</span>
                        </div>
                        <div class="nckh-author-head-btns">
                            <button type="button" class="btn btn-secondary btn-sm" onclick="NckhPage.distributeEqualPercent()">⚡ Chia đều %</button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="NckhPage.addAuthorRow()">+ Thêm tác giả</button>
                        </div>
                    </div>
                    <div id="nckh-author-rows" class="nckh-dynamic-list">
                        ${authors.map(a => this._renderAuthorRowHtml(a.name, a.contributionPercent)).join('')}
                    </div>
                </div>

                ${isRecognized ? `
                    <input type="hidden" name="submissionDate" value="${this._esc(this._getInitiativeSubmissionDate(existing, prefillSrc))}">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Số Quyết định công nhận</label>
                            <input type="text" class="form-input" name="decisionNumber" value="${this._esc(existing?.decisionNumber || '')}" placeholder="VD: 1905/QĐ-BVBD">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ngày ký Quyết định</label>
                            <input type="date" class="form-input" name="decisionDate" value="${this._esc(existing?.decisionDate || '')}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">STT trong Quyết định (tuỳ chọn)</label>
                        <input type="number" class="form-input" name="sttInDecision" min="1" value="${this._esc(existing?.sttInDecision || '')}" placeholder="VD: 4">
                    </div>
                ` : `
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Ngày nộp xét duyệt</label>
                            <input type="date" class="form-input" name="submissionDate" value="${this._esc(this._getInitiativeSubmissionDate(existing))}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Trạng thái</label>
                            <select class="form-select" name="status">
                                <option value="approved" ${(existing?.status || 'approved') === 'approved' ? 'selected' : ''}>Đã nộp xét duyệt (chờ công nhận)</option>
                                <option value="recognized" ${existing?.status === 'recognized' ? 'selected' : ''}>Đã được công nhận</option>
                            </select>
                        </div>
                    </div>
                `}

                <div class="form-group">
                    <label class="form-label">Ghi chú</label>
                    <textarea class="form-textarea form-textarea--short" name="note" rows="2" placeholder="Ghi chú bổ sung (nếu có)...">${this._esc(existing?.note || '')}</textarea>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">${existing ? 'Cập nhật' : 'Lưu sáng kiến'}</button>
                </div>
            </form>
        `);
    },

    saveInitiative(e, category, id) {
        e.preventDefault();
        if (!this._canAccess()) return;
        const form = e.target;
        const fd = new FormData(form);
        const title = String(fd.get('title') || '').trim();
        const year = parseInt(fd.get('year'), 10);

        if (!title) {
            Toast.error('Vui lòng nhập tên sáng kiến cải tiến.');
            return;
        }
        if (!year || year < 2000 || year > 2100) {
            Toast.error('Năm không hợp lệ.');
            return;
        }

        const authorRows = Array.from(form.querySelectorAll('.nckh-author-row'));
        const authors = [];
        for (const row of authorRows) {
            const name = String(row.querySelector('.nckh-author-name-input')?.value || '').trim();
            const pctRaw = Number(row.querySelector('.nckh-author-pct-input')?.value || 0);
            if (!name) continue;
            authors.push({
                name,
                contributionPercent: Math.round(pctRaw * 100) / 100
            });
        }

        if (authors.length === 0) {
            Toast.error('Vui lòng nhập ít nhất 01 tác giả sáng kiến.');
            return;
        }

        const sumPct = Math.round(authors.reduce((s, a) => s + (Number(a.contributionPercent) || 0), 0));
        if (sumPct !== 100) {
            Toast.error(`Tổng tỉ lệ đóng góp của các tác giả hiện là ${sumPct}%. Vui lòng điều chỉnh để bằng đúng 100% (hoặc bấm "⚡ Chia đều %").`);
            return;
        }

        const linkedIdRaw = parseInt(fd.get('linkedRecordId'), 10);
        const linkedRecordId = Number.isFinite(linkedIdRaw) && linkedIdRaw > 0 ? linkedIdRaw : null;

        const recordData = {
            category,
            title,
            year,
            block: String(fd.get('block') || 'Khối Tổng quát').trim(),
            department: String(fd.get('department') || 'Phẫu Thuật Đại Trực tràng').trim(),
            authors,
            note: String(fd.get('note') || '').trim()
        };

        if (category === 'initiative_recognized') {
            recordData.decisionNumber = String(fd.get('decisionNumber') || '').trim();
            recordData.decisionDate = String(fd.get('decisionDate') || '').trim();
            const subDate = String(fd.get('submissionDate') || '').trim();
            if (subDate) {
                recordData.submissionDate = subDate;
                recordData.reviewDate = subDate;
            }
            const sttVal = parseInt(fd.get('sttInDecision'), 10);
            recordData.sttInDecision = Number.isFinite(sttVal) && sttVal > 0 ? sttVal : null;
            recordData.status = 'recognized';
            if (linkedRecordId) recordData.linkedRecordId = linkedRecordId;
        } else {
            const subDate = String(fd.get('submissionDate') || fd.get('reviewDate') || '').trim();
            recordData.submissionDate = subDate;
            recordData.reviewDate = subDate;
            recordData.status = String(fd.get('status') || 'approved');
            if (linkedRecordId) recordData.linkedRecordId = linkedRecordId;
        }

        let savedItem;
        if (id) {
            savedItem = Store.update('nckhItems', Number(id), recordData);
        } else {
            savedItem = Store.add('nckhItems', recordData);
        }

        // Cross-link source approved initiative when saving recognized initiative
        if (category === 'initiative_recognized' && linkedRecordId && savedItem) {
            const srcInit = Store.getById('nckhItems', linkedRecordId);
            if (srcInit && srcInit.category === 'initiative_approved') {
                Store.update('nckhItems', linkedRecordId, {
                    status: 'recognized',
                    linkedRecordId: savedItem.id
                });
            }
        }

        this._activeTab = category;
        Modal.close();
        App.renderCurrentPage();
        Toast.success(id ? 'Đã cập nhật hồ sơ sáng kiến cải tiến' : 'Đã thêm hồ sơ sáng kiến cải tiến mới');
    },

    // ==================== DELETE ====================
    async deleteItem(id) {
        if (!this._canAccess()) return;
        const item = Store.getById('nckhItems', Number(id));
        if (!item) return;

        const confirmed = await Confirm.delete(item.title);
        if (!confirmed) return;

        // Clean up back-reference if linked
        if (item.linkedRecordId) {
            const peer = Store.getById('nckhItems', Number(item.linkedRecordId));
            if (peer && Number(peer.linkedRecordId) === Number(item.id)) {
                const revertedStatus = peer.category.endsWith('_approved') ? 'approved' : peer.status;
                Store.update('nckhItems', Number(peer.id), {
                    linkedRecordId: null,
                    status: revertedStatus
                });
            }
        }

        Store.remove('nckhItems', Number(id));
        App.renderCurrentPage();
        Toast.success('Đã xoá hồ sơ khỏi danh sách NCKH');
    },

    // ==================== 2K PNG EXPORT ====================
    async exportImage() {
        if (!this._canAccess()) return;
        const topicApproved = this._getFilteredItems('topic_approved');
        const topicAccepted = this._getFilteredItems('topic_accepted');
        const initApproved = this._getFilteredItems('initiative_approved');
        const initRecognized = this._getFilteredItems('initiative_recognized');

        if (!topicApproved.length && !topicAccepted.length && !initApproved.length && !initRecognized.length) {
            Toast.warning('Chưa có dữ liệu NCKH / Sáng kiến trong bộ lọc hiện tại để xuất ảnh.');
            return;
        }

        const yearLabel = this._filterYear === 'all' ? 'TỔNG HỢP CÁC NĂM' : `NĂM ${this._filterYear}`;
        const exportDate = new Date().toLocaleDateString('vi-VN');
        const exporter = Auth.getSession()?.name || Auth.getSession()?.username || 'Ban Chủ nhiệm';

        const renderTopicsTable = (list, heading, isAcc) => {
            if (!list.length) return '';
            const rows = list.map((t, i) => `
                <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};border-bottom:1px solid #e2e8f0">
                    <td style="padding:10px 12px;text-align:center;font-weight:700;color:#1D2357;width:44px">${i + 1}</td>
                    <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#0f172a;line-height:1.45">${this._esc(t.title)}</td>
                    <td style="padding:10px 12px;font-size:12.5px;color:#1e293b;width:230px">
                        <div><strong>CNĐT:</strong> ${this._esc(t.principalInvestigator)}</div>
                        ${(t.collaborators || []).length ? `<div style="color:#475569;margin-top:3px"><strong>CTV:</strong> ${(t.collaborators || []).map(c => this._esc(c)).join('; ')}</div>` : ''}
                    </td>
                    <td style="padding:10px 12px;font-size:12px;color:#334155;width:165px">
                        ${t.decisionNumber ? `<div style="font-weight:700;color:#1D2357">${this._esc(t.decisionNumber)}</div>` : ''}
                        ${t.decisionDate ? `<div>Ký: ${this._fmtDate(t.decisionDate)}</div>` : ''}
                        ${t.councilDate ? `<div>Họp HĐ: ${this._fmtDate(t.councilDate)}</div>` : ''}
                    </td>
                    <td style="padding:10px 12px;text-align:center;font-size:12px;font-weight:700;color:${isAcc || t.status === 'accepted' ? '#15803d' : '#b45309'};width:110px">
                        ${isAcc ? (this._esc(t.rating || 'Đạt')) : (t.status === 'accepted' ? 'Đã nghiệm thu' : 'Đang thực hiện')}
                    </td>
                </tr>
            `).join('');
            return `
                <div style="margin-bottom:20px">
                    <div style="background:#1D2357;color:#ffffff;padding:9px 14px;border-radius:8px 8px 0 0;font-size:13px;font-weight:700;letter-spacing:normal">
                        ${heading} (${list.length})
                    </div>
                    <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;border-top:none">
                        <thead>
                            <tr style="background:#f1f5f9;border-bottom:1px solid #cbd5e1">
                                <th style="padding:8px 10px;font-size:11px;color:#475569;text-align:center">STT</th>
                                <th style="padding:8px 12px;font-size:11px;color:#475569;text-align:left">Tên đề tài NCKH cấp cơ sở</th>
                                <th style="padding:8px 12px;font-size:11px;color:#475569;text-align:left">Nhóm nghiên cứu</th>
                                <th style="padding:8px 12px;font-size:11px;color:#475569;text-align:left">Quyết định / Ngày</th>
                                <th style="padding:8px 10px;font-size:11px;color:#475569;text-align:center">Kết quả</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        };

        const renderInitTable = (list, heading, isRec) => {
            if (!list.length) return '';
            const rows = list.map((s, i) => `
                <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};border-bottom:1px solid #e2e8f0">
                    <td style="padding:10px 12px;text-align:center;font-weight:700;color:#1D2357;width:44px">${i + 1}</td>
                    <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#0f172a;line-height:1.45">${this._esc(s.title)}</td>
                    <td style="padding:10px 12px;font-size:12.5px;color:#1e293b;width:210px">
                        ${(s.authors || []).map(a => `<div style="padding:1px 0">${this._esc(a.name)}</div>`).join('')}
                    </td>
                    <td style="padding:10px 12px;text-align:center;font-size:12.5px;font-weight:700;color:#1D2357;width:90px">
                        ${(s.authors || []).map(a => `<div style="padding:1px 0">${this._esc(a.contributionPercent)}%</div>`).join('')}
                    </td>
                    <td style="padding:10px 12px;font-size:12px;color:#334155;width:165px">
                        ${isRec && s.decisionNumber ? `<div style="font-weight:700;color:#1D2357">${this._esc(s.decisionNumber)}</div>` : ''}
                        ${isRec && s.decisionDate ? `<div>Ngày ký: ${this._fmtDate(s.decisionDate)}</div>` : ''}
                        ${!isRec && this._getInitiativeSubmissionDate(s) ? `<div>Nộp xét duyệt: ${this._fmtDate(this._getInitiativeSubmissionDate(s))}</div>` : ''}
                        <div style="color:#15803d;font-weight:700">${isRec || s.status === 'recognized' ? 'Được công nhận' : 'Đã nộp xét duyệt'}</div>
                    </td>
                </tr>
            `).join('');
            return `
                <div style="margin-bottom:20px">
                    <div style="background:#1878B4;color:#ffffff;padding:9px 14px;border-radius:8px 8px 0 0;font-size:13px;font-weight:700;letter-spacing:normal">
                        ${heading} (${list.length})
                    </div>
                    <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;border-top:none">
                        <thead>
                            <tr style="background:#f1f5f9;border-bottom:1px solid #cbd5e1">
                                <th style="padding:8px 10px;font-size:11px;color:#475569;text-align:center">STT</th>
                                <th style="padding:8px 12px;font-size:11px;color:#475569;text-align:left">Tên sáng kiến cải tiến</th>
                                <th style="padding:8px 12px;font-size:11px;color:#475569;text-align:left">Tác giả</th>
                                <th style="padding:8px 10px;font-size:11px;color:#475569;text-align:center">Tỉ lệ (%)</th>
                                <th style="padding:8px 12px;font-size:11px;color:#475569;text-align:left">Quyết định / Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        };

        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
        container.innerHTML = `
            <div id="nckh-export-target" style="width:1120px;background:#ffffff;font-family:'Be Vietnam Pro','Noto Sans',system-ui,sans-serif;color:#0f172a;letter-spacing:normal">
                <div style="background:linear-gradient(135deg,#1D2357 0%,#1878B4 100%);padding:24px 36px;display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:normal">KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG</div>
                        <div style="font-size:13px;color:#e2e8f0;margin-top:3px">Bệnh viện Bình Dân · TP. Hồ Chí Minh</div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-size:19px;font-weight:700;color:#ffffff;letter-spacing:normal">NGHIÊN CỨU KHOA HỌC & SÁNG KIẾN</div>
                        <div style="font-size:13px;color:#e2e8f0;margin-top:3px">${this._esc(yearLabel)}</div>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:20px 36px 8px">
                    <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:12px 16px;text-align:center">
                        <div style="font-size:24px;font-weight:700;color:#1D2357">${topicApproved.length}</div>
                        <div style="font-size:11.5px;font-weight:600;color:#475569">Đề tài xét duyệt</div>
                    </div>
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;text-align:center">
                        <div style="font-size:24px;font-weight:700;color:#15803d">${topicAccepted.length}</div>
                        <div style="font-size:11.5px;font-weight:600;color:#166534">Đề tài nghiệm thu</div>
                    </div>
                    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 16px;text-align:center">
                        <div style="font-size:24px;font-weight:700;color:#1878B4">${initApproved.length}</div>
                        <div style="font-size:11.5px;font-weight:600;color:#0369a1">SKCT xét duyệt</div>
                    </div>
                    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;text-align:center">
                        <div style="font-size:24px;font-weight:700;color:#b45309">${initRecognized.length}</div>
                        <div style="font-size:11.5px;font-weight:600;color:#92400e">SKCT được công nhận</div>
                    </div>
                </div>

                <div style="padding:14px 36px 10px">
                    ${renderTopicsTable(topicApproved, '1. ĐỀ TÀI NGHIÊN CỨU KHOA HỌC XÉT DUYỆT', false)}
                    ${renderTopicsTable(topicAccepted, '2. ĐỀ TÀI NGHIÊN CỨU KHOA HỌC NGHIỆM THU', true)}
                    ${renderInitTable(initApproved, '3. SÁNG KIẾN CẢI TIẾN XÉT DUYỆT', false)}
                    ${renderInitTable(initRecognized, '4. SÁNG KIẾN CẢI TIẾN ĐƯỢC CÔNG NHẬN', true)}
                </div>

                <div style="padding:12px 36px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#64748b;background:#f8fafc">
                    <span>Khoa Phẫu thuật Đại trực tràng — Bệnh viện Bình Dân · Xuất bởi: ${this._esc(exporter)}</span>
                    <span>Xuất lúc ${new Date().toLocaleTimeString('vi-VN')} ngày ${exportDate}</span>
                </div>
            </div>
        `;
        document.body.appendChild(container);

        try {
            await Utils.loadScript('html2canvas');
            const target = container.querySelector('#nckh-export-target');
            const scale = Math.max(Math.ceil(2560 / 1120), 3);
            const canvas = await html2canvas(target, {
                scale,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                allowTaint: false,
                imageTimeout: 15000
            });
            Utils.applyExportWatermark(canvas);
            canvas.toBlob(blob => {
                if (!blob) {
                    Toast.error('Không thể tạo file ảnh.');
                    return;
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const yrSlug = this._filterYear === 'all' ? 'TongHop' : String(this._filterYear);
                const todaySlug = exportDate.replace(/\//g, '');
                a.href = url;
                a.download = `NCKH_SangKien_KhoaPTDTT_${yrSlug}_${todaySlug}.png`;
                a.click();
                URL.revokeObjectURL(url);
                Toast.success('Đã xuất ảnh tổng hợp NCKH & Sáng kiến (2K PNG)!');
            }, 'image/png');
        } catch (err) {
            console.error('[NCKH] Export image error:', err);
            Toast.error('Không thể xuất ảnh. Vui lòng thử lại.');
        } finally {
            if (container.parentNode) container.parentNode.removeChild(container);
        }
    }
};
