/**
 * Student Eats location service.
 * Supports requesting foreground location permissions and resolving current location.
 * When permission is denied, unrequested, or unavailable, cleanly falls back to
 * the fixed TIP Quezon City campus location and clearly labels it as campus-based.
 * Coordinates are never persistently stored.
 */

import { TIP_QC_CAMPUS } from "../domain/services/eatsRanking";

function getExpoLocation() {
  try {
    // eslint-disable-next-line global-require
    return require("expo-location");
  } catch {
    return null;
  }
}

/**
 * @typedef {{ latitude: number, longitude: number, label: string, isFallback: boolean, permission: string }} EatsOrigin
 */

export async function requestEatsLocationPermission(options = {}) {
  const Location = options.LocationImpl ?? getExpoLocation();
  if (Location === null || typeof Location.requestForegroundPermissionsAsync !== "function") {
    return { granted: false, status: "unavailable" };
  }
  try {
    const res = await Location.requestForegroundPermissionsAsync();
    return { granted: Boolean(res?.granted), status: res?.status ?? "denied" };
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
  const Location = options.LocationImpl ?? getExpoLocation();
  if (Location === null) {
    return { ...TIP_QC_CAMPUS, isFallback: true, permission: "not-requested", label: "TIP Quezon City (Campus)" };
  }
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission?.granted) {
      return {
        ...TIP_QC_CAMPUS,
        isFallback: true,
        permission: permission?.status ?? "denied",
        label: "TIP Quezon City (Campus)",
      };
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy?.Balanced ?? 3,
    });
    const { latitude, longitude } = position?.coords ?? {};
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return {
        ...TIP_QC_CAMPUS,
        isFallback: true,
        permission: "granted",
        label: "TIP Quezon City (Campus)",
      };
    }
    return {
      latitude,
      longitude,
      label: "Current location",
      isFallback: false,
      permission: "granted",
    };
  } catch {
    return {
      ...TIP_QC_CAMPUS,
      isFallback: true,
      permission: "error",
      label: "TIP Quezon City (Campus)",
    };
  }
}

export { TIP_QC_CAMPUS };
