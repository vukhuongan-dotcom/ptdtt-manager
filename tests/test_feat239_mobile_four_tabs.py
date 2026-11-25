#!/usr/bin/env python3
"""Comprehensive Playwright Verification Suite for FEAT-239:
Mobile Redesign (Android Chrome & iPhone WebKit, Light & Dark #0C1022) for 4 Tabs:
  1. Báo cáo (js/reports.js + css/reports.css)
  2. Lịch phân công tuần (js/schedule.js + css/schedule.css)
  3. Thống kê phẫu thuật (js/surgery-stats.js + css/surgery-stats.css)
  4. Sinh hoạt chuyên môn (js/research.js + css/research.css)
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


class TestFeat239MobileFourTabs(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._orig_env = {
            k: os.environ.get(k)
            for k in ("PTDTT_DATA_DIR", "PTDTT_LOG_DIR", "JWT_SECRET", "PTDTT_TESTING")
        }
        cls.tmp_root_obj = tempfile.TemporaryDirectory(prefix="ptdtt_feat239_suite_")
        cls.tmp_root = pathlib.Path(cls.tmp_root_obj.name)

        boot_dir = cls.tmp_root / "boot"
        (boot_dir / "data").mkdir(parents=True, exist_ok=True)
        (boot_dir / "logs").mkdir(parents=True, exist_ok=True)
        (boot_dir / "data" / "db.json").write_text("{}", encoding="utf-8")
        (boot_dir / "data" / "auth.json").write_text('{"users":{}}', encoding="utf-8")

        os.environ["PTDTT_DATA_DIR"] = str(boot_dir / "data")
        os.environ["PTDTT_LOG_DIR"] = str(boot_dir / "logs")
        os.environ["JWT_SECRET"] = "feat239-unit-test-secret-2026-ptdtt-mobile"
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
        yest_iso = _today_vn_iso(-1)
        future_3_iso = _today_vn_iso(3)
        future_17_iso = _today_vn_iso(17)

        staff_list = copy.deepcopy(cls.src_db.get("staff") or [])

        # Surgeries with mixed doctors, axes, approaches, and types
        surgeries = []
        for s in (cls.src_db.get("surgeries") or [])[-30:]:
            sc = copy.deepcopy(s)
            for k in ("approval", "approvalAudit", "approvalStatus", "approvalRevision", "robotCaseId", "robotCaseCode", "lastJournalSeq", "lastAttributionSeq", "episodeId"):
                sc.pop(k, None)
            if not sc.get("date") or str(sc["date"])[:10] > today_iso:
                sc["date"] = yest_iso
            surgeries.append(sc)
        surgeries.extend([
            {
                "id": 99101,
                "date": today_iso,
                "patientName": "BN Robot Test Alpha",
                "birthYear": 1968,
                "mainSurgeon": 2,
                "surgeryType": "robot",
                "type": "robot",
                "approachType": "robot",
                "diagnosis": "Ung thư trực tràng",
                "method": "PT Robot cắt trước thấp",
                "duration": 180,
            },
            {
                "id": 99102,
                "date": yest_iso,
                "patientName": "BN Nội Soi Beta",
                "birthYear": 1974,
                "mainSurgeon": 1,
                "assistants": [2],
                "surgeryType": "yeucau",
                "type": "yeucau",
                "approachType": "noisoi",
                "diagnosis": "Ung thư đại tràng Sigma",
                "method": "PT nội soi cắt ĐT Sigma",
                "duration": 135,
            },
            {
                "id": 99103,
                "date": _today_vn_iso(-3),
                "patientName": "BN Trĩ Gamma",
                "birthYear": 1982,
                "mainSurgeon": 4,
                "surgeryType": "chuongtrinh",
                "type": "chuongtrinh",
                "approachType": "nsth",
                "diagnosis": "Trĩ hỗn hợp độ IV",
                "method": "Cắt trĩ Longo",
                "duration": 45,
            },
        ])

        reports16h = [
            {
                "id": 9001,
                "date": today_iso,
                "totalPatients": 64,
                "postOpNotReturned": 4,
                "admissions": 7,
                "discharges": 9,
                "severePatients": 2,
                "surgeryDay": True,
                "surgeryTotal": 6,
                "surgeryCT": 3,
                "surgeryYC": 2,
                "surgeryRobot": 1,
                "surgery2Total": 5,
                "surgery2CT": 3,
                "surgery2YC": 2,
                "surgery2Robot": 0,
                "reporterName": "Vũ Khương An",
                "notes": "Ổn định",
            },
            {
                "id": 9002,
                "date": yest_iso,
                "totalPatients": 66,
                "postOpNotReturned": 5,
                "admissions": 8,
                "discharges": 6,
                "severePatients": 2,
                "surgeryDay": True,
                "surgeryTotal": 8,
                "surgeryCT": 5,
                "surgeryYC": 3,
                "surgeryRobot": 0,
                "surgery2Total": 6,
                "surgery2CT": 4,
                "surgery2YC": 2,
                "surgery2Robot": 0,
                "reporterName": "Vũ Ngọc Anh Tuấn",
                "notes": "",
            },
        ]

        reports7h = [
            {
                "id": 9101,
                "date": today_iso,
                "totalPatients": 62,
                "fromHSCC": 1,
                "fromHSCCDetail": "BN Test A / P302",
                "fromHoiTinh": 2,
                "fromHoiTinhDetail": "BN Test B / P305",
                "fromICU": 0,
                "fromICUDetail": "",
                "fromGiaiAp": 1,
                "fromGiaiApDetail": "Niệu / 1 ca",
                "reporterName": "Nguyễn Thị Ngọc Thùy",
                "notes": "Đầy đủ",
            },
            {
                "id": 9102,
                "date": yest_iso,
                "totalPatients": 60,
                "fromHSCC": 0,
                "fromHSCCDetail": "",
                "fromHoiTinh": 1,
                "fromHoiTinhDetail": "BN C / P301",
                "fromICU": 0,
                "fromICUDetail": "",
                "fromGiaiAp": 0,
                "fromGiaiApDetail": "",
                "reporterName": "Phạm Thị Thanh Thảo",
                "notes": "",
            },
        ]

        shcm_items = [
            {
                "id": 1,
                "doctorId": 4,
                "doctorName": "BSCKII. Vũ Ngọc Anh Tuấn",
                "title": "Đề tài Đã Trình (Khóa SuperAdmin)",
                "presentDate": "2025-04-15",
                "status": "done",
                "planId": None,
            },
            {
                "id": 901,
                "doctorId": 2,
                "doctorName": "BSCKII. Vũ Khương An",
                "title": "Cập nhật TME Robot ít xâm lấn trong K trực tràng thấp",
                "presentDate": future_3_iso,
                "status": "pending",
                "planId": None,
            },
            {
                "id": 902,
                "doctorId": 4,
                "doctorName": "BSCKII. Vũ Ngọc Anh Tuấn",
                "title": "Chiến lược ERAS toàn diện sau cắt đại tràng",
                "presentDate": future_17_iso,
                "status": "registered",
                "planId": None,
            },
        ]

        cfg = copy.deepcopy(cls.eng.DEFAULT_SURGERY_APPROVAL_CONFIG)
        cfg["rolloutAccessMode"] = "all_staff"
        cfg["sandboxOnlyMode"] = False
        db_payload = {
            "_version": 12,
            "staff": staff_list,
            "departedStaff": copy.deepcopy(cls.src_db.get("departedStaff") or []),
            "rooms": copy.deepcopy(cls.src_db.get("rooms") or []),
            "externalDoctors": copy.deepcopy(cls.src_db.get("externalDoctors") or []),
            "staffStatuses": copy.deepcopy(cls.src_db.get("staffStatuses") or []),
            "plans": copy.deepcopy(cls.src_db.get("plans") or []),
            "schedules": [],
            "reports7h": reports7h,
            "reports16h": reports16h,
            "shcmSchedule": shcm_items,
            "shcmSettings": [{"id": 1, "defaultTime": "15:30", "defaultDuration": "30m"}],
            "surgeries": surgeries,
            "surgeriesTrash": [],
            "surgeriesArchivedInactive": [],
            "notifications": [],
            "approvalDelegations": [],
            "surgeryApprovalConfig": cfg,
            "nextIds": {
                "staff": 100,
                "surgeries": 100000,
                "notifications": 1,
                "reports16h": 9010,
                "reports7h": 9110,
                "shcmSchedule": 910,
                "plans": 5000,
                "schedules": 100,
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

        cls.pw_hash = cls.sf._hash_password("Feat239Strong2026")
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
            "nphuu": {
                "passwordHash": cls.pw_hash,
                "name": "Nguyễn Phú Hữu",
                "title": "TS. BSCKII.",
                "role": "Bác sĩ Trưởng khoa",
                "staffId": 1,
                "isAdmin": True,
                "isSuperAdmin": False,
                "disabled": False,
                "mustChangePassword": False,
                "sessionEpoch": 1,
            },
            "ntnthuy": {
                "passwordHash": cls.pw_hash,
                "name": "Nguyễn Thị Ngọc Thùy",
                "title": "CNĐD.",
                "role": "Điều dưỡng trưởng",
                "staffId": 3,
                "isAdmin": False,
                "isSuperAdmin": False,
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
        cls.sw_build_ver = sw_m.group(1) if sw_m else "2611251839"

        client = cls.sf.app.test_client()
        token = cls.sf._create_jwt("vkan", users["vkan"])
        client.post(
            "/api/robot/cases",
            headers={"Authorization": f"Bearer {token}", "X-Client-Build": cls.sw_build_ver, "Content-Type": "application/json"},
            json={"action": "create_case", "patientName": "BN Robot Schedule Seed", "phone": "0909927154", "mainSurgeonId": 2, "surgeryDate": today_iso, "caseSlot": "Ca 1"},
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
            "() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, bsw: document.body.scrollWidth })"
        )
        self.assertLessEqual(
            metrics["sw"],
            metrics["iw"],
            f"Horizontal overflow at {label}: doc.scrollWidth={metrics['sw']} > innerWidth={metrics['iw']}",
        )

    def test_01_reports_mobile_and_desktop(self):
        # Role defaults + non-Admin stats isolation
        for uname, expected_tab, expects_stats in (
            ("vkan", "report16h", True),
            ("ntnthuy", "report7h", False),
            ("vnatuan", "report16h", False),
        ):
            ctx, page, cerr, perr = self._open_page("chromium", 360, 800, username=uname)
            try:
                self._navigate_tab(page, "reports", "#reports-page")
                active_tab = page.evaluate("() => ReportsPage.activeTab")
                self.assertEqual(active_tab, expected_tab, f"Role {uname} should default to {expected_tab}, got {active_tab}")
                stats_count = page.locator('[data-rpt-tab="stats"]').count()
                self.assertEqual(stats_count, 1 if expects_stats else 0, f"Unexpected stats subtab count for {uname}")
                self.assertEqual(cerr, [], f"Console errors for {uname}: {cerr}")
                self.assertEqual(perr, [], f"Page errors for {uname}: {perr}")
            finally:
                ctx.close()

        # Mobile 360x800 + WebKit 390x844 full interaction check
        for engine, vw, vh in (("chromium", 360, 800), ("webkit", 390, 844)):
            ctx, page, cerr, perr = self._open_page(engine, vw, vh, username="vkan")
            try:
                self._navigate_tab(page, "reports", "#reports-page")
                hdr_box = page.locator("#reports-page > .page-header").bounding_box()
                self.assertIsNotNone(hdr_box)
                self.assertLessEqual(hdr_box["height"], 80, f"Mobile reports header too tall on {engine}: {hdr_box['height']}")
                more_box = page.locator("#rpt-mobile-more-btn").bounding_box()
                self.assertIsNotNone(more_box)
                self.assertGreaterEqual(more_box["width"], 44)
                self.assertGreaterEqual(more_box["height"], 44)

                # Date stepper ◀ and Hôm nay
                page.locator('.rpt-date-step-btn[aria-label="Ngày hôm trước"]').click()
                self.assertEqual(page.locator("#rpt-16h-date-input").input_value(), _today_vn_iso(-1))
                page.locator(".rpt-today-btn").click()
                self.assertEqual(page.locator("#rpt-16h-date-input").input_value(), _today_vn_iso(0))

                # Hero 1 + 2x2 grid & History mobile cards vs hidden desktop table
                hero_box = page.locator("#reports-page .rpt-stat-grid > div").nth(0).bounding_box()
                sub1_box = page.locator("#reports-page .rpt-stat-grid > div").nth(1).bounding_box()
                self.assertGreater(hero_box["width"], sub1_box["width"] * 1.5, "Tổng BN hero cell must span full width")
                self.assertTrue(page.locator(".rpt-mobile-history-cards .rpt-history-card").first.is_visible())
                self.assertFalse(page.locator(".rpt-desktop-history").is_visible())

                # Open 16h form: 44x44 steppers + >=16px numeric input + sticky footer
                page.evaluate("() => ReportsPage.openReport16hForm(ReportsPage.selectedDate)")
                page.wait_for_selector("#modal .rpt-mobile-form", timeout=5000)
                step_box = page.locator("#modal .rpt-stepper-btn").first.bounding_box()
                self.assertGreaterEqual(step_box["width"], 44)
                self.assertGreaterEqual(step_box["height"], 44)
                num_fs = page.evaluate(
                    "() => parseFloat(getComputedStyle(document.querySelector('#modal .rpt-stepper-input, #modal .rpt-stepper-input-lg')).fontSize)"
                )
                self.assertGreaterEqual(num_fs, 16.0)
                self.assertTrue(page.locator("#modal .rpt-modal-footer-sticky").is_visible())
                page.evaluate("() => Modal.close()")

                # Bottom sheet tools
                page.locator("#rpt-mobile-more-btn").click()
                page.wait_for_selector("#modal .rpt-sheet-actions", timeout=5000)
                page.evaluate("() => Modal.close()")

                self._assert_no_overflow(page, f"reports-{engine}-{vw}x{vh}")
                self.assertEqual(cerr, [])
                self.assertEqual(perr, [])
            finally:
                ctx.close()

        # Desktop 1440x900 preservation
        ctx, page, cerr, perr = self._open_page("chromium", 1440, 900, username="vkan")
        try:
            self._navigate_tab(page, "reports", "#reports-page")
            self.assertFalse(page.locator(".rpt-mobile-hdr-tools").is_visible())
            self.assertTrue(page.locator(".rpt-guide-btn").is_visible())
            self.assertTrue(page.locator(".rpt-desktop-history").is_visible())
            self.assertFalse(page.locator(".rpt-mobile-history-cards").is_visible())
            self._assert_no_overflow(page, "reports-desktop-1440x900")
            self.assertEqual(cerr, [])
            self.assertEqual(perr, [])
        finally:
            ctx.close()

    def test_02_schedule_mobile_and_desktop(self):
        for engine, vw, vh in (("chromium", 360, 800), ("webkit", 390, 844)):
            ctx, page, cerr, perr = self._open_page(engine, vw, vh, username="vkan")
            try:
                self._navigate_tab(page, "schedule", "#schedule-page")
                hdr_box = page.locator("#schedule-page > .page-header").bounding_box()
                self.assertLessEqual(hdr_box["height"], 80)
                self.assertFalse(page.locator(".schedule-header-actions").is_visible())
                more_box = page.locator("#sched-mobile-more-btn").bounding_box()
                self.assertGreaterEqual(more_box["width"], 44)
                self.assertGreaterEqual(more_box["height"], 44)

                # Tap editable duty item (trucKhoa) -> Bottom Sheet picker -> sync trucKhoa <-> sieuAm
                page.locator('[data-sched-pos="trucKhoa"]').click()
                page.wait_for_selector("#modal .sched-duty-picker", timeout=5000)
                sel_metrics = page.evaluate(
                    """() => {
                        const s = document.getElementById('sched-picker-slot-0');
                        const q = document.getElementById('sched-picker-search');
                        return {
                            selFs: parseFloat(getComputedStyle(s).fontSize),
                            selH: s.getBoundingClientRect().height,
                            qFs: parseFloat(getComputedStyle(q).fontSize)
                        };
                    }"""
                )
                self.assertGreaterEqual(sel_metrics["selFs"], 16.0)
                self.assertGreaterEqual(sel_metrics["selH"], 44.0)
                self.assertGreaterEqual(sel_metrics["qFs"], 16.0)

                page.select_option("#sched-picker-slot-0", "2")
                page.locator("#sched-picker-apply-btn").click()
                page.wait_for_timeout(150)

                synced = page.evaluate(
                    """() => {
                        const dayIdx = SchedulePage._selectedMobileDayIdx || 0;
                        const dayKey = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][dayIdx];
                        const tk = document.querySelector(`.schedule-select[data-pos="trucKhoa"][data-cell="${dayKey}_0"]`)?.value;
                        const sa = document.querySelector(`.schedule-select[data-pos="sieuAm"][data-cell="${dayKey}_0"]`)?.value;
                        const saveDirty = document.getElementById('mobile-save-schedule-btn')?.classList.contains('is-dirty');
                        const myDots = document.querySelectorAll('.schedule-day-pill .sched-my-dot').length;
                        return { tk, sa, saveDirty, myDots };
                    }"""
                )
                self.assertEqual(synced["tk"], "2")
                self.assertEqual(synced["sa"], "2", "trucKhoa -> sieuAm auto-sync must run through onCellChange")
                self.assertTrue(synced["saveDirty"])
                self.assertGreaterEqual(synced["myDots"], 1)

                # Assign same staff to mo -> verify hard-block 🛑 conflict banner activates, then clear mo
                page.locator('[data-sched-pos="mo"]').click()
                page.wait_for_selector("#modal .sched-duty-picker", timeout=5000)
                page.select_option("#sched-picker-slot-0", "2")
                page.locator("#sched-picker-apply-btn").click()
                page.wait_for_timeout(150)
                banner_txt = page.locator(".schedule-conflict-banner").inner_text()
                self.assertIn("🛑", banner_txt)
                page.locator('[data-sched-pos="mo"]').click()
                page.wait_for_selector("#modal .sched-duty-picker", timeout=5000)
                page.select_option("#sched-picker-slot-0", "")
                page.locator("#sched-picker-apply-btn").click()
                page.wait_for_timeout(150)

                # Toggle Lịch của tôi
                page.locator('[data-sched-my-filter="1"]').click()
                self.assertGreaterEqual(page.locator(".sched-my-day-group").count(), 1)
                page.locator(".sched-view-btn").first.click()

                # Robot section collapsed on Mobile -> toggle Xem nhanh expands
                self.assertTrue(page.locator(".sched-robot-mobile-summary").is_visible())
                self.assertFalse(page.locator(".robot-surgery-card").is_visible())
                page.locator(".sched-robot-toggle-btn").click()
                self.assertTrue(page.locator(".robot-surgery-card").is_visible())

                # Header tools sheet
                page.locator("#sched-mobile-more-btn").click()
                page.wait_for_selector("#modal .sched-sheet-actions", timeout=5000)
                page.evaluate("() => Modal.close()")

                self._assert_no_overflow(page, f"schedule-{engine}-{vw}x{vh}")
                self.assertEqual(cerr, [])
                self.assertEqual(perr, [])
            finally:
                ctx.close()

        # Desktop preservation
        ctx, page, cerr, perr = self._open_page("chromium", 1440, 900, username="vkan")
        try:
            self._navigate_tab(page, "schedule", "#schedule-page")
            self.assertFalse(page.locator(".sched-mobile-hdr-tools").is_visible())
            self.assertFalse(page.locator(".sched-robot-mobile-summary").is_visible())
            self.assertTrue(page.locator(".schedule-header-actions").is_visible())
            self.assertTrue(page.locator(".schedule-table-wrap .schedule-table").is_visible())
            self._assert_no_overflow(page, "schedule-desktop-1440x900")
            self.assertEqual(cerr, [])
            self.assertEqual(perr, [])
        finally:
            ctx.close()

    def test_03_surgery_stats_mobile_and_desktop(self):
        for engine, vw, vh in (("chromium", 360, 800), ("webkit", 390, 844)):
            ctx, page, cerr, perr = self._open_page(engine, vw, vh, username="vkan")
            try:
                self._navigate_tab(page, "surgery-stats", "#surgery-stats-page")
                hdr_box = page.locator("#surgery-stats-page > .page-header.sstats-header").bounding_box()
                self.assertLessEqual(hdr_box["height"], 80)

                # Deduplicated Xuất hồ sơ bác sĩ button (only 1 inside #surgery-stats-page)
                self.assertEqual(page.locator('#surgery-stats-page [onclick*="exportProfileImage"]').count(), 1)
                self.assertFalse(page.locator(".sstats-header-actions").is_visible())

                # Doctor 2 collapsed by default on Mobile -> toggle expands
                self.assertFalse(page.locator(".sstats-doc-box-compare").is_visible())
                page.locator('[data-sstats-compare-toggle="1"]').click()
                self.assertTrue(page.locator(".sstats-doc-box-compare").is_visible())
                page.locator('[data-sstats-compare-toggle="1"]').click()
                self.assertFalse(page.locator(".sstats-doc-box-compare").is_visible())

                # 2x2 KPI grid when single & Radar SVG fits viewport
                kpi0 = page.locator(".sstats-compare-kpi-grid.is-single .sstats-compare-kpi-card").nth(0).bounding_box()
                kpi1 = page.locator(".sstats-compare-kpi-grid.is-single .sstats-compare-kpi-card").nth(1).bounding_box()
                self.assertLess(abs(kpi0["y"] - kpi1["y"]), 5, "Single-doctor KPI cards should form 2x2 grid on Mobile")
                radar_box = page.locator(".sstats-radar-svg").bounding_box()
                self.assertLessEqual(radar_box["width"], vw)

                # Logbook: filter sheet + mobile cards
                self.assertFalse(page.locator(".sstats-desktop-logbook-table").is_visible())
                self.assertGreaterEqual(page.locator(".sstats-mobile-logbook-cards .sstats-case-card").count(), 1)
                page.locator("#sstats-mobile-logbook-filter-btn").click()
                page.wait_for_selector("#modal .sstats-mfilter-form", timeout=5000)
                page.select_option("#sstats-mfilter-approach", "robot")
                page.locator('#modal .sstats-mfilter-footer .btn-primary').click()
                page.wait_for_timeout(150)
                self.assertIn("(1)", page.locator("#sstats-mobile-logbook-filter-btn").inner_text())
                self.assertGreaterEqual(page.locator(".sstats-mobile-logbook-cards .sstats-case-card").count(), 1)

                # Reset logbook filter via modal
                page.locator("#sstats-mobile-logbook-filter-btn").click()
                page.locator('#modal .sstats-mfilter-footer .btn-secondary').click()

                # Summary tab -> Ranking Cards -> tap opens Doctor Detail sheet
                page.locator(".sstats-view-tab").nth(1).click()
                page.wait_for_selector(".sstats-mobile-ranking-list .sstats-ranking-card", timeout=5000)
                self.assertFalse(page.locator(".sstats-desktop-summary-table").is_visible())
                page.locator(".sstats-mobile-ranking-list .sstats-ranking-card").first.click()
                page.wait_for_selector("#modal .sstats-mobile-doc-sheet", timeout=5000)
                page.evaluate("() => Modal.close()")

                self._assert_no_overflow(page, f"surgery-stats-{engine}-{vw}x{vh}")
                self.assertEqual(cerr, [])
                self.assertEqual(perr, [])
            finally:
                ctx.close()

        # Desktop preservation
        ctx, page, cerr, perr = self._open_page("chromium", 1440, 900, username="vkan")
        try:
            self._navigate_tab(page, "surgery-stats", "#surgery-stats-page")
            self.assertEqual(page.locator('#surgery-stats-page [onclick*="exportProfileImage"]').count(), 1)
            self.assertFalse(page.locator(".sstats-mobile-hdr-tools").is_visible())
            self.assertFalse(page.locator('[data-sstats-compare-toggle="1"]').is_visible())
            self.assertTrue(page.locator(".sstats-doc-box-compare").is_visible())
            self.assertTrue(page.locator(".sstats-desktop-logbook-table").is_visible())
            self.assertFalse(page.locator(".sstats-mobile-logbook-cards").is_visible())
            page.locator(".sstats-view-tab").nth(1).click()
            page.wait_for_selector(".sstats-desktop-summary-table", timeout=5000)
            self.assertTrue(page.locator(".sstats-desktop-summary-table").is_visible())
            self.assertFalse(page.locator(".sstats-mobile-ranking-list").is_visible())
            self._assert_no_overflow(page, "surgery-stats-desktop-1440x900")
            self.assertEqual(cerr, [])
            self.assertEqual(perr, [])
        finally:
            ctx.close()

    def test_04_research_shcm_mobile_and_desktop(self):
        # SuperAdmin on Mobile 360x800
        ctx, page, cerr, perr = self._open_page("chromium", 360, 800, username="vkan")
        try:
            self._navigate_tab(page, "research", "#research-page")
            hdr_box = page.locator("#research-page > .page-header").bounding_box()
            self.assertLessEqual(hdr_box["height"], 84)
            self.assertFalse(page.locator("#research-page .rsch-stats").is_visible())
            self.assertFalse(page.locator("#research-page .rsch-settings-card").is_visible())

            next_card = page.locator(".rsch-mobile-next-card")
            self.assertTrue(next_card.is_visible())
            self.assertIn("TME Robot", next_card.inner_text())

            more_btn = page.locator('[data-rsch-more="901"]')
            btn_box = more_btn.bounding_box()
            self.assertGreaterEqual(btn_box["width"], 44)
            self.assertGreaterEqual(btn_box["height"], 44)

            # 1-tap quick status change pending -> done
            more_btn.click()
            page.wait_for_selector("#modal .rsch-sheet-actions", timeout=5000)
            page.locator('[data-rsch-quick-status="done"]').click()
            page.wait_for_timeout(150)
            updated_st = page.evaluate("() => Store.getById('shcmSchedule', 901)?.status")
            self.assertEqual(updated_st, "done")
            # Restore back to pending as SuperAdmin so other checks can use #901 too
            page.evaluate("() => ResearchPage.setQuickStatus(901, 'pending')")

            # Mobile tools sheet -> Settings modal
            page.locator("#rsch-mobile-more-btn").click()
            page.wait_for_selector("#modal .rsch-sheet-actions", timeout=5000)
            page.locator('#modal [onclick*="openMobileSettingsSheet"]').click()
            page.wait_for_selector("#shcm-mobile-default-time", timeout=5000)
            t_fs = page.evaluate("() => parseFloat(getComputedStyle(document.getElementById('shcm-mobile-default-time')).fontSize)")
            self.assertGreaterEqual(t_fs, 16.0)
            page.evaluate("() => ResearchPage.saveMobileSettings()")

            self._assert_no_overflow(page, "research-mobile-vkan")
            self.assertEqual(cerr, [])
            self.assertEqual(perr, [])
        finally:
            ctx.close()

        # Non-SuperAdmin Admin lock guard check (nphuu)
        ctx, page, cerr, perr = self._open_page("webkit", 390, 844, username="nphuu")
        try:
            self._navigate_tab(page, "research", "#research-page")
            self.assertEqual(page.locator('[data-rsch-more="1"]').count(), 0, "Locked done item #1 must not expose ⋮ action to non-SuperAdmin")
            locked_status = page.evaluate(
                """() => {
                    ResearchPage.setQuickStatus(1, 'pending');
                    return Store.getById('shcmSchedule', 1)?.status;
                }"""
            )
            self.assertEqual(locked_status, "done", "setQuickStatus must strictly enforce done lock for non-SuperAdmin")

            # Pending/registered item #902 CAN be switched by Admin
            page.locator('[data-rsch-more="902"]').click()
            page.wait_for_selector("#modal .rsch-sheet-actions", timeout=5000)
            page.locator('[data-rsch-quick-status="pending"]').click()
            self.assertEqual(page.evaluate("() => Store.getById('shcmSchedule', 902)?.status"), "pending")
            self._assert_no_overflow(page, "research-webkit-nphuu")
            self.assertEqual(cerr, [])
            self.assertEqual(perr, [])
        finally:
            ctx.close()

        # Desktop preservation
        ctx, page, cerr, perr = self._open_page("chromium", 1440, 900, username="vkan")
        try:
            self._navigate_tab(page, "research", "#research-page")
            self.assertTrue(page.locator("#research-page .rsch-stats").is_visible())
            self.assertTrue(page.locator("#research-page .rsch-settings-card").is_visible())
            self.assertTrue(page.locator("#research-page .rsch-desktop-view .rsch-table").is_visible())
            self.assertFalse(page.locator(".rsch-mobile-hdr-tools").is_visible())
            self.assertFalse(page.locator(".rsch-mobile-next-card").is_visible())
            self._assert_no_overflow(page, "research-desktop-1440x900")
            self.assertEqual(cerr, [])
            self.assertEqual(perr, [])
        finally:
            ctx.close()

    def test_05_zero_overflow_and_dark_mode_matrix(self):
        matrix = [
            ("chromium", 360, 800, "light"),
            ("chromium", 360, 800, "dark"),
            ("chromium", 600, 900, "light"),
            ("chromium", 1440, 900, "light"),
            ("webkit", 390, 844, "light"),
            ("webkit", 390, 844, "dark"),
        ]
        tabs = [
            ("reports", "#reports-page"),
            ("schedule", "#schedule-page"),
            ("surgery-stats", "#surgery-stats-page"),
            ("research", "#research-page"),
        ]
        for engine, vw, vh, theme in matrix:
            ctx, page, cerr, perr = self._open_page(engine, vw, vh, username="vkan", theme=theme)
            try:
                if theme == "dark":
                    self.assertEqual(page.evaluate("() => document.documentElement.getAttribute('data-theme')"), "dark")
                for tab_name, sel in tabs:
                    self._navigate_tab(page, tab_name, sel)
                    page.wait_for_timeout(80)
                    self._assert_no_overflow(page, f"{engine}-{vw}x{vh}-{theme}-{tab_name}")
                    if theme == "dark" and vw <= 768:
                        bg = page.evaluate(f"() => getComputedStyle(document.querySelector('{sel} > .page-header')).backgroundImage")
                        self.assertIn("12, 16, 34", bg, f"Expected #0C1022 Dark header gradient on {tab_name} ({engine}), got: {bg}")
                self.assertEqual(cerr, [], f"Console errors on {engine} {vw}x{vh} {theme}: {cerr}")
                self.assertEqual(perr, [], f"Page errors on {engine} {vw}x{vh} {theme}: {perr}")
            finally:
                ctx.close()

    def test_06_mobile_navy_headers_white_text_contrast(self):
        all_tabs = [
            ("dashboard", "#dashboard-page"),
            ("staff-tracking", "#staff-tracking-page"),
            ("rooms", "#rooms-page-container"),
            ("reports", "#reports-page"),
            ("schedule", "#schedule-page"),
            ("surgery-stats", "#surgery-stats-page"),
            ("research", "#research-page"),
        ]
        for engine, vw, vh in (("chromium", 360, 800), ("webkit", 390, 844)):
            for theme in ("light", "dark"):
                ctx, page, cerr, perr = self._open_page(engine, vw, vh, username="vkan", theme=theme)
                try:
                    for tab_name, sel in all_tabs:
                        self._navigate_tab(page, tab_name, sel)
                        styles = page.evaluate(
                            f"""() => {{
                                const t = document.querySelector('{sel} > .page-header .page-title');
                                const cs = getComputedStyle(t);
                                const res = {{
                                    fill: cs.webkitTextFillColor,
                                    color: cs.color,
                                    bgImg: cs.backgroundImage
                                }};
                                const pill = document.querySelector('{sel} .st-hdr-ratio-pill');
                                if (pill) {{
                                    const pcs = getComputedStyle(pill);
                                    res.pillFill = pcs.webkitTextFillColor;
                                    res.pillColor = pcs.color;
                                }}
                                const rmMob = document.querySelector('{sel} .rm-title-mobile');
                                if (rmMob) {{
                                    const rcs = getComputedStyle(rmMob);
                                    res.rmFill = rcs.webkitTextFillColor;
                                    res.rmColor = rcs.color;
                                }}
                                return res;
                            }}"""
                        )
                        self.assertEqual(styles["fill"], "rgb(255, 255, 255)", f"{tab_name} ({engine}/{theme}) fill={styles['fill']}")
                        self.assertEqual(styles["color"], "rgb(255, 255, 255)", f"{tab_name} ({engine}/{theme}) color={styles['color']}")
                        self.assertEqual(styles["bgImg"], "none", f"{tab_name} ({engine}/{theme}) bgImg={styles['bgImg']}")
                        if "pillFill" in styles:
                            self.assertEqual(styles["pillFill"], "rgb(255, 255, 255)")
                            self.assertEqual(styles["pillColor"], "rgb(255, 255, 255)")
                        if "rmFill" in styles:
                            self.assertEqual(styles["rmFill"], "rgb(255, 255, 255)")
                            self.assertEqual(styles["rmColor"], "rgb(255, 255, 255)")
                    self.assertEqual(cerr, [])
                    self.assertEqual(perr, [])
                finally:
                    ctx.close()

        # Desktop Light Mode preserves gradient .page-title
        ctx, page, cerr, perr = self._open_page("chromium", 1440, 900, username="vkan", theme="light")
        try:
            self._navigate_tab(page, "reports", "#reports-page")
            desk = page.evaluate(
                """() => {
                    const cs = getComputedStyle(document.querySelector('#reports-page > .page-header .page-title'));
                    return { fill: cs.webkitTextFillColor, bgImg: cs.backgroundImage };
                }"""
            )
            self.assertNotEqual(desk["bgImg"], "none")
            self.assertEqual(desk["fill"], "rgba(0, 0, 0, 0)")
            self.assertEqual(cerr, [])
            self.assertEqual(perr, [])
        finally:
            ctx.close()


if __name__ == "__main__":
    unittest.main()
