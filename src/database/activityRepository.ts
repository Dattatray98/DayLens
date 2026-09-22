import { initDatabase } from "./configDatabase";

export type AnalysisPeriod = "weekly" | "monthly";

export interface DailyActivityPoint {
    date: string;
    dayLabel: string;
    shortDay: string;
    calories: number;
    protein: number;
    foodCount: number;
    metricLogsCount: number;
    hasData: boolean;
    isToday: boolean;
}

export interface ActivityAnalysisSummary {
    period: AnalysisPeriod;
    periodLabel: string;
    startDate: string;
    endDate: string;
    totalTrackedDays: number;
    totalPeriodDays: number;
    consistencyPercentage: number;
    totalFoodEntries: number;
    totalCalories: number;
    avgCalories: number;
    totalProtein: number;
    avgProtein: number;
    totalMetricLogs: number;
    activeMetricsCount: number;
    dailyData: DailyActivityPoint[];
    insights: string[];
    hasAnyData: boolean;
}

const formatDateIso = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/**
 * Calculates date range for current week (Monday through Sunday)
 * or current month (1st through last day of month).
 */
export const getAnalysisDateRange = (period: AnalysisPeriod, refDate = new Date()) => {
    if (period === "weekly") {
        const dayOfWeek = refDate.getDay();
        const diffToMonday = (dayOfWeek + 6) % 7;
        const monday = new Date(refDate);
        monday.setDate(refDate.getDate() - diffToMonday);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const startDate = formatDateIso(monday);
        const endDate = formatDateIso(sunday);

        const monStr = `${MONTH_NAMES[monday.getMonth()]} ${monday.getDate()}`;
        const sunStr = `${MONTH_NAMES[sunday.getMonth()]} ${sunday.getDate()}, ${sunday.getFullYear()}`;

        return {
            startDate,
            endDate,
            periodLabel: `${monStr} – ${sunStr}`,
            daysCount: 7,
        };
    } else {
        const startOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
        const endOfMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);

        const startDate = formatDateIso(startOfMonth);
        const endDate = formatDateIso(endOfMonth);

        const monthName = refDate.toLocaleDateString("en-US", { month: "long" });
        const periodLabel = `${monthName} ${refDate.getFullYear()}`;

        return {
            startDate,
            endDate,
            periodLabel,
            daysCount: endOfMonth.getDate(),
        };
    }
};

/**
 * Fetches and aggregates food logs, metric logs, and active targets
 * for the selected analysis period (weekly or monthly).
 */
