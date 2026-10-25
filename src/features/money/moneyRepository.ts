import { Capacitor } from "@capacitor/core";
import { initDatabase, persistDatabaseChanges } from "../../database/configDatabase";

export type MoneyKind = "income" | "expense";

export interface MoneyCategory {
  id: number;
  kind: MoneyKind;
  name: string;
  isDefault: boolean;
}

export interface MoneyTransaction {
  id: number;
  kind: MoneyKind;
  amountPaise: number;
  transactionDate: string;
  categoryId: number;
  categoryName: string;
  description: string;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
}

export interface MoneyTransactionInput {
  kind: MoneyKind;
  amountPaise: number;
  transactionDate: string;
  categoryId: number;
  description: string;
  paymentMethod: string;
}

export interface TransactionFilters {
  from?: string;
  to?: string;
  kind?: MoneyKind | "all";
  categoryId?: number | "all";
  search?: string;
}

export interface MoneySummary {
  openingBalancePaise: number;
  balancePaise: number;
  monthIncomePaise: number;
  monthExpensesPaise: number;
  monthNetPaise: number;
  expenseByCategory: Array<{ categoryId: number; categoryName: string; amountPaise: number }>;
  recentTransactions: MoneyTransaction[];
}

const kindIsValid = (kind: string): kind is MoneyKind => kind === "income" || kind === "expense";

const parseRupees = (value: string, allowZero: boolean) => {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Enter an amount with up to two decimal places.");
  }
  const [rupees, fraction = ""] = normalized.split(".");
  const paise = BigInt(rupees) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (allowZero ? paise < 0n : paise <= 0n) {
    throw new Error(allowZero ? "Amount cannot be negative." : "Amount must be greater than zero.");
  }
  if (paise > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Amount is too large.");
  return Number(paise);
};

export const rupeesToPaise = (value: string) => parseRupees(value, false);
export const rupeesToPaiseOrZero = (value: string) => parseRupees(value, true);

export const formatRupees = (paise: number, options: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(paise / 100);

const validateDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose a valid transaction date.");
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("Choose a valid transaction date.");
  }
};

const validateTransaction = (input: MoneyTransactionInput) => {
  if (!kindIsValid(input.kind)) throw new Error("Choose income or expense.");
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new Error("Amount must be a positive rupee value.");
  }
  validateDate(input.transactionDate);
  if (!Number.isSafeInteger(input.categoryId) || input.categoryId <= 0) {
    throw new Error("Choose a category.");
  }
  if (input.description.length > 280) throw new Error("Description must be 280 characters or fewer.");
  if (input.paymentMethod.length > 60) throw new Error("Payment method must be 60 characters or fewer.");
};

const mapCategory = (row: Record<string, unknown>): MoneyCategory => ({
  id: Number(row.id),
  kind: String(row.kind) as MoneyKind,
  name: String(row.name),
  isDefault: Number(row.is_default) === 1,
});

