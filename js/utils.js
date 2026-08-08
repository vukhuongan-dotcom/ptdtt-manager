// ===== UTILITY FUNCTIONS =====
const Utils = {
    // ─── Lazy-load heavy libraries (script-loader, giữ global behavior) ───
    // CDN URLs tập trung — cập nhật version tại đây khi cần
    _LIBS: {
        html2canvas: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
        chartjs:     'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
        xlsx:        '/js/xlsx.full.min.js',
    },
    _loadingPromises: {},

    /**
     * Load một script một lần duy nhất. Trả về Promise resolve khi script sẵn sàng.
     * @param {'html2canvas'|'chartjs'|'xlsx'} name - Tên thư viện (key trong _LIBS)
     */
    loadScript(name) {
        // Kiểm tra global đã tồn tại chưa
        const globals = { html2canvas: 'html2canvas', chartjs: 'Chart', xlsx: 'XLSX' };
        if (window[globals[name]]) return Promise.resolve();
        // Dùng cache để tránh load 2 lần song song
        if (this._loadingPromises[name]) return this._loadingPromises[name];
        const src = this._LIBS[name];
        if (!src) return Promise.reject(new Error(`Unknown lib: ${name}`));
        this._loadingPromises[name] = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => resolve();
            s.onerror = () => {
                delete this._loadingPromises[name];
                reject(new Error(`Không tải được thư viện: ${name}`));
            };
            document.head.appendChild(s);
        });
        return this._loadingPromises[name];
    },

    getInitials(name) {
        return name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();
    },

    formatDate(dateStr) {
        if (!dateStr) return '—';
        const parts = String(dateStr).split('T')[0].split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
    },

    formatDateShort(dateStr) {
        if (!dateStr) return '—';
        const parts = String(dateStr).split('T')[0].split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            return `${parts[2]}.${parts[1]}`;
        }
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}.${month}`;
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

    /**
     * Normalize a person's name to Title Case.
     * Handles Vietnamese and ALL-CAPS input correctly.
     * Examples:
     *   "NGUYỄN TẤN MINH" → "Nguyễn Tấn Minh"
     *   "trần thị lan"     → "Trần Thị Lan"
     *   "lê VĂN an"        → "Lê Văn An"
     */
    toProperCase(str) {
        if (!str || typeof str !== 'string') return str;
        return str.trim()
            .toLowerCase()
            .replace(/(^|[\s\-])(\S)/g, (_, sep, ch) => sep + ch.toUpperCase());
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
        const color = options.color || '15, 23, 42';
        const mainOpacity = options.mainOpacity ?? 0.045;
        const subOpacity = options.subOpacity ?? 0.03;
        const strokeOpacity = options.strokeOpacity ?? 0;

        const mainSize = Math.max(64, Math.min(210, Math.round(shortSide * 0.076)));
        const subSize = Math.max(24, Math.min(78, Math.round(mainSize * 0.46)));
        const stripeStep = Math.max(Math.round(shortSide * 0.29), Math.round(mainSize * 2.4));
        const stripeLimit = Math.max(Math.round(diagonal * 0.55), stripeStep * 1.5);
        const xOffset = Math.round(diagonal * 0.06);

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

            ctx.font = `800 ${mainSize}px Inter, Arial, sans-serif`;
            if (strokeOpacity > 0) {
                ctx.strokeStyle = `rgba(${color}, ${strokeOpacity})`;
                ctx.lineWidth = Math.max(1.25, Math.round(mainSize * 0.018));
                ctx.strokeText(mainText, x, y);
            }
            ctx.fillStyle = `rgba(${color}, ${mainOpacity})`;
            ctx.fillText(mainText, x, y);

            ctx.font = `600 ${subSize}px Inter, Arial, sans-serif`;
            if (strokeOpacity > 0) {
                ctx.strokeStyle = `rgba(${color}, ${Math.max(0.02, strokeOpacity * 0.55)})`;
                ctx.lineWidth = Math.max(1, Math.round(subSize * 0.025));
                ctx.strokeText(subText, x, y + Math.round(mainSize * 0.7));
            }
            ctx.fillStyle = `rgba(${color}, ${subOpacity})`;
            ctx.fillText(subText, x, y + Math.round(mainSize * 0.7));

            stripeIndex += 1;
        }

        ctx.restore();
    }
};

// ===== GLOBAL FORM CONTROLLER (P1) =====
// Centralized form management: validation, error display, loading state, submit lifecycle.
// Usage:
//   FormController.handle(form, {
//     validate: (data) => ({ field: 'Error message' }) | null,
//     onSubmit: async (data) => { ... },
//     onSuccess: (result) => { ... },
//     onError: (err) => { ... },
//     autosaveKey: 'form-key'   // optional
//   });
const FormController = {

    // Attach controller to a form element
    handle(formEl, options = {}) {
        if (!formEl) return;
        const { validate, onSubmit, onSuccess, onError, autosaveKey } = options;

        // Tag for autosave integration
        if (autosaveKey) formEl.dataset.autosaveKey = autosaveKey;

        formEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            this.clearErrors(formEl);

            const raw = new FormData(formEl);
            const data = Object.fromEntries(raw.entries());

            // Client-side validation
            if (validate) {
                const errors = validate(data);
                if (errors && Object.keys(errors).length > 0) {
                    this.showErrors(formEl, errors);
                    // Focus first error field
                    const firstField = Object.keys(errors)[0];
                    const el = formEl.querySelector(`[name="${firstField}"]`);
                    if (el) el.focus();
                    return;
                }
            }

            // Loading state
            this.setLoading(formEl, true);
            try {
                const result = await (onSubmit ? onSubmit(data, raw) : null);
                if (autosaveKey) FormAutoSave.discard(autosaveKey);
                if (onSuccess) onSuccess(result, data);
            } catch (err) {
                console.error('[FormController]', err);
                const msg = err?.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
                this.showGlobalError(formEl, msg);
                if (onError) onError(err);
                Toast.show(`❌ ${msg}`, 'error');
            } finally {
                this.setLoading(formEl, false);
            }
        });

        // Live validation: clear error on field input
        formEl.addEventListener('input', (e) => {
            const field = e.target.name;
            if (field) this.clearFieldError(formEl, field);
        });
    },

    // Show per-field errors: inserts .fc-error-msg below each field
    showErrors(formEl, errors) {
        Object.entries(errors).forEach(([field, msg]) => {
            const el = formEl.querySelector(`[name="${field}"]`);
            if (!el) return;
            el.classList.add('fc-error');
            el.setAttribute('aria-invalid', 'true');
            el.setAttribute('aria-describedby', `fc-err-${field}`);
            const span = document.createElement('span');
            span.className = 'fc-error-msg';
            span.id = `fc-err-${field}`;
            span.role = 'alert';
            span.textContent = msg;
            el.insertAdjacentElement('afterend', span);
        });
    },

    // Show global error banner inside form
    showGlobalError(formEl, msg) {
        this.clearGlobalError(formEl);
        const div = document.createElement('div');
        div.className = 'fc-global-error';
        div.role = 'alert';
        div.innerHTML = `<span>❌ ${msg}</span>`;
        formEl.prepend(div);
    },

    clearErrors(formEl) {
        formEl.querySelectorAll('.fc-error').forEach(el => {
            el.classList.remove('fc-error');
            el.removeAttribute('aria-invalid');
            el.removeAttribute('aria-describedby');
        });
        formEl.querySelectorAll('.fc-error-msg').forEach(el => el.remove());
        this.clearGlobalError(formEl);
    },

    clearFieldError(formEl, field) {
        const el = formEl.querySelector(`[name="${field}"]`);
        if (!el) return;
        el.classList.remove('fc-error');
        el.removeAttribute('aria-invalid');
        const msg = formEl.querySelector(`#fc-err-${field}`);
        if (msg) msg.remove();
    },

    clearGlobalError(formEl) {
        formEl.querySelectorAll('.fc-global-error').forEach(el => el.remove());
    },

    // Disable form + show loading spinner on submit button
    setLoading(formEl, loading) {
        const btn = formEl.querySelector('button[type="submit"], .btn-primary[type="submit"]');
        if (!btn) return;
        btn.disabled = loading;
        if (loading) {
            btn._originalText = btn.innerHTML;
            btn.innerHTML = `<span class="fc-spinner"></span> Đang lưu...`;
        } else if (btn._originalText) {
            btn.innerHTML = btn._originalText;
        }
    },

    // Convenience: extract and coerce FormData to typed object
    getData(formEl) {
        const raw = new FormData(formEl);
        return Object.fromEntries(raw.entries());
    },

    // Common validators
    validators: {
        required: (value, label = 'Trường này') =>
            (!value || !value.toString().trim()) ? `${label} không được để trống` : null,
        minLength: (value, min, label = 'Trường này') =>
            value && value.length < min ? `${label} cần ít nhất ${min} ký tự` : null,
        year: (value, label = 'Năm') => {
            const y = parseInt(value);
            return (isNaN(y) || y < 1900 || y > new Date().getFullYear() + 1)
                ? `${label} không hợp lệ` : null;
        },
        numeric: (value, label = 'Giá trị') =>
            isNaN(parseFloat(value)) ? `${label} phải là số` : null,
    }
};

