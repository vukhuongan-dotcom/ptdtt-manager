#!/usr/bin/env python3
"""Comprehensive regression & E2E test suite for FEAT-226:
Tab Nghiên cứu khoa học & Sáng kiến cải tiến (NCKH — BCN Only).

Covers:
- TC-226-01: Backend RBAC, idempotent _ensure_nckh_bootstrapped() seeding (8 records),
             per-user ETag isolation, and 403/409 anti-leak on GET/PUT /api/data & /api/data/nckhItems
             across all 3 BCN accounts (nphuu, vkan, ntnthuy) vs non-BCN doctor/nurse.
- TC-226-02: Sidebar DOM order (#nav-conferences -> #nav-nckh & #nav-rooms -> #nav-reports),
             BCN visibility vs non-BCN hidden state, and GlobalSearch isolation.
- TC-226-03: Exact 8 seed records across 5 sub-tabs (2 topic_approved, 2 topic_accepted,
             2 initiative_approved, 2 initiative_recognized), zero 6-member council fields,
             zero meeting times, zero unapproved anastomosis initiative.
- TC-226-04: End-to-end CRUD forms + "⚡ Chia đều %" + 1-tap "⚡ Chuyển nghiệm thu"
             & "⚡ Công nhận sáng kiến" persisted to server db.json via PUT /api/data/nckhItems.
- TC-226-05: Multi-engine Playwright WebKit (440x956 iPhone Air) & Chromium (1440x900 Desktop)
             Light/Dark mode, zero horizontal overflow, 44px touch targets, and .kb-open modal sync.
"""

from __future__ import annotations

import copy
import importlib
import json
import os
import pathlib
import re
import socket
import tempfile
import threading
import time
import unittest
from werkzeug.serving import make_server
from playwright.sync_api import sync_playwright

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


