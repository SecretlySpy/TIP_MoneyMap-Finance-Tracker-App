import { computeCategoryRollover, getBudgetsToCopy, SEMESTER_TEMPLATES } from "../src/domain/services/rollover";
import { detectRecurringCandidates, normalizeMerchant } from "../src/domain/services/recurringDetection";
import { computeCashFlowTrends, calculateDebtPayoffSchedule } from "../src/domain/services/reports";

describe("Roadmap Services", () => {
  describe("Budget Rollover and Semester Templates", () => {
    it("computes positive surplus carry-forward when under budget", () => {
      const budgets = [
        { categoryId: 1, monthYear: "2026-06", limitMinor: 500_000 },
        { categoryId: 1, monthYear: "2026-07", limitMinor: 500_000 },
      ];
      const transactions = [
        {
          id: 1,
          type: "EXPENSE",
          categoryId: 1,
          amountMinor: 350_000,
          dateEpochMillis: new Date(2026, 5, 10).getTime(),
        },
      ];

      const result = computeCategoryRollover({
        categoryId: 1,
        monthYear: "2026-07",
        budgets,
        transactions,
      });

      expect(result.hasPriorBudget).toBe(true);
      expect(result.priorCarryMinor).toBe(150_000); // 5,000 - 3,500 = +1,500 surplus
      expect(result.effectiveLimitMinor).toBe(650_000); // 5,000 + 1,500 = 6,500
    });

    it("computes negative deficit carry-forward when over budget", () => {
      const budgets = [
        { categoryId: 1, monthYear: "2026-06", limitMinor: 200_000 },
        { categoryId: 1, monthYear: "2026-07", limitMinor: 300_000 },
      ];
      const transactions = [
        {
          id: 1,
          type: "EXPENSE",
          categoryId: 1,
          amountMinor: 280_000,
          dateEpochMillis: new Date(2026, 5, 15).getTime(),
        },
      ];

      const result = computeCategoryRollover({
        categoryId: 1,
        monthYear: "2026-07",
        budgets,
        transactions,
      });

      expect(result.hasPriorBudget).toBe(true);
      expect(result.priorCarryMinor).toBe(-80_000); // 2,000 - 2,800 = -800 deficit
      expect(result.effectiveLimitMinor).toBe(220_000); // 3,000 - 800 = 2,200
    });

    it("identifies budgets to copy from previous month without duplicates", () => {
      const budgets = [
        { categoryId: 1, monthYear: "2026-06", limitMinor: 500_000 },
        { categoryId: 2, monthYear: "2026-06", limitMinor: 200_000 },
        { categoryId: 1, monthYear: "2026-07", limitMinor: 600_000 }, // already exists in July
      ];

      const toCopy = getBudgetsToCopy({
        fromMonthYear: "2026-06",
        toMonthYear: "2026-07",
        budgets,
      });

      expect(toCopy).toHaveLength(1);
      expect(toCopy[0].categoryId).toBe(2);
    });

    it("provides predefined student semester templates", () => {
      expect(SEMESTER_TEMPLATES.length).toBeGreaterThanOrEqual(3);
      const standard = SEMESTER_TEMPLATES.find((t) => t.id === "standard-student");
      expect(standard).toBeDefined();
      expect(standard.categories.some((c) => c.name === "Food")).toBe(true);
    });
  });

  describe("Recurring Charge Detection", () => {
    it("detects monthly recurring charges with similar amounts", () => {
      const now = new Date(2026, 6, 15).getTime();
      const transactions = [
        {
          id: 1,
          type: "EXPENSE",
          accountId: 1,
          categoryId: 10,
          note: "Spotify Premium",
          amountMinor: 14_900,
          dateEpochMillis: new Date(2026, 4, 15).getTime(),
        },
        {
          id: 2,
          type: "EXPENSE",
          accountId: 1,
          categoryId: 10,
          note: "Spotify Premium",
          amountMinor: 14_900,
          dateEpochMillis: new Date(2026, 5, 15).getTime(),
        },
        {
          id: 3,
          type: "EXPENSE",
          accountId: 1,
          categoryId: 10,
          note: "Spotify Premium",
          amountMinor: 14_900,
          dateEpochMillis: new Date(2026, 6, 15).getTime(),
        },
      ];

      const candidates = detectRecurringCandidates({
        transactions,
        recurringRules: [],
      });

      expect(candidates).toHaveLength(1);
      expect(candidates[0].merchant).toBe("Spotify Premium");
      expect(candidates[0].frequency).toBe("MONTHLY");
      expect(candidates[0].occurrenceCount).toBe(3);
      expect(candidates[0].hasPriceChange).toBe(false);
    });

    it("flags price change when latest amount differs from previous average", () => {
      const transactions = [
        {
          id: 1,
          type: "EXPENSE",
          accountId: 1,
          note: "Canva Pro",
          amountMinor: 29_900,
          dateEpochMillis: new Date(2026, 4, 1).getTime(),
        },
        {
          id: 2,
          type: "EXPENSE",
          accountId: 1,
          note: "Canva Pro",
          amountMinor: 29_900,
          dateEpochMillis: new Date(2026, 5, 1).getTime(),
        },
        {
          id: 3,
          type: "EXPENSE",
          accountId: 1,
          note: "Canva Pro",
          amountMinor: 39_900, // Price increased!
          dateEpochMillis: new Date(2026, 6, 1).getTime(),
        },
      ];

      const candidates = detectRecurringCandidates({
        transactions,
        recurringRules: [],
      });

      expect(candidates).toHaveLength(1);
      expect(candidates[0].hasPriceChange).toBe(true);
      expect(candidates[0].priceChangeDifferenceMinor).toBe(10_000);
    });

    it("skips candidates that are already registered as recurring rules", () => {
      const transactions = [
        {
          id: 1,
          type: "EXPENSE",
          accountId: 1,
          note: "Netflix",
          amountMinor: 54_900,
          dateEpochMillis: new Date(2026, 4, 20).getTime(),
        },
        {
          id: 2,
          type: "EXPENSE",
          accountId: 1,
          note: "Netflix",
          amountMinor: 54_900,
          dateEpochMillis: new Date(2026, 5, 20).getTime(),
        },
      ];

      const candidates = detectRecurringCandidates({
        transactions,
        recurringRules: [{ id: 99, note: "Netflix", frequency: "MONTHLY" }],
      });

      expect(candidates).toHaveLength(0);
    });
  });

  describe("Reports and Debt Payoff", () => {
    it("computes monthly cash flow trends excluding transfers", () => {
      const transactions = [
        {
          id: 1,
          type: "INCOME",
          amountMinor: 200_000,
          dateEpochMillis: new Date(2026, 6, 1).getTime(),
        },
        {
          id: 2,
          type: "EXPENSE",
          amountMinor: 80_000,
          dateEpochMillis: new Date(2026, 6, 5).getTime(),
        },
      ];

      const trends = computeCashFlowTrends({
        transactions,
        months: 2,
        endMonthYear: "2026-07",
      });

      expect(trends).toHaveLength(2);
      const july = trends.find((t) => t.monthYear === "2026-07");
      expect(july.incomeMinor).toBe(200_000);
      expect(july.expenseMinor).toBe(80_000);
      expect(july.netSavingsMinor).toBe(120_000);
      expect(july.savingsRatePercent).toBe(60);
    });

    it("calculates 0% installment payoff schedule for student gadget plan", () => {
      const result = calculateDebtPayoffSchedule({
        principalMinor: 120_000, // ₱1,200.00 gadget balance
        annualInterestRatePercent: 0, // 0% interest promo
        monthlyPaymentMinor: 40_000, // ₱400.00 / month
      });

      expect(result.canPayoff).toBe(true);
      expect(result.monthsToPayoff).toBe(3);
      expect(result.totalInterestMinor).toBe(0);
      expect(result.totalPaidMinor).toBe(120_000);
    });

    it("calculates interest-bearing debt payoff and total interest paid", () => {
      const result = calculateDebtPayoffSchedule({
        principalMinor: 100_000, // ₱1,000.00
        annualInterestRatePercent: 24, // 24% APR (2% per month)
        monthlyPaymentMinor: 25_000, // ₱250.00 / month
      });

      expect(result.canPayoff).toBe(true);
      expect(result.monthsToPayoff).toBeGreaterThan(4);
      expect(result.totalInterestMinor).toBeGreaterThan(0);
      expect(result.totalPaidMinor).toBe(100_000 + result.totalInterestMinor);
    });

    it("rejects insufficient payment that cannot cover monthly interest", () => {
      const result = calculateDebtPayoffSchedule({
        principalMinor: 1_000_000, // ₱10,000.00
        annualInterestRatePercent: 24, // 2% / month = ₱200.00 interest / month
        monthlyPaymentMinor: 10_000, // ₱100.00 / month (less than interest)
      });

      expect(result.canPayoff).toBe(false);
      expect(result.error).toContain("too low");
    });
  });
});
