// ===== ONBOARDING TOUR =====
const Onboarding = {
    currentStep: 0,
    steps: [
        {
            icon: '👋',
            title: 'Chào mừng đến PTDTT Manager!',
            desc: 'Đây là hệ thống quản lý dành riêng cho Khoa PT Đại trực tràng — Bệnh viện Bình Dân. Hãy cùng khám phá các tính năng chính!',
            target: '.sidebar-logo',
            position: 'right'
        },
        {
            icon: '📊',
            title: 'Tổng quan (Dashboard)',
            desc: 'Hiển thị nhanh tình hình khoa: nhân sự hiện tại, bệnh nhân đang điều trị, ca phẫu thuật trong tuần, đồng hồ real-time, và biểu đồ xu hướng PT 6 tháng.',
            target: '[data-page="dashboard"]',
            position: 'right'
        },
        {
            icon: '👥',
            title: 'Nhân sự',
            desc: 'Danh sách toàn bộ nhân viên khoa (40+ người) — tìm kiếm, lọc theo vai trò, và xuất Excel danh sách nhân sự.',
            target: '[data-page="staff"]',
            position: 'right'
        },
        {
            icon: '🏠',
            title: 'Sơ đồ Phòng bệnh',
            desc: 'Trực quan hóa 11 phòng bệnh Tầng 7 Tòa B — hiện số giường, bệnh nhân, bác sĩ phụ trách từng phòng.',
            target: '[data-page="rooms"]',
            position: 'right'
        },
        {
            icon: '🔪',
            title: 'Lịch mổ tuần',
            desc: 'Xem lịch phẫu thuật 7 ngày — thêm/sửa ca mổ, phân loại Chương trình/Yêu cầu/Bán khẩn/Robot, xuất ảnh chia sẻ.',
            target: '[data-page="surgery"]',
            position: 'right'
        },
        {
            icon: '📈',
            title: 'Thống kê PT',
            desc: 'Thống kê ca mổ theo bác sĩ mổ chính — tuần/tháng/quý/năm. Xuất Excel báo cáo đầy đủ, nhấn vào tên BS để xem chi tiết.',
            target: '[data-page="surgery-stats"]',
            position: 'right'
        },
        {
            icon: '🔍',
            title: 'Tìm kiếm nhanh (⌘K)',
            desc: 'Nhấn ⌘K (hoặc Ctrl+K) để tìm kiếm toàn hệ thống: nhân sự, ca mổ, lịch SHCM, kế hoạch — mọi thứ trong 1 ô tìm kiếm!',
            target: '.sidebar-search-btn',
            position: 'right'
        }
    ],

    // Check if should show onboarding
    shouldShow() {
        return !localStorage.getItem('ptdtt_onboarding_done');
    },

    // Start the tour
    start() {
        this.currentStep = 0;
        this._render();
    },

    // Skip/finish
    finish() {
        localStorage.setItem('ptdtt_onboarding_done', 'true');
        this._cleanup();
    },

    // Go to next step
    next() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this._render();
        } else {
            this.finish();
            Toast.success('🎉 Hoàn thành hướng dẫn! Chúc bạn sử dụng hệ thống hiệu quả.');
        }
    },

    // Go to prev step
    prev() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this._render();
        }
    },

    _render() {
        this._cleanup();
        const step = this.steps[this.currentStep];
        if (!step) return;

        // Find target element
        const target = document.querySelector(step.target);
        const rect = target ? target.getBoundingClientRect() : null;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'onboarding-overlay';
        overlay.className = 'onboarding-overlay';

        // Spotlight on target
        if (rect) {
            const spotlight = document.createElement('div');
            spotlight.className = 'onboarding-spotlight';
            spotlight.style.top = (rect.top - 6) + 'px';
            spotlight.style.left = (rect.left - 6) + 'px';
            spotlight.style.width = (rect.width + 12) + 'px';
            spotlight.style.height = (rect.height + 12) + 'px';
            overlay.appendChild(spotlight);
        }

        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'onboarding-tooltip';
        tooltip.innerHTML = `
            <div class="onb-step-icon">${step.icon}</div>
            <div class="onb-step-title">${step.title}</div>
            <div class="onb-step-desc">${step.desc}</div>
            <div class="onb-progress">
                ${this.steps.map((_, i) => `<div class="onb-progress-dot ${i < this.currentStep ? 'done' : ''} ${i === this.currentStep ? 'active' : ''}"></div>`).join('')}
            </div>
            <div class="onb-step-counter">Bước ${this.currentStep + 1} / ${this.steps.length}</div>
            <div class="onb-actions">
                <button class="onb-btn onb-btn-skip" onclick="Onboarding.finish()">Bỏ qua</button>
                <div>
                    ${this.currentStep > 0 ? '<button class="onb-btn onb-btn-prev" onclick="Onboarding.prev()">← Trước</button>' : ''}
                    <button class="onb-btn onb-btn-next" onclick="Onboarding.next()">
                        ${this.currentStep === this.steps.length - 1 ? '✓ Hoàn thành' : 'Tiếp theo →'}
                    </button>
                </div>
            </div>
        `;

        // Position tooltip
        this._positionTooltip(tooltip, rect, step);

        overlay.appendChild(tooltip);
        document.body.appendChild(overlay);
    },

    _positionTooltip(tooltip, rect, step) {
        if (window.innerWidth <= 768) {
            tooltip.style.left = '12px';
            tooltip.style.right = '12px';
            tooltip.style.width = 'auto';
            tooltip.style.maxWidth = (window.innerWidth - 24) + 'px';
            tooltip.style.bottom = '76px';
            tooltip.style.top = 'auto';
            tooltip.style.transform = 'none';
            return;
        }
        if (rect) {
            const gap = 16;
            if (step.position === 'right') {
                tooltip.style.top = Math.max(12, rect.top - 10) + 'px';
                tooltip.style.left = Math.max(12, rect.right + gap) + 'px';
            } else if (step.position === 'bottom') {
                tooltip.style.top = Math.max(12, rect.bottom + gap) + 'px';
                tooltip.style.left = Math.max(12, rect.left) + 'px';
            }
            requestAnimationFrame(() => {
                const tr = tooltip.getBoundingClientRect();
                if (tr.right > window.innerWidth - 12) {
                    tooltip.style.left = Math.max(12, window.innerWidth - tr.width - 12) + 'px';
                }
                if (tr.left < 12) {
                    tooltip.style.left = '12px';
                }
                if (tr.bottom > window.innerHeight - 12) {
                    tooltip.style.top = Math.max(12, window.innerHeight - tr.height - 12) + 'px';
                }
            });
        } else {
            tooltip.style.top = '50%';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translate(-50%, -50%)';
        }
    },

    _cleanup() {
        const existing = document.getElementById('onboarding-overlay');
        if (existing) existing.remove();
    }
};

