#!/usr/bin/env python3
"""Automated E2E & API tests for FEAT-248: Dual Form-Factor Weekly Surgery Modal (Mobile & Laptop)."""

from __future__ import annotations

import copy
import importlib
import json
import os
import pathlib
import re
import shutil
import sys
import tempfile
import unittest
import uuid
from datetime import datetime, timedelta, timezone

from playwright.sync_api import sync_playwright

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
INDEX_URL = (REPO_ROOT / "index.html").as_uri()
DB_PATH = REPO_ROOT / "data" / "db.json"


def _load_db_json() -> dict:
    if DB_PATH.exists():
        return json.loads(DB_PATH.read_text(encoding="utf-8"))
    return {"staff": [], "patients": [], "surgeries": [], "schedules": {}, "externalDoctors": []}


def _iso_offset(days_delta: int) -> str:
    vn_now = datetime.now(timezone(timedelta(hours=7))).date() + timedelta(days=days_delta)
    return vn_now.isoformat()


class TestFeat248SurgeryFormUx(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._orig_env = {
            k: os.environ.get(k)
            for k in ("PTDTT_DATA_DIR", "PTDTT_LOG_DIR", "JWT_SECRET", "PTDTT_TESTING")
        }
        cls.tmp_root_obj = tempfile.TemporaryDirectory(prefix="ptdtt_feat248_suite_")
        cls.tmp_root = pathlib.Path(cls.tmp_root_obj.name)

        boot_dir = cls.tmp_root / "boot"
        (boot_dir / "data").mkdir(parents=True, exist_ok=True)
        (boot_dir / "logs").mkdir(parents=True, exist_ok=True)
        (boot_dir / "data" / "db.json").write_text("{}", encoding="utf-8")
        (boot_dir / "data" / "auth.json").write_text('{"users":{}}', encoding="utf-8")

        os.environ["PTDTT_DATA_DIR"] = str(boot_dir / "data")
        os.environ["PTDTT_LOG_DIR"] = str(boot_dir / "logs")
        os.environ["JWT_SECRET"] = "feat248-unit-test-secret-2026-ptdtt"
        os.environ["PTDTT_TESTING"] = "1"

        if str(REPO_ROOT) not in sys.path:
            sys.path.insert(0, str(REPO_ROOT))
        if "server_flask" in sys.modules:
            cls.sf = importlib.reload(sys.modules["server_flask"])
        else:
            cls.sf = importlib.import_module("server_flask")
        cls.eng = importlib.import_module("surgery_approval_engine")
        cls.sroutes = importlib.import_module("surgery_approval_routes")
        cls.src_db = _load_db_json()
        cls.cat_data = cls.eng.load_procedure_catalog(REPO_ROOT / "data", REPO_ROOT)
        cls.pw_hash = cls.sf._hash_password("SurgForm2026!")

        sw_m = re.search(r"SW_BUILD_VER\s*=\s*'(\d+)'", (REPO_ROOT / "index.html").read_text(encoding="utf-8"))
        cls.sw_build_ver = sw_m.group(1) if sw_m else "2611280624"

        cls.pw = sync_playwright().start()
        cls.browsers = {
            "chromium": cls.pw.chromium.launch(headless=True),
            "webkit": cls.pw.webkit.launch(headless=True),
        }

    @classmethod
    def tearDownClass(cls):
        for b in cls.browsers.values():
            try:
                b.close()
            except Exception:
                pass
        try:
            cls.pw.stop()
        except Exception:
            pass
        for k, val in cls._orig_env.items():
            if val is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = val
        cls.tmp_root_obj.cleanup()

    def _new_flask_client(self):
        case_dir = self.tmp_root / f"api_{uuid.uuid4().hex[:8]}"
        data_dir = case_dir / "data"
        log_dir = case_dir / "logs"
        data_dir.mkdir(parents=True, exist_ok=True)
        log_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(
            REPO_ROOT / "data" / "procedure_catalog_2026_v1.json",
            data_dir / "procedure_catalog_2026_v1.json",
        )
        cfg = copy.deepcopy(self.eng.DEFAULT_SURGERY_APPROVAL_CONFIG)
        cfg["rolloutAccessMode"] = "superadmin_only"
        db_payload = {
            "_version": 12,
            "staff": copy.deepcopy(self.src_db.get("staff") or []),
            "externalDoctors": copy.deepcopy(self.src_db.get("externalDoctors") or []),
            "surgeries": [],
            "surgeriesTrash": [],
            "surgeryApprovalConfig": cfg,
            "nextIds": {"staff": 100, "surgeries": 1001, "notifications": 1},
            "_revisions": {"staff": 1, "surgeries": 1, "surgeriesTrash": 1},
        }
        (data_dir / "db.json").write_text(json.dumps(db_payload, ensure_ascii=False), encoding="utf-8")
        users = {
            "bstrung": {
                "passwordHash": self.pw_hash,
                "name": "Võ Nguyên Trung",
                "title": "ThS. BS.",
                "role": "Bác sĩ chính",
                "staffId": 7,
                "isAdmin": False,
                "isSuperAdmin": False,
                "disabled": False,
                "mustChangePassword": False,
                "sessionEpoch": 1,
            }
        }
        (data_dir / "auth.json").write_text(json.dumps({"users": users}, ensure_ascii=False), encoding="utf-8")

        self.sf.DATA_DIR = data_dir
        self.sf.BASE_DIR = case_dir
        self.sf.DATA_FILE = data_dir / "db.json"
        self.sf.AUTH_FILE = data_dir / "auth.json"
        self.sf.LOG_DIR = log_dir
        client = self.sf.app.test_client()
        tok = self.sf._create_jwt("bstrung", users["bstrung"])
        return client, tok

    def _open_app_page(self, browser_name: str, width: int, height: int, *, dark: bool = False):
        browser = self.browsers[browser_name]
        context = browser.new_context(viewport={"width": width, "height": height})
        db_copy = copy.deepcopy(self.src_db)
        # Ensure at least a couple of history entries exist for autocomplete test
        base_surgeries = db_copy.get("surgeries") or []
        if len(base_surgeries) < 2:
            base_surgeries.extend([
                {
                    "id": 999101,
                    "patientName": "Nguyễn Văn Test A",
                    "birthYear": 1965,
                    "date": _iso_offset(1),
                    "surgeryType": "chuongtrinh",
                    "approachType": "noisoi",
                    "diagnosis": "Ung thư đại tràng Sigma cT3N1M0",
                    "method": "Phẫu thuật nội soi cắt đại tràng Sigma + nạo vét hạch",
                    "duration": 150,
                    "mainSurgeon": 2,
                },
                {
                    "id": 999102,
                    "patientName": "Trần Thị Test B",
                    "birthYear": 1972,
                    "date": _iso_offset(1),
                    "surgeryType": "chuongtrinh",
                    "approachType": "mo",
                    "diagnosis": "Rò hậu môn phức tạp",
                    "method": "Phẫu thuật cắt đường rò hậu môn",
                    "duration": 60,
                    "mainSurgeon": 10,
                },
            ])
            db_copy["surgeries"] = base_surgeries

        db_raw = json.dumps(db_copy, ensure_ascii=False)
        cat_raw = json.dumps(
            {
                "catalogVersion": self.cat_data.get("catalogVersion", "2026.v1"),
                "procedures": self.cat_data.get("procedures") or [],
                "attendingColumns": (self.cat_data.get("privilegeMatrix") or {}).get("attendingColumns") or {},
                "robotCertifiedStaffIds": (self.cat_data.get("privilegeMatrix") or {}).get("robotCertifiedStaffIds") or [1],
                "overColumnPolicy": (self.cat_data.get("privilegeMatrix") or {}).get("overColumnPolicy") or {},
            },
            ensure_ascii=False,
        )
        context.add_init_script(
            f"""
            const sessionObj = {{
                staffId: 2,
                username: 'vukhuongan',
                name: 'BSCKII. Vũ Khương An',
                role: 'Phó trưởng khoa',
                isAdmin: true,
                isSuperAdmin: true
            }};
            localStorage.setItem('ptdtt_cache_ver', '2609281105');
            localStorage.setItem('ptdtt_sw_build', '{self.sw_build_ver}');
            localStorage.setItem('ptdtt_icon_guide_v261121_dismissed', '1');
            localStorage.setItem('ptdtt_data', {json.dumps(db_raw)});
            localStorage.setItem('ptdtt_auth', JSON.stringify(sessionObj));
            localStorage.setItem('ptdtt_session', JSON.stringify(sessionObj));
            sessionStorage.setItem('ptdtt_session', JSON.stringify(sessionObj));
            if ({'true' if dark else 'false'}) {{
                localStorage.setItem('ptdtt_theme', 'dark');
                document.documentElement.setAttribute('data-theme', 'dark');
            }} else {{
                localStorage.setItem('ptdtt_theme', 'light');
                document.documentElement.removeAttribute('data-theme');
            }}
            """
        )
        page = context.new_page()
        page.goto(INDEX_URL, wait_until="load")
        page.evaluate(
            f"""() => {{
                const style = document.createElement('style');
                style.textContent = '#modal, #modal-overlay {{ transition: none !important; animation: none !important; transform: none !important; }}';
                document.head.appendChild(style);
                const loginOverlay = document.getElementById('login-overlay');
                if (loginOverlay) loginOverlay.style.display = 'none';
                const loginPage = document.getElementById('login-page');
                if (loginPage) loginPage.style.display = 'none';
                const appEl = document.getElementById('app');
                if (appEl) appEl.style.display = '';
                if ({'true' if dark else 'false'}) {{
                    document.documentElement.setAttribute('data-theme', 'dark');
                }}
                const session = {{
                    staffId: 2,
                    username: 'vukhuongan',
                    name: 'BSCKII. Vũ Khương An',
                    role: 'Phó trưởng khoa',
                    isAdmin: true,
                    isSuperAdmin: true
                }};
                if (typeof Auth !== 'undefined') {{
                    Auth.getSession = () => session;
                    Auth.isLoggedIn = () => true;
                    Auth.canEdit = () => true;
                    Auth.isAdmin = () => true;
                    Auth.isSuperAdmin = () => true;
                    Auth.getRole = () => 'Phó trưởng khoa';
                }}
                if (typeof Store !== 'undefined' && Store.init) {{
                    Store.init();
                    Store._data = Object.assign(Store._data || {{}}, JSON.parse({json.dumps(db_raw)}));
                }}
                if (typeof SurgeryPage !== 'undefined') {{
                    SurgeryPage._procedureCatalogCache = {cat_raw};
                }}
            }}"""
        )
        return context, page

    def test_01_public_auth_procedure_catalog_endpoint(self):
        """TC-248-01: GET /api/surgery/procedure-catalog allows regular authenticated doctors even when rollout is superadmin_only, and rejects unauthenticated."""
        client, tok = self._new_flask_client()
        unauth = client.get("/api/surgery/procedure-catalog")
        self.assertEqual(unauth.status_code, 401)

        resp = client.get(
            "/api/surgery/procedure-catalog",
            headers={"Authorization": f"Bearer {tok}"},
        )
        self.assertEqual(resp.status_code, 200, resp.get_data(as_text=True))
        data = resp.get_json()
        self.assertGreaterEqual(len(data.get("procedures") or []), 300)
        self.assertEqual(len(data.get("attendingColumns") or {}), 11)
        self.assertIn(1, data.get("robotCertifiedStaffIds") or [])

    def test_02_one_touch_controls_and_robot_lock_sync(self):
        """TC-248-02: Segmented surgeryType, 4 approach buttons, day chips, and duration chips sync 2-way with form inputs."""
        ctx, page = self._open_app_page("chromium", 1440, 900)
        try:
            res = page.evaluate(
                """() => {
                    const baseDate = SurgeryPage.dateStr(SurgeryPage.getWeekDates()[1]); // T3
                    SurgeryPage.openForm(null, baseDate);
                    document.querySelector('.surg-seg-btn[data-surg-type="yeucau"]').click();
                    document.querySelector('.surg-approach-btn[data-approach="noisoi"]').click();
                    const thuChip = document.querySelectorAll('.surg-day-chip')[3]; // T5
                    const expectedThu = thuChip.dataset.date;
                    thuChip.click();
                    document.querySelector('.surg-dur-chip[data-dur="90"]').click();

                    const afterTap = {
                        surgeryType: document.querySelector('select[name="surgeryType"]').value,
                        approachType: document.getElementById('surgery-approach').value,
                        date: document.querySelector('input[name="date"]').value,
                        expectedThu,
                        duration: document.querySelector('input[name="duration"]').value,
                    };

                    // Selecting Robot surgeryType locks approachType = robot
                    document.querySelector('.surg-seg-btn[data-surg-type="robot"]').click();
                    const robotState = {
                        approachType: document.getElementById('surgery-approach').value,
                        approachDisabled: document.getElementById('surgery-approach').disabled,
                        moBtnDisabled: document.querySelector('.surg-approach-btn[data-approach="mo"]').disabled,
                    };
                    return { afterTap, robotState };
                }"""
            )
            self.assertEqual(res["afterTap"]["surgeryType"], "yeucau")
            self.assertEqual(res["afterTap"]["approachType"], "noisoi")
            self.assertEqual(res["afterTap"]["date"], res["afterTap"]["expectedThu"])
            self.assertEqual(res["afterTap"]["duration"], "90")
            self.assertEqual(res["robotState"]["approachType"], "robot")
            self.assertTrue(res["robotState"]["approachDisabled"])
            self.assertTrue(res["robotState"]["moBtnDisabled"])
        finally:
            ctx.close()

    def test_03_doctor_chip_picker_no_autoprefill_and_search(self):
        """TC-248-03: No auto-prefill of mainSurgeon/assistSurgeon1; accent-insensitive search & External Doctors tab work."""
        ctx, page = self._open_app_page("chromium", 1440, 900)
        try:
            res = page.evaluate(
                """() => {
                    SurgeryPage.openForm();
                    const initMain = document.querySelector('select[name="mainSurgeon"]').value;
                    const initAssist = document.querySelector('select[name="assistSurgeon1"]').value;

                    // Click chip id=1 (TS. Hữu)
                    document.querySelector('#surg-doc-chips-mainSurgeon .surg-doc-chip[data-doc-id="1"]').click();
                    const pickedId1 = document.querySelector('select[name="mainSurgeon"]').value;

                    // Search accent-insensitive "khuong an"
                    const searchInp = document.querySelector('.surg-doc-picker[data-target="mainSurgeon"] .surg-doc-search');
                    searchInp.value = 'khuong an';
                    searchInp.dispatchEvent(new Event('input', { bubbles: true }));
                    const filteredChips = Array.from(document.querySelectorAll('#surg-doc-chips-mainSurgeon .surg-doc-chip')).map(el => el.dataset.docId);

                    // Clear search and switch to Ngoài khoa tab
                    searchInp.value = '';
                    searchInp.dispatchEvent(new Event('input', { bubbles: true }));
                    document.querySelector('.surg-doc-picker[data-target="mainSurgeon"] .surg-doc-tab[data-tab="ext"]').click();
                    const extCount = document.querySelectorAll('#surg-doc-chips-mainSurgeon .surg-doc-chip').length;
                    return { initMain, initAssist, pickedId1, filteredChips, extCount };
                }"""
            )
            self.assertEqual(res["initMain"], "")
            self.assertEqual(res["initAssist"], "")
            self.assertEqual(res["pickedId1"], "1")
            self.assertIn("2", res["filteredChips"])
            self.assertGreaterEqual(res["extCount"], 1)
        finally:
            ctx.close()

    def test_04_independent_autocomplete_keyboard_navigation(self):
        """TC-248-04: Diagnosis & Method autocompletes work independently; Enter selects without submit; Escape closes dropdown without closing modal."""
        ctx, page = self._open_app_page("chromium", 1440, 900)
        try:
            page.evaluate(
                """() => {
                    SurgeryPage.openForm();
                    document.querySelector('.surg-approach-btn[data-approach="noisoi"]').click();
                }"""
            )
            diag_inp = page.locator('#modal input[name="diagnosis"]')
            diag_inp.click()
            diag_inp.fill("ung thu")
            page.wait_for_selector("#surg-ac-diagnosis .surg-ac-item", state="visible")
            diag_inp.press("Enter")

            method_inp = page.locator('#modal input[name="method"]')
            method_inp.click()
            method_inp.fill("cat dai trang")
            page.wait_for_selector("#surg-ac-method .surg-ac-item", state="visible")
            ac_method_count = page.locator("#surg-ac-method .surg-ac-item").count()
            method_inp.press("Escape")

            state = page.evaluate(
                """() => ({
                    modalActive: document.getElementById('modal-overlay').classList.contains('active'),
                    diagnosisVal: document.querySelector('#modal input[name="diagnosis"]').value,
                    methodVal: document.querySelector('#modal input[name="method"]').value,
                    methodAcHidden: document.getElementById('surg-ac-method').hidden,
                })"""
            )
            self.assertGreater(ac_method_count, 0)
            self.assertTrue(state["modalActive"], "Escape on autocomplete closed entire modal!")
            self.assertIn("Ung thư", state["diagnosisVal"])
            self.assertEqual(state["methodVal"], "cat dai trang")
            self.assertTrue(state["methodAcHidden"])
        finally:
            ctx.close()

    def test_05_non_blocking_column_hint_still_saves(self):
        """TC-248-05: Soft column mismatch warns without blocking save; certified Robot shows ok badge."""
        ctx, page = self._open_app_page("chromium", 1440, 900)
        try:
            res = page.evaluate(
                """() => {
                    const targetDate = SurgeryPage.dateStr(SurgeryPage.getWeekDates()[2]);
                    SurgeryPage.openForm(null, targetDate);

                    // Select Col III surgeon (id=10, BS. Trần Minh Đức) + PT-ĐB procedure + noisoi
                    document.querySelector('.surg-approach-btn[data-approach="noisoi"]').click();
                    document.querySelector('#surg-doc-chips-mainSurgeon .surg-doc-chip[data-doc-id="10"]').click();
                    const methodInp = document.querySelector('#modal input[name="method"]');
                    methodInp.value = 'Cắt thực quản nội soi ngực và bụng';
                    methodInp.dataset.matchedClass = 'PT-ĐB';
                    SurgeryPage._updateColumnHint();
                    const warnClass = document.getElementById('surg-column-hint').className;
                    const warnText = document.getElementById('surg-column-hint').textContent;

                    // Test save STILL works despite soft warning!
                    document.querySelector('#modal input[name="patientName"]').value = 'Bệnh Nhân Vượt Cột Mềm';
                    document.querySelector('#modal input[name="birthYear"]').value = '1970';
                    document.getElementById('surg-submit-primary-btn').click();
                    const savedAfterWarn = Store.getAll('surgeries').some(x => (x.patientName || '').includes('Vượt Cột Mềm'));

                    // Also test Robot certified badge with id=1 (TS. Hữu)
                    SurgeryPage.openForm(null, targetDate);
                    document.querySelector('.surg-seg-btn[data-surg-type="robot"]').click();
                    document.querySelector('#surg-doc-chips-mainSurgeon .surg-doc-chip[data-doc-id="1"]').click();
                    const okClass = document.getElementById('surg-column-hint').className;
                    return { warnClass, warnText, savedAfterWarn, okClass };
                }"""
            )
            self.assertIn("is-warn", res["warnClass"])
            self.assertIn("PT-ĐB", res["warnText"])
            self.assertTrue(res["savedAfterWarn"], "Soft column warning must NEVER block save")
            self.assertIn("is-ok", res["okClass"])
        finally:
            ctx.close()

    def test_06_mobile_declutter_touch_targets_and_zero_overflow(self):
        """TC-248-06: Android 360x800 & iPhone Air 420x912 keep optional collapsed, >=44px chips, 0 horizontal overflow, equal date/text widths."""
        for browser_name in ("webkit", "chromium"):
            for w, h in ((360, 800), (420, 912)):
                with self.subTest(browser=browser_name, viewport=f"{w}x{h}"):
                    ctx, page = self._open_app_page(browser_name, w, h)
                    try:
                        metrics = page.evaluate(
                            """() => {
                                SurgeryPage.openForm();
                                const mb = document.getElementById('modal-body');
                                const form = mb.querySelector('form');
                                const optOpen = document.getElementById('surg-optional-details').open;
                                const assistCollapsed = document.getElementById('surg-assist-picker-body').classList.contains('is-collapsed-mobile');
                                const touchTargets = Array.from(form.querySelectorAll('.surg-seg-btn, .surg-approach-btn, .surg-day-chip, .surg-dur-chip, #surg-doc-chips-mainSurgeon .surg-doc-chip'));
                                const minBtnH = Math.min(...touchTargets.map(el => el.getBoundingClientRect().height));
                                const pRect = form.querySelector('input[name="patientName"]').getBoundingClientRect();
                                const dRect = form.querySelector('input[type="date"][name="date"]').getBoundingClientRect();
                                return {
                                    optOpen,
                                    assistCollapsed,
                                    minBtnH: Math.round(minBtnH * 10) / 10,
                                    dateDiff: Math.round(Math.abs(pRect.width - dRect.width) * 10) / 10,
                                    mbOverflow: mb.scrollWidth - mb.clientWidth,
                                    formOverflow: form.scrollWidth - form.clientWidth,
                                };
                            }"""
                        )
                        self.assertFalse(metrics["optOpen"], "Optional details should be collapsed by default on mobile new case")
                        self.assertTrue(metrics["assistCollapsed"], "Assist surgeon picker should be collapsed on mobile when empty")
                        self.assertGreaterEqual(metrics["minBtnH"], 43.5, f"Touch target below 44px: {metrics}")
                        self.assertLessEqual(metrics["dateDiff"], 1.5, f"date vs patientName width diff: {metrics}")
                        self.assertLessEqual(metrics["mbOverflow"], 1, f"modal-body horizontal overflow: {metrics}")
                        self.assertLessEqual(metrics["formOverflow"], 1, f"form horizontal overflow: {metrics}")
                    finally:
                        ctx.close()

    def test_07_save_and_add_next_batch_entry(self):
        """TC-248-07: Lưu & thêm ca tiếp saves case 1, keeps modal open on same date, clears patient/clinical/surgeon fields."""
        ctx, page = self._open_app_page("chromium", 1440, 900)
        try:
            res = page.evaluate(
                """() => {
                    const targetDate = SurgeryPage.dateStr(SurgeryPage.getWeekDates()[4]); // T6
                    SurgeryPage.openForm(null, targetDate);
                    document.querySelector('#modal input[name="patientName"]').value = 'Bệnh Nhân Batch Một';
                    document.querySelector('#modal input[name="birthYear"]').value = '1975';
                    document.querySelector('.surg-approach-btn[data-approach="mo"]').click();
                    document.querySelector('#surg-doc-chips-mainSurgeon .surg-doc-chip[data-doc-id="2"]').click();
                    document.querySelector('#modal input[name="diagnosis"]').value = 'Trĩ hỗn hợp độ III';
                    document.querySelector('#modal input[name="method"]').value = 'Phẫu thuật cắt trĩ Longo';

                    document.getElementById('surg-submit-add-next-btn').click();

                    const allSurgeries = Store.getAll('surgeries');
                    const savedCase = allSurgeries.find(x => (x.patientName || '').includes('Batch Một'));
                    return {
                        saved: Boolean(savedCase),
                        modalStillOpen: document.getElementById('modal-overlay').classList.contains('active'),
                        nextDate: document.querySelector('#modal input[name="date"]').value,
                        expectedDate: targetDate,
                        nextName: document.querySelector('#modal input[name="patientName"]').value,
                        nextMainSurgeon: document.querySelector('#modal select[name="mainSurgeon"]').value,
                        nextDiagnosis: document.querySelector('#modal input[name="diagnosis"]').value,
                        nextMethod: document.querySelector('#modal input[name="method"]').value,
                    };
                }"""
            )
            self.assertTrue(res["saved"])
            self.assertTrue(res["modalStillOpen"])
            self.assertEqual(res["nextDate"], res["expectedDate"])
            self.assertEqual(res["nextName"], "")
            self.assertEqual(res["nextMainSurgeon"], "")
            self.assertEqual(res["nextDiagnosis"], "")
            self.assertEqual(res["nextMethod"], "")
        finally:
            ctx.close()

    def test_08_robot_linked_case_approach_lock_preserved(self):
        """TC-248-08: Editing a surgery linked to Robot Coordination preserves .rbt-dirty-banner and locks approach."""
        ctx, page = self._open_app_page("chromium", 1440, 900)
        try:
            res = page.evaluate(
                """() => {
                    const d = SurgeryPage.dateStr(SurgeryPage.getWeekDates()[1]);
                    const all = Store.getAll('surgeries');
                    all.push({
                        id: 888901,
                        patientName: 'Bệnh Nhân Robot Linked',
                        birthYear: 1966,
                        date: d,
                        surgeryType: 'robot',
                        approachType: 'robot',
                        robotCaseId: 'RBT-TEST-001',
                        mainSurgeon: 1,
                    });
                    Store._data.surgeries = all;
                    SurgeryPage.openForm(888901);
                    return {
                        hasBanner: Boolean(document.querySelector('#modal .rbt-dirty-banner')),
                        approachVal: document.getElementById('surgery-approach').value,
                        approachDisabled: document.getElementById('surgery-approach').disabled,
                        moBtnDisabled: document.querySelector('.surg-approach-btn[data-approach="mo"]').disabled,
                    };
                }"""
            )
            self.assertTrue(res["hasBanner"])
            self.assertEqual(res["approachVal"], "robot")
            self.assertTrue(res["approachDisabled"])
            self.assertTrue(res["moBtnDisabled"])
        finally:
            ctx.close()


if __name__ == "__main__":
    unittest.main()
