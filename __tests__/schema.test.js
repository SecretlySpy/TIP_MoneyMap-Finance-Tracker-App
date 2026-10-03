import { LATEST_SCHEMA_VERSION, getSchemaVersion, migrateDatabase, } from "../src/db/schema";
import { DEFAULT_STUDENT_CATEGORIES, seedInitialData } from "../src/db/seed";
import { TestSqliteDatabase } from "./support/testDatabase";
class FailingMigrationDatabase {
    constructor(delegate) {
        this.delegate = delegate;
    }
    execute(query, parameters = []) {
        return this.delegate.execute(query, parameters);
    }
    transaction(work) {
        return this.delegate.transaction((transaction) => work({
            execute: (query, parameters = []) => {
                if (query.startsWith("CREATE TABLE categories")) {
                    return Promise.reject(new Error("Injected migration failure"));
                }
                return transaction.execute(query, parameters);
            },
        }));
    }
    close() {
        this.delegate.close();
    }
}
describe("database schema and seed", () => {
    let database;
    beforeEach(() => {
        database = new TestSqliteDatabase();
    });
    afterEach(() => {
        database.close();
    });
    test("migrates a fresh database to the latest version with domain tables including goals", async () => {
        const migration = await migrateDatabase(database);
        const tables = await database.execute(`SELECT name FROM sqlite_schema
       WHERE type = 'table' AND name IN (?, ?, ?, ?, ?, ?)
       ORDER BY name`, ["accounts", "budgets", "categories", "recurring_rules", "savings_goals", "transactions"]);
        expect(migration).toEqual({
            previousVersion: 0,
            currentVersion: LATEST_SCHEMA_VERSION,
            appliedVersions: [1, 2, 3, 4, 5, 6, 7],
        });
        expect(tables.rows.map(({ name }) => name)).toEqual([
            "accounts",
            "budgets",
            "categories",
            "recurring_rules",
            "savings_goals",
            "transactions",
        ]);
    });
    test("seeds Cash and the twelve student categories with the required type split", async () => {
        await migrateDatabase(database);
        const accounts = await database.execute("SELECT name, type FROM accounts ORDER BY id");
        const categoryCounts = await database.execute("SELECT type, COUNT(*) AS count FROM categories GROUP BY type ORDER BY type");
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
    test("upgrades a version-four transaction table without changing existing rows", async () => {
        await database.execute(`CREATE TABLE transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount_minor INTEGER NOT NULL,
          type TEXT NOT NULL,
          category_id INTEGER NOT NULL,
          account_id INTEGER NOT NULL,
          date_epoch_millis INTEGER NOT NULL,
          note TEXT,
          recurring_rule_id INTEGER
        ) STRICT`);
        await database.execute(`INSERT INTO transactions (
          amount_minor, type, category_id, account_id, date_epoch_millis, note, recurring_rule_id
        ) VALUES (?, ?, ?, ?, ?, ?, NULL)`, [1250, "EXPENSE", 7, 3, 1785542400000, "Existing row"]);
        await database.execute("PRAGMA user_version = 4");
        const migration = await migrateDatabase(database);
        const rows = await database.execute("SELECT amount_minor, note, source_key FROM transactions");
        const recoveryTable = await database.execute("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'restore_recovery_snapshot'");
        const bootstrap = await database.execute("SELECT value FROM app_metadata WHERE key = ?", ["bootstrap-defaults-v1"]);
        expect(migration.appliedVersions).toEqual([5, 6, 7]);
        expect(rows.rows).toEqual([{ amount_minor: 1250, note: "Existing row", source_key: null }]);
        expect(recoveryTable.rows).toEqual([{ name: "restore_recovery_snapshot" }]);
        expect(bootstrap.rows).toEqual([{ value: "complete" }]);
    });
    test("rejects a database created by a newer application version", async () => {
        await database.execute("PRAGMA user_version = 99");
        await expect(migrateDatabase(database)).rejects.toThrow("newer than supported");
        expect(await getSchemaVersion(database)).toBe(99);
    });
    test("rolls back the entire initial migration when a schema statement fails", async () => {
        const failingDatabase = new FailingMigrationDatabase(database);
        await expect(migrateDatabase(failingDatabase)).rejects.toThrow("Injected migration failure");
        const accounts = await database.execute("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'accounts'");
        expect(accounts.rows).toEqual([]);
        expect(await getSchemaVersion(database)).toBe(0);
    });
});
