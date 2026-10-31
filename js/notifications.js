// ===== NOTIFICATIONS MODULE =====
const Notifications = {
    _panelOpen: false,
    _pollInterval: null,

    // ===== DATA =====
    getAll() {
        return Store._data.notifications || [];
    },

    getForCurrentUser() {
        const session = Auth.getSession();
        if (!session) return [];
        const showApproval = typeof SurgeryApprovalPage !== 'undefined' && SurgeryApprovalPage.isFeatureVisibleForCurrentUser();
        return this.getAll().filter(n => {
            if (!n || n.toStaffId !== session.staffId) return false;
            if (n.sourceType === 'surgery_approval' && !showApproval) return false;
            return true;
        });
    },

    getUnreadCount() {
        return this.getForCurrentUser().filter(n => !n.read).length;
    },

    // ===== CREATE NOTIFICATIONS =====
    createTaskAssigned(task) {
        if (!task || !task.assignee) return;
        const session = Auth.getSession();
        const assignerName = session ? `${session.title} ${session.name}` : 'Admin';
        const cat = TASK_CATEGORIES[task.category] || TASK_CATEGORIES.other;

        const notif = {
            type: 'task_assigned',
            taskId: task.id,
            fromStaffId: session?.staffId || null,
            toStaffId: task.assignee,
            message: `${assignerName} giao cho bạn: "${task.title}"`,
            detail: task.desc || '',
            category: cat.icon + ' ' + cat.label,
            priority: task.priority,
            deadline: task.deadline,
            createdAt: new Date().toISOString(),
            read: false
        };
        Store.add('notifications', notif);
    },

    createTaskAccepted(task) {
        if (!task || !task.assigner) return;
        const session = Auth.getSession();
        const accepterName = session ? `${session.title} ${session.name}` : '';

        const notif = {
            type: 'task_accepted',
            taskId: task.id,
            fromStaffId: session?.staffId || null,
            toStaffId: task.assigner,
            message: `${accepterName} đã tiếp nhận: "${task.title}"`,
            detail: '',
            createdAt: new Date().toISOString(),
            read: false
        };
        Store.add('notifications', notif);
    },

    createTaskCompleted(task) {
        if (!task || !task.assigner) return;
        const session = Auth.getSession();
        const completerName = session ? `${session.title} ${session.name}` : '';

        const notif = {
            type: 'task_completed',
            taskId: task.id,
            fromStaffId: session?.staffId || null,
            toStaffId: task.assigner,
            message: `${completerName} đã hoàn thành: "${task.title}"`,
            detail: '',
            createdAt: new Date().toISOString(),
            read: false
        };
        Store.add('notifications', notif);
    },

    // ===== ACCEPT TASK =====
    acceptTask(notifId) {
        const notif = this.getAll().find(n => n.id === notifId);
        if (!notif) return;

        const task = Store.getById('tasks', notif.taskId);
        if (!task) {
            // Task may have been deleted
            Store.update('notifications', notifId, { read: true });
            this.updateBell();
            return;
        }

        // Change task status: todo → doing
        Store.update('tasks', notif.taskId, { status: 'doing' });

        // Mark notification as read
        Store.update('notifications', notifId, { read: true });

        // Create reverse notification to assigner
        this.createTaskAccepted(task);

        // Close panel & refresh
        this._panelOpen = false;
        this.updateBell();
        Modal.close();

        // If on tasks page, refresh it
        if (App.currentPage === 'tasks') {
            App.renderCurrentPage();
        }
    },

    async _postNotifEndpoint(path, body) {
        try {
            const token = Auth.getToken();
            if (!token) return null;
            const idem = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? `notif_${crypto.randomUUID()}`
                : `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            const resp = await fetch(path, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'X-Client-Build': String(CLIENT_BUILD),
                    'Idempotency-Key': idem
                },
                body: JSON.stringify(body || {})
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            if (data && Array.isArray(data.items) && Store._data) {
                Store._data.notifications = data.items;
                if (Store._serverSyncedData) {
                    Store._serverSyncedData.notifications = Store._clone(data.items);
                }
                if (data.revision != null) {
                    if (!Store._serverRevisions) Store._serverRevisions = {};
                    Store._serverRevisions.notifications = data.revision;
                }
                if (data.version) Store._serverVersion = data.version;
                Store._lastEtag = null;
                Store._saveLocal();
            }
            return data;
        } catch (_) {
            return null;
        }
    },

    markRead(notifId) {
        const list = Store._data?.notifications || [];
        const item = list.find(n => n && n.id === notifId);
        if (item) {
            item.read = true;
            Store._saveLocal();
        }
        this.updateBell();
        this._postNotifEndpoint('/api/notifications/mark-read', { ids: [notifId] }).then(() => {
            this.updateBell();
        });
    },

    markAllRead() {
        const mine = this.getForCurrentUser().filter(n => !n.read);
        mine.forEach(n => { n.read = true; });
        Store._saveLocal();
        this.updateBell();
        this.refreshPanel();
        this._postNotifEndpoint('/api/notifications/mark-read', { all: true }).then(() => {
            this.updateBell();
            if (this._panelOpen) this.refreshPanel();
        });
    },

    deleteRead() {
        const readIds = new Set(this.getForCurrentUser().filter(n => n.read).map(n => n.id));
        if (Store._data && Array.isArray(Store._data.notifications)) {
            Store._data.notifications = Store._data.notifications.filter(n => !readIds.has(n?.id));
            Store._saveLocal();
        }
        this.updateBell();
        this.refreshPanel();
        this._postNotifEndpoint('/api/notifications/delete-read', { ids: [...readIds] }).then(() => {
            this.updateBell();
            if (this._panelOpen) this.refreshPanel();
        });
    },

    refreshPanel() {
        if (this._panelOpen) {
            const panel = document.getElementById('notif-panel');
            if (panel) { panel.remove(); this._panelOpen = false; }
            this.togglePanel('desktop');
        }
    },

    // ===== BELL ICON RENDERING =====
    bellIconSVG() {
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
    },

    renderBellButton(position) {
        const count = this.getUnreadCount();
        const id = position === 'mobile' ? 'notif-bell-mobile' : 'notif-bell-desktop';
        return `
        <button class="notif-bell-btn" id="${id}" aria-label="Thông báo" title="Thông báo" onclick="Notifications.togglePanel('${position}')">
            ${this.bellIconSVG()}
            ${count > 0 ? `<span class="notif-badge">${count > 9 ? '9+' : count}</span>` : ''}
        </button>`;
    },

    togglePanel(position) {
        this._panelOpen = !this._panelOpen;
        const existing = document.getElementById('notif-panel');
        if (existing) {
            existing.remove();
            if (!this._panelOpen) return;
        }
        if (!this._panelOpen) return;

        const notifications = this.getForCurrentUser()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 20);
        const readCount = this.getForCurrentUser().filter(n => n.read).length;

        const panel = document.createElement('div');
        panel.id = 'notif-panel';
        panel.className = 'notif-panel';
        panel.innerHTML = `
            <div class="notif-panel-header">
                <span class="notif-panel-title">🔔 Thông báo</span>
                <div style="display:flex;gap:6px">
                    ${readCount > 0 ? `<button class="notif-mark-all notif-delete-read" onclick="event.stopPropagation();Notifications.deleteRead()">🗑️ Xoá đã đọc</button>` : ''}
                    ${this.getUnreadCount() > 0 ? `<button class="notif-mark-all" onclick="event.stopPropagation();Notifications.markAllRead()">Đánh dấu đã đọc</button>` : ''}
                </div>
            </div>
            <div class="notif-panel-body">
                ${notifications.length > 0 ? notifications.map(n => this.renderNotifItem(n)).join('') : 
                '<div class="notif-empty">Không có thông báo</div>'}
            </div>
        `;
        document.body.appendChild(panel);

        // Position relative to bell button
        requestAnimationFrame(() => {
            panel.classList.add('show');
        });

        // Close on outside click
        const closeHandler = (e) => {
            if (!panel.contains(e.target) && !e.target.closest('.notif-bell-btn')) {
                panel.remove();
                this._panelOpen = false;
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 100);
    },

    renderNotifItem(n) {
        const timeAgo = this.timeAgo(n.createdAt);
        const isAssigned = n.type === 'task_assigned';
        const isApproval = n.sourceType === 'surgery_approval';
        let icon = isAssigned ? '📋' : n.type === 'task_completed' ? '🎉' : '✅';
        if (isApproval) {
            const map = {
                surgery_approved: '✅',
                surgery_approved_with_exception: '⚡',
                surgery_emergency_exception: '⚡',
                surgery_returned_for_revision: '↩️',
                surgery_post_approval_hold: '⏸️',
                surgery_revoked: '🚫',
                surgery_preapproved: '☑️',
                surgery_ready_for_attending: '🩺',
                surgery_submitted: '🚀'
            };
            icon = map[n.type] || '📋';
        }
        const unreadClass = n.read ? '' : 'unread';
        const safeMsg = isApproval ? Utils.escapeHtml(n.message || '') : n.message;
        const safeCat = isApproval ? Utils.escapeHtml(n.category || '') : n.category;

        return `
        <div class="notif-item ${unreadClass}" onclick="Notifications.openNotif(${n.id})">
            <div class="notif-item-icon">${icon}</div>
            <div class="notif-item-content">
                <div class="notif-item-msg">${safeMsg}</div>
                ${safeCat ? `<span class="notif-item-cat">${safeCat}</span>` : ''}
                <div class="notif-item-time">${timeAgo}</div>
            </div>
            ${!n.read && (isAssigned || isApproval) ? '<div class="notif-item-dot"></div>' : ''}
        </div>`;
    },

    openNotif(notifId) {
        const notif = this.getAll().find(n => n.id === notifId);
        if (!notif) return;

        // Close panel
        const panel = document.getElementById('notif-panel');
        if (panel) panel.remove();
        this._panelOpen = false;

        if (notif.sourceType === 'surgery_approval') {
            this.markRead(notifId);
            if (typeof SurgeryApprovalPage !== 'undefined' && SurgeryApprovalPage.isFeatureVisibleForCurrentUser()) {
                App.navigate('surgery-approval');
                if (notif.surgeryId) {
                    setTimeout(() => SurgeryApprovalPage.openCaseModal(notif.surgeryId, { notifType: notif.type || '' }), 50);
                }
            }
            return;
        }

        if (notif.type === 'task_assigned' && !notif.read) {
            const task = Store.getById('tasks', notif.taskId);
            const cat = task ? (TASK_CATEGORIES[task.category] || TASK_CATEGORIES.other) : null;
            const priorityLabel = task ? Utils.priorityLabel(task.priority) : '';
            const deadlineText = task?.deadline ? Utils.formatDateShort(task.deadline) : '—';

            Modal.open('📋 Công việc mới', `
                <div class="notif-accept-modal">
                    <div class="notif-accept-header">
                        <span class="notif-accept-badge">${cat ? cat.icon + ' ' + cat.label : ''}</span>
                        <span class="badge ${task ? Utils.priorityBadge(task.priority) : ''}">${priorityLabel}</span>
                    </div>
                    <h3 class="notif-accept-title">${task?.title || notif.message}</h3>
                    ${task?.desc ? `<p class="notif-accept-desc">${task.desc}</p>` : ''}
                    <div class="notif-accept-meta">
                        <div><strong>Người giao:</strong> ${Utils.getStaffName(notif.fromStaffId)}</div>
                        <div><strong>Deadline:</strong> ${deadlineText}</div>
                        ${task?.startDate ? `<div><strong>Ngày giao:</strong> ${Utils.formatDateShort(task.startDate)}</div>` : ''}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="Notifications.markRead(${notifId});Modal.close()">Để sau</button>
                        <button type="button" class="btn btn-primary" onclick="Notifications.acceptTask(${notifId})">
                            ✅ Tiếp nhận công việc
                        </button>
                    </div>
                </div>
            `);
        } else {
            this.markRead(notifId);
            App.navigate('plans');
        }
    },

    // ===== BELL UPDATE =====
    updateBell() {
        const count = this.getUnreadCount();
        document.querySelectorAll('.notif-bell-btn').forEach(btn => {
            let badge = btn.querySelector('.notif-badge');
            if (count > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'notif-badge';
                    btn.appendChild(badge);
                }
                badge.textContent = count > 9 ? '9+' : count;
                btn.classList.add('has-notif');
            } else {
                if (badge) badge.remove();
                btn.classList.remove('has-notif');
            }
        });

        // Update panel if open
        if (this._panelOpen) {
            const panel = document.getElementById('notif-panel');
            if (panel) {
                const body = panel.querySelector('.notif-panel-body');
                if (body) {
                    const notifications = this.getForCurrentUser()
                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                        .slice(0, 20);
                    body.innerHTML = notifications.length > 0
                        ? notifications.map(n => this.renderNotifItem(n)).join('')
                        : '<div class="notif-empty">Không có thông báo</div>';
                }
            }
        }
    },

    // ===== POLLING (detect new notifications from other sessions) =====
    startPolling() {
        if (this._pollInterval) return;
        this._pollInterval = setInterval(() => {
            this.updateBell();
        }, 15000); // every 15 seconds
    },

    stopPolling() {
        if (this._pollInterval) {
            clearInterval(this._pollInterval);
            this._pollInterval = null;
        }
    },

    // ===== HELPERS =====
    timeAgo(isoStr) {
        const diff = Date.now() - new Date(isoStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Vừa xong';
        if (mins < 60) return `${mins} phút trước`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs} giờ trước`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `${days} ngày trước`;
        return new Date(isoStr).toLocaleDateString('vi-VN');
    }
};
