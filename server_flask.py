#!/usr/bin/env python3
"""
PTDTT Manager — Flask Production Server
Serves the web app + JSON data API + EMR Proxy.
"""

import os
import json
import hashlib
import re
import uuid
import ssl
import threading
import glob
import shutil
import copy
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from http.cookiejar import CookieJar
import urllib.request
import urllib.error

from flask import Flask, request, jsonify, send_from_directory, abort, Response, make_response
import base64
import jwt as pyjwt
import bcrypt
import html as html_mod
from functools import wraps

# ────────────────────────────── Config ──────────────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_DIR  = os.environ.get('PTDTT_DATA_DIR') or os.path.join(BASE_DIR, 'data')
DATA_FILE = os.path.join(DATA_DIR, 'db.json')
LOG_DIR   = os.environ.get('PTDTT_LOG_DIR') or os.path.join(BASE_DIR, 'logs')
AUTH_FILE = os.path.join(DATA_DIR, 'auth.json')
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError('JWT_SECRET environment variable is required. Set it in /etc/systemd/system/ptdtt.service or .env')
JWT_EXPIRY_HOURS = int(os.environ.get('JWT_EXPIRY_HOURS', '8'))
PORT      = int(os.environ.get('PORT', 5000))
MIN_CLIENT_BUILD = int(os.environ.get('MIN_CLIENT_BUILD', '2610281835'))
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
    'reports7h', 'reports16h', 'shcmSchedule', 'surgerySchedule', 'surgeries', 'surgeriesTrash',
    'notifications', 'rooms', 'departedStaff', 'externalDoctors', 'shcmSettings',
    'conferences', 'specialTeams'
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
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: blob:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "object-src 'none'; "
        "base-uri 'self';"
    )
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'private, no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

from surgery_approval_engine import (
    PROTECTED_APPROVAL_COLLECTIONS,
    ApprovalEngineError,
    filter_db_payload_for_user,
    get_journal_path,
    protect_and_reconcile_surgeries_put,
    reconcile_journal_and_db,
    resolve_live_user_fail_closed,
)
from surgery_approval_routes import ensure_approval_bootstrapped, register_surgery_approval_routes

# Cross-process file lock (works across Gunicorn workers)
import fcntl
_DB_LOCK_FILE = os.path.join(DATA_DIR, '.db.lock')

class _CrossProcessLock:
    """File-based lock using fcntl.flock — works across Gunicorn workers."""
    def __init__(self, path=None):
        self._path = path
        self._fd = None
    def __enter__(self):
        lock_path = self._path or _DB_LOCK_FILE
        os.makedirs(os.path.dirname(lock_path), exist_ok=True)
        self._fd = open(lock_path, 'a+')
        fcntl.flock(self._fd, fcntl.LOCK_EX)
        return self
    def __exit__(self, *args):
        if self._fd:
            fcntl.flock(self._fd, fcntl.LOCK_UN)
            self._fd.close()
            self._fd = None

_data_lock = _CrossProcessLock()

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
            f.flush()
            os.fsync(f.fileno())
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
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(tmp, DATA_FILE)
        finally:
            fcntl.flock(self._fd, fcntl.LOCK_UN)
            self._fd.close()
        return False

# ────────────────────────────── Audit Logging ──────────────────────────────
def _ensure_log_dir():
    os.makedirs(LOG_DIR, exist_ok=True)
    # Ensure group-write so ptdtt service user can create log files
    try:
        os.chmod(LOG_DIR, 0o775)
    except Exception:
        pass

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
        is_new = not os.path.exists(log_file)
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
        if is_new:
            try:
                os.chmod(log_file, 0o664)
            except Exception:
                pass
    except Exception as e:
        print(f'[Audit] FAILED to write log: {e}', flush=True)


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
    """Extract and verify JWT from Authorization header (Fail-Closed).
    Returns payload dict with live user info, or None.
    Sets request._auth_store_error = True if auth.json is missing or corrupted."""
    request._auth_store_error = False
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    payload = _verify_jwt(auth_header[7:])
    if not payload:
        return None
    if not os.path.isfile(AUTH_FILE):
        request._auth_store_error = True
        return None
    try:
        with _auth_lock:
            with open(AUTH_FILE, 'r', encoding='utf-8') as f:
                auth_data = json.load(f)
        if _sanitize_auth_payload(auth_data):
            _save_auth(auth_data)
    except Exception:
        request._auth_store_error = True
        return None

    username = payload.get('sub')
    user = (auth_data.get('users') or {}).get(username) if isinstance(auth_data, dict) else None
    if not isinstance(user, dict):
        return None
    if user.get('disabled'):
        active_from = user.get('activeFrom')
        if active_from:
            from datetime import date
            try:
                if date.today() >= date.fromisoformat(active_from):
                    user['disabled'] = False
                    user.pop('activeFrom', None)
                    _save_auth(auth_data)
                else:
                    return None
            except ValueError:
                return None
        else:
            return None
    payload['name'] = user.get('name', payload.get('name', ''))
    payload['role'] = user.get('role', payload.get('role', ''))
    payload['isAdmin'] = user.get('isAdmin', False)
    payload['isSuperAdmin'] = user.get('isSuperAdmin', False)
    payload['staffId'] = user.get('staffId', payload.get('staffId', 0))
    return payload

def _auth_store_503_response():
    return jsonify({
        'error': 'Kho tài khoản xác thực tạm thời không truy cập được (Fail-Closed).',
        'code': 'AUTH_STORE_UNAVAILABLE',
        'errorCode': 'AUTH_STORE_UNAVAILABLE',
    }), 503

def require_auth(f):
    """Decorator: require valid JWT + active user for this endpoint (Fail-Closed)"""
    @wraps(f)
    def decorated(*args, **kwargs):
        payload = _get_current_user()
        if getattr(request, '_auth_store_error', False):
            return _auth_store_503_response()
        if not payload:
            return jsonify({'error': 'Authentication required'}), 401
        request._user = payload  # Attach user info to request
        return f(*args, **kwargs)
    return decorated

def require_admin(f):
    """Decorator: require admin JWT for this endpoint (Fail-Closed)"""
    @wraps(f)
    def decorated(*args, **kwargs):
        payload = _get_current_user()
        if getattr(request, '_auth_store_error', False):
            return _auth_store_503_response()
        if not payload:
            return jsonify({'error': 'Authentication required'}), 401
        if not payload.get('isAdmin') and not payload.get('isSuperAdmin'):
            return jsonify({'error': 'Admin access required'}), 403
        request._user = payload
        return f(*args, **kwargs)
    return decorated

def require_superadmin(f):
    """Decorator: require superadmin JWT for this endpoint (Fail-Closed)"""
    @wraps(f)
    def decorated(*args, **kwargs):
        payload = _get_current_user()
        if getattr(request, '_auth_store_error', False):
            return _auth_store_503_response()
        if not payload:
            return jsonify({'error': 'Authentication required'}), 401
        if not payload.get('isSuperAdmin'):
            return jsonify({'error': 'Super admin access required'}), 403
        request._user = payload
        return f(*args, **kwargs)
    return decorated

# ────────────────────────────── Role & Date Helpers ──────────────────────────────
VN_TZ = timezone(timedelta(hours=7))  # Asia/Ho_Chi_Minh (UTC+7)
_ISO_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
_WEEK_KEY_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')

def _today_vn():
    return datetime.now(VN_TZ).date()

def _current_week_key_vn():
    today = _today_vn()
    monday = today - timedelta(days=today.weekday())
    return monday.strftime('%Y-%m-%d')

def _is_valid_iso_date(val):
    if not isinstance(val, str) or not _ISO_DATE_RE.fullmatch(val):
        return False
    try:
        datetime.strptime(val, '%Y-%m-%d').date()
        return True
    except ValueError:
        return False

