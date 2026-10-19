import { loadDatabaseKey } from "./databaseKey";
import { migrateDatabase } from "./schema";
import { OpSqliteDatabase } from "./sql";
import { isLocalResetPending } from "../services/localResetState";
const DATABASE_NAME = "moneymap.sqlite";
const SQLCIPHER_REQUIRED_MESSAGE = "MoneyMap requires an OP-SQLite development build compiled with SQLCipher.";
let databasePromise = null;
let databaseResetting = false;

function loadOpSqlite() {
    try {
        return require("@op-engineering/op-sqlite");
    } catch {
        throw new Error(SQLCIPHER_REQUIRED_MESSAGE);
    }
}

async function createInitializedDatabase() {
    const { isSQLCipher, open } = loadOpSqlite();
    if (typeof isSQLCipher !== "function" || !isSQLCipher()) {
        throw new Error(SQLCIPHER_REQUIRED_MESSAGE);
    }
    const encryptionKey = await loadDatabaseKey();
    const database = new OpSqliteDatabase(open({
        name: DATABASE_NAME,
        encryptionKey,
    }));
    try {
        await migrateDatabase(database);
        return database;
    }
    catch (error) {
        database.close();
        throw error;
    }
}
export async function initializeDatabase() {
    if (databaseResetting || await isLocalResetPending()) {
        throw new Error("MoneyMap local data reset is in progress.");
    }
    if (databasePromise !== null) {
        return databasePromise;
    }
    const pendingDatabase = createInitializedDatabase();
    databasePromise = pendingDatabase;
    try {
        return await pendingDatabase;
    }
    catch (error) {
        if (databasePromise === pendingDatabase) {
            databasePromise = null;
        }
        throw error;
    }
}
export async function closeDatabase() {
    const pendingDatabase = databasePromise;
    databasePromise = null;
    if (pendingDatabase === null) {
        return;
    }
    const database = await pendingDatabase;
    database.close();
}

export function beginDatabaseReset() {
    const acquired = !databaseResetting;
    databaseResetting = true;
    return acquired;
}

export function completeDatabaseReset() {
    databaseResetting = false;
}

export async function deleteFinanceDatabase({ keepResetGuard = false } = {}) {
    if (databaseResetting && !keepResetGuard) {
        throw new Error("MoneyMap local data reset is already in progress.");
    }
    databaseResetting = true;
    const pendingDatabase = databasePromise;
    databasePromise = null;
    try {
        let database = null;
        if (pendingDatabase !== null) {
            try {
                database = await pendingDatabase;
            }
            catch {
                database = null;
            }
        }
        if (database === null) {
            const { open } = loadOpSqlite();
            const encryptionKey = await loadDatabaseKey();
            database = new OpSqliteDatabase(open({
                name: DATABASE_NAME,
                encryptionKey,
            }));
        }
        try {
            await database.execute("PRAGMA wal_checkpoint(TRUNCATE)");
        }
        catch {
            // A corrupt or incomplete database still needs to be removable.
        }
        database.delete();
    }
    finally {
        if (!keepResetGuard) {
            databaseResetting = false;
        }
    }
}
