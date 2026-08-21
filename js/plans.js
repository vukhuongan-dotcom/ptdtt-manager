// ===== PLANS (CALENDAR) PAGE =====
const PlansPage = {
    currentDate: new Date(),
    viewMode: 'agenda', // 'agenda', 'month', 'week', '3day'
    typeFilter: 'all',
    selectedDate: null,

    setTypeFilter(type) {
        this.typeFilter = type;
        App.renderCurrentPage();
    },

    selectDate(dateStr) {
        if (this.selectedDate === dateStr) {
            this.selectedDate = null; // toggle off
        } else {
            this.selectedDate = dateStr;
        }
        App.renderCurrentPage();
    },

    render() {
        const isAdmin = Auth.getSession()?.isAdmin;
        const allMonthPlans = Store.getPlansByMonth(this.currentDate.getFullYear(), this.currentDate.getMonth());

        // Count by type for filter pills
        const meetingCount = allMonthPlans.filter(p => p.type === 'meeting').length;
        const consultCount = allMonthPlans.filter(p => p.type === 'consultation').length;
        const trainCount = allMonthPlans.filter(p => p.type === 'training' || p.source === 'shcm').length;
        const confCount = allMonthPlans.filter(p => p.type === 'conference').length;

        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Kế hoạch hoạt động</h1>
                <p class="page-subtitle">Lịch hoạt động & công tác khoa — ${this.getHeaderLabel()}</p>
            </div>
            ${isAdmin ? `<button class="btn btn-primary" onclick="PlansPage.openForm()" aria-label="Thêm kế hoạch mới">
                ${Utils.plusIcon()} Thêm kế hoạch
            </button>` : ''}
        </div>

        <!-- Controls: Navigation & View Mode Switcher -->
        <div class="calendar-controls">
            <div class="calendar-nav">
                <button class="btn-icon" onclick="PlansPage.prev()" aria-label="Xem khoảng thời gian trước">${Utils.chevronLeft()}</button>
                <span class="calendar-month-label">${this.getNavLabel()}</span>
                <button class="btn-icon" onclick="PlansPage.next()" aria-label="Xem khoảng thời gian sau">${Utils.chevronRight()}</button>
                <button class="btn btn-secondary btn-sm" onclick="PlansPage.today()" aria-label="Xem kế hoạch hôm nay">Hôm nay</button>
            </div>
            <div class="calendar-view-modes">
                <button class="view-mode-btn ${this.viewMode==='agenda'?'active':''}" onclick="PlansPage.setView('agenda')">📅 Lịch trình</button>
                <button class="view-mode-btn ${this.viewMode==='month'?'active':''}" onclick="PlansPage.setView('month')">Tháng</button>
                <button class="view-mode-btn ${this.viewMode==='week'?'active':''}" onclick="PlansPage.setView('week')">Tuần</button>
                <button class="view-mode-btn ${this.viewMode==='3day'?'active':''}" onclick="PlansPage.setView('3day')">3 ngày</button>
            </div>
        </div>

        <!-- Type Filter Pills -->
        <div class="cal-type-filters">
            <button class="cal-filter-pill ${this.typeFilter==='all'?'active':''}" onclick="PlansPage.setTypeFilter('all')">
                Tất cả (${allMonthPlans.length})
            </button>
            <button class="cal-filter-pill pill-meeting ${this.typeFilter==='meeting'?'active':''}" onclick="PlansPage.setTypeFilter('meeting')">
                🔵 Giao ban (${meetingCount})
            </button>
            <button class="cal-filter-pill pill-consultation ${this.typeFilter==='consultation'?'active':''}" onclick="PlansPage.setTypeFilter('consultation')">
                🟣 Hội chẩn (${consultCount})
            </button>
            <button class="cal-filter-pill pill-training ${this.typeFilter==='training'?'active':''}" onclick="PlansPage.setTypeFilter('training')">
                🟢 Đào tạo / SHCM (${trainCount})
            </button>
            <button class="cal-filter-pill pill-conference ${this.typeFilter==='conference'?'active':''}" onclick="PlansPage.setTypeFilter('conference')">
                🟡 Hội nghị (${confCount})
            </button>
        </div>

        ${this.viewMode === 'agenda' ? this.renderAgenda(isAdmin) : (this.viewMode === 'month' ? this.renderMonth(isAdmin) : this.renderDayColumns(isAdmin))}
        `;
    },

    // ===== AGENDA / TIMELINE VIEW (MOBILE & DESKTOP) =====
    renderAgenda(isAdmin) {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        let plans = Store.getPlansByMonth(year, month);

        if (this.typeFilter !== 'all') {
            plans = plans.filter(p => p.type === this.typeFilter || (this.typeFilter === 'training' && p.source === 'shcm'));
        }

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

        // Map plans to dates
        const dateMap = new Map();
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dayPlans = plans.filter(p => this._isDateInRange(dateStr, p))
                .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
            if (dayPlans.length > 0) {
                dateMap.set(dateStr, dayPlans);
            }
        }

        const staff = Store.getAll('staff');
        const staffMap = new Map(staff.map(s => [s.id, s]));

        // Filter by selected date if clicked on dot calendar
        let displayDates = Array.from(dateMap.keys());
        if (this.selectedDate) {
            displayDates = displayDates.filter(d => d === this.selectedDate);
        }

        return `
        <div class="cal-agenda-container">
            <!-- Mini Dot Calendar Strip -->
            <div class="cal-mini-strip-card card">
                <div class="cal-mini-strip-header">
                    <span class="cal-mini-title">🗓️ Lịch tháng ${month + 1}/${year}</span>
                    ${this.selectedDate ? `<button class="btn btn-secondary btn-sm" onclick="PlansPage.selectDate('${this.selectedDate}')">Xem tất cả</button>` : ''}
                </div>
                <div class="cal-mini-strip-days">
                    ${Array.from({length: daysInMonth}, (_, i) => {
                        const d = i + 1;
                        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                        const dayObj = new Date(year, month, d);
                        const dayName = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][dayObj.getDay()];
                        const isToday = dateStr === todayStr;
                        const isSelected = dateStr === this.selectedDate;
                        const dayPlans = plans.filter(p => this._isDateInRange(dateStr, p));
                        const hasPlans = dayPlans.length > 0;

                        return `
                        <div class="cal-mini-day-cell ${isToday?'today':''} ${isSelected?'selected':''} ${hasPlans?'has-plans':''}" onclick="PlansPage.selectDate('${dateStr}')">
                            <span class="cal-mini-day-name">${dayName}</span>
                            <span class="cal-mini-day-num">${d}</span>
                            <div class="cal-mini-dots">
                                ${dayPlans.slice(0, 3).map(p => `<span class="cal-dot cal-dot-${p.type}"></span>`).join('')}
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Timeline Event Groups -->
            <div class="cal-agenda-list">
                ${displayDates.length === 0 ? `
                    <div class="card cal-agenda-empty">
                        <span class="cal-empty-icon">📅</span>
                        <h3>Không có kế hoạch nào ${this.selectedDate ? 'trong ngày ' + Utils.formatDate(this.selectedDate) : 'trong tháng này'}</h3>
                        <p class="text-muted">Nhấn "+ Thêm kế hoạch" để tạo lịch công tác mới cho khoa.</p>
                        ${isAdmin ? `<button class="btn btn-primary" onclick="PlansPage.openForm(null, '${this.selectedDate || todayStr}')">
                            ${Utils.plusIcon()} Thêm kế hoạch ngay
                        </button>` : ''}
                    </div>
                ` : displayDates.map(dateStr => {
                    const dayPlans = dateMap.get(dateStr) || [];
                    const d = new Date(dateStr);
                    const dayOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][d.getDay()];
                    const dateDisplay = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
                    const isToday = dateStr === todayStr;

                    return `
                    <div class="cal-agenda-group">
                        <div class="cal-agenda-group-header ${isToday?'today-header':''}">
                            <div class="cal-agenda-date-badge">
                                <span class="cal-group-day">${dayOfWeek}</span>
                                <span class="cal-group-date">${dateDisplay}</span>
                            </div>
                            ${isToday ? '<span class="cal-today-pill">🌟 Hôm nay</span>' : ''}
                            <span class="cal-group-count">${dayPlans.length} sự kiện</span>
                        </div>
                        <div class="cal-agenda-cards">
                            ${dayPlans.map(p => {
                                const resp = staffMap.get(p.responsible);
                                const isSHCM = p.source === 'shcm';
                                const typeLabel = isSHCM ? 'Sinh hoạt chuyên môn' : Utils.planTypeLabel(p.type);
                                return `
                                <div class="cal-agenda-card cal-card-${p.type} ${isSHCM?'cal-card-shcm':''}" onclick="PlansPage.viewOrEdit(${p.id})">
                                    <div class="cal-agenda-card-left">
                                        <span class="cal-card-time">${p.allDay ? '📌 Cả ngày' : (p.time || '08:00')}</span>
                                        ${p.duration && !p.allDay ? `<span class="cal-card-duration">${p.duration}</span>` : ''}
                                    </div>
                                    <div class="cal-agenda-card-body">
                                        <div class="cal-card-top-row">
                                            <span class="cal-card-type-badge cal-badge-${p.type}">
                                                ${isSHCM ? '🔬 ' : ''}${typeLabel}
                                            </span>
                                        </div>
                                        <div class="cal-card-title">${p.title}</div>
                                        <div class="cal-card-meta-row">
                                            ${p.location ? `<span class="cal-card-meta-item">📍 ${p.location}</span>` : ''}
                                            ${resp ? `<span class="cal-card-meta-item">👤 ${resp.title || 'BS.'} ${resp.name}</span>` : ''}
                                        </div>
                                        ${p.note ? `<div class="cal-card-note">📝 ${p.note}</div>` : ''}
                                    </div>
                                    ${isAdmin ? `
                                    <div class="cal-agenda-card-actions" onclick="event.stopPropagation()">
                                        <button class="btn-icon" onclick="PlansPage.viewOrEdit(${p.id})" title="Xem / Sửa">✏️</button>
                                        ${!isSHCM ? `<button class="btn-icon" onclick="PlansPage.deletePlan(${p.id})" title="Xoá">🗑️</button>` : ''}
                                    </div>
                                    ` : ''}
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        </div>
        `;
    },

    getHeaderLabel() {
        return this.currentDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
    },

    getNavLabel() {
        if (this.viewMode === 'month' || this.viewMode === 'agenda') {
            const l = this.currentDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
            return l.charAt(0).toUpperCase() + l.slice(1);
        }
        const dates = this.getViewDates();
        const first = dates[0];
        const last = dates[dates.length - 1];
        return `${first.getDate()}/${first.getMonth()+1} — ${last.getDate()}/${last.getMonth()+1}/${last.getFullYear()}`;
    },

    getViewDates() {
        const d = new Date(this.currentDate);
        if (this.viewMode === 'week') {
            const day = d.getDay();
            const mon = new Date(d);
            mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
            return Array.from({length: 7}, (_, i) => { const dd = new Date(mon); dd.setDate(mon.getDate() + i); return dd; });
        } else {
            return Array.from({length: 3}, (_, i) => { const dd = new Date(d); dd.setDate(d.getDate() + i); return dd; });
        }
    },

    // ===== MONTH VIEW =====
    renderMonth(isAdmin) {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        let plans = Store.getPlansByMonth(year, month)
            .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

        if (this.typeFilter !== 'all') {
            plans = plans.filter(p => p.type === this.typeFilter || (this.typeFilter === 'training' && p.source === 'shcm'));
        }

        return `
        <div class="calendar-grid">
            ${['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(d => `<div class="calendar-day-header">${d}</div>`).join('')}
            ${this.renderMonthDays(year, month, plans, isAdmin)}
        </div>`;
    },

    renderMonthDays(year, month, plans, isAdmin) {
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        let html = '';

        const prevDays = new Date(year, month, 0).getDate();
        for (let i = firstDay - 1; i >= 0; i--) {
            html += `<div class="calendar-day other-month"><span class="day-number">${prevDays - i}</span></div>`;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
            const dayPlans = plans.filter(p => this._isDateInRange(dateStr, p));

            html += `<div class="calendar-day ${isToday?'today':''}" ${isAdmin ? `onclick="PlansPage.openForm(null,'${dateStr}')"` : ''}>
                <span class="day-number">${d}</span>
                ${dayPlans.map(p => {
                    const isMulti = p.endDate && p.endDate !== p.date;
                    const isStart = p.date === dateStr;
                    const isEnd = (p.endDate || p.date) === dateStr;
                    let spanClass = p.type + (p.source === 'shcm' ? ' shcm-event' : '');
                    if (isMulti) {
                        spanClass += ' multi-day';
                        if (isStart) spanClass += ' multi-start';
                        else if (isEnd) spanClass += ' multi-end';
                        else spanClass += ' multi-mid';
                    }
                    const label = isStart ? `${p.allDay ? '📌' : p.time} ${p.source === 'shcm' ? '🔬 ' : ''}${p.title}` : `↳ ${p.title}`;
                    return `<div class="calendar-event ${spanClass}" onclick="event.stopPropagation();PlansPage.viewOrEdit(${p.id})" title="${p.source === 'shcm' ? '🔬 ' : ''}${p.title}${p.allDay ? ' (cả ngày)' : ' — ' + p.time}${p.duration ? ' (' + p.duration + ')' : ''}">
                        ${label}
                    </div>`;
                }).join('')}
            </div>`;
        }

        const totalCells = firstDay + daysInMonth;
        const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let i = 1; i <= remaining; i++) {
            html += `<div class="calendar-day other-month"><span class="day-number">${i}</span></div>`;
        }
        return html;
    },

    _isDateInRange(dateStr, plan) {
        const start = plan.date;
        const end = plan.endDate || plan.date;
        return dateStr >= start && dateStr <= end;
    },

    // ===== WEEK / 3-DAY VIEW =====
    renderDayColumns(isAdmin) {
        const dates = this.getViewDates();
        const today = new Date();
        today.setHours(0,0,0,0);
        let allPlans = Store.getAll('plans').sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return (a.time || '').localeCompare(b.time || '');
        });

        if (this.typeFilter !== 'all') {
            allPlans = allPlans.filter(p => p.type === this.typeFilter || (this.typeFilter === 'training' && p.source === 'shcm'));
        }

        const hours = [];
        for (let h = 6; h <= 22; h++) hours.push(h);

        return `
        <div class="calendar-columns ${this.viewMode === '3day' ? 'three-day' : 'seven-day'}">
            <div class="cal-col-header-row">
                <div class="cal-time-gutter"></div>
                ${dates.map(d => {
                    const isToday = d.getTime() === today.getTime();
                    const dayLabel = d.toLocaleDateString('vi-VN', {weekday: 'short'});
                    const dayNum = d.getDate();
                    const monthNum = d.getMonth() + 1;
                    return `<div class="cal-col-header ${isToday ? 'today' : ''}">
                        <span class="cal-col-day">${dayLabel}</span>
                        <span class="cal-col-date ${isToday ? 'today-num' : ''}">${dayNum}/${monthNum}</span>
                    </div>`;
                }).join('')}
            </div>
            <div class="cal-col-body">
                <div class="cal-time-gutter">
                    ${hours.map(h => `<div class="cal-time-slot">${String(h).padStart(2,'0')}:00</div>`).join('')}
                </div>
                ${dates.map(d => {
                    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                    const dayPlans = allPlans.filter(p => this._isDateInRange(dateStr, p));
                    const isToday = d.getTime() === today.getTime();

                    return `<div class="cal-day-col ${isToday ? 'today-col' : ''}" ${isAdmin ? `onclick="PlansPage.openForm(null,'${dateStr}')"` : ''}>
                        ${hours.map(h => `<div class="cal-hour-cell"></div>`).join('')}
                        ${dayPlans.map(p => {
                            if (p.allDay) {
                                return `<div class="cal-event cal-event-allday ${p.type}" onclick="event.stopPropagation();PlansPage.viewOrEdit(${p.id})" title="${p.title}">
                                    <span class="cal-event-title">📌 ${p.title}</span>
                                </div>`;
                            }
                            const [hh, mm] = (p.time || '08:00').split(':').map(Number);
                            const topPx = (hh - 6) * 52 + (mm / 60) * 52;
                            const durationMin = this.parseDuration(p.duration);
                            const heightPx = Math.max(durationMin > 0 ? (durationMin / 60) * 52 : 44, 28);
                            return `<div class="cal-event ${p.type}" style="top:${topPx}px;height:${heightPx}px" onclick="event.stopPropagation();PlansPage.viewOrEdit(${p.id})" title="${p.title}">
                                <span class="cal-event-time">${p.time}${p.duration ? ' · ' + p.duration : ''}</span>
                                <span class="cal-event-title">${p.title}</span>
                            </div>`;
                        }).join('')}
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    },

    parseDuration(dur) {
        if (!dur || dur === 'Cả ngày') return 0;
        let mins = 0;
        const hMatch = dur.match(/(\d+)\s*h/i);
        const mMatch = dur.match(/(\d+)\s*(?:m|ph)/i);
        if (hMatch) mins += parseInt(hMatch[1]) * 60;
        if (mMatch) mins += parseInt(mMatch[1]);
        if (!hMatch && !mMatch) {
            const n = parseInt(dur);
            if (!isNaN(n)) mins = n;
        }
        return mins;
    },

    // ===== NAVIGATION =====
    setView(mode) { this.viewMode = mode; App.renderCurrentPage(); },

    prev() {
        if (this.viewMode === 'month') this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        else if (this.viewMode === 'week') this.currentDate.setDate(this.currentDate.getDate() - 7);
        else this.currentDate.setDate(this.currentDate.getDate() - 3);
        App.renderCurrentPage();
    },

    next() {
        if (this.viewMode === 'month') this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        else if (this.viewMode === 'week') this.currentDate.setDate(this.currentDate.getDate() + 7);
        else this.currentDate.setDate(this.currentDate.getDate() + 3);
        App.renderCurrentPage();
    },

    today() { this.currentDate = new Date(); App.renderCurrentPage(); },

    // ===== FORMS =====
    viewOrEdit(id) {
        const p = Store.getById('plans', id);
        if (!p) return;
        if (p.source === 'shcm') {
            const staff = Store.getAll('staff');
            const responsible = staff.find(s => s.id === p.responsible);
            const dateParts = p.date ? p.date.split('-') : null;
            const dateDisplay = dateParts ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : '—';
            const durDisplay = p.duration ? p.duration.replace('m', '') + ' phút' : '';
            Modal.open('🔬 Sinh hoạt Chuyên môn', `
                <div class="plans-modal-body">
                    <div><strong>Tiêu đề:</strong> ${p.title}</div>
                    <div><strong>Ngày:</strong> ${dateDisplay}  •  <strong>Giờ:</strong> ${p.time}${durDisplay ? '  •  <strong>Thời lượng:</strong> ' + durDisplay : ''}</div>
                    <div><strong>Phụ trách:</strong> ${responsible?.name || '—'}</div>
                    <div><strong>Địa điểm:</strong> ${p.location || '—'}</div>
                    ${p.note ? `<div><strong>Ghi chú:</strong> ${p.note}</div>` : ''}
                    <div class="plans-shcm-info-box">
                        ℹ️ Sự kiện này được tạo tự động từ <strong>Lịch SHCM</strong>. Để chỉnh sửa, vui lòng vào trang <a href="#" onclick="Modal.close();App.navigate('research')" class="plans-shcm-link">Nghiên cứu</a>.
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Đóng</button>
                </div>
            `);
            return;
        }
        if (Auth.getSession()?.isAdmin) {
            this.openForm(id);
        } else {
            const staff = Store.getAll('staff');
            const responsible = staff.find(s => s.id === p.responsible);
            const dp = p.date ? p.date.split('-') : null;
            const dd = dp ? `${dp[2]}/${dp[1]}/${dp[0]}` : '—';
            const du = p.duration && p.duration !== 'Cả ngày' ? p.duration.replace('m','') + ' phút' : (p.allDay ? 'Cả ngày' : '');
            const ep = p.endDate && p.endDate !== p.date ? (() => { const e = p.endDate.split('-'); return ` → ${e[2]}/${e[1]}/${e[0]}`; })() : '';
            Modal.open('Chi tiết kế hoạch', `
                <div class="plans-modal-body">
                    <div><strong>Tiêu đề:</strong> ${p.title}</div>
                    <div><strong>Ngày:</strong> ${dd}${ep}  •  <strong>Giờ:</strong> ${p.allDay ? 'Cả ngày' : p.time}${du ? '  •  <strong>Thời lượng:</strong> ' + du : ''}</div>
                    <div><strong>Loại:</strong> ${Utils.planTypeLabel(p.type)}</div>
                    <div><strong>Phụ trách:</strong> ${responsible?.name || '—'}</div>
                    <div><strong>Địa điểm:</strong> ${p.location || '—'}</div>
                    ${p.note ? `<div><strong>Ghi chú:</strong> ${p.note}</div>` : ''}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Đóng</button>
                </div>
            `);
        }
    },

    openForm(id, date) {
        if (!Auth.getSession()?.isAdmin) return;
        const p = id ? Store.getById('plans', id) : null;
        const staff = Store.getAll('staff');
        const defaultDate = p?.date || date || new Date().toISOString().split('T')[0];
        const defaultEndDate = p?.endDate || defaultDate;
        const isAllDay = p?.allDay || false;
        const endTime = p?.endTime || '';

        Modal.open(p ? 'Chỉnh sửa kế hoạch' : 'Thêm kế hoạch', `
            <form onsubmit="PlansPage.save(event, ${id||0})">
                <div class="form-group">
                    <label class="form-label">Tiêu đề</label>
                    <input class="form-input" name="title" value="${p?.title||''}" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Ngày bắt đầu</label>
                        <input class="form-input" type="date" name="date" value="${defaultDate}" required onchange="PlansPage._onStartDateChange()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Ngày kết thúc</label>
                        <input class="form-input" type="date" name="endDate" value="${defaultEndDate}">
                    </div>
                </div>
                <div class="form-row plans-time-row">
                    <div class="form-group" id="plan-time-group" style="${isAllDay ? 'opacity:0.4;pointer-events:none' : ''}">
                        <label class="form-label">Giờ bắt đầu</label>
                        <input class="form-input" type="time" name="time" value="${p?.time||'08:00'}" onchange="PlansPage._calcDuration()">
                    </div>
                    <div class="form-group" id="plan-endtime-group" style="${isAllDay ? 'opacity:0.4;pointer-events:none' : ''}">
                        <label class="form-label">Giờ kết thúc</label>
                        <input class="form-input" type="time" name="endTime" value="${endTime}" onchange="PlansPage._calcDuration()">
                    </div>
                    <div class="form-group plans-allday-group">
                        <label class="plans-allday-label">
                            <input type="checkbox" name="allDay" ${isAllDay ? 'checked' : ''} onchange="PlansPage._toggleAllDay(this.checked)" class="plans-allday-checkbox">
                            Cả ngày
                        </label>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Thời lượng</label>
                        <input class="form-input plans-duration-input" name="duration" id="plan-duration" value="${p?.duration||''}" readonly placeholder="Tự tính từ giờ">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Loại hoạt động</label>
                        <select class="form-select" name="type">
                            ${['meeting','consultation','training','conference','other'].map(t =>
                                `<option value="${t}" ${p?.type===t?'selected':''}>${Utils.planTypeLabel(t)}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Phụ trách</label>
                        <select class="form-select" name="responsible">
                            ${staff.map(s => `<option value="${s.id}" ${p?.responsible===s.id?'selected':''}>${s.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Địa điểm</label>
                        <input class="form-input" name="location" value="${p?.location||''}" placeholder="Phòng họp khoa">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Ghi chú</label>
                    <textarea class="form-textarea" name="note">${p?.note||''}</textarea>
                </div>
                <div class="modal-footer">
                    ${p ? `<button type="button" class="btn btn-danger" onclick="event.preventDefault();event.stopPropagation();PlansPage.deletePlan(${id})">Xoá</button>` : ''}
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">${p?'Cập nhật':'Thêm'}</button>
                </div>
            </form>
        `);
        if (isAllDay) this._toggleAllDay(true);
        else if (endTime) this._calcDuration();
    },

    _onStartDateChange() {
        const form = document.querySelector('#modal-overlay form');
        if (!form) return;
        const startVal = form.querySelector('[name="date"]')?.value;
        const endInput = form.querySelector('[name="endDate"]');
        if (endInput && startVal && (!endInput.value || endInput.value < startVal)) {
            endInput.value = startVal;
        }
    },

    _toggleAllDay(checked) {
        const tg = document.getElementById('plan-time-group');
        const eg = document.getElementById('plan-endtime-group');
        const dur = document.getElementById('plan-duration');
        const style = checked ? 'opacity:0.4;pointer-events:none' : '';
        if (tg) tg.style.cssText = style;
        if (eg) eg.style.cssText = style;
        if (dur) dur.value = checked ? 'Cả ngày' : '';
        if (!checked) this._calcDuration();
    },

    _calcDuration() {
        const form = document.querySelector('#modal-overlay form');
        if (!form) return;
        const st = form.querySelector('[name="time"]')?.value;
        const et = form.querySelector('[name="endTime"]')?.value;
        const dur = document.getElementById('plan-duration');
        if (!st || !et || !dur) return;
        const [sh, sm] = st.split(':').map(Number);
        const [eh, em] = et.split(':').map(Number);
        const mins = (eh * 60 + em) - (sh * 60 + sm);
        dur.value = mins > 0 ? mins + ' phút' : '';
    },

    save(e, id) {
        if (!Auth.getSession()?.isAdmin) return;
        e.preventDefault();
        const f = new FormData(e.target);
        const allDay = f.get('allDay') === 'on';
        const startTime = f.get('time') || '08:00';
        const endTime = f.get('endTime') || '';
        let duration = f.get('duration') || '';

        if (!allDay && startTime && endTime) {
            const [sh, sm] = startTime.split(':').map(Number);
            const [eh, em] = endTime.split(':').map(Number);
            const mins = (eh * 60 + em) - (sh * 60 + sm);
            if (mins > 0) duration = mins + ' phút';
        }
        if (allDay) duration = 'Cả ngày';

        const startDate = f.get('date');
        let endDate = f.get('endDate') || startDate;
        if (endDate < startDate) endDate = startDate;

        const data = {
            title: f.get('title'),
            date: startDate,
            endDate: endDate,
            time: allDay ? '00:00' : startTime,
            endTime: allDay ? '' : endTime,
            allDay: allDay,
            duration: duration,
            type: f.get('type'),
            responsible: parseInt(f.get('responsible')),
            location: f.get('location'),
            note: f.get('note')
        };

        if (id) Store.update('plans', id, data);
        else Store.add('plans', data);
        Modal.close();
        App.renderCurrentPage();
    },

    deletePlan(id) {
        if (!Auth.getSession()?.isAdmin) return;
        Store.remove('plans', id);
        Modal.close();
        App.renderCurrentPage();
    },

    afterRender() {}
};
