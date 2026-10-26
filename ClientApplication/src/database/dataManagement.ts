import { initDatabase } from "./configDatabase";

export interface LocalDataSummary {
    foodLogsCount: number;
    metricLogsCount: number;
    metricsCount: number;
}

/**
 * Retrieves the count of stored records across food logs, metric logs, and active metrics.
 */
export const getLocalDataSummary = async (): Promise<LocalDataSummary> => {
    try {
        const db = await initDatabase();
        const [foodRes, metricLogsRes, metricsRes] = await Promise.all([
            db.query(`SELECT COUNT(*) AS count FROM food_logs`),
            db.query(`SELECT COUNT(*) AS count FROM metric_logs`),
            db.query(`SELECT COUNT(*) AS count FROM metrics WHERE archived = 0`),
        ]);

        return {
            foodLogsCount: Number(foodRes.values?.[0]?.count ?? 0),
            metricLogsCount: Number(metricLogsRes.values?.[0]?.count ?? 0),
            metricsCount: Number(metricsRes.values?.[0]?.count ?? 0),
        };
    } catch (err) {
        console.error("Failed to get local data summary:", err);
        return {
            foodLogsCount: 0,
            metricLogsCount: 0,
            metricsCount: 0,
        };
    }
};

/**
 * Clears only the logged food records from the food_logs table.
 */
export const clearFoodHistory = async (): Promise<{ success: boolean; clearedCount: number }> => {
    const db = await initDatabase();
    const countRes = await db.query(`SELECT COUNT(*) AS count FROM food_logs`);
    const count = Number(countRes.values?.[0]?.count ?? 0);

    await db.run(`DELETE FROM food_logs`);

    return {
        success: true,
        clearedCount: count,
    };
};

/**
 * Clears only the historical metric logs from metric_logs table.
 * Preserves all user MetricDefinitions in the metrics table.
 */
export const clearMetricHistory = async (): Promise<{ success: boolean; clearedCount: number }> => {
    const db = await initDatabase();
    const countRes = await db.query(`SELECT COUNT(*) AS count FROM metric_logs`);
    const count = Number(countRes.values?.[0]?.count ?? 0);

    await db.run(`DELETE FROM metric_logs`);

    return {
        success: true,
        clearedCount: count,
    };
};

/**
 * Clears both food logs and metric logs from local SQLite storage.
 * Preserves all configured Plan targets/metrics in the metrics table.
 */
export const clearAllWellnessHistory = async (): Promise<{
    success: boolean;
    foodCleared: number;
    metricsLogsCleared: number;
}> => {
    const db = await initDatabase();
    const [foodCountRes, metricCountRes] = await Promise.all([
        db.query(`SELECT COUNT(*) AS count FROM food_logs`),
        db.query(`SELECT COUNT(*) AS count FROM metric_logs`),
    ]);

    const foodCleared = Number(foodCountRes.values?.[0]?.count ?? 0);
    const metricsLogsCleared = Number(metricCountRes.values?.[0]?.count ?? 0);

    await db.run(`DELETE FROM food_logs`);
    await db.run(`DELETE FROM metric_logs`);

    return {
        success: true,
        foodCleared,
        metricsLogsCleared,
    };
};

