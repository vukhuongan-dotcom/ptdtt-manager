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

# ────────────────────────────── Config ──────────────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_DIR  = os.path.join(BASE_DIR, 'data')
DATA_FILE = os.path.join(DATA_DIR, 'db.json')
LOG_DIR   = os.path.join(BASE_DIR, 'logs')
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

if __name__ == '__main__':
    print(f'\n  🏥 PTDTT Manager Server (Flask)')
    print(f'  ================================')
    threading.Thread(target=emr_login, daemon=True).start()
    print(f'  🌐 http://0.0.0.0:{PORT}')
    print(f'  📡 EMR Proxy: /api/emr')
    print(f'  💾 Data API: /api/data')
    print(f'  Ctrl+C to stop\n')
    app.run(host='0.0.0.0', port=PORT, debug=False)
