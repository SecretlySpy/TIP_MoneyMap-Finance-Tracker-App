/**
 * Regression tests for the defects found in the QA audit.
 * Each block cites the finding it pins; all of them fail against the pre-audit code.
 */
import { spendingByCategory } from "../src/domain/services/financeView";
import { computeSafeToSpend } from "../src/domain/services/safeToSpend";
import { buildBackup, parseBackup, serializeBackup } from "../src/services/dataTransfer";
import { parseDecimalToMinor } from "../src/domain/services/money";
import { pinLockoutSeconds, PIN_FREE_ATTEMPTS } from "../src/services/appLock";
import { advanceNextRunEpochMillis } from "../src/domain/services/recurringCatchUp";

const MONTH = "2026-08";
const at = (day) => new Date(2026, 7, day, 12, 0, 0, 0).getTime();

describe("A3 - spendingByCategory does not double-count a category named Other", () => {
  // "Other" is one of the seeded default categories, so this is the common case,
  // not an exotic one: any month with 4+ spending categories hit it.
  const categoriesById = new Map([
    [1, { id: 1, name: "Food", type: "EXPENSE" }],
    [2, { id: 2, name: "Transport", type: "EXPENSE" }],
    [3, { id: 3, name: "Other", type: "EXPENSE" }],
    [4, { id: 4, name: "Health", type: "EXPENSE" }],
    [5, { id: 5, name: "Fun", type: "EXPENSE" }],
  ]);
  const transactions = [
    { id: 1, categoryId: 1, type: "EXPENSE", amountMinor: 5000, dateEpochMillis: at(1) },
    { id: 2, categoryId: 2, type: "EXPENSE", amountMinor: 3000, dateEpochMillis: at(2) },
    { id: 3, categoryId: 3, type: "EXPENSE", amountMinor: 2000, dateEpochMillis: at(3) },
    { id: 4, categoryId: 4, type: "EXPENSE", amountMinor: 1000, dateEpochMillis: at(4) },
    { id: 5, categoryId: 5, type: "EXPENSE", amountMinor: 500, dateEpochMillis: at(5) },
  ];

  it("segments sum to the real month total", () => {
    const result = spendingByCategory(transactions, categoriesById, MONTH);
    expect(result.totalMinor).toBe(11500);
    const segmentSum = result.segments.reduce((sum, s) => sum + s.spentMinor, 0);
    // Was 13500 before the fix: the appended "Other" row was summed on top of itself.
    expect(segmentSum).toBe(11500);
  });

  it("percentages total exactly 100", () => {
    const result = spendingByCategory(transactions, categoriesById, MONTH);
    const percentSum = result.segments.reduce((sum, s) => sum + s.percent, 0);
    expect(percentSum).toBe(100); // was 117
  });

  it("the Other slice reports only its own spend plus the tail", () => {
    const result = spendingByCategory(transactions, categoriesById, MONTH);
    const other = result.segments.find((s) => s.label === "Other");
    // 2000 (the real Other category) + 1000 + 500 (the tail folded in) = 3500.
    expect(other.spentMinor).toBe(3500); // was 5500
  });

  it("still folds the tail correctly when no category is named Other", () => {
    const plain = new Map([
      [1, { id: 1, name: "Food" }],
      [2, { id: 2, name: "Transport" }],
      [3, { id: 3, name: "Books" }],
      [4, { id: 4, name: "Health" }],
    ]);
    const rows = [
      { id: 1, categoryId: 1, type: "EXPENSE", amountMinor: 4000, dateEpochMillis: at(1) },
      { id: 2, categoryId: 2, type: "EXPENSE", amountMinor: 3000, dateEpochMillis: at(2) },
      { id: 3, categoryId: 3, type: "EXPENSE", amountMinor: 2000, dateEpochMillis: at(3) },
      { id: 4, categoryId: 4, type: "EXPENSE", amountMinor: 1000, dateEpochMillis: at(4) },
    ];
    const result = spendingByCategory(rows, plain, MONTH);
    expect(result.segments.reduce((s, x) => s + x.spentMinor, 0)).toBe(10000);
    expect(result.segments.find((s) => s.label === "Other").spentMinor).toBe(1000);
  });
});

describe("A4 - a brand-new user is not told they are over committed", () => {
  it("reports the unset state when nothing has been configured", () => {
    const result = computeSafeToSpend({
      budgets: [],
      transactions: [],
      categoriesById: new Map(),
      recurringRules: [],
      goals: [],
      monthYear: MONTH,
    });
    expect(result.safeMinor).toBe(0);
    expect(result.state).toBe("unset"); // was "over"
  });

  it("still reports over when real commitments exceed the budget", () => {
    const categoriesById = new Map([[1, { id: 1, name: "Food", type: "EXPENSE" }]]);
    const result = computeSafeToSpend({
      budgets: [{ id: 1, categoryId: 1, monthYear: MONTH, limitMinor: 10000 }],
      transactions: [
        { id: 1, categoryId: 1, type: "EXPENSE", amountMinor: 9000, dateEpochMillis: at(2) },
      ],
      categoriesById,
      recurringRules: [
        { id: 1, isActive: true, type: "EXPENSE", amountMinor: 5000, nextRunEpochMillis: at(20) },
      ],
      goals: [],
      monthYear: MONTH,
      nowEpochMillis: at(10),
    });
    expect(result.state).toBe("over");
  });

  it("reports comfortable when there is genuine headroom", () => {
    const categoriesById = new Map([[1, { id: 1, name: "Food", type: "EXPENSE" }]]);
    const result = computeSafeToSpend({
      budgets: [{ id: 1, categoryId: 1, monthYear: MONTH, limitMinor: 100000 }],
      transactions: [
        { id: 1, categoryId: 1, type: "EXPENSE", amountMinor: 1000, dateEpochMillis: at(2) },
      ],
      categoriesById,
      recurringRules: [],
      goals: [],
      monthYear: MONTH,
      nowEpochMillis: at(10),
    });
    expect(result.state).toBe("comfortable");
  });
});

