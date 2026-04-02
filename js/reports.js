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
        const emr = (typeof EMR !== 'undefined') ? EMR.getData() : null;
        if (emr && emr.totalDept > 0) return emr.totalDept;
        const pStats = Store.getPatientStats();
        return pStats ? (pStats.total - pStats.discharged) : 0;
    },

    // ========== REPORT 16H ==========
    renderReport16h() {
        const reports = Store.getAll('reports16h') || [];
        const session = Auth.getSession();
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
                    📸 Xuất hình Zalo
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
        const canEdit = session?.isAdmin || r.createdBy === session?.username;

        return `
        <div id="report-export-area">
        <div class="card" style="padding:0;overflow:hidden;border:none;box-shadow:0 2px 16px rgba(0,0,0,0.10)">
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#1e3a5f 0%,#0c4a6e 50%,#155e75 100%);padding:16px 20px;color:#fff;position:relative">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                    <div>
                        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:2px;opacity:0.7;margin-bottom:4px">KHOA PT ĐẠI TRỰC TRÀNG — BỆNH VIỆN BÌNH DÂN</div>
                        <h2 style="font-size:1.15rem;font-weight:800;margin:0;letter-spacing:0.5px">🩺 BÁO CÁO TRỰC KHOA LÚC 16G</h2>
                        <div style="font-size:0.88rem;margin-top:4px;opacity:0.9;font-weight:500">${this.getDayOfWeek(r.date)} — Ngày ${this.formatDateVN(r.date)}</div>
                    </div>
                    <div style="text-align:right" class="report-no-export">
                        ${canEdit ? `<button class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);font-size:0.72rem;cursor:pointer;backdrop-filter:blur(4px)" onclick="ReportsPage.openReport16hForm('${r.date}')">✏️ Sửa</button>` : ''}
                    </div>
                </div>
            </div>

            <!-- Stats Grid -->
            <div style="padding:16px 20px;background:#fff">
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
                    <div style="padding:14px 12px;text-align:center;background:linear-gradient(135deg,#dbeafe,#eff6ff);border-right:1px solid #e2e8f0">
                        <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;margin-bottom:4px">TỔNG BN</div>
                        <div style="font-size:2rem;font-weight:800;color:#1e3a5f">${r.totalPatients || '—'}</div>
                    </div>
                    <div style="padding:14px 12px;text-align:center;border-right:1px solid #e2e8f0">
                        <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;margin-bottom:4px">MỔ CHƯA VỀ</div>
                        <div style="font-size:2rem;font-weight:800;color:#ea580c">${r.postOpNotReturned || '0'}</div>
                    </div>
                    <div style="padding:14px 12px;text-align:center;background:linear-gradient(135deg,#dcfce7,#f0fdf4);border-right:1px solid #e2e8f0">
                        <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;margin-bottom:4px">NHẬP VIỆN</div>
                        <div style="font-size:2rem;font-weight:800;color:#16a34a">${r.admissions || '0'}</div>
                    </div>
                    <div style="padding:14px 12px;text-align:center;background:linear-gradient(135deg,#fef9c3,#fefce8)">
                        <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;margin-bottom:4px">XUẤT VIỆN</div>
                        <div style="font-size:2rem;font-weight:800;color:#ca8a04">${r.discharges || '0'}</div>
                    </div>
                </div>
            </div>

            <!-- Detail sections -->
            <div style="padding:0 20px 16px;background:#fff">
                ${r.severePatients ? `
                <div style="background:linear-gradient(135deg,#fef2f2,#fff1f2);border-left:4px solid #ef4444;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:10px">
                    <div style="font-weight:700;color:#dc2626;font-size:0.82rem;margin-bottom:2px">⚠️ BỆNH PHÒNG NẶNG</div>
                    <div style="font-size:0.88rem;color:#7f1d1d;line-height:1.4">${r.severePatients}</div>
                </div>` : ''}

                ${(r.surgeryTotal > 0 || r.surgeryDay) ? `
                <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-left:4px solid #3b82f6;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:10px">
                    <div style="font-weight:700;color:#1d4ed8;font-size:0.82rem;margin-bottom:2px">🔪 BỆNH MỔ ${this.getDayOfWeek(r.date).toUpperCase()}</div>
                    <div style="font-size:0.95rem;color:#1e3a8a;font-weight:600">${r.surgeryTotal || '0'} ca <span style="font-weight:400;font-size:0.85rem">(${r.surgeryCT || '0'} Chương trình, ${r.surgeryYC || '0'} Yêu cầu)</span></div>
                </div>` : ''}

                ${r.notes ? `
                <div style="background:#f8fafc;border-left:4px solid #94a3b8;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:10px">
                    <div style="font-weight:700;color:#475569;font-size:0.82rem;margin-bottom:2px">📝 GHI CHÚ</div>
                    <div style="font-size:0.88rem;color:#334155;line-height:1.4">${r.notes}</div>
                </div>` : ''}
            </div>

            <!-- Footer -->
            <div style="padding:10px 20px;background:#f1f5f9;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:0.78rem;color:#64748b">
                <span>👤 BS trực: <strong style="color:#1e3a5f">${r.reporterName || r.createdBy || 'Chưa rõ'}</strong></span>
                <span>🕐 Báo cáo lúc: <strong>${r.createdAt ? new Date(r.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'}) : '16:00'}</strong></span>
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
        const defaultPatients = e.totalPatients || (autoPatients > 0 ? autoPatients : '');

        Modal.open(`🩺 Báo cáo 16h — ${this.formatDateVN(date)}`, `
            <form onsubmit="ReportsPage.saveReport16h(event, '${date}')" style="max-height:70vh;overflow-y:auto">
                <div style="background:linear-gradient(135deg,#1e3a5f,#155e75);padding:10px 14px;border-radius:8px;margin-bottom:12px;color:#fff">
                    <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:1.5px;opacity:0.7">KHOA PTĐTT — BV BÌNH DÂN</div>
                    <div style="font-size:0.92rem;font-weight:700">📌 Báo cáo trực khoa lúc 16g — ${this.getDayOfWeek(date)}, ${this.formatDateVN(date)}</div>
                </div>

                ${autoPatients > 0 && !existing ? `<div style="background:#ecfdf5;border:1px solid #a7f3d0;padding:8px 12px;border-radius:8px;margin-bottom:10px;font-size:0.82rem;color:#065f46">
                    ✅ Tổng BN tự động cập nhật từ hệ thống: <strong>${autoPatients}</strong> bệnh nhân
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
                        ${doctors.map(d => `<option value="${d.name}" ${(e.reporterName === d.name || (!e.reporterName && d.name === session?.name)) ? 'selected' : ''}>${d.name} (${d.title})</option>`).join('')}
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

    // ========== EXPORT JPEG with Watermark ==========
    async exportReportImage() {
        const area = document.getElementById('report-export-area');
        if (!area) return Toast.error('Không tìm thấy báo cáo để xuất');

        // Hide edit buttons during export
        area.querySelectorAll('.report-no-export').forEach(el => el.style.display = 'none');

        Toast.info('Đang tạo hình ảnh...');

        try {
            // Use canvas to render the report card
            const card = area.querySelector('.card');
            if (!card) return;

            const rect = card.getBoundingClientRect();
            const scale = 2; // Retina quality
            const W = rect.width * scale;
            const H = rect.height * scale;

            const canvas = document.createElement('canvas');
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext('2d');

            // Draw white background
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, W, H);

            // Render HTML to canvas using foreignObject in SVG
            const clone = card.cloneNode(true);
            clone.querySelectorAll('.report-no-export').forEach(el => el.remove());
            // Set fixed width for consistent rendering
            clone.style.width = rect.width + 'px';
            clone.style.boxShadow = 'none';
            clone.style.border = 'none';

            const data = new XMLSerializer().serializeToString(clone);
            const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
                <foreignObject width="100%" height="100%">
                    <div xmlns="http://www.w3.org/1999/xhtml">${data}</div>
                </foreignObject>
            </svg>`;

            const img = new Image();
            const svgBlob = new Blob([svgStr], {type: 'image/svg+xml;charset=utf-8'});
            const url = URL.createObjectURL(svgBlob);

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error('SVG render failed'));
                img.src = url;
            });

            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);

            // Draw watermark "Khoa PTĐTT"
            ctx.save();
            ctx.scale(1/scale, 1/scale); // Reset to pixel coords
            ctx.translate(W/2, H/2);
            ctx.rotate(-25 * Math.PI / 180);
            ctx.font = `bold ${Math.max(W * 0.08, 40)}px Inter, system-ui, sans-serif`;
            ctx.fillStyle = 'rgba(30, 58, 95, 0.06)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Khoa PTĐTT', 0, 0);
            // Second watermark line smaller
            ctx.font = `${Math.max(W * 0.03, 16)}px Inter, system-ui, sans-serif`;
            ctx.fillText('Bệnh viện Bình Dân', 0, W * 0.06);
            ctx.restore();

            // Convert to JPEG
            canvas.toBlob(blob => {
                if (!blob) {
                    // Fallback: manual pixel rendering
                    this._exportFallback();
                    return;
                }
                const a = document.createElement('a');
                const reports = Store.getAll('reports16h') || [];
                const r = reports.find(r => r.date === this.selectedDate);
                const dateStr = this.selectedDate.replace(/-/g, '');
                a.download = `BaoCao16h_${dateStr}.jpg`;
                a.href = URL.createObjectURL(blob);
                a.click();
                URL.revokeObjectURL(a.href);
                Toast.success('Đã xuất hình JPEG!');
            }, 'image/jpeg', 0.92);

        } catch (err) {
            console.warn('SVG export failed, using fallback:', err);
            this._exportFallback();
        } finally {
            // Restore hidden elements
            area.querySelectorAll('.report-no-export').forEach(el => el.style.display = '');
        }
    },

    // Fallback: Pure canvas rendering (no foreignObject dependency)
    _exportFallback() {
        const reports = Store.getAll('reports16h') || [];
        const r = reports.find(rr => rr.date === this.selectedDate);
        if (!r) return;

        const W = 800, H = 520;
        const canvas = document.createElement('canvas');
        canvas.width = W * 2;
        canvas.height = H * 2;
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);

        // Background
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, H);

        // Header gradient
        const hGrad = ctx.createLinearGradient(0, 0, W, 80);
        hGrad.addColorStop(0, '#1e3a5f');
        hGrad.addColorStop(0.5, '#0c4a6e');
        hGrad.addColorStop(1, '#155e75');
        ctx.fillStyle = hGrad;
        ctx.fillRect(0, 0, W, 95);

        // Header text
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('KHOA PT ĐẠI TRỰC TRÀNG — BỆNH VIỆN BÌNH DÂN', 24, 25);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Inter, system-ui, sans-serif';
        ctx.fillText('🩺  BÁO CÁO TRỰC KHOA LÚC 16G', 24, 52);

        ctx.font = '14px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(`${this.getDayOfWeek(r.date)} — Ngày ${this.formatDateVN(r.date)}`, 24, 78);

        // Stat boxes
        const boxY = 115;
        const boxH = 80;
        const boxW = (W - 24 * 2 - 10 * 3) / 4;

        const stats = [
            { label: 'TỔNG BN', value: r.totalPatients || '—', bg: '#dbeafe', color: '#1e3a5f' },
            { label: 'MỔ CHƯA VỀ', value: r.postOpNotReturned || '0', bg: '#fff7ed', color: '#ea580c' },
            { label: 'NHẬP VIỆN', value: r.admissions || '0', bg: '#dcfce7', color: '#16a34a' },
            { label: 'XUẤT VIỆN', value: r.discharges || '0', bg: '#fef9c3', color: '#ca8a04' },
        ];

        stats.forEach((s, i) => {
            const x = 24 + i * (boxW + 10);
            // Box background
            ctx.fillStyle = s.bg;
            this._roundRect(ctx, x, boxY, boxW, boxH, 8);
            ctx.fill();
            // Border
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            this._roundRect(ctx, x, boxY, boxW, boxH, 8);
            ctx.stroke();
            // Label
            ctx.fillStyle = '#64748b';
            ctx.font = 'bold 9px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(s.label, x + boxW/2, boxY + 22);
            // Value
            ctx.fillStyle = s.color;
            ctx.font = 'bold 32px Inter, system-ui, sans-serif';
            ctx.fillText(String(s.value), x + boxW/2, boxY + 60);
        });

        let curY = boxY + boxH + 20;
        ctx.textAlign = 'left';

        // Severe patients
        if (r.severePatients) {
            ctx.fillStyle = '#fef2f2';
            this._roundRect(ctx, 24, curY, W - 48, 50, 6);
            ctx.fill();
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(24, curY, 4, 50);
            ctx.fillStyle = '#dc2626';
            ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            ctx.fillText('⚠️  BỆNH PHÒNG NẶNG', 38, curY + 18);
            ctx.fillStyle = '#7f1d1d';
            ctx.font = '12px Inter, system-ui, sans-serif';
            ctx.fillText(r.severePatients.substring(0, 80), 38, curY + 38);
            curY += 62;
        }

        // Surgery info
        if (r.surgeryTotal > 0 || r.surgeryDay) {
            ctx.fillStyle = '#eff6ff';
            this._roundRect(ctx, 24, curY, W - 48, 45, 6);
            ctx.fill();
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(24, curY, 4, 45);
            ctx.fillStyle = '#1d4ed8';
            ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            ctx.fillText(`🔪  BỆNH MỔ ${this.getDayOfWeek(r.date).toUpperCase()}`, 38, curY + 18);
            ctx.fillStyle = '#1e3a8a';
            ctx.font = 'bold 13px Inter, system-ui, sans-serif';
            ctx.fillText(`${r.surgeryTotal || 0} ca  (${r.surgeryCT || 0} Chương trình,  ${r.surgeryYC || 0} Yêu cầu)`, 38, curY + 36);
            curY += 57;
        }

        // Notes
        if (r.notes) {
            ctx.fillStyle = '#f8fafc';
            this._roundRect(ctx, 24, curY, W - 48, 45, 6);
            ctx.fill();
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(24, curY, 4, 45);
            ctx.fillStyle = '#475569';
            ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            ctx.fillText('📝  GHI CHÚ', 38, curY + 18);
            ctx.fillStyle = '#334155';
            ctx.font = '12px Inter, system-ui, sans-serif';
            ctx.fillText(r.notes.substring(0, 80), 38, curY + 36);
            curY += 57;
        }

        // Footer
        const footY = Math.max(curY + 10, H - 35);
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, footY, W, 35);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, footY);
        ctx.lineTo(W, footY);
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`👤 BS trực: ${r.reporterName || ''}`, 24, footY + 22);
        ctx.textAlign = 'right';
        const timeStr = r.createdAt ? new Date(r.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : '16:00';
        ctx.fillText(`🕐 Báo cáo lúc: ${timeStr}`, W - 24, footY + 22);

        // Watermark
        ctx.save();
        ctx.translate(W/2, (footY + 95)/2);
        ctx.rotate(-25 * Math.PI / 180);
        ctx.font = 'bold 60px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(30, 58, 95, 0.04)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Khoa PTĐTT', 0, 0);
        ctx.font = '20px Inter, system-ui, sans-serif';
        ctx.fillText('Bệnh viện Bình Dân', 0, 40);
        ctx.restore();

        // Resize canvas to actual content height
        const finalH = Math.max(curY + 50, footY + 35);
        const outCanvas = document.createElement('canvas');
        outCanvas.width = W * 2;
        outCanvas.height = finalH * 2;
        const outCtx = outCanvas.getContext('2d');
        outCtx.drawImage(canvas, 0, 0);

        outCanvas.toBlob(blob => {
            const a = document.createElement('a');
            a.download = `BaoCao16h_${this.selectedDate.replace(/-/g, '')}.jpg`;
            a.href = URL.createObjectURL(blob);
            a.click();
            URL.revokeObjectURL(a.href);
            Toast.success('Đã xuất hình JPEG!');
        }, 'image/jpeg', 0.92);
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
