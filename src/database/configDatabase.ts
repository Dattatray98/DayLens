import {CapacitorSQLite, SQLiteConnection} from "@capacitor-community/sqlite";
import { Capacitor } from "@capacitor/core";

const sqliteConnection = new SQLiteConnection(CapacitorSQLite);


export const initDatabase = async ()=> {
    try{
        const platform = Capacitor.getPlatform();

        if (platform == "web"){

            const jeepSqliteEl = document.querySelector('jeep-sqlite');

            if(!jeepSqliteEl){
                const el = document.createElement("jeep-sqlite");
                document.body.appendChild(el)
            }

            await customElements.whenDefined("jeep-sqlite");
            await sqliteConnection.initWebStore();
        }


        const db = sqliteConnection.createConnection(
            "index",
            false,
            "no-encryption",
            1,
            false
        );

        if(platform == "web"){
            await sqliteConnection.saveToStore("index");
        }

        return db;
    }catch(e){
        console.error("Initialization of SQLite failed");
        throw e;
    }
};