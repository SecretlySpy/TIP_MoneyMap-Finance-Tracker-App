jest.mock("../src/db/client", () => ({ initializeDatabase: jest.fn() }));
jest.mock("../src/store/uiStore", () => ({
  registerFinanceSnapshotProvider: jest.fn(),
  syncRemindersFromStores: jest.fn(async () => {}),
  useUiStore: (selector) => selector({ themePreference: "light", currencySymbol: "₱" }),
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { EntryScreen } from "../src/screens/EntryScreen";
import { HistoryScreen } from "../src/screens/HistoryScreen";
import { TransactionDetailScreen } from "../src/screens/TransactionDetailScreen";
import { EditTransactionScreen } from "../src/screens/EditTransactionScreen";
import { useFinanceStore } from "../src/store/financeStore";
import { computeDashboardTotals, buildBudgetCards, toMonthYear } from "../src/domain/services/financeView";

describe("Transfer UI Flows (Phase 2 & Phase 3 Slice)", () => {
  let navigate;
  let navigation;
  let alertSpy;
  const currentMonth = toMonthYear();
  const testNow = Date.now();

  beforeEach(() => {
    navigate = jest.fn();
    navigation = {
      getParent: () => ({ navigate }),
      navigate,
      goBack: jest.fn(),
      canGoBack: () => true,
    };
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    useFinanceStore.setState({
      accounts: [
        { id: 1, name: "Cash Wallet", type: "CASH", startingBalanceMinor: 100_000, isArchived: false },
        { id: 2, name: "Student Card", type: "CARD", startingBalanceMinor: 50_000, isArchived: false },
        { id: 3, name: "Maya", type: "EWALLET", startingBalanceMinor: 20_000, isArchived: false },
      ],
      categories: [
        { id: 10, name: "Food", type: "EXPENSE", icon: "restaurant" },
        { id: 11, name: "Allowance", type: "INCOME", icon: "wallet" },
      ],
      transactions: [
        {
          id: 101,
          accountId: 1,
          categoryId: 10,
          type: "EXPENSE",
          amountMinor: 8_000,
          note: "Lunch",
          dateEpochMillis: testNow,
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
          dateEpochMillis: testNow,
          sourceKey: "tr:201",
        },
      ],
      budgets: [
        { id: 301, categoryId: 10, limitMinor: 500_000, monthYear: currentMonth },
      ],
      recurringRules: [],
      goals: [],
      selectedMonthYear: currentMonth,
      status: "ready",
      addAccountTransfer: jest.fn(async (payload) => ({ id: 202, ...payload })),
      updateAccountTransfer: jest.fn(async (id, patch) => ({ id, ...patch })),
      deleteAccountTransferById: jest.fn(async () => {}),
      addTransaction: jest.fn(async (payload) => ({ id: 102, ...payload })),
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe("EntryScreen - Transfer Mode", () => {
    it("renders Phase 2 Frame 299:2779 guidance and handles same-account error (Frame 299:2782)", async () => {
      const screen = await render(<EntryScreen navigation={navigation} />);

      // Switch to Transfer tab
      const transferTab = screen.getByRole("tab", { name: "Transfer" });
      fireEvent.press(transferTab);

      // Verify Frame 299:2779 guidance text
      await waitFor(() => {
        expect(screen.getByText("Transfer between accounts")).toBeTruthy();
        expect(
          screen.getByText(/From → To • Amount • Date • Note[\s\S]*Does not count as income or expense\./)
        ).toBeTruthy();
        expect(screen.getByText("From Account")).toBeTruthy();
        expect(screen.getByText("To Account")).toBeTruthy();
      });

      // Enter amount: "1" -> "5" -> "0"
      await fireEvent.press(screen.getByRole("button", { name: "1" }));
      await fireEvent.press(screen.getByRole("button", { name: "5" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));

      // Select same account for both from and to: set To Account to Cash Wallet (id: 1)
      await fireEvent.press(screen.getByTestId("to-account-1"));

      // Should show Phase 2 Frame 299:2782 error card
      await waitFor(() => {
        expect(screen.getByTestId("same-account-error")).toBeTruthy();
        expect(screen.getByText("Choose two different accounts")).toBeTruthy();
        expect(
          screen.getByText("Same-account transfers are blocked. Negative balances are allowed and explained.")
        ).toBeTruthy();
        expect(screen.getByRole("button", { name: "Save Transfer" }).props.accessibilityState.disabled).toBe(true);
      });

      // Change To Account back to Student Card (id: 2)
      await fireEvent.press(screen.getByTestId("to-account-2"));

      await waitFor(() => {
        expect(screen.queryByTestId("same-account-error")).toBeNull();
        expect(screen.getByRole("button", { name: "Save Transfer" }).props.accessibilityState.disabled).toBe(false);
      });
    });

    it("allows swapping accounts and explains negative balance overdraft without blocking save", async () => {
      const screen = await render(<EntryScreen navigation={navigation} />);
      const transferTab = screen.getByRole("tab", { name: "Transfer" });
      await fireEvent.press(transferTab);

      await waitFor(() => {
        expect(screen.getByLabelText("Swap accounts")).toBeTruthy();
      });

      // Swap accounts
      await fireEvent.press(screen.getByLabelText("Swap accounts"));

      // Enter a large amount that causes overdraft on Student Card: "9" -> "0" -> "0" -> "0" -> "0" (₱90,000)
      await fireEvent.press(screen.getByRole("button", { name: "9" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));

      // Verify overdraft warning is shown but save button remains enabled
      await waitFor(() => {
        expect(screen.getByText(/Overdraft warning: from account balance will be negative/)).toBeTruthy();
      });

      expect(screen.getByRole("button", { name: "Save Transfer" }).props.accessibilityState.disabled).toBe(false);
    });

    it("saves transfer with sourceKey and navigates to History", async () => {
      const screen = await render(<EntryScreen navigation={navigation} />);
      const transferTab = screen.getByRole("tab", { name: "Transfer" });
      await fireEvent.press(transferTab);

      await waitFor(() => {
        expect(screen.getByText("From Account")).toBeTruthy();
      });

      // Amount: "2" -> "5" -> "0" (₱250.00)
      await fireEvent.press(screen.getByRole("button", { name: "2" }));
      await fireEvent.press(screen.getByRole("button", { name: "5" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));

      await waitFor(() => {
        const btn = screen.getByRole("button", { name: "Save Transfer" });
        expect(btn.props.accessibilityState.disabled).toBe(false);
      });

      const saveBtn = screen.getByRole("button", { name: "Save Transfer" });
      await fireEvent.press(saveBtn);

      await waitFor(() => {
        expect(useFinanceStore.getState().addAccountTransfer).toHaveBeenCalledWith(
          expect.objectContaining({
            fromAccountId: 1,
            toAccountId: 2,
            amountMinor: 25_000,
            sourceKey: expect.stringMatching(/^manual:v1:/),
          })
        );
        expect(navigation.goBack).toHaveBeenCalled();
        expect(navigate).toHaveBeenCalledWith("History", { screen: "HistoryList" });
      });
    });

    it("handles insufficient accounts (< 2 active accounts) gracefully", async () => {
      useFinanceStore.setState({
        accounts: [
          { id: 1, name: "Cash Wallet", type: "CASH", startingBalanceMinor: 100_000, isArchived: false },
          { id: 2, name: "Old Card", type: "CARD", startingBalanceMinor: 0, isArchived: true },
        ],
        categories: [
          { id: 10, name: "Food", type: "EXPENSE", icon: "restaurant" },
        ],
      });

      const screen = await render(<EntryScreen navigation={navigation} />);
      const transferTab = screen.getByRole("tab", { name: "Transfer" });
      await fireEvent.press(transferTab);

      await waitFor(() => {
        expect(screen.getByTestId("insufficient-accounts-banner")).toBeTruthy();
        expect(screen.getByText("At least two accounts needed")).toBeTruthy();
      });

      const saveBtn = screen.getByRole("button", { name: "Save Transfer" });
      expect(saveBtn.props.accessibilityState.disabled).toBe(true);
    });
  });

  describe("HistoryScreen - Transfers", () => {
    it("renders transfers with neutral styling and allows tap to detail and long press to delete", async () => {
      const screen = await render(<HistoryScreen navigation={navigation} />);

      await waitFor(() => {
        expect(screen.getByText("Top up student card")).toBeTruthy();
        expect(screen.getByText("Cash Wallet → Student Card")).toBeTruthy();
        expect(screen.getByText("₱200")).toBeTruthy();
      });

      // Tap to view detail
      await fireEvent.press(screen.getByText("Top up student card"));
      expect(navigation.navigate).toHaveBeenCalledWith("TransactionDetail", {
        isTransfer: true,
        transferId: 201,
      });

      // Long press triggers delete confirmation alert
      fireEvent(screen.getByText("Top up student card"), "longPress");
      expect(alertSpy).toHaveBeenCalledWith(
        "Delete transfer?",
        "Balances will be reverted across both accounts.",
        expect.any(Array)
      );
    });

    it("filters transfers correctly by account and excludes them from category filter", async () => {
      const screen = await render(<HistoryScreen navigation={navigation} />);

      await waitFor(() => {
        expect(screen.getByText("All accounts ▾")).toBeTruthy();
      });

      // Filter by Maya (id: 3 has no transfers)
      await fireEvent.press(screen.getByRole("button", { name: "All accounts ▾" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Maya" })).toBeTruthy());
      await fireEvent.press(screen.getByRole("button", { name: "Maya" }));

      await waitFor(() => {
        expect(screen.queryByText("Top up student card")).toBeNull();
      });

      // Filter by Cash Wallet (id: 1 has transfer 201)
      await fireEvent.press(screen.getByRole("button", { name: "Maya ▾" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Cash Wallet" })).toBeTruthy());
      await fireEvent.press(screen.getByRole("button", { name: "Cash Wallet" }));

      await waitFor(() => {
        expect(screen.getByText("Top up student card")).toBeTruthy();
      });

      // Category filter should exclude transfers
      await fireEvent.press(screen.getByRole("button", { name: "All categories ▾" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Food" })).toBeTruthy());
      await fireEvent.press(screen.getByRole("button", { name: "Food" }));

      await waitFor(() => {
        expect(screen.queryByText("Top up student card")).toBeNull();
      });
    });
  });

  describe("TransactionDetailScreen - Transfer", () => {
    it("displays transfer detail with Edit button that navigates to EditTransaction", async () => {
      const route = { params: { isTransfer: true, transferId: 201 } };
      const screen = await render(<TransactionDetailScreen navigation={navigation} route={route} />);

      await waitFor(() => {
        expect(screen.getByText("Account Transfer")).toBeTruthy();
        expect(screen.getByText("Top up student card")).toBeTruthy();
        expect(screen.getByText("₱200")).toBeTruthy();
        expect(screen.getByText("Transfer · Neutral Ledger")).toBeTruthy();
      });

      // Edit button in header
      const editBtn = screen.getByLabelText("Edit transfer");
      await fireEvent.press(editBtn);

      expect(navigation.navigate).toHaveBeenCalledWith("EditTransaction", {
        isTransfer: true,
        transferId: 201,
      });
    });
  });

  describe("EditTransactionScreen - Transfer Mode", () => {
    it("renders EditTransferForm and updates transfer on save", async () => {
      const route = { params: { isTransfer: true, transferId: 201 } };
      const screen = await render(<EditTransactionScreen navigation={navigation} route={route} />);

      await waitFor(() => {
        expect(screen.getByText("Edit Transfer")).toBeTruthy();
        expect(screen.getByLabelText("Transfer amount").props.value).toBe("200");
        expect(screen.getByLabelText("Transfer note").props.value).toBe("Top up student card");
      });

      // Edit note and amount
      await fireEvent.changeText(screen.getByLabelText("Transfer amount"), "350");
      await fireEvent.changeText(screen.getByLabelText("Transfer note"), "Updated top up note");

      await waitFor(() => {
        expect(screen.getByLabelText("Transfer amount").props.value).toBe("350");
        expect(screen.getByLabelText("Transfer note").props.value).toBe("Updated top up note");
      });

      // Save transfer via header save button
      await fireEvent.press(screen.getByLabelText("Save transfer changes"));

      await waitFor(() => {
        expect(useFinanceStore.getState().updateAccountTransfer).toHaveBeenCalledWith(
          201,
          expect.objectContaining({
            amountMinor: 35_000,
            note: "Updated top up note",
            fromAccountId: 1,
            toAccountId: 2,
          })
        );
        expect(navigation.goBack).toHaveBeenCalled();
      });
    });

    it("validates same-account restriction and prevents save in EditTransferForm", async () => {
      const route = { params: { isTransfer: true, transferId: 201 } };
      const screen = await render(<EditTransactionScreen navigation={navigation} route={route} />);

      await waitFor(() => {
        expect(screen.getByText("Edit Transfer")).toBeTruthy();
      });

      // Select Cash Wallet for To Account
      await fireEvent.press(screen.getByTestId("edit-to-account-1"));

      await waitFor(() => {
        expect(screen.getByTestId("same-account-error")).toBeTruthy();
        expect(screen.getByText("Choose two different accounts")).toBeTruthy();
      });

      expect(screen.getByLabelText("Save transfer changes").props.accessibilityState.disabled).toBe(true);
    });

    it("renders MissingTransferView when transfer is not found", async () => {
      const route = { params: { isTransfer: true, transferId: 9999 } };
      const screen = await render(<EditTransactionScreen navigation={navigation} route={route} />);

      await waitFor(() => {
        expect(screen.getByTestId("edit-missing-transfer-screen")).toBeTruthy();
        expect(screen.getByText("Transfer unavailable")).toBeTruthy();
      });
    });
  });

  describe("Financial Integrity Invariants", () => {
    it("conserves total net worth and contributes 0 to income, expense, and budgets", () => {
      const state = useFinanceStore.getState();

      const totalsBefore = computeDashboardTotals(
        state.accounts,
        state.transactions,
        state.selectedMonthYear,
        []
      );

      const totalsWithTransfer = computeDashboardTotals(
        state.accounts,
        state.transactions,
        state.selectedMonthYear,
        state.transfers
      );

      // Total balance (net worth) must be strictly identical
      expect(totalsWithTransfer.balanceMinor).toBe(totalsBefore.balanceMinor);

      // Income and expenses must be completely unaffected by transfers
      expect(totalsWithTransfer.incomeMinor).toBe(totalsBefore.incomeMinor);
      expect(totalsWithTransfer.expenseMinor).toBe(totalsBefore.expenseMinor);

      // Budgets must be completely unaffected by transfers
      const categoriesById = new Map(state.categories.map((c) => [c.id, c]));
      const budgets = buildBudgetCards(state.budgets, state.transactions, categoriesById, state.selectedMonthYear);
      expect(budgets[0].spentMinor).toBe(8_000); // Only the ₱80.00 expense, not the ₱200 transfer
    });
  });
});
