#!/usr/bin/env python3
"""
PTDTT Manager — Flask Production Server
Serves the web app + JSON data API + EMR Proxy.
"""

import os
import json
import re
import uuid
import ssl
import threading
import glob
from datetime import datetime, timedelta
from urllib.parse import urlencode
from http.cookiejar import CookieJar
import urllib.request
import urllib.error

from flask import Flask, request, jsonify, send_from_directory, abort, Response
import base64
import jwt as pyjwt
import bcrypt
from functools import wraps

# ────────────────────────────── Config ──────────────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_DIR  = os.path.join(BASE_DIR, 'data')
DATA_FILE = os.path.join(DATA_DIR, 'db.json')
LOG_DIR   = os.path.join(BASE_DIR, 'logs')
AUTH_FILE = os.path.join(DATA_DIR, 'auth.json')
JWT_SECRET = os.environ.get('JWT_SECRET', 'ptdtt-secret-key-' + str(uuid.uuid4())[:8])
JWT_EXPIRY_DAYS = 30
PORT      = int(os.environ.get('PORT', 5000))

# EMR
EMR_BASE          = 'https://emr.com.vn:83'
EMR_DATA_URL      = f'{EMR_BASE}/DienBienLamSang/Index1'
EMR_LOGIN_URL     = EMR_BASE + '/'
EMR_LOGIN_POST_URL= EMR_BASE + '/'
EMR_USER = os.environ.get('EMR_USER', 'VKAN')
EMR_PASS = os.environ.get('EMR_PASS', 'anmd3010')

# ────────────────────────────── Flask App ──────────────────────────────
app = Flask(__name__, static_folder=None)

# Prevent caching on API responses
@app.after_request
def add_no_cache_headers(response):
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

# Thread-safe data lock
_data_lock = threading.Lock()

# ────────────────────────────── Data helpers ──────────────────────────────
def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({}, f)

def _get_file_version():
    """Get file modification time as version string (works across all workers)"""
    try:
        return str(os.path.getmtime(DATA_FILE))
    except Exception:
        return '0'

def load_data():
    _ensure_data_dir()
    with _data_lock:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)

def save_data(data):
    _ensure_data_dir()
    data['_lastModified'] = datetime.now().isoformat()
    with _data_lock:
        tmp = DATA_FILE + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, DATA_FILE)

# ────────────────────────────── Audit Logging ──────────────────────────────
def _ensure_log_dir():
    os.makedirs(LOG_DIR, exist_ok=True)

def audit_log(user, action, details=None):
    """Write an audit log entry (JSON Lines format, daily files)"""
    _ensure_log_dir()
    today = datetime.now().strftime('%Y-%m-%d')
    log_file = os.path.join(LOG_DIR, f'audit_{today}.jsonl')
    entry = {
        'ts': datetime.now().isoformat(),
        'user': user or 'anonymous',
        'action': action,
        'ip': request.remote_addr if request else None,
        'details': details
    }
    try:
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    except Exception as e:
        print(f'[Audit] Error writing log: {e}')

def _cleanup_old_logs(days=90):
    """Remove audit logs older than N days"""
    _ensure_log_dir()
    cutoff = datetime.now() - timedelta(days=days)
    for f in glob.glob(os.path.join(LOG_DIR, 'audit_*.jsonl')):
        try:
            date_str = os.path.basename(f).replace('audit_', '').replace('.jsonl', '')
            file_date = datetime.strptime(date_str, '%Y-%m-%d')
            if file_date < cutoff:
                os.remove(f)
        except Exception:
            pass

# ────────────────────────────── Static files ──────────────────────────────
@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    full = os.path.normpath(os.path.join(BASE_DIR, path))
    if not full.startswith(BASE_DIR):
        abort(403)
    if os.path.isfile(full):
        directory = os.path.dirname(full)
        filename = os.path.basename(full)
        return send_from_directory(directory, filename)
    abort(404)

# ────────────────────────────── Data API ──────────────────────────────
@app.route('/api/data', methods=['GET'])
def get_data():
    """Return the entire JSON database"""
    data = load_data()
    return jsonify(data)

