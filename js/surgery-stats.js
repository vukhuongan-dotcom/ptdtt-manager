// ===== SURGERY STATISTICS & SURGEON DASHBOARD PAGE =====
const SurgeryStatsPage = {
    period: 'all', // week | month | quarter | year | all (default all for comprehensive profile)
    offset: 0, // 0 = current, -1 = previous, 1 = next, etc.
    activeTab: 'radar', // 'radar' (Dashboard BS & Radar) | 'summary' (Tổng hợp toàn khoa)
    expandedDoctor: null, // id of the doctor whose detail is shown in summary table
    primaryDoctorId: 2, // Default: BS. Vũ Khương An
    compareDoctorId: 1, // Default: TS.BSCKII Nguyễn Phú Hữu (or 'dept_avg' or 'none')
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

    // ===== THUẬT TOÁN PHÂN LOẠI 6 TRỤC NĂNG LỰC LÂM SÀNG =====
    // Quy tắc ưu tiên nghiêm ngặt (Strict Priority Hierarchy) đảm bảo 1 ca mổ chỉ thuộc duy nhất 1 trục
    classifySurgery(s) {
        const method = (s.method || '').toLowerCase();
        const diag = (s.diagnosis || '').toLowerCase();
        const text = `${method} ${diag}`;

        // 1. Ưu tiên 1: Phẫu thuật Trực tràng & TME (Trục 2)
        if (text.includes('cắt trước thấp') || text.includes('lar') || text.includes('tme') || 
            text.includes('miles') || text.includes('apr') || text.includes('icg') || 
            text.includes('tatme') || text.includes('cắt trước') || text.includes('bảo tồn cơ thắt') ||
            ((diag.includes('k trực tràng') || diag.includes('u trực tràng') || diag.includes('k ống hậu môn')) && 
             (method.includes('cắt') || method.includes('nạo hạch') || method.includes('ptns') || method.includes('mổ mở')))) {
            return 'rectal';
        }

        // 2. Ưu tiên 2: Phẫu thuật Đại tràng (Trục 1)
        if (text.includes('đại tràng phải') || text.includes('đại tràng trái') || 
            text.includes('đại tràng sigma') || text.includes('cắt đại tràng') || 
            text.includes('đại tràng ngang') || text.includes('colectomy') || 
            text.includes('cme') || text.includes('nạo vét hạch d3') || text.includes('k đại tràng') ||
            text.includes('u đại tràng') || text.includes('k sigma') || text.includes('u sigma') ||
            text.includes('manh tràng') || text.includes('cắt nửa đại tràng') || text.includes('cắt toàn bộ đại tràng')) {
            return 'colon';
        }

        // 3. Ưu tiên 3: Đóng / Mở HMNT & Lưu thông ruột (Trục 4)
        if (text.includes('đóng hồi tràng') || text.includes('hartmann reversal') || 
            text.includes('hartmann') || text.includes('đóng hậu môn') || 
            text.includes('đóng hmnt') || text.includes('đóng đại tràng') || 
            text.includes('tái lập lưu thông') || text.includes('mở hồi tràng') || 
            text.includes('mở đại tràng') || text.includes('mở hmnt') || text.includes('đóng mổ')) {
            return 'stoma';
        }

        // 4. Ưu tiên 4: Bệnh lý Hậu môn - Trực tràng lành tính (Trục 3)
        if (text.includes('trĩ') || text.includes('dao siêu âm') || text.includes('longo') || 
            text.includes('rò hậu môn') || text.includes('fistula') || text.includes('lift') || 
            text.includes('mô xơ') || text.includes('nứt kẽ') || text.includes('áp xe') || 
            text.includes('milligan') || text.includes('ferguson') || text.includes('polyp hậu môn') ||
            text.includes('hậu môn')) {
            return 'proctology';
        }

        // 5. Ưu tiên 5: Gan mật & Tiêu hóa phối hợp (Trục 5)
        if (text.includes('túi mật') || text.includes('cholecystectomy') || text.includes('ruột non') || 
            text.includes('nối tắt') || text.includes('thoát vị') || text.includes('dạ dày') || 
            text.includes('lách') || text.includes('u mạc treo')) {
            return 'biliary_gi';
        }

        // 6. Ưu tiên 6 / Fallback: Cấp cứu & Bán khẩn (Trục 6)
        return 'emergency';
    },

    // Tính toán hồ sơ năng lực chi tiết của 1 bác sĩ hoặc bình quân khoa / BS
    computeSurgeonProfile(doctorId, surgeries) {
        if (!doctorId || doctorId === 'none') {
            return null;
        }

        const isAvg = doctorId === 'dept_avg';
        let cases = [];
        let docInfo = null;
        let numSurgeons = 1;

        if (isAvg) {
            cases = surgeries || [];
            // Tính số lượng PTV mổ chính hoạt động trong kỳ lọc
            const allDocs = this.getEligibleDoctors();
            const activeSurgeonIds = new Set(cases.map(s => String(s.mainSurgeon)).filter(Boolean));
            numSurgeons = Math.max(1, activeSurgeonIds.size || allDocs.length || 1);
            docInfo = { 
                id: 'dept_avg', 
                name: `TB Khoa / BS (${numSurgeons} PTV)`, 
                role: 'Bình quân phẫu thuật viên', 
                color: '#e11d48' 
            };
        } else {
            const allDocs = this.getEligibleDoctors();
            docInfo = allDocs.find(d => String(d.id) === String(doctorId)) || { id: doctorId, name: 'Bác sĩ ' + doctorId, role: 'Phẫu thuật viên', color: '#0891b2' };
            cases = (surgeries || []).filter(s => s && String(s.mainSurgeon) === String(doctorId));
        }

        const docName = (docInfo && docInfo.name) ? docInfo.name : 'Bác sĩ';
        docInfo.shortName = docName.split(' ').pop();

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

        const totalRaw = cases.length;
        // Nếu so sánh với toàn khoa: quy đổi số ca về mức trung bình trên 1 PTV để biểu đồ không bị lệch tỷ lệ
        if (isAvg) {
            axisKeys.forEach(k => {
                axisCounts[k] = Math.round((axisCounts[k] / numSurgeons) * 10) / 10;
            });
        }

        const total = isAvg ? Math.round(totalRaw / numSurgeons) : totalRaw;
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
        const electiveReqRaw = cases.filter(s => s && s.surgeryType === 'yeucau').length;
        const electiveRoutineRaw = cases.filter(s => s && s.surgeryType === 'chuongtrinh').length;
        const urgentRaw = cases.filter(s => s && s.surgeryType === 'bankhan').length;
        const electiveReq = isAvg ? Math.round(electiveReqRaw / numSurgeons) : electiveReqRaw;
        const electiveRoutine = isAvg ? Math.round(electiveRoutineRaw / numSurgeons) : electiveRoutineRaw;
        const urgent = isAvg ? Math.round(urgentRaw / numSurgeons) : urgentRaw;

        // Duration stats
        const withDur = cases.filter(s => s && parseInt(s.duration) > 0);
        const meanDur = withDur.length > 0 ? Math.round(withDur.reduce((sum, s) => sum + parseInt(s.duration), 0) / withDur.length) : 0;

        return {
            doctor: docInfo,
            total,
            totalRaw,
            numSurgeons,
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
                ${(() => { const s = Auth.getSession(); return (s && s.isAdmin); })() ? `
                <button class="export-btn" onclick="SurgeryStatsPage.exportExcel()" title="Xuất file Excel">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    Xuất Excel
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

        // RBAC: If not admin, default to self as primary
        if (!isAdmin && this.primaryDoctorId !== currentUserId) {
            const matchSelf = allDocs.find(d => d.id === currentUserId);
            if (matchSelf) this.primaryDoctorId = currentUserId;
        }

        const p1 = this.computeSurgeonProfile(this.primaryDoctorId, surgeries);
        const p2 = this.compareDoctorId !== 'none' ? this.computeSurgeonProfile(this.compareDoctorId, surgeries) : null;
        const hasCompare = !!p2;

        const name1 = (p1 && p1.doctor && p1.doctor.name) || 'BS Chính';
        const name2 = (p2 && p2.doctor && p2.doctor.name) || 'BS So Sánh';
        const shortName1 = name1.split(' ').pop();
        const shortName2 = name2.split(' ').pop();

        return `
        <!-- DOCTOR SELECTOR ROW -->
        <div class="card sstats-doctor-selector-card">
            <div class="sstats-selector-header">
                <div>
                    <h3 class="sstats-selector-title">👥 Thiết Lập Hồ Sơ & Đối Chuẩn Phẫu Thuật Viên</h3>
                    <p class="sstats-selector-subtitle">Phân loại 6 trục năng lực — Khoa PTĐTT, BV Bình Dân (2026) <i>(Tham khảo Cleveland Clinic DDSI / ASCRS)</i></p>
                </div>
            </div>
            
            <div class="sstats-selector-row">
                <!-- DOCTOR 1 SELECTOR (CYAN) -->
                <div class="sstats-doc-box sstats-doc-box-primary">
                    <div class="sstats-doc-box-badge" style="background:#0891b2">BS Chính (Màu Xanh Cyan)</div>
                    <div class="sstats-doc-box-controls">
                        <select class="form-control sstats-doc-select" onchange="SurgeryStatsPage.setPrimaryDoctor(this.value)">
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
                        ${hasCompare ? 'Đối tượng So Sánh (Màu Đỏ Rose)' : 'Chế Độ Xem Đơn Lẻ'}
                    </div>
                    <div class="sstats-doc-box-controls">
                        <select class="form-control sstats-doc-select" onchange="SurgeryStatsPage.setCompareDoctor(this.value)">
                            <option value="none" ${this.compareDoctorId === 'none' ? 'selected' : ''}>🚫 Không so sánh (Chỉ xem 1 Bác sĩ)</option>
                            <option value="dept_avg" ${this.compareDoctorId === 'dept_avg' ? 'selected' : ''}>📊 Trung Bình Toàn Khoa / BS (Dept Avg)</option>
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
                <div class="sstats-kpi-delta ${p1.total >= p2.total ? 'positive' : 'negative'}">
                    ${p1.total >= p2.total ? `▲ +${p1.total - p2.total}` : `▼ -${p2.total - p1.total}`} ca chênh lệch
                </div>
                ` : `
                <div class="sstats-kpi-values single-val">
                    <div class="sstats-kpi-val sstats-val-primary">
                        <span class="sstats-kpi-num">${p1.total}</span>
                        <span class="sstats-kpi-sub">${name1} (Toàn bộ)</span>
                    </div>
                </div>
                <div class="sstats-kpi-delta neutral">
                    Khối lượng mổ chính
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
                        <span class="sstats-legend-text"><strong>${name2}</strong> (${p2.total} ca${p2.totalRaw && p2.totalRaw !== p2.total ? ` - TB/${p2.numSurgeons} BS` : ''})</span>
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
                                const delta = Math.round((c1 - c2) * 10) / 10;
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
                                            ${delta > 0 ? `+${delta}` : delta}
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
                                    <span class="sstats-delta-badge ${p1.total >= p2.total ? 'pos' : 'neg'}">
                                        ${p1.total - p2.total >= 0 ? `+${p1.total - p2.total}` : p1.total - p2.total}
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
                        <p class="sstats-logbook-subtitle">Danh sách ca phẫu thuật của BS mổ chính trong khoảng thời gian đã chọn</p>
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
    }
};
