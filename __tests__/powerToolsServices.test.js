import {
  validateSplitSum,
  formatSplitEquation,
  computeSplitBreakdown,
  buildSplitTransactions,
} from "../src/domain/services/splits";
import {
  extractTags,
  filterTransactionsByTag,
  collectTagFrequencies,
  appendTagToNote,
} from "../src/domain/services/tags";
import {
  createRule,
  testRule,
  matchCategoryRule,
  applyRulesPreview,
} from "../src/domain/services/rules";

describe("P2 Power Tools Domain Services", () => {
  describe("Transaction Splits (Exact-Sum Invariant)", () => {
    it("validates exact sum matching total minor units", () => {
      const splits = [
        { categoryId: 1, amountMinor: 30_000 }, // ₱300
        { categoryId: 2, amountMinor: 20_000 }, // ₱200
      ];
      const result = validateSplitSum(splits, 50_000); // ₱500

      expect(result.isValid).toBe(true);
      expect(result.sumMinor).toBe(50_000);
      expect(result.diffMinor).toBe(0);
      expect(result.error).toBeNull();
    });

    it("detects discrepancy when splits do not equal total", () => {
      const splits = [
        { categoryId: 1, amountMinor: 30_000 },
        { categoryId: 2, amountMinor: 15_000 },
      ];
      const result = validateSplitSum(splits, 50_000);

      expect(result.isValid).toBe(false);
      expect(result.sumMinor).toBe(45_000);
      expect(result.diffMinor).toBe(5_000);
      expect(result.error).toContain("Difference: 5000");
    });

    it("rejects non-positive and non-integer split amounts", () => {
      const splits = [{ categoryId: 1, amountMinor: -5_000 }];
      const result = validateSplitSum(splits, 5_000);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("positive integer");
    });

    it("formats split equation accurately", () => {
      const splits = [
        { amountMinor: 30_000 },
        { amountMinor: 20_000 },
      ];
      const eq = formatSplitEquation(splits, 50_000, "₱");
      expect(eq).toBe("₱300 + ₱200 = ₱500");
    });

    it("computes split breakdown with percentage and unallocated balance", () => {
      const splits = [
        { categoryId: 1, amountMinor: 60_000 },
      ];
      const breakdown = computeSplitBreakdown({ totalMinor: 100_000, splits });

      expect(breakdown.sumMinor).toBe(60_000);
      expect(breakdown.remainingMinor).toBe(40_000);
      expect(breakdown.isExact).toBe(false);
      expect(breakdown.items[0].percentage).toBe(60);
    });

    it("builds preview transaction records for split items", () => {
      const parent = {
        type: "EXPENSE",
        accountId: 10,
        amountMinor: 50_000,
        note: "Supermarket groceries",
        dateEpochMillis: 1780000000000,
        sourceKey: "tx:999",
      };
      const splits = [
        { categoryId: 1, amountMinor: 30_000, note: "Food" },
        { categoryId: 2, amountMinor: 20_000, note: "Supplies" },
      ];

      const txs = buildSplitTransactions({ parentTransaction: parent, splits });
      expect(txs).toHaveLength(2);
      expect(txs[0].amountMinor).toBe(30_000);
      expect(txs[0].note).toContain("Split 1/2");
      expect(txs[0].sourceKey).toBe("tx:999:split:0");
      expect(txs[1].amountMinor).toBe(20_000);
      expect(txs[1].sourceKey).toBe("tx:999:split:1");
    });
  });

  describe("Transaction Tags", () => {
    it("extracts unique lowercase hashtags from note text", () => {
      const note = "Dinner with #friends and #Family at #friends place";
      const tags = extractTags(note);
      expect(tags).toEqual(["friends", "family"]);
    });

    it("returns empty array when text has no tags", () => {
      expect(extractTags("No hashtags here")).toEqual([]);
      expect(extractTags("")).toEqual([]);
      expect(extractTags(null)).toEqual([]);
    });

    it("filters transactions by tag", () => {
      const transactions = [
        { id: 1, note: "Project prints #school" },
        { id: 2, note: "Jollibee lunch #food" },
        { id: 3, note: "Textbook #school #books" },
      ];

      const schoolTxs = filterTransactionsByTag(transactions, "school");
      expect(schoolTxs).toHaveLength(2);
      expect(schoolTxs.map((t) => t.id)).toEqual([1, 3]);

      const foodTxs = filterTransactionsByTag(transactions, "#food");
      expect(foodTxs).toHaveLength(1);
      expect(foodTxs[0].id).toBe(2);
    });

    it("aggregates tag frequencies and totals across transactions", () => {
      const transactions = [
        { id: 1, amountMinor: 5_000, note: "#study #supplies" },
        { id: 2, amountMinor: 10_000, note: "#study coffee" },
        { id: 3, amountMinor: 2_000, note: "random lunch" },
      ];

      const freqs = collectTagFrequencies(transactions);
      expect(freqs).toHaveLength(2);
      expect(freqs[0].tag).toBe("study");
      expect(freqs[0].count).toBe(2);
      expect(freqs[0].totalMinor).toBe(15_000);
    });

    it("appends tag cleanly to note", () => {
      expect(appendTagToNote("Lunch", "food")).toBe("Lunch #food");
      expect(appendTagToNote("Lunch #food", "food")).toBe("Lunch #food");
      expect(appendTagToNote("", "study")).toBe("#study");
    });
  });

  describe("Transaction Rules", () => {
    it("creates normalized rule and validates input", () => {
      const rule = createRule({ pattern: "7-Eleven", categoryId: 10, categoryName: "Groceries" });
      expect(rule.pattern).toBe("7-eleven");
      expect(rule.categoryId).toBe(10);
      expect(rule.matchType).toBe("CONTAINS");

      expect(() => createRule({ pattern: "", categoryId: 10 })).toThrow();
    });

    it("tests rules by CONTAINS, EXACT, and STARTS_WITH", () => {
      const ruleContains = createRule({ pattern: "grab", categoryId: 1 });
      expect(testRule("GrabFood ride", ruleContains)).toBe(true);

      const ruleExact = createRule({ pattern: "netflix", categoryId: 2, matchType: "EXACT" });
      expect(testRule("Netflix", ruleExact)).toBe(true);
      expect(testRule("Netflix Subscription", ruleExact)).toBe(false);

      const ruleStarts = createRule({ pattern: "mrt", categoryId: 3, matchType: "STARTS_WITH" });
      expect(testRule("MRT 3 fare", ruleStarts)).toBe(true);
      expect(testRule("Fare at MRT", ruleStarts)).toBe(false);
    });

    it("matches first applicable rule in collection", () => {
      const rules = [
        createRule({ pattern: "spotify", categoryId: 5, categoryName: "Entertainment" }),
        createRule({ pattern: "food", categoryId: 6, categoryName: "Meals" }),
      ];

      const match = matchCategoryRule("Spotify Monthly", rules);
      expect(match).not.toBeNull();
      expect(match.categoryName).toBe("Entertainment");

      const noMatch = matchCategoryRule("Water bill", rules);
      expect(noMatch).toBeNull();
    });

    it("previews rule applications without mutating transactions", () => {
      const rules = [
        createRule({ pattern: "jollibee", categoryId: 100, categoryName: "Fast Food" }),
      ];
      const transactions = [
        { id: 1, note: "Jollibee breakfast", categoryId: 10 },
        { id: 2, note: "Jollibee dinner", categoryId: 100 }, // already fast food
        { id: 3, note: "Jeep fare", categoryId: 20 },
      ];

      const proposals = applyRulesPreview(transactions, rules);
      expect(proposals).toHaveLength(1);
      expect(proposals[0].transactionId).toBe(1);
      expect(proposals[0].proposedCategoryId).toBe(100);
      expect(proposals[0].proposedCategoryName).toBe("Fast Food");
      // Transaction 1 categoryId unchanged in source
      expect(transactions[0].categoryId).toBe(10);
    });
  });
});
