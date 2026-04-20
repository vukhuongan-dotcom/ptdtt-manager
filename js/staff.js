// ===== STAFF PAGE =====
const STAFF_STATUSES = {
    'active':    { label: 'Hoạt động', badge: 'badge-success', icon: '🟢', abbr: '' },
    'leave':     { label: 'Nghỉ phép', badge: 'badge-warning', icon: '🟡', abbr: 'NP' },
    'sick':      { label: 'Bệnh ốm',  badge: 'badge-danger',  icon: '🔴', abbr: 'B' },
    'business':  { label: 'Công tác',  badge: 'badge-accent',  icon: '🟣', abbr: 'CT' },
    'dayoff':    { label: 'Nghỉ bù',   badge: 'badge-info',    icon: '🔵', abbr: 'NB' }
};

const StaffPage = {
    currentFilter: 'all',
    searchQuery: '',
    activeTab: 'internal', // 'internal' | 'external' | 'departed'

    render() {
        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Nhân sự</h1>
                <p class="page-subtitle">Quản lý nhân viên khoa Phẫu thuật Đại trực tràng</p>
            </div>
            <div style="display:flex;gap:8px">
                ${(Auth.getSession() && Auth.getSession().isAdmin) ? `<button class="export-btn" onclick="StaffPage.exportExcel()" title="Xuất danh sách nhân sự">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    Xuất Excel
                </button>` : ''}
            </div>
        </div>

        <div class="staff-subtabs">
            <button class="staff-subtab ${this.activeTab === 'internal' ? 'active' : ''}" onclick="StaffPage.switchTab('internal')">
                👥 Nhân viên khoa <span class="staff-subtab-count">${Store.getAll('staff').length}</span>
            </button>
            <button class="staff-subtab ${this.activeTab === 'external' ? 'active' : ''}" onclick="StaffPage.switchTab('external')">
                🩺 BS ngoài khoa <span class="staff-subtab-count">${Store.getAll('externalDoctors').length}</span>
            </button>
            <button class="staff-subtab ${this.activeTab === 'departed' ? 'active' : ''}" onclick="StaffPage.switchTab('departed')">
                📤 Rời khoa <span class="staff-subtab-count">${(Store.getAll('departedStaff') || []).length}</span>
            </button>
        </div>

        ${this.activeTab === 'internal' ? this.renderInternal() : this.activeTab === 'external' ? this.renderExternal() : this.renderDeparted()}
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
        const session = Auth.getSession();
        const isAdmin = session?.isAdmin;
        const myStaffId = session?.staffId;
        const today = this._dateStr(new Date());

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
                        <th style="width:80px">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    ${staff.length ? staff.map(s => {
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
                            <div class="staff-actions">
                                ${isAdmin ? `
                                <button class="btn-icon" onclick="StaffPage.openForm(${s.id})" title="Sửa">${Utils.editIcon()}</button>
                                <button class="btn-icon" onclick="StaffPage.delete(${s.id})" title="Xoá">${Utils.deleteIcon()}</button>
                                ` : (s.id === myStaffId ? `
                                <button class="btn-icon" onclick="StaffPage.openContactForm(${s.id})" title="Cập nhật SĐT / Email">${Utils.editIcon()}</button>
                                ` : '')}
                            </div>
                        </td>
                    </tr>`;
                    }).join('') : `<tr><td colspan="6"><div class="empty-state"><p>Không tìm thấy nhân sự</p></div></td></tr>`}
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


    // Determine effective status — check per-day entries first, then staff object fallback
    getEffectiveStatus(staff, today) {
        // Priority: per-day staffStatuses entries
        const entries = Store.getAll('staffStatuses') || [];
        const dayEntry = entries.find(e => e.staffId === staff.id && e.date === today);
        if (dayEntry && dayEntry.status !== 'active') {
            // Find the range this belongs to
            const range = this._findStatusRange(staff.id, today, entries);
            return { status: dayEntry.status, fromDate: range.from, toDate: range.to };
        }
        // Fallback: staff object (legacy data)
        if (staff.statusType && staff.statusType !== 'active' && staff.statusFrom && staff.statusTo) {
            if (today >= staff.statusFrom && today <= staff.statusTo) {
                return { status: staff.statusType, fromDate: staff.statusFrom, toDate: staff.statusTo };
            }
        }
        return { status: 'active', fromDate: null, toDate: null };
    },

    // Find contiguous date range for same status
    _findStatusRange(staffId, dateStr, entries) {
        const staffEntries = entries.filter(e => e.staffId === staffId);
        const target = staffEntries.find(e => e.date === dateStr);
        if (!target) return { from: dateStr, to: dateStr };
        const status = target.status;
        let from = dateStr, to = dateStr;
        // Expand backward
        let d = new Date(dateStr);
        while (true) {
            d.setDate(d.getDate() - 1);
            const ds = this._dateStr(d);
            const e = staffEntries.find(x => x.date === ds && x.status === status);
            if (e) from = ds; else break;
        }
        // Expand forward
        d = new Date(dateStr);
        while (true) {
            d.setDate(d.getDate() + 1);
            const ds = this._dateStr(d);
            const e = staffEntries.find(x => x.date === ds && x.status === status);
            if (e) to = ds; else break;
        }
        return { from, to };
    },

    _dateStr(d) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
        const today = this._dateStr(new Date());

        // Get existing status entries for this staff
        const entries = (Store.getAll('staffStatuses') || []).filter(e => e.staffId === id && e.status !== 'active');
        // Group consecutive same-status entries into ranges
        const ranges = this._groupStatusRanges(entries);

        const historyHtml = ranges.length ? `
            <div style="margin-bottom:12px">
                <label class="form-label" style="margin-bottom:6px">📋 Lịch sử trạng thái</label>
                <div style="max-height:140px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:6px">
                    ${ranges.map(r => {
                        const info = STAFF_STATUSES[r.status] || STAFF_STATUSES.active;
                        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;border-radius:6px;margin-bottom:3px;background:${StaffPage._statusColor(r.status)}15">
                            <div style="font-size:0.8rem">
                                <span>${info.icon} ${info.label}</span>
                                <span style="color:var(--text-muted);margin-left:6px">${StaffPage.fmtDate(r.from)} → ${StaffPage.fmtDate(r.to)}</span>
                                ${r.note ? `<span style="color:var(--text-secondary);margin-left:4px;font-style:italic">"${r.note}"</span>` : ''}
                            </div>
                            <button type="button" class="btn-icon" onclick="StaffPage.deleteStatusRange(${id},'${r.from}','${r.to}')" title="Xoá" style="flex-shrink:0">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                        </div>`;
                    }).join('')}
                </div>
            </div>` : '';

        Modal.open(`Cập nhật trạng thái — ${s.name}`, `
            <form onsubmit="StaffPage.saveStatus(event, ${id})">
                ${historyHtml}
                <div style="${ranges.length ? 'border-top:1px solid var(--border);padding-top:12px;margin-top:4px' : ''}">
                    <label class="form-label" style="margin-bottom:6px">${ranges.length ? '➕ Thêm trạng thái mới' : 'Trạng thái'}</label>
                    <div class="form-group">
                        <select class="form-select" name="statusType" id="status-type-select" onchange="StaffPage.toggleDateFields()">
                            ${Object.entries(STAFF_STATUSES).map(([key, val]) =>
                                `<option value="${key}" ${key === 'active' ? 'selected' : ''}>${val.icon} ${val.label}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div id="status-date-fields" style="display:none">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Từ ngày</label>
                                <input class="form-input" type="date" name="statusFrom" value="${today}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Đến ngày</label>
                                <input class="form-input" type="date" name="statusTo" value="${today}">
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ghi chú</label>
                        <input class="form-input" name="statusNote" placeholder="Lý do nghỉ, nơi công tác...">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">${ranges.length ? 'Thêm trạng thái' : 'Cập nhật'}</button>
                </div>
            </form>
        `);
    },

    _statusColor(status) {
        const map = { active: '#22c55e', leave: '#eab308', sick: '#ef4444', business: '#a855f7', dayoff: '#3b82f6' };
        return map[status] || '#22c55e';
    },

    // Group per-day entries into contiguous date ranges with same status
    _groupStatusRanges(entries) {
        if (!entries.length) return [];
        const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
        const ranges = [];
        let current = { status: sorted[0].status, from: sorted[0].date, to: sorted[0].date, note: sorted[0].note || '' };
        for (let i = 1; i < sorted.length; i++) {
            const e = sorted[i];
            const prevDate = new Date(current.to);
            prevDate.setDate(prevDate.getDate() + 1);
            const nextDay = this._dateStr(prevDate);
            if (e.status === current.status && e.date === nextDay) {
                current.to = e.date;
            } else {
                ranges.push(current);
                current = { status: e.status, from: e.date, to: e.date, note: e.note || '' };
            }
        }
        ranges.push(current);
        return ranges;
    },

    toggleDateFields() {
        const sel = document.getElementById('status-type-select');
        const fields = document.getElementById('status-date-fields');
        if (sel && fields) {
            fields.style.display = sel.value === 'active' ? 'none' : '';
        }
    },

    // Save status as per-day entries in staffStatuses[]
    saveStatus(e, id) {
        if (!Auth.getSession()?.isAdmin) return;
        e.preventDefault();
        const f = new FormData(e.target);
        const statusType = f.get('statusType');
        const note = f.get('statusNote') || '';
        const today = this._dateStr(new Date());

        if (statusType === 'active') {
            // Clear all per-day entries for this staff
            let entries = [...(Store.getAll('staffStatuses') || [])];
            entries = entries.filter(e => e.staffId !== id);
            Store.replaceCollection('staffStatuses', entries);
            Store.syncStaffLegacyStatus(id, today);
        } else {
            const fromDate = f.get('statusFrom');
            const toDate = f.get('statusTo');
            if (!fromDate || !toDate || fromDate > toDate) {
                Toast.warning('Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc');
                return;
            }

            // Generate per-day entries
            let entries = [...(Store.getAll('staffStatuses') || [])];
            const d = new Date(fromDate);
            const end = new Date(toDate);
            while (d <= end) {
                const ds = this._dateStr(d);
                const idx = entries.findIndex(e => e.staffId === id && e.date === ds);
                const entry = { staffId: id, date: ds, status: statusType, note };
                if (idx !== -1) {
                    entries[idx] = entry;
                } else {
                    entries.push(entry);
                }
                d.setDate(d.getDate() + 1);
            }
            Store.replaceCollection('staffStatuses', entries);
            Store.syncStaffLegacyStatus(id, today);
        }

        Store.saveCollections(['staffStatuses', 'staff']);
        Modal.close();
        App.renderCurrentPage();
        Toast.success('Đã cập nhật trạng thái');
    },

    // Delete a status range
    deleteStatusRange(staffId, fromDate, toDate) {
        let entries = [...(Store.getAll('staffStatuses') || [])];
        entries = entries.filter(e => !(e.staffId === staffId && e.date >= fromDate && e.date <= toDate));
        Store.replaceCollection('staffStatuses', entries);
        Store.syncStaffLegacyStatus(staffId, this._dateStr(new Date()));
        Store.saveCollections(['staffStatuses', 'staff']);
        // Refresh form
        this.openStatusForm(staffId);
        Toast.success('Đã xoá trạng thái');
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
            Toast.success(`Tài khoản: <strong>${cred.username}</strong><br>Mật khẩu: <strong>${cred.password}</strong>`, 'Đã tạo nhân sự mới');
        }
    },

    async delete(id) {
        if (!Auth.getSession()?.isAdmin) return;
        const s = Store.getById('staff', id);
        if (!s) return;
        const confirmed = await Confirm.show({
            title: 'Chuyển nhân sự rời khoa',
            message: `Bạn có chắc chắn muốn chuyển <strong>${s.name}</strong> vào danh sách rời khoa?<br>Tài khoản đăng nhập sẽ bị vô hiệu hoá.<br><em>Có thể khôi phục sau.</em>`,
            icon: '📤',
            type: 'danger',
            confirmText: 'Chuyển rời khoa',
            cancelText: 'Giữ lại'
        });
        if (confirmed) {
            // Move to departedStaff
            const departed = { ...s, departedDate: this._dateStr(new Date()) };
            if (!Store._data.departedStaff) Store._data.departedStaff = [];
            if (!Store._data.nextIds.departedStaff) Store._data.nextIds.departedStaff = 1;
            Store._data.departedStaff.push(departed);
            // Remove from active staff
            Store.remove('staff', id);
            // Disable account
            Auth.disableAccount(id);
            Modal.close();
            App.renderCurrentPage();
            Toast.success(`Đã chuyển ${s.name} vào danh sách rời khoa`);
        }
    },

    // Restore departed staff back to active
    async restoreStaff(index) {
        if (!Auth.getSession()?.isAdmin) return;
        const departed = Store._data.departedStaff || [];
        if (index < 0 || index >= departed.length) return;
        const s = departed[index];
        const confirmed = await Confirm.show({
            title: 'Khôi phục nhân sự',
            message: `Khôi phục <strong>${s.name}</strong> vào danh sách nhân viên khoa?<br>Tài khoản đăng nhập sẽ được kích hoạt lại.`,
            icon: '♻️',
            type: 'primary',
            confirmText: 'Khôi phục',
            cancelText: 'Huỷ'
        });
        if (confirmed) {
            // Remove departedDate
            const restored = { ...s };
            delete restored.departedDate;
            // Add back to staff
            Store._data.staff.push(restored);
            // Remove from departed
            Store._data.departedStaff.splice(index, 1);
            Store.save();
            // Re-enable account
            Auth.enableAccount(restored.id);
            Auth.refreshAccounts();
            App.renderCurrentPage();
            Toast.success(`Đã khôi phục ${s.name} vào nhân viên khoa`);
        }
    },

    // Permanently delete departed staff
    async deletePermanent(index) {
        if (!Auth.getSession()?.isAdmin) return;
        const departed = Store._data.departedStaff || [];
        if (index < 0 || index >= departed.length) return;
        const s = departed[index];
        const confirmed = await Confirm.show({
            title: 'Xóa vĩnh viễn',
            message: `Xóa vĩnh viễn <strong>${s.name}</strong>?<br>Hành động này không thể hoàn tác!`,
            icon: '🗑️',
            type: 'danger',
            confirmText: 'Xóa vĩnh viễn',
            cancelText: 'Giữ lại'
        });
        if (confirmed) {
            Store._data.departedStaff.splice(index, 1);
            Store.save();
            Auth.removeAccount(s.id);
            App.renderCurrentPage();
            Toast.success(`Đã xóa vĩnh viễn ${s.name}`);
        }
    },

    // Render departed staff tab
    renderDeparted() {
        const departed = Store._data.departedStaff || [];
        const isAdmin = Auth.getSession()?.isAdmin;

        return `
        <div class="flex justify-between items-center">
            <div class="staff-filters">
                <span style="color:var(--text-muted);font-size:0.85rem;padding:6px 12px">Nhân sự đã rời khoa — có thể khôi phục</span>
            </div>
        </div>

        <div class="card staff-table-card">
            <table>
                <thead>
                    <tr>
                        <th style="width:50px">STT</th>
                        <th>Họ tên</th>
                        <th>Chức danh</th>
                        <th>Vai trò</th>
                        <th>Ngày rời</th>
                        ${isAdmin ? '<th style="width:160px">Thao tác</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${departed.length ? departed.map((s, idx) => `
                    <tr style="opacity:0.75">
                        <td style="text-align:center;color:var(--text-muted)">${idx + 1}</td>
                        <td>
                            <div class="staff-name-cell">
                                <div class="staff-avatar-sm" style="background:${s.color || '#94a3b8'};filter:grayscale(50%)">${Utils.getInitials(s.name)}</div>
                                <span class="staff-fullname">${s.name}</span>
                            </div>
                        </td>
                        <td>${s.title || '—'}</td>
                        <td><span class="badge" style="background:#94a3b8;color:#fff">${s.role}</span></td>
                        <td style="color:var(--text-muted);font-size:0.82rem">${s.departedDate || '—'}</td>
                        ${isAdmin ? `<td>
                            <div class="staff-actions" style="gap:4px">
                                <button class="btn btn-sm" style="background:#22c55e;color:#fff;border:none;font-size:0.72rem;cursor:pointer" onclick="StaffPage.restoreStaff(${idx})" title="Khôi phục">♻️ Khôi phục</button>
                                <button class="btn btn-sm" style="background:#ef4444;color:#fff;border:none;font-size:0.72rem;cursor:pointer" onclick="StaffPage.deletePermanent(${idx})" title="Xóa vĩnh viễn">🗑️ Xóa</button>
                            </div>
                        </td>` : ''}
                    </tr>`).join('') : `<tr><td colspan="6"><div class="empty-state"><p>Không có nhân sự rời khoa</p></div></td></tr>`}
                </tbody>
            </table>
        </div>
        `;
    },

    // ===== SELF-EDIT CONTACT (Phone & Email) =====
    openContactForm(id) {
        const session = Auth.getSession();
        if (!session || session.staffId !== id) return;
        const s = Store.getById('staff', id);
        if (!s) return;
        Modal.open(`Cập nhật liên lạc — ${s.name}`, `
            <form onsubmit="StaffPage.saveContact(event, ${id})">
                <div class="form-group">
                    <label class="form-label">Điện thoại</label>
                    <input class="form-input" name="phone" value="${s.phone || ''}" placeholder="0901234567">
                </div>
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input class="form-input" type="email" name="email" value="${s.email || ''}" placeholder="nguyenvana@binhdan.vn">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">Cập nhật</button>
                </div>
            </form>
        `);
    },

    saveContact(e, id) {
        const session = Auth.getSession();
        if (!session || session.staffId !== id) return;
        e.preventDefault();
        const form = new FormData(e.target);
        Store.update('staff', id, {
            phone: form.get('phone'),
            email: form.get('email')
        });
        Modal.close();
        App.renderCurrentPage();
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

    async deleteExternal(id) {
        if (!Auth.getSession()?.isAdmin) return;
        const docs = Store.getAll('externalDoctors') || [];
        const d = docs.find(x => x.id === id);
        if (!d) return;
        const confirmed = await Confirm.delete(d.name);
        if (confirmed) {
            Store.remove('externalDoctors', id);
            App.renderCurrentPage();
            Toast.success(`Đã xóa BS ngoài khoa ${d.name}`);
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
    },

    exportExcel() {
        if (typeof XLSX === 'undefined') {
            Toast.error('Thư viện Excel chưa được tải. Vui lòng thử lại.');
            return;
        }
        try {
            const wb = XLSX.utils.book_new();
            const staff = Store.getAll('staff');
            const external = Store.getAll('externalDoctors') || [];

            // Sheet 1: Internal staff
            const headers1 = ['STT', 'Họ tên', 'Chức danh', 'Vai trò', 'Cơ hữu', 'SĐT', 'Ghi chú'];
            const data1 = [headers1];
            staff.forEach((s, i) => {
                data1.push([i+1, s.name, s.title, s.role, s.cơHữu ? 'Có' : 'Không', s.phone || '', s.note || '']);
            });
            const ws1 = XLSX.utils.aoa_to_sheet(data1);
            ws1['!cols'] = [{wch:5},{wch:28},{wch:12},{wch:22},{wch:8},{wch:14},{wch:20}];
            XLSX.utils.book_append_sheet(wb, ws1, 'Nhan vien khoa');

            // Sheet 2: External doctors
            if (external.length > 0) {
                const headers2 = ['STT', 'Họ tên', 'Chức danh', 'Vị trí', 'Khoa/Phòng', 'Ghi chú'];
                const data2 = [headers2];
                external.forEach((d, i) => {
                    data2.push([i+1, d.name, d.title, d.position || '', d.department || '', d.note || '']);
                });
                const ws2 = XLSX.utils.aoa_to_sheet(data2);
                ws2['!cols'] = [{wch:5},{wch:28},{wch:12},{wch:18},{wch:20},{wch:20}];
                XLSX.utils.book_append_sheet(wb, ws2, 'BS ngoai khoa');
            }

            // Blob-based download
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'DanhSach_NhanSu_KhoaPTDTT.xlsx';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
            Toast.success('Đã xuất danh sách nhân sự thành công!');
        } catch (e) {
            console.error('Export Excel error:', e);
            Toast.error('Lỗi xuất Excel: ' + e.message);
        }
    }
};
