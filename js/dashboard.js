// ===== DASHBOARD PAGE =====
const DashboardPage = {
    render() {
        const staff = Store.getAll('staff');
        const patients = Store.getAll('patients');
        const tasks = Store.getAll('tasks');
        const plans = Store.getAll('plans');
        const pStats = Store.getPatientStats();
        const today = new Date().toISOString().split('T')[0];

        // Surgery stats (live from SurgeryPage)
        SurgeryPage.init();
        const weeklyS = SurgeryPage.getWeeklyStats();
        const monthlyS = SurgeryPage.getMonthlyStats();
        const currentMonth = new Date().toLocaleDateString('vi-VN', { month: 'long' });

        // Calculate staff status counts
        const statusCounts = { active: 0, leave: 0, sick: 0, business: 0 };
        staff.forEach(s => {
            const eff = StaffPage.getEffectiveStatus(s, today);
            statusCounts[eff.status] = (statusCounts[eff.status] || 0) + 1;
        });

        // Get today's duty staff from weekly schedule (Trực BV + Trực ĐD)
        const todayDutyStaff = this.getTodayDutyFromSchedule(staff, today);

        const todayStr = new Date().toISOString().split('T')[0];
        const upcomingPlans = plans
            .filter(p => p.date >= todayStr)
            .sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''))
            .slice(0, 4);

        const dotColors = ['cyan', 'purple', 'green', 'cyan'];

        const absentCount = statusCounts.leave + statusCounts.sick + statusCounts.business;
        const staffParts = [];
        if (statusCounts.leave > 0) staffParts.push(`${statusCounts.leave} nghỉ phép`);
        if (statusCounts.sick > 0) staffParts.push(`${statusCounts.sick} bệnh`);
        if (statusCounts.business > 0) staffParts.push(`${statusCounts.business} công tác`);
        const staffSummary = absentCount > 0
            ? `${statusCounts.active} hoạt động · ${staffParts.join(' · ')}`
            : `● Tất cả đang hoạt động`;

        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Tổng quan</h1>
                <p class="page-subtitle">Khoa Phẫu thuật Đại trực tràng — Bệnh viện Bình Dân</p>
            </div>
            <div class="flex items-center gap-12">
                <span style="color:var(--text-primary); font-size:16px; font-weight:600">${new Date().toLocaleDateString('vi-VN', {weekday:'long', day:'2-digit', month:'long', year:'numeric'})}</span>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card slide-up" style="animation-delay:0s">
                <div class="stat-header">
                    <span class="stat-label">Nhân sự hôm nay</span>
                    <div class="stat-icon cyan">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                </div>
                <div class="stat-value">${statusCounts.active}<span style="font-size:1rem;font-weight:400;color:var(--text-muted)">/${staff.length}</span></div>
                <div class="stat-change ${absentCount > 0 ? '' : 'up'}">${staffSummary}</div>
            </div>
            <div class="stat-card slide-up" style="animation-delay:0.05s">
                <div class="stat-header">
                    <span class="stat-label">BN đang điều trị</span>
                    <div class="stat-icon purple">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>
                    </div>
                </div>
                ${(() => {
                    const emr = EMR.getData();
                    const emrStatus = EMR.getStatus();
                    if (emr && emr.totalDept > 0) {
                        const roomCount = Object.keys(emr.byRoom).length;
                        return `<div class="stat-value">${emr.totalDept}</div>
                            <div class="stat-change"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;margin-right:4px;animation:pulse 2s infinite"></span>${roomCount} phòng · ${EMR.getTimeSinceUpdate()}</div>`;
                    } else if (emrStatus === 'auth-required') {
                        return `<div class="stat-value" style="font-size:1.2rem;color:var(--text-muted)">—</div>
                            <div class="stat-change"><a href="/emr-login" target="_blank" style="color:#ef4444;text-decoration:underline">Cần đăng nhập EMR</a></div>`;
                    } else if (emrStatus === 'loading') {
                        return `<div class="stat-value" style="font-size:1.2rem;color:var(--text-muted)">…</div>
                            <div class="stat-change">Đang tải dữ liệu EMR</div>`;
                    } else {
                        return `<div class="stat-value">${pStats.total - pStats.discharged}</div>
                            <div class="stat-change">${pStats.preOp} chờ mổ · ${pStats.postOp} sau mổ</div>`;
                    }
                })()}
            </div>
            <div class="stat-card slide-up" style="animation-delay:0.1s">
                <div class="stat-header">
                    <span class="stat-label">PT trong tuần</span>
                    <div class="stat-icon green">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22L16 8"/><path d="M3.47 12.53L5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94z"/></svg>
                    </div>
                </div>
                <div class="stat-value">${weeklyS.total}</div>
                <div class="stat-change">${Object.entries(SURGERY_TYPES).map(([k,t]) => `${t.label}: ${weeklyS[k]||0}`).join(' · ')}</div>
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

        <div class="dashboard-grid">
            <div class="chart-card slide-up" style="animation-delay:0.2s">
                <div class="chart-header">
                    <h3 class="chart-title">Số lượng phẫu thuật</h3>
                </div>
                <div style="padding:0 20px 16px">
                    <div style="margin-bottom:20px">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                            <span style="font-size:0.78rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Trong tuần (T2 → CN)</span>
                            <span style="font-size:1.1rem;font-weight:700;color:var(--text-primary)">${weeklyS.total} ca</span>
                        </div>
                        ${Object.entries(SURGERY_TYPES).map(([k,t]) => {
                            const val = weeklyS[k]||0;
                            const pct = weeklyS.total > 0 ? (val / weeklyS.total * 100) : 0;
                            return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                                <span style="flex:0 0 90px;font-size:0.8rem;color:var(--text-secondary);font-weight:500">${t.label}</span>
                                <div style="flex:1;height:22px;background:var(--bg-tertiary);border-radius:6px;overflow:hidden">
                                    <div style="width:${Math.max(pct, val > 0 ? 8 : 0)}%;height:100%;background:${t.color};border-radius:6px;transition:width 0.3s ease"></div>
                                </div>
                                <span style="flex:0 0 28px;text-align:right;font-size:0.88rem;font-weight:700;color:var(--text-primary)">${val}</span>
                            </div>`;
                        }).join('')}
                    </div>
                    <div style="border-top:1px solid var(--border);padding-top:20px">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                            <span style="font-size:0.78rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Tháng ${currentMonth}</span>
                            <span style="font-size:1.1rem;font-weight:700;color:var(--text-primary)">${monthlyS.total} ca</span>
                        </div>
                        ${Object.entries(SURGERY_TYPES).map(([k,t]) => {
                            const val = monthlyS[k]||0;
                            const pct = monthlyS.total > 0 ? (val / monthlyS.total * 100) : 0;
                            return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                                <span style="flex:0 0 90px;font-size:0.8rem;color:var(--text-secondary);font-weight:500">${t.label}</span>
                                <div style="flex:1;height:22px;background:var(--bg-tertiary);border-radius:6px;overflow:hidden">
                                    <div style="width:${Math.max(pct, val > 0 ? 8 : 0)}%;height:100%;background:${t.color};border-radius:6px;transition:width 0.3s ease"></div>
                                </div>
                                <span style="flex:0 0 28px;text-align:right;font-size:0.88rem;font-weight:700;color:var(--text-primary)">${val}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>

            <div class="sidebar-widgets">
                <div class="widget-card slide-up" style="animation-delay:0.25s">
                    <h3 class="widget-title">Nhân sự trực hôm nay</h3>
                    ${todayDutyStaff.length > 0 ? todayDutyStaff.map(item => {
                        const eff = StaffPage.getEffectiveStatus(item.staff, today);
                        const statusInfo = STAFF_STATUSES[eff.status] || STAFF_STATUSES.active;
                        return `
                    <div class="duty-item">
                        <div class="duty-avatar" style="background:${item.staff.color}">${Utils.getInitials(item.staff.name)}</div>
                        <div class="duty-info">
                            <div class="duty-name">${item.staff.title} ${item.staff.name}</div>
                            <div class="duty-role">${item.dutyType}</div>
                        </div>
                        <span class="badge ${eff.status === 'active' ? 'badge-success' : statusInfo.badge}">${eff.status === 'active' ? 'Sẵn sàng' : statusInfo.label}</span>
                    </div>`;
                    }).join('') : '<p style="color:var(--text-muted);font-size:0.85rem;padding:12px 0">Không có lịch trực hôm nay</p>'}
                </div>

                <div class="widget-card slide-up" style="animation-delay:0.3s">
                    <h3 class="widget-title">Hoạt động sắp tới</h3>
                    ${upcomingPlans.length > 0 ? upcomingPlans.map((p, i) => `
                    <div class="timeline-item">
                        <div class="timeline-dot ${dotColors[i % dotColors.length]}"></div>
                        <div class="timeline-content">
                            <div class="timeline-title">${p.title}</div>
                            <div class="timeline-time">${Utils.formatDateShort(p.date)} · ${p.time}</div>
                        </div>
                    </div>
                    `).join('') : '<p style="color:var(--text-muted);font-size:0.85rem;padding:12px 0">Chưa có hoạt động nào sắp tới</p>'}
                </div>
            </div>
        </div>
        `;
    },

    afterRender() {
        // Listen for EMR data updates to re-render dashboard
        if (!this._emrListener) {
            this._emrListener = () => {
                if (App.currentPage === 'dashboard') App.renderCurrentPage();
            };
            window.addEventListener('emr-data-updated', this._emrListener);
        }
    },

    renderChart() {
        const canvas = document.getElementById('surgeryChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.parentElement.clientWidth;
        const h = canvas.parentElement.clientHeight;
        canvas.width = w * 2; canvas.height = h * 2;
        canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
        ctx.scale(2, 2);

        const data = MONTHLY_SURGERIES;
        const max = Math.max(...data) + 5;
        const barW = (w - 80) / data.length;
        const chartH = h - 50;

        // Grid lines
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = 20 + (chartH / 4) * i;
            ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 20, y); ctx.stroke();
            ctx.fillStyle = '#64748b'; ctx.font = '11px Inter'; ctx.textAlign = 'right';
            ctx.fillText(Math.round(max - (max/4)*i), 35, y + 4);
        }

        // Bars
        data.forEach((val, i) => {
            const barH = (val / max) * chartH;
            const x = 50 + i * barW;
            const y = 20 + chartH - barH;

            const gradient = ctx.createLinearGradient(x, y, x, y + barH);
            gradient.addColorStop(0, '#06b6d4');
            gradient.addColorStop(1, '#8b5cf6');
            ctx.fillStyle = gradient;

            const r = 4;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + barW - 12 - r, y);
            ctx.quadraticCurveTo(x + barW - 12, y, x + barW - 12, y + r);
            ctx.lineTo(x + barW - 12, y + barH);
            ctx.lineTo(x, y + barH);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.fill();

            // Label
            ctx.fillStyle = '#64748b'; ctx.font = '11px Inter'; ctx.textAlign = 'center';
            ctx.fillText(MONTH_LABELS[i], x + (barW - 12) / 2, 20 + chartH + 18);
        });
    },

    getTodayDutyFromSchedule(allStaff, todayStr) {
        const DAYS = ['T2','T3','T4','T5','T6','T7','CN'];
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
        const dayKey = dayOfWeek === 0 ? 'CN' : DAYS[dayOfWeek - 1];

        // Get this week's Monday
        const monday = new Date(now);
        monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const weekKey = monday.toISOString().split('T')[0];

        // Find schedule data for this week
        const schedules = Store.getAll('schedules');
        const schedule = schedules.find(s => s.weekKey === weekKey);
        if (!schedule || !schedule.positions) return [];

        const result = [];
        const dutyPositions = [
            { key: 'trucBV', label: 'Trực BV', slots: 3 },
            { key: 'trucDD', label: 'Trực Đ.D', slots: 2 }
        ];

        dutyPositions.forEach(pos => {
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
