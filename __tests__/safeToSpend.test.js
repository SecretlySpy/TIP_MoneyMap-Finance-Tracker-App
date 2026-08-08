import { computeSafeToSpend } from "../src/domain/services/safeToSpend";

const categoriesById = new Map([
  [1, { id: 1, name: "Food", icon: "restaurant", colorHex: "#EA580C", type: "EXPENSE", isCustom: false }],
]);

describe("computeSafeToSpend", () => {
  const monthYear = "2026-08";

  it("subtracts upcoming bills and goal reserves from remaining budgets", () => {
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
        },
      ],
      goals: [
        {
          id: 1,
          name: "Laptop",
          targetMinor: 200_000,
          currentMinor: 50_000,
          deadlineEpochMillis: null,
          isArchived: false,
          createdEpochMillis: 1,
        },
      ],
      nowEpochMillis: new Date(2026, 7, 10).getTime(),
    });

    // remaining budgets 400_000 - bills 50_000 - goals 150_000 = 200_000
    expect(result.remainingBudgetsMinor).toBe(400_000);
    expect(result.upcomingRecurringMinor).toBe(50_000);
    expect(result.goalReservesMinor).toBe(150_000);
    expect(result.safeMinor).toBe(200_000);
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
        },
      ],
      goals: [
        {
          id: 1,
          name: "Emergency",
          targetMinor: 50_000,
          currentMinor: 0,
          deadlineEpochMillis: null,
          isArchived: false,
          createdEpochMillis: 1,
        },
      ],
      nowEpochMillis: new Date(2026, 7, 1).getTime(),
    });
    // remaining 100k, bills 80k, goals capped to 100k → safe = 100k - 80k - 100k = -80k
    expect(result.safeMinor).toBeLessThanOrEqual(0);
    expect(result.state).toBe("over");
  });
});
