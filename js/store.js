// ===== DATA STORE (localStorage + Server Sync) =====
const STORE_KEY = 'ptdtt_manager';
const PENDING_KEY = 'ptdtt_pending_v1';
const PENDING_ISOLATED_PREFIX = 'ptdtt_pending_v1:';
const REJECTED_DRAFTS_PREFIX = 'ptdtt_rejected_drafts_v1:';
const DATA_VERSION = 11; // Increment this when SAMPLE data changes (v11: fix staff ID calculation & resolve Châu/Sang ID collision)
const CLIENT_BUILD = 2610291102;

const COLLECTION_SYNC_ORDER = [
    'staff', 'departedStaff', 'externalDoctors', 'specialTeams', 'staffStatuses',
    'shcmSettings', 'shcmSchedule', 'plans',
    'surgeries', 'surgeriesTrash',
    'schedules', 'reports16h', 'reports7h',
    'tasks', 'tasksTrash', 'notifications',
    'conferences', 'patients', 'rooms', 'surgerySchedule'
];

const Store = {
    _data: null,
    _serverSyncedData: null,
    _serverAvailable: false,
    _deletedIds: new Set(),
    _dirtyCollections: new Set(),
    _pendingMeta: {},
    _mutationGen: {},
    _pendingOwnerKey: null,
    _pendingOwnerUsername: null,
    _pendingOwnerStaffId: null,
    _hasLoadedServerOnce: false,
    _pendingSaveAfterSync: false,
    _syncingDirtyCollections: false,
    _initialSyncPromise: null,
    _collectionSaveWaiters: [],
    _pollBound: false,
    _onlineBound: false,
    _lastEtag: null,         // P2.4: ETag từ lần GET /api/data gần nhất

    // Save to localStorage only (no server push) — used during init
    _saveLocal() {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(this._data));
        } catch (e) {
            console.warn('[Store] localStorage write failed in _saveLocal:', e.message);
        }
    },

    _clone(value) {
        if (value === undefined) return undefined;
        return JSON.parse(JSON.stringify(value));
    },

    _localDateStr(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    _getCurrentOwnerInfo() {
        if (typeof Auth === 'undefined' || !Auth.getSession) return null;
        const s = Auth.getSession();
        if (!s || !s.username) return null;
        const username = String(s.username).trim().toLowerCase();
        const staffId = Number(s.staffId || 0);
        return {
            ownerKey: `${username}:${staffId}`,
            ownerUsername: username,
            ownerStaffId: staffId
        };
    },

    _parsePendingEnvelope(raw) {
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return {
                    ownerKey: null,
                    ownerUsername: null,
                    ownerStaffId: null,
                    collections: parsed.filter(Boolean),
                    meta: {},
                    dataSnapshots: {},
                    nextIdSnapshots: {}
                };
            }
            if (parsed && typeof parsed === 'object') {
                return {
                    ownerKey: parsed.ownerKey || null,
                    ownerUsername: parsed.ownerUsername || null,
                    ownerStaffId: parsed.ownerStaffId != null ? Number(parsed.ownerStaffId) : null,
                    collections: Array.isArray(parsed.collections) ? parsed.collections.filter(Boolean) : [],
                    meta: (parsed.meta && typeof parsed.meta === 'object') ? parsed.meta : {},
                    dataSnapshots: (parsed.dataSnapshots && typeof parsed.dataSnapshots === 'object') ? parsed.dataSnapshots : {},
                    nextIdSnapshots: (parsed.nextIdSnapshots && typeof parsed.nextIdSnapshots === 'object') ? parsed.nextIdSnapshots : {}
                };
            }
        } catch (_) { }
        return null;
    },

    _persistPendingQueue() {
        const owner = this._getCurrentOwnerInfo();
        if (owner) {
            this._pendingOwnerKey = owner.ownerKey;
            this._pendingOwnerUsername = owner.ownerUsername;
            this._pendingOwnerStaffId = owner.ownerStaffId;
        }
        const collections = [...this._dirtyCollections];
        if (collections.length === 0) {
            try {
                localStorage.removeItem(PENDING_KEY);
                if (this._pendingOwnerKey) {
                    localStorage.removeItem(PENDING_ISOLATED_PREFIX + this._pendingOwnerKey);
                }
            } catch (_) {}
            return;
        }

        // Lightweight metadata envelope without duplicating full datasets into localStorage
        // Note: Full baseItems and uncommitted data are preserved in memory (this._pendingMeta & this._data)
        // and STORE_KEY already holds the latest local data.
        const cleanMeta = {};
        const nextIdSnapshots = {};
        collections.forEach(col => {
            if (this._pendingMeta?.[col]) {
                const m = this._pendingMeta[col];
                cleanMeta[col] = {
                    gen: m.gen,
                    clientMutationId: m.clientMutationId,
                    baseRevision: m.baseRevision,
                    updatedAt: m.updatedAt
                };
            }
            if (this._data?.nextIds && Object.prototype.hasOwnProperty.call(this._data.nextIds, col)) {
                nextIdSnapshots[col] = this._data.nextIds[col];
            }
        });

        const envelope = {
            ownerKey: this._pendingOwnerKey || null,
            ownerUsername: this._pendingOwnerUsername || null,
            ownerStaffId: this._pendingOwnerStaffId != null ? this._pendingOwnerStaffId : null,
            collections,
            meta: cleanMeta,
            nextIdSnapshots,
            updatedAt: Date.now()
        };

        try {
            const serialized = JSON.stringify(envelope);
            localStorage.setItem(PENDING_KEY, serialized);
        } catch (quotaErr) {
            console.warn('[Store] LocalStorage quota reached in _persistPendingQueue (ignoring):', quotaErr.message);
        }
    },

    _saveRejectedDraft(collection, reason, rejectedItems, serverItems) {
        const owner = this._getCurrentOwnerInfo();
        const ownerKey = owner ? owner.ownerKey : (this._pendingOwnerKey || 'anonymous:0');
        const storageKey = REJECTED_DRAFTS_PREFIX + ownerKey;
        let list = [];
        try {
            const existing = localStorage.getItem(storageKey);
            if (existing) list = JSON.parse(existing);
            if (!Array.isArray(list)) list = [];
        } catch (_) { list = []; }
        list.push({
            collection,
            reason: String(reason || 'Rejected'),
            rejectedItems: this._clone(rejectedItems),
            serverItems: this._clone(serverItems),
            timestamp: new Date().toISOString()
        });
        if (list.length > 20) list = list.slice(-20);
        localStorage.setItem(storageKey, JSON.stringify(list));
    },

    reconcilePendingForSession() {
        const currentOwner = this._getCurrentOwnerInfo();
        if (!currentOwner) return;

        const rawActive = localStorage.getItem(PENDING_KEY);
        const activeEnv = this._parsePendingEnvelope(rawActive);

        if (activeEnv && activeEnv.collections.length > 0) {
            if (!activeEnv.ownerKey) {
                // Bind unowned pending queue to current session
                activeEnv.ownerKey = currentOwner.ownerKey;
                activeEnv.ownerUsername = currentOwner.ownerUsername;
                activeEnv.ownerStaffId = currentOwner.ownerStaffId;
                this._pendingOwnerKey = currentOwner.ownerKey;
                this._pendingOwnerUsername = currentOwner.ownerUsername;
                this._pendingOwnerStaffId = currentOwner.ownerStaffId;
                this._persistPendingQueue();
            } else if (activeEnv.ownerKey !== currentOwner.ownerKey) {
                // Different user logged in (A -> B): isolate A's pending queue and revert A's unpushed local edits
                const snapshots = activeEnv.dataSnapshots || {};
                const nextIdSnaps = activeEnv.nextIdSnapshots || {};
                activeEnv.collections.forEach(col => {
                    if (!snapshots[col] && this._data && Object.prototype.hasOwnProperty.call(this._data, col)) {
                        snapshots[col] = this._clone(this._data[col]);
                    }
                    if (this._pendingMeta?.[col]?.baseItems && this._data) {
                        this._data[col] = this._clone(this._pendingMeta[col].baseItems);
                    } else if (this._serverSyncedData && Object.prototype.hasOwnProperty.call(this._serverSyncedData, col)) {
                        this._data[col] = this._clone(this._serverSyncedData[col]);
                    }
                });
                activeEnv.dataSnapshots = snapshots;
                activeEnv.nextIdSnapshots = nextIdSnaps;
                localStorage.setItem(PENDING_ISOLATED_PREFIX + activeEnv.ownerKey, JSON.stringify(activeEnv));
                localStorage.removeItem(PENDING_KEY);
                this._dirtyCollections.clear();
                this._pendingMeta = {};
                this._saveLocal();
            }
        }

        // Check if currentOwner has an isolated queue to restore (B -> A)
        const isolatedRaw = localStorage.getItem(PENDING_ISOLATED_PREFIX + currentOwner.ownerKey);
        const isolatedEnv = this._parsePendingEnvelope(isolatedRaw);
        if (isolatedEnv && isolatedEnv.ownerKey === currentOwner.ownerKey && isolatedEnv.collections.length > 0) {
            this._pendingOwnerKey = currentOwner.ownerKey;
            this._pendingOwnerUsername = currentOwner.ownerUsername;
            this._pendingOwnerStaffId = currentOwner.ownerStaffId;
            isolatedEnv.collections.forEach(col => {
                this._dirtyCollections.add(col);
                if (isolatedEnv.meta && isolatedEnv.meta[col]) {
                    this._pendingMeta[col] = this._clone(isolatedEnv.meta[col]);
                    const g = Number(isolatedEnv.meta[col].gen || 1);
                    if (!this._mutationGen[col] || this._mutationGen[col] < g) {
                        this._mutationGen[col] = g;
                    }
                }
                if (isolatedEnv.dataSnapshots && Array.isArray(isolatedEnv.dataSnapshots[col]) && this._data) {
                    this._data[col] = this._clone(isolatedEnv.dataSnapshots[col]);
                }
                if (isolatedEnv.nextIdSnapshots && isolatedEnv.nextIdSnapshots[col] != null && this._data?.nextIds) {
                    this._data.nextIds[col] = isolatedEnv.nextIdSnapshots[col];
                }
            });
            this._saveLocal();
            this._persistPendingQueue();
        } else {
            this._pendingOwnerKey = currentOwner.ownerKey;
            this._pendingOwnerUsername = currentOwner.ownerUsername;
            this._pendingOwnerStaffId = currentOwner.ownerStaffId;
        }
    },

    init() {
        const saved = localStorage.getItem(STORE_KEY);
        const parsed = saved ? JSON.parse(saved) : null;

        // Auto-reset if data version changed (new staff list, etc.)
        if (!parsed || parsed._version !== DATA_VERSION) {
            const maxStaffId = Math.max(0, ...SAMPLE_STAFF.map(s => s.id || 0));
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
                    staff: maxStaffId + 1,
                    externalDoctors: 200,
                    tasks: Math.max(0, ...SAMPLE_TASKS.map(t => t.id || 0)) + 1,
                    plans: Math.max(0, ...SAMPLE_PLANS.map(p => p.id || 0)) + 1,
                    patients: Math.max(0, ...SAMPLE_PATIENTS.map(p => p.id || 0)) + 1,
                    schedules: Math.max(0, ...SAMPLE_SCHEDULES.map(s => s.id || 0)) + 1,
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
            if (!this._data.nextIds) this._data.nextIds = {};
            if (!this._data.nextIds.schedules) this._data.nextIds.schedules = 1;
            if (!this._data.notifications) this._data.notifications = [];
            if (!this._data.nextIds.notifications) this._data.nextIds.notifications = 1;
            if (!this._data.tasksTrash) this._data.tasksTrash = [];
            if (!this._data.nextIds.tasksTrash) this._data.nextIds.tasksTrash = 1;
            if (!this._data.surgeriesTrash) this._data.surgeriesTrash = [];
            if (!this._data.nextIds.surgeriesTrash) this._data.nextIds.surgeriesTrash = 1;
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

        this._serverSyncedData = this._clone(this._data);

        // Restore persistent pending queue across reload
        const env = this._parsePendingEnvelope(localStorage.getItem(PENDING_KEY));
        if (env && env.collections.length > 0) {
            this._pendingOwnerKey = env.ownerKey;
            this._pendingOwnerUsername = env.ownerUsername;
            this._pendingOwnerStaffId = env.ownerStaffId;
            this._pendingMeta = env.meta || {};
            env.collections.forEach(col => {
                this._dirtyCollections.add(col);
                const g = Number(this._pendingMeta[col]?.gen || 1);
                this._mutationGen[col] = Math.max(this._mutationGen[col] || 0, g);
                if (this._pendingMeta[col]?.baseItems && this._serverSyncedData) {
                    this._serverSyncedData[col] = this._clone(this._pendingMeta[col].baseItems);
                }
                if (env.dataSnapshots && Array.isArray(env.dataSnapshots[col]) && this._data) {
                    this._data[col] = this._clone(env.dataSnapshots[col]);
                }
            });
            this._saveLocal();
        }

        if (!this._onlineBound && typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('online', () => {
                if (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn() && this._dirtyCollections.size > 0) {
                    this._queueDirtyCollectionsSync();
                }
            });
            this._onlineBound = true;
        }
    },

    // Start server sync + polling. Safe to call multiple times.
    startAuthenticatedSync() {
        if (!this._data) this.init();
        this.reconcilePendingForSession();
        if (!this._initialSyncPromise) {
            this._initialSyncPromise = this._syncFromServer(true)
                .then(async () => {
                    this.reconcilePendingForSession();
                    if (this._dirtyCollections.size > 0) {
                        await this._flushDirtyCollections();
                    }
                })
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

    // Reset sync state on logout — isolates pending queue for current user instead of losing it
    resetForLogout() {
        this._stopPolling();
        if (this._dirtyCollections.size > 0) {
            this._persistPendingQueue();
            localStorage.removeItem(PENDING_KEY);
        }
        this._dirtyCollections.clear();
        this._pendingMeta = {};
        this._mutationGen = {};
        this._pendingOwnerKey = null;
        this._pendingOwnerUsername = null;
        this._pendingOwnerStaffId = null;
        this._hasLoadedServerOnce = false;
        this._serverVersion = null;
        this._serverRevisions = {};
        this._syncing = false;
        this._syncingDirtyCollections = false;
        this._initialSyncPromise = null;
        this._deletedIds.clear();
        this._pendingSaveAfterSync = false;
        this._lastEtag = null;           // P2.4: Reset ETag on logout
    },

    save() {
        localStorage.setItem(STORE_KEY, JSON.stringify(this._data));
        this._syncToServer();
    },

    _buildCollectionPayload(collection) {
        const meta = this._pendingMeta?.[collection] || {};
        const payload = {
            items: this._clone(this._data?.[collection] ?? [])
        };
        if (Object.prototype.hasOwnProperty.call(this._data?.nextIds || {}, collection)) {
            payload.nextId = this._data.nextIds[collection];
        }
        const rev = meta.baseRevision ?? this._serverRevisions?.[collection] ?? this._serverVersion;
        if (rev != null) {
            payload.baseRevision = rev;
        }
        if (Array.isArray(meta.baseItems)) {
            payload.baseItems = this._clone(meta.baseItems);
        }
        if (meta.clientMutationId) {
            payload.clientMutationId = meta.clientMutationId;
        }
        return payload;
    },

    saveCollections(collections) {
        const unique = [...new Set((collections || []).filter(Boolean))];
        if (!unique.length) return;
        const owner = this._getCurrentOwnerInfo();
        if (owner) {
            this._pendingOwnerKey = owner.ownerKey;
            this._pendingOwnerUsername = owner.ownerUsername;
            this._pendingOwnerStaffId = owner.ownerStaffId;
        }
        unique.forEach(collection => {
            const nextGen = (this._mutationGen[collection] || 0) + 1;
            this._mutationGen[collection] = nextGen;
            const existingMeta = this._pendingMeta[collection];
            const baseItems = existingMeta && Array.isArray(existingMeta.baseItems)
                ? existingMeta.baseItems
                : this._clone(this._serverSyncedData?.[collection] ?? []);
            const baseRevision = existingMeta && existingMeta.baseRevision != null
                ? existingMeta.baseRevision
                : (this._serverRevisions?.[collection] ?? this._serverVersion ?? null);
            this._pendingMeta[collection] = {
                gen: nextGen,
                clientMutationId: `mut_${Date.now()}_${nextGen}_${Math.random().toString(36).slice(2, 7)}`,
                baseRevision,
                baseItems,
                updatedAt: Date.now()
            };
            this._dirtyCollections.add(collection);
        });
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(this._data));
        } catch (e) {
            console.warn('[Store] localStorage write failed in saveCollections:', e.message);
        }
        this._persistPendingQueue();
        return this._queueDirtyCollectionsSync();
    },


    // ── Server sync with real-time polling ──
    _pollTimer: null,
    _serverVersion: null,
    _serverRevisions: {},
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
        [...(localItems || []), ...(serverItems || [])].forEach(item => {
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
                let detail = null;
                try { detail = await response.clone().json(); } catch (_) { }
                if (detail && detail.code === 'DATA_CONFLICT') {
                    const conflictErr = new Error(detail.error || 'Xung đột dữ liệu với máy chủ');
                    conflictErr.status = 409;
                    conflictErr.code = 'DATA_CONFLICT';
                    conflictErr.detail = detail;
                    throw conflictErr;
                }
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
                error.code = detail?.code || null;
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

    _orderedDirtyCollections() {
        const dirty = [...this._dirtyCollections];
        return dirty.sort((a, b) => {
            const ia = COLLECTION_SYNC_ORDER.indexOf(a);
            const ib = COLLECTION_SYNC_ORDER.indexOf(b);
            const oa = ia === -1 ? 999 : ia;
            const ob = ib === -1 ? 999 : ib;
            return oa - ob;
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
            const collections = this._orderedDirtyCollections();

            for (const collection of collections) {
                const sentGen = this._mutationGen[collection] || this._pendingMeta[collection]?.gen || 1;
                const payloadObj = this._buildCollectionPayload(collection);
                const payload = JSON.stringify(payloadObj);

                try {
                    const response = await this._api(`/api/data/${encodeURIComponent(collection)}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: payload
                    });
                    const result = await response.json();
                    this._serverAvailable = true;
                    if (result.version) this._serverVersion = result.version;
                    if (result.revision != null) {
                        if (!this._serverRevisions) this._serverRevisions = {};
                        this._serverRevisions[collection] = result.revision;
                    }
                    if (Array.isArray(result.items)) {
                        if (!this._serverSyncedData) this._serverSyncedData = {};
                        this._serverSyncedData[collection] = this._clone(result.items);
                    }

                    const currentGen = this._mutationGen[collection] || sentGen;
                    if (currentGen === sentGen) {
                        if (Array.isArray(result.items) && this._data) {
                            this._data[collection] = this._clone(result.items);
                        }
                        if (result.nextId != null && this._data?.nextIds) {
                            this._data.nextIds[collection] = result.nextId;
                        }
                        this._dirtyCollections.delete(collection);
                        delete this._pendingMeta[collection];
                        this._saveLocal();
                        this._persistPendingQueue();
                    } else {
                        // Newer local mutation occurred while PUT was in flight: rebase onto result
                        if (this._pendingMeta[collection]) {
                            this._pendingMeta[collection].baseRevision = result.revision ?? result.version ?? this._serverVersion;
                            if (Array.isArray(result.items)) {
                                this._pendingMeta[collection].baseItems = this._clone(result.items);
                            }
                        }
                        if (result.nextId != null && this._data?.nextIds && this._data.nextIds[collection] < result.nextId) {
                            this._data.nextIds[collection] = result.nextId;
                        }
                        this._persistPendingQueue();
                        shouldRetry = true;
                    }

                    console.log(`[Store] ✅ Saved collection ${collection}`);
                } catch (e) {
                    if (e.message === 'Unauthorized' || e.message === 'StaleClient') {
                        continue;
                    }
                    const currentGen = this._mutationGen[collection] || sentGen;

                    if (e.status === 409 && e.code === 'DATA_CONFLICT') {
                        const serverItems = e.detail?.serverItems;
                        const serverVersion = e.detail?.serverVersion;
                        const serverRevision = e.detail?.serverRevision;
                        if (serverVersion) this._serverVersion = serverVersion;
                        if (serverRevision != null) {
                            if (!this._serverRevisions) this._serverRevisions = {};
                            this._serverRevisions[collection] = serverRevision;
                        }
                        if (Array.isArray(serverItems)) {
                            if (!this._serverSyncedData) this._serverSyncedData = {};
                            this._serverSyncedData[collection] = this._clone(serverItems);
                        }
                        this._saveRejectedDraft(collection, e.message || 'DATA_CONFLICT', payloadObj.items, serverItems);
                        if (currentGen === sentGen) {
                            if (Array.isArray(serverItems) && this._data) {
                                this._data[collection] = this._clone(serverItems);
                            }
                            this._dirtyCollections.delete(collection);
                            delete this._pendingMeta[collection];
                            this._saveLocal();
                            this._persistPendingQueue();
                            if (typeof App !== 'undefined' && App.renderCurrentPage) {
                                App.renderCurrentPage();
                            }
                        } else {
                            // Newer draft exists: rebase onto latest server snapshot and retry
                            if (this._pendingMeta[collection]) {
                                this._pendingMeta[collection].baseRevision = serverRevision ?? serverVersion ?? this._serverVersion;
                                if (Array.isArray(serverItems)) {
                                    this._pendingMeta[collection].baseItems = this._clone(serverItems);
                                }
                            }
                            this._persistPendingQueue();
                            shouldRetry = true;
                        }
                        errors.push({ collection, error: e, message: e.message || 'Xung đột dữ liệu' });
                        this._notifySyncError(`Xung đột dữ liệu ${collection}: ${e.message}`);
                        continue;
                    }

                    const permanent = [400, 403, 404].includes(e.status);
                    if (permanent) {
                        const cleanItems = this._serverSyncedData?.[collection];
                        this._saveRejectedDraft(collection, e.message || `HTTP ${e.status}`, payloadObj.items, cleanItems);
                        if (currentGen === sentGen) {
                            if (Array.isArray(cleanItems) && this._data) {
                                this._data[collection] = this._clone(cleanItems);
                            }
                            this._dirtyCollections.delete(collection);
                            delete this._pendingMeta[collection];
                            this._saveLocal();
                            this._persistPendingQueue();
                            if (typeof App !== 'undefined' && App.renderCurrentPage) {
                                App.renderCurrentPage();
                            }
                        } else {
                            // Newer draft exists: rebase baseItems onto clean server state and retry
                            if (this._pendingMeta[collection] && Array.isArray(cleanItems)) {
                                this._pendingMeta[collection].baseItems = this._clone(cleanItems);
                            }
                            this._persistPendingQueue();
                            shouldRetry = true;
                        }
                        errors.push({ collection, error: e, message: e.message || 'Lỗi lưu dữ liệu' });
                        this._notifySyncError(`Không thể lưu ${collection}: ${e.message}`);
                        continue;
                    }

                    // Transient / offline / 5xx error: preserve in pending queue
                    this._serverAvailable = false;
                    this._persistPendingQueue();
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
                if (serverData._revision) {
                    this._serverVersion = serverData._revision;
                }
                if (serverData._revisions && typeof serverData._revisions === 'object') {
                    this._serverRevisions = { ...(this._serverRevisions || {}), ...serverData._revisions };
                }
                this._serverSyncedData = this._clone(serverData);

                // Ensure any pending collection without baseRevision/baseItems gets anchored to first server snapshot if not yet set
                this._dirtyCollections.forEach(col => {
                    if (this._pendingMeta[col]) {
                        const colRev = this._serverRevisions?.[col] ?? this._serverVersion;
                        if (this._pendingMeta[col].baseRevision == null && colRev != null) {
                            this._pendingMeta[col].baseRevision = colRev;
                        }
                        if (!Array.isArray(this._pendingMeta[col].baseItems) && Array.isArray(serverData[col])) {
                            this._pendingMeta[col].baseItems = this._clone(serverData[col]);
                        }
                    }
                });

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
                    if (typeof App !== 'undefined' && App.updateNavVisibility) {
                        App.updateNavVisibility();
                    }
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
            if (this._dirtyCollections.size > 0 && !this._syncingDirtyCollections) {
                this._flushDirtyCollections().catch(() => { });
            }
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

    // Generic CRUD (excludes synthetic [TEST] sandbox surgeries from global KPIs/stats/reports)
    getAll(collection) {
        const arr = this._data[collection] || [];
        if (collection === 'surgeries' || collection === 'surgeriesTrash') {
            return arr.filter(r => !r?.isTestSandboxCase);
        }
        return arr;
    },

    // Trả về nhân sự đã bắt đầu làm việc (startDate <= hôm nay, hoặc không có startDate)
    getActiveStaff(referenceDate) {
        const today = referenceDate || new Date().toISOString().slice(0, 10);
        return (this._data['staff'] || []).filter(s => !s.startDate || s.startDate <= today);
    },

    _canMutateSurgeries() {
        if (typeof Auth === 'undefined' || !Auth.getSession) return false;
        const s = Auth.getSession();
        if (!s) return false;
        if (s.isAdmin || s.isSuperAdmin) return true;
        const role = String(s.role || '');
        return role.includes('Bác sĩ') || role.includes('Trưởng khoa') || role.includes('Phó trưởng khoa');
    },

    cleanSurgeriesTrash(maxDays = 7) {
        const trash = this._data?.surgeriesTrash || [];
        if (trash.length === 0) return [];
        const now = new Date();
        const valid = [];
        for (const item of trash) {
            if (!item || typeof item !== 'object') continue;
            const deletedAt = new Date(item.deletedAt);
            const diffDays = (now - deletedAt) / (1000 * 60 * 60 * 24);
            if (!Number.isFinite(diffDays) || diffDays <= maxDays) {
                valid.push(item);
            }
        }
        return valid;
    },

    getStaffName(id) {
        if (!id) return '';
        const s = this.getById('staff', id);
        return s ? s.name : '';
    },

    getById(collection, id) {
        return this._data[collection]?.find(item => String(item.id) === String(id));
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
        if (!this._data.nextIds) this._data.nextIds = {};
        const maxExisting = Math.max(
            0,
            ...(this._data[collection] || []).map(i => parseInt(i?.id) || 0),
            ...(collection === 'staff' ? (this._data.departedStaff || []).map(i => parseInt(i?.id) || 0) : [])
        );
        if (!this._data.nextIds[collection] || this._data.nextIds[collection] <= maxExisting) {
            this._data.nextIds[collection] = maxExisting + 1;
        }
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
        localStorage.removeItem(PENDING_KEY);
        this._dirtyCollections.clear();
        this._pendingMeta = {};
        this._mutationGen = {};
        this.init();
    }
};
