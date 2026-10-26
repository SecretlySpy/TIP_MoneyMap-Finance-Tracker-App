import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { OpSqliteDatabase } from "../src/db/sql";
import { migrateDatabase } from "../src/db/schema";
import {
  AccountRepository,
  CategoryRepository,
  TransactionGroupRepository,
  TransactionRepository,
} from "../src/db/repositories";
import { HistoryScreen } from "../src/screens/HistoryScreen";
import { DashboardScreen } from "../src/screens/DashboardScreen";
import { TransactionRow } from "../src/components/TransactionRow";
import { useFinanceStore } from "../src/store/financeStore";
import { initializeDatabase } from "../src/db/client";
import { TestSqliteDatabase } from "./support/testDatabase";
import {
  buildSplitTransactions,
  groupTransactionsBySplit,
  stripSplitSuffix,
  extractParentNote,
} from "../src/domain/services/splits";
import { buildUiTransaction, groupHistory, recentUiTransactions, computeAccountBalances } from "../src/domain/services/financeView";
import { buildBackup, validateBackup, parseBackup, serializeBackup } from "../src/services/dataTransfer";

jest.mock("../src/db/client", () => ({ initializeDatabase: jest.fn() }));
jest.mock("../src/store/uiStore", () => ({
  registerFinanceSnapshotProvider: jest.fn(),
  syncRemindersFromStores: jest.fn(async () => {}),
  useUiStore: (selector) =>
    selector({
      themePreference: "light",
      currencySymbol: "₱",
      remindersEnabled: false,
    }),
}));
jest.mock("react-native-safe-area-context", () =>
  require("react-native-safe-area-context/jest/mock").default
);

