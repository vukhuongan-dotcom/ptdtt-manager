// ===== AUDIT LOG VIEWER (Super Admin only) =====
const AuditLog = {

    // Human-readable field names (Vietnamese)
    _fieldLabels: {
        patientName: 'Tên BN', birthYear: 'Năm sinh', date: 'Ngày',
        mainSurgeon: 'BS mổ chính', assistSurgeon1: 'BS phụ 1',
        diagnosis: 'Chẩn đoán', method: 'Phương pháp',
        approachType: 'Đường mổ', duration: 'T.gian mổ (ph)', notes: 'Ghi chú',
        surgeryType: 'Loại PT', isFirstCase: 'Ca đầu ngày',
        name: 'Họ tên', role: 'Vai trò', title: 'Học vị',
        phone: 'Điện thoại', email: 'Email', status: 'Trạng thái',
        note: 'Ghi chú', staffId: 'Nhân viên',
        weekKey: 'Tuần', surgeon: 'BS trực', type: 'Loại',
        title: 'Tiêu đề', presenter: 'Báo cáo viên', location: 'Địa điểm',
        assignee: 'Phân công', dueDate: 'Hạn chót', priority: 'Ưu tiên',
        content: 'Nội dung',
    },

    _actionLabels: {
        'data.put': '💾 Lưu toàn bộ DB',
        'collection.put.surgeries': '🔪 Ca mổ',
        'collection.put.staff': '👥 Nhân sự',
        'collection.put.staffStatuses': '📊 Trạng thái NS',
        'collection.put.schedules': '📅 Lịch mổ',
        'collection.put.shcmSchedule': '📋 Kế hoạch SHCM',
        'collection.put.tasks': '✅ Công việc',
        'collection.put.plans': '📋 Kế hoạch',
        'collection.put.notifications': '🔔 Thông báo',
        'collection.put.externalDoctors': '🩺 BS ngoài',
        'collection.put.reports7h': '📝 BC 7h',
        'collection.put.reports16h': '📝 BC 16h',
        'auth.login.success': '🔑 Đăng nhập',
        'auth.login.fail': '⚠️ Đăng nhập thất bại',
        'auth.login.blocked': '🚫 Đăng nhập bị chặn',
        'auth.password.change': '🔐 Đổi mật khẩu',
        'auth.admin.password.reset': '🔐 Reset mật khẩu',
        'auth.admin.toggle': '👑 Cấp/thu quyền admin',
        'auth.admin.disable': '🚫 Khoá/mở tài khoản',
        'shcm_upload_blocked': '⛔ Upload SHCM bị chặn',
        'shcm_delete': '🗑 Xoá file SHCM',
    },

    _fieldLabel(k) {
        return this._fieldLabels[k] || k;
    },

    // Render a diff block (added/removed/changed)
    _renderDiff(diff) {
        if (!diff) return '';
        const { added = [], removed = [], changed = [] } = diff;
        if (!added.length && !removed.length && !changed.length) return '';

        const parts = [];

        removed.forEach(r => {
            const rec = r.record || {};
            const fields = Object.entries(rec)
                .filter(([k]) => !['id','createdBy','updatedBy'].includes(k))
                .map(([k,v]) => `<span class="al-field"><b>${this._fieldLabel(k)}:</b> ${this._val(v)}</span>`)
                .join('');
            parts.push(`
                <div class="al-diff al-removed">
                    <span class="al-diff-badge al-badge-remove">🗑 Xoá</span>
                    <span class="al-label">${r.label || r.id}</span>
                    ${fields ? `<div class="al-fields">${fields}</div>` : ''}
                </div>`);
        });

        added.forEach(r => {
            const rec = r.record || {};
            const fields = Object.entries(rec)
                .filter(([k,v]) => !['id','createdBy','updatedBy'].includes(k) && v !== '' && v !== null && v !== undefined)
                .map(([k,v]) => `<span class="al-field"><b>${this._fieldLabel(k)}:</b> ${this._val(v)}</span>`)
                .join('');
            parts.push(`
                <div class="al-diff al-added">
                    <span class="al-diff-badge al-badge-add">＋ Thêm</span>
                    <span class="al-label">${r.label || r.id}</span>
                    ${fields ? `<div class="al-fields">${fields}</div>` : ''}
                </div>`);
        });

        changed.forEach(r => {
            const fieldDiffs = Object.keys(r.from || {}).map(k => `
                <div class="al-change-row">
                    <span class="al-change-field">${this._fieldLabel(k)}</span>
                    <span class="al-change-from">${this._val(r.from[k])}</span>
                    <span class="al-change-arrow">→</span>
                    <span class="al-change-to">${this._val(r.to[k])}</span>
                </div>`).join('');
            parts.push(`
                <div class="al-diff al-changed">
                    <span class="al-diff-badge al-badge-change">✎ Sửa</span>
                    <span class="al-label">${r.label || r.id}</span>
                    <div class="al-change-list">${fieldDiffs}</div>
                </div>`);
        });

        return `<div class="al-diff-wrap">${parts.join('')}</div>`;
    },

    _val(v) {
        if (v === null || v === undefined || v === '') return '<i style="color:var(--text-muted)">trống</i>';
        if (typeof v === 'boolean') return v ? 'Có' : 'Không';
        return String(v).substring(0, 120);
    },

    // Translate auth detail fields to human-readable Vietnamese
    _authDetail(action, d) {
        if (!d) return '';
        if (action === 'auth.login.fail') {
            const reasons = {
                'invalid_password': 'Sai mật khẩu',
                'too_many_attempts': 'Quá nhiều lần thử',
                'disabled': 'Tài khoản bị khoá',
                'user_not_found': 'Tài khoản không tồn tại',
            };
            const r = reasons[d.reason] || d.reason || 'Không xác định';
            const rem = d.remaining != null ? ` (còn ${d.remaining} lần thử)` : '';
            return `<span style="color:#ef4444;font-size:0.78rem">Lý do: ${r}${rem}</span>`;
        }
        if (action === 'auth.login.blocked') {
            const s = d.retryAfter ? ` — chờ ${Math.ceil(d.retryAfter/60)} phút` : '';
            return `<span style="color:#ef4444;font-size:0.78rem">Tài khoản tạm khoá${s}</span>`;
        }
        if (action === 'auth.admin.password.reset') {
            return `<span style="color:#f59e0b;font-size:0.78rem">Reset mật khẩu cho: <b>${d.target || '?'}</b></span>`;
        }
        if (action === 'auth.admin.toggle') {
            const q = d.isAdmin ? 'Cấp quyền admin cho' : 'Thu quyền admin của';
            return `<span style="color:#8b5cf6;font-size:0.78rem">${q}: <b>${d.target || '?'}</b></span>`;
        }
        if (action === 'auth.admin.disable') {
            const q = d.disabled ? 'Khoá tài khoản' : 'Mở tài khoản';
            return `<span style="color:#f59e0b;font-size:0.78rem">${q}: <b>${d.target || '?'}</b></span>`;
        }
        if (action === 'shcm_delete') {
            return `<span style="color:#ef4444;font-size:0.78rem">Xoá file: <b>${d.file || '?'}</b></span>`;
        }
        if (action === 'shcm_upload_blocked') {
            return `<span style="color:#ef4444;font-size:0.78rem">Upload bị chặn: ${d.reason || ''}</span>`;
        }
        return '';
    },

    _formatDetail(log) {
        const d = log.details;
        const action = log.action || '';

        // Case 1: auth/system events — show human text
        if (action.startsWith('auth.') || action.startsWith('shcm_')) {
            return this._authDetail(action, d);
        }

        if (!d) return '<span style="color:var(--text-muted);font-size:0.75rem">—</span>';

        // Case 2: New-format entries with full diff data
        if (d.diff) {
            const noop = !d.added && !d.removed && !d.changed;
            if (noop) {
                return `<span style="color:var(--text-muted);font-size:0.75rem">Lưu thành công, không có nội dung thay đổi</span>`;
            }
            const parts = [];
            if (d.added)   parts.push(`<span class="al-badge-add">+${d.added} thêm mới</span>`);
            if (d.removed) parts.push(`<span class="al-badge-remove">−${d.removed} đã xoá</span>`);
            if (d.changed) parts.push(`<span class="al-badge-change">✎${d.changed} đã sửa</span>`);
            const summaryHtml = `<span class="al-summary">${parts.join(' ')}</span>`;
            const diffHtml = this._renderDiff(d.diff);
            return `<div>${summaryHtml}${diffHtml
                ? `<button class="al-toggle-btn" onclick="AuditLog._toggle(this)">▼ Xem chi tiết</button>
                   <div class="al-diff-detail" style="display:none">${diffHtml}</div>`
                : ''}</div>`;
        }

        // Case 3: Old-format entries — only have {count, nextId}
        if (d.count !== undefined) {
            const collMap = {
                'collection.put.surgeries':      ['danh sách ca mổ', 'ca mổ'],
                'collection.put.staff':          ['danh sách nhân sự', 'nhân viên'],
                'collection.put.staffStatuses':  ['trạng thái nhân sự', 'bản ghi'],
                'collection.put.schedules':      ['lịch mổ tuần', 'tuần'],
                'collection.put.shcmSchedule':   ['kế hoạch SHCM', 'mục'],
                'collection.put.plans':          ['kế hoạch khoa', 'kế hoạch'],
                'collection.put.tasks':          ['danh sách công việc', 'việc'],
                'collection.put.notifications':  ['thông báo', 'thông báo'],
                'collection.put.externalDoctors':['danh sách bác sĩ ngoài', 'bác sĩ'],
                'collection.put.reports7h':      ['báo cáo 7 giờ', 'báo cáo'],
                'collection.put.reports16h':     ['báo cáo 16 giờ', 'báo cáo'],
            };
            const info = collMap[action];
            const listName = info ? info[0] : 'dữ liệu';
            const unit     = info ? info[1] : 'bản ghi';
            return `<div style="font-size:0.78rem;line-height:1.6">
                <div>Đã cập nhật <b>${listName}</b> — lúc đó hệ thống có <b>${d.count}</b> ${unit}</div>
                <div style="margin-top:5px;padding:6px 10px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:6px;font-size:0.72rem;color:#92400e">
                    ⚠️ <b>Nội dung thay đổi cụ thể không được lưu lại</b><br>
                    Hệ thống chỉ ghi chi tiết thêm/sửa/xoá từ <b>15/05/2026</b> trở đi.
                    Các thao tác trước đó chỉ biết "có cập nhật", không biết cụ thể là gì.
                </div>
            </div>`;
        }

        // Case 4: data.put with size
        if (d.size) {
            const kb = (d.size / 1024).toFixed(1);
            return `<span style="color:var(--text-muted);font-size:0.75rem">Lưu toàn bộ cơ sở dữ liệu (${kb} KB)</span>`;
        }

        // Fallback
        return '<span style="color:var(--text-muted);font-size:0.75rem">Đã lưu thành công</span>';

    },

    _toggle(btn) {
        const detail = btn.nextElementSibling;
        const open = detail.style.display !== 'none';
        detail.style.display = open ? 'none' : 'block';
        btn.textContent = open ? '▼ Chi tiết' : '▲ Ẩn';
    },

    async open(days = 7) {
        const session = Auth.getSession();
        if (!session || !session.isSuperAdmin) return;

        Modal.open('📋 Lịch sử hoạt động', '<div style="text-align:center;padding:20px">Đang tải...</div>');

        try {
            const token = Auth.getToken();
            const resp = await fetch(`/api/audit?days=${days}&_t=${Date.now()}`, {
                headers: token ? { 'Authorization': 'Bearer ' + token } : {}
            });
            if (resp.status === 401 || resp.status === 403) {
                throw new Error('Bạn không có quyền xem audit log');
            }
            const data = await resp.json();
            const logs = data.logs || [];

            const formatTime = (ts) => {
                const d = new Date(ts);
                const pad = n => String(n).padStart(2, '0');
                return `${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            };

            const rows = logs.slice(0, 300).map(l => {
                const label = this._actionLabels[l.action] || `⚙️ ${l.action}`;
                const detail = this._formatDetail(l);
                const isLogin = l.action.includes('auth.login');
                return `<tr style="border-bottom:1px solid var(--border);vertical-align:top${isLogin ? ';opacity:0.65' : ''}">
                    <td style="padding:5px 8px;font-size:0.77rem;color:var(--text-muted);white-space:nowrap">${formatTime(l.ts)}</td>
                    <td style="padding:5px 8px;font-size:0.82rem;font-weight:600;white-space:nowrap">${l.user}</td>
                    <td style="padding:5px 8px;font-size:0.82rem;white-space:nowrap">${label}</td>
                    <td style="padding:5px 8px;font-size:0.8rem;max-width:320px">${detail}</td>
                </tr>`;
            }).join('');

            Modal.open('📋 Lịch sử hoạt động', `
                <style>
                .al-summary { display:inline-flex; gap:6px; align-items:center; }
                .al-badge-add { background:#10b98120; color:#10b981; border:1px solid #10b98140; border-radius:4px; padding:1px 6px; font-size:0.72rem; font-weight:700; }
                .al-badge-remove { background:#ef444420; color:#ef4444; border:1px solid #ef444440; border-radius:4px; padding:1px 6px; font-size:0.72rem; font-weight:700; }
                .al-badge-change { background:#f59e0b20; color:#f59e0b; border:1px solid #f59e0b40; border-radius:4px; padding:1px 6px; font-size:0.72rem; font-weight:700; }
                .al-toggle-btn { margin-left:8px; font-size:0.72rem; background:none; border:1px solid var(--border); border-radius:4px; padding:1px 8px; cursor:pointer; color:var(--text-muted); }
                .al-toggle-btn:hover { background:var(--bg-secondary); }
                .al-diff-wrap { margin-top:6px; display:flex; flex-direction:column; gap:4px; }
                .al-diff { border-radius:6px; padding:6px 10px; font-size:0.75rem; display:flex; flex-wrap:wrap; align-items:flex-start; gap:6px; }
                .al-removed { background:rgba(239,68,68,0.07); border:1px solid rgba(239,68,68,0.2); }
                .al-added { background:rgba(16,185,129,0.07); border:1px solid rgba(16,185,129,0.2); }
                .al-changed { background:rgba(245,158,11,0.07); border:1px solid rgba(245,158,11,0.2); }
                .al-diff-badge { border-radius:4px; padding:1px 6px; font-size:0.7rem; font-weight:700; flex-shrink:0; }
                .al-badge-add.al-diff-badge { background:#10b981; color:#fff; }
                .al-badge-remove.al-diff-badge { background:#ef4444; color:#fff; }
                .al-badge-change.al-diff-badge { background:#f59e0b; color:#fff; }
                .al-label { font-weight:600; flex-shrink:0; }
                .al-fields { width:100%; display:flex; flex-wrap:wrap; gap:4px 12px; margin-top:3px; }
                .al-field { font-size:0.72rem; color:var(--text-secondary); }
                .al-change-list { width:100%; margin-top:4px; display:flex; flex-direction:column; gap:2px; }
                .al-change-row { display:flex; align-items:center; gap:6px; font-size:0.73rem; }
                .al-change-field { font-weight:600; color:var(--text-secondary); min-width:90px; }
                .al-change-from { color:#ef4444; text-decoration:line-through; }
                .al-change-arrow { color:var(--text-muted); }
                .al-change-to { color:#10b981; font-weight:600; }
                .al-kv { margin-right:8px; }
                </style>
                <div style="display:flex;gap:8px;margin-bottom:10px">
                    ${[1,3,7,30].map(d => `<button class="btn btn-sm ${d===days?'btn-primary':'btn-secondary'}" style="font-size:0.75rem" onclick="AuditLog.open(${d})">${d} ngày</button>`).join('')}
                </div>
                <div style="max-height:60vh;overflow-y:auto">
                    ${logs.length ? `<table style="width:100%;border-collapse:collapse;font-size:0.82rem">
                        <thead><tr style="border-bottom:2px solid var(--border);background:var(--bg-secondary);position:sticky;top:0;z-index:1">
                            <th style="padding:6px 8px;text-align:left">Thời gian</th>
                            <th style="padding:6px 8px;text-align:left">User</th>
                            <th style="padding:6px 8px;text-align:left">Hành động</th>
                            <th style="padding:6px 8px;text-align:left">Chi tiết thay đổi</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div style="text-align:center;padding:8px;color:var(--text-muted);font-size:0.78rem">
                        Hiển thị ${Math.min(logs.length, 300)}/${data.total} bản ghi
                    </div>` : '<div class="empty-state"><p>Chưa có hoạt động nào được ghi nhận</p></div>'}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" onclick="Modal.close()">Đóng</button>
                </div>
            `);
        } catch (e) {
            Modal.open('📋 Lịch sử hoạt động', `
                <div class="empty-state"><p>Không thể tải dữ liệu audit log</p><p style="font-size:0.8rem;color:var(--text-muted)">${e.message}</p></div>
                <div class="modal-footer"><button class="btn btn-primary" onclick="Modal.close()">Đóng</button></div>
            `);
        }
    }
};
