// ===== AUTHENTICATION MODULE (JWT — Phase 3 + P0 Security + Phase-1 Accountability) =====
const Auth = {
    SESSION_KEY: 'ptdtt_session',
    TOKEN_KEY: 'ptdtt_jwt',
    SUPERADMIN_USERNAME: 'vkan',
    PASSWORD_MIN_LENGTH: 10,
    _authEpoch: 1,
    _activeAbortController: null,
    _channel: null,
    _syncBound: false,
    _switchPromptOpen: false,

    init() {
        const token = this.getToken();
        if (token) {
            const payload = this._decodeToken(token);
            if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
                this.logout({ silentBroadcast: true });
            }
        }
        this._bindMultiTabSync();
    },

    _bumpAuthEpoch(reason = 'auth_change') {
        this._authEpoch = (this._authEpoch || 0) + 1;
        if (this._activeAbortController) {
            try { this._activeAbortController.abort(reason); } catch (_) {}
        }
        this._activeAbortController = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        return this._authEpoch;
    },

    getActiveSignal() {
        if (!this._activeAbortController && typeof AbortController !== 'undefined') {
            this._activeAbortController = new AbortController();
        }
        return this._activeAbortController ? this._activeAbortController.signal : undefined;
    },

    _broadcastAuthEvent(type, extra = {}) {
        if (this._channel) {
            try {
                this._channel.postMessage({ type, ts: Date.now(), ...extra });
            } catch (_) {}
        }
    },

    _bindMultiTabSync() {
        if (this._syncBound || typeof window === 'undefined') return;
        this._syncBound = true;

        if (typeof BroadcastChannel !== 'undefined') {
            try {
                this._channel = new BroadcastChannel('ptdtt_auth_sync');
                this._channel.onmessage = (ev) => {
                    this._handleCrossTabAuthSignal(ev?.data || {});
                };
            } catch (_) {
                this._channel = null;
            }
        }

        window.addEventListener('storage', (ev) => {
            if (!ev) return;
            if (ev.key === this.TOKEN_KEY || ev.key === this.SESSION_KEY) {
                this._handleCrossTabAuthSignal({ type: 'storage_sync', key: ev.key });
            }
        });
    },

    _handleCrossTabAuthSignal(msg) {
        // Tab-isolated sessionStorage token stays unaffected unless its own user changed password / revoked epoch
        const tabToken = sessionStorage.getItem(this.TOKEN_KEY);
        if (tabToken) {
            const p = this._decodeToken(tabToken);
            if (msg?.type === 'password_changed' && p && p.sub === msg.username && Number(p.sessionEpoch || 1) < Number(msg.sessionEpoch || 1)) {
                this._bumpAuthEpoch('session_epoch_revoked');
                this.logout({ silentBroadcast: true });
                if (typeof App !== 'undefined' && App.showLogin) App.showLogin(p.sub);
                if (typeof Toast !== 'undefined') {
                    Toast.warning('Mật khẩu tài khoản vừa được đổi ở tab khác. Vui lòng đăng nhập lại.');
                }
                return;
            }
            // Refresh UI header from this tab's own JWT claims so localStorage writes in another tab never overwrite our header
            if (typeof App !== 'undefined' && Auth.isLoggedIn()) {
                App.updateSidebarUser?.();
                App.updateMobileHeader?.();
            }
            return;
        }

        // Shared localStorage token changed across tabs
        this._bumpAuthEpoch('cross_tab_storage_change');
        const nextSession = this.getSession();
        if (!nextSession) {
            if (typeof Store !== 'undefined' && Store.resetForLogout) Store.resetForLogout();
            if (typeof App !== 'undefined' && App.showLogin) App.showLogin();
            return;
        }
        if (typeof SurgeryApprovalPage !== 'undefined' && SurgeryApprovalPage.hasUnsavedDraft && SurgeryApprovalPage.hasUnsavedDraft()) {
            SurgeryApprovalPage.DiscardDraftOnAccountChange?.(nextSession);
        }
        if (typeof Store !== 'undefined' && Store.reconcilePendingForSession) {
            Store.reconcilePendingForSession();
            Store._syncFromServer?.(true);
        }
        if (typeof App !== 'undefined') {
            App.updateSidebarUser?.();
            App.updateMobileHeader?.();
            App.updateNavVisibility?.();
            App.renderCurrentPage?.();
        }
    },

    // ===== TOKEN MANAGEMENT =====
    // Token is stored in sessionStorage by default (tab-isolated, cleared on browser close).
    // Stored in localStorage ONLY when user checks "Ghi nhớ thiết bị này".
    getToken() {
        return sessionStorage.getItem(this.TOKEN_KEY) || localStorage.getItem(this.TOKEN_KEY);
    },

    _isRememberedToken() {
        return !sessionStorage.getItem(this.TOKEN_KEY) && Boolean(localStorage.getItem(this.TOKEN_KEY));
    },

    _saveToken(token, remember = false) {
        if (remember) {
            sessionStorage.removeItem(this.TOKEN_KEY);
            localStorage.setItem(this.TOKEN_KEY, token);
        } else {
            sessionStorage.setItem(this.TOKEN_KEY, token);
            localStorage.removeItem(this.TOKEN_KEY);
        }
    },

    _saveSessionCache(session, remember = false) {
        const raw = JSON.stringify(session);
        sessionStorage.setItem(this.SESSION_KEY, raw);
        if (remember) {
            localStorage.setItem(this.SESSION_KEY, raw);
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

            this._bumpAuthEpoch('login');
            this._saveToken(result.token, remember);

            const session = {
                staffId: result.user.staffId,
                username: result.user.username,
                name: result.user.name,
                role: result.user.role,
                title: result.user.title || '',
                isAdmin: result.user.isAdmin,
                isSuperAdmin: result.user.isSuperAdmin || false,
                mustChangePassword: Boolean(result.user.mustChangePassword || result.mustChangePassword),
                sessionEpoch: Number(result.user.sessionEpoch || 1),
                color: result.user.color || '#1878B4',
                loginTime: new Date().toISOString()
            };
            this._saveSessionCache(session, remember);
            if (remember) {
                this._broadcastAuthEvent('login', { username: session.username, staffId: session.staffId });
            }

            return { success: true, session };
        } catch (e) {
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
                this.logout({ silentBroadcast: true });
                return null;
            }

            const user = await response.json();
            const session = {
                staffId: user.staffId,
                username: user.username,
                name: user.name,
                role: user.role,
                title: user.title || '',
                isAdmin: user.isAdmin,
                isSuperAdmin: user.isSuperAdmin || false,
                mustChangePassword: Boolean(user.mustChangePassword),
                sessionEpoch: Number(user.sessionEpoch || 1),
                color: user.color || '#1878B4',
                loginTime: new Date().toISOString()
            };
            this._saveSessionCache(session, this._isRememberedToken());
            return session;
        } catch (e) {
            console.warn('[Auth] Cannot reach server for session validation:', e.message);
            return null;
        }
    },

    isLocalHost() {
        return typeof window !== 'undefined' &&
            window.location &&
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    },

    async tryLocalAutoLogin() {
        if (!this.isLocalHost()) return { success: false };
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return { success: false };
        }
        try {
            const response = await fetch('/api/auth/local-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store'
            });
            if (!response.ok) return { success: false };
            const result = await response.json();
            if (!result || !result.token || !result.user) return { success: false };

            this._bumpAuthEpoch('local_auto_login');
            this._saveToken(result.token, true);
            sessionStorage.setItem(this.TOKEN_KEY, result.token);
            const session = {
                staffId: result.user.staffId,
                username: result.user.username,
                name: result.user.name,
                role: result.user.role,
                title: result.user.title || '',
                isAdmin: result.user.isAdmin,
                isSuperAdmin: result.user.isSuperAdmin || false,
                mustChangePassword: Boolean(result.user.mustChangePassword),
                sessionEpoch: Number(result.user.sessionEpoch || 1),
                color: result.user.color || '#1878B4',
                loginTime: new Date().toISOString()
            };
            this._saveSessionCache(session, true);
            if (!localStorage.getItem('ptdtt_onboarding_done')) {
                localStorage.setItem('ptdtt_onboarding_done', 'true');
            }
            return { success: true, session };
        } catch (e) {
            return { success: false };
        }
    },

    // Logout — aborts in-flight requests, isolates pending queue per ownerKey, clears sensitive cache
    logout(opts = {}) {
        const wasRemembered = this._isRememberedToken();
        this._bumpAuthEpoch('logout');
        if (typeof Store !== 'undefined' && typeof Store.resetForLogout === 'function') {
            Store.resetForLogout();
        }
        this._removeToken();
        sessionStorage.removeItem(this.SESSION_KEY);
        if (wasRemembered || !opts.preserveSharedSession) {
            localStorage.removeItem(this.SESSION_KEY);
        }
        localStorage.removeItem('ptdtt_lastActivity');
        localStorage.removeItem('ptdtt_manager');
        if (!opts.silentBroadcast && wasRemembered) {
            this._broadcastAuthEvent('logout');
        }
    },

    // Get current session — ALWAYS derived from the active tab's JWT claims to prevent cross-tab identity spoofing
    getSession() {
        const token = this.getToken();
        if (!token) return null;

        const payload = this._decodeToken(token);
        if (!payload || !payload.sub || (payload.exp && payload.exp * 1000 < Date.now())) {
            this.logout({ silentBroadcast: true });
            return null;
        }

        let matched = null;
        for (const raw of [sessionStorage.getItem(this.SESSION_KEY), localStorage.getItem(this.SESSION_KEY)]) {
            if (!raw) continue;
            try {
                const parsed = JSON.parse(raw);
                if (
                    parsed &&
                    String(parsed.username || '').toLowerCase() === String(payload.sub || '').toLowerCase() &&
                    Number(parsed.staffId || 0) === Number(payload.staffId || 0)
                ) {
                    matched = parsed;
                    break;
                }
            } catch (_) {}
        }

        return {
            staffId: payload.staffId,
            username: payload.sub,
            name: (matched && matched.name) || payload.name || payload.sub,
            role: payload.role || (matched && matched.role) || '',
            title: (matched && matched.title !== undefined) ? matched.title : (payload.title || ''),
            isAdmin: Boolean(payload.isAdmin),
            isSuperAdmin: Boolean(payload.isSuperAdmin),
            mustChangePassword: Boolean(payload.mustChangePassword || (matched && matched.mustChangePassword)),
            sessionEpoch: Number(payload.sessionEpoch || (matched && matched.sessionEpoch) || 1),
            color: (matched && matched.color) || payload.color || '#1878B4',
            loginTime: (matched && matched.loginTime) || null
        };
    },

    // Check if logged in
    isLoggedIn() {
        return this.getSession() !== null;
    },

    // ===== PASSWORD CHANGE =====
    async changePassword(currentPw, newPw) {
        const token = this.getToken();
        if (!token) return { success: false, error: 'Chưa đăng nhập' };
        const remembered = this._isRememberedToken();

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
            if (result.token) {
                this._saveToken(result.token, remembered);
            }
            if (result.user) {
                const updatedSession = {
                    staffId: result.user.staffId,
                    username: result.user.username,
                    name: result.user.name,
                    role: result.user.role,
                    title: result.user.title || '',
                    isAdmin: result.user.isAdmin,
                    isSuperAdmin: result.user.isSuperAdmin || false,
                    mustChangePassword: false,
                    sessionEpoch: Number(result.user.sessionEpoch || 1),
                    color: result.user.color || '#1878B4',
                    loginTime: new Date().toISOString()
                };
                this._saveSessionCache(updatedSession, remembered);
                this._broadcastAuthEvent('password_changed', {
                    username: updatedSession.username,
                    sessionEpoch: updatedSession.sessionEpoch
                });
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
            <div class="pw-toggle-wrap">
                <input class="form-input" type="password" id="${id}" ${extra}>
                <button type="button" onclick="Auth._togglePw('${id}',this)" class="pw-toggle-btn" title="Hiện/ẩn mật khẩu">
                    <span class="eye-on">${eyeOn}</span><span class="eye-off">${eyeOff}</span>
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

    openChangePassword(opts = {}) {
        const session = this.getSession();
        if (!session) return;
        const mandatory = Boolean(opts.mandatory || session.mustChangePassword);
        const closeBtn = document.getElementById('modal-close');
        if (closeBtn) closeBtn.style.display = mandatory ? 'none' : '';
        Modal.open(mandatory ? '🔐 Đổi mật khẩu bắt buộc lần đầu' : '🔑 Đổi mật khẩu cá nhân', `
            ${mandatory ? `<div class="sap-banner-info" style="margin-bottom:12px;padding:10px 12px;border-radius:8px;background:rgba(24,120,180,0.1);border-left:4px solid #1878B4;font-size:0.86rem;line-height:1.45;">
                Tài khoản <strong>${Utils.escapeHtml(session.title ? session.title + ' ' + session.name : session.name)}</strong> đang dùng mật khẩu mặc định trùng tên đăng nhập. Vui lòng đặt mật khẩu cá nhân mới (tối thiểu ${this.PASSWORD_MIN_LENGTH} ký tự, gồm chữ cái và chữ số) để ghi nhận trách nhiệm chuẩn bị / duyệt mổ chính xác.
            </div>` : ''}
            <form onsubmit="Auth.handleChangePassword(event)">
                ${this._pwField('pw-current', 'Mật khẩu hiện tại', 'required')}
                ${this._pwField('pw-new', `Mật khẩu mới (ít nhất ${this.PASSWORD_MIN_LENGTH} ký tự, có chữ và số)`, `required minlength="${this.PASSWORD_MIN_LENGTH}"`)}
                ${this._pwField('pw-confirm', 'Xác nhận mật khẩu mới', `required minlength="${this.PASSWORD_MIN_LENGTH}"`)}
                <div id="pw-error" class="pw-error"></div>
                <div class="modal-footer">
                    ${mandatory
                        ? `<button type="button" class="btn btn-secondary" onclick="Auth._logoutFromMandatoryModal()">Đăng xuất / Đổi TK</button>`
                        : `<button type="button" class="btn btn-secondary" onclick="Modal.close()">Huỷ</button>`}
                    <button type="submit" class="btn btn-primary">Lưu mật khẩu mới</button>
                </div>
            </form>
        `);
    },

    openMandatoryPasswordChangeModal() {
        this.openChangePassword({ mandatory: true });
    },

    _logoutFromMandatoryModal() {
        const closeBtn = document.getElementById('modal-close');
        if (closeBtn) closeBtn.style.display = '';
        try { Modal.close(); } catch (_) {}
        this.logout();
        if (typeof App !== 'undefined' && App.showLogin) App.showLogin();
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
            const closeBtn = document.getElementById('modal-close');
            if (closeBtn) closeBtn.style.display = '';
            Modal.close();
            if (typeof App !== 'undefined') {
                App.updateSidebarUser?.();
                App.updateMobileHeader?.();
            }
            Toast.success('Mật khẩu cá nhân đã được cập nhật. Các phiên cũ trên thiết bị khác đã được thu hồi.', 'Đổi mật khẩu thành công');
        } else {
            errEl.textContent = result.error;
        }
    },

    // Quick account switch on shared hospital PCs / ward iPads with unsaved-draft protection
    async quickSwitchAccount(preselectUsername = '') {
        if (typeof SurgeryApprovalPage !== 'undefined' && typeof SurgeryApprovalPage.hasUnsavedDraft === 'function' && SurgeryApprovalPage.hasUnsavedDraft()) {
            if (this._switchPromptOpen) return;
            this._switchPromptOpen = true;
            const curSession = this.getSession();
            const curLabel = curSession ? `${curSession.title ? curSession.title + ' ' : ''}${curSession.name}` : 'tài khoản hiện tại';
            Modal.open('⚠️ Hồ sơ chuẩn bị mổ chưa lưu nháp', `
                <div style="font-size:0.9rem;line-height:1.5;margin-bottom:14px;">
                    Bạn đang có thay đổi chưa lưu trên hồ sơ duyệt mổ dưới phiên của <strong>${Utils.escapeHtml(curLabel)}</strong>.
                    Trước khi chuyển tài khoản, vui lòng chọn:
                </div>
                <div class="modal-footer" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
                    <button type="button" class="btn btn-secondary" onclick="Auth._cancelQuickSwitchPrompt()">Ở lại tiếp tục</button>
                    <button type="button" class="btn btn-secondary" onclick="Auth._proceedQuickSwitch('${Utils.escapeHtml(preselectUsername)}', false)">Hủy thay đổi chưa lưu</button>
                    <button type="button" class="btn btn-primary" onclick="Auth._proceedQuickSwitch('${Utils.escapeHtml(preselectUsername)}', true)">💾 Lưu nháp dưới tên tài khoản đang mở</button>
                </div>
            `);
            return;
        }
        await this._executeQuickSwitchLogout(preselectUsername);
    },

    _cancelQuickSwitchPrompt() {
        this._switchPromptOpen = false;
        Modal.close();
    },

    async _proceedQuickSwitch(preselectUsername, saveFirst) {
        this._switchPromptOpen = false;
        if (saveFirst && typeof SurgeryApprovalPage !== 'undefined' && typeof SurgeryApprovalPage.flushPendingDraftBeforeSwitch === 'function') {
            const ok = await SurgeryApprovalPage.flushPendingDraftBeforeSwitch();
            if (!ok) return;
        } else if (typeof SurgeryApprovalPage !== 'undefined' && typeof SurgeryApprovalPage.discardOpenDraft === 'function') {
            SurgeryApprovalPage.discardOpenDraft();
        }
        try { Modal.close(); } catch (_) {}
        await this._executeQuickSwitchLogout(preselectUsername);
    },

    async _executeQuickSwitchLogout(preselectUsername = '') {
        const tok = this.getToken();
        if (tok) {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json' },
                body: '{}'
            }).catch(() => {});
        }
        this.logout();
        if (typeof App !== 'undefined' && App.showLogin) {
            App.showLogin(preselectUsername);
        }
    },

    // Super admin: manage all staff accounts
    async openManagePasswords() {
        const session = this.getSession();
        if (!session || !session.isSuperAdmin) return;

        // Show loading
        Modal.open('👥 Quản lý tài khoản nhân viên', `
            <div class="auth-loading">
                <div class="spinner"></div>
                <p class="auth-loading-text">Đang tải danh sách tài khoản...</p>
            </div>
        `);

        const accounts = await this._fetchAccounts();
        if (accounts.length === 0) {
            Modal.open('👥 Quản lý tài khoản nhân viên', `
                <div class="auth-empty">
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
            const badge = isSelf ? '<span class="auth-badge-superadmin">Super Admin</span>' :
                a.isAdmin ? '<span class="auth-badge-admin">Admin</span>' :
                    '<span class="auth-badge-user">User</span>';
            const statusBadge = isDisabled ? ' <span class="auth-badge-disabled">Vô hiệu</span>' : '';
            return `<tr class="auth-table-row${isDisabled ? ' disabled' : ''}">
                <td class="auth-td-main"><strong>${a.name}</strong>${statusBadge}</td>
                <td class="auth-td-user">${a.username}</td>
                <td class="auth-td-badge">${badge}</td>
                <td class="auth-td-actions">
                    ${!isSelf ? `<button class="btn btn-secondary btn-sm auth-btn-mk" onclick="Auth.openResetPasswordFor('${a.username}','${a.name}')">🔑 MK</button>
                    <button class="btn btn-sm" style="margin-left:4px;background:${a.isAdmin ? '#ef4444' : '#22c55e'};color:#fff;border:none;cursor:pointer;font-size:var(--text-xxs,0.6667rem)" onclick="Auth.toggleAdmin('${a.username}')">${a.isAdmin ? '🔒 Bỏ Admin' : '🔓 Cấp Admin'}</button>` :
                    '<span class="auth-td-self">—</span>'}
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
                <div id="reset-pw-error" class="pw-error"></div>
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

// ===== LOGIN PAGE RENDERER (with 1-Tap Staff Cards for Fast Ward Login) =====
const LoginPage = {
    _staffCards: null,
    _selectedUsername: '',
    _filterGroup: 'doctors',

    render(preselectUsername = '') {
        if (preselectUsername) {
            this._selectedUsername = preselectUsername;
        }
        setTimeout(() => this._ensureStaffCardsLoaded(), 0);
        return `
        <div class="login-page">
            <button class="login-theme-toggle" onclick="App.toggleTheme()"
                title="${this._isDark() ? 'Giao diện sáng' : 'Giao diện tối'}"
                aria-label="${this._isDark() ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}">
                ${this._isDark()
                    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
                    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
                }
            </button>
            <div class="login-card">
                <div class="login-logo">
                    <div class="login-logo-icon">
                        <img src="img/logo-khoa.jpg" alt="Logo">
                    </div>
                    <h1>Khoa Phẫu thuật Đại trực tràng</h1>
                    <p>Bệnh viện Bình Dân — Đăng nhập hệ thống</p>
                </div>

                <div class="login-error" id="login-error"></div>

                <div class="login-staff-picker" id="login-staff-picker">
                    ${this._renderStaffCardsInner()}
                </div>

                <form class="login-form" id="login-form" onsubmit="LoginPage.handleLogin(event)">
                    <div class="form-group">
                        <label class="form-label">Tên đăng nhập</label>
                        <input class="form-input" type="text" id="login-username" name="username" value="${Utils.escapeHtml(this._selectedUsername || '')}" placeholder="Chạm thẻ tên phía trên hoặc nhập username" required ${this._selectedUsername ? '' : 'autofocus'}>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Mật khẩu cá nhân</label>
                        <input class="form-input" type="password" id="login-password" name="password" placeholder="••••••" required ${this._selectedUsername ? 'autofocus' : ''}>
                    </div>
                    <div class="login-remember-row">
                        <input type="checkbox" id="login-remember">
                        <label for="login-remember">Ghi nhớ thiết bị cá nhân này (không chọn trên máy dùng chung tại khoa)</label>
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

    async _ensureStaffCardsLoaded() {
        if (!Array.isArray(this._staffCards)) {
            try {
                const resp = await fetch('/api/auth/staff-cards', { cache: 'no-store' });
                if (resp.ok) {
                    const data = await resp.json();
                    this._staffCards = Array.isArray(data.cards) ? data.cards : [];
                } else {
                    this._staffCards = [];
                }
            } catch (_) {
                this._staffCards = [];
            }
        }
        const host = document.getElementById('login-staff-picker');
        if (host) {
            host.innerHTML = this._renderStaffCardsInner();
        }
    },

    setFilterGroup(grp) {
        this._filterGroup = grp;
        const host = document.getElementById('login-staff-picker');
        if (host) host.innerHTML = this._renderStaffCardsInner();
    },

    selectStaffCard(username) {
        this._selectedUsername = username;
        const uInp = document.getElementById('login-username');
        const pInp = document.getElementById('login-password');
        if (uInp) uInp.value = username;
        const host = document.getElementById('login-staff-picker');
        if (host) host.innerHTML = this._renderStaffCardsInner();
        if (pInp) {
            pInp.value = '';
            pInp.focus();
        }
    },

    _renderStaffCardsInner() {
        if (!Array.isArray(this._staffCards) || this._staffCards.length === 0) {
            return '';
        }
        const grp = this._filterGroup || 'doctors';
        const filtered = this._staffCards.filter(c => {
            if (grp === 'doctors') return c.group === 'bcn' || c.group === 'attending';
            if (grp === 'trainee') return c.group === 'trainee';
            if (grp === 'nursing') return c.group === 'nursing_admin';
            return true;
        });
        const chips = filtered.map(c => {
            const active = c.username === this._selectedUsername;
            const shortTitle = (c.title || '').replace(/\s+/g, ' ').trim();
            const label = shortTitle ? `${shortTitle} ${c.name}` : c.name;
            return `<button type="button" class="login-staff-chip${active ? ' active' : ''}" onclick="LoginPage.selectStaffCard('${Utils.escapeHtml(c.username)}')" title="${Utils.escapeHtml(label)} (${Utils.escapeHtml(c.username)})">
                <span class="login-staff-chip__dot" style="background:${Utils.escapeHtml(c.color || '#1878B4')}"></span>
                <span class="login-staff-chip__name">${Utils.escapeHtml(c.name)}</span>
            </button>`;
        }).join('');

        return `
            <div class="login-staff-picker__hdr">
                <span class="login-staff-picker__lbl">⚡ Chạm chọn nhanh tài khoản:</span>
                <div class="login-staff-picker__tabs">
                    <button type="button" class="login-staff-tab${grp === 'doctors' ? ' active' : ''}" onclick="LoginPage.setFilterGroup('doctors')">BS Khoa</button>
                    <button type="button" class="login-staff-tab${grp === 'trainee' ? ' active' : ''}" onclick="LoginPage.setFilterGroup('trainee')">BSNT / HV</button>
                    <button type="button" class="login-staff-tab${grp === 'nursing' ? ' active' : ''}" onclick="LoginPage.setFilterGroup('nursing')">ĐD / Khác</button>
                </div>
            </div>
            <div class="login-staff-picker__grid">${chips}</div>
        `;
    },

    _isDark() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    },

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

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
            this._selectedUsername = '';
            App.onLoginSuccess();
        } else {
            const errEl = document.getElementById('login-error');
            errEl.textContent = result.error;
            errEl.classList.add('show');
            const card = document.querySelector('.login-card');
            if (card) {
                card.style.animation = 'none';
                card.offsetHeight;
                card.style.animation = 'shake 0.4s ease';
            }
        }
    }
};
