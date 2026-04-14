// ===== EMR PATIENT DATA FETCHER =====
// Receives pre-parsed JSON from server (server handles HTML scraping + caching)
// Auto-refreshes every 2 minutes
// Falls back to localStorage cache for instant display

const EMR = {
    refreshInterval: 2 * 60 * 1000, // 2 minutes (matches server cache TTL)
    _timer: null,
    _lastData: null,
    _lastFetch: null,
    _status: 'idle', // idle | loading | success | error | auth-required

    // Fetch pre-parsed JSON from server proxy (no more client-side HTML parsing)
    async fetchData() {
        this._status = 'loading';
        try {
            const proxyRes = await fetch('/api/emr');

            if (proxyRes.status === 401) {
                const info = await proxyRes.json().catch(() => ({}));
                this._status = 'auth-required';
                this._loginUrl = info.loginUrl || '/emr-login';
                console.warn('[EMR] Session expired. Login at:', this._loginUrl);
                window.dispatchEvent(new CustomEvent('emr-data-error', { detail: 'auth-required' }));
                return null;
            }

            if (!proxyRes.ok) {
                const err = await proxyRes.json().catch(() => ({ error: 'Unknown' }));
                throw new Error(err.error || `HTTP ${proxyRes.status}`);
            }

            const data = await proxyRes.json();
            if (!data || !data.totalAll && data.totalAll !== 0) throw new Error('Invalid response');

            this._lastData = data;
            this._lastFetch = new Date();
            this._status = 'success';

            // Persist to localStorage for instant display on next load
            try {
                localStorage.setItem('emr_cache', JSON.stringify(data));
                localStorage.setItem('emr_cache_time', this._lastFetch.toISOString());
            } catch (e) { /* quota exceeded — ignore */ }

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

    // Load cached data from localStorage instantly (before network fetch)
    _loadLocalCache() {
        try {
            const cached = localStorage.getItem('emr_cache');
            const cachedTime = localStorage.getItem('emr_cache_time');
            if (cached && cachedTime) {
                this._lastData = JSON.parse(cached);
                this._lastFetch = new Date(cachedTime);
                this._status = 'success';
                console.log(`[EMR] Loaded localStorage cache (${this._lastData.totalDept} dept, from ${this.getTimeSinceUpdate()})`);
                window.dispatchEvent(new CustomEvent('emr-data-updated', { detail: this._lastData }));
                return true;
            }
        } catch (e) { /* corrupt cache — ignore */ }
        return false;
    },

    // Start auto-refresh
    startAutoRefresh() {
        this.stopAutoRefresh();
        // 1. Show cached data instantly
        this._loadLocalCache();
        // 2. Fetch fresh data from server
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
