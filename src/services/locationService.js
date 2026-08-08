/**
 * Location for Student Eats only.
 * - Permission requested when the feature is entered (caller responsibility).
 * - Coordinates are returned ephemerally — never written to SecureStore or DB.
 * - Falls back to TIP QC campus when denied / unavailable.
 */

import { TIP_QC_CAMPUS } from "../domain/services/eatsRanking";

/**
 * @typedef {{ latitude: number, longitude: number, label: string, isFallback: boolean, permission: string }} EatsOrigin
 */

let locationModulePromise = null;

async function loadLocationModule() {
  if (locationModulePromise !== null) {
    return locationModulePromise;
  }
  locationModulePromise = import("expo-location")
    .then((mod) => mod)
    .catch(() => null);
  return locationModulePromise;
}

/**
 * Request foreground permission (call when user opens Student Eats).
 * @returns {Promise<{ granted: boolean, status: string }>}
 */
export async function requestEatsLocationPermission() {
  const Location = await loadLocationModule();
  if (Location === null) {
    return { granted: false, status: "unavailable" };
  }
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.granted) {
      return { granted: true, status: existing.status ?? "granted" };
    }
    const asked = await Location.requestForegroundPermissionsAsync();
    return {
      granted: asked.granted === true,
      status: asked.status ?? (asked.granted ? "granted" : "denied"),
    };
  } catch {
    return { granted: false, status: "error" };
  }
}

/**
 * Resolve origin for ranking. Never persists coordinates.
 * @param {{ LocationImpl?: object }} [options] test seam
 * @returns {Promise<EatsOrigin>}
 */
export async function resolveEatsOrigin(options = {}) {
  const Location = options.LocationImpl
    ?? await loadLocationModule();
  if (Location === null) {
    return { ...TIP_QC_CAMPUS, isFallback: true, permission: "unavailable" };
  }
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) {
      return { ...TIP_QC_CAMPUS, isFallback: true, permission: permission.status ?? "denied" };
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy?.Balanced ?? 3,
    });
    const { latitude, longitude } = position.coords ?? {};
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { ...TIP_QC_CAMPUS, isFallback: true, permission: "granted" };
    }
    return {
      latitude,
      longitude,
      label: "Near you",
      isFallback: false,
      permission: "granted",
    };
  } catch {
    return { ...TIP_QC_CAMPUS, isFallback: true, permission: "error" };
  }
}

export { TIP_QC_CAMPUS };
