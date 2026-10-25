import { initDatabase } from "./configDatabase";
import type {
    CreateMetricInput,
    MetricDailySummary,
    MetricDefinition,
    MetricFrequency,
    MetricLog,
    MetricSource,
    MetricTrackingType,
    PlanItemProgress,
    UpdateMetricInput,
} from "./metrics";

const mapMetric = (row: Record<string, unknown>): MetricDefinition => ({
    id: Number(row.id),
    name: String(row.name),
    icon: String(row.icon),
    category: String(row.category),
    unit: String(row.unit),
    targetValue: Number(row.target_value),
    frequency: String(row.frequency) as MetricFrequency,
    trackingType: String(row.tracking_type) as MetricTrackingType,
    source: String(row.source) as MetricSource,
    enabled: Number(row.enabled) === 1,
    archived: Number(row.archived) === 1,
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
});

const mapMetricLog = (row: Record<string, unknown>): MetricLog => ({
    id: Number(row.id),
    metricId: Number(row.metric_id),
    value: Number(row.value),
    timestamp: String(row.timestamp),
    note: row.note == null ? null : String(row.note),
});

const assertMetricInput = (input: CreateMetricInput) => {
    if (!input.name.trim()) {
        throw new Error("Metric name is required");
    }

    if (!input.unit.trim()) {
        throw new Error("Metric unit is required");
    }

    if (!Number.isFinite(input.targetValue) || input.targetValue < 0) {
        throw new Error(
            "Metric target must be a finite non-negative number"
        );
    }
};

export const createMetric = async (input: CreateMetricInput) => {
    assertMetricInput(input);

    const db = await initDatabase();
    const now = new Date().toISOString();

    const maxOrder = await db.query(`
        SELECT COALESCE(MAX(sort_order), -1) AS max_order
        FROM metrics
        WHERE archived = 0
    `);

    const sortOrder =
        Number(maxOrder.values?.[0]?.max_order ?? -1) + 1;

    const result = await db.run(
        `
        INSERT INTO metrics
        (
            name,
            icon,
            category,
            unit,
            target_value,
            frequency,
            tracking_type,
            source,
            enabled,
            archived,
            sort_order,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)
        `,
        [
            input.name.trim(),
            input.icon ?? "📊",
            input.category ?? "custom",
            input.unit.trim(),
            input.targetValue,
            input.frequency,
            input.trackingType,
            input.source ?? "manual",
            sortOrder,
            now,
            now,
        ]
    );

    return {
        success: true,
        id: Number(result.changes?.lastId ?? 0),
    };
};

export const getMetrics = async (includeArchived = false) => {
    const db = await initDatabase();

    const result = await db.query(`
        SELECT
            id,
            name,
            icon,
            category,
            unit,
            target_value,
            frequency,
            tracking_type,
            source,
            enabled,
            archived,
            sort_order,
            created_at,
            updated_at
        FROM metrics
        ${includeArchived ? "" : "WHERE archived = 0"}
        ORDER BY sort_order ASC, id ASC
    `);

    return (result.values ?? []).map((row) =>
        mapMetric(row as Record<string, unknown>)
    );
};

export const getActiveMetrics = async () => {
    const db = await initDatabase();

    const result = await db.query(`
        SELECT
            id,
            name,
            icon,
            category,
            unit,
            target_value,
            frequency,
            tracking_type,
            source,
            enabled,
            archived,
            sort_order,
            created_at,
            updated_at
        FROM metrics
        WHERE archived = 0
          AND enabled = 1
        ORDER BY sort_order ASC, id ASC
    `);

    return (result.values ?? []).map((row) =>
        mapMetric(row as Record<string, unknown>)
    );
};

export const updateMetric = async (
    id: number,
    input: UpdateMetricInput
) => {
    const db = await initDatabase();

    const current = await db.query(
        `SELECT * FROM metrics WHERE id = ?`,
        [id]
    );

    const row = current.values?.[0] as
        | Record<string, unknown>
        | undefined;

    if (!row) {
        throw new Error("Metric not found");
    }

    const targetValue =
        input.targetValue ?? Number(row.target_value);

    if (!Number.isFinite(targetValue) || targetValue < 0) {
        throw new Error(
            "Metric target must be a finite non-negative number"
        );
    }

    const now = new Date().toISOString();

    await db.run(
        `
        UPDATE metrics
        SET
            name = ?,
            icon = ?,
            category = ?,
            unit = ?,
            target_value = ?,
            frequency = ?,
            tracking_type = ?,
            enabled = ?,
            sort_order = ?,
            updated_at = ?
        WHERE id = ?
        `,
        [
            input.name?.trim() || String(row.name),
            input.icon ?? String(row.icon),
            input.category ?? String(row.category),
            input.unit?.trim() || String(row.unit),
            targetValue,
            input.frequency ?? String(row.frequency),
            input.trackingType ?? String(row.tracking_type),
            input.enabled === undefined
                ? Number(row.enabled)
                : input.enabled
                  ? 1
                  : 0,
            input.sortOrder ?? Number(row.sort_order),
            now,
            id,
        ]
    );

    return { success: true };
};

export const archiveMetric = async (id: number) => {
    const db = await initDatabase();

    await db.run(
        `
        UPDATE metrics
        SET
            archived = 1,
            enabled = 0,
            updated_at = ?
        WHERE id = ?
        `,
        [new Date().toISOString(), id]
    );

    return { success: true };
};

export const restoreMetric = async (id: number) => {
    const db = await initDatabase();

    await db.run(
        `
        UPDATE metrics
        SET
            archived = 0,
            enabled = 1,
            updated_at = ?
        WHERE id = ?
        `,
        [new Date().toISOString(), id]
    );

    return { success: true };
};