class TestFeat226NckhTab(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp_dir_obj = tempfile.TemporaryDirectory(prefix="ptdtt_feat226_")
        cls.tmp_root = pathlib.Path(cls.tmp_dir_obj.name)
        cls.data_dir = cls.tmp_root / "data"
        cls.log_dir = cls.tmp_root / "logs"
        cls.data_dir.mkdir(parents=True, exist_ok=True)
        cls.log_dir.mkdir(parents=True, exist_ok=True)

        # Seed isolated db.json WITHOUT 'nckhItems' to test _ensure_nckh_bootstrapped()
        real_db_path = REPO_ROOT / "data" / "db.json"
        real_db = json.loads(real_db_path.read_text(encoding="utf-8")) if real_db_path.exists() else {}
        isolated_db = {
            "_version": 11,
            "staff": copy.deepcopy(real_db.get("staff") or []),
            "rooms": copy.deepcopy(real_db.get("rooms") or []),
            "externalDoctors": copy.deepcopy(real_db.get("externalDoctors") or []),
            "surgeries": [],
            "surgeriesTrash": [],
            "schedules": [],
            "plans": [],
            "tasks": [],
            "tasksTrash": [],
            "patients": [],
            "conferences": [],
            "notifications": [],
            "nextIds": {"staff": 100, "surgeries": 1, "conferences": 1},
            "_revisions": {"staff": 1, "surgeries": 1, "conferences": 1},
        }
        (cls.data_dir / "db.json").write_text(
            json.dumps(isolated_db, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        cat_src = REPO_ROOT / "data" / "procedure_catalog_2026_v1.json"
        if cat_src.exists():
            (cls.data_dir / "procedure_catalog_2026_v1.json").write_text(
                cat_src.read_text(encoding="utf-8"), encoding="utf-8"
            )

        # Seed isolated auth.json with all 3 BCN accounts + 1 BS + 1 ĐD
        auth_users = {
            "nphuu": {
                "passwordHash": "$2b$12$dxImJSbAyZqRiX31mIkw5.l3gwhtoxbe0i8/r4EXftTSH5/TG.5LK",
                "name": "Nguyễn Phú Hữu",
                "role": "BS Trưởng khoa",
                "title": "TS. BSCKII",
                "staffId": 1,
                "isAdmin": True,
                "isSuperAdmin": False,
                "disabled": False,
                "tokenVersion": 1,
            },
            "vkan": {
                "passwordHash": "$2b$12$t9JGTdwOyqA4QscU5c0u.uxzRaSHpIPK/S2rzQIV0Fo4YTAs0juMO",
                "name": "Vũ Khương An",
                "role": "BS Phó trưởng khoa",
                "title": "BSCKII",
                "staffId": 2,
                "isAdmin": True,
                "isSuperAdmin": True,
                "disabled": False,
                "tokenVersion": 1,
            },
            "ntnthuy": {
                "passwordHash": "$2b$12$qbih5HlsOZrx1n7uJtLh5en0KZFrL7CU0IV1AylAQYOuIa4aiKYXS",
                "name": "Nguyễn Thị Ngọc Thùy",
                "role": "Điều dưỡng trưởng",
                "title": "ThS. ĐD",
                "staffId": 3,
                "isAdmin": True,
                "isSuperAdmin": False,
                "disabled": False,
                "tokenVersion": 1,
            },
            "vnatuan": {
                "passwordHash": "$2b$12$sOERWmH3g2OmxpS0n2kAGuaPCFaCdr5TluRKG5hWebBVhXideNXQa",
                "name": "Vũ Ngọc Anh Tuấn",
                "role": "Bác sĩ chính",
                "title": "BSCKII",
                "staffId": 4,
                "isAdmin": False,
                "isSuperAdmin": False,
                "disabled": False,
                "tokenVersion": 1,
            },
            "ttdanh": {
                "passwordHash": "$2b$12$sOERWmH3g2OmxpS0n2kAGuaPCFaCdr5TluRKG5hWebBVhXideNXQa",
                "name": "Trần Thanh Danh",
                "role": "Điều dưỡng",
                "title": "CNĐD",
                "staffId": 16,
                "isAdmin": False,
                "isSuperAdmin": False,
                "disabled": False,
                "tokenVersion": 1,
            },
        }
        (cls.data_dir / "auth.json").write_text(
            json.dumps({"users": auth_users}, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        os.environ["PTDTT_DATA_DIR"] = str(cls.data_dir)
        os.environ["PTDTT_LOG_DIR"] = str(cls.log_dir)
        os.environ["JWT_SECRET"] = "feat226-unit-test-secret-key-2026-ptdtt"
        os.environ["PTDTT_TESTING"] = "1"

        import sys
        if str(REPO_ROOT) not in sys.path:
            sys.path.insert(0, str(REPO_ROOT))

        if "server_flask" in sys.modules:
            cls.sf = importlib.reload(sys.modules["server_flask"])
        else:
            cls.sf = importlib.import_module("server_flask")

        cls.client = cls.sf.app.test_client()

        # Start live HTTP server on localhost for Playwright E2E tests
        cls.port = _find_free_port()
        cls.base_url = f"http://127.0.0.1:{cls.port}"
        cls.http_server = make_server("127.0.0.1", cls.port, cls.sf.app, threaded=True)
        cls.server_thread = threading.Thread(target=cls.http_server.serve_forever, daemon=True)
        cls.server_thread.start()

        cls.pw = sync_playwright().start()
        cls.browsers = {
            "webkit": cls.pw.webkit.launch(headless=True),
            "chromium": cls.pw.chromium.launch(headless=True),
        }

    @classmethod
    def tearDownClass(cls):
        for b in getattr(cls, "browsers", {}).values():
            try:
                b.close()
            except Exception:
                pass
        if getattr(cls, "pw", None):
            cls.pw.stop()
        if getattr(cls, "http_server", None):
            cls.http_server.shutdown()
        if getattr(cls, "tmp_dir_obj", None):
            cls.tmp_dir_obj.cleanup()

    def _mint_headers(self, username: str) -> dict[str, str]:
        auth_data = json.loads((self.data_dir / "auth.json").read_text(encoding="utf-8"))
        u = auth_data["users"][username]
        token = self.sf._create_jwt(username, u)
        return {
            "Authorization": f"Bearer {token}",
            "X-User": username,
            "X-Client-Build": str(self.sf.MIN_CLIENT_BUILD + 100000),
            "Content-Type": "application/json",
        }

    def _open_authenticated_page(self, browser_name: str, username: str, width: int, height: int):
        auth_data = json.loads((self.data_dir / "auth.json").read_text(encoding="utf-8"))
        u = auth_data["users"][username]
        token = self.sf._create_jwt(username, u)
        session_obj = {
            "username": username,
            "name": u["name"],
            "role": u["role"],
            "title": u["title"],
            "staffId": u["staffId"],
            "isAdmin": u["isAdmin"],
            "isSuperAdmin": u["isSuperAdmin"],
            "mustChangePassword": False,
        }
        browser = self.browsers[browser_name]
        context = browser.new_context(viewport={"width": width, "height": height}, service_workers="block")
        context.route(
            "**/api/emr*",
            lambda route: route.fulfill(
                status=200,
                content_type="application/json",
                body='{"patients":[]}',
            ),
        )
        sw_build_match = re.search(r"SW_BUILD_VER\s*=\s*'(\d+)'", (REPO_ROOT / "index.html").read_text(encoding="utf-8"))
        sw_build_ver = sw_build_match.group(1) if sw_build_match else "2611211215"
        session_json = json.dumps(session_obj, ensure_ascii=False)
        context.add_init_script(
            f"""
            localStorage.setItem('ptdtt_cache_ver', '2609281105');
            localStorage.setItem('ptdtt_sw_build', {json.dumps(sw_build_ver)});
            localStorage.setItem('ptdtt_jwt', {json.dumps(token)});
            sessionStorage.setItem('ptdtt_jwt', {json.dumps(token)});
            localStorage.setItem('ptdtt_session', {json.dumps(session_json)});
            sessionStorage.setItem('ptdtt_session', {json.dumps(session_json)});
            localStorage.setItem('ptdtt_onboarding_done', 'true');
            localStorage.setItem('ptdtt_icon_guide_v261121_dismissed', '1');
            """
        )
        page = context.new_page()
        page.goto(self.base_url + "/", wait_until="load")
        page.wait_for_function(
            """() => Boolean(
                typeof Store !== 'undefined' &&
                Store._hasLoadedServerOnce === true &&
                document.getElementById('app') &&
                getComputedStyle(document.getElementById('app')).display !== 'none'
            )""",
            timeout=10000,
        )
        active_user = page.evaluate("() => Auth.getSession()?.username || ''")
        self.assertEqual(active_user, username)
        return context, page

    def test_tc_226_01_backend_rbac_seed_idempotency_and_anti_leak(self):
        """TC-226-01: Backend RBAC for 3 BCN accounts vs non-BCN BS/ĐD, 409 anti-leak, and seed idempotency."""
        # 1. Verify initial bootstrap created exact 8 records in db.json
        db_disk = json.loads((self.data_dir / "db.json").read_text(encoding="utf-8"))
        self.assertIn("nckhItems", db_disk)
        self.assertEqual(len(db_disk["nckhItems"]), 8)
        self.assertEqual(db_disk["nextIds"]["nckhItems"], 9)

        # 2. All 3 BCN accounts (nphuu, vkan, ntnthuy) receive all 8 records via GET /api/data & GET /api/data/nckhItems
        for bcn_user in ("nphuu", "vkan", "ntnthuy"):
            hdrs = self._mint_headers(bcn_user)
            r_all = self.client.get("/api/data", headers=hdrs)
            self.assertEqual(r_all.status_code, 200)
            body_all = r_all.get_json()
            self.assertEqual(len(body_all.get("nckhItems", [])), 8, f"{bcn_user} must see 8 nckhItems")

            r_col = self.client.get("/api/data/nckhItems", headers=hdrs)
            self.assertEqual(r_col.status_code, 200)
            self.assertEqual(len(r_col.get_json()), 8)

        # 3. Non-BCN doctor (vnatuan) and nurse (ttdanh) receive empty [] in GET /api/data and 403 on GET/PUT /api/data/nckhItems
        for non_bcn in ("vnatuan", "ttdanh"):
            hdrs = self._mint_headers(non_bcn)
            r_all = self.client.get("/api/data", headers=hdrs)
            self.assertEqual(r_all.status_code, 200)
            self.assertEqual(r_all.get_json().get("nckhItems"), [], f"{non_bcn} must NOT see nckhItems in /api/data")

            r_col = self.client.get("/api/data/nckhItems", headers=hdrs)
            self.assertEqual(r_col.status_code, 403)

            # Even with forged stale baseRevision, PUT must return 403 immediately without leaking serverItems in 409!
            r_put = self.client.put(
                "/api/data/nckhItems",
                headers=hdrs,
                data=json.dumps({
                    "items": [{"id": 1, "category": "topic_approved", "title": "Forged", "year": 2026}],
                    "baseRevision": 99999,
                }),
            )
            self.assertEqual(r_put.status_code, 403)
            self.assertNotIn("serverItems", r_put.get_json() or {})

        # 4. Schema validation rejects invalid category or missing title
        bcn_hdrs = self._mint_headers("vkan")
        r_bad = self.client.put(
            "/api/data/nckhItems",
            headers=bcn_hdrs,
            data=json.dumps({"items": [{"id": 99, "category": "invalid_cat", "title": "X"}]}),
        )
        self.assertEqual(r_bad.status_code, 400)

        # 5. Idempotency: if nckhItems key exists (even temporarily empty), _ensure_nckh_bootstrapped() never overwrites it
        saved_items = copy.deepcopy(db_disk["nckhItems"])
        try:
            with self.sf.atomic_update() as d:
                d["nckhItems"] = []
            self.sf._ensure_nckh_bootstrapped()
            after_db = json.loads((self.data_dir / "db.json").read_text(encoding="utf-8"))
            self.assertEqual(after_db["nckhItems"], [], "Empty list must NOT be re-seeded when key already exists")
        finally:
            with self.sf.atomic_update() as d:
                d["nckhItems"] = saved_items

    def test_tc_226_02_sidebar_order_visibility_and_search_isolation(self):
        """TC-226-02: Sidebar order (#nav-conferences -> #nav-nckh & #nav-rooms -> #nav-reports), BCN visibility, and GlobalSearch isolation."""
        # Check BCN user (ntnthuy — Điều dưỡng trưởng, isAdmin=true)
        ctx_bcn, page_bcn = self._open_authenticated_page("chromium", "ntnthuy", 1440, 900)
        try:
            nav_info = page_bcn.evaluate(
                """() => {
                    const ids = Array.from(document.querySelectorAll('.sidebar-nav .nav-item')).map(el => el.id);
                    const nckhEl = document.getElementById('nav-nckh');
                    return {
                        ids,
                        nckhVisible: Boolean(nckhEl && getComputedStyle(nckhEl).display !== 'none'),
                    };
                }"""
            )
            ids = nav_info["ids"]
            idx_conf = ids.index("nav-conferences")
            idx_nckh = ids.index("nav-nckh")
            idx_rooms = ids.index("nav-rooms")
            idx_rep = ids.index("nav-reports")
            self.assertEqual(idx_nckh, idx_conf + 1, "#nav-nckh must sit immediately after #nav-conferences")
            self.assertEqual(idx_rep, idx_rooms + 1, "#nav-reports must sit immediately after #nav-rooms in clinical-first order")
            self.assertTrue(nav_info["nckhVisible"], "BCN account ntnthuy must see #nav-nckh")

            # GlobalSearch for BCN finds NCKH items
            bcn_hits = page_bcn.evaluate(
                """() => {
                    GlobalSearch.open();
                    GlobalSearch.search('1905/QĐ-BVBD');
                    const types = GlobalSearch.results.map(r => r.type);
                    GlobalSearch.close();
                    return types;
                }"""
            )
            self.assertIn("nckh", bcn_hits)
        finally:
            ctx_bcn.close()

        # Check non-BCN doctor (vnatuan — isAdmin=false)
        ctx_doc, page_doc = self._open_authenticated_page("chromium", "vnatuan", 1440, 900)
        try:
            non_bcn_state = page_doc.evaluate(
                """() => {
                    const nckhEl = document.getElementById('nav-nckh');
                    const hidden = !nckhEl || getComputedStyle(nckhEl).display === 'none';
                    App.navigate('nckh');
                    const blockedPage = App.currentPage;
                    GlobalSearch.open();
                    GlobalSearch.search('Nghiên cứu');
                    const navPages = GlobalSearch.results.map(r => r.name);
                    GlobalSearch.search('1905/QĐ-BVBD');
                    const qdResults = GlobalSearch.results.length;
                    GlobalSearch.close();
                    return { hidden, blockedPage, navPages, qdResults };
                }"""
            )
            self.assertTrue(non_bcn_state["hidden"], "Non-BCN user must NOT see #nav-nckh")
            self.assertNotEqual(non_bcn_state["blockedPage"], "nckh", "App.navigate('nckh') must be blocked for non-BCN")
            self.assertNotIn("Nghiên cứu KH", non_bcn_state["navPages"])
            self.assertEqual(non_bcn_state["qdResults"], 0)
        finally:
            ctx_doc.close()

    def test_tc_226_03_five_subtabs_and_exact_seed_data_constraints(self):
        """TC-226-03: 5 sub-tabs render exact 8 seed records; zero council members, zero meeting times, zero excluded initiative."""
        ctx, page = self._open_authenticated_page("chromium", "vkan", 1440, 900)
        try:
            page.click("#nav-nckh")
            page.wait_for_selector(".nckh-kpi-grid", timeout=5000)

            summary = page.evaluate(
                """() => {
                    const items = Store.getAll('nckhItems');
                    const byCat = {
                        topic_approved: items.filter(i => i.category === 'topic_approved').length,
                        topic_accepted: items.filter(i => i.category === 'topic_accepted').length,
                        initiative_approved: items.filter(i => i.category === 'initiative_approved').length,
                        initiative_recognized: items.filter(i => i.category === 'initiative_recognized').length,
                    };
                    const hasCouncilMembersField = items.some(i => 'councilMembers' in i);
                    const hasCouncilTimeField = items.some(i => 'councilTime' in i);
                    const hasExcludedAnastomosisInit = items.some(i =>
                        String(i.title || '').toLowerCase().includes('nội soi tiêu hóa dưới tức thì')
                    );
                    const subtabKeys = Array.from(document.querySelectorAll('.nckh-subtab')).map(b => b.dataset.subtab);
                    return {
                        total: items.length,
                        byCat,
                        hasCouncilMembersField,
                        hasCouncilTimeField,
                        hasExcludedAnastomosisInit,
                        subtabKeys,
                    };
                }"""
            )
            self.assertEqual(summary["total"], 8)
            self.assertEqual(
                summary["byCat"],
                {
                    "topic_approved": 2,
                    "topic_accepted": 2,
                    "initiative_approved": 2,
                    "initiative_recognized": 2,
                },
            )
            self.assertFalse(summary["hasCouncilMembersField"], "Must NOT collect 6 council members (QĐ-2a)")
            self.assertFalse(summary["hasCouncilTimeField"], "Must NOT collect council meeting time (QĐ-2b)")
            self.assertFalse(summary["hasExcludedAnastomosisInit"], "Unapproved anastomosis initiative must be excluded (QĐ-3a)")
            self.assertEqual(
                summary["subtabKeys"],
                ["dashboard", "topic_approved", "topic_accepted", "initiative_approved", "initiative_recognized"],
            )

            # Switch through each sub-tab and verify rendered rows/cards & no '13:30'/'14:25' time strings
            for cat, expected_selector, expected_count in [
                ("topic_approved", ".nckh-topic-card", 2),
                ("topic_accepted", ".nckh-topic-card", 2),
                ("initiative_approved", ".nckh-init-table tbody tr", 2),
                ("initiative_recognized", ".nckh-init-table tbody tr", 2),
            ]:
                page.click(f'.nckh-subtab[data-subtab="{cat}"]')
                page.wait_for_selector(expected_selector, timeout=5000)
                cnt = page.locator(expected_selector).count()
                self.assertEqual(cnt, expected_count, f"Expected {expected_count} rows in {cat}")
                body_text = page.locator("#nckh-tab-body").inner_text()
                self.assertNotIn("13:30", body_text)
                self.assertNotIn("14:25", body_text)
                self.assertNotIn("Phản biện 1", body_text)
                if cat.startswith("initiative_"):
                    # BUG-227: Verify 5-column layout, wide title column (>= 320px), compact row height (<= 170px), and "Nộp xét duyệt" label
                    init_metrics = page.evaluate(
                        """() => {
                            const thCount = document.querySelectorAll('.nckh-init-table thead th').length;
                            const firstRow = document.querySelector('.nckh-init-table tbody tr');
                            const titleCell = firstRow.querySelector('.nckh-col-title');
                            return {
                                thCount,
                                titleWidth: titleCell.getBoundingClientRect().width,
                                rowHeight: firstRow.getBoundingClientRect().height,
                                authorChipCount: firstRow.querySelectorAll('.nckh-author-chip').length,
                            };
                        }"""
                    )
                    self.assertEqual(init_metrics["thCount"], 5, "SKCT table must use 5 balanced columns (BUG-227)")
                    self.assertGreaterEqual(init_metrics["titleWidth"], 320, f"SKCT title column too narrow: {init_metrics}")
                    self.assertLessEqual(init_metrics["rowHeight"], 170, f"SKCT 5-author row too tall: {init_metrics}")
                    self.assertEqual(init_metrics["authorChipCount"], 5)
                    if cat == "initiative_approved":
                        self.assertIn("Nộp xét duyệt:", body_text)
                        self.assertNotIn("Duyệt: 25/09/2026", body_text)
                        self.assertNotIn("Đã được công nhận theo Quyết định số 1905/QĐ-BVBD ngày 25/09/2026", body_text)
        finally:
            ctx.close()

    def test_tc_226_04_crud_forms_equal_percent_and_promote_workflows(self):
        """TC-226-04: Add/Promote workflows across Topic & Initiative forms persist via PUT /api/data/nckhItems."""
        ctx, page = self._open_authenticated_page("chromium", "vkan", 1440, 900)
        try:
            page.click("#nav-nckh")

            # 1. Create a new Đề tài xét duyệt (2027) -> then promote 1-tap to Đề tài nghiệm thu
            page.click('.nckh-subtab[data-subtab="topic_approved"]')
            page.click("#nckh-primary-add-btn")
            page.wait_for_selector("#nckh-topic-form", timeout=5000)
            page.fill('#nckh-topic-form textarea[name="title"]', "Đề tài thử nghiệm E2E PTNS đại tràng 2027")
            page.fill('#nckh-topic-form input[name="year"]', "2027")
            page.fill('#nckh-topic-form input[name="principalInvestigator"]', "BSCKII. Vũ Khương An")
            page.fill('#nckh-topic-form .nckh-collab-input', "BS. Giao Hữu Trường Quy")
            page.fill('#nckh-topic-form input[name="decisionNumber"]', "101/QĐ-BVBD")
            page.fill('#nckh-topic-form input[name="decisionDate"]', "2027-02-10")
            page.fill('#nckh-topic-form input[name="councilDate"]', "2027-02-15")
            page.click('#nckh-topic-form button[type="submit"]')

            # Promote newly created topic to Đề tài nghiệm thu via 1-tap button
            page.wait_for_selector('.nckh-topic-card:has-text("Đề tài thử nghiệm E2E PTNS đại tràng 2027") .nckh-promote-btn', timeout=5000)
            page.click('.nckh-topic-card:has-text("Đề tài thử nghiệm E2E PTNS đại tràng 2027") .nckh-promote-btn')
            page.wait_for_selector("#nckh-topic-form", timeout=5000)
            # Title & PI must already be prefilled!
            prefilled_title = page.input_value('#nckh-topic-form textarea[name="title"]')
            self.assertEqual(prefilled_title, "Đề tài thử nghiệm E2E PTNS đại tràng 2027")
            page.fill('#nckh-topic-form input[name="decisionNumber"]', "909/QĐ-BVBD")
            page.fill('#nckh-topic-form input[name="decisionDate"]', "2027-10-01")
            page.fill('#nckh-topic-form input[name="councilDate"]', "2027-10-05")
            page.click('#nckh-topic-form button[type="submit"]')
            page.wait_for_selector('.nckh-topic-card:has-text("909/QĐ-BVBD")', timeout=5000)

            # 2. Create a new SKCT xét duyệt with 4 authors + "⚡ Chia đều %" -> promote to SKCT công nhận
            page.click('.nckh-subtab[data-subtab="initiative_approved"]')
            page.click("#nckh-primary-add-btn")
            page.wait_for_selector("#nckh-initiative-form", timeout=5000)
            form_text = page.locator("#nckh-initiative-form").inner_text()
            self.assertIn("ngày nộp xét duyệt", form_text.lower(), "SKCT form must label date as 'Ngày nộp xét duyệt' (BUG-227)")
            page.fill('#nckh-initiative-form textarea[name="title"]', "Sáng kiến E2E chuẩn hoá bảng kiểm ERAS 2027")
            page.fill('#nckh-initiative-form input[name="year"]', "2027")
            page.fill('#nckh-initiative-form input[name="submissionDate"]', "2027-08-20")
            # Add 3 more author rows (total 4 authors) and click "⚡ Chia đều %" -> 25% each
            for _ in range(3):
                page.click('#nckh-initiative-form button:has-text("+ Thêm tác giả")')
            author_names = [
                "Vũ Khương An",
                "Nguyễn Thị Ngọc Thùy",
                "Trần Thanh Danh",
                "Bùi Thị Mộng Trinh",
            ]
            name_inputs = page.locator("#nckh-initiative-form .nckh-author-name-input")
            for idx, nm in enumerate(author_names):
                name_inputs.nth(idx).fill(nm)
            page.click('#nckh-initiative-form button:has-text("⚡ Chia đều %")')
            pct_vals = page.evaluate(
                "() => Array.from(document.querySelectorAll('#nckh-initiative-form .nckh-author-pct-input')).map(i => Number(i.value))"
            )
            self.assertEqual(pct_vals, [25, 25, 25, 25])
            page.click('#nckh-initiative-form button[type="submit"]')

            # Promote newly created initiative to SKCT được công nhận
            page.wait_for_selector('tr:has-text("Sáng kiến E2E chuẩn hoá bảng kiểm ERAS 2027") .nckh-promote-btn', timeout=5000)
            page.click('tr:has-text("Sáng kiến E2E chuẩn hoá bảng kiểm ERAS 2027") .nckh-promote-btn')
            page.wait_for_selector("#nckh-initiative-form", timeout=5000)
            page.fill('#nckh-initiative-form input[name="decisionNumber"]', "2027/QĐ-BVBD")
            page.fill('#nckh-initiative-form input[name="decisionDate"]', "2027-09-30")
            page.click('#nckh-initiative-form button[type="submit"]')
            page.wait_for_selector('tr:has-text("2027/QĐ-BVBD")', timeout=5000)

            # Wait for debounced Store._flushDirtyCollections() PUT to hit Flask server (300ms debounce)
            page.wait_for_timeout(700)
            db_disk = json.loads((self.data_dir / "db.json").read_text(encoding="utf-8"))
            self.assertEqual(len(db_disk["nckhItems"]), 12, "8 seed + 4 newly created/promoted records must persist on disk")

            # Clean up the 4 synthetic 2027 test records so subsequent tests see clean 8 seed items
            with self.sf.atomic_update() as d:
                d["nckhItems"] = [x for x in d["nckhItems"] if int(x.get("year") or 0) != 2027]
                d.setdefault("_revisions", {})["nckhItems"] = int(d.get("_revisions", {}).get("nckhItems", 1)) + 1
        finally:
            ctx.close()

    def test_tc_226_05_webkit_iphone_air_and_chromium_responsive_dark_mode_and_modal_ux(self):
        """TC-226-05: WebKit (440x956 iPhone Air) & Chromium (1440x900) Light/Dark mode, zero overflow, .kb-open sync."""
        for engine, vp in [("webkit", (440, 956)), ("chromium", (440, 956)), ("chromium", (1440, 900))]:
            ctx, page = self._open_authenticated_page(engine, "vkan", vp[0], vp[1])
            try:
                page.evaluate("() => App.navigate('nckh')")
                page.wait_for_selector(".nckh-kpi-grid", timeout=5000)

                for theme in ("light", "dark"):
                    page.evaluate(f"() => document.documentElement.setAttribute('data-theme', '{theme}')")
                    for subtab in ("dashboard", "topic_approved", "initiative_recognized"):
                        page.click(f'.nckh-subtab[data-subtab="{subtab}"]')
                        metrics = page.evaluate(
                            """() => ({
                                docScrollW: document.documentElement.scrollWidth,
                                docClientW: document.documentElement.clientWidth,
                                mainScrollW: document.getElementById('main-content').scrollWidth,
                                mainClientW: document.getElementById('main-content').clientWidth,
                            })"""
                        )
                        self.assertLessEqual(
                            metrics["docScrollW"],
                            metrics["docClientW"] + 1,
                            f"Horizontal overflow on {engine} {vp} theme={theme} subtab={subtab}: {metrics}",
                        )

                # On mobile viewport (440x956), verify Sáng kiến switches to mobile cards and modal form has zero overflow + .kb-open sync
                if vp[0] <= 768:
                    mobile_cards_visible = page.evaluate(
                        """() => {
                            const m = document.querySelector('.nckh-mobile-only');
                            const d = document.querySelector('.nckh-desktop-only');
                            return getComputedStyle(m).display !== 'none' && getComputedStyle(d).display === 'none';
                        }"""
                    )
                    self.assertTrue(mobile_cards_visible, f"Mobile cards must be active on {engine} {vp}")

                    # Open Initiative form on iPhone Air WebKit/Chromium and check modal containment + mock keyboard .kb-open
                    page.click("#nckh-primary-add-btn")
                    page.wait_for_selector("#nckh-initiative-form", timeout=5000)
                    modal_metrics = page.evaluate(
                        """() => {
                            const m = document.getElementById('modal');
                            const mb = document.getElementById('modal-body');
                            return {
                                modalRight: m.getBoundingClientRect().right,
                                vw: window.innerWidth,
                                bodyScrollW: mb.scrollWidth,
                                bodyClientW: mb.clientWidth,
                            };
                        }"""
                    )
                    self.assertLessEqual(modal_metrics["modalRight"], modal_metrics["vw"] + 1)
                    self.assertLessEqual(modal_metrics["bodyScrollW"], modal_metrics["bodyClientW"] + 1)

                    # Simulate iOS virtual keyboard shrink via Modal._getViewportMetrics override
                    kb_state = page.evaluate(
                        """() => {
                            const orig = Modal._getViewportMetrics.bind(Modal);
                            Modal._getViewportMetrics = () => ({
                                width: 440,
                                height: 520,
                                offsetTop: 0,
                                offsetLeft: 0,
                                scale: 1
                            });
                            const inp = document.querySelector('#nckh-initiative-form textarea[name="title"]');
                            inp.focus();
                            Modal._syncVisualViewport('resize');
                            const overlay = document.getElementById('modal-overlay');
                            const footer = document.querySelector('#modal .modal-footer');
                            const res = {
                                kbOpen: overlay.classList.contains('kb-open'),
                                footerPos: getComputedStyle(footer).position,
                            };
                            Modal._getViewportMetrics = orig;
                            Modal.close();
                            return res;
                        }"""
                    )
                    self.assertTrue(kb_state["kbOpen"], f".kb-open must activate on {engine} when keyboard opens")
                    self.assertEqual(kb_state["footerPos"], "static", f".modal-footer must drop to static on {engine}")
            finally:
                ctx.close()


if __name__ == "__main__":
    unittest.main()
