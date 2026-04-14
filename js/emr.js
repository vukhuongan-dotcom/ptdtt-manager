// ===== EMR PATIENT DATA FETCHER =====
// Dual-path: tries server proxy first (/api/emr), falls back to direct browser fetch
// Server proxy works when VPS can reach EMR; direct works on hospital network
// Auto-refreshes every 2 minutes with localStorage instant cache

const EMR = {
    url: 'https://emr.com.vn:83/DienBienLamSang/Index1',
    refreshInterval: 2 * 60 * 1000, // 2 minutes
    _timer: null,
    _lastData: null,
    _lastFetch: null,
    _status: 'idle', // idle | loading | success | error | auth-required

    // Parse HTML and extract patient data from EMR table (client-side fallback)
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

    // Build structured data from patient array
    _buildData(allPatients) {
        const department = allPatients.filter(p =>
            !p.phong.toUpperCase().includes('CC') &&
            !p.phong.toUpperCase().startsWith('CC')
        );
        const cc = allPatients.filter(p =>
            p.phong.toUpperCase().includes('CC') ||
            p.phong.toUpperCase().startsWith('CC')
        );
        const byRoom = {};
        department.forEach(p => {
            if (!byRoom[p.phong]) byRoom[p.phong] = [];
            byRoom[p.phong].push(p);
        });
        return {
            all: allPatients,
            department,
            cc,
            byRoom,
            totalAll: allPatients.length,
            totalDept: department.length,
            totalCC: cc.length,
            fetchTime: new Date().toISOString()
        };
    },

    // Fetch data: try server JSON proxy first, fallback to direct HTML scrape
    async fetchData() {
        this._status = 'loading';
        try {
            let data = null;

            // Path 1: Server proxy (returns pre-parsed JSON, cached)
            try {
                const proxyRes = await fetch('/api/emr');
                if (proxyRes.status === 401) {
                    this._status = 'auth-required';
                    window.dispatchEvent(new CustomEvent('emr-data-error', { detail: 'auth-required' }));
                    return null;
                }
                if (proxyRes.ok) {
                    const contentType = proxyRes.headers.get('content-type') || '';
                    if (contentType.includes('application/json')) {
                        const json = await proxyRes.json();
                        if (json && (json.totalAll > 0 || json.totalAll === 0) && !json.error) {
                            data = json;
                        }
                    } else {
                        // Server returned HTML (legacy or error) — parse client-side
                        const html = await proxyRes.text();
                        if (html && html.length > 100 && html.includes('<tbody>')) {
                            const patients = this.parseHTML(html);
                            if (patients.length > 0) data = this._buildData(patients);
                        }
                    }
                }
            } catch (e) {
                // Proxy not available or VPS can't reach EMR — try direct
                console.log('[EMR] Proxy unavailable, trying direct...');
            }

            // Path 2: Direct browser fetch (works on hospital network)
            if (!data) {
                try {
                    const response = await fetch(this.url, {
                        credentials: 'include',
                        mode: 'cors',
                        headers: { 'Accept': 'text/html' }
                    });
                    if (response.ok) {
                        const html = await response.text();
                        if (html && html.length > 100) {
                            const patients = this.parseHTML(html);
                            if (patients.length > 0) data = this._buildData(patients);
                        }
                    }
                } catch (e) {
                    // CORS blocked or network error
                    console.log('[EMR] Direct fetch failed:', e.message);
                }
            }

            if (!data) throw new Error('No data from any source');

            this._lastData = data;
            this._lastFetch = new Date();
            this._status = 'success';

            // Persist to localStorage for instant display on next load
            try {
                localStorage.setItem('emr_cache', JSON.stringify(data));
                localStorage.setItem('emr_cache_time', this._lastFetch.toISOString());
            } catch (e) { /* quota exceeded */ }

            console.log(`[EMR] Got ${data.totalAll} patients (${data.totalDept} dept, ${data.totalCC} CC)`);
            window.dispatchEvent(new CustomEvent('emr-data-updated', { detail: this._lastData }));
            return this._lastData;
        } catch (err) {
            this._status = 'error';
            console.warn('[EMR] Fetch failed:', err.message);
            window.dispatchEvent(new CustomEvent('emr-data-error', { detail: err.message }));
            return null;
        }
    },

    // Load cached data from localStorage instantly
    _loadLocalCache() {
        try {
            const cached = localStorage.getItem('emr_cache');
            const cachedTime = localStorage.getItem('emr_cache_time');
            if (cached && cachedTime) {
                this._lastData = JSON.parse(cached);
                this._lastFetch = new Date(cachedTime);
                this._status = 'success';
                console.log(`[EMR] Loaded localStorage cache (${this._lastData.totalDept} dept, ${this.getTimeSinceUpdate()})`);
                window.dispatchEvent(new CustomEvent('emr-data-updated', { detail: this._lastData }));
                return true;
            }
        } catch (e) { /* corrupt cache */ }
        return false;
    },

    // Start auto-refresh
    startAutoRefresh() {
        this.stopAutoRefresh();
        // 1. Show cached data instantly
        this._loadLocalCache();
        // 2. Fetch fresh data from server/direct
        this.fetchData();
        // 3. Auto-refresh every 2 min
        this._timer = setInterval(() => this.fetchData(), this.refreshInterval);
        console.log('[EMR] Auto-refresh started (every 2 min)');
    },

    stopAutoRefresh() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    },

    getData() { return this._lastData; },
    getStatus() { return this._status; },
    getLastFetchTime() { return this._lastFetch; },

    getTimeSinceUpdate() {
        if (!this._lastFetch) return 'Chưa cập nhật';
        const diff = Date.now() - this._lastFetch.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins === 0) return 'Vừa cập nhật';
        if (mins < 60) return `${mins} phút trước`;
        return `${Math.floor(mins / 60)}h${mins % 60}p trước`;
    }
};
