/**
 * Free places data via OpenStreetMap Overpass API.
 * THE dedicated network client for place search (alongside smartTips / eats tips clients).
 */

import {
  TIP_QC_CAMPUS,
  rankPlaces,
} from "../domain/services/eatsRanking";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const FETCH_TIMEOUT_MS = 18_000;
const CACHE_TTL_MS = 10 * 60 * 1000;

/** @type {Map<string, { expiresAt: number, places: object[] }>} */
const cache = new Map();

function cacheKey(origin, radiusM) {
  // Round origin to ~100m so cache hits without storing precise trails.
  const lat = Math.round(origin.latitude * 1000) / 1000;
  const lon = Math.round(origin.longitude * 1000) / 1000;
  return `${lat},${lon},${radiusM}`;
}

export function clearPlacesCache() {
  cache.clear();
}

/**
 * @param {{ latitude: number, longitude: number }} origin
 * @param {number} radiusM
 */
function buildOverpassQuery(origin, radiusM) {
  const { latitude, longitude } = origin;
  // Food-related amenities around the origin.
  return `
[out:json][timeout:25];
(
  node["amenity"~"restaurant|fast_food|cafe|food_court|canteen"](around:${radiusM},${latitude},${longitude});
  way["amenity"~"restaurant|fast_food|cafe|food_court|canteen"](around:${radiusM},${latitude},${longitude});
  node["shop"="bakery"](around:${radiusM},${latitude},${longitude});
);
out center tags 40;
`.trim();
}

/**
 * @param {{
 *   origin?: { latitude: number, longitude: number },
 *   radiusM?: number,
 *   fetchImpl?: typeof fetch,
 *   now?: number,
 * }} [options]
 * @returns {Promise<{ places: object[], origin: object, source: string, fromCache: boolean, errorMessage: string|null }>}
 */
export async function fetchNearbyEats(options = {}) {
  const origin = options.origin ?? TIP_QC_CAMPUS;
  const radiusM = options.radiusM ?? 1500;
  const now = options.now ?? Date.now();
  const key = cacheKey(origin, radiusM);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return {
      places: hit.places,
      origin: { ...origin, label: origin.label ?? "Current area" },
      source: "cache",
      fromCache: true,
      errorMessage: null,
    };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return {
      places: [],
      origin,
      source: "none",
      fromCache: false,
      errorMessage: "Network unavailable.",
    };
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;

  try {
    const query = buildOverpassQuery(origin, radiusM);
    const response = await fetchImpl(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "application/json",
        // Identify the app politely for OSM usage policy.
        "User-Agent": "MoneyMap-StudentEats/0.1 (offline-first student finance app)",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller?.signal,
    });

    if (!response.ok) {
      // Fallback: Nominatim text search near campus (coarser).
      return fetchNominatimFallback(origin, radiusM, fetchImpl, now);
    }

    const body = await response.json();
    const places = rankPlaces(body.elements ?? [], origin, {
      maxDistanceM: radiusM,
      limit: 25,
    });
    cache.set(key, { expiresAt: now + CACHE_TTL_MS, places });
    return {
      places,
      origin: { ...origin, label: origin.label ?? "Near you" },
      source: "overpass",
      fromCache: false,
      errorMessage: places.length === 0 ? "No food places found in range. Try again later." : null,
    };
  } catch {
    try {
      return await fetchNominatimFallback(origin, radiusM, fetchImpl, now);
    } catch {
      return {
        places: [],
        origin,
        source: "error",
        fromCache: false,
        errorMessage: "Could not load places. Showing offline tip: try campus canteen or carinderias nearby.",
      };
    }
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

async function fetchNominatimFallback(origin, radiusM, fetchImpl, now) {
  const url =
    `${NOMINATIM_URL}?format=json&limit=20&q=${encodeURIComponent("restaurant near TIP Quezon City")}`
    + `&viewbox=${origin.longitude - 0.02},${origin.latitude + 0.02},${origin.longitude + 0.02},${origin.latitude - 0.02}`
    + "&bounded=1";
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MoneyMap-StudentEats/0.1 (offline-first student finance app)",
    },
  });
  if (!response.ok) {
    throw new Error("nominatim failed");
  }
  const rows = await response.json();
  const elements = (Array.isArray(rows) ? rows : []).map((row, index) => ({
    id: row.place_id ?? index,
    lat: Number(row.lat),
    lon: Number(row.lon),
    tags: {
      name: row.display_name?.split(",")[0] ?? "Place",
      amenity: "restaurant",
    },
  }));
  const places = rankPlaces(elements, origin, { maxDistanceM: radiusM, limit: 20 });
  const key = cacheKey(origin, radiusM);
  cache.set(key, { expiresAt: now + CACHE_TTL_MS, places });
  return {
    places,
    origin: { ...origin, label: origin.label ?? "Near TIP QC" },
    source: "nominatim",
    fromCache: false,
    errorMessage: places.length === 0 ? "No places returned." : null,
  };
}
