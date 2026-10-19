/**
 * Optional live places lookup via OpenStreetMap Overpass, with Nominatim fallback.
 * Student Eats is offline-first: the bundled TIP QC campus catalog always remains available.
 */

import { getBundledCampusPlaces } from "../data/tipCampusEatsCatalog";
import {
  TIP_QC_CAMPUS,
  rankPlaces,
} from "../domain/services/eatsRanking";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const FETCH_TIMEOUT_MS = 18_000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const PERSISTED_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const USER_AGENT = "MoneyMap-StudentEats/0.1 (offline-first student finance app)";

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

function bundledResult(origin, radiusM) {
  return {
    places: getBundledCampusPlaces(origin, { maxDistanceM: radiusM, limit: 25 }),
    origin: { ...origin, label: origin.label ?? TIP_QC_CAMPUS.label },
    source: "bundled",
    fromCache: false,
    errorMessage: null,
  };
}

async function readPersistentEntry(persistentCache, key) {
  if (persistentCache === null || typeof persistentCache.get !== "function") {
    return null;
  }
  try {
    const entry = await persistentCache.get(key);
    if (entry === null || typeof entry !== "object" || !Array.isArray(entry.places) || entry.places.length === 0) {
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function persistedResult(entry, origin) {
  return {
    places: entry.places,
    origin: entry.origin ?? { ...origin, label: origin.label ?? TIP_QC_CAMPUS.label },
    source: "persisted",
    fromCache: true,
    errorMessage: null,
  };
}

async function persistLiveResult(persistentCache, key, result, now) {
  if (persistentCache === null || typeof persistentCache.set !== "function") {
    return;
  }
  if (result.source === "bundled" || result.source === "persisted" || result.places.length === 0) {
    return;
  }
  try {
    await persistentCache.set(key, {
      places: result.places,
      origin: result.origin,
      source: result.source,
      expiresAt: now + PERSISTED_TTL_MS,
    });
  } catch {
    // Persistence is best-effort; bundled catalog still works.
  }
}

async function fallbackPlaces(origin, radiusM, persistentCache) {
  const key = cacheKey(origin, radiusM);
  const persisted = await readPersistentEntry(persistentCache, key);
  if (persisted !== null) {
    return persistedResult(persisted, origin);
  }
  return bundledResult(origin, radiusM);
}

/**
 * @param {{
 *   origin?: { latitude: number, longitude: number, label?: string },
 *   radiusM?: number,
 *   fetchImpl?: typeof fetch,
 *   now?: number,
 *   skipNetwork?: boolean,
 *   persistentCache?: { get: Function, set: Function } | null,
 * }} [options]
 * @returns {Promise<{ places: object[], origin: object, source: string, fromCache: boolean, errorMessage: string|null }>}
 */
export async function fetchNearbyEats(options = {}) {
  const origin = options.origin ?? TIP_QC_CAMPUS;
  const radiusM = options.radiusM ?? 1500;
  const now = options.now ?? Date.now();
  const persistentCache = options.persistentCache ?? null;
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
  if (options.skipNetwork === true || typeof fetchImpl !== "function") {
    return fallbackPlaces(origin, radiusM, persistentCache);
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
        "User-Agent": USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller?.signal,
    });

    if (!response.ok) {
      throw new Error("Overpass request failed.");
    }

    const body = await response.json();
    const places = rankPlaces(body.elements ?? [], origin, {
      maxDistanceM: radiusM,
      limit: 25,
    });
    if (places.length === 0) {
      throw new Error("Overpass returned no ranked places.");
    }
    cache.set(key, { expiresAt: now + CACHE_TTL_MS, places });
    const result = {
      places,
      origin: { ...origin, label: origin.label ?? "Near you" },
      source: "overpass",
      fromCache: false,
      errorMessage: null,
    };
    await persistLiveResult(persistentCache, key, result, now);
    return result;
  } catch {
    try {
      const nominatim = await fetchNominatimFallback(origin, radiusM, fetchImpl, now, controller?.signal);
      if (nominatim.places.length === 0) {
        throw new Error("Nominatim returned no ranked places.");
      }
      await persistLiveResult(persistentCache, key, nominatim, now);
      return nominatim;
    } catch {
      return fallbackPlaces(origin, radiusM, persistentCache);
    }
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

async function fetchNominatimFallback(origin, radiusM, fetchImpl, now, signal) {
  const url =
    `${NOMINATIM_URL}?format=json&limit=20&q=${encodeURIComponent("restaurant near TIP Quezon City")}`
    + `&viewbox=${origin.longitude - 0.02},${origin.latitude + 0.02},${origin.longitude + 0.02},${origin.latitude - 0.02}`
    + "&bounded=1";
  const response = await fetchImpl(url, {
    signal,
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
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
  if (places.length === 0) {
    throw new Error("Nominatim returned no ranked places.");
  }
  const key = cacheKey(origin, radiusM);
  cache.set(key, { expiresAt: now + CACHE_TTL_MS, places });
  return {
    places,
    origin: { ...origin, label: origin.label ?? "Near TIP QC" },
    source: "nominatim",
    fromCache: false,
    errorMessage: null,
  };
}
