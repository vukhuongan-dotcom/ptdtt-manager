// ===== EMR PATIENT DATA FETCHER =====
// Scrapes real-time patient data from BV Bình Dân EMR system
// URL: https://emr.com.vn:83/DienBienLamSang/Index1
// Auto-refreshes every 5 minutes

const EMR = {
    url: 'https://emr.com.vn:83/DienBienLamSang/Index1',
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    _timer: null,
    _lastData: null,
    _lastFetch: null,
    _status: 'idle', // idle | loading | success | error

    // Parse HTML and extract patient data from EMR table
    parseHTML(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const rows = doc.querySelectorAll('table tbody tr');

        const patients = [];
        rows.forEach(tr => {
            const cells = tr.querySelectorAll('td');
            if (cells.length < 4) return;

            const stt = cells[0]?.innerText?.trim();
            const maHoTen = cells[1]?.innerHTML || '';
            const ngayVao = cells[2]?.innerText?.trim();
            const phong = cells[3]?.innerText?.trim();

            // Parse mã nhập viện and họ tên from "26014824<br>Lê Mạnh Tuấn"
            const parts = maHoTen.split(/<br\s*\/?>/i);
            const maNhapVien = parts[0]?.replace(/<[^>]*>/g, '').trim() || '';
            const hoTen = parts[1]?.replace(/<[^>]*>/g, '').trim() || '';

            patients.push({
                stt: parseInt(stt) || 0,
                maNhapVien,
                hoTen,
                ngayVao,
                phong
            });
        });

        return patients;
    },

    // Filter: exclude patients in "CC" rooms
    getDepartmentPatients(allPatients) {
        return allPatients.filter(p =>
            !p.phong.toUpperCase().includes('CC') &&
            !p.phong.toUpperCase().startsWith('CC')
        );
    },

    getCCPatients(allPatients) {
        return allPatients.filter(p =>
            p.phong.toUpperCase().includes('CC') ||
            p.phong.toUpperCase().startsWith('CC')
        );
    },

    // Group patients by room
    getByRoom(patients) {
        const rooms = {};
        patients.forEach(p => {
            if (!rooms[p.phong]) rooms[p.phong] = [];
            rooms[p.phong].push(p);
        });
        return rooms;
    },

    // Fetch data from EMR (try proxy first, then direct)
    async fetchData() {
        this._status = 'loading';
        try {
            let html = '';

            // Try proxy endpoint first (when served via node server.js)
            const isHTTP = window.location.protocol.startsWith('http');
            const proxyUrl = isHTTP ? '/api/emr' : null;

            if (proxyUrl) {
                try {
                    const proxyRes = await fetch(proxyUrl);
                    if (proxyRes.status === 401) {
                        const info = await proxyRes.json().catch(() => ({}));
                        this._status = 'auth-required';
                        this._loginUrl = info.loginUrl || '/emr-login';
                        console.warn('[EMR] Session expired. Login at:', this._loginUrl);
                        window.dispatchEvent(new CustomEvent('emr-data-error', { detail: 'auth-required' }));
                        return null;
                    }
                    if (proxyRes.ok) {
                        html = await proxyRes.text();
                    }
                } catch (e) {
                    // Proxy not available, try direct
                }
            }

            // Fallback: try direct fetch (works if CORS is allowed)
            if (!html) {
                const response = await fetch(this.url, {
                    credentials: 'include',
                    mode: 'cors',
                    headers: { 'Accept': 'text/html' }
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                html = await response.text();
            }

            if (!html || html.length < 100) throw new Error('Empty response');
            const allPatients = this.parseHTML(html);

            this._lastData = {
                all: allPatients,
                department: this.getDepartmentPatients(allPatients),
                cc: this.getCCPatients(allPatients),
                byRoom: this.getByRoom(this.getDepartmentPatients(allPatients)),
                totalAll: allPatients.length,
                totalDept: this.getDepartmentPatients(allPatients).length,
                totalCC: this.getCCPatients(allPatients).length,
                fetchTime: new Date()
            };

            this._lastFetch = new Date();
            this._status = 'success';
            console.log(`[EMR] Fetched ${allPatients.length} patients (${this._lastData.totalDept} dept, ${this._lastData.totalCC} CC)`);

            // Dispatch event for UI updates
            window.dispatchEvent(new CustomEvent('emr-data-updated', { detail: this._lastData }));
            return this._lastData;
        } catch (err) {
            this._status = 'error';
            console.warn('[EMR] Fetch failed:', err.message);

            // If CORS error, try no-cors (won't get body but signals issue)
            if (err.message.includes('CORS') || err.message.includes('NetworkError') || err.name === 'TypeError') {
                console.info('[EMR] CORS blocked. The app needs to be served via HTTP or use a CORS proxy.');
            }

            window.dispatchEvent(new CustomEvent('emr-data-error', { detail: err.message }));
            return null;
        }
    },

    // Start auto-refresh
    startAutoRefresh() {
        this.stopAutoRefresh();
        this.fetchData(); // immediate first fetch
        this._timer = setInterval(() => this.fetchData(), this.refreshInterval);
        console.log('[EMR] Auto-refresh started (every 5 min)');
    },

    stopAutoRefresh() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    },

    // Get cached data (for rendering)
    getData() {
        return this._lastData;
    },

    getStatus() {
        return this._status;
    },

    getLastFetchTime() {
        return this._lastFetch;
    },

    // Format time since last fetch
    getTimeSinceUpdate() {
        if (!this._lastFetch) return 'Chưa cập nhật';
        const diff = Date.now() - this._lastFetch.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins === 0) return 'Vừa cập nhật';
        if (mins < 60) return `${mins} phút trước`;
        return `${Math.floor(mins / 60)}h${mins % 60}p trước`;
    }
};
