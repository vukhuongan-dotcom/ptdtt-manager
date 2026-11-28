#!/usr/bin/env python3
"""Playwright E2E & Contract Verification Suite for FEAT-252:
Weekly Surgery Schedule Tutorial (1-Week Auto-Show 28/11–05/12/2026).
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
SCRATCH_DIR = pathlib.Path(
    "/Users/khuonganvu/.gemini/antigravity/brain/6d9b695e-5d81-4b39-9a0f-bbf442e40c96/scratch"
)


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def _today_vn_iso(days_delta: int = 0) -> str:
    d = datetime.now(timezone(timedelta(hours=7))).date() + timedelta(days=days_delta)
    return d.isoformat()


class TestFeat252SurgeryTutorial(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._orig_env = {
            k: os.environ.get(k)
            for k in ("PTDTT_DATA_DIR", "PTDTT_LOG_DIR", "JWT_SECRET", "PTDTT_TESTING")
        }
        cls.tmp_root_obj = tempfile.TemporaryDirectory(prefix="ptdtt_feat252_suite_")
        cls.tmp_root = pathlib.Path(cls.tmp_root_obj.name)

        boot_dir = cls.tmp_root / "boot"
        (boot_dir / "data").mkdir(parents=True, exist_ok=True)
        (boot_dir / "logs").mkdir(parents=True, exist_ok=True)
        (boot_dir / "data" / "db.json").write_text("{}", encoding="utf-8")
        (boot_dir / "data" / "auth.json").write_text('{"users":{}}', encoding="utf-8")

        os.environ["PTDTT_DATA_DIR"] = str(boot_dir / "data")
        os.environ["PTDTT_LOG_DIR"] = str(boot_dir / "logs")
        os.environ["JWT_SECRET"] = "feat252-unit-test-secret-2026-ptdtt-surgery-tut"
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
            "surgeries": [
                {
                    "id": 999252,
                    "patientName": "BN Canary Surgery Tutorial",
                    "birthYear": 1966,
                    "date": today_iso,
                    "surgeryType": "chuongtrinh",
                    "approachType": "noisoi",
                    "diagnosis": "Ung thư đại tràng Sigma",
                    "method": "Phẫu thuật nội soi cắt đoạn đại tràng",
                    "duration": 120,
                    "mainSurgeon": 2,
                    "notes": "0987654321",
                }
            ],
            "surgeriesTrash": [],
            "surgeriesArchivedInactive": [],
            "notifications": [],
            "approvalDelegations": [],
            "surgeryApprovalConfig": cfg,
            "nextIds": {"staff": 200, "surgeries": 1000000, "notifications": 1},
            "_revisions": {"staff": 1, "surgeries": 1, "notifications": 1, "robotCases": 1},
        }
        data_file = data_dir / "db.json"
        data_file.write_text(json.dumps(db_payload, ensure_ascii=False, indent=2), encoding="utf-8")

        cls.pw_hash = cls.sf._hash_password("Feat252TestSecret2026")
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
        cls.sw_build_ver = sw_m.group(1) if sw_m else "2611282010"

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
            "() => Boolean(typeof Store !== 'undefined' && Store._hasLoadedServerOnce === true && document.getElementById('nav-surgery'))",
            timeout=12000,
        )
        return ctx, page, console_errs, page_errs

    def test_01_auto_show_on_click_surgery_tab_6_steps_and_dismiss(self):
        ctx, page, cerr, perr = self._open_page("chromium", 1440, 900, username="vnatuan")
        try:
            # Click Weekly Surgery tab -> Tutorial auto-opens inside 1-week window (28/11 - 05/12/2026)
            page.click("#nav-surgery")
            page.wait_for_selector("#surgery-tutorial-overlay #surg-tut-card", timeout=5000)

            badge1 = page.locator("#surgery-tutorial-overlay .rbt-tut-badge").inner_text()
            self.assertIn("28/11 – 05/12", badge1)
            self.assertIn("Bước 1/6", badge1)

            # Keyboard ArrowRight & ArrowLeft + step dot navigation
            page.keyboard.press("ArrowRight")
            self.assertIn("Bước 2/6", page.locator("#surgery-tutorial-overlay .rbt-tut-badge").inner_text())
            page.keyboard.press("ArrowLeft")
            self.assertIn("Bước 1/6", page.locator("#surgery-tutorial-overlay .rbt-tut-badge").inner_text())

            page.click('#surgery-tutorial-overlay [data-surg-tut-dot="4"]')
            self.assertIn("Bước 5/6", page.locator("#surgery-tutorial-overlay .rbt-tut-badge").inner_text())

            page.click("#surg-tut-next-btn")
            self.assertIn("Bước 6/6", page.locator("#surgery-tutorial-overlay .rbt-tut-badge").inner_text())
            self.assertIn("Hoàn tất", page.locator("#surg-tut-next-btn").inner_text())

            # Click "✓ Hoàn tất" -> persists per-user dismiss flag & closes overlay
            page.click("#surg-tut-next-btn")
            self.assertEqual(page.locator("#surgery-tutorial-overlay").count(), 0)
            self.assertEqual(
                page.evaluate("() => localStorage.getItem('ptdtt_surgery_tutorial_v261128_dismissed:vnatuan')"),
                "1",
            )

            # Reloading and clicking tab again must NOT auto-open
            page.reload(wait_until="load")
            page.wait_for_function(
                "() => Boolean(typeof Store !== 'undefined' && Store._hasLoadedServerOnce === true && document.getElementById('nav-surgery'))",
                timeout=12000,
            )
            page.click("#nav-surgery")
            page.wait_for_selector("#surgery-page", timeout=5000)
            page.wait_for_timeout(350)
            self.assertEqual(page.locator("#surgery-tutorial-overlay").count(), 0)

            # Desktop manual button reopens anytime
            page.click("#surg-tutorial-btn")
            page.wait_for_selector("#surgery-tutorial-overlay #surg-tut-card", timeout=4000)
            self.assertEqual(cerr, [], f"Console errors: {cerr}")
            self.assertEqual(perr, [], f"Page errors: {perr}")
        finally:
            ctx.close()

    def test_02_one_week_window_boundaries_session_close_and_rbac(self):
        # Part A: Window boundary + sessionStorage dismiss + manual reopen after expiry
        ctx, page, cerr, perr = self._open_page("chromium", 1440, 900, username="vkan")
        try:
            page.click("#nav-surgery")
            page.wait_for_selector("#surgery-tutorial-overlay #surg-tut-card", timeout=5000)

            win_checks = page.evaluate(
                """() => ({
                    before: SurgeryTutorial.isWithinWindow(new Date('2026-11-27T23:59:59+07:00')),
                    start: SurgeryTutorial.isWithinWindow(new Date('2026-11-28T00:00:00+07:00')),
                    end: SurgeryTutorial.isWithinWindow(new Date('2026-12-05T23:59:59+07:00')),
                    after: SurgeryTutorial.isWithinWindow(new Date('2026-12-06T00:00:00+07:00')),
                    autoAfterExpiry: SurgeryTutorial.shouldAutoShow({ now: new Date('2026-12-06T00:00:00+07:00') })
                })"""
            )
            self.assertFalse(win_checks["before"])
            self.assertTrue(win_checks["start"])
            self.assertTrue(win_checks["end"])
            self.assertFalse(win_checks["after"])
            self.assertFalse(win_checks["autoAfterExpiry"])

            # Session-only close ("Đóng")
            page.click("#surg-tut-close-btn")
            self.assertEqual(page.locator("#surgery-tutorial-overlay").count(), 0)
            self.assertEqual(
                page.evaluate("() => sessionStorage.getItem('ptdtt_surgery_tutorial_v261128_session:vkan')"),
                "1",
            )
            self.assertIsNone(
                page.evaluate("() => localStorage.getItem('ptdtt_surgery_tutorial_v261128_dismissed:vkan')")
            )

            # Same session re-visit does not auto-open
            page.evaluate("() => App.navigate('dashboard')")
            page.wait_for_selector("#dashboard-page", timeout=5000)
            page.click("#nav-surgery")
            page.wait_for_selector("#surgery-page", timeout=5000)
            page.wait_for_timeout(320)
            self.assertEqual(page.locator("#surgery-tutorial-overlay").count(), 0)

            # Clearing session dismiss restores shouldAutoShow
            self.assertTrue(
                page.evaluate(
                    "() => { SurgeryTutorial.clearSessionDismiss(); return SurgeryTutorial.shouldAutoShow(); }"
                )
            )
            # Forced open still succeeds
            self.assertTrue(page.evaluate("() => SurgeryTutorial.start({ force: true })"))
            page.wait_for_selector("#surgery-tutorial-overlay #surg-tut-card", timeout=4000)
            self.assertEqual(cerr, [])
            self.assertEqual(perr, [])
        finally:
            ctx.close()

        # Part B: RBAC Q1 (read-only role does NOT auto-open, yet manual button still works)
        ctx_ro, page_ro, cerr_ro, perr_ro = self._open_page("chromium", 1440, 900, username="dieu_duong_xem")
        try:
            page_ro.click("#nav-surgery")
            page_ro.wait_for_selector("#surgery-page", timeout=5000)
            page_ro.wait_for_timeout(350)
            self.assertEqual(page_ro.locator("#surgery-tutorial-overlay").count(), 0)

            page_ro.click("#surg-tutorial-btn")
            page_ro.wait_for_selector("#surgery-tutorial-overlay #surg-tut-card", timeout=4000)
            self.assertEqual(cerr_ro, [])
            self.assertEqual(perr_ro, [])
        finally:
            ctx_ro.close()

    def test_03_cleanup_on_navigate_openform_and_zero_local_phi(self):
        ctx, page, cerr, perr = self._open_page("chromium", 1440, 900, username="vkan")
        try:
            page.click("#nav-surgery")
            page.wait_for_selector("#surgery-tutorial-overlay #surg-tut-card", timeout=5000)

            # Navigating away cleans up overlay
            page.evaluate("() => App.navigate('dashboard')")
            page.wait_for_selector("#dashboard-page", timeout=5000)
            self.assertEqual(page.locator("#surgery-tutorial-overlay").count(), 0)

            # Open manually then open surgery form -> tutorial cleanly closes without obstructing modal
            page.click("#nav-surgery")
            page.wait_for_selector("#surgery-page", timeout=5000)
            page.click("#surg-tutorial-btn")
            page.wait_for_selector("#surgery-tutorial-overlay #surg-tut-card", timeout=4000)

            page.evaluate("() => SurgeryPage.openForm()")
            page.wait_for_selector("#modal-overlay.active", timeout=4000)
            self.assertEqual(page.locator("#surgery-tutorial-overlay").count(), 0)

            # Zero-Local-PHI enforcement (SurgeryTutorial keys & non-store localStorage/sessionStorage never hold PHI)
            leaks = page.evaluate(
                """() => {
                    const lsKeys = Object.keys(localStorage).filter(k => k !== 'ptdtt_manager' && k !== 'ptdtt_data');
                    const ssKeys = Object.keys(sessionStorage);
                    const tutKeys = Object.keys(localStorage).concat(ssKeys).filter(k => k.includes('surgery_tutorial'));
                    const badTutVal = tutKeys.some(k => {
                        const v = localStorage.getItem(k) || sessionStorage.getItem(k);
                        return v !== '1';
                    });
                    const lsDump = lsKeys.map(k => k + '=' + localStorage.getItem(k)).join('|');
                    const ssDump = ssKeys.map(k => k + '=' + sessionStorage.getItem(k)).join('|');
                    const tutSteps = JSON.stringify(SurgeryTutorial.getSteps());
                    return {
                        ls: lsDump.includes('0987654321') || lsDump.includes('Canary'),
                        ss: ssDump.includes('0987654321') || ssDump.includes('Canary'),
                        tutSteps: tutSteps.includes('0987654321') || tutSteps.includes('Canary'),
                        badTutVal
                    };
                }"""
            )
            self.assertFalse(leaks["ls"])
            self.assertFalse(leaks["ss"])
            self.assertFalse(leaks["tutSteps"])
            self.assertFalse(leaks["badTutVal"])
            self.assertEqual(cerr, [])
            self.assertEqual(perr, [])
        finally:
            ctx.close()

    def test_04_dual_engine_responsive_dark_light_mobile_menu_and_screenshots(self):
        SCRATCH_DIR.mkdir(parents=True, exist_ok=True)
        matrix = [
            ("chromium", 360, 800, "light", SCRATCH_DIR / "feat252_surgery_tutorial_mobile_light.png"),
            ("chromium", 360, 800, "dark", SCRATCH_DIR / "feat252_surgery_tutorial_mobile_dark.png"),
            ("chromium", 852, 393, "light", None),
            ("chromium", 1440, 900, "light", SCRATCH_DIR / "feat252_surgery_tutorial_desktop_light.png"),
            ("webkit", 360, 800, "light", None),
            ("webkit", 360, 800, "dark", None),
            ("webkit", 852, 393, "light", None),
            ("webkit", 1440, 900, "light", None),
        ]
        for engine, vw, vh, theme, shot_path in matrix:
            with self.subTest(engine=engine, vw=vw, vh=vh, theme=theme):
                ctx, page, cerr, perr = self._open_page(engine, vw, vh, username="vkan", theme=theme)
                try:
                    page.evaluate("() => App.navigate('surgery')")
                    page.wait_for_selector("#surgery-tutorial-overlay #surg-tut-card", timeout=6000)
                    page.wait_for_timeout(300)

                    metrics = page.evaluate(
                        """() => {
                            const card = document.getElementById('surg-tut-card');
                            const r = card ? card.getBoundingClientRect() : null;
                            const btns = Array.from(document.querySelectorAll('#surg-tut-card .rbt-tut-btn, #surg-tut-close-x'));
                            const minBtnH = btns.length ? Math.min(...btns.map(b => Math.round(b.getBoundingClientRect().height))) : 0;
                            return {
                                sw: document.documentElement.scrollWidth,
                                iw: window.innerWidth,
                                ih: window.innerHeight,
                                cardLeft: r ? Math.round(r.left) : -1,
                                cardRight: r ? Math.round(r.right) : 9999,
                                cardTop: r ? Math.round(r.top) : -1,
                                cardBottom: r ? Math.round(r.bottom) : 9999,
                                minBtnH
                            };
                        }"""
                    )
                    self.assertLessEqual(metrics["sw"], metrics["iw"] + 1, f"Overflow on {engine} {vw}x{vh} {theme}: {metrics}")
                    self.assertGreaterEqual(metrics["cardLeft"], 0)
                    self.assertLessEqual(metrics["cardRight"], metrics["iw"] + 1)
                    self.assertGreaterEqual(metrics["cardTop"], 0)
                    self.assertLessEqual(metrics["cardBottom"], metrics["ih"] + 1)
                    if vw <= 768:
                        self.assertGreaterEqual(metrics["minBtnH"], 44, f"Mobile button <44px on {engine} {vw}x{vh}: {metrics}")

                    if shot_path is not None:
                        page.screenshot(path=str(shot_path))

                    # On portrait mobile, Escape closes then ⋮ tools sheet reopens tutorial
                    if vw == 360:
                        page.keyboard.press("Escape")
                        self.assertEqual(page.locator("#surgery-tutorial-overlay").count(), 0)
                        page.click("#surg-mobile-more-btn")
                        page.wait_for_selector("#surg-mobile-menu-tutorial-btn", timeout=4000)
                        page.click("#surg-mobile-menu-tutorial-btn")
                        page.wait_for_selector("#surgery-tutorial-overlay #surg-tut-card", timeout=4000)

                    self.assertEqual(cerr, [], f"Console errors on {engine} {vw}x{vh} {theme}: {cerr}")
                    self.assertEqual(perr, [], f"Page errors on {engine} {vw}x{vh} {theme}: {perr}")
                finally:
                    ctx.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
