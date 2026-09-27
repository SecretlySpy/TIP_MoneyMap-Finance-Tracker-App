import { parseDecimalToMinor, formatMinor } from "../src/domain/services/money";
import { computeSafeToSpend } from "../src/domain/services/safeToSpend";
import { buildBudgetCards, buildRecurringBills, nextReminderPreview } from "../src/domain/services/financeView";
import { applyGoalContribution } from "../src/domain/services/goals";
import { parseImportGrid, detectImportMappings } from "../src/domain/services/importParser";
import { buildAutomaticAccountResolutions, listImportAccountSources, unresolvedImportAccountSources } from "../src/domain/services/importAccounts";
import { deriveSmartTips } from "../src/domain/services/tips";
import { rankPlaces, TIP_QC_CAMPUS } from "../src/domain/services/eatsRanking";

describe("MoneyMap End-to-End System & Backend Integrity", () => {
  describe("1. Currency and Money Precision Pipeline", () => {
    it("parses decimal amounts into exact integer minor units without floating-point artifacts", () => {
      expect(parseDecimalToMinor("15000.50")).toBe(1500050);
      expect(parseDecimalToMinor("0.05")).toBe(5);
      expect(parseDecimalToMinor("1250.75")).toBe(125075);
    });

    it("formats minor units cleanly into localized strings", () => {
      expect(formatMinor(1500050, { currencySymbol: "₱", showCents: true })).toBe("₱15,000.50");
      expect(formatMinor(1500000, { currencySymbol: "$", showCents: false })).toBe("$15,000");
    });
  });

  describe("2. Safe-to-Spend & Budget Aggregations Pipeline", () => {
    const categories = [
      { id: 1, name: "Food", type: "EXPENSE", icon: "🍜" },
      { id: 2, name: "Transport", type: "EXPENSE", icon: "🚌" },
      { id: 3, name: "Bills", type: "EXPENSE", icon: "🧾" },
      { id: 4, name: "Allowance", type: "INCOME", icon: "💵" },
    ];
    const categoriesById = new Map(categories.map((c) => [c.id, c]));

    const budgets = [
      { id: 1, categoryId: 1, monthYear: "2026-09", limitMinor: 300000 },
      { id: 2, categoryId: 2, monthYear: "2026-09", limitMinor: 150000 },
      { id: 3, categoryId: 3, monthYear: "2026-09", limitMinor: 300000 },
    ];

    const septDateEpoch = new Date(2026, 8, 2, 12, 0, 0).getTime(); // September 2, 2026 noon local

    const transactions = [
      { id: 1, categoryId: 1, accountId: 1, amountMinor: 24000, type: "EXPENSE", dateEpochMillis: septDateEpoch },
      { id: 2, categoryId: 2, accountId: 1, amountMinor: 8000, type: "EXPENSE", dateEpochMillis: septDateEpoch },
      { id: 3, categoryId: 3, accountId: 1, amountMinor: 199800, type: "EXPENSE", dateEpochMillis: septDateEpoch },
      { id: 4, categoryId: 4, accountId: 1, amountMinor: 1500000, type: "INCOME", dateEpochMillis: septDateEpoch },
    ];

    it("accurately computes category spend against budget limits", () => {
      const cards = buildBudgetCards(
        budgets,
        transactions,
        categoriesById,
        "2026-09",
      );

      expect(cards).toHaveLength(3);
      const food = cards.find((b) => b.name === "Food");
      expect(food).toBeDefined();
      expect(food.spentMinor).toBe(24000);
      expect(food.limitMinor).toBe(300000);
      expect(food.percent).toBe(8);
      expect(food.state).toBe("normal");

      const bills = cards.find((b) => b.name === "Bills");
      expect(bills).toBeDefined();
      expect(bills.spentMinor).toBe(199800);
      expect(bills.limitMinor).toBe(300000);
      expect(bills.percent).toBe(67);
    });

    it("accurately builds safe-to-spend models", () => {
      const safe = computeSafeToSpend({
        budgets,
        transactions,
        categoriesById,
        monthYear: "2026-09",
        recurringRules: [],
        goals: [],
      });

      expect(safe.safeMinor).toBeGreaterThan(0);
      expect(safe.state).toBe("comfortable");
    });
  });

  describe("3. Recurring Rules & Reminders Pipeline", () => {
    const categoriesById = new Map([
      [1, { id: 1, name: "Bills", type: "EXPENSE" }],
    ]);

    const rules = [
      {
        id: 1,
        categoryId: 1,
        accountId: 1,
        amountMinor: 99900,
        frequency: "MONTHLY",
        interval: 1,
        anchorDay: 15,
        nextRunEpochMillis: Date.now() + 5 * 86400000,
        isActive: true,
        note: "Internet plan",
        icon: "🌐",
        reminderLeadDays: 14,
      },
    ];

    it("constructs recurring bills with clean frequency labels", () => {
      const bills = buildRecurringBills(rules, categoriesById);
      expect(bills).toHaveLength(1);
      expect(bills[0].name).toBe("Internet plan");
      expect(bills[0].frequencyLabel).toBe("Monthly");
      expect(bills[0].reminderEnabled).toBe(true);
      expect(bills[0].leadDays).toBe(14);
    });

    it("generates an active reminder preview banner", () => {
      const bills = buildRecurringBills(rules, categoriesById);
      const reminder = nextReminderPreview(bills);
      expect(reminder).not.toBeNull();
      expect(reminder.title).toContain("Internet plan");
      expect(reminder.detailAmountMinor).toBe(99900);
    });
  });

  describe("4. Savings Goals & Contribution Mechanics", () => {
    it("handles partial contribution and completion with overflow", () => {
      const goal = {
        id: 1,
        name: "New laptop",
        targetMinor: 3500000,
        currentMinor: 1500000,
        deadlineEpochMillis: Date.now() + 60 * 86400000,
        isComplete: false,
      };

      const partial = applyGoalContribution(goal, 1000000);
      expect(partial.complete).toBe(false);
      expect(partial.currentMinor).toBe(2500000);
      expect(partial.overflowMinor).toBe(0);

      const complete = applyGoalContribution(goal, 2500000);
      expect(complete.complete).toBe(true);
      expect(complete.currentMinor).toBe(4000000);
      expect(complete.overflowMinor).toBe(500000);
    });
  });

  describe("5. CSV/XLSX Import Engine & Account Resolution (Figma 16 & 16b)", () => {
    const rawGrid = [
      ["Date", "Amount", "Type", "Category", "Account", "Note"],
      ["2026-09-01", "15000.00", "INCOME", "Salary", "GCash", "September payroll"],
      ["2026-09-02", "120.00", "EXPENSE", "Food", "Cash", "Lunch"],
      ["2026-09-02", "40.00", "EXPENSE", "Transport", "BPI Savings", "Jeepney"],
    ];

    it("auto-detects columns and parses rows with correct data types", () => {
      const mappings = detectImportMappings(rawGrid[0]);
      expect(mappings.Date).toBe(0);
      expect(mappings.Amount).toBe(1);
      expect(mappings.Type).toBe(2);

      const parsed = parseImportGrid(rawGrid, mappings);
      expect(parsed.rows).toHaveLength(3);
      expect(parsed.skipped).toHaveLength(0);
      expect(parsed.rows[0].amountMinor).toBe(1500000);
      expect(parsed.rows[0].type).toBe("INCOME");
      expect(parsed.rows[1].amountMinor).toBe(12000);
      expect(parsed.rows[1].type).toBe("EXPENSE");
    });

    it("identifies account sources and allows clean mapping to existing or new accounts", () => {
      const mappings = detectImportMappings(rawGrid[0]);
      const parsed = parseImportGrid(rawGrid, mappings);
      const sources = listImportAccountSources(parsed.rows);
      expect(sources.map((s) => s.label)).toEqual(["GCash", "Cash", "BPI Savings"]);

      const accounts = [{ id: 1, name: "Cash", type: "CASH" }];
      const resolutions = buildAutomaticAccountResolutions(parsed.rows, accounts);
      expect(resolutions["cash"]).toEqual({ kind: "existing", accountId: 1 });

      // Non-existing accounts are unresolved initially
      const unresolved = unresolvedImportAccountSources(parsed.rows, resolutions);
      expect(unresolved.length).toBe(2); // GCash & BPI Savings

      // Resolve them dynamically
      unresolved.forEach((source) => {
        resolutions[source.key] = { kind: "create", name: source.label, type: "EWALLET" };
      });

      const unresolvedAfter = unresolvedImportAccountSources(parsed.rows, resolutions);
      expect(unresolvedAfter.length).toBe(0);
    });
  });

  describe("6. Offline Smart Tips Engine", () => {
    it("generates actionable heuristics without requiring internet connection", () => {
      const categories = [
        { id: 1, name: "Shopping", type: "EXPENSE", icon: "🛍️" },
      ];
      const snapshot = deriveSmartTips({
        budgets: [{ id: 1, categoryId: 1, monthYear: "2026-09", limitMinor: 150000 }],
        transactions: [{ id: 1, categoryId: 1, accountId: 1, amountMinor: 178000, type: "EXPENSE", dateEpochMillis: new Date(2026, 8, 2).getTime() }],
        categories,
        monthYear: "2026-09",
      });

      expect(snapshot.tips.length).toBeGreaterThan(0);
      expect(snapshot.tips[0].title).toBeDefined();
      expect(snapshot.tips[0].emoji).toBeDefined();
    });
  });

  describe("7. Student Eats Ranking Engine", () => {
    it("ranks nearby student-friendly food spots by distance, price, and heuristic signals", () => {
      const elements = [
        { id: 1, lat: 14.62550, lon: 121.06140, tags: { name: "Pares Retiro", amenity: "restaurant", cuisine: "filipino" } },
        { id: 2, lat: 14.62560, lon: 121.06150, tags: { name: "Carinderia ni Aling Nena", "diet:student": "yes" } },
        { id: 3, lat: 14.64000, lon: 121.08000, tags: { name: "Faraway Fine Dining", amenity: "restaurant" } },
      ];

      const ranked = rankPlaces(elements, TIP_QC_CAMPUS, { maxDistanceM: 2000 });
      expect(ranked.length).toBeGreaterThanOrEqual(2);
      expect(ranked[0].name).toBe("Carinderia ni Aling Nena");
      expect(ranked[0].priceLevel).toBe(1);
    });
  });
});
