// ===== UTILITY FUNCTIONS =====
const Utils = {
    getInitials(name) {
        return name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    formatDateShort(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    },

    daysFromNow(dateStr) {
        const d = new Date(dateStr);
        const now = new Date();
        now.setHours(0,0,0,0); d.setHours(0,0,0,0);
        return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    },

    priorityLabel(p) {
        return { high: 'Cao', medium: 'Trung bình', low: 'Thấp' }[p] || p;
    },

    priorityBadge(p) {
        return { high: 'badge-danger', medium: 'badge-warning', low: 'badge-success' }[p] || '';
    },

    statusLabel(s) {
        return {
            'active': 'Đang điều trị',
            'pre-op': 'Chờ mổ',
            'post-op': 'Sau mổ',
            'discharged': 'Xuất viện',
            'todo': 'Chờ xử lý',
            'doing': 'Đang thực hiện',
            'done': 'Hoàn thành'
        }[s] || s;
    },

    planTypeLabel(t) {
        return {
            meeting: 'Họp khoa',
            consultation: 'Hội chẩn',
            training: 'Đào tạo',
            conference: 'Hội nghị',
            other: 'Khác'
        }[t] || t;
    },

    planTypeBadge(t) {
        return {
            meeting: 'badge-primary',
            consultation: 'badge-accent',
            training: 'badge-success',
            conference: 'badge-warning',
            other: 'badge-info'
        }[t] || '';
    },

    getStaffName(id) {
        const s = Store.getById('staff', id);
        if (s) return s.name;
        const ext = (Store.getAll('externalDoctors') || []).find(d => d.id === id);
        return ext ? ext.name : 'N/A';
    },

    getStaffColor(id) {
        const s = Store.getById('staff', id);
        if (s) return s.color;
        const ext = (Store.getAll('externalDoctors') || []).find(d => d.id === id);
        return ext ? ext.color : '#64748b';
    },

    randomColor() {
        const colors = ['#06b6d4','#8b5cf6','#10b981','#f59e0b','#ec4899','#3b82f6','#14b8a6','#f97316','#a855f7'];
        return colors[Math.floor(Math.random() * colors.length)];
    },

    searchIcon() {
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`;
    },

    plusIcon() {
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    },

    editIcon() {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    },

    deleteIcon() {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
    },

    chevronLeft() {
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>`;
    },

    chevronRight() {
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
    },

    applyExportWatermark(canvas, options = {}) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        const shortSide = Math.min(w, h);
        const diagonal = Math.hypot(w, h);
        const mainText = options.mainText || 'KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG';
        const subText = options.subText || 'Bệnh viện Bình Dân';
        const mainOpacity = options.mainOpacity ?? 0.06;
        const subOpacity = options.subOpacity ?? 0.045;

        const mainSize = Math.max(52, Math.min(180, Math.round(shortSide * 0.072)));
        const subSize = Math.max(24, Math.min(84, Math.round(mainSize * 0.5)));
        const stripeStep = Math.max(Math.round(shortSide * 0.26), Math.round(mainSize * 2.3));
        const stripeLimit = Math.max(shortSide * 0.56, stripeStep);
        const xOffset = Math.round(diagonal * 0.07);

        ctx.save();
        if (typeof ctx.resetTransform === 'function') {
            ctx.resetTransform();
        } else {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        ctx.translate(w / 2, h / 2);
        ctx.rotate(-Math.atan2(h, w));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let stripeIndex = 0;
        for (let y = -stripeLimit; y <= stripeLimit; y += stripeStep) {
            const x = stripeIndex % 2 === 0 ? -xOffset : xOffset;

            ctx.fillStyle = `rgba(15, 23, 42, ${mainOpacity})`;
            ctx.font = `800 ${mainSize}px Inter, Arial, sans-serif`;
            ctx.fillText(mainText, x, y);

            ctx.fillStyle = `rgba(15, 23, 42, ${subOpacity})`;
            ctx.font = `600 ${subSize}px Inter, Arial, sans-serif`;
            ctx.fillText(subText, x, y + Math.round(mainSize * 0.72));

            stripeIndex += 1;
        }

        ctx.restore();
    }
};

// ===== MODAL =====
const Modal = {
    open(title, bodyHTML) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHTML;
        document.getElementById('modal-overlay').classList.add('active');
    },
    close() {
        document.getElementById('modal-overlay').classList.remove('active');
    }
};

