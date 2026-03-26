// ===== DATA STORE (localStorage + Server Sync) =====
const STORE_KEY = 'ptdtt_manager';
const DATA_VERSION = 7; // Increment this when SAMPLE data changes

const Store = {
    _data: null,
    _serverAvailable: false,

    init() {
        const saved = localStorage.getItem(STORE_KEY);
        const parsed = saved ? JSON.parse(saved) : null;

        // Auto-reset if data version changed (new staff list, etc.)
        if (!parsed || parsed._version !== DATA_VERSION) {
            this._data = {
                _version: DATA_VERSION,
                staff: [...SAMPLE_STAFF],
                externalDoctors: [...SAMPLE_EXTERNAL_DOCTORS],
                tasks: [...SAMPLE_TASKS],
                plans: [...SAMPLE_PLANS],
                patients: [...SAMPLE_PATIENTS],
                schedules: [...SAMPLE_SCHEDULES],
                nextIds: { staff: SAMPLE_STAFF.length + 1, externalDoctors: 200, tasks: SAMPLE_TASKS.length + 1, plans: SAMPLE_PLANS.length + 1, patients: SAMPLE_PATIENTS.length + 1, schedules: SAMPLE_SCHEDULES.length + 1 }
            };
            this.save();
            // Also clear old auth accounts so they regenerate from new staff
            localStorage.removeItem('ptdtt_accounts');
            localStorage.removeItem('ptdtt_session');
        } else {
            this._data = parsed;
            // Ensure schedules collection exists and seed sample data
            if (!this._data.schedules) this._data.schedules = [];
            if (!this._data.nextIds.schedules) this._data.nextIds.schedules = 1;
            // Merge sample schedules that don't already exist
            SAMPLE_SCHEDULES.forEach(sample => {
                if (!this._data.schedules.find(s => s.weekKey === sample.weekKey)) {
                    const entry = JSON.parse(JSON.stringify(sample));
                    entry.id = this._data.nextIds.schedules++;
                    this._data.schedules.push(entry);
                }
            });
            this.save();
        }

        // Try to load from server (async, non-blocking)
        this._syncFromServer();
    },

    save() {
        localStorage.setItem(STORE_KEY, JSON.stringify(this._data));
        this._syncToServer();
    },

    // ── Server sync ──
    _syncToServer() {
        fetch('/api/data', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this._data)
        }).then(() => { this._serverAvailable = true; })
          .catch(() => { this._serverAvailable = false; });
    },

    _syncFromServer() {
        fetch('/api/data').then(r => r.json()).then(serverData => {
            if (serverData && serverData._version) {
                // Server has data — use it if newer or same version
                this._data = serverData;
                localStorage.setItem(STORE_KEY, JSON.stringify(this._data));
                this._serverAvailable = true;
                console.log('[Store] Synced from server ✅');
            }
        }).catch(() => {
            this._serverAvailable = false;
            console.log('[Store] Server not available, using localStorage');
        });
    },

    // Generic CRUD
    getAll(collection) { return this._data[collection] || []; },

    getById(collection, id) {
        return this._data[collection]?.find(item => item.id === id);
    },

    add(collection, item) {
        item.id = this._data.nextIds[collection]++;
        this._data[collection].push(item);
        this.save();
        return item;
    },

    update(collection, id, updates) {
        const idx = this._data[collection].findIndex(item => item.id === id);
        if (idx !== -1) {
            this._data[collection][idx] = { ...this._data[collection][idx], ...updates };
            this.save();
            return this._data[collection][idx];
        }
        return null;
    },

    remove(collection, id) {
        this._data[collection] = this._data[collection].filter(item => item.id !== id);
        this.save();
    },

    // Specific queries
    getStaffByRole(role) {
        if (!role || role === 'all') return this._data.staff;
        return this._data.staff.filter(s => s.role.toLowerCase().includes(role.toLowerCase()));
    },

    getTasksByStatus(status) {
        return this._data.tasks.filter(t => t.status === status);
    },

    getPlansByMonth(year, month) {
        return this._data.plans.filter(p => {
            const d = new Date(p.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });
    },

    getPatientStats() {
        const patients = this._data.patients;
        return {
            total: patients.length,
            active: patients.filter(p => p.status === 'active').length,
            preOp: patients.filter(p => p.status === 'pre-op').length,
            postOp: patients.filter(p => p.status === 'post-op').length,
            discharged: patients.filter(p => p.status === 'discharged').length,
        };
    },

    resetData() {
        localStorage.removeItem(STORE_KEY);
        this.init();
    }
};
