// ===== SURGERY STATISTICS & SURGEON DASHBOARD PAGE =====
const SurgeryStatsPage = {
    period: 'all', // week | month | quarter | year | all (default all for comprehensive profile)
    offset: 0, // 0 = current, -1 = previous, 1 = next, etc.
    activeTab: 'radar', // 'radar' (Dashboard BS & Radar) | 'summary' (Tổng hợp toàn khoa)
    expandedDoctor: null, // id of the doctor whose detail is shown in summary table
    primaryDoctorId: 'dept_total', // Default: Toàn khoa (Tổng số ca tuyệt đối)
    compareDoctorId: 'none', // Default: Luôn để trống (Không so sánh)
    showAllLogbookCases: false, // false = 100 cases, true = all cases
    logbookSearch: '', // search query
    logbookFilterAxis: 'all', // 'all' | 'colon' | 'rectal' | 'proctology' | 'stoma' | 'biliary_gi' | 'emergency'
    logbookFilterApproach: 'all', // 'all' | 'noisoi' | 'mo' | 'robot' | 'nsth'
    logbookFilterType: 'all', // 'all' | 'chuongtrinh' | 'yeucau' | 'bankhan'

    toggleShowAllCases() {
        this.showAllLogbookCases = !this.showAllLogbookCases;
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
        if (typeof App !== 'undefined' && App.renderCurrentPage) {
            App.renderCurrentPage();
            const el = document.getElementById('sstats-logbook-section');
            if (el && axis !== 'all') {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
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
        this.logbookFilterApproach = 'all';
        this.logbookFilterType = 'all';
        if (typeof App !== 'undefined' && App.renderCurrentPage) {
            App.renderCurrentPage();
        }
    },

    // 6 Trục Năng Lực Lâm Sàng Chuẩn Hóa Khoa PTĐTT — BV Bình Dân (2026)
    // Tham khảo cơ cấu chuyên khoa sâu của các trung tâm quốc tế (Cleveland Clinic DDSI / ASCRS)
    CLINICAL_AXES: {
        colon: {
            id: 'colon',
            label: '1. Đại tràng',
            sublabel: 'Colectomy',
            color: '#0284c7',
            icon: '🩺',
            desc: 'Cắt đại tràng phải, trái, sigma, toàn phần, CME/D3'
        },
        rectal: {
            id: 'rectal',
            label: '2. Trực tràng & TME',
            sublabel: 'Rectal / TME / LAR',
            color: '#0891b2',
            icon: '🎯',
            desc: 'Cắt trước thấp LAR, TME, ICG, Miles, TaTME, ISR'
        },
        proctology: {
            id: 'proctology',
            label: '3. Hậu môn - Trực tràng',
            sublabel: 'Proctology',
            color: '#10b981',
            icon: '🩹',
            desc: 'Trĩ dao siêu âm, Longo, Rò hậu môn / LIFT, Nứt kẽ, Áp xe'
        },
        stoma: {
            id: 'stoma',
            label: '4. Đóng/Mở HMNT',
            sublabel: 'Stoma / Hartmann',
            color: '#8b5cf6',
            icon: '🔄',
            desc: 'Đóng hồi tràng ra da, Hartmann Reversal, Đóng đại tràng'
        },
        biliary_gi: {
            id: 'biliary_gi',
            label: '5. Gan mật & Phối hợp',
            sublabel: 'Biliary & General GI',
            color: '#f59e0b',
            icon: '🔬',
            desc: 'PTNS cắt túi mật, ruột non, nối tắt, thoát vị'
        },
        emergency: {
            id: 'emergency',
            label: '6. Cấp cứu & Bán khẩn',
            sublabel: 'Acute Care & Emergency',
            color: '#ef4444',
            icon: '⚡',
            desc: 'Khâu thủng tạng, tắc ruột, viêm phúc mạc, ruột thừa'
        }
    },

    // Filter: BCN khoa + Bác sĩ chính + External doctors
    getEligibleDoctors() {
        const internal = Store.getAll('staff').filter(s =>
            s.role === 'BS Trưởng khoa' ||
            s.role === 'BS Phó trưởng khoa' ||
            s.role === 'Bác sĩ chính'
        );
        const external = (Store.getAll('externalDoctors') || []).map(d => ({
            ...d,
            role: d.position || 'BS ngoài khoa'
        }));
        return [...internal, ...external];
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
        const all = SurgeryPage.getAllSurgeries();
        if (all.length === 0) {
            const now = new Date();
            return { start: new Date(now.getFullYear(), 0, 1), end: now };
        }
        const dates = all.map(s => new Date(s.date)).sort((a, b) => a - b);
        const start = new Date(dates[0]);
        start.setHours(0, 0, 0, 0);
        const end = new Date(dates[dates.length - 1]);
        end.setHours(23, 59, 59, 999);
        return { start, end };
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
        const all = SurgeryPage.getAllSurgeries();
        if (this.period === 'all') {
            return all;
        }
        const { start, end } = this.getDateRange();
        return all.filter(s => {
            const d = new Date(s.date);
            return d >= start && d <= end;
        });
    },

    getPatientRoom(patientName) { // eslint-disable-line no-unused-vars
        return '—';
    },

    // ===== THUẬT TOÁN PHÂN LOẠI 6 TRỤC NĂNG LỰC LÂM SÀNG PHẪU THUẬT =====
    // Chuẩn hóa Unicode NFC và phân tích có trọng số theo phương pháp phẫu thuật (Method-First Priority)
    classifySurgery(s) {
        if (!s) return 'emergency';
        const method = (s.method || '').normalize('NFC').toLowerCase().trim();
        const diag = (s.diagnosis || '').normalize('NFC').toLowerCase().trim();
        const text = `${method} ${diag}`;

        // 1. HẬU MÔN NHÂN TẠO & LƯU THÔNG RUỘT (STOMA - Trục 4)
        // Ưu tiên cao nhất cho phẫu thuật đóng / mở / sửa HMNT / tái lập lưu thông ruột
        // (Tránh bị nhầm vào nhóm Đại tràng/Trực tràng do chẩn đoán chứa bệnh nền K cũ)
        const hasMajorResection = [
            'cắt đại tràng', 'cắt trước thấp', 'cắt trước', 'cắt trực tràng', 'miles', 'cắt cụt', 
            'lar', 'tme', 'tatme', 'cắt toàn bộ đại tràng', 'cắt nửa đại tràng', 'cắt đoạn đại tràng', 'colectomy'
        ].some(k => method.includes(k));

        const isStomaOp = (
            (method.includes('đóng') && ['hồi tràng', 'hmnt', 'hậu môn nhân tạo', 'đại tràng', 'lỗ mở', 'ruột', 'mổ'].some(k => method.includes(k))) ||
            method.includes('tái lập lưu thông') || method.includes('hartmann reversal') || method.includes('reversal') ||
            (method.includes('phẫu thuật đóng') && ['hmnt', 'hồi tràng', 'hậu môn nhân tạo'].some(k => text.includes(k))) ||
            ((method.includes('mở') || method.includes('làm') || method.includes('chuyển lưu')) && 
             ['hồi tràng', 'hmnt', 'hậu môn nhân tạo'].some(k => method.includes(k)) && !hasMajorResection) ||
            ['sửa hmnt', 'sửa hậu môn nhân tạo', 'chăm sóc hmnt', 'đặt lại hmnt', 'hạ lưu', 'sa hậu môn nhân tạo', 'sa hmnt'].some(k => text.includes(k))
        );

        if (isStomaOp && !hasMajorResection) {
            return 'stoma';
        }

        // 2. BỆNH LÝ HẬU MÔN - TRỰC TRÀNG LÀNH TÍNH (PROCTOLOGY - Trục 3)
        // Trĩ, rò hậu môn, nứt kẽ, áp xe tầng sinh môn, sa trực tràng, xoang cùng cụt, u nhú...
        const isProctologyOp = (
            [
                'trĩ', 'longo', 'milligan', 'ferguson', 'khâu treo trĩ', 'thắt trĩ', 'triệt mạch trĩ', 'thd', 
                'rò hậu môn', 'fistula', 'fistulotomy', 'fistulectomy', 'lift', 'seton', 'cột dây thun', 
                'mô xơ đường rò', 'cắt mô xơ', 'nứt kẽ', 'cắt cơ thắt', 'áp xe hậu môn', 'apxe hậu môn', 
                'apxe quanh hậu môn', 'áp xe quanh hậu môn', 'polyp hậu môn', 'u nhú hậu môn', 'condyloma', 
                'sùi mào gà', 'da thừa hậu môn', 'đốt u sùi', 'rò âm đạo - trực tràng', 'rò trực tràng', 
                'sa trực tràng', 'delorme', 'altemeier', 'rectopexy', 'cố định trực tràng',
                'cắt polyp trực tràng qua ngã hậu môn', 'cắt polyp qua ngã hậu môn', 'cắt u qua ngã hậu môn', 
                'cùng cụt', 'rò cùng cụt', 'xoang cùng cụt', 'pilonidal', 'nang tổ lông',
                'cắt u mỡ quanh hậu môn', 'cắt u mỡ hậu môn', 'dẫn lưu áp xe hậu môn', 'polyp ống hậu môn',
                'thắt trĩ qua nội soi', 'tiêm xơ trĩ'
            ].some(k => method.includes(k)) ||
            (
                [
                    'trĩ', 'rò hậu môn', 'nứt kẽ', 'áp xe quanh hậu môn', 'apxe hậu môn', 'apxe quanh hậu môn', 
                    'sa trực tràng', 'condyloma', 'sùi mào gà', 'xoang cùng cụt', 'rò cùng cụt', 'nang tổ lông', 'polyp ống hậu môn'
                ].some(k => diag.includes(k)) &&
                !hasMajorResection && 
                !['k trực tràng', 'k đại tràng', 'ung thư đại tràng', 'ung thư trực tràng'].some(k => diag.includes(k))
            )
        );

        if (isProctologyOp && !hasMajorResection) {
            return 'proctology';
        }

        // 3. GAN MẬT & TIÊU HÓA PHỐI HỢP (BILIARY & GENERAL GI - Trục 5)
        // Thoát vị bẹn, túi mật, dạ dày, lách, u sau phúc mạc, ruột non, đa cơ quan phối hợp...
        const isBiliaryGiOp = (
            [
                'túi mật', 'cholecystectomy', 'sỏi mật', 'ống mật chủ', 'ercp', 'thoát vị bẹn', 'thoát vị thành bụng', 
                'thoát vị vết mổ', 'thoát vị đùi', 'thoát vị rốn', 'thoát vị hoành', 'phục hồi thành bụng', 'phục hồi thành bẹn', 
                'phục hồi rốn', 'phục hồi cơ hoành', 'tapp', 'tep', 'lichtenstein', 'ruột non', 'cắt ruột non', 'nối ruột', 'nối vị tràng', 
                'nối tắt', 'dạ dày', 'cắt dạ dày', 'khâu lỗ thủng dạ dày', 'lách', 'cắt lách', 'u mạc treo', 
                'u sau phúc mạc', 'u mỡ sau phúc mạc', 'nang mạc treo', 'nang niệu rốn', 'xoang niệu rốn', 'nang buồng trứng', 
                'cắt tử cung', 'cắt buồng trứng', 'thực quản', 'tuyến giáp', 'gist', 'tá tràng', 'sarcoma', 'hang vị', 'thân vị',
                'cắt u mỡ', 'u mỡ vùng lưng', 'thay jj', 'c-arm', 'u hồi tràng', 'u hỗng tràng', 'esd dạ dày', 'esd thực quản', 'esd tá tràng'
            ].some(k => method.includes(k)) ||
            (
                [
                    'sỏi túi mật', 'viêm túi mật', 'thoát vị bẹn', 'thoát vị thành bụng', 'thoát vị rốn', 'thoát vị hoành', 
                    'thoát vị vết mổ', 'u sau phúc mạc', 'u mạc treo', 'sỏi ống mật chủ', 'nang niệu rốn', 'xoang niệu rốn', 
                    'gist', 'dạ dày', 'thực quản', 'sarcoma', 'tá tràng', 'hang vị', 'nang mạc treo', 'u mỡ lớn vùng lưng', 'u mỡ', 'u hồi tràng'
                ].some(k => diag.includes(k)) &&
                !hasMajorResection && 
                !['k trực tràng', 'k đại tràng'].some(k => diag.includes(k))
            )
        );

        if (isBiliaryGiOp && !hasMajorResection) {
            return 'biliary_gi';
        }

        // 4. PHẪU THUẬT TRỰC TRÀNG & TME (RECTAL - Trục 2)
        // LAR, Ultra-low LAR, TME, Miles/APR, ISR, TaTME, TAMIS, TEM, cắt u trực tràng...
        const isRectalOp = (
            [
                'cắt trước thấp', 'cắt trước', 'lar', 'tme', 'miles', 'apr', 'cắt cụt trực tràng', 'cắt trực tràng', 
                'tatme', 'tamis', 'tem', 'bảo tồn cơ thắt', 'gian cơ thắt', 'isr', 'pull-through', 'pull through', 
                'kraske', 'mason', 'cắt u trực tràng', 'phẫu thuật nội soi cắt u trực tràng', 'sinh thiết u qua ngã hậu môn', 
                'sinh thiết qua ngã hậu môn', 'nong miệng nối trực tràng', 'cắt polyp trực tràng'
            ].some(k => method.includes(k)) ||
            (
                [
                    'k trực tràng', 'u trực tràng', 'k ống hậu môn', 'carcinoma trực tràng', 'ung thư trực tràng', 
                    'polyp trực tràng', 'u dưới niêm trực tràng', 'polyp lớn trực tràng'
                ].some(k => diag.includes(k)) &&
                ['cắt', 'nạo hạch', 'ptns', 'robot', 'mổ mở', 'phẫu thuật', 'esd', 'sinh thiết', 'nong'].some(k => method.includes(k)) &&
                !['cắt đại tràng phải', 'cắt đại tràng trái', 'cắt đại tràng sigma', 'cắt đại tràng ngang'].some(k => method.includes(k))
            )
        );

        if (isRectalOp) {
            return 'rectal';
        }

        // 5. PHẪU THUẬT ĐẠI TRÀNG (COLON - Trục 1)
        // Cắt đại tràng phải, trái, sigma, ngang, toàn bộ, CME, D3, cắt manh tràng...
        const isColonOp = (
            [
                'cắt đại tràng', 'đại tràng phải', 'đại tràng trái', 'đại tràng sigma', 'đại tràng ngang', 
                'đại tràng góc gan', 'đại tràng góc lách', 'cắt toàn bộ đại tràng', 'cắt gần toàn bộ đại tràng', 
                'cắt nửa đại tràng', 'cme', 'd3', 'colectomy', 'hemicolectomy', 'cắt manh tràng', 'cắt đoạn đại tràng', 
                'cắt u đại tràng', 'cắt polyp đại tràng', 'manh tràng'
            ].some(k => method.includes(k)) ||
            (
                [
                    'k đại tràng', 'u đại tràng', 'k sigma', 'u sigma', 'k manh tràng', 'ung thư đại tràng', 
                    'viêm túi thừa đại tràng', 'xoắn đại tràng', 'xoắn sigma', 'polyp đại tràng'
                ].some(k => diag.includes(k)) &&
                ['cắt', 'nạo hạch', 'ptns', 'robot', 'mổ mở', 'phẫu thuật'].some(k => method.includes(k))
            )
        );

        if (isColonOp) {
            return 'colon';
        }

        // 6. CẤP CỨU & BÁN KHẨN (EMERGENCY / URGENT - Trục 6)
        // Viêm phúc mạc, viêm ruột thừa, tắc ruột, thủng ruột, thám sát sinh thiết, cấp cứu bụng...
        return 'emergency';
    },

    // Tính toán hồ sơ năng lực chi tiết của 1 bác sĩ hoặc bình quân khoa / BS
    computeSurgeonProfile(doctorId, surgeries) {
        if (!doctorId || doctorId === 'none') {
            return null;
        }

        const isDept = (doctorId === 'dept_total' || doctorId === 'dept_avg');
        let cases = [];
        let docInfo = null;

        if (isDept) {
            cases = surgeries || [];
            docInfo = { 
                id: 'dept_total', 
                name: 'Toàn Khoa', 
                role: 'Tổng khối lượng toàn khoa', 
                shortName: 'Toàn Khoa',
                color: '#0891b2',
                totalRawCases: cases.length
            };
        } else {
            const allDocs = this.getEligibleDoctors();
            docInfo = allDocs.find(d => String(d.id) === String(doctorId)) || { id: doctorId, name: 'Bác sĩ ' + doctorId, role: 'Phẫu thuật viên', color: '#0891b2' };
            const docName = (docInfo && docInfo.name) ? docInfo.name : 'Bác sĩ';
            docInfo.shortName = docName.split(' ').pop();
            cases = (surgeries || []).filter(s => s && String(s.mainSurgeon) === String(doctorId));
        }

        const axisKeys = Object.keys(this.CLINICAL_AXES);
        const axisCounts = {};
        const axisDetails = {};
        axisKeys.forEach(k => {
            axisCounts[k] = 0;
            axisDetails[k] = [];
        });

        cases.forEach(s => {
            const axis = this.classifySurgery(s);
            if (axisCounts[axis] !== undefined) {
                axisCounts[axis]++;
                axisDetails[axis].push(s);
            }
        });

        const total = cases.length;
        const totalRaw = cases.length;
        const axisPct = {};
        axisKeys.forEach(k => {
            axisPct[k] = totalRaw > 0 ? ((axisDetails[k].length / totalRaw) * 100) : 0;
        });

        // Approach stats
        const misCases = cases.filter(s => s && (s.approachType === 'noisoi' || s.approachType === 'robot')).length;
        const openCases = cases.filter(s => s && s.approachType === 'mo').length;
        const robotCases = cases.filter(s => s && s.approachType === 'robot').length;
        const misPct = totalRaw > 0 ? (misCases / totalRaw * 100) : 0;
        const openPct = totalRaw > 0 ? (openCases / totalRaw * 100) : 0;

        // Surgery type breakdown (Yêu cầu vs Chương trình vs Bán khẩn)
        const electiveReq = cases.filter(s => s && s.surgeryType === 'yeucau').length;
        const electiveRoutine = cases.filter(s => s && s.surgeryType === 'chuongtrinh').length;
        const urgent = cases.filter(s => s && s.surgeryType === 'bankhan').length;

        // Duration stats
        const withDur = cases.filter(s => s && parseInt(s.duration) > 0);
        const meanDur = withDur.length > 0 ? Math.round(withDur.reduce((sum, s) => sum + parseInt(s.duration), 0) / withDur.length) : 0;

        return {
            doctor: docInfo,
            total,
            totalRaw,
            cases: cases.sort((a, b) => new Date(b.date) - new Date(a.date)),
            axisCounts,
            axisPct,
            axisDetails,
            misCases,
            openCases,
            robotCases,
            misPct,
            openPct,
            electiveReq,
            electiveRoutine,
            urgent,
            meanDur
        };
    },

    // Compute detailed stats grouped by doctor (for summary table)
    computeDetailedStats() {
        const doctors = this.getEligibleDoctors();
        const surgeries = this.getSurgeriesInRange();
        const types = Object.keys(SURGERY_TYPES);

        return doctors.map(doc => {
            const cases = surgeries.filter(s => s.mainSurgeon === doc.id);
            const byType = {};
            types.forEach(t => {
                byType[t] = cases.filter(s => s.surgeryType === t).length;
            });

            return {
                doctor: doc,
                cases: cases.sort((a, b) => new Date(a.date) - new Date(b.date)),
                total: cases.length,
                byType
            };
        }).filter(d => d.total > 0).sort((a, b) => b.total - a.total);
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
            <button class="btn-icon" onclick="SurgeryStatsPage.prevPeriod()" title="Kỳ trước">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="sstats-nav-label">${this.getPeriodLabel()}</span>
            <button class="btn-icon" onclick="SurgeryStatsPage.nextPeriod()" title="Kỳ sau">
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
            const allSurgeries = SurgeryPage.getAllSurgeries() || [];
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

        const p1 = this.computeSurgeonProfile(this.primaryDoctorId, surgeries);
        const p2 = this.compareDoctorId !== 'none' ? this.computeSurgeonProfile(this.compareDoctorId, surgeries) : null;
        const hasCompare = !!p2;

        const name1 = (p1 && p1.doctor && p1.doctor.name) || 'Bác sĩ 1';
        const name2 = (p2 && p2.doctor && p2.doctor.name) || 'Bác sĩ 2';
        const shortName1 = name1.split(' ').pop();
        const shortName2 = name2.split(' ').pop();

        const totalDiff = hasCompare ? (p1.total - p2.total) : 0;
        const totalPctDiff = (hasCompare && p2.total > 0) ? Math.round(((totalDiff / p2.total) * 100) * 10) / 10 : 0;

        return `
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
                <!-- DOCTOR 1 SELECTOR (CYAN) -->
                <div class="sstats-doc-box sstats-doc-box-primary">
                    <div class="sstats-doc-box-badge" style="background:#0891b2">Bác sĩ 1 (Màu Xanh Cyan)</div>
                    <div class="sstats-doc-box-controls">
                        <select class="form-control sstats-doc-select" onchange="SurgeryStatsPage.setPrimaryDoctor(this.value)">
                            <option value="dept_total" ${(this.primaryDoctorId === 'dept_total' || this.primaryDoctorId === 'dept_avg') ? 'selected' : ''}>
                                📊 Toàn Khoa (Tổng số ca)
                            </option>
                            ${allDocs.map(d => `
                                <option value="${d.id}" ${String(d.id) === String(this.primaryDoctorId) ? 'selected' : ''}>
                                    ${d.name} (${d.role})
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <div class="sstats-vs-badge ${hasCompare ? '' : 'disabled'}">${hasCompare ? 'VS' : '—'}</div>

                <!-- DOCTOR 2 SELECTOR (CRIMSON / ROSE) -->
                <div class="sstats-doc-box sstats-doc-box-compare ${hasCompare ? '' : 'is-none'}">
                    <div class="sstats-doc-box-badge" style="background:${hasCompare ? '#e11d48' : 'var(--text-muted)'}">
                        ${hasCompare ? 'Bác sĩ 2 (Màu Đỏ Rose)' : 'Bác sĩ 2 (Để trống)'}
                    </div>
                    <div class="sstats-doc-box-controls">
                        <select class="form-control sstats-doc-select" onchange="SurgeryStatsPage.setCompareDoctor(this.value)">
                            <option value="none" ${this.compareDoctorId === 'none' ? 'selected' : ''}>🚫 Để trống (Không so sánh)</option>
                            <option value="dept_total" ${(this.compareDoctorId === 'dept_total' || this.compareDoctorId === 'dept_avg') ? 'selected' : ''}>📊 Toàn Khoa (Tổng số ca)</option>
                            ${allDocs.map(d => `
                                <option value="${d.id}" ${String(d.id) === String(this.compareDoctorId) ? 'selected' : ''}>
                                    ${d.name} (${d.role})
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
            </div>
        </div>

        <!-- KPI METRICS (SIDE-BY-SIDE OR SINGLE) -->
        <div class="sstats-compare-kpi-grid ${hasCompare ? '' : 'is-single'}">
            <!-- KPI 1: Tổng ca mổ -->
            <div class="card sstats-compare-kpi-card">
                <div class="sstats-kpi-header">
                    <span class="sstats-kpi-icon">🎯</span>
                    <span class="sstats-kpi-title">Tổng ca mổ chính</span>
                </div>
                ${hasCompare ? `
                <div class="sstats-kpi-values">
                    <div class="sstats-kpi-val sstats-val-primary">
                        <span class="sstats-kpi-num">${p1.total}</span>
                        <span class="sstats-kpi-sub">${shortName1}</span>
                    </div>
                    <div class="sstats-kpi-divider"></div>
                    <div class="sstats-kpi-val sstats-val-compare">
                        <span class="sstats-kpi-num">${p2.total}</span>
                        <span class="sstats-kpi-sub">${shortName2}</span>
                    </div>
                </div>
                <div class="sstats-kpi-delta ${totalDiff >= 0 ? 'positive' : 'negative'}">
                    ${totalDiff >= 0 ? `▲ +${totalDiff}` : `▼ ${totalDiff}`} ca (${totalPctDiff >= 0 ? `+${totalPctDiff.toFixed(1)}%` : `${totalPctDiff.toFixed(1)}%`})
                </div>
                ` : `
                <div class="sstats-kpi-values single-val">
                    <div class="sstats-kpi-val sstats-val-primary">
                        <span class="sstats-kpi-num">${p1.total}</span>
                        <span class="sstats-kpi-sub">${(p1.doctor.id === 'dept_total' || p1.doctor.id === 'dept_avg') ? `Toàn Khoa (${p1.total} ca)` : `${name1} (Toàn bộ)`}</span>
                    </div>
                </div>
                <div class="sstats-kpi-delta neutral">
                    ${(p1.doctor.id === 'dept_total' || p1.doctor.id === 'dept_avg') ? 'Tổng khối lượng mổ toàn khoa' : 'Khối lượng mổ chính cá nhân'}
                </div>
                `}
            </div>

            <!-- KPI 2: Tỷ lệ Nội soi (MIS) -->
            <div class="card sstats-compare-kpi-card">
                <div class="sstats-kpi-header">
                    <span class="sstats-kpi-icon">🔬</span>
                    <span class="sstats-kpi-title">Tỷ lệ Phẫu thuật Nội soi (MIS)</span>
                </div>
                ${hasCompare ? `
                <div class="sstats-kpi-values">
                    <div class="sstats-kpi-val sstats-val-primary">
                        <span class="sstats-kpi-num">${p1.misPct.toFixed(1)}%</span>
                        <span class="sstats-kpi-sub">${p1.misCases} ca</span>
                    </div>
                    <div class="sstats-kpi-divider"></div>
                    <div class="sstats-kpi-val sstats-val-compare">
                        <span class="sstats-kpi-num">${p2.misPct.toFixed(1)}%</span>
                        <span class="sstats-kpi-sub">${p2.misCases} ca</span>
                    </div>
                </div>
                <div class="sstats-kpi-delta ${p1.misPct >= p2.misPct ? 'positive' : 'negative'}">
                    ${p1.misPct >= p2.misPct ? `▲ +${(p1.misPct - p2.misPct).toFixed(1)}%` : `▼ -${(p2.misPct - p1.misPct).toFixed(1)}%`}
                </div>
                ` : `
                <div class="sstats-kpi-values single-val">
                    <div class="sstats-kpi-val sstats-val-primary">
                        <span class="sstats-kpi-num">${p1.misPct.toFixed(1)}%</span>
                        <span class="sstats-kpi-sub">${p1.misCases} ca nội soi / robot</span>
                    </div>
                </div>
                <div class="sstats-kpi-delta positive">
                    Chỉ số kỹ thuật xâm lấn tối thiểu
                </div>
                `}
            </div>

            <!-- KPI 3: Thời gian mổ trung bình -->
            <div class="card sstats-compare-kpi-card">
                <div class="sstats-kpi-header">
                    <span class="sstats-kpi-icon">⏱️</span>
                    <span class="sstats-kpi-title">Thời gian mổ trung bình</span>
                </div>
                ${hasCompare ? `
                <div class="sstats-kpi-values">
                    <div class="sstats-kpi-val sstats-val-primary">
                        <span class="sstats-kpi-num">${p1.meanDur}p</span>
                        <span class="sstats-kpi-sub">Chuẩn an toàn</span>
                    </div>
                    <div class="sstats-kpi-divider"></div>
                    <div class="sstats-kpi-val sstats-val-compare">
                        <span class="sstats-kpi-num">${p2.meanDur}p</span>
                        <span class="sstats-kpi-sub">Đối sánh</span>
                    </div>
                </div>
                <div class="sstats-kpi-delta neutral">
                    ${p1.meanDur >= p2.meanDur ? `+${p1.meanDur - p2.meanDur} phút` : `-${p2.meanDur - p1.meanDur} phút`}
                </div>
                ` : `
                <div class="sstats-kpi-values single-val">
                    <div class="sstats-kpi-val sstats-val-primary">
                        <span class="sstats-kpi-num">${p1.meanDur}p</span>
                        <span class="sstats-kpi-sub">Thời gian mổ trung bình</span>
                    </div>
                </div>
                <div class="sstats-kpi-delta neutral">
                    Chuẩn thời gian ca mổ
                </div>
                `}
            </div>

            <!-- KPI 4: Cơ cấu Mổ Yêu Cầu -->
            <div class="card sstats-compare-kpi-card">
                <div class="sstats-kpi-header">
                    <span class="sstats-kpi-icon">📋</span>
                    <span class="sstats-kpi-title">Cơ cấu Mổ Yêu Cầu / C.Trình</span>
                </div>
                ${hasCompare ? `
                <div class="sstats-kpi-values">
                    <div class="sstats-kpi-val sstats-val-primary">
                        <span class="sstats-kpi-num">${p1.total > 0 ? (p1.electiveReq / p1.total * 100).toFixed(0) : 0}%</span>
                        <span class="sstats-kpi-sub">YC: ${p1.electiveReq} ca</span>
                    </div>
                    <div class="sstats-kpi-divider"></div>
                    <div class="sstats-kpi-val sstats-val-compare">
                        <span class="sstats-kpi-num">${p2.total > 0 ? (p2.electiveReq / p2.total * 100).toFixed(0) : 0}%</span>
                        <span class="sstats-kpi-sub">YC: ${p2.electiveReq} ca</span>
                    </div>
                </div>
                <div class="sstats-kpi-delta neutral">
                    Khối lượng chuyên môn
                </div>
                ` : `
                <div class="sstats-kpi-values single-val">
                    <div class="sstats-kpi-val sstats-val-primary">
                        <span class="sstats-kpi-num">${p1.total > 0 ? (p1.electiveReq / p1.total * 100).toFixed(0) : 0}%</span>
                        <span class="sstats-kpi-sub">Mổ yêu cầu: ${p1.electiveReq} ca</span>
                    </div>
                </div>
                <div class="sstats-kpi-delta neutral">
                    Chương trình: ${p1.electiveRoutine} ca · Bán khẩn: ${p1.urgent} ca
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
                </div>

                <div class="sstats-radar-legend">
                    <div class="sstats-legend-item">
                        <span class="sstats-legend-dot" style="background:#0891b2"></span>
                        <span class="sstats-legend-text"><strong>${name1}</strong> (${p1.total} ca)</span>
                    </div>
                    ${hasCompare ? `
                    <div class="sstats-legend-item">
                        <span class="sstats-legend-dot" style="background:#e11d48"></span>
                        <span class="sstats-legend-text"><strong>${name2}</strong> (${p2.total} ca)</span>
                    </div>
                    ` : ''}
                </div>

                <!-- SVG RADAR ENGINE -->
                <div class="sstats-radar-canvas-container">
                    ${this._renderRadarSVG(p1, p2)}
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
                    <span class="sstats-matrix-hint">Khoa PTĐTT — BV Bình Dân</span>
                </div>

                <div class="sstats-matrix-table-container">
                    <table class="sstats-matrix-table">
                        <thead>
                            <tr>
                                <th>Trục Năng Lực</th>
                                ${hasCompare ? `
                                    <th style="color:#0891b2;text-align:right">${shortName1}</th>
                                    <th style="color:#e11d48;text-align:right">${shortName2}</th>
                                    <th style="text-align:center">Chênh lệch</th>
                                ` : `
                                    <th style="color:#0891b2;text-align:right">Số ca (${shortName1})</th>
                                    <th style="color:#0891b2;text-align:right">Tỷ trọng cơ cấu</th>
                                `}
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
                                return `
                                <tr class="sstats-matrix-tr-clickable ${isActiveAxis ? 'is-active-axis' : ''}" 
                                    onclick="SurgeryStatsPage.setLogbookFilterAxis('${isActiveAxis ? 'all' : k}')" 
                                    title="Nhấp để ${isActiveAxis ? 'xóa lọc nhóm này' : `lọc danh sách ca mổ nhóm ${ax.label}`}">
                                    <td>
                                        <div class="sstats-axis-name">
                                            <span class="sstats-axis-icon">${ax.icon}</span>
                                            <div>
                                                <strong>${ax.label} ${isActiveAxis ? '🔍' : ''}</strong>
                                                <div class="sstats-axis-sub">${ax.sublabel}</div>
                                            </div>
                                        </div>
                                    </td>
                                    ${hasCompare ? `
                                    <td class="sstats-matrix-num" style="color:#0891b2">
                                        <strong>${c1}</strong> ca
                                        <div class="sstats-matrix-pct">${pct1.toFixed(1)}%</div>
                                    </td>
                                    <td class="sstats-matrix-num" style="color:#e11d48">
                                        <strong>${c2}</strong> ca
                                        <div class="sstats-matrix-pct">${pct2.toFixed(1)}%</div>
                                    </td>
                                    <td class="sstats-matrix-delta">
                                        <span class="sstats-delta-badge ${delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'zero'}">
                                            ${delta > 0 ? `+${delta.toFixed(1)}%` : delta < 0 ? `${delta.toFixed(1)}%` : '0.0%'}
                                        </span>
                                    </td>
                                    ` : `
                                    <td class="sstats-matrix-num" style="color:#0891b2">
                                        <strong>${c1}</strong> ca
                                    </td>
                                    <td class="sstats-matrix-num" style="color:#0891b2">
                                        <strong>${pct1.toFixed(1)}%</strong>
                                    </td>
                                    `}
                                </tr>`;
                            }).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="sstats-matrix-total-row">
                                <td><strong>TỔNG CỘNG</strong></td>
                                ${hasCompare ? `
                                <td style="text-align:right;color:#0891b2"><strong>${p1.total} ca</strong></td>
                                <td style="text-align:right;color:#e11d48"><strong>${p2.total} ca</strong></td>
                                <td style="text-align:center">
                                    <span class="sstats-delta-badge ${totalDiff >= 0 ? 'pos' : 'neg'}" title="${totalDiff >= 0 ? `+${totalDiff}` : totalDiff} ca">
                                        ${totalPctDiff >= 0 ? `+${totalPctDiff.toFixed(1)}%` : `${totalPctDiff.toFixed(1)}%`}
                                    </span>
                                </td>
                                ` : `
                                <td style="text-align:right;color:#0891b2"><strong>${p1.total} ca</strong></td>
                                <td style="text-align:right;color:#0891b2"><strong>100%</strong></td>
                                `}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>

        <!-- BẢNG NHẬT KÝ PHẪU THUẬT CỦA BÁC SĨ ĐƯỢC CHỌN -->
        ${(() => {
            // Lọc danh sách ca phẫu thuật
            let filteredCases = p1.cases;
            const isFiltered = (this.logbookFilterAxis !== 'all') || 
                               (this.logbookFilterApproach !== 'all') || 
                               (this.logbookFilterType !== 'all') || 
                               (this.logbookSearch && this.logbookSearch.trim().length > 0);

            if (this.logbookFilterAxis !== 'all') {
                filteredCases = filteredCases.filter(s => this.classifySurgery(s) === this.logbookFilterAxis);
            }
            if (this.logbookFilterApproach !== 'all') {
                filteredCases = filteredCases.filter(s => s.approachType === this.logbookFilterApproach);
            }
            if (this.logbookFilterType !== 'all') {
                filteredCases = filteredCases.filter(s => s.surgeryType === this.logbookFilterType);
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
                        <h3 class="sstats-logbook-title">📖 Nhật Ký Phẫu Thuật Chi Tiết — ${name1} (${p1.total} ca)</h3>
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
                               placeholder="Tìm tên BN, năm sinh, chẩn đoán, PP mổ..." 
                               value="${(this.logbookSearch || '').replace(/"/g, '&quot;')}" 
                               oninput="SurgeryStatsPage.setLogbookSearch(this.value)">
                        ${this.logbookSearch ? `
                            <button class="sstats-clear-search-btn" onclick="SurgeryStatsPage.setLogbookSearch('')" title="Xóa tìm kiếm">✕</button>
                        ` : ''}
                    </div>
                    <div class="sstats-filter-controls">
                        <select class="form-control sstats-filter-select" onchange="SurgeryStatsPage.setLogbookFilterAxis(this.value)">
                            <option value="all">🎯 Tất cả nhóm Radar (6 trục)</option>
                            ${Object.entries(this.CLINICAL_AXES).map(([k, ax]) => `
                                <option value="${k}" ${this.logbookFilterAxis === k ? 'selected' : ''}>${ax.icon} ${ax.label}</option>
                            `).join('')}
                        </select>

                        <select class="form-control sstats-filter-select" onchange="SurgeryStatsPage.setLogbookFilterApproach(this.value)">
                            <option value="all">🔪 Tất cả đường mổ</option>
                            <option value="noisoi" ${this.logbookFilterApproach === 'noisoi' ? 'selected' : ''}>🔬 Nội soi</option>
                            <option value="mo" ${this.logbookFilterApproach === 'mo' ? 'selected' : ''}>🔪 Mổ mở</option>
                            <option value="robot" ${this.logbookFilterApproach === 'robot' ? 'selected' : ''}>🤖 Robot</option>
                            <option value="nsth" ${this.logbookFilterApproach === 'nsth' ? 'selected' : ''}>⚡ NSTH</option>
                        </select>

                        <select class="form-control sstats-filter-select" onchange="SurgeryStatsPage.setLogbookFilterType(this.value)">
                            <option value="all">📋 Tất cả loại PT</option>
                            <option value="chuongtrinh" ${this.logbookFilterType === 'chuongtrinh' ? 'selected' : ''}>📅 Chương trình</option>
                            <option value="yeucau" ${this.logbookFilterType === 'yeucau' ? 'selected' : ''}>⭐ Yêu cầu</option>
                            <option value="bankhan" ${this.logbookFilterType === 'bankhan' ? 'selected' : ''}>🚨 Bán khẩn</option>
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
                                    <th>Đường mổ</th>
                                    <th>Loại PT</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${displayCases.map((s, idx) => {
                                    const axis = this.classifySurgery(s);
                                    const axisInfo = this.CLINICAL_AXES[axis];
                                    const typeInfo = SURGERY_TYPES[s.surgeryType] || SURGERY_TYPES.chuongtrinh;
                                    const approachMap = { mo: 'Mổ mở', noisoi: 'Nội soi', nsth: 'NSTH', robot: 'Robot' };
                                    const dateStr = Utils.formatDate(s.date);
                                    return `
                                    <tr onclick="SurgeryPage.viewDetail(${s.id})" class="sstats-detail-tr-clickable" title="Xem chi tiết ca mổ">
                                        <td class="sstats-td-stt">${idx + 1}</td>
                                        <td>${dateStr}</td>
                                        <td><strong>${s.patientName}</strong></td>
                                        <td>${s.birthYear || '—'}</td>
                                        <td class="sstats-td-text">${s.diagnosis || '—'}</td>
                                        <td class="sstats-td-text">${s.method || '—'}</td>
                                        <td><span class="sstats-radar-tag" style="background:${axisInfo.color}18;color:${axisInfo.color};border:1px solid ${axisInfo.color}40">${axisInfo.icon} ${axisInfo.label}</span></td>
                                        <td><span class="approach-tag approach-${s.approachType}">${approachMap[s.approachType] || s.approachType}</span></td>
                                        <td><span class="surgery-type-badge" style="background:${typeInfo.color}">${typeInfo.label}</span></td>
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
    _renderRadarSVG(p1, p2) {
        const width = 460;
        const height = 420;
        const cx = width / 2;
        const cy = height / 2 + 10;
        const radius = 135;
        const axisKeys = Object.keys(this.CLINICAL_AXES);
        const numAxes = axisKeys.length;
        const hasCompare = !!p2;

        // Determine max scale (volume)
        const maxVal1 = Math.max(10, ...axisKeys.map(k => p1.axisCounts[k] || 0));
        const maxVal2 = hasCompare ? Math.max(10, ...axisKeys.map(k => p2.axisCounts[k] || 0)) : 10;
        const maxScale = Math.max(maxVal1, maxVal2, 20);

        // Calculate angle coordinates
        const angleSlice = (Math.PI * 2) / numAxes;
        const getCoord = (value, index, max) => {
            const angle = index * angleSlice - Math.PI / 2;
            const r = (value / max) * radius;
            return {
                x: cx + r * Math.cos(angle),
                y: cy + r * Math.sin(angle)
            };
        };

        // Concentric web circles / hexagons
        const levels = [0.2, 0.4, 0.6, 0.8, 1.0];
        let gridSVG = '';
        levels.forEach((lvl, lvlIdx) => {
            const pts = [];
            for (let i = 0; i < numAxes; i++) {
                const angle = i * angleSlice - Math.PI / 2;
                const r = lvl * radius;
                pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
            }
            gridSVG += `<polygon points="${pts.join(' ')}" class="sstats-radar-grid" stroke="var(--border)" stroke-dasharray="${lvlIdx === 4 ? 'none' : '2,3'}" fill="none" stroke-width="1" />`;
            // Scale label
            const labelVal = Math.round(lvl * maxScale);
            gridSVG += `<text x="${cx + 4}" y="${cy - lvl * radius + 10}" class="sstats-radar-grid-label" fill="var(--text-muted)" font-size="9">${labelVal}</text>`;
        });

        // Axis spokes & labels
        let spokesSVG = '';
        let labelsSVG = '';
        axisKeys.forEach((k, i) => {
            const ax = this.CLINICAL_AXES[k];
            const endCoord = getCoord(maxScale, i, maxScale);
            spokesSVG += `<line x1="${cx}" y1="${cy}" x2="${endCoord.x}" y2="${endCoord.y}" stroke="var(--border)" stroke-width="1.2" />`;

            // Label coordinate slightly outside radius
            const labelAngle = i * angleSlice - Math.PI / 2;
            const labelRadius = radius + 32;
            const lx = cx + labelRadius * Math.cos(labelAngle);
            const ly = cy + labelRadius * Math.sin(labelAngle);

            let anchor = 'middle';
            if (Math.abs(Math.cos(labelAngle)) > 0.3) {
                anchor = Math.cos(labelAngle) > 0 ? 'start' : 'end';
            }

            const c1 = p1.axisCounts[k] || 0;
            const pct1 = p1.axisPct[k] || 0;
            const c2 = p2 ? (p2.axisCounts[k] || 0) : 0;

            labelsSVG += `
            <g class="sstats-radar-axis-label-group">
                <text x="${lx}" y="${ly - 6}" text-anchor="${anchor}" class="sstats-radar-axis-title" fill="var(--text-primary)" font-size="11.5" font-weight="700">
                    ${ax.label}
                </text>
                <text x="${lx}" y="${ly + 8}" text-anchor="${anchor}" class="sstats-radar-axis-values" font-size="10">
                    ${hasCompare 
                        ? `<tspan fill="#0891b2" font-weight="700">${c1}</tspan> <tspan fill="var(--text-muted)">vs</tspan> <tspan fill="#e11d48" font-weight="700">${c2}</tspan>`
                        : `<tspan fill="#0891b2" font-weight="700">${c1} ca</tspan> <tspan fill="var(--text-muted)">(${pct1.toFixed(0)}%)</tspan>`}
                </text>
            </g>`;
        });

        // Polygon 1 (Doctor 1 - Cyan)
        const poly1Pts = [];
        const poly1Dots = [];
        axisKeys.forEach((k, i) => {
            const val = p1.axisCounts[k] || 0;
            const pt = getCoord(val, i, maxScale);
            poly1Pts.push(`${pt.x},${pt.y}`);
            poly1Dots.push(`<circle cx="${pt.x}" cy="${pt.y}" r="4.5" fill="#0891b2" stroke="#ffffff" stroke-width="1.5" class="sstats-radar-dot" data-axis="${k}" data-doc="1" />`);
        });

        // Polygon 2 (Doctor 2 - Crimson / Rose - Only if hasCompare)
        const poly2Pts = [];
        const poly2Dots = [];
        if (hasCompare) {
            axisKeys.forEach((k, i) => {
                const val = p2.axisCounts[k] || 0;
                const pt = getCoord(val, i, maxScale);
                poly2Pts.push(`${pt.x},${pt.y}`);
                poly2Dots.push(`<circle cx="${pt.x}" cy="${pt.y}" r="4" fill="#e11d48" stroke="#ffffff" stroke-width="1.5" class="sstats-radar-dot" data-axis="${k}" data-doc="2" />`);
            });
        }

        return `
        <svg viewBox="0 0 ${width} ${height}" class="sstats-radar-svg" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="p1Grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0891b2" stop-opacity="0.35" />
                    <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.15" />
                </linearGradient>
                ${hasCompare ? `
                <linearGradient id="p2Grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#e11d48" stop-opacity="0.30" />
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

            <!-- Doctor 2 Polygon (Crimson / Rose - Underneath) -->
            ${hasCompare ? `
            <polygon points="${poly2Pts.join(' ')}" fill="url(#p2Grad)" stroke="#e11d48" stroke-width="2.2" stroke-dasharray="4,3" class="sstats-polygon-p2" filter="url(#radarGlow)" />
            ${poly2Dots.join('')}
            ` : ''}

            <!-- Doctor 1 Polygon (Cyan - On Top) -->
            <polygon points="${poly1Pts.join(' ')}" fill="url(#p1Grad)" stroke="#0891b2" stroke-width="2.5" class="sstats-polygon-p1" filter="url(#radarGlow)" />
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

        // Grand totals by type
        const grandByType = {};
        types.forEach(t => {
            grandByType[t] = surgeries.filter(s => s.surgeryType === t).length;
        });

        // Grand totals by approach
        const APPROACH_TYPES = {
            mo: { label: 'Mổ mở', color: '#e11d48' },
            noisoi: { label: 'Nội soi', color: '#16a34a' },
            nsth: { label: 'NSTH', color: '#8b5cf6' },
        };
        const grandByApproach = {};
        Object.keys(APPROACH_TYPES).forEach(a => {
            grandByApproach[a] = surgeries.filter(s => s.approachType === a).length;
        });

        return `
        <div class="sstats-summary-cards">
            <div class="sstats-summary-card sstats-total">
                <div class="sstats-summary-value">${totalAll}</div>
                <div class="sstats-summary-label">Tổng ca PT</div>
            </div>
            ${types.map(t => {
                const info = SURGERY_TYPES[t];
                return `<div class="sstats-summary-card">
                    <div class="sstats-summary-value" style="color:${info.color}">${grandByType[t]}</div>
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
                    <h3>🩺 Bảng tổng hợp theo BS mổ chính</h3>
                    <span class="sstats-main-table-hint">Nhấn vào tên BS để xem chi tiết</span>
                </div>
                <table class="sstats-table">
                    <thead>
                        <tr>
                            <th class="sstats-th-stt">STT</th>
                            <th class="sstats-th-name">BS mổ chính</th>
                            ${types.map(t => `<th class="sstats-th-num">${SURGERY_TYPES[t].label}</th>`).join('')}
                            <th class="sstats-th-num sstats-th-total">Tổng</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allStats.map((docStat, idx) => {
                            const isExpanded = this.expandedDoctor == docStat.doctor.id;
                            return `
                        <tr class="sstats-summary-row ${isExpanded ? 'sstats-row-active' : ''}" 
                            onclick="SurgeryStatsPage.toggleDoctor(${docStat.doctor.id})">
                            <td class="sstats-td-stt">${idx + 1}</td>
                            <td>
                                <div class="sstats-td-name">
                                    <div class="sstats-doc-avatar" style="background:${docStat.doctor.color}">${docStat.doctor.name.split(' ').pop().charAt(0)}</div>
                                    <div>
                                        <div class="sstats-doc-name">${docStat.doctor.name}</div>
                                        <div class="sstats-doc-role">${docStat.doctor.role}</div>
                                    </div>
                                    <svg class="sstats-expand-icon ${isExpanded ? 'expanded' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                                </div>
                            </td>
                            ${types.map(t => `<td class="sstats-td-num ${docStat.byType[t] === 0 ? 'zero' : ''}">${docStat.byType[t]}</td>`).join('')}
                            <td class="sstats-td-num sstats-td-total">${docStat.total}</td>
                        </tr>
                        ${isExpanded ? `
                        <tr class="sstats-detail-row">
                            <td colspan="${types.length + 3}" style="padding:0">
                                ${this._renderDoctorDetail(docStat)}
                            </td>
                        </tr>` : ''}`;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="sstats-footer-row">
                            <td colspan="2" class="sstats-td-footer-label">TỔNG CỘNG</td>
                            ${types.map(t => `<td class="sstats-td-num sstats-td-num-bold">${grandByType[t]}</td>`).join('')}
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
        return `
        <div class="sstats-detail-panel">
            <div class="sstats-detail-header">
                <div class="sstats-detail-title">
                    <strong>${docStat.doctor.name}</strong> — ${docStat.total} ca phẫu thuật
                </div>
                <div class="sstats-detail-chips">
                    ${Object.keys(SURGERY_TYPES).map(t => docStat.byType[t] > 0 ? `<span class="sstats-type-chip" style="background:${SURGERY_TYPES[t].color}20;color:${SURGERY_TYPES[t].color}">${SURGERY_TYPES[t].label}: ${docStat.byType[t]}</span>` : '').join('')}
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
                        const typeInfo = SURGERY_TYPES[s.surgeryType] || SURGERY_TYPES.chuongtrinh;
                        const dateStr = Utils.formatDate(s.date);
                        return `
                    <tr onclick="SurgeryPage.viewDetail(${s.id})" class="sstats-detail-tr-clickable" title="Xem chi tiết">
                        <td class="sstats-detail-td-stt">${idx + 1}</td>
                        <td><strong>${s.patientName}</strong></td>
                        <td>${s.birthYear || '—'}</td>
                        <td class="sstats-detail-td-text">${s.diagnosis || '—'}</td>
                        <td class="sstats-detail-td-text">${s.method || '—'}</td>
                        <td>${dateStr}</td>
                        <td><span class="surgery-type-badge" style="background:${typeInfo.color}">${typeInfo.label}</span></td>
                    </tr>`;
                    }).join('')}
                </tbody>
            </table>
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
        this.expandedDoctor = this.expandedDoctor == id ? null : id;
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
            const approaches = ['mo', 'noisoi', 'nsth'];
            const approachLabels = { mo: 'Mổ mở', noisoi: 'Nội soi', nsth: 'NSTH' };
            const periodLabel = this.getPeriodLabel();
            const wb = XLSX.utils.book_new();

            // Sheet 1: Summary by doctor
            const summaryHeaders = ['STT', 'BS mổ chính', 'Chức vụ', ...types.map(t => SURGERY_TYPES[t].label), ...approaches.map(a => approachLabels[a]), 'Tổng'];
            const summaryData = [summaryHeaders];
            allStats.forEach((d, i) => {
                const approachCounts = approaches.map(a => d.cases.filter(s => s.approachType === a).length);
                summaryData.push([i+1, d.doctor.name, d.doctor.role, ...types.map(t => d.byType[t]), ...approachCounts, d.total]);
            });
            const grandByType = {};
            types.forEach(t => { grandByType[t] = surgeries.filter(s => s.surgeryType === t).length; });
            const grandByApproach = approaches.map(a => surgeries.filter(s => s.approachType === a).length);
            summaryData.push(['', 'TỔNG CỘNG', '', ...types.map(t => grandByType[t]), ...grandByApproach, surgeries.length]);

            const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
            ws1['!cols'] = [{wch:5},{wch:25},{wch:20},...types.map(()=>({wch:12})),...approaches.map(()=>({wch:10})),{wch:8}];
            XLSX.utils.book_append_sheet(wb, ws1, 'Tong hop');

            // Sheet 2: Detail all surgeries
            const detailHeaders = ['STT', 'Ngày mổ', 'Họ tên BN', 'Năm sinh', 'Chẩn đoán', 'PP phẫu thuật', 'Nhóm Radar', 'Loại PT', 'Đường mổ', 'BS mổ chính'];
            const detailData = [detailHeaders];
            const allDocs = this.getEligibleDoctors();
            const approachMap = { mo: 'Mổ mở', noisoi: 'Nội soi', nsth: 'NSTH', robot: 'Robot' };
            surgeries.sort((a,b) => a.date.localeCompare(b.date)).forEach((s, i) => {
                const doc = allDocs.find(d => d.id === s.mainSurgeon);
                const axisKey = this.classifySurgery(s);
                const axisInfo = this.CLINICAL_AXES[axisKey] || { label: axisKey };
                const typeInfo = SURGERY_TYPES[s.surgeryType] || { label: s.surgeryType };
                const dateStr = Utils.formatDate(s.date);
                detailData.push([i+1, dateStr, s.patientName, s.birthYear||'', s.diagnosis||'', s.method||'', axisInfo.label, typeInfo.label, approachMap[s.approachType]||'', doc ? doc.name : '']);
            });
            const ws2 = XLSX.utils.aoa_to_sheet(detailData);
            ws2['!cols'] = [{wch:5},{wch:12},{wch:22},{wch:10},{wch:30},{wch:35},{wch:20},{wch:14},{wch:16},{wch:22}];
            XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiet');

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
            const p1 = this.computeSurgeonProfile(this.primaryDoctorId, surgeries);
            const p2 = this.compareDoctorId !== 'none' ? this.computeSurgeonProfile(this.compareDoctorId, surgeries) : null;
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

            // Generate clean SVG string for radar
            const radarSVGString = this._renderRadarSVG(p1, p2);

            // Table rows for Matrix
            const axisKeys = Object.keys(this.CLINICAL_AXES);
            const tableRowsHTML = axisKeys.map(k => {
                const ax = this.CLINICAL_AXES[k];
                const c1 = p1.axisCounts[k] || 0;
                const pct1 = p1.axisPct[k] || 0;
                const c2 = p2 ? (p2.axisCounts[k] || 0) : 0;
                const pct2 = p2 ? (p2.axisPct[k] || 0) : 0;
                const delta = Math.round((pct1 - pct2) * 10) / 10;

                return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 11px 12px; vertical-align: middle;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 16px;">${ax.icon}</span>
                            <div>
                                <div style="font-weight: 700; font-size: 13px; color: #1e293b;">${ax.label}</div>
                                <div style="font-size: 11px; color: #64748b; margin-top: 1px;">${ax.sublabel}</div>
                            </div>
                        </div>
                    </td>
                    ${hasCompare ? `
                    <td style="padding: 11px 12px; text-align: right; vertical-align: middle; color: #0891b2; font-weight: 700; font-size: 13px;">
                        ${c1} <span style="font-size: 11px; font-weight: 500; color: #64748b;">ca</span>
                        <div style="font-size: 11px; font-weight: 600; color: #0891b2;">${pct1.toFixed(1)}%</div>
                    </td>
                    <td style="padding: 11px 12px; text-align: right; vertical-align: middle; color: #e11d48; font-weight: 700; font-size: 13px;">
                        ${c2} <span style="font-size: 11px; font-weight: 500; color: #64748b;">ca</span>
                        <div style="font-size: 11px; font-weight: 600; color: #e11d48;">${pct2.toFixed(1)}%</div>
                    </td>
                    <td style="padding: 11px 12px; text-align: center; vertical-align: middle;">
                        <span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; background: ${delta > 0 ? '#ecfdf5' : delta < 0 ? '#fff1f2' : '#f1f5f9'}; color: ${delta > 0 ? '#059669' : delta < 0 ? '#e11d48' : '#64748b'};">
                            ${delta > 0 ? `+${delta.toFixed(1)}%` : delta < 0 ? `${delta.toFixed(1)}%` : '0.0%'}
                        </span>
                    </td>
                    ` : `
                    <td style="padding: 11px 12px; text-align: right; vertical-align: middle; color: #0891b2; font-weight: 800; font-size: 14px;">
                        ${c1} <span style="font-size: 11px; font-weight: 500; color: #64748b;">ca</span>
                    </td>
                    <td style="padding: 11px 12px; text-align: right; vertical-align: middle; color: #0891b2; font-weight: 800; font-size: 14px;">
                        ${pct1.toFixed(1)}%
                    </td>
                    `}
                </tr>`;
            }).join('');

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
        :root {
            --text-primary: #0f172a;
            --text-secondary: #334155;
            --text-muted: #64748b;
            --border: #e2e8f0;
            --bg-secondary: #f8fafc;
            --primary: #0891b2;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Be Vietnam Pro', 'Noto Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f8fafc;
            color: #0f172a;
            padding: 30px;
            width: 1120px;
            -webkit-font-smoothing: antialiased;
        }
        .capture-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 26px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.04);
        }
        .export-header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0891b2;
            padding-bottom: 12px;
            margin-bottom: 18px;
        }
        .hospital-brand {
            font-size: 12px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .dept-brand {
            font-size: 15px;
            font-weight: 800;
            color: #0891b2;
            text-transform: uppercase;
            margin-top: 2px;
        }
        .national-title {
            text-align: right;
            font-size: 12px;
            font-weight: 700;
            color: #1e293b;
            text-transform: uppercase;
        }
        .national-motto {
            text-align: right;
            font-size: 11px;
            font-weight: 500;
            color: #64748b;
            font-style: italic;
            margin-top: 2px;
        }
        .main-title-block {
            text-align: center;
            margin-bottom: 20px;
        }
        .main-title {
            font-size: 19px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .main-subtitle {
            font-size: 12.5px;
            color: #475569;
            margin-top: 4px;
            font-weight: 500;
        }
        .main-subtitle strong {
            color: #0891b2;
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
            color: #0891b2;
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
            color: #0891b2;
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
            color: #0891b2;
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
            padding: 7px 10px;
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
            border-top: 2px solid #0891b2;
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
            color: #94a3b8;
        }
    </style>
</head>
<body>
    <div id="capture" class="capture-card">
        <!-- HEADER BỆNH VIỆN NĐ 30 -->
        <div class="export-header-row">
            <div>
                <div class="hospital-brand">BỆNH VIỆN BÌNH DÂN</div>
                <div class="dept-brand">KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG</div>
            </div>
            <div>
                <div class="national-title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div class="national-motto">Độc lập - Tự do - Hạnh phúc</div>
            </div>
        </div>

        <!-- MAIN TITLE -->
        <div class="main-title-block">
            <h1 class="main-title">HỒ SƠ NĂNG LỰC & CƠ CẤU PHẪU THUẬT 6 TRỤC</h1>
            <p class="main-subtitle">
                Phẫu thuật viên: <strong>${name1}</strong> (${p1.doctor.role}) · Kỳ thống kê: <strong>${periodLabel}</strong> (Tổng: <strong>${p1.total} ca</strong>)${hasCompare ? ` · Đối chuẩn: <strong>${name2}</strong> (${p2.total} ca)` : ''}
            </p>
        </div>

        <!-- 4 KPI CARDS -->
        <div class="kpi-grid">
            <!-- KPI 1 -->
            <div class="kpi-card">
                <div class="kpi-card-header">🎯 Tổng ca mổ chính</div>
                <div class="kpi-val">${p1.total}</div>
                <div class="kpi-sub">${hasCompare ? `${shortName1}: ${p1.total} vs ${shortName2}: ${p2.total}` : ((p1.doctor.id === 'dept_total' || p1.doctor.id === 'dept_avg') ? `Toàn Khoa (${p1.total} ca)` : `${name1} (Toàn bộ)`)}</div>
                <div class="kpi-tag">${(p1.doctor.id === 'dept_total' || p1.doctor.id === 'dept_avg') ? 'Tổng khối lượng mổ toàn khoa' : 'Khối lượng mổ chính cá nhân'}</div>
            </div>

            <!-- KPI 2 -->
            <div class="kpi-card">
                <div class="kpi-card-header">🔬 Tỷ lệ Nội soi (MIS)</div>
                <div class="kpi-val">${p1.misPct.toFixed(1)}%</div>
                <div class="kpi-sub">${p1.misCases} ca nội soi / robot</div>
                <div class="kpi-tag">Chỉ số kỹ thuật xâm lấn tối thiểu</div>
            </div>

            <!-- KPI 3 -->
            <div class="kpi-card">
                <div class="kpi-card-header">⏱️ Thời gian mổ TB</div>
                <div class="kpi-val">${p1.meanDur}p</div>
                <div class="kpi-sub">Thời gian mổ trung bình</div>
                <div class="kpi-tag">Chuẩn thời gian ca mổ</div>
            </div>

            <!-- KPI 4 -->
            <div class="kpi-card">
                <div class="kpi-card-header">📋 Cơ cấu Yêu cầu</div>
                <div class="kpi-val">${p1.total > 0 ? (p1.electiveReq / p1.total * 100).toFixed(0) : 0}%</div>
                <div class="kpi-sub">Mổ yêu cầu: ${p1.electiveReq} ca</div>
                <div class="kpi-tag">C.Trình: ${p1.electiveRoutine} · Bán khẩn: ${p1.urgent}</div>
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
                        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#0891b2;"></span>
                        <span>${name1} (${p1.total} ca)</span>
                        ${hasCompare ? ` · <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#e11d48;margin-left:4px;"></span> ${name2} (${p2.total} ca)` : ''}
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
                                <th style="text-align:right;color:#0891b2;">${shortName1}</th>
                                <th style="text-align:right;color:#e11d48;">${shortName2}</th>
                                <th style="text-align:center;">Chênh lệch</th>
                            ` : `
                                <th style="text-align:right;color:#0891b2;">Số ca (${shortName1})</th>
                                <th style="text-align:right;color:#0891b2;">Tỷ trọng cơ cấu</th>
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
                                <td style="text-align:right;color:#0891b2;">${p1.total} ca</td>
                                <td style="text-align:right;color:#e11d48;">${p2.total} ca</td>
                                <td style="text-align:center;">
                                    <span style="display:inline-block;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:700;background:${totalDiff >= 0 ? '#ecfdf5' : '#fff1f2'};color:${totalDiff >= 0 ? '#059669' : '#e11d48'};">
                                        ${totalPctDiff >= 0 ? `+${totalPctDiff.toFixed(1)}%` : `${totalPctDiff.toFixed(1)}%`}
                                    </span>
                                </td>
                            ` : `
                                <td style="text-align:right;color:#0891b2;">${p1.total} ca</td>
                                <td style="text-align:right;color:#0891b2;">100%</td>
                            `}
                        </tr>
                    </tfoot>
                </table>

                <div style="font-size: 10.5px; color: #64748b; margin-top: 12px; text-align: right;">
                    Phân loại chuẩn 6 trục lâm sàng (Cleveland Clinic DDSI / ASCRS)
                </div>
            </div>
        </div>

        <!-- FOOTER -->
        <div class="export-footer">
            <span>Hệ thống Quản trị Lâm sàng Khoa Phẫu Thuật Đại Trực Tràng — Bệnh viện Bình Dân</span>
            <span>Xuất bởi: <strong>${user}</strong> · Lúc ${timeStr} — ${dateStr}</span>
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

            // Watermark
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
            const ctx = canvas.getContext('2d');
            const now = new Date();
            const pad = n => String(n).padStart(2, '0');
            const stamp = `KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG — BV BÌNH DÂN · ${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
            
            ctx.save();
            ctx.font = 'bold 18px "Be Vietnam Pro", sans-serif';
            ctx.fillStyle = 'rgba(8, 145, 178, 0.25)';
            ctx.textAlign = 'right';
            ctx.fillText(stamp, canvas.width - 24, canvas.height - 18);
            ctx.restore();
        } catch (e) {
            console.warn('Watermark error:', e);
        }
    }
};
