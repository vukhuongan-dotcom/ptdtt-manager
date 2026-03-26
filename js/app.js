// ===== MAIN APP CONTROLLER =====
const App = {
    currentPage: 'dashboard',

    pages: {
        dashboard: DashboardPage,
        staff: StaffPage,
        rooms: RoomsPage,
        tasks: TasksPage,
        plans: PlansPage,
        patients: PatientsPage,
        schedule: SchedulePage,
        surgery: SurgeryPage,
        'surgery-stats': SurgeryStatsPage,
    },

    init() {
        Store.init();
        Auth.init();
        this.bindModal();

        if (Auth.isLoggedIn()) {
            this.showApp();
            // Start EMR real-time patient data fetch (every 5 min)
            setTimeout(() => EMR.startAutoRefresh(), 1000);
        } else {
            this.showLogin();
        }
    },

    // === Login Flow ===
    showLogin() {
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

    onLoginSuccess() {
        const loginContainer = document.getElementById('login-container');
        if (loginContainer) loginContainer.remove();

        this.showApp();
    },

    showApp() {
        document.getElementById('app').style.display = 'flex';
        this.updateSidebarUser();
        this.updateMobileHeader();
        this.bindNavigation();
        this.navigate('dashboard');
    },

    // === Mobile Header (account info + logout) ===
    updateMobileHeader() {
        const session = Auth.getSession();
        const area = document.getElementById('mobile-user-area');
        if (!session || !area) return;

        area.innerHTML = `
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
            <div class="user-info" id="user-info-toggle">
                <div class="user-avatar" style="background:${session.color || 'var(--gradient-accent)'}">${Utils.getInitials(session.name)}</div>
                <div class="user-details">
                    <span class="user-name">${session.title} ${session.name}</span>
                    <span class="user-role">${session.role}</span>
                </div>
            </div>
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
        this.currentPage = page;

        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        this.renderCurrentPage();
    },

    renderCurrentPage() {
        const pageModule = this.pages[this.currentPage];
        if (!pageModule) return;

        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = pageModule.render();

        // Run post-render hooks
        if (pageModule.afterRender) {
            requestAnimationFrame(() => pageModule.afterRender());
        }
    },

    // Helper: check if current user is admin
    isAdmin() {
        const session = Auth.getSession();
        return session ? session.isAdmin : false;
    },

    getCurrentUser() {
        return Auth.getSession();
    }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
