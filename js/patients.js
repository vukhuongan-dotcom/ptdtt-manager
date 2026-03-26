// ===== PATIENTS PAGE (EMR LIVE DATA) =====
const PatientsPage = {
    searchQuery: '',
    roomFilter: 'all',

    render() {
        const emr = EMR.getData();
        const emrStatus = EMR.getStatus();
        const isHTTP = window.location.protocol.startsWith('http');

        // If no EMR data yet
        if (!emr || emr.totalAll === 0) {
            return `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Bệnh nhân</h1>
                    <p class="page-subtitle">Dữ liệu real-time từ EMR — Bệnh viện Bình Dân</p>
                </div>
            </div>
            <div class="card" style="padding:40px;text-align:center">
                ${emrStatus === 'loading'
                    ? '<p style="color:var(--text-muted)">⏳ Đang tải dữ liệu từ EMR...</p>'
                    : emrStatus === 'auth-required'
                        ? '<p style="color:#ef4444">🔑 Cần đăng nhập EMR. <a href="/emr-login" target="_blank">Đăng nhập</a></p>'
                        : !isHTTP
                            ? '<p style="color:var(--text-muted)">⚠️ Để xem dữ liệu BN real-time, chạy <code>python3 server.py</code> và mở <a href="http://localhost:3000">localhost:3000</a></p>'
                            : '<p style="color:var(--text-muted)">⏳ Đang kết nối EMR...</p>'
                }
            </div>`;
        }

        const deptPatients = emr.department;
        const rooms = emr.byRoom;
        const roomKeys = Object.keys(rooms).sort();

        // Apply filters
        let filtered = this.roomFilter === 'all'
            ? deptPatients
            : deptPatients.filter(p => p.phong === this.roomFilter);

        if (this.searchQuery) {
            const q = this._normalize(this.searchQuery);
            filtered = filtered.filter(p =>
                this._normalize(p.hoTen).includes(q) ||
                p.maNhapVien.includes(this.searchQuery) ||
                this._normalize(p.phong).includes(q)
            );
        }

        return `
        <div class="page-header">
            <div>
                <h1 class="page-title">Bệnh nhân</h1>
                <p class="page-subtitle">Dữ liệu real-time từ EMR — ${EMR.getTimeSinceUpdate()} <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;animation:pulse 2s infinite;margin-left:4px"></span></p>
            </div>
            <div style="text-align:right">
                <span class="badge badge-info" style="font-size:0.85rem;padding:6px 14px">${emr.totalDept} BN khoa</span>
            </div>
        </div>

        <div class="patient-stats">
            <div class="patient-stat">
                <div class="patient-stat-value cyan">${emr.totalDept}</div>
                <div class="patient-stat-label">Tổng BN khoa</div>
            </div>
            <div class="patient-stat">
                <div class="patient-stat-value green">${roomKeys.length}</div>
                <div class="patient-stat-label">Số phòng</div>
            </div>
            ${(() => {
                const counts = roomKeys.map(r => ({ room: r, count: rooms[r].length }));
                const minRoom = counts.reduce((a, b) => a.count <= b.count ? a : b);
                const maxRoom = counts.reduce((a, b) => a.count >= b.count ? a : b);
                return `
                <div class="patient-stat">
                    <div class="patient-stat-value" style="color:#10b981">${minRoom.count}</div>
                    <div class="patient-stat-label">${minRoom.room} <span class="patient-min-max-badge min">Min</span></div>
                </div>
                <div class="patient-stat">
                    <div class="patient-stat-value" style="color:#ef4444">${maxRoom.count}</div>
                    <div class="patient-stat-label">${maxRoom.room} <span class="patient-min-max-badge max">Max</span></div>
                </div>`;
            })()}
        </div>

        <div class="flex justify-between items-center" style="margin-bottom:16px">
            <div class="staff-filters" style="flex-wrap:wrap;gap:6px">
                <button class="filter-btn ${this.roomFilter==='all'?'active':''}" onclick="PatientsPage.setFilter('all')">Tất cả (${emr.totalDept})</button>
                ${roomKeys.map(r => `
                    <button class="filter-btn ${this.roomFilter===r?'active':''}" onclick="PatientsPage.setFilter('${r}')">${r} (${rooms[r].length})</button>
                `).join('')}
            </div>
            <div class="search-box">
                ${Utils.searchIcon()}
                <input type="text" id="patient-search" placeholder="Tìm BN theo tên, mã..." value="${this.searchQuery}" oninput="PatientsPage.search(this.value)">
            </div>
        </div>

        <div class="card patient-table-card">
            <table>
                <thead>
                    <tr>
                        <th style="width:50px">STT</th>
                        <th>Mã NV</th>
                        <th>Họ tên</th>
                        <th>Phòng</th>
                        <th>Ngày vào</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.length ? filtered.map((p, idx) => `
                    <tr>
                        <td style="color:var(--text-muted);text-align:center">${idx + 1}</td>
                        <td><code style="font-size:0.8rem;color:var(--primary)">${p.maNhapVien}</code></td>
                        <td><strong>${p.hoTen}</strong></td>
                        <td><span class="badge badge-info">${p.phong}</span></td>
                        <td style="color:var(--text-muted)">${p.ngayVao}</td>
                    </tr>
                    `).join('') : `<tr><td colspan="5"><div class="empty-state"><p>Không tìm thấy bệnh nhân</p></div></td></tr>`}
                </tbody>
            </table>
        </div>
        `;
    },

    setFilter(room) { this.roomFilter = room; App.renderCurrentPage(); },

    _composing: false,
    _searchTimer: null,

    search(q) {
        // Don't re-render while IME is composing (Telex/VNI)
        if (this._composing) return;
        this.searchQuery = q;
        // Debounce: wait 300ms after last keystroke before re-rendering
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => {
            App.renderCurrentPage();
        }, 300);
    },

    // Vietnamese diacritic-insensitive normalization
    _normalize(str) {
        return str.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D');
    },

    afterRender() {
        // Bind IME composition events to prevent re-render during Telex input
        const el = document.getElementById('patient-search');
        if (el) {
            el.addEventListener('compositionstart', () => { this._composing = true; });
            el.addEventListener('compositionend', (e) => {
                this._composing = false;
                this.search(e.target.value);
            });
            // Re-focus if user was searching
            if (this.searchQuery) {
                el.focus();
                el.setSelectionRange(el.value.length, el.value.length);
            }
        }
        // Auto-refresh when EMR data updates
        if (!this._emrListener) {
            this._emrListener = () => {
                if (App.currentPage === 'patients') App.renderCurrentPage();
            };
            window.addEventListener('emr-data-updated', this._emrListener);
        }
    }
};
