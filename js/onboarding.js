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
        if (rect) {
            const gap = 16;
            if (step.position === 'right') {
                tooltip.style.top = Math.max(10, rect.top - 10) + 'px';
                tooltip.style.left = (rect.right + gap) + 'px';
            } else if (step.position === 'bottom') {
                tooltip.style.top = (rect.bottom + gap) + 'px';
                tooltip.style.left = Math.max(10, rect.left) + 'px';
            }
            // Check if overflows viewport
            requestAnimationFrame(() => {
                const tr = tooltip.getBoundingClientRect();
                if (tr.right > window.innerWidth - 10) {
                    tooltip.style.left = (window.innerWidth - tr.width - 10) + 'px';
                }
                if (tr.bottom > window.innerHeight - 10) {
                    tooltip.style.top = (window.innerHeight - tr.height - 10) + 'px';
                }
            });
        } else {
            tooltip.style.top = '50%';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translate(-50%, -50%)';
        }

        overlay.appendChild(tooltip);
        document.body.appendChild(overlay);
    },

    _cleanup() {
        const existing = document.getElementById('onboarding-overlay');
        if (existing) existing.remove();
    }
};
