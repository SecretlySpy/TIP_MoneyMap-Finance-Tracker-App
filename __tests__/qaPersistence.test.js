import { AccountRepository, CategoryRepository, GoalRepository, RecurringRepository, TransactionRepository } from "../src/db/repositories";
import { migrateDatabase } from "../src/db/schema";
import { OpSqliteDatabase } from "../src/db/sql";
import { runRecurringCatchUp } from "../src/services/recurringCatchUp";
import { TestSqliteDatabase } from "./support/testDatabase";

describe("QA persistence and concurrent-operation contracts", () => {
  let native;
  let database;
  let account;
  let category;
  beforeEach(async () => {
    native = new TestSqliteDatabase();
    // Execute production adapter/repository SQL against SQLite, without SQLCipher.
    database = new OpSqliteDatabase(native);
    await migrateDatabase(database);
    account = (await new AccountRepository(database).list())[0];
    category = (await new CategoryRepository(database).list()).find((row) => row.type === "EXPENSE");
  });
  afterEach(() => { jest.restoreAllMocks(); database.close(); });

  const transactionInput = (accountId, categoryId) => ({
    amountMinor: 100, type: "EXPENSE", categoryId, accountId,
    dateEpochMillis: new Date(2026, 8, 1, 12).getTime(), note: null, recurringRuleId: null,
  });

  it("composes repository CRUD inside one native transaction and rolls it all back", async () => {
    await expect(database.transaction(async (tx) => {
      const created = await new AccountRepository(tx).create({ name: "Atomic", type: "CASH", startingBalanceMinor: 0, isArchived: false });
      await new AccountRepository(tx).update(created.id, { name: "Atomic updated" });
      await new TransactionRepository(tx).create(transactionInput(created.id, category.id));
      throw new Error("injected rollback");
    })).rejects.toThrow("injected rollback");
    expect((await new AccountRepository(database).list()).some((row) => row.name.startsWith("Atomic"))).toBe(false);
    expect(await new TransactionRepository(database).list()).toHaveLength(0);
  });

  it("retains all 32 simultaneous goal contributions", async () => {
    const goals = new GoalRepository(database);
    const goal = await goals.create({ name: "Concurrent savings", targetMinor: 100_000 });
    await Promise.all(Array.from({ length: 32 }, () => goals.contribute(goal.id, 100)));
    expect((await goals.getById(goal.id)).currentMinor).toBe(3_200);
  });

  it("rejects unsafe contribution totals without changing stored savings", async () => {
    const goals = new GoalRepository(database);
    const goal = await goals.create({ name: "Overflow", targetMinor: Number.MAX_SAFE_INTEGER, currentMinor: Number.MAX_SAFE_INTEGER - 50 });
    await expect(goals.contribute(goal.id, 100)).rejects.toThrow();
    expect((await goals.getById(goal.id)).currentMinor).toBe(Number.MAX_SAFE_INTEGER - 50);
    await expect(goals.contribute(999_999, 100)).rejects.toThrow("Goal not found");
  });

  it("posts each scheduled run once when 32 catch-up callers race", async () => {
    const due = new Date(2026, 8, 1, 12).getTime();
    const rule = await new RecurringRepository(database).create({
      amountMinor: 100, type: "EXPENSE", categoryId: category.id, accountId: account.id,
      note: null, frequency: "MONTHLY", nextRunEpochMillis: due, isActive: true,
      reminderEnabled: false, reminderLeadDays: 14, icon: null, anchorDay: 1,
    });
    const summaries = await Promise.all(Array.from({ length: 32 }, () => runRecurringCatchUp(database, { nowEpochMillis: due })));
    expect(await new TransactionRepository(database).list()).toHaveLength(1);
    expect(summaries.reduce((sum, value) => sum + value.transactionsCreated, 0)).toBe(1);
    expect((await new RecurringRepository(database).getById(rule.id)).nextRunEpochMillis).toBeGreaterThan(due);
  });

  it("rolls back recurring posts if advancing the schedule fails", async () => {
    const due = new Date(2026, 8, 1, 12).getTime();
    const rule = await new RecurringRepository(database).create({
      amountMinor: 100, type: "EXPENSE", categoryId: category.id, accountId: account.id,
      note: null, frequency: "MONTHLY", nextRunEpochMillis: due, isActive: true,
      reminderEnabled: false, reminderLeadDays: 14, icon: null, anchorDay: 1,
    });
    // Isolate fault injection to this transaction, without mutating the reusable driver.
    const failingDatabase = {
      transaction: (work) => database.transaction((tx) => work({
        execute: async (sql, params) => {
          if (/^UPDATE recurring_rules/.test(sql)) throw new Error("injected schedule failure");
          return tx.execute(sql, params);
        },
      })),
    };
    await expect(runRecurringCatchUp(failingDatabase, { nowEpochMillis: due })).rejects.toThrow("injected schedule failure");
    expect(await new TransactionRepository(database).list()).toHaveLength(0);
    expect((await new RecurringRepository(database).getById(rule.id)).nextRunEpochMillis).toBe(due);
  });

  it("restricts account deletion and preserves category/type consistency", async () => {
    expect((await database.execute("PRAGMA foreign_keys")).rows[0].foreign_keys).toBe(1);
    const transactions = new TransactionRepository(database);
    const incomeCategory = (await new CategoryRepository(database).list()).find((row) => row.type === "INCOME");
    const row = await transactions.create(transactionInput(account.id, category.id));
    expect((await database.execute("PRAGMA foreign_keys")).rows[0].foreign_keys).toBe(1);
    expect((await database.execute("PRAGMA foreign_key_list(transactions)")).rows).toHaveLength(4);
    expect((await database.execute("SELECT account_id FROM transactions")).rows).toEqual([{ account_id: account.id }]);
    expect((await database.execute("SELECT id FROM accounts WHERE id = ?", [account.id])).rows).toEqual([{ id: account.id }]);
    // Native SQLite errors may belong to another Jest VM; assert their stable error code.
    const foreignKeyConstraint = { code: expect.stringMatching(/^SQLITE_CONSTRAINT_(FOREIGNKEY|TRIGGER)$/) };
    await expect(new AccountRepository(database).delete(account.id)).rejects.toMatchObject(foreignKeyConstraint);
    await expect(transactions.update(row.id, { categoryId: incomeCategory.id })).rejects.toMatchObject(foreignKeyConstraint);
    expect((await transactions.getById(row.id)).categoryId).toBe(category.id);
    expect((await database.execute("PRAGMA foreign_key_check")).rows).toEqual([]);
  });

  it("upgrades a real version-2 schema and is repeatable", async () => {
    await database.execute("ALTER TABLE recurring_rules DROP COLUMN icon");
    await database.execute("ALTER TABLE recurring_rules DROP COLUMN anchor_day");
    await database.execute("PRAGMA user_version = 2");
    expect((await migrateDatabase(database)).appliedVersions).toEqual([3, 4, 5, 6, 7]);
    const columns = (await database.execute("PRAGMA table_info(recurring_rules)")).rows.map((row) => row.name);
    expect(columns).toEqual(expect.arrayContaining(["icon", "anchor_day"]));
    expect((await migrateDatabase(database)).appliedVersions).toEqual([]);
  });

  it("refuses a newer database without rewriting its version", async () => {
    await database.execute("PRAGMA user_version = 999");
    await expect(migrateDatabase(database)).rejects.toThrow("newer than supported");
    expect((await database.execute("PRAGMA user_version")).rows[0].user_version).toBe(999);
  });
});
