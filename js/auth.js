// ===== AUTHENTICATION MODULE =====
const Auth = {
    SESSION_KEY: 'ptdtt_session',
    ACCOUNTS_KEY: 'ptdtt_accounts',

    init() {
        if (!localStorage.getItem(this.ACCOUNTS_KEY)) {
            this.generateAccounts();
        }
    },

    // Generate accounts from staff data
    generateAccounts() {
        const staff = Store.getAll('staff');
        const accounts = {};

        staff.forEach(s => {
            const username = this.generateUsername(s.name);
            accounts[username] = {
                staffId: s.id,
                username: username,
                password: this.generatePassword(s.name),
                name: s.name,
                role: s.role,
                title: s.title,
                isAdmin: s.role.includes('Trưởng khoa') || s.role.includes('Phó trưởng khoa') || s.role === 'Điều dưỡng trưởng',
                color: s.color
            };
        });

        localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts));
        return accounts;
    },

    // Generate username from Vietnamese name: lowercase, no diacritics, dots between parts
    generateUsername(fullName) {
        const parts = fullName.trim().split(/\s+/);
        const last = parts[parts.length - 1];
        const initials = parts.slice(0, -1).map(p => p[0]).join('');
        return this.removeDiacritics(last.toLowerCase() + '.' + initials.toLowerCase());
    },

    // Generate simple password: first name lowercase + '123'
    generatePassword(fullName) {
        const parts = fullName.trim().split(/\s+/);
        const firstName = parts[parts.length - 1];
        return this.removeDiacritics(firstName.toLowerCase()) + '123';
    },

    removeDiacritics(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd').replace(/Đ/g, 'D');
    },

    // Get all accounts
    getAccounts() {
        const saved = localStorage.getItem(this.ACCOUNTS_KEY);
        return saved ? JSON.parse(saved) : this.generateAccounts();
    },

    // Login
    login(username, password) {
        const accounts = this.getAccounts();
        const account = accounts[username];

        if (!account) return { success: false, error: 'Tài khoản không tồn tại' };
        if (account.password !== password) return { success: false, error: 'Mật khẩu không đúng' };

        // Save session
        const session = {
            staffId: account.staffId,
            username: account.username,
            name: account.name,
            role: account.role,
            title: account.title,
            isAdmin: account.isAdmin,
            color: account.color,
            loginTime: new Date().toISOString()
        };
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        return { success: true, session };
    },

    // Logout
    logout() {
        localStorage.removeItem(this.SESSION_KEY);
    },

    // Get current session
    getSession() {
        const saved = localStorage.getItem(this.SESSION_KEY);
        return saved ? JSON.parse(saved) : null;
    },

    // Check if logged in
    isLoggedIn() {
        return this.getSession() !== null;
    },

    // Add new account when new staff is added
    addAccount(staffMember) {
        const accounts = this.getAccounts();
        const username = this.generateUsername(staffMember.name);
        accounts[username] = {
            staffId: staffMember.id,
            username: username,
            password: this.generatePassword(staffMember.name),
            name: staffMember.name,
            role: staffMember.role,
            title: staffMember.title,
            isAdmin: staffMember.role.includes('Trưởng khoa') || staffMember.role.includes('Phó trưởng khoa') || staffMember.role === 'Điều dưỡng trưởng',
            color: staffMember.color
        };
        localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts));
        return { username, password: accounts[username].password };
    },

    // Update account info when staff is edited
    updateAccount(staffId, data) {
        const accounts = this.getAccounts();
        const key = Object.keys(accounts).find(k => accounts[k].staffId === staffId);
        if (key) {
            if (data.name) accounts[key].name = data.name;
            if (data.role) {
                accounts[key].role = data.role;
                accounts[key].isAdmin = data.role.includes('Trưởng khoa') || data.role.includes('Phó trưởng khoa') || data.role === 'Điều dưỡng trưởng';
            }
            if (data.title) accounts[key].title = data.title;
            localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts));
        }
    },

    // Remove account when staff is removed
    removeAccount(staffId) {
        const accounts = this.getAccounts();
        const key = Object.keys(accounts).find(k => accounts[k].staffId === staffId);
        if (key) {
            delete accounts[key];
            localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts));
        }
    },

    // Refresh accounts to sync with staff data
    refreshAccounts() {
        localStorage.removeItem(this.ACCOUNTS_KEY);
        this.generateAccounts();
    },

    // Get account list for display
    getAccountList() {
        const accounts = this.getAccounts();
        return Object.values(accounts).map(a => ({
            username: a.username,
            password: a.password,
            name: a.name,
            role: a.role,
            isAdmin: a.isAdmin
        }));
    }
};

// ===== LOGIN PAGE RENDERER =====
const LoginPage = {
    render() {
        return `
        <div class="login-page">
            <div class="login-card">
                <div class="login-logo">
                    <div class="login-logo-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                        </svg>
                    </div>
                    <h1>Khoa PT Đại trực tràng</h1>
                    <p>Bệnh viện Bình Dân — Đăng nhập hệ thống</p>
                </div>

                <div class="login-error" id="login-error"></div>

                <form class="login-form" id="login-form" onsubmit="LoginPage.handleLogin(event)">
                    <div class="form-group">
                        <label class="form-label">Tên đăng nhập</label>
                        <input class="form-input" type="text" id="login-username" name="username" placeholder="vd: an.vk" required autofocus>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Mật khẩu</label>
                        <input class="form-input" type="password" id="login-password" name="password" placeholder="••••••" required>
                    </div>
                    <button type="submit" class="login-btn">Đăng nhập</button>
                </form>

                <div class="login-info">
                    <strong>🔍 Tra cứu tài khoản:</strong><br>
                    <input class="form-input" type="text" id="account-lookup" placeholder="Nhập tên của bạn..." oninput="LoginPage.lookupAccount(this.value)" style="margin-top:8px;padding:8px 12px;font-size:0.82rem">
                    <div id="lookup-result" style="margin-top:6px;font-size:0.82rem;min-height:20px"></div>
                </div>

                <div class="login-footer">
                    © 2026 Khoa Phẫu thuật Đại trực tràng · BV Bình Dân
                </div>
            </div>
        </div>
        `;
    },

    lookupAccount(query) {
        const resultEl = document.getElementById('lookup-result');
        if (!query || query.length < 2) {
            resultEl.innerHTML = '';
            return;
        }
        const accounts = Auth.getAccountList();
        const q = query.toLowerCase();
        const matches = accounts.filter(a => a.name.toLowerCase().includes(q));

        if (matches.length === 0) {
            resultEl.innerHTML = '<span style="color:var(--text-dark)">Không tìm thấy</span>';
        } else {
            resultEl.innerHTML = matches.slice(0, 3).map(a =>
                `<div style="padding:4px 0;color:var(--text-light)">
                    ${a.name} → <strong style="color:var(--primary-light)">${a.username}</strong> / <strong style="color:var(--primary-light)">${a.password}</strong>
                    ${a.isAdmin ? '<span style="color:var(--warning-light);font-size:0.75rem"> (Admin)</span>' : ''}
                </div>`
            ).join('');
        }
    },

    handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        const result = Auth.login(username, password);

        if (result.success) {
            App.onLoginSuccess();
        } else {
            const errEl = document.getElementById('login-error');
            errEl.textContent = result.error;
            errEl.classList.add('show');
            // Shake animation
            const card = document.querySelector('.login-card');
            card.style.animation = 'none';
            card.offsetHeight; // trigger reflow
            card.style.animation = 'shake 0.4s ease';
        }
    }
};

