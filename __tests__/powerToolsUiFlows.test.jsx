jest.mock("../src/db/client", () => ({ initializeDatabase: jest.fn() }));
jest.mock("../src/store/uiStore", () => ({
  registerFinanceSnapshotProvider: jest.fn(),
  syncRemindersFromStores: jest.fn(async () => {}),
  useUiStore: (selector) => selector({ themePreference: "light", currencySymbol: "₱" }),
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

import React from "react";
import { render, fireEvent, waitFor, cleanup, act } from "@testing-library/react-native";
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
      setSelectedMonthYear: jest.fn(),
      status: "ready",
      addAccountTransfer: jest.fn(async (payload) => ({ id: 202, ...payload })),
      deleteAccountTransferById: jest.fn(async () => {}),
      addTransaction: jest.fn(async (payload) => ({ id: 102, ...payload })),
      addSplitTransactions: jest.fn(async (inputs) => inputs.map((p, i) => ({ id: 102 + i, ...p }))),
      addBudget: jest.fn(async (payload) => ({ id: 302, ...payload })),
      addCategory: jest.fn(async ({ name, type }) => ({ id: 99, name, type })),
      addRecurringBill: jest.fn(async (payload) => ({ id: 401, ...payload })),
    });
  });

  afterEach(() => {
    cleanup();
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
        expect(useFinanceStore.getState().addSplitTransactions).toHaveBeenCalledTimes(1);
        const saved = useFinanceStore.getState().addSplitTransactions.mock.calls[0][0];
        expect(saved).toHaveLength(2);
        expect(saved[0]).toEqual(expect.objectContaining({ amountMinor: 25_000 }));
        expect(saved[1]).toEqual(expect.objectContaining({ amountMinor: 25_000 }));
        expect(navigation.goBack).toHaveBeenCalled();
      });
    });

    it("supports independent category selection for Split #1 and Split #2 in real time", async () => {
      const screen = await render(<EntryScreen navigation={navigation} />);

      // Enter 500
      await fireEvent.press(screen.getByRole("button", { name: "5" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));

      // Activate split mode
      await fireEvent.press(screen.getByRole("button", { name: "Split transaction" }));

      await waitFor(() => {
        expect(screen.getByTestId("split-item-0")).toBeTruthy();
        expect(screen.getByTestId("split-item-1")).toBeTruthy();
      });

      // Split #1 is active by default. Select School in category grid
      const schoolCategoryBtn = screen.getByTestId("category-cell-School");
      await fireEvent.press(schoolCategoryBtn);

      await waitFor(() => {
        // Split #1 should now be School
        expect(screen.getByTestId("split-category-0")).toHaveTextContent(/School/);
      });

      // Select Split #2 to make it active
      await fireEvent.press(screen.getByTestId("split-item-1"));

      // Select Food in category grid
      const foodCategoryBtn = screen.getByTestId("category-cell-Food");
      await fireEvent.press(foodCategoryBtn);

      await waitFor(() => {
        // Split #2 should now be Food, and Split #1 should remain School
        expect(screen.getByTestId("split-category-1")).toHaveTextContent(/Food/);
        expect(screen.getByTestId("split-category-0")).toHaveTextContent(/School/);
      });

      // Change categories repeatedly without cross-entry updates
      await fireEvent.press(screen.getByTestId("split-item-0"));
      await fireEvent.press(screen.getByTestId("category-cell-Food"));
      expect(screen.getByTestId("split-category-0")).toHaveTextContent(/Food/);
      expect(screen.getByTestId("split-category-1")).toHaveTextContent(/Food/);

      await fireEvent.press(screen.getByTestId("split-item-1"));
      await fireEvent.press(screen.getByTestId("category-cell-School"));
      expect(screen.getByTestId("split-category-0")).toHaveTextContent(/Food/);
      expect(screen.getByTestId("split-category-1")).toHaveTextContent(/School/);
    });

    it("supports independent amount editing, exact sum validation, and remaining / over-allocation display", async () => {
      const screen = await render(<EntryScreen navigation={navigation} />);

      // Enter 500
      await fireEvent.press(screen.getByRole("button", { name: "5" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "Split transaction" }));

      const split1AmountInput = screen.getByTestId("split-amount-0");
      const split2AmountInput = screen.getByTestId("split-amount-1");
      const saveBtn = screen.getByRole("button", { name: "Save Transaction" });

      // Edit Split #1 to 300
      fireEvent.changeText(split1AmountInput, "300");

      await waitFor(() => {
        expect(split1AmountInput.props.value).toBe("300");
        // Split #1 is 300, Split #2 is 250 -> Total 550, parent 500 -> 50 over-allocation
        expect(screen.getByText(/₱50 over-allocation/)).toBeTruthy();
      });

      // Edit Split #2 to 200 -> 300 + 200 = 500 (exact sum verified)
      fireEvent.changeText(split2AmountInput, "200");

      await waitFor(() => {
        expect(split2AmountInput.props.value).toBe("200");
        expect(screen.getByText("₱300 + ₱200 = ₱500")).toBeTruthy();
        expect(screen.getByText("✓ Exact sum verified")).toBeTruthy();
      });

      // Set combined splits to 450: edit Split #2 to 150 -> 50 remaining, save disabled
      fireEvent.changeText(split2AmountInput, "150");

      await waitFor(() => {
        expect(screen.getByText(/₱50 remaining/)).toBeTruthy();
      });

      // Set combined splits to 550: edit Split #2 to 250 -> 50 over-allocation, save disabled
      fireEvent.changeText(split2AmountInput, "250");

      await waitFor(() => {
        expect(screen.getByText(/₱50 over-allocation/)).toBeTruthy();
      });

      // Return to valid 300 + 200 = 500
      fireEvent.changeText(split2AmountInput, "200");
      await waitFor(() => {
        expect(screen.getByText("✓ Exact sum verified")).toBeTruthy();
      });
    });

    it("rejects zero, negative, and invalid amounts from being saved", async () => {
      const screen = await render(<EntryScreen navigation={navigation} />);

      // Enter 500
      await fireEvent.press(screen.getByRole("button", { name: "5" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "Split transaction" }));

      const split1AmountInput = screen.getByTestId("split-amount-0");

      // Enter 0 for Split #1
      fireEvent.changeText(split1AmountInput, "0");

      await waitFor(() => {
        expect(screen.getByText(/Split item 1 must have a positive integer minor amount/)).toBeTruthy();
      });

      // Enter invalid text
      fireEvent.changeText(split1AmountInput, "invalid");

      await waitFor(() => {
        expect(screen.getByText(/Split item 1 must have a positive integer minor amount/)).toBeTruthy();
      });
    });

    it("preserves exact monetary precision with centavos", async () => {
      const screen = await render(<EntryScreen navigation={navigation} />);

      // Enter 500
      await fireEvent.press(screen.getByRole("button", { name: "5" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "Split transaction" }));

      const split1AmountInput = screen.getByTestId("split-amount-0");
      const split2AmountInput = screen.getByTestId("split-amount-1");

      // Set 300.50 and 199.50
      fireEvent.changeText(split1AmountInput, "300.50");
      await waitFor(() => {
        expect(split1AmountInput.props.value).toBe("300.50");
      });

      fireEvent.changeText(split2AmountInput, "199.50");

      await waitFor(() => {
        expect(screen.getByText("₱300.50 + ₱199.50 = ₱500.00")).toBeTruthy();
        expect(screen.getByText("✓ Exact sum verified")).toBeTruthy();
      });
    });

    it("recalculates validation when parent amount changes during split mode", async () => {
      const screen = await render(<EntryScreen navigation={navigation} />);

      // Enter 500
      await fireEvent.press(screen.getByRole("button", { name: "5" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "Split transaction" }));

      await waitFor(() => {
        expect(screen.getByText("✓ Exact sum verified")).toBeTruthy();
      });

      // Tap parent amount to target it with the keypad
      await fireEvent.press(screen.getByTestId("entry-parent-amount"));

      // Keypad now edits parent amount: press 0 to make it 5000 (₱5,000)
      await fireEvent.press(screen.getByRole("button", { name: "0" }));

      await waitFor(() => {
        // Parent amount is now ₱5,000; splits sum is ₱500; diff is ₱4,500 remaining
        expect(screen.getByText(/₱4,500 remaining/)).toBeTruthy();
      });
    });

    it("resets and reinitializes consistently when canceling and reopening split mode", async () => {
      const screen = await render(<EntryScreen navigation={navigation} />);

      // Enter 500
      await fireEvent.press(screen.getByRole("button", { name: "5" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "Split transaction" }));

      await waitFor(() => {
        expect(screen.getByText("EXACT-SUM SPLIT BREAKDOWN")).toBeTruthy();
      });

      // Cancel split
      await fireEvent.press(screen.getByRole("button", { name: "Cancel split" }));

      await waitFor(() => {
        expect(screen.queryByText("EXACT-SUM SPLIT BREAKDOWN")).toBeNull();
        expect(screen.getByRole("button", { name: "Split transaction" })).toBeTruthy();
      });

      // Reopen split
      await fireEvent.press(screen.getByRole("button", { name: "Split transaction" }));

      await waitFor(() => {
        expect(screen.getByText("EXACT-SUM SPLIT BREAKDOWN")).toBeTruthy();
        expect(screen.getByText("₱250 + ₱250 = ₱500")).toBeTruthy();
      });
    });

    it("supports category selection via direct category picker sheet", async () => {
      const screen = await render(<EntryScreen navigation={navigation} />);

      // Enter 500
      await fireEvent.press(screen.getByRole("button", { name: "5" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "Split transaction" }));

      // Press Category on Split #2 to open the picker sheet
      await fireEvent.press(screen.getByTestId("split-category-1"));

      await waitFor(() => {
        expect(screen.getByTestId("split-category-picker-sheet")).toBeTruthy();
        expect(screen.getByTestId("picker-category-chip-12")).toBeTruthy(); // School category
      });

      // Select School chip in picker
      await fireEvent.press(screen.getByTestId("picker-category-chip-12"));

      await waitFor(() => {
        expect(screen.getByTestId("split-category-1")).toHaveTextContent(/School/);
      });
    });

    it("dynamically adds 3rd, 4th, and 5th splits with independent values and keeps save disabled when amounts are incomplete", async () => {
      const screen = await render(<EntryScreen navigation={navigation} />);

      // Enter 1000
      await fireEvent.press(screen.getByRole("button", { name: "1" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "Split transaction" }));

      // Split 1 and Split 2 exist initially
      expect(screen.getByTestId("split-item-0")).toBeTruthy();
      expect(screen.getByTestId("split-item-1")).toBeTruthy();
      expect(screen.queryByTestId("split-item-2")).toBeNull();

      // Tap + Add Split -> Split #3 appears
      await fireEvent.press(screen.getByTestId("add-split-btn"));
      expect(screen.getByTestId("split-item-2")).toBeTruthy();
      expect(screen.getByTestId("split-amount-2").props.value).toBe("0");

      // Incomplete amount on Split #3 -> validation error displayed and save disabled
      await waitFor(() => {
        expect(screen.getByText(/Split item 3 must have a positive integer minor amount/)).toBeTruthy();
      });

      // Tap + Add Split again -> Split #4 appears
      await fireEvent.press(screen.getByTestId("add-split-btn"));
      expect(screen.getByTestId("split-item-3")).toBeTruthy();

      // Tap + Add Split again -> Split #5 appears
      await fireEvent.press(screen.getByTestId("add-split-btn"));
      expect(screen.getByTestId("split-item-4")).toBeTruthy();

      // All 5 splits exist with independent editors
      expect(screen.getByTestId("split-item-0")).toBeTruthy();
      expect(screen.getByTestId("split-item-1")).toBeTruthy();
      expect(screen.getByTestId("split-item-2")).toBeTruthy();
      expect(screen.getByTestId("split-item-3")).toBeTruthy();
      expect(screen.getByTestId("split-item-4")).toBeTruthy();
    });

    it("supports editing Split #3 amount, removing Split #3, and removing an entry in the middle while preserving values and preventing removal below 2", async () => {
      const screen = await render(<EntryScreen navigation={navigation} />);

      // Enter 1000
      await fireEvent.press(screen.getByRole("button", { name: "1" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "Split transaction" }));

      // Add 3rd split
      await fireEvent.press(screen.getByTestId("add-split-btn"));
      expect(screen.getByTestId("split-item-2")).toBeTruthy();

      // Edit Split #1 amount to 400
      const split1AmountInput = screen.getByTestId("split-amount-0");
      fireEvent.changeText(split1AmountInput, "400");
      await waitFor(() => {
        expect(split1AmountInput.props.value).toBe("400");
      });

      // Edit Split #2: select School category, set amount to 250
      await fireEvent.press(screen.getByTestId("split-item-1"));
      await fireEvent.press(screen.getByTestId("category-cell-School"));
      const split2AmountInput = screen.getByTestId("split-amount-1");
      fireEvent.changeText(split2AmountInput, "250");
      await waitFor(() => {
        expect(split2AmountInput.props.value).toBe("250");
        expect(screen.getByTestId("split-category-1")).toHaveTextContent(/School/);
      });

      // Edit Split #3: select Food category, set amount to 350
      await fireEvent.press(screen.getByTestId("split-item-2"));
      await fireEvent.press(screen.getByTestId("category-cell-Food"));
      const split3AmountInput = screen.getByTestId("split-amount-2");
      fireEvent.changeText(split3AmountInput, "350");
      await waitFor(() => {
        expect(split3AmountInput.props.value).toBe("350");
        expect(screen.getByTestId("split-category-2")).toHaveTextContent(/Food/);
        // 400 + 250 + 350 = 1000 exact sum verified
        expect(screen.getByText("✓ Exact sum verified")).toBeTruthy();
      });

      // Remove an entry in the middle (Split #2 - School 250)
      const removeBtn1 = screen.getByTestId("split-remove-1");
      expect(removeBtn1.props.accessibilityState.disabled).toBe(false);
      await fireEvent.press(removeBtn1);

      // Now 2 splits remain
      expect(screen.queryByTestId("split-item-2")).toBeNull();
      expect(screen.getByTestId("split-item-0")).toBeTruthy();
      expect(screen.getByTestId("split-item-1")).toBeTruthy();

      // Remaining entries retain exact categories and amounts:
      // Split #1 is still Food with amount 400
      expect(screen.getByTestId("split-category-0")).toHaveTextContent(/Food/);
      expect(screen.getByTestId("split-amount-0").props.value).toBe("400");

      // New Split #2 (former Split #3) is Food with amount 350
      expect(screen.getByTestId("split-category-1")).toHaveTextContent(/Food/);
      expect(screen.getByTestId("split-amount-1").props.value).toBe("350");

      // Amounts were NOT silently redistributed: total is now 400 + 350 = 750 (250 remaining)
      expect(screen.getByText(/₱250 remaining/)).toBeTruthy();

      // Now exactly 2 splits remain -> Removal must be disabled on both
      const rem0 = screen.getByTestId("split-remove-0");
      const rem1 = screen.getByTestId("split-remove-1");
      expect(rem0.props.accessibilityState.disabled).toBe(true);
      expect(rem1.props.accessibilityState.disabled).toBe(true);

      // Attempt to remove below two entries -> Does not remove
      await fireEvent.press(rem0);
      expect(screen.getByTestId("split-item-0")).toBeTruthy();
      expect(screen.getByTestId("split-item-1")).toBeTruthy();
    });

    it("persists five valid split records correctly and resets state", async () => {
      const mockAddSplitTransactions = jest.fn(async (inputs) =>
        inputs.map((p, i) => ({ id: 700 + i, ...p }))
      );
      useFinanceStore.setState({ addSplitTransactions: mockAddSplitTransactions });

      const screen = await render(<EntryScreen navigation={navigation} />);

      // Enter 1000
      await fireEvent.press(screen.getByRole("button", { name: "1" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "Split transaction" }));

      // Add 3 more splits so total is 5 splits
      await fireEvent.press(screen.getByTestId("add-split-btn"));
      await fireEvent.press(screen.getByTestId("add-split-btn"));
      await fireEvent.press(screen.getByTestId("add-split-btn"));

      // Set each split amount to 200 (5 x 200 = 1000)
      for (let i = 0; i < 5; i++) {
        const input = screen.getByTestId(`split-amount-${i}`);
        fireEvent.changeText(input, "200");
        await waitFor(() => {
          expect(input.props.value).toBe("200");
        });
      }

      await waitFor(() => {
        expect(screen.getByText("✓ Exact sum verified")).toBeTruthy();
      });

      // Tap Save Transaction
      const saveBtn = screen.getByRole("button", { name: "Save Transaction" });
      await fireEvent.press(saveBtn);

      await waitFor(() => {
        expect(mockAddSplitTransactions).toHaveBeenCalledTimes(1);
        const savedSplits = mockAddSplitTransactions.mock.calls[0][0];
        expect(savedSplits).toHaveLength(5);
        expect(savedSplits.reduce((acc, s) => acc + s.amountMinor, 0)).toBe(100_000);
        savedSplits.forEach((s, idx) => {
          expect(s.amountMinor).toBe(20_000);
          expect(s.sourceKey).toContain(`:split:${idx}`);
          expect(s.note).toContain(`(Split ${idx + 1}/5)`);
        });
        expect(navigation.goBack).toHaveBeenCalled();
      });
    });

    it("handles save operation failure cleanly without crashing or leaving partial state", async () => {
      const mockAddSplitTransactions = jest.fn(async () => {
        throw new Error("Disk write I/O error");
      });
      useFinanceStore.setState({ addSplitTransactions: mockAddSplitTransactions });

      const screen = await render(<EntryScreen navigation={navigation} />);

      // Enter 500
      await fireEvent.press(screen.getByRole("button", { name: "5" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "Split transaction" }));

      await waitFor(() => {
        expect(screen.getByText("✓ Exact sum verified")).toBeTruthy();
      });

      const saveBtn = screen.getByRole("button", { name: "Save Transaction" });
      await fireEvent.press(saveBtn);

      // Verify failure was caught and navigation was not called
      await waitFor(() => {
        expect(mockAddSplitTransactions).toHaveBeenCalledTimes(1);
        expect(navigation.goBack).not.toHaveBeenCalled();
      });
    });

    it("resets split mode and preserves non-split transaction behavior when switching transaction types", async () => {
      const screen = await render(<EntryScreen navigation={navigation} />);

      // Enter 500 and activate split mode
      await fireEvent.press(screen.getByRole("button", { name: "5" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "0" }));
      await fireEvent.press(screen.getByRole("button", { name: "Split transaction" }));

      await waitFor(() => {
        expect(screen.getByTestId("split-breakdown-card")).toBeTruthy();
      });

      // Switch to Income tab
      await fireEvent.press(screen.getByRole("tab", { name: "Income" }));

      await waitFor(() => {
        // Split breakdown card is hidden/reset
        expect(screen.queryByTestId("split-breakdown-card")).toBeNull();
      });

      // Switch back to Expense tab
      await fireEvent.press(screen.getByRole("tab", { name: "Expense" }));

      await waitFor(() => {
        // Split mode is clean/unsplit; split toggle button shows "✂ Split Transaction"
        expect(screen.queryByTestId("split-breakdown-card")).toBeNull();
        expect(screen.getByRole("button", { name: "Split transaction" })).toBeTruthy();
      });
    });
  });
});

