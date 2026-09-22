import {
    CapacitorSQLite,
    SQLiteConnection,
    type SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import { Capacitor } from "@capacitor/core";

const sqliteConnection = new SQLiteConnection(CapacitorSQLite);

let databaseInitialized = false;

let nodeDbInstance: any = null;

export const initDatabase = async (): Promise<SQLiteDBConnection> => {
    try {
        const platform = Capacitor.getPlatform();

        if (platform === "web" && typeof document === "undefined") {
            if (!nodeDbInstance) {
                const sqliteMod = (globalThis as any).process?.getBuiltinModule?.("node:sqlite");
                if (!sqliteMod) {
                    throw new Error("node:sqlite not available in this environment");
                }
                const { DatabaseSync } = sqliteMod;
                const syncDb = new DatabaseSync(":memory:");
                nodeDbInstance = {
                    execute: async (sql: string) => {
                        syncDb.exec(sql);
                        return { changes: { changes: 1 } };
                    },
                    query: async (sql: string, params: any[] = []): Promise<{ values?: Record<string, unknown>[] }> => {
                        const stmt = syncDb.prepare(sql);
                        const values = stmt.all(...params) as Record<string, unknown>[];
                        return { values };
                    },
                    run: async (sql: string, params: any[] = []) => {
                        const stmt = syncDb.prepare(sql);
                        const info = stmt.run(...params);
                        return {
                            changes: {
                                changes: Number(info.changes),
                                lastId: Number(info.lastInsertRowid),
                            },
                        };
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

                    CREATE INDEX IF NOT EXISTS idx_food_logs_timestamp
                        ON food_logs(timestamp);

                    CREATE INDEX IF NOT EXISTS idx_metric_logs_metric_timestamp
                        ON metric_logs(metric_id, timestamp);
                `);
            }
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

                CREATE INDEX IF NOT EXISTS idx_food_logs_timestamp
                    ON food_logs(timestamp);

                CREATE INDEX IF NOT EXISTS idx_metric_logs_metric_timestamp
                    ON metric_logs(metric_id, timestamp);
            `);

            databaseInitialized = true;
        }

        if (platform === "web") {
            await sqliteConnection.saveToStore("index");
        }

        return db;
    } catch (error) {
        console.error("Initialization of SQLite failed:", error);
        throw error;
    }
};
