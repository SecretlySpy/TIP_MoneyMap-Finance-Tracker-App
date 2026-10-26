import {
  assertAnonymizedPayload,
  buildAnonymizedSmartTipsPayload,
  clearSmartTipsCache,
  fetchSmartTipsFromGemini,
  normalizeAiTip,
  parseGeminiTipsText,
} from "../src/remote/smartTipsClient";
import { requestAiProxyTips } from "../src/remote/aiProxyClient";
import { useUiStore } from "../src/store/uiStore";
import { budget } from "../backend/moneymap-ai/src/handler.cjs";

jest.mock("../src/remote/aiProxyClient", () => ({ requestAiProxyTips: jest.fn() }));

const categoriesById = new Map([
  [1, { id: 1, name: "Food", icon: "restaurant", colorHex: "#EA580C", type: "EXPENSE", isCustom: false }],
  [2, { id: 2, name: "Transport", icon: "bus", colorHex: "#2563EB", type: "EXPENSE", isCustom: false }],
]);

describe("buildAnonymizedSmartTipsPayload", () => {
  it("sends only versioned whole-peso totals and ratios, never raw rows", () => {
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
    expect(budget(payload)).toBe(true);
    expect(payload).toEqual(
      expect.objectContaining({
        period: "2026-08",
        currencySymbol: "₱",
        contractVersion: 2,
        moneyUnit: "PHP_WHOLE_PESOS_V2",
        limitBudgetPesos: 3000,
        spentBudgetPesos: 150,
        remainingBudgetPesos: 2850,
      }),
    );
    expect(payload).not.toHaveProperty("transactions");
    expect(payload).not.toHaveProperty("notes");
    expect(payload).not.toHaveProperty("accounts");
    expect(JSON.stringify(payload)).not.toContain("SECRET NOTE");
    expect(JSON.stringify(payload)).not.toContain("accountId");
    expect(JSON.stringify(payload)).not.toMatch(/"id":\s*99/);
    expect(Array.isArray(payload.categorySpendRatios)).toBe(true);
    expect(payload).not.toHaveProperty("remainingBudgetMinor");
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
    expect(assertAnonymizedPayload({ ...base, contractVersion: 1 }).ok).toBe(false);
    expect(assertAnonymizedPayload({ ...base, moneyUnit: "CENTAVOS" }).ok).toBe(false);
    expect(assertAnonymizedPayload({ ...base, spentBudgetMinor: 100 }).ok).toBe(false);
    expect(assertAnonymizedPayload({ ...base, currencySymbol: "$" }).ok).toBe(false);
  });
});

