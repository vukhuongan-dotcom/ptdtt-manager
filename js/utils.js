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