// ===== TOAST NOTIFICATIONS =====
const Toast = {
    _container: null,
    _queue: [],

    _getContainer() {
        if (!this._container) {
            this._container = document.createElement('div');
            this._container.className = 'toast-container';
            this._container.id = 'toast-container';
            document.body.appendChild(this._container);
        }
        return this._container;
    },

    _icons: {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    },

    _titles: {
        success: 'Thành công',
        error: 'Lỗi',
        warning: 'Cảnh báo',
        info: 'Thông tin'
    },

    show(message, type = 'info', duration = 4000, title = null) {
        const container = this._getContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.style.position = 'relative';

        const displayTitle = title || this._titles[type];

        toast.innerHTML = `
            <div class="toast-icon">${this._icons[type]}</div>
            <div class="toast-body">
                <div class="toast-title">${displayTitle}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.closest('.toast').remove()">×</button>
            <div class="toast-progress">
                <div class="toast-progress-bar" style="animation-duration:${duration}ms"></div>
            </div>
        `;

        container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto remove
        const timer = setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 400);
        }, duration);

        // Clear timer if manually closed
        toast.querySelector('.toast-close').addEventListener('click', () => {
            clearTimeout(timer);
        });

        return toast;
    },

    success(message, title) { return this.show(message, 'success', 3500, title); },
    error(message, title) { return this.show(message, 'error', 5000, title); },
    warning(message, title) { return this.show(message, 'warning', 4500, title); },
    info(message, title) { return this.show(message, 'info', 4000, title); }
};

// ===== CONFIRM DIALOG =====
const Confirm = {
    show({ title = 'Xác nhận', message = '', icon = '⚠', type = 'danger', confirmText = 'Xác nhận', cancelText = 'Hủy' } = {}) {
        return new Promise((resolve) => {
            // Remove existing overlay if any
            const existing = document.getElementById('confirm-overlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            overlay.id = 'confirm-overlay';

            const iconClass = type === 'danger' ? 'confirm-icon--danger' :
                              type === 'warning' ? 'confirm-icon--warning' : 'confirm-icon--info';
            const btnClass = type === 'danger' ? 'confirm-btn-danger' : 'confirm-btn-primary';

            overlay.innerHTML = `
                <div class="confirm-dialog">
                    <div class="confirm-icon ${iconClass}">${icon}</div>
                    <div class="confirm-title">${title}</div>
                    <div class="confirm-message">${message}</div>
                    <div class="confirm-actions">
                        <button class="btn confirm-btn-cancel" id="confirm-cancel">${cancelText}</button>
                        <button class="btn ${btnClass}" id="confirm-ok">${confirmText}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Trigger animation
            requestAnimationFrame(() => overlay.classList.add('show'));

            const cleanup = (result) => {
                overlay.classList.remove('show');
                setTimeout(() => overlay.remove(), 250);
                resolve(result);
            };

            overlay.querySelector('#confirm-cancel').addEventListener('click', () => cleanup(false));
            overlay.querySelector('#confirm-ok').addEventListener('click', () => cleanup(true));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) cleanup(false);
            });

            // Keyboard support
            const keyHandler = (e) => {
                if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', keyHandler); }
                if (e.key === 'Enter') { cleanup(true); document.removeEventListener('keydown', keyHandler); }
            };
            document.addEventListener('keydown', keyHandler);
        });
    },

    // Shorthand for delete confirmations
    async delete(itemName) {
        return this.show({
            title: 'Xác nhận xóa',
            message: `Bạn có chắc chắn muốn xóa <strong>${itemName}</strong>?<br>Hành động này không thể hoàn tác.`,
            icon: '🗑️',
            type: 'danger',
            confirmText: 'Xóa',
            cancelText: 'Giữ lại'
        });
    }
};
