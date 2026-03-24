// ===== PLANS (CALENDAR) PAGE =====
const PlansPage = {
    currentDate: new Date(),
    viewMode: 'month', // 'month', 'week', '3day'

    render() {
        const isAdmin = Auth.getSession()?.isAdmin;
        const viewLabel = { month: 'Tháng', week: 'Tuần', '3day': '3 ngày' }[this.viewMode];

        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Kế hoạch hoạt động</h1>
                <p class="page-subtitle">Lịch hoạt động khoa — ${this.getHeaderLabel()}</p>
            </div>
            ${isAdmin ? `<button class="btn btn-primary" onclick="PlansPage.openForm()">
                ${Utils.plusIcon()} Thêm kế hoạch
            </button>` : ''}
        </div>

        <div class="calendar-controls">
            <div class="calendar-nav">
                <button class="btn-icon" onclick="PlansPage.prev()">${Utils.chevronLeft()}</button>
                <span class="calendar-month-label">${this.getNavLabel()}</span>
                <button class="btn-icon" onclick="PlansPage.next()">${Utils.chevronRight()}</button>
                <button class="btn btn-secondary btn-sm" onclick="PlansPage.today()">Hôm nay</button>
            </div>
            <div class="calendar-view-modes">
                <button class="view-mode-btn ${this.viewMode==='month'?'active':''}" onclick="PlansPage.setView('month')">Tháng</button>
                <button class="view-mode-btn ${this.viewMode==='week'?'active':''}" onclick="PlansPage.setView('week')">Tuần</button>
                <button class="view-mode-btn ${this.viewMode==='3day'?'active':''}" onclick="PlansPage.setView('3day')">3 ngày</button>
            </div>
        </div>

        ${this.viewMode === 'month' ? this.renderMonth(isAdmin) : this.renderDayColumns(isAdmin)}
        `;
    },

    getHeaderLabel() {
        return this.currentDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
    },

    getNavLabel() {
        if (this.viewMode === 'month') {
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
        const plans = Store.getPlansByMonth(year, month)
            .sort((a, b) => a.time.localeCompare(b.time));

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
            const dayPlans = plans.filter(p => p.date === dateStr);

            html += `<div class="calendar-day ${isToday?'today':''}" ${isAdmin ? `onclick="PlansPage.openForm(null,'${dateStr}')"` : ''}>
                <span class="day-number">${d}</span>
                ${dayPlans.map(p => `
                    <div class="calendar-event ${p.type}" onclick="event.stopPropagation();PlansPage.viewOrEdit(${p.id})" title="${p.title} — ${p.time}${p.duration ? ' ('+p.duration+')' : ''}">
                        ${p.time} ${p.title}
                    </div>
                `).join('')}
            </div>`;
        }

        const totalCells = firstDay + daysInMonth;
        const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let i = 1; i <= remaining; i++) {
            html += `<div class="calendar-day other-month"><span class="day-number">${i}</span></div>`;
        }

        return html;
    },

    // ===== WEEK / 3-DAY VIEW =====
    renderDayColumns(isAdmin) {
        const dates = this.getViewDates();
        const today = new Date();
        today.setHours(0,0,0,0);
        const allPlans = Store.getAll('plans').sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
        });

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
                    const dayPlans = allPlans.filter(p => p.date === dateStr);
                    const isToday = d.getTime() === today.getTime();

                    return `<div class="cal-day-col ${isToday ? 'today-col' : ''}" ${isAdmin ? `onclick="PlansPage.openForm(null,'${dateStr}')"` : ''}>
                        ${hours.map(h => `<div class="cal-hour-cell"></div>`).join('')}
                        ${dayPlans.map(p => {
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
        if (!dur) return 0;
        // Format: "1h30", "2h", "30m", "1h 30m", etc.
        let mins = 0;
        const hMatch = dur.match(/(\d+)\s*h/i);
        const mMatch = dur.match(/(\d+)\s*m/i);
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
        if (this.viewMode === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        } else if (this.viewMode === 'week') {
            this.currentDate.setDate(this.currentDate.getDate() - 7);
        } else {
            this.currentDate.setDate(this.currentDate.getDate() - 3);
        }
        App.renderCurrentPage();
    },

    next() {
        if (this.viewMode === 'month') {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        } else if (this.viewMode === 'week') {
            this.currentDate.setDate(this.currentDate.getDate() + 7);
        } else {
            this.currentDate.setDate(this.currentDate.getDate() + 3);
        }
        App.renderCurrentPage();
    },

    today() {
        this.currentDate = new Date();
        App.renderCurrentPage();
    },

    // ===== FORMS =====
    viewOrEdit(id) {
        if (Auth.getSession()?.isAdmin) {
            this.openForm(id);
        } else {
            const p = Store.getById('plans', id);
            if (!p) return;
            const staff = Store.getAll('staff');
            const responsible = staff.find(s => s.id === p.responsible);
            Modal.open('Chi tiết kế hoạch', `
                <div style="display:flex;flex-direction:column;gap:12px">
                    <div><strong>Tiêu đề:</strong> ${p.title}</div>
                    <div><strong>Ngày:</strong> ${p.date}  •  <strong>Giờ:</strong> ${p.time}${p.duration ? '  •  <strong>Thời lượng:</strong> ' + p.duration : ''}</div>
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

        Modal.open(p ? 'Chỉnh sửa kế hoạch' : 'Thêm kế hoạch', `
            <form onsubmit="PlansPage.save(event, ${id||0})">
                <div class="form-group">
                    <label class="form-label">Tiêu đề</label>
                    <input class="form-input" name="title" value="${p?.title||''}" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Ngày</label>
                        <input class="form-input" type="date" name="date" value="${defaultDate}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Giờ bắt đầu</label>
                        <input class="form-input" type="time" name="time" value="${p?.time||'08:00'}" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Thời lượng dự kiến</label>
                        <input class="form-input" name="duration" value="${p?.duration||''}" placeholder="VD: 1h30, 2h, 45m">
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
    },

    save(e, id) {
        if (!Auth.getSession()?.isAdmin) return;
        e.preventDefault();
        const f = new FormData(e.target);
        const data = {
            title: f.get('title'),
            date: f.get('date'),
            time: f.get('time'),
            duration: f.get('duration'),
            type: f.get('type'),
            responsible: parseInt(f.get('responsible')),
            location: f.get('location'),
            note: f.get('note')
        };
        if (id) Store.update('plans', id, data); else Store.add('plans', data);
        Modal.close(); App.renderCurrentPage();
    },

    deletePlan(id) {
        if (!Auth.getSession()?.isAdmin) return;
        Store.remove('plans', id);
        Modal.close();
        App.renderCurrentPage();
    },

    afterRender() {}
};
