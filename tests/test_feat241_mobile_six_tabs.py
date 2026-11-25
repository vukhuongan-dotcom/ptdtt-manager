#!/usr/bin/env python3
"""Comprehensive Playwright Verification Suite for FEAT-241:
Mobile Redesign (Android Chrome & iPhone WebKit, Light & Dark #0C1022) for 6 Tabs:
  1. Lịch mổ tuần (js/surgery.js + css/surgery.css)
  2. Duyệt mổ (js/surgery-approval.js + css/surgery-approval.css)
  3. Nhân sự (js/staff.js + css/staff.css)
  4. Kế hoạch hoạt động (js/plans.js + css/plans.css)
  5. Báo cáo khoa học (js/conferences.js + css/conferences.css)
  6. Nghiên cứu khoa học (js/nckh.js + css/nckh.css)
Plus Desktop 1440x900 & Tablet 600x900 preservation + BUG-240 #FFFFFF title reset.
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


class TestFeat241MobileSixTabs(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._orig_env = {
            k: os.environ.get(k)
            for k in ("PTDTT_DATA_DIR", "PTDTT_LOG_DIR", "JWT_SECRET", "PTDTT_TESTING")
        }
        cls.tmp_root_obj = tempfile.TemporaryDirectory(prefix="ptdtt_feat241_suite_")
        cls.tmp_root = pathlib.Path(cls.tmp_root_obj.name)

        boot_dir = cls.tmp_root / "boot"
        (boot_dir / "data").mkdir(parents=True, exist_ok=True)
        (boot_dir / "logs").mkdir(parents=True, exist_ok=True)
        (boot_dir / "data" / "db.json").write_text("{}", encoding="utf-8")
        (boot_dir / "data" / "auth.json").write_text('{"users":{}}', encoding="utf-8")

        os.environ["PTDTT_DATA_DIR"] = str(boot_dir / "data")
        os.environ["PTDTT_LOG_DIR"] = str(boot_dir / "logs")
        os.environ["JWT_SECRET"] = "feat241-unit-test-secret-2026-ptdtt-mobile"
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
        tom_iso = _today_vn_iso(1)
        past_iso = _today_vn_iso(-30)
        future_10_iso = _today_vn_iso(10)
        future_12_iso = _today_vn_iso(12)

        staff_list = copy.deepcopy(cls.src_db.get("staff") or [])
        if staff_list:
            staff_list[0]["phone"] = staff_list[0].get("phone") or "0909123456"
            if len(staff_list) > 1:
                staff_list[1]["phone"] = staff_list[1].get("phone") or "0909927154"

        surgeries = [
            {
                "id": 98101,
                "date": today_iso,
                "patientName": "Nguyen Van Robot",
                "birthYear": 1966,
                "mainSurgeon": 2,
                "assistants": [4],
                "surgeryType": "robot",
                "type": "robot",
                "approachType": "robot",
                "diagnosis": "Ung thư trực tràng 1/3 dưới",
                "method": "PT Robot cắt trước thấp (TME)",
                "duration": 180,
                "room": "PM 01",
            },
            {
                "id": 98102,
                "date": today_iso,
                "patientName": "Tran Thi Yeu Cau",
                "birthYear": 1973,
                "mainSurgeon": 4,
                "surgeryType": "yeucau",
                "type": "yeucau",
                "approachType": "noisoi",
                "diagnosis": "Ung thư đại tràng Sigma",
                "method": "PT nội soi cắt ĐT Sigma",
                "duration": 120,
                "room": "PM 02",
            },
            {
                "id": 98103,
                "date": tom_iso,
                "patientName": "Le Van Chuong Trinh",
                "birthYear": 1981,
                "mainSurgeon": 2,
                "surgeryType": "chuongtrinh",
                "type": "chuongtrinh",
                "approachType": "noisoi",
                "diagnosis": "U đại tràng phải",
                "method": "PT nội soi cắt ĐT phải",
                "duration": 140,
                "room": "PM 03",
            },
        ]

        plans = copy.deepcopy(cls.src_db.get("plans") or [])
        plans.extend([
            {
                "id": 4901,
                "title": "Giao ban đầu tuần Khoa PTĐTT",
                "date": today_iso,
                "endDate": today_iso,
                "time": "07:30",
                "endTime": "08:30",
                "duration": "60 phút",
                "type": "meeting",
                "responsible": 2,
                "location": "Phòng giao ban Khoa",
                "note": "Kiểm tra lịch mổ tuần",
            },
            {
                "id": 4902,
                "title": "SHCM: Phẫu thuật Robot TME",
                "date": tom_iso,
                "endDate": tom_iso,
                "time": "15:30",
                "duration": "30 phút",
                "type": "training",
                "source": "shcm",
                "responsible": 2,
                "location": "Hội trường Khoa",
            },
        ])

        conferences = [
            {
                "id": 801,
                "name": "Hội nghị Ngoại khoa Toàn quốc (Past Seed)",
                "nameVi": "Báo cáo tổng kết năm",
                "startDate": past_iso,
                "endDate": past_iso,
                "dates": past_iso,
                "location": "TP. Hồ Chí Minh",
                "region": "domestic",
                "website": "https://vasel.vn",
                "presentations": [
                    {
                        "title": "Kết quả cắt đại tràng nội soi",
                        "presenter": "BSCKII. Vũ Khương An",
                        "date": past_iso,
                        "time": "09:00",
                        "language": "vi",
                    }
                ],
            },
            {
                "id": 802,
                "name": "ELSA Robotic Surgery Forum (Upcoming Seed)",
                "nameVi": "Diễn đàn phẫu thuật Robot Châu Á",
                "startDate": future_10_iso,
                "endDate": future_12_iso,
                "dates": f"{future_10_iso} - {future_12_iso}",
                "location": "Hà Nội",
                "region": "international",
                "website": "https://elsa-robot.org",
                "presentations": [
                    {
                        "title": "Robotic TME with Indocyanine Green Fluorescence",
                        "presenter": "TS.BSCKII. Nguyễn Phú Hữu",
                        "date": future_10_iso,
                        "time": "10:15",
                        "language": "en",
                    },
                    {
                        "title": "Kỹ thuật khâu nối trong ổ bụng bằng Robot",
                        "presenter": "BSCKII. Vũ Khương An",
                        "date": future_10_iso,
                        "time": "11:00",
                        "language": "vi",
                    },
                ],
            },
        ]

        special_teams = copy.deepcopy(cls.src_db.get("specialTeams") or []) or [
            {
                "id": 1,
                "name": "Tổ Phẫu thuật Robot",
                "icon": "🤖",
                "members": [1, 2],
                "note": "Phụ trách điều phối Robot",
                "order": 1,
            }
        ]

        cfg = copy.deepcopy(cls.eng.DEFAULT_SURGERY_APPROVAL_CONFIG)
        cfg["rolloutAccessMode"] = "all_staff"
        cfg["sandboxOnlyMode"] = False
        db_payload = {
            "_version": 12,
            "staff": staff_list,
            "departedStaff": copy.deepcopy(cls.src_db.get("departedStaff") or [
                {"name": "BS. Đã Chuyển Công Tác", "title": "BS.", "role": "Bác sĩ chính", "departedDate": "2026-01-15"}
            ]),
            "rooms": copy.deepcopy(cls.src_db.get("rooms") or []),
            "externalDoctors": copy.deepcopy(cls.src_db.get("externalDoctors") or [
                {"id": 1, "name": "TS.BS. Nguyễn Ngoài Khoa", "title": "TS.", "position": "Phó khoa", "department": "Ngoại Tiêu hóa", "phone": "0912345678"}
            ]),
            "specialTeams": special_teams,
            "staffStatuses": copy.deepcopy(cls.src_db.get("staffStatuses") or []),
            "plans": plans,
            "conferences": conferences,
            "nckhItems": copy.deepcopy(cls.src_db.get("nckhItems") or []),
            "schedules": [],
            "reports7h": [],
            "reports16h": [],
            "shcmSchedule": [],
            "shcmSettings": [{"id": 1, "defaultTime": "15:30", "defaultDuration": "30m"}],
            "surgeries": surgeries,
            "surgeriesTrash": [],
            "surgeriesArchivedInactive": [],
            "notifications": [],
            "approvalDelegations": [
                {
                    "id": "del-seed-1",
                    "delegateStaffId": 2,
                    "delegateName": "Vũ Khương An",
                    "grantedByStaffId": 1,
                    "grantedByName": "Nguyễn Phú Hữu",
                    "fromDate": today_iso,
                    "toDate": tom_iso,
                    "active": True,
                    "note": "Ủy quyền trực BCN mẫu",
                }
            ],
            "surgeryApprovalConfig": cfg,
            "nextIds": {
                "staff": 200,
                "surgeries": 100000,
                "notifications": 1,
                "plans": 5000,
                "conferences": 900,
                "nckhItems": 500,
            },
            "_revisions": {
                "staff": 1,
                "staffStatuses": 1,
                "surgeries": 1,
                "surgeriesTrash": 1,
                "notifications": 1,
                "robotCases": 1,
            },
        }
        data_file = data_dir / "db.json"
        data_file.write_text(json.dumps(db_payload, ensure_ascii=False, indent=2), encoding="utf-8")

        cls.pw_hash = cls.sf._hash_password("Feat241Strong2026")
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
            }
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

    def _open_page(self, browser_name: str, width: int, height: int, username: str = "vkan", theme: str = "light"):
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
            localStorage.setItem('ptdtt_theme', {json.dumps(theme)});
            localStorage.setItem('ptdtt_icon_guide_v261121_dismissed', '1');
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

    def _navigate_tab(self, page, tab_name: str, wait_selector: str):
        page.evaluate(f"() => App.navigate('{tab_name}')")
        page.wait_for_selector(wait_selector, timeout=8000)

    def _assert_no_overflow(self, page, label: str):
        metrics = page.evaluate(
            "() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })"
        )
        self.assertLessEqual(
            metrics["sw"],
            metrics["iw"] + 1,
            f"Horizontal overflow at {label}: scrollWidth={metrics['sw']} > innerWidth={metrics['iw']}",
        )

    def _assert_white_header_title(self, page, hdr_selector: str, label: str):
        hdr_box = page.locator(hdr_selector).bounding_box()
        self.assertIsNotNone(hdr_box, f"Missing header at {label}")
        self.assertLessEqual(hdr_box["height"], 80, f"Mobile header > 80px at {label}: {hdr_box['height']}")
        styles = page.evaluate(
            """(sel) => {
                const t = document.querySelector(sel + ' .page-title');
                if (!t) return null;
                const cs = getComputedStyle(t);
                return {
                    color: cs.color,
                    fill: cs.webkitTextFillColor || cs.getPropertyValue('-webkit-text-fill-color'),
                    bgImage: cs.backgroundImage
                };
            }""",
            hdr_selector,
        )
        self.assertIsNotNone(styles, f"Missing .page-title at {label}")
        self.assertEqual(styles["color"], "rgb(255, 255, 255)", f"BUG-240 color mismatch at {label}: {styles}")
        self.assertEqual(styles["fill"], "rgb(255, 255, 255)", f"BUG-240 webkitTextFillColor mismatch at {label}: {styles}")

    def _close_modal_if_open(self, page):
        page.evaluate("() => { if (typeof Modal !== 'undefined' && Modal.close) Modal.close(); }")

    def test_01_surgery_mobile(self):
        for engine, vw, vh in (("chromium", 360, 800), ("webkit", 390, 844)):
            for theme in ("light", "dark"):
                ctx, page, cerr, perr = self._open_page(engine, vw, vh, theme=theme)
                try:
                    self._navigate_tab(page, "surgery", "#surgery-page")
                    self._assert_white_header_title(page, "#surgery-page .surgery-sticky-header > .page-header", f"surgery {engine} {theme}")
                    more_box = page.locator("#surg-mobile-more-btn").bounding_box()
                    self.assertIsNotNone(more_box)
                    self.assertGreaterEqual(more_box["width"], 44)
                    self.assertGreaterEqual(more_box["height"], 44)

                    sel = page.locator("#surgery-page select.surgery-filter-select").first
                    if sel.count() > 0:
                        sel_box = sel.bounding_box()
                        self.assertGreaterEqual(sel_box["height"], 44, f"Select < 44px on {engine}")

                    self.assertGreaterEqual(page.locator("#surgery-page .surg-mobile-full-card").count(), 2)
                    page.locator('[data-surg-qfilter="robot"]').click()
                    robot_cnt = page.locator("#surgery-page .surg-mobile-full-card").count()
                    self.assertGreaterEqual(robot_cnt, 1)
                    page.locator('[data-surg-qfilter="all"]').click()

                    page.locator("[data-surg-more]").first.click()
                    page.wait_for_selector("#modal-overlay.active .surg-sheet-actions", timeout=4000)
                    self._close_modal_if_open(page)

                    page.locator("#surg-mobile-more-btn").click()
                    page.wait_for_selector("#modal-overlay.active .surg-sheet-actions", timeout=4000)
                    self._close_modal_if_open(page)

                    self._assert_no_overflow(page, f"surgery {engine} {theme}")
                    self.assertEqual(cerr, [], f"Console errors: {cerr}")
                    self.assertEqual(perr, [], f"Page errors: {perr}")
                finally:
                    ctx.close()

    def test_02_surgery_approval_mobile(self):
        for engine, vw, vh in (("chromium", 360, 800), ("webkit", 390, 844)):
            for theme in ("light", "dark"):
                ctx, page, cerr, perr = self._open_page(engine, vw, vh, theme=theme)
                try:
                    self._navigate_tab(page, "surgery-approval", "#surgery-approval-page")
                    self._assert_white_header_title(page, "#surgery-approval-page > .page-header", f"sap {engine} {theme}")

                    # .sap-scope-compact & .sap-canary-bar hidden by default on Mobile
                    scope_hidden = page.evaluate(
                        """() => {
                            const s = document.querySelector('#surgery-approval-page .sap-scope-compact');
                            const c = document.querySelector('#surgery-approval-page .sap-canary-bar');
                            return (!s || getComputedStyle(s).display === 'none') && (!c || getComputedStyle(c).display === 'none');
                        }"""
                    )
                    self.assertTrue(scope_hidden, f"Scope/Canary should hide by default on mobile {engine}")

                    more_box = page.locator("#sap-mobile-more-btn").bounding_box()
                    self.assertIsNotNone(more_box)
                    self.assertGreaterEqual(more_box["height"], 44)
                    page.locator("#sap-mobile-more-btn").click()
                    page.wait_for_selector("#modal-overlay.active .sap-sheet-actions", timeout=4000)
                    self._close_modal_if_open(page)

                    # Switch to Delegations & Logs subtabs
                    page.evaluate("() => SurgeryApprovalPage.switchSubtab('delegations')")
                    page.wait_for_selector("#surgery-approval-page .sap-mobile-list-cards", timeout=4000)
                    page.evaluate("() => SurgeryApprovalPage.switchSubtab('logs')")
                    page.wait_for_selector("#surgery-approval-page .sap-mobile-list-cards", timeout=4000)
                    self._assert_no_overflow(page, f"sap logs {engine} {theme}")

                    # Drawer sticky stepper, footer >= 44px, zero <select> in catalog, z-index >= 1200
                    page.evaluate("() => SurgeryApprovalPage.openCaseModal(98102, { viewMode: 'steps' })")
                    page.wait_for_selector(".sap-drawer-overlay .sap-mobile-stepper", timeout=6000)
                    drawer_check = page.evaluate(
                        """() => {
                            const ov = document.querySelector('.sap-drawer-overlay');
                            const stp = document.querySelector('.sap-mobile-stepper');
                            const footerBtns = Array.from(document.querySelectorAll('.sap-drawer-overlay .sap-drawer-footer button, .sap-drawer-overlay .modal-footer button'));
                            const minBtnH = footerBtns.length ? Math.min(...footerBtns.map(b => Math.round(b.getBoundingClientRect().height))) : 0;
                            const selects = document.querySelectorAll('#sap-f-catalog select').length;
                            const z = ov ? Number(getComputedStyle(ov).zIndex) || 0 : 0;
                            return { z, hasStepper: Boolean(stp), selects, minBtnH };
                        }"""
                    )
                    self.assertGreaterEqual(drawer_check["z"], 1200)
                    self.assertTrue(drawer_check["hasStepper"])
                    self.assertEqual(drawer_check["selects"], 0)
                    if drawer_check["minBtnH"]:
                        self.assertGreaterEqual(drawer_check["minBtnH"], 44, f"Drawer footer button < 44px: {drawer_check}")
                    self._close_modal_if_open(page)

                    self.assertEqual(cerr, [], f"Console errors: {cerr}")
                    self.assertEqual(perr, [], f"Page errors: {perr}")
                finally:
                    ctx.close()

    def test_03_staff_mobile(self):
        for engine, vw, vh in (("chromium", 360, 800), ("webkit", 390, 844)):
            for theme in ("light", "dark"):
                ctx, page, cerr, perr = self._open_page(engine, vw, vh, theme=theme)
                try:
                    self._navigate_tab(page, "staff", "#staff-page")
                    self._assert_white_header_title(page, "#staff-page > .page-header", f"staff {engine} {theme}")

                    # Search toggle & 16px anti-zoom input
                    page.locator("#stf-mobile-search-btn").click()
                    page.wait_for_selector("#stf-mobile-search-input", timeout=4000)
                    font_px = page.evaluate("() => parseFloat(getComputedStyle(document.getElementById('stf-mobile-search-input')).fontSize)")
                    self.assertGreaterEqual(font_px, 16, f"Staff search input < 16px on {engine}: {font_px}")

                    # Direct 44px tel: call button & tap card sheet
                    call_btn = page.locator("#staff-page .stf-call-btn").first
                    self.assertGreater(call_btn.count(), 0)
                    call_box = call_btn.bounding_box()
                    self.assertGreaterEqual(call_box["width"], 44)
                    self.assertGreaterEqual(call_box["height"], 44)
                    self.assertTrue(call_btn.get_attribute("href").startswith("tel:"))

                    page.locator("#staff-page .stf-dir-card").first.click()
                    page.wait_for_selector("#modal-overlay.active .stf-sheet-actions", timeout=4000)
                    self._close_modal_if_open(page)

                    # All 4 subtabs show mobile cards & zero overflow
                    for subtab in ("external", "departed", "teams", "internal"):
                        page.evaluate(f"() => StaffPage.switchTab('{subtab}')")
                        page.wait_for_selector("#staff-page .staff-mobile-cards", timeout=4000)
                        cards_ok = page.evaluate(
                            """() => {
                                const m = document.querySelector('#staff-page .staff-mobile-cards');
                                const d = document.querySelector('#staff-page .staff-desktop-view');
                                return Boolean(m && getComputedStyle(m).display !== 'none' && (!d || getComputedStyle(d).display === 'none'));
                            }"""
                        )
                        self.assertTrue(cards_ok, f"Expected mobile cards on staff {subtab} {engine}")
                        self._assert_no_overflow(page, f"staff {subtab} {engine} {theme}")

                    page.locator("#stf-mobile-more-btn").click()
                    page.wait_for_selector("#modal-overlay.active .stf-sheet-actions", timeout=4000)
                    self._close_modal_if_open(page)

                    self.assertEqual(cerr, [], f"Console errors: {cerr}")
                    self.assertEqual(perr, [], f"Page errors: {perr}")
                finally:
                    ctx.close()

    def test_04_plans_mobile(self):
        for engine, vw, vh in (("chromium", 360, 800), ("webkit", 390, 844)):
            for theme in ("light", "dark"):
                ctx, page, cerr, perr = self._open_page(engine, vw, vh, theme=theme)
                try:
                    self._navigate_tab(page, "plans", "#plans-page")
                    self._assert_white_header_title(page, "#plans-page > .page-header", f"plans {engine} {theme}")

                    # Agenda card SHCM badge & 44px more button
                    self.assertGreaterEqual(page.locator("#plans-page .pln-shcm-badge").count(), 1)
                    more_btn = page.locator("#plans-page .pln-card-more-btn").first
                    more_box = more_btn.bounding_box()
                    self.assertGreaterEqual(more_box["width"], 44)
                    self.assertGreaterEqual(more_box["height"], 44)
                    more_btn.click()
                    page.wait_for_selector("#modal-overlay.active .pln-sheet-actions", timeout=4000)
                    self._close_modal_if_open(page)

                    # Switch to Mini Calendar view & click date
                    page.locator('#plans-page .pln-view-tab', has_text="Lịch tháng").click()
                    page.wait_for_selector("#plans-page .pln-mini-cal", timeout=4000)
                    page.locator("#plans-page [data-month-date]").first.click()
                    self.assertGreaterEqual(page.locator("#plans-page .pln-month-events-hdr").count(), 1)
                    self._assert_no_overflow(page, f"plans month {engine} {theme}")

                    # Header tools sheet
                    page.locator("#plans-mobile-more-btn").click()
                    page.wait_for_selector("#modal-overlay.active .pln-sheet-actions", timeout=4000)
                    self._close_modal_if_open(page)
                    page.evaluate("() => PlansPage.setView('agenda')")
                    self._assert_no_overflow(page, f"plans agenda {engine} {theme}")

                    self.assertEqual(cerr, [], f"Console errors: {cerr}")
                    self.assertEqual(perr, [], f"Page errors: {perr}")
                finally:
                    ctx.close()

    def test_05_conferences_mobile(self):
        for engine, vw, vh in (("chromium", 360, 800), ("webkit", 390, 844)):
            for theme in ("light", "dark"):
                ctx, page, cerr, perr = self._open_page(engine, vw, vh, theme=theme)
                try:
                    self._navigate_tab(page, "conferences", "#conferences-page")
                    self._assert_white_header_title(page, "#conferences-page > .page-header", f"conferences {engine} {theme}")

                    # 4 KPI cards align in a single horizontal row
                    tops = page.evaluate(
                        "() => Array.from(document.querySelectorAll('#conferences-page .cp-stat-card')).map(el => Math.round(el.getBoundingClientRect().top))"
                    )
                    self.assertEqual(len(tops), 4)
                    self.assertLessEqual(max(tops) - min(tops), 2, f"KPI row wrapped unexpectedly on {engine}: {tops}")

                    # Nearest upcoming conference (802) expanded by default, past (801) collapsed by default
                    past_hidden = page.evaluate(
                        "() => getComputedStyle(document.querySelector('[data-conf-card=\"801\"] .cp-pres-list')).display === 'none'"
                    )
                    up_visible = page.evaluate(
                        "() => getComputedStyle(document.querySelector('[data-conf-card=\"802\"] .cp-pres-list')).display !== 'none'"
                    )
                    self.assertTrue(past_hidden, "Past conference pres list must default collapsed on Mobile")
                    self.assertTrue(up_visible, "Nearest upcoming conference pres list must default expanded on Mobile")

                    tog = page.locator('[data-conf-toggle="801"]')
                    self.assertGreaterEqual(tog.bounding_box()["height"], 44)
                    tog.click()
                    self.assertEqual(
                        page.locator('[data-conf-toggle="801"]').get_attribute("aria-expanded"),
                        "true",
                    )

                    # Sheet triggers >= 44px
                    c_more = page.locator('[data-conf-more="802"]')
                    self.assertGreaterEqual(c_more.bounding_box()["height"], 44)
                    c_more.click()
                    page.wait_for_selector("#modal-overlay.active .conf-sheet-actions", timeout=4000)
                    self._close_modal_if_open(page)

                    p_more = page.locator('[data-conf-pres-more^="802-"]').first
                    self.assertGreaterEqual(p_more.bounding_box()["height"], 44)
                    p_more.click()
                    page.wait_for_selector("#modal-overlay.active .conf-sheet-actions", timeout=4000)
                    self._close_modal_if_open(page)

                    self._assert_no_overflow(page, f"conferences {engine} {theme}")
                    self.assertEqual(cerr, [], f"Console errors: {cerr}")
                    self.assertEqual(perr, [], f"Page errors: {perr}")
                finally:
                    ctx.close()

    def test_06_nckh_mobile(self):
        for engine, vw, vh in (("chromium", 360, 800), ("webkit", 390, 844)):
            for theme in ("light", "dark"):
                ctx, page, cerr, perr = self._open_page(engine, vw, vh, theme=theme)
                try:
                    self._navigate_tab(page, "nckh", "#nckh-page")
                    self._assert_white_header_title(page, "#nckh-page > .page-header.nckh-header", f"nckh {engine} {theme}")

                    # Single #nckh-primary-add-btn + 44px #nckh-mobile-more-btn + hidden BCN pill/subtitle
                    self.assertEqual(page.locator("#nckh-primary-add-btn").count(), 1)
                    self.assertGreaterEqual(page.locator("#nckh-primary-add-btn").bounding_box()["height"], 44)
                    self.assertGreaterEqual(page.locator("#nckh-mobile-more-btn").bounding_box()["height"], 44)
                    bcn_hidden = page.evaluate(
                        "() => getComputedStyle(document.querySelector('#nckh-page .nckh-bcn-pill')).display === 'none'"
                    )
                    self.assertTrue(bcn_hidden)

                    # Search input 16px + Ranking cards on dashboard
                    search_px = page.evaluate("() => parseFloat(getComputedStyle(document.getElementById('nckh-search-input')).fontSize)")
                    self.assertGreaterEqual(search_px, 16)
                    rank_visible = page.evaluate(
                        "() => getComputedStyle(document.querySelector('#nckh-page .nckh-staff-ranking-cards')).display !== 'none'"
                    )
                    self.assertTrue(rank_visible)

                    page.locator("#nckh-mobile-more-btn").click()
                    page.wait_for_selector("#modal-overlay.active .nckh-sheet-actions", timeout=4000)
                    self._close_modal_if_open(page)

                    # Topic & Initiative card mobile ⋮ sheets + hidden desktop card actions
                    for subtab in ("topic_approved", "initiative_approved"):
                        page.click(f'.nckh-subtab[data-subtab="{subtab}"]')
                        page.wait_for_selector("#nckh-page [data-nckh-more]", timeout=4000)
                        more_btn = page.locator("#nckh-page [data-nckh-more]").first
                        self.assertGreaterEqual(more_btn.bounding_box()["height"], 44)
                        more_btn.click()
                        page.wait_for_selector("#modal-overlay.active .nckh-sheet-actions", timeout=4000)
                        self._close_modal_if_open(page)
                        self._assert_no_overflow(page, f"nckh {subtab} {engine} {theme}")

                    self.assertEqual(cerr, [], f"Console errors: {cerr}")
                    self.assertEqual(perr, [], f"Page errors: {perr}")
                finally:
                    ctx.close()

    def test_07_desktop_and_tablet_preservation(self):
        tabs = [
            ("surgery", "#surgery-page"),
            ("surgery-approval", "#surgery-approval-page"),
            ("staff", "#staff-page"),
            ("plans", "#plans-page"),
            ("conferences", "#conferences-page"),
            ("nckh", "#nckh-page"),
        ]
        # 1. Desktop 1440x900: ALL mobile-only elements must be hidden
        ctx, page, cerr, perr = self._open_page("chromium", 1440, 900, theme="light")
        try:
            for tab, wait_sel in tabs:
                self._navigate_tab(page, tab, wait_sel)
                self._assert_no_overflow(page, f"desktop {tab}")
                leaked = page.evaluate(
                    """() => {
                        const sels = [
                            '.surg-mobile-hdr-tools', '.surg-mobile-quick-filters',
                            '.sap-mobile-hdr-tools', '.sap-mobile-list-cards',
                            '.stf-mobile-hdr-tools', '.stf-mobile-search-bar', '#staff-page .stf-call-btn',
                            '.pln-mobile-hdr-tools', '.pln-mobile-view-switch', '.pln-mobile-month-wrap', '.pln-card-more-btn', '.pln-shcm-badge',
                            '.conf-mobile-hdr-tools', '.cp-mobile-pres-toggle', '.cp-pres-mobile-more', '.cp-footer-mobile',
                            '#nckh-mobile-more-btn', '.nckh-card-more-btn', '.nckh-mobile-only'
                        ];
                        const bad = [];
                        for (const s of sels) {
                            document.querySelectorAll(s).forEach(el => {
                                if (getComputedStyle(el).display !== 'none') bad.push(s);
                            });
                        }
                        return bad;
                    }"""
                )
                self.assertEqual(leaked, [], f"Mobile-only selectors leaked on Desktop 1440px in tab {tab}: {leaked}")
            self.assertEqual(cerr, [], f"Console errors on Desktop: {cerr}")
            self.assertEqual(perr, [], f"Page errors on Desktop: {perr}")
        finally:
            ctx.close()

        # 2. Tablet 600x900: zero horizontal overflow across all 6 tabs
        ctx, page, cerr, perr = self._open_page("chromium", 600, 900, theme="light")
        try:
            for tab, wait_sel in tabs:
                self._navigate_tab(page, tab, wait_sel)
                self._assert_no_overflow(page, f"tablet 600x900 {tab}")
            self.assertEqual(cerr, [], f"Console errors on Tablet: {cerr}")
            self.assertEqual(perr, [], f"Page errors on Tablet: {perr}")
        finally:
            ctx.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
