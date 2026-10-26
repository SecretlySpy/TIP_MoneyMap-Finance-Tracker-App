/**
 * Optional AI explanations for Student Eats.
 * Follows Smart Tips privacy: consent + anonymized payload only; never precise coords.
 * Dedicated fetch module (with placesClient + smartTipsClient).
 */

import { requestAiProxyTips } from "./aiProxyClient";
import { minorToWholePesos } from "../domain/services/money";
import { useUiStore } from "../store/uiStore";
import {
  assertAnonymizedEatsPayload,
  buildAnonymizedEatsPayload,
} from "../domain/services/eatsRanking";

const CACHE_TTL_MS = 30 * 60 * 1000;
const NUMERIC_CLAIM = /[\p{N}\p{Sc}]|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|half|quarter|isa|dalawa|tatlo|apat|lima|anim|pito|walo|siyam|sampu|daan|libo|php|usd|pesos?|piso|centavos?|dollars?|bucks?)\b/iu;
const cache = new Map();
let cacheGeneration = 0;

useUiStore.subscribe((state, previous) => {
  const consent = state.onlinePersonalizationConsentAccepted ?? state.smartTipsConsentAccepted;
  const previouslyConsented = previous.onlinePersonalizationConsentAccepted ?? previous.smartTipsConsentAccepted;
  const enabled = state.onlinePersonalizationEnabled ?? state.smartTipsEnabled;
  const previouslyEnabled = previous.onlinePersonalizationEnabled ?? previous.smartTipsEnabled;
  if ((previouslyConsented && !consent) || (previouslyEnabled && !enabled)
    || state.localDataGeneration !== previous.localDataGeneration) {
    clearEatsTipsCache();
  }
});

export function clearEatsTipsCache() {
  cache.clear();
  cacheGeneration += 1;
}

/**
 * @param {{
 *   enabled: boolean,
 *   consentAccepted: boolean,
 *   places: object[],
 *   currencySymbol?: string,
 *   dailyFoodBudgetMinor?: number|null,
 *   fetchImpl?: typeof fetch,
 *   now?: number,
 * }} options
 * @returns {Promise<object[]|null>}
 */
export async function fetchEatsAiTips(options) {
  if (!options.enabled || !options.consentAccepted) {
    clearEatsTipsCache();
    return null;
  }
  if (options.currencySymbol !== "₱") {
    return null;
  }
  if (options.dailyFoodBudgetMinor != null
    && (!Number.isSafeInteger(options.dailyFoodBudgetMinor) || options.dailyFoodBudgetMinor < 0)) return null;
  const legacyPayload = buildAnonymizedEatsPayload({
    places: options.places,
    currencySymbol: options.currencySymbol,
    dailyFoodBudgetMinor: options.dailyFoodBudgetMinor,
  });
  const shape = assertAnonymizedEatsPayload(legacyPayload);
  if (!shape.ok) {
    return null;
  }
  const { dailyFoodBudgetMinor, ...safeFields } = legacyPayload;
  const payload = {
    contractVersion: 2,
    moneyUnit: "PHP_WHOLE_PESOS_V2",
    ...safeFields,
    places: safeFields.places.map(({ placeId, ...place }) => ({ id: placeId, ...place })),
    dailyFoodBudgetPesos: dailyFoodBudgetMinor === null ? null : minorToWholePesos(dailyFoodBudgetMinor),
  };
  if (payload.dailyFoodBudgetPesos !== null && payload.dailyFoodBudgetPesos > 10_000_000_000) return null;
  if (payload.places.some((place) => !place.id || !place.name || !Number.isInteger(place.priceLevel)
    || place.priceLevel < 1 || place.priceLevel > 4 || !Number.isFinite(place.rating)
    || place.rating < 0 || place.rating > 5 || !Number.isFinite(place.score)
    || place.score < 0 || place.score > 100)) return null;

  const key = JSON.stringify(payload);
  const cached = cache.get(key);
  const now = options.now ?? Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.tips;
  }

  const generation = cacheGeneration;
  const result = await requestAiProxyTips({
    path: "/v1/eats-tips",
    payload,
    enabled: options.enabled,
    consentAccepted: options.consentAccepted,
    fetchImpl: options.fetchImpl,
    backendUrl: options.backendUrl,
    appCheckToken: options.appCheckToken,
  });
  if (generation !== cacheGeneration || !result?.length) return null;
  const tips = result.slice(0, 4).map((tip, index) => {
    if (!tip || typeof tip !== "object" || Object.prototype.hasOwnProperty.call(tip, "amountMinor")) return null;
    const title = typeof tip.title === "string" ? tip.title.trim() : "";
    const meta = typeof tip.meta === "string" ? tip.meta.trim() : "Student tip";
    const tag = typeof tip.tag === "string" ? tip.tag.trim() : "";
    const category = typeof tip.category === "string" ? tip.category.trim() : "";
    // A model's prose is not an authoritative monetary value; only structured amounts are shown.
    if (!title || [title, meta, tag, category].some((text) => NUMERIC_CLAIM.test(text))) return null;
    const amountPesos = tip.amountPesos ?? null;
    if (amountPesos !== null && (!Number.isSafeInteger(amountPesos) || amountPesos < 0
      || amountPesos > 10_000_000_000 || tip.isEstimate !== true
      || payload.dailyFoodBudgetPesos === null
      || (payload.dailyFoodBudgetPesos !== null && amountPesos > payload.dailyFoodBudgetPesos))) return null;
    return {
      id: "eats-ai-" + index,
      emoji: typeof tip.emoji === "string" ? tip.emoji : "🍽️",
      title,
      meta,
      amountPesos,
      isEstimate: amountPesos !== null,
    };
  }).filter(Boolean);
  if (tips.length === 0) return null;
  cache.set(key, { expiresAt: now + CACHE_TTL_MS, tips });
  return tips;
}
