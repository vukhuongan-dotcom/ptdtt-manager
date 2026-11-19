#!/usr/bin/env python3
"""Regression tests for BUG-228: the GitHub mirror step must never block pull_ready staging."""

from __future__ import annotations

import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
BACKUP_SCRIPT = REPO_ROOT / "scripts" / "backup.sh"
# Hard-coded in backup.sh; the test reproduces the stale registration at this exact path.
BACKUP_WORKTREE = pathlib.Path("/tmp/ptdtt-backup-worktree")

FAILING_HOOK = "#!/bin/bash\n# Mirrors the R45 hook calling a script absent from the backup branch.\nexit 1\n"


def git(repo: pathlib.Path, *args: str) -> str:
    """Run git in repo and return stdout, raising on failure."""
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


class BackupGithubIsolationTest(unittest.TestCase):
    """backup.sh must refresh pull_ready even when the GitHub step is broken."""

    def setUp(self) -> None:
        if BACKUP_WORKTREE.exists():
            self.skipTest(f"{BACKUP_WORKTREE} is in use on this machine")
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="bug228_"))
        self.app = self.tmp / "app"
        self.backups = self.tmp / "backups"
        (self.app / "data").mkdir(parents=True)
        (self.app / "data" / "db.json").write_text(json.dumps({"k": 1}), encoding="utf-8")
        git(self.app, "init", "-q", "-b", "main")
        git(self.app, "config", "user.email", "test@example.invalid")
        git(self.app, "config", "user.name", "test")
        git(self.app, "add", "-A")
        git(self.app, "commit", "-q", "-m", "init")
        git(self.app, "branch", "backup")
        for hook in ("pre-commit", "commit-msg"):
            path = self.app / ".git" / "hooks" / hook
            path.write_text(FAILING_HOOK, encoding="utf-8")
            path.chmod(0o755)
        # Data changes after the backup branch was cut, so a commit is required.
        (self.app / "data" / "db.json").write_text(json.dumps({"k": 2}), encoding="utf-8")

    def tearDown(self) -> None:
        if hasattr(self, "app") and self.app.exists():
            subprocess.run(["git", "-C", str(self.app), "worktree", "prune"], check=False)
        shutil.rmtree(BACKUP_WORKTREE, ignore_errors=True)
        if hasattr(self, "tmp"):
            shutil.rmtree(self.tmp, ignore_errors=True)

    def run_backup(self) -> subprocess.CompletedProcess[str]:
        env = {
            **os.environ,
            "PTDTT_APP_DIR_OVERRIDE": str(self.app),
            "PTDTT_BACKUP_DIR_OVERRIDE": str(self.backups),
            "BACKUP_ENCRYPTION_KEY_FILE": str(self.tmp / "no-key"),
        }
        return subprocess.run(
            ["bash", str(BACKUP_SCRIPT)], env=env, capture_output=True, text=True, timeout=120
        )

    def assert_pull_ready_fresh(self, result: subprocess.CompletedProcess[str]) -> None:
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        artifact = self.backups / "pull_ready" / "latest_backup.tar.gz"
        self.assertTrue(artifact.is_file(), result.stdout)
        self.assertTrue((artifact.parent / "latest_backup.tar.gz.sha256").is_file())

    def test_stale_worktree_and_failing_hooks_do_not_block_pull_ready(self) -> None:
        # Reproduce the production state: registered worktree whose directory vanished.
        git(self.app, "worktree", "add", "-q", str(BACKUP_WORKTREE), "backup")
        shutil.rmtree(BACKUP_WORKTREE)

        result = self.run_backup()

        self.assert_pull_ready_fresh(result)
        self.assertIn("backup: ", git(self.app, "log", "-1", "--format=%s", "backup"))
        self.assertNotIn("ptdtt-backup-worktree", git(self.app, "worktree", "list"))

    def test_github_failure_is_logged_and_step3_still_runs(self) -> None:
        # Make the branch name unusable so the GitHub step fails outright.
        git(self.app, "branch", "-D", "backup")
        (self.app / ".git" / "refs" / "heads" / "backup").mkdir(parents=True)
        (self.app / ".git" / "refs" / "heads" / "backup" / "blocker").write_text("x", encoding="utf-8")

        result = self.run_backup()

        self.assert_pull_ready_fresh(result)
        self.assertIn("GitHub backup failed", result.stdout)


if __name__ == "__main__":
    unittest.main()
