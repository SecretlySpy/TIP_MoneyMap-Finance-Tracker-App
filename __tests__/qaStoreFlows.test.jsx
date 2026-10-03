jest.mock("../src/db/client", () => ({ initializeDatabase: jest.fn() }));
jest.mock("../src/store/uiStore", () => ({
  registerFinanceSnapshotProvider: jest.fn(), syncRemindersFromStores: jest.fn(async () => {}),
  useUiStore: (selector) => selector({ themePreference: "light", currencySymbol: "₱" }),
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
import { Alert } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { initializeDatabase } from "../src/db/client";
import { migrateDatabase } from "../src/db/schema";
import { OpSqliteDatabase } from "../src/db/sql";
import { AccountRepository, GoalRepository, TransactionRepository } from "../src/db/repositories";
import { buildBackup, parseBackup, serializeBackup } from "../src/services/dataTransfer";
import { EntryScreen } from "../src/screens/EntryScreen";
import { useFinanceStore } from "../src/store/financeStore";
import { importAccountKey } from "../src/domain/services/importParser";
import { ONBOARDING_FIRST_TRANSACTION_SOURCE_KEY } from "../src/services/onboarding";
import { TestSqliteDatabase } from "./support/testDatabase";

describe("QA screen/store/repository flows on real SQLite", () => {
  let database;
  let native;
  let navigate;
  let navigation;
  beforeEach(async () => {
    native = new TestSqliteDatabase();
    database = new OpSqliteDatabase(native);
    await migrateDatabase(database);
    initializeDatabase.mockResolvedValue(database);
    useFinanceStore.setState({ status: "idle" });
    await useFinanceStore.getState().ensureHydrated();
    navigate = jest.fn();
    navigation = { getParent: () => ({ navigate }), goBack: jest.fn() };
  });
  afterEach(() => { jest.restoreAllMocks(); database.close(); });

  it("saves the Lunch template from the entry screen to SQLite and opens History", async () => {
    const screen = await render(<EntryScreen navigation={navigation} />);
    expect(screen.getByRole("button", { name: "Save Transaction" }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: "Lunch ₱80" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save Transaction" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("History", { screen: "HistoryList" }));
    expect(await new TransactionRepository(database).list()).toEqual([expect.objectContaining({ amountMinor: 8_000, note: "Lunch", type: "EXPENSE" })]);
  });

  it("retires a completed entry key before the mounted form is used again", async () => {
    const screen = await render(<EntryScreen navigation={navigation} />);
    await fireEvent.press(screen.getByRole("button", { name: "Lunch ₱80" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save Transaction" }));
    await waitFor(() => expect(new TransactionRepository(database).list()).resolves.toHaveLength(1));

    await fireEvent.press(screen.getByRole("button", { name: "Save Transaction" }));
    await waitFor(() => expect(new TransactionRepository(database).list()).resolves.toHaveLength(2));
  });

  it("updates the existing first-run expense when the user goes back and corrects it", async () => {
    const accountId = useFinanceStore.getState().accounts[0].id;
    const input = { accountId, amountMinor: 10_000, categoryName: "Food", note: "Lunch" };
    await useFinanceStore.getState().saveOnboardingExpense(input);
    await useFinanceStore.getState().saveOnboardingExpense({ ...input, amountMinor: 15_000 });

    const rows = await new TransactionRepository(database).list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amountMinor: 15_000, sourceKey: ONBOARDING_FIRST_TRANSACTION_SOURCE_KEY });
  });

  it("reconciles a committed first-run expense after refresh fails and the amount changes", async () => {
    const accountId = useFinanceStore.getState().accounts[0].id;
    const input = { accountId, amountMinor: 10_000, categoryName: "Food", note: null };
    const realRefresh = useFinanceStore.getState().refresh;
    useFinanceStore.setState({ refresh: jest.fn(async () => { throw new Error("synthetic refresh failure"); }) });
    await expect(useFinanceStore.getState().saveOnboardingExpense(input)).rejects.toThrow(/synthetic refresh failure/);
    useFinanceStore.setState({ refresh: realRefresh });

    await useFinanceStore.getState().saveOnboardingExpense({ ...input, amountMinor: 15_000 });
    expect(await new TransactionRepository(database).list()).toEqual([
      expect.objectContaining({ amountMinor: 15_000, sourceKey: ONBOARDING_FIRST_TRANSACTION_SOURCE_KEY }),
    ]);
  });

  it("backdates a new transaction and opens History on the selected month", async () => {
    const screen = await render(<EntryScreen navigation={navigation} />);
    await fireEvent.press(screen.getByRole("button", { name: /^Transaction date / }));
    await fireEvent.press(screen.getByRole("button", { name: /^Choose month and year/ }));
    await fireEvent.changeText(screen.getByLabelText("Calendar year"), "2025");
    await fireEvent.press(screen.getByRole("button", { name: "Jan" }));
    await fireEvent.press(screen.getByRole("button", { name: "January 15, 2025" }));
    await fireEvent.press(screen.getByRole("button", { name: "Use Jan 15, 2025" }));
    await fireEvent.press(screen.getByRole("button", { name: "Lunch ₱80" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save Transaction" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("History", { screen: "HistoryList" }));
    const [created] = await new TransactionRepository(database).list();
    expect(created.dateEpochMillis).toBe(new Date(2025, 0, 15, 12, 0, 0, 0).getTime());
    expect(useFinanceStore.getState().selectedMonthYear).toBe("2025-01");
  });

  it("keeps the entry screen and data intact after a persistence failure", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    // The production adapter binds its executor at construction; inject at its public boundary.
    const execute = database.execute.bind(database);
    jest.spyOn(database, "execute").mockImplementation(async (sql, params) => {
      if (/^INSERT INTO transactions/.test(sql)) throw new Error("synthetic disk failure");
      return execute(sql, params);
    });
    const screen = await render(<EntryScreen navigation={navigation} />);
    await fireEvent.press(screen.getByRole("button", { name: "Lunch ₱80" }));
    await fireEvent.press(screen.getByRole("button", { name: "Save Transaction" }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("Save failed", "synthetic disk failure"));
    expect(navigate).not.toHaveBeenCalled();
    expect(await new TransactionRepository(database).list()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Save Transaction" }).props.accessibilityState.disabled).toBe(false);
  });

  it("imports a named account atomically and rolls back a malformed row", async () => {
    const rows = [100, 200].map((amountMinor) => ({
      dateEpochMillis: new Date(2026, 8, 1, 12).getTime(), type: "EXPENSE", amountMinor,
      categoryName: "QA custom category", accountLabel: "QA Wallet", accountKey: importAccountKey("QA Wallet"), accountType: null, note: null,
    }));
    const accountResolutions = { [importAccountKey("QA Wallet")]: { kind: "create", name: "QA Wallet", type: "EWALLET" } };
    await expect(useFinanceStore.getState().importCsvRows(rows, { accountResolutions })).resolves.toMatchObject({ created: 2 });
    const before = buildBackup(useFinanceStore.getState());
    await expect(useFinanceStore.getState().importCsvRows([{ ...rows[0], categoryName: "Rollback category" }, { ...rows[1], amountMinor: -1 }], { accountResolutions })).rejects.toThrow("amountMinor must be greater than zero");
    await useFinanceStore.getState().refresh();
    expect(useFinanceStore.getState().accounts).toEqual(before.accounts);
    expect(useFinanceStore.getState().categories).toEqual(before.categories);
    expect(useFinanceStore.getState().transactions).toEqual(before.transactions);
  });

  it("round-trips transactions and goals through backup/restore", async () => {
    await useFinanceStore.getState().addTransaction({ accountId: useFinanceStore.getState().accounts[0].id, categoryName: "Food", amountMinor: 500, type: "EXPENSE", note: "Synthetic" });
    await new GoalRepository(database).create({ name: "QA goal", targetMinor: 10_000, currentMinor: 2_000 });
    await useFinanceStore.getState().refresh();
    const backup = parseBackup(serializeBackup(buildBackup(useFinanceStore.getState())));
    await useFinanceStore.getState().restoreBackup(backup);
    expect(useFinanceStore.getState().transactions).toEqual([expect.objectContaining({ amountMinor: 500, note: "Synthetic" })]);
    expect(useFinanceStore.getState().goals).toEqual([expect.objectContaining({ name: "QA goal", currentMinor: 2_000 })]);
  });

  it("keeps an edited imported row while importing new rows from the same file", async () => {
    const row = {
      sourceRowNumber: 2,
      sourceKey: "import:v1:example:row-2",
      dateEpochMillis: new Date(2026, 8, 1, 12).getTime(),
      type: "EXPENSE",
      amountMinor: 100,
      categoryName: "Food",
      accountLabel: "Cash",
      accountKey: importAccountKey("Cash"),
      accountType: "CASH",
      note: null,
    };
    await useFinanceStore.getState().importCsvRows([row]);
    const [original] = await new TransactionRepository(database).list();
    await useFinanceStore.getState().updateTransaction(original.id, { amountMinor: 150 });

    const result = await useFinanceStore.getState().importCsvRows([
      row,
      { ...row, sourceRowNumber: 3, sourceKey: "import:v1:example:row-3", amountMinor: 200 },
    ]);
    expect(result).toMatchObject({ created: 1, reconciled: 0, skipped: 1 });
    expect(result.skippedRows[0]).toMatchObject({ rowNumber: 2, reason: expect.stringMatching(/edited after import/i) });
    expect((await new TransactionRepository(database).list()).map(({ amountMinor }) => amountMinor).sort()).toEqual([150, 200]);
  });

  it("does not recreate an account after the user archives that bootstrapped type", async () => {
    const card = useFinanceStore.getState().accounts.find((account) => account.type === "CARD" && !account.isArchived);
    expect(card).toBeDefined();
    await useFinanceStore.getState().archiveAccount(card.id);
    const cards = useFinanceStore.getState().accounts.filter((account) => account.type === "CARD");
    expect(cards).toEqual([expect.objectContaining({ id: card.id, isArchived: true })]);
  });

  it("does not revive an archived type if upgrade metadata is missing", async () => {
    const card = useFinanceStore.getState().accounts.find((account) => account.type === "CARD" && !account.isArchived);
    await useFinanceStore.getState().archiveAccount(card.id);
    await database.execute("DELETE FROM app_metadata WHERE key = ?", ["bootstrap-defaults-v1"]);

    await useFinanceStore.getState().refresh();
    const cards = useFinanceStore.getState().accounts.filter((account) => account.type === "CARD");
    expect(cards).toEqual([expect.objectContaining({ id: card.id, isArchived: true })]);
  });

  it("reconciles an onboarding account after commit succeeds but refresh fails", async () => {
    const accountRepo = new AccountRepository(database);
    const wallet = useFinanceStore.getState().accounts.find((account) => account.type === "EWALLET");
    await accountRepo.delete(wallet.id);
    await useFinanceStore.getState().refresh();

    const realRefresh = useFinanceStore.getState().refresh;
    useFinanceStore.setState({ refresh: jest.fn(async () => { throw new Error("synthetic refresh failure"); }) });
    const input = {
      name: "Campus wallet",
      reuseExistingType: true,
      startingBalanceMinor: 12_500,
      type: "EWALLET",
    };
    await expect(useFinanceStore.getState().createAccount(input)).rejects.toThrow("synthetic refresh failure");

    useFinanceStore.setState({ refresh: realRefresh });
    await expect(useFinanceStore.getState().createAccount(input)).resolves.toMatchObject({
      name: "Campus wallet",
      startingBalanceMinor: 12_500,
      type: "EWALLET",
    });
    expect((await accountRepo.list()).filter((account) => account.type === "EWALLET")).toHaveLength(1);
  });

  it("keeps one encrypted in-database snapshot that can undo a completed restore", async () => {
    const accountId = useFinanceStore.getState().accounts[0].id;
    await useFinanceStore.getState().addTransaction({ accountId, categoryName: "Food", amountMinor: 500, type: "EXPENSE", note: "Before backup" });
    const earlierBackup = parseBackup(serializeBackup(buildBackup(useFinanceStore.getState())));
    await useFinanceStore.getState().addTransaction({ accountId, categoryName: "Food", amountMinor: 700, type: "EXPENSE", note: "Before restore" });

    await useFinanceStore.getState().restoreBackup(earlierBackup);
    expect(useFinanceStore.getState().transactions.map(({ note }) => note)).toEqual(["Before backup"]);

    await useFinanceStore.getState().undoLastRestore();
    expect(useFinanceStore.getState().transactions.map(({ note }) => note)).toEqual(["Before backup", "Before restore"]);
    await expect(useFinanceStore.getState().undoLastRestore()).rejects.toThrow(/No restore recovery snapshot/i);
    expect(useFinanceStore.getState().transactions.map(({ note }) => note)).toEqual(["Before backup", "Before restore"]);
  });

  it("reports a committed restore refresh failure without replacing its undo snapshot", async () => {
    const accountId = useFinanceStore.getState().accounts[0].id;
    await useFinanceStore.getState().addTransaction({ accountId, categoryName: "Food", amountMinor: 500, type: "EXPENSE", note: "Restore target" });
    const targetBackup = parseBackup(serializeBackup(buildBackup(useFinanceStore.getState())));
    await useFinanceStore.getState().addTransaction({ accountId, categoryName: "Food", amountMinor: 700, type: "EXPENSE", note: "Pre-restore only" });

    const realRefresh = useFinanceStore.getState().refresh;
    useFinanceStore.setState({ refresh: jest.fn(async () => { throw new Error("synthetic refresh failure"); }) });
    await expect(useFinanceStore.getState().restoreBackup(targetBackup)).rejects.toMatchObject({
      code: "RESTORE_COMMITTED_REFRESH_FAILED",
    });
    expect((await new TransactionRepository(database).list()).map(({ note }) => note)).toEqual(["Restore target"]);

    useFinanceStore.setState({ refresh: realRefresh });
    await useFinanceStore.getState().undoLastRestore();
    expect(useFinanceStore.getState().transactions.map(({ note }) => note)).toEqual(["Restore target", "Pre-restore only"]);
  });

  it("preserves the previous undo snapshot if a new restore fails inside its transaction", async () => {
    const accountId = useFinanceStore.getState().accounts[0].id;
    await useFinanceStore.getState().addBudget({ categoryName: "Food", monthYear: "2026-08", limitMinor: 1_000 });
    await useFinanceStore.getState().addTransaction({ accountId, categoryName: "Food", amountMinor: 500, type: "EXPENSE", note: "First" });
    const target = parseBackup(serializeBackup(buildBackup(useFinanceStore.getState())));
    await useFinanceStore.getState().addTransaction({ accountId, categoryName: "Food", amountMinor: 700, type: "EXPENSE", note: "Second" });
    await useFinanceStore.getState().restoreBackup(target);
    const before = await database.execute("SELECT backup_json FROM restore_recovery_snapshot WHERE id = 1");

    const originalTransaction = database.transaction.bind(database);
    jest.spyOn(database, "transaction").mockImplementation((work) => originalTransaction((tx) => work({
      execute: (statement, parameters) => {
        if (statement.startsWith("INSERT INTO budgets")) throw new Error("synthetic restore write failure");
        return tx.execute(statement, parameters);
      },
    })));
    await expect(useFinanceStore.getState().restoreBackup(target)).rejects.toThrow(/synthetic restore write failure/);
    database.transaction.mockRestore();

    expect((await database.execute("SELECT backup_json FROM restore_recovery_snapshot WHERE id = 1")).rows).toEqual(before.rows);
    expect(useFinanceStore.getState().transactions.map(({ note }) => note)).toEqual(["First"]);
    await useFinanceStore.getState().undoLastRestore();
    expect(useFinanceStore.getState().transactions.map(({ note }) => note)).toEqual(["First", "Second"]);
  });

  it("rejects dangling backup references and preserves all pre-restore data", async () => {
    await useFinanceStore.getState().addTransaction({ accountId: useFinanceStore.getState().accounts[0].id, categoryName: "Food", amountMinor: 500, type: "EXPENSE" });
    const before = buildBackup(useFinanceStore.getState());
    const broken = { ...before, transactions: before.transactions.map((row) => ({ ...row, accountId: 999_999 })) };
    await expect(useFinanceStore.getState().restoreBackup(broken)).rejects.toThrow();
    await useFinanceStore.getState().refresh();
    expect(useFinanceStore.getState().accounts).toEqual(before.accounts);
    expect(useFinanceStore.getState().transactions).toEqual(before.transactions);
  });

  it("refuses malformed backup collections instead of silently restoring empty data", () => {
    const backup = buildBackup(useFinanceStore.getState());
    expect(() => parseBackup(JSON.stringify({ ...backup, transactions: "damaged" }))).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...backup, goals: "damaged" }))).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...backup, accounts: [...backup.accounts, backup.accounts[0]] }))).toThrow();
  });

  it("rejects unsafe backup money before committing replacement rows", async () => {
    await new GoalRepository(database).create({ name: "Safe original", targetMinor: 10_000, currentMinor: 500 });
    await useFinanceStore.getState().refresh();
    const backup = buildBackup(useFinanceStore.getState());
    const before = (await database.execute("SELECT * FROM savings_goals")).rows;
    const corrupt = { ...backup, goals: backup.goals.map((goal) => ({ ...goal, targetMinor: Number.MAX_SAFE_INTEGER + 1 })) };
    await expect(useFinanceStore.getState().restoreBackup(corrupt)).rejects.toThrow();
    expect((await database.execute("SELECT * FROM savings_goals")).rows).toEqual(before);
  });

  it("rejects non-boolean backup flags without changing existing data", async () => {
    await useFinanceStore.getState().addTransaction({
      accountId: useFinanceStore.getState().accounts[0].id,
      categoryName: "Food",
      amountMinor: 500,
      type: "EXPENSE",
      note: "Keep me",
    });
    const before = buildBackup(useFinanceStore.getState());
    const corrupt = {
      ...before,
      accounts: before.accounts.map((account, index) => (
        index === 0 ? { ...account, isArchived: "false" } : account
      )),
    };

    await expect(useFinanceStore.getState().restoreBackup(corrupt)).rejects.toThrow(/isArchived flag/i);
    expect(buildBackup(useFinanceStore.getState()).transactions).toEqual(before.transactions);
  });
});
