// ===== REPORTS PAGE — Báo cáo hàng ngày =====
const ReportsPage = {
    activeTab: 'report16h', // 'report16h' | 'report7h'
    selectedDate: new Date().toISOString().split('T')[0],

    render() {
        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Báo cáo</h1>
                <p class="page-subtitle">Báo cáo tình hình khoa hàng ngày</p>
            </div>
        </div>

        <div class="staff-subtabs">
            <button class="staff-subtab ${this.activeTab === 'report16h' ? 'active' : ''}" onclick="ReportsPage.switchTab('report16h')">
                🩺 Báo cáo 16h <span class="staff-subtab-count">BS trực</span>
            </button>
            <button class="staff-subtab ${this.activeTab === 'report7h' ? 'active' : ''}" onclick="ReportsPage.switchTab('report7h')" style="opacity:0.5" title="Sắp triển khai">
                👩‍⚕️ Báo cáo 7h <span class="staff-subtab-count">ĐD</span>
            </button>
        </div>

        ${this.activeTab === 'report16h' ? this.renderReport16h() : this.renderReport7h()}
        `;
    },

    switchTab(tab) {
        this.activeTab = tab;
        App.renderCurrentPage();
    },

    // ===== REPORT 16H (BS trực khoa) =====
    renderReport16h() {
        const reports = Store.getAll('reports16h') || [];
        const session = Auth.getSession();
        const isAdmin = session?.isAdmin;
        const todayReport = reports.find(r => r.date === this.selectedDate);

        return `
        <div class="flex justify-between items-center" style="margin-bottom:12px">
            <div style="display:flex;gap:8px;align-items:center">
                <label style="font-weight:600;font-size:0.85rem;color:var(--text-secondary)">Ngày:</label>
                <input type="date" value="${this.selectedDate}" onchange="ReportsPage.changeDate(this.value)"
                    style="padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-size:0.85rem;background:var(--bg-card);color:var(--text-primary)">
                <button class="btn btn-secondary btn-sm" style="font-size:0.78rem" onclick="ReportsPage.goToday()">Hôm nay</button>
            </div>
            <div style="display:flex;gap:8px">
                ${!todayReport ? `<button class="btn btn-primary" onclick="ReportsPage.openReport16hForm()">
                    ${Utils.plusIcon()} Tạo báo cáo
                </button>` : ''}
            </div>
        </div>

        ${todayReport ? this.renderReport16hCard(todayReport) : this.renderNoReport()}

        <div style="margin-top:20px">
            <h3 style="font-size:0.9rem;font-weight:600;color:var(--text-secondary);margin-bottom:10px">📋 Lịch sử báo cáo gần đây</h3>
            ${this.renderReportHistory(reports)}
        </div>
        `;
    },

    renderNoReport() {
        return `
        <div class="card" style="text-align:center;padding:40px">
            <div style="font-size:2.5rem;margin-bottom:12px">📝</div>
            <p style="font-size:0.95rem;color:var(--text-secondary);margin-bottom:8px">Chưa có báo cáo cho ngày ${this.formatDateVN(this.selectedDate)}</p>
            <p style="font-size:0.82rem;color:var(--text-muted)">Bấm "Tạo báo cáo" để bắt đầu</p>
        </div>`;
    },

    renderReport16hCard(r) {
        const session = Auth.getSession();
        const canEdit = session?.isAdmin || r.createdBy === session?.username;

        return `
        <div class="card" style="padding:0;overflow:hidden">
            <div style="background:linear-gradient(135deg,#0891b2,#06b6d4);padding:14px 18px;color:#fff">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <h3 style="font-size:1rem;font-weight:700;margin:0">🩺 Báo cáo tình hình trực khoa</h3>
                        <p style="font-size:0.82rem;opacity:0.85;margin:4px 0 0">${this.getDayOfWeek(r.date)} — ${this.formatDateVN(r.date)}</p>
                    </div>
                    <div style="text-align:right">
                        ${canEdit ? `<button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:#fff;border:none;font-size:0.72rem;cursor:pointer" onclick="ReportsPage.openReport16hForm('${r.date}')">✏️ Sửa</button>` : ''}
                    </div>
                </div>
            </div>

            <div style="padding:16px 18px">
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px">
                    <div class="report-stat-card">
                        <span class="report-stat-label">Tổng BN</span>
                        <span class="report-stat-value">${r.totalPatients || '—'}</span>
                    </div>
                    <div class="report-stat-card">
                        <span class="report-stat-label">Mổ chưa về</span>
                        <span class="report-stat-value">${r.postOpNotReturned || '—'}</span>
                    </div>
                    <div class="report-stat-card" style="border-left-color:#22c55e">
                        <span class="report-stat-label">Nhập viện</span>
                        <span class="report-stat-value">${r.admissions || '0'}</span>
                    </div>
                    <div class="report-stat-card" style="border-left-color:#f59e0b">
                        <span class="report-stat-label">Xuất viện</span>
                        <span class="report-stat-value">${r.discharges || '0'}</span>
                    </div>
                </div>

                ${r.severePatients ? `<div style="background:#fef2f2;border-left:3px solid #ef4444;padding:8px 12px;border-radius:6px;margin-bottom:10px">
                    <span style="font-weight:600;color:#dc2626;font-size:0.82rem">⚠️ Bệnh phòng nặng:</span>
                    <span style="font-size:0.85rem;color:#991b1b">${r.severePatients}</span>
                </div>` : ''}

                ${r.surgeryDay ? `<div style="background:#eff6ff;border-left:3px solid #3b82f6;padding:8px 12px;border-radius:6px;margin-bottom:10px">
                    <span style="font-weight:600;color:#1d4ed8;font-size:0.82rem">🔪 Bệnh mổ ${this.getDayOfWeek(r.date)}:</span>
                    <span style="font-size:0.85rem;color:#1e40af"> ${r.surgeryTotal || '0'} ca (${r.surgeryCT || '0'} CT, ${r.surgeryYC || '0'} YC)</span>
                </div>` : ''}

                ${r.notes ? `<div style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;margin-bottom:10px">
                    <span style="font-weight:600;font-size:0.82rem;color:var(--text-secondary)">📝 Ghi chú:</span>
                    <span style="font-size:0.85rem;color:var(--text-primary)">${r.notes}</span>
                </div>` : ''}

                <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
                    <span>👤 ${r.reporterName || r.createdBy || 'Chưa rõ'}</span>
                    <span>🕐 ${r.createdAt ? new Date(r.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'}) : ''}</span>
                </div>
            </div>
        </div>`;
    },

    renderReportHistory(reports) {
        const sorted = [...reports].sort((a, b) => b.date.localeCompare(a.date));
        const recent = sorted.slice(0, 14);
        if (!recent.length) return '<p style="color:var(--text-muted);font-size:0.82rem">Chưa có lịch sử báo cáo</p>';

        return `<div class="card staff-table-card"><table>
            <thead><tr>
                <th>Ngày</th><th>Tổng BN</th><th>Nhập</th><th>Xuất</th><th>Ca mổ</th><th>BS báo cáo</th><th style="width:60px"></th>
            </tr></thead>
            <tbody>${recent.map(r => `<tr onclick="ReportsPage.viewDate('${r.date}')" style="cursor:pointer" class="${r.date === this.selectedDate ? 'report-row-active' : ''}">
                <td><strong>${this.formatDateShort(r.date)}</strong><br><span style="font-size:0.75rem;color:var(--text-muted)">${this.getDayOfWeek(r.date)}</span></td>
                <td style="text-align:center;font-weight:600">${r.totalPatients || '—'}</td>
                <td style="text-align:center;color:#22c55e">${r.admissions || '0'}</td>
                <td style="text-align:center;color:#f59e0b">${r.discharges || '0'}</td>
                <td style="text-align:center">${r.surgeryTotal || '0'}</td>
                <td style="font-size:0.82rem;color:var(--text-secondary)">${r.reporterName || '—'}</td>
                <td><button class="btn-icon" onclick="event.stopPropagation();ReportsPage.viewDate('${r.date}')" title="Xem">👁</button></td>
            </tr>`).join('')}</tbody>
        </table></div>`;
    },

    // ===== FORM 16h =====
    openReport16hForm(editDate) {
        const date = editDate || this.selectedDate;
        const reports = Store.getAll('reports16h') || [];
        const existing = reports.find(r => r.date === date);
        const session = Auth.getSession();

        // Get staff list for doctor selector
        const doctors = Store.getAll('staff').filter(s =>
            s.role.includes('Bác sĩ') || s.role.includes('Trưởng khoa') || s.role.includes('Phó trưởng khoa')
        );

        const e = existing || {};

        Modal.open(`🩺 Báo cáo 16h — ${this.formatDateVN(date)}`, `
            <form onsubmit="ReportsPage.saveReport16h(event, '${date}')" style="max-height:70vh;overflow-y:auto">
                <div style="background:var(--bg-secondary);padding:10px;border-radius:8px;margin-bottom:12px;font-size:0.82rem;color:var(--text-secondary)">
                    📌 Báo cáo tình hình trực khoa — ${this.getDayOfWeek(date)}
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                    <div class="form-group">
                        <label>Tổng số BN <span style="color:var(--danger)">*</span></label>
                        <input type="number" name="totalPatients" value="${e.totalPatients || ''}" required min="0" placeholder="VD: 65">
                    </div>
                    <div class="form-group">
                        <label>Số bệnh mổ chưa về</label>
                        <input type="number" name="postOpNotReturned" value="${e.postOpNotReturned || ''}" min="0" placeholder="VD: 3">
                    </div>
                    <div class="form-group">
                        <label>Nhập viện</label>
                        <input type="number" name="admissions" value="${e.admissions || ''}" min="0" placeholder="VD: 5">
                    </div>
                    <div class="form-group">
                        <label>Xuất viện</label>
                        <input type="number" name="discharges" value="${e.discharges || ''}" min="0" placeholder="VD: 4">
                    </div>
                </div>

                <div class="form-group">
                    <label>⚠️ Bệnh phòng nặng</label>
                    <textarea name="severePatients" rows="2" placeholder="VD: BN Nguyễn Văn A P.B712 — theo dõi sát...">${e.severePatients || ''}</textarea>
                </div>

                <div style="background:#eff6ff;border-radius:8px;padding:10px;margin-bottom:10px">
                    <label style="font-weight:700;font-size:0.85rem;color:#1d4ed8;margin-bottom:6px;display:block">🔪 Bệnh mổ ${this.getDayOfWeek(date)}</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
                        <div class="form-group" style="margin:0">
                            <label style="font-size:0.78rem">Tổng ca mổ</label>
                            <input type="number" name="surgeryTotal" value="${e.surgeryTotal || ''}" min="0" placeholder="0">
                        </div>
                        <div class="form-group" style="margin:0">
                            <label style="font-size:0.78rem">Chương trình</label>
                            <input type="number" name="surgeryCT" value="${e.surgeryCT || ''}" min="0" placeholder="0">
                        </div>
                        <div class="form-group" style="margin:0">
                            <label style="font-size:0.78rem">Yêu cầu</label>
                            <input type="number" name="surgeryYC" value="${e.surgeryYC || ''}" min="0" placeholder="0">
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>👤 BS báo cáo</label>
                    <select name="reporterName">
                        <option value="">— Chọn —</option>
                        ${doctors.map(d => `<option value="${d.name}" ${e.reporterName === d.name ? 'selected' : ''}>${d.name} (${d.title})</option>`).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label>📝 Ghi chú thêm</label>
                    <textarea name="notes" rows="2" placeholder="Ghi chú khác (nếu có)...">${e.notes || ''}</textarea>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">💾 Lưu báo cáo</button>
                </div>
            </form>
        `);
    },

    saveReport16h(e, date) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const session = Auth.getSession();

        const report = {
            date,
            totalPatients: parseInt(fd.get('totalPatients')) || 0,
            postOpNotReturned: parseInt(fd.get('postOpNotReturned')) || 0,
            admissions: parseInt(fd.get('admissions')) || 0,
            discharges: parseInt(fd.get('discharges')) || 0,
            severePatients: fd.get('severePatients')?.trim() || '',
            surgeryDay: true,
            surgeryTotal: parseInt(fd.get('surgeryTotal')) || 0,
            surgeryCT: parseInt(fd.get('surgeryCT')) || 0,
            surgeryYC: parseInt(fd.get('surgeryYC')) || 0,
            reporterName: fd.get('reporterName') || session?.name || '',
            notes: fd.get('notes')?.trim() || '',
            createdBy: session?.username || 'unknown',
            createdAt: new Date().toISOString()
        };

        // Save to store
        if (!Store._data.reports16h) Store._data.reports16h = [];
        const idx = Store._data.reports16h.findIndex(r => r.date === date);
        if (idx >= 0) {
            // Update existing
            report.createdAt = Store._data.reports16h[idx].createdAt; // keep original time
            report.updatedAt = new Date().toISOString();
            Store._data.reports16h[idx] = report;
        } else {
            Store._data.reports16h.push(report);
        }
        Store.save();

        Modal.close();
        this.selectedDate = date;
        App.renderCurrentPage();
        Toast.success('Đã lưu báo cáo 16h');
    },

    // ===== REPORT 7H (placeholder) =====
    renderReport7h() {
        return `
        <div class="card" style="text-align:center;padding:40px">
            <div style="font-size:2.5rem;margin-bottom:12px">🚧</div>
            <p style="font-size:1rem;font-weight:600;color:var(--text-secondary)">Đang phát triển</p>
            <p style="font-size:0.85rem;color:var(--text-muted)">Form báo cáo 7h sáng (Điều dưỡng) sẽ được triển khai sau</p>
        </div>`;
    },

    // ===== HELPERS =====
    changeDate(date) {
        this.selectedDate = date;
        App.renderCurrentPage();
    },

    goToday() {
        this.selectedDate = new Date().toISOString().split('T')[0];
        App.renderCurrentPage();
    },

    viewDate(date) {
        this.selectedDate = date;
        App.renderCurrentPage();
    },

    formatDateVN(dateStr) {
        const d = new Date(dateStr);
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    },

    formatDateShort(dateStr) {
        const d = new Date(dateStr);
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`;
    },

    getDayOfWeek(dateStr) {
        const days = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
        return days[new Date(dateStr).getDay()];
    }
};
