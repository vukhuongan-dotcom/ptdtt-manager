// ===== DASHBOARD PAGE =====
const DashboardPage = {
    _trendMonths: 6,
    _hiddenSeries: {},

    render() {
        const staff = Store.getAll('staff');
        const patients = Store.getAll('patients');
        const tasks = Store.getAll('tasks');
        const plans = Store.getAll('plans');
        const surgeries = Store.getAll('surgeries') || [];
        const reports7h = Store.getAll('reports7h') || [];
        const reports16h = Store.getAll('reports16h') || [];

        const _now = new Date();
        const today = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;

        // Surgery stats (live from SurgeryPage)
        SurgeryPage.init();
        const dailyS = SurgeryPage.getDailyStats();
        const weeklyS = SurgeryPage.getWeeklyStats();
        const monthlyS = SurgeryPage.getMonthlyStats();

        // MIS & Clinical Approach Metrics via shared SurgeryMetrics
        const monthCount = (this._trendMonths === 'year') ? (new Date().getMonth() + 1) : (parseInt(this._trendMonths) || 6);
        const recentMonths = (typeof SurgeryMetrics !== 'undefined') ? SurgeryMetrics.getMonthlyTrend(surgeries, monthCount) : [];
        const totalRecentCases = recentMonths.reduce((sum, m) => sum + (m.total || 0), 0);
        const minKey = (recentMonths.length > 0 && recentMonths[0]?.key) ? (recentMonths[0].key + '-01') : `${today.slice(0, 7)}-01`;
        const allRecentCases = surgeries.filter(s => {
            return s && s.date && s.date >= minKey && s.date <= today;
        });
        const misStats = (typeof SurgeryMetrics !== 'undefined') ? SurgeryMetrics.calculateMIS(allRecentCases) : { misPct: 0, noisoiPct: 0, robotPct: 0, openPct: 0, misCases: 0, noisoi: 0, robot: 0, mo: 0 };
        const typeBreakdown = (typeof SurgeryMetrics !== 'undefined') ? SurgeryMetrics.calculateTypeBreakdown(allRecentCases) : { yeucauPct: 0, chuongtrinhPct: 0, robotPct: 0, bankhanPct: 0, yeucau: 0, chuongtrinh: 0, robot: 0, bankhan: 0 };
        const avgMonthly = recentMonths.length > 0 ? (totalRecentCases / recentMonths.length).toFixed(1) : 0;

        // Inpatient Flow (Widget 3) from latest reports7h & reports16h (strictly chronological)
        const valid16h = [...reports16h].filter(r => r && r.totalPatients).sort((a,b) => b.date.localeCompare(a.date));
        const valid7h = [...reports7h].filter(r => r && r.totalPatients).sort((a,b) => b.date.localeCompare(a.date));
        const latest16h = valid16h[0] || {};
        const latest7h = valid7h[0] || {};

        // Compare chronological timestamps (7h is 07:00, 16h is 16:00)
        let latestReport = null;
        if (latest16h.date && latest7h.date) {
            const time16 = `${latest16h.date} 16:00`;
            const time7 = `${latest7h.date} 07:00`;
            latestReport = (time16 >= time7) 
                ? { ...latest16h, type: '16h', typeLabel: 'Báo cáo 16h', shortLabel: `16h · ${Utils.formatDateShort(latest16h.date)}` }
                : { ...latest7h, type: '7h', typeLabel: 'Báo cáo 7h', shortLabel: `7h · ${Utils.formatDateShort(latest7h.date)}` };
        } else if (latest16h.date) {
            latestReport = { ...latest16h, type: '16h', typeLabel: 'Báo cáo 16h', shortLabel: `16h · ${Utils.formatDateShort(latest16h.date)}` };
        } else if (latest7h.date) {
            latestReport = { ...latest7h, type: '7h', typeLabel: 'Báo cáo 7h', shortLabel: `7h · ${Utils.formatDateShort(latest7h.date)}` };
        }

        const currentInpatients = latestReport?.totalPatients || 0;
        const newAdmissions = latest16h.admissions || 0;
        const discharges = latest16h.discharges || 0;
        const fromHSCC = (latest7h.fromHSCC || 0) + (latest7h.fromHoiTinh || 0) + (latest7h.fromICU || 0) + (latest7h.fromGiaiAp || 0);

        // Duty staff
        const todayDutyKhoa = this.getTodayDutyByGroup(staff, today, 'khoa');
        const todayDutyCapCuu = this.getTodayDutyByGroup(staff, today, 'capcuu');

        const upcomingPlans = plans
            .filter(p => p.date >= today)
            .sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''))
            .slice(0, 4);

        const dotColors = ['cyan', 'purple', 'green', 'cyan'];

        // Birthday staff detection
        const todayBirthdays = this.getTodayBirthdays(staff, today);

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

        ${this.renderBirthdayBanner(todayBirthdays, today)}

        <!-- TOP STATS GRID -->
        <div class="stats-grid">
            ${(() => {
                const allStaff = Store.getActiveStaff(today);
                const entries = Store.getAll('staffStatuses') || [];
                const absentList = [];
                allStaff.forEach(s => {
                    const dayEntry = entries.find(e => e.staffId === s.id && e.date === today);
                    let status = 'active';
                    if (dayEntry) status = dayEntry.status;
                    else if (s.statusType && s.statusType !== 'active' && s.statusFrom && s.statusTo && today >= s.statusFrom && today <= s.statusTo) status = s.statusType;
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
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="7.5" cy="6" r="3.5" fill="currentColor"/>
                                <path d="M 1.5 18 C 1.5 13 4 11.5 7.5 11.5 C 11 11.5 13.5 13 13.5 18 Z" fill="currentColor"/>
                                <circle cx="17" cy="7" r="5" fill="currentColor" stroke="none"/>
                                <path d="M 17 4.5 V 9.5 M 14.5 7 H 19.5" stroke="var(--surface-card)" stroke-width="1.6"/>
                            </svg>
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
                <div class="stat-value">${currentInpatients > 0 ? currentInpatients : '—'}</div>
                <div class="stat-change">📋 ${latestReport ? latestReport.shortLabel : 'Đang cập nhật'}</div>
            </div>

            <div class="stat-card slide-up" style="animation-delay:0.1s">
                <div class="stat-header">
                    <span class="stat-label">PT hôm nay</span>
                    <div class="stat-icon green">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M 19 3.5 L 12 10.5" stroke-width="2.8" stroke-linecap="square"/>
                            <path d="M 12 10.5 L 5 17.5 C 4 19 6.5 19.5 8 18 L 13.5 12.5 Z" fill="currentColor" fill-opacity="0.2"/>
                            <line x1="4" y1="21" x2="20" y2="21" stroke-dasharray="3.5 2.5" stroke-width="1.6"/>
                        </svg>
                    </div>
                </div>
                <div class="stat-value">${dailyS.total}</div>
                <div class="stat-change">${Object.entries(SURGERY_TYPES).map(([k,t]) => `${t.label}: ${dailyS[k]||0}`).join(' · ')}</div>
            </div>

            <div class="stat-card slide-up" style="animation-delay:0.15s;cursor:pointer" onclick="App.navigate('plans')" title="Nhấn để xem Lịch kế hoạch chi tiết">
                <div class="stat-header">
                    <span class="stat-label">Kế hoạch tháng ${parseInt(_now.getMonth() + 1)}</span>
                    <div class="stat-icon amber">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                    </div>
                </div>
                <div class="stat-value">${(plans || []).filter(p => p.date && p.date.startsWith(today.slice(0, 7))).length}</div>
                <div class="stat-change">📅 Lịch SHCM & công tác khoa</div>
            </div>
        </div>

        <!-- HERO ANALYTICS ROW (2/3 + 1/3 Grid) -->
        <div class="hero-analytics-row slide-up" style="animation-delay:0.2s">
            <!-- Left Column: Combo Stacked Bar + Spline Trend Chart -->
            <div class="trend-chart-card">
                <div class="trend-chart-header">
                    <div>
                        <div class="trend-chart-title">📈 Xu hướng phẫu thuật ${this._trendMonths || 6} tháng</div>
                        <div class="trend-chart-subtitle">Cơ cấu loại phẫu thuật & tổng số ca theo tháng</div>
                    </div>
                    <div class="trend-filter-pills">
                        <button class="trend-filter-btn ${this._trendMonths === 6 ? 'active' : ''}" onclick="DashboardPage.setTrendFilter(6)">6 Tháng</button>
                        <button class="trend-filter-btn ${this._trendMonths === 12 ? 'active' : ''}" onclick="DashboardPage.setTrendFilter(12)">12 Tháng</button>
                        <button class="trend-filter-btn ${this._trendMonths === 'year' ? 'active' : ''}" onclick="DashboardPage.setTrendFilter('year')">Năm 2026</button>
                    </div>
                </div>

                <!-- 4 Micro KPI Summary Strip -->
                <div class="trend-kpi-strip">
                    <div class="trend-kpi-item">
                        <div class="trend-kpi-lbl">Tổng số ca</div>
                        <div class="trend-kpi-val text-dark">${totalRecentCases.toLocaleString('vi-VN')} <span class="trend-kpi-unit">ca</span></div>
                        <div class="trend-kpi-sub">${recentMonths.length} tháng qua</div>
                    </div>
                    <div class="trend-kpi-item">
                        <div class="trend-kpi-lbl">Trung bình / tháng</div>
                        <div class="trend-kpi-val text-green">${avgMonthly} <span class="trend-kpi-unit">ca</span></div>
                        <div class="trend-kpi-sub">Công suất khoa</div>
                    </div>
                    <div class="trend-kpi-item">
                        <div class="trend-kpi-lbl">PT Yêu cầu</div>
                        <div class="trend-kpi-val text-amber">${typeBreakdown.yeucauPct}%</div>
                        <div class="trend-kpi-sub">${typeBreakdown.yeucau} ca</div>
                    </div>
                    <div class="trend-kpi-item">
                        <div class="trend-kpi-lbl">Xâm lấn tối thiểu (MIS)</div>
                        <div class="trend-kpi-val text-blue">${misStats.misPct}%</div>
                        <div class="trend-kpi-sub">Nội soi + Robot (${misStats.misCases} ca)</div>
                    </div>
                </div>

                <!-- Chart Canvas Container -->
                <div class="trend-chart-container" id="trend-chart-wrap">
                    <canvas id="trend-chart"></canvas>
                    <div class="trend-chart-tooltip" id="trend-tooltip"></div>
                </div>

                <!-- Togglable Legend (Exact colors from Lịch Mổ Tuần) -->
                <div class="trend-chart-legend">
                    <div class="trend-legend-item ${this._hiddenSeries['yeucau'] ? 'inactive' : ''}" onclick="DashboardPage.toggleSeries('yeucau')">
                        <div class="trend-legend-dot trend-dot-yeucau"></div>
                        PT Yêu cầu
                    </div>
                    <div class="trend-legend-item ${this._hiddenSeries['chuongtrinh'] ? 'inactive' : ''}" onclick="DashboardPage.toggleSeries('chuongtrinh')">
                        <div class="trend-legend-dot trend-dot-chuongtrinh"></div>
                        PT Chương trình
                    </div>
                    <div class="trend-legend-item ${this._hiddenSeries['robot'] ? 'inactive' : ''}" onclick="DashboardPage.toggleSeries('robot')">
                        <div class="trend-legend-dot trend-dot-robot"></div>
                        PT Robot
                    </div>
                    <div class="trend-legend-item ${this._hiddenSeries['bankhan'] ? 'inactive' : ''}" onclick="DashboardPage.toggleSeries('bankhan')">
                        <div class="trend-legend-dot trend-dot-bankhan"></div>
                        Bán khẩn
                    </div>
                    <div class="trend-legend-item ${this._hiddenSeries['total'] ? 'inactive' : ''}" onclick="DashboardPage.toggleSeries('total')">
                        <div class="trend-legend-dot trend-dot-total"></div>
                        ● Tổng số ca
                    </div>
                    <div class="trend-legend-item" title="Đường trung bình 6 tháng chuẩn">
                        <div class="trend-legend-line-dashed"></div>
                        Mốc TB (${Math.round(avgMonthly)} ca)
                    </div>
                </div>
            </div>

            <!-- Right Column: 2 Clinical Widgets (Widget 1 & Widget 3) -->
            <div class="sidebar-widgets-column">
                <!-- WIDGET 1: Chỉ số Phẫu thuật Mũi nhọn (MIS Index) -->
                <div class="widget-card mis-widget">
                    <div class="widget-header-flex">
                        <h3 class="widget-title mb-0">🤖 Phẫu thuật Mũi nhọn (MIS)</h3>
                        <span class="mis-score-badge">⭐ Ngoại khoa Hiện đại</span>
                    </div>

                    <div class="mis-content-wrap">
                        <div class="mis-donut-section">
                            <div class="mis-donut-box">
                                <svg viewBox="0 0 36 36" class="mis-donut-chart">
                                    <path class="mis-circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke-width="3.5" fill="none"/>
                                    <!-- Noisoi arc (Green - Lịch mổ chuẩn) -->
                                    <path class="mis-circle-noisoi" stroke-dasharray="${misStats.noisoiPct}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke-width="3.8" stroke-linecap="round" fill="none"/>
                                    <!-- Robot arc (Navy - Lịch mổ chuẩn) -->
                                    <path class="mis-circle-robot" stroke-dashoffset="-${misStats.noisoiPct}" stroke-dasharray="${misStats.robotPct}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke-width="4.2" stroke-linecap="round" fill="none"/>
                                </svg>
                                <div class="mis-donut-center">
                                    <div class="mis-donut-val">${misStats.misPct}%</div>
                                    <div class="mis-donut-lbl">MIS Rate</div>
                                </div>
                            </div>
                        </div>

                        <div class="mis-stat-list">
                            <div class="mis-stat-row mis-row-green">
                                <div class="mis-stat-icon-label">
                                    <span class="mis-dot green"></span>
                                    <span class="mis-stat-name">Nội soi (Laparoscopy)</span>
                                </div>
                                <div class="mis-stat-val-group">
                                    <span class="mis-stat-badge green">${misStats.noisoi} ca</span>
                                    <span class="mis-stat-pct green">${misStats.noisoiPct}%</span>
                                </div>
                            </div>
                            <div class="mis-stat-row mis-row-navy">
                                <div class="mis-stat-icon-label">
                                    <span class="mis-dot navy"></span>
                                    <span class="mis-stat-name">Phẫu thuật Robot</span>
                                </div>
                                <div class="mis-stat-val-group">
                                    <span class="mis-stat-badge navy">${misStats.robot} ca</span>
                                    <span class="mis-stat-pct navy">${misStats.robotPct}%</span>
                                </div>
                            </div>
                            <div class="mis-stat-row mis-row-rose">
                                <div class="mis-stat-icon-label">
                                    <span class="mis-dot rose"></span>
                                    <span class="mis-stat-name">Mổ mở & Tầng sinh môn</span>
                                </div>
                                <div class="mis-stat-val-group">
                                    <span class="mis-stat-badge rose">${misStats.mo} ca</span>
                                    <span class="mis-stat-pct rose">${misStats.openPct}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="mis-stat-footer">
                        <small class="text-muted">💡 Bao gồm phẫu thuật nội soi đại trực tràng, robot và bệnh lý hậu môn sàn chậu.</small>
                    </div>
                </div>

                <!-- WIDGET 3: Tình hình Buồng bệnh & Lưu chuyển Bệnh nhân -->
                <div class="widget-card bed-flow-widget">
                    <div class="widget-header-flex">
                        <h3 class="widget-title mb-0">🛏️ Lưu chuyển Buồng bệnh</h3>
                        <span class="badge badge-info">${latestReport ? latestReport.shortLabel : 'Hôm nay'}</span>
                    </div>

                    <div class="bed-flow-grid">
                        <div class="bed-flow-card bed-flow-cyan">
                            <div class="bed-flow-header">
                                <span class="bed-flow-icon">🏥</span>
                                <span class="bed-flow-lbl">BN Hiện diện</span>
                            </div>
                            <div class="bed-flow-num">${currentInpatients}</div>
                            <div class="bed-flow-sub">Nội trú tại khoa</div>
                        </div>
                        <div class="bed-flow-card bed-flow-green">
                            <div class="bed-flow-header">
                                <span class="bed-flow-icon">📥</span>
                                <span class="bed-flow-lbl">Nhập viện mới</span>
                            </div>
                            <div class="bed-flow-num">+${newAdmissions}</div>
                            <div class="bed-flow-sub">Trong 24h</div>
                        </div>
                        <div class="bed-flow-card bed-flow-amber">
                            <div class="bed-flow-header">
                                <span class="bed-flow-icon">📤</span>
                                <span class="bed-flow-lbl">Xuất viện</span>
                            </div>
                            <div class="bed-flow-num">-${discharges}</div>
                            <div class="bed-flow-sub">Hoàn tất điều trị</div>
                        </div>
                        <div class="bed-flow-card bed-flow-purple">
                            <div class="bed-flow-header">
                                <span class="bed-flow-icon">⚡</span>
                                <span class="bed-flow-lbl">Từ HSCC / Hồi tỉnh</span>
                            </div>
                            <div class="bed-flow-num">${fromHSCC}</div>
                            <div class="bed-flow-sub">Nhận về phòng</div>
                        </div>
                    </div>
                    <div class="bed-flow-footer">
                        <small class="text-muted">📋 Dữ liệu đồng bộ từ Sổ giao ban 7h & 16h của Điều dưỡng.</small>
                    </div>
                </div>
            </div>
        </div>

        <!-- BOTTOM OPERATIONAL GRID (3 Balanced Columns) -->
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
                        <div class="duty-name">${item.staff.title ? item.staff.title + ' ' : ''}${item.staff.name}</div>
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
                        <div class="duty-name">${item.staff.title ? item.staff.title + ' ' : ''}${item.staff.name}</div>
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
                        <div class="timeline-time">${Utils.formatDateShort(p.date)} · ${p.time || ''}</div>
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

        // Window resize re-render
        if (!this._resizeHandler) {
            this._resizeHandler = () => {
                if (App.currentPage === 'dashboard') {
                    this.renderTrendChart();
                }
            };
            window.addEventListener('resize', this._resizeHandler);
        }

        // Listen for EMR data updates to re-render dashboard
        if (!this._emrListener) {
            this._emrListener = () => {
                if (App.currentPage === 'dashboard') App.renderCurrentPage();
            };
            window.addEventListener('emr-data-updated', this._emrListener);
        }

        // Listen for Theme switch to dynamically redraw canvas
        if (!this._themeObserver) {
            this._themeObserver = new MutationObserver(() => {
                if (App.currentPage === 'dashboard') {
                    this.renderTrendChart();
                }
            });
            this._themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        }
    },

    setTrendFilter(mode) {
        this._trendMonths = mode;
        if (typeof App !== 'undefined' && App.renderCurrentPage) {
            App.renderCurrentPage();
        } else {
            this.renderTrendChart();
        }
    },

    toggleSeries(seriesKey) {
        this._hiddenSeries[seriesKey] = !this._hiddenSeries[seriesKey];
        this.renderTrendChart();
        // Update legend active UI
        const legendItems = document.querySelectorAll('.trend-legend-item');
        legendItems.forEach(el => {
            if (el.textContent.includes(seriesKey)) {
                el.classList.toggle('inactive', this._hiddenSeries[seriesKey]);
            }
        });
    },

    // RENDER ADVANCED COMBO STACKED BAR + SPLINE TREND CHART
    renderTrendChart() {
        const canvas = document.getElementById('trend-chart');
        if (!canvas) return;
        const wrap = document.getElementById('trend-chart-wrap');
        if (!wrap) return;

        const w = wrap.clientWidth || 600;
        const h = wrap.clientHeight || 280;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const surgeries = Store.getAll('surgeries') || [];
        let numMonths = 6;
        if (this._trendMonths === 12) numMonths = 12;
        else if (this._trendMonths === 'year') {
            numMonths = new Date().getMonth() + 1;
        }

        const data = SurgeryMetrics.getMonthlyTrend(surgeries, numMonths);
        if (!data || data.length === 0) return;

        const pad = { top: 32, right: 24, bottom: 38, left: 46 };
        const cW = w - pad.left - pad.right;
        const cH = h - pad.top - pad.bottom;

        // Calculate max value for Y-axis (including benchmark & run-rate projections)
        const allTotals = data.map(m => Math.max(m.total, m.runRateProjected || 0));
        const avgValue = data.reduce((s, m) => s + m.total, 0) / data.length;
        const maxVal = Math.max(...allTotals, avgValue, 10);
        const yMax = Math.ceil(maxVal / 50) * 50 || 250;

        const yOf = v => pad.top + cH - (v / yMax) * cH;
        const xOf = i => pad.left + (i + 0.5) * (cW / data.length);
        const barWidth = Math.min(Math.max((cW / data.length) * 0.46, 18), 44);

        const isDark = (document.documentElement.getAttribute('data-theme') === 'dark') ||
                       (localStorage.getItem('ptdtt_theme') === 'dark') ||
                       (!document.documentElement.getAttribute('data-theme') && !localStorage.getItem('ptdtt_theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.18)';
        const textMuted = isDark ? '#94a3b8' : '#64748b';

        // 1. Draw Horizontal Grid Lines
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = textMuted;

        const gridSteps = 4;
        for (let i = 0; i <= gridSteps; i++) {
            const val = Math.round((yMax / gridSteps) * i);
            const y = yOf(val);
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(w - pad.right, y);
            ctx.stroke();
            ctx.fillText(val, pad.left - 8, y + 4);
        }

        // 2. Draw Benchmark Line (6-Month Average Reference)
        if (avgValue > 0) {
            const yAvg = yOf(avgValue);
            ctx.save();
            ctx.setLineDash([5, 4]);
            ctx.strokeStyle = isDark ? 'rgba(245, 158, 11, 0.65)' : 'rgba(217, 119, 6, 0.75)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(pad.left, yAvg);
            ctx.lineTo(w - pad.right, yAvg);
            ctx.stroke();

            // Benchmark label on right
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillStyle = isDark ? '#fbbf24' : '#d97706';
            ctx.fillText(`Mốc TB: ${Math.round(avgValue)} ca`, w - pad.right, yAvg - 6);
            ctx.restore();
        }

        // 3. Draw Stacked Bars (Exact colors from Lịch Mổ Tuần)
        const seriesColors = {
            yeucau: isDark ? '#fbbf24' : '#f59e0b',      // Vàng cam (Lịch mổ tuần)
            chuongtrinh: isDark ? '#60a5fa' : '#3b82f6', // Xanh dương (Lịch mổ tuần)
            robot: isDark ? '#818cf8' : '#1e3a5f',       // Xanh Navy (Lịch mổ tuần)
            bankhan: isDark ? '#f87171' : '#ef4444'      // Đỏ (Lịch mổ tuần)
        };

        const barCoordinates = [];

        data.forEach((m, i) => {
            const xCenter = xOf(i);
            const xLeft = xCenter - barWidth / 2;
            let currentYVal = 0;

            const hidden = this._hiddenSeries;
            const stackParts = [
                { key: 'yeucau', val: hidden['yeucau'] ? 0 : (m.byType.yeucau || 0), color: seriesColors.yeucau },
                { key: 'chuongtrinh', val: hidden['chuongtrinh'] ? 0 : (m.byType.chuongtrinh || 0), color: seriesColors.chuongtrinh },
                { key: 'robot', val: hidden['robot'] ? 0 : (m.byType.robot || 0), color: seriesColors.robot },
                { key: 'bankhan', val: hidden['bankhan'] ? 0 : (m.byType.bankhan || 0), color: seriesColors.bankhan }
            ];

            const activeStacks = stackParts.filter(p => p.val > 0);

            // Draw stacked segments
            activeStacks.forEach((part, partIdx) => {
                const yBottom = yOf(currentYVal);
                currentYVal += part.val;
                const yTop = yOf(currentYVal);
                const segHeight = yBottom - yTop;

                ctx.fillStyle = part.color;
                const isLastPart = (partIdx === activeStacks.length - 1);

                if (isLastPart && !m.isCurrentMonth) {
                    // Rounded top corners for topmost segment
                    ctx.beginPath();
                    const radius = 4;
                    ctx.moveTo(xLeft, yBottom);
                    ctx.lineTo(xLeft, yTop + radius);
                    ctx.quadraticCurveTo(xLeft, yTop, xLeft + radius, yTop);
                    ctx.lineTo(xLeft + barWidth - radius, yTop);
                    ctx.quadraticCurveTo(xLeft + barWidth, yTop, xLeft + barWidth, yTop + radius);
                    ctx.lineTo(xLeft + barWidth, yBottom);
                    ctx.closePath();
                    ctx.fill();
                } else {
                    ctx.fillRect(xLeft, yTop, barWidth, segHeight);
                }
            });

            // For Current Month: Draw Run-Rate Projection Extension
            if (m.isCurrentMonth && m.runRateProjected > m.total) {
                const yActualTop = yOf(m.total);
                const yProjTop = yOf(m.runRateProjected);
                const projHeight = yActualTop - yProjTop;

                ctx.save();
                ctx.fillStyle = isDark ? 'rgba(139, 92, 246, 0.12)' : 'rgba(139, 92, 246, 0.15)';
                ctx.strokeStyle = isDark ? 'rgba(139, 92, 246, 0.65)' : 'rgba(124, 58, 237, 0.7)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([3, 3]);

                // Draw dashed projection box
                ctx.beginPath();
                const radius = 4;
                ctx.moveTo(xLeft, yActualTop);
                ctx.lineTo(xLeft, yProjTop + radius);
                ctx.quadraticCurveTo(xLeft, yProjTop, xLeft + radius, yProjTop);
                ctx.lineTo(xLeft + barWidth - radius, yProjTop);
                ctx.quadraticCurveTo(xLeft + barWidth, yProjTop, xLeft + barWidth, yProjTop + radius);
                ctx.lineTo(xLeft + barWidth, yActualTop);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Projection badge on top
                ctx.font = 'bold 9.5px Inter, system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = isDark ? '#c084fc' : '#7c3aed';
                ctx.fillText(`~${m.runRateProjected}*`, xCenter, yProjTop - 6);
                ctx.restore();
            }

            barCoordinates.push({
                index: i,
                month: m,
                xCenter,
                xLeft,
                xRight: xLeft + barWidth,
                yTop: yOf(m.total),
                yBottom: yOf(0)
            });

            // X-axis label
            ctx.font = m.isCurrentMonth ? 'bold 11px Inter, system-ui, sans-serif' : '11px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = m.isCurrentMonth ? (isDark ? '#38bdf8' : '#0284c7') : textMuted;
            ctx.fillText(m.shortLabel + (m.isCurrentMonth ? '*' : ''), xCenter, h - pad.bottom + 16);

            if (m.isCurrentMonth) {
                ctx.font = '9px Inter, system-ui, sans-serif';
                ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
                ctx.fillText('(đến 21/8)', xCenter, h - pad.bottom + 28);
            }
        });

        // 4. Draw Spline Line for Total (if not hidden)
        if (!this._hiddenSeries['total']) {
            const points = data.map((m, i) => ({ x: xOf(i), y: yOf(m.total), val: m.total, isCur: m.isCurrentMonth }));

            ctx.save();
            ctx.strokeStyle = isDark ? '#38bdf8' : '#0f172a';
            ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            ctx.beginPath();
            points.forEach((pt, i) => {
                if (i === 0) ctx.moveTo(pt.x, pt.y);
                else {
                    const prev = points[i - 1];
                    const cpX = (prev.x + pt.x) / 2;
                    ctx.bezierCurveTo(cpX, prev.y, cpX, pt.y, pt.x, pt.y);
                }
            });
            ctx.stroke();

            // Total circular badges
            points.forEach(pt => {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
                ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
                ctx.fill();
                ctx.strokeStyle = isDark ? '#38bdf8' : '#0f172a';
                ctx.lineWidth = 2.5;
                ctx.stroke();

                // Number label on top
                if (!pt.isCur) {
                    ctx.font = 'bold 10px Inter, system-ui, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
                    ctx.fillText(pt.val, pt.x, pt.y - 8);
                }
            });
            ctx.restore();
        }

        // 5. Tooltip on Hover
        canvas.onmousemove = (e) => {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const tooltip = document.getElementById('trend-tooltip');
            if (!tooltip) return;

            let hovered = barCoordinates.find(b => mx >= b.xLeft - 6 && mx <= b.xRight + 6);
            if (!hovered) {
                // Check closest
                let closest = -1, minD = Infinity;
                barCoordinates.forEach((b, idx) => {
                    const d = Math.abs(mx - b.xCenter);
                    if (d < minD) { minD = d; closest = idx; }
                });
                if (closest >= 0 && minD < (cW / data.length) * 0.6) {
                    hovered = barCoordinates[closest];
                }
            }

            if (hovered) {
                const m = hovered.month;
                const statusTag = m.isCurrentMonth ? '<span class="trend-tooltip-badge live">Đang diễn ra (đến 21/08)</span>' : '<span class="trend-tooltip-badge">Hoàn tất</span>';
                const runRateHtml = m.isCurrentMonth ? `
                    <div class="trend-tooltip-proj-box">
                        <div class="trend-proj-title">⚡ Dự phóng cả tháng (Run-rate): <strong>~${m.runRateProjected} ca</strong></div>
                        <div class="trend-proj-sub">Tốc độ hiện tại thấp hơn TB 6 tháng (${Math.round(avgValue)} ca) <strong>-${Math.abs(Math.round(((m.runRateProjected/avgValue)-1)*100))}%</strong></div>
                    </div>` : '';

                tooltip.innerHTML = `
                    <div class="trend-tooltip-header">
                        <strong>${m.label}</strong>
                        ${statusTag}
                    </div>
                    <div class="trend-tooltip-total-row">
                        <span>Tổng số ca:</span>
                        <strong class="trend-tooltip-total-num">${m.total} ca</strong>
                    </div>
                    <div class="trend-tooltip-breakdown">
                        <div class="trend-tooltip-row">
                            <span><span class="trend-legend-dot" style="background:#f59e0b"></span> PT Yêu cầu</span>
                            <strong>${m.byType.yeucau} <small>(${m.total > 0 ? (m.byType.yeucau/m.total*100).toFixed(1) : 0}%)</small></strong>
                        </div>
                        <div class="trend-tooltip-row">
                            <span><span class="trend-legend-dot" style="background:#3b82f6"></span> PT Chương trình</span>
                            <strong>${m.byType.chuongtrinh} <small>(${m.total > 0 ? (m.byType.chuongtrinh/m.total*100).toFixed(1) : 0}%)</small></strong>
                        </div>
                        <div class="trend-tooltip-row">
                            <span><span class="trend-legend-dot" style="background:#1e3a5f"></span> PT Robot</span>
                            <strong>${m.byType.robot} <small>(${m.total > 0 ? (m.byType.robot/m.total*100).toFixed(1) : 0}%)</small></strong>
                        </div>
                        <div class="trend-tooltip-row">
                            <span><span class="trend-legend-dot" style="background:#ef4444"></span> Bán khẩn</span>
                            <strong>${m.byType.bankhan} <small>(${m.total > 0 ? (m.byType.bankhan/m.total*100).toFixed(1) : 0}%)</small></strong>
                        </div>
                    </div>
                    <div class="trend-tooltip-mis-row">
                        <span>✨ Tỉ lệ MIS (Nội soi + Robot):</span>
                        <strong class="text-blue">${m.mis.misPct}%</strong>
                    </div>
                    ${runRateHtml}
                `;
                tooltip.classList.add('visible');

                // Positioning
                const tipW = tooltip.offsetWidth || 220;
                let leftPos = hovered.xCenter - tipW / 2;
                if (leftPos < 10) leftPos = 10;
                if (leftPos + tipW > w - 10) leftPos = w - tipW - 10;
                tooltip.style.left = leftPos + 'px';
                tooltip.style.top = '10px';
            } else {
                tooltip.classList.remove('visible');
            }
        };

        canvas.onmouseleave = () => {
            const t = document.getElementById('trend-tooltip');
            if (t) t.classList.remove('visible');
        };
    },

    // Birthday Logic
    getTodayBirthdays(allStaff, todayStr) {
        if (!allStaff || !allStaff.length) return null;
        const parts = (todayStr || '').split('-');
        if (parts.length < 3) return null;

        const targetMonth = parts[1];
        const targetDay = parts[2];
        const exactMatches = allStaff.filter(s => {
            const dob = s.dob || '';
            if (!dob) return false;
            let m = '', d = '';
            if (dob.includes('-')) {
                const p = dob.split('-');
                if (p.length === 3) { m = p[1].padStart(2, '0'); d = p[2].padStart(2, '0'); }
            } else if (dob.includes('/')) {
                const p = dob.split('/');
                if (p.length === 3) { d = p[0].padStart(2, '0'); m = p[1].padStart(2, '0'); }
            } else if (dob.includes('.')) {
                const p = dob.split('.');
                if (p.length === 3) { d = p[0].padStart(2, '0'); m = p[1].padStart(2, '0'); }
            }
            return m === targetMonth && d === targetDay;
        });

        if (exactMatches.length > 0) {
            return {
                isToday: true,
                isTestPreview: false,
                staff: exactMatches,
                dateStr: `${targetDay}.${targetMonth}`,
                daysLeft: 0
            };
        }

        return null;
    },

    // Role-specific birthday wishes database
    BIRTHDAY_WISHES_BY_ROLE: {
        'bcn': [
            'bước sang tuổi mới luôn dồi dào sức khỏe, tràn đầy tâm huyết, dẫn dắt Khoa PTĐTT ngày càng phát triển vững mạnh và gặt hái nhiều đỉnh cao y học mới! 🌟',
            'tuổi mới luôn vững tay dao, sáng tâm y đức, lãnh đạo khoa đoàn kết phát triển và gia đình vạn sự an khang thịnh vượng! 🌿',
            'thêm một tuổi mới tràn đầy năng lượng, sức khỏe dẻo dai, luôn là ngọn hải đăng soi đường cho tập thể khoa và đạt nhiều thắng lợi rực rỡ trong chuyên môn lẫn NCKH! 🏆',
            'tuổi mới luôn an khang, tràn đầy nhiệt huyết đổi mới sáng tạo, đưa uy tín chuyên môn của khoa ngày càng vươn xa! ✨'
        ],
        'ddt': [
            'tuổi mới luôn trẻ trung, xinh đẹp, ngập tràn niềm vui, điều hành công tác điều dưỡng khoa ngày càng chuyên nghiệp và gia đình hạnh phúc viên mãn! 🌺',
            'thêm tuổi mới dồi dào sức khỏe, tràn đầy nhiệt huyết, luôn là người chị cả vững vàng kết nối tập thể điều dưỡng khoa đoàn kết yêu thương! 💖',
            'bước sang tuổi mới vạn sự như ý, luôn tươi vui rạng rỡ, hoàn thành xuất sắc mọi nhiệm vụ và giữ mãi ngọn lửa yêu nghề ấm áp! ✨'
        ],
        'bs_chinh': [
            'bước sang tuổi mới vững vàng tay dao, tinh anh đường mổ, cứu chữa thành công nhiều ca bệnh khó và luôn gặt hái nhiều thành tựu lớn trong sự nghiệp ngoại khoa! 🩺',
            'tuổi mới luôn dồi dào sức khỏe, phẫu thuật bách phát bách trúng, nghiên cứu khoa học thăng hoa và gia đình hạnh phúc an vui! 🌟',
            'thêm tuổi mới ngập tràn năng lượng tích cực, luôn giữ vững ngọn lửa đam mê ngoại khoa, truyền cảm hứng cho thế hệ trẻ và vạn sự hanh thông! 🏆',
            'tuổi mới vạn sự cát tường, đường mổ hanh thông, luôn là trụ cột phẫu thuật vững chắc của khoa và đạt nhiều bước tiến vượt bậc! 💫'
        ],
        'bs_hocvien': [
            'tuổi mới học tập xuất sắc, tôi luyện tay dao ngày càng sắc bén, tích lũy nhiều kinh nghiệm quý báu và sớm trở thành phẫu thuật viên ưu tú của ngoại khoa! 🎓',
            'thêm tuổi mới dồi dào sức khỏe, thi cử xuất sắc, vững vàng chuyên môn lâm sàng và đạt nhiều bước tiến vượt bậc trên con đường y nghiệp! 🚀',
            'bước sang tuổi mới ngập tràn nhiệt huyết tuổi trẻ, học hỏi nhiều điều hay từ các thầy cô, đồng nghiệp và gặt hái nhiều thành công rực rỡ! ✨',
            'tuổi mới tràn đầy năng lượng, vững vàng tay nghề, trực gác bình an và hoàn thành xuất sắc chương trình đào tạo! 🌟'
        ],
        'dieu_duong': [
            'tuổi mới luôn dồi dào sức khỏe, xinh tươi rạng rỡ, tận tâm yêu nghề và luôn là điểm tựa ấm áp mang lại niềm tin cho mọi người bệnh! 🌸',
            'thêm một tuổi mới ngập tràn niềm vui, công tác thuận lợi, gia đình hạnh phúc và luôn giữ vững nụ cười ân cần, chu đáo! 💖',
            'tuổi mới vạn sự may mắn, tràn đầy năng lượng tích cực, chăm sóc người bệnh tận tụy và cùng tập thể khoa gặt hái nhiều thành công! 🌷'
        ],
        'ho_ly': [
            'tuổi mới dồi dào sức khỏe, luôn tươi vui yêu đời, công việc thuận lợi và gia đình luôn đầm ấm, an vui hạnh phúc! 🍀',
            'thêm tuổi mới an khang thịnh vượng, luôn là hậu phương thầm lặng vững chắc giúp khoa luôn sạch đẹp, ngăn nắp và chu đáo! 💐'
        ],
        'thu_ky': [
            'tuổi mới xinh đẹp rạng ngời, công việc hanh thông, quản lý hồ sơ hành chính khoa học chỉn chu và ngập tràn niềm vui may mắn! 🎀',
            'thêm một tuổi mới vạn sự như ý, luôn tươi trẻ, tràn đầy nhiệt huyết và hoàn thành xuất sắc mọi kế hoạch công tác! ✨'
        ]
    },

    getWishRoleGroup(staffMember) {
        if (!staffMember) return 'dieu_duong';
        const role = (staffMember.role || '').toLowerCase();
        const title = (staffMember.title || '').toLowerCase();
        const name = (staffMember.name || '').toLowerCase();

        if (role.includes('trưởng khoa') && !role.includes('phó') && !role.includes('điều dưỡng')) return 'bcn';
        if (role.includes('phó trưởng khoa') || role.includes('phó khoa')) return 'bcn';
        if (role.includes('điều dưỡng trưởng') || role.includes('đdt')) return 'ddt';

        if (role.includes('bác sĩ') || title.includes('bs') || title.includes('ts') || title.includes('ths') || title.includes('bsck')) {
            if (role.includes('học viên') || role.includes('nội trú') || role.includes('bsnt') || role.includes('ck1') || role.includes('ck2') || role.includes('luân khoa')) {
                return 'bs_hocvien';
            }
            return 'bs_chinh';
        }

        if (role.includes('hộ lý') || role.includes('y công')) return 'ho_ly';
        if (role.includes('thư ký') || role.includes('hành chính') || role.includes('tk y khoa')) return 'thu_ky';

        return 'dieu_duong';
    },

    getRandomWish(staffMember) {
        const group = this.getWishRoleGroup(staffMember);
        const list = this.BIRTHDAY_WISHES_BY_ROLE[group] || this.BIRTHDAY_WISHES_BY_ROLE['dieu_duong'];
        const idx = Math.floor(Math.random() * list.length);
        return list[idx];
    },

    getBirthdayTier(staffList) {
        if (!staffList || !staffList.length) return 'standard';
        const isChief = staffList.some(s => {
            const r = (s?.role || '').toLowerCase();
            return r.includes('trưởng khoa') && !r.includes('phó') && !r.includes('điều dưỡng');
        });
        if (isChief) return 'chief';

        const isBCN = staffList.some(s => {
            const r = (s?.role || '').toLowerCase();
            return r.includes('phó trưởng khoa') || r.includes('phó khoa') || r.includes('điều dưỡng trưởng') || r.includes('đdt');
        });
        if (isBCN) return 'bcn';

        return 'standard';
    },

    renderBirthdayBanner(bdayInfo, todayStr) {
        if (!bdayInfo || !bdayInfo.staff || bdayInfo.staff.length === 0) return '';
        const { isToday, isTestPreview, staff, dateStr, daysLeft } = bdayInfo;
        const tier = this.getBirthdayTier(staff);

        let badgeTitle = 'HAPPY BIRTHDAY';
        let subTitleBadge = isToday ? 'Hôm nay sinh nhật' : `Sinh nhật sắp tới (${dateStr})`;
        let cakeIcon = '🎂';

        if (tier === 'chief') {
            badgeTitle = '👑 BS. TRƯỞNG KHOA';
            subTitleBadge = isToday ? 'SINH NHẬT BÁC SĨ TRƯỞNG KHOA' : `SINH NHẬT TRƯỞNG KHOA (${dateStr})`;
            cakeIcon = '👑';
        } else if (tier === 'bcn') {
            cakeIcon = '👑';
            const isDDT = staff.some(s => {
                const r = (s?.role || '').toLowerCase();
                return r.includes('điều dưỡng trưởng') || r.includes('đdt');
            });
            if (isDDT) {
                badgeTitle = '👑 ĐIỀU DƯỠNG TRƯỞNG';
                subTitleBadge = isToday ? 'Sinh nhật Điều dưỡng trưởng' : `Sinh nhật Điều dưỡng trưởng (${dateStr})`;
            } else {
                badgeTitle = '👑 BS. PHÓ TRƯỞNG KHOA';
                subTitleBadge = isToday ? 'Sinh nhật BS. Phó trưởng khoa' : `Sinh nhật BS. Phó trưởng khoa (${dateStr})`;
            }
        }

        const prefixTag = isTestPreview ? `[CHẠY THỬ / SẮP TỚI NGÀY ${dateStr}] ` : '';

        const messageParts = staff.map(s => {
            const titleName = `${s.title ? s.title + ' ' : ''}${s.name}`;
            const roleStr = s.role ? ` (${s.role})` : '';
            const pronoun = s.gender === 'Nữ' ? 'Chị' : (s.role.includes('Trưởng khoa') || s.role.includes('Bác sĩ') ? 'Bác sĩ' : 'Anh');
            const wishContent = this.getRandomWish(s);
            return `🎉 ${prefixTag}Chúc mừng sinh nhật <strong>${titleName}</strong>${roleStr}! 🎂 Khoa Phẫu thuật Đại trực tràng thân chúc ${pronoun} ${wishContent} 💐 🎈 🎁`;
        });
        const combinedMessage = messageParts.join(' &nbsp;&nbsp;✦&nbsp;&nbsp; ');

        return `
        <div class="birthday-banner tier-${tier} slide-up" role="region" aria-label="Chúc mừng sinh nhật nhân sự khoa">
            <div class="birthday-banner-inner">
                <div class="birthday-badge-wrap" onclick="DashboardPage.triggerConfetti('${tier}')" title="Bấm để chúc mừng sinh nhật 🎉">
                    <div class="birthday-cake-icon">${cakeIcon}</div>
                    <div class="birthday-badge-content">
                        <div class="birthday-badge-title">${badgeTitle}</div>
                        <div class="birthday-badge-sub">${subTitleBadge}</div>
                    </div>
                </div>

                <div class="birthday-ticker-container" onclick="DashboardPage.triggerConfetti('${tier}')" title="Bấm để bắn pháo hoa 🎉">
                    <div class="birthday-ticker-track">
                        <div class="birthday-ticker-segment">${combinedMessage}</div>
                        <div class="birthday-ticker-segment" aria-hidden="true">${combinedMessage}</div>
                    </div>
                </div>

                <div class="birthday-avatars-wrap">
                    ${staff.map(s => `
                        <div class="birthday-person-pill" onclick="DashboardPage.triggerConfetti('${tier}')" title="Sinh nhật ${s.name} (${dateStr}) 🎉">
                            <div class="birthday-avatar-sm" style="background:${s.color || (tier === 'chief' ? '#d97706' : '#ec4899')}">${Utils.getInitials(s.name)}</div>
                            <span class="birthday-person-name">${s.name} <small style="color:var(--text-muted);font-weight:normal">(${dateStr})</small></span>
                            <span class="birthday-crown">${tier === 'chief' ? '👑✨' : '👑'}</span>
                        </div>
                    `).join('')}
                    <button class="birthday-btn-celebrate" onclick="DashboardPage.triggerConfetti('${tier}')" title="Bắn pháo hoa chúc mừng">
                        🎉 Chúc mừng
                    </button>
                </div>
            </div>
            <canvas id="birthday-confetti-canvas" class="birthday-confetti-canvas"></canvas>
        </div>
        `;
    },

    triggerConfetti(tier = 'standard') {
        const canvas = document.getElementById('birthday-confetti-canvas');
        if (!canvas) {
            Toast.success('🎉 Chúc mừng sinh nhật đồng nghiệp Khoa Phẫu thuật Đại trực tràng! 🎂✨');
            return;
        }

        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width || window.innerWidth;
        canvas.height = rect.height || 120;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let particleCount = 65;
        let colors = ['#ec4899', '#f43f5e', '#a855f7', '#06b6d4', '#fbbf24', '#10b981'];

        if (tier === 'chief') {
            particleCount = 125;
            colors = ['#fbbf24', '#f59e0b', '#d97706', '#6366f1', '#8b5cf6', '#ffffff', '#e0e7ff'];
        } else if (tier === 'bcn') {
            particleCount = 90;
            colors = ['#38bdf8', '#0284c7', '#fbbf24', '#f59e0b', '#ec4899', '#ffffff'];
        }

        const particles = [];
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: canvas.width / 2 + (Math.random() - 0.5) * (canvas.width * 0.7),
                y: canvas.height * 0.4,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.7) * 8 - 2,
                size: Math.random() * 6 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                vRot: (Math.random() - 0.5) * 12,
                alpha: 1,
                decay: Math.random() * 0.015 + 0.015
            });
        }

        let animId;
        const renderFrame = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let active = 0;
            particles.forEach(p => {
                if (p.alpha > 0) {
                    active++;
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.22;
                    p.rotation += p.vRot;
                    p.alpha -= p.decay;

                    ctx.save();
                    ctx.globalAlpha = Math.max(p.alpha, 0);
                    ctx.translate(p.x, p.y);
                    ctx.rotate((p.rotation * Math.PI) / 180);
                    ctx.fillStyle = p.color;
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                    ctx.restore();
                }
            });

            if (active > 0) {
                animId = requestAnimationFrame(renderFrame);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                cancelAnimationFrame(animId);
            }
        };

        if (this._confettiAnimId) cancelAnimationFrame(this._confettiAnimId);
        this._confettiAnimId = requestAnimationFrame(renderFrame);
        Toast.success(tier === 'chief' ? '👑 Tập thể Khoa Phẫu thuật Đại trực tràng kính chúc mừng sinh nhật Bác sĩ Trưởng khoa! 🎂🌟' : '🎉 Chúc mừng sinh nhật đồng nghiệp! 🎂💐');
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

if (typeof window !== 'undefined') {
    window.DashboardPage = DashboardPage;
}
