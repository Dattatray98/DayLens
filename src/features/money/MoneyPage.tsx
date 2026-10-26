import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { FiArrowDownLeft, FiArrowUpRight, FiEdit2, FiPlus, FiSearch, FiSettings, FiTrash2, FiX } from "react-icons/fi";
import {
  createMoneyCategory,
  createMoneyTransaction,
  deleteMoneyCategory,
  deleteMoneyTransaction,
  formatRupees,
  getMoneyCategories,
  getMoneySummary,
  getMoneyTransactions,
  renameMoneyCategory,
  rupeesToPaise,
  rupeesToPaiseOrZero,
  setOpeningBalance,
  updateMoneyTransaction,
  type MoneyCategory,
  type MoneyKind,
  type MoneySummary,
  type MoneyTransaction,
  type TransactionFilters,
} from "./moneyRepository";

const localDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const localMonthInputValue = (date = new Date()) => localDateInputValue(date).slice(0, 7);

const emptySummary: MoneySummary = {
  openingBalancePaise: 0,
  balancePaise: 0,
  monthIncomePaise: 0,
  monthExpensesPaise: 0,
  monthNetPaise: 0,
  expenseByCategory: [],
  recentTransactions: [],
};

interface TransactionDraft {
  kind: MoneyKind;
  amount: string;
  date: string;
  categoryId: string;
  description: string;
  paymentMethod: string;
}

const blankDraft = (): TransactionDraft => ({
  kind: "expense",
  amount: "",
  date: localDateInputValue(),
  categoryId: "",
  description: "",
  paymentMethod: "",
});

