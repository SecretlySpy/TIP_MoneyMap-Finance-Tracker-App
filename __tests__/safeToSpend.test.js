import { computeSafeToSpend } from "../src/domain/services/safeToSpend";

const categoriesById = new Map([
  [1, { id: 1, name: "Food", icon: "restaurant", colorHex: "#EA580C", type: "EXPENSE", isCustom: false }],
]);

describe("computeSafeToSpend", () => {
  const monthYear = "2026-08";

  it("subtracts unposted bills and this month's deadline-based goal contribution", () => {
    const result = computeSafeToSpend({
      monthYear,
      categoriesById,
      budgets: [{ id: 1, categoryId: 1, monthYear, limitMinor: 500_000 }],
      transactions: [
        {
          id: 1,
          amountMinor: 100_000,
          type: "EXPENSE",
          categoryId: 1,
          accountId: 1,
          dateEpochMillis: new Date(2026, 7, 5).getTime(),
          note: null,
          recurringRuleId: null,
        },
      ],
      recurringRules: [
        {
          id: 9,
          amountMinor: 50_000,
          type: "EXPENSE",
          categoryId: 1,
          accountId: 1,
          note: "Internet",
          frequency: "MONTHLY",
          nextRunEpochMillis: new Date(2026, 7, 20).getTime(),
          isActive: true,
          reminderEnabled: false,
          reminderLeadDays: 3,
          frequency: "MONTHLY",
        },
      ],
      goals: [
        {
          id: 1,
          name: "Laptop",
          targetMinor: 200_000,
          currentMinor: 50_000,
          deadlineEpochMillis: new Date(2026, 9, 1).getTime(),
          isArchived: false,
          createdEpochMillis: 1,
        },
      ],
      nowEpochMillis: new Date(2026, 7, 10).getTime(),
    });

    // Laptop needs 150_000 over Aug/Sep/Oct: this month's contribution is 50_000.
    expect(result.remainingBudgetsMinor).toBe(400_000);
    expect(result.upcomingRecurringMinor).toBe(50_000);
    expect(result.goalReservesMinor).toBe(50_000);
    expect(result.safeMinor).toBe(300_000);
    expect(result.overCommittedMinor).toBe(0);
    expect(result.state).toBe("comfortable");
  });

  it("marks over when bills + goals exceed remaining budgets", () => {
    const result = computeSafeToSpend({
      monthYear,
      categoriesById,
      budgets: [{ id: 1, categoryId: 1, monthYear, limitMinor: 100_000 }],
      transactions: [],
      recurringRules: [
        {
          id: 1,
          amountMinor: 80_000,
          type: "EXPENSE",
          categoryId: 1,
          accountId: 1,
          note: null,
          frequency: "MONTHLY",
          nextRunEpochMillis: new Date(2026, 7, 15).getTime(),
          isActive: true,
          reminderEnabled: false,
          reminderLeadDays: 1,
          frequency: "MONTHLY",
        },
      ],
      goals: [
        {
          id: 1,
          name: "Emergency",
          targetMinor: 50_000,
          currentMinor: 0,
          deadlineEpochMillis: new Date(2026, 7, 31).getTime(),
          isArchived: false,
          createdEpochMillis: 1,
        },
      ],
      nowEpochMillis: new Date(2026, 7, 1).getTime(),
    });
    expect(result.safeMinor).toBe(0);
    expect(result.overCommittedMinor).toBe(30_000);
    expect(result.state).toBe("over");
  });

  it("does not reserve an open-ended goal without a monthly deadline commitment", () => {
    const result = computeSafeToSpend({
      monthYear,
      categoriesById,
      budgets: [{ id: 1, categoryId: 1, monthYear, limitMinor: 100_000 }],
      transactions: [],
      recurringRules: [],
      goals: [{
        id: 1,
        name: "Emergency fund",
        targetMinor: 1_000_000,
        currentMinor: 0,
        deadlineEpochMillis: null,
        isArchived: false,
        createdEpochMillis: 1,
      }],
    });

    expect(result.goalReservesMinor).toBe(0);
    expect(result.safeMinor).toBe(100_000);
  });

  it("does not count an already-posted recurring occurrence twice", () => {
    const runEpochMillis = new Date(2026, 7, 20).getTime();
    const result = computeSafeToSpend({
      monthYear,
      categoriesById,
      budgets: [{ id: 1, categoryId: 1, monthYear, limitMinor: 100_000 }],
      transactions: [{
        id: 1,
        amountMinor: 20_000,
        type: "EXPENSE",
        categoryId: 1,
        accountId: 1,
        dateEpochMillis: runEpochMillis,
        note: "Internet",
        recurringRuleId: 9,
      }],
      recurringRules: [{
        id: 9,
        amountMinor: 20_000,
        type: "EXPENSE",
        nextRunEpochMillis: runEpochMillis,
        frequency: "MONTHLY",
        isActive: true,
      }],
      goals: [],
    });

    expect(result.remainingBudgetsMinor).toBe(80_000);
    expect(result.upcomingRecurringMinor).toBe(0);
    expect(result.safeMinor).toBe(80_000);
  });

  it("counts each unposted weekly bill occurrence due in the selected month", () => {
    const result = computeSafeToSpend({
      monthYear,
      categoriesById,
      budgets: [{ id: 1, categoryId: 1, monthYear, limitMinor: 100_000 }],
      transactions: [],
      recurringRules: [{
        id: 4,
        amountMinor: 5_000,
        type: "EXPENSE",
        nextRunEpochMillis: new Date(2026, 7, 3).getTime(),
        frequency: "WEEKLY",
        isActive: true,
      }],
      goals: [],
    });

    expect(result.upcomingRecurringMinor).toBe(25_000);
    expect(result.safeMinor).toBe(75_000);
  });
});
