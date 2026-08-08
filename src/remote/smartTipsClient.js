import Constants from "expo-constants";
import { budgetSummary, buildBudgetCards, spendingByCategory } from "../domain/services/financeView";

/**
 * Dedicated Smart Tips network client (FR-10b).
 * Outbound HTTPS is limited to src/remote/* modules. Every call must be gated by smartTipsEnabled + consent.
 */

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const CACHE_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;

/** @type {Map<string, { expiresAt: number, tips: object[] }>} */
const responseCache = new Map();

/**
 * Read API key from Expo extra / EAS secrets. Never hardcode.
 * @returns {string}
 */
export function getGeminiApiKey() {
  const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};
  const key = extra.geminiApiKey ?? extra.GEMINI_API_KEY ?? "";
  return typeof key === "string" ? key.trim() : "";
}

/**
 * Build the anonymized summary payload. Callers must not add raw rows.
 *
 * FORBIDDEN in payload: transactions[], notes, account names/ids, rule ids,
 * personal names, free-text memos.
 *
 * @param {{
 *   monthYear: string,
 *   currencySymbol: string,
 *   budgets: object[],
 *   transactions: object[],
 *   categoriesById: Map<number, object>,
 * }} input
 */
export function buildAnonymizedSmartTipsPayload(input) {
  const cards = buildBudgetCards(
    input.budgets ?? [],
    input.transactions ?? [],
    input.categoriesById,
    input.monthYear,
  );
  const summary = budgetSummary(cards);
  const spending = spendingByCategory(
    input.transactions ?? [],
    input.categoriesById,
    input.monthYear,
  );
  const total = spending.totalMinor > 0 ? spending.totalMinor : 1;
  const categorySpendRatios = spending.segments.map((segment) => ({
    // Category label only (not account). Needed for useful budget tips.
    category: String(segment.label ?? "Other").slice(0, 32),
    ratio: Number((segment.spentMinor / total).toFixed(4)),
  }));

  return {
    period: input.monthYear,
    currencySymbol: String(input.currencySymbol ?? "₱").slice(0, 4),
    remainingBudgetMinor: Math.max(0, summary.limitMinor - summary.spentMinor),
    limitBudgetMinor: Math.max(0, summary.limitMinor),
    spentBudgetMinor: Math.max(0, summary.spentMinor),
    categorySpendRatios,
  };
}

/**
 * Assert payload shape for tests and runtime guard before send.
 * @param {unknown} payload
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function assertAnonymizedPayload(payload) {
  if (payload === null || typeof payload !== "object") {
    return { ok: false, reason: "payload must be an object" };
  }
  const record = /** @type {Record<string, unknown>} */ (payload);
  const forbidden = [
    "transactions",
    "notes",
    "note",
    "accounts",
    "accountId",
    "accountIds",
    "accountName",
    "recurringRules",
    "ruleId",
    "userId",
    "email",
    "phone",
    "rawRows",
  ];
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return { ok: false, reason: `forbidden field: ${key}` };
    }
  }
  if (typeof record.period !== "string" || !/^\d{4}-\d{2}$/.test(record.period)) {
    return { ok: false, reason: "period must be YYYY-MM" };
  }
  if (typeof record.currencySymbol !== "string") {
    return { ok: false, reason: "currencySymbol required" };
  }
  for (const field of ["remainingBudgetMinor", "limitBudgetMinor", "spentBudgetMinor"]) {
    if (!Number.isSafeInteger(record[field]) || record[field] < 0) {
      return { ok: false, reason: `${field} must be non-negative safe integer` };
    }
  }
  if (!Array.isArray(record.categorySpendRatios)) {
    return { ok: false, reason: "categorySpendRatios must be an array" };
  }
  for (const row of record.categorySpendRatios) {
    if (row === null || typeof row !== "object") {
      return { ok: false, reason: "invalid ratio row" };
    }
    if (typeof row.category !== "string" || typeof row.ratio !== "number") {
      return { ok: false, reason: "ratio row needs category + ratio" };
    }
    if ("note" in row || "accountId" in row || "transactionId" in row) {
      return { ok: false, reason: "ratio row contains forbidden identifiers" };
    }
  }
  return { ok: true };
}