// ===== ICON GUIDE NOTICE (1-WEEK LOGIN ANNOUNCEMENT — FEAT-238) =====
const IconGuideNotice = {
    CAMPAIGN_ID: 'v261121',
    START_AT: '2026-11-21T00:00:00+07:00',
    EXPIRES_AT: '2026-11-28T23:59:59+07:00',
    STORAGE_KEY_GLOBAL: 'ptdtt_icon_guide_v261121_dismissed',
    STORAGE_KEY_PREFIX: 'ptdtt_icon_guide_v261121_dismissed:',
    SESSION_KEY_PREFIX: 'ptdtt_icon_guide_v261121_session:',
    _escHandler: null,

    ITEMS: [
        // Tác nghiệp hằng ngày (8 tab đầu)
        { group: 'daily', page: 'dashboard', name: 'Tổng quan', desc: 'Chỉ số nhanh & lịch trực hôm nay' },
        { group: 'daily', page: 'surgery', name: 'Lịch mổ tuần', desc: 'Lịch phẫu thuật 7 ngày & phân loại ca' },
        { group: 'daily', page: 'robot-schedule', name: 'Điều phối Robot', desc: 'Xếp lịch & quản lý ca mổ Robot' },
        { group: 'daily', page: 'surgery-approval', name: 'Duyệt mổ khoa', desc: 'Trình & phê duyệt hồ sơ tiền phẫu' },
        { group: 'daily', page: 'rooms', name: 'Phòng bệnh', desc: 'Sơ đồ giường & bác sĩ phụ trách' },
        { group: 'daily', page: 'reports', name: 'Báo cáo', desc: 'Sổ giao ban buồng bệnh 7h & 16h' },
        { group: 'daily', page: 'staff-tracking', name: 'Theo dõi NV', desc: 'Chấm công có mặt / vắng mặt hàng ngày' },
        { group: 'daily', page: 'schedule', name: 'Phân công tuần', desc: 'Lịch trực khoa, cấp cứu & công tác tuần' },
        // Quản trị & Học thuật (6 tab sau)
        { group: 'manage', page: 'staff', name: 'Nhân sự', desc: 'Danh bạ & thông tin nhân sự khoa' },
        { group: 'manage', page: 'plans', name: 'Kế hoạch', desc: 'Lịch SHCM & công tác theo tháng' },
        { group: 'manage', page: 'surgery-stats', name: 'Thống kê PT', desc: 'Thống kê số ca mổ theo bác sĩ' },
        { group: 'manage', page: 'research', name: 'Sinh hoạt CM', desc: 'Lịch & bài trình bày chuyên môn' },
        { group: 'manage', page: 'conferences', name: 'Hội nghị', desc: 'Hội nghị khoa học & báo cáo viên' },
        { group: 'manage', page: 'nckh', name: 'Nghiên cứu KH', desc: 'Đề tài NCKH & sáng kiến cải tiến' },
    ],

    _getUsername() {
        try {
            if (typeof Auth !== 'undefined' && typeof Auth.getSession === 'function') {
                return Auth.getSession()?.username || 'guest';
            }
        } catch (_) { /* noop */ }
        return 'guest';
    },

    isWithinWindow(nowDate) {
        const ts = (nowDate instanceof Date ? nowDate : new Date()).getTime();
        const start = Date.parse(this.START_AT);
        const end = Date.parse(this.EXPIRES_AT);
        return Number.isFinite(ts) && ts >= start && ts <= end;
    },

    isDismissed(username) {
        const user = username || this._getUsername();
        try {
            if (localStorage.getItem(this.STORAGE_KEY_GLOBAL) === '1') return true;
            if (localStorage.getItem(this.STORAGE_KEY_PREFIX + user) === '1') return true;
            if (sessionStorage.getItem(this.SESSION_KEY_PREFIX + user) === '1') return true;
        } catch (_) {
            return false;
        }
        return false;
    },

    clearSessionDismiss(username) {
        const user = username || this._getUsername();
        try {
            sessionStorage.removeItem(this.SESSION_KEY_PREFIX + user);
        } catch (_) { /* noop */ }
    },

    shouldShow(opts = {}) {
        if (!this.isWithinWindow(opts.now)) return false;
        if (this.isDismissed(opts.username)) return false;
        try {
            if (typeof Auth !== 'undefined' && Auth.getSession()?.mustChangePassword) return false;
            if (typeof Onboarding !== 'undefined' && typeof Onboarding.shouldShow === 'function' && Onboarding.shouldShow()) {
                return false;
            }
        } catch (_) { /* noop */ }
        return true;
    },

    _getVisibleItems() {
        return this.ITEMS.reduce((acc, item) => {
            const navEl = document.getElementById(`nav-${item.page}`);
            if (!navEl) return acc;
            const cs = typeof getComputedStyle === 'function' ? getComputedStyle(navEl) : null;
            if (navEl.style.display === 'none' || (cs && cs.display === 'none')) return acc;
            const svg = navEl.querySelector('svg.nav-icon');
            acc.push({ ...item, svgHtml: svg ? svg.outerHTML : '' });
            return acc;
        }, []);
    },

    _renderGroup(label, items) {
        if (!items.length) return '';
        return `
            <div class="ig-group">
                <div class="ig-group-label">${label}</div>
                <div class="ig-grid">
                    ${items.map(it => `
                        <div class="ig-item" data-ig-page="${it.page}">
                            <div class="ig-icon-badge" aria-hidden="true">${it.svgHtml}</div>
                            <div class="ig-text">
                                <div class="ig-name">${it.name}</div>
                                <div class="ig-desc">${it.desc}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    open(opts = {}) {
        if (!opts.force && !this.shouldShow(opts)) return false;
        const visibleItems = this._getVisibleItems();
        if (!visibleItems.length) return false;

        this.close({ silent: true });

        const dailyItems = visibleItems.filter(it => it.group === 'daily');
        const manageItems = visibleItems.filter(it => it.group === 'manage');

        const overlay = document.createElement('div');
        overlay.id = 'icon-guide-overlay';
        overlay.className = 'icon-guide-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'ig-modal-title');
        overlay.innerHTML = `
            <div class="ig-dialog">
                <div class="ig-header">
                    <div class="ig-header-main">
                        <span class="ig-badge">MỚI · 21/11 – 28/11</span>
                        <h3 class="ig-title" id="ig-modal-title">Bộ biểu tượng điều hướng mới</h3>
                        <p class="ig-subtitle">Trên điện thoại, thanh đáy hiển thị gọn bằng biểu tượng — nhấn giữ biểu tượng để xem tên mục.</p>
                    </div>
                    <button type="button" class="ig-close-btn" id="ig-close-x" aria-label="Đóng thông báo" onclick="IconGuideNotice.close()">&times;</button>
                </div>
                <div class="ig-body">
                    ${this._renderGroup('Tác nghiệp hằng ngày', dailyItems)}
                    ${this._renderGroup('Quản trị & Học thuật', manageItems)}
                </div>
                <div class="ig-footer">
                    <button type="button" class="ig-btn ig-btn-secondary" id="ig-btn-close" onclick="IconGuideNotice.close()">Đóng</button>
                    <button type="button" class="ig-btn ig-btn-primary" id="ig-btn-dismiss" onclick="IconGuideNotice.dismissPermanently()">Đã hiểu, không hiện lại</button>
                </div>
            </div>
        `;

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });

        this._escHandler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.close();
            }
        };
        document.addEventListener('keydown', this._escHandler);

        document.body.appendChild(overlay);
        return true;
    },

    close(opts = {}) {
        if (!opts.silent) {
            try {
                sessionStorage.setItem(this.SESSION_KEY_PREFIX + this._getUsername(), '1');
            } catch (_) { /* noop */ }
        }
        const existing = document.getElementById('icon-guide-overlay');
        if (existing) existing.remove();
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
    },

    dismissPermanently() {
        const user = this._getUsername();
        try {
            localStorage.setItem(this.STORAGE_KEY_PREFIX + user, '1');
            sessionStorage.setItem(this.SESSION_KEY_PREFIX + user, '1');
        } catch (_) { /* noop */ }
        this.close({ silent: true });
    }
};

