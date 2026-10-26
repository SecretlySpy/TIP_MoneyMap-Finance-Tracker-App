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
      expect(result.error).toBe("Split amounts do not equal the purchase total.");
    });

    it("rejects non-positive and non-integer split amounts", () => {
      const splits = [{ categoryId: 1, amountMinor: -5_000 }];
      const result = validateSplitSum(splits, 5_000);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("positive amount");
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

    it("preserves exact fractional splits while showing a truthful rounded total", () => {
      const splits = [
        { amountMinor: 30_050 }, // ₱300.50
        { amountMinor: 19_950 }, // ₱199.50
      ];
      const eq = formatSplitEquation(splits, 50_000, "₱");
      expect(eq).toBe("Split total ₱500");
    });

    it("validates split items have categories when requireCategory option is enabled", () => {
      const splitsWithoutCat = [
        { amountMinor: 25_000 },
        { amountMinor: 25_000 },
      ];
      const res = validateSplitSum(splitsWithoutCat, 50_000, { requireCategory: true });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("must have a category");

      const splitsWithCat = [
        { categoryId: 1, amountMinor: 25_000 },
        { categoryName: "Transport", amountMinor: 25_000 },
      ];
      const validRes = validateSplitSum(splitsWithCat, 50_000, { requireCategory: true });
      expect(validRes.isValid).toBe(true);
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
        { categoryId: 1, categoryName: "Food", amountMinor: 30_000, note: "Food" },
        { categoryId: 2, categoryName: "Supplies", amountMinor: 20_000, note: "Supplies" },
      ];

      const txs = buildSplitTransactions({ parentTransaction: parent, splits });
      expect(txs).toHaveLength(2);
      expect(txs[0].amountMinor).toBe(30_000);
      expect(txs[0].categoryId).toBe(1);
      expect(txs[0].categoryName).toBe("Food");
      expect(txs[0].note).toContain("Split 1/2");
      expect(txs[0].sourceKey).toBe("tx:999:split:0");
      expect(txs[1].amountMinor).toBe(20_000);
      expect(txs[1].categoryId).toBe(2);
      expect(txs[1].categoryName).toBe("Supplies");
      expect(txs[1].sourceKey).toBe("tx:999:split:1");
    });

    it("validates 4-split transaction matching prompt specification (₱1,000 = 400 + 250 + 200 + 150)", () => {
      const splits = [
        { categoryId: 1, categoryName: "Food", amountMinor: 40_000 },
        { categoryId: 2, categoryName: "Transport", amountMinor: 25_000 },
        { categoryId: 3, categoryName: "Shopping", amountMinor: 20_000 },
        { categoryId: 4, categoryName: "Entertainment", amountMinor: 15_000 },
      ];
      const result = validateSplitSum(splits, 100_000, { requireCategory: true });
      expect(result.isValid).toBe(true);
      expect(result.sumMinor).toBe(100_000);
      expect(result.diffMinor).toBe(0);
      expect(result.error).toBeNull();

      const eq = formatSplitEquation(splits, 100_000, "₱");
      expect(eq).toBe("₱400 + ₱250 + ₱200 + ₱150 = ₱1,000");

      const breakdown = computeSplitBreakdown({ totalMinor: 100_000, splits });
      expect(breakdown.isExact).toBe(true);
      expect(breakdown.sumMinor).toBe(100_000);
      expect(breakdown.remainingMinor).toBe(0);
      expect(breakdown.items).toHaveLength(4);
      expect(breakdown.items[0].percentage).toBe(40);
      expect(breakdown.items[1].percentage).toBe(25);
      expect(breakdown.items[2].percentage).toBe(20);
      expect(breakdown.items[3].percentage).toBe(15);
    });

    it("accurately validates 5-split transaction with centavo precision", () => {
      const splits = [
        { categoryId: 1, amountMinor: 20_011 },
        { categoryId: 2, amountMinor: 20_011 },
        { categoryId: 3, amountMinor: 20_011 },
        { categoryId: 4, amountMinor: 20_011 },
        { categoryId: 5, amountMinor: 20_011 },
      ];
      const result = validateSplitSum(splits, 100_055);
      expect(result.isValid).toBe(true);
      expect(result.sumMinor).toBe(100_055);
      expect(result.diffMinor).toBe(0);

      const eq = formatSplitEquation(splits, 100_055, "₱");
      expect(eq).toBe("Split total ₱1,001");
    });

    it("correctly identifies under-allocation and over-allocation across multi-splits", () => {
      // Under-allocated 4 splits
      const underSplits = [
        { categoryId: 1, amountMinor: 40_000 },
        { categoryId: 2, amountMinor: 25_000 },
      ];
      const underRes = validateSplitSum(underSplits, 100_000);
      expect(underRes.isValid).toBe(false);
      expect(underRes.diffMinor).toBe(35_000); // 35,000 remaining
      const underBreakdown = computeSplitBreakdown({ totalMinor: 100_000, splits: underSplits });
      expect(underBreakdown.remainingMinor).toBe(35_000);

      // Over-allocated 4 splits
      const overSplits = [
        { categoryId: 1, amountMinor: 40_000 },
        { categoryId: 2, amountMinor: 25_000 },
        { categoryId: 3, amountMinor: 20_000 },
        { categoryId: 4, amountMinor: 20_000 }, // sum 105,000 vs 100,000
      ];
      const overRes = validateSplitSum(overSplits, 100_000);
      expect(overRes.isValid).toBe(false);
      expect(overRes.diffMinor).toBe(-5_000); // 5,000 over
      const overBreakdown = computeSplitBreakdown({ totalMinor: 100_000, splits: overSplits });
      expect(overBreakdown.remainingMinor).toBe(-5_000);
    });

    it("builds multi-split transaction records with proper indexing and source keys", () => {
      const parent = {
        type: "EXPENSE",
        accountId: 1,
        amountMinor: 100_000,
        note: "Weekend outing",
        dateEpochMillis: 1780000000000,
        sourceKey: "tx:out:123",
      };
      const splits = [
        { categoryId: 1, categoryName: "Food", amountMinor: 40_000 },
        { categoryId: 2, categoryName: "Transport", amountMinor: 25_000 },
        { categoryId: 3, categoryName: "Shopping", amountMinor: 20_000 },
        { categoryId: 4, categoryName: "Entertainment", amountMinor: 15_000 },
      ];

      const records = buildSplitTransactions({ parentTransaction: parent, splits });
      expect(records).toHaveLength(4);
      expect(records[0].note).toBe("Weekend outing - Food (Split 1/4)");
      expect(records[0].sourceKey).toBe("tx:out:123:split:0");
      expect(records[1].note).toBe("Weekend outing - Transport (Split 2/4)");
      expect(records[1].sourceKey).toBe("tx:out:123:split:1");
      expect(records[2].note).toBe("Weekend outing - Shopping (Split 3/4)");
      expect(records[2].sourceKey).toBe("tx:out:123:split:2");
      expect(records[3].note).toBe("Weekend outing - Entertainment (Split 4/4)");
      expect(records[3].sourceKey).toBe("tx:out:123:split:3");
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
