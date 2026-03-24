// ===== SURGERY STATISTICS PAGE =====
const SurgeryStatsPage = {
    period: 'week', // week | month | quarter | year
    selectedDoctor: 'all', // 'all' or staff id

    // Filter: BCN khoa + Bác sĩ chính only
    getEligibleDoctors() {
        return Store.getAll('staff').filter(s =>
            s.role === 'BS Trưởng khoa' ||
            s.role === 'BS Phó trưởng khoa' ||
            s.role === 'Bác sĩ chính'
        );
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
        // Try to match by name (approximate)
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
        const doctors = this.getEligibleDoctors();

        // Grand totals by type
        const grandByType = {};
        types.forEach(t => {
            grandByType[t] = surgeries.filter(s => s.surgeryType === t).length;
        });

        // Filter by selected doctor
        const filteredStats = this.selectedDoctor === 'all'
            ? allStats
            : allStats.filter(d => d.doctor.id == this.selectedDoctor);

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
            <div class="sstats-doctor-filter">
                <select class="form-select" onchange="SurgeryStatsPage.filterDoctor(this.value)" style="min-width:200px;padding:6px 10px;font-size:0.85rem">
                    <option value="all" ${this.selectedDoctor === 'all' ? 'selected' : ''}>Tất cả BS mổ chính</option>
                    ${doctors.map(d => `<option value="${d.id}" ${this.selectedDoctor == d.id ? 'selected' : ''}>${d.title} ${d.name}</option>`).join('')}
                </select>
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

        ${filteredStats.length === 0 ? `
            <div class="card" style="text-align:center;padding:40px;color:var(--text-muted)">
                <div style="font-size:2rem;margin-bottom:12px">📋</div>
                <p>Chưa có ca phẫu thuật nào trong ${this.getPeriodLabel()}</p>
            </div>
        ` : filteredStats.map(docStat => `
            <div class="sstats-doctor-section">
                <div class="sstats-doctor-header">
                    <div class="sstats-doctor-info">
                        <div class="sstats-doc-avatar" style="background:${docStat.doctor.color}">${docStat.doctor.name.split(' ').pop().charAt(0)}</div>
                        <div>
                            <div class="sstats-doc-name">${docStat.doctor.title} ${docStat.doctor.name}</div>
                            <div class="sstats-doc-role">${docStat.doctor.role}</div>
                        </div>
                    </div>
                    <div class="sstats-doctor-summary">
                        <span class="sstats-doctor-total">${docStat.total} ca</span>
                        ${types.map(t => docStat.byType[t] > 0 ? `<span class="sstats-type-chip" style="background:${SURGERY_TYPES[t].color}20;color:${SURGERY_TYPES[t].color}">${SURGERY_TYPES[t].label}: ${docStat.byType[t]}</span>` : '').join('')}
                    </div>
                </div>
                <div class="sstats-table-wrap">
                    <table class="sstats-table">
                        <thead>
                            <tr>
                                <th class="sstats-th-stt">STT</th>
                                <th class="sstats-th-name">Họ tên BN</th>
                                <th>Số NV</th>
                                <th>Năm sinh</th>
                                <th>Phòng</th>
                                <th class="sstats-th-diag">Chẩn đoán trước mổ</th>
                                <th class="sstats-th-method">PP phẫu thuật</th>
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
                                    <td class="sstats-td-stt">${idx + 1}</td>
                                    <td class="sstats-td-patient"><strong>${s.patientName}</strong></td>
                                    <td>${s.admissionId || '—'}</td>
                                    <td>${s.birthYear || '—'}</td>
                                    <td>${room}</td>
                                    <td class="sstats-td-diag">${s.diagnosis || '—'}</td>
                                    <td class="sstats-td-method">${s.method || '—'}</td>
                                    <td>${dateStr}</td>
                                    <td><span class="surgery-type-badge" style="background:${typeInfo.color}">${typeInfo.label}</span></td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `).join('')}
        `;
    },

    setPeriod(p) {
        this.period = p;
        App.renderCurrentPage();
    },

    filterDoctor(id) {
        this.selectedDoctor = id;
        App.renderCurrentPage();
    },

    afterRender() {}
};
