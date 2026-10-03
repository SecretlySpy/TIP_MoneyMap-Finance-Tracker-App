import { seedInitialData } from "./seed";
import { DataIntegrityError, readInteger } from "./validation";
export const LATEST_SCHEMA_VERSION = 7;
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
      reminder_lead_days INTEGER NOT NULL DEFAULT 14 CHECK (reminder_lead_days >= 0),
      icon TEXT,
      anchor_day INTEGER CHECK (anchor_day IS NULL OR (anchor_day >= 1 AND anchor_day <= 31)),
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
     scheduled_date_epoch_millis INTEGER,
     source_key TEXT CHECK (
       source_key IS NULL OR (
         length(trim(source_key)) > 0 AND length(source_key) <= 256
       )
     ),
     FOREIGN KEY (category_id, type) REFERENCES categories (id, type) ON UPDATE RESTRICT ON DELETE RESTRICT,
     FOREIGN KEY (account_id) REFERENCES accounts (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
     FOREIGN KEY (recurring_rule_id) REFERENCES recurring_rules (id) ON UPDATE RESTRICT ON DELETE SET NULL
   ) STRICT`,
    `CREATE TABLE restore_recovery_snapshot (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     backup_json TEXT NOT NULL CHECK (length(backup_json) > 0),
     created_epoch_millis INTEGER NOT NULL
   ) STRICT`,
    `CREATE TABLE app_metadata (
     key TEXT PRIMARY KEY CHECK (length(trim(key)) > 0),
     value TEXT NOT NULL
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
    "CREATE UNIQUE INDEX idx_transactions_source_key ON transactions (source_key)",
    "CREATE INDEX idx_recurring_rules_category_id ON recurring_rules (category_id)",
    "CREATE INDEX idx_recurring_rules_account_id ON recurring_rules (account_id)",
    "CREATE INDEX idx_recurring_rules_next_run ON recurring_rules (is_active, next_run_epoch_millis)",
    "CREATE INDEX idx_budgets_category_id ON budgets (category_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_recurring_scheduled ON transactions (recurring_rule_id, scheduled_date_epoch_millis) WHERE recurring_rule_id IS NOT NULL AND scheduled_date_epoch_millis IS NOT NULL",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_type_name_nocase ON categories (type, name COLLATE NOCASE)",
];
const CREATE_GOALS_STATEMENTS = [
    `CREATE TABLE savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      target_minor INTEGER NOT NULL CHECK (target_minor > 0),
      current_minor INTEGER NOT NULL DEFAULT 0 CHECK (current_minor >= 0),
      deadline_epoch_millis INTEGER,
      is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
      created_epoch_millis INTEGER NOT NULL
    ) STRICT`,
    "CREATE INDEX idx_savings_goals_active ON savings_goals (is_archived, deadline_epoch_millis)",
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
    {
        version: 2,
        name: "add savings goals table",
        async apply(database) {
            for (const statement of CREATE_GOALS_STATEMENTS) {
                await database.execute(statement);
            }
        },
    },
    {
        version: 3,
        name: "add recurring_rules.icon for custom bill emoji",
        async apply(database) {
            // Fresh v1 CREATE already includes icon; ALTER only when upgrading older DBs.
            const cols = await database.execute("PRAGMA table_info(recurring_rules)");
            const hasIcon = (cols.rows ?? []).some((row) => row.name === "icon");
            if (!hasIcon) {
                await database.execute("ALTER TABLE recurring_rules ADD COLUMN icon TEXT");
            }
        },
    },
    {
        version: 4,
        name: "add recurring_rules.anchor_day so monthly bills keep their due day",
        async apply(database) {
            // Fresh v1 CREATE already includes anchor_day; ALTER only when upgrading.
            const cols = await database.execute("PRAGMA table_info(recurring_rules)");
            const hasAnchorDay = (cols.rows ?? []).some((row) => row.name === "anchor_day");
            if (!hasAnchorDay) {
                await database.execute("ALTER TABLE recurring_rules ADD COLUMN anchor_day INTEGER");
            }
            // Left NULL on purpose: next_run is stored at local noon, so deriving the day
            // in SQLite (UTC) would be wrong near the date line. The catch-up service
            // adopts the current run's day and persists it on first use instead.
        },
    },
    {
        version: 5,
        name: "add transaction source keys for retry-safe financial mutations",
        async apply(database) {
            const columns = await database.execute("PRAGMA table_info(transactions)");
            const hasSourceKey = (columns.rows ?? []).some((row) => row.name === "source_key");
            if (!hasSourceKey) {
                await database.execute(`ALTER TABLE transactions ADD COLUMN source_key TEXT CHECK (
                  source_key IS NULL OR (
                    length(trim(source_key)) > 0 AND length(source_key) <= 256
                  )
                )`);
            }
            // SQLite permits multiple NULL values while enforcing uniqueness for real keys.
            await database.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_source_key ON transactions (source_key)");
        },
    },
    {
        version: 6,
        name: "add encrypted restore recovery and one-time bootstrap metadata",
        async apply(database, previousVersion) {
            // Stored inside the SQLCipher database: one bounded snapshot supports undo without
            // copying sensitive financial JSON to plaintext application storage.
            await database.execute(`CREATE TABLE IF NOT EXISTS restore_recovery_snapshot (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              backup_json TEXT NOT NULL CHECK (length(backup_json) > 0),
              created_epoch_millis INTEGER NOT NULL
            ) STRICT`);
            await database.execute(`CREATE TABLE IF NOT EXISTS app_metadata (
              key TEXT PRIMARY KEY CHECK (length(trim(key)) > 0),
              value TEXT NOT NULL
            ) STRICT`);
            if (previousVersion > 0) {
                // Upgrades have already had a chance to archive accounts or remove defaults.
                await database.execute("INSERT OR IGNORE INTO app_metadata (key, value) VALUES (?, ?)", ["bootstrap-defaults-v1", "complete"]);
            }
        },
    },
    {
        version: 7,
        name: "preserve recurring occurrence scheduled dates after template deletion",
        async apply(database) {
            const columns = await database.execute("PRAGMA table_info(transactions)");
            const hasScheduledDate = (columns.rows ?? []).some((row) => row.name === "scheduled_date_epoch_millis");
            if (!hasScheduledDate) {
                await database.execute("ALTER TABLE transactions ADD COLUMN scheduled_date_epoch_millis INTEGER");
            }
            await database.execute(`UPDATE transactions
              SET scheduled_date_epoch_millis = date_epoch_millis
              WHERE recurring_rule_id IS NOT NULL AND scheduled_date_epoch_millis IS NULL`);
            await database.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_recurring_scheduled ON transactions (recurring_rule_id, scheduled_date_epoch_millis) WHERE recurring_rule_id IS NOT NULL AND scheduled_date_epoch_millis IS NOT NULL");
        },
    },
];
async function configureDatabase(database) {
    await database.execute("PRAGMA foreign_keys = ON");
    await database.execute("PRAGMA busy_timeout = 5000");
    await database.execute("PRAGMA journal_mode = WAL");
    await database.execute("PRAGMA synchronous = FULL");
    await database.execute("PRAGMA trusted_schema = OFF");
    const tables = await database.execute("SELECT name FROM sqlite_schema WHERE type='table'");
    const tableNames = new Set((tables.rows ?? []).map((r) => r.name));
    if (tableNames.has("transactions")) {
        const columns = await database.execute("PRAGMA table_info(transactions)");
        const hasScheduled = (columns.rows ?? []).some((r) => r.name === "scheduled_date_epoch_millis");
        if (hasScheduled) {
            await database.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_recurring_scheduled ON transactions (recurring_rule_id, scheduled_date_epoch_millis) WHERE recurring_rule_id IS NOT NULL AND scheduled_date_epoch_millis IS NOT NULL");
        }
    }
    if (tableNames.has("categories")) {
        await database.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_type_name_nocase ON categories (type, name COLLATE NOCASE)");
    }
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
            await migration.apply(transaction, previousVersion);
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
