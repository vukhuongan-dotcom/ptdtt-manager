// ===== DATA STORE (localStorage + Server Sync) =====
const STORE_KEY = 'ptdtt_manager';
const DATA_VERSION = 10; // Increment this when SAMPLE data changes (v10: fix departedStaff sync & restore missing departed staff)
const CLIENT_BUILD = 2606062130;

const Store = {
    _data: null,
    _serverAvailable: false,
    _deletedIds: new Set(),
    _dirtyCollections: new Set(),
    _hasLoadedServerOnce: false,
    _pendingSaveAfterSync: false,
    _syncingDirtyCollections: false,
    _initialSyncPromise: null,
    _collectionSaveWaiters: [],
    _pollBound: false,
    _lastEtag: null,         // P2.4: ETag từ lần GET /api/data gần nhất

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
                conferences: [],
                nextIds: {
                    staff: SAMPLE_STAFF.length + 1,
                    externalDoctors: 200,
                    tasks: SAMPLE_TASKS.length + 1,
                    plans: SAMPLE_PLANS.length + 1,
                    patients: SAMPLE_PATIENTS.length + 1,
                    schedules: SAMPLE_SCHEDULES.length + 1,
                    conferences: 1,
                    reports16h: 1,
                    reports7h: 1
                }
            };
            this._saveLocal(); // Only localStorage, NOT server
            localStorage.removeItem('ptdtt_accounts');
            // NOTE: Do NOT remove ptdtt_session here — Auth manages session independently
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
            if (this._data.disabledAccounts) delete this._data.disabledAccounts;
            if (this._data.customPasswords) delete this._data.customPasswords;
            if (this._data.customAdmins) delete this._data.customAdmins;
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
            if (!this._data.conferences) this._data.conferences = [];
            if (!this._data.nextIds.conferences) {
                this._data.nextIds.conferences = Math.max(0, ...this._data.conferences.map(item => item?.id || 0)) + 1;
            }
            // Reports collections
            if (!this._data.reports16h) this._data.reports16h = [];
            if (!this._data.nextIds.reports16h) this._data.nextIds.reports16h = Math.max(0, ...this._data.reports16h.map(r => r?.id || 0)) + 1;
            if (!this._data.reports7h) this._data.reports7h = [];
            if (!this._data.nextIds.reports7h) this._data.nextIds.reports7h = Math.max(0, ...this._data.reports7h.map(r => r?.id || 0)) + 1;
            SAMPLE_SCHEDULES.forEach(sample => {
                if (!this._data.schedules.find(s => s.weekKey === sample.weekKey)) {
                    const entry = JSON.parse(JSON.stringify(sample));
                    entry.id = this._data.nextIds.schedules++;
                    this._data.schedules.push(entry);
                }
            });
            this._saveLocal(); // Only localStorage, NOT server
        }

        // Authenticated server sync is intentionally started by App after
        // the session is validated. Keeping init local-only avoids duplicate
        // sync races that can swallow edits made immediately after login.
    },

    // Start server sync + polling. Safe to call multiple times.
    startAuthenticatedSync() {
        if (!this._initialSyncPromise) {
            this._initialSyncPromise = this._syncFromServer(true)
                .catch(e => {
                    this._serverAvailable = false;
                    if (e.message !== 'Unauthorized' && e.message !== 'StaleClient') {
                        console.warn('[Store] Initial sync failed:', e.message);
                    }
                    return null;
                })
                .finally(() => { this._initialSyncPromise = null; });
        }
        this._startPolling();
        return this._initialSyncPromise;
    },

    // Reset sync state on logout — prevents stale data leaking to next session
    resetForLogout() {
        this._stopPolling();
        this._hasLoadedServerOnce = false;
        this._serverVersion = null;
        this._syncing = false;
        this._syncingDirtyCollections = false;
        this._initialSyncPromise = null;
        this._dirtyCollections.clear();
        this._deletedIds.clear();
        this._pendingSaveAfterSync = false;
        this._lastEtag = null;           // P2.4: Reset ETag on logout
    },

    save() {
        localStorage.setItem(STORE_KEY, JSON.stringify(this._data));
        this._syncToServer();
    },

    _buildCollectionPayload(collection) {
        const payload = {
            items: this._clone(this._data?.[collection] ?? [])
        };
        if (Object.prototype.hasOwnProperty.call(this._data?.nextIds || {}, collection)) {
            payload.nextId = this._data.nextIds[collection];
        }
        return payload;
    },

    saveCollections(collections) {
        const unique = [...new Set((collections || []).filter(Boolean))];
        if (!unique.length) return;
        localStorage.setItem(STORE_KEY, JSON.stringify(this._data));
        unique.forEach(collection => this._dirtyCollections.add(collection));
        return this._queueDirtyCollectionsSync();
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
    _notifySyncError(message) {
        console.warn('[Store] Sync error:', message);
        if (typeof Toast !== 'undefined') Toast.error(message);
    },

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
        // P2.4: Không cache-bust /api/data — để ETag/304 hoạt động
        // Các route khác vẫn giữ ?_t= để tránh stale cache
        const isDataEndpoint = url === '/api/data' || url.endsWith('/api/data');
        const fetchUrl = isDataEndpoint ? url : (url + sep + '_t=' + Date.now());
        return fetch(fetchUrl, opts).then(async response => {
            // Handle 401 Unauthorized — token expired or invalid
            if (response.status === 401 && typeof Auth !== 'undefined') {
                console.warn('[Store] 401 Unauthorized — logging out');
                Auth.logout();
                if (typeof App !== 'undefined' && App.showLogin) {
                    App.showLogin();
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
            if (!response.ok) {
                let detail = null;
                try { detail = await response.clone().json(); } catch (_) { }
                const error = new Error(detail?.error || `HTTP ${response.status}`);
                error.status = response.status;
                error.detail = detail;
                throw error;
            }
            return response;
        });
    },

    _syncToServer() {
        if (this._saveDebounce) clearTimeout(this._saveDebounce);
        this._saveDebounce = setTimeout(() => {
            if (!this._hasLoadedServerOnce) {
                this._pendingSaveAfterSync = true;
                this.startAuthenticatedSync();
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
            }).catch(e => {
                this._serverAvailable = false;
                if (e.message !== 'Unauthorized' && e.message !== 'StaleClient') {
                    this._notifySyncError(`Không thể lưu dữ liệu lên server: ${e.message}`);
                }
            });
        }, 300);
    },

    _queueDirtyCollectionsSync() {
        if (this._collectionSaveDebounce) clearTimeout(this._collectionSaveDebounce);
        return new Promise(resolve => {
            this._collectionSaveWaiters.push(resolve);
            this._collectionSaveDebounce = setTimeout(async () => {
                let result;
                try {
                    result = await this._flushDirtyCollections();
                } catch (e) {
                    result = { ok: false, errors: [{ error: e, message: e.message || 'Lỗi lưu dữ liệu' }] };
                }
                const waiters = this._collectionSaveWaiters.splice(0);
                waiters.forEach(done => done(result || { ok: true, errors: [] }));
            }, 300);
        });
    },

    async _flushDirtyCollections() {
        if (this._syncingDirtyCollections) return { ok: true, pending: true, errors: [] };
        if (!this._dirtyCollections.size) return { ok: true, errors: [] };

        if (!this._hasLoadedServerOnce) {
            console.log('[Store] ⏳ Delaying collection push until initial server sync completes');
            await this.startAuthenticatedSync();
            if (!this._hasLoadedServerOnce) {
                return {
                    ok: false,
                    errors: [{ message: 'Chưa đồng bộ được dữ liệu server. Vui lòng thử lại sau vài giây.' }]
                };
            }
            return this._flushDirtyCollections();
        }

        this._syncingDirtyCollections = true;
        let shouldRetry = false;
        const errors = [];

        try {
            const collections = [...this._dirtyCollections];

            for (const collection of collections) {
                const payload = JSON.stringify(this._buildCollectionPayload(collection));

                try {
                    const response = await this._api(`/api/data/${encodeURIComponent(collection)}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: payload
                    });
                    const result = await response.json();
                    this._serverAvailable = true;
                    if (result.version) this._serverVersion = result.version;

                    if (JSON.stringify(this._buildCollectionPayload(collection)) === payload) {
                        this._dirtyCollections.delete(collection);
                    } else {
                        shouldRetry = true;
                    }

                    console.log(`[Store] ✅ Saved collection ${collection}`);
                } catch (e) {
                    if (e.message === 'Unauthorized' || e.message === 'StaleClient') {
                        continue;
                    }
                    this._serverAvailable = false;
                    const permanent = [400, 403, 404].includes(e.status);
                    if (!permanent) {
                        shouldRetry = true;
                    }
                    errors.push({ collection, error: e, message: e.message || 'Lỗi lưu dữ liệu' });
                    this._notifySyncError(`Chưa lưu được ${collection}: ${e.message}`);
                }
            }

            try {
                const versionResponse = await this._api('/api/data/version');
                const versionData = await versionResponse.json();
                if (versionData.version) this._serverVersion = versionData.version;
            } catch (_) { }
        } finally {
            this._syncingDirtyCollections = false;
            if (shouldRetry) {
                this._queueDirtyCollectionsSync();
            }
        }
        return { ok: errors.length === 0, errors };
    },

    _syncFromServer(quiet) {
        if (this._syncing) return this._initialSyncPromise || Promise.resolve();
        this._syncing = true;
        const syncPromise = this._api('/api/data', {
            headers: this._lastEtag ? { 'If-None-Match': this._lastEtag } : {}
        }).then(async r => {
            // P2.4: 304 Not Modified — data không đổi, dùng lại _data hiện tại
            if (r.status === 304) {
                if (!quiet) console.log('[Store] 304 Not Modified — server data unchanged ✅');
                this._serverAvailable = true;
                this._hasLoadedServerOnce = true;
                this._syncing = false;
                return;
            }
            // Lưu ETag để gửi lần sau
            const etag = r.headers.get('ETag');
            if (etag) this._lastEtag = etag;
            return r.json();
        }).then(serverData => {
            if (serverData === undefined) return; // 304 đã xử lý ở trên
            if (serverData && typeof serverData === 'object' && !Array.isArray(serverData)) {
                if (serverData._version == null && this._data?._version != null) {
                    serverData._version = this._data._version;
                }
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
        }).catch(e => {
            if (e.message !== 'Unauthorized') {
                this._serverAvailable = false;
            }
            this._syncing = false;
            if (!quiet) console.log('[Store] Server not available, using localStorage');
            if (e.message !== 'Unauthorized' && e.message !== 'StaleClient') {
                throw e;
            }
        });
        // Also update version tracking
        this._api('/api/data/version').then(r => r.json()).then(v => {
            if (v.version) this._serverVersion = v.version;
        }).catch(() => { });
        return syncPromise;
    },

    _startPolling() {
        if (this._pollTimer) clearInterval(this._pollTimer);
        this._pollTimer = setInterval(() => this._checkForUpdates(), 10000);
        // Sync immediately when user returns to this tab
        if (!this._pollBound) {
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
                    this._checkForUpdates();
                }
            });
            this._pollBound = true;
        }
    },

    _checkForUpdates() {
        this._api('/api/data/version').then(r => r.json()).then(v => {
            if (!v.version) return;
            if (this._serverVersion === null) {
                this._serverVersion = v.version;
                // First successful version check: if we never loaded server data,
                // do a full sync now (fixes post-login stale state)
                if (!this._hasLoadedServerOnce) {
                    console.log('[Store] 🔄 First version check after auth — syncing...');
                    this.startAuthenticatedSync();
                }
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

    // Trả về nhân sự đã bắt đầu làm việc (startDate <= hôm nay, hoặc không có startDate)
    getActiveStaff(referenceDate) {
        const today = referenceDate || new Date().toISOString().slice(0, 10);
        return (this._data['staff'] || []).filter(s => !s.startDate || s.startDate <= today);
    },



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
        this.saveCollections([collection]);
        return item;
    },

    update(collection, id, updates) {
        const idx = this._data[collection].findIndex(item => item.id === id);
        if (idx !== -1) {
            this._data[collection][idx] = { ...this._data[collection][idx], ...updates };
            this.saveCollections([collection]);
            return this._data[collection][idx];
        }
        return null;
    },

    remove(collection, id) {
        this._deletedIds.add(id);
        this._data[collection] = this._data[collection].filter(item => item.id !== id);
        this.saveCollections([collection]);
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