describe("A1 - savings goals survive a backup/restore round trip", () => {
  const snapshot = {
    accounts: [
      { id: 1, name: "Cash", type: "CASH", startingBalanceMinor: 0, isArchived: false },
    ],
    categories: [
      {
        id: 1, name: "Food", icon: "restaurant", colorHex: "#EA580C",
        type: "EXPENSE", isCustom: false,
      },
    ],
    transactions: [],
    budgets: [],
    recurringRules: [],
    goals: [
      {
        id: 1, name: "New laptop", targetMinor: 5000000, currentMinor: 125000,
        deadlineEpochMillis: at(28), isArchived: false, createdEpochMillis: at(1),
      },
    ],
  };

  it("buildBackup serializes goals", () => {
    const backup = buildBackup(snapshot);
    // Previously absent entirely, while restoreBackup still ran DELETE FROM savings_goals.
    expect(backup.goals).toHaveLength(1);
    expect(backup.goals[0].name).toBe("New laptop");
  });

  it("survives serialize then parse without losing goal fields", () => {
    const parsed = parseBackup(serializeBackup(buildBackup(snapshot)));
    expect(parsed.goals).toHaveLength(1);
    expect(parsed.goals[0]).toMatchObject({
      name: "New laptop",
      targetMinor: 5000000,
      currentMinor: 125000,
      deadlineEpochMillis: at(28),
    });
  });

  it("still accepts an older backup written before goals existed", () => {
    const legacy = JSON.stringify({
      format: "moneymap-backup",
      version: 1,
      exportedAtIso: new Date().toISOString(),
      accounts: snapshot.accounts,
      categories: snapshot.categories,
      transactions: [],
      budgets: [],
      recurringRules: [],
    });
    const parsed = parseBackup(legacy);
    expect(parsed.goals).toEqual([]); // absent, not a parse failure
  });

  it("tolerates a snapshot with no goals key", () => {
    const backup = buildBackup({ ...snapshot, goals: undefined });
    expect(backup.goals).toEqual([]);
  });
});

describe("A10 - a monthly bill keeps its intended day of month", () => {
  it("returns to the 31st after a short February", () => {
    const jan31 = new Date(2026, 0, 31, 10).getTime();
    const feb = advanceNextRunEpochMillis(jan31, "MONTHLY", 31);
    expect(new Date(feb).getDate()).toBe(28);
    const mar = advanceNextRunEpochMillis(feb, "MONTHLY", 31);
    // Without the anchor this drifted to Mar 28 and never recovered.
    expect(new Date(mar).getDate()).toBe(31);
  });

  it("clamps to 30 in a 30-day month and still recovers", () => {
    const mar31 = new Date(2026, 2, 31, 10).getTime();
    const apr = advanceNextRunEpochMillis(mar31, "MONTHLY", 31);
    expect(new Date(apr).getMonth()).toBe(3);
    expect(new Date(apr).getDate()).toBe(30);
    const may = advanceNextRunEpochMillis(apr, "MONTHLY", 31);
    expect(new Date(may).getDate()).toBe(31);
  });

  it("handles a leap February", () => {
    const jan31 = new Date(2028, 0, 31, 10).getTime();
    const feb = advanceNextRunEpochMillis(jan31, "MONTHLY", 31);
    expect(new Date(feb).getDate()).toBe(29);
  });
});

describe("B4 - opening balances may be negative for card debt", () => {
  it("rejects a minus sign by default", () => {
    expect(() => parseDecimalToMinor("-1500.00")).toThrow(RangeError);
  });

  it("accepts one when the caller opts in", () => {
    expect(parseDecimalToMinor("-1500.00", { allowNegative: true })).toBe(-150000);
    expect(parseDecimalToMinor("1500.00", { allowNegative: true })).toBe(150000);
  });

  it("rejects an empty amount instead of silently returning zero", () => {
    // Previously "" parsed to 0, letting blank inputs through as a valid amount.
    expect(() => parseDecimalToMinor("")).toThrow(RangeError);
    expect(() => parseDecimalToMinor("-", { allowNegative: true })).toThrow(RangeError);
  });
});

describe("A6 - the PIN gate throttles brute force", () => {
  it("allows the first attempts without a cooldown", () => {
    for (let failures = 1; failures <= PIN_FREE_ATTEMPTS; failures += 1) {
      expect(pinLockoutSeconds(failures)).toBe(0);
    }
  });

  it("escalates the cooldown after the free attempts are spent", () => {
    expect(pinLockoutSeconds(PIN_FREE_ATTEMPTS + 1)).toBe(30);
    expect(pinLockoutSeconds(PIN_FREE_ATTEMPTS + 2)).toBe(60);
    expect(pinLockoutSeconds(PIN_FREE_ATTEMPTS + 3)).toBe(300);
  });

  it("caps the ladder rather than growing without bound", () => {
    expect(pinLockoutSeconds(500)).toBe(3600);
  });
});
