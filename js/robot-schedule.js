// =====================================================================
// ROBOTIC SURGERY COORDINATION MODULE v2 (FEAT-243)
// 5-Step Clinical Workflow:
//   Step 1: BS khu vực gửi ca tư vấn (đủ XN tiền phẫu + Phòng bệnh)
//   Step 2: Điều phối viên (vcnguyen, lvhoan) xếp lịch TV cho TS. Nguyễn Phú Hữu
//   Step 3: TS. Hữu chốt KQ: Mổ Robot | Chuyển Nội soi | Cân nhắc | Không đồng ý mổ
//   Step 4: BS phòng theo dõi KQ, cho Xuất viện chờ (giữ slot) & Xác nhận nhập lại
//   Step 5: My-Work chips, Copy lịch TV Zalo (Zero-PHI), In P.CTXH A5, Thùng rác Zero-RM
// STRICT ZERO-LOCAL-PHI POLICY: NO client storage persistence of PHI.
// =====================================================================
(function (global) {
    'use strict';

    const DEFAULT_WARD_ROOMS = [
        'B705', 'B706', 'B707', 'B708', 'B709', 'B710',
        'B711', 'B712', 'B712A', 'B718', 'B719', 'ngoai_tru'
    ];

    const DEFAULT_REFUSAL_REASONS = {
        chi_phi: 'Chưa thu xếp chi phí phẫu thuật',
        suy_nghi_them: 'Bệnh nhân / gia đình xin về suy nghĩ thêm',
        dieu_tri_noi: 'Chuyển hướng điều trị nội khoa / theo dõi',
        chuyen_vien: 'Xin chuyển viện / điều trị nơi khác',
        ly_do_khac: 'Lý do khác'
    };

    const DEFAULT_POSTPONE_REASONS = {
        chua_ngung_khang_dong: 'Chưa ngưng đủ ngày thuốc kháng đông',
        benh_nen_chua_on_dinh: 'Bệnh lý nền nội khoa chưa ổn định',
        cho_cls_hoi_chan: 'Chờ bổ sung kết quả cận lâm sàng / hội chẩn',
        thieu_vat_tu_robot: 'Thiếu vật tư / dụng cụ phẫu thuật Robot',
        ket_phong_mo_cap_cuu: 'Kẹt phòng mổ / trùng lịch ưu tiên cấp cứu',
        benh_nhan_xin_hoan: 'Bệnh nhân xin hoãn / chưa thu xếp chi phí',
        ly_do_khac: 'Lý do khác'
    };

    const STATUS_META = {
        cho_xep_tu_van: { label: 'Chờ xếp lịch TV', badge: 'rbt-badge--amber', short: 'Chờ xếp TV' },
        da_xep_tu_van: { label: 'Đã xếp lịch TV', badge: 'rbt-badge--ocean', short: 'Đã xếp TV' },
        can_nhac: { label: 'Đang cân nhắc', badge: 'rbt-badge--indigo', short: 'Cân nhắc' },
        da_xep_robot: { label: 'Đã xếp lịch Robot', badge: 'rbt-badge--green', short: 'Mổ Robot' },
        da_xep_noisoi: { label: 'Chuyển mổ Nội soi', badge: 'rbt-badge--ocean', short: 'Mổ Nội soi' },
        khong_dong_y_mo: { label: 'Không đồng ý mổ', badge: 'rbt-badge--red', short: 'Không mổ' },
        hoan_mo: { label: 'Hoãn mổ', badge: 'rbt-badge--red', short: 'Hoãn mổ' },
        da_mo: { label: 'Đã phẫu thuật', badge: 'rbt-badge--navy', short: 'Đã mổ' },
        da_xoa: { label: 'Thùng rác', badge: 'rbt-badge--red', short: 'Thùng rác' },
        archived_deleted: { label: 'Đã lưu trữ ẩn', badge: 'rbt-badge--navy', short: 'Lưu trữ ẩn' }
    };

    const INDICATION_LABELS = {
        robot_hoac_noisoi: 'Chỉ định PT Nội soi hoặc Robot',
        uu_tien_robot: 'Ưu tiên phẫu thuật Robot',
        uu_tien_noisoi: 'Ưu tiên phẫu thuật Nội soi'
    };

    const SURGERY_TYPE_LABELS = {
        robot: 'Mổ Robot',
        chuongtrinh: 'Chương trình',
        yeucau: 'Yêu cầu',
        bankhan: 'Bán khẩn'
    };

    const APPROVAL_LABELS = {
        draft_unsubmitted: 'Duyệt khoa: Chưa trình',
        submitted: 'Duyệt khoa: Chờ duyệt',
        preapproved: 'Duyệt khoa: Phó khoa tiền duyệt',
        approved: 'Duyệt khoa: Đã duyệt',
        approved_with_exception: 'Duyệt khoa: Đã duyệt (ngoại lệ)',
        reapproval_required: 'Duyệt khoa: Cần duyệt lại',
        resubmit_required: 'Duyệt khoa: Cần trình lại',
        post_approval_hold: 'Duyệt khoa: Tạm hoãn khoa',
        not_in_scope: 'Duyệt khoa: Ngoài phạm vi',
        legacy_exempt: 'Duyệt khoa: Miễn trừ lịch sử'
    };

    const VALID_SLOTS = ['Ca 1', 'Ca 2', 'Ca 3'];
    const CLIENT_BUILD = '2611280742';
    const ADMISSION_SOURCE_LABELS = {
        cap_cuu: 'Cấp cứu',
        phong_kham: 'Phòng khám'
    };
    const CONSULT_NOTE_PRESETS = [
        'Phòng khám lầu 7',
        'Sau giao ban sáng',
        'Tại buồng bệnh'
    ];
    const DISCHARGE_INSTRUCTION_PRESETS = [
        'Ngưng kháng đông 5 ngày',
        'Nhịn ăn từ 22h tối trước mổ',
        'Đem đủ hồ sơ & thẻ BHYT',
        'Làm lại XN tiền phẫu khi nhập lại'
    ];
    const DELETE_REASON_PRESETS = [
        'Nhập trùng hồ sơ',
        'BN hủy khám / chuyển viện',
        'Nhập nhầm thông tin'
    ];
    const SANDBOX_PROFILES = [
        {
            patientName: '[TEST] Nguyễn Văn Minh',
            birthYear: '1964',
            gender: 'Nam',
            phone: '0901234561',
            wardRoom: 'B708',
            admissionSource: 'phong_kham',
            admittingDoctorType: 'staff',
            admittingDoctorId: 2,
            indicationType: 'robot_hoac_noisoi',
            diagnosis: 'Ung thư trực tràng giữa cT3N1M0 (Ca giả lập)',
            robotProcedure: 'Phẫu thuật Robot cắt trước thấp (LAR)',
            note: 'Hồ sơ giả lập vận hành thử — đủ XN tiền phẫu, ổn định huyết động.'
        },
        {
            patientName: '[TEST] Trần Thị Hoa',
            birthYear: '1968',
            gender: 'Nữ',
            phone: '0901234562',
            wardRoom: 'B710',
            admissionSource: 'phong_kham',
            admittingDoctorType: 'staff',
            admittingDoctorId: 6,
            indicationType: 'uu_tien_robot',
            diagnosis: 'U đại tràng Sigma cT3N0M0 (Ca giả lập)',
            robotProcedure: 'Phẫu thuật Robot cắt đoạn đại tràng Sigma',
            note: 'Hồ sơ giả lập — đã hội chẩn gây mê hồi sức đạt.'
        },
        {
            patientName: '[TEST] Lê Hoàng Nam',
            birthYear: '1959',
            gender: 'Nam',
            phone: '0901234563',
            wardRoom: 'B712',
            admissionSource: 'phong_kham',
            admittingDoctorType: 'external',
            admittingDoctorId: 102,
            indicationType: 'uu_tien_noisoi',
            diagnosis: 'Polyp lớn đại tràng phải nghịch sản nặng (Ca giả lập)',
            robotProcedure: 'PT Nội soi cắt đại tràng phải',
            note: 'Hồ sơ giả lập — ngưng kháng đông đủ 5 ngày.'
        },
        {
            patientName: '[TEST] Phạm Minh Tuấn',
            birthYear: '1971',
            gender: 'Nam',
            phone: '0901234564',
            wardRoom: 'ngoai_tru',
            admissionSource: 'cap_cuu',
            admittingDoctorType: '',
            admittingDoctorId: null,
            indicationType: 'robot_hoac_noisoi',
            diagnosis: 'K trực tràng cao cT2N0M0 (Ca giả lập)',
            robotProcedure: 'Phẫu thuật Robot cắt trước',
            note: 'Hồ sơ giả lập nhập từ Cấp cứu — chờ xếp lịch tư vấn TS. Hữu.'
        }
    ];

    function foldVi(v) {
        return String(v == null ? '' : v)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[đĐ]/g, 'd')
            .toLowerCase()
            .trim();
    }

    const esc = (v) => (typeof Utils !== 'undefined' && typeof Utils.escapeHtml === 'function')
        ? Utils.escapeHtml(v == null ? '' : String(v))
        : String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

    function parseIsoDate(isoStr) {
        if (!isoStr || typeof isoStr !== 'string') return null;
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoStr.trim());
        if (!m) return null;
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    }

    function toIsoDate(dt) {
        if (!(dt instanceof Date) || isNaN(dt.getTime())) return '';
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function addDaysIso(isoStr, days) {
        const dt = parseIsoDate(isoStr);
        if (!dt) return '';
        dt.setDate(dt.getDate() + Number(days || 0));
        return toIsoDate(dt);
    }

    function getMondayIso(isoStr) {
        const dt = parseIsoDate(isoStr) || new Date();
        const dow = dt.getDay();
        const diff = dow === 0 ? -6 : 1 - dow;
        dt.setDate(dt.getDate() + diff);
        return toIsoDate(dt);
    }

    function fmtViDate(isoStr) {
        const dt = parseIsoDate(isoStr);
        if (!dt) return '—';
        const d = String(dt.getDate()).padStart(2, '0');
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        return `${d}/${m}/${dt.getFullYear()}`;
    }

    function fmtViShortDate(isoStr) {
        const dt = parseIsoDate(isoStr);
        if (!dt) return '—';
        const d = String(dt.getDate()).padStart(2, '0');
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        return `${d}/${m}`;
    }

    function fmtWeekdayVi(isoStr) {
        const dt = parseIsoDate(isoStr);
        if (!dt) return '';
        const names = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
        return names[dt.getDay()] || '';
    }

    function daysBetweenIso(fromIso, toIso) {
        const d1 = parseIsoDate(fromIso);
        const d2 = parseIsoDate(toIso);
        if (!d1 || !d2) return null;
        return Math.round((d2.getTime() - d1.getTime()) / 86400000);
    }

    function roomLabel(wardRoom) {
        const wr = String(wardRoom || '').trim();
        if (!wr) return 'Chưa rõ phòng';
        if (wr === 'ngoai_tru') return 'Ngoại trú';
        return wr.startsWith('B') ? `Phòng ${wr}` : `Phòng B${wr}`;
    }

    function slotToStartTime(slot) {
        if (slot === 'Ca 1') return '07:30';
        if (slot === 'Ca 2') return '10:30';
        if (slot === 'Ca 3') return '13:30';
        return '';
    }

    function cleanTelHref(rc) {
        if (!rc || rc.phoneMasked === true) return '';
        const raw = String(rc.phone || '').trim();
        if (!raw || raw.includes('*')) return '';
        const digits = raw.replace(/\D/g, '');
        return digits.length >= 9 ? `tel:${digits}` : '';
    }

    function newIdempotencyKey() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `rbt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function notifyToast(msg, level = 'info') {
        if (typeof Toast !== 'undefined') {
            const fn = typeof Toast[level] === 'function' ? Toast[level] : Toast.info;
            if (typeof fn === 'function') {
                fn.call(Toast, msg);
                return;
            }
        }
        if (typeof Utils !== 'undefined' && typeof Utils.toast === 'function') {
            Utils.toast(msg, level);
        }
    }

    function openRobotModal(title, bodyHtml, footerHtml, opts = {}) {
        const size = (opts && ['wide', 'md', 'sm'].includes(opts.size)) ? opts.size : 'md';
        const mode = (opts && opts.mode) ? String(opts.mode) : '';
        const footerWrap = footerHtml
            ? `<div class="modal-footer rbt-modal-footer">${footerHtml}</div>`
            : '';
        const wrappedHtml = `<form class="rbt-modal-root rbt-modal-root--${esc(size)}" data-rbt-modal="1" data-rbt-form-mode="${esc(mode)}" novalidate onsubmit="return false;">
            <div class="rbt-modal-fields">${bodyHtml}</div>
            ${footerWrap}
        </form>`;
        if (typeof Modal !== 'undefined' && typeof Modal.open === 'function') {
            Modal.open(title, wrappedHtml);
            const modalEl = document.getElementById('modal');
            if (modalEl) {
                modalEl.classList.remove('rbt-modal-wide', 'rbt-modal-md', 'rbt-modal-sm');
                modalEl.classList.add(`rbt-modal-${size}`);
            }
        }
    }

    function datePresetsHtml(inputId, todayIso, presets) {
        const list = presets || [
            { label: 'Hôm nay', iso: todayIso },
            { label: 'Ngày mai', iso: addDaysIso(todayIso, 1) },
            { label: '+2 ngày', iso: addDaysIso(todayIso, 2) },
            { label: '+7 ngày', iso: addDaysIso(todayIso, 7) }
        ];
        return `<div class="rbt-date-presets">
            ${list.filter(p => p.iso).map(p => `<button type="button" class="rbt-date-preset-btn" data-rbt-date-target="${esc(inputId)}" data-rbt-date-val="${esc(p.iso)}">${esc(p.label)} (${fmtViShortDate(p.iso)})</button>`).join('')}
        </div>`;
    }

    const RobotSchedulePage = {
        _bootstrap: null,
        _loading: false,
        _loadPromise: null,
        _error: null,
        _subtab: null,
        _weekStartIso: null,
        _mobileDayIso: null,
        _mobileWeekAllDays: false,
        _mobileSearchOpen: false,
        _weekApproachFilter: 'all',
        _wardRoomFilter: 'all',
        _wardQuickFilter: 'all',
        _consultFilterMode: 'all',
        _declinedGroupFilter: 'all',
        _completedVisibleLimit: 20,
        _searchQuery: '',
        _postponeFilterReason: 'all',
        _statsYear: 'all',
        _statsMonth: 'all',
        _statsSurgeon: 'all',
        _delegatedBound: false,
        _printCleanupBound: false,
        _modalDirty: false,
        _modalDirtyWarnShown: false,
        _modalActive: false,
        _openModalMode: null,
        _openCaseCode: null,
        _conflictState: null,
        _inflightIdem: null,
        _printState: {
            mode: 'color',
            scope: 'week',
            date: '',
            caseCode: '',
            schedulerName: ''
        },

        purgeMemoryState() {
            this._bootstrap = null;
            this._loading = false;
            this._loadPromise = null;
            this._error = null;
            this._subtab = null;
            this._weekStartIso = null;
            this._mobileDayIso = null;
            this._mobileWeekAllDays = false;
            this._mobileSearchOpen = false;
            this._weekApproachFilter = 'all';
            this._wardRoomFilter = 'all';
            this._wardQuickFilter = 'all';
            this._consultFilterMode = 'all';
            this._declinedGroupFilter = 'all';
            this._completedVisibleLimit = 20;
            this._searchQuery = '';
            this._postponeFilterReason = 'all';
            this._statsYear = 'all';
            this._statsMonth = 'all';
            this._statsSurgeon = 'all';
            this._modalDirty = false;
            this._modalDirtyWarnShown = false;
            this._modalActive = false;
            this._openModalMode = null;
            this._openCaseCode = null;
            this._conflictState = null;
            this._inflightIdem = null;
            const printRoot = document.getElementById('robot-pctxh-print-root');
            if (printRoot) printRoot.innerHTML = '';
            if (document.body) document.body.classList.remove('printing-robot-pctxh');
            if (typeof RobotTutorial !== 'undefined') RobotTutorial.close({ silent: true });
        },

        canCloseModal(force = false) {
            if (force || !this._modalActive || !this._modalDirty) return true;
            if (this._modalDirtyWarnShown) return true;
            this._modalDirtyWarnShown = true;
            const box = document.getElementById('rbt-dirty-guard-banner');
            if (box) {
                box.hidden = false;
                box.scrollIntoView({ block: 'nearest' });
            }
            notifyToast('Dữ liệu biểu mẫu chưa lưu. Bấm Đóng/Hủy thêm lần nữa để thoát.', 'warning');
            return false;
        },

        _onModalClosed() {
            this._modalActive = false;
            this._modalDirty = false;
            this._modalDirtyWarnShown = false;
            this._openModalMode = null;
            this._conflictState = null;
            this._inflightIdem = null;
            const modalEl = document.getElementById('modal');
            if (modalEl) modalEl.classList.remove('rbt-modal-wide', 'rbt-modal-md', 'rbt-modal-sm');
            const fab = document.getElementById('rbt-mobile-fab');
            if (fab && this._perms().canCreateConsult) fab.hidden = false;
            const printRoot = document.getElementById('robot-pctxh-print-root');
            if (printRoot) printRoot.innerHTML = '';
            if (document.body) document.body.classList.remove('printing-robot-pctxh');
        },

        _markModalOpen(mode, caseCode = null) {
            this._modalActive = true;
            this._modalDirty = false;
            this._modalDirtyWarnShown = false;
            this._openModalMode = mode;
            this._openCaseCode = caseCode;
            this._conflictState = null;
            this._inflightIdem = null;
            const fab = document.getElementById('rbt-mobile-fab');
            if (fab) fab.hidden = true;
        },

        _markModalDirty() {
            this._modalDirty = true;
            this._modalDirtyWarnShown = false;
            const box = document.getElementById('rbt-dirty-guard-banner');
            if (box) box.hidden = true;
        },

        _getHeaders(extra = {}) {
            const token = typeof Auth !== 'undefined' && Auth.getToken ? Auth.getToken() : '';
            const hdrs = {
                'Content-Type': 'application/json',
                'X-Client-Build': String(CLIENT_BUILD),
                ...extra
            };
            if (token) hdrs['Authorization'] = `Bearer ${token}`;
            return hdrs;
        },

        async _apiJson(url, opts = {}) {
            const method = (opts.method || 'GET').toUpperCase();
            let idemKey = opts.idempotencyKey;
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !idemKey) {
                idemKey = newIdempotencyKey();
            }
            const extraHdrs = { ...(opts.headers || {}) };
            if (idemKey) extraHdrs['X-Idempotency-Key'] = idemKey;
            const resp = await fetch(url, {
                method,
                headers: this._getHeaders(extraHdrs),
                body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) {
                const err = new Error(data.error || `HTTP ${resp.status}`);
                err.status = resp.status;
                err.code = data.code || '';
                err.data = data;
                throw err;
            }
            return data;
        },

        _todayIso() {
            return (this._bootstrap && this._bootstrap.todayVn) || toIsoDate(new Date());
        },

        _cases() {
            return (this._bootstrap && Array.isArray(this._bootstrap.cases)) ? this._bootstrap.cases : [];
        },

        _perms() {
            return (this._bootstrap && this._bootstrap.permissions) ? this._bootstrap.permissions : {};
        },

        _cfg() {
            return (this._bootstrap && this._bootstrap.robotConfig) ? this._bootstrap.robotConfig : {};
        },

        _wardRooms() {
            return (this._bootstrap && Array.isArray(this._bootstrap.wardRooms) && this._bootstrap.wardRooms.length)
                ? this._bootstrap.wardRooms
                : DEFAULT_WARD_ROOMS;
        },

        _refusalReasons() {
            return (this._bootstrap && this._bootstrap.refusalReasons) || DEFAULT_REFUSAL_REASONS;
        },

        _postponeReasons() {
            return (this._bootstrap && this._bootstrap.postponeReasons) || DEFAULT_POSTPONE_REASONS;
        },

        _surgeons() {
            return (this._bootstrap && Array.isArray(this._bootstrap.surgeons)) ? this._bootstrap.surgeons : [];
        },

        _admittingDoctors() {
            const raw = (this._bootstrap && this._bootstrap.admittingDoctors) || {};
            return {
                internal: Array.isArray(raw.internal) ? raw.internal : [],
                external: Array.isArray(raw.external) ? raw.external : []
            };
        },

        _isLaptopPointer() {
            if (typeof window === 'undefined') return true;
            const w = window.innerWidth || 1024;
            if (w <= 768) return false;
            if (typeof window.matchMedia === 'function') {
                return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
            }
            return true;
        },

        _admissionSourceBadgeHtml(rc) {
            if (!rc || !rc.admissionSource) return '';
            if (rc.admissionSource === 'cap_cuu') {
                return `<span class="rbt-badge rbt-badge--source-cc">🚨 Cấp cứu</span>`;
            }
            if (rc.admissionSource === 'phong_kham') {
                const docTxt = rc.admittingDoctorName ? ` · ${rc.admittingDoctorName}` : '';
                return `<span class="rbt-badge rbt-badge--source-pk">🏥 PK${esc(docTxt)}</span>`;
            }
            return '';
        },

        _countConsultsOn(dateIso, session = '') {
            const d = String(dateIso || '').trim();
            if (!d) return 0;
            return this._cases().filter(c => {
                if (c.isTestSandboxCase) return false;
                if (c.status !== 'da_xep_tu_van') return false;
                if (c.consultDate !== d) return false;
                if (session && (c.consultSession || 'sang') !== session) return false;
                return true;
            }).length;
        },

        _currentUsername() {
            const p = this._perms();
            if (p.username) return String(p.username).trim().toLowerCase();
            if (typeof Auth !== 'undefined' && typeof Auth.getSession === 'function') {
                const s = Auth.getSession();
                if (s && s.username) return String(s.username).trim().toLowerCase();
            }
            return '';
        },

        _currentUserDisplay() {
            if (typeof Auth !== 'undefined' && typeof Auth.getSession === 'function') {
                const u = Auth.getSession();
                if (u) return [u.title, u.name].filter(Boolean).join(' ') || u.name || u.username || 'Bác sĩ';
            }
            return this._perms().displayName || this._currentUsername() || 'Bác sĩ';
        },

        _surgeonDisplay(rc) {
            if (!rc) return 'TS. BSCKII. Nguyễn Phú Hữu';
            if (rc.mainSurgeonName) return rc.mainSurgeonName;
            const found = this._surgeons().find(s => Number(s.id) === Number(rc.mainSurgeonId));
            if (found) return [found.title, found.name].filter(Boolean).join(' ').trim();
            return 'TS. BSCKII. Nguyễn Phú Hữu';
        },

        _findCase(code) {
            return this._cases().find(c => (c.robotCaseCode || c.soNV) === code) || null;
        },

        _upsertCaseInMemory(rcase) {
            if (!this._bootstrap || !rcase) return;
            const code = rcase.robotCaseCode || rcase.soNV;
            const list = this._cases();
            const idx = list.findIndex(c => (c.robotCaseCode || c.soNV) === code);
            if (idx >= 0) {
                list[idx] = rcase;
            } else {
                list.push(rcase);
            }
            if (typeof SurgeryPage !== 'undefined' && typeof Store !== 'undefined' && Store.loadFromServer) {
                Store.loadFromServer(true).catch(() => {});
            }
        },

        async ensureLoaded(force = false) {
            if (!force && this._bootstrap) return this._bootstrap;
            if (this._loadPromise && !force) return this._loadPromise;
            this._loading = true;
            this._error = null;
            this._loadPromise = this._apiJson('/api/robot/bootstrap')
                .then(data => {
                    this._bootstrap = data;
                    if (!this._weekStartIso) {
                        this._weekStartIso = getMondayIso(data.todayVn || toIsoDate(new Date()));
                    }
                    if (!this._subtab) {
                        const p = data.permissions || {};
                        this._subtab = (p.canScheduleConsult || p.canDecideConsult) ? 'consult' : 'ward';
                    }
                    if (!this._printState.date) {
                        this._printState.date = data.todayVn || toIsoDate(new Date());
                    }
                    if (!this._printState.schedulerName) {
                        this._printState.schedulerName = (data.robotConfig && data.robotConfig.defaultSchedulerName) || 'BSCKII. Võ Chí Nguyện';
                    }
                    return data;
                })
                .catch(err => {
                    this._error = err.message || 'Không tải được dữ liệu Điều phối Robot.';
                    throw err;
                })
                .finally(() => {
                    this._loading = false;
                    this._loadPromise = null;
                });
            return this._loadPromise;
        },

        async openFromWeeklySchedule(robotCaseCode) {
            if (typeof App !== 'undefined' && typeof App.navigate === 'function') {
                App.navigate('robot-schedule');
            }
            try {
                await this.ensureLoaded(true);
                const rc = robotCaseCode ? this._findCase(robotCaseCode) : null;
                if (rc) {
                    if (['cho_xep_tu_van', 'da_xep_tu_van', 'can_nhac'].includes(rc.status)) {
                        this._subtab = 'consult';
                    } else if (['da_xep_robot', 'da_xep_noisoi'].includes(rc.status)) {
                        this._subtab = rc.inpatientState === 'xuat_vien_cho' ? 'ward' : 'week';
                        if (rc.surgeryDate) this._weekStartIso = getMondayIso(rc.surgeryDate);
                    } else if (rc.status === 'da_mo') {
                        this._subtab = 'completed';
                    } else {
                        this._subtab = 'declined_postponed';
                    }
                    this._rerenderPage();
                    this.openDetailModal(rc.robotCaseCode);
                } else {
                    this._rerenderPage();
                }
            } catch (_) {
                this._rerenderPage();
            }
        },

        _bindEvents() {
            if (!this._printCleanupBound) {
                this._printCleanupBound = true;
                global.addEventListener('afterprint', () => {
                    if (document.body) document.body.classList.remove('printing-robot-pctxh');
                });
            }
            if (this._delegatedBound) return;
            this._delegatedBound = true;

            document.addEventListener('click', (e) => {
                const page = document.getElementById('robot-schedule-page');
                const modalOverlay = document.getElementById('modal-overlay');
                const target = e.target;
                const inPage = page && page.contains(target);
                const inModal = modalOverlay && modalOverlay.contains(target) && this._modalActive;
                if (!inPage && !inModal) return;

                const subtabBtn = target.closest('[data-rbt-subtab]');
                if (subtabBtn) {
                    this._subtab = subtabBtn.dataset.rbtSubtab;
                    this._rerenderPage();
                    return;
                }

                const dayPill = target.closest('[data-rbt-mobile-day]');
                if (dayPill) {
                    this._mobileDayIso = dayPill.dataset.rbtMobileDay || 'all';
                    this._rerenderPage();
                    return;
                }

                const datePresetBtn = target.closest('[data-rbt-date-target]');
                if (datePresetBtn) {
                    const tid = datePresetBtn.dataset.rbtDateTarget;
                    const tval = datePresetBtn.dataset.rbtDateVal;
                    const inp = document.getElementById(tid);
                    if (inp) {
                        inp.value = tval;
                        inp.dispatchEvent(new Event('change', { bubbles: true }));
                        this._markModalDirty();
                    }
                    return;
                }

                const slotBtn = target.closest('[data-rbt-pick-slot]');
                if (slotBtn) {
                    const slotVal = slotBtn.dataset.rbtPickSlot;
                    const hiddenSlot = document.getElementById('rbt-inp-slot');
                    if (hiddenSlot) hiddenSlot.value = slotVal;
                    const timeInp = document.getElementById('rbt-inp-time');
                    if (timeInp && (!timeInp.value || ['07:30', '10:30', '13:30'].includes(timeInp.value))) {
                        timeInp.value = slotToStartTime(slotVal);
                    }
                    document.querySelectorAll('[data-rbt-pick-slot]').forEach(el => {
                        el.classList.toggle('is-selected', el.dataset.rbtPickSlot === slotVal);
                    });
                    this._markModalDirty();
                    return;
                }

                const sessBtn = target.closest('[data-rbt-pick-session]');
                if (sessBtn) {
                    const val = sessBtn.dataset.rbtPickSession;
                    const hidden = document.getElementById('rbt-inp-consult-session');
                    if (hidden) hidden.value = val;
                    document.querySelectorAll('[data-rbt-pick-session]').forEach(el => {
                        el.classList.toggle('is-selected', el.dataset.rbtPickSession === val);
                    });
                    this._markModalDirty();
                    return;
                }

                const branchBtn = target.closest('[data-rbt-pick-decision]');
                if (branchBtn) {
                    const dec = branchBtn.dataset.rbtPickDecision;
                    const hidden = document.getElementById('rbt-inp-decision');
                    if (hidden) hidden.value = dec;
                    document.querySelectorAll('[data-rbt-pick-decision]').forEach(el => {
                        el.classList.toggle('is-selected', el.dataset.rbtPickDecision === dec);
                    });
                    document.querySelectorAll('[data-rbt-branch-panel]').forEach(p => {
                        p.hidden = p.dataset.rbtBranchPanel !== dec;
                    });
                    this._markModalDirty();
                    return;
                }

                const srcBtn = target.closest('[data-rbt-pick-source]');
                if (srcBtn) {
                    const prefix = srcBtn.dataset.rbtPrefix || 'rbt-inp';
                    const srcVal = srcBtn.dataset.rbtPickSource || '';
                    if (srcVal === 'cap_cuu') {
                        this._setAdmissionSourceState(prefix, { source: 'cap_cuu', docType: '', docId: '', docName: '', tab: 'internal' });
                    } else {
                        const curType = document.getElementById(`${prefix}-adm-doc-type`)?.value || '';
                        const curId = document.getElementById(`${prefix}-adm-doc-id`)?.value || '';
                        const curName = document.getElementById(`${prefix}-adm-doc-name`)?.value || '';
                        const curTab = document.getElementById(`${prefix}-adm-doc-tab`)?.value || 'internal';
                        this._setAdmissionSourceState(prefix, {
                            source: 'phong_kham',
                            docType: curType,
                            docId: curId,
                            docName: curName,
                            tab: curTab
                        });
                    }
                    this._markModalDirty();
                    return;
                }

                const admTabBtn = target.closest('[data-rbt-adm-tab]');
                if (admTabBtn) {
                    const prefix = admTabBtn.dataset.rbtPrefix || 'rbt-inp';
                    const tabVal = admTabBtn.dataset.rbtAdmTab || 'internal';
                    const tabEl = document.getElementById(`${prefix}-adm-doc-tab`);
                    if (tabEl) tabEl.value = tabVal;
                    if (tabVal === 'manual') {
                        const typeEl = document.getElementById(`${prefix}-adm-doc-type`);
                        const idEl = document.getElementById(`${prefix}-adm-doc-id`);
                        if (typeEl) typeEl.value = 'manual';
                        if (idEl) idEl.value = '';
                    }
                    this._refreshAdmittingDoctorPicker(prefix);
                    if (tabVal === 'manual') {
                        const manEl = document.getElementById(`${prefix}-adm-doc-manual`);
                        if (manEl) try { manEl.focus({ preventScroll: true }); } catch (_) {}
                    }
                    this._markModalDirty();
                    return;
                }

                const admDocBtn = target.closest('[data-rbt-pick-adm-doc]');
                if (admDocBtn) {
                    const prefix = admDocBtn.dataset.rbtPrefix || 'rbt-inp';
                    const dType = admDocBtn.dataset.rbtPickAdmDoc || 'staff';
                    const dId = admDocBtn.dataset.rbtDocId || '';
                    const dName = admDocBtn.dataset.rbtDocName || '';
                    this._setAdmissionSourceState(prefix, {
                        source: 'phong_kham',
                        docType: dType,
                        docId: dId,
                        docName: dName,
                        tab: dType === 'external' ? 'external' : 'internal'
                    });
                    this._markModalDirty();
                    return;
                }

                const useManBtn = target.closest('[data-rbt-use-manual-query]');
                if (useManBtn) {
                    const prefix = useManBtn.dataset.rbtUseManualQuery || 'rbt-inp';
                    const qRaw = (document.getElementById(`${prefix}-adm-doc-search`)?.value || '').trim();
                    this._setAdmissionSourceState(prefix, {
                        source: 'phong_kham',
                        docType: 'manual',
                        docId: '',
                        docName: qRaw,
                        tab: 'manual'
                    });
                    const manEl = document.getElementById(`${prefix}-adm-doc-manual`);
                    if (manEl) manEl.value = qRaw;
                    this._markModalDirty();
                    return;
                }

                const clearDocBtn = target.closest('[data-rbt-clear-adm-doc]');
                if (clearDocBtn) {
                    const prefix = clearDocBtn.dataset.rbtClearAdmDoc || 'rbt-inp';
                    const manEl = document.getElementById(`${prefix}-adm-doc-manual`);
                    if (manEl) manEl.value = '';
                    this._setAdmissionSourceState(prefix, {
                        source: 'phong_kham',
                        docType: '',
                        docId: '',
                        docName: '',
                        tab: document.getElementById(`${prefix}-adm-doc-tab`)?.value || 'internal'
                    });
                    this._markModalDirty();
                    return;
                }

                const roomChip = target.closest('[data-rbt-pick-room]');
                if (roomChip) {
                    const targetId = roomChip.dataset.rbtTarget;
                    const roomVal = roomChip.dataset.rbtPickRoom || '';
                    const sel = targetId ? document.getElementById(targetId) : null;
                    if (sel) {
                        sel.value = roomVal;
                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    document.querySelectorAll(`[data-rbt-pick-room][data-rbt-target="${targetId}"]`).forEach(btn => {
                        btn.classList.toggle('is-selected', (btn.dataset.rbtPickRoom || '') === roomVal);
                    });
                    this._markModalDirty();
                    return;
                }

                const segBtn = target.closest('[data-rbt-pick-seg]');
                if (segBtn) {
                    const targetId = segBtn.dataset.rbtTarget;
                    const segVal = segBtn.dataset.rbtPickSeg ?? '';
                    const sel = targetId ? document.getElementById(targetId) : null;
                    if (sel) {
                        sel.value = segVal;
                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    document.querySelectorAll(`[data-rbt-pick-seg][data-rbt-target="${targetId}"]`).forEach(btn => {
                        btn.classList.toggle('is-selected', (btn.dataset.rbtPickSeg ?? '') === segVal);
                    });
                    if (targetId === 'rbt-pp-reason' && segVal === 'ly_do_khac') {
                        const ppNote = document.getElementById('rbt-pp-note');
                        if (ppNote) try { ppNote.focus({ preventScroll: true }); } catch (_) {}
                    }
                    this._markModalDirty();
                    return;
                }

                const quickFillBtn = target.closest('[data-rbt-quick-fill]');
                if (quickFillBtn) {
                    const sel = quickFillBtn.dataset.rbtQuickFill;
                    const inp = sel ? document.querySelector(sel) : null;
                    const txt = quickFillBtn.dataset.rbtVal || '';
                    if (inp) {
                        inp.value = txt;
                        inp.dispatchEvent(new Event('input', { bubbles: true }));
                        this._markModalDirty();
                    }
                    return;
                }

                const quickAppendBtn = target.closest('[data-rbt-quick-append]');
                if (quickAppendBtn) {
                    const sel = quickAppendBtn.dataset.rbtQuickAppend;
                    const inp = sel ? document.querySelector(sel) : null;
                    const txt = quickAppendBtn.dataset.rbtVal || '';
                    if (inp && txt) {
                        const cur = String(inp.value || '').trim();
                        if (!cur || cur.startsWith('Lịch mổ còn xa')) {
                            inp.value = txt;
                        } else if (!cur.includes(txt)) {
                            inp.value = `${cur}; ${txt}`;
                        }
                        inp.dispatchEvent(new Event('input', { bubbles: true }));
                        this._markModalDirty();
                    }
                    return;
                }

                const actionEl = target.closest('[data-rbt-action]');
                if (!actionEl) return;
                const action = actionEl.dataset.rbtAction;
                const code = actionEl.dataset.rbtCode || '';
                const extra = actionEl.dataset.rbtExtra || '';
                this._handleAction(action, code, extra, actionEl);
            });

            document.addEventListener('keydown', (e) => {
                const modalOverlay = document.getElementById('modal-overlay');
                if (!this._modalActive || !modalOverlay || !modalOverlay.classList.contains('active')) return;
                const t = e.target;
                if (!t || !modalOverlay.contains(t)) return;

                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    const submitBtn = modalOverlay.querySelector('[data-rbt-primary-submit="1"]:not(:disabled)');
                    if (submitBtn) submitBtn.click();
                    return;
                }

                if (e.key === 'Enter') {
                    if (t.matches('[data-rbt-adm-search]')) {
                        e.preventDefault();
                        const prefix = t.dataset.rbtPrefix || 'rbt-inp';
                        const chips = document.querySelectorAll(`#${prefix}-adm-doc-chips [data-rbt-pick-adm-doc]`);
                        if (chips.length === 1) {
                            chips[0].click();
                        }
                        return;
                    }
                    if (t.matches('[data-rbt-adm-manual]')) {
                        e.preventDefault();
                        return;
                    }
                }
            });

            document.addEventListener('input', (e) => {
                const t = e.target;
                if (!t) return;
                if (t.id === 'rbt-search-input' || t.id === 'rbt-mobile-search-input') {
                    this._searchQuery = t.value || '';
                    this._rerenderPage();
                    return;
                }
                if (t.matches('[data-rbt-adm-search]')) {
                    const prefix = t.dataset.rbtPrefix || 'rbt-inp';
                    this._refreshAdmittingDoctorPicker(prefix);
                    return;
                }
                if (t.matches('[data-rbt-adm-manual]')) {
                    const prefix = t.dataset.rbtPrefix || 'rbt-inp';
                    const val = t.value || '';
                    const typeEl = document.getElementById(`${prefix}-adm-doc-type`);
                    const idEl = document.getElementById(`${prefix}-adm-doc-id`);
                    const nameEl = document.getElementById(`${prefix}-adm-doc-name`);
                    if (typeEl) typeEl.value = val.trim() ? 'manual' : '';
                    if (idEl) idEl.value = '';
                    if (nameEl) nameEl.value = val.trim();
                    this._updateAdmittingSelectedBadge(prefix);
                    this._markModalDirty();
                    return;
                }
                if (this._openModalMode === 'create_consult' || this._openModalMode === 'create_case') {
                    this._updateOptionalCount();
                }
                const modalOverlay = document.getElementById('modal-overlay');
                if (this._modalActive && modalOverlay && modalOverlay.contains(t)) {
                    this._markModalDirty();
                }
            });

            document.addEventListener('change', (e) => {
                const t = e.target;
                if (!t) return;
                if (t.id === 'rbt-week-approach-filter') {
                    this._weekApproachFilter = t.value || 'all';
                    this._rerenderPage();
                } else if (t.id === 'rbt-ward-room-filter') {
                    this._wardRoomFilter = t.value || 'all';
                    this._rerenderPage();
                } else if (t.id === 'rbt-ward-quick-filter') {
                    this._wardQuickFilter = t.value || 'all';
                    this._rerenderPage();
                } else if (t.id === 'rbt-consult-filter-mode') {
                    this._consultFilterMode = t.value || 'all';
                    this._rerenderPage();
                } else if (t.id === 'rbt-declined-group-filter') {
                    this._declinedGroupFilter = t.value || 'all';
                    this._rerenderPage();
                } else if (t.id === 'rbt-postpone-filter') {
                    this._postponeFilterReason = t.value || 'all';
                    this._rerenderPage();
                } else if (t.id === 'rbt-stats-year') {
                    this._statsYear = t.value || 'all';
                    this._rerenderPage();
                } else if (t.id === 'rbt-stats-month') {
                    this._statsMonth = t.value || 'all';
                    this._rerenderPage();
                } else if (t.id === 'rbt-stats-surgeon') {
                    this._statsSurgeon = t.value || 'all';
                    this._rerenderPage();
                } else if (t.id === 'rbt-inp-consult-date' && this._openModalMode === 'schedule_consult') {
                    this._updateConsultSlotHints(t.value);
                    this._markModalDirty();
                } else if (t.id === 'rbt-inp-date' && this._openModalMode === 'decide_consult') {
                    const slotHost = document.getElementById('rbt-decide-slot-wrap');
                    if (slotHost) {
                        slotHost.innerHTML = this._renderSlotPickerHtml(t.value, document.getElementById('rbt-inp-slot')?.value || 'Ca 1', this._openCaseCode);
                    }
                    this._markModalDirty();
                } else if (t.id === 'rbt-inp-date' && this._openModalMode === 'edit_schedule') {
                    const slotHost = document.getElementById('rbt-edit-sched-slot-wrap');
                    if (slotHost) {
                        slotHost.innerHTML = this._renderSlotPickerHtml(t.value, document.getElementById('rbt-inp-slot')?.value || 'Ca 1', this._openCaseCode);
                    }
                    this._markModalDirty();
                } else if (t.id === 'rbt-inp-date' && this._openModalMode === 'create_case') {
                    const slotHost = document.getElementById('rbt-create-slot-wrap');
                    if (slotHost) {
                        slotHost.innerHTML = this._renderSlotPickerHtml(t.value, document.getElementById('rbt-inp-slot')?.value || 'Ca 1', '');
                    }
                    this._markModalDirty();
                } else if (t.id === 'rbt-inp-sandbox') {
                    if (t.checked) this._fillSandboxForm();
                    this._markModalDirty();
                } else if (t.id === 'rbt-inp-print-mode' || t.id === 'rbt-inp-print-scope' || t.id === 'rbt-inp-print-date' || t.id === 'rbt-inp-print-case') {
                    this._syncPrintPreviewFromModal();
                } else {
                    if (t.id) {
                        document.querySelectorAll(`[data-rbt-pick-room][data-rbt-target="${t.id}"]`).forEach(btn => {
                            btn.classList.toggle('is-selected', (btn.dataset.rbtPickRoom || '') === (t.value || ''));
                        });
                        document.querySelectorAll(`[data-rbt-pick-seg][data-rbt-target="${t.id}"]`).forEach(btn => {
                            btn.classList.toggle('is-selected', (btn.dataset.rbtPickSeg ?? '') === (t.value ?? ''));
                        });
                    }
                    if (this._openModalMode === 'create_consult' || this._openModalMode === 'create_case') {
                        this._updateOptionalCount();
                    }
                    const modalOverlay = document.getElementById('modal-overlay');
                    if (this._modalActive && modalOverlay && modalOverlay.contains(t)) {
                        this._markModalDirty();
                    }
                }
            });
        },

        async _handleAction(action, code, extra, el) {
            if (action === 'refresh') {
                await this.ensureLoaded(true).catch(() => {});
                this._rerenderPage();
                return;
            }
            if (action === 'jump_my_work') {
                if (extra === 'consult_need') {
                    this._subtab = 'consult';
                    this._consultFilterMode = 'need';
                } else if (extra === 'consult_scheduled') {
                    this._subtab = 'consult';
                    this._consultFilterMode = 'scheduled';
                } else if (extra === 'ward_mine') {
                    this._subtab = 'ward';
                    this._wardQuickFilter = 'mine';
                } else if (extra === 'ward_wait') {
                    this._subtab = 'ward';
                    this._wardQuickFilter = 'xuat_vien_cho';
                }
                this._rerenderPage();
                return;
            }
            if (action === 'week_prev') {
                this._weekStartIso = addDaysIso(this._weekStartIso, -7);
                this._mobileDayIso = this._weekStartIso;
                this._rerenderPage();
                return;
            }
            if (action === 'week_next') {
                this._weekStartIso = addDaysIso(this._weekStartIso, 7);
                this._mobileDayIso = this._weekStartIso;
                this._rerenderPage();
                return;
            }
            if (action === 'week_today') {
                this._weekStartIso = getMondayIso(this._todayIso());
                this._mobileDayIso = this._todayIso();
                this._rerenderPage();
                return;
            }
            if (action === 'toggle_mobile_week_all') {
                this._mobileWeekAllDays = !this._mobileWeekAllDays;
                this._rerenderPage();
                return;
            }
            if (action === 'toggle_mobile_search') {
                this._mobileSearchOpen = !this._mobileSearchOpen;
                this._rerenderPage();
                return;
            }
            if (action === 'clear_search') {
                this._searchQuery = '';
                this._rerenderPage();
                return;
            }
            if (action === 'load_more_completed') {
                this._completedVisibleLimit += 20;
                this._rerenderPage();
                return;
            }
            if (action === 'copy_zalo_consult') {
                this.copyZaloConsultSchedule();
                return;
            }
            if (action === 'open_tutorial') {
                if (typeof Modal !== 'undefined' && this._modalActive && Modal.close) Modal.close(true);
                if (typeof RobotTutorial !== 'undefined') RobotTutorial.start({ force: true });
                return;
            }
            if (action === 'open_mobile_menu') {
                this.openMobileMenuModal();
                return;
            }
            if (action === 'open_case_sheet') {
                this.openCaseSheetModal(code);
                return;
            }
            if (action === 'open_create_consult') {
                this.openCreateModal('create_consult');
                return;
            }
            if (action === 'open_create_sandbox_consult') {
                this.openCreateModal('create_consult', { sandbox: true });
                return;
            }
            if (action === 'autofill_sandbox') {
                this._fillSandboxForm();
                return;
            }
            if (action === 'open_create_case') {
                this.openCreateModal('create_case');
                return;
            }
            if (action === 'open_detail') {
                this.openDetailModal(code);
                return;
            }
            if (action === 'open_schedule_consult') {
                this.openScheduleConsultModal(code);
                return;
            }
            if (action === 'open_decide_consult') {
                this.openDecideConsultModal(code, extra);
                return;
            }
            if (action === 'open_edit_info') {
                this.openEditInfoModal(code);
                return;
            }
            if (action === 'open_edit_schedule') {
                this.openEditScheduleModal(code);
                return;
            }
            if (action === 'open_discharge_wait') {
                this.openDischargeWaitModal(code);
                return;
            }
            if (action === 'confirm_readmit') {
                await this._submitSimplePatch(code, 'confirm_readmit', {}, 'Đã xác nhận bệnh nhân nhập viện trở lại.');
                return;
            }
            if (action === 'open_postpone') {
                this.openPostponeModal(code);
                return;
            }
            if (action === 'mark_completed') {
                await this._submitSimplePatch(code, 'mark_completed', {}, 'Đã xác nhận ca bệnh đã phẫu thuật.');
                return;
            }
            if (action === 'reopen_consult') {
                await this._submitSimplePatch(code, 'reopen_consult', {}, 'Đã mở lại bước chờ xếp lịch tư vấn.');
                return;
            }
            if (action === 'open_confirm_delete') {
                this.openConfirmDeleteModal(code);
                return;
            }
            if (action === 'confirm_soft_delete') {
                const reason = document.getElementById('rbt-del-reason')?.value?.trim() || 'Xóa ca chờ tư vấn';
                await this._submitSimplePatch(code, 'soft_delete', { deleteReason: reason }, 'Đã chuyển ca chờ tư vấn vào Thùng rác.');
                return;
            }
            if (action === 'soft_delete') {
                await this._submitSimplePatch(code, 'soft_delete', { deleteReason: 'Đưa vào thùng rác từ Điều phối Robot' }, 'Đã chuyển hồ sơ vào Thùng rác.');
                return;
            }
            if (action === 'restore_trash') {
                await this._submitSimplePatch(code, 'restore_trash', {}, 'Đã khôi phục hồ sơ từ Thùng rác.');
                return;
            }
            if (action === 'archive_delete') {
                await this._submitArchiveDelete(code);
                return;
            }
            if (action === 'open_link_surgery') {
                this.openLinkSurgeryModal(extra || code);
                return;
            }
            if (action === 'open_print_modal') {
                this.openPrintPctxhModal(code || '');
                return;
            }
            if (action === 'open_print_single') {
                this.openPrintPctxhModal(code);
                return;
            }
            if (action === 'execute_print_pctxh') {
                this._executePrint();
                return;
            }
            if (action === 'submit_create') {
                await this._submitCreateModal(extra || 'create_consult', el);
                return;
            }
            if (action === 'submit_schedule_consult') {
                await this._submitScheduleConsult(code, el);
                return;
            }
            if (action === 'submit_decide_consult') {
                await this._submitDecideConsult(code, el);
                return;
            }
            if (action === 'submit_edit_info') {
                await this._submitEditInfo(code, el);
                return;
            }
            if (action === 'submit_edit_schedule') {
                await this._submitEditSchedule(code, el);
                return;
            }
            if (action === 'submit_discharge_wait') {
                await this._submitDischargeWait(code, el);
                return;
            }
            if (action === 'submit_postpone') {
                await this._submitPostpone(code, el);
                return;
            }
            if (action === 'submit_link_surgery') {
                await this._submitLinkSurgery(extra || code, el);
                return;
            }
            if (action === 'save_config') {
                await this._submitConfigSave(el);
                return;
            }
        },

        _rerenderPage() {
            const activeEl = document.activeElement;
            const activeId = activeEl ? activeEl.id : '';
            const selStart = (activeEl && typeof activeEl.selectionStart === 'number') ? activeEl.selectionStart : null;
            const main = document.getElementById('main-content');
            if (!main) return;
            main.innerHTML = this.render();
            this.afterRender();
            if (activeId === 'rbt-search-input' || activeId === 'rbt-mobile-search-input') {
                const reEl = document.getElementById(activeId);
                if (reEl) {
                    reEl.focus();
                    if (selStart !== null && typeof reEl.setSelectionRange === 'function') {
                        try { reEl.setSelectionRange(selStart, selStart); } catch (_) {}
                    }
                }
            }
        },

        afterRender() {
            this._bindEvents();
            if (!this._bootstrap && !this._loading && !this._error) {
                this.ensureLoaded(false)
                    .then(() => this._rerenderPage())
                    .catch(() => this._rerenderPage());
                return;
            }
            if (this._bootstrap && typeof RobotTutorial !== 'undefined' && typeof RobotTutorial.maybeAutoStart === 'function') {
                RobotTutorial.maybeAutoStart(this._perms());
            }
        },

        render() {
            this._bindEvents();

            if (!this._bootstrap && !this._error) {
                return `<div id="robot-schedule-page" class="rbt-page"><div class="rbt-panel">Đang tải dữ liệu Điều phối Lịch mổ Robot...</div></div>`;
            }

            if (this._error && !this._bootstrap) {
                return `<div id="robot-schedule-page" class="rbt-page">
                    <div class="rbt-panel">
                        <h3>Không tải được phân hệ Điều phối Robot</h3>
                        <p>${esc(this._error)}</p>
                        <button type="button" class="btn btn-primary" data-rbt-action="refresh">Thử tải lại</button>
                    </div>
                </div>`;
            }

            const p = this._perms();
            const cases = this._cases().filter(c => c.status !== 'archived_deleted');
            const myCounts = (this._bootstrap && this._bootstrap.myActionCounts) || {};
            const todayIso = this._todayIso();

            const countConsult = cases.filter(c => ['cho_xep_tu_van', 'can_nhac', 'da_xep_tu_van'].includes(c.status)).length;
            const countWeek = cases.filter(c => ['da_xep_robot', 'da_xep_noisoi'].includes(c.status)).length;
            const countWard = cases.filter(c => ['da_xep_robot', 'da_xep_noisoi', 'da_xep_tu_van', 'cho_xep_tu_van', 'can_nhac', 'khong_dong_y_mo'].includes(c.status)).length;
            const countDeclined = cases.filter(c => ['khong_dong_y_mo', 'hoan_mo', 'da_xoa'].includes(c.status)).length;
            const countCompleted = cases.filter(c => c.status === 'da_mo').length;
            const countWait = cases.filter(c => ['da_xep_robot', 'da_xep_noisoi'].includes(c.status) && c.inpatientState === 'xuat_vien_cho').length;

            let roleLabel = 'Chỉ xem & In P.CTXH';
            if (p.isBcn) roleLabel = 'BCN · Toàn quyền';
            else if (p.isChiefConsultDecider) roleLabel = 'TS. Hữu · Chốt KQ Tư vấn';
            else if (p.isCoordinator) roleLabel = 'Điều phối viên Robot';
            else if (p.canCreateConsult) roleLabel = 'BS Khu vực';

            const subtabs = [
                { id: 'consult', label: 'Lịch tư vấn & Chờ xếp', icon: '🩺', count: countConsult },
                { id: 'week', label: 'Lịch mổ đã xếp', icon: '📅', count: countWeek },
                { id: 'ward', label: 'Theo dõi phòng & XV chờ', icon: '🏥', count: countWait || countWard },
                { id: 'declined_postponed', label: 'Không mổ / Hoãn / Rác', icon: '⏸️', count: countDeclined },
                { id: 'completed', label: 'Đã mổ & Thống kê', icon: '📊', count: countCompleted }
            ];
            if (p.canConfigureCoordinators) {
                subtabs.push({ id: 'config', label: 'Cấu hình', icon: '⚙️', count: '' });
            }

            if (!subtabs.some(st => st.id === this._subtab)) {
                this._subtab = 'consult';
            }

            const q = foldVi(this._searchQuery);
            const matchesSearch = (c) => {
                if (!q) return true;
                const srcTxt = c.admissionSource === 'cap_cuu'
                    ? 'cấp cứu cap cuu'
                    : (c.admissionSource === 'phong_kham' ? 'phòng khám phong kham' : '');
                const hay = [
                    c.robotCaseCode, c.patientName, c.admissionId, c.diagnosis,
                    c.robotProcedure, c.wardRoom, c.mainSurgeonName, c.createdByName,
                    srcTxt, c.admittingDoctorName
                ].join(' ');
                return foldVi(hay).includes(q);
            };

            const bodyHtml = this._renderActiveSubtab(cases.filter(matchesSearch), todayIso);

            return `<div id="robot-schedule-page" class="rbt-page">
                <header class="rbt-header">
                    <div class="rbt-header__title-wrap">
                        <h2 class="rbt-header__title">
                            <span class="rbt-header__title-text">🤖&nbsp;Điều phối Lịch mổ Robot</span>
                            <span class="rbt-role-pill">${esc(roleLabel)}</span>
                        </h2>
                        <p class="rbt-header__sub">Quy trình 5 bước: BS Khu vực gửi TV → ĐP xếp lịch TS. Hữu → Chốt Robot / Nội soi / Không mổ → BS phòng theo dõi &amp; XV chờ giữ slot.</p>
                    </div>
                    <div class="rbt-header__actions rbt-desktop-only-flex">
                        <button type="button" id="rbt-tutorial-btn" class="btn rbt-btn-outline-light" data-rbt-action="open_tutorial" title="Xem hướng dẫn 7 bước">❓ Hướng dẫn</button>
                        <button type="button" class="btn rbt-btn-outline-light" data-rbt-action="copy_zalo_consult">📋 Copy lịch TV Zalo</button>
                        <button type="button" class="btn rbt-btn-outline-light" data-rbt-action="open_print_modal">🖨️ In P.CTXH (A5)</button>
                        ${p.canCreateConsult ? `<button type="button" class="btn rbt-btn-light" data-rbt-action="open_create_consult">➕ Gửi ca tư vấn</button>` : ''}
                        <button type="button" class="btn rbt-btn-outline-light" data-rbt-action="refresh" title="Tải lại">🔄</button>
                    </div>
                    <div class="rbt-mobile-hdr-tools rbt-mobile-only-flex">
                        <button type="button" id="rbt-mobile-tutorial-pill" class="rbt-mobile-icon-btn" data-rbt-action="open_tutorial" aria-label="Hướng dẫn">?</button>
                        <button type="button" class="rbt-mobile-icon-btn ${this._mobileSearchOpen ? 'is-active' : ''}" data-rbt-action="toggle_mobile_search" aria-label="Tìm kiếm">🔍</button>
                        <button type="button" id="rbt-mobile-fab" class="rbt-fab rbt-mobile-only-flex rbt-mobile-fab-hdr" data-rbt-action="open_create_consult" aria-label="Gửi ca tư vấn" ${p.canCreateConsult ? '' : 'hidden'}>+</button>
                        <button type="button" class="rbt-mobile-icon-btn rbt-mobile-more" data-rbt-action="open_mobile_menu" aria-label="Menu mở rộng">⋮</button>
                    </div>
                </header>

                ${this._mobileSearchOpen ? `<div class="rbt-mobile-search-bar rbt-mobile-only">
                    <div class="rbt-mobile-search-row">
                        <input id="rbt-mobile-search-input" type="search" class="form-input" placeholder="Tìm tên BN, mã RB, phòng B7xx..." value="${esc(this._searchQuery)}">
                        ${this._searchQuery ? `<button type="button" class="btn btn-secondary" data-rbt-action="clear_search">Xóa</button>` : ''}
                    </div>
                </div>` : ''}

                <section id="rbt-my-work-bar" class="rbt-my-work-bar" aria-label="Việc của tôi">
                    <span class="rbt-my-work-label">Việc của tôi:</span>
                    <button type="button" class="rbt-work-chip rbt-work-chip--amber" data-rbt-action="jump_my_work" data-rbt-extra="consult_need">
                        <span class="rbt-work-chip__dot"></span>
                        <span>Cần xếp TV: <strong>${Number(myCounts.needScheduleConsult || 0)}</strong></span>
                    </button>
                    <button type="button" class="rbt-work-chip rbt-work-chip--ocean" data-rbt-action="jump_my_work" data-rbt-extra="consult_scheduled">
                        <span class="rbt-work-chip__dot"></span>
                        <span>Chờ TS. Hữu KQ: <strong>${Number(myCounts.needDecideConsult || 0)}</strong></span>
                    </button>
                    <button type="button" class="rbt-work-chip rbt-work-chip--green" data-rbt-action="jump_my_work" data-rbt-extra="ward_mine">
                        <span class="rbt-work-chip__dot"></span>
                        <span>Ca tôi gửi có KQ: <strong>${Number(myCounts.myCasesDecided || 0)}</strong></span>
                    </button>
                    <button type="button" class="rbt-work-chip rbt-work-chip--indigo" data-rbt-action="jump_my_work" data-rbt-extra="ward_wait">
                        <span class="rbt-work-chip__dot"></span>
                        <span>XV chờ nhập lại: <strong>${Number(myCounts.upcomingReadmit || countWait || 0)}</strong></span>
                    </button>
                </section>

                <div class="rbt-kpi-grid">
                    <div class="rbt-kpi-card rbt-kpi-card--amber" data-rbt-subtab="consult">
                        <div>
                            <div class="rbt-kpi-label">Chờ &amp; Xếp TV</div>
                            <div class="rbt-kpi-value">${countConsult}</div>
                        </div>
                        <div class="rbt-kpi-meta">Bước 1–2</div>
                    </div>
                    <div class="rbt-kpi-card rbt-kpi-card--green" data-rbt-subtab="week">
                        <div>
                            <div class="rbt-kpi-label">Đã xếp lịch mổ</div>
                            <div class="rbt-kpi-value">${countWeek}</div>
                        </div>
                        <div class="rbt-kpi-meta">Robot &amp; Nội soi</div>
                    </div>
                    <div class="rbt-kpi-card rbt-kpi-card--indigo" data-rbt-subtab="ward">
                        <div>
                            <div class="rbt-kpi-label">XV chờ giữ slot</div>
                            <div class="rbt-kpi-value">${countWait}</div>
                        </div>
                        <div class="rbt-kpi-meta">Bước 4 phòng</div>
                    </div>
                    <div class="rbt-kpi-card rbt-kpi-card--navy" data-rbt-subtab="completed">
                        <div>
                            <div class="rbt-kpi-label">Đã phẫu thuật</div>
                            <div class="rbt-kpi-value">${countCompleted}</div>
                        </div>
                        <div class="rbt-kpi-meta">Bước 5 KPI</div>
                    </div>
                </div>

                <nav class="rbt-subtabs-wrap" aria-label="Phân mục Điều phối Robot">
                    ${subtabs.map(st => `<button type="button" class="rbt-subtab ${this._subtab === st.id ? 'is-active' : ''}" data-rbt-subtab="${esc(st.id)}">
                        <span>${st.icon} ${esc(st.label)}</span>
                        ${st.count !== '' ? `<span class="rbt-subtab-badge">${st.count}</span>` : ''}
                    </button>`).join('')}
                </nav>

                ${bodyHtml}
            </div>`;
        },

        _renderActiveSubtab(filteredCases, todayIso) {
            switch (this._subtab) {
                case 'consult':
                    return this._renderConsultSubtab(filteredCases, todayIso);
                case 'week':
                    return this._renderWeekSubtab(filteredCases, todayIso);
                case 'ward':
                    return this._renderWardSubtab(filteredCases, todayIso);
                case 'declined_postponed':
                    return this._renderDeclinedSubtab(filteredCases, todayIso);
                case 'completed':
                    return this._renderCompletedSubtab(filteredCases);
                case 'config':
                    return this._renderConfigSubtab();
                default:
                    return this._renderConsultSubtab(filteredCases, todayIso);
            }
        },

        _renderSearchBarHtml() {
            return `<div class="rbt-toolbar__group rbt-desktop-only-flex">
                <input id="rbt-search-input" type="search" class="form-input rbt-search-box" placeholder="Tìm tên BN, mã RB, phòng B7xx..." value="${esc(this._searchQuery)}">
                ${this._searchQuery ? `<button type="button" class="btn btn-secondary" data-rbt-action="clear_search">Xóa lọc</button>` : ''}
            </div>`;
        },

        _renderConsultSubtab(cases, todayIso) {
            const p = this._perms();
            const needList = cases
                .filter(c => c.status === 'cho_xep_tu_van' || c.status === 'can_nhac')
                .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
            const schedList = cases
                .filter(c => c.status === 'da_xep_tu_van')
                .sort((a, b) => {
                    const da = String(a.consultDate || '9999-99-99');
                    const db = String(b.consultDate || '9999-99-99');
                    if (da !== db) return da.localeCompare(db);
                    const sa = a.consultSession === 'sang' ? 0 : 1;
                    const sb = b.consultSession === 'sang' ? 0 : 1;
                    return sa - sb;
                });

            const showNeed = this._consultFilterMode === 'all' || this._consultFilterMode === 'need';
            const showSched = this._consultFilterMode === 'all' || this._consultFilterMode === 'scheduled';

            const renderConsultCard = (c) => {
                const sm = STATUS_META[c.status] || { label: c.status, badge: 'rbt-badge--navy' };
                const code = c.robotCaseCode || c.soNV;
                const tel = cleanTelHref(c);
                const sessTxt = c.consultDate
                    ? `${c.consultSession === 'sang' ? '🌅 Sáng' : '🌇 Chiều'} ${fmtViDate(c.consultDate)} (${fmtWeekdayVi(c.consultDate)})`
                    : 'Chưa xếp ngày TV';
                const roundTag = (c.consultRound && Number(c.consultRound) > 1)
                    ? `<span class="rbt-badge rbt-badge--indigo">Lần TV #${Number(c.consultRound)}</span>`
                    : '';

                return `<article class="rbt-case-card rbt-case-card--${esc(c.status)}">
                    <div class="rbt-case-top">
                        <div>
                            <span class="rbt-case-code">${esc(code)}</span>
                            ${c.isTestSandboxCase ? `<span class="rbt-badge rbt-badge--sandbox">SANDBOX</span>` : ''}
                            <span class="rbt-badge ${sm.badge}">${esc(sm.label)}</span>
                            ${roundTag}
                            ${this._admissionSourceBadgeHtml(c)}
                        </div>
                        <span class="rbt-badge rbt-badge--navy">🏥 ${esc(roomLabel(c.wardRoom))}</span>
                    </div>
                    <div class="rbt-case-name">${esc(c.patientName)} ${c.birthYear ? `(${esc(c.birthYear)})` : ''} ${c.gender ? `· ${esc(c.gender)}` : ''}</div>
                    <div class="rbt-case-meta">
                        <div><strong>CĐ:</strong> ${esc(c.diagnosis || '—')}</div>
                        ${c.robotProcedure ? `<div><strong>Dự kiến PP:</strong> ${esc(c.robotProcedure)}</div>` : ''}
                        <div><strong>Người gửi:</strong> ${esc(c.createdByName || c.createdByUsername || '—')} · ${c.labsReadyConfirmed ? '✅ Đủ XN tiền phẫu' : '⚠️ Chưa tick XN'}</div>
                        <div><strong>Lịch TV TS. Hữu:</strong> ${esc(sessTxt)}${c.consultScheduleNote ? ` · <em>${esc(c.consultScheduleNote)}</em>` : ''}</div>
                        ${c.consultNote ? `<div><strong>Ghi chú TV:</strong> ${esc(c.consultNote)}</div>` : ''}
                    </div>
                    <div class="rbt-card-actions">
                        ${(c.status === 'cho_xep_tu_van' || c.status === 'can_nhac') && p.canScheduleConsult
                            ? `<button type="button" class="btn btn-primary rbt-btn-xs" data-rbt-action="open_schedule_consult" data-rbt-code="${esc(code)}">📅 Xếp lịch TV</button>`
                            : ''}
                        ${c.status === 'da_xep_tu_van' && p.canScheduleConsult
                            ? `<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_schedule_consult" data-rbt-code="${esc(code)}">📅 Đổi lịch TV</button>`
                            : ''}
                        ${p.canDecideConsult
                            ? `<button type="button" class="btn btn-primary rbt-btn-xs" data-rbt-action="open_decide_consult" data-rbt-code="${esc(code)}">🩺 Nhập KQ tư vấn</button>`
                            : ''}
                        ${tel ? `<a href="${esc(tel)}" class="rbt-btn-call" title="Gọi BN">📞 Gọi</a>` : ''}
                        <button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_detail" data-rbt-code="${esc(code)}">Chi tiết</button>
                        ${this._canSoftDeleteCase(c)
                            ? `<button type="button" class="btn btn-secondary rbt-btn-xs rbt-btn-danger-outline" data-rbt-action="open_confirm_delete" data-rbt-code="${esc(code)}">🗑️ Xóa</button>`
                            : ''}
                    </div>
                </article>`;
            };

            return `<div class="rbt-panel">
                <div class="rbt-toolbar">
                    <div class="rbt-toolbar__group">
                        <select id="rbt-consult-filter-mode" class="form-input">
                            <option value="all" ${this._consultFilterMode === 'all' ? 'selected' : ''}>Tất cả ca tư vấn (${needList.length + schedList.length})</option>
                            <option value="need" ${this._consultFilterMode === 'need' ? 'selected' : ''}>Chờ ĐP xếp lịch TV (${needList.length})</option>
                            <option value="scheduled" ${this._consultFilterMode === 'scheduled' ? 'selected' : ''}>Đã xếp lịch TV TS. Hữu (${schedList.length})</option>
                        </select>
                        <button type="button" class="btn btn-secondary" data-rbt-action="copy_zalo_consult">📋 Copy lịch TV Zalo</button>
                        ${p.canCreateConsult ? `<button type="button" class="btn btn-primary" data-rbt-action="open_create_consult">➕ Gửi ca tư vấn</button>` : ''}
                        ${(p.canCreateConsult && p.canAccessSandbox) ? `<button type="button" id="rbt-open-sandbox-btn" class="btn btn-secondary rbt-btn-sandbox" data-rbt-action="open_create_sandbox_consult">🧪 Ca giả lập</button>` : ''}
                        ${p.canDirectCreateCase ? `<button type="button" class="btn btn-secondary" data-rbt-action="open_create_case">⚡ Xếp thẳng ca Robot</button>` : ''}
                    </div>
                    ${this._renderSearchBarHtml()}
                </div>

                <div class="rbt-consult-split">
                    ${showSched ? `<section class="rbt-consult-col">
                        <div class="rbt-section-hdr">
                            <h3>📅 Đã xếp lịch Tư vấn — TS. BSCKII. Nguyễn Phú Hữu</h3>
                            <span class="rbt-badge rbt-badge--ocean">${schedList.length} ca</span>
                        </div>
                        ${schedList.length
                            ? `<div class="rbt-cards-stack">${schedList.map(renderConsultCard).join('')}</div>`
                            : `<div class="rbt-empty">Chưa có ca nào được xếp lịch tư vấn. Điều phối viên (BS Nguyện / BS Hoan) bấm "Xếp lịch TV" để chọn ngày &amp; buổi Sáng/Chiều.</div>`}
                    </section>` : ''}

                    ${showNeed ? `<section class="rbt-consult-col">
                        <div class="rbt-section-hdr">
                            <h3>📥 Chờ Điều phối xếp lịch TV &amp; Cân nhắc lại</h3>
                            <span class="rbt-badge rbt-badge--amber">${needList.length} ca</span>
                        </div>
                        ${needList.length
                            ? `<div class="rbt-cards-stack">${needList.map(renderConsultCard).join('')}</div>`
                            : `<div class="rbt-empty">Không có hồ sơ chờ xếp lịch tư vấn. BS khu vực bấm "➕ Gửi ca tư vấn" khi BN đủ XN tiền phẫu.</div>`}
                    </section>` : ''}
                </div>
            </div>`;
        },

        _renderWeekSubtab(cases, todayIso) {
            const p = this._perms();
            const active = cases.filter(c => {
                if (c.status !== 'da_xep_robot' && c.status !== 'da_xep_noisoi') return false;
                if (this._weekApproachFilter === 'robot' && c.status !== 'da_xep_robot') return false;
                if (this._weekApproachFilter === 'noisoi' && c.status !== 'da_xep_noisoi') return false;
                if (this._weekApproachFilter === 'wait' && c.inpatientState !== 'xuat_vien_cho') return false;
                return true;
            });

            const weekStart = this._weekStartIso || getMondayIso(todayIso);
            const weekDays = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));
            const weekEnd = weekDays[6];
            if (!this._mobileDayIso || (!weekDays.includes(this._mobileDayIso) && this._mobileDayIso !== 'all')) {
                this._mobileDayIso = weekDays.includes(todayIso) ? todayIso : weekDays[0];
            }

            const renderSchedCard = (c, compact = false) => {
                const code = c.robotCaseCode || c.soNV;
                const isRobot = c.status === 'da_xep_robot';
                const waitBadge = c.inpatientState === 'xuat_vien_cho'
                    ? `<span class="rbt-badge rbt-badge--amber">🏠 XV chờ${c.plannedReadmitDate ? ` · Nhập ${fmtViShortDate(c.plannedReadmitDate)}` : ''}</span>`
                    : (c.inpatientState === 'da_nhap_lai' ? `<span class="rbt-badge rbt-badge--green">✅ Đã nhập lại</span>` : '');
                const apBadge = c.approvalStatus
                    ? `<span class="rbt-badge rbt-badge--navy">${esc(APPROVAL_LABELS[c.approvalStatus] || c.approvalStatus)}</span>`
                    : '';
                const approachBadge = isRobot
                    ? `<span class="rbt-badge rbt-badge--green">🤖 Robot · ${esc(c.caseSlot || 'Ca ?')}</span>`
                    : `<span class="rbt-badge rbt-badge--ocean">🔬 Nội soi · ${esc(SURGERY_TYPE_LABELS[c.scheduledSurgeryType] || 'CT')}</span>`;

                return `<article class="rbt-case-card rbt-case-card--${esc(c.status)}">
                    <div class="rbt-case-top">
                        <div>
                            <span class="rbt-case-code">${esc(code)}</span>
                            ${c.isTestSandboxCase ? `<span class="rbt-badge rbt-badge--sandbox">SANDBOX</span>` : ''}
                        </div>
                        <span class="rbt-badge rbt-badge--navy">🏥 ${esc(roomLabel(c.wardRoom))}</span>
                    </div>
                    <div class="rbt-case-top" style="margin-top:4px;">
                        ${approachBadge}
                        ${waitBadge}
                    </div>
                    <div class="rbt-case-name">${esc(c.patientName)} ${c.birthYear ? `(${esc(c.birthYear)})` : ''}</div>
                    <div class="rbt-case-meta">
                        <div><strong>PTV:</strong> ${esc(this._surgeonDisplay(c))}</div>
                        <div><strong>PP:</strong> ${esc(c.robotProcedure || c.diagnosis || '—')}</div>
                        ${!compact && apBadge ? `<div>${apBadge}</div>` : ''}
                    </div>
                    <div class="rbt-card-actions">
                        <button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_detail" data-rbt-code="${esc(code)}">Chi tiết</button>
                        ${isRobot ? `<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_print_single" data-rbt-code="${esc(code)}">🖨️ In A5</button>` : ''}
                        ${p.canEditSchedule ? `<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_edit_schedule" data-rbt-code="${esc(code)}">Sửa lịch</button>` : ''}
                        ${p.canManageInpatientWait && c.inpatientState !== 'xuat_vien_cho'
                            ? `<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_discharge_wait" data-rbt-code="${esc(code)}">🏠 XV chờ</button>`
                            : ''}
                        ${p.canManageInpatientWait && c.inpatientState === 'xuat_vien_cho'
                            ? `<button type="button" class="btn btn-primary rbt-btn-xs" data-rbt-action="confirm_readmit" data-rbt-code="${esc(code)}">✅ Nhập lại</button>`
                            : ''}
                    </div>
                </article>`;
            };

            const desktopCols = weekDays.map(dayIso => {
                const dayCases = active.filter(c => c.surgeryDate === dayIso);
                const robotCount = dayCases.filter(c => c.status === 'da_xep_robot' && !c.isTestSandboxCase).length;
                const capCls = robotCount >= 3 ? 'is-full' : '';
                const slotsHtml = VALID_SLOTS.map(slotName => {
                    const slotCases = dayCases.filter(c => c.status === 'da_xep_robot' && (c.caseSlot || 'Ca 1') === slotName);
                    return `<div class="rbt-slot-section">
                        <div class="rbt-slot-heading"><span>${slotName} (${slotToStartTime(slotName)})</span><span>${slotCases.length} ca</span></div>
                        ${slotCases.map(c => renderSchedCard(c, true)).join('')}
                    </div>`;
                }).join('');
                const nsCases = dayCases.filter(c => c.status === 'da_xep_noisoi');
                const nsHtml = nsCases.length
                    ? `<div class="rbt-slot-section rbt-slot-section--ns">
                        <div class="rbt-slot-heading"><span>🔬 Chuyển mổ Nội soi</span><span>${nsCases.length} ca</span></div>
                        ${nsCases.map(c => renderSchedCard(c, true)).join('')}
                    </div>`
                    : '';
                return `<div class="rbt-day-col ${dayIso === todayIso ? 'is-today' : ''}">
                    <div class="rbt-day-head">
                        <span>${fmtWeekdayVi(dayIso)} ${fmtViShortDate(dayIso)}</span>
                        <span class="rbt-day-cap-hint ${capCls}">${robotCount}/3 Robot</span>
                    </div>
                    <div class="rbt-day-body">
                        ${slotsHtml}
                        ${nsHtml}
                    </div>
                </div>`;
            }).join('');

            const mobileDaysToShow = this._mobileWeekAllDays
                ? weekDays
                : (this._mobileDayIso === 'all' ? weekDays : [this._mobileDayIso]);

            const mobileHtml = `<div class="rbt-mobile-week rbt-mobile-only">
                <div class="rbt-mobile-week-bar">
                    <button type="button" class="btn btn-secondary rbt-mobile-week-navbtn" data-rbt-action="week_prev">‹</button>
                    <div class="rbt-week-label">${fmtViShortDate(weekStart)} – ${fmtViShortDate(weekEnd)}</div>
                    <button type="button" class="btn btn-secondary rbt-mobile-week-navbtn" data-rbt-action="week_next">›</button>
                    <button type="button" class="btn btn-secondary" data-rbt-action="toggle_mobile_week_all">${this._mobileWeekAllDays ? '1 ngày' : 'Cả tuần'}</button>
                </div>
                <div class="rbt-day-pills">
                    ${weekDays.map(d => {
                        const cnt = active.filter(c => c.surgeryDate === d).length;
                        return `<button type="button" class="rbt-day-pill ${!this._mobileWeekAllDays && this._mobileDayIso === d ? 'is-active' : ''}" data-rbt-mobile-day="${d}">
                            <span>${fmtWeekdayVi(d)} ${fmtViShortDate(d)}</span>
                            <span class="rbt-day-pill__count">${cnt}</span>
                        </button>`;
                    }).join('')}
                </div>
                ${mobileDaysToShow.map(d => {
                    const list = active.filter(c => c.surgeryDate === d);
                    return `<div class="rbt-mobile-day-group">
                        <div class="rbt-mobile-day-title">${fmtWeekdayVi(d)} · ${fmtViDate(d)} (${list.length} ca)</div>
                        ${list.length
                            ? list.map(c => `<div class="rbt-mcard">${renderSchedCard(c, false)}</div>`).join('')
                            : `<div class="rbt-empty">Chưa có ca phẫu thuật trong ngày.</div>`}
                    </div>`;
                }).join('')}
            </div>`;

            const unlinked = (this._bootstrap && Array.isArray(this._bootstrap.unlinkedFutureRobotSurgeries))
                ? this._bootstrap.unlinkedFutureRobotSurgeries
                : [];
            const unlinkedHtml = (p.canLinkExistingSurgery && unlinked.length)
                ? `<div class="rbt-unlinked-box">
                    <strong>🔗 Có ${unlinked.length} ca Robot trên Lịch mổ tuần chưa liên kết hồ sơ Điều phối Robot:</strong>
                    <div class="rbt-unlinked-list">
                        ${unlinked.map(s => `<div class="rbt-unlinked-item">
                            <span>${fmtViDate(s.date)} · <strong>${esc(s.patientName)}</strong> (${esc(s.mainSurgeonName)})</span>
                            <button type="button" class="btn btn-primary rbt-btn-xs" data-rbt-action="open_link_surgery" data-rbt-extra="${s.id}">Liên kết ngay</button>
                        </div>`).join('')}
                    </div>
                </div>`
                : '';

            return `<div class="rbt-panel">
                <div class="rbt-toolbar">
                    <div class="rbt-toolbar__group">
                        <button type="button" class="btn btn-secondary rbt-desktop-only-flex" data-rbt-action="week_prev">‹ Tuần trước</button>
                        <button type="button" class="btn btn-secondary" data-rbt-action="week_today">Tuần này</button>
                        <button type="button" class="btn btn-secondary rbt-desktop-only-flex" data-rbt-action="week_next">Tuần sau ›</button>
                        <span class="rbt-week-label rbt-desktop-only-flex">${fmtViDate(weekStart)} – ${fmtViDate(weekEnd)}</span>
                        <select id="rbt-week-approach-filter" class="form-input">
                            <option value="all" ${this._weekApproachFilter === 'all' ? 'selected' : ''}>Tất cả (${active.length})</option>
                            <option value="robot" ${this._weekApproachFilter === 'robot' ? 'selected' : ''}>🤖 Chỉ mổ Robot</option>
                            <option value="noisoi" ${this._weekApproachFilter === 'noisoi' ? 'selected' : ''}>🔬 Chuyển mổ Nội soi</option>
                            <option value="wait" ${this._weekApproachFilter === 'wait' ? 'selected' : ''}>🏠 Đang XV chờ giữ slot</option>
                        </select>
                        <button type="button" class="btn btn-secondary" data-rbt-action="open_print_modal">🖨️ In P.CTXH</button>
                    </div>
                    ${this._renderSearchBarHtml()}
                </div>
                ${unlinkedHtml}
                <div class="rbt-week-grid rbt-desktop-only-grid">${desktopCols}</div>
                ${mobileHtml}
            </div>`;
        },

        _renderWardSubtab(cases, todayIso) {
            const p = this._perms();
            const me = this._currentUsername();
            const mySid = Number(p.staffId || 0);
            const relevant = cases.filter(c => c.status !== 'da_xoa' && c.status !== 'da_mo');

            const filtered = relevant.filter(c => {
                if (this._wardRoomFilter !== 'all' && (c.wardRoom || '') !== this._wardRoomFilter) return false;
                if (this._wardQuickFilter === 'xuat_vien_cho' && c.inpatientState !== 'xuat_vien_cho') return false;
                if (this._wardQuickFilter === 'decided' && !['da_xep_robot', 'da_xep_noisoi', 'khong_dong_y_mo', 'can_nhac'].includes(c.status)) return false;
                if (this._wardQuickFilter === 'mine') {
                    const isMine = (c.createdByUsername || '').toLowerCase() === me || (mySid > 0 && Number(c.mainSurgeonId) === mySid);
                    if (!isMine) return false;
                }
                return true;
            }).sort((a, b) => {
                const wA = a.inpatientState === 'xuat_vien_cho' ? 0 : 1;
                const wB = b.inpatientState === 'xuat_vien_cho' ? 0 : 1;
                if (wA !== wB) return wA - wB;
                return String(a.surgeryDate || '9999-99-99').localeCompare(String(b.surgeryDate || '9999-99-99'));
            });

            const rowsHtml = filtered.map(c => {
                const code = c.robotCaseCode || c.soNV;
                const sm = STATUS_META[c.status] || { label: c.status, badge: 'rbt-badge--navy' };
                const isSched = c.status === 'da_xep_robot' || c.status === 'da_xep_noisoi';
                const waitDays = (c.inpatientState === 'xuat_vien_cho' && c.plannedReadmitDate)
                    ? daysBetweenIso(todayIso, c.plannedReadmitDate)
                    : null;
                const dueTag = (waitDays !== null && waitDays <= 2)
                    ? `<span class="rbt-badge rbt-badge--red">${waitDays < 0 ? 'Quá hạn nhập lại' : waitDays === 0 ? 'Hôm nay nhập lại' : `Còn ${waitDays} ngày nhập lại`}</span>`
                    : '';
                const outcomeSummary = c.status === 'da_xep_robot'
                    ? `🤖 Mổ Robot ${fmtViDate(c.surgeryDate)} (${c.caseSlot || ''})`
                    : c.status === 'da_xep_noisoi'
                        ? `🔬 Chuyển mổ Nội soi ${fmtViDate(c.surgeryDate)} · PTV: ${this._surgeonDisplay(c)}`
                        : c.status === 'khong_dong_y_mo'
                            ? `❌ Không đồng ý mổ (${this._refusalReasons()[c.refusalReason] || ''})`
                            : c.status === 'da_xep_tu_van'
                                ? `📅 Chờ TV ${c.consultSession === 'sang' ? 'Sáng' : 'Chiều'} ${fmtViDate(c.consultDate)}`
                                : sm.label;

                return `<article class="rbt-ward-card rbt-case-card rbt-case-card--${esc(c.status)}">
                    <div class="rbt-case-top">
                        <div>
                            <span class="rbt-case-code">${esc(code)}</span>
                            <span class="rbt-badge rbt-badge--navy">🏥 ${esc(roomLabel(c.wardRoom))}</span>
                            ${this._admissionSourceBadgeHtml(c)}
                            <span class="rbt-badge ${sm.badge}">${esc(sm.label)}</span>
                            ${c.inpatientState === 'xuat_vien_cho' ? `<span class="rbt-badge rbt-badge--amber">🏠 XV chờ · Nhập lại ${fmtViDate(c.plannedReadmitDate)}</span>` : ''}
                            ${c.inpatientState === 'da_nhap_lai' ? `<span class="rbt-badge rbt-badge--green">✅ Đã nhập lại</span>` : ''}
                            ${dueTag}
                        </div>
                    </div>
                    <div class="rbt-case-name">${esc(c.patientName)} ${c.birthYear ? `(${esc(c.birthYear)})` : ''}</div>
                    <div class="rbt-case-meta">
                        <div><strong>Kết quả tư vấn TS. Hữu:</strong> ${esc(outcomeSummary)}</div>
                        <div><strong>CĐ / PP:</strong> ${esc(c.diagnosis || '—')} ${c.robotProcedure ? `· ${esc(c.robotProcedure)}` : ''}</div>
                        <div><strong>BS gửi:</strong> ${esc(c.createdByName || c.createdByUsername || '—')}</div>
                        ${c.inpatientState === 'xuat_vien_cho' && c.dischargeReason ? `<div><strong>Lý do XV chờ:</strong> ${esc(c.dischargeReason)}</div>` : ''}
                    </div>
                    <div class="rbt-card-actions">
                        <button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_detail" data-rbt-code="${esc(code)}">Chi tiết</button>
                        ${c.status === 'da_xep_robot' ? `<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_print_single" data-rbt-code="${esc(code)}">🖨️ In A5 CTXH</button>` : ''}
                        ${isSched && p.canManageInpatientWait && c.inpatientState !== 'xuat_vien_cho'
                            ? `<button type="button" class="btn btn-primary rbt-btn-xs" data-rbt-action="open_discharge_wait" data-rbt-code="${esc(code)}">🏠 Cho XV chờ &amp; Hẹn nhập lại</button>`
                            : ''}
                        ${isSched && p.canManageInpatientWait && c.inpatientState === 'xuat_vien_cho'
                            ? `<button type="button" class="btn btn-primary rbt-btn-xs" data-rbt-action="confirm_readmit" data-rbt-code="${esc(code)}">✅ Xác nhận đã nhập lại</button>`
                            : ''}
                    </div>
                </article>`;
            }).join('');

            return `<div class="rbt-panel">
                <div class="rbt-toolbar">
                    <div class="rbt-toolbar__group">
                        <select id="rbt-ward-room-filter" class="form-input">
                            <option value="all" ${this._wardRoomFilter === 'all' ? 'selected' : ''}>Tất cả phòng (${relevant.length})</option>
                            ${this._wardRooms().map(rm => `<option value="${esc(rm)}" ${this._wardRoomFilter === rm ? 'selected' : ''}>${esc(roomLabel(rm))}</option>`).join('')}
                        </select>
                        <select id="rbt-ward-quick-filter" class="form-input">
                            <option value="all" ${this._wardQuickFilter === 'all' ? 'selected' : ''}>Tất cả trạng thái</option>
                            <option value="decided" ${this._wardQuickFilter === 'decided' ? 'selected' : ''}>Đã có KQ tư vấn TS. Hữu</option>
                            <option value="xuat_vien_cho" ${this._wardQuickFilter === 'xuat_vien_cho' ? 'selected' : ''}>Đang XV chờ &amp; giữ slot</option>
                            <option value="mine" ${this._wardQuickFilter === 'mine' ? 'selected' : ''}>Ca tôi gửi / phụ trách</option>
                        </select>
                        ${p.canCreateConsult ? `<button type="button" class="btn btn-primary" data-rbt-action="open_create_consult">➕ Gửi ca tư vấn mới</button>` : ''}
                    </div>
                    ${this._renderSearchBarHtml()}
                </div>
                ${filtered.length
                    ? `<div class="rbt-ward-grid">${rowsHtml}</div>`
                    : `<div class="rbt-empty">Không có hồ sơ phù hợp bộ lọc phòng/trạng thái.</div>`}
            </div>`;
        },

        _renderDeclinedSubtab(cases, todayIso) {
            const p = this._perms();
            const refusedMap = this._refusalReasons();
            const postMap = this._postponeReasons();
            const archiveDays = Number(this._cfg().trashAutoArchiveDays || 14);

            const filtered = cases.filter(c => {
                if (!['khong_dong_y_mo', 'hoan_mo', 'da_xoa'].includes(c.status)) return false;
                if (this._declinedGroupFilter !== 'all' && c.status !== this._declinedGroupFilter) return false;
                if (this._postponeFilterReason !== 'all' && c.status === 'hoan_mo' && c.postponeReasonCode !== this._postponeFilterReason) return false;
                return true;
            });

            const cardsHtml = filtered.map(c => {
                const code = c.robotCaseCode || c.soNV;
                const sm = STATUS_META[c.status] || { label: c.status, badge: 'rbt-badge--red' };
                let detailLine = '';
                if (c.status === 'khong_dong_y_mo') {
                    detailLine = `Lý do: ${refusedMap[c.refusalReason] || 'Chưa ghi rõ'}${c.consultNote ? ` · ${c.consultNote}` : ''}`;
                } else if (c.status === 'hoan_mo') {
                    const snap = c.previousScheduleSnapshot || {};
                    detailLine = `Lý do hoãn: ${c.postponeReasonLabel || postMap[c.postponeReasonCode] || '—'}${c.postponeReasonNote ? ` (${c.postponeReasonNote})` : ''}${snap.surgeryDate ? ` · Lịch cũ: ${fmtViDate(snap.surgeryDate)} ${snap.caseSlot || ''}` : ''}`;
                } else if (c.status === 'da_xoa') {
                    const delDays = c.deletedAt ? Math.max(0, archiveDays - (daysBetweenIso(String(c.deletedAt).slice(0, 10), todayIso) || 0)) : archiveDays;
                    detailLine = `${c.deleteReason || 'Đã đưa vào Thùng rác'} · Tự lưu trữ ẩn sau ~${delDays} ngày`;
                }

                return `<article class="rbt-case-card rbt-case-card--${esc(c.status)}">
                    <div class="rbt-case-top">
                        <div>
                            <span class="rbt-case-code">${esc(code)}</span>
                            <span class="rbt-badge ${sm.badge}">${esc(sm.label)}</span>
                            <span class="rbt-badge rbt-badge--navy">🏥 ${esc(roomLabel(c.wardRoom))}</span>
                        </div>
                    </div>
                    <div class="rbt-case-name">${esc(c.patientName)} ${c.birthYear ? `(${esc(c.birthYear)})` : ''}</div>
                    <div class="rbt-case-meta">
                        <div><strong>CĐ:</strong> ${esc(c.diagnosis || '—')}</div>
                        <div>${esc(detailLine)}</div>
                    </div>
                    <div class="rbt-card-actions">
                        <button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_detail" data-rbt-code="${esc(code)}">Chi tiết</button>
                        ${(c.status === 'khong_dong_y_mo' || c.status === 'hoan_mo') && (p.canScheduleConsult || p.canDecideConsult)
                            ? `<button type="button" class="btn btn-primary rbt-btn-xs" data-rbt-action="reopen_consult" data-rbt-code="${esc(code)}">🔄 Mở lại tư vấn</button>`
                            : ''}
                        ${c.status !== 'da_xoa' && p.canSoftDelete
                            ? `<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="soft_delete" data-rbt-code="${esc(code)}">🗑️ Thùng rác</button>`
                            : ''}
                        ${c.status === 'da_xoa' && p.canSoftDelete
                            ? `<button type="button" class="btn btn-primary rbt-btn-xs" data-rbt-action="restore_trash" data-rbt-code="${esc(code)}">♻️ Khôi phục</button>`
                            : ''}
                        ${c.status === 'da_xoa' && p.canArchiveDeleted
                            ? `<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="archive_delete" data-rbt-code="${esc(code)}">📦 Lưu trữ ẩn</button>`
                            : ''}
                    </div>
                </article>`;
            }).join('');

            return `<div class="rbt-panel">
                <div class="rbt-toolbar">
                    <div class="rbt-toolbar__group">
                        <select id="rbt-declined-group-filter" class="form-input">
                            <option value="all" ${this._declinedGroupFilter === 'all' ? 'selected' : ''}>Tất cả (${filtered.length})</option>
                            <option value="khong_dong_y_mo" ${this._declinedGroupFilter === 'khong_dong_y_mo' ? 'selected' : ''}>❌ Không đồng ý mổ</option>
                            <option value="hoan_mo" ${this._declinedGroupFilter === 'hoan_mo' ? 'selected' : ''}>⏸️ Hoãn mổ</option>
                            <option value="da_xoa" ${this._declinedGroupFilter === 'da_xoa' ? 'selected' : ''}>🗑️ Thùng rác</option>
                        </select>
                        <select id="rbt-postpone-filter" class="form-input">
                            <option value="all" ${this._postponeFilterReason === 'all' ? 'selected' : ''}>Mọi lý do hoãn mổ</option>
                            ${Object.entries(postMap).map(([k, v]) => `<option value="${esc(k)}" ${this._postponeFilterReason === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}
                        </select>
                    </div>
                    ${this._renderSearchBarHtml()}
                </div>
                ${filtered.length
                    ? `<div class="rbt-cards-stack">${cardsHtml}</div>`
                    : `<div class="rbt-empty">Không có hồ sơ nào trong nhóm Không đồng ý mổ / Hoãn mổ / Thùng rác.</div>`}
            </div>`;
        },

        _renderCompletedSubtab(cases) {
            const p = this._perms();
            const nonTrash = cases.filter(c => c.status !== 'da_xoa' && !c.isTestSandboxCase);
            const yearsSet = new Set();
            nonTrash.forEach(c => {
                const y = String(c.surgeryDate || c.consultDate || c.createdAt || '').slice(0, 4);
                if (/^\d{4}$/.test(y)) yearsSet.add(y);
            });
            const years = Array.from(yearsSet).sort().reverse();

            const matchStats = (c) => {
                const refDate = String(c.surgeryDate || c.consultDate || c.createdAt || '');
                if (this._statsYear !== 'all' && !refDate.startsWith(this._statsYear)) return false;
                if (this._statsMonth !== 'all' && refDate.slice(5, 7) !== this._statsMonth) return false;
                if (this._statsSurgeon !== 'all' && String(c.mainSurgeonId) !== String(this._statsSurgeon)) return false;
                return true;
            };

            const scoped = nonTrash.filter(matchStats);
            const decidedPool = scoped.filter(c => ['robot', 'noisoi', 'khong_mo'].includes(c.consultOutcome));
            const decidedRobot = decidedPool.filter(c => c.consultOutcome === 'robot').length;
            const decidedNs = decidedPool.filter(c => c.consultOutcome === 'noisoi').length;
            const decidedNo = decidedPool.filter(c => c.consultOutcome === 'khong_mo').length;
            const convRobotPct = decidedPool.length ? Math.round((decidedRobot / decidedPool.length) * 100) : 0;

            const doneList = cases
                .filter(c => c.status === 'da_mo' && matchStats(c))
                .sort((a, b) => String(b.surgeryDate || '').localeCompare(String(a.surgeryDate || '')));
            const visibleDone = doneList.slice(0, this._completedVisibleLimit);

            return `<div class="rbt-panel">
                <div class="rbt-toolbar">
                    <div class="rbt-toolbar__group">
                        <select id="rbt-stats-year" class="form-input">
                            <option value="all" ${this._statsYear === 'all' ? 'selected' : ''}>Mọi năm</option>
                            ${years.map(y => `<option value="${y}" ${this._statsYear === y ? 'selected' : ''}>Năm ${y}</option>`).join('')}
                        </select>
                        <select id="rbt-stats-month" class="form-input">
                            <option value="all" ${this._statsMonth === 'all' ? 'selected' : ''}>Cả năm</option>
                            ${Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => `<option value="${m}" ${this._statsMonth === m ? 'selected' : ''}>Tháng ${m}</option>`).join('')}
                        </select>
                        <select id="rbt-stats-surgeon" class="form-input">
                            <option value="all" ${this._statsSurgeon === 'all' ? 'selected' : ''}>Tất cả PTV</option>
                            ${this._surgeons().map(s => `<option value="${s.id}" ${String(this._statsSurgeon) === String(s.id) ? 'selected' : ''}>${esc([s.title, s.name].filter(Boolean).join(' '))}</option>`).join('')}
                        </select>
                    </div>
                    ${this._renderSearchBarHtml()}
                </div>

                <div class="rbt-stats-summary">
                    <div class="rbt-stat-pill"><strong>${scoped.length}</strong><span>Tổng ca tiếp nhận</span></div>
                    <div class="rbt-stat-pill rbt-stat-pill--green"><strong>${decidedRobot} (${convRobotPct}%)</strong><span>Chốt Mổ Robot</span></div>
                    <div class="rbt-stat-pill rbt-stat-pill--ocean"><strong>${decidedNs}</strong><span>Chuyển Nội soi</span></div>
                    <div class="rbt-stat-pill rbt-stat-pill--red"><strong>${decidedNo}</strong><span>Không đồng ý mổ</span></div>
                    <div class="rbt-stat-pill rbt-stat-pill--navy"><strong>${doneList.length}</strong><span>Đã phẫu thuật</span></div>
                </div>

                <div class="rbt-table-wrap rbt-desktop-only">
                    <table class="rbt-table">
                        <thead>
                            <tr>
                                <th>Mã</th>
                                <th>Ngày mổ</th>
                                <th>Bệnh nhân</th>
                                <th>Phòng</th>
                                <th>Phương pháp</th>
                                <th>PTV chính</th>
                                <th>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${visibleDone.length ? visibleDone.map(c => {
                                const code = c.robotCaseCode || c.soNV;
                                return `<tr>
                                    <td class="rbt-col-code">${esc(code)}</td>
                                    <td class="rbt-col-date">${fmtViDate(c.surgeryDate)}<br><small>${esc(c.caseSlot || '—')}</small></td>
                                    <td class="rbt-col-patient">${esc(c.patientName)} ${c.birthYear ? `(${esc(c.birthYear)})` : ''}</td>
                                    <td>${esc(roomLabel(c.wardRoom))}</td>
                                    <td>${esc(c.robotProcedure || c.diagnosis || '—')}</td>
                                    <td class="rbt-col-surgeon">${esc(this._surgeonDisplay(c))}</td>
                                    <td class="rbt-col-actions">
                                        <div class="rbt-card-actions">
                                            <button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_detail" data-rbt-code="${esc(code)}">Chi tiết</button>
                                            ${p.canManageRobot ? `<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_postpone" data-rbt-code="${esc(code)}">Hoãn hậu kiểm</button>` : ''}
                                        </div>
                                    </td>
                                </tr>`;
                            }).join('') : `<tr><td colspan="7" class="rbt-empty">Chưa có ca phẫu thuật hoàn tất.</td></tr>`}
                        </tbody>
                    </table>
                </div>

                <div class="rbt-mobile-only">
                    ${visibleDone.length
                        ? `<div class="rbt-cards-stack">${visibleDone.map(c => {
                            const code = c.robotCaseCode || c.soNV;
                            return `<article class="rbt-case-card rbt-case-card--da_mo">
                                <div class="rbt-case-top">
                                    <span class="rbt-case-code">${esc(code)}</span>
                                    <span class="rbt-badge rbt-badge--navy">${fmtViDate(c.surgeryDate)} · ${esc(c.caseSlot || '')}</span>
                                </div>
                                <div class="rbt-case-name">${esc(c.patientName)}</div>
                                <div class="rbt-case-meta">${esc(c.robotProcedure || c.diagnosis || '')} · ${esc(this._surgeonDisplay(c))}</div>
                                <div class="rbt-card-actions">
                                    <button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_detail" data-rbt-code="${esc(code)}">Chi tiết</button>
                                </div>
                            </article>`;
                        }).join('')}</div>`
                        : `<div class="rbt-empty">Chưa có ca phẫu thuật hoàn tất.</div>`}
                </div>

                ${doneList.length > visibleDone.length
                    ? `<div style="margin-top:12px;"><button type="button" class="btn btn-secondary rbt-mobile-load-more" data-rbt-action="load_more_completed">Xem thêm (${doneList.length - visibleDone.length} ca nữa)</button></div>`
                    : ''}
            </div>`;
        },

        _renderConfigSubtab() {
            const p = this._perms();
            if (!p.canConfigureCoordinators) {
                return `<div class="rbt-panel"><div class="rbt-empty">Chỉ Ban Chủ nhiệm khoa mới có quyền cấu hình Điều phối viên.</div></div>`;
            }
            const cfg = this._cfg();
            const coords = new Set((cfg.coordinators || []).map(x => String(x).toLowerCase()));
            const accounts = (this._bootstrap && Array.isArray(this._bootstrap.staffAccounts)) ? this._bootstrap.staffAccounts : [];

            return `<div class="rbt-panel">
                <h3>⚙️ Cấu hình Điều phối viên &amp; In P.CTXH</h3>
                <p class="rbt-header__sub" style="color:var(--text-secondary,#475569);margin-bottom:14px;">Chọn các tài khoản được phân quyền xếp lịch tư vấn (Bước 2) &amp; điều phối lịch mổ Robot (mặc định: BS Võ Chí Nguyện, BS Lê Văn Hoan).</p>
                <div class="rbt-form-grid">
                    <div class="rbt-form-grid--full">
                        <label class="form-label">Danh sách Điều phối viên Robot</label>
                        <div class="rbt-coord-list">
                            ${accounts.map(acc => {
                                const uname = String(acc.username || '').toLowerCase();
                                return `<label class="rbt-coord-check">
                                    <input type="checkbox" class="rbt-cfg-coord" value="${esc(uname)}" ${coords.has(uname) ? 'checked' : ''}>
                                    <span><strong>${esc([acc.title, acc.name].filter(Boolean).join(' ') || uname)}</strong> <small>(${esc(uname)})</small></span>
                                </label>`;
                            }).join('')}
                        </div>
                    </div>
                    <div>
                        <label class="form-label" for="rbt-cfg-scheduler">Người lập phiếu mặc định (P.CTXH A5)</label>
                        <input id="rbt-cfg-scheduler" type="text" class="form-input" value="${esc(cfg.defaultSchedulerName || 'BSCKII. Võ Chí Nguyện')}">
                    </div>
                    <div>
                        <label class="form-label" for="rbt-cfg-lookback">Giới hạn ngày hoãn hậu kiểm (1–30)</label>
                        <input id="rbt-cfg-lookback" type="number" min="1" max="30" class="form-input" value="${Number(cfg.postponeLookbackDays || 7)}">
                    </div>
                    <div>
                        <label class="form-label" for="rbt-cfg-archive">Tự lưu trữ ẩn Thùng rác sau (1–90 ngày)</label>
                        <input id="rbt-cfg-archive" type="number" min="1" max="90" class="form-input" value="${Number(cfg.trashAutoArchiveDays || 14)}">
                    </div>
                </div>
                <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">
                    <button type="button" class="btn btn-primary" data-rbt-action="save_config">Lưu cấu hình</button>
                </div>
            </div>`;
        },

        _dirtyBannerHtml() {
            return `<div id="rbt-dirty-guard-banner" class="rbt-dirty-banner" hidden>⚠️ Bạn đang có dữ liệu chưa lưu. Hãy bấm <strong>Lưu</strong> hoặc bấm Đóng/Hủy thêm một lần nữa để thoát.</div>`;
        },

        _renderSlotPickerHtml(dateIso, selectedSlot, excludeCode = '') {
            const dIso = String(dateIso || '').trim();
            const occ = { 'Ca 1': [], 'Ca 2': [], 'Ca 3': [] };
            let totalDay = 0;
            this._cases().forEach(c => {
                if ((c.robotCaseCode || c.soNV) === excludeCode) return;
                if (c.isTestSandboxCase) return;
                if (c.status !== 'da_xep_robot') return;
                if (c.surgeryDate !== dIso) return;
                const sl = VALID_SLOTS.includes(c.caseSlot) ? c.caseSlot : 'Ca 1';
                occ[sl].push(c.patientName || c.robotCaseCode);
                totalDay += 1;
            });
            const sel = VALID_SLOTS.includes(selectedSlot) ? selectedSlot : 'Ca 1';

            return `<input type="hidden" id="rbt-inp-slot" value="${esc(sel)}">
            <div class="rbt-day-cap-hint ${totalDay >= 3 ? 'is-full' : ''}" style="margin-bottom:6px;">
                Công suất Robot ngày ${dIso ? fmtViDate(dIso) : 'đã chọn'}: <strong>${totalDay}/3 ca</strong> ${totalDay >= 3 ? '⚠️ ĐÃ ĐỦ 3 CA/NGÀY' : ''}
            </div>
            <div class="rbt-slot-pills">
                ${VALID_SLOTS.map(slot => {
                    const busy = occ[slot].length > 0;
                    return `<button type="button" class="rbt-slot-pill ${sel === slot ? 'is-selected' : ''} ${busy ? 'is-busy' : ''}" data-rbt-pick-slot="${slot}">
                        <strong>${slot} (${slotToStartTime(slot)})</strong>
                        <span class="rbt-slot-pill__sub">${busy ? `Đã có: ${esc(occ[slot][0])}` : 'Còn trống'}</span>
                    </button>`;
                }).join('')}
            </div>`;
        },

        _renderWardRoomPickerHtml(selectId, selectedRoom = '') {
            const rooms = this._wardRooms();
            const sel = String(selectedRoom || '').trim();
            return `<div class="rbt-room-picker">
                <div class="rbt-room-chips" role="group" aria-label="Chọn phòng bệnh">
                    ${rooms.map(rm => `<button type="button" class="rbt-room-chip ${sel === rm ? 'is-selected' : ''}" data-rbt-pick-room="${esc(rm)}" data-rbt-target="${esc(selectId)}">${esc(rm === 'ngoai_tru' ? 'Ngoại trú' : rm)}</button>`).join('')}
                </div>
                <select id="${esc(selectId)}" class="form-input rbt-sr-select" tabindex="-1" aria-label="Phòng bệnh">
                    <option value="">-- Chọn phòng bệnh (B705–B719) hoặc Ngoại trú --</option>
                    ${rooms.map(rm => `<option value="${esc(rm)}" ${sel === rm ? 'selected' : ''}>${esc(roomLabel(rm))}</option>`).join('')}
                </select>
            </div>`;
        },

        _renderSegmentedSelectHtml(selectId, options, selectedVal = '', extraCls = '') {
            const sel = String(selectedVal == null ? '' : selectedVal);
            return `<div class="rbt-seg-wrap">
                <div class="rbt-seg-group ${extraCls}" role="group">
                    ${options.map(opt => `<button type="button" class="rbt-seg-btn ${sel === String(opt.value) ? 'is-selected' : ''}" data-rbt-pick-seg="${esc(opt.value)}" data-rbt-target="${esc(selectId)}">${opt.icon ? `<span>${esc(opt.icon)}</span>` : ''}<span>${esc(opt.label)}</span></button>`).join('')}
                </div>
                <select id="${esc(selectId)}" class="form-input rbt-sr-select" tabindex="-1">
                    ${options.map(opt => `<option value="${esc(opt.value)}" ${sel === String(opt.value) ? 'selected' : ''}>${esc(opt.fullLabel || opt.label)}</option>`).join('')}
                </select>
            </div>`;
        },

        _renderSurgeonQuickChipsHtml(selectId, surgeons, selectedId) {
            const selStr = String(selectedId || '');
            const cat = this._admittingDoctors().internal || [];
            const shortById = new Map(cat.map(d => [String(d.id), d.shortName]));
            return `<div class="rbt-surgeon-chips">
                ${surgeons.slice(0, 8).map(s => {
                    const idStr = String(s.id);
                    const parts = String(s.name || '').trim().split(/\s+/);
                    const lbl = shortById.get(idStr) || (Number(s.id) === 1 ? 'TS. Hữu' : `BS. ${parts[parts.length - 1] || s.name}`);
                    return `<button type="button" class="rbt-quick-chip ${selStr === idStr ? 'is-selected' : ''}" data-rbt-pick-seg="${esc(idStr)}" data-rbt-target="${esc(selectId)}">${esc(lbl)}</button>`;
                }).join('')}
            </div>`;
        },

        _updateAdmittingSelectedBadge(prefix) {
            const host = document.getElementById(`${prefix}-adm-doc-selected`);
            if (!host) return;
            const dName = (document.getElementById(`${prefix}-adm-doc-name`)?.value || '').trim();
            const dType = (document.getElementById(`${prefix}-adm-doc-type`)?.value || '').trim();
            if (!dName) {
                host.innerHTML = `<span class="rbt-adm-placeholder">Chọn từ danh sách bên dưới hoặc nhập tay</span>`;
                return;
            }
            const tag = dType === 'external' ? 'BS ngoài khoa' : (dType === 'manual' ? 'Nhập tay' : 'Khoa PTĐTT');
            host.innerHTML = `<span class="rbt-adm-selected-pill">✓ <strong>${esc(dName)}</strong> <small>(${tag})</small> <button type="button" class="rbt-adm-clear-btn" data-rbt-clear-adm-doc="${esc(prefix)}" aria-label="Bỏ chọn bác sĩ">&times;</button></span>`;
        },

        _setAdmissionSourceState(prefix, state = {}) {
            const src = state.source || '';
            const docType = src === 'phong_kham' ? (state.docType || '') : '';
            const docId = (src === 'phong_kham' && state.docId != null) ? String(state.docId) : '';
            const docName = src === 'phong_kham' ? (state.docName || '') : '';
            const tab = state.tab || (docType === 'external' ? 'external' : (docType === 'manual' ? 'manual' : 'internal'));

            const setH = (suffix, v) => {
                const el = document.getElementById(`${prefix}-${suffix}`);
                if (el) el.value = v;
            };
            setH('adm-source', src);
            setH('adm-doc-type', docType);
            setH('adm-doc-id', docId);
            setH('adm-doc-name', docName);
            setH('adm-doc-tab', tab);

            document.querySelectorAll(`[data-rbt-pick-source][data-rbt-prefix="${prefix}"]`).forEach(btn => {
                btn.classList.toggle('is-selected', btn.dataset.rbtPickSource === src);
            });
            const srcWrap = document.getElementById(`${prefix}-adm-source-wrap`);
            if (srcWrap) srcWrap.classList.remove('rbt-field-invalid');

            const docPanel = document.getElementById(`${prefix}-adm-doc-panel`);
            if (docPanel) docPanel.hidden = (src !== 'phong_kham');

            if (src === 'phong_kham') {
                this._refreshAdmittingDoctorPicker(prefix);
            }
        },

        _refreshAdmittingDoctorPicker(prefix) {
            const { internal, external } = this._admittingDoctors();
            const tab = document.getElementById(`${prefix}-adm-doc-tab`)?.value || 'internal';
            const docType = document.getElementById(`${prefix}-adm-doc-type`)?.value || '';
            const docId = document.getElementById(`${prefix}-adm-doc-id`)?.value || '';
            const docName = document.getElementById(`${prefix}-adm-doc-name`)?.value || '';
            const searchInp = document.getElementById(`${prefix}-adm-doc-search`);
            const rawSearch = (searchInp && searchInp.value ? searchInp.value : '').trim();
            const q = foldVi(rawSearch);

            document.querySelectorAll(`[data-rbt-adm-tab][data-rbt-prefix="${prefix}"]`).forEach(btn => {
                btn.classList.toggle('is-selected', btn.dataset.rbtAdmTab === tab);
            });

            const manWrap = document.getElementById(`${prefix}-adm-doc-manual-wrap`);
            const manInp = document.getElementById(`${prefix}-adm-doc-manual`);
            if (manWrap) manWrap.hidden = (tab !== 'manual');
            if (manInp && docType === 'manual' && docName && manInp.value !== docName) {
                manInp.value = docName;
            }

            this._updateAdmittingSelectedBadge(prefix);

            const chipsHost = document.getElementById(`${prefix}-adm-doc-chips`);
            if (!chipsHost) return;

            let htmlParts = [];
            const renderIntChip = (d) => {
                const active = docType === 'staff' && String(docId) === String(d.id);
                return `<button type="button" class="rbt-doc-chip ${active ? 'is-selected' : ''}" data-rbt-pick-adm-doc="staff" data-rbt-doc-id="${d.id}" data-rbt-doc-name="${esc(d.fullName || d.name)}" data-rbt-prefix="${esc(prefix)}" title="${esc(d.fullName || d.name)}">${esc(d.shortName || d.name)}</button>`;
            };
            const renderExtChip = (d) => {
                const active = docType === 'external' && String(docId) === String(d.id);
                const deptTag = d.department ? ` <small class="rbt-doc-chip__dept">· ${esc(d.department)}</small>` : '';
                return `<button type="button" class="rbt-doc-chip ${active ? 'is-selected' : ''}" data-rbt-pick-adm-doc="external" data-rbt-doc-id="${d.id}" data-rbt-doc-name="${esc(d.fullName || d.name)}" data-rbt-prefix="${esc(prefix)}"><span>${esc(d.fullName || d.name)}</span>${deptTag}</button>`;
            };

            if (q) {
                const mInt = internal.filter(d => foldVi(`${d.fullName} ${d.shortName} ${d.name} ${d.role}`).includes(q));
                const mExt = external.filter(d => foldVi(`${d.fullName} ${d.name} ${d.department} ${d.position}`).includes(q));
                mInt.forEach(d => htmlParts.push(renderIntChip(d)));
                mExt.forEach(d => htmlParts.push(renderExtChip(d)));
                const exactHit = [...mInt, ...mExt].some(d => foldVi(d.fullName) === q || foldVi(d.name) === q);
                if (!exactHit) {
                    htmlParts.push(`<button type="button" class="rbt-doc-chip rbt-doc-chip--manual" data-rbt-use-manual-query="${esc(prefix)}">✍️ Dùng tên nhập tay "${esc(rawSearch)}"</button>`);
                }
            } else if (tab === 'internal') {
                internal.forEach(d => htmlParts.push(renderIntChip(d)));
                htmlParts.push(`<button type="button" class="rbt-doc-chip rbt-doc-chip--manual" data-rbt-adm-tab="manual" data-rbt-prefix="${esc(prefix)}">✍️ Nhập tay BS khác</button>`);
            } else if (tab === 'external') {
                external.forEach(d => htmlParts.push(renderExtChip(d)));
                htmlParts.push(`<button type="button" class="rbt-doc-chip rbt-doc-chip--manual" data-rbt-adm-tab="manual" data-rbt-prefix="${esc(prefix)}">✍️ Nhập tay BS khác</button>`);
            } else {
                htmlParts.push(`<span class="rbt-adm-manual-hint">Nhập tên bác sĩ cho nhập ở ô bên dưới rồi lưu hồ sơ.</span>`);
            }
            chipsHost.innerHTML = htmlParts.join('');
        },

        _renderAdmissionSourcePickerHtml(prefix, state = {}) {
            const { internal, external } = this._admittingDoctors();
            const src = state.source || '';
            const docType = src === 'phong_kham' ? (state.docType || '') : '';
            const docId = (src === 'phong_kham' && state.docId != null) ? String(state.docId) : '';
            const docName = src === 'phong_kham' ? (state.docName || '') : '';
            const tab = state.tab || (docType === 'external' ? 'external' : (docType === 'manual' ? 'manual' : 'internal'));

            return `<div id="${esc(prefix)}-adm-source-wrap" class="rbt-adm-wrap">
                <input type="hidden" id="${esc(prefix)}-adm-source" value="${esc(src)}">
                <input type="hidden" id="${esc(prefix)}-adm-doc-type" value="${esc(docType)}">
                <input type="hidden" id="${esc(prefix)}-adm-doc-id" value="${esc(docId)}">
                <input type="hidden" id="${esc(prefix)}-adm-doc-name" value="${esc(docName)}">
                <input type="hidden" id="${esc(prefix)}-adm-doc-tab" value="${esc(tab)}">

                <label class="form-label">Nguồn bệnh nhân *</label>
                <div class="rbt-seg-group rbt-seg-group--2" role="group" aria-label="Nguồn bệnh nhân">
                    <button type="button" class="rbt-seg-btn ${src === 'cap_cuu' ? 'is-selected' : ''}" data-rbt-pick-source="cap_cuu" data-rbt-prefix="${esc(prefix)}">🚨 Cấp cứu</button>
                    <button type="button" class="rbt-seg-btn ${src === 'phong_kham' ? 'is-selected' : ''}" data-rbt-pick-source="phong_kham" data-rbt-prefix="${esc(prefix)}">🏥 Phòng khám</button>
                </div>

                <div id="${esc(prefix)}-adm-doc-panel" class="rbt-adm-doc-panel" ${src === 'phong_kham' ? '' : 'hidden'}>
                    <div class="rbt-adm-doc-hdr">
                        <label class="form-label" style="margin:0;">Bác sĩ phòng khám cho nhập</label>
                        <div id="${esc(prefix)}-adm-doc-selected" class="rbt-adm-selected"></div>
                    </div>
                    <div class="rbt-adm-doc-controls">
                        <div class="rbt-doc-tabs" role="tablist" aria-label="Nhóm bác sĩ">
                            <button type="button" class="rbt-doc-tab ${tab === 'internal' ? 'is-selected' : ''}" data-rbt-adm-tab="internal" data-rbt-prefix="${esc(prefix)}">Khoa PTĐTT (${internal.length})</button>
                            <button type="button" class="rbt-doc-tab ${tab === 'external' ? 'is-selected' : ''}" data-rbt-adm-tab="external" data-rbt-prefix="${esc(prefix)}">BS ngoài khoa (${external.length})</button>
                            <button type="button" class="rbt-doc-tab ${tab === 'manual' ? 'is-selected' : ''}" data-rbt-adm-tab="manual" data-rbt-prefix="${esc(prefix)}">✍️ Nhập tay</button>
                        </div>
                        <input id="${esc(prefix)}-adm-doc-search" type="search" class="form-input rbt-adm-search" data-rbt-adm-search="1" data-rbt-prefix="${esc(prefix)}" placeholder="Tìm nhanh BS (gõ không dấu, VD: an, huu, chuc)..." autocomplete="off" enterkeyhint="search">
                    </div>
                    <div id="${esc(prefix)}-adm-doc-chips" class="rbt-doc-chips"></div>
                    <div id="${esc(prefix)}-adm-doc-manual-wrap" class="rbt-adm-manual-wrap" ${tab === 'manual' ? '' : 'hidden'}>
                        <label class="form-label" for="${esc(prefix)}-adm-doc-manual">Tên bác sĩ cho nhập (nhập tay)</label>
                        <input id="${esc(prefix)}-adm-doc-manual" type="text" class="form-input" data-rbt-adm-manual="1" data-rbt-prefix="${esc(prefix)}" value="${esc(docType === 'manual' ? docName : '')}" placeholder="VD: BS. Trần Văn X — Phòng khám Ngoại" autocomplete="off" enterkeyhint="done">
                    </div>
                </div>
            </div>`;
        },

        _updateOptionalCount() {
            const badge = document.getElementById('rbt-optional-count');
            if (!badge) return;
            const vals = ['rbt-inp-phone', 'rbt-inp-adm', 'rbt-inp-proc', 'rbt-inp-note']
                .map(id => (document.getElementById(id)?.value || '').trim())
                .filter(Boolean);
            badge.textContent = vals.length ? `Đã điền ${vals.length} mục` : 'Tùy chọn';
        },

        _updateConsultSlotHints(dateIso) {
            const sCnt = this._countConsultsOn(dateIso, 'sang');
            const cCnt = this._countConsultsOn(dateIso, 'chieu');
            const sEl = document.getElementById('rbt-sess-count-sang');
            const cEl = document.getElementById('rbt-sess-count-chieu');
            if (sEl) sEl.textContent = sCnt ? `Đang có ${sCnt} ca` : 'Trống';
            if (cEl) cEl.textContent = cCnt ? `Đang có ${cCnt} ca` : 'Trống';
        },

        _fillSandboxForm() {
            const idx = (this._sandboxSampleIdx || 0) % SANDBOX_PROFILES.length;
            this._sandboxSampleIdx = (idx + 1) % SANDBOX_PROFILES.length;
            const sample = SANDBOX_PROFILES[idx];
            const randSuffix = String(Math.floor(1000 + Math.random() * 9000));
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (!el || val == null) return;
                el.value = String(val);
                el.dispatchEvent(new Event('change', { bubbles: true }));
            };
            const sbxChk = document.getElementById('rbt-inp-sandbox');
            if (sbxChk) sbxChk.checked = true;
            setVal('rbt-inp-name', sample.patientName);
            setVal('rbt-inp-birth', sample.birthYear);
            setVal('rbt-inp-gender', sample.gender);
            setVal('rbt-inp-phone', sample.phone);
            setVal('rbt-inp-ward-room', sample.wardRoom);
            setVal('rbt-inp-adm', `TEST-26${randSuffix}`);
            setVal('rbt-inp-indication', sample.indicationType);
            setVal('rbt-inp-diag', sample.diagnosis);
            setVal('rbt-inp-proc', sample.robotProcedure);
            setVal('rbt-inp-surgeon', '1');
            setVal('rbt-inp-note', sample.note);

            const { internal, external } = this._admittingDoctors();
            let docName = '';
            if (sample.admissionSource === 'phong_kham') {
                const pool = sample.admittingDoctorType === 'external' ? external : internal;
                const found = pool.find(d => Number(d.id) === Number(sample.admittingDoctorId));
                docName = found ? (found.fullName || found.name) : '';
            }
            this._setAdmissionSourceState('rbt-inp', {
                source: sample.admissionSource || 'phong_kham',
                docType: sample.admittingDoctorType || '',
                docId: sample.admittingDoctorId || '',
                docName
            });

            const optDetails = document.getElementById('rbt-optional-details');
            if (optDetails) optDetails.open = true;
            this._updateOptionalCount();

            const labsChk = document.getElementById('rbt-inp-labs-ready');
            if (labsChk) labsChk.checked = true;
            const dateInp = document.getElementById('rbt-inp-date');
            if (dateInp && !dateInp.value) {
                dateInp.value = addDaysIso(this._todayIso(), 2);
                dateInp.dispatchEvent(new Event('change', { bubbles: true }));
            }
            this._markModalDirty();
            notifyToast('🧪 Đã tự điền đầy đủ dữ liệu ca giả lập [TEST] để vận hành thử!', 'info');
        },

        openCreateModal(mode = 'create_consult', opts = {}) {
            const p = this._perms();
            const todayIso = this._todayIso();
            const surgeons = this._surgeons();
            const isDirect = mode === 'create_case';
            const useSandbox = Boolean(opts && opts.sandbox && p.canAccessSandbox);
            const isLaptop = this._isLaptopPointer();
            const title = isDirect
                ? '⚡ Tạo trực tiếp ca Lịch mổ Robot'
                : (useSandbox ? '🧪 Tạo ca giả lập vận hành thử [TEST]' : '🩺 Bước 1 · Gửi bệnh nhân Tư vấn PT Nội soi / Robot');
            const modalMode = isDirect ? 'create_case' : 'create_consult';

            const sandboxBoxHtml = p.canAccessSandbox ? `<div class="rbt-sandbox-box">
                <label class="rbt-sandbox-box__label">
                    <input id="rbt-inp-sandbox" type="checkbox" ${useSandbox ? 'checked' : ''}>
                    <span><strong>🧪 Tạo ca giả lập [TEST]</strong> · Tự điền đầy đủ thông tin để vận hành thử</span>
                </label>
                <button type="button" id="rbt-btn-autofill-sandbox" class="btn btn-secondary rbt-btn-xs" data-rbt-action="autofill_sandbox">⚡ Điền mẫu khác</button>
            </div>` : '';

            const genderPicker = this._renderSegmentedSelectHtml('rbt-inp-gender', [
                { value: 'Nam', label: 'Nam' },
                { value: 'Nữ', label: 'Nữ' }
            ], '', 'rbt-seg-group--2');

            const indPicker = this._renderSegmentedSelectHtml('rbt-inp-indication', [
                { value: 'robot_hoac_noisoi', label: 'Nội soi / Robot', fullLabel: 'PT Nội soi hoặc Robot' },
                { value: 'uu_tien_robot', label: 'Ưu tiên Robot', fullLabel: 'Ưu tiên phẫu thuật Robot' },
                { value: 'uu_tien_noisoi', label: 'Ưu tiên Nội soi', fullLabel: 'Ưu tiên phẫu thuật Nội soi' }
            ], 'robot_hoac_noisoi', 'rbt-seg-group--3');

            const html = `${this._dirtyBannerHtml()}
            ${sandboxBoxHtml}
            <div class="rbt-section-card">
                <div class="rbt-section-card__title">1. Hành chính &amp; Nguồn tiếp nhận</div>
                <div class="rbt-row-patient-3col">
                    <div class="rbt-col-name">
                        <label class="form-label" for="rbt-inp-name">Họ và tên bệnh nhân *</label>
                        <input id="rbt-inp-name" type="text" class="form-input" placeholder="VD: Nguyễn Văn A" autocomplete="off" enterkeyhint="next">
                    </div>
                    <div>
                        <label class="form-label" for="rbt-inp-birth">Năm sinh *</label>
                        <input id="rbt-inp-birth" type="number" min="1900" max="2026" inputmode="numeric" pattern="[0-9]*" class="form-input" placeholder="1965" enterkeyhint="next">
                    </div>
                    <div>
                        <label class="form-label">Giới tính</label>
                        ${genderPicker}
                    </div>
                </div>
                <div style="margin-top:12px;">
                    ${this._renderAdmissionSourcePickerHtml('rbt-inp', {})}
                </div>
            </div>

            <div class="rbt-section-card">
                <div class="rbt-section-card__title">2. Phòng bệnh, Chẩn đoán &amp; Chỉ định</div>
                <div style="margin-bottom:10px;">
                    <label class="form-label" for="rbt-inp-ward-room">Phòng bệnh hiện tại *</label>
                    ${this._renderWardRoomPickerHtml('rbt-inp-ward-room', '')}
                </div>
                <div class="rbt-form-grid">
                    <div class="rbt-form-grid--full">
                        <label class="form-label" for="rbt-inp-diag">Chẩn đoán *</label>
                        <input id="rbt-inp-diag" type="text" class="form-input" placeholder="VD: K trực tràng giữa cT3N1M0" enterkeyhint="next">
                    </div>
                    <div class="rbt-form-grid--full">
                        <label class="form-label" for="rbt-inp-indication">Chỉ định phẫu thuật</label>
                        ${indPicker}
                    </div>
                    ${isDirect ? `
                    <div class="rbt-form-grid--full">
                        <label class="form-label" for="rbt-inp-date">Ngày phẫu thuật Robot *</label>
                        ${datePresetsHtml('rbt-inp-date', todayIso)}
                        <div class="rbt-date-wrap"><input id="rbt-inp-date" type="date" class="form-input" value="${addDaysIso(todayIso, 2)}"></div>
                    </div>
                    <div id="rbt-create-slot-wrap" class="rbt-form-grid--full">
                        ${this._renderSlotPickerHtml(addDaysIso(todayIso, 2), 'Ca 1', '')}
                    </div>` : ''}
                    <div class="rbt-form-grid--full">
                        <label class="rbt-check-card">
                            <input id="rbt-inp-labs-ready" type="checkbox" ${isDirect ? 'checked' : ''}>
                            <span><strong>Xác nhận đủ xét nghiệm tiền phẫu &amp; có chỉ định PT Nội soi/Robot *</strong></span>
                        </label>
                    </div>
                </div>
            </div>

            <details id="rbt-optional-details" class="rbt-optional-group" ${(isLaptop || useSandbox) ? 'open' : ''}>
                <summary class="rbt-optional-summary">
                    <span>+ Thông tin bổ sung (SĐT không bắt buộc, HSBA, PP dự kiến, Ghi chú)</span>
                    <span id="rbt-optional-count" class="rbt-badge rbt-badge--navy">Tùy chọn</span>
                </summary>
                <div class="rbt-optional-body">
                    <div class="rbt-form-grid">
                        <div>
                            <label class="form-label" for="rbt-inp-phone">Số điện thoại liên hệ (không bắt buộc)</label>
                            <input id="rbt-inp-phone" type="tel" inputmode="tel" class="form-input" placeholder="09xxxxxxxx (có thể để trống)" enterkeyhint="next">
                        </div>
                        <div>
                            <label class="form-label" for="rbt-inp-adm">Số nhập viện / HSBA</label>
                            <input id="rbt-inp-adm" type="text" class="form-input" placeholder="26xxxxxx" enterkeyhint="next">
                        </div>
                        <div>
                            <label class="form-label" for="rbt-inp-proc">Dự kiến phương pháp phẫu thuật</label>
                            <input id="rbt-inp-proc" type="text" class="form-input" placeholder="VD: Cắt trước thấp" enterkeyhint="next">
                        </div>
                        <div>
                            <label class="form-label" for="rbt-inp-surgeon">PTV dự kiến / Tư vấn</label>
                            <select id="rbt-inp-surgeon" class="form-input">
                                ${surgeons.map(s => `<option value="${s.id}" ${Number(s.id) === 1 ? 'selected' : ''}>${esc([s.title, s.name].filter(Boolean).join(' '))}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="form-label">Bác sĩ gửi hồ sơ</label>
                            <input type="text" class="form-input" value="${esc(this._currentUserDisplay())}" readonly>
                        </div>
                        <div class="rbt-form-grid--full">
                            <label class="form-label" for="rbt-inp-note">Ghi chú gửi Điều phối &amp; TS. Hữu</label>
                            <textarea id="rbt-inp-note" class="form-input" rows="2" placeholder="Tình trạng bệnh nền, kháng đông, thời gian dự kiến..."></textarea>
                        </div>
                    </div>
                </div>
            </details>
            <div id="rbt-modal-conflict-host"></div>`;

            const footer = `<button type="button" class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                <button type="button" class="btn btn-primary" data-rbt-primary-submit="1" data-rbt-action="submit_create" data-rbt-extra="${esc(modalMode)}">${isDirect ? 'Tạo ca &amp; Xếp lịch Robot' : 'Gửi ca tư vấn'} <kbd class="rbt-kbd-hint">⌘/Ctrl+↵</kbd></button>`;

            this._markModalOpen(modalMode, null);
            openRobotModal(title, html, footer, { size: 'wide', mode: modalMode });
            if (useSandbox) {
                this._fillSandboxForm();
            } else if (isLaptop) {
                setTimeout(() => {
                    const nameInp = document.getElementById('rbt-inp-name');
                    if (nameInp && this._modalActive) try { nameInp.focus({ preventScroll: true }); } catch (_) {}
                }, 60);
            }
            this._updateOptionalCount();
        },

        async _submitCreateModal(mode, btnEl) {
            const admSource = document.getElementById('rbt-inp-adm-source')?.value || '';
            const admDocType = document.getElementById('rbt-inp-adm-doc-type')?.value || '';
            const admDocIdRaw = document.getElementById('rbt-inp-adm-doc-id')?.value || '';
            const admDocManRaw = document.getElementById('rbt-inp-adm-doc-manual')?.value?.trim() || '';
            const admDocName = admDocType === 'manual'
                ? admDocManRaw
                : (document.getElementById('rbt-inp-adm-doc-name')?.value?.trim() || admDocManRaw);

            if (!admSource) {
                const wrap = document.getElementById('rbt-inp-adm-source-wrap');
                if (wrap) {
                    wrap.classList.add('rbt-field-invalid');
                    wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                notifyToast('Vui lòng chọn Nguồn bệnh nhân (Cấp cứu hoặc Phòng khám).', 'error');
                return;
            }
            if (admSource === 'phong_kham' && admDocType === 'manual' && admDocName.length < 2) {
                const manInp = document.getElementById('rbt-inp-adm-doc-manual');
                if (manInp) try { manInp.focus(); } catch (_) {}
                notifyToast('Vui lòng nhập tên Bác sĩ phòng khám cho nhập (tối thiểu 2 ký tự).', 'error');
                return;
            }

            const payload = {
                action: mode,
                patientName: document.getElementById('rbt-inp-name')?.value?.trim() || '',
                birthYear: document.getElementById('rbt-inp-birth')?.value?.trim() || '',
                gender: document.getElementById('rbt-inp-gender')?.value || '',
                phone: document.getElementById('rbt-inp-phone')?.value?.trim() || '',
                wardRoom: document.getElementById('rbt-inp-ward-room')?.value || '',
                admissionSource: admSource,
                admittingDoctorType: admSource === 'phong_kham' ? admDocType : '',
                admittingDoctorId: (admSource === 'phong_kham' && (admDocType === 'staff' || admDocType === 'external') && admDocIdRaw) ? Number(admDocIdRaw) : null,
                admittingDoctorName: admSource === 'phong_kham' ? admDocName : '',
                admissionId: document.getElementById('rbt-inp-adm')?.value?.trim() || '',
                indicationType: document.getElementById('rbt-inp-indication')?.value || 'robot_hoac_noisoi',
                diagnosis: document.getElementById('rbt-inp-diag')?.value?.trim() || '',
                robotProcedure: document.getElementById('rbt-inp-proc')?.value?.trim() || '',
                mainSurgeonId: Number(document.getElementById('rbt-inp-surgeon')?.value || 1),
                labsReadyConfirmed: Boolean(document.getElementById('rbt-inp-labs-ready')?.checked),
                consultNote: document.getElementById('rbt-inp-note')?.value?.trim() || ''
            };
            const sbxEl = document.getElementById('rbt-inp-sandbox');
            if (sbxEl && sbxEl.checked) payload.isTestSandboxCase = true;

            if (mode === 'create_case') {
                payload.surgeryDate = document.getElementById('rbt-inp-date')?.value || '';
                payload.caseSlot = document.getElementById('rbt-inp-slot')?.value || 'Ca 1';
                this._attachConflictOverride(payload);
            }

            if (btnEl) btnEl.disabled = true;
            try {
                if (!this._inflightIdem) this._inflightIdem = newIdempotencyKey();
                const res = await this._apiJson('/api/robot/cases', {
                    method: 'POST',
                    body: payload,
                    idempotencyKey: this._inflightIdem
                });
                this._upsertCaseInMemory(res.case);
                await this.ensureLoaded(true).catch(() => {});
                if (typeof Modal !== 'undefined' && Modal.close) Modal.close(true);
                notifyToast(mode === 'create_case' ? 'Đã tạo & xếp lịch Robot thành công!' : 'Đã gửi hồ sơ tư vấn cho Điều phối!', 'success');
                this._rerenderPage();
            } catch (err) {
                this._handleMutationError(err);
            } finally {
                if (btnEl) btnEl.disabled = false;
            }
        },

        openScheduleConsultModal(code) {
            const rc = this._findCase(code);
            if (!rc) return;
            const todayIso = this._todayIso();
            const defaultDate = rc.consultDate || addDaysIso(todayIso, 1);
            const sess = rc.consultSession === 'chieu' ? 'chieu' : 'sang';
            const schedPresets = [
                { label: 'Hôm nay', iso: todayIso },
                { label: 'Ngày mai', iso: addDaysIso(todayIso, 1) },
                { label: '+2 ngày', iso: addDaysIso(todayIso, 2) },
                { label: '+3 ngày', iso: addDaysIso(todayIso, 3) }
            ].map(p => {
                const cnt = this._countConsultsOn(p.iso);
                return { label: `${p.label}${cnt ? ` · ${cnt} ca` : ''}`, iso: p.iso };
            });
            const sCnt = this._countConsultsOn(defaultDate, 'sang');
            const cCnt = this._countConsultsOn(defaultDate, 'chieu');

            const html = `${this._dirtyBannerHtml()}
            <div class="rbt-sheet-summary">
                <strong>${esc(rc.patientName)}</strong> (${esc(rc.birthYear || '—')}) · ${esc(roomLabel(rc.wardRoom))} ${this._admissionSourceBadgeHtml(rc)}<br>
                <span>CĐ: ${esc(rc.diagnosis || '—')} · BS gửi: ${esc(rc.createdByName || rc.createdByUsername || '—')}</span>
            </div>
            <div class="rbt-form-grid">
                <div class="rbt-form-grid--full">
                    <label class="form-label" for="rbt-inp-consult-date">Ngày tư vấn TS. BSCKII. Nguyễn Phú Hữu *</label>
                    ${datePresetsHtml('rbt-inp-consult-date', todayIso, schedPresets)}
                    <div class="rbt-date-wrap"><input id="rbt-inp-consult-date" type="date" class="form-input" value="${esc(defaultDate)}"></div>
                </div>
                <div class="rbt-form-grid--full">
                    <label class="form-label">Buổi tư vấn *</label>
                    <input type="hidden" id="rbt-inp-consult-session" value="${esc(sess)}">
                    <div class="rbt-slot-pills rbt-session-pills">
                        <button type="button" class="rbt-slot-pill ${sess === 'sang' ? 'is-selected' : ''}" data-rbt-pick-session="sang">
                            <strong>🌅 Buổi Sáng (07:30 – 11:30)</strong>
                            <span id="rbt-sess-count-sang" class="rbt-slot-pill__sub">${sCnt ? `Đang có ${sCnt} ca` : 'Trống'}</span>
                        </button>
                        <button type="button" class="rbt-slot-pill ${sess === 'chieu' ? 'is-selected' : ''}" data-rbt-pick-session="chieu">
                            <strong>🌇 Buổi Chiều (13:00 – 16:30)</strong>
                            <span id="rbt-sess-count-chieu" class="rbt-slot-pill__sub">${cCnt ? `Đang có ${cCnt} ca` : 'Trống'}</span>
                        </button>
                    </div>
                </div>
                <div class="rbt-form-grid--full">
                    <label class="form-label" for="rbt-inp-consult-sched-note">Ghi chú lịch hẹn (chạm nhanh hoặc nhập cụ thể)</label>
                    <div class="rbt-quick-chips">
                        ${CONSULT_NOTE_PRESETS.map(txt => `<button type="button" class="rbt-quick-chip" data-rbt-quick-fill="#rbt-inp-consult-sched-note" data-rbt-val="${esc(txt)}">${esc(txt)}</button>`).join('')}
                    </div>
                    <input id="rbt-inp-consult-sched-note" type="text" class="form-input" value="${esc(rc.consultScheduleNote || '')}" placeholder="VD: Tư vấn tại phòng khám lầu 7 sau giao ban" enterkeyhint="done">
                </div>
            </div>`;

            const footer = `<button type="button" class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                <button type="button" class="btn btn-primary" data-rbt-primary-submit="1" data-rbt-action="submit_schedule_consult" data-rbt-code="${esc(code)}">Lưu lịch tư vấn <kbd class="rbt-kbd-hint">⌘/Ctrl+↵</kbd></button>`;

            this._markModalOpen('schedule_consult', code);
            openRobotModal(`📅 Bước 2 · Xếp lịch tư vấn (${code})`, html, footer, { size: 'md', mode: 'schedule_consult' });
        },

        async _submitScheduleConsult(code, btnEl) {
            const rc = this._findCase(code);
            if (!rc) return;
            const body = {
                action: 'schedule_consult',
                expectedRevision: Number(rc.caseRevision || 1),
                consultDate: document.getElementById('rbt-inp-consult-date')?.value || '',
                consultSession: document.getElementById('rbt-inp-consult-session')?.value || 'sang',
                consultScheduleNote: document.getElementById('rbt-inp-consult-sched-note')?.value?.trim() || ''
            };
            await this._sendPatch(code, body, 'Đã xếp lịch tư vấn TS. Nguyễn Phú Hữu!', btnEl);
        },

        openDecideConsultModal(code, defaultDecision = '') {
            const rc = this._findCase(code);
            if (!rc) return;
            const todayIso = this._todayIso();
            const defDec = defaultDecision || (rc.indicationType === 'uu_tien_noisoi' ? 'noisoi' : 'robot');
            const defSurgDate = rc.surgeryDate || addDaysIso(todayIso, 2);
            const surgeons = this._surgeons();
            const refusals = this._refusalReasons();
            const nsTypePicker = this._renderSegmentedSelectHtml('rbt-inp-ns-type', [
                { value: 'chuongtrinh', label: 'Chương trình' },
                { value: 'yeucau', label: 'Yêu cầu' },
                { value: 'bankhan', label: 'Bán khẩn' }
            ], rc.scheduledSurgeryType || 'chuongtrinh', 'rbt-seg-group--3');
            const refusalPicker = this._renderSegmentedSelectHtml(
                'rbt-inp-refusal-reason',
                Object.entries(refusals).map(([k, v]) => ({ value: k, label: v })),
                rc.refusalReason || Object.keys(refusals)[0] || 'ly_do_khac',
                'rbt-seg-group--stack'
            );

            const html = `${this._dirtyBannerHtml()}
            <div class="rbt-sheet-summary">
                <strong>${esc(rc.patientName)}</strong> (${esc(rc.birthYear || '—')}) · ${esc(roomLabel(rc.wardRoom))} ${this._admissionSourceBadgeHtml(rc)} · Mã ${esc(code)}<br>
                <span>CĐ: ${esc(rc.diagnosis || '—')} · BS TV: <strong>${esc(rc.consultedByName || 'TS. BSCKII. Nguyễn Phú Hữu')}</strong></span>
            </div>

            <input type="hidden" id="rbt-inp-decision" value="${esc(defDec)}">
            <label class="form-label">Chọn kết quả sau tư vấn *</label>
            <div class="rbt-decision-grid">
                <button type="button" class="rbt-decision-card ${defDec === 'robot' ? 'is-selected' : ''}" data-rbt-pick-decision="robot">
                    <span class="rbt-decision-card__icon">🤖</span>
                    <strong>Mổ Robot</strong>
                    <small>Đồng bộ Lịch tuần + P.CTXH A5</small>
                </button>
                <button type="button" class="rbt-decision-card ${defDec === 'noisoi' ? 'is-selected' : ''}" data-rbt-pick-decision="noisoi">
                    <span class="rbt-decision-card__icon">🔬</span>
                    <strong>Chuyển Nội soi</strong>
                    <small>Xếp ngày &amp; PTV chính, không tốn slot Robot</small>
                </button>
                <button type="button" class="rbt-decision-card ${defDec === 'can_nhac' ? 'is-selected' : ''}" data-rbt-pick-decision="can_nhac">
                    <span class="rbt-decision-card__icon">⏳</span>
                    <strong>Đang cân nhắc</strong>
                    <small>Chuyển lại ĐP hẹn tư vấn lần sau</small>
                </button>
                <button type="button" class="rbt-decision-card rbt-decision-card--danger ${defDec === 'khong_mo' ? 'is-selected' : ''}" data-rbt-pick-decision="khong_mo">
                    <span class="rbt-decision-card__icon">❌</span>
                    <strong>Không đồng ý mổ</strong>
                    <small>Ghi nhận lý do để BS phòng theo dõi</small>
                </button>
            </div>

            <div class="rbt-form-grid" style="margin-top:12px;">
                <div class="rbt-form-grid--full">
                    <label class="form-label" for="rbt-inp-dec-proc">Phương pháp phẫu thuật</label>
                    <input id="rbt-inp-dec-proc" type="text" class="form-input" value="${esc(rc.robotProcedure || '')}" placeholder="VD: Cắt trước thấp / Cắt đại tràng phải" enterkeyhint="next">
                </div>
            </div>

            <div data-rbt-branch-panel="robot" ${defDec === 'robot' ? '' : 'hidden'} class="rbt-branch-panel">
                <div class="rbt-branch-split">
                    <div>
                        <div style="margin-bottom:10px;">
                            <label class="form-label" for="rbt-inp-date">Ngày phẫu thuật Robot *</label>
                            ${datePresetsHtml('rbt-inp-date', todayIso)}
                            <div class="rbt-date-wrap"><input id="rbt-inp-date" type="date" class="form-input" value="${esc(defSurgDate)}"></div>
                        </div>
                        <div id="rbt-decide-slot-wrap">
                            ${this._renderSlotPickerHtml(defSurgDate, rc.caseSlot || 'Ca 1', code)}
                        </div>
                    </div>
                    <div>
                        <div style="margin-bottom:10px;">
                            <label class="form-label" for="rbt-inp-dec-surgeon-robot">PTV chính</label>
                            ${this._renderSurgeonQuickChipsHtml('rbt-inp-dec-surgeon-robot', surgeons, rc.mainSurgeonId || 1)}
                            <select id="rbt-inp-dec-surgeon-robot" class="form-input">
                                ${surgeons.map(s => `<option value="${s.id}" ${Number(s.id) === Number(rc.mainSurgeonId || 1) ? 'selected' : ''}>${esc([s.title, s.name].filter(Boolean).join(' '))}</option>`).join('')}
                            </select>
                        </div>
                        <label class="rbt-check-card">
                            <input id="rbt-inp-dec-print-after" type="checkbox" checked>
                            <span>Mở xem/in ngay Giấy GT P.CTXH (A5) sau khi lưu</span>
                        </label>
                    </div>
                </div>
            </div>

            <div data-rbt-branch-panel="noisoi" ${defDec === 'noisoi' ? '' : 'hidden'} class="rbt-branch-panel">
                <div class="rbt-info-banner">🔬 Ca chuyển mổ Nội soi sẽ <strong>đồng bộ 2 chiều lên Lịch mổ tuần</strong> với phương pháp Nội soi và <strong>không chiếm slot 3 ca/ngày của Robot</strong>.</div>
                <div class="rbt-branch-split">
                    <div>
                        <label class="form-label" for="rbt-inp-ns-date">Ngày phẫu thuật Nội soi *</label>
                        ${datePresetsHtml('rbt-inp-ns-date', todayIso)}
                        <div class="rbt-date-wrap"><input id="rbt-inp-ns-date" type="date" class="form-input" value="${esc(defSurgDate)}"></div>
                        <div style="margin-top:10px;">
                            <label class="form-label" for="rbt-inp-ns-type">Loại phẫu thuật *</label>
                            ${nsTypePicker}
                        </div>
                    </div>
                    <div>
                        <label class="form-label" for="rbt-inp-dec-surgeon-ns">PTV chính phân công *</label>
                        ${this._renderSurgeonQuickChipsHtml('rbt-inp-dec-surgeon-ns', surgeons, rc.mainSurgeonId || 1)}
                        <select id="rbt-inp-dec-surgeon-ns" class="form-input">
                            ${surgeons.map(s => `<option value="${s.id}" ${Number(s.id) === Number(rc.mainSurgeonId || 1) ? 'selected' : ''}>${esc([s.title, s.name].filter(Boolean).join(' '))}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <div data-rbt-branch-panel="can_nhac" ${defDec === 'can_nhac' ? '' : 'hidden'} class="rbt-branch-panel">
                <div class="rbt-info-banner">⏳ Bệnh nhân cần thêm thời gian suy nghĩ/hội ý gia đình — hồ sơ sẽ quay lại hàng đợi Bước 2 để Điều phối viên hẹn tư vấn lại.</div>
            </div>

            <div data-rbt-branch-panel="khong_mo" ${defDec === 'khong_mo' ? '' : 'hidden'} class="rbt-branch-panel">
                <label class="form-label" for="rbt-inp-refusal-reason">Lý do bệnh nhân không đồng ý mổ *</label>
                ${refusalPicker}
            </div>

            <div style="margin-top:12px;">
                <label class="form-label" for="rbt-inp-dec-note">Ghi chú kết quả tư vấn (BS phòng sẽ xem được)</label>
                <textarea id="rbt-inp-dec-note" class="form-input" rows="2" placeholder="Dặn dò chuẩn bị tiền phẫu, kháng đông hoặc lý do cụ thể...">${esc(rc.consultNote || '')}</textarea>
            </div>
            <div id="rbt-modal-conflict-host"></div>`;

            const footer = `<button type="button" class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                <button type="button" class="btn btn-primary" data-rbt-primary-submit="1" data-rbt-action="submit_decide_consult" data-rbt-code="${esc(code)}">Chốt kết quả tư vấn <kbd class="rbt-kbd-hint">⌘/Ctrl+↵</kbd></button>`;

            this._markModalOpen('decide_consult', code);
            openRobotModal(`🩺 Bước 3 · Kết quả tư vấn TS. Hữu (${code})`, html, footer, { size: 'wide', mode: 'decide_consult' });
        },

        async _submitDecideConsult(code, btnEl) {
            const rc = this._findCase(code);
            if (!rc) return;
            const decision = document.getElementById('rbt-inp-decision')?.value || 'robot';
            const body = {
                action: 'decide_consult',
                expectedRevision: Number(rc.caseRevision || 1),
                decision,
                robotProcedure: document.getElementById('rbt-inp-dec-proc')?.value?.trim() || '',
                consultNote: document.getElementById('rbt-inp-dec-note')?.value?.trim() || ''
            };

            let printAfter = false;
            if (decision === 'robot') {
                body.surgeryDate = document.getElementById('rbt-inp-date')?.value || '';
                body.caseSlot = document.getElementById('rbt-inp-slot')?.value || 'Ca 1';
                body.mainSurgeonId = Number(document.getElementById('rbt-inp-dec-surgeon-robot')?.value || 1);
                this._attachConflictOverride(body);
                printAfter = Boolean(document.getElementById('rbt-inp-dec-print-after')?.checked);
            } else if (decision === 'noisoi') {
                body.surgeryDate = document.getElementById('rbt-inp-ns-date')?.value || '';
                body.mainSurgeonId = Number(document.getElementById('rbt-inp-dec-surgeon-ns')?.value || 1);
                body.scheduledSurgeryType = document.getElementById('rbt-inp-ns-type')?.value || 'chuongtrinh';
            } else if (decision === 'khong_mo') {
                body.refusalReason = document.getElementById('rbt-inp-refusal-reason')?.value || 'ly_do_khac';
            }

            const ok = await this._sendPatch(code, body, 'Đã chốt kết quả tư vấn & đồng bộ lịch!', btnEl);
            if (ok && decision === 'robot' && printAfter) {
                this.openPrintPctxhModal(code);
            }
        },

        openDischargeWaitModal(code) {
            const rc = this._findCase(code);
            if (!rc) return;
            const todayIso = this._todayIso();
            const surgDate = rc.surgeryDate || addDaysIso(todayIso, 7);
            const pre1 = addDaysIso(surgDate, -1);
            const pre2 = addDaysIso(surgDate, -2);
            const defReadmit = rc.plannedReadmitDate || (pre2 >= todayIso ? pre2 : (pre1 >= todayIso ? pre1 : todayIso));

            const html = `${this._dirtyBannerHtml()}
            <div class="rbt-info-banner">🏠 <strong>Giữ nguyên slot lịch mổ:</strong> Bệnh nhân xuất viện chờ tại nhà, ca mổ ngày <strong>${fmtViDate(surgDate)}</strong> (${esc(rc.caseSlot || 'Nội soi')}) vẫn được <strong>giữ nguyên trên Lịch mổ tuần</strong> để điều phối không bị xếp chồng ca.</div>
            <div class="rbt-form-grid">
                <div class="rbt-form-grid--full">
                    <label class="form-label" for="rbt-inp-readmit-date">Ngày hẹn nhập viện trở lại * (≤ ${fmtViDate(surgDate)})</label>
                    ${datePresetsHtml('rbt-inp-readmit-date', todayIso, [
                        pre2 >= todayIso ? { label: 'Trước mổ 2 ngày', iso: pre2 } : null,
                        pre1 >= todayIso ? { label: 'Trước mổ 1 ngày', iso: pre1 } : null,
                        { label: 'Đúng ngày mổ', iso: surgDate }
                    ].filter(Boolean))}
                    <div class="rbt-date-wrap"><input id="rbt-inp-readmit-date" type="date" class="form-input" max="${esc(surgDate)}" value="${esc(defReadmit)}"></div>
                </div>
                <div class="rbt-form-grid--full">
                    <label class="form-label" for="rbt-inp-discharge-reason">Lý do / Dặn dò khi xuất viện chờ (chạm chip điền nhanh)</label>
                    <div class="rbt-quick-chips">
                        ${DISCHARGE_INSTRUCTION_PRESETS.map(txt => `<button type="button" class="rbt-quick-chip" data-rbt-quick-append="#rbt-inp-discharge-reason" data-rbt-val="${esc(txt)}">+ ${esc(txt)}</button>`).join('')}
                    </div>
                    <input id="rbt-inp-discharge-reason" type="text" class="form-input" value="${esc(rc.dischargeReason || 'Lịch mổ còn xa — cho xuất viện chờ hẹn nhập lại')}" placeholder="VD: Ngưng thuốc kháng đông 5 ngày trước nhập lại" enterkeyhint="done">
                </div>
            </div>`;

            const footer = `<button type="button" class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                <button type="button" class="btn btn-primary" data-rbt-primary-submit="1" data-rbt-action="submit_discharge_wait" data-rbt-code="${esc(code)}">Xác nhận Xuất viện chờ <kbd class="rbt-kbd-hint">⌘/Ctrl+↵</kbd></button>`;

            this._markModalOpen('discharge_wait', code);
            openRobotModal(`🏠 Bước 4 · Xuất viện chờ giữ slot (${code})`, html, footer, { size: 'md', mode: 'discharge_wait' });
        },

        async _submitDischargeWait(code, btnEl) {
            const rc = this._findCase(code);
            if (!rc) return;
            const body = {
                action: 'discharge_wait',
                expectedRevision: Number(rc.caseRevision || 1),
                plannedReadmitDate: document.getElementById('rbt-inp-readmit-date')?.value || '',
                dischargeReason: document.getElementById('rbt-inp-discharge-reason')?.value?.trim() || ''
            };
            await this._sendPatch(code, body, 'Đã ghi nhận Xuất viện chờ (vẫn giữ slot Lịch mổ tuần).', btnEl);
        },

        openEditInfoModal(code) {
            const rc = this._findCase(code);
            if (!rc) return;
            const telRaw = rc.phoneMasked ? '' : (rc.phone || '');
            const genderPicker = this._renderSegmentedSelectHtml('rbt-ei-gender', [
                { value: 'Nam', label: 'Nam' },
                { value: 'Nữ', label: 'Nữ' }
            ], rc.gender || '', 'rbt-seg-group--2');
            const indPicker = this._renderSegmentedSelectHtml('rbt-ei-indication', [
                { value: 'robot_hoac_noisoi', label: 'Nội soi / Robot', fullLabel: 'PT Nội soi hoặc Robot' },
                { value: 'uu_tien_robot', label: 'Ưu tiên Robot', fullLabel: 'Ưu tiên phẫu thuật Robot' },
                { value: 'uu_tien_noisoi', label: 'Ưu tiên Nội soi', fullLabel: 'Ưu tiên phẫu thuật Nội soi' }
            ], rc.indicationType || 'robot_hoac_noisoi', 'rbt-seg-group--3');
            const admState = {
                source: rc.admissionSource || '',
                docType: rc.admittingDoctorType || '',
                docId: rc.admittingDoctorId != null ? String(rc.admittingDoctorId) : '',
                docName: rc.admittingDoctorName || ''
            };

            const html = `${this._dirtyBannerHtml()}
            <div class="rbt-section-card">
                <div class="rbt-section-card__title">1. Hành chính &amp; Nguồn bệnh nhân</div>
                <div class="rbt-row-patient-3col">
                    <div class="rbt-col-name">
                        <label class="form-label" for="rbt-ei-name">Họ tên bệnh nhân *</label>
                        <input id="rbt-ei-name" type="text" class="form-input" value="${esc(rc.patientName || '')}">
                    </div>
                    <div>
                        <label class="form-label" for="rbt-ei-birth">Năm sinh</label>
                        <input id="rbt-ei-birth" type="number" inputmode="numeric" pattern="[0-9]*" class="form-input" value="${esc(rc.birthYear || '')}">
                    </div>
                    <div>
                        <label class="form-label">Giới tính</label>
                        ${genderPicker}
                    </div>
                </div>
                <div style="margin-top:12px;">
                    ${this._renderAdmissionSourcePickerHtml('rbt-ei', admState)}
                </div>
            </div>
            <div class="rbt-section-card">
                <div class="rbt-section-card__title">2. Phòng bệnh, Chẩn đoán &amp; Thông tin khác</div>
                <div style="margin-bottom:10px;">
                    <label class="form-label" for="rbt-ei-ward">Phòng bệnh</label>
                    ${this._renderWardRoomPickerHtml('rbt-ei-ward', rc.wardRoom || '')}
                </div>
                <div class="rbt-form-grid">
                    <div>
                        <label class="form-label" for="rbt-ei-phone">Số điện thoại</label>
                        <input id="rbt-ei-phone" type="tel" inputmode="tel" class="form-input" value="${esc(telRaw)}" placeholder="${rc.phoneMasked ? 'Đã ẩn SĐT' : '09xxxxxxxx'}">
                    </div>
                    <div>
                        <label class="form-label" for="rbt-ei-adm">Số nhập viện / HSBA</label>
                        <input id="rbt-ei-adm" type="text" class="form-input" value="${esc(rc.admissionId || '')}" placeholder="26xxxxxx">
                    </div>
                    <div class="rbt-form-grid--full">
                        <label class="form-label" for="rbt-ei-indication">Chỉ định phẫu thuật</label>
                        ${indPicker}
                    </div>
                    <div class="rbt-form-grid--full">
                        <label class="form-label" for="rbt-ei-diag">Chẩn đoán</label>
                        <input id="rbt-ei-diag" type="text" class="form-input" value="${esc(rc.diagnosis || '')}">
                    </div>
                    <div class="rbt-form-grid--full">
                        <label class="form-label" for="rbt-ei-proc">Phương pháp phẫu thuật</label>
                        <input id="rbt-ei-proc" type="text" class="form-input" value="${esc(rc.robotProcedure || '')}">
                    </div>
                    <div class="rbt-form-grid--full">
                        <label class="form-label" for="rbt-ei-note">Ghi chú</label>
                        <textarea id="rbt-ei-note" class="form-input" rows="2">${esc(rc.note || '')}</textarea>
                    </div>
                </div>
            </div>`;

            const footer = `<button type="button" class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                <button type="button" class="btn btn-primary" data-rbt-primary-submit="1" data-rbt-action="submit_edit_info" data-rbt-code="${esc(code)}">Lưu thông tin <kbd class="rbt-kbd-hint">⌘/Ctrl+↵</kbd></button>`;

            this._markModalOpen('edit_info', code);
            openRobotModal(`✏️ Sửa thông tin hồ sơ (${code})`, html, footer, { size: 'wide', mode: 'edit_info' });
            if (admState.source === 'phong_kham') {
                this._refreshAdmittingDoctorPicker('rbt-ei');
            }
        },

        async _submitEditInfo(code, btnEl) {
            const rc = this._findCase(code);
            if (!rc) return;
            const admSource = document.getElementById('rbt-ei-adm-source')?.value || '';
            const admDocType = document.getElementById('rbt-ei-adm-doc-type')?.value || '';
            const admDocIdRaw = document.getElementById('rbt-ei-adm-doc-id')?.value || '';
            const admDocManRaw = document.getElementById('rbt-ei-adm-doc-manual')?.value?.trim() || '';
            const admDocName = admDocType === 'manual'
                ? admDocManRaw
                : (document.getElementById('rbt-ei-adm-doc-name')?.value?.trim() || admDocManRaw);

            if (admSource === 'phong_kham' && admDocType === 'manual' && admDocName.length < 2) {
                const manInp = document.getElementById('rbt-ei-adm-doc-manual');
                if (manInp) try { manInp.focus(); } catch (_) {}
                notifyToast('Vui lòng nhập tên Bác sĩ phòng khám cho nhập (tối thiểu 2 ký tự).', 'error');
                return;
            }

            const body = {
                action: 'edit_info',
                expectedRevision: Number(rc.caseRevision || 1),
                patientName: document.getElementById('rbt-ei-name')?.value?.trim() || '',
                birthYear: document.getElementById('rbt-ei-birth')?.value?.trim() || '',
                gender: document.getElementById('rbt-ei-gender')?.value || '',
                wardRoom: document.getElementById('rbt-ei-ward')?.value || '',
                admissionId: document.getElementById('rbt-ei-adm')?.value?.trim() || '',
                indicationType: document.getElementById('rbt-ei-indication')?.value || 'robot_hoac_noisoi',
                diagnosis: document.getElementById('rbt-ei-diag')?.value?.trim() || '',
                robotProcedure: document.getElementById('rbt-ei-proc')?.value?.trim() || '',
                note: document.getElementById('rbt-ei-note')?.value?.trim() || '',
                admissionSource: admSource,
                admittingDoctorType: admSource === 'phong_kham' ? admDocType : '',
                admittingDoctorId: (admSource === 'phong_kham' && (admDocType === 'staff' || admDocType === 'external') && admDocIdRaw) ? Number(admDocIdRaw) : null,
                admittingDoctorName: admSource === 'phong_kham' ? admDocName : ''
            };
            const phoneVal = document.getElementById('rbt-ei-phone')?.value?.trim() || '';
            if (phoneVal) body.phone = phoneVal;
            await this._sendPatch(code, body, 'Đã cập nhật thông tin ca bệnh.', btnEl);
        },

        openEditScheduleModal(code) {
            const rc = this._findCase(code);
            if (!rc) return;
            const todayIso = this._todayIso();
            const isNs = rc.status === 'da_xep_noisoi';
            const surgeons = this._surgeons();
            const nsTypePicker = isNs ? this._renderSegmentedSelectHtml('rbt-es-type', [
                { value: 'chuongtrinh', label: 'Chương trình' },
                { value: 'yeucau', label: 'Yêu cầu' },
                { value: 'bankhan', label: 'Bán khẩn' }
            ], rc.scheduledSurgeryType || 'chuongtrinh', 'rbt-seg-group--3') : '';

            const html = `${this._dirtyBannerHtml()}
            <div class="rbt-sheet-summary"><strong>${esc(rc.patientName)}</strong> · ${isNs ? '🔬 Chuyển mổ Nội soi' : '🤖 Mổ Robot'}</div>
            <div class="rbt-form-grid">
                <div class="rbt-form-grid--full">
                    <label class="form-label" for="rbt-inp-date">Ngày mổ *</label>
                    ${datePresetsHtml('rbt-inp-date', todayIso)}
                    <div class="rbt-date-wrap"><input id="rbt-inp-date" type="date" class="form-input" value="${esc(rc.surgeryDate || addDaysIso(todayIso, 2))}"></div>
                </div>
                ${!isNs ? `<div id="rbt-edit-sched-slot-wrap" class="rbt-form-grid--full">
                    ${this._renderSlotPickerHtml(rc.surgeryDate || addDaysIso(todayIso, 2), rc.caseSlot || 'Ca 1', code)}
                </div>` : ''}
                <div class="rbt-form-grid--full">
                    <label class="form-label" for="rbt-es-surgeon">PTV chính</label>
                    ${this._renderSurgeonQuickChipsHtml('rbt-es-surgeon', surgeons, rc.mainSurgeonId || 1)}
                    <select id="rbt-es-surgeon" class="form-input">
                        ${surgeons.map(s => `<option value="${s.id}" ${Number(s.id) === Number(rc.mainSurgeonId || 1) ? 'selected' : ''}>${esc([s.title, s.name].filter(Boolean).join(' '))}</option>`).join('')}
                    </select>
                </div>
                ${isNs ? `<div class="rbt-form-grid--full">
                    <label class="form-label" for="rbt-es-type">Loại PT Nội soi</label>
                    ${nsTypePicker}
                </div>` : ''}
                <div class="rbt-form-grid--full">
                    <label class="form-label" for="rbt-es-note">Ghi chú điều chỉnh lịch</label>
                    <input id="rbt-es-note" type="text" class="form-input" value="${esc(rc.note || '')}" enterkeyhint="done">
                </div>
            </div>
            <div id="rbt-modal-conflict-host"></div>`;

            const footer = `<button type="button" class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                <button type="button" class="btn btn-primary" data-rbt-primary-submit="1" data-rbt-action="submit_edit_schedule" data-rbt-code="${esc(code)}">Cập nhật lịch mổ <kbd class="rbt-kbd-hint">⌘/Ctrl+↵</kbd></button>`;

            this._markModalOpen('edit_schedule', code);
            openRobotModal(`🗓️ Điều chỉnh lịch mổ (${code})`, html, footer, { size: 'md', mode: 'edit_schedule' });
        },

        async _submitEditSchedule(code, btnEl) {
            const rc = this._findCase(code);
            if (!rc) return;
            const isNs = rc.status === 'da_xep_noisoi';
            const body = {
                action: 'edit_schedule',
                expectedRevision: Number(rc.caseRevision || 1),
                surgeryDate: document.getElementById('rbt-inp-date')?.value || '',
                mainSurgeonId: Number(document.getElementById('rbt-es-surgeon')?.value || 1),
                note: document.getElementById('rbt-es-note')?.value?.trim() || ''
            };
            if (isNs) {
                body.scheduledSurgeryType = document.getElementById('rbt-es-type')?.value || 'chuongtrinh';
            } else {
                body.caseSlot = document.getElementById('rbt-inp-slot')?.value || 'Ca 1';
                this._attachConflictOverride(body);
            }
            await this._sendPatch(code, body, 'Đã cập nhật lịch mổ & đồng bộ Lịch mổ tuần.', btnEl);
        },

        openPostponeModal(code) {
            const rc = this._findCase(code);
            if (!rc) return;
            const reasons = this._postponeReasons();
            const firstKey = Object.keys(reasons)[0] || 'ly_do_khac';
            const reasonPicker = this._renderSegmentedSelectHtml(
                'rbt-pp-reason',
                Object.entries(reasons).map(([k, v]) => ({ value: k, label: v })),
                firstKey,
                'rbt-seg-group--stack'
            );
            const html = `${this._dirtyBannerHtml()}
            <div class="rbt-sheet-summary"><strong>${esc(rc.patientName)}</strong> · Lịch: ${fmtViDate(rc.surgeryDate)} ${esc(rc.caseSlot || '')}</div>
            <div class="rbt-form-grid">
                <div class="rbt-form-grid--full">
                    <label class="form-label" for="rbt-pp-reason">Lý do hoãn mổ chuẩn (7 lý do) *</label>
                    ${reasonPicker}
                </div>
                <div class="rbt-form-grid--full">
                    <label class="form-label" for="rbt-pp-note">Ghi chú chi tiết</label>
                    <textarea id="rbt-pp-note" class="form-input" rows="2" placeholder="Nhập chi tiết (bắt buộc nếu chọn Lý do khác)"></textarea>
                </div>
            </div>`;
            const footer = `<button type="button" class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                <button type="button" class="btn btn-danger" data-rbt-primary-submit="1" data-rbt-action="submit_postpone" data-rbt-code="${esc(code)}">Xác nhận hoãn mổ</button>`;
            this._markModalOpen('postpone', code);
            openRobotModal(`⏸️ Hoãn ca phẫu thuật (${code})`, html, footer, { size: 'sm', mode: 'postpone' });
        },

        async _submitPostpone(code, btnEl) {
            const rc = this._findCase(code);
            if (!rc) return;
            const body = {
                action: 'postpone',
                expectedRevision: Number(rc.caseRevision || 1),
                postponeReasonCode: document.getElementById('rbt-pp-reason')?.value || 'ly_do_khac',
                postponeReasonNote: document.getElementById('rbt-pp-note')?.value?.trim() || ''
            };
            await this._sendPatch(code, body, 'Đã hoãn ca & giải phóng slot trên Lịch mổ tuần.', btnEl);
        },

        openLinkSurgeryModal(surgeryId) {
            const unlinked = (this._bootstrap && Array.isArray(this._bootstrap.unlinkedFutureRobotSurgeries))
                ? this._bootstrap.unlinkedFutureRobotSurgeries
                : [];
            const s = unlinked.find(x => String(x.id) === String(surgeryId));
            if (!s) return;
            const defSlot = s.isFirstCase ? 'Ca 1' : 'Ca 2';
            const slotPicker = this._renderSegmentedSelectHtml(
                'rbt-lk-slot',
                VALID_SLOTS.map(sl => ({ value: sl, label: `${sl} (${slotToStartTime(sl)})`, fullLabel: sl })),
                defSlot,
                'rbt-seg-group--3'
            );
            const html = `${this._dirtyBannerHtml()}
            <div class="rbt-sheet-summary"><strong>${esc(s.patientName)}</strong> · Ngày ${fmtViDate(s.date)} · ${esc(s.mainSurgeonName)}</div>
            <div class="rbt-form-grid">
                <div class="rbt-form-grid--full">
                    <label class="form-label" for="rbt-lk-slot">Ca mổ Robot *</label>
                    ${slotPicker}
                </div>
                <div class="rbt-form-grid--full">
                    <label class="form-label" for="rbt-lk-ward">Phòng bệnh</label>
                    ${this._renderWardRoomPickerHtml('rbt-lk-ward', '')}
                </div>
                <div class="rbt-form-grid--full">
                    <label class="form-label" for="rbt-lk-phone">Số điện thoại liên hệ</label>
                    <input id="rbt-lk-phone" type="tel" inputmode="tel" class="form-input" placeholder="09xxxxxxxx" enterkeyhint="done">
                </div>
            </div>`;
            const footer = `<button type="button" class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                <button type="button" class="btn btn-primary" data-rbt-primary-submit="1" data-rbt-action="submit_link_surgery" data-rbt-extra="${s.id}">Liên kết hồ sơ Robot</button>`;
            this._markModalOpen('link_surgery', String(s.id));
            openRobotModal(`🔗 Liên kết ca Lịch mổ tuần (#${s.id})`, html, footer, { size: 'md', mode: 'link_surgery' });
        },

        async _submitLinkSurgery(surgeryId, btnEl) {
            if (btnEl) btnEl.disabled = true;
            try {
                if (!this._inflightIdem) this._inflightIdem = newIdempotencyKey();
                const res = await this._apiJson('/api/robot/cases/link-surgery', {
                    method: 'POST',
                    idempotencyKey: this._inflightIdem,
                    body: {
                        action: 'link_existing_surgery',
                        surgeryId: Number(surgeryId),
                        caseSlot: document.getElementById('rbt-lk-slot')?.value || 'Ca 1',
                        wardRoom: document.getElementById('rbt-lk-ward')?.value || '',
                        phone: document.getElementById('rbt-lk-phone')?.value?.trim() || ''
                    }
                });
                this._upsertCaseInMemory(res.case);
                await this.ensureLoaded(true).catch(() => {});
                if (typeof Modal !== 'undefined' && Modal.close) Modal.close(true);
                notifyToast('Đã liên kết ca mổ Robot!', 'success');
                this._rerenderPage();
            } catch (err) {
                this._handleMutationError(err);
            } finally {
                if (btnEl) btnEl.disabled = false;
            }
        },

        _canSoftDeleteCase(rc) {
            if (!rc) return false;
            const p = this._perms();
            if (p.canSoftDelete) return true;
            const isWait = ['cho_xep_tu_van', 'da_xep_tu_van', 'can_nhac'].includes(rc.status);
            const me = this._currentUsername();
            return Boolean(isWait && me && String(rc.createdByUsername || '').trim().toLowerCase() === me);
        },

        openConfirmDeleteModal(code) {
            const rc = this._findCase(code);
            if (!rc) return;
            const html = `${this._dirtyBannerHtml()}
            <div class="rbt-sheet-summary">
                <strong>${esc(rc.patientName)}</strong> (${esc(rc.birthYear || '—')}) · ${esc(roomLabel(rc.wardRoom))} ${this._admissionSourceBadgeHtml(rc)} · Mã <strong>${esc(code)}</strong>
            </div>
            <p style="margin:10px 0 8px;font-size:0.9rem;">Ca sẽ được chuyển vào <strong>Thùng rác</strong> (vẫn khôi phục được trong vòng 14 ngày theo quy tắc Zero-RM).</p>
            <div>
                <label class="form-label" for="rbt-del-reason">Lý do xóa (chạm nhanh hoặc nhập cụ thể)</label>
                <div class="rbt-quick-chips">
                    ${DELETE_REASON_PRESETS.map(txt => `<button type="button" class="rbt-quick-chip" data-rbt-quick-fill="#rbt-del-reason" data-rbt-val="${esc(txt)}">${esc(txt)}</button>`).join('')}
                </div>
                <input id="rbt-del-reason" type="text" class="form-input" value="Xóa ca chờ tư vấn" placeholder="VD: Nhập trùng hồ sơ / BN hủy khám" enterkeyhint="done">
            </div>`;
            const footer = `<button type="button" class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                <button type="button" class="btn btn-danger" data-rbt-primary-submit="1" data-rbt-action="confirm_soft_delete" data-rbt-code="${esc(code)}">🗑️ Xác nhận Xóa</button>`;
            this._markModalOpen('confirm_delete', code);
            openRobotModal(`🗑️ Xóa ca chờ tư vấn (${code})`, html, footer, { size: 'sm', mode: 'confirm_delete' });
        },

        openCaseSheetModal(code) {
            this.openDetailModal(code);
        },

        openDetailModal(code) {
            const rc = this._findCase(code);
            if (!rc) return;
            const p = this._perms();
            const sm = STATUS_META[rc.status] || { label: rc.status, badge: 'rbt-badge--navy' };
            const tel = cleanTelHref(rc);
            const isSched = rc.status === 'da_xep_robot' || rc.status === 'da_xep_noisoi';
            const canReopen = ['khong_dong_y_mo', 'hoan_mo', 'can_nhac'].includes(rc.status) && (p.canScheduleConsult || p.canDecideConsult);

            const html = `<div class="rbt-sheet-summary">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
                    <strong>${esc(code)}</strong>
                    <div>
                        <span class="rbt-badge ${sm.badge}">${esc(sm.label)}</span>
                        <span class="rbt-badge rbt-badge--navy">🏥 ${esc(roomLabel(rc.wardRoom))}</span>
                        ${rc.inpatientState === 'xuat_vien_cho' ? `<span class="rbt-badge rbt-badge--amber">🏠 XV chờ · Nhập lại ${fmtViDate(rc.plannedReadmitDate)}</span>` : ''}
                    </div>
                </div>
                <div style="font-size:1.05rem;font-weight:700;">${esc(rc.patientName)} ${rc.birthYear ? `(${esc(rc.birthYear)})` : ''} ${rc.gender ? `· ${esc(rc.gender)}` : ''}</div>
            </div>
            <div class="rbt-detail-list">
                <div><strong>Nguồn tiếp nhận:</strong> ${rc.admissionSource ? (rc.admissionSource === 'cap_cuu' ? '🚨 Cấp cứu' : `🏥 Phòng khám${rc.admittingDoctorName ? ` — BS cho nhập: ${esc(rc.admittingDoctorName)}` : ''}`) : 'Chưa ghi nhận'}</div>
                <div><strong>Số nhập viện / HSBA:</strong> ${esc(rc.admissionId || '—')}</div>
                <div><strong>SĐT:</strong> ${esc(rc.phone || '—')} ${tel ? `<a href="${esc(tel)}">(Gọi ngay)</a>` : ''}</div>
                <div><strong>Chẩn đoán:</strong> ${esc(rc.diagnosis || '—')}</div>
                <div><strong>Phương pháp phẫu thuật:</strong> ${esc(rc.robotProcedure || '—')}</div>
                <div><strong>BS khu vực gửi:</strong> ${esc(rc.createdByName || rc.createdByUsername || '—')} · ${rc.labsReadyConfirmed ? '✅ Đủ XN tiền phẫu' : 'Chưa xác nhận XN'}</div>
                <div><strong>Lịch tư vấn TS. Hữu:</strong> ${rc.consultDate ? `${rc.consultSession === 'sang' ? 'Sáng' : 'Chiều'} ${fmtViDate(rc.consultDate)}` : 'Chưa xếp'}</div>
                <div><strong>Bác sĩ tư vấn / Người nhập KQ:</strong> ${esc(rc.consultedByName || 'TS. BSCKII. Nguyễn Phú Hữu')}${rc.consultDecidedByName ? ` (Nhập KQ: ${esc(rc.consultDecidedByName)})` : ''}</div>
                ${rc.consultNote ? `<div><strong>Ghi chú tư vấn:</strong> ${esc(rc.consultNote)}</div>` : ''}
                ${rc.refusalReason ? `<div><strong>Lý do không mổ:</strong> ${esc(this._refusalReasons()[rc.refusalReason] || rc.refusalReason)}</div>` : ''}
                ${rc.surgeryDate ? `<div><strong>Lịch phẫu thuật:</strong> ${fmtViDate(rc.surgeryDate)} ${rc.caseSlot ? `· ${esc(rc.caseSlot)}` : ''} · PTV: ${esc(this._surgeonDisplay(rc))}</div>` : ''}
                ${rc.note ? `<div><strong>Ghi chú khác:</strong> ${esc(rc.note)}</div>` : ''}
            </div>`;

            const footerBtns = [
                `<button type="button" class="btn btn-secondary" onclick="Modal.close()">Đóng</button>`
            ];
            if (rc.status === 'da_xep_robot') {
                footerBtns.push(`<button type="button" class="btn btn-secondary" data-rbt-action="open_print_single" data-rbt-code="${esc(code)}">🖨️ In P.CTXH A5</button>`);
            }
            if (p.canScheduleConsult && ['cho_xep_tu_van', 'da_xep_tu_van', 'can_nhac'].includes(rc.status)) {
                footerBtns.push(`<button type="button" class="btn btn-secondary" data-rbt-action="open_schedule_consult" data-rbt-code="${esc(code)}">📅 Xếp lịch TV</button>`);
            }
            if (p.canDecideConsult && ['cho_xep_tu_van', 'da_xep_tu_van', 'can_nhac'].includes(rc.status)) {
                footerBtns.push(`<button type="button" class="btn btn-primary" data-rbt-action="open_decide_consult" data-rbt-code="${esc(code)}">🩺 Nhập KQ tư vấn</button>`);
            }
            if (isSched && p.canEditSchedule) {
                footerBtns.push(`<button type="button" class="btn btn-secondary" data-rbt-action="open_edit_schedule" data-rbt-code="${esc(code)}">🗓️ Sửa lịch mổ</button>`);
            }
            if (isSched && p.canManageInpatientWait && rc.inpatientState !== 'xuat_vien_cho') {
                footerBtns.push(`<button type="button" class="btn btn-secondary" data-rbt-action="open_discharge_wait" data-rbt-code="${esc(code)}">🏠 XV chờ</button>`);
            }
            if (isSched && p.canManageInpatientWait && rc.inpatientState === 'xuat_vien_cho') {
                footerBtns.push(`<button type="button" class="btn btn-primary" data-rbt-action="confirm_readmit" data-rbt-code="${esc(code)}">✅ Nhập lại</button>`);
            }
            if (isSched && (p.canEditSchedule || p.canManageInpatientWait)) {
                footerBtns.push(`<button type="button" class="btn btn-secondary" data-rbt-action="open_postpone" data-rbt-code="${esc(code)}">⏸️ Hoãn mổ</button>`);
            }
            if (isSched && p.canEditSchedule) {
                footerBtns.push(`<button type="button" class="btn btn-primary" data-rbt-action="mark_completed" data-rbt-code="${esc(code)}">✅ Đã mổ</button>`);
            }
            if (canReopen) {
                footerBtns.push(`<button type="button" class="btn btn-primary" data-rbt-action="reopen_consult" data-rbt-code="${esc(code)}">🔄 Mở lại TV</button>`);
            }
            if (p.canManageRobot || p.canCreateConsult) {
                footerBtns.push(`<button type="button" class="btn btn-secondary" data-rbt-action="open_edit_info" data-rbt-code="${esc(code)}">✏️ Sửa thông tin</button>`);
            }
            if (rc.status !== 'da_xoa' && this._canSoftDeleteCase(rc)) {
                footerBtns.push(`<button type="button" class="btn btn-secondary rbt-btn-danger-outline" data-rbt-action="open_confirm_delete" data-rbt-code="${esc(code)}">🗑️ Xóa</button>`);
            }

            this._markModalOpen('detail', code);
            openRobotModal(`📋 Chi tiết hồ sơ ${code}`, html, footerBtns.join(''), { size: 'md', mode: 'detail' });
        },

        openMobileMenuModal() {
            const p = this._perms();
            const html = `<div class="rbt-sheet-list">
                <button type="button" id="rbt-mobile-menu-tutorial-btn" class="rbt-sheet-item rbt-sheet-item--guide" data-rbt-action="open_tutorial">
                    <span>❓ Hướng dẫn thao tác 7 bước</span>
                    <small>Xem tour hướng dẫn ngay trên tab</small>
                </button>
                <button type="button" class="rbt-sheet-item" data-rbt-action="copy_zalo_consult">
                    <span>📋 Copy lịch tư vấn gửi Zalo</span>
                    <small>Không kèm SĐT (Zero-PHI)</small>
                </button>
                <button type="button" class="rbt-sheet-item" data-rbt-action="open_print_modal">
                    <span>🖨️ In Giấy giới thiệu P.CTXH (A5)</span>
                    <small>Mẫu Màu / Laser Trắng Đen</small>
                </button>
                ${p.canDirectCreateCase ? `<button type="button" class="rbt-sheet-item rbt-sheet-item--primary" data-rbt-action="open_create_case">
                    <span>⚡ Tạo thẳng ca Lịch mổ Robot</span>
                    <small>Dành cho ĐP / BCN</small>
                </button>` : ''}
                <button type="button" class="rbt-sheet-item" data-rbt-action="refresh">
                    <span>🔄 Làm mới dữ liệu</span>
                    <small>Đồng bộ từ máy chủ</small>
                </button>
            </div>`;
            this._markModalOpen('mobile_menu', null);
            openRobotModal('Tiện ích Điều phối Robot', html, `<button type="button" class="btn btn-secondary" onclick="Modal.close()">Đóng</button>`, { size: 'sm', mode: 'mobile_menu' });
        },

        async copyZaloConsultSchedule() {
            const list = this._cases()
                .filter(c => c.status === 'da_xep_tu_van' && !c.isTestSandboxCase)
                .sort((a, b) => {
                    const da = String(a.consultDate || '9999-99-99');
                    const db = String(b.consultDate || '9999-99-99');
                    if (da !== db) return da.localeCompare(db);
                    return (a.consultSession === 'sang' ? 0 : 1) - (b.consultSession === 'sang' ? 0 : 1);
                });

            if (!list.length) {
                notifyToast('Hiện chưa có ca nào trong danh sách Đã xếp lịch tư vấn.', 'info');
                return;
            }

            const lines = ['📋 LỊCH TƯ VẤN PHẪU THUẬT ROBOT (TS. BSCKII. NGUYỄN PHÚ HỮU)', ''];
            let curGroup = '';
            let idx = 0;
            list.forEach(c => {
                const grp = `${fmtWeekdayVi(c.consultDate)}, ${fmtViDate(c.consultDate)} — ${c.consultSession === 'sang' ? 'BUỔI SÁNG' : 'BUỔI CHIỀU'}`;
                if (grp !== curGroup) {
                    if (curGroup) lines.push('');
                    lines.push(`📅 ${grp}:`);
                    curGroup = grp;
                    idx = 0;
                }
                idx += 1;
                const yr = c.birthYear ? ` (${c.birthYear})` : '';
                const proc = c.robotProcedure ? ` · PP: ${c.robotProcedure}` : '';
                const note = c.consultScheduleNote ? ` · Ghi chú: ${c.consultScheduleNote}` : '';
                lines.push(`${idx}. ${c.patientName}${yr} · ${roomLabel(c.wardRoom)} · CĐ: ${c.diagnosis || '—'}${proc}${note} [${c.robotCaseCode}]`);
            });
            const text = lines.join('\n');

            let copied = false;
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                    copied = true;
                }
            } catch (_) {
                copied = false;
            }

            if (copied) {
                notifyToast(`Đã copy lịch tư vấn (${list.length} ca) vào clipboard để dán Zalo!`, 'success');
                return;
            }

            this._markModalOpen('zalo_copy', null);
            openRobotModal(
                '📋 Lịch tư vấn gửi Zalo (Zero-PHI)',
                `<p>Trình duyệt chặn copy tự động — vui lòng bấm chọn và sao chép khung dưới đây:</p>
                <textarea class="form-input" rows="10" readonly onclick="this.select()">${esc(text)}</textarea>`,
                `<button type="button" class="btn btn-primary" onclick="Modal.close()">Đóng</button>`
            );
        },

        openPrintPctxhModal(caseCode = '') {
            const robotCases = this._cases()
                .filter(c => c.status === 'da_xep_robot' && !c.isTestSandboxCase)
                .sort((a, b) => String(a.surgeryDate || '').localeCompare(String(b.surgeryDate || '')));

            const targetCode = caseCode || (robotCases[0] && robotCases[0].robotCaseCode) || '';
            this._printState.caseCode = targetCode;
            this._printState.scope = targetCode ? 'single' : 'week';
            if (targetCode) {
                const found = this._findCase(targetCode);
                if (found && found.surgeryDate) this._printState.date = found.surgeryDate;
            }
            if (!this._printState.date) this._printState.date = this._todayIso();

            const html = `<div class="rbt-form-grid">
                <div>
                    <label class="form-label" for="rbt-inp-print-scope">Phạm vi in (Khổ A5 dọc)</label>
                    <select id="rbt-inp-print-scope" class="form-input">
                        <option value="single" ${this._printState.scope === 'single' ? 'selected' : ''}>1 Ca cụ thể (Giấy giới thiệu qua P.CTXH)</option>
                        <option value="date" ${this._printState.scope === 'date' ? 'selected' : ''}>Theo 1 ngày mổ</option>
                        <option value="week" ${this._printState.scope === 'week' ? 'selected' : ''}>Theo tuần đang xem</option>
                    </select>
                </div>
                <div>
                    <label class="form-label" for="rbt-inp-print-mode">Chế độ in</label>
                    <select id="rbt-inp-print-mode" class="form-input">
                        <option value="color" ${this._printState.mode === 'color' ? 'selected' : ''}>Màu (Navy BVBD)</option>
                        <option value="bw" ${this._printState.mode === 'bw' ? 'selected' : ''}>Laser Trắng Đen (#000000)</option>
                    </select>
                </div>
                <div>
                    <label class="form-label" for="rbt-inp-print-case">Ca Robot (nếu in 1 ca)</label>
                    <select id="rbt-inp-print-case" class="form-input">
                        ${robotCases.length
                            ? robotCases.map(c => `<option value="${esc(c.robotCaseCode)}" ${c.robotCaseCode === targetCode ? 'selected' : ''}>${esc(c.robotCaseCode)} · ${esc(c.patientName)} (${fmtViShortDate(c.surgeryDate)})</option>`).join('')
                            : `<option value="">(Chưa có ca Robot đang xếp lịch)</option>`}
                    </select>
                </div>
                <div>
                    <label class="form-label" for="rbt-inp-print-date">Ngày mổ (nếu in theo ngày)</label>
                    <div class="rbt-date-wrap"><input id="rbt-inp-print-date" type="date" class="form-input" value="${esc(this._printState.date)}"></div>
                </div>
            </div>
            <div id="rbt-print-preview-host" style="margin-top:14px;"></div>`;

            const footer = `<button type="button" class="btn btn-secondary" onclick="Modal.close()">Đóng</button>
                <button type="button" class="btn btn-primary" data-rbt-action="execute_print_pctxh">🖨️ In ngay (A5)</button>`;

            this._markModalOpen('print_pctxh', targetCode || null);
            openRobotModal('🖨️ In Giấy giới thiệu qua P.CTXH (Khổ A5)', html, footer, { size: 'wide', mode: 'print_pctxh' });
            this._syncPrintPreviewFromModal();
        },

        _syncPrintPreviewFromModal() {
            const mode = document.getElementById('rbt-inp-print-mode')?.value || 'color';
            const scope = document.getElementById('rbt-inp-print-scope')?.value || 'week';
            const dateIso = document.getElementById('rbt-inp-print-date')?.value || this._todayIso();
            const caseCode = document.getElementById('rbt-inp-print-case')?.value || '';
            this._printState = { ...this._printState, mode, scope, date: dateIso, caseCode };

            const host = document.getElementById('rbt-print-preview-host');
            if (!host) return;
            const sheetHtml = this._buildA5SheetHtml();
            host.innerHTML = sheetHtml;
            const root = document.getElementById('robot-pctxh-print-root');
            if (root) root.innerHTML = sheetHtml;
        },

        _buildA5SheetHtml() {
            const { mode, scope, date, caseCode, schedulerName } = this._printState;
            const robotCases = this._cases().filter(c => c.status === 'da_xep_robot' && !c.isTestSandboxCase);
            let rows = [];
            let subtitle = '';
            if (scope === 'single') {
                const rc = robotCases.find(c => c.robotCaseCode === caseCode);
                if (rc) rows = [rc];
                subtitle = rc ? `Giấy giới thiệu bệnh nhân tư vấn / xếp lịch qua Phòng Công tác Xã hội` : 'Chưa chọn ca Robot';
            } else if (scope === 'date') {
                rows = robotCases.filter(c => c.surgeryDate === date).sort((a, b) => String(a.caseSlot || '').localeCompare(String(b.caseSlot || '')));
                subtitle = `Lịch phẫu thuật Robot ngày ${fmtViDate(date)}`;
            } else {
                const startIso = this._weekStartIso || getMondayIso(this._todayIso());
                const endIso = addDaysIso(startIso, 6);
                rows = robotCases
                    .filter(c => c.surgeryDate >= startIso && c.surgeryDate <= endIso)
                    .sort((a, b) => String(a.surgeryDate || '').localeCompare(String(b.surgeryDate || '')) || String(a.caseSlot || '').localeCompare(String(b.caseSlot || '')));
                subtitle = `Lịch phẫu thuật Robot tuần ${fmtViDate(startIso)} – ${fmtViDate(endIso)}`;
            }

            const singleRc = (scope === 'single' && rows.length === 1) ? rows[0] : null;
            const bodyBlock = singleRc
                ? `<div class="rbt-a5-referral-card">
                    <div><strong>Mã hồ sơ:</strong> ${esc(singleRc.robotCaseCode)}</div>
                    <div><strong>Họ và tên bệnh nhân:</strong> ${esc(singleRc.patientName)} &nbsp;·&nbsp; <strong>Năm sinh:</strong> ${esc(singleRc.birthYear || '—')} &nbsp;·&nbsp; <strong>Giới:</strong> ${esc(singleRc.gender || '—')}</div>
                    <div><strong>Phòng bệnh:</strong> ${esc(roomLabel(singleRc.wardRoom))} &nbsp;·&nbsp; <strong>Số nhập viện:</strong> ${esc(singleRc.admissionId || '—')}</div>
                    <div><strong>Chẩn đoán:</strong> ${esc(singleRc.diagnosis || '—')}</div>
                    <div><strong>Phương pháp PT Robot:</strong> ${esc(singleRc.robotProcedure || '—')}</div>
                    <div><strong>Ngày mổ dự kiến:</strong> ${fmtViDate(singleRc.surgeryDate)} (${esc(singleRc.caseSlot || 'Ca 1')}) &nbsp;·&nbsp; <strong>PTV chính:</strong> ${esc(this._surgeonDisplay(singleRc))}</div>
                    <div><strong>Bác sĩ tư vấn Robot:</strong> ${esc(singleRc.consultedByName || 'TS. BSCKII. Nguyễn Phú Hữu')}</div>
                    <div><strong>Tình trạng lưu trú:</strong> ${singleRc.inpatientState === 'xuat_vien_cho' ? `Xuất viện chờ (Hẹn nhập lại ${fmtViDate(singleRc.plannedReadmitDate)})` : 'Đang nằm viện'}</div>
                </div>`
                : `<table class="rbt-a5-table">
                    <thead>
                        <tr>
                            <th>Ngày / Ca</th>
                            <th>Họ tên BN (NS)</th>
                            <th>Phòng</th>
                            <th>Chẩn đoán &amp; PP Robot</th>
                            <th>PTV</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.length ? rows.map(c => `<tr>
                            <td class="rbt-col-nowrap">${fmtViShortDate(c.surgeryDate)}<br>${esc(c.caseSlot || '')}</td>
                            <td>${esc(c.patientName)} (${esc(c.birthYear || '—')})</td>
                            <td class="rbt-col-nowrap">${esc(roomLabel(c.wardRoom))}</td>
                            <td>${esc(c.diagnosis || '')} — ${esc(c.robotProcedure || '')}</td>
                            <td class="rbt-col-surgeon">${esc(this._surgeonDisplay(c))}</td>
                        </tr>`).join('') : `<tr><td colspan="5">Chưa có ca mổ Robot trong khoảng thời gian đã chọn.</td></tr>`}
                    </tbody>
                </table>`;

            return `<div class="rbt-a5-sheet ${mode === 'bw' ? 'rbt-a5-sheet--bw' : ''}">
                <div class="rbt-a5-sheet__top">
                    <img src="img/logo-khoa.jpg" alt="Logo Khoa PTĐTT" class="rbt-a5-sheet__logo">
                    <div class="rbt-a5-sheet__org">
                        <div class="rbt-a5-sheet__hosp">BỆNH VIỆN BÌNH DÂN · P.CTXH (A5)</div>
                        <div class="rbt-a5-sheet__dept">KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG</div>
                    </div>
                </div>
                <div class="rbt-a5-sheet__title">GIẤY GIỚI THIỆU PHẪU THUẬT ROBOT QUA P.CTXH</div>
                <div class="rbt-a5-sheet__subtitle">${esc(subtitle)}</div>
                ${bodyBlock}
                <div class="rbt-a5-sheet__footer">
                    <div>Người gửi / Điều phối: <strong>${esc(schedulerName || 'BSCKII. Võ Chí Nguyện')}</strong></div>
                    <div>TS. BSCKII. Nguyễn Phú Hữu<br><small>Trưởng khoa PT Đại trực tràng</small></div>
                </div>
            </div>`;
        },

        _executePrint() {
            this._syncPrintPreviewFromModal();
            if (document.body) document.body.classList.add('printing-robot-pctxh');
            if (typeof global.print === 'function') global.print();
        },

        _attachConflictOverride(body) {
            if (this._conflictState && this._conflictState.fingerprint) {
                const chk = document.getElementById('rbt-inp-override-confirm');
                const rsn = document.getElementById('rbt-inp-override-reason');
                if (chk && chk.checked) {
                    body.confirmConflict = true;
                    body.conflictOverrideReason = (rsn && rsn.value ? rsn.value.trim() : '');
                    body.expectedConflictFingerprint = this._conflictState.fingerprint;
                }
            }
        },

        _handleMutationError(err) {
            const data = err.data || {};
            if (err.status === 409 && err.code === 'ROBOT_SCHEDULE_CONFLICT') {
                this._conflictState = {
                    fingerprint: data.conflictFingerprint || '',
                    conflicts: data.conflicts || []
                };
                const host = document.getElementById('rbt-modal-conflict-host');
                if (host) {
                    const items = (data.conflicts || []).map(c => `<li>${esc(c.patientName || c.robotCaseCode)} (${fmtViDate(c.surgeryDate)} · ${esc(c.caseSlot || '')})</li>`).join('');
                    host.innerHTML = `<div class="rbt-conflict-box" style="margin-top:12px;">
                        <strong>⚠️ Phát hiện trùng lịch hoặc vượt 3 ca Robot/ngày:</strong>
                        <ul class="rbt-conflict-list">${items}</ul>
                        <label class="rbt-check-card" style="margin-top:8px;">
                            <input id="rbt-inp-override-confirm" type="checkbox">
                            <span>Tôi hiểu cảnh báo và muốn ghi đè ngoại lệ (Override)</span>
                        </label>
                        <input id="rbt-inp-override-reason" type="text" class="form-input" style="margin-top:6px;" placeholder="Nhập lý do ngoại lệ (bắt buộc tối thiểu 5 ký tự)">
                    </div>`;
                }
            }
            notifyToast(err.message || 'Thao tác thất bại.', 'error');
        },

        async _sendPatch(code, body, successMsg, btnEl) {
            if (btnEl) btnEl.disabled = true;
            try {
                if (!this._inflightIdem) this._inflightIdem = newIdempotencyKey();
                const res = await this._apiJson(`/api/robot/cases/${encodeURIComponent(code)}`, {
                    method: 'PATCH',
                    body,
                    idempotencyKey: this._inflightIdem
                });
                this._upsertCaseInMemory(res.case);
                await this.ensureLoaded(true).catch(() => {});
                if (typeof Modal !== 'undefined' && Modal.close) Modal.close(true);
                notifyToast(successMsg, 'success');
                this._rerenderPage();
                return true;
            } catch (err) {
                this._handleMutationError(err);
                return false;
            } finally {
                if (btnEl) btnEl.disabled = false;
            }
        },

        async _submitSimplePatch(code, action, extraBody, successMsg) {
            const rc = this._findCase(code);
            if (!rc) return;
            await this._sendPatch(code, {
                action,
                expectedRevision: Number(rc.caseRevision || 1),
                ...(extraBody || {})
            }, successMsg, null);
        },

        async _submitArchiveDelete(code) {
            const rc = this._findCase(code);
            if (!rc) return;
            try {
                await this._apiJson(`/api/robot/cases/${encodeURIComponent(code)}`, {
                    method: 'DELETE',
                    body: { expectedRevision: Number(rc.caseRevision || 1) }
                });
                await this.ensureLoaded(true).catch(() => {});
                notifyToast('Đã lưu trữ ẩn hồ sơ (Zero-RM).', 'success');
                this._rerenderPage();
            } catch (err) {
                this._handleMutationError(err);
            }
        },

        async _submitConfigSave(btnEl) {
            if (btnEl) btnEl.disabled = true;
            try {
                const coords = Array.from(document.querySelectorAll('.rbt-cfg-coord:checked')).map(el => el.value);
                const body = {
                    coordinators: coords,
                    defaultSchedulerName: document.getElementById('rbt-cfg-scheduler')?.value?.trim() || 'BSCKII. Võ Chí Nguyện',
                    postponeLookbackDays: Number(document.getElementById('rbt-cfg-lookback')?.value || 7),
                    trashAutoArchiveDays: Number(document.getElementById('rbt-cfg-archive')?.value || 14),
                    expectedConfigRevision: Number((this._bootstrap && this._bootstrap.configRevision) || 1)
                };
                await this._apiJson('/api/robot/config', { method: 'PUT', body });
                await this.ensureLoaded(true);
                notifyToast('Đã lưu cấu hình Điều phối Robot.', 'success');
                this._rerenderPage();
            } catch (err) {
                this._handleMutationError(err);
            } finally {
                if (btnEl) btnEl.disabled = false;
            }
        }
    };

    global.RobotSchedulePage = RobotSchedulePage;
})(window);
