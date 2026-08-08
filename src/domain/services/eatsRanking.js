/**
 * Pure ranking for Student Eats Near Me.
 * All inputs are plain data — no I/O, no location storage.
 */

/** TIP Quezon City campus (approx. main gate area). Used only as fallback origin. */
export const TIP_QC_CAMPUS = Object.freeze({
  latitude: 14.62548,
  longitude: 121.06135,
  label: "TIP Quezon City",
});

const EARTH_RADIUS_M = 6_371_000;

/**
 * Haversine distance in meters.
 * @param {{ latitude: number, longitude: number }} a
 * @param {{ latitude: number, longitude: number }} b
 */
export function distanceMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Student-friendly price level 1–4 from OSM tags (heuristic).
 * @param {Record<string, string|undefined>} tags
 * @returns {1|2|3|4}
 */
export function inferPriceLevel(tags = {}) {
  const name = String(tags.name ?? "").toLowerCase();
  const cuisine = String(tags.cuisine ?? "").toLowerCase();
  if (
    tags["diet:student"] === "yes"
    || /carinderia|turo-turo|canteen|cafeteria|karinderia|eatery|silog|lugaw|goto|mami/.test(name)
    || /filipino|regional/.test(cuisine)
  ) {
    return 1;
  }
  if (tags.amenity === "fast_food" || /burger|chicken|pizza|shawarma|milk.?tea/.test(name)) {
    return 2;
  }
  if (tags.amenity === "cafe" || tags.amenity === "food_court") {
    return 2;
  }
  if (tags.amenity === "restaurant") {
    return 3;
  }
  return 2;
}

/**
 * Soft rating 0–5 from available signals (OSM rarely has stars).
 * @param {Record<string, string|undefined>} tags
 */
export function inferRating(tags = {}) {
  if (tags.stars) {
    const n = Number(tags.stars);
    if (Number.isFinite(n) && n >= 0 && n <= 5) {
      return n;
    }
  }
  let score = 3.2;
  if (tags.outdoor_seating === "yes") score += 0.2;
  if (tags.wheelchair === "yes") score += 0.1;
  if (tags.cuisine) score += 0.15;
  if (tags.opening_hours) score += 0.1;
  if (tags["payment:gcash"] === "yes" || tags["payment:maya"] === "yes") score += 0.2;
  return Math.min(5, Math.round(score * 10) / 10);
}

/**
 * Student heuristic boost 0–1.
 * @param {{ name: string, tags?: Record<string, string|undefined>, priceLevel: number }} place
 */
export function studentBoost(place) {
  const name = String(place.name ?? "").toLowerCase();
  const tags = place.tags ?? {};
  let boost = 0;
  if (place.priceLevel <= 2) boost += 0.35;
  if (/rice|silog|carinderia|canteen|budget|combo|unli/.test(name)) boost += 0.25;
  if (tags.amenity === "fast_food" || tags.amenity === "food_court") boost += 0.15;
  if (tags["diet:vegetarian"] === "yes") boost += 0.05;
  return Math.min(1, boost);
}

/**
 * Composite score in [0, 100]. Higher is better for students.
 * Weights: distance 40%, price 25%, rating 20%, student heuristics 15%.
 *
 * @param {{
 *   distanceM: number,
 *   priceLevel: number,
 *   rating: number,
 *   name?: string,
 *   tags?: Record<string, string|undefined>,
 * }} place
 * @param {{ maxDistanceM?: number }} [options]
 */
export function scorePlace(place, options = {}) {
  const maxDistanceM = options.maxDistanceM ?? 2000;
  const dist = Math.max(0, place.distanceM);
  const distanceScore = Math.max(0, 1 - dist / maxDistanceM);
  const priceScore = (5 - Math.min(4, Math.max(1, place.priceLevel))) / 4;
  const ratingScore = Math.min(5, Math.max(0, place.rating)) / 5;
  const boost = studentBoost(place);
  const raw =
    distanceScore * 0.4
    + priceScore * 0.25
    + ratingScore * 0.2
    + boost * 0.15;
  return Math.round(raw * 1000) / 10;
}

