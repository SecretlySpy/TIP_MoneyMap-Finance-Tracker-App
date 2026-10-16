jest.mock("../src/db/client", () => ({ initializeDatabase: jest.fn() }));
jest.mock("../src/store/uiStore", () => ({
  registerFinanceSnapshotProvider: jest.fn(),
  syncRemindersFromStores: jest.fn(async () => {}),
  useUiStore: (selector) => selector({ themePreference: "light", currencySymbol: "₱" }),
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { EntryScreen } from "../src/screens/EntryScreen";
import { ManageAccountsScreen } from "../src/screens/ManageAccountsScreen";
import { BudgetsScreen } from "../src/screens/BudgetsScreen";
import { RecurringScreen } from "../src/screens/RecurringScreen";
import { ReportsScreen } from "../src/screens/ReportsScreen";
import { useFinanceStore } from "../src/store/financeStore";

describe("P1B, P1C, and P2 Power Tools UI Flows", () => {
  let navigate;
  let navigation;

  beforeEach(() => {
    navigate = jest.fn();
    navigation = {
      getParent: () => ({ navigate }),
      navigate,
      goBack: jest.fn(),
      canGoBack: () => true,
    };

    useFinanceStore.setState({
      accounts: [
        { id: 1, name: "Cash Wallet", type: "CASH", startingBalanceMinor: 100_000, isArchived: false },
        { id: 2, name: "Student Card", type: "CARD", startingBalanceMinor: 50_000, isArchived: false },
      ],
      categories: [
        { id: 10, name: "Food", type: "EXPENSE", icon: "🍜" },
        { id: 11, name: "Allowance", type: "INCOME", icon: "💵" },
        { id: 12, name: "School", type: "EXPENSE", icon: "📚" },
      ],
      transactions: [
        {
          id: 101,
          accountId: 1,
          categoryId: 10,
          type: "EXPENSE",
          amountMinor: 8_000,
          note: "Lunch with #friends",
          dateEpochMillis: new Date(2026, 6, 15, 12).getTime(),
          sourceKey: "tx:101",
        },
      ],
      transfers: [
        {
          id: 201,
          fromAccountId: 1,
          toAccountId: 2,
          amountMinor: 20_000,
          note: "Top up student card",
          dateEpochMillis: new Date(2026, 6, 15, 12).getTime(),
          sourceKey: "tr:201",
        },
      ],
      budgets: [
        { id: 301, categoryId: 10, limitMinor: 500_000, monthYear: "2026-07" },
      ],
      recurringRules: [],
      goals: [],
      selectedMonthYear: "2026-07",
      status: "ready",
      addAccountTransfer: jest.fn(async (payload) => ({ id: 202, ...payload })),
      deleteAccountTransferById: jest.fn(async () => {}),
      addTransaction: jest.fn(async (payload) => ({ id: 102, ...payload })),
      addBudget: jest.fn(async (payload) => ({ id: 302, ...payload })),
      addCategory: jest.fn(async ({ name, type }) => ({ id: 99, name, type })),
      addRecurringBill: jest.fn(async (payload) => ({ id: 401, ...payload })),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("P1B: Account Reconciliation Flow (Frame 299:2785)", () => {
    it("renders Frame 299:2785 copy and allows toggling transactions checklist", async () => {
      const screen = await render(<ManageAccountsScreen navigation={navigation} />);

      const detailButtons = screen.getAllByRole("button", { name: "Details & Reconcile" });
      fireEvent.press(detailButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Working: ₱.*Cleared: ₱.*Diff: ₱/)).toBeTruthy();
        expect(screen.getAllByText("Mark transactions cleared. Explicit adjustment only.")[0]).toBeTruthy();
        expect(screen.getByText("Transactions Checklist")).toBeTruthy();
      });

      // Toggle clearance on Lunch transaction
      const lunchCheckbox = screen.getByRole("checkbox", { name: /Lunch/ });
      await fireEvent.press(lunchCheckbox);

      // Discrepancy button appears for explicit adjustment
      await waitFor(() => {
        expect(screen.getByText("+ Create Adjustment Transaction")).toBeTruthy();
      });

      // Pressing adjustment transaction creates explicit ledger row
      await fireEvent.press(screen.getByText("+ Create Adjustment Transaction"));
      await waitFor(() => {
        expect(useFinanceStore.getState().addTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            accountId: 1,
            note: "Reconciliation adjustment",
          })
        );
      });
    });
  });

  describe("P1B: Budget Rollover Flow (Frame 299:2788)", () => {
    it("renders Frame 299:2788 equation and safe-to-spend guarantee in Rollover Sheet", async () => {
      const screen = await render(<BudgetsScreen navigation={navigation} />);

      // Tap budget card to open rollover sheet
      const budgetCard = screen.getByRole("button", { name: "Food" });
      await fireEvent.press(budgetCard);

      await waitFor(() => {
        expect(screen.getByText("Prior carry + plan − actual = next carry")).toBeTruthy();
        expect(screen.getByText("No double-count with Safe-to-Spend or goals.")).toBeTruthy();
        expect(screen.getByText("Next Carry-forward")).toBeTruthy();
      });
    });
  });

  describe("P1C: Recurring Review Queue (Frame 299:2791)", () => {
    it("renders Frame 299:2791 4-button action row and allows 1-tap Confirm", async () => {
      useFinanceStore.setState({
        transactions: [
          {
            id: 501,
            type: "EXPENSE",
            accountId: 1,
            categoryId: 10,
            note: "Netflix",
            amountMinor: 49_900,
            dateEpochMillis: new Date(2026, 4, 15).getTime(),
          },
          {
            id: 502,
            type: "EXPENSE",
            accountId: 1,
            categoryId: 10,
            note: "Netflix",
            amountMinor: 49_900,
            dateEpochMillis: new Date(2026, 5, 15).getTime(),
          },
        ],
      });

      const screen = await render(<RecurringScreen navigation={navigation} />);

      await waitFor(() => {
        expect(screen.getByText("Netflix")).toBeTruthy();
        expect(screen.getByText(/Likely recurring \(seen 2 times\)\. Confidence: high\./)).toBeTruthy();
        expect(screen.getByText("Confirm • Dismiss • Edit • Reminder")).toBeTruthy();
        expect(screen.getByText("Never auto-mutates ledger.")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Reminder" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
      });

      // 1-tap Confirm adds recurring bill
      await fireEvent.press(screen.getByRole("button", { name: "Confirm" }));
      await waitFor(() => {
        expect(useFinanceStore.getState().addRecurringBill).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "Netflix",
            amountMinor: 49_900,
            frequency: "MONTHLY",
          })
        );
      });
    });
  });

  describe("P1C: Reports Screen (Frame 299:2794)", () => {
    it("renders Frame 299:2794 cash flow summary and accessible table toggle", async () => {
      const screen = await render(<ReportsScreen navigation={navigation} />);

      expect(screen.getByText(/Income ₱.*Expenses ₱.*Net ₱/)).toBeTruthy();
      expect(screen.getByText("Transfers excluded from totals.")).toBeTruthy();
      expect(screen.getByText("Accessible table alternative available.")).toBeTruthy();

      // Toggle to accessible table view
      const tableToggle = screen.getByRole("button", { name: "Accessible table alternative" });
      await fireEvent.press(tableToggle);

      await waitFor(() => {
        expect(screen.getByLabelText("Monthly Cash Flow Table")).toBeTruthy();
        expect(screen.getByText("MONTH")).toBeTruthy();
        expect(screen.getByText("INCOME")).toBeTruthy();
        expect(screen.getByText("EXPENSES")).toBeTruthy();
      });
    });
  });

  describe("P2: Power Tools - Exact-Sum Splits and Tags in EntryScreen", () => {
    it("allows splitting transaction with exact-sum verification", async () => {
      const screen = await render(<EntryScreen navigation={navigation} />);

      // Type amount: 5 -> 0 -> 0 = 500.00
      await fireEvent.press(screen.getByRole("button", { name: "5" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Split transaction" })).toBeTruthy();
      });

      // Activate Split mode
      await fireEvent.press(screen.getByRole("button", { name: "Split transaction" }));

      await waitFor(() => {
        expect(screen.getByText("EXACT-SUM SPLIT BREAKDOWN")).toBeTruthy();
        expect(screen.getByText("₱250 + ₱250 = ₱500")).toBeTruthy();
        expect(screen.getByText("✓ Exact sum verified")).toBeTruthy();
      });

      // Save split transaction
      const saveBtn = screen.getByRole("button", { name: "Save Transaction" });
      await fireEvent.press(saveBtn);

      await waitFor(() => {
        expect(useFinanceStore.getState().addTransaction).toHaveBeenCalledTimes(2);
        expect(useFinanceStore.getState().addTransaction).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({ amountMinor: 25_000 })
        );
        expect(useFinanceStore.getState().addTransaction).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ amountMinor: 25_000 })
        );
      });
    });
  });
});
