import { getBundledCampusPlaces } from "../src/data/tipCampusEatsCatalog";
import { TIP_QC_CAMPUS } from "../src/domain/services/eatsRanking";
import { clearPlacesCache, fetchNearbyEats } from "../src/remote/placesClient";

describe("placesClient", () => {
  beforeEach(() => {
    clearPlacesCache();
  });

  it("ranks Overpass JSON through the shared pipeline", async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        elements: [
          {
            id: 10,
            lat: TIP_QC_CAMPUS.latitude + 0.001,
            lon: TIP_QC_CAMPUS.longitude,
            tags: { name: "Campus Lugaw", amenity: "fast_food" },
          },
        ],
      }),
    }));

    const result = await fetchNearbyEats({
      origin: TIP_QC_CAMPUS,
      radiusM: 1500,
      fetchImpl,
      now: 1_000,
    });

    expect(result.fromCache).toBe(false);
    expect(result.source).toBe("overpass");
    expect(result.places).toHaveLength(1);
    expect(result.places[0].name).toBe("Campus Lugaw");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const cached = await fetchNearbyEats({
      origin: TIP_QC_CAMPUS,
      radiusM: 1500,
      fetchImpl,
      now: 2_000,
    });
    expect(cached.fromCache).toBe(true);
    expect(cached.source).toBe("cache");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back when Overpass fails", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 504 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            place_id: 99,
            lat: String(TIP_QC_CAMPUS.latitude + 0.001),
            lon: String(TIP_QC_CAMPUS.longitude),
            display_name: "Near TIP Rice Bowl, Quezon City",
          },
        ],
      });

    const result = await fetchNearbyEats({
      origin: TIP_QC_CAMPUS,
      fetchImpl,
      now: 5_000,
    });
    expect(result.source).toBe("nominatim");
    expect(result.places[0].name).toContain("Near TIP Rice Bowl");
  });

  it("returns the bundled campus catalog when no network client exists", async () => {
    const result = await fetchNearbyEats({
      origin: TIP_QC_CAMPUS,
      skipNetwork: true,
      now: 9_000,
    });
    const bundled = getBundledCampusPlaces(TIP_QC_CAMPUS, { maxDistanceM: 1500, limit: 25 });
    expect(result.source).toBe("bundled");
    expect(result.fromCache).toBe(false);
    expect(result.places.length).toBe(bundled.length);
    expect(result.places[0].name).toBe(bundled[0].name);
    expect(result.places.every((place) => place.distanceM <= 1500)).toBe(true);
  });

  it("uses persisted live results after a network failure", async () => {
    const saved = [
      {
        id: "saved-1",
        name: "Saved Lugaw",
        latitude: TIP_QC_CAMPUS.latitude,
        longitude: TIP_QC_CAMPUS.longitude,
        distanceM: 80,
        priceLevel: 1,
        rating: 4,
        cuisine: "filipino",
        amenity: "fast_food",
        score: 90,
      },
    ];
    const persistentCache = {
      get: jest.fn(async () => ({ places: saved, origin: TIP_QC_CAMPUS })),
      set: jest.fn(async () => true),
    };
    const fetchImpl = jest.fn(async () => ({ ok: false, status: 503 }));
    const result = await fetchNearbyEats({
      origin: TIP_QC_CAMPUS,
      fetchImpl,
      persistentCache,
      now: 12_000,
    });
    expect(result.source).toBe("persisted");
    expect(result.fromCache).toBe(true);
    expect(result.places[0].name).toBe("Saved Lugaw");
    expect(persistentCache.set).not.toHaveBeenCalled();
  });

  it("persists successful Overpass results for a later restart", async () => {
    const persistentCache = {
      get: jest.fn(async () => null),
      set: jest.fn(async () => true),
    };
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        elements: [
          {
            id: 22,
            lat: TIP_QC_CAMPUS.latitude + 0.001,
            lon: TIP_QC_CAMPUS.longitude,
            tags: { name: "Live Carinderia", amenity: "canteen" },
          },
        ],
      }),
    }));
    const result = await fetchNearbyEats({
      origin: TIP_QC_CAMPUS,
      fetchImpl,
      persistentCache,
      now: 20_000,
    });
    expect(result.source).toBe("overpass");
    expect(persistentCache.set).toHaveBeenCalledTimes(1);
    expect(persistentCache.set.mock.calls[0][1].places[0].name).toBe("Live Carinderia");
    expect(persistentCache.set.mock.calls[0][1].expiresAt).toBeGreaterThan(20_000);
  });
});
