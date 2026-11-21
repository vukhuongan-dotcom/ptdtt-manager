import json
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
INDEX_URL = (ROOT / "index.html").as_uri()
DB_PATH = ROOT / "data" / "db.json"


def _load_db_json() -> str:
    if DB_PATH.exists():
        return DB_PATH.read_text(encoding="utf-8")
    return json.dumps({"staff": [], "patients": [], "surgeries": [], "schedules": {}})


class TestBug225IosSurgeryModalUx(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db_raw = _load_db_json()
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

    def _open_app_page(self, browser_name: str, width: int, height: int):
        browser = self.browsers[browser_name]
        context = browser.new_context(viewport={"width": width, "height": height})
        context.add_init_script(
            f"""
            const sessionObj = {{
                staffId: 2,
                username: 'vukhuongan',
                name: 'BS.CKII. Vũ Khương An',
                role: 'Phó trưởng khoa',
                isAdmin: true,
                isSuperAdmin: true
            }};
            localStorage.setItem('ptdtt_cache_ver', '2609281105');
            localStorage.setItem('ptdtt_sw_build', window.SW_BUILD_VER || '2611211315');
            localStorage.setItem('ptdtt_data', {json.dumps(self.db_raw)});
            localStorage.setItem('ptdtt_auth', JSON.stringify(sessionObj));
            localStorage.setItem('ptdtt_session', JSON.stringify(sessionObj));
            sessionStorage.setItem('ptdtt_session', JSON.stringify(sessionObj));
            """
        )
        page = context.new_page()
        page.goto(INDEX_URL, wait_until="load")
        page.evaluate(
            """() => {
                // Disable modal keyframe animation & transition in tests so geometry is settled at t=0
                const style = document.createElement('style');
                style.textContent = '#modal, #modal-overlay { transition: none !important; animation: none !important; transform: none !important; }';
                document.head.appendChild(style);
                const loginOverlay = document.getElementById('login-overlay');
                if (loginOverlay) loginOverlay.style.display = 'none';
                const loginPage = document.getElementById('login-page');
                if (loginPage) loginPage.style.display = 'none';
                const appEl = document.getElementById('app');
                if (appEl) appEl.style.display = '';
                const session = {
                    staffId: 2,
                    username: 'vukhuongan',
                    name: 'BS.CKII. Vũ Khương An',
                    role: 'Phó trưởng khoa',
                    isAdmin: true,
                    isSuperAdmin: true
                };
                if (typeof Auth !== 'undefined') {
                    Auth.getSession = () => session;
                    Auth.isLoggedIn = () => true;
                    Auth.canEdit = () => true;
                    Auth.isAdmin = () => true;
                    Auth.isSuperAdmin = () => true;
                    Auth.getRole = () => 'Phó trưởng khoa';
                }
                if (typeof Store !== 'undefined' && Store.init) {
                    Store.init();
                }
            }"""
        )
        return context, page

    def test_tc_225_01_zero_horizontal_overflow_across_viewports(self):
        """TC-225-01: Zero horizontal overflow & full control containment across mobile viewports on WebKit & Chromium."""
        viewports = [
            (393, 852),  # iPhone Air / 15 Pro
            (430, 932),  # iPhone Pro Max
            (375, 812),  # iPhone Mini / SE
            (360, 800),  # Android compact
            (852, 393),  # Landscape mobile
        ]
        for browser_name in ("webkit", "chromium"):
            for w, h in viewports:
                with self.subTest(browser=browser_name, viewport=f"{w}x{h}"):
                    ctx, page = self._open_app_page(browser_name, w, h)
                    try:
                        metrics = page.evaluate(
                            """() => {
                                SurgeryPage.openForm();
                                if (typeof SurgeryPage.fillSampleSandboxForm === 'function') {
                                    SurgeryPage.fillSampleSandboxForm();
                                }
                                const mb = document.getElementById('modal-body');
                                const form = mb.querySelector('form');
                                // Inject a 120-char option into a select to test intrinsic width guard
                                const sel = form.querySelector('select[name="mainSurgeon"]');
                                if (sel) {
                                    const opt = document.createElement('option');
                                    opt.value = 'LONG_OPT';
                                    opt.textContent = 'GS.TS.BSCKII. Chuyên Gia Phẫu Thuật Nội Soi Đại Trực Tràng — Phương Pháp Cắt Toàn Bộ Mạc Treo Trực Tràng Qua Ngả Hậu Môn (TaTME) 1234567890';
                                    sel.appendChild(opt);
                                    sel.value = 'LONG_OPT';
                                }
                                const mbRect = mb.getBoundingClientRect();
                                const controls = Array.from(mb.querySelectorAll(
                                    'input.form-input, select.form-select, textarea.form-textarea, #surg-sandbox-mode-box, .modal-footer'
                                ));
                                const violations = [];
                                for (const el of controls) {
                                    const r = el.getBoundingClientRect();
                                    if (r.width === 0 && r.height === 0) continue;
                                    const leftPad = r.left - mbRect.left;
                                    const rightPad = mbRect.right - r.right;
                                    if (leftPad < 11.5 || rightPad < 11.5) {
                                        violations.push({
                                            tag: el.tagName,
                                            name: el.getAttribute('name') || el.id || el.className,
                                            leftPad: Math.round(leftPad * 10) / 10,
                                            rightPad: Math.round(rightPad * 10) / 10,
                                            width: Math.round(r.width * 10) / 10,
                                        });
                                    }
                                }
                                const dateInput = mb.querySelector('input[type="date"][name="date"]');
                                const textInput = mb.querySelector('input[name="patientName"]');
                                const dateWidthDiff = (dateInput && textInput)
                                    ? Math.abs(dateInput.getBoundingClientRect().width - textInput.getBoundingClientRect().width)
                                    : 0;
                                return {
                                    mbScrollWidth: mb.scrollWidth,
                                    mbClientWidth: mb.clientWidth,
                                    formScrollWidth: form.scrollWidth,
                                    formClientWidth: form.clientWidth,
                                    dateWidthDiff,
                                    violations,
                                };
                            }"""
                        )
                        self.assertLessEqual(
                            metrics["mbScrollWidth"],
                            metrics["mbClientWidth"] + 1,
                            f"{browser_name} {w}x{h}: modal-body horizontal overflow {metrics}",
                        )
                        self.assertLessEqual(
                            metrics["formScrollWidth"],
                            metrics["formClientWidth"] + 1,
                            f"{browser_name} {w}x{h}: surgery-form horizontal overflow {metrics}",
                        )
                        self.assertLessEqual(
                            metrics["dateWidthDiff"],
                            1.5,
                            f"{browser_name} {w}x{h}: input[type=date] width mismatch ({metrics['dateWidthDiff']}px)",
                        )
                        self.assertEqual(
                            metrics["violations"],
                            [],
                            f"{browser_name} {w}x{h}: control padding/clipping violations: {metrics['violations']}",
                        )
                    finally:
                        ctx.close()

    def test_tc_225_02_stacking_context_and_real_close_click(self):
        """TC-225-02: .modal-overlay z-index > .mobile-header and real click on #modal-close succeeds."""
        for browser_name in ("webkit", "chromium"):
            with self.subTest(browser=browser_name):
                ctx, page = self._open_app_page(browser_name, 393, 852)
                try:
                    info = page.evaluate(
                        """() => {
                            SurgeryPage.openForm();
                            const overlay = document.getElementById('modal-overlay');
                            const header = document.getElementById('mobile-header');
                            const closeBtn = document.getElementById('modal-close');
                            const r = closeBtn.getBoundingClientRect();
                            const cx = r.left + r.width / 2;
                            const cy = r.top + r.height / 2;
                            const hit = document.elementFromPoint(cx, cy);
                            return {
                                overlayZ: parseInt(getComputedStyle(overlay).zIndex, 10),
                                headerZ: header ? parseInt(getComputedStyle(header).zIndex, 10) : 0,
                                hitMatchesClose: Boolean(hit && (hit === closeBtn || closeBtn.contains(hit))),
                                hitTag: hit ? (hit.id || hit.className || hit.tagName) : null,
                                closeRect: { top: r.top, left: r.left, width: r.width, height: r.height },
                                isActiveBefore: overlay.classList.contains('active'),
                            };
                        }"""
                    )
                    self.assertGreater(info["overlayZ"], info["headerZ"])
                    self.assertEqual(info["overlayZ"], 1100)
                    self.assertTrue(
                        info["hitMatchesClose"],
                        f"{browser_name}: #modal-close obscured at elementFromPoint: {info}",
                    )
                    self.assertTrue(info["isActiveBefore"])

                    # Real Playwright click without force=True
                    page.locator("#modal-close").click()
                    is_active_after = page.evaluate(
                        "() => document.getElementById('modal-overlay').classList.contains('active')"
                    )
                    self.assertFalse(is_active_after, f"{browser_name}: real click on #modal-close did not close modal")

                    # Also verify with natural keyframe animations enabled (wait 350ms for sheetSlideUp)
                    page.evaluate(
                        """() => {
                            const s = document.querySelector('style:last-of-type');
                            if (s && s.textContent.includes('#modal, #modal-overlay')) s.remove();
                            SurgeryPage.openForm();
                        }"""
                    )
                    page.wait_for_timeout(350)
                    natural_rect = page.evaluate(
                        "() => document.getElementById('modal-close').getBoundingClientRect().toJSON()"
                    )
                    self.assertLess(natural_rect["top"], 80, f"{browser_name}: natural animation did not settle at top")
                    page.locator("#modal-close").click()
                    self.assertFalse(
                        page.evaluate("() => document.getElementById('modal-overlay').classList.contains('active')")
                    )
                finally:
                    ctx.close()

    def test_tc_225_03_sticky_footer_no_bottom_gap_when_keyboard_closed(self):
        """TC-225-03: No 16px gap below sticky .modal-footer across scroll positions when !kb-open."""
        for browser_name in ("webkit", "chromium"):
            with self.subTest(browser=browser_name):
                ctx, page = self._open_app_page(browser_name, 393, 852)
                try:
                    gaps = page.evaluate(
                        """() => {
                            SurgeryPage.openForm();
                            const mb = document.getElementById('modal-body');
                            const footer = mb.querySelector('.modal-footer');
                            const maxScroll = Math.max(0, mb.scrollHeight - mb.clientHeight);
                            const positions = [0, 120, 240, maxScroll];
                            const results = [];
                            for (const pos of positions) {
                                mb.scrollTop = pos;
                                const mbRect = mb.getBoundingClientRect();
                                const fRect = footer.getBoundingClientRect();
                                results.push({
                                    scrollTop: pos,
                                    gapBottom: Math.abs(mbRect.bottom - fRect.bottom),
                                });
                            }
                            return results;
                        }"""
                    )
                    for item in gaps:
                        self.assertLessEqual(
                            item["gapBottom"],
                            1.5,
                            f"{browser_name}: gap below .modal-footer at scrollTop={item['scrollTop']} is {item['gapBottom']}px",
                        )
                finally:
                    ctx.close()

    def test_tc_225_04_visual_viewport_keyboard_zoom_and_manual_scroll(self):
        """TC-225-04: VisualViewport adapter distinguishes keyboard vs pinch-zoom and preserves manual scroll."""
        for browser_name in ("webkit", "chromium"):
            with self.subTest(browser=browser_name):
                ctx, page = self._open_app_page(browser_name, 393, 852)
                try:
                    res = page.evaluate(
                        """() => {
                            SurgeryPage.openForm();
                            const overlay = document.getElementById('modal-overlay');
                            const mb = document.getElementById('modal-body');
                            const footer = mb.querySelector('.modal-footer');
                            const diagInput = mb.querySelector('input[name="diagnosis"]');

                            // (a) Simulate keyboard open: height=420, scale=1.0, focus diagnosis
                            Modal._getViewportMetrics = () => ({
                                width: 393,
                                height: 420,
                                offsetTop: 0,
                                scale: 1.0,
                                layoutHeight: 852
                            });
                            diagInput.focus();
                            Modal._syncVisualViewport('focusin');

                            const kbOpenA = overlay.classList.contains('kb-open');
                            const footerPosA = getComputedStyle(footer).position;
                            const mbRectA = mb.getBoundingClientRect();
                            const diagRectA = diagInput.getBoundingClientRect();
                            const footerRectA = footer.getBoundingClientRect();

                            // Compute vertical overlap between focused input and footer
                            const overlapY = Math.max(
                                0,
                                Math.min(diagRectA.bottom, footerRectA.bottom) - Math.max(diagRectA.top, footerRectA.top)
                            );
                            const diagVisibleInViewport = (
                                diagRectA.top >= mbRectA.top - 1 &&
                                diagRectA.bottom <= Math.min(mbRectA.bottom, 420) + 1
                            );

                            // (c) While kb-open, user manually scrolls to bottom to click submit;
                            // subsequent vv-scroll / vv-resize with same height must NOT pull scrollTop back up
                            const maxScroll = Math.max(0, mb.scrollHeight - mb.clientHeight);
                            mb.scrollTop = maxScroll;
                            const scrollBeforeEvent = mb.scrollTop;
                            Modal._syncVisualViewport('vv-scroll');
                            Modal._syncVisualViewport('vv-resize');
                            const scrollAfterEvent = mb.scrollTop;

                            // (b) Simulate pinch-zoom (scale=1.5, height=420): must NOT trigger kb-open
                            Modal._getViewportMetrics = () => ({
                                width: 393,
                                height: 420,
                                offsetTop: 0,
                                scale: 1.5,
                                layoutHeight: 852
                            });
                            Modal._syncVisualViewport('vv-resize');
                            const kbOpenDuringZoom = overlay.classList.contains('kb-open');

                            return {
                                kbOpenA,
                                footerPosA,
                                overlapY,
                                diagVisibleInViewport,
                                diagRectA: { top: diagRectA.top, bottom: diagRectA.bottom },
                                mbRectA: { top: mbRectA.top, bottom: mbRectA.bottom },
                                scrollBeforeEvent,
                                scrollAfterEvent,
                                kbOpenDuringZoom,
                            };
                        }"""
                    )
                    self.assertTrue(res["kbOpenA"], f"{browser_name}: kb-open not activated on keyboard open")
                    self.assertEqual(res["footerPosA"], "static", f"{browser_name}: footer must be static when kb-open")
                    self.assertEqual(res["overlapY"], 0, f"{browser_name}: footer overlaps focused input")
                    self.assertTrue(
                        res["diagVisibleInViewport"],
                        f"{browser_name}: focused diagnosis input not visible above keyboard: {res}",
                    )
                    self.assertAlmostEqual(
                        res["scrollBeforeEvent"],
                        res["scrollAfterEvent"],
                        delta=2.0,
                        msg=f"{browser_name}: manual scroll to bottom was hijacked by vv-scroll/vv-resize",
                    )
                    self.assertFalse(res["kbOpenDuringZoom"], f"{browser_name}: pinch-zoom falsely triggered kb-open")
                finally:
                    ctx.close()

    def test_tc_225_05_regression_drawer_scroll_restore_and_desktop_grid(self):
        """TC-225-05: Regression checks for .sap-drawer-overlay, 5x open/close scrollY restore, and desktop 2-col grid."""
        for browser_name in ("webkit", "chromium"):
            with self.subTest(browser=browser_name):
                ctx, page = self._open_app_page(browser_name, 393, 852)
                try:
                    reg = page.evaluate(
                        """() => {
                            // 1. Test 5x open/close idempotency and scrollY=300 restoration
                            const spacer = document.createElement('div');
                            spacer.id = 'test-scroll-spacer';
                            spacer.style.height = '2000px';
                            document.body.appendChild(spacer);
                            window.scrollTo(0, 300);
                            const initialScrollY = Math.round(window.scrollY);

                            for (let i = 0; i < 5; i++) {
                                SurgeryPage.openForm();
                                Modal.close();
                            }
                            const restoredScrollY = Math.round(window.scrollY);
                            const bodyHasModalOpen = document.body.classList.contains('modal-open');
                            const vpSyncAfterClose = Boolean(Modal._vpSyncActive);
                            const vvRafAfterClose = Modal._vvRafId;
                            const focusTimerAfterClose = Modal._openFocusTimerId;
                            spacer.remove();

                            // 2. Test real #modal-overlay.sap-drawer-overlay and #modal.sap-drawer-right isolation
                            const overlay = document.getElementById('modal-overlay');
                            const modal = document.getElementById('modal');
                            Modal.open('Chi tiết ca mổ', '<div class="sap-drawer-shell">Drawer</div>');
                            overlay.classList.add('sap-drawer-overlay');
                            modal.classList.add('sap-drawer-right');
                            Modal._syncVisualViewport('open');
                            const sapZ = getComputedStyle(overlay).zIndex;
                            const sapHeight = modal.getBoundingClientRect().height;
                            const sapHasKbOpen = overlay.classList.contains('kb-open');
                            Modal.close();

                            return {
                                initialScrollY,
                                restoredScrollY,
                                bodyHasModalOpen,
                                vpSyncAfterClose,
                                vvRafAfterClose,
                                focusTimerAfterClose,
                                sapZ,
                                sapHeight,
                                sapHasKbOpen,
                            };
                        }"""
                    )
                    self.assertAlmostEqual(reg["initialScrollY"], 300, delta=2)
                    self.assertAlmostEqual(reg["restoredScrollY"], 300, delta=2)
                    self.assertFalse(reg["bodyHasModalOpen"])
                    self.assertFalse(reg["vpSyncAfterClose"])
                    self.assertIsNone(reg["vvRafAfterClose"])
                    self.assertIsNone(reg["focusTimerAfterClose"])
                    self.assertEqual(reg["sapZ"], "1200")
                    self.assertAlmostEqual(reg["sapHeight"], 852, delta=2)
                    self.assertFalse(reg["sapHasKbOpen"])
                finally:
                    ctx.close()

                # Desktop 1440x900 2-column form-row check
                ctx_desk, page_desk = self._open_app_page(browser_name, 1440, 900)
                try:
                    desk = page_desk.evaluate(
                        """() => {
                            SurgeryPage.openForm();
                            const row = document.querySelector('#modal-body form .form-row');
                            const groups = Array.from(row.querySelectorAll(':scope > .form-group'));
                            const r0 = groups[0].getBoundingClientRect();
                            const r1 = groups[1].getBoundingClientRect();
                            return {
                                topDiff: Math.abs(r0.top - r1.top),
                                col1Right: r0.right,
                                col2Left: r1.left,
                            };
                        }"""
                    )
                    self.assertLessEqual(desk["topDiff"], 2.0, f"{browser_name}: desktop .form-row not side-by-side")
                    self.assertGreater(desk["col2Left"], desk["col1Right"], f"{browser_name}: desktop columns overlap")
                finally:
                    ctx_desk.close()


if __name__ == "__main__":
    unittest.main()
