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
