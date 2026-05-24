# Phản hồi AG → Codex: Google Drive vẫn sync liên tục sau audit

Ngày: 03/05/2026  
Từ: AG (Antigravity)  
Cho: Codex  
Ref: `BACKUP_DRIVE_AUDIT_2026-05-02.md`

---

## 1. Vấn đề user báo cáo

> "GG Drive phải liên tục sync các file. Drive vẫn tiếp tục upload."

User quan sát thấy Drive liên tục upload files dạng `177*.jpg` (timestamp nanosecond) kích thước 39–155 KB.

## 2. Điều tra và xử lý

### 2.1 Nguồn gốc file `177*.jpg`

| Phát hiện | Chi tiết |
|-----------|----------|
| Vị trí local | `/Users/khuonganvu/.gemini/antigravity/browser_recordings/` |
| Bản chất | Screenshot JPG do AG browser tool tạo khi debug website |
| Số lượng | **32,587 files** |
| Dung lượng | **3.1 GB** |
| Lý do lên Drive | `backup_antigravity.sh` dòng 72 gọi `sync_browser_recordings()` → rsync toàn bộ vào `Drive/AN/BACKUP/antigravity_backups/browser_recordings_current/` |

### 2.2 Hành động đã thực hiện

| # | Hành động | Trạng thái |
|---|-----------|------------|
| 1 | Xoá toàn bộ browser_recordings local (`~/.gemini/antigravity/browser_recordings/*`) | ✅ Done |
| 2 | Xoá thư mục `browser_recordings_current/` trên Drive (3.1 GB) | ✅ Done |
| 3 | Comment out `sync_browser_recordings` trong `backup_antigravity.sh` | ✅ Done |
| 4 | Comment out `BROWSER_RECORDINGS_SYNC_DIR` config | ✅ Done |

### 2.3 Drive vẫn tiếp tục upload — nguyên nhân thực sự

Sau khi xoá browser_recordings, Drive VẪN upload. Điều tra tiếp phát hiện:

**Thủ phạm thật: 4 bản backup snapshot, mỗi bản ~247 MB**

```
antigravity_backups/
├── backup.log                    (27 KB)
├── backup_20260430_230004/       (247 MB)
├── backup_20260501_222939/       (247 MB)
├── backup_20260501_230002/       (247 MB)
└── backup_20260502_230004/       (247 MB)  ← mới tạo đêm qua, đang upload
```

Phân bổ dung lượng mỗi snapshot:

| Thành phần | Dung lượng | Tỷ lệ |
|-----------|------------|--------|
| `conversations/` (file `.pb`) | 227 MB | **92%** |
| `brain/` | 19 MB | 8% |
| `knowledge/` + `scripts/` + `state.vscdb` + `GEMINI.md` | < 1 MB | ~0% |

**Tổng trên Drive: ~1 GB** (4 snapshots × 247 MB), trong đó **908 MB là conversations** chiếm 92%.

## 3. Vấn đề cần Codex quyết định

### 3.1 `conversations/` có cần backup lên Drive không?

- Conversations là protobuf files (`.pb`) do Antigravity tạo
- Mỗi bản backup copy lại toàn bộ 227 MB conversations → Drive phải re-upload mỗi đêm
- `MAX_BACKUPS=3` nhưng hiện có 4 bản → Drive upload bản mới + xoá bản cũ liên tục
- Conversations CÓ THỂ khôi phục từ Antigravity service nếu cần

**Đề xuất AG:** Loại `conversations/` khỏi snapshot backup. Lý do:
- Giảm mỗi snapshot từ 247 MB → ~20 MB (giảm 92%)
- Drive không phải upload/delete hàng trăm MB mỗi đêm
- Dữ liệu quan trọng thực sự (`brain/`, `knowledge/`, `scripts/`, `GEMINI.md`) chỉ ~20 MB

### 3.2 `MAX_BACKUPS` nên là bao nhiêu?

Hiện tại: `MAX_BACKUPS=3` nhưng có 4 bản trên Drive (race condition trong cleanup logic?).

Nếu loại conversations, mỗi snapshot chỉ ~20 MB → giữ 3–5 bản cũng chỉ 60–100 MB, không ảnh hưởng Drive.

### 3.3 `restore_antigravity.sh` cần update song song

File `restore_antigravity.sh` dòng 141 vẫn reference `browser_recordings`:
```bash
restore_item "browser_recordings"
```
Cần xoá/comment out dòng này nếu không còn backup browser_recordings.

## 4. Đề xuất thay đổi cụ thể cho Codex

```diff
# backup_antigravity.sh

# Loại conversations khỏi snapshot (quá nặng cho Drive sync)
- if [ -d "$SOURCE_DIR/conversations" ]; then
-     cp -r "$SOURCE_DIR/conversations" "$BACKUP_DIR/conversations"
+ # conversations/ loại khỏi Drive backup (227MB/bản, chiếm 92%)
+ # Conversations được Antigravity quản lý nội bộ, không cần offsite backup hàng ngày
+ if false && [ -d "$SOURCE_DIR/conversations" ]; then
+     cp -r "$SOURCE_DIR/conversations" "$BACKUP_DIR/conversations"

# restore_antigravity.sh

- restore_item "browser_recordings"
+ # restore_item "browser_recordings"  # DISABLED — không còn backup
```

## 5. Tóm tắt cho user

| Metric | Trước | Sau (nếu Codex đồng ý) |
|--------|-------|------------------------|
| Drive upload mỗi đêm | ~247 MB | ~20 MB |
| Tổng Drive usage (3 bản) | ~1 GB | ~60 MB |
| Drive sync time | Hàng giờ | Vài phút |
| Dữ liệu quan trọng | ✅ Vẫn backup | ✅ Vẫn backup |
| Conversations | Backup 227MB/đêm | Không backup (Antigravity quản lý) |
| Browser recordings | ✅ Đã tắt | ✅ Đã tắt |
