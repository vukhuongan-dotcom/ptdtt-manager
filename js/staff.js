// ===== STAFF PAGE =====
const STAFF_STATUSES = {
    'active':    { label: 'Hoạt động', badge: 'badge-success', icon: '🟢' },
    'leave':     { label: 'Nghỉ phép', badge: 'badge-warning', icon: '🟡' },
    'sick':      { label: 'Bệnh ốm',  badge: 'badge-danger',  icon: '🔴' },
    'business':  { label: 'Công tác',  badge: 'badge-accent',  icon: '🟣' }
};

const StaffPage = {
    currentFilter: 'all',
    searchQuery: '',
    activeTab: 'internal', // 'internal' | 'external'

    render() {
        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Nhân sự</h1>
                <p class="page-subtitle">Quản lý nhân viên khoa Phẫu thuật Đại trực tràng</p>
            </div>
        </div>

        <div class="staff-subtabs">
            <button class="staff-subtab ${this.activeTab === 'internal' ? 'active' : ''}" onclick="StaffPage.switchTab('internal')">
                👥 Nhân viên khoa <span class="staff-subtab-count">${Store.getAll('staff').length}</span>
            </button>
            <button class="staff-subtab ${this.activeTab === 'external' ? 'active' : ''}" onclick="StaffPage.switchTab('external')">
                🩺 BS ngoài khoa <span class="staff-subtab-count">${Store.getAll('externalDoctors').length}</span>
            </button>
        </div>

        ${this.activeTab === 'internal' ? this.renderInternal() : this.renderExternal()}
        `;
    },

    switchTab(tab) {
        this.activeTab = tab;
        this.searchQuery = '';
        this.currentFilter = 'all';
        App.renderCurrentPage();
    },

    // ===== INTERNAL STAFF TAB =====
    renderInternal() {
        const allStaff = Store.getAll('staff');
        const staff = this.getFiltered();
        const isAdmin = Auth.getSession()?.isAdmin;
        const today = new Date().toISOString().split('T')[0];

        const roleDefs = [
            { key: 'all', label: 'Tất cả' },
            { key: 'BCN', label: 'BCN khoa' },
            { key: 'Bác sĩ chính', label: 'BS chính' },
            { key: 'học viên', label: 'BS học viên' },
            { key: 'Điều dưỡng', label: 'ĐD' },
            { key: 'Hộ lý', label: 'Hộ lý' },
            { key: 'Thư ký', label: 'Thư ký' }
        ];

        const getCatStaff = (key) => {
            if (key === 'all') return allStaff;
            if (key === 'BCN') return allStaff.filter(s => s.role.includes('Trưởng khoa') || s.role.includes('Phó trưởng khoa') || s.role === 'Điều dưỡng trưởng');
            return allStaff.filter(s => s.role.includes(key));
        };

        return `
        <div class="flex justify-between items-center">
            <div class="staff-filters">
                ${roleDefs.map(r => {
                    const cnt = getCatStaff(r.key).length;
                    return `<button class="filter-btn ${this.currentFilter===r.key?'active':''}" onclick="StaffPage.setFilter('${r.key}')">${r.label} (${cnt})</button>`;
                }).join('')}
            </div>
            <div style="display:flex;gap:8px;align-items:center">
                <div class="search-box">
                    ${Utils.searchIcon()}
                    <input type="text" placeholder="Tìm nhân sự..." value="${this.searchQuery}" oninput="StaffPage.search(this.value)" id="staff-search">
                </div>
                ${isAdmin ? `<button class="btn btn-primary" onclick="StaffPage.openForm()">
                    ${Utils.plusIcon()} Thêm
                </button>` : ''}
            </div>
        </div>

        <div class="card staff-table-card">
            <table>
                <thead>
                    <tr>
                        <th>Họ tên</th>
                        <th>Chức danh</th>
                        <th>Vai trò</th>
                        <th>Điện thoại</th>
                        <th>Email</th>
                        <th>Trạng thái</th>
                        ${isAdmin ? '<th style="width:100px">Thao tác</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${staff.length ? staff.map(s => {
                        const st = this.getEffectiveStatus(s, today);
                        const statusInfo = STAFF_STATUSES[st.status] || STAFF_STATUSES.active;
                        const dateRange = st.fromDate && st.toDate ? `<span class="staff-status-dates">${this.fmtDate(st.fromDate)} → ${this.fmtDate(st.toDate)}</span>` : '';
                        return `
                    <tr>
                        <td>
                            <div class="staff-name-cell">
                                <div class="staff-avatar-sm" style="background:${s.color}">${Utils.getInitials(s.name)}</div>
                                <span class="staff-fullname">${s.name}</span>
                            </div>
                        </td>
                        <td>${s.title}</td>
                        <td><span class="badge badge-primary">${s.role}</span></td>
                        <td style="color:var(--text-muted)">${s.phone || '—'}</td>
                        <td style="color:var(--text-muted);font-size:0.82rem">${s.email || '—'}</td>
                        <td>
                            <div class="staff-status-cell">
                                <span class="badge ${statusInfo.badge}">${statusInfo.label}</span>
                                ${dateRange}
                            </div>
                        </td>
                        ${isAdmin ? `<td>
                            <div class="staff-actions">
                                <button class="btn-icon" onclick="StaffPage.openStatusForm(${s.id})" title="Trạng thái">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                                </button>
                                <button class="btn-icon" onclick="StaffPage.openForm(${s.id})" title="Sửa">${Utils.editIcon()}</button>
                                <button class="btn-icon" onclick="StaffPage.delete(${s.id})" title="Xoá">${Utils.deleteIcon()}</button>
                            </div>
                        </td>` : ''}
                    </tr>`;
                    }).join('') : `<tr><td colspan="${isAdmin ? 7 : 6}"><div class="empty-state"><p>Không tìm thấy nhân sự</p></div></td></tr>`}
                </tbody>
            </table>
        </div>
        `;
    },

    // ===== EXTERNAL DOCTORS TAB =====
    renderExternal() {
        const doctors = Store.getAll('externalDoctors') || [];
        const isAdmin = Auth.getSession()?.isAdmin;

        // Apply search filter (diacritic-insensitive)
        let filtered = doctors;
        if (this.searchQuery) {
            const q = this._normalize(this.searchQuery);
            filtered = doctors.filter(d => this._normalize(d.name).includes(q) || this._normalize(d.department || '').includes(q));
        }

        return `
        <div class="flex justify-between items-center">
            <div class="staff-filters">
                <span style="color:var(--text-muted);font-size:0.85rem;padding:6px 12px">Danh sách bác sĩ ngoài khoa hỗ trợ phẫu thuật</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
                <div class="search-box">
                    ${Utils.searchIcon()}
                    <input type="text" placeholder="Tìm BS ngoài khoa..." value="${this.searchQuery}" oninput="StaffPage.search(this.value)" id="staff-search">
                </div>
                ${isAdmin ? `<button class="btn btn-primary" onclick="StaffPage.openExternalForm()">
                    ${Utils.plusIcon()} Thêm BS
                </button>` : ''}
            </div>
        </div>

        <div class="card staff-table-card">
            <table>
                <thead>
                    <tr>
                        <th style="width:50px">STT</th>
                        <th>Họ tên</th>
                        <th>Học vị</th>
                        <th>Chức vụ</th>
                        <th>Khoa / Phòng</th>
                        <th>Ghi chú</th>
                        ${isAdmin ? '<th style="width:80px">Thao tác</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${filtered.length ? filtered.map((d, idx) => `
                    <tr>
                        <td style="text-align:center;color:var(--text-muted);font-weight:600">${idx + 1}</td>
                        <td>
                            <div class="staff-name-cell">
                                <div class="staff-avatar-sm" style="background:${d.color || '#6366f1'}">${Utils.getInitials(d.name)}</div>
                                <span class="staff-fullname">${d.name}</span>
                            </div>
                        </td>
                        <td>${d.title || '—'}</td>
                        <td><span class="badge badge-primary">${d.position || '—'}</span></td>
                        <td style="color:var(--text-secondary)">${d.department || '—'}</td>
                        <td style="color:var(--text-muted);font-size:0.82rem">${d.note || '—'}</td>
                        ${isAdmin ? `<td>
                            <div class="staff-actions">
                                <button class="btn-icon" onclick="StaffPage.openExternalForm(${d.id})" title="Sửa">${Utils.editIcon()}</button>
                                <button class="btn-icon" onclick="StaffPage.deleteExternal(${d.id})" title="Xoá">${Utils.deleteIcon()}</button>
                            </div>
                        </td>` : ''}
                    </tr>
                    `).join('') : `<tr><td colspan="${isAdmin ? 7 : 6}"><div class="empty-state"><p>Chưa có BS ngoài khoa</p></div></td></tr>`}
                </tbody>
            </table>
        </div>
        `;
    },


    // Determine effective status based on date range
    getEffectiveStatus(staff, today) {
        if (staff.statusType && staff.statusType !== 'active' && staff.statusFrom && staff.statusTo) {
            if (today >= staff.statusFrom && today <= staff.statusTo) {
                return { status: staff.statusType, fromDate: staff.statusFrom, toDate: staff.statusTo };
            }
            return { status: 'active', fromDate: null, toDate: null };
        }
        return { status: staff.statusType || 'active', fromDate: null, toDate: null };
    },

    fmtDate(d) {
        if (!d) return '';
        const parts = d.split('-');
        return `${parts[2]}/${parts[1]}`;
    },

    getFiltered() {
        let staff = Store.getAll('staff');
        if (this.currentFilter === 'BCN') {
            staff = staff.filter(s => s.role.includes('Trưởng khoa') || s.role.includes('Phó trưởng khoa') || s.role === 'Điều dưỡng trưởng');
        } else if (this.currentFilter !== 'all') {
            staff = staff.filter(s => s.role.includes(this.currentFilter));
        }
        if (this.searchQuery) {
            const q = this._normalize(this.searchQuery);
            staff = staff.filter(s => this._normalize(s.name).includes(q) || this._normalize(s.role).includes(q));
        }
        return staff;
    },

    setFilter(f) { this.currentFilter = f; App.renderCurrentPage(); },

    _composing: false,
    _searchTimer: null,

    search(q) {
        if (this._composing) return;
        this.searchQuery = q;
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => App.renderCurrentPage(), 300);
    },

    _normalize(str) {
        return str.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D');
    },

    openStatusForm(id) {
        if (!Auth.getSession()?.isAdmin) return;
        const s = Store.getById('staff', id);
        if (!s) return;
        const today = new Date().toISOString().split('T')[0];

        Modal.open(`Cập nhật trạng thái — ${s.name}`, `
            <form onsubmit="StaffPage.saveStatus(event, ${id})">
                <div class="form-group">
                    <label class="form-label">Trạng thái</label>
                    <select class="form-select" name="statusType" id="status-type-select" onchange="StaffPage.toggleDateFields()">
                        ${Object.entries(STAFF_STATUSES).map(([key, val]) =>
                            `<option value="${key}" ${(s.statusType||'active')===key?'selected':''}>${val.icon} ${val.label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div id="status-date-fields" style="${(s.statusType && s.statusType !== 'active') ? '' : 'display:none'}">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Từ ngày</label>
                            <input class="form-input" type="date" name="statusFrom" value="${s.statusFrom || today}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Đến ngày</label>
                            <input class="form-input" type="date" name="statusTo" value="${s.statusTo || today}">
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Ghi chú</label>
                    <input class="form-input" name="statusNote" value="${s.statusNote || ''}" placeholder="Lý do nghỉ, nơi công tác...">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">Cập nhật</button>
                </div>
            </form>
        `);
    },

    toggleDateFields() {
        const sel = document.getElementById('status-type-select');
        const fields = document.getElementById('status-date-fields');
        if (sel && fields) {
            fields.style.display = sel.value === 'active' ? 'none' : '';
        }
    },

    saveStatus(e, id) {
        if (!Auth.getSession()?.isAdmin) return;
        e.preventDefault();
        const f = new FormData(e.target);
        const statusType = f.get('statusType');
        const data = { statusType };
        if (statusType !== 'active') {
            data.statusFrom = f.get('statusFrom');
            data.statusTo = f.get('statusTo');
            data.statusNote = f.get('statusNote');
        } else {
            data.statusFrom = '';
            data.statusTo = '';
            data.statusNote = '';
        }
        Store.update('staff', id, data);
        Modal.close();
        App.renderCurrentPage();
    },

    openForm(id) {
        if (!Auth.getSession()?.isAdmin) return;
        const s = id ? Store.getById('staff', id) : null;
        const title = s ? 'Chỉnh sửa nhân sự' : 'Thêm nhân sự mới';
        Modal.open(title, `
            <form id="staff-form" onsubmit="StaffPage.save(event, ${id || 0})">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Họ tên</label>
                        <input class="form-input" name="name" value="${s?.name||''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Chức danh</label>
                        <input class="form-input" name="title" value="${s?.title||''}" required placeholder="BS., ThS. BS, CN. ĐD...">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Vai trò</label>
                        <select class="form-select" name="role">
                            ${'BS Trưởng khoa,BS Phó trưởng khoa,Bác sĩ chính,Bác sĩ học viên,Điều dưỡng trưởng,Điều dưỡng,Hộ lý,Thư ký'.split(',').map(r =>
                                `<option value="${r}" ${s?.role===r?'selected':''}>${r}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Điện thoại</label>
                        <input class="form-input" name="phone" value="${s?.phone||''}" placeholder="0901234567">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input class="form-input" type="email" name="email" value="${s?.email||''}" placeholder="nguyenvana@binhdan.vn">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">${s?'Cập nhật':'Thêm mới'}</button>
                </div>
            </form>
        `);
    },

    save(e, id) {
        if (!Auth.getSession()?.isAdmin) return;
        e.preventDefault();
        const form = new FormData(e.target);
        const data = {
            name: form.get('name'),
            title: form.get('title'),
            role: form.get('role'),
            phone: form.get('phone'),
            email: form.get('email')
        };

        if (id) {
            // Update existing staff
            Store.update('staff', id, data);
            // Update account info
            Auth.updateAccount(id, data);
            Modal.close();
            App.renderCurrentPage();
        } else {
            // Add new staff
            data.status = 'active';
            data.color = Utils.randomColor();
            data.statusType = 'active';
            const newStaff = Store.add('staff', data);
            // Auto-create account
            const cred = Auth.addAccount(newStaff);
            Modal.close();
            App.renderCurrentPage();
            // Show account info
            setTimeout(() => {
                alert(`Đã tạo nhân sự mới!\n\nTài khoản: ${cred.username}\nMật khẩu: ${cred.password}`);
            }, 300);
        }
    },

    delete(id) {
        if (!Auth.getSession()?.isAdmin) return;
        const s = Store.getById('staff', id);
        if (!s) return;
        if (confirm(`Xác nhận xoá nhân sự "${s.name}"?\nTài khoản đăng nhập sẽ bị vô hiệu hoá.`)) {
            // Remove from store
            Store.remove('staff', id);
            // Disable account (remove from accounts list)
            Auth.removeAccount(id);
            Modal.close();
            App.renderCurrentPage();
        }
    },

    // ===== EXTERNAL DOCTOR CRUD =====
    openExternalForm(id) {
        if (!Auth.getSession()?.isAdmin) return;
        const docs = Store.getAll('externalDoctors') || [];
        const d = id ? docs.find(x => x.id === id) : null;
        const title = d ? 'Chỉnh sửa BS ngoài khoa' : 'Thêm BS ngoài khoa';

        Modal.open(title, `
            <form onsubmit="StaffPage.saveExternal(event, ${id || 0})">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Họ tên</label>
                        <input class="form-input" name="name" value="${d?.name||''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Học vị</label>
                        <input class="form-input" name="title" value="${d?.title||''}" placeholder="BSCKII, ThS,...">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Chức vụ</label>
                        <input class="form-input" name="position" value="${d?.position||''}" placeholder="Phó Giám đốc,...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Khoa / Phòng</label>
                        <input class="form-input" name="department" value="${d?.department||''}" placeholder="Ngoại Tiêu hoá,...">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Ghi chú</label>
                    <input class="form-input" name="note" value="${d?.note||''}" placeholder="Ghi chú thêm...">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">${d ? 'Cập nhật' : 'Thêm mới'}</button>
                </div>
            </form>
        `);
    },

    saveExternal(e, id) {
        if (!Auth.getSession()?.isAdmin) return;
        e.preventDefault();
        const form = new FormData(e.target);
        const data = {
            name: form.get('name'),
            title: form.get('title'),
            position: form.get('position'),
            department: form.get('department'),
            note: form.get('note')
        };
        if (id) {
            Store.update('externalDoctors', id, data);
        } else {
            data.color = Utils.randomColor();
            Store.add('externalDoctors', data);
        }
        Modal.close();
        App.renderCurrentPage();
    },

    deleteExternal(id) {
        if (!Auth.getSession()?.isAdmin) return;
        const docs = Store.getAll('externalDoctors') || [];
        const d = docs.find(x => x.id === id);
        if (!d) return;
        if (confirm(`Xác nhận xoá BS ngoài khoa "${d.name}"?`)) {
            Store.remove('externalDoctors', id);
            App.renderCurrentPage();
        }
    },

    afterRender() {
        const el = document.getElementById('staff-search');
        if (el) {
            el.addEventListener('compositionstart', () => { this._composing = true; });
            el.addEventListener('compositionend', (e) => {
                this._composing = false;
                this.search(e.target.value);
            });
            if (this.searchQuery) {
                el.focus();
                el.setSelectionRange(el.value.length, el.value.length);
            }
        }
    }
};
