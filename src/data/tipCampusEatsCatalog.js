/**
 * Bundled Student Eats catalog for the TIP Quezon City campus.
 * Approximate public-vicinity positions for an offline academic demo.
 * This is not a live business directory and does not require a map SDK.
 */

import { rankPlaces, TIP_QC_CAMPUS } from "../domain/services/eatsRanking";

export const TIP_CAMPUS_EATS_CATALOG_VERSION = 1;

const METERS_PER_DEG_LAT = 111_320;

function offsetMeters(northM, eastM) {
  const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((TIP_QC_CAMPUS.latitude * Math.PI) / 180);
  return {
    lat: TIP_QC_CAMPUS.latitude + northM / METERS_PER_DEG_LAT,
    lon: TIP_QC_CAMPUS.longitude + eastM / metersPerDegLon,
  };
}

function bundledElement(id, name, northM, eastM, tags) {
  const { lat, lon } = offsetMeters(northM, eastM);
  return {
    id,
    lat,
    lon,
    tags: { name, ...tags },
  };
}

/**
 * Overpass-shaped elements so ranking stays on the shared pure pipeline.
 * Distances are relative to the documented TIP QC campus origin.
 */
export const TIP_CAMPUS_EATS_ELEMENTS = Object.freeze([
  bundledElement("bundled-tip-canteen", "TIP Main Canteen", 40, 15, {
    amenity: "canteen",
    cuisine: "filipino",
  }),
  bundledElement("bundled-aurora-silog", "Aurora Silog House", 60, 180, {
    amenity: "fast_food",
    cuisine: "filipino",
  }),
  bundledElement("bundled-carinderia", "Cubao Carinderia", -120, 220, {
    amenity: "restaurant",
    cuisine: "filipino",
  }),
  bundledElement("bundled-lugaw", "Lugaw & Goto Corner", 30, -140, {
    amenity: "fast_food",
    cuisine: "filipino",
  }),
  bundledElement("bundled-mami", "Campus Mami House", 250, -40, {
    amenity: "fast_food",
    cuisine: "filipino",
  }),
  bundledElement("bundled-rice", "Budget Rice Meals", 180, 320, {
    amenity: "food_court",
    cuisine: "filipino",
  }),
  bundledElement("bundled-bakery", "Pandesal Bakery", -160, -90, {
    shop: "bakery",
  }),
  bundledElement("bundled-shawarma", "Shawarma Stall", 20, 360, {
    amenity: "fast_food",
  }),
  bundledElement("bundled-milk-tea", "Campus Milk Tea", 310, 80, {
    amenity: "cafe",
  }),
  bundledElement("bundled-chicken", "Chicken Combo Box", 90, -280, {
    amenity: "fast_food",
  }),
  bundledElement("bundled-eatery", "Student Eatery", -90, 40, {
    amenity: "canteen",
    cuisine: "filipino",
  }),
  bundledElement("bundled-food-court", "Nearby Food Court Kiosk", -480, 160, {
    amenity: "food_court",
  }),
]);

/**
 * @param {{ latitude: number, longitude: number }} [origin]
 * @param {{ maxDistanceM?: number, limit?: number }} [options]
 */
export function getBundledCampusPlaces(origin = TIP_QC_CAMPUS, options = {}) {
  return rankPlaces(TIP_CAMPUS_EATS_ELEMENTS, origin, {
    maxDistanceM: options.maxDistanceM ?? 1500,
    limit: options.limit ?? 25,
  });
}
