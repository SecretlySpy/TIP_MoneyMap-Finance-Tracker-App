import { clearEatsTipsCache, fetchEatsAiTips } from "../src/remote/eatsTipsClient";
import { requestAiProxyTips } from "../src/remote/aiProxyClient";
import { useUiStore } from "../src/store/uiStore";
import { eats } from "../backend/moneymap-ai/src/handler.cjs";

jest.mock("../src/remote/aiProxyClient", () => ({ requestAiProxyTips: jest.fn() }));

const options = {
  enabled: true,
  consentAccepted: true,
  currencySymbol: "₱",
  dailyFoodBudgetMinor: 10_050,
  places: [{ id: "place-1", name: "Campus Canteen", distanceM: 250, priceLevel: 1, rating: 4, score: 80 }],
};

beforeEach(() => {
  clearEatsTipsCache();
  requestAiProxyTips.mockReset();
  useUiStore.setState({ onlinePersonalizationConsentAccepted: true });
});

it("sends only anonymized v2 peso budget, caches validated structured amounts", async () => {
  requestAiProxyTips.mockResolvedValue([{ title: "Choose the canteen", meta: "Affordable meal", amountPesos: 100, isEstimate: true }]);
  expect(await fetchEatsAiTips(options)).toEqual([expect.objectContaining({ amountPesos: 100 })]);
  const payload = requestAiProxyTips.mock.calls[0][0].payload;
  expect(payload).toEqual(expect.objectContaining({
    contractVersion: 2,
    moneyUnit: "PHP_WHOLE_PESOS_V2",
    currencySymbol: "₱",
    dailyFoodBudgetPesos: 101,
  }));
  expect(JSON.stringify(payload)).not.toMatch(/dailyFoodBudgetMinor|latitude|longitude/);
  expect(payload.places[0]).toEqual(expect.objectContaining({ id: "place-1" }));
  expect(payload.places[0]).not.toHaveProperty("placeId");
  expect(eats(payload)).toBe(true);
  expect(await fetchEatsAiTips(options)).toHaveLength(1);
  expect(requestAiProxyTips).toHaveBeenCalledTimes(1);
});

it("rejects numeric model text, legacy amounts and amounts beyond the daily budget", async () => {
  requestAiProxyTips.mockResolvedValue([
    { title: "Save ₱20", amountPesos: 20, isEstimate: true },
    { title: "Eat lunch", amountMinor: 500 },
    { title: "Choose lunch", amountPesos: 102, isEstimate: true },
    { title: "Try the canteen", meta: "Affordable meals", amountPesos: 75, isEstimate: true },
  ]);
  expect(await fetchEatsAiTips(options)).toEqual([expect.objectContaining({ title: "Try the canteen", amountPesos: 75 })]);
});

it("does not send without consent or for non-peso currency, clears stale cache on revoke", async () => {
  requestAiProxyTips.mockResolvedValue([{ title: "Try the canteen" }]);
  await fetchEatsAiTips(options);
  useUiStore.setState({ onlinePersonalizationConsentAccepted: false });
  expect(await fetchEatsAiTips({ ...options, consentAccepted: false })).toBeNull();
  expect(await fetchEatsAiTips({ ...options, currencySymbol: "$" })).toBeNull();
  expect(requestAiProxyTips).toHaveBeenCalledTimes(1);
  useUiStore.setState({ onlinePersonalizationConsentAccepted: true });
  await fetchEatsAiTips(options);
  expect(requestAiProxyTips).toHaveBeenCalledTimes(2);
});

it("discards an in-flight response after consent withdrawal", async () => {
  let resolve;
  requestAiProxyTips.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const pending = fetchEatsAiTips(options);
  useUiStore.setState({ onlinePersonalizationConsentAccepted: false });
  resolve([{ title: "Try the canteen" }]);
  expect(await pending).toBeNull();
});
