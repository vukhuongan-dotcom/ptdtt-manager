// ===== STAFF PAGE =====
const STAFF_STATUSES = {
    'active': { label: 'Hoạt động', badge: 'badge-success', icon: '🟢', abbr: '' },
    'leave': { label: 'Nghỉ phép', badge: 'badge-warning', icon: '🟡', abbr: 'NP' },
    'sick': { label: 'Bệnh ốm', badge: 'badge-danger', icon: '🔴', abbr: 'B' },
    'business': { label: 'Công tác', badge: 'badge-accent', icon: '🟣', abbr: 'CT' },
    'dayoff': { label: 'Nghỉ bù', badge: 'badge-info', icon: '🔵', abbr: 'NB' }
};

const StaffPage = {
    currentFilter: 'all',
    searchQuery: '',
    activeTab: 'internal', // 'internal' | 'external' | 'departed' | 'teams'

    render() {
        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Nhân sự</h1>
                <p class="page-subtitle">Quản lý nhân viên khoa Phẫu thuật Đại trực tràng</p>
            </div>
            <div class="staff-toolbar">
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
            <button class="staff-subtab ${this.activeTab === 'teams' ? 'active' : ''}" onclick="StaffPage.switchTab('teams')">
                🏷️ Các tổ đặc trách <span class="staff-subtab-count">${(Store.getAll('specialTeams') || []).length}</span>
            </button>
        </div>

        ${ this.activeTab === 'internal' ? this.renderInternal()
          : this.activeTab === 'external' ? this.renderExternal()
          : this.activeTab === 'teams'    ? this.renderTeams()
          : this.renderDeparted() }
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
            return `<button class="filter-btn ${this.currentFilter === r.key ? 'active' : ''}" onclick="StaffPage.setFilter('${r.key}')">${r.label} (${cnt})</button>`;
        }).join('')}
            </div>
            <div class="staff-toolbar-mid">
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
                        <th class="th-action">Thao tác</th>
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
                        <td class="td-muted">${s.phone || '—'}</td>
                        <td class="td-muted-sm">${s.email || '—'}</td>
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
                <span class="guest-staff-note">Danh sách bác sĩ ngoài khoa hỗ trợ phẫu thuật</span>
            </div>
            <div class="staff-toolbar-mid">
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
                        <th class="th-stt">STT</th>
                        <th>Họ tên</th>
                        <th>Học vị</th>
                        <th>Chức vụ</th>
                        <th>Khoa / Phòng</th>
                        <th>Ghi chú</th>
                        ${isAdmin ? '<th class="th-action">Thao tác</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${filtered.length ? filtered.map((d, idx) => `
                    <tr>
                        <td class="td-center-muted">${idx + 1}</td>
                        <td>
                            <div class="staff-name-cell">
                                <div class="staff-avatar-sm" style="background:${d.color || '#6366f1'}">${Utils.getInitials(d.name)}</div>
                                <span class="staff-fullname">${d.name}</span>
                            </div>
                        </td>
                        <td>${d.title || '—'}</td>
                        <td><span class="badge badge-primary">${d.position || '—'}</span></td>
                        <td class="td-secondary">${d.department || '—'}</td>
                        <td class="td-muted-sm">${d.note || '—'}</td>
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
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
        if (this._composing) {
            clearTimeout(this._searchTimer);
            return;
        }
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
            <div class="status-history-container">
                <label class="form-label">📋 Lịch sử trạng thái</label>
                <div class="status-history-scroll">
                    ${ranges.map(r => {
            return `<div class="status-history-row" style="background:${StaffPage._statusColor(r.status)}15">
                            <div class="status-history-text">
                                <b>${StaffPage._statusLabel(r.status)}</b>
                                <span class="status-history-dates">${StaffPage.fmtDate(r.from)} → ${StaffPage.fmtDate(r.to)}</span>
                                ${r.note ? `<span class="status-history-note">"${r.note}"</span>` : ''}
                            </div>
                            <button type="button" class="btn-icon" onclick="StaffPage.deleteStatusRange(${id},'${r.from}','${r.to}')" title="Xoá">
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
                        <input class="form-input" name="name" value="${s?.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Chức danh</label>
                        <input class="form-input" name="title" value="${s?.title || ''}" required placeholder="BS., ThS. BS, CN. ĐD...">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Vai trò</label>
                        <select class="form-select" name="role">
                            ${'BS Trưởng khoa,BS Phó trưởng khoa,Bác sĩ chính,Bác sĩ học viên,Điều dưỡng trưởng,Điều dưỡng,Hộ lý,Thư ký'.split(',').map(r =>
            `<option value="${r}" ${s?.role === r ? 'selected' : ''}>${r}</option>`
        ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Điện thoại</label>
                        <input class="form-input" name="phone" value="${s?.phone || ''}" placeholder="0901234567">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input class="form-input" type="email" name="email" value="${s?.email || ''}" placeholder="nguyenvana@binhdan.vn">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">${s ? 'Cập nhật' : 'Thêm mới'}</button>
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
            Store.saveCollections(['staff', 'departedStaff']);
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
            Store.saveCollections(['departedStaff']);
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
                        <th class="th-stt">STT</th>
                        <th>Họ tên</th>
                        <th>Chức danh</th>
                        <th>Vai trò</th>
                        <th>Ngày rời</th>
                        ${isAdmin ? '<th class="th-action-wide">Thao tác</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${departed.length ? departed.map((s, idx) => `
                    <tr class="departed-row">
                        <td class="departed-td-center">${idx + 1}</td>
                        <td>
                            <div class="staff-name-cell">
                                <div class="staff-avatar-sm" style="background:${s.color || '#94a3b8'};filter:grayscale(50%)">${Utils.getInitials(s.name)}</div>
                                <span class="staff-fullname">${s.name}</span>
                            </div>
                        </td>
                        <td>${s.title || '—'}</td>
                        <td><span class="badge badge-departed">${s.role}</span></td>
                        <td class="td-muted-sm">${s.departedDate || '—'}</td>
                        ${isAdmin ? `<td>
                            <div class="staff-actions" style="gap:4px">
                                <button class="btn btn-sm btn-restore" onclick="StaffPage.restoreStaff(${idx})" title="Khôi phục">♻️ Khôi phục</button>
                                <button class="btn btn-sm btn-delete-perm" onclick="StaffPage.deletePermanent(${idx})" title="Xóa vĩnh viễn">🗑️ Xóa</button>
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
                        <input class="form-input" name="name" value="${d?.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Học vị</label>
                        <input class="form-input" name="title" value="${d?.title || ''}" placeholder="BSCKII, ThS,...">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Chức vụ</label>
                        <input class="form-input" name="position" value="${d?.position || ''}" placeholder="Phó Giám đốc,...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Khoa / Phòng</label>
                        <input class="form-input" name="department" value="${d?.department || ''}" placeholder="Ngoại Tiêu hoá,...">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Ghi chú</label>
                    <input class="form-input" name="note" value="${d?.note || ''}" placeholder="Ghi chú thêm...">
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
        this._composing = false; // Reset in case compositionend never fired

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
        Utils.loadScript('xlsx')
            .then(() => this._doExportExcel())
            .catch(err => Toast.error('Không tải được thư viện Excel: ' + err.message));
    },

    _doExportExcel() {
        try {
            const wb = XLSX.utils.book_new();
            const staff = Store.getAll('staff');
            const external = Store.getAll('externalDoctors') || [];

            // Sheet 1: Internal staff
            const headers1 = ['STT', 'Họ tên', 'Chức danh', 'Vai trò', 'Cơ hữu', 'SĐT', 'Ghi chú'];
            const data1 = [headers1];
            staff.forEach((s, i) => {
                data1.push([i + 1, s.name, s.title, s.role, s.cơHữu ? 'Có' : 'Không', s.phone || '', s.note || '']);
            });
            const ws1 = XLSX.utils.aoa_to_sheet(data1);
            ws1['!cols'] = [{ wch: 5 }, { wch: 28 }, { wch: 12 }, { wch: 22 }, { wch: 8 }, { wch: 14 }, { wch: 20 }];
            XLSX.utils.book_append_sheet(wb, ws1, 'Nhan vien khoa');

            // Sheet 2: External doctors
            if (external.length > 0) {
                const headers2 = ['STT', 'Họ tên', 'Chức danh', 'Vị trí', 'Khoa/Phòng', 'Ghi chú'];
                const data2 = [headers2];
                external.forEach((d, i) => {
                    data2.push([i + 1, d.name, d.title, d.position || '', d.department || '', d.note || '']);
                });
                const ws2 = XLSX.utils.aoa_to_sheet(data2);
                ws2['!cols'] = [{ wch: 5 }, { wch: 28 }, { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 20 }];
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
    },

    // ===== CÁC TỔ ĐẶC TRÁCH =====
    renderTeams() {
        const teams = (Store.getAll('specialTeams') || []).sort((a, b) => (a.order || 0) - (b.order || 0));
        const allStaff = Store.getAll('staff');
        const isAdmin = Auth.getSession()?.isAdmin;

        const memberHtml = (memberIds) => {
            if (!memberIds || !memberIds.length) return '<span class="team-member-empty">Chưa có thành viên</span>';
            return memberIds.map(sid => {
                const s = allStaff.find(x => x.id === sid);
                if (!s) return '';
                return `<div class="team-member-item">
                    <div class="team-member-avatar" style="background:${s.color || '#6366f1'}">${Utils.getInitials(s.name)}</div>
                    <div class="team-member-info">
                        <span class="team-member-name">${s.name}</span>
                        <span class="team-member-title">${s.title || ''}</span>
                    </div>
                </div>`;
            }).join('');
        };

        const teamCards = teams.length ? teams.map(t => `
            <div class="team-card">
                <div class="team-card-header">
                    <div class="team-card-title-row">
                        <span class="team-card-icon">${t.icon || '🏷️'}</span>
                        <h3 class="team-card-name">${t.name.replace(' & ', '<br>& ')}</h3>
                    </div>
                    ${isAdmin ? `<div class="team-card-actions">
                        <button class="btn-icon" onclick="StaffPage.openTeamForm(${t.id})" title="Sửa tổ">${Utils.editIcon()}</button>
                        <button class="btn-icon" onclick="StaffPage.deleteTeam(${t.id})" title="Xoá tổ">${Utils.deleteIcon()}</button>
                    </div>` : ''}
                </div>
                <div class="team-member-list">
                    ${memberHtml(t.members)}
                </div>
                ${t.note ? `<div class="team-card-note">📝 ${t.note}</div>` : ''}
            </div>
        `).join('') : `<div class="empty-state"><p>Chưa có tổ đặc trách nào</p></div>`;

        return `
        <div class="team-page-header">
            <p class="team-page-desc">Các tổ nhân sự đặc trách theo từng mảng công tác của khoa</p>
            <div style="display:flex;gap:8px;align-items:center">
                <button class="btn btn-secondary" onclick="StaffPage.exportTeamImage()" title="Xuất hình danh sách các tổ">
                    📷 Xuất hình
                </button>
                ${isAdmin ? `<button class="btn btn-primary" onclick="StaffPage.openTeamForm()">
                    ${Utils.plusIcon()} Thêm tổ
                </button>` : ''}
            </div>
        </div>
        <div class="team-grid" id="team-export-grid">${teamCards}</div>
        `;
    },

    openTeamForm(id) {
        if (!Auth.getSession()?.isAdmin) return;
        const teams = Store.getAll('specialTeams') || [];
        const t = id ? teams.find(x => x.id === id) : null;
        const allStaff = Store.getAll('staff');
        const memberIds = t?.members || [];

        const staffOptions = allStaff.map(s =>
            `<option value="${s.id}" ${memberIds.includes(s.id) ? 'selected' : ''}>${s.title} ${s.name} — ${s.role}</option>`
        ).join('');

        const ICONS = ['🔬','📋','📅','🤝','🎨','💻','🏥','📊','🔑','⚕️','📌','🩺'];
        const iconOptions = ICONS.map(ic =>
            `<option value="${ic}" ${(t?.icon || '') === ic ? 'selected' : ''}>${ic}</option>`
        ).join('');

        Modal.open(t ? 'Sửa tổ đặc trách' : 'Thêm tổ đặc trách', `
            <form onsubmit="StaffPage.saveTeam(event, ${id || 0})">
                <div class="form-row">
                    <div class="form-group" style="flex:0 0 80px">
                        <label class="form-label">Icon</label>
                        <select class="form-select" name="icon" id="team-icon-sel">${iconOptions}</select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tên tổ</label>
                        <input class="form-input" name="name" value="${t?.name || ''}" required placeholder="VD: Nghiên cứu khoa học">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Thành viên <span style="color:var(--text-muted);font-weight:400">(giữ Ctrl/Cmd để chọn nhiều)</span></label>
                    <select class="form-select" name="members" id="team-members-sel" multiple size="8" style="height:auto">
                        ${staffOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Ghi chú</label>
                    <input class="form-input" name="note" value="${t?.note || ''}" placeholder="Ghi chú thêm nếu có...">
                </div>
                <div class="form-group">
                    <label class="form-label">Thứ tự hiển thị</label>
                    <input class="form-input" type="number" name="order" value="${t?.order || (teams.length + 1)}" min="1">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">${t ? 'Cập nhật' : 'Thêm tổ'}</button>
                </div>
            </form>
        `);
    },

    saveTeam(e, id) {
        if (!Auth.getSession()?.isAdmin) return;
        e.preventDefault();
        const form = new FormData(e.target);
        const sel = document.getElementById('team-members-sel');
        const memberIds = sel ? Array.from(sel.selectedOptions).map(o => parseInt(o.value)) : [];
        const data = {
            name: form.get('name'),
            icon: form.get('icon') || '🏷️',
            members: memberIds,
            note: form.get('note') || '',
            order: parseInt(form.get('order')) || 1
        };
        if (id) {
            Store.update('specialTeams', id, data);
        } else {
            Store.add('specialTeams', data);
        }
        Store.saveCollections(['specialTeams']);
        Modal.close();
        App.renderCurrentPage();
        Toast.success(id ? 'Đã cập nhật tổ đặc trách' : 'Đã thêm tổ đặc trách mới');
    },

    async exportTeamImage() {
        const teams = (Store.getAll('specialTeams') || []).sort((a, b) => (a.order || 0) - (b.order || 0));
        const allStaff = Store.getAll('staff');
        const session = Auth.getSession();
        const now = new Date();
        const dateLabel = now.toLocaleDateString('vi-VN');
        const timeLabel = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const userName = session?.name || session?.username || 'Hệ thống';

        // Build card HTML cho từng tổ
        const cardHtml = teams.map(t => {
            const memberRows = (t.members || []).map(sid => {
                const s = allStaff.find(x => x.id === sid);
                if (!s) return '';
                // Initials cho avatar
                const parts = s.name.split(' ');
                const initials = parts.length >= 2
                    ? parts[parts.length - 2][0] + parts[parts.length - 1][0]
                    : s.name.substring(0, 2);
                return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                    <div style="width:34px;height:34px;border-radius:50%;background:${s.color || '#6366f1'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:#fff;flex-shrink:0">${initials.toUpperCase()}</div>
                    <div>
                        <div style="font-size:13px;font-weight:600;color:#0f172a;line-height:1.3">${s.name}</div>
                        <div style="font-size:11px;color:#64748b">${s.title || ''}</div>
                    </div>
                </div>`;
            }).join('');

            return `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;break-inside:avoid">
                <div style="background:rgba(8,145,178,0.06);border-bottom:1px solid #e2e8f0;padding:14px 16px 10px;display:flex;align-items:flex-start;gap:8px;min-height:64px">
                    <span style="font-size:20px;line-height:1.2;flex-shrink:0">${t.icon || '🏷️'}</span>
                    <div style="font-size:13px;font-weight:700;color:#0e7490;line-height:1.4">${t.name}</div>
                </div>
                <div style="padding:12px 16px">
                    ${memberRows || '<div style="font-size:12px;color:#94a3b8;font-style:italic">Chưa có thành viên</div>'}
                    ${t.note ? `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #e2e8f0;font-size:11px;color:#64748b">📝 ${t.note}</div>` : ''}
                </div>
            </div>`;
        }).join('');

        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
        container.innerHTML = `
        <div id="team-export-target" style="width:1100px;padding:0;background:#fff;font-family:'Inter',sans-serif;color:#0f172a;">
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:24px 36px;display:flex;justify-content:space-between;align-items:center">
                <div>
                    <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px">KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG</div>
                    <div style="font-size:14px;color:#cbd5e1;margin-top:3px">Bệnh viện Bình Dân</div>
                </div>
                <div style="text-align:right">
                    <div style="font-size:20px;font-weight:700;color:#ffffff">CÁC TỔ ĐẶC TRÁCH</div>
                    <div style="font-size:14px;color:#67e8f9;font-weight:600">${teams.length} tổ · ${teams.reduce((sum, t) => sum + (t.members?.length || 0), 0)} thành viên</div>
                </div>
            </div>

            <!-- Summary bar -->
            <div style="padding:12px 36px;background:#f0f9ff;border-bottom:2px solid #bae6fd;display:flex;align-items:center;gap:12px">
                ${teams.map(t => `<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#0f172a;font-weight:600">
                    <span>${t.icon || '🏷️'}</span>${t.name.split('&')[0].trim()}
                </span>`).join('<span style="color:#cbd5e1">·</span>')}
            </div>

            <!-- Cards grid -->
            <div style="padding:20px 36px 24px">
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
                    ${cardHtml}
                </div>
            </div>

            <!-- Footer -->
            <div style="padding:12px 36px;border-top:2px solid #cbd5e1;display:flex;justify-content:space-between;font-size:12px;color:#333;background:#f8fafc">
                <span>Xuất bởi: ${userName}</span>
                <span>Xuất lúc ${timeLabel} ngày ${dateLabel}</span>
            </div>
        </div>`;

        document.body.appendChild(container);
        const target = container.querySelector('#team-export-target');
        try {
            await Utils.loadScript('html2canvas');
            const canvasEl = await html2canvas(target, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
            Utils.applyExportWatermark(canvasEl);
            canvasEl.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `To_DacTrach_KhoaPTDTT_${dateLabel.replace(/\//g, '-')}.jpg`;
                a.click();
                URL.revokeObjectURL(url);
                document.body.removeChild(container);
                Toast.success('Đã xuất hình các tổ đặc trách!');
            }, 'image/jpeg', 0.95);
        } catch (err) {
            console.error('Export team image failed:', err);
            Toast.error('Không thể xuất ảnh. Vui lòng thử lại.');
            document.body.removeChild(container);
        }
    },

    async deleteTeam(id) {
        if (!Auth.getSession()?.isAdmin) return;
        const teams = Store.getAll('specialTeams') || [];
        const t = teams.find(x => x.id === id);
        if (!t) return;
        const confirmed = await Confirm.show({
            title: 'Xoà tổ đặc trách',
            message: `Xoà tổ <strong>${t.name}</strong>?<br>Hành động này không thể hoàn tác.`,
            icon: '🗑️',
            type: 'danger',
            confirmText: 'Xoà tổ',
            cancelText: 'Giữ lại'
        });
        if (confirmed) {
            Store.remove('specialTeams', id);
            Store.saveCollections(['specialTeams']);
            App.renderCurrentPage();
            Toast.success(`Đã xoà tổ ${t.name}`);
        }
    }
};
