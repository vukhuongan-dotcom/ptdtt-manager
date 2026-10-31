// ===== DEPARTMENTAL ONLINE SURGERY APPROVAL MODULE (STEP 1 INTERNAL — ZERO HIS COUPLING) =====
// UI/UX v2 (Crosscheck 31/10):
//  - BƯỚC 1: Role-first "Việc của tôi" queue, 1-row filter chips, sticky date groups, 3-line clickable cards, compact scope banner
//  - BƯỚC 2: 2-column Right Drawer (1040px Desktop) / Full-screen Mobile (390px), 3 clinical steps with auto-collapse,
//            Mục 2.4 chip->checklist deduplication (5 independent rows), 3-segment controls, 10s Undo bar, 90-day frequent procedures,
//            sticky safe-area bottom bar with "Trình duyệt (còn N mục)" jump-scroll & Vietnamese 422 error links
//  - BƯỚC 3: BCN 1-Page Executive Summary ("xem ngoại lệ trước"), Risk Flags, Yellow Re-approval Diff, "Duyệt & mở ca kế tiếp", Red returned fields
//  - BƯỚC 4: 6 short labels on Weekly Schedule & PNG export + 1-line bottom legend + direct step deep-linking from Schedule & Bell Notifications
//  - BƯỚC 5: <span aria-hidden="true"> emoji wrappers, >= 44x44px touch targets, zero mobile <select>, >= 13px labels, prefers-reduced-motion

const SAP_ATTENDING_IDS = new Set([1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const SAP_BCN_IDS = new Set([1, 2]);
const SAP_CHIEF_ID = 1;
const SAP_DEPUTY_ID = 2;
const SAP_TRAINEE_IDS = new Set([16, 43, 44, 45, 46, 47, 48, 50]);

const SAP_WARD_ROOMS = ['705', '706', '707', '708', '709', '710', '711', '712', '712A', '718', '719', 'unassigned'];

const SAP_PATHOLOGY_GROUPS = [
    { value: 'benign_anorectal', label: 'Lành tính hậu môn – trực tràng', shortLabel: 'Lành tính HM' },
    { value: 'benign_colorectal_abdominal', label: 'Lành tính đại trực tràng – ổ bụng / HMNT', shortLabel: 'Lành tính ĐTT/HMNT' },
    { value: 'cancer_confirmed', label: 'Ung thư đã xác định GPB', shortLabel: 'Ung thư ĐTT' },
    { value: 'neoplasm_suspected_or_special', label: 'U tân sinh đặc thù / nghi ác chưa GPB', shortLabel: 'U tân sinh đặc thù' },
    { value: 'other_confirmed', label: 'Nhóm bệnh lý khác (ghi rõ)', shortLabel: 'Bệnh lý khác' }
];

const SAP_URGENCY_OPTIONS = [
    { value: 'elective', label: 'Chương trình thường quy', shortLabel: 'Chương trình' },
    { value: 'elective_service', label: 'Mổ yêu cầu / Dịch vụ', shortLabel: 'Mổ yêu cầu' },
    { value: 'semi_urgent', label: 'Bán khẩn (mổ sớm có chuẩn bị)', shortLabel: 'Bán khẩn' },
    { value: 'emergency_exception', label: 'Cấp cứu ngoại lệ', icon: '⚡', shortLabel: 'Cấp cứu ngoại lệ' }
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

// Mục 2.4 (BS. An duyệt): CK-03, CK-05, CK-07 tự động đồng bộ từ Bước ② ("✓ theo mục ②").
// Bảng kiểm Bước ③ chỉ hiển thị 5 mục độc lập (3 mục chung + 2 mục BS chính).
const SAP_CK_INDEPENDENT_ITEMS = [
    {
        code: 'CK-01',
        title: 'Xét nghiệm tiền phẫu & đông máu',
        desc: 'Huyết học, sinh hóa, đông máu đạt ngưỡng an toàn mổ hoặc đã có kế hoạch điều chỉnh.',
        attendingOnly: false,
        allowNotApplicable: false,
        allowNotIndicatedWithReason: true,
        naState: 'not_indicated',
        naShortLabel: 'Không chỉ định'
    },
    {
        code: 'CK-02',
        title: 'Tiền mê & cận lâm sàng tim phổi',
        desc: 'Khám tiền mê và các thăm dò tim phổi theo chỉ định.',
        attendingOnly: false,
        hasSubChecks: true,
        allowNotApplicable: false,
        naState: 'not_indicated',
        naShortLabel: 'Không chỉ định'
    },
    {
        code: 'CK-06',
        title: 'Chuẩn bị ruột, ERAS & đánh dấu vị trí HMNT',
        desc: 'Y lệnh chuẩn bị đại tràng – hậu môn (hoặc ERAS) và đánh dấu vị trí HMNT dự kiến.',
        attendingOnly: false,
        allowNotApplicable: true,
        naState: 'not_indicated',
        naShortLabel: 'Không chỉ định'
    },
    {
        code: 'CK-04',
        title: 'Phim chụp & kết quả nội soi gốc',
        desc: 'Bác sĩ mổ chính trực tiếp kiểm tra hình ảnh MRI, CT, nội soi gốc được chỉ định.',
        attendingOnly: true,
        allowMinorAnorectalNA: true,
        naState: 'not_applicable',
        naShortLabel: 'Không áp dụng'
    },
    {
        code: 'CK-08',
        title: 'Tư vấn tiền phẫu & cam kết phẫu thuật',
        desc: 'Bác sĩ mổ chính giải thích phương pháp, nguy cơ tai biến / mở HMNT và hoàn tất ký cam kết.',
        attendingOnly: true,
        allowNotApplicable: false,
        naState: 'not_applicable',
        naShortLabel: 'Không áp dụng'
    }
];

const SAP_SUBCHECK_LABELS = {
    preAnesthesiaExam: 'Khám tiền mê',
    ecg: 'ECG',
    chestImaging: 'X-quang ngực',
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
    { value: 'clinical_change', label: 'Diễn tiến lâm sàng mới (sốt, nhiễm trùng...)' },
    { value: 'anesthesia_hold', label: 'Tiền mê / Gây mê đề nghị tối ưu nội khoa' },
    { value: 'missing_blood_or_device', label: 'Thiếu máu dự trù hoặc thiết bị đặc thù' },
    { value: 'patient_declined_or_deferred', label: 'Người bệnh / Gia đình xin dời lịch' },
    { value: 'or_capacity_hold', label: 'Điều phối phòng mổ / Quá tải lịch' },
    { value: 'other', label: 'Lý do khác (ghi rõ)' }
];

const SAP_SIMULATOR_ROLES = [
    { staffId: 0, label: 'Thực thi thật: Tài khoản hiện tại' },
    { staffId: 1, label: 'Giả lập [TEST]: TS. BSCKII. Nguyễn Phú Hữu (Trưởng khoa #1)' },
    { staffId: 2, label: 'Giả lập [TEST]: BSCKII. Vũ Khương An (Phó Trưởng khoa #2)' },
    { staffId: 4, label: 'Giả lập [TEST]: BS chính Cột ĐB (#4)' },
    { staffId: 6, label: 'Giả lập [TEST]: BS chính Cột I (#6)' },
    { staffId: 8, label: 'Giả lập [TEST]: BS chính Cột II (#8)' },
    { staffId: 10, label: 'Giả lập [TEST]: BS chính Cột III (#10)' },
    { staffId: 44, label: 'Giả lập [TEST]: BS học viên / BSNT (#44)' },
    { staffId: 3, label: 'Giả lập [TEST]: ThS. ĐD. Nguyễn Thị Ngọc Thùy (ĐD Trưởng #3)' }
];

// BƯỚC 2.10: Ánh xạ toàn diện mã lỗi 422 / blockingReasons máy chủ sang tiếng Việt tự nhiên + mục nhảy tới
const SAP_GATE_REASON_MAP = {
    'C-01_WARD_ROOM_UNCONFIRMED': { step: 1, fieldId: 'sap-f-ward-room', label: 'Chưa chọn buồng bệnh điều trị' },
    'PATHOLOGY_GROUP_UNCONFIRMED': { step: 1, fieldId: 'sap-f-pathology-group', label: 'Chưa chọn nhóm bệnh lý chuyên khoa' },
    'OTHER_PATHOLOGY_NOTE_REQUIRED': { step: 1, fieldId: 'sap-f-pathology-group', label: 'Chưa ghi rõ chi tiết nhóm bệnh lý khác (tối thiểu 10 ký tự)' },
    'CATALOG_ENTRY_REQUIRED': { step: 1, fieldId: 'sap-f-catalog', label: 'Chưa chọn kỹ thuật mổ trong Danh mục 309 phẫu thuật' },
    'UNCLASSIFIED_NOTE_REQUIRED': { step: 1, fieldId: 'sap-f-catalog', label: 'Chưa ghi chú hạng dự kiến cho kỹ thuật chưa phân loại' },
    'OVER_COLUMN_NOT_ALLOWED_ELECTIVE': { step: 1, fieldId: 'sap-f-catalog', label: 'Ca mổ chương trình / yêu cầu không được vượt cột phẫu thuật của BS chính' },
    'OVER_COLUMN_EXCEEDS_MAX_ONE_STEP': { step: 1, fieldId: 'sap-f-catalog', label: 'Ca mổ bán khẩn chỉ được trình vượt tối đa 01 cột phẫu thuật' },
    'OVER_COLUMN_JUSTIFICATION_REQUIRED': { step: 1, fieldId: 'sap-f-catalog', label: 'Chưa ghi lý do xin vượt 01 cột cho ca bán khẩn để BCN cân nhắc' },
    'SEMI_URGENT_REASON_REQUIRED': { step: 1, fieldId: 'sap-f-urgency', label: 'Chưa ghi lý do lâm sàng mổ bán khẩn' },
    'ROBOT_CERTIFICATION_REQUIRED': { step: 1, fieldId: 'sap-f-catalog', label: 'BS mổ chính chưa có trong danh sách chứng nhận phẫu thuật Robot tại khoa' },
    'MISSING_COORDINATING_ATTENDING': { step: 1, fieldId: 'sap-f-coord-attending', label: 'Chưa chọn BS chính Khoa PTĐTT phụ trách phối hợp cho PTV ngoài khoa' },
    'C-04_COMORBIDITIES_UNCONFIRMED': { step: 2, fieldId: 'sap-f-comorbidities', label: 'Chưa xác nhận tình trạng bệnh nền nội khoa' },
    'C-04_OTHER_NOTE_REQUIRED': { step: 2, fieldId: 'sap-f-comorbidities', label: 'Chưa ghi rõ tên bệnh nền khác' },
    'C-05_ANTITHROMBOTIC_UNCONFIRMED': { step: 2, fieldId: 'sap-f-antithrombotic', label: 'Chưa xác nhận kế hoạch thuốc chống huyết khối' },
    'ANTITHROMBOTIC_DETAILS_REQUIRED': { step: 2, fieldId: 'sap-f-antithrombotic', label: 'Chưa nhập đủ tên thuốc, liều cuối và chuyên khoa duyệt cho thuốc chống huyết khối' },
    'UNHELD_DRUG_NOT_FOR_ELECTIVE': { step: 2, fieldId: 'sap-f-antithrombotic', label: 'Thuốc chống huyết khối chưa ngưng đủ ngày không được trình mổ chương trình thường quy' },
    'C-06_BLOOD_DEVICES_UNCONFIRMED': { step: 2, fieldId: 'sap-f-blood-devices', label: 'Chưa xác nhận dự trù máu và thiết bị đặc thù' },
    'C-07_STOMA_UNCONFIRMED': { step: 2, fieldId: 'sap-f-stoma', label: 'Chưa xác nhận kế hoạch hậu môn nhân tạo (HMNT)' },
    'B1_FISTULA_CLASSIFICATION_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa phân loại bệnh lý hậu môn / đường rò' },
    'B1_FISTULA_IMAGING_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa xác nhận hình ảnh học đường rò trước mổ (MRI / siêu âm)' },
    'B1_COMPLEX_FISTULA_MISSING_MRI_REASON': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa ghi lý do rò hậu môn phức tạp chưa chụp MRI đường rò' },
    'B2_DISTAL_LIMB_CHECK_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa xác nhận kiểm tra lưu thông đầu dưới trước đóng HMNT' },
    'B2_SUBTYPE_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa chọn phân nhóm bệnh lành tính đại trực tràng – ổ bụng' },
    'B2_BOWEL_PREP_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa chọn kế hoạch chuẩn bị đại tràng' },
    'B3_TUMOR_LOCATION_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa chọn vị trí khối u đại trực tràng – ống hậu môn' },
    'B3_HISTOLOGY_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa chọn kết quả giải phẫu bệnh trước mổ' },
    'B3_CLINICAL_STAGE_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa chọn đủ phân giai đoạn lâm sàng (cT, cN, cM)' },
    'B3_UNKNOWN_STAGE_NOTE_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa ghi lý do chọn giai đoạn Tx / Nx / Mx' },
    'CANCER_RECTAL_CRM_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Ung thư trực tràng / ống HM bắt buộc xác nhận diện cắt vòng quanh (CRM) trên MRI chậu' },
    'B3_CRM_NOTE_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa ghi lý do chưa đánh giá được MRI tiểu khung (CRM)' },
    'B3_MULTIMODAL_STATUS_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa chọn tình trạng điều trị đa mô thức trước mổ' },
    'B3_MDT_STATUS_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa xác nhận hội chẩn Ung bướu / MDT' },
    'B4_CATEGORY_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa chọn phân nhóm u tân sinh đặc thù' },
    'B4_BIOPSY_STATUS_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa chọn tình trạng sinh thiết trước mổ' },
    'B4_MISSING_BIOPSY_REASON_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa ghi lý do chưa có giải phẫu bệnh dương tính trước mổ' },
    'B4_EXTENT_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa chọn đánh giá mức độ lan rộng trên CT/MRI' },
    'B4_MDT_STATUS_REQUIRED': { step: 2, fieldId: 'sap-f-context-module', label: 'Chưa xác nhận hội chẩn chuyên môn cho u đặc thù' },
    'CK-01_NOT_INDICATED_REASON_REQUIRED': { step: 3, fieldId: 'sap-ck-row-CK-01', label: 'Chưa ghi lý do không chỉ định xét nghiệm tiền phẫu' },
    'CK-02_PREANESTHESIA_UNVERIFIED': { step: 3, fieldId: 'sap-ck-row-CK-02', label: 'Chưa xác nhận Khám tiền mê' },
    'CK-02_ecg_UNVERIFIED': { step: 3, fieldId: 'sap-ck-row-CK-02', label: 'Chưa xác nhận trạng thái Điện tâm đồ (ECG)' },
    'CK-02_chestImaging_UNVERIFIED': { step: 3, fieldId: 'sap-ck-row-CK-02', label: 'Chưa xác nhận trạng thái X-quang ngực' },
    'CK-02_echo_UNVERIFIED': { step: 3, fieldId: 'sap-ck-row-CK-02', label: 'Chưa xác nhận trạng thái Siêu âm tim' },
    'CK-04_IMAGING_REQUIRED_FOR_CASE': { step: 3, fieldId: 'sap-ck-row-CK-04', label: 'Ca mổ này bắt buộc BS chính kiểm tra Phim chụp / nội soi gốc (không được chọn Không áp dụng)' },
    'CK-05_REQUIRED_FOR_NEOPLASM': { step: 2, fieldId: 'sap-f-context-module', label: 'BS chính chưa xác nhận đầy đủ Giải phẫu bệnh & Giai đoạn u ở Bước ②' },
    'CK-05_NA_ONLY_FOR_BENIGN': { step: 2, fieldId: 'sap-f-context-module', label: 'Nhóm bệnh này cần BS chính xác nhận thông tin chuyên môn ở Bước ②' }
};

