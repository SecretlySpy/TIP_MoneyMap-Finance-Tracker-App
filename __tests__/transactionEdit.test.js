import {
  AccountRepository,
  CategoryRepository,
  RecurringRepository,
  TransactionRepository,
} from "../src/db/repositories";
import { migrateDatabase } from "../src/db/schema";
import { OpSqliteDatabase } from "../src/db/sql";
import { groupHistory, transactionInMonth } from "../src/domain/services/financeView";
import { mapsFromState, useFinanceStore } from "../src/store/financeStore";
import { initializeDatabase } from "../src/db/client";
import { TestSqliteDatabase } from "./support/testDatabase";

jest.mock("../src/db/client", () => ({ initializeDatabase: jest.fn() }));
jest.mock("../src/store/uiStore", () => ({
  registerFinanceSnapshotProvider: jest.fn(),
  syncRemindersFromStores: jest.fn(async () => {}),
  useUiStore: (selector) => selector({ themePreference: "light", currencySymbol: "₱" }),
}));

describe("transaction editing and recurring guards", () => {
  let native;
  let database;
  let repos;

  beforeEach(async () => {
    native = new TestSqliteDatabase();
    database = new OpSqliteDatabase(native);
    await migrateDatabase(database);
    initializeDatabase.mockResolvedValue(database);

    useFinanceStore.setState({ status: "idle" });
    await useFinanceStore.getState().ensureHydrated();

    repos = {
      accounts: new AccountRepository(database),
      categories: new CategoryRepository(database),
      recurring: new RecurringRepository(database),
      transactions: new TransactionRepository(database),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    database.close();
  });

  it("updates manual transaction date across months and reflects in history grouping", async () => {
    const store = useFinanceStore.getState();
    const augDate = new Date(2026, 7, 15, 12, 0, 0).getTime();
    const sepDate = new Date(2026, 8, 10, 12, 0, 0).getTime();

    const created = await repos.transactions.create({
      amountMinor: 5_000,
      type: "EXPENSE",
      categoryId: 1, // Food
      accountId: 1,  // Cash
      dateEpochMillis: augDate,
      note: "Lunch campus",
      recurringRuleId: null,
    });
    await store.refresh();

    // Verify initially in August
    expect(transactionInMonth(created, "2026-08")).toBe(true);
    expect(transactionInMonth(created, "2026-09")).toBe(false);

    // Update to September date with new amount
    const updated = await store.updateTransaction(created.id, {
      amountMinor: 7_500,
      dateEpochMillis: sepDate,
      note: "Lunch upgraded",
    });

    expect(updated.amountMinor).toBe(7_500);
    expect(updated.dateEpochMillis).toBe(sepDate);
    expect(updated.note).toBe("Lunch upgraded");
    expect(transactionInMonth(updated, "2026-08")).toBe(false);
    expect(transactionInMonth(updated, "2026-09")).toBe(true);

    // Verify history grouping in September includes the updated transaction
    const { accountsById, categoriesById } = mapsFromState({
      accounts: store.accounts,
      categories: store.categories,
    });
    const groups = groupHistory([updated], categoriesById, accountsById, "2026-09");
    expect(groups.length).toBe(1);
    expect(groups[0].transactions[0]).toMatchObject({
      id: String(created.id),
      amountMinor: 7_500,
      title: "Lunch upgraded",
    });
  });

  it("guards recurring transaction: prevents date modification while allowing other edits", async () => {
    const store = useFinanceStore.getState();
    const scheduledDate = new Date(2026, 8, 1, 12, 0, 0).getTime();
    const originalNextRun = new Date(2026, 9, 1, 12, 0, 0).getTime();

    // Create a recurring rule
    const rule = await repos.recurring.create({
      amountMinor: 100_000,
      type: "EXPENSE",
      categoryId: 1,
      accountId: 1,
      note: "Wifi Monthly",
      frequency: "MONTHLY",
      nextRunEpochMillis: originalNextRun,
      isActive: true,
      reminderEnabled: true,
      reminderLeadDays: 2,
      icon: "wifi",
      anchorDay: 1,
    });

    // Create a generated occurrence linked to that rule
    const occurrence = await repos.transactions.create({
      amountMinor: 100_000,
      type: "EXPENSE",
      categoryId: 1,
      accountId: 1,
      dateEpochMillis: scheduledDate,
      note: "Wifi Monthly",
      recurringRuleId: rule.id,
    });
    await store.refresh();

    // Attempting to change the date of this occurrence MUST throw and fail
    const differentDate = new Date(2026, 8, 15, 12, 0, 0).getTime();
    await expect(
      store.updateTransaction(occurrence.id, {
        dateEpochMillis: differentDate,
      }),
    ).rejects.toThrow("Cannot change the scheduled date of a recurring transaction occurrence.");

    // Verify date was NOT changed in DB
    const persisted = await repos.transactions.getById(occurrence.id);
    expect(persisted.dateEpochMillis).toBe(scheduledDate);

    // Editing other fields (e.g. amount or note) succeeds
    const edited = await store.updateTransaction(occurrence.id, {
      amountMinor: 120_000,
      note: "Wifi Monthly + Addon",
    });
    expect(edited.amountMinor).toBe(120_000);
    expect(edited.note).toBe("Wifi Monthly + Addon");
    expect(edited.dateEpochMillis).toBe(scheduledDate);

    // Verify recurring rule's schedule and properties were NOT affected
    const ruleInDb = await repos.recurring.getById(rule.id);
    expect(ruleInDb.nextRunEpochMillis).toBe(originalNextRun);
    expect(ruleInDb.amountMinor).toBe(100_000);
  });

  it("deleting a recurring transaction occurrence leaves the recurring rule schedule untouched", async () => {
    const store = useFinanceStore.getState();
    const scheduledDate = new Date(2026, 8, 1, 12, 0, 0).getTime();
    const nextRun = new Date(2026, 9, 1, 12, 0, 0).getTime();

    const rule = await repos.recurring.create({
      amountMinor: 50_000,
      type: "EXPENSE",
      categoryId: 1,
      accountId: 1,
      note: "Gym",
      frequency: "MONTHLY",
      nextRunEpochMillis: nextRun,
      isActive: true,
      reminderEnabled: true,
      reminderLeadDays: 2,
      icon: "fitness",
      anchorDay: 1,
    });

    const occurrence = await repos.transactions.create({
      amountMinor: 50_000,
      type: "EXPENSE",
      categoryId: 1,
      accountId: 1,
      dateEpochMillis: scheduledDate,
      note: "Gym",
      recurringRuleId: rule.id,
    });
    await store.refresh();

    // Delete occurrence
    await store.deleteTransactionById(occurrence.id);

    // Occurrence is gone
    expect(await repos.transactions.getById(occurrence.id)).toBeNull();

    // Recurring rule remains intact with identical schedule
    const ruleAfterDelete = await repos.recurring.getById(rule.id);
    expect(ruleAfterDelete).not.toBeNull();
    expect(ruleAfterDelete.nextRunEpochMillis).toBe(nextRun);
  });

  it("enforces category and type match on update", async () => {
    const store = useFinanceStore.getState();
    const created = await repos.transactions.create({
      amountMinor: 20_000,
      type: "EXPENSE",
      categoryId: 1, // Food (EXPENSE)
      accountId: 1,
      dateEpochMillis: Date.now(),
      note: "Snack",
      recurringRuleId: null,
    });
    await store.refresh();

    const incomeCat = store.categories.find((c) => c.type === "INCOME");
    expect(incomeCat).toBeDefined();

    // Updating category to an INCOME category while transaction is EXPENSE rejects with constraint error
    await expect(
      store.updateTransaction(created.id, {
        categoryId: incomeCat.id,
      }),
    ).rejects.toThrow();

    // DB remains unchanged
    const after = await repos.transactions.getById(created.id);
    expect(after.categoryId).toBe(1);
  });

  it("rolls back atomic update and preserves existing transaction on failure", async () => {
    const store = useFinanceStore.getState();
    const created = await repos.transactions.create({
      amountMinor: 10_000,
      type: "EXPENSE",
      categoryId: 1,
      accountId: 1,
      dateEpochMillis: Date.now(),
      note: "Initial note",
      recurringRuleId: null,
    });
    await store.refresh();

    // Simulate database failure during update
    const origExecute = database.execute.bind(database);
    jest.spyOn(database, "execute").mockImplementation(async (sql, params) => {
      if (/^UPDATE transactions/.test(sql)) {
        throw new Error("simulated disk write failure");
      }
      return origExecute(sql, params);
    });

    await expect(
      store.updateTransaction(created.id, {
        amountMinor: 99_999,
        note: "Corrupted note",
      }),
    ).rejects.toThrow("simulated disk write failure");

    // Existing transaction must be completely intact
    const current = await repos.transactions.getById(created.id);
    expect(current.amountMinor).toBe(10_000);
    expect(current.note).toBe("Initial note");
  });

  it("throws for missing transaction id", async () => {
    const store = useFinanceStore.getState();
    await expect(
      store.updateTransaction(999999, { note: "non-existent" }),
    ).rejects.toThrow("Transaction not found.");
  });
});
