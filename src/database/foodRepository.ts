import { initDatabase } from "./configDatabase";

export interface FoodLogRecord {
    food: string;
    quantity: number;
    unit: string;
    calories: number;
    protein: number;
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
                new Date().toISOString(),
            ]
        );
    }

    return {
        success: true,
        count: records.length,
    };
};

export const getFoodLogs = async () => {
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

    return result.values ?? [];
};

export const getTodaySummary = async () => {
    const db = await initDatabase();

    const result = await db.query(`
        SELECT
            COUNT(*) AS food_count,
            COALESCE(SUM(calories), 0) AS calories,
            COALESCE(SUM(protein), 0) AS protein
        FROM food_logs
        WHERE date(timestamp, 'localtime') = date('now', 'localtime')
    `);

    const row = result.values?.[0];

    return {
        foodCount: Number(row?.food_count ?? 0),
        calories: Number(Number(row?.calories ?? 0).toFixed(2)),
        protein: Number(Number(row?.protein ?? 0).toFixed(2)),
    };
};