// ===== FORM AUTO-SAVE (P1) =====
// Saves form state to sessionStorage every 30s to prevent data loss on idle timeout.
// Key format: "formDraft_<formKey>" — set via data-autosave-key on <form>
const FormAutoSave = {
    _timers: {},

    // Start auto-saving a form. formKey identifies the form (e.g. 'surgery-edit-123')
    start(formKey) {
        this.stop(formKey); // clear any existing timer
        this._restore(formKey);
        this._timers[formKey] = setInterval(() => this._save(formKey), 30000);
        // Also save on every input change (debounced)
        const form = document.querySelector(`form[data-autosave-key="${formKey}"]`);
        if (form) {
            form._autosaveHandler = () => this._save(formKey);
            form.addEventListener('input', form._autosaveHandler);
            form.addEventListener('change', form._autosaveHandler);
        }
    },

    stop(formKey) {
        clearInterval(this._timers[formKey]);
        delete this._timers[formKey];
    },

    discard(formKey) {
        this.stop(formKey);
        try { sessionStorage.removeItem(`formDraft_${formKey}`); } catch(e) {}
        const form = document.querySelector(`form[data-autosave-key="${formKey}"]`);
        if (form && form._autosaveHandler) {
            form.removeEventListener('input', form._autosaveHandler);
            form.removeEventListener('change', form._autosaveHandler);
        }
    },

    _save(formKey) {
        const form = document.querySelector(`form[data-autosave-key="${formKey}"]`);
        if (!form) return;
        const data = {};
        form.querySelectorAll('[name]').forEach(el => {
            if (el.type !== 'file') data[el.name] = el.value;
        });
        try {
            sessionStorage.setItem(`formDraft_${formKey}`, JSON.stringify({ ts: Date.now(), data }));
        } catch(e) {}
    },

    _restore(formKey) {
        try {
            const raw = sessionStorage.getItem(`formDraft_${formKey}`);
            if (!raw) return;
            const { ts, data } = JSON.parse(raw);
            // Only restore drafts < 8 hours old
            if (Date.now() - ts > 8 * 3600 * 1000) {
                sessionStorage.removeItem(`formDraft_${formKey}`);
                return;
            }
            setTimeout(() => {
                const form = document.querySelector(`form[data-autosave-key="${formKey}"]`);
                if (!form) return;
                let restored = false;
                Object.entries(data).forEach(([name, value]) => {
                    const el = form.querySelector(`[name="${name}"]`);
                    if (el && value !== undefined && value !== '') {
                        el.value = value;
                        // Trigger change event for dependent selects (e.g. surgeryType)
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        restored = true;
                    }
                });
                if (restored) Toast.show('📋 Đã khôi phục bản nháp chưa lưu', 'info');
                const modal = document.getElementById('modal');
                const modalBody = document.getElementById('modal-body');
                if (modal) modal.scrollTop = 0;
                if (modalBody) modalBody.scrollTop = 0;
            }, 100);
        } catch(e) {}
    },

    // Call on form submit success to clear the draft
    clear(formKey) { this.discard(formKey); }
};

