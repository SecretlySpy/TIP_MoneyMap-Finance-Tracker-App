import {
  computeDailyAllowanceMinor,
  daysLeftInMonth,
  deriveSmartTips,
} from "../src/domain/services/tips";

const categories = [
  { id: 1, name: "Food", icon: "restaurant", colorHex: "#EA580C", type: "EXPENSE", isCustom: false },
  { id: 2, name: "Transport", icon: "bus", colorHex: "#2563EB", type: "EXPENSE", isCustom: false },
  { id: 3, name: "Shopping", icon: "bag", colorHex: "#DB2777", type: "EXPENSE", isCustom: false },
];
const categoriesById = new Map(categories.map((category) => [category.id, category]));

function at(year, monthIndex, day, hour = 12) {
  return new Date(year, monthIndex, day, hour, 0, 0, 0).getTime();
}

describe("daysLeftInMonth / daily allowance", () => {
  it("counts inclusive days left in the current month", () => {
    const now = new Date(2026, 7, 20, 9); // Aug 20 — Aug has 31 days
    expect(daysLeftInMonth("2026-08", now)).toBe(12);
    expect(daysLeftInMonth("2026-07", now)).toBe(0);
    expect(daysLeftInMonth("2026-09", now)).toBe(30);
  });

  it("computes daily allowance from remaining minor units", () => {
    expect(computeDailyAllowanceMinor(12_000, 10)).toBe(1_200);
    expect(computeDailyAllowanceMinor(0, 10)).toBe(0);
    expect(computeDailyAllowanceMinor(5_000, 0)).toBe(0);
  });
});

describe("deriveSmartTips", () => {
  const now = new Date(2026, 7, 15, 12); // Aug 15
  const monthYear = "2026-08";

  it("derives daily allowance and food per-day tips from budgets", () => {
    const budgets = [
      { id: 1, categoryId: 1, monthYear, limitMinor: 300_000 },
      { id: 2, categoryId: 2, monthYear, limitMinor: 100_000 },
    ];
    const transactions = [
      {
        id: 1,
        amountMinor: 100_000,
        type: "EXPENSE",
        categoryId: 1,
        accountId: 1,
        dateEpochMillis: at(2026, 7, 5),
        note: "Lunch",
        recurringRuleId: null,
      },
      {
        id: 2,
        amountMinor: 20_000,
        type: "EXPENSE",
        categoryId: 2,
        accountId: 1,
        dateEpochMillis: at(2026, 7, 6),
        note: "Jeep",
        recurringRuleId: null,
      },
    ];

    const snapshot = deriveSmartTips({
      budgets,
      transactions,
      categories: categoriesById,
      monthYear,
      now,
    });

    expect(snapshot.limitMinor).toBe(400_000);
    expect(snapshot.spentMinor).toBe(120_000);
    expect(snapshot.remainingMinor).toBe(280_000);
    expect(snapshot.daysLeftInMonth).toBe(17);
    expect(snapshot.dailyAllowanceMinor).toBe(Math.ceil(280_000 / 17));
    expect(snapshot.tips.some((tip) => tip.id === "daily-allowance")).toBe(true);
    expect(snapshot.tips.some((tip) => tip.id === "food-daily")).toBe(true);
    // No fetch / network side effects — pure result only.
    expect(snapshot.tips.every((tip) => typeof tip.id === "string")).toBe(true);
  });

  it("flags a category trending over budget", () => {
    const budgets = [{ id: 1, categoryId: 3, monthYear, limitMinor: 50_000 }];
    // Heavy spend early in month → projected over
    const transactions = [
      {
        id: 1,
        amountMinor: 40_000,
        type: "EXPENSE",
        categoryId: 3,
        accountId: 1,
        dateEpochMillis: at(2026, 7, 2),
        note: "Mall",
        recurringRuleId: null,
      },
    ];
    const snapshot = deriveSmartTips({
      budgets,
      transactions,
      categories: categoriesById,
      monthYear,
      now,
    });
    const pace = snapshot.tips.find((tip) => tip.id.startsWith("pace-"));
    expect(pace).toBeDefined();
    expect(pace.title).toMatch(/Shopping/i);
  });

  it("surfaces repeated small expenses as a monthly total", () => {
    const transactions = [1, 2, 3, 4, 5].map((day) => ({
      id: day,
      amountMinor: 15_000,
      type: "EXPENSE",
      categoryId: 1,
      accountId: 1,
      dateEpochMillis: at(2026, 7, day),
      note: "Coffee",
      recurringRuleId: null,
    }));
    const snapshot = deriveSmartTips({
      budgets: [],
      transactions,
      categories: categoriesById,
      monthYear,
      now,
    });
    const repeat = snapshot.tips.find((tip) => tip.id === "repeat-small");
    expect(repeat).toBeDefined();
    expect(repeat.tag.amountMinor).toBe(75_000);
  });

  it("compares category spend to the previous period", () => {
    const transactions = [
      {
        id: 1,
        amountMinor: 30_000,
        type: "EXPENSE",
        categoryId: 2,
        accountId: 1,
        dateEpochMillis: at(2026, 6, 10), // July
        note: null,
        recurringRuleId: null,
      },
      {
        id: 2,
        amountMinor: 80_000,
        type: "EXPENSE",
        categoryId: 2,
        accountId: 1,
        dateEpochMillis: at(2026, 7, 10), // August
        note: null,
        recurringRuleId: null,
      },
    ];
    const snapshot = deriveSmartTips({
      budgets: [],
      transactions,
      categories: categoriesById,
      monthYear,
      now,
    });
    const compare = snapshot.tips.find((tip) => tip.id.startsWith("compare-"));
    expect(compare).toBeDefined();
    expect(compare.title).toMatch(/Transport/);
    expect(compare.meta.amountMinor).toBe(50_000);
    expect(compare.tag).toBe("Watch it");
  });

  it("returns a get-started tip when there is no usable data", () => {
    const snapshot = deriveSmartTips({
      budgets: [],
      transactions: [],
      categories: categoriesById,
      monthYear,
      now,
    });
    expect(snapshot.tips.some((tip) => tip.id === "empty-data")).toBe(true);
  });
});