def _is_valid_monday_week_key(wk):
    if not isinstance(wk, str) or not _WEEK_KEY_RE.fullmatch(wk):
        return False
    try:
        dt = datetime.strptime(wk, '%Y-%m-%d').date()
    except ValueError:
        return False
    return dt.weekday() == 0

def is_surgery_week_locked(date_str):
    if not _is_valid_iso_date(date_str):
        return False
    dt = datetime.strptime(date_str, '%Y-%m-%d').date()
    monday = dt - timedelta(days=dt.weekday())
    return (_today_vn() - monday).days > 7

def _is_superadmin(user):
    return bool(user and user.get('isSuperAdmin'))

def _is_admin(user):
    return bool(user and (user.get('isAdmin') or user.get('isSuperAdmin')))

def _is_doctor(user):
    if not user:
        return False
    role = str(user.get('role') or '')
    return ('Bác sĩ' in role) or ('Trưởng khoa' in role) or ('Phó trưởng khoa' in role)

def _can_edit_shcm(user):
    if _is_admin(user):
        return True
    role = str((user or {}).get('role') or '')
    return ('Bác sĩ chính' in role) or ('Trưởng khoa' in role) or ('Phó trưởng khoa' in role)

def _is_schedule_editor(user):
    if _is_admin(user):
        return True
    return bool(user and user.get('staffId') in (3, 12))


# ────────────────────────────── Schema, Structural Diff & RBAC ──────────────────────────────
_AUDIT_META_KEYS = {'updatedBy', 'updatedAt'}

