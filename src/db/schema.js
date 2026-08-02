import { seedInitialData } from "./seed";
import { DataIntegrityError, readInteger } from "./validation";
export const LATEST_SCHEMA_VERSION = 1;
const CREATE_SCHEMA_STATEMENTS = [
    `CREATE TABLE accounts (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL CHECK (length(trim(name)) > 0),
     type TEXT NOT NULL CHECK (type IN ('CASH', 'CARD', 'EWALLET')),
     starting_balance_minor INTEGER NOT NULL,
     is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1))
   ) STRICT`,
    `CREATE TABLE categories (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL CHECK (length(trim(name)) > 0),
     icon TEXT NOT NULL CHECK (length(trim(icon)) > 0),
     color_hex TEXT NOT NULL CHECK (
       length(color_hex) = 7 AND
       color_hex GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'
     ),
     type TEXT NOT NULL CHECK (type IN ('EXPENSE', 'INCOME')),
     is_custom INTEGER NOT NULL CHECK (is_custom IN (0, 1)),
     UNIQUE (id, type)
   ) STRICT`,
    `CREATE TABLE recurring_rules (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
     type TEXT NOT NULL CHECK (type IN ('EXPENSE', 'INCOME')),
     category_id INTEGER NOT NULL,
     account_id INTEGER NOT NULL,
     note TEXT,
     frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
     next_run_epoch_millis INTEGER NOT NULL,
     is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
     reminder_enabled INTEGER NOT NULL DEFAULT 0 CHECK (reminder_enabled IN (0, 1)),
     reminder_lead_days INTEGER NOT NULL DEFAULT 3 CHECK (reminder_lead_days >= 0),
     FOREIGN KEY (category_id, type) REFERENCES categories (id, type) ON UPDATE RESTRICT ON DELETE RESTRICT,
     FOREIGN KEY (account_id) REFERENCES accounts (id) ON UPDATE RESTRICT ON DELETE RESTRICT
   ) STRICT`,
    `CREATE TABLE transactions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
     type TEXT NOT NULL CHECK (type IN ('EXPENSE', 'INCOME')),
     category_id INTEGER NOT NULL,
     account_id INTEGER NOT NULL,
     date_epoch_millis INTEGER NOT NULL,
     note TEXT,
     recurring_rule_id INTEGER,
     FOREIGN KEY (category_id, type) REFERENCES categories (id, type) ON UPDATE RESTRICT ON DELETE RESTRICT,
     FOREIGN KEY (account_id) REFERENCES accounts (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
     FOREIGN KEY (recurring_rule_id) REFERENCES recurring_rules (id) ON UPDATE RESTRICT ON DELETE SET NULL
   ) STRICT`,
    `CREATE TABLE budgets (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     category_id INTEGER NOT NULL,
     month_year TEXT NOT NULL CHECK (
       length(month_year) = 7 AND
       month_year GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]' AND
       substr(month_year, 6, 2) BETWEEN '01' AND '12'
     ),
     limit_minor INTEGER NOT NULL CHECK (limit_minor > 0),
     FOREIGN KEY (category_id) REFERENCES categories (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
     UNIQUE (category_id, month_year)
   ) STRICT`,
    "CREATE INDEX idx_transactions_category_id ON transactions (category_id)",
    "CREATE INDEX idx_transactions_account_id ON transactions (account_id)",
    "CREATE INDEX idx_transactions_date_epoch_millis ON transactions (date_epoch_millis DESC)",
    "CREATE INDEX idx_transactions_recurring_rule_id ON transactions (recurring_rule_id)",
    "CREATE INDEX idx_recurring_rules_category_id ON recurring_rules (category_id)",
    "CREATE INDEX idx_recurring_rules_account_id ON recurring_rules (account_id)",
    "CREATE INDEX idx_recurring_rules_next_run ON recurring_rules (is_active, next_run_epoch_millis)",
    "CREATE INDEX idx_budgets_category_id ON budgets (category_id)",
];
const MIGRATIONS = [
    {
        version: 1,
        name: "create initial finance schema and seed defaults",
        async apply(database) {
            for (const statement of CREATE_SCHEMA_STATEMENTS) {
                await database.execute(statement);
            }
            await seedInitialData(database);
        },
    },
];
async function configureDatabase(database) {
    await database.execute("PRAGMA foreign_keys = ON");
    await database.execute("PRAGMA busy_timeout = 5000");
    await database.execute("PRAGMA journal_mode = WAL");
    await database.execute("PRAGMA synchronous = FULL");
    await database.execute("PRAGMA trusted_schema = OFF");
}
export async function getSchemaVersion(database) {
    const result = await database.execute("PRAGMA user_version");
    const firstRow = result.rows[0];
    if (firstRow === undefined) {
        throw new DataIntegrityError("SQLite did not return PRAGMA user_version.");
    }
    return readInteger(firstRow, "user_version");
}
export async function migrateDatabase(database) {
    await configureDatabase(database);
    const previousVersion = await getSchemaVersion(database);
    if (previousVersion > LATEST_SCHEMA_VERSION) {
        throw new Error(`Database schema version ${previousVersion} is newer than supported version ${LATEST_SCHEMA_VERSION}.`);
    }
    const pendingMigrations = MIGRATIONS.filter((migration) => migration.version > previousVersion);
    const appliedVersions = [];
    for (const migration of pendingMigrations) {
        await database.transaction(async (transaction) => {
            await migration.apply(transaction);
            await transaction.execute(`PRAGMA user_version = ${migration.version}`);
        });
        appliedVersions.push(migration.version);
    }
    const foreignKeyViolations = await database.execute("PRAGMA foreign_key_check");
    if (foreignKeyViolations.rows.length > 0) {
        throw new DataIntegrityError("The database contains foreign-key violations.");
    }
    return {
        previousVersion,
        currentVersion: await getSchemaVersion(database),
        appliedVersions,
    };
}
