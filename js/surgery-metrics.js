// ===== SURGERY METRICS — Shared Statistical Calculation Module =====
const SurgeryMetrics = {
    /**
     * Resolve canonical surgery type (yeucau | chuongtrinh | bankhan | robot | unknown)
     * Mutually exclusive partition contract
     * @param {Object} s - Surgery record
     * @returns {string} Canonical surgery type
     */
    resolveSurgeryType(s) {
        if (!s) return 'unknown';
        const t = String(s.surgeryType || '').trim();
        if (t === 'yeucau' || t === 'chuongtrinh' || t === 'bankhan' || t === 'robot') return t;
        // Fallback to 'robot' ONLY when surgeryType is empty but approachType is 'robot'
        if (!t && String(s.approachType || '').trim() === 'robot') return 'robot';
        return 'unknown';
    },

    /**
     * Resolve canonical surgical approach (mo | noisoi | robot | nsth | unknown)
     * Mutually exclusive partition contract
     * @param {Object} s - Surgery record
     * @returns {string} Canonical surgical approach
     */
    resolveApproach(s) {
        if (!s) return 'unknown';
        const a = String(s.approachType || '').trim();
        if (a === 'mo' || a === 'noisoi' || a === 'robot' || a === 'nsth') return a;
        // Fallback to 'robot' ONLY when approachType is empty but surgeryType is 'robot'
        if (!a && String(s.surgeryType || '').trim() === 'robot') return 'robot';
        return 'unknown';
    },

    /**
     * Calculate Minimally Invasive Surgery (MIS) & approach statistics
     * @param {Array} cases - Array of surgery objects
     * @returns {Object} MIS statistics breakdown
     */
    calculateMIS(cases) {
        if (!cases || !Array.isArray(cases)) {
            return { total: 0, noisoi: 0, robot: 0, mo: 0, nsth: 0, unknown: 0, misCases: 0, misPct: 0, noisoiPct: 0, robotPct: 0, openPct: 0, nsthPct: 0, unknownPct: 0 };
        }
        const total = cases.length;
        const counts = { noisoi: 0, robot: 0, mo: 0, nsth: 0, unknown: 0 };
        for (const s of cases) {
            const app = this.resolveApproach(s);
            counts[app] = (counts[app] || 0) + 1;
        }
        const misCases = counts.noisoi + counts.robot;
        const pct = (n) => total > 0 ? Number((n / total * 100).toFixed(1)) : 0;

        return {
            total,
            ...counts,
            misCases,
            misPct: pct(misCases),
            noisoiPct: pct(counts.noisoi),
            robotPct: pct(counts.robot),
            openPct: pct(counts.mo),
            nsthPct: pct(counts.nsth),
            unknownPct: pct(counts.unknown)
        };
    },

    /**
     * Calculate surgery type breakdown (Yêu cầu, Chương trình, Bán khẩn, Robot, Chưa rõ)
     * @param {Array} cases - Array of surgery objects
     * @returns {Object} Type breakdown
     */
    calculateTypeBreakdown(cases) {
        if (!cases || !Array.isArray(cases)) {
            return { total: 0, yeucau: 0, chuongtrinh: 0, bankhan: 0, robot: 0, unknown: 0, yeucauPct: 0, chuongtrinhPct: 0, bankhanPct: 0, robotPct: 0, unknownPct: 0 };
        }
        const total = cases.length;
        const counts = { yeucau: 0, chuongtrinh: 0, bankhan: 0, robot: 0, unknown: 0 };
        for (const s of cases) {
            const t = this.resolveSurgeryType(s);
            counts[t] = (counts[t] || 0) + 1;
        }
        const pct = (n) => total > 0 ? Number((n / total * 100).toFixed(1)) : 0;

        return {
            total,
            ...counts,
            yeucauPct: pct(counts.yeucau),
            chuongtrinhPct: pct(counts.chuongtrinh),
            bankhanPct: pct(counts.bankhan),
            robotPct: pct(counts.robot),
            unknownPct: pct(counts.unknown)
        };
    },

    /**
     * Get monthly trend series for a specified number of months
     * @param {Array} allSurgeries - All surgery records from Store
     * @param {number|string} numMonths - Number of months (6, 12, 'year'/'ytd')
     * @param {Date} [refDate] - Optional reference date (defaults to new Date())
     * @returns {Array} Array of monthly data items
     */
    getMonthlyTrend(allSurgeries, numMonths = 6, refDate = new Date()) {
        const surgeries = allSurgeries || [];
        const now = (refDate && typeof refDate.getTime === 'function' && !isNaN(refDate.getTime()))
            ? new Date(refDate.getTime())
            : new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const months = [];

        let count = 6;
        if (numMonths === 'year' || numMonths === 'ytd') {
            count = now.getMonth() + 1;
        } else if (typeof numMonths === 'number' && numMonths > 0) {
            count = numMonths;
        } else if (typeof numMonths === 'string' && !isNaN(parseInt(numMonths))) {
            count = parseInt(numMonths);
        }

        for (let i = count - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = d.getMonth();
            const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(y, m + 1, 0).getDate();
            const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            const label = `Tháng ${m + 1}/${y}`;
            const shortLabel = `T${m + 1}`;

            const isCurrentMonth = (i === 0);
            const maxStr = isCurrentMonth ? todayStr : endStr;
            const monthCases = surgeries.filter(s => s && s.date && s.date >= startStr && s.date <= maxStr);
            const scheduledAfterToday = isCurrentMonth
                ? surgeries.filter(s => s && s.date && s.date > todayStr && s.date <= endStr).length
                : 0;
            const latestCaseDateInMonth = monthCases.length > 0
                ? monthCases.map(s => s.date).sort().slice(-1)[0]
                : null;
            const types = this.calculateTypeBreakdown(monthCases);
            const mis = this.calculateMIS(monthCases);

            // V2-04: Do not extrapolate run-rate projection automatically without verified cutoff coverage
            const runRateProjected = null;

            months.push({
                key: `${y}-${String(m + 1).padStart(2, '0')}`,
                label,
                shortLabel,
                year: y,
                month: m + 1,
                isCurrentMonth,
                cutoffDate: maxStr,
                total: types.total,
                scheduledAfterToday,
                latestCaseDateInMonth,
                runRateProjected,
                byType: {
                    yeucau: types.yeucau,
                    chuongtrinh: types.chuongtrinh,
                    robot: types.robot,
                    bankhan: types.bankhan,
                    unknown: types.unknown
                },
                mis
            });
        }

        return months;
    },

    /**
     * Compute reference average strictly across completed calendar months (!isCurrentMonth)
     * @param {Array} monthsData - Output of getMonthlyTrend
     * @returns {{ avgValue: number|null, completedCount: number }}
     */
    computeAverageReference(monthsData) {
        const completedMonths = (monthsData || []).filter(m => m && !m.isCurrentMonth);
        if (completedMonths.length === 0) {
            return { avgValue: null, completedCount: 0, completedMonths: [] };
        }
        const sum = completedMonths.reduce((acc, m) => acc + (m.total || 0), 0);
        return {
            avgValue: sum / completedMonths.length,
            completedCount: completedMonths.length,
            completedMonths
        };
    },

    /**
     * Calculate working days run-rate projection (explicit opt-in helper)
     */
    calculateDetailedProjection(actualCases, currentDay, totalDays) {
        if (currentDay <= 0) return { calendarProjected: 0, paceDiff: 0 };
        const calendarProjected = Math.round((actualCases / currentDay) * totalDays);
        return {
            actualCases,
            currentDay,
            totalDays,
            calendarProjected
        };
    }
};

if (typeof window !== 'undefined') {
    window.SurgeryMetrics = SurgeryMetrics;
}
