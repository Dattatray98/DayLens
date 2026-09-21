import { open, Database } from "sqlite"
import sqlite3 from "sqlite3"



let db: Database | null = null;


export const DatabaseInit = async (): Promise<Database> => {
    if (db) return db;

    db = await open({
        filename: "data/index.db",
        driver: sqlite3.Database
    });

    console.log("data base is connected successs fully!")

    return db
}