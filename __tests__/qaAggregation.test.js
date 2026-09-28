import { buildBudgetCards } from "../src/domain/services/financeView";
import { computeSafeToSpend } from "../src/domain/services/safeToSpend";

describe("QA aggregation accuracy at ledger scale", () => {
  it("keeps exact per-category totals across 100 budgets and 10000 mixed-month rows", () => {
    const categoriesById = new Map(Array.from({ length: 100 }, (_, index) => [index + 1, { id: index + 1, name: `Category ${index}`, type: "EXPENSE" }]));
    const budgets = Array.from({ length: 100 }, (_, index) => ({ id: index + 1, categoryId: index + 1, monthYear: "2026-09", limitMinor: 100_000 }));
    const transactions = Array.from({ length: 10_000 }, (_, index) => ({
      id: index + 1, categoryId: index % 100 + 1, amountMinor: index % 97 + 1,
      type: index % 3 === 0 ? "INCOME" : "EXPENSE", dateEpochMillis: new Date(2026, index % 5 === 0 ? 7 : 8, 15, 12).getTime(), recurringRuleId: null,
    }));
    const expected = new Map();
    for (let index = 0; index < 10_000; index++) {
      if (index % 3 !== 0 && index % 5 !== 0) expected.set(index % 100 + 1, (expected.get(index % 100 + 1) ?? 0) + index % 97 + 1);
    }
    const cards = buildBudgetCards(budgets, transactions, categoriesById, "2026-09");
    for (const card of cards) {
      const categoryId = Number(card.name.split(" ")[1]) + 1;
      expect(card.spentMinor).toBe(expected.get(categoryId) ?? 0);
    }
    expect(computeSafeToSpend({ budgets, transactions, categoriesById, recurringRules: [], goals: [], monthYear: "2026-09" }).safeMinor).toBe(10_000_000 - [...expected.values()].reduce((sum, minor) => sum + minor, 0));
  });

  it("indexes posted runs by rule and date without hiding another rule's commitment", () => {
    const date = new Date(2026, 8, 15, 12).getTime();
    const base = { isActive: true, type: "EXPENSE", nextRunEpochMillis: date, frequency: "MONTHLY", amountMinor: 100, anchorDay: 15 };
    const result = computeSafeToSpend({ budgets: [], categoriesById: new Map(), goals: [], monthYear: "2026-09",
      recurringRules: [{ ...base, id: 1 }, { ...base, id: 2 }],
      transactions: [{ recurringRuleId: 1, dateEpochMillis: date, amountMinor: 100, type: "EXPENSE" }],
    });
    expect(result.upcomingRecurringCount).toBe(1);
    expect(result.upcomingRecurringMinor).toBe(100);
  });
});
