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
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="global-search-input" class="search-input" placeholder="Tìm kiếm nhân sự, bệnh nhân, ca mổ..." autocomplete="off" autofocus>
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
                    type: 'staff', icon: '👤', iconBg: '#06b6d420',
                    name: s.name,
                    detail: `${s.title} — ${s.role}`,
                    badge: s.cơHữu ? 'Cơ hữu' : 'Biên chế',
                    badgeBg: '#06b6d420', badgeColor: '#0891b2',
                    action: () => { App.navigateTo('staff'); }
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
                    action: () => { StaffPage.activeTab = 'external'; App.navigateTo('staff'); }
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

        // Search patients
        const patients = Store.getAll('patients');
        patients.forEach(p => {
            if (this.normalize(p.name).includes(nq) || this.normalize(p.diagnosis || '').includes(nq)) {
                results.push({
                    type: 'patient', icon: '🏥', iconBg: '#10b98120',
                    name: p.name,
                    detail: `${p.gender}, ${p.age}T — ${p.diagnosis || ''}`,
                    badge: p.bed, badgeBg: '#10b98120', badgeColor: '#059669',
                    action: () => { App.navigateTo('patients'); }
                });
            }
        });

        // Search tasks
        const tasks = Store.getAll('tasks');
        tasks.forEach(t => {
            if (this.normalize(t.title).includes(nq) || this.normalize(t.desc || '').includes(nq)) {
                const statusLabels = { todo: 'Chờ', doing: 'Đang làm', done: 'Hoàn thành' };
                results.push({
                    type: 'task', icon: '📋', iconBg: '#f59e0b20',
                    name: t.title,
                    detail: t.desc || '',
                    badge: statusLabels[t.status] || t.status, badgeBg: '#f59e0b20', badgeColor: '#d97706',
                    action: () => { App.navigateTo('tasks'); }
                });
            }
        });

        // Navigation items
        const navItems = [
            { name: 'Tổng quan', detail: 'Dashboard', icon: '📊', page: 'dashboard' },
            { name: 'Nhân sự', detail: 'Quản lý nhân viên', icon: '👥', page: 'staff' },
            { name: 'Theo dõi nhân viên', detail: 'Staff tracking', icon: '📋', page: 'staff-tracking' },
            { name: 'Phòng bệnh', detail: 'Sơ đồ phòng', icon: '🏠', page: 'rooms' },
            { name: 'Công việc', detail: 'Kanban board', icon: '✅', page: 'tasks' },
            { name: 'Kế hoạch', detail: 'Lịch kế hoạch', icon: '📅', page: 'plans' },
            { name: 'Bệnh nhân', detail: 'Danh sách BN', icon: '🏥', page: 'patients' },
            { name: 'Phân công tuần', detail: 'Lịch phân công', icon: '📆', page: 'schedule' },
            { name: 'Lịch mổ tuần', detail: 'Surgery schedule', icon: '🔪', page: 'surgery' },
            { name: 'Thống kê PT', detail: 'Surgery stats', icon: '📈', page: 'surgery-stats' },
        ];
        navItems.forEach(n => {
            if (this.normalize(n.name).includes(nq) || this.normalize(n.detail).includes(nq)) {
                results.push({
                    type: 'nav', icon: n.icon, iconBg: '#94a3b820',
                    name: n.name,
                    detail: n.detail,
                    badge: 'Trang', badgeBg: '#94a3b820', badgeColor: '#64748b',
                    action: () => { App.navigateTo(n.page); }
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
            container.innerHTML = `<div class="search-results-empty">Không tìm thấy kết quả cho "${query}"</div>`;
            return;
        }

        // Group by type
        const groups = {};
        const groupLabels = { nav: 'Trang', staff: 'Nhân sự', surgery: 'Ca phẫu thuật', patient: 'Bệnh nhân', task: 'Công việc' };
        this.results.forEach((r, idx) => {
            if (!groups[r.type]) groups[r.type] = [];
            groups[r.type].push({ ...r, idx });
        });

        let html = '';
        const order = ['nav', 'staff', 'surgery', 'patient', 'task'];
        order.forEach(type => {
            if (!groups[type]) return;
            html += `<div class="search-group-label">${groupLabels[type]} (${groups[type].length})</div>`;
            groups[type].forEach(r => {
                // Highlight match in name
                const highlightedName = this._highlight(r.name, query);
                html += `
                    <div class="search-result-item ${r.idx === this.focusedIndex ? 'focused' : ''}" 
                         data-idx="${r.idx}" onclick="GlobalSearch._selectIndex(${r.idx})">
                        <div class="search-result-icon" style="background:${r.iconBg}">${r.icon}</div>
                        <div class="search-result-info">
                            <div class="search-result-name">${highlightedName}</div>
                            <div class="search-result-detail">${r.detail}</div>
                        </div>
                        <span class="search-result-badge" style="background:${r.badgeBg};color:${r.badgeColor}">${r.badge}</span>
                    </div>
                `;
            });
        });

        container.innerHTML = html;
    },

    _highlight(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
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

    // Initialize keyboard shortcut
    init() {
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                if (this.isOpen) this.close();
                else this.open();
            }
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    GlobalSearch.init();
});
