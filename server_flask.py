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
import shutil
from datetime import datetime, timedelta
from urllib.parse import urlencode
from http.cookiejar import CookieJar
import urllib.request
import urllib.error

from flask import Flask, request, jsonify, send_from_directory, abort, Response
import base64
import jwt as pyjwt
import bcrypt
import html as html_mod
from functools import wraps

# ────────────────────────────── Config ──────────────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_DIR  = os.path.join(BASE_DIR, 'data')
DATA_FILE = os.path.join(DATA_DIR, 'db.json')
LOG_DIR   = os.path.join(BASE_DIR, 'logs')
AUTH_FILE = os.path.join(DATA_DIR, 'auth.json')
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError('JWT_SECRET environment variable is required. Set it in /etc/systemd/system/ptdtt.service or .env')
JWT_EXPIRY_HOURS = int(os.environ.get('JWT_EXPIRY_HOURS', '8'))
PORT      = int(os.environ.get('PORT', 5000))
MIN_CLIENT_BUILD = int(os.environ.get('MIN_CLIENT_BUILD', '2804281805'))
PASSWORD_MIN_LENGTH = int(os.environ.get('PASSWORD_MIN_LENGTH', '10'))
LOGIN_WINDOW_MINUTES = int(os.environ.get('LOGIN_WINDOW_MINUTES', '15'))
LOGIN_MAX_ATTEMPTS = int(os.environ.get('LOGIN_MAX_ATTEMPTS', '5'))
LOGIN_LOCKOUT_MINUTES = int(os.environ.get('LOGIN_LOCKOUT_MINUTES', '15'))

# EMR
EMR_BASE          = 'https://emr.com.vn:83'
EMR_DATA_URL      = f'{EMR_BASE}/DienBienLamSang/Index1'
EMR_LOGIN_URL     = EMR_BASE + '/'
EMR_LOGIN_POST_URL= EMR_BASE + '/'
EMR_USER = os.environ.get('EMR_USER', '')
EMR_PASS = os.environ.get('EMR_PASS', '')

# Allowlisted collections that admin can write via PUT /api/data/<collection>
WRITE_COLLECTIONS = {
    'staff', 'staffStatuses', 'schedules', 'tasks', 'tasksTrash', 'plans', 'patients',
    'reports7h', 'reports16h', 'shcmSchedule', 'surgerySchedule', 'surgeries',
    'notifications', 'rooms', 'departedStaff', 'externalDoctors', 'shcmSettings',
    'conferences'
}

# ────────────────────────────── Flask App ──────────────────────────────
app = Flask(__name__, static_folder=None)

