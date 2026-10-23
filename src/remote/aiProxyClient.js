/**
 * Secure opt-in AI proxy. No Gemini credentials are shipped with the mobile app.
 * Register a native Firebase App Check token provider after Firebase setup.
 */
const REQUEST_TIMEOUT_MS = 12_000;
let appCheckProvider = null;

export function registerAiAppCheckProvider(provider) {
  appCheckProvider = typeof provider === "function" ? provider : null;
}

export function isAiProxyConfigured() {
  return /^https:\/\/[^/\s]+$/.test(process.env.EXPO_PUBLIC_MONEYMAP_AI_URL || "")
    && !!appCheckProvider;
}

export async function requestAiProxyTips({ path, payload, enabled, consentAccepted, fetchImpl, backendUrl, appCheckToken }) {
  if (!enabled || !consentAccepted) return null;
  const base = String(backendUrl || process.env.EXPO_PUBLIC_MONEYMAP_AI_URL || "").replace(/\/+$/, "");
  if (!/^https:\/\/[^/\s]+$/.test(base) || !["/v1/smart-tips", "/v1/eats-tips"].includes(path)) return null;
  let token = appCheckToken;
  if (!token && appCheckProvider) {
    try { token = await appCheckProvider(); } catch { return null; }
  }
  if (typeof token !== "string" || token.length < 16) return null;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  try {
    const response = await (fetchImpl || globalThis.fetch)(base + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MoneyMap-Consent": "1",
        "X-Firebase-AppCheck": token,
      },
      body: JSON.stringify(payload),
      signal: controller?.signal,
    });
    if (!response.ok) return null;
    const body = await response.json();
    return Array.isArray(body?.tips) && body.tips.length > 0 ? body.tips.slice(0, 4) : null;
  } catch {
    return null;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
