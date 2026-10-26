import { TIP_QC_CAMPUS } from "../src/domain/services/eatsRanking";
import { clearPlacesCache, fetchNearbyEats } from "../src/remote/placesClient";

describe("placesClient Google Places Integration", () => {
  beforeEach(() => {
    clearPlacesCache();
  });

  it("returns disabled state and makes zero network calls when disabled", async () => {
    const fetchImpl = jest.fn();
    const result = await fetchNearbyEats({
      origin: TIP_QC_CAMPUS,
      radiusM: 1500,
      enabled: false,
      consentAccepted: true,
      fetchImpl,
      backendUrl: "https://moneymap-ai-proxy.run.app",
      appCheckToken: "dummy-token-1234567890",
    });

    expect(result.source).toBe("disabled");
    expect(result.places).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns disabled state and makes zero network calls when consent is missing", async () => {
    const fetchImpl = jest.fn();
    const result = await fetchNearbyEats({
      origin: TIP_QC_CAMPUS,
      radiusM: 1500,
      enabled: true,
      consentAccepted: false,
      fetchImpl,
      backendUrl: "https://moneymap-ai-proxy.run.app",
      appCheckToken: "dummy-token-1234567890",
    });

    expect(result.source).toBe("disabled");
    expect(result.places).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fetches nearby Google Places and caches them in session memory", async () => {
    const mockPlaces = [
      {
        id: "ChIJ12345",
        name: "Campus Eatery",
        latitude: TIP_QC_CAMPUS.latitude + 0.001,
        longitude: TIP_QC_CAMPUS.longitude,
        distanceM: 120,
        priceLevel: 1,
        rating: 4.5,
        primaryType: "restaurant",
        googleMapsUri: "https://maps.google.com/?cid=12345",
      },
    ];

    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        places: mockPlaces,
        attribution: "Powered by Google",
      }),
    }));

    const result = await fetchNearbyEats({
      origin: TIP_QC_CAMPUS,
      radiusM: 1500,
      enabled: true,
      consentAccepted: true,
      fetchImpl,
      backendUrl: "https://moneymap-ai-proxy.run.app",
      appCheckToken: "dummy-token-1234567890",
      now: 1_000,
    });

    expect(result.fromCache).toBe(false);
    expect(result.source).toBe("google_places");
    expect(result.attribution).toBe("Powered by Google");
    expect(result.places).toHaveLength(1);
    expect(result.places[0].name).toBe("Campus Eatery");
    expect(result.places[0].googleMapsUri).toBe("https://maps.google.com/?cid=12345");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Verify request payload
    const calledUrl = fetchImpl.mock.calls[0][0];
    const calledOpts = fetchImpl.mock.calls[0][1];
    expect(calledUrl).toBe("https://moneymap-ai-proxy.run.app/v1/places-nearby");
    expect(calledOpts.headers["X-MoneyMap-Consent"]).toBe("1");
    expect(calledOpts.headers["X-Firebase-AppCheck"]).toBe("dummy-token-1234567890");
    const sentBody = JSON.parse(calledOpts.body);
    expect(sentBody.latitude).toBe(TIP_QC_CAMPUS.latitude);
    expect(sentBody.longitude).toBe(TIP_QC_CAMPUS.longitude);

    // Second call should hit in-memory cache
    const cached = await fetchNearbyEats({
      origin: TIP_QC_CAMPUS,
      radiusM: 1500,
      enabled: true,
      consentAccepted: true,
      fetchImpl,
      backendUrl: "https://moneymap-ai-proxy.run.app",
      appCheckToken: "dummy-token-1234567890",
      now: 2_000,
    });
    expect(cached.fromCache).toBe(true);
    expect(cached.source).toBe("cache");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns unavailable error state without offline fallback when network fails", async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error("Network unreachable");
    });

    const result = await fetchNearbyEats({
      origin: TIP_QC_CAMPUS,
      radiusM: 1500,
      enabled: true,
      consentAccepted: true,
      fetchImpl,
      backendUrl: "https://moneymap-ai-proxy.run.app",
      appCheckToken: "dummy-token-1234567890",
      now: 5_000,
    });

    expect(result.source).toBe("unavailable");
    expect(result.places).toEqual([]);
    expect(result.errorMessage).toBe("Nearby places are temporarily unavailable.");
  });

  it("returns unavailable when skipNetwork is true, without falling back to catalog", async () => {
    const result = await fetchNearbyEats({
      origin: TIP_QC_CAMPUS,
      skipNetwork: true,
      enabled: true,
      consentAccepted: true,
    });

    expect(result.source).toBe("unavailable");
    expect(result.places).toEqual([]);
    expect(result.errorMessage).toContain("disabled");
  });
});
