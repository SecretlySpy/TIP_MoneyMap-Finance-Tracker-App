import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { OpSqliteDatabase } from "../src/db/sql";
import { migrateDatabase } from "../src/db/schema";
import { AccountRepository, CategoryRepository, TransactionRepository } from "../src/db/repositories";
import { ImportScreen } from "../src/screens/ImportScreen";
import { useFinanceStore } from "../src/store/financeStore";
import { initializeDatabase } from "../src/db/client";
import { pickAndParseImportFile } from "../src/services/importFile";
import { TestSqliteDatabase } from "./support/testDatabase";

jest.mock("../src/db/client", () => ({ initializeDatabase: jest.fn() }));
jest.mock("../src/services/importFile", () => ({
  pickAndParseImportFile: jest.fn(),
  parseGridWithMappings: jest.requireActual("../src/services/importFile").parseGridWithMappings,
}));
jest.mock("../src/store/uiStore", () => ({
  registerFinanceSnapshotProvider: jest.fn(),
  syncRemindersFromStores: jest.fn(async () => {}),
  useUiStore: (selector) => selector({ themePreference: "light", currencySymbol: "₱" }),
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

describe("Import review, duplicate detection, atomic commit, and rollback", () => {
  let native;
  let database;
  let repos;
  let navigate;
  let navigation;

  const testDay = new Date(2026, 8, 15, 12, 0, 0).getTime();

  beforeEach(async () => {
    native = new TestSqliteDatabase();
    database = new OpSqliteDatabase(native);
    await migrateDatabase(database);
    initializeDatabase.mockResolvedValue(database);

    navigate = jest.fn();
    navigation = {
      navigate,
      getParent: () => ({ navigate }),
      goBack: jest.fn(),
    };

    useFinanceStore.setState({ status: "idle" });
    await useFinanceStore.getState().ensureHydrated();

    repos = {
      accounts: new AccountRepository(database),
      categories: new CategoryRepository(database),
      transactions: new TransactionRepository(database),
    };

    // Existing transaction in DB: ₱150.00 on 2026-09-15, Cash account, Food
    await repos.transactions.create({
      amountMinor: 15_000,
      type: "EXPENSE",
      categoryId: 1, // Food
      accountId: 1,  // Cash
      dateEpochMillis: testDay,
      note: "Original canteen meal",
      recurringRuleId: null,
    });
    await useFinanceStore.getState().refresh();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    database.close();
  });

  function mockImportFileContent() {
    pickAndParseImportFile.mockResolvedValue({
      fileName: "statement.csv",
      format: "csv",
      headers: ["Date", "Amount", "Type", "Category", "Account", "Note"],
      mappings: { Date: 0, Amount: 1, Type: 2, Category: 3, Account: 4, Note: 5 },
      grid: [
        ["Date", "Amount", "Type", "Category", "Account", "Note"],
        // Row 1: Ready new row (₱250.00)
        ["2026-09-16", "250.00", "EXPENSE", "Transport", "Cash", "Bus ride"],
        // Row 2: Candidate duplicate (₱150.00 on 2026-09-15 Cash)
        ["2026-09-15", "150.00", "EXPENSE", "Food", "Cash", "Duplicate lunch"],
        // Row 3: Invalid row (amount 0)
        ["2026-09-17", "0", "EXPENSE", "Food", "Cash", "Zero amount"],
      ],
    });
  }

  it("detects candidate duplicates, excludes them by default, and reflects selected count on button", async () => {
    mockImportFileContent();
    const screen = await render(<ImportScreen navigation={navigation} />);

    // Step 1: Pick file
    await fireEvent.press(screen.getByRole("button", { name: "Choose File" }));

    // Step 2: Map columns -> click Resolve accounts
    await waitFor(() => expect(screen.getByRole("button", { name: "Resolve accounts" })).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Resolve accounts" }));

    // Step 3: Resolve accounts -> click Review import
    await waitFor(() => expect(screen.getByRole("button", { name: "Review import" })).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Review import" }));

    // Step 4: In REVIEW
    // Summary tiles: 1 Ready, 1 Duplicate, 1 Invalid
    await waitFor(() => expect(screen.getByText("Review Import")).toBeTruthy());
    expect(screen.getByText("Ready")).toBeTruthy();
    expect(screen.getByText("Duplicate")).toBeTruthy();
    expect(screen.getAllByText("Invalid").length).toBeGreaterThanOrEqual(1);

    // Check duplicate row display
    expect(screen.getByText("Possible duplicate")).toBeTruthy();
    expect(screen.getByText(/Matches existing expense of ₱150\.00 on 2026-09-15/)).toBeTruthy();

    // Check invalid row display with reason
    expect(screen.getByText("Row 4")).toBeTruthy();
    expect(screen.getByText("Reason: Amount must be greater than zero.")).toBeTruthy();

    // Default button count excludes duplicate: 1 ready row only
    expect(screen.getByRole("button", { name: "Import 1 transaction" })).toBeTruthy();

    // Explicitly check "Include this row anyway"
    const checkbox = screen.getByRole("checkbox", { name: "Include this duplicate row anyway" });
    expect(checkbox.props.accessibilityState.checked).toBe(false);

    await fireEvent.press(checkbox);
    // Button count updates dynamically to 2 transactions
    await waitFor(() => expect(screen.getByRole("button", { name: "Import 2 transactions" })).toBeTruthy());

    // Toggle off again
    await fireEvent.press(checkbox);
    await waitFor(() => expect(screen.getByRole("button", { name: "Import 1 transaction" })).toBeTruthy());
  });

  it("commits selected rows atomically and displays confirmed outcome stats", async () => {
    mockImportFileContent();
    const screen = await render(<ImportScreen navigation={navigation} />);

    await fireEvent.press(screen.getByRole("button", { name: "Choose File" }));
    await waitFor(() => screen.getByRole("button", { name: "Resolve accounts" }));
    await fireEvent.press(screen.getByRole("button", { name: "Resolve accounts" }));
    await waitFor(() => screen.getByRole("button", { name: "Review import" }));
    await fireEvent.press(screen.getByRole("button", { name: "Review import" }));

    // In Review: default only imports 1 ready row, 1 duplicate is excluded, 1 invalid is skipped
    await waitFor(() => screen.getByRole("button", { name: "Import 1 transaction" }));
    await fireEvent.press(screen.getByRole("button", { name: "Import 1 transaction" }));

    // Transitions to Step COMPLETE (Frame 19c)
    await waitFor(() => expect(screen.getByText("Import complete!")).toBeTruthy());
    expect(screen.getAllByText("1 transaction(s)").length).toBe(2);
    expect(screen.getByText("Duplicates excluded")).toBeTruthy();
    expect(screen.getByText("Invalid rows skipped")).toBeTruthy();

    // Verify DB state: 1 original + 1 imported = 2 transactions total
    const dbTransactions = await repos.transactions.list();
    expect(dbTransactions).toHaveLength(2);
    expect(dbTransactions.some((t) => t.note === "Bus ride")).toBe(true);
    expect(dbTransactions.some((t) => t.note === "Duplicate lunch")).toBe(false);
  });

  it("rolls back atomically on failure and shows uncertain outcome state", async () => {
    mockImportFileContent();
    const screen = await render(<ImportScreen navigation={navigation} />);

    await fireEvent.press(screen.getByRole("button", { name: "Choose File" }));
    await waitFor(() => screen.getByRole("button", { name: "Resolve accounts" }));
    await fireEvent.press(screen.getByRole("button", { name: "Resolve accounts" }));
    await waitFor(() => screen.getByRole("button", { name: "Review import" }));
    await fireEvent.press(screen.getByRole("button", { name: "Review import" }));

    // Inject database failure on import transaction insert in native SQLite
    const origNativeExecute = native.execute.bind(native);
    jest.spyOn(native, "execute").mockImplementation(async (sql, params) => {
      if (/^INSERT INTO transactions/.test(sql)) {
        throw new Error("simulated disk crash during bulk insert");
      }
      return origNativeExecute(sql, params);
    });

    await waitFor(() => screen.getByRole("button", { name: "Import 1 transaction" }));
    await fireEvent.press(screen.getByRole("button", { name: "Import 1 transaction" }));

    // Transitions to Step UNCERTAIN (Frame 19d)
    await waitFor(() => expect(screen.getByText("Import needs attention")).toBeTruthy());
    expect(screen.getByText(/The import encountered an issue and was rolled back/)).toBeTruthy();
    expect(screen.getByText(/simulated disk crash/)).toBeTruthy();

    // DB remains cleanly rolled back: only the 1 original transaction exists
    const dbTransactions = await repos.transactions.list();
    expect(dbTransactions).toHaveLength(1);
    expect(dbTransactions[0].note).toBe("Original canteen meal");

    // "Return to review" button brings user back to REVIEW state
    await fireEvent.press(screen.getByRole("button", { name: "Return to review" }));
    await waitFor(() => expect(screen.getByText("Review Import")).toBeTruthy());
  });
});
