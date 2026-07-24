// ===== SERVICE WORKER — PTDTT Manager PWA =====
const CACHE_NAME = 'ptdtt-v2607241010';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/app.bundle.css',  // P2.1: 24 CSS files bundled → 1 request
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
    '/js/reports.js',
    '/js/research.js',
    '/js/conferences.js',
    '/js/audit-log.js',
    '/js/app.js',
    '/img/logo-khoa.jpg',
    '/img/icon-192.png',
    '/img/icon-512.png',
    '/manifest.json'
];
const STATIC_ASSET_PATHS = new Set(STATIC_ASSETS);

function isCacheableStaticRequest(request, url) {
    if (request.method !== 'GET' || url.origin !== self.location.origin) return false;
    return STATIC_ASSET_PATHS.has(url.pathname);
}

// Install: precache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
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

// Fetch: Network only for API, cache only for static allowlist
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);

    // API requests: Network only — NEVER cache authenticated data
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/data')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Navigations: always prefer fresh HTML, fallback to the cached shell when offline
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('/index.html'))
        );
        return;
    }

    if (!isCacheableStaticRequest(event.request, url)) {
        event.respondWith(fetch(event.request));
        return;
    }

    if (url.search) {
        event.respondWith(
            fetch(event.request).then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            }).catch(() =>
                caches.match(event.request).then(cached => cached || caches.match(url.pathname))
            )
        );
        return;
    }

    event.respondWith(
        caches.match(url.pathname).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(url.pathname, clone);
                    });
                }
                return response;
            });
        }).catch(() => caches.match(url.pathname))
    );
});
