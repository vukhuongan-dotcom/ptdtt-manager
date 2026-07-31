// ===== ROOM MAP PAGE =====
// Cập nhật phân công 3 POD: POD1 (Đỏ), POD2 (Vàng), POD3 (Xanh lá) — 31/07/2026
const POD_CONFIG = [
    {
        id: 1,
        title: 'POD 1',
        desc: 'Phòng bệnh 718, 707',
        color: '#ef4444',
        classSuffix: 'pod1',
        rooms: ['718', '707']
    },
    {
        id: 2,
        title: 'POD 2',
        desc: 'Phòng bệnh 705, 706, 711, 712, 712A, 719',
        color: '#f59e0b',
        classSuffix: 'pod2',
        rooms: ['705', '706', '711', '712', '712A', '719']
    },
    {
        id: 3,
        title: 'POD 3',
        desc: 'Phòng bệnh 708, 709, 710',
        color: '#10b981',
        classSuffix: 'pod3',
        rooms: ['708', '709', '710']
    }
];

const ROOM_DATA = [
    // POD 1 (Màu Đỏ)
    { room: '718',  pod: 1, doctors: [{ id: 2,  role: 'chính' }, { id: 12, role: 'chính' }, { id: 48, role: 'NT' }] },
    { room: '707',  pod: 1, doctors: [{ id: 9,  role: 'chính' }, { id: 44, role: 'NT' }] },

    // POD 2 (Màu Vàng)
    { room: '705',  pod: 2, doctors: [{ id: 8,  role: 'chính' }, { id: 43, role: 'NT' }] },
    { room: '706',  pod: 2, doctors: [{ id: 8,  role: 'chính' }, { id: 47, role: 'NT' }] },
    { room: '711',  pod: 2, doctors: [{ id: 10, role: 'chính' }] },
    { room: '712',  pod: 2, doctors: [{ id: 10, role: 'chính' }] },
    { room: '712A', pod: 2, doctors: [{ id: 6,  role: 'chính' }, { id: 16, role: 'NT' }] },
    { room: '719',  pod: 2, doctors: [{ id: 6,  role: 'chính' }, { id: 16, role: 'NT' }] },

    // POD 3 (Màu Xanh lá)
    { room: '708',  pod: 3, doctors: [{ id: 4,  role: 'chính' }, { id: 46, role: 'NT' }] },
    { room: '709',  pod: 3, doctors: [{ id: 11, role: 'chính' }] },
    { room: '710',  pod: 3, doctors: [{ id: 7,  role: 'chính' }, { id: 45, role: 'NT' }] },
];

// Cấu hình tạm ẩn số lượng bệnh nhân (chuyển sang true để bật lại sau này)
const SHOW_PATIENT_COUNT = false;