@app.route('/api/data', methods=['PUT'])
def put_data():
    """Replace the entire JSON database"""
    data = request.get_json(force=True)
    user = request.headers.get('X-User', 'unknown')
    audit_log(user, 'data.put', {'size': len(json.dumps(data))})
    save_data(data)
    return jsonify({'ok': True, 'version': _get_file_version()})

@app.route('/api/data/version', methods=['GET'])
def get_data_version():
    """Lightweight version check — uses file mtime (works across all gunicorn workers)"""
    return jsonify({'version': _get_file_version()})

@app.route('/api/download-image', methods=['POST'])
def download_image():
    """Receive base64 image data, return as file download with proper filename"""
    body = request.get_json(force=True)
    data_url = body.get('image', '')
    filename = body.get('filename', 'export.jpg')

    # Parse data URL: data:image/jpeg;base64,/9j/4AAQ...
    if ',' in data_url:
        img_data = base64.b64decode(data_url.split(',', 1)[1])
    else:
        return jsonify({'error': 'Invalid image data'}), 400

    return Response(
        img_data,
        mimetype='image/jpeg',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Content-Length': str(len(img_data))
        }
    )

@app.route('/api/data/<collection>', methods=['GET'])
def get_collection(collection):
    """Return a single collection"""
    data = load_data()
    return jsonify(data.get(collection, []))

@app.route('/api/data/<collection>', methods=['PUT'])
def put_collection(collection):
    """Replace a single collection"""
    items = request.get_json(force=True)
    user = request.headers.get('X-User', 'unknown')
    audit_log(user, f'collection.put.{collection}', {'count': len(items) if isinstance(items, list) else 1})
    data = load_data()
    data[collection] = items
    save_data(data)
    return jsonify({'ok': True})

# ────────────────────────────── Audit API ──────────────────────────────
@app.route('/api/audit', methods=['GET'])
def get_audit_logs():
    """Return audit logs (superadmin only, checked client-side)"""
    _ensure_log_dir()
    days = int(request.args.get('days', 7))
    logs = []
    for i in range(days):
        d = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
        log_file = os.path.join(LOG_DIR, f'audit_{d}.jsonl')
        if os.path.exists(log_file):
            with open(log_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            logs.append(json.loads(line))
                        except Exception:
                            pass
    # Sort newest first
    logs.sort(key=lambda x: x.get('ts', ''), reverse=True)
    return jsonify({'logs': logs, 'total': len(logs)})

# ────────────────────────────── Auth Helpers ──────────────────────────────
_auth_lock = threading.Lock()

def _load_auth():
    """Load auth data from auth.json"""
    if not os.path.exists(AUTH_FILE):
        return {'users': {}}
    with _auth_lock:
        with open(AUTH_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)

def _save_auth(data):
    """Save auth data to auth.json"""
    _ensure_data_dir()
    with _auth_lock:
        tmp = AUTH_FILE + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, AUTH_FILE)

def _hash_password(password):
    """Hash a password with bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def _check_password(password, hashed):
    """Check a password against its bcrypt hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def _create_jwt(username, user_data):
    """Create a JWT token for a user"""
    payload = {
        'sub': username,
        'name': user_data.get('name', ''),
        'role': user_data.get('role', ''),
        'isAdmin': user_data.get('isAdmin', False),
        'isSuperAdmin': user_data.get('isSuperAdmin', False),
        'staffId': user_data.get('staffId', 0),
        'exp': datetime.utcnow() + timedelta(days=JWT_EXPIRY_DAYS),
        'iat': datetime.utcnow()
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm='HS256')

def _verify_jwt(token):
    """Verify and decode a JWT token"""
    try:
        return pyjwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except pyjwt.ExpiredSignatureError:
        return None
    except pyjwt.InvalidTokenError:
        return None

