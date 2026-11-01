import hashlib
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "register_bug_feat.py"
INSTALL_SH = ROOT / "scripts" / "install-git-hooks.sh"


class AutoRegistryGateContractTests(unittest.TestCase):
    def test_01_live_repo_hooks_installed_and_dual_ssot_valid(self):
        for hook_name in ("pre-commit", "commit-msg", "post-push"):
            src = ROOT / "scripts" / "git-hooks" / hook_name
            dst = ROOT / ".git" / "hooks" / hook_name
            self.assertTrue(src.exists(), f"Missing versioned hook {src}")
            self.assertTrue(dst.exists(), f"Missing active hook {dst}")
            self.assertEqual(src.read_bytes(), dst.read_bytes(), f"Hook drift on {hook_name}")
            self.assertTrue(dst.stat().st_mode & 0o111, f"Hook {dst} is not executable")

        cp = subprocess.run([sys.executable, str(SCRIPT), "verify"], cwd=str(ROOT), capture_output=True, text=True)
        self.assertEqual(cp.returncode, 0, cp.stderr)

    def _init_sandbox_repo(self, tmp: Path) -> None:
        subprocess.run(["git", "init", "-q"], cwd=str(tmp), check=True)
        subprocess.run(["git", "config", "user.email", "test@khoaptdtt.info.vn"], cwd=str(tmp), check=True)
        subprocess.run(["git", "config", "user.name", "PTDTT Test"], cwd=str(tmp), check=True)

        (tmp / "docs").mkdir(parents=True, exist_ok=True)
        (tmp / "PROJECT_CONTEXT").mkdir(parents=True, exist_ok=True)
        (tmp / "scripts" / "git-hooks").mkdir(parents=True, exist_ok=True)
        (tmp / "js").mkdir(parents=True, exist_ok=True)

        shutil.copy2(SCRIPT, tmp / "scripts" / "register_bug_feat.py")
        shutil.copy2(INSTALL_SH, tmp / "scripts" / "install-git-hooks.sh")
        for h in ("pre-commit", "commit-msg", "post-push"):
            shutil.copy2(ROOT / "scripts" / "git-hooks" / h, tmp / "scripts" / "git-hooks" / h)

        sample_reg = (
            "# BẢNG TỔNG HỢP LỖI\n\n"
            "## 📊 TỔNG QUAN THỐNG KÊ LỖI & TÍNH NĂNG ĐÃ KHẮC PHỤC (SCHEMA V3.1)\n\n"
            "- **Tổng số sự cố & tính năng ghi nhận:** **1 mục** (1 BUG, 0 FEAT).\n"
            "- **Lịch sử kế thừa chưa thẩm tra (`UNVERIFIED_HISTORICAL`):** **0 mục** (Kế thừa).\n"
            "- **Đã sửa, chờ kiểm chứng độc lập (`FIXED_PENDING_VERIFY`):** **0 mục** (Chờ duyệt).\n"
            "- **Đã xác minh hoàn tất (`VERIFIED_CLOSED`):** **1 mục** (BUG-163 đến BUG-163 — Đã kiểm chứng).\n"
            "- **Đang xử lý (`OPEN`):** 0\n"
            "- **Đã phong tỏa an toàn (`CONTAINED`):** 0\n"
            "- **Mở lại sau đóng (`REOPENED`):** 0\n"
            "- **Thời gian ghi nhận:** Từ **26/03/2026** đến **30/10/2026** (toàn bộ lịch sử mã nguồn).\n\n"
            "## 📋 PHẦN II: MA TRẬN TOÀN BỘ 1 SỰ CỐ & TÍNH NĂNG MỚI (SCHEMA V3.1 — 14 TRƯỜNG BẮT BUỘC)\n\n"
            "| STT | Mã định danh | Ngày ghi nhận | Commit Link | Phân hệ ảnh hưởng | Tiêu đề tóm tắt | Hiện tượng / Bối cảnh | Mức độ | Trạng thái RCA | Giải pháp & Build | Trạng thái kỹ thuật | Biên lai xác minh | Rủi ro tồn dư | Ngày đóng & Người duyệt |\n"
            "|:---:|:---:|:---:|:---:|:---:|---|---|:---:|:---:|---|:---:|---|---|:---:|\n"
            "| 1 | `BUG-163` | 2026-10-30 | `v2610301200` | **Khởi tạo** | Mẫu | Bối cảnh | P2 - Medium | VERIFIED_ROOT_CAUSE | Giải pháp (`v2610301200`) | VERIFIED_CLOSED | Unit test PASS | Thấp (Đã kiểm chứng) | 2026-10-30 — BSCKII. Vũ Khương An |\n"
        )
        (tmp / "docs" / "BUG_FIX_REGISTRY.md").write_text(sample_reg, encoding="utf-8")
        (tmp / "PROJECT_CONTEXT" / "BANG_TONG_HOP_LOI_VA_KHAC_PHUC.md").write_text(sample_reg, encoding="utf-8")
        (tmp / "version.md").write_text(
            "# Changelog — PTDTT Manager\n\n> 📌 **Current Build Stamp:** `2610301200`\n\n## [Unreleased]\n\n### Added\n\n### Fixed\n",
            encoding="utf-8",
        )
        (tmp / "js" / "app.js").write_text("const ok = 1;\n", encoding="utf-8")

        subprocess.run(["git", "add", "."], cwd=str(tmp), check=True)
        subprocess.run(["git", "commit", "-m", "chore: seed repo"], cwd=str(tmp), check=True)
        subprocess.run(["bash", "scripts/install-git-hooks.sh"], cwd=str(tmp), capture_output=True, check=True)

    def test_02_commit_blocked_when_fixing_code_without_registry_row(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            self._init_sandbox_repo(tmp)
            (tmp / "js" / "app.js").write_text("const ok = 2;\n", encoding="utf-8")
            subprocess.run(["git", "add", "js/app.js"], cwd=str(tmp), check=True)
            cp = subprocess.run(["git", "commit", "-m", "fix: tweak app without registry"], cwd=str(tmp), capture_output=True, text=True)
            self.assertNotEqual(cp.returncode, 0, "Commit without registry update MUST be blocked!")
            self.assertIn("AUTO-REGISTRY GATE CHẶN COMMIT", cp.stderr)

    def test_03_commit_blocked_on_js_syntax_error(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            self._init_sandbox_repo(tmp)
            (tmp / "js" / "app.js").write_text("const broken = {\n", encoding="utf-8")
            subprocess.run(["git", "add", "js/app.js"], cwd=str(tmp), check=True)
            cp = subprocess.run(["git", "commit", "-m", "fix: broken syntax"], cwd=str(tmp), capture_output=True, text=True)
            self.assertNotEqual(cp.returncode, 0)
            self.assertIn("SYNTAX GATE", cp.stderr)

    def test_04_add_escapes_pipes_commits_and_backfills_sha(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            self._init_sandbox_repo(tmp)
            (tmp / "js" / "app.js").write_text("const ok = 3;\n", encoding="utf-8")

            cp_add = subprocess.run(
                [
                    sys.executable,
                    "scripts/register_bug_feat.py",
                    "add",
                    "--kind",
                    "BUG",
                    "--date",
                    "2026-11-01",
                    "--scope",
                    "UI & Regex",
                    "--title",
                    "Sửa biểu thức `(a|b)`",
                    "--context",
                    "Biểu thức `x || y` làm gãy cột bảng",
                    "--solution",
                    "Tự động escape `\\|` trong `register_bug_feat.py`",
                    "--build",
                    "2611011000",
                    "--version-note",
                    "Khắc phục tự động escape ký tự cột bảng",
                ],
                cwd=str(tmp),
                capture_output=True,
                text=True,
            )
            self.assertEqual(cp_add.returncode, 0, cp_add.stderr)

            subprocess.run(
                ["git", "add", "js/app.js", "docs/BUG_FIX_REGISTRY.md", "PROJECT_CONTEXT/BANG_TONG_HOP_LOI_VA_KHAC_PHUC.md", "version.md"],
                cwd=str(tmp),
                check=True,
            )
            cp_commit = subprocess.run(
                ["git", "commit", "-m", "fix(ui): escape pipe chars [BUG-164]"],
                cwd=str(tmp),
                capture_output=True,
                text=True,
            )
            self.assertEqual(cp_commit.returncode, 0, cp_commit.stderr)

            sha = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=str(tmp), text=True).strip()
            cp_bf = subprocess.run([sys.executable, "scripts/register_bug_feat.py", "backfill-sha"], cwd=str(tmp), capture_output=True, text=True)
            self.assertEqual(cp_bf.returncode, 0, cp_bf.stderr)

            subprocess.run(
                ["git", "add", "docs/BUG_FIX_REGISTRY.md", "PROJECT_CONTEXT/BANG_TONG_HOP_LOI_VA_KHAC_PHUC.md", "version.md"],
                cwd=str(tmp),
                check=True,
            )
            cp_doc_commit = subprocess.run(
                ["git", "commit", "-m", f"docs(registry): record commit link {sha} for BUG-164"],
                cwd=str(tmp),
                capture_output=True,
                text=True,
            )
            self.assertEqual(cp_doc_commit.returncode, 0, cp_doc_commit.stderr)

            p1 = tmp / "docs" / "BUG_FIX_REGISTRY.md"
            p2 = tmp / "PROJECT_CONTEXT" / "BANG_TONG_HOP_LOI_VA_KHAC_PHUC.md"
            self.assertEqual(hashlib.sha256(p1.read_bytes()).hexdigest(), hashlib.sha256(p2.read_bytes()).hexdigest())
            self.assertIn(f"[`{sha}`](https://github.com/vukhuongan-dotcom/ptdtt-manager/commit/{sha})", p1.read_text(encoding="utf-8"))
            self.assertIn("2 mục** (2 BUG, 0 FEAT)", p1.read_text(encoding="utf-8"))
            self.assertIn(f"commit `{sha}`", (tmp / "version.md").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
