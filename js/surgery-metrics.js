// ===== SURGERY METRICS — Shared Statistical Calculation Module =====
const SurgeryMetrics = {
    /**
     * Calculate Minimally Invasive Surgery (MIS) & approach statistics
     * @param {Array} cases - Array of surgery objects
     * @returns {Object} MIS statistics breakdown
     */
    calculateMIS(cases) {
        if (!cases || !Array.isArray(cases)) {
            return { total: 0, noisoi: 0, robot: 0, mo: 0, nsth: 0, misCases: 0, misPct: 0, noisoiPct: 0, robotPct: 0, openPct: 0 };
        }
        const total = cases.length;
        const noisoi = cases.filter(s => s && s.approachType === 'noisoi').length;
        const robot = cases.filter(s => s && (s.approachType === 'robot' || s.surgeryType === 'robot')).length;
        const mo = cases.filter(s => s && s.approachType === 'mo').length;
        const nsth = cases.filter(s => s && s.approachType === 'nsth').length;
        const misCases = noisoi + robot;

        return {
            total,
            noisoi,
            robot,
            mo,
            nsth,
            misCases,
            misPct: total > 0 ? Number((misCases / total * 100).toFixed(1)) : 0,
            noisoiPct: total > 0 ? Number((noisoi / total * 100).toFixed(1)) : 0,
            robotPct: total > 0 ? Number((robot / total * 100).toFixed(1)) : 0,
            openPct: total > 0 ? Number((mo / total * 100).toFixed(1)) : 0
        };
    },

    /**
     * Calculate surgery type breakdown (Yêu cầu, Chương trình, Bán khẩn, Robot)
     * @param {Array} cases - Array of surgery objects
     * @returns {Object} Type breakdown
     */
    calculateTypeBreakdown(cases) {
        if (!cases || !Array.isArray(cases)) {
            return { total: 0, yeucau: 0, chuongtrinh: 0, bankhan: 0, robot: 0, yeucauPct: 0, chuongtrinhPct: 0, bankhanPct: 0, robotPct: 0 };
        }
        const total = cases.length;
        const yeucau = cases.filter(s => s && s.surgeryType === 'yeucau').length;
        const chuongtrinh = cases.filter(s => s && s.surgeryType === 'chuongtrinh').length;
        const bankhan = cases.filter(s => s && s.surgeryType === 'bankhan').length;
        const robot = cases.filter(s => s && (s.surgeryType === 'robot' || s.approachType === 'robot')).length;

        return {
            total,
            yeucau,
            chuongtrinh,
            bankhan,
            robot,
            yeucauPct: total > 0 ? Number((yeucau / total * 100).toFixed(1)) : 0,
            chuongtrinhPct: total > 0 ? Number((chuongtrinh / total * 100).toFixed(1)) : 0,
            bankhanPct: total > 0 ? Number((bankhan / total * 100).toFixed(1)) : 0,
            robotPct: total > 0 ? Number((robot / total * 100).toFixed(1)) : 0
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
                    bankhan: types.bankhan
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
