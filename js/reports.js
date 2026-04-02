// ===== REPORTS PAGE — Báo cáo hàng ngày =====
const ReportsPage = {
    activeTab: 'report16h',
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

    // ========== Auto-fill patient count from EMR ==========
    getAutoPatientCount() {
        // Priority: EMR real-time data → manual patient stats
        if (typeof EMR !== 'undefined') {
            const emr = EMR.getData();
            if (emr && emr.totalDept > 0) return emr.totalDept;
        }
        const pStats = Store.getPatientStats();
        return pStats ? (pStats.total - pStats.discharged) : 0;
    },

    // ========== REPORT 16H ==========
    renderReport16h() {
        const reports = Store.getAll('reports16h') || [];
        const todayReport = reports.find(r => r.date === this.selectedDate);

        return `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <div style="display:flex;gap:8px;align-items:center">
                <label style="font-weight:600;font-size:0.85rem;color:var(--text-secondary)">Ngày:</label>
                <input type="date" value="${this.selectedDate}" onchange="ReportsPage.changeDate(this.value)"
                    style="padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-size:0.85rem;background:var(--bg-card);color:var(--text-primary)">
                <button class="btn btn-secondary btn-sm" style="font-size:0.78rem" onclick="ReportsPage.goToday()">Hôm nay</button>
            </div>
            <div style="display:flex;gap:8px">
                ${todayReport ? `<button class="btn btn-sm" style="background:#f97316;color:#fff;border:none;font-size:0.78rem" onclick="ReportsPage.exportReportImage()">
                    📸 Xuất hình trực khoa
                </button>` : ''}
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
        const canEdit = !!session; // All logged-in staff can edit reports

        return `
        <div id="report-export-area">
        <div class="card" style="padding:0;overflow:hidden;border:none;box-shadow:0 4px 20px rgba(0,0,0,0.12)">
            <!-- Header: White text on dark background for maximum contrast -->
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#334155 100%);padding:18px 22px;color:#fff;position:relative">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                    <div>
                        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:2.5px;color:#94a3b8;margin-bottom:6px;font-weight:500">KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG — BỆNH VIỆN BÌNH DÂN</div>
                        <h2 style="font-size:1.25rem;font-weight:800;margin:0;letter-spacing:0.5px;color:#fff">🩺 BÁO CÁO TRỰC KHOA LÚC 16G</h2>
                        <div style="font-size:0.9rem;margin-top:5px;color:#e2e8f0;font-weight:500">${this.getDayOfWeek(r.date)} — Ngày ${this.formatDateVN(r.date)}</div>
                    </div>
                    <div class="report-no-export">
                        ${canEdit ? `<button class="btn btn-sm" style="background:rgba(255,255,255,0.12);color:#e2e8f0;border:1px solid rgba(255,255,255,0.25);font-size:0.72rem;cursor:pointer" onclick="ReportsPage.openReport16hForm('${r.date}')">✏️ Sửa</button>` : ''}
                    </div>
                </div>
            </div>

            <!-- Stats: High contrast colored cards -->
            <div style="padding:16px 22px;background:#fff">
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
                    <div style="background:#1e40af;border-radius:10px;padding:14px;text-align:center">
                        <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.75);font-weight:600;margin-bottom:4px">TỔNG BN</div>
                        <div style="font-size:2.2rem;font-weight:800;color:#fff">${r.totalPatients || '—'}</div>
                    </div>
                    <div style="background:#ea580c;border-radius:10px;padding:14px;text-align:center">
                        <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.75);font-weight:600;margin-bottom:4px">MỔ CHƯA VỀ</div>
                        <div style="font-size:2.2rem;font-weight:800;color:#fff">${r.postOpNotReturned || '0'}</div>
                    </div>
                    <div style="background:#16a34a;border-radius:10px;padding:14px;text-align:center">
                        <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.75);font-weight:600;margin-bottom:4px">NHẬP VIỆN</div>
                        <div style="font-size:2.2rem;font-weight:800;color:#fff">${r.admissions || '0'}</div>
                    </div>
                    <div style="background:#ca8a04;border-radius:10px;padding:14px;text-align:center">
                        <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.75);font-weight:600;margin-bottom:4px">XUẤT VIỆN</div>
                        <div style="font-size:2.2rem;font-weight:800;color:#fff">${r.discharges || '0'}</div>
                    </div>
                </div>
            </div>

            <!-- Detail sections -->
            <div style="padding:0 22px 16px;background:#fff">
                ${r.severePatients ? `
                <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:10px">
                    <div style="font-weight:700;color:#dc2626;font-size:0.82rem;margin-bottom:3px">⚠️ BỆNH PHÒNG NẶNG</div>
                    <div style="font-size:0.88rem;color:#7f1d1d;line-height:1.5">${r.severePatients}</div>
                </div>` : ''}

                ${(r.surgeryTotal > 0 || r.surgeryDay) ? `
                <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:10px">
                    <div style="font-weight:700;color:#1d4ed8;font-size:0.82rem;margin-bottom:3px">🔪 BỆNH MỔ ${this.getDayOfWeek(r.date).toUpperCase()}</div>
                    <div style="font-size:0.95rem;color:#1e3a8a;font-weight:600">${r.surgeryTotal || '0'} ca <span style="font-weight:400;font-size:0.85rem">(${r.surgeryCT || '0'} Chương trình, ${r.surgeryYC || '0'} Yêu cầu)</span></div>
                </div>` : ''}

                ${r.notes ? `
                <div style="background:#f8fafc;border-left:4px solid #94a3b8;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:10px">
                    <div style="font-weight:700;color:#475569;font-size:0.82rem;margin-bottom:3px">📝 GHI CHÚ</div>
                    <div style="font-size:0.88rem;color:#334155;line-height:1.5">${r.notes}</div>
                </div>` : ''}
            </div>

            <!-- Footer -->
            <div style="padding:10px 22px;background:#f1f5f9;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;color:#475569">
                <span>👤 BS trực: <strong style="color:#0f172a">${r.reporterName || r.createdBy || 'Chưa rõ'}</strong></span>
                <span>🕐 Báo cáo lúc: <strong>${r.createdAt ? new Date(r.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'}) : '16:00'}</strong></span>
            </div>
        </div>
        </div>`;
    },

    _showArchive: false,

    toggleArchive() {
        this._showArchive = !this._showArchive;
        App.renderCurrentPage();
    },

    _renderHistoryRows(items) {
        return items.map(r => `<tr onclick="ReportsPage.viewDate('${r.date}')" style="cursor:pointer" class="${r.date === this.selectedDate ? 'report-row-active' : ''}">
            <td><strong>${this.formatDateShort(r.date)}</strong><br><span style="font-size:0.75rem;color:var(--text-muted)">${this.getDayOfWeek(r.date)}</span></td>
            <td style="text-align:center;font-weight:600">${r.totalPatients || '—'}</td>
            <td style="text-align:center;color:#22c55e">${r.admissions || '0'}</td>
            <td style="text-align:center;color:#f59e0b">${r.discharges || '0'}</td>
            <td style="text-align:center">${r.surgeryTotal || '0'}</td>
            <td style="font-size:0.82rem;color:var(--text-secondary)">${r.reporterName || '—'}</td>
            <td><button class="btn-icon" onclick="event.stopPropagation();ReportsPage.viewDate('${r.date}')" title="Xem">👁</button></td>
        </tr>`).join('');
    },

    renderReportHistory(reports) {
        const sorted = [...reports].sort((a, b) => b.date.localeCompare(a.date));
        const recent = sorted.slice(0, 5);
        const archive = sorted.slice(5);
        if (!recent.length) return '<p style="color:var(--text-muted);font-size:0.82rem">Chưa có lịch sử báo cáo</p>';

        const tableHead = `<thead><tr>
            <th>Ngày</th><th>Tổng BN</th><th>Nhập</th><th>Xuất</th><th>Ca mổ</th><th>BS báo cáo</th><th style="width:60px"></th>
        </tr></thead>`;

        let html = `<div class="card staff-table-card"><table>
            ${tableHead}
            <tbody>${this._renderHistoryRows(recent)}</tbody>
        </table></div>`;

        if (archive.length > 0) {
            html += `<div style="margin-top:10px">
                <button class="btn btn-secondary btn-sm" style="font-size:0.78rem" onclick="ReportsPage.toggleArchive()">
                    ${this._showArchive ? '📁 Ẩn lưu trữ' : `📂 Xem lưu trữ (${archive.length} báo cáo cũ)`}
                </button>
                ${this._showArchive ? `<div class="card staff-table-card" style="margin-top:8px;opacity:0.85"><table>
                    ${tableHead}
                    <tbody>${this._renderHistoryRows(archive)}</tbody>
                </table></div>` : ''}
            </div>`;
        }

        return html;
    },

    // ========== FORM 16h ==========
    openReport16hForm(editDate) {
        const date = editDate || this.selectedDate;
        const reports = Store.getAll('reports16h') || [];
        const existing = reports.find(r => r.date === date);
        const session = Auth.getSession();
        const autoPatients = this.getAutoPatientCount();

        const doctors = Store.getAll('staff').filter(s =>
            s.role.includes('Bác sĩ') || s.role.includes('Trưởng khoa') || s.role.includes('Phó trưởng khoa')
        );

        const e = existing || {};
        // #1: Auto-fill patient count from EMR if creating new report
        const defaultPatients = e.totalPatients || (autoPatients > 0 ? autoPatients : '');
        // #3: Auto-sync reporter name = current logged-in user
        const defaultReporter = e.reporterName || session?.name || '';

        Modal.open(`🩺 Báo cáo 16h — ${this.formatDateVN(date)}`, `
            <form onsubmit="ReportsPage.saveReport16h(event, '${date}')" style="max-height:70vh;overflow-y:auto">
                <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:10px 14px;border-radius:8px;margin-bottom:12px;color:#fff">
                    <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8">KHOA PTĐTT — BV BÌNH DÂN</div>
                    <div style="font-size:0.92rem;font-weight:700;color:#fff">📌 Báo cáo trực khoa lúc 16g — ${this.getDayOfWeek(date)}, ${this.formatDateVN(date)}</div>
                </div>

                ${autoPatients > 0 ? `<div style="background:#ecfdf5;border:1px solid #a7f3d0;padding:8px 12px;border-radius:8px;margin-bottom:10px;font-size:0.82rem;color:#065f46;display:flex;justify-content:space-between;align-items:center">
                    <span>✅ Số BN hệ thống EMR: <strong>${autoPatients}</strong> bệnh nhân</span>
                    ${existing ? `<button type="button" style="background:#059669;color:#fff;border:none;padding:4px 10px;border-radius:6px;font-size:0.78rem;cursor:pointer" onclick="document.querySelector('input[name=totalPatients]').value=${autoPatients};this.parentElement.querySelector('span').innerHTML='✅ Đã đồng bộ: <strong>${autoPatients}</strong>'">🔄 Đồng bộ</button>` : ''}
                </div>` : ''}

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                    <div class="form-group">
                        <label>Tổng số BN <span style="color:var(--danger)">*</span></label>
                        <input type="number" name="totalPatients" value="${defaultPatients}" required min="0" placeholder="VD: 65">
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
                        ${doctors.map(d => `<option value="${d.name}" ${d.name === defaultReporter ? 'selected' : ''}>${d.name} (${d.title})</option>`).join('')}
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

        if (!Store._data.reports16h) Store._data.reports16h = [];
        const idx = Store._data.reports16h.findIndex(r => r.date === date);
        if (idx >= 0) {
            report.createdAt = Store._data.reports16h[idx].createdAt;
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

    // ========== EXPORT JPEG — Pure Canvas (guaranteed to work) ==========
    exportReportImage() {
        const reports = Store.getAll('reports16h') || [];
        const r = reports.find(rr => rr.date === this.selectedDate);
        if (!r) return Toast.error('Không có báo cáo để xuất');

        Toast.info('Đang tạo hình ảnh...');

        // Use setTimeout to let toast render first
        setTimeout(() => this._drawAndDownload(r), 100);
    },

    _drawAndDownload(r) {
        const W = 800;
        const scale = 2;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Pre-calculate height
        let contentH = 320; // header + stats
        if (r.severePatients) contentH += 60;
        if (r.surgeryTotal > 0 || r.surgeryDay) contentH += 55;
        if (r.notes) contentH += 55;
        contentH += 45; // footer
        const H = contentH;

        canvas.width = W * scale;
        canvas.height = H * scale;
        ctx.scale(scale, scale);

        // ===== Background =====
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        // ===== Header: Dark slate =====
        const hGrad = ctx.createLinearGradient(0, 0, W, 0);
        hGrad.addColorStop(0, '#0f172a');
        hGrad.addColorStop(0.5, '#1e293b');
        hGrad.addColorStop(1, '#334155');
        ctx.fillStyle = hGrad;
        this._roundRectTop(ctx, 0, 0, W, 100, 0);
        ctx.fill();

        // Header text — NO EMOJI to prevent tainted canvas, but Vietnamese diacritics are safe
        ctx.textAlign = 'left';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 10px Inter, system-ui, sans-serif';
        ctx.fillText('KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG  —  BỆNH VIỆN BÌNH DÂN', 24, 30);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Inter, system-ui, sans-serif';
        ctx.fillText('BÁO CÁO TRỰC KHOA LÚC 16G', 24, 58);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '500 14px Inter, system-ui, sans-serif';
        ctx.fillText(`${this.getDayOfWeek(r.date)} — Ngày ${this.formatDateVN(r.date)}`, 24, 82);

        // ===== Stat Boxes =====
        const boxY = 118;
        const boxH = 80;
        const gap = 12;
        const boxW = (W - 24 * 2 - gap * 3) / 4;

        const stats = [
            { label: 'TỔNG BN', value: r.totalPatients || '—', bg: '#1e40af' },
            { label: 'MỔ CHƯA VỀ', value: r.postOpNotReturned || '0', bg: '#ea580c' },
            { label: 'NHẬP VIỆN', value: r.admissions || '0', bg: '#16a34a' },
            { label: 'XUẤT VIỆN', value: r.discharges || '0', bg: '#ca8a04' },
        ];

        stats.forEach((s, i) => {
            const x = 24 + i * (boxW + gap);
            ctx.fillStyle = s.bg;
            this._roundRect(ctx, x, boxY, boxW, boxH, 10);
            ctx.fill();

            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = 'bold 9px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(s.label, x + boxW / 2, boxY + 24);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 34px Inter, system-ui, sans-serif';
            ctx.fillText(String(s.value), x + boxW / 2, boxY + 62);
        });

        let curY = boxY + boxH + 20;
        ctx.textAlign = 'left';

        // ===== Severe patients =====
        if (r.severePatients) {
            const blockH = 50;
            ctx.fillStyle = '#fef2f2';
            this._roundRect(ctx, 24, curY, W - 48, blockH, 6);
            ctx.fill();
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(24, curY, 4, blockH);

            ctx.fillStyle = '#dc2626';
            ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            ctx.fillText('[!] BỆNH PHÒNG NẶNG', 38, curY + 20);
            ctx.fillStyle = '#7f1d1d';
            ctx.font = '13px Inter, system-ui, sans-serif';
            const sevText = r.severePatients.length > 80 ? r.severePatients.substring(0, 77) + '...' : r.severePatients;
            ctx.fillText(sevText, 38, curY + 40);
            curY += blockH + 10;
        }

        // ===== Surgery =====
        if (r.surgeryTotal > 0 || r.surgeryDay) {
            const blockH = 45;
            ctx.fillStyle = '#eff6ff';
            this._roundRect(ctx, 24, curY, W - 48, blockH, 6);
            ctx.fill();
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(24, curY, 4, blockH);

            ctx.fillStyle = '#1d4ed8';
            ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            ctx.fillText(`BỆNH MỔ ${this.getDayOfWeek(r.date).toUpperCase()}`, 38, curY + 18);
            ctx.fillStyle = '#1e3a8a';
            ctx.font = 'bold 14px Inter, system-ui, sans-serif';
            ctx.fillText(`${r.surgeryTotal || 0} ca  (${r.surgeryCT || 0} Chương trình, ${r.surgeryYC || 0} Yêu cầu)`, 38, curY + 37);
            curY += blockH + 10;
        }

        // ===== Notes =====
        if (r.notes) {
            const blockH = 45;
            ctx.fillStyle = '#f8fafc';
            this._roundRect(ctx, 24, curY, W - 48, blockH, 6);
            ctx.fill();
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(24, curY, 4, blockH);

            ctx.fillStyle = '#475569';
            ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            ctx.fillText('GHI CHÚ', 38, curY + 18);
            ctx.fillStyle = '#334155';
            ctx.font = '13px Inter, system-ui, sans-serif';
            const noteText = r.notes.length > 80 ? r.notes.substring(0, 77) + '...' : r.notes;
            ctx.fillText(noteText, 38, curY + 37);
            curY += blockH + 10;
        }

        // ===== Footer =====
        const footY = curY + 5;
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, footY, W, 35);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, footY);
        ctx.lineTo(W, footY);
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`BS trực: ${r.reporterName || ''}`, 24, footY + 22);
        ctx.textAlign = 'right';
        const timeStr = r.createdAt ? new Date(r.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '16:00';
        ctx.fillText(`Báo cáo lúc: ${timeStr}`, W - 24, footY + 22);

        // ===== Watermark =====
        ctx.save();
        ctx.translate(W / 2, (footY + 100) / 2);
        ctx.rotate(-25 * Math.PI / 180);
        ctx.font = 'bold 64px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.035)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Khoa PTDTT', 0, -10);
        ctx.font = '22px Inter, system-ui, sans-serif';
        ctx.fillText('Bệnh viện Bình Dân', 0, 35);
        ctx.restore();

        // ===== Trim canvas to actual height =====
        const finalH = footY + 35;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = W * scale;
        outCanvas.height = finalH * scale;
        const outCtx = outCanvas.getContext('2d');
        outCtx.drawImage(canvas, 0, 0, W * scale, finalH * scale, 0, 0, W * scale, finalH * scale);

        // ===== Download as JPEG =====
        outCanvas.toBlob(blob => {
            if (!blob) {
                Toast.error('Không thể tạo file JPEG');
                return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `BaoCao16h_${this.selectedDate.replace(/-/g, '')}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            Toast.success('Đã tải file JPEG thành công!');
        }, 'image/jpeg', 0.95);
    },

    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    },

    _roundRectTop(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    },

    // ========== REPORT 7H (placeholder) ==========
    renderReport7h() {
        return `
        <div class="card" style="text-align:center;padding:40px">
            <div style="font-size:2.5rem;margin-bottom:12px">🚧</div>
            <p style="font-size:1rem;font-weight:600;color:var(--text-secondary)">Đang phát triển</p>
            <p style="font-size:0.85rem;color:var(--text-muted)">Form báo cáo 7h sáng (Điều dưỡng) sẽ được triển khai sau</p>
        </div>`;
    },

    // ========== HELPERS ==========
    changeDate(date) { this.selectedDate = date; App.renderCurrentPage(); },
    goToday() { this.selectedDate = new Date().toISOString().split('T')[0]; App.renderCurrentPage(); },
    viewDate(date) { this.selectedDate = date; App.renderCurrentPage(); },
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