const SurgeryApprovalPage = {
    _subtab: 'cases', // 'cases' | 'delegations' | 'logs'
    _filters: {
        scope: 'all_open', // 'week' | 'all_open'
        podId: 'all',
        status: 'my_work', // BƯỚC 1.1: Default role-based "Việc của tôi"
        search: ''
    },
    _moreFiltersOpen: false,
    _scopeDetailOpen: false,
    _canaryCollapsedMobile: true,
    _simulatedStaffId: 0,
    _catalogData: null,
    _catalogLoading: null,
    _logsState: null,
    _openCaseId: null,
    _catalogQuery: '',
    _activeActionDrawer: null,
    _moreActionsOpen: false,
    _bcnViewMode: 'summary', // 'summary' | 'steps' (BƯỚC 3.2)
    _expandedSteps: { 1: null, 2: null, 3: null },
    _currentFocusStep: 1,
    _highlightFieldId: null,
    _lastGateErrors: null,
    _returnChipDraft: [],
    _holdCatDraft: 'clinical_change',
    _emLeaderDraft: 1,
    _emChannelDraft: 'phone',
    _emOwnerDraft: 0,
    _bulkUndoExpiresAt: 0,
    _bulkUndoTimer: null,
    _approvedSnapCache: {},

    _ico(emoji) {
        return `<span class="sap-ico" aria-hidden="true">${emoji}</span>`;
    },

    _splitLeadingEmoji(label) {
        const str = String(label || '').trim();
        const m = str.match(/^([^\w\sÀ-ỹ]+)\s+(.*)$/u);
        if (m) return { icon: m[1], text: m[2] };
        return { icon: '', text: str };
    },

    // ── Canary Gate: Visible to Superadmin always, or all staff when rolloutAccessMode === 'all_staff' ──
    getConfig() {
        const cfg = Store._data?.surgeryApprovalConfig;
        if (cfg && typeof cfg === 'object') {
            return {
                ...cfg,
                sandboxOnlyMode: typeof cfg.sandboxOnlyMode === 'boolean'
                    ? cfg.sandboxOnlyMode
                    : (cfg.rolloutAccessMode !== 'all_staff')
            };
        }
        return {
            scope: 'departmental_step1_only',
            zeroHisCoupling: true,
            rolloutAccessMode: 'superadmin_only',
            sandboxOnlyMode: true,
            checklistMode: 'enforced_gate',
            rolloutEffectiveSurgeryDate: '2026-11-02',
            nsthInternalPrecheckEnabled: false,
            scopeLegendText: 'Chú giải (Bước 1 nội bộ Khoa PTĐTT, độc lập HIS): ✅ Đã duyệt · ⏳ Chờ duyệt · 📝 Chưa trình · ↩️ Trả về · ⏸️ Tạm hoãn · ⚡ Ngoại lệ'
        };
    },

    isFeatureVisibleForCurrentUser() {
        const session = (typeof Auth !== 'undefined' && Auth.getSession) ? Auth.getSession() : null;
        if (!session) return false;
        if (typeof App !== 'undefined' && App.isSuperAdmin && App.isSuperAdmin()) return true;
        return this.getConfig().rolloutAccessMode === 'all_staff';
    },

    isCaseApprovalEnabled(surgery) {
        if (!this.isFeatureVisibleForCurrentUser()) return false;
        if (!surgery || typeof surgery !== 'object') return false;
        if (this.getConfig().sandboxOnlyMode !== false) {
            return surgery.isTestSandboxCase === true;
        }
        return true;
    },

    // ── Exact 6-Condition Green Tick Predicate & 12-Row Departmental Truth Table (UNCHANGED LOGIC) ──
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
        if (status === 'ready_for_attending') {
            return { row: 9, badgeCode: 'DEPT_DRAFT_UNSUBMITTED', badgeLabel: '🩺 Chờ BS chính xác nhận', isGreenTickValid: false, cssClass: 'sap-badge--draft' };
        }
        return { row: 9, badgeCode: 'DEPT_DRAFT_UNSUBMITTED', badgeLabel: '📝 Chưa trình duyệt khoa', isGreenTickValid: false, cssClass: 'sap-badge--draft' };
    },

    // BƯỚC 4.1: Gom 12 trạng thái kỹ thuật về đúng 6 nhãn ngắn trên Lịch mổ tuần & PNG
    getScheduleShortBadgeMeta(surgery) {
        if (!surgery || typeof surgery !== 'object') return null;
        const full = this.getApprovalBadgeMeta(surgery);
        if (!full.badgeLabel || surgery.approachType === 'nsth') return null;
        const status = surgery.approval?.status || 'draft_unsubmitted';
        const activeHold = surgery.approval?.activeHold;

        if (status === 'post_approval_hold' || (activeHold !== null && activeHold !== undefined)) {
            return { icon: '⏸️', shortLabel: 'Tạm hoãn', fullLabel: full.badgeLabel, cssClass: 'sap-badge--hold', isGreenTickValid: false, badgeCode: full.badgeCode };
        }
        if (this.isApprovalGreenTickValid(surgery)) {
            return { icon: '✅', shortLabel: 'Đã duyệt', fullLabel: full.badgeLabel, cssClass: 'sap-badge--approved', isGreenTickValid: true, badgeCode: full.badgeCode };
        }
        if (status === 'approved_with_exception' || status === 'emergency_exception_pending_ack') {
            return { icon: '⚡', shortLabel: 'Ngoại lệ', fullLabel: full.badgeLabel, cssClass: 'sap-badge--emergency', isGreenTickValid: false, badgeCode: full.badgeCode };
        }
        if (status === 'returned_for_revision' || status === 'revoked_by_bcn' || status === 'approved') {
            return { icon: '↩️', shortLabel: 'Trả về', fullLabel: full.badgeLabel, cssClass: 'sap-badge--returned', isGreenTickValid: false, badgeCode: full.badgeCode };
        }
        if (status === 'submitted' || status === 'preapproved' || status === 'reapproval_required') {
            return { icon: '⏳', shortLabel: 'Chờ duyệt', fullLabel: full.badgeLabel, cssClass: 'sap-badge--submitted', isGreenTickValid: false, badgeCode: full.badgeCode };
        }
        return { icon: '📝', shortLabel: 'Chưa trình', fullLabel: full.badgeLabel, cssClass: 'sap-badge--draft', isGreenTickValid: false, badgeCode: full.badgeCode };
    },

    renderBadge(surgery, compact = false) {
        const meta = this.getApprovalBadgeMeta(surgery);
        if (!meta.badgeLabel) return '';
        const parts = this._splitLeadingEmoji(meta.badgeLabel);
        return `<span class="sap-badge ${meta.cssClass} ${compact ? 'sap-badge--compact' : ''}" data-badge-code="${meta.badgeCode}" title="${Utils.escapeHtml(meta.badgeLabel)}">${parts.icon ? this._ico(parts.icon) + ' ' : ''}<span>${Utils.escapeHtml(parts.text)}</span></span>`;
    },

    // BƯỚC 4.1 & 4.2: Nhãn ngắn trên thẻ Lịch mổ tuần — bấm mở thẳng hồ sơ duyệt của ca
    renderScheduleBadge(surgery) {
        const meta = this.getScheduleShortBadgeMeta(surgery);
        if (!meta) return '';
        const tooltip = `${meta.fullLabel} (Bước 1 nội bộ Khoa PTĐTT, độc lập HIS) — Bấm mở hồ sơ duyệt`;
        return `<button type="button" class="sap-badge sap-sched-badge ${meta.cssClass}" data-badge-code="${meta.badgeCode}" title="${Utils.escapeHtml(tooltip)}" aria-label="${Utils.escapeHtml(meta.shortLabel + ' — ' + (surgery.patientName || ''))}" onclick="event.stopPropagation();SurgeryApprovalPage.openCaseModal(${surgery.id}, { source: 'schedule' })">${this._ico(meta.icon)}<span>${Utils.escapeHtml(meta.shortLabel)}</span></button>`;
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

    _hasActiveDelegationForDeputy() {
        const dels = Store._data?.approvalDelegations || [];
        const nowMs = Date.now();
        return dels.some(d => !d.revokedAt && nowMs >= new Date(d.effectiveFrom).getTime() && nowMs <= new Date(d.effectiveTo).getTime());
    },

    // Snapshot caching for Step 3.3 ("Chờ duyệt lại": Cũ -> Mới diff)
    _captureApprovedSnapshotIfAny(s) {
        if (!s || !s.id) return;
        if (this.isApprovalGreenTickValid(s) || s.approval?.status === 'approved') {
            const snap = {
                capturedAtRevision: s.caseRevision,
                date: s.date || '',
                method: s.method || '',
                diagnosis: s.diagnosis || '',
                mainSurgeon: Number(s.mainSurgeon || 0),
                urgencyLevel: s.clinicalClassification?.urgencyLevel || 'elective',
                pathologyGroup: s.clinicalClassification?.pathologyGroup?.confirmedValue || '',
                catalogEntryId: s.clinicalClassification?.procedureClass?.confirmedCatalogEntryId || '',
                antithromboticSummary: this._formatAntithromboticSummary(s.clinicalChips?.antithromboticPlan),
                stomaPlan: s.clinicalChips?.stomaPlan?.value || '',
                crmStatus: s.clinicalChips?.contextChips?.cancerContext?.crmStatus || ''
            };
            this._approvedSnapCache[s.id] = snap;
            if (s.isTestSandboxCase) {
                try {
                    const raw = sessionStorage.getItem('ptdtt_sap_snap_v1');
                    const map = raw ? JSON.parse(raw) : {};
                    map[String(s.id)] = snap;
                    sessionStorage.setItem('ptdtt_sap_snap_v1', JSON.stringify(map));
                } catch (_) {}
            }
        }
    },

    _getCachedApprovedSnapshot(sid) {
        if (this._approvedSnapCache[sid]) return this._approvedSnapCache[sid];
        try {
            const raw = sessionStorage.getItem('ptdtt_sap_snap_v1');
            const map = raw ? JSON.parse(raw) : {};
            if (map[String(sid)]) return map[String(sid)];
        } catch (_) {}
        return null;
    },

    _formatAntithromboticSummary(anti) {
        if (!anti || !anti.confirmed) return 'Chưa xác nhận';
        const modeObj = SAP_ANTITHROMBOTIC_MODES.find(m => m.value === anti.mode);
        const base = modeObj ? modeObj.label : (anti.mode || '');
        if (anti.mode === 'none_confirmed') return base;
        return [base, anti.drugName, anti.lastDoseAt ? `Liều cuối: ${anti.lastDoseAt}` : '', anti.bridgingAgent ? `Bắc cầu: ${anti.bridgingAgent}` : ''].filter(Boolean).join(' · ');
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
            const err = new Error(payload.error || `Không thể thực hiện thao tác (HTTP ${resp.status})`);
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
                    const cat = res.catalog;
                    if (Array.isArray(cat.procedures)) {
                        cat.procedures = cat.procedures.map(p => ({
                            ...p,
                            id: p.id || p.catalogEntryId || '',
                            name: p.name || p.officialName || '',
                            rankCode: p.rankCode || p.procedureClass || 'unclassified',
                            rankLabel: p.rankLabel || (p.procedureClass === 'unclassified' ? 'Chưa phân loại' : (p.procedureClass || '—'))
                        }));
                    }
                    this._catalogData = cat;
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
        this._captureApprovedSnapshotIfAny(updatedSurgery);
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

    // ── BƯỚC 1.6: Persistent Per-User Scope Banner Collapse ──
    _getScopeHiddenKey() {
        const u = Auth.getSession()?.username || 'user';
        return `ptdtt_sap_hide_scope_${u}`;
    },

    isScopeBannerHidden() {
        try { return localStorage.getItem(this._getScopeHiddenKey()) === '1'; } catch (_) { return false; }
    },

    setScopeBannerHidden(hidden) {
        try {
            if (hidden) localStorage.setItem(this._getScopeHiddenKey(), '1');
            else localStorage.removeItem(this._getScopeHiddenKey());
        } catch (_) {}
        this._scopeDetailOpen = false;
        App.renderCurrentPage();
    },

    toggleScopeDetail() {
        this._scopeDetailOpen = !this._scopeDetailOpen;
        App.renderCurrentPage();
    },

    toggleMoreFilters() {
        this._moreFiltersOpen = !this._moreFiltersOpen;
        App.renderCurrentPage();
    },

    toggleCanaryMobile() {
        this._canaryCollapsedMobile = !this._canaryCollapsedMobile;
        App.renderCurrentPage();
    },

    // ── Main Tab Render (BƯỚC 1.1 -> 1.6) ──
    render() {
        if (!this.isFeatureVisibleForCurrentUser()) {
            return `
            <div class="card" style="padding:36px 20px;text-align:center;">
                <h2 style="margin-bottom:8px;color:var(--text-heading);">${this._ico('🔒')} Tính năng đang trong giai đoạn kiểm thử Super Admin</h2>
                <p style="color:var(--text-secondary);font-size:14px;">Tab Duyệt mổ tại khoa hiện chỉ mở cho Super Admin kiểm thử trước khi triển khai toàn khoa.</p>
            </div>`;
        }

        (Store._data?.surgeries || []).forEach(s => this._captureApprovedSnapshotIfAny(s));

        const cfg = this.getConfig();
        const actor = this.getEffectiveActor(null);
        // BƯỚC 1.5: Ẩn tab "Ủy quyền BCN" & "Nhật ký duyệt" với người không phải BCN
        const isActorBcn = SAP_BCN_IDS.has(actor.staffId);
        if (!isActorBcn && (this._subtab === 'delegations' || (this._subtab === 'logs' && !actor.isSimulated))) {
            this._subtab = 'cases';
        }

        const scopeHidden = this.isScopeBannerHidden();
        const roleSummary = this._getActorWorkRoleSummary(actor);

        return `
        <div class="sap-page">
            <div class="page-header">
                <div>
                    <h1 class="page-title">Duyệt mổ tại khoa</h1>
                    <p class="page-subtitle">Chuẩn bị hồ sơ tiền phẫu & phê duyệt chuyên môn nội bộ Khoa PT Đại trực tràng</p>
                </div>
                <div class="surg-header-actions">
                    ${scopeHidden ? `
                    <button type="button" class="sap-btn" onclick="SurgeryApprovalPage.setScopeBannerHidden(false)" title="Hiện thông tin phạm vi duyệt mổ nội bộ">
                        ${this._ico('ⓘ')} <span>Phạm vi duyệt khoa</span>
                    </button>` : ''}
                    <button type="button" class="sap-btn" onclick="App.navigate('surgery')">
                        ${this._ico('📅')} <span>Lịch mổ tuần</span>
                    </button>
                </div>
            </div>

            ${!scopeHidden ? `
            <div class="sap-scope-compact" role="region" aria-label="Phạm vi duyệt mổ nội bộ tại khoa">
                <div class="sap-scope-compact-main">
                    ${this._ico('🏥')}
                    <span><strong>Bước 1 nội bộ Khoa PTĐTT (độc lập phần mềm HIS)</strong> — Nhãn Đã duyệt xác nhận hoàn tất rà soát chuyên môn tại khoa trước mổ.</span>
                </div>
                <div class="sap-scope-compact-actions">
                    <button type="button" class="sap-btn sap-btn--ghost" onclick="SurgeryApprovalPage.toggleScopeDetail()" aria-expanded="${this._scopeDetailOpen}" aria-label="Chi tiết phạm vi độc lập HIS">
                        ${this._ico('ⓘ')} <span>Chi tiết</span>
                    </button>
                    <button type="button" class="sap-btn sap-btn--ghost" onclick="SurgeryApprovalPage.setScopeBannerHidden(true)" aria-label="Ẩn thông báo phạm vi">
                        <span>Ẩn</span> <span aria-hidden="true">&times;</span>
                    </button>
                </div>
            </div>
            ${this._scopeDetailOpen ? `
            <div class="sap-scope-detail">
                Quy trình này chuẩn hóa kiểm tra chỉ định, xếp cột phẫu thuật viên 2026, thuốc chống huyết khối, cận lâm sàng tiền phẫu và cam kết phẫu thuật nội bộ tại Khoa PT Đại trực tràng; hoàn toàn không kết nối và không thay thế thủ tục ký duyệt mổ toàn viện trên phần mềm HIS.
            </div>` : ''}` : ''}

            ${App.isSuperAdmin() ? this._renderCanaryToolbar(cfg) : ''}

            <div class="sap-top-nav-row">
                <div class="sap-subtabs" role="tablist" aria-label="Chế độ xem Duyệt mổ tại khoa">
                    <button type="button" role="tab" aria-selected="${this._subtab === 'cases'}"
                        class="sap-subtab-btn ${this._subtab === 'cases' ? 'active' : ''}"
                        onclick="SurgeryApprovalPage.switchSubtab('cases')">
                        ${this._ico('📋')} <span>Danh sách ca</span>
                    </button>
                    ${isActorBcn ? `
                    <button type="button" role="tab" aria-selected="${this._subtab === 'delegations'}"
                        class="sap-subtab-btn ${this._subtab === 'delegations' ? 'active' : ''}"
                        onclick="SurgeryApprovalPage.switchSubtab('delegations')">
                        ${this._ico('🤝')} <span>Ủy quyền BCN</span>
                    </button>
                    <button type="button" role="tab" aria-selected="${this._subtab === 'logs'}"
                        class="sap-subtab-btn ${this._subtab === 'logs' ? 'active' : ''}"
                        onclick="SurgeryApprovalPage.switchSubtab('logs')">
                        ${this._ico('🛡️')} <span>Nhật ký duyệt</span>
                    </button>` : ''}
                </div>
                <div class="sap-role-context-bar">
                    <span>${this._ico('👤')} <strong>${Utils.escapeHtml(actor.title ? actor.title + ' ' + actor.name : actor.name)}</strong> · ${Utils.escapeHtml(roleSummary)}</span>
                    ${this._filters.status !== 'all' ? `
                    <button type="button" class="sap-btn" id="sap-btn-show-all" onclick="SurgeryApprovalPage.setFilter('status', 'all')">
                        <span>Xem tất cả ca</span>
                    </button>` : `
                    <button type="button" class="sap-btn" id="sap-btn-back-my-work" onclick="SurgeryApprovalPage.setFilter('status', 'my_work')">
                        <span>Về Việc của tôi</span>
                    </button>`}
                </div>
            </div>

            <div id="sap-subtab-container">
                ${this._subtab === 'cases'
                    ? this._renderCasesSubtab(cfg, actor)
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

    _getActorWorkRoleSummary(actor) {
        if (actor.staffId === SAP_CHIEF_ID) return 'Chờ duyệt & Cần xử lý';
        if (actor.staffId === SAP_DEPUTY_ID) return 'Chờ tiền duyệt & Cần xử lý';
        if (SAP_TRAINEE_IDS.has(actor.staffId)) return 'Ca tôi cần chuẩn bị';
        if (SAP_ATTENDING_IDS.has(actor.staffId)) return 'Ca chờ tôi xác nhận / trình';
        return 'Theo dõi ca mổ khoa';
    },

    _isCaseMyWork(s, actor) {
        if (!s || s.approachType === 'nsth') return false;
        const st = s.approval?.status || 'draft_unsubmitted';
        const sid = Number(actor.staffId || 0);
        const rooms = this._catalogData?.podRoster?.rooms || {};
        const rmInfo = rooms[s.podAssignment?.wardRoom || ''] || {};

        if (sid === SAP_CHIEF_ID) {
            if (['submitted', 'preapproved', 'emergency_exception_pending_ack', 'reapproval_required', 'post_approval_hold'].includes(st)) return true;
            if (Number(s.mainSurgeon) === sid && ['draft_unsubmitted', 'ready_for_attending', 'returned_for_revision', 'resubmit_required'].includes(st)) return true;
            return false;
        }
        if (sid === SAP_DEPUTY_ID) {
            const hasDel = this._hasActiveDelegationForDeputy();
            if (st === 'submitted') return true;
            if (hasDel && st === 'preapproved') return true;
            if (['emergency_exception_pending_ack', 'reapproval_required', 'post_approval_hold'].includes(st)) return true;
            if ((Number(s.mainSurgeon) === sid || Number(s.coordinatingAttendingStaffId) === sid) && ['draft_unsubmitted', 'ready_for_attending', 'returned_for_revision', 'resubmit_required'].includes(st)) return true;
            return false;
        }
        if (SAP_TRAINEE_IDS.has(sid)) {
            if (!['draft_unsubmitted', 'returned_for_revision', 'resubmit_required', 'reapproval_required'].includes(st)) return false;
            if (Number(s.assistSurgeon1) === sid || Number(s.podAssignment?.preparedByStaffId) === sid) return true;
            if (Array.isArray(rmInfo.residentStaffIds) && rmInfo.residentStaffIds.map(Number).includes(sid)) return true;
            // Match POD of trainee if assigned to any room in that POD
            const traineePods = new Set(
                Object.values(rooms)
                    .filter(r => Array.isArray(r.residentStaffIds) && r.residentStaffIds.map(Number).includes(sid))
                    .map(r => Number(r.podId))
            );
            if (s.podAssignment?.suggestedPodId && traineePods.has(Number(s.podAssignment.suggestedPodId))) return true;
            return false;
        }
        if (SAP_ATTENDING_IDS.has(sid)) {
            if (!['draft_unsubmitted', 'ready_for_attending', 'returned_for_revision', 'resubmit_required', 'reapproval_required'].includes(st)) return false;
            if (Number(s.mainSurgeon) === sid || Number(s.coordinatingAttendingStaffId) === sid) return true;
            return false;
        }
        return !this.isApprovalGreenTickValid(s);
    },

    _getSimulatorRoleOptions() {
        const staffMap = new Map((Store.getAll('staff') || []).map(st => [Number(st.id), st]));
        const colTag = { 1: 'Trưởng khoa', 2: 'Phó TK', 3: 'ĐD Trưởng', 4: 'Cột ĐB', 5: 'Cột ĐB', 6: 'Cột I', 7: 'Cột II', 8: 'Cột II', 9: 'Cột II', 10: 'Cột III', 11: 'Cột III', 12: 'Cột III' };
        const dynamicIds = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 43, 44, 46, 3];
        const opts = [{ staffId: 0, label: 'Tài khoản hiện tại', shortLabel: 'Tài khoản thật' }];
        const seen = new Set([0]);
        for (const sid of dynamicIds) {
            const st = staffMap.get(sid);
            if (!st && !SAP_SIMULATOR_ROLES.some(r => r.staffId === sid)) continue;
            seen.add(sid);
            const fullName = st ? `${st.title ? st.title + ' ' : ''}${st.name}` : (SAP_SIMULATOR_ROLES.find(r => r.staffId === sid)?.label || `Nhân sự #${sid}`);
            const roleHint = colTag[sid] || (SAP_TRAINEE_IDS.has(sid) ? 'BS học viên' : '');
            opts.push({
                staffId: sid,
                label: `Giả lập [TEST]: ${fullName}${roleHint ? ` (${roleHint})` : ''}`,
                shortLabel: `${st ? st.name.split(' ').slice(-2).join(' ') : `#${sid}`}${roleHint ? ` · ${roleHint}` : ''}`
            });
        }
        return opts;
    },

    // ── Superadmin Canary Control & Zero-PHI Sandbox Toolbar (Zero <select> on mobile!) ──
    _renderCanaryToolbar(cfg) {
        const isLocked = cfg.rolloutAccessMode !== 'all_staff';
        const sandboxOnly = cfg.sandboxOnlyMode !== false;
        const sandboxCount = (Store._data?.surgeries || []).filter(s => s && s.isTestSandboxCase === true).length;
        const simOptions = this._getSimulatorRoleOptions();

        return `
        <div class="sap-canary-bar" id="sap-superadmin-toolbar">
            <div class="sap-canary-header">
                <div class="sap-canary-title">
                    ${this._ico('🛡️')} <span>Bảng Kiểm Thử Super Admin</span>
                    <span class="sap-canary-pill ${sandboxOnly ? 'sap-canary-pill--locked' : 'sap-canary-pill--live'}">
                        ${this._ico(sandboxOnly ? '🧪' : '🏥')} <span>${sandboxOnly ? 'Chỉ ca TEST (0% BN thật)' : 'Lịch mổ thật'}</span>
                    </span>
                    <span class="sap-canary-pill ${isLocked ? 'sap-canary-pill--locked' : 'sap-canary-pill--live'}">
                        ${this._ico(isLocked ? '🔒' : '🌐')} <span>${isLocked ? 'Chỉ Super Admin' : 'Mở toàn khoa'}</span>
                    </span>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                    <button type="button" class="sap-btn sap-btn--primary" id="sap-btn-seed-sandbox" onclick="SurgeryApprovalPage.seedSandboxCases(${sandboxCount > 0 ? 'true' : 'false'})">
                        ${this._ico('🎲')} <span>${sandboxCount > 0 ? `Tạo mới 16 ca TEST (${sandboxCount})` : 'Tạo 16 ca TEST'}</span>
                    </button>
                    <button type="button" class="sap-btn sap-btn--danger" id="sap-btn-clean-sandbox" onclick="SurgeryApprovalPage.cleanupSandboxCases()" ${sandboxCount === 0 ? 'disabled' : ''}>
                        ${this._ico('🧹')} <span>Xóa ca TEST</span>
                    </button>
                    <button type="button" class="sap-btn" onclick="SurgeryApprovalPage.toggleCanaryMobile()" aria-expanded="${!this._canaryCollapsedMobile}">
                        ${this._ico('⚙️')} <span>Cấu hình & Giả lập ${this._canaryCollapsedMobile ? '▾' : '▴'}</span>
                    </button>
                </div>
            </div>
            ${!this._canaryCollapsedMobile ? `
            <div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border-default);display:flex;flex-direction:column;gap:10px;">
                <div class="sap-filter-sub-group">
                    <span class="sap-filter-sub-label">Nguồn dữ liệu:</span>
                    <button type="button" class="sap-chip ${sandboxOnly ? 'sap-chip--selected' : ''}" onclick="SurgeryApprovalPage.updateConfigField('sandboxOnlyMode', true)">Chỉ ca TEST</button>
                    <button type="button" class="sap-chip ${!sandboxOnly ? 'sap-chip--selected' : ''}" onclick="SurgeryApprovalPage.updateConfigField('sandboxOnlyMode', false)">Mở Lịch mổ thật</button>
                    <span class="sap-filter-sub-label" style="margin-left:8px;">Hiển thị:</span>
                    <button type="button" class="sap-chip ${cfg.rolloutAccessMode === 'superadmin_only' ? 'sap-chip--selected' : ''}" onclick="SurgeryApprovalPage.updateConfigField('rolloutAccessMode', 'superadmin_only')">Chỉ Super Admin</button>
                    <button type="button" class="sap-chip ${cfg.rolloutAccessMode === 'all_staff' ? 'sap-chip--selected' : ''}" onclick="SurgeryApprovalPage.updateConfigField('rolloutAccessMode', 'all_staff')">Mở toàn Khoa</button>
                    <span class="sap-filter-sub-label" style="margin-left:8px;">Cổng kiểm tra:</span>
                    <button type="button" class="sap-chip ${cfg.checklistMode === 'enforced_gate' ? 'sap-chip--selected' : ''}" onclick="SurgeryApprovalPage.updateConfigField('checklistMode', 'enforced_gate')">Bắt buộc đủ mục</button>
                    <button type="button" class="sap-chip ${cfg.checklistMode === 'shadow_optional' ? 'sap-chip--selected' : ''}" onclick="SurgeryApprovalPage.updateConfigField('checklistMode', 'shadow_optional')">Khuyến khích</button>
                </div>
                <div class="sap-filter-sub-group">
                    <span class="sap-filter-sub-label">Giả lập vai trò:</span>
                    ${simOptions.slice(0, 9).map(r => `
                    <button type="button" class="sap-chip ${Number(this._simulatedStaffId) === r.staffId ? 'sap-chip--selected' : ''}"
                        onclick="SurgeryApprovalPage.setSimulatedRole('${r.staffId}')">${Utils.escapeHtml(r.shortLabel)}</button>`).join('')}
                </div>
            </div>` : ''}
        </div>`;
    },

    async updateConfigField(field, value) {
        try {
            const res = await this._api('/api/surgery-approval/config', 'PUT', { [field]: value });
            if (res && res.config && Store._data) {
                Store._data.surgeryApprovalConfig = res.config;
                Store._saveLocal();
            }
            await Store._syncFromServer(true);
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
        if (this._openCaseId) {
            const s = this._getCaseById(this._openCaseId);
            const actor = this.getEffectiveActor(s);
            this._bcnViewMode = this._shouldDefaultBcnSummary(s, actor) ? 'summary' : 'steps';
        }
        if (App.currentPage === 'surgery-approval') {
            App.renderCurrentPage();
        }
        if (this._openCaseId) {
            this._refreshOpenModal(this._openCaseId);
        }
    },

    async seedSandboxCases(replaceExisting = false) {
        try {
            const res = await this._api('/api/surgery-approval/sandbox/seed', 'POST', { replaceExisting: Boolean(replaceExisting) });
            await Store._syncFromServer(true);
            // Show all 16 seeded test cases immediately when Super Admin explicitly seeds sandbox
            this._filters.status = 'all';
            App.renderCurrentPage();
            const count = res.cases?.length || 16;
            if (res.alreadySeeded) {
                Toast.info(`Đã có sẵn ${count} ca mẫu [TEST] trong danh sách.`);
            } else if (replaceExisting) {
                Toast.success(`Đã làm mới ngẫu nhiên bộ ${count} ca TEST (0% bệnh nhân thật) đủ mọi tình huống!`);
            } else {
                Toast.success(`Đã khởi tạo ${count} ca TEST ngẫu nhiên Zero-PHI đủ mọi tình huống!`);
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

    // ── BƯỚC 1.1..1.4 & BƯỚC 3.1: Queue Filtering, Sticky Date Groups, Risk Flags & 3-Line Cards ──
    setFilter(key, val) {
        this._filters[key] = val;
        App.renderCurrentPage();
    },

    _getEligibleSurgeries(cfg) {
        const all = Store._data?.surgeries || [];
        const rolloutDate = cfg.rolloutEffectiveSurgeryDate || '2026-11-02';
        const sandboxOnly = cfg.sandboxOnlyMode !== false;
        return all.filter(s => {
            if (!s || typeof s !== 'object') return false;
            const st = s.approval?.status;
            if (st === 'trashed_inactive') return false;
            if (sandboxOnly) {
                if (s.isTestSandboxCase !== true || !App.isSuperAdmin()) return false;
                if (this._filters.scope === 'week' && typeof SurgeryPage !== 'undefined') {
                    const weekDates = SurgeryPage.getWeekDates().map(d => SurgeryPage.dateStr(d));
                    return weekDates.includes(s.date);
                }
                return true;
            }
            if (s.isTestSandboxCase === true) return App.isSuperAdmin();
            if (st === 'legacy_exempt') return false;
            if (this._filters.scope === 'week' && typeof SurgeryPage !== 'undefined') {
                const weekDates = SurgeryPage.getWeekDates().map(d => SurgeryPage.dateStr(d));
                return weekDates.includes(s.date);
            }
            if (st && !['legacy_exempt'].includes(st)) return true;
            return (s.date || '') >= rolloutDate;
        });
    },

    // Compute SLA Deadline Text & Semantic Color (< 4h yellow, overdue red) — BƯỚC 1.4
    _computeSlaDisplay(s, cfg) {
        const st = s.approval?.status || 'draft_unsubmitted';
        const urg = s.clinicalClassification?.urgencyLevel || 'elective';
        if (this.isApprovalGreenTickValid(s) || st === 'approved_with_exception') {
            return { text: 'Đã hoàn tất duyệt', icon: '✓', cls: 'sap-sla--done', isOverdue: false };
        }
        if (['submitted', 'preapproved'].includes(st)) {
            if (s.approval?.slaStatus === 'late') {
                return { text: 'Trình trễ hạn', icon: '⚠️', cls: 'sap-sla--soon', isOverdue: true };
            }
            return { text: 'Đã trình đúng hạn', icon: '✓', cls: 'sap-sla--done', isOverdue: false };
        }
        if (urg === 'emergency_exception' || st === 'emergency_exception_pending_ack') {
            return { text: 'Ngoại lệ cấp cứu', icon: '⚡', cls: 'sap-sla--overdue', isOverdue: false };
        }
        if (urg === 'semi_urgent') {
            return { text: 'Hạn ≥ 2h trước mổ (Bán khẩn)', icon: '🕒', cls: 'sap-sla--soon', isOverdue: false };
        }
        const dStr = s.date || '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
            return { text: 'Chưa rõ ngày mổ', icon: '🕒', cls: 'sap-sla--normal', isOverdue: false };
        }
        const [yy, mm, dd] = dStr.split('-').map(Number);
        const sla = cfg.slaConfig || {};
        const daysBefore = urg === 'elective_service' ? Number(sla.serviceDaysBefore ?? 1) : Number(sla.electiveDaysBefore ?? 2);
        const deadlineHour = urg === 'elective_service' ? Number(sla.serviceDeadlineHour ?? 13) : Number(sla.electiveDeadlineHour ?? 16);
        const dl = new Date(yy, mm - 1, dd - daysBefore, deadlineHour, 0, 0);
        const now = new Date();
        const diffMs = dl.getTime() - now.getTime();
        const isToday = dl.getFullYear() === now.getFullYear() && dl.getMonth() === now.getMonth() && dl.getDate() === now.getDate();
        const pad2 = n => String(n).padStart(2, '0');
        const dayStr = isToday ? 'hôm nay' : `${pad2(dl.getDate())}.${pad2(dl.getMonth() + 1)}`;
        const hrStr = `${pad2(deadlineHour)}:00`;

        if (diffMs < 0) {
            const lateHrs = Math.max(1, Math.round(Math.abs(diffMs) / 3600000));
            return {
                text: `Quá hạn ${hrStr} ${dayStr} (trễ ${lateHrs} giờ)`,
                icon: '⛔',
                cls: 'sap-sla--overdue',
                isOverdue: true
            };
        }
        const remHrs = Math.floor(diffMs / 3600000);
        const remMins = Math.max(1, Math.floor((diffMs % 3600000) / 60000));
        if (diffMs < 4 * 3600000) {
            const sub = remHrs >= 1 ? `còn ${remHrs} giờ` : `còn ${remMins} phút`;
            return {
                text: `Hạn ${hrStr} ${dayStr} (${sub})`,
                icon: '⚠️',
                cls: 'sap-sla--soon',
                isOverdue: false
            };
        }
        const sub = remHrs < 36 ? ` (còn ${remHrs} giờ)` : '';
        return {
            text: `Hạn ${hrStr} ${dayStr}${sub}`,
            icon: '🕒',
            cls: 'sap-sla--normal',
            isOverdue: false
        };
    },

    // BƯỚC 3.1: Cờ rủi ro ưu tiên cho BCN ("xem ngoại lệ trước")
    _computeCaseRiskFlags(s, cfg) {
        const flags = [];
        const cc = s.clinicalClassification || {};
        const col = cc.columnCompliance || {};
        const chips = s.clinicalChips || {};
        const anti = chips.antithromboticPlan || {};
        const ck = s.preopChecklist || {};
        const app = s.approval || {};
        const st = app.status || 'draft_unsubmitted';
        const isExternalMain = s.mainSurgeon && !SAP_ATTENDING_IDS.has(Number(s.mainSurgeon)) && !SAP_TRAINEE_IDS.has(Number(s.mainSurgeon));

        if (st === 'emergency_exception_pending_ack' || cc.urgencyLevel === 'emergency_exception') {
            flags.push({ icon: '⚡', label: 'Ngoại lệ cấp cứu', severity: 'danger' });
        }
        if (col.systemCheck === 'over_column' || col.declaredMode === 'propose_over_column') {
            flags.push({ icon: '⚠️', label: 'Vượt cột PT', severity: 'danger' });
        }
        if (cc.pathologyGroup?.confirmedValue === 'cancer_confirmed') {
            const b3 = chips.contextChips?.cancerContext || {};
            const locs = b3.tumorLocation || [];
            const isRectal = locs.some(l => String(l).startsWith('rectum_') || l === 'anal_canal');
            if (isRectal && (!b3.crmStatus || ['crm_threatened_or_positive', 'unknown_no_pelvic_mri'].includes(b3.crmStatus))) {
                flags.push({
                    icon: '⚠️',
                    label: b3.crmStatus === 'crm_threatened_or_positive' ? 'K trực tràng CRM(+)' : 'K trực tràng chưa MRI',
                    severity: 'danger'
                });
            }
        }
        if (anti.confirmed && ['continued_per_plan', 'bridging_per_plan', 'unheld_urgent_risk'].includes(anti.mode)) {
            const lbl = anti.mode === 'bridging_per_plan' ? 'Kháng đông bắc cầu' : (anti.mode === 'continued_per_plan' ? 'Kháng đông tiếp tục' : 'Kháng đông chưa ngưng đủ');
            flags.push({ icon: '⚠️', label: lbl, severity: 'warn' });
        }
        const abnCount = Object.values(ck).filter(it => it && it.state === 'verified_abnormal_planned').length;
        if (abnCount > 0) {
            flags.push({ icon: '⚠️', label: `Có mục Bất thường (${abnCount})`, severity: 'warn' });
        }
        if (isExternalMain) {
            flags.push({ icon: '🤝', label: 'BS ngoài khoa', severity: 'warn' });
        }
        const slaInfo = this._computeSlaDisplay(s, cfg);
        if (app.slaStatus === 'late' || slaInfo.isOverdue) {
            flags.push({ icon: '⛔', label: 'Trễ hạn trình', severity: 'warn' });
        }
        return flags;
    },

    // Dossier completion progress ("Hồ sơ 9/13") — BƯỚC 1.4
    _computeDossierProgress(s) {
        const missing = this._computeMissingRequirements(s, { staffId: Number(s.mainSurgeon) || 8 });
        // Base total items: 4 in Step 1 + 5 in Step 2 + 5 independent CK in Step 3 = 14 (or 13 when no special sub-module)
        const pgVal = s.clinicalClassification?.pathologyGroup?.confirmedValue || s.clinicalClassification?.pathologyGroup?.suggestedValue;
        const hasMod = ['benign_anorectal', 'benign_colorectal_abdominal', 'cancer_confirmed', 'neoplasm_suspected_or_special'].includes(pgVal);
        const total = hasMod ? 14 : 13;
        if (this.isApprovalGreenTickValid(s) || ['submitted', 'preapproved', 'approved_with_exception'].includes(s.approval?.status)) {
            return { done: total, total };
        }
        const done = Math.max(0, total - missing.length);
        return { done, total };
    },

    _renderCasesSubtab(cfg, actor) {
        const baseList = this._getEligibleSurgeries(cfg);
        const podFiltered = baseList.filter(s => {
            if (this._filters.podId !== 'all') {
                return String(s.podAssignment?.suggestedPodId || '') === String(this._filters.podId);
            }
            return true;
        });

        const matchBucket = (s, bucket) => {
            const st = s.approval?.status || 'draft_unsubmitted';
            if (bucket === 'my_work') return this._isCaseMyWork(s, actor);
            if (bucket === 'unsubmitted') return s.approachType !== 'nsth' && ['draft_unsubmitted', 'ready_for_attending', 'resubmit_required', 'legacy_unverified_manual_review'].includes(st);
            if (bucket === 'pending_bcn') return ['submitted', 'preapproved', 'reapproval_required'].includes(st);
            if (bucket === 'needs_attention') return ['returned_for_revision', 'revoked_by_bcn', 'post_approval_hold', 'emergency_exception_pending_ack', 'reapproval_required'].includes(st);
            if (bucket === 'approved_valid') return this.isApprovalGreenTickValid(s) || st === 'approved_with_exception';
            return true;
        };

        const cntMyWork = podFiltered.filter(s => matchBucket(s, 'my_work')).length;
        const cntUnsub = podFiltered.filter(s => matchBucket(s, 'unsubmitted')).length;
        const cntPending = podFiltered.filter(s => matchBucket(s, 'pending_bcn')).length;
        const cntAttention = podFiltered.filter(s => matchBucket(s, 'needs_attention')).length;
        const cntApproved = podFiltered.filter(s => matchBucket(s, 'approved_valid')).length;

        const q = (this._filters.search || '').trim().toLowerCase();
        const isActorBcn = SAP_BCN_IDS.has(actor.staffId);

        const filtered = podFiltered.filter(s => {
            if (this._filters.status !== 'all' && !matchBucket(s, this._filters.status)) return false;
            if (q) {
                const hay = `${s.patientName || ''} ${s.method || ''} ${s.diagnosis || ''} ${Utils.getStaffName(s.mainSurgeon) || ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        }).sort((a, b) => {
            const dCmp = (a.date || '').localeCompare(b.date || '');
            if (dCmp !== 0) return dCmp;
            // BƯỚC 3.1: BCN sees cases with Risk Flags first within each date!
            if (isActorBcn) {
                const rA = this._computeCaseRiskFlags(a, cfg).length;
                const rB = this._computeCaseRiskFlags(b, cfg).length;
                if ((rB > 0) !== (rA > 0)) return rB - rA;
            }
            return Number(a.id) - Number(b.id);
        });

        const filterChips = [
            { key: 'my_work', label: 'Việc của tôi', count: cntMyWork },
            { key: 'unsubmitted', label: 'Chưa trình', count: cntUnsub },
            { key: 'pending_bcn', label: 'Chờ duyệt', count: cntPending },
            { key: 'needs_attention', label: 'Cần xử lý', count: cntAttention },
            { key: 'approved_valid', label: 'Đã duyệt', count: cntApproved }
        ];

        // Group by Surgery Date (BƯỚC 1.3)
        const groups = new Map();
        for (const s of filtered) {
            const dk = s.date || 'Chưa xếp ngày';
            if (!groups.has(dk)) groups.set(dk, []);
            groups.get(dk).push(s);
        }

        const hasExtraFilter = this._filters.podId !== 'all' || this._filters.scope !== 'all_open';

        return `
        <div class="sap-filter-toolbar">
            <div class="sap-filter-row-main">
                <div class="sap-filter-chips-wrap" role="group" aria-label="Bộ lọc trạng thái ca mổ">
                    ${filterChips.map(fc => `
                    <button type="button" class="sap-filter-chip ${this._filters.status === fc.key ? 'is-active' : ''}"
                        data-filter-chip="${fc.key}"
                        onclick="SurgeryApprovalPage.setFilter('status', '${fc.key}')">
                        <span>${Utils.escapeHtml(fc.label)}</span>
                        <span class="sap-filter-count">${fc.count}</span>
                    </button>`).join('')}
                </div>
                <div class="sap-filter-search-group">
                    <input id="sap-f-search" type="search" class="sap-input" placeholder="Tìm họ tên BN, phương pháp, BS mổ..."
                        aria-label="Tìm kiếm ca mổ"
                        value="${Utils.escapeHtml(this._filters.search)}"
                        oninput="SurgeryApprovalPage.setFilter('search', this.value)">
                    <button type="button" class="sap-btn ${hasExtraFilter ? 'sap-btn--primary' : ''}" id="sap-btn-more-filters"
                        aria-expanded="${this._moreFiltersOpen}"
                        onclick="SurgeryApprovalPage.toggleMoreFilters()">
                        <span>Lọc thêm ${this._moreFiltersOpen ? '▴' : '▾'}</span>
                    </button>
                </div>
            </div>
            ${this._moreFiltersOpen ? `
            <div class="sap-filter-more-drawer">
                <div class="sap-filter-sub-group" role="group" aria-label="Lọc theo nhóm buồng bệnh POD">
                    <span class="sap-filter-sub-label">Nhóm buồng (POD):</span>
                    ${[
                        { v: 'all', l: 'Tất cả POD' },
                        { v: '1', l: 'POD 1 (707, 718)' },
                        { v: '2', l: 'POD 2 (705..719)' },
                        { v: '3', l: 'POD 3 (708..710)' }
                    ].map(p => `<button type="button" class="sap-chip ${this._filters.podId === p.v ? 'sap-chip--selected' : ''}"
                        onclick="SurgeryApprovalPage.setFilter('podId', '${p.v}')">${Utils.escapeHtml(p.l)}</button>`).join('')}
                </div>
                <div class="sap-filter-sub-group" role="group" aria-label="Lọc theo phạm vi tuần">
                    <span class="sap-filter-sub-label">Phạm vi tuần:</span>
                    <button type="button" class="sap-chip ${this._filters.scope === 'all_open' ? 'sap-chip--selected' : ''}"
                        onclick="SurgeryApprovalPage.setFilter('scope', 'all_open')">Tất cả ca mở</button>
                    <button type="button" class="sap-chip ${this._filters.scope === 'week' ? 'sap-chip--selected' : ''}"
                        onclick="SurgeryApprovalPage.setFilter('scope', 'week')">Theo tuần lịch mổ</button>
                </div>
            </div>` : ''}
        </div>

        ${filtered.length > 0 ? Array.from(groups.entries()).map(([dateKey, items]) => this._renderDateGroupHtml(dateKey, items, cfg, actor)).join('') : `
        <div class="card" style="padding:32px 20px;text-align:center;">
            <div style="font-size:28px;margin-bottom:8px;">${this._ico('📋')}</div>
            <h3 style="color:var(--text-heading);margin-bottom:6px;font-size:16px;">
                ${this._filters.status === 'my_work' ? 'Không còn ca mổ nào chờ xử lý trong danh sách "Việc của tôi"' : 'Chưa có ca mổ nào khớp bộ lọc hiện tại'}
            </h3>
            <p style="color:var(--text-secondary);font-size:14px;margin-bottom:12px;">
                ${baseList.length > 0 && this._filters.status !== 'all'
                    ? `Hiện có tổng cộng <strong>${baseList.length} ca</strong> trong danh sách mở của khoa.`
                    : (App.isSuperAdmin() ? 'Bấm nút <strong>"Tạo 16 ca TEST"</strong> phía trên để khởi tạo dữ liệu mẫu đủ các tình huống lâm sàng.' : 'Các ca mổ dự kiến trên Lịch mổ tuần sẽ tự động hiển thị tại đây.')}
            </p>
            ${baseList.length > 0 && this._filters.status !== 'all' ? `
            <button type="button" class="sap-btn sap-btn--primary" onclick="SurgeryApprovalPage.setFilter('status', 'all')">
                Xem tất cả ${baseList.length} ca
            </button>` : ''}
        </div>`}`;
    },

    _formatStickyDateTitle(dateKey) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
        const [yy, mm, dd] = dateKey.split('-').map(Number);
        const d = new Date(yy, mm - 1, dd);
        const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        const pad2 = n => String(n).padStart(2, '0');
        return `${dayNames[d.getDay()]} ${pad2(dd)}.${pad2(mm)}`;
    },

    _renderDateGroupHtml(dateKey, items, cfg, actor) {
        const unsubCount = items.filter(s => s.approachType !== 'nsth' && ['draft_unsubmitted', 'ready_for_attending', 'returned_for_revision', 'resubmit_required'].includes(s.approval?.status || 'draft_unsubmitted')).length;
        const pendingBcnCount = items.filter(s => ['submitted', 'preapproved', 'reapproval_required', 'emergency_exception_pending_ack'].includes(s.approval?.status)).length;
        const summaryParts = [`${items.length} ca`];
        if (unsubCount > 0) summaryParts.push(`${unsubCount} chưa trình`);
        if (pendingBcnCount > 0) summaryParts.push(`${pendingBcnCount} chờ duyệt`);

        return `
        <section class="sap-date-group" aria-label="Ngày mổ ${Utils.escapeHtml(dateKey)}">
            <div class="sap-date-sticky-header">
                <span>${this._ico('📅')} ${Utils.escapeHtml(this._formatStickyDateTitle(dateKey))} · ${Utils.escapeHtml(summaryParts.join(' · '))}</span>
            </div>
            <div class="sap-case-list">
                ${items.map(s => this._renderCaseCard(s, cfg, actor)).join('')}
            </div>
        </section>`;
    },

    _formatPodLabel(podId) {
        if (!podId) return '';
        const str = String(podId).trim();
        return /^\d+$/.test(str) ? `POD ${str}` : str.replace(/_/g, ' ');
    },

    // BƯỚC 1.4 & BƯỚC 3.1: Thẻ ca gọn 3 dòng (cả thẻ bấm được, bỏ nút "Mở hồ sơ", ẩn Số NV, vN, Chẩn đoán dài)
    _renderCaseCard(s, cfg, actor) {
        const isNsth = s.approachType === 'nsth';
        const roomStr = s.podAssignment?.wardRoom && s.podAssignment.wardRoom !== 'unassigned'
            ? `P.${s.podAssignment.wardRoom}`
            : 'Chưa xếp phòng';
        const podStr = s.podAssignment?.suggestedPodId ? ` (${this._formatPodLabel(s.podAssignment.suggestedPodId)})` : '';
        const pcClass = s.clinicalClassification?.procedureClass?.confirmedClass
            || s.clinicalClassification?.procedureClass?.suggestedClass
            || 'Chưa xếp hạng';
        const mainName = Utils.getStaffName(s.mainSurgeon) || 'Chưa chọn BS chính';
        const approachLabel = ({ mo: 'Mổ mở', noisoi: 'Nội soi', nsth: 'NSTH', robot: 'Robot' })[s.approachType] || s.approachType || '—';
        const wasEditedAfterApprove = Boolean(s.approval?.lastApprovedSnapshot) && !this.isApprovalGreenTickValid(s);
        const prog = this._computeDossierProgress(s);
        const pct = Math.min(100, Math.round((prog.done / Math.max(1, prog.total)) * 100));
        const sla = this._computeSlaDisplay(s, cfg);

        const isActorBcn = SAP_BCN_IDS.has(actor.staffId);
        const riskFlags = !isNsth ? this._computeCaseRiskFlags(s, cfg) : [];
        let riskPillHtml = '';
        if (!isNsth && (isActorBcn || riskFlags.length > 0)) {
            if (riskFlags.length === 0) {
                riskPillHtml = `<span class="sap-risk-pill sap-risk-pill--standard" title="Không có cờ ngoại lệ lâm sàng">${this._ico('✓')} <span>Hồ sơ chuẩn</span></span>`;
            } else {
                const top = riskFlags[0];
                const extra = riskFlags.length > 1 ? ` +${riskFlags.length - 1}` : '';
                const allTips = riskFlags.map(f => f.label).join(' · ');
                riskPillHtml = `<span class="sap-risk-pill sap-risk-pill--${top.severity}" title="${Utils.escapeHtml(allTips)}">${this._ico(top.icon)} <span>${Utils.escapeHtml(top.label + extra)}</span></span>`;
            }
        }

        const clickAttrs = !isNsth
            ? `role="button" tabindex="0" onclick="SurgeryApprovalPage.openCaseModal(${s.id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();SurgeryApprovalPage.openCaseModal(${s.id});}" aria-label="Mở hồ sơ duyệt mổ bệnh nhân ${Utils.escapeHtml(Utils.toProperCase(s.patientName || ''))}"`
            : '';

        return `
        <article class="sap-case-card ${s.isTestSandboxCase ? 'sap-case-card--sandbox' : ''} ${isNsth ? 'sap-case-card--readonly' : ''}"
            data-approval-card-id="${s.id}" ${clickAttrs}>
            <div class="sap-card-line1">
                <div class="sap-card-patient">
                    ${s.isTestSandboxCase ? `<span class="sap-tag sap-tag--sandbox">TEST</span>` : ''}
                    <span>${Utils.escapeHtml(Utils.toProperCase(s.patientName || ''))}</span>
                    ${s.birthYear ? `<span class="sap-card-yob">(${Utils.escapeHtml(String(s.birthYear))})</span>` : ''}
                    ${wasEditedAfterApprove ? `<span class="sap-tag sap-tag--modified">${this._ico('🔄')} <span>Đã sửa sau khi duyệt</span></span>` : ''}
                </div>
                <div class="sap-card-badges">
                    ${riskPillHtml}
                    ${this.renderBadge(s)}
                </div>
            </div>
            <div class="sap-card-line2">
                <span><strong>${Utils.escapeHtml(roomStr + podStr)}</strong></span>
                <span aria-hidden="true">·</span>
                <span><strong>${Utils.escapeHtml(mainName)}</strong></span>
                <span aria-hidden="true">·</span>
                <span>${Utils.escapeHtml(approachLabel)}</span>
                <span aria-hidden="true">·</span>
                <span><strong>${Utils.escapeHtml(pcClass === 'unclassified' ? 'Chưa phân loại' : pcClass)}</strong></span>
            </div>
            <div class="sap-card-line3">
                <div class="sap-card-method" title="${Utils.escapeHtml(s.method || '')}">
                    ${Utils.escapeHtml(s.method || 'Chưa ghi phương pháp phẫu thuật')}
                </div>
                ${!isNsth ? `
                <div class="sap-card-metrics">
                    <span class="sap-progress-pill" title="Tiến độ hoàn thiện các mục chuẩn bị trước mổ">
                        <span>Hồ sơ ${prog.done}/${prog.total}</span>
                        <span class="sap-progress-bar-mini" aria-hidden="true"><span class="sap-progress-bar-fill ${prog.done >= prog.total ? 'is-done' : ''}" style="width:${pct}%"></span></span>
                    </span>
                    <span class="sap-sla-pill ${sla.cls}">
                        ${this._ico(sla.icon)} <span>${Utils.escapeHtml(sla.text)}</span>
                    </span>
                </div>` : ''}
            </div>
        </article>`;
    },

    // ── Subtab 2: Time-Bounded BCN Delegations (BCN Only) ──
    _renderDelegationsSubtab() {
        const dels = (Store._data?.approvalDelegations || []).slice().reverse();
        const actor = this.getEffectiveActor(null);
        const canCreate = actor.staffId === SAP_CHIEF_ID || App.isSuperAdmin();
        const nowIsoLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        const tomorrowIsoLocal = new Date(Date.now() + 24 * 3600000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        const curScope = this._delScopeDraft || 'all_departmental_surgeries';

        return `
        <div class="sap-section">
            <div class="sap-section-header">
                <h2 class="sap-section-title">${this._ico('🤝')} Quản lý Ủy quyền Phê duyệt Mổ (Trưởng khoa → Phó Trưởng khoa)</h2>
            </div>
            <p style="font-size:13.5px;color:var(--text-secondary);margin:0;">
                Phó Trưởng khoa (<strong>BSCKII. Vũ Khương An</strong>) thực hiện Tiền duyệt thường xuyên và chốt Phê duyệt tại khoa thay Trưởng khoa (<strong>TS. BSCKII. Nguyễn Phú Hữu</strong>) khi có bản ghi Ủy quyền đang trong khung giờ hiệu lực.
            </p>
            ${canCreate ? `
            <form onsubmit="SurgeryApprovalPage.submitDelegation(event)" class="sap-exec-box">
                <div class="sap-canary-grid">
                    <div class="sap-canary-field">
                        <label for="sap-del-from">Hiệu lực từ</label>
                        <input id="sap-del-from" name="effectiveFrom" type="datetime-local" class="sap-input" value="${nowIsoLocal}" required>
                    </div>
                    <div class="sap-canary-field">
                        <label for="sap-del-to">Hiệu lực đến</label>
                        <input id="sap-del-to" name="effectiveTo" type="datetime-local" class="sap-input" value="${tomorrowIsoLocal}" required>
                    </div>
                </div>
                <div class="sap-canary-field" style="margin-top:8px;">
                    <label>Phạm vi ủy quyền</label>
                    <input type="hidden" name="scope" id="sap-del-scope" value="${Utils.escapeHtml(curScope)}">
                    <div class="sap-chip-group">
                        <button type="button" class="sap-chip ${curScope === 'all_departmental_surgeries' ? 'sap-chip--selected' : ''}"
                            onclick="SurgeryApprovalPage._delScopeDraft='all_departmental_surgeries';App.renderCurrentPage();">Toàn bộ ca mổ thuộc Khoa PTĐTT</button>
                        <button type="button" class="sap-chip ${curScope === 'routine_only' ? 'sap-chip--selected' : ''}"
                            onclick="SurgeryApprovalPage._delScopeDraft='routine_only';App.renderCurrentPage();">Chỉ ca mổ thường quy / bán khẩn</button>
                    </div>
                </div>
                <div class="sap-canary-field" style="margin-top:8px;">
                    <label for="sap-del-reason">Lý do ủy quyền (công tác, hội nghị, nghỉ phép...)</label>
                    <input id="sap-del-reason" name="reason" class="sap-input" required minlength="5"
                        placeholder="Ví dụ: Đi công tác / Hội nghị ngoại khoa...">
                </div>
                <div style="display:flex;justify-content:flex-end;margin-top:8px;">
                    <button type="submit" class="sap-btn sap-btn--primary">
                        ${this._ico('✅')} <span>${actor.staffId === SAP_CHIEF_ID ? 'Cấp ủy quyền duyệt mổ' : 'Cấp ủy quyền mẫu [TEST]'}</span>
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
                                ? 'Đã thu hồi'
                                : (isActive ? 'Đang có hiệu lực' : (nowMs < fMs ? 'Chưa tới giờ' : 'Đã hết hạn'));
                            return `
                            <tr>
                                <td>
                                    <strong>${Utils.escapeHtml(d.delegationId)}</strong>
                                    ${d.isTestSandboxDelegation ? '<br><span class="sap-tag sap-tag--sandbox">TEST</span>' : ''}
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
            scope: f.get('scope') || this._delScopeDraft || 'all_departmental_surgeries',
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

    // ── Subtab 3: Nhật ký duyệt (BCN-Only Hash-Chained Audit Journal) ──
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
            return `<div class="card" style="padding:28px;text-align:center;">${this._ico('⏳')} Đang xác thực quyền Ban Chủ nhiệm & kiểm tra tính toàn vẹn Nhật ký duyệt...</div>`;
        }
        if (!this._logsState.ok) {
            return `
            <div class="sap-alert sap-alert--danger">
                <strong>${this._ico('⛔')} Từ chối truy cập (HTTP ${this._logsState.status || 403}):</strong> ${Utils.escapeHtml(this._logsState.error)}
            </div>`;
        }
        const d = this._logsState.data;
        const entries = d.entries || [];
        return `
        <div class="sap-section">
            <div class="sap-section-header">
                <h2 class="sap-section-title">${this._ico('🛡️')} Nhật ký duyệt (Chỉ dành cho Trưởng khoa & Phó Trưởng khoa)</h2>
                <button type="button" class="sap-btn" onclick="SurgeryApprovalPage.loadAuditLogs()">${this._ico('🔄')} <span>Làm mới</span></button>
            </div>
            <div class="sap-alert ${d.chainValid ? 'sap-alert--success' : 'sap-alert--danger'}">
                <strong>${d.chainValid ? 'Chuỗi nhật ký SHA-256 toàn vẹn 100%' : 'Cảnh báo đứt gãy chuỗi nhật ký'}:</strong>
                Tổng số sự kiện: <strong>${d.totalEvents}</strong> · Mã kiểm định: <span class="sap-hash-mono">${Utils.escapeHtml((d.headHash || '').slice(0, 24))}…</span>
            </div>
            <div class="sap-log-table-wrap">
                <table class="sap-log-table">
                    <thead>
                        <tr>
                            <th>Thứ tự</th>
                            <th>Thời điểm</th>
                            <th>Người thực hiện</th>
                            <th>Thao tác</th>
                            <th>Mã kiểm định</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${entries.length > 0 ? entries.map(e => `
                        <tr>
                            <td><strong>#${e.eventSeq}</strong></td>
                            <td>${Utils.escapeHtml((e.timestamp || '').replace('T', ' '))}</td>
                            <td>
                                <strong>${Utils.escapeHtml(e.actor?.name || '')}</strong>
                                ${(e.actor?.isSimulated || e.actor?.simulatedBySuperAdminStaffId) ? '<br><span class="sap-tag sap-tag--sandbox">Giả lập TEST</span>' : ''}
                            </td>
                            <td>
                                <strong>${Utils.escapeHtml(e.action || '')}</strong>
                                ${e.surgeryId ? `<br>Hồ sơ #${e.surgeryId}` : ''}
                            </td>
                            <td class="sap-hash-mono">${Utils.escapeHtml((e.entryHash || '').slice(0, 20))}…</td>
                        </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;padding:20px;">Chưa có sự kiện nào trong nhật ký duyệt.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>`;
    },

    // ── Case Retrieval & Modal Lifecycle Helpers ──
    _getCaseById(sid) {
        return (Store._data?.surgeries || []).find(x => Number(x.id) === Number(sid)) || null;
    },

    _onModalClosed() {
        this._openCaseId = null;
        this._moreActionsOpen = false;
        this._activeActionDrawer = null;
        this._highlightFieldId = null;
        this._lastGateErrors = null;
        if (this._bulkUndoTimer) {
            clearTimeout(this._bulkUndoTimer);
            this._bulkUndoTimer = null;
        }
        this._bulkUndoExpiresAt = 0;
    },

    _shouldDefaultBcnSummary(s, actor) {
        if (!s || !actor || !SAP_BCN_IDS.has(Number(actor.staffId))) return false;
        const st = s.approval?.status || 'draft_unsubmitted';
        return ['submitted', 'preapproved', 'reapproval_required', 'emergency_exception_pending_ack', 'approved', 'approved_with_exception', 'post_approval_hold'].includes(st);
    },

    // Enrich cached approvedSnapshot from WAL logs when BCN opens a re-approval case
    async _hydrateApprovedSnapshotFromWal(s) {
        if (!s || !s.approval?.lastApprovedSnapshot) return;
        const targetRev = Number(s.approval.lastApprovedSnapshot.caseRevision || 0);
        const existing = this._getCachedApprovedSnapshot(s.id);
        if (existing && Number(existing.capturedAtRevision) === targetRev) return;
        try {
            const res = await this._api('/api/surgery-approval/logs?limit=120', 'GET', null, { allowSimulation: true });
            const entries = res?.entries || [];
            const match = entries.find(e => Number(e.surgeryId) === Number(s.id) && (e.action === 'approve_routine' || Number(e.caseRevAfter) === targetRev) && e.committedStatePatch?.surgeryRecord);
            const rec = match?.committedStatePatch?.surgeryRecord;
            if (rec) {
                const snap = {
                    capturedAtRevision: rec.caseRevision,
                    date: rec.date || '',
                    method: rec.method || '',
                    diagnosis: rec.diagnosis || '',
                    mainSurgeon: Number(rec.mainSurgeon || 0),
                    urgencyLevel: rec.clinicalClassification?.urgencyLevel || 'elective',
                    pathologyGroup: rec.clinicalClassification?.pathologyGroup?.confirmedValue || '',
                    catalogEntryId: rec.clinicalClassification?.procedureClass?.confirmedCatalogEntryId || '',
                    antithromboticSummary: this._formatAntithromboticSummary(rec.clinicalChips?.antithromboticPlan),
                    stomaPlan: rec.clinicalChips?.stomaPlan?.value || '',
                    crmStatus: rec.clinicalChips?.contextChips?.cancerContext?.crmStatus || ''
                };
                this._approvedSnapCache[s.id] = snap;
                if (this._openCaseId === s.id) {
                    this._refreshOpenModal(s.id);
                }
            }
        } catch (_) {}
    },

    // ── BƯỚC 2.1, 3.2, 4.2: Open Case Right Drawer (Desktop 1040px 2-Col / Mobile 100vw Full-Screen) ──
    async openCaseModal(surgeryId, opts = {}) {
        await this.ensureCatalogLoaded();
        const s = this._getCaseById(surgeryId);
        if (!s) {
            Toast.warning('Không tìm thấy ca mổ tương ứng.');
            return;
        }
        if (s.approachType === 'nsth') {
            Toast.info('Ca Nội soi tiêu hóa thuộc thẩm quyền phê duyệt của Khoa NSTH.');
            return;
        }
        this._captureApprovedSnapshotIfAny(s);
        this._openCaseId = s.id;
        this._catalogQuery = '';
        this._activeActionDrawer = null;
        this._moreActionsOpen = false;
        this._highlightFieldId = null;
        this._lastGateErrors = null;
        this._returnChipDraft = Array.isArray(s.approval?.returnFeedback?.chips) ? [...s.approval.returnFeedback.chips] : [];
        this._holdCatDraft = 'clinical_change';
        this._emLeaderDraft = 1;
        this._emChannelDraft = 'phone';
        this._emOwnerDraft = Number(s.mainSurgeon || 0);
        this._expandedSteps = { 1: null, 2: null, 3: null };

        const actor = this.getEffectiveActor(s);
        const notifType = String(opts.notifType || '');
        const returnedFields = this._computeReturnedHighlightFieldIds(s);

        if (opts.viewMode) {
            this._bcnViewMode = opts.viewMode;
        } else if (notifType === 'surgery_returned_for_revision' || s.approval?.status === 'returned_for_revision') {
            this._bcnViewMode = 'steps';
        } else {
            this._bcnViewMode = this._shouldDefaultBcnSummary(s, actor) ? 'summary' : 'steps';
        }

        // BƯỚC 4.2: Deep-link directly to relevant step from Bell Notification or Returned status
        const missing = this._computeMissingRequirements(s, actor);
        if (notifType === 'surgery_ready_for_attending' || s.approval?.status === 'ready_for_attending') {
            this._currentFocusStep = 3;
            this._expandedSteps[3] = true;
            this._highlightFieldId = 'sap-attending-only-box';
        } else if (returnedFields.size > 0) {
            const firstRet = Array.from(returnedFields)[0];
            const retStep = firstRet.startsWith('sap-ck-') ? 3 : (firstRet === 'sap-f-catalog' ? 1 : 2);
            this._currentFocusStep = retStep;
            this._expandedSteps[retStep] = true;
            this._highlightFieldId = firstRet;
        } else if (missing.length > 0) {
            this._currentFocusStep = missing[0].step;
            this._expandedSteps[missing[0].step] = true;
        } else {
            this._currentFocusStep = 3;
        }

        const titleText = `Hồ sơ duyệt mổ — ${Utils.toProperCase(s.patientName || '')}${s.birthYear ? ` (${s.birthYear})` : ''}`;
        Modal.open(titleText, this._buildCaseModalHtml(s));
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('modal');
        if (overlay) overlay.classList.add('sap-drawer-overlay');
        if (modal) modal.classList.add('sap-drawer-right');

        if (SAP_BCN_IDS.has(actor.staffId) && s.approval?.lastApprovedSnapshot) {
            this._hydrateApprovedSnapshotFromWal(s);
        }
        if (this._highlightFieldId) {
            requestAnimationFrame(() => this._scrollToFieldInDrawer(this._highlightFieldId));
        }
    },

    _refreshOpenModal(surgeryId) {
        if (Number(this._openCaseId) !== Number(surgeryId)) return;
        const s = this._getCaseById(surgeryId);
        if (!s) return;
        const body = document.getElementById('modal-body');
        if (!body) return;
        const pane = body.querySelector('.sap-right-pane');
        const cols = body.querySelector('.sap-drawer-columns');
        const prevPaneTop = pane ? pane.scrollTop : 0;
        const prevColsTop = cols ? cols.scrollTop : 0;
        body.innerHTML = this._buildCaseModalHtml(s);
        const nextPane = body.querySelector('.sap-right-pane');
        const nextCols = body.querySelector('.sap-drawer-columns');
        if (nextPane && prevPaneTop > 0) nextPane.scrollTop = prevPaneTop;
        if (nextCols && prevColsTop > 0) nextCols.scrollTop = prevColsTop;
    },

    _scrollToFieldInDrawer(fieldId) {
        const el = document.getElementById(fieldId);
        if (!el) return;
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    },

    jumpToStep(sid, stepNum, fieldId = null) {
        this._bcnViewMode = 'steps';
        this._currentFocusStep = Number(stepNum);
        this._expandedSteps[Number(stepNum)] = true;
        this._highlightFieldId = fieldId || `sap-step-card-${stepNum}`;
        this._refreshOpenModal(sid);
        requestAnimationFrame(() => this._scrollToFieldInDrawer(this._highlightFieldId));
    },

    toggleStepExpand(sid, stepNum) {
        const cur = this._expandedSteps[stepNum];
        this._expandedSteps[stepNum] = cur === true ? false : true;
        this._currentFocusStep = Number(stepNum);
        this._refreshOpenModal(sid);
    },

    setBcnViewMode(sid, mode) {
        this._bcnViewMode = mode;
        this._refreshOpenModal(sid);
    },

    // ── BƯỚC 3.2: Map Return Feedback Chips / Notes to Red-Highlighted Fields ──
    _computeReturnedHighlightFieldIds(s) {
        const set = new Set();
        if (s?.approval?.status !== 'returned_for_revision') return set;
        const fb = s.approval?.returnFeedback;
        if (!fb) return set;
        const combined = [...(fb.chips || []), fb.note || ''].join(' ').toLowerCase();
        if (combined.includes('tiền mê') || combined.includes('tim phổi') || combined.includes('ecg') || combined.includes('siêu âm tim')) {
            set.add('sap-ck-row-CK-02');
        }
        if (combined.includes('chống huyết khối') || combined.includes('kháng đông') || combined.includes('kháng kết tập')) {
            set.add('sap-f-antithrombotic');
        }
        if (combined.includes('mri') || combined.includes('crm') || combined.includes('đường rò') || combined.includes('mdt') || combined.includes('liên chuyên khoa') || combined.includes('giai đoạn')) {
            set.add('sap-f-context-module');
            set.add('sap-ck-row-CK-04');
        }
        if (combined.includes('cột phẫu thuật') || combined.includes('ptv chính') || combined.includes('vượt cột') || combined.includes('kỹ thuật')) {
            set.add('sap-f-catalog');
        }
        if (combined.includes('máu') || combined.includes('stapler') || combined.includes('robot') || combined.includes('thiết bị')) {
            set.add('sap-f-blood-devices');
        }
        if (combined.includes('xét nghiệm') || combined.includes('đông máu')) {
            set.add('sap-ck-row-CK-01');
        }
        if (combined.includes('cam kết') || combined.includes('tư vấn')) {
            set.add('sap-ck-row-CK-08');
        }
        return set;
    },

    // ── Exact Client-Side Missing Requirements Engine (Matches Backend Gate 100%) ──
    _computeMissingRequirements(s, actor = null) {
        const effActor = actor || this.getEffectiveActor(s);
        const isTrainee = SAP_TRAINEE_IDS.has(Number(effActor?.staffId));
        const missing = [];
        const cc = s.clinicalClassification || {};
        const pgObj = cc.pathologyGroup || {};
        const pcObj = cc.procedureClass || {};
        const colObj = cc.columnCompliance || {};
        const chips = s.clinicalChips || {};
        const pa = s.podAssignment || {};
        const ck = s.preopChecklist || {};
        const urg = cc.urgencyLevel || 'elective';
        const isExternalMain = s.mainSurgeon && !SAP_ATTENDING_IDS.has(Number(s.mainSurgeon)) && !SAP_TRAINEE_IDS.has(Number(s.mainSurgeon));

        // Step ①: Phân loại
        if (!pa.wardRoom || !SAP_WARD_ROOMS.includes(pa.wardRoom)) {
            missing.push({ step: 1, fieldId: 'sap-f-ward-room', label: 'Chưa chọn buồng bệnh điều trị', code: 'C-01_WARD_ROOM_UNCONFIRMED' });
        }
        if (isExternalMain && !s.coordinatingAttendingStaffId) {
            missing.push({ step: 1, fieldId: 'sap-f-coord-attending', label: 'Chưa chọn BS chính Khoa PTĐTT phụ trách phối hợp', code: 'MISSING_COORDINATING_ATTENDING' });
        }
        if (urg === 'semi_urgent' && String(cc.semiUrgentClinicalReason || '').trim().length < 5) {
            missing.push({ step: 1, fieldId: 'sap-f-urgency', label: 'Chưa ghi lý do lâm sàng mổ bán khẩn', code: 'SEMI_URGENT_REASON_REQUIRED' });
        }
        const pgVal = pgObj.confirmedValue;
        if (!pgVal || pgVal === 'unknown') {
            missing.push({ step: 1, fieldId: 'sap-f-pathology-group', label: 'Chưa chọn nhóm bệnh lý chuyên khoa', code: 'PATHOLOGY_GROUP_UNCONFIRMED' });
        } else if (pgVal === 'other_confirmed' && String(pgObj.otherPathologyNote || '').trim().length < 10) {
            missing.push({ step: 1, fieldId: 'sap-f-pathology-group', label: 'Chưa ghi chi tiết nhóm bệnh lý khác (≥ 10 ký tự)', code: 'OTHER_PATHOLOGY_NOTE_REQUIRED' });
        }
        if (!pcObj.confirmedCatalogEntryId || !pcObj.confirmedClass) {
            missing.push({ step: 1, fieldId: 'sap-f-catalog', label: 'Chưa chọn kỹ thuật mổ trong Danh mục 309 phẫu thuật', code: 'CATALOG_ENTRY_REQUIRED' });
        } else {
            if (pcObj.confirmedClass === 'unclassified' && String(pcObj.unclassifiedNote || '').trim().length < 5) {
                missing.push({ step: 1, fieldId: 'sap-f-catalog', label: 'Chưa ghi chú hạng dự kiến cho kỹ thuật chưa phân loại', code: 'UNCLASSIFIED_NOTE_REQUIRED' });
            }
            if (colObj.systemCheck === 'robot_certification_required') {
                missing.push({ step: 1, fieldId: 'sap-f-catalog', label: 'BS mổ chính chưa có chứng nhận Phẫu thuật viên Robot tại khoa', code: 'ROBOT_CERTIFICATION_REQUIRED' });
            } else if (colObj.systemCheck === 'over_column') {
                if (urg === 'elective' || urg === 'elective_service') {
                    missing.push({ step: 1, fieldId: 'sap-f-catalog', label: 'Mổ chương trình / yêu cầu không được phép vượt cột BS mổ chính', code: 'OVER_COLUMN_NOT_ALLOWED_ELECTIVE' });
                } else if (urg === 'semi_urgent') {
                    if (Number(colObj.columnStepDelta || 9) > 1) {
                        missing.push({ step: 1, fieldId: 'sap-f-catalog', label: 'Mổ bán khẩn chỉ được trình vượt tối đa 01 cột phẫu thuật', code: 'OVER_COLUMN_EXCEEDS_MAX_ONE_STEP' });
                    } else if (String(colObj.overColumnRef || '').trim().length < 5 && !SAP_BCN_IDS.has(Number(colObj.privilegeVerifiedByStaffId))) {
                        missing.push({ step: 1, fieldId: 'sap-f-catalog', label: 'Chưa ghi lý do xin vượt 01 cột cho ca bán khẩn', code: 'OVER_COLUMN_JUSTIFICATION_REQUIRED' });
                    }
                }
            }
        }

        // Step ②: Lâm sàng (Chips + 1 active context module)
        const comorb = chips.comorbidities || {};
        if (!comorb.confirmed || !(comorb.values || []).length) {
            missing.push({ step: 2, fieldId: 'sap-f-comorbidities', label: 'Chưa xác nhận bệnh nền nội khoa', code: 'C-04_COMORBIDITIES_UNCONFIRMED' });
        } else if ((comorb.values || []).includes('other') && !String(comorb.otherComorbidityNote || '').trim()) {
            missing.push({ step: 2, fieldId: 'sap-f-comorbidities', label: 'Chưa ghi rõ tên bệnh nền khác', code: 'C-04_OTHER_NOTE_REQUIRED' });
        }

        const anti = chips.antithromboticPlan || {};
        if (!anti.confirmed || !anti.mode) {
            missing.push({ step: 2, fieldId: 'sap-f-antithrombotic', label: 'Chưa xác nhận kế hoạch thuốc chống huyết khối', code: 'C-05_ANTITHROMBOTIC_UNCONFIRMED' });
        } else if (anti.mode === 'continued_per_plan' && (!String(anti.drugName || '').trim() || !String(anti.approvingSpecialtyOrDoctor || '').trim() || !String(anti.planReferenceNote || '').trim())) {
            missing.push({ step: 2, fieldId: 'sap-f-antithrombotic', label: 'Chưa nhập đủ tên thuốc, bác sĩ duyệt và kế hoạch cầm máu', code: 'ANTITHROMBOTIC_DETAILS_REQUIRED' });
        } else if (anti.mode === 'held_per_plan' && (!String(anti.drugName || '').trim() || !String(anti.lastDoseAt || '').trim() || !String(anti.approvingSpecialtyOrDoctor || '').trim())) {
            missing.push({ step: 2, fieldId: 'sap-f-antithrombotic', label: 'Chưa nhập đủ tên thuốc, liều cuối và chuyên khoa duyệt ngưng thuốc', code: 'ANTITHROMBOTIC_DETAILS_REQUIRED' });
        } else if (anti.mode === 'bridging_per_plan' && (!String(anti.drugName || '').trim() || !String(anti.bridgingAgent || '').trim() || !String(anti.lastDoseAt || '').trim() || !String(anti.approvingSpecialtyOrDoctor || '').trim())) {
            missing.push({ step: 2, fieldId: 'sap-f-antithrombotic', label: 'Chưa nhập đủ chi tiết bắc cầu Heparin / LMWH', code: 'ANTITHROMBOTIC_DETAILS_REQUIRED' });
        } else if (anti.mode === 'unheld_urgent_risk') {
            if (urg === 'elective') {
                missing.push({ step: 2, fieldId: 'sap-f-antithrombotic', label: 'Thuốc chống huyết khối chưa ngưng đủ không được trình mổ chương trình', code: 'UNHELD_DRUG_NOT_FOR_ELECTIVE' });
            } else if (!String(anti.drugName || '').trim() || !String(anti.lastDoseAt || '').trim() || !String(anti.planReferenceNote || '').trim()) {
                missing.push({ step: 2, fieldId: 'sap-f-antithrombotic', label: 'Chưa ghi rõ tên thuốc, liều cuối và phương án cầm máu', code: 'ANTITHROMBOTIC_DETAILS_REQUIRED' });
            }
        }

        const bd = chips.bloodAndDevices || {};
        if (!bd.confirmed || !(bd.values || []).length) {
            missing.push({ step: 2, fieldId: 'sap-f-blood-devices', label: 'Chưa xác nhận dự trù máu và thiết bị đặc thù', code: 'C-06_BLOOD_DEVICES_UNCONFIRMED' });
        }

        const stoma = chips.stomaPlan || {};
        if (!stoma.confirmed || !stoma.value) {
            missing.push({ step: 2, fieldId: 'sap-f-stoma', label: 'Chưa xác nhận kế hoạch hậu môn nhân tạo (HMNT)', code: 'C-07_STOMA_UNCONFIRMED' });
        }

        // Active Context Module (B1..B4)
        const ctx = chips.contextChips || {};
        if (pgVal === 'benign_anorectal') {
            const b1 = ctx.fistulaContext || {};
            if (!['not_fistula', 'simple_fistula', 'complex_or_recurrent_fistula'].includes(b1.fistulaClassification)) {
                missing.push({ step: 2, fieldId: 'sap-f-context-module', label: 'Chưa phân loại bệnh lý hậu môn / đường rò', code: 'B1_FISTULA_CLASSIFICATION_REQUIRED' });
            } else if (['simple_fistula', 'complex_or_recurrent_fistula'].includes(b1.fistulaClassification)) {
                if (!['mri_fistula_done', 'endoanal_us_done', 'not_indicated_simple', 'other_note'].includes(b1.fistulaImaging)) {
                    missing.push({ step: 2, fieldId: 'sap-f-context-module', label: 'Chưa xác nhận hình ảnh học đường rò (MRI / siêu âm)', code: 'B1_FISTULA_IMAGING_REQUIRED' });
                } else if (b1.fistulaClassification === 'complex_or_recurrent_fistula' && b1.fistulaImaging === 'not_indicated_simple' && !String(b1.missingMriReason || '').trim()) {
                    missing.push({ step: 2, fieldId: 'sap-f-context-module', label: 'Chưa ghi lý do rò phức tạp chưa chụp MRI', code: 'B1_COMPLEX_FISTULA_MISSING_MRI_REASON' });
                }
            }
        }
        if (pgVal === 'benign_colorectal_abdominal' || stoma.value === 'stoma_closure') {
            const b2 = ctx.benignAbdominalContext || {};
            if (stoma.value === 'stoma_closure' && !['endoscopy_or_contrast_patent', 'stricture_planned_resection'].includes(b2.distalLimbCheck)) {
                missing.push({ step: 2, fieldId: 'sap-f-context-module', label: 'Chưa xác nhận lưu thông đầu dưới trước đóng HMNT', code: 'B2_DISTAL_LIMB_CHECK_REQUIRED' });
            }
            if (pgVal === 'benign_colorectal_abdominal' && (!b2.subType || !b2.bowelPrepPlan)) {
                missing.push({ step: 2, fieldId: 'sap-f-context-module', label: 'Chưa hoàn tất thông tin lành tính đại trực tràng & chuẩn bị ruột', code: 'B2_SUBTYPE_REQUIRED' });
            }
        }
        if (pgVal === 'cancer_confirmed') {
            const b3 = ctx.cancerContext || {};
            const locs = b3.tumorLocation || [];
            const st = b3.clinicalStage || {};
            const isRectal = locs.some(l => String(l).startsWith('rectum_') || l === 'anal_canal');
            if (!locs.length) missing.push({ step: 2, fieldId: 'sap-f-context-module', label: 'Chưa chọn vị trí khối u đại trực tràng', code: 'B3_TUMOR_LOCATION_REQUIRED' });
            if (!b3.preopHistology) missing.push({ step: 2, fieldId: 'sap-f-context-module', label: 'Chưa chọn giải phẫu bệnh trước mổ', code: 'B3_HISTOLOGY_REQUIRED' });
            if (!(st.cT && st.cN && st.cM)) missing.push({ step: 2, fieldId: 'sap-f-context-module', label: 'Chưa chọn đủ giai đoạn lâm sàng cT / cN / cM', code: 'B3_CLINICAL_STAGE_REQUIRED' });
            if ([st.cT, st.cN, st.cM].some(x => ['Tx', 'Nx', 'Mx'].includes(x)) && !String(st.stagingNote || '').trim()) {
                missing.push({ step: 2, fieldId: 'sap-f-context-module', label: 'Chưa ghi lý do giai đoạn Tx / Nx / Mx', code: 'B3_UNKNOWN_STAGE_NOTE_REQUIRED' });
            }
            if (isRectal && !['crm_clear', 'crm_threatened_or_positive', 'unknown_no_pelvic_mri'].includes(b3.crmStatus)) {
                missing.push({ step: 2, fieldId: 'sap-f-context-module', label: 'Chưa xác nhận diện cắt vòng quanh (CRM) trên MRI chậu', code: 'CANCER_RECTAL_CRM_REQUIRED' });
            } else if (isRectal && b3.crmStatus === 'unknown_no_pelvic_mri' && !String(b3.crmNote || st.stagingNote || '').trim()) {
                missing.push({ step: 2, fieldId: 'sap-f-context-module', label: 'Chưa ghi lý do chưa đánh giá được CRM trên MRI chậu', code: 'B3_CRM_NOTE_REQUIRED' });
            }
            if (!b3.multimodalStatus || !b3.mdtReviewStatus) {
                missing.push({ step: 2, fieldId: 'sap-f-context-module', label: 'Chưa chọn điều trị đa mô thức / hội chẩn MDT', code: 'B3_MDT_STATUS_REQUIRED' });
            }
        }
        if (pgVal === 'neoplasm_suspected_or_special') {
            const b4 = ctx.specialNeoplasmContext || {};
            if (!b4.neoplasmCategory || !b4.biopsyStatus || !b4.extentEvaluation || !b4.mdtReviewStatus) {
                missing.push({ step: 2, fieldId: 'sap-f-context-module', label: 'Chưa hoàn tất thông tin U tân sinh đặc thù', code: 'B4_CATEGORY_REQUIRED' });
            } else if (b4.biopsyStatus === 'stenotic_or_bleeding_failed_biopsy' && !String(b4.missingBiopsyReason || '').trim()) {
                missing.push({ step: 2, fieldId: 'sap-f-context-module', label: 'Chưa ghi lý do chưa có GPB dương tính trước mổ', code: 'B4_MISSING_BIOPSY_REASON_REQUIRED' });
            }
        }

        // Step ③: 5 Independent Checklist Items (CK-01, CK-02, CK-06, CK-04, CK-08)
        for (const meta of SAP_CK_INDEPENDENT_ITEMS) {
            if (isTrainee && meta.attendingOnly) continue;
            const item = ck[meta.code] || {};
            const st = item.state || 'unverified';
            const verifiedOk = SAP_ATTENDING_IDS.has(Number(item.verifiedByStaffId)) && ['verified_ok', 'verified_abnormal_planned', 'not_indicated', 'not_applicable'].includes(st);
            const traineeDone = isTrainee && st === 'prepared_ok';
            if (!verifiedOk && !traineeDone) {
                missing.push({
                    step: 3,
                    fieldId: `sap-ck-row-${meta.code}`,
                    label: meta.attendingOnly ? `BS chính chưa xác nhận: ${meta.title}` : `Chưa xác nhận: ${meta.title}`,
                    code: `${meta.code}_UNVERIFIED`
                });
                continue;
            }
            if (st === 'verified_abnormal_planned' && !String(item.clinicalPlanNote || '').trim()) {
                missing.push({ step: 3, fieldId: `sap-ck-row-${meta.code}`, label: `Chưa ghi kế hoạch xử trí bất thường: ${meta.title}`, code: `${meta.code}_CLINICAL_PLAN_NOTE_REQUIRED` });
            }
            if (meta.code === 'CK-01' && st === 'not_indicated' && String(item.clinicalPlanNote || '').trim().length < 5) {
                missing.push({ step: 3, fieldId: 'sap-ck-row-CK-01', label: 'Chưa ghi lý do không chỉ định xét nghiệm tiền phẫu', code: 'CK-01_NOT_INDICATED_REASON_REQUIRED' });
            }
            if (meta.code === 'CK-02') {
                const subs = item.subChecks || {};
                const okSub = k => {
                    const sv = subs[k] || 'unverified';
                    if (isTrainee) return sv !== 'unverified';
                    if (k === 'preAnesthesiaExam') return ['verified_ok', 'ready_for_preanesthesia', 'verified_abnormal_planned'].includes(sv);
                    return ['verified_ok', 'verified_abnormal_planned', 'not_indicated'].includes(sv);
                };
                for (const sk of ['preAnesthesiaExam', 'ecg', 'chestImaging', 'echo']) {
                    if (!okSub(sk)) {
                        missing.push({ step: 3, fieldId: 'sap-ck-row-CK-02', label: `Chưa xác nhận ${SAP_SUBCHECK_LABELS[sk]}`, code: `CK-02_${sk}_UNVERIFIED` });
                    }
                }
            }
        }
        return missing;
    },

    // ── Mục 2.4 (BS. An duyệt): Auto-Synchronize Confirmed Step ② Chips -> CK-03, CK-05, CK-07 ──
    _isStep2NeoplasmComplete(s, nextChips = null) {
        const pgVal = s.clinicalClassification?.pathologyGroup?.confirmedValue;
        const chips = nextChips || s.clinicalChips || {};
        const ctx = chips.contextChips || {};
        if (pgVal === 'cancer_confirmed') {
            const b3 = ctx.cancerContext || {};
            const locs = b3.tumorLocation || [];
            const st = b3.clinicalStage || {};
            const isRectal = locs.some(l => String(l).startsWith('rectum_') || l === 'anal_canal');
            const crmOk = !isRectal || ['crm_clear', 'crm_threatened_or_positive', 'unknown_no_pelvic_mri'].includes(b3.crmStatus);
            return locs.length > 0 && Boolean(b3.preopHistology && st.cT && st.cN && st.cM && crmOk && b3.multimodalStatus && b3.mdtReviewStatus);
        }
        if (pgVal === 'neoplasm_suspected_or_special') {
            const b4 = ctx.specialNeoplasmContext || {};
            return Boolean(b4.neoplasmCategory && b4.biopsyStatus && b4.extentEvaluation && b4.mdtReviewStatus);
        }
        if (pgVal === 'other_confirmed') {
            return String(s.clinicalClassification?.pathologyGroup?.otherPathologyNote || '').trim().length >= 10;
        }
        return false;
    },

    _buildSyncedStep2ChecklistPatch(s, actor, nextChips = null) {
        const effActor = actor || this.getEffectiveActor(s);
        const isTrainee = SAP_TRAINEE_IDS.has(Number(effActor.staffId));
        const isAttending = SAP_ATTENDING_IDS.has(Number(effActor.staffId)) || SAP_BCN_IDS.has(Number(effActor.staffId));
        if (!isTrainee && !isAttending) return null;

        const chips = nextChips || s.clinicalChips || {};
        const comorb = chips.comorbidities || {};
        const anti = chips.antithromboticPlan || {};
        const bd = chips.bloodAndDevices || {};
        const pgVal = s.clinicalClassification?.pathologyGroup?.confirmedValue;
        const ckPatch = {};

        // 1. C-04 + C-05 -> CK-03
        if (comorb.confirmed && (comorb.values || []).length > 0 && anti.confirmed && anti.mode) {
            if (isTrainee) {
                ckPatch['CK-03'] = { state: 'prepared_ok' };
            } else {
                const needAbnPlan = ['continued_per_plan', 'bridging_per_plan', 'unheld_urgent_risk'].includes(anti.mode);
                const planStr = this._formatAntithromboticSummary(anti);
                ckPatch['CK-03'] = needAbnPlan
                    ? { state: 'verified_abnormal_planned', clinicalPlanNote: planStr }
                    : { state: 'verified_ok', clinicalPlanNote: anti.mode === 'held_per_plan' ? planStr : '' };
            }
        }

        // 2. C-06 -> CK-07
        if (bd.confirmed && (bd.values || []).length > 0) {
            ckPatch['CK-07'] = { state: isTrainee ? 'prepared_ok' : 'verified_ok' };
        }

        // 3. Pathology / B3 / B4 -> CK-05
        if (['benign_anorectal', 'benign_colorectal_abdominal'].includes(pgVal)) {
            if (!isTrainee) {
                ckPatch['CK-05'] = { state: 'not_applicable' };
            }
        } else if (this._isStep2NeoplasmComplete(s, chips)) {
            ckPatch['CK-05'] = { state: isTrainee ? 'prepared_ok' : 'verified_ok' };
        }

        return Object.keys(ckPatch).length > 0 ? ckPatch : null;
    },

    // ── BƯỚC 2.8: Top 5 Frequent Procedures in Past 90 Days for Main Surgeon ──
    _getTopProceduresForSurgeon(s, catalogProcs) {
        if (!Array.isArray(catalogProcs) || catalogProcs.length === 0) return [];
        const procMap = new Map(catalogProcs.map(p => [p.id, p]));
        const counts = new Map();
        const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
        const mainId = Number(s.mainSurgeon || 0);
        for (const item of (Store.getAll('surgeries') || [])) {
            if (!item || Number(item.mainSurgeon) !== mainId) continue;
            if ((item.date || '') < cutoff) continue;
            const cid = item.clinicalClassification?.procedureClass?.confirmedCatalogEntryId
                || item.clinicalClassification?.procedureClass?.suggestedCatalogEntryId;
            if (cid && procMap.has(cid)) {
                counts.set(cid, (counts.get(cid) || 0) + 1);
            }
        }
        const result = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([cid]) => procMap.get(cid))
            .filter(Boolean);

        // Pad up to 5 with procedures matching suggestedId, method keywords & surgeon's column
        const suggestedId = s.clinicalClassification?.procedureClass?.suggestedCatalogEntryId;
        if (suggestedId && procMap.has(suggestedId) && !result.some(p => p.id === suggestedId)) {
            result.unshift(procMap.get(suggestedId));
        }
        const rankMap = { 'PT-ĐB': 4, 'PT-DB': 4, 'PT-I': 3, 'PT-II': 2, 'PT-III': 1 };
        const colStr = s.clinicalClassification?.columnCompliance?.surgeonBaseColumn2026 || '';
        const colRank = ({ 'ĐB': 4, 'DB': 4, 'I': 3, '1': 3, 'II': 2, '2': 2, 'III': 1, '3': 1 })[colStr] || 4;
        const mTokens = String(s.method || '').toLowerCase().split(/[\s,()/+-]+/).filter(w => w.length >= 2);
        const scored = catalogProcs
            .filter(p => !result.some(r => r.id === p.id))
            .filter(p => p.rankCode !== 'unclassified' && (rankMap[p.rankCode] || 1) <= colRank)
            .map(p => {
                const nm = String(p.name || '').toLowerCase();
                let sc = 0;
                for (const tk of mTokens) {
                    if (nm.includes(tk)) sc += 2;
                }
                if (s.approachType === 'robot') sc += nm.includes('robot') ? 5 : -3;
                else if (s.approachType === 'noisoi') sc += nm.includes('nội soi') ? 4 : -2;
                else if (s.approachType === 'mo' && (nm.includes('nội soi') || nm.includes('robot'))) sc -= 5;
                return { p, sc };
            })
            .sort((a, b) => b.sc - a.sc);
        for (const item of scored) {
            if (result.length >= 5) break;
            result.push(item.p);
        }
        return result.slice(0, 5);
    },

    _inferSuggestedCatalogProc(s) {
        const catalogProcs = this._catalogData?.procedures || [];
        if (!catalogProcs.length) return null;
        const pcObj = s.clinicalClassification?.procedureClass || {};
        if (pcObj.suggestedCatalogEntryId) {
            const exact = catalogProcs.find(p => p.id === pcObj.suggestedCatalogEntryId);
            if (exact) return exact;
        }
        const rankMap = { 'PT-ĐB': 4, 'PT-DB': 4, 'PT-I': 3, 'PT-II': 2, 'PT-III': 1 };
        const colStr = s.clinicalClassification?.columnCompliance?.surgeonBaseColumn2026 || '';
        const colRank = ({ 'ĐB': 4, 'DB': 4, 'PT-I': 3, 'I': 3, '1': 3, 'II': 2, '2': 2, 'III': 1, '3': 1 })[colStr] || 4;
        const mTokens = String(s.method || '').toLowerCase().split(/[\s,()/+-]+/).filter(w => w.length >= 2);
        if (!mTokens.length) return null;
        let best = null;
        let bestScore = 0;
        for (const p of catalogProcs) {
            if (p.rankCode === 'unclassified' || (rankMap[p.rankCode] || 1) > colRank) continue;
            const nm = String(p.name || '').toLowerCase();
            let sc = 0;
            for (const tk of mTokens) {
                if (nm.includes(tk)) sc += 2;
            }
            if (s.approachType === 'robot') sc += nm.includes('robot') ? 5 : -4;
            else if (s.approachType === 'noisoi') sc += nm.includes('nội soi') ? 4 : -3;
            else if (s.approachType === 'mo' && (nm.includes('nội soi') || nm.includes('robot'))) sc -= 5;
            if (sc > bestScore) {
                bestScore = sc;
                best = p;
            }
        }
        return bestScore >= 4 ? best : null;
    },

    _getEffectiveStep2Suggestions(s) {
        const chips = s.clinicalChips || {};
        const comorb = chips.comorbidities || {};
        const anti = chips.antithromboticPlan || {};
        const bd = chips.bloodAndDevices || {};
        const stoma = chips.stomaPlan || {};
        const diagLower = String(s.diagnosis || '').toLowerCase();
        const methodLower = String(s.method || '').toLowerCase();

        let comorbValues = Array.isArray(comorb.values) && comorb.values.length > 0 ? comorb.values : null;
        if (!comorb.confirmed && !comorbValues) {
            const inferred = [];
            if (diagLower.includes('tăng huyết áp') || /\btha\b/.test(diagLower)) inferred.push('hypertension');
            if (diagLower.includes('đái tháo đường') || diagLower.includes('tiểu đường') || /\bđtđ\b/.test(diagLower)) inferred.push('diabetes');
            if (diagLower.includes('mạch vành') || diagLower.includes('stent')) inferred.push('cad_stent');
            if (diagLower.includes('suy tim') || diagLower.includes('rung nhĩ')) inferred.push('afib_hf');
            if (diagLower.includes('copd') || diagLower.includes('hen phế quản')) inferred.push('copd_asthma');
            if (diagLower.includes('suy thận')) inferred.push('ckd');
            if (diagLower.includes('xơ gan')) inferred.push('cirrhosis');
            comorbValues = inferred.length > 0 ? inferred : ['none'];
        }

        const hasAnticoagHint = ['aspirin', 'clopidogrel', 'plavix', 'rivaroxaban', 'xarelto', 'warfarin', 'sintrom', 'dabigatran', 'apixaban', 'kháng đông', 'chống đông'].some(k => diagLower.includes(k));
        let antiMode = anti.mode || null;
        if (!anti.confirmed && !antiMode && !hasAnticoagHint) {
            antiMode = 'none_confirmed';
        }

        let bdValues = Array.isArray(bd.values) && bd.values.length > 0 ? bd.values : null;
        if (!bd.confirmed && !bdValues) {
            if (s.approachType === 'robot') bdValues = ['robot_instruments'];
            else if (methodLower.includes('longo')) bdValues = ['longo_stapler'];
            else if (methodLower.includes('nối máy') || methodLower.includes('cắt trước thấp') || methodLower.includes('lar') || methodLower.includes('cắt đại tràng')) bdValues = ['circular_linear_stapler'];
            else bdValues = ['basic_instruments_only'];
        }

        let stomaValue = stoma.value || null;
        if (!stoma.confirmed && !stomaValue) {
            if (methodLower.includes('đóng hmnt') || methodLower.includes('đóng hậu môn nhân tạo') || diagLower.includes('đóng hmnt')) stomaValue = 'stoma_closure';
            else if (methodLower.includes('mở hmnt') || methodLower.includes('làm hmnt')) stomaValue = 'planned_permanent_stoma';
            else stomaValue = 'no_stoma';
        }

        return { comorbValues, antiMode, bdValues, stomaValue };
    },

    // ── BƯỚC 2.6: Per-Step Suggestion Preview & 1-Tap Step Suggestion Confirm ──
    _buildStepSuggestions(s, stepNum) {
        const items = [];
        const cc = s.clinicalClassification || {};
        const pgObj = cc.pathologyGroup || {};
        const pcObj = cc.procedureClass || {};
        const chips = s.clinicalChips || {};
        const pa = s.podAssignment || {};

        if (stepNum === 1) {
            if (!pa.wardRoom && s.wardRoom && SAP_WARD_ROOMS.includes(String(s.wardRoom))) {
                items.push(`Buồng bệnh: P.${s.wardRoom}`);
            }
            if ((!pgObj.confirmedValue || pgObj.confirmedValue === 'unknown') && pgObj.suggestedValue && pgObj.suggestedValue !== 'unknown') {
                const m = SAP_PATHOLOGY_GROUPS.find(g => g.value === pgObj.suggestedValue);
                items.push(`Nhóm bệnh: ${m ? m.shortLabel : pgObj.suggestedValue}`);
            }
            if (!pcObj.confirmedCatalogEntryId) {
                const p = this._inferSuggestedCatalogProc(s);
                if (p) items.push(`Kỹ thuật: ${p.rankLabel} — ${p.name}`);
            }
        } else if (stepNum === 2) {
            const eff2 = this._getEffectiveStep2Suggestions(s);
            const comorb = chips.comorbidities || {};
            if (!comorb.confirmed && eff2.comorbValues && eff2.comorbValues.length > 0 && !eff2.comorbValues.includes('other')) {
                const lbls = eff2.comorbValues.map(v => SAP_COMORBIDITIES.find(c => c.value === v)?.label || v).join(', ');
                items.push(`Bệnh nền: ${lbls}`);
            }
            const anti = chips.antithromboticPlan || {};
            if (!anti.confirmed && eff2.antiMode === 'none_confirmed') {
                items.push('Không dùng thuốc chống huyết khối');
            }
            const bd = chips.bloodAndDevices || {};
            if (!bd.confirmed && eff2.bdValues && eff2.bdValues.length > 0) {
                const lbls = eff2.bdValues.map(v => SAP_BLOOD_DEVICES.find(c => c.value === v)?.label || v).join(', ');
                items.push(`Máu & dụng cụ: ${lbls}`);
            }
            const stoma = chips.stomaPlan || {};
            if (!stoma.confirmed && eff2.stomaValue) {
                const lbl = SAP_STOMA_PLANS.find(c => c.value === eff2.stomaValue)?.label || eff2.stomaValue;
                items.push(`HMNT: ${lbl}`);
            }
        }
        return items;
    },

    // ── Build 2-Column Case Drawer HTML (BƯỚC 2.1, 2.2, 2.3, 3.2) ──
    _buildCaseModalHtml(s) {
        const cfg = this.getConfig();
        const actor = this.getEffectiveActor(s);
        const isActorBcn = SAP_BCN_IDS.has(actor.staffId);
        const canEdit = SAP_TRAINEE_IDS.has(actor.staffId) || SAP_ATTENDING_IDS.has(actor.staffId) || isActorBcn || actor.isSuperAdmin;
        const missing = this._computeMissingRequirements(s, actor);
        const step1Miss = missing.filter(m => m.step === 1);
        const step2Miss = missing.filter(m => m.step === 2);
        const step3Miss = missing.filter(m => m.step === 3);
        const returnedSet = this._computeReturnedHighlightFieldIds(s);

        const mainName = Utils.getStaffName(s.mainSurgeon) || 'Chưa phân công';
        const prepId = s.podAssignment?.preparedByStaffId || s.assistSurgeon1;
        const prepName = prepId ? Utils.getStaffName(prepId) : 'Chưa ghi nhận';
        const roomStr = s.podAssignment?.wardRoom && s.podAssignment.wardRoom !== 'unassigned' ? `P.${s.podAssignment.wardRoom}` : 'Chưa xếp phòng';
        const podStr = s.podAssignment?.suggestedPodId ? ` · ${this._formatPodLabel(s.podAssignment.suggestedPodId)}` : '';
        const approachLabel = ({ mo: 'Mổ mở', noisoi: 'Nội soi', robot: 'Robot' })[s.approachType] || s.approachType || '—';
        const wasEditedAfterApprove = Boolean(s.approval?.lastApprovedSnapshot) && !this.isApprovalGreenTickValid(s);
        const sla = this._computeSlaDisplay(s, cfg);

        const stepNavMeta = [
            { num: 1, title: '① Phân loại', miss: step1Miss.length },
            { num: 2, title: '② Lâm sàng', miss: step2Miss.length },
            { num: 3, title: '③ Bảng kiểm', miss: step3Miss.length }
        ];

        const simOpts = App.isSuperAdmin() && s.isTestSandboxCase ? this._getSimulatorRoleOptions().slice(0, 7) : [];

        return `
        <div class="sap-drawer-shell" data-case-drawer-id="${s.id}">
            <!-- Mobile Horizontal Stepper at Top (BƯỚC 2.1 Mobile) -->
            <div class="sap-mobile-stepper" role="navigation" aria-label="Tiến độ 3 bước chuẩn bị hồ sơ">
                ${stepNavMeta.map(st => `
                <button type="button" class="sap-step-nav-btn ${this._currentFocusStep === st.num && this._bcnViewMode === 'steps' ? 'is-current' : ''}"
                    onclick="SurgeryApprovalPage.jumpToStep(${s.id}, ${st.num})">
                    <span>${Utils.escapeHtml(st.title)}</span>
                    <span class="sap-step-nav-pill ${st.miss === 0 ? 'sap-step-nav-pill--done' : 'sap-step-nav-pill--todo'}">
                        ${st.miss === 0 ? '✓' : `-${st.miss}`}
                    </span>
                </button>`).join('')}
            </div>

            <div class="sap-drawer-columns">
                <!-- Left Sticky Rail (280px Desktop) -->
                <aside class="sap-left-rail" aria-label="Tóm tắt ca mổ và điều hướng bước">
                    <div class="sap-rail-summary">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
                            ${this.renderBadge(s)}
                            ${s.isTestSandboxCase ? `<span class="sap-tag sap-tag--sandbox">TEST</span>` : ''}
                        </div>
                        ${wasEditedAfterApprove ? `<span class="sap-tag sap-tag--modified">${this._ico('🔄')} <span>Đã sửa sau khi duyệt</span></span>` : ''}
                        <div class="sap-rail-patient">${Utils.escapeHtml(Utils.toProperCase(s.patientName || ''))}${s.birthYear ? ` (${s.birthYear})` : ''}</div>
                        <div class="sap-rail-meta">
                            <div>Ngày mổ: <strong>${Utils.escapeHtml(Utils.formatDate ? Utils.formatDate(s.date) : (s.date || '—'))}</strong> · <strong>${Utils.escapeHtml(approachLabel)}</strong></div>
                            <div>Buồng: <strong>${Utils.escapeHtml(roomStr + podStr)}</strong></div>
                            <div>BS mổ chính: <strong>${Utils.escapeHtml(mainName)}</strong></div>
                            <div>HV chuẩn bị: <strong>${Utils.escapeHtml(prepName)}</strong></div>
                            <div>Phương pháp: <strong>${Utils.escapeHtml(s.method || '—')}</strong></div>
                            <div>Chẩn đoán: <strong>${Utils.escapeHtml(s.diagnosis || '—')}</strong></div>
                        </div>
                        <div class="sap-sla-pill ${sla.cls}" style="align-self:flex-start;margin-top:4px;">
                            ${this._ico(sla.icon)} <span>${Utils.escapeHtml(sla.text)}</span>
                        </div>
                    </div>

                    ${isActorBcn ? `
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        <button type="button" class="sap-step-nav-btn ${this._bcnViewMode === 'summary' ? 'is-current' : ''}"
                            onclick="SurgeryApprovalPage.setBcnViewMode(${s.id}, 'summary')">
                            <span>${this._ico('⚡')} Tóm tắt duyệt BCN</span>
                            <span class="sap-step-nav-pill sap-step-nav-pill--done">1 trang</span>
                        </button>
                        <button type="button" class="sap-step-nav-btn ${this._bcnViewMode === 'steps' ? 'is-current' : ''}"
                            onclick="SurgeryApprovalPage.setBcnViewMode(${s.id}, 'steps')">
                            <span>${this._ico('📝')} Hồ sơ chi tiết 3 bước</span>
                            <span class="sap-step-nav-pill ${missing.length === 0 ? 'sap-step-nav-pill--done' : 'sap-step-nav-pill--todo'}">${missing.length === 0 ? '✓' : `-${missing.length}`}</span>
                        </button>
                    </div>` : ''}

                    <nav class="sap-step-nav" aria-label="Điều hướng 3 bước chuẩn bị">
                        ${stepNavMeta.map(st => `
                        <button type="button" class="sap-step-nav-btn ${this._bcnViewMode === 'steps' && this._currentFocusStep === st.num ? 'is-current' : ''}"
                            onclick="SurgeryApprovalPage.jumpToStep(${s.id}, ${st.num})">
                            <span>${Utils.escapeHtml(st.title)}</span>
                            <span class="sap-step-nav-pill ${st.miss === 0 ? 'sap-step-nav-pill--done' : 'sap-step-nav-pill--todo'}">
                                ${st.miss === 0 ? '✓ Đủ' : `Còn ${st.miss}`}
                            </span>
                        </button>`).join('')}
                    </nav>

                    ${simOpts.length > 0 ? `
                    <div class="sap-rail-summary" style="gap:6px;">
                        <div style="font-size:13px;font-weight:700;color:var(--text-secondary);">${this._ico('🎭')} Đổi nhanh vai trò [TEST]:</div>
                        <div class="sap-chip-group">
                            ${simOpts.map(r => `
                            <button type="button" class="sap-chip ${Number(this._simulatedStaffId) === r.staffId ? 'sap-chip--selected' : ''}"
                                style="padding:5px 9px;font-size:13px;"
                                onclick="SurgeryApprovalPage.setSimulatedRole('${r.staffId}')">${Utils.escapeHtml(r.shortLabel)}</button>`).join('')}
                        </div>
                    </div>` : ''}
                </aside>

                <!-- Right Scrollable Content Pane -->
                <div class="sap-right-pane">
                    ${this._renderTopCaseAlertsHtml(s, returnedSet)}
                    ${this._activeActionDrawer ? this._renderActionSubDrawer(s, actor) : ''}
                    ${this._bcnViewMode === 'summary' && isActorBcn
                        ? this._renderBcnExecutiveSummaryHtml(s, cfg, actor, missing)
                        : `
                        ${this._renderStep1Html(s, actor, canEdit, step1Miss, returnedSet)}
                        ${this._renderStep2Html(s, actor, canEdit, step2Miss, returnedSet)}
                        ${this._renderStep3Html(s, actor, canEdit, step3Miss, returnedSet)}
                        `}
                </div>
            </div>

            ${this._renderStickyFooterHtml(s, cfg, actor, missing)}
        </div>`;
    },

    _renderTopCaseAlertsHtml(s, returnedSet) {
        const blocks = [];
        const app = s.approval || {};
        if (app.activeHold) {
            const catLbl = SAP_HOLD_CATEGORIES.find(c => c.value === app.activeHold.holdCategory)?.label || app.activeHold.holdCategory;
            blocks.push(`
            <div class="sap-alert sap-alert--warning">
                <strong>${this._ico('⏸️')} Ca mổ đang Tạm hoãn tại khoa (${Utils.escapeHtml(catLbl)}):</strong>
                ${Utils.escapeHtml(app.activeHold.holdReason || '')} — Người đặt: <strong>${Utils.escapeHtml(Utils.getStaffName(app.activeHold.heldByStaffId) || '')}</strong>
            </div>`);
        }
        if (app.status === 'returned_for_revision' && app.returnFeedback) {
            const chips = (app.returnFeedback.chips || []).join(' · ');
            blocks.push(`
            <div class="sap-alert sap-alert--danger">
                <strong>${this._ico('↩️')} BCN yêu cầu bổ sung (${Utils.escapeHtml(Utils.getStaffName(app.returnFeedback.returnedByStaffId) || 'BCN')}):</strong>
                ${chips ? `<div>• ${Utils.escapeHtml(chips)}</div>` : ''}
                ${app.returnFeedback.note ? `<div>• Hướng dẫn: <strong>${Utils.escapeHtml(app.returnFeedback.note)}</strong></div>` : ''}
                ${returnedSet.size > 0 ? `<div style="margin-top:4px;font-size:13px;">Các mục liên quan đã được tô viền đỏ bên dưới để anh/chị cập nhật nhanh.</div>` : ''}
            </div>`);
        }
        if (this._lastGateErrors && this._lastGateErrors.length > 0) {
            blocks.push(`
            <div class="sap-alert sap-alert--danger" id="sap-gate-error-banner" role="alert">
                <strong>${this._ico('⚠️')} Chưa thể trình duyệt — vui lòng hoàn tất ${this._lastGateErrors.length} mục sau (bấm để nhảy tới):</strong>
                <div class="sap-jump-list">
                    ${this._lastGateErrors.map(it => `
                    <button type="button" class="sap-jump-link" onclick="SurgeryApprovalPage.jumpToStep(${s.id}, ${it.step}, '${it.fieldId}')">
                        <span>• ${Utils.escapeHtml(it.label)}</span>
                        <span>Bước ${it.step} →</span>
                    </button>`).join('')}
                </div>
            </div>`);
        }
        return blocks.join('');
    },

    // ── BƯỚC 2.2, 2.6, 2.8: Step ① Phân loại (Urgency · Pathology Group · Catalog 309 + Inline Column Check) ──
    _renderStep1Html(s, actor, canEdit, stepMiss, returnedSet) {
        const cc = s.clinicalClassification || {};
        const pgObj = cc.pathologyGroup || {};
        const pcObj = cc.procedureClass || {};
        const colObj = cc.columnCompliance || {};
        const pa = s.podAssignment || {};
        const urg = cc.urgencyLevel || 'elective';
        const pgConfirmed = pgObj.confirmedValue;
        const pgSuggested = pgObj.suggestedValue;
        const hasReturnedInStep1 = returnedSet.has('sap-f-catalog');

        // Auto-collapse when complete unless user explicitly expanded or highlighted
        const isAutoCollapsed = stepMiss.length === 0 && !hasReturnedInStep1 && this._expandedSteps[1] !== true && this._highlightFieldId !== 'sap-f-catalog';
        const pgShort = SAP_PATHOLOGY_GROUPS.find(g => g.value === pgConfirmed)?.shortLabel || pgConfirmed || '';
        const urgShort = SAP_URGENCY_OPTIONS.find(u => u.value === urg)?.shortLabel || urg;
        const colSummaryShort = colObj.systemCheck === 'over_column' ? '⚠️ Vượt cột' : '✓ Đúng cột';

        if (isAutoCollapsed && this._expandedSteps[1] !== true) {
            return `
            <button type="button" id="sap-step-card-1" class="sap-step-collapsed-bar" onclick="SurgeryApprovalPage.toggleStepExpand(${s.id}, 1)">
                <span>${this._ico('✓')} Bước ① Phân loại: ${Utils.escapeHtml(`${pgShort} · ${pcObj.confirmedClass || ''} · ${colSummaryShort} · ${urgShort}`)}</span>
                <span>Mở sửa ▾</span>
            </button>`;
        }

        const suggestions = canEdit ? this._buildStepSuggestions(s, 1) : [];
        const catalogProcs = this._catalogData?.procedures || [];
        const effSuggestedProc = !pcObj.confirmedCatalogEntryId ? this._inferSuggestedCatalogProc(s) : null;
        const topProcs = this._getTopProceduresForSurgeon(s, catalogProcs);
        const q = (this._catalogQuery || '').trim().toLowerCase();
        const filteredProcs = q
            ? catalogProcs.filter(p => (p.name || '').toLowerCase().includes(q) || (p.rankLabel || '').toLowerCase().includes(q)).slice(0, 20)
            : [];
        const selectedProc = catalogProcs.find(p => p.id === pcObj.confirmedCatalogEntryId) || effSuggestedProc;

        // Inline 1-line Column Verification Pill (BƯỚC 2.2: NO big green banner when OK!)
        const sysCheck = colObj.systemCheck || 'within_column';
        const baseCol = colObj.surgeonBaseColumn2026 || 'Chưa cấu hình';
        let inlineColHtml = '';
        if (pcObj.confirmedClass || pcObj.suggestedClass) {
            const rankStr = pcObj.confirmedClass || pcObj.suggestedClass;
            if (sysCheck === 'within_column' || sysCheck === 'approved_over_column_matched') {
                inlineColHtml = `<span class="sap-col-inline sap-col-inline--ok">${this._ico('✓')} <span>${Utils.escapeHtml(rankStr)} · Đúng cột (BS Cột ${Utils.escapeHtml(baseCol)})</span></span>`;
            } else if (sysCheck === 'over_column') {
                const isForbidden = urg === 'elective' || urg === 'elective_service' || Number(colObj.columnStepDelta || 9) > 1;
                inlineColHtml = `<span class="sap-col-inline ${isForbidden ? 'sap-col-inline--danger' : 'sap-col-inline--warn'}">${this._ico(isForbidden ? '⛔' : '⚠️')} <span>${Utils.escapeHtml(rankStr)} · Vượt cột (BS Cột ${Utils.escapeHtml(baseCol)})</span></span>`;
            } else if (sysCheck === 'robot_certification_required') {
                inlineColHtml = `<span class="sap-col-inline sap-col-inline--danger">${this._ico('⛔')} <span>Chưa có chứng nhận PTV Robot</span></span>`;
            } else {
                inlineColHtml = `<span class="sap-col-inline sap-col-inline--warn">${this._ico('⚠️')} <span>${Utils.escapeHtml(rankStr)} · BCN kiểm tra quyền mổ</span></span>`;
            }
        }

        const isExternalMain = s.mainSurgeon && !SAP_ATTENDING_IDS.has(Number(s.mainSurgeon)) && !SAP_TRAINEE_IDS.has(Number(s.mainSurgeon));
        const fieldCls = fid => `sap-field-block ${returnedSet.has(fid) ? 'sap-field--returned-highlight' : ''} ${this._highlightFieldId === fid ? 'sap-field--missing-focus' : ''}`;

        return `
        <section class="sap-section" id="sap-step-card-1" aria-label="Bước 1 Phân loại lâm sàng và danh mục phẫu thuật">
            <div class="sap-section-header">
                <h3 class="sap-section-title">Bước ① Phân loại & Xếp cột phẫu thuật</h3>
                ${stepMiss.length === 0 ? `<button type="button" class="sap-btn sap-btn--ghost" onclick="SurgeryApprovalPage.toggleStepExpand(${s.id}, 1)">Thu gọn ▴</button>` : `<span class="sap-step-nav-pill sap-step-nav-pill--todo">Còn ${stepMiss.length} mục</span>`}
            </div>

            ${suggestions.length > 0 ? `
            <div class="sap-step-suggest-box">
                <div class="sap-step-suggest-text">
                    <strong>${this._ico('✨')} Gợi ý tự động ở Bước ①:</strong> ${Utils.escapeHtml(suggestions.join(' · '))}
                </div>
                <button type="button" class="sap-btn sap-btn--primary" id="sap-btn-confirm-step-1"
                    onclick="SurgeryApprovalPage.confirmStepSuggestions(${s.id}, 1)">
                    ${this._ico('✓')} <span>Xác nhận các gợi ý ở bước này</span>
                </button>
            </div>` : ''}

            <!-- Buồng bệnh POD -->
            <div class="${fieldCls('sap-f-ward-room')}" id="sap-f-ward-room">
                <div class="sap-field-label">Buồng bệnh điều trị <span class="sap-field-sub">(gắn nhóm POD phụ trách)</span></div>
                <div class="sap-chip-group">
                    ${SAP_WARD_ROOMS.map(rm => {
                        const sel = pa.wardRoom === rm;
                        const sugg = !pa.wardRoom && String(s.wardRoom || '') === rm;
                        const lbl = rm === 'unassigned' ? 'Chưa xếp phòng' : `P.${rm}`;
                        return `<button type="button" class="sap-chip ${sel ? 'sap-chip--selected' : (sugg ? 'sap-chip--suggested' : '')}" ${!canEdit ? 'disabled' : ''}
                            onclick="SurgeryApprovalPage.patchDraft(${s.id}, { podAssignment: { wardRoom: '${rm}' } })">
                            <span>${lbl}</span>
                            ${sugg ? '<span class="sap-chip-hint">Gợi ý</span>' : ''}
                        </button>`;
                    }).join('')}
                </div>
            </div>

            ${isExternalMain ? `
            <div class="${fieldCls('sap-f-coord-attending')}" id="sap-f-coord-attending">
                <div class="sap-field-label">${this._ico('🤝')} BS chính Khoa PTĐTT phụ trách phối hợp <span class="sap-field-sub">(bắt buộc cho PTV ngoài khoa)</span></div>
                <div class="sap-chip-group">
                    ${Array.from(SAP_ATTENDING_IDS).map(aid => {
                        const sel = Number(s.coordinatingAttendingStaffId) === aid;
                        return `<button type="button" class="sap-chip ${sel ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                            onclick="SurgeryApprovalPage.patchDraft(${s.id}, { coordinatingAttendingStaffId: ${aid} })">${Utils.escapeHtml(Utils.getStaffName(aid) || `#${aid}`)}</button>`;
                    }).join('')}
                </div>
            </div>` : ''}

            <!-- Tính khẩn -->
            <div class="${fieldCls('sap-f-urgency')}" id="sap-f-urgency">
                <div class="sap-field-label">Tính chất khẩn của ca mổ</div>
                <div class="sap-chip-group">
                    ${SAP_URGENCY_OPTIONS.filter(u => u.value !== 'emergency_exception').map(u => {
                        const sel = urg === u.value;
                        return `<button type="button" class="sap-chip ${sel ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                            onclick="SurgeryApprovalPage.patchDraft(${s.id}, { clinicalClassification: { urgencyLevel: '${u.value}' } })">${Utils.escapeHtml(u.label)}</button>`;
                    }).join('')}
                </div>
                ${urg === 'semi_urgent' ? `
                <input type="text" class="sap-input" placeholder="Nhập lý do lâm sàng mổ bán khẩn (bắt buộc)..."
                    aria-label="Lý do lâm sàng mổ bán khẩn"
                    value="${Utils.escapeHtml(cc.semiUrgentClinicalReason || '')}" ${!canEdit ? 'disabled' : ''}
                    onchange="SurgeryApprovalPage.patchDraft(${s.id}, { clinicalClassification: { semiUrgentClinicalReason: this.value } })">` : ''}
            </div>

            <!-- Nhóm bệnh lý -->
            <div class="${fieldCls('sap-f-pathology-group')}" id="sap-f-pathology-group">
                <div class="sap-field-label">Nhóm bệnh lý chuyên khoa</div>
                <div class="sap-chip-group">
                    ${SAP_PATHOLOGY_GROUPS.map(g => {
                        const isConf = pgConfirmed === g.value;
                        const isSugg = (!pgConfirmed || pgConfirmed === 'unknown') && pgSuggested === g.value;
                        return `<button type="button" class="sap-chip ${isConf ? 'sap-chip--selected' : (isSugg ? 'sap-chip--suggested' : '')}" ${!canEdit ? 'disabled' : ''}
                            onclick="SurgeryApprovalPage.selectPathologyGroup(${s.id}, '${g.value}')">
                            <span>${Utils.escapeHtml(g.label)}</span>
                            ${isSugg ? '<span class="sap-chip-hint">Gợi ý</span>' : ''}
                        </button>`;
                    }).join('')}
                </div>
                ${pgConfirmed === 'other_confirmed' ? `
                <input type="text" class="sap-input" placeholder="Ghi rõ chẩn đoán / nhóm bệnh lý khác (tối thiểu 10 ký tự)..."
                    aria-label="Ghi rõ nhóm bệnh lý khác"
                    value="${Utils.escapeHtml(pgObj.otherPathologyNote || '')}" ${!canEdit ? 'disabled' : ''}
                    onchange="SurgeryApprovalPage.patchDraft(${s.id}, { clinicalClassification: { pathologyGroup: { confirmedValue: 'other_confirmed', otherPathologyNote: this.value } } })">` : ''}
            </div>

            <!-- Danh mục 309 kỹ thuật + "Hay dùng" + Kết quả cột 1 dòng cạnh Hạng PT -->
            <div class="${fieldCls('sap-f-catalog')}" id="sap-f-catalog">
                <div class="sap-field-label">
                    <span>Kỹ thuật phẫu thuật (Danh mục 309 kỹ thuật)</span>
                    ${inlineColHtml}
                </div>

                ${pcObj.confirmedCatalogEntryId && selectedProc ? `
                <div style="font-size:13.5px;padding:8px 12px;border-radius:8px;background:var(--brand-soft);border:1px solid var(--border-default);color:var(--text-heading);">
                    <strong>Đã chọn:</strong> [${Utils.escapeHtml(selectedProc.rankLabel)}] ${Utils.escapeHtml(selectedProc.name)}
                </div>` : ''}

                ${canEdit && topProcs.length > 0 ? `
                <div class="sap-frequent-procs">
                    <span class="sap-filter-sub-label">${this._ico('⭐')} Hay dùng (90 ngày gần đây của BS mổ chính):</span>
                    <div class="sap-chip-group">
                        ${topProcs.map(p => {
                            const isConf = pcObj.confirmedCatalogEntryId === p.id;
                            const isSugg = !pcObj.confirmedCatalogEntryId && effSuggestedProc?.id === p.id;
                            return `<button type="button" class="sap-chip ${isConf ? 'sap-chip--selected' : (isSugg ? 'sap-chip--suggested' : '')}"
                                onclick="SurgeryApprovalPage.selectCatalogEntry(${s.id}, '${p.id}', '${p.rankCode}')">
                                <span>[${Utils.escapeHtml(p.rankLabel)}] ${Utils.escapeHtml(p.name)}</span>
                                ${isSugg ? '<span class="sap-chip-hint">Gợi ý</span>' : ''}
                            </button>`;
                        }).join('')}
                    </div>
                </div>` : ''}

                ${canEdit ? `
                <input type="search" class="sap-input" placeholder="Gõ tìm trong 309 kỹ thuật (tên phẫu thuật, cắt trực tràng, rò hậu môn, Longo, Robot...)"
                    aria-label="Tìm kiếm trong danh mục 309 phẫu thuật"
                    value="${Utils.escapeHtml(this._catalogQuery)}"
                    oninput="SurgeryApprovalPage.onCatalogSearchInput(${s.id}, this.value)">
                <div id="sap-catalog-results-box">
                    ${filteredProcs.length > 0 ? `
                    <div class="sap-catalog-results">
                        ${filteredProcs.map(p => `
                        <button type="button" class="sap-catalog-option ${pcObj.confirmedCatalogEntryId === p.id ? 'is-selected' : ''}"
                            onclick="SurgeryApprovalPage.selectCatalogEntry(${s.id}, '${p.id}', '${p.rankCode}')">
                            <span>${Utils.escapeHtml(p.name)}</span>
                            <span class="sap-tag">${Utils.escapeHtml(p.rankLabel)}</span>
                        </button>`).join('')}
                    </div>` : ''}
                </div>` : ''}

                ${pcObj.confirmedClass === 'unclassified' ? `
                <input type="text" class="sap-input" placeholder="Ghi chú thuyết minh chuyên môn cho kỹ thuật không phân loại (tối thiểu 5 ký tự)..."
                    aria-label="Thuyết minh kỹ thuật không phân loại"
                    value="${Utils.escapeHtml(pcObj.unclassifiedNote || '')}" ${!canEdit ? 'disabled' : ''}
                    onchange="SurgeryApprovalPage.patchDraft(${s.id}, { clinicalClassification: { procedureClass: { unclassifiedNote: this.value } } })">` : ''}

                ${sysCheck === 'over_column' && (urg === 'elective' || urg === 'elective_service') ? `
                <div class="sap-alert sap-alert--danger">
                    <strong>Nguyên tắc xếp cột BS 2026:</strong> Mổ chương trình và mổ yêu cầu không được phép vượt cột (BS Cột <strong>${Utils.escapeHtml(baseCol)}</strong> không mổ hạng <strong>${Utils.escapeHtml(pcObj.confirmedClass || pcObj.suggestedClass || '')}</strong>). Vui lòng phân công lại BS mổ chính đúng cột trên Lịch mổ tuần.
                </div>` : ''}

                ${sysCheck === 'over_column' && urg === 'semi_urgent' && Number(colObj.columnStepDelta || 9) === 1 ? `
                <input type="text" class="sap-input" placeholder="Ghi rõ lý do ca bán khẩn không có nhân sự cột trên phù hợp để BCN cân nhắc duyệt vượt 01 cột..."
                    aria-label="Lý do xin vượt 1 cột ca bán khẩn"
                    value="${Utils.escapeHtml(colObj.overColumnRef || '')}" ${!canEdit ? 'disabled' : ''}
                    onchange="SurgeryApprovalPage.patchDraft(${s.id}, { clinicalClassification: { columnCompliance: { declaredMode: 'propose_over_column', overColumnRef: this.value } } })">` : ''}
            </div>
        </section>`;
    },

    // ── BƯỚC 2.2 & 2.6: Step ② Lâm sàng (4 Chip Groups + Exactly 1 Active Module B1–B4, Zero <select>) ──
    _renderStep2Html(s, actor, canEdit, stepMiss, returnedSet) {
        const cc = s.clinicalClassification || {};
        const pgVal = cc.pathologyGroup?.confirmedValue || cc.pathologyGroup?.suggestedValue || '';
        const chips = s.clinicalChips || {};
        const comorb = chips.comorbidities || { confirmed: false, values: [] };
        const anti = chips.antithromboticPlan || { confirmed: false, mode: null };
        const bd = chips.bloodAndDevices || { confirmed: false, values: [] };
        const stoma = chips.stomaPlan || { confirmed: false, value: null };
        const hasReturnedInStep2 = ['sap-f-comorbidities', 'sap-f-antithrombotic', 'sap-f-blood-devices', 'sap-f-stoma', 'sap-f-context-module'].some(id => returnedSet.has(id));
        const hasHighlightInStep2 = ['sap-f-comorbidities', 'sap-f-antithrombotic', 'sap-f-blood-devices', 'sap-f-stoma', 'sap-f-context-module'].includes(this._highlightFieldId);

        const isAutoCollapsed = stepMiss.length === 0 && !hasReturnedInStep2 && !hasHighlightInStep2 && this._expandedSteps[2] !== true;
        if (isAutoCollapsed) {
            const cSummary = (comorb.values || []).includes('none') ? 'Không bệnh nền' : `${(comorb.values || []).length} bệnh nền`;
            const aSummary = anti.mode === 'none_confirmed' ? 'Không kháng đông' : (SAP_ANTITHROMBOTIC_MODES.find(m => m.value === anti.mode)?.label || '');
            const sSummary = SAP_STOMA_PLANS.find(p => p.value === stoma.value)?.label || '';
            return `
            <button type="button" id="sap-step-card-2" class="sap-step-collapsed-bar" onclick="SurgeryApprovalPage.toggleStepExpand(${s.id}, 2)">
                <span>${this._ico('✓')} Bước ② Lâm sàng: ${Utils.escapeHtml([cSummary, aSummary, sSummary].filter(Boolean).join(' · '))}</span>
                <span>Mở sửa ▾</span>
            </button>`;
        }

        const suggestions = canEdit ? this._buildStepSuggestions(s, 2) : [];
        const eff2 = this._getEffectiveStep2Suggestions(s);
        const fieldCls = fid => `sap-field-block ${returnedSet.has(fid) ? 'sap-field--returned-highlight' : ''} ${this._highlightFieldId === fid ? 'sap-field--missing-focus' : ''}`;

        return `
        <section class="sap-section" id="sap-step-card-2" aria-label="Bước 2 Đánh giá lâm sàng, thuốc chống huyết khối và chuyên khoa">
            <div class="sap-section-header">
                <h3 class="sap-section-title">Bước ② Lâm sàng, Kháng đông & Đặc thù bệnh lý</h3>
                ${stepMiss.length === 0 ? `<button type="button" class="sap-btn sap-btn--ghost" onclick="SurgeryApprovalPage.toggleStepExpand(${s.id}, 2)">Thu gọn ▴</button>` : `<span class="sap-step-nav-pill sap-step-nav-pill--todo">Còn ${stepMiss.length} mục</span>`}
            </div>

            ${suggestions.length > 0 ? `
            <div class="sap-step-suggest-box">
                <div class="sap-step-suggest-text">
                    <strong>${this._ico('✨')} Gợi ý tự động ở Bước ②:</strong> ${Utils.escapeHtml(suggestions.join(' · '))}
                </div>
                <button type="button" class="sap-btn sap-btn--primary" id="sap-btn-confirm-step-2"
                    onclick="SurgeryApprovalPage.confirmStepSuggestions(${s.id}, 2)">
                    ${this._ico('✓')} <span>Xác nhận các gợi ý ở bước này</span>
                </button>
            </div>` : ''}

            <!-- Bệnh nền -->
            <div class="${fieldCls('sap-f-comorbidities')}" id="sap-f-comorbidities">
                <div class="sap-field-label">Bệnh nền nội khoa</div>
                <div class="sap-chip-group">
                    ${SAP_COMORBIDITIES.map(c => {
                        const hasConf = comorb.confirmed && (comorb.values || []).includes(c.value);
                        const hasSugg = !comorb.confirmed && (eff2.comorbValues || []).includes(c.value);
                        const cls = hasConf ? 'sap-chip--selected' : (hasSugg ? 'sap-chip--suggested' : '');
                        return `<button type="button" class="sap-chip ${cls}" ${!canEdit ? 'disabled' : ''}
                            onclick="SurgeryApprovalPage.toggleMultiChip(${s.id}, 'comorbidities', '${c.value}', ${Boolean(c.exclusive)})">
                            <span>${Utils.escapeHtml(c.label)}</span>
                            ${hasSugg ? '<span class="sap-chip-hint">Gợi ý</span>' : ''}
                        </button>`;
                    }).join('')}
                </div>
                ${(comorb.values || []).includes('other') ? `
                <input type="text" class="sap-input" placeholder="Ghi rõ bệnh nền khác..."
                    aria-label="Ghi rõ bệnh nền khác"
                    value="${Utils.escapeHtml(comorb.otherComorbidityNote || '')}" ${!canEdit ? 'disabled' : ''}
                    onchange="SurgeryApprovalPage.patchChipWithSync(${s.id}, { comorbidities: { confirmed: true, values: ${JSON.stringify(comorb.values)}, otherComorbidityNote: this.value } })">` : ''}
            </div>

            <!-- Thuốc chống huyết khối -->
            <div class="${fieldCls('sap-f-antithrombotic')}" id="sap-f-antithrombotic">
                <div class="sap-field-label">Thuốc chống huyết khối (Kháng đông / Kháng kết tập tiểu cầu)</div>
                <div class="sap-chip-group">
                    ${SAP_ANTITHROMBOTIC_MODES.map(m => {
                        const isConf = anti.confirmed && anti.mode === m.value;
                        const isSugg = !anti.confirmed && eff2.antiMode === m.value;
                        const cls = isConf ? 'sap-chip--selected' : (isSugg ? 'sap-chip--suggested' : '');
                        return `<button type="button" class="sap-chip ${cls}" ${!canEdit ? 'disabled' : ''}
                            onclick="SurgeryApprovalPage.selectAntithromboticMode(${s.id}, '${m.value}')">
                            <span>${Utils.escapeHtml(m.label)}</span>
                            ${isSugg ? '<span class="sap-chip-hint">Gợi ý</span>' : ''}
                        </button>`;
                    }).join('')}
                </div>
                ${anti.mode && anti.mode !== 'none_confirmed' ? `
                <div class="sap-canary-grid" style="margin-top:6px;">
                    <input type="text" class="sap-input" placeholder="Tên thuốc (Aspirin, Clopidogrel, Rivaroxaban...)"
                        aria-label="Tên thuốc chống huyết khối"
                        value="${Utils.escapeHtml(anti.drugName || '')}" ${!canEdit ? 'disabled' : ''}
                        onchange="SurgeryApprovalPage.updateAntithromboticDetail(${s.id}, 'drugName', this.value)">
                    <input type="text" class="sap-input" placeholder="Liều cuối cùng (ngày/giờ)"
                        aria-label="Thời điểm liều cuối cùng"
                        value="${Utils.escapeHtml(anti.lastDoseAt || '')}" ${!canEdit ? 'disabled' : ''}
                        onchange="SurgeryApprovalPage.updateAntithromboticDetail(${s.id}, 'lastDoseAt', this.value)">
                    ${anti.mode === 'bridging_per_plan' ? `
                    <input type="text" class="sap-input" placeholder="Thuốc bắc cầu (Enoxaparin / Heparin...)"
                        aria-label="Thuốc bắc cầu"
                        value="${Utils.escapeHtml(anti.bridgingAgent || '')}" ${!canEdit ? 'disabled' : ''}
                        onchange="SurgeryApprovalPage.updateAntithromboticDetail(${s.id}, 'bridgingAgent', this.value)">` : ''}
                    <input type="text" class="sap-input" placeholder="Chuyên khoa / Bác sĩ hội chẩn duyệt"
                        aria-label="Chuyên khoa hoặc bác sĩ duyệt"
                        value="${Utils.escapeHtml(anti.approvingSpecialtyOrDoctor || '')}" ${!canEdit ? 'disabled' : ''}
                        onchange="SurgeryApprovalPage.updateAntithromboticDetail(${s.id}, 'approvingSpecialtyOrDoctor', this.value)">
                    <input type="text" class="sap-input" placeholder="Ghi chú kế hoạch cầm máu / khởi động lại sau mổ"
                        aria-label="Kế hoạch cầm máu"
                        value="${Utils.escapeHtml(anti.planReferenceNote || '')}" ${!canEdit ? 'disabled' : ''}
                        onchange="SurgeryApprovalPage.updateAntithromboticDetail(${s.id}, 'planReferenceNote', this.value)">
                </div>` : ''}
            </div>

            <!-- Dự trù máu & thiết bị -->
            <div class="${fieldCls('sap-f-blood-devices')}" id="sap-f-blood-devices">
                <div class="sap-field-label">Dự trù máu & Thiết bị đặc thù</div>
                <div class="sap-chip-group">
                    ${SAP_BLOOD_DEVICES.filter(d => !(s.approachType === 'robot' && d.value === 'basic_instruments_only')).map(d => {
                        const hasConf = bd.confirmed && (bd.values || []).includes(d.value);
                        const hasSugg = !bd.confirmed && (eff2.bdValues || []).includes(d.value);
                        const cls = hasConf ? 'sap-chip--selected' : (hasSugg ? 'sap-chip--suggested' : '');
                        return `<button type="button" class="sap-chip ${cls}" ${!canEdit ? 'disabled' : ''}
                            onclick="SurgeryApprovalPage.toggleMultiChip(${s.id}, 'bloodAndDevices', '${d.value}', ${Boolean(d.exclusive)})">
                            <span>${Utils.escapeHtml(d.label)}</span>
                            ${hasSugg ? '<span class="sap-chip-hint">Gợi ý</span>' : ''}
                        </button>`;
                    }).join('')}
                </div>
            </div>

            <!-- Kế hoạch HMNT -->
            <div class="${fieldCls('sap-f-stoma')}" id="sap-f-stoma">
                <div class="sap-field-label">Kế hoạch Hậu môn nhân tạo (HMNT)</div>
                <div class="sap-chip-group">
                    ${SAP_STOMA_PLANS.map(p => {
                        const isConf = stoma.confirmed && stoma.value === p.value;
                        const isSugg = !stoma.confirmed && eff2.stomaValue === p.value;
                        const cls = isConf ? 'sap-chip--selected' : (isSugg ? 'sap-chip--suggested' : '');
                        return `<button type="button" class="sap-chip ${cls}" ${!canEdit ? 'disabled' : ''}
                            onclick="SurgeryApprovalPage.patchChipWithSync(${s.id}, { stomaPlan: { confirmed: true, value: '${p.value}' } })">
                            <span>${Utils.escapeHtml(p.label)}</span>
                            ${isSugg ? '<span class="sap-chip-hint">Gợi ý</span>' : ''}
                        </button>`;
                    }).join('')}
                </div>
            </div>

            <!-- Đúng 1 Module chuyên biệt theo nhóm bệnh (ẩn hoàn toàn các module không liên quan) -->
            ${this._renderActiveContextModuleHtml(s, pgVal, stoma.value, canEdit, fieldCls('sap-f-context-module'))}
        </section>`;
    },

    _renderActiveContextModuleHtml(s, pgVal, stomaVal, canEdit, wrapperClass) {
        const ctx = s.clinicalChips?.contextChips || {};

        if (pgVal === 'benign_anorectal') {
            const b1 = ctx.fistulaContext || {};
            return `
            <div class="${wrapperClass}" id="sap-f-context-module">
                <div class="sap-field-label">${this._ico('🔍')} Đánh giá chuyên sâu Hậu môn – Trực tràng lành tính</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'not_fistula', l: 'Không phải rò HM (Trĩ / Nứt kẽ / Áp-xe...)' },
                        { v: 'simple_fistula', l: 'Rò hậu môn đơn giản' },
                        { v: 'complex_or_recurrent_fistula', l: 'Rò hậu môn phức tạp / tái phát' }
                    ].map(o => `<button type="button" class="sap-chip ${b1.fistulaClassification === o.v ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.updateContextField(${s.id}, 'fistulaContext', { fistulaClassification: '${o.v}' })">${o.l}</button>`).join('')}
                </div>
                ${['simple_fistula', 'complex_or_recurrent_fistula'].includes(b1.fistulaClassification) ? `
                <div class="sap-chip-group" style="margin-top:6px;">
                    ${[
                        { v: 'mri_fistula_done', l: 'Đã chụp MRI đường rò' },
                        { v: 'endoanal_us_done', l: 'Đã siêu âm lòng trực tràng' },
                        { v: 'not_indicated_simple', l: 'Không chỉ định MRI (rò thấp/đơn giản)' },
                        { v: 'other_note', l: 'Hình ảnh khác' }
                    ].map(o => `<button type="button" class="sap-chip ${b1.fistulaImaging === o.v ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.updateContextField(${s.id}, 'fistulaContext', { fistulaImaging: '${o.v}' })">${o.l}</button>`).join('')}
                </div>
                ${b1.fistulaClassification === 'complex_or_recurrent_fistula' && b1.fistulaImaging === 'not_indicated_simple' ? `
                <input type="text" class="sap-input" placeholder="Ghi rõ lý do rò phức tạp chưa chụp MRI..."
                    aria-label="Lý do rò phức tạp chưa chụp MRI"
                    value="${Utils.escapeHtml(b1.missingMriReason || '')}" ${!canEdit ? 'disabled' : ''}
                    onchange="SurgeryApprovalPage.updateContextField(${s.id}, 'fistulaContext', { missingMriReason: this.value })">` : ''}` : ''}
            </div>`;
        }

        if (pgVal === 'benign_colorectal_abdominal' || stomaVal === 'stoma_closure') {
            const b2 = ctx.benignAbdominalContext || {};
            return `
            <div class="${wrapperClass}" id="sap-f-context-module">
                <div class="sap-field-label">${this._ico('🔍')} Đánh giá Lành tính Đại trực tràng – Ổ bụng / Đóng HMNT</div>
                ${pgVal === 'benign_colorectal_abdominal' ? `
                <div class="sap-filter-sub-label">Phân nhóm bệnh lý:</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'stoma_closure', l: 'Đóng hậu môn nhân tạo' },
                        { v: 'diverticular_or_ibd', l: 'Túi thừa / Viêm ruột (IBD)' },
                        { v: 'rectal_prolapse_pelvic_floor', l: 'Sa trực tràng / Sàn chậu' },
                        { v: 'benign_stricture_fistula', l: 'Hẹp / Rò đại trực tràng lành tính' },
                        { v: 'other_benign_abdominal', l: 'Lành tính ổ bụng khác' }
                    ].map(o => `<button type="button" class="sap-chip ${b2.subType === o.v ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.updateContextField(${s.id}, 'benignAbdominalContext', { subType: '${o.v}' })">${o.l}</button>`).join('')}
                </div>
                <div class="sap-filter-sub-label">Chuẩn bị đại tràng:</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'full_mechanical_prep', l: 'Chuẩn bị đại tràng cơ học đầy đủ' },
                        { v: 'enema_only', l: 'Thụt tháo trực tràng' },
                        { v: 'eras_no_prep', l: 'ERAS không chuẩn bị ruột cơ học' }
                    ].map(o => `<button type="button" class="sap-chip ${b2.bowelPrepPlan === o.v ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.updateContextField(${s.id}, 'benignAbdominalContext', { bowelPrepPlan: '${o.v}' })">${o.l}</button>`).join('')}
                </div>` : ''}
                ${stomaVal === 'stoma_closure' || b2.subType === 'stoma_closure' ? `
                <div class="sap-filter-sub-label">Kiểm tra lưu thông đầu dưới trước đóng HMNT:</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'endoscopy_or_contrast_patent', l: 'Nội soi / X-quang cản quang thông tốt' },
                        { v: 'stricture_planned_resection', l: 'Có hẹp miệng nối — dự kiến cắt nối lại' }
                    ].map(o => `<button type="button" class="sap-chip ${b2.distalLimbCheck === o.v ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.updateContextField(${s.id}, 'benignAbdominalContext', { distalLimbCheck: '${o.v}' })">${o.l}</button>`).join('')}
                </div>` : ''}
            </div>`;
        }

        if (pgVal === 'cancer_confirmed') {
            const b3 = ctx.cancerContext || {};
            const locs = b3.tumorLocation || [];
            const st = b3.clinicalStage || {};
            const isRectal = locs.some(l => String(l).startsWith('rectum_') || l === 'anal_canal');
            const locOpts = [
                { v: 'right_colon', l: 'Đại tràng phải' },
                { v: 'transverse_colon', l: 'Đại tràng ngang' },
                { v: 'left_colon', l: 'Đại tràng trái' },
                { v: 'sigmoid', l: 'Đại tràng chậu hông (Sigma)' },
                { v: 'rectum_upper', l: 'Trực tràng cao' },
                { v: 'rectum_mid', l: 'Trực tràng giữa' },
                { v: 'rectum_low', l: 'Trực tràng thấp' },
                { v: 'anal_canal', l: 'Ống hậu môn' }
            ];
            return `
            <div class="${wrapperClass}" id="sap-f-context-module">
                <div class="sap-field-label">${this._ico('🎗️')} Hồ sơ Ung thư Đại trực tràng – Ống hậu môn (GPB, cTNM, CRM, MDT)</div>
                <div class="sap-filter-sub-label">Vị trí u (chọn ≥ 2 nếu u đồng thời đa ổ):</div>
                <div class="sap-chip-group">
                    ${locOpts.map(o => `<button type="button" class="sap-chip ${locs.includes(o.v) ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.toggleCancerLocation(${s.id}, '${o.v}')">${o.l}</button>`).join('')}
                </div>

                <div class="sap-filter-sub-label">Giải phẫu bệnh trước mổ:</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'adenocarcinoma', l: 'Carcinôm tuyến (Adenocarcinoma)' },
                        { v: 'mucinous_signet', l: 'Carcinôm nhầy / tế bào nhẫn' },
                        { v: 'scc', l: 'Carcinôm tế bào gai (SCC)' },
                        { v: 'neuroendocrine_gist_other', l: 'Thần kinh nội tiết / GIST / Khác' }
                    ].map(o => `<button type="button" class="sap-chip ${b3.preopHistology === o.v ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.updateContextField(${s.id}, 'cancerContext', { preopHistology: '${o.v}' })">${o.l}</button>`).join('')}
                </div>

                <div class="sap-filter-sub-label">Giai đoạn lâm sàng cT · cN · cM (chạm chọn nhanh, không menu thả xuống):</div>
                <div style="display:flex;flex-direction:column;gap:6px;">
                    <div class="sap-chip-group">
                        <span class="sap-filter-sub-label" style="min-width:32px;">cT:</span>
                        ${['cT1', 'cT2', 'cT3', 'cT4a', 'cT4b', 'Tx'].map(v => `<button type="button" class="sap-chip ${st.cT === v ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                            onclick="SurgeryApprovalPage.updateCancerStage(${s.id}, 'cT', '${v}')">${v}</button>`).join('')}
                    </div>
                    <div class="sap-chip-group">
                        <span class="sap-filter-sub-label" style="min-width:32px;">cN:</span>
                        ${['cN0', 'cN1', 'cN2', 'Nx'].map(v => `<button type="button" class="sap-chip ${st.cN === v ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                            onclick="SurgeryApprovalPage.updateCancerStage(${s.id}, 'cN', '${v}')">${v}</button>`).join('')}
                    </div>
                    <div class="sap-chip-group">
                        <span class="sap-filter-sub-label" style="min-width:32px;">cM:</span>
                        ${['cM0', 'cM1a', 'cM1b', 'Mx'].map(v => `<button type="button" class="sap-chip ${st.cM === v ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                            onclick="SurgeryApprovalPage.updateCancerStage(${s.id}, 'cM', '${v}')">${v}</button>`).join('')}
                    </div>
                </div>
                ${[st.cT, st.cN, st.cM].some(x => ['Tx', 'Nx', 'Mx'].includes(x)) ? `
                <input type="text" class="sap-input" placeholder="Ghi rõ lý do phân giai đoạn Tx / Nx / Mx..."
                    aria-label="Ghi chú phân giai đoạn Tx Nx Mx"
                    value="${Utils.escapeHtml(st.stagingNote || '')}" ${!canEdit ? 'disabled' : ''}
                    onchange="SurgeryApprovalPage.updateCancerStage(${s.id}, 'stagingNote', this.value)">` : ''}

                ${isRectal ? `
                <div class="sap-filter-sub-label">Diện cắt vòng quanh (CRM) trên MRI tiểu khung:</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'crm_clear', l: 'CRM âm tính (an toàn > 1mm)' },
                        { v: 'crm_threatened_or_positive', l: 'CRM bị đe dọa / dương tính (≤ 1mm)' },
                        { v: 'unknown_no_pelvic_mri', l: 'Chưa có MRI chậu (ghi lý do)' }
                    ].map(o => `<button type="button" class="sap-chip ${b3.crmStatus === o.v ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.updateContextField(${s.id}, 'cancerContext', { crmStatus: '${o.v}' })">${o.l}</button>`).join('')}
                </div>
                ${b3.crmStatus === 'unknown_no_pelvic_mri' ? `
                <input type="text" class="sap-input" placeholder="Ghi lý do chưa chụp được MRI tiểu khung (chống chỉ định kim loại, u chảy máu...)..."
                    aria-label="Lý do chưa có MRI tiểu khung"
                    value="${Utils.escapeHtml(b3.crmNote || '')}" ${!canEdit ? 'disabled' : ''}
                    onchange="SurgeryApprovalPage.updateContextField(${s.id}, 'cancerContext', { crmNote: this.value })">` : ''}` : ''}

                <div class="sap-filter-sub-label">Điều trị đa mô thức trước mổ:</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'upfront_surgery', l: 'Mổ kỳ đầu (Upfront surgery)' },
                        { v: 'post_neoadjuvant_crt', l: 'Sau hóa xạ trị tiền phẫu (CRT)' },
                        { v: 'post_tnt', l: 'Sau điều trị tân bổ trợ toàn diện (TNT)' },
                        { v: 'post_systemic_chemo', l: 'Sau hóa trị toàn thân' }
                    ].map(o => `<button type="button" class="sap-chip ${b3.multimodalStatus === o.v ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.updateContextField(${s.id}, 'cancerContext', { multimodalStatus: '${o.v}' })">${o.l}</button>`).join('')}
                </div>

                <div class="sap-filter-sub-label">Hội chẩn Ung bướu / Đa chuyên khoa (MDT):</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'mdt_completed', l: 'Đã hội chẩn MDT / Ung bướu' },
                        { v: 'standard_guideline_no_mdt_needed', l: 'Phác đồ chuẩn thường quy (không cần MDT)' },
                        { v: 'mdt_pending', l: 'Đang chờ kết luận MDT' }
                    ].map(o => `<button type="button" class="sap-chip ${b3.mdtReviewStatus === o.v ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.updateContextField(${s.id}, 'cancerContext', { mdtReviewStatus: '${o.v}' })">${o.l}</button>`).join('')}
                </div>
            </div>`;
        }

        if (pgVal === 'neoplasm_suspected_or_special') {
            const b4 = ctx.specialNeoplasmContext || {};
            return `
            <div class="${wrapperClass}" id="sap-f-context-module">
                <div class="sap-field-label">${this._ico('🧬')} Hồ sơ U tân sinh đặc thù / Nghi ác chưa GPB</div>
                <div class="sap-filter-sub-label">Phân nhóm tổn thương:</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'gist_or_submucosal', l: 'GIST / U dưới niêm mạc' },
                        { v: 'net', l: 'U thần kinh nội tiết (NET)' },
                        { v: 'giant_polyp_dysplasia', l: 'Polyp lớn loạn sản cao' },
                        { v: 'presacral_retroperitoneal_tumor', l: 'U trước xương cùng / sau phúc mạc' },
                        { v: 'suspected_malignancy_biopsy_negative', l: 'U nghi ác sinh thiết âm tính / hẹp' }
                    ].map(o => `<button type="button" class="sap-chip ${b4.neoplasmCategory === o.v ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.updateContextField(${s.id}, 'specialNeoplasmContext', { neoplasmCategory: '${o.v}' })">${o.l}</button>`).join('')}
                </div>
                <div class="sap-filter-sub-label">Tình trạng sinh thiết trước mổ:</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'biopsy_confirmed_special', l: 'Đã có GPB / Hóa mô miễn dịch' },
                        { v: 'submucosal_not_biopsied', l: 'U dưới niêm / trước xương cùng không sinh thiết' },
                        { v: 'stenotic_or_bleeding_failed_biopsy', l: 'Hẹp khít / chảy máu sinh thiết chưa ra u' }
                    ].map(o => `<button type="button" class="sap-chip ${b4.biopsyStatus === o.v ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.updateContextField(${s.id}, 'specialNeoplasmContext', { biopsyStatus: '${o.v}' })">${o.l}</button>`).join('')}
                </div>
                ${b4.biopsyStatus === 'stenotic_or_bleeding_failed_biopsy' ? `
                <input type="text" class="sap-input" placeholder="Ghi rõ lý do chưa có GPB dương tính trước mổ..."
                    aria-label="Lý do chưa có giải phẫu bệnh trước mổ"
                    value="${Utils.escapeHtml(b4.missingBiopsyReason || '')}" ${!canEdit ? 'disabled' : ''}
                    onchange="SurgeryApprovalPage.updateContextField(${s.id}, 'specialNeoplasmContext', { missingBiopsyReason: this.value })">` : ''}
                <div class="sap-filter-sub-label">Đánh giá lan rộng trên CT / MRI:</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'localized_resectable', l: 'Khu trú — cắt trọn được R0' },
                        { v: 'adjacent_organ_involvement', l: 'Xâm lấn tạng lân cận — cần phối hợp đa tạng' }
                    ].map(o => `<button type="button" class="sap-chip ${b4.extentEvaluation === o.v ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.updateContextField(${s.id}, 'specialNeoplasmContext', { extentEvaluation: '${o.v}' })">${o.l}</button>`).join('')}
                </div>
                <div class="sap-filter-sub-label">Hội chẩn chuyên môn:</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'mdt_completed', l: 'Đã hội chẩn khoa / liên chuyên khoa' },
                        { v: 'department_board_reviewed', l: 'Đã thông qua giao ban chuyên môn khoa' }
                    ].map(o => `<button type="button" class="sap-chip ${b4.mdtReviewStatus === o.v ? 'sap-chip--selected' : ''}" ${!canEdit ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.updateContextField(${s.id}, 'specialNeoplasmContext', { mdtReviewStatus: '${o.v}' })">${o.l}</button>`).join('')}
                </div>
            </div>`;
        }
        return '';
    },

    // ── BƯỚC 2.4, 2.5, 2.7: Step ③ Bảng kiểm (5 Independent Rows + Synced Strip + 3-Segment Control + 10s Undo) ──
    _renderStep3Html(s, actor, canEdit, stepMiss, returnedSet) {
        const isTrainee = SAP_TRAINEE_IDS.has(actor.staffId);
        const isAttending = SAP_ATTENDING_IDS.has(actor.staffId) || SAP_BCN_IDS.has(actor.staffId);
        const ck = s.preopChecklist || {};
        const pgVal = s.clinicalClassification?.pathologyGroup?.confirmedValue || '';
        const pcClass = s.clinicalClassification?.procedureClass?.confirmedClass || '';

        // Preview exact items that "Xác nhận nhanh mục thường quy" will modify (BƯỚC 2.7)
        const bulkWillChange = [];
        for (const meta of SAP_CK_INDEPENDENT_ITEMS.filter(m => !m.attendingOnly)) {
            const st = ck[meta.code]?.state || 'unverified';
            if (['unverified', 'prepared_ok'].includes(st)) {
                if (isTrainee && st === 'prepared_ok') continue;
                bulkWillChange.push(meta.title);
            }
        }
        const canRunBulk = canEdit && Boolean(pgVal && pgVal !== 'unknown' && pcClass);
        const showUndoToastBar = Boolean(s._bulkUndoSnapshot) && Date.now() < this._bulkUndoExpiresAt;

        // Mục 2.4 Synced Summary Strip ("✓ theo mục ②")
        const ck03Ok = ['verified_ok', 'verified_abnormal_planned', 'prepared_ok'].includes(ck['CK-03']?.state);
        const ck07Ok = ['verified_ok', 'prepared_ok'].includes(ck['CK-07']?.state);
        const ck05Ok = ['verified_ok', 'verified_abnormal_planned', 'not_applicable', 'prepared_ok'].includes(ck['CK-05']?.state);

        const commonMeta = SAP_CK_INDEPENDENT_ITEMS.filter(m => !m.attendingOnly);
        const attendingMeta = SAP_CK_INDEPENDENT_ITEMS.filter(m => m.attendingOnly);

        return `
        <section class="sap-section" id="sap-step-card-3" aria-label="Bước 3 Bảng kiểm tiền phẫu và Cam kết của BS chính">
            <div class="sap-section-header">
                <h3 class="sap-section-title">Bước ③ Bảng kiểm tiền phẫu & Xác nhận BS chính</h3>
                <span class="sap-step-nav-pill ${stepMiss.length === 0 ? 'sap-step-nav-pill--done' : 'sap-step-nav-pill--todo'}">
                    ${stepMiss.length === 0 ? '✓ Hoàn tất' : `Còn ${stepMiss.length} mục`}
                </span>
            </div>

            <!-- Mục 2.4: Đồng bộ tự động từ Bước ② -->
            <div class="sap-synced-strip">
                <span style="font-weight:700;color:var(--text-heading);">Đồng bộ tự động từ Bước ②:</span>
                <div class="sap-synced-pills">
                    <span class="sap-synced-pill ${ck03Ok ? '' : 'sap-synced-pill--pending'}"
                        ${!ck03Ok ? `onclick="SurgeryApprovalPage.jumpToStep(${s.id}, 2, 'sap-f-antithrombotic')"` : ''}>
                        ${this._ico(ck03Ok ? '✓' : '⏳')} <span>Bệnh nền & Kháng đông: ${ck03Ok ? '✓ theo mục ②' : 'Chờ mục ②'}</span>
                    </span>
                    <span class="sap-synced-pill ${ck07Ok ? '' : 'sap-synced-pill--pending'}"
                        ${!ck07Ok ? `onclick="SurgeryApprovalPage.jumpToStep(${s.id}, 2, 'sap-f-blood-devices')"` : ''}>
                        ${this._ico(ck07Ok ? '✓' : '⏳')} <span>Máu & Thiết bị: ${ck07Ok ? '✓ theo mục ②' : 'Chờ mục ②'}</span>
                    </span>
                    <span class="sap-synced-pill ${ck05Ok ? '' : 'sap-synced-pill--pending'}"
                        ${!ck05Ok ? `onclick="SurgeryApprovalPage.jumpToStep(${s.id}, 2, 'sap-f-context-module')"` : ''}>
                        ${this._ico(ck05Ok ? '✓' : '⏳')} <span>GPB & Giai đoạn: ${ck05Ok ? '✓ theo mục ②' : 'Chờ mục ②'}</span>
                    </span>
                </div>
            </div>

            <!-- BƯỚC 2.7: Xác nhận nhanh có danh sách xem trước + Thanh Hoàn tác 10 giây -->
            ${showUndoToastBar ? `
            <div class="sap-undo-bar" role="status" aria-live="polite">
                <span>${this._ico('⚡')} Đã xác nhận nhanh các mục thường quy. Bạn có thể hoàn tác trong 10 giây.</span>
                <button type="button" class="sap-btn" id="sap-btn-undo-bulk" onclick="SurgeryApprovalPage.undoBulkConfirm(${s.id})">
                    ${this._ico('↩️')} <span>Hoàn tác</span>
                </button>
            </div>` : ''}

            ${canEdit ? `
            <div class="sap-step-suggest-box">
                <div class="sap-step-suggest-text">
                    <strong>${this._ico('⚡')} Xác nhận nhanh mục thường quy:</strong>
                    ${!canRunBulk
                        ? 'Hoàn tất Nhóm bệnh và Kỹ thuật ở Bước ① trước khi dùng nút này.'
                        : (bulkWillChange.length > 0
                            ? `Sẽ đánh dấu Đạt cho: <strong>${Utils.escapeHtml(bulkWillChange.join(' · '))}</strong> (không tự động đánh dấu Phim gốc và Cam kết PT).`
                            : 'Tất cả 3 mục thường quy chung đã được đánh dấu.')}
                </div>
                <button type="button" class="sap-btn sap-btn--primary" id="sap-btn-bulk-routine"
                    ${!canRunBulk || bulkWillChange.length === 0 ? 'disabled' : ''}
                    onclick="SurgeryApprovalPage.runBulkConfirm(${s.id})">
                    ${this._ico('⚡')} <span>Xác nhận nhanh (${bulkWillChange.length})</span>
                </button>
            </div>` : ''}

            <!-- 3 Mục chung độc lập -->
            <div class="sap-ck-list">
                ${commonMeta.map(meta => this._renderChecklistItemRow(s, meta, ck[meta.code], actor, canEdit, returnedSet)).join('')}
            </div>

            <!-- Khu vực riêng của Bác sĩ chính (2 mục bắt buộc BS chính: Phim/nội soi gốc + Cam kết PT) -->
            <div class="sap-section sap-section--attending ${this._highlightFieldId === 'sap-attending-only-box' ? 'sap-field--missing-focus' : ''}" id="sap-attending-only-box">
                <div class="sap-section-header">
                    <h4 class="sap-section-title">${this._ico('🩺')} Khu vực dành riêng cho Bác sĩ mổ chính</h4>
                    ${isTrainee ? `<span class="sap-tag">Học viên chỉ xem — Chờ BS chính xác nhận</span>` : ''}
                </div>
                <div class="sap-ck-list">
                    ${attendingMeta.map(meta => this._renderChecklistItemRow(s, meta, ck[meta.code], actor, canEdit && isAttending, returnedSet)).join('')}
                </div>
            </div>
        </section>`;
    },

    _renderChecklistItemRow(s, meta, itemObj, actor, rowEditable, returnedSet) {
        const it = itemObj || { state: 'unverified' };
        const st = it.state || 'unverified';
        const isTrainee = SAP_TRAINEE_IDS.has(actor.staffId);
        const pgVal = s.clinicalClassification?.pathologyGroup?.confirmedValue || '';
        const pcClass = s.clinicalClassification?.procedureClass?.confirmedClass || '';
        const rowId = `sap-ck-row-${meta.code}`;
        const rowCls = `sap-ck-row ${returnedSet.has(rowId) ? 'sap-field--returned-highlight' : ''} ${this._highlightFieldId === rowId ? 'sap-field--missing-focus' : ''}`;

        // Allow NA segment?
        let canChooseNa = Boolean(meta.allowNotApplicable || meta.allowNotIndicatedWithReason);
        if (meta.allowMinorAnorectalNA) {
            canChooseNa = pgVal === 'benign_anorectal' && ['PT-II', 'PT-III'].includes(pcClass);
        }

        const verifiedName = it.verifiedByStaffId ? Utils.getStaffName(it.verifiedByStaffId) : '';
        const prepName = it.preparedByStaffId ? Utils.getStaffName(it.preparedByStaffId) : '';
        const statusByText = verifiedName
            ? `BS xác nhận: ${verifiedName}`
            : (prepName ? `HV rà sơ bộ: ${prepName} (chờ BS chính)` : 'Chưa xác nhận');

        const isOkActive = isTrainee ? st === 'prepared_ok' : st === 'verified_ok';
        const isPrepBadge = !isTrainee && st === 'prepared_ok';
        const isWarnActive = st === 'verified_abnormal_planned';
        const isNaActive = ['not_applicable', 'not_indicated'].includes(st);

        return `
        <div class="${rowCls}" id="${rowId}" title="Mã nội bộ nhật ký: ${meta.code}">
            <div class="sap-ck-main">
                <div class="sap-ck-info">
                    <div class="sap-ck-title">${Utils.escapeHtml(meta.title)}</div>
                    <div class="sap-ck-desc">${Utils.escapeHtml(meta.desc)} · <strong>${Utils.escapeHtml(statusByText)}</strong></div>
                </div>
                ${isTrainee ? `
                <div class="sap-seg-control" role="group" aria-label="${Utils.escapeHtml(meta.title)}">
                    <button type="button" class="sap-seg-btn ${isOkActive ? 'is-prep' : ''}" ${!rowEditable ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.setChecklistState(${s.id}, '${meta.code}', '${isOkActive ? 'unverified' : 'prepared_ok'}')">
                        ${this._ico('✓')} <span>${isOkActive ? 'Đã rà sơ bộ' : 'Đánh dấu Đạt sơ bộ'}</span>
                    </button>
                </div>` : `
                <div class="sap-seg-control" role="group" aria-label="${Utils.escapeHtml(meta.title)}">
                    <button type="button" class="sap-seg-btn ${isOkActive ? 'is-ok' : (isPrepBadge ? 'is-prep' : '')}" ${!rowEditable ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.setChecklistState(${s.id}, '${meta.code}', 'verified_ok')">
                        ${this._ico('✓')} <span>${isPrepBadge ? 'Đạt (HV đã rà)' : 'Đạt'}</span>
                    </button>
                    <button type="button" class="sap-seg-btn ${isWarnActive ? 'is-warn' : ''}" ${!rowEditable ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.setChecklistState(${s.id}, '${meta.code}', 'verified_abnormal_planned')">
                        ${this._ico('⚠️')} <span>Bất thường</span>
                    </button>
                    ${canChooseNa ? `
                    <button type="button" class="sap-seg-btn ${isNaActive ? 'is-na' : ''}" ${!rowEditable ? 'disabled' : ''}
                        onclick="SurgeryApprovalPage.setChecklistState(${s.id}, '${meta.code}', '${meta.naState}')">
                        <span>${Utils.escapeHtml(meta.naShortLabel)}</span>
                    </button>` : ''}
                </div>`}
            </div>

            ${meta.hasSubChecks ? this._renderSubSwitchesHtml(s, it.subChecks || {}, isTrainee, rowEditable) : ''}

            ${st === 'verified_abnormal_planned' || (meta.code === 'CK-01' && st === 'not_indicated') ? `
            <input type="text" class="sap-input"
                placeholder="${st === 'not_indicated' ? 'Ghi rõ lý do không chỉ định xét nghiệm tiền phẫu (tối thiểu 5 ký tự)...' : 'Ghi rõ bất thường và kế hoạch xử trí an toàn trước/trong mổ...'}"
                aria-label="Kế hoạch xử trí cho ${Utils.escapeHtml(meta.title)}"
                value="${Utils.escapeHtml(it.clinicalPlanNote || '')}" ${!rowEditable ? 'disabled' : ''}
                onchange="SurgeryApprovalPage.setChecklistNote(${s.id}, '${meta.code}', '${st}', this.value)">` : ''}
        </div>`;
    },

    // BƯỚC 2.5: 1-Row Compact Switches for Khám tiền mê · ECG · X-quang ngực · Siêu âm tim
    _renderSubSwitchesHtml(s, subs, isTrainee, rowEditable) {
        const keys = ['preAnesthesiaExam', 'ecg', 'chestImaging', 'echo'];
        return `
        <div class="sap-subswitches-row" role="group" aria-label="Các thăm dò tiền mê và tim phổi">
            <span class="sap-filter-sub-label">Thăm dò cụ thể:</span>
            ${keys.map(k => {
                const sv = subs[k] || 'unverified';
                const isOk = ['verified_ok', 'prepared_ok', 'ready_for_preanesthesia', 'verified_abnormal_planned'].includes(sv);
                const isNa = sv === 'not_indicated';
                const stateTxt = isOk ? 'Đạt' : (isNa ? 'Không CĐ' : 'Chưa chọn');
                return `
                <button type="button" class="sap-subswitch-btn ${isOk ? 'is-ok' : (isNa ? 'is-na' : '')}" ${!rowEditable ? 'disabled' : ''}
                    onclick="SurgeryApprovalPage.cycleSubCheck(${s.id}, '${k}', '${sv}', ${Boolean(isTrainee)})">
                    ${this._ico(isOk ? '✓' : (isNa ? '—' : '○'))}
                    <span>${Utils.escapeHtml(SAP_SUBCHECK_LABELS[k])}: <strong>${stateTxt}</strong></span>
                </button>`;
            }).join('')}
        </div>`;
    },

    // ── BƯỚC 3.2 & 3.3: BCN 1-Page Executive Summary ("xem ngoại lệ trước" + So sánh Chờ duyệt lại) ──
    _renderBcnExecutiveSummaryHtml(s, cfg, actor, missing) {
        const cc = s.clinicalClassification || {};
        const pgVal = cc.pathologyGroup?.confirmedValue || cc.pathologyGroup?.suggestedValue || '';
        const pgLabel = SAP_PATHOLOGY_GROUPS.find(g => g.value === pgVal)?.label || pgVal || 'Chưa xác nhận';
        const pcObj = cc.procedureClass || {};
        const colObj = cc.columnCompliance || {};
        const chips = s.clinicalChips || {};
        const ck = s.preopChecklist || {};
        const app = s.approval || {};
        const st = app.status || 'draft_unsubmitted';
        const urgLabel = SAP_URGENCY_OPTIONS.find(u => u.value === (cc.urgencyLevel || 'elective'))?.label || cc.urgencyLevel;
        const procName = (this._catalogData?.procedures || []).find(p => p.id === (pcObj.confirmedCatalogEntryId || pcObj.suggestedCatalogEntryId))?.name || s.method || '—';

        const riskFlags = this._computeCaseRiskFlags(s, cfg);
        const abnItems = [];
        for (const [code, it] of Object.entries(ck)) {
            if (it && it.state === 'verified_abnormal_planned') {
                const title = SAP_CK_INDEPENDENT_ITEMS.find(m => m.code === code)?.title
                    || (code === 'CK-03' ? 'Bệnh nền & Thuốc chống huyết khối' : code);
                abnItems.push({ title, note: it.clinicalPlanNote || 'Chưa ghi kế hoạch' });
            }
        }

        // BƯỚC 3.3: Re-approval Comparison Diff ("Chờ duyệt lại": Cũ -> Mới, tô vàng)
        const showDiff = st === 'reapproval_required' || Boolean(app.lastApprovedSnapshot);
        const diffRows = showDiff ? this._computeReapprovalDiffRows(s) : [];

        // Special context summary (100% Vietnamese labels, zero raw enum strings — BƯỚC 2.3)
        const ctxEnumMap = {
            cecum_right_colon: 'Đại tràng phải',
            transverse_colon: 'Đại tràng ngang',
            left_colon: 'Đại tràng trái',
            sigmoid_colon: 'Đại tràng chậu hông (Sigma)',
            rectum_high: 'Trực tràng cao',
            rectum_mid: 'Trực tràng giữa',
            rectum_low: 'Trực tràng thấp',
            anal_canal: 'Ống hậu môn',
            adenocarcinoma_well_mod: 'Carcinôm tuyến biệt hóa tốt/vừa',
            adenocarcinoma_poor_mucinous_signet: 'Carcinôm tuyến kém / nhầy / tế bào nhẫn',
            scc: 'Carcinôm tế bào gai (SCC)',
            neuroendocrine_gist_other: 'Thần kinh nội tiết / GIST / Khác',
            upfront_surgery: 'Mổ kỳ đầu',
            post_neoadjuvant_crt: 'Sau hóa xạ trị tiền phẫu (CRT)',
            post_tnt: 'Sau tân bổ trợ toàn diện (TNT)',
            post_systemic_chemo: 'Sau hóa trị toàn thân',
            mdt_completed: 'Đã hội chẩn MDT',
            not_required_standard: 'Phác đồ chuẩn thường quy',
            department_board_reviewed: 'Đã thông qua giao ban khoa',
            not_fistula: 'Không phải rò hậu môn (Trĩ / Nứt kẽ / Áp-xe)',
            simple_fistula: 'Rò hậu môn đơn giản',
            complex_or_recurrent_fistula: 'Rò hậu môn phức tạp / tái phát',
            pelvic_mri_done: 'Đã chụp MRI đường rò',
            endoanal_us_done: 'Đã siêu âm lòng hậu môn',
            not_indicated_simple: 'Không chỉ định MRI (rò đơn giản)',
            pending_or_contraindicated: 'Chưa chụp / Chống chỉ định MRI',
            diverticular_ibd_volvulus: 'Túi thừa / Viêm ruột / Xoắn đại tràng',
            rectal_prolapse_pelvic_floor: 'Sa trực tràng / Sàn chậu',
            stoma_closure_reversal: 'Đóng hậu môn nhân tạo / Lập lại lưu thông',
            benign_polyposis_other: 'Polyp lành tính lớn / Bệnh lý lành tính khác',
            mechanical_oral_abx: 'Chuẩn bị đại tràng cơ học + Kháng sinh uống',
            enema_only: 'Thụt tháo tại chỗ',
            eras_no_mechanical: 'ERAS không chuẩn bị cơ học',
            confirmed_patent: 'Đã chụp/soi kiểm tra thông suốt đầu dưới',
            gist_net: 'U mô đệm (GIST) / Thần kinh nội tiết (NET)',
            presacral_retroperitoneal_pelvic: 'U trước xương cùng / Sau phúc mạc vùng chậu',
            suspected_malignancy_biopsy_negative: 'U nghi ác tính nhưng sinh thiết chưa ra tế bào K',
            large_villous_polyp: 'Polyp u tuyến lớn nguy cơ hóa ác',
            positive_specific: 'Đã có giải phẫu bệnh / hóa mô miễn dịch xác định',
            negative_inconclusive_with_reason: 'Sinh thiết âm tính / Không sinh thiết trước mổ',
            localized_resectable: 'Khu trú — cắt trọn được R0',
            adjacent_organ_involvement: 'Xâm lấn tạng lân cận — phối hợp đa tạng'
        };
        const trCtx = v => ctxEnumMap[v] || v || '—';
        const ctxLines = [];
        const ctx = chips.contextChips || {};
        if (pgVal === 'cancer_confirmed') {
            const b3 = ctx.cancerContext || {};
            const stg = b3.clinicalStage || {};
            ctxLines.push(`Vị trí u: ${(b3.tumorLocation || []).map(trCtx).join(', ') || '—'}`);
            ctxLines.push(`GPB & Giai đoạn: ${trCtx(b3.preopHistology)} · ${[stg.cT, stg.cN, stg.cM].filter(Boolean).join('') || '—'}`);
            if (b3.crmStatus && b3.crmStatus !== 'not_applicable') {
                ctxLines.push(`CRM trên MRI chậu: ${b3.crmStatus === 'crm_clear' ? 'CRM âm tính (>1mm)' : (b3.crmStatus === 'crm_threatened_or_positive' ? '⚠️ CRM đe dọa / dương tính' : `⚠️ Chưa MRI (${b3.crmNote || ''})`)}`);
            }
            ctxLines.push(`Đa mô thức & MDT: ${trCtx(b3.multimodalStatus)} · ${trCtx(b3.mdtReviewStatus)}`);
        } else if (pgVal === 'benign_anorectal') {
            const b1 = ctx.fistulaContext || {};
            ctxLines.push(`Phân loại HM: ${trCtx(b1.fistulaClassification)}${b1.fistulaImaging ? ` · Hình ảnh: ${trCtx(b1.fistulaImaging)}` : ''}`);
        } else if (pgVal === 'benign_colorectal_abdominal') {
            const b2 = ctx.benignAbdominalContext || {};
            ctxLines.push(`Phân nhóm: ${trCtx(b2.subType)} · Chuẩn bị ruột: ${trCtx(b2.bowelPrepPlan)}`);
        } else if (pgVal === 'neoplasm_suspected_or_special') {
            const b4 = ctx.specialNeoplasmContext || {};
            ctxLines.push(`U đặc thù: ${trCtx(b4.neoplasmCategory)} · Sinh thiết: ${trCtx(b4.biopsyStatus)} · Lan rộng: ${trCtx(b4.extentEvaluation)}`);
        }

        const prepStaff = Utils.getStaffName(s.podAssignment?.preparedByStaffId || s.assistSurgeon1) || 'Chưa ghi nhận';
        const subByStaff = Utils.getStaffName(app.submittedSnapshot?.submittedByStaffId || s.mainSurgeon) || 'Chưa trình';
        const preappBy = app.preapprovedSnapshot?.preapprovedByStaffId ? Utils.getStaffName(app.preapprovedSnapshot.preapprovedByStaffId) : '';
        const needDeputyEmergencyBackup = st === 'emergency_exception_pending_ack' && actor.staffId === SAP_DEPUTY_ID && !this._hasActiveDelegationForDeputy();

        return `
        <section class="sap-exec-card" aria-label="Tóm tắt 1 trang dành cho Ban Chủ nhiệm phê duyệt">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding-bottom:8px;border-bottom:1px solid var(--border-subtle);">
                <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;">
                    <h3 class="sap-section-title">${this._ico('⚡')} Tóm tắt 1 trang duyệt mổ BCN</h3>
                    ${riskFlags.length === 0
                        ? `<span class="sap-risk-pill sap-risk-pill--standard">${this._ico('✓')} <span>Hồ sơ chuẩn — Sẵn sàng duyệt nhanh</span></span>`
                        : riskFlags.map(f => `<span class="sap-risk-pill sap-risk-pill--${f.severity}">${this._ico(f.icon)} <span>${Utils.escapeHtml(f.label)}</span></span>`).join('')}
                </div>
                <button type="button" class="sap-btn" onclick="SurgeryApprovalPage.setBcnViewMode(${s.id}, 'steps')">
                    ${this._ico('📝')} <span>Mở chi tiết 3 bước</span>
                </button>
            </div>

            ${showDiff ? `
            <div class="sap-reapproval-diff" id="sap-reapproval-diff-box" role="region" aria-label="So sánh thay đổi so với bản đã duyệt trước đó">
                <div>
                    <strong>${this._ico('🔄')} So sánh với bản đã duyệt trước đó (bản duyệt ngày ${Utils.escapeHtml((app.lastApprovedSnapshot?.approvedAt || '').replace('T', ' ').slice(0, 16) || 'trước đó')} bởi ${Utils.escapeHtml(Utils.getStaffName(app.lastApprovedSnapshot?.approvedByStaffId) || 'BCN')}):</strong>
                </div>
                ${diffRows.length > 0 ? diffRows.map(r => `
                <div class="sap-diff-row">
                    <strong>${Utils.escapeHtml(r.field)}:</strong>
                    <span class="sap-diff-old">${Utils.escapeHtml(r.oldVal)}</span>
                    <span aria-hidden="true">→</span>
                    <span class="sap-diff-new">${Utils.escapeHtml(r.newVal)}</span>
                </div>`).join('') : `
                <div class="sap-diff-row">
                    <strong>Lý do kích hoạt duyệt lại:</strong>
                    <span class="sap-diff-new">${Utils.escapeHtml(this._humanizeInvalidationReason(app.invalidationReason))}</span>
                </div>`}
            </div>` : ''}

            ${app.emergencyException ? `
            <div class="sap-alert sap-alert--danger">
                <strong>${this._ico('⚡')} Hồ sơ Ngoại lệ Cấp cứu:</strong> ${Utils.escapeHtml(app.emergencyException.emergencyReasonNote || '')}
                <div style="margin-top:4px;font-size:13px;">
                    Đã hội chẩn với: <strong>${Utils.escapeHtml(Utils.getStaffName(app.emergencyException.verbalConsultRecord?.contactedLeaderStaffId) || 'BCN')}</strong>
                    (${Utils.escapeHtml(app.emergencyException.verbalConsultRecord?.contactChannel || '')} lúc ${Utils.escapeHtml(app.emergencyException.verbalConsultRecord?.contactedAt || '')})
                    · BS hoàn tất sau mổ: <strong>${Utils.escapeHtml(Utils.getStaffName(app.emergencyException.postOpFollowUpOwnerStaffId) || '')}</strong>
                </div>
            </div>` : ''}

            <div class="sap-exec-grid">
                <div class="sap-exec-box">
                    <div class="sap-exec-box-title">1. Phân loại & Tuân thủ Cột 2026</div>
                    <div><strong>Tính chất:</strong> ${Utils.escapeHtml(urgLabel)}</div>
                    <div><strong>Nhóm bệnh:</strong> ${Utils.escapeHtml(pgLabel)}</div>
                    <div><strong>Kỹ thuật:</strong> [${Utils.escapeHtml(pcObj.confirmedClass || pcObj.suggestedClass || '—')}] ${Utils.escapeHtml(procName)}</div>
                    <div><strong>Xếp cột BS chính:</strong> Cột ${Utils.escapeHtml(colObj.surgeonBaseColumn2026 || '—')} — <strong>${colObj.systemCheck === 'over_column' ? `⚠️ Vượt cột (${Utils.escapeHtml(colObj.overColumnRef || 'cần BCN xem xét')})` : '✓ Đúng cột'}</strong></div>
                </div>

                <div class="sap-exec-box">
                    <div class="sap-exec-box-title">2. Bệnh nền, Kháng đông & Vật tư</div>
                    <div><strong>Bệnh nền:</strong> ${Utils.escapeHtml((chips.comorbidities?.values || []).map(v => SAP_COMORBIDITIES.find(c => c.value === v)?.label || v).join(', ') || 'Chưa xác nhận')}</div>
                    <div><strong>Chống huyết khối:</strong> ${Utils.escapeHtml(this._formatAntithromboticSummary(chips.antithromboticPlan))}</div>
                    <div><strong>Máu & thiết bị:</strong> ${Utils.escapeHtml((chips.bloodAndDevices?.values || []).map(v => SAP_BLOOD_DEVICES.find(b => b.value === v)?.label || v).join(', ') || 'Chưa xác nhận')}</div>
                    <div><strong>Kế hoạch HMNT:</strong> ${Utils.escapeHtml(SAP_STOMA_PLANS.find(p => p.value === chips.stomaPlan?.value)?.label || 'Chưa xác nhận')}</div>
                </div>

                <div class="sap-exec-box">
                    <div class="sap-exec-box-title">3. Chuyên khoa & Mục Bất thường</div>
                    ${ctxLines.map(ln => `<div>${Utils.escapeHtml(ln)}</div>`).join('')}
                    ${abnItems.length > 0 ? abnItems.map(a => `
                    <div style="margin-top:4px;padding:6px 8px;border-radius:6px;background:var(--surface-1);border-left:3px solid #DC9536;">
                        <strong>⚠️ ${Utils.escapeHtml(a.title)}:</strong> ${Utils.escapeHtml(a.note)}
                    </div>`).join('') : `<div><strong>Bảng kiểm tiền phẫu:</strong> ✓ Không có mục bất thường ngoài chuẩn</div>`}
                </div>

                <div class="sap-exec-box">
                    <div class="sap-exec-box-title">4. Trách nhiệm Chuẩn bị & Xác nhận</div>
                    <div><strong>HV chuẩn bị:</strong> ${Utils.escapeHtml(prepStaff)}</div>
                    <div><strong>BS chính xác nhận/trình:</strong> ${Utils.escapeHtml(subByStaff)}</div>
                    <div><strong>Phim gốc & Cam kết PT:</strong> ${SAP_ATTENDING_IDS.has(Number(ck['CK-04']?.verifiedByStaffId)) && SAP_ATTENDING_IDS.has(Number(ck['CK-08']?.verifiedByStaffId)) ? '✓ BS chính đã xác nhận đủ' : '⚠️ Chưa xác nhận đủ'}</div>
                    ${preappBy ? `<div><strong>Tiền duyệt:</strong> ✓ ${Utils.escapeHtml(preappBy)} ${app.preapprovedSnapshot?.note ? `(${Utils.escapeHtml(app.preapprovedSnapshot.note)})` : ''}</div>` : ''}
                    ${app.lateReason ? `<div><strong>Lý do trình trễ:</strong> ${Utils.escapeHtml(app.lateReason)}</div>` : ''}
                </div>
            </div>

            ${needDeputyEmergencyBackup ? `
            <div class="sap-exec-box" style="border-color:#EB4848;">
                <label for="sap-em-backup-reason" style="font-weight:700;color:var(--text-heading);">Lý do Phó Trưởng khoa xác nhận dự phòng ngoại lệ cấp cứu (khi chưa có ủy quyền thường quy):</label>
                <input id="sap-em-backup-reason" type="text" class="sap-input" placeholder="Ví dụ: Cấp cứu tối khẩn chưa liên lạc được Trưởng khoa, xác nhận không chậm xử trí lâm sàng...">
            </div>` : ''}

            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <input id="sap-bcn-note" type="text" class="sap-input" style="flex:1 1 260px;"
                    aria-label="Ghi chú phê duyệt của Ban Chủ nhiệm (tùy chọn)"
                    placeholder="Ghi chú ngắn của BCN khi Tiền duyệt / Phê duyệt (tùy chọn)...">
            </div>
        </section>`;
    },

    _humanizeInvalidationReason(reason) {
        const raw = String(reason || '').trim();
        if (!raw) return 'Cập nhật thông tin chuyên môn sau khi ca đã được phê duyệt';
        const map = {
            date: 'Ngày mổ dự kiến',
            method: 'Phương pháp phẫu thuật',
            diagnosis: 'Chẩn đoán trước mổ',
            mainSurgeon: 'Bác sĩ mổ chính',
            approachType: 'Đường tiếp cận phẫu thuật (Mổ mở / Nội soi / Robot)',
            surgeryType: 'Phân loại mổ chương trình / cấp cứu',
            clinical_tier_a_modified_in_draft: 'Điều chỉnh phân loại lâm sàng, thuốc chống huyết khối hoặc bảng kiểm tiền phẫu'
        };
        if (raw.startsWith('schedule_core_fields_changed:')) {
            const fields = raw.split(':')[1].split(',').map(k => map[k.trim()] || k.trim()).join(', ');
            return `Đã thay đổi trên Lịch mổ: ${fields}`;
        }
        return map[raw] || raw;
    },

    _computeReapprovalDiffRows(s) {
        const rows = [];
        const prev = this._getCachedApprovedSnapshot(s.id);
        if (prev) {
            const curAnti = this._formatAntithromboticSummary(s.clinicalChips?.antithromboticPlan);
            const curPg = s.clinicalClassification?.pathologyGroup?.confirmedValue || '';
            const curCat = s.clinicalClassification?.procedureClass?.confirmedCatalogEntryId || '';
            const curUrg = s.clinicalClassification?.urgencyLevel || 'elective';
            const curStoma = s.clinicalChips?.stomaPlan?.value || '';

            if ((prev.date || '') !== (s.date || '')) {
                rows.push({ field: 'Ngày mổ', oldVal: prev.date || '—', newVal: s.date || '—' });
            }
            if (Number(prev.mainSurgeon || 0) !== Number(s.mainSurgeon || 0)) {
                rows.push({
                    field: 'Bác sĩ mổ chính',
                    oldVal: Utils.getStaffName(prev.mainSurgeon) || '—',
                    newVal: Utils.getStaffName(s.mainSurgeon) || '—'
                });
            }
            if ((prev.method || '') !== (s.method || '')) {
                rows.push({ field: 'Phương pháp mổ', oldVal: prev.method || '—', newVal: s.method || '—' });
            }
            if ((prev.diagnosis || '') !== (s.diagnosis || '')) {
                rows.push({ field: 'Chẩn đoán', oldVal: prev.diagnosis || '—', newVal: s.diagnosis || '—' });
            }
            if (prev.urgencyLevel && prev.urgencyLevel !== curUrg) {
                rows.push({
                    field: 'Tính khẩn',
                    oldVal: SAP_URGENCY_OPTIONS.find(u => u.value === prev.urgencyLevel)?.shortLabel || prev.urgencyLevel,
                    newVal: SAP_URGENCY_OPTIONS.find(u => u.value === curUrg)?.shortLabel || curUrg
                });
            }
            if (prev.pathologyGroup && prev.pathologyGroup !== curPg) {
                rows.push({
                    field: 'Nhóm bệnh lý',
                    oldVal: SAP_PATHOLOGY_GROUPS.find(g => g.value === prev.pathologyGroup)?.shortLabel || prev.pathologyGroup,
                    newVal: SAP_PATHOLOGY_GROUPS.find(g => g.value === curPg)?.shortLabel || curPg
                });
            }
            if (prev.catalogEntryId && prev.catalogEntryId !== curCat) {
                const procs = this._catalogData?.procedures || [];
                rows.push({
                    field: 'Kỹ thuật Danh mục 309',
                    oldVal: procs.find(p => p.id === prev.catalogEntryId)?.name || prev.catalogEntryId,
                    newVal: procs.find(p => p.id === curCat)?.name || curCat
                });
            }
            if (prev.antithromboticSummary && prev.antithromboticSummary !== curAnti) {
                rows.push({ field: 'Chống huyết khối', oldVal: prev.antithromboticSummary, newVal: curAnti });
            }
            if (prev.stomaPlan && prev.stomaPlan !== curStoma) {
                rows.push({
                    field: 'Kế hoạch HMNT',
                    oldVal: SAP_STOMA_PLANS.find(p => p.value === prev.stomaPlan)?.label || prev.stomaPlan,
                    newVal: SAP_STOMA_PLANS.find(p => p.value === curStoma)?.label || curStoma
                });
            }
        }
        if (rows.length === 0 && s.approval?.invalidationReason) {
            rows.push({
                field: 'Nội dung cập nhật sau duyệt',
                oldVal: `Bản đã duyệt trước đó`,
                newVal: this._humanizeInvalidationReason(s.approval.invalidationReason)
            });
        }
        return rows;
    },

    // ── Action Sub-Drawers (Return, Emergency Exception, Hold, Release Hold, Revoke, Submit Extra) ──
    toggleActionDrawer(sid, kind) {
        this._moreActionsOpen = false;
        this._activeActionDrawer = this._activeActionDrawer === kind ? null : kind;
        this._refreshOpenModal(sid);
    },

    toggleMoreActionsMenu(sid) {
        this._moreActionsOpen = !this._moreActionsOpen;
        this._refreshOpenModal(sid);
    },

    toggleReturnChip(sid, chipText) {
        const idx = this._returnChipDraft.indexOf(chipText);
        if (idx >= 0) this._returnChipDraft.splice(idx, 1);
        else this._returnChipDraft.push(chipText);
        this._refreshOpenModal(sid);
    },

    _renderActionSubDrawer(s, actor) {
        const kind = this._activeActionDrawer;
        if (kind === 'return') {
            return `
            <div class="sap-section" style="border:2px solid #AC011A;" id="sap-subdrawer-return">
                <div class="sap-section-header">
                    <h4 class="sap-section-title">${this._ico('↩️')} Yêu cầu bổ sung hồ sơ (Trả về cho BS mổ chính & HV)</h4>
                    <button type="button" class="sap-btn sap-btn--ghost" onclick="SurgeryApprovalPage.toggleActionDrawer(${s.id}, null)">Đóng</button>
                </div>
                <div class="sap-filter-sub-label">Chọn nhanh các điểm cần bổ sung (sẽ tự động tô đỏ trường tương ứng khi BS chính mở lại):</div>
                <div class="sap-chip-group">
                    ${SAP_RETURN_FEEDBACK_CHIPS.map(ch => `
                    <button type="button" class="sap-chip ${this._returnChipDraft.includes(ch) ? 'sap-chip--selected' : ''}"
                        onclick="SurgeryApprovalPage.toggleReturnChip(${s.id}, '${Utils.escapeHtml(ch)}')">${Utils.escapeHtml(ch)}</button>`).join('')}
                </div>
                <input id="sap-return-note" type="text" class="sap-input" placeholder="Ghi chú hướng dẫn cụ thể của BCN (bắt buộc nếu chọn 'Khác')...">
                <div style="display:flex;justify-content:flex-end;gap:8px;">
                    <button type="button" class="sap-btn sap-btn--danger" onclick="SurgeryApprovalPage.submitBcnReturn(${s.id})">
                        ${this._ico('↩️')} <span>Xác nhận trả về bổ sung</span>
                    </button>
                </div>
            </div>`;
        }

        if (kind === 'emergency') {
            const nowStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace('T', ' ');
            const ownerCur = this._emOwnerDraft || Number(s.mainSurgeon || actor.staffId || 4);
            return `
            <div class="sap-section" style="border:2px solid #AC011A;" id="sap-subdrawer-emergency">
                <div class="sap-section-header">
                    <h4 class="sap-section-title">${this._ico('⚡')} Kích hoạt Cổng Ngoại lệ Cấp cứu (Không làm chậm xử trí lâm sàng)</h4>
                    <button type="button" class="sap-btn sap-btn--ghost" onclick="SurgeryApprovalPage.toggleActionDrawer(${s.id}, null)">Đóng</button>
                </div>
                <input id="sap-em-reason" type="text" class="sap-input" placeholder="Chỉ định mổ cấp cứu / đe dọa tính mạng (tối thiểu 10 ký tự)...">
                <div class="sap-filter-sub-label">Lãnh đạo BCN đã báo cáo trực tiếp / điện thoại:</div>
                <div class="sap-chip-group">
                    <button type="button" class="sap-chip ${this._emLeaderDraft === 1 ? 'sap-chip--selected' : ''}" onclick="SurgeryApprovalPage._emLeaderDraft=1;SurgeryApprovalPage._refreshOpenModal(${s.id});">TS. BSCKII. Nguyễn Phú Hữu (Trưởng khoa)</button>
                    <button type="button" class="sap-chip ${this._emLeaderDraft === 2 ? 'sap-chip--selected' : ''}" onclick="SurgeryApprovalPage._emLeaderDraft=2;SurgeryApprovalPage._refreshOpenModal(${s.id});">BSCKII. Vũ Khương An (Phó Trưởng khoa)</button>
                </div>
                <div class="sap-filter-sub-label">Kênh báo cáo hội chẩn:</div>
                <div class="sap-chip-group">
                    ${[
                        { v: 'phone', l: 'Điện thoại trực tiếp' },
                        { v: 'in_person', l: 'Báo cáo trực tiếp tại viện' },
                        { v: 'zalo_duty', l: 'Tin nhắn trực BCN' }
                    ].map(c => `<button type="button" class="sap-chip ${this._emChannelDraft === c.v ? 'sap-chip--selected' : ''}" onclick="SurgeryApprovalPage._emChannelDraft='${c.v}';SurgeryApprovalPage._refreshOpenModal(${s.id});">${c.l}</button>`).join('')}
                </div>
                <input id="sap-em-time" type="text" class="sap-input" value="${nowStr}" aria-label="Thời điểm hội chẩn cấp cứu">
                <div class="sap-filter-sub-label">BS chính chịu trách nhiệm hoàn tất hồ sơ sau mổ:</div>
                <div class="sap-chip-group">
                    ${Array.from(SAP_ATTENDING_IDS).map(aid => `<button type="button" class="sap-chip ${ownerCur === aid ? 'sap-chip--selected' : ''}" onclick="SurgeryApprovalPage._emOwnerDraft=${aid};SurgeryApprovalPage._refreshOpenModal(${s.id});">${Utils.escapeHtml(Utils.getStaffName(aid) || `#${aid}`)}</button>`).join('')}
                </div>
                <div style="display:flex;justify-content:flex-end;">
                    <button type="button" class="sap-btn sap-btn--danger" onclick="SurgeryApprovalPage.submitEmergencyException(${s.id})">
                        ${this._ico('⚡')} <span>Ghi nhận Ngoại lệ Cấp cứu</span>
                    </button>
                </div>
            </div>`;
        }

        if (kind === 'hold') {
            return `
            <div class="sap-section" style="border:2px solid #7E4F00;" id="sap-subdrawer-hold">
                <div class="sap-section-header">
                    <h4 class="sap-section-title">${this._ico('⏸️')} Đặt Tạm hoãn tại khoa sau khi duyệt</h4>
                    <button type="button" class="sap-btn sap-btn--ghost" onclick="SurgeryApprovalPage.toggleActionDrawer(${s.id}, null)">Đóng</button>
                </div>
                <div class="sap-chip-group">
                    ${SAP_HOLD_CATEGORIES.map(c => `<button type="button" class="sap-chip ${this._holdCatDraft === c.value ? 'sap-chip--selected' : ''}"
                        onclick="SurgeryApprovalPage._holdCatDraft='${c.value}';SurgeryApprovalPage._refreshOpenModal(${s.id});">${Utils.escapeHtml(c.label)}</button>`).join('')}
                </div>
                <input id="sap-hold-reason" type="text" class="sap-input" placeholder="Nhập lý do tạm hoãn cụ thể (tối thiểu 10 ký tự)...">
                <div style="display:flex;justify-content:flex-end;">
                    <button type="button" class="sap-btn sap-btn--warning" onclick="SurgeryApprovalPage.submitHoldPostApproval(${s.id})">
                        ${this._ico('⏸️')} <span>Xác nhận Tạm hoãn</span>
                    </button>
                </div>
            </div>`;
        }

        if (kind === 'release_hold') {
            return `
            <div class="sap-section" style="border:2px solid #316A20;" id="sap-subdrawer-release">
                <div class="sap-section-header">
                    <h4 class="sap-section-title">${this._ico('▶️')} Gỡ Tạm hoãn & Khôi phục duyệt tại khoa</h4>
                    <button type="button" class="sap-btn sap-btn--ghost" onclick="SurgeryApprovalPage.toggleActionDrawer(${s.id}, null)">Đóng</button>
                </div>
                <input id="sap-release-note" type="text" class="sap-input" placeholder="Ghi chú xác nhận đủ điều kiện an toàn mở lại ca mổ (tối thiểu 5 ký tự)...">
                <div style="display:flex;justify-content:flex-end;">
                    <button type="button" class="sap-btn sap-btn--success" onclick="SurgeryApprovalPage.submitReleaseHold(${s.id})">
                        ${this._ico('✅')} <span>Xác nhận Gỡ tạm hoãn</span>
                    </button>
                </div>
            </div>`;
        }

        if (kind === 'revoke') {
            return `
            <div class="sap-section" style="border:2px solid #AC011A;" id="sap-subdrawer-revoke">
                <div class="sap-section-header">
                    <h4 class="sap-section-title">${this._ico('🚫')} Thu hồi phê duyệt tại khoa</h4>
                    <button type="button" class="sap-btn sap-btn--ghost" onclick="SurgeryApprovalPage.toggleActionDrawer(${s.id}, null)">Đóng</button>
                </div>
                <input id="sap-revoke-reason" type="text" class="sap-input" placeholder="Nhập lý do thu hồi phê duyệt (tối thiểu 5 ký tự)...">
                <div style="display:flex;justify-content:flex-end;">
                    <button type="button" class="sap-btn sap-btn--danger" onclick="SurgeryApprovalPage.submitRevokeApproval(${s.id})">
                        ${this._ico('🚫')} <span>Xác nhận Thu hồi duyệt</span>
                    </button>
                </div>
            </div>`;
        }

        if (kind === 'submit_extra') {
            const sla = this._computeSlaDisplay(s, this.getConfig());
            const urg = s.clinicalClassification?.urgencyLevel || 'elective';
            const needLate = sla.isOverdue && ['elective', 'elective_service'].includes(urg);
            const needActing = !SAP_BCN_IDS.has(actor.staffId) && Number(actor.staffId) !== Number(s.mainSurgeon) && Number(actor.staffId) !== Number(s.coordinatingAttendingStaffId);
            return `
            <div class="sap-section" style="border:2px solid #1D2357;" id="sap-subdrawer-submit-extra">
                <div class="sap-section-header">
                    <h4 class="sap-section-title">${this._ico('🚀')} Bổ sung thông tin trước khi Trình duyệt</h4>
                    <button type="button" class="sap-btn sap-btn--ghost" onclick="SurgeryApprovalPage.toggleActionDrawer(${s.id}, null)">Đóng</button>
                </div>
                ${needLate ? `<input id="sap-late-reason" type="text" class="sap-input" value="${Utils.escapeHtml(s.approval?.lateReason || '')}" placeholder="Ca trình sau mốc hạn quy định — nhập lý do trình trễ hạn (≥ 5 ký tự)...">` : ''}
                ${needActing ? `<input id="sap-acting-reason" type="text" class="sap-input" placeholder="BS chính cùng POD trình thay BS mổ chính — nhập lý do trình thay (≥ 10 ký tự)...">` : ''}
                <div style="display:flex;justify-content:flex-end;">
                    <button type="button" class="sap-btn sap-btn--primary" onclick="SurgeryApprovalPage.submitRoutineForApproval(${s.id}, true)">
                        ${this._ico('🚀')} <span>Hoàn tất Trình duyệt mổ</span>
                    </button>
                </div>
            </div>`;
        }
        return '';
    },

    // ── BƯỚC 2.9 & 3.4: Sticky Safe-Area Bottom Action Bar (1 Primary + 1 Secondary + "⋯" Overflow Menu) ──
    _renderStickyFooterHtml(s, cfg, actor, missing) {
        const st = s.approval?.status || 'draft_unsubmitted';
        const isTrainee = SAP_TRAINEE_IDS.has(actor.staffId);
        const isAttending = SAP_ATTENDING_IDS.has(actor.staffId);
        const isBcn = SAP_BCN_IDS.has(actor.staffId);
        const isChief = actor.staffId === SAP_CHIEF_ID;
        const isDeputy = actor.staffId === SAP_DEPUTY_ID;
        const hasDel = this._hasActiveDelegationForDeputy();

        // Overflow menu items ("⋯")
        const moreItems = [];
        if ((isAttending || isBcn) && !['approved', 'approved_with_exception'].includes(st)) {
            moreItems.push({ label: '⚡ Ngoại lệ cấp cứu', fn: `SurgeryApprovalPage.toggleActionDrawer(${s.id}, 'emergency')` });
        }
        if (isTrainee && ['draft_unsubmitted', 'returned_for_revision', 'resubmit_required'].includes(st)) {
            moreItems.push({ label: '🩺 Báo BS chính xác nhận', fn: `SurgeryApprovalPage.requestAttendingVerify(${s.id})` });
        }
        if ((isAttending || isBcn) && ['approved', 'approved_with_exception'].includes(st)) {
            moreItems.push({ label: '⏸️ Tạm hoãn tại khoa', fn: `SurgeryApprovalPage.toggleActionDrawer(${s.id}, 'hold')` });
        }
        if ((isChief || (isDeputy && hasDel)) && ['approved', 'approved_with_exception', 'post_approval_hold', 'preapproved'].includes(st)) {
            moreItems.push({ label: '🚫 Thu hồi duyệt khoa', fn: `SurgeryApprovalPage.toggleActionDrawer(${s.id}, 'revoke')` });
        }
        if (isBcn && this._bcnViewMode === 'summary') {
            moreItems.push({ label: '📝 Chỉnh sửa chi tiết 3 bước', fn: `SurgeryApprovalPage.setBcnViewMode(${s.id}, 'steps')` });
        }

        // Context-aware Primary & Secondary buttons
        let secondaryBtnHtml = `<button type="button" class="sap-btn" onclick="Modal.close()">Đóng</button>`;
        let primaryBtnHtml = '';

        const bcnReviewing = isBcn && this._bcnViewMode === 'summary' && ['submitted', 'preapproved', 'emergency_exception_pending_ack', 'reapproval_required', 'post_approval_hold'].includes(st);
        const nextCaseId = isBcn ? this._getNextPendingBcnCaseId(s.id, actor, cfg) : null;

        if (bcnReviewing) {
            if (st === 'post_approval_hold' && (isChief || (isDeputy && hasDel))) {
                primaryBtnHtml = `
                <button type="button" class="sap-btn sap-btn--success" id="sap-btn-primary-action" onclick="SurgeryApprovalPage.toggleActionDrawer(${s.id}, 'release_hold')">
                    ${this._ico('▶️')} <span>Gỡ Tạm hoãn</span>
                </button>`;
            } else {
                if (['submitted', 'preapproved', 'emergency_exception_pending_ack'].includes(st)) {
                    secondaryBtnHtml = `
                    <button type="button" class="sap-btn sap-btn--warning" id="sap-btn-bcn-return" onclick="SurgeryApprovalPage.toggleActionDrawer(${s.id}, 'return')">
                        ${this._ico('↩️')} <span>Trả về ▾</span>
                    </button>`;
                }
                const canFinalApprove = isChief || (isDeputy && (hasDel || st === 'emergency_exception_pending_ack'));
                const actionLabel = st === 'emergency_exception_pending_ack'
                    ? 'Xác nhận Ngoại lệ'
                    : (canFinalApprove ? (st === 'reapproval_required' ? 'Duyệt lại' : 'Duyệt') : 'Tiền duyệt');
                primaryBtnHtml = `
                <button type="button" class="sap-btn sap-btn--success" id="sap-btn-primary-action"
                    onclick="SurgeryApprovalPage.handleBcnPrimaryDecision(${s.id}, false)">
                    ${this._ico(canFinalApprove ? '✅' : '☑️')} <span>${actionLabel}</span>
                </button>
                ${nextCaseId ? `
                <button type="button" class="sap-btn sap-btn--primary" id="sap-btn-approve-next"
                    onclick="SurgeryApprovalPage.handleBcnPrimaryDecision(${s.id}, true)">
                    ${this._ico('⏭️')} <span>${actionLabel} & mở ca kế tiếp</span>
                </button>` : ''}`;
            }
        } else if (isTrainee) {
            if (missing.length > 0) {
                primaryBtnHtml = `
                <button type="button" class="sap-btn sap-btn--incomplete" id="sap-btn-primary-action"
                    onclick="SurgeryApprovalPage.jumpToFirstMissing(${s.id})">
                    ${this._ico('🩺')} <span>Gửi BS chính (còn ${missing.length} mục)</span>
                </button>`;
            } else {
                primaryBtnHtml = `
                <button type="button" class="sap-btn sap-btn--primary" id="sap-btn-primary-action"
                    onclick="SurgeryApprovalPage.requestAttendingVerify(${s.id})">
                    ${this._ico('🩺')} <span>Gửi BS chính xác nhận</span>
                </button>`;
            }
        } else if ((isAttending || isBcn) && !['approved', 'approved_with_exception', 'post_approval_hold'].includes(st)) {
            if (missing.length > 0) {
                primaryBtnHtml = `
                <button type="button" class="sap-btn sap-btn--incomplete" id="sap-btn-primary-action"
                    onclick="SurgeryApprovalPage.jumpToFirstMissing(${s.id})">
                    ${this._ico('🚀')} <span>Trình duyệt (còn ${missing.length} mục)</span>
                </button>`;
            } else {
                primaryBtnHtml = `
                <button type="button" class="sap-btn sap-btn--primary" id="sap-btn-primary-action"
                    onclick="SurgeryApprovalPage.submitRoutineForApproval(${s.id}, false)">
                    ${this._ico('🚀')} <span>Trình duyệt</span>
                </button>`;
            }
        } else if ((isAttending || isBcn) && st === 'approved') {
            primaryBtnHtml = `
            <button type="button" class="sap-btn sap-btn--warning" id="sap-btn-primary-action"
                onclick="SurgeryApprovalPage.toggleActionDrawer(${s.id}, 'hold')">
                ${this._ico('⏸️')} <span>Tạm hoãn tại khoa</span>
            </button>`;
        }

        return `
        <footer class="sap-sticky-footer">
            <div class="sap-footer-left">
                ${moreItems.length > 0 ? `
                <div class="sap-more-wrap">
                    <button type="button" class="sap-btn" id="sap-btn-more-menu" aria-label="Thao tác khác" aria-expanded="${this._moreActionsOpen}"
                        onclick="SurgeryApprovalPage.toggleMoreActionsMenu(${s.id})">
                        <span aria-hidden="true">⋯</span> <span>Khác</span>
                    </button>
                    ${this._moreActionsOpen ? `
                    <div class="sap-more-menu" role="menu">
                        ${moreItems.map(mi => {
                            const p = this._splitLeadingEmoji(mi.label);
                            return `<button type="button" role="menuitem" class="sap-btn sap-btn--ghost" onclick="${mi.fn}">
                                ${p.icon ? this._ico(p.icon) : ''} <span>${Utils.escapeHtml(p.text)}</span>
                            </button>`;
                        }).join('')}
                    </div>` : ''}
                </div>` : ''}
                ${secondaryBtnHtml}
            </div>
            <div class="sap-footer-right">
                ${primaryBtnHtml}
            </div>
        </footer>`;
    },

    _getNextPendingBcnCaseId(currentSid, actor, cfg) {
        const hasDel = this._hasActiveDelegationForDeputy();
        const list = this._getEligibleSurgeries(cfg).filter(s => {
            if (!s || Number(s.id) === Number(currentSid) || s.approachType === 'nsth') return false;
            const st = s.approval?.status || '';
            if (actor.staffId === SAP_CHIEF_ID) {
                return ['submitted', 'preapproved', 'reapproval_required', 'emergency_exception_pending_ack'].includes(st);
            }
            if (actor.staffId === SAP_DEPUTY_ID) {
                if (st === 'submitted' || st === 'emergency_exception_pending_ack' || st === 'reapproval_required') return true;
                if (hasDel && st === 'preapproved') return true;
            }
            return false;
        }).sort((a, b) => {
            const dCmp = (a.date || '').localeCompare(b.date || '');
            if (dCmp !== 0) return dCmp;
            const rA = this._computeCaseRiskFlags(a, cfg).length;
            const rB = this._computeCaseRiskFlags(b, cfg).length;
            if ((rB > 0) !== (rA > 0)) return rB - rA;
            return Number(a.id) - Number(b.id);
        });
        return list.length > 0 ? list[0].id : null;
    },

    jumpToFirstMissing(sid) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const actor = this.getEffectiveActor(s);
        const missing = this._computeMissingRequirements(s, actor);
        if (missing.length === 0) return;
        this._lastGateErrors = missing.slice(0, 6);
        this.jumpToStep(sid, missing[0].step, missing[0].fieldId);
    },

    // ── Draft & Checklist Mutation Actions (100% Backend-Compatible, Zero Server Changes) ──
    async patchDraft(sid, draftPayload, silentToast = true) {
        const s = this._getCaseById(sid);
        if (!s) return null;
        try {
            const res = await this._api(`/api/surgery-approval/${sid}/draft`, 'POST', {
                expectedCaseRevision: s.caseRevision,
                ...draftPayload
            }, { allowSimulation: true });
            if (res && res.surgery) {
                this._lastGateErrors = null;
                this._syncSurgeryInStore(res.surgery);
                if (App.currentPage === 'surgery-approval') App.renderCurrentPage();
                this._refreshOpenModal(sid);
            }
            if (!silentToast) Toast.success('Đã lưu cập nhật hồ sơ');
            return res?.surgery || null;
        } catch (err) {
            this._handleMutationError(sid, err);
            return null;
        }
    },

    async patchChipWithSync(sid, chipPatch) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const actor = this.getEffectiveActor(s);
        const mergedChips = Object.assign({}, s.clinicalChips || {}, chipPatch);
        const ckPatch = this._buildSyncedStep2ChecklistPatch(s, actor, mergedChips);
        const payload = { clinicalChips: chipPatch };
        if (ckPatch) payload.preopChecklist = ckPatch;
        await this.patchDraft(sid, payload);
    },

    async selectPathologyGroup(sid, groupValue) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const curConf = s.clinicalClassification?.pathologyGroup?.confirmedValue;
        const hasCtx = Boolean(s.clinicalChips?.contextChips && Object.keys(s.clinicalChips.contextChips).length > 0);
        let groupChangeReason = '';
        if (curConf && curConf !== 'unknown' && curConf !== groupValue && hasCtx) {
            groupChangeReason = 'Điều chỉnh nhóm bệnh lý phù hợp chẩn đoán lâm sàng hiện tại';
        }
        const actor = this.getEffectiveActor(s);
        const payload = {
            clinicalClassification: {
                pathologyGroup: {
                    confirmedValue: groupValue,
                    ...(groupChangeReason ? { groupChangeReason } : {})
                }
            }
        };
        if (['benign_anorectal', 'benign_colorectal_abdominal'].includes(groupValue) && !SAP_TRAINEE_IDS.has(actor.staffId)) {
            payload.preopChecklist = { 'CK-05': { state: 'not_applicable' } };
        }
        await this.patchDraft(sid, payload);
    },

    onCatalogSearchInput(sid, query) {
        this._catalogQuery = query;
        const s = this._getCaseById(sid);
        const box = document.getElementById('sap-catalog-results-box');
        if (!s || !box) return;
        const pcObj = s.clinicalClassification?.procedureClass || {};
        const q = (query || '').trim().toLowerCase();
        const procs = q
            ? (this._catalogData?.procedures || []).filter(p => (p.name || '').toLowerCase().includes(q) || (p.rankLabel || '').toLowerCase().includes(q)).slice(0, 20)
            : [];
        box.innerHTML = procs.length > 0 ? `
            <div class="sap-catalog-results">
                ${procs.map(p => `
                <button type="button" class="sap-catalog-option ${pcObj.confirmedCatalogEntryId === p.id ? 'is-selected' : ''}"
                    onclick="SurgeryApprovalPage.selectCatalogEntry(${s.id}, '${p.id}', '${p.rankCode}')">
                    <span>${Utils.escapeHtml(p.name)}</span>
                    <span class="sap-tag">${Utils.escapeHtml(p.rankLabel)}</span>
                </button>`).join('')}
            </div>` : '';
    },

    _defaultDeclaredColumnMode(s, rankCode) {
        const rankMap = { 'PT-ĐB': 4, 'PT-DB': 4, 'PT-I': 3, 'PT-II': 2, 'PT-III': 1 };
        const colStr = s.clinicalClassification?.columnCompliance?.surgeonBaseColumn2026 || '';
        const colRank = ({ 'ĐB': 4, 'DB': 4, 'I': 3, '1': 3, 'II': 2, '2': 2, 'III': 1, '3': 1 })[colStr] || 0;
        const pRank = rankMap[rankCode] || 0;
        if (colRank > 0 && pRank > colRank) return 'propose_over_column';
        return 'within_column';
    },

    async selectCatalogEntry(sid, entryId, rankCode) {
        const s = this._getCaseById(sid);
        if (!s) return;
        this._catalogQuery = '';
        const declaredMode = this._defaultDeclaredColumnMode(s, rankCode);
        await this.patchDraft(sid, {
            clinicalClassification: {
                procedureClass: {
                    confirmedCatalogEntryId: entryId,
                    confirmedClass: rankCode
                },
                columnCompliance: {
                    declaredMode
                }
            }
        });
    },

    // BƯỚC 2.6: Confirm all dashed-border suggestions in Step ① or Step ② in 1 single tap (never touches CK-04/08)
    async confirmStepSuggestions(sid, stepNum) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const actor = this.getEffectiveActor(s);
        const cc = s.clinicalClassification || {};
        const pgObj = cc.pathologyGroup || {};
        const pcObj = cc.procedureClass || {};
        const chips = s.clinicalChips || {};
        const pa = s.podAssignment || {};

        if (stepNum === 1) {
            const patchCc = {};
            const nextPg = (!pgObj.confirmedValue || pgObj.confirmedValue === 'unknown') ? pgObj.suggestedValue : pgObj.confirmedValue;
            if (nextPg && nextPg !== 'unknown') {
                patchCc.pathologyGroup = { confirmedValue: nextPg };
            }
            const inferredProc = !pcObj.confirmedCatalogEntryId ? this._inferSuggestedCatalogProc(s) : null;
            const nextCatId = pcObj.confirmedCatalogEntryId || inferredProc?.id || pcObj.suggestedCatalogEntryId;
            const nextRank = pcObj.confirmedClass || inferredProc?.rankCode || pcObj.suggestedClass;
            if (nextCatId && nextRank) {
                patchCc.procedureClass = { confirmedCatalogEntryId: nextCatId, confirmedClass: nextRank };
                patchCc.columnCompliance = { declaredMode: this._defaultDeclaredColumnMode(s, nextRank) };
            }
            const payload = { clinicalClassification: patchCc };
            if (!pa.wardRoom && s.wardRoom && SAP_WARD_ROOMS.includes(String(s.wardRoom))) {
                payload.podAssignment = { wardRoom: String(s.wardRoom) };
            }
            if (['benign_anorectal', 'benign_colorectal_abdominal'].includes(nextPg) && !SAP_TRAINEE_IDS.has(actor.staffId)) {
                payload.preopChecklist = { 'CK-05': { state: 'not_applicable' } };
            }
            await this.patchDraft(sid, payload, false);
            Toast.success('Đã xác nhận các gợi ý ở Bước ①');
        } else if (stepNum === 2) {
            const eff2 = this._getEffectiveStep2Suggestions(s);
            const chipPatch = {};
            if (!chips.comorbidities?.confirmed && eff2.comorbValues && eff2.comorbValues.length > 0 && !eff2.comorbValues.includes('other')) {
                chipPatch.comorbidities = { confirmed: true, values: eff2.comorbValues };
            }
            if (!chips.antithromboticPlan?.confirmed && eff2.antiMode === 'none_confirmed') {
                chipPatch.antithromboticPlan = { confirmed: true, mode: 'none_confirmed' };
            }
            if (!chips.bloodAndDevices?.confirmed && eff2.bdValues && eff2.bdValues.length > 0) {
                chipPatch.bloodAndDevices = { confirmed: true, values: eff2.bdValues };
            }
            if (!chips.stomaPlan?.confirmed && eff2.stomaValue) {
                chipPatch.stomaPlan = { confirmed: true, value: eff2.stomaValue };
            }
            await this.patchChipWithSync(sid, chipPatch);
            Toast.success('Đã xác nhận các gợi ý ở Bước ②');
        }
    },

    async toggleMultiChip(sid, groupKey, val, isExclusive) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const curObj = s.clinicalChips?.[groupKey] || { confirmed: false, values: [] };
        const exclVals = groupKey === 'comorbidities' ? ['none'] : ['basic_instruments_only'];
        let nextVals = curObj.confirmed ? [...(curObj.values || [])] : [];
        if (isExclusive) {
            nextVals = [val];
        } else {
            nextVals = nextVals.filter(x => !exclVals.includes(x));
            if (nextVals.includes(val)) {
                nextVals = nextVals.filter(x => x !== val);
            } else {
                nextVals.push(val);
            }
            if (nextVals.length === 0) {
                nextVals = exclVals[0] && !(s.approachType === 'robot' && exclVals[0] === 'basic_instruments_only') ? [exclVals[0]] : [val];
            }
        }
        await this.patchChipWithSync(sid, { [groupKey]: { confirmed: true, values: nextVals } });
    },

    async selectAntithromboticMode(sid, mode) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const prev = s.clinicalChips?.antithromboticPlan || {};
        await this.patchChipWithSync(sid, {
            antithromboticPlan: {
                ...prev,
                confirmed: true,
                mode
            }
        });
    },

    async updateAntithromboticDetail(sid, field, value) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const prev = s.clinicalChips?.antithromboticPlan || {};
        await this.patchChipWithSync(sid, {
            antithromboticPlan: {
                ...prev,
                confirmed: true,
                [field]: value
            }
        });
    },

    async updateContextField(sid, ctxKey, partialObj) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const curCtx = s.clinicalChips?.contextChips?.[ctxKey] || {};
        const nextCtx = { ...curCtx, ...partialObj };
        const mergedChips = {
            ...(s.clinicalChips || {}),
            contextChips: {
                ...(s.clinicalChips?.contextChips || {}),
                [ctxKey]: nextCtx
            }
        };
        const actor = this.getEffectiveActor(s);
        const ckPatch = this._buildSyncedStep2ChecklistPatch(s, actor, mergedChips);
        const payload = {
            clinicalChips: {
                contextChips: {
                    [ctxKey]: nextCtx
                }
            }
        };
        if (ckPatch) payload.preopChecklist = ckPatch;
        await this.patchDraft(sid, payload);
    },

    async toggleCancerLocation(sid, locVal) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const curLocs = s.clinicalChips?.contextChips?.cancerContext?.tumorLocation || [];
        const nextLocs = curLocs.includes(locVal) ? curLocs.filter(x => x !== locVal) : [...curLocs, locVal];
        await this.updateContextField(sid, 'cancerContext', { tumorLocation: nextLocs });
    },

    async updateCancerStage(sid, stageKey, val) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const curStage = s.clinicalChips?.contextChips?.cancerContext?.clinicalStage || {};
        await this.updateContextField(sid, 'cancerContext', {
            clinicalStage: {
                ...curStage,
                [stageKey]: val
            }
        });
    },

    async setChecklistState(sid, code, nextState) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const actor = this.getEffectiveActor(s);
        const isTrainee = SAP_TRAINEE_IDS.has(actor.staffId);
        const curItem = s.preopChecklist?.[code] || {};
        const itemPatch = { state: nextState };
        if (code === 'CK-02' && ['verified_ok', 'prepared_ok'].includes(nextState)) {
            const curSubs = curItem.subChecks || {};
            const targetSub = isTrainee ? 'prepared_ok' : 'verified_ok';
            itemPatch.subChecks = {
                preAnesthesiaExam: curSubs.preAnesthesiaExam && curSubs.preAnesthesiaExam !== 'unverified' ? curSubs.preAnesthesiaExam : targetSub,
                ecg: curSubs.ecg && curSubs.ecg !== 'unverified' ? curSubs.ecg : targetSub,
                chestImaging: curSubs.chestImaging && curSubs.chestImaging !== 'unverified' ? curSubs.chestImaging : targetSub,
                echo: curSubs.echo && curSubs.echo !== 'unverified' ? curSubs.echo : (isTrainee ? 'prepared_ok' : 'not_indicated')
            };
        }
        await this.patchDraft(sid, { preopChecklist: { [code]: itemPatch } });
    },

    async setChecklistNote(sid, code, state, note) {
        await this.patchDraft(sid, {
            preopChecklist: {
                [code]: { state, clinicalPlanNote: note }
            }
        });
    },

    async cycleSubCheck(sid, subKey, curVal, isTrainee) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const curCk02 = s.preopChecklist?.['CK-02'] || { state: 'unverified', subChecks: {} };
        let nextVal;
        if (isTrainee) {
            nextVal = curVal === 'prepared_ok' ? 'unverified' : 'prepared_ok';
        } else if (subKey === 'preAnesthesiaExam') {
            nextVal = curVal === 'verified_ok' ? 'unverified' : 'verified_ok';
        } else {
            nextVal = curVal === 'verified_ok' ? 'not_indicated' : (curVal === 'not_indicated' ? 'unverified' : 'verified_ok');
        }
        const nextSubs = { ...(curCk02.subChecks || {}), [subKey]: nextVal };
        const nextMainState = curCk02.state === 'unverified' ? (isTrainee ? 'prepared_ok' : 'verified_ok') : curCk02.state;
        await this.patchDraft(sid, {
            preopChecklist: {
                'CK-02': {
                    state: nextMainState,
                    subChecks: nextSubs
                }
            }
        });
    },

    // BƯỚC 2.7: Run Bulk Routine Confirm + Start 10-Second Floating Undo Bar
    async runBulkConfirm(sid) {
        if (this._bulkUndoTimer) clearTimeout(this._bulkUndoTimer);
        this._bulkUndoExpiresAt = Date.now() + 10000;
        const updated = await this.patchDraft(sid, { bulkAction: 'bulk_confirm_routine' });
        if (updated) {
            this._bulkUndoTimer = setTimeout(() => {
                this._bulkUndoExpiresAt = 0;
                this._bulkUndoTimer = null;
                if (this._openCaseId === sid) this._refreshOpenModal(sid);
            }, 10000);
        }
    },

    async undoBulkConfirm(sid) {
        if (this._bulkUndoTimer) {
            clearTimeout(this._bulkUndoTimer);
            this._bulkUndoTimer = null;
        }
        this._bulkUndoExpiresAt = 0;
        await this.patchDraft(sid, { bulkAction: 'undo_bulk_confirm' });
        Toast.info('Đã hoàn tác xác nhận nhanh');
    },

    // ── Workflow Transitions: Request Verify, Submit, Emergency, Preapprove, Approve (& Next), Return, Hold, Revoke ──
    async requestAttendingVerify(sid) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const actor = this.getEffectiveActor(s);
        const ckSync = this._buildSyncedStep2ChecklistPatch(s, actor);
        try {
            const res = await this._api(`/api/surgery-approval/${sid}/request-verify`, 'POST', {
                expectedCaseRevision: s.caseRevision,
                ...(ckSync ? { draft: { preopChecklist: ckSync } } : {})
            }, { allowSimulation: true });
            if (res?.surgery) this._syncSurgeryInStore(res.surgery);
            App.renderCurrentPage();
            Modal.close();
            Toast.success('Đã gửi thông báo mời Bác sĩ mổ chính xác nhận & trình duyệt!');
        } catch (err) {
            this._handleMutationError(sid, err);
        }
    },

    async submitRoutineForApproval(sid, fromExtraDrawer = false) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const cfg = this.getConfig();
        const actor = this.getEffectiveActor(s);
        const sla = this._computeSlaDisplay(s, cfg);
        const urg = s.clinicalClassification?.urgencyLevel || 'elective';
        const needLate = sla.isOverdue && ['elective', 'elective_service'].includes(urg) && String(s.approval?.lateReason || '').trim().length < 5;
        const needActing = !SAP_BCN_IDS.has(actor.staffId) && Number(actor.staffId) !== Number(s.mainSurgeon) && Number(actor.staffId) !== Number(s.coordinatingAttendingStaffId);

        let lateReason = s.approval?.lateReason || '';
        let actingReason = '';
        if (fromExtraDrawer) {
            lateReason = document.getElementById('sap-late-reason')?.value?.trim() || lateReason;
            actingReason = document.getElementById('sap-acting-reason')?.value?.trim() || '';
        } else if (needLate || needActing) {
            this._activeActionDrawer = 'submit_extra';
            this._refreshOpenModal(sid);
            requestAnimationFrame(() => this._scrollToFieldInDrawer('sap-subdrawer-submit-extra'));
            return;
        }

        const ckSync = this._buildSyncedStep2ChecklistPatch(s, actor);
        const body = {
            expectedCaseRevision: s.caseRevision,
            ...(ckSync ? { draft: { preopChecklist: ckSync } } : {}),
            ...(lateReason ? { lateReason } : {}),
            ...(actingReason ? { actingForMainSurgeonReason: actingReason } : {})
        };
        try {
            const res = await this._api(`/api/surgery-approval/${sid}/submit`, 'POST', body, { allowSimulation: true });
            if (res?.surgery) this._syncSurgeryInStore(res.surgery);
            this._lastGateErrors = null;
            this._activeActionDrawer = null;
            App.renderCurrentPage();
            Modal.close();
            Toast.success('Đã trình duyệt mổ tại khoa thành công!');
        } catch (err) {
            this._handleMutationError(sid, err);
        }
    },

    async submitEmergencyException(sid) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const reason = document.getElementById('sap-em-reason')?.value?.trim() || '';
        const contactedAt = document.getElementById('sap-em-time')?.value?.trim() || new Date().toISOString();
        const ownerId = Number(this._emOwnerDraft || s.mainSurgeon || 0);
        try {
            const res = await this._api(`/api/surgery-approval/${sid}/submit-emergency`, 'POST', {
                expectedCaseRevision: s.caseRevision,
                emergencyReasonNote: reason,
                verbalConsultRecord: {
                    contactedLeaderStaffId: Number(this._emLeaderDraft || 1),
                    contactChannel: this._emChannelDraft || 'phone',
                    contactedAt
                },
                postOpFollowUpOwnerStaffId: ownerId
            }, { allowSimulation: true });
            if (res?.surgery) this._syncSurgeryInStore(res.surgery);
            this._activeActionDrawer = null;
            App.renderCurrentPage();
            Modal.close();
            Toast.success('Đã ghi nhận Ngoại lệ Cấp cứu — Không làm chậm xử trí lâm sàng!');
        } catch (err) {
            this._handleMutationError(sid, err);
        }
    },

    // BƯỚC 3.2 & 3.4: BCN Primary Decision (Approve / Preapprove / Re-approve) + Optional "Open Next Case"
    async handleBcnPrimaryDecision(sid, openNextAfter = false) {
        let s = this._getCaseById(sid);
        if (!s) return;
        const cfg = this.getConfig();
        const actor = this.getEffectiveActor(s);
        const note = document.getElementById('sap-bcn-note')?.value?.trim() || '';
        const backupReason = document.getElementById('sap-em-backup-reason')?.value?.trim() || '';
        const hasDel = this._hasActiveDelegationForDeputy();
        const canFinalApprove = actor.staffId === SAP_CHIEF_ID || (actor.staffId === SAP_DEPUTY_ID && (hasDel || s.approval?.status === 'emergency_exception_pending_ack'));

        try {
            // If case is in reapproval_required, BCN confirms re-submission atomically first
            if (s.approval?.status === 'reapproval_required') {
                const ckSync = this._buildSyncedStep2ChecklistPatch(s, actor);
                const subRes = await this._api(`/api/surgery-approval/${sid}/submit`, 'POST', {
                    expectedCaseRevision: s.caseRevision,
                    ...(ckSync ? { draft: { preopChecklist: ckSync } } : {}),
                    lateReason: s.approval?.lateReason || 'Cập nhật thay đổi sau duyệt để BCN duyệt lại',
                    actingForMainSurgeonReason: 'Ban Chủ nhiệm kiểm tra trực tiếp thay đổi và phê duyệt lại'
                }, { allowSimulation: true });
                if (subRes?.surgery) {
                    this._syncSurgeryInStore(subRes.surgery);
                    s = subRes.surgery;
                }
            }

            const endpoint = canFinalApprove
                ? `/api/surgery-approval/${sid}/approve`
                : `/api/surgery-approval/${sid}/preapprove`;
            const res = await this._api(endpoint, 'POST', {
                expectedCaseRevision: s.caseRevision,
                note,
                verifyPrivilege: true,
                ...(backupReason ? { emergencyBackupReason: backupReason } : {})
            }, { allowSimulation: true });

            if (res?.surgery) {
                this._syncSurgeryInStore(res.surgery);
            }
            App.renderCurrentPage();

            if (openNextAfter) {
                const nextId = this._getNextPendingBcnCaseId(sid, actor, cfg);
                if (nextId) {
                    Toast.success(`${canFinalApprove ? 'Đã duyệt' : 'Đã tiền duyệt'} — Đang mở ca kế tiếp...`);
                    await this.openCaseModal(nextId, { viewMode: 'summary' });
                    return;
                }
                Modal.close();
                Toast.success('Đã hoàn tất toàn bộ hàng đợi ca chờ duyệt!');
                return;
            }
            Modal.close();
            Toast.success(canFinalApprove ? 'Đã phê duyệt mổ tại khoa thành công!' : 'Đã hoàn tất Tiền duyệt — Chờ Trưởng khoa phê duyệt!');
        } catch (err) {
            this._handleMutationError(sid, err);
        }
    },

    async submitBcnReturn(sid) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const note = document.getElementById('sap-return-note')?.value?.trim() || '';
        try {
            const res = await this._api(`/api/surgery-approval/${sid}/return`, 'POST', {
                expectedCaseRevision: s.caseRevision,
                feedbackChips: this._returnChipDraft,
                feedbackNote: note
            }, { allowSimulation: true });
            if (res?.surgery) this._syncSurgeryInStore(res.surgery);
            this._activeActionDrawer = null;
            App.renderCurrentPage();
            Modal.close();
            Toast.success('Đã trả hồ sơ kèm hướng dẫn bổ sung cho Bác sĩ mổ chính!');
        } catch (err) {
            this._handleMutationError(sid, err);
        }
    },

    async submitHoldPostApproval(sid) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const reason = document.getElementById('sap-hold-reason')?.value?.trim() || '';
        try {
            const res = await this._api(`/api/surgery-approval/${sid}/hold-post-approval`, 'POST', {
                expectedCaseRevision: s.caseRevision,
                holdCategory: this._holdCatDraft || 'clinical_change',
                holdReason: reason
            }, { allowSimulation: true });
            if (res?.surgery) this._syncSurgeryInStore(res.surgery);
            this._activeActionDrawer = null;
            App.renderCurrentPage();
            Modal.close();
            Toast.warning('Đã đặt trạng thái Tạm hoãn tại khoa cho ca mổ.');
        } catch (err) {
            this._handleMutationError(sid, err);
        }
    },

    async submitReleaseHold(sid) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const note = document.getElementById('sap-release-note')?.value?.trim() || '';
        try {
            const res = await this._api(`/api/surgery-approval/${sid}/release-hold`, 'POST', {
                expectedCaseRevision: s.caseRevision,
                releaseNote: note
            }, { allowSimulation: true });
            if (res?.surgery) this._syncSurgeryInStore(res.surgery);
            this._activeActionDrawer = null;
            App.renderCurrentPage();
            Modal.close();
            Toast.success('Đã gỡ Tạm hoãn — Khôi phục trạng thái Đã duyệt tại khoa!');
        } catch (err) {
            this._handleMutationError(sid, err);
        }
    },

    async submitRevokeApproval(sid) {
        const s = this._getCaseById(sid);
        if (!s) return;
        const reason = document.getElementById('sap-revoke-reason')?.value?.trim() || '';
        try {
            const res = await this._api(`/api/surgery-approval/${sid}/revoke`, 'POST', {
                expectedCaseRevision: s.caseRevision,
                revokeReason: reason
            }, { allowSimulation: true });
            if (res?.surgery) this._syncSurgeryInStore(res.surgery);
            this._activeActionDrawer = null;
            App.renderCurrentPage();
            Modal.close();
            Toast.warning('Đã thu hồi phê duyệt tại khoa.');
        } catch (err) {
            this._handleMutationError(sid, err);
        }
    },

    // ── BƯỚC 2.10: Map HTTP 422 Server Gate Errors -> Clean Natural Vietnamese + Jump Links (Zero Raw Codes!) ──
    _mapSingleBlockingCode(rawCode) {
        const codeStr = String(rawCode || '').trim();
        if (SAP_GATE_REASON_MAP[codeStr]) return SAP_GATE_REASON_MAP[codeStr];

        const ckTitle = code => SAP_CK_INDEPENDENT_ITEMS.find(m => m.code === code)?.title
            || (code === 'CK-03' ? 'Bệnh nền & Thuốc chống huyết khối (Bước ②)'
                : code === 'CK-05' ? 'Giải phẫu bệnh & Giai đoạn u (Bước ②)'
                    : code === 'CK-07' ? 'Dự trù máu & thiết bị (Bước ②)' : 'Mục bảng kiểm');

        const ckStepAndField = code => {
            if (code === 'CK-03') return { step: 2, fieldId: 'sap-f-antithrombotic' };
            if (code === 'CK-05') return { step: 2, fieldId: 'sap-f-context-module' };
            if (code === 'CK-07') return { step: 2, fieldId: 'sap-f-blood-devices' };
            return { step: 3, fieldId: `sap-ck-row-${code}` };
        };

        const mInvalid = codeStr.match(/^(CK-0\d)_INVALID_STATE/);
        if (mInvalid) {
            const c = mInvalid[1];
            const loc = ckStepAndField(c);
            return { ...loc, label: `Chưa xác nhận mục: ${ckTitle(c)}` };
        }
        const mAtt = codeStr.match(/^(CK-0\d)_REQUIRES_ATTENDING_VERIFICATION$/);
        if (mAtt) {
            const c = mAtt[1];
            const loc = ckStepAndField(c);
            return { ...loc, label: `Bác sĩ chính chưa xác nhận: ${ckTitle(c)}` };
        }
        const mPlan = codeStr.match(/^(CK-0\d)_CLINICAL_PLAN_NOTE_REQUIRED$/);
        if (mPlan) {
            const c = mPlan[1];
            const loc = ckStepAndField(c);
            return { ...loc, label: `Chưa ghi kế hoạch xử trí bất thường cho: ${ckTitle(c)}` };
        }
        return null;
    },

    _handleMutationError(sid, err) {
        const code = err?.code || '';
        const reasons = err?.payload?.details?.blockingReasons || err?.payload?.blockingReasons || [];
        const mapped = [];

        if (code === 'LATE_REASON_REQUIRED' || code === 'ACTING_REASON_REQUIRED') {
            this._activeActionDrawer = 'submit_extra';
            this._refreshOpenModal(sid);
            Toast.warning(err.message);
            return;
        }

        if (Array.isArray(reasons) && reasons.length > 0) {
            const seenLabels = new Set();
            for (const r of reasons) {
                const item = this._mapSingleBlockingCode(r);
                if (item && !seenLabels.has(item.label)) {
                    seenLabels.add(item.label);
                    mapped.push(item);
                }
            }
        } else if (SAP_GATE_REASON_MAP[code]) {
            mapped.push(SAP_GATE_REASON_MAP[code]);
        } else if (code === 'PROCEDURE_CATALOG_DISAMBIGUATION_REQUIRED') {
            mapped.push({ step: 1, fieldId: 'sap-f-catalog', label: 'Chưa chọn kỹ thuật mổ cụ thể trong Danh mục 309 phẫu thuật' });
        } else if (code === 'UNCLASSIFIED_PROCEDURE_NOTE_REQUIRED') {
            mapped.push({ step: 1, fieldId: 'sap-f-catalog', label: 'Chưa nhập thuyết minh cho kỹ thuật không phân loại' });
        } else if (code === 'OVER_COLUMN_FORBIDDEN_FOR_ELECTIVE' || code === 'OVER_COLUMN_DETECTED') {
            mapped.push({ step: 1, fieldId: 'sap-f-catalog', label: err.message });
        }

        if (mapped.length > 0) {
            this._lastGateErrors = mapped;
            this._bcnViewMode = 'steps';
            this._currentFocusStep = mapped[0].step;
            this._expandedSteps[mapped[0].step] = true;
            this._highlightFieldId = mapped[0].fieldId;
            this._refreshOpenModal(sid);
            requestAnimationFrame(() => this._scrollToFieldInDrawer('sap-gate-error-banner'));
            Toast.warning(`Vui lòng hoàn tất ${mapped.length} mục còn thiếu được liệt kê.`);
            return;
        }

        // Strip any residual internal codes if present in message
        const cleanMsg = String(err?.message || 'Không thể thực hiện thao tác')
            .replace(/\s*\([CCK0-9\-]+\)/g, '');
        Toast.error(cleanMsg);
    }
};
