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
                <span class="surgery-stat-chip">📋 ${totalCases} ca trong tuần</span>
                <span class="surgery-stat-chip">📅 ${todayCases} ca hôm nay</span>
                <button class="btn btn-secondary btn-sm" onclick="SurgeryPage.toggleAllCards()" id="surgery-toggle-btn" title="Thu gọn / Mở rộng tất cả">
                    <span id="surgery-toggle-icon">📂</span> <span id="surgery-toggle-text">Mở rộng</span>
                </button>
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

        <div class="surgery-summary-panel">
            <h3 class="surgery-summary-title">📊 Thống kê ca mổ trong tuần</h3>
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
                    <span class="surgery-summary-label"><strong>Tổng</strong></span>
                    <span class="surgery-summary-count"><strong>${totalCases}</strong></span>
                </div>
            </div>
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
        this.saveSurgeries(all.filter(x => x.id !== id));
        Modal.close();
        App.renderCurrentPage();
    },

    afterRender() {}
};