// ===== WEEKLY SURGERY SCHEDULE TUTORIAL (FEAT-252 · 1-WEEK AUTO-SHOW · ZERO-LOCAL-PHI UI FLAG ONLY) =====
const SurgeryTutorial = {
    CAMPAIGN_ID: 'v261128',
    START_AT: '2026-11-28T00:00:00+07:00',
    EXPIRES_AT: '2026-12-05T23:59:59+07:00',
    STORAGE_KEY_GLOBAL: 'ptdtt_surgery_tutorial_v261128_dismissed',
    STORAGE_KEY_PREFIX: 'ptdtt_surgery_tutorial_v261128_dismissed:',
    SESSION_KEY_PREFIX: 'ptdtt_surgery_tutorial_v261128_session:',
    currentStep: 0,
    _isOpen: false,
    _autoTimer: null,
    _keyHandler: null,
    _repositionHandler: null,
    _stepsCache: [],

    _esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    _getUsername() {
        try {
            if (typeof Auth !== 'undefined' && typeof Auth.getSession === 'function') {
                return Auth.getSession()?.username || 'guest';
            }
        } catch (_) { /* noop */ }
        return 'guest';
    },

    isWithinWindow(nowDate) {
        const ts = (nowDate instanceof Date ? nowDate : new Date()).getTime();
        const start = Date.parse(this.START_AT);
        const end = Date.parse(this.EXPIRES_AT);
        return Number.isFinite(ts) && ts >= start && ts <= end;
    },

    isDismissed(username) {
        const user = username || this._getUsername();
        try {
            if (localStorage.getItem(this.STORAGE_KEY_GLOBAL) === '1') return true;
            if (localStorage.getItem(this.STORAGE_KEY_PREFIX + user) === '1') return true;
            if (sessionStorage.getItem(this.SESSION_KEY_PREFIX + user) === '1') return true;
        } catch (_) {
            return false;
        }
        return false;
    },

    clearSessionDismiss(username) {
        const user = username || this._getUsername();
        try {
            sessionStorage.removeItem(this.SESSION_KEY_PREFIX + user);
        } catch (_) { /* noop */ }
    },

    _canEditCurrentWeek() {
        try {
            const weekKey = (typeof SurgeryPage !== 'undefined' && typeof SurgeryPage.getWeekKey === 'function')
                ? SurgeryPage.getWeekKey()
                : null;
            if (typeof canEditSurgery === 'function') {
                return Boolean(canEditSurgery(weekKey));
            }
        } catch (_) { /* noop */ }
        return false;
    },

    shouldAutoShow(opts = {}) {
        if (typeof App !== 'undefined' && App.currentPage !== 'surgery') return false;
        if (!document.getElementById('surgery-page')) return false;
        if (!this.isWithinWindow(opts.now)) return false;
        if (!opts.ignorePerm && !this._canEditCurrentWeek()) return false;
        if (this.isDismissed(opts.username)) return false;
        try {
            if (typeof Auth !== 'undefined' && Auth.getSession()?.mustChangePassword) return false;
            if (typeof Onboarding !== 'undefined' && typeof Onboarding.shouldShow === 'function' && Onboarding.shouldShow()) {
                return false;
            }
            if (document.getElementById('onboarding-overlay')) return false;
            if (document.getElementById('icon-guide-overlay')) return false;
            if (document.getElementById('robot-tutorial-overlay')) return false;
            const modalOverlay = document.getElementById('modal-overlay');
            if (modalOverlay && modalOverlay.classList.contains('active')) return false;
        } catch (_) { /* noop */ }
        return true;
    },

    maybeAutoStart() {
        if (this._autoTimer) {
            clearTimeout(this._autoTimer);
            this._autoTimer = null;
        }
        if (this._isOpen || !this.shouldAutoShow()) return false;
        this._autoTimer = setTimeout(() => {
            this._autoTimer = null;
            if (!this._isOpen && this.shouldAutoShow()) {
                this.start({ auto: true });
            }
        }, 180);
        return true;
    },

    getSteps() {
        return [
            {
                icon: '📝',
                title: 'Form Nhập Ca Mổ Mới (Mobile & Laptop)',
                desc: 'Giao diện nhập liệu mới tối ưu riêng: Mobile gồm 4 thẻ chạm 1 lần + thanh Lưu dính đáy; Laptop cửa sổ rộng 2 cột và lưu nhanh bằng Ctrl/Cmd + Enter. Bấm "+ Thêm ca mổ" (hoặc "＋ Thêm ca") để bắt đầu.',
                targets: ['#surgery-page .surg-header-actions .btn-primary', '#surgery-page .surg-mobile-primary-btn', '#surgery-page .page-header']
            },
            {
                icon: '📅',
                title: 'Bệnh Nhân, Phân Loại & Ngày Mổ 1 Chạm',
                desc: 'Nhập Họ tên (tự kiểm tra trùng hồ sơ 2 tầng theo Số NV và Họ tên + Năm sinh), chạm chip chọn Loại phẫu thuật, Đường mổ, Ngày mổ trong tuần và Thời lượng nhanh (30–180 phút).',
                targets: ['#surgery-page .surgery-mobile-day-picker', '#surgery-page .surgery-summary-panel', '#surgery-page .surgery-controls']
            },
            {
                icon: '🩺',
                title: 'Chẩn Đoán & Gợi Ý 5 DVKT BVBD Thông Minh',
                desc: 'Gõ Chẩn đoán không dấu để chọn nhanh (đã bỏ hiển thị số ca). Sau khi nhập Chẩn đoán, chạm vào ô Phương pháp phẫu thuật còn trống — máy tự gợi ý 5 DVKT chuẩn BVBD phù hợp nhất kèm xếp loại PT-ĐB / PT-I / PT-II / PT-III.',
                targets: ['#surgery-page .page-header', '#surgery-page']
            },
            {
                icon: '👨‍⚕️',
                title: 'Chip Chọn Bác Sĩ & Phân Cột Phẫu Thuật',
                desc: 'Thay dropdown dài bằng Chip chọn BS (tab Khoa / Ngoài khoa, tìm không dấu tức thì). Ô BS mổ chính chủ động để trống tránh chọn nhầm người đăng nhập; hệ thống tự hiện nhắc phân cột phẫu thuật.',
                targets: ['#surg-filter-doc', '#surgery-page .surg-mobile-quick-filters', '#surgery-page .surgery-controls']
            },
            {
                icon: '✅',
                title: 'Đối Chiếu DVKT Khi Lưu & Nhập Liên Tiếp',
                desc: 'Nếu tự nhập phương pháp khác danh mục chuẩn BVBD, khi bấm Lưu hệ thống sẽ gợi ý 5 DVKT tương đương để chọn hoặc cho phép "Vẫn lưu phương án tự nhập" (không chặn cứng). Dùng "Lưu & thêm ca tiếp" để nhập nhiều ca cùng ngày.',
                targets: ['#surgery-page .surg-header-actions .btn-primary', '#surgery-page .surg-mobile-primary-btn', '#surgery-page .page-header']
            },
            {
                icon: '❓',
                title: 'Xem Lại Hướng Dẫn Bất Kỳ Lúc Nào',
                desc: 'Hướng dẫn này tự động hiển thị trong 1 tuần (28/11 – 05/12/2026). Bất kỳ lúc nào cần xem lại, bấm "❓ Hướng dẫn" trên máy tính hoặc chạm "⋮" → "Hướng dẫn nhập lịch mổ" trên điện thoại.',
                targets: ['#surg-tutorial-btn', '#surg-mobile-more-btn', '#surgery-page .page-header']
            }
        ];
    },

    _findVisibleTarget(selectors) {
        if (!Array.isArray(selectors)) return null;
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            const cs = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
            if (rect.width > 0 && rect.height > 0 && (!cs || (cs.display !== 'none' && cs.visibility !== 'hidden'))) {
                return el;
            }
        }
        return null;
    },

    start(opts = {}) {
        if (this._autoTimer) {
            clearTimeout(this._autoTimer);
            this._autoTimer = null;
        }
        if (!opts.force && !this.shouldAutoShow(opts)) return false;
        if (!document.getElementById('surgery-page')) return false;

        this._stepsCache = this.getSteps();
        this.currentStep = 0;
        this._isOpen = true;
        this._bindGlobalListeners();
        this._renderStep();
        return true;
    },

    goTo(idx) {
        if (!this._isOpen) return;
        const max = Math.max(0, this._stepsCache.length - 1);
        this.currentStep = Math.min(max, Math.max(0, Number(idx) || 0));
        this._renderStep();
    },

    next() {
        if (!this._isOpen) return;
        if (this.currentStep < this._stepsCache.length - 1) {
            this.currentStep++;
            this._renderStep();
        } else {
            this.dismissPermanently();
            if (typeof Toast !== 'undefined' && Toast.success) {
                Toast.success('🎉 Đã hoàn thành hướng dẫn nhập Lịch mổ tuần! Bấm "❓ Hướng dẫn" để xem lại bất kỳ lúc nào.');
            }
        }
    },

    prev() {
        if (!this._isOpen) return;
        if (this.currentStep > 0) {
            this.currentStep--;
            this._renderStep();
        }
    },

    close(opts = {}) {
        if (this._autoTimer) {
            clearTimeout(this._autoTimer);
            this._autoTimer = null;
        }
        if (!opts.silent) {
            try {
                sessionStorage.setItem(this.SESSION_KEY_PREFIX + this._getUsername(), '1');
            } catch (_) { /* noop */ }
        }
        this._isOpen = false;
        this._unbindGlobalListeners();
        const existing = document.getElementById('surgery-tutorial-overlay');
        if (existing) existing.remove();
    },

    dismissPermanently() {
        const user = this._getUsername();
        try {
            localStorage.setItem(this.STORAGE_KEY_PREFIX + user, '1');
            sessionStorage.setItem(this.SESSION_KEY_PREFIX + user, '1');
        } catch (_) { /* noop */ }
        this.close({ silent: true });
    },

    _bindGlobalListeners() {
        this._unbindGlobalListeners();
        this._keyHandler = (e) => {
            if (!this._isOpen) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                this.close();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.next();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.prev();
            }
        };
        this._repositionHandler = () => {
            if (this._isOpen) this._positionElements();
        };
        document.addEventListener('keydown', this._keyHandler);
        window.addEventListener('resize', this._repositionHandler);
        window.addEventListener('scroll', this._repositionHandler, { passive: true });
    },

    _unbindGlobalListeners() {
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        if (this._repositionHandler) {
            window.removeEventListener('resize', this._repositionHandler);
            window.removeEventListener('scroll', this._repositionHandler);
            this._repositionHandler = null;
        }
    },

    _renderStep() {
        const step = this._stepsCache[this.currentStep];
        if (!step) {
            this.close({ silent: true });
            return;
        }
        const total = this._stepsCache.length;
        const isLast = this.currentStep === total - 1;

        let overlay = document.getElementById('surgery-tutorial-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'surgery-tutorial-overlay';
            overlay.className = 'rbt-tut-overlay surg-tut-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-labelledby', 'surg-tut-title');
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay || e.target.classList.contains('rbt-tut-backdrop')) {
                    this.close();
                }
            });
            document.body.appendChild(overlay);
        }

        const targetEl = this._findVisibleTarget(step.targets);
        if (targetEl && typeof targetEl.scrollIntoView === 'function') {
            try { targetEl.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' }); } catch (_) {}
        }

        const dotsHtml = this._stepsCache.map((_, i) => `
            <button type="button"
                class="rbt-tut-dot ${i < this.currentStep ? 'is-done' : ''} ${i === this.currentStep ? 'is-active' : ''}"
                data-surg-tut-dot="${i}"
                aria-label="Chuyển tới bước ${i + 1}"
                onclick="SurgeryTutorial.goTo(${i})"></button>
        `).join('');

        overlay.innerHTML = `
            <div class="rbt-tut-backdrop" aria-hidden="true"></div>
            <div class="rbt-tut-spotlight" id="surg-tut-spotlight" aria-hidden="true"></div>
            <div class="rbt-tut-card" id="surg-tut-card">
                <div class="rbt-tut-card-top">
                    <span class="rbt-tut-badge">HƯỚNG DẪN LỊCH MỔ · 28/11 – 05/12 · Bước ${this.currentStep + 1}/${total}</span>
                    <button type="button" class="rbt-tut-close-x" id="surg-tut-close-x" aria-label="Đóng hướng dẫn" onclick="SurgeryTutorial.close()">&times;</button>
                </div>
                <div class="rbt-tut-heading">
                    <span class="rbt-tut-icon" aria-hidden="true">${this._esc(step.icon)}</span>
                    <h3 class="rbt-tut-title" id="surg-tut-title">${this._esc(step.title)}</h3>
                </div>
                <p class="rbt-tut-desc">${this._esc(step.desc)}</p>
                <div class="rbt-tut-dots" role="tablist" aria-label="Tiến độ các bước hướng dẫn">${dotsHtml}</div>
                <div class="rbt-tut-footer">
                    <div class="rbt-tut-dismiss-row">
                        <button type="button" class="rbt-tut-btn rbt-tut-btn--ghost" id="surg-tut-close-btn" onclick="SurgeryTutorial.close()">Đóng</button>
                        <button type="button" class="rbt-tut-btn rbt-tut-btn--muted" id="surg-tut-dismiss-btn" onclick="SurgeryTutorial.dismissPermanently()">Đã hiểu, không tự mở lại</button>
                    </div>
                    <div class="rbt-tut-nav-row">
                        ${this.currentStep > 0
                            ? `<button type="button" class="rbt-tut-btn rbt-tut-btn--secondary" id="surg-tut-prev-btn" onclick="SurgeryTutorial.prev()">← Trước</button>`
                            : '<span></span>'}
                        <button type="button" class="rbt-tut-btn rbt-tut-btn--primary" id="surg-tut-next-btn" onclick="SurgeryTutorial.next()">
                            ${isLast ? '✓ Hoàn tất' : 'Tiếp theo →'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        this._positionElements(targetEl);
    },

    _positionElements(explicitTarget) {
        const step = this._stepsCache[this.currentStep];
        const spotlight = document.getElementById('surg-tut-spotlight');
        const card = document.getElementById('surg-tut-card');
        if (!step || !card) return;

        const targetEl = explicitTarget || this._findVisibleTarget(step.targets);
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rect = targetEl ? targetEl.getBoundingClientRect() : null;

        if (spotlight) {
            if (rect && rect.width > 0 && rect.height > 0) {
                const top = Math.max(4, rect.top - 4);
                const left = Math.max(4, rect.left - 4);
                const width = Math.min(vw - left - 4, rect.width + 8);
                const height = Math.min(vh - top - 4, rect.height + 8);
                spotlight.style.display = 'block';
                spotlight.style.top = `${top}px`;
                spotlight.style.left = `${left}px`;
                spotlight.style.width = `${Math.max(24, width)}px`;
                spotlight.style.height = `${Math.max(24, height)}px`;
            } else {
                spotlight.style.display = 'none';
            }
        }

        if (vw <= 768) {
            card.style.left = '12px';
            card.style.right = '12px';
            card.style.width = 'auto';
            card.style.maxWidth = `${Math.max(260, vw - 24)}px`;
            card.style.transform = 'none';
            if (rect && rect.bottom > vh - 260 && rect.top > 250) {
                card.style.top = '12px';
                card.style.bottom = 'auto';
            } else {
                card.style.top = 'auto';
                card.style.bottom = 'calc(12px + env(safe-area-inset-bottom, 0px))';
            }
            return;
        }

        card.style.right = 'auto';
        card.style.bottom = 'auto';
        card.style.width = '420px';
        card.style.maxWidth = `${Math.max(320, vw - 32)}px`;
        card.style.transform = 'none';

        if (!rect) {
            card.style.top = '50%';
            card.style.left = '50%';
            card.style.transform = 'translate(-50%, -50%)';
            return;
        }

        const cRect = card.getBoundingClientRect();
        const cardH = cRect.height || 260;
        const cardW = cRect.width || 420;
        const gap = 14;

        let top = rect.bottom + gap;
        if (top + cardH > vh - 16) {
            const aboveTop = rect.top - cardH - gap;
            top = aboveTop >= 16 ? aboveTop : Math.max(16, vh - cardH - 16);
        }
        let left = Math.min(Math.max(16, rect.left), Math.max(16, vw - cardW - 16));
        card.style.top = `${Math.round(top)}px`;
        card.style.left = `${Math.round(left)}px`;
    }
};

// ===== PERMANENT ROBOT SCHEDULE TUTORIAL (FEAT-243 v2 · ZERO-LOCAL-PHI UI FLAG ONLY) =====
const RobotTutorial = {
    STORAGE_KEY_GLOBAL: 'ptdtt_robot_tutorial_v2_dismissed',
    STORAGE_KEY_PREFIX: 'ptdtt_robot_tutorial_v2_dismissed:',
    SESSION_KEY_PREFIX: 'ptdtt_robot_tutorial_v2_session:',
    currentStep: 0,
    _isOpen: false,
    _autoTimer: null,
    _keyHandler: null,
    _repositionHandler: null,
    _stepsCache: [],

    _esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    _getUsername() {
        try {
            if (typeof Auth !== 'undefined' && typeof Auth.getSession === 'function') {
                return Auth.getSession()?.username || 'guest';
            }
        } catch (_) { /* noop */ }
        return 'guest';
    },

    isDismissed(username) {
        const user = username || this._getUsername();
        try {
            if (localStorage.getItem(this.STORAGE_KEY_GLOBAL) === '1') return true;
            if (localStorage.getItem(this.STORAGE_KEY_PREFIX + user) === '1') return true;
            if (sessionStorage.getItem(this.SESSION_KEY_PREFIX + user) === '1') return true;
        } catch (_) {
            return false;
        }
        return false;
    },

    clearSessionDismiss(username) {
        const user = username || this._getUsername();
        try {
            sessionStorage.removeItem(this.SESSION_KEY_PREFIX + user);
        } catch (_) { /* noop */ }
    },

    shouldAutoShow(opts = {}) {
        if (typeof App !== 'undefined' && App.currentPage !== 'robot-schedule') return false;
        if (!document.getElementById('robot-schedule-page')) return false;
        if (typeof RobotSchedulePage === 'undefined' || !RobotSchedulePage._bootstrap) return false;
        if (this.isDismissed(opts.username)) return false;
        try {
            if (typeof Auth !== 'undefined' && Auth.getSession()?.mustChangePassword) return false;
            if (typeof Onboarding !== 'undefined' && typeof Onboarding.shouldShow === 'function' && Onboarding.shouldShow()) {
                return false;
            }
            if (document.getElementById('onboarding-overlay')) return false;
            if (document.getElementById('icon-guide-overlay')) return false;
            const modalOverlay = document.getElementById('modal-overlay');
            if (modalOverlay && modalOverlay.classList.contains('active')) return false;
        } catch (_) { /* noop */ }
        return true;
    },

    maybeAutoStart() {
        if (this._autoTimer) {
            clearTimeout(this._autoTimer);
            this._autoTimer = null;
        }
        if (this._isOpen || !this.shouldAutoShow()) return false;
        this._autoTimer = setTimeout(() => {
            this._autoTimer = null;
            if (!this._isOpen && this.shouldAutoShow()) {
                this.start({ auto: true });
            }
        }, 180);
        return true;
    },

    getSteps(perms) {
        const p = perms || (typeof RobotSchedulePage !== 'undefined' && RobotSchedulePage._bootstrap?.permissions) || {};
        const roleSummary = p.isBcn
            ? 'Ban Chủ nhiệm (Toàn quyền quy trình 5 bước, cấu hình Điều phối, lưu trữ ẩn & in A5)'
            : (p.isChiefConsultDecider
                ? 'TS. BSCKII. Nguyễn Phú Hữu (Chốt KQ tư vấn: Mổ Robot / Chuyển Nội soi / Cân nhắc / Không mổ)'
                : (p.isCoordinator
                    ? 'Điều phối viên Robot (BS Nguyện / BS Hoan: Xếp lịch TV, theo dõi lịch tuần, điều phối Robot/Nội soi & in A5)'
                    : (p.canCreateConsult
                        ? 'Bác sĩ khu vực (Gửi ca tư vấn đủ XN + Phòng, theo dõi KQ sau TV, cho Xuất viện chờ giữ slot & in A5)'
                        : 'Chỉ xem & In P.CTXH (Theo dõi lịch mổ tuần và in giấy giới thiệu A5; SĐT bệnh nhân tự động ẩn)')));

        const step4Desc = p.canCreateConsult
            ? 'Bấm "+ Gửi ca tư vấn" (hoặc "+" trên điện thoại), chọn Nguồn BN (Cấp cứu / Phòng khám — nếu Phòng khám chọn chip BS cho nhập từ BS chính & BS ngoài khoa hoặc nhập tay), chạm chip Phòng bệnh, SĐT không bắt buộc, mở mục bổ sung nếu cần và tick đủ XN. Có thể bấm 🗑️ Xóa ca chờ tư vấn vào Thùng rác.'
            : 'Chỉ Bác sĩ trong khoa mới gửi hồ sơ tư vấn mới; ĐD Trưởng và nhân sự khác theo dõi tiến độ & in giấy giới thiệu P.CTXH theo thời gian thực.';

        return [
            {
                icon: '🤖',
                title: 'Quy Trình 5 Bước & Phân Quyền Hiện Tại',
                desc: `Vai trò của bạn: ${roleSummary}. Toàn bộ dữ liệu liên thông 2 chiều với Lịch mổ tuần, tuân thủ Zero-Local-PHI và tối ưu bảng nhập liệu riêng cho Mobile (1 chạm) & Laptop (đa cột, Ctrl/Cmd+Enter).`,
                targets: ['#robot-schedule-page .rbt-header']
            },
            {
                icon: '🔔',
                title: 'Thanh Việc Của Tôi & 4 Thẻ Chỉ Số',
                desc: 'Chạm các nút trên thanh Việc của tôi hoặc 4 thẻ chỉ số (Chờ & Xếp TV, Đã xếp lịch mổ, XV chờ giữ slot, Đã phẫu thuật) để lọc nhanh đúng hàng đợi.',
                targets: ['#rbt-my-work-bar', '#robot-schedule-page .rbt-kpi-grid']
            },
            {
                icon: '🗂️',
                title: '5 Phân Mục Theo Đúng 5 Bước Lâm Sàng',
                desc: `🩺 Lịch tư vấn & Chờ xếp (B1–B3) · 📅 Lịch mổ đã xếp Robot & Nội soi · 🏥 Theo dõi phòng & XV chờ (B4) · ⏸️ Không mổ / Hoãn / Rác · 📊 Đã mổ & Thống kê${p.canConfigureCoordinators ? ' · ⚙️ Cấu hình' : ''}. Hỗ trợ tìm nhanh theo BN, phòng, nguồn Cấp cứu/Phòng khám & BS cho nhập.`,
                targets: ['#robot-schedule-page .rbt-subtabs-wrap']
            },
            {
                icon: '📥',
                title: 'Bước 1 · BS Khu Vực Gửi Ca Tư Vấn Đủ XN',
                desc: step4Desc,
                targets: ['#rbt-mobile-fab', '#robot-schedule-page .rbt-header__actions', '#robot-schedule-page .rbt-header']
            },
            {
                icon: '🩺',
                title: 'Bước 2–3 · Xếp Lịch TV & TS. Hữu Chốt Kết Quả',
                desc: 'Bước 2: BS Nguyện / BS Hoan xem số ca đã xếp theo từng buổi Sáng/Chiều, chọn chip địa điểm nhanh & bấm "Copy lịch TV Zalo". Bước 3: Chốt 1 chạm Mổ Robot (Ca 1–3) | Chuyển Nội soi (Loại PT & PTV chính) | Cân nhắc | Không đồng ý mổ (chip lý do).',
                targets: ['#robot-schedule-page .rbt-subtab[data-rbt-subtab="consult"]', '#robot-schedule-page .rbt-consult-split', '#robot-schedule-page .rbt-panel']
            },
            {
                icon: '🏠',
                title: 'Bước 4 · BS Phòng Theo Dõi & Xuất Viện Chờ Giữ Slot',
                desc: 'Sau tư vấn, BS phòng xem KQ kèm nguồn BN & BS cho nhập tại tab "Theo dõi phòng & XV chờ". Nếu lịch mổ còn xa, chọn "Cho XV chờ & Hẹn nhập lại" dùng chip ngày & dặn dò nhanh — slot trên Lịch mổ tuần VẪN GIỮ NGUYÊN.',
                targets: ['#robot-schedule-page .rbt-subtab[data-rbt-subtab="ward"]', '#robot-schedule-page .rbt-subtabs-wrap']
            },
            {
                icon: '🖨️',
                title: 'Bước 5 · In Giấy Giới Thiệu P.CTXH (A5) & Phím Tắt',
                desc: 'Bấm "🖨️ In P.CTXH" (in 1 ca hoặc cả tuần/ngày, mẫu Màu & Laser Trắng Đen) hoặc "📋 Copy lịch TV Zalo". Trên Laptop hỗ trợ Ctrl/Cmd+Enter để lưu nhanh form; bấm "❓ Hướng dẫn" bất kỳ lúc nào để xem lại.',
                targets: ['#robot-schedule-page [data-rbt-action="open_print_modal"]', '#robot-schedule-page [data-rbt-action="open_mobile_menu"]', '#robot-schedule-page .rbt-header']
            }
        ];
    },

    _findVisibleTarget(selectors) {
        if (!Array.isArray(selectors)) return null;
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            const cs = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
            if (rect.width > 0 && rect.height > 0 && (!cs || (cs.display !== 'none' && cs.visibility !== 'hidden'))) {
                return el;
            }
        }
        return null;
    },

    start(opts = {}) {
        if (this._autoTimer) {
            clearTimeout(this._autoTimer);
            this._autoTimer = null;
        }
        if (!opts.force && !this.shouldAutoShow(opts)) return false;
        if (!document.getElementById('robot-schedule-page')) return false;

        this._stepsCache = this.getSteps(opts.perms);
        this.currentStep = 0;
        this._isOpen = true;
        this._bindGlobalListeners();
        this._renderStep();
        return true;
    },

    goTo(idx) {
        if (!this._isOpen) return;
        const max = Math.max(0, this._stepsCache.length - 1);
        this.currentStep = Math.min(max, Math.max(0, Number(idx) || 0));
        this._renderStep();
    },

    next() {
        if (!this._isOpen) return;
        if (this.currentStep < this._stepsCache.length - 1) {
            this.currentStep++;
            this._renderStep();
        } else {
            this.dismissPermanently();
            if (typeof Toast !== 'undefined' && Toast.success) {
                Toast.success('🎉 Đã hoàn thành hướng dẫn Điều phối Robot! Bấm "❓ Hướng dẫn" để xem lại bất kỳ lúc nào.');
            }
        }
    },

    prev() {
        if (!this._isOpen) return;
        if (this.currentStep > 0) {
            this.currentStep--;
            this._renderStep();
        }
    },

    close(opts = {}) {
        if (this._autoTimer) {
            clearTimeout(this._autoTimer);
            this._autoTimer = null;
        }
        if (!opts.silent) {
            try {
                sessionStorage.setItem(this.SESSION_KEY_PREFIX + this._getUsername(), '1');
            } catch (_) { /* noop */ }
        }
        this._isOpen = false;
        this._unbindGlobalListeners();
        const existing = document.getElementById('robot-tutorial-overlay');
        if (existing) existing.remove();
    },

    dismissPermanently() {
        const user = this._getUsername();
        try {
            localStorage.setItem(this.STORAGE_KEY_PREFIX + user, '1');
            sessionStorage.setItem(this.SESSION_KEY_PREFIX + user, '1');
        } catch (_) { /* noop */ }
        this.close({ silent: true });
    },

    _bindGlobalListeners() {
        this._unbindGlobalListeners();
        this._keyHandler = (e) => {
            if (!this._isOpen) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                this.close();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                this.next();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                this.prev();
            }
        };
        this._repositionHandler = () => {
            if (this._isOpen) this._positionElements();
        };
        document.addEventListener('keydown', this._keyHandler);
        window.addEventListener('resize', this._repositionHandler);
        window.addEventListener('scroll', this._repositionHandler, { passive: true });
    },

    _unbindGlobalListeners() {
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        if (this._repositionHandler) {
            window.removeEventListener('resize', this._repositionHandler);
            window.removeEventListener('scroll', this._repositionHandler);
            this._repositionHandler = null;
        }
    },

    _renderStep() {
        const step = this._stepsCache[this.currentStep];
        if (!step) {
            this.close({ silent: true });
            return;
        }
        const total = this._stepsCache.length;
        const isLast = this.currentStep === total - 1;

        let overlay = document.getElementById('robot-tutorial-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'robot-tutorial-overlay';
            overlay.className = 'rbt-tut-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-labelledby', 'rbt-tut-title');
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay || e.target.classList.contains('rbt-tut-backdrop')) {
                    this.close();
                }
            });
            document.body.appendChild(overlay);
        }

        const targetEl = this._findVisibleTarget(step.targets);
        if (targetEl && typeof targetEl.scrollIntoView === 'function') {
            try { targetEl.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' }); } catch (_) {}
        }

        const dotsHtml = this._stepsCache.map((_, i) => `
            <button type="button"
                class="rbt-tut-dot ${i < this.currentStep ? 'is-done' : ''} ${i === this.currentStep ? 'is-active' : ''}"
                data-rbt-tut-dot="${i}"
                aria-label="Chuyển tới bước ${i + 1}"
                onclick="RobotTutorial.goTo(${i})"></button>
        `).join('');

        overlay.innerHTML = `
            <div class="rbt-tut-backdrop" aria-hidden="true"></div>
            <div class="rbt-tut-spotlight" id="rbt-tut-spotlight" aria-hidden="true"></div>
            <div class="rbt-tut-card" id="rbt-tut-card">
                <div class="rbt-tut-card-top">
                    <span class="rbt-tut-badge">HƯỚNG DẪN MỔ ROBOT · Bước ${this.currentStep + 1}/${total}</span>
                    <button type="button" class="rbt-tut-close-x" id="rbt-tut-close-x" aria-label="Đóng hướng dẫn" onclick="RobotTutorial.close()">&times;</button>
                </div>
                <div class="rbt-tut-heading">
                    <span class="rbt-tut-icon" aria-hidden="true">${this._esc(step.icon)}</span>
                    <h3 class="rbt-tut-title" id="rbt-tut-title">${this._esc(step.title)}</h3>
                </div>
                <p class="rbt-tut-desc">${this._esc(step.desc)}</p>
                <div class="rbt-tut-dots" role="tablist" aria-label="Tiến độ các bước hướng dẫn">${dotsHtml}</div>
                <div class="rbt-tut-footer">
                    <div class="rbt-tut-dismiss-row">
                        <button type="button" class="rbt-tut-btn rbt-tut-btn--ghost" id="rbt-tut-close-btn" onclick="RobotTutorial.close()">Đóng</button>
                        <button type="button" class="rbt-tut-btn rbt-tut-btn--muted" id="rbt-tut-dismiss-btn" onclick="RobotTutorial.dismissPermanently()">Đã hiểu, không tự mở lại</button>
                    </div>
                    <div class="rbt-tut-nav-row">
                        ${this.currentStep > 0
                            ? `<button type="button" class="rbt-tut-btn rbt-tut-btn--secondary" id="rbt-tut-prev-btn" onclick="RobotTutorial.prev()">← Trước</button>`
                            : '<span></span>'}
                        <button type="button" class="rbt-tut-btn rbt-tut-btn--primary" id="rbt-tut-next-btn" onclick="RobotTutorial.next()">
                            ${isLast ? '✓ Hoàn tất' : 'Tiếp theo →'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        this._positionElements(targetEl);
    },

    _positionElements(explicitTarget) {
        const step = this._stepsCache[this.currentStep];
        const spotlight = document.getElementById('rbt-tut-spotlight');
        const card = document.getElementById('rbt-tut-card');
        if (!step || !card) return;

        const targetEl = explicitTarget || this._findVisibleTarget(step.targets);
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rect = targetEl ? targetEl.getBoundingClientRect() : null;

        if (spotlight) {
            if (rect && rect.width > 0 && rect.height > 0) {
                const top = Math.max(4, rect.top - 4);
                const left = Math.max(4, rect.left - 4);
                const width = Math.min(vw - left - 4, rect.width + 8);
                const height = Math.min(vh - top - 4, rect.height + 8);
                spotlight.style.display = 'block';
                spotlight.style.top = `${top}px`;
                spotlight.style.left = `${left}px`;
                spotlight.style.width = `${Math.max(24, width)}px`;
                spotlight.style.height = `${Math.max(24, height)}px`;
            } else {
                spotlight.style.display = 'none';
            }
        }

        if (vw <= 768) {
            card.style.left = '12px';
            card.style.right = '12px';
            card.style.width = 'auto';
            card.style.maxWidth = `${Math.max(260, vw - 24)}px`;
            card.style.transform = 'none';
            if (rect && rect.bottom > vh - 260 && rect.top > 250) {
                card.style.top = '12px';
                card.style.bottom = 'auto';
            } else {
                card.style.top = 'auto';
                card.style.bottom = 'calc(12px + env(safe-area-inset-bottom, 0px))';
            }
            return;
        }

        card.style.right = 'auto';
        card.style.bottom = 'auto';
        card.style.width = '420px';
        card.style.maxWidth = `${Math.max(320, vw - 32)}px`;
        card.style.transform = 'none';

        if (!rect) {
            card.style.top = '50%';
            card.style.left = '50%';
            card.style.transform = 'translate(-50%, -50%)';
            return;
        }

        const cRect = card.getBoundingClientRect();
        const cardH = cRect.height || 260;
        const cardW = cRect.width || 420;
        const gap = 14;

        let top = rect.bottom + gap;
        if (top + cardH > vh - 16) {
            const aboveTop = rect.top - cardH - gap;
            top = aboveTop >= 16 ? aboveTop : Math.max(16, vh - cardH - 16);
        }
        let left = Math.min(Math.max(16, rect.left), Math.max(16, vw - cardW - 16));
        card.style.top = `${Math.round(top)}px`;
        card.style.left = `${Math.round(left)}px`;
    }
};

if (typeof window !== 'undefined') {
    window.SurgeryTutorial = SurgeryTutorial;
    window.RobotTutorial = RobotTutorial;
}
