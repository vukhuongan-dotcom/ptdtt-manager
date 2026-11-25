#!/usr/bin/env python3
"""Playwright E2E & Contract Verification Suite for FEAT-242:
Permanent Interactive Spotlight Tutorial directly on the `Điều phối Lịch mổ Robot` tab.
Tests:
  - Auto-starts on first visit to `robot-schedule` (permanent / no expiration date even far in future)
  - 7 role-aware Spotlight steps on Desktop (1440x900) and Mobile (360x800 Chromium, 390x844 WebKit Light & Dark #0C1022)
  - Session close (`Đóng`) vs Permanent per-user dismiss (`Đã hiểu, không tự mở lại`)
  - Permanent manual triggers (`#rbt-tutorial-btn`, `#rbt-mobile-tutorial-pill`, `⋮` menu item)
  - Clean cleanup on navigating away from `robot-schedule` & Zero-Local-PHI enforcement
"""

from __future__ import annotations

import copy
import importlib
import json
import os
import pathlib
import re
import socket
import sys
import tempfile
import threading
import unittest
from datetime import datetime, timedelta, timezone

from playwright.sync_api import sync_playwright
from werkzeug.serving import make_server

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def _today_vn_iso(days_delta: int = 0) -> str:
    d = datetime.now(timezone(timedelta(hours=7))).date() + timedelta(days=days_delta)
    return d.isoformat()


