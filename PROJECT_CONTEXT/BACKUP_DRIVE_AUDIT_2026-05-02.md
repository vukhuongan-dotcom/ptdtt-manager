# PTDTT Backup / Drive Audit - 2026-05-02

## Muc tieu

Giam khoi luong Google Drive phai dong bo khi backup PTDTT, nhung van giu duoc kha nang khoi phuc du lieu quan trong.

## Ket luan audit

- Tarball `backup_2026-04-20.tar.gz` tung chua ca `data/backups/*.tar.gz` ben trong backup moi.
- Phan du lon nhat nam o `data/backups/*`, khong nam o `data/db.json` hay `data/auth.json`.
- Mirror repo tren Drive tung con sot thu muc `.git`, khien Drive theo doi them metadata khong can thiet.
- Luong `pull-backup-to-drive.sh` hien dang fail tren may Mac, nen can xac minh lai SSH/SCP sau khi chot cau truc backup.

## Thay doi da ap dung o local repo

- `scripts/pull-backup-to-drive.sh`
  - Chuyen tu `SCP/expect` sang tai `HTTPS` tu `https://khoaptdtt.info.vn/data/backups/latest_backup.tar.gz`.
  - Drive chi giu `7` ban `backup_*.tar.gz` moi nhat.
  - Local staging van giu cleanup theo `30` ngay nhu truoc.
- `scripts/sync-drive-mirror.sh`
  - Tu dong xoa `.git` cu trong Drive mirror truoc khi sync.
  - Chuyen sang sync tang dan theo commit, chi cap nhat cac file thay doi tu lan mirror thanh cong truoc.

## Checklist xac minh VPS dang dung backup moi

Chay cac lenh sau tren VPS:

```bash
cd /var/www/ptdtt-manager
git rev-parse HEAD
sed -n '1,220p' scripts/backup.sh
crontab -l
ls -lah data/backups
tar -tzf data/backups/latest_backup.tar.gz | sed -n '1,120p'
```

Can xac nhan cac diem sau:

- Trong `scripts/backup.sh`, vong lap backup `data/*` co dong bo qua `backups`.
- `latest_backup.tar.gz` khong con chua `data/backups/`.
- Archive chi can co cac thanh phan can thiet nhu `data/db.json`, `data/auth.json`, `data/shcm-files/` neu can.
- Cron/job live dang goi dung `scripts/backup.sh` moi.

## Neu muon giam tai them nua

- Chi dua `db.json` va `auth.json` vao tarball neu `shcm-files/` khong can offsite hang ngay.
- Drive chi can giu `latest_backup.tar.gz` neu GitHub backup branch va local `/var/backups/ptdtt` da dang tin cay.
- Kiem tra va sua loi SSH/SCP trong `pull-backup-to-drive.sh` de backup Drive hoat dong on dinh tro lai.
