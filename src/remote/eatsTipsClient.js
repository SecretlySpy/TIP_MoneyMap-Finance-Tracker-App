/**
 * Optional AI explanations for Student Eats.
 * Follows Smart Tips privacy: consent + anonymized payload only; never precise coords.
 * Dedicated fetch module (with placesClient + smartTipsClient).
 */

import { requestAiProxyTips } from "./aiProxyClient";
import {
  assertAnonymizedEatsPayload,
  buildAnonymizedEatsPayload,
} from "../domain/services/eatsRanking";

const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map();

export function clearEatsTipsCache() {
  cache.clear();
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
    return null;
  }
  const payload = buildAnonymizedEatsPayload({
    places: options.places,
    currencySymbol: options.currencySymbol,
    dailyFoodBudgetMinor: options.dailyFoodBudgetMinor,
  });
  const shape = assertAnonymizedEatsPayload(payload);
  if (!shape.ok) {
    return null;
  }

  const key = JSON.stringify(payload);
  const cached = cache.get(key);
  const now = options.now ?? Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.tips;
  }

  const result = await requestAiProxyTips({
    path: "/v1/eats-tips",
    payload,
    enabled: options.enabled,
    consentAccepted: options.consentAccepted,
    fetchImpl: options.fetchImpl,
    backendUrl: options.backendUrl,
    appCheckToken: options.appCheckToken,
  });
  if (!result?.length) return null;
  const tips = result.slice(0, 4).map((tip, index) => ({
    id: "eats-ai-" + index,
    emoji: typeof tip.emoji === "string" ? tip.emoji : "🍽️",
    title: typeof tip.title === "string" ? tip.title.trim() : "",
    meta: typeof tip.meta === "string" ? tip.meta : "Student tip",
  })).filter((tip) => tip.title.length > 0);
  if (tips.length === 0) return null;
  cache.set(key, { expiresAt: now + CACHE_TTL_MS, tips });
  return tips;
}
