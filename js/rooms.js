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
            Toast.info('🖼️ Đang tạo hình ảnh sơ đồ phòng bệnh chuẩn quy cách...');

            const now = new Date();
            const pad = n => String(n).padStart(2, '0');
            const dateFmt = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
            const timeFmt = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

            // Build isolated iframe HTML following site export principles
            const fullHtml = `
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="utf-8">
                <title>Sơ đồ Phân công Phòng bệnh Nội trú</title>

                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet">

                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body {
                        font-family: 'Noto Sans', sans-serif;
                        background: #ffffff;
                        color: #0f172a;
                        padding: 36px 40px;
                        width: 1200px;
                        -webkit-font-smoothing: antialiased;
                    }

                    /* 1. Header Bệnh viện (NĐ 30) */
                    .export-header-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                        border-bottom: 2px solid #0891b2;
                        padding-bottom: 14px;
                    }
                    .header-left {
                        width: 50%;
                        text-align: left;
                        vertical-align: top;
                    }
                    .header-right {
                        width: 50%;
                        text-align: right;
                        vertical-align: top;
                    }
                    .org-name {
                        font-size: 13px;
                        font-weight: 700;
                        color: #334155;
                        text-transform: uppercase;
                        letter-spacing: normal;
                    }
                    .dept-name {
                        font-size: 15px;
                        font-weight: 800;
                        color: #0891b2;
                        text-transform: uppercase;
                        margin-top: 3px;
                    }
                    .national-title {
                        font-size: 13px;
                        font-weight: 700;
                        color: #0f172a;
                        text-transform: uppercase;
                    }
                    .national-motto {
                        font-size: 13px;
                        font-weight: 700;
                        color: #0f172a;
                        margin-top: 2px;
                    }

                    /* 2. Banner Tiêu đề */
                    .export-title-card {
                        text-align: center;
                        background: linear-gradient(135deg, #f8fafc, #f1f5f9);
                        border: 1px solid #cbd5e1;
                        border-radius: 10px;
                        padding: 18px 24px;
                        margin-bottom: 26px;
                    }
                    .export-main-title {
                        font-family: 'Be Vietnam Pro', sans-serif;
                        font-size: 22px;
                        font-weight: 800;
                        color: #0891b2;
                        text-transform: uppercase;
                        letter-spacing: normal;
                    }
                    .export-sub-title {
                        font-size: 13px;
                        font-weight: 600;
                        color: #475569;
                        margin-top: 4px;
                    }

                    /* 3. POD Section & Grid Layout */
                    .pod-section {
                        margin-bottom: 24px;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 18px;
                        background: #ffffff;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.03);
                    }
                    .pod-header-bar {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 10px 16px;
                        border-radius: 8px;
                        margin-bottom: 16px;
                    }
                    .pod-header-bar.pod1 { background: #fef2f2; border-left: 5px solid #ef4444; }
                    .pod-header-bar.pod2 { background: #fffbeb; border-left: 5px solid #f59e0b; }
                    .pod-header-bar.pod3 { background: #ecfdf5; border-left: 5px solid #10b981; }

                    .pod-title-text {
                        font-size: 16px;
                        font-weight: 800;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }

                    .rooms-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 16px;
                    }

                    .room-card {
                        background: #ffffff;
                        border: 1px solid #cbd5e1;
                        border-radius: 10px;
                        overflow: hidden;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.04);
                    }
                    .room-card-pod1 { border-top: 5px solid #ef4444; }
                    .room-card-pod1 .room-card-header { background: linear-gradient(135deg, #ef4444, #b91c1c); }

                    .room-card-pod2 { border-top: 5px solid #f59e0b; }
                    .room-card-pod2 .room-card-header { background: linear-gradient(135deg, #f59e0b, #b45309); }

                    .room-card-pod3 { border-top: 5px solid #10b981; }
                    .room-card-pod3 .room-card-header { background: linear-gradient(135deg, #10b981, #047857); }

                    .room-card-header {
                        padding: 12px 16px;
                        color: #ffffff;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    }
                    .pod-badge {
                        font-size: 11px;
                        font-weight: 800;
                        padding: 3px 9px;
                        border-radius: 12px;
                        background: rgba(255,255,255,0.28);
                        color: #ffffff;
                        letter-spacing: 0.5px;
                    }
                    .room-number {
                        font-size: 17px;
                        font-weight: 800;
                        margin-left: 6px;
                        letter-spacing: 0.5px;
                    }

                    .room-card-body {
                        padding: 14px 16px;
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                    }
                    .room-doctor {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .room-doc-avatar {
                        width: 34px;
                        height: 34px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-weight: 700;
                        font-size: 13px;
                        flex-shrink: 0;
                    }
                    .room-doc-info {
                        display: flex;
                        flex-direction: column;
                    }
                    .room-doc-name {
                        font-weight: 700;
                        font-size: 13.5px;
                        color: #0f172a;
                    }
                    .room-doc-role {
                        font-size: 11px;
                        font-weight: 600;
                        padding: 2px 7px;
                        border-radius: 4px;
                        width: fit-content;
                        margin-top: 3px;
                    }
                    .room-role-bs { background: #e0f2fe; color: #0369a1; }
                    .room-role-nt { background: #fef3c7; color: #b45309; }
                    .room-role-ch { background: #f3e8ff; color: #6b21a8; }

                    /* 4. Legend Box */
                    .export-legend-card {
                        margin-top: 24px;
                        padding: 16px 20px;
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 10px;
                    }
                    .legend-title {
                        font-size: 13px;
                        font-weight: 700;
                        color: #0f172a;
                        margin-bottom: 10px;
                    }
                    .legend-items {
                        display: flex;
                        gap: 20px;
                        flex-wrap: wrap;
                        font-size: 12px;
                        color: #475569;
                    }
                    .legend-item {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }
                    .legend-dot {
                        width: 10px;
                        height: 10px;
                        border-radius: 3px;
                        display: inline-block;
                    }

                    /* 5. Footer Attribution */
                    .export-footer {
                        margin-top: 24px;
                        padding-top: 14px;
                        border-top: 1px solid #e2e8f0;
                        text-align: center;
                        font-size: 11.5px;
                        color: #64748b;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                </style>
            </head>
            <body>
                <div id="capture">
                    <!-- 1. Header Bệnh viện -->
                    <table class="export-header-table">
                        <tr>
                            <td class="header-left">
                                <div class="org-name">BỆNH VIỆN BÌNH DÂN</div>
                                <div class="dept-name">KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG</div>
                            </td>
                            <td class="header-right">
                                <div class="national-title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                                <div class="national-motto">Độc lập - Tự do - Hạnh phúc</div>
                            </td>
                        </tr>
                    </table>

                    <!-- 2. Banner Tiêu đề -->
                    <div class="export-title-card">
                        <div class="export-main-title">SƠ ĐỒ PHÂN CÔNG PHÒNG BỆNH NỘI TRÚ</div>
                        <div class="export-sub-title">Khoa Phẫu thuật Đại trực tràng — Tầng 7, Tòa B | Ngày xuất: ${dateFmt} lúc ${timeFmt}</div>
                    </div>

                    <!-- 3. Danh sách 3 POD -->
                    ${POD_CONFIG.map(pod => {
                        const podRooms = ROOM_DATA.filter(r => r.pod === pod.id);
                        return `
                        <div class="pod-section">
                            <div class="pod-header-bar ${pod.classSuffix}">
                                <div class="pod-title-text" style="color:${pod.color}">
                                    <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${pod.color}"></span>
                                    <span>${pod.title}</span>
                                    <span style="font-size:12px;font-weight:600;color:#64748b">(${pod.desc})</span>
                                </div>
                            </div>
                            <div class="rooms-grid">
                                ${podRooms.map(r => {
                                    return `
                                    <div class="room-card room-card-${pod.classSuffix}">
                                        <div class="room-card-header">
                                            <div style="display:flex;align-items:center">
                                                <span class="pod-badge">${pod.title}</span>
                                                <span class="room-number">B${r.room}</span>
                                            </div>
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

                    <!-- 4. Legend Box -->
                    <div class="export-legend-card">
                        <div class="legend-title">📋 Chú thích & Mô hình POD</div>
                        <div class="legend-items">
                            <div class="legend-item"><span class="legend-dot" style="background:#ef4444"></span> 🔴 <strong>POD 1 (Đỏ):</strong> P718, P707</div>
                            <div class="legend-item"><span class="legend-dot" style="background:#f59e0b"></span> 🟡 <strong>POD 2 (Vàng):</strong> P705, P706, P711, P712, P712A, P719</div>
                            <div class="legend-item"><span class="legend-dot" style="background:#10b981"></span> 🟢 <strong>POD 3 (Xanh lá):</strong> P708, P709, P710</div>
                        </div>
                        <div class="legend-items" style="margin-top:10px;border-top:1px dashed #cbd5e1;padding-top:10px">
                            <div class="legend-item"><span class="legend-dot" style="background:#0369a1"></span> BS điều trị (chính)</div>
                            <div class="legend-item"><span class="legend-dot" style="background:#b45309"></span> BS nội trú (phụ)</div>
                            <div class="legend-item"><span class="legend-dot" style="background:#6b21a8"></span> BS cử nhân</div>
                        </div>
                    </div>

                    <!-- 5. Footer -->
                    <div class="export-footer">
                        <div>BỆNH VIỆN BÌNH DÂN — KHOA PHẪU THUẬT ĐẠI TRỰC TRÀNG</div>
                        <div>Website: khoaptdtt.info.vn</div>
                    </div>
                </div>
            </body>
            </html>
            `;

            // Render in isolated iframe (prevents layout shift / screen size dependency)
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1200px;height:3000px;border:none;opacity:0;pointer-events:none';
            document.body.appendChild(iframe);

            await new Promise((resolve) => {
                iframe.onload = resolve;
                iframe.srcdoc = fullHtml;
            });

            // Wait for fonts & DOM to settle
            await new Promise(r => setTimeout(r, 500));

            const captureEl = iframe.contentDocument.getElementById('capture');
            await Utils.loadScript('html2canvas');

            const canvas = await html2canvas(captureEl, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                letterRendering: true,
                allowTaint: false,
                imageTimeout: 15000,
                windowHeight: captureEl.scrollHeight + 100
            });

            document.body.removeChild(iframe);

            // Apply site-wide security watermark
            Utils.applyExportWatermark(canvas);

            // Download helper via server API / blob
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
            const filename = `So_Do_Phong_Benh_PTDTT_${dateStr}.png`;

            const dataUrl = canvas.toDataURL('image/png');
            const dlHeaders = { 'Content-Type': 'application/json' };
            const dlToken = (typeof Auth !== 'undefined') ? Auth.getToken() : null;
            if (dlToken) dlHeaders['Authorization'] = 'Bearer ' + dlToken;

            try {
                const resp = await fetch('/api/download-image', {
                    method: 'POST',
                    headers: dlHeaders,
                    body: JSON.stringify({ image: dataUrl, filename: filename })
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
                    await new Promise(r => setTimeout(r, 500));
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    Toast.success('✅ Đã xuất hình ảnh sơ đồ phòng bệnh thành công!');
                    return;
                }
            } catch (e) {
                console.warn('Fallback to direct blob download:', e);
            }

            // Direct download fallback
            const a = document.createElement('a');
            a.download = filename;
            a.href = dataUrl;
            a.click();

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