// ===== MODAL =====
const Modal = {
    _currentFormKey: null,
    _escHandler: null,
    _trapHandler: null,      // U3: focus trap handler
    _triggerElement: null,   // U3: element đã focus trước khi mở modal

    open(title, bodyHTML) {
        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modal-body');

        document.getElementById('modal-title').textContent = title;
        modalBody.innerHTML = bodyHTML;

        // Reset scroll position to top (dòng đầu tiên)
        if (modal) modal.scrollTop = 0;
        if (modalBody) modalBody.scrollTop = 0;

        // U3: Lưu element hiện tại để restore focus khi đóng
        this._triggerElement = document.activeElement;

        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');

        // P3.3: Esc key — close modal
        if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
        this._escHandler = (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('active')) {
                e.preventDefault();
                this.close();
            }
        };
        document.addEventListener('keydown', this._escHandler);

        // U3: Focus trap — Tab/Shift+Tab vòng trong modal
        if (this._trapHandler) document.removeEventListener('keydown', this._trapHandler);
        this._trapHandler = (e) => {
            if (e.key !== 'Tab' || !overlay.classList.contains('active')) return;
            const m = document.getElementById('modal');
            const focusable = Array.from(
                m.querySelectorAll(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
            ).filter(el => el.offsetParent !== null); // chỉ lấy visible elements
            if (!focusable.length) return;
            const first = focusable[0];
            const last  = focusable[focusable.length - 1];
            if (e.shiftKey) {
                // Shift+Tab: nếu đang ở first thì wrap về last
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                // Tab: nếu đang ở last thì wrap về first
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        document.addEventListener('keydown', this._trapHandler);

        // Move focus & reset scroll về đầu trang sau khi render xong
        setTimeout(() => {
            if (modal) modal.scrollTop = 0;
            if (modalBody) modalBody.scrollTop = 0;

            const isMobile = window.innerWidth <= 768;
            const form = modalBody.querySelector('form');
            const firstInput = form ? form.querySelector('input:not([type="hidden"]), select, textarea') : null;

            // Auto-save: start if form has data-autosave-key
            if (form && form.dataset.autosaveKey) {
                this._currentFormKey = form.dataset.autosaveKey;
                FormAutoSave.start(this._currentFormKey);
            }

            if (!isMobile && firstInput) {
                try { firstInput.focus({ preventScroll: true }); } catch(e) {}
            } else {
                const closeBtn = document.getElementById('modal-close');
                if (closeBtn) try { closeBtn.focus({ preventScroll: true }); } catch(e) {}
            }

            if (modal) modal.scrollTop = 0;
            if (modalBody) modalBody.scrollTop = 0;
        }, 50);
    },

    close() {
        const overlay = document.getElementById('modal-overlay');
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        // Stop auto-save timer (keep draft — user may reopen)
        if (this._currentFormKey) {
            FormAutoSave.stop(this._currentFormKey);
            this._currentFormKey = null;
        }
        // Remove Esc handler
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
        // U3: Remove focus trap handler
        if (this._trapHandler) {
            document.removeEventListener('keydown', this._trapHandler);
            this._trapHandler = null;
        }
        // U3: Restore focus về element trước khi mở modal
        if (this._triggerElement && typeof this._triggerElement.focus === 'function') {
            this._triggerElement.focus();
            this._triggerElement = null;
        }
    },

    // Call on successful save to discard draft
    clearDraft(formKey) {
        FormAutoSave.discard(formKey);
        this._currentFormKey = null;
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
