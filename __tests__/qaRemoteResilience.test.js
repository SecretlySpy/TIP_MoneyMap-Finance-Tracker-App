jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { extra: { geminiApiKey: "qa-synthetic-key" } } } }));
import { clearPlacesCache, fetchNearbyEats } from "../src/remote/placesClient";
import { assertAnonymizedPayload, clearSmartTipsCache, fetchSmartTipsFromGemini } from "../src/remote/smartTipsClient";
import { clearEatsTipsCache, fetchEatsAiTips } from "../src/remote/eatsTipsClient";

const payload = { period: "2026-09", currencySymbol: "₱", remainingBudgetMinor: 100, limitBudgetMinor: 200, spentBudgetMinor: 100, categorySpendRatios: [] };
const unavailable = () => ({ ok: false, status: 503 });
// This fetch double observes AbortSignal; no request leaves the test process.
const stall = (_url, options) => new Promise((_resolve, reject) => {
  if (options.signal?.aborted) return reject(new Error("aborted"));
  options.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
});

describe("QA remote boundary and deadline resilience", () => {
  beforeEach(() => { clearPlacesCache(); clearSmartTipsCache(); clearEatsTipsCache(); });
  afterEach(() => jest.useRealTimers());

  it("returns a controlled places error when both HTTP providers fail", async () => {
    const fetchImpl = jest.fn(async () => unavailable());
    await expect(fetchNearbyEats({ fetchImpl })).resolves.toMatchObject({ source: "error", places: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("aborts a stalled Nominatim fallback within the original 18-second deadline", async () => {
    jest.useFakeTimers();
    const fetchImpl = jest.fn().mockResolvedValueOnce(unavailable()).mockImplementation(stall);
    const result = fetchNearbyEats({ fetchImpl });
    await jest.advanceTimersByTimeAsync(18_000);
    expect(fetchImpl.mock.calls[1][1].signal?.aborted).toBe(true);
    await expect(result).resolves.toMatchObject({ source: "error" });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("falls back after malformed Overpass JSON and releases its timer", async () => {
    jest.useFakeTimers();
    const fetchImpl = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError("invalid JSON"); } }).mockResolvedValueOnce({ ok: true, json: async () => [] });
    await expect(fetchNearbyEats({ fetchImpl })).resolves.toMatchObject({ source: "nominatim" });
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([401, 429, 500, 503])("uses offline Smart Tips after HTTP %i with an actual mocked API key", async (status) => {
    const fetchImpl = jest.fn(async () => ({ ok: false, status }));
    await expect(fetchSmartTipsFromGemini({ enabled: true, consentAccepted: true, payload, fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("aborts a stalled Smart Tips request and releases the timer", async () => {
    jest.useFakeTimers();
    const fetchImpl = jest.fn(stall);
    const result = fetchSmartTipsFromGemini({ enabled: true, consentAccepted: true, payload, fetchImpl });
    await jest.advanceTimersByTimeAsync(12_000);
    await expect(result).resolves.toBeNull();
    expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("returns offline eats tips after malformed Gemini response", async () => {
    const fetchImpl = jest.fn(async () => ({ ok: true, json: async () => { throw new SyntaxError("invalid JSON"); } }));
    await expect(fetchEatsAiTips({ enabled: true, consentAccepted: true, places: [], fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    { ...payload, address: "private fixture" },
    { ...payload, period: "2026-99" },
    { ...payload, categorySpendRatios: [{ category: "Food", ratio: Infinity }] },
    { ...payload, categorySpendRatios: [{ category: "Food", ratio: -1 }] },
    { ...payload, categorySpendRatios: [{ category: "Food", ratio: 0.5, notes: "private fixture" }] },
  ])("rejects malformed or unexpected outbound payload fields: %j", async (badPayload) => {
    expect(assertAnonymizedPayload(badPayload).ok).toBe(false);
    const fetchImpl = jest.fn();
    await expect(fetchSmartTipsFromGemini({ enabled: true, consentAccepted: true, payload: badPayload, fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
