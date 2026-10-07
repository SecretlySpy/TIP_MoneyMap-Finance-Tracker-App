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
import { HistoryScreen } from "../src/screens/HistoryScreen";
import { TransactionDetailScreen } from "../src/screens/TransactionDetailScreen";
import { ManageAccountsScreen } from "../src/screens/ManageAccountsScreen";
import { BudgetsScreen } from "../src/screens/BudgetsScreen";
import { RecurringScreen } from "../src/screens/RecurringScreen";
import { ReportsScreen } from "../src/screens/ReportsScreen";
import { useFinanceStore } from "../src/store/financeStore";

describe("Roadmap UI Flows", () => {
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
      ],
      transactions: [
        {
          id: 101,
          accountId: 1,
          categoryId: 10,
          type: "EXPENSE",
          amountMinor: 8_000,
          note: "Lunch",
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
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders transfers in HistoryScreen and navigates to TransactionDetail", async () => {
    const screen = await render(<HistoryScreen navigation={navigation} />);

    // Transfer note or directional text should be visible in history
    await waitFor(() => {
      expect(screen.getByText("Top up student card")).toBeTruthy();
      expect(screen.getByText("Cash Wallet → Student Card")).toBeTruthy();
    });

    // Tap transfer row to view detail
    fireEvent.press(screen.getByText("Top up student card"));
    expect(navigation.navigate).toHaveBeenCalledWith(
      "TransactionDetail",
      expect.objectContaining({
        isTransfer: true,
        transferId: 201,
      })
    );
  });

  it("renders transfer details in TransactionDetailScreen and provides delete action", async () => {
    const route = { params: { isTransfer: true, transferId: 201 } };
    const screen = await render(<TransactionDetailScreen navigation={navigation} route={route} />);

    expect(screen.getByText("Account Transfer")).toBeTruthy();
    expect(screen.getByText("₱200.00")).toBeTruthy();
    expect(screen.getByText("Top up student card")).toBeTruthy();
    expect(screen.getByText("Delete Transfer")).toBeTruthy();

    // Open delete sheet and confirm
    fireEvent.press(screen.getByText("Delete Transfer"));
    await waitFor(() => {
      expect(screen.getByText("Delete this transfer?")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Confirm Delete"));
    await waitFor(() => {
      expect(useFinanceStore.getState().deleteAccountTransferById).toHaveBeenCalledWith(201);
      expect(navigation.goBack).toHaveBeenCalled();
    });
  });

  it("renders ManageAccountsScreen details & reconciliation flow", async () => {
    const screen = await render(<ManageAccountsScreen navigation={navigation} />);

    // Open Details & Reconcile for Cash Wallet
    const detailButtons = screen.getAllByRole("button", { name: "Details & Reconcile" });
    fireEvent.press(detailButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Cash Wallet · Details & Reconcile")).toBeTruthy();
      expect(screen.getByText("Working Balance")).toBeTruthy();
      expect(screen.getByText("Reconciliation Check")).toBeTruthy();
    });

    // Input matching statement balance
    const input = screen.getByLabelText("Statement balance");
    // Starting balance 1,000 - expense 80 - outbound transfer 200 = 720
    fireEvent.changeText(input, "720.00");

    await waitFor(() => {
      expect(screen.getByText("Finish & Save Reconciliation")).toBeTruthy();
    });
  });

  it("renders BudgetsScreen with Semester Plan template selector", async () => {
    const screen = await render(<BudgetsScreen navigation={navigation} />);

    // Click Semester Plan
    fireEvent.press(screen.getByText("🎓 Semester Plan"));

    await waitFor(() => {
      expect(screen.getByText("🎓 Student Semester Templates")).toBeTruthy();
      expect(screen.getByText("Standard Student Semester")).toBeTruthy();
      expect(screen.getByText("Daily Commuter Plan")).toBeTruthy();
    });
  });

  it("renders RecurringScreen with detected subscriptions review queue", async () => {
    // Add two recurring Spotify expenses to trigger detection
    useFinanceStore.setState({
      transactions: [
        {
          id: 501,
          type: "EXPENSE",
          accountId: 1,
          note: "Spotify",
          amountMinor: 14_900,
          dateEpochMillis: new Date(2026, 4, 15).getTime(),
        },
        {
          id: 502,
          type: "EXPENSE",
          accountId: 1,
          note: "Spotify",
          amountMinor: 14_900,
          dateEpochMillis: new Date(2026, 5, 15).getTime(),
        },
      ],
    });

    const screen = await render(<RecurringScreen navigation={navigation} />);

    await waitFor(() => {
      expect(screen.getByText("Detected Subscriptions (1)")).toBeTruthy();
      expect(screen.getByText("Spotify")).toBeTruthy();
      expect(screen.getByText("Track as Bill")).toBeTruthy();
      expect(screen.getByText("Dismiss")).toBeTruthy();
    });

    // Dismiss candidate
    fireEvent.press(screen.getByText("Dismiss"));
    await waitFor(() => {
      expect(screen.queryByText("Detected Subscriptions (1)")).toBeNull();
    });
  });

  it("renders ReportsScreen with cash flow trends and debt payoff calculator", async () => {
    const screen = await render(<ReportsScreen navigation={navigation} />);

    // Cash flow tab
    expect(screen.getByText("Reports & Insights")).toBeTruthy();
    expect(screen.getByText("CURRENT TOTAL NET WORTH")).toBeTruthy();
    expect(screen.getByText("ℹ️ Transfers Excluded by Design")).toBeTruthy();

    // Switch to Student Debt Planner tab
    const debtTab = screen.getByRole("tab", { name: "Student Debt Planner" });
    fireEvent.press(debtTab);

    await waitFor(() => {
      expect(screen.getByText("Student Debt & Payoff Calculator")).toBeTruthy();
      expect(screen.getByText("ESTIMATED PAYOFF PLAN")).toBeTruthy();
      expect(screen.getByText("Time to Debt-Free")).toBeTruthy();
    });
  });

  it("renders EntryScreen in Transfer mode and triggers addAccountTransfer", async () => {
    const screen = await render(<EntryScreen navigation={navigation} />);

    // Switch to Transfer tab
    const transferTab = screen.getByRole("tab", { name: "Transfer" });
    fireEvent.press(transferTab);

    // Verify Transfer-specific UI elements appear
    await waitFor(() => {
      expect(screen.getByText("From Account")).toBeTruthy();
      expect(screen.getByText("To Account")).toBeTruthy();
      expect(screen.getByText("Swap accounts")).toBeTruthy();
    });

    // Input amount via keypad: "5" -> "0" -> "0"
    fireEvent.press(screen.getByRole("button", { name: "5" }));
    fireEvent.press(screen.getByRole("button", { name: "0" }));
    fireEvent.press(screen.getByRole("button", { name: "0" }));

    // Post-transfer preview should show updated balance preview
    expect(screen.getByText("POST-TRANSFER BALANCE PREVIEW")).toBeTruthy();

    // Save transfer
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: "Save Transfer" });
      expect(btn.props.accessibilityState.disabled).toBe(false);
    });
    const saveButton = screen.getByRole("button", { name: "Save Transfer" });
    fireEvent.press(saveButton);

    await waitFor(() => {
      expect(useFinanceStore.getState().addAccountTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          fromAccountId: 1,
          toAccountId: 2,
          amountMinor: 50_000, // ₱500.00
        })
      );
      expect(navigate).toHaveBeenCalledWith("History", { screen: "HistoryList" });
    });
  });
});
