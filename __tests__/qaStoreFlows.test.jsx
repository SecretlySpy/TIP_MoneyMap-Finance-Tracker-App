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
import { GoalRepository, TransactionRepository } from "../src/db/repositories";
import { buildBackup, parseBackup, serializeBackup } from "../src/services/dataTransfer";
import { EntryScreen } from "../src/screens/EntryScreen";
import { useFinanceStore } from "../src/store/financeStore";
import { importAccountKey } from "../src/domain/services/importParser";
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
    await expect(useFinanceStore.getState().importCsvRows([{ ...rows[0], categoryName: "Rollback category" }, { ...rows[1], amountMinor: -1 }], { accountResolutions })).rejects.toMatchObject({ code: "SQLITE_CONSTRAINT_CHECK" });
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
});
