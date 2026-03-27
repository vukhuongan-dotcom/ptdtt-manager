// ===== SURGERY SCHEDULE PAGE =====
const SURGERY_TYPES = {
    'chuongtrinh': { label: 'Chương trình', color: '#3b82f6' },
    'yeucau':      { label: 'Yêu cầu', color: '#f59e0b' },
    'bankhan':     { label: 'Bán khẩn', color: '#ef4444' },
    'robot':       { label: 'Robot', color: '#1e3a5f' }
};

// Check if current user is a doctor (can edit surgery schedule)
function canEditSurgery() {
    const session = Auth.getSession();
    if (!session) return false;
    if (session.isAdmin) return true;
    const role = session.role || '';
    return role.includes('Bác sĩ') || role.includes('Trưởng khoa') || role.includes('Phó trưởng khoa');
}

const SurgeryPage = {
    currentWeekStart: null,

    init() {
        const today = new Date();
        const day = today.getDay();
        this.currentWeekStart = new Date(today);
        this.currentWeekStart.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
        this.currentWeekStart.setHours(0,0,0,0);
    },

    getWeekDates() {
        if (!this.currentWeekStart) this.init();
        return Array.from({length: 7}, (_, i) => {
            const d = new Date(this.currentWeekStart);
            d.setDate(this.currentWeekStart.getDate() + i);
            return d;
        });
    },

    getWeekKey() {
        if (!this.currentWeekStart) this.init();
        const d = this.currentWeekStart;
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    },

    dateStr(d) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    },

    fmtDate(d) {
        const days = ['CN','T2','T3','T4','T5','T6','T7'];
        return `${days[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`;
    },

    getSurgeries() {
        const all = this.getAllSurgeries();
        const weekDates = this.getWeekDates().map(d => this.dateStr(d));
        return all.filter(s => weekDates.includes(s.date));
    },

    getAllSurgeries() {
        // Migration: move old localStorage data into Store (one-time)
        const legacy = localStorage.getItem('ptdtt_surgeries');
        if (legacy) {
            const items = JSON.parse(legacy);
            if (items.length > 0 && (!Store._data.surgeries || Store._data.surgeries.length === 0)) {
                Store._data.surgeries = items;
                Store.save();
            }
            localStorage.removeItem('ptdtt_surgeries');
        }
        return Store._data.surgeries || [];
    },

    saveSurgeries(all) {
        Store._data.surgeries = all;
        Store.save();
    },

    render() {
        if (!this.currentWeekStart) this.init();
        const isAdmin = canEditSurgery();
        const weekDates = this.getWeekDates();
        const surgeries = this.getSurgeries();
        const today = new Date();
        today.setHours(0,0,0,0);

        const weekLabel = `${weekDates[0].getDate()}/${weekDates[0].getMonth()+1} — ${weekDates[6].getDate()}/${weekDates[6].getMonth()+1}/${weekDates[6].getFullYear()}`;

        // Stats
        const totalCases = surgeries.length;
        const todayCases = surgeries.filter(s => s.date === this.dateStr(today)).length;

        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Lịch mổ tuần</h1>
                <p class="page-subtitle">Lịch phẫu thuật khoa PT Đại trực tràng</p>
            </div>
            <div style="display:flex;gap:8px">
                <button class="btn btn-secondary" onclick="SurgeryPage.exportTodayImage()">
                    📷 Xuất DS hôm nay
                </button>
                ${isAdmin ? `<button class="btn btn-primary" onclick="SurgeryPage.openForm()">
                    ${Utils.plusIcon()} Thêm ca mổ
                </button>` : ''}
            </div>
        </div>

        <div class="surgery-controls">
            <div class="calendar-nav">
                <button class="btn-icon" onclick="SurgeryPage.prevWeek()">${Utils.chevronLeft()}</button>
                <span class="calendar-month-label">${weekLabel}</span>
                <button class="btn-icon" onclick="SurgeryPage.nextWeek()">${Utils.chevronRight()}</button>
                <button class="btn btn-secondary btn-sm" onclick="SurgeryPage.thisWeek()">Tuần này</button>
            </div>
            <div class="surgery-stats">
                <span class="surgery-stat-chip">📅 ${todayCases} ca hôm nay</span>
                <button class="btn btn-secondary btn-sm" onclick="SurgeryPage.toggleAllCards()" id="surgery-toggle-btn" title="Thu gọn / Mở rộng tất cả">
                    <span id="surgery-toggle-icon">📂</span> <span id="surgery-toggle-text">Mở rộng</span>
                </button>
            </div>
        </div>

        <div class="surgery-summary-panel">
            <div class="surgery-summary-chips">
                ${Object.entries(SURGERY_TYPES).map(([key, t]) => {
                    const cnt = surgeries.filter(s => s.surgeryType === key).length;
                    return `<div class="surgery-summary-chip">
                        <span class="surgery-summary-dot" style="background:${t.color}"></span>
                        <span class="surgery-summary-label">${t.label}</span>
                        <span class="surgery-summary-count">${cnt}</span>
                    </div>`;
                }).join('')}
                <div class="surgery-summary-chip surgery-summary-total">
                    <span class="surgery-summary-label"><strong>Tổng tuần</strong></span>
                    <span class="surgery-summary-count"><strong>${totalCases}</strong></span>
                </div>
            </div>
        </div>

        <div class="surgery-week-grid">
            ${weekDates.map(d => {
                const ds = this.dateStr(d);
                const isToday = d.getTime() === today.getTime();
                const _typePriority = { robot: 0, bankhan: 1, chuongtrinh: 2, yeucau: 3 };
                const daySurgeries = surgeries.filter(s => s.date === ds)
                    .sort((a, b) => (_typePriority[a.surgeryType] ?? 9) - (_typePriority[b.surgeryType] ?? 9));

                return `
                <div class="surgery-day ${isToday ? 'today' : ''} ${d.getDay() === 0 || d.getDay() === 6 ? 'weekend' : ''}">
                    <div class="surgery-day-header">
                        <span class="surgery-day-name">${this.fmtDate(d)}</span>
                        <span class="surgery-day-count">${daySurgeries.length} ca</span>
                    </div>
                    <div class="surgery-day-body">
                        ${daySurgeries.length ? daySurgeries.map((s, idx) => {
                            const typeInfo = SURGERY_TYPES[s.surgeryType] || SURGERY_TYPES.chuongtrinh;
                            return `
                            <div class="surgery-card surgery-compact" data-surgery-id="${s.id}" onclick="SurgeryPage.toggleCard(this, event)">
                                <div class="surgery-card-compact-row">
                                    <span class="surgery-card-order">${idx + 1}</span>
                                    <span class="surgery-type-dot" style="background:${typeInfo.color}" title="${typeInfo.label}"></span>
                                    <span class="surgery-card-compact-name">${s.patientName}</span>
                                    <span class="surgery-card-yob">${s.birthYear || ''}</span>
                                </div>
                                <div class="surgery-card-detail">
                                    <div class="surgery-card-type-tag" style="background:${typeInfo.color}">${typeInfo.label}</div>
                                    ${s.duration ? `<div style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:4px">⏱ ${s.duration} phút</div>` : ''}
                                    ${s.diagnosis ? `<div class="surgery-card-diagnosis">${s.diagnosis}</div>` : ''}
                                    ${s.method ? `<div class="surgery-card-method">${s.method}</div>` : ''}
                                    <div class="surgery-card-footer">
                                        <span class="surgery-card-surgeons">🔪 ${Utils.getStaffName(s.mainSurgeon)}${s.assistSurgeon1 ? ' / ' + Utils.getStaffName(s.assistSurgeon1) : ''}</span>
                                        ${s.duration ? `<span class="surgery-card-duration">⏱ ${s.duration}p</span>` : ''}
                                    </div>
                                    ${isAdmin ? `<div style="margin-top:6px;display:flex;gap:4px">
                                        <button class="btn btn-secondary btn-sm" style="font-size:0.68rem;padding:2px 8px" onclick="event.stopPropagation();SurgeryPage.openForm(${s.id})">✏ Sửa</button>
                                        <button class="btn btn-secondary btn-sm" style="font-size:0.68rem;padding:2px 8px" onclick="event.stopPropagation();SurgeryPage.viewDetail(${s.id})">🔍 Chi tiết</button>
                                        <button class="btn btn-secondary btn-sm" style="font-size:0.68rem;padding:2px 8px;color:var(--danger)" onclick="event.stopPropagation();SurgeryPage.deleteSurgery(${s.id})">🗑 Xoá</button>
                                    </div>` : ''}
                                </div>
                            </div>`;
                        }).join('') : `<div class="surgery-empty">Không có ca mổ</div>`}
                        ${isAdmin ? `<button class="surgery-add-btn" onclick="SurgeryPage.openForm(null,'${ds}')">+ Thêm ca</button>` : ''}
                    </div>
                </div>`;
            }).join('')}
        </div>
        `;
    },

    // Navigation
    prevWeek() {
        this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
        App.renderCurrentPage();
    },
    nextWeek() {
        this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
        App.renderCurrentPage();
    },
    thisWeek() {
        this.currentWeekStart = null;
        this.init();
        App.renderCurrentPage();
    },

    // Card expand/collapse
    toggleCard(el, event) {
        event.stopPropagation();
        el.classList.toggle('surgery-compact');
        el.classList.toggle('surgery-expanded');
    },

    toggleAllCards() {
        const cards = document.querySelectorAll('.surgery-card');
        const allExpanded = [...cards].every(c => c.classList.contains('surgery-expanded'));
        cards.forEach(c => {
            if (allExpanded) {
                c.classList.add('surgery-compact');
                c.classList.remove('surgery-expanded');
            } else {
                c.classList.remove('surgery-compact');
                c.classList.add('surgery-expanded');
            }
        });
        const icon = document.getElementById('surgery-toggle-icon');
        const text = document.getElementById('surgery-toggle-text');
        if (icon && text) {
            if (allExpanded) { icon.textContent = '📂'; text.textContent = 'Mở rộng'; }
            else { icon.textContent = '📁'; text.textContent = 'Thu gọn'; }
        }
    },

    // ===== STATS HELPERS =====
    getWeeklyStats() {
        const surgeries = this.getSurgeries();
        const stats = { total: surgeries.length };
        Object.keys(SURGERY_TYPES).forEach(k => {
            stats[k] = surgeries.filter(s => s.surgeryType === k).length;
        });
        return stats;
    },

    getMonthlyStats() {
        const all = this.getAllSurgeries();
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();
        const monthSurgeries = all.filter(s => {
            const d = new Date(s.date);
            return d.getMonth() === month && d.getFullYear() === year;
        });
        const stats = { total: monthSurgeries.length };
        Object.keys(SURGERY_TYPES).forEach(k => {
            stats[k] = monthSurgeries.filter(s => s.surgeryType === k).length;
        });
        return stats;
    },

    // View detail / edit
    viewDetail(id) {
        const all = this.getAllSurgeries();
        const s = all.find(x => x.id === id);
        if (!s) return;
        const isAdmin = canEditSurgery();
        const typeInfo = SURGERY_TYPES[s.surgeryType] || SURGERY_TYPES.chuongtrinh;

        Modal.open('Chi tiết ca mổ', `
            <div class="surgery-detail">
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">Bệnh nhân</div>
                    <div class="surgery-detail-value"><strong>${s.patientName}</strong> — NS: ${s.birthYear || '—'}</div>
                </div>
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">Số nhập viện</div>
                    <div class="surgery-detail-value">${s.admissionId || '—'}</div>
                </div>
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">Ngày mổ</div>
                    <div class="surgery-detail-value">${s.date}</div>
                </div>
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">Thời gian cuộc mổ</div>
                    <div class="surgery-detail-value">${s.duration ? s.duration + ' phút' : '—'}</div>
                </div>
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">Chẩn đoán</div>
                    <div class="surgery-detail-value">${s.diagnosis || '—'}</div>
                </div>
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">Phương pháp PT</div>
                    <div class="surgery-detail-value">${s.method || '—'}</div>
                </div>
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">BS mổ chính</div>
                    <div class="surgery-detail-value">${Utils.getStaffName(s.mainSurgeon) || '—'}</div>
                </div>
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">BS phụ 1</div>
                    <div class="surgery-detail-value">${s.assistSurgeon1 ? Utils.getStaffName(s.assistSurgeon1) : '—'}</div>
                </div>
                <div class="surgery-detail-row">
                    <div class="surgery-detail-label">Loại phẫu thuật</div>
                    <div class="surgery-detail-value"><span class="surgery-type-badge" style="background:${typeInfo.color}">${typeInfo.label}</span></div>
                </div>
                ${s.notes ? `<div class="surgery-detail-row">
                    <div class="surgery-detail-label">Ghi chú</div>
                    <div class="surgery-detail-value">${s.notes}</div>
                </div>` : ''}
            </div>
            <div class="modal-footer">
                ${isAdmin ? `
                    <button type="button" class="btn btn-danger" onclick="SurgeryPage.deleteSurgery(${s.id})">Xoá</button>
                    <button type="button" class="btn btn-secondary" onclick="Modal.close();SurgeryPage.openForm(${s.id})">Chỉnh sửa</button>
                ` : ''}
                <button type="button" class="btn btn-primary" onclick="Modal.close()">Đóng</button>
            </div>
        `);
    },

    // Form
    openForm(id, date) {
        if (!canEditSurgery()) return;
        const all = this.getAllSurgeries();
        const s = id ? all.find(x => x.id === id) : null;
        const defaultDate = s?.date || date || new Date().toISOString().split('T')[0];
        const staff = Store.getAll('staff').filter(st => st.role.includes('Bác sĩ') || st.role.includes('Trưởng khoa') || st.role.includes('Phó trưởng khoa'));
        const extDocs = Store.getAll('externalDoctors') || [];

        Modal.open(s ? 'Chỉnh sửa ca mổ' : 'Thêm ca mổ', `
            <form onsubmit="SurgeryPage.save(event, ${id || 0})">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Họ tên bệnh nhân</label>
                        <input class="form-input" name="patientName" value="${s?.patientName || ''}" required placeholder="Nguyễn Văn A">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Năm sinh</label>
                        <input class="form-input" name="birthYear" value="${s?.birthYear || ''}" placeholder="1980" type="number" min="1900" max="2026">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Số nhập viện</label>
                        <input class="form-input" name="admissionId" value="${s?.admissionId || ''}" placeholder="26014285">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Loại phẫu thuật</label>
                        <select class="form-select" name="surgeryType">
                            ${Object.entries(SURGERY_TYPES).map(([key, t]) =>
                                `<option value="${key}" ${(s?.surgeryType || 'chuongtrinh') === key ? 'selected' : ''}>${t.label}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Ngày mổ</label>
                        <input class="form-input" type="date" name="date" value="${defaultDate}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thời gian cuộc mổ (phút)</label>
                        <input class="form-input" name="duration" type="number" value="${s?.duration || ''}" placeholder="120">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">BS mổ chính</label>
                        <select class="form-select" name="mainSurgeon">
                            <option value="">— Chọn —</option>
                            <optgroup label="BS trong khoa">
                            ${staff.map(st => `<option value="${st.id}" ${s?.mainSurgeon == st.id ? 'selected' : ''}>${st.title} ${st.name}</option>`).join('')}
                            </optgroup>
                            ${extDocs.length ? `<optgroup label="BS ngoài khoa">
                            ${extDocs.map(d => `<option value="${d.id}" ${s?.mainSurgeon == d.id ? 'selected' : ''}>${d.title} ${d.name}</option>`).join('')}
                            </optgroup>` : ''}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">BS phụ 1</label>
                        <select class="form-select" name="assistSurgeon1">
                            <option value="">— Chọn —</option>
                            <optgroup label="BS trong khoa">
                            ${staff.map(st => `<option value="${st.id}" ${s?.assistSurgeon1 == st.id ? 'selected' : ''}>${st.title} ${st.name}</option>`).join('')}
                            </optgroup>
                            ${extDocs.length ? `<optgroup label="BS ngoài khoa">
                            ${extDocs.map(d => `<option value="${d.id}" ${s?.assistSurgeon1 == d.id ? 'selected' : ''}>${d.title} ${d.name}</option>`).join('')}
                            </optgroup>` : ''}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Chẩn đoán</label>
                    <input class="form-input" name="diagnosis" value="${s?.diagnosis || ''}" placeholder="K đại tràng sigma">
                </div>
                <div class="form-group">
                    <label class="form-label">Phương pháp phẫu thuật</label>
                    <input class="form-input" name="method" value="${s?.method || ''}" placeholder="PTNS cắt đại tràng sigma">
                </div>
                <div class="form-group">
                    <label class="form-label">Ghi chú</label>
                    <textarea class="form-textarea" name="notes">${s?.notes || ''}</textarea>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">${s ? 'Cập nhật' : 'Thêm ca mổ'}</button>
                </div>
            </form>
        `);
    },

    save(e, id) {
        if (!canEditSurgery()) return;
        e.preventDefault();
        const f = new FormData(e.target);
        const data = {
            patientName: f.get('patientName'),
            birthYear: f.get('birthYear'),
            admissionId: f.get('admissionId'),
            surgeryType: f.get('surgeryType'),
            date: f.get('date'),
            duration: f.get('duration'),
            mainSurgeon: f.get('mainSurgeon') ? parseInt(f.get('mainSurgeon')) : null,
            assistSurgeon1: f.get('assistSurgeon1') ? parseInt(f.get('assistSurgeon1')) : null,
            diagnosis: f.get('diagnosis'),
            method: f.get('method'),
            notes: f.get('notes')
        };

        const all = this.getAllSurgeries();
        if (id) {
            const idx = all.findIndex(x => x.id === id);
            if (idx !== -1) all[idx] = { ...all[idx], ...data };
        } else {
            data.id = Date.now();
            all.push(data);
        }
        this.saveSurgeries(all);
        Modal.close();
        App.renderCurrentPage();
    },

    deleteSurgery(id) {
        if (!canEditSurgery()) return;
        const all = this.getAllSurgeries();
        const s = all.find(x => x.id === id);
        if (!s) return;
        if (!confirm(`Xác nhận xoá ca mổ của BN "${s.patientName}"?`)) return;
        Store._deletedIds.add(id);
        this.saveSurgeries(all.filter(x => x.id !== id));
        if (typeof Modal !== 'undefined' && document.querySelector('.modal-overlay')) Modal.close();
        App.renderCurrentPage();
    },

    afterRender() {},

    // ===== EXPORT TODAY'S SURGERY LIST AS JPEG =====
    exportTodayImage() {
        const today = new Date();
        today.setHours(0,0,0,0);
        const ds = this.dateStr(today);
        const surgeries = this.getAllSurgeries();
        const _typePriority = { robot: 0, bankhan: 1, chuongtrinh: 2, yeucau: 3 };
        const todaySurgeries = surgeries.filter(s => s.date === ds)
            .sort((a, b) => (_typePriority[a.surgeryType] ?? 9) - (_typePriority[b.surgeryType] ?? 9));

        const dateLabel = `${today.getDate()}/${today.getMonth()+1}/${today.getFullYear()}`;
        const dayNames = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
        const dayName = dayNames[today.getDay()];

        // Count by type
        const typeCounts = {};
        Object.keys(SURGERY_TYPES).forEach(k => { typeCounts[k] = todaySurgeries.filter(s => s.surgeryType === k).length; });

        // Build surgery rows - complete info
        let rows = '';
        if (todaySurgeries.length === 0) {
            rows = '<tr><td colspan="9" style="text-align:center;padding:24px;color:#94a3b8;font-style:italic">Không có ca mổ hôm nay</td></tr>';
        } else {
            todaySurgeries.forEach((s, i) => {
                const typeInfo = SURGERY_TYPES[s.surgeryType] || SURGERY_TYPES.chuongtrinh;
                const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';
                rows += `<tr style="background:${bgColor};border-bottom:1px solid #e2e8f0">
                    <td style="padding:10px 8px;text-align:center;font-weight:700;color:#475569;font-size:13px">${i+1}</td>
                    <td style="padding:10px 8px;font-size:13px"><strong style="color:#1e293b">${s.patientName}</strong></td>
                    <td style="padding:10px 8px;text-align:center;font-size:12px;color:#64748b">${s.birthYear || '—'}</td>
                    <td style="padding:10px 8px;font-size:12px;color:#64748b">${s.admissionId || '—'}</td>
                    <td style="padding:10px 8px;font-size:12px;color:#1e40af;font-weight:500">${s.diagnosis || '—'}</td>
                    <td style="padding:10px 8px;font-size:12px;color:#475569;font-style:italic">${s.method || '—'}</td>
                    <td style="padding:10px 8px;text-align:center"><span style="background:${typeInfo.color};color:#fff;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;white-space:nowrap">${typeInfo.label}</span></td>
                    <td style="padding:10px 8px;font-size:12px;color:#475569">${Utils.getStaffName(s.mainSurgeon) || '—'}${s.assistSurgeon1 ? '<br><span style="color:#94a3b8;font-size:11px">Phụ: ' + Utils.getStaffName(s.assistSurgeon1) + '</span>' : ''}</td>
                    <td style="padding:10px 8px;text-align:center;font-size:12px;color:#475569">${s.duration ? s.duration + 'p' : '—'}</td>
                </tr>`;
                // Notes row if exists
                if (s.notes) {
                    rows += `<tr style="background:${bgColor};border-bottom:1px solid #e2e8f0">
                        <td style="padding:0"></td>
                        <td colspan="8" style="padding:0 8px 8px;font-size:11px;color:#94a3b8"><em>📝 ${s.notes}</em></td>
                    </tr>`;
                }
            });
        }

        // Type summary chips
        let typeChips = '';
        Object.entries(SURGERY_TYPES).forEach(([key, t]) => {
            if (typeCounts[key] > 0) {
                typeChips += `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:16px;font-size:12px;color:#475569">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${t.color}"></span>
                    ${t.label}: <strong>${typeCounts[key]}</strong>
                </span>`;
            }
        });

        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
        container.innerHTML = `
        <div id="surgery-export-target" style="width:1100px;padding:0;background:#fff;font-family:'Inter',sans-serif;color:#1e293b;">
            <!-- Header with dark navy background for high contrast -->
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:24px 36px;display:flex;justify-content:space-between;align-items:center">
                <div>
                    <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px">KHOA PTĐTT</div>
                    <div style="font-size:13px;color:#94a3b8;margin-top:3px">Phẫu thuật Đại trực tràng — BV Chợ Rẫy</div>
                </div>
                <div style="text-align:right">
                    <div style="font-size:20px;font-weight:700;color:#ffffff">LỊCH MỔ NGÀY ${dateLabel}</div>
                    <div style="font-size:13px;color:#67e8f9;font-weight:500">${dayName}</div>
                </div>
            </div>

            <!-- Summary bar -->
            <div style="padding:14px 36px;background:#f0f9ff;border-bottom:1px solid #bae6fd;display:flex;justify-content:space-between;align-items:center">
                <div style="font-size:14px;font-weight:700;color:#0c4a6e">
                    📋 Tổng số: ${todaySurgeries.length} ca phẫu thuật
                </div>
                <div>${typeChips}</div>
            </div>

            <!-- Table -->
            <div style="padding:0 36px 20px">
                <table style="width:100%;border-collapse:collapse;margin-top:16px">
                    <thead>
                        <tr style="background:#0f172a">
                            <th style="padding:11px 8px;text-align:center;color:#f1f5f9;font-size:12px;font-weight:600;width:36px">STT</th>
                            <th style="padding:11px 8px;text-align:left;color:#f1f5f9;font-size:12px;font-weight:600;min-width:110px">BỆNH NHÂN</th>
                            <th style="padding:11px 8px;text-align:center;color:#f1f5f9;font-size:12px;font-weight:600;width:46px">NS</th>
                            <th style="padding:11px 8px;text-align:left;color:#f1f5f9;font-size:12px;font-weight:600;width:82px">SỐ NV</th>
                            <th style="padding:11px 8px;text-align:left;color:#f1f5f9;font-size:12px;font-weight:600">CHẨN ĐOÁN</th>
                            <th style="padding:11px 8px;text-align:left;color:#f1f5f9;font-size:12px;font-weight:600">PHƯƠNG PHÁP PT</th>
                            <th style="padding:11px 8px;text-align:center;color:#f1f5f9;font-size:12px;font-weight:600;width:85px">LOẠI</th>
                            <th style="padding:11px 8px;text-align:left;color:#f1f5f9;font-size:12px;font-weight:600;min-width:110px">Ê-KÍP MỔ</th>
                            <th style="padding:11px 8px;text-align:center;color:#f1f5f9;font-size:12px;font-weight:600;width:46px">TG</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>

            <!-- Footer -->
            <div style="padding:12px 36px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;background:#f8fafc">
                <span>PTDTT Manager — ptdtt.vukhuongan.id.vn</span>
                <span>Xuất lúc ${new Date().toLocaleTimeString('vi-VN')} ngày ${dateLabel}</span>
            </div>
        </div>`;
        document.body.appendChild(container);

        const target = container.querySelector('#surgery-export-target');
        html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
            canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Lich_mo_${ds.replace(/-/g,'')}.jpg`;
                a.click();
                URL.revokeObjectURL(url);
                document.body.removeChild(container);
            }, 'image/jpeg', 0.95);
        }).catch(err => {
            console.error('Export failed:', err);
            alert('Không thể xuất ảnh. Vui lòng thử lại.');
            document.body.removeChild(container);
        });
    }
};
