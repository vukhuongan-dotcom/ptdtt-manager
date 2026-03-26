// ===== WEEKLY SCHEDULE PAGE =====
const SCHEDULE_POSITIONS = [
    { key: 'trucKhoa', label: 'Trực khoa', slots: 4, staffFilter: 'bs', color: '#06b6d4' },
    { key: 'sieuAm', label: 'Siêu âm', slots: 1, staffFilter: 'bs', color: '#8b5cf6' },
    { key: 'pkB023', label: 'P. Khám B023', slots: 1, staffFilter: 'bs', color: '#f59e0b' },
    { key: 'pkB020', label: 'P. Khám B020', slots: 2, slotLabels: ['Sáng', 'Chiều'], staffFilter: 'bs', color: '#ec4899' },
    { key: 'mo', label: 'Mổ', slots: 8, staffFilter: 'bs', color: '#ef4444' },
    { key: 'trucBCN', label: 'Trực BCN khoa', slots: 1, staffFilter: 'bcn', color: '#14b8a6' },
    { key: 'trucBV', label: 'Trực BV', slots: 3, staffFilter: 'bs', color: '#3b82f6' },
    { key: 'trucDD', label: 'Trực Đ.D', slots: 2, staffFilter: 'dd', color: '#f97316' },
];

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const SchedulePage = {
    weekOffset: 0,

    // Timezone-safe YYYY-MM-DD formatter (avoids UTC shift from toISOString)
    _localDateStr(d) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    },

    getWeekDates(offset) {
        const now = new Date();
        const day = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + (offset * 7));
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            dates.push(d);
        }
        return dates;
    },

    getWeekKey(dates) {
        return this._localDateStr(dates[0]);
    },

    getScheduleData(weekKey) {
        const all = Store.getAll('schedules');
        return all.find(s => s.weekKey === weekKey) || null;
    },

    getStaffOptions(filterType) {
        const staff = Store.getAll('staff');
        switch (filterType) {
            case 'bs':
                return staff.filter(s =>
                    s.role.includes('Bác sĩ') || s.role.includes('Trưởng khoa') || s.role.includes('Phó trưởng khoa')
                );
            case 'bcn':
                return staff.filter(s =>
                    s.role.includes('Trưởng khoa') || s.role.includes('Phó trưởng khoa') || s.role === 'Điều dưỡng trưởng'
                );
            case 'dd':
                return staff.filter(s =>
                    s.role.includes('Điều dưỡng') || s.role === 'Điều dưỡng trưởng'
                );
            default:
                return staff;
        }
    },

    // Build short name map: detects duplicates and adds middle-name prefix
    _shortNameCache: null,
    // Custom short names for specific staff
    _customShortNames: { 2: 'An', 5: 'BHM.Hậu', 9: 'M.Đức', 10: 'N.Đức', 23: 'LM.Hậu', 27: 'C.Tiên', 29: 'T.Tiên' },
    _buildShortNames() {
        const staff = Store.getAll('staff');
        const lastNames = {};
        staff.forEach(s => {
            const parts = s.name.trim().split(/\s+/);
            const last = parts[parts.length - 1];
            if (!lastNames[last]) lastNames[last] = [];
            lastNames[last].push(s);
        });
        const map = {};
        Object.entries(lastNames).forEach(([last, people]) => {
            if (people.length === 1) {
                map[people[0].id] = last;
            } else {
                people.forEach(s => {
                    // Use custom name if defined
                    if (this._customShortNames[s.id]) {
                        map[s.id] = this._customShortNames[s.id];
                    } else {
                        const parts = s.name.trim().split(/\s+/);
                        if (parts.length >= 3) {
                            const mid = parts[parts.length - 2];
                            map[s.id] = `${mid.charAt(0)}. ${last}`;
                        } else if (parts.length === 2) {
                            map[s.id] = `${parts[0].charAt(0)}. ${last}`;
                        } else {
                            map[s.id] = last;
                        }
                    }
                });
            }
        });
        this._shortNameCache = map;
    },

    getShortName(staffId) {
        if (!this._shortNameCache) this._buildShortNames();
        return this._shortNameCache[staffId] || '';
    },

    render() {
        const isAdmin = Auth.getSession()?.isAdmin;
        const dates = this.getWeekDates(this.weekOffset);
        const weekKey = this.getWeekKey(dates);
        const schedule = this.getScheduleData(weekKey);
        const today = this._localDateStr(new Date());

        const startStr = dates[0].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const endStr = dates[6].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Lịch phân công tuần</h1>
                <p class="page-subtitle">Khoa Phẫu thuật Đại trực tràng — ${startStr} – ${endStr}</p>
            </div>
            <div class="flex items-center gap-8">
                <button class="btn btn-secondary" onclick="SchedulePage.exportPDF()" id="export-pdf-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
                    Xuất ảnh
                </button>
                ${isAdmin ? `<button class="btn btn-secondary" onclick="SchedulePage.copyFromPrevWeek()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Sao chép tuần trước
                </button>
                <button class="btn btn-primary" onclick="SchedulePage.saveSchedule()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Lưu lịch
                </button>` : ''}
            </div>
        </div>

        <div class="schedule-nav">
            <button class="btn-icon" onclick="SchedulePage.prevWeek()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="schedule-week-label">${startStr} — ${endStr}</span>
            <button class="btn-icon" onclick="SchedulePage.nextWeek()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="SchedulePage.thisWeek()">Tuần này</button>
        </div>

        <div class="schedule-table-wrap">
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th class="schedule-pos-header">Vị trí</th>
                        ${dates.map((d, i) => {
                            const dateStr = SchedulePage._localDateStr(d);
                            const isToday = dateStr === today;
                            const dayNum = d.getDate();
                            return `<th class="schedule-day-header ${isToday ? 'today' : ''} ${i >= 5 ? 'weekend' : ''}">
                                <span class="schedule-day-name">${DAY_LABELS[i]}</span>
                                <span class="schedule-day-date">${dayNum}/${d.getMonth()+1}</span>
                            </th>`;
                        }).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${SCHEDULE_POSITIONS.map(pos => this.renderPositionRow(pos, dates, schedule, isAdmin)).join('')}
                </tbody>
            </table>
        </div>

        ${this.renderRobotSection(schedule, dates, isAdmin)}

        <div class="schedule-notes card" style="margin-top:20px">
            <h3 style="font-size:0.95rem;margin-bottom:8px;color:var(--primary-light)">📝 Ghi chú</h3>
            ${isAdmin
                ? `<textarea class="form-textarea" id="schedule-notes" placeholder="Ghi chú tuần này..." style="min-height:60px">${schedule?.notes || ''}</textarea>`
                : `<p style="color:var(--text-muted);font-size:0.85rem">${schedule?.notes || 'Không có ghi chú'}</p>`
            }
        </div>
        `;
    },

    renderPositionRow(pos, dates, schedule, isAdmin) {
        const staffOptions = this.getStaffOptions(pos.staffFilter);
        const data = schedule?.positions?.[pos.key] || {};

        let rows = '';
        for (let slot = 0; slot < pos.slots; slot++) {
            rows += `<tr class="${slot === 0 ? 'schedule-pos-first' : 'schedule-pos-sub'}" data-group="${pos.key}">`;

            // Position label (only on first slot, rowspan)
            if (slot === 0) {
                rows += `<td class="schedule-pos-label" rowspan="${pos.slots}" style="border-left:3px solid ${pos.color}">
                    <span class="schedule-pos-name">${pos.label}</span>
                    ${pos.slotLabels ? '' : (pos.slots > 1 ? `<span class="schedule-pos-slots">${pos.slots} vị trí</span>` : '')}
                </td>`;
            }

            // Each day
            const isLeadSlot = slot === 0 && (pos.key === 'trucKhoa' || pos.key === 'mo');
            dates.forEach((d, dayIdx) => {
                const cellKey = `${DAYS[dayIdx]}_${slot}`;
                const val = data[cellKey] || '';
                const slotLabel = pos.slotLabels ? pos.slotLabels[slot] : '';
                const leadClass = isLeadSlot ? ' schedule-lead-slot' : '';

                if (isAdmin) {
                    rows += `<td class="schedule-cell ${dayIdx >= 5 ? 'weekend' : ''}${leadClass}">
                        ${slotLabel ? `<span class="schedule-slot-label">${slotLabel}</span>` : ''}
                        <select class="schedule-select" data-pos="${pos.key}" data-cell="${cellKey}" onchange="SchedulePage.onCellChange(this)">
                            <option value="">—</option>
                            ${staffOptions.map(s => `<option value="${s.id}" ${val == s.id ? 'selected' : ''}>${this.getShortName(s.id)}</option>`).join('')}
                        </select>
                    </td>`;
                } else {
                    const name = val ? this.getShortName(parseInt(val)) : '—';
                    rows += `<td class="schedule-cell ${dayIdx >= 5 ? 'weekend' : ''} readonly${leadClass}">
                        ${slotLabel ? `<span class="schedule-slot-label">${slotLabel}</span>` : ''}
                        <span class="schedule-name">${name}</span>
                    </td>`;
                }
            });

            rows += '</tr>';
        }
        return rows;
    },

    onCellChange(el) {
        // Visual feedback
        if (el.value) {
            el.classList.add('has-value');
        } else {
            el.classList.remove('has-value');
        }
    },

    saveSchedule() {
        if (!Auth.getSession()?.isAdmin) return;

        const dates = this.getWeekDates(this.weekOffset);
        const weekKey = this.getWeekKey(dates);
        const positions = {};

        // Collect all select values
        document.querySelectorAll('.schedule-select').forEach(sel => {
            const pos = sel.dataset.pos;
            const cell = sel.dataset.cell;
            if (!positions[pos]) positions[pos] = {};
            if (sel.value) positions[pos][cell] = parseInt(sel.value);
        });

        const notes = document.getElementById('schedule-notes')?.value || '';
        const robotSurgery = this._collectRobotData();

        // Save or update
        const all = Store.getAll('schedules');
        const existing = all.findIndex(s => s.weekKey === weekKey);

        if (existing >= 0) {
            Store.update('schedules', all[existing].id, { positions, notes, robotSurgery });
        } else {
            Store.add('schedules', {
                weekKey,
                startDate: this._localDateStr(dates[0]),
                endDate: this._localDateStr(dates[6]),
                positions,
                robotSurgery,
                notes
            });
        }

        // Show saved feedback
        const btn = document.querySelector('.page-header .btn-primary');
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '✓ Đã lưu!';
            btn.style.background = 'var(--success)';
            setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 1500);
        }
    },

    prevWeek() { this.weekOffset--; App.renderCurrentPage(); },
    nextWeek() { this.weekOffset++; App.renderCurrentPage(); },
    thisWeek() { this.weekOffset = 0; App.renderCurrentPage(); },

    // ===== ROBOT SURGERY SECTION =====
    renderRobotSection(schedule, dates, isAdmin) {
        const robotEntries = schedule?.robotSurgery || [];
        const bsOptions = this.getStaffOptions('bs');

        return `
        <div class="card robot-surgery-card" style="margin-top:20px">
            <div class="flex justify-between items-center" style="margin-bottom:12px">
                <h3 style="font-size:0.95rem;color:var(--accent-light)">🤖 Lịch phụ mổ Robot</h3>
                ${isAdmin ? `<button class="btn btn-secondary btn-sm" onclick="SchedulePage.addRobotEntry()">
                    ${Utils.plusIcon()} Thêm ca
                </button>` : ''}
            </div>
            <table class="schedule-table robot-table">
                <thead>
                    <tr>
                        <th style="width:160px">Ngày mổ</th>
                        <th style="width:80px">Ca</th>
                        <th>BS phụ 1</th>
                        <th>BS phụ 2</th>
                        <th>BS phụ 3</th>
                        ${isAdmin ? '<th style="width:50px"></th>' : ''}
                    </tr>
                </thead>
                <tbody id="robot-tbody">
                    ${robotEntries.length ? robotEntries.map((entry, idx) => {
                        if (isAdmin) {
                            return `<tr>
                                <td>
                                    <select class="schedule-select has-value" data-robot="day" data-idx="${idx}">
                                        ${dates.map((d, i) => {
                                            const dStr = SchedulePage._localDateStr(d);
                                            const label = `${DAY_LABELS[i]}, ${d.getDate()}/${d.getMonth()+1}`;
                                            return `<option value="${dStr}" ${entry.day === dStr ? 'selected' : ''}>${label}</option>`;
                                        }).join('')}
                                    </select>
                                </td>
                                <td>
                                    <select class="schedule-select has-value" data-robot="session" data-idx="${idx}">
                                        <option value="1" ${entry.session==1?'selected':''}>Ca 1</option>
                                        <option value="2" ${entry.session==2?'selected':''}>Ca 2</option>
                                        <option value="3" ${entry.session==3?'selected':''}>Ca 3</option>
                                    </select>
                                </td>
                                ${[0,1,2].map(slot => `<td>
                                    <select class="schedule-select ${entry.doctors?.[slot] ? 'has-value' : ''}" data-robot="doc${slot}" data-idx="${idx}" onchange="SchedulePage.onCellChange(this)">
                                        <option value="">—</option>
                                        ${bsOptions.map(s => `<option value="${s.id}" ${entry.doctors?.[slot]==s.id?'selected':''}>${this.getShortName(s.id)}</option>`).join('')}
                                    </select>
                                </td>`).join('')}
                                <td><button class="btn-icon" onclick="SchedulePage.removeRobotEntry(${idx})" title="Xoá">${Utils.deleteIcon()}</button></td>
                            </tr>`;
                        } else {
                            const dayDate = new Date(entry.day);
                            const dayLabel = DAY_LABELS[dates.findIndex(d => SchedulePage._localDateStr(d) === entry.day)] || entry.day;
                            const dayNum = dayDate.getDate();
                            const dayMonth = dayDate.getMonth() + 1;
                            return `<tr>
                                <td>${dayLabel}, ${dayNum}/${dayMonth}</td>
                                <td>Ca ${entry.session}</td>
                                ${[0,1,2].map(slot => `<td>${entry.doctors?.[slot] ? this.getShortName(entry.doctors[slot]) : '—'}</td>`).join('')}
                            </tr>`;
                        }
                    }).join('') : `<tr><td colspan="${isAdmin ? 6 : 5}" style="text-align:center;color:var(--text-muted);padding:20px">Chưa có lịch mổ Robot tuần này</td></tr>`}
                </tbody>
            </table>
        </div>`;
    },

    addRobotEntry() {
        if (!Auth.getSession()?.isAdmin) return;
        const dates = this.getWeekDates(this.weekOffset);
        const weekKey = this.getWeekKey(dates);
        const schedule = this.getScheduleData(weekKey);

        const robotSurgery = schedule?.robotSurgery ? [...schedule.robotSurgery] : [];
        robotSurgery.push({
            day: this._localDateStr(dates[0]),
            session: 1,
            doctors: [null, null, null]
        });

        this._saveRobotToSchedule(weekKey, dates, robotSurgery);
        App.renderCurrentPage();
    },

    removeRobotEntry(idx) {
        if (!Auth.getSession()?.isAdmin) return;
        const dates = this.getWeekDates(this.weekOffset);
        const weekKey = this.getWeekKey(dates);
        const schedule = this.getScheduleData(weekKey);
        if (!schedule?.robotSurgery) return;

        const robotSurgery = [...schedule.robotSurgery];
        robotSurgery.splice(idx, 1);

        this._saveRobotToSchedule(weekKey, dates, robotSurgery);
        App.renderCurrentPage();
    },

    _saveRobotToSchedule(weekKey, dates, robotSurgery) {
        const all = Store.getAll('schedules');
        const existing = all.findIndex(s => s.weekKey === weekKey);
        if (existing >= 0) {
            Store.update('schedules', all[existing].id, { robotSurgery });
        } else {
            Store.add('schedules', {
                weekKey,
                startDate: this._localDateStr(dates[0]),
                endDate: this._localDateStr(dates[6]),
                positions: {},
                robotSurgery,
                notes: ''
            });
        }
    },

    _collectRobotData() {
        const entries = [];
        const rows = document.querySelectorAll('#robot-tbody tr');
        rows.forEach((row, idx) => {
            const dayEl = row.querySelector('[data-robot="day"]');
            const sessionEl = row.querySelector('[data-robot="session"]');
            if (!dayEl || !sessionEl) return;
            entries.push({
                day: dayEl.value,
                session: parseInt(sessionEl.value),
                doctors: [0,1,2].map(slot => {
                    const el = row.querySelector(`[data-robot="doc${slot}"]`);
                    return el && el.value ? parseInt(el.value) : null;
                })
            });
        });
        return entries;
    },

    copyFromPrevWeek() {
        const session = Auth.getSession();
        if (!session || !session.isAdmin) {
            alert('Bạn cần quyền admin để sử dụng chức năng này.');
            return;
        }

        const prevDates = this.getWeekDates(this.weekOffset - 1);
        const prevKey = this.getWeekKey(prevDates);
        const allSchedules = Store.getAll('schedules');
        const prevSchedule = allSchedules.find(s => s.weekKey === prevKey);

        if (!prevSchedule || !prevSchedule.positions) {
            const prevStart = prevDates[0].toLocaleDateString('vi-VN');
            const prevEnd = prevDates[6].toLocaleDateString('vi-VN');
            alert(`Không có dữ liệu lịch tuần trước (${prevStart} – ${prevEnd}) để sao chép.`);
            return;
        }

        // Copy data directly in store
        const dates = this.getWeekDates(this.weekOffset);
        const weekKey = this.getWeekKey(dates);
        const copiedPositions = JSON.parse(JSON.stringify(prevSchedule.positions));
        const copiedNotes = prevSchedule.notes || '';
        const copiedRobot = prevSchedule.robotSurgery ? JSON.parse(JSON.stringify(prevSchedule.robotSurgery)) : [];

        const existing = allSchedules.findIndex(s => s.weekKey === weekKey);

        if (existing >= 0) {
            Store.update('schedules', allSchedules[existing].id, { positions: copiedPositions, notes: copiedNotes, robotSurgery: copiedRobot });
        } else {
            Store.add('schedules', {
                weekKey,
                startDate: this._localDateStr(dates[0]),
                endDate: this._localDateStr(dates[6]),
                positions: copiedPositions,
                robotSurgery: copiedRobot,
                notes: copiedNotes
            });
        }

        // Re-render to show copied data
        App.renderCurrentPage();
    },

    afterRender() {
        // Reset name cache (staff may have changed)
        this._shortNameCache = null;
        // Mark selects that have values
        document.querySelectorAll('.schedule-select').forEach(sel => {
            if (sel.value) sel.classList.add('has-value');
        });
    },

    // ===== PDF EXPORT =====
    async exportPDF() {
        const btn = document.getElementById('export-pdf-btn');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang xuất...'; }

        // Temporarily disable confirm/alert to prevent html2canvas triggering dialogs
        const origConfirm = window.confirm;
        const origAlert = window.alert;
        window.confirm = () => false;

        try {
            const dates = this.getWeekDates(this.weekOffset);
            const weekKey = this.getWeekKey(dates);
            const schedule = this.getScheduleData(weekKey);
            const staff = Store.getAll('staff');

            // Build standalone HTML page for iframe rendering
            const tableRows = [];
            SCHEDULE_POSITIONS.forEach(pos => {
                for (let slot = 0; slot < pos.slots; slot++) {
                    let row = '<tr>';
                    if (slot === 0) {
                        row += `<td rowspan="${pos.slots}" style="border:1.5px solid #94a3b8;padding:8px 10px;background:${pos.color}15;font-weight:700;color:${pos.color};vertical-align:middle;font-size:12px">${pos.label}</td>`;
                    }
                    dates.forEach((d, dayIdx) => {
                        const dayKey = DAYS[dayIdx];
                        const cellKey = `${dayKey}_${slot}`;
                        const staffId = schedule?.positions?.[pos.key]?.[cellKey];
                        let name = '';
                        if (staffId) {
                            const member = staff.find(s => s.id === parseInt(staffId));
                            if (member) name = this.getShortName(member.id) || member.name.split(' ').pop();
                        }
                        const bg = dayIdx >= 5 ? '#fffbeb' : '#fff';
                        row += `<td style="border:1px solid #cbd5e1;padding:6px 8px;text-align:center;background:${bg};font-size:12px;color:#334155">${name}</td>`;
                    });
                    row += '</tr>';
                    tableRows.push(row);
                }
            });

            const notes = schedule?.notes || '';
            const dateRange = `${dates[0].toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'})} – ${dates[6].toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'})}`;

            const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
            <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff;font-family:Arial,Helvetica,sans-serif}</style>
            </head><body>
            <div id="capture" style="padding:28px;width:1120px;background:#fff">
                <div style="text-align:center;margin-bottom:18px">
                    <h2 style="font-size:20px;color:#1e293b">LỊCH PHÂN CÔNG TUẦN</h2>
                    <p style="margin:6px 0 0;font-size:14px;color:#64748b">Khoa Phẫu thuật Đại trực tràng — BV Bình Dân</p>
                    <p style="margin:3px 0 0;font-size:14px;color:#334155;font-weight:600">${dateRange}</p>
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:12px">
                    <thead><tr>
                        <th style="border:1.5px solid #94a3b8;background:#1e293b;color:#fff;padding:10px 8px;text-align:left;width:120px">Vị trí</th>
                        ${dates.map((d, i) => `<th style="border:1.5px solid #94a3b8;background:${i >= 5 ? '#fef3c7' : '#e2e8f0'};padding:10px 6px;text-align:center">
                            <div style="font-weight:700;font-size:12px;color:#1e293b">${DAY_LABELS[i]}</div>
                            <div style="color:#64748b;font-size:12px">${d.getDate()}/${d.getMonth()+1}</div>
                        </th>`).join('')}
                    </tr></thead>
                    <tbody>
                        ${tableRows.join('')}
                        <tr><td colspan="8" style="border:1.5px solid #94a3b8;padding:10px;font-size:11px;color:#64748b"><strong>Ghi chú:</strong> ${notes || '—'}</td></tr>
                    </tbody>
                </table>
                <p style="text-align:right;font-size:10px;color:#94a3b8;margin-top:14px">Xuất từ hệ thống quản lý Khoa PT ĐTT — ${new Date().toLocaleDateString('vi-VN')}</p>
            </div></body></html>`;

            // Render in isolated iframe (prevents interaction with live DOM)
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1200px;height:900px;border:none;opacity:0;pointer-events:none';
            document.body.appendChild(iframe);

            await new Promise((resolve) => {
                iframe.onload = resolve;
                iframe.srcdoc = fullHtml;
            });

            // Wait for fonts/styles to settle
            await new Promise(r => setTimeout(r, 500));

            const captureEl = iframe.contentDocument.getElementById('capture');
            const canvas = await html2canvas(captureEl, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
            });

            document.body.removeChild(iframe);

            // Build filename
            const pad = n => String(n).padStart(2, '0');
            const d0 = dates[0], d6 = dates[6];
            const startFmt = `${pad(d0.getDate())}-${pad(d0.getMonth()+1)}`;
            const endFmt = `${pad(d6.getDate())}-${pad(d6.getMonth()+1)}-${d6.getFullYear()}`;
            const filename = `Phan_cong_tuan_${startFmt}_${endFmt}.jpg`;

            // Download via server for correct filename on all browsers
            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
            const resp = await fetch('/api/download-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: dataUrl, filename })
            });

            if (resp.ok) {
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
            } else {
                throw new Error('Server download failed: ' + resp.status);
            }

        } catch (err) {
            console.error('Export error:', err);
            window.alert = origAlert;
            alert('Lỗi khi xuất ảnh. Vui lòng thử lại.');
        } finally {
            window.confirm = origConfirm;
            window.alert = origAlert;
            if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg> Xuất ảnh`; }
        }
    }
};
