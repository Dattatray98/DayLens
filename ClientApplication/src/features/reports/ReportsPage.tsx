import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatRupees } from "../money/moneyRepository";
import { getReportsData, type ReportRange } from "./reportsRepository";

type Period = "week" | "month" | "lastMonth" | "custom";
type DietMetric = "calories" | "protein" | "carbohydrates" | "fat";
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const rangeFor = (period: Period, today = new Date()): ReportRange => {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  if (period === "week") { start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); }
  else if (period === "month") start.setDate(1);
  else if (period === "lastMonth") { start.setDate(1); start.setMonth(start.getMonth() - 1); end.setDate(0); }
  return { startDate: localDate(start), endDate: localDate(end) };
};
const displayDate = (date: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));
const displayRange = ({ startDate, endDate }: ReportRange) => `${displayDate(startDate)} – ${displayDate(endDate)}, ${endDate.slice(0, 4)}`;
const metricCategory = (value: string) => value.trim() || "other";
const displayCategory = (value: string) => metricCategory(value).split(/[_\s-]+/).filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
const nutrientUnit = (nutrient: DietMetric) => nutrient === "calories" ? "kcal" : "g";
const nutrientLabel: Record<DietMetric, string> = { calories: "Calories", protein: "Protein", carbohydrates: "Carbs", fat: "Fat" };

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [dietMetric, setDietMetric] = useState<DietMetric>("calories");
  const [selectedWellnessCategory, setSelectedWellnessCategory] = useState("");
  const [selectedWellnessMetricId, setSelectedWellnessMetricId] = useState<number | null>(null);
  const preset = useMemo(() => rangeFor(period), [period]);
  const [custom, setCustom] = useState<ReportRange>(() => rangeFor("month"));
  const range = period === "custom" ? custom : preset;
  const { startDate, endDate } = range;
  const rangeKey = `${startDate}:${endDate}`;
  const [result, setResult] = useState<{ key: string; data?: Awaited<ReturnType<typeof getReportsData>>; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getReportsData({ startDate, endDate })
      .then(data => { if (active) setResult({ key: `${startDate}:${endDate}`, data }); })
      .catch(reason => { if (active) setResult({ key: `${startDate}:${endDate}`, error: reason instanceof Error ? reason.message : "Could not load reports." }); });
    return () => { active = false; };
  }, [startDate, endDate, attempt]);

  const currentResult = result?.key === rangeKey ? result : null;
  const loading = currentResult === null;
  const data = currentResult?.data ?? null;
  const error = currentResult?.error ?? "";
  const wellnessCategories = [...new Set((data?.wellness ?? []).map(report => metricCategory(report.metric.category)))];
  const activeWellnessCategory = wellnessCategories.includes(selectedWellnessCategory)
    ? selectedWellnessCategory
    : wellnessCategories[0] ?? "";
  const categoryMetrics = data?.wellness.filter(report => metricCategory(report.metric.category) === activeWellnessCategory) ?? [];
  const selectedWellness = categoryMetrics.find(report => report.metric.id === selectedWellnessMetricId) ?? categoryMetrics[0] ?? null;
  const selectedWellnessMetric = selectedWellness?.metric;
  const selectedWellnessBoolean = selectedWellnessMetric?.trackingType === "boolean";
  const selectedWellnessRating = selectedWellnessMetric?.trackingType === "rating";
  const selectedWellnessUnit = selectedWellnessMetric?.unit.trim() ?? "";
  const selectedWellnessPeriodLabel = selectedWellnessBoolean ? "Completed days" : selectedWellnessRating ? "Period average" : "Period total";
  const selectedWellnessPeriodValue = selectedWellness
    ? selectedWellnessBoolean
      ? `${selectedWellness.periodValue} ${selectedWellness.periodValue === 1 ? "day" : "days"}`
      : `${selectedWellness.periodValue.toLocaleString()}${selectedWellnessUnit ? ` ${selectedWellnessUnit}` : ""}`
    : "";
  const selectedWellnessTarget = !selectedWellness || !selectedWellnessMetric || selectedWellnessBoolean || selectedWellnessRating
    ? ""
    : selectedWellness.targetForRange !== null
      ? `Target ${selectedWellness.targetForRange.toLocaleString()}${selectedWellnessUnit ? ` ${selectedWellnessUnit}` : ""}`
      : selectedWellnessMetric.targetValue > 0
        ? "Target unavailable for this date range"
        : "No target set";

  return <>
    <div className="page-heading reports-heading"><div><span className="section-kicker">YOUR HISTORY</span><h1>Reports</h1><p>Patterns and summaries from your saved records.</p></div></div>
    <section className="reports-period content-panel" aria-label="Report date range">
      <div className="reports-period-tabs" role="group" aria-label="Choose reporting period">{([["week", "This week"], ["month", "This month"], ["lastMonth", "Last month"], ["custom", "Custom"]] as const).map(([value, label]) => <button key={value} className={period === value ? "selected" : ""} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>)}</div>
      {period === "custom" ? <div className="reports-custom-range"><label>From<input type="date" value={custom.startDate} max={custom.endDate} onChange={event => setCustom(current => ({ ...current, startDate: event.target.value }))} /></label><label>To<input type="date" value={custom.endDate} min={custom.startDate} onChange={event => setCustom(current => ({ ...current, endDate: event.target.value }))} /></label></div> : <span className="reports-range-label">{displayRange(range)}</span>}
    </section>
    {loading ? <section className="content-panel reports-state" role="status">Loading reports…</section> : error ? <section className="content-panel reports-state" role="alert"><strong>Reports are unavailable</strong><p>{error}</p><button className="secondary-button" onClick={() => setAttempt(value => value + 1)}>Try again</button></section> : data ? <div className="reports-content">
      <section className="reports-section"><div className="reports-section-heading"><div><span className="section-kicker">MONEY</span><h2>Cash flow</h2></div></div>
        {data.money.transactionCount === 0 ? <EmptyReport>No transactions were recorded in this period.</EmptyReport> : <>
          <div className="reports-stat-grid"><Stat label="Income" value={formatRupees(data.money.incomePaise)} tone="positive" /><Stat label="Expenses" value={formatRupees(data.money.expensesPaise)} tone="negative" /><Stat label="Net cash flow" value={formatRupees(data.money.netPaise)} tone={data.money.netPaise >= 0 ? "positive" : "negative"} /><Stat label="Current balance" value={formatRupees(data.money.currentBalancePaise)} detail={`Opening ${formatRupees(data.money.openingBalancePaise)}`} /></div>
          <div className="reports-chart-grid reports-chart-grid-single">
          <article className="content-panel reports-chart-card reports-money-category-card">
            <h3>Category totals</h3>
            {data.money.categories.income.length || data.money.categories.expense.length ? (
              <div className="reports-chart reports-money-category-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      ...data.money.categories.income.map(row => ({ name: row.name, Income: row.amountPaise / 100, Expenses: null })),
                      ...data.money.categories.expense.map(row => ({ name: row.name, Income: null, Expenses: row.amountPaise / 100 })),
                    ]}
                    margin={{ top: 10, right: 8, left: -12, bottom: 4 }}
                    barGap={3}
                  >
                    <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={false} minTickGap={12} tickFormatter={value => String(value).length > 10 ? `${String(value).slice(0, 9)}…` : value} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} tickLine={false} axisLine={false} width={48} tickFormatter={value => Number(value) >= 1000 ? `${Number(value) / 1000}k` : String(value)} />
                    <Tooltip
                      cursor={{ fill: "var(--green-soft)" }}
                      contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)", fontSize: 12 }}
                      labelStyle={{ color: "var(--muted)", marginBottom: 5 }}
                      formatter={value => formatRupees(Math.round(Number(value) * 100))}
                    />
                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 8, color: "var(--muted)" }} />
                    <Bar dataKey="Income" fill="#688a75" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="Expenses" fill="#bd7567" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyReport>No category totals for this period.</EmptyReport>}
          </article>
          </div>
        </>}
      </section>

      <section className="reports-section">
        <div className="reports-section-heading"><div><span className="section-kicker">DIET</span><h2>Nutrition</h2></div></div>
        {!data.diet.days.some(day => day.entryCount) ? <EmptyReport>No food entries were recorded in this period.</EmptyReport> : <>
          <div className="reports-stat-grid reports-diet-averages">{(["calories", "protein", "carbohydrates", "fat"] as const).map(nutrient => {
            const average = data.diet.averages[nutrient];
            const target = data.diet.targets[nutrient];
            const unit = nutrientUnit(nutrient);
            const detail = average
              ? `${average.daysCounted} day${average.daysCounted === 1 ? "" : "s"}${average.incomplete ? " · partial" : ""}${target === null ? "" : ` · target ${target.toLocaleString("en-IN")} ${unit}`}`
              : target === null ? "No intake" : `Target ${target.toLocaleString("en-IN")} ${unit}`;
            return <Stat key={nutrient} label={nutrientLabel[nutrient]} value={average ? `${average.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${unit}` : "—"} detail={detail} />;
          })}</div>
          <article className="content-panel reports-chart-card reports-diet-chart">
            <div className="reports-diet-chart-heading">
              <h3>Daily intake</h3>
              <div className="reports-diet-chart-legend" aria-label="Chart legend">
                <span><i className="reports-legend-intake" /> Intake</span>
                {data.diet.targets[dietMetric] !== null && <span><i className="reports-legend-target" /> Target</span>}
              </div>
            </div>
            <div className="reports-diet-metric-select" role="group" aria-label="Choose nutrient">
              {(["calories", "protein", "carbohydrates", "fat"] as const).map(metric => (
                <button key={metric} type="button" aria-pressed={dietMetric === metric} className={dietMetric === metric ? "selected" : ""} onClick={() => setDietMetric(metric)}>{nutrientLabel[metric]}</button>
              ))}
            </div>
            <div className="reports-chart reports-diet-line-chart" role="img" aria-label={`${nutrientLabel[dietMetric]} intake and target over time`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.diet.days.map(day => {
                  const total = day.totals[dietMetric];
                  return {
                    date: displayDate(day.date),
                    intake: day.entryCount && total.knownEntries ? total.value : null,
                    target: data.diet.targets[dietMetric],
                    complete: total.complete,
                  };
                })} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} minTickGap={22} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={45} domain={[0, "auto"]} />
                  <Tooltip
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)", fontSize: 12 }}
                    labelStyle={{ color: "var(--muted)", marginBottom: 5 }}
                    formatter={(value, name, item) => {
                      const formatted = `${Number(value).toLocaleString()} ${nutrientUnit(dietMetric)}`;
                      if (name === "Intake" && !item.payload.complete) return [`≥ ${formatted}`, "Known subtotal"];
                      return [formatted, String(name ?? "Intake")];
                    }}
                  />
                  <Line type="monotone" dataKey="intake" name="Intake" stroke="#688a75" strokeWidth={2.5} connectNulls={false} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  {data.diet.targets[dietMetric] !== null && <Line type="linear" dataKey="target" name="Target" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} activeDot={false} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>
        </>}
      </section>

      <section className="reports-section">
        <div className="reports-section-heading"><div><h2>Wellness metrics</h2></div></div>
        {data.wellness.length === 0 ? <EmptyReport>No active wellness metrics yet.</EmptyReport> : <>
          <div className="reports-wellness-category-bar" role="group" aria-label="Choose a metric category">
            {wellnessCategories.map(category => <button
              key={category}
              type="button"
              className={activeWellnessCategory === category ? "selected" : ""}
              aria-pressed={activeWellnessCategory === category}
              onClick={() => {
                setSelectedWellnessCategory(category);
                setSelectedWellnessMetricId(data.wellness.find(report => metricCategory(report.metric.category) === category)?.metric.id ?? null);
              }}
            >{displayCategory(category)}</button>)}
          </div>
          {categoryMetrics.length > 1 && <div className="reports-wellness-metric-switch" role="group" aria-label="Choose a metric">
            {categoryMetrics.map(report => <button key={report.metric.id} type="button" className={selectedWellness?.metric.id === report.metric.id ? "selected" : ""} aria-pressed={selectedWellness?.metric.id === report.metric.id} onClick={() => setSelectedWellnessMetricId(report.metric.id)}>
              <span aria-hidden="true">{report.metric.icon}</span>{report.metric.name}
            </button>)}
          </div>}
          {selectedWellness && selectedWellnessMetric && <article className="content-panel reports-metric-panel">
            <div className="reports-metric-heading">
              <span aria-hidden="true">{selectedWellnessMetric.icon}</span>
              <div><h3>{selectedWellnessMetric.name}</h3><p>{selectedWellnessMetric.frequency.charAt(0).toUpperCase() + selectedWellnessMetric.frequency.slice(1)}{selectedWellnessUnit && !selectedWellnessBoolean ? ` · ${selectedWellnessUnit}` : ""}</p></div>
            </div>
            {selectedWellness.logCount === 0 ? <div className="reports-metric-empty">No entries in this period.</div> : <>
              <div className="reports-metric-summary">
                <div><span>{selectedWellnessPeriodLabel}</span><strong>{selectedWellnessPeriodValue}</strong></div>
                <div className="reports-metric-meta"><span>{selectedWellness.logCount} {selectedWellness.logCount === 1 ? "entry" : "entries"}</span>{selectedWellnessTarget && <span>{selectedWellnessTarget}</span>}</div>
              </div>
              <div className="reports-chart reports-metric-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedWellness.points.map(point => ({ date: displayDate(point.date), Value: point.value }))}>
                    <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={value => selectedWellnessBoolean ? (Number(value) ? "Done" : "Not done") : `${Number(value).toLocaleString()}${selectedWellnessUnit ? ` ${selectedWellnessUnit}` : ""}`} />
                    <Line type="monotone" dataKey="Value" stroke="#688a75" strokeWidth={2} connectNulls={false} dot={{ r: 2 }} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>}
          </article>}
        </>}
      </section>
    </div> : null}
  </>;
}

function Stat({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail?: string; tone?: "positive" | "negative" | "neutral" | "caution" }) {
  return <article className={`reports-stat reports-stat-${tone}`}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>;
}

function EmptyReport({ children }: { children: string }) {
  return <div className="content-panel reports-empty"><strong>Nothing to show yet</strong><p>{children}</p></div>;
}
