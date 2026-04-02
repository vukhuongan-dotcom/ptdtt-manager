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
                🩺 Báo cáo 16h <span class="staff-subtab-count">BS trực khoa</span>
            </button>
            <button class="staff-subtab ${this.activeTab === 'report7h' ? 'active' : ''}" onclick="ReportsPage.switchTab('report7h')">
                👩‍⚕️ Báo cáo 7h <span class="staff-subtab-count">ĐD trực BV</span>
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
        const isWeekend = this._isWeekend(this.selectedDate);

        return `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <div style="display:flex;gap:8px;align-items:center">
                <label style="font-weight:600;font-size:0.85rem;color:var(--text-secondary)">Ngày:</label>
                <input type="date" value="${this.selectedDate}" onchange="ReportsPage.changeDate(this.value)"
                    style="padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-size:0.85rem;font-family:'Inter',system-ui,sans-serif;background:var(--bg-card);color:var(--text-primary)">
                <button class="btn btn-secondary btn-sm" style="font-size:0.78rem" onclick="ReportsPage.goToday()">Hôm nay</button>
            </div>
            ${!isWeekend ? `<div style="display:flex;gap:8px">
                ${todayReport ? `<button class="btn btn-sm" style="background:#f97316;color:#fff;border:none;font-size:0.78rem" onclick="ReportsPage.exportReportImage()">
                    📸 Xuất hình trực khoa
                </button>` : ''}
                ${!todayReport ? `<button class="btn btn-primary" onclick="ReportsPage.openReport16hForm()">
                    ${Utils.plusIcon()} Tạo báo cáo
                </button>` : ''}
            </div>` : ''}
        </div>

        ${isWeekend ? this.renderWeekendNotice() : (todayReport ? this.renderReport16hCard(todayReport) : this.renderNoReport())}

        <div style="margin-top:20px">
            <h3 style="font-size:0.9rem;font-weight:600;color:var(--text-secondary);margin-bottom:10px">📋 Lịch sử báo cáo gần đây</h3>
            ${this.renderReportHistory(reports)}
        </div>
        `;
    },

    renderWeekendNotice() {
        return `
        <div class="card" style="text-align:center;padding:40px;background:linear-gradient(135deg,#fefce8,#fef9c3);border:1px solid #fde68a">
            <div style="font-size:2.5rem;margin-bottom:12px">🏖️</div>
            <p style="font-size:1rem;font-weight:700;color:#92400e;margin-bottom:6px">${this.getDayOfWeek(this.selectedDate)} — Không trực khoa</p>
            <p style="font-size:0.85rem;color:#a16207">Thứ bảy và Chủ nhật không có báo cáo trực khoa 16h</p>
        </div>`;
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

            <!-- Stats: 5 high contrast colored cards in one row -->
            <div style="padding:16px 22px;background:#fff">
                <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px">
                    <div style="background:#0284c7;border-radius:10px;padding:12px 8px;text-align:center">
                        <div style="font-size:0.62rem;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.8);font-weight:600;margin-bottom:4px">TỔNG BN</div>
                        <div style="font-size:2rem;font-weight:800;color:#fff">${r.totalPatients || '—'}</div>
                    </div>
                    <div style="background:#e11d48;border-radius:10px;padding:12px 8px;text-align:center">
                        <div style="font-size:0.62rem;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.8);font-weight:600;margin-bottom:4px">MỔ CHƯA VỀ</div>
                        <div style="font-size:2rem;font-weight:800;color:#fff">${r.postOpNotReturned || '0'}</div>
                    </div>
                    <div style="background:#059669;border-radius:10px;padding:12px 8px;text-align:center">
                        <div style="font-size:0.62rem;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.8);font-weight:600;margin-bottom:4px">NHẬP VIỆN</div>
                        <div style="font-size:2rem;font-weight:800;color:#fff">${r.admissions || '0'}</div>
                    </div>
                    <div style="background:#d97706;border-radius:10px;padding:12px 8px;text-align:center">
                        <div style="font-size:0.62rem;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.8);font-weight:600;margin-bottom:4px">XUẤT VIỆN</div>
                        <div style="font-size:2rem;font-weight:800;color:#fff">${r.discharges || '0'}</div>
                    </div>
                    <div style="background:#7c3aed;border-radius:10px;padding:12px 8px;text-align:center">
                        <div style="font-size:0.62rem;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.8);font-weight:600;margin-bottom:4px">BN NẶNG</div>
                        <div style="font-size:2rem;font-weight:800;color:#fff">${r.severePatients || '0'}</div>
                    </div>
                </div>
            </div>

            <!-- Detail sections -->
            <div style="padding:0 22px 16px;background:#fff">
                ${(r.surgeryTotal > 0 || r.surgeryDay) ? `
                <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:10px">
                    <div style="font-weight:700;color:#1d4ed8;font-size:0.82rem;margin-bottom:3px">BỆNH MỔ ${this.getDayOfWeek(this._getNextDay(r.date)).toUpperCase()} (${this.formatDateShort(this._getNextDay(r.date))})</div>
                    <div style="font-size:0.95rem;color:#1e3a8a;font-weight:600">${r.surgeryTotal || '0'} ca <span style="font-weight:400;font-size:0.85rem">(${r.surgeryCT || '0'} Chương trình, ${r.surgeryYC || '0'} Yêu cầu)</span></div>
                </div>` : ''}

                ${this._isFriday(r.date) && (r.surgery2Total > 0) ? `
                <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:10px">
                    <div style="font-weight:700;color:#15803d;font-size:0.82rem;margin-bottom:3px">BỆNH MỔ ${this.getDayOfWeek(this._getNextDay(r.date, 3)).toUpperCase()} (${this.formatDateShort(this._getNextDay(r.date, 3))})</div>
                    <div style="font-size:0.95rem;color:#166534;font-weight:600">${r.surgery2Total || '0'} ca <span style="font-weight:400;font-size:0.85rem">(${r.surgery2CT || '0'} Chương trình, ${r.surgery2YC || '0'} Yêu cầu)</span></div>
                </div>` : ''}

                ${r.notes ? `
                <div style="background:#f8fafc;border-left:4px solid #94a3b8;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:10px">
                    <div style="font-weight:700;color:#475569;font-size:0.82rem;margin-bottom:3px">GHI CHÚ</div>
                    <div style="font-size:0.88rem;color:#334155;line-height:1.5">${r.notes}</div>
                </div>` : ''}
            </div>

            <!-- Footer -->
            <div style="padding:10px 22px;background:#f1f5f9;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;color:#475569">
                <span>👤 BS trực khoa: <strong style="color:#0f172a">${r.reporterName || r.createdBy || 'Chưa rõ'}</strong></span>
                <span>🕐 Báo cáo lúc: <strong>${(r.updatedAt || r.createdAt) ? new Date(r.updatedAt || r.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'}) : '16:00'}</strong></span>
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
            s.role.includes('Bác sĩ') && !s.role.includes('Trưởng khoa') && !s.role.includes('Phó trưởng khoa')
        );

        const e = existing || {};
        const defaultPatients = e.totalPatients || (autoPatients > 0 ? autoPatients : '');
        const defaultReporter = e.reporterName || session?.name || '';

        // Stepper helper
        const stepper16 = (name, val, color, label) => `
            <div style="text-align:center">
                <div style="font-size:0.68rem;font-weight:700;color:${color};margin-bottom:3px;white-space:nowrap">${label}</div>
                <div style="display:flex;align-items:center;gap:3px;justify-content:center">
                    <button type="button" onclick="this.parentNode.querySelector('input').stepDown();this.parentNode.querySelector('input').dispatchEvent(new Event('input'))"
                        style="width:28px;height:28px;border:none;border-radius:6px;background:${color}18;color:${color};font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center">−</button>
                    <input type="number" name="${name}" value="${val}" min="0" style="width:44px;text-align:center;font-size:1rem;font-weight:700;border:2px solid ${color}44;border-radius:6px;padding:3px 1px;color:${color}">
                    <button type="button" onclick="this.parentNode.querySelector('input').stepUp();this.parentNode.querySelector('input').dispatchEvent(new Event('input'))"
                        style="width:28px;height:28px;border:none;border-radius:6px;background:${color}18;color:${color};font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center">+</button>
                </div>
            </div>`;

        // Doctor chips (exclude trưởng/phó khoa)
        const docChips = doctors.map(d => {
            const shortName = d.name.replace(/^(Nguyễn|Trần|Phạm|Lê|Bùi|Phan|Huỳnh|Lý)\s/, (m) => m.charAt(0) + '. ');
            return `<button type="button" onclick="document.querySelector('#r16h-reporter').value='${d.name}';document.querySelectorAll('.r16h-chip').forEach(c=>{c.style.background='#f1f5f9';c.style.color='#334155';c.style.borderColor='#cbd5e1'});this.style.background='#0f172a';this.style.color='#fff';this.style.borderColor='#0f172a'"
                class="r16h-chip" style="padding:5px 8px;border-radius:6px;border:1px solid ${d.name===defaultReporter?'#0f172a':'#cbd5e1'};background:${d.name===defaultReporter?'#0f172a':'#f1f5f9'};color:${d.name===defaultReporter?'#fff':'#334155'};font-size:0.82rem;cursor:pointer;white-space:nowrap;transition:all .15s;text-align:center">${shortName}</button>`;
        }).join('');

        const nextDay = this._getNextDay(date);
        const nextDayLabel = `${this.getDayOfWeek(nextDay)} (${this.formatDateShort(nextDay)})`;
        const isFri = this._isFriday(date);

        Modal.open(`🩺 Báo cáo 16h — ${this.getDayOfWeek(date)}, ${this.formatDateVN(date)}`, `
            <form onsubmit="ReportsPage.saveReport16h(event, '${date}')">

                <!-- Row 1: Tổng BN + Mổ chưa về -->
                <div style="display:flex;gap:8px;margin-bottom:8px">
                    <div style="flex:1;display:flex;align-items:center;gap:10px;padding:10px 12px;background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:10px">
                        <div style="flex:1;color:#fff">
                            <div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:600">TỔNG BN</div>
                        </div>
                        <input type="number" name="totalPatients" value="${defaultPatients}" required min="0"
                            style="width:62px;text-align:center;font-size:1.5rem;font-weight:800;border:none;border-radius:8px;padding:4px;background:rgba(255,255,255,0.12);color:#fff">
                    </div>
                    <div style="flex:1;display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fef3c7;border-radius:10px;border:1px solid #fbbf24">
                        <div style="flex:1">
                            <div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:1px;color:#92400e;font-weight:600">MỔ CHƯA VỀ</div>
                        </div>
                        <input type="number" name="postOpNotReturned" value="${e.postOpNotReturned || 0}" min="0"
                            style="width:52px;text-align:center;font-size:1.3rem;font-weight:800;border:2px solid #f59e0b44;border-radius:8px;padding:3px;color:#92400e;background:#fff">
                    </div>
                </div>

                <!-- Row 2: 3 steppers inline -->
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px">
                    <div style="background:#ecfdf5;border-radius:8px;padding:7px 4px">
                        ${stepper16('admissions', e.admissions || 0, '#059669', '🏥 Nhập viện')}
                    </div>
                    <div style="background:#fef2f2;border-radius:8px;padding:7px 4px">
                        ${stepper16('discharges', e.discharges || 0, '#dc2626', '📤 Xuất viện')}
                    </div>
                    <div style="background:#faf5ff;border-radius:8px;padding:7px 4px">
                        ${stepper16('severePatients', e.severePatients || 0, '#7c3aed', '⚠️ BN nặng')}
                    </div>
                </div>

                <!-- Row 3: Surgery next day -->
                <div style="background:#eff6ff;border-radius:8px;padding:8px 10px;margin-bottom:6px">
                    <div style="font-size:0.72rem;font-weight:700;color:#1d4ed8;margin-bottom:5px">🔪 Bệnh mổ ${nextDayLabel}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
                        ${stepper16('surgeryTotal', e.surgeryTotal || 0, '#1d4ed8', 'Tổng')}
                        ${stepper16('surgeryCT', e.surgeryCT || 0, '#0369a1', 'Chương trình')}
                        ${stepper16('surgeryYC', e.surgeryYC || 0, '#6366f1', 'Yêu cầu')}
                    </div>
                </div>

                ${isFri ? `
                <div style="background:#f0fdf4;border-radius:8px;padding:8px 10px;margin-bottom:6px">
                    <div style="font-size:0.72rem;font-weight:700;color:#15803d;margin-bottom:5px">🔪 Bệnh mổ ${this.getDayOfWeek(this._getNextDay(date, 3))} (${this.formatDateShort(this._getNextDay(date, 3))})</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
                        ${stepper16('surgery2Total', e.surgery2Total || 0, '#15803d', 'Tổng')}
                        ${stepper16('surgery2CT', e.surgery2CT || 0, '#059669', 'Chương trình')}
                        ${stepper16('surgery2YC', e.surgery2YC || 0, '#10b981', 'Yêu cầu')}
                    </div>
                </div>` : ''}

                <!-- Row 4: Doctor quick-select -->
                <div style="margin-bottom:6px">
                    <div style="font-size:0.75rem;font-weight:600;color:var(--text-secondary);margin-bottom:4px">👤 BS trực khoa báo cáo</div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">${docChips}</div>
                    <input type="hidden" id="r16h-reporter" name="reporterName" value="${defaultReporter}">
                </div>

                <!-- Row 5: Notes (collapsed) -->
                <details style="margin-bottom:8px" ${e.notes ? 'open' : ''}>
                    <summary style="cursor:pointer;font-size:0.78rem;font-weight:600;color:var(--text-secondary);padding:3px 0">📝 Ghi chú thêm (bấm để mở)</summary>
                    <textarea name="notes" rows="2" placeholder="Ghi chú khác (nếu có)..." style="margin-top:4px;width:100%;font-size:0.82rem">${e.notes || ''}</textarea>
                </details>

                <div class="modal-footer" style="padding-top:6px;border-top:1px solid var(--border)">
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
            severePatients: parseInt(fd.get('severePatients')) || 0,
            surgeryDay: true,
            surgeryTotal: parseInt(fd.get('surgeryTotal')) || 0,
            surgeryCT: parseInt(fd.get('surgeryCT')) || 0,
            surgeryYC: parseInt(fd.get('surgeryYC')) || 0,
            surgery2Total: parseInt(fd.get('surgery2Total')) || 0,
            surgery2CT: parseInt(fd.get('surgery2CT')) || 0,
            surgery2YC: parseInt(fd.get('surgery2YC')) || 0,
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

        try {
            this._drawAndDownload(r);
        } catch (err) {
            console.error('Export error:', err);
            Toast.error('Lỗi khi tạo hình: ' + err.message);
        }
    },

    _drawAndDownload(r) {
        const W = 800;
        const scale = 2;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Pre-calculate height
        let contentH = 320; // header + 5 stat boxes
        if (r.surgeryTotal > 0 || r.surgeryDay) contentH += 55;
        if (this._isFriday(r.date) && r.surgery2Total > 0) contentH += 55;
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
        const boxW = (W - 24 * 2 - gap * 4) / 5;

        const stats = [
            { label: 'TỔNG BN', value: r.totalPatients || '—', bg: '#0284c7' },
            { label: 'MỔ CHƯA VỀ', value: r.postOpNotReturned || '0', bg: '#e11d48' },
            { label: 'NHẬP VIỆN', value: r.admissions || '0', bg: '#059669' },
            { label: 'XUẤT VIỆN', value: r.discharges || '0', bg: '#d97706' },
            { label: 'BN NẶNG', value: r.severePatients || '0', bg: '#7c3aed' },
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

        // ===== Severe patients (now just a number, details in notes) =====
        // Removed separate severe patients section - it's now in the stat boxes

        // ===== Surgery (next day) =====
        const nextDay = this._getNextDay(r.date);
        if (r.surgeryTotal > 0 || r.surgeryDay) {
            const blockH = 45;
            ctx.fillStyle = '#eff6ff';
            this._roundRect(ctx, 24, curY, W - 48, blockH, 6);
            ctx.fill();
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(24, curY, 4, blockH);

            ctx.fillStyle = '#1d4ed8';
            ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            ctx.fillText(`BỆNH MỔ ${this.getDayOfWeek(nextDay).toUpperCase()} (${this.formatDateShort(nextDay)})`, 38, curY + 18);
            ctx.fillStyle = '#1e3a8a';
            ctx.font = 'bold 14px Inter, system-ui, sans-serif';
            ctx.fillText(`${r.surgeryTotal || 0} ca  (${r.surgeryCT || 0} Chương trình, ${r.surgeryYC || 0} Yêu cầu)`, 38, curY + 37);
            curY += blockH + 10;
        }

        // ===== Surgery 2 (Monday — only on Friday reports) =====
        if (this._isFriday(r.date) && r.surgery2Total > 0) {
            const monDay = this._getNextDay(r.date, 3);
            const blockH = 45;
            ctx.fillStyle = '#f0fdf4';
            this._roundRect(ctx, 24, curY, W - 48, blockH, 6);
            ctx.fill();
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(24, curY, 4, blockH);

            ctx.fillStyle = '#15803d';
            ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            ctx.fillText(`BỆNH MỔ ${this.getDayOfWeek(monDay).toUpperCase()} (${this.formatDateShort(monDay)})`, 38, curY + 18);
            ctx.fillStyle = '#166534';
            ctx.font = 'bold 14px Inter, system-ui, sans-serif';
            ctx.fillText(`${r.surgery2Total || 0} ca  (${r.surgery2CT || 0} Chương trình, ${r.surgery2YC || 0} Yêu cầu)`, 38, curY + 37);
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
        ctx.fillText(`BS trực khoa: ${r.reporterName || ''}`, 24, footY + 22);
        ctx.textAlign = 'right';
        const timeStr = (r.updatedAt || r.createdAt) ? new Date(r.updatedAt || r.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '16:00';
        ctx.fillText(`Báo cáo lúc: ${timeStr}`, W - 24, footY + 22);

        // ===== Watermark (diagonal bottom-left → top-right) =====
        ctx.save();
        const wmW = W;
        const wmH = footY + 100;
        ctx.translate(wmW / 2, wmH / 2);
        ctx.rotate(-Math.atan2(wmH, wmW));
        ctx.font = 'bold 42px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.04)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG', 0, -10);
        ctx.font = '20px Inter, system-ui, sans-serif';
        ctx.fillText('Bệnh viện Bình Dân', 0, 30);
        ctx.restore();

        // ===== Trim canvas to actual height =====
        const finalH = footY + 35;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = W * scale;
        outCanvas.height = finalH * scale;
        const outCtx = outCanvas.getContext('2d');
        outCtx.drawImage(canvas, 0, 0, W * scale, finalH * scale, 0, 0, W * scale, finalH * scale);

        // ===== Download as JPEG (cross-platform: desktop, iOS Safari, PWA) =====
        const dataUrl = outCanvas.toDataURL('image/jpeg', 0.95);
        const fileName = `BaoCao16h_${this.selectedDate.replace(/-/g, '')}.jpg`;

        // Detect iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (isIOS) {
            // iOS Safari doesn't support a.click() for blob downloads
            // Open the image in a new tab so user can long-press to save
            const w = window.open('', '_blank');
            if (w) {
                w.document.write(`
                    <html><head><title>${fileName}</title>
                    <meta name="viewport" content="width=device-width,initial-scale=1">
                    <style>body{margin:0;display:flex;justify-content:center;align-items:flex-start;background:#f1f5f9;padding:16px}
                    img{max-width:100%;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15)}
                    p{text-align:center;color:#475569;font-family:system-ui;font-size:14px;margin-top:12px}</style></head>
                    <body><div><img src="${dataUrl}"><p>Nhấn giữ hình để lưu về máy</p></div></body></html>
                `);
                w.document.close();
            } else {
                // Popup blocked — fallback to direct navigation
                window.location.href = dataUrl;
            }
        } else {
            // Desktop/Android: use standard download
            const byteStr = atob(dataUrl.split(',')[1]);
            const mimeStr = dataUrl.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteStr.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
            const blob = new Blob([ab], { type: mimeStr });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        }
        Toast.success('Đã tạo hình JPEG thành công!');
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

    // ========== REPORT 7H — Báo cáo sáng (Điều dưỡng) ==========
    renderReport7h() {
        const reports = Store.getAll('reports7h') || [];
        const todayReport = reports.find(r => r.date === this.selectedDate);

        return `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <div style="display:flex;gap:8px;align-items:center">
                <label style="font-weight:600;font-size:0.85rem;color:var(--text-secondary)">Ngày:</label>
                <input type="date" value="${this.selectedDate}" onchange="ReportsPage.changeDate(this.value)"
                    style="padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-size:0.85rem;font-family:'Inter',system-ui,sans-serif;background:var(--bg-card);color:var(--text-primary)">
                <button class="btn btn-secondary btn-sm" style="font-size:0.78rem" onclick="ReportsPage.goToday()">Hôm nay</button>
            </div>
            <div style="display:flex;gap:8px">
                ${todayReport ? `<button class="btn btn-sm" style="background:#f97316;color:#fff;border:none;font-size:0.78rem" onclick="ReportsPage.exportReport7hImage()">
                    📸 Xuất hình báo cáo 7h
                </button>` : ''}
                ${!todayReport ? `<button class="btn btn-primary" onclick="ReportsPage.openReport7hForm()">
                    ${Utils.plusIcon()} Tạo báo cáo 7h
                </button>` : ''}
            </div>
        </div>

        ${todayReport ? this.renderReport7hCard(todayReport) : `
        <div class="card" style="text-align:center;padding:40px">
            <div style="font-size:2.5rem;margin-bottom:12px">📋</div>
            <p style="font-size:0.95rem;color:var(--text-secondary);margin-bottom:8px">Chưa có báo cáo 7h cho ngày ${this.formatDateVN(this.selectedDate)}</p>
            <p style="font-size:0.82rem;color:var(--text-muted)">Bấm "Tạo báo cáo 7h" để bắt đầu</p>
        </div>`}

        <div style="margin-top:20px">
            <h3 style="font-size:0.9rem;font-weight:600;color:var(--text-secondary);margin-bottom:10px">📋 Lịch sử báo cáo 7h gần đây</h3>
            ${this.renderReport7hHistory(reports)}
        </div>
        `;
    },

    renderReport7hCard(r) {
        const session = Auth.getSession();
        const canEdit = !!session;

        return `
        <div id="report7h-export-area">
        <div class="card" style="padding:0;overflow:hidden;border:none;box-shadow:0 4px 20px rgba(0,0,0,0.12)">
            <div style="background:linear-gradient(135deg,#0c4a6e 0%,#075985 50%,#0369a1 100%);padding:18px 22px;color:#fff;position:relative">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                    <div>
                        <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:2.5px;color:#7dd3fc;margin-bottom:6px;font-weight:500">KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG — BỆNH VIỆN BÌNH DÂN</div>
                        <h2 style="font-size:1.25rem;font-weight:800;margin:0;letter-spacing:0.5px;color:#fff">👩‍⚕️ BÁO CÁO TÌNH HÌNH KHOA LÚC 7G SÁNG</h2>
                        <div style="font-size:0.9rem;margin-top:5px;color:#bae6fd;font-weight:500">${this.getDayOfWeek(r.date)} — Ngày ${this.formatDateVN(r.date)}</div>
                    </div>
                    <div class="report-no-export">
                        ${canEdit ? `<button class="btn btn-sm" style="background:rgba(255,255,255,0.12);color:#e0f2fe;border:1px solid rgba(255,255,255,0.25);font-size:0.72rem;cursor:pointer" onclick="ReportsPage.openReport7hForm('${r.date}')">✏️ Sửa</button>` : ''}
                    </div>
                </div>
            </div>

            <!-- Stats: 2 main cards -->
            <div style="padding:16px 22px;background:#fff">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
                    <div style="background:#0284c7;border-radius:10px;padding:12px 8px;text-align:center">
                        <div style="font-size:0.62rem;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.8);font-weight:600;margin-bottom:4px">TỔNG BN</div>
                        <div style="font-size:2rem;font-weight:800;color:#fff">${r.totalPatients || '—'}</div>
                    </div>
                    <div style="background:#059669;border-radius:10px;padding:12px 8px;text-align:center">
                        <div style="font-size:0.62rem;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.8);font-weight:600;margin-bottom:4px">NHẬN BN ĐÊM QUA</div>
                        <div style="font-size:2rem;font-weight:800;color:#fff">${(parseInt(r.fromHSCC) || 0) + (parseInt(r.fromHoiTinh) || 0) + (parseInt(r.fromGiaiAp) || 0)}</div>
                    </div>
                </div>
            </div>

            <!-- Detail sections -->
            <div style="padding:0 22px 16px;background:#fff">
                ${r.fromHSCC > 0 ? `
                <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:10px">
                    <div style="font-weight:700;color:#dc2626;font-size:0.82rem;margin-bottom:3px">🚑 NHẬN TỪ HSCC: ${r.fromHSCC} ca</div>
                    ${r.fromHSCCDetail ? `<div style="font-size:0.85rem;color:#991b1b;line-height:1.5">${r.fromHSCCDetail}</div>` : ''}
                </div>` : ''}

                ${r.fromHoiTinh > 0 ? `
                <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:10px">
                    <div style="font-weight:700;color:#2563eb;font-size:0.82rem;margin-bottom:3px">🏥 NHẬN TỪ HỒI TỈNH: ${r.fromHoiTinh} ca</div>
                    ${r.fromHoiTinhDetail ? `<div style="font-size:0.85rem;color:#1e40af;line-height:1.5">${r.fromHoiTinhDetail}</div>` : ''}
                </div>` : ''}

                ${r.fromGiaiAp > 0 ? `
                <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:10px">
                    <div style="font-weight:700;color:#16a34a;font-size:0.82rem;margin-bottom:3px">🔄 NHẬN GIẢI ÁP KHOA: ${r.fromGiaiAp} ca</div>
                    ${r.fromGiaiApDetail ? `<div style="font-size:0.85rem;color:#166534;line-height:1.5">${r.fromGiaiApDetail}</div>` : ''}
                </div>` : ''}

                ${r.notes ? `
                <div style="background:#f8fafc;border-left:4px solid #94a3b8;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:10px">
                    <div style="font-weight:700;color:#475569;font-size:0.82rem;margin-bottom:3px">GHI CHÚ</div>
                    <div style="font-size:0.88rem;color:#334155;line-height:1.5">${r.notes}</div>
                </div>` : ''}
            </div>

            <!-- Footer -->
            <div style="padding:10px 22px;background:#f0f9ff;border-top:1px solid #bae6fd;display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;color:#0369a1">
                <span>👩‍⚕️ ĐD báo cáo: <strong style="color:#0c4a6e">${r.reporterName || r.createdBy || 'Chưa rõ'}</strong></span>
                <span>🕐 Báo cáo lúc: <strong>${(r.updatedAt || r.createdAt) ? new Date(r.updatedAt || r.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'}) : '07:00'}</strong></span>
            </div>
        </div>
        </div>`;
    },

    renderReport7hHistory(reports) {
        const sorted = [...reports].sort((a, b) => b.date.localeCompare(a.date));
        const recent = sorted.slice(0, 5);
        if (recent.length === 0) return '<p style="font-size:0.85rem;color:var(--text-muted)">Chưa có báo cáo nào</p>';

        return `<div class="card" style="padding:0;overflow:hidden">
            <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
                <thead><tr style="background:var(--bg-hover)">
                    <th style="padding:10px;text-align:left;font-weight:600;color:var(--text-secondary)">NGÀY</th>
                    <th style="padding:10px;text-align:center;font-weight:600;color:var(--text-secondary)">TỔNG BN</th>
                    <th style="padding:10px;text-align:center;font-weight:600;color:var(--text-secondary)">HSCC</th>
                    <th style="padding:10px;text-align:center;font-weight:600;color:var(--text-secondary)">HỒI TỈNH</th>
                    <th style="padding:10px;text-align:center;font-weight:600;color:var(--text-secondary)">GIẢI ÁP</th>
                    <th style="padding:10px;text-align:left;font-weight:600;color:var(--text-secondary)">ĐD BÁO CÁO</th>
                    <th style="padding:10px"></th>
                </tr></thead>
                <tbody>
                ${recent.map(r => `<tr style="border-top:1px solid var(--border);cursor:pointer" onclick="ReportsPage.viewDate('${r.date}');ReportsPage.switchTab('report7h')">
                    <td style="padding:10px"><strong>${this.formatDateShort(r.date)}</strong><br><span style="font-size:0.75rem;color:var(--text-muted)">${this.getDayOfWeek(r.date)}</span></td>
                    <td style="padding:10px;text-align:center;font-weight:600">${r.totalPatients || '—'}</td>
                    <td style="padding:10px;text-align:center;color:#ef4444">${r.fromHSCC || '—'}</td>
                    <td style="padding:10px;text-align:center;color:#3b82f6">${r.fromHoiTinh || '—'}</td>
                    <td style="padding:10px;text-align:center;color:#22c55e">${r.fromGiaiAp || '—'}</td>
                    <td style="padding:10px">${r.reporterName || '—'}</td>
                    <td style="padding:10px;text-align:center">👁️</td>
                </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
    },

    openReport7hForm(editDate) {
        const date = editDate || this.selectedDate;
        const reports = Store.getAll('reports7h') || [];
        const existing = reports.find(r => r.date === date);
        const session = Auth.getSession();
        const autoPatients = this.getAutoPatientCount();
        const allStaff = Store.getAll('staff');
        const nurses = allStaff.filter(s => s.role.includes('Điều dưỡng') && !s.name.includes('Thùy'));

        const e = existing || {};
        const defaultPatients = e.totalPatients || (autoPatients > 0 ? autoPatients : '');
        const defaultReporter = e.reporterName || session?.name || '';

        // Stepper helper
        const stepper = (name, val, color) => `
            <div style="display:flex;align-items:center;gap:4px">
                <button type="button" onclick="this.parentNode.querySelector('input').stepDown();this.parentNode.querySelector('input').dispatchEvent(new Event('input'))"
                    style="width:32px;height:32px;border:none;border-radius:8px;background:${color}22;color:${color};font-size:18px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center">−</button>
                <input type="number" name="${name}" value="${val}" min="0" style="width:52px;text-align:center;font-size:1.1rem;font-weight:700;border:2px solid ${color}44;border-radius:8px;padding:4px 2px;color:${color}"
                    oninput="ReportsPage._toggle7hDetail('${name}', this.value)">
                <button type="button" onclick="this.parentNode.querySelector('input').stepUp();this.parentNode.querySelector('input').dispatchEvent(new Event('input'))"
                    style="width:32px;height:32px;border:none;border-radius:8px;background:${color}22;color:${color};font-size:18px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center">+</button>
            </div>`;

        // Nurse chips — compact 4-column grid
        const nurseChips = nurses.length > 0 ? nurses.map(n => {
            const shortName = n.name.replace(/^(Nguyễn|Trần|Phạm|Lê|Bùi|Phan|Huỳnh|Lý)\s/, (m) => m.charAt(0) + '. ');
            return `<button type="button" onclick="document.querySelector('#r7h-reporter').value='${n.name}';document.querySelectorAll('.r7h-chip').forEach(c=>{c.style.background='#f0f9ff';c.style.color='#0369a1';c.style.borderColor='#bae6fd'});this.style.background='#0284c7';this.style.color='#fff';this.style.borderColor='#0284c7'"
                class="r7h-chip" style="padding:5px 8px;border-radius:6px;border:1px solid ${n.name===defaultReporter?'#0284c7':'#bae6fd'};background:${n.name===defaultReporter?'#0284c7':'#f0f9ff'};color:${n.name===defaultReporter?'#fff':'#0369a1'};font-size:0.82rem;cursor:pointer;white-space:nowrap;transition:all .15s;text-align:center">${shortName}</button>`;
        }).join('') : '';

        Modal.open(`👩‍⚕️ Báo cáo 7h — ${this.getDayOfWeek(date)}, ${this.formatDateVN(date)}`, `
            <form onsubmit="ReportsPage.saveReport7h(event, '${date}')">

                <!-- Row 1: Tổng BN -->
                <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:linear-gradient(135deg,#0c4a6e,#0369a1);border-radius:10px;margin-bottom:10px">
                    <div style="flex:1;color:#fff">
                        <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1.5px;color:#7dd3fc;font-weight:600">TỔNG SỐ BỆNH NHÂN</div>
                        <div style="font-size:0.78rem;color:#bae6fd;margin-top:2px">${this.getDayOfWeek(date)} — ${this.formatDateVN(date)}</div>
                    </div>
                    <input type="number" name="totalPatients" value="${defaultPatients}" required min="0"
                        style="width:72px;text-align:center;font-size:1.6rem;font-weight:800;border:none;border-radius:10px;padding:6px;background:rgba(255,255,255,0.15);color:#fff;backdrop-filter:blur(4px)">
                </div>

                <!-- Row 2: 3 sources inline compact -->
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px">
                    <div style="background:#fef2f2;border-radius:8px;padding:8px;text-align:center">
                        <div style="font-size:0.68rem;font-weight:700;color:#dc2626;margin-bottom:4px">🚑 HSCC</div>
                        ${stepper('fromHSCC', e.fromHSCC || 0, '#dc2626')}
                    </div>
                    <div style="background:#eff6ff;border-radius:8px;padding:8px;text-align:center">
                        <div style="font-size:0.68rem;font-weight:700;color:#2563eb;margin-bottom:4px">🏥 Hồi tỉnh</div>
                        ${stepper('fromHoiTinh', e.fromHoiTinh || 0, '#2563eb')}
                    </div>
                    <div style="background:#f0fdf4;border-radius:8px;padding:8px;text-align:center">
                        <div style="font-size:0.68rem;font-weight:700;color:#16a34a;margin-bottom:4px">🔄 Giải áp</div>
                        ${stepper('fromGiaiAp', e.fromGiaiAp || 0, '#16a34a')}
                    </div>
                </div>

                <!-- Row 3: Auto-expand detail fields (hidden by default when count=0) -->
                <div id="detail-fromHSCC" style="display:${(e.fromHSCC > 0) ? 'block' : 'none'};margin-bottom:6px">
                    <input type="text" name="fromHSCCDetail" value="${e.fromHSCCDetail || ''}" placeholder="🚑 Chi tiết HSCC: tên BN / phòng..."
                        style="width:100%;padding:7px 10px;border:1px solid #fca5a5;border-radius:6px;font-size:0.82rem;background:#fff5f5">
                </div>
                <div id="detail-fromHoiTinh" style="display:${(e.fromHoiTinh > 0) ? 'block' : 'none'};margin-bottom:6px">
                    <input type="text" name="fromHoiTinhDetail" value="${e.fromHoiTinhDetail || ''}" placeholder="🏥 Chi tiết Hồi tỉnh: tên BN / phòng..."
                        style="width:100%;padding:7px 10px;border:1px solid #93c5fd;border-radius:6px;font-size:0.82rem;background:#eff6ff">
                </div>
                <div id="detail-fromGiaiAp" style="display:${(e.fromGiaiAp > 0) ? 'block' : 'none'};margin-bottom:6px">
                    <input type="text" name="fromGiaiApDetail" value="${e.fromGiaiApDetail || ''}" placeholder="🔄 Chi tiết Giải áp: tên khoa / số ca..."
                        style="width:100%;padding:7px 10px;border:1px solid #86efac;border-radius:6px;font-size:0.82rem;background:#f0fdf4">
                </div>

                <!-- Row 4: Reporter quick-select -->
                <div style="margin-bottom:8px">
                    <div style="font-size:0.75rem;font-weight:600;color:var(--text-secondary);margin-bottom:5px">👩‍⚕️ ĐD trực BV báo cáo</div>
                    ${nurses.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">${nurseChips}</div>` : ''}
                    <input type="hidden" id="r7h-reporter" name="reporterName" value="${defaultReporter}">
                </div>

                <!-- Row 5: Notes (collapsed) -->
                <details style="margin-bottom:10px" ${e.notes ? 'open' : ''}>
                    <summary style="cursor:pointer;font-size:0.78rem;font-weight:600;color:var(--text-secondary);padding:4px 0">📝 Ghi chú thêm (bấm để mở)</summary>
                    <textarea name="notes" rows="2" placeholder="Ghi chú khác (nếu có)..." style="margin-top:4px;width:100%;font-size:0.82rem">${e.notes || ''}</textarea>
                </details>

                <div class="modal-footer" style="padding-top:8px;border-top:1px solid var(--border)">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">💾 Lưu báo cáo</button>
                </div>
            </form>
        `);
    },

    // Toggle detail input visibility based on stepper value
    _toggle7hDetail(fieldName, value) {
        const el = document.getElementById('detail-' + fieldName);
        if (el) el.style.display = parseInt(value) > 0 ? 'block' : 'none';
    },

    saveReport7h(e, date) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const session = Auth.getSession();

        const report = {
            date,
            totalPatients: parseInt(fd.get('totalPatients')) || 0,
            fromHSCC: parseInt(fd.get('fromHSCC')) || 0,
            fromHSCCDetail: fd.get('fromHSCCDetail')?.trim() || '',
            fromHoiTinh: parseInt(fd.get('fromHoiTinh')) || 0,
            fromHoiTinhDetail: fd.get('fromHoiTinhDetail')?.trim() || '',
            fromGiaiAp: parseInt(fd.get('fromGiaiAp')) || 0,
            fromGiaiApDetail: fd.get('fromGiaiApDetail')?.trim() || '',
            reporterName: fd.get('reporterName') || session?.name || '',
            notes: fd.get('notes')?.trim() || '',
            createdBy: session?.username || 'unknown',
            createdAt: new Date().toISOString()
        };

        if (!Store._data.reports7h) Store._data.reports7h = [];
        const idx = Store._data.reports7h.findIndex(r => r.date === date);
        if (idx >= 0) {
            report.createdAt = Store._data.reports7h[idx].createdAt;
            report.updatedAt = new Date().toISOString();
            Store._data.reports7h[idx] = report;
        } else {
            Store._data.reports7h.push(report);
        }
        Store.save();

        Modal.close();
        this.selectedDate = date;
        this.activeTab = 'report7h';
        App.renderCurrentPage();
        Toast.success('Đã lưu báo cáo 7h sáng');
    },

    exportReport7hImage() {
        const reports = Store.getAll('reports7h') || [];
        const r = reports.find(rr => rr.date === this.selectedDate);
        if (!r) return Toast.error('Không có báo cáo 7h để xuất');
        try { this._drawAndDownload7h(r); } catch (err) { console.error(err); Toast.error('Lỗi: ' + err.message); }
    },

    _drawAndDownload7h(r) {
        const scale = 2;
        const W = 480;
        let contentH = 260;
        if (r.fromHSCC > 0) contentH += 50;
        if (r.fromHoiTinh > 0) contentH += 50;
        if (r.fromGiaiAp > 0) contentH += 50;
        if (r.notes) contentH += 50;
        contentH += 45;
        const H = contentH;

        const canvas = document.createElement('canvas');
        canvas.width = W * scale;
        canvas.height = H * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        // Header
        const headerH = 80;
        const hGrad = ctx.createLinearGradient(0, 0, W, headerH);
        hGrad.addColorStop(0, '#0c4a6e');
        hGrad.addColorStop(1, '#0369a1');
        ctx.fillStyle = hGrad;
        ctx.fillRect(0, 0, W, headerH);

        ctx.fillStyle = '#7dd3fc';
        ctx.font = '600 8px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG — BỆNH VIỆN BÌNH DÂN', 22, 24);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Inter, system-ui, sans-serif';
        ctx.fillText('👩‍⚕️ BÁO CÁO TÌNH HÌNH KHOA LÚC 7G SÁNG', 22, 46);
        ctx.fillStyle = '#bae6fd';
        ctx.font = '500 12px Inter, system-ui, sans-serif';
        ctx.fillText(`${this.getDayOfWeek(r.date)} — Ngày ${this.formatDateVN(r.date)}`, 22, 66);

        // Stat boxes
        let curY = headerH + 16;
        const boxW = (W - 48 - 10) / 2;

        // Total patients
        ctx.fillStyle = '#0284c7';
        this._roundRect(ctx, 24, curY, boxW, 55, 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '600 8px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TỔNG BN', 24 + boxW/2, curY + 18);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px Inter, system-ui, sans-serif';
        ctx.fillText(`${r.totalPatients || '—'}`, 24 + boxW/2, curY + 45);

        // Total received
        const totalReceived = (parseInt(r.fromHSCC) || 0) + (parseInt(r.fromHoiTinh) || 0) + (parseInt(r.fromGiaiAp) || 0);
        ctx.fillStyle = '#059669';
        this._roundRect(ctx, 24 + boxW + 10, curY, boxW, 55, 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '600 8px Inter, system-ui, sans-serif';
        ctx.fillText('NHẬN BN ĐÊM QUA', 24 + boxW + 10 + boxW/2, curY + 18);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px Inter, system-ui, sans-serif';
        ctx.fillText(`${totalReceived}`, 24 + boxW + 10 + boxW/2, curY + 45);

        curY += 65;
        ctx.textAlign = 'left';

        // Detail blocks
        const drawBlock = (label, count, detail, bgColor, borderColor, textColor) => {
            if (count <= 0) return;
            const blockH = 40;
            ctx.fillStyle = bgColor;
            this._roundRect(ctx, 24, curY, W - 48, blockH, 6);
            ctx.fill();
            ctx.fillStyle = borderColor;
            ctx.fillRect(24, curY, 4, blockH);
            ctx.fillStyle = textColor;
            ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            ctx.fillText(`${label}: ${count} ca`, 38, curY + 16);
            if (detail) {
                ctx.fillStyle = textColor;
                ctx.font = '10px Inter, system-ui, sans-serif';
                const txt = detail.length > 60 ? detail.substring(0, 57) + '...' : detail;
                ctx.fillText(txt, 38, curY + 32);
            }
            curY += blockH + 10;
        };

        drawBlock('🚑 NHẬN TỪ HSCC', r.fromHSCC, r.fromHSCCDetail, '#fef2f2', '#ef4444', '#991b1b');
        drawBlock('🏥 NHẬN TỪ HỒI TỈNH', r.fromHoiTinh, r.fromHoiTinhDetail, '#eff6ff', '#3b82f6', '#1e40af');
        drawBlock('🔄 NHẬN GIẢI ÁP KHOA', r.fromGiaiAp, r.fromGiaiApDetail, '#f0fdf4', '#22c55e', '#166534');

        if (r.notes) {
            const blockH = 40;
            ctx.fillStyle = '#f8fafc';
            this._roundRect(ctx, 24, curY, W - 48, blockH, 6);
            ctx.fill();
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(24, curY, 4, blockH);
            ctx.fillStyle = '#475569';
            ctx.font = 'bold 11px Inter, system-ui, sans-serif';
            ctx.fillText('GHI CHÚ', 38, curY + 16);
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#334155';
            ctx.fillText(r.notes.length > 60 ? r.notes.substring(0, 57) + '...' : r.notes, 38, curY + 32);
            curY += blockH + 10;
        }

        // Footer
        const footY = curY + 5;
        ctx.fillStyle = '#f0f9ff';
        ctx.fillRect(0, footY, W, 35);
        ctx.fillStyle = '#bae6fd';
        ctx.fillRect(0, footY, W, 1);
        ctx.fillStyle = '#0369a1';
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`ĐD báo cáo: ${r.reporterName || ''}`, 24, footY + 22);
        ctx.textAlign = 'right';
        const timeStr7 = (r.updatedAt || r.createdAt) ? new Date(r.updatedAt || r.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '07:00';
        ctx.fillText(`Báo cáo lúc: ${timeStr7}`, W - 24, footY + 22);

        // Watermark (diagonal)
        ctx.save();
        const wmW7 = W;
        const wmH7 = footY + 100;
        ctx.translate(wmW7 / 2, wmH7 / 2);
        ctx.rotate(-Math.atan2(wmH7, wmW7));
        ctx.font = 'bold 42px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.04)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG', 0, -10);
        ctx.font = '20px Inter, system-ui, sans-serif';
        ctx.fillText('Bệnh viện Bình Dân', 0, 30);
        ctx.restore();

        // Trim & download
        const finalH = footY + 35;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = W * scale;
        outCanvas.height = finalH * scale;
        const outCtx = outCanvas.getContext('2d');
        outCtx.drawImage(canvas, 0, 0, W * scale, finalH * scale, 0, 0, W * scale, finalH * scale);

        const dataUrl = outCanvas.toDataURL('image/jpeg', 0.95);
        const fileName = `BaoCao7h_${this.selectedDate.replace(/-/g, '')}.jpg`;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (isIOS) {
            const w = window.open('', '_blank');
            if (w) { w.document.write(`<html><head><title>${fileName}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;display:flex;justify-content:center;background:#f1f5f9;padding:16px}img{max-width:100%;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15)}p{text-align:center;color:#475569;font-family:system-ui;font-size:14px;margin-top:12px}</style></head><body><div><img src="${dataUrl}"><p>Nhấn giữ hình để lưu về máy</p></div></body></html>`); w.document.close(); }
            else { window.location.href = dataUrl; }
        } else {
            const byteStr = atob(dataUrl.split(',')[1]);
            const mimeStr = dataUrl.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteStr.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
            const blob = new Blob([ab], { type: mimeStr });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        }
        Toast.success('Đã tạo hình báo cáo 7h!');
    },

    // ========== HELPERS ==========
    changeDate(date) { this.selectedDate = date; App.renderCurrentPage(); },
    goToday() { this.selectedDate = new Date().toISOString().split('T')[0]; App.renderCurrentPage(); },
    viewDate(date) {
        this.selectedDate = date;
        App.renderCurrentPage();
        setTimeout(() => {
            const el = document.getElementById('report-export-area');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    },
    // Timezone-safe date parser for YYYY-MM-DD strings
    _parseDate(dateStr) {
        const parts = dateStr.split('-');
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    },
    // Get next day (or +N days) as YYYY-MM-DD string
    _getNextDay(dateStr, addDays) {
        const d = this._parseDate(dateStr);
        d.setDate(d.getDate() + (addDays || 1));
        return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
    },
    // Check if a date is Friday (day 5)
    _isFriday(dateStr) {
        return this._parseDate(dateStr).getDay() === 5;
    },
    // Check if a date is Saturday (6) or Sunday (0)
    _isWeekend(dateStr) {
        const day = this._parseDate(dateStr).getDay();
        return day === 0 || day === 6;
    },
    formatDateVN(dateStr) {
        const d = this._parseDate(dateStr);
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    },
    formatDateShort(dateStr) {
        const d = this._parseDate(dateStr);
        return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`;
    },
    getDayOfWeek(dateStr) {
        const days = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
        return days[this._parseDate(dateStr).getDay()];
    }
};
