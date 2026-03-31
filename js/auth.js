// ===== AUTHENTICATION MODULE =====
const Auth = {
    SESSION_KEY: 'ptdtt_session',
    ACCOUNTS_KEY: 'ptdtt_accounts',
    CUSTOM_PASSWORDS_KEY: 'ptdtt_custom_passwords',
    SUPERADMIN_USERNAME: 'vkan',
    ACCOUNTS_VERSION: 2, // Increment to force account regeneration

    init() {
        const storedVer = localStorage.getItem('ptdtt_accounts_ver');
        if (!localStorage.getItem(this.ACCOUNTS_KEY) || storedVer != this.ACCOUNTS_VERSION) {
            this.generateAccounts();
            localStorage.setItem('ptdtt_accounts_ver', this.ACCOUNTS_VERSION);
            localStorage.removeItem(this.SESSION_KEY); // force re-login
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

        // Add guest account (view-only, like medical secretary)
        accounts['guest'] = {
            staffId: 0, username: 'guest', password: '12345',
            name: 'Khách', role: 'Khách tham quan', title: '',
            isAdmin: false, isSuperAdmin: false, color: '#94a3b8'
        };

        // Mark super admin
        if (accounts[this.SUPERADMIN_USERNAME]) {
            accounts[this.SUPERADMIN_USERNAME].isSuperAdmin = true;
        }

        // Restore custom passwords: server-synced Store data first, then localStorage fallback
        const serverPw = (Store._data && Store._data.customPasswords) ? Store._data.customPasswords : null;
        const localPw = localStorage.getItem(this.CUSTOM_PASSWORDS_KEY);
        const pwMap = serverPw || (localPw ? JSON.parse(localPw) : {});
        if (Object.keys(pwMap).length > 0) {
            Object.keys(pwMap).forEach(u => {
                if (accounts[u]) accounts[u].password = pwMap[u];
            });
            // Sync to both storage locations
            localStorage.setItem(this.CUSTOM_PASSWORDS_KEY, JSON.stringify(pwMap));
            if (Store._data) {
                Store._data.customPasswords = pwMap;
            }
        }

        localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts));
        return accounts;
    },

    // Generate username: initials of surname+middle + full first name, lowercase, no diacritics
    // e.g. "Vũ Khương An" → "vkan"
    generateUsername(fullName) {
        const parts = fullName.trim().split(/\s+/);
        if (parts.length === 1) return this.removeDiacritics(parts[0].toLowerCase());
        const initials = parts.slice(0, -1).map(p => p[0]).join('');
        const firstName = parts[parts.length - 1];
        return this.removeDiacritics((initials + firstName).toLowerCase());
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

    // Get all accounts — always re-apply latest customPasswords from server-synced Store
    getAccounts() {
        const saved = localStorage.getItem(this.ACCOUNTS_KEY);
        const accounts = saved ? JSON.parse(saved) : this.generateAccounts();
        // Ensure guest account always exists
        if (!accounts['guest']) {
            accounts['guest'] = {
                staffId: 0, username: 'guest', password: '12345',
                name: 'Khách', role: 'Khách tham quan', title: '',
                isAdmin: false, color: '#94a3b8'
            };
        }

        // Always re-apply latest customPasswords from server-synced data
        // This ensures password changes from other devices take effect immediately
        const serverPw = (Store._data && Store._data.customPasswords) ? Store._data.customPasswords : null;
        const localPw = localStorage.getItem(this.CUSTOM_PASSWORDS_KEY);
        const pwMap = serverPw || (localPw ? JSON.parse(localPw) : null);
        if (pwMap) {
            let changed = false;
            Object.keys(pwMap).forEach(u => {
                if (accounts[u] && accounts[u].password !== pwMap[u]) {
                    accounts[u].password = pwMap[u];
                    changed = true;
                }
            });
            if (changed) {
                localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts));
            }
        }

        return accounts;
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
            isSuperAdmin: account.isSuperAdmin || false,
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
            isAdmin: a.isAdmin,
            isSuperAdmin: a.isSuperAdmin || false
        }));
    },

    // ===== PASSWORD CHANGE =====
    // Change own password
    changePassword(currentPw, newPw) {
        const session = this.getSession();
        if (!session) return { success: false, error: 'Chưa đăng nhập' };
        const accounts = this.getAccounts();
        const account = accounts[session.username];
        if (!account) return { success: false, error: 'Tài khoản không tồn tại' };
        if (account.password !== currentPw) return { success: false, error: 'Mật khẩu hiện tại không đúng' };
        if (newPw.length < 4) return { success: false, error: 'Mật khẩu mới phải có ít nhất 4 ký tự' };

        account.password = newPw;
        localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts));
        this._saveCustomPassword(session.username, newPw);
        return { success: true };
    },

    // Super admin changes another user's password
    changeUserPassword(targetUsername, newPw) {
        const session = this.getSession();
        if (!session || !session.isSuperAdmin) return { success: false, error: 'Không có quyền' };
        const accounts = this.getAccounts();
        if (!accounts[targetUsername]) return { success: false, error: 'Tài khoản không tồn tại' };
        if (newPw.length < 4) return { success: false, error: 'Mật khẩu mới phải có ít nhất 4 ký tự' };

        accounts[targetUsername].password = newPw;
        localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts));
        this._saveCustomPassword(targetUsername, newPw);
        return { success: true };
    },

    // Persist custom password so it survives account regeneration AND server sync
    _saveCustomPassword(username, password) {
        const raw = localStorage.getItem(this.CUSTOM_PASSWORDS_KEY);
        const pwMap = raw ? JSON.parse(raw) : {};
        pwMap[username] = password;
        // Save to localStorage
        localStorage.setItem(this.CUSTOM_PASSWORDS_KEY, JSON.stringify(pwMap));
        // Save to server-synced Store data
        if (Store._data) {
            Store._data.customPasswords = pwMap;
            Store.save();
        }
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
                ${this._pwField('pw-new', 'Mật khẩu mới', 'required minlength="4"')}
                ${this._pwField('pw-confirm', 'Xác nhận mật khẩu mới', 'required minlength="4"')}
                <div id="pw-error" style="color:var(--danger);font-size:0.8rem;margin-bottom:8px"></div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>
                    <button type="submit" class="btn btn-primary">Đổi mật khẩu</button>
                </div>
            </form>
        `);
    },

    handleChangePassword(e) {
        e.preventDefault();
        const current = document.getElementById('pw-current').value;
        const newPw = document.getElementById('pw-new').value;
        const confirm = document.getElementById('pw-confirm').value;
        const errEl = document.getElementById('pw-error');

        if (newPw !== confirm) { errEl.textContent = 'Mật khẩu xác nhận không khớp'; return; }
        const result = this.changePassword(current, newPw);
        if (result.success) {
            Modal.close();
            Toast.success('Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại trên các thiết bị khác.', 'Đổi mật khẩu thành công');
        } else {
            errEl.textContent = result.error;
        }
    },

    // Super admin: manage all staff accounts (passwords + admin access)
    openManagePasswords() {
        const session = this.getSession();
        if (!session || !session.isSuperAdmin) return;
        const accounts = this.getAccountList().sort((a,b) => {
            if (a.isSuperAdmin) return -1;
            if (b.isSuperAdmin) return 1;
            if (a.isAdmin && !b.isAdmin) return -1;
            if (!a.isAdmin && b.isAdmin) return 1;
            return a.name.localeCompare(b.name);
        });

        const rows = accounts.filter(a => a.username !== 'guest').map((a, idx) => {
            const isSelf = a.username === this.SUPERADMIN_USERNAME;
            const badge = isSelf ? '<span style="background:#7c3aed;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.7rem">Super Admin</span>' :
                          a.isAdmin ? '<span style="background:#0891b2;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.7rem">Admin</span>' :
                          '<span style="background:#94a3b8;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.7rem">User</span>';
            return `<tr style="border-bottom:1px solid var(--border)">
                <td style="padding:6px 8px"><strong>${a.name}</strong></td>
                <td style="padding:6px 8px;color:var(--text-secondary);font-size:0.82rem">${a.username}</td>
                <td style="padding:6px 8px">
                    <span id="pw-mask-${idx}" style="font-family:monospace;font-size:0.82rem">••••</span>
                    <span id="pw-show-${idx}" style="font-family:monospace;font-size:0.82rem;display:none">${a.password}</span>
                    <button onclick="var m=document.getElementById('pw-mask-${idx}'),s=document.getElementById('pw-show-${idx}');if(m.style.display!=='none'){m.style.display='none';s.style.display='';this.textContent='🙈'}else{m.style.display='';s.style.display='none';this.textContent='👁'}" style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 4px;vertical-align:middle" title="Hiện/ẩn mật khẩu">👁</button>
                </td>
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
                    <th style="padding:8px;text-align:left">Mật khẩu</th>
                    <th style="padding:8px;text-align:left">Quyền</th>
                    <th style="padding:8px;text-align:center">Hành động</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
            </div>
            <div style="margin-top:10px;padding:8px;background:#f0fdf4;border-radius:6px;font-size:0.78rem;color:#166534">
                <strong>Lưu ý:</strong> Admin có quyền xuất Excel, quản lý dữ liệu. Super Admin quản lý tất cả tài khoản.
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" onclick="Modal.close()">Đóng</button>
            </div>
        `);
    },

    // Toggle admin status for a user
    toggleAdmin(username) {
        const session = this.getSession();
        if (!session || !session.isSuperAdmin) return;
        const accounts = this.getAccounts();
        if (!accounts[username] || username === this.SUPERADMIN_USERNAME) return;
        accounts[username].isAdmin = !accounts[username].isAdmin;
        localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts));
        Toast.success(`Đã ${accounts[username].isAdmin ? 'cấp' : 'bỏ'} quyền Admin cho ${accounts[username].name}`);
        this.openManagePasswords(); // Refresh modal
    },

    openResetPasswordFor(username, name) {
        Modal.open(`Đổi mật khẩu: ${name}`, `
            <form onsubmit="Auth.handleResetPassword(event, '${username}')">
                ${this._pwField('reset-pw-new', `Mật khẩu mới cho <strong>${name}</strong> (${username})`, 'required minlength="4" placeholder="Nhập mật khẩu mới"')}
                <div id="reset-pw-error" style="color:var(--danger);font-size:0.8rem;margin-bottom:8px"></div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="Auth.openManagePasswords()">Quay lại</button>
                    <button type="submit" class="btn btn-primary">Cập nhật</button>
                </div>
            </form>
        `);
    },

    handleResetPassword(e, username) {
        e.preventDefault();
        const newPw = document.getElementById('reset-pw-new').value;
        const result = this.changeUserPassword(username, newPw);
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
                    <button type="submit" class="login-btn">Đăng nhập</button>
                </form>


                <div class="login-footer">
                    © 2026 Khoa Phẫu thuật Đại trực tràng · Bệnh viện Bình Dân
                </div>
            </div>
        </div>
        `;
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

