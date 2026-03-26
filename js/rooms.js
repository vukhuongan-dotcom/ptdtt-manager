// ===== ROOM MAP PAGE =====
const ROOM_DATA = [
    { room: '705', doctors: [{ id: 6,  role: 'chính' }, { id: 16, role: 'CH' }] },
    { room: '706', doctors: [{ id: 8,  role: 'chính' }, { id: 22, role: 'NT' }] },
    { room: '707', doctors: [{ id: 9,  role: 'chính' }, { id: 13, role: 'NT' }] },
    { room: '708', doctors: [{ id: 4,  role: 'chính' }, { id: 15, role: 'NT' }] },
    { room: '709', doctors: [{ id: 11, role: 'chính' }, { id: 17, role: 'NT' }] },
    { room: '710', doctors: [{ id: 7,  role: 'chính' }, { id: 14, role: 'NT' }] },
    { room: '711', doctors: [{ id: 10, role: 'chính' }] },
    { room: '712', doctors: [{ id: 10, role: 'chính' }] },
    { room: '712A', doctors: [{ id: 8,  role: 'chính' }, { id: 23, role: 'NT' }] },
    { room: '719', doctors: [{ id: 8,  role: 'chính' }, { id: 23, role: 'NT' }] },
    { room: '718', doctors: [{ id: 2,  role: 'chính' }, { id: 12, role: 'chính' }] },
];

const RoomsPage = {
    render() {
        const emrData = (typeof EMR !== 'undefined') ? EMR.getData() : null;
        const emrStatus = (typeof EMR !== 'undefined') ? EMR.getStatus() : 'idle';
        const totalPatients = emrData ? emrData.totalDept : null;
        const lastUpdate = (typeof EMR !== 'undefined') ? EMR.getTimeSinceUpdate() : '';

        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Sơ đồ phòng bệnh</h1>
                <p class="page-subtitle">Khoa Phẫu thuật Đại trực tràng — Tầng 7, Tòa B</p>
            </div>
            ${totalPatients !== null ? `<div style="display:flex;align-items:center;gap:8px;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:var(--border-radius);padding:10px 18px">
                <span style="font-size:1.3rem;font-weight:700;color:var(--primary)">${totalPatients}</span>
                <span style="font-size:0.85rem;color:var(--text-secondary)">bệnh nhân</span>
                <span style="font-size:0.75rem;color:var(--text-muted);margin-left:8px">· ${lastUpdate}</span>
            </div>` : ''}
        </div>

        <div class="rooms-grid">
            ${ROOM_DATA.map(r => {
                const patientCount = this._getPatientCount(r.room, emrData);
                const hasPatients = patientCount !== null && patientCount > 0;
                return `
                <div class="room-card">
                    <div class="room-card-header">
                        <span class="room-number">B${r.room}</span>
                        <span class="room-patient-count" title="Số BN" style="${hasPatients ? 'background:rgba(255,255,255,0.25);color:#fff;padding:2px 10px;border-radius:12px;font-weight:700;font-size:0.85rem' : 'color:rgba(255,255,255,0.6)'}">${patientCount !== null ? patientCount + ' BN' : '—'}</span>
                    </div>
                    <div class="room-card-body">
                        ${r.doctors.map(d => {
                            const staff = Store.getById('staff', d.id);
                            if (!staff) return '';
                            const fullName = staff.title + ' ' + staff.name;
                            const roleLabel = d.role === 'NT' ? 'Nội trú' : d.role === 'CH' ? 'Cử nhân' : 'BS điều trị';
                            const roleBadge = d.role === 'NT' ? 'room-role-nt' : d.role === 'CH' ? 'room-role-ch' : 'room-role-bs';
                            return `
                            <div class="room-doctor">
                                <div class="room-doc-avatar" style="background:${staff.color}">${staff.name.split(' ').pop().charAt(0)}</div>
                                <div class="room-doc-info">
                                    <div class="room-doc-name">${fullName}</div>
                                    <div class="room-doc-role ${roleBadge}">${roleLabel}</div>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
            }).join('')}
        </div>

        <div class="card rooms-legend" style="margin-top:20px">
            <h3 style="font-size:0.9rem;margin-bottom:10px;color:var(--text-primary)">📋 Chú thích</h3>
            <div class="rooms-legend-items">
                <span class="rooms-legend-item"><span class="room-legend-dot room-role-bs"></span> BS điều trị (chính)</span>
                <span class="rooms-legend-item"><span class="room-legend-dot room-role-nt"></span> BS nội trú (phụ)</span>
                <span class="rooms-legend-item"><span class="room-legend-dot room-role-ch"></span> BS cử nhân</span>
            </div>
        </div>
        `;
    },

    _getPatientCount(room, emrData) {
        if (!emrData || !emrData.byRoom) return null;
        let count = 0;
        // ROOM_DATA room: "705","706",...,"712A","718","719"
        // EMR byRoom keys: "B.7.05","B.7.06",...,"B.7.12A","B.7.18","B.7.19"
        // Strategy: extract suffix after "B.7." → "05","06",...,"12A"
        //           our room "705" → strip leading "7" → "05"
        const roomSuffix = room.startsWith('7') ? room.slice(1) : room; // "705" → "05", "712A" → "12A"
        Object.keys(emrData.byRoom).forEach(k => {
            // EMR key "B.7.05" → extract after last dot for suffix
            const parts = k.split('.');
            const emrSuffix = parts.length >= 3 ? parts.slice(2).join('.') : k;
            if (emrSuffix.toUpperCase() === roomSuffix.toUpperCase()) {
                count += emrData.byRoom[k].length;
            }
        });
        return count;
    },

    afterRender() {
        // Re-render rooms when EMR data updates
        if (!this._emrListener) {
            this._emrListener = () => {
                if (App.currentPage === 'rooms') App.renderCurrentPage();
            };
            window.addEventListener('emr-data-updated', this._emrListener);
        }
    }
};
