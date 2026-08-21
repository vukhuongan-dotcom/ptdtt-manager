// ===== MAIN APP CONTROLLER =====
const App = {
    currentPage: 'dashboard',
    _keyboardShortcutHandler: null,

    pages: {
        dashboard: DashboardPage,
        staff: StaffPage,
        'staff-tracking': StaffTrackingPage,
        rooms: RoomsPage,
        tasks: TasksPage,
        plans: PlansPage,
        patients: PatientsPage,
        schedule: SchedulePage,
        surgery: SurgeryPage,
        'surgery-stats': SurgeryStatsPage,
        research: ResearchPage,
        conferences: ConferencesPage,
        reports: ReportsPage,
    },

    async init() {
        this.bindModal();
        Auth.init();

        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocal) {
            // Auto bypass login for local test/demo mode as BS. Vũ Khương An
            const localSession = {
                staffId: 2,
                username: 'vkan',
                name: 'Vũ Khương An',
                role: 'BS Phó trưởng khoa',
                title: 'BSCKII',
                isAdmin: true,
                isSuperAdmin: true,
                color: '#06b6d4',
                loginTime: new Date().toISOString()
            };
            localStorage.setItem(Auth.SESSION_KEY, JSON.stringify(localSession));
            const mockPayload = btoa(JSON.stringify({ staffId: 2, username: 'vkan', exp: Math.floor(Date.now() / 1000) + 86400 * 365 }));
            const mockToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${mockPayload}.mockSignature`;
            sessionStorage.setItem(Auth.TOKEN_KEY, mockToken);
            localStorage.setItem(Auth.TOKEN_KEY, mockToken);

            Store.init();
            try {
                const res = await fetch('data/db.json?t=' + Date.now());
                if (res.ok) {
                    const realDb = await res.json();
                    Store._data = realDb;
                    Store._saveLocal();
                    console.log('✅ [Local] Loaded real database:', Object.keys(realDb).length, 'collections,', (realDb.surgeries || []).length, 'surgeries');
                }
            } catch (e) {
                console.warn('[Local] Could not fetch data/db.json:', e);
            }

            this.showApp('surgery-stats');
            return;
        }

        const token = Auth.getToken();
        if (!token) {
            // No token at all — go straight to login
            Store.init();
            this.showLogin();
            return;
        }

        // Token exists — validate with server before showing app
        this._showAuthChecking();
        const session = await Auth.validateStoredSession();

        if (!session) {
            // Token invalid/expired/disabled — show login
            Store.init();
            this.showLogin();
            return;
        }

        // Server confirmed session — safe to init store and show app
        Store.init();
        await Store.startAuthenticatedSync();
        this.showApp();
    },

    _showAuthChecking() {
        document.getElementById('app').style.display = 'none';
        document.getElementById('modal-overlay').style.display = 'none';
        // Remove any existing login/auth-checking containers
        document.getElementById('login-container')?.remove();
        document.getElementById('auth-checking')?.remove();

        const div = document.createElement('div');
        div.id = 'auth-checking';
        // U5: CSS class thay inline style (base.css #auth-checking)
        div.innerHTML = '<div class="fc-spinner"></div> Đang xác thực phiên...';
        document.body.appendChild(div);
    },

    // === Login Flow ===
    showLogin() {
        if (this._idleTimer) {
            clearInterval(this._idleTimer);
            this._idleTimer = null;
        }
        this._idleWarned = false;
        localStorage.removeItem(this._IDLE_KEY);
        document.getElementById('idle-warning-bar')?.remove();
        document.getElementById('auth-checking')?.remove();
        Notifications.stopPolling();
        Store.resetForLogout();
        if (typeof EMR !== 'undefined') {
            EMR.stopAutoRefresh();
            EMR.clearRuntimeCache();
        }
        document.getElementById('app').style.display = 'none';
        document.getElementById('modal-overlay').style.display = 'none';

        // Create login container if not exists
        let loginContainer = document.getElementById('login-container');
        if (!loginContainer) {
            loginContainer = document.createElement('div');
            loginContainer.id = 'login-container';
            document.body.appendChild(loginContainer);
        }
        loginContainer.innerHTML = LoginPage.render();
    },

    async onLoginSuccess() {
        const loginContainer = document.getElementById('login-container');
        if (loginContainer) loginContainer.remove();
        document.getElementById('auth-checking')?.remove();

        // Show loading while syncing data from server
        this._showAuthChecking();

        // Start authenticated server sync + polling now that JWT is available
        await Store.startAuthenticatedSync();

        this.showApp();
    },

    // Pages that require admin role to access
    _adminOnlyPages: ['surgery-stats'],

    // Pages that require super admin role to access
    _superAdminOnlyPages: [],

    showApp(initialPage = 'dashboard') {
        document.getElementById('auth-checking')?.remove();
        document.getElementById('app').style.display = 'flex';
        // Restore modal-overlay to CSS-controlled display (was set inline by _showAuthChecking)
        document.getElementById('modal-overlay').style.display = '';
        this.updateSidebarUser();
        this.updateMobileHeader();
        this.updateNavVisibility();
        this.bindNavigation();
        this.navigate(initialPage);
        Notifications.startPolling();
        if (typeof EMR !== 'undefined') {
            EMR.startAutoRefresh();
        }

        // Start idle auto-logout (5 min)
        this._startIdleTimer();

        // Auto-start onboarding for first-time users
        if (Onboarding.shouldShow()) {
            setTimeout(() => Onboarding.start(), 800);
        }

        // P3.3b: Keyboard shortcuts
        this._initKeyboardShortcuts();

        // U2: Sync dark mode toggle UI sau khi app render
        this._initTheme();

        // Mobile UX: Network status banner & Swipe gestures
        this._initNetworkStatusIndicator();
        this._initSwipeNavigation();
    },

    // Mobile UX: Offline / Online connectivity banner
    _initNetworkStatusIndicator() {
        const showStatus = (isOnline) => {
            let banner = document.getElementById('network-status-banner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'network-status-banner';
                banner.className = 'network-status-banner';
                document.body.appendChild(banner);
            }
            if (!isOnline) {
                banner.className = 'network-status-banner offline';
                banner.innerHTML = '⚠️ Đang dùng ngoại tuyến (Offline)';
            } else {
                banner.className = 'network-status-banner online';
                banner.innerHTML = '✅ Đã kết nối lại máy chủ';
                setTimeout(() => {
                    if (banner) banner.className = 'network-status-banner';
                }, 3000);
            }
        };

        window.addEventListener('offline', () => showStatus(false));
        window.addEventListener('online', () => showStatus(true));
    },

    // Mobile UX: Swipe navigation for Surgery and Schedule pages
    _initSwipeNavigation() {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;
        const minSwipeDistance = 60; // px
        const maxPerpendicularDistance = 45; // px

        const content = document.getElementById('content');
        if (!content) return;

        content.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        content.addEventListener('touchend', (e) => {
            if (e.changedTouches.length !== 1) return;
            touchEndX = e.changedTouches[0].clientX;
            touchEndY = e.changedTouches[0].clientY;

            const deltaX = touchEndX - touchStartX;
            const deltaY = Math.abs(touchEndY - touchStartY);

            // Trigger horizontal swipe only when vertical movement is small
            if (Math.abs(deltaX) >= minSwipeDistance && deltaY <= maxPerpendicularDistance) {
                if (App.currentPage === 'surgery' && typeof SurgeryPage !== 'undefined') {
                    if (deltaX < 0 && typeof SurgeryPage.nextDay === 'function') {
                        SurgeryPage.nextDay(); // swipe left -> next day
                    } else if (deltaX > 0 && typeof SurgeryPage.prevDay === 'function') {
                        SurgeryPage.prevDay(); // swipe right -> prev day
                    }
                } else if (App.currentPage === 'schedule' && typeof SchedulePage !== 'undefined') {
                    if (deltaX < 0 && typeof SchedulePage.nextWeek === 'function') {
                        SchedulePage.nextWeek(); // swipe left -> next week
                    } else if (deltaX > 0 && typeof SchedulePage.prevWeek === 'function') {
                        SchedulePage.prevWeek(); // swipe right -> prev week
                    }
                }
            }
        }, { passive: true });
    },

    // P3.3b: Global keyboard shortcuts
    _initKeyboardShortcuts() {
        if (this._keyboardShortcutHandler) {
            document.removeEventListener('keydown', this._keyboardShortcutHandler);
        }
        this._keyboardShortcutHandler = (e) => {
            // Skip if user is typing in an input, textarea, or contenteditable
            const tag = document.activeElement?.tagName;
            const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
                || document.activeElement?.isContentEditable;

            // '/' or Cmd/Ctrl+K — open global search
            if (!isEditing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k'))) {
                e.preventDefault();
                if (typeof GlobalSearch !== 'undefined') GlobalSearch.open();
                return;
            }
        };
        document.addEventListener('keydown', this._keyboardShortcutHandler);
    },

    // Hide nav items based on role
    updateNavVisibility() {
        const isAdmin = this.isAdmin();
        const isSuperAdmin = this.isSuperAdmin();
        // Admin-only pages
        this._adminOnlyPages.forEach(page => {
            const navItem = document.getElementById(`nav-${page}`);
            if (navItem) navItem.style.display = isAdmin ? '' : 'none';
        });
        // Super-admin-only pages
        this._superAdminOnlyPages.forEach(page => {
            const navItem = document.getElementById(`nav-${page}`);
            if (navItem) navItem.style.display = isSuperAdmin ? '' : 'none';
        });
        // Hide patients tab (disabled)
        const navPatients = document.getElementById('nav-patients');
        if (navPatients) navPatients.style.display = 'none';
    },

    // === Idle Auto-Logout (5 minutes) ===
    IDLE_TIMEOUT: 5 * 60 * 1000, // 5 minutes in ms
    IDLE_WARNING: 4 * 60 * 1000, // warn at 4 min
    _idleTimer: null,
    _idleWarned: false,
    _IDLE_KEY: 'ptdtt_lastActivity',

    _getLastActivity() {
        return parseInt(localStorage.getItem(this._IDLE_KEY) || Date.now());
    },

    _setLastActivity() {
        const now = Date.now();
        localStorage.setItem(this._IDLE_KEY, now);
    },

    _startIdleTimer() {
        // Init last activity
        this._setLastActivity();

        // Track user activity — desktop + mobile events
        const resetIdle = () => {
            this._setLastActivity();
            if (this._idleWarned) {
                this._idleWarned = false;
                const warn = document.getElementById('idle-warning-bar');
                if (warn) warn.remove();
            }
        };

        ['mousemove', 'mousedown', 'keydown', 'click', 'scroll',
            'touchstart', 'touchmove', 'touchend'].forEach(evt => {
                document.addEventListener(evt, resetIdle, { passive: true });
            });

        // Visibility change — crucial for mobile (timers freeze when tab/app is hidden)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && Auth.isLoggedIn()) {
                this._checkIdle();
            }
        });

        // Also check on window focus (some mobile browsers use this instead)
        window.addEventListener('focus', () => {
            if (Auth.isLoggedIn()) this._checkIdle();
        });

        // Periodic check every 30 seconds (works on desktop, may be throttled on mobile)
        if (this._idleTimer) clearInterval(this._idleTimer);
        this._idleTimer = setInterval(() => this._checkIdle(), 30000);
    },

    _checkIdle() {
        if (!Auth.isLoggedIn()) return;

        const idle = Date.now() - this._getLastActivity();

        // Logout khi không hoạt động sau 5 phút (IDLE_TIMEOUT = 5 * 60 * 1000)
        if (idle >= this.IDLE_TIMEOUT) {
            if (this._idleTimer) { clearInterval(this._idleTimer); this._idleTimer = null; }
            localStorage.removeItem(this._IDLE_KEY);
            Auth.logout();
            this.showLogin();
            setTimeout(() => {
                const err = document.getElementById('login-error');
                if (err) {
                    err.textContent = '⏰ Phiên đăng nhập đã hết hạn do không hoạt động (5 phút).';
                    err.style.display = 'block';
                    err.style.color = '#f59e0b';
                }
            }, 200);
            return;
        }

        // Warning at 4 min (1 min before logout)
        if (idle >= this.IDLE_WARNING && !this._idleWarned) {
            this._idleWarned = true;
            this._showIdleWarning();
        }
    },

    _showIdleWarning() {
        const existing = document.getElementById('idle-warning-bar');
        if (existing) existing.remove();

        const bar = document.createElement('div');
        bar.id = 'idle-warning-bar';
        // U5: CSS class thay inline style (base.css #idle-warning-bar)
        bar.innerHTML = '⚠️ Bạn sẽ bị đăng xuất trong <strong>1 phút</strong> nữa do không hoạt động. Chạm vào đây để tiếp tục.';
        bar.onclick = () => {
            this._setLastActivity();
            this._idleWarned = false;
            bar.remove();
        };
        document.body.appendChild(bar);
    },

    // === Mobile Header (account info + logout) ===
    updateMobileHeader() {
        const session = Auth.getSession();
        const area = document.getElementById('mobile-user-area');
        if (!session || !area) return;

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        area.innerHTML = `
            <button class="mobile-theme-toggle" id="mobile-theme-toggle-btn"
                onclick="App.toggleTheme()" title="${isDark ? 'Giao diện sáng' : 'Giao diện tối'}"
                aria-label="${isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}">
                ${isDark
                    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
                    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
                }
            </button>
            ${Notifications.renderBellButton('mobile')}
            <div class="mobile-user-avatar" style="background:${session.color || 'var(--gradient-accent)'}">${Utils.getInitials(session.name)}</div>
            <span class="mobile-user-name">${session.name}</span>
            <button class="mobile-logout-btn" id="mobile-logout-btn" aria-label="Đăng xuất">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
        `;

        document.getElementById('mobile-logout-btn').addEventListener('click', () => {
            Auth.logout();
            this.showLogin();
        });
    },

    // === Sidebar User ===
    updateSidebarUser() {
        const session = Auth.getSession();
        if (!session) return;

        const footer = document.getElementById('sidebar-footer');
        footer.innerHTML = `
            <!-- U2: Dark mode toggle — nằm trước user info -->
            <div class="sidebar-theme-area">
                <button
                    id="theme-toggle-btn"
                    class="theme-toggle-btn"
                    onclick="App.toggleTheme()"
                    aria-pressed="false"
                    aria-label="Giao diện tối"
                    title="Giao diện tối">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                </button>
                <span class="theme-toggle-label" id="theme-toggle-label">Giao diện tối</span>
            </div>
            <div class="sidebar-bell-area">
                ${Notifications.renderBellButton('desktop')}
                <span class="notif-bell-label">Thông báo</span>
            </div>
            <div class="user-info" id="user-info-toggle">
                <div class="user-avatar" style="background:${session.color || 'var(--gradient-accent)'}">${Utils.getInitials(session.name)}</div>
                <div class="user-details">
                    <span class="user-name">${session.title} ${session.name}</span>
                    <span class="user-role">${session.role}</span>
                </div>
            </div>
            ${session.isAdmin ? `<div class="sidebar-admin-btns">
                <button class="btn btn-secondary btn-sm sidebar-admin-btns__btn" onclick="Auth.openChangePassword()">&#128273; Đổi MK</button>
                ${session.isSuperAdmin ? `<button class="btn btn-secondary btn-sm sidebar-admin-btns__btn" onclick="Auth.openManagePasswords()">&#128101; Quản lý TK</button>` : ''}
            </div>
            ${session.isSuperAdmin ? `<button class="btn btn-secondary btn-sm sidebar-full-btn" onclick="AuditLog.open()">&#128203; Lịch sử hoạt động</button>` : ''}` : ''}
            <button class="btn btn-secondary btn-sm sidebar-full-btn-spaced" onclick="Onboarding.start()">&#10067; Hướng dẫn sử dụng</button>
            <button class="logout-btn" id="logout-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="logout-btn-icon"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Đăng xuất
            </button>
        `;

        // Sync theme toggle UI ngay sau khi render
        this._updateThemeToggleUI();

        // Bind events with proper propagation handling
        document.getElementById('user-info-toggle').addEventListener('click', (e) => {
            e.stopPropagation();
            const btn = document.getElementById('logout-btn');
            if (btn) btn.classList.toggle('show');
        });

        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            Auth.logout();
            this.showLogin();
        });
    },

    // === Navigation ===
    bindNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigate(page);
            });
        });

        // Global shortcut Ctrl+Z / Cmd+Z for schedule undo
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                if (App.currentPage === 'schedule') {
                    const tag = (document.activeElement?.tagName || '').toLowerCase();
                    if (tag !== 'input' && tag !== 'textarea') {
                        e.preventDefault();
                        SchedulePage.undo();
                    }
                }
            }
        });
    },

    bindModal() {
        document.getElementById('modal-close').addEventListener('click', Modal.close);
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) Modal.close();
        });
    },

    navigate(page) {
        // Guard: patients tab is disabled
        if (page === 'patients') {
            return;
        }
        // Guard: admin-only pages
        if (this._adminOnlyPages.includes(page) && !this.isAdmin()) {
            Toast.show('⛔ Chức năng này chỉ dành cho quản trị viên.', 'error');
            return;
        }
        // Guard: super-admin-only pages
        if (this._superAdminOnlyPages.includes(page) && !this.isSuperAdmin()) {
            Toast.show('⛔ Chức năng này chỉ dành cho Super Admin.', 'error');
            return;
        }

        this.currentPage = page;

        // Update nav active state + aria-current (A4: accessibility)
        document.querySelectorAll('.nav-item').forEach(item => {
            const isCurrent = item.dataset.page === page;
            item.classList.toggle('active', isCurrent);
            if (isCurrent) {
                item.setAttribute('aria-current', 'page');
            } else {
                item.removeAttribute('aria-current');
            }
        });

        this.renderCurrentPage();
    },

    renderCurrentPage() {
        const pageModule = this.pages[this.currentPage];
        if (!pageModule) return;

        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        try {
            const html = pageModule.render();
            mainContent.innerHTML = html;
            mainContent.style.opacity = '1';
            mainContent.style.transform = 'none';

            // Add data freshness timestamp
            const timestamp = document.createElement('div');
            timestamp.className = 'data-timestamp';
            timestamp.innerHTML = `<span>📡 Dữ liệu cập nhật lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} — ${new Date().toLocaleDateString('vi-VN')}</span>`;
            timestamp.style.cssText = 'text-align:right;padding:12px 0 4px;font-size:0.75rem;color:var(--text-muted);opacity:0.6;';
            mainContent.appendChild(timestamp);

            // Run post-render hooks
            if (typeof pageModule.afterRender === 'function') {
                try { pageModule.afterRender(); } catch (errAfter) { console.warn('[App] afterRender error:', errAfter); }
            }

            // Update notification bell badge
            if (typeof Notifications !== 'undefined' && Notifications.updateBell) {
                Notifications.updateBell();
            }
        } catch (err) {
            console.error('[App] Render page error:', err);
            mainContent.innerHTML = `
                <div class="card sstats-empty-state-card" style="padding: 40px 20px; text-align: center;">
                    <div class="sstats-empty-icon" style="font-size: 2rem; margin-bottom: 12px;">⚠️</div>
                    <h3 style="margin-bottom: 8px; color: var(--text-primary);">Đã xảy ra sự cố khi tải trang</h3>
                    <p style="color: var(--text-muted); font-size: 0.85rem;">${err.message}</p>
                    <button class="btn btn-primary" onclick="App.renderCurrentPage()" style="margin-top: 12px;">Tải lại trang</button>
                </div>
            `;
            mainContent.style.opacity = '1';
        }
    },

    // Helper: check if current user is admin (BCN Khoa, Admin, SuperAdmin)
    isAdmin() {
        const session = Auth.getSession();
        if (!session) return false;
        if (session.isAdmin || session.isSuperAdmin) return true;
        const role = (session.role || '').toLowerCase();
        if (role.includes('trưởng khoa') || role.includes('phó trưởng khoa')) return true;
        const username = (session.username || '').toLowerCase();
        if (username === 'vkan' || username === 'nphuu') return true;
        return false;
    },

    isSuperAdmin() {
        const session = Auth.getSession();
        if (!session) return false;
        if (session.isSuperAdmin) return true;
        const username = (session.username || '').toLowerCase();
        if (username === 'vkan') return true;
        return false;
    },

    getCurrentUser() {
        return Auth.getSession();
    },

    // ===== U2: Dark Mode Toggle =====
    _initTheme() {
        const saved = localStorage.getItem('ptdtt_theme');
        let current = saved;
        if (!current) {
            current = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', current);
        }
        this._updateThemeToggleUI(current);
        this._updateMetaThemeColor(current);
    },

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('ptdtt_theme', next);
        this._updateThemeToggleUI(next);
        this._updateMetaThemeColor(next);
        this.updateMobileHeader(); // cập nhật icon sun/moon trên mobile header
        // Re-render dashboard trend chart if active
        if (window.DashboardPage && typeof DashboardPage.renderTrendChart === 'function') {
            DashboardPage.renderTrendChart();
        }
        // Nếu đang ở trang login, re-render để icon toggle cập nhật
        const loginContainer = document.getElementById('login-container');
        if (loginContainer) loginContainer.innerHTML = LoginPage.render();
    },

    _updateThemeToggleUI(theme) {
        const btn = document.getElementById('theme-toggle-btn');
        if (!btn) return;
        const isDark = (theme || document.documentElement.getAttribute('data-theme')) === 'dark';
        const labelText = isDark ? 'Giao diện sáng' : 'Giao diện tối';
        btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
        btn.setAttribute('aria-label', labelText);
        btn.title = labelText;
        // Cập nhật label text hiển thị bên cạnh nút
        const label = document.getElementById('theme-toggle-label');
        if (label) label.textContent = labelText;
        // Swap icon sun / moon
        btn.innerHTML = isDark
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
               </svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
               </svg>`;
    },

    _updateMetaThemeColor(theme) {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === 'dark' ? '#0d1117' : '#0891b2');
    }
};

// Boot
// Note: Using defer on this script means DOM is already parsed when we run.
// DOMContentLoaded has already fired, so we call App.init() directly.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}
