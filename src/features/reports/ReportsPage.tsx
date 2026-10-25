import { useEffect, useMemo, useState } from "react";
import { FiDownload } from "react-icons/fi";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatRupees } from "../money/moneyRepository";
import { getReportsData, type ReportRange } from "./reportsRepository";

type Period = "week" | "month" | "lastMonth" | "custom";
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
const nutrientUnit = (nutrient: string) => nutrient === "calories" ? "kcal" : "g";
const nutrientLabel: Record<string, string> = { calories: "Calories", protein: "Protein", carbohydrates: "Carbs", fat: "Fat" };

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("month");
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

  const exportTransactions = () => {
    if (!data) return;
    const rows = [
      ["Date", "Type", "Category", "Description", "Payment method", "Amount (INR)"],
      ...data.money.transactions.map(item => [item.transactionDate, item.kind, item.categoryName, item.description, item.paymentMethod, (item.amountPaise / 100).toFixed(2)]),
    ];
    const csv = rows.map(row => row.map(value => {
      const text = String(value);
      const safeText = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
      return `"${safeText.replaceAll('"', '""')}"`;
    }).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `personal-os-transactions-${range.startDate}-to-${range.endDate}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };

  return <>
    <div className="page-heading reports-heading"><div><span className="section-kicker">YOUR HISTORY</span><h1>Reports</h1><p>Patterns and summaries from your saved records.</p></div>{data?.money.transactionCount ? <button className="secondary-button" onClick={exportTransactions}><FiDownload /> Export transactions</button> : null}</div>
    <section className="reports-period content-panel" aria-label="Report date range">
      <div className="reports-period-tabs" role="group" aria-label="Choose reporting period">{([["week", "This week"], ["month", "This month"], ["lastMonth", "Last month"], ["custom", "Custom"]] as const).map(([value, label]) => <button key={value} className={period === value ? "selected" : ""} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>)}</div>
      {period === "custom" ? <div className="reports-custom-range"><label>From<input type="date" value={custom.startDate} max={custom.endDate} onChange={event => setCustom(current => ({ ...current, startDate: event.target.value }))} /></label><label>To<input type="date" value={custom.endDate} min={custom.startDate} onChange={event => setCustom(current => ({ ...current, endDate: event.target.value }))} /></label></div> : <span className="reports-range-label">{displayRange(range)}</span>}
    </section>
    {loading ? <section className="content-panel reports-state" role="status">Loading reports…</section> : error ? <section className="content-panel reports-state" role="alert"><strong>Reports are unavailable</strong><p>{error}</p><button className="secondary-button" onClick={() => setAttempt(value => value + 1)}>Try again</button></section> : data ? <div className="reports-content">
      <section className="reports-section"><div className="reports-section-heading"><div><span className="section-kicker">MONEY</span><h2>Cash flow</h2></div><button className="reports-export-mobile secondary-button" onClick={exportTransactions}><FiDownload /> Export CSV</button></div>
        {data.money.transactionCount === 0 ? <EmptyReport>No transactions were recorded in this period.</EmptyReport> : <>
          <div className="reports-stat-grid"><Stat label="Income" value={formatRupees(data.money.incomePaise)} tone="positive" /><Stat label="Expenses" value={formatRupees(data.money.expensesPaise)} tone="negative" /><Stat label="Net cash flow" value={formatRupees(data.money.netPaise)} tone={data.money.netPaise >= 0 ? "positive" : "negative"} /><Stat label="Transactions" value={String(data.money.transactionCount)} detail={`${formatRupees(data.money.openingBalancePaise)} opening balance · ${formatRupees(data.money.currentBalancePaise)} current balance`} /></div>
          <div className="reports-chart-grid"><article className="content-panel reports-chart-card"><h3>Money by category</h3><p>Selected period · INR</p>{data.money.categories.income.length || data.money.categories.expense.length ? <div className="reports-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={[...data.money.categories.income.map(row => ({ name: row.name, Income: row.amountPaise / 100, Expenses: 0 })), ...data.money.categories.expense.map(row => ({ name: row.name, Income: 0, Expenses: row.amountPaise / 100 }))]} margin={{ top: 6, right: 8, left: 0, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={value => `₹${Number(value).toLocaleString("en-IN")}`} /><Legend /><Bar dataKey="Income" fill="#65856f" radius={[4, 4, 0, 0]} /><Bar dataKey="Expenses" fill="#bd7567" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyReport>No category totals for this period.</EmptyReport>}{Boolean(data.money.categories.income.length || data.money.categories.expense.length) && <ul className="reports-category-summary">{(["income", "expense"] as const).flatMap(kind => data.money.categories[kind].map(category => <li key={`${kind}-${category.name}`}><span>{category.name} · {kind} ({category.count})</span><strong>{formatRupees(category.amountPaise)}</strong></li>))}</ul>}</article>
            <article className="content-panel reports-table-card"><h3>Transactions</h3><p>{displayRange(range)}</p><div className="reports-table-wrap"><table><thead><tr><th>Date</th><th>Category</th><th>Type</th><th>Amount</th></tr></thead><tbody>{data.money.transactions.map(item => <tr key={item.id}><td>{displayDate(item.transactionDate)}</td><td>{item.categoryName}</td><td className={item.kind === "income" ? "report-positive" : "report-negative"}>{item.kind}</td><td>{formatRupees(item.amountPaise)}</td></tr>)}</tbody></table></div></article></div>
        </>}
      </section>

      <section className="reports-section"><div className="reports-section-heading"><div><span className="section-kicker">DIET</span><h2>Nutrition over time</h2></div></div>
        {!data.diet.days.some(day => day.entryCount) ? <EmptyReport>No food entries were recorded in this period.</EmptyReport> : <>
          <div className="reports-stat-grid reports-diet-averages">{(["calories", "protein", "carbohydrates", "fat"] as const).map(nutrient => { const average = data.diet.averages[nutrient]; const target = data.diet.targets[nutrient]; return <Stat key={nutrient} label={`${nutrientLabel[nutrient]} daily average`} value={average ? `${average.value.toLocaleString()} ${nutrientUnit(nutrient)}` : "No known values"} detail={average ? `${average.daysCounted} day${average.daysCounted === 1 ? "" : "s"} with known data${average.incomplete ? " · partial values" : ""}${target === null ? " · no target set" : ` · target ${target} ${nutrientUnit(nutrient)}`}` : target === null ? "No target set" : `Target ${target} ${nutrientUnit(nutrient)} · no intake data`} tone={average?.incomplete ? "caution" : "neutral"} />; })}</div>
          <article className="content-panel reports-chart-card reports-diet-chart"><h3>Daily intake and targets</h3><p>Known nutrient subtotals: calories use the left axis and macronutrients use the right axis. Missing values appear as gaps; hover for completeness.</p><div className="reports-chart reports-chart-tall"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.diet.days.map(day => ({ date: displayDate(day.date), "Calories known subtotal": day.entryCount && day.totals.calories.knownEntries ? day.totals.calories.value : null, "Protein known subtotal": day.entryCount && day.totals.protein.knownEntries ? day.totals.protein.value : null, "Carbs known subtotal": day.entryCount && day.totals.carbohydrates.knownEntries ? day.totals.carbohydrates.value : null, "Fat known subtotal": day.entryCount && day.totals.fat.knownEntries ? day.totals.fat.value : null, "Calories target": data.diet.targets.calories, "Protein target": data.diet.targets.protein, "Carbs target": data.diet.targets.carbohydrates, "Fat target": data.diet.targets.fat }))} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis yAxisId="calories" tick={{ fontSize: 10 }} /><YAxis yAxisId="grams" orientation="right" tick={{ fontSize: 10 }} /><Tooltip /><Legend /><Line yAxisId="calories" type="monotone" dataKey="Calories known subtotal" stroke="#d29a50" connectNulls={false} dot={false} /><Line yAxisId="grams" type="monotone" dataKey="Protein known subtotal" stroke="#668a73" connectNulls={false} dot={false} /><Line yAxisId="grams" type="monotone" dataKey="Carbs known subtotal" stroke="#8197b0" connectNulls={false} dot={false} /><Line yAxisId="grams" type="monotone" dataKey="Fat known subtotal" stroke="#b57996" connectNulls={false} dot={false} />{data.diet.targets.calories !== null && <Line yAxisId="calories" dataKey="Calories target" stroke="#d29a50" strokeDasharray="5 5" dot={false} />}{data.diet.targets.protein !== null && <Line yAxisId="grams" dataKey="Protein target" stroke="#668a73" strokeDasharray="5 5" dot={false} />}{data.diet.targets.carbohydrates !== null && <Line yAxisId="grams" dataKey="Carbs target" stroke="#8197b0" strokeDasharray="5 5" dot={false} />}{data.diet.targets.fat !== null && <Line yAxisId="grams" dataKey="Fat target" stroke="#b57996" strokeDasharray="5 5" dot={false} />}</LineChart></ResponsiveContainer></div><p className="reports-chart-note">Daily averages exclude days without known values. Partial nutrient totals are labeled above and are not treated as complete.</p></article>
        </>}
      </section>

      <section className="reports-section"><div className="reports-section-heading"><div><span className="section-kicker">WELLNESS</span><h2>Metric trends</h2></div></div>
        {data.wellness.length === 0 ? <EmptyReport>No enabled, active wellness metrics are available.</EmptyReport> : <div className="reports-metric-grid">{data.wellness.map(report => <article key={report.metric.id} className="content-panel reports-metric-card"><div className="reports-metric-heading"><span>{report.metric.icon}</span><div><h3>{report.metric.name}</h3><p>{report.metric.unit} · {report.metric.trackingType} · {report.metric.frequency}</p></div></div>{report.logCount === 0 ? <div className="reports-metric-empty">No measurements in this period.</div> : <><div className="reports-metric-summary"><strong>{report.metric.trackingType === "boolean" ? `${report.periodValue} completed days` : `${report.periodValue.toLocaleString()} ${report.metric.unit}`}</strong><span>{report.logCount} measurement{report.logCount === 1 ? "" : "s"}{report.targetForRange === null ? ` · ${report.targetNote}` : ` · target ${report.targetForRange.toLocaleString()} ${report.metric.unit}`}</span></div><div className="reports-chart reports-metric-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={report.points.map(point => ({ date: displayDate(point.date), Value: point.value }))}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} /><Tooltip formatter={value => report.metric.trackingType === "boolean" ? (Number(value) ? "Done" : "Not done") : `${value} ${report.metric.unit}`} /><Line type="monotone" dataKey="Value" stroke="#688a75" connectNulls={false} dot={{ r: 2 }} /></LineChart></ResponsiveContainer></div></>}</article>)}</div>}
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