def _init_auth_from_db():
    """Initialize auth.json from existing client-side accounts (one-time migration)"""
    auth = _load_auth()
    if auth.get('users') and len(auth['users']) > 0:
        return  # Already initialized

    # Read custom passwords from db.json
    db_data = load_data()
    custom_pw = db_data.get('customPasswords', {})
    custom_admins = db_data.get('customAdmins', {})
    disabled = db_data.get('disabledAccounts', [])

    # Read staff to generate default accounts
    staff = db_data.get('staff', [])
    users = {}

    for s in staff:
        # Generate username same way as client-side Auth.generateUsername
        name = s.get('name', '')
        parts = name.split()
        if len(parts) >= 2:
            username = ''.join(p[0].lower() for p in parts[:-1]) + parts[-1].lower()
            # Remove Vietnamese diacritics
            import unicodedata
            username = ''.join(
                c for c in unicodedata.normalize('NFD', username)
                if unicodedata.category(c) != 'Mn'
            )
            username = username.replace('đ', 'd').replace('Đ', 'D')
        else:
            username = name.lower()

        # Default password = first letter of each word (lowercase, no diacritics) + last word
        default_pw = username  # Simple: same as username for default
        # Use custom password if set
        password = custom_pw.get(username, default_pw)

        is_admin = s.get('role', '').find('Trưởng khoa') >= 0 or \
                   s.get('role', '').find('Phó trưởng khoa') >= 0 or \
                   s.get('role', '') == 'Điều dưỡng trưởng'

        # Apply custom admin status
        if username in custom_admins:
            is_admin = custom_admins[username]

        users[username] = {
            'passwordHash': _hash_password(password),
            'name': s.get('name', ''),
            'role': s.get('role', ''),
            'title': s.get('title', ''),
            'staffId': s.get('id', 0),
            'isAdmin': is_admin,
            'isSuperAdmin': username == 'vkan',
            'disabled': s.get('id', 0) in disabled,
            'color': s.get('color', '#6366f1')
        }

    # Add guest account
    users['guest'] = {
        'passwordHash': _hash_password('12345'),
        'name': 'Khách',
        'role': 'Khách tham quan',
        'title': '',
        'staffId': 0,
        'isAdmin': False,
        'isSuperAdmin': False,
        'disabled': False,
        'color': '#94a3b8'
    }

    auth['users'] = users
    auth['_initialized'] = datetime.now().isoformat()
    _save_auth(auth)
    print(f'[Auth] ✅ Initialized {len(users)} accounts from db.json')

# ────────────────────────────── Auth API ──────────────────────────────
@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    """Authenticate user, return JWT token"""
    body = request.get_json(force=True)
    username = body.get('username', '').strip().lower()
    password = body.get('password', '')

    auth = _load_auth()
    user = auth.get('users', {}).get(username)

    if not user:
        audit_log(username, 'auth.login.fail', {'reason': 'not_found'})
        return jsonify({'error': 'Tài khoản không tồn tại'}), 401

    if user.get('disabled'):
        audit_log(username, 'auth.login.fail', {'reason': 'disabled'})
        return jsonify({'error': 'Tài khoản đã bị vô hiệu hoá. Liên hệ quản trị viên.'}), 403

    if not _check_password(password, user['passwordHash']):
        audit_log(username, 'auth.login.fail', {'reason': 'wrong_password'})
        return jsonify({'error': 'Mật khẩu không đúng'}), 401

    token = _create_jwt(username, user)
    audit_log(username, 'auth.login.success')

    return jsonify({
        'token': token,
        'user': {
            'username': username,
            'name': user['name'],
            'role': user['role'],
            'title': user.get('title', ''),
            'staffId': user['staffId'],
            'isAdmin': user['isAdmin'],
            'isSuperAdmin': user.get('isSuperAdmin', False),
            'color': user.get('color', '#6366f1')
        }
    })

