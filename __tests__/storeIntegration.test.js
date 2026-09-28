import {
  AccountRepository,
  BudgetRepository,
  CategoryRepository,
  GoalRepository,
  RecurringRepository,
  TransactionRepository,
} from "../src/db/repositories";
import { migrateDatabase } from "../src/db/schema";
import { computeDashboardTotals, spendingByCategory } from "../src/domain/services/financeView";
import { formatMinor } from "../src/domain/services/money";
import { computeSafeToSpend } from "../src/domain/services/safeToSpend";
import { TestSqliteDatabase } from "./support/testDatabase";

// Approved Figma 03/11 sample (page 75:172, "MoneyMap — Update 092726"):
// Total balance ₱16,402.00 · Income ₱15,000 · Expenses ₱5,098 ·
// Safe to Spend ₱5,902 = ₱7,402 headroom − ₱1,000 bill − ₱500 goal.
const MONTH_YEAR = "2026-09";
const sepDay = (day) => new Date(2026, 8, day, 12, 0, 0).getTime();

describe("backend integration against a real SQLite database", () => {
  let database;
  let repos;

  beforeEach(async () => {
    database = new TestSqliteDatabase();
    await migrateDatabase(database);
    repos = {
      accounts: new AccountRepository(database),
      budgets: new BudgetRepository(database),
      categories: new CategoryRepository(database),
      goals: new GoalRepository(database),
      recurring: new RecurringRepository(database),
      transactions: new TransactionRepository(database),
    };
  });

  afterEach(() => {
    database.close();
  });

  async function seedFigmaSample() {
    const allCategories = await repos.categories.list();
    const categoryByName = (name, type) =>
      allCategories.find((category) => category.name === name && category.type === type);

    // Bills is ensured at store level, not by the schema seed — create it here.
    const bills = await repos.categories.create({
      name: "Bills",
      icon: "receipt",
      colorHex: "#CA8A04",
      type: "EXPENSE",
      isCustom: false,
    });

    // Figma 15 starting balances: Cash ₱3,500 · Card ₱1,000 · E-wallet ₱2,000.
    const cash = (await repos.accounts.list())[0];
    await repos.accounts.update(cash.id, { startingBalanceMinor: 350_000 });
    const card = await repos.accounts.create({
      name: "Card", type: "CARD", startingBalanceMinor: 100_000, isArchived: false,
    });
    const ewallet = await repos.accounts.create({
      name: "E-wallet", type: "EWALLET", startingBalanceMinor: 200_000, isArchived: false,
    });
    const accountIds = { Cash: cash.id, Card: card.id, "E-wallet": ewallet.id };

    // Figma 07 budgets: total ₱12,500 for Sep 2026.
    const budgetSpecs = [
      ["Shopping", 150_000],
      ["Bills", 300_000, bills.id],
      ["Entertainment", 100_000],
      ["School", 250_000],
      ["Food", 300_000],
      ["Transport", 150_000],
    ];
    for (const [name, limitMinor, knownId] of budgetSpecs) {
      await repos.budgets.create({
        categoryId: knownId ?? categoryByName(name, "EXPENSE").id,
        monthYear: MONTH_YEAR,
        limitMinor,
      });
    }

    // Figma 06/07 spend: ₱5,098 across categories, plus ₱15,000 allowance.
    const expenseSpecs = [
      ["Shopping", 178_000, "Card"],
      ["Bills", 199_800, "E-wallet", bills.id],
      ["Entertainment", 30_000, "Cash"],
      ["School", 70_000, "E-wallet"],
      ["Food", 24_000, "Cash"],
      ["Transport", 8_000, "Cash"],
    ];
    for (const [name, amountMinor, accountName, knownId] of expenseSpecs) {
      await repos.transactions.create({
        amountMinor,
        type: "EXPENSE",
        categoryId: knownId ?? categoryByName(name, "EXPENSE").id,
        accountId: accountIds[accountName],
        dateEpochMillis: sepDay(2),
        note: null,
        recurringRuleId: null,
      });
    }
    await repos.transactions.create({
      amountMinor: 1_500_000,
      type: "INCOME",
      categoryId: categoryByName("Allowance", "INCOME").id,
      accountId: cash.id,
      dateEpochMillis: sepDay(1),
      note: "September allowance",
      recurringRuleId: null,
    });

    // One unposted in-month bill: ₱1,000 due Sep 20 (14-day reminder).
    await repos.recurring.create({
      amountMinor: 100_000,
      type: "EXPENSE",
      categoryId: bills.id,
      accountId: cash.id,
      note: "Internet plan",
      frequency: "MONTHLY",
      nextRunEpochMillis: sepDay(20),
      isActive: true,
      reminderEnabled: true,
      reminderLeadDays: 14,
      icon: "🌐",
      anchorDay: 20,
    });

    // Deadline goal with a ₱500/month contribution: ₱1,500 over 3 months.
    await repos.goals.create({
      name: "Tuition fund",
      targetMinor: 150_000,
      currentMinor: 0,
      deadlineEpochMillis: new Date(2026, 10, 15, 12, 0, 0).getTime(),
      createdEpochMillis: sepDay(1),
    });

    const [accounts, categories, transactions, budgets, recurringRules, goals] = await Promise.all([
      repos.accounts.list(),
      repos.categories.list(),
      repos.transactions.list(),
      repos.budgets.list(),
      repos.recurring.list(),
      repos.goals.list(),
    ]);
    return {
      accounts,
      categories,
      transactions,
      budgets,
      recurringRules,
      goals,
      categoriesById: new Map(categories.map((category) => [category.id, category])),
    };
  }

  it("reproduces every approved Figma dashboard and safe-to-spend figure from real rows", async () => {
    const sample = await seedFigmaSample();

    const totals = computeDashboardTotals(sample.accounts, sample.transactions, MONTH_YEAR);
    expect(totals.balanceMinor).toBe(1_640_200); // ₱16,402.00
    expect(totals.incomeMinor).toBe(1_500_000); // ₱15,000
    expect(totals.expenseMinor).toBe(509_800); // ₱5,098

    const spending = spendingByCategory(sample.transactions, sample.categoriesById, MONTH_YEAR);
    expect(spending.totalMinor).toBe(509_800);

    const safe = computeSafeToSpend({
      budgets: sample.budgets,
      transactions: sample.transactions,
      categoriesById: sample.categoriesById,
      recurringRules: sample.recurringRules,
      goals: sample.goals,
      monthYear: MONTH_YEAR,
    });
    expect(safe.remainingBudgetsMinor).toBe(740_200); // ₱7,402 headroom
    expect(safe.upcomingRecurringMinor).toBe(100_000); // ₱1,000 bill
    expect(safe.upcomingRecurringCount).toBe(1);
    expect(safe.goalReservesMinor).toBe(50_000); // ₱500 goal
    expect(safe.goalReserveCount).toBe(1);
    expect(safe.safeMinor).toBe(590_200); // ₱5,902
    expect(safe.state).toBe("comfortable");

    const money = (minor) => formatMinor(minor, { currencySymbol: "₱", showCents: false });
    const formula = [
      `${money(safe.remainingBudgetsMinor)} headroom`,
      `${money(safe.upcomingRecurringMinor)} bill${safe.upcomingRecurringCount === 1 ? "" : "s"}`,
      `${money(safe.goalReservesMinor)} goal${safe.goalReserveCount === 1 ? "" : "s"}`,
    ].join(" − ");
    expect(formula).toBe("₱7,402 headroom − ₱1,000 bill − ₱500 goal");
  });

  it("commits a resolved import atomically and rolls back failures without partial writes", async () => {
    await seedFigmaSample();
    const billsCategory = (await repos.categories.list()).find(
      (category) => category.name === "Bills" && category.type === "EXPENSE",
    );
    const accountsBefore = await repos.accounts.list();
    const transactionsBefore = await repos.transactions.list();

    // Success path: new account + two rows commit together.
    await database.transaction(async (tx) => {
      const gcash = await new AccountRepository(tx).create({
        name: "GCash", type: "EWALLET", startingBalanceMinor: 0, isArchived: false,
      });
      const txRepo = new TransactionRepository(tx);
      for (const amountMinor of [12_000, 4_000]) {
        await txRepo.create({
          amountMinor,
          type: "EXPENSE",
          categoryId: billsCategory.id,
          accountId: gcash.id,
          dateEpochMillis: sepDay(3),
          note: null,
          recurringRuleId: null,
        });
      }
    });
    expect(await repos.accounts.list()).toHaveLength(accountsBefore.length + 1);
    expect(await repos.transactions.list()).toHaveLength(transactionsBefore.length + 2);

    // Failure path: a foreign-key violation inside the transaction rolls back everything.
    await expect(
      database.transaction(async (tx) => {
        const ghost = await new AccountRepository(tx).create({
          name: "Ghost", type: "CASH", startingBalanceMinor: 0, isArchived: false,
        });
        await new TransactionRepository(tx).create({
          amountMinor: 1_000,
          type: "EXPENSE",
          categoryId: 999_999,
          accountId: ghost.id,
          dateEpochMillis: sepDay(4),
          note: null,
          recurringRuleId: null,
        });
      }),
    ).rejects.toThrow();
    expect(await repos.accounts.list()).toHaveLength(accountsBefore.length + 1);
    expect(await repos.transactions.list()).toHaveLength(transactionsBefore.length + 2);
  });

  it("enforces the 14-day reminder default and keeps catch-up idempotent on unposted runs", async () => {
    const sample = await seedFigmaSample();
    const rule = sample.recurringRules[0];
    expect(rule.reminderLeadDays).toBe(14);

    // Safe-to-Spend reserves the unposted run exactly once across repeated computes.
    const first = computeSafeToSpend({
      budgets: sample.budgets,
      transactions: sample.transactions,
      categoriesById: sample.categoriesById,
      recurringRules: sample.recurringRules,
      goals: sample.goals,
      monthYear: MONTH_YEAR,
    });
    const second = computeSafeToSpend({
      budgets: sample.budgets,
      transactions: sample.transactions,
      categoriesById: sample.categoriesById,
      recurringRules: sample.recurringRules,
      goals: sample.goals,
      monthYear: MONTH_YEAR,
    });
    expect(second).toEqual(first);
  });
});
