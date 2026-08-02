import { isSQLCipher, open } from "@op-engineering/op-sqlite";

import { loadDatabaseKey } from "./databaseKey";
import { migrateDatabase } from "./schema";
import { OpSqliteDatabase, type SqlDatabase } from "./sql";

const DATABASE_NAME = "moneymap.sqlite";

let databasePromise: Promise<SqlDatabase> | null = null;

async function createInitializedDatabase(): Promise<SqlDatabase> {
  if (!isSQLCipher()) {
    throw new Error("MoneyMap requires an OP-SQLite development build compiled with SQLCipher.");
  }

  const encryptionKey = await loadDatabaseKey();
  const database = new OpSqliteDatabase(
    open({
      name: DATABASE_NAME,
      encryptionKey,
    }),
  );

  try {
    await migrateDatabase(database);
    return database;
  } catch (error: unknown) {
    database.close();
    throw error;
  }
}

export async function initializeDatabase(): Promise<SqlDatabase> {
  if (databasePromise !== null) {
    return databasePromise;
  }

  const pendingDatabase = createInitializedDatabase();
  databasePromise = pendingDatabase;

  try {
    return await pendingDatabase;
  } catch (error: unknown) {
    if (databasePromise === pendingDatabase) {
      databasePromise = null;
    }

    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  const pendingDatabase = databasePromise;
  databasePromise = null;

  if (pendingDatabase === null) {
    return;
  }

  const database = await pendingDatabase;
  database.close();
}
