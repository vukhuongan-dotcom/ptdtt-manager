// ===== GLOBAL SEARCH (Cmd+K / Ctrl+K) =====
const GlobalSearch = {
    isOpen: false,
    focusedIndex: -1,
    results: [],

    // Normalize Vietnamese text for search (remove diacritics)
    normalize(str) {
        return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
    },

    // Open search overlay
    open() {
        this.isOpen = true;
        this.focusedIndex = -1;
        this.results = [];
        this._renderOverlay();
        setTimeout(() => {
            const input = document.getElementById('global-search-input');
            if (input) input.focus();
        }, 100);
    },

    // Close search overlay
    close() {
        this.isOpen = false;
        const overlay = document.getElementById('search-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 200);
        }
    },

    // Render the search overlay HTML
    _renderOverlay() {
        // Remove existing
        const existing = document.getElementById('search-overlay');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.id = 'search-overlay';
        div.className = 'search-overlay';
        div.innerHTML = `
            <div class="search-container">
                <div class="search-input-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="global-search-input" class="search-input" aria-label="Tìm kiếm toàn hệ thống" placeholder="Tìm kiếm nhân sự, bệnh nhân, ca mổ..." autocomplete="off" autofocus>
                    <span class="search-kbd">ESC</span>
                </div>
                <div class="search-results" id="search-results">
                    <div class="search-results-empty">Nhập từ khóa để tìm kiếm toàn hệ thống</div>
                </div>
                <div class="search-footer">
                    <span><kbd>↑↓</kbd> Di chuyển</span>
                    <span><kbd>Enter</kbd> Chọn</span>
                    <span><kbd>ESC</kbd> Đóng</span>
                </div>
            </div>
        `;
        document.body.appendChild(div);

        // Animate in
        requestAnimationFrame(() => div.classList.add('active'));

        // Event listeners
        div.addEventListener('click', (e) => {
            if (e.target === div) this.close();
        });

        const input = document.getElementById('global-search-input');
        input.addEventListener('input', (e) => {
            if (!this._composing) this.search(e.target.value);
        });
        input.addEventListener('compositionstart', () => { this._composing = true; });
        input.addEventListener('compositionend', (e) => {
            this._composing = false;
            this.search(e.target.value);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); this._moveFocus(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); this._moveFocus(-1); }
            else if (e.key === 'Enter') { e.preventDefault(); this._selectFocused(); }
            else if (e.key === 'Escape') { this.close(); }
        });
    },

    // Perform search across modules
    search(query) {
        const q = query.trim();
        const container = document.getElementById('search-results');
        if (!container) return;

        if (q.length < 2) {
            container.innerHTML = '<div class="search-results-empty">Nhập từ khóa để tìm kiếm toàn hệ thống</div>';
            this.results = [];
            this.focusedIndex = -1;
            return;
        }

        const nq = this.normalize(q);
        const results = [];

        // Search staff
        const staff = Store.getAll('staff');
        staff.forEach(s => {
            if (this.normalize(s.name).includes(nq) || this.normalize(s.role).includes(nq) || this.normalize(s.title).includes(nq)) {
                results.push({
                    type: 'staff', icon: '👤', iconBg: 'var(--primary-a10)',
                    name: s.name,
                    detail: `${s.title} — ${s.role}`,
                    badge: s.cơHữu ? 'Cơ hữu' : 'Biên chế',
                    badgeBg: 'var(--primary-a10)', badgeColor: 'var(--primary)',
                    action: () => { App.navigate('staff'); }
                });
            }
        });

        // Search external doctors
        const extDocs = Store.getAll('externalDoctors') || [];
        extDocs.forEach(d => {
            if (this.normalize(d.name).includes(nq) || this.normalize(d.position || '').includes(nq)) {
                results.push({
                    type: 'staff', icon: '🩺', iconBg: '#8b5cf620',
                    name: d.name,
                    detail: `${d.title} — ${d.position || d.department || ''}`,
                    badge: 'BS ngoài', badgeBg: '#8b5cf620', badgeColor: '#7c3aed',
                    action: () => { StaffPage.activeTab = 'external'; App.navigate('staff'); }
                });
            }
        });

        // Search surgeries
        const surgeries = SurgeryPage.getAllSurgeries();
        surgeries.forEach(s => {
            if (this.normalize(s.patientName).includes(nq) || this.normalize(s.diagnosis || '').includes(nq) || this.normalize(s.method || '').includes(nq)) {
                const typeInfo = SURGERY_TYPES[s.surgeryType] || { label: 'PT', color: '#64748b' };
                const dateObj = new Date(s.date);
                const dateStr = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`;
                results.push({
                    type: 'surgery', icon: '🔬', iconBg: '#3b82f620',
                    name: s.patientName,
                    detail: `${dateStr} — ${s.diagnosis || s.method || ''}`,
                    badge: typeInfo.label, badgeBg: typeInfo.color + '20', badgeColor: typeInfo.color,
                    action: () => { SurgeryPage.viewDetail(s.id); this.close(); return; }
                });
            }
        });

        // Search SHCM (Research)
        const shcm = Store.getAll('shcmSchedule') || [];
        shcm.forEach(s => {
            if (this.normalize(s.title || '').includes(nq) || this.normalize(s.doctorName || '').includes(nq)) {
                results.push({
                    type: 'research', icon: '🔬', iconBg: 'var(--primary-a10)',
                    name: s.title,
                    detail: `${s.doctorName || 'BS'} · ${s.presentDate || 'Chưa định ngày'}`,
                    badge: s.status === 'done' ? 'Đã trình' : 'SHCM', badgeBg: 'var(--primary-a10)', badgeColor: 'var(--primary)',
                    action: () => { App.navigate('research'); }
                });
            }
        });

        // Search Plans
        const plans = Store.getAll('plans') || [];
        plans.forEach(p => {
            if (this.normalize(p.title || '').includes(nq) || this.normalize(p.note || '').includes(nq)) {
                results.push({
                    type: 'plan', icon: '📅', iconBg: '#f59e0b20',
                    name: p.title,
                    detail: `${p.date || ''} ${p.time || ''} · ${p.location || ''} ${p.note ? '— ' + p.note : ''}`,
                    badge: 'Kế hoạch', badgeBg: '#f59e0b20', badgeColor: '#d97706',
                    action: () => { App.navigate('plans'); }
                });
            }
        });

        // Navigation items
        const navItems = [
            { name: 'Tổng quan', detail: 'Dashboard', icon: '📊', page: 'dashboard' },
            { name: 'Nhân sự', detail: 'Quản lý nhân viên', icon: '👥', page: 'staff' },
            { name: 'Theo dõi nhân viên', detail: 'Staff tracking', icon: '📋', page: 'staff-tracking' },
            { name: 'Phòng bệnh', detail: 'Sơ đồ phòng', icon: '🏠', page: 'rooms' },
            { name: 'Kế hoạch', detail: 'Lịch kế hoạch', icon: '📅', page: 'plans' },
            { name: 'Phân công tuần', detail: 'Lịch phân công', icon: '📆', page: 'schedule' },
            { name: 'Lịch mổ tuần', detail: 'Surgery schedule', icon: '🔪', page: 'surgery' },
            { name: 'Thống kê PT', detail: 'Surgery stats', icon: '📈', page: 'surgery-stats' },
            { name: 'Sinh hoạt chuyên môn', detail: 'Lịch SHCM & bài báo cáo', icon: '🔬', page: 'research' },
            { name: 'Hội nghị', detail: 'Hội nghị y khoa', icon: '👥', page: 'conferences' },
            { name: 'Báo cáo', detail: 'Báo cáo khoa', icon: '📄', page: 'reports' },
        ];
        navItems.forEach(n => {
            if (this.normalize(n.name).includes(nq) || this.normalize(n.detail).includes(nq)) {
                results.push({
                    type: 'nav', icon: n.icon, iconBg: '#94a3b820',
                    name: n.name,
                    detail: n.detail,
                    badge: 'Trang', badgeBg: '#94a3b820', badgeColor: '#64748b',
                    action: () => { App.navigate(n.page); }
                });
            }
        });

        this.results = results.slice(0, 20);
        this.focusedIndex = results.length > 0 ? 0 : -1;
        this._renderResults(q);
    },

    _renderResults(query) {
        const container = document.getElementById('search-results');
        if (!container) return;

        if (this.results.length === 0) {
            container.innerHTML = `<div class="search-results-empty">Không tìm thấy kết quả cho "${Utils.escapeHtml(query)}"</div>`;
            return;
        }

        // Group by type
        const groups = {};
        const groupLabels = { nav: 'Trang', staff: 'Nhân sự', surgery: 'Ca phẫu thuật', research: 'Sinh hoạt chuyên môn', plan: 'Kế hoạch', patient: 'Bệnh nhân' };
        this.results.forEach((r, idx) => {
            if (!groups[r.type]) groups[r.type] = [];
            groups[r.type].push({ ...r, idx });
        });

        let html = '';
        const order = ['nav', 'staff', 'surgery', 'research', 'plan', 'patient'];
        order.forEach(type => {
            if (!groups[type]) return;
            html += `<div class="search-group-label">${groupLabels[type]} (${groups[type].length})</div>`;
            groups[type].forEach(r => {
                // Highlight match in name (HTML-escaped before inserting <mark>)
                const highlightedName = this._highlight(r.name, query);
                html += `
                    <div class="search-result-item ${r.idx === this.focusedIndex ? 'focused' : ''}" 
                         data-idx="${r.idx}" onclick="GlobalSearch._selectIndex(${r.idx})">
                        <div class="search-result-icon" style="background:${r.iconBg}">${r.icon}</div>
                        <div class="search-result-info">
                            <div class="search-result-name">${highlightedName}</div>
                            <div class="search-result-detail">${Utils.escapeHtml(r.detail || '')}</div>
                        </div>
                        <span class="search-result-badge" style="background:${r.badgeBg};color:${r.badgeColor}">${Utils.escapeHtml(r.badge || '')}</span>
                    </div>
                `;
            });
        });

        container.innerHTML = html;
    },

    _highlight(text, query) {
        const raw = String(text ?? '');
        if (!query) return Utils.escapeHtml(raw);
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        return raw.split(regex).map((part, idx) =>
            idx % 2 === 1 ? `<mark>${Utils.escapeHtml(part)}</mark>` : Utils.escapeHtml(part)
        ).join('');
    },

    _moveFocus(dir) {
        if (this.results.length === 0) return;
        this.focusedIndex = (this.focusedIndex + dir + this.results.length) % this.results.length;
        // Update visual
        const items = document.querySelectorAll('.search-result-item');
        items.forEach(el => el.classList.remove('focused'));
        const focused = document.querySelector(`[data-idx="${this.focusedIndex}"]`);
        if (focused) {
            focused.classList.add('focused');
            focused.scrollIntoView({ block: 'nearest' });
        }
    },

    _selectFocused() {
        if (this.focusedIndex >= 0 && this.results[this.focusedIndex]) {
            this._selectIndex(this.focusedIndex);
        }
    },

    _selectIndex(idx) {
        const r = this.results[idx];
        if (r && r.action) {
            this.close();
            setTimeout(() => r.action(), 100);
        }
    },

    // Initialize keyboard shortcut (single unified handler)
    _bound: false,
    init() {
        if (this._bound) return;
        this._bound = true;
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && (e.key || '').toLowerCase() === 'k') {
                e.preventDefault();
                if (this.isOpen) this.close();
                else this.open();
                return;
            }
            if (e.key === '/' && !this.isOpen) {
                const tag = document.activeElement?.tagName;
                const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
                    || document.activeElement?.isContentEditable;
                const hasModalOpen = !!document.querySelector('.modal-overlay.active, .confirm-overlay.show');
                if (!isEditing && !hasModalOpen) {
                    e.preventDefault();
                    this.open();
                }
                return;
            }
            if (e.key === 'Escape' && this.isOpen) {
                e.preventDefault();
                this.close();
            }
        });
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    GlobalSearch.init();
});
