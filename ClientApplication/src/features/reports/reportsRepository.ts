import { getMoneySummary, getMoneyTransactions, type MoneyTransaction } from "../money/moneyRepository";
import { getDietRangeData } from "../diet/dietRepository";
import { getMetrics } from "../../database/metricRepository";
import { getMetricLogsInRange } from "../../database/metricRepository";
import type { MetricDefinition, MetricLog } from "../../database/metrics";
import type { DailyNutritionTotals, Nutrient } from "../diet/nutritionCalculations";

export interface ReportRange { startDate: string; endDate: string }
export interface CategoryTotal { name: string; amountPaise: number; count: number }
export interface MoneyReport {
  openingBalancePaise: number;
  currentBalancePaise: number;
  incomePaise: number;
  expensesPaise: number;
  netPaise: number;
  transactionCount: number;
  categories: Record<"income" | "expense", CategoryTotal[]>;
  transactions: MoneyTransaction[];
}
export interface DietDayReport { date: string; entryCount: number; totals: DailyNutritionTotals }
export interface DietAverage { value: number; daysCounted: number; incomplete: boolean }
export interface DietReport { days: DietDayReport[]; targets: Record<Nutrient, number | null>; averages: Record<Nutrient, DietAverage | null> }
export interface MetricDayPoint { date: string; value: number | null; entryCount: number }
export interface MetricReport { metric: MetricDefinition; points: MetricDayPoint[]; periodValue: number; logCount: number; targetForRange: number | null; targetNote: string }

export const aggregateMoneyReport = (transactions: MoneyTransaction[], openingBalancePaise: number, currentBalancePaise: number): MoneyReport => {
  const categories: MoneyReport["categories"] = { income: [], expense: [] };
  const grouped = new Map<string, CategoryTotal>();
  let incomePaise = 0;
  let expensesPaise = 0;
  for (const transaction of transactions) {
    const kind = transaction.kind;
    if (kind === "income") incomePaise += transaction.amountPaise;
    else expensesPaise += transaction.amountPaise;
    const key = `${kind}:${transaction.categoryId}`;
    const total = grouped.get(key) ?? { name: transaction.categoryName, amountPaise: 0, count: 0 };
    total.amountPaise += transaction.amountPaise;
    total.count += 1;
    grouped.set(key, total);
  }
  for (const [key, total] of grouped) categories[key.startsWith("income:") ? "income" : "expense"].push(total);
  categories.income.sort((a, b) => b.amountPaise - a.amountPaise);
  categories.expense.sort((a, b) => b.amountPaise - a.amountPaise);
  return { openingBalancePaise, currentBalancePaise, incomePaise, expensesPaise, netPaise: incomePaise - expensesPaise,
    transactionCount: transactions.length, categories, transactions };
};

const round = (value: number) => Number(value.toFixed(2));

export const aggregateDietAverages = (days: DietDayReport[]): DietReport["averages"] => {
  const nutrients: Nutrient[] = ["calories", "protein", "carbohydrates", "fat"];
  return Object.fromEntries(nutrients.map(nutrient => {
    const knownDays = days.filter(day => day.entryCount > 0 && day.totals[nutrient].knownEntries > 0);
    if (!knownDays.length) return [nutrient, null];
    const total = knownDays.reduce((sum, day) => sum + day.totals[nutrient].value, 0);
    const incomplete = knownDays.some(day => !day.totals[nutrient].complete);
    return [nutrient, { value: round(total / knownDays.length), daysCounted: knownDays.length, incomplete }];
  })) as DietReport["averages"];
};

