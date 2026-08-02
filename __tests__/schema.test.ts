import {
  LATEST_SCHEMA_VERSION,
  getSchemaVersion,
  migrateDatabase,
} from "../src/db/schema";
import { DEFAULT_STUDENT_CATEGORIES, seedInitialData } from "../src/db/seed";
import type { SqlDatabase, SqlExecutor, SqlQueryResult, SqlValue } from "../src/db/sql";
import { TestSqliteDatabase } from "./support/testDatabase";

class FailingMigrationDatabase implements SqlDatabase {
  public constructor(private readonly delegate: SqlDatabase) {}

  public execute(
    query: string,
    parameters: readonly SqlValue[] = [],
  ): Promise<SqlQueryResult> {
    return this.delegate.execute(query, parameters);
  }

  public transaction(work: (transaction: SqlExecutor) => Promise<void>): Promise<void> {
    return this.delegate.transaction((transaction) =>
      work({
        execute: (query, parameters = []) => {
          if (query.startsWith("CREATE TABLE categories")) {
            return Promise.reject(new Error("Injected migration failure"));
          }

          return transaction.execute(query, parameters);
        },
      }),
    );
  }

  public close(): void {
    this.delegate.close();
  }
}

describe("database schema and seed", () => {
  let database: TestSqliteDatabase;

  beforeEach(() => {
    database = new TestSqliteDatabase();
  });

  afterEach(() => {
    database.close();
  });

  test("migrates a fresh database to the latest version with five domain tables", async () => {
    const migration = await migrateDatabase(database);
    const tables = await database.execute(
      `SELECT name FROM sqlite_schema
       WHERE type = 'table' AND name IN (?, ?, ?, ?, ?)
       ORDER BY name`,
      ["accounts", "budgets", "categories", "recurring_rules", "transactions"],
    );

    expect(migration).toEqual({
      previousVersion: 0,
      currentVersion: LATEST_SCHEMA_VERSION,
      appliedVersions: [1],
    });
    expect(tables.rows.map(({ name }) => name)).toEqual([
      "accounts",
      "budgets",
      "categories",
      "recurring_rules",
      "transactions",
    ]);
  });

  test("seeds Cash and the twelve student categories with the required type split", async () => {
    await migrateDatabase(database);
    const accounts = await database.execute("SELECT name, type FROM accounts ORDER BY id");
    const categoryCounts = await database.execute(
      "SELECT type, COUNT(*) AS count FROM categories GROUP BY type ORDER BY type",
    );

    expect(accounts.rows).toEqual([{ name: "Cash", type: "CASH" }]);
    expect(DEFAULT_STUDENT_CATEGORIES).toHaveLength(12);
    expect(categoryCounts.rows).toEqual([
      { type: "EXPENSE", count: 7 },
      { type: "INCOME", count: 5 },
    ]);
  });

  test("is idempotent for both migrations and an explicitly repeated seed", async () => {
    await migrateDatabase(database);
    const secondMigration = await migrateDatabase(database);

    await database.transaction(async (transaction) => {
      await seedInitialData(transaction);
      await seedInitialData(transaction);
    });

    const accounts = await database.execute("SELECT COUNT(*) AS count FROM accounts");
    const categories = await database.execute("SELECT COUNT(*) AS count FROM categories");

    expect(secondMigration.appliedVersions).toEqual([]);
    expect(accounts.rows[0]?.count).toBe(1);
    expect(categories.rows[0]?.count).toBe(12);
  });

  test("rejects a database created by a newer application version", async () => {
    await database.execute("PRAGMA user_version = 99");

    await expect(migrateDatabase(database)).rejects.toThrow("newer than supported");
    expect(await getSchemaVersion(database)).toBe(99);
  });

  test("rolls back the entire initial migration when a schema statement fails", async () => {
    const failingDatabase = new FailingMigrationDatabase(database);
    await expect(migrateDatabase(failingDatabase)).rejects.toThrow("Injected migration failure");

    const accounts = await database.execute(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'accounts'",
    );
    expect(accounts.rows).toEqual([]);
    expect(await getSchemaVersion(database)).toBe(0);
  });
});
