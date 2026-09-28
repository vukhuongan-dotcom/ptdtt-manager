// Test Suite for Smart Duplicate Surgery Detection & Resolution
// Run with: node scripts/test_duplicate_warning.js

const assert = require('assert');

// Mock Utils
const Utils = {
    formatDate: (d) => {
        if (!d) return '';
        const parts = d.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    },
    escapeHtml: (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    getStaffName: (id) => (id === 1 ? 'BS. Nguyễn Văn A' : 'BS. Khác'),
    toProperCase: (str) => (str || '').trim().replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
};

// Extracted methods from SurgeryPage in js/surgery.js
const SurgeryPage = {
    _surgeries: [],
    getAllSurgeries() {
        return this._surgeries;
    },

    _normalizePatientName(str) {
        if (!str) return '';
        return str.trim()
            .replace(/\s+/g, ' ')
            .toLowerCase()
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'd')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    },

    _getMondayOfWeek(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('T')[0].split('-');
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const day = d.getDay();
        d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    _getSundayOfWeek(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('T')[0].split('-');
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const day = d.getDay();
        d.setDate(d.getDate() + (day === 0 ? 0 : 7 - day));
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    _findDuplicateSurgeries(candidate, currentId) {
        if (!candidate || !candidate.patientName) return [];
        const candName = this._normalizePatientName(candidate.patientName);
        if (!candName) return [];

        const candAdm = (candidate.admissionId || '').trim();
        const candYear = candidate.birthYear ? parseInt(candidate.birthYear, 10) : null;
        const candDate = candidate.date || '';
        const monday = this._getMondayOfWeek(candDate);
        const sunday = this._getSundayOfWeek(candDate);

        const all = this.getAllSurgeries();
        const matches = [];

        for (const s of all) {
            if (currentId && String(s.id) === String(currentId)) continue;
            const existName = this._normalizePatientName(s.patientName);
            const existAdm = (s.admissionId || '').trim();
            const existYear = s.birthYear ? parseInt(s.birthYear, 10) : null;
            const existDate = s.date || '';

            // Cấp 1: Trùng số BA cùng ngày
            if (candAdm && existAdm && candAdm === existAdm && existDate === candDate) {
                matches.push({
                    level: 1,
                    levelLabel: 'Trùng số BA cùng ngày',
                    severity: 'danger',
                    surgery: s,
                    reason: `Trùng số nhập viện (${existAdm}) trong cùng ngày mổ ${Utils.formatDate(candDate)}.`
                });
                continue;
            }

            // Cấp 2: Trùng số BA khác ngày
            if (candAdm && existAdm && candAdm === existAdm && existDate !== candDate) {
                const inSameWeek = existDate >= monday && existDate <= sunday;
                matches.push({
                    level: 2,
                    levelLabel: inSameWeek ? 'Trùng số BA khác ngày trong tuần' : 'Trùng số BA đợt nằm viện',
                    severity: 'warning',
                    surgery: s,
                    inSameWeek: inSameWeek,
                    reason: `Trùng số nhập viện (${existAdm}) với ca ngày ${Utils.formatDate(existDate)}.`
                });
                continue;
            }

            // Cấp 3: Trùng tên và năm sinh cùng ngày
            if (candName === existName && candYear && existYear && candYear === existYear && existDate === candDate) {
                matches.push({
                    level: 3,
                    levelLabel: 'Trùng tên và năm sinh cùng ngày',
                    severity: 'danger',
                    surgery: s,
                    reason: `Trùng họ tên và năm sinh (${existYear}) trong cùng ngày mổ ${Utils.formatDate(candDate)}.`
                });
                continue;
            }

            // Cấp 4: Trùng tên và năm sinh khác ngày trong tuần
            if (candName === existName && candYear && existYear && candYear === existYear && existDate !== candDate && existDate >= monday && existDate <= sunday) {
                matches.push({
                    level: 4,
                    levelLabel: 'Trùng tên và năm sinh khác ngày trong tuần',
                    severity: 'warning',
                    surgery: s,
                    inSameWeek: true,
                    reason: `Bệnh nhân đã có ca mổ vào ${Utils.formatDate(existDate)} (cùng tuần).`
                });
                continue;
            }

            // Cấp 5: Trùng tên thiếu tuổi cùng ngày
            if (candName === existName && (!candYear || !existYear) && existDate === candDate) {
                matches.push({
                    level: 5,
                    levelLabel: 'Trùng họ tên (chưa đủ năm sinh)',
                    severity: 'info',
                    surgery: s,
                    reason: `Trùng họ tên với ca ngày ${Utils.formatDate(candDate)} (chưa đủ năm sinh đối chiếu).`
                });
                continue;
            }
        }

        matches.sort((a, b) => a.level - b.level);
        return matches;
    },

    _renderPatientWeeklyBadge(s, weekSurgeries) {
        if (!s || !s.duplicateOverride) return '';
        if (s.duplicateOverride.type === 'different_patient_same_name') {
            return `<span class="badge-different-patient" title="Bệnh nhân trùng tên với ca khác trên lịch">👥 Trùng tên</span>`;
        }

        if (s.duplicateOverride.type === 'same_patient_multicase') {
            if (!Array.isArray(weekSurgeries)) return `<span class="badge-duplicate-patient" title="Bệnh nhân có nhiều ca mổ trong tuần">⚡ Mổ nhiều thì</span>`;
            const candName = this._normalizePatientName(s.patientName);
            const candAdm = (s.admissionId || '').trim();
            const candYear = s.birthYear ? parseInt(s.birthYear, 10) : null;

            const count = weekSurgeries.filter(x => {
                const existAdm = (x.admissionId || '').trim();
                if (candAdm && existAdm && candAdm === existAdm) return true;
                const existName = this._normalizePatientName(x.patientName);
                const existYear = x.birthYear ? parseInt(x.birthYear, 10) : null;
                return candName === existName && candYear && existYear && candYear === existYear;
            }).length;

            if (count >= 2) {
                return `<span class="badge-duplicate-patient" title="Bệnh nhân có ${count} ca mổ trong tuần này">⚡ ${count} ca/tuần</span>`;
            }
        }

        return '';
    }
};

console.log('--- RUNNING TESTS FOR SMART DUPLICATE WARNING ---');

// TC-01: Name normalization
console.log('Testing TC-01: Name normalization...');
assert.strictEqual(SurgeryPage._normalizePatientName('  NGUYỄN   VĂN   A  '), 'nguyen van a');
assert.strictEqual(SurgeryPage._normalizePatientName('Đỗ Đăng Định'), 'do dang dinh');
assert.strictEqual(SurgeryPage._normalizePatientName('TRẦN  đỨC   đẠT'), 'tran duc dat');
console.log('✅ TC-01 passed');

// TC-02: Monday and Sunday of Week
console.log('Testing TC-02: Monday/Sunday week boundary calculation...');
// 2026-09-28 is a Monday
assert.strictEqual(SurgeryPage._getMondayOfWeek('2026-09-28'), '2026-09-28');
assert.strictEqual(SurgeryPage._getSundayOfWeek('2026-09-28'), '2026-10-04');
// 2026-10-04 is a Sunday of that same week
assert.strictEqual(SurgeryPage._getMondayOfWeek('2026-10-04'), '2026-09-28');
assert.strictEqual(SurgeryPage._getSundayOfWeek('2026-10-04'), '2026-10-04');
// Wednesday 2026-09-30
assert.strictEqual(SurgeryPage._getMondayOfWeek('2026-09-30'), '2026-09-28');
assert.strictEqual(SurgeryPage._getSundayOfWeek('2026-09-30'), '2026-10-04');
console.log('✅ TC-02 passed');

// TC-03: Duplicate Detection Levels 1 to 5
console.log('Testing TC-03: Duplicate Detection Levels...');
SurgeryPage._surgeries = [
    {
        id: 101,
        patientName: 'Nguyễn Văn An',
        birthYear: 1975,
        admissionId: 'BA12345',
        date: '2026-09-28',
        diagnosis: 'K đại tràng',
        mainSurgeon: 1
    },
    {
        id: 102,
        patientName: 'Trần Thị Bình',
        birthYear: 1980,
        admissionId: 'BA67890',
        date: '2026-09-29',
        diagnosis: 'Trĩ độ 3',
        mainSurgeon: 1
    },
    {
        id: 103,
        patientName: 'Lê Văn Chung',
        birthYear: 1960,
        admissionId: 'BA11223',
        date: '2026-09-30',
        diagnosis: 'Polyp đại tràng',
        mainSurgeon: 1
    }
];

// Match Cấp 1: Cùng số BA cùng ngày
const match1 = SurgeryPage._findDuplicateSurgeries({
    patientName: 'Nguyễn Văn An',
    birthYear: 1975,
    admissionId: 'BA12345',
    date: '2026-09-28'
});
assert.strictEqual(match1.length, 1);
assert.strictEqual(match1[0].level, 1);
assert.strictEqual(match1[0].surgery.id, 101);
console.log('  Level 1 match verified');

// Match Cấp 2: Cùng số BA khác ngày trong tuần (2026-09-28 vs 2026-10-01)
const match2 = SurgeryPage._findDuplicateSurgeries({
    patientName: 'Nguyễn Văn An',
    birthYear: 1975,
    admissionId: 'BA12345',
    date: '2026-10-01'
});
assert.strictEqual(match2.length, 1);
assert.strictEqual(match2[0].level, 2);
assert.strictEqual(match2[0].inSameWeek, true);
console.log('  Level 2 match verified');

// Match Cấp 3: Trùng tên + năm sinh cùng ngày (không nhập hoặc khác số BA)
const match3 = SurgeryPage._findDuplicateSurgeries({
    patientName: 'Nguyễn Văn An',
    birthYear: 1975,
    admissionId: '',
    date: '2026-09-28'
});
assert.strictEqual(match3.length, 1);
assert.strictEqual(match3[0].level, 3);
console.log('  Level 3 match verified');

// Match Cấp 4: Trùng tên + năm sinh khác ngày trong tuần
const match4 = SurgeryPage._findDuplicateSurgeries({
    patientName: 'Nguyễn Văn An',
    birthYear: 1975,
    admissionId: '',
    date: '2026-10-02'
});
assert.strictEqual(match4.length, 1);
assert.strictEqual(match4[0].level, 4);
assert.strictEqual(match4[0].inSameWeek, true);
console.log('  Level 4 match verified');

// Match Cấp 5: Trùng tên thiếu năm sinh cùng ngày
const match5 = SurgeryPage._findDuplicateSurgeries({
    patientName: 'Nguyễn Văn An',
    birthYear: '',
    admissionId: '',
    date: '2026-09-28'
});
assert.strictEqual(match5.length, 1);
assert.strictEqual(match5[0].level, 5);
console.log('  Level 5 match verified');

// Exclude self (currentId)
const matchSelf = SurgeryPage._findDuplicateSurgeries({
    patientName: 'Nguyễn Văn An',
    birthYear: 1975,
    admissionId: 'BA12345',
    date: '2026-09-28'
}, 101);
assert.strictEqual(matchSelf.length, 0);
console.log('  Self-exclusion verified');
console.log('✅ TC-03 passed');

// TC-04: Badges for Same Patient vs Different Patient
console.log('Testing TC-04: Patient Badges...');
const weekSurgeries = [
    {
        id: 201,
        patientName: 'Đặng Quốc Toàn',
        birthYear: 1970,
        admissionId: 'BA999',
        date: '2026-09-28',
        duplicateOverride: { type: 'same_patient_multicase' }
    },
    {
        id: 202,
        patientName: 'Đặng Quốc Toàn',
        birthYear: 1970,
        admissionId: 'BA999',
        date: '2026-09-30',
        duplicateOverride: { type: 'same_patient_multicase' }
    }
];

const badgeMulticase = SurgeryPage._renderPatientWeeklyBadge(weekSurgeries[0], weekSurgeries);
assert(badgeMulticase.includes('⚡ 2 ca/tuần'), 'Badge should show 2 ca/tuần');

const diffPatientSurgery = {
    id: 301,
    patientName: 'Nguyễn Văn A',
    duplicateOverride: { type: 'different_patient_same_name' }
};
const badgeDiff = SurgeryPage._renderPatientWeeklyBadge(diffPatientSurgery, []);
assert(badgeDiff.includes('👥 Trùng tên'), 'Badge should show Trùng tên');
console.log('✅ TC-04 passed');

console.log('--- ALL TEST CASES PASSED SUCCESSFULLY ---');
