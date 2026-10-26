jest.mock("../src/db/client", () => ({ initializeDatabase: jest.fn() }));
jest.mock("../src/store/uiStore", () => ({
  registerFinanceSnapshotProvider: jest.fn(),
  syncRemindersFromStores: jest.fn(async () => {}),
  useUiStore: (selector) => selector({ themePreference: "light", currencySymbol: "$" }),
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

import { Alert } from "react-native";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";
import { BudgetsScreen } from "../src/screens/BudgetsScreen";
import { GoalsScreen } from "../src/screens/GoalsScreen";
import { ManageAccountsScreen } from "../src/screens/ManageAccountsScreen";
import { RecurringScreen } from "../src/screens/RecurringScreen";
import { ReportsScreen } from "../src/screens/ReportsScreen";
import { BudgetTemplateModal } from "../src/components/BudgetTemplateModal";
import { useFinanceStore } from "../src/store/financeStore";

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

describe("whole-peso auxiliary forms", () => {
  beforeEach(() => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    useFinanceStore.setState({
      accounts: [{ id: 1, name: "Cash", type: "CASH", startingBalanceMinor: 12_550, isArchived: false }],
      budgets: [{ id: 3, categoryId: 2, monthYear: "2026-07", limitMinor: 12_550 }],
      categories: [{ id: 2, name: "Food", type: "EXPENSE", icon: "🍜" }],
      transactions: [], transfers: [], goals: [{ id: 4, name: "Laptop", targetMinor: 12_550, currentMinor: 0 }],
      recurringRules: [{ id: 5, note: "Internet", amountMinor: 12_550, categoryId: 2, accountId: 1, frequency: "MONTHLY", nextRunEpochMillis: Date.now(), reminderLeadDays: 3, isActive: true }],
      selectedMonthYear: "2026-07", budgetTemplates: [{ id: "custom-1", name: "Campus", period: "MONTHLY", categories: [{ name: "Food", amountMinor: 12_550, emoji: "🍜" }] }],
      addBudget: jest.fn(async () => {}), updateAccount: jest.fn(async () => {}),
      updateGoal: jest.fn(async () => {}), updateRecurringRule: jest.fn(async () => {}),
      saveBudgetTemplate: jest.fn(async () => {}), loadBudgetTemplates: jest.fn(async () => {}),
    });
  });

  afterEach(async () => { await cleanup(); jest.restoreAllMocks(); });

  it("keeps an unchanged budget limit exact despite rounding its editor", async () => {
    const screen = await render(<BudgetsScreen navigation={navigation} />);
    await fireEvent(screen.getByRole("button", { name: "Food" }), "longPress");
    await Alert.alert.mock.calls.at(-1)[2].find((option) => option.text === "Edit").onPress();
    await act(async () => Alert.alert.mock.calls.at(-1)[2].find((option) => option.text === "Edit limit").onPress());
    expect(screen.getByLabelText("Monthly limit").props.value).toBe("126");
    await fireEvent.press(screen.getByText("Save budget"));
    await waitFor(() => expect(useFinanceStore.getState().addBudget).toHaveBeenCalledWith(expect.objectContaining({ limitMinor: 12_550 })));
  });

  it("preserves an unchanged legacy account balance and rejects fractional edits", async () => {
    const screen = await render(<ManageAccountsScreen navigation={navigation} />);
    await fireEvent.press(screen.getByText("Edit balance"));
    expect(screen.getByPlaceholderText("0").props.value).toBe("126");
    await fireEvent.press(screen.getByText("Save"));
    await waitFor(() => expect(useFinanceStore.getState().updateAccount).toHaveBeenCalledWith({ id: 1, startingBalanceMinor: 12_550 }));
    await fireEvent.press(screen.getByText("Edit balance"));
    await fireEvent.changeText(screen.getByPlaceholderText("0"), "126.50");
    await fireEvent.press(screen.getByText("Save"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Balance update failed", expect.stringMatching(/whole-peso/)));
    expect(useFinanceStore.getState().updateAccount).toHaveBeenCalledTimes(1);
  });

  it("preserves an unchanged goal target and bill amount", async () => {
    const goals = await render(<GoalsScreen navigation={navigation} />);
    await fireEvent(goals.getByRole("button", { name: /Laptop/ }), "longPress");
    await Alert.alert.mock.calls.at(-1)[2].find((option) => option.text === "Edit").onPress();
    await Alert.alert.mock.calls.at(-1)[2].find((option) => option.text === "More…").onPress();
    await act(async () => Alert.alert.mock.calls.at(-1)[2].find((option) => option.text === "Target").onPress());
    expect(goals.getByPlaceholderText("5000").props.value).toBe("126");
    await fireEvent.press(goals.getByText("Save"));
    await waitFor(() => expect(useFinanceStore.getState().updateGoal).toHaveBeenCalledWith(4, { targetMinor: 12_550 }));
    await goals.unmount();

    const bills = await render(<RecurringScreen navigation={navigation} />);
    await fireEvent(bills.getByRole("button", { name: /Internet/ }), "longPress");
    await Alert.alert.mock.calls.at(-1)[2].find((option) => option.text === "Edit").onPress();
    await Alert.alert.mock.calls.at(-1)[2].find((option) => option.text === "More…").onPress();
    await act(async () => Alert.alert.mock.calls.at(-1)[2].find((option) => option.text === "Amount").onPress());
    expect(bills.getByPlaceholderText("1000", { includeHiddenElements: true }).props.value).toBe("126");
    await fireEvent.press(bills.getByText("Save", { includeHiddenElements: true }));
    await waitFor(() => expect(useFinanceStore.getState().updateRecurringRule).toHaveBeenCalledWith(5, { amountMinor: 12_550 }));
  });

  it("uses whole-peso debt inputs without changing the display-only dollar setting", async () => {
    const screen = await render(<ReportsScreen navigation={navigation} />);
    await fireEvent.press(screen.getByRole("tab", { name: "Student Debt Planner", includeHiddenElements: true }));
    expect(screen.getByLabelText("Debt balance", { includeHiddenElements: true }).props.value).toBe("1200");
    expect(screen.getByLabelText("Monthly payment", { includeHiddenElements: true }).props.value).toBe("400");
    await fireEvent.changeText(screen.getByLabelText("Debt balance", { includeHiddenElements: true }), "100.50");
    expect(screen.getByText(/Enter valid whole-peso balances/, { includeHiddenElements: true })).toBeTruthy();
  });

  it("preserves fractional template allocations only when unchanged", async () => {
    const screen = await render(<BudgetTemplateModal visible onClose={() => {}} targetMonthYear="2026-07" />);
    await fireEvent.press(screen.getByRole("button", { name: "Edit Campus", includeHiddenElements: true }));
    const amount = screen.getByLabelText("Category 1 amount");
    expect(amount.props.value).toBe("126");
    await fireEvent.changeText(amount, "126.50");
    expect(screen.getByText(/valid positive whole-peso amount/)).toBeTruthy();
    expect(useFinanceStore.getState().saveBudgetTemplate).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText("Category 1 amount"), "126");
    await fireEvent.press(screen.getByText("Save Template Changes"));
    await waitFor(() => expect(useFinanceStore.getState().saveBudgetTemplate).toHaveBeenCalledWith(expect.objectContaining({ categories: [expect.objectContaining({ amountMinor: 12_550 })] })));
  });
});