function cacheKey(payload) {
  return JSON.stringify(payload);
}

/**
 * @param {object} payload
 * @returns {object[] | null}
 */
export function getCachedSmartTips(payload) {
  const entry = responseCache.get(cacheKey(payload));
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(cacheKey(payload));
    return null;
  }
  return entry.tips;
}

export function clearSmartTipsCache() {
  responseCache.clear();
}

/**
 * Parse Gemini response text into tip cards. Falls back to empty on bad shape.
 * @param {string} text
 * @returns {object[]}
 */
export function parseGeminiTipsText(text) {
  const trimmed = String(text ?? "").trim();
  if (trimmed.length === 0) {
    return [];
  }
  // Prefer fenced JSON or raw JSON array
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fence ? fence[1].trim() : trimmed;
  try {
    const start = candidate.indexOf("[");
    const end = candidate.lastIndexOf("]");
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(candidate.slice(start, end + 1));
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .slice(0, 5)
        .map((item, index) => normalizeAiTip(item, index))
        .filter(Boolean);
    }
  } catch {
    return [];
  }
  return [];
}

function normalizeAiTip(item, index) {
  if (item === null || typeof item !== "object") {
    return null;
  }
  const title = typeof item.title === "string" ? item.title.trim() : "";
  const meta = typeof item.meta === "string"
    ? item.meta.trim()
    : typeof item.description === "string"
      ? item.description.trim()
      : "";
  if (title.length === 0) {
    return null;
  }
  return {
    id: `ai-${index}-${title.slice(0, 12).replace(/\s+/g, "-").toLowerCase()}`,
    emoji: typeof item.emoji === "string" && item.emoji.length > 0 ? item.emoji : "✨",
    title,
    meta: meta || "AI suggestion from your budget summary",
    tag: typeof item.tag === "string" && item.tag.length > 0 ? item.tag : "AI",
    source: "ai",
  };
}

/**
 * Request AI tips. Returns null on any failure so callers fall back to offline tips.
 *
 * @param {{
 *   enabled: boolean,
 *   consentAccepted: boolean,
 *   payload: object,
 *   fetchImpl?: typeof fetch,
 *   now?: number,
 * }} options
 * @returns {Promise<object[] | null>}
 */
export async function fetchSmartTipsFromGemini(options) {
  if (!options.enabled || !options.consentAccepted) {
    return null;
  }
  const shape = assertAnonymizedPayload(options.payload);
  if (!shape.ok) {
    return null;
  }

  const cached = getCachedSmartTips(options.payload);
  if (cached !== null) {
    return cached;
  }

  const apiKey = getGeminiApiKey();
  if (apiKey.length === 0) {
    return null;
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return null;
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    : null;

  try {
    const prompt = [
      "You help students budget. Given ONLY this anonymized JSON summary, return a JSON array of up to 4 tip objects.",
      'Each object: {"emoji":"string","title":"string","meta":"string","tag":"string"}.',
      "No markdown outside the array. No personal data. Amounts are integer minor units (centavos); mention major units in copy.",
      JSON.stringify(options.payload),
    ].join("\n");

    const response = await fetchImpl(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller?.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 512,
        },
      }),
    });

    if (!response.ok) {
      return null;
    }
    const body = await response.json();
    const text = body?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text ?? "")
      .join("\n") ?? "";
    const tips = parseGeminiTipsText(text);
    if (tips.length === 0) {
      return null;
    }
    responseCache.set(cacheKey(options.payload), {
      expiresAt: (options.now ?? Date.now()) + CACHE_TTL_MS,
      tips,
    });
    return tips;
  } catch {
    return null;
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

/**
 * High-level helper: AI tips if allowed, else null (caller uses offline deriveSmartTips).
 */
export async function loadOnlineSmartTips(input) {
  if (!input.enabled) {
    return null;
  }
  const payload = buildAnonymizedSmartTipsPayload(input);
  return fetchSmartTipsFromGemini({
    enabled: input.enabled,
    consentAccepted: input.consentAccepted === true,
    payload,
    fetchImpl: input.fetchImpl,
  });
}
