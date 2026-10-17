/**
 * Automated Verification Script for Surgery Statistics Upgrade (Plan v2.0 Section 7)
 * Strictly verifies TC-01 through TC-14 from plan_audit_nang_cap_thong_ke_phau_thuat.md
 * plus TC-15 (100% Pure Vietnamese Taxonomy) and TC-16 (CSS Bundle & Version Sync).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

console.log('=== STARTING SURGERY STATS VERIFICATION (TC-01 to TC-16) ===\n');

const snapshotPath = '/Users/khuonganvu/Documents/New project 2/review_evidence/surgery_stats/deidentified_snapshot_20261017.json';
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const surgeries = snapshot.surgeries;
const staff = snapshot.staff || [];
const externalDoctors = snapshot.externalDoctors || [];
const departedStaff = snapshot.departedStaff || [];
const allDoctors = [...staff, ...externalDoctors, ...departedStaff];
const CUTOFF_DATE = '2026-10-17';
const inRangeSurgeries = surgeries.filter(s => s.date && String(s.date).slice(0, 10) <= CUTOFF_DATE);

console.log(`Loaded snapshot: ${surgeries.length} total surgeries (${inRangeSurgeries.length} <= ${CUTOFF_DATE}), ${staff.length} staff, ${externalDoctors.length} external, ${departedStaff.length} departed.\n`);

// Mock browser globals for node testing
global.window = global;
global.document = {
    documentElement: {
        getAttribute: () => 'light'
    },
    getElementById: () => null,
    createElement: () => ({
        href: '',
        download: '',
        style: {},
        click: () => {}
    }),
    body: {
        appendChild: () => {},
        removeChild: () => {}
    }
};
global.URL = {
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: () => {}
};
global.Blob = class Blob { constructor() {} };
global.Utils = {
    cssVar: (name) => {
        const vars = {
            '--primary': '#1D2357',
            '--accent': '#1878B4',
            '--state-danger': '#CB242D',
            '--chart-1': '#333C83',
            '--chart-2': '#3492D3',
            '--chart-3': '#41822E',
            '--chart-4': '#D97706',
            '--chart-5': '#EC3E6D',
            '--chart-6': '#0D9488',
            '--border': '#cbd5e1',
            '--text-primary': '#0f172a',
            '--text-secondary': '#475569',
            '--text-muted': '#64748b'
        };
        return vars[name] || '#000000';
    },
    formatDate: (d) => d,
    getStaffName: (id) => `BS #${id}`
};
global.Auth = {
    getSession: () => ({ isAdmin: true, staffId: 2, name: 'BS. Quản trị' })
};
global.App = {
    isAdmin: () => true,
    renderCurrentPage: () => {}
};
global.Toast = {
    info: () => {},
    success: () => {},
    error: () => {}
};
global.Store = {
    getAll: (key) => {
        if (key === 'staff') return staff;
        if (key === 'externalDoctors') return externalDoctors;
        if (key === 'departedStaff') return departedStaff;
        return [];
    },
    get: (key) => {
        if (key === 'staff') return staff;
        if (key === 'externalDoctors') return externalDoctors;
        if (key === 'departedStaff') return departedStaff;
        return [];
    }
};
global.StaffPage = {
    getAllStaff: () => staff
};
global.SurgeryPage = {
    getAllSurgeries: () => surgeries
};
global.SURGERY_TYPES = {
    yeucau: { label: 'Mổ Yêu cầu', color: '#8A307F' },
    chuongtrinh: { label: 'Mổ Chương trình', color: '#1878B4' },
    bankhan: { label: 'Mổ Bán khẩn', color: '#CB242D' },
    robot: { label: 'Robot', color: '#333C83' }
};

const ROOT_DIR = path.resolve(__dirname, '..');

// Load codebase scripts
require(path.join(ROOT_DIR, 'js/surgery-metrics.js'));
require(path.join(ROOT_DIR, 'js/surgery-stats.js'));

let passed = 0;
let failed = 0;

function runTest(tcId, name, fn) {
    try {
        fn();
        console.log(`✅ [${tcId}] ${name}`);
        passed++;
    } catch (err) {
        console.error(`❌ [${tcId}] ${name} FAILED:`, err.message);
        failed++;
    }
}

// =========================================================================
// TC-01: Phân loại 6 Trục + unclassified (Toàn Khoa, kỳ all <= 2026-10-17)
// =========================================================================
runTest('TC-01', 'Phân loại 6 Trục + unclassified (Toàn Khoa, N = 2.749 ca <= 2026-10-17)', () => {
    assert.strictEqual(inRangeSurgeries.length, 2749, 'Số ca <= 2026-10-17 phải đúng 2.749');
    const deptTotal = SurgeryStatsPage.computeSurgeonProfile('dept_total', inRangeSurgeries, 'main');
    const ax = deptTotal.axisCounts;
    const sumAxes = Object.values(ax).reduce((a, b) => a + b, 0) + deptTotal.unclassifiedCount;
    assert.strictEqual(sumAxes, 2749, 'Tổng 6 trục + unclassified phải đúng 2.749');

    assert.strictEqual(ax.proctology, 866, 'proctology phải = 866');
    assert.strictEqual(ax.hernia_wall, 411, 'hernia_wall phải = 411');
    assert.strictEqual(ax.colon, 406, 'colon phải = 406');
    assert.strictEqual(ax.stoma, 385, 'stoma phải = 385');
    assert.strictEqual(ax.upper_gi_combined, 379, 'upper_gi_combined phải = 379');
    assert.strictEqual(ax.rectal, 291, 'rectal phải = 291');
    assert.strictEqual(deptTotal.unclassifiedCount, 11, 'unclassified phải = 11');

    // Verify subAxis sum equals axisCount for every axis 1..6
    Object.keys(SurgeryStatsPage.CLINICAL_AXES).forEach(axisKey => {
        const subMap = SurgeryStatsPage.SUB_AXIS_MAP[axisKey] || {};
        const subSum = Object.keys(subMap).reduce((acc, sk) => acc + (deptTotal.subAxisCounts[sk] || 0), 0);
        assert.strictEqual(subSum, ax[axisKey], `Tổng subAxis của ${axisKey} (${subSum}) phải bằng axisCounts[${axisKey}] (${ax[axisKey]})`);
    });

    // Explicit assertions for all 19 sub-axes matching classifySurgeryV2 in audit_reproducible.cjs
    const expectedSubCounts = {
        colon_sigmoid: 169, colon_right: 159, colon_left: 69, colon_other_combined: 9,
        rectal_lar_tme: 198, rectal_miles_apr: 22, rectal_local_other: 71,
        procto_hemorrhoid: 437, procto_fistula_abscess: 318, procto_other_pelvic: 111,
        stoma_reversal: 315, stoma_creation_revision: 70,
        hernia_inguinal_open: 152, hernia_inguinal_mis: 139, hernia_ventral_diaphragm_other: 120,
        upper_gi_stomach_smallbowel: 198, upper_gi_biliary: 124, upper_gi_acute_combined: 57,
        unclassified_other: 11, unclassified_empty: 0
    };
    for (const [subKey, expVal] of Object.entries(expectedSubCounts)) {
        assert.strictEqual(deptTotal.subAxisCounts[subKey] || 0, expVal, `subAxisCounts[${subKey}] phải = ${expVal}`);
    }
});

// =========================================================================
// TC-02: Bản ghi rỗng & Thủ thuật ngoài tiêu hóa
// =========================================================================
runTest('TC-02', 'Bản ghi rỗng & Thủ thuật ngoài tiêu hóa trả về unclassified', () => {
    const emptyRec = SurgeryStatsPage.classifySurgeryDetail({ method: '', diagnosis: '' });
    assert.strictEqual(emptyRec.axis, 'unclassified');
    assert.strictEqual(emptyRec.subAxis, 'unclassified_empty');

    const nonGiRec = SurgeryStatsPage.classifySurgeryDetail({ method: 'Nội soi tán sỏi', diagnosis: 'Sỏi niệu quản trái' });
    assert.strictEqual(nonGiRec.axis, 'unclassified');
    assert.strictEqual(nonGiRec.subAxis, 'unclassified_other');
});

// =========================================================================
// TC-03: Chống đếm trùng Robot & MIS (5 Fixtures + Snapshot 2.749 ca & id=3429)
// =========================================================================
runTest('TC-03', 'Chống đếm trùng Robot & MIS (5 Fixtures + Snapshot 2.749 ca & ca id=3429)', () => {
    // Fixture 1: {surgeryType:'robot', approachType:'noisoi'} => misCases = 1, misPct = 100% (not 200%)
    const f1 = [{ id: 1, surgeryType: 'robot', approachType: 'noisoi' }];
    const mis1 = SurgeryMetrics.calculateMIS(f1);
    const tb1 = SurgeryMetrics.calculateTypeBreakdown(f1);
    assert.strictEqual(mis1.misCases, 1);
    assert.strictEqual(mis1.misPct, 100);
    assert.strictEqual(mis1.noisoi, 1);
    assert.strictEqual(mis1.robot, 0);
    assert.strictEqual(tb1.robot, 1);

    // Fixture 1b: {surgeryType:'robot', approachType:''} => fallback approachType = 'robot'
    const f1b = [{ id: 11, surgeryType: 'robot', approachType: '' }];
    assert.strictEqual(SurgeryMetrics.calculateMIS(f1b).robot, 1);
    assert.strictEqual(SurgeryMetrics.calculateTypeBreakdown(f1b).robot, 1);

    // Fixture 2: {surgeryType:'yeucau', approachType:'robot'} => type.yeucau = 1, type.robot = 0; approach.robot = 1
    const f2 = [{ id: 2, surgeryType: 'yeucau', approachType: 'robot' }];
    const mis2 = SurgeryMetrics.calculateMIS(f2);
    const tb2 = SurgeryMetrics.calculateTypeBreakdown(f2);
    assert.strictEqual(tb2.yeucau, 1);
    assert.strictEqual(tb2.robot, 0);
    assert.strictEqual(mis2.robot, 1);
    assert.strictEqual(mis2.misCases, 1);

    // Fixture 3: {surgeryType:'chuongtrinh', approachType:'robot'} (ca id=3429)
    const case3429 = surgeries.find(s => s.id === 3429);
    assert(case3429, 'Ca 3429 phải tồn tại trong snapshot');
    assert.strictEqual(SurgeryMetrics.resolveSurgeryType(case3429), 'chuongtrinh');
    assert.strictEqual(SurgeryMetrics.resolveApproach(case3429), 'robot');

    // Fixture 4: {surgeryType:'bankhan', approachType:'mo'}
    const f4 = [{ id: 4, surgeryType: 'bankhan', approachType: 'mo' }];
    assert.strictEqual(SurgeryMetrics.calculateMIS(f4).mo, 1);
    assert.strictEqual(SurgeryMetrics.calculateTypeBreakdown(f4).bankhan, 1);

    // Fixture 5: {surgeryType:'', approachType:''} => unknown bucket
    const f5 = [{ id: 5, surgeryType: '', approachType: '' }];
    assert.strictEqual(SurgeryMetrics.calculateMIS(f5).unknown, 1);
    assert.strictEqual(SurgeryMetrics.calculateTypeBreakdown(f5).unknown, 1);

    // Snapshot 2.749 ca check
    const tbAll = SurgeryMetrics.calculateTypeBreakdown(inRangeSurgeries);
    assert.strictEqual(tbAll.yeucau, 1559);
    assert.strictEqual(tbAll.chuongtrinh, 1055);
    assert.strictEqual(tbAll.robot, 116);
    assert.strictEqual(tbAll.bankhan, 19);
    assert.strictEqual(tbAll.unknown, 0);
    assert.strictEqual(tbAll.yeucau + tbAll.chuongtrinh + tbAll.robot + tbAll.bankhan + tbAll.unknown, 2749);

    const misAll = SurgeryMetrics.calculateMIS(inRangeSurgeries);
    assert.strictEqual(misAll.mo, 1512);
    assert.strictEqual(misAll.noisoi, 1089);
    assert.strictEqual(misAll.robot, 117);
    assert.strictEqual(misAll.nsth, 31);
    assert.strictEqual(misAll.unknown, 0);
    assert.strictEqual(misAll.misCases, 1206);
    assert.strictEqual(misAll.mo + misAll.noisoi + misAll.robot + misAll.nsth + misAll.unknown, 2749);
});

// =========================================================================
// TC-04: Định nghĩa dept_avg (Bình quân BS cơ hữu)
// =========================================================================
runTest('TC-04', 'Định nghĩa dept_avg: M=11 BS cơ hữu có ca, |S_bench|=2.525, total=229.5, assist=121.2, misPct=44.6%, meanDur=91p', () => {
    const deptAvg = SurgeryStatsPage.computeSurgeonProfile('dept_avg', inRangeSurgeries, 'main');
    assert.strictEqual(deptAvg.isBenchmark, true);
    assert.strictEqual(deptAvg.benchmarkDocCount, 11, 'M phải bằng 11 BS cơ hữu có ca mổ chính');
    assert.strictEqual(deptAvg.totalRaw, 2525, '|S_bench| phải bằng 2.525 ca');
    assert.strictEqual(deptAvg.total, 229.5, 'total trung bình phải bằng 229.5 ca/BS');
    assert.strictEqual(deptAvg.assistTotal, 121.2, 'assistTotal trung bình phải bằng 121.2 ca/BS');
    assert.strictEqual(deptAvg.misPct, 44.6, 'misPct gộp của S_bench phải bằng 44.6%');
    assert.strictEqual(deptAvg.meanDur, 91, 'meanDur gộp của S_bench phải bằng 91 phút');

    // Empty array edge case: M = 0 => safe zero profile, no NaN/Infinity
    const emptyAvg = SurgeryStatsPage.computeSurgeonProfile('dept_avg', [], 'main');
    assert.strictEqual(emptyAvg.total, 0);
    assert.strictEqual(emptyAvg.misPct, 0);
    assert.strictEqual(emptyAvg.meanDur, 0);
    assert(!Number.isNaN(emptyAvg.total) && !Number.isNaN(emptyAvg.misPct));
});

// =========================================================================
// TC-05: Khử trùng vai trò tham gia (Participated Deduplication)
// =========================================================================
runTest('TC-05', 'Khử trùng vai trò tham gia trên fixtures trùng vai trò & toàn bộ bác sĩ', () => {
    const dupMainAssist = [{ id: 101, date: '2026-10-01', mainSurgeon: 5, assistSurgeon1: 5, assistSurgeon2: 5, method: 'Cắt đại tràng', diagnosis: 'K đại tràng' }];
    const pDup1 = SurgeryStatsPage.computeSurgeonProfile(5, dupMainAssist, 'main');
    assert.strictEqual(pDup1.mainCount, 1);
    assert.strictEqual(pDup1.assistOnlyCount, 0);
    assert.strictEqual(pDup1.participatedCount, 1);

    const dupTwoAssists = [{ id: 102, date: '2026-10-01', mainSurgeon: 1, assistSurgeon1: 5, assistSurgeon2: 5, method: 'Cắt đại tràng', diagnosis: 'K đại tràng' }];
    const pDup2 = SurgeryStatsPage.computeSurgeonProfile(5, dupTwoAssists, 'main');
    assert.strictEqual(pDup2.mainCount, 0);
    assert.strictEqual(pDup2.assistOnlyCount, 1);
    assert.strictEqual(pDup2.participatedCount, 1);

    allDoctors.forEach(doc => {
        const prof = SurgeryStatsPage.computeSurgeonProfile(doc.id, inRangeSurgeries, 'main');
        assert.strictEqual(
            prof.mainCount + prof.assistOnlyCount,
            prof.participatedCount,
            `Bác sĩ ${doc.name} (id: ${doc.id}) vi phạm bất biến: main(${prof.mainCount}) + assistOnly(${prof.assistOnlyCount}) !== participated(${prof.participatedCount})`
        );
    });
});

// =========================================================================
// TC-06: Chuẩn hóa kiểu ID (Number vs String) & Hồ sơ BSNT chỉ phụ mổ (STAFF_16)
// =========================================================================
runTest('TC-06', 'Chuẩn hóa kiểu ID (16 vs "16") & Hồ sơ BSNT chỉ phụ mổ (STAFF_16: main=0, assist=2)', () => {
    const pNumMain = SurgeryStatsPage.computeSurgeonProfile(16, inRangeSurgeries, 'main');
    const pStrMain = SurgeryStatsPage.computeSurgeonProfile('16', inRangeSurgeries, 'main');
    assert.strictEqual(pNumMain.mainCount, 0);
    assert.strictEqual(pNumMain.assistOnlyCount, 2);
    assert.strictEqual(pNumMain.participatedCount, 2);
    assert.strictEqual(pNumMain.total, 0);
    assert.deepStrictEqual(pNumMain.axisCounts, pStrMain.axisCounts);

    const pAssist = SurgeryStatsPage.computeSurgeonProfile('16', inRangeSurgeries, 'assist');
    const pAll = SurgeryStatsPage.computeSurgeonProfile(16, inRangeSurgeries, 'all');
    assert.strictEqual(pAssist.total, 2, 'Ở roleScope=assist, total của STAFF_16 phải bằng 2');
    assert.strictEqual(pAll.total, 2, 'Ở roleScope=all, total của STAFF_16 phải bằng 2');
});

// =========================================================================
// TC-07: Lọc ngày YYYY-MM-DD & Trần todayStr ở mọi kỳ (all, month, quarter, year)
// =========================================================================
runTest('TC-07', 'Lọc ngày YYYY-MM-DD & Trần todayStr chặn đúng 8 ca tương lai ở mọi kỳ', () => {
    const origGetTodayStr = SurgeryStatsPage.getTodayStr;
    SurgeryStatsPage.getTodayStr = () => '2026-10-17';
    try {
        ['all', 'month', 'quarter', 'year'].forEach(p => {
            SurgeryStatsPage.period = p;
            SurgeryStatsPage.selectedMonth = 9; // October (0-indexed)
            SurgeryStatsPage.selectedQuarter = 4;
            SurgeryStatsPage.selectedYear = 2026;
            const filtered = SurgeryStatsPage.getSurgeriesInRange();
            assert(!filtered.some(s => s.date > '2026-10-17'), `Kỳ ${p} không được chứa ca sau ngày 2026-10-17`);
            const futureCnt = SurgeryStatsPage.getScheduledFutureCount();
            assert.strictEqual(futureCnt, 8, `Kỳ ${p} phải ghi nhận đúng 8 ca lịch dự kiến sau ngày 17/10/2026`);
        });
    } finally {
        SurgeryStatsPage.getTodayStr = origGetTodayStr;
        SurgeryStatsPage.period = 'all';
    }
});

// =========================================================================
// TC-08: Mẫu số Thời lượng ghi nhận (Recorded Duration)
// =========================================================================
runTest('TC-08', 'Mẫu số thời lượng ghi nhận: 2.741/2.749 ca (99.7%), ĐT-TT 157.1p (TV 180p), HM-SC 39.6p (TV 30p)', () => {
    const pTotal = SurgeryStatsPage.computeSurgeonProfile('dept_total', inRangeSurgeries, 'main');
    assert.strictEqual(pTotal.validDurCount, 2741);
    assert.strictEqual(pTotal.validDurCoveragePct, 99.7);
    assert.strictEqual(pTotal.colorectalMeanDur, 157.1);
    assert.strictEqual(pTotal.stratifiedDur.colorectal.median, 180);
    assert.strictEqual(pTotal.proctoMeanDur, 39.6);
    assert.strictEqual(pTotal.stratifiedDur.proctology.median, 30);

    // Null duration fixture
    const nullDurCases = [{ id: 901, date: '2026-10-01', mainSurgeon: 2, duration: null, method: 'Cắt trĩ', diagnosis: 'Trĩ' }];
    const pNull = SurgeryStatsPage.computeSurgeonProfile('dept_total', nullDurCases, 'main');
    assert.strictEqual(pNull.validDurCount, 0);
    assert.strictEqual(pNull.meanDur, 0);
    assert.strictEqual(pNull.medianDur, 0);
});

// =========================================================================
// TC-09: Thang Radar 0–100% không tràn khung
// =========================================================================
runTest('TC-09', 'Thang Radar 0–100% co giãn chuẩn cho 100% đơn trục, tỷ lệ 1:10 và hồ sơ 0 ca', () => {
    // Case 1: 1 case (100% on 1 axis) -> maxPctScale = 100, r/R <= 1.0
    const singleCase = [{ id: 1, date: '2026-10-01', mainSurgeon: 2, method: 'Cắt đại tràng phải', diagnosis: 'K đại tràng' }];
    const pSingle = SurgeryStatsPage.computeSurgeonProfile(2, singleCase, 'main');
    const svgSingle = SurgeryStatsPage._renderRadarSVG(pSingle, null, { mode: 'pct' });
    assert(svgSingle.includes('data-max-scale="100"'), 'Khi 1 trục = 100%, maxPctScale phải = 100');
    assert(svgSingle.includes('>100%<'), 'Nhãn vòng ngoài cùng phải là 100%');
    assert(!svgSingle.includes('NaN'), 'SVG không được chứa NaN');

    // Case 2: 2 profiles with identical % distribution but 1:10 volume
    const tenCases = Array.from({ length: 10 }, (_, idx) => ({
        id: idx + 10, date: '2026-10-01', mainSurgeon: 3, method: 'Cắt đại tràng phải', diagnosis: 'K đại tràng'
    }));
    const pTen = SurgeryStatsPage.computeSurgeonProfile(3, tenCases, 'main');
    assert.strictEqual(pSingle.axisPct.colon, pTen.axisPct.colon, 'Tỷ trọng % phải bằng nhau (100%)');
    const svgCountCompare = SurgeryStatsPage._renderRadarSVG(pSingle, pTen, { mode: 'count' });
    assert(svgCountCompare.includes('data-max-scale="12"'), 'Chế độ số ca với max=10 phải làm tròn lên bội số của 4 là 12');

    // Case 3: 0 cases profile
    const pZero = SurgeryStatsPage.computeSurgeonProfile(16, inRangeSurgeries, 'main');
    const svgZero = SurgeryStatsPage._renderRadarSVG(pZero, null, { mode: 'pct' });
    assert(!svgZero.includes('NaN'), 'Hồ sơ 0 ca không được sinh NaN trong SVG');
});

// =========================================================================
// TC-10: Tương tác Bộ lọc Logbook (Tab 1)
// =========================================================================
runTest('TC-10', 'Bộ lọc Logbook: lọc đúng 411 ca Thoát vị, 11 ca Chưa phân loại và 116 ca Loại mổ Robot', () => {
    const herniaCases = inRangeSurgeries.filter(s => SurgeryStatsPage.classifySurgery(s) === 'hernia_wall');
    assert.strictEqual(herniaCases.length, 411, 'Trục 5 Thoát vị phải lọc đúng 411 ca');

    const unclassCases = inRangeSurgeries.filter(s => SurgeryStatsPage.classifySurgery(s) === 'unclassified');
    assert.strictEqual(unclassCases.length, 11, 'Hàng Chưa phân loại phải lọc đúng 11 ca');

    const robotTypeCases = inRangeSurgeries.filter(s => SurgeryMetrics.resolveSurgeryType(s) === 'robot');
    assert.strictEqual(robotTypeCases.length, 116, 'Loại mổ Robot phải lọc đúng 116 ca');

    const robotApproachCases = inRangeSurgeries.filter(s => SurgeryMetrics.resolveApproach(s) === 'robot');
    assert.strictEqual(robotApproachCases.length, 117, 'Đường tiếp cận Robot phải lọc đúng 117 ca');
});

// =========================================================================
// TC-11: Đồng nhất 3 Đầu ra (DOM UI = Excel = PNG)
// =========================================================================
runTest('TC-11', 'Đồng nhất số liệu giữa DOM UI, Xuất Excel (3 Sheets) và Xuất PNG trên cùng ViewModel', () => {
    const origGetTodayStr = SurgeryStatsPage.getTodayStr;
    SurgeryStatsPage.getTodayStr = () => '2026-10-17';
    try {
        SurgeryStatsPage.period = 'all';
        SurgeryStatsPage.primaryDoctorId = 'dept_total';
        SurgeryStatsPage.compareDoctorId = 'none';
        SurgeryStatsPage.roleScope = 'main';
        const eligibleDocs = SurgeryStatsPage.getEligibleDoctors();

        // Render Tab 1 HTML (Single mode: Toàn Khoa)
        const tab1SingleHtml = SurgeryStatsPage._renderRadarDashboard(inRangeSurgeries, eligibleDocs);
        assert(tab1SingleHtml.includes('1206 ca (Nội soi: 1089 · Robot: 117)'), 'DOM KPI 2 phải hiển thị 1206 ca (Nội soi: 1089 · Robot: 117)');
        assert(tab1SingleHtml.includes('Loại Robot: 116 ca'), 'DOM KPI 4 phải hiển thị Loại Robot: 116 ca');
        assert(tab1SingleHtml.includes('K ĐT-TT: 504 ca (18.3%)'), 'DOM KPI 4 phải hiển thị K ĐT-TT: 504 ca (18.3%)');
        assert(tab1SingleHtml.includes('Cắt ĐT Sigma: <strong>169</strong>'), 'DOM Bảng 6 trục phải hiển thị chip phân nhóm con Cắt ĐT Sigma: 169');
        assert(tab1SingleHtml.includes('Cắt ĐT Phải / Manh tràng: <strong>159</strong>'), 'DOM Bảng 6 trục phải hiển thị chip phân nhóm con Cắt ĐT Phải / Manh tràng: 159');

        // Render Tab 1 HTML (Compare mode: Toàn Khoa vs Bình quân BS Khoa)
        SurgeryStatsPage.compareDoctorId = 'dept_avg';
        const tab1CompareHtml = SurgeryStatsPage._renderRadarDashboard(inRangeSurgeries, eligibleDocs);
        assert(tab1CompareHtml.includes('229.5'), 'DOM Compare phải hiển thị 229.5 ca/BS của dept_avg');

        // Render Tab 2 Summary Table
        SurgeryStatsPage.summaryCohortFilter = 'all';
        const tab2Html = SurgeryStatsPage._renderSummaryTable(inRangeSurgeries, eligibleDocs);
        assert(tab2Html.includes('Tất cả có ca (38) / Danh bạ (45)'), 'Tab 2 phải hiển thị thanh lọc Cohort chuẩn 38/45');
        assert(tab2Html.includes('🏥 BS Cơ hữu Khoa (11/11)'), 'Tab 2 phải hiển thị 11/11 BS cơ hữu có ca');
        assert(tab2Html.includes('🎓 BS Học viên (2/8)'), 'Tab 2 phải hiển thị 2/8 BS học viên');
        assert(tab2Html.includes('🤝 BS Phối hợp ngoài khoa (25/26)'), 'Tab 2 phải hiển thị 25/26 BS ngoài khoa');
        assert(tab2Html.includes('>117</div>'), 'Tab 2 phải hiển thị thẻ Đường mổ Robot: 117');
        assert(tab2Html.includes('>116</div>'), 'Tab 2 phải hiển thị thẻ Loại mổ Robot: 116');

        // Check Excel Export
        let exportedSheets = {};
        global.XLSX = {
            utils: {
                book_new: () => ({ SheetNames: [], Sheets: {} }),
                aoa_to_sheet: (data) => data,
                book_append_sheet: (wb, ws, name) => { exportedSheets[name] = ws; }
            },
            write: () => new Uint8Array([1, 2, 3])
        };
        SurgeryStatsPage._doExportExcel();

        const sheet2 = exportedSheets['Chi tiet'];
        assert.strictEqual(sheet2.length - 1, 2749, 'Sheet 2 Chi tiet phải có đúng 2.749 dòng dữ liệu');
        const sheet2SubAxes = sheet2.slice(1).map(r => r[7]);
        assert(sheet2SubAxes.includes('Cắt ĐT Sigma'), 'Sheet 2 cột Phân nhóm con phải có nhãn tiếng Việt chuẩn');

        // Check 2-page Doctor Profile Export & KPI 1 for BS. Phạm Vĩnh Phú (id = 7)
        SurgeryStatsPage.primaryDoctorId = 7;
        SurgeryStatsPage.compareDoctorId = 'none';
        SurgeryStatsPage.roleScope = 'main';
        const doc7DomHtml = SurgeryStatsPage._renderRadarDashboard(inRangeSurgeries, eligibleDocs);
        assert(!doc7DomHtml.includes('Mổ chính: 240 · Phụ: 95'), 'DOM KPI 1 không được hiển thị dòng chi tiết Mổ chính: 240 · Phụ: 95');
        assert(doc7DomHtml.includes('Khối lượng phẫu thuật hoàn thành'), 'DOM KPI 1 phải hiển thị nhãn Khối lượng phẫu thuật hoàn thành');

        const builtExport = SurgeryStatsPage._buildProfileExportHtml(inRangeSurgeries);
        assert(builtExport && builtExport.isTwoPage === true, 'Xuất hồ sơ bác sĩ cá nhân phải tạo đúng 2 trang (isTwoPage = true)');
        assert(builtExport.fullHtml.includes('data-page="1" data-scope="main"'), 'Ảnh xuất phải có Trang 1 (Mổ chính)');
        assert(builtExport.fullHtml.includes('TRANG 1/2 · PHẪU THUẬT VIÊN MỔ CHÍNH'), 'Trang 1 phải có tiêu đề TRANG 1/2 · PHẪU THUẬT VIÊN MỔ CHÍNH');
        assert(builtExport.fullHtml.includes('🎯 Tổng ca mổ chính'), 'Trang 1 KPI 1 phải là Tổng ca mổ chính');
        assert(builtExport.fullHtml.includes('>240</div>'), 'Trang 1 KPI 1 phải hiển thị tổng số 240');
        assert(builtExport.fullHtml.includes('data-page="2" data-scope="assist"'), 'Ảnh xuất phải có Trang 2 (Phụ mổ)');
        assert(builtExport.fullHtml.includes('TRANG 2/2 · PHẪU THUẬT VIÊN PHỤ MỔ'), 'Trang 2 phải có tiêu đề TRANG 2/2 · PHẪU THUẬT VIÊN PHỤ MỔ');
        assert(builtExport.fullHtml.includes('🎯 Tổng ca phụ mổ'), 'Trang 2 KPI 1 phải là Tổng ca phụ mổ');
        assert(builtExport.fullHtml.includes('>95</div>'), 'Trang 2 KPI 1 phải hiển thị tổng số 95');
        assert(!builtExport.fullHtml.includes('Mổ chính: 240 · Phụ: 95'), 'Ảnh xuất KPI 1 không được chứa dòng Mổ chính: 240 · Phụ: 95');
    } finally {
        SurgeryStatsPage.getTodayStr = origGetTodayStr;
        SurgeryStatsPage.primaryDoctorId = 'dept_total';
    }
});

// =========================================================================
// TC-12: Tương thích ngược với DashboardPage
// =========================================================================
runTest('TC-12', 'Tương thích ngược với DashboardPage (calculateMIS & calculateTypeBreakdown)', () => {
    const dashboardJs = fs.readFileSync(path.join(ROOT_DIR, 'js/dashboard.js'), 'utf8');
    assert(dashboardJs.includes('SurgeryMetrics.calculateMIS'), 'dashboard.js phải gọi SurgeryMetrics.calculateMIS');
    assert(dashboardJs.includes('SurgeryMetrics.calculateTypeBreakdown'), 'dashboard.js phải gọi SurgeryMetrics.calculateTypeBreakdown');

    const mis = SurgeryMetrics.calculateMIS(inRangeSurgeries);
    const tb = SurgeryMetrics.calculateTypeBreakdown(inRangeSurgeries);
    ['misPct', 'misCases', 'mo', 'noisoi', 'robot', 'nsth', 'total'].forEach(k => {
        assert(typeof mis[k] === 'number', `calculateMIS phải trả về số cho khóa ${k}`);
    });
    ['yeucau', 'chuongtrinh', 'bankhan', 'robot', 'yeucauPct', 'chuongtrinhPct', 'bankhanPct', 'robotPct', 'total'].forEach(k => {
        assert(typeof tb[k] === 'number', `calculateTypeBreakdown phải trả về số cho khóa ${k}`);
    });
});

// =========================================================================
// TC-13: Kiểm thử SVG Radar Light/Dark Mode & Export Mode
// =========================================================================
runTest('TC-13', 'SVG Radar dùng biến CSS cho Live Mode (Light/Dark) và màu in sắc nét cho Export Mode', () => {
    const p1 = SurgeryStatsPage.computeSurgeonProfile('dept_total', inRangeSurgeries, 'main');
    const p2 = SurgeryStatsPage.computeSurgeonProfile('dept_avg', inRangeSurgeries, 'main');

    const svgLive = SurgeryStatsPage._renderRadarSVG(p1, p2, { mode: 'pct', exportMode: false });
    assert(svgLive.includes('var(--text-primary'), 'Live SVG phải dùng var(--text-primary) để tương thích Dark Mode');
    assert(svgLive.includes('var(--border'), 'Live SVG phải dùng var(--border)');

    const svgExport = SurgeryStatsPage._renderRadarSVG(p1, p2, { mode: 'pct', exportMode: true });
    assert(svgExport.includes('#0f172a'), 'Export SVG phải dùng màu in #0f172a');
    assert(svgExport.includes('#cbd5e1'), 'Export SVG phải dùng màu lưới #cbd5e1');
});

// =========================================================================
// TC-14: Tái lập Toàn trình qua Script Độc lập (audit_reproducible.cjs)
// =========================================================================
runTest('TC-14', 'Chạy script độc lập audit_reproducible.cjs thoát với exit code 0', () => {
    const out = execFileSync('node', ['/Users/khuonganvu/Documents/New project 2/review_evidence/surgery_stats/audit_reproducible.cjs'], {
        encoding: 'utf8'
    });
    assert(out.includes('ALL REPRODUCIBLE AUDIT & CONTRACT ASSERTIONS PASSED'), 'audit_reproducible.cjs phải PASS 100%');
});

// =========================================================================
// TC-15: 100% Pure Vietnamese Taxonomy (Zero English in parentheses)
// =========================================================================
runTest('TC-15', '100% Tiếng Việt thuần túy trên 6 trục và 19 phân nhóm con, không có tiếng Anh trong ngoặc', () => {
    const axes = SurgeryStatsPage.CLINICAL_AXES;
    const englishWords = ['Colon', 'Rectal', 'TME', 'LAR', 'Proctology', 'Stoma', 'Hartmann', 'Hernia', 'Upper GI', 'HPB'];
    Object.entries(axes).forEach(([k, ax]) => {
        assert(!ax.label.includes('('), `Trục ${k} không được chứa ngoặc đơn trong nhãn: ${ax.label}`);
        englishWords.forEach(w => {
            assert(!ax.label.toLowerCase().includes(w.toLowerCase()), `Trục ${k} không được chứa từ tiếng Anh '${w}' trong nhãn: ${ax.label}`);
        });
        assert(!ax.sublabel.includes('('), `Trục ${k} sublabel không được chứa ngoặc đơn: ${ax.sublabel}`);
    });

    Object.entries(SurgeryStatsPage.SUB_AXIS_MAP).forEach(([axisKey, subObj]) => {
        Object.entries(subObj).forEach(([subKey, label]) => {
            assert(!label.includes('('), `Phân nhóm ${axisKey}.${subKey} không được chứa ngoặc đơn: ${label}`);
        });
    });
});

// =========================================================================
// TC-16: CSS Bundle & Synchronous Versioning (2610171645)
// =========================================================================
runTest('TC-16', 'Đồng bộ CSS Bundle (css/app.bundle.css) và phiên bản 2610171645 trên toàn hệ thống', () => {
    const EXPECTED_VER = '2610171645';
    const bundlePath = path.join(ROOT_DIR, 'css/app.bundle.css');
    assert(fs.existsSync(bundlePath), 'css/app.bundle.css phải tồn tại');
    const bundleContent = fs.readFileSync(bundlePath, 'utf8');
    ['.sstats-role-scope-tabs', '.sstats-radar-scale-toggle', '.sstats-future-notice', '.sstats-unclassified-tr', '.sstats-cohort-filter-bar'].forEach(sel => {
        assert(bundleContent.includes(sel), `css/app.bundle.css phải chứa ${sel}`);
    });

    const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
    assert(indexHtml.includes(`SW_BUILD_VER = '${EXPECTED_VER}'`), 'index.html SW_BUILD_VER phải khớp');
    assert(indexHtml.includes(`REQUIRED_VER = '${EXPECTED_VER}'`), 'index.html REQUIRED_VER phải khớp');
    assert(indexHtml.includes(`css/app.bundle.css?v=${EXPECTED_VER}`), 'index.html css bundle link phải khớp');
    assert(indexHtml.includes(`js/surgery-stats.js?v=${EXPECTED_VER}`), 'index.html surgery-stats.js link phải khớp');

    const swJs = fs.readFileSync(path.join(ROOT_DIR, 'sw.js'), 'utf8');
    assert(swJs.includes(`const CACHE_NAME = 'ptdtt-v${EXPECTED_VER}';`), 'sw.js CACHE_NAME phải khớp');

    const storeJs = fs.readFileSync(path.join(ROOT_DIR, 'js/store.js'), 'utf8');
    assert(storeJs.includes(`const CLIENT_BUILD = ${EXPECTED_VER};`), 'store.js CLIENT_BUILD phải khớp');

    const versionMd = fs.readFileSync(path.join(ROOT_DIR, 'VERSION.md'), 'utf8');
    assert.strictEqual(versionMd.trim(), EXPECTED_VER, 'VERSION.md phải khớp');
});

console.log(`\n=== KẾT QUẢ KIỂM THỬ: ${passed}/16 PASS, ${failed} FAIL ===`);
if (failed > 0) {
    process.exit(1);
} else {
    console.log('🎉 100% CÁC TEST CASES (TC-01..TC-16) ĐÃ VƯỢT QUA!');
}
