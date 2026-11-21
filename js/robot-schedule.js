// ===== ROBOTIC SURGERY COORDINATION MODULE (FEAT-231) =====
// Zero-Local-PHI compliant: RAM-only state, no localStorage/sessionStorage/IndexedDB/autosave.
// Strict XSS escaping via Utils.escapeHtml and delegated event handlers.

(function (global) {
    'use strict';

    const SUBTABS = [
        { key: 'week', label: '📅 Lịch tuần Robot' },
        { key: 'consult', label: '🩺 Tư vấn & Chờ xếp lịch' },
        { key: 'postponed', label: '⏸️ Hoãn mổ & Xuất viện chờ' },
        { key: 'completed', label: '✅ Đã mổ & Thống kê' },
        { key: 'trash', label: '🗑️ Thùng rác' },
        { key: 'config', label: '⚙️ Cấu hình Điều phối', bcnOnly: true }
    ];

    const STATUS_META = {
        tu_van: { label: 'Chờ tư vấn', badge: 'rbt-badge--indigo' },
        can_nhac: { label: 'Đang cân nhắc', badge: 'rbt-badge--amber' },
        tu_choi: { label: 'Từ chối mổ Robot', badge: 'rbt-badge--red' },
        cho_xep_lich: { label: 'Chờ xếp lịch (B1)', badge: 'rbt-badge--ocean' },
        cho_duyet_tien_phau: { label: 'B1→B2: Chờ tiền phẫu', badge: 'rbt-badge--amber' },
        cho_duyet_luu_vien: { label: 'B2→B3: Chờ lưu viện', badge: 'rbt-badge--ocean' },
        cho_mo: { label: 'B3: Chờ mổ (Lịch tuần)', badge: 'rbt-badge--green' },
        da_mo: { label: 'Đã phẫu thuật Robot', badge: 'rbt-badge--navy' },
        hoan_mo: { label: 'Hoãn mổ', badge: 'rbt-badge--red' },
        xuat_vien_cho: { label: 'Xuất viện chờ', badge: 'rbt-badge--indigo' },
        da_xoa: { label: 'Thùng rác', badge: 'rbt-badge--red' },
        archived_deleted: { label: 'Đã lưu trữ ẩn', badge: 'rbt-badge--navy' }
    };

    const SAP_STATUS_SHORT = {
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

    const esc = (v) => (typeof Utils !== 'undefined' && Utils.escapeHtml)
        ? Utils.escapeHtml(v == null ? '' : String(v))
        : String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

    const _getClientBuild = () => String(
        (typeof window !== 'undefined' && (window.SW_BUILD_VER || window.REQUIRED_VER)) ||
        (typeof CLIENT_BUILD !== 'undefined' ? CLIENT_BUILD : '2611211733')
    );

    const _parseIsoLocal = (isoStr) => {
        if (!isoStr || typeof isoStr !== 'string') return null;
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoStr.trim());
        if (!m) return null;
        const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        return isNaN(dt.getTime()) ? null : dt;
    };

    const _fmtIsoLocal = (dt) => {
        if (!(dt instanceof Date) || isNaN(dt.getTime())) return '';
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const _fmtViDate = (isoStr) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoStr || '').trim());
        return m ? `${m[3]}/${m[2]}/${m[1]}` : (isoStr || '—');
    };

    const _mondayOf = (isoStr) => {
        const dt = _parseIsoLocal(isoStr) || new Date();
        const day = dt.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const res = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + diff);
        return res;
    };

    const _daysBetweenIso = (olderIso, newerIso) => {
        const d1 = _parseIsoLocal(olderIso);
        const d2 = _parseIsoLocal(newerIso);
        if (!d1 || !d2) return null;
        return Math.round((d2.getTime() - d1.getTime()) / 86400000);
    };

    const _addDaysIso = (baseIso, deltaDays) => {
        const dt = _parseIsoLocal(baseIso) || new Date();
        dt.setDate(dt.getDate() + Number(deltaDays || 0));
        return _fmtIsoLocal(dt);
    };

    const _safeTelHref = (rc) => {
        if (!rc || rc.phoneMasked === true) return '';
        const raw = String(rc.phone || '').trim();
        if (!raw || raw.includes('*')) return '';
        const digits = raw.replace(/[^\d+]/g, '');
        const pureDigits = digits.replace(/\D/g, '');
        return pureDigits.length >= 9 ? `tel:${digits}` : '';
    };

    const _newUuid = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `rbt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    };

    const RobotSchedulePage = {
        _bootstrap: null,
        _loading: false,
        _loadPromise: null,
        _error: null,
        _subtab: 'week',
        _weekStartIso: null,
        _mobileDayIso: null,
        _mobileWeekAllDays: false,
        _mobileSearchOpen: false,
        _mobileSurgeonFilter: 'all',
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
            schedulerName: ''
        },

        purgeMemoryState() {
            this._bootstrap = null;
            this._loading = false;
            this._loadPromise = null;
            this._error = null;
            this._mobileDayIso = null;
            this._mobileWeekAllDays = false;
            this._mobileSearchOpen = false;
            this._mobileSurgeonFilter = 'all';
            this._completedVisibleLimit = 20;
            this._modalDirty = false;
            this._modalDirtyWarnShown = false;
            this._modalActive = false;
            this._openModalMode = null;
            this._openCaseCode = null;
            this._conflictState = null;
            this._inflightIdem = null;
            this._printState = { mode: 'color', scope: 'week', date: '', schedulerName: '' };
            const printRoot = document.getElementById('robot-pctxh-print-root');
            if (printRoot) printRoot.innerHTML = '';
            if (document.body) document.body.classList.remove('printing-robot-pctxh');
        },

        canCloseModal(force = false) {
            if (force || !this._modalActive || !this._modalDirty) return true;
            if (this._modalDirtyWarnShown) return true;
            this._modalDirtyWarnShown = true;
            const box = document.getElementById('rbt-modal-dirty-guard');
            if (box) {
                box.hidden = false;
                box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else if (typeof Toast !== 'undefined') {
                Toast.warning('Bạn có thay đổi chưa lưu — bấm Đóng lần nữa để hủy thay đổi.');
            }
            return false;
        },

        _onModalClosed() {
            this._modalActive = false;
            this._modalDirty = false;
            this._modalDirtyWarnShown = false;
            this._openModalMode = null;
            this._openCaseCode = null;
            this._conflictState = null;
            this._inflightIdem = null;
            const fab = document.getElementById('rbt-mobile-fab');
            if (fab) fab.hidden = false;
            const printRoot = document.getElementById('robot-pctxh-print-root');
            if (printRoot) printRoot.innerHTML = '';
            if (document.body) document.body.classList.remove('printing-robot-pctxh');
        },

        _bindEvents() {
            const main = document.getElementById('main-content');
            if (main && !this._delegatedBound) {
                this._delegatedBound = true;
                main.addEventListener('click', (e) => {
                    const btn = e.target.closest('[data-rbt-action]');
                    if (!btn || !main.contains(btn)) return;
                    const act = btn.getAttribute('data-rbt-action');
                    const code = btn.getAttribute('data-rbt-code') || '';
                    const sid = btn.getAttribute('data-rbt-sid') || '';
                    this._handleUiAction(act, code, sid, btn);
                });
                main.addEventListener('change', (e) => {
                    const el = e.target;
                    if (!el.closest('.rbt-page')) return;
                    if (el.id === 'rbt-filter-reason') {
                        this._postponeFilterReason = el.value || 'all';
                        this._rerenderInPlace();
                    } else if (el.id === 'rbt-stats-year') {
                        this._statsYear = el.value || 'all';
                        this._completedVisibleLimit = 20;
                        this._rerenderInPlace();
                    } else if (el.id === 'rbt-stats-month') {
                        this._statsMonth = el.value || 'all';
                        this._completedVisibleLimit = 20;
                        this._rerenderInPlace();
                    } else if (el.id === 'rbt-stats-surgeon') {
                        this._statsSurgeon = el.value || 'all';
                        this._completedVisibleLimit = 20;
                        this._rerenderInPlace();
                    } else if (el.id === 'rbt-mobile-surgeon-filter') {
                        this._mobileSurgeonFilter = el.value || 'all';
                        this._rerenderInPlace();
                    }
                });
                main.addEventListener('input', (e) => {
                    const el = e.target;
                    if (el && (el.id === 'rbt-search-input' || el.id === 'rbt-mobile-search-input')) {
                        this._searchQuery = el.value || '';
                        this._rerenderInPlace({ keepFocusId: el.id, selectionStart: el.selectionStart, selectionEnd: el.selectionEnd });
                    }
                });
            }

            if (!this._printCleanupBound && typeof window !== 'undefined') {
                this._printCleanupBound = true;
                window.addEventListener('afterprint', () => {
                    const printRoot = document.getElementById('robot-pctxh-print-root');
                    if (printRoot) printRoot.innerHTML = '';
                    if (document.body) document.body.classList.remove('printing-robot-pctxh');
                });
            }
        },

        async _apiJson(url, opts = {}) {
            const token = typeof Auth !== 'undefined' ? Auth.getToken() : '';
            const method = (opts.method || 'GET').toUpperCase();
            const headers = {
                'Authorization': `Bearer ${token || ''}`,
                'X-Client-Build': _getClientBuild(),
                ...(opts.headers || {})
            };
            let bodyStr = undefined;
            if (opts.body !== undefined) {
                headers['Content-Type'] = 'application/json';
                bodyStr = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
            }
            if (method !== 'GET' && !headers['Idempotency-Key']) {
                const sig = `${method}:${url}:${bodyStr || ''}`;
                if (this._inflightIdem && this._inflightIdem.sig === sig) {
                    headers['Idempotency-Key'] = this._inflightIdem.key;
                } else {
                    const key = _newUuid();
                    this._inflightIdem = { sig, key };
                    headers['Idempotency-Key'] = key;
                }
            }
            const resp = await fetch(url, {
                method,
                headers,
                body: bodyStr,
                signal: (typeof Auth !== 'undefined' && Auth.getActiveSignal) ? Auth.getActiveSignal() : undefined
            });
            let data = {};
            try { data = await resp.json(); } catch (_) {}
            if (!resp.ok) {
                if (resp.status === 401 && typeof Auth !== 'undefined') {
                    this.purgeMemoryState();
                }
                const err = new Error(data.error || data.message || `HTTP ${resp.status}`);
                err.status = resp.status;
                err.code = data.code || data.errorCode || '';
                err.data = data;
                throw err;
            }
            this._inflightIdem = null;
            return data;
        },

        async loadBootstrap(force = false) {
            if (this._loading && this._loadPromise && !force) {
                return this._loadPromise;
            }
            this._loading = true;
            this._error = null;
            const p = this._apiJson('/api/robot/bootstrap')
                .then((data) => {
                    this._bootstrap = data;
                    if (!this._weekStartIso) {
                        this._weekStartIso = _fmtIsoLocal(_mondayOf(data.todayVn || _fmtIsoLocal(new Date())));
                    }
                    if (!this._printState.schedulerName) {
                        this._printState.schedulerName = (data.robotConfig && data.robotConfig.defaultSchedulerName) || 'Quang';
                    }
                    if (!this._printState.date) {
                        this._printState.date = data.todayVn || _fmtIsoLocal(new Date());
                    }
                    this._loading = false;
                    return data;
                })
                .catch((err) => {
                    this._loading = false;
                    this._error = err.message || 'Không thể tải dữ liệu Điều phối Robot.';
                    throw err;
                });
            this._loadPromise = p;
            return p;
        },

        async _refreshBoth(syncWeeklyStore = true) {
            await this.loadBootstrap(true);
            if (syncWeeklyStore && typeof Store !== 'undefined' && typeof Store._syncFromServer === 'function') {
                Store._lastEtag = null;
                try { await Store._syncFromServer(true); } catch (_) {}
            }
            if (typeof App !== 'undefined' && (App.currentPage === 'robot-schedule' || App.currentPage === 'surgery' || App.currentPage === 'surgery-approval')) {
                this._rerenderInPlace();
            }
        },

        _syncActiveScrollStrips() {
            try {
                document.querySelector('#robot-schedule-page .rbt-subtab.is-active')?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
                document.querySelector('#robot-schedule-page .rbt-day-pill.is-active')?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
            } catch (_) {}
        },

        _rerenderInPlace(focusOpts = null) {
            if (typeof App !== 'undefined' && App.currentPage !== 'robot-schedule') return;
            const main = document.getElementById('main-content');
            if (!main) return;
            main.innerHTML = this.render();
            this._syncActiveScrollStrips();
            if (focusOpts && focusOpts.keepFocusId) {
                const inp = document.getElementById(focusOpts.keepFocusId);
                if (inp) {
                    inp.focus();
                    if (typeof focusOpts.selectionStart === 'number') {
                        try { inp.setSelectionRange(focusOpts.selectionStart, focusOpts.selectionEnd); } catch (_) {}
                    }
                }
            }
        },

        render() {
            const bs = this._bootstrap;
            if (!bs) {
                return `
                    <div class="rbt-page">
                        <div class="rbt-header">
                            <div class="rbt-header__title-wrap">
                                <h1 class="rbt-header__title">🤖 Điều phối Lịch mổ Robot</h1>
                                <p class="rbt-header__sub">Liên thông nguyên tử 2 chiều với Lịch mổ tuần Khoa PTĐTT · Zero-Local-PHI</p>
                            </div>
                        </div>
                        <div class="rbt-panel">
                            ${this._error
                                ? `<div class="rbt-conflict-box">⚠️ ${esc(this._error)} <button type="button" class="btn btn-secondary btn-sm" data-rbt-action="reload" style="margin-left:8px;">Tải lại</button></div>`
                                : `<div class="rbt-empty">⏳ Đang đồng bộ dữ liệu Điều phối Robot từ máy chủ...</div>`
                            }
                        </div>
                    </div>
                `;
            }

            const perms = bs.permissions || {};
            const cases = Array.isArray(bs.cases) ? bs.cases : [];
            const hist = Array.isArray(bs.historicalRobotSurgeries) ? bs.historicalRobotSurgeries : [];
            const activeWeekCases = cases.filter(c => ['cho_duyet_tien_phau', 'cho_duyet_luu_vien', 'cho_mo'].includes(c.status));
            const consultCases = cases.filter(c => ['tu_van', 'can_nhac', 'tu_choi', 'cho_xep_lich'].includes(c.status));
            const postponedCases = cases.filter(c => ['hoan_mo', 'xuat_vien_cho'].includes(c.status));
            const completedRealCases = cases.filter(c => c.status === 'da_mo' && !c.isTestSandboxCase);
            const trashCases = cases.filter(c => c.status === 'da_xoa');

            const realCompletedIds = new Set(completedRealCases.map(c => Number(c.canonicalSurgeryId)).filter(Boolean));
            const uniqueHistorical = hist.filter(h => !realCompletedIds.has(Number(h.id)));
            const totalCompletedReal = completedRealCases.length + uniqueHistorical.length;
            const postponedRealCount = cases.filter(c => c.status === 'hoan_mo' && !c.isTestSandboxCase).length;
            const denom = totalCompletedReal + postponedRealCount;
            const postponeRatePct = denom > 0 ? ((postponedRealCount / denom) * 100).toFixed(1) : '0.0';

            const roleLabel = perms.isBcn
                ? 'Ban Chủ nhiệm (Toàn quyền)'
                : (perms.isCoordinator ? 'Điều phối viên Robot' : (perms.canCreate ? 'Bác sĩ điều trị / ĐD Trưởng' : 'Xem lịch (SĐT ẩn)'));
            const shortRoleLabel = perms.isBcn
                ? 'BCN'
                : (perms.isCoordinator ? 'Điều phối' : (perms.canCreate ? 'BS ĐT' : 'Chỉ xem'));

            const subtabCounts = {
                week: activeWeekCases.length,
                consult: consultCases.length,
                postponed: postponedCases.length,
                completed: totalCompletedReal,
                trash: trashCases.length
            };

            const tabsHtml = SUBTABS
                .filter(t => !t.bcnOnly || perms.canConfigureCoordinators)
                .map(t => `
                    <button type="button"
                        class="rbt-subtab ${this._subtab === t.key ? 'is-active' : ''}"
                        data-rbt-action="subtab"
                        data-rbt-code="${esc(t.key)}">
                        <span>${esc(t.label)}</span>
                        ${subtabCounts[t.key] != null ? `<span class="rbt-subtab-badge">${subtabCounts[t.key]}</span>` : ''}
                    </button>
                `).join('');

            const unlinkedCount = (bs.unlinkedFutureRobotSurgeries || []).length;
            const canShowFab = Boolean(
                perms.canCreateConsult
                || perms.canDirectCreateCase
                || (perms.canLinkExistingSurgery && unlinkedCount > 0)
            );
            const surgeonsList = Array.isArray(bs.surgeons) ? bs.surgeons : [];

            let bodyHtml = '';
            if (this._subtab === 'week') bodyHtml = this._renderWeekTab(cases);
            else if (this._subtab === 'consult') bodyHtml = this._renderConsultTab(consultCases, perms);
            else if (this._subtab === 'postponed') bodyHtml = this._renderPostponedTab(postponedCases, perms);
            else if (this._subtab === 'completed') bodyHtml = this._renderCompletedTab(cases, uniqueHistorical, perms);
            else if (this._subtab === 'trash') bodyHtml = this._renderTrashTab(trashCases, perms);
            else if (this._subtab === 'config' && perms.canConfigureCoordinators) bodyHtml = this._renderConfigTab();

            return `
                <div class="rbt-page" id="robot-schedule-page">
                    <div class="rbt-header">
                        <div class="rbt-header__title-wrap">
                            <h1 class="rbt-header__title">
                                <span class="rbt-desktop-only">🤖 Điều phối Lịch mổ Robot</span>
                                <span class="rbt-mobile-only">🤖 Mổ Robot</span>
                                <span class="rbt-role-pill rbt-desktop-only">${esc(roleLabel)}</span>
                                <span class="rbt-role-pill rbt-mobile-only">${esc(shortRoleLabel)}</span>
                            </h1>
                            <p class="rbt-header__sub">B1 Tư vấn/Xếp lịch → B2 Duyệt tiền phẫu → B3 Lưu viện &amp; Đồng bộ Lịch mổ tuần · Không lưu PHI tại trình duyệt</p>
                        </div>
                        <div class="rbt-header__actions rbt-desktop-only">
                            ${perms.canCreateConsult ? `<button type="button" class="btn btn-sm rbt-btn-light" data-rbt-action="open_create_consult">+ Ca tư vấn</button>` : ''}
                            ${perms.canDirectCreateCase ? `<button type="button" class="btn btn-sm rbt-btn-outline-light" data-rbt-action="open_create_case">+ Tạo lịch Robot</button>` : ''}
                            ${perms.canLinkExistingSurgery && unlinkedCount > 0 ? `<button type="button" class="btn btn-sm rbt-btn-outline-light" data-rbt-action="open_link_surgery">🔗 Gắn ca từ Lịch tuần (${unlinkedCount})</button>` : ''}
                            <button type="button" class="btn btn-sm rbt-btn-outline-light" data-rbt-action="open_print_pctxh">🖨️ In A5 P.CTXH</button>
                            <button type="button" class="btn btn-sm rbt-btn-outline-light" data-rbt-action="reload" title="Đồng bộ lại">↻</button>
                        </div>
                        <div class="rbt-mobile-hdr-tools rbt-mobile-only-flex">
                            ${canShowFab ? `<button type="button" id="rbt-mobile-fab" class="rbt-mobile-icon-btn rbt-mobile-fab-hdr rbt-fab rbt-mobile-only-flex" data-rbt-action="open_fab_sheet" aria-label="Tạo hồ sơ Robot mới" title="Tạo hồ sơ Robot mới">+</button>` : ''}
                            <button type="button" class="rbt-mobile-icon-btn ${this._mobileSearchOpen ? 'is-active' : ''}" data-rbt-action="toggle_mobile_search" aria-label="Tìm kiếm và lọc ca" title="Tìm kiếm &amp; Lọc">${this._mobileSearchOpen ? '✕' : '🔍'}</button>
                            <button type="button" class="rbt-mobile-icon-btn" data-rbt-action="open_mobile_menu" aria-label="Menu tiện ích Robot" title="In A5 &amp; Đồng bộ">⋮</button>
                        </div>
                    </div>

                    ${this._mobileSearchOpen ? `
                        <div class="rbt-mobile-search-bar rbt-mobile-only">
                            <div class="rbt-mobile-search-row">
                                <input type="search" id="rbt-mobile-search-input" class="form-input" value="${esc(this._searchQuery)}" placeholder="Tìm tên BN, mã RB, BS, số NV..." aria-label="Tìm ca Robot">
                                ${(this._searchQuery || this._mobileSurgeonFilter !== 'all') ? `<button type="button" class="btn btn-secondary btn-sm" data-rbt-action="clear_mobile_filters" style="min-height:44px;flex-shrink:0;">Xóa</button>` : ''}
                            </div>
                            <select id="rbt-mobile-surgeon-filter" class="form-select" aria-label="Lọc theo PTV chính">
                                <option value="all" ${this._mobileSurgeonFilter === 'all' ? 'selected' : ''}>Tất cả PTV chính</option>
                                ${surgeonsList.map(st => `<option value="${esc(st.id)}" ${String(this._mobileSurgeonFilter) === String(st.id) ? 'selected' : ''}>${esc(st.title ? `${st.title} ${st.name}` : st.name)}</option>`).join('')}
                            </select>
                        </div>
                    ` : ''}

                    <div class="rbt-kpi-grid">
                        <div class="rbt-kpi-card rbt-kpi-card--amber" data-rbt-action="kpi_jump" data-rbt-code="consult" role="button" tabindex="0">
                            <div class="rbt-kpi-label">Chờ xếp lịch / Tiền phẫu</div>
                            <div class="rbt-kpi-value">${cases.filter(c => ['cho_xep_lich', 'cho_duyet_tien_phau', 'cho_duyet_luu_vien'].includes(c.status)).length}</div>
                            <div class="rbt-kpi-meta">${consultCases.length} ca đang tư vấn / cân nhắc</div>
                        </div>
                        <div class="rbt-kpi-card rbt-kpi-card--green" data-rbt-action="kpi_jump" data-rbt-code="week" role="button" tabindex="0">
                            <div class="rbt-kpi-label">B3 Chờ mổ (Lịch tuần)</div>
                            <div class="rbt-kpi-value">${cases.filter(c => c.status === 'cho_mo').length}</div>
                            <div class="rbt-kpi-meta">Đồng bộ 2 chiều Lịch mổ tuần</div>
                        </div>
                        <div class="rbt-kpi-card rbt-kpi-card--navy" data-rbt-action="kpi_jump" data-rbt-code="completed" role="button" tabindex="0">
                            <div class="rbt-kpi-label">Đã phẫu thuật Robot</div>
                            <div class="rbt-kpi-value">${totalCompletedReal}</div>
                            <div class="rbt-kpi-meta">Lịch sử (${uniqueHistorical.length}) + Điều phối (${completedRealCases.length})</div>
                        </div>
                        <div class="rbt-kpi-card rbt-kpi-card--indigo" data-rbt-action="kpi_jump" data-rbt-code="postponed" role="button" tabindex="0">
                            <div class="rbt-kpi-label">Hoãn mổ / Xuất viện chờ</div>
                            <div class="rbt-kpi-value">${postponedCases.length}</div>
                            <div class="rbt-kpi-meta">Tỷ lệ hoãn thực: ${postponeRatePct}%</div>
                        </div>
                    </div>

                    <div class="rbt-subtabs-wrap" role="tablist" aria-label="Phân mục Điều phối Robot">
                        ${tabsHtml}
                    </div>

                    ${bodyHtml}
                </div>
            `;
        },

        afterRender() {
            this._bindEvents();
            this._syncActiveScrollStrips();
            if (!this._bootstrap && !this._loading) {
                this.loadBootstrap(false)
                    .then(() => this._rerenderInPlace())
                    .catch(() => this._rerenderInPlace());
            }
        },

        _getLinkedSurgeryById(sid) {
            if (!sid || typeof Store === 'undefined') return null;
            return (Store.getAll('surgeries') || []).find(s => Number(s.id) === Number(sid)) || null;
        },

        _formatApprovalBadgeHtml(rc) {
            if (!rc || !rc.activeLinkedSurgeryId) return '';
            const s = this._getLinkedSurgeryById(rc.activeLinkedSurgeryId);
            const st = s && s.approval ? s.approval.status : '';
            if (!st) return '';
            const cls = (st === 'approved' || st === 'approved_with_exception') ? 'rbt-badge--green'
                : (st === 'reapproval_required' || st === 'resubmit_required' || st === 'post_approval_hold' ? 'rbt-badge--red' : 'rbt-badge--amber');
            return `<span class="rbt-badge ${cls}">${esc(SAP_STATUS_SHORT[st] || `Duyệt khoa: ${st}`)}</span>`;
        },

        _renderCaseCard(rc, perms) {
            const code = rc.robotCaseCode || rc.soNV || '';
            const stMeta = STATUS_META[rc.status] || { label: rc.status, badge: 'rbt-badge--navy' };
            const phoneDisplay = rc.phone
                ? `${esc(rc.phone)}${rc.phoneMasked ? ' (ẩn)' : ''}`
                : '—';

            const actions = [];
            if (rc.status === 'cho_duyet_tien_phau' && perms.canApproveSteps) {
                actions.push(`<button type="button" class="btn btn-primary rbt-btn-xs" data-rbt-action="step2_preop" data-rbt-code="${esc(code)}">✓ B2 Tiền phẫu</button>`);
            }
            if (rc.status === 'cho_duyet_luu_vien' && perms.canApproveSteps) {
                if (rc.postB2ClinicalDirty) {
                    actions.push(`<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_edit_info" data-rbt-code="${esc(code)}">Xem lại hồ sơ</button>`);
                } else {
                    actions.push(`<button type="button" class="btn btn-primary rbt-btn-xs" data-rbt-action="step3_inpatient" data-rbt-code="${esc(code)}">✓ B3 Chờ mổ</button>`);
                }
            }
            if (perms.canEditSchedule && ['cho_duyet_tien_phau', 'cho_duyet_luu_vien', 'cho_mo'].includes(rc.status)) {
                actions.push(`<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_edit_schedule" data-rbt-code="${esc(code)}">🗓️ Đổi lịch</button>`);
            }
            if ((perms.canPostponeOrDischarge || (perms.staffId && Number(perms.staffId) === Number(rc.mainSurgeonId))) && ['cho_duyet_tien_phau', 'cho_duyet_luu_vien', 'cho_mo'].includes(rc.status)) {
                actions.push(`<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_postpone" data-rbt-code="${esc(code)}">⏸️ Hoãn</button>`);
            }
            if (perms.canPostponeOrDischarge && ['cho_duyet_tien_phau', 'cho_duyet_luu_vien', 'cho_mo'].includes(rc.status)) {
                actions.push(`<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_discharge" data-rbt-code="${esc(code)}">🏠 XV chờ</button>`);
            }
            if (perms.canEditInfo) {
                actions.push(`<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_edit_info" data-rbt-code="${esc(code)}">✏️ Sửa</button>`);
            }
            if (perms.canSoftDelete) {
                actions.push(`<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="soft_delete" data-rbt-code="${esc(code)}">🗑️</button>`);
            }

            return `
                <article class="rbt-case-card rbt-case-card--${esc(rc.status)}" data-robot-code="${esc(code)}">
                    <div class="rbt-case-top">
                        <span class="rbt-case-code">${esc(code)}</span>
                        <span class="rbt-badge ${stMeta.badge}">${esc(stMeta.label)}</span>
                    </div>
                    ${rc.isTestSandboxCase ? `<div><span class="rbt-badge rbt-badge--sandbox">🧪 TEST SANDBOX</span></div>` : ''}
                    <div class="rbt-case-name">${esc(rc.patientName)} ${rc.birthYear ? `(${esc(rc.birthYear)})` : ''}</div>
                    <div class="rbt-case-meta">
                        <div>📋 ${esc(rc.diagnosis || 'Chưa ghi chẩn đoán')}</div>
                        <div>🤖 ${esc(rc.robotProcedure || 'Chưa ghi PPPT')}</div>
                        <div>🔪 ${esc(rc.mainSurgeonName || 'Chưa chọn PTV')} · ${esc(rc.caseSlot || '—')} (${esc(rc.operatingRoom || 'PM Robot')})</div>
                        <div>📞 SĐT: <strong>${phoneDisplay}</strong> ${rc.admissionId ? `· NV: <code>${esc(rc.admissionId)}</code>` : ''}</div>
                        ${rc.note ? `<div>📝 ${esc(rc.note)}</div>` : ''}
                    </div>
                    ${rc.postB2ClinicalDirty ? `<div class="rbt-dirty-banner">⚠️ Đã sửa lâm sàng sau B2 — cần duyệt lại B2 tiền phẫu</div>` : ''}
                    ${this._formatApprovalBadgeHtml(rc)}
                    ${actions.length ? `<div class="rbt-card-actions">${actions.join('')}</div>` : ''}
                </article>
            `;
        },

        _primaryCardActionHtml(rc, perms, opts = {}) {
            const code = rc.robotCaseCode || rc.soNV || '';
            const isOwner = Boolean(
                (perms.username && rc.createdByUsername === perms.username)
                || (perms.staffId && Number(rc.mainSurgeonId) === Number(perms.staffId))
            );
            if (rc.status === 'cho_duyet_tien_phau' && perms.canApproveSteps) {
                return `<button type="button" class="btn btn-primary rbt-mcard__primary" data-rbt-action="step2_preop" data-rbt-code="${esc(code)}">✓ Duyệt B2 Tiền phẫu</button>`;
            }
            if (rc.status === 'cho_duyet_luu_vien' && perms.canApproveSteps) {
                if (rc.postB2ClinicalDirty) {
                    return `<button type="button" class="btn btn-secondary rbt-mcard__primary" data-rbt-action="open_edit_info" data-rbt-code="${esc(code)}">⚠️ Xem lại hồ sơ</button>`;
                }
                return `<button type="button" class="btn btn-primary rbt-mcard__primary" data-rbt-action="step3_inpatient" data-rbt-code="${esc(code)}">✓ Duyệt B3 Chờ mổ</button>`;
            }
            if (rc.status === 'cho_xep_lich' && perms.canEditSchedule) {
                return `<button type="button" class="btn btn-primary rbt-mcard__primary" data-rbt-action="open_schedule_step1" data-rbt-code="${esc(code)}">📅 Xếp lịch B1</button>`;
            }
            if (['tu_van', 'can_nhac', 'tu_choi'].includes(rc.status) && (perms.canManageRobot || isOwner)) {
                return `<button type="button" class="btn btn-primary rbt-mcard__primary" data-rbt-action="open_consult_result" data-rbt-code="${esc(code)}">🩺 Kết quả TV</button>`;
            }
            if (rc.status === 'hoan_mo' && perms.canEditSchedule) {
                return `<button type="button" class="btn btn-primary rbt-mcard__primary" data-rbt-action="open_restore_schedule" data-rbt-code="${esc(code)}">📅 Xếp lịch lại</button>`;
            }
            if (rc.status === 'xuat_vien_cho' && perms.canEditSchedule) {
                return `<button type="button" class="btn btn-primary rbt-mcard__primary" data-rbt-action="open_readmit" data-rbt-code="${esc(code)}">🏥 Nhập lại &amp; Xếp lịch</button>`;
            }
            if (rc.status === 'da_xoa' && perms.canSoftDelete) {
                return `<button type="button" class="btn btn-secondary rbt-mcard__primary" data-rbt-action="restore_trash" data-rbt-code="${esc(code)}">↺ Khôi phục</button>`;
            }
            if (rc.status === 'da_mo' && opts.canPostponeRetro) {
                return `<button type="button" class="btn btn-secondary rbt-mcard__primary" data-rbt-action="open_postpone" data-rbt-code="${esc(code)}">⏸️ Hoãn hậu kiểm</button>`;
            }
            if (rc.status === 'cho_mo' && perms.canEditSchedule) {
                return `<button type="button" class="btn btn-secondary rbt-mcard__primary" data-rbt-action="open_edit_schedule" data-rbt-code="${esc(code)}">🗓️ Đổi lịch</button>`;
            }
            return `<button type="button" class="btn btn-secondary rbt-mcard__primary" data-rbt-action="open_case_sheet" data-rbt-code="${esc(code)}">👁️ Chi tiết ca</button>`;
        },

        _renderMobileCaseCard(rc, perms, opts = {}) {
            const code = rc.robotCaseCode || rc.soNV || '';
            const stMeta = STATUS_META[rc.status] || { label: rc.status, badge: 'rbt-badge--navy' };
            const telHref = _safeTelHref(rc);
            const phoneDisplay = rc.phone ? `${esc(rc.phone)}${rc.phoneMasked ? ' (ẩn)' : ''}` : '—';
            const rightTag = opts.rightMeta || (rc.caseSlot ? esc(rc.caseSlot) : (rc.surgeryDate ? _fmtViDate(rc.surgeryDate) : ''));

            return `
                <article class="rbt-mcard rbt-mcard--${esc(rc.status)}" data-robot-code="${esc(code)}">
                    <div class="rbt-mcard__top">
                        <span class="rbt-case-code">${esc(code)}${rightTag ? ` · ${rightTag}` : ''}</span>
                        <span class="rbt-badge ${stMeta.badge}">${esc(stMeta.label)}</span>
                    </div>
                    ${rc.isTestSandboxCase ? `<div><span class="rbt-badge rbt-badge--sandbox">🧪 TEST SANDBOX</span></div>` : ''}
                    <div class="rbt-mcard__name">${esc(rc.patientName)} ${rc.birthYear ? `(${esc(rc.birthYear)})` : ''} ${rc.admissionId ? `<span class="text-secondary" style="font-size:0.78rem;font-weight:600;">· NV: ${esc(rc.admissionId)}</span>` : ''}</div>
                    <div class="rbt-mcard__meta">
                        <div class="rbt-mcard__diag">📋 ${esc(rc.diagnosis || 'Chưa ghi chẩn đoán')}</div>
                        <div class="rbt-mcard__diag">🤖 ${esc(rc.robotProcedure || 'Chưa ghi PPPT')}</div>
                        <div>🔪 <strong>${esc(rc.mainSurgeonName || 'Chưa chọn PTV')}</strong>${rc.operatingRoom && rc.caseSlot ? ` · ${esc(rc.caseSlot)} (${esc(rc.operatingRoom)})` : ''}</div>
                        ${rc.expectedTimeframe ? `<div>📅 Dự kiến: <strong>${esc(_fmtViDate(rc.expectedTimeframe))}</strong></div>` : ''}
                        ${opts.extraLineHtml || ''}
                        <div>📞 SĐT: <strong>${phoneDisplay}</strong></div>
                    </div>
                    ${rc.postB2ClinicalDirty ? `<div class="rbt-dirty-banner">⚠️ Đã sửa lâm sàng sau B2 — cần duyệt lại B2</div>` : ''}
                    ${this._formatApprovalBadgeHtml(rc)}
                    <div class="rbt-mcard__footer">
                        ${this._primaryCardActionHtml(rc, perms, opts)}
                        ${telHref ? `<a href="${esc(telHref)}" class="rbt-btn-call" aria-label="Gọi bệnh nhân ${esc(rc.patientName)}">📞 Gọi</a>` : ''}
                        <button type="button" class="btn btn-secondary rbt-btn-more" data-rbt-action="open_case_sheet" data-rbt-code="${esc(code)}" aria-label="Thao tác khác cho ca ${esc(code)}">•••</button>
                    </div>
                </article>
            `;
        },

        _renderWeekTab(cases) {
            const bs = this._bootstrap || {};
            const perms = bs.permissions || {};
            const todayIso = bs.todayVn || _fmtIsoLocal(new Date());
            const weekStart = _mondayOf(this._weekStartIso || todayIso);
            const weekDates = [];
            for (let i = 0; i < 6; i++) {
                const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
                weekDates.push({ iso: _fmtIsoLocal(d), dt: d });
            }
            const weekStatuses = new Set(['cho_duyet_tien_phau', 'cho_duyet_luu_vien', 'cho_mo', 'da_mo']);
            const sunDt = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
            const sunIso = _fmtIsoLocal(sunDt);
            const hasSundayCases = cases.some(c => weekStatuses.has(c.status) && c.surgeryDate === sunIso);
            if (hasSundayCases) weekDates.push({ iso: sunIso, dt: sunDt });
            const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
            const shortDayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
            const q = this._searchQuery.trim().toLowerCase();
            const sFilter = this._mobileSurgeonFilter;
            const visibleCases = cases.filter(c => {
                if (!weekStatuses.has(c.status)) return false;
                if (sFilter && sFilter !== 'all' && String(c.mainSurgeonId || '') !== String(sFilter)) return false;
                if (!q) return true;
                return [c.patientName, c.robotCaseCode, c.diagnosis, c.robotProcedure, c.mainSurgeonName, c.admissionId]
                    .some(v => String(v || '').toLowerCase().includes(q));
            });

            const colsHtml = weekDates.map(({ iso, dt }) => {
                const dayCases = visibleCases.filter(c => c.surgeryDate === iso);
                const ca1 = dayCases.filter(c => c.caseSlot === 'Ca 1');
                const ca2 = dayCases.filter(c => c.caseSlot === 'Ca 2');
                const ca3 = dayCases.filter(c => c.caseSlot !== 'Ca 1' && c.caseSlot !== 'Ca 2');
                const label = `${dayNames[dt.getDay()]} · ${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
                const renderGroup = (title, list) => list.length ? `
                    <div class="rbt-slot-section">
                        <div class="rbt-slot-heading">${esc(title)} (${list.length})</div>
                        ${list.map(rc => this._renderCaseCard(rc, perms)).join('')}
                    </div>
                ` : '';

                return `
                    <section class="rbt-day-col ${iso === todayIso ? 'is-today' : ''}">
                        <header class="rbt-day-head">
                            <span>${esc(label)}</span>
                            <span class="rbt-badge rbt-badge--navy">${dayCases.length} ca</span>
                        </header>
                        <div class="rbt-day-body">
                            ${dayCases.length ? `
                                ${renderGroup('Ca 1 (08:00–11:30)', ca1)}
                                ${renderGroup('Ca 2 (13:00–16:00)', ca2)}
                                ${renderGroup('Ca 3 (Dự phòng / Trong ngày)', ca3)}
                            ` : `<div class="rbt-empty">Chưa có ca Robot</div>`}
                        </div>
                    </section>
                `;
            }).join('');

            // Smart active day on mobile Day-Pill Strip
            let activeMobIso = this._mobileDayIso;
            if (!weekDates.some(d => d.iso === activeMobIso)) {
                if (weekDates.some(d => d.iso === todayIso)) {
                    activeMobIso = todayIso;
                } else {
                    const firstNonEmpty = weekDates.find(d => visibleCases.some(c => c.surgeryDate === d.iso));
                    activeMobIso = firstNonEmpty ? firstNonEmpty.iso : (weekDates[0]?.iso || todayIso);
                }
                this._mobileDayIso = activeMobIso;
            }

            const dayPillsHtml = weekDates.map(({ iso, dt }) => {
                const cnt = visibleCases.filter(c => c.surgeryDate === iso).length;
                const isActive = !this._mobileWeekAllDays && iso === activeMobIso;
                const dShort = shortDayNames[dt.getDay()];
                const ddmm = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
                return `
                    <button type="button"
                        class="rbt-day-pill ${isActive ? 'is-active' : ''} ${iso === todayIso ? 'is-today' : ''} ${cnt >= 3 ? 'is-full' : ''}"
                        data-rbt-action="select_mobile_day"
                        data-rbt-code="${esc(iso)}">
                        <span>${esc(dShort)}</span>
                        <span class="rbt-day-pill__date">${esc(ddmm)}</span>
                        <span class="rbt-day-pill__count">${cnt}/3</span>
                    </button>
                `;
            }).join('');

            const slotRank = (sl) => (sl === 'Ca 1' ? 1 : (sl === 'Ca 2' ? 2 : (sl === 'Ca 3' ? 3 : 4)));
            let mobileContentHtml = '';
            if (this._mobileWeekAllDays) {
                const nonEmptyDays = weekDates
                    .map(({ iso, dt }) => ({
                        iso,
                        dt,
                        list: visibleCases.filter(c => c.surgeryDate === iso).sort((a, b) => slotRank(a.caseSlot) - slotRank(b.caseSlot))
                    }))
                    .filter(d => d.list.length > 0);
                const hiddenDays = weekDates.length - nonEmptyDays.length;
                mobileContentHtml = nonEmptyDays.length ? `
                    <div class="text-secondary" style="font-size:0.78rem;padding:0 2px;">Hiển thị ${nonEmptyDays.length} ngày có ca · Đã ẩn ${hiddenDays} ngày trống</div>
                    ${nonEmptyDays.map(({ iso, dt, list }) => `
                        <div class="rbt-mobile-day-group">
                            <div class="rbt-mobile-day-title">
                                <span>${esc(dayNames[dt.getDay()])} · ${_fmtViDate(iso)}${iso === todayIso ? ' (Hôm nay)' : ''}</span>
                                <span class="rbt-badge rbt-badge--navy">${list.length}/3 ca</span>
                            </div>
                            <div class="rbt-mcard-list rbt-mobile-only-flex">
                                ${list.map(rc => this._renderMobileCaseCard(rc, perms)).join('')}
                            </div>
                        </div>
                    `).join('')}
                ` : `<div class="rbt-empty">Không có ca Robot nào trong tuần này.</div>`;
            } else {
                const selObj = weekDates.find(d => d.iso === activeMobIso) || weekDates[0];
                const dayCases = visibleCases
                    .filter(c => c.surgeryDate === (selObj ? selObj.iso : ''))
                    .sort((a, b) => slotRank(a.caseSlot) - slotRank(b.caseSlot));
                const selTitle = selObj ? `${dayNames[selObj.dt.getDay()]} · ${_fmtViDate(selObj.iso)}${selObj.iso === todayIso ? ' (Hôm nay)' : ''}` : '';
                mobileContentHtml = `
                    <div class="rbt-mobile-day-title">
                        <span>${esc(selTitle)}</span>
                        <span class="rbt-badge ${dayCases.length >= 3 ? 'rbt-badge--red' : 'rbt-badge--navy'}">${dayCases.length}/3 ca</span>
                    </div>
                    ${dayCases.length ? `
                        <div class="rbt-mcard-list rbt-mobile-only-flex">
                            ${dayCases.map(rc => this._renderMobileCaseCard(rc, perms)).join('')}
                        </div>
                    ` : `<div class="rbt-empty">Chưa có ca Robot ngày ${_fmtViDate(selObj?.iso || '')}</div>`}
                `;
            }

            return `
                <div class="rbt-desktop-only">
                    <div class="rbt-toolbar">
                        <div class="rbt-toolbar__group">
                            <button type="button" class="btn btn-secondary btn-sm" data-rbt-action="prev_week">◀ Tuần trước</button>
                            <button type="button" class="btn btn-secondary btn-sm" data-rbt-action="this_week">Tuần này</button>
                            <button type="button" class="btn btn-secondary btn-sm" data-rbt-action="next_week">Tuần sau ▶</button>
                            <span class="rbt-week-label">${_fmtViDate(weekDates[0].iso)} – ${_fmtViDate(weekDates[weekDates.length - 1].iso)}</span>
                        </div>
                        <div class="rbt-toolbar__group">
                            <input type="search" id="rbt-search-input" class="form-input" value="${esc(this._searchQuery)}" placeholder="Tìm tên BN, mã RB, BS, số NV..." aria-label="Tìm ca Robot" style="min-width:220px;">
                        </div>
                    </div>
                    <div class="rbt-week-grid">${colsHtml}</div>
                </div>
                <div class="rbt-mobile-week rbt-mobile-only">
                    <div class="rbt-mobile-week-bar">
                        <button type="button" class="btn btn-secondary rbt-mobile-week-navbtn" data-rbt-action="prev_week" aria-label="Tuần trước">◀</button>
                        <span class="rbt-week-label">${_fmtViDate(weekDates[0].iso)} – ${_fmtViDate(weekDates[weekDates.length - 1].iso)}</span>
                        <button type="button" class="btn btn-secondary rbt-mobile-week-navbtn" data-rbt-action="this_week">Hôm nay</button>
                        <button type="button" class="btn btn-secondary rbt-mobile-week-navbtn" data-rbt-action="next_week" aria-label="Tuần sau">▶</button>
                    </div>
                    <div class="rbt-day-strip" role="tablist" aria-label="Chọn ngày trong tuần">
                        ${dayPillsHtml}
                        <button type="button"
                            class="rbt-day-pill rbt-day-pill--all ${this._mobileWeekAllDays ? 'is-active' : ''}"
                            data-rbt-action="toggle_week_all">
                            <span>Cả tuần</span>
                            <span class="rbt-day-pill__count">${visibleCases.length} ca</span>
                        </button>
                    </div>
                    ${mobileContentHtml}
                </div>
            `;
        },

        _renderConsultTab(consultCases, perms) {
            const q = this._searchQuery.trim().toLowerCase();
            const sFilter = this._mobileSurgeonFilter;
            const visible = consultCases.filter(c => {
                if (sFilter && sFilter !== 'all' && String(c.mainSurgeonId || '') !== String(sFilter)) return false;
                if (!q) return true;
                return [c.patientName, c.robotCaseCode, c.diagnosis, c.robotProcedure, c.mainSurgeonName, c.admissionId]
                    .some(v => String(v || '').toLowerCase().includes(q));
            });
            if (!visible.length) {
                return `<div class="rbt-panel"><div class="rbt-empty">Hiện không có ca nào trong hàng đợi Tư vấn / Chờ xếp lịch.</div></div>`;
            }
            const rows = visible.map(rc => {
                const code = rc.robotCaseCode || '';
                const stMeta = STATUS_META[rc.status] || { label: rc.status, badge: 'rbt-badge--indigo' };
                const isOwner = (perms.username && rc.createdByUsername === perms.username) || (perms.staffId && Number(rc.mainSurgeonId) === Number(perms.staffId));
                return `
                    <tr>
                        <td class="rbt-col-code"><strong>${esc(code)}</strong>${rc.isTestSandboxCase ? '<br><span class="rbt-badge rbt-badge--sandbox">TEST</span>' : ''}</td>
                        <td class="rbt-col-patient">
                            <div class="rbt-col-patient-line"><strong>${esc(rc.patientName)}</strong> ${rc.birthYear ? `(${esc(rc.birthYear)})` : ''}</div>
                            <div class="text-secondary rbt-col-patient-line">SĐT: ${esc(rc.phone || '—')} ${rc.admissionId ? `· NV: ${esc(rc.admissionId)}` : ''}</div>
                        </td>
                        <td class="rbt-col-clinical">
                            <div>${esc(rc.diagnosis || '—')}</div>
                            <div class="text-secondary">${esc(rc.robotProcedure || '—')}</div>
                        </td>
                        <td class="rbt-col-surgeon">${esc(rc.mainSurgeonName || '—')}${rc.expectedTimeframe ? `<div class="text-secondary">Dự kiến: ${esc(_fmtViDate(rc.expectedTimeframe))}</div>` : ''}</td>
                        <td class="rbt-col-status"><span class="rbt-badge ${stMeta.badge}">${esc(stMeta.label)}</span>${rc.consultNote ? `<div class="text-secondary">${esc(rc.consultNote)}</div>` : ''}</td>
                        <td class="rbt-col-actions">
                            <div class="rbt-card-actions" style="border-top:none;padding-top:0;">
                                ${(rc.status !== 'cho_xep_lich' && (perms.canManageRobot || isOwner)) ? `<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_consult_result" data-rbt-code="${esc(code)}">Kết quả TV</button>` : ''}
                                ${perms.canEditSchedule ? `<button type="button" class="btn btn-primary rbt-btn-xs" data-rbt-action="open_schedule_step1" data-rbt-code="${esc(code)}">📅 Xếp lịch B1</button>` : ''}
                                ${perms.canEditInfo ? `<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_edit_info" data-rbt-code="${esc(code)}">✏️</button>` : ''}
                                ${perms.canSoftDelete ? `<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="soft_delete" data-rbt-code="${esc(code)}">🗑️</button>` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            const mobileCardsHtml = visible.map(rc => this._renderMobileCaseCard(rc, perms, {
                extraLineHtml: rc.consultNote ? `<div>📝 ${esc(rc.consultNote)}</div>` : ''
            })).join('');

            return `
                <div class="rbt-panel">
                    <div class="rbt-desktop-only">
                        <div class="rbt-table-wrap">
                            <table class="rbt-table">
                                <thead>
                                    <tr>
                                        <th class="rbt-col-code">Mã ca</th>
                                        <th class="rbt-col-patient">Bệnh nhân &amp; Liên hệ</th>
                                        <th class="rbt-col-clinical">Chẩn đoán &amp; PPPT</th>
                                        <th class="rbt-col-surgeon">PTV &amp; Dự kiến</th>
                                        <th class="rbt-col-status">Trạng thái tư vấn</th>
                                        <th class="rbt-col-actions">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    </div>
                    <div class="rbt-mcard-list rbt-mobile-only-flex">${mobileCardsHtml}</div>
                </div>
            `;
        },

        _renderPostponedTab(postponedCases, perms) {
            const reasonsMap = (this._bootstrap && this._bootstrap.postponeReasons) || {};
            const q = this._searchQuery.trim().toLowerCase();
            const sFilter = this._mobileSurgeonFilter;
            const filtered = postponedCases.filter(c => {
                if (this._postponeFilterReason === '__discharge__' && c.status !== 'xuat_vien_cho') return false;
                if (this._postponeFilterReason !== 'all' && this._postponeFilterReason !== '__discharge__' && (c.status !== 'hoan_mo' || c.postponeReasonCode !== this._postponeFilterReason)) return false;
                if (sFilter && sFilter !== 'all' && String(c.mainSurgeonId || '') !== String(sFilter)) return false;
                if (!q) return true;
                return [c.patientName, c.robotCaseCode, c.diagnosis, c.robotProcedure, c.mainSurgeonName, c.admissionId]
                    .some(v => String(v || '').toLowerCase().includes(q));
            });

            const rows = filtered.map(rc => {
                const code = rc.robotCaseCode || '';
                const stMeta = STATUS_META[rc.status] || { label: rc.status, badge: 'rbt-badge--red' };
                const reasonText = rc.status === 'xuat_vien_cho'
                    ? (rc.dischargeReason || 'Xuất viện chờ lịch mới')
                    : `${rc.postponeReasonLabel || rc.postponeReasonCode || '—'}${rc.postponeReasonNote ? ` — ${rc.postponeReasonNote}` : ''}`;
                return `
                    <tr>
                        <td class="rbt-col-code"><strong>${esc(code)}</strong></td>
                        <td class="rbt-col-patient">
                            <div class="rbt-col-patient-line"><strong>${esc(rc.patientName)}</strong> (${esc(rc.birthYear || '—')})</div>
                            <div class="text-secondary rbt-col-patient-line">SĐT: ${esc(rc.phone || '—')}</div>
                        </td>
                        <td class="rbt-col-status"><span class="rbt-badge ${stMeta.badge}">${esc(stMeta.label)}</span><div class="text-secondary">Từ ngày: ${_fmtViDate(rc.surgeryDate)} · ${esc(rc.caseSlot || '—')}</div></td>
                        <td class="rbt-col-clinical">${esc(reasonText)}</td>
                        <td class="rbt-col-surgeon">${esc(rc.mainSurgeonName || '—')}</td>
                        <td class="rbt-col-actions">
                            <div class="rbt-card-actions" style="border-top:none;padding-top:0;">
                                ${perms.canEditSchedule ? `<button type="button" class="btn btn-primary rbt-btn-xs" data-rbt-action="${rc.status === 'xuat_vien_cho' ? 'open_readmit' : 'open_restore_schedule'}" data-rbt-code="${esc(code)}">${rc.status === 'xuat_vien_cho' ? '🏥 Nhập lại &amp; Xếp lịch' : '📅 Xếp lịch lại'}</button>` : ''}
                                ${perms.canSoftDelete ? `<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="soft_delete" data-rbt-code="${esc(code)}">🗑️</button>` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            const mobileCardsHtml = filtered.map(rc => {
                const reasonText = rc.status === 'xuat_vien_cho'
                    ? (rc.dischargeReason || 'Xuất viện chờ lịch mới')
                    : `${rc.postponeReasonLabel || rc.postponeReasonCode || '—'}${rc.postponeReasonNote ? ` — ${rc.postponeReasonNote}` : ''}`;
                return this._renderMobileCaseCard(rc, perms, {
                    rightMeta: rc.surgeryDate ? `Lịch cũ: ${_fmtViDate(rc.surgeryDate)}` : '',
                    extraLineHtml: `<div>⏸️ Lý do: <strong>${esc(reasonText)}</strong></div>`
                });
            }).join('');

            return `
                <div class="rbt-panel">
                    <div class="rbt-toolbar" style="padding:0;border:none;">
                        <strong>Danh sách ca Hoãn mổ &amp; Xuất viện chờ</strong>
                        <select id="rbt-filter-reason" class="form-select" style="width:auto;min-width:220px;" aria-label="Lọc lý do hoãn">
                            <option value="all" ${this._postponeFilterReason === 'all' ? 'selected' : ''}>Tất cả lý do</option>
                            <option value="__discharge__" ${this._postponeFilterReason === '__discharge__' ? 'selected' : ''}>Xuất viện chờ</option>
                            ${Object.entries(reasonsMap).map(([k, lbl]) => `<option value="${esc(k)}" ${this._postponeFilterReason === k ? 'selected' : ''}>${esc(lbl)}</option>`).join('')}
                        </select>
                    </div>
                    ${filtered.length ? `
                        <div class="rbt-desktop-only">
                            <div class="rbt-table-wrap">
                                <table class="rbt-table">
                                    <thead>
                                        <tr>
                                            <th class="rbt-col-code">Mã ca</th>
                                            <th class="rbt-col-patient">Bệnh nhân</th>
                                            <th class="rbt-col-status">Trạng thái &amp; Lịch cũ</th>
                                            <th class="rbt-col-clinical">Lý do hoãn / Xuất viện chờ</th>
                                            <th class="rbt-col-surgeon">PTV</th>
                                            <th class="rbt-col-actions">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>${rows}</tbody>
                                </table>
                            </div>
                        </div>
                        <div class="rbt-mcard-list rbt-mobile-only-flex">${mobileCardsHtml}</div>
                    ` : `<div class="rbt-empty">Không có ca hoãn hoặc xuất viện chờ phù hợp bộ lọc.</div>`}
                </div>
            `;
        },

        _renderCompletedTab(allCases, uniqueHistorical, perms) {
            const bs = this._bootstrap || {};
            const todayIso = bs.todayVn || _fmtIsoLocal(new Date());
            const lookbackDays = Number((bs.robotConfig && bs.robotConfig.postponeLookbackDays) || 7);
            const completedCases = allCases.filter(c => c.status === 'da_mo');

            const combined = [
                ...completedCases.map(c => ({
                    source: 'robot',
                    robotCaseCode: c.robotCaseCode,
                    patientName: c.patientName,
                    birthYear: c.birthYear,
                    admissionId: c.admissionId,
                    diagnosis: c.diagnosis,
                    method: c.robotProcedure,
                    mainSurgeonId: c.mainSurgeonId,
                    mainSurgeonName: c.mainSurgeonName,
                    date: c.surgeryDate,
                    completionSource: c.completionSource,
                    isTestSandboxCase: Boolean(c.isTestSandboxCase)
                })),
                ...uniqueHistorical.map(h => ({
                    source: 'historical',
                    robotCaseCode: '',
                    surgeryId: h.id,
                    patientName: h.patientName,
                    birthYear: h.birthYear,
                    admissionId: h.admissionId,
                    diagnosis: h.diagnosis,
                    method: h.method,
                    mainSurgeonId: h.mainSurgeon,
                    mainSurgeonName: h.mainSurgeonName || (typeof Utils !== 'undefined' ? Utils.getStaffName(h.mainSurgeon) : ''),
                    date: h.date,
                    completionSource: 'historical_schedule',
                    isTestSandboxCase: false
                }))
            ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

            const years = [...new Set(combined.map(x => String(x.date || '').slice(0, 4)).filter(Boolean))].sort().reverse();
            const filtered = combined.filter(x => {
                const d = String(x.date || '');
                if (this._statsYear !== 'all' && d.slice(0, 4) !== this._statsYear) return false;
                if (this._statsMonth !== 'all' && d.slice(5, 7) !== this._statsMonth) return false;
                if (this._statsSurgeon !== 'all' && String(x.mainSurgeonId || '') !== String(this._statsSurgeon)) return false;
                return true;
            });

            const reasonsMap = bs.postponeReasons || {};
            const postponeBreakdown = {};
            allCases.filter(c => c.status === 'hoan_mo' && !c.isTestSandboxCase).forEach(c => {
                const k = c.postponeReasonCode || 'ly_do_khac';
                postponeBreakdown[k] = (postponeBreakdown[k] || 0) + 1;
            });

            const rows = filtered.map(item => {
                const diff = _daysBetweenIso(item.date, todayIso);
                const canPostponeRetro = item.source === 'robot' &&
                    (perms.canPostponeOrDischarge || (perms.staffId && Number(perms.staffId) === Number(item.mainSurgeonId))) &&
                    ((diff !== null && diff >= 0 && diff <= lookbackDays) || perms.isSuperAdmin);
                return `
                    <tr>
                        <td class="rbt-col-date"><strong>${_fmtViDate(item.date)}</strong></td>
                        <td class="rbt-col-patient">
                            <div class="rbt-col-patient-line"><strong>${esc(item.patientName)}</strong> ${item.birthYear ? `(${esc(item.birthYear)})` : ''}</div>
                            <div class="text-secondary rbt-col-patient-line">${item.robotCaseCode ? `<code>${esc(item.robotCaseCode)}</code>` : `Lịch tuần #${esc(item.surgeryId)}`} ${item.admissionId ? `· NV: ${esc(item.admissionId)}` : ''}</div>
                        </td>
                        <td class="rbt-col-clinical">
                            <div>${esc(item.diagnosis || '—')}</div>
                            <div class="text-secondary">${esc(item.method || '—')}</div>
                        </td>
                        <td class="rbt-col-surgeon">${esc(item.mainSurgeonName || '—')}</td>
                        <td class="rbt-col-status">${item.completionSource === 'auto_date_rollover' ? '<span class="rbt-badge rbt-badge--ocean">Chuyển tự động qua ngày</span>' : '<span class="rbt-badge rbt-badge--navy">Dữ liệu lịch sử</span>'}</td>
                        <td class="rbt-col-actions">
                            ${canPostponeRetro ? `<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="open_postpone" data-rbt-code="${esc(item.robotCaseCode)}">⏸️ Hoãn hậu kiểm</button>` : '—'}
                        </td>
                    </tr>
                `;
            }).join('');

            const mobileSlice = filtered.slice(0, this._completedVisibleLimit);
            const remainingCompleted = Math.max(0, filtered.length - mobileSlice.length);
            const mobileCompletedCards = mobileSlice.map(item => {
                const diff = _daysBetweenIso(item.date, todayIso);
                const canPostponeRetro = item.source === 'robot' &&
                    (perms.canPostponeOrDischarge || (perms.staffId && Number(perms.staffId) === Number(item.mainSurgeonId))) &&
                    ((diff !== null && diff >= 0 && diff <= lookbackDays) || perms.isSuperAdmin);
                if (item.source === 'robot' && item.robotCaseCode) {
                    const rcObj = this._findCase(item.robotCaseCode);
                    if (rcObj) {
                        return this._renderMobileCaseCard(rcObj, perms, {
                            rightMeta: `Ngày mổ: ${_fmtViDate(item.date)}`,
                            canPostponeRetro
                        });
                    }
                }
                return `
                    <article class="rbt-mcard rbt-mcard--da_mo">
                        <div class="rbt-mcard__top">
                            <span class="rbt-case-code">${_fmtViDate(item.date)} · ${item.robotCaseCode ? esc(item.robotCaseCode) : `Lịch tuần #${esc(item.surgeryId)}`}</span>
                            <span class="rbt-badge ${item.completionSource === 'auto_date_rollover' ? 'rbt-badge--ocean' : 'rbt-badge--navy'}">${item.completionSource === 'auto_date_rollover' ? 'Tự động qua ngày' : 'Dữ liệu lịch sử'}</span>
                        </div>
                        <div class="rbt-mcard__name">${esc(item.patientName)} ${item.birthYear ? `(${esc(item.birthYear)})` : ''} ${item.admissionId ? `<span class="text-secondary" style="font-size:0.78rem;font-weight:600;">· NV: ${esc(item.admissionId)}</span>` : ''}</div>
                        <div class="rbt-mcard__meta">
                            <div class="rbt-mcard__diag">📋 ${esc(item.diagnosis || '—')}</div>
                            <div class="rbt-mcard__diag">🤖 ${esc(item.method || '—')}</div>
                            <div>🔪 <strong>${esc(item.mainSurgeonName || '—')}</strong></div>
                        </div>
                    </article>
                `;
            }).join('');

            return `
                <div class="rbt-panel">
                    <div class="rbt-toolbar" style="padding:0;border:none;">
                        <strong>Tổng hợp ca Đã phẫu thuật Robot (${filtered.length}/${combined.length})</strong>
                        <div class="rbt-toolbar__group">
                            <select id="rbt-stats-year" class="form-select" style="width:auto;" aria-label="Lọc năm">
                                <option value="all">Tất cả năm</option>
                                ${years.map(y => `<option value="${esc(y)}" ${this._statsYear === y ? 'selected' : ''}>Năm ${esc(y)}</option>`).join('')}
                            </select>
                            <select id="rbt-stats-month" class="form-select" style="width:auto;" aria-label="Lọc tháng">
                                <option value="all">Tất cả tháng</option>
                                ${Array.from({ length: 12 }, (_, idx) => {
                                    const mm = String(idx + 1).padStart(2, '0');
                                    return `<option value="${mm}" ${this._statsMonth === mm ? 'selected' : ''}>Tháng ${idx + 1}</option>`;
                                }).join('')}
                            </select>
                            <select id="rbt-stats-surgeon" class="form-select" style="width:auto;" aria-label="Lọc PTV">
                                <option value="all">Tất cả PTV</option>
                                ${(bs.surgeons || []).map(st => `<option value="${esc(st.id)}" ${String(this._statsSurgeon) === String(st.id) ? 'selected' : ''}>${esc(st.title)} ${esc(st.name)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    ${Object.keys(postponeBreakdown).length ? `
                        <div style="display:flex;flex-wrap:wrap;gap:6px;">
                            ${Object.entries(postponeBreakdown).map(([k, cnt]) => `<span class="rbt-badge rbt-badge--amber">${esc(reasonsMap[k] || k)}: ${cnt} ca</span>`).join('')}
                        </div>
                    ` : ''}
                    ${filtered.length ? `
                        <div class="rbt-desktop-only">
                            <div class="rbt-table-wrap">
                                <table class="rbt-table">
                                    <thead>
                                        <tr>
                                            <th class="rbt-col-date">Ngày mổ</th>
                                            <th class="rbt-col-patient">Bệnh nhân &amp; Mã</th>
                                            <th class="rbt-col-clinical">Chẩn đoán &amp; PPPT</th>
                                            <th class="rbt-col-surgeon">PTV chính</th>
                                            <th class="rbt-col-status">Nguồn ghi nhận</th>
                                            <th class="rbt-col-actions">Hậu kiểm (≤${lookbackDays} ngày)</th>
                                        </tr>
                                    </thead>
                                    <tbody>${rows}</tbody>
                                </table>
                            </div>
                        </div>
                        <div class="rbt-mcard-list rbt-mobile-only-flex">
                            ${mobileCompletedCards}
                            ${remainingCompleted > 0 ? `
                                <button type="button" class="btn btn-secondary rbt-mobile-load-more" data-rbt-action="load_more_completed">
                                    Xem thêm (${Math.min(20, remainingCompleted)} / còn ${remainingCompleted} ca)
                                </button>
                            ` : ''}
                        </div>
                    ` : `<div class="rbt-empty">Không có dữ liệu phù hợp bộ lọc.</div>`}
                </div>
            `;
        },

        _renderTrashTab(trashCases, perms) {
            if (!trashCases.length) {
                return `<div class="rbt-panel"><div class="rbt-empty">Thùng rác Điều phối Robot đang trống.</div></div>`;
            }
            const archiveDays = Number((this._bootstrap?.robotConfig?.trashAutoArchiveDays) || 14);
            const rows = trashCases.map(rc => {
                const code = rc.robotCaseCode || '';
                return `
                    <tr>
                        <td class="rbt-col-code"><strong>${esc(code)}</strong></td>
                        <td class="rbt-col-patient rbt-col-nowrap"><strong>${esc(rc.patientName)}</strong> (${esc(rc.birthYear || '—')})</td>
                        <td class="rbt-col-clinical">${esc(rc.deleteReason || '—')}</td>
                        <td class="rbt-col-nowrap">${_fmtViDate(String(rc.deletedAt || '').slice(0, 10))} · ${esc(rc.deletedBy || '—')}</td>
                        <td class="rbt-col-actions">
                            <div class="rbt-card-actions" style="border-top:none;padding-top:0;">
                                ${perms.canSoftDelete ? `<button type="button" class="btn btn-secondary rbt-btn-xs" data-rbt-action="restore_trash" data-rbt-code="${esc(code)}">↺ Khôi phục</button>` : ''}
                                ${perms.canArchiveDeleted ? `<button type="button" class="btn btn-danger rbt-btn-xs" data-rbt-action="archive_delete" data-rbt-code="${esc(code)}">🗄️ Lưu trữ ẩn</button>` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            const mobileCardsHtml = trashCases.map(rc => this._renderMobileCaseCard(rc, perms, {
                rightMeta: _fmtViDate(String(rc.deletedAt || '').slice(0, 10)),
                extraLineHtml: `<div>🗑️ Lý do: <strong>${esc(rc.deleteReason || '—')}</strong> · ${esc(rc.deletedBy || '—')}</div>`
            })).join('');

            return `
                <div class="rbt-panel">
                    <div class="text-secondary" style="font-size:0.84rem;">
                        Bảo vệ dữ liệu Zero-RM: Ca mổ Robot được giữ trong Thùng rác tối thiểu <strong>${archiveDays} ngày</strong> trước khi chuyển sang kho lưu trữ lịch sử, không xóa vĩnh viễn mất mã liên kết.
                    </div>
                    <div class="rbt-desktop-only">
                        <div class="rbt-table-wrap">
                            <table class="rbt-table">
                                <thead>
                                    <tr>
                                        <th class="rbt-col-code">Mã ca</th>
                                        <th class="rbt-col-patient rbt-col-nowrap">Bệnh nhân</th>
                                        <th class="rbt-col-clinical">Lý do đưa vào thùng rác</th>
                                        <th class="rbt-col-nowrap">Thời gian &amp; Người thực hiện</th>
                                        <th class="rbt-col-actions">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    </div>
                    <div class="rbt-mcard-list rbt-mobile-only-flex">${mobileCardsHtml}</div>
                </div>
            `;
        },

        _renderConfigTab() {
            const bs = this._bootstrap || {};
            const cfg = bs.robotConfig || {};
            const coords = new Set((cfg.coordinators || []).map(x => String(x || '').trim().toLowerCase()));
            const accounts = Array.isArray(bs.staffAccounts) ? bs.staffAccounts : [];
            return `
                <div class="rbt-panel">
                    <h3 style="margin:0;">⚙️ Cấu hình Phân quyền Điều phối Robot &amp; In A5 P.CTXH</h3>
                    <form id="rbt-config-form">
                        <div class="rbt-form-grid">
                            <div class="form-group">
                                <label class="form-label">Tên người nhận mặc định tại Phòng CTXH (Mẫu A5)</label>
                                <input class="form-input" name="defaultSchedulerName" value="${esc(cfg.defaultSchedulerName || 'Quang')}" required maxlength="60">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Giới hạn ngày hoãn hậu kiểm (ngày)</label>
                                <input class="form-input" type="number" min="1" max="30" name="postponeLookbackDays" value="${esc(cfg.postponeLookbackDays || 7)}" required>
                            </div>
                            <div class="form-group rbt-form-grid--full">
                                <label class="form-label">Điều phối viên được ủy quyền (trạng thái thực từ tài khoản active)</label>
                                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;padding:10px;border:1px solid var(--border-default);border-radius:10px;">
                                    ${accounts.map(acc => `
                                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.86rem;">
                                            <input type="checkbox" name="coordinators" value="${esc(acc.username)}" ${coords.has(String(acc.username || '').toLowerCase()) ? 'checked' : ''}>
                                            <span><strong>${esc(acc.title ? `${acc.title} ${acc.name}` : acc.name)}</strong> <span class="text-secondary">(@${esc(acc.username)})</span></span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                        <div style="margin-top:12px;">
                            <button type="button" class="btn btn-primary" data-rbt-action="save_config">Lưu cấu hình Điều phối</button>
                        </div>
                    </form>
                </div>
            `;
        },

        async _handleUiAction(act, code, sid, btn) {
            if (act === 'reload') {
                await this._refreshBoth(true);
                return;
            }
            if (act === 'subtab' || act === 'kpi_jump') {
                this._subtab = code || 'week';
                this._rerenderInPlace();
                return;
            }
            if (act === 'toggle_mobile_search') {
                this._mobileSearchOpen = !this._mobileSearchOpen;
                this._rerenderInPlace();
                if (this._mobileSearchOpen) {
                    setTimeout(() => document.getElementById('rbt-mobile-search-input')?.focus(), 40);
                }
                return;
            }
            if (act === 'clear_mobile_filters') {
                this._searchQuery = '';
                this._mobileSurgeonFilter = 'all';
                this._rerenderInPlace();
                return;
            }
            if (act === 'select_mobile_day') {
                this._mobileWeekAllDays = false;
                this._mobileDayIso = code || this._mobileDayIso;
                this._rerenderInPlace();
                return;
            }
            if (act === 'toggle_week_all') {
                this._mobileWeekAllDays = !this._mobileWeekAllDays;
                this._rerenderInPlace();
                return;
            }
            if (act === 'load_more_completed') {
                this._completedVisibleLimit += 20;
                this._rerenderInPlace();
                return;
            }
            if (act === 'open_mobile_menu') return this.openMobileHeaderMenuSheet();
            if (act === 'open_fab_sheet') return this.openFabCreateSheet();
            if (act === 'open_case_sheet') return this.openCaseActionSheet(code);
            if (act === 'prev_week' || act === 'next_week' || act === 'this_week') {
                const todayIso = (this._bootstrap && this._bootstrap.todayVn) || _fmtIsoLocal(new Date());
                if (act === 'this_week') {
                    this._weekStartIso = _fmtIsoLocal(_mondayOf(todayIso));
                } else {
                    const cur = _parseIsoLocal(this._weekStartIso || todayIso) || new Date();
                    cur.setDate(cur.getDate() + (act === 'next_week' ? 7 : -7));
                    this._weekStartIso = _fmtIsoLocal(cur);
                }
                this._mobileDayIso = null;
                this._rerenderInPlace();
                return;
            }
            if (act === 'open_create_consult') return this.openCaseFormModal('create_consult');
            if (act === 'open_create_case') return this.openCaseFormModal('create_case');
            if (act === 'open_link_surgery') return this.openLinkSurgeryModal(sid);
            if (act === 'open_print_pctxh') return this.openPrintPctxhModal();
            if (act === 'open_edit_info') return this.openCaseFormModal('edit_info', code);
            if (act === 'open_edit_schedule') return this.openCaseFormModal('edit_schedule', code);
            if (act === 'open_schedule_step1') return this.openCaseFormModal('schedule_step1', code);
            if (act === 'open_consult_result') return this.openConsultResultModal(code);
            if (act === 'open_postpone') return this.openPostponeModal(code);
            if (act === 'open_discharge') return this.openDischargeModal(code);
            if (act === 'open_restore_schedule') return this.openRestoreScheduleModal(code, 'restore_to_schedule');
            if (act === 'open_readmit') return this.openRestoreScheduleModal(code, 'readmit');
            if (act === 'step2_preop') return this._runQuickPatch(code, 'preop_step2', {}, false);
            if (act === 'step3_inpatient') return this._runQuickPatch(code, 'inpatient_step3', {}, true);
            if (act === 'soft_delete') return this._runQuickPatch(code, 'soft_delete', {}, true);
            if (act === 'restore_trash') return this._runQuickPatch(code, 'restore_trash', {}, false);
            if (act === 'archive_delete') return this._runArchiveDelete(code);
            if (act === 'save_config') return this._saveConfigFromTab();
        },

        _findCase(code) {
            const list = (this._bootstrap && this._bootstrap.cases) || [];
            return list.find(c => (c.robotCaseCode || c.soNV) === code) || null;
        },

        _openRobotModal(title, html, mode, code = null) {
            this._modalActive = true;
            this._modalDirty = false;
            this._modalDirtyWarnShown = false;
            this._openModalMode = mode;
            this._openCaseCode = code;
            this._conflictState = null;

            const fab = document.getElementById('rbt-mobile-fab');
            if (fab) fab.hidden = true;

            const guardBanner = `<div id="rbt-modal-dirty-guard" class="rbt-dirty-banner" hidden style="margin-bottom:10px;">⚠️ Bạn có dữ liệu chưa lưu. <button type="button" class="btn btn-secondary rbt-btn-xs" style="margin-left:8px;" onclick="Modal.close(true)">Đóng &amp; bỏ thay đổi</button></div>`;
            Modal.open(title, guardBanner + html);

            const body = document.getElementById('modal-body');
            if (!body) return;
            const markDirty = () => {
                this._modalDirty = true;
                this._modalDirtyWarnShown = false;
            };
            body.querySelectorAll('input, select, textarea').forEach(el => {
                if (el.getAttribute('data-rbt-no-dirty') === '1') return;
                el.addEventListener('input', markDirty);
                el.addEventListener('change', markDirty);
            });
            this._bindDatePickerNoTyping(body);
        },

        _bindDatePickerNoTyping(container) {
            if (!container) return;
            const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
            const plat = (typeof navigator !== 'undefined' && navigator.platform) ? navigator.platform : '';
            const isIosWebKit = /iP(hone|ad|od)/.test(ua) || (plat === 'MacIntel' && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
            container.querySelectorAll('input[type="date"].rbt-date-picker-only').forEach(el => {
                if (el.dataset.rbtPickerBound === '1') return;
                el.dataset.rbtPickerBound = '1';
                const openNativePicker = () => {
                    if (isIosWebKit) return;
                    try {
                        if (typeof el.showPicker === 'function') el.showPicker();
                    } catch (_) { /* Browser fallback */ }
                };
                el.addEventListener('click', openNativePicker);
                el.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Tab' || ev.key === 'Escape') return;
                    ev.preventDefault();
                    if (!isIosWebKit && (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'ArrowDown')) {
                        openNativePicker();
                    }
                });
                el.addEventListener('beforeinput', (ev) => {
                    if (!ev.inputType || ev.inputType === 'insertText' || ev.inputType === 'insertCompositionText') {
                        ev.preventDefault();
                    }
                });
                el.addEventListener('paste', (ev) => ev.preventDefault());
                el.addEventListener('drop', (ev) => ev.preventDefault());
            });
            container.querySelectorAll('[data-rbt-clear-date]').forEach(btn => {
                if (btn.dataset.rbtClearBound === '1') return;
                btn.dataset.rbtClearBound = '1';
                btn.addEventListener('click', () => {
                    const targetName = btn.getAttribute('data-rbt-clear-date');
                    const input = container.querySelector(`input[name="${CSS.escape(targetName || '')}"]`);
                    if (!input) return;
                    input.value = '';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                });
            });
            container.querySelectorAll('[data-rbt-date-preset]').forEach(btn => {
                if (btn.dataset.rbtPresetBound === '1') return;
                btn.dataset.rbtPresetBound = '1';
                btn.addEventListener('click', () => {
                    const targetName = btn.getAttribute('data-rbt-date-target') || '';
                    const delta = Number(btn.getAttribute('data-rbt-date-preset') || '0');
                    const input = container.querySelector(`input[name="${CSS.escape(targetName)}"]`);
                    if (!input) return;
                    const todayIso = (this._bootstrap && this._bootstrap.todayVn) || _fmtIsoLocal(new Date());
                    input.value = _addDaysIso(todayIso, delta);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                });
            });
        },

        _buildDatePresetsHtml(targetName) {
            return `
                <div class="rbt-date-presets">
                    <button type="button" class="rbt-date-preset-btn" data-rbt-date-preset="1" data-rbt-date-target="${esc(targetName)}">Ngày mai</button>
                    <button type="button" class="rbt-date-preset-btn" data-rbt-date-preset="3" data-rbt-date-target="${esc(targetName)}">+3 ngày</button>
                    <button type="button" class="rbt-date-preset-btn" data-rbt-date-preset="7" data-rbt-date-target="${esc(targetName)}">Tuần sau</button>
                </div>
            `;
        },

        _buildSlotPillsHtml(slots, selectedSlot) {
            return `
                <div class="rbt-slot-pills rbt-mobile-only-grid" role="group" aria-label="Chọn nhanh Ca mổ Robot">
                    ${slots.map(sl => `
                        <button type="button" class="rbt-slot-pill ${selectedSlot === sl ? 'is-selected' : ''}" data-rbt-slot-pill="${esc(sl)}">
                            <span>${esc(sl)}</span>
                            <span class="rbt-slot-pill__sub" data-rbt-slot-sub="${esc(sl)}">Trống</span>
                        </button>
                    `).join('')}
                </div>
                <div id="rbt-day-capacity-hint" class="rbt-day-cap-hint"></div>
            `;
        },

        _bindSlotPillsAndCapacity(form, excludeCode = '') {
            if (!form) return;
            const slotSel = form.querySelector('select[name="caseSlot"]');
            const dateInp = form.querySelector('input[name="surgeryDate"]');
            const sbxInp = form.querySelector('input[name="isTestSandboxCase"]');
            const hintEl = form.querySelector('#rbt-day-capacity-hint');
            if (!slotSel) return;

            const holdingStatuses = new Set(['cho_duyet_tien_phau', 'cho_duyet_luu_vien', 'cho_mo', 'xuat_vien_cho']);
            const refreshCapacity = () => {
                const curSlot = String(slotSel.value || '').trim();
                const sDate = String(dateInp?.value || '').trim();
                const isSbx = Boolean(sbxInp?.checked);
                const bsCases = (this._bootstrap && Array.isArray(this._bootstrap.cases)) ? this._bootstrap.cases : [];
                const sameDay = sDate ? bsCases.filter(c => {
                    const cCode = String(c.robotCaseCode || c.soNV || '').trim();
                    if (excludeCode && cCode === excludeCode) return false;
                    if (Boolean(c.isTestSandboxCase) !== isSbx) return false;
                    if (!holdingStatuses.has(c.status)) return false;
                    return String(c.surgeryDate || '').trim() === sDate && Boolean(c.caseSlot);
                }) : [];

                const slotCounts = {};
                sameDay.forEach(c => {
                    slotCounts[c.caseSlot] = (slotCounts[c.caseSlot] || 0) + 1;
                });

                form.querySelectorAll('[data-rbt-slot-pill]').forEach(btn => {
                    const sl = btn.getAttribute('data-rbt-slot-pill') || '';
                    const count = slotCounts[sl] || 0;
                    btn.classList.toggle('is-selected', curSlot === sl);
                    btn.classList.toggle('is-busy', count > 0);
                    const sub = btn.querySelector('[data-rbt-slot-sub]');
                    if (sub) sub.textContent = count > 0 ? `Đã có ${count} ca` : 'Trống';
                });

                if (hintEl) {
                    if (!sDate) {
                        hintEl.classList.remove('is-full');
                        hintEl.textContent = 'Chọn ngày mổ để xem công suất Robot trong ngày.';
                    } else if (sameDay.length >= 3) {
                        hintEl.classList.add('is-full');
                        hintEl.textContent = `⛔ Ngày ${_fmtViDate(sDate)} đã đủ ${sameDay.length}/3 ca — vui lòng chọn ngày khác.`;
                    } else {
                        hintEl.classList.remove('is-full');
                        const free = ['Ca 1', 'Ca 2', 'Ca 3'].filter(sl => !(slotCounts[sl] > 0));
                        hintEl.textContent = `Ngày ${_fmtViDate(sDate)}: đã xếp ${sameDay.length}/3 ca${free.length ? ` (còn trống ${free.join(', ')})` : ''}.`;
                    }
                }
            };

            form.querySelectorAll('[data-rbt-slot-pill]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const sl = btn.getAttribute('data-rbt-slot-pill') || '';
                    slotSel.value = sl;
                    slotSel.dispatchEvent(new Event('change', { bubbles: true }));
                    refreshCapacity();
                });
            });

            slotSel.addEventListener('change', refreshCapacity);
            dateInp?.addEventListener('input', refreshCapacity);
            dateInp?.addEventListener('change', refreshCapacity);
            sbxInp?.addEventListener('change', refreshCapacity);
            refreshCapacity();
        },

        _bindSheetActions(containerEl) {
            if (!containerEl) return;
            containerEl.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-rbt-action]');
                if (!btn || !containerEl.contains(btn)) return;
                const act = btn.getAttribute('data-rbt-action') || '';
                const code = btn.getAttribute('data-rbt-code') || '';
                const sid = btn.getAttribute('data-rbt-sid') || '';
                Modal.close(true);
                this._handleUiAction(act, code, sid, btn);
            });
        },

        openMobileHeaderMenuSheet() {
            const bs = this._bootstrap || {};
            const perms = bs.permissions || {};
            const html = `
                <div id="rbt-header-menu-sheet" class="rbt-sheet-list">
                    <button type="button" class="rbt-sheet-item rbt-sheet-item--primary" data-rbt-action="open_print_pctxh">🖨️ Xem trước &amp; In Phiếu A5 P.CTXH</button>
                    <button type="button" class="rbt-sheet-item" data-rbt-action="reload">↻ Đồng bộ lại dữ liệu máy chủ</button>
                    ${perms.canConfigureCoordinators ? `<button type="button" class="rbt-sheet-item" data-rbt-action="subtab" data-rbt-code="config">⚙️ Cấu hình Phân quyền Điều phối</button>` : ''}
                    <button type="button" class="btn btn-secondary" onclick="Modal.close(true)" style="min-height:46px;">Đóng</button>
                </div>
            `;
            this._openRobotModal('⋮ Tiện ích Điều phối Robot', html, 'mobile_header_menu');
            this._bindSheetActions(document.getElementById('rbt-header-menu-sheet'));
        },

        openFabCreateSheet() {
            const bs = this._bootstrap || {};
            const perms = bs.permissions || {};
            const unlinkedCount = (bs.unlinkedFutureRobotSurgeries || []).length;
            const html = `
                <div id="rbt-fab-sheet" class="rbt-sheet-list">
                    ${perms.canCreateConsult ? `<button type="button" class="rbt-sheet-item rbt-sheet-item--primary" data-rbt-action="open_create_consult">🩺 + Tạo ca tư vấn Robot</button>` : ''}
                    ${perms.canDirectCreateCase ? `<button type="button" class="rbt-sheet-item" data-rbt-action="open_create_case">🤖 + Tạo trực tiếp lịch mổ Robot</button>` : ''}
                    ${perms.canLinkExistingSurgery && unlinkedCount > 0 ? `<button type="button" class="rbt-sheet-item" data-rbt-action="open_link_surgery">🔗 Gắn ca sẵn có từ Lịch tuần (${unlinkedCount})</button>` : ''}
                    <button type="button" class="btn btn-secondary" onclick="Modal.close(true)" style="min-height:46px;">Đóng</button>
                </div>
            `;
            this._openRobotModal('＋ Tạo mới hồ sơ Robot', html, 'fab_create');
            this._bindSheetActions(document.getElementById('rbt-fab-sheet'));
        },

        openCaseActionSheet(code) {
            const rc = this._findCase(code);
            if (!rc) {
                Toast.error('Không tìm thấy hồ sơ Robot — vui lòng tải lại.');
                return;
            }
            const bs = this._bootstrap || {};
            const perms = bs.permissions || {};
            const stMeta = STATUS_META[rc.status] || { label: rc.status, badge: 'rbt-badge--navy' };
            const telHref = _safeTelHref(rc);
            const phoneDisplay = rc.phone ? `${esc(rc.phone)}${rc.phoneMasked ? ' (ẩn)' : ''}` : '—';
            const isOwner = Boolean(
                (perms.username && rc.createdByUsername === perms.username)
                || (perms.staffId && Number(rc.mainSurgeonId) === Number(perms.staffId))
            );
            const isActiveSched = ['cho_duyet_tien_phau', 'cho_duyet_luu_vien', 'cho_mo'].includes(rc.status);
            const todayIso = bs.todayVn || _fmtIsoLocal(new Date());
            const lookbackDays = Number((bs.robotConfig && bs.robotConfig.postponeLookbackDays) || 7);
            const diffDays = _daysBetweenIso(rc.surgeryDate, todayIso);
            const canRetroPostpone = rc.status === 'da_mo'
                && (perms.canPostponeOrDischarge || (perms.staffId && Number(perms.staffId) === Number(rc.mainSurgeonId)))
                && ((diffDays !== null && diffDays >= 0 && diffDays <= lookbackDays) || perms.isSuperAdmin);

            const sheetBtns = [];
            if (rc.status === 'cho_duyet_tien_phau' && perms.canApproveSteps) {
                sheetBtns.push(`<button type="button" class="rbt-sheet-item rbt-sheet-item--primary" data-rbt-action="step2_preop" data-rbt-code="${esc(code)}">✓ Duyệt Bước 2 (Tiền phẫu)</button>`);
            }
            if (rc.status === 'cho_duyet_luu_vien' && perms.canApproveSteps && !rc.postB2ClinicalDirty) {
                sheetBtns.push(`<button type="button" class="rbt-sheet-item rbt-sheet-item--primary" data-rbt-action="step3_inpatient" data-rbt-code="${esc(code)}">✓ Duyệt Bước 3 (Ở lại chờ mổ)</button>`);
            }
            if (rc.status === 'cho_xep_lich' && perms.canEditSchedule) {
                sheetBtns.push(`<button type="button" class="rbt-sheet-item rbt-sheet-item--primary" data-rbt-action="open_schedule_step1" data-rbt-code="${esc(code)}">📅 Xếp lịch Bước 1</button>`);
            }
            if (['tu_van', 'can_nhac', 'tu_choi'].includes(rc.status) && (perms.canManageRobot || isOwner)) {
                sheetBtns.push(`<button type="button" class="rbt-sheet-item rbt-sheet-item--primary" data-rbt-action="open_consult_result" data-rbt-code="${esc(code)}">🩺 Cập nhật kết quả tư vấn</button>`);
            }
            if (rc.status === 'hoan_mo' && perms.canEditSchedule) {
                sheetBtns.push(`<button type="button" class="rbt-sheet-item rbt-sheet-item--primary" data-rbt-action="open_restore_schedule" data-rbt-code="${esc(code)}">📅 Xếp lịch mổ lại</button>`);
            }
            if (rc.status === 'xuat_vien_cho' && perms.canEditSchedule) {
                sheetBtns.push(`<button type="button" class="rbt-sheet-item rbt-sheet-item--primary" data-rbt-action="open_readmit" data-rbt-code="${esc(code)}">🏥 Nhập lại &amp; Xếp lịch mới</button>`);
            }
            if (perms.canEditSchedule && isActiveSched) {
                sheetBtns.push(`<button type="button" class="rbt-sheet-item" data-rbt-action="open_edit_schedule" data-rbt-code="${esc(code)}">🗓️ Đổi ngày / Ca mổ</button>`);
            }
            if ((perms.canPostponeOrDischarge || (perms.staffId && Number(perms.staffId) === Number(rc.mainSurgeonId))) && (isActiveSched || canRetroPostpone)) {
                sheetBtns.push(`<button type="button" class="rbt-sheet-item" data-rbt-action="open_postpone" data-rbt-code="${esc(code)}">⏸️ Hoãn mổ + Chọn lý do</button>`);
            }
            if (perms.canPostponeOrDischarge && isActiveSched) {
                sheetBtns.push(`<button type="button" class="rbt-sheet-item" data-rbt-action="open_discharge" data-rbt-code="${esc(code)}">🏠 Xuất viện chờ lịch mới</button>`);
            }
            if (perms.canEditInfo && rc.status !== 'da_xoa' && (rc.status !== 'da_mo' || perms.canManageRobot)) {
                sheetBtns.push(`<button type="button" class="rbt-sheet-item" data-rbt-action="open_edit_info" data-rbt-code="${esc(code)}">✏️ Sửa thông tin bệnh nhân</button>`);
            }
            if (rc.status === 'da_xoa' && perms.canSoftDelete) {
                sheetBtns.push(`<button type="button" class="rbt-sheet-item rbt-sheet-item--primary" data-rbt-action="restore_trash" data-rbt-code="${esc(code)}">↺ Khôi phục khỏi Thùng rác</button>`);
            }
            if (rc.status === 'da_xoa' && perms.canArchiveDeleted) {
                sheetBtns.push(`<button type="button" class="rbt-sheet-item rbt-sheet-item--danger" data-rbt-action="archive_delete" data-rbt-code="${esc(code)}">🗄️ Chuyển lưu trữ ẩn</button>`);
            }
            if (rc.status !== 'da_xoa' && perms.canSoftDelete) {
                sheetBtns.push(`<button type="button" class="rbt-sheet-item rbt-sheet-item--danger" data-rbt-action="soft_delete" data-rbt-code="${esc(code)}">🗑️ Đưa vào thùng rác</button>`);
            }

            const html = `
                <div id="rbt-case-action-sheet">
                    <div class="rbt-sheet-summary">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                            <span class="rbt-case-code">${esc(code)}</span>
                            <span class="rbt-badge ${stMeta.badge}">${esc(stMeta.label)}</span>
                        </div>
                        <div><strong>${esc(rc.patientName)}</strong> ${rc.birthYear ? `(${esc(rc.birthYear)}${rc.gender ? ` · ${esc(rc.gender)}` : ''})` : ''} ${rc.admissionId ? `· NV: <code>${esc(rc.admissionId)}</code>` : ''}</div>
                        <div>📋 Chẩn đoán: ${esc(rc.diagnosis || '—')}</div>
                        <div>🤖 PPPT Robot: ${esc(rc.robotProcedure || '—')}</div>
                        <div>🔪 PTV chính: <strong>${esc(rc.mainSurgeonName || '—')}</strong>${rc.surgeryDate ? ` · ${_fmtViDate(rc.surgeryDate)} (${esc(rc.caseSlot || '—')})` : ''}</div>
                        ${rc.expectedTimeframe ? `<div>📅 Dự kiến: <strong>${esc(_fmtViDate(rc.expectedTimeframe))}</strong></div>` : ''}
                        <div>📞 SĐT: <strong>${phoneDisplay}</strong></div>
                        ${rc.note ? `<div>📝 Ghi chú: ${esc(rc.note)}</div>` : ''}
                        ${this._formatApprovalBadgeHtml(rc)}
                    </div>
                    <div class="rbt-sheet-list">
                        ${telHref ? `<a href="${esc(telHref)}" class="rbt-sheet-item rbt-sheet-item--call">📞 Gọi trực tiếp cho bệnh nhân</a>` : ''}
                        ${sheetBtns.join('')}
                        <button type="button" class="btn btn-secondary" onclick="Modal.close(true)" style="min-height:46px;">Đóng</button>
                    </div>
                </div>
            `;
            this._openRobotModal(`📋 Hồ sơ Robot — ${code}`, html, 'case_action_sheet', code);
            this._bindSheetActions(document.getElementById('rbt-case-action-sheet'));
        },

        _renderConflictBoxHtml() {
            const st = this._conflictState;
            if (!st || !Array.isArray(st.conflicts) || !st.conflicts.length) return '';
            const perms = (this._bootstrap && this._bootstrap.permissions) || {};
            const isCapExceeded = st.canOverrideConflict === false || st.conflicts.some(c => c.conflictType === 'ROBOT_DAILY_CAPACITY_EXCEEDED');
            const allowOverride = Boolean(perms.canOverrideConflict && st.canOverrideConflict !== false && !isCapExceeded);
            const items = st.conflicts.map(c => {
                const refCode = c.robotCaseCode ? `${c.robotCaseCode}` : `Lịch tuần #${c.surgeryId}`;
                return `<li><strong>${esc(refCode)}</strong> — ${esc(c.patientName || '')} (${esc(_fmtViDate(c.surgeryDate))}${c.caseSlot ? ` · ${esc(c.caseSlot)}` : ''})</li>`;
            }).join('');
            return `
                <div class="rbt-conflict-box" id="rbt-modal-conflict-box">
                    <div><strong>${isCapExceeded ? '⛔ Hệ thống Robot đã đạt công suất tối đa 3 ca/ngày (Ca 1–Ca 3):' : '⚠️ Phát hiện trùng slot Robot / Phẫu thuật viên chính:'}</strong></div>
                    <ul class="rbt-conflict-list">${items}</ul>
                    ${allowOverride ? `
                        <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;">
                            <input type="checkbox" id="rbt-confirm-conflict-cb">
                            <span><strong>Xác nhận cố ý xếp trùng lịch (Ban Chủ nhiệm / Điều phối viên)</strong></span>
                        </label>
                        <textarea class="form-textarea" id="rbt-conflict-reason" rows="2" placeholder="Nhập lý do xếp trùng lịch tối thiểu 5 ký tự..."></textarea>
                    ` : `<div class="text-secondary">${isCapExceeded ? 'Công suất của 1 hệ thống Robot tối đa 3 ca/ngày — không thể xếp đè, vui lòng chọn ngày khác.' : 'Bạn không có quyền ghi đè slot trùng — vui lòng liên hệ Điều phối viên Robot hoặc Ban Chủ nhiệm.'}</div>`}
                </div>
            `;
        },

        openCaseFormModal(mode, code = null) {
            const bs = this._bootstrap || {};
            const perms = bs.permissions || {};
            const cfg = bs.robotConfig || {};
            const surgeons = bs.surgeons || [];
            const slots = bs.validSlots || ['Ca 1', 'Ca 2', 'Ca 3'];
            const rooms = cfg.robotRooms || ['PM Robot'];
            const rc = code ? this._findCase(code) : null;
            if (code && !rc) {
                Toast.error('Không tìm thấy hồ sơ Robot — vui lòng tải lại.');
                return;
            }

            const showClinical = ['create_consult', 'create_case', 'edit_info'].includes(mode);
            const showSchedule = ['create_case', 'schedule_step1', 'edit_schedule'].includes(mode);
            const showSurgeonInSchedule = ['schedule_step1', 'edit_schedule'].includes(mode);
            const initExpDate = /^\d{4}-\d{2}-\d{2}$/.test(String(rc?.expectedTimeframe || '').trim()) ? String(rc.expectedTimeframe).trim() : '';
            const expMin = (bs.todayVn && (!initExpDate || initExpDate >= bs.todayVn)) ? bs.todayVn : '';
            const prefillSchedDate = rc?.surgeryDate
                || ((mode === 'schedule_step1' && initExpDate && (!bs.todayVn || initExpDate >= bs.todayVn)) ? initExpDate : '')
                || bs.todayVn
                || '';
            const titleMap = {
                create_consult: '🩺 Tạo ca tư vấn phẫu thuật Robot',
                create_case: '🤖 Tạo trực tiếp ca lịch mổ Robot',
                edit_info: `✏️ Cập nhật thông tin ca ${rc?.robotCaseCode || ''}`,
                edit_schedule: `🗓️ Điều chỉnh lịch mổ ${rc?.robotCaseCode || ''}`,
                schedule_step1: `📅 Xếp lịch Bước 1 — ${rc?.robotCaseCode || ''}`
            };

            const surgeonOptions = `<option value="">— Chọn PTV chính —</option>` + surgeons.map(st =>
                `<option value="${esc(st.id)}" ${Number(rc?.mainSurgeonId) === Number(st.id) ? 'selected' : ''}>${esc(st.title ? `${st.title} ${st.name}` : st.name)}</option>`
            ).join('');

            const sandboxToggleHtml = ((mode === 'create_consult' || mode === 'create_case') && perms.canAccessSandbox) ? `
                <div class="form-group rbt-form-grid--full">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                        <input type="checkbox" name="isTestSandboxCase" value="1">
                        <span>🧪 Tạo ca giả lập đào tạo <code>[TEST]</code> (ẩn khỏi ca thật &amp; KPI)</span>
                    </label>
                </div>
            ` : '';

            const html = `
                <form id="rbt-case-form" data-rbt-modal="1">
                    <div id="rbt-conflict-slot"></div>
                    <div class="rbt-form-grid">
                        ${sandboxToggleHtml}
                        ${showClinical ? `
                            <div class="form-group">
                                <label class="form-label">Họ tên bệnh nhân *</label>
                                <input class="form-input" name="patientName" value="${esc(rc?.patientName || '')}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Năm sinh</label>
                                <input class="form-input" type="number" min="1900" max="2035" name="birthYear" value="${esc(rc?.birthYear || '')}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Giới tính</label>
                                <select class="form-select" name="gender">
                                    <option value="">— Chọn —</option>
                                    <option value="Nam" ${rc?.gender === 'Nam' ? 'selected' : ''}>Nam</option>
                                    <option value="Nữ" ${rc?.gender === 'Nữ' ? 'selected' : ''}>Nữ</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Số điện thoại liên hệ ${mode === 'create_consult' ? '*' : ''}</label>
                                <input class="form-input" name="phone" value="${esc(rc && !rc.phoneMasked ? (rc.phone || '') : '')}" placeholder="${rc && rc.phoneMasked ? esc(rc.phone) : '0901234567'}" ${mode === 'create_consult' ? 'required' : ''}>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Số nhập viện (nếu đã nhập viện)</label>
                                <input class="form-input" name="admissionId" value="${esc(rc?.admissionId || '')}" placeholder="26014285">
                            </div>
                            <div class="form-group">
                                <label class="form-label">PTV chính *</label>
                                <select class="form-select" name="mainSurgeonId" required>${surgeonOptions}</select>
                            </div>
                            <div class="form-group rbt-form-grid--full">
                                <label class="form-label">Chẩn đoán</label>
                                <input class="form-input" name="diagnosis" value="${esc(rc?.diagnosis || '')}">
                            </div>
                            <div class="form-group rbt-form-grid--full">
                                <label class="form-label">Phương pháp phẫu thuật Robot</label>
                                <input class="form-input" name="robotProcedure" value="${esc(rc?.robotProcedure || '')}">
                            </div>
                        ` : ''}
                        ${mode === 'create_consult' ? `
                            <div class="form-group">
                                <label class="form-label">Kết quả tư vấn ban đầu</label>
                                <select class="form-select" name="consultResult">
                                    <option value="cho" ${(!rc || rc.consultResult === 'cho') ? 'selected' : ''}>Chờ bệnh nhân quyết định</option>
                                    <option value="dong_y" ${rc?.consultResult === 'dong_y' ? 'selected' : ''}>Đồng ý mổ Robot (vào hàng chờ B1)</option>
                                    <option value="can_nhac" ${rc?.consultResult === 'can_nhac' ? 'selected' : ''}>Đang cân nhắc</option>
                                    <option value="tu_choi" ${rc?.consultResult === 'tu_choi' ? 'selected' : ''}>Từ chối mổ Robot</option>
                                </select>
                            </div>
                        ` : ''}
                        ${mode === 'create_consult' || mode === 'edit_info' ? `
                            <div class="form-group">
                                <label class="form-label">Thời gian dự kiến (chọn lịch)</label>
                                <div class="rbt-date-wrap">
                                    <input class="form-input rbt-date-picker-only" type="date" name="expectedTimeframe" value="${esc(initExpDate)}" ${expMin ? `min="${esc(expMin)}"` : ''}>
                                    <button type="button" class="rbt-date-clear-btn" data-rbt-clear-date="expectedTimeframe" title="Xóa ngày dự kiến" aria-label="Xóa ngày dự kiến">✕</button>
                                </div>
                                ${this._buildDatePresetsHtml('expectedTimeframe')}
                            </div>
                        ` : ''}
                        ${showSchedule ? `
                            ${showSurgeonInSchedule ? `
                                <div class="form-group rbt-form-grid--full">
                                    <label class="form-label">PTV chính *</label>
                                    <select class="form-select" name="mainSurgeonId" required>${surgeonOptions}</select>
                                </div>
                            ` : ''}
                            <div class="form-group">
                                <label class="form-label">Ngày mổ dự kiến ${mode === 'schedule_step1' || mode === 'edit_schedule' ? '*' : ''}</label>
                                <input class="form-input rbt-date-picker-only" type="date" name="surgeryDate" value="${esc(prefillSchedDate)}" ${mode === 'schedule_step1' || mode === 'edit_schedule' ? 'required' : ''}>
                                ${this._buildDatePresetsHtml('surgeryDate')}
                            </div>
                            <div class="form-group">
                                <label class="form-label">Ca mổ ${mode === 'schedule_step1' || mode === 'edit_schedule' ? '*' : ''}</label>
                                <select class="form-select rbt-sr-select-mobile" name="caseSlot" ${mode === 'schedule_step1' || mode === 'edit_schedule' ? 'required' : ''}>
                                    <option value="">— Chọn ca —</option>
                                    ${slots.map(sl => `<option value="${esc(sl)}" ${rc?.caseSlot === sl ? 'selected' : ''}>${esc(sl)}</option>`).join('')}
                                </select>
                                ${this._buildSlotPillsHtml(slots, rc?.caseSlot || '')}
                            </div>
                            <div class="form-group">
                                <label class="form-label">Phòng mổ Robot</label>
                                <select class="form-select" name="operatingRoom">
                                    ${rooms.map(rm => `<option value="${esc(rm)}" ${(rc?.operatingRoom || rooms[0]) === rm ? 'selected' : ''}>${esc(rm)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Thời lượng dự kiến (phút)</label>
                                <input class="form-input" type="number" min="15" max="900" name="durationMinutes" value="${esc(rc?.durationMinutes || cfg.defaultDurationMinutes || 180)}">
                            </div>
                        ` : ''}
                        <div class="form-group rbt-form-grid--full">
                            <label class="form-label">Ghi chú điều phối</label>
                            <textarea class="form-textarea" name="note" rows="2">${esc(rc?.note || '')}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer" style="margin-top:14px;">
                        <button type="button" class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                        <button type="submit" class="btn btn-primary" id="rbt-form-submit-btn">Lưu thông tin</button>
                    </div>
                </form>
            `;
            this._openRobotModal(titleMap[mode] || 'Hồ sơ Robot', html, mode, code);

            const form = document.getElementById('rbt-case-form');
            if (!form) return;
            if (showSchedule) {
                this._bindSlotPillsAndCapacity(form, rc?.robotCaseCode || '');
            }
            form.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                await this._submitCaseForm(form, mode, rc);
            });
        },

        async _submitCaseForm(form, mode, rc) {
            const fd = new FormData(form);
            const payload = {};
            const str = (k) => (fd.get(k) != null ? String(fd.get(k)).trim() : '');

            if (mode === 'create_consult' || mode === 'create_case') {
                payload.action = mode;
                payload.patientName = str('patientName');
                payload.birthYear = str('birthYear');
                payload.gender = str('gender');
                payload.phone = str('phone');
                payload.admissionId = str('admissionId');
                payload.diagnosis = str('diagnosis');
                payload.robotProcedure = str('robotProcedure');
                payload.mainSurgeonId = Number(str('mainSurgeonId')) || null;
                payload.note = str('note');
                if (fd.get('isTestSandboxCase')) payload.isTestSandboxCase = true;
                if (mode === 'create_consult') {
                    payload.consultResult = str('consultResult') || 'cho';
                    payload.expectedTimeframe = str('expectedTimeframe');
                } else {
                    if (str('surgeryDate') && str('caseSlot')) {
                        payload.surgeryDate = str('surgeryDate');
                        payload.caseSlot = str('caseSlot');
                        payload.operatingRoom = str('operatingRoom') || 'PM Robot';
                        payload.durationMinutes = Number(str('durationMinutes')) || 180;
                    }
                }
            } else {
                payload.action = mode;
                payload.expectedRevision = Number(rc.caseRevision || 1);
                if (mode === 'edit_info') {
                    payload.patientName = str('patientName');
                    payload.birthYear = str('birthYear');
                    payload.gender = str('gender');
                    if (str('phone') && !str('phone').includes('****')) {
                        payload.phone = str('phone');
                    }
                    payload.admissionId = str('admissionId');
                    payload.diagnosis = str('diagnosis');
                    payload.robotProcedure = str('robotProcedure');
                    payload.mainSurgeonId = Number(str('mainSurgeonId')) || null;
                    payload.expectedTimeframe = str('expectedTimeframe');
                    payload.note = str('note');
                } else {
                    payload.mainSurgeonId = Number(str('mainSurgeonId')) || rc.mainSurgeonId;
                    payload.surgeryDate = str('surgeryDate');
                    payload.caseSlot = str('caseSlot');
                    payload.operatingRoom = str('operatingRoom') || 'PM Robot';
                    payload.durationMinutes = Number(str('durationMinutes')) || 180;
                    payload.note = str('note');
                }
            }

            if (this._conflictState && document.getElementById('rbt-confirm-conflict-cb')?.checked) {
                payload.confirmConflict = true;
                payload.conflictOverrideReason = String(document.getElementById('rbt-conflict-reason')?.value || '').trim();
                payload.expectedConflictFingerprint = this._conflictState.conflictFingerprint;
            }

            const btn = document.getElementById('rbt-form-submit-btn');
            if (btn) btn.disabled = true;
            try {
                if (mode === 'create_consult' || mode === 'create_case') {
                    await this._apiJson('/api/robot/cases', { method: 'POST', body: payload });
                } else {
                    await this._apiJson(`/api/robot/cases/${encodeURIComponent(rc.robotCaseCode)}`, { method: 'PATCH', body: payload });
                }
                this._modalDirty = false;
                Modal.close();
                Toast.success('Đã lưu hồ sơ Điều phối Robot thành công.');
                await this._refreshBoth(true);
            } catch (err) {
                if (err.status === 409 && ['SCHEDULE_SLOT_CONFLICT', 'CONFLICT_FINGERPRINT_MISMATCH', 'ROBOT_DAILY_CAPACITY_EXCEEDED'].includes(err.code)) {
                    this._conflictState = err.data || {};
                    const slotEl = document.getElementById('rbt-conflict-slot');
                    if (slotEl) slotEl.innerHTML = this._renderConflictBoxHtml();
                    Toast.warning(err.message);
                } else if (err.status === 409 && err.code === 'CASE_REVISION_MISMATCH') {
                    Toast.warning(err.message);
                    await this._refreshBoth(true);
                } else {
                    Toast.error(err.message || 'Không thể lưu hồ sơ.');
                }
            } finally {
                if (btn) btn.disabled = false;
            }
        },

        openConsultResultModal(code) {
            const rc = this._findCase(code);
            if (!rc) return;
            const bs = this._bootstrap || {};
            const initExpDate = /^\d{4}-\d{2}-\d{2}$/.test(String(rc.expectedTimeframe || '').trim()) ? String(rc.expectedTimeframe).trim() : '';
            const expMin = (bs.todayVn && (!initExpDate || initExpDate >= bs.todayVn)) ? bs.todayVn : '';
            const html = `
                <form id="rbt-consult-form" data-rbt-modal="1">
                    <div class="form-group">
                        <label class="form-label">Kết quả tư vấn của BN ${esc(rc.patientName)}</label>
                        <select class="form-select" name="consultResult" required>
                            <option value="dong_y">Đồng ý mổ Robot (vào Chờ xếp lịch B1)</option>
                            <option value="can_nhac" ${rc.consultResult === 'can_nhac' ? 'selected' : ''}>Đang cân nhắc</option>
                            <option value="tu_choi" ${rc.consultResult === 'tu_choi' ? 'selected' : ''}>Từ chối mổ Robot</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thời gian dự kiến (chọn lịch)</label>
                        <div class="rbt-date-wrap">
                            <input class="form-input rbt-date-picker-only" type="date" name="expectedTimeframe" value="${esc(initExpDate)}" ${expMin ? `min="${esc(expMin)}"` : ''}>
                            <button type="button" class="rbt-date-clear-btn" data-rbt-clear-date="expectedTimeframe" title="Xóa ngày dự kiến" aria-label="Xóa ngày dự kiến">✕</button>
                        </div>
                        ${this._buildDatePresetsHtml('expectedTimeframe')}
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú tư vấn</label>
                        <textarea class="form-textarea" name="consultNote" rows="2">${esc(rc.consultNote || '')}</textarea>
                    </div>
                    <div class="modal-footer" style="margin-top:12px;">
                        <button type="button" class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                        <button type="submit" class="btn btn-primary">Cập nhật</button>
                    </div>
                </form>
            `;
            this._openRobotModal(`🩺 Kết quả tư vấn — ${code}`, html, 'consult_result', code);
            document.getElementById('rbt-consult-form')?.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const fd = new FormData(ev.target);
                await this._runModalPatch(rc, {
                    action: 'consult_result',
                    expectedRevision: Number(rc.caseRevision || 1),
                    consultResult: String(fd.get('consultResult') || ''),
                    expectedTimeframe: String(fd.get('expectedTimeframe') || '').trim(),
                    consultNote: String(fd.get('consultNote') || '').trim()
                });
            });
        },

        openPostponeModal(code) {
            const rc = this._findCase(code);
            if (!rc) return;
            const reasons = (this._bootstrap && this._bootstrap.postponeReasons) || {};
            const html = `
                <form id="rbt-postpone-form" data-rbt-modal="1">
                    <div class="form-group">
                        <label class="form-label">Chọn lý do hoãn ca ${esc(rc.patientName)} *</label>
                        <select class="form-select" name="postponeReasonCode" required>
                            <option value="">— Chọn lý do chuẩn —</option>
                            ${Object.entries(reasons).map(([k, lbl]) => `<option value="${esc(k)}">${esc(lbl)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú chi tiết</label>
                        <textarea class="form-textarea" name="postponeReasonNote" rows="2" placeholder="Bắt buộc ≥ 3 ký tự nếu chọn Lý do khác"></textarea>
                    </div>
                    <div class="modal-footer" style="margin-top:12px;">
                        <button type="button" class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                        <button type="submit" class="btn btn-danger">Xác nhận hoãn mổ</button>
                    </div>
                </form>
            `;
            this._openRobotModal(`⏸️ Hoãn mổ Robot — ${code}`, html, 'postpone', code);
            document.getElementById('rbt-postpone-form')?.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const fd = new FormData(ev.target);
                await this._runModalPatch(rc, {
                    action: 'postpone',
                    expectedRevision: Number(rc.caseRevision || 1),
                    postponeReasonCode: String(fd.get('postponeReasonCode') || ''),
                    postponeReasonNote: String(fd.get('postponeReasonNote') || '').trim()
                }, true);
            });
        },

        openDischargeModal(code) {
            const rc = this._findCase(code);
            if (!rc) return;
            const html = `
                <form id="rbt-discharge-form" data-rbt-modal="1">
                    <div class="form-group">
                        <label class="form-label">Lý do cho xuất viện chờ lịch mổ mới *</label>
                        <textarea class="form-textarea" name="dischargeReason" rows="2" required minlength="3" placeholder="VD: Về điều chỉnh nội khoa 2 tuần"></textarea>
                    </div>
                    <div class="modal-footer" style="margin-top:12px;">
                        <button type="button" class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                        <button type="submit" class="btn btn-primary">Chuyển Xuất viện chờ</button>
                    </div>
                </form>
            `;
            this._openRobotModal(`🏠 Xuất viện chờ — ${code}`, html, 'discharge_wait', code);
            document.getElementById('rbt-discharge-form')?.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const fd = new FormData(ev.target);
                await this._runModalPatch(rc, {
                    action: 'discharge_wait',
                    expectedRevision: Number(rc.caseRevision || 1),
                    dischargeReason: String(fd.get('dischargeReason') || '').trim()
                }, true);
            });
        },

        openRestoreScheduleModal(code, actionName) {
            const rc = this._findCase(code);
            if (!rc) return;
            const bs = this._bootstrap || {};
            const slots = bs.validSlots || ['Ca 1', 'Ca 2', 'Ca 3'];
            const rooms = (bs.robotConfig && bs.robotConfig.robotRooms) || ['PM Robot'];
            const isReadmit = actionName === 'readmit';
            const html = `
                <form id="rbt-restore-form" data-rbt-modal="1">
                    <div id="rbt-conflict-slot"></div>
                    <div class="rbt-form-grid">
                        <div class="form-group">
                            <label class="form-label">Ngày mổ mới *</label>
                            <input class="form-input rbt-date-picker-only" type="date" name="surgeryDate" value="${esc(bs.todayVn || '')}" required>
                            ${this._buildDatePresetsHtml('surgeryDate')}
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ca mổ *</label>
                            <select class="form-select rbt-sr-select-mobile" name="caseSlot" required>
                                ${slots.map(sl => `<option value="${esc(sl)}" ${(rc.caseSlot || 'Ca 1') === sl ? 'selected' : ''}>${esc(sl)}</option>`).join('')}
                            </select>
                            ${this._buildSlotPillsHtml(slots, rc.caseSlot || 'Ca 1')}
                        </div>
                        <div class="form-group">
                            <label class="form-label">Phòng mổ Robot</label>
                            <select class="form-select" name="operatingRoom">
                                ${rooms.map(rm => `<option value="${esc(rm)}">${esc(rm)}</option>`).join('')}
                            </select>
                        </div>
                        ${!isReadmit ? `
                            <div class="form-group">
                                <label class="form-label">Bước đích</label>
                                <select class="form-select" name="targetStep">
                                    <option value="cho_duyet_tien_phau">Về B2 Chờ duyệt tiền phẫu (Khuyến nghị)</option>
                                    <option value="cho_mo">Lên thẳng B3 Chờ mổ (Cùng đợt cũ)</option>
                                </select>
                            </div>
                        ` : ''}
                        <div class="form-group rbt-form-grid--full">
                            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                                <input type="checkbox" name="newEpisode" value="1">
                                <span>Đây là đợt điều trị mới (niêm phong liên kết cũ, tạo mã ca lịch tuần mới)</span>
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer" style="margin-top:12px;">
                        <button type="button" class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                        <button type="submit" class="btn btn-primary">Xác nhận xếp lịch</button>
                    </div>
                </form>
            `;
            this._openRobotModal(isReadmit ? `🏥 Nhập lại chờ mổ — ${code}` : `📅 Xếp lịch lại — ${code}`, html, actionName, code);
            const restoreForm = document.getElementById('rbt-restore-form');
            this._bindSlotPillsAndCapacity(restoreForm, rc.robotCaseCode || '');
            restoreForm?.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const fd = new FormData(ev.target);
                const payload = {
                    action: actionName,
                    expectedRevision: Number(rc.caseRevision || 1),
                    surgeryDate: String(fd.get('surgeryDate') || '').trim(),
                    caseSlot: String(fd.get('caseSlot') || '').trim(),
                    operatingRoom: String(fd.get('operatingRoom') || 'PM Robot').trim(),
                    newEpisode: Boolean(fd.get('newEpisode'))
                };
                if (!isReadmit) {
                    payload.targetStep = String(fd.get('targetStep') || 'cho_duyet_tien_phau');
                }
                await this._runModalPatch(rc, payload, true);
            });
        },

        openLinkSurgeryModal(preselectSid = '') {
            const bs = this._bootstrap || {};
            const list = bs.unlinkedFutureRobotSurgeries || [];
            if (!list.length) {
                Toast.info('Không còn ca Robot chưa liên kết trên Lịch mổ tuần.');
                return;
            }
            const slots = bs.validSlots || ['Ca 1', 'Ca 2', 'Ca 3'];
            const html = `
                <form id="rbt-link-form" data-rbt-modal="1">
                    <div class="form-group">
                        <label class="form-label">Chọn ca Robot trên Lịch mổ tuần *</label>
                        <select class="form-select" name="surgeryId" required>
                            ${list.map(s => `<option value="${esc(s.id)}" ${String(preselectSid) === String(s.id) ? 'selected' : ''}>#${esc(s.id)} · ${_fmtViDate(s.date)} · ${esc(s.patientName)} (${esc(s.mainSurgeonName || '')})</option>`).join('')}
                        </select>
                    </div>
                    <div class="rbt-form-grid">
                        <div class="form-group">
                            <label class="form-label">Ca mổ Robot</label>
                            <select class="form-select" name="caseSlot">
                                ${slots.map(sl => `<option value="${esc(sl)}">${esc(sl)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Số điện thoại liên hệ</label>
                            <input class="form-input" name="phone" placeholder="0901234567">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú liên kết</label>
                        <input class="form-input" name="note" value="">
                    </div>
                    <div class="modal-footer" style="margin-top:12px;">
                        <button type="button" class="btn btn-secondary" onclick="Modal.close()">Hủy</button>
                        <button type="submit" class="btn btn-primary">Liên kết hồ sơ</button>
                    </div>
                </form>
            `;
            this._openRobotModal('🔗 Liên kết ca Robot sẵn có từ Lịch tuần', html, 'link_existing_surgery');
            document.getElementById('rbt-link-form')?.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const fd = new FormData(ev.target);
                try {
                    await this._apiJson('/api/robot/cases/link-surgery', {
                        method: 'POST',
                        body: {
                            action: 'link_existing_surgery',
                            surgeryId: Number(fd.get('surgeryId')),
                            caseSlot: String(fd.get('caseSlot') || 'Ca 1'),
                            phone: String(fd.get('phone') || '').trim(),
                            note: String(fd.get('note') || '').trim()
                        }
                    });
                    this._modalDirty = false;
                    Modal.close();
                    Toast.success('Đã liên kết ca Lịch tuần sang Điều phối Robot.');
                    await this._refreshBoth(true);
                } catch (err) {
                    Toast.error(err.message || 'Không thể liên kết ca.');
                }
            });
        },

        async _runModalPatch(rc, payload, syncWeekly = false) {
            if (this._conflictState && document.getElementById('rbt-confirm-conflict-cb')?.checked) {
                payload.confirmConflict = true;
                payload.conflictOverrideReason = String(document.getElementById('rbt-conflict-reason')?.value || '').trim();
                payload.expectedConflictFingerprint = this._conflictState.conflictFingerprint;
            }
            try {
                await this._apiJson(`/api/robot/cases/${encodeURIComponent(rc.robotCaseCode)}`, {
                    method: 'PATCH',
                    body: payload
                });
                this._modalDirty = false;
                Modal.close();
                Toast.success('Đã cập nhật trạng thái Điều phối Robot.');
                await this._refreshBoth(syncWeekly);
            } catch (err) {
                if (err.status === 409 && ['SCHEDULE_SLOT_CONFLICT', 'CONFLICT_FINGERPRINT_MISMATCH', 'ROBOT_DAILY_CAPACITY_EXCEEDED'].includes(err.code)) {
                    this._conflictState = err.data || {};
                    const slotEl = document.getElementById('rbt-conflict-slot');
                    if (slotEl) slotEl.innerHTML = this._renderConflictBoxHtml();
                    Toast.warning(err.message);
                } else {
                    Toast.error(err.message || 'Thao tác thất bại.');
                }
            }
        },

        async _runQuickPatch(code, action, extraBody = {}, syncWeekly = false) {
            const rc = this._findCase(code);
            if (!rc) return;
            try {
                await this._apiJson(`/api/robot/cases/${encodeURIComponent(code)}`, {
                    method: 'PATCH',
                    body: { action, expectedRevision: Number(rc.caseRevision || 1), ...extraBody }
                });
                Toast.success('Đã cập nhật thành công.');
                await this._refreshBoth(syncWeekly);
            } catch (err) {
                Toast.error(err.message || 'Không thể thực hiện thao tác.');
            }
        },

        async _runArchiveDelete(code) {
            const rc = this._findCase(code);
            if (!rc) return;
            try {
                await this._apiJson(`/api/robot/cases/${encodeURIComponent(code)}`, {
                    method: 'DELETE',
                    body: { expectedRevision: Number(rc.caseRevision || 1) }
                });
                Toast.success(`Đã lưu trữ ẩn hồ sơ ${code} (Zero-RM).`);
                await this._refreshBoth(false);
            } catch (err) {
                Toast.error(err.message || 'Không thể lưu trữ ẩn hồ sơ.');
            }
        },

        async _saveConfigFromTab() {
            const form = document.getElementById('rbt-config-form');
            if (!form) return;
            const fd = new FormData(form);
            const coords = fd.getAll('coordinators').map(x => String(x).trim().toLowerCase()).filter(Boolean);
            const cfgRev = Number((this._bootstrap && this._bootstrap.configRevision) || 1);
            try {
                await this._apiJson('/api/robot/config', {
                    method: 'PUT',
                    body: {
                        coordinators: coords,
                        defaultSchedulerName: String(fd.get('defaultSchedulerName') || 'Quang').trim(),
                        postponeLookbackDays: Number(fd.get('postponeLookbackDays') || 7),
                        expectedConfigRevision: cfgRev
                    }
                });
                Toast.success('Đã lưu cấu hình Điều phối Robot.');
                await this._refreshBoth(false);
            } catch (err) {
                Toast.error(err.message || 'Không thể lưu cấu hình.');
            }
        },

        _buildPctxhSheetHtml() {
            const bs = this._bootstrap || {};
            const st = this._printState;
            const weekStart = _mondayOf(this._weekStartIso || bs.todayVn || _fmtIsoLocal(new Date()));
            const weekDates = new Set();
            for (let i = 0; i < 6; i++) {
                const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
                weekDates.add(_fmtIsoLocal(d));
            }
            const rowsData = (bs.cases || []).filter(c => {
                if (!['cho_duyet_tien_phau', 'cho_duyet_luu_vien', 'cho_mo'].includes(c.status)) return false;
                if (st.scope === 'day' && st.date) return c.surgeryDate === st.date;
                return weekDates.has(c.surgeryDate);
            }).sort((a, b) => String(a.surgeryDate || '').localeCompare(String(b.surgeryDate || '')));

            const sheetCls = st.mode === 'bw' ? 'rbt-a5-sheet rbt-a5-sheet--bw' : 'rbt-a5-sheet rbt-a5-sheet--color';
            const scheduler = st.schedulerName || (bs.robotConfig && bs.robotConfig.defaultSchedulerName) || 'Quang';
            const scopeTitle = st.scope === 'day' && st.date
                ? `Ngày mổ: ${_fmtViDate(st.date)}`
                : `Tuần mổ từ ${_fmtViDate(_fmtIsoLocal(weekStart))}`;

            return `
                <div class="${sheetCls}" id="rbt-a5-pctxh-sheet">
                    <div class="rbt-a5-sheet__top">
                        <img src="img/logo-khoa.jpg" alt="Logo Khoa PTĐTT" class="rbt-a5-sheet__logo">
                        <div class="rbt-a5-sheet__org">
                            <div class="rbt-a5-sheet__hosp">BỆNH VIỆN BÌNH DÂN</div>
                            <div class="rbt-a5-sheet__dept">KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG</div>
                        </div>
                        <div style="text-align:right;font-size:10px;">
                            <div><strong>MẪU A5 — PHÒNG CTXH</strong></div>
                            <div>Ngày in: ${_fmtViDate(bs.todayVn || _fmtIsoLocal(new Date()))}</div>
                        </div>
                    </div>
                    <h2 class="rbt-a5-sheet__title">PHIẾU CHUYỂN DANH SÁCH XẾP LỊCH MỔ ROBOT</h2>
                    <p class="rbt-a5-sheet__subtitle">Kính chuyển: Anh/Chị <strong>${esc(scheduler)}</strong> — Phòng Công tác Xã hội · ${esc(scopeTitle)}</p>
                    <table class="rbt-a5-table">
                        <thead>
                            <tr>
                                <th class="rbt-col-nowrap">STT</th>
                                <th>Họ và tên BN</th>
                                <th class="rbt-col-nowrap">NS / Giới</th>
                                <th class="rbt-col-nowrap">Số NV</th>
                                <th>Chẩn đoán &amp; Phương pháp PT Robot</th>
                                <th class="rbt-col-nowrap">Ngày / Ca</th>
                                <th class="rbt-col-surgeon">PTV chính</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsData.length ? rowsData.map((c, idx) => `
                                <tr>
                                    <td class="rbt-col-nowrap">${idx + 1}</td>
                                    <td><strong class="rbt-col-patient-line">${esc(c.patientName)}</strong></td>
                                    <td class="rbt-col-nowrap">${esc(c.birthYear || '—')}<br>${esc(c.gender || '')}</td>
                                    <td class="rbt-col-nowrap">${esc(c.admissionId || '—')}</td>
                                    <td><strong>${esc(c.diagnosis || '—')}</strong><br>${esc(c.robotProcedure || '—')}</td>
                                    <td class="rbt-col-nowrap">${_fmtViDate(c.surgeryDate)}<br>${esc(c.caseSlot || '—')}</td>
                                    <td class="rbt-col-surgeon">${esc(c.mainSurgeonName || '—')}</td>
                                </tr>
                            `).join('') : `<tr><td colspan="7" style="text-align:center;">Không có ca Robot phù hợp trong khoảng chọn.</td></tr>`}
                        </tbody>
                    </table>
                    <div class="rbt-a5-sheet__footer">
                        <div>Tổng số ca dự kiến: <strong>${rowsData.length} ca</strong> (Không in số điện thoại cá nhân lên phiếu giấy)</div>
                        <div style="text-align:center;"><strong>ĐIỀU PHỐI KHOA PTĐTT</strong><br><span style="font-size:10px;">(Ký xác nhận)</span></div>
                    </div>
                </div>
            `;
        },

        openPrintPctxhModal() {
            const bs = this._bootstrap || {};
            if (!this._printState.schedulerName) {
                this._printState.schedulerName = (bs.robotConfig && bs.robotConfig.defaultSchedulerName) || 'Quang';
            }
            if (!this._printState.date) {
                this._printState.date = bs.todayVn || _fmtIsoLocal(new Date());
            }

            const html = `
                <div id="robot-pctxh-print-controls">
                    <div class="rbt-form-grid" style="margin-bottom:12px;">
                        <div class="form-group">
                            <label class="form-label">Chế độ màu bản in A5</label>
                            <select class="form-select" id="rbt-pctxh-mode" data-rbt-no-dirty="1">
                                <option value="color" ${this._printState.mode === 'color' ? 'selected' : ''}>🎨 Màu thương hiệu (#1D2357 / #1878B4)</option>
                                <option value="bw" ${this._printState.mode === 'bw' ? 'selected' : ''}>🖨️ Trắng đen (#000000 tiết kiệm mực)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Người nhận tại Phòng CTXH</label>
                            <input class="form-input" id="rbt-pctxh-scheduler" data-rbt-no-dirty="1" value="${esc(this._printState.schedulerName)}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Phạm vi danh sách</label>
                            <select class="form-select" id="rbt-pctxh-scope" data-rbt-no-dirty="1">
                                <option value="week" ${this._printState.scope === 'week' ? 'selected' : ''}>Cả tuần đang xem</option>
                                <option value="day" ${this._printState.scope === 'day' ? 'selected' : ''}>Theo 1 ngày cụ thể</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ngày (khi chọn Theo ngày)</label>
                            <input class="form-input rbt-date-picker-only" type="date" id="rbt-pctxh-date" data-rbt-no-dirty="1" value="${esc(this._printState.date)}">
                        </div>
                    </div>
                    <div id="rbt-pctxh-preview-box">${this._buildPctxhSheetHtml()}</div>
                    <div class="modal-footer" style="margin-top:14px;">
                        <button type="button" class="btn btn-secondary" onclick="Modal.close()">Đóng</button>
                        <button type="button" class="btn btn-primary" id="rbt-pctxh-do-print">🖨️ In phiếu A5 P.CTXH</button>
                    </div>
                </div>
            `;
            this._openRobotModal('🖨️ Xem trước & In Phiếu A5 P.CTXH', html, 'print_pctxh');

            const syncPreview = () => {
                this._printState.mode = document.getElementById('rbt-pctxh-mode')?.value || 'color';
                this._printState.schedulerName = document.getElementById('rbt-pctxh-scheduler')?.value || 'Quang';
                this._printState.scope = document.getElementById('rbt-pctxh-scope')?.value || 'week';
                this._printState.date = document.getElementById('rbt-pctxh-date')?.value || '';
                const box = document.getElementById('rbt-pctxh-preview-box');
                if (box) box.innerHTML = this._buildPctxhSheetHtml();
            };

            ['rbt-pctxh-mode', 'rbt-pctxh-scope', 'rbt-pctxh-date'].forEach(id => {
                document.getElementById(id)?.addEventListener('change', syncPreview);
            });
            document.getElementById('rbt-pctxh-scheduler')?.addEventListener('input', syncPreview);
            document.getElementById('rbt-pctxh-do-print')?.addEventListener('click', () => {
                syncPreview();
                const sheetHtml = this._buildPctxhSheetHtml();
                const root = document.getElementById('robot-pctxh-print-root');
                if (root) {
                    root.innerHTML = sheetHtml;
                    document.body.classList.add('printing-robot-pctxh');
                }
                if (typeof window !== 'undefined' && typeof window.print === 'function') {
                    window.print();
                }
            });
        },

        async openFromWeeklySchedule(robotCode) {
            if (typeof App !== 'undefined') {
                App.navigate('robot-schedule');
            }
            if (!this._bootstrap) {
                try { await this.loadBootstrap(true); } catch (_) {}
            }
            const rc = this._findCase(robotCode);
            if (!rc) {
                this._rerenderInPlace();
                return;
            }
            if (['cho_duyet_tien_phau', 'cho_duyet_luu_vien', 'cho_mo', 'da_mo'].includes(rc.status)) {
                this._subtab = 'week';
                if (rc.surgeryDate) {
                    this._weekStartIso = _fmtIsoLocal(_mondayOf(rc.surgeryDate));
                    this._mobileDayIso = rc.surgeryDate;
                    this._mobileWeekAllDays = false;
                }
            } else if (['hoan_mo', 'xuat_vien_cho'].includes(rc.status)) {
                this._subtab = 'postponed';
            } else if (rc.status === 'da_xoa') {
                this._subtab = 'trash';
            } else {
                this._subtab = 'consult';
            }
            this._rerenderInPlace();
        }
    };

    global.RobotSchedulePage = RobotSchedulePage;
})(window);
