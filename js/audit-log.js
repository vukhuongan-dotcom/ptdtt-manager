// ===== AUDIT LOG VIEWER (Super Admin only) =====
const AuditLog = {
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

            const actionLabels = {
                'data.put': '💾 Lưu dữ liệu',
                'collection.put.surgeries': '🔪 Cập nhật ca mổ',
                'collection.put.staff': '👥 Cập nhật nhân sự',
                'collection.put.schedules': '📅 Cập nhật lịch mổ',
                'collection.put.tasks': '📝 Cập nhật công việc',
                'collection.put.patients': '🏥 Cập nhật bệnh nhân',
                'collection.put.plans': '📋 Cập nhật kế hoạch',
                'collection.put.notifications': '🔔 Cập nhật thông báo',
                'collection.put.externalDoctors': '🩺 Cập nhật BS ngoài',
            };

            const formatTime = (ts) => {
                const d = new Date(ts);
                const pad = n => String(n).padStart(2, '0');
                return `${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            };

            const rows = logs.slice(0, 200).map(l => {
                const label = actionLabels[l.action] || `⚙️ ${l.action}`;
                const detail = l.details ? JSON.stringify(l.details) : '';
                return `<tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:4px 8px;font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${formatTime(l.ts)}</td>
                    <td style="padding:4px 8px;font-size:0.82rem;font-weight:600">${l.user}</td>
                    <td style="padding:4px 8px;font-size:0.82rem">${label}</td>
                    <td style="padding:4px 8px;font-size:0.75rem;color:var(--text-muted)">${detail}</td>
                </tr>`;
            }).join('');

            Modal.open('📋 Lịch sử hoạt động', `
                <div style="display:flex;gap:8px;margin-bottom:10px">
                    ${[1,3,7,30].map(d => `<button class="btn btn-sm ${d===days?'btn-primary':'btn-secondary'}" style="font-size:0.75rem" onclick="AuditLog.open(${d})">${d} ngày</button>`).join('')}
                </div>
                <div style="max-height:55vh;overflow-y:auto">
                    ${logs.length ? `<table style="width:100%;border-collapse:collapse;font-size:0.82rem">
                        <thead><tr style="border-bottom:2px solid var(--border);background:var(--bg-secondary)">
                            <th style="padding:6px 8px;text-align:left">Thời gian</th>
                            <th style="padding:6px 8px;text-align:left">User</th>
                            <th style="padding:6px 8px;text-align:left">Hành động</th>
                            <th style="padding:6px 8px;text-align:left">Chi tiết</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div style="text-align:center;padding:8px;color:var(--text-muted);font-size:0.78rem">
                        Hiển thị ${Math.min(logs.length, 200)}/${data.total} bản ghi
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
