/**
 * Student Eats uses the deterministic TIP QC campus origin.
 * GPS is unavailable until a supported location dependency is approved.
 */

import { TIP_QC_CAMPUS } from "../domain/services/eatsRanking";

/**
 * @typedef {{ latitude: number, longitude: number, label: string, isFallback: boolean, permission: string }} EatsOrigin
 */

export async function requestEatsLocationPermission() {
  return { granted: false, status: "not-requested" };
}

/**
 * Resolve origin for ranking. Never persists coordinates.
 * @param {{ LocationImpl?: object }} [options] test seam
 * @returns {Promise<EatsOrigin>}
 */
export async function resolveEatsOrigin(options = {}) {
  const Location = options.LocationImpl ?? null;
  if (Location === null) {
    return { ...TIP_QC_CAMPUS, isFallback: true, permission: "not-requested" };
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