# Prevent caching on API responses
@app.after_request
def add_no_cache_headers(response):
    response.headers.setdefault('X-Frame-Options', 'DENY')
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('Referrer-Policy', 'same-origin')
    response.headers.setdefault('Cross-Origin-Opener-Policy', 'same-origin')
    response.headers.setdefault('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    # SEC-01: Content Security Policy
    response.headers.setdefault(
        'Content-Security-Policy',
        "default-src 'self'; "
        "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
        "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: blob:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "object-src 'none'; "
        "base-uri 'self';"
    )
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

# Cross-process file lock (works across Gunicorn workers)
import fcntl
_DB_LOCK_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', '.db.lock')

class _CrossProcessLock:
    """File-based lock using fcntl.flock — works across Gunicorn workers."""
    def __init__(self, path):
        self._path = path
        self._fd = None
    def __enter__(self):
        os.makedirs(os.path.dirname(self._path), exist_ok=True)
        self._fd = open(self._path, 'a+')
        fcntl.flock(self._fd, fcntl.LOCK_EX)
        return self
    def __exit__(self, *args):
        if self._fd:
            fcntl.flock(self._fd, fcntl.LOCK_UN)
            self._fd.close()
            self._fd = None

_data_lock = _CrossProcessLock(_DB_LOCK_FILE)

# ────────────────────────────── Data helpers ──────────────────────────────
def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({}, f)

def snapshot_data_file(prefix='put'):
    """Keep rolling point-in-time snapshots before full DB overwrite."""
    if not os.path.exists(DATA_FILE):
        return
    snap_dir = os.path.join(DATA_DIR, 'snapshots')
    os.makedirs(snap_dir, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    snap_path = os.path.join(snap_dir, f'{prefix}-{stamp}.json')
    shutil.copy2(DATA_FILE, snap_path)

    snapshots = sorted(glob.glob(os.path.join(snap_dir, f'{prefix}-*.json')))
    while len(snapshots) > 100:
        old = snapshots.pop(0)
        try:
            os.remove(old)
        except OSError:
            pass

def _client_build():
    raw = request.headers.get('X-Client-Build', '0') if request else '0'
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 0

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

class atomic_update:
    """Context manager for atomic read-modify-write on db.json.
    Holds cross-process file lock for the entire duration.
    Usage:
        with atomic_update() as data:
            data['surgeries'] = new_surgeries
    # save_data is called automatically on exit
    """
    def __init__(self):
        self._data = None
    def __enter__(self):
        _ensure_data_dir()
        self._fd = open(_DB_LOCK_FILE, 'a+')
        fcntl.flock(self._fd, fcntl.LOCK_EX)
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            self._data = json.load(f)
        return self._data
    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            if exc_type is None and self._data is not None:
                self._data['_lastModified'] = datetime.now().isoformat()
                tmp = DATA_FILE + '.tmp'
                with open(tmp, 'w', encoding='utf-8') as f:
                    json.dump(self._data, f, ensure_ascii=False, indent=2)
                os.replace(tmp, DATA_FILE)
        finally:
            fcntl.flock(self._fd, fcntl.LOCK_UN)
            self._fd.close()
        return False

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


# Fields to display per collection in diff summaries
_DIFF_LABEL_FIELDS = {
    'surgeries':      ['patientName', 'birthYear', 'date', 'mainSurgeon', 'diagnosis', 'method', 'approachType', 'duration', 'notes'],
    'staff':          ['name', 'role', 'title', 'phone', 'email', 'status'],
    'staffStatuses':  ['staffId', 'date', 'status', 'note'],
    'schedules':      ['weekKey', 'date', 'surgeon', 'notes'],
    'shcmSchedule':   ['date', 'title', 'presenter', 'type', 'location'],
    'plans':          ['title', 'type', 'date', 'status', 'assignee'],
    'tasks':          ['title', 'assignee', 'status', 'dueDate', 'priority'],
    'notifications':  ['title', 'content', 'type'],
}

def _record_label(rec, collection):
    """Return a short human-readable label for a record."""
    fields = _DIFF_LABEL_FIELDS.get(collection, [])
    parts = [str(rec.get(f, '')) for f in fields[:3] if rec.get(f)]
    return ' — '.join(parts) if parts else f"id={rec.get('id', '?')}"

def diff_collection(old_items, new_items, collection):
    """
    Compare two lists of records (keyed by 'id') and return a structured diff:
    {
      added:   [ {id, label, record} ],
      removed: [ {id, label, record} ],
      changed: [ {id, label, from: {field: old_val}, to: {field: new_val}} ]
    }
    Only includes field-level diff for watched fields, ignores 'updatedBy' noise.
    """
    IGNORE_FIELDS = {'updatedBy', 'createdBy', 'id'}
    watch_fields = set(_DIFF_LABEL_FIELDS.get(collection, []))

    old_map = {r['id']: r for r in old_items if isinstance(r, dict) and 'id' in r}
    new_map = {r['id']: r for r in new_items if isinstance(r, dict) and 'id' in r}

    added, removed, changed = [], [], []

    for rid, rec in new_map.items():
        if rid not in old_map:
            added.append({'id': rid, 'label': _record_label(rec, collection), 'record': rec})

    for rid, rec in old_map.items():
        if rid not in new_map:
            removed.append({'id': rid, 'label': _record_label(rec, collection), 'record': rec})

    for rid in set(old_map) & set(new_map):
        old_r, new_r = old_map[rid], new_map[rid]
        frm, to = {}, {}
        all_keys = (set(old_r) | set(new_r)) - IGNORE_FIELDS
        for k in all_keys:
            # Only track meaningful field changes (watched fields or any non-ignored)
            if watch_fields and k not in watch_fields:
                continue
            ov, nv = old_r.get(k), new_r.get(k)
            if ov != nv:
                frm[k] = ov
                to[k] = nv
        if frm:
            changed.append({
                'id': rid,
                'label': _record_label(new_r, collection),
                'from': frm,
                'to': to
            })

    return {'added': added, 'removed': removed, 'changed': changed}

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

# ────────────────────────────── Auth Middleware ──────────────────────────────
def _get_current_user():
    """Extract and verify JWT from Authorization header.
    Returns payload dict with live user info, or None.
    Validates: JWT signature, expiry, user exists, user not disabled."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    payload = _verify_jwt(auth_header[7:])
    if not payload:
        return None
    # Server-side validation: check user still exists and is active
    try:
        auth_data = _load_auth()
        username = payload.get('sub')
        user = auth_data.get('users', {}).get(username)
        if not user:
            return None  # User deleted
        if user.get('disabled'):
            return None  # User disabled by admin
        # Enrich payload with live server data (not stale JWT claims)
        payload['name'] = user.get('name', payload.get('name', ''))
        payload['role'] = user.get('role', payload.get('role', ''))
        payload['isAdmin'] = user.get('isAdmin', False)
        payload['isSuperAdmin'] = user.get('isSuperAdmin', False)
        payload['staffId'] = user.get('staffId', payload.get('staffId', 0))
    except Exception:
        pass  # If auth.json read fails, still allow JWT-only auth
    return payload

def require_auth(f):
    """Decorator: require valid JWT + active user for this endpoint"""
    @wraps(f)
    def decorated(*args, **kwargs):
        payload = _get_current_user()
        if not payload:
            return jsonify({'error': 'Authentication required'}), 401
        request._user = payload  # Attach user info to request
        return f(*args, **kwargs)
    return decorated

def require_admin(f):
    """Decorator: require admin JWT for this endpoint"""
    @wraps(f)
    def decorated(*args, **kwargs):
        payload = _get_current_user()
        if not payload:
            return jsonify({'error': 'Authentication required'}), 401
        if not payload.get('isAdmin') and not payload.get('isSuperAdmin'):
            return jsonify({'error': 'Admin access required'}), 403
        request._user = payload
        return f(*args, **kwargs)
    return decorated

def require_superadmin(f):
    """Decorator: require superadmin JWT for this endpoint"""
    @wraps(f)
    def decorated(*args, **kwargs):
        payload = _get_current_user()
        if not payload:
            return jsonify({'error': 'Authentication required'}), 401
        if not payload.get('isSuperAdmin'):
            return jsonify({'error': 'Super admin access required'}), 403
        request._user = payload
        return f(*args, **kwargs)
    return decorated

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
@require_auth
def get_data():
    """Return the entire JSON database (sensitive fields stripped, auth required)"""
    data = load_data()
    # Strip sensitive auth-related fields from response
    safe_data = {k: v for k, v in data.items() if k not in ('customPasswords', 'customAdmins', 'disabledAccounts')}
    return jsonify(safe_data)

@app.route('/api/data', methods=['PUT'])
@require_superadmin
def put_data():
    """Replace the entire JSON database (superadmin only)"""
    data = request.get_json(force=True)
    user = getattr(request, '_user', {}).get('sub', request.headers.get('X-User', 'unknown'))
    client_build = _client_build()
    if client_build < MIN_CLIENT_BUILD:
        audit_log(user, 'data.put.rejected.stale_client', {'clientBuild': client_build, 'requiredBuild': MIN_CLIENT_BUILD})
        return jsonify({
            'error': 'Client too old. Please reload the page before saving.',
            'requiredBuild': MIN_CLIENT_BUILD
        }), 409
    audit_log(user, 'data.put', {'size': len(json.dumps(data))})
    snapshot_data_file('data-put')
    save_data(data)
    return jsonify({'ok': True, 'version': _get_file_version()})

@app.route('/api/data/version', methods=['GET'])
def get_data_version():
    """Lightweight version check — uses file mtime (works across all gunicorn workers)"""
    return jsonify({'version': _get_file_version()})

@app.route('/api/download-image', methods=['POST'])
@require_auth
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
@require_auth
def get_collection(collection):
    """Return a single collection (auth required)"""
    data = load_data()
    return jsonify(data.get(collection, []))

@app.route('/api/data/<collection>', methods=['PUT'])
@require_auth
def put_collection(collection):
    """Replace a single collection (auth required, allowlist enforced)"""
    if collection not in WRITE_COLLECTIONS:
        return jsonify({'error': f'Collection "{collection}" is not writable via API'}), 403
    payload = request.get_json(force=True)
    if isinstance(payload, dict) and 'items' in payload:
        items = payload.get('items', [])
        next_id = payload.get('nextId')
    else:
        items = payload
        next_id = None
    user = getattr(request, '_user', {}).get('sub', request.headers.get('X-User', 'unknown'))
    client_build = _client_build()
    if client_build < MIN_CLIENT_BUILD:
        audit_log(user, f'collection.put.rejected.stale_client.{collection}', {'clientBuild': client_build, 'requiredBuild': MIN_CLIENT_BUILD})
        return jsonify({
            'error': 'Client too old. Please reload the page before saving.',
            'requiredBuild': MIN_CLIENT_BUILD
        }), 409

    # Compute diff before writing (only for list-of-objects with 'id' field)
    diff_detail = None
    if isinstance(items, list) and items and isinstance(items[0], dict) and 'id' in items[0]:
        try:
            current_data = load_data()
            old_items = current_data.get(collection, [])
            if isinstance(old_items, list):
                diff = diff_collection(old_items, items, collection)
                diff_detail = {
                    'count': len(items),
                    'nextId': next_id,
                    'added': len(diff['added']),
                    'removed': len(diff['removed']),
                    'changed': len(diff['changed']),
                    'diff': {
                        'added': diff['added'][:20],    # cap to avoid huge logs
                        'removed': diff['removed'][:20],
                        'changed': diff['changed'][:20]
                    }
                }
        except Exception as ex:
            print(f'[Audit] diff_collection error: {ex}')

    if diff_detail is None:
        diff_detail = {'count': len(items) if isinstance(items, list) else 1, 'nextId': next_id}

    audit_log(user, f'collection.put.{collection}', diff_detail)

    with atomic_update() as data:
        data[collection] = items
        if next_id is not None:
            data.setdefault('nextIds', {})[collection] = next_id
    return jsonify({'ok': True, 'version': _get_file_version()})

# ────────────────────────────── Audit API ──────────────────────────────
@app.route('/api/audit', methods=['GET'])
@require_superadmin
def get_audit_logs():
    """Return audit logs (superadmin only, server-enforced)"""
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
_login_attempt_lock = threading.Lock()
_login_attempts = {}

def _request_ip():
    forwarded = request.headers.get('X-Forwarded-For', '') if request else ''
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.remote_addr if request else None

def _prune_login_attempts(now=None):
    now = now or datetime.utcnow()
    cutoff = now - timedelta(minutes=LOGIN_WINDOW_MINUTES)
    stale_keys = []
    for key, state in _login_attempts.items():
        locked_until = state.get('lockedUntil')
        window_start = state.get('windowStart', now)
        if locked_until and locked_until > now:
            continue
        if window_start < cutoff:
            stale_keys.append(key)
    for key in stale_keys:
        _login_attempts.pop(key, None)

def _get_login_attempt_state(username, ip):
    key = f'{(username or "").lower()}|{ip or "unknown"}'
    now = datetime.utcnow()
    with _login_attempt_lock:
        _prune_login_attempts(now)
        state = _login_attempts.get(key)
        if not state:
            return {'locked': False, 'retryAfter': 0, 'remaining': LOGIN_MAX_ATTEMPTS}
        locked_until = state.get('lockedUntil')
        if locked_until and locked_until > now:
            retry_after = max(1, int((locked_until - now).total_seconds()))
            return {'locked': True, 'retryAfter': retry_after, 'remaining': 0}
        remaining = max(0, LOGIN_MAX_ATTEMPTS - state.get('count', 0))
        return {'locked': False, 'retryAfter': 0, 'remaining': remaining}

def _record_login_failure(username, ip):
    key = f'{(username or "").lower()}|{ip or "unknown"}'
    now = datetime.utcnow()
    with _login_attempt_lock:
        _prune_login_attempts(now)
        state = _login_attempts.get(key)
        window_start = now
        count = 0
        if state and state.get('windowStart') and state['windowStart'] >= now - timedelta(minutes=LOGIN_WINDOW_MINUTES):
            window_start = state['windowStart']
            count = state.get('count', 0)
        count += 1
        locked_until = None
        if count >= LOGIN_MAX_ATTEMPTS:
            locked_until = now + timedelta(minutes=LOGIN_LOCKOUT_MINUTES)
        _login_attempts[key] = {
            'windowStart': window_start,
            'count': count,
            'lockedUntil': locked_until
        }
        retry_after = max(1, int((locked_until - now).total_seconds())) if locked_until else 0
        return {
            'locked': locked_until is not None,
            'retryAfter': retry_after,
            'remaining': max(0, LOGIN_MAX_ATTEMPTS - count)
        }

def _clear_login_failures(username, ip):
    key = f'{(username or "").lower()}|{ip or "unknown"}'
    with _login_attempt_lock:
        _login_attempts.pop(key, None)

def _validate_password_policy(password, username=''):
    if len(password) < PASSWORD_MIN_LENGTH:
        return f'Mật khẩu phải có ít nhất {PASSWORD_MIN_LENGTH} ký tự'
    if not re.search(r'[A-Za-zÀ-ỹ]', password):
        return 'Mật khẩu phải có ít nhất 1 chữ cái'
    if not re.search(r'\d', password):
        return 'Mật khẩu phải có ít nhất 1 chữ số'
    if username and password.strip().lower() == username.strip().lower():
        return 'Mật khẩu không được trùng với tên đăng nhập'
    return None

def _sanitize_auth_payload(auth):
    changed = False
    users = auth.get('users')
    if not isinstance(users, dict):
        auth['users'] = {}
        users = auth['users']
        changed = True
    for record in users.values():
        if isinstance(record, dict) and 'plaintextPw' in record:
            record.pop('plaintextPw', None)
            changed = True
    return changed

def _purge_legacy_db_auth_fields():
    db_data = load_data()
    changed = False
    for key in ('customPasswords', 'customAdmins', 'disabledAccounts'):
        if key in db_data:
            db_data.pop(key, None)
            changed = True
    if changed:
        save_data(db_data)
        print('[Auth] ✅ Removed legacy auth fields from db.json')

def _load_auth():
    """Load auth data from auth.json"""
    if not os.path.exists(AUTH_FILE):
        return {'users': {}}
    with _auth_lock:
        with open(AUTH_FILE, 'r', encoding='utf-8') as f:
            auth = json.load(f)
    if _sanitize_auth_payload(auth):
        _save_auth(auth)
    return auth

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
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
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

    # Guest account — disabled by default for security
    users['guest'] = {
        'passwordHash': _hash_password(os.urandom(32).hex()),  # Random unguessable password
        'name': 'Khách',
        'role': 'Khách tham quan',
        'title': '',
        'staffId': 0,
        'isAdmin': False,
        'isSuperAdmin': False,
        'disabled': True,  # DISABLED by default
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
    client_ip = _request_ip()

    attempt_state = _get_login_attempt_state(username, client_ip)
    if attempt_state['locked']:
        audit_log(username, 'auth.login.blocked', {
            'ip': client_ip,
            'retryAfter': attempt_state['retryAfter']
        })
        response = jsonify({
            'error': f'Đăng nhập tạm bị khóa do nhập sai quá nhiều lần. Vui lòng thử lại sau {LOGIN_LOCKOUT_MINUTES} phút.',
            'retryAfter': attempt_state['retryAfter']
        })
        response.headers['Retry-After'] = str(attempt_state['retryAfter'])
        return response, 429

    auth = _load_auth()
    user = auth.get('users', {}).get(username)

    if not user:
        status = _record_login_failure(username, client_ip)
        audit_log(username, 'auth.login.fail', {
            'reason': 'not_found',
            'ip': client_ip,
            'remaining': status['remaining']
        })
        return jsonify({'error': 'Tài khoản không tồn tại'}), 401

    if user.get('disabled'):
        audit_log(username, 'auth.login.fail', {'reason': 'disabled'})
        return jsonify({'error': 'Tài khoản đã bị vô hiệu hoá. Liên hệ quản trị viên.'}), 403

    if not _check_password(password, user['passwordHash']):
        status = _record_login_failure(username, client_ip)
        audit_log(username, 'auth.login.fail', {
            'reason': 'wrong_password',
            'ip': client_ip,
            'remaining': status['remaining']
        })
        if status['locked']:
            response = jsonify({
                'error': f'Đăng nhập tạm bị khóa do nhập sai quá nhiều lần. Vui lòng thử lại sau {LOGIN_LOCKOUT_MINUTES} phút.',
                'retryAfter': status['retryAfter']
            })
            response.headers['Retry-After'] = str(status['retryAfter'])
            return response, 429
        return jsonify({'error': 'Mật khẩu không đúng'}), 401

    _clear_login_failures(username, client_ip)
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
    """Return current user info — validates JWT + checks user is active server-side"""
    payload = _get_current_user()
    if not payload:
        return jsonify({'error': 'Token expired, invalid, or account disabled'}), 401

    return jsonify({
        'username': payload['sub'],
        'name': payload.get('name', ''),
        'role': payload.get('role', ''),
        'isAdmin': payload.get('isAdmin', False),
        'isSuperAdmin': payload.get('isSuperAdmin', False),
        'staffId': payload.get('staffId', 0),
        'color': payload.get('color', '#6366f1')
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

    password_error = _validate_password_policy(new_pw, payload['sub'])
    if password_error:
        return jsonify({'error': password_error}), 400

    auth = _load_auth()
    user = auth['users'].get(payload['sub'])
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if not _check_password(old_pw, user['passwordHash']):
        return jsonify({'error': 'Mật khẩu cũ không đúng'}), 401

    user['passwordHash'] = _hash_password(new_pw)
    user.pop('plaintextPw', None)  # Never store plaintext
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

    password_error = _validate_password_policy(new_pw, target_user)
    if password_error:
        return jsonify({'error': password_error}), 400

    auth = _load_auth()
    user = auth['users'].get(target_user)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    user['passwordHash'] = _hash_password(new_pw)
    user.pop('plaintextPw', None)  # Never store plaintext
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
            # plaintextPw removed — never expose passwords via API
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

# ── Cache ──
_emr_cache = None          # parsed JSON data
_emr_cache_time = None     # datetime of last successful fetch
_emr_cache_lock = threading.Lock()
EMR_CACHE_TTL = 120        # seconds (2 minutes)

def emr_login():
    global _emr_logged_in
    now = datetime.now().strftime('%H:%M:%S')
    print(f'[{now}] 🔑 EMR login as {EMR_USER}...')
    try:
        req = urllib.request.Request(EMR_LOGIN_URL, headers={
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/html',
        })
        resp = opener.open(req, timeout=8)
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
        opener.open(login_req, timeout=8)
        _emr_logged_in = True
        print(f'[{now}] ✅ EMR login OK')
        return True
    except Exception as e:
        print(f'[{now}] ❌ EMR login fail: {e}')
        _emr_logged_in = False
        return False

def _parse_emr_html(html):
    """Parse EMR HTML table → list of patient dicts (server-side)"""
    patients = []
    # Find all <tr> inside <tbody>
    tbody_match = re.search(r'<tbody[^>]*>(.*?)</tbody>', html, re.DOTALL | re.IGNORECASE)
    if not tbody_match:
        return patients
    tbody = tbody_match.group(1)
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', tbody, re.DOTALL | re.IGNORECASE)
    for row in rows:
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL | re.IGNORECASE)
        if len(cells) < 4:
            continue
        stt = re.sub(r'<[^>]*>', '', cells[0]).strip()
        ma_ho_ten = cells[1]
        ngay_vao = re.sub(r'<[^>]*>', '', cells[2]).strip()
        phong = re.sub(r'<[^>]*>', '', cells[3]).strip()
        # Parse "26014824<br>Lê Mạnh Tuấn"
        parts = re.split(r'<br\s*/?>',  ma_ho_ten, flags=re.IGNORECASE)
        ma_nhap_vien = html_mod.unescape(re.sub(r'<[^>]*>', '', parts[0]).strip()) if parts else ''
        ho_ten = html_mod.unescape(re.sub(r'<[^>]*>', '', parts[1]).strip()) if len(parts) > 1 else ''
        ngay_vao_clean = html_mod.unescape(ngay_vao)
        phong_clean = html_mod.unescape(phong)
        patients.append({
            'stt': int(stt) if stt.isdigit() else 0,
            'maNhapVien': ma_nhap_vien,
            'hoTen': ho_ten,
            'ngayVao': ngay_vao_clean,
            'phong': phong_clean
        })
    return patients

def _build_emr_json(patients):
    """Build structured JSON from patient list"""
    dept = [p for p in patients if 'CC' not in p['phong'].upper()]
    cc = [p for p in patients if 'CC' in p['phong'].upper()]
    by_room = {}
    for p in dept:
        by_room.setdefault(p['phong'], []).append(p)
    return {
        'all': patients,
        'department': dept,
        'cc': cc,
        'byRoom': by_room,
        'totalAll': len(patients),
        'totalDept': len(dept),
        'totalCC': len(cc),
        'fetchTime': datetime.now().isoformat()
    }

def _fetch_emr_html():
    """Raw fetch from EMR, with auto-login retry"""
    global _emr_logged_in
    try:
        req = urllib.request.Request(EMR_DATA_URL, headers={
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/html',
        })
        resp = opener.open(req, timeout=8)
        html = resp.read().decode(resp.headers.get_content_charset() or 'utf-8', errors='replace')

        has_data = '<tbody>' in html and '<tr>' in html
        is_login = ('đăng nhập' in html.lower() or 'MaNguoiDung' in html) and not has_data

        if is_login:
            if emr_login():
                req2 = urllib.request.Request(EMR_DATA_URL, headers={
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'text/html',
                })
                resp2 = opener.open(req2, timeout=8)
                html = resp2.read().decode(resp2.headers.get_content_charset() or 'utf-8', errors='replace')
                if '<tbody>' not in html:
                    return None, 'Login OK but no data'
            else:
                return None, 'Login failed'
        return html, None
    except Exception as e:
        return None, str(e)

def fetch_emr_data(force=False):
    """Fetch + parse + cache. Returns (json_data, error)"""
    global _emr_cache, _emr_cache_time
    # Return cache if fresh
    if not force and _emr_cache and _emr_cache_time:
        age = (datetime.now() - _emr_cache_time).total_seconds()
        if age < EMR_CACHE_TTL:
            return _emr_cache, None
    # Fetch fresh
    html, error = _fetch_emr_html()
    if error:
        # Return stale cache if available
        if _emr_cache:
            now = datetime.now().strftime('%H:%M:%S')
            print(f'[{now}] ⚠️ EMR fetch error ({error}), returning stale cache')
            return _emr_cache, None
        return None, error
    patients = _parse_emr_html(html)
    data = _build_emr_json(patients)
    with _emr_cache_lock:
        _emr_cache = data
        _emr_cache_time = datetime.now()
    now = datetime.now().strftime('%H:%M:%S')
    print(f'[{now}] ✅ EMR cache updated: {data["totalDept"]} dept, {data["totalCC"]} CC')
    return data, None

def _emr_background_refresh():
    """Background thread: refresh cache every 2 min, keep-alive every 20 min"""
    import time
    login_counter = 0
    # Initial login on thread start
    try:
        emr_login()
    except Exception as e:
        print(f'[EMR-BG] Initial login error: {e}')
    while True:
        try:
            time.sleep(EMR_CACHE_TTL)  # 2 min
            login_counter += 1
            # Keep-alive: re-login every 20 min (10 cycles × 2 min)
            if login_counter >= 10:
                try:
                    emr_login()
                except Exception as e:
                    print(f'[EMR-BG] Keep-alive login error: {e}')
                login_counter = 0
            fetch_emr_data(force=True)
        except Exception as e:
            now = datetime.now().strftime('%H:%M:%S')
            print(f'[{now}] ❌ EMR background refresh error: {e}')
            time.sleep(30)  # Wait 30s before retry on error

@app.route('/api/emr')
@require_auth
def emr_proxy():
    """Non-blocking: always return cached data. Auth required — patient data."""
    if _emr_cache:
        return jsonify(_emr_cache)
    # No cache yet — try a quick fetch but with short timeout
    data, error = fetch_emr_data()
    if data:
        return jsonify(data)
    return jsonify({'error': error or 'EMR not available yet, data loading in background'}), 502

@app.route('/api/emr-status')
@require_admin
def emr_status():
    cache_age = None
    if _emr_cache_time:
        cache_age = int((datetime.now() - _emr_cache_time).total_seconds())
    return jsonify({
        'loggedIn': _emr_logged_in,
        'cacheAge': cache_age,
        'cached': _emr_cache is not None
    })

# ────────────────────────────── SHCM File API ──────────────────────────────
SHCM_DIR = os.path.join(DATA_DIR, 'shcm-files')

def _ensure_shcm_dir():
    os.makedirs(SHCM_DIR, exist_ok=True)

def _format_size(size_bytes):
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"

@app.route('/api/shcm/files', methods=['GET'])
def shcm_list_files():
    _ensure_shcm_dir()
    files = []
    for f in sorted(os.listdir(SHCM_DIR)):
        if f.lower().endswith('.pdf'):
            fpath = os.path.join(SHCM_DIR, f)
            stat = os.stat(fpath)
            files.append({
                'name': f,
                'size': _format_size(stat.st_size),
                'sizeBytes': stat.st_size,
                'uploaded': datetime.fromtimestamp(stat.st_mtime).strftime('%d/%m/%Y %H:%M')
            })
    return jsonify({'files': files})

@app.route('/api/shcm/upload', methods=['POST'])
@require_auth
def shcm_upload():
    user = request._user
    audit_log(user.get('sub', '?'), 'shcm_upload_blocked', {
        'message': 'web upload disabled'
    })
    return jsonify({
        'error': 'Upload PDF SHCM từ web đã bị vô hiệu hóa'
    }), 410

@app.route('/api/shcm/download/<path:filename>', methods=['GET'])
def shcm_download(filename):
    _ensure_shcm_dir()
    filepath = os.path.join(SHCM_DIR, filename)
    if not os.path.exists(filepath) or not filepath.startswith(SHCM_DIR):
        return jsonify({'error': 'File not found'}), 404
    return send_from_directory(SHCM_DIR, filename, as_attachment=True)

@app.route('/api/shcm/delete/<path:filename>', methods=['DELETE'])
@require_auth
def shcm_delete(filename):
    _ensure_shcm_dir()
    user = request._user
    filepath = os.path.join(SHCM_DIR, filename)
    if not os.path.exists(filepath) or not filepath.startswith(SHCM_DIR):
        return jsonify({'error': 'File not found'}), 404
    os.remove(filepath)
    audit_log(user.get('sub', '?'), 'shcm_delete', {'file': filename})
    return jsonify({'success': True})

# ────────────────────────────── Init ──────────────────────────────
_ensure_data_dir()
_ensure_log_dir()
_cleanup_old_logs(90)
_init_auth_from_db()
_purge_legacy_db_auth_fields()

# ── Start EMR background thread (works under both Gunicorn and direct run) ──
_emr_bg_started = False
def _start_emr_background():
    global _emr_bg_started
    if _emr_bg_started:
        return
    _emr_bg_started = True
    threading.Thread(target=_emr_background_refresh, daemon=True).start()
    print('[EMR] Background refresh thread started (every 2 min)')

# Auto-start when module is loaded (Gunicorn worker or direct run)
_start_emr_background()

if __name__ == '__main__':
    print(f'\n  🏥 PTDTT Manager Server (Flask)')
    print(f'  ================================')
    print(f'  🌐 http://0.0.0.0:{PORT}')
    print(f'  📡 EMR Proxy: /api/emr')
    print(f'  💾 Data API: /api/data')
    print(f'  Ctrl+C to stop\n')
    app.run(host='0.0.0.0', port=PORT, debug=False)