export const buildMetricReports = (metrics: MetricDefinition[], logs: MetricLog[], { startDate, endDate }: ReportRange): MetricReport[] => {
  const logsByMetric = new Map<number, MetricLog[]>();
  for (const log of logs) {
    const date = new Date(log.timestamp).toLocaleDateString("en-CA");
    if (date < startDate || date > endDate) continue;
    const group = logsByMetric.get(log.metricId) ?? [];
    group.push(log); logsByMetric.set(log.metricId, group);
  }
  const dateCount = Math.max(1, Math.round((new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / 86400000) + 1);
  const monthCount = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
  return metrics.filter(metric => metric.enabled && !metric.archived).map(metric => {
    const metricLogs = logsByMetric.get(metric.id) ?? [];
    const byDay = new Map<string, MetricLog[]>();
    for (const log of metricLogs) {
      const date = new Date(log.timestamp).toLocaleDateString("en-CA");
      const group = byDay.get(date) ?? []; group.push(log); byDay.set(date, group);
    }
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    const points: MetricDayPoint[] = [];
    for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = cursor.toISOString().slice(0, 10);
      const values = byDay.get(date);
      if (!values?.length) { points.push({ date, value: null, entryCount: 0 }); continue; }
      const value = metric.trackingType === "rating"
        ? values.reduce((sum, log) => sum + log.value, 0) / values.length
        : metric.trackingType === "boolean"
          ? (values.some(log => log.value >= 1) ? 1 : 0)
          : values.reduce((sum, log) => sum + log.value, 0);
      points.push({ date, value: round(value), entryCount: values.length });
    }
    const periodValue = metric.trackingType === "rating"
      ? (metricLogs.length ? round(metricLogs.reduce((sum, log) => sum + log.value, 0) / metricLogs.length) : 0)
      : metric.trackingType === "boolean"
        ? points.filter(point => point.value === 1).length
        : round(metricLogs.reduce((sum, log) => sum + log.value, 0));
    let periods = dateCount;
    let targetForRange: number | null = null;
    let targetNote = "";
    if (metric.frequency === "weekly") {
      const weeks = new Set<string>();
      for (let cursor = new Date(`${startDate}T00:00:00Z`); cursor <= new Date(`${endDate}T00:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const day = new Date(cursor); const mondayOffset = (day.getUTCDay() + 6) % 7; day.setUTCDate(day.getUTCDate() - mondayOffset);
        weeks.add(day.toISOString().slice(0, 10));
      }
      periods = weeks.size;
      const startWeekday = new Date(`${startDate}T00:00:00Z`).getUTCDay();
      const endWeekday = new Date(`${endDate}T00:00:00Z`).getUTCDay();
      if (startWeekday === 1 && endWeekday === 0) targetForRange = round(metric.targetValue * periods);
      else targetNote = "Partial weeks; target comparison omitted.";
    } else if (metric.frequency === "monthly") {
      periods = monthCount(endDate) - monthCount(startDate) + 1;
      const lastDay = new Date(Date.UTC(Number(endDate.slice(0, 4)), Number(endDate.slice(5, 7)), 0)).getUTCDate();
      if (startDate.endsWith("-01") && Number(endDate.slice(8, 10)) === lastDay) targetForRange = round(metric.targetValue * periods);
      else targetNote = "Partial months; target comparison omitted.";
    } else targetForRange = round(metric.targetValue * periods);
    if (metric.trackingType === "rating") { targetForRange = null; targetNote = "Rating averages are not compared with accumulated targets."; }
    if (metric.trackingType === "boolean") { targetForRange = null; targetNote = "Completion is summarized by day."; }
    if (metric.targetValue <= 0) { targetForRange = null; targetNote = "No target configured."; }
    return { metric, points, periodValue, logCount: metricLogs.length,
      targetForRange, targetNote };
  });
};

export const getReportsData = async (range: ReportRange) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(range.endDate) || range.startDate > range.endDate) {
    throw new Error("Choose a valid date range with a start date on or before the end date.");
  }
  const [transactions, balance, dietData, metrics, logs] = await Promise.all([
    getMoneyTransactions({ from: range.startDate, to: range.endDate }),
    getMoneySummary(range.startDate.slice(0, 7)),
    getDietRangeData(range.startDate, range.endDate),
    getMetrics(),
    getMetricLogsInRange(range.startDate, range.endDate),
  ]);
  const money = aggregateMoneyReport(transactions, balance.openingBalancePaise, balance.balancePaise);
  const diet = { days: dietData.days, targets: dietData.targets, averages: aggregateDietAverages(dietData.days) };
  const wellness = buildMetricReports(metrics, logs, range);
  return { money, diet, wellness };
};