export const logMetric = async (
    metricId: number,
    value: number,
    note?: string,
    timestamp = new Date().toISOString()
) => {
    if (!Number.isFinite(value)) {
        throw new Error(
            "Metric value must be a finite number"
        );
    }

    const db = await initDatabase();

    const metric = await db.query(
        `
        SELECT id
        FROM metrics
        WHERE id = ?
          AND archived = 0
        `,
        [metricId]
    );

    if (!metric.values?.length) {
        throw new Error(
            "Metric not found or archived"
        );
    }

    const result = await db.run(
        `
        INSERT INTO metric_logs
        (
            metric_id,
            value,
            timestamp,
            note
        )
        VALUES (?, ?, ?, ?)
        `,
        [
            metricId,
            value,
            timestamp,
            note ?? null,
        ]
    );

    return {
        success: true,
        id: Number(result.changes?.lastId ?? 0),
    };
};

export const getMetricLogs = async (
    metricId?: number
) => {
    const db = await initDatabase();

    if (metricId !== undefined) {
        const result = await db.query(
            `
            SELECT
                id,
                metric_id,
                value,
                timestamp,
                note
            FROM metric_logs
            WHERE metric_id = ?
            ORDER BY timestamp DESC
            `,
            [metricId]
        );

        return (result.values ?? []).map((row) =>
            mapMetricLog(row as Record<string, unknown>)
        );
    }

    const result = await db.query(
        `
        SELECT
            id,
            metric_id,
            value,
            timestamp,
            note
        FROM metric_logs
        ORDER BY timestamp DESC
        `
    );

    return (result.values ?? []).map((row) =>
        mapMetricLog(row as Record<string, unknown>)
    );
};

export const getMetricLogsInRange = async (startDate: string, endDate: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
        throw new Error("Choose a valid metric report date range.");
    }
    const db = await initDatabase();
    const result = await db.query(`
        SELECT id, metric_id, value, timestamp, note
        FROM metric_logs
        WHERE date(timestamp, 'localtime') BETWEEN ? AND ?
        ORDER BY timestamp ASC, id ASC
    `, [startDate, endDate]);
    return (result.values ?? []).map(row => mapMetricLog(row as Record<string, unknown>));
};

export const getMetricDailySummary = async (
    metricId: number,
    startDate: string,
    endDate: string
): Promise<MetricDailySummary[]> => {
    const db = await initDatabase();

    const result = await db.query(
        `
        SELECT
            metric_id,
            date(timestamp, 'localtime') AS date,
            COALESCE(SUM(value), 0) AS total,
            COUNT(*) AS entries
        FROM metric_logs
        WHERE metric_id = ?
          AND date(timestamp, 'localtime')
              BETWEEN ? AND ?
        GROUP BY
            metric_id,
            date(timestamp, 'localtime')
        ORDER BY date ASC
        `,
        [metricId, startDate, endDate]
    );

    return (result.values ?? []).map((row) => ({
        metricId: Number(row.metric_id),
        date: String(row.date),
        total: Number(
            Number(row.total ?? 0).toFixed(2)
        ),
        entries: Number(row.entries ?? 0),
    }));
};

export const getPlanProgress = async (
    targetDate = new Date().toLocaleDateString("en-CA")
): Promise<PlanItemProgress[]> => {
    const db = await initDatabase();

    const metricsResult = await db.query(`
        SELECT
            id,
            name,
            icon,
            category,
            unit,
            target_value,
            frequency,
            tracking_type,
            source,
            enabled,
            archived,
            sort_order,
            created_at,
            updated_at
        FROM metrics
        WHERE archived = 0
        ORDER BY sort_order ASC, id ASC
    `);

    const metrics = (metricsResult.values ?? []).map((row) =>
        mapMetric(row as Record<string, unknown>)
    );

    if (metrics.length === 0) {
        return [];
    }

    const dateObj = new Date(targetDate + "T12:00:00");
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");

    // Calculate start of current week (Monday)
    const dayOfWeek = dateObj.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const mondayObj = new Date(dateObj);
    mondayObj.setDate(mondayObj.getDate() - diffToMonday);
    const startOfWeekStr = mondayObj.toLocaleDateString("en-CA");

    // Calculate start of current month
    const startOfMonthStr = `${year}-${month}-01`;

    const planItems: PlanItemProgress[] = [];

    for (const metric of metrics) {
        let startDate = targetDate;
        let endDate = targetDate;

        if (metric.frequency === "weekly") {
            startDate = startOfWeekStr;
            endDate = targetDate;
        } else if (metric.frequency === "monthly") {
            startDate = startOfMonthStr;
            endDate = targetDate;
        }

        const logResult = await db.query(
            `
            SELECT
                COALESCE(SUM(value), 0) AS total,
                COUNT(*) AS entries
            FROM metric_logs
            WHERE metric_id = ?
              AND date(timestamp, 'localtime') BETWEEN ? AND ?
            `,
            [metric.id, startDate, endDate]
        );

        const total = Number(Number(logResult.values?.[0]?.total ?? 0).toFixed(2));
        const entries = Number(logResult.values?.[0]?.entries ?? 0);

        let progressPercent = 0;
        let isCompleted = false;

        if (metric.trackingType === "boolean") {
            isCompleted = total >= 1;
            progressPercent = isCompleted ? 100 : 0;
        } else if (metric.targetValue > 0) {
            progressPercent = Math.min(
                100,
                Math.round((total / metric.targetValue) * 100)
            );
            isCompleted = total >= metric.targetValue;
        } else {
            isCompleted = total > 0;
            progressPercent = total > 0 ? 100 : 0;
        }

        planItems.push({
            metric,
            currentValue: total,
            targetValue: metric.targetValue,
            progressPercent,
            isCompleted,
            entriesCount: entries,
        });
    }

    return planItems;
};

