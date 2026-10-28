// ===== DEPARTMENTAL ONLINE SURGERY APPROVAL MODULE (STEP 1 INTERNAL — ZERO HIS COUPLING) =====
// Implements Plan 1 (Workflow & Tab Duyệt Mổ Online) + Plan 2 (Checklist CK-01..08 & Clinical Chips C-01..07 + B1..B4)

const SAP_ATTENDING_IDS = new Set([1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const SAP_BCN_IDS = new Set([1, 2]);
const SAP_CHIEF_ID = 1;
const SAP_DEPUTY_ID = 2;
const SAP_TRAINEE_IDS = new Set([16, 43, 44, 45, 46, 47, 48, 50]);

const SAP_WARD_ROOMS = ['705', '706', '707', '708', '709', '710', '711', '712', '712A', '718', '719', 'unassigned'];

const SAP_PATHOLOGY_GROUPS = [
    { value: 'benign_anorectal', label: 'Lành tính hậu môn – trực tràng' },
    { value: 'benign_colorectal_abdominal', label: 'Lành tính đại trực tràng – ổ bụng / HMNT' },
    { value: 'cancer_confirmed', label: 'Ung thư đã xác định GPB' },
    { value: 'neoplasm_suspected_or_special', label: 'U tân sinh đặc thù / nghi ác chưa GPB' },
    { value: 'other_confirmed', label: 'Nhóm bệnh lý khác (ghi rõ)' }
];

const SAP_URGENCY_OPTIONS = [
    { value: 'elective', label: 'Chương trình thường quy' },
    { value: 'elective_service', label: 'Mổ yêu cầu / Dịch vụ' },
    { value: 'semi_urgent', label: 'Bán khẩn (mổ sớm có chuẩn bị)' },
    { value: 'emergency_exception', label: '⚡ Cấp cứu ngoại lệ' }
];

const SAP_COMORBIDITIES = [
    { value: 'none', label: 'Không bệnh nền', exclusive: true },
    { value: 'hypertension', label: 'Tăng huyết áp' },
    { value: 'diabetes', label: 'Đái tháo đường' },
    { value: 'cad_stent', label: 'Bệnh mạch vành / Stent' },
    { value: 'afib_hf', label: 'Rung nhĩ / Suy tim' },
    { value: 'copd_asthma', label: 'COPD / Hen' },
    { value: 'ckd', label: 'Bệnh thận mạn' },
    { value: 'cirrhosis', label: 'Xơ gan' },
    { value: 'anemia_malnutrition', label: 'Thiếu máu / Suy kiệt' },
    { value: 'other', label: 'Bệnh nền khác' }
];

const SAP_ANTITHROMBOTIC_MODES = [
    { value: 'none_confirmed', label: 'Không dùng thuốc chống huyết khối' },
    { value: 'continued_per_plan', label: 'Tiếp tục duy trì theo hội chẩn' },
    { value: 'held_per_plan', label: 'Đã ngưng đủ ngày theo kế hoạch' },
    { value: 'bridging_per_plan', label: 'Bắc cầu Heparin / LMWH' },
    { value: 'unheld_urgent_risk', label: 'Chưa ngưng đủ ngày (chỉ bán khẩn/cấp cứu)' }
];

const SAP_BLOOD_DEVICES = [
    { value: 'basic_instruments_only', label: 'Chỉ dụng cụ cơ bản', exclusive: true },
    { value: 'prbc_reserved', label: 'Dự trù Hồng cầu lắng' },
    { value: 'ffp_platelets_reserved', label: 'Dự trù Huyết tương / Tiểu cầu' },
    { value: 'circular_linear_stapler', label: 'Stapler vòng / thẳng' },
    { value: 'longo_stapler', label: 'Máy bấm Longo' },
    { value: 'laser_rfa', label: 'Laser / RFA' },
    { value: 'energy_device', label: 'Dao siêu âm / LigaSure' },
    { value: 'mesh', label: 'Lưới nhân tạo (Mesh)' },
    { value: 'icg', label: 'Huỳnh quang ICG' },
    { value: 'robot_instruments', label: 'Dụng cụ Robot' },
    { value: 'other_device', label: 'Vật tư đặc thù khác' }
];

const SAP_STOMA_PLANS = [
    { value: 'no_stoma', label: 'Không mở HMNT' },
    { value: 'protective_temp_stoma_risk', label: 'Dự kiến / Nguy cơ mở HMNT bảo vệ tạm thời' },
    { value: 'planned_permanent_stoma', label: 'Mở HMNT vĩnh viễn theo kế hoạch' },
    { value: 'stoma_closure', label: 'Đóng hậu môn nhân tạo' },
    { value: 'other_stoma_plan', label: 'Phương án HMNT khác' }
];

const SAP_CK_ITEMS = [
    {
        code: 'CK-01',
        title: 'Xét nghiệm tiền phẫu & Đông máu theo chỉ định',
        desc: 'Đã rà soát huyết học, sinh hóa, đông máu được chỉ định; kết quả đạt ngưỡng mổ hoặc đã có kế hoạch điều chỉnh.',
        attendingOnly: false,
        allowNotApplicable: false,
        allowNotIndicatedWithReason: true,
        naState: 'not_indicated'
    },
    {
        code: 'CK-02',
        title: 'Đánh giá Tiền mê & Cận lâm sàng Tim phổi theo chỉ định',
        desc: 'Khám tiền mê (hoặc đủ CLS sẵn sàng chuyển khám tiền mê), ECG, X-quang ngực, Siêu âm tim theo chỉ định (không nhập ASA).',
        attendingOnly: false,
        hasSubChecks: true,
        allowNotApplicable: false
    },
    {
        code: 'CK-03',
        title: 'Bệnh lý nền & Kế hoạch quản lý thuốc chống huyết khối quanh mổ',
        desc: 'Bệnh nền nội khoa ổn định và thuốc chống huyết khối được quản lý đúng kế hoạch chuyên môn đã xác nhận (C-04, C-05).',
        attendingOnly: false,
        allowNotApplicable: false
    },
    {
        code: 'CK-05',
        title: 'Giải phẫu bệnh & Phân giai đoạn U / Ung thư trước mổ',
        desc: 'Tự động N/A với nhóm lành tính đã xác nhận; bắt buộc rà soát GPB & cTNM/CRM với ca Ung thư / U tân sinh (B3, B4).',
        attendingOnly: false,
        allowNotApplicable: true,
        naState: 'not_applicable'
    },
    {
        code: 'CK-06',
        title: 'Chuẩn bị Đại tràng – Hậu môn, ERAS & Đánh dấu Stoma',
        desc: 'Y lệnh chuẩn bị ruột/thụt tháo (hoặc ERAS không chuẩn bị cơ học), dinh dưỡng và đánh dấu vị trí HMNT dự kiến (C-07).',
        attendingOnly: false,
        allowNotApplicable: true,
        naState: 'not_indicated'
    },
    {
        code: 'CK-07',
        title: 'Dự trù Máu & Vật tư / Thiết bị đặc thù',
        desc: 'Đã kiểm tra sẵn sàng chế phẩm máu dự trù, stapler, dao năng lượng, lưới thoát vị, ICG, dụng cụ Robot (C-06).',
        attendingOnly: false,
        allowNotApplicable: false
    },
    {
        code: 'CK-04',
        title: 'Hình ảnh học & Nội soi gốc',
        desc: 'BS chính đã trực tiếp xem hình ảnh/kết quả gốc được chỉ định (MRI vùng chậu, CT bụng – chậu, nội soi ĐTT, chụp kiểm tra đầu dưới).',
        attendingOnly: true,
        allowMinorAnorectalNA: true
    },
    {
        code: 'CK-08',
        title: 'Tư vấn Tiền phẫu & Cam kết Phẫu thuật',
        desc: 'BS chính đã giải thích chẩn đoán, phương pháp, tai biến, nguy cơ chuyển mổ mở / mở HMNT và hoàn tất ký cam kết phẫu thuật.',
        attendingOnly: true,
        allowNotApplicable: false
    }
];

const SAP_SUBCHECK_LABELS = {
    preAnesthesiaExam: 'Khám tiền mê',
    ecg: 'Điện tâm đồ (ECG)',
    chestImaging: 'X-quang / CT ngực',
    echo: 'Siêu âm tim'
};

const SAP_RETURN_FEEDBACK_CHIPS = [
    'Thiếu khám tiền mê / thăm dò tim phổi',
    'Chưa rõ kế hoạch ngưng/duy trì thuốc chống huyết khối',
    'Thiếu MRI vùng chậu / đánh giá CRM hoặc đường rò',
    'Cần hội chẩn liên chuyên khoa / MDT trước mổ',
    'Đề nghị điều chỉnh PTV chính phù hợp cột phẫu thuật',
    'Chưa xác nhận dự trù máu / stapler / thiết bị Robot',
    'Khác'
];

const SAP_HOLD_CATEGORIES = [
    { value: 'clinical_change', label: 'Diễn tiến lâm sàng mới (sốt, nhiễm trùng, huyết động...)' },
    { value: 'anesthesia_hold', label: 'Tiền mê / Gây mê đề nghị hoãn tối ưu nội khoa' },
    { value: 'missing_blood_or_device', label: 'Thiếu máu dự trù hoặc thiết bị đặc thù' },
    { value: 'patient_declined_or_deferred', label: 'Người bệnh / Gia đình xin hoãn lịch mổ' },
    { value: 'or_capacity_hold', label: 'Điều phối phòng mổ / Quá tải lịch mổ' },
    { value: 'other', label: 'Lý do khác (ghi rõ)' }
];

const SAP_SIMULATOR_ROLES = [
    { staffId: 0, label: '👤 Thực thi thật: Tài khoản hiện tại' },
    { staffId: 1, label: '🧪 Giả lập [TEST]: TS. BSCKII. Nguyễn Phú Hữu (Trưởng khoa #1)' },
    { staffId: 2, label: '🧪 Giả lập [TEST]: BSCKII. Vũ Khương An (Phó Trưởng khoa #2)' },
    { staffId: 8, label: '🧪 Giả lập [TEST]: ThS. BSCKI. Giao Hữu Trường Quy (BS chính Cột II #8)' },
    { staffId: 44, label: '🧪 Giả lập [TEST]: BSNT Học viên (BS học viên #44)' },
    { staffId: 3, label: '🧪 Giả lập [TEST]: ThS. ĐD. Nguyễn Thị Thanh Thùy (ĐD Trưởng #3)' }
];

const SurgeryApprovalPage = {
    _subtab: 'cases', // 'cases' | 'delegations' | 'logs'
    _filters: {
        scope: 'all_open', // 'week' | 'all_open'
        podId: 'all',
        status: 'all',
        urgency: 'all',
        search: ''
    },
    _simulatedStaffId: 0,
    _catalogData: null,
    _catalogLoading: null,
    _logsState: null,
    _openCaseId: null,
    _catalogQuery: '',
    _activeActionDrawer: null, // null | 'return' | 'approve' | 'preapprove' | 'emergency' | 'hold' | 'release_hold' | 'revoke' | 'submit_extra'

    // ── Canary Gate: Visible to Superadmin always, or all staff when rolloutAccessMode === 'all_staff' ──
    getConfig() {
        const cfg = Store._data?.surgeryApprovalConfig;
        return (cfg && typeof cfg === 'object') ? cfg : {
            scope: 'departmental_step1_only',
            zeroHisCoupling: true,
            rolloutAccessMode: 'superadmin_only',
            checklistMode: 'enforced_gate',
            rolloutEffectiveSurgeryDate: '2026-11-02',
            nsthInternalPrecheckEnabled: false,
            scopeLegendText: '✅ Đã duyệt tại khoa: Xác nhận hoàn tất bước duyệt chuyên môn nội bộ tại Khoa PTĐTT (độc lập với tiến trình duyệt trên phần mềm HIS của Bệnh viện)'
        };
    },

    isFeatureVisibleForCurrentUser() {
        const session = (typeof Auth !== 'undefined' && Auth.getSession) ? Auth.getSession() : null;
        if (!session) return false;
        if (typeof App !== 'undefined' && App.isSuperAdmin && App.isSuperAdmin()) return true;
        return this.getConfig().rolloutAccessMode === 'all_staff';
    },

    // ── Exact 6-Condition Green Tick Predicate & 12-Row Departmental Truth Table ──
    isApprovalGreenTickValid(surgery) {
        if (!surgery || typeof surgery !== 'object') return false;
        if (!['mo', 'noisoi', 'robot'].includes(surgery.approachType)) return false;
        const caseRev = surgery.caseRevision;
        if (!Number.isInteger(caseRev) || caseRev < 1) return false;
        const app = surgery.approval;
        if (!app || typeof app !== 'object') return false;
        if (app.status !== 'approved') return false;
        if (app.activeHold !== null && app.activeHold !== undefined) return false;
        const snap = app.approvedSnapshot;
        if (!snap || typeof snap !== 'object') return false;
        if (!Number.isInteger(snap.caseRevision) || snap.caseRevision !== caseRev) return false;
        return true;
    },

    getApprovalBadgeMeta(surgery) {
        if (!surgery || typeof surgery !== 'object') {
            return { row: 10, badgeCode: 'SYNC_ERROR', badgeLabel: '⚠️ Lỗi đồng bộ phiên bản duyệt', isGreenTickValid: false, cssClass: 'sap-badge--error' };
        }
        const approach = surgery.approachType;
        const app = (surgery.approval && typeof surgery.approval === 'object') ? surgery.approval : {};
        const status = app.status;
        const activeHold = app.activeHold;

        if (status === 'trashed_inactive') {
            return { row: 12, badgeCode: 'TRASHED_INACTIVE', badgeLabel: '', isGreenTickValid: false, cssClass: '' };
        }
        if (approach === 'nsth' || status === 'nsth_external_authority') {
            return { row: 12, badgeCode: 'NSTH_EXTERNAL', badgeLabel: '🔹 Thẩm quyền Khoa NSTH', isGreenTickValid: false, cssClass: 'sap-badge--nsth' };
        }
        if (status === 'legacy_exempt') {
            return { row: 11, badgeCode: 'LEGACY_EXEMPT', badgeLabel: '', isGreenTickValid: false, cssClass: '' };
        }
        if (status === 'legacy_unverified_manual_review') {
            return { row: 11, badgeCode: 'LEGACY_MANUAL_REVIEW', badgeLabel: '⚠️ Cần rà soát dữ liệu lịch sử', isGreenTickValid: false, cssClass: 'sap-badge--legacy' };
        }
        if (status === 'post_approval_hold' || (activeHold !== null && activeHold !== undefined)) {
            return { row: 2, badgeCode: 'DEPT_POST_APPROVAL_HOLD', badgeLabel: '⏸️ Tạm hoãn tại khoa', isGreenTickValid: false, cssClass: 'sap-badge--hold' };
        }
        if (this.isApprovalGreenTickValid(surgery)) {
            return { row: 1, badgeCode: 'DEPT_APPROVED_STANDARD', badgeLabel: '✅ Đã duyệt tại khoa', isGreenTickValid: true, cssClass: 'sap-badge--approved' };
        }
        if (status === 'approved') {
            return { row: 10, badgeCode: 'SYNC_VERSION_CORRUPT', badgeLabel: '⚠️ Lỗi đồng bộ phiên bản duyệt', isGreenTickValid: false, cssClass: 'sap-badge--error' };
        }
        if (status === 'approved_with_exception') {
            return { row: 3, badgeCode: 'DEPT_APPROVED_EMERGENCY_EXCEPTION', badgeLabel: '⚡ Duyệt ngoại lệ cấp cứu (Khoa)', isGreenTickValid: false, cssClass: 'sap-badge--emergency' };
        }
        if (status === 'reapproval_required') {
            return { row: 4, badgeCode: 'DEPT_REAPPROVAL_REQUIRED', badgeLabel: '🔄 Chờ duyệt lại thay đổi', isGreenTickValid: false, cssClass: 'sap-badge--reapproval' };
        }
        if (status === 'returned_for_revision') {
            return { row: 5, badgeCode: 'DEPT_RETURNED_FOR_REVISION', badgeLabel: '↩️ BCN yêu cầu bổ sung', isGreenTickValid: false, cssClass: 'sap-badge--returned' };
        }
        if (status === 'revoked_by_bcn') {
            return { row: 6, badgeCode: 'DEPT_REVOKED_BY_BCN', badgeLabel: '🚫 Đã thu hồi duyệt khoa', isGreenTickValid: false, cssClass: 'sap-badge--revoked' };
        }
        if (status === 'preapproved') {
            return { row: 7, badgeCode: 'DEPT_PREAPPROVED', badgeLabel: '☑️ Đạt tiền duyệt — Chờ Trưởng khoa', isGreenTickValid: false, cssClass: 'sap-badge--preapproved' };
        }
        if (status === 'submitted' || status === 'emergency_exception_pending_ack') {
            return { row: 8, badgeCode: 'DEPT_SUBMITTED_PENDING_BCN', badgeLabel: '⏳ Chờ BCN duyệt khoa', isGreenTickValid: false, cssClass: 'sap-badge--submitted' };
        }
        return { row: 9, badgeCode: 'DEPT_DRAFT_UNSUBMITTED', badgeLabel: '📝 Chưa trình duyệt khoa', isGreenTickValid: false, cssClass: 'sap-badge--draft' };
    },

    renderBadge(surgery, compact = false) {
        const meta = this.getApprovalBadgeMeta(surgery);
        if (!meta.badgeLabel) return '';
        return `<span class="sap-badge ${meta.cssClass} ${compact ? 'sap-badge--compact' : ''}" data-badge-code="${meta.badgeCode}">${Utils.escapeHtml(meta.badgeLabel)}</span>`;
    },

    getEffectiveActor(surgery = null) {
        const session = Auth.getSession() || {};
        const simId = Number(this._simulatedStaffId || 0);
        const canSimulate = App.isSuperAdmin() && simId > 0 && (!surgery || surgery.isTestSandboxCase === true);
        if (canSimulate) {
            const st = Store.getById('staff', simId);
            return {
                staffId: simId,
                name: st ? st.name : `Nhân sự #${simId}`,
                title: st ? (st.title || '') : '',
                role: st ? (st.role || '') : '',
                isAdmin: SAP_BCN_IDS.has(simId) || simId === 3,
                isSuperAdmin: false,
                isSimulated: true
            };
        }
        return {
            staffId: Number(session.staffId || 0),
            name: session.name || session.username || '',
            title: session.title || '',
            role: session.role || '',
            isAdmin: Boolean(session.isAdmin || session.isSuperAdmin),
            isSuperAdmin: Boolean(session.isSuperAdmin),
            isSimulated: false
        };
    },

    _newIdemKey(prefix = 'sap') {
        const rnd = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        return `${prefix}_${rnd}`;
    },

    async _api(path, method = 'GET', body = null, opts = {}) {
        const token = Auth.getToken();
        const headers = {
            'X-Client-Build': String(CLIENT_BUILD)
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (body !== null && method !== 'GET') {
            headers['Content-Type'] = 'application/json';
            headers['Idempotency-Key'] = opts.idempotencyKey || this._newIdemKey('mut');
        }
        const simId = Number(opts.simulateStaffId !== undefined ? opts.simulateStaffId : this._simulatedStaffId);
        if (App.isSuperAdmin() && simId > 0 && opts.allowSimulation) {
            headers['X-Simulate-Staff-Id'] = String(simId);
        }

        const resp = await fetch(path, {
            method,
            headers,
            body: (body !== null && method !== 'GET') ? JSON.stringify(body) : undefined
        });

        let payload = {};
        try {
            payload = await resp.json();
        } catch (_) {
            payload = {};
        }

        if (!resp.ok) {
            if (resp.status === 409 && payload.code === 'CASE_REVISION_MISMATCH' && payload.serverSurgery) {
                this._syncSurgeryInStore(payload.serverSurgery);
                if (this._openCaseId === payload.serverSurgery.id) {
                    this._refreshOpenModal(payload.serverSurgery.id);
                }
            }
            const err = new Error(payload.error || `Lỗi máy chủ (HTTP ${resp.status})`);
            err.status = resp.status;
            err.code = payload.code || payload.errorCode || 'API_ERROR';
            err.payload = payload;
            throw err;
        }
        if (payload && typeof payload === 'object' && typeof Store !== 'undefined') {
            if (payload.version) Store._serverVersion = payload.version;
            if (payload.revisions && typeof payload.revisions === 'object') {
                Store._serverRevisions = Object.assign(Store._serverRevisions || {}, payload.revisions);
            }
            if (method !== 'GET') Store._lastEtag = null;
        }
        return payload;
    },

    async ensureCatalogLoaded() {
        if (this._catalogData) return this._catalogData;
        if (this._catalogLoading) return this._catalogLoading;
        this._catalogLoading = this._api('/api/surgery-approval/catalog', 'GET')
            .then(res => {
                if (res && res.catalog) {
                    this._catalogData = res.catalog;
                }
                if (res && res.config && Store._data) {
                    Store._data.surgeryApprovalConfig = res.config;
                    Store._saveLocal();
                }
                return this._catalogData;
            })
            .catch(err => {
                console.warn('[SurgeryApprovalPage] Catalog fetch warning:', err.message);
                return null;
            })
            .finally(() => {
                this._catalogLoading = null;
            });
        return this._catalogLoading;
    },

    _syncSurgeryInStore(updatedSurgery) {
        if (!updatedSurgery || !Store._data) return;
        const list = Store._data.surgeries || [];
        const idx = list.findIndex(s => Number(s.id) === Number(updatedSurgery.id));
        if (idx >= 0) {
            list[idx] = updatedSurgery;
        } else {
            list.push(updatedSurgery);
        }
        Store._data.surgeries = list;
        if (Store._serverSyncedData) {
            Store._serverSyncedData.surgeries = Store._clone(list);
        }
        Store._saveLocal();
    },

    // ── Main Tab Render & Post-Render Hooks ──
    render() {
        if (!this.isFeatureVisibleForCurrentUser()) {
            return `
            <div class="card" style="padding:36px 20px;text-align:center;">
                <h2 style="margin-bottom:8px;color:var(--text-heading);">🔒 Tính năng đang trong giai đoạn kiểm thử Super Admin</h2>
                <p style="color:var(--text-secondary);font-size:0.9rem;">Tab Duyệt mổ tại khoa hiện chỉ mở cho Super Admin kiểm thử trước khi triển khai toàn khoa.</p>
            </div>`;
        }

        const cfg = this.getConfig();
        const actor = this.getEffectiveActor(null);
        const canViewLogs = SAP_BCN_IDS.has(actor.staffId);
        if (this._subtab === 'logs' && !canViewLogs && !App.isSuperAdmin()) {
            this._subtab = 'cases';
        }

        return `
        <div class="sap-page">
            <div class="page-header">
                <div>
                    <h1 class="page-title">Duyệt mổ tại khoa</h1>
                    <p class="page-subtitle">Quy trình chuẩn bị hồ sơ & phê duyệt chuyên môn nội bộ Khoa PT Đại trực tràng</p>
                </div>
                <div class="surg-header-actions">
                    <button type="button" class="sap-btn" onclick="App.navigate('surgery')">
                        📅 Xem Lịch mổ tuần
                    </button>
                </div>
            </div>

            <div class="sap-scope-banner" role="region" aria-label="Phạm vi duyệt mổ nội bộ tại khoa">
                <div>
                    <strong>🏥 Phạm vi Bước 1 nội bộ tại Khoa PTĐTT (Độc lập với HIS):</strong>
                    Nhãn <strong>✅ Đã duyệt tại khoa</strong> xác nhận hoàn tất rà soát chuyên môn nội bộ tại khoa trước mổ; không thay thế thủ tục duyệt mổ toàn viện trên phần mềm HIS.
                </div>
            </div>

            ${App.isSuperAdmin() ? this._renderCanaryToolbar(cfg) : ''}

            <div class="sap-subtabs" role="tablist" aria-label="Chế độ xem Duyệt mổ tại khoa">
                <button type="button" role="tab" aria-selected="${this._subtab === 'cases'}"
                    class="sap-subtab-btn ${this._subtab === 'cases' ? 'active' : ''}"
                    onclick="SurgeryApprovalPage.switchSubtab('cases')">
                    📋 Danh sách ca mổ
                </button>
                <button type="button" role="tab" aria-selected="${this._subtab === 'delegations'}"
                    class="sap-subtab-btn ${this._subtab === 'delegations' ? 'active' : ''}"
                    onclick="SurgeryApprovalPage.switchSubtab('delegations')">
                    🤝 Ủy quyền BCN
                </button>
                ${(canViewLogs || App.isSuperAdmin()) ? `
                <button type="button" role="tab" aria-selected="${this._subtab === 'logs'}"
                    class="sap-subtab-btn ${this._subtab === 'logs' ? 'active' : ''}"
                    onclick="SurgeryApprovalPage.switchSubtab('logs')">
                    🔐 Nhật ký chuỗi băm BCN
                </button>` : ''}
            </div>

            <div id="sap-subtab-container">
                ${this._subtab === 'cases'
                    ? this._renderCasesSubtab(cfg)
                    : this._subtab === 'delegations'
                        ? this._renderDelegationsSubtab()
                        : this._renderLogsSubtab()}
            </div>
        </div>`;
    },

    afterRender() {
        if (!this.isFeatureVisibleForCurrentUser()) return;
        if (!this._catalogData) {
            this.ensureCatalogLoaded().then(cat => {
                if (cat && App.currentPage === 'surgery-approval') {
                    App.renderCurrentPage();
                }
            });
        }
        if (this._subtab === 'logs' && !this._logsState) {
            this.loadAuditLogs();
        }
    },

    switchSubtab(tab) {
        this._subtab = tab;
        if (tab === 'logs') {
            this._logsState = null;
        }
        App.renderCurrentPage();
    },

    // ── Superadmin Canary Control & Zero-PHI Sandbox Toolbar ──
    _renderCanaryToolbar(cfg) {
        const isLocked = cfg.rolloutAccessMode !== 'all_staff';
        const sandboxCount = (Store._data?.surgeries || []).filter(s => s && s.isTestSandboxCase === true).length;

        return `
        <div class="sap-canary-bar" id="sap-superadmin-toolbar">
            <div class="sap-canary-header">
                <div class="sap-canary-title">
                    🛡️ Bảng Điều Khiển Triển Khai Thử Nghiệm (Dành riêng Super Admin)
                </div>
                <span class="sap-canary-pill ${isLocked ? 'sap-canary-pill--locked' : 'sap-canary-pill--live'}">
                    ${isLocked ? '🔒 Đang ẩn với nhân sự khác (Chỉ Super Admin thấy)' : '🌐 Đang mở toàn Khoa PTĐTT'}
                </span>
            </div>
            <div class="sap-canary-grid">
                <div class="sap-canary-field">
                    <label for="sap-cfg-rollout">Chế độ hiển thị (Rollout Gate)</label>
                    <select id="sap-cfg-rollout" class="sap-select" onchange="SurgeryApprovalPage.updateConfigField('rolloutAccessMode', this.value)">
                        <option value="superadmin_only" ${cfg.rolloutAccessMode === 'superadmin_only' ? 'selected' : ''}>🔒 Chỉ Super Admin (Test trước)</option>
                        <option value="all_staff" ${cfg.rolloutAccessMode === 'all_staff' ? 'selected' : ''}>🌐 Mở cho toàn bộ nhân sự Khoa</option>
                    </select>
                </div>
                <div class="sap-canary-field">
                    <label for="sap-cfg-checklist">Chế độ cổng Checklist & Chip</label>
                    <select id="sap-cfg-checklist" class="sap-select" onchange="SurgeryApprovalPage.updateConfigField('checklistMode', this.value)">
                        <option value="enforced_gate" ${cfg.checklistMode === 'enforced_gate' ? 'selected' : ''}>🛡️ Bắt buộc đủ CK-01..08 & Chip (Enforced)</option>
                        <option value="shadow_optional" ${cfg.checklistMode === 'shadow_optional' ? 'selected' : ''}>🌤️ Khuyến khích điền (Shadow Optional)</option>
                        <option value="off" ${cfg.checklistMode === 'off' ? 'selected' : ''}>⏸️ Tắt kiểm tra Checklist chi tiết</option>
                    </select>
                </div>
                <div class="sap-canary-field">
                    <label for="sap-sim-role">Giả lập vai trò (chỉ áp dụng trên ca [TEST])</label>
                    <select id="sap-sim-role" class="sap-select" onchange="SurgeryApprovalPage.setSimulatedRole(this.value)">
                        ${SAP_SIMULATOR_ROLES.map(r => `<option value="${r.staffId}" ${Number(this._simulatedStaffId) === r.staffId ? 'selected' : ''}>${Utils.escapeHtml(r.label)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="sap-canary-actions">
                <button type="button" class="sap-btn sap-btn--primary" id="sap-btn-seed-sandbox" onclick="SurgeryApprovalPage.seedSandboxCases()">
                    🧪 Tạo 5 ca mẫu Zero-PHI ${sandboxCount > 0 ? `(Đang có ${sandboxCount} ca)` : ''}
                </button>
                <button type="button" class="sap-btn sap-btn--danger" id="sap-btn-clean-sandbox" onclick="SurgeryApprovalPage.cleanupSandboxCases()" ${sandboxCount === 0 ? 'disabled' : ''}>
                    🧹 Xóa sạch ca mẫu [TEST]
                </button>
            </div>
        </div>`;
    },

    async updateConfigField(field, value) {
        try {
            const res = await this._api('/api/surgery-approval/config', 'PUT', { [field]: value });
            if (res && res.config && Store._data) {
                Store._data.surgeryApprovalConfig = res.config;
                Store._saveLocal();
            }
            if (typeof App !== 'undefined' && App.updateNavVisibility) {
                App.updateNavVisibility();
            }
            App.renderCurrentPage();
            Toast.success('Đã cập nhật cấu hình Duyệt mổ tại khoa');
        } catch (err) {
            Toast.error(err.message);
            App.renderCurrentPage();
        }
    },

    setSimulatedRole(staffIdStr) {
        this._simulatedStaffId = parseInt(staffIdStr, 10) || 0;
        this._logsState = null;
        if (App.currentPage === 'surgery-approval') {
            App.renderCurrentPage();
        }
        if (this._openCaseId) {
            this._refreshOpenModal(this._openCaseId);
        }
        const label = SAP_SIMULATOR_ROLES.find(r => r.staffId === this._simulatedStaffId)?.label || '';
        Toast.info(`Chế độ vai trò: ${label}`);
    },

    async seedSandboxCases() {
        try {
            const res = await this._api('/api/surgery-approval/sandbox/seed', 'POST', {});
            await Store._syncFromServer(true);
            App.renderCurrentPage();
            if (res.alreadySeeded) {
                Toast.info(`Đã có sẵn ${res.cases?.length || 5} ca mẫu [TEST] trong danh sách.`);
            } else {
                Toast.success(`Đã tạo ${res.cases?.length || 5} ca mẫu Zero-PHI ([TEST]) để kiểm thử!`);
            }
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async cleanupSandboxCases() {
        const ok = await Confirm.show({
            title: 'Dọn dẹp ca mẫu kiểm thử [TEST]',
            message: 'Xóa toàn bộ các ca mẫu <strong>[TEST] Zero-PHI</strong>, thông báo thử nghiệm và ủy quyền mẫu khỏi hệ thống? Dữ liệu ca mổ thực tế của khoa được giữ nguyên 100%.',
            icon: '🧹',
            type: 'danger',
            confirmText: 'Xóa ca mẫu [TEST]',
            cancelText: 'Hủy'
        });
        if (!ok) return;
        try {
            const res = await this._api('/api/surgery-approval/sandbox/cleanup', 'DELETE', {});
            await Store._syncFromServer(true);
            App.renderCurrentPage();
            Toast.success(`Đã dọn sạch ${res.removedCount || 0} bản ghi ca mẫu [TEST].`);
        } catch (err) {
            Toast.error(err.message);
        }
    },

    // ── Subtab 1: Surgery Approval Queue & Case Cards ──
    setFilter(key, val) {
        this._filters[key] = val;
        App.renderCurrentPage();
    },

    _getEligibleSurgeries(cfg) {
        const all = Store._data?.surgeries || [];
        const rolloutDate = cfg.rolloutEffectiveSurgeryDate || '2026-11-02';
        return all.filter(s => {
            if (!s || typeof s !== 'object') return false;
            const st = s.approval?.status;
            if (st === 'trashed_inactive') return false;
            if (s.isTestSandboxCase === true) return App.isSuperAdmin();
            if (this._filters.scope === 'week') {
                if (typeof SurgeryPage !== 'undefined') {
                    const weekDates = SurgeryPage.getWeekDates().map(d => SurgeryPage.dateStr(d));
                    return weekDates.includes(s.date);
                }
            }
            // In 'all_open' mode: include all cases >= rolloutDate OR with non-exempt active workflow status
            if (st && !['legacy_exempt'].includes(st)) return true;
            return (s.date || '') >= rolloutDate;
        });
    },

    _renderCasesSubtab(cfg) {
        const baseList = this._getEligibleSurgeries(cfg);
        const deptCases = baseList.filter(s => s.approachType !== 'nsth' && s.approval?.status !== 'legacy_exempt');

        const kpiDraft = deptCases.filter(s => ['draft_unsubmitted', 'resubmit_required'].includes(s.approval?.status || 'draft_unsubmitted')).length;
        const kpiReady = deptCases.filter(s => s.approval?.status === 'ready_for_attending').length;
        const kpiPendingBcn = deptCases.filter(s => ['submitted', 'preapproved', 'emergency_exception_pending_ack'].includes(s.approval?.status)).length;
        const kpiApproved = deptCases.filter(s => this.isApprovalGreenTickValid(s)).length;
        const kpiAttention = deptCases.filter(s => ['post_approval_hold', 'reapproval_required', 'returned_for_revision', 'revoked_by_bcn', 'approved_with_exception'].includes(s.approval?.status)).length;

        const q = (this._filters.search || '').trim().toLowerCase();
        const filtered = baseList.filter(s => {
            const podId = String(s.podAssignment?.suggestedPodId || '');
            const status = s.approval?.status || 'draft_unsubmitted';
            const urg = s.clinicalClassification?.urgencyLevel || 'elective';
            if (this._filters.podId !== 'all' && podId !== String(this._filters.podId)) return false;
            if (this._filters.urgency !== 'all' && urg !== this._filters.urgency) return false;
            if (this._filters.status !== 'all') {
                if (this._filters.status === 'pending_bcn' && !['submitted', 'preapproved', 'emergency_exception_pending_ack'].includes(status)) return false;
                if (this._filters.status === 'approved_valid' && !this.isApprovalGreenTickValid(s)) return false;
                if (this._filters.status === 'needs_action' && !['draft_unsubmitted', 'ready_for_attending', 'returned_for_revision', 'reapproval_required', 'resubmit_required', 'post_approval_hold'].includes(status)) return false;
            }
            if (q) {
                const hay = `${s.patientName || ''} ${s.admissionId || ''} ${s.diagnosis || ''} ${s.method || ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        }).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (Number(a.id) - Number(b.id)));

        return `
        <div class="sap-kpi-grid">
            <div class="sap-kpi-card">
                <span class="sap-kpi-label">📝 Chưa trình duyệt</span>
                <span class="sap-kpi-value">${kpiDraft}</span>
            </div>
            <div class="sap-kpi-card">
                <span class="sap-kpi-label">🩺 HV đã rà — Chờ BS chính</span>
                <span class="sap-kpi-value">${kpiReady}</span>
            </div>
            <div class="sap-kpi-card">
                <span class="sap-kpi-label">⏳ Chờ BCN phê duyệt</span>
                <span class="sap-kpi-value">${kpiPendingBcn}</span>
            </div>
            <div class="sap-kpi-card">
                <span class="sap-kpi-label">✅ Đã duyệt tại khoa</span>
                <span class="sap-kpi-value">${kpiApproved}</span>
            </div>
            <div class="sap-kpi-card">
                <span class="sap-kpi-label">⏸️ Hoãn / Ngoại lệ / Duyệt lại</span>
                <span class="sap-kpi-value">${kpiAttention}</span>
            </div>
        </div>

        <div class="sap-filters-card">
            <div class="sap-canary-field">
                <label for="sap-f-scope">Phạm vi lịch mổ</label>
                <select id="sap-f-scope" class="sap-select" onchange="SurgeryApprovalPage.setFilter('scope', this.value)">
                    <option value="all_open" ${this._filters.scope === 'all_open' ? 'selected' : ''}>Tất cả ca thuộc diện duyệt</option>
                    <option value="week" ${this._filters.scope === 'week' ? 'selected' : ''}>Theo tuần đang chọn</option>
                </select>
            </div>
            <div class="sap-canary-field">
                <label for="sap-f-pod">Nhóm buồng bệnh (POD)</label>
                <select id="sap-f-pod" class="sap-select" onchange="SurgeryApprovalPage.setFilter('podId', this.value)">
                    <option value="all" ${this._filters.podId === 'all' ? 'selected' : ''}>Tất cả POD</option>
                    <option value="1" ${this._filters.podId === '1' ? 'selected' : ''}>POD 1 (P.707, 718)</option>
                    <option value="2" ${this._filters.podId === '2' ? 'selected' : ''}>POD 2 (P.705, 706, 711, 712, 712A, 719)</option>
                    <option value="3" ${this._filters.podId === '3' ? 'selected' : ''}>POD 3 (P.708, 709, 710)</option>
                </select>
            </div>
            <div class="sap-canary-field">
                <label for="sap-f-status">Trạng thái duyệt</label>
                <select id="sap-f-status" class="sap-select" onchange="SurgeryApprovalPage.setFilter('status', this.value)">
                    <option value="all" ${this._filters.status === 'all' ? 'selected' : ''}>Tất cả trạng thái</option>
                    <option value="needs_action" ${this._filters.status === 'needs_action' ? 'selected' : ''}>Cần chuẩn bị / bổ sung</option>
                    <option value="pending_bcn" ${this._filters.status === 'pending_bcn' ? 'selected' : ''}>Chờ BCN duyệt</option>
                    <option value="approved_valid" ${this._filters.status === 'approved_valid' ? 'selected' : ''}>✅ Đã duyệt tại khoa</option>
                </select>
            </div>
            <div class="sap-canary-field">
                <label for="sap-f-search">Tìm bệnh nhân / Số NV / PP mổ</label>
                <input id="sap-f-search" type="search" class="sap-input" placeholder="Nhập tên BN, số NV..."
                    value="${Utils.escapeHtml(this._filters.search)}"
                    oninput="SurgeryApprovalPage.setFilter('search', this.value)">
            </div>
        </div>

        <div class="sap-case-list">
            ${filtered.length > 0 ? filtered.map(s => this._renderCaseCard(s)).join('') : `
            <div class="card" style="padding:36px 20px;text-align:center;">
                <div style="font-size:2rem;margin-bottom:8px;">📋</div>
                <h3 style="color:var(--text-heading);margin-bottom:6px;">Chưa có ca mổ nào khớp bộ lọc hiện tại</h3>
                <p style="color:var(--text-secondary);font-size:0.88rem;">
                    ${App.isSuperAdmin() ? 'Bấm nút <strong>"🧪 Tạo 5 ca mẫu Zero-PHI"</strong> phía trên để kiểm thử toàn bộ quy trình 1 chạm ngay lập tức.' : 'Các ca mổ dự kiến sẽ tự động hiển thị tại đây.'}
                </p>
            </div>`}
        </div>`;
    },

    _formatPodLabel(podId) {
        if (!podId) return '';
        const str = String(podId).trim();
        return /^\d+$/.test(str) ? `POD ${str}` : str.replace(/_/g, ' ');
    },

    _renderCaseCard(s) {
        const podRoom = s.podAssignment?.wardRoom && s.podAssignment.wardRoom !== 'unassigned'
            ? `Phòng ${s.podAssignment.wardRoom}`
            : 'Chưa gán phòng';
        const podLabel = s.podAssignment?.suggestedPodId
            ? this._formatPodLabel(s.podAssignment.suggestedPodId)
            : 'Chưa gán POD';
        const pcClass = s.clinicalClassification?.procedureClass?.confirmedClass
            || (s.clinicalClassification?.procedureClass?.suggestedClass ? `${s.clinicalClassification.procedureClass.suggestedClass} (gợi ý)` : 'Chưa xếp loại PT');
        const mainName = Utils.getStaffName(s.mainSurgeon) || 'Chưa chọn BS chính';
        const assistName = s.assistSurgeon1 ? Utils.getStaffName(s.assistSurgeon1) : '';
        const approachLabel = ({ mo: 'Mổ mở', noisoi: 'Nội soi', nsth: 'Nội soi tiêu hóa', robot: 'Robot' })[s.approachType] || s.approachType || '—';

        return `
        <article class="sap-case-card ${s.isTestSandboxCase ? 'sap-case-card--sandbox' : ''}" data-approval-card-id="${s.id}">
            <div class="sap-case-top">
                <div class="sap-case-patient">
                    ${s.isTestSandboxCase ? '<span class="sap-tag sap-tag--sandbox">🧪 CA MẪU TEST</span>' : ''}
                    <span>${Utils.escapeHtml(Utils.toProperCase(s.patientName || ''))}</span>
                    ${s.birthYear ? `<span style="font-weight:500;color:var(--text-secondary);">(${Utils.escapeHtml(String(s.birthYear))})</span>` : ''}
                </div>
                <div>${this.renderBadge(s)}</div>
            </div>
            <div class="sap-case-meta">
                <span>📅 <strong>Ngày mổ:</strong> ${Utils.formatDate(s.date)}</span>
                <span>🏥 <strong>Số NV:</strong> ${Utils.escapeHtml(s.admissionId || '—')}</span>
                <span>🛏️ <strong>${Utils.escapeHtml(podRoom)}</strong> (${Utils.escapeHtml(podLabel)})</span>
                <span>🔪 <strong>Đường mổ:</strong> ${Utils.escapeHtml(approachLabel)}</span>
                <span>🏷️ <strong>Hạng PT:</strong> ${Utils.escapeHtml(pcClass)}</span>
                <span>🔢 <strong>Phiên bản:</strong> v${Number(s.caseRevision || 1)}</span>
            </div>
            <div class="sap-case-clinical">
                <div><strong>Chẩn đoán:</strong> ${Utils.escapeHtml(s.diagnosis || '—')}</div>
                <div><strong>Phương pháp PT:</strong> ${Utils.escapeHtml(s.method || '—')}</div>
                <div><strong>Ê-kíp mổ:</strong> ${Utils.escapeHtml(mainName)}${assistName ? ` / Phụ: ${Utils.escapeHtml(assistName)}` : ''}</div>
            </div>
            ${s.approval?.returnFeedback?.note || (s.approval?.returnFeedback?.chips || []).length ? `
            <div class="sap-alert sap-alert--danger">
                <strong>↩️ Yêu cầu bổ sung từ BCN:</strong>
                ${Utils.escapeHtml([...(s.approval.returnFeedback.chips || []), s.approval.returnFeedback.note || ''].filter(Boolean).join(' — '))}
            </div>` : ''}
            ${s.approval?.activeHold ? `
            <div class="sap-alert sap-alert--warning">
                <strong>⏸️ Đang tạm hoãn tại khoa:</strong> ${Utils.escapeHtml(s.approval.activeHold.holdReason || '')}
            </div>` : ''}
            <div class="sap-case-footer">
                <div style="font-size:0.8rem;color:var(--text-secondary);">
                    ${s.approachType === 'nsth'
                        ? '🔹 Ca Nội soi tiêu hóa thuộc thẩm quyền Trưởng khoa NSTH.'
                        : (s.approval?.status === 'ready_for_attending' ? '🩺 Học viên đã rà sơ bộ — Chờ BS chính kiểm tra & bấm Trình duyệt' : '')}
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                    ${s.approachType !== 'nsth' ? `
                    <button type="button" class="sap-btn sap-btn--primary" onclick="SurgeryApprovalPage.openCaseModal(${s.id})">
                        📋 Mở hồ sơ duyệt mổ
                    </button>` : ''}
                </div>
            </div>
        </article>`;
    },

    // ── Subtab 2: Time-Bounded BCN Delegations (Chief -> Deputy) ──
    _renderDelegationsSubtab() {
        const dels = (Store._data?.approvalDelegations || []).slice().reverse();
        const actor = this.getEffectiveActor(null);
        const canCreate = actor.staffId === SAP_CHIEF_ID || App.isSuperAdmin();
        const nowIsoLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        const tomorrowIsoLocal = new Date(Date.now() + 24 * 3600000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

        return `
        <div class="sap-section">
            <div class="sap-section-header">
                <h2 class="sap-section-title">🤝 Quản lý Ủy quyền Phê duyệt Mổ (Trưởng khoa → Phó Trưởng khoa)</h2>
            </div>
            <p style="font-size:0.86rem;color:var(--text-secondary);margin:0;">
                Theo quy chế Khoa PTĐTT: Phó Trưởng khoa (<strong>BSCKII. Vũ Khương An</strong>) thực hiện Tiền duyệt thường xuyên và chỉ chốt Phê duyệt tại khoa thay Trưởng khoa (<strong>TS. BSCKII. Nguyễn Phú Hữu</strong>) khi có bản ghi Ủy quyền đang trong khung giờ hiệu lực.
            </p>
            ${canCreate ? `
            <form onsubmit="SurgeryApprovalPage.submitDelegation(event)" class="sap-case-banner">
                <div class="sap-canary-grid">
                    <div class="sap-canary-field">
                        <label for="sap-del-from">Hiệu lực từ</label>
                        <input id="sap-del-from" name="effectiveFrom" type="datetime-local" class="sap-input" value="${nowIsoLocal}" required>
                    </div>
                    <div class="sap-canary-field">
                        <label for="sap-del-to">Hiệu lực đến</label>
                        <input id="sap-del-to" name="effectiveTo" type="datetime-local" class="sap-input" value="${tomorrowIsoLocal}" required>
                    </div>
                    <div class="sap-canary-field">
                        <label for="sap-del-scope">Phạm vi ủy quyền</label>
                        <select id="sap-del-scope" name="scope" class="sap-select">
                            <option value="all_departmental_surgeries">Toàn bộ ca mổ thuộc Khoa PTĐTT</option>
                            <option value="routine_only">Chỉ ca mổ thường quy / bán khẩn</option>
                        </select>
                    </div>
                </div>
                <div class="sap-canary-field" style="margin-top:8px;">
                    <label for="sap-del-reason">Lý do ủy quyền (công tác, hội nghị, nghỉ phép...)</label>
                    <input id="sap-del-reason" name="reason" class="sap-input" required minlength="5"
                        placeholder="Ví dụ: Đi công tác / Hội chẩn liên viện...">
                </div>
                <div style="display:flex;justify-content:flex-end;margin-top:8px;">
                    <button type="submit" class="sap-btn sap-btn--primary">
                        ${actor.staffId === SAP_CHIEF_ID ? '✅ Cấp ủy quyền duyệt mổ' : '🧪 Cấp ủy quyền mẫu [TEST] (Super Admin)'}
                    </button>
                </div>
            </form>` : ''}

            <div class="sap-log-table-wrap">
                <table class="sap-log-table">
                    <thead>
                        <tr>
                            <th>Mã ủy quyền</th>
                            <th>Hiệu lực</th>
                            <th>Phạm vi & Lý do</th>
                            <th>Trạng thái</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dels.length > 0 ? dels.map(d => {
                            const nowMs = Date.now();
                            const fMs = new Date(d.effectiveFrom).getTime();
                            const tMs = new Date(d.effectiveTo).getTime();
                            const isActive = !d.revokedAt && nowMs >= fMs && nowMs <= tMs;
                            const statusText = d.revokedAt
                                ? '🚫 Đã thu hồi'
                                : (isActive ? '✅ Đang có hiệu lực' : (nowMs < fMs ? '⏳ Chưa tới giờ' : '⌛ Đã hết hạn'));
                            return `
                            <tr>
                                <td>
                                    <strong>${Utils.escapeHtml(d.delegationId)}</strong>
                                    ${d.isTestSandboxDelegation ? '<br><span class="sap-tag sap-tag--sandbox">🧪 TEST</span>' : ''}
                                </td>
                                <td>
                                    Từ: ${Utils.escapeHtml(d.effectiveFrom)}<br>
                                    Đến: ${Utils.escapeHtml(d.effectiveTo)}
                                </td>
                                <td>
                                    <strong>${d.scope === 'routine_only' ? 'Thường quy' : 'Toàn bộ ca khoa'}</strong><br>
                                    ${Utils.escapeHtml(d.reason || '')}
                                </td>
                                <td><strong>${statusText}</strong></td>
                                <td>
                                    ${!d.revokedAt && (actor.staffId === SAP_CHIEF_ID || (d.isTestSandboxDelegation && App.isSuperAdmin())) ? `
                                    <button type="button" class="sap-btn sap-btn--danger" onclick="SurgeryApprovalPage.revokeDelegation('${Utils.escapeHtml(d.delegationId)}')">
                                        Thu hồi
                                    </button>` : '—'}
                                </td>
                            </tr>`;
                        }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);padding:20px;">Chưa có bản ghi ủy quyền nào.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>`;
    },

    async submitDelegation(e) {
        e.preventDefault();
        const f = new FormData(e.target);
        const session = Auth.getSession() || {};
        const cfg = this.getConfig();
        const isSimulating = Number(this._simulatedStaffId || 0) > 0 && Number(this._simulatedStaffId) !== Number(session.staffId || 0);
        const isSandboxDel = App.isSuperAdmin() && cfg.rolloutAccessMode === 'superadmin_only' && (Number(session.staffId) !== SAP_CHIEF_ID || isSimulating);
        const body = {
            effectiveFrom: f.get('effectiveFrom'),
            effectiveTo: f.get('effectiveTo'),
            scope: f.get('scope') || 'all_departmental_surgeries',
            reason: f.get('reason') || '',
            isTestSandboxDelegation: isSandboxDel
        };
        try {
            await this._api('/api/surgery-approval/delegations', 'POST', body, { allowSimulation: true });
            await Store._syncFromServer(true);
            App.renderCurrentPage();
            Toast.success('Đã tạo bản ghi Ủy quyền duyệt mổ thành công');
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async revokeDelegation(delId) {
        try {
            await this._api(`/api/surgery-approval/delegations/${encodeURIComponent(delId)}/revoke`, 'POST', {
                reason: 'Thu hồi ủy quyền theo yêu cầu BCN'
            }, { allowSimulation: true });
            await Store._syncFromServer(true);
            App.renderCurrentPage();
            Toast.success('Đã thu hồi ủy quyền duyệt mổ');
        } catch (err) {
            Toast.error(err.message);
        }
    },

    // ── Subtab 3: BCN-Only Hash-Chained Audit Journal ──
    async loadAuditLogs() {
        try {
            const res = await this._api('/api/surgery-approval/logs?limit=150', 'GET', null, { allowSimulation: true });
            this._logsState = { ok: true, data: res };
        } catch (err) {
            this._logsState = { ok: false, error: err.message, status: err.status };
        }
        if (App.currentPage === 'surgery-approval' && this._subtab === 'logs') {
            const wrap = document.getElementById('sap-subtab-container');
            if (wrap) wrap.innerHTML = this._renderLogsSubtab();
        }
    },

    _renderLogsSubtab() {
        if (!this._logsState) {
            return `<div class="card" style="padding:28px;text-align:center;">⏳ Đang xác thực quyền BCN & kiểm tra chuỗi băm SHA-256...</div>`;
        }
        if (!this._logsState.ok) {
            return `
            <div class="sap-alert sap-alert--danger">
                <strong>⛔ Từ chối truy cập (HTTP ${this._logsState.status || 403}):</strong> ${Utils.escapeHtml(this._logsState.error)}
            </div>`;
        }
        const d = this._logsState.data;
        const entries = d.entries || [];
        return `
        <div class="sap-section">
            <div class="sap-section-header">
                <h2 class="sap-section-title">🔐 Sổ Nhật Ký Chuỗi Băm Bất Biến (Chỉ Trưởng khoa & Phó Trưởng khoa)</h2>
                <button type="button" class="sap-btn" onclick="SurgeryApprovalPage.loadAuditLogs()">🔄 Làm mới kiểm định</button>
            </div>
            <div class="sap-alert ${d.chainValid ? 'sap-alert--success' : 'sap-alert--danger'}">
                <strong>${d.chainValid ? '✅ Chuỗi băm SHA-256 toàn vẹn 100%' : '⚠️ CẢNH BÁO ĐỨT GÃY CHUỖI BĂM'}:</strong>
                Tổng số sự kiện: <strong>${d.totalEvents}</strong> • Mã băm đầu chuỗi (Head Hash): <span class="sap-hash-mono">${Utils.escapeHtml(d.headHash || '')}</span>
            </div>
            <div class="sap-log-table-wrap">
                <table class="sap-log-table">
                    <thead>
                        <tr>
                            <th>Seq</th>
                            <th>Thời điểm</th>
                            <th>Người thực hiện</th>
                            <th>Thao tác & Ca mổ</th>
                            <th>Chuỗi băm (SHA-256)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${entries.length > 0 ? entries.map(e => `
                        <tr>
                            <td><strong>#${e.eventSeq}</strong></td>
                            <td>${Utils.escapeHtml((e.timestamp || '').replace('T', ' '))}</td>
                            <td>
                                <strong>${Utils.escapeHtml(e.actor?.name || '')}</strong>
                                ${(e.actor?.isSimulated || e.actor?.simulatedBySuperAdminStaffId) ? '<br><span class="sap-tag sap-tag--sandbox">Giả lập [TEST]</span>' : ''}
                            </td>
                            <td>
                                <strong>${Utils.escapeHtml(e.action || '')}</strong>
                                ${e.surgeryId ? `<br>Ca #${e.surgeryId} (v${e.caseRevisionBefore ?? '—'} → v${e.caseRevisionAfter ?? '—'})` : ''}
                            </td>
                            <td class="sap-hash-mono">${Utils.escapeHtml((e.entryHash || '').slice(0, 24))}…</td>
                        </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;padding:20px;">Chưa có sự kiện nào trong sổ nhật ký.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>`;
    },

    // ── Interactive Case Preparation & Approval Modal ──
    async openCaseModal(surgeryId) {
        if (!this.isFeatureVisibleForCurrentUser()) return;
        await this.ensureCatalogLoaded();
        const s = (Store._data?.surgeries || []).find(x => Number(x.id) === Number(surgeryId));
        if (!s) {
            Toast.error('Không tìm thấy ca mổ trên danh sách hiện tại.');
            return;
        }
        this._openCaseId = Number(s.id);
        this._catalogQuery = '';
        this._activeActionDrawer = null;

        const modalEl = document.getElementById('modal');
        if (modalEl) modalEl.classList.add('sap-modal-xl');

        Modal.open(
            `📋 Hồ sơ duyệt mổ tại khoa — ${Utils.toProperCase(s.patientName || '')}`,
            this._buildCaseModalHtml(s)
        );
    },

    _refreshOpenModal(surgeryId) {
        const overlay = document.getElementById('modal-overlay');
        const modalBody = document.getElementById('modal-body');
        if (!overlay || !overlay.classList.contains('active') || !modalBody) return;
        const s = (Store._data?.surgeries || []).find(x => Number(x.id) === Number(surgeryId));
        if (!s) return;
        const scrollPos = modalBody.scrollTop;
        modalBody.innerHTML = this._buildCaseModalHtml(s);
        modalBody.scrollTop = scrollPos;
        if (App.currentPage === 'surgery-approval' || App.currentPage === 'surgery') {
            App.renderCurrentPage();
        }
    },

    _buildCaseModalHtml(s) {
        const actor = this.getEffectiveActor(s);
        const isTrainee = SAP_TRAINEE_IDS.has(actor.staffId);
        const isAttending = SAP_ATTENDING_IDS.has(actor.staffId);
        const isBcn = SAP_BCN_IDS.has(actor.staffId);
        const canEditPrep = isTrainee || isAttending || isBcn || actor.isSuperAdmin;

        const pa = s.podAssignment || {};
        const cc = s.clinicalClassification || {};
        const pg = cc.pathologyGroup || {};
        const pc = cc.procedureClass || {};
        const col = cc.columnCompliance || {};
        const chips = s.clinicalChips || {};
        const ctx = chips.contextChips || {};
        const ck = s.preopChecklist || {};
        const app = s.approval || {};
        const status = app.status || 'draft_unsubmitted';

        const pgConfirmed = pg.confirmedValue && pg.confirmedValue !== 'unknown' ? pg.confirmedValue : null;
        const pgSuggested = !pgConfirmed ? pg.suggestedValue : null;
        const urgVal = cc.urgencyLevel || 'elective';
        const isRobot = s.approachType === 'robot';
        const isExternalMain = s.mainSurgeon && !SAP_ATTENDING_IDS.has(Number(s.mainSurgeon)) && !SAP_TRAINEE_IDS.has(Number(s.mainSurgeon));

        const catalogProcs = (this._catalogData?.procedures || []).filter(p => {
            const grp = p.approachGroup || p.sheetApproach;
            if (s.approachType === 'mo') return grp === 'mo';
            if (s.approachType === 'noisoi' || s.approachType === 'robot') return grp === 'noisoi';
            return true;
        });
        const cq = (this._catalogQuery || '').trim().toLowerCase();
        const filteredCatalog = (cq
            ? catalogProcs.filter(p => `${p.catalogEntryId} ${p.officialName || p.nameVn || ''} ${p.procedureClass}`.toLowerCase().includes(cq))
            : catalogProcs.slice(0, 12)
        ).slice(0, 25);

        const selectedEntry = (this._catalogData?.procedures || []).find(p => p.catalogEntryId === pc.confirmedCatalogEntryId)
            || (this._catalogData?.procedures || []).find(p => p.catalogEntryId === pc.suggestedCatalogCode);

        const sysCheck = col.systemCheck || 'within_column';
        const baseColLabel = col.surgeonBaseColumn2026 ? `Cột ${col.surgeonBaseColumn2026}` : (col.surgeonColumn || 'Cột BS');
        const sysCheckBanner = {
            within_column: { cls: 'sap-alert--success', text: `✅ Đúng cột phẫu thuật (${baseColLabel} vs ${pc.confirmedClass || pc.suggestedClass || 'Hạng PT'}).` },
            approved_over_column_matched: { cls: 'sap-alert--info', text: '☑️ Có trong danh mục DVKT vượt cột đã cấu hình.' },
            over_column: { cls: 'sap-alert--warning', text: `⚠️ Kỹ thuật (${pc.confirmedClass || ''}) cao hơn cột hiện tại của BS mổ chính (${baseColLabel}) — bắt buộc chọn Đề xuất vượt cột hoặc đổi PTV chính.` },
            robot_certification_required: { cls: 'sap-alert--danger', text: '🤖 Phẫu thuật Robot: BS mổ chính chưa nằm trong danh sách chứng nhận mổ chính Robot tại khoa — vui lòng trình BCN xét duyệt chứng chỉ.' },
            external_surgeon_verify_privilege: { cls: 'sap-alert--info', text: '🤝 BS ngoài khoa / Liên chuyên khoa đứng mổ chính — bắt buộc chọn BS chính Khoa PTĐTT phụ trách phối hợp.' },
            matrix_expired_manual_verify: { cls: 'sap-alert--warning', text: '⚠️ Ma trận phân cột đã qua kỳ hiệu lực — BCN xác minh thủ công khi duyệt.' },
            unclassified_manual_verify: { cls: 'sap-alert--info', text: 'ℹ️ Kỹ thuật chưa xếp loại / phối hợp liên khoa — BCN xét duyệt thủ công theo thuyết minh.' },
            invalid_trainee_main_surgeon: { cls: 'sap-alert--danger', text: '⛔ Bác sĩ nội trú / BS học viên không được đứng tên BS mổ chính.' },
            trainee_not_allowed_main: { cls: 'sap-alert--danger', text: '⛔ Bác sĩ nội trú / BS học viên không được đứng tên BS mổ chính.' }
        }[sysCheck] || { cls: 'sap-alert--info', text: 'ℹ️ Vui lòng chọn kỹ thuật trong danh mục 309 PT để kiểm tra cột tự động.' };

        const attendingStaff = (Store.getAll('staff') || []).filter(st => SAP_ATTENDING_IDS.has(Number(st.id)));

        return `
        <div class="sap-modal-wrap" data-modal-case-id="${s.id}">
            ${actor.isSimulated ? `
            <div class="sap-alert sap-alert--info">
                🧪 <strong>Đang thao tác dưới vai trò giả lập [TEST]:</strong> ${Utils.escapeHtml((actor.title ? actor.title + ' ' : '') + actor.name)} (#${actor.staffId})
            </div>` : ''}

            <div class="sap-case-banner">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                    <div style="font-size:1.02rem;font-weight:700;color:var(--text-heading);">
                        ${s.isTestSandboxCase ? '<span class="sap-tag sap-tag--sandbox">🧪 TEST</span> ' : ''}
                        ${Utils.escapeHtml(Utils.toProperCase(s.patientName || ''))}
                        ${s.birthYear ? `(${s.birthYear})` : ''} — Số NV: ${Utils.escapeHtml(s.admissionId || '—')}
                    </div>
                    <div>${this.renderBadge(s)}</div>
                </div>
                <div class="sap-case-meta">
                    <span>📅 <strong>Ngày mổ:</strong> ${Utils.formatDate(s.date)}</span>
                    <span>🔪 <strong>BS mổ chính:</strong> ${Utils.escapeHtml(Utils.getStaffName(s.mainSurgeon) || 'Chưa chọn')}</span>
                    <span>🩺 <strong>Phụ 1:</strong> ${Utils.escapeHtml(Utils.getStaffName(s.assistSurgeon1) || '—')}</span>
                    <span>🔢 <strong>caseRevision:</strong> v${Number(s.caseRevision || 1)}</span>
                </div>
                <div style="font-size:0.86rem;color:var(--text-primary);">
                    <strong>Chẩn đoán:</strong> ${Utils.escapeHtml(s.diagnosis || '—')} &nbsp;|&nbsp;
                    <strong>Phương pháp:</strong> ${Utils.escapeHtml(s.method || '—')}
                </div>
            </div>

            ${app.returnFeedback ? `
            <div class="sap-alert sap-alert--danger">
                <strong>↩️ BCN yêu cầu bổ sung hồ sơ:</strong>
                ${Utils.escapeHtml([...(app.returnFeedback.chips || []), app.returnFeedback.note || ''].filter(Boolean).join(' • '))}
            </div>` : ''}

            ${app.activeHold ? `
            <div class="sap-alert sap-alert--warning">
                <strong>⏸️ Đang tạm hoãn tại khoa (${Utils.escapeHtml(app.activeHold.holdCategory || '')}):</strong>
                ${Utils.escapeHtml(app.activeHold.holdReason || '')}
            </div>` : ''}

            ${app.invalidationReason ? `
            <div class="sap-alert sap-alert--warning">
                <strong>🔄 Lý do cần xác nhận / duyệt lại:</strong> ${Utils.escapeHtml(app.invalidationReason)}
            </div>` : ''}

            <!-- SECTION 1: C-01..C-03 & Urgency & Column Compliance -->
            <section class="sap-section">
                <div class="sap-section-header">
                    <h3 class="sap-section-title">1️⃣ Phân loại Ca mổ, POD & Kiểm tra Xếp cột (C-01 → C-03)</h3>
                </div>

                <!-- C-01 Ward Room -->
                <div class="sap-field-block">
                    <div class="sap-field-label">
                        C-01. Buồng bệnh điều trị (Tự động suy ra POD)
                        ${pa.suggestedPodId ? `<span class="sap-tag">👉 ${Utils.escapeHtml(this._formatPodLabel(pa.suggestedPodId))}</span>` : ''}
                    </div>
                    <div class="sap-chip-group">
                        ${SAP_WARD_ROOMS.map(rm => {
                            const sel = pa.wardRoom === rm;
                            const label = rm === 'unassigned' ? 'Chưa xếp phòng' : `P.${rm}`;
                            return `<button type="button" class="sap-chip ${sel ? 'sap-chip--selected' : ''}"
                                ${!canEditPrep ? 'disabled' : ''}
                                onclick="SurgeryApprovalPage.selectWardRoom(${s.id}, '${rm}')">${label}</button>`;
                        }).join('')}
                    </div>
                </div>

                <!-- Urgency Level -->
                <div class="sap-field-block">
                    <div class="sap-field-label">Mức độ khẩn cấp ca mổ</div>
                    <div class="sap-chip-group">
                        ${SAP_URGENCY_OPTIONS.map(u => {
                            const sel = urgVal === u.value;
                            return `<button type="button" class="sap-chip ${sel ? 'sap-chip--selected' : ''}"
                                ${!canEditPrep ? 'disabled' : ''}
                                onclick="SurgeryApprovalPage.selectUrgency(${s.id}, '${u.value}')">${Utils.escapeHtml(u.label)}</button>`;
                        }).join('')}
                    </div>
                    ${urgVal === 'semi_urgent' ? `
                    <input type="text" class="sap-input" id="sap-semi-urgent-reason"
                        placeholder="Nhập lý do lâm sàng mổ bán khẩn (bắt buộc tối thiểu 5 ký tự)..."
                        value="${Utils.escapeHtml(cc.semiUrgentClinicalReason || '')}"
                        onchange="SurgeryApprovalPage.patchDraft(${s.id}, { clinicalClassification: { semiUrgentClinicalReason: this.value } })">` : ''}
                </div>

                <!-- C-02 Pathology Group -->
                <div class="sap-field-block">
                    <div class="sap-field-label">
                        C-02. Nhóm bệnh lý chuyên khoa
                        <span class="sap-field-sub">(Viền nét đứt = Gợi ý tự động, chạm 1 lần để xác nhận chính thức)</span>
                    </div>
                    <div class="sap-chip-group">
                        ${SAP_PATHOLOGY_GROUPS.map(g => {
                            const isConf = pgConfirmed === g.value;
                            const isSug = !isConf && pgSuggested === g.value;
                            return `<button type="button"
                                class="sap-chip ${isConf ? 'sap-chip--selected' : (isSug ? 'sap-chip--suggested' : '')}"
                                ${!canEditPrep ? 'disabled' : ''}
                                onclick="SurgeryApprovalPage.selectPathologyGroup(${s.id}, '${g.value}')">
                                ${isConf ? '✓ ' : ''}${Utils.escapeHtml(g.label)}
                                ${isSug ? '<span class="sap-chip-hint">Gợi ý</span>' : ''}
                            </button>`;
                        }).join('')}
                    </div>
                    ${pgConfirmed === 'other_confirmed' ? `
                    <input type="text" class="sap-input" placeholder="Ghi rõ nhóm bệnh lý khác (tối thiểu 10 ký tự)..."
                        value="${Utils.escapeHtml(pg.otherPathologyNote || '')}"
                        onchange="SurgeryApprovalPage.patchDraft(${s.id}, { clinicalClassification: { pathologyGroup: { confirmedValue: 'other_confirmed', otherPathologyNote: this.value } } })">` : ''}
                </div>

                <!-- C-03 Procedure Catalog & Column Compliance -->
                <div class="sap-field-block">
                    <div class="sap-field-label">
                        C-03. Danh mục 309 Phẫu thuật Ngoại tiêu hóa & Hạng phẫu thuật
                        ${pc.confirmedClass
                            ? `<span class="sap-tag">✓ Đã xác nhận: ${Utils.escapeHtml(pc.confirmedClass)} (${Utils.escapeHtml(pc.confirmedCatalogEntryId || 'Thủ công')})</span>`
                            : (pc.suggestedClass ? `<span class="sap-tag">💡 Gợi ý: ${Utils.escapeHtml(pc.suggestedClass)} (${Utils.escapeHtml(pc.suggestedCatalogCode || '')})</span>` : '')}
                    </div>
                    ${selectedEntry && !pc.confirmedCatalogEntryId ? `
                    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:8px 12px;border:1.5px dashed var(--border-strong);border-radius:8px;background:var(--surface-2);">
                        <span style="font-size:0.84rem;">💡 Khớp gợi ý: <strong>[${Utils.escapeHtml(selectedEntry.catalogEntryId)}] ${Utils.escapeHtml(selectedEntry.officialName || selectedEntry.nameVn || '')}</strong> (${Utils.escapeHtml(selectedEntry.procedureClass)})</span>
                        <button type="button" class="sap-btn sap-btn--primary" ${!canEditPrep ? 'disabled' : ''}
                            onclick="SurgeryApprovalPage.selectCatalogEntry(${s.id}, '${selectedEntry.catalogEntryId}', '${selectedEntry.procedureClass}')">
                            ✓ Chạm xác nhận kỹ thuật này
                        </button>
                    </div>` : ''}
                    <input type="search" class="sap-input" placeholder="🔍 Tìm trong 309 kỹ thuật theo tên hoặc mã (VD: cắt trực tràng, rò hậu môn, PTNS-137)..."
                        value="${Utils.escapeHtml(this._catalogQuery)}"
                        oninput="SurgeryApprovalPage.filterCatalogInModal(${s.id}, this.value)">
                    <div class="sap-catalog-results" id="sap-catalog-results-box">
                        ${this._renderCatalogOptionsHtml(s.id, filteredCatalog, pc.confirmedCatalogEntryId, canEditPrep)}
                    </div>
                    ${pc.confirmedClass === 'unclassified' ? `
                    <input type="text" class="sap-input" placeholder="Ghi chú hạng dự kiến cho kỹ thuật chưa phân loại (VD: PT-ĐB theo TT 50)..."
                        value="${Utils.escapeHtml(pc.unclassifiedNote || '')}"
                        onchange="SurgeryApprovalPage.patchDraft(${s.id}, { clinicalClassification: { procedureClass: { unclassifiedNote: this.value } } })">` : ''}

                    <div class="sap-alert ${sysCheckBanner.cls}">${Utils.escapeHtml(sysCheckBanner.text)}</div>

                    <div class="sap-chip-group">
                        ${[
                            { mode: 'within_column', label: 'Đúng cột phẫu thuật' },
                            { mode: 'approved_over_column', label: 'DVKT vượt cột đã được duyệt' },
                            { mode: 'propose_over_column', label: 'Đề xuất vượt cột trình BCN xét duyệt' }
                        ].map(m => {
                            const sel = col.declaredMode === m.mode;
                            return `<button type="button" class="sap-chip ${sel ? 'sap-chip--selected' : ''}"
                                ${!canEditPrep ? 'disabled' : ''}
                                onclick="SurgeryApprovalPage.selectDeclaredMode(${s.id}, '${m.mode}')">
                                ${sel ? '✓ ' : ''}${Utils.escapeHtml(m.label)}
                            </button>`;
                        }).join('')}
                    </div>

                    ${isExternalMain ? `
                    <div class="sap-canary-field" style="margin-top:6px;">
                        <label>BS chính Khoa PTĐTT phụ trách phối hợp liên chuyên khoa (Bắt buộc với PTV ngoài khoa):</label>
                        <select class="sap-select" onchange="SurgeryApprovalPage.patchDraft(${s.id}, { coordinatingAttendingStaffId: parseInt(this.value, 10) || null })">
                            <option value="">— Chọn BS chính Khoa PTĐTT phối hợp —</option>
                            ${attendingStaff.map(st => `<option value="${st.id}" ${Number(s.coordinatingAttendingStaffId) === Number(st.id) ? 'selected' : ''}>${Utils.escapeHtml((st.title ? st.title + ' ' : '') + st.name)}</option>`).join('')}
                        </select>
                    </div>` : ''}
                </div>
            </section>

            <!-- SECTION 2: 1-Tap Clinical Chips C-04..C-07 & Context Modules B1..B4 -->
            <section class="sap-section">
                <div class="sap-section-header">
                    <h3 class="sap-section-title">2️⃣ Chip Lâm sàng 1-Chạm (C-04 → C-07) & Dữ liệu Chuyên biệt</h3>
                </div>

                <!-- C-04 Comorbidities -->
                <div class="sap-field-block">
                    <div class="sap-field-label">C-04. Bệnh nền nội khoa đáng chú ý</div>
                    <div class="sap-chip-group">
                        ${SAP_COMORBIDITIES.map(c => {
                            const vals = chips.comorbidities?.values || [];
                            const sel = Boolean(chips.comorbidities?.confirmed) && vals.includes(c.value);
                            return `<button type="button" class="sap-chip ${sel ? 'sap-chip--selected' : ''}"
                                ${!canEditPrep ? 'disabled' : ''}
                                onclick="SurgeryApprovalPage.toggleComorbidity(${s.id}, '${c.value}')">
                                ${sel ? '✓ ' : ''}${Utils.escapeHtml(c.label)}
                            </button>`;
                        }).join('')}
                    </div>
                    ${(chips.comorbidities?.values || []).includes('other') ? `
                    <input type="text" class="sap-input" placeholder="Ghi rõ bệnh nền khác..."
                        value="${Utils.escapeHtml(chips.comorbidities?.otherComorbidityNote || '')}"
                        onchange="SurgeryApprovalPage.patchComorbidityNote(${s.id}, this.value)">` : ''}
                </div>

                <!-- C-05 Antithrombotic -->
                <div class="sap-field-block">
                    <div class="sap-field-label">C-05. Thuốc chống huyết khối (Kháng kết tập tiểu cầu / Kháng đông)</div>
                    <div class="sap-chip-group">
                        ${SAP_ANTITHROMBOTIC_MODES.map(a => {
                            const sel = Boolean(chips.antithromboticPlan?.confirmed) && chips.antithromboticPlan?.mode === a.value;
                            return `<button type="button" class="sap-chip ${sel ? 'sap-chip--selected' : ''}"
                                ${!canEditPrep ? 'disabled' : ''}
                                onclick="SurgeryApprovalPage.selectAntithromboticMode(${s.id}, '${a.value}')">
                                ${sel ? '✓ ' : ''}${Utils.escapeHtml(a.label)}
                            </button>`;
                        }).join('')}
                    </div>
                    ${chips.antithromboticPlan?.confirmed && chips.antithromboticPlan?.mode && chips.antithromboticPlan.mode !== 'none_confirmed' ? `
                    <div class="sap-canary-grid" style="margin-top:6px;">
                        <input type="text" class="sap-input" placeholder="Tên thuốc & liều (VD: Aspirin 81mg, Rivaroxaban...)"
                            value="${Utils.escapeHtml(chips.antithromboticPlan.drugName || '')}"
                            onchange="SurgeryApprovalPage.patchAntithromboticField(${s.id}, 'drugName', this.value)">
                        ${chips.antithromboticPlan.mode === 'bridging_per_plan' ? `
                        <input type="text" class="sap-input" placeholder="Thuốc bắc cầu (VD: Enoxaparin 40mg)..."
                            value="${Utils.escapeHtml(chips.antithromboticPlan.bridgingAgent || '')}"
                            onchange="SurgeryApprovalPage.patchAntithromboticField(${s.id}, 'bridgingAgent', this.value)">` : ''}
                        ${['held_per_plan', 'bridging_per_plan', 'unheld_urgent_risk'].includes(chips.antithromboticPlan.mode) ? `
                        <input type="text" class="sap-input" placeholder="Thời điểm liều cuối (VD: Ngưng trước mổ 5 ngày)..."
                            value="${Utils.escapeHtml(chips.antithromboticPlan.lastDoseAt || '')}"
                            onchange="SurgeryApprovalPage.patchAntithromboticField(${s.id}, 'lastDoseAt', this.value)">` : ''}
                        <input type="text" class="sap-input" placeholder="BS / Chuyên khoa duyệt (VD: HC Tim mạch / Gây mê)..."
                            value="${Utils.escapeHtml(chips.antithromboticPlan.approvingSpecialtyOrDoctor || '')}"
                            onchange="SurgeryApprovalPage.patchAntithromboticField(${s.id}, 'approvingSpecialtyOrDoctor', this.value)">
                        ${['continued_per_plan', 'unheld_urgent_risk'].includes(chips.antithromboticPlan.mode) ? `
                        <input type="text" class="sap-input" placeholder="Kế hoạch cầm máu / dự phòng chảy máu..."
                            value="${Utils.escapeHtml(chips.antithromboticPlan.planReferenceNote || '')}"
                            onchange="SurgeryApprovalPage.patchAntithromboticField(${s.id}, 'planReferenceNote', this.value)">` : ''}
                    </div>` : ''}
                </div>

                <!-- C-06 Blood & Special Devices -->
                <div class="sap-field-block">
                    <div class="sap-field-label">C-06. Dự trù Máu & Thiết bị đặc thù</div>
                    <div class="sap-chip-group">
                        ${SAP_BLOOD_DEVICES.filter(b => !(isRobot && b.value === 'basic_instruments_only')).map(b => {
                            const vals = chips.bloodAndDevices?.values || [];
                            const sel = Boolean(chips.bloodAndDevices?.confirmed) && vals.includes(b.value);
                            return `<button type="button" class="sap-chip ${sel ? 'sap-chip--selected' : ''}"
                                ${!canEditPrep ? 'disabled' : ''}
                                onclick="SurgeryApprovalPage.toggleBloodDevice(${s.id}, '${b.value}')">
                                ${sel ? '✓ ' : ''}${Utils.escapeHtml(b.label)}
                            </button>`;
                        }).join('')}
                    </div>
                </div>

                <!-- C-07 Stoma Plan -->
                <div class="sap-field-block">
                    <div class="sap-field-label">C-07. Kế hoạch Hậu môn nhân tạo (HMNT)</div>
                    <div class="sap-chip-group">
                        ${SAP_STOMA_PLANS.map(st => {
                            const sel = Boolean(chips.stomaPlan?.confirmed) && chips.stomaPlan?.value === st.value;
                            return `<button type="button" class="sap-chip ${sel ? 'sap-chip--selected' : ''}"
                                ${!canEditPrep ? 'disabled' : ''}
                                onclick="SurgeryApprovalPage.selectStomaPlan(${s.id}, '${st.value}')">
                                ${sel ? '✓ ' : ''}${Utils.escapeHtml(st.label)}
                            </button>`;
                        }).join('')}
                    </div>
                </div>

                ${this._renderContextModulesHtml(s, pgConfirmed, chips, ctx, canEditPrep)}
            </section>

            <!-- SECTION 3: Pre-op Checklist CK-01..CK-08 (Zero ASA!) -->
            <section class="sap-section">
                <div class="sap-section-header">
                    <h3 class="sap-section-title">3️⃣ Bảng kiểm An toàn Hồ sơ Trước mổ (CK-01 → CK-08)</h3>
                    <div style="display:flex;flex-wrap:wrap;gap:8px;">
                        <button type="button" class="sap-btn sap-btn--primary" ${!canEditPrep ? 'disabled' : ''}
                            onclick="SurgeryApprovalPage.runBulkConfirm(${s.id})">
                            ⚡ Xác nhận nhanh các mục thường quy
                        </button>
                        ${s._bulkUndoSnapshot ? `
                        <button type="button" class="sap-btn" ${!canEditPrep ? 'disabled' : ''}
                            onclick="SurgeryApprovalPage.runUndoBulkConfirm(${s.id})">
                            ↩️ Hoàn tác xác nhận nhanh
                        </button>` : ''}
                    </div>
                </div>

                <div class="sap-ck-list">
                    ${SAP_CK_ITEMS.filter(i => !i.attendingOnly).map(item => this._renderChecklistRowHtml(s, item, ck[item.code] || {}, isTrainee, canEditPrep)).join('')}
                </div>

                <!-- Visually separated Attending-Only Box for CK-04 & CK-08 -->
                <div class="sap-section sap-section--attending">
                    <div class="sap-section-header">
                        <h4 class="sap-section-title">🔏 Khu vực Xác nhận Trách nhiệm của Bác sĩ Chính (CK-04 & CK-08)</h4>
                        ${isTrainee ? '<span class="sap-tag">🔒 Khóa với BS học viên</span>' : ''}
                    </div>
                    <div class="sap-ck-list">
                        ${SAP_CK_ITEMS.filter(i => i.attendingOnly).map(item => this._renderChecklistRowHtml(s, item, ck[item.code] || {}, isTrainee, canEditPrep && !isTrainee)).join('')}
                    </div>
                </div>
            </section>

            ${this._renderActionDrawerHtml(s, actor)}
            ${this._renderModalFooterActionsHtml(s, actor, status)}
        </div>`;
    },

    _renderCatalogOptionsHtml(sid, items, confirmedId, canEditPrep) {
        if (!items || items.length === 0) {
            return `<div style="padding:10px 12px;font-size:0.82rem;color:var(--text-secondary);">Không tìm thấy kỹ thuật khớp từ khóa.</div>`;
        }
        return items.map(p => {
            const isSel = confirmedId === p.catalogEntryId;
            return `
            <button type="button" class="sap-catalog-option ${isSel ? 'is-selected' : ''}"
                ${!canEditPrep ? 'disabled' : ''}
                onclick="SurgeryApprovalPage.selectCatalogEntry(${sid}, '${p.catalogEntryId}', '${p.procedureClass}')">
                <span><strong>[${Utils.escapeHtml(p.catalogEntryId)}]</strong> ${Utils.escapeHtml(p.officialName || p.nameVn || '')}</span>
                <span class="sap-tag">${Utils.escapeHtml(p.procedureClass === 'unclassified' ? 'Chưa phân loại' : p.procedureClass)}</span>
            </button>`;
        }).join('');
    },

    _renderContextModulesHtml(s, pgConfirmed, chips, ctx, canEditPrep) {
        let html = '';
        const stomaVal = chips.stomaPlan?.value;

        // B1: Benign Anorectal (includes mandatory 'Đã chụp MRI đường rò' chip!)
        if (pgConfirmed === 'benign_anorectal') {
            const b1 = ctx.fistulaContext || {};
            html += `
            <div class="sap-case-banner">
                <div class="sap-field-label">🔎 Module B1 — Bệnh lý Lành tính Hậu môn – Trực tràng</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'not_fistula', l: 'Không phải rò hậu môn (Trĩ / Nứt kẽ / Áp-xe...)' },
                        { v: 'simple_fistula', l: 'Rò hậu môn đơn giản / thấp' },
                        { v: 'complex_or_recurrent_fistula', l: 'Rò hậu môn phức tạp / tái phát / xuyên cơ thắt cao' }
                    ].map(o => `<button type="button" class="sap-chip ${b1.fistulaClassification === o.v ? 'sap-chip--selected' : ''}"
                        ${!canEditPrep ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.patchContext(${s.id}, 'fistulaContext', { fistulaClassification: '${o.v}' })">${o.l}</button>`).join('')}
                </div>
                ${['simple_fistula', 'complex_or_recurrent_fistula'].includes(b1.fistulaClassification) ? `
                <div class="sap-field-label" style="margin-top:6px;">Hình ảnh học đường rò trước mổ:</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'mri_fistula_done', l: 'Đã chụp MRI đường rò' },
                        { v: 'endoanal_us_done', l: 'Đã siêu âm lòng hậu môn – trực tràng' },
                        { v: 'not_indicated_simple', l: 'Rò đơn giản khám rõ lỗ trong (không chỉ định MRI)' }
                    ].map(o => `<button type="button" class="sap-chip ${b1.fistulaImaging === o.v ? 'sap-chip--selected' : ''}"
                        ${!canEditPrep ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.patchContext(${s.id}, 'fistulaContext', { fistulaImaging: '${o.v}' })">${o.l}</button>`).join('')}
                </div>
                ${b1.fistulaClassification === 'complex_or_recurrent_fistula' && b1.fistulaImaging === 'not_indicated_simple' ? `
                <input type="text" class="sap-input" placeholder="Lý do rò phức tạp chưa chụp MRI đường rò..."
                    value="${Utils.escapeHtml(b1.missingMriReason || '')}"
                    onchange="SurgeryApprovalPage.patchContext(${s.id}, 'fistulaContext', { missingMriReason: this.value })">` : ''}` : ''}
            </div>`;
        }

        // B2: Benign Colorectal Abdominal or Stoma Closure
        if (pgConfirmed === 'benign_colorectal_abdominal' || stomaVal === 'stoma_closure') {
            const b2 = ctx.benignAbdominalContext || {};
            html += `
            <div class="sap-case-banner">
                <div class="sap-field-label">🔎 Module B2 — Lành tính Đại trực tràng – Ổ bụng / Đóng HMNT</div>
                ${pgConfirmed === 'benign_colorectal_abdominal' ? `
                <div class="sap-chip-group">
                    ${[
                        { v: 'diverticular_or_ibd', l: 'Túi thừa / Viêm ruột mạn' },
                        { v: 'rectal_prolapse_pelvic', l: 'Sa trực tràng / Sàn chậu' },
                        { v: 'benign_obstruction_adhesion', l: 'Dính ruột / Tắc ruột lành tính' },
                        { v: 'stoma_management', l: 'Đóng / Tạo hình HMNT' },
                        { v: 'other_benign_abd', l: 'Bệnh lành tính ổ bụng khác' }
                    ].map(o => `<button type="button" class="sap-chip ${b2.subType === o.v ? 'sap-chip--selected' : ''}"
                        ${!canEditPrep ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.patchContext(${s.id}, 'benignAbdominalContext', { subType: '${o.v}' })">${o.l}</button>`).join('')}
                </div>
                <div class="sap-field-label" style="margin-top:6px;">Kế hoạch chuẩn bị đại tràng:</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'mechanical_prep_planned', l: 'Chuẩn bị đại tràng cơ học + KS' },
                        { v: 'enema_only', l: 'Thụt tháo trực tràng' },
                        { v: 'no_prep_indicated', l: 'Không thụt rửa (theo ERAS / tắc ruột)' }
                    ].map(o => `<button type="button" class="sap-chip ${b2.bowelPrepPlan === o.v ? 'sap-chip--selected' : ''}"
                        ${!canEditPrep ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.patchContext(${s.id}, 'benignAbdominalContext', { bowelPrepPlan: '${o.v}' })">${o.l}</button>`).join('')}
                </div>` : ''}
                ${stomaVal === 'stoma_closure' ? `
                <div class="sap-field-label" style="margin-top:6px;">Kiểm tra lưu thông đầu dưới trước đóng HMNT (Bắt buộc):</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'endoscopy_or_contrast_patent', l: '✓ Nội soi / Chụp cản quang đầu dưới thông tốt' },
                        { v: 'stricture_planned_resection', l: 'Hẹp miệng nối — Đã lên phương án cắt nối lại' }
                    ].map(o => `<button type="button" class="sap-chip ${b2.distalLimbCheck === o.v ? 'sap-chip--selected' : ''}"
                        ${!canEditPrep ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.patchContext(${s.id}, 'benignAbdominalContext', { distalLimbCheck: '${o.v}' })">${o.l}</button>`).join('')}
                </div>` : ''}
            </div>`;
        }

        // B3: Confirmed Cancer
        if (pgConfirmed === 'cancer_confirmed') {
            const b3 = ctx.cancerContext || {};
            const locs = b3.tumorLocation || [];
            const stg = b3.clinicalStage || {};
            const isRectal = locs.some(l => String(l).startsWith('rectum_') || l === 'anal_canal');
            const hasUnknownStage = ['Tx', 'Nx', 'Mx'].some(x => [stg.cT, stg.cN, stg.cM].includes(x));
            html += `
            <div class="sap-case-banner">
                <div class="sap-field-label">
                    🔎 Module B3 — Bilan Ung thư Đại trực tràng – Ống hậu môn
                    ${b3.isSynchronousMultiSite ? '<span class="sap-tag">⚡ U đồng thời đa ổ (Synchronous)</span>' : ''}
                </div>
                <div class="sap-field-label">Vị trí u (chọn được nhiều vị trí nếu u đồng thời):</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'right_colon', l: 'Đại tràng phải' },
                        { v: 'transverse_colon', l: 'Đại tràng ngang' },
                        { v: 'left_colon', l: 'Đại tràng trái' },
                        { v: 'sigmoid', l: 'Đại tràng Sigma' },
                        { v: 'rectum_upper', l: 'Trực tràng cao' },
                        { v: 'rectum_mid', l: 'Trực tràng giữa' },
                        { v: 'rectum_low', l: 'Trực tràng thấp' },
                        { v: 'anal_canal', l: 'Ống hậu môn' }
                    ].map(o => `<button type="button" class="sap-chip ${locs.includes(o.v) ? 'sap-chip--selected' : ''}"
                        ${!canEditPrep ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.toggleCancerLocation(${s.id}, '${o.v}')">${o.l}</button>`).join('')}
                </div>

                <div class="sap-canary-grid" style="margin-top:6px;">
                    <div class="sap-canary-field">
                        <label>Giải phẫu bệnh trước mổ</label>
                        <select class="sap-select" onchange="SurgeryApprovalPage.patchContext(${s.id}, 'cancerContext', { preopHistology: this.value })">
                            <option value="">— Chọn GPB —</option>
                            <option value="adenocarcinoma" ${b3.preopHistology === 'adenocarcinoma' ? 'selected' : ''}>Carcinoma tuyến</option>
                            <option value="mucinous_signet" ${b3.preopHistology === 'mucinous_signet' ? 'selected' : ''}>Carcinoma nhầy / tế bào nhẫn</option>
                            <option value="squamous_carcinoma" ${b3.preopHistology === 'squamous_carcinoma' ? 'selected' : ''}>Carcinoma tế bào gai</option>
                            <option value="other_malignant" ${b3.preopHistology === 'other_malignant' ? 'selected' : ''}>Ác tính khác</option>
                        </select>
                    </div>
                    <div class="sap-canary-field">
                        <label>cT / ycT</label>
                        <select class="sap-select" onchange="SurgeryApprovalPage.patchCancerStage(${s.id}, 'cT', this.value)">
                            <option value="">— cT —</option>
                            ${['T1', 'T2', 'T3', 'T4a', 'T4b', 'Tx'].map(v => `<option value="${v}" ${stg.cT === v ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>
                    </div>
                    <div class="sap-canary-field">
                        <label>cN / ycN</label>
                        <select class="sap-select" onchange="SurgeryApprovalPage.patchCancerStage(${s.id}, 'cN', this.value)">
                            <option value="">— cN —</option>
                            ${['N0', 'N1', 'N2', 'Nx'].map(v => `<option value="${v}" ${stg.cN === v ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>
                    </div>
                    <div class="sap-canary-field">
                        <label>cM</label>
                        <select class="sap-select" onchange="SurgeryApprovalPage.patchCancerStage(${s.id}, 'cM', this.value)">
                            <option value="">— cM —</option>
                            ${['M0', 'M1a', 'M1b', 'M1c', 'Mx'].map(v => `<option value="${v}" ${stg.cM === v ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>
                    </div>
                </div>
                ${hasUnknownStage ? `
                <input type="text" class="sap-input" placeholder="Ghi rõ lý do chọn Tx / Nx / Mx..."
                    value="${Utils.escapeHtml(stg.stagingNote || '')}"
                    onchange="SurgeryApprovalPage.patchCancerStage(${s.id}, 'stagingNote', this.value)">` : ''}

                ${isRectal ? `
                <div class="sap-field-label" style="margin-top:6px;">Diện cắt vòng quanh (CRM) trên MRI tiểu khung (Bắt buộc cho K trực tràng/ống HM):</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'crm_clear', l: 'CRM âm tính (an toàn > 1mm)' },
                        { v: 'crm_threatened_or_positive', l: 'CRM đe dọa / dương tính (≤ 1mm)' },
                        { v: 'unknown_no_pelvic_mri', l: 'Chưa đánh giá được MRI chậu (ghi lý do)' }
                    ].map(o => `<button type="button" class="sap-chip ${b3.crmStatus === o.v ? 'sap-chip--selected' : ''}"
                        ${!canEditPrep ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.patchContext(${s.id}, 'cancerContext', { crmStatus: '${o.v}' })">${o.l}</button>`).join('')}
                </div>
                ${b3.crmStatus === 'unknown_no_pelvic_mri' ? `
                <input type="text" class="sap-input" placeholder="Ghi chú lý do chưa có MRI tiểu khung..."
                    value="${Utils.escapeHtml(b3.crmNote || '')}"
                    onchange="SurgeryApprovalPage.patchContext(${s.id}, 'cancerContext', { crmNote: this.value })">` : ''}` : ''}

                <div class="sap-canary-grid" style="margin-top:6px;">
                    <div class="sap-canary-field">
                        <label>Điều trị đa mô thức trước mổ</label>
                        <select class="sap-select" onchange="SurgeryApprovalPage.patchContext(${s.id}, 'cancerContext', { multimodalStatus: this.value })">
                            <option value="">— Chọn —</option>
                            <option value="upfront_surgery" ${b3.multimodalStatus === 'upfront_surgery' ? 'selected' : ''}>Phẫu thuật kỳ đầu (Upfront)</option>
                            <option value="post_tnt_crt" ${b3.multimodalStatus === 'post_tnt_crt' ? 'selected' : ''}>Sau hóa xạ tiền phẫu / TNT</option>
                            <option value="post_neoadjuvant_chemo" ${b3.multimodalStatus === 'post_neoadjuvant_chemo' ? 'selected' : ''}>Sau hóa trị tân bổ trợ</option>
                        </select>
                    </div>
                    <div class="sap-canary-field">
                        <label>Hội chẩn Ung bướu / MDT</label>
                        <select class="sap-select" onchange="SurgeryApprovalPage.patchContext(${s.id}, 'cancerContext', { mdtReviewStatus: this.value })">
                            <option value="">— Chọn —</option>
                            <option value="mdt_completed" ${b3.mdtReviewStatus === 'mdt_completed' ? 'selected' : ''}>Đã thông qua Hội chẩn MDT</option>
                            <option value="standard_guideline_no_mdt_needed" ${b3.mdtReviewStatus === 'standard_guideline_no_mdt_needed' ? 'selected' : ''}>Đúng phác đồ chuẩn thường quy</option>
                        </select>
                    </div>
                </div>
            </div>`;
        }

        // B4: Suspected / Special Neoplasm (GIST, NET, submucosal, failed biopsy)
        if (pgConfirmed === 'neoplasm_suspected_or_special') {
            const b4 = ctx.specialNeoplasmContext || {};
            html += `
            <div class="sap-case-banner">
                <div class="sap-field-label">🔎 Module B4 — U tân sinh đặc thù / Nghi ác tính chưa có GPB</div>
                <div class="sap-canary-grid">
                    <div class="sap-canary-field">
                        <label>Phân nhóm tổn thương</label>
                        <select class="sap-select" onchange="SurgeryApprovalPage.patchContext(${s.id}, 'specialNeoplasmContext', { neoplasmCategory: this.value })">
                            <option value="">— Chọn —</option>
                            <option value="gist_submucosal" ${b4.neoplasmCategory === 'gist_submucosal' ? 'selected' : ''}>U mô đệm GIST / U dưới niêm</option>
                            <option value="neuroendocrine_net" ${b4.neoplasmCategory === 'neuroendocrine_net' ? 'selected' : ''}>U thần kinh nội tiết (NET)</option>
                            <option value="presacral_retroperitoneal" ${b4.neoplasmCategory === 'presacral_retroperitoneal' ? 'selected' : ''}>U trước xương cùng / Sau phúc mạc</option>
                            <option value="suspected_cancer_stenotic" ${b4.neoplasmCategory === 'suspected_cancer_stenotic' ? 'selected' : ''}>U đại trực tràng nghi K chít hẹp</option>
                        </select>
                    </div>
                    <div class="sap-canary-field">
                        <label>Tình trạng sinh thiết trước mổ</label>
                        <select class="sap-select" onchange="SurgeryApprovalPage.patchContext(${s.id}, 'specialNeoplasmContext', { biopsyStatus: this.value })">
                            <option value="">— Chọn —</option>
                            <option value="biopsy_confirmed_special" ${b4.biopsyStatus === 'biopsy_confirmed_special' ? 'selected' : ''}>Đã có GPB / Hóa mô miễn dịch</option>
                            <option value="submucosal_not_biopsied" ${b4.biopsyStatus === 'submucosal_not_biopsied' ? 'selected' : ''}>U dưới niêm / Ngoài thành (không chỉ định sinh thiết xuyên niêm)</option>
                            <option value="stenotic_or_bleeding_failed_biopsy" ${b4.biopsyStatus === 'stenotic_or_bleeding_failed_biopsy' ? 'selected' : ''}>Sinh thiết âm tính giả / Chít hẹp không qua được ống soi</option>
                        </select>
                    </div>
                    <div class="sap-canary-field">
                        <label>Đánh giá lan rộng trên CT/MRI</label>
                        <select class="sap-select" onchange="SurgeryApprovalPage.patchContext(${s.id}, 'specialNeoplasmContext', { extentEvaluation: this.value })">
                            <option value="">— Chọn —</option>
                            <option value="localized_resectable" ${b4.extentEvaluation === 'localized_resectable' ? 'selected' : ''}>Khu trú — Cắt trọn R0 khả thi</option>
                            <option value="locally_advanced_multivisceral" ${b4.extentEvaluation === 'locally_advanced_multivisceral' ? 'selected' : ''}>Xâm lấn tạng lân cận — Đã dự trù phối hợp</option>
                        </select>
                    </div>
                    <div class="sap-canary-field">
                        <label>Hội chẩn chuyên môn</label>
                        <select class="sap-select" onchange="SurgeryApprovalPage.patchContext(${s.id}, 'specialNeoplasmContext', { mdtReviewStatus: this.value })">
                            <option value="">— Chọn —</option>
                            <option value="mdt_completed" ${b4.mdtReviewStatus === 'mdt_completed' ? 'selected' : ''}>Đã hội chẩn khoa / MDT</option>
                            <option value="standard_guideline_no_mdt_needed" ${b4.mdtReviewStatus === 'standard_guideline_no_mdt_needed' ? 'selected' : ''}>Theo chỉ định chuẩn chuyên khoa</option>
                        </select>
                    </div>
                </div>
                ${b4.biopsyStatus === 'stenotic_or_bleeding_failed_biopsy' ? `
                <input type="text" class="sap-input" placeholder="Ghi rõ lý do chưa có GPB dương tính trước mổ..."
                    value="${Utils.escapeHtml(b4.missingBiopsyReason || '')}"
                    onchange="SurgeryApprovalPage.patchContext(${s.id}, 'specialNeoplasmContext', { missingBiopsyReason: this.value })">` : ''}
            </div>`;
        }

        return html;
    },

    _renderChecklistRowHtml(s, def, item, isTrainee, canToggle) {
        const st = item.state || 'unverified';
        const subs = item.subChecks || {};
        const pgConfirmed = s.clinicalClassification?.pathologyGroup?.confirmedValue || null;
        const confClass = s.clinicalClassification?.procedureClass?.confirmedClass || null;
        const canMinorAnorectalNA = Boolean(
            def.allowMinorAnorectalNA
            && pgConfirmed === 'benign_anorectal'
            && ['PT-II', 'PT-III'].includes(confClass)
        );
        const canBenignOnlyNA = def.code === 'CK-05'
            ? ['benign_anorectal', 'benign_colorectal_abdominal', 'other_confirmed'].includes(pgConfirmed)
            : Boolean(def.allowNotApplicable);
        const showNaBtn = !isTrainee && (
            canBenignOnlyNA
            || Boolean(def.allowNotIndicatedWithReason)
            || canMinorAnorectalNA
        );
        const targetNaState = def.naState || (def.code === 'CK-05' || def.code === 'CK-04' ? 'not_applicable' : 'not_indicated');
        const naLabel = targetNaState === 'not_applicable' ? '➖ Không áp dụng' : '➖ Không chỉ định';

        return `
        <div class="sap-ck-row" data-ck-code="${def.code}">
            <div class="sap-ck-main">
                <div class="sap-ck-info">
                    <div>
                        <span class="sap-ck-code">${def.code}</span>
                        <span class="sap-ck-title">${Utils.escapeHtml(def.title)}</span>
                    </div>
                    <div class="sap-ck-desc">${Utils.escapeHtml(def.desc)}</div>
                </div>
                <div class="sap-ck-controls">
                    ${isTrainee && !def.attendingOnly ? `
                    <button type="button" class="sap-ck-btn ${st === 'prepared_ok' ? 'is-active-prep' : ''}"
                        ${!canToggle ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.setChecklistState(${s.id}, '${def.code}', 'prepared_ok')">
                        🩺 HV đã rà
                    </button>` : ''}
                    ${!isTrainee ? `
                    <button type="button" class="sap-ck-btn ${st === 'verified_ok' ? 'is-active-ok' : ''}"
                        ${!canToggle ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.setChecklistState(${s.id}, '${def.code}', 'verified_ok')">
                        ✅ Đạt
                    </button>
                    <button type="button" class="sap-ck-btn ${st === 'verified_abnormal_planned' ? 'is-active-warn' : ''}"
                        ${!canToggle ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.setChecklistState(${s.id}, '${def.code}', 'verified_abnormal_planned')">
                        ⚠️ Bất thường có phương án
                    </button>` : ''}
                    ${showNaBtn ? `
                    <button type="button" class="sap-ck-btn ${['not_applicable', 'not_indicated'].includes(st) ? 'is-active-na' : ''}"
                        ${!canToggle ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.setChecklistState(${s.id}, '${def.code}', '${targetNaState}')">
                        ${naLabel}
                    </button>` : ''}
                </div>
            </div>
            ${st === 'verified_abnormal_planned' || (def.code === 'CK-01' && st === 'not_indicated') ? `
            <input type="text" class="sap-input" placeholder="${def.code === 'CK-01' && st === 'not_indicated' ? 'Ghi rõ lý do không chỉ định XN tiền phẫu (bắt buộc tối thiểu 5 ký tự)...' : `Ghi rõ bất thường & phương án xử trí chu phẫu cho ${def.code}...`}"
                value="${Utils.escapeHtml(item.clinicalPlanNote || '')}"
                onchange="SurgeryApprovalPage.setChecklistPlanNote(${s.id}, '${def.code}', this.value)">` : ''}
            ${def.hasSubChecks ? `
            <div class="sap-subchecks-grid">
                ${Object.entries(SAP_SUBCHECK_LABELS).map(([subKey, subLabel]) => {
                    const sv = subs[subKey] || 'unverified';
                    const okVal = isTrainee ? 'prepared_ok' : 'verified_ok';
                    return `
                    <div class="sap-subcheck-item">
                        <span class="sap-subcheck-label">${Utils.escapeHtml(subLabel)}</span>
                        <div style="display:flex;flex-wrap:wrap;gap:6px;">
                            <button type="button" class="sap-ck-btn ${['verified_ok', 'prepared_ok', 'ready_for_preanesthesia'].includes(sv) ? 'is-active-ok' : ''}"
                                ${!canToggle ? 'disabled' : ''}
                                onclick="SurgeryApprovalPage.setSubCheckState(${s.id}, '${subKey}', '${okVal}')">
                                ${isTrainee ? '🩺 Đã rà' : '✓ Đạt'}
                            </button>
                            ${!isTrainee && subKey !== 'preAnesthesiaExam' ? `
                            <button type="button" class="sap-ck-btn ${sv === 'not_indicated' ? 'is-active-na' : ''}"
                                ${!canToggle ? 'disabled' : ''}
                                onclick="SurgeryApprovalPage.setSubCheckState(${s.id}, '${subKey}', 'not_indicated')">
                                K.Chỉ định
                            </button>` : ''}
                        </div>
                    </div>`;
                }).join('')}
            </div>` : ''}
        </div>`;
    },

    // ── Draft & 1-Tap Chip / Checklist Mutation Handlers ──
    _getCaseById(sid) {
        return (Store._data?.surgeries || []).find(x => Number(x.id) === Number(sid)) || null;
    },

    async patchDraft(sid, draftPatch) {
        const s = this._getCaseById(sid);
        if (!s) return;
        this._lastGateErrors = null;
        try {
            const body = Object.assign({ expectedCaseRevision: Number(s.caseRevision || 1) }, draftPatch);
            const res = await this._api(
                `/api/surgery-approval/${sid}/draft`,
                'POST',
                body,
                { allowSimulation: Boolean(s.isTestSandboxCase) }
            );
            if (res && res.surgery) {
                this._syncSurgeryInStore(res.surgery);
                this._refreshOpenModal(sid);
            }
        } catch (err) {
            Toast.error(err.message);
            this._refreshOpenModal(sid);
        }
    },

    selectWardRoom(sid, room) {
        return this.patchDraft(sid, { podAssignment: { wardRoom: room } });
    },

    selectUrgency(sid, urg) {
        if (urg === 'emergency_exception') {
            this.openActionDrawer(sid, 'emergency');
            return;
        }
        return this.patchDraft(sid, { clinicalClassification: { urgencyLevel: urg } });
    },

    selectPathologyGroup(sid, newGroup) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const oldGroup = s.clinicalClassification?.pathologyGroup?.confirmedValue;
        const existingCtx = s.clinicalChips?.contextChips || {};
        if (oldGroup && oldGroup !== 'unknown' && oldGroup !== newGroup && Object.keys(existingCtx).length > 0) {
            this._pendingNewGroup = newGroup;
            this.openActionDrawer(sid, 'change_group');
            return;
        }
        return this.patchDraft(sid, {
            clinicalClassification: {
                pathologyGroup: { confirmedValue: newGroup }
            }
        });
    },

    async confirmPathologyGroupChange(sid) {
        const reasonEl = document.getElementById('sap-group-change-reason');
        const reason = (reasonEl ? reasonEl.value : '').trim();
        if (reason.length < 5) {
            Toast.error('Vui lòng nhập lý do chuyển nhóm bệnh lý (tối thiểu 5 ký tự).');
            return;
        }
        const targetGroup = this._pendingNewGroup;
        this._activeActionDrawer = null;
        this._pendingNewGroup = null;
        await this.patchDraft(sid, {
            groupChangeReason: reason,
            clinicalClassification: {
                pathologyGroup: { confirmedValue: targetGroup, groupChangeReason: reason }
            }
        });
    },

    filterCatalogInModal(sid, query) {
        this._catalogQuery = query || '';
        const s = this._getCaseById(sid);
        const box = document.getElementById('sap-catalog-results-box');
        if (!s || !box) return;
        const actor = this.getEffectiveActor(s);
        const canEditPrep = SAP_TRAINEE_IDS.has(actor.staffId) || SAP_ATTENDING_IDS.has(actor.staffId) || SAP_BCN_IDS.has(actor.staffId) || actor.isSuperAdmin;
        const catalogProcs = (this._catalogData?.procedures || []).filter(p => {
            const grp = p.approachGroup || p.sheetApproach;
            if (s.approachType === 'mo') return grp === 'mo';
            if (s.approachType === 'noisoi' || s.approachType === 'robot') return grp === 'noisoi';
            return true;
        });
        const cq = this._catalogQuery.trim().toLowerCase();
        const filtered = (cq
            ? catalogProcs.filter(p => `${p.catalogEntryId} ${p.officialName || p.nameVn || ''} ${p.procedureClass}`.toLowerCase().includes(cq))
            : catalogProcs.slice(0, 12)
        ).slice(0, 25);
        const confirmedId = s.clinicalClassification?.procedureClass?.confirmedCatalogEntryId;
        box.innerHTML = this._renderCatalogOptionsHtml(sid, filtered, confirmedId, canEditPrep);
    },

    selectCatalogEntry(sid, entryId, procClass) {
        return this.patchDraft(sid, {
            clinicalClassification: {
                procedureClass: {
                    confirmedCatalogEntryId: entryId,
                    confirmedClass: procClass
                }
            }
        });
    },

    selectDeclaredMode(sid, mode) {
        return this.patchDraft(sid, {
            clinicalClassification: {
                columnCompliance: { declaredMode: mode }
            }
        });
    },

    toggleComorbidity(sid, val) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const cur = s.clinicalChips?.comorbidities || {};
        const prevVals = (cur.confirmed && Array.isArray(cur.values)) ? cur.values.slice() : [];
        let nextVals;
        if (val === 'none') {
            nextVals = prevVals.includes('none') ? [] : ['none'];
        } else {
            nextVals = prevVals.filter(x => x !== 'none');
            if (nextVals.includes(val)) {
                nextVals = nextVals.filter(x => x !== val);
            } else {
                nextVals.push(val);
            }
        }
        return this.patchDraft(sid, {
            clinicalChips: {
                comorbidities: {
                    confirmed: nextVals.length > 0,
                    values: nextVals,
                    otherComorbidityNote: cur.otherComorbidityNote || ''
                }
            }
        });
    },

    patchComorbidityNote(sid, note) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const cur = s.clinicalChips?.comorbidities || {};
        const vals = Array.isArray(cur.values) ? cur.values : ['other'];
        return this.patchDraft(sid, {
            clinicalChips: {
                comorbidities: {
                    confirmed: vals.length > 0,
                    values: vals,
                    otherComorbidityNote: note || ''
                }
            }
        });
    },

    selectAntithromboticMode(sid, mode) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const cur = s.clinicalChips?.antithromboticPlan || {};
        return this.patchDraft(sid, {
            clinicalChips: {
                antithromboticPlan: {
                    confirmed: true,
                    mode,
                    drugName: mode === 'none_confirmed' ? '' : (cur.drugName || ''),
                    bridgingAgent: mode === 'bridging_per_plan' ? (cur.bridgingAgent || '') : '',
                    lastDoseAt: mode === 'none_confirmed' ? '' : (cur.lastDoseAt || ''),
                    approvingSpecialtyOrDoctor: mode === 'none_confirmed' ? '' : (cur.approvingSpecialtyOrDoctor || ''),
                    planReferenceNote: mode === 'none_confirmed' ? '' : (cur.planReferenceNote || '')
                }
            }
        });
    },

    patchAntithromboticField(sid, key, val) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const cur = Object.assign({ confirmed: true, mode: 'held_per_plan' }, s.clinicalChips?.antithromboticPlan || {});
        cur[key] = val || '';
        return this.patchDraft(sid, {
            clinicalChips: { antithromboticPlan: cur }
        });
    },

    toggleBloodDevice(sid, val) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const cur = s.clinicalChips?.bloodAndDevices || {};
        const prevVals = (cur.confirmed && Array.isArray(cur.values)) ? cur.values.slice() : [];
        let nextVals;
        if (val === 'basic_instruments_only') {
            nextVals = prevVals.includes('basic_instruments_only') ? [] : ['basic_instruments_only'];
        } else {
            nextVals = prevVals.filter(x => x !== 'basic_instruments_only');
            if (nextVals.includes(val)) {
                nextVals = nextVals.filter(x => x !== val);
            } else {
                nextVals.push(val);
            }
        }
        return this.patchDraft(sid, {
            clinicalChips: {
                bloodAndDevices: {
                    confirmed: nextVals.length > 0,
                    values: nextVals,
                    otherDeviceNote: cur.otherDeviceNote || ''
                }
            }
        });
    },

    selectStomaPlan(sid, val) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const cur = s.clinicalChips?.stomaPlan || {};
        return this.patchDraft(sid, {
            clinicalChips: {
                stomaPlan: {
                    confirmed: true,
                    value: val,
                    stomaNote: cur.stomaNote || ''
                }
            }
        });
    },

    patchContext(sid, ctxKey, partialObj) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const curCtx = Object.assign({}, s.clinicalChips?.contextChips?.[ctxKey] || {}, partialObj);
        return this.patchDraft(sid, {
            clinicalChips: {
                contextChips: {
                    [ctxKey]: curCtx
                }
            }
        });
    },

    toggleCancerLocation(sid, locVal) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const curB3 = Object.assign({}, s.clinicalChips?.contextChips?.cancerContext || {});
        const prevLocs = Array.isArray(curB3.tumorLocation) ? curB3.tumorLocation.slice() : [];
        curB3.tumorLocation = prevLocs.includes(locVal)
            ? prevLocs.filter(x => x !== locVal)
            : [...prevLocs, locVal];
        return this.patchContext(sid, 'cancerContext', curB3);
    },

    patchCancerStage(sid, stageKey, stageVal) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const curB3 = Object.assign({}, s.clinicalChips?.contextChips?.cancerContext || {});
        const curStg = Object.assign({}, curB3.clinicalStage || {}, { [stageKey]: stageVal });
        return this.patchContext(sid, 'cancerContext', { clinicalStage: curStg });
    },

    setChecklistState(sid, code, nextState) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const curItem = Object.assign({}, s.preopChecklist?.[code] || {}, { state: nextState });
        return this.patchDraft(sid, {
            preopChecklist: { [code]: curItem }
        });
    },

    setChecklistPlanNote(sid, code, note) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const curItem = Object.assign({ state: 'verified_abnormal_planned' }, s.preopChecklist?.[code] || {}, { clinicalPlanNote: note || '' });
        return this.patchDraft(sid, {
            preopChecklist: { [code]: curItem }
        });
    },

    setSubCheckState(sid, subKey, nextState) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const curCk02 = Object.assign({ state: s.preopChecklist?.['CK-02']?.state || 'unverified' }, s.preopChecklist?.['CK-02'] || {});
        const nextSubs = Object.assign({}, curCk02.subChecks || {}, { [subKey]: nextState });
        curCk02.subChecks = nextSubs;
        return this.patchDraft(sid, {
            preopChecklist: { 'CK-02': curCk02 }
        });
    },

    runBulkConfirm(sid) {
        return this.patchDraft(sid, { bulkAction: 'bulk_confirm_routine' });
    },

    runUndoBulkConfirm(sid) {
        return this.patchDraft(sid, { bulkAction: 'undo_bulk_confirm' });
    },

    // ── Lifecycle Action Drawers & Execution (Zero window.prompt!) ──
    openActionDrawer(sid, drawerType) {
        this._activeActionDrawer = drawerType;
        if (drawerType === 'return' && !Array.isArray(this._returnChipDraft)) {
            this._returnChipDraft = [];
        }
        this._refreshOpenModal(sid);
    },

    toggleReturnFeedbackChip(sid, chipLabel) {
        const cur = Array.isArray(this._returnChipDraft) ? this._returnChipDraft.slice() : [];
        this._returnChipDraft = cur.includes(chipLabel)
            ? cur.filter(x => x !== chipLabel)
            : [...cur, chipLabel];
        this._refreshOpenModal(sid);
    },

    _renderActionDrawerHtml(s, actor) {
        let html = '';
        if (Array.isArray(this._lastGateErrors) && this._lastGateErrors.length > 0) {
            html += `
            <div class="sap-alert sap-alert--danger" id="sap-gate-errors-box">
                <div><strong>⛔ Chưa đủ điều kiện trình duyệt (${this._lastGateErrors.length} mục cần hoàn tất):</strong></div>
                <ul style="margin:6px 0 0 18px;padding:0;">
                    ${this._lastGateErrors.map(msg => `<li>${Utils.escapeHtml(msg)}</li>`).join('')}
                </ul>
            </div>`;
        }

        const dt = this._activeActionDrawer;
        if (!dt) return html;

        const nowIsoLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        const attendingStaff = (Store.getAll('staff') || []).filter(st => SAP_ATTENDING_IDS.has(Number(st.id)));

        if (dt === 'change_group') {
            html += `
            <div class="sap-case-banner" id="sap-drawer-change-group">
                <div class="sap-field-label">🔄 Xác nhận chuyển Nhóm bệnh lý (Tự động lưu trữ dữ liệu chuyên biệt cũ)</div>
                <input id="sap-group-change-reason" type="text" class="sap-input"
                    placeholder="Nhập lý do chuyển nhóm bệnh lý (tối thiểu 5 ký tự)..." required>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
                    <button type="button" class="sap-btn" onclick="SurgeryApprovalPage.openActionDrawer(${s.id}, null)">Hủy</button>
                    <button type="button" class="sap-btn sap-btn--primary" onclick="SurgeryApprovalPage.confirmPathologyGroupChange(${s.id})">
                        ✓ Xác nhận chuyển nhóm
                    </button>
                </div>
            </div>`;
        } else if (dt === 'submit_extra') {
            const needColleagueReason = Number(actor.staffId) !== Number(s.mainSurgeon)
                && Number(actor.staffId) !== Number(s.coordinatingAttendingStaffId)
                && !SAP_BCN_IDS.has(Number(actor.staffId));
            html += `
            <div class="sap-case-banner" id="sap-drawer-submit-extra">
                <div class="sap-field-label">🚀 Bổ sung thông tin Trình duyệt mổ tại khoa</div>
                ${needColleagueReason ? `
                <div class="sap-canary-field">
                    <label for="sap-acting-reason">Lý do trình thay PTV mổ chính cùng POD (tối thiểu 10 ký tự):</label>
                    <input id="sap-acting-reason" type="text" class="sap-input" placeholder="VD: PTV chính đang trong phòng mổ, ủy nhiệm BS cùng POD trình...">
                </div>` : ''}
                <div class="sap-canary-field" style="margin-top:6px;">
                    <label for="sap-late-reason">Lý do trình sau mốc giờ SLA (nếu trình trễ hạn):</label>
                    <input id="sap-late-reason" type="text" class="sap-input" placeholder="VD: Chờ kết quả hội chẩn Tim mạch / Tiền mê bổ sung chiều nay...">
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
                    <button type="button" class="sap-btn" onclick="SurgeryApprovalPage.openActionDrawer(${s.id}, null)">Đóng</button>
                    <button type="button" class="sap-btn sap-btn--primary" onclick="SurgeryApprovalPage.executeLifecycleAction(${s.id}, 'submit')">
                        🚀 Xác nhận Trình duyệt
                    </button>
                </div>
            </div>`;
        } else if (dt === 'emergency') {
            const defaultOwner = SAP_ATTENDING_IDS.has(Number(s.mainSurgeon)) ? Number(s.mainSurgeon) : (attendingStaff[0]?.id || 1);
            html += `
            <div class="sap-case-banner" id="sap-drawer-emergency">
                <div class="sap-field-label">⚡ Cổng Ngoại lệ Cấp cứu tại Khoa (BS Trực khoa 08:00–18:00 / BS chính)</div>
                <p style="font-size:0.82rem;color:var(--text-secondary);margin:0;">
                    Dành riêng cho ca cấp cứu đe dọa tính mạng đã báo cáo trực tiếp / điện thoại với BCN. Nhãn hiển thị sẽ là <strong>⚡ Duyệt ngoại lệ cấp cứu (Khoa)</strong> (không sinh tích xanh thường quy).
                </p>
                <div class="sap-canary-field" style="margin-top:6px;">
                    <label for="sap-em-reason">Chỉ định mổ cấp cứu / Tình trạng đe dọa tính mạng (tối thiểu 10 ký tự):</label>
                    <input id="sap-em-reason" type="text" class="sap-input" placeholder="VD: Thủng tạng rỗng / Tắc ruột nghẹt / Xuất huyết tiêu hóa dưới ồ ạt...">
                </div>
                <div class="sap-canary-grid" style="margin-top:6px;">
                    <div class="sap-canary-field">
                        <label for="sap-em-leader">Lãnh đạo BCN đã tiếp nhận báo cáo</label>
                        <select id="sap-em-leader" class="sap-select">
                            <option value="1">TS. BSCKII. Nguyễn Phú Hữu (Trưởng khoa)</option>
                            <option value="2">BSCKII. Vũ Khương An (Phó Trưởng khoa)</option>
                        </select>
                    </div>
                    <div class="sap-canary-field">
                        <label for="sap-em-channel">Kênh báo cáo</label>
                        <select id="sap-em-channel" class="sap-select">
                            <option value="phone">Điện thoại trực tiếp</option>
                            <option value="in_person">Trao đổi trực tiếp tại khoa / phòng mổ</option>
                            <option value="zalo_duty">Tin nhắn trực chuyên môn</option>
                        </select>
                    </div>
                    <div class="sap-canary-field">
                        <label for="sap-em-time">Thời điểm báo cáo</label>
                        <input id="sap-em-time" type="datetime-local" class="sap-input" value="${nowIsoLocal}">
                    </div>
                    <div class="sap-canary-field">
                        <label for="sap-em-owner">BS chính chịu trách nhiệm hoàn tất hồ sơ sau mổ</label>
                        <select id="sap-em-owner" class="sap-select">
                            ${attendingStaff.map(st => `<option value="${st.id}" ${Number(st.id) === defaultOwner ? 'selected' : ''}>${Utils.escapeHtml((st.title ? st.title + ' ' : '') + st.name)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
                    <button type="button" class="sap-btn" onclick="SurgeryApprovalPage.openActionDrawer(${s.id}, null)">Hủy</button>
                    <button type="button" class="sap-btn sap-btn--warning" onclick="SurgeryApprovalPage.executeLifecycleAction(${s.id}, 'submit_emergency')">
                        ⚡ Gửi Ngoại lệ Cấp cứu
                    </button>
                </div>
            </div>`;
        } else if (dt === 'return') {
            const selChips = Array.isArray(this._returnChipDraft) ? this._returnChipDraft : [];
            html += `
            <div class="sap-case-banner" id="sap-drawer-return">
                <div class="sap-field-label">↩️ BCN Yêu cầu bổ sung hồ sơ trước mổ</div>
                <div class="sap-chip-group">
                    ${SAP_RETURN_FEEDBACK_CHIPS.map(ch => {
                        const isSel = selChips.includes(ch);
                        return `<button type="button" class="sap-chip ${isSel ? 'sap-chip--selected' : ''}"
                            onclick="SurgeryApprovalPage.toggleReturnFeedbackChip(${s.id}, '${Utils.escapeHtml(ch)}')">
                            ${isSel ? '✓ ' : ''}${Utils.escapeHtml(ch)}
                        </button>`;
                    }).join('')}
                </div>
                <input id="sap-return-note" type="text" class="sap-input" style="margin-top:6px;"
                    placeholder="Ghi chú hướng dẫn bổ sung cụ thể cho BS điều trị / Học viên...">
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
                    <button type="button" class="sap-btn" onclick="SurgeryApprovalPage.openActionDrawer(${s.id}, null)">Hủy</button>
                    <button type="button" class="sap-btn sap-btn--danger" onclick="SurgeryApprovalPage.executeLifecycleAction(${s.id}, 'return')">
                        ↩️ Gửi yêu cầu bổ sung
                    </button>
                </div>
            </div>`;
        } else if (dt === 'approve_backup') {
            html += `
            <div class="sap-case-banner" id="sap-drawer-approve-backup">
                <div class="sap-field-label">⚡ Phó Trưởng khoa xác nhận Ngoại lệ Cấp cứu dự phòng (khi chưa có bản ghi Ủy quyền)</div>
                <input id="sap-backup-reason" type="text" class="sap-input"
                    placeholder="Nhập lý do dự phòng khẩn cấp (tối thiểu 10 ký tự, VD: Trưởng khoa đang mổ ca phức tạp không nghe máy)...">
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
                    <button type="button" class="sap-btn" onclick="SurgeryApprovalPage.openActionDrawer(${s.id}, null)">Hủy</button>
                    <button type="button" class="sap-btn sap-btn--success" onclick="SurgeryApprovalPage.executeLifecycleAction(${s.id}, 'approve')">
                        ⚡ Xác nhận Duyệt ngoại lệ cấp cứu
                    </button>
                </div>
            </div>`;
        } else if (dt === 'hold') {
            html += `
            <div class="sap-case-banner" id="sap-drawer-hold">
                <div class="sap-field-label">⏸️ Tạm hoãn tại khoa sau khi đã duyệt</div>
                <div class="sap-canary-grid">
                    <div class="sap-canary-field">
                        <label for="sap-hold-cat">Phân loại nguyên nhân tạm hoãn</label>
                        <select id="sap-hold-cat" class="sap-select">
                            ${SAP_HOLD_CATEGORIES.map(hc => `<option value="${hc.value}">${Utils.escapeHtml(hc.label)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="sap-canary-field">
                        <label for="sap-hold-reason">Diễn tiến / Lý do tạm hoãn cụ thể (tối thiểu 10 ký tự)</label>
                        <input id="sap-hold-reason" type="text" class="sap-input" placeholder="VD: Bệnh nhân sốt 38.8°C mới phát sinh, chờ cấy máu & hội chẩn Hô hấp...">
                    </div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
                    <button type="button" class="sap-btn" onclick="SurgeryApprovalPage.openActionDrawer(${s.id}, null)">Hủy</button>
                    <button type="button" class="sap-btn sap-btn--warning" onclick="SurgeryApprovalPage.executeLifecycleAction(${s.id}, 'hold')">
                        ⏸️ Xác nhận Tạm hoãn
                    </button>
                </div>
            </div>`;
        } else if (dt === 'release_hold') {
            html += `
            <div class="sap-case-banner" id="sap-drawer-release-hold">
                <div class="sap-field-label">▶️ Gỡ Tạm hoãn & Khôi phục trạng thái Duyệt tại khoa (BCN)</div>
                <input id="sap-release-note" type="text" class="sap-input"
                    placeholder="Ghi chú xác nhận an toàn khi mở lại ca mổ (tối thiểu 5 ký tự, VD: Hết sốt 48h, Tiền mê đồng ý mổ lại)...">
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
                    <button type="button" class="sap-btn" onclick="SurgeryApprovalPage.openActionDrawer(${s.id}, null)">Hủy</button>
                    <button type="button" class="sap-btn sap-btn--success" onclick="SurgeryApprovalPage.executeLifecycleAction(${s.id}, 'release_hold')">
                        ▶️ Xác nhận Gỡ tạm hoãn
                    </button>
                </div>
            </div>`;
        } else if (dt === 'revoke') {
            html += `
            <div class="sap-case-banner" id="sap-drawer-revoke">
                <div class="sap-field-label">🚫 Thu hồi phê duyệt tại khoa (BCN)</div>
                <input id="sap-revoke-reason" type="text" class="sap-input"
                    placeholder="Nhập lý do thu hồi phê duyệt tại khoa (tối thiểu 5 ký tự)...">
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
                    <button type="button" class="sap-btn" onclick="SurgeryApprovalPage.openActionDrawer(${s.id}, null)">Hủy</button>
                    <button type="button" class="sap-btn sap-btn--danger" onclick="SurgeryApprovalPage.executeLifecycleAction(${s.id}, 'revoke')">
                        🚫 Xác nhận Thu hồi duyệt
                    </button>
                </div>
            </div>`;
        }

        return html;
    },

    _renderModalFooterActionsHtml(s, actor, status) {
        const isTrainee = SAP_TRAINEE_IDS.has(actor.staffId);
        const isAttending = SAP_ATTENDING_IDS.has(actor.staffId);
        const isBcn = SAP_BCN_IDS.has(actor.staffId);
        const isChief = actor.staffId === SAP_CHIEF_ID;
        const isDeputy = actor.staffId === SAP_DEPUTY_ID;

        const canRequestVerify = (isTrainee || isAttending) && ['draft_unsubmitted', 'ready_for_attending', 'returned_for_revision', 'resubmit_required', 'reapproval_required'].includes(status);
        const canSubmit = (isAttending || isBcn) && !['approved', 'post_approval_hold', 'trashed_inactive', 'nsth_external_authority'].includes(status);
        const canEmergency = (isAttending || isBcn) && !['approved', 'approved_with_exception', 'trashed_inactive', 'nsth_external_authority'].includes(status);
        const canPreapprove = isDeputy && status === 'submitted';
        const canReturn = isBcn && ['submitted', 'preapproved', 'emergency_exception_pending_ack'].includes(status);
        const canApprove = isBcn && ['submitted', 'preapproved', 'emergency_exception_pending_ack'].includes(status);
        const canHold = (isAttending || isBcn) && ['approved', 'approved_with_exception'].includes(status);
        const canReleaseHold = isBcn && status === 'post_approval_hold';
        const canRevoke = isBcn && ['approved', 'approved_with_exception', 'post_approval_hold', 'preapproved'].includes(status);

        return `
        <div class="sap-footer-bar">
            <button type="button" class="sap-btn" onclick="Modal.close()">Đóng cửa sổ</button>
            <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;">
                ${canRequestVerify ? `
                <button type="button" class="sap-btn" id="sap-act-request-verify"
                    onclick="SurgeryApprovalPage.executeLifecycleAction(${s.id}, 'request_verify')">
                    🩺 Gửi BS chính xác nhận
                </button>` : ''}

                ${canEmergency ? `
                <button type="button" class="sap-btn sap-btn--warning" id="sap-act-open-emergency"
                    onclick="SurgeryApprovalPage.openActionDrawer(${s.id}, 'emergency')">
                    ⚡ Ngoại lệ Cấp cứu
                </button>` : ''}

                ${canSubmit ? `
                <button type="button" class="sap-btn sap-btn--primary" id="sap-act-submit"
                    onclick="SurgeryApprovalPage.executeLifecycleAction(${s.id}, 'submit')">
                    🚀 Trình duyệt mổ tại khoa
                </button>` : ''}

                ${canPreapprove ? `
                <button type="button" class="sap-btn sap-btn--primary" id="sap-act-preapprove"
                    onclick="SurgeryApprovalPage.executeLifecycleAction(${s.id}, 'preapprove')">
                    ☑️ Tiền duyệt (Phó TK)
                </button>` : ''}

                ${canReturn ? `
                <button type="button" class="sap-btn sap-btn--danger" id="sap-act-open-return"
                    onclick="SurgeryApprovalPage.openActionDrawer(${s.id}, 'return')">
                    ↩️ Yêu cầu bổ sung
                </button>` : ''}

                ${canApprove ? `
                <button type="button" class="sap-btn sap-btn--success" id="sap-act-approve"
                    onclick="SurgeryApprovalPage.executeLifecycleAction(${s.id}, 'approve')">
                    ${status === 'emergency_exception_pending_ack'
                        ? '⚡ Xác nhận Ngoại lệ Cấp cứu'
                        : (isChief ? '✅ Phê duyệt tại khoa' : '✅ Phê duyệt theo Ủy quyền')}
                </button>` : ''}

                ${canHold ? `
                <button type="button" class="sap-btn sap-btn--warning" id="sap-act-open-hold"
                    onclick="SurgeryApprovalPage.openActionDrawer(${s.id}, 'hold')">
                    ⏸️ Tạm hoãn tại khoa
                </button>` : ''}

                ${canReleaseHold ? `
                <button type="button" class="sap-btn sap-btn--success" id="sap-act-open-release"
                    onclick="SurgeryApprovalPage.openActionDrawer(${s.id}, 'release_hold')">
                    ▶️ Gỡ tạm hoãn
                </button>` : ''}

                ${canRevoke ? `
                <button type="button" class="sap-btn sap-btn--danger" id="sap-act-open-revoke"
                    onclick="SurgeryApprovalPage.openActionDrawer(${s.id}, 'revoke')">
                    🚫 Thu hồi duyệt
                </button>` : ''}
            </div>
        </div>`;
    },

    async executeLifecycleAction(sid, actionType) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const baseBody = { expectedCaseRevision: Number(s.caseRevision || 1) };
        const opts = { allowSimulation: Boolean(s.isTestSandboxCase) };
        this._lastGateErrors = null;

        try {
            let endpoint = '';
            let body = Object.assign({}, baseBody);
            let successMsg = 'Đã cập nhật trạng thái duyệt mổ tại khoa';

            if (actionType === 'request_verify') {
                endpoint = `/api/surgery-approval/${sid}/request-verify`;
                successMsg = '🩺 Đã gửi thông báo mời Bác sĩ chính kiểm tra & xác nhận!';
            } else if (actionType === 'submit') {
                endpoint = `/api/surgery-approval/${sid}/submit`;
                const actEl = document.getElementById('sap-acting-reason');
                const lateEl = document.getElementById('sap-late-reason');
                if (actEl && actEl.value.trim()) body.actingForMainSurgeonReason = actEl.value.trim();
                if (lateEl && lateEl.value.trim()) body.lateReason = lateEl.value.trim();
                successMsg = '🚀 Đã trình duyệt mổ tại khoa thành công!';
            } else if (actionType === 'submit_emergency') {
                endpoint = `/api/surgery-approval/${sid}/submit-emergency`;
                body.emergencyReasonNote = (document.getElementById('sap-em-reason')?.value || '').trim();
                body.verbalConsultRecord = {
                    contactedLeaderStaffId: parseInt(document.getElementById('sap-em-leader')?.value || '1', 10),
                    contactChannel: document.getElementById('sap-em-channel')?.value || 'phone',
                    contactedAt: document.getElementById('sap-em-time')?.value || new Date().toISOString()
                };
                body.postOpFollowUpOwnerStaffId = parseInt(document.getElementById('sap-em-owner')?.value || '0', 10);
                successMsg = '⚡ Đã gửi hồ sơ Ngoại lệ Cấp cứu — Chờ BCN xác nhận!';
            } else if (actionType === 'preapprove') {
                endpoint = `/api/surgery-approval/${sid}/preapprove`;
                body.verifyPrivilege = true;
                successMsg = '☑️ Đã Tiền duyệt thành công — Chờ Trưởng khoa phê duyệt!';
            } else if (actionType === 'return') {
                endpoint = `/api/surgery-approval/${sid}/return`;
                body.feedbackChips = Array.isArray(this._returnChipDraft) ? this._returnChipDraft : [];
                body.feedbackNote = (document.getElementById('sap-return-note')?.value || '').trim();
                successMsg = '↩️ Đã gửi yêu cầu bổ sung hồ sơ cho phẫu thuật viên!';
            } else if (actionType === 'approve') {
                endpoint = `/api/surgery-approval/${sid}/approve`;
                const backupEl = document.getElementById('sap-backup-reason');
                if (backupEl && backupEl.value.trim()) {
                    body.emergencyBackupReason = backupEl.value.trim();
                }
                successMsg = s.approval?.status === 'emergency_exception_pending_ack'
                    ? '⚡ Đã xác nhận Duyệt ngoại lệ cấp cứu (Khoa)!'
                    : '✅ Đã phê duyệt mổ tại khoa thành công!';
            } else if (actionType === 'hold') {
                endpoint = `/api/surgery-approval/${sid}/hold-post-approval`;
                body.holdCategory = document.getElementById('sap-hold-cat')?.value || 'clinical_change';
                body.holdReason = (document.getElementById('sap-hold-reason')?.value || '').trim();
                successMsg = '⏸️ Đã đặt trạng thái Tạm hoãn tại khoa!';
            } else if (actionType === 'release_hold') {
                endpoint = `/api/surgery-approval/${sid}/release-hold`;
                body.releaseNote = (document.getElementById('sap-release-note')?.value || '').trim();
                successMsg = '▶️ Đã gỡ Tạm hoãn — Khôi phục trạng thái duyệt tại khoa!';
            } else if (actionType === 'revoke') {
                endpoint = `/api/surgery-approval/${sid}/revoke`;
                body.revokeReason = (document.getElementById('sap-revoke-reason')?.value || '').trim();
                successMsg = '🚫 Đã thu hồi phê duyệt tại khoa!';
            } else {
                return;
            }

            const res = await this._api(endpoint, 'POST', body, opts);
            this._activeActionDrawer = null;
            this._returnChipDraft = [];
            if (res && res.surgery) {
                this._syncSurgeryInStore(res.surgery);
            }
            this._refreshOpenModal(sid);
            Toast.success(successMsg);
        } catch (err) {
            if (actionType === 'submit' && ['ACTING_REASON_REQUIRED', 'LATE_REASON_REQUIRED'].includes(err.code)) {
                this._activeActionDrawer = 'submit_extra';
                this._refreshOpenModal(sid);
                Toast.warning(err.message);
                return;
            }
            if (actionType === 'approve' && err.code === 'EMERGENCY_BACKUP_REASON_REQUIRED') {
                this._activeActionDrawer = 'approve_backup';
                this._refreshOpenModal(sid);
                Toast.warning(err.message);
                return;
            }
            const reasons = err.payload?.details?.blockingReasons || err.payload?.blockingReasons;
            if (Array.isArray(reasons) && reasons.length > 0) {
                this._lastGateErrors = reasons;
                this._refreshOpenModal(sid);
            }
            Toast.error(err.message);
        }
    }
};