const RoomsPage = {
    render() {
        const emrData = (typeof EMR !== 'undefined') ? EMR.getData() : null;
        const emrStatus = (typeof EMR !== 'undefined') ? EMR.getStatus() : 'idle';
        const totalPatients = emrData ? emrData.totalDept : null;
        const lastUpdate = (typeof EMR !== 'undefined') ? EMR.getTimeSinceUpdate() : '';
        const isAdmin = App.isAdmin();

        return `
        <div id="rooms-page-container">
            <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
                <div>
                    <h1 class="page-title">Sơ đồ phòng bệnh (Mô hình 3 POD)</h1>
                    <p class="page-subtitle">Khoa Phẫu thuật Đại trực tràng — Tầng 7, Tòa B</p>
                </div>
                <div style="display:flex;align-items:center;gap:10px">
                    ${isAdmin ? `
                        <button class="btn btn-outline" onclick="RoomsPage.exportImage()" title="Xuất hình ảnh sơ đồ phòng bệnh (Chỉ Admin)" style="display:flex;align-items:center;gap:6px;padding:8px 14px;font-size:0.85rem;font-weight:600;cursor:pointer">
                            📷 <span>Xuất hình sơ đồ</span>
                        </button>
                    ` : ''}
                    ${(SHOW_PATIENT_COUNT && totalPatients !== null) ? `<div style="display:flex;align-items:center;gap:8px;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:var(--border-radius);padding:8px 14px">
                        <span style="font-size:1.2rem;font-weight:700;color:var(--primary)">${totalPatients}</span>
                        <span style="font-size:0.85rem;color:var(--text-secondary)">bệnh nhân</span>
                        <span style="font-size:0.75rem;color:var(--text-muted);margin-left:4px">· ${lastUpdate}</span>
                    </div>` : ''}
                </div>
            </div>

            ${POD_CONFIG.map(pod => {
                const podRooms = ROOM_DATA.filter(r => r.pod === pod.id);
                return `
                <div class="pod-section">
                    <div class="pod-section-header ${pod.classSuffix}">
                        <div class="pod-section-title" style="color:${pod.color}">
                            <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${pod.color}"></span>
                            <span>${pod.title}</span>
                            <span style="font-size:0.8rem;font-weight:500;color:var(--text-secondary)">(${pod.desc})</span>
                        </div>
                    </div>
                    <div class="rooms-grid">
                        ${podRooms.map(r => {
                            const patientCount = this._getPatientCount(r.room, emrData);
                            const hasPatients = patientCount !== null && patientCount > 0;
                            return `
                            <div class="room-card room-card-${pod.classSuffix}">
                                <div class="room-card-header">
                                    <div style="display:flex;align-items:center">
                                        <span class="pod-badge">${pod.title}</span>
                                        <span class="room-number">B${r.room}</span>
                                    </div>
                                    ${SHOW_PATIENT_COUNT ? `<span class="room-patient-count" title="Số BN" style="${hasPatients ? 'background:rgba(255,255,255,0.25);color:#fff;padding:2px 10px;border-radius:12px;font-weight:700;font-size:0.85rem' : 'color:rgba(255,255,255,0.6)'}">${patientCount !== null ? patientCount + ' BN' : '—'}</span>` : ''}
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
                </div>`;
            }).join('')}

            <div class="card rooms-legend" style="margin-top:20px">
                <h3 style="font-size:0.9rem;margin-bottom:10px;color:var(--text-primary)">📋 Chú thích & Mô hình POD</h3>
                <div class="rooms-legend-items">
                    <span class="rooms-legend-item"><span class="room-legend-dot" style="background:#ef4444"></span> 🔴 <strong>POD 1 (Đỏ):</strong> P718, P707</span>
                    <span class="rooms-legend-item"><span class="room-legend-dot" style="background:#f59e0b"></span> 🟡 <strong>POD 2 (Vàng):</strong> P705, P706, P711, P712, P712A, P719</span>
                    <span class="rooms-legend-item"><span class="room-legend-dot" style="background:#10b981"></span> 🟢 <strong>POD 3 (Xanh lá):</strong> P708, P709, P710</span>
                </div>
                <div class="rooms-legend-items" style="margin-top:10px;border-top:1px dashed var(--border);padding-top:10px">
                    <span class="rooms-legend-item"><span class="room-legend-dot room-role-bs"></span> BS điều trị (chính)</span>
                    <span class="rooms-legend-item"><span class="room-legend-dot room-role-nt"></span> BS nội trú (phụ)</span>
                    <span class="rooms-legend-item"><span class="room-legend-dot room-role-ch"></span> BS cử nhân</span>
                </div>
            </div>
        </div>
        `;
    },

    async exportImage() {
        if (!App.isAdmin()) {
            Toast.error('Chức năng xuất hình sơ đồ phòng bệnh chỉ dành cho Admin.');
            return;
        }

        try {
            Toast.info('🖼️ Đang tạo hình ảnh sơ đồ phòng bệnh...');
            await Utils.loadScript('html2canvas');

            const captureEl = document.getElementById('rooms-page-container');
            if (!captureEl) {
                Toast.error('Không tìm thấy vùng sơ đồ phòng bệnh để xuất hình.');
                return;
            }

            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const canvas = await html2canvas(captureEl, {
                scale: 2,
                useCORS: true,
                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                logging: false,
                ignoreElements: (element) => element.tagName === 'BUTTON' && element.onclick && element.onclick.toString().includes('exportImage')
            });

            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const filename = `So_Do_Phong_Benh_PTDTT_${dateStr}.png`;

            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();

            Toast.success('✅ Đã xuất hình ảnh sơ đồ phòng bệnh thành công!');
        } catch (err) {
            console.error('Error exporting room diagram image:', err);
            Toast.error('Lỗi khi tạo hình ảnh sơ đồ phòng bệnh: ' + err.message);
        }
    },

    _getPatientCount(room, emrData) {
        if (!emrData || !emrData.byRoom) return null;
        let count = 0;
        const roomSuffix = room.startsWith('7') ? room.slice(1) : room;
        Object.keys(emrData.byRoom).forEach(k => {
            const parts = k.split('.');
            const emrSuffix = parts.length >= 3 ? parts.slice(2).join('.') : k;
            if (emrSuffix.toUpperCase() === roomSuffix.toUpperCase()) {
                count += emrData.byRoom[k].length;
            }
        });
        return count;
    },

    afterRender() {
        if (!this._emrListener) {
            this._emrListener = () => {
                if (App.currentPage === 'rooms') App.renderCurrentPage();
            };
            window.addEventListener('emr-data-updated', this._emrListener);
        }
    }
};
