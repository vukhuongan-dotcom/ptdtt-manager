# Quy trình cập nhật VERSION — PTDTT Manager

## 5 chỗ PHẢI cập nhật đồng bộ khi deploy mới

| # | Biến | File | Ý nghĩa |
|---|---|---|---|
| 1 | `CLIENT_BUILD` | `js/store.js` dòng 4 | Số integer client gửi lên server qua `X-Client-Build` header |
| 2 | `REQUIRED_VER` | `index.html` dòng 8 | String localStorage — force reload khi deploy mới |
| 3 | `?v=` | `index.html` (47 chỗ) | Cache buster cho CSS/JS |
| 4 | `MIN_CLIENT_BUILD` | `/etc/systemd/system/ptdtt.service` | Server reject client quá cũ |
| 5 | `CACHE_NAME` | `sw.js` dòng 2 | Service Worker cache bucket (format khác: `ptdtt-vVERSION`) |

## Format version

```
YYMMDDHHMM (10 chữ số, không leading zero)
```

Ví dụ: `2606062130` = ngày 06/06/2026 lúc 21:30

**Quan trọng:** `CLIENT_BUILD` là JavaScript integer — không được bắt đầu bằng `0` (sẽ bị parse thành octal).

## Checklist deploy

```bash
NEW_VER="YYMMDDHHMM"   # ví dụ: 2606062130

# 1. js/store.js
sed -i "s/const CLIENT_BUILD = [0-9]*/const CLIENT_BUILD = ${NEW_VER}/" js/store.js

# 2. index.html — REQUIRED_VER
sed -i "s/var REQUIRED_VER = '[0-9]*'/var REQUIRED_VER = '${NEW_VER}'/" index.html

# 3. index.html — 47x ?v=
sed -i "s/?v=[0-9]*/?v=${NEW_VER}/g" index.html

# 4. sw.js — CACHE_NAME
sed -i "s/const CACHE_NAME = 'ptdtt-v[^']*'/const CACHE_NAME = 'ptdtt-v${NEW_VER}'/" sw.js

# 5. systemd — MIN_CLIENT_BUILD (trên server)
ssh root@server "sed -i 's/MIN_CLIENT_BUILD=[0-9]*/MIN_CLIENT_BUILD=${NEW_VER}/' \
  /etc/systemd/system/ptdtt.service && \
  systemctl daemon-reload && systemctl restart ptdtt"

# Verify
grep "CLIENT_BUILD\|REQUIRED_VER" js/store.js index.html sw.js
```

## Lịch sử versions

| Ngày | Version | Ghi chú |
|---|---|---|
| 28/04/2028? | `2804281805` | CLIENT_BUILD ban đầu (store.js) |
| 28/04/2028? | `2804281755` | REQUIRED_VER ban đầu |
| 15/05/2026 | `1505261506` | `?v=` lần cuối cập nhật |
| 21/04/2020? | `2104201745` | MIN_CLIENT_BUILD quá cũ |
| 06/06/2026 | `0606261630` | SW CACHE_NAME (Phase 0) |
| **06/06/2026** | **`2606062130`** | **Đồng bộ tất cả (Phase 1.6)** ✅ |