export default function MoneyPage() {
  const [month, setMonth] = useState(localMonthInputValue());
  const [categories, setCategories] = useState<MoneyCategory[]>([]);
  const [transactions, setTransactions] = useState<MoneyTransaction[]>([]);
  const [summary, setSummary] = useState(emptySummary);
  const [filters, setFilters] = useState<TransactionFilters>({ kind: "all", categoryId: "all", search: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [transactionEditor, setTransactionEditor] = useState<MoneyTransaction | "new" | null>(null);
  const [draft, setDraft] = useState<TransactionDraft>(blankDraft());
  const [openingEditor, setOpeningEditor] = useState(false);
  const [openingDraft, setOpeningDraft] = useState("0.00");
  const [categoryEditor, setCategoryEditor] = useState<{ category?: MoneyCategory; kind: MoneyKind } | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "transaction" | "category"; id: number; name: string } | null>(null);
  const [expandedTransactionId, setExpandedTransactionId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    return Promise.all([
      getMoneyCategories(),
      getMoneyTransactions(filters),
      getMoneySummary(month),
    ]);
  }, [filters, month]);

  const applyData = useCallback(([nextCategories, nextTransactions, nextSummary]: Awaited<ReturnType<typeof fetchData>>) => {
    setCategories(nextCategories);
    setTransactions(nextTransactions);
    setSummary(nextSummary);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true); setError("");
    try { applyData(await fetchData()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load Money data."); }
    finally { setLoading(false); }
  }, [fetchData, applyData]);

  useEffect(() => {
    let active = true;
    fetchData()
      .then(data => { if (active) applyData(data); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Could not load Money data."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchData, applyData]);

  const openNewTransaction = (kind: MoneyKind = "expense") => {
    setError("");
    setDraft({ ...blankDraft(), kind, categoryId: String(categories.find(category => category.kind === kind)?.id ?? "") });
    setTransactionEditor("new");
  };

  const openEditTransaction = (transaction: MoneyTransaction) => {
    setError("");
    setDraft({
      kind: transaction.kind,
      amount: (transaction.amountPaise / 100).toFixed(2),
      date: transaction.transactionDate,
      categoryId: String(transaction.categoryId),
      description: transaction.description,
      paymentMethod: transaction.paymentMethod,
    });
    setTransactionEditor(transaction);
  };

  const saveTransaction = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const input = {
        kind: draft.kind,
        amountPaise: rupeesToPaise(draft.amount),
        transactionDate: draft.date,
        categoryId: Number(draft.categoryId),
        description: draft.description,
        paymentMethod: draft.paymentMethod,
      };
      if (transactionEditor === "new") await createMoneyTransaction(input);
      else if (transactionEditor) await updateMoneyTransaction(transactionEditor.id, input);
      else return;
      setTransactionEditor(null);
      setNotice(transactionEditor === "new" ? "Transaction saved." : "Transaction updated.");
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the transaction.");
    } finally { setSaving(false); }
  };

  const saveOpeningBalance = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      await setOpeningBalance(rupeesToPaiseOrZero(openingDraft));
      setOpeningEditor(false); setNotice("Opening balance saved."); await loadData();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the opening balance."); }
    finally { setSaving(false); }
  };

  const saveCategory = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      if (categoryEditor?.category) await renameMoneyCategory(categoryEditor.category.id, categoryDraft);
      else if (categoryEditor) await createMoneyCategory(categoryEditor.kind, categoryDraft);
      setCategoryEditor(null); setNotice(categoryEditor?.category ? "Category updated." : "Category added."); await loadData();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the category."); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true); setError(""); setNotice("");
    try {
      if (deleteTarget.type === "transaction") {
        await deleteMoneyTransaction(deleteTarget.id);
        setNotice("Transaction deleted.");
      } else {
        await deleteMoneyCategory(deleteTarget.id);
        setNotice("Category deleted.");
      }
      setDeleteTarget(null); await loadData();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete this item."); }
    finally { setSaving(false); }
  };

  const categoriesForDraft = useMemo(() => categories.filter(category => category.kind === draft.kind), [categories, draft.kind]);
  const visibleExpenseCategories = summary.expenseByCategory;
  const categoryMax = Math.max(1, ...visibleExpenseCategories.map(item => item.amountPaise));

  return <div className="money-page">
    <div className="money-heading-row">
      <div className="page-heading"><div><span className="section-kicker">YOUR FINANCES</span><h1>Money</h1><p>Track what comes in and what goes out.</p></div></div>
      <div className="money-actions">
        <button className="secondary-button" type="button" onClick={() => { setOpeningDraft((summary.openingBalancePaise / 100).toFixed(2)); setOpeningEditor(true); }}>Set opening balance</button>
        <button className="primary-button money-add" type="button" onClick={() => openNewTransaction()}><FiPlus /> Add transaction</button>
      </div>
    </div>

    {error && <div className="money-alert money-alert-error" role="alert"><span>{error}</span><button type="button" className="icon-button" aria-label="Dismiss error" onClick={() => setError("")}><FiX /></button></div>}
    {notice && <div className="money-alert money-alert-success" role="status"><span>{notice}</span><button type="button" className="icon-button" aria-label="Dismiss message" onClick={() => setNotice("")}><FiX /></button></div>}

    <section className="money-summary-grid" aria-label="Financial summary">
      <article className="money-balance-card"><span className="money-card-label">CURRENT BALANCE</span><strong>{loading ? "Loading…" : formatRupees(summary.balancePaise)}</strong><span className="money-card-foot">Opening balance {formatRupees(summary.openingBalancePaise)}</span></article>
      <article className="money-stat-card"><div className="money-stat-heading"><span>Income</span><input type="month" aria-label="Summary month" value={month} onChange={event => { if (event.target.value) { setLoading(true); setMonth(event.target.value); } }} /></div><strong className="income-text">{loading ? "Loading…" : formatRupees(summary.monthIncomePaise)}</strong><span className="money-card-foot">For selected month</span></article>
      <article className="money-stat-card"><span className="money-stat-heading">Expenses</span><strong className="expense-text">{loading ? "Loading…" : formatRupees(summary.monthExpensesPaise)}</strong><span className="money-card-foot">For selected month</span></article>
      <article className="money-stat-card"><span className="money-stat-heading">Net cash flow</span><strong className={summary.monthNetPaise < 0 ? "expense-text" : "income-text"}>{loading ? "Loading…" : formatRupees(summary.monthNetPaise)}</strong><span className="money-card-foot">Income minus expenses</span></article>
    </section>

    <section className="money-insights-grid">
      <article className="money-panel">
        <div className="money-panel-heading"><div><h2>Spending by category</h2><p>Expenses in the selected month</p></div><span className="money-month-chip">{month}</span></div>
        {loading ? <div className="money-inline-loading" role="status">Loading category totals…</div> : visibleExpenseCategories.length === 0 ? <div className="money-small-empty">No expenses recorded for this month.</div> : <div className="category-bars">{visibleExpenseCategories.map(item => <div className="category-bar-row" key={item.categoryId}><div><span>{item.categoryName}</span><strong>{formatRupees(item.amountPaise)}</strong></div><span className="category-bar-track"><span style={{ width: `${Math.max(3, item.amountPaise / categoryMax * 100)}%` }} /></span></div>)}</div>}
      </article>
      <article className="money-panel category-manage-panel">
        <div className="money-panel-heading"><div><h2>Categories</h2><p>Income and expense groups</p></div><button className="secondary-button compact-button" type="button" onClick={() => setCategoryManagerOpen(value => !value)}><FiSettings /> {categoryManagerOpen ? "Done" : "Manage"}</button></div>
        {categoryManagerOpen ? <div className="category-manager"><div className="category-manager-actions"><button type="button" className="category-add-button" onClick={() => { setCategoryDraft(""); setCategoryEditor({ kind: "expense" }); }}> <FiPlus /> Expense category</button><button type="button" className="category-add-button" onClick={() => { setCategoryDraft(""); setCategoryEditor({ kind: "income" }); }}><FiPlus /> Income category</button></div><div className="category-list">{categories.map(category => <div className="category-list-row" key={category.id}><span><i className={`type-dot ${category.kind}`} />{category.name}<small>{category.kind}{category.isDefault ? " · default" : ""}</small></span>{!category.isDefault && <span className="category-row-actions"><button type="button" className="icon-button" aria-label={`Rename ${category.name}`} onClick={() => { setCategoryDraft(category.name); setCategoryEditor({ category, kind: category.kind }); }}><FiEdit2 /></button><button type="button" className="icon-button danger-icon" aria-label={`Delete ${category.name}`} onClick={() => setDeleteTarget({ type: "category", id: category.id, name: category.name })}><FiTrash2 /></button></span>}</div>)}</div></div> : <div className="category-counts"><span><i className="type-dot income" />{categories.filter(c => c.kind === "income").length} income categories</span><span><i className="type-dot expense" />{categories.filter(c => c.kind === "expense").length} expense categories</span></div>}
      </article>
    </section>

    <section className="money-panel transaction-panel">
      <div className="money-panel-heading transaction-heading"><div><h2>Transactions</h2><p>{transactions.length} {transactions.length === 1 ? "entry" : "entries"} match your filters</p></div><div className="transaction-heading-actions"><button className="secondary-button compact-button" type="button" onClick={() => openNewTransaction("income")}>Add income</button><button className="secondary-button compact-button" type="button" onClick={() => openNewTransaction("expense")}>Add expense</button></div></div>
      <div className="transaction-filters">
        <label className="search-filter"><FiSearch aria-hidden="true" /><input aria-label="Search transactions" type="search" value={filters.search ?? ""} placeholder="Search description or category" onChange={event => { setLoading(true); setFilters(current => ({ ...current, search: event.target.value })); }} /></label>
        <label><span>From</span><input type="date" aria-label="From date" value={filters.from ?? ""} onChange={event => { setLoading(true); setFilters(current => ({ ...current, from: event.target.value || undefined })); }} /></label>
        <label><span>To</span><input type="date" aria-label="To date" value={filters.to ?? ""} onChange={event => { setLoading(true); setFilters(current => ({ ...current, to: event.target.value || undefined })); }} /></label>
        <label><span>Type</span><select aria-label="Transaction type filter" value={filters.kind ?? "all"} onChange={event => { setLoading(true); setFilters(current => ({ ...current, kind: event.target.value as MoneyKind | "all" })); }}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option></select></label>
        <label><span>Category</span><select aria-label="Category filter" value={filters.categoryId ?? "all"} onChange={event => { setLoading(true); setFilters(current => ({ ...current, categoryId: event.target.value === "all" ? "all" : Number(event.target.value) })); }}><option value="all">All categories</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name} · {category.kind}</option>)}</select></label>
        {(filters.from || filters.to || filters.kind !== "all" || filters.categoryId !== "all" || filters.search) && <button className="clear-filters" type="button" onClick={() => { setLoading(true); setFilters({ kind: "all", categoryId: "all", search: "" }); }}>Clear filters</button>}
      </div>
      {loading ? <div className="money-inline-loading" role="status">Loading transactions…</div> : transactions.length === 0 ? <div className="money-empty-state"><span className="money-empty-mark"><FiPlus /></span><strong>{filters.from || filters.to || filters.search || filters.kind !== "all" || filters.categoryId !== "all" ? "No matching transactions" : "No transactions yet"}</strong><p>{filters.from || filters.to || filters.search || filters.kind !== "all" || filters.categoryId !== "all" ? "Try changing or clearing your filters." : "Add your first income or expense to start tracking your balance."}</p>{!filters.search && !filters.from && !filters.to && <button type="button" className="secondary-button" onClick={() => openNewTransaction()}><FiPlus /> Add transaction</button>}</div> : <div className="transaction-table-wrap"><table className="transaction-table"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Payment method</th><th className="amount-column">Amount</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{transactions.map(transaction => {
        const expanded = expandedTransactionId === transaction.id;
        const detailsId = `transaction-details-${transaction.id}`;
        const transactionName = transaction.description || transaction.categoryName;
        const displayDate = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${transaction.transactionDate}T00:00:00Z`));
        const amountLabel = `${transaction.kind === "income" ? "+" : "−"}${formatRupees(transaction.amountPaise)}`;
        const TypeIcon = transaction.kind === "income" ? FiArrowDownLeft : FiArrowUpRight;
        const actionButtons = <div className="transaction-actions"><button type="button" className="icon-button" aria-label={`Edit ${transactionName}`} onClick={() => openEditTransaction(transaction)}><FiEdit2 /></button><button type="button" className="icon-button danger-icon" aria-label={`Delete ${transactionName}`} onClick={() => setDeleteTarget({ type: "transaction", id: transaction.id, name: transactionName })}><FiTrash2 /></button></div>;
        return <tr key={transaction.id} className={expanded ? "transaction-row-expanded" : ""}>
          <td className="date-cell" data-label="Date">{displayDate}</td>
          <td data-label="Description"><strong className="transaction-description">{transactionName}</strong>{transaction.description && <small>{transaction.kind === "income" ? "Income" : "Expense"}</small>}<button type="button" className="transaction-card-toggle" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpandedTransactionId(expanded ? null : transaction.id)}><span className="transaction-card-main"><span className={`transaction-card-icon ${transaction.kind}`}><TypeIcon aria-hidden="true" /></span><span className="transaction-card-copy"><span>{transaction.kind === "income" ? "Received" : "Paid"} · {transaction.categoryName}</span><strong>{transactionName}</strong><time dateTime={transaction.transactionDate}>{displayDate}</time></span></span><span className="transaction-card-side"><strong className={transaction.kind === "income" ? "income-text" : "expense-text"}>{amountLabel}</strong><small>{expanded ? "Hide details" : "View details"}</small></span></button></td>
          <td data-label="Category"><span className="category-pill">{transaction.categoryName}</span></td>
          <td className="payment-cell" data-label="Payment method">{transaction.paymentMethod || "—"}</td>
          <td data-label="Amount" className={`amount-cell ${transaction.kind === "income" ? "income-text" : "expense-text"}`}>{amountLabel}</td>
          <td data-label="Actions"><div className="transaction-actions">{actionButtons}</div></td>
          <td id={detailsId} className="transaction-extra-cell" colSpan={6} aria-label={`More details for ${transactionName}`}><div className="transaction-extra-values"><span><small>Category</small><strong>{transaction.categoryName}</strong></span><span><small>Payment method</small><strong>{transaction.paymentMethod || "—"}</strong></span></div>{actionButtons}</td>
        </tr>;
      })}</tbody></table></div>}
    </section>

    {transactionEditor && <Modal title={transactionEditor === "new" ? "Add transaction" : "Edit transaction"} onClose={() => setTransactionEditor(null)}><form className="money-form" onSubmit={saveTransaction}>
      <div className="kind-switch" role="group" aria-label="Transaction type"><button type="button" className={draft.kind === "expense" ? "selected expense-selected" : ""} onClick={() => setDraft(current => ({ ...current, kind: "expense", categoryId: String(categories.find(c => c.kind === "expense")?.id ?? "") }))}>Expense</button><button type="button" className={draft.kind === "income" ? "selected income-selected" : ""} onClick={() => setDraft(current => ({ ...current, kind: "income", categoryId: String(categories.find(c => c.kind === "income")?.id ?? "") }))}>Income</button></div>
      <label>Amount (₹)<input autoFocus inputMode="decimal" type="number" min="0.01" step="0.01" required value={draft.amount} onChange={event => setDraft(current => ({ ...current, amount: event.target.value }))} placeholder="0.00" /></label>
      <div className="form-two-column"><label>Date<input type="date" required value={draft.date} onChange={event => setDraft(current => ({ ...current, date: event.target.value }))} /></label><label>Category<select required value={draft.categoryId} onChange={event => setDraft(current => ({ ...current, categoryId: event.target.value }))}><option value="" disabled>Select a category</option>{categoriesForDraft.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>
      <label>Description <span className="optional-label">Optional</span><input maxLength={280} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} placeholder="What was this for?" /></label>
      <label>Payment method <span className="optional-label">Optional</span><input maxLength={60} value={draft.paymentMethod} onChange={event => setDraft(current => ({ ...current, paymentMethod: event.target.value }))} placeholder="Cash, UPI, card…" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => setTransactionEditor(null)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : transactionEditor === "new" ? "Save transaction" : "Save changes"}</button></div>
    </form></Modal>}

    {openingEditor && <Modal title="Set opening balance" onClose={() => setOpeningEditor(false)}><form className="money-form" onSubmit={saveOpeningBalance}><p className="form-help">Enter your starting combined balance before the transactions you plan to record. Your balance is calculated from this amount and all saved transactions.</p><label>Opening balance (₹)<input autoFocus inputMode="decimal" type="number" min="0" step="0.01" required value={openingDraft} onChange={event => setOpeningDraft(event.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => setOpeningEditor(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save balance"}</button></div></form></Modal>}

    {categoryEditor && <Modal title={categoryEditor.category ? "Rename category" : `Add ${categoryEditor.kind} category`} onClose={() => setCategoryEditor(null)}><form className="money-form" onSubmit={saveCategory}><p className="form-help">This category is for {categoryEditor.kind} transactions.</p><label>Category name<input autoFocus maxLength={48} required value={categoryDraft} onChange={event => setCategoryDraft(event.target.value)} placeholder={categoryEditor.kind === "expense" ? "e.g. Education" : "e.g. Investment income"} /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => setCategoryEditor(null)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : categoryEditor.category ? "Save category" : "Add category"}</button></div></form></Modal>}

    {deleteTarget && <Modal title={deleteTarget.type === "transaction" ? "Delete transaction?" : "Delete category?"} onClose={() => setDeleteTarget(null)}><div className="delete-confirm"><p>{deleteTarget.type === "transaction" ? `Delete “${deleteTarget.name}”? This will update your balance and reports.` : `Delete “${deleteTarget.name}”? A category with transactions cannot be deleted.`}</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => setDeleteTarget(null)}>Keep it</button><button type="button" className="danger-button" disabled={saving} onClick={() => void confirmDelete()}>{saving ? "Deleting…" : "Delete"}</button></div></div></Modal>}
  </div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="money-modal" role="dialog" aria-modal="true" aria-labelledby="money-modal-title"><div className="modal-heading"><h2 id="money-modal-title">{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><FiX /></button></div>{children}</section></div>;
}
