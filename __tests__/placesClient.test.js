import { clearPlacesCache, fetchNearbyEats } from "../src/remote/placesClient";
import { TIP_QC_CAMPUS } from "../src/domain/services/eatsRanking";

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
});