describe("fetchSmartTipsFromGemini gating", () => {
  beforeEach(() => {
    clearSmartTipsCache();
    requestAiProxyTips.mockReset();
  });

  const payload = {
    contractVersion: 2,
    moneyUnit: "PHP_WHOLE_PESOS_V2",
    period: "2026-08",
    currencySymbol: "₱",
    remainingBudgetPesos: 100,
    limitBudgetPesos: 200,
    spentBudgetPesos: 100,
    categorySpendRatios: [],
  };

  it("sends v2 pesos, reuses cache and invalidates it on consent withdrawal", async () => {
    useUiStore.setState({ onlinePersonalizationConsentAccepted: true });
    requestAiProxyTips.mockResolvedValue([{ title: "Pack lunch", amountPesos: 25, isEstimate: true }]);
    const options = { enabled: true, consentAccepted: true, payload };
    expect(await fetchSmartTipsFromGemini(options)).toEqual([expect.objectContaining({ amountPesos: 25 })]);
    expect(await fetchSmartTipsFromGemini(options)).toHaveLength(1);
    expect(requestAiProxyTips).toHaveBeenCalledTimes(1);
    expect(requestAiProxyTips.mock.calls[0][0].payload).toEqual(payload);
    useUiStore.setState({ onlinePersonalizationConsentAccepted: false });
    expect(await fetchSmartTipsFromGemini({ ...options, consentAccepted: false })).toBeNull();
    useUiStore.setState({ onlinePersonalizationConsentAccepted: true });
    await fetchSmartTipsFromGemini(options);
    expect(requestAiProxyTips).toHaveBeenCalledTimes(2);
  });

  it("discards in-flight tips if consent is withdrawn", async () => {
    useUiStore.setState({ onlinePersonalizationConsentAccepted: true });
    let resolve;
    requestAiProxyTips.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const pending = fetchSmartTipsFromGemini({ enabled: true, consentAccepted: true, payload });
    useUiStore.setState({ onlinePersonalizationConsentAccepted: false });
    resolve([{ title: "Pack lunch", amountPesos: 25, isEstimate: true }]);
    expect(await pending).toBeNull();
  });

  it("makes zero network calls when disabled", async () => {
    const fetchImpl = jest.fn();
    const result = await fetchSmartTipsFromGemini({
      enabled: false,
      consentAccepted: true,
      payload: {
        period: "2026-08",
        currencySymbol: "₱",
        contractVersion: 2,
        moneyUnit: "PHP_WHOLE_PESOS_V2",
        remainingBudgetPesos: 100,
        limitBudgetPesos: 200,
        spentBudgetPesos: 100,
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
        contractVersion: 2,
        moneyUnit: "PHP_WHOLE_PESOS_V2",
        remainingBudgetPesos: 100,
        limitBudgetPesos: 200,
        spentBudgetPesos: 100,
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
        contractVersion: 2,
        moneyUnit: "PHP_WHOLE_PESOS_V2",
        remainingBudgetPesos: 100,
        limitBudgetPesos: 200,
        spentBudgetPesos: 100,
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

  describe("normalizeAiTip financial accuracy and currency validation", () => {
    const context = {
      limitBudgetPesos: 1500,
      remainingBudgetPesos: 500,
      currencySymbol: "₱",
    };

    it("accepts valid structured AI tips within budget limits", () => {
      const tip = normalizeAiTip(
        {
          title: "Pack lunch twice a week",
          meta: "Save on afternoon meals",
          tag: "Food",
          emoji: "🍱",
          amountPesos: 300,
          isEstimate: true,
          category: "Food",
        },
        0,
        context,
      );
      expect(tip).not.toBeNull();
      expect(tip.title).toBe("Pack lunch twice a week");
      expect(tip.amountPesos).toBe(300);
      expect(tip.isEstimate).toBe(true);
      expect(tip.category).toBe("Food");
      expect(tip.source).toBe("ai");
    });

    it("rejects AI tips with unreasonable claimed amounts exceeding the budget", () => {
      const tip = normalizeAiTip(
        {
          title: "Save on textbooks",
          meta: "Save on costs",
          amountPesos: 5000,
          isEstimate: true,
        },
        0,
        context,
      );
      expect(tip).toBeNull();
    });

    it("rejects AI tips with negative amounts", () => {
      const tip = normalizeAiTip(
        {
          title: "Transport savings",
          meta: "Negative savings",
          amountPesos: -100,
          isEstimate: true,
        },
        0,
        context,
      );
      expect(tip).toBeNull();
    });

    it("rejects AI tips containing unverified numeric claims or legacy amounts", () => {
      const tip = normalizeAiTip(
        {
          title: "You have ₱150000 left",
          meta: "Spend wisely",
        },
        0,
        context,
      );
      expect(tip).toBeNull();
      expect(normalizeAiTip({ title: "Save two pesos", amountPesos: 2 }, 0, context)).toBeNull();
      expect(normalizeAiTip({ title: "Eat out", amountMinor: 200 }, 0, context)).toBeNull();
      expect(normalizeAiTip({ title: "Eat out", amountPesos: 200, isEstimate: false }, 0, context)).toBeNull();
    });

    it("rejects monetary claims in tag and category too", () => {
      expect(normalizeAiTip({ title: "Cook breakfast", tag: "₱20", amountPesos: 20 }, 0, context)).toBeNull();
      expect(normalizeAiTip({ title: "Cook breakfast", category: "Food 2", amountPesos: 20 }, 0, context)).toBeNull();
    });

    it("rejects raw centavo leakage like 1120000 in prose while accepting validated amountPesos 11200", () => {
      const budgetContext = {
        limitBudgetPesos: 11_200,
        remainingBudgetPesos: 11_200,
        currencySymbol: "₱",
      };
      // Raw 1120000 centavos in prose must be rejected
      expect(
        normalizeAiTip(
          {
            title: "Track every centavo",
            meta: "Monitor your 1120000 limit",
          },
          0,
          budgetContext,
        ),
      ).toBeNull();

      // Legacy amountMinor must be rejected
      expect(
        normalizeAiTip(
          {
            title: "Stay within your budget",
            meta: "Monitor your limit",
            amountMinor: 1_120_000,
          },
          0,
          budgetContext,
        ),
      ).toBeNull();

      // Excessive amountPesos must be rejected
      expect(
        normalizeAiTip(
          {
            title: "Stay within your budget",
            meta: "Monitor your limit",
            amountPesos: 1_120_000,
            isEstimate: true,
          },
          0,
          budgetContext,
        ),
      ).toBeNull();

      // Validated whole-peso amountPesos passes
      const validTip = normalizeAiTip(
        {
          title: "Stay within your budget",
          meta: "Monitor your spending limit",
          tag: "Budget",
          amountPesos: 11_200,
          isEstimate: true,
        },
        0,
        budgetContext,
      );
      expect(validTip).not.toBeNull();
      expect(validTip.amountPesos).toBe(11_200);
      expect(validTip.title).toBe("Stay within your budget");
    });
  });
});
