#!/usr/bin/env python3
"""
PTDTT Manager - Local Server with EMR Proxy
Serves the web app via HTTP and proxies EMR requests to bypass CORS.
Auto-login to EMR and maintains session.

Usage: python3 server.py
Then open: http://localhost:3000
"""

import http.server
import ssl
import json
import os
import re
import uuid
from http.cookiejar import CookieJar
from datetime import datetime
from urllib.parse import urlencode
import urllib.request
import urllib.error

PORT = 3000
EMR_BASE = 'https://emr.com.vn:83'
EMR_DATA_URL = f'{EMR_BASE}/DienBienLamSang/Index1'
EMR_LOGIN_URL = EMR_BASE + '/'
EMR_LOGIN_POST_URL = EMR_BASE + '/'
ROOT = os.path.dirname(os.path.abspath(__file__))

# EMR Credentials
EMR_USER = 'VKAN'
EMR_PASS = 'anmd3010'

# Shared cookie jar for EMR session
cookie_jar = CookieJar()
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(cookie_jar),
    urllib.request.HTTPSHandler(context=ssl_ctx)
)

# Track login state
_emr_logged_in = False

MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
}


def emr_login():
    """Login to EMR and store session cookies"""
    global _emr_logged_in
    now = datetime.now().strftime('%H:%M:%S')
    print(f'[{now}] 🔑 Đăng nhập EMR với tài khoản {EMR_USER}...')

    try:
        # Step 1: GET login page to extract __RequestVerificationToken
        req = urllib.request.Request(EMR_LOGIN_URL, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
        })
        response = opener.open(req, timeout=15)
        login_html = response.read().decode('utf-8', errors='replace')

        # Extract anti-forgery token
        token_match = re.search(
            r'__RequestVerificationToken["\s]*value=["\']([^"\']+)',
            login_html
        )
        if not token_match:
            # Try alternative pattern
            token_match = re.search(
                r'name="__RequestVerificationToken"\s+value="([^"]+)"',
                login_html
            )
        if not token_match:
            token_match = re.search(
                r'value="([^"]+)"\s+name="__RequestVerificationToken"',
                login_html
            )

        token = token_match.group(1) if token_match else ''
        device_id = str(uuid.uuid4())

        print(f'[{now}] 🔑 Token: {token[:20]}... DeviceId: {device_id[:8]}...')

        # Step 2: POST login credentials
        post_data = urlencode({
            'MaNguoiDung': EMR_USER,
            'MatMa': EMR_PASS,
            'deviceId': device_id,
            'deviceName': 'PTDTT-Manager',
            '__RequestVerificationToken': token,
        }).encode('utf-8')

        login_req = urllib.request.Request(EMR_LOGIN_POST_URL, data=post_data, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': '*/*',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': EMR_LOGIN_URL,
        })

        login_response = opener.open(login_req, timeout=15)
        result = login_response.read().decode('utf-8', errors='replace')

        # Check if login succeeded
        if login_response.status == 200:
            print(f'[{now}] ✅ Đăng nhập EMR thành công!')
            _emr_logged_in = True
            return True
        else:
            print(f'[{now}] ❌ Đăng nhập thất bại: HTTP {login_response.status}')
            _emr_logged_in = False
            return False

    except Exception as e:
        print(f'[{now}] ❌ Lỗi đăng nhập EMR: {e}')
        _emr_logged_in = False
        return False


def fetch_emr_data():
    """Fetch patient data, auto-login if needed"""
    global _emr_logged_in
    now = datetime.now().strftime('%H:%M:%S')

    try:
        req = urllib.request.Request(EMR_DATA_URL, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
        })
        response = opener.open(req, timeout=15)
        data = response.read()
        encoding = response.headers.get_content_charset() or 'utf-8'
        html = data.decode(encoding, errors='replace')

        # Check if page contains patient data (look for table rows)
        has_data = '<tbody>' in html and '<tr>' in html
        is_login = ('đăng nhập' in html.lower() or 'MaNguoiDung' in html) and not has_data

        if is_login:
            print(f'[{now}] ⚠️  Session hết hạn, đang tự động đăng nhập lại...')
            if emr_login():
                # Retry fetch after login
                req2 = urllib.request.Request(EMR_DATA_URL, headers={
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml',
                })
                response2 = opener.open(req2, timeout=15)
                data2 = response2.read()
                html = data2.decode(response2.headers.get_content_charset() or 'utf-8', errors='replace')

                if '<tbody>' not in html:
                    return None, 'Login succeeded but no data returned'
            else:
                return None, 'Login failed'

        return html, None

    except Exception as e:
        return None, str(e)


class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        if self.path == '/api/emr' or self.path.startswith('/api/emr?'):
            self._proxy_emr_data()
            return
        if self.path == '/api/emr-status':
            self._emr_status()
            return
        super().do_GET()

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def end_headers(self):
        self._cors_headers()
        super().end_headers()

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')

    def _proxy_emr_data(self):
        """Fetch patient data from EMR with auto-login"""
        now = datetime.now().strftime('%H:%M:%S')
        print(f'[{now}] 📡 Fetching EMR patient data...')

        html, error = fetch_emr_data()

        if error:
            print(f'[{now}] ❌ {error}')
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': error}).encode('utf-8'))
            return

        # Count rows for logging
        row_count = html.count('<tr>') - 1 if html else 0
        print(f'[{now}] ✅ Got {len(html)} bytes ({row_count} patients)')

        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))

    def _emr_status(self):
        """Return EMR connection status"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({
            'loggedIn': _emr_logged_in,
            'user': EMR_USER,
        }).encode('utf-8'))

    def log_message(self, format, *args):
        try:
            msg = format % args if args else format
            if '/api/' in str(msg) or '/emr' in str(msg):
                super().log_message(format, *args)
        except Exception:
            pass


if __name__ == '__main__':
    # Auto-login on startup
    print(f'\n  🏥 PTDTT Manager Server')
    print(f'  ========================')
    emr_login()

    server = http.server.HTTPServer(('', PORT), ProxyHandler)
    print(f'\n  ✅ Server đang chạy tại: http://localhost:{PORT}')
    print(f'  📡 EMR Proxy: http://localhost:{PORT}/api/emr')
    print(f'  ⏱  Auto-refresh mỗi 5 phút')
    print(f'  Nhấn Ctrl+C để dừng\n')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  ⏹ Server đã dừng')
        server.shutdown()
