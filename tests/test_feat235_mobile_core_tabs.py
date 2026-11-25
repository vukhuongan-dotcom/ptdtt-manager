#!/usr/bin/env python3
"""Comprehensive Playwright Verification Suite for FEAT-235:
Mobile Redesign (Android Chrome & iPhone WebKit) for Dashboard, Staff Tracking, Rooms
+ Desktop Rooms Enhancements + Inline Header '+' Button Relocation on Robot Schedule.

Covers Chromium (360x800, 390x844, 600x900 negative viewport, 1440x900 desktop)
and WebKit (390x844 Light & Dark #0C1022).
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


class TestFeat235MobileCoreTabs(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._orig_env = {
            k: os.environ.get(k)
            for k in ("PTDTT_DATA_DIR", "PTDTT_LOG_DIR", "JWT_SECRET", "PTDTT_TESTING")
        }
        cls.tmp_root_obj = tempfile.TemporaryDirectory(prefix="ptdtt_feat235_suite_")
        cls.tmp_root = pathlib.Path(cls.tmp_root_obj.name)

        boot_dir = cls.tmp_root / "boot"
        (boot_dir / "data").mkdir(parents=True, exist_ok=True)
        (boot_dir / "logs").mkdir(parents=True, exist_ok=True)
        (boot_dir / "data" / "db.json").write_text("{}", encoding="utf-8")
        (boot_dir / "data" / "auth.json").write_text('{"users":{}}', encoding="utf-8")

        os.environ["PTDTT_DATA_DIR"] = str(boot_dir / "data")
        os.environ["PTDTT_LOG_DIR"] = str(boot_dir / "logs")
        os.environ["JWT_SECRET"] = "feat235-unit-test-secret-2026-ptdtt-mobile"
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
        shutil_src = REPO_ROOT / "data" / "procedure_catalog_2026_v1.json"
        if shutil_src.exists():
            (data_dir / "procedure_catalog_2026_v1.json").write_bytes(shutil_src.read_bytes())

        cls.src_db = json.loads((REPO_ROOT / "data" / "db.json").read_text(encoding="utf-8"))
        today_iso = _today_vn_iso(0)

        staff_list = copy.deepcopy(cls.src_db.get("staff") or [])
        for st in staff_list:
            if st.get("id") == 2:
                st["phone"] = "0909927154"
            elif st.get("id") == 12:
                st["phone"] = "12345"
            elif st.get("id") == 46:
                st["phone"] = ""

        statuses = list(copy.deepcopy(cls.src_db.get("staffStatuses") or []))
        statuses = [e for e in statuses if not (e.get("staffId") == 12 and e.get("date") == today_iso)]
        statuses.append({"staffId": 12, "date": today_iso, "status": "leave", "note": "Nghỉ phép test"})

        surgeries = []
        for s in (cls.src_db.get("surgeries") or [])[-20:]:
            sc = copy.deepcopy(s)
            for k in ("approval", "approvalAudit", "approvalStatus", "approvalRevision", "robotCaseId", "robotCaseCode", "lastJournalSeq", "lastAttributionSeq", "episodeId"):
                sc.pop(k, None)
            surgeries.append(sc)
        surgeries.extend([
            {
                "id": 9901,
                "date": today_iso,
                "patientName": "BN Test Trend 1",
                "type": "robot",
                "approachType": "robot",
                "surgeon": "Nguyễn Phú Hữu",
                "diagnosis": "K trực tràng",
                "procedure": "Cắt trước",
            },
            {
                "id": 9902,
                "date": _today_vn_iso(-32),
                "patientName": "BN Test Trend 2",
                "type": "yeucau",
                "approachType": "noisoi",
                "surgeon": "Vũ Khương An",
                "diagnosis": "K đại tràng Sigma",
                "procedure": "PT nội soi cắt ĐT Sigma",
            },
        ])

        cfg = copy.deepcopy(cls.eng.DEFAULT_SURGERY_APPROVAL_CONFIG)
        cfg["rolloutAccessMode"] = "all_staff"
        cfg["sandboxOnlyMode"] = False
        db_payload = {
            "_version": 12,
            "staff": staff_list,
            "departedStaff": copy.deepcopy(cls.src_db.get("departedStaff") or []),
            "rooms": copy.deepcopy(cls.src_db.get("rooms") or []),
            "externalDoctors": copy.deepcopy(cls.src_db.get("externalDoctors") or []),
            "staffStatuses": statuses,
            "plans": copy.deepcopy(cls.src_db.get("plans") or []),
            "schedules": copy.deepcopy(cls.src_db.get("schedules") or []),
            "reports7h": copy.deepcopy(cls.src_db.get("reports7h") or []),
            "reports16h": copy.deepcopy(cls.src_db.get("reports16h") or []),
            "surgeries": surgeries,
            "surgeriesTrash": [],
            "surgeriesArchivedInactive": [],
            "notifications": [],
            "approvalDelegations": [],
            "surgeryApprovalConfig": cfg,
            "nextIds": {"staff": 100, "surgeries": 10000, "notifications": 1},
            "_revisions": {"staff": 1, "staffStatuses": 1, "surgeries": 1, "surgeriesTrash": 1, "notifications": 1, "robotCases": 1},
        }
        data_file = data_dir / "db.json"
        data_file.write_text(json.dumps(db_payload, ensure_ascii=False, indent=2), encoding="utf-8")

        cls.pw_hash = cls.sf._hash_password("Feat235Strong2026")
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

        # Seed 2 Robot cases via live API so Robot Mobile cards render for '+' overlap test
        client = cls.sf.app.test_client()
        token = cls.sf._create_jwt("vkan", users["vkan"])
        for slot, name in (("Ca 1", "BN Robot Test 1"), ("Ca 2", "BN Robot Test 2")):
            client.post(
                "/api/robot/cases",
                headers={"Authorization": f"Bearer {token}", "X-Client-Build": cls.sw_build_ver, "Content-Type": "application/json"},
                json={"action": "create_case", "patientName": name, "phone": "0909927154", "mainSurgeonId": 2, "surgeryDate": today_iso, "caseSlot": slot},
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

    def _open_page(self, browser_name: str, width: int, height: int, username: str = "vkan", show_icon_guide: bool = False):
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
        dismiss_script = "" if show_icon_guide else "localStorage.setItem('ptdtt_icon_guide_v261121_dismissed', '1');"
        dismiss_script += "localStorage.setItem('ptdtt_robot_tutorial_v1_dismissed', '1');"
        ctx.add_init_script(
            f"""
            localStorage.setItem('ptdtt_cache_ver', '2609281105');
            localStorage.setItem('ptdtt_sw_build', {json.dumps(self.sw_build_ver)});
            localStorage.setItem('ptdtt_jwt', {json.dumps(token)});
            sessionStorage.setItem('ptdtt_jwt', {json.dumps(token)});
            localStorage.setItem('ptdtt_session', {json.dumps(json.dumps(session_obj, ensure_ascii=False))});
            sessionStorage.setItem('ptdtt_session', {json.dumps(json.dumps(session_obj, ensure_ascii=False))});
            localStorage.setItem('ptdtt_onboarding_done', 'true');
            localStorage.setItem('ptdtt_theme', 'light');
            {dismiss_script}
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
            "() => Boolean(typeof Store !== 'undefined' && Store._hasLoadedServerOnce === true && document.getElementById('dashboard-page'))",
            timeout=12000,
        )
        return ctx, page, console_errs, page_errs

    def _measure_overflow(self, page):
        return page.evaluate(
            """() => {
                const vw = window.innerWidth;
                const docOv = document.documentElement.scrollWidth - vw;
                const bodyOv = document.body.scrollWidth - vw;
                const mc = document.getElementById('main-content');
                const mcOv = mc ? (mc.scrollWidth - mc.clientWidth) : 0;
                const overlay = document.getElementById('modal-overlay');
                const modal = document.getElementById('modal');
                const mb = document.getElementById('modal-body');
                const modalOpen = Boolean(overlay && overlay.classList.contains('active'));
                const modalOv = (modalOpen && modal) ? (modal.scrollWidth - modal.clientWidth) : 0;
                const mbOv = (modalOpen && mb) ? (mb.scrollWidth - mb.clientWidth) : 0;
                let maxRight = 0;
                for (const sel of ['#dashboard-page', '#staff-tracking-page', '#rooms-page-container', '#robot-schedule-page', '#feat235-neg-probe']) {
                    const el = document.querySelector(sel);
                    if (el) {
                        const r = el.getBoundingClientRect();
                        if (r.width > 0) maxRight = Math.max(maxRight, Math.round(r.right - vw));
                    }
                }
                return {
                    docOv, bodyOv, mcOv, modalOv, mbOv, maxRight,
                    worst: Math.max(docOv, bodyOv, mcOv, modalOv, mbOv, maxRight)
                };
            }"""
        )

    def test_01_mobile_viewports_overflow_theme_and_probe(self):
        """Zero horizontal overflow across 360x800, 390x844, 600x900 (Chromium) & 390x844 WebKit Light/Dark + Negative Probe."""
        matrix = [
            ("chromium", 360, 800),
            ("chromium", 390, 844),
            ("chromium", 600, 900),
            ("webkit", 390, 844),
        ]
        for engine, w, h in matrix:
            with self.subTest(engine=engine, width=w, height=h):
                ctx, page, console_errs, page_errs = self._open_page(engine, w, h, "vkan")
                try:
                    for nav_id, root_sel in [
                        ("#nav-dashboard", "#dashboard-page"),
                        ("#nav-staff-tracking", "#staff-tracking-page"),
                        ("#nav-rooms", "#rooms-page-container"),
                        ("#nav-robot-schedule", "#robot-schedule-page"),
                    ]:
                        page.click(nav_id)
                        page.wait_for_selector(root_sel, timeout=6000)
                        for theme in ("light", "dark"):
                            page.evaluate(f"() => document.documentElement.setAttribute('data-theme', '{theme}')")
                            ov = self._measure_overflow(page)
                            self.assertLessEqual(ov["worst"], 0, f"{engine} {w}x{h} {nav_id} {theme} overflow: {ov}")
                        if nav_id == "#nav-dashboard":
                            page.click('.dash-mobile-tab-btn[data-dash-tab="analytics"]')
                            page.wait_for_function("() => { const c = document.getElementById('trend-chart'); return c && c.width > 100; }", timeout=4000)
                            wrap_w = page.evaluate("() => document.getElementById('trend-chart-wrap')?.getBoundingClientRect().width || 9999")
                            self.assertLessEqual(wrap_w, w, f"{engine} {w}x{h} analytics chart wrap blew past viewport: {wrap_w}")
                            ov_an = self._measure_overflow(page)
                            self.assertLessEqual(ov_an["worst"], 0, f"{engine} {w}x{h} dashboard analytics overflow: {ov_an}")
                            page.click('.dash-mobile-tab-btn[data-dash-tab="today"]')
                        if theme == "dark":
                            bg = page.evaluate("() => getComputedStyle(document.body).backgroundColor")
                            self.assertIn("12, 16, 34", bg, f"Expected #0C1022 Dark Mode body bg, got {bg}")
                        page.evaluate("() => document.documentElement.setAttribute('data-theme', 'light')")

                    # Negative Overflow Probe: inject forced 600px element on 360/390 viewport and assert detection
                    if w < 600:
                        page.click("#nav-rooms")
                        page.wait_for_selector("#rooms-page-container", timeout=4000)
                        page.evaluate("() => { const p = document.createElement('div'); p.id='feat235-neg-probe'; p.style.cssText='width:650px;min-width:650px;height:10px;'; document.getElementById('rooms-page-container').appendChild(p); }")
                        probe_ov = self._measure_overflow(page)
                        self.assertGreater(probe_ov["worst"], 100)
                        page.evaluate("() => document.getElementById('feat235-neg-probe')?.remove()")

                    self.assertEqual(console_errs, [], f"Console errors on {engine} {w}x{h}: {console_errs}")
                    self.assertEqual(page_errs, [], f"Page errors on {engine} {w}x{h}: {page_errs}")
                finally:
                    ctx.close()

    def test_02_dashboard_mobile_subtabs_kpi_shortcuts_chart_and_desktop(self):
        """Dashboard Mobile 2 sub-views, 4 KPI nav, Quick Shortcuts, Touch Tooltip Clamp, toggleSeries data-series & Desktop unchanged."""
        ctx, page, console_errs, page_errs = self._open_page("chromium", 390, 844, "vkan")
        try:
            # 1) Default mobile tab is 'today': KPIs + duty (2 stacked cards, no 'Hoạt động sắp tới') + bed-flow visible, trend chart hidden
            self.assertEqual(page.locator("#dashboard-page").get_attribute("data-mobile-tab"), "today")
            self.assertTrue(page.locator(".dash-mobile-tabs").is_visible())
            self.assertTrue(page.locator(".dash-quick-shortcuts").is_visible())
            self.assertTrue(page.locator("#dashboard-page .bed-flow-widget").is_visible())
            self.assertFalse(page.locator("#dashboard-page .trend-chart-card").is_visible())
            self.assertFalse(page.locator("#dashboard-page .mis-widget").is_visible())

            self.assertNotIn("Hoạt động sắp tới", page.locator("#dashboard-page").inner_text())
            m_duty_cards = page.locator("#dashboard-page .duty-grid > .widget-card")
            self.assertEqual(m_duty_cards.count(), 2)
            mbox1 = m_duty_cards.nth(0).bounding_box()
            mbox2 = m_duty_cards.nth(1).bounding_box()
            self.assertGreaterEqual(mbox2["y"], mbox1["y"] + mbox1["height"] - 2)
            self.assertLessEqual(abs(mbox1["width"] - mbox2["width"]), 2)
            self.assertLessEqual(
                page.evaluate("() => document.documentElement.scrollWidth"),
                page.evaluate("() => window.innerWidth"),
            )

            hdr_h = page.locator("#dashboard-page > .page-header").bounding_box()["height"]
            self.assertLessEqual(hdr_h, 80, f"Compact Navy-Ocean header too tall: {hdr_h}")

            # 2) All 4 KPI cards tap-to-navigate + shortcuts work cleanly
            for target_page in ("staff-tracking", "reports", "surgery", "plans"):
                page.click(f'#dashboard-page .stat-card[data-dash-nav="{target_page}"]')
                page.wait_for_function(f"() => App.currentPage === '{target_page}'", timeout=4000)
                page.click("#nav-dashboard")
                page.wait_for_selector("#dashboard-page", timeout=4000)

            for sc_page in ("robot-schedule", "rooms", "schedule"):
                page.click(f'#dashboard-page .dash-shortcut-pill[data-dash-shortcut="{sc_page}"]')
                page.wait_for_function(f"() => App.currentPage === '{sc_page}'", timeout=4000)
                page.click("#nav-dashboard")
                page.wait_for_selector("#dashboard-page", timeout=4000)

            # 3) Switch to 'analytics' sub-view -> rAF redraws canvas (>0 size), tooltip clamped inside wrap, toggleSeries uses data-series
            page.click('.dash-mobile-tab-btn[data-dash-tab="analytics"]')
            page.wait_for_function("() => document.getElementById('dashboard-page')?.getAttribute('data-mobile-tab') === 'analytics'", timeout=4000)
            page.wait_for_function(
                "() => { const c = document.getElementById('trend-chart'); return c && c.width > 200 && c.height > 100; }",
                timeout=4000,
            )
            self.assertTrue(page.locator("#dashboard-page .trend-chart-card").is_visible())
            self.assertTrue(page.locator("#dashboard-page .mis-widget").is_visible())
            self.assertFalse(page.locator("#dashboard-page .bed-flow-widget").is_visible())

            # Click rightmost bar area -> tooltip becomes visible and stays inside #trend-chart-wrap (anti-grid-blowout check)
            wrap_box = page.locator("#trend-chart-wrap").bounding_box()
            self.assertLessEqual(wrap_box["width"], 390, f"#trend-chart-wrap blew out viewport: {wrap_box['width']}")
            page.locator("#trend-chart").click(position={"x": int(wrap_box["width"] - 28), "y": int(wrap_box["height"] / 2)})
            page.wait_for_selector("#trend-tooltip.visible", timeout=3000)
            tip_box = page.locator("#trend-tooltip").bounding_box()
            self.assertGreaterEqual(tip_box["x"], wrap_box["x"] - 1)
            self.assertLessEqual(tip_box["x"] + tip_box["width"], wrap_box["x"] + wrap_box["width"] + 1)

            # Toggle series via data-series attribute (fixed Vietnamese mismatch)
            page.click('.trend-legend-item[data-series="yeucau"]')
            self.assertTrue(page.locator('.trend-legend-item[data-series="yeucau"]').evaluate("el => el.classList.contains('inactive')"))
            page.click('.trend-legend-item[data-series="yeucau"]')
            self.assertFalse(page.locator('.trend-legend-item[data-series="yeucau"]').evaluate("el => el.classList.contains('inactive')"))

            self.assertEqual(console_errs, [])
            self.assertEqual(page_errs, [])
        finally:
            ctx.close()

        # Non-approval normal user does NOT see 'Duyệt mổ' shortcut when hidden by canary/RBAC
        ctx_u, upage, _, _ = self._open_page("chromium", 390, 844, "vnatuan")
        try:
            can_see = upage.evaluate("() => typeof SurgeryApprovalPage !== 'undefined' && SurgeryApprovalPage.isFeatureVisibleForCurrentUser()")
            self.assertEqual(upage.locator('[data-dash-shortcut="surgery-approval"]').count(), 1 if can_see else 0)
        finally:
            ctx_u.close()

        # Desktop 1440x900 & Laptop 1024x768 keep 2 balanced side-by-side .duty-grid cards without 'Hoạt động sắp tới'
        for vp_w, vp_h in ((1440, 900), (1024, 768)):
            ctx_d, dpage, _, _ = self._open_page("chromium", vp_w, vp_h, "vkan")
            try:
                self.assertFalse(dpage.locator(".dash-mobile-tabs").is_visible())
                self.assertFalse(dpage.locator(".dash-quick-shortcuts").is_visible())
                self.assertTrue(dpage.locator("#dashboard-page .stats-grid").is_visible())
                self.assertTrue(dpage.locator("#dashboard-page .trend-chart-card").is_visible())
                self.assertTrue(dpage.locator("#dashboard-page .bed-flow-widget").is_visible())
                self.assertTrue(dpage.locator("#dashboard-page .duty-grid").is_visible())
                self.assertNotIn("Hoạt động sắp tới", dpage.locator("#dashboard-page").inner_text())

                duty_cards = dpage.locator("#dashboard-page .duty-grid > .widget-card")
                self.assertEqual(duty_cards.count(), 2)
                box1 = duty_cards.nth(0).bounding_box()
                box2 = duty_cards.nth(1).bounding_box()
                self.assertLessEqual(abs(box1["y"] - box2["y"]), 2)
                self.assertLessEqual(abs(box1["width"] - box2["width"]), 2)
                self.assertGreater(box2["x"], box1["x"] + box1["width"])
                self.assertLessEqual(
                    dpage.evaluate("() => document.documentElement.scrollWidth"),
                    dpage.evaluate("() => window.innerWidth"),
                )
            finally:
                ctx_d.close()

    def test_03_staff_tracking_mobile_day_view_bottom_sheet_and_desktop(self):
        """Staff Tracking defaults to 'Theo ngày' on Mobile, preserves grid view + Desktop, Bottom Sheet 5 buttons & 4 range chips work."""
        ctx, page, console_errs, page_errs = self._open_page("webkit", 390, 844, "vkan")
        try:
            page.click("#nav-staff-tracking")
            page.wait_for_selector("#staff-tracking-page", timeout=5000)

            self.assertEqual(page.locator("#staff-tracking-page").get_attribute("data-mobile-view"), "day")
            self.assertTrue(page.locator(".st-mobile-day-view").is_visible())
            self.assertFalse(page.locator("#staff-tracking-page .st-grid-card").is_visible())
            self.assertEqual(page.locator("#staff-tracking-page .st-day-pill").count(), 7)

            # Toggle 'Chỉ xem người vắng'
            page.click('[data-st-only-absent="1"]')
            page.wait_for_function("() => StaffTrackingPage.onlyAbsent === true", timeout=3000)
            absent_count = page.locator("#st-mobile-cards-container .st-mcard").count()
            self.assertGreaterEqual(absent_count, 1)
            page.click('[data-st-only-absent="1"]')
            all_count = page.locator("#st-mobile-cards-container .st-mcard").count()
            self.assertGreater(all_count, absent_count)

            # Expand search bar & type without losing input focus
            page.click('[data-st-action="toggle-search"]')
            page.wait_for_selector("#st-mobile-search-input", timeout=3000)
            page.focus("#st-mobile-search-input")
            page.type("#st-mobile-search-input", "an")
            self.assertEqual(page.evaluate("() => document.activeElement?.id"), "st-mobile-search-input")
            self.assertLess(page.locator("#st-mobile-cards-container .st-mcard").count(), all_count)
            page.click(".st-mobile-search-clear")

            # Admin taps absent item directly in Today Summary -> Bottom Sheet openDayStatus
            page.locator(".st-absent-item-editable").first.click()
            page.wait_for_selector("#st-day-status-form", timeout=4000)

            sheet_geom = page.evaluate(
                """() => {
                    const activeBtn = document.querySelector('#st-day-status-form .st-btn-active')?.getBoundingClientRect();
                    const leaveBtn = document.querySelector('#st-day-status-form .st-btn-leave')?.getBoundingClientRect();
                    const allBtns = [...document.querySelectorAll('#st-day-status-form .st-quick-status-btn')];
                    const dateInputs = [...document.querySelectorAll('#st-day-status-form input[type="date"]')];
                    return {
                        btnCount: allBtns.length,
                        minBtnH: Math.min(...allBtns.map(b => Math.round(b.getBoundingClientRect().height))),
                        activeLabel: document.querySelector('#st-day-status-form .st-btn-active .st-status-text')?.textContent?.trim(),
                        activeW: activeBtn ? Math.round(activeBtn.width) : 0,
                        leaveW: leaveBtn ? Math.round(leaveBtn.width) : 0,
                        dateFontMin: Math.min(...dateInputs.map(i => parseFloat(getComputedStyle(i).fontSize))),
                        rangeChipCount: document.querySelectorAll('#st-day-status-form .st-range-chip').length,
                    };
                }"""
            )
            self.assertEqual(sheet_geom["btnCount"], 5)
            self.assertGreaterEqual(sheet_geom["minBtnH"], 48)
            self.assertEqual(sheet_geom["activeLabel"], "Có mặt")
            self.assertGreater(sheet_geom["activeW"], sheet_geom["leaveW"] * 1.6)
            self.assertGreaterEqual(sheet_geom["dateFontMin"], 16)
            self.assertEqual(sheet_geom["rangeChipCount"], 4)

            # Test quick range chips ('2 ngày' = +1 day from fromDate) & .kb-open zero overflow
            page.click('#st-day-status-form [data-st-status-btn="business"]')
            page.click('#st-day-status-form .st-range-chip[data-st-range="2d"]')
            from_val = page.locator("#tracking-from-date").input_value()
            to_val = page.locator("#tracking-to-date").input_value()
            expected_to = (datetime.fromisoformat(from_val).date() + timedelta(days=1)).isoformat()
            self.assertEqual(to_val, expected_to)

            page.evaluate("() => document.getElementById('modal-overlay').classList.add('kb-open')")
            self.assertLessEqual(self._measure_overflow(page)["worst"], 0)
            page.evaluate("() => document.getElementById('modal-overlay').classList.remove('kb-open')")

            page.fill("#tracking-note-input", "Hội thảo robot")
            page.click('#st-day-status-form button[type="submit"]')
            page.wait_for_function("() => !document.getElementById('modal-overlay').classList.contains('active')", timeout=4000)

            # Switch to Grid view mode
            page.click('.st-mobile-mode-btn[data-st-mode="grid"]')
            self.assertTrue(page.locator("#staff-tracking-page .st-grid-card .st-table").is_visible())

            self.assertEqual(console_errs, [])
            self.assertEqual(page_errs, [])
        finally:
            ctx.close()

        # Desktop 1440x900 preserves week/month table grid
        ctx_d, dpage, _, _ = self._open_page("chromium", 1440, 900, "vkan")
        try:
            dpage.click("#nav-staff-tracking")
            dpage.wait_for_selector("#staff-tracking-page", timeout=5000)
            self.assertFalse(dpage.locator(".st-mobile-day-view").is_visible())
            self.assertFalse(dpage.locator(".st-mobile-mode-bar").is_visible())
            self.assertTrue(dpage.locator("#staff-tracking-page .st-grid-card .st-table").is_visible())
        finally:
            ctx_d.close()

    def test_04_rooms_mobile_and_desktop_pod_search_absent_call_and_export(self):
        """Rooms POD pills (11/2/6/3), search focus preservation, absent badge, tel >= 9 digits guard, export all 11 rooms & Desktop parity."""
        for engine, w, h, expect_mobile in (("chromium", 390, 844, True), ("chromium", 1440, 900, False)):
            with self.subTest(engine=engine, width=w, height=h):
                ctx, page, console_errs, page_errs = self._open_page(engine, w, h, "vkan")
                try:
                    page.click("#nav-rooms")
                    page.wait_for_selector("#rooms-page-container", timeout=5000)

                    # All 11 rooms & 4 POD pills rendered
                    self.assertEqual(page.locator("#rooms-page-container .rm-pod-pill").count(), 4)
                    self.assertEqual(page.locator("#rooms-page-container .room-card").count(), 11)

                    # Mobile vs Desktop specifics: legend default open/collapsed & 1-column cards on Mobile
                    legend_open = page.evaluate("() => Boolean(document.getElementById('rm-legend-details')?.open)")
                    if expect_mobile:
                        self.assertFalse(legend_open)
                        cols = page.evaluate("() => getComputedStyle(document.querySelector('#rooms-page-container .rooms-grid')).gridTemplateColumns.trim().split(/\\s+/).length")
                        self.assertEqual(cols, 1, "Mobile Rooms grid must be 1-column")
                    else:
                        self.assertTrue(legend_open)
                        self.assertTrue(page.locator("#rooms-search-input").is_visible())

                    # Filter POD 1 -> 2 rooms, POD 2 -> 6 rooms, POD 3 -> 3 rooms
                    for pod_id, expected_cnt in ((1, 2), (2, 6), (3, 3)):
                        page.click(f'#rooms-page-container .rm-pod-pill[data-pod="{pod_id}"]')
                        self.assertEqual(page.locator("#rooms-page-container .room-card").count(), expected_cnt)
                    page.click('#rooms-page-container .rm-pod-pill[data-pod="all"]')
                    self.assertEqual(page.locator("#rooms-page-container .room-card").count(), 11)

                    # Search by room number & doctor name without losing focus
                    if expect_mobile:
                        page.click("#rooms-mobile-search-toggle")
                        page.wait_for_selector("#rooms-search-input", timeout=3000)
                    page.focus("#rooms-search-input")
                    page.type("#rooms-search-input", "712A")
                    self.assertEqual(page.evaluate("() => document.activeElement?.id"), "rooms-search-input")
                    self.assertEqual(page.locator("#rooms-page-container .room-card").count(), 1)
                    self.assertIn("B712A", page.inner_text("#rooms-pod-content"))
                    page.click("#rooms-search-clear")
                    self.assertEqual(page.locator("#rooms-page-container .room-card").count(), 11)

                    # Verify absent badge appears on P718 & opening detail modal checks tel >= 9 digits
                    p718_card = page.locator('#rooms-page-container .room-card[data-room="718"]')
                    self.assertGreaterEqual(p718_card.locator(".room-doc-absent-badge").count(), 1)
                    p718_card.click()
                    page.wait_for_selector("#rm-detail-modal", timeout=4000)

                    # staff id=2 has 10-digit phone ('0909927154') -> 1 tel link; staff id=12 ('12345' <9 digits) & id=46 ('') -> omitted
                    tel_links = page.locator('#rm-detail-modal a.rm-call-btn[href^="tel:"]')
                    self.assertEqual(tel_links.count(), 1)
                    self.assertEqual(tel_links.first.get_attribute("href"), "tel:0909927154")
                    self.assertEqual(page.locator('#rm-detail-modal a[href*="12345"]').count(), 0)
                    page.evaluate("() => Modal.close(true)")

                    # Export guard: even when filtered to POD 1 (2 cards in DOM), _buildExportHtml generates ALL 11 rooms
                    page.click('#rooms-page-container .rm-pod-pill[data-pod="1"]')
                    self.assertEqual(page.locator("#rooms-page-container .room-card").count(), 2)
                    exported_rooms_cnt = page.evaluate(
                        """() => {
                            const html = RoomsPage._buildExportHtml('21/11/2026');
                            const matches = html.match(/class="room-number">B[0-9A-Z]+/g) || [];
                            return matches.length;
                        }"""
                    )
                    self.assertEqual(exported_rooms_cnt, 11, f"Exported HTML should contain all 11 rooms, got {exported_rooms_cnt}")

                    self.assertEqual(console_errs, [])
                    self.assertEqual(page_errs, [])
                finally:
                    ctx.close()

    def test_05_robot_plus_button_in_header_no_card_overlap(self):
        """Robot #rbt-mobile-fab sits inline inside .rbt-mobile-hdr-tools on 360x800 & 390x844 WebKit, never overlapping ••• buttons."""
        for engine, w, h in (("chromium", 360, 800), ("webkit", 390, 844)):
            with self.subTest(engine=engine, width=w, height=h):
                ctx, page, console_errs, page_errs = self._open_page(engine, w, h, "vkan")
                try:
                    page.click("#nav-robot-schedule")
                    page.wait_for_selector("#robot-schedule-page .rbt-header", timeout=6000)

                    check = page.evaluate(
                        """() => {
                            const fab = document.getElementById('rbt-mobile-fab');
                            const tools = document.querySelector('.rbt-mobile-hdr-tools');
                            const hdr = document.querySelector('#robot-schedule-page .rbt-header');
                            const fRect = fab ? fab.getBoundingClientRect() : null;
                            const hdrRect = hdr ? hdr.getBoundingClientRect() : null;
                            const moreBtns = [...document.querySelectorAll('#robot-schedule-page .rbt-btn-more, #robot-schedule-page .rbt-mobile-more')];
                            let anyOverlap = false;
                            if (fRect) {
                                for (const b of moreBtns) {
                                    const br = b.getBoundingClientRect();
                                    if (br.width <= 0 || br.height <= 0) continue;
                                    const overlapX = fRect.left < br.right && fRect.right > br.left;
                                    const overlapY = fRect.top < br.bottom && fRect.bottom > br.top;
                                    if (overlapX && overlapY) anyOverlap = true;
                                }
                            }
                            return {
                                exists: Boolean(fab),
                                inHeaderTools: Boolean(fab && tools && tools.contains(fab)),
                                pos: fab ? getComputedStyle(fab).position : null,
                                fabW: fRect ? Math.round(fRect.width) : 0,
                                fabH: fRect ? Math.round(fRect.height) : 0,
                                hdrH: hdrRect ? Math.round(hdrRect.height) : 0,
                                anyOverlap,
                            };
                        }"""
                    )
                    self.assertTrue(check["exists"])
                    self.assertTrue(check["inHeaderTools"], "#rbt-mobile-fab must be inside .rbt-mobile-hdr-tools")
                    self.assertNotEqual(check["pos"], "fixed")
                    self.assertGreaterEqual(check["fabW"], 44)
                    self.assertGreaterEqual(check["fabH"], 44)
                    self.assertLessEqual(check["hdrH"], 85)
                    self.assertFalse(check["anyOverlap"])
                    self.assertEqual(console_errs, [])
                    self.assertEqual(page_errs, [])
                finally:
                    ctx.close()

    def test_06_mobile_icon_only_nav_14_duotone_icons_order_and_tooltip(self):
        """FEAT-237: Icon-only Mobile bottom nav, 14 unique Medical Duotone icons, synced clinical-first order, dynamic Mobile header & 350ms long-press tooltip."""
        expected_order = [
            "nav-dashboard",
            "nav-surgery",
            "nav-robot-schedule",
            "nav-surgery-approval",
            "nav-rooms",
            "nav-reports",
            "nav-staff-tracking",
            "nav-schedule",
            "nav-staff",
            "nav-plans",
            "nav-surgery-stats",
            "nav-research",
            "nav-conferences",
            "nav-nckh",
        ]

        # 1) Mobile viewports: Chromium 360x800 (Android) + WebKit 390x844 Light & Dark #0C1022
        for engine, w, h, dark in (
            ("chromium", 360, 800, False),
            ("webkit", 390, 844, False),
            ("webkit", 390, 844, True),
        ):
            with self.subTest(engine=engine, width=w, height=h, dark=dark):
                ctx, page, console_errs, page_errs = self._open_page(engine, w, h, "vkan")
                try:
                    if dark:
                        page.evaluate("() => document.documentElement.setAttribute('data-theme', 'dark')")
                    nav_audit = page.evaluate(
                        """() => {
                            const items = [...document.querySelectorAll('.sidebar-nav .nav-item')]
                                .filter(el => el.id !== 'nav-patients' && el.id !== 'nav-tasks');
                            const ids = items.map(el => el.id);
                            const spanDisplays = items.map(el => {
                                const sp = el.querySelector('span');
                                return sp ? getComputedStyle(sp).display : null;
                            });
                            const svgData = items.map(el => {
                                const svg = el.querySelector('svg');
                                const r = svg ? svg.getBoundingClientRect() : null;
                                return {
                                    hasNavIconClass: Boolean(svg && svg.classList.contains('nav-icon')),
                                    hasDuotoneFill: Boolean(svg && svg.querySelector('.ni-fill')),
                                    shape: svg ? svg.innerHTML.replace(/\\s+/g, ' ').trim() : '',
                                    w: r ? Math.round(r.width) : 0,
                                    h: r ? Math.round(r.height) : 0,
                                };
                            });
                            const rects = items.map(el => {
                                const r = el.getBoundingClientRect();
                                return { id: el.id, w: Math.round(r.width), h: Math.round(r.height), right: r.right, left: r.left };
                            });
                            const visibleInFirstScreen = rects.filter(r => r.left >= -1 && r.right <= window.innerWidth + 1).length;
                            const activeEl = document.querySelector('.sidebar-nav .nav-item.active');
                            return {
                                ids,
                                anyHref: items.some(el => el.hasAttribute('href')),
                                allAriaLabels: items.every(el => Boolean((el.getAttribute('aria-label') || '').trim())),
                                allTitles: items.every(el => Boolean((el.getAttribute('title') || '').trim())),
                                spanDisplays,
                                svgCount: svgData.length,
                                uniqueShapes: new Set(svgData.map(s => s.shape)).size,
                                allHaveNavIconClass: svgData.every(s => s.hasNavIconClass),
                                allHaveDuotone: svgData.every(s => s.hasDuotoneFill),
                                minSvgW: Math.min(...svgData.map(s => s.w)),
                                minSvgH: Math.min(...svgData.map(s => s.h)),
                                minTouchW: Math.min(...rects.map(r => r.w)),
                                minTouchH: Math.min(...rects.map(r => r.h)),
                                visibleInFirstScreen,
                                activeBoxShadow: activeEl ? getComputedStyle(activeEl).boxShadow : null,
                                initialHeaderTitle: document.getElementById('mobile-header-title')?.textContent?.trim(),
                                scrollWidth: document.documentElement.scrollWidth,
                                innerWidth: window.innerWidth,
                            };
                        }"""
                    )
                    self.assertEqual(nav_audit["ids"], expected_order)
                    self.assertFalse(nav_audit["anyHref"], "Nav items must use role=button without href=#")
                    self.assertTrue(nav_audit["allAriaLabels"])
                    self.assertTrue(nav_audit["allTitles"])
                    self.assertTrue(all(d == "none" for d in nav_audit["spanDisplays"]), f"Expected all spans hidden: {nav_audit['spanDisplays']}")
                    self.assertEqual(nav_audit["svgCount"], 14)
                    self.assertEqual(nav_audit["uniqueShapes"], 14, "All 14 tabs must have distinct SVG icons")
                    self.assertTrue(nav_audit["allHaveNavIconClass"])
                    self.assertTrue(nav_audit["allHaveDuotone"])
                    self.assertGreaterEqual(nav_audit["minSvgW"], 22)
                    self.assertGreaterEqual(nav_audit["minSvgH"], 22)
                    self.assertGreaterEqual(nav_audit["minTouchW"], 44)
                    self.assertGreaterEqual(nav_audit["minTouchH"], 44)
                    self.assertGreaterEqual(nav_audit["visibleInFirstScreen"], 7)
                    self.assertEqual(nav_audit["activeBoxShadow"], "none", "Desktop green left-border must NOT bleed onto Mobile")
                    self.assertEqual(nav_audit["initialHeaderTitle"], "Tổng quan")
                    self.assertLessEqual(nav_audit["scrollWidth"], nav_audit["innerWidth"])

                    # Clicking tabs updates #mobile-header-title dynamically
                    for nav_sel, exp_page, exp_title in (
                        ("#nav-robot-schedule", "robot-schedule", "Điều phối Robot"),
                        ("#nav-rooms", "rooms", "Phòng bệnh"),
                        ("#nav-reports", "reports", "Báo cáo"),
                    ):
                        page.click(nav_sel)
                        page.wait_for_function(f"() => App.currentPage === '{exp_page}'", timeout=4000)
                        self.assertEqual(page.locator("#mobile-header-title").inner_text().strip(), exp_title)

                    # Long-press (350ms) on #nav-rooms shows clamped #mobile-nav-tooltip & suppresses click navigation
                    rooms_box = page.locator("#nav-rooms").bounding_box()
                    cx = rooms_box["x"] + rooms_box["width"] / 2
                    cy = rooms_box["y"] + rooms_box["height"] / 2
                    page.locator("#nav-rooms").dispatch_event("pointerdown", {"button": 0, "clientX": cx, "clientY": cy})
                    page.wait_for_selector("#mobile-nav-tooltip.is-visible", timeout=2000)
                    tip_state = page.evaluate(
                        """() => {
                            const tip = document.getElementById('mobile-nav-tooltip');
                            const r = tip ? tip.getBoundingClientRect() : null;
                            return {
                                text: tip ? tip.textContent.trim() : '',
                                left: r ? r.left : -1,
                                right: r ? r.right : 9999,
                                top: r ? r.top : -1,
                                innerWidth: window.innerWidth,
                            };
                        }"""
                    )
                    self.assertEqual(tip_state["text"], "Phòng bệnh")
                    self.assertGreaterEqual(tip_state["left"], 8 - 1)
                    self.assertLessEqual(tip_state["right"], tip_state["innerWidth"] - 8 + 1)
                    self.assertGreaterEqual(tip_state["top"], 8 - 1)

                    page.locator("#nav-rooms").dispatch_event("pointerup", {"button": 0, "clientX": cx, "clientY": cy})
                    page.locator("#nav-rooms").dispatch_event("click")
                    self.assertEqual(page.evaluate("() => App.currentPage"), "reports", "Long-press release click must NOT navigate accidentally")

                    self.assertEqual(console_errs, [])
                    self.assertEqual(page_errs, [])
                finally:
                    ctx.close()

        # 2) Desktop 1440x900 keeps full labels visible + synced 14-tab clinical-first order + 14 Duotone icons
        ctx_d, dpage, console_d, page_d = self._open_page("chromium", 1440, 900, "vkan")
        try:
            desk = dpage.evaluate(
                """() => {
                    const items = [...document.querySelectorAll('.sidebar-nav .nav-item')]
                        .filter(el => el.id !== 'nav-patients' && el.id !== 'nav-tasks');
                    const labelsVisible = items.every(el => {
                        const sp = el.querySelector('span');
                        return sp && getComputedStyle(sp).display !== 'none';
                    });
                    return {
                        ids: items.map(el => el.id),
                        labelsVisible,
                        duotoneCount: items.filter(el => el.querySelector('svg.nav-icon .ni-fill')).length,
                    };
                }"""
            )
            self.assertEqual(desk["ids"], expected_order)
            self.assertTrue(desk["labelsVisible"], "Desktop sidebar must keep all tab text labels visible")
            self.assertEqual(desk["duotoneCount"], 14)
            self.assertEqual(console_d, [])
            self.assertEqual(page_d, [])
        finally:
            ctx_d.close()

    def test_07_icon_guide_announcement_one_week_modal(self):
        """FEAT-238: 1-week login notice (21/11–28/11/2026) auto-opens, clones Duotone icons per RBAC, fits 360x800/WebKit/Desktop cleanly, user self-dismisses."""
        # 1) SuperAdmin on Mobile 360x800 (Chromium) & 390x844 (WebKit Dark #0C1022) & Desktop 1440x900
        for engine, w, h, dark in (
            ("chromium", 360, 800, False),
            ("webkit", 390, 844, True),
            ("chromium", 1440, 900, False),
        ):
            with self.subTest(engine=engine, width=w, height=h, dark=dark):
                ctx, page, console_errs, page_errs = self._open_page(engine, w, h, "vkan", show_icon_guide=True)
                try:
                    if dark:
                        page.evaluate("() => document.documentElement.setAttribute('data-theme', 'dark')")
                    page.wait_for_selector("#icon-guide-overlay .ig-dialog", timeout=3500)

                    audit = page.evaluate(
                        """() => {
                            const dlg = document.querySelector('#icon-guide-overlay .ig-dialog');
                            const r = dlg ? dlg.getBoundingClientRect() : null;
                            const items = [...document.querySelectorAll('#icon-guide-overlay .ig-item')];
                            const btns = [...document.querySelectorAll('#icon-guide-overlay .ig-btn')];
                            return {
                                left: r ? r.left : -1,
                                right: r ? r.right : 9999,
                                top: r ? r.top : -1,
                                height: r ? r.height : 9999,
                                innerWidth: window.innerWidth,
                                innerHeight: window.innerHeight,
                                scrollWidth: document.documentElement.scrollWidth,
                                itemCount: items.length,
                                allHaveSvgFill: items.every(it => Boolean(it.querySelector('.ig-icon-badge svg.nav-icon .ni-fill'))),
                                allHaveText: items.every(it => Boolean((it.querySelector('.ig-name')?.textContent || '').trim()) && Boolean((it.querySelector('.ig-desc')?.textContent || '').trim())),
                                minBtnH: btns.length ? Math.min(...btns.map(b => Math.round(b.getBoundingClientRect().height))) : 0,
                                withinNov28: IconGuideNotice.isWithinWindow(new Date('2026-11-28T23:59:59+07:00')),
                                expiredNov29: IconGuideNotice.isWithinWindow(new Date('2026-11-29T00:00:00+07:00')),
                            };
                        }"""
                    )
                    self.assertGreaterEqual(audit["left"], 0)
                    self.assertLessEqual(audit["right"], audit["innerWidth"] + 1)
                    self.assertGreaterEqual(audit["top"], 0)
                    self.assertLessEqual(audit["height"], audit["innerHeight"])
                    self.assertLessEqual(audit["scrollWidth"], audit["innerWidth"])
                    self.assertEqual(audit["itemCount"], 14)
                    self.assertTrue(audit["allHaveSvgFill"])
                    self.assertTrue(audit["allHaveText"])
                    self.assertGreaterEqual(audit["minBtnH"], 44)
                    self.assertTrue(audit["withinNov28"])
                    self.assertFalse(audit["expiredNov29"])

                    # Clicking 'Đóng' dismisses for current session only
                    page.click("#ig-btn-close")
                    self.assertEqual(page.locator("#icon-guide-overlay").count(), 0)
                    self.assertFalse(page.evaluate("() => IconGuideNotice.shouldShow()"))
                    page.evaluate("() => IconGuideNotice.clearSessionDismiss()")
                    self.assertTrue(page.evaluate("() => IconGuideNotice.shouldShow()"))

                    # Reopen & click 'Đã hiểu, không hiện lại' -> persists across reload
                    self.assertTrue(page.evaluate("() => IconGuideNotice.open()"))
                    page.wait_for_selector("#icon-guide-overlay", timeout=2000)
                    page.click("#ig-btn-dismiss")
                    self.assertEqual(page.locator("#icon-guide-overlay").count(), 0)
                    self.assertFalse(page.evaluate("() => { IconGuideNotice.clearSessionDismiss(); return IconGuideNotice.shouldShow(); }"))

                    page.reload(wait_until="load")
                    page.wait_for_function(
                        "() => Boolean(typeof Store !== 'undefined' && Store._hasLoadedServerOnce === true && document.getElementById('dashboard-page'))",
                        timeout=12000,
                    )
                    page.wait_for_timeout(600)
                    self.assertEqual(page.locator("#icon-guide-overlay").count(), 0)

                    self.assertEqual(console_errs, [])
                    self.assertEqual(page_errs, [])
                finally:
                    ctx.close()

        # 2) RBAC isolation: normal user 'vnatuan' must NOT see Admin-only tabs (surgery-stats, nckh)
        ctx_u, upage, u_c_errs, u_p_errs = self._open_page("chromium", 390, 844, "vnatuan", show_icon_guide=True)
        try:
            upage.wait_for_selector("#icon-guide-overlay .ig-dialog", timeout=3500)
            pages_shown = upage.eval_on_selector_all(
                "#icon-guide-overlay .ig-item",
                "els => els.map(el => el.getAttribute('data-ig-page'))",
            )
            self.assertNotIn("surgery-stats", pages_shown)
            self.assertNotIn("nckh", pages_shown)
            self.assertIn("dashboard", pages_shown)
            self.assertIn("surgery", pages_shown)
            self.assertEqual(u_c_errs, [])
            self.assertEqual(u_p_errs, [])
        finally:
            ctx_u.close()


if __name__ == "__main__":
    unittest.main()
