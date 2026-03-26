// ===== SURGERY STATISTICS PAGE =====
const SurgeryStatsPage = {
    period: 'week', // week | month | quarter | year
    expandedDoctor: null, // id of the doctor whose detail is shown

    // Filter: BCN khoa + Bác sĩ chính + External doctors
    getEligibleDoctors() {
        const internal = Store.getAll('staff').filter(s =>
            s.role === 'BS Trưởng khoa' ||
            s.role === 'BS Phó trưởng khoa' ||
            s.role === 'Bác sĩ chính'
        );
        const external = (Store.getAll('externalDoctors') || []).map(d => ({
            ...d,
            role: d.position || 'BS ngoài khoa'
        }));
        return [...internal, ...external];
    },

    // Get date range for current period
    getDateRange() {
        const now = new Date();
        let start, end;

        if (this.period === 'week') {
            const day = now.getDay();
            start = new Date(now);
            start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
            start.setHours(0, 0, 0, 0);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else if (this.period === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (this.period === 'quarter') {
            const q = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), q * 3, 1);
            end = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
        } else { // year
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        }

        return { start, end };
    },

    getPeriodLabel() {
        const now = new Date();
        const labels = {
            week: (() => {
                const day = now.getDay();
                const mon = new Date(now);
                mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
                const sun = new Date(mon);
                sun.setDate(mon.getDate() + 6);
                return `Tuần ${mon.getDate()}/${mon.getMonth()+1} — ${sun.getDate()}/${sun.getMonth()+1}/${sun.getFullYear()}`;
            })(),
            month: `Tháng ${now.getMonth()+1}/${now.getFullYear()}`,
            quarter: `Quý ${Math.floor(now.getMonth()/3)+1}/${now.getFullYear()}`,
            year: `Năm ${now.getFullYear()}`
        };
        return labels[this.period];
    },

    // Get surgeries in date range
    getSurgeriesInRange() {
        const all = JSON.parse(localStorage.getItem('ptdtt_surgeries') || '[]');
        const { start, end } = this.getDateRange();
        return all.filter(s => {
            const d = new Date(s.date);
            return d >= start && d <= end;
        });
    },

    // Get EMR room for a patient (by matching name)
    getPatientRoom(patientName) {
        if (typeof EMR === 'undefined') return '—';
        const data = EMR.getData();
        if (!data || !data.patients) return '—';
        const name = patientName.trim().toLowerCase();
        const match = data.patients.find(p => {
            const emrName = (p.name || p.hoTen || '').trim().toLowerCase();
            return emrName === name || emrName.includes(name) || name.includes(emrName);
        });
        return match ? (match.room || match.phong || '—') : '—';
    },

    // Compute detailed stats grouped by doctor
    computeDetailedStats() {
        const doctors = this.getEligibleDoctors();
        const surgeries = this.getSurgeriesInRange();
        const types = Object.keys(SURGERY_TYPES);

        return doctors.map(doc => {
            const cases = surgeries.filter(s => s.mainSurgeon === doc.id);
            const byType = {};
            types.forEach(t => {
                byType[t] = cases.filter(s => s.surgeryType === t).length;
            });

            return {
                doctor: doc,
                cases: cases.sort((a, b) => new Date(a.date) - new Date(b.date)),
                total: cases.length,
                byType
            };
        }).filter(d => d.total > 0).sort((a, b) => b.total - a.total);
    },

    render() {
        const allStats = this.computeDetailedStats();
        const surgeries = this.getSurgeriesInRange();
        const totalAll = surgeries.length;
        const types = Object.keys(SURGERY_TYPES);

        // Grand totals by type
        const grandByType = {};
        types.forEach(t => {
            grandByType[t] = surgeries.filter(s => s.surgeryType === t).length;
        });

        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Thống kê phẫu thuật</h1>
                <p class="page-subtitle">Thống kê ca phẫu thuật theo BS mổ chính — ${this.getPeriodLabel()}</p>
            </div>
        </div>

        <div class="sstats-controls">
            <div class="sstats-period-tabs">
                ${['week','month','quarter','year'].map(p => `
                    <button class="sstats-period-btn ${this.period === p ? 'active' : ''}" onclick="SurgeryStatsPage.setPeriod('${p}')">
                        ${{week:'Tuần',month:'Tháng',quarter:'Quý',year:'Năm'}[p]}
                    </button>
                `).join('')}
            </div>
        </div>

        <div class="sstats-summary-cards">
            <div class="sstats-summary-card sstats-total">
                <div class="sstats-summary-value">${totalAll}</div>
                <div class="sstats-summary-label">Tổng ca PT</div>
            </div>
            ${types.map(t => {
                const info = SURGERY_TYPES[t];
                return `<div class="sstats-summary-card">
                    <div class="sstats-summary-value" style="color:${info.color}">${grandByType[t]}</div>
                    <div class="sstats-summary-label">${info.label}</div>
                </div>`;
            }).join('')}
        </div>

        ${totalAll === 0 ? `
            <div class="card" style="text-align:center;padding:40px;color:var(--text-muted)">
                <div style="font-size:2rem;margin-bottom:12px">📋</div>
                <p>Chưa có ca phẫu thuật nào trong ${this.getPeriodLabel()}</p>
            </div>
        ` : `
            <!-- ===== SUMMARY TABLE ===== -->
            <div class="card sstats-main-table-card">
                <div class="sstats-main-table-header">
                    <h3>🩺 Bảng tổng hợp theo BS mổ chính</h3>
                    <span class="sstats-main-table-hint">Nhấn vào tên BS để xem chi tiết</span>
                </div>
                <table class="sstats-table">
                    <thead>
                        <tr>
                            <th class="sstats-th-stt">STT</th>
                            <th class="sstats-th-name">BS mổ chính</th>
                            ${types.map(t => `<th class="sstats-th-num">${SURGERY_TYPES[t].label}</th>`).join('')}
                            <th class="sstats-th-num sstats-th-total">Tổng</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allStats.map((docStat, idx) => {
                            const isExpanded = this.expandedDoctor == docStat.doctor.id;
                            return `
                        <tr class="sstats-summary-row ${isExpanded ? 'sstats-row-active' : ''}" 
                            onclick="SurgeryStatsPage.toggleDoctor(${docStat.doctor.id})" 
                            style="cursor:pointer">
                            <td class="sstats-td-stt">${idx + 1}</td>
                            <td>
                                <div class="sstats-td-name">
                                    <div class="sstats-doc-avatar" style="background:${docStat.doctor.color}">${docStat.doctor.name.split(' ').pop().charAt(0)}</div>
                                    <div>
                                        <div class="sstats-doc-name">${docStat.doctor.name}</div>
                                        <div class="sstats-doc-role">${docStat.doctor.role}</div>
                                    </div>
                                    <svg class="sstats-expand-icon ${isExpanded ? 'expanded' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                                </div>
                            </td>
                            ${types.map(t => `<td class="sstats-td-num ${docStat.byType[t] === 0 ? 'zero' : ''}">${docStat.byType[t]}</td>`).join('')}
                            <td class="sstats-td-num sstats-td-total">${docStat.total}</td>
                        </tr>
                        ${isExpanded ? `
                        <tr class="sstats-detail-row">
                            <td colspan="${types.length + 3}" style="padding:0">
                                ${this._renderDoctorDetail(docStat)}
                            </td>
                        </tr>` : ''}`;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="sstats-footer-row">
                            <td colspan="2" class="sstats-td-footer-label">TỔNG CỘNG</td>
                            ${types.map(t => `<td class="sstats-td-num" style="font-weight:700">${grandByType[t]}</td>`).join('')}
                            <td class="sstats-td-num sstats-td-total" style="font-weight:800;font-size:1rem">${totalAll}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `}
        `;
    },

    // Render expanded detail for a specific doctor
    _renderDoctorDetail(docStat) {
        return `
        <div class="sstats-detail-panel">
            <div class="sstats-detail-header">
                <div class="sstats-detail-title">
                    <strong>${docStat.doctor.name}</strong> — ${docStat.total} ca phẫu thuật
                </div>
                <div class="sstats-detail-chips">
                    ${Object.keys(SURGERY_TYPES).map(t => docStat.byType[t] > 0 ? `<span class="sstats-type-chip" style="background:${SURGERY_TYPES[t].color}20;color:${SURGERY_TYPES[t].color}">${SURGERY_TYPES[t].label}: ${docStat.byType[t]}</span>` : '').join('')}
                </div>
            </div>
            <table class="sstats-detail-table">
                <thead>
                    <tr>
                        <th style="width:40px;text-align:center">STT</th>
                        <th style="min-width:140px">Họ tên BN</th>
                        <th>Số NV</th>
                        <th>Năm sinh</th>
                        <th>Phòng</th>
                        <th style="min-width:160px">Chẩn đoán trước mổ</th>
                        <th style="min-width:180px">PP phẫu thuật</th>
                        <th>Ngày mổ</th>
                        <th>Loại PT</th>
                    </tr>
                </thead>
                <tbody>
                    ${docStat.cases.map((s, idx) => {
                        const typeInfo = SURGERY_TYPES[s.surgeryType] || SURGERY_TYPES.chuongtrinh;
                        const room = this.getPatientRoom(s.patientName);
                        const dateObj = new Date(s.date);
                        const dateStr = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}`;
                        return `
                    <tr onclick="SurgeryPage.viewDetail(${s.id})" style="cursor:pointer" title="Xem chi tiết">
                        <td style="text-align:center;color:var(--text-muted);font-weight:600">${idx + 1}</td>
                        <td><strong>${s.patientName}</strong></td>
                        <td>${s.admissionId || '—'}</td>
                        <td>${s.birthYear || '—'}</td>
                        <td>${room}</td>
                        <td style="font-size:0.78rem;color:var(--text-secondary)">${s.diagnosis || '—'}</td>
                        <td style="font-size:0.78rem;color:var(--text-secondary)">${s.method || '—'}</td>
                        <td>${dateStr}</td>
                        <td><span class="surgery-type-badge" style="background:${typeInfo.color}">${typeInfo.label}</span></td>
                    </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
    },

    toggleDoctor(id) {
        this.expandedDoctor = this.expandedDoctor == id ? null : id;
        App.renderCurrentPage();
    },

    setPeriod(p) {
        this.period = p;
        this.expandedDoctor = null;
        App.renderCurrentPage();
    },

    afterRender() {}
};
