#!/usr/bin/env python3
"""Isolated contract tests for ptdtt-manager backup staging & pull safety gates."""

from __future__ import annotations

import hashlib
import io
import json
import os
import pathlib
import stat
import subprocess
import sys
import tarfile
import tempfile
import unittest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
PULL_SCRIPT = REPO_ROOT / "scripts" / "pull-backup-to-drive.sh"
BACKUP_SCRIPT = REPO_ROOT / "scripts" / "backup.sh"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def build_tar_gz(path: pathlib.Path, entries: list[tuple[str, bytes | None, str | None]]) -> str:
    """Create a .tar.gz archive.

    entries: list of (member_name, raw_bytes_or_None, symlink_target_or_None)
    """
    with tarfile.open(path, "w:gz") as tf:
        for name, content, sym_target in entries:
            ti = tarfile.TarInfo(name=name)
            ti.mtime = 1793318400  # 2026-10-30T00:00:00Z
            if sym_target is not None:
                ti.type = tarfile.SYMTYPE
                ti.linkname = sym_target
                tf.addfile(ti)
            else:
                payload = content if content is not None else b""
                ti.size = len(payload)
                ti.mode = 0o600
                tf.addfile(ti, io.BytesIO(payload))
    return sha256_file(path)


class PullBackupContractTests(unittest.TestCase):
    FIXED_NOW = 1793325600  # 2026-10-30T02:00:00Z

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix="ptdtt_backup_test_")
        self.root = pathlib.Path(self._tmp.name)
        self.source_dir = self.root / "remote_pull_ready"
        self.local_dir = self.root / "local_backups"
        self.drive_parent = self.root / "mounted_drive" / "ptdtt-manager"
        self.drive_dir = self.drive_parent / "backups"
        self.receipt_path = self.root / "logs" / "ptdtt_backup_pull_receipt.json"
        self.ops_env = self.root / "ops.env"

        self.source_dir.mkdir(parents=True, exist_ok=True)
        self.local_dir.mkdir(parents=True, exist_ok=True)
        self.drive_dir.mkdir(parents=True, exist_ok=True)
        self.ops_env.write_text(
            'PTDTT_VPS_HOST="root@127.0.0.1"\n',
            encoding="utf-8",
        )
        os.chmod(self.ops_env, 0o600)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _stage_plain_archive(
        self,
        entries: list[tuple[str, bytes | None, str | None]] | None = None,
        mtime: int | None = None,
        override_sha: str | None = None,
    ) -> tuple[pathlib.Path, str]:
        if entries is None:
            db_bytes = json.dumps(
                {"patients": [{"id": "P001"}], "surgeries": [{"id": "S001"}]},
                ensure_ascii=False,
            ).encode("utf-8")
            entries = [
                ("data/db.json", db_bytes, None),
                ("data/audit.jsonl", b'{"ev":"ok"}\n', None),
            ]
        arc = self.source_dir / "latest_backup.tar.gz"
        digest = build_tar_gz(arc, entries)
        ts = self.FIXED_NOW - 1800 if mtime is None else mtime
        os.utime(arc, (ts, ts))
        sha_path = self.source_dir / "latest_backup.tar.gz.sha256"
        sha_path.write_text((override_sha or digest) + "\n", encoding="utf-8")
        return arc, digest

    def _run_pull(self, extra_env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env.update(
            {
                "PTDTT_OPS_ENV": str(self.ops_env),
                "PTDTT_PYTHON_BIN": sys.executable,
                "PTDTT_LOCAL_SOURCE_DIR": str(self.source_dir),
                "PTDTT_LOCAL_BACKUP_DIR": str(self.local_dir),
                "PTDTT_DRIVE_BACKUP_DIR": str(self.drive_dir),
                "PTDTT_PULL_RECEIPT_PATH": str(self.receipt_path),
                "PTDTT_NOW_EPOCH_OVERRIDE": str(self.FIXED_NOW),
                "PTDTT_DATE_TAG_OVERRIDE": "2026-10-30",
                "PYTHONDONTWRITEBYTECODE": "1",
            }
        )
        if extra_env:
            for k, v in extra_env.items():
                if v == "__UNSET__":
                    env.pop(k, None)
                else:
                    env[k] = v
        return subprocess.run(
            ["/bin/bash", str(PULL_SCRIPT)],
            env=env,
            capture_output=True,
            text=True,
            timeout=30,
        )

    def test_00_static_security_invariants_no_public_http_or_insecure_ssh(self) -> None:
        pull_txt = PULL_SCRIPT.read_text(encoding="utf-8")
        backup_txt = BACKUP_SCRIPT.read_text(encoding="utf-8")
        self.assertNotIn("StrictHostKeyChecking=no", pull_txt)
        self.assertIn("StrictHostKeyChecking=yes", pull_txt)
        self.assertNotIn("/data/backups/latest_backup", pull_txt)
        self.assertNotIn('$APP_DIR/data/backups', backup_txt)
        self.assertIn("$BACKUP_DIR/pull_ready", backup_txt)

    def test_01_valid_plain_archive_publishes_local_drive_and_receipt(self) -> None:
        _, digest = self._stage_plain_archive()
        res = self._run_pull()
        self.assertEqual(res.returncode, 0, msg=res.stderr + "\n" + res.stdout)

        local_out = self.local_dir / "backup_2026-10-30.tar.gz"
        drive_out = self.drive_dir / "backup_2026-10-30.tar.gz"
        self.assertTrue(local_out.is_file())
        self.assertTrue(drive_out.is_file())
        self.assertEqual(sha256_file(local_out), digest)
        self.assertEqual(sha256_file(drive_out), digest)
        self.assertEqual(stat.S_IMODE(local_out.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(self.receipt_path.stat().st_mode), 0o600)

        rcpt = json.loads(self.receipt_path.read_text(encoding="utf-8"))
        self.assertEqual(rcpt["status"], "PASS")
        self.assertTrue(rcpt["sandbox_restore_verified"])
        self.assertTrue(rcpt["local_verified"])
        self.assertTrue(rcpt["drive_mirrored"])
        self.assertEqual(rcpt["archive_sha256"], digest)
        self.assertEqual(rcpt["db_top_keys_count"], 2)

    def test_02_valid_encrypted_archive_decrypts_in_sandbox_and_publishes(self) -> None:
        raw_tar = self.root / "raw_plain.tar.gz"
        build_tar_gz(
            raw_tar,
            [("data/db.json", b'{"patients":[{"id":"ENC1"}]}', None)],
        )
        key_file = self.root / "backup.key"
        key_file.write_text("unit-test-aes-256-secret-key-material\n", encoding="utf-8")
        os.chmod(key_file, 0o600)

        enc_arc = self.source_dir / "latest_backup.tar.gz.enc"
        subprocess.run(
            [
                "openssl",
                "enc",
                "-aes-256-cbc",
                "-pbkdf2",
                "-salt",
                "-pass",
                f"file:{key_file}",
                "-in",
                str(raw_tar),
                "-out",
                str(enc_arc),
            ],
            check=True,
        )
        ts = self.FIXED_NOW - 600
        os.utime(enc_arc, (ts, ts))
        enc_sha = sha256_file(enc_arc)
        (self.source_dir / "latest_backup.tar.gz.enc.sha256").write_text(enc_sha + "\n", encoding="utf-8")

        res = self._run_pull({"PTDTT_BACKUP_DECRYPT_KEY_FILE": str(key_file)})
        self.assertEqual(res.returncode, 0, msg=res.stderr + "\n" + res.stdout)

        local_out = self.local_dir / "backup_2026-10-30.tar.gz.enc"
        drive_out = self.drive_dir / "backup_2026-10-30.tar.gz.enc"
        self.assertEqual(sha256_file(local_out), enc_sha)
        self.assertEqual(sha256_file(drive_out), enc_sha)
        rcpt = json.loads(self.receipt_path.read_text(encoding="utf-8"))
        self.assertEqual(rcpt["status"], "PASS")
        self.assertEqual(rcpt["archive_name"], "backup_2026-10-30.tar.gz.enc")

    def test_03_corrupted_sha256_rejected_and_preserves_lkg(self) -> None:
        lkg_local = self.local_dir / "backup_2026-10-29.tar.gz"
        lkg_drive = self.drive_dir / "backup_2026-10-29.tar.gz"
        lkg_local.write_bytes(b"lkg-local-content")
        lkg_drive.write_bytes(b"lkg-drive-content")
        before_local_sha = sha256_file(lkg_local)
        before_drive_sha = sha256_file(lkg_drive)

        self._stage_plain_archive(override_sha="0" * 64)
        res = self._run_pull()
        self.assertEqual(res.returncode, 1)
        self.assertFalse((self.local_dir / "backup_2026-10-30.tar.gz").exists())
        self.assertFalse((self.drive_dir / "backup_2026-10-30.tar.gz").exists())
        self.assertEqual(sha256_file(lkg_local), before_local_sha)
        self.assertEqual(sha256_file(lkg_drive), before_drive_sha)

    def test_04_tar_path_traversal_and_symlink_rejected(self) -> None:
        # Case A: ../escape.json
        self._stage_plain_archive(
            entries=[
                ("data/db.json", b'{"ok": 1}', None),
                ("../escape.json", b'{"pwn": 1}', None),
            ]
        )
        res_a = self._run_pull()
        self.assertEqual(res_a.returncode, 1)
        self.assertFalse((self.local_dir / "backup_2026-10-30.tar.gz").exists())

        # Case B: symlink inside archive
        self._stage_plain_archive(
            entries=[
                ("data/db.json", b'{"ok": 1}', None),
                ("data/evil_link", None, "/etc/passwd"),
            ]
        )
        res_b = self._run_pull()
        self.assertEqual(res_b.returncode, 1)
        self.assertFalse((self.local_dir / "backup_2026-10-30.tar.gz").exists())

    def test_05_missing_or_corrupt_db_json_rejected(self) -> None:
        # Missing data/db.json
        self._stage_plain_archive(entries=[("data/other.json", b'{"a":1}', None)])
        res_missing = self._run_pull()
        self.assertEqual(res_missing.returncode, 1)

        # Invalid JSON in data/db.json
        self._stage_plain_archive(entries=[("data/db.json", b"{corrupt-json", None)])
        res_corrupt = self._run_pull()
        self.assertEqual(res_corrupt.returncode, 1)
        self.assertFalse((self.local_dir / "backup_2026-10-30.tar.gz").exists())

    def test_06_stale_or_future_archive_rejected(self) -> None:
        # Stale: 40 hours old (> 36h limit)
        self._stage_plain_archive(mtime=self.FIXED_NOW - 40 * 3600)
        res_stale = self._run_pull()
        self.assertEqual(res_stale.returncode, 1)

        # Future skew: 2 hours in future
        self._stage_plain_archive(mtime=self.FIXED_NOW + 7200)
        res_future = self._run_pull()
        self.assertEqual(res_future.returncode, 1)

    def test_07_unmounted_drive_exits_2_saves_local_and_never_creates_fake_mount(self) -> None:
        _, digest = self._stage_plain_archive()
        unmounted_root = self.root / "unmounted_google_drive"
        unmounted_target = unmounted_root / "ptdtt-manager" / "backups"

        res = self._run_pull({"PTDTT_DRIVE_BACKUP_DIR": str(unmounted_target)})
        self.assertEqual(res.returncode, 2, msg=res.stderr + "\n" + res.stdout)
        self.assertFalse(unmounted_root.exists())

        local_out = self.local_dir / "backup_2026-10-30.tar.gz"
        self.assertTrue(local_out.is_file())
        self.assertEqual(sha256_file(local_out), digest)

        rcpt = json.loads(self.receipt_path.read_text(encoding="utf-8"))
        self.assertEqual(rcpt["status"], "DEGRADED_DRIVE_UNAVAILABLE")
        self.assertTrue(rcpt["local_verified"])
        self.assertFalse(rcpt["drive_mirrored"])

    def test_08_retention_preserves_lkg_and_ignores_unowned_or_symlinks(self) -> None:
        old_mtime = self.FIXED_NOW - (45 * 86400)  # 45 days old (> 30 days)
        old_1 = self.local_dir / "backup_2026-08-01.tar.gz"
        old_2 = self.local_dir / "backup_2026-08-02.tar.gz"
        old_3 = self.local_dir / "backup_2026-08-03.tar.gz"
        for p in (old_1, old_2, old_3):
            p.write_bytes(b"old-owned-archive")
            os.utime(p, (old_mtime, old_mtime))

        unowned = self.local_dir / "MANUAL_AUDIT_NOTE.txt"
        unowned.write_text("do not delete\n", encoding="utf-8")
        os.utime(unowned, (old_mtime, old_mtime))

        symlink_item = self.local_dir / "backup_2026-07-01.tar.gz"
        symlink_item.symlink_to(unowned)

        self._stage_plain_archive()
        # With min_keep=3, after publishing backup_2026-10-30 we have 4 owned archives:
        # 08-01, 08-02, 08-03, 10-30 -> only 08-01 may be pruned; 08-02 & 08-03 stay as LKG despite >30d!
        res = self._run_pull({"PTDTT_LOCAL_MIN_KEEP_COUNT": "3"})
        self.assertEqual(res.returncode, 0, msg=res.stderr + "\n" + res.stdout)

        self.assertFalse(old_1.exists())
        self.assertTrue(old_2.exists())
        self.assertTrue(old_3.exists())
        self.assertTrue((self.local_dir / "backup_2026-10-30.tar.gz").exists())
        self.assertTrue(unowned.exists())
        self.assertTrue(symlink_item.is_symlink())

    def test_09_ssh_transport_failure_exits_1_and_preserves_lkg(self) -> None:
        lkg = self.local_dir / "backup_2026-10-29.tar.gz"
        lkg.write_bytes(b"safe-lkg")
        before_sha = sha256_file(lkg)

        empty_known_hosts = self.root / "empty_known_hosts"
        empty_known_hosts.write_text("", encoding="utf-8")

        res = self._run_pull(
            {
                "PTDTT_LOCAL_SOURCE_DIR": "__UNSET__",
                "PTDTT_SSH_TARGET": "root@127.0.0.1",
                "PTDTT_SSH_PORT": "1",
                "PTDTT_SSH_KNOWN_HOSTS": str(empty_known_hosts),
            }
        )
        self.assertEqual(res.returncode, 1)
        self.assertEqual(sha256_file(lkg), before_sha)
        self.assertFalse((self.local_dir / "backup_2026-10-30.tar.gz").exists())


if __name__ == "__main__":
    unittest.main()
