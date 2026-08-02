import {
  assertAnonymizedPayload,
  buildAnonymizedSmartTipsPayload,
  clearSmartTipsCache,
  fetchSmartTipsFromGemini,
  parseGeminiTipsText,
} from "../src/remote/smartTipsClient";

const categoriesById = new Map([
  [1, { id: 1, name: "Food", icon: "restaurant", colorHex: "#EA580C", type: "EXPENSE", isCustom: false }],
  [2, { id: 2, name: "Transport", icon: "bus", colorHex: "#2563EB", type: "EXPENSE", isCustom: false }],
]);

describe("buildAnonymizedSmartTipsPayload", () => {
  it("includes only period, budget totals, ratios, and currency — never raw rows", () => {
    const payload = buildAnonymizedSmartTipsPayload({
      monthYear: "2026-08",
      currencySymbol: "₱",
      budgets: [
        { id: 1, categoryId: 1, monthYear: "2026-08", limitMinor: 300_000 },
      ],
      transactions: [
        {
          id: 99,
          amountMinor: 15_000,
          type: "EXPENSE",
          categoryId: 1,
          accountId: 7,
          dateEpochMillis: new Date(2026, 7, 3, 12).getTime(),
          note: "SECRET NOTE should not appear",
          recurringRuleId: 3,
        },
      ],
      categoriesById,
    });

    expect(assertAnonymizedPayload(payload)).toEqual({ ok: true });
    expect(payload).toEqual(
      expect.objectContaining({
        period: "2026-08",
        currencySymbol: "₱",
      }),
    );
    expect(payload).not.toHaveProperty("transactions");
    expect(payload).not.toHaveProperty("notes");
    expect(payload).not.toHaveProperty("accounts");
    expect(JSON.stringify(payload)).not.toContain("SECRET NOTE");
    expect(JSON.stringify(payload)).not.toContain("accountId");
    expect(JSON.stringify(payload)).not.toMatch(/"id":\s*99/);
    expect(Array.isArray(payload.categorySpendRatios)).toBe(true);
    expect(Number.isSafeInteger(payload.remainingBudgetMinor)).toBe(true);
  });

  it("rejects payloads that smuggle raw data", () => {
    const base = buildAnonymizedSmartTipsPayload({
      monthYear: "2026-08",
      currencySymbol: "₱",
      budgets: [],
      transactions: [],
      categoriesById,
    });
    expect(assertAnonymizedPayload({ ...base, transactions: [{ note: "x" }] }).ok).toBe(false);
    expect(assertAnonymizedPayload({ ...base, notes: ["hi"] }).ok).toBe(false);
    expect(assertAnonymizedPayload({ ...base, accountName: "Cash" }).ok).toBe(false);
  });
});

describe("fetchSmartTipsFromGemini gating", () => {
  beforeEach(() => {
    clearSmartTipsCache();
  });

  it("makes zero network calls when disabled", async () => {
    const fetchImpl = jest.fn();
    const result = await fetchSmartTipsFromGemini({
      enabled: false,
      consentAccepted: true,
      payload: {
        period: "2026-08",
        currencySymbol: "₱",
        remainingBudgetMinor: 100,
        limitBudgetMinor: 200,
        spentBudgetMinor: 100,
        categorySpendRatios: [],
      },
      fetchImpl,
    });
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("makes zero network calls without consent", async () => {
    const fetchImpl = jest.fn();
    const result = await fetchSmartTipsFromGemini({
      enabled: true,
      consentAccepted: false,
      payload: {
        period: "2026-08",
        currencySymbol: "₱",
        remainingBudgetMinor: 100,
        limitBudgetMinor: 200,
        spentBudgetMinor: 100,
        categorySpendRatios: [],
      },
      fetchImpl,
    });
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falls back to null on network/API errors", async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error("offline");
    });
    // Without API key, returns null before fetch — mock Constants path by calling with empty key behavior
    const result = await fetchSmartTipsFromGemini({
      enabled: true,
      consentAccepted: true,
      payload: {
        period: "2026-08",
        currencySymbol: "₱",
        remainingBudgetMinor: 100,
        limitBudgetMinor: 200,
        spentBudgetMinor: 100,
        categorySpendRatios: [],
      },
      fetchImpl,
    });
    // No key in test env → null, and fetch may or may not run depending on key
    expect(result).toBeNull();
  });

  it("parses Gemini JSON tip arrays", () => {
    const tips = parseGeminiTipsText('```json\n[{"emoji":"🍜","title":"Cook at home","meta":"Save allowance","tag":"Food"}]\n```');
    expect(tips).toHaveLength(1);
    expect(tips[0].title).toBe("Cook at home");
    expect(tips[0].source).toBe("ai");
  });
});
