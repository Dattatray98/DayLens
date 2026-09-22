import { initDatabase } from "./configDatabase";

export interface FoodLogRecord {
    food: string;
    quantity: number;
    unit: string;
    calories: number;
    protein: number;
    timestamp?: string;
}

export interface DailyNutrition {
    date: string;
    foodCount: number;
    calories: number;
    protein: number;
}

export interface FoodLogWithId extends FoodLogRecord {
    id: number;
}

export const saveFoodLogs = async (
    records: FoodLogRecord[]
) => {
    const db = await initDatabase();

    for (const record of records) {
        await db.run(
            `
            INSERT INTO food_logs
            (
                food,
                quantity,
                unit,
                calories,
                protein,
                timestamp
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                record.food,
                record.quantity,
                record.unit,
                record.calories,
                record.protein,
                record.timestamp ?? new Date().toISOString(),
            ]
        );
    }

    return {
        success: true,
        count: records.length,
    };
};

export const getFoodLogs = async (): Promise<FoodLogWithId[]> => {
    const db = await initDatabase();

    const result = await db.query(`
        SELECT
            id,
            food,
            quantity,
            unit,
            calories,
            protein,
            timestamp
        FROM food_logs
        ORDER BY timestamp DESC
    `);

    return (result.values ?? []) as FoodLogWithId[];
};

export const getFoodLogsByDate = async (
    date: string
): Promise<FoodLogWithId[]> => {
    const db = await initDatabase();

    const result = await db.query(
        `
        SELECT
            id,
            food,
            quantity,
            unit,
            calories,
            protein,
            timestamp
        FROM food_logs
        WHERE date(timestamp, 'localtime') = ?
        ORDER BY timestamp ASC
        `,
        [date]
    );

    return (result.values ?? []) as FoodLogWithId[];
};

export const getTodayFoodLogs = async (): Promise<FoodLogWithId[]> => {
    const db = await initDatabase();

    const result = await db.query(`
        SELECT
            id,
            food,
            quantity,
            unit,
            calories,
            protein,
            timestamp
        FROM food_logs
        WHERE date(timestamp, 'localtime') = date('now', 'localtime')
        ORDER BY timestamp DESC
    `);

    return (result.values ?? []) as FoodLogWithId[];
};

export const getTodaySummary = async (): Promise<DailyNutrition> => {
    const db = await initDatabase();

    const result = await db.query(`
        SELECT
            date('now', 'localtime') AS date,
            COUNT(*) AS food_count,
            COALESCE(SUM(calories), 0) AS calories,
            COALESCE(SUM(protein), 0) AS protein
        FROM food_logs
        WHERE date(timestamp, 'localtime') = date('now', 'localtime')
    `);

    const row = result.values?.[0];

    return {
        date: String(row?.date ?? ""),
        foodCount: Number(row?.food_count ?? 0),
        calories: Number(Number(row?.calories ?? 0).toFixed(2)),
        protein: Number(Number(row?.protein ?? 0).toFixed(2)),
    };
};

export const getDailyNutrition = async (
    date: string
): Promise<DailyNutrition> => {
    const db = await initDatabase();

    const result = await db.query(
        `
        SELECT
            ? AS date,
            COUNT(*) AS food_count,
            COALESCE(SUM(calories), 0) AS calories,
            COALESCE(SUM(protein), 0) AS protein
        FROM food_logs
        WHERE date(timestamp, 'localtime') = ?
        `,
        [date, date]
    );

    const row = result.values?.[0];

    return {
        date,
        foodCount: Number(row?.food_count ?? 0),
        calories: Number(Number(row?.calories ?? 0).toFixed(2)),
        protein: Number(Number(row?.protein ?? 0).toFixed(2)),
    };
};

export const getWeeklyNutrition = async (
    startDate: string
): Promise<DailyNutrition[]> => {
    const db = await initDatabase();

    const result = await db.query(
        `
        SELECT
            date(timestamp, 'localtime') AS date,
            COUNT(*) AS food_count,
            COALESCE(SUM(calories), 0) AS calories,
            COALESCE(SUM(protein), 0) AS protein
        FROM food_logs
        WHERE date(timestamp, 'localtime')
            BETWEEN ? AND date(?, '+6 days')
        GROUP BY date(timestamp, 'localtime')
        ORDER BY date ASC
        `,
        [startDate, startDate]
    );

    return (result.values ?? []).map((row) => ({
        date: String(row.date),
        foodCount: Number(row.food_count ?? 0),
        calories: Number(Number(row.calories ?? 0).toFixed(2)),
        protein: Number(Number(row.protein ?? 0).toFixed(2)),
    }));
};