import {
    CapacitorSQLite,
    SQLiteConnection,
    type SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import { Capacitor } from "@capacitor/core";

const sqliteConnection = new SQLiteConnection(CapacitorSQLite);

let databaseInitialized = false;
let databaseInitialization: Promise<SQLiteDBConnection> | null = null;

interface NodeDbShim {
    execute(sql: string, transaction?: boolean): Promise<{ changes: { changes: number } }>;
    query(sql: string, params?: NodeSqliteValue[]): Promise<{ values?: Record<string, unknown>[] }>;
    run(sql: string, params?: NodeSqliteValue[]): Promise<{ changes: { changes: number; lastId: number } }>;
    executeSet(set: Array<{ statement: string; values?: NodeSqliteValue[] }>, transaction?: boolean): Promise<{ changes: { changes: number } }>;
    isDBOpen(): Promise<{ result: boolean }>;
    open(): Promise<void>;
}

type NodeSqliteValue = null | number | bigint | string | ArrayBufferView;
interface NodeSyncDatabase {
    exec(sql: string): void;
    prepare(sql: string): {
        all(...params: NodeSqliteValue[]): unknown[];
        run(...params: NodeSqliteValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    };
}

type GlobalWithNodeProcess = typeof globalThis & {
    process?: { getBuiltinModule?: (moduleName: string) => unknown };
};

let nodeDbInstance: NodeDbShim | null = null;

export const persistDatabaseChanges = async () => {
    if (Capacitor.getPlatform() === "web") {
        await sqliteConnection.saveToStore("index");
    }
};

const defaultMoneyCategories = [
    ["income", "Salary"],
    ["income", "Freelance"],
    ["income", "Other income"],
    ["expense", "Food"],
    ["expense", "Housing"],
    ["expense", "Transport"],
    ["expense", "Utilities"],
    ["expense", "Health"],
    ["expense", "Shopping"],
    ["expense", "Other expense"],
] as const;

const seedMoneyDefaults = async (db: SQLiteDBConnection) => {
    const categorySeeds = defaultMoneyCategories.map(([kind, name]) =>
        `INSERT OR IGNORE INTO money_categories (kind, name, is_default, created_at)
         VALUES ('${kind}', '${name.replaceAll("'", "''")}', 1, CURRENT_TIMESTAMP);`,
    ).join("\n");
    await db.execute(`${categorySeeds}
        INSERT OR IGNORE INTO money_settings (id, opening_balance_paise, updated_at)
        VALUES (1, 0, CURRENT_TIMESTAMP);`, true);
};

export const initDatabase = async (): Promise<SQLiteDBConnection> => {
    if (!databaseInitialization) {
        databaseInitialization = initializeDatabase().catch((error: unknown) => {
            databaseInitialization = null;
            throw error;
        });
    }
    return databaseInitialization;
};

const initializeDatabase = async (): Promise<SQLiteDBConnection> => {
    try {
        const platform = Capacitor.getPlatform();

        if (platform === "web" && typeof document === "undefined") {
            if (!nodeDbInstance) {
                const sqliteMod = (globalThis as GlobalWithNodeProcess).process?.getBuiltinModule?.("node:sqlite") as
                    | { DatabaseSync: new (path: string) => NodeSyncDatabase }
                    | undefined;
                if (!sqliteMod) {
                    throw new Error("node:sqlite not available in this environment");
                }
                const syncDb = new sqliteMod.DatabaseSync(":memory:");
                nodeDbInstance = {
                    execute: async (sql: string) => {
                        syncDb.exec(sql);
                        return { changes: { changes: 1 } };
                    },
                    query: async (sql: string, params: NodeSqliteValue[] = []): Promise<{ values?: Record<string, unknown>[] }> => {
                        const stmt = syncDb.prepare(sql);
                        const values = stmt.all(...params) as Record<string, unknown>[];
                        return { values };
                    },
                    run: async (sql: string, params: NodeSqliteValue[] = []) => {
                        const stmt = syncDb.prepare(sql);
                        const info = stmt.run(...params);
                        return {
                            changes: {
                                changes: Number(info.changes),
                                lastId: Number(info.lastInsertRowid),
                            },
                        };
                    },
                    executeSet: async (set, transaction = true) => {
                        if (transaction) syncDb.exec("BEGIN TRANSACTION;");
                        try {
                            for (const item of set) {
                                syncDb.prepare(item.statement).run(...(item.values ?? []));
                            }
                            if (transaction) syncDb.exec("COMMIT;");
                            return { changes: { changes: set.length } };
                        } catch (error) {
                            if (transaction) syncDb.exec("ROLLBACK;");
                            throw error;
                        }
                    },
                    isDBOpen: async () => ({ result: true }),
                    open: async () => {},
                };

                await nodeDbInstance.execute(`
                    CREATE TABLE IF NOT EXISTS food_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        food TEXT NOT NULL,
                        quantity REAL NOT NULL,
                        unit TEXT NOT NULL,
                        calories REAL NOT NULL,
                        protein REAL NOT NULL,
                        timestamp TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS metrics (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        icon TEXT NOT NULL DEFAULT '📊',
                        category TEXT NOT NULL DEFAULT 'custom',
                        unit TEXT NOT NULL,
                        target_value REAL NOT NULL CHECK (target_value >= 0),
                        frequency TEXT NOT NULL,
                        tracking_type TEXT NOT NULL,
                        source TEXT NOT NULL DEFAULT 'manual',
                        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
                        archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
                        sort_order INTEGER NOT NULL DEFAULT 0,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS metric_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        metric_id INTEGER NOT NULL,
                        value REAL NOT NULL,
                        timestamp TEXT NOT NULL,
                        note TEXT
                    );

                    CREATE TABLE IF NOT EXISTS diet_foods (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
                        reference_basis TEXT NOT NULL CHECK (reference_basis IN ('per_100g', 'per_100ml', 'per_serving')),
                        serving_size REAL NOT NULL CHECK (serving_size > 0),
                        serving_unit TEXT NOT NULL CHECK (serving_unit IN ('g', 'ml', 'piece', 'serving')),
                        calories REAL CHECK (calories IS NULL OR calories >= 0),
                        protein REAL CHECK (protein IS NULL OR protein >= 0),
                        carbohydrates REAL CHECK (carbohydrates IS NULL OR carbohydrates >= 0),
                        fat REAL CHECK (fat IS NULL OR fat >= 0),
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        CHECK (
                            (reference_basis = 'per_100g' AND serving_unit = 'g') OR
                            (reference_basis = 'per_100ml' AND serving_unit = 'ml') OR
                            reference_basis = 'per_serving'
                        )
                    );

                    CREATE TABLE IF NOT EXISTS diet_entries (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        food_id INTEGER REFERENCES diet_foods(id) ON UPDATE RESTRICT ON DELETE SET NULL,
                        food_name TEXT NOT NULL,
                        quantity REAL NOT NULL CHECK (quantity > 0),
                        unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'piece', 'serving')),
                        calories REAL CHECK (calories IS NULL OR calories >= 0),
                        protein REAL CHECK (protein IS NULL OR protein >= 0),
                        carbohydrates REAL CHECK (carbohydrates IS NULL OR carbohydrates >= 0),
                        fat REAL CHECK (fat IS NULL OR fat >= 0),
                        notes TEXT,
                        timestamp TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS local_accounts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                        password_hash TEXT NOT NULL,
                        password_salt TEXT NOT NULL,
                        password_iterations INTEGER NOT NULL,
                        created_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS money_categories (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
                        name TEXT NOT NULL COLLATE NOCASE,
                        is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
                        created_at TEXT NOT NULL,
                        UNIQUE (kind, name)
                    );

                    CREATE TABLE IF NOT EXISTS money_transactions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
                        amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
                        transaction_date TEXT NOT NULL CHECK (
                            length(transaction_date) = 10
                            AND date(transaction_date) IS NOT NULL
                            AND date(transaction_date) = transaction_date
                        ),
                        category_id INTEGER NOT NULL REFERENCES money_categories(id)
                            ON UPDATE RESTRICT ON DELETE RESTRICT,
                        description TEXT NOT NULL DEFAULT '',
                        payment_method TEXT NOT NULL DEFAULT '',
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS money_settings (
                        id INTEGER PRIMARY KEY CHECK (id = 1),
                        opening_balance_paise INTEGER NOT NULL DEFAULT 0
                            CHECK (opening_balance_paise >= 0),
                        updated_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS notes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        title TEXT NOT NULL CHECK (length(trim(title)) > 0),
                        content TEXT NOT NULL DEFAULT '',
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );

                    CREATE INDEX IF NOT EXISTS idx_notes_updated_at
                        ON notes(updated_at DESC, id DESC);

                    CREATE INDEX IF NOT EXISTS idx_money_transactions_date
                        ON money_transactions(transaction_date);
                    CREATE INDEX IF NOT EXISTS idx_money_transactions_category_date
                        ON money_transactions(category_id, transaction_date);
                    CREATE INDEX IF NOT EXISTS idx_money_transactions_kind_date
                        ON money_transactions(kind, transaction_date);

                    CREATE INDEX IF NOT EXISTS idx_food_logs_timestamp
                        ON food_logs(timestamp);

                    CREATE INDEX IF NOT EXISTS idx_metric_logs_metric_timestamp
                        ON metric_logs(metric_id, timestamp);

                    CREATE INDEX IF NOT EXISTS idx_diet_entries_timestamp
                        ON diet_entries(timestamp);
                    CREATE INDEX IF NOT EXISTS idx_diet_entries_food_id
                        ON diet_entries(food_id);
                `);
                await seedMoneyDefaults(nodeDbInstance as unknown as SQLiteDBConnection);
            }
            await nodeDbInstance.execute("PRAGMA foreign_keys = ON;");
            return nodeDbInstance as unknown as SQLiteDBConnection;
        }

        if (platform === "web") {
            const jeepSqliteEl = document.querySelector("jeep-sqlite");

            if (!jeepSqliteEl) {
                const el = document.createElement("jeep-sqlite");
                document.body.appendChild(el);
            }

            await customElements.whenDefined("jeep-sqlite");
            await sqliteConnection.initWebStore();
        }

        const connectionExists = await sqliteConnection.isConnection(
            "index",
            false
        );

        let db;

        if (connectionExists.result) {
            db = await sqliteConnection.retrieveConnection(
                "index",
                false
            );
        } else {
            db = await sqliteConnection.createConnection(
                "index",
                false,
                "no-encryption",
                1,
                false
            );
        }

        const isOpen = await db.isDBOpen();

        if (!isOpen.result) {
            await db.open();
        }

        await db.execute("PRAGMA foreign_keys = ON;");

        if (!databaseInitialized) {
            await db.execute(`
                CREATE TABLE IF NOT EXISTS food_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    food TEXT NOT NULL,
                    quantity REAL NOT NULL,
                    unit TEXT NOT NULL,
                    calories REAL NOT NULL,
                    protein REAL NOT NULL,
                    timestamp TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    icon TEXT NOT NULL DEFAULT '📊',
                    category TEXT NOT NULL DEFAULT 'custom',
                    unit TEXT NOT NULL,
                    target_value REAL NOT NULL CHECK (target_value >= 0),
                    frequency TEXT NOT NULL,
                    tracking_type TEXT NOT NULL,
                    source TEXT NOT NULL DEFAULT 'manual',
                    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
                    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS metric_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    metric_id INTEGER NOT NULL,
                    value REAL NOT NULL,
                    timestamp TEXT NOT NULL,
                    note TEXT
                );

                CREATE TABLE IF NOT EXISTS diet_foods (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    reference_basis TEXT NOT NULL CHECK (reference_basis IN ('per_100g', 'per_100ml', 'per_serving')),
                    serving_size REAL NOT NULL CHECK (serving_size > 0),
                    serving_unit TEXT NOT NULL CHECK (serving_unit IN ('g', 'ml', 'piece', 'serving')),
                    calories REAL CHECK (calories IS NULL OR calories >= 0),
                    protein REAL CHECK (protein IS NULL OR protein >= 0),
                    carbohydrates REAL CHECK (carbohydrates IS NULL OR carbohydrates >= 0),
                    fat REAL CHECK (fat IS NULL OR fat >= 0),
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    CHECK (
                        (reference_basis = 'per_100g' AND serving_unit = 'g') OR
                        (reference_basis = 'per_100ml' AND serving_unit = 'ml') OR
                        reference_basis = 'per_serving'
                    )
                );

                CREATE TABLE IF NOT EXISTS diet_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    food_id INTEGER REFERENCES diet_foods(id) ON UPDATE RESTRICT ON DELETE SET NULL,
                    food_name TEXT NOT NULL,
                    quantity REAL NOT NULL CHECK (quantity > 0),
                    unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'piece', 'serving')),
                    calories REAL CHECK (calories IS NULL OR calories >= 0),
                    protein REAL CHECK (protein IS NULL OR protein >= 0),
                    carbohydrates REAL CHECK (carbohydrates IS NULL OR carbohydrates >= 0),
                    fat REAL CHECK (fat IS NULL OR fat >= 0),
                    notes TEXT,
                    timestamp TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS local_accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    password_hash TEXT NOT NULL,
                    password_salt TEXT NOT NULL,
                    password_iterations INTEGER NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS money_categories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
                    name TEXT NOT NULL COLLATE NOCASE,
                    is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
                    created_at TEXT NOT NULL,
                    UNIQUE (kind, name)
                );

                CREATE TABLE IF NOT EXISTS money_transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
                    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
                    transaction_date TEXT NOT NULL CHECK (
                        length(transaction_date) = 10
                        AND date(transaction_date) IS NOT NULL
                        AND date(transaction_date) = transaction_date
                    ),
                    category_id INTEGER NOT NULL REFERENCES money_categories(id)
                        ON UPDATE RESTRICT ON DELETE RESTRICT,
                    description TEXT NOT NULL DEFAULT '',
                    payment_method TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS money_settings (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    opening_balance_paise INTEGER NOT NULL DEFAULT 0
                        CHECK (opening_balance_paise >= 0),
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
                    content TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_food_logs_timestamp
                    ON food_logs(timestamp);

                CREATE INDEX IF NOT EXISTS idx_metric_logs_metric_timestamp
                    ON metric_logs(metric_id, timestamp);

                CREATE INDEX IF NOT EXISTS idx_diet_entries_timestamp
                    ON diet_entries(timestamp);
                CREATE INDEX IF NOT EXISTS idx_diet_entries_food_id
                    ON diet_entries(food_id);

                CREATE INDEX IF NOT EXISTS idx_money_transactions_date
                    ON money_transactions(transaction_date);
                CREATE INDEX IF NOT EXISTS idx_money_transactions_category_date
                    ON money_transactions(category_id, transaction_date);
                CREATE INDEX IF NOT EXISTS idx_money_transactions_kind_date
                    ON money_transactions(kind, transaction_date);
                CREATE INDEX IF NOT EXISTS idx_notes_updated_at
                    ON notes(updated_at DESC, id DESC);
            `);

            await seedMoneyDefaults(db);

            if (platform === "web") {
                await sqliteConnection.saveToStore("index");
            }

            databaseInitialized = true;
        }

        return db;
    } catch (error) {
        console.error("Initialization of SQLite failed:", error);
        throw error;
    }
};