const mapTransaction = (row: Record<string, unknown>): MoneyTransaction => ({
  id: Number(row.id),
  kind: String(row.kind) as MoneyKind,
  amountPaise: Number(row.amount_paise),
  transactionDate: String(row.transaction_date),
  categoryId: Number(row.category_id),
  categoryName: String(row.category_name),
  description: String(row.description ?? ""),
  paymentMethod: String(row.payment_method ?? ""),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

const transactionSelect = `
  SELECT t.id, t.kind, t.amount_paise, t.transaction_date, t.category_id,
         c.name AS category_name, t.description, t.payment_method,
         t.created_at, t.updated_at
  FROM money_transactions t
  INNER JOIN money_categories c ON c.id = t.category_id
`;

const persist = async () => {
  if (Capacitor.getPlatform() === "web") await persistDatabaseChanges();
};

export const getMoneyCategories = async (kind?: MoneyKind) => {
  const db = await initDatabase();
  const result = await db.query(
    `SELECT id, kind, name, is_default FROM money_categories ${kind ? "WHERE kind = ?" : ""}
     ORDER BY kind ASC, is_default DESC, name COLLATE NOCASE ASC`,
    kind ? [kind] : [],
  );
  return (result.values ?? []).map((row) => mapCategory(row as Record<string, unknown>));
};

export const createMoneyCategory = async (kind: MoneyKind, nameInput: string) => {
  if (!kindIsValid(kind)) throw new Error("Choose income or expense.");
  const name = nameInput.trim();
  if (!name) throw new Error("Category name is required.");
  if (name.length > 48) throw new Error("Category name must be 48 characters or fewer.");
  const db = await initDatabase();
  try {
    const result = await db.run(
      `INSERT INTO money_categories (kind, name, is_default, created_at) VALUES (?, ?, 0, ?)`,
      [kind, name, new Date().toISOString()],
    );
    await persist();
    return Number(result.changes?.lastId);
  } catch (error) {
    if (error instanceof Error && /unique|constraint/i.test(error.message)) {
      throw new Error("A category with this name already exists for that type.", { cause: error });
    }
    throw error;
  }
};

export const renameMoneyCategory = async (id: number, nameInput: string) => {
  const name = nameInput.trim();
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Category not found.");
  if (!name) throw new Error("Category name is required.");
  if (name.length > 48) throw new Error("Category name must be 48 characters or fewer.");
  const db = await initDatabase();
  const result = await db.query("SELECT is_default FROM money_categories WHERE id = ?", [id]);
  if (!result.values?.[0]) throw new Error("Category not found.");
  if (Number(result.values[0].is_default) === 1) throw new Error("Default categories cannot be renamed.");
  try {
    await db.run("UPDATE money_categories SET name = ? WHERE id = ?", [name, id]);
    await persist();
  } catch (error) {
    if (error instanceof Error && /unique|constraint/i.test(error.message)) {
      throw new Error("A category with this name already exists for that type.", { cause: error });
    }
    throw error;
  }
};

export const deleteMoneyCategory = async (id: number) => {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Category not found.");
  const db = await initDatabase();
  const result = await db.query("SELECT is_default FROM money_categories WHERE id = ?", [id]);
  if (!result.values?.[0]) throw new Error("Category not found.");
  if (Number(result.values[0].is_default) === 1) throw new Error("Default categories cannot be deleted.");
  try {
    await db.run("DELETE FROM money_categories WHERE id = ?", [id]);
    await persist();
  } catch (error) {
    if (error instanceof Error && /foreign key|constraint/i.test(error.message)) {
      throw new Error("This category has transactions. Reassign or delete them before removing it.", { cause: error });
    }
    throw error;
  }
};

export const getMoneyTransactions = async (filters: TransactionFilters = {}) => {
  const db = await initDatabase();
  const clauses: string[] = [];
  const values: (string | number)[] = [];
  if (filters.from) { validateDate(filters.from); clauses.push("t.transaction_date >= ?"); values.push(filters.from); }
  if (filters.to) { validateDate(filters.to); clauses.push("t.transaction_date <= ?"); values.push(filters.to); }
  if (filters.kind && filters.kind !== "all") {
    if (!kindIsValid(filters.kind)) throw new Error("Choose a valid transaction type.");
    clauses.push("t.kind = ?"); values.push(filters.kind);
  }
  if (filters.categoryId && filters.categoryId !== "all") {
    if (!Number.isSafeInteger(filters.categoryId) || filters.categoryId <= 0) throw new Error("Choose a valid category.");
    clauses.push("t.category_id = ?"); values.push(filters.categoryId);
  }
  const search = filters.search?.trim();
  if (search) { clauses.push("(LOWER(t.description) LIKE LOWER(?) OR LOWER(c.name) LIKE LOWER(?))"); values.push(`%${search}%`, `%${search}%`); }
  const result = await db.query(
    `${transactionSelect}${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""}
     ORDER BY t.transaction_date DESC, t.id DESC`,
    values,
  );
  return (result.values ?? []).map((row) => mapTransaction(row as Record<string, unknown>));
};

const validateCategoryKind = async (kind: MoneyKind, categoryId: number) => {
  const db = await initDatabase();
  const result = await db.query("SELECT kind FROM money_categories WHERE id = ?", [categoryId]);
  if (!result.values?.[0]) throw new Error("That category no longer exists.");
  if (String(result.values[0].kind) !== kind) throw new Error("Choose a category for this transaction type.");
};

export const createMoneyTransaction = async (input: MoneyTransactionInput) => {
  validateTransaction(input);
  await validateCategoryKind(input.kind, input.categoryId);
  const db = await initDatabase();
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO money_transactions
      (kind, amount_paise, transaction_date, category_id, description, payment_method, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.kind, input.amountPaise, input.transactionDate, input.categoryId, input.description.trim(), input.paymentMethod.trim(), now, now],
  );
  await persist();
  return Number(result.changes?.lastId);
};

export const updateMoneyTransaction = async (id: number, input: MoneyTransactionInput) => {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Transaction not found.");
  validateTransaction(input);
  await validateCategoryKind(input.kind, input.categoryId);
  const db = await initDatabase();
  const result = await db.run(
    `UPDATE money_transactions SET kind = ?, amount_paise = ?, transaction_date = ?, category_id = ?,
       description = ?, payment_method = ?, updated_at = ? WHERE id = ?`,
    [input.kind, input.amountPaise, input.transactionDate, input.categoryId, input.description.trim(), input.paymentMethod.trim(), new Date().toISOString(), id],
  );
  if (Number(result.changes?.changes ?? 0) === 0) throw new Error("Transaction was not found or was not changed.");
  await persist();
};

export const deleteMoneyTransaction = async (id: number) => {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Transaction not found.");
  const db = await initDatabase();
  const result = await db.run("DELETE FROM money_transactions WHERE id = ?", [id]);
  if (Number(result.changes?.changes ?? 0) === 0) throw new Error("Transaction not found.");
  await persist();
};

export const getOpeningBalance = async () => {
  const db = await initDatabase();
  const result = await db.query("SELECT opening_balance_paise FROM money_settings WHERE id = 1");
  return Number(result.values?.[0]?.opening_balance_paise ?? 0);
};

export const setOpeningBalance = async (openingBalancePaise: number) => {
  if (!Number.isSafeInteger(openingBalancePaise) || openingBalancePaise < 0) {
    throw new Error("Opening balance must be zero or a positive amount.");
  }
  const db = await initDatabase();
  await db.run(
    "UPDATE money_settings SET opening_balance_paise = ?, updated_at = ? WHERE id = 1",
    [openingBalancePaise, new Date().toISOString()],
  );
  await persist();
};

export const getMoneySummary = async (month: string): Promise<MoneySummary> => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Choose a valid month.");
  const db = await initDatabase();
  const [balanceResult, monthResult, categoryResult, recentResult] = await Promise.all([
    db.query(`SELECT s.opening_balance_paise + COALESCE(SUM(
        CASE WHEN t.kind = 'income' THEN t.amount_paise ELSE -t.amount_paise END
      ), 0) AS balance_paise, s.opening_balance_paise
      FROM money_settings s LEFT JOIN money_transactions t ON 1 = 1 WHERE s.id = 1
      GROUP BY s.id, s.opening_balance_paise`),
    db.query(`SELECT
        COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_paise ELSE 0 END), 0) AS income_paise,
        COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount_paise ELSE 0 END), 0) AS expenses_paise
      FROM money_transactions WHERE transaction_date >= ? AND transaction_date < ?`,
      [`${month}-01`, nextMonth(month)]),
    db.query(`SELECT c.id AS category_id, c.name AS category_name, SUM(t.amount_paise) AS amount_paise
      FROM money_transactions t INNER JOIN money_categories c ON c.id = t.category_id
      WHERE t.kind = 'expense' AND t.transaction_date >= ? AND t.transaction_date < ?
      GROUP BY c.id, c.name ORDER BY amount_paise DESC, c.name COLLATE NOCASE ASC`,
      [`${month}-01`, nextMonth(month)]),
    db.query(`${transactionSelect} ORDER BY t.transaction_date DESC, t.id DESC LIMIT 5`),
  ]);
  const balance = balanceResult.values?.[0];
  const monthTotals = monthResult.values?.[0];
  const income = Number(monthTotals?.income_paise ?? 0);
  const expenses = Number(monthTotals?.expenses_paise ?? 0);
  return {
    openingBalancePaise: Number(balance?.opening_balance_paise ?? 0),
    balancePaise: Number(balance?.balance_paise ?? 0),
    monthIncomePaise: income,
    monthExpensesPaise: expenses,
    monthNetPaise: income - expenses,
    expenseByCategory: (categoryResult.values ?? []).map((row) => ({
      categoryId: Number(row.category_id),
      categoryName: String(row.category_name),
      amountPaise: Number(row.amount_paise),
    })),
    recentTransactions: (recentResult.values ?? []).map((row) => mapTransaction(row as Record<string, unknown>)),
  };
};

const nextMonth = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthNumber === 12
    ? `${String(year + 1).padStart(4, "0")}-01-01`
    : `${String(year).padStart(4, "0")}-${String(monthNumber + 1).padStart(2, "0")}-01`;
};
