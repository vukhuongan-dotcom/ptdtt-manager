// ===== TASK CATEGORIES =====
const TASK_CATEGORIES = {
    'surgery':      { label: 'Phẫu thuật', icon: '🔪', color: '#ef4444' },
    'clinic':       { label: 'Khám & Điều trị', icon: '🩺', color: '#3b82f6' },
    'duty':         { label: 'Trực', icon: '🏥', color: '#8b5cf6' },
    'meeting':      { label: 'Họp', icon: '📋', color: '#06b6d4' },
    'report':       { label: 'Báo cáo', icon: '📊', color: '#f59e0b' },
    'hr':           { label: 'Nhân sự', icon: '👥', color: '#ec4899' },
    'training':     { label: 'Đào tạo', icon: '📚', color: '#10b981' },
    'research':     { label: 'Nghiên cứu', icon: '🔬', color: '#14b8a6' },
    'equipment':    { label: 'Trang thiết bị', icon: '🔧', color: '#f97316' },
    'quality':      { label: 'Chất lượng & ATNB', icon: '✅', color: '#6366f1' },
    'other':        { label: 'Khác', icon: '📌', color: '#64748b' }
};

// ===== TASKS (KANBAN) PAGE =====
const TasksPage = {
    draggedId: null,
    currentFilter: 'all',
    showTrash: false,

    isBCN() {
        const session = Auth.getSession();
        if (!session) return false;
        return session.role?.includes('Trưởng khoa') || session.role?.includes('Phó trưởng khoa');
    },

    getTrash() {
        return Store.getAll('tasksTrash') || [];
    },

    render() {
        if (this.showTrash) return this.renderTrash();

        const allTasks = Store.getAll('tasks');
        const filtered = this.currentFilter === 'all'
            ? allTasks
            : allTasks.filter(t => t.category === this.currentFilter);
        const todo = filtered.filter(t => t.status === 'todo');
        const doing = filtered.filter(t => t.status === 'doing');
        const done = filtered.filter(t => t.status === 'done');
        const isAdmin = Auth.getSession()?.isAdmin;
        const trashCount = this.getTrash().length;

        // Count by category
        const catCounts = {};
        allTasks.forEach(t => { catCounts[t.category || 'other'] = (catCounts[t.category || 'other'] || 0) + 1; });

        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Công việc</h1>
                <p class="page-subtitle">Quản lý công việc theo bảng Kanban</p>
            </div>
            <div style="display:flex;gap:8px">
                ${trashCount > 0 ? `<button class="btn btn-secondary" onclick="TasksPage.toggleTrash()">
                    🗑️ Thùng rác (${trashCount})
                </button>` : ''}
                ${isAdmin ? `<button class="btn btn-primary" onclick="TasksPage.openForm()">
                    ${Utils.plusIcon()} Thêm công việc
                </button>` : ''}
            </div>
        </div>

        <div class="task-category-filters">
            <button class="filter-chip ${this.currentFilter==='all'?'active':''}" onclick="TasksPage.setFilter('all')">
                Tất cả <span class="chip-count">${allTasks.length}</span>
            </button>
            ${Object.entries(TASK_CATEGORIES).map(([key, cat]) => {
                const cnt = catCounts[key] || 0;
                if (cnt === 0 && this.currentFilter !== key) return '';
                return `<button class="filter-chip ${this.currentFilter===key?'active':''}" onclick="TasksPage.setFilter('${key}')" style="--chip-color:${cat.color}">
                    ${cat.icon} ${cat.label} <span class="chip-count">${cnt}</span>
                </button>`;
            }).join('')}
        </div>

        <div class="kanban-board">
            <div class="kanban-column" ondragover="event.preventDefault()" ondrop="TasksPage.drop(event,'todo')">
                <div class="kanban-column-header">
                    <span class="kanban-column-title"><span class="dot dot-warning"></span> Chờ xử lý</span>
                    <span class="kanban-count">${todo.length}</span>
                </div>
                <div class="kanban-cards">${todo.map(t => this.renderCard(t, isAdmin)).join('')}</div>
            </div>
            <div class="kanban-column" ondragover="event.preventDefault()" ondrop="TasksPage.drop(event,'doing')">
                <div class="kanban-column-header">
                    <span class="kanban-column-title"><span class="dot dot-primary"></span> Đang thực hiện</span>
                    <span class="kanban-count">${doing.length}</span>
                </div>
                <div class="kanban-cards">${doing.map(t => this.renderCard(t, isAdmin)).join('')}</div>
            </div>
            <div class="kanban-column" ondragover="event.preventDefault()" ondrop="TasksPage.drop(event,'done')">
                <div class="kanban-column-header">
                    <span class="kanban-column-title"><span class="dot dot-success"></span> Hoàn thành</span>
                    <span class="kanban-count">${done.length}</span>
                </div>
                <div class="kanban-cards">${done.map(t => this.renderCard(t, isAdmin)).join('')}</div>
            </div>
        </div>
        `;
    },

    setFilter(f) { this.currentFilter = f; App.renderCurrentPage(); },

    renderCard(t, isAdmin) {
        const days = Utils.daysFromNow(t.deadline);
        const deadlineText = days < 0 ? `Quá hạn ${-days} ngày` : days === 0 ? 'Hôm nay' : `Còn ${days} ngày`;
        const deadlineClass = days < 0 ? 'color:var(--danger)' : days <= 2 ? 'color:var(--warning)' : '';
        const cat = TASK_CATEGORIES[t.category] || TASK_CATEGORIES.other;
        const assignerName = t.assigner ? Utils.getStaffName(t.assigner) : '';
        const session = Auth.getSession();
        const isMyTask = session && t.assignee === session.staffId;
        const canClick = (isMyTask && !isAdmin) || (t.status === 'done');

        return `
        <div class="task-card ${canClick ? 'task-card-clickable' : ''}" draggable="${isAdmin ? 'true' : 'false'}" ondragstart="TasksPage.dragStart(event,${t.id})" ondragend="TasksPage.dragEnd(event)" ${canClick ? `onclick="TasksPage.viewTask(${t.id})"` : ''}>
            <div class="priority-bar priority-${t.priority}"></div>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
                <div class="task-card-title">${t.title}</div>
                <span class="task-cat-badge" style="background:${cat.color}15;color:${cat.color};border:1px solid ${cat.color}30">${cat.icon} ${cat.label}</span>
            </div>
            <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">${t.desc || ''}</p>
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center">
                <span class="badge ${Utils.priorityBadge(t.priority)}">${Utils.priorityLabel(t.priority)}</span>
                ${t.startDate ? `<span style="font-size:0.7rem;color:var(--text-muted)">📅 ${Utils.formatDateShort(t.startDate)}</span>` : ''}
                ${assignerName ? `<span style="font-size:0.7rem;color:var(--text-muted)">👤 ${assignerName}</span>` : ''}
                ${t.completedAt ? `<span style="font-size:0.7rem;color:var(--success)">✅ ${Utils.formatDateShort(t.completedAt)}</span>` : ''}
            </div>
            <div class="task-card-meta">
                <div class="task-card-assignee">
                    <div class="task-card-assignee-avatar" style="background:${Utils.getStaffColor(t.assignee)}">${Utils.getInitials(Utils.getStaffName(t.assignee))}</div>
                    ${Utils.getStaffName(t.assignee)}
                </div>
                <span class="task-card-deadline" style="${t.status === 'done' ? 'color:var(--success)' : deadlineClass}">${t.status === 'done' && t.completedAt ? '✅ ' + Utils.formatDateShort(t.completedAt) : deadlineText}</span>
            </div>
            ${isAdmin ? `<div class="task-card-actions" onmousedown="event.stopPropagation()">
                <button type="button" class="btn-icon btn-sm" draggable="false" onclick="event.preventDefault();event.stopPropagation();TasksPage.openForm(${t.id})">${Utils.editIcon()}</button>
                <button type="button" class="btn-icon btn-sm task-delete-btn" draggable="false" onclick="event.preventDefault();event.stopPropagation();TasksPage.moveToTrash(${t.id})">${Utils.deleteIcon()}</button>
            </div>` : ''}
        </div>`;
    },

    // ===== TRASH =====
    toggleTrash() {
        this.showTrash = !this.showTrash;
        App.renderCurrentPage();
    },

    renderTrash() {
        const trash = this.getTrash();
        const canDelete = Auth.getSession()?.isAdmin;

        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">🗑️ Thùng rác</h1>
                <p class="page-subtitle">${trash.length} công việc đã xoá</p>
            </div>
            <div style="display:flex;gap:8px">
                ${canDelete && trash.length > 0 ? `<button class="btn btn-danger" onclick="TasksPage.confirmEmptyTrash()">Xoá tất cả vĩnh viễn</button>` : ''}
                <button class="btn btn-secondary" onclick="TasksPage.toggleTrash()">← Quay lại</button>
            </div>
        </div>
        <div class="card" style="padding:0;overflow:hidden">
            <table>
                <thead>
                    <tr>
                        <th>Tiêu đề</th>
                        <th>Phân loại</th>
                        <th>Người phụ trách</th>
                        <th>Ngày xoá</th>
                        <th style="width:140px">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    ${trash.length ? trash.map(t => {
                        const cat = TASK_CATEGORIES[t.category] || TASK_CATEGORIES.other;
                        return `<tr>
                            <td><strong>${t.title}</strong><br><span style="font-size:0.78rem;color:var(--text-muted)">${t.desc || ''}</span></td>
                            <td><span class="task-cat-badge" style="background:${cat.color}15;color:${cat.color};border:1px solid ${cat.color}30">${cat.icon} ${cat.label}</span></td>
                            <td>${Utils.getStaffName(t.assignee)}</td>
                            <td style="color:var(--text-muted);font-size:0.82rem">${t.deletedAt || '—'}</td>
                            <td>
                                <div style="display:flex;gap:4px">
                                    <button class="btn btn-sm btn-secondary" onclick="TasksPage.restore(${t.id})">Khôi phục</button>
                                    ${canDelete ? `<button class="btn btn-sm btn-danger" onclick="TasksPage.confirmPermanentDelete(${t.id})">Xoá</button>` : ''}
                                </div>
                            </td>
                        </tr>`;
                    }).join('') : `<tr><td colspan="5"><div class="empty-state"><p>Thùng rác trống</p></div></td></tr>`}
                </tbody>
            </table>
        </div>`;
    },

    moveToTrash(id) {
        if (!Auth.getSession()?.isAdmin) return;
        const task = Store.getById('tasks', id);
        if (!task) return;
        const taskCopy = JSON.parse(JSON.stringify(task));
        taskCopy.deletedAt = new Date().toLocaleDateString('vi-VN');
        delete taskCopy.id;
        Store.add('tasksTrash', taskCopy);
        Store.remove('tasks', id);
        App.renderCurrentPage();
    },

    restore(id) {
        const task = Store.getById('tasksTrash', id);
        if (!task) return;
        const restored = JSON.parse(JSON.stringify(task));
        delete restored.id;
        delete restored.deletedAt;
        Store.add('tasks', restored);
        Store.remove('tasksTrash', id);
        App.renderCurrentPage();
    },

    confirmPermanentDelete(id) {
        Modal.open('⚠️ Xác nhận xoá', `
            <div style="padding:8px 0">
                <p style="margin-bottom:16px">Xoá vĩnh viễn công việc này? <strong>Không thể khôi phục!</strong></p>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="button" class="btn btn-danger" onclick="TasksPage.permanentDelete(${id})">🗑️ Xoá vĩnh viễn</button>
                </div>
            </div>
        `);
    },

    permanentDelete(id) {
        Store.remove('tasksTrash', id);
        Modal.close();
        App.renderCurrentPage();
    },

    confirmEmptyTrash() {
        Modal.open('⚠️ Xác nhận xoá tất cả', `
            <div style="padding:8px 0">
                <p style="margin-bottom:16px">Xoá tất cả công việc trong thùng rác? <strong>Không thể khôi phục!</strong></p>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="button" class="btn btn-danger" onclick="TasksPage.emptyTrash()">🗑️ Xoá tất cả</button>
                </div>
            </div>
        `);
    },

    emptyTrash() {
        const trash = this.getTrash();
        trash.forEach(t => Store.remove('tasksTrash', t.id));
        Modal.close();
        App.renderCurrentPage();
    },

    // ===== DRAG & DROP =====
    dragStart(e, id) {
        if (!Auth.getSession()?.isAdmin) return;
        this.draggedId = id;
        e.target.classList.add('dragging');
    },
    dragEnd(e) { e.target.classList.remove('dragging'); },
    drop(e, status) {
        e.preventDefault();
        if (!Auth.getSession()?.isAdmin) return;
        if (this.draggedId) {
            Store.update('tasks', this.draggedId, { status });
            this.draggedId = null;
            App.renderCurrentPage();
        }
    },

    // ===== FORMS =====
    openForm(id) {
        if (!Auth.getSession()?.isAdmin) return;
        const t = id ? Store.getById('tasks', id) : null;
        const staff = Store.getAll('staff');
        const today = new Date().toISOString().split('T')[0];
        const session = Auth.getSession();

        Modal.open(t ? 'Chỉnh sửa công việc' : 'Thêm công việc', `
            <form id="task-form" onsubmit="TasksPage.save(event, ${id||0})">
                <div class="form-group">
                    <label class="form-label">Tiêu đề</label>
                    <input class="form-input" name="title" value="${t?.title||''}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Mô tả</label>
                    <textarea class="form-textarea" name="desc">${t?.desc||''}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Phân loại</label>
                        <select class="form-select" name="category">
                            ${Object.entries(TASK_CATEGORIES).map(([key, cat]) =>
                                `<option value="${key}" ${(t?.category||'other')===key?'selected':''}>${cat.icon} ${cat.label}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Mức độ ưu tiên</label>
                        <select class="form-select" name="priority">
                            <option value="high" ${t?.priority==='high'?'selected':''}>Cao</option>
                            <option value="medium" ${t?.priority==='medium'?'selected':''}>Trung bình</option>
                            <option value="low" ${t?.priority==='low'?'selected':''}>Thấp</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Người giao việc</label>
                        <select class="form-select" name="assigner">
                            <option value="">— Chọn —</option>
                            ${staff.map(s => `<option value="${s.id}" ${t?.assigner===s.id ? 'selected' : (!t && s.id===session?.staffId ? 'selected' : '')}>${s.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Người phụ trách</label>
                        <select class="form-select" name="assignee">
                            ${staff.map(s => `<option value="${s.id}" ${t?.assignee===s.id?'selected':''}>${s.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Ngày giao việc</label>
                        <input class="form-input" type="date" name="startDate" value="${t?.startDate||today}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Deadline</label>
                        <input class="form-input" type="date" name="deadline" value="${t?.deadline||''}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Trạng thái</label>
                    <select class="form-select" name="status">
                        <option value="todo" ${t?.status==='todo'?'selected':''}>Chờ xử lý</option>
                        <option value="doing" ${t?.status==='doing'?'selected':''}>Đang thực hiện</option>
                        <option value="done" ${t?.status==='done'?'selected':''}>Hoàn thành</option>
                    </select>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">${t?'Cập nhật':'Thêm'}</button>
                </div>
            </form>
        `);
    },

    save(e, id) {
        if (!Auth.getSession()?.isAdmin) return;
        e.preventDefault();
        const form = new FormData(e.target);
        const data = {
            title: form.get('title'),
            desc: form.get('desc'),
            category: form.get('category'),
            assigner: form.get('assigner') ? parseInt(form.get('assigner')) : null,
            assignee: parseInt(form.get('assignee')),
            startDate: form.get('startDate'),
            deadline: form.get('deadline'),
            priority: form.get('priority'),
            status: form.get('status')
        };

        if (id) {
            const oldTask = Store.getById('tasks', id);
            Store.update('tasks', id, data);
            // Notify if assignee changed
            if (oldTask && oldTask.assignee !== data.assignee && data.status === 'todo') {
                Notifications.createTaskAssigned({ ...data, id });
            }
        } else {
            const newTask = Store.add('tasks', data);
            // Notify new assignee
            if (data.status === 'todo') {
                Notifications.createTaskAssigned(newTask);
            }
        }
        Modal.close(); App.renderCurrentPage();
    },

    delete(id) {
        // Legacy - redirect to moveToTrash
        this.moveToTrash(id);
    },

    afterRender() {},

    // ===== ASSIGNEE VIEW & COMPLETE =====
    viewTask(id) {
        const session = Auth.getSession();
        if (!session) return;
        const t = Store.getById('tasks', id);
        if (!t) return;

        const cat = TASK_CATEGORIES[t.category] || TASK_CATEGORIES.other;
        const assignerName = t.assigner ? Utils.getStaffName(t.assigner) : '—';
        const assigneeName = Utils.getStaffName(t.assignee);
        const deadlineText = t.deadline ? Utils.formatDateShort(t.deadline) : '—';
        const statusLabel = { todo: 'Chờ xử lý', doing: 'Đang thực hiện', done: 'Hoàn thành' }[t.status] || t.status;

        // Deadline vs completion comparison
        let deadlineDiffHtml = '';
        if (t.completedAt && t.deadline) {
            const completed = new Date(t.completedAt);
            const deadline = new Date(t.deadline);
            const diffDays = Math.round((deadline - completed) / (1000 * 60 * 60 * 24));
            if (diffDays > 0) {
                deadlineDiffHtml = `<div style="margin-top:8px;padding:8px 12px;background:rgba(16,185,129,0.1);border-radius:6px;color:var(--success);font-size:0.85rem;font-weight:600">🎯 Trước hạn ${diffDays} ngày</div>`;
            } else if (diffDays === 0) {
                deadlineDiffHtml = `<div style="margin-top:8px;padding:8px 12px;background:rgba(59,130,246,0.1);border-radius:6px;color:var(--primary);font-size:0.85rem;font-weight:600">🎯 Đúng hạn</div>`;
            } else {
                deadlineDiffHtml = `<div style="margin-top:8px;padding:8px 12px;background:rgba(239,68,68,0.1);border-radius:6px;color:var(--danger);font-size:0.85rem;font-weight:600">⚠️ Trễ hạn ${-diffDays} ngày</div>`;
            }
        }

        const isMyTask = t.assignee === session.staffId;

        Modal.open('📋 Chi tiết công việc', `
            <div class="notif-accept-modal">
                <div class="notif-accept-header">
                    <span class="notif-accept-badge">${cat.icon} ${cat.label}</span>
                    <span class="badge ${Utils.priorityBadge(t.priority)}">${Utils.priorityLabel(t.priority)}</span>
                    <span class="badge ${t.status === 'doing' ? 'badge-primary' : t.status === 'done' ? 'badge-success' : 'badge-warning'}">${statusLabel}</span>
                </div>
                <h3 class="notif-accept-title">${t.title}</h3>
                ${t.desc ? `<p class="notif-accept-desc">${t.desc}</p>` : ''}
                <div class="notif-accept-meta">
                    <div><strong>Người giao:</strong> ${assignerName}</div>
                    <div><strong>Người thực hiện:</strong> ${assigneeName}</div>
                    <div><strong>Ngày giao:</strong> ${t.startDate ? Utils.formatDateShort(t.startDate) : '—'}</div>
                    <div><strong>Deadline:</strong> ${deadlineText}</div>
                    ${t.completedAt ? `<div><strong>Ngày hoàn thành:</strong> <span style="color:var(--success)">✅ ${Utils.formatDateShort(t.completedAt)}</span></div>` : ''}
                </div>
                ${deadlineDiffHtml}
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Đóng</button>
                    ${t.status === 'doing' && isMyTask ? `<button type="button" class="btn btn-primary" onclick="TasksPage.completeTask(${t.id})">✅ Hoàn thành công việc</button>` : ''}
                </div>
            </div>
        `);
    },

    completeTask(id) {
        const session = Auth.getSession();
        if (!session) return;
        const t = Store.getById('tasks', id);
        if (!t || t.assignee !== session.staffId || t.status !== 'doing') return;

        const completedAt = new Date().toISOString().split('T')[0];
        Store.update('tasks', id, { status: 'done', completedAt });

        // Notify assigner
        Notifications.createTaskCompleted(t);

        Modal.close();
        App.renderCurrentPage();
    }
};
