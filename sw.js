// ===== SERVICE WORKER — PTDTT Manager PWA =====
const CACHE_NAME = 'ptdtt-v31032310';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/variables.css',
    '/css/base.css',
    '/css/sidebar.css',
    '/css/dashboard.css',
    '/css/staff.css',
    '/css/tasks.css',
    '/css/plans.css',
    '/css/patients.css',
    '/css/schedule.css',
    '/css/surgery.css',
    '/css/surgery-stats.css',
    '/css/mobile.css',
    '/css/rooms.css',
    '/css/modal.css',
    '/css/login.css',
    '/css/notifications.css',
    '/css/staff-tracking.css',
    '/css/toast.css',
    '/css/charts.css',
    '/css/search.css',
    '/css/onboarding.css',
    '/js/data.js',
    '/js/store.js',
    '/js/auth.js',
    '/js/utils.js',
    '/js/dashboard.js',
    '/js/staff.js',
    '/js/staff-tracking.js',
    '/js/tasks.js',
    '/js/plans.js',
    '/js/patients.js',
    '/js/schedule.js',
    '/js/surgery.js',
    '/js/emr.js',
    '/js/surgery-stats.js',
    '/js/rooms.js',
    '/js/notifications.js',
    '/js/search.js',
    '/js/onboarding.js',
    '/js/app.js',
    '/img/logo-khoa.jpg',
    '/img/icon-192.png',
    '/img/icon-512.png',
    '/manifest.json'
];

// Install: precache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate: remove old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(names =>
            Promise.all(
                names.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch: Network-first for API, Cache-first for static
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // API requests: Network first, fallback to cache
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/data')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache successful API responses
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, clone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Offline: serve from cache
                    return caches.match(event.request);
                })
        );
        return;
    }

    // ALL other requests: Network first, fallback to cache
    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then(cached => {
                    if (cached) return cached;
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});
