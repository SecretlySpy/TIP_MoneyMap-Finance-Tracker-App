/**
 * Live Google Places discovery for Student Eats via secure Cloud Run AI proxy.
 * Complies with Google Maps Platform Terms of Service:
 * - Only Google Places (New) is used for place discovery.
 * - In-memory session cache only (10 min TTL) - no long-term persistent storage of places.
 * - When online personalization is disabled, no places are fetched or returned as recommendations.
 * - When offline/unavailable, an informative unavailable state is returned without fallback to offline catalog.
 */

import { TIP_QC_CAMPUS } from "../domain/services/eatsRanking";
import { requestAiProxyPlaces } from "./aiProxyClient";

export const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes session cache

/** @type {Map<string, { expiresAt: number, places: object[], attribution?: string }>} */
const cache = new Map();

function cacheKey(origin, radiusM) {
  const lat = Math.round(origin.latitude * 1000) / 1000;
  const lon = Math.round(origin.longitude * 1000) / 1000;
  return `${lat},${lon},${radiusM}`;
}

export function clearPlacesCache() {
  cache.clear();
}

/**
 * @param {{
 *   origin?: { latitude: number, longitude: number, label?: string },
 *   radiusM?: number,
 *   enabled?: boolean,
 *   consentAccepted?: boolean,
 *   fetchImpl?: typeof fetch,
 *   now?: number,
 *   backendUrl?: string,
 *   appCheckToken?: string,
 *   skipNetwork?: boolean,
 *   persistentCache?: any,
 * }} [options]
 * @returns {Promise<{ places: object[], origin: object, source: string, fromCache: boolean, attribution?: string, errorMessage: string|null }>}
 */
export async function fetchNearbyEats(options = {}) {
  const origin = options.origin ?? TIP_QC_CAMPUS;
  const radiusM = options.radiusM ?? 1500;
  const now = options.now ?? Date.now();
  const enabled = options.enabled ?? true;
  const consentAccepted = options.consentAccepted ?? true;

  // Gating: When Online Personalization is disabled or consent not given,
  // do NOT query or return recommendations.
  if (!enabled || !consentAccepted) {
    return {
      places: [],
      origin: { ...origin, label: origin.label ?? "Near you" },
      source: "disabled",
      fromCache: false,
      errorMessage: "Online personalization is disabled.",
    };
  }

  const key = cacheKey(origin, radiusM);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return {
      places: hit.places,
      origin: { ...origin, label: origin.label ?? "Near you" },
      source: "cache",
      fromCache: true,
      attribution: hit.attribution || "Powered by Google",
      errorMessage: null,
    };
  }

  if (options.skipNetwork === true) {
    return {
      places: [],
      origin: { ...origin, label: origin.label ?? "Near you" },
      source: "unavailable",
      fromCache: false,
      errorMessage: "Network requests are disabled.",
    };
  }

  try {
    const proxyResult = await requestAiProxyPlaces({
      payload: {
        latitude: origin.latitude,
        longitude: origin.longitude,
        radiusM,
        maxResults: 20,
      },
      enabled,
      consentAccepted,
      fetchImpl: options.fetchImpl,
      backendUrl: options.backendUrl,
      appCheckToken: options.appCheckToken,
    });

    if (proxyResult && Array.isArray(proxyResult.places)) {
      const places = proxyResult.places;
      const attribution = proxyResult.attribution || "Powered by Google";
      cache.set(key, { expiresAt: now + CACHE_TTL_MS, places, attribution });
      return {
        places,
        origin: { ...origin, label: origin.label ?? "Near you" },
        source: "google_places",
        fromCache: false,
        attribution,
        errorMessage: null,
      };
    }

    return {
      places: [],
      origin: { ...origin, label: origin.label ?? "Near you" },
      source: "unavailable",
      fromCache: false,
      errorMessage: "Nearby places are temporarily unavailable.",
    };
  } catch {
    return {
      places: [],
      origin: { ...origin, label: origin.label ?? "Near you" },
      source: "unavailable",
      fromCache: false,
      errorMessage: "Nearby places are temporarily unavailable.",
    };
  }
}
