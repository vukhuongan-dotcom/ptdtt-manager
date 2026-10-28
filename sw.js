// ===== SERVICE WORKER — PTDTT Manager PWA =====
const CACHE_NAME = 'ptdtt-v2610281755';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/app.bundle.css',  // P2.1: 25 CSS files bundled → 1 request
    '/js/data.js',
    '/js/store.js',
    '/js/auth.js',
    '/js/staff-photos.js',
    '/js/utils.js',
    '/js/dashboard.js',
    '/js/staff.js',
    '/js/staff-tracking.js',
    '/js/tasks.js',
    '/js/plans.js',
    '/js/patients.js',
    '/js/schedule.js',
    '/js/surgery.js',
    '/js/surgery-approval.js',
    '/js/emr.js',
    '/js/surgery-metrics.js',
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
    '/js/xlsx.full.min.js',
    '/js/html2canvas.min.js',
    '/js/chart.umd.min.js',
    '/img/logo-khoa.jpg',
    '/img/logo-mark.png',
    '/img/logo-symbol.png',
    '/img/icon-192.png',
    '/img/icon-512.png',
    '/img/icon-maskable-192.png',
    '/img/icon-maskable-512.png',
    '/img/apple-touch-icon.png',
    '/img/favicon.ico',
    '/img/favicon-16.png',
    '/img/favicon-32.png',
    '/img/favicon-48.png',
    '/manifest.json',
    '/fonts/be-vietnam-pro-latin-400-normal.woff2',
    '/fonts/be-vietnam-pro-latin-500-normal.woff2',
    '/fonts/be-vietnam-pro-latin-600-normal.woff2',
    '/fonts/be-vietnam-pro-latin-700-normal.woff2',
    '/fonts/be-vietnam-pro-vietnamese-400-normal.woff2',
    '/fonts/be-vietnam-pro-vietnamese-500-normal.woff2',
    '/fonts/be-vietnam-pro-vietnamese-600-normal.woff2',
    '/fonts/be-vietnam-pro-vietnamese-700-normal.woff2',
    '/fonts/noto-sans-latin-400-normal.woff2',
    '/fonts/noto-sans-latin-500-normal.woff2',
    '/fonts/noto-sans-latin-600-normal.woff2',
    '/fonts/noto-sans-latin-700-normal.woff2',
    '/fonts/noto-sans-vietnamese-400-normal.woff2',
    '/fonts/noto-sans-vietnamese-500-normal.woff2',
    '/fonts/noto-sans-vietnamese-600-normal.woff2',
    '/fonts/noto-sans-vietnamese-700-normal.woff2',
    '/img/staff/1.webp', '/img/staff/2.webp', '/img/staff/3.webp', '/img/staff/4.webp',
    '/img/staff/5.webp', '/img/staff/6.webp', '/img/staff/7.webp', '/img/staff/8.webp',
    '/img/staff/9.webp', '/img/staff/10.webp', '/img/staff/11.webp', '/img/staff/12.webp',
    '/img/staff/16.webp', '/img/staff/24.webp', '/img/staff/25.webp', '/img/staff/26.webp',
    '/img/staff/27.webp', '/img/staff/28.webp', '/img/staff/29.webp', '/img/staff/30.webp',
    '/img/staff/31.webp', '/img/staff/32.webp', '/img/staff/33.webp', '/img/staff/35.webp',
    '/img/staff/36.webp', '/img/staff/37.webp', '/img/staff/38.webp', '/img/staff/39.webp',
    '/img/staff/40.webp'
];
const STATIC_ASSET_PATHS = new Set(STATIC_ASSETS);

function isCacheableStaticRequest(request, url) {
    if (request.method !== 'GET' || url.origin !== self.location.origin) return false;
    return STATIC_ASSET_PATHS.has(url.pathname) || /^\/img\/staff\/\d+(-lg)?\.webp$/.test(url.pathname);
}

// Install: precache static assets (bypass stale HTTP disk cache on version bump)
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS.map(u => new Request(u, { cache: 'reload' }))))
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

// Fetch: Network only for API, versioned CACHE_NAME first for static allowlist
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);

    // API requests: Network only — do not intercept in SW so browser handles API/SSE directly
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/data')) {
        return;
    }

    // Navigations: always prefer fresh HTML when online, fallback to cached shell when offline
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('/index.html'))
        );
        return;
    }

    if (!isCacheableStaticRequest(event.request, url)) {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(cache =>
            cache.match(event.request).then(exactMatch => {
                if (exactMatch) return exactMatch;
                return cache.match(url.pathname).then(pathMatch => {
                    if (pathMatch) return pathMatch;
                    return fetch(event.request, { cache: 'no-cache' }).then(response => {
                        if (response.ok) {
                            cache.put(url.search ? event.request : url.pathname, response.clone());
                        }
                        return response;
                    });
                });
            })
        ).catch(() =>
            caches.match(event.request).then(c => c || caches.match(url.pathname) || (url.pathname.startsWith('/img/staff/') ? caches.match('/img/logo-khoa.jpg') : Response.error()))
        )
    );
});
