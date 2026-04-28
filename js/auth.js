// ===== AUTHENTICATION MODULE (JWT — Phase 3 + P0 Security) =====
const Auth = {
    SESSION_KEY: 'ptdtt_session',
    TOKEN_KEY: 'ptdtt_jwt',
    SUPERADMIN_USERNAME: 'vkan',
    PASSWORD_MIN_LENGTH: 10,

    init() {
        // Check if we have a stored JWT token
        const token = this.getToken();
        if (token) {
            // Verify token is not expired locally
            const payload = this._decodeToken(token);
            if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
                // Token expired — clear session
                this.logout();
            }
        }
    },

    // ===== TOKEN MANAGEMENT =====
    // Token is stored in sessionStorage by default (cleared on browser close).
    // Only stored in localStorage when user checks "Ghi nhớ thiết bị này".
    getToken() {
        return sessionStorage.getItem(this.TOKEN_KEY) || localStorage.getItem(this.TOKEN_KEY);
    },

    _saveToken(token, remember = false) {
        if (remember) {
            localStorage.setItem(this.TOKEN_KEY, token);
        } else {
            sessionStorage.setItem(this.TOKEN_KEY, token);
        }
    },

    _removeToken() {
        localStorage.removeItem(this.TOKEN_KEY);
        sessionStorage.removeItem(this.TOKEN_KEY);
    },

    validatePassword(password, username = '') {
        if ((password || '').length < this.PASSWORD_MIN_LENGTH) {
            return `Mật khẩu phải có ít nhất ${this.PASSWORD_MIN_LENGTH} ký tự`;
        }
        if (!/[A-Za-zÀ-ỹ]/.test(password)) {
            return 'Mật khẩu phải có ít nhất 1 chữ cái';
        }
        if (!/\d/.test(password)) {
            return 'Mật khẩu phải có ít nhất 1 chữ số';
        }
        if (username && password.trim().toLowerCase() === username.trim().toLowerCase()) {
            return 'Mật khẩu không được trùng với tên đăng nhập';
        }
        return '';
    },

    // Decode JWT payload without verification (for client-side display only)
    _decodeToken(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            return payload;
        } catch (e) {
            return null;
        }
    },

    // ===== LOGIN =====
    async login(username, password, remember = false) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();

            if (!response.ok) {
                return { success: false, error: result.error || 'Đăng nhập thất bại' };
            }

            // Save JWT token
            this._saveToken(result.token, remember);

            // Save session info for quick access (from server response, not client-generated)
            const session = {
                staffId: result.user.staffId,
                username: result.user.username,
                name: result.user.name,
                role: result.user.role,
                title: result.user.title || '',
                isAdmin: result.user.isAdmin,
                isSuperAdmin: result.user.isSuperAdmin || false,
                color: result.user.color || '#6366f1',
                loginTime: new Date().toISOString()
            };
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));

            return { success: true, session };
        } catch (e) {
            // Server unavailable — cannot login without server
            console.error('[Auth] Login error:', e);
            return { success: false, error: 'Không thể kết nối server. Vui lòng thử lại.' };
        }
    },

    // ===== SERVER-VALIDATED SESSION =====
    async validateStoredSession() {
        const token = this.getToken();
        if (!token) return null;

        try {
            const response = await fetch('/api/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store'
            });

            if (!response.ok) {
                this.logout();
                return null;
            }

            const user = await response.json();
            // Update cached session with live server data
            const session = {
                staffId: user.staffId,
                username: user.username,
                name: user.name,
                role: user.role,
                title: user.title || '',
                isAdmin: user.isAdmin,
                isSuperAdmin: user.isSuperAdmin || false,
                color: user.color || '#6366f1',
                loginTime: new Date().toISOString()
            };
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
            return session;
        } catch (e) {
            // Network error — if offline, don't auto-logout but don't grant access
            console.warn('[Auth] Cannot reach server for session validation:', e.message);
            return null;
        }
    },

    // Logout — cleans ALL sensitive data
    logout() {
        // Token
        this._removeToken();
        // Session
        localStorage.removeItem(this.SESSION_KEY);
        sessionStorage.removeItem(this.SESSION_KEY);
        // Idle tracking
        localStorage.removeItem('ptdtt_lastActivity');
        // Business data cache (sensitive hospital data)
        localStorage.removeItem('ptdtt_manager');
    },

    // Get current session
    getSession() {
        const token = this.getToken();
        if (!token) return null;

        // Check token expiry
        const payload = this._decodeToken(token);
        if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
            this.logout();
            return null;
        }

        // Return cached session data
        const saved = localStorage.getItem(this.SESSION_KEY);
        return saved ? JSON.parse(saved) : null;
    },

    // Check if logged in
    isLoggedIn() {
        return this.getSession() !== null;
    },

    // ===== PASSWORD CHANGE =====
    async changePassword(currentPw, newPw) {
        const token = this.getToken();
        if (!token) return { success: false, error: 'Chưa đăng nhập' };

        try {
            const response = await fetch('/api/auth/password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ oldPassword: currentPw, newPassword: newPw })
            });

            const result = await response.json();
            if (!response.ok) {
                return { success: false, error: result.error || 'Đổi mật khẩu thất bại' };
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: 'Không thể kết nối server' };
        }
    },

    // Super admin changes another user's password
    async changeUserPassword(targetUsername, newPw) {
        const token = this.getToken();
        const session = this.getSession();
        if (!session || !session.isSuperAdmin) return { success: false, error: 'Không có quyền' };

        try {
            const response = await fetch('/api/auth/admin/password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ username: targetUsername, newPassword: newPw })
            });

            const result = await response.json();
            if (!response.ok) {
                return { success: false, error: result.error || 'Đổi mật khẩu thất bại' };
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: 'Không thể kết nối server' };
        }
    },

    // Toggle admin status
    async toggleAdmin(username) {
        const token = this.getToken();
        const session = this.getSession();
        if (!session || !session.isSuperAdmin) return;

        try {
            const response = await fetch('/api/auth/admin/toggle', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ username })
            });

            const result = await response.json();
            if (response.ok) {
                Toast.success(`Đã ${result.isAdmin ? 'cấp' : 'bỏ'} quyền Admin`);
                this.openManagePasswords(); // Refresh the modal
            } else {
                Toast.error(result.error || 'Thao tác thất bại');
            }
        } catch (e) {
            Toast.error('Không thể kết nối server');
        }
    },

    // Disable/enable account
    async disableAccount(staffId, disabled = true) {
        const token = this.getToken();
        const session = this.getSession();
        if (!session || !session.isSuperAdmin) return;

        // Find username from accounts list
        const accounts = await this._fetchAccounts();
        const account = accounts.find(a => a.staffId === staffId);
        if (!account) return;

        try {
            await fetch('/api/auth/admin/disable', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ username: account.username, disabled })
            });
        } catch (e) {
            console.error('[Auth] Disable account error:', e);
        }
    },

    enableAccount(staffId) {
        return this.disableAccount(staffId, false);
    },

    // ===== ACCOUNT MANAGEMENT (Server-side) =====
    async _fetchAccounts() {
        const token = this.getToken();
        try {
            const response = await fetch('/api/auth/accounts', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!response.ok) return [];
            const result = await response.json();
            return result.accounts || [];
        } catch (e) {
            return [];
        }
    },

    // Stub methods for backward compatibility with staff.js
    addAccount(staffMember) {
        // No-op: server handles account creation via _init_auth_from_db
        console.log('[Auth] addAccount: server will handle on next restart');
    },

    updateAccount(staffId, data) {
        // No-op: server handles via _init_auth_from_db
        console.log('[Auth] updateAccount: server will handle on next restart');
    },

    removeAccount(staffId) {
        // No-op: use disableAccount instead
        this.disableAccount(staffId);
    },

    refreshAccounts() {
        // No-op: accounts managed server-side
        console.log('[Auth] refreshAccounts: managed server-side');
    },

    // ===== PASSWORD CHANGE UI =====
    _pwField(id, label, extra = '') {
        const eyeOn = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
        const eyeOff = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
        return `<div class="form-group">
            <label class="form-label">${label}</label>
            <div style="position:relative">
                <input class="form-input" type="password" id="${id}" ${extra} style="padding-right:40px">
                <button type="button" onclick="Auth._togglePw('${id}',this)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-secondary);padding:4px;display:flex;align-items:center" title="Hiện/ẩn mật khẩu">
                    <span class="eye-on">${eyeOn}</span><span class="eye-off" style="display:none">${eyeOff}</span>
                </button>
            </div>
        </div>`;
    },

    _togglePw(inputId, btn) {
        const inp = document.getElementById(inputId);
        if (!inp) return;
        const isPassword = inp.type === 'password';
        inp.type = isPassword ? 'text' : 'password';
        btn.querySelector('.eye-on').style.display = isPassword ? 'none' : '';
        btn.querySelector('.eye-off').style.display = isPassword ? '' : 'none';
    },

    openChangePassword() {
        const session = this.getSession();
        if (!session || !session.isAdmin) return;
        Modal.open('Đổi mật khẩu', `
            <form onsubmit="Auth.handleChangePassword(event)">
                ${this._pwField('pw-current', 'Mật khẩu hiện tại', 'required')}
                ${this._pwField('pw-new', 'Mật khẩu mới', `required minlength="${this.PASSWORD_MIN_LENGTH}"`)}
                ${this._pwField('pw-confirm', 'Xác nhận mật khẩu mới', `required minlength="${this.PASSWORD_MIN_LENGTH}"`)}
                <div id="pw-error" style="color:var(--danger);font-size:0.8rem;margin-bottom:8px"></div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">Đổi mật khẩu</button>
                </div>
            </form>
        `);
    },

    async handleChangePassword(e) {
        e.preventDefault();
        const current = document.getElementById('pw-current').value;
        const newPw = document.getElementById('pw-new').value;
        const confirm = document.getElementById('pw-confirm').value;
        const errEl = document.getElementById('pw-error');

        if (newPw !== confirm) { errEl.textContent = 'Mật khẩu xác nhận không khớp'; return; }
        const passwordError = this.validatePassword(newPw, this.getSession()?.username || '');
        if (passwordError) { errEl.textContent = passwordError; return; }
        const result = await this.changePassword(current, newPw);
        if (result.success) {
            Modal.close();
            Toast.success('Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại trên các thiết bị khác.', 'Đổi mật khẩu thành công');
        } else {
            errEl.textContent = result.error;
        }
    },

    // Super admin: manage all staff accounts
    async openManagePasswords() {
        const session = this.getSession();
        if (!session || !session.isSuperAdmin) return;

        // Show loading
        Modal.open('👥 Quản lý tài khoản nhân viên', `
            <div style="text-align:center;padding:40px">
                <div class="spinner"></div>
                <p style="margin-top:12px;color:var(--text-secondary)">Đang tải danh sách tài khoản...</p>
            </div>
        `);

        const accounts = await this._fetchAccounts();
        if (accounts.length === 0) {
            Modal.open('👥 Quản lý tài khoản nhân viên', `
                <div style="text-align:center;padding:40px;color:var(--text-secondary)">
                    <p>Không thể tải danh sách tài khoản. Vui lòng thử lại.</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" onclick="Modal.close()">Đóng</button>
                </div>
            `);
            return;
        }

        // Sort: superadmin first, then admin, then by name
        accounts.sort((a, b) => {
            if (a.isSuperAdmin) return -1;
            if (b.isSuperAdmin) return 1;
            if (a.isAdmin && !b.isAdmin) return -1;
            if (!a.isAdmin && b.isAdmin) return 1;
            return (a.name || '').localeCompare(b.name || '');
        });

        const rows = accounts.filter(a => a.username !== 'guest').map((a, idx) => {
            const isSelf = a.username === this.SUPERADMIN_USERNAME;
            const isDisabled = a.disabled;
            const badge = isSelf ? '<span style="background:#7c3aed;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.7rem">Super Admin</span>' :
                a.isAdmin ? '<span style="background:#0891b2;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.7rem">Admin</span>' :
                    '<span style="background:#94a3b8;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.7rem">User</span>';
            const statusBadge = isDisabled ? ' <span style="background:#ef4444;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.65rem">Vô hiệu</span>' : '';
            return `<tr style="border-bottom:1px solid var(--border)${isDisabled ? ';opacity:0.5' : ''}">
                <td style="padding:6px 8px"><strong>${a.name}</strong>${statusBadge}</td>
                <td style="padding:6px 8px;color:var(--text-secondary);font-size:0.82rem">${a.username}</td>
                <td style="padding:6px 8px">${badge}</td>
                <td style="padding:6px 8px;text-align:center;white-space:nowrap">
                    ${!isSelf ? `<button class="btn btn-secondary btn-sm" style="font-size:0.72rem" onclick="Auth.openResetPasswordFor('${a.username}','${a.name}')">🔑 MK</button>
                    <button class="btn btn-sm" style="font-size:0.72rem;margin-left:4px;background:${a.isAdmin ? '#ef4444' : '#22c55e'};color:#fff;border:none;cursor:pointer" onclick="Auth.toggleAdmin('${a.username}')">${a.isAdmin ? '🔒 Bỏ Admin' : '🔓 Cấp Admin'}</button>` :
                    '<span style="color:var(--text-secondary);font-size:0.75rem">—</span>'}
                </td>
            </tr>`;
        }).join('');

        Modal.open('👥 Quản lý tài khoản nhân viên', `
            <div style="max-height:60vh;overflow-y:auto">
            <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
                <thead><tr style="border-bottom:2px solid var(--border);background:var(--bg-secondary)">
                    <th style="padding:8px;text-align:left">Họ tên</th>
                    <th style="padding:8px;text-align:left">Username</th>
                    <th style="padding:8px;text-align:left">Quyền</th>
                    <th style="padding:8px;text-align:center">Hành động</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            </div>
            <div style="margin-top:8px;padding:8px;background:var(--bg-secondary);border-radius:6px;font-size:0.78rem;color:var(--text-secondary)">
                <strong>🔐 Bảo mật:</strong> Mật khẩu không được hiển thị. Dùng nút 🔑 MK để đặt lại mật khẩu cho nhân viên.
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" onclick="Modal.close()">Đóng</button>
            </div>
        `);
    },

    openResetPasswordFor(username, name) {
        Modal.open(`Đổi mật khẩu: ${name}`, `
            <form onsubmit="Auth.handleResetPassword(event, '${username}')">
                ${this._pwField('reset-pw-new', `Mật khẩu mới cho <strong>${name}</strong> (${username})`, `required minlength="${this.PASSWORD_MIN_LENGTH}" placeholder="Ít nhất ${this.PASSWORD_MIN_LENGTH} ký tự, có chữ và số"`)}
                <div id="reset-pw-error" style="color:var(--danger);font-size:0.8rem;margin-bottom:8px"></div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Auth.openManagePasswords()">Quay lại</button>
                    <button type="submit" class="btn btn-primary">Cập nhật</button>
                </div>
            </form>
        `);
    },

    async handleResetPassword(e, username) {
        e.preventDefault();
        const newPw = document.getElementById('reset-pw-new').value;
        const passwordError = this.validatePassword(newPw, username);
        if (passwordError) {
            document.getElementById('reset-pw-error').textContent = passwordError;
            return;
        }
        const result = await this.changeUserPassword(username, newPw);
        if (result.success) {
            Toast.success(`Đã đổi mật khẩu thành công cho ${username}!`);
            this.openManagePasswords();
        } else {
            document.getElementById('reset-pw-error').textContent = result.error;
        }
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
                        <img src="img/logo-khoa.jpg" alt="Logo">
                    </div>
                    <h1>Khoa Phẫu thuật Đại trực tràng</h1>
                    <p>Bệnh viện Bình Dân — Đăng nhập hệ thống</p>
                </div>

                <div class="login-error" id="login-error"></div>

                <form class="login-form" id="login-form" onsubmit="LoginPage.handleLogin(event)">
                    <div class="form-group">
                        <label class="form-label">Tên đăng nhập</label>
                        <input class="form-input" type="text" id="login-username" name="username" placeholder="vd: vkan" required autofocus>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Mật khẩu</label>
                        <input class="form-input" type="password" id="login-password" name="password" placeholder="••••••" required>
                    </div>
                    <div class="form-group" style="display:flex;align-items:center;gap:8px;margin-bottom:0">
                        <input type="checkbox" id="login-remember" style="width:16px;height:16px;accent-color:#6366f1">
                        <label for="login-remember" style="font-size:0.82rem;color:#94a3b8;cursor:pointer;user-select:none">Ghi nhớ thiết bị này</label>
                    </div>
                    <button type="submit" class="login-btn">Đăng nhập</button>
                </form>


                <div class="login-footer">
                    © 2026 Khoa Phẫu thuật Đại trực tràng · Bệnh viện Bình Dân
                </div>
            </div>
        </div>
        `;
    },



    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        // Show loading state
        const loginBtn = e.target.querySelector('button[type="submit"]');
        const originalText = loginBtn ? loginBtn.innerHTML : '';
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = '⏳ Đang đăng nhập...';
        }

        const remember = document.getElementById('login-remember')?.checked || false;
        const result = await Auth.login(username, password, remember);

        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalText;
        }

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