class TestFeat242RobotTutorial(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._orig_env = {
            k: os.environ.get(k)
            for k in ("PTDTT_DATA_DIR", "PTDTT_LOG_DIR", "JWT_SECRET", "PTDTT_TESTING")
        }
        cls.tmp_root_obj = tempfile.TemporaryDirectory(prefix="ptdtt_feat242_suite_")
        cls.tmp_root = pathlib.Path(cls.tmp_root_obj.name)

        boot_dir = cls.tmp_root / "boot"
        (boot_dir / "data").mkdir(parents=True, exist_ok=True)
        (boot_dir / "logs").mkdir(parents=True, exist_ok=True)
        (boot_dir / "data" / "db.json").write_text("{}", encoding="utf-8")
        (boot_dir / "data" / "auth.json").write_text('{"users":{}}', encoding="utf-8")

        os.environ["PTDTT_DATA_DIR"] = str(boot_dir / "data")
        os.environ["PTDTT_LOG_DIR"] = str(boot_dir / "logs")
        os.environ["JWT_SECRET"] = "feat242-unit-test-secret-2026-ptdtt-robot"
        os.environ["PTDTT_TESTING"] = "1"

        if str(REPO_ROOT) not in sys.path:
            sys.path.insert(0, str(REPO_ROOT))
        if "server_flask" in sys.modules:
            cls.sf = importlib.reload(sys.modules["server_flask"])
        else:
            cls.sf = importlib.import_module("server_flask")
        cls.eng = importlib.import_module("surgery_approval_engine")
        cls.rroutes = importlib.import_module("robot_schedule_routes")
        cls.sroutes = importlib.import_module("surgery_approval_routes")

        data_dir = cls.tmp_root / "data"
        log_dir = cls.tmp_root / "logs"
        data_dir.mkdir(parents=True, exist_ok=True)
        log_dir.mkdir(parents=True, exist_ok=True)
        cat_src = REPO_ROOT / "data" / "procedure_catalog_2026_v1.json"
        if cat_src.exists():
            (data_dir / "procedure_catalog_2026_v1.json").write_bytes(cat_src.read_bytes())

        cls.src_db = json.loads((REPO_ROOT / "data" / "db.json").read_text(encoding="utf-8"))
        today_iso = _today_vn_iso(0)

        cfg = copy.deepcopy(cls.eng.DEFAULT_SURGERY_APPROVAL_CONFIG)
        cfg["rolloutAccessMode"] = "all_staff"
        cfg["sandboxOnlyMode"] = False
        db_payload = {
            "_version": 12,
            "staff": copy.deepcopy(cls.src_db.get("staff") or []),
            "departedStaff": [],
            "rooms": copy.deepcopy(cls.src_db.get("rooms") or []),
            "externalDoctors": [],
            "specialTeams": [],
            "staffStatuses": [],
            "plans": [],
            "schedules": [],
            "reports7h": [],
            "reports16h": [],
            "shcmSchedule": [],
            "shcmSettings": [{"id": 1, "defaultTime": "15:30", "defaultDuration": "30m"}],
            "surgeries": [],
            "surgeriesTrash": [],
            "surgeriesArchivedInactive": [],
            "notifications": [],
            "approvalDelegations": [],
            "surgeryApprovalConfig": cfg,
            "nextIds": {"staff": 200, "surgeries": 100000, "notifications": 1},
            "_revisions": {"staff": 1, "surgeries": 1, "notifications": 1, "robotCases": 1},
        }
        data_file = data_dir / "db.json"
        data_file.write_text(json.dumps(db_payload, ensure_ascii=False, indent=2), encoding="utf-8")

        cls.pw_hash = cls.sf._hash_password("Feat242Strong2026")
        users = {
            "vkan": {
                "passwordHash": cls.pw_hash,
                "name": "Vũ Khương An",
                "title": "BSCKII.",
                "role": "BS Phó trưởng khoa",
                "staffId": 2,
                "isAdmin": True,
                "isSuperAdmin": True,
                "disabled": False,
                "mustChangePassword": False,
                "sessionEpoch": 1,
            },
            "vnatuan": {
                "passwordHash": cls.pw_hash,
                "name": "Vũ Ngọc Anh Tuấn",
                "title": "BSCKII.",
                "role": "Bác sĩ chính",
                "staffId": 4,
                "isAdmin": False,
                "isSuperAdmin": False,
                "disabled": False,
                "mustChangePassword": False,
                "sessionEpoch": 1,
            },
            "dieu_duong_xem": {
                "passwordHash": cls.pw_hash,
                "name": "Điều dưỡng Xem lịch",
                "title": "ĐD.",
                "role": "Điều dưỡng",
                "staffId": 99,
                "isAdmin": False,
                "isSuperAdmin": False,
                "disabled": False,
                "mustChangePassword": False,
                "sessionEpoch": 1,
            },
        }
        auth_file = data_dir / "auth.json"
        auth_file.write_text(json.dumps({"users": users}, ensure_ascii=False, indent=2), encoding="utf-8")
        cls._users = users

        os.environ["PTDTT_DATA_DIR"] = str(data_dir)
        os.environ["PTDTT_LOG_DIR"] = str(log_dir)
        cls.sf.DATA_DIR = str(data_dir)
        cls.sf.DATA_FILE = str(data_file)
        cls.sf.AUTH_FILE = str(auth_file)
        cls.sf.LOG_DIR = str(log_dir)
        cls.sf._DB_LOCK_FILE = str(data_dir / ".db.lock")
        cls.sf._data_lock = cls.sf._CrossProcessLock(cls.sf._DB_LOCK_FILE)
        cls.sf._login_attempts.clear()
        cls.sf.app.config["TESTING"] = True

        cls.sroutes.ensure_approval_bootstrapped(cls.sf)
        cls.rroutes.ensure_robot_bootstrapped(cls.sf)

        sw_m = re.search(r"SW_BUILD_VER\s*=\s*'(\d+)'", (REPO_ROOT / "index.html").read_text(encoding="utf-8"))
        cls.sw_build_ver = sw_m.group(1) if sw_m else "2611250843"

        # Seed 1 Robot case with canary phone to verify Zero-Local-PHI
        client = cls.sf.app.test_client()
        token = cls.sf._create_jwt("vkan", users["vkan"])
        client.post(
            "/api/robot/cases",
            headers={"Authorization": f"Bearer {token}", "X-Client-Build": cls.sw_build_ver, "Content-Type": "application/json"},
            json={
                "action": "create_case",
                "patientName": "BN Tutorial Seed Canary",
                "phone": "0987654321",
                "mainSurgeonId": 2,
                "surgeryDate": today_iso,
                "caseSlot": "Ca 1",
                "diagnosis": "U trực tràng",
                "robotProcedure": "Cắt trước thấp Robot",
            },
        )

        port = _find_free_port()
        cls.srv = make_server("127.0.0.1", port, cls.sf.app, threaded=True)
        cls.srv_thread = threading.Thread(target=cls.srv.serve_forever, daemon=True)
        cls.srv_thread.start()
        cls.base_url = f"http://127.0.0.1:{port}"

        cls.pw = sync_playwright().start()
        cls.browsers = {
            "chromium": cls.pw.chromium.launch(headless=True),
            "webkit": cls.pw.webkit.launch(headless=True),
        }

    @classmethod
    def tearDownClass(cls):
        if getattr(cls, "srv", None):
            try:
                cls.srv.shutdown()
                cls.srv.server_close()
            except Exception:
                pass
        for b in getattr(cls, "browsers", {}).values():
            try:
                b.close()
            except Exception:
                pass
        if getattr(cls, "pw", None):
            try:
                cls.pw.stop()
            except Exception:
                pass
        for k, v in cls._orig_env.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        if getattr(cls, "tmp_root_obj", None):
            cls.tmp_root_obj.cleanup()

    def _open_page(self, browser_name: str, width: int, height: int, username: str = "vkan", theme: str = "light", storage_preset: str = ""):
        u = self._users[username]
        token = self.sf._create_jwt(username, u)
        session_obj = {
            "staffId": u["staffId"],
            "username": username,
            "name": u["name"],
            "role": u["role"],
            "title": u["title"],
            "isAdmin": u["isAdmin"],
            "isSuperAdmin": u["isSuperAdmin"],
            "isRobotCoordinator": u["isAdmin"],
            "mustChangePassword": False,
        }
        ctx = self.browsers[browser_name].new_context(
            viewport={"width": width, "height": height},
            service_workers="block",
        )
        ctx.route("**/api/emr*", lambda route: route.fulfill(status=200, content_type="application/json", body='{"patients":[]}'))
        ctx.add_init_script(
            f"""
            localStorage.setItem('ptdtt_cache_ver', '2609281105');
            localStorage.setItem('ptdtt_sw_build', {json.dumps(self.sw_build_ver)});
            localStorage.setItem('ptdtt_jwt', {json.dumps(token)});
            sessionStorage.setItem('ptdtt_jwt', {json.dumps(token)});
            localStorage.setItem('ptdtt_session', {json.dumps(json.dumps(session_obj, ensure_ascii=False))});
            sessionStorage.setItem('ptdtt_session', {json.dumps(json.dumps(session_obj, ensure_ascii=False))});
            localStorage.setItem('ptdtt_onboarding_done', 'true');
            localStorage.setItem('ptdtt_icon_guide_v261121_dismissed', '1');
            localStorage.setItem('ptdtt_theme', {json.dumps(theme)});
            {storage_preset}
            """
        )
        page = ctx.new_page()
        console_errs = []
        page_errs = []

        def _on_console(msg):
            if msg.type == "error":
                txt = msg.text or ""
                if "emr.com.vn:83" in txt:
                    return
                console_errs.append(txt)

        page.on("console", _on_console)
        page.on("pageerror", lambda err: page_errs.append(str(err)))

        page.goto(self.base_url + "/", wait_until="load")
        page.wait_for_function(
            "() => Boolean(typeof Store !== 'undefined' && Store._hasLoadedServerOnce === true && document.getElementById('nav-robot-schedule'))",
            timeout=12000,
        )
        return ctx, page, console_errs, page_errs

    def test_01_auto_starts_permanently_and_walks_7_steps(self):
        ctx, page, cerr, perr = self._open_page("chromium", 1440, 900, username="vkan")
        try:
            # Click Robot tab — tutorial MUST open automatically on first visit
            page.click("#nav-robot-schedule")
            page.wait_for_selector("#robot-tutorial-overlay #rbt-tut-card", timeout=8000)

            for step_num in range(1, 8):
                badge_txt = page.locator("#robot-tutorial-overlay .rbt-tut-badge").inner_text()
                self.assertIn(f"Bước {step_num}/7", badge_txt)
                spot_visible = page.evaluate("() => getComputedStyle(document.getElementById('rbt-tut-spotlight')).display !== 'none'")
                self.assertTrue(spot_visible, f"Spotlight hidden at step {step_num}")
                if step_num < 7:
                    page.click("#rbt-tut-next-btn")
                else:
                    # Last step shows Hoàn tất button
                    next_txt = page.locator("#rbt-tut-next-btn").inner_text()
                    self.assertIn("Hoàn tất", next_txt)
                    page.click("#rbt-tut-next-btn")

            # After completing, overlay is removed and dismissal persisted for user
            self.assertEqual(page.locator("#robot-tutorial-overlay").count(), 0)
            persisted = page.evaluate("() => localStorage.getItem('ptdtt_robot_tutorial_v1_dismissed:vkan')")
            self.assertEqual(persisted, "1")

            # Permanent manual button still opens tutorial anytime
            page.click("#rbt-tutorial-btn")
            page.wait_for_selector("#robot-tutorial-overlay #rbt-tut-card", timeout=4000)
            self.assertEqual(cerr, [], f"Console errors: {cerr}")
            self.assertEqual(perr, [], f"Page errors: {perr}")
        finally:
            ctx.close()

    def test_02_session_close_vs_permanent_dismiss_and_other_user(self):
        ctx, page, cerr, perr = self._open_page("chromium", 1440, 900, username="vnatuan")
        try:
            page.click("#nav-robot-schedule")
            page.wait_for_selector("#robot-tutorial-overlay #rbt-tut-card", timeout=8000)

            # Click session-only close ("Đóng")
            page.click("#rbt-tut-close-btn")
            self.assertEqual(page.locator("#robot-tutorial-overlay").count(), 0)
            self.assertEqual(page.evaluate("() => sessionStorage.getItem('ptdtt_robot_tutorial_v1_session:vnatuan')"), "1")
            self.assertIsNone(page.evaluate("() => localStorage.getItem('ptdtt_robot_tutorial_v1_dismissed:vnatuan')"))

            # Navigating away and back inside same session does NOT re-auto-open
            page.evaluate("() => App.navigate('dashboard')")
            page.wait_for_selector("#dashboard-page", timeout=5000)
            page.click("#nav-robot-schedule")
            page.wait_for_selector("#robot-schedule-page .rbt-kpi-grid", timeout=6000)
            page.wait_for_timeout(300)
            self.assertEqual(page.locator("#robot-tutorial-overlay").count(), 0)

            # Clicking permanent header button ALWAYS reopens tutorial
            page.click("#rbt-tutorial-btn")
            page.wait_for_selector("#robot-tutorial-overlay #rbt-tut-card", timeout=4000)

            # Clicking permanent dismiss saves per-user key
            page.click("#rbt-tut-dismiss-btn")
            self.assertEqual(page.locator("#robot-tutorial-overlay").count(), 0)
            self.assertEqual(page.evaluate("() => localStorage.getItem('ptdtt_robot_tutorial_v1_dismissed:vnatuan')"), "1")
            self.assertEqual(cerr, [], f"Console errors: {cerr}")
            self.assertEqual(perr, [], f"Page errors: {perr}")
        finally:
            ctx.close()

        # Verify another user still gets auto-start even if vnatuan dismissed it
        ctx2, page2, cerr2, perr2 = self._open_page(
            "chromium",
            1440,
            900,
            username="vkan",
            storage_preset="localStorage.setItem('ptdtt_robot_tutorial_v1_dismissed:vnatuan', '1');",
        )
        try:
            page2.click("#nav-robot-schedule")
            page2.wait_for_selector("#robot-tutorial-overlay #rbt-tut-card", timeout=8000)
            self.assertEqual(cerr2, [])
            self.assertEqual(perr2, [])
        finally:
            ctx2.close()

    def test_03_mobile_chromium_and_webkit_light_dark_and_navigate_away(self):
        for engine, vw, vh in (("chromium", 360, 800), ("webkit", 390, 844)):
            for theme in ("light", "dark"):
                ctx, page, cerr, perr = self._open_page(engine, vw, vh, username="vkan", theme=theme)
                try:
                    page.evaluate("() => App.navigate('robot-schedule')")
                    page.wait_for_selector("#robot-tutorial-overlay #rbt-tut-card", timeout=8000)

                    # Header stays <= 80px and buttons >= 44px with zero horizontal overflow
                    metrics = page.evaluate(
                        """() => {
                            const hdr = document.querySelector('#robot-schedule-page .rbt-header');
                            const pill = document.getElementById('rbt-mobile-tutorial-pill');
                            const card = document.getElementById('rbt-tut-card');
                            const btns = Array.from(document.querySelectorAll('#rbt-tut-card .rbt-tut-btn, #rbt-tut-close-x'));
                            const minBtnH = Math.min(...btns.map(b => Math.round(b.getBoundingClientRect().height)));
                            return {
                                hdrH: hdr ? Math.round(hdr.getBoundingClientRect().height) : 999,
                                pillH: pill ? Math.round(pill.getBoundingClientRect().height) : 0,
                                cardRight: card ? Math.round(card.getBoundingClientRect().right) : 999,
                                minBtnH,
                                sw: document.documentElement.scrollWidth,
                                iw: window.innerWidth
                            };
                        }"""
                    )
                    self.assertLessEqual(metrics["hdrH"], 80, f"Mobile header > 80px on {engine} {theme}: {metrics}")
                    self.assertGreaterEqual(metrics["pillH"], 44)
                    self.assertGreaterEqual(metrics["minBtnH"], 44)
                    self.assertLessEqual(metrics["cardRight"], metrics["iw"] + 1)
                    self.assertLessEqual(metrics["sw"], metrics["iw"] + 1)

                    # Step forward and verify Escape closes cleanly
                    page.click("#rbt-tut-next-btn")
                    self.assertIn("Bước 2/7", page.locator("#robot-tutorial-overlay .rbt-tut-badge").inner_text())
                    page.keyboard.press("Escape")
                    self.assertEqual(page.locator("#robot-tutorial-overlay").count(), 0)

                    # Reopen via mobile pill trigger
                    page.click("#rbt-mobile-tutorial-pill")
                    page.wait_for_selector("#robot-tutorial-overlay #rbt-tut-card", timeout=4000)

                    # Navigating away closes tutorial overlay cleanly
                    page.evaluate("() => App.navigate('dashboard')")
                    page.wait_for_selector("#dashboard-page", timeout=5000)
                    self.assertEqual(page.locator("#robot-tutorial-overlay").count(), 0)

                    # Also verify menu sheet has tutorial trigger
                    page.evaluate("() => App.navigate('robot-schedule')")
                    page.wait_for_selector('#robot-schedule-page [data-rbt-action="open_mobile_menu"]', timeout=6000)
                    page.click('#robot-schedule-page [data-rbt-action="open_mobile_menu"]')
                    page.wait_for_selector("#rbt-mobile-menu-tutorial-btn", timeout=4000)
                    page.click("#rbt-mobile-menu-tutorial-btn")
                    page.wait_for_selector("#robot-tutorial-overlay #rbt-tut-card", timeout=4000)

                    self.assertEqual(cerr, [], f"Console errors on {engine} {theme}: {cerr}")
                    self.assertEqual(perr, [], f"Page errors on {engine} {theme}: {perr}")
                finally:
                    ctx.close()

    def test_04_rbac_role_copy_and_zero_local_phi_contract(self):
        # 1. Source-level Zero-Local-PHI contract: executable code in js/robot-schedule.js must not use localStorage/sessionStorage
        rbt_js = (REPO_ROOT / "js" / "robot-schedule.js").read_text(encoding="utf-8")
        rbt_code = re.sub(r'//[^\n]*|/\*[\s\S]*?\*/', '', rbt_js)
        self.assertNotIn("localStorage", rbt_code)
        self.assertNotIn("sessionStorage", rbt_code)

        # 2. Verify permanent (zero date expiry)
        onb_js = (REPO_ROOT / "js" / "onboarding.js").read_text(encoding="utf-8")
        tut_section = onb_js.split("const RobotTutorial =", 1)[1]
        self.assertNotIn("EXPIRES_AT", tut_section)

        # 3. Verify RBAC copy adapts to Viewer vs BS ĐT vs BCN and zero canary PHI leaks
        for uname, expected_phrase in (
            ("vkan", "Ban Chủ nhiệm"),
            ("vnatuan", "Bác sĩ điều trị"),
            ("dieu_duong_xem", "Xem lịch"),
        ):
            ctx, page, cerr, perr = self._open_page("chromium", 1440, 900, username=uname)
            try:
                page.click("#nav-robot-schedule")
                page.wait_for_selector("#robot-tutorial-overlay #rbt-tut-card", timeout=8000)
                desc = page.locator("#robot-tutorial-overlay .rbt-tut-desc").inner_text()
                self.assertIn(expected_phrase, desc, f"Expected '{expected_phrase}' for {uname}, got: {desc}")
                leaks = page.evaluate(
                    """() => ({
                        ls: JSON.stringify(localStorage).includes('0987654321') || JSON.stringify(localStorage).includes('Canary'),
                        ss: JSON.stringify(sessionStorage).includes('0987654321') || JSON.stringify(sessionStorage).includes('Canary')
                    })"""
                )
                self.assertFalse(leaks["ls"])
                self.assertFalse(leaks["ss"])
                self.assertEqual(cerr, [])
                self.assertEqual(perr, [])
            finally:
                ctx.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
