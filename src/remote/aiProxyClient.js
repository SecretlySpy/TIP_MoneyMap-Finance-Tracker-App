/**
 * Secure opt-in AI proxy. No Gemini credentials are shipped with the mobile app.
 * Register a native Firebase App Check token provider after Firebase setup.
 */
const REQUEST_TIMEOUT_MS = 12_000;
let appCheckProvider = null;
let customAiUrl = "";

export function registerAiAppCheckProvider(provider) {
  appCheckProvider = typeof provider === "function" ? provider : null;
}

export function setAiProxyUrl(url) {
  customAiUrl = typeof url === "string" ? url.trim() : "";
}

export function getAiProxyUrl() {
  if (customAiUrl) return customAiUrl;
  const envVal = typeof process !== "undefined" && process?.env
    ? (process.env.EXPO_PUBLIC_MONEYMAP_AI_URL || process.env.MONEYMAP_AI_URL || "")
    : "";
  return String(envVal || "").trim();
}

export function isAiProxyConfigured(customUrl) {
  const url = customUrl !== undefined ? String(customUrl) : getAiProxyUrl();
  return /^https:\/\/[^/\s]+$/.test(url.replace(/\/+$/, ""))
    && !!appCheckProvider;
}

export async function requestAiProxyTips({ path, payload, enabled, consentAccepted, fetchImpl, backendUrl, appCheckToken }) {
  if (!enabled || !consentAccepted) return null;
  const base = String(backendUrl || getAiProxyUrl()).replace(/\/+$/, "");
  if (!/^https:\/\/[^/\s]+$/.test(base) || !["/v1/smart-tips", "/v1/eats-tips"].includes(path)) return null;
  let token = appCheckToken;
  if (!token && appCheckProvider) {
    try { token = await appCheckProvider(false); } catch { return null; }
  }
  if (typeof token !== "string" || token.length < 16) return null;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  try {
    let response = await (fetchImpl || globalThis.fetch)(base + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MoneyMap-Consent": "1",
        "X-Firebase-AppCheck": token,
      },
      body: JSON.stringify(payload),
      signal: controller?.signal,
    });

    // If 401 (token expired) and using appCheckProvider, attempt one refresh retry
    if (response.status === 401 && !appCheckToken && typeof appCheckProvider === "function") {
      try {
        const refreshedToken = await appCheckProvider(true);
        if (typeof refreshedToken === "string" && refreshedToken.length >= 16) {
          response = await (fetchImpl || globalThis.fetch)(base + path, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-MoneyMap-Consent": "1",
              "X-Firebase-AppCheck": refreshedToken,
            },
            body: JSON.stringify(payload),
            signal: controller?.signal,
          });
        }
      } catch {
        // Fall back cleanly to null
      }
    }

    if (!response.ok) return null;
    const body = await response.json();
    return Array.isArray(body?.tips) && body.tips.length > 0 ? body.tips.slice(0, 4) : null;
  } catch {
    return null;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

export async function requestAiProxyPlaces({ payload, enabled, consentAccepted, fetchImpl, backendUrl, appCheckToken }) {
  if (!enabled || !consentAccepted) return null;
  const base = String(backendUrl || getAiProxyUrl()).replace(/\/+$/, "");
  if (!/^https:\/\/[^/\s]+$/.test(base)) return null;
  let token = appCheckToken;
  if (!token && appCheckProvider) {
    try { token = await appCheckProvider(false); } catch { return null; }
  }
  if (typeof token !== "string" || token.length < 16) return null;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  try {
    let response = await (fetchImpl || globalThis.fetch)(base + "/v1/places-nearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MoneyMap-Consent": "1",
        "X-Firebase-AppCheck": token,
      },
      body: JSON.stringify(payload),
      signal: controller?.signal,
    });

    if (response.status === 401 && !appCheckToken && typeof appCheckProvider === "function") {
      try {
        const refreshedToken = await appCheckProvider(true);
        if (typeof refreshedToken === "string" && refreshedToken.length >= 16) {
          response = await (fetchImpl || globalThis.fetch)(base + "/v1/places-nearby", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-MoneyMap-Consent": "1",
              "X-Firebase-AppCheck": refreshedToken,
            },
            body: JSON.stringify(payload),
            signal: controller?.signal,
          });
        }
      } catch {
        // Fall back cleanly to null
      }
    }

    if (!response.ok) return null;
    const body = await response.json();
    return Array.isArray(body?.places) ? body : null;
  } catch {
    return null;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