/**
 * Normalize Overpass elements → ranked place list.
 *
 * @param {Array<object>} elements Overpass elements
 * @param {{ latitude: number, longitude: number }} origin
 * @param {{ maxDistanceM?: number, limit?: number }} [options]
 */
export function rankPlaces(elements, origin, options = {}) {
  const maxDistanceM = options.maxDistanceM ?? 2000;
  const limit = options.limit ?? 30;
  const places = [];

  for (const el of elements ?? []) {
    const tags = el.tags ?? {};
    const name = tags.name?.trim();
    if (!name) {
      continue;
    }
    const latitude = el.lat ?? el.center?.lat;
    const longitude = el.lon ?? el.center?.lon;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }
    const distanceM = Math.round(distanceMeters(origin, { latitude, longitude }));
    if (distanceM > maxDistanceM) {
      continue;
    }
    const priceLevel = inferPriceLevel(tags);
    const rating = inferRating(tags);
    const place = {
      id: String(el.id ?? `${latitude},${longitude},${name}`),
      name,
      latitude,
      longitude,
      distanceM,
      priceLevel,
      rating,
      cuisine: tags.cuisine ?? null,
      amenity: tags.amenity ?? tags.shop ?? "food",
      tags,
    };
    place.score = scorePlace(place, { maxDistanceM });
    places.push(place);
  }

  return places
    .sort((a, b) => b.score - a.score || a.distanceM - b.distanceM)
    .slice(0, limit)
    .map(({ tags: _tags, ...rest }) => rest);
}

/**
 * Format distance for UI.
 * @param {number} meters
 */
export function formatDistance(meters) {
  if (!Number.isFinite(meters) || meters < 0) {
    return "—";
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Anonymized payload for optional AI explanations — never includes precise coords.
 * @param {{ places: Array<object>, currencySymbol?: string, dailyFoodBudgetMinor?: number|null }} input
 */
export function buildAnonymizedEatsPayload(input) {
  const places = (input.places ?? []).slice(0, 8).map((p) => ({
    name: String(p.name).slice(0, 48),
    distanceBand:
      p.distanceM < 300 ? "very_near"
        : p.distanceM < 800 ? "near"
          : p.distanceM < 1500 ? "walkable"
            : "farther",
    priceLevel: p.priceLevel,
    rating: p.rating,
    cuisine: p.cuisine ? String(p.cuisine).slice(0, 32) : null,
    score: p.score,
  }));
  return {
    context: "student_eats_near_campus",
    currencySymbol: String(input.currencySymbol ?? "₱").slice(0, 4),
    dailyFoodBudgetMinor:
      Number.isSafeInteger(input.dailyFoodBudgetMinor) && input.dailyFoodBudgetMinor >= 0
        ? input.dailyFoodBudgetMinor
        : null,
    // Coarse area only — never lat/lon.
    areaHint: "TIP Quezon City vicinity",
    places,
  };
}

/**
 * @param {unknown} payload
 */
export function assertAnonymizedEatsPayload(payload) {
  if (payload === null || typeof payload !== "object") {
    return { ok: false, reason: "payload must be an object" };
  }
  const record = /** @type {Record<string, unknown>} */ (payload);
  const forbidden = [
    "latitude", "longitude", "lat", "lon", "coordinates",
    "preciseLocation", "userId", "transactions", "notes",
  ];
  const json = JSON.stringify(record);
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return { ok: false, reason: `forbidden field: ${key}` };
    }
  }
  if (/"latitude"|"longitude"/.test(json)) {
    return { ok: false, reason: "coordinates leaked in payload" };
  }
  if (record.context !== "student_eats_near_campus") {
    return { ok: false, reason: "invalid context" };
  }
  if (!Array.isArray(record.places)) {
    return { ok: false, reason: "places must be an array" };
  }
  return { ok: true };
}
