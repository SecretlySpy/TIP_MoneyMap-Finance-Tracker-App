/**
 * Optional AI explanations for Student Eats.
 * Follows Smart Tips privacy: consent + anonymized payload only; never precise coords.
 * Dedicated fetch module (with placesClient + smartTipsClient).
 */

import Constants from "expo-constants";
import {
  assertAnonymizedEatsPayload,
  buildAnonymizedEatsPayload,
} from "../domain/services/eatsRanking";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const CACHE_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;

/** @type {Map<string, { expiresAt: number, tips: object[] }>} */
const cache = new Map();

function getGeminiApiKey() {
  const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};
  const key = extra.geminiApiKey ?? extra.GEMINI_API_KEY ?? "";
  return typeof key === "string" ? key.trim() : "";
}

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

  const apiKey = getGeminiApiKey();
  if (apiKey.length === 0) {
    return null;
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return null;
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;

  try {
    const prompt = [
      "You help Philippine college students pick affordable eats near campus.",
      "Given ONLY this anonymized JSON (no coordinates), return a JSON array of up to 4 tip objects:",
      '{"emoji":"string","title":"string","meta":"string"}',
      "No markdown outside the array. Prefer budget rice meals, carinderia, and walking distance bands.",
      JSON.stringify(payload),
    ].join("\n");

    const response = await fetchImpl(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller?.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
      }),
    });
    if (!response.ok) {
      return null;
    }
    const body = await response.json();
    const text = body?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text ?? "")
      .join("\n") ?? "";
    const tips = parseTips(text);
    if (tips.length === 0) {
      return null;
    }
    cache.set(key, { expiresAt: now + CACHE_TTL_MS, tips });
    return tips;
  } catch {
    return null;
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

function parseTips(text) {
  const trimmed = String(text ?? "").trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fence ? fence[1].trim() : trimmed;
  try {
    const start = candidate.indexOf("[");
    const end = candidate.lastIndexOf("]");
    if (start < 0 || end <= start) {
      return [];
    }
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.slice(0, 4).map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const title = typeof item.title === "string" ? item.title.trim() : "";
      if (!title) {
        return null;
      }
      return {
        id: `eats-ai-${index}`,
        emoji: typeof item.emoji === "string" && item.emoji ? item.emoji : "🍽️",
        title,
        meta: typeof item.meta === "string" ? item.meta : "Student tip",
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}
