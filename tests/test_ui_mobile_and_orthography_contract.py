#!/usr/bin/env python3
"""Permanent regression contract tests for BUG-202 (Mobile Drawer Close Button & Safe-Area)
and BUG-203 (Utils.toProperCase Medical Acronyms & Roman Numerals Orthography)."""

from __future__ import annotations

import json
import pathlib
import re
import subprocess
import unittest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
SURGERY_APPROVAL_CSS = REPO_ROOT / "css" / "surgery-approval.css"
MOBILE_CSS = REPO_ROOT / "css" / "mobile.css"
BUNDLE_CSS = REPO_ROOT / "css" / "app.bundle.css"
UTILS_JS = REPO_ROOT / "js" / "utils.js"
ENGINE_PY = REPO_ROOT / "surgery_approval_engine.py"
BUG_REGISTRY = REPO_ROOT / "docs" / "BUG_FIX_REGISTRY.md"
BUG_REGISTRY_MIRROR = REPO_ROOT / "PROJECT_CONTEXT" / "BANG_TONG_HOP_LOI_VA_KHAC_PHUC.md"


class MobileDrawerAndOrthographyContractTests(unittest.TestCase):
    """Guards BUG-202 (RCA-016) and BUG-203 (RCA-017) against regression."""

    def test_bug202_drawer_zindex_exceeds_mobile_header(self) -> None:
        mobile_txt = MOBILE_CSS.read_text(encoding="utf-8")
        sap_txt = SURGERY_APPROVAL_CSS.read_text(encoding="utf-8")
        bundle_txt = BUNDLE_CSS.read_text(encoding="utf-8")

        mh_match = re.search(r"\.mobile-header\s*\{[^}]*z-index:\s*(\d+)", mobile_txt, re.S)
        self.assertIsNotNone(mh_match, ".mobile-header z-index must exist in css/mobile.css")
        mobile_header_z = int(mh_match.group(1))

        ov_match = re.search(
            r"#modal-overlay\.sap-drawer-overlay\.active\s*\{[^}]*z-index:\s*(\d+)\s*!important",
            sap_txt,
            re.S,
        )
        self.assertIsNotNone(ov_match, "#modal-overlay.sap-drawer-overlay.active must enforce z-index !important")
        drawer_z = int(ov_match.group(1))

        self.assertGreater(drawer_z, mobile_header_z, "Case Drawer z-index must sit above .mobile-header (1001)")
        self.assertLess(drawer_z, 9999, "Case Drawer z-index must stay below Search/Toast/Confirm (9999+)")
        self.assertIn("z-index: 1200 !important", bundle_txt, "css/app.bundle.css must include rebuilt z-index fix")

    def test_bug202_no_raw_100dvh_overflow_and_safe_area_top_present(self) -> None:
        sap_txt = SURGERY_APPROVAL_CSS.read_text(encoding="utf-8")
        self.assertNotIn("100dvh", sap_txt, "#modal.sap-drawer-right must use inset:0 + height:100%, never raw 100dvh")
        self.assertIn(
            "env(safe-area-inset-top, 0px)",
            sap_txt,
            "Drawer .modal-header must include safe-area-inset-top padding for iOS notch/Dynamic Island",
        )
        self.assertIn("min-width: 44px !important", sap_txt)
        self.assertIn("min-height: 44px !important", sap_txt)

    def test_bug203_utils_to_proper_case_preserves_roman_numerals_and_acronyms(self) -> None:
        engine_txt = ENGINE_PY.read_text(encoding="utf-8")
        sandbox_tags = re.findall(r'mock_name\(\d+,\s*"([^"]+)"\)', engine_txt)
        self.assertGreaterEqual(len(sandbox_tags), 16, "Expected all 16 sandbox scenario tags")

        node_script = r"""
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync(process.argv[1], 'utf8');
const tags = JSON.parse(process.argv[2]);
const ctx = { window: {}, document: {}, localStorage: {}, Store: {} };
vm.createContext(ctx);
vm.runInContext(code + '; globalThis.Utils = Utils;', ctx);

const fixedCases = [
    ['NGUYỄN TẤN MINH', 'Nguyễn Tấn Minh'],
    ['NGUYỄN THỊ TƯỜNG VI', 'Nguyễn Thị Tường Vi'],
    ['trần thị lan', 'Trần Thị Lan'],
    ['lê VĂN an', 'Lê Văn An'],
    ['lê AN bình', 'Lê An Bình'],
    ['[cột iii vượt 01 cột pt-ii]', '[Cột III Vượt 01 Cột PT-II]'],
    [
        'Bệnh Nhân Giả Lập 10 (Romeo-300) - PTNS Ruột Thừa Bán Khẩn [Cột III Vượt 01 Cột PT-II]',
        'Bệnh Nhân Giả Lập 10 (Romeo-300) - PTNS Ruột Thừa Bán Khẩn [Cột III Vượt 01 Cột PT-II]'
    ]
];

const failures = [];
for (const [inp, exp] of fixedCases) {
    const got = ctx.Utils.toProperCase(inp);
    if (got !== exp) failures.push({ inp, got, exp });
}

const forbidden = /\b(Ii|Iii|Iv|Pt-i|Pt-ii|Pt-iii|Ptns|Hmnt|Hv|Tnt|Gist|Esd|Nsth|Bcn)\b|\[(cột|mới|chờ|đã|ngoại|tạm|liên)/u;
tags.forEach((tag, i) => {
    const raw = `Bệnh Nhân Giả Lập ${String(i + 1).padStart(2, '0')} (Alpha-300) - ${tag}`;
    const out = ctx.Utils.toProperCase(raw);
    if (forbidden.test(out)) {
        failures.push({ tag, out });
    }
});

console.log(JSON.stringify({ ok: failures.length === 0, failures }));
"""
        proc = subprocess.run(
            ["node", "-e", node_script, str(UTILS_JS), json.dumps(sandbox_tags, ensure_ascii=False)],
            capture_output=True,
            text=True,
            check=True,
        )
        payload = json.loads(proc.stdout.strip())
        self.assertTrue(payload["ok"], f"Utils.toProperCase orthography regressions: {payload['failures']}")

    def test_dual_bug_registries_synced_and_contain_bug202_bug203(self) -> None:
        reg_a = BUG_REGISTRY.read_text(encoding="utf-8")
        reg_b = BUG_REGISTRY_MIRROR.read_text(encoding="utf-8")
        self.assertEqual(reg_a, reg_b, "docs/BUG_FIX_REGISTRY.md and PROJECT_CONTEXT mirror must be 100% identical")
        for token in ("RCA-016", "RCA-017", "`BUG-202`", "`BUG-203`", "`BUG-204`", "`FEAT-205`", "4a95998", "84dfc26"):
            self.assertIn(token, reg_a, f"Missing {token} in BUG_FIX_REGISTRY.md")

    def test_bug204_all_sandbox_context_enums_and_wal_actions_localized_in_vietnamese(self) -> None:
        import sys
        sys.path.insert(0, str(REPO_ROOT))
        import surgery_approval_engine as eng  # noqa: WPS433

        db = json.loads((REPO_ROOT / "data" / "db.json").read_text(encoding="utf-8"))
        cases = eng.build_sandbox_sample_surgeries(db, str(REPO_ROOT / "data"), str(REPO_ROOT))
        sap_js = (REPO_ROOT / "js" / "surgery-approval.js").read_text(encoding="utf-8")
        routes_py = (REPO_ROOT / "surgery_approval_routes.py").read_text(encoding="utf-8")

        # Extract SAP_CONTEXT_ENUM_LABELS & SAP_WAL_ACTION_LABELS via Node VM
        node_extract = r"""
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync(process.argv[1], 'utf8');
const ctxMatch = code.match(/const SAP_CONTEXT_ENUM_LABELS\s*=\s*\{[\s\S]*?\n\};/);
const chMatch = code.match(/const SAP_EMERGENCY_CHANNEL_LABELS\s*=\s*\{[\s\S]*?\n\};/);
const walMatch = code.match(/const SAP_WAL_ACTION_LABELS\s*=\s*\{[\s\S]*?\n\};/);
if (!ctxMatch || !chMatch || !walMatch) {
    console.error('Missing localization dictionaries');
    process.exit(1);
}
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(
    ctxMatch[0] + '\n' + chMatch[0] + '\n' + walMatch[0] +
    '\nglobalThis.out = { ctx: SAP_CONTEXT_ENUM_LABELS, ch: SAP_EMERGENCY_CHANNEL_LABELS, wal: SAP_WAL_ACTION_LABELS };',
    sandbox
);
console.log(JSON.stringify(sandbox.out));
"""
        proc = subprocess.run(
            ["node", "-e", node_extract, str(REPO_ROOT / "js" / "surgery-approval.js")],
            capture_output=True,
            text=True,
            check=True,
        )
        dicts = json.loads(proc.stdout.strip())
        ctx_map = dicts["ctx"]
        ch_map = dicts["ch"]
        wal_map = dicts["wal"]

        # 1. Verify every contextChips enum across all 16 sandbox scenarios is localized with zero snake_case
        snake_re = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$")
        unlocalized = []
        for c in cases:
            ctx = (c.get("clinicalChips") or {}).get("contextChips") or {}
            b1 = ctx.get("fistulaContext") or {}
            b2 = ctx.get("benignAbdominalContext") or {}
            b3 = ctx.get("cancerContext") or {}
            b4 = ctx.get("specialNeoplasmContext") or {}
            vals = [
                b1.get("fistulaClassification"),
                b1.get("fistulaImaging"),
                b2.get("subType"),
                b2.get("bowelPrepPlan"),
                b2.get("distalLimbCheck"),
                *(b3.get("tumorLocation") or []),
                b3.get("preopHistology"),
                b3.get("crmStatus"),
                b3.get("multimodalStatus"),
                b3.get("mdtReviewStatus"),
                b4.get("neoplasmCategory"),
                b4.get("biopsyStatus"),
                b4.get("extentEvaluation"),
                b4.get("mdtOrSpecialistConsult"),
            ]
            for v in vals:
                if v and v != "not_applicable":
                    lbl = ctx_map.get(v)
                    if not lbl or snake_re.search(lbl):
                        unlocalized.append((c.get("sandboxScenarioCode"), v, lbl))

            em_ch = (((c.get("approval") or {}).get("emergencyException") or {}).get("verbalConsultRecord") or {}).get("contactChannel")
            if em_ch and not ch_map.get(em_ch):
                unlocalized.append((c.get("sandboxScenarioCode"), f"contactChannel:{em_ch}", None))

        self.assertEqual(unlocalized, [], f"Unlocalized clinical context / channel enums found: {unlocalized}")
        self.assertEqual(ctx_map.get("stoma_management"), "Quản lý / Đóng hậu môn nhân tạo")

        # 2. Verify all WAL action strings emitted by surgery_approval_routes.py are localized in SAP_WAL_ACTION_LABELS
        route_actions = set(re.findall(r'"action":\s*"([a-z0-9_]+)"', routes_py))
        self.assertGreaterEqual(len(route_actions), 15)
        missing_wal = [a for a in sorted(route_actions) if a not in wal_map]
        self.assertEqual(missing_wal, [], f"Unlocalized WAL action codes: {missing_wal}")
        self.assertNotIn("`${e.action}`", sap_js)

    def test_feat205_full_scrollable_309_catalog_browser_zero_select(self) -> None:
        sap_js = (REPO_ROOT / "js" / "surgery-approval.js").read_text(encoding="utf-8")
        sap_css = SURGERY_APPROVAL_CSS.read_text(encoding="utf-8")
        catalog_json = json.loads((REPO_ROOT / "data" / "procedure_catalog_2026_v1.json").read_text(encoding="utf-8"))
        self.assertEqual(len(catalog_json.get("procedures") or []), 309)

        for required_symbol in (
            "openCatalogBrowser(",
            "toggleCatalogBrowser(",
            "setCatalogBrowseFilter(",
            "clearCatalogSearchAndBrowse(",
            "_renderCatalogBrowserBoxHtml(",
            "sap-btn-toggle-catalog-browse",
            "sap-catalog-results--browse",
        ):
            self.assertIn(required_symbol, sap_js, f"Missing {required_symbol} for 309-procedure scrollable browser")

        # Must NOT contain <select> inside catalog browser and must NOT hard-truncate catalog procedures to .slice(0, 20)
        catalog_section = sap_js.split("_getFilteredCatalogProcedures(s)", 1)[1].split("_syncCatalogBrowserDom(", 1)[0]
        self.assertNotIn(".slice(0, 20)", catalog_section)
        self.assertNotIn("<select", catalog_section.lower())
        self.assertIn(".sap-catalog-results--browse", sap_css)
        self.assertIn(".sap-catalog-group-header", sap_css)


if __name__ == "__main__":
    unittest.main()
