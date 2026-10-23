import { registerAiAppCheckProvider, requestAiProxyTips } from "../src/remote/aiProxyClient";

const payload = {
  period: "2026-10", currencySymbol: "₱",
  remainingBudgetMinor: 100, limitBudgetMinor: 200, spentBudgetMinor: 100,
  categorySpendRatios: [],
};

afterEach(() => registerAiAppCheckProvider(null));

test("never sends requests without explicit opt-in", async () => {
  const fetchImpl = jest.fn();
  const options = {
    path: "/v1/smart-tips", payload,
    backendUrl: "https://example.test", appCheckToken: "synthetic-attestation-token",
    consentAccepted: true, enabled: true, fetchImpl,
  };
  expect(await requestAiProxyTips({ ...options, enabled: false })).toBeNull();
  expect(await requestAiProxyTips({ ...options, consentAccepted: false })).toBeNull();
  expect(fetchImpl).not.toHaveBeenCalled();
});
test("fails closed when a valid attestation token is missing", async () => {
  const fetchImpl = jest.fn();
  const result = await requestAiProxyTips({
    path: "/v1/smart-tips", payload, enabled: true, consentAccepted: true,
    backendUrl: "https://example.test", fetchImpl,
  });
  expect(result).toBeNull();
  expect(fetchImpl).not.toHaveBeenCalled();
});
test("rejects insecure backend URLs", async () => {
  const fetchImpl = jest.fn();
  expect(await requestAiProxyTips({
    path: "/v1/smart-tips", payload, enabled: true, consentAccepted: true,
    backendUrl: "http://example.test", appCheckToken: "synthetic-attestation-token", fetchImpl,
  })).toBeNull();
  expect(fetchImpl).not.toHaveBeenCalled();
});
test("sends only the expected payload and attestation headers", async () => {
  const fetchImpl = jest.fn(async () => ({ ok: true, json: async () => ({ tips: [{ title: "Pack lunch", meta: "Save ₱50" }] }) }));
  const tips = await requestAiProxyTips({
    path: "/v1/smart-tips", payload, enabled: true, consentAccepted: true,
    backendUrl: "https://example.test", appCheckToken: "synthetic-attestation-token", fetchImpl,
  });
  expect(tips).toHaveLength(1);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  const [url, options] = fetchImpl.mock.calls[0];
  expect(url).toBe("https://example.test/v1/smart-tips");
  expect(options.headers["X-Firebase-AppCheck"]).toBe("synthetic-attestation-token");
  expect(options.headers["X-MoneyMap-Consent"]).toBe("1");
  expect(options.headers).not.toHaveProperty("x-goog-api-key");
  expect(JSON.parse(options.body)).toEqual(payload);
});
test("falls back on quota failure", async () => {
  const fetchImpl = jest.fn(async () => ({ ok: false, status: 429 }));
  expect(await requestAiProxyTips({
    path: "/v1/smart-tips", payload, enabled: true, consentAccepted: true,
    backendUrl: "https://example.test", appCheckToken: "synthetic-attestation-token", fetchImpl,
  })).toBeNull();
});
