// ===== SURGERY STATISTICS & SURGEON DASHBOARD PAGE =====
const SurgeryStatsPage = {
    period: 'all', // week | month | quarter | year | all (default all for comprehensive profile)
    offset: 0, // 0 = current, -1 = previous, 1 = next, etc.
    activeTab: 'radar', // 'radar' (Dashboard BS & Radar) | 'summary' (Tổng hợp toàn khoa)
    expandedDoctor: null, // id of the doctor whose detail is shown in summary table
    primaryDoctorId: 'dept_total', // Default: Toàn khoa (Tổng số ca tuyệt đối)
    compareDoctorId: 'none', // Default: Luôn để trống (Không so sánh)
    roleScope: 'main', // 'main' (Mổ chính) | 'assist' (Phụ mổ) | 'all' (Tất cả tham gia)
    radarScaleMode: 'pct', // 'pct' (Theo tỷ trọng %) | 'count' (Theo số ca tuyệt đối)
    showAllLogbookCases: false, // false = 100 cases, true = all cases
    logbookSearch: '', // search query
    logbookFilterAxis: 'all', // 'all' | 'colon' | 'rectal' | 'proctology' | 'stoma' | 'hernia_wall' | 'upper_gi_combined' | 'unclassified'
    logbookFilterSubAxis: 'all',
    logbookFilterApproach: 'all', // 'all' | 'noisoi' | 'mo' | 'robot' | 'nsth'
    logbookFilterType: 'all', // 'all' | 'chuongtrinh' | 'yeucau' | 'bankhan' | 'robot'
    summaryCohortFilter: 'all', // 'all' | 'internal_attending' | 'internal_trainee' | 'external'

    setSummaryCohortFilter(filter) {
        this.summaryCohortFilter = filter || 'all';
        this.expandedDoctor = null;
        if (typeof App !== 'undefined' && App.renderCurrentPage) {
            App.renderCurrentPage();
        }
    },

    toggleShowAllCases() {
        this.showAllLogbookCases = !this.showAllLogbookCases;
        if (typeof App !== 'undefined' && App.renderCurrentPage) {
            App.renderCurrentPage();
        }
    },

    setRoleScope(scope) {
        this.roleScope = scope;
        if (typeof App !== 'undefined' && App.renderCurrentPage) {
            App.renderCurrentPage();
        }
    },

    setRadarScaleMode(mode) {
        this.radarScaleMode = mode;
        if (typeof App !== 'undefined' && App.renderCurrentPage) {
            App.renderCurrentPage();
        }
    },

    setLogbookSearch(val) {
        this.logbookSearch = val;
        if (typeof App !== 'undefined' && App.renderCurrentPage) {
            App.renderCurrentPage();
            const input = document.getElementById('sstats-logbook-search-input');
            if (input && typeof input.focus === 'function') {
                input.focus();
                const len = (input.value || '').length;
                if (typeof input.setSelectionRange === 'function') {
                    input.setSelectionRange(len, len);
                }
            }
        }
    },

    setLogbookFilterAxis(axis) {
        this.logbookFilterAxis = axis;
        this.logbookFilterSubAxis = 'all';
        if (typeof App !== 'undefined' && App.renderCurrentPage) {
            App.renderCurrentPage();
            const el = document.getElementById('sstats-logbook-section');
            if (el && axis !== 'all') {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    },

    setLogbookFilterSubAxis(subAxis) {
        this.logbookFilterSubAxis = subAxis;
        if (typeof App !== 'undefined' && App.renderCurrentPage) {
            App.renderCurrentPage();
        }
    },

    setLogbookFilterApproach(app) {
        this.logbookFilterApproach = app;
        if (typeof App !== 'undefined' && App.renderCurrentPage) {
            App.renderCurrentPage();
        }
    },

    setLogbookFilterType(type) {
        this.logbookFilterType = type;
        if (typeof App !== 'undefined' && App.renderCurrentPage) {
            App.renderCurrentPage();
        }
    },

    resetLogbookFilters() {
        this.logbookSearch = '';
        this.logbookFilterAxis = 'all';
        this.logbookFilterSubAxis = 'all';
        this.logbookFilterApproach = 'all';
        this.logbookFilterType = 'all';
        if (typeof App !== 'undefined' && App.renderCurrentPage) {
            App.renderCurrentPage();
        }
    },

    // 6 Trục Năng Lực Lâm Sàng Chuẩn Hóa Khoa PTĐTT — BV Bình Dân (2026)
    // 100% Tiếng Việt chuẩn lâm sàng, không hiển thị tiếng Anh trong ngoặc
    CLINICAL_AXES: {
        colon: {
            id: 'colon',
            label: '1. Phẫu thuật Đại tràng',
            sublabel: 'Cắt ĐT Sigma, ĐT Phải, ĐT Trái, Toàn bộ ĐT',
            get color() { return Utils.cssVar('--chart-2') || '#3492D3'; },
            icon: '🩺',
            desc: 'Cắt đại tràng phải, trái, sigma, toàn phần, CME/D3, làm lại miệng nối'
        },
        rectal: {
            id: 'rectal',
            label: '2. Phẫu thuật Trực tràng',
            sublabel: 'Cắt trước / LAR, Miles / APR, Cắt u tại chỗ',
            get color() { return Utils.cssVar('--chart-1') || '#333C83'; },
            icon: '🎯',
            desc: 'Cắt trước thấp LAR, TME, Miles, TaTME, cắt u qua ngả hậu môn, TAMIS'
        },
        proctology: {
            id: 'proctology',
            label: '3. Hậu môn – Sàn chậu',
            sublabel: 'Trĩ, Rò / Áp xe, Nứt kẽ, Sa sàn chậu',
            get color() { return Utils.cssVar('--chart-3') || '#41822E'; },
            icon: '🩹',
            desc: 'Trĩ Longo/Milligan-Morgan, Rò hậu môn / LIFT / Seton, Nứt kẽ, Áp xe, Sa sàn chậu'
        },
        stoma: {
            id: 'stoma',
            label: '4. Đóng & Mở Hậu môn nhân tạo',
            sublabel: 'Đóng HMNT / Hồi tràng, Mở / Sửa HMNT',
            get color() { return Utils.cssVar('--chart-5') || '#EC3E6D'; },
            icon: '🔄',
            desc: 'Đóng hồi tràng ra da, tái lập lưu thông ruột, mở / sửa HMNT'
        },
        hernia_wall: {
            id: 'hernia_wall',
            label: '5. Thoát vị & Phục hồi Thành bụng',
            sublabel: 'Thoát vị bẹn TAPP/TEP, Mổ mở, Thoát vị vết mổ / rốn',
            get color() { return Utils.cssVar('--chart-4') || '#D97706'; },
            icon: '🛡️',
            desc: 'Thoát vị bẹn TAPP/TEP, Lichtenstein, thoát vị thành bụng, vết mổ, rốn, khe hoành'
        },
        upper_gi_combined: {
            id: 'upper_gi_combined',
            label: '6. Tiêu hóa trên, Gan mật & Phối hợp',
            sublabel: 'Dạ dày, Ruột non, Túi mật, Cấp cứu bụng',
            get color() { return Utils.cssVar('--chart-6') || '#0D9488'; },
            icon: '🔬',
            desc: 'Dạ dày, GIST, ruột non, cắt túi mật, đường mật, ruột thừa, cấp cứu bụng, thám sát phúc mạc'
        }
    },

    UNCLASSIFIED_AXIS: {
        id: 'unclassified',
        label: '⚠️ Chưa phân loại / Ngoại khoa khác cần rà soát',
        sublabel: 'Thủ thuật ngoài tiêu hóa, bướu mỡ, tiết niệu, cần rà soát',
        color: '#94a3b8',
        icon: '⚠️',
        desc: 'Các bản ghi thủ thuật ngoài tiêu hóa/thành bụng hoặc thiếu thông tin'
    },

    SUB_AXIS_MAP: {
        colon: {
            colon_sigmoid: 'Cắt ĐT Sigma',
            colon_right: 'Cắt ĐT Phải / Manh tràng',
            colon_left: 'Cắt ĐT Trái',
            colon_other_combined: 'Cắt toàn bộ ĐT / ESD / Khác'
        },
        rectal: {
            rectal_lar_tme: 'Cắt trước / LAR / TME',
            rectal_miles_apr: 'Phẫu thuật Miles / APR',
            rectal_local_other: 'Cắt u/polyp TT qua ngả HM / Khác'
        },
        proctology: {
            procto_hemorrhoid: 'Trĩ Longo / Milligan-Morgan / Laser',
            procto_fistula_abscess: 'Rò hậu môn / Áp xe / LIFT / Seton',
            procto_other_pelvic: 'Nứt / Hẹp HM / Sa sàn chậu / Khác'
        },
        stoma: {
            stoma_reversal: 'Đóng HMNT / Đóng hồi tràng / Tái lập lưu thông',
            stoma_creation_revision: 'Mở / Làm / Sửa / Tạo hình HMNT'
        },
        hernia_wall: {
            hernia_inguinal_open: 'Thoát vị bẹn mổ mở',
            hernia_inguinal_mis: 'Thoát vị bẹn PTNS TAPP/TEP',
            hernia_ventral_diaphragm_other: 'Thoát vị thành bụng / vết mổ / rốn / khe hoành'
        },
        upper_gi_combined: {
            upper_gi_stomach_smallbowel: 'Dạ dày – Ruột non – GIST',
            upper_gi_biliary: 'Túi mật – Đường mật – Gan',
            upper_gi_acute_combined: 'Ruột thừa – Cấp cứu bụng – Thám sát'
        },
        unclassified: {
            unclassified_other: 'Thủ thuật ngoài tiêu hóa / thành bụng',
            unclassified_empty: 'Bản ghi thiếu thông tin'
        }
    },

    getSubAxisLabel(axisKey, subKey) {
        if (!subKey) return '—';
        if (axisKey && this.SUB_AXIS_MAP[axisKey] && this.SUB_AXIS_MAP[axisKey][subKey]) {
            return this.SUB_AXIS_MAP[axisKey][subKey];
        }
        for (const map of Object.values(this.SUB_AXIS_MAP)) {
            if (map && map[subKey]) return map[subKey];
        }
        return subKey;
    },

    // Helper: chuẩn hóa ID bác sĩ sang chuỗi hoặc null
    normId(id) {
        if (id === null || id === undefined) return null;
        const s = String(id).trim();
        return s === '' ? null : s;
    },

    // Filter: BCN khoa + Bác sĩ chính + Bác sĩ học viên (BSNT) + External doctors + Departed
    getEligibleDoctors() {
        const staff = Store.getAll('staff') || [];
        const internal = staff.filter(s =>
            (s.role && (s.role.includes('Bác sĩ') || s.role.includes('BS') || s.role.includes('Trưởng khoa') || s.role.includes('Phó trưởng khoa'))) &&
            !s.role.includes('Điều dưỡng')
        ).map(d => {
            const role = d.role || '';
            const isTrainee = role.includes('học viên') || role.includes('BSNT');
            return {
                ...d,
                name: d.name || d.code || `BS #${d.id}`,
                cohortType: isTrainee ? 'internal_trainee' : 'internal_attending',
                isExternal: false,
                isDeparted: false
            };
        });

        const external = (Store.getAll('externalDoctors') || []).map(d => ({
            ...d,
            name: d.name || d.code || `BS #${d.id}`,
            role: d.position || d.role || 'BS ngoài khoa',
            cohortType: 'external',
            isExternal: true,
            isDeparted: false
        }));

        const departed = (Store.getAll('departedStaff') || []).map(d => ({
            ...d,
            name: d.name || d.code || `BS #${d.id}`,
            role: 'Đã chuyển/nghỉ',
            cohortType: 'historical_departed',
            isExternal: false,
            isDeparted: true
        }));

        return [...internal, ...external, ...departed];
    },

    // Get date range for current period + offset
    getDateRange() {
        if (this.period === 'all') {
            return this._getAllTimeRange();
        }

        const now = new Date();
        let start, end;

        if (this.period === 'week') {
            const day = now.getDay();
            start = new Date(now);
            start.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + (this.offset * 7));
            start.setHours(0, 0, 0, 0);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else if (this.period === 'month') {
            const targetMonth = now.getMonth() + this.offset;
            start = new Date(now.getFullYear(), targetMonth, 1);
            end = new Date(now.getFullYear(), targetMonth + 1, 0, 23, 59, 59, 999);
        } else if (this.period === 'quarter') {
            const currentQ = Math.floor(now.getMonth() / 3);
            const baseMonth = currentQ * 3 + this.offset * 3;
            start = new Date(now.getFullYear(), baseMonth, 1);
            end = new Date(now.getFullYear(), baseMonth + 3, 0, 23, 59, 59, 999);
        } else if (this.period === 'year') {
            const targetYear = now.getFullYear() + this.offset;
            start = new Date(targetYear, 0, 1);
            end = new Date(targetYear, 11, 31, 23, 59, 59, 999);
        }

        return { start, end };
    },

    _getAllTimeRange() {
        const all = SurgeryPage.getAllSurgeries() || [];
        const now = new Date();
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        if (all.length === 0) {
            return { start: new Date(now.getFullYear(), 0, 1), end: todayEnd };
        }
        // Thống kê toàn bộ chỉ tính tới ngày hiện tại, không tính xa hơn
        const todayStr = this.getTodayStr();
        const pastSurgeries = all.filter(s => s && s.date && s.date <= todayStr);
        if (pastSurgeries.length === 0) {
            return { start: new Date(now.getFullYear(), 0, 1), end: todayEnd };
        }
        const sortedDates = pastSurgeries.map(s => s.date).sort();
        const [sy, sm, sd] = sortedDates[0].split('-').map(Number);
        const start = new Date(sy || now.getFullYear(), (sm || 1) - 1, sd || 1, 0, 0, 0, 0);
        const end = todayEnd;
        return { start, end };
    },

    getTodayStr() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    formatDateStr(d) {
        if (!d || typeof d.getFullYear !== 'function' || isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    },

    getPeriodLabel() {
        if (this.period === 'all') {
            const { start, end } = this._getAllTimeRange();
            const fmt = d => `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
            return `Toàn bộ (${fmt(start)} — ${fmt(end)})`;
        }

        const { start, end } = this.getDateRange();

        if (this.period === 'week') {
            return `Tuần ${start.getDate()}/${start.getMonth()+1} — ${end.getDate()}/${end.getMonth()+1}/${end.getFullYear()}`;
        } else if (this.period === 'month') {
            return `Tháng ${start.getMonth()+1}/${start.getFullYear()}`;
        } else if (this.period === 'quarter') {
            const q = Math.floor(start.getMonth() / 3) + 1;
            return `Quý ${q}/${start.getFullYear()}`;
        } else {
            return `Năm ${start.getFullYear()}`;
        }
    },

    getSurgeriesInRange() {
        const all = SurgeryPage.getAllSurgeries() || [];
        const todayStr = this.getTodayStr();
        if (this.period === 'all') {
            return all.filter(s => s && s.date && s.date <= todayStr);
        }
        const { start, end } = this.getDateRange();
        const startStr = this.formatDateStr(start);
        const endStr = this.formatDateStr(end);
        const effectiveEndStr = (endStr > todayStr) ? todayStr : endStr;
        return all.filter(s => s && s.date && s.date >= startStr && s.date <= effectiveEndStr);
    },

    getScheduledFutureCount() {
        const all = SurgeryPage.getAllSurgeries() || [];
        const todayStr = this.getTodayStr();
        if (this.period === 'all') {
            return all.filter(s => s && s.date && s.date > todayStr).length;
        }
        const { start, end } = this.getDateRange();
        const endStr = this.formatDateStr(end);
        return all.filter(s => s && s.date && s.date > todayStr && s.date <= endStr).length;
    },

    getPatientRoom(patientName) { // eslint-disable-line no-unused-vars
        return '—';
    },

    // ===== THUẬT TOÁN PHÂN LOẠI 6 TRỤC NĂNG LỰC LÂM SÀNG PHẪU THUẬT (CLASSIFIER v2.0) =====
    normalizeClinicalText(str) {
        return String(str || '')
            .normalize('NFC')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/thóat/g, 'thoát')
            .replace(/đòng hồi tràng/g, 'đóng hồi tràng')
            .replace(/hartman\b/g, 'hartmann')
            .replace(/polype|polip/g, 'polyp')
            .replace(/comdyloma/g, 'condyloma')
            .replace(/carcimatosis/g, 'carcinomatosis')
            .replace(/apxe|áp-xe/g, 'áp xe')
            .replace(/phẫu thật/g, 'phẫu thuật')
            .replace(/qua ngả hậu môn/g, 'qua ngã hậu môn')
            .trim();
    },

    /**
     * Phân loại chi tiết ca mổ thành { axis, subAxis, tags }
     * Thứ tự ưu tiên tất định P0 -> P7, phân hoạch nghiêm ngặt 6 trục + unclassified
     */
    classifySurgeryDetail(s) {
        if (!s) return { axis: 'unclassified', subAxis: 'unclassified_empty', tags: [] };
        const method = this.normalizeClinicalText(s.method);
        const diag = this.normalizeClinicalText(s.diagnosis);
        if (!method && !diag) {
            return { axis: 'unclassified', subAxis: 'unclassified_empty', tags: [] };
        }
        const text = `${method} | ${diag}`;
        const tags = [];

        // Secondary/concurrent procedure tags (non-exclusive)
        if (['hmnt', 'hậu môn nhân tạo', 'hậu môn tạm', 'hồi tràng ra da', 'đóng hồi tràng', 'mở hồi tràng', 'hartmann reversal', 'tái lập lưu thông'].some(k => text.includes(k))) {
            tags.push('tag_stoma');
        }
        if (['thoát vị', 'hernia', 'tapp', 'tep', 'lichtenstein', 'ipom', 'phục hồi thành bụng', 'phục hồi thành bẹn', 'phục hồi khe hoành'].some(k => text.includes(k))) {
            tags.push('tag_hernia');
        }
        if (['túi mật', 'cholecystectomy', 'sỏi mật', 'ống mật chủ'].some(k => text.includes(k))) {
            tags.push('tag_biliary');
        }
        if (['ruột thừa', 'appendectomy'].some(k => text.includes(k))) {
            tags.push('tag_appendix');
        }

        const isReversalOp = method.includes('reversal') || method.includes('tái lập lưu thông') || method.includes('lập lại lưu thông');
        const hasMajorResection = !isReversalOp && [
            'cắt đại tràng', 'cắt trước thấp', 'cắt trước', 'cắt cực thấp', 'cắt trực tràng', 'miles', 'cắt cụt',
            'lar', 'tme', 'tatme', 'cắt toàn bộ đại tràng', 'cắt nửa đại tràng', 'cắt đoạn đại tràng', 'colectomy',
            'phẫu thuật hartmann', 'mổ hartmann', 'ptns hartmann', 'mổ mở hartmann'
        ].some(k => method.includes(k));

        // Priority 1: Trục 4 — Đóng & Mở Hậu môn nhân tạo (stoma)
        const isStomaOp = (
            (method.includes('đóng') && ['hồi tràng', 'hmnt', 'hậu môn nhân tạo', 'hậu môn tạm', 'đại tràng', 'lỗ mở', 'ruột', 'mổ'].some(k => method.includes(k))) ||
            isReversalOp ||
            (method.includes('phẫu thuật đóng') && ['hmnt', 'hồi tràng', 'hậu môn nhân tạo', 'hậu môn tạm'].some(k => text.includes(k))) ||
            ((method.includes('mở') || method.includes('làm') || method.includes('chuyển lưu')) &&
             ['hồi tràng', 'hmnt', 'hậu môn nhân tạo', 'hậu môn tạm'].some(k => method.includes(k)) && !hasMajorResection) ||
            ['sửa hmnt', 'sửa lại hmnt', 'sửa hậu môn nhân tạo', 'tạo hình hmnt', 'tạo hình hậu môn nhân tạo', 'chăm sóc hmnt', 'đặt lại hmnt', 'hạ lưu', 'sa hậu môn nhân tạo', 'sa hmnt'].some(k => method.includes(k) || (diag.includes(k) && !method.includes('phục hồi thành bụng') && !method.includes('ipom')))
        );

        if (isStomaOp && !hasMajorResection) {
            const isRev = method.includes('đóng') || isReversalOp;
            return { axis: 'stoma', subAxis: isRev ? 'stoma_reversal' : 'stoma_creation_revision', tags };
        }

        // Transanal excision/biopsy of rectal tumor/polyp -> belongs to Rectal (Axis 2), not Proctology (Axis 3)
        const isRectalLesionTransanal =
            ['qua ngã hậu môn', 'tamis', 'tem', 'esd'].some(k => method.includes(k)) &&
            ['trực tràng', 'lst-ng trực tràng'].some(k => text.includes(k)) &&
            !['trĩ', 'rò hậu môn', 'nứt hậu môn', 'sa trực tràng', 'sa hậu môn trực tràng', 'vách trực tràng âm đạo', 'rò âm đạo - trực tràng'].some(k => text.includes(k));

        // Priority 2: Trục 3 — Hậu môn – Sàn chậu (proctology)
        const isProctologyOp = !isRectalLesionTransanal && (
            [
                'trĩ', 'longo', 'milligan', 'ferguson', 'khâu treo trĩ', 'thắt trĩ', 'triệt mạch trĩ', 'thd',
                'rò hậu môn', 'fistula', 'fistulotomy', 'fistulectomy', 'lift', 'seton', 'cột dây thun',
                'mô xơ đường rò', 'cắt mô xơ', 'cắt đường rò', 'nứt kẽ', 'nứt hậu môn', 'cắt cơ thắt', 'cơ thắt trong hậu môn',
                'áp xe hậu môn', 'áp xe quanh hậu môn', 'áp xe cạnh hậu môn', 'áp xe cạnh trái hậu môn', 'áp xe cạnh phải hậu môn',
                'polyp hậu môn', 'polyp và da thừa', 'u nhú hậu môn', 'condyloma',
                'sùi mào gà', 'da thừa hậu môn', 'đốt u sùi', 'rò âm đạo - trực tràng', 'rò trực tràng',
                'sa trực tràng', 'sa hậu môn trực tràng', 'sa sàn chậu', 'delorme', 'altemeier', 'thiersch', 'rectopexy', 'cố định trực tràng', 'cố định sàn chậu',
                'cắt polyp qua ngã hậu môn', 'cắt u qua ngã hậu môn',
                'cùng cụt', 'rò cùng cụt', 'xoang cùng cụt', 'xoang tổ lông', 'xoang lông', 'pilonidal', 'nang tổ lông',
                'cắt u mỡ quanh hậu môn', 'cắt u mỡ hậu môn', 'dẫn lưu áp xe hậu môn', 'polyp ống hậu môn',
                'thắt trĩ qua nội soi', 'tiêm xơ trĩ', 'hẹp hậu môn', 'tạo hình ống hậu môn', 'tạo hình hậu môn', 'nong hậu môn', 'vách trực tràng âm đạo'
            ].some(k => method.includes(k)) ||
            (
                [
                    'trĩ', 'rò hậu môn', 'rò cạnh hậu môn', 'rò cạnh trái hậu môn', 'rò cạnh phải hậu môn',
                    'nứt kẽ', 'nứt hậu môn', 'áp xe quanh hậu môn', 'áp xe hậu môn', 'áp xe cạnh hậu môn', 'áp xe cạnh trái hậu môn', 'áp xe cạnh phải hậu môn',
                    'sa trực tràng', 'sa hậu môn trực tràng', 'sa sàn chậu', 'condyloma', 'sùi mào gà',
                    'xoang cùng cụt', 'rò cùng cụt', 'xoang tổ lông', 'xoang lông', 'nang tổ lông', 'polyp ống hậu môn', 'polyp hậu môn',
                    'hẹp hậu môn', 'rò vùng mông', 'u nang mông', 'áp xe tầng sinh môn', 'u mỡ cạnh trái hậu môn', 'u mỡ cạnh phải hậu môn', 'u mỡ quanh hậu môn'
                ].some(k => diag.includes(k)) &&
                !hasMajorResection &&
                !['k trực tràng', 'k đại tràng', 'ung thư đại tràng', 'ung thư trực tràng', 'u ác trực tràng', 'u ác đại tràng'].some(k => diag.includes(k))
            )
        );

        if (isProctologyOp && !hasMajorResection) {
            let subAxis = 'procto_other_pelvic';
            if (['trĩ', 'longo', 'milligan', 'ferguson', 'thd'].some(k => text.includes(k))) {
                subAxis = 'procto_hemorrhoid';
            } else if (['rò hậu môn', 'rò cạnh', 'áp xe', 'lift', 'seton', 'fistul'].some(k => text.includes(k))) {
                subAxis = 'procto_fistula_abscess';
            }
            return { axis: 'proctology', subAxis, tags };
        }

        // Priority 3: Trục 5 — Thoát vị & Phục hồi Thành bụng (hernia_wall)
        const isHerniaWallOp = (
            [
                'thoát vị bẹn', 'thoát vị thành bụng', 'thoát vị vết mổ', 'thoát vị đùi', 'thoát vị rốn',
                'thoát vị hoành', 'thoát vị khe hoành', 'thoát vị hông lưng', 'thoát vị cạnh hậu môn nhân tạo', 'thoát vị quanh hmnt',
                'phục hồi thành bụng', 'phục hồi thành bẹn', 'phục hồi rốn', 'phục hồi cơ hoành', 'phục hồi khe hoành', 'phục hồi hông lưng',
                'tapp', 'tep', 'lichtenstein', 'ipom', 'shouldice', 'bassini',
                'nang ống phúc tinh mạc', 'nang nước thừng tinh', 'nang thừng tinh', 'nang vùng bẹn',
                'u thành bụng', 'u mỡ thành bụng', 'áp xe thành bụng'
            ].some(k => method.includes(k)) ||
            (
                [
                    'thoát vị bẹn', 'thoát vị thành bụng', 'thoát vị rốn', 'thoát vị hoành', 'thoát vị khe hoành',
                    'thoát vị vết mổ', 'thoát vị đùi', 'thoát vị hông lưng', 'thoát vị cạnh hậu môn nhân tạo', 'thoát vị quanh hmnt',
                    'nang ống phúc tinh mạc', 'nang nước thừng tinh', 'nang thừng tinh', 'nang vùng bẹn', 'u thành bụng', 'u mỡ thành bụng'
                ].some(k => diag.includes(k)) &&
                !hasMajorResection &&
                !['k trực tràng', 'k đại tràng', 'ung thư đại tràng', 'ung thư trực tràng'].some(k => diag.includes(k))
            )
        );

        if (isHerniaWallOp && !hasMajorResection) {
            let subAxis = 'hernia_ventral_diaphragm_other';
            const isInguinal = ['bẹn', 'đùi', 'tapp', 'tep', 'lichtenstein', 'phúc tinh mạc', 'thừng tinh'].some(k => text.includes(k));
            if (isInguinal && (['tapp', 'tep', 'ptns', 'nội soi', 'robot'].some(k => method.includes(k)) || (s.approachType === 'noisoi' || s.approachType === 'robot'))) {
                subAxis = 'hernia_inguinal_mis';
            } else if (isInguinal) {
                subAxis = 'hernia_inguinal_open';
            }
            return { axis: 'hernia_wall', subAxis, tags };
        }

        // Method-First Guard for Explicit Upper GI / Biliary / Adnexal Procedures
        const isExplicitNonColorectalMethod = [
            'túi mật', 'cholecystectomy', 'sỏi mật', 'ống mật chủ', 'ercp', 'nang gan', 'cắt gan',
            'cắt dạ dày', 'cắt bán phần dưới dạ dày', 'khâu lỗ thủng dạ dày', 'mở thông dạ dày', 'nối vị tràng',
            'cắt ruột non', 'cắt đoạn ruột non', 'mở hỗng tràng', 'mở thông hỗng tràng', 'cắt u hỗng tràng',
            'cắt lách', 'cắt buồng trứng', 'cắt u buồng trứng', 'cắt phần phụ', 'cắt tử cung', 'cắt ruột thừa',
            'esd dạ dày', 'esd thực quản', 'esd tá tràng', 'gỡ dính'
        ].some(k => method.includes(k)) && !hasMajorResection && !method.includes('đại tràng') && !method.includes('trực tràng');

        if (isExplicitNonColorectalMethod) {
            let subAxis = 'upper_gi_acute_combined';
            if (['túi mật', 'cholecystectomy', 'sỏi mật', 'ống mật chủ', 'ercp', 'nang gan', 'cắt gan'].some(k => text.includes(k))) {
                subAxis = 'upper_gi_biliary';
            } else if (['dạ dày', 'tá tràng', 'thực quản', 'tâm vị', 'môn vị', 'hang vị', 'thân vị', 'ruột non', 'hỗng tràng', 'hồi tràng', 'gist', 'nối vị tràng'].some(k => text.includes(k))) {
                subAxis = 'upper_gi_stomach_smallbowel';
            }
            return { axis: 'upper_gi_combined', subAxis, tags };
        }

        // Priority 4: Trục 2 — Phẫu thuật Trực tràng (rectal)
        const isRectalOp = isRectalLesionTransanal || (
            [
                'cắt trước thấp', 'cắt trước cực thấp', 'cắt cực thấp', 'cắt trước', 'lar', 'tme', 'miles', 'apr',
                'cắt cụt trực tràng', 'cắt trực tràng', 'cắt đoạn trực tràng',
                'tatme', 'tamis', 'tem', 'bảo tồn cơ thắt', 'gian cơ thắt', 'isr', 'pull-through', 'pull through',
                'kraske', 'mason', 'cắt u trực tràng', 'phẫu thuật nội soi cắt u trực tràng', 'sinh thiết u qua ngã hậu môn',
                'sinh thiết qua ngã hậu môn', 'nong miệng nối trực tràng', 'cắt polyp trực tràng'
            ].some(k => method.includes(k)) ||
            (
                [
                    'k trực tràng', 'u ác trực tràng', 'u ác của trực tràng', 'u ác tính của trực tràng',
                    'u trực tràng', 'k ống hậu môn', 'carcinoma trực tràng', 'ung thư trực tràng',
                    'polyp trực tràng', 'u dưới niêm trực tràng', 'polyp lớn trực tràng', 'u lst-ng trực tràng',
                    'gist trực tràng', 'hẹp miệng nối trực tràng', 'thủng trực tràng', 'dị vật lòng trực tràng', 'rò bàng quang trực tràng'
                ].some(k => diag.includes(k)) &&
                ['cắt', 'nạo hạch', 'ptns', 'robot', 'mổ mở', 'phẫu thuật', 'esd', 'sinh thiết', 'nong', 'vá lỗ rò', 'lấy dị vật', 'dẫn lưu'].some(k => method.includes(k)) &&
                !['cắt đại tràng phải', 'cắt đại tràng trái', 'cắt đại tràng sigma', 'cắt đại tràng ngang'].some(k => method.includes(k))
            )
        );

        if (isRectalOp) {
            let subAxis = 'rectal_local_other';
            if (['miles', 'apr', 'cắt cụt trực tràng'].some(k => method.includes(k))) {
                subAxis = 'rectal_miles_apr';
            } else if (['cắt trước', 'cắt trực tràng', 'cắt đoạn trực tràng', 'lar', 'tme', 'tatme', 'pull-through', 'pull through', 'isr'].some(k => method.includes(k))) {
                subAxis = 'rectal_lar_tme';
            }
            return { axis: 'rectal', subAxis, tags };
        }

        // Priority 5: Trục 1 — Phẫu thuật Đại tràng (colon)
        const isColonOp = (
            [
                'cắt đại tràng', 'đại tràng phải', 'đại tràng trái', 'đại tràng sigma', 'đại tràng ngang',
                'đại tràng góc gan', 'đại tràng góc lách', 'cắt toàn bộ đại tràng', 'cắt gần toàn bộ đại tràng',
                'cắt nửa đại tràng', 'cme', 'd3', 'colectomy', 'hemicolectomy', 'cắt manh tràng', 'cắt đoạn đại tràng',
                'cắt u đại tràng', 'cắt polyp đại tràng', 'nội soi đại tràng cắt polyp', 'manh tràng',
                'phẫu thuật hartmann', 'mổ hartmann', 'ptns hartmann', 'mổ mở hartmann',
                'khâu lỗ thủng đại tràng', 'xẻ đại tràng'
            ].some(k => method.includes(k)) ||
            (
                [
                    'k đại tràng', 'u ác đại tràng', 'u ác của đại tràng', 'u đại tràng', 'k sigma', 'u sigma',
                    'k manh tràng', 'u manh tràng', 'ung thư đại tràng', 'viêm túi thừa đại tràng', 'thủng túi thừa đại tràng',
                    'xoắn đại tràng', 'xoắn sigma', 'polyp đại tràng', 'dị vật trong lòng đại tràng', 'dị vật răng giả xuyên thành đại tràng'
                ].some(k => diag.includes(k)) &&
                ['cắt', 'nạo hạch', 'ptns', 'robot', 'mổ mở', 'phẫu thuật', 'esd', 'nội soi', 'làm lại miệng nối'].some(k => method.includes(k))
            )
        );

        if (isColonOp) {
            let subAxis = 'colon_other_combined';
            if (['đại tràng phải', 'đại tràng (p)', 'manh tràng', 'đại tràng lên', 'góc gan'].some(k => text.includes(k))) {
                subAxis = 'colon_right';
            } else if (['sigma', 'chậu hông'].some(k => text.includes(k))) {
                subAxis = 'colon_sigmoid';
            } else if (['đại tràng trái', 'đại tràng (t)', 'đại tràng xuống', 'góc lách'].some(k => text.includes(k))) {
                subAxis = 'colon_left';
            }
            return { axis: 'colon', subAxis, tags };
        }

        // Priority 6: Trục 6 — Tiêu hóa trên, Gan mật & Phối hợp (upper_gi_combined)
        const isUpperGiBiliaryCombinedOp = (
            [
                'túi mật', 'cholecystectomy', 'sỏi mật', 'ống mật chủ', 'ercp', 'nang gan', 'cắt gan',
                'ruột non', 'cắt ruột non', 'cắt đoạn ruột non', 'hồi tràng', 'hỗng tràng', 'nối ruột', 'nối vị tràng', 'nối tắt',
                'dạ dày', 'cắt dạ dày', 'khâu lỗ thủng dạ dày', 'mở thông dạ dày', 'mở hỗng tràng', 'mở thông hỗng tràng',
                'lách', 'cắt lách', 'tụy', 'tá tràng', 'thực quản', 'tâm vị', 'môn vị', 'hang vị', 'thân vị', 'gist',
                'esd dạ dày', 'esd thực quản', 'esd tá tràng', 'cắt u dưới niêm',
                'u mạc treo', 'nang mạc treo', 'u sau phúc mạc', 'u mỡ sau phúc mạc', 'nang sau phúc mạc', 'sarcoma',
                'nang niệu rốn', 'xoang niệu rốn', 'dây chằng rốn', 'nang buồng trứng', 'cắt tử cung', 'cắt buồng trứng', 'cắt phần phụ', 'nang vùng chậu', 'nang lớn vùng chậu',
                'ruột thừa', 'viêm phúc mạc', 'tắc ruột', 'gỡ dính', 'thủng tạng', 'thủng ruột',
                'xuất huyết nội', 'xuất huyết tiêu hóa', 'khâu cầm máu', 'áp xe tồn lưu', 'áp xe mạc nối lớn', 'áp xe ổ bụng',
                'carcinomatosis', 'lao màng bụng', 'lao ổ bụng', 'lao ruột', 'lymphoma ổ bụng', 'hạch ổ bụng', 'hạch động mạch chủ bụng', 'tràn dịch ổ bụng'
            ].some(k => text.includes(k))
        );

        if (isUpperGiBiliaryCombinedOp) {
            let subAxis = 'upper_gi_acute_combined';
            if (['túi mật', 'cholecystectomy', 'sỏi mật', 'ống mật chủ', 'ercp', 'nang gan', 'cắt gan'].some(k => text.includes(k)) &&
                !['dạ dày', 'tá tràng', 'thực quản', 'ruột non', 'hỗng tràng', 'hồi tràng'].some(k => text.includes(k))) {
                subAxis = 'upper_gi_biliary';
            } else if (['dạ dày', 'tá tràng', 'thực quản', 'tâm vị', 'môn vị', 'hang vị', 'thân vị', 'ruột non', 'hỗng tràng', 'hồi tràng', 'gist', 'nối vị tràng'].some(k => text.includes(k))) {
                subAxis = 'upper_gi_stomach_smallbowel';
            }
            return { axis: 'upper_gi_combined', subAxis, tags };
        }

        // Priority 7: Chưa phân loại / Cần rà soát ngoại khoa khác (unclassified)
        return { axis: 'unclassified', subAxis: 'unclassified_other', tags };
    },

    classifySurgery(s) {
        const detail = this.classifySurgeryDetail(s);
        return detail ? detail.axis : 'unclassified';
    },

    classifyOncology(s, detail) {
        const m = this.normalizeClinicalText(s && s.method);
        const d = this.normalizeClinicalText(s && s.diagnosis);
        const text = `${m} | ${d}`;
        const hasMalignancy = /\bk\b|\bk\s|ung thư|u ác|carcinom|adenocarcinom|sarcoma|lymphoma|gist|krukenberg|hóa ác/.test(text);
        if (!hasMalignancy) {
            return { hasMalignancyMention: false, isActiveOncologyProcedure: false, isColorectalOncologyResection: false };
        }
        const cls = detail || this.classifySurgeryDetail(s);
        const isStomaReversal = cls.subAxis === 'stoma_reversal';
        const isActiveOncologyProcedure = !isStomaReversal;
        const isColorectalOncologyResection =
            isActiveOncologyProcedure &&
            (cls.axis === 'colon' || cls.axis === 'rectal') &&
            ['cắt', 'miles', 'apr', 'lar', 'tme', 'tatme', 'hartmann', 'pull-through', 'pull through', 'isr', 'tamis', 'esd'].some(k => m.includes(k));
        return { hasMalignancyMention: true, isActiveOncologyProcedure, isColorectalOncologyResection };
    },
    // Tính toán hồ sơ năng lực chi tiết của 1 bác sĩ hoặc bình quân khoa / BS
    computeSurgeonProfile(doctorId, surgeries, roleScope = this.roleScope || 'main') {
        if (!doctorId || doctorId === 'none') {
            return null;
        }

        const normDocId = this.normId(doctorId);
        const allSurgeries = surgeries || [];
        const allDocs = this.getEligibleDoctors();
        const axisKeys = Object.keys(this.CLINICAL_AXES);

        let cases = [];
        let docInfo = null;
        const isDeptTotal = (normDocId === 'dept_total');
        const isDeptAvg = (normDocId === 'dept_avg');

        let mainCount = 0;
        let assistOnlyCount = 0;
        let participatedCount = 0;

        if (isDeptTotal) {
            cases = allSurgeries;
            mainCount = cases.length;
            assistOnlyCount = 0;
            participatedCount = cases.length;
            docInfo = {
                id: 'dept_total',
                name: 'Toàn Khoa',
                role: 'Tổng khối lượng phẫu thuật toàn khoa',
                shortName: 'Toàn Khoa',
                color: Utils.cssVar('--primary-fill') || '#1D2357',
                isDeptTotal: true,
                totalRawCases: cases.length
            };
        } else if (isDeptAvg) {
            // Mẫu số C_bench: các BS cơ hữu chính thức (internal_attending) có ít nhất 1 ca mổ chính trong kỳ
            const attendingDocs = allDocs.filter(d => d.cohortType === 'internal_attending');
            const activeAttending = attendingDocs.filter(d => {
                const dId = this.normId(d.id);
                return allSurgeries.some(s => this.normId(s.mainSurgeon) === dId);
            });
            const M = activeAttending.length;
            const activeAttendingIds = new Set(activeAttending.map(d => this.normId(d.id)));

            // Tập tử số S_bench: các ca mổ chính do BS trong C_bench thực hiện (loại trừ external mổ chính)
            cases = allSurgeries.filter(s => activeAttendingIds.has(this.normId(s.mainSurgeon)));

            // Tính tổng số ca phụ mổ khử trùng của các BS trong C_bench
            let totalBenchAssistOnly = 0;
            activeAttending.forEach(d => {
                const dId = this.normId(d.id);
                const assistOnly = allSurgeries.filter(s =>
                    this.normId(s.mainSurgeon) !== dId &&
                    (this.normId(s.assistSurgeon1) === dId || this.normId(s.assistSurgeon2) === dId)
                ).length;
                totalBenchAssistOnly += assistOnly;
            });

            mainCount = M > 0 ? Number((cases.length / M).toFixed(1)) : 0;
            assistOnlyCount = M > 0 ? Number((totalBenchAssistOnly / M).toFixed(1)) : 0;
            participatedCount = Number((mainCount + assistOnlyCount).toFixed(1));

            docInfo = {
                id: 'dept_avg',
                name: 'Bình quân BS chính',
                role: `TB trên ${M}/${attendingDocs.length} BS chính cơ hữu có ca trong kỳ`,
                shortName: 'Bình quân',
                color: Utils.cssVar('--accent') || '#1878B4',
                isDeptAvg: true,
                activeSurgeonsCount: M,
                totalAttendingCount: attendingDocs.length,
                totalBenchCases: cases.length
            };
        } else {
            // Cá nhân 1 bác sĩ
            const foundDoc = allDocs.find(d => this.normId(d.id) === normDocId);
            docInfo = foundDoc || {
                id: doctorId,
                name: 'Bác sĩ ' + doctorId,
                role: 'Phẫu thuật viên',
                color: Utils.cssVar('--primary-fill') || '#1D2357'
            };
            const docName = (docInfo && docInfo.name) ? docInfo.name : 'Bác sĩ';
            docInfo.shortName = docName.split(' ').pop();

            const dId = normDocId;
            const myMainCases = allSurgeries.filter(s => this.normId(s.mainSurgeon) === dId);
            const myAssistOnlyCases = allSurgeries.filter(s =>
                this.normId(s.mainSurgeon) !== dId &&
                (this.normId(s.assistSurgeon1) === dId || this.normId(s.assistSurgeon2) === dId)
            );
            const myParticipatedCases = allSurgeries.filter(s =>
                this.normId(s.mainSurgeon) === dId ||
                this.normId(s.assistSurgeon1) === dId ||
                this.normId(s.assistSurgeon2) === dId
            );

            mainCount = myMainCases.length;
            assistOnlyCount = myAssistOnlyCases.length;
            participatedCount = mainCount + assistOnlyCount;

            if (roleScope === 'assist') {
                cases = myAssistOnlyCases;
            } else if (roleScope === 'all') {
                cases = myParticipatedCases;
            } else {
                cases = myMainCases;
            }
        }

        // Phân loại 6 trục + unclassified
        const axisCounts = {};
        const axisDetails = {};
        const subAxisCounts = {};
        axisKeys.forEach(k => {
            axisCounts[k] = 0;
            axisDetails[k] = [];
            if (this.SUB_AXIS_MAP[k]) {
                Object.keys(this.SUB_AXIS_MAP[k]).forEach(sk => { subAxisCounts[sk] = 0; });
            }
        });
        if (this.SUB_AXIS_MAP.unclassified) {
            Object.keys(this.SUB_AXIS_MAP.unclassified).forEach(sk => { subAxisCounts[sk] = 0; });
        }
        let unclassifiedCount = 0;
        const unclassifiedDetails = [];

        cases.forEach(s => {
            const detail = this.classifySurgeryDetail(s);
            const ax = detail.axis;
            if (ax === 'unclassified') {
                unclassifiedCount++;
                unclassifiedDetails.push(s);
            } else if (axisCounts[ax] !== undefined) {
                axisCounts[ax]++;
                axisDetails[ax].push(s);
            }
            if (detail.subAxis) {
                subAxisCounts[detail.subAxis] = (subAxisCounts[detail.subAxis] || 0) + 1;
            }
        });

        const rawSubAxisCounts = { ...subAxisCounts };
        const M = (isDeptAvg && docInfo && docInfo.activeSurgeonsCount > 0) ? docInfo.activeSurgeonsCount : 1;
        const scaleCount = (val) => isDeptAvg ? Number((val / M).toFixed(1)) : val;

        // Nếu là dept_avg, chuyển đổi các số đếm thành bình quân trên M bác sĩ
        if (isDeptAvg && M > 0) {
            axisKeys.forEach(k => {
                axisCounts[k] = scaleCount(axisCounts[k]);
            });
            unclassifiedCount = scaleCount(unclassifiedCount);
            Object.keys(subAxisCounts).forEach(sk => {
                subAxisCounts[sk] = scaleCount(subAxisCounts[sk]);
            });
        }

        const total = isDeptAvg ? mainCount : cases.length;
        const totalRaw = cases.length;

        // Tỷ trọng % theo từng trục
        const axisPct = {};
        axisKeys.forEach(k => {
            axisPct[k] = totalRaw > 0 ? Number(((axisDetails[k].length / totalRaw) * 100).toFixed(1)) : 0;
        });
        const unclassifiedPct = totalRaw > 0 ? Number(((unclassifiedDetails.length / totalRaw) * 100).toFixed(1)) : 0;

        // Thống kê tiếp cận (MIS) & loại mổ qua SurgeryMetrics
        const misStats = (typeof SurgeryMetrics !== 'undefined')
            ? SurgeryMetrics.calculateMIS(cases)
            : { misCases: 0, mo: 0, noisoi: 0, robot: 0, nsth: 0, unknown: 0, misPct: 0, openPct: 0, noisoiPct: 0, robotPct: 0, nsthPct: 0, unknownPct: 0 };
        const typeBreakdown = (typeof SurgeryMetrics !== 'undefined')
            ? SurgeryMetrics.calculateTypeBreakdown(cases)
            : { yeucau: 0, chuongtrinh: 0, bankhan: 0, robot: 0, unknown: 0, yeucauPct: 0, chuongtrinhPct: 0, bankhanPct: 0, robotPct: 0, unknownPct: 0 };

        const electiveReq = scaleCount(typeBreakdown.yeucau);
        const electiveRoutine = scaleCount(typeBreakdown.chuongtrinh);
        const urgent = scaleCount(typeBreakdown.bankhan);
        const typeRobot = scaleCount(typeBreakdown.robot);

        const misCasesScaled = scaleCount(misStats.misCases);
        const openCasesScaled = scaleCount(misStats.mo);
        const robotCasesScaled = scaleCount(misStats.robot);
        const noisoiCasesScaled = scaleCount(misStats.noisoi);
        const nsthCasesScaled = scaleCount(misStats.nsth);

        const misDetails = {
            ...misStats,
            misCases: misCasesScaled,
            mo: openCasesScaled,
            noisoi: noisoiCasesScaled,
            robot: robotCasesScaled,
            nsth: nsthCasesScaled,
            raw: misStats
        };

        // Hàm thống kê phân phối thời lượng chuẩn xác (khớp audit_reproducible.cjs)
        const summarizeDurArray = (arr) => {
            if (!arr || arr.length === 0) {
                return { n: 0, mean: 0, meanInt: 0, median: 0, p25: 0, p75: 0, min: 0, max: 0 };
            }
            const sorted = [...arr].sort((a, b) => a - b);
            const n = sorted.length;
            const sum = sorted.reduce((a, b) => a + b, 0);
            const mean = Number((sum / n).toFixed(1));
            const meanInt = Math.round(sum / n);
            const q = (p) => sorted[Math.min(n - 1, Math.max(0, Math.floor(p * (n - 1))))];
            return { n, mean, meanInt, median: q(0.5), p25: q(0.25), p75: q(0.75), min: sorted[0], max: sorted[n - 1] };
        };

        // Thống kê thời lượng mổ ghi nhận (n_dur / N) + median / IQR
        const withDur = cases.filter(s => s && parseInt(s.duration, 10) > 0);
        const validDurCount = withDur.length;
        const validDurCoveragePct = totalRaw > 0 ? Number((validDurCount / totalRaw * 100).toFixed(1)) : 0;
        const allDurVals = withDur.map(s => parseInt(s.duration, 10));
        const totalDurMinutes = allDurVals.reduce((sum, v) => sum + v, 0);
        const overallDist = summarizeDurArray(allDurVals);
        const meanDur = overallDist.meanInt;
        const meanDurExact = overallDist.mean;
        const medianDur = overallDist.median;
        const totalDurHours = Number((scaleCount(totalDurMinutes) / 60).toFixed(1));
        const iqrDur = validDurCount > 0
            ? { q1: overallDist.p25, q3: overallDist.p75, text: `${overallDist.p25}–${overallDist.p75}p` }
            : { q1: 0, q3: 0, text: '—' };

        // Thời lượng phân tầng ĐT-TT (Axis 1+2), TV-HMNT (Axis 4+5) và HM-Sàn chậu (Axis 3)
        const colorectalDurs = [];
        const herniaStomaDurs = [];
        const proctoDurs = [];
        withDur.forEach(s => {
            const ax = this.classifySurgery(s);
            const dVal = parseInt(s.duration, 10);
            if (ax === 'colon' || ax === 'rectal') colorectalDurs.push(dVal);
            else if (ax === 'stoma' || ax === 'hernia_wall') herniaStomaDurs.push(dVal);
            else if (ax === 'proctology') proctoDurs.push(dVal);
        });

        const colorectalDist = summarizeDurArray(colorectalDurs);
        const herniaStomaDist = summarizeDurArray(herniaStomaDurs);
        const proctoDist = summarizeDurArray(proctoDurs);

        const colorectalMeanDur = colorectalDist.mean;
        const proctoMeanDur = proctoDist.mean;

        const stratifiedDur = {
            colorectal: { count: colorectalDist.n, meanDur: colorectalDist.mean, median: colorectalDist.median, p25: colorectalDist.p25, p75: colorectalDist.p75 },
            herniaStoma: { count: herniaStomaDist.n, meanDur: herniaStomaDist.mean, median: herniaStomaDist.median, p25: herniaStomaDist.p25, p75: herniaStomaDist.p75 },
            proctology: { count: proctoDist.n, meanDur: proctoDist.mean, median: proctoDist.median, p25: proctoDist.p25, p75: proctoDist.p75 }
        };

        // Thống kê ung thư
        let oncologyResectionsRaw = 0;
        let activeOncologyCountRaw = 0;
        cases.forEach(s => {
            const onco = this.classifyOncology(s);
            if (onco.isColorectalOncologyResection) oncologyResectionsRaw++;
            if (onco.isActiveOncologyProcedure) activeOncologyCountRaw++;
        });
        const oncologyResections = scaleCount(oncologyResectionsRaw);
        const activeOncologyCount = scaleCount(activeOncologyCountRaw);

        return {
            doctor: docInfo,
            isBenchmark: isDeptAvg,
            benchmarkDocCount: isDeptAvg ? (docInfo ? docInfo.activeSurgeonsCount : 0) : 0,
            total,
            totalRaw,
            mainCount,
            assistOnlyCount,
            assistTotal: assistOnlyCount,
            participatedCount,
            roleScope,
            cases: cases.sort((a, b) => (b.date || '').localeCompare(a.date || '')),
            axisCounts,
            axisPct,
            axisDetails,
            subAxisCounts,
            rawSubAxisCounts,
            unclassifiedCount,
            unclassifiedRawCount: unclassifiedDetails.length,
            unclassifiedPct,
            unclassifiedDetails,
            misDetails,
            misCases: misCasesScaled,
            openCases: openCasesScaled,
            robotCases: robotCasesScaled,
            robotCount: robotCasesScaled,
            noisoiCases: noisoiCasesScaled,
            nsthCases: nsthCasesScaled,
            misPct: misStats.misPct,
            openPct: misStats.openPct,
            noisoiPct: misStats.noisoiPct,
            robotPct: misStats.robotPct,
            nsthPct: misStats.nsthPct,
            electiveReq,
            electiveRoutine,
            urgent,
            typeRobot,
            rawTypeBreakdown: typeBreakdown,
            yeucauPct: typeBreakdown.yeucauPct,
            chuongtrinhPct: typeBreakdown.chuongtrinhPct,
            bankhanPct: typeBreakdown.bankhanPct,
            typeRobotPct: typeBreakdown.robotPct,
            validDurCount,
            validDurCoveragePct,
            totalDurHours,
            meanDur,
            meanDurExact,
            medianDur,
            iqrDur,
            colorectalMeanDur,
            proctoMeanDur,
            stratifiedDur,
            oncologyResections,
            activeOncologyCount,
            oncologyResectionsRaw,
            activeOncologyCountRaw,
            oncologyResectionPct: totalRaw > 0 ? Number((oncologyResectionsRaw / totalRaw * 100).toFixed(1)) : 0,
            activeOncologyPct: totalRaw > 0 ? Number((activeOncologyCountRaw / totalRaw * 100).toFixed(1)) : 0
        };
    },

    // Compute detailed stats grouped by doctor (for summary table)
    computeDetailedStats() {
        const doctors = this.getEligibleDoctors();
        const surgeries = this.getSurgeriesInRange();
        const types = Object.keys(SURGERY_TYPES);

        return doctors.map(doc => {
            const dId = this.normId(doc.id);
            const mainCases = surgeries.filter(s => this.normId(s.mainSurgeon) === dId);
            const assistCases = surgeries.filter(s =>
                this.normId(s.mainSurgeon) !== dId &&
                (this.normId(s.assistSurgeon1) === dId || this.normId(s.assistSurgeon2) === dId)
            );
            const participatedCount = mainCases.length + assistCases.length;

            const byType = {};
            types.forEach(t => {
                byType[t] = mainCases.filter(s => (typeof SurgeryMetrics !== 'undefined') ? SurgeryMetrics.resolveSurgeryType(s) === t : s.surgeryType === t).length;
            });

            const isCore = doc.cohortType === 'internal_attending';

            return {
                doctor: doc,
                cases: mainCases.sort((a, b) => (a.date || '').localeCompare(b.date || '')),
                assistCases: assistCases.sort((a, b) => (a.date || '').localeCompare(b.date || '')),
                assistTotal: assistCases.length,
                total: mainCases.length,
                participatedCount,
                isCore,
                byType
            };
        }).filter(d => {
            // Luôn hiển thị đầy đủ 100% BCN và Bác sĩ chính của khoa (dù 0 ca)
            if (d.isCore) return true;
            // Với BS học viên và BS ngoài khoa: chỉ hiển thị nếu có tham gia mổ chính hoặc phụ mổ
            return d.total > 0 || d.assistTotal > 0;
        }).sort((a, b) => {
            // Xếp theo tổng ca mổ chính giảm dần
            if (b.total !== a.total) return b.total - a.total;
            // Nếu cùng số ca mổ chính: xếp theo số ca phụ mổ giảm dần
            if (b.assistTotal !== a.assistTotal) return b.assistTotal - a.assistTotal;
            return (a.doctor.id || 0) - (b.doctor.id || 0);
        });
    },

    _renderDoctorOptions(selectedId, allDocs) {
        const coreDocs = allDocs.filter(d => d.cohortType === 'internal_attending');
        const residentDocs = allDocs.filter(d => d.cohortType === 'internal_trainee');
        const extDocs = allDocs.filter(d => d.cohortType === 'external');
        const departedDocs = allDocs.filter(d => d.cohortType === 'historical_departed');

        const normSel = this.normId(selectedId);
        let html = '';
        if (coreDocs.length > 0) {
            html += `<optgroup label="🩺 BCN & Bác sĩ chính cơ hữu">
                ${coreDocs.map(d => `<option value="${d.id}" ${this.normId(d.id) === normSel ? 'selected' : ''}>${d.name} (${d.role})</option>`).join('')}
            </optgroup>`;
        }
        if (residentDocs.length > 0) {
            html += `<optgroup label="👨‍⚕️ Bác sĩ học viên (BSNT)">
                ${residentDocs.map(d => `<option value="${d.id}" ${this.normId(d.id) === normSel ? 'selected' : ''}>${d.name} (${d.role})</option>`).join('')}
            </optgroup>`;
        }
        if (extDocs.length > 0) {
            html += `<optgroup label="🏥 Bác sĩ phối hợp ngoài khoa">
                ${extDocs.map(d => `<option value="${d.id}" ${this.normId(d.id) === normSel ? 'selected' : ''}>${d.name} (${d.role})</option>`).join('')}
            </optgroup>`;
        }
        if (departedDocs.length > 0) {
            html += `<optgroup label="📋 Nhân sự lịch sử đã chuyển/nghỉ">
                ${departedDocs.map(d => `<option value="${d.id}" ${this.normId(d.id) === normSel ? 'selected' : ''}>${d.name} (${d.role})</option>`).join('')}
            </optgroup>`;
        }
        return html;
    },

    // ===== MAIN RENDER =====
    render() {
        if (typeof App !== 'undefined' && typeof App.isAdmin === 'function' && !App.isAdmin()) {
            return `
            <div class="card sstats-empty-state-card" style="padding: 60px 20px; text-align: center;">
                <div class="sstats-empty-icon" style="font-size: 2.5rem; margin-bottom: 12px;">🔒</div>
                <h3 style="margin-bottom: 8px; color: var(--text-primary); font-size: 1.1rem; font-weight: 700;">Khu Vực Quản Trị Phẫu Thuật</h3>
                <p style="color: var(--text-muted); font-size: 0.85rem;">Phân hệ Thống Kê Phẫu Thuật & Dashboard Bác Sĩ chỉ dành riêng cho Quản trị viên (Admin/BCN Khoa).</p>
            </div>`;
        }

        const surgeries = this.getSurgeriesInRange();
        const allDocs = this.getEligibleDoctors();
        const isAllPeriod = this.period === 'all';

        return `
        <div class="page-header sstats-header">
            <div>
                <h1 class="page-title">Thống Kê Phẫu Thuật & Hồ Sơ Bác Sĩ</h1>
                <p class="page-subtitle">Phân tích năng lực lâm sàng & Cơ cấu phẫu thuật 6 trục — ${this.getPeriodLabel()}</p>
            </div>
            <div class="sstats-header-actions">
                ${this.activeTab === 'radar' ? `
                <button id="sstats-export-profile-btn" class="export-btn btn-export-profile" onclick="SurgeryStatsPage.exportProfileImage()" title="Xuất hình ảnh hồ sơ năng lực phẫu thuật viên (2K/Retina)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    Xuất hồ sơ bác sĩ
                </button>` : ''}
                ${(this.activeTab === 'summary' && (() => { const s = Auth.getSession(); return (s && s.isAdmin); })()) ? `
                <button class="export-btn" onclick="SurgeryStatsPage.exportExcel()" title="Xuất sổ tổng hợp ca mổ toàn khoa (Excel)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    Xuất sổ tổng hợp ca mổ toàn khoa
                </button>` : ''}
            </div>
        </div>

        <!-- ===== TAB SWITCHER: RADAR DASHBOARD vs BẢNG TỔNG HỢP ===== -->
        <div class="sstats-view-tabs-container">
            <div class="sstats-view-tabs">
                <button class="sstats-view-tab ${this.activeTab === 'radar' ? 'active' : ''}" onclick="SurgeryStatsPage.setActiveTab('radar')">
                    <span class="sstats-tab-icon">🎯</span> Hồ sơ & So sánh Bác sĩ (Radar 6 Trục)
                </button>
                <button class="sstats-view-tab ${this.activeTab === 'summary' ? 'active' : ''}" onclick="SurgeryStatsPage.setActiveTab('summary')">
                    <span class="sstats-tab-icon">📋</span> Bảng Tổng Hợp Toàn Khoa
                </button>
            </div>
        </div>

        <!-- Period selector -->
        <div class="sstats-controls">
            <div class="sstats-period-tabs">
                ${['week','month','quarter','year','all'].map(p => `
                    <button class="sstats-period-btn ${this.period === p ? 'active' : ''}" onclick="SurgeryStatsPage.setPeriod('${p}')">
                        ${{week:'Tuần',month:'Tháng',quarter:'Quý',year:'Năm',all:'Toàn bộ'}[p]}
                    </button>
                `).join('')}
            </div>
        </div>

        ${!isAllPeriod ? `
        <div class="sstats-nav">
            <button class="btn-icon" onclick="SurgeryStatsPage.prevPeriod()" title="Kỳ trước" aria-label="Kỳ trước">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="sstats-nav-label">${this.getPeriodLabel()}</span>
            <button class="btn-icon" onclick="SurgeryStatsPage.nextPeriod()" title="Kỳ sau" aria-label="Kỳ sau">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            ${this.offset !== 0 ? `<button class="btn btn-secondary btn-sm" onclick="SurgeryStatsPage.resetPeriod()">Hiện tại</button>` : ''}
        </div>
        ` : ''}

        ${this.activeTab === 'radar' 
            ? this._renderRadarDashboard(surgeries, allDocs) 
            : this._renderSummaryTable(surgeries, allDocs)}
        `;
    },

    // ===== RENDER TAB 1: RADAR DASHBOARD & SO SÁNH 2 BÁC SĨ =====
    _renderRadarDashboard(surgeries, allDocs) {
        if (!surgeries || surgeries.length === 0) {
            const todayStr = this.getTodayStr();
            const allSurgeries = (SurgeryPage.getAllSurgeries() || []).filter(s => s && s.date && String(s.date).slice(0, 10) <= todayStr);
            return `
            <div class="card sstats-empty-state-card" style="padding: 40px 20px; text-align: center;">
                <div class="sstats-empty-icon" style="font-size: 2.5rem; margin-bottom: 12px;">📋</div>
                <h3 style="margin-bottom: 8px; color: var(--text-primary); font-size: 1.05rem;">Chưa có ca phẫu thuật nào trong ${this.getPeriodLabel()}</h3>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 16px;">Tổng số ca trong toàn bộ hệ thống: <strong>${allSurgeries.length} ca</strong></p>
                ${this.period !== 'all' ? `
                    <button class="btn btn-primary" onclick="SurgeryStatsPage.setPeriod('all')">Xem toàn bộ lịch sử (${allSurgeries.length} ca)</button>
                ` : ''}
            </div>`;
        }

        const session = Auth.getSession();
        const isAdmin = session ? (session.isAdmin || App.isAdmin()) : false;
        const currentUserId = session ? (session.staffId || session.id || 2) : 2;

        // RBAC: If not admin and primary is 'self', default to self
        if (!isAdmin && this.primaryDoctorId === 'self') {
            const matchSelf = allDocs.find(d => d.id === currentUserId);
            if (matchSelf) this.primaryDoctorId = currentUserId;
        }

        const p1 = this.computeSurgeonProfile(this.primaryDoctorId, surgeries, this.roleScope);
        const p2 = this.compareDoctorId !== 'none' ? this.computeSurgeonProfile(this.compareDoctorId, surgeries, this.roleScope) : null;
        const hasCompare = !!p2;

        const name1 = (p1 && p1.doctor && p1.doctor.name) || 'Bác sĩ 1';
        const name2 = (p2 && p2.doctor && p2.doctor.name) || 'Bác sĩ 2';
        const shortName1 = name1.split(' ').pop();
        const shortName2 = name2.split(' ').pop();

        const totalDiff = hasCompare ? (p1.total - p2.total) : 0;
        const totalPctDiff = (hasCompare && p2.total > 0) ? Math.round(((totalDiff / p2.total) * 100) * 10) / 10 : 0;
        const futureCount = this.getScheduledFutureCount();

        return `
        ${futureCount > 0 ? `
        <div class="sstats-future-notice">
            <span class="sstats-future-icon">⏳</span>
            <span>Có <strong>${futureCount} ca mổ dự kiến</strong> (ngày mổ sau hôm nay) được ghi nhận trong hệ thống nhưng không tính vào số liệu hoàn thành.</span>
        </div>
        ` : ''}

        <!-- DOCTOR SELECTOR ROW -->
        <div class="card sstats-doctor-selector-card">
            <div class="sstats-selector-header">
                <div>
                    <h3 class="sstats-selector-title">👥 Thiết Lập Hồ Sơ & Đối Chuẩn Phẫu Thuật Viên</h3>
                    <p class="sstats-selector-subtitle">Phân loại 6 trục năng lực — Khoa PTĐTT, BV Bình Dân (2026) <i>(Tham khảo Cleveland Clinic DDSI / ASCRS)</i></p>
                </div>
                <button class="export-btn btn-export-profile" onclick="SurgeryStatsPage.exportProfileImage()" title="Xuất hình ảnh toàn bộ hồ sơ bác sĩ (2K/Retina)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    Xuất hồ sơ bác sĩ
                </button>
            </div>
            
            <div class="sstats-selector-row">
                <!-- DOCTOR 1 SELECTOR (NAVY) -->
                <div class="sstats-doc-box sstats-doc-box-primary">
                    <div class="sstats-doc-box-badge" style="background:var(--primary-fill)">Bác sĩ 1 (Màu Xanh Navy)</div>
                    <div class="sstats-doc-box-controls">
                        <select class="form-control sstats-doc-select" aria-label="Chọn bác sĩ chính (Bác sĩ 1)" onchange="SurgeryStatsPage.setPrimaryDoctor(this.value)">
                            <option value="dept_total" ${this.primaryDoctorId === 'dept_total' ? 'selected' : ''}>
                                📊 Toàn Khoa (Tổng số ca)
                            </option>
                            <option value="dept_avg" ${this.primaryDoctorId === 'dept_avg' ? 'selected' : ''}>
                                🎯 Đối chuẩn Trung bình Khoa (Bác sĩ cơ hữu)
                            </option>
                            ${this._renderDoctorOptions(this.primaryDoctorId, allDocs)}
                        </select>
                    </div>
                </div>

                <div class="sstats-vs-badge ${hasCompare ? '' : 'disabled'}">${hasCompare ? 'VS' : '—'}</div>

                <!-- DOCTOR 2 SELECTOR (CRIMSON / DANGER) -->
                <div class="sstats-doc-box sstats-doc-box-compare ${hasCompare ? '' : 'is-none'}">
                    <div class="sstats-doc-box-badge" style="background:${hasCompare ? 'var(--state-danger)' : 'var(--slate-700)'};color:#ffffff">
                        ${hasCompare ? 'Bác sĩ 2 (Màu Đỏ Rose)' : 'Bác sĩ 2 (Để trống)'}
                    </div>
                    <div class="sstats-doc-box-controls">
                        <select class="form-control sstats-doc-select" aria-label="Chọn bác sĩ đối chiếu (Bác sĩ 2)" onchange="SurgeryStatsPage.setCompareDoctor(this.value)">
                            <option value="none" ${this.compareDoctorId === 'none' ? 'selected' : ''}>🚫 Để trống (Không so sánh)</option>
                            <option value="dept_avg" ${this.compareDoctorId === 'dept_avg' ? 'selected' : ''}>🎯 Đối chuẩn Trung bình Khoa (Bác sĩ cơ hữu)</option>
                            <option value="dept_total" ${this.compareDoctorId === 'dept_total' ? 'selected' : ''}>📊 Toàn Khoa (Tổng số ca)</option>
                            ${this._renderDoctorOptions(this.compareDoctorId, allDocs)}
                        </select>
                    </div>
                </div>
            </div>

            <!-- ROLE SCOPE SELECTOR -->
            <div class="sstats-role-scope-bar">
                ${(p1.doctor.id !== 'dept_total' && p1.doctor.id !== 'dept_avg') ? `
                <span class="sstats-role-scope-title">Vai trò thống kê:</span>
                <div class="sstats-role-scope-tabs">
                    <button class="sstats-role-scope-btn ${this.roleScope === 'main' ? 'active' : ''}" onclick="SurgeryStatsPage.setRoleScope('main')">
                        Mổ chính (${p1.mainCount || p1.total})
                    </button>
                    <button class="sstats-role-scope-btn ${this.roleScope === 'assist' ? 'active' : ''}" onclick="SurgeryStatsPage.setRoleScope('assist')">
                        Phụ mổ (${p1.assistOnlyCount || 0})
                    </button>
                    <button class="sstats-role-scope-btn ${this.roleScope === 'all' ? 'active' : ''}" onclick="SurgeryStatsPage.setRoleScope('all')">
                        Tất cả tham gia (${p1.participatedCount || p1.total})
                    </button>
                </div>
                ` : `
                <span class="sstats-role-scope-title">Phạm vi thống kê:</span>
                <span class="sstats-role-scope-badge">
                    ${p1.doctor.id === 'dept_avg' ? `Đối chuẩn trung bình ${p1.benchmarkDocCount || 0} BS cơ hữu mổ chính (${p1.total.toFixed(1)} ca/BS)` : 'Toàn khoa (Tính theo ca mổ chính)'}
                </span>
                `}
            </div>
        </div>

        <!-- KPI METRICS (SIDE-BY-SIDE OR SINGLE) -->
        <div class="sstats-compare-kpi-grid ${hasCompare ? '' : 'is-single'}">
            <!-- KPI 1: Tổng ca mổ -->
            <div class="card sstats-compare-kpi-card">
                <div class="sstats-kpi-header">
                    <span class="sstats-kpi-icon">🎯</span>
                    <span class="sstats-kpi-title">${p1.doctor.id === 'dept_avg' ? 'Trung bình ca / BS cơ hữu' : (p1.doctor.id === 'dept_total' ? 'Tổng ca mổ toàn khoa' : (this.roleScope === 'assist' ? 'Tổng ca phụ mổ' : (this.roleScope === 'all' ? 'Tổng ca tham gia' : 'Tổng ca mổ chính')))}</span>
                </div>
                ${hasCompare ? `
                <div class="sstats-kpi-values">
                    <div class="sstats-kpi-val sstats-val-primary">
                        <span class="sstats-kpi-num">${p1.doctor.id === 'dept_avg' ? p1.total.toFixed(1) : p1.total}</span>
                        <span class="sstats-kpi-sub">${shortName1}</span>
                    </div>
                    <div class="sstats-kpi-divider"></div>
                    <div class="sstats-kpi-val sstats-val-compare">
                        <span class="sstats-kpi-num">${p2.doctor.id === 'dept_avg' ? p2.total.toFixed(1) : p2.total}</span>
                        <span class="sstats-kpi-sub">${shortName2}</span>
                    </div>
                </div>
                <div class="sstats-kpi-delta ${totalDiff >= 0 ? 'positive' : 'negative'}">
                    ${totalDiff >= 0 ? `▲ +${totalDiff.toFixed(1).replace(/\.0$/, '')}` : `▼ ${totalDiff.toFixed(1).replace(/\.0$/, '')}`} ca (${totalPctDiff >= 0 ? `+${totalPctDiff.toFixed(1)}%` : `${totalPctDiff.toFixed(1)}%`})
                </div>
                ` : `
                <div class="sstats-kpi-values single-val">
                    <div class="sstats-kpi-val sstats-val-primary">
                        <span class="sstats-kpi-num">${p1.doctor.id === 'dept_avg' ? p1.total.toFixed(1) : p1.total}</span>
                        <span class="sstats-kpi-sub">${p1.doctor.id === 'dept_avg' ? `Trung bình ${p1.benchmarkDocCount || 0} BS cơ hữu mổ chính` : (p1.doctor.id === 'dept_total' ? `Toàn Khoa (${p1.total} ca)` : `${name1} (${this.roleScope === 'assist' ? 'Phụ mổ' : (this.roleScope === 'all' ? 'Tất cả tham gia' : 'Mổ chính')})`)}</span>
                    </div>
                </div>
                <div class="sstats-kpi-delta neutral">
                    ${p1.doctor.id === 'dept_avg' ? 'Đối chuẩn trung bình năng lực nội bộ' : (p1.doctor.id === 'dept_total' ? 'Tổng khối lượng mổ toàn khoa' : `Mổ chính: ${p1.mainCount || p1.total} · Phụ: ${p1.assistOnlyCount || 0} · Tham gia: ${p1.participatedCount || p1.total}`)}
                </div>
                `}
            </div>

            <!-- KPI 2: Tỷ lệ Nội soi (MIS) -->
            <div class="card sstats-compare-kpi-card">
                <div class="sstats-kpi-header">
                    <span class="sstats-kpi-icon">🔬</span>
                    <span class="sstats-kpi-title">Tỷ lệ Xâm lấn tối thiểu (MIS)</span>
                </div>
                ${hasCompare ? `
                <div class="sstats-kpi-values">
                    <div class="sstats-kpi-val sstats-val-primary">
                        <span class="sstats-kpi-num">${p1.misPct.toFixed(1)}%</span>
                        <span class="sstats-kpi-sub">${p1.misCases} ca (NS: ${p1.noisoiCases} · Rb: ${p1.robotCases})</span>
                    </div>
                    <div class="sstats-kpi-divider"></div>
                    <div class="sstats-kpi-val sstats-val-compare">
                        <span class="sstats-kpi-num">${p2.misPct.toFixed(1)}%</span>
                        <span class="sstats-kpi-sub">${p2.misCases} ca (NS: ${p2.noisoiCases} · Rb: ${p2.robotCases})</span>
                    </div>
                </div>
                <div class="sstats-kpi-delta ${p1.misPct >= p2.misPct ? 'positive' : 'negative'}">
                    ${p1.misPct >= p2.misPct ? `▲ +${(p1.misPct - p2.misPct).toFixed(1)}%` : `▼ -${(p2.misPct - p1.misPct).toFixed(1)}%`}
                </div>
                ` : `
                <div class="sstats-kpi-values single-val">
                    <div class="sstats-kpi-val sstats-val-primary">
                        <span class="sstats-kpi-num">${p1.misPct.toFixed(1)}%</span>
                        <span class="sstats-kpi-sub">${p1.misCases} ca (Nội soi: ${p1.noisoiCases} · Robot: ${p1.robotCases})</span>
                    </div>
                </div>
                <div class="sstats-kpi-delta positive">
                    Mổ mở: ${p1.openCases} ca (${p1.openPct.toFixed(1)}%) · NSTH: ${p1.nsthCases} ca
                </div>
                `}
            </div>

            <!-- KPI 3: Thời lượng phẫu thuật ghi nhận -->
            <div class="card sstats-compare-kpi-card">
                <div class="sstats-kpi-header">
                    <span class="sstats-kpi-icon">⏱️</span>
                    <span class="sstats-kpi-title">Thời lượng phẫu thuật ghi nhận</span>
                </div>
                ${hasCompare ? `
                <div class="sstats-kpi-values">
                    <div class="sstats-kpi-val sstats-val-primary">
                        <span class="sstats-kpi-num">${p1.validDurCount > 0 ? `${p1.medianDur || p1.meanDur}p` : '—'}</span>
                        <span class="sstats-kpi-sub">${shortName1} (Mẫu ${p1.validDurCount}/${p1.totalRaw})</span>
                    </div>
                    <div class="sstats-kpi-divider"></div>
                    <div class="sstats-kpi-val sstats-val-compare">
                        <span class="sstats-kpi-num">${p2.validDurCount > 0 ? `${p2.medianDur || p2.meanDur}p` : '—'}</span>
                        <span class="sstats-kpi-sub">${shortName2} (Mẫu ${p2.validDurCount}/${p2.totalRaw})</span>
                    </div>
                </div>
                <div class="sstats-kpi-delta neutral">
                    Trung vị [IQR: ${p1.validDurCount > 0 ? `${p1.iqrDur.q1}–${p1.iqrDur.q3}p` : '—'}] vs [${p2.validDurCount > 0 ? `${p2.iqrDur.q1}–${p2.iqrDur.q3}p` : '—'}]
                </div>
                ` : `
                <div class="sstats-kpi-values single-val">
                    <div class="sstats-kpi-val sstats-val-primary">
                        <span class="sstats-kpi-num">${p1.validDurCount > 0 ? `${p1.medianDur || p1.meanDur}p` : '—'}</span>
                        <span class="sstats-kpi-sub">${p1.validDurCount > 0 ? `Trung vị [IQR: ${p1.iqrDur.q1}–${p1.iqrDur.q3}p] · TB: ${p1.meanDur}p · Mẫu: ${p1.validDurCount}/${p1.totalRaw} (${p1.validDurCoveragePct}%)` : `Mẫu: 0/${p1.totalRaw} (0%)`}</span>
                    </div>
                </div>
                <div class="sstats-kpi-delta neutral">
                    ĐT-TT: ${p1.colorectalMeanDur > 0 ? `${p1.colorectalMeanDur}p` : '—'} (TV: ${p1.stratifiedDur && p1.stratifiedDur.colorectal && p1.stratifiedDur.colorectal.median ? `${p1.stratifiedDur.colorectal.median}p` : '—'}) · HM-Sàn chậu: ${p1.proctoMeanDur > 0 ? `${p1.proctoMeanDur}p` : '—'} (TV: ${p1.stratifiedDur && p1.stratifiedDur.proctology && p1.stratifiedDur.proctology.median ? `${p1.stratifiedDur.proctology.median}p` : '—'})
                </div>
                `}
            </div>

            <!-- KPI 4: Cơ cấu Phân loại & Robot -->
            <div class="card sstats-compare-kpi-card">
                <div class="sstats-kpi-header">
                    <span class="sstats-kpi-icon">📋</span>
                    <span class="sstats-kpi-title">Cơ cấu Phân loại & Robot</span>
                </div>
                ${hasCompare ? `
                <div class="sstats-kpi-values">
                    <div class="sstats-kpi-val sstats-val-primary">
                        <span class="sstats-kpi-num">${p1.yeucauPct.toFixed(0)}%</span>
                        <span class="sstats-kpi-sub">YC: ${p1.electiveReq} · Robot: ${p1.typeRobot || 0}</span>
                    </div>
                    <div class="sstats-kpi-divider"></div>
                    <div class="sstats-kpi-val sstats-val-compare">
                        <span class="sstats-kpi-num">${p2.yeucauPct.toFixed(0)}%</span>
                        <span class="sstats-kpi-sub">YC: ${p2.electiveReq} · Robot: ${p2.typeRobot || 0}</span>
                    </div>
                </div>
                <div class="sstats-kpi-delta neutral">
                    C.Trình: ${p1.electiveRoutine} vs ${p2.electiveRoutine} · Bán khẩn: ${p1.urgent} vs ${p2.urgent}
                </div>
                ` : `
                <div class="sstats-kpi-values single-val">
                    <div class="sstats-kpi-val sstats-val-primary">
                        <span class="sstats-kpi-num">${p1.yeucauPct.toFixed(0)}%</span>
                        <span class="sstats-kpi-sub">Yêu cầu: ${p1.electiveReq} ca · Chương trình: ${p1.electiveRoutine} ca</span>
                    </div>
                </div>
                <div class="sstats-kpi-delta neutral">
                    Loại Robot: ${p1.typeRobot || 0} ca · Bán khẩn: ${p1.urgent} ca · K ĐT-TT: ${p1.oncologyResections || 0} ca (${p1.oncologyResectionPct || 0}%)
                </div>
                `}
            </div>
        </div>

        <!-- MAIN DASHBOARD SPLIT: RADAR SVG (LEFT) + COMPARATIVE MATRIX (RIGHT) -->
        <div class="sstats-radar-layout-grid">
            <!-- CỘT TRÁI: DUAL RADAR CHART -->
            <div class="card sstats-radar-card">
                <div class="sstats-radar-header">
                    <div>
                        <h3 class="sstats-radar-title">🎯 Biểu Đồ Radar Cơ Cấu Phẫu Thuật 6 Trục</h3>
                        <p class="sstats-radar-subtitle">
                            ${hasCompare ? 'So sánh trực quan năng lực & khối lượng lâm sàng giữa 2 phẫu thuật viên' : 'Hồ sơ phân bố cơ cấu chuyên môn phẫu thuật viên'}
                        </p>
                    </div>
                    <div class="sstats-radar-scale-toggle">
                        <button class="sstats-radar-scale-btn ${this.radarScaleMode === 'pct' ? 'active' : ''}" 
                                onclick="SurgeryStatsPage.setRadarScaleMode('pct')" 
                                title="Xem theo tỷ trọng % cơ cấu">% Cơ cấu</button>
                        <button class="sstats-radar-scale-btn ${this.radarScaleMode === 'count' ? 'active' : ''}" 
                                onclick="SurgeryStatsPage.setRadarScaleMode('count')" 
                                title="Xem theo số lượng ca mổ">Số ca</button>
                    </div>
                </div>

                <div class="sstats-radar-legend">
                    <div class="sstats-legend-item">
                        <span class="sstats-legend-dot" style="background:var(--primary-fill)"></span>
                        <span class="sstats-legend-text"><strong>${name1}</strong> (${p1.doctor.id === 'dept_avg' ? `${p1.total.toFixed(1)} ca/BS` : `${p1.total} ca`})</span>
                    </div>
                    ${hasCompare ? `
                    <div class="sstats-legend-item">
                        <span class="sstats-legend-dot" style="background:var(--state-danger)"></span>
                        <span class="sstats-legend-text"><strong>${name2}</strong> (${p2.doctor.id === 'dept_avg' ? `${p2.total.toFixed(1)} ca/BS` : `${p2.total} ca`})</span>
                    </div>
                    ` : ''}
                </div>

                <!-- SVG RADAR ENGINE -->
                <div class="sstats-radar-canvas-container">
                    ${this._renderRadarSVG(p1, p2, { mode: this.radarScaleMode })}
                </div>

                <!-- TÓM TẮT CƠ CẤU KỸ THUẬT & PHÂN LOẠI PHẪU THUẬT (LẤP ĐẦY CÂN ĐỐI CỘT TRÁI) -->
                <div class="sstats-radar-breakdown-panel">
                    <div class="sstats-rb-section">
                        <div class="sstats-rb-header">
                            <span class="sstats-rb-title">🔬 Cơ cấu Đường tiếp cận (${shortName1})</span>
                            <span class="sstats-rb-summary">MIS: <strong>${p1.misPct.toFixed(1)}%</strong> (${p1.misCases} ca)</span>
                        </div>
                        <div class="sstats-rb-bar-stack" role="img" aria-label="Thanh tỷ lệ đường tiếp cận phẫu thuật">
                            <div class="sstats-rb-seg" style="width:${p1.total > 0 ? ((p1.noisoiCases / p1.total) * 100).toFixed(1) : 0}%;background:#16a34a" title="Nội soi: ${p1.noisoiCases} ca"></div>
                            <div class="sstats-rb-seg" style="width:${p1.total > 0 ? ((p1.robotCases / p1.total) * 100).toFixed(1) : 0}%;background:#333C83" title="Robot: ${p1.robotCases} ca"></div>
                            <div class="sstats-rb-seg" style="width:${p1.openPct.toFixed(1)}%;background:#be123c" title="Mổ mở: ${p1.openCases} ca"></div>
                            <div class="sstats-rb-seg" style="width:${p1.total > 0 ? ((p1.nsthCases / p1.total) * 100).toFixed(1) : 0}%;background:#7c3aed" title="NSTH: ${p1.nsthCases} ca"></div>
                        </div>
                        <div class="sstats-rb-pills-grid">
                            <div class="sstats-rb-pill"><span class="sstats-rb-dot" style="background:#16a34a"></span><span>Nội soi: <strong>${p1.noisoiCases}</strong> ca (${p1.total > 0 ? ((p1.noisoiCases / p1.total) * 100).toFixed(1) : '0.0'}%)</span></div>
                            <div class="sstats-rb-pill"><span class="sstats-rb-dot" style="background:#333C83"></span><span>Robot: <strong>${p1.robotCases}</strong> ca (${p1.total > 0 ? ((p1.robotCases / p1.total) * 100).toFixed(1) : '0.0'}%)</span></div>
                            <div class="sstats-rb-pill"><span class="sstats-rb-dot" style="background:#be123c"></span><span>Mổ mở: <strong>${p1.openCases}</strong> ca (${p1.openPct.toFixed(1)}%)</span></div>
                            <div class="sstats-rb-pill"><span class="sstats-rb-dot" style="background:#7c3aed"></span><span>NSTH: <strong>${p1.nsthCases}</strong> ca (${p1.total > 0 ? ((p1.nsthCases / p1.total) * 100).toFixed(1) : '0.0'}%)</span></div>
                        </div>
                    </div>

                    <div class="sstats-rb-section">
                        <div class="sstats-rb-header">
                            <span class="sstats-rb-title">📋 Cơ cấu Phân loại & Phẫu thuật Ung thư</span>
                            <span class="sstats-rb-summary">K ĐT-TT: <strong>${p1.oncologyResections || 0}</strong> ca (${p1.oncologyResectionPct || 0}%)</span>
                        </div>
                        <div class="sstats-rb-bar-stack" role="img" aria-label="Thanh tỷ lệ phân loại phẫu thuật">
                            <div class="sstats-rb-seg" style="width:${p1.yeucauPct.toFixed(1)}%;background:#d97706" title="Mổ Yêu cầu: ${p1.electiveReq} ca"></div>
                            <div class="sstats-rb-seg" style="width:${p1.total > 0 ? ((p1.electiveRoutine / p1.total) * 100).toFixed(1) : 0}%;background:#0284c7" title="Mổ Chương trình: ${p1.electiveRoutine} ca"></div>
                            <div class="sstats-rb-seg" style="width:${p1.total > 0 ? ((p1.urgent / p1.total) * 100).toFixed(1) : 0}%;background:#dc2626" title="Mổ Bán khẩn: ${p1.urgent} ca"></div>
                            <div class="sstats-rb-seg" style="width:${p1.total > 0 ? (((p1.typeRobot || 0) / p1.total) * 100).toFixed(1) : 0}%;background:#333C83" title="Loại Robot: ${p1.typeRobot || 0} ca"></div>
                        </div>
                        <div class="sstats-rb-pills-grid">
                            <div class="sstats-rb-pill"><span class="sstats-rb-dot" style="background:#d97706"></span><span>Mổ Yêu cầu: <strong>${p1.electiveReq}</strong> ca (${p1.yeucauPct.toFixed(1)}%)</span></div>
                            <div class="sstats-rb-pill"><span class="sstats-rb-dot" style="background:#0284c7"></span><span>Chương trình: <strong>${p1.electiveRoutine}</strong> ca (${p1.total > 0 ? ((p1.electiveRoutine / p1.total) * 100).toFixed(1) : '0.0'}%)</span></div>
                            <div class="sstats-rb-pill"><span class="sstats-rb-dot" style="background:#dc2626"></span><span>Bán khẩn: <strong>${p1.urgent}</strong> ca (${p1.total > 0 ? ((p1.urgent / p1.total) * 100).toFixed(1) : '0.0'}%)</span></div>
                            <div class="sstats-rb-pill"><span class="sstats-rb-dot" style="background:#333C83"></span><span>Loại Robot: <strong>${p1.typeRobot || 0}</strong> ca · K: <strong>${p1.oncologyResections || 0}</strong></span></div>
                        </div>
                    </div>
                </div>

                <!-- CLINICAL DISCLAIMER -->
                <div class="sstats-clinical-disclaimer">
                    ⚠️ <em>Chỉ số số lượng ca mổ và thời gian phẫu thuật phụ thuộc vào phân công lịch mổ, cơ cấu ca khó/phức tạp và tính chất cấp cứu; dùng phục vụ tự đánh giá chuyên môn và quản lý chất lượng.</em>
                </div>
            </div>

            <!-- CỘT PHẢI: BẢNG MA TRẬN ĐỐI CHUẨN 6 TRỤC -->
            <div class="card sstats-matrix-card">
                <div class="sstats-matrix-header">
                    <h3 class="sstats-matrix-title">📊 Bảng Phân Tích Cơ Cấu 6 Trục Lâm Sàng</h3>
                    <span class="sstats-matrix-hint">Nhấn vào trục để lọc nhật ký</span>
                </div>

                <div class="sstats-matrix-table-container">
                    <table class="sstats-matrix-table">
                        <thead>
                            <tr>
                                <th>
                                    <div class="sstats-axis-top-row sstats-axis-thead-row">
                                        <span>Trục Năng Lực Lâm Sàng</span>
                                        <span>
                                            ${hasCompare
                                                ? `<span style="color:var(--primary)">${shortName1}</span> vs <span style="color:var(--state-danger)">${shortName2}</span>`
                                                : `Số ca (${shortName1}) · Tỷ trọng`}
                                        </span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.keys(this.CLINICAL_AXES).map(k => {
                                const ax = this.CLINICAL_AXES[k];
                                const c1 = p1.axisCounts[k] || 0;
                                const pct1 = p1.axisPct[k] || 0;
                                const c2 = p2 ? (p2.axisCounts[k] || 0) : 0;
                                const pct2 = p2 ? (p2.axisPct[k] || 0) : 0;
                                const delta = Math.round((pct1 - pct2) * 10) / 10;
                                const isActiveAxis = this.logbookFilterAxis === k;
                                const subBreakdown = this.SUB_AXIS_MAP[k] || {};
                                const subEntries = Object.entries(subBreakdown);
                                return `
                                <tr class="sstats-matrix-tr-clickable ${isActiveAxis ? 'is-active-axis' : ''}" 
                                    onclick="SurgeryStatsPage.setLogbookFilterAxis('${isActiveAxis ? 'all' : k}')" 
                                    title="Nhấp để ${isActiveAxis ? 'xóa lọc nhóm này' : `lọc danh sách ca mổ nhóm ${ax.label}`}">
                                    <td class="sstats-matrix-axis-cell">
                                        <div class="sstats-axis-top-row ${hasCompare ? 'is-compare-row' : ''}">
                                            <div class="sstats-axis-name">
                                                <span class="sstats-axis-icon" style="background:${ax.color}18;color:${ax.color}">${ax.icon}</span>
                                                <strong class="sstats-axis-title-strong">${ax.label} ${isActiveAxis ? '🔍' : ''}</strong>
                                            </div>
                                            ${hasCompare ? `
                                            <div class="sstats-axis-metrics-right is-compare">
                                                <span class="sstats-matrix-num" style="color:var(--primary)">
                                                    <strong>${c1}</strong> ca <span class="sstats-matrix-pct">(${pct1.toFixed(1)}%)</span>
                                                </span>
                                                <span class="sstats-axis-vs-inline">vs</span>
                                                <span class="sstats-matrix-num" style="color:var(--state-danger)">
                                                    <strong>${c2}</strong> ca <span class="sstats-matrix-pct">(${pct2.toFixed(1)}%)</span>
                                                </span>
                                                <span class="sstats-delta-badge ${delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'zero'}">
                                                    ${delta > 0 ? `+${delta.toFixed(1)}%` : delta < 0 ? `${delta.toFixed(1)}%` : '0.0%'}
                                                </span>
                                            </div>
                                            ` : `
                                            <div class="sstats-axis-metrics-right">
                                                <span class="sstats-matrix-num" style="color:var(--primary)"><strong>${c1}</strong> ca</span>
                                                <span class="sstats-axis-pct-badge" style="background:${ax.color}18;color:${ax.color};border:1px solid ${ax.color}35"><strong>${pct1.toFixed(1)}%</strong></span>
                                            </div>
                                            `}
                                        </div>
                                        <div class="sstats-axis-bar-track">
                                            <div class="sstats-axis-bar-fill" style="width:${Math.min(100, pct1)}%;background:${ax.color}"></div>
                                        </div>
                                        <div class="sstats-axis-sub-breakdown">
                                            ${subEntries.map(([subKey, subLabel]) => `<span class="sstats-subaxis-chip">${subLabel}: <strong>${p1.subAxisCounts[subKey] || 0}</strong></span>`).join('')}
                                        </div>
                                    </td>
                                </tr>`;
                            }).join('')}
                            ${(p1.unclassifiedCount > 0 || (p2 && p2.unclassifiedCount > 0)) ? (() => {
                                const u1 = p1.unclassifiedCount || 0;
                                const upct1 = p1.unclassifiedPct || 0;
                                const u2 = p2 ? (p2.unclassifiedCount || 0) : 0;
                                const upct2 = p2 ? (p2.unclassifiedPct || 0) : 0;
                                const udelta = Math.round((upct1 - upct2) * 10) / 10;
                                const isUnclassActive = this.logbookFilterAxis === 'unclassified';
                                return `
                                <tr class="sstats-matrix-tr-clickable sstats-unclassified-tr ${isUnclassActive ? 'is-active-axis' : ''}"
                                    onclick="SurgeryStatsPage.setLogbookFilterAxis('${isUnclassActive ? 'all' : 'unclassified'}')"
                                    title="Nhấp để ${isUnclassActive ? 'xóa lọc nhóm này' : 'lọc danh sách các ca chưa phân loại hoặc ngoại khoa khác'}">
                                    <td class="sstats-matrix-axis-cell">
                                        <div class="sstats-axis-top-row ${hasCompare ? 'is-compare-row' : ''}">
                                            <div class="sstats-axis-name">
                                                <span class="sstats-axis-icon" style="background:#fef3c7;color:#d97706">⚠️</span>
                                                <div>
                                                    <strong class="sstats-axis-title-strong" style="color:var(--amber-11, #d97706)">Chưa phân loại / Ngoại khoa khác ${isUnclassActive ? '🔍' : ''}</strong>
                                                    <div class="sstats-axis-sub">Cần rà soát chẩn đoán và phương pháp mổ</div>
                                                </div>
                                            </div>
                                            ${hasCompare ? `
                                            <div class="sstats-axis-metrics-right is-compare">
                                                <span class="sstats-matrix-num" style="color:var(--primary)">
                                                    <strong>${u1}</strong> ca <span class="sstats-matrix-pct">(${upct1.toFixed(1)}%)</span>
                                                </span>
                                                <span class="sstats-axis-vs-inline">vs</span>
                                                <span class="sstats-matrix-num" style="color:var(--state-danger)">
                                                    <strong>${u2}</strong> ca <span class="sstats-matrix-pct">(${upct2.toFixed(1)}%)</span>
                                                </span>
                                                <span class="sstats-delta-badge zero">
                                                    ${udelta > 0 ? `+${udelta.toFixed(1)}%` : udelta < 0 ? `${udelta.toFixed(1)}%` : '0.0%'}
                                                </span>
                                            </div>
                                            ` : `
                                            <div class="sstats-axis-metrics-right">
                                                <span class="sstats-matrix-num" style="color:var(--primary)"><strong>${u1}</strong> ca</span>
                                                <span class="sstats-axis-pct-badge" style="background:#fef3c7;color:#b45309;border:1px solid #fde68a"><strong>${upct1.toFixed(1)}%</strong></span>
                                            </div>
                                            `}
                                        </div>
                                    </td>
                                </tr>`;
                            })() : ''}
                        </tbody>
                        <tfoot>
                            <tr class="sstats-matrix-total-row">
                                <td>
                                    <div class="sstats-axis-top-row ${hasCompare ? 'is-compare-row' : ''}">
                                        <strong style="font-size:0.98rem">TỔNG CỘNG TOÀN BỘ</strong>
                                        ${hasCompare ? `
                                        <div class="sstats-axis-metrics-right is-compare">
                                            <span style="color:var(--primary);font-weight:800;font-size:1rem">${p1.doctor.id === 'dept_avg' ? `${p1.total.toFixed(1)} ca` : `${p1.total} ca`}</span>
                                            <span class="sstats-axis-vs-inline">vs</span>
                                            <span style="color:var(--state-danger);font-weight:800;font-size:1rem">${p2.doctor.id === 'dept_avg' ? `${p2.total.toFixed(1)} ca` : `${p2.total} ca`}</span>
                                            <span class="sstats-delta-badge ${totalDiff >= 0 ? 'pos' : 'neg'}" title="${totalDiff >= 0 ? `+${totalDiff.toFixed(1)}` : totalDiff.toFixed(1)} ca">
                                                ${totalPctDiff >= 0 ? `+${totalPctDiff.toFixed(1)}%` : `${totalPctDiff.toFixed(1)}%`}
                                            </span>
                                        </div>
                                        ` : `
                                        <div class="sstats-axis-metrics-right">
                                            <span style="color:var(--primary);font-weight:800;font-size:1.05rem">${p1.doctor.id === 'dept_avg' ? `${p1.total.toFixed(1)} ca` : `${p1.total} ca`}</span>
                                            <span class="sstats-axis-pct-badge" style="background:var(--primary-a10);color:var(--primary);border:1px solid var(--primary-a20)"><strong>100%</strong></span>
                                        </div>
                                        `}
                                    </div>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div class="sstats-matrix-footer-note">
                    Phân loại năng lực lâm sàng chuyên sâu Khoa Phẫu thuật Đại trực tràng (Chuẩn Cleveland Clinic DDSI / ASCRS)
                </div>
            </div>
        </div>

        <!-- BẢNG NHẬT KÝ PHẪU THUẬT CỦA BÁC SĨ ĐƯỢC CHỌN -->
        ${(() => {
            // Lọc danh sách ca phẫu thuật
            let filteredCases = p1.cases;
            const isFiltered = (this.logbookFilterAxis !== 'all') || 
                               (this.logbookFilterSubAxis !== 'all') ||
                               (this.logbookFilterApproach !== 'all') || 
                               (this.logbookFilterType !== 'all') || 
                               (this.logbookSearch && this.logbookSearch.trim().length > 0);

            if (this.logbookFilterAxis === 'unclassified') {
                filteredCases = filteredCases.filter(s => this.classifySurgery(s) === 'unclassified');
            } else if (this.logbookFilterAxis !== 'all') {
                filteredCases = filteredCases.filter(s => this.classifySurgery(s) === this.logbookFilterAxis);
            }

            if (this.logbookFilterSubAxis && this.logbookFilterSubAxis !== 'all') {
                filteredCases = filteredCases.filter(s => {
                    const d = this.classifySurgeryDetail(s);
                    return d.subAxis === this.logbookFilterSubAxis;
                });
            }

            if (this.logbookFilterApproach !== 'all') {
                filteredCases = filteredCases.filter(s => SurgeryMetrics.resolveApproach(s) === this.logbookFilterApproach);
            }

            if (this.logbookFilterType !== 'all') {
                filteredCases = filteredCases.filter(s => SurgeryMetrics.resolveSurgeryType(s) === this.logbookFilterType);
            }

            if (this.logbookSearch && this.logbookSearch.trim()) {
                const q = this.logbookSearch.trim().toLowerCase();
                filteredCases = filteredCases.filter(s => 
                    (s.patientName || '').toLowerCase().includes(q) ||
                    (s.diagnosis || '').toLowerCase().includes(q) ||
                    (s.method || '').toLowerCase().includes(q) ||
                    String(s.birthYear || '').includes(q) ||
                    (s.notes || '').toLowerCase().includes(q)
                );
            }

            const displayCases = this.showAllLogbookCases ? filteredCases : filteredCases.slice(0, 100);

            return `
            <div class="card sstats-logbook-card" id="sstats-logbook-section">
                <div class="sstats-logbook-header">
                    <div>
                        <h3 class="sstats-logbook-title">📖 Nhật Ký Phẫu Thuật Chi Tiết — ${name1} (${p1.doctor.id === 'dept_avg' ? `${p1.total.toFixed(1)} ca` : `${p1.total} ca`})</h3>
                        <p class="sstats-logbook-subtitle">${(p1.doctor.id === 'dept_total' || p1.doctor.id === 'dept_avg') ? `Danh sách toàn bộ ca phẫu thuật của toàn khoa trong khoảng thời gian đã chọn` : `Danh sách ca phẫu thuật của BS mổ chính trong khoảng thời gian đã chọn`}</p>
                    </div>
                </div>

                <!-- THANH BỘ LỌC TÌM KIẾM NHANH (FILTER TOOLBAR) -->
                <div class="sstats-filter-toolbar">
                    <div class="sstats-filter-search-box">
                        <span class="sstats-filter-search-icon">🔍</span>
                        <input type="text" 
                               id="sstats-logbook-search-input" 
                               class="form-control sstats-filter-search-input" 
                               aria-label="Tìm kiếm sổ tay phẫu thuật"
                               placeholder="Tìm tên BN, năm sinh, chẩn đoán, PP mổ..." 
                               value="${(this.logbookSearch || '').replace(/"/g, '&quot;')}" 
                               oninput="SurgeryStatsPage.setLogbookSearch(this.value)">
                        ${this.logbookSearch ? `
                            <button class="sstats-clear-search-btn" onclick="SurgeryStatsPage.setLogbookSearch('')" aria-label="Xóa tìm kiếm" title="Xóa tìm kiếm">✕</button>
                        ` : ''}
                    </div>
                    <div class="sstats-filter-controls">
                        <select class="form-control sstats-filter-select" aria-label="Lọc theo nhóm Radar 6 trục" onchange="SurgeryStatsPage.setLogbookFilterAxis(this.value)">
                            <option value="all">🎯 Tất cả nhóm Radar (6 trục)</option>
                            ${Object.entries(this.CLINICAL_AXES).map(([k, ax]) => `
                                <option value="${k}" ${this.logbookFilterAxis === k ? 'selected' : ''}>${ax.icon} ${ax.label}</option>
                            `).join('')}
                            ${(p1.unclassifiedCount > 0) ? `
                                <option value="unclassified" ${this.logbookFilterAxis === 'unclassified' ? 'selected' : ''}>⚠️ Chưa phân loại (${p1.unclassifiedCount})</option>
                            ` : ''}
                        </select>

                        ${(this.logbookFilterAxis !== 'all' && this.SUB_AXIS_MAP[this.logbookFilterAxis]) ? `
                        <select class="form-control sstats-filter-select" aria-label="Lọc theo phân nhóm con" onchange="SurgeryStatsPage.setLogbookFilterSubAxis(this.value)">
                            <option value="all">Tất cả phân nhóm con</option>
                            ${Object.entries(this.SUB_AXIS_MAP[this.logbookFilterAxis]).map(([subKey, subName]) => `
                                <option value="${subKey}" ${this.logbookFilterSubAxis === subKey ? 'selected' : ''}>${subName}</option>
                            `).join('')}
                        </select>
                        ` : ''}

                        <select class="form-control sstats-filter-select" aria-label="Lọc theo đường mổ" onchange="SurgeryStatsPage.setLogbookFilterApproach(this.value)">
                            <option value="all">🔪 Tất cả đường mổ</option>
                            <option value="noisoi" ${this.logbookFilterApproach === 'noisoi' ? 'selected' : ''}>🔬 Nội soi</option>
                            <option value="mo" ${this.logbookFilterApproach === 'mo' ? 'selected' : ''}>🔪 Mổ mở</option>
                            <option value="robot" ${this.logbookFilterApproach === 'robot' ? 'selected' : ''}>🤖 Robot</option>
                            <option value="nsth" ${this.logbookFilterApproach === 'nsth' ? 'selected' : ''}>⚡ NSTH</option>
                        </select>

                        <select class="form-control sstats-filter-select" aria-label="Lọc theo loại phẫu thuật" onchange="SurgeryStatsPage.setLogbookFilterType(this.value)">
                            <option value="all">📋 Tất cả loại PT</option>
                            <option value="chuongtrinh" ${this.logbookFilterType === 'chuongtrinh' ? 'selected' : ''}>📅 Chương trình</option>
                            <option value="yeucau" ${this.logbookFilterType === 'yeucau' ? 'selected' : ''}>⭐ Yêu cầu</option>
                            <option value="bankhan" ${this.logbookFilterType === 'bankhan' ? 'selected' : ''}>🚨 Bán khẩn</option>
                            <option value="robot" ${this.logbookFilterType === 'robot' ? 'selected' : ''}>🤖 Robot</option>
                        </select>

                        ${isFiltered ? `
                            <button class="btn btn-secondary btn-sm sstats-reset-filters-btn" onclick="SurgeryStatsPage.resetLogbookFilters()" title="Xóa tất cả bộ lọc">
                                ✕ Đặt lại (${filteredCases.length})
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="sstats-logbook-table-container">
                    ${filteredCases.length === 0 ? `
                        <div class="sstats-empty-filter-state">
                            <div style="font-size: 2rem; margin-bottom: 8px;">🔍</div>
                            <h4 style="margin: 0 0 6px 0; font-size: 0.95rem; color: var(--text-primary);">Không tìm thấy ca phẫu thuật phù hợp</h4>
                            <p style="margin: 0 0 12px 0; font-size: 0.8rem; color: var(--text-muted);">
                                Vui lòng thử từ khóa tìm kiếm khác hoặc thay đổi các tiêu chí lọc.
                            </p>
                            <button class="btn btn-secondary btn-sm" onclick="SurgeryStatsPage.resetLogbookFilters()">
                                ✕ Xóa tất cả bộ lọc
                            </button>
                        </div>
                    ` : `
                        <table class="sstats-table">
                            <thead>
                                <tr>
                                    <th class="sstats-th-stt">STT</th>
                                    <th>Ngày mổ</th>
                                    <th>Họ tên BN</th>
                                    <th>Năm sinh</th>
                                    <th>Chẩn đoán</th>
                                    <th>PP Phẫu thuật</th>
                                    <th>Nhóm Radar</th>
                                    <th>Phân nhóm con</th>
                                    <th>Đường mổ</th>
                                    <th>Loại PT</th>
                                    <th>BS mổ chính</th>
                                    <th>TG mổ</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${displayCases.map((s, idx) => {
                                    const axis = this.classifySurgery(s);
                                    const axisInfo = (axis === 'unclassified') ? this.UNCLASSIFIED_AXIS : this.CLINICAL_AXES[axis];
                                    const detail = this.classifySurgeryDetail(s);
                                    const subAxisName = this.getSubAxisLabel(axis, detail.subAxis);
                                    const resolvedType = SurgeryMetrics.resolveSurgeryType(s);
                                    const typeInfo = SURGERY_TYPES[resolvedType] || (resolvedType === 'robot' ? { label: 'Robot', color: 'var(--surgery-robot, #333C83)' } : SURGERY_TYPES.chuongtrinh);
                                    const resolvedApproach = SurgeryMetrics.resolveApproach(s);
                                    const approachMap = { mo: 'Mổ mở', noisoi: 'Nội soi', nsth: 'NSTH', robot: 'Robot', unknown: 'Chưa rõ' };
                                    const doc = allDocs.find(d => this.normId(d.id) === this.normId(s.mainSurgeon));
                                    const docName = doc ? doc.name : (s.mainSurgeon ? `BS #${s.mainSurgeon}` : '—');
                                    const durStr = s.duration ? `${s.duration}p` : '—';
                                    const dateStr = Utils.formatDate(s.date);
                                    return `
                                    <tr onclick="SurgeryPage.viewDetail(${s.id})" class="sstats-detail-tr-clickable" title="Xem chi tiết ca mổ">
                                        <td class="sstats-td-stt">${idx + 1}</td>
                                        <td>${dateStr}</td>
                                        <td><strong>${s.patientName || (s.id ? 'BN #' + s.id : '—')}</strong></td>
                                        <td>${s.birthYear || '—'}</td>
                                        <td class="sstats-td-text">${s.diagnosis || '—'}</td>
                                        <td class="sstats-td-text">${s.method || '—'}</td>
                                        <td><span class="sstats-radar-tag" style="background:${axisInfo.color}18;color:${axisInfo.color};border:1px solid ${axisInfo.color}40">${axisInfo.icon} ${axisInfo.label}</span></td>
                                        <td class="sstats-td-text" style="font-size:0.78rem;color:var(--text-secondary)">${subAxisName}</td>
                                        <td><span class="approach-tag approach-${resolvedApproach}">${approachMap[resolvedApproach] || resolvedApproach}</span></td>
                                        <td><span class="surgery-type-badge" style="background:${typeInfo.color};color:${typeInfo.onColor || 'var(--on-primary, #fff)'}">${typeInfo.label}</span></td>
                                        <td style="font-size:0.8rem;font-weight:600;color:var(--text-primary)">${docName}</td>
                                        <td style="font-size:0.8rem;text-align:right">${durStr}</td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                        <div class="sstats-logbook-footer">
                            <span class="sstats-more-hint">
                                ${this.showAllLogbookCases 
                                    ? `Đang hiển thị toàn bộ ${filteredCases.length} ca phẫu thuật ${isFiltered ? `(đã lọc từ ${p1.cases.length} ca gốc)` : ''}` 
                                    : `Đang hiển thị ${Math.min(100, filteredCases.length)} / ${filteredCases.length} ca phẫu thuật ${isFiltered ? `(đã lọc từ ${p1.cases.length} ca gốc)` : 'gần nhất'}`}
                            </span>
                            ${filteredCases.length > 100 ? `
                                <button class="btn btn-secondary btn-sm sstats-expand-btn" onclick="SurgeryStatsPage.toggleShowAllCases()">
                                    ${this.showAllLogbookCases ? '🔼 Thu gọn về 100 ca gần nhất' : `📖 Xem toàn bộ ${filteredCases.length} ca`}
                                </button>
                            ` : ''}
                        </div>
                    `}
                </div>
            </div>`;
        })()}
        </div>`;
    },

    // ===== SVG RADAR CHART GENERATOR =====
    _renderRadarSVG(p1, p2, options = {}) {
        const width = 480;
        const height = 390;
        const cx = width / 2;
        const cy = height / 2 + 2;
        const radius = 102;
        const axisKeys = Object.keys(this.CLINICAL_AXES);
        const numAxes = axisKeys.length;
        const hasCompare = !!p2;
        const mode = options.mode || this.radarScaleMode || 'pct';
        const isPct = (mode === 'pct');
        const exportMode = !!options.exportMode;

        // Determine max scale (percentage ceiling {50%, 75%, 100%} or count scale multiple of 4)
        let maxScale = 50;
        if (isPct) {
            const maxPct1 = Math.max(0, ...axisKeys.map(k => (p1 && p1.axisPct && p1.axisPct[k]) || 0));
            const maxPct2 = hasCompare ? Math.max(0, ...axisKeys.map(k => (p2 && p2.axisPct && p2.axisPct[k]) || 0)) : 0;
            const maxPct = Math.max(maxPct1, maxPct2);
            if (maxPct <= 50) maxScale = 50;
            else if (maxPct <= 75) maxScale = 75;
            else maxScale = 100;
        } else {
            const maxVal1 = Math.max(0, ...axisKeys.map(k => (p1 && p1.axisCounts && p1.axisCounts[k]) || 0));
            const maxVal2 = hasCompare ? Math.max(0, ...axisKeys.map(k => (p2 && p2.axisCounts && p2.axisCounts[k]) || 0)) : 0;
            const maxVal = Math.max(maxVal1, maxVal2);
            maxScale = Math.max(4, Math.ceil(maxVal / 4) * 4);
        }

        // Calculate angle coordinates
        const angleSlice = (Math.PI * 2) / numAxes;
        const getCoord = (value, index, max) => {
            const angle = index * angleSlice - Math.PI / 2;
            const safeMax = max > 0 ? max : 1;
            const r = Math.min(radius, (Math.max(0, value) / safeMax) * radius);
            return {
                x: cx + r * Math.cos(angle),
                y: cy + r * Math.sin(angle)
            };
        };

        const borderColor = exportMode ? '#cbd5e1' : 'var(--border, #cbd5e1)';
        const textPrimaryColor = exportMode ? '#0f172a' : 'var(--text-primary, #0f172a)';
        const textMutedColor = exportMode ? '#64748b' : 'var(--text-muted, #64748b)';
        const p1Color = exportMode ? '#1D2357' : (Utils.cssVar('--primary') || '#1D2357');
        const p2Color = exportMode ? '#CB242D' : (Utils.cssVar('--state-danger') || '#CB242D');
        const p1Accent = exportMode ? '#1878B4' : (Utils.cssVar('--accent') || '#1878B4');

        // 4 concentric hexagonal rings [25%, 50%, 75%, 100% of maxScale]
        const levels = [0.25, 0.50, 0.75, 1.00];
        let gridSVG = '';
        levels.forEach((lvl, lvlIdx) => {
            const pts = [];
            for (let i = 0; i < numAxes; i++) {
                const angle = i * angleSlice - Math.PI / 2;
                const r = lvl * radius;
                pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
            }
            gridSVG += `<polygon points="${pts.join(' ')}" class="sstats-radar-grid" stroke="${borderColor}" stroke-dasharray="${lvlIdx === levels.length - 1 ? 'none' : '2,3'}" fill="none" stroke-width="1.2" />`;
            // Scale label
            const rawRingVal = lvl * maxScale;
            const labelVal = isPct
                ? `${Number.isInteger(rawRingVal) ? rawRingVal : rawRingVal.toFixed(1)}%`
                : Math.round(rawRingVal);
            gridSVG += `<text x="${cx + 5}" y="${cy - lvl * radius + 11}" class="sstats-radar-grid-label" fill="${textMutedColor}" font-size="11" font-weight="600">${labelVal}</text>`;
        });

        // Axis spokes & labels (smart non-clipping positions outside the r=102 hexagon)
        let spokesSVG = '';
        let labelsSVG = '';
        const labelPositions = [
            { lx: cx,       ly: 34,  anchor: 'middle' }, // 0: Top (Đại tràng)
            { lx: cx + 136, ly: 82,  anchor: 'middle' }, // 1: Top-Right (Trực tràng)
            { lx: cx + 136, ly: 312, anchor: 'middle' }, // 2: Bottom-Right (Hậu môn – Sàn chậu)
            { lx: cx,       ly: 360, anchor: 'middle' }, // 3: Bottom (Đóng & Mở HMNT)
            { lx: cx - 126, ly: 312, anchor: 'middle' }, // 4: Bottom-Left (Thoát vị & Phục hồi Thành bụng)
            { lx: cx - 124, ly: 82,  anchor: 'middle' }  // 5: Top-Left (Tiêu hóa trên, Gan mật & Phối hợp)
        ];

        axisKeys.forEach((k, i) => {
            const ax = this.CLINICAL_AXES[k];
            const endCoord = getCoord(maxScale, i, maxScale);
            spokesSVG += `<line x1="${cx}" y1="${cy}" x2="${endCoord.x}" y2="${endCoord.y}" stroke="${borderColor}" stroke-width="1.3" />`;

            const pos = labelPositions[i] || { lx: cx, ly: cy, anchor: 'middle' };
            const lx = pos.lx;
            const ly = pos.ly;
            const anchor = pos.anchor;

            const c1 = (p1 && p1.axisCounts && p1.axisCounts[k]) || 0;
            const pct1 = (p1 && p1.axisPct && p1.axisPct[k]) || 0;
            const c2 = p2 ? ((p2.axisCounts && p2.axisCounts[k]) || 0) : 0;
            const pct2 = p2 ? ((p2.axisPct && p2.axisPct[k]) || 0) : 0;

            labelsSVG += `
            <g class="sstats-radar-axis-label-group">
                <text x="${lx}" y="${ly - 6}" text-anchor="${anchor}" class="sstats-radar-axis-title" fill="${textPrimaryColor}" font-size="13" font-weight="700">
                    ${ax.label}
                </text>
                <text x="${lx}" y="${ly + 11}" text-anchor="${anchor}" class="sstats-radar-axis-values" font-size="12">
                    ${hasCompare 
                        ? (isPct 
                            ? `<tspan fill="${p1Color}" font-weight="700">${pct1.toFixed(0)}%</tspan> <tspan fill="${textMutedColor}">vs</tspan> <tspan fill="${p2Color}" font-weight="700">${pct2.toFixed(0)}%</tspan>`
                            : `<tspan fill="${p1Color}" font-weight="700">${c1}</tspan> <tspan fill="${textMutedColor}">vs</tspan> <tspan fill="${p2Color}" font-weight="700">${c2}</tspan>`)
                        : (isPct
                            ? `<tspan fill="${p1Color}" font-weight="700">${pct1.toFixed(1)}%</tspan> <tspan fill="${textMutedColor}">(${c1} ca)</tspan>`
                            : `<tspan fill="${p1Color}" font-weight="700">${c1} ca</tspan> <tspan fill="${textMutedColor}">(${pct1.toFixed(0)}%)</tspan>`)}
                </text>
            </g>`;
        });

        // Polygon 1 (Doctor 1 - Navy)
        const poly1Pts = [];
        const poly1Dots = [];
        axisKeys.forEach((k, i) => {
            const val = isPct ? ((p1 && p1.axisPct && p1.axisPct[k]) || 0) : ((p1 && p1.axisCounts && p1.axisCounts[k]) || 0);
            const pt = getCoord(val, i, maxScale);
            poly1Pts.push(`${pt.x},${pt.y}`);
            poly1Dots.push(`<circle cx="${pt.x}" cy="${pt.y}" r="4.5" fill="${p1Color}" stroke="#ffffff" stroke-width="1.5" class="sstats-radar-dot" data-axis="${k}" data-doc="1" />`);
        });

        // Polygon 2 (Doctor 2 - Crimson / Danger - Only if hasCompare)
        const poly2Pts = [];
        const poly2Dots = [];
        if (hasCompare) {
            axisKeys.forEach((k, i) => {
                const val = isPct ? ((p2.axisPct && p2.axisPct[k]) || 0) : ((p2.axisCounts && p2.axisCounts[k]) || 0);
                const pt = getCoord(val, i, maxScale);
                poly2Pts.push(`${pt.x},${pt.y}`);
                poly2Dots.push(`<circle cx="${pt.x}" cy="${pt.y}" r="4" fill="${p2Color}" stroke="#ffffff" stroke-width="1.5" class="sstats-radar-dot" data-axis="${k}" data-doc="2" />`);
            });
        }

        return `
        <svg viewBox="0 0 ${width} ${height}" class="sstats-radar-svg" data-max-scale="${maxScale}" data-mode="${mode}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="p1Grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${p1Color}" stop-opacity="0.35" />
                    <stop offset="100%" stop-color="${p1Accent}" stop-opacity="0.15" />
                </linearGradient>
                ${hasCompare ? `
                <linearGradient id="p2Grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${p2Color}" stop-opacity="0.30" />
                    <stop offset="100%" stop-color="#f43f5e" stop-opacity="0.12" />
                </linearGradient>
                ` : ''}
                <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.15" />
                </filter>
            </defs>

            <!-- Background Grid Web -->
            ${gridSVG}
            ${spokesSVG}

            <!-- Doctor 2 Polygon (Crimson / Danger - Underneath) -->
            ${hasCompare ? `
            <polygon points="${poly2Pts.join(' ')}" fill="url(#p2Grad)" stroke="${p2Color}" stroke-width="2.2" stroke-dasharray="4,3" class="sstats-polygon-p2" filter="url(#radarGlow)" />
            ${poly2Dots.join('')}
            ` : ''}

            <!-- Doctor 1 Polygon (Navy - On Top) -->
            <polygon points="${poly1Pts.join(' ')}" fill="url(#p1Grad)" stroke="${p1Color}" stroke-width="2.5" class="sstats-polygon-p1" filter="url(#radarGlow)" />
            ${poly1Dots.join('')}

            <!-- Axis Labels -->
            ${labelsSVG}
        </svg>`;
    },

    // ===== RENDER TAB 2: TRADITIONAL SUMMARY TABLE =====
    _renderSummaryTable(surgeries, allDocs) {
        const allStats = this.computeDetailedStats();
        const totalAll = surgeries.length;
        const types = Object.keys(SURGERY_TYPES);

        // Grand totals by type using canonical resolver
        const grandByType = {};
        types.forEach(t => {
            grandByType[t] = surgeries.filter(s => (typeof SurgeryMetrics !== 'undefined') ? SurgeryMetrics.resolveSurgeryType(s) === t : s.surgeryType === t).length;
        });

        const APPROACH_TYPES = {
            mo: {
                label: 'Mổ mở',
                get color() { return Utils.cssVar('--surgery-mo') || '#A90042'; },
                get onColor() { return Utils.cssVar('--surgery-mo-on') || '#FFFFFF'; }
            },
            noisoi: {
                label: 'Nội soi',
                get color() { return Utils.cssVar('--surgery-noisoi') || '#34A357'; },
                get onColor() { return Utils.cssVar('--surgery-noisoi-on') || '#111542'; }
            },
            nsth: {
                label: 'NSTH',
                get color() { return Utils.cssVar('--surgery-nsth') || '#7C4CD5'; },
                get onColor() { return Utils.cssVar('--surgery-nsth-on') || '#FFFFFF'; }
            },
            robot: {
                label: 'Robot',
                get color() { return Utils.cssVar('--surgery-robot') || '#333C83'; },
                get onColor() { return Utils.cssVar('--surgery-robot-on') || '#FFFFFF'; }
            }
        };
        const grandByApproach = {};
        Object.keys(APPROACH_TYPES).forEach(a => {
            grandByApproach[a] = surgeries.filter(s => (typeof SurgeryMetrics !== 'undefined') ? SurgeryMetrics.resolveApproach(s) === a : s.approachType === a).length;
        });

        const docsList = allDocs || this.getEligibleDoctors();
        const attendingTotal = docsList.filter(d => d.cohortType === 'internal_attending').length;
        const attendingActive = allStats.filter(d => d.doctor.cohortType === 'internal_attending' && (d.total > 0 || d.assistTotal > 0)).length;
        const traineeTotal = docsList.filter(d => d.cohortType === 'internal_trainee').length;
        const traineeActive = allStats.filter(d => d.doctor.cohortType === 'internal_trainee' && (d.total > 0 || d.assistTotal > 0)).length;
        const externalTotal = docsList.filter(d => d.cohortType === 'external').length;
        const externalActive = allStats.filter(d => d.doctor.cohortType === 'external' && (d.total > 0 || d.assistTotal > 0)).length;
        const departedActive = allStats.filter(d => d.doctor.cohortType === 'historical_departed' && (d.total > 0 || d.assistTotal > 0)).length;
        const activeDirectoryCount = attendingActive + traineeActive + externalActive;
        const catalogTotal = attendingTotal + traineeTotal + externalTotal;

        const cohortFilter = this.summaryCohortFilter || 'all';
        const displayedStats = cohortFilter === 'all'
            ? allStats
            : allStats.filter(d => d.doctor.cohortType === cohortFilter);

        return `
        <div class="sstats-summary-cards">
            <div class="sstats-summary-card sstats-total">
                <div class="sstats-summary-value">${totalAll}</div>
                <div class="sstats-summary-label">Tổng ca PT</div>
            </div>
            ${types.map(t => {
                const info = SURGERY_TYPES[t];
                const isDark = document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark';
                const valColor = (t === 'yeucau' && !isDark) ? '#9B6200' : info.color;
                return `<div class="sstats-summary-card">
                    <div class="sstats-summary-value" style="color:${valColor}">${grandByType[t]}</div>
                    <div class="sstats-summary-label">${info.label}</div>
                </div>`;
            }).join('')}
            ${Object.entries(APPROACH_TYPES).map(([k, info]) => {
                return `<div class="sstats-summary-card">
                    <div class="sstats-summary-value" style="color:${info.color}">${grandByApproach[k]}</div>
                    <div class="sstats-summary-label">${info.label}</div>
                </div>`;
            }).join('')}
        </div>

        ${totalAll === 0 ? `
            <div class="card sstats-empty-state-card">
                <div class="sstats-empty-icon">📋</div>
                <p>Chưa có ca phẫu thuật nào trong ${this.getPeriodLabel()}</p>
            </div>
        ` : `
            <!-- ===== SUMMARY TABLE ===== -->
            <div class="card sstats-main-table-card">
                <div class="sstats-main-table-header">
                    <div>
                        <h3>🩺 Bảng tổng hợp năng lực phẫu thuật theo Bác sĩ</h3>
                        <span class="sstats-main-table-hint">Nhấn vào tên BS để xem chi tiết ca mổ chính & phụ mổ</span>
                    </div>
                    <div class="sstats-cohort-filter-bar" role="tablist" aria-label="Lọc nhóm bác sĩ">
                        <button class="sstats-cohort-filter-btn ${cohortFilter === 'all' ? 'active' : ''}" onclick="SurgeryStatsPage.setSummaryCohortFilter('all')">
                            Tất cả có ca (${activeDirectoryCount}) / Danh bạ (${catalogTotal})${departedActive > 0 ? ` (+${departedActive} lịch sử)` : ''}
                        </button>
                        <button class="sstats-cohort-filter-btn ${cohortFilter === 'internal_attending' ? 'active' : ''}" onclick="SurgeryStatsPage.setSummaryCohortFilter('internal_attending')">
                            🏥 BS Cơ hữu Khoa (${attendingActive}/${attendingTotal})
                        </button>
                        <button class="sstats-cohort-filter-btn ${cohortFilter === 'internal_trainee' ? 'active' : ''}" onclick="SurgeryStatsPage.setSummaryCohortFilter('internal_trainee')">
                            🎓 BS Học viên (${traineeActive}/${traineeTotal})
                        </button>
                        <button class="sstats-cohort-filter-btn ${cohortFilter === 'external' ? 'active' : ''}" onclick="SurgeryStatsPage.setSummaryCohortFilter('external')">
                            🤝 BS Phối hợp ngoài khoa (${externalActive}/${externalTotal})
                        </button>
                        ${departedActive > 0 ? `
                        <button class="sstats-cohort-filter-btn ${cohortFilter === 'historical_departed' ? 'active' : ''}" onclick="SurgeryStatsPage.setSummaryCohortFilter('historical_departed')">
                            🕰️ Đã chuyển/nghỉ (${departedActive})
                        </button>
                        ` : ''}
                    </div>
                </div>
                <table class="sstats-table">
                    <thead>
                        <tr>
                            <th class="sstats-th-stt">STT</th>
                            <th class="sstats-th-name">Bác sĩ phẫu thuật</th>
                            ${types.map(t => `<th class="sstats-th-num">${SURGERY_TYPES[t].label}</th>`).join('')}
                            <th class="sstats-th-num" style="color:#6366f1" title="Số ca tham gia phụ mổ">Mổ phụ</th>
                            <th class="sstats-th-num sstats-th-total">Tổng MC</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${displayedStats.map((docStat, idx) => {
                            const isExpanded = this.normId(this.expandedDoctor) === this.normId(docStat.doctor.id);
                            const extBadge = docStat.doctor.isExternal ? `<span class="badge" style="background:#f1f5f9;color:#64748b;font-size:0.7rem;padding:2px 6px;margin-left:6px;border-radius:4px">Ngoài khoa</span>` : '';
                            return `
                        <tr class="sstats-summary-row ${isExpanded ? 'sstats-row-active' : ''}" 
                            onclick="SurgeryStatsPage.toggleDoctor('${docStat.doctor.id}')">
                            <td class="sstats-td-stt">${idx + 1}</td>
                            <td>
                                <div class="sstats-td-name">
                                    ${Utils.renderAvatar ? Utils.renderAvatar(docStat.doctor, 'sm', { extraClass: 'sstats-doc-avatar' }) : ''}
                                    <div>
                                        <div class="sstats-doc-name">${docStat.doctor.name} ${extBadge}</div>
                                        <div class="sstats-doc-role">${docStat.doctor.role}</div>
                                    </div>
                                    <svg class="sstats-expand-icon ${isExpanded ? 'expanded' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                                </div>
                            </td>
                            ${types.map(t => `<td class="sstats-td-num ${docStat.byType[t] === 0 ? 'zero' : ''}">${docStat.byType[t]}</td>`).join('')}
                            <td class="sstats-td-num ${docStat.assistTotal === 0 ? 'zero' : ''}" style="color:${docStat.assistTotal > 0 ? '#6366f1;font-weight:600' : 'inherit'}">${docStat.assistTotal}</td>
                            <td class="sstats-td-num sstats-td-total">${docStat.total}</td>
                        </tr>
                        ${isExpanded ? `
                        <tr class="sstats-detail-row">
                            <td colspan="${types.length + 4}" style="padding:0">
                                ${this._renderDoctorDetail(docStat)}
                            </td>
                        </tr>` : ''}`;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="sstats-footer-row">
                            <td colspan="2" class="sstats-td-footer-label">TỔNG CỘNG</td>
                            ${types.map(t => `<td class="sstats-td-num sstats-td-num-bold">${grandByType[t]}</td>`).join('')}
                            <td class="sstats-td-num sstats-td-num-bold" style="color:#6366f1">${allStats.reduce((sum, d) => sum + d.assistTotal, 0)}</td>
                            <td class="sstats-td-num sstats-td-total sstats-td-total-grand">${totalAll}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `}
        `;
    },

    // Render expanded detail for a specific doctor
    _renderDoctorDetail(docStat) {
        if (docStat.total === 0 && docStat.assistTotal === 0) {
            return `
            <div class="sstats-detail-panel" style="padding: 20px; text-align: center; color: var(--text-muted);">
                <p style="margin: 0; font-size: 0.9rem;">Bác sĩ không có ca mổ chính hoặc phụ mổ trong ${this.getPeriodLabel()}</p>
            </div>`;
        }

        if (docStat.total === 0 && docStat.assistTotal > 0) {
            return `
            <div class="sstats-detail-panel">
                <div class="sstats-detail-header">
                    <div class="sstats-detail-title">
                        <strong>${docStat.doctor.name}</strong> — Không có ca mổ chính · <span style="color:#6366f1;font-weight:700">Phụ mổ: ${docStat.assistTotal} ca</span>
                    </div>
                </div>
                <table class="sstats-detail-table">
                    <thead>
                        <tr>
                            <th class="sstats-detail-th-stt">STT</th>
                            <th class="sstats-detail-th-name">Họ tên BN</th>
                            <th>Năm sinh</th>
                            <th class="sstats-detail-th-diagnosis">Chẩn đoán trước mổ</th>
                            <th class="sstats-detail-th-method">PP phẫu thuật</th>
                            <th>Ngày mổ</th>
                            <th>Loại PT</th>
                            <th>BS mổ chính</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${docStat.assistCases.map((s, idx) => {
                            const rType = (typeof SurgeryMetrics !== 'undefined') ? SurgeryMetrics.resolveSurgeryType(s) : s.surgeryType;
                            const typeInfo = SURGERY_TYPES[rType] || SURGERY_TYPES.chuongtrinh;
                            const mainDoc = Utils.getStaffName(s.mainSurgeon);
                            const dateStr = Utils.formatDate(s.date);
                            return `
                        <tr onclick="SurgeryPage.viewDetail(${s.id})" class="sstats-detail-tr-clickable" title="Xem chi tiết">
                            <td class="sstats-detail-td-stt">${idx + 1}</td>
                            <td><strong>${s.patientName || (s.id ? 'BN #' + s.id : '—')}</strong></td>
                            <td>${s.birthYear || '—'}</td>
                            <td class="sstats-detail-td-text">${s.diagnosis || '—'}</td>
                            <td class="sstats-detail-td-text">${s.method || '—'}</td>
                            <td>${dateStr}</td>
                            <td><span class="surgery-type-badge" style="background:${typeInfo.color};color:${typeInfo.onColor || 'var(--on-primary, #fff)'}">${typeInfo.label}</span></td>
                            <td><strong style="color:var(--text-primary)">${mainDoc}</strong></td>
                        </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        }

        return `
        <div class="sstats-detail-panel">
            <div class="sstats-detail-header">
                <div class="sstats-detail-title">
                    <strong>${docStat.doctor.name}</strong> — ${docStat.total} ca mổ chính${docStat.assistTotal > 0 ? ` · <span style="color:#6366f1;font-weight:700">${docStat.assistTotal} ca phụ mổ</span>` : ''}
                </div>
                <div class="sstats-detail-chips">
                    ${Object.keys(SURGERY_TYPES).map(t => {
                        if (docStat.byType[t] <= 0) return '';
                        const st = SURGERY_TYPES[t];
                        const bg = t === 'yeucau' ? st.color : `${st.color}20`;
                        const fg = t === 'yeucau' ? st.onColor : st.color;
                        return `<span class="sstats-type-chip" style="background:${bg};color:${fg};font-weight:600">${st.label}: ${docStat.byType[t]}</span>`;
                    }).join('')}
                    ${docStat.assistTotal > 0 ? `<span class="sstats-type-chip" style="background:#6366f120;color:#6366f1">Phụ mổ: ${docStat.assistTotal}</span>` : ''}
                </div>
            </div>
            <table class="sstats-detail-table">
                <thead>
                    <tr>
                        <th class="sstats-detail-th-stt">STT</th>
                        <th class="sstats-detail-th-name">Họ tên BN</th>
                        <th>Năm sinh</th>
                        <th class="sstats-detail-th-diagnosis">Chẩn đoán trước mổ</th>
                        <th class="sstats-detail-th-method">PP phẫu thuật</th>
                        <th>Ngày mổ</th>
                        <th>Loại PT</th>
                    </tr>
                </thead>
                <tbody>
                    ${docStat.cases.map((s, idx) => {
                        const rType = (typeof SurgeryMetrics !== 'undefined') ? SurgeryMetrics.resolveSurgeryType(s) : s.surgeryType;
                        const typeInfo = SURGERY_TYPES[rType] || SURGERY_TYPES.chuongtrinh;
                        const dateStr = Utils.formatDate(s.date);
                        return `
                    <tr onclick="SurgeryPage.viewDetail(${s.id})" class="sstats-detail-tr-clickable" title="Xem chi tiết">
                        <td class="sstats-detail-td-stt">${idx + 1}</td>
                        <td><strong>${s.patientName || (s.id ? 'BN #' + s.id : '—')}</strong></td>
                        <td>${s.birthYear || '—'}</td>
                        <td class="sstats-detail-td-text">${s.diagnosis || '—'}</td>
                        <td class="sstats-detail-td-text">${s.method || '—'}</td>
                        <td>${dateStr}</td>
                        <td><span class="surgery-type-badge" style="background:${typeInfo.color};color:${typeInfo.onColor || 'var(--on-primary, #fff)'}">${typeInfo.label}</span></td>
                    </tr>`;
                    }).join('')}
                </tbody>
            </table>

            ${docStat.assistTotal > 0 ? `
            <div style="margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--border);">
                <div style="font-weight: 700; font-size: 0.88rem; color: #6366f1; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                    <span>🤝 Ca tham gia phụ mổ (${docStat.assistTotal} ca)</span>
                </div>
                <table class="sstats-detail-table">
                    <thead>
                        <tr>
                            <th class="sstats-detail-th-stt">STT</th>
                            <th class="sstats-detail-th-name">Họ tên BN</th>
                            <th>Năm sinh</th>
                            <th class="sstats-detail-th-diagnosis">Chẩn đoán trước mổ</th>
                            <th class="sstats-detail-th-method">PP phẫu thuật</th>
                            <th>Ngày mổ</th>
                            <th>Loại PT</th>
                            <th>BS mổ chính</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${docStat.assistCases.map((s, aIdx) => {
                            const rType = (typeof SurgeryMetrics !== 'undefined') ? SurgeryMetrics.resolveSurgeryType(s) : s.surgeryType;
                            const typeInfo = SURGERY_TYPES[rType] || SURGERY_TYPES.chuongtrinh;
                            const mainDoc = Utils.getStaffName(s.mainSurgeon);
                            const dateStr = Utils.formatDate(s.date);
                            return `
                        <tr onclick="SurgeryPage.viewDetail(${s.id})" class="sstats-detail-tr-clickable" title="Xem chi tiết">
                            <td class="sstats-detail-td-stt">${aIdx + 1}</td>
                            <td><strong>${s.patientName || (s.id ? 'BN #' + s.id : '—')}</strong></td>
                            <td>${s.birthYear || '—'}</td>
                            <td class="sstats-detail-td-text">${s.diagnosis || '—'}</td>
                            <td class="sstats-detail-td-text">${s.method || '—'}</td>
                            <td>${dateStr}</td>
                            <td><span class="surgery-type-badge" style="background:${typeInfo.color};color:${typeInfo.onColor || 'var(--on-primary, #fff)'}">${typeInfo.label}</span></td>
                            <td><strong style="color:var(--text-primary)">${mainDoc}</strong></td>
                        </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>` : ''}
        </div>`;
    },

    setActiveTab(tab) {
        this.activeTab = tab;
        App.renderCurrentPage();
    },

    setPrimaryDoctor(docId) {
        this.primaryDoctorId = docId;
        App.renderCurrentPage();
    },

    setCompareDoctor(docId) {
        this.compareDoctorId = docId;
        App.renderCurrentPage();
    },

    toggleDoctor(id) {
        this.expandedDoctor = this.normId(this.expandedDoctor) === this.normId(id) ? null : id;
        App.renderCurrentPage();
    },

    setPeriod(p) {
        this.period = p;
        this.offset = 0;
        this.expandedDoctor = null;
        App.renderCurrentPage();
    },

    prevPeriod() {
        this.offset--;
        this.expandedDoctor = null;
        App.renderCurrentPage();
    },

    nextPeriod() {
        this.offset++;
        this.expandedDoctor = null;
        App.renderCurrentPage();
    },

    resetPeriod() {
        this.offset = 0;
        this.expandedDoctor = null;
        App.renderCurrentPage();
    },

    afterRender() {},

    exportExcel() {
        Utils.loadScript('xlsx')
            .then(() => this._doExportExcel())
            .catch(err => Toast.error('Không tải được thư viện Excel: ' + err.message));
    },

    _doExportExcel() {
        try {
            const allStats = this.computeDetailedStats();
            const surgeries = this.getSurgeriesInRange();
            const types = Object.keys(SURGERY_TYPES);
            const approaches = ['mo', 'noisoi', 'robot', 'nsth'];
            const approachLabels = { mo: 'Mổ mở', noisoi: 'Nội soi', robot: 'Robot', nsth: 'NSTH' };
            const periodLabel = this.getPeriodLabel();
            const wb = XLSX.utils.book_new();

            // Sheet 1: Summary by doctor
            const summaryHeaders = ['STT', 'Bác sĩ phẫu thuật', 'Chức vụ', ...types.map(t => SURGERY_TYPES[t].label), ...approaches.map(a => approachLabels[a]), 'Mổ phụ', 'Tổng MC'];
            const summaryData = [summaryHeaders];
            allStats.forEach((d, i) => {
                const approachCounts = approaches.map(a => d.cases.filter(s => SurgeryMetrics.resolveApproach(s) === a).length);
                summaryData.push([i+1, d.doctor.name, d.doctor.role, ...types.map(t => d.byType[t]), ...approachCounts, d.assistTotal, d.total]);
            });
            const grandByType = {};
            types.forEach(t => { grandByType[t] = surgeries.filter(s => SurgeryMetrics.resolveSurgeryType(s) === t).length; });
            const grandByApproach = approaches.map(a => surgeries.filter(s => SurgeryMetrics.resolveApproach(s) === a).length);
            const grandAssist = allStats.reduce((sum, d) => sum + d.assistTotal, 0);
            summaryData.push(['', 'TỔNG CỘNG', '', ...types.map(t => grandByType[t]), ...grandByApproach, grandAssist, surgeries.length]);

            const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
            ws1['!cols'] = [{wch:5},{wch:25},{wch:20},...types.map(()=>({wch:12})),...approaches.map(()=>({wch:10})),{wch:10},{wch:10}];
            XLSX.utils.book_append_sheet(wb, ws1, 'Tong hop');

            // Sheet 2: Detail all surgeries
            const detailHeaders = ['STT', 'Ngày mổ', 'Họ tên BN', 'Năm sinh', 'Chẩn đoán', 'PP phẫu thuật', 'Nhóm Radar', 'Phân nhóm con', 'Loại PT', 'Đường mổ', 'BS mổ chính', 'Thời lượng (phút)'];
            const detailData = [detailHeaders];
            const allDocs = this.getEligibleDoctors();
            const approachMap = { mo: 'Mổ mở', noisoi: 'Nội soi', nsth: 'NSTH', robot: 'Robot', unknown: 'Chưa rõ' };
            surgeries.sort((a,b) => a.date.localeCompare(b.date)).forEach((s, i) => {
                const doc = allDocs.find(d => this.normId(d.id) === this.normId(s.mainSurgeon));
                const axisKey = this.classifySurgery(s);
                const axisInfo = (axisKey === 'unclassified') ? this.UNCLASSIFIED_AXIS : (this.CLINICAL_AXES[axisKey] || { label: axisKey });
                const detail = this.classifySurgeryDetail(s);
                const subAxisName = this.getSubAxisLabel(axisKey, detail.subAxis);
                const resolvedType = SurgeryMetrics.resolveSurgeryType(s);
                const typeInfo = SURGERY_TYPES[resolvedType] || (resolvedType === 'robot' ? { label: 'Robot' } : { label: resolvedType });
                const resolvedApproach = SurgeryMetrics.resolveApproach(s);
                const dateStr = Utils.formatDate(s.date);
                detailData.push([i+1, dateStr, s.patientName, s.birthYear||'', s.diagnosis||'', s.method||'', axisInfo.label, subAxisName, typeInfo.label, approachMap[resolvedApproach]||resolvedApproach, doc ? doc.name : (s.mainSurgeon ? `BS #${s.mainSurgeon}` : ''), s.duration || '']);
            });
            const ws2 = XLSX.utils.aoa_to_sheet(detailData);
            ws2['!cols'] = [{wch:5},{wch:12},{wch:22},{wch:10},{wch:30},{wch:35},{wch:24},{wch:26},{wch:14},{wch:14},{wch:22},{wch:16}];
            XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiet');

            // Sheet 3: Cơ cấu 6 trục lâm sàng
            const axisKeys = Object.keys(this.CLINICAL_AXES);
            const axisHeaders = ['STT', 'Bác sĩ phẫu thuật', ...axisKeys.map(k => this.CLINICAL_AXES[k].label), 'Chưa phân loại', 'Tổng cộng'];
            const axisData = [axisHeaders];
            allStats.forEach((d, i) => {
                const prof = this.computeSurgeonProfile(d.doctor.id, surgeries, 'main');
                const rowCounts = axisKeys.map(k => prof.axisCounts[k] || 0);
                const unclass = prof.unclassifiedCount || 0;
                axisData.push([i+1, d.doctor.name, ...rowCounts, unclass, prof.total]);
            });
            const deptProf = this.computeSurgeonProfile('dept_total', surgeries, 'main');
            const grandAxisCounts = axisKeys.map(k => deptProf.axisCounts[k] || 0);
            axisData.push(['', 'TỔNG CỘNG TOÀN KHOA', ...grandAxisCounts, deptProf.unclassifiedCount || 0, deptProf.total]);
            const ws3 = XLSX.utils.aoa_to_sheet(axisData);
            ws3['!cols'] = [{wch:5},{wch:25},...axisKeys.map(()=>({wch:24})),{wch:18},{wch:12}];
            XLSX.utils.book_append_sheet(wb, ws3, 'Co cau 6 truc');

            // Blob-based download
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const safeLabel = periodLabel.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/[^a-zA-Z0-9_\-]/g, '_');
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ThongKe_PT_' + safeLabel + '.xlsx';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
            Toast.success('Đã xuất file Excel thành công!');
        } catch (e) {
            console.error('Export Excel error:', e);
            Toast.error('Lỗi xuất Excel: ' + e.message);
        }
    },

    // ===== EXPORT DOCTOR PROFILE AS HIGH-RES 2K IMAGE (RETINA QUALITY) =====
    async exportProfileImage() {
        const btns = document.querySelectorAll('.btn-export-profile');
        btns.forEach(b => { b.disabled = true; b.innerHTML = '⏳ Đang tạo ảnh...'; });

        try {
            Toast.info('🖼️ Đang tạo hình ảnh hồ sơ bác sĩ độ phân giải cao...');

            const surgeries = this.getSurgeriesInRange();
            const p1 = this.computeSurgeonProfile(this.primaryDoctorId, surgeries, this.roleScope);
            const p2 = this.compareDoctorId !== 'none' ? this.computeSurgeonProfile(this.compareDoctorId, surgeries, this.roleScope) : null;
            const hasCompare = !!p2;

            if (!p1) {
                Toast.error('Không tìm thấy dữ liệu hồ sơ bác sĩ.');
                btns.forEach(b => { b.disabled = false; b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Xuất hồ sơ bác sĩ'; });
                return;
            }

            const name1 = (p1.doctor && p1.doctor.name) || 'Bác sĩ';
            const name2 = (p2 && p2.doctor && p2.doctor.name) || 'Bác sĩ so sánh';
            const shortName1 = name1.split(' ').pop();
            const shortName2 = name2.split(' ').pop();
            const periodLabel = this.getPeriodLabel();

            const session = (typeof Auth !== 'undefined' && Auth.getSession()) ? Auth.getSession() : null;
            const user = (session && (session.name || session.username)) ? (session.name || session.username) : 'BS. Quản trị';
            const now = new Date();
            const pad = n => String(n).padStart(2, '0');
            const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
            const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

            const totalDiff = hasCompare ? (p1.total - p2.total) : 0;
            const totalPctDiff = (hasCompare && p2.total > 0) ? Math.round(((totalDiff / p2.total) * 100) * 10) / 10 : 0;

            // Generate clean SVG string for radar with exportMode = true
            const radarSVGString = this._renderRadarSVG(p1, p2, { mode: this.radarScaleMode, exportMode: true });

            // Table rows for Matrix
            const axisKeys = Object.keys(this.CLINICAL_AXES);
            let tableRowsHTML = axisKeys.map(k => {
                const ax = this.CLINICAL_AXES[k];
                const c1 = p1.axisCounts[k] || 0;
                const pct1 = p1.axisPct[k] || 0;
                const c2 = p2 ? (p2.axisCounts[k] || 0) : 0;
                const pct2 = p2 ? (p2.axisPct[k] || 0) : 0;
                const delta = Math.round((pct1 - pct2) * 10) / 10;
                const subBreakdown = this.SUB_AXIS_MAP[k] || {};
                const subEntries = Object.entries(subBreakdown);

                return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 11px 12px; vertical-align: middle;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 16px;">${ax.icon}</span>
                            <div>
                                <div style="font-weight: 700; font-size: 13px; color: #1e293b;">${ax.label}</div>
                                <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">${subEntries.map(([subKey, subLabel]) => `${subLabel}: <strong>${p1.subAxisCounts[subKey] || 0}</strong>`).join(' · ')}</div>
                            </div>
                        </div>
                    </td>
                    ${hasCompare ? `
                    <td style="padding: 11px 12px; text-align: right; vertical-align: middle; color: #1D2357; font-weight: 700; font-size: 13px;">
                        ${c1} <span style="font-size: 11px; font-weight: 500; color: #64748b;">ca</span>
                        <div style="font-size: 11px; font-weight: 600; color: #1D2357;">${pct1.toFixed(1)}%</div>
                    </td>
                    <td style="padding: 11px 12px; text-align: right; vertical-align: middle; color: #CB242D; font-weight: 700; font-size: 13px;">
                        ${c2} <span style="font-size: 11px; font-weight: 500; color: #64748b;">ca</span>
                        <div style="font-size: 11px; font-weight: 600; color: #CB242D;">${pct2.toFixed(1)}%</div>
                    </td>
                    <td style="padding: 11px 12px; text-align: center; vertical-align: middle;">
                        <span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; background: ${delta > 0 ? '#ecfdf5' : delta < 0 ? '#fff1f2' : '#f1f5f9'}; color: ${delta > 0 ? '#059669' : delta < 0 ? '#CB242D' : '#64748b'};">
                            ${delta > 0 ? `+${delta.toFixed(1)}%` : delta < 0 ? `${delta.toFixed(1)}%` : '0.0%'}
                        </span>
                    </td>
                    ` : `
                    <td style="padding: 11px 12px; text-align: right; vertical-align: middle; color: #1D2357; font-weight: 800; font-size: 14px;">
                        ${c1} <span style="font-size: 11px; font-weight: 500; color: #64748b;">ca</span>
                    </td>
                    <td style="padding: 11px 12px; text-align: right; vertical-align: middle; color: #1D2357; font-weight: 800; font-size: 14px;">
                        ${pct1.toFixed(1)}%
                    </td>
                    `}
                </tr>`;
            }).join('');

            // Unclassified row if any
            if (p1.unclassifiedCount > 0 || (p2 && p2.unclassifiedCount > 0)) {
                const u1 = p1.unclassifiedCount || 0;
                const upct1 = p1.unclassifiedPct || 0;
                const u2 = p2 ? (p2.unclassifiedCount || 0) : 0;
                const upct2 = p2 ? (p2.unclassifiedPct || 0) : 0;
                const udelta = Math.round((upct1 - upct2) * 10) / 10;
                tableRowsHTML += `
                <tr style="border-bottom: 1px solid #fde68a; background: #fffbeb;">
                    <td style="padding: 11px 12px; vertical-align: middle;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 16px;">⚠️</span>
                            <div>
                                <div style="font-weight: 700; font-size: 13px; color: #b45309;">Chưa phân loại / Ngoại khoa khác</div>
                                <div style="font-size: 11px; color: #92400e; margin-top: 1px;">Cần rà soát chẩn đoán và phương pháp mổ</div>
                            </div>
                        </div>
                    </td>
                    ${hasCompare ? `
                    <td style="padding: 11px 12px; text-align: right; vertical-align: middle; color: #1D2357; font-weight: 700; font-size: 13px;">
                        ${u1} <span style="font-size: 11px; font-weight: 500; color: #64748b;">ca</span>
                        <div style="font-size: 11px; font-weight: 600; color: #1D2357;">${upct1.toFixed(1)}%</div>
                    </td>
                    <td style="padding: 11px 12px; text-align: right; vertical-align: middle; color: #CB242D; font-weight: 700; font-size: 13px;">
                        ${u2} <span style="font-size: 11px; font-weight: 500; color: #64748b;">ca</span>
                        <div style="font-size: 11px; font-weight: 600; color: #CB242D;">${upct2.toFixed(1)}%</div>
                    </td>
                    <td style="padding: 11px 12px; text-align: center; vertical-align: middle;">
                        <span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #fef3c7; color: #b45309;">
                            ${udelta > 0 ? `+${udelta.toFixed(1)}%` : `${udelta.toFixed(1)}%`}
                        </span>
                    </td>
                    ` : `
                    <td style="padding: 11px 12px; text-align: right; vertical-align: middle; color: #b45309; font-weight: 800; font-size: 14px;">
                        ${u1} <span style="font-size: 11px; font-weight: 500; color: #64748b;">ca</span>
                    </td>
                    <td style="padding: 11px 12px; text-align: right; vertical-align: middle; color: #b45309; font-weight: 800; font-size: 14px;">
                        ${upct1.toFixed(1)}%
                    </td>
                    `}
                </tr>`;
            }

            // Full isolated HTML export template
            const fullHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <title>Hồ Sơ Năng Lực & Cơ Cấu Phẫu Thuật 6 Trục</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Noto+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root { --primary: #1D2357; --state-danger: #CB242D; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Be Vietnam Pro', 'Noto Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #ffffff;
            color: #0f172a;
            padding: 0;
            margin: 0;
            width: 1120px;
            -webkit-font-smoothing: antialiased;
        }
        .capture-card {
            background: #ffffff;
            width: 1120px;
            margin: 0 auto;
            border: 1px solid #cbd5e1;
            overflow: hidden;
        }
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 20px;
        }
        .kpi-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 14px 16px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }
        .kpi-card-header {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            margin-bottom: 6px;
        }
        .kpi-val {
            font-size: 25px;
            font-weight: 800;
            color: #1D2357;
            line-height: 1.1;
        }
        .kpi-sub {
            font-size: 11.5px;
            font-weight: 600;
            color: #334155;
            margin-top: 3px;
        }
        .kpi-tag {
            display: inline-block;
            margin-top: 6px;
            padding: 2px 7px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 600;
            background: #ecfeff;
            color: #1D2357;
            border: 1px solid #cffafe;
        }
        .main-split {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            align-items: stretch;
        }
        .sub-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .sub-card-title {
            font-size: 13.5px;
            font-weight: 700;
            color: #0f172a;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 3px;
        }
        .sub-card-desc {
            font-size: 11px;
            color: #64748b;
            margin-bottom: 10px;
        }
        .legend-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 3px 10px;
            background: #ecfeff;
            border: 1px solid #cffafe;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            color: #1D2357;
            margin-bottom: 8px;
        }
        .radar-box {
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 4px 0;
        }
        .disclaimer-box {
            background: #fffbeb;
            border: 1px solid #fef3c7;
            border-radius: 8px;
            padding: 7px 10px;
            font-size: 10px;
            color: #b45309;
            line-height: 1.35;
            margin-top: 8px;
        }
        .matrix-table {
            width: 100%;
            border-collapse: collapse;
        }
        .matrix-table th {
            padding: 8px 10px;
            font-size: 10.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #475569;
            border-bottom: 2px solid #cbd5e1;
            background: #f8fafc;
        }
        .matrix-total-row td {
            padding: 10px 12px;
            font-size: 12.5px;
            font-weight: 800;
            color: #0f172a;
            border-top: 2px solid #1D2357;
            background: #f8fafc;
        }
        .export-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 18px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            font-size: 10.5px;
            color: #64748b;
        }
    </style>
</head>
<body>
    <div id="capture" class="capture-card">
        <!-- HEADER WITH DARK NAVY GRADIENT STANDARD ACROSS PTDTT-MANAGER -->
        <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:22px 32px;display:flex;justify-content:space-between;align-items:center;">
            <div>
                <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:normal;">KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG</div>
                <div style="font-size:13px;color:#cbd5e1;margin-top:3px;">Bệnh viện Bình Dân · TP. Hồ Chí Minh</div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:normal;">HỒ SƠ NĂNG LỰC PHẪU THUẬT</div>
                <div style="font-size:13px;color:#67e8f9;font-weight:600;margin-top:3px;">Cơ cấu &amp; Đối chuẩn 6 Trục Lâm sàng</div>
            </div>
        </div>

        <!-- SUB-HEADER / METADATA INFO BAR -->
        <div style="padding:12px 32px;background:#f0f9ff;border-bottom:2px solid #bae6fd;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div style="font-size:13.5px;color:#0f172a;">
                Phẫu thuật viên: <strong style="color:#1D2357;font-size:15px;">${name1}</strong> <span style="font-size:12px;color:#64748b;">(${p1.doctor.role})</span>
                ${hasCompare ? ` <span style="margin:0 6px;padding:2px 7px;background:#e2e8f0;border-radius:10px;font-size:11px;font-weight:700;color:#475569;">VS</span> Đối chuẩn: <strong style="color:#CB242D;font-size:15px;">${name2}</strong> <span style="font-size:12px;color:#64748b;">(${p2.doctor.role})</span>` : ''}
            </div>
            <div style="font-size:13px;color:#334155;font-weight:600;">
                📅 Kỳ thống kê: <span style="color:#1D2357;">${periodLabel}</span> · Tổng: <strong style="color:#0f172a;font-size:14px;">${p1.doctor.id === 'dept_avg' ? `${p1.total.toFixed(1)} ca` : `${p1.total} ca`}</strong>
            </div>
        </div>

        <div style="padding: 22px 28px;">
            <!-- 4 KPI CARDS -->
            <div class="kpi-grid">
                <!-- KPI 1 -->
                <div class="kpi-card">
                    <div class="kpi-card-header">🎯 ${p1.doctor.id === 'dept_avg' ? 'Trung bình ca / BS cơ hữu' : (p1.doctor.id === 'dept_total' ? 'Tổng ca mổ toàn khoa' : (this.roleScope === 'assist' ? 'Tổng ca phụ mổ' : (this.roleScope === 'all' ? 'Tổng ca tham gia' : 'Tổng ca mổ chính')))}</div>
                    <div class="kpi-val">${p1.doctor.id === 'dept_avg' ? p1.total.toFixed(1) : p1.total}</div>
                    <div class="kpi-sub">${hasCompare ? `${shortName1}: ${p1.total} vs ${shortName2}: ${p2.total}` : (p1.doctor.id === 'dept_avg' ? `Trung bình ${p1.benchmarkDocCount || 0} BS cơ hữu mổ chính` : (p1.doctor.id === 'dept_total' ? `Toàn Khoa (${p1.total} ca)` : `Mổ chính: ${p1.mainCount || p1.total} · Phụ: ${p1.assistOnlyCount || 0} · Tham gia: ${p1.participatedCount || p1.total}`))}</div>
                    <div class="kpi-tag">${p1.doctor.id === 'dept_avg' ? 'Chuẩn đối sánh nội bộ khoa' : (p1.doctor.id === 'dept_total' ? 'Tổng khối lượng mổ toàn khoa' : 'Khối lượng phẫu thuật hoàn thành')}</div>
                </div>

                <!-- KPI 2 -->
                <div class="kpi-card">
                    <div class="kpi-card-header">🔬 Tỷ lệ Xâm lấn tối thiểu (MIS)</div>
                    <div class="kpi-val">${p1.misPct.toFixed(1)}%</div>
                    <div class="kpi-sub">${p1.misCases} ca (Nội soi: ${p1.noisoiCases} · Robot: ${p1.robotCases})</div>
                    <div class="kpi-tag">Mổ mở: ${p1.openCases} ca (${p1.openPct.toFixed(1)}%) · NSTH: ${p1.nsthCases} ca</div>
                </div>

                <!-- KPI 3 -->
                <div class="kpi-card">
                    <div class="kpi-card-header">⏱️ Thời lượng phẫu thuật ghi nhận</div>
                    <div class="kpi-val">${p1.validDurCount > 0 ? `${p1.medianDur || p1.meanDur}p` : '—'}</div>
                    <div class="kpi-sub">${p1.validDurCount > 0 ? `Trung vị [IQR: ${p1.iqrDur.q1}–${p1.iqrDur.q3}p] · Mẫu: ${p1.validDurCount}/${p1.totalRaw} (${p1.validDurCoveragePct}%)` : `Mẫu: 0/${p1.totalRaw} (0%)`}</div>
                    <div class="kpi-tag">ĐT-TT: ${p1.colorectalMeanDur > 0 ? `${p1.colorectalMeanDur}p` : '—'} · HM-Sàn chậu: ${p1.proctoMeanDur > 0 ? `${p1.proctoMeanDur}p` : '—'}</div>
                </div>

                <!-- KPI 4 -->
                <div class="kpi-card">
                    <div class="kpi-card-header">📋 Cơ cấu Phân loại & Robot</div>
                    <div class="kpi-val">${p1.yeucauPct.toFixed(0)}%</div>
                    <div class="kpi-sub">Yêu cầu: ${p1.electiveReq} ca · Chương trình: ${p1.electiveRoutine} ca</div>
                    <div class="kpi-tag">Loại Robot: ${p1.typeRobot || 0} ca · Bán khẩn: ${p1.urgent} ca · K ĐT-TT: ${p1.oncologyResections || 0} ca</div>
                </div>
            </div>

            <!-- 2 COLUMNS: RADAR (LEFT) + MATRIX (RIGHT) -->
            <div class="main-split">
                <!-- LEFT: RADAR -->
                <div class="sub-card">
                    <div>
                        <div class="sub-card-title">
                            <span>🎯 Biểu Đồ Radar 6 Trục</span>
                        </div>
                        <div class="sub-card-desc">Hồ sơ phân bố cơ cấu chuyên môn phẫu thuật viên</div>
                        <div class="legend-pill">
                            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#1D2357;"></span>
                            <span>${name1} (${p1.doctor.id === 'dept_avg' ? `${p1.total.toFixed(1)} ca/BS` : `${p1.total} ca`})</span>
                            ${hasCompare ? ` · <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#CB242D;margin-left:4px;"></span> ${name2} (${p2.doctor.id === 'dept_avg' ? `${p2.total.toFixed(1)} ca/BS` : `${p2.total} ca`})` : ''}
                        </div>
                    </div>

                    <div class="radar-box">
                        ${radarSVGString}
                    </div>

                    <div class="disclaimer-box">
                        ⚠️ <em>Chỉ số số lượng ca mổ và thời gian phẫu thuật phụ thuộc vào phân công lịch mổ, cơ cấu ca khó/phức tạp và tính chất cấp cứu; dùng phục vụ tự đánh giá chuyên môn và quản lý chất lượng.</em>
                    </div>
                </div>

                <!-- RIGHT: MATRIX -->
                <div class="sub-card">
                    <div>
                        <div class="sub-card-title">
                            <span>📊 Bảng Phân Tích Cơ Cấu 6 Trục</span>
                            <span style="font-size:11px;font-weight:600;color:#64748b;">Khoa PTĐTT — BV Bình Dân</span>
                        </div>
                        <div class="sub-card-desc">Chi tiết số lượng & Tỷ trọng từng nhóm phẫu thuật</div>
                    </div>

                    <table class="matrix-table">
                        <thead>
                            <tr>
                                <th style="text-align:left;">TRỤC NĂNG LỰC</th>
                                ${hasCompare ? `
                                    <th style="text-align:right;color:#1D2357;">${shortName1}</th>
                                    <th style="text-align:right;color:#CB242D;">${shortName2}</th>
                                    <th style="text-align:center;">Chênh lệch</th>
                                ` : `
                                    <th style="text-align:right;color:#1D2357;">Số ca (${shortName1})</th>
                                    <th style="text-align:right;color:#1D2357;">Tỷ trọng cơ cấu</th>
                                `}
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRowsHTML}
                        </tbody>
                        <tfoot>
                            <tr class="matrix-total-row">
                                <td>TỔNG CỘNG</td>
                                ${hasCompare ? `
                                    <td style="text-align:right;color:#1D2357;">${p1.doctor.id === 'dept_avg' ? `${p1.total.toFixed(1)} ca` : `${p1.total} ca`}</td>
                                    <td style="text-align:right;color:#CB242D;">${p2.doctor.id === 'dept_avg' ? `${p2.total.toFixed(1)} ca` : `${p2.total} ca`}</td>
                                    <td style="text-align:center;">
                                        <span style="display:inline-block;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:700;background:${totalDiff >= 0 ? '#ecfdf5' : '#fff1f2'};color:${totalDiff >= 0 ? '#059669' : '#CB242D'};">
                                            ${totalPctDiff >= 0 ? `+${totalPctDiff.toFixed(1)}%` : `${totalPctDiff.toFixed(1)}%`}
                                        </span>
                                    </td>
                                ` : `
                                    <td style="text-align:right;color:#1D2357;">${p1.doctor.id === 'dept_avg' ? `${p1.total.toFixed(1)} ca` : `${p1.total} ca`}</td>
                                    <td style="text-align:right;color:#1D2357;">100%</td>
                                `}
                            </tr>
                        </tfoot>
                    </table>

                    <div style="font-size: 10.5px; color: #64748b; margin-top: 12px; text-align: right;">
                        Phân loại năng lực lâm sàng chuyên sâu Khoa Phẫu thuật Đại trực tràng (Chuẩn Cleveland Clinic DDSI / ASCRS)
                    </div>
                </div>
            </div>

            <!-- FOOTER -->
            <div class="export-footer">
                <span>Hệ thống Quản trị Lâm sàng Khoa Phẫu Thuật Đại Trực Tràng — Bệnh viện Bình Dân</span>
                <span>Xuất bởi: <strong>${user}</strong> · Lúc ${timeStr} — ${dateStr}</span>
            </div>
        </div>
    </div>
</body>
</html>`;

            // Create off-screen iframe
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1200px;height:2400px;border:none;opacity:0;pointer-events:none';
            document.body.appendChild(iframe);

            await new Promise(resolve => { iframe.onload = resolve; iframe.srcdoc = fullHtml; });
            await new Promise(r => setTimeout(r, 600));

            const captureEl = iframe.contentDocument.getElementById('capture');
            await Utils.loadScript('html2canvas');
            const EXPORT_SCALE = Math.max(Math.ceil(2560 / 1120), 2.5); // Retina 2.5K
            const canvas = await html2canvas(captureEl, {
                scale: EXPORT_SCALE,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                letterRendering: true,
                allowTaint: false,
                imageTimeout: 15000,
                windowWidth: 1160,
                windowHeight: captureEl.scrollHeight + 100
            });

            document.body.removeChild(iframe);

            // Standard Watermark across entire canvas
            this._addProfileWatermark(canvas);

            const safeName = (p1.doctor.name || 'HoSoBacSi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/[^a-zA-Z0-9_\-]/g, '_');
            const safePeriod = periodLabel.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/[^a-zA-Z0-9_\-]/g, '_');
            const filename = `HoSo_BS_${safeName}_${safePeriod}_${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}.png`;

            // Download via server or direct fallback
            const dataUrl = canvas.toDataURL('image/png');
            const dlHeaders = { 'Content-Type': 'application/json' };
            const dlToken = (typeof Auth !== 'undefined') ? Auth.getToken() : null;
            if (dlToken) dlHeaders['Authorization'] = 'Bearer ' + dlToken;

            try {
                const resp = await fetch('/api/download-image', {
                    method: 'POST',
                    headers: dlHeaders,
                    body: JSON.stringify({ image: dataUrl, filename: filename })
                });

                if (resp.ok) {
                    const blob = await resp.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    await new Promise(r => setTimeout(r, 500));
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    Toast.success('✅ Đã xuất hình ảnh hồ sơ bác sĩ thành công!');
                    return;
                }
            } catch (e) {
                console.warn('Fallback to direct download:', e);
            }

            // Direct download fallback
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => document.body.removeChild(a), 500);
            Toast.success('✅ Đã xuất hình ảnh hồ sơ bác sĩ thành công!');
        } catch (err) {
            console.error('Export profile image error:', err);
            Toast.error('Lỗi khi xuất ảnh hồ sơ: ' + (err.message || err));
        } finally {
            btns.forEach(b => { 
                b.disabled = false; 
                b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Xuất hồ sơ bác sĩ'; 
            });
        }
    },

    _addProfileWatermark(canvas) {
        try {
            if (typeof Utils !== 'undefined' && typeof Utils.applyExportWatermark === 'function') {
                Utils.applyExportWatermark(canvas);
            }
        } catch (e) {
            console.warn('Watermark error:', e);
        }
    }
};

if (typeof window !== 'undefined') {
    window.SurgeryStatsPage = SurgeryStatsPage;
}
