// ===== DATA STORE (localStorage + Server Sync) =====
const STORE_KEY = 'ptdtt_manager';
const DATA_VERSION = 7; // Increment this when SAMPLE data changes
const CLIENT_BUILD = 2004202110;

const Store = {
    _data: null,
    _serverAvailable: false,
    _deletedIds: new Set(),
    _dirtyCollections: new Set(),
    _hasLoadedServerOnce: false,
    _pendingSaveAfterSync: false,
    _syncingDirtyCollections: false,

    // Save to localStorage only (no server push) — used during init
    _saveLocal() {
        localStorage.setItem(STORE_KEY, JSON.stringify(this._data));
    },

    _clone(value) {
        if (value === undefined) return undefined;
        return JSON.parse(JSON.stringify(value));
    },

    _localDateStr(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

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
            this._saveLocal(); // Only localStorage, NOT server
            localStorage.removeItem('ptdtt_accounts');
            localStorage.removeItem('ptdtt_session');
        } else {
            this._data = parsed;
            if (!this._data.schedules) this._data.schedules = [];
            if (!this._data.nextIds.schedules) this._data.nextIds.schedules = 1;
            if (!this._data.notifications) this._data.notifications = [];
            if (!this._data.nextIds.notifications) this._data.nextIds.notifications = 1;
            if (!this._data.tasksTrash) this._data.tasksTrash = [];
            if (!this._data.nextIds.tasksTrash) this._data.nextIds.tasksTrash = 1;
            if (!this._data.staffStatuses) this._data.staffStatuses = [];
            if (!this._data.departedStaff) this._data.departedStaff = [];
            if (!this._data.disabledAccounts) this._data.disabledAccounts = [];
            // SHCM collections
            if (!this._data.shcmSchedule || this._data.shcmSchedule.length === 0) {
                this._data.shcmSchedule = typeof SAMPLE_SHCM !== 'undefined' ? JSON.parse(JSON.stringify(SAMPLE_SHCM)) : [];
                this._data.nextIds.shcmSchedule = (this._data.shcmSchedule.length || 0) + 1;
            }
            if (!this._data.nextIds.shcmSchedule) this._data.nextIds.shcmSchedule = (this._data.shcmSchedule.length || 0) + 1;
            if (!this._data.shcmSettings) {
                this._data.shcmSettings = [{ id: 1, defaultTime: '15:30', defaultDuration: '30m' }];
                this._data.nextIds.shcmSettings = 2;
            }
            if (!this._data.nextIds.shcmSettings) this._data.nextIds.shcmSettings = 2;
            SAMPLE_SCHEDULES.forEach(sample => {
                if (!this._data.schedules.find(s => s.weekKey === sample.weekKey)) {
                    const entry = JSON.parse(JSON.stringify(sample));
                    entry.id = this._data.nextIds.schedules++;
                    this._data.schedules.push(entry);
                }
            });
            this._saveLocal(); // Only localStorage, NOT server
        }

        // Load from server FIRST, then start polling
        this._syncFromServer();
        this._startPolling();
    },

    save() {
        localStorage.setItem(STORE_KEY, JSON.stringify(this._data));
        this._syncToServer();
    },

    saveCollections(collections) {
        const unique = [...new Set((collections || []).filter(Boolean))];
        localStorage.setItem(STORE_KEY, JSON.stringify(this._data));
        unique.forEach(collection => this._dirtyCollections.add(collection));
        this._queueDirtyCollectionsSync();
    },


    // ── Server sync with real-time polling ──
    _pollTimer: null,
    _serverVersion: null,
    _syncing: false,
    _saveDebounce: null,
    _collectionSaveDebounce: null,

    _mergeReports(localReports, serverReports) {
        const merged = new Map();
        const toTime = item => {
            const stamp = item?.updatedAt || item?.createdAt || item?._lastModified;
            const time = stamp ? new Date(stamp).getTime() : 0;
            return Number.isFinite(time) ? time : 0;
        };

        [...(serverReports || []), ...(localReports || [])].forEach(report => {
            if (!report || !report.date) return;
            const existing = merged.get(report.date);
            if (!existing || toTime(report) >= toTime(existing)) {
                merged.set(report.date, report);
            }
        });

        return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
    },

    _mergeById(localItems, serverItems) {
        const merged = new Map();
        [...(serverItems || []), ...(localItems || [])].forEach(item => {
            if (!item || item.id == null) return;
            merged.set(item.id, item);
        });
        return [...merged.values()].sort((a, b) => (a.id || 0) - (b.id || 0));
    },

    _normalizeShcmKey(item) {
        const title = (item?.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (title) return `title:${title}`;
        if (item?.presentDate) return `date:${item.presentDate}`;
        if (item?.id != null) return `id:${item.id}`;
        return null;
    },

    _mergeShcmSchedule(localItems, serverItems) {
        const merged = new Map();
        [...(serverItems || []), ...(localItems || [])].forEach(item => {
            const key = this._normalizeShcmKey(item);
            if (!key) return;
            merged.set(key, item);
        });
        return [...merged.values()].sort((a, b) => {
            const da = a?.presentDate || '';
            const db = b?.presentDate || '';
            if (da && db) return da.localeCompare(db);
            if (da || db) return da ? -1 : 1;
            return (a?.id || 0) - (b?.id || 0);
        });
    },

    _mergeSchedules(localItems, serverItems) {
        const merged = new Map();

        (localItems || []).forEach(item => {
            if (!item?.weekKey) return;
            merged.set(item.weekKey, item);
        });

        (serverItems || []).forEach(item => {
            if (!item?.weekKey) return;
            merged.set(item.weekKey, item);
        });

        return [...merged.values()].sort((a, b) => (a?.weekKey || '').localeCompare(b?.weekKey || ''));
    },

    _mergeServerIntoLocal(serverData) {
        const merged = JSON.parse(JSON.stringify(this._data));

        if (serverData && serverData.surgeries && serverData.surgeries.length > 0) {
            const localSurgeries = merged.surgeries || [];
            const localIds = new Set(localSurgeries.map(s => s.id));
            serverData.surgeries.forEach(s => {
                if (!localIds.has(s.id) && !this._deletedIds.has(s.id)) localSurgeries.push(s);
            });
            merged.surgeries = localSurgeries;
        }

        if (serverData && serverData.externalDoctors && serverData.externalDoctors.length > 0) {
            const localExt = merged.externalDoctors || [];
            const localExtIds = new Set(localExt.map(d => d.id));
            serverData.externalDoctors.forEach(d => {
                if (!localExtIds.has(d.id)) localExt.push(d);
            });
            merged.externalDoctors = localExt;
        }

        merged.reports16h = this._mergeReports(merged.reports16h, serverData?.reports16h);
        merged.reports7h = this._mergeReports(merged.reports7h, serverData?.reports7h);
        merged.schedules = this._mergeSchedules(merged.schedules, serverData?.schedules);
        merged.shcmSchedule = this._mergeShcmSchedule(merged.shcmSchedule, serverData?.shcmSchedule);
        merged.shcmSettings = this._mergeById(merged.shcmSettings, serverData?.shcmSettings);

        return merged;
    },

    _preserveDirtyCollections(serverData) {
        const nextData = this._clone(serverData) || {};
        if (nextData._version == null && this._data?._version != null) {
            nextData._version = this._data._version;
        }
        nextData.nextIds = { ...(nextData.nextIds || {}) };

        this._dirtyCollections.forEach(collection => {
            if (Object.prototype.hasOwnProperty.call(this._data || {}, collection)) {
                nextData[collection] = this._clone(this._data[collection]);
            }
            if (Object.prototype.hasOwnProperty.call(this._data?.nextIds || {}, collection)) {
                nextData.nextIds[collection] = this._data.nextIds[collection];
            }
        });

        return nextData;
    },

    // Cache-busting: prevent browser/proxy from caching API calls
    _api(url, opts) {
        const sep = url.includes('?') ? '&' : '?';
        if (!opts) opts = {};
        if (!opts.headers) opts.headers = {};
        opts.headers['X-Client-Build'] = String(CLIENT_BUILD);
        // Inject JWT Bearer token for authentication
        const token = (typeof Auth !== 'undefined') ? Auth.getToken() : null;
        if (token) {
            opts.headers['Authorization'] = 'Bearer ' + token;
        }
        // Inject X-User header for audit logging
        if (opts.method === 'PUT' || opts.method === 'DELETE' || opts.method === 'POST') {
            const session = (typeof Auth !== 'undefined') ? Auth.getSession() : null;
            opts.headers['X-User'] = session ? session.username : 'anonymous';
        }
        return fetch(url + sep + '_t=' + Date.now(), opts).then(response => {
            // Handle 401 Unauthorized — token expired or invalid
            if (response.status === 401 && typeof Auth !== 'undefined') {
                console.warn('[Store] 401 Unauthorized — logging out');
                Auth.logout();
                if (typeof App !== 'undefined' && App.renderLogin) {
                    App.renderLogin();
                }
                throw new Error('Unauthorized');
            }
            if (response.status === 409) {
                console.warn('[Store] 409 Conflict — stale client build, forcing reload');
                if (typeof Toast !== 'undefined') {
                    Toast.error('Phiên bản trang đã cũ. Đang tải lại để tránh ghi đè dữ liệu...');
                }
                setTimeout(() => window.location.reload(), 1200);
                throw new Error('StaleClient');
            }
            return response;
        });
    },

    _syncToServer() {
        if (this._saveDebounce) clearTimeout(this._saveDebounce);
        this._saveDebounce = setTimeout(() => {
            if (!this._hasLoadedServerOnce) {
                this._pendingSaveAfterSync = true;
                if (!this._syncing) this._syncFromServer(true);
                console.log('[Store] ⏳ Delaying push until initial server sync completes');
                return;
            }

            // GET-merge-PUT: fetch server data first, merge surgeries, then push
            this._api('/api/data').then(r => r.json()).then(serverData => {
                const merged = this._mergeServerIntoLocal(serverData);

                return this._api('/api/data', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(merged)
                });
            }).then(r => r.json()).then(res => {
                this._serverAvailable = true;
                if (res.version) this._serverVersion = res.version;
                // Clear deleted IDs after successful push
                this._deletedIds.clear();
                console.log('[Store] ✅ Merged & saved to server, version:', res.version);
            }).catch(() => { this._serverAvailable = false; });
        }, 300);
    },

    _queueDirtyCollectionsSync() {
        if (this._collectionSaveDebounce) clearTimeout(this._collectionSaveDebounce);
        this._collectionSaveDebounce = setTimeout(() => this._flushDirtyCollections(), 300);
    },

    async _flushDirtyCollections() {
        if (this._syncingDirtyCollections || !this._dirtyCollections.size) return;

        if (!this._hasLoadedServerOnce) {
            if (!this._syncing) this._syncFromServer(true);
            console.log('[Store] ⏳ Delaying collection push until initial server sync completes');
            return;
        }

        this._syncingDirtyCollections = true;
        let shouldRetry = false;

        try {
            const collections = [...this._dirtyCollections];

            for (const collection of collections) {
                const payload = JSON.stringify(this._data[collection] ?? []);

                try {
                    const response = await this._api(`/api/data/${encodeURIComponent(collection)}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: payload
                    });
                    await response.json();
                    this._serverAvailable = true;

                    if (JSON.stringify(this._data[collection] ?? []) === payload) {
                        this._dirtyCollections.delete(collection);
                    } else {
                        shouldRetry = true;
                    }

                    console.log(`[Store] ✅ Saved collection ${collection}`);
                } catch (e) {
                    if (e.message !== 'Unauthorized' && e.message !== 'StaleClient') {
                        this._serverAvailable = false;
                    }
                }
            }

            try {
                const versionResponse = await this._api('/api/data/version');
                const versionData = await versionResponse.json();
                if (versionData.version) this._serverVersion = versionData.version;
            } catch (_) { }
        } finally {
            this._syncingDirtyCollections = false;
            if (shouldRetry && this._serverAvailable) {
                this._queueDirtyCollectionsSync();
            }
        }
    },

    _syncFromServer(quiet) {
        if (this._syncing) return;
        this._syncing = true;
        this._api('/api/data').then(r => r.json()).then(serverData => {
            if (serverData && serverData._version) {
                // Remove any locally-deleted IDs from server data before applying
                if (this._deletedIds.size > 0 && serverData.surgeries) {
                    serverData.surgeries = serverData.surgeries.filter(s => !this._deletedIds.has(s.id));
                }
                const nextData = this._pendingSaveAfterSync
                    ? this._mergeServerIntoLocal(serverData)
                    : this._dirtyCollections.size
                        ? this._preserveDirtyCollections(serverData)
                        : serverData;
                const oldJson = JSON.stringify(this._data);
                const newJson = JSON.stringify(nextData);
                if (oldJson !== newJson) {
                    this._data = nextData;
                    localStorage.setItem(STORE_KEY, newJson);
                    if (!quiet) console.log('[Store] Synced from server ✅');
                    if (typeof App !== 'undefined' && App.renderCurrentPage) {
                        App.renderCurrentPage();
                    }
                }
                this._serverAvailable = true;
                this._hasLoadedServerOnce = true;
            }
            const shouldRetrySave = this._pendingSaveAfterSync;
            this._pendingSaveAfterSync = false;
            this._syncing = false;
            if (shouldRetrySave) this._syncToServer();
            if (this._dirtyCollections.size) this._queueDirtyCollectionsSync();
        }).catch(e => {
            if (e.message !== 'Unauthorized') {
                this._serverAvailable = false;
            }
            this._syncing = false;
            if (!quiet) console.log('[Store] Server not available, using localStorage');
        });
        // Also update version tracking
        this._api('/api/data/version').then(r => r.json()).then(v => {
            if (v.version) this._serverVersion = v.version;
        }).catch(() => { });
    },

    _startPolling() {
        if (this._pollTimer) clearInterval(this._pollTimer);
        this._pollTimer = setInterval(() => this._checkForUpdates(), 10000);
        // Sync immediately when user returns to this tab
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this._checkForUpdates();
        });
    },

    _checkForUpdates() {
        this._api('/api/data/version').then(r => r.json()).then(v => {
            if (!v.version) return;
            if (this._serverVersion === null) {
                // First check — just store the version
                this._serverVersion = v.version;
                return;
            }
            if (v.version !== this._serverVersion) {
                console.log('[Store] 🔄 Data changed on server! Syncing...');
                this._serverVersion = v.version;
                this._syncFromServer(true);
            }
        }).catch(() => { });
    },

    _stopPolling() {
        if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    },

    // Generic CRUD
    getAll(collection) { return this._data[collection] || []; },

    getById(collection, id) {
        return this._data[collection]?.find(item => item.id === id);
    },

    replaceCollection(collection, items) {
        this._data[collection] = items;
        return this._data[collection];
    },

    updateLocal(collection, id, updates) {
        const idx = this._data[collection]?.findIndex(item => item.id === id);
        if (idx == null || idx === -1) return null;
        this._data[collection][idx] = { ...this._data[collection][idx], ...updates };
        return this._data[collection][idx];
    },

    _buildStaffStatusSummary(staffId, dateStr) {
        const entries = (this._data?.staffStatuses || []).filter(e => e.staffId === staffId);
        const target = entries.find(e => e.date === dateStr && e.status && e.status !== 'active');

        if (!target) {
            return { statusType: 'active', statusFrom: '', statusTo: '', statusNote: '' };
        }

        let from = dateStr;
        let to = dateStr;
        let cursor = new Date(dateStr);

        while (true) {
            cursor.setDate(cursor.getDate() - 1);
            const ds = this._localDateStr(cursor);
            const entry = entries.find(e => e.date === ds && e.status === target.status);
            if (!entry) break;
            from = ds;
        }

        cursor = new Date(dateStr);
        while (true) {
            cursor.setDate(cursor.getDate() + 1);
            const ds = this._localDateStr(cursor);
            const entry = entries.find(e => e.date === ds && e.status === target.status);
            if (!entry) break;
            to = ds;
        }

        return {
            statusType: target.status,
            statusFrom: from,
            statusTo: to,
            statusNote: target.note || ''
        };
    },

    syncStaffLegacyStatus(staffId, dateStr) {
        const targetDate = dateStr || this._localDateStr(new Date());
        return this.updateLocal('staff', staffId, this._buildStaffStatusSummary(staffId, targetDate));
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
        this._deletedIds.add(id);
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
        const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;
        return this._data.plans.filter(p => {
            const start = p.date;
            const end = p.endDate || p.date;
            // Plan overlaps month if: start <= monthEnd AND end >= monthStart
            return start <= monthEnd && end >= monthStart;
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
