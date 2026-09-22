export const METRIC_FREQUENCIES = [
    "daily",
    "weekly",
    "monthly",
] as const;

export type MetricFrequency = (typeof METRIC_FREQUENCIES)[number];

export const METRIC_TRACKING_TYPES = [
    "quantity",
    "count",
    "duration",
    "distance",
    "boolean",
    "rating",
] as const;

export type MetricTrackingType = (typeof METRIC_TRACKING_TYPES)[number];

export const METRIC_SOURCES = [
    "manual",
    "device_sensor",
    "derived",
] as const;

export type MetricSource = (typeof METRIC_SOURCES)[number];

export interface MetricDefinition {
    id: number;
    name: string;
    icon: string;
    category: string;
    unit: string;
    targetValue: number;
    frequency: MetricFrequency;
    trackingType: MetricTrackingType;
    source: MetricSource;
    enabled: boolean;
    archived: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface CreateMetricInput {
    name: string;
    icon?: string;
    category?: string;
    unit: string;
    targetValue: number;
    frequency: MetricFrequency;
    trackingType: MetricTrackingType;
    source?: MetricSource;
}

export interface UpdateMetricInput {
    name?: string;
    icon?: string;
    category?: string;
    unit?: string;
    targetValue?: number;
    frequency?: MetricFrequency;
    trackingType?: MetricTrackingType;
    enabled?: boolean;
    sortOrder?: number;
}

export interface MetricLog {
    id: number;
    metricId: number;
    value: number;
    timestamp: string;
    note?: string | null;
}

export interface MetricDailySummary {
    metricId: number;
    date: string;
    total: number;
    entries: number;
}

export interface PlanItemProgress {
    metric: MetricDefinition;
    currentValue: number;
    targetValue: number;
    progressPercent: number;
    isCompleted: boolean;
    entriesCount: number;
}