class CollectionAuthError(Exception):
    def __init__(self, status_code, message, detail=None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.detail = detail or {}

def _is_pos_int(val):
    return isinstance(val, int) and not isinstance(val, bool) and val > 0

def _validate_collection_schema(collection, items):
    if not isinstance(items, list):
        return False, 'Payload items phải là một danh sách (list).'
    seen_ids = set()
    seen_natural = set()

    for idx, r in enumerate(items):
        if not isinstance(r, dict):
            return False, f'Phần tử thứ {idx} trong {collection} phải là object (dict).'

        if collection in ('reports16h', 'reports7h'):
            has_id = 'id' in r and r['id'] is not None
            if has_id:
                if not _is_pos_int(r['id']):
                    return False, f'Bản ghi trong {collection} có id không hợp lệ.'
                if r['id'] in seen_ids:
                    return False, f'Trùng lặp id={r["id"]} trong {collection}.'
                seen_ids.add(r['id'])
            date_val = r.get('date')
            if date_val is not None:
                if not _is_valid_iso_date(date_val):
                    return False, f'Ngày báo cáo "{date_val}" không hợp lệ (YYYY-MM-DD).'
                if date_val in seen_natural:
                    return False, f'Trùng lặp ngày báo cáo "{date_val}" trong {collection}.'
                seen_natural.add(date_val)
            elif not has_id:
                return False, f'Bản ghi trong {collection} phải có trường date (YYYY-MM-DD) hoặc id nguyên dương.'
            continue

        if collection == 'staffStatuses':
            has_id = 'id' in r and r['id'] is not None
            if has_id:
                if not _is_pos_int(r['id']):
                    return False, 'Bản ghi staffStatuses có id không hợp lệ.'
                if r['id'] in seen_ids:
                    return False, f'Trùng lặp id={r["id"]} trong staffStatuses.'
                seen_ids.add(r['id'])
            sid = r.get('staffId')
            dval = r.get('date')
            if sid is not None or dval is not None:
                if not _is_pos_int(sid) or not _is_valid_iso_date(dval):
                    return False, 'Bản ghi staffStatuses phải có staffId nguyên dương và date YYYY-MM-DD.'
                nkey = (sid, dval)
                if nkey in seen_natural:
                    return False, f'Trùng lặp (staffId={sid}, date={dval}) trong staffStatuses.'
                seen_natural.add(nkey)
            elif not has_id:
                return False, 'Bản ghi staffStatuses thiếu khóa định danh.'
            continue

        rid = r.get('id')
        if not _is_pos_int(rid):
            return False, f'Bản ghi trong {collection} thiếu id hoặc id không phải số nguyên dương.'
        if rid in seen_ids:
            return False, f'Trùng lặp id={rid} trong {collection}.'
        seen_ids.add(rid)

        if collection == 'schedules':
            wk = r.get('weekKey')
            if not _is_valid_monday_week_key(wk):
                return False, f'weekKey "{wk}" không hợp lệ (phải là ngày Thứ Hai định dạng YYYY-MM-DD).'
            if wk in seen_natural:
                return False, f'Trùng lặp weekKey="{wk}" trong schedules.'
            seen_natural.add(wk)

    return True, None

def _record_primary_key(collection, rec):
    if not isinstance(rec, dict):
        return None
    if collection in ('reports16h', 'reports7h'):
        if rec.get('date'):
            return f"date:{rec['date']}"
        if _is_pos_int(rec.get('id')):
            return f"id:{rec['id']}"
        return None
    if collection == 'staffStatuses':
        if _is_pos_int(rec.get('staffId')) and rec.get('date'):
            return f"ss:{rec['staffId']}:{rec['date']}"
        if _is_pos_int(rec.get('id')):
            return f"id:{rec['id']}"
        return None
    return rec.get('id')

def _changed_field_keys(old_r, new_r):
    all_keys = (set(old_r.keys()) | set(new_r.keys())) - _AUDIT_META_KEYS
    return {k for k in all_keys if old_r.get(k) != new_r.get(k)}

def _compute_auth_diff(old_items, new_items, collection):
    """Full structural diff across all fields (except _AUDIT_META_KEYS) for RBAC and atomic merge."""
    old_map = {}
    for r in (old_items or []):
        pk = _record_primary_key(collection, r)
        if pk is not None:
            old_map[pk] = r

    new_map = {}
    for r in (new_items or []):
        pk = _record_primary_key(collection, r)
        if pk is not None:
            new_map[pk] = r

    added = [new_map[k] for k in new_map if k not in old_map]
    removed = [old_map[k] for k in old_map if k not in new_map]
    modified = []
    unchanged = []

    for k, new_r in new_map.items():
        if k in old_map:
            old_r = old_map[k]
            ckeys = _changed_field_keys(old_r, new_r)
            if ckeys:
                modified.append((old_r, new_r, ckeys))
            else:
                unchanged.append((old_r, new_r))

    return {
        'added': added,
        'removed': removed,
        'modified': modified,
        'unchanged': unchanged,
        'has_changes': bool(added or removed or modified)
    }

def _derive_safe_next_id(collection, effective_items, data):
    max_id = max([int(r['id']) for r in effective_items if isinstance(r, dict) and _is_pos_int(r.get('id'))], default=0)
    if collection == 'staff':
        max_dep = max([int(r['id']) for r in data.get('departedStaff', []) if isinstance(r, dict) and _is_pos_int(r.get('id'))], default=0)
        max_id = max(max_id, max_dep)
    raw_old = data.get('nextIds', {}).get(collection, 1)
    old_next = int(raw_old) if isinstance(raw_old, int) and not isinstance(raw_old, bool) and raw_old > 0 else 1
    return max(old_next, max_id + 1)

def _atomic_merge_collection(collection, server_items, base_items, new_items, data):
    """Merge client delta (base_items -> new_items) onto server_items inside atomic_update lock (V3-03)."""
    client_delta = _compute_auth_diff(base_items, new_items, collection)
    if not client_delta['has_changes']:
        return copy.deepcopy(server_items), {}

    base_map = {_record_primary_key(collection, r): r for r in base_items if _record_primary_key(collection, r) is not None}
    server_map = {_record_primary_key(collection, r): copy.deepcopy(r) for r in server_items if _record_primary_key(collection, r) is not None}
    server_order = [_record_primary_key(collection, r) for r in server_items if _record_primary_key(collection, r) is not None]

    reassigned_ids = {}
    max_id = _derive_safe_next_id(collection, server_items, data) - 1

    # 1. Check removed records (Delete/Modify check)
    removed_pks = set()
    for old_r in client_delta['removed']:
        pk = _record_primary_key(collection, old_r)
        if pk not in server_map:
            # Already deleted on server — idempotent delete
            continue
        server_r = server_map[pk]
        base_r = base_map.get(pk, old_r)
        if _changed_field_keys(base_r, server_r):
            raise CollectionAuthError(
                409,
                f'Xung đột dữ liệu: Bản ghi ({pk}) đã được người khác cập nhật trên máy chủ trước khi bạn xóa.',
                {
                    'errorCode': 'DATA_CONFLICT',
                    'conflictType': 'DELETED_MODIFIED_RECORD',
                    'recordKey': pk,
                    'serverRecord': server_r
                }
            )
        removed_pks.add(pk)

    # 2. Check modified records (Modify/Delete and Modify/Modify checks)
    for base_r, new_r, client_ckeys in client_delta['modified']:
        pk = _record_primary_key(collection, base_r)
        if pk not in server_map:
            raise CollectionAuthError(
                409,
                f'Xung đột dữ liệu: Bản ghi ({pk}) đã bị xóa trên máy chủ trong lúc bạn đang chỉnh sửa.',
                {
                    'errorCode': 'DATA_CONFLICT',
                    'conflictType': 'MODIFIED_DELETED_RECORD',
                    'recordKey': pk,
                    'clientRecord': new_r
                }
            )
        server_r = server_map[pk]
        server_ckeys = _changed_field_keys(base_r, server_r)
        overlap = client_ckeys & server_ckeys
        for k in overlap:
            if new_r.get(k) != server_r.get(k):
                raise CollectionAuthError(
                    409,
                    f'Xung đột dữ liệu: Trường "{k}" của bản ghi ({pk}) vừa được người khác sửa trên máy chủ.',
                    {
                        'errorCode': 'DATA_CONFLICT',
                        'conflictType': 'MODIFY_MODIFY_OVERLAP',
                        'recordKey': pk,
                        'field': k,
                        'serverRecord': server_r,
                        'clientRecord': new_r
                    }
                )
        # Disjoint field edits or server unchanged: apply client_ckeys onto server_r
        merged_r = copy.deepcopy(server_r)
        for k in client_ckeys:
            if k in new_r:
                merged_r[k] = copy.deepcopy(new_r[k])
            else:
                merged_r.pop(k, None)
        server_map[pk] = merged_r

    # 3. Check added records (Add/Add check)
    added_records = []
    server_week_keys = {r.get('weekKey'): r for r in server_map.values() if isinstance(r, dict) and r.get('weekKey')}
    for new_r in client_delta['added']:
        rec_copy = copy.deepcopy(new_r)
        pk = _record_primary_key(collection, rec_copy)
        if collection == 'schedules':
            wk = rec_copy.get('weekKey')
            if wk in server_week_keys and _changed_field_keys(server_week_keys[wk], rec_copy) - {'id'}:
                raise CollectionAuthError(
                    409,
                    f'Xung đột dữ liệu: Tuần {wk} vừa được tạo trên máy chủ bởi người dùng khác.',
                    {
                        'errorCode': 'DATA_CONFLICT',
                        'conflictType': 'ADD_ADD_NATURAL_KEY',
                        'recordKey': wk,
                        'serverRecord': server_week_keys[wk],
                        'clientRecord': rec_copy
                    }
                )
            elif wk in server_week_keys:
                continue
        if collection in ('reports16h', 'reports7h', 'staffStatuses'):
            if pk in server_map:
                if _changed_field_keys(server_map[pk], rec_copy):
                    raise CollectionAuthError(
                        409,
                        f'Xung đột dữ liệu: Bản ghi {pk} vừa được tạo trên máy chủ bởi người dùng khác.',
                        {
                            'errorCode': 'DATA_CONFLICT',
                            'conflictType': 'ADD_ADD_NATURAL_KEY',
                            'recordKey': pk,
                            'serverRecord': server_map[pk],
                            'clientRecord': rec_copy
                        }
                    )
                continue
            added_records.append(rec_copy)
            continue

        # ID-based collection: if id collides with a record added on server since base_items, reassign a fresh id
        old_id = rec_copy.get('id')
        if old_id in server_map:
            if _changed_field_keys(server_map[old_id], rec_copy):
                max_id += 1
                rec_copy['id'] = max_id
                reassigned_ids[str(old_id)] = max_id
                added_records.append(rec_copy)
            # If identical record was already added, skip duplicate
        else:
            max_id = max(max_id, int(old_id))
            added_records.append(rec_copy)

    merged_list = [server_map[pk] for pk in server_order if pk not in removed_pks and pk in server_map]
    merged_list.extend(added_records)
    return merged_list, reassigned_ids

def _stamp_audit_fields(user, old_items, candidate_items, collection):
    """Stamp server-verified updatedBy onto added/modified records and preserve unchanged records' updatedBy."""
    username = (user or {}).get('sub') or 'unknown'
    old_map = {_record_primary_key(collection, r): r for r in (old_items or []) if _record_primary_key(collection, r) is not None}
    stamped = []
    for r in candidate_items:
        rec = copy.deepcopy(r)
        pk = _record_primary_key(collection, rec)
        if pk in old_map:
            old_r = old_map[pk]
            if _changed_field_keys(old_r, rec):
                rec['updatedBy'] = username
            else:
                if 'updatedBy' in old_r:
                    rec['updatedBy'] = old_r['updatedBy']
                else:
                    rec.pop('updatedBy', None)
        else:
            rec['updatedBy'] = username
        stamped.append(rec)
    return stamped

def _authorize_and_prepare_items(user, collection, old_items, candidate_items, auth_diff, full_data, base_items=None):
    """Enforce record-level, field-level, week-lock, and cross-collection RBAC inside atomic_update."""
    # 1. staff
    if collection == 'staff':
        if _is_admin(user):
            return _stamp_audit_fields(user, old_items, candidate_items, collection)
        my_id = (user or {}).get('staffId')
        if not _is_pos_int(my_id):
            raise CollectionAuthError(403, 'Tài khoản không gắn với hồ sơ nhân sự để tự cập nhật thông tin liên hệ.')
        ref_items = base_items if isinstance(base_items, list) else old_items
        delta = _compute_auth_diff(ref_items, candidate_items, 'staff')
        if delta['added'] or delta['removed']:
            raise CollectionAuthError(403, 'Chỉ Quản trị viên mới có quyền thêm hoặc xóa nhân sự.')
        for old_r, new_r, ckeys in delta['modified']:
            if old_r.get('id') != my_id:
                raise CollectionAuthError(403, 'Bạn chỉ có quyền sửa thông tin liên hệ của chính mình.')
            if not ckeys.issubset({'phone', 'email'}):
                raise CollectionAuthError(403, f'Nhân viên chỉ được tự cập nhật SĐT và Email (không được sửa: {", ".join(sorted(ckeys - {"phone", "email"}))}).')
        # Also verify against live old_items that if new_me is present, no non-contact fields were forged
        new_me = next((r for r in candidate_items if r.get('id') == my_id), None)
        old_me = next((r for r in old_items if r.get('id') == my_id), None)
        if not new_me or not old_me:
            raise CollectionAuthError(403, 'Không tìm thấy hồ sơ nhân sự của bạn.')
        # Patch ONLY phone and email of my_id onto the latest server old_items (safe against stale client snapshots)
        effective = copy.deepcopy(old_items)
        for r in effective:
            if r.get('id') == my_id:
                if 'phone' in new_me:
                    r['phone'] = new_me['phone']
                if 'email' in new_me:
                    r['email'] = new_me['email']
                r['updatedBy'] = user.get('sub', 'unknown')
                break
        return effective

    # 2–6 & 17–20: Admin-only collections
    if collection in ('departedStaff', 'externalDoctors', 'specialTeams', 'staffStatuses', 'conferences',
                      'tasksTrash', 'patients', 'rooms', 'surgerySchedule'):
        if not _is_admin(user):
            raise CollectionAuthError(403, f'Chỉ Quản trị viên mới có quyền cập nhật {collection}.')
        return _stamp_audit_fields(user, old_items, candidate_items, collection)

    # 7. schedules
    if collection == 'schedules':
        if not _is_schedule_editor(user):
            raise CollectionAuthError(403, 'Bạn không có quyền chỉnh sửa lịch phân công tuần.')
        if not _is_superadmin(user):
            current_wk = _current_week_key_vn()
            for r in auth_diff['added']:
                if r.get('weekKey', '') < current_wk:
                    raise CollectionAuthError(403, f'Tuần quá khứ ({r.get("weekKey")}) đã khóa. Chỉ Super Admin mới có quyền chỉnh sửa.')
            for r in auth_diff['removed']:
                if r.get('weekKey', '') < current_wk:
                    raise CollectionAuthError(403, f'Tuần quá khứ ({r.get("weekKey")}) đã khóa. Chỉ Super Admin mới có quyền xóa.')
            for old_r, new_r, _ckeys in auth_diff['modified']:
                if old_r.get('weekKey', '') < current_wk or new_r.get('weekKey', '') < current_wk:
                    raise CollectionAuthError(403, f'Tuần quá khứ ({old_r.get("weekKey")}) đã khóa. Chỉ Super Admin mới có quyền chỉnh sửa.')
        return _stamp_audit_fields(user, old_items, candidate_items, collection)

    # 8. surgeries
    if collection == 'surgeries':
        if not (_is_admin(user) or _is_doctor(user)):
            raise CollectionAuthError(403, 'Chỉ Bác sĩ và Quản trị viên mới có quyền cập nhật lịch mổ.')
        if not _is_superadmin(user):
            for r in auth_diff['added']:
                if is_surgery_week_locked(r.get('date', '')):
                    raise CollectionAuthError(403, f'Tuần của ngày {r.get("date")} đã khóa (> 7 ngày). Chỉ Super Admin mới có quyền thêm ca.')
            for r in auth_diff['removed']:
                if r.get('isTestSandboxCase') is True:
                    continue
                if is_surgery_week_locked(r.get('date', '')):
                    raise CollectionAuthError(403, f'Tuần của ngày {r.get("date")} đã khóa (> 7 ngày). Chỉ Super Admin mới có quyền xóa ca.')
            for old_r, new_r, _ckeys in auth_diff['modified']:
                if is_surgery_week_locked(old_r.get('date', '')) or is_surgery_week_locked(new_r.get('date', '')):
                    raise CollectionAuthError(403, 'Ca mổ thuộc tuần đã khóa (> 7 ngày). Chỉ Super Admin mới có quyền sửa hoặc dời ngày.')
        stamped_surgeries = _stamp_audit_fields(user, old_items, candidate_items, collection)
        return protect_and_reconcile_surgeries_put(
            user=user,
            old_items=old_items,
            candidate_items=stamped_surgeries,
            db=full_data,
            data_dir=DATA_DIR,
            base_dir=BASE_DIR,
        )

    # 9. surgeriesTrash — direct bulk PUT disabled; must use atomic /api/surgeries/<id>/trash & /restore
    if collection == 'surgeriesTrash':
        raise CollectionAuthError(
            403,
            'Vui lòng sử dụng API nguyên tử /api/surgeries/<id>/trash hoặc /restore để bảo toàn trạng thái duyệt mổ.',
            {'errorCode': 'USE_ATOMIC_TRASH_ENDPOINT'}
        )

    # 10. shcmSchedule
    if collection == 'shcmSchedule':
        if not _can_edit_shcm(user):
            raise CollectionAuthError(403, 'Chỉ Bác sĩ chính và Ban Chủ nhiệm mới có quyền chỉnh sửa lịch Sinh hoạt chuyên môn.')
        if not _is_superadmin(user):
            for old_r in auth_diff['removed']:
                if old_r.get('status') == 'done':
                    raise CollectionAuthError(403, 'Bài SHCM đã trình bày (done) đã bị khóa. Chỉ Super Admin mới có quyền xóa.')
            for old_r, new_r, ckeys in auth_diff['modified']:
                if old_r.get('status') == 'done':
                    raise CollectionAuthError(403, 'Bài SHCM đã trình bày (done) đã bị khóa. Chỉ Super Admin mới có quyền chỉnh sửa.')
        return _stamp_audit_fields(user, old_items, candidate_items, collection)

    # 11. shcmSettings
    if collection == 'shcmSettings':
        if not _can_edit_shcm(user):
            raise CollectionAuthError(403, 'Chỉ Bác sĩ chính và Ban Chủ nhiệm mới có quyền cập nhật cài đặt SHCM.')
        return _stamp_audit_fields(user, old_items, candidate_items, collection)

    # 12. plans
    if collection == 'plans':
        if _is_admin(user):
            return _stamp_audit_fields(user, old_items, candidate_items, collection)
        if not _can_edit_shcm(user):
            raise CollectionAuthError(403, 'Bạn không có quyền chỉnh sửa Kế hoạch.')
        # Bác sĩ chính (non-admin): only allowed to add/modify/remove plans strictly linked to shcmSchedule
        shcm_items = full_data.get('shcmSchedule', [])
        shcm_by_id = {s.get('id'): s for s in shcm_items if isinstance(s, dict) and _is_pos_int(s.get('id'))}

        def _is_valid_shcm_plan(p):
            if p.get('source') != 'shcm' or p.get('type') != 'training' or p.get('title') != 'Sinh hoạt chuyên môn BS':
                return False
            shcm_id = p.get('shcmId')
            s = shcm_by_id.get(shcm_id)
            if not s:
                return False
            return p.get('date') == s.get('presentDate') and p.get('responsible') == s.get('doctorId')

        for new_p in auth_diff['added']:
            if not _is_valid_shcm_plan(new_p):
                raise CollectionAuthError(403, 'Bác sĩ chính chỉ được tạo kế hoạch đồng bộ từ lịch Sinh hoạt chuyên môn hợp lệ.')

        for old_p, new_p, _ckeys in auth_diff['modified']:
            if old_p.get('source') != 'shcm' or old_p.get('shcmId') != new_p.get('shcmId'):
                raise CollectionAuthError(403, 'Bác sĩ chính không được chỉnh sửa kế hoạch ngoài Sinh hoạt chuyên môn.')
            if not _is_valid_shcm_plan(new_p):
                raise CollectionAuthError(403, 'Dữ liệu kế hoạch SHCM không khớp với lịch Sinh hoạt chuyên môn hiện hành.')

        for old_p in auth_diff['removed']:
            if old_p.get('source') != 'shcm':
                raise CollectionAuthError(403, 'Bác sĩ chính không được xóa kế hoạch ngoài Sinh hoạt chuyên môn.')
            s = shcm_by_id.get(old_p.get('shcmId'))
            if s and s.get('status') == 'done':
                raise CollectionAuthError(403, 'Không được xóa kế hoạch của bài SHCM đã trình bày (done).')

        return _stamp_audit_fields(user, old_items, candidate_items, collection)

    # 13–14. reports16h, reports7h
    if collection in ('reports16h', 'reports7h'):
        if not _is_admin(user) and len(auth_diff['removed']) > 1:
            raise CollectionAuthError(403, 'Chỉ Quản trị viên mới được phép xóa nhiều báo cáo lịch sử.')
        return _stamp_audit_fields(user, old_items, candidate_items, collection)

    # 15. notifications (per-user scoped + strict protection against surgery_approval forgery/tampering)
    if collection == 'notifications':
        my_id = (user or {}).get('staffId')
        is_sa = _is_superadmin(user)
        def _is_visible_mine(rec):
            return isinstance(rec, dict) and rec.get('toStaffId') == my_id and (is_sa or rec.get('isTestSandboxCase') is not True)

        old_by_id = {r.get('id'): r for r in (old_items or []) if isinstance(r, dict) and _is_pos_int(r.get('id'))}
        my_old = [r for r in (old_items or []) if _is_visible_mine(r)]
        other_old = [copy.deepcopy(r) for r in (old_items or []) if isinstance(r, dict) and not _is_visible_mine(r)]

        # Reject any attempt to touch another user's existing notification ID
        for r in candidate_items:
            rid = r.get('id')
            if rid in old_by_id and not _is_visible_mine(old_by_id[rid]):
                if _changed_field_keys(old_by_id[rid], r):
                    raise CollectionAuthError(
                        403,
                        'Không được sửa thông báo của nhân sự khác.',
                        {'errorCode': 'FORBIDDEN_NOTIFICATION_MUTATION'}
                    )

        ref_items = base_items if isinstance(base_items, list) else my_old
        ref_mine = [r for r in ref_items if _is_visible_mine(r)]
        cand_mine = [r for r in candidate_items if _is_visible_mine(r) and r.get('id') in old_by_id]
        cand_added = [r for r in candidate_items if isinstance(r, dict) and r.get('id') not in old_by_id]

        mine_delta = _compute_auth_diff(ref_mine, cand_mine, 'notifications')
        for old_n, new_n, ckeys in mine_delta['modified']:
            if old_n.get('toStaffId') != my_id:
                raise CollectionAuthError(403, 'Không được sửa thông báo của nhân sự khác.')
            if not ckeys.issubset({'read'}) or new_n.get('read') is not True:
                raise CollectionAuthError(403, 'Chỉ được phép đánh dấu đã đọc thông báo của chính mình.')

        removed_mine_ids = set()
        for old_n in mine_delta['removed']:
            srv_n = old_by_id.get(old_n.get('id'), old_n)
            if srv_n.get('toStaffId') != my_id or not srv_n.get('read'):
                raise CollectionAuthError(403, 'Chỉ được xóa thông báo đã đọc của chính mình.')
            removed_mine_ids.add(srv_n.get('id'))

        tasks_by_id = {t.get('id'): t for t in full_data.get('tasks', []) if isinstance(t, dict) and _is_pos_int(t.get('id'))}
        max_nid = _derive_safe_next_id('notifications', old_items, full_data) - 1
        validated_added = []

        for new_n in cand_added:
            if new_n.get('sourceType') == 'surgery_approval' or str(new_n.get('type') or '').startswith('surgery_'):
                raise CollectionAuthError(
                    403,
                    'Thông báo duyệt mổ chỉ được phát sinh tự động từ giao dịch máy chủ.',
                    {'errorCode': 'FORBIDDEN_APPROVAL_NOTIFICATION_FORGERY'}
                )
            if not _is_admin(user):
                t = tasks_by_id.get(new_n.get('taskId'))
                if (new_n.get('fromStaffId') != my_id
                        or new_n.get('type') not in ('task_accepted', 'task_completed')
                        or not t or t.get('assignee') != my_id):
                    raise CollectionAuthError(403, 'Nhân viên chỉ được tạo thông báo xác nhận/hoàn thành công việc của chính mình.')
            rec_add = copy.deepcopy(new_n)
            if rec_add.get('id') in old_by_id or any(x.get('id') == rec_add.get('id') for x in validated_added):
                max_nid += 1
                rec_add['id'] = max_nid
            else:
                max_nid = max(max_nid, int(rec_add['id']))
            rec_add['updatedBy'] = (user or {}).get('sub') or 'unknown'
            validated_added.append(rec_add)

        cand_mine_by_id = {r.get('id'): r for r in cand_mine}
        updated_my_old = []
        for srv_n in my_old:
            nid = srv_n.get('id')
            if nid in removed_mine_ids:
                continue
            out_n = copy.deepcopy(srv_n)
            if nid in cand_mine_by_id and cand_mine_by_id[nid].get('read') is True and not out_n.get('read'):
                out_n['read'] = True
                out_n['updatedBy'] = (user or {}).get('sub') or 'unknown'
            updated_my_old.append(out_n)

        return other_old + updated_my_old + validated_added

    # 16. tasks
    if collection == 'tasks':
        if _is_admin(user):
            return _stamp_audit_fields(user, old_items, candidate_items, collection)
        my_id = (user or {}).get('staffId')
        if auth_diff['added'] or auth_diff['removed']:
            raise CollectionAuthError(403, 'Chỉ Quản trị viên mới có quyền tạo hoặc xóa công việc.')
        for old_t, new_t, ckeys in auth_diff['modified']:
            if old_t.get('assignee') != my_id:
                raise CollectionAuthError(403, 'Bạn chỉ được cập nhật trạng thái công việc giao cho chính mình.')
            if not ckeys.issubset({'status', 'completedAt'}):
                raise CollectionAuthError(403, 'Nhân viên chỉ được phép cập nhật trạng thái hoàn thành của công việc.')
        return _stamp_audit_fields(user, old_items, candidate_items, collection)

    raise CollectionAuthError(403, f'Không có quyền ghi vào {collection}.')


# ────────────────────────────── Static files ──────────────────────────────
ALLOWLIST_ROOT_FILES = {'index.html', 'manifest.json', 'sw.js', 'favicon.ico'}
ALLOWLIST_STATIC_DIRS = {'css', 'js', 'img', 'fonts'}
ALLOWLIST_STATIC_EXTS = {'.css', '.js', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.woff', '.woff2', '.ttf'}

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    if not path or '\x00' in path or '\\' in path:
        abort(404)
    parts = path.split('/')
    for part in parts:
        if part in ('', '.', '..') or part.startswith('.'):
            abort(404)

    base_real = os.path.realpath(BASE_DIR)

    if '/' not in path:
        if path not in ALLOWLIST_ROOT_FILES:
            abort(404)
        candidate = os.path.join(BASE_DIR, path)
        if os.path.islink(candidate):
            abort(404)
        target_real = os.path.realpath(candidate)
        if os.path.dirname(target_real) != base_real or os.path.basename(target_real) != path:
            abort(404)
        if not os.path.isfile(target_real):
            abort(404)
        return send_from_directory(base_real, path)

    top_dir = parts[0]
    if top_dir not in ALLOWLIST_STATIC_DIRS:
        abort(404)

    cur = BASE_DIR
    for part in parts:
        cur = os.path.join(cur, part)
        if os.path.islink(cur):
            abort(404)

    dir_real = os.path.realpath(os.path.join(BASE_DIR, top_dir))
    candidate = os.path.join(BASE_DIR, path)
    target_real = os.path.realpath(candidate)

    if os.path.splitext(target_real)[1].lower() not in ALLOWLIST_STATIC_EXTS:
        abort(404)
    if os.path.commonpath([dir_real, target_real]) != dir_real:
        abort(404)
    if not os.path.isfile(target_real):
        abort(404)

    return send_from_directory(os.path.dirname(target_real), os.path.basename(target_real))


# ────────────────────────────── Data API ──────────────────────────────
_STRIP_DB_FIELDS = {
    'customPasswords', 'customAdmins', 'disabledAccounts', '_recentMutations',
    '_approvalIdempotency', 'surgeryApprovalLogs', '_lastApprovalJournalSeq'
}

@app.route('/api/data', methods=['GET'])
@require_auth
def get_data():
    """Return the JSON database filtered per authenticated user (Fail-Closed, per-user ETag)"""
    data = load_data()
    try:
        live_user = resolve_live_user_fail_closed(
            request.headers.get('Authorization', ''),
            _verify_jwt,
            AUTH_FILE,
            data,
            _save_auth,
        )
    except ApprovalEngineError as e:
        return jsonify(e.to_dict()), e.status_code

    revisions = data.get('_revisions', {})
    safe_data = filter_db_payload_for_user(data, live_user, _STRIP_DB_FIELDS)
    safe_data['_revisions'] = {col: int(revisions.get(col, 1)) for col in WRITE_COLLECTIONS}

    data_str = json.dumps(safe_data, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    etag_seed = f"uid:{live_user.get('staffId')}:sa:{int(bool(live_user.get('isSuperAdmin')))}:" + data_str
    etag = '"' + hashlib.md5(etag_seed.encode('utf-8')).hexdigest() + '"'
    if request.headers.get('If-None-Match') == etag:
        resp_304 = make_response('', 304)
        resp_304.headers['ETag'] = etag
        resp_304.headers['Vary'] = 'Authorization'
        resp_304.headers['Cache-Control'] = 'private, no-cache, no-store, must-revalidate'
        return resp_304
    resp = make_response(data_str)
    resp.headers['Content-Type'] = 'application/json; charset=utf-8'
    resp.headers['ETag'] = etag
    resp.headers['Vary'] = 'Authorization'
    resp.headers['Cache-Control'] = 'private, no-cache, no-store, must-revalidate'
    return resp

@app.route('/api/data', methods=['PUT'])
@require_superadmin
def put_data():
    """Replace non-protected JSON collections (protected surgery approval collections require /api/admin/disaster-restore)"""
    data = request.get_json(force=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Invalid database payload'}), 400
    present_protected = sorted(set(data.keys()) & PROTECTED_APPROVAL_COLLECTIONS)
    if present_protected:
        return jsonify({
            'error': 'Các collection thuộc hệ thống Duyệt mổ được bảo vệ chống ghi đè hàng loạt. Vui lòng dùng API chuyên biệt hoặc /api/admin/disaster-restore.',
            'code': 'PROTECTED_COLLECTION_USE_DEDICATED_API',
            'errorCode': 'PROTECTED_COLLECTION_USE_DEDICATED_API',
            'protectedCollections': present_protected,
        }), 403
    user = getattr(request, '_user', {}).get('sub', request.headers.get('X-User', 'unknown'))
    client_build = _client_build()
    if client_build < MIN_CLIENT_BUILD:
        audit_log(user, 'data.put.rejected.stale_client', {'clientBuild': client_build, 'requiredBuild': MIN_CLIENT_BUILD})
        return jsonify({
            'error': 'Client too old. Please reload the page before saving.',
            'errorCode': 'STALE_CLIENT',
            'requiredBuild': MIN_CLIENT_BUILD
        }), 409
    for col in WRITE_COLLECTIONS:
        if col in data:
            ok, err_msg = _validate_collection_schema(col, data[col])
            if not ok:
                return jsonify({'error': err_msg, 'collection': col}), 400
    audit_log(user, 'data.put', {'size': len(json.dumps(data))})
    snapshot_data_file('data-put')
    with atomic_update() as current_db:
        revs = current_db.get('_revisions', {})
        for k, v in data.items():
            if k not in _STRIP_DB_FIELDS:
                current_db[k] = v
        new_revs = current_db.setdefault('_revisions', {})
        for col in WRITE_COLLECTIONS:
            new_revs[col] = int(revs.get(col, 1)) + 1
            if isinstance(current_db.get(col), list):
                current_db.setdefault('nextIds', {})[col] = _derive_safe_next_id(col, current_db[col], current_db)
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


@app.route('/api/data/surgeries', methods=['GET'])
@require_auth
def get_surgeries_filtered():
    """Return surgeries filtered by optional date range (sandbox cases hidden from non-superadmin)."""
    data = load_data()
    try:
        live_user = resolve_live_user_fail_closed(
            request.headers.get('Authorization', ''),
            _verify_jwt,
            AUTH_FILE,
            data,
            _save_auth,
        )
    except ApprovalEngineError as e:
        return jsonify(e.to_dict()), e.status_code

    is_sa = bool(live_user.get('isSuperAdmin'))
    surgeries = [
        s for s in data.get('surgeries', [])
        if isinstance(s, dict) and (is_sa or s.get('isTestSandboxCase') is not True)
    ]

    from_date = request.args.get('from')
    to_date = request.args.get('to')

    if from_date or to_date:
        filtered = []
        for s in surgeries:
            d = s.get('date', '')
            if from_date and d < from_date:
                continue
            if to_date and d > to_date:
                continue
            filtered.append(s)
        return jsonify(filtered)

    return jsonify(surgeries)

@app.route('/api/data/<collection>', methods=['GET'])
@require_auth
def get_collection(collection):
    """Return a single collection (per-user filtered for notifications & sandbox cases)"""
    if collection not in WRITE_COLLECTIONS:
        return jsonify({'error': f'Unknown collection "{collection}"'}), 404
    data = load_data()
    try:
        live_user = resolve_live_user_fail_closed(
            request.headers.get('Authorization', ''),
            _verify_jwt,
            AUTH_FILE,
            data,
            _save_auth,
        )
    except ApprovalEngineError as e:
        return jsonify(e.to_dict()), e.status_code

    is_sa = bool(live_user.get('isSuperAdmin'))
    raw_items = data.get(collection, [])
    if collection == 'notifications':
        my_id = live_user.get('staffId')
        items = [
            n for n in raw_items
            if isinstance(n, dict) and n.get('toStaffId') == my_id and (is_sa or n.get('isTestSandboxCase') is not True)
        ]
    elif collection in ('surgeries', 'surgeriesTrash') and not is_sa:
        items = [s for s in raw_items if isinstance(s, dict) and s.get('isTestSandboxCase') is not True]
    else:
        items = raw_items

    if request.args.get('meta') == '1':
        rev = int(data.get('_revisions', {}).get(collection, 1))
        next_id = data.get('nextIds', {}).get(collection)
        return jsonify({'items': items, 'revision': rev, 'nextId': next_id})
    return jsonify(items)

@app.route('/api/data/<collection>', methods=['PUT'])
@require_auth
def put_collection(collection):
    """Replace or atomically merge a single collection (auth + RBAC + revision control enforced)"""
    if collection not in WRITE_COLLECTIONS:
        return jsonify({'error': f'Collection "{collection}" is not writable via API'}), 403
    if collection == 'surgeriesTrash':
        return jsonify({
            'error': 'Vui lòng sử dụng API nguyên tử /api/surgeries/<id>/trash hoặc /restore.',
            'code': 'USE_ATOMIC_TRASH_ENDPOINT',
            'errorCode': 'USE_ATOMIC_TRASH_ENDPOINT',
        }), 403

    user_obj = getattr(request, '_user', {}) or {}
    username = user_obj.get('sub', request.headers.get('X-User', 'unknown'))
    client_build = _client_build()
    if client_build < MIN_CLIENT_BUILD:
        audit_log(username, f'collection.put.rejected.stale_client.{collection}', {'clientBuild': client_build, 'requiredBuild': MIN_CLIENT_BUILD})
        return jsonify({
            'error': 'Client too old. Please reload the page before saving.',
            'code': 'STALE_CLIENT',
            'errorCode': 'STALE_CLIENT',
            'requiredBuild': MIN_CLIENT_BUILD
        }), 409

    payload = request.get_json(force=True, silent=True)
    if payload is None:
        return jsonify({'error': 'Invalid JSON payload'}), 400

    base_revision = None
    base_items = None
    client_mutation_id = None
    force_overwrite_revision = None

    if isinstance(payload, dict) and 'items' in payload:
        items = payload.get('items')
        base_revision = payload.get('baseRevision')
        base_items = payload.get('baseItems')
        client_mutation_id = payload.get('clientMutationId')
        force_overwrite_revision = payload.get('forceOverwriteRevision')
    else:
        items = payload

    ok_schema, schema_err = _validate_collection_schema(collection, items)
    if not ok_schema:
        audit_log(username, f'collection.put.rejected.schema.{collection}', {'error': schema_err})
        return jsonify({'error': schema_err}), 400

    if base_items is not None:
        ok_base, base_err = _validate_collection_schema(collection, base_items)
        if not ok_base:
            return jsonify({'error': f'Invalid baseItems: {base_err}'}), 400

    def _parse_int_rev(val):
        if val is None or isinstance(val, bool):
            return None
        if isinstance(val, int):
            return val
        if isinstance(val, str) and val.strip().isdigit():
            return int(val.strip())
        return None

    parsed_base_rev = _parse_int_rev(base_revision)
    parsed_force_rev = _parse_int_rev(force_overwrite_revision)

    try:
        with atomic_update() as data:
            reconcile_journal_and_db(data, get_journal_path(DATA_DIR))
            live_user = resolve_live_user_fail_closed(
                request.headers.get('Authorization', ''),
                _verify_jwt,
                AUTH_FILE,
                data,
                _save_auth,
            )
            user_obj = live_user
            username = live_user.get('sub', username)

            old_items = data.get(collection, [])
            if not isinstance(old_items, list):
                old_items = []
            revs = data.setdefault('_revisions', {})
            server_rev = int(revs.get(collection, 1))

            # Filter visible server items for per-user / sandbox comparisons
            def _filter_visible(item_list):
                if collection == 'notifications':
                    return [
                        n for n in item_list
                        if isinstance(n, dict)
                        and n.get('toStaffId') == live_user.get('staffId')
                        and (live_user.get('isSuperAdmin') or n.get('isTestSandboxCase') is not True)
                    ]
                if collection == 'surgeries' and not live_user.get('isSuperAdmin'):
                    return [s for s in item_list if isinstance(s, dict) and s.get('isTestSandboxCase') is not True]
                return item_list

            # Step 1: Idempotency check for retried requests (V3-03)
            recent_list = data.setdefault('_recentMutations', {}).setdefault(collection, [])
            if isinstance(client_mutation_id, str) and client_mutation_id.strip():
                for entry in recent_list:
                    if entry.get('id') == client_mutation_id and entry.get('user') == username:
                        return jsonify({
                            'ok': True,
                            'idempotentReplay': True,
                            'version': _get_file_version(),
                            'revision': server_rev,
                            'items': _filter_visible(old_items),
                            'nextId': data.get('nextIds', {}).get(collection),
                            'reassignedIds': entry.get('reassignedIds', {})
                        })

            # Step 2: Revision check & Server-side Atomic Merge (V3-03)
            reassigned_ids = {}
            is_scoped_patch_edit = (collection == 'staff' and not _is_admin(user_obj)) or (collection == 'notifications')
            visible_old_items = _filter_visible(old_items)
            has_diverged = (
                (parsed_base_rev is not None and parsed_base_rev != server_rev)
                or (isinstance(base_items, list) and base_items != visible_old_items)
                or (base_revision is not None and parsed_base_rev is None and base_items is None)
            )

            if is_scoped_patch_edit:
                candidate_items = items
            elif has_diverged:
                if parsed_force_rev is not None and parsed_force_rev == server_rev:
                    candidate_items = items
                elif parsed_force_rev is not None and parsed_force_rev != server_rev:
                    raise CollectionAuthError(
                        409,
                        'Dữ liệu trên máy chủ vừa tiếp tục thay đổi bởi người dùng khác. Vui lòng kiểm tra lại trước khi ghi đè.',
                        {
                            'code': 'DATA_CONFLICT',
                            'errorCode': 'DATA_CONFLICT',
                            'conflictType': 'STALE_FORCE_OVERWRITE',
                            'serverRevision': server_rev,
                            'serverVersion': server_rev,
                            'serverItems': visible_old_items
                        }
                    )
                elif isinstance(base_items, list):
                    candidate_items, reassigned_ids = _atomic_merge_collection(
                        collection, old_items, base_items, items, data
                    )
                else:
                    raise CollectionAuthError(
                        409,
                        'Dữ liệu trên máy chủ đã thay đổi (baseRevision cũ) và thiếu baseItems để hợp nhất tự động.',
                        {
                            'code': 'DATA_CONFLICT',
                            'errorCode': 'DATA_CONFLICT',
                            'conflictType': 'MISSING_BASE_ITEMS',
                            'serverRevision': server_rev,
                            'serverVersion': server_rev,
                            'serverItems': visible_old_items
                        }
                    )
            else:
                candidate_items = items

            # Step 3: Compute Full Structural Diff & Authorize (V3-02, V2-02, V2-03)
            auth_diff = _compute_auth_diff(old_items, candidate_items, collection)
            effective_items = _authorize_and_prepare_items(
                user=user_obj,
                collection=collection,
                old_items=old_items,
                candidate_items=candidate_items,
                auth_diff=auth_diff,
                full_data=data,
                base_items=base_items
            )

            # Recompute final structural diff after _authorize_and_prepare_items
            final_auth_diff = _compute_auth_diff(old_items, effective_items, collection)
            safe_next_id = _derive_safe_next_id(collection, effective_items, data)
            data[collection] = effective_items
            data.setdefault('nextIds', {})[collection] = safe_next_id

            if final_auth_diff['has_changes']:
                new_rev = server_rev + 1
                revs[collection] = new_rev
            else:
                new_rev = server_rev
                revs[collection] = server_rev

            if isinstance(client_mutation_id, str) and client_mutation_id.strip():
                recent_list.append({
                    'id': client_mutation_id,
                    'user': username,
                    'revision': new_rev,
                    'reassignedIds': reassigned_ids,
                    'ts': datetime.now(VN_TZ).isoformat()
                })
                if len(recent_list) > 50:
                    del recent_list[:-50]

            response_items = _filter_visible(effective_items)

            # Build audit summary using diff_collection
            try:
                summary_diff = diff_collection(old_items, effective_items, collection)
                diff_detail = {
                    'count': len(effective_items),
                    'nextId': safe_next_id,
                    'revision': new_rev,
                    'added': len(final_auth_diff['added']),
                    'removed': len(final_auth_diff['removed']),
                    'changed': len(final_auth_diff['modified']),
                    'diff': {
                        'added': summary_diff['added'][:20],
                        'removed': summary_diff['removed'][:20],
                        'changed': summary_diff['changed'][:20]
                    }
                }
            except Exception:
                diff_detail = {'count': len(effective_items), 'nextId': safe_next_id, 'revision': new_rev}

    except ApprovalEngineError as app_err:
        audit_log(username, f'collection.put.rejected.approval.{collection}', {
            'status': app_err.status_code,
            'error': app_err.message,
            'errorCode': app_err.error_code
        })
        return jsonify(app_err.to_dict()), app_err.status_code
    except CollectionAuthError as auth_err:
        payload_err = {'error': auth_err.message}
        if auth_err.detail:
            payload_err.update(auth_err.detail)
            if 'errorCode' in payload_err and 'code' not in payload_err:
                payload_err['code'] = payload_err['errorCode']
            if auth_err.status_code == 409 and 'serverItems' not in payload_err:
                cur_db = load_data()
                srv_rev = int(cur_db.get('_revisions', {}).get(collection, 1))
                raw_srv_items = cur_db.get(collection, [])
                if collection == 'notifications':
                    raw_srv_items = [n for n in raw_srv_items if isinstance(n, dict) and n.get('toStaffId') == user_obj.get('staffId')]
                elif collection == 'surgeries' and not user_obj.get('isSuperAdmin'):
                    raw_srv_items = [s for s in raw_srv_items if isinstance(s, dict) and s.get('isTestSandboxCase') is not True]
                payload_err['serverItems'] = raw_srv_items
                payload_err['serverRevision'] = srv_rev
                payload_err['serverVersion'] = srv_rev
        audit_log(username, f'collection.put.rejected.{collection}', {
            'status': auth_err.status_code,
            'error': auth_err.message,
            'errorCode': payload_err.get('errorCode')
        })
        return jsonify(payload_err), auth_err.status_code

    audit_log(username, f'collection.put.{collection}', diff_detail)
    return jsonify({
        'ok': True,
        'version': _get_file_version(),
        'revision': new_rev,
        'items': response_items,
        'nextId': safe_next_id,
        'reassignedIds': reassigned_ids
    })

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
        if status['locked']:
            response = jsonify({
                'error': f'Đăng nhập tạm bị khóa do nhập sai quá nhiều lần. Vui lòng thử lại sau {LOGIN_LOCKOUT_MINUTES} phút.',
                'retryAfter': status['retryAfter']
            })
            response.headers['Retry-After'] = str(status['retryAfter'])
            return response, 429
        return jsonify({'error': 'Tài khoản hoặc mật khẩu không đúng'}), 401

    # Check activeUntil expiry
    active_until = user.get('activeUntil')
    if active_until:
        from datetime import datetime
        try:
            if datetime.now() >= datetime.fromisoformat(active_until):
                user['disabled'] = True
                user.pop('activeUntil', None)
                _save_auth(auth)
                audit_log(username, 'auth.login.fail', {'reason': 'account_expired', 'activeUntil': active_until})
                return jsonify({'error': 'Tài khoản đã hết hạn sử dụng vào 08:00 03/08/2026.'}), 403
        except ValueError:
            pass

    if user.get('disabled'):
        # Auto-activate if activeFrom date has passed
        active_from = user.get('activeFrom')
        if active_from:
            from datetime import date
            try:
                if date.today() >= date.fromisoformat(active_from):
                    user['disabled'] = False
                    user.pop('activeFrom', None)
                    _save_auth(auth)
                    # Allow login to continue
                else:
                    activation_date = date.fromisoformat(active_from).strftime('%d/%m/%Y')
                    audit_log(username, 'auth.login.fail', {'reason': 'not_yet_active', 'activeFrom': active_from})
                    return jsonify({'error': f'Tài khoản chưa được kích hoạt. Có hiệu lực từ {activation_date}.'}), 403
            except ValueError:
                audit_log(username, 'auth.login.fail', {'reason': 'disabled'})
                return jsonify({'error': 'Tài khoản đã bị vô hiệu hoá. Liên hệ quản trị viên.'}), 403
        else:
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
        return jsonify({'error': 'Tài khoản hoặc mật khẩu không đúng'}), 401

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

@app.route('/api/auth/local-session', methods=['POST'])
def auth_local_session():
    """Issue a local preview SuperAdmin session ONLY for direct loopback requests (never via reverse proxy)."""
    if os.environ.get('PTDTT_DISABLE_LOCAL_AUTOLOGIN') == '1':
        return jsonify({'error': 'Local auto-login disabled'}), 403
    if request.headers.get('X-Forwarded-For') or request.headers.get('X-Real-IP'):
        return jsonify({'error': 'Forbidden outside direct loopback'}), 403
    host_only = (request.host or '').split(':')[0].lower()
    if request.remote_addr not in ('127.0.0.1', '::1') or host_only not in ('localhost', '127.0.0.1'):
        return jsonify({'error': 'Forbidden outside loopback'}), 403

    auth = _load_auth()
    username = 'vkan'
    user = auth.get('users', {}).get(username)
    if not user:
        return jsonify({'error': 'Local admin account not found'}), 404

    token = _create_jwt(username, user)
    return jsonify({
        'token': token,
        'user': {
            'username': username,
            'name': user.get('name', 'Vũ Khương An'),
            'role': user.get('role', 'Phó trưởng khoa'),
            'title': user.get('title', 'BSCKII.'),
            'staffId': user.get('staffId', 2),
            'isAdmin': user.get('isAdmin', True),
            'isSuperAdmin': user.get('isSuperAdmin', True),
            'color': user.get('color', '#8b5cf6')
        }
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

def _resolve_safe_shcm_path(filename):
    """Validate and resolve SHCM PDF path safely (no traversal, no symlinks, .pdf only)."""
    _ensure_shcm_dir()
    if not filename or not isinstance(filename, str):
        return None
    if '\x00' in filename or '/' in filename or '\\' in filename:
        return None
    if os.path.basename(filename) != filename:
        return None
    if filename.startswith('.'):
        return None
    if not filename.lower().endswith('.pdf'):
        return None
    candidate = os.path.join(SHCM_DIR, filename)
    if os.path.islink(candidate):
        return None
    base_real = os.path.realpath(SHCM_DIR)
    target_real = os.path.realpath(candidate)
    if os.path.dirname(target_real) != base_real:
        return None
    try:
        if os.path.commonpath([base_real, target_real]) != base_real:
            return None
    except ValueError:
        return None
    if not os.path.isfile(target_real):
        return None
    return target_real

@app.route('/api/shcm/files', methods=['GET'])
@require_auth
def shcm_list_files():
    _ensure_shcm_dir()
    files = []
    for f in sorted(os.listdir(SHCM_DIR)):
        target_real = _resolve_safe_shcm_path(f)
        if target_real:
            stat = os.stat(target_real)
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
@require_auth
def shcm_download(filename):
    target_real = _resolve_safe_shcm_path(filename)
    if not target_real:
        return jsonify({'error': 'File not found'}), 404
    base_real = os.path.realpath(SHCM_DIR)
    safe_name = os.path.basename(target_real)
    return send_from_directory(base_real, safe_name, as_attachment=True)

@app.route('/api/shcm/delete/<path:filename>', methods=['DELETE'])
@require_auth
def shcm_delete(filename):
    user = request._user
    if not _can_edit_shcm(user):
        return jsonify({'error': 'Chỉ Quản trị viên hoặc Bác sĩ mới có quyền xóa tài liệu SHCM'}), 403
    target_real = _resolve_safe_shcm_path(filename)
    if not target_real:
        return jsonify({'error': 'File not found'}), 404
    os.remove(target_real)
    audit_log(user.get('sub', '?'), 'shcm_delete', {'file': os.path.basename(target_real)})
    return jsonify({'success': True})

def _normalize_legacy_db_ids():
    """Normalize historical duplicate/zero IDs in db.json so strict schema validation passes."""
    if not os.path.exists(DATA_FILE):
        return
    with _data_lock:
        db_data = load_data()
        changed = False
        if 'nextId' in db_data:
            db_data.pop('nextId', None)
            changed = True
        next_ids = db_data.get('nextIds')
        if not isinstance(next_ids, dict):
            next_ids = {}
            db_data['nextIds'] = next_ids
            changed = True

        for col in WRITE_COLLECTIONS:
            if col in ('nextIds', 'reports16h', 'reports7h', 'staffStatuses'):
                continue
            items = db_data.get(col)
            if not isinstance(items, list):
                continue
            max_id = max(
                [it.get('id') for it in items if isinstance(it, dict) and isinstance(it.get('id'), int) and not isinstance(it.get('id'), bool) and it.get('id') > 0] + [0]
            )
            seen_ids = set()
            for it in items:
                if not isinstance(it, dict):
                    continue
                rec_id = it.get('id')
                is_valid_int = isinstance(rec_id, int) and not isinstance(rec_id, bool) and rec_id > 0
                if not is_valid_int or rec_id in seen_ids:
                    max_id += 1
                    it['id'] = max_id
                    rec_id = max_id
                    changed = True
                seen_ids.add(rec_id)
            cur_next = next_ids.get(col, 1)
            if not isinstance(cur_next, int) or isinstance(cur_next, bool) or cur_next <= max_id:
                next_ids[col] = max_id + 1
                changed = True

        if changed:
            save_data(db_data)
            print('[DB] ✅ Normalized legacy collection IDs and nextIds counters in db.json')

# ────────────────────────────── Init ──────────────────────────────
import sys as _sys
register_surgery_approval_routes(app, _sys.modules[__name__])

_ensure_data_dir()
_ensure_log_dir()
_cleanup_old_logs(90)
_normalize_legacy_db_ids()
_init_auth_from_db()
_purge_legacy_db_auth_fields()
ensure_approval_bootstrapped(_sys.modules[__name__])

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
