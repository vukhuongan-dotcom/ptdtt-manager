#!/usr/bin/env node
// ===== LOCAL SERVER FOR PTDTT MANAGER =====
// Serves the web app via HTTP and proxies EMR requests to bypass CORS
// Usage: node server.js
// Then open: http://localhost:3000

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;
const EMR_URL = 'https://emr.com.vn:83/DienBienLamSang/Index1';

// MIME types
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
    // CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Proxy endpoint for EMR
    if (req.url === '/api/emr' || req.url.startsWith('/api/emr?')) {
        console.log(`[${new Date().toLocaleTimeString('vi-VN')}] Proxy: Fetching EMR data...`);

        // Parse cookies from request header to forward
        const cookieHeader = req.headers.cookie || '';

        const emrUrl = new URL(EMR_URL);
        const options = {
            hostname: emrUrl.hostname,
            port: emrUrl.port || 443,
            path: emrUrl.pathname,
            method: 'GET',
            rejectUnauthorized: false, // Accept self-signed certs
            headers: {
                'Accept': 'text/html,application/xhtml+xml',
                'User-Agent': 'Mozilla/5.0',
                'Cookie': cookieHeader
            }
        };

        const proxyReq = https.request(options, (proxyRes) => {
            let body = '';
            proxyRes.on('data', chunk => body += chunk);
            proxyRes.on('end', () => {
                console.log(`[${new Date().toLocaleTimeString('vi-VN')}] Proxy: Got ${body.length} bytes, status ${proxyRes.statusCode}`);
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(body);
            });
        });

        proxyReq.on('error', (err) => {
            console.error(`[${new Date().toLocaleTimeString('vi-VN')}] Proxy error:`, err.message);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        });

        proxyReq.setTimeout(15000, () => {
            proxyReq.destroy();
            res.writeHead(504, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Timeout' }));
        });

        proxyReq.end();
        return;
    }

    // Static file serving
    let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    const ext = path.extname(filePath);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`\n  ✅ PTDTT Manager đang chạy tại: http://localhost:${PORT}`);
    console.log(`  📡 EMR Proxy endpoint: http://localhost:${PORT}/api/emr`);
    console.log(`  ⏱  Auto-refresh dữ liệu EMR mỗi 5 phút\n`);
});
