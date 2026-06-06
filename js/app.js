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
        div.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100vh;background:var(--bg-main,#0f172a);color:#94a3b8;font-family:Inter,system-ui,sans-serif;font-size:0.95rem;gap:10px';
        div.innerHTML = '<div style="width:20px;height:20px;border:2px solid #334155;border-top-color:#6366f1;border-radius:50%;animation:spin 0.8s linear infinite"></div> Đang xác thực phiên...';
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

    showApp() {
        document.getElementById('auth-checking')?.remove();
        document.getElementById('app').style.display = 'flex';
        // Restore modal-overlay to CSS-controlled display (was set inline by _showAuthChecking)
        document.getElementById('modal-overlay').style.display = '';
        this.updateSidebarUser();
        this.updateMobileHeader();
        this.updateNavVisibility();
        this.bindNavigation();
        this.navigate('dashboard');
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

        // Logout at 15 min
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
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;text-align:center;padding:10px 16px;font-size:0.85rem;font-weight:600;font-family:Inter,system-ui,sans-serif;animation:slideDown 0.3s ease;cursor:pointer';
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

        area.innerHTML = `
            ${Notifications.renderBellButton('mobile')}
            <div class="mobile-user-avatar" style="background:${session.color || 'var(--gradient-accent)'}">${Utils.getInitials(session.name)}</div>
            <span class="mobile-user-name">${session.name}</span>
            <button class="mobile-logout-btn" id="mobile-logout-btn">
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
            ${session.isAdmin ? `<div style="display:flex;gap:6px;margin:6px 0">
                <button class="btn btn-secondary btn-sm" style="flex:1;font-size:0.72rem" onclick="Auth.openChangePassword()">🔑 Đổi MK</button>
                ${session.isSuperAdmin ? `<button class="btn btn-secondary btn-sm" style="flex:1;font-size:0.72rem" onclick="Auth.openManagePasswords()">👥 Quản lý TK</button>` : ''}
            </div>
            ${session.isSuperAdmin ? `<button class="btn btn-secondary btn-sm" style="width:100%;font-size:0.72rem;margin:2px 0" onclick="AuditLog.open()">📋 Lịch sử hoạt động</button>` : ''}` : ''}
            <button class="btn btn-secondary btn-sm" style="width:100%;font-size:0.72rem;margin:4px 0" onclick="Onboarding.start()">❓ Hướng dẫn sử dụng</button>
            <button class="logout-btn" id="logout-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Đăng xuất
            </button>
        `;

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

        // P3.3c: Show skeleton placeholder for instant visual feedback
        mainContent.innerHTML = `
            <div class="skeleton-card" style="margin:0 0 12px"></div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px">
                <div class="skeleton-card" style="height:80px"></div>
                <div class="skeleton-card" style="height:80px"></div>
                <div class="skeleton-card" style="height:80px"></div>
            </div>
            <div class="skeleton-card" style="height:200px"></div>
        `;
        mainContent.style.opacity = '1';
        mainContent.style.transform = 'none';

        requestAnimationFrame(() => {
            const html = pageModule.render();

            // Fade out skeleton, fade in content
            mainContent.style.transition = 'opacity 0.15s ease';
            mainContent.style.opacity = '0';

            requestAnimationFrame(() => {
                mainContent.innerHTML = html;

                // Add data freshness timestamp
                const timestamp = document.createElement('div');
                timestamp.className = 'data-timestamp';
                timestamp.innerHTML = `<span>📡 Dữ liệu cập nhật lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} — ${new Date().toLocaleDateString('vi-VN')}</span>`;
                timestamp.style.cssText = 'text-align:right;padding:12px 0 4px;font-size:0.75rem;color:var(--text-muted);opacity:0.6;';
                mainContent.appendChild(timestamp);

                // Animate in
                requestAnimationFrame(() => {
                    mainContent.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                    mainContent.style.opacity = '1';
                    mainContent.style.transform = 'translateY(0)';
                });

                // Run post-render hooks
                if (pageModule.afterRender) {
                    requestAnimationFrame(() => pageModule.afterRender());
                }

                // Update notification bell badge
                Notifications.updateBell();
            });
        });
    },

    // Helper: check if current user is admin
    isAdmin() {
        const session = Auth.getSession();
        return session ? session.isAdmin : false;
    },

    isSuperAdmin() {
        const session = Auth.getSession();
        return session ? session.isSuperAdmin : false;
    },

    getCurrentUser() {
        return Auth.getSession();
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
