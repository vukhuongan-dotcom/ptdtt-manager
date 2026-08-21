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
     * @param {number} numMonths - Number of past months (default 6)
     * @returns {Array} Array of monthly data items
     */
    getMonthlyTrend(allSurgeries, numMonths = 6) {
        const surgeries = allSurgeries || [];
        const now = new Date();
        const months = [];

        for (let i = numMonths - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = d.getMonth();
            const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(y, m + 1, 0).getDate();
            const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            const label = `Tháng ${m + 1}/${y}`;
            const shortLabel = `T${m + 1}`;

            const monthCases = surgeries.filter(s => s && s.date && s.date >= startStr && s.date <= endStr);
            const types = this.calculateTypeBreakdown(monthCases);
            const mis = this.calculateMIS(monthCases);

            const isCurrentMonth = (i === 0);
            let runRateProjected = types.total;

            if (isCurrentMonth) {
                const currentDay = now.getDate();
                if (currentDay > 0 && currentDay < lastDay) {
                    runRateProjected = Math.round((types.total / currentDay) * lastDay);
                }
            }

            months.push({
                key: `${y}-${String(m + 1).padStart(2, '0')}`,
                label,
                shortLabel,
                year: y,
                month: m + 1,
                isCurrentMonth,
                total: types.total,
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
     * Calculate working days run-rate projection
     * @param {number} actualCases - Cases recorded so far in current month
     * @param {number} currentDay - Current day of month (e.g. 21)
     * @param {number} totalDays - Total days in month (e.g. 31)
     * @returns {Object} Detailed projection
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
