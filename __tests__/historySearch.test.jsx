import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { OpSqliteDatabase } from "../src/db/sql";
import { migrateDatabase } from "../src/db/schema";
import { AccountRepository, CategoryRepository, TransactionRepository } from "../src/db/repositories";
import { HistoryScreen } from "../src/screens/HistoryScreen";
import { useFinanceStore } from "../src/store/financeStore";
import { initializeDatabase } from "../src/db/client";
import { TestSqliteDatabase } from "./support/testDatabase";

jest.mock("../src/db/client", () => ({ initializeDatabase: jest.fn() }));
jest.mock("../src/store/uiStore", () => ({
  registerFinanceSnapshotProvider: jest.fn(),
  syncRemindersFromStores: jest.fn(async () => {}),
  useUiStore: (selector) => selector({ themePreference: "light", currencySymbol: "₱" }),
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

describe("History search and filter composition", () => {
  let native;
  let database;
  let repos;
  let navigate;
  let navigation;

  const sepDay = (day) => new Date(2026, 8, day, 12, 0, 0).getTime();

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
    useFinanceStore.getState().setSelectedMonthYear("2026-09");

    repos = {
      accounts: new AccountRepository(database),
      categories: new CategoryRepository(database),
      transactions: new TransactionRepository(database),
    };

    // Seed test transactions in September 2026
    // Categories: 1=Food (EXPENSE), 2=Transport (EXPENSE), 3=Allowance (INCOME)
    // Account: 1=Cash
    await repos.transactions.create({
      amountMinor: 8_500,
      type: "EXPENSE",
      categoryId: 1, // Food
      accountId: 1,  // Cash
      dateEpochMillis: sepDay(2),
      note: "Campus canteen lunch",
      recurringRuleId: null,
    });
    await repos.transactions.create({
      amountMinor: 2_500,
      type: "EXPENSE",
      categoryId: 2, // Transport
      accountId: 1,
      dateEpochMillis: sepDay(3),
      note: "Jeepney ride to university",
      recurringRuleId: null,
    });
    await repos.transactions.create({
      amountMinor: 150_000,
      type: "INCOME",
      categoryId: 11, // Allowance (seeded)
      accountId: 1,
      dateEpochMillis: sepDay(1),
      note: "Monthly stipend",
      recurringRuleId: null,
    });

    await useFinanceStore.getState().refresh();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    database.close();
  });

  it("filters transactions by note text search and displays result count", async () => {
    const screen = await render(<HistoryScreen navigation={navigation} />);

    // Open search bar
    const searchToggle = screen.getByLabelText("Open search");
    await fireEvent.press(searchToggle);

    // Type query matching "canteen"
    const searchInput = screen.getByLabelText("Search transactions or notes");
    await fireEvent.changeText(searchInput, "canteen");

    expect(screen.getByText("1 transaction found")).toBeTruthy();
    expect(screen.getByText("Campus canteen lunch")).toBeTruthy();
    expect(screen.queryByText("Jeepney ride to university")).toBeNull();
  });

  it("matches category name case-insensitively in search", async () => {
    const screen = await render(<HistoryScreen navigation={navigation} />);

    // Open search bar and search for category "transport"
    await fireEvent.press(screen.getByLabelText("Open search"));
    const searchInput = screen.getByLabelText("Search transactions or notes");
    await fireEvent.changeText(searchInput, "transp");

    expect(screen.getByText("1 transaction found")).toBeTruthy();
    expect(screen.getByText("Jeepney ride to university")).toBeTruthy();
    expect(screen.queryByText("Campus canteen lunch")).toBeNull();
  });

  it("composes text search with category filter", async () => {
    const screen = await render(<HistoryScreen navigation={navigation} />);

    // Open category filter and select "Food"
    await fireEvent.press(screen.getByText("All categories ▾"));
    await fireEvent.press(screen.getByText("Food"));

    // Open search and search for "university" (which is in Transport, not Food)
    await fireEvent.press(screen.getByLabelText("Open search"));
    const searchInput = screen.getByLabelText("Search transactions or notes");
    await fireEvent.changeText(searchInput, "university");

    // Both filters compose: Category=Food AND query="university" -> 0 matches
    expect(screen.getByText("No transactions found")).toBeTruthy();
    expect(screen.getByText(/No transactions matched "university"/)).toBeTruthy();

    // Now search for "lunch" (matches Food category and query)
    await fireEvent.changeText(searchInput, "lunch");
    expect(screen.getByText("1 transaction found")).toBeTruthy();
    expect(screen.getByText("Campus canteen lunch")).toBeTruthy();
  });

  it("displays Frame 17b empty state on zero results and clears search on button press", async () => {
    const screen = await render(<HistoryScreen navigation={navigation} />);

    await fireEvent.press(screen.getByLabelText("Open search"));
    const searchInput = screen.getByLabelText("Search transactions or notes");
    await fireEvent.changeText(searchInput, "nonexistent keyword");

    expect(screen.getByText("No transactions found")).toBeTruthy();
    expect(screen.getByText(/No transactions matched "nonexistent keyword"/)).toBeTruthy();

    // Press "Clear search"
    const clearButton = screen.getByText("Clear search");
    await fireEvent.press(clearButton);

    // All 3 September transactions should be visible again
    expect(screen.getByText("Campus canteen lunch")).toBeTruthy();
    expect(screen.getByText("Jeepney ride to university")).toBeTruthy();
    expect(screen.getByText("Monthly stipend")).toBeTruthy();
  });

  it("tapping a transaction row navigates to TransactionDetail with transactionId", async () => {
    const screen = await render(<HistoryScreen navigation={navigation} />);

    const row = screen.getByText("Campus canteen lunch");
    await fireEvent.press(row);

    expect(navigate).toHaveBeenCalledWith("TransactionDetail", {
      transactionId: expect.any(Number),
    });
  });
});
