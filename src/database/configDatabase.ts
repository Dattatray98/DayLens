import {
    CapacitorSQLite,
    SQLiteConnection,
} from "@capacitor-community/sqlite";
import { Capacitor } from "@capacitor/core";

const sqliteConnection = new SQLiteConnection(CapacitorSQLite);

let databaseInitialized = false;

export const initDatabase = async () => {
    try {
        const platform = Capacitor.getPlatform();

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
