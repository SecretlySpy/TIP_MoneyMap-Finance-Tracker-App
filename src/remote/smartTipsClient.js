import { requestAiProxyTips } from "./aiProxyClient";
import { budgetSummary, buildBudgetCards, spendingByCategory } from "../domain/services/financeView";

/**
 * Dedicated Smart Tips network client (FR-10b).
 * Outbound HTTPS is limited to src/remote/* modules. Every call must be gated by smartTipsEnabled + consent.
 */

const CACHE_TTL_MS = 30 * 60 * 1000;

/** @type {Map<string, { expiresAt: number, tips: object[] }>} */
const responseCache = new Map();

/**
 * Read API key from Expo extra / EAS secrets. Never hardcode.
 * @returns {string}
 */
export function getGeminiApiKey() {
  // Legacy API retained for compatibility. Gemini keys are never bundled.
  return "";
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
  // An allowlist also blocks identifiers hidden under previously unknown field names.
  const allowed = ["period", "currencySymbol", "remainingBudgetMinor", "limitBudgetMinor", "spentBudgetMinor", "categorySpendRatios"];
  if (Object.keys(record).some((key) => !allowed.includes(key))) {
    return { ok: false, reason: "payload contains unexpected fields" };
  }
  if (typeof record.period !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(record.period)) {
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
    if (typeof row.category !== "string" || !Number.isFinite(row.ratio) || row.ratio < 0 || row.ratio > 1) {
      return { ok: false, reason: "ratio row needs category + ratio" };
    }
    if (Object.keys(row).some((key) => !["category", "ratio"].includes(key))) {
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

export function normalizeAiTip(item, index, context = {}) {
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

  // Validate amountMinor against budget context
  let amountMinor = null;
  const maxAllowed = context.limitBudgetMinor ?? (1_000_000_000_000);
  if (item.amountMinor !== undefined && item.amountMinor !== null) {
    if (!Number.isSafeInteger(item.amountMinor) || item.amountMinor < 0 || item.amountMinor > maxAllowed) {
      // Reject invalid, negative, or unreasonable claimed amount that exceeds the budget
      return null;
    }
    amountMinor = item.amountMinor;
  }

  // Sanitize text if Gemini hallucinated raw centavos as pesos:
  // e.g. if the budget was 150000 centavos (₱1,500), but text said ₱150,000 or 150,000 pesos
  const limitMinor = context.limitBudgetMinor ?? 0;
  if (limitMinor > 0 && limitMinor < 10_000_000) {
    const currency = context.currencySymbol || "₱";
    const rawCentavoPattern = new RegExp(`(?:\\${currency}|PHP|Php|₱)\\s*${limitMinor}\\b`, "i");
    if (rawCentavoPattern.test(title) || rawCentavoPattern.test(meta)) {
      return null;
    }
  }

  return {
    id: `ai-${index}-${title.slice(0, 12).replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`,
    emoji: typeof item.emoji === "string" && item.emoji.length > 0 ? item.emoji : "✨",
    title,
    meta: meta || "AI suggestion from your budget summary",
    tag: typeof item.tag === "string" && item.tag.length > 0 ? item.tag : "AI",
    amountMinor,
    category: typeof item.category === "string" ? item.category.trim() : null,
    isEstimate: typeof item.isEstimate === "boolean" ? item.isEstimate : false,
    source: "ai",
  };
}

/**
 * Request AI tips. Returns null on any failure so callers show appropriate unavailable state.
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

  const result = await requestAiProxyTips({
    path: "/v1/smart-tips",
    payload: options.payload,
    enabled: options.enabled,
    consentAccepted: options.consentAccepted,
    fetchImpl: options.fetchImpl,
    backendUrl: options.backendUrl,
    appCheckToken: options.appCheckToken,
  });
  if (!result?.length) return null;
  const tips = result.map((tip, index) => normalizeAiTip(tip, index, options.payload)).filter(Boolean);
  if (tips.length === 0) return null;
  responseCache.set(cacheKey(options.payload), {
    expiresAt: (options.now ?? Date.now()) + CACHE_TTL_MS,
    tips,
  });
  return tips;
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