@app.route('/api/auth/me', methods=['GET'])
def auth_me():
    """Return current user info from JWT"""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Not authenticated'}), 401

    payload = _verify_jwt(auth_header[7:])
    if not payload:
        return jsonify({'error': 'Token expired or invalid'}), 401

    return jsonify({
        'username': payload['sub'],
        'name': payload.get('name', ''),
        'role': payload.get('role', ''),
        'isAdmin': payload.get('isAdmin', False),
        'isSuperAdmin': payload.get('isSuperAdmin', False),
        'staffId': payload.get('staffId', 0)
    })

@app.route('/api/auth/password', methods=['PUT'])
def auth_change_password():
    """Change own password"""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Not authenticated'}), 401

    payload = _verify_jwt(auth_header[7:])
    if not payload:
        return jsonify({'error': 'Token expired'}), 401

    body = request.get_json(force=True)
    old_pw = body.get('oldPassword', '')
    new_pw = body.get('newPassword', '')

    if len(new_pw) < 3:
        return jsonify({'error': 'Mật khẩu mới phải có ít nhất 3 ký tự'}), 400

    auth = _load_auth()
    user = auth['users'].get(payload['sub'])
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if not _check_password(old_pw, user['passwordHash']):
        return jsonify({'error': 'Mật khẩu cũ không đúng'}), 401

    user['passwordHash'] = _hash_password(new_pw)
    _save_auth(auth)
    audit_log(payload['sub'], 'auth.password.change')
    return jsonify({'ok': True})

@app.route('/api/auth/admin/password', methods=['PUT'])
def auth_admin_change_password():
    """Super admin changes another user's password"""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Not authenticated'}), 401

    payload = _verify_jwt(auth_header[7:])
    if not payload or not payload.get('isSuperAdmin'):
        return jsonify({'error': 'Unauthorized'}), 403

    body = request.get_json(force=True)
    target_user = body.get('username', '')
    new_pw = body.get('newPassword', '')

    auth = _load_auth()
    user = auth['users'].get(target_user)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    user['passwordHash'] = _hash_password(new_pw)
    _save_auth(auth)
    audit_log(payload['sub'], 'auth.admin.password.reset', {'target': target_user})
    return jsonify({'ok': True})

@app.route('/api/auth/admin/toggle', methods=['PUT'])
def auth_admin_toggle():
    """Super admin toggles admin status"""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Not authenticated'}), 401

    payload = _verify_jwt(auth_header[7:])
    if not payload or not payload.get('isSuperAdmin'):
        return jsonify({'error': 'Unauthorized'}), 403

    body = request.get_json(force=True)
    target_user = body.get('username', '')

    auth = _load_auth()
    user = auth['users'].get(target_user)
    if not user or target_user == 'vkan':
        return jsonify({'error': 'Cannot modify this user'}), 400

    user['isAdmin'] = not user.get('isAdmin', False)
    _save_auth(auth)
    audit_log(payload['sub'], 'auth.admin.toggle', {'target': target_user, 'isAdmin': user['isAdmin']})
    return jsonify({'ok': True, 'isAdmin': user['isAdmin']})

@app.route('/api/auth/admin/disable', methods=['PUT'])
def auth_admin_disable():
    """Super admin disables/enables account"""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Not authenticated'}), 401

    payload = _verify_jwt(auth_header[7:])
    if not payload or not payload.get('isSuperAdmin'):
        return jsonify({'error': 'Unauthorized'}), 403

    body = request.get_json(force=True)
    target_user = body.get('username', '')
    disabled = body.get('disabled', True)

    auth = _load_auth()
    user = auth['users'].get(target_user)
    if not user or target_user == 'vkan':
        return jsonify({'error': 'Cannot modify this user'}), 400

    user['disabled'] = disabled
    _save_auth(auth)
    audit_log(payload['sub'], 'auth.admin.disable', {'target': target_user, 'disabled': disabled})
    return jsonify({'ok': True})

