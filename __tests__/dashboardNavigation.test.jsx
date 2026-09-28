import { fireEvent, render } from "@testing-library/react-native";
import { OpSqliteDatabase } from "../src/db/sql";
import { migrateDatabase } from "../src/db/schema";
import { AccountRepository, CategoryRepository, TransactionRepository } from "../src/db/repositories";
import { DashboardScreen } from "../src/screens/DashboardScreen";
import { useFinanceStore } from "../src/store/financeStore";
import { initializeDatabase } from "../src/db/client";
import { TestSqliteDatabase } from "./support/testDatabase";

jest.mock("../src/db/client", () => ({ initializeDatabase: jest.fn() }));
jest.mock("../src/store/uiStore", () => ({
  registerFinanceSnapshotProvider: jest.fn(),
  syncRemindersFromStores: jest.fn(async () => {}),
  useUiStore: (selector) => selector({
    currencySymbol: "₱",
    remindersEnabled: false,
    themePreference: "light",
  }),
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

describe("Dashboard recent transaction interactions and navigation", () => {
  let native;
  let database;
  let repos;
  let navigate;
  let tabNavigate;
  let navigation;

  const sepDay = (day) => new Date(2026, 8, day, 12, 0, 0).getTime();

  beforeEach(async () => {
    native = new TestSqliteDatabase();
    database = new OpSqliteDatabase(native);
    await migrateDatabase(database);
    initializeDatabase.mockResolvedValue(database);

    navigate = jest.fn();
    tabNavigate = jest.fn();
    navigation = {
      navigate,
      getParent: () => ({ navigate: tabNavigate }),
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
    database.close();
  });

  it("navigates to TransactionDetail when tapping a recent transaction row", async () => {
    const created = await repos.transactions.create({
      amountMinor: 35_000,
      type: "EXPENSE",
      categoryId: 1, // Food
      accountId: 1,  // Cash
      dateEpochMillis: sepDay(5),
      note: "Campus canteen dinner",
      recurringRuleId: null,
    });
    await useFinanceStore.getState().refresh();

    const screen = await render(<DashboardScreen navigation={navigation} />);

    const rowButton = screen.getByRole("button", {
      name: /Campus canteen dinner/,
    });
    expect(rowButton).toBeTruthy();

    await fireEvent.press(rowButton);
    expect(navigate).toHaveBeenCalledWith("TransactionDetail", {
      transactionId: String(created.id),
    });
  });

  it("navigates to History when See all is tapped", async () => {
    const screen = await render(<DashboardScreen navigation={navigation} />);
    const seeAllButton = screen.getByRole("button", { name: "See all" });
    expect(seeAllButton).toBeTruthy();

    await fireEvent.press(seeAllButton);
    expect(tabNavigate).toHaveBeenCalledWith("History", {
      screen: "HistoryList",
    });
  });

  it("navigates to Entry when FAB + is tapped", async () => {
    const screen = await render(<DashboardScreen navigation={navigation} />);
    const fab = screen.getByRole("button", { name: "Add transaction" });
    expect(fab).toBeTruthy();

    await fireEvent.press(fab);
    expect(navigate).toHaveBeenCalledWith("Entry");
  });
});