export const getActivityAnalysis = async (
    period: AnalysisPeriod
): Promise<ActivityAnalysisSummary> => {
    const db = await initDatabase();
    const now = new Date();
    const todayIso = formatDateIso(now);
    const { startDate, endDate, periodLabel, daysCount } = getAnalysisDateRange(period, now);

    // 1. Query food logs aggregated by day
    const foodLogsRes = await db.query(
        `
        SELECT
            date(timestamp, 'localtime') AS date,
            COUNT(*) AS food_count,
            COALESCE(SUM(calories), 0) AS calories,
            COALESCE(SUM(protein), 0) AS protein
        FROM food_logs
        WHERE date(timestamp, 'localtime') BETWEEN ? AND ?
        GROUP BY date(timestamp, 'localtime')
        ORDER BY date ASC
        `,
        [startDate, endDate]
    );

    // 2. Query metric logs aggregated by day
    const metricLogsRes = await db.query(
        `
        SELECT
            date(timestamp, 'localtime') AS date,
            COUNT(*) AS log_count
        FROM metric_logs
        WHERE date(timestamp, 'localtime') BETWEEN ? AND ?
        GROUP BY date(timestamp, 'localtime')
        ORDER BY date ASC
        `,
        [startDate, endDate]
    );

    // 3. Query active unarchived metrics count
    const metricsRes = await db.query(
        `
        SELECT COUNT(*) AS count
        FROM metrics
        WHERE archived = 0 AND enabled = 1
        `
    );

    const activeMetricsCount = Number(metricsRes.values?.[0]?.count ?? 0);

    // Build lookup maps by date string
    const foodMap = new Map<string, { foodCount: number; calories: number; protein: number }>();
    for (const row of foodLogsRes.values ?? []) {
        const dateKey = String(row.date);
        foodMap.set(dateKey, {
            foodCount: Number(row.food_count ?? 0),
            calories: Number(Number(row.calories ?? 0).toFixed(1)),
            protein: Number(Number(row.protein ?? 0).toFixed(1)),
        });
    }

    const metricLogsMap = new Map<string, number>();
    for (const row of metricLogsRes.values ?? []) {
        const dateKey = String(row.date);
        metricLogsMap.set(dateKey, Number(row.log_count ?? 0));
    }

    // 4. Construct continuous day-by-day points
    const dailyData: DailyActivityPoint[] = [];
    let curDate = new Date(startDate + "T12:00:00");
    const endDateTime = new Date(endDate + "T12:00:00").getTime();

    let totalFoodEntries = 0;
    let totalCalories = 0;
    let totalProtein = 0;
    let totalMetricLogs = 0;
    let trackedDaysCount = 0;

    let peakCalorieDay: { label: string; calories: number } | null = null;
    let peakProteinDay: { label: string; protein: number } | null = null;

    while (curDate.getTime() <= endDateTime) {
        const dateStr = formatDateIso(curDate);
        const food = foodMap.get(dateStr) ?? { foodCount: 0, calories: 0, protein: 0 };
        const metricLogCount = metricLogsMap.get(dateStr) ?? 0;

        const hasData = food.foodCount > 0 || metricLogCount > 0;
        if (hasData) {
            trackedDaysCount += 1;
        }

        totalFoodEntries += food.foodCount;
        totalCalories += food.calories;
        totalProtein += food.protein;
        totalMetricLogs += metricLogCount;

        const dayOfWeek = DAY_NAMES[curDate.getDay()];
        const shortDay = period === "weekly" ? dayOfWeek : String(curDate.getDate());
        const dayLabel = period === "weekly" ? dayOfWeek : `${curDate.getDate()} ${MONTH_NAMES[curDate.getMonth()]}`;

        if (food.calories > 0 && (!peakCalorieDay || food.calories > peakCalorieDay.calories)) {
            peakCalorieDay = { label: dayLabel, calories: food.calories };
        }
        if (food.protein > 0 && (!peakProteinDay || food.protein > peakProteinDay.protein)) {
            peakProteinDay = { label: dayLabel, protein: food.protein };
        }

        dailyData.push({
            date: dateStr,
            dayLabel,
            shortDay,
            calories: food.calories,
            protein: food.protein,
            foodCount: food.foodCount,
            metricLogsCount: metricLogCount,
            hasData,
            isToday: dateStr === todayIso,
        });

        // Step forward 1 day
        curDate.setDate(curDate.getDate() + 1);
    }

    const hasAnyData = totalFoodEntries > 0 || totalMetricLogs > 0;
    const consistencyPercentage = daysCount > 0 ? Math.round((trackedDaysCount / daysCount) * 100) : 0;
    const avgCalories = trackedDaysCount > 0 ? Math.round(totalCalories / trackedDaysCount) : 0;
    const avgProtein = trackedDaysCount > 0 ? Math.round(totalProtein / trackedDaysCount) : 0;

    // 5. Generate truthful, factual insights without medical claims
    const insights: string[] = [];

    if (!hasAnyData) {
        insights.push("No activity records found for this period.");
    } else {
        // Consistency insight
        insights.push(
            `Logged wellness data on ${trackedDaysCount} of ${daysCount} days (${consistencyPercentage}% tracking consistency).`
        );

        // Nutrition averages
        if (totalFoodEntries > 0) {
            insights.push(
                `Recorded ${totalFoodEntries} food items averaging ${avgCalories.toLocaleString()} kcal and ${avgProtein}g protein per active day.`
            );
        }

        // Peak day
        if (peakCalorieDay && peakCalorieDay.calories > 0) {
            insights.push(
                `Highest recorded calorie intake was on ${peakCalorieDay.label} (${Math.round(peakCalorieDay.calories).toLocaleString()} kcal).`
            );
        } else if (peakProteinDay && peakProteinDay.protein > 0) {
            insights.push(
                `Highest recorded protein intake was on ${peakProteinDay.label} (${Math.round(peakProteinDay.protein)}g).`
            );
        }

        // Plan check-ins
        if (totalMetricLogs > 0) {
            insights.push(
                `Logged ${totalMetricLogs} progress entries across your ${activeMetricsCount} active plan targets.`
            );
        }
    }

    return {
        period,
        periodLabel,
        startDate,
        endDate,
        totalTrackedDays: trackedDaysCount,
        totalPeriodDays: daysCount,
        consistencyPercentage,
        totalFoodEntries,
        totalCalories: Math.round(totalCalories),
        avgCalories,
        totalProtein: Math.round(totalProtein),
        avgProtein,
        totalMetricLogs,
        activeMetricsCount,
        dailyData,
        insights,
        hasAnyData,
    };
};