@app.route('/api/auth/accounts', methods=['GET'])
def auth_list_accounts():
    """Super admin: list all accounts (no password hashes)"""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Not authenticated'}), 401

    payload = _verify_jwt(auth_header[7:])
    if not payload or not payload.get('isSuperAdmin'):
        return jsonify({'error': 'Unauthorized'}), 403

    auth = _load_auth()
    accounts = []
    for username, u in auth.get('users', {}).items():
        accounts.append({
            'username': username,
            'name': u.get('name', ''),
            'role': u.get('role', ''),
            'staffId': u.get('staffId', 0),
            'isAdmin': u.get('isAdmin', False),
            'isSuperAdmin': u.get('isSuperAdmin', False),
            'disabled': u.get('disabled', False),
            'color': u.get('color', '#6366f1')
        })
    return jsonify({'accounts': accounts})

# ────────────────────────────── EMR Proxy ──────────────────────────────
cookie_jar = CookieJar()
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(cookie_jar),
    urllib.request.HTTPSHandler(context=ssl_ctx)
)
_emr_logged_in = False

def emr_login():
    global _emr_logged_in
    now = datetime.now().strftime('%H:%M:%S')
    print(f'[{now}] 🔑 EMR login as {EMR_USER}...')
    try:
        req = urllib.request.Request(EMR_LOGIN_URL, headers={
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/html',
        })
        resp = opener.open(req, timeout=15)
        html = resp.read().decode('utf-8', errors='replace')

        token_match = re.search(
            r'name="__RequestVerificationToken"\s+value="([^"]+)"', html
        ) or re.search(
            r'value="([^"]+)"\s+name="__RequestVerificationToken"', html
        )
        token = token_match.group(1) if token_match else ''

        post_data = urlencode({
            'MaNguoiDung': EMR_USER,
            'MatMa': EMR_PASS,
            'deviceId': str(uuid.uuid4()),
            'deviceName': 'PTDTT-Server',
            '__RequestVerificationToken': token,
        }).encode('utf-8')

        login_req = urllib.request.Request(EMR_LOGIN_POST_URL, data=post_data, headers={
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': EMR_LOGIN_URL,
        })
        opener.open(login_req, timeout=15)
        _emr_logged_in = True
        print(f'[{now}] ✅ EMR login OK')
        return True
    except Exception as e:
        print(f'[{now}] ❌ EMR login fail: {e}')
        _emr_logged_in = False
        return False

def fetch_emr_data():
    global _emr_logged_in
    try:
        req = urllib.request.Request(EMR_DATA_URL, headers={
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/html',
        })
        resp = opener.open(req, timeout=15)
        html = resp.read().decode(resp.headers.get_content_charset() or 'utf-8', errors='replace')

        has_data = '<tbody>' in html and '<tr>' in html
        is_login = ('đăng nhập' in html.lower() or 'MaNguoiDung' in html) and not has_data

        if is_login:
            if emr_login():
                req2 = urllib.request.Request(EMR_DATA_URL, headers={
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'text/html',
                })
                resp2 = opener.open(req2, timeout=15)
                html = resp2.read().decode(resp2.headers.get_content_charset() or 'utf-8', errors='replace')
                if '<tbody>' not in html:
                    return None, 'Login OK but no data'
            else:
                return None, 'Login failed'
        return html, None
    except Exception as e:
        return None, str(e)

@app.route('/api/emr')
def emr_proxy():
    html, error = fetch_emr_data()
    if error:
        return jsonify({'error': error}), 502
    return html, 200, {'Content-Type': 'text/html; charset=utf-8'}

@app.route('/api/emr-status')
def emr_status():
    return jsonify({'loggedIn': _emr_logged_in, 'user': EMR_USER})

# ────────────────────────────── Init ──────────────────────────────
_ensure_data_dir()
_ensure_log_dir()
_cleanup_old_logs(90)
_init_auth_from_db()

if __name__ == '__main__':
    print(f'\n  🏥 PTDTT Manager Server (Flask)')
    print(f'  ================================')
    threading.Thread(target=emr_login, daemon=True).start()
    print(f'  🌐 http://0.0.0.0:{PORT}')
    print(f'  📡 EMR Proxy: /api/emr')
    print(f'  💾 Data API: /api/data')
    print(f'  Ctrl+C to stop\n')
    app.run(host='0.0.0.0', port=PORT, debug=False)