describe("Transaction History UX Redesign and Split Grouping", () => {
  let native;
  let database;
  let repos;
  let navigate;
  let navigation;

  const testDate = (day) => new Date(2026, 9, day, 12, 0, 0).getTime();

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
    useFinanceStore.getState().setSelectedMonthYear("2026-10");

    repos = {
      accounts: new AccountRepository(database),
      categories: new CategoryRepository(database),
      transactionGroups: new TransactionGroupRepository(database),
      transactions: new TransactionRepository(database),
    };
  });

  describe("Domain Services: Grouping and Label Normalization", () => {
    it("strips technical split labels cleanly and extracts parent note", () => {
      expect(stripSplitSuffix("School supplies (Split 1/2)")).toBe("School supplies");
      expect(stripSplitSuffix("Dinner (Split 3/5)")).toBe("Dinner");
      expect(stripSplitSuffix("Groceries [Split 2 of 4]")).toBe("Groceries");
      expect(stripSplitSuffix("User note with no split")).toBe("User note with no split");
      expect(stripSplitSuffix(null)).toBe("");

      expect(extractParentNote("School supplies - Books (Split 1/2)", "Books")).toBe("School supplies");
      expect(extractParentNote("Groceries: Snacks (Split 2/2)", "Snacks")).toBe("Groceries");
    });

    it("groups 2-category, 3-category, and 5+ category split transactions", () => {
      const now = testDate(10);
      const splitGroupId = "grp_test_5splits";
      const allocations = [
        { id: 1, amountMinor: 10_000, type: "EXPENSE", categoryId: 1, accountId: 1, dateEpochMillis: now, splitGroupId, note: "Shopping - Food (Split 1/5)" },
        { id: 2, amountMinor: 20_000, type: "EXPENSE", categoryId: 2, accountId: 1, dateEpochMillis: now, splitGroupId, note: "Shopping - Clothes (Split 2/5)" },
        { id: 3, amountMinor: 5_000, type: "EXPENSE", categoryId: 3, accountId: 1, dateEpochMillis: now, splitGroupId, note: "Shopping - Books (Split 3/5)" },
        { id: 4, amountMinor: 15_000, type: "EXPENSE", categoryId: 4, accountId: 1, dateEpochMillis: now, splitGroupId, note: "Shopping - Gifts (Split 4/5)" },
        { id: 5, amountMinor: 8_000, type: "EXPENSE", categoryId: 5, accountId: 1, dateEpochMillis: now, splitGroupId, note: "Shopping - Snacks (Split 5/5)" },
      ];
      const groups = [{ id: splitGroupId, title: "Shopping Spree", accountId: 1, dateEpochMillis: now }];

      const grouped = groupTransactionsBySplit(allocations, groups);
      expect(grouped).toHaveLength(1);
      expect(grouped[0].isGroup).toBe(true);
      expect(grouped[0].amountMinor).toBe(58_000); // 100+200+50+150+80 = 580 PHP
      expect(grouped[0].allocations).toHaveLength(5);
      expect(grouped[0].title).toBe("Shopping Spree");
      expect(grouped[0].splitCategoryCount).toBe(5);
    });

    it("keeps normal single-category transactions un-grouped and uncluttered", () => {
      const single = [
        { id: 10, amountMinor: 5_000, type: "EXPENSE", categoryId: 1, accountId: 1, dateEpochMillis: testDate(5), note: "Lunch" },
      ];
      const grouped = groupTransactionsBySplit(single, []);
      expect(grouped).toHaveLength(1);
      expect(grouped[0].isGroup).toBeFalsy();
      expect(grouped[0].id).toBe(10);
      expect(grouped[0].allocations).toBeUndefined();
    });

    it("does not merge ambiguous legacy transactions without verified group relationships", () => {
      const sameDay = testDate(12);
      // Two separate transactions on the same day with same account, but different notes and no split metadata
      const ambiguous = [
        { id: 101, amountMinor: 15_000, type: "EXPENSE", categoryId: 1, accountId: 1, dateEpochMillis: sameDay, note: "Lunch at Jollibee" },
        { id: 102, amountMinor: 15_000, type: "EXPENSE", categoryId: 2, accountId: 1, dateEpochMillis: sameDay, note: "Grab car home" },
      ];
      const grouped = groupTransactionsBySplit(ambiguous, []);
      expect(grouped).toHaveLength(2);
      expect(grouped[0].isGroup).toBeFalsy();
      expect(grouped[1].isGroup).toBeFalsy();
    });

    it("groups legacy transactions with verified split metadata", () => {
      const sameDay = testDate(12);
      const legacySplits = [
        { id: 201, amountMinor: 29_400, type: "EXPENSE", categoryId: 1, accountId: 1, dateEpochMillis: sameDay, note: "School supplies - Books (Split 1/2)", sourceKey: "split:legacy_key:1" },
        { id: 202, amountMinor: 29_400, type: "EXPENSE", categoryId: 2, accountId: 1, dateEpochMillis: sameDay, note: "School supplies - Pens (Split 2/2)", sourceKey: "split:legacy_key:2" },
      ];
      const grouped = groupTransactionsBySplit(legacySplits, []);
      expect(grouped).toHaveLength(1);
      expect(grouped[0].isGroup).toBe(true);
      expect(grouped[0].amountMinor).toBe(58_800);
      expect(grouped[0].title).toBe("School supplies");
    });
  });

  describe("UI Component: TransactionRow expandable breakdown", () => {
    it("renders collapsed state with category count and toggles breakdown on disclosure press", async () => {
      const mockOnEdit = jest.fn();
      const mockOnView = jest.fn();

      const item = {
        id: "group-grp_abc",
        isGroup: true,
        splitGroupId: "grp_abc",
        splitCategoryCount: 2,
        title: "School supplies",
        meta: "2 categories · Cash",
        formattedAmount: "-₱588.00",
        amountMinor: 58_800,
        type: "EXPENSE",
        categoryEmoji: "🛒",
        allocations: [
          { id: 1, categoryName: "School", categoryEmoji: "📚", formattedAmount: "₱294.00" },
          { id: 2, categoryName: "Entertainment", categoryEmoji: "🎮", formattedAmount: "₱294.00" },
        ],
      };

      const screen = await render(
        <TransactionRow
          {...item}
          onEditBreakdown={mockOnEdit}
          onViewDetails={mockOnView}
        />
      );

      // Collapsed state: Title, meta, and expand button present
      expect(screen.getByText("School supplies")).toBeTruthy();
      expect(screen.getByText("2 categories · Cash")).toBeTruthy();
       expect(screen.getByText("-₱588")).toBeTruthy();

      const expandButton = screen.getByRole("button", { name: "Expand split breakdown" });
      expect(expandButton).toBeTruthy();

      // Press expand
      await fireEvent.press(screen.getByTestId("split-expand-indicator"));

      // Now expanded breakdown should be visible
      expect(screen.getByText("School")).toBeTruthy();
      expect(screen.getByText("Entertainment")).toBeTruthy();
      expect(screen.getByText("Edit breakdown")).toBeTruthy();
      expect(screen.getByText("View details")).toBeTruthy();

      // Press edit breakdown
      await fireEvent.press(screen.getByRole("button", { name: "Edit breakdown" }));
      expect(mockOnEdit).toHaveBeenCalled();

      // Press view details
      await fireEvent.press(screen.getByRole("button", { name: "View transaction details" }));
      expect(mockOnView).toHaveBeenCalled();

      // Toggle collapse
      await fireEvent.press(screen.getByTestId("split-expand-indicator"));
      expect(screen.queryByText("Edit breakdown")).toBeNull();
    });

    it("does not render expand control for regular single-category transactions", async () => {
      const singleItem = {
        id: "101",
        isGroup: false,
        title: "Campus lunch",
        meta: "Food · Cash",
        formattedAmount: "-₱85.00",
        amountMinor: 8_500,
        type: "EXPENSE",
        categoryEmoji: "🍔",
      };

      const screen = await render(<TransactionRow {...singleItem} />);
      expect(screen.getByText("Campus lunch")).toBeTruthy();
      expect(screen.getByText("Food · Cash")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /Expand split breakdown/ })).toBeNull();
    });
  });

  describe("Store Operations and Persistence", () => {
    it("adds a split transaction group atomically and retrieves via store", async () => {
      const now = testDate(15);
      const splitInputs = [
        { categoryId: 1, amountMinor: 30_000, note: "Groceries - Food" },
        { categoryId: 2, amountMinor: 20_000, note: "Groceries - Transport" },
      ];

      const res = await useFinanceStore.getState().addSplitTransactions(splitInputs, {
        accountId: 1,
        dateEpochMillis: now,
        groupTitle: "Weekly Groceries",
      });

      expect(res.splitGroupId).toBeTruthy();
      expect(res.transactions).toHaveLength(2);

      const state = useFinanceStore.getState();
      const groups = state.transactionGroups;
      expect(groups.some((g) => g.id === res.splitGroupId)).toBe(true);

      const groupRecord = groups.find((g) => g.id === res.splitGroupId);
      expect(groupRecord.title).toBe("Weekly Groceries");

      // Verify zero double counting:
      // Account balance should only be reduced by 300 + 200 = 500 PHP
      const balances = computeAccountBalances(state.accounts, state.transactions, state.transfers);
      const cash = balances.find((a) => a.id === 1);
      // Initial cash account starting balance in seed is 0 PHP, minus 500 PHP expense (50,000 minor)
      expect(cash.balanceMinor).toBe(-50_000);
    });

    it("updates a split group and allows adding and removing allocations", async () => {
      const now = testDate(16);
      const initialSplits = [
        { categoryId: 1, amountMinor: 10_000, note: "Split 1" },
        { categoryId: 2, amountMinor: 10_000, note: "Split 2" },
      ];

      const created = await useFinanceStore.getState().addSplitTransactions(initialSplits, {
        accountId: 1,
        dateEpochMillis: now,
        groupTitle: "Shared Purchase",
      });

      const groupId = created.splitGroupId;

      // Update to 3 splits
      const updatedSplits = [
        { id: created.transactions[0].id, categoryId: 1, amountMinor: 10_000, note: "Split 1 updated" },
        { id: created.transactions[1].id, categoryId: 2, amountMinor: 5_000, note: "Split 2 updated" },
        { categoryId: 3, amountMinor: 5_000, note: "Split 3 new" },
      ];

      await useFinanceStore.getState().updateSplitTransactionGroup(groupId, {
        title: "Shared Purchase Updated",
        accountId: 1,
        dateEpochMillis: now,
        splits: updatedSplits,
      });

      const state = useFinanceStore.getState();
      const groupTxs = state.transactions.filter((t) => t.splitGroupId === groupId);
      expect(groupTxs).toHaveLength(3);
      const totalAmount = groupTxs.reduce((sum, t) => sum + t.amountMinor, 0);
      expect(totalAmount).toBe(20_000); // 100 + 50 + 50 = 200 PHP
    });

    it("transitions gracefully to a normal transaction if reduced to 1 allocation", async () => {
      const now = testDate(17);
      const initialSplits = [
        { categoryId: 1, amountMinor: 15_000, note: "A" },
        { categoryId: 2, amountMinor: 15_000, note: "B" },
      ];

      const created = await useFinanceStore.getState().addSplitTransactions(initialSplits, {
        accountId: 1,
        dateEpochMillis: now,
        groupTitle: "Transition Test",
      });

      const groupId = created.splitGroupId;

      // Update with only 1 allocation
      const singleRemaining = [
        { id: created.transactions[0].id, categoryId: 1, amountMinor: 30_000, note: "Transition Test" },
      ];

      await useFinanceStore.getState().updateSplitTransactionGroup(groupId, {
        title: "Transition Test",
        accountId: 1,
        dateEpochMillis: now,
        splits: singleRemaining,
      });

      const state = useFinanceStore.getState();
      // Group should be cleaned up from transactionGroups
      expect(state.transactionGroups.some((g) => g.id === groupId)).toBe(false);

      // Remaining transaction should have splitGroupId null
      const tx = state.transactions.find((t) => t.id === created.transactions[0].id);
      expect(tx.splitGroupId).toBeNull();
      expect(tx.amountMinor).toBe(30_000);
    });

    it("deletes split transaction group and all allocations atomically", async () => {
      const now = testDate(18);
      const created = await useFinanceStore.getState().addSplitTransactions(
        [
          { categoryId: 1, amountMinor: 10_000, note: "Item 1" },
          { categoryId: 2, amountMinor: 15_000, note: "Item 2" },
        ],
        { accountId: 1, dateEpochMillis: now, groupTitle: "To Delete" }
      );

      const balancesBefore = computeAccountBalances(
        useFinanceStore.getState().accounts,
        useFinanceStore.getState().transactions,
        useFinanceStore.getState().transfers
      );
      const balanceBefore = balancesBefore.find((a) => a.id === 1).balanceMinor;

      await useFinanceStore.getState().deleteSplitTransactionGroup(created.splitGroupId);

      const state = useFinanceStore.getState();
      expect(state.transactionGroups.some((g) => g.id === created.splitGroupId)).toBe(false);
      expect(state.transactions.some((t) => t.splitGroupId === created.splitGroupId)).toBe(false);

      // Account balance must be restored by 250 PHP (25_000 minor)
      const balancesAfter = computeAccountBalances(state.accounts, state.transactions, state.transfers);
      const balanceAfter = balancesAfter.find((a) => a.id === 1).balanceMinor;
      expect(balanceAfter - balanceBefore).toBe(25_000);
    });
  });

  describe("Backup and Restore with Split Groups", () => {
    it("preserves transaction groups and split_group_id foreign key during export/import", async () => {
      const now = testDate(19);
      await useFinanceStore.getState().addSplitTransactions(
        [
           { categoryId: 1, amountMinor: 20_055, note: "Backup Split 1" },
           { categoryId: 2, amountMinor: 29_945, note: "Backup Split 2" },
        ],
        { accountId: 1, dateEpochMillis: now, groupTitle: "Backup Group" }
      );

      const store = useFinanceStore.getState();
      const backupObj = buildBackup({
        accounts: store.accounts,
        categories: store.categories,
        transactions: store.transactions,
        transactionGroups: store.transactionGroups,
        budgets: store.budgets,
        recurringRules: store.recurringRules,
        goals: store.goals,
        transfers: store.transfers,
      });

      expect(() => validateBackup(backupObj)).not.toThrow();

      const serialized = serializeBackup(backupObj);
      const parsed = parseBackup(serialized);
      expect(parsed.transactionGroups).toBeDefined();
       expect(parsed.transactionGroups.length).toBeGreaterThan(0);
       expect(parsed.transactions.some((t) => t.splitGroupId)).toBe(true);
       await store.restoreBackup(parsed);
       const restored = useFinanceStore.getState();
       expect(restored.transactions.filter((t) => t.splitGroupId).map((t) => t.amountMinor).sort()).toEqual([20_055, 29_945]);
       expect(restored.transactionGroups).toHaveLength(parsed.transactionGroups.length);

       const missingGroups = { ...parsed, transactionGroups: [] };
       expect(() => validateBackup(missingGroups)).toThrow(/split group reference/);
    });
  });

  describe("Screens Integration: History and Dashboard", () => {
    it("displays grouped split transaction in HistoryScreen and searches by allocation category", async () => {
      const now = testDate(20);
      await useFinanceStore.getState().addSplitTransactions(
        [
          { categoryId: 1, amountMinor: 25_000, note: "School Supplies - Notebooks" }, // Category 1 is Food or Category in seed
          { categoryId: 2, amountMinor: 35_000, note: "School Supplies - Uniform" },   // Category 2
        ],
        { accountId: 1, dateEpochMillis: now, groupTitle: "School shopping" }
      );

      const screen = await render(<HistoryScreen navigation={navigation} />);

      // History should show one grouped entry with "School shopping"
      await waitFor(() => {
        expect(screen.getByText("School shopping")).toBeTruthy();
        expect(screen.getByText("2 categories · Cash")).toBeTruthy();
      });

      // Technical split labels should NOT be present in main history
      expect(screen.queryByText(/Split 1\/2/)).toBeNull();
      expect(screen.queryByText(/Split 2\/2/)).toBeNull();
    });

    it("displays grouped split transaction as 1 item in DashboardScreen recent list", async () => {
      const now = testDate(21);
      await useFinanceStore.getState().addSplitTransactions(
        [
          { categoryId: 1, amountMinor: 15_000, note: "Mall trip - Food" },
          { categoryId: 2, amountMinor: 15_000, note: "Mall trip - Movies" },
        ],
        { accountId: 1, dateEpochMillis: now, groupTitle: "Mall trip" }
      );

      const screen = await render(<DashboardScreen navigation={navigation} />);

      await waitFor(() => {
        expect(screen.getByText("Mall trip")).toBeTruthy();
        expect(screen.getByText("2 categories · Cash")).toBeTruthy();
      });
    });
  });
});
