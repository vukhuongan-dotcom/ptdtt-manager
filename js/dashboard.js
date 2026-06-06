// ===== DASHBOARD PAGE =====
const DashboardPage = {
    render() {
        const staff = Store.getAll('staff');
        const patients = Store.getAll('patients');
        const tasks = Store.getAll('tasks');
        const plans = Store.getAll('plans');
        const pStats = Store.getPatientStats();
        const _now = new Date();
        const today = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;

        // Surgery stats (live from SurgeryPage)
        SurgeryPage.init();
        const dailyS = SurgeryPage.getDailyStats();
        const weeklyS = SurgeryPage.getWeeklyStats();
        const monthlyS = SurgeryPage.getMonthlyStats();
        const currentMonth = new Date().toLocaleDateString('vi-VN', { month: 'long' });
        
        // Get today's duty staff from weekly schedule
        const todayDutyKhoa = this.getTodayDutyByGroup(staff, today, 'khoa');
        const todayDutyCapCuu = this.getTodayDutyByGroup(staff, today, 'capcuu');

        const todayStr = today;
        const upcomingPlans = plans
            .filter(p => p.date >= todayStr)
            .sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''))
            .slice(0, 4);

        const dotColors = ['cyan', 'purple', 'green', 'cyan'];

        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Tổng quan</h1>
                <p class="page-subtitle">Khoa Phẫu thuật Đại trực tràng — Bệnh viện Bình Dân</p>
            </div>
            <div class="flex items-center gap-12 dash-header-right">
                <div>
                    <div class="dash-date-label">${new Date().toLocaleDateString('vi-VN', {weekday:'long', day:'2-digit', month:'long', year:'numeric'})}</div>
                    <div id="live-clock" class="dash-clock"></div>
                </div>
            </div>
        </div>

        <div class="stats-grid">
            ${(() => {
                const allStaff = Store.getAll('staff');
                const now = new Date();
                const _today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
                const entries = Store.getAll('staffStatuses') || [];
                const absentList = [];
                allStaff.forEach(s => {
                    const dayEntry = entries.find(e => e.staffId === s.id && e.date === _today);
                    let status = 'active';
                    if (dayEntry) status = dayEntry.status;
                    else if (s.statusType && s.statusType !== 'active' && s.statusFrom && s.statusTo && _today >= s.statusFrom && _today <= s.statusTo) status = s.statusType;
                    if (status !== 'active') {
                        const info = STAFF_STATUSES[status] || STAFF_STATUSES.active;
                        absentList.push(`${info.icon} ${s.name}`);
                    }
                });
                const present = allStaff.length - absentList.length;
                const isLow = absentList.length > 0 && (present / allStaff.length) < 0.8;
                return `<div class="stat-card slide-up" style="animation-delay:0s">
                    <div class="stat-header">
                        <span class="stat-label">Nhân sự</span>
                        <div class="stat-icon ${isLow ? 'red' : 'cyan'}">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </div>
                    </div>
                    <div class="stat-value">${present}<span class="stat-value-suffix">/${allStaff.length}</span></div>
                    <div class="stat-change">${absentList.length ? absentList.join(' · ') : '✅ Đủ nhân sự'}</div>
                </div>`;
            })()}
            <div class="stat-card slide-up" style="animation-delay:0.05s">
                <div class="stat-header">
                    <span class="stat-label">BN đang điều trị</span>
                    <div class="stat-icon purple">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>
                    </div>
                </div>
                ${(() => {
                    // Read from 7h/16h reports — no EMR
                    const nowH = new Date();
                    const todayStr = `${nowH.getFullYear()}-${String(nowH.getMonth()+1).padStart(2,'0')}-${String(nowH.getDate()).padStart(2,'0')}`;
                    const hour = nowH.getHours();
                    let patientCount = 0;
                    let sourceLabel = '';
                    if (hour >= 16) {
                        const rep16 = (Store.getAll('reports16h') || []).find(r => r.date === todayStr);
                        if (rep16 && rep16.totalPatients) { patientCount = rep16.totalPatients; sourceLabel = 'BC 16h hôm nay'; }
                    }
                    if (!sourceLabel && hour >= 7) {
                        const rep7 = (Store.getAll('reports7h') || []).find(r => r.date === todayStr);
                        if (rep7 && rep7.totalPatients) { patientCount = rep7.totalPatients; sourceLabel = 'BC 7h hôm nay'; }
                    }
                    if (!sourceLabel) {
                        const all16 = (Store.getAll('reports16h') || []).filter(r => r.totalPatients).sort((a,b) => b.date.localeCompare(a.date));
                        if (all16[0]) { patientCount = all16[0].totalPatients; sourceLabel = `BC 16h ${Utils.formatDateShort(all16[0].date)}`; }
                        else {
                            const all7 = (Store.getAll('reports7h') || []).filter(r => r.totalPatients).sort((a,b) => b.date.localeCompare(a.date));
                            if (all7[0]) { patientCount = all7[0].totalPatients; sourceLabel = `BC 7h ${Utils.formatDateShort(all7[0].date)}`; }
                        }
                    }
                    if (patientCount > 0) {
                        return `<div class="stat-value">${patientCount}</div>
                            <div class="stat-change">📋 ${sourceLabel}</div>`;
                    }
                    return `<div class="stat-value stat-value-empty">—</div>
                            <div class="stat-change">Chưa có báo cáo hôm nay</div>`;
                })()}
            </div>
            <div class="stat-card slide-up" style="animation-delay:0.1s">
                <div class="stat-header">
                    <span class="stat-label">PT hôm nay</span>
                    <div class="stat-icon green">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22L16 8"/><path d="M3.47 12.53L5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94z"/></svg>
                    </div>
                </div>
                <div class="stat-value">${dailyS.total}</div>
                <div class="stat-change">${Object.entries(SURGERY_TYPES).map(([k,t]) => `${t.label}: ${dailyS[k]||0}`).join(' · ')}</div>
            </div>
            <div class="stat-card slide-up" style="animation-delay:0.15s">
                <div class="stat-header">
                    <span class="stat-label">Công việc</span>
                    <div class="stat-icon amber">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                    </div>
                </div>
                <div class="stat-value">${tasks.filter(t=>t.status!=='done').length}</div>
                <div class="stat-change">${tasks.filter(t=>t.status==='done').length} đã hoàn thành</div>
            </div>
        </div>

        <div class="chart-card slide-up" style="animation-delay:0.2s">
                <div class="chart-header">
                    <h3 class="chart-title">Số lượng phẫu thuật</h3>
                </div>
                <div class="surgery-stats-row">
                    <div>
                        <div class="surgery-stats-period-header">
                            <span class="surgery-stats-period-label">Trong tuần (T2 → CN)</span>
                            <span class="surgery-stats-total">${weeklyS.total} ca</span>
                        </div>
                        ${Object.entries(SURGERY_TYPES).map(([k,t]) => {
                            const val = weeklyS[k]||0;
                            const pct = weeklyS.total > 0 ? (val / weeklyS.total * 100) : 0;
                            return `<div class="surgery-bar-row">
                                <span class="surgery-bar-label">${t.label}</span>
                                <div class="surgery-bar-track">
                                    <div class="surgery-bar-fill" style="width:${Math.max(pct, val > 0 ? 8 : 0)}%;background:${t.color}"></div>
                                </div>
                                <span class="surgery-bar-count">${val}</span>
                            </div>`;
                        }).join('')}
                    </div>
                    <div class="surgery-month-col">
                        <div class="surgery-stats-period-header">
                            <span class="surgery-stats-period-label">Tháng ${currentMonth}</span>
                            <span class="surgery-stats-total">${monthlyS.total} ca</span>
                        </div>
                        ${Object.entries(SURGERY_TYPES).map(([k,t]) => {
                            const val = monthlyS[k]||0;
                            const pct = monthlyS.total > 0 ? (val / monthlyS.total * 100) : 0;
                            return `<div class="surgery-bar-row">
                                <span class="surgery-bar-label">${t.label}</span>
                                <div class="surgery-bar-track">
                                    <div class="surgery-bar-fill" style="width:${Math.max(pct, val > 0 ? 8 : 0)}%;background:${t.color}"></div>
                                </div>
                                <span class="surgery-bar-count">${val}</span>
                            </div>`;
                        }).join('')}
                </div>
            </div>

        <div class="trend-chart-card slide-up" style="animation-delay:0.22s">
            <div class="trend-chart-header">
                <div>
                    <div class="trend-chart-title">📈 Xu hướng phẫu thuật 6 tháng</div>
                    <div class="trend-chart-subtitle">Số ca PT theo tháng — phân loại theo loại phẫu thuật</div>
                </div>
            </div>
            <div class="trend-chart-container" id="trend-chart-wrap">
                <canvas id="trend-chart"></canvas>
                <div class="trend-chart-tooltip" id="trend-tooltip"></div>
            </div>
            <div class="trend-chart-legend">
                ${Object.entries(SURGERY_TYPES).map(([k,t]) => `
                    <div class="trend-legend-item">
                        <div class="trend-legend-dot" style="background:${t.color}"></div>
                        ${t.label}
                    </div>
                `).join('')}
                <div class="trend-legend-item">
                    <div class="trend-legend-dot" style="background:var(--text-primary)"></div>
                    Tổng
                </div>
            </div>
        </div>

        <div class="duty-grid">
                <div class="widget-card slide-up" style="animation-delay:0.25s">
                    <h3 class="widget-title">🏥 Trực khoa hôm nay</h3>
                    ${todayDutyKhoa.length > 0 ? (() => { const _c = ['#06b6d4','#8b5cf6','#f59e0b','#ec4899']; return todayDutyKhoa.map((item, i) => {
                        const eff = StaffPage.getEffectiveStatus(item.staff, today);
                        const statusInfo = STAFF_STATUSES[eff.status] || STAFF_STATUSES.active;
                        return `
                    <div class="duty-item">
                        <div class="duty-avatar" style="background:${_c[i % _c.length]}">${Utils.getInitials(item.staff.name)}</div>
                        <div class="duty-info">
                            <div class="duty-name">${item.staff.title} ${item.staff.name}</div>
                            <div class="duty-role">${item.dutyType}</div>
                        </div>
                        <span class="badge ${eff.status === 'active' ? 'badge-success' : statusInfo.badge}">${eff.status === 'active' ? 'Sẵn sàng' : statusInfo.label}</span>
                    </div>`;
                    }).join(''); })() : '<p class="widget-empty-msg">Chưa phân công</p>'}
                </div>

                <div class="widget-card slide-up" style="animation-delay:0.3s">
                    <h3 class="widget-title">🚑 Trực cấp cứu hôm nay</h3>
                    ${todayDutyCapCuu.length > 0 ? (() => { const _c = ['#ef4444','#3b82f6','#14b8a6','#f97316','#a855f7','#10b981']; return todayDutyCapCuu.map((item, i) => {
                        const eff = StaffPage.getEffectiveStatus(item.staff, today);
                        const statusInfo = STAFF_STATUSES[eff.status] || STAFF_STATUSES.active;
                        return `
                    <div class="duty-item">
                        <div class="duty-avatar" style="background:${_c[i % _c.length]}">${Utils.getInitials(item.staff.name)}</div>
                        <div class="duty-info">
                            <div class="duty-name">${item.staff.title} ${item.staff.name}</div>
                            <div class="duty-role">${item.dutyType}</div>
                        </div>
                        <span class="badge ${eff.status === 'active' ? 'badge-success' : statusInfo.badge}">${eff.status === 'active' ? 'Sẵn sàng' : statusInfo.label}</span>
                    </div>`;
                    }).join(''); })() : '<p class="widget-empty-msg">Chưa phân công</p>'}
                </div>

                <div class="widget-card slide-up" style="animation-delay:0.35s">
                    <h3 class="widget-title">📅 Hoạt động sắp tới</h3>
                    ${upcomingPlans.length > 0 ? upcomingPlans.map((p, i) => `
                    <div class="timeline-item">
                        <div class="timeline-dot ${dotColors[i % dotColors.length]}"></div>
                        <div class="timeline-content">
                            <div class="timeline-title">${p.title}</div>
                            <div class="timeline-time">${Utils.formatDateShort(p.date)} · ${p.time}</div>
                        </div>
                    </div>
                    `).join('') : '<p class="widget-empty-msg">Chưa có hoạt động nào sắp tới</p>'}
                </div>
            </div>
        `;
    },

    afterRender() {
        // Live clock
        if (this._clockInterval) clearInterval(this._clockInterval);
        const updateClock = () => {
            const el = document.getElementById('live-clock');
            if (el) {
                const now = new Date();
                el.textContent = now.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false});
            }
        };
        updateClock();
        this._clockInterval = setInterval(updateClock, 1000);

        // Render trend chart
        setTimeout(() => this.renderTrendChart(), 50);

        // Listen for EMR data updates to re-render dashboard
        if (!this._emrListener) {
            this._emrListener = () => {
                if (App.currentPage === 'dashboard') App.renderCurrentPage();
            };
            window.addEventListener('emr-data-updated', this._emrListener);
        }
    },

    renderChart() { /* legacy - replaced by renderTrendChart */ },

    // Get surgery data grouped by last 6 months
    getMonthlyTrendData() {
        const all = SurgeryPage.getAllSurgeries();
        const types = Object.keys(SURGERY_TYPES);
        const now = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const start = new Date(d.getFullYear(), d.getMonth(), 1);
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
            const label = `T${d.getMonth()+1}/${d.getFullYear()}`;
            const shortLabel = `T${d.getMonth()+1}`;
            const monthSurgeries = all.filter(s => {
                const sd = new Date(s.date);
                return sd >= start && sd <= end;
            });
            const byType = {};
            types.forEach(t => { byType[t] = monthSurgeries.filter(s => s.surgeryType === t).length; });
            months.push({ label, shortLabel, total: monthSurgeries.length, byType });
        }
        return months;
    },

    renderTrendChart() {
        const canvas = document.getElementById('trend-chart');
        if (!canvas) return;
        const wrap = document.getElementById('trend-chart-wrap');
        const w = wrap.clientWidth;
        const h = wrap.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = w * dpr; canvas.height = h * dpr;
        canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const data = this.getMonthlyTrendData();
        const types = Object.keys(SURGERY_TYPES);
        const pad = { top: 20, right: 20, bottom: 35, left: 42 };
        const cW = w - pad.left - pad.right;
        const cH = h - pad.top - pad.bottom;

        const allV = data.map(m => m.total);
        types.forEach(t => data.forEach(m => allV.push(m.byType[t])));
        const nMax = Math.ceil(Math.max(...allV, 5) / 5) * 5;

        const yOf = v => pad.top + cH - (v / nMax) * cH;
        const xOf = i => pad.left + (i / Math.max(data.length - 1, 1)) * cW;

        // Grid
        ctx.strokeStyle = 'rgba(148,163,184,0.15)'; ctx.lineWidth = 1;
        ctx.font = '11px Inter, system-ui'; ctx.textAlign = 'right'; ctx.fillStyle = '#94a3b8';
        for (let i = 0; i <= 4; i++) {
            const val = Math.round((nMax / 4) * i);
            const y = yOf(val);
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
            ctx.fillText(val, pad.left - 8, y + 4);
        }
        // X labels
        ctx.textAlign = 'center'; ctx.fillStyle = '#94a3b8';
        data.forEach((m, i) => { ctx.fillText(m.shortLabel, xOf(i), h - 8); });

        // Draw smooth bezier line
        const drawLine = (values, color, lw) => {
            if (values.every(v => v === 0)) return;
            ctx.strokeStyle = color; ctx.lineWidth = lw;
            ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash([]);
            ctx.beginPath();
            values.forEach((v, i) => {
                const x = xOf(i), y = yOf(v);
                if (i === 0) ctx.moveTo(x, y);
                else { const cpX = (xOf(i-1) + x) / 2; ctx.bezierCurveTo(cpX, yOf(values[i-1]), cpX, y, x, y); }
            });
            ctx.stroke();
            // Dots
            values.forEach((v, i) => {
                ctx.beginPath(); ctx.arc(xOf(i), yOf(v), 4, 0, Math.PI * 2);
                ctx.fillStyle = '#fff'; ctx.fill();
                ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
            });
        };

        // Area fill for total
        const totalVals = data.map(m => m.total);
        if (totalVals.some(v => v > 0)) {
            ctx.beginPath();
            totalVals.forEach((v, i) => {
                if (i === 0) ctx.moveTo(xOf(i), yOf(v));
                else { const cpX = (xOf(i-1)+xOf(i))/2; ctx.bezierCurveTo(cpX, yOf(totalVals[i-1]), cpX, yOf(v), xOf(i), yOf(v)); }
            });
            ctx.lineTo(xOf(data.length-1), yOf(0)); ctx.lineTo(xOf(0), yOf(0)); ctx.closePath();
            const grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
            grad.addColorStop(0, 'rgba(15,23,42,0.08)'); grad.addColorStop(1, 'rgba(15,23,42,0)');
            ctx.fillStyle = grad; ctx.fill();
        }

        // Lines per type + total
        types.forEach(t => drawLine(data.map(m => m.byType[t]), SURGERY_TYPES[t].color, 2));
        drawLine(totalVals, '#0f172a', 2.5);

        // Tooltip on hover
        canvas.onmousemove = (e) => {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const tooltip = document.getElementById('trend-tooltip');
            if (!tooltip) return;
            let closest = -1, minD = Infinity;
            data.forEach((_, i) => { const d = Math.abs(mx - xOf(i)); if (d < minD) { minD = d; closest = i; } });
            if (closest >= 0 && minD < cW / data.length) {
                const m = data[closest];
                tooltip.innerHTML = `<div class="trend-tooltip-title">${m.label}</div>` +
                    types.map(t => `<div class="trend-tooltip-row"><span class="trend-tooltip-label"><span class="trend-legend-dot" style="background:${SURGERY_TYPES[t].color};width:7px;height:7px"></span> ${SURGERY_TYPES[t].label}</span><strong>${m.byType[t]}</strong></div>`).join('') +
                    `<div class="trend-tooltip-row trend-tooltip-total-row"><strong>Tổng</strong><strong>${m.total}</strong></div>`;
                tooltip.classList.add('visible');
                tooltip.style.left = (xOf(closest) > w/2 ? xOf(closest)-150 : xOf(closest)+15) + 'px';
                tooltip.style.top = '10px';
            } else { tooltip.classList.remove('visible'); }
        };
        canvas.onmouseleave = () => { const t = document.getElementById('trend-tooltip'); if (t) t.classList.remove('visible'); };
    },

    getTodayDutyByGroup(allStaff, todayStr, group) {
        const DAYS = ['T2','T3','T4','T5','T6','T7','CN'];
        const now = new Date();
        const dayOfWeek = now.getDay();
        const dayKey = dayOfWeek === 0 ? 'CN' : DAYS[dayOfWeek - 1];

        const monday = new Date(now);
        monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const weekKey = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;

        const schedules = Store.getAll('schedules');
        const schedule = schedules.find(s => s.weekKey === weekKey);
        if (!schedule || !schedule.positions) return [];

        const positions = group === 'khoa'
            ? [{ key: 'trucKhoa', label: 'Trực khoa', slots: 4 }]
            : [
                { key: 'trucBV', label: 'Trực BV', slots: 3 },
                { key: 'trucDD', label: 'Trực Đ.D', slots: 3 },
                { key: 'trucHL', label: 'Trực Hộ lý', slots: 1 }
              ];

        const result = [];
        positions.forEach(pos => {
            const posData = schedule.positions[pos.key];
            if (!posData) return;
            for (let slot = 0; slot < pos.slots; slot++) {
                const cellKey = `${dayKey}_${slot}`;
                const staffId = posData[cellKey];
                if (staffId) {
                    const staffMember = allStaff.find(s => s.id === parseInt(staffId));
                    if (staffMember) {
                        result.push({ staff: staffMember, dutyType: pos.label });
                    }
                }
            }
        });
        return result;
    }
};
