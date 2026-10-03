jest.mock("../src/store/uiStore", () => ({
  registerFinanceSnapshotProvider: jest.fn(),
  syncRemindersFromStores: jest.fn(async () => {}),
  useUiStore: (selector) => selector({ themePreference: "light", currencySymbol: "₱" }),
}));
jest.mock("../src/db/client", () => ({ initializeDatabase: jest.fn() }));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

import { fireEvent, render } from "@testing-library/react-native";
import { MonthChip } from "../src/components/MonthChip";
import { EditTransactionScreen } from "../src/screens/EditTransactionScreen";
import { useFinanceStore } from "../src/store/financeStore";

describe("MonthChip calendar period selection", () => {
  beforeEach(() => {
    useFinanceStore.setState({ selectedMonthYear: "2026-01" });
  });

  it("supports next-month day selection and direct month/year navigation", async () => {
    const screen = await render(<MonthChip />);
    await fireEvent.press(screen.getByRole("button", { name: "Selected month Jan 2026" }));
    await fireEvent.press(screen.getByRole("button", { name: "Next month" }));
    await fireEvent.press(screen.getByRole("button", { name: "February 14, 2026" }));
    await fireEvent.press(screen.getByRole("button", { name: "Choose Feb 14, 2026" }));
    expect(useFinanceStore.getState().selectedMonthYear).toBe("2026-02");

    await fireEvent.press(screen.getByRole("button", { name: "Selected month Feb 2026" }));
    await fireEvent.press(screen.getByRole("button", { name: /^Choose month and year/ }));
    await fireEvent.changeText(screen.getByLabelText("Calendar year"), "2027");
    await fireEvent.press(screen.getByRole("button", { name: "Dec" }));
    await fireEvent.press(screen.getByRole("button", { name: "December 3, 2027" }));
    await fireEvent.press(screen.getByRole("button", { name: "Choose Dec 3, 2027" }));
    expect(useFinanceStore.getState().selectedMonthYear).toBe("2027-12");
  });

  it("opens the shared calendar when a manual transaction date is changed", async () => {
    const dateEpochMillis = new Date(2026, 0, 10, 12).getTime();
    useFinanceStore.setState({
      accounts: [{ id: 1, name: "Cash", type: "CASH", startingBalanceMinor: 0, isArchived: false }],
      categories: [{ id: 1, name: "Food", icon: "restaurant", colorHex: "#EA580C", type: "EXPENSE", isCustom: false }],
      transactions: [{
        id: 1,
        accountId: 1,
        amountMinor: 8_000,
        categoryId: 1,
        dateEpochMillis,
        note: "Lunch",
        recurringRuleId: null,
        scheduledDateEpochMillis: null,
        sourceKey: null,
        type: "EXPENSE",
      }],
    });
    const screen = await render(
      <EditTransactionScreen
        navigation={{ goBack: jest.fn() }}
        route={{ params: { transactionId: 1 } }}
      />,
    );

    expect(screen.queryByTestId("date-picker-sheet")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: /Change date, currently/ }));
    expect(screen.getByTestId("date-picker-sheet").props.visible).toBe(true);
  });
});
