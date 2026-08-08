import {
  TIP_QC_CAMPUS,
  assertAnonymizedEatsPayload,
  buildAnonymizedEatsPayload,
  distanceMeters,
  formatDistance,
  inferPriceLevel,
  rankPlaces,
  scorePlace,
  studentBoost,
} from "../src/domain/services/eatsRanking";

describe("eatsRanking pure helpers", () => {
  it("computes haversine distance in meters", () => {
    const a = { latitude: 14.62548, longitude: 121.06135 };
    const b = { latitude: 14.62648, longitude: 121.06135 };
    const d = distanceMeters(a, b);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(150);
  });

  it("infers student-friendly price levels", () => {
    expect(inferPriceLevel({ name: "Campus Carinderia" })).toBe(1);
    expect(inferPriceLevel({ amenity: "fast_food", name: "Chicken Box" })).toBe(2);
    expect(inferPriceLevel({ amenity: "restaurant", name: "Fine Dining" })).toBe(3);
  });

  it("scores nearer cheaper places higher", () => {
    const nearCheap = scorePlace({
      distanceM: 200,
      priceLevel: 1,
      rating: 4,
      name: "Lugaw stall",
    });
    const farPricey = scorePlace({
      distanceM: 1800,
      priceLevel: 4,
      rating: 4,
      name: "Upscale Grill",
    });
    expect(nearCheap).toBeGreaterThan(farPricey);
    expect(studentBoost({ name: "Rice meal canteen", priceLevel: 1 })).toBeGreaterThan(0.3);
  });

  it("ranks Overpass-like elements and drops nameless/far nodes", () => {
    const origin = TIP_QC_CAMPUS;
    const elements = [
      {
        id: 1,
        lat: origin.latitude + 0.001,
        lon: origin.longitude,
        tags: { name: "TIP Canteen", amenity: "canteen" },
      },
      {
        id: 2,
        lat: origin.latitude + 0.002,
        lon: origin.longitude,
        tags: { name: "Burger Spot", amenity: "fast_food" },
      },
      {
        id: 3,
        lat: origin.latitude + 0.05,
        lon: origin.longitude,
        tags: { name: "Too Far", amenity: "restaurant" },
      },
      {
        id: 4,
        lat: origin.latitude,
        lon: origin.longitude,
        tags: { amenity: "cafe" }, // no name
      },
    ];
    const ranked = rankPlaces(elements, origin, { maxDistanceM: 2000, limit: 10 });
    expect(ranked.length).toBe(2);
    expect(ranked[0].name).toBe("TIP Canteen");
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
    expect(ranked.every((p) => p.distanceM <= 2000)).toBe(true);
    expect(ranked[0]).not.toHaveProperty("tags");
  });

  it("formats distances for UI", () => {
    expect(formatDistance(250)).toBe("250 m");
    expect(formatDistance(1500)).toBe("1.5 km");
  });

  it("builds anonymized AI payload without coordinates", () => {
    const payload = buildAnonymizedEatsPayload({
      currencySymbol: "₱",
      dailyFoodBudgetMinor: 15_000,
      places: [
        {
          name: "Secret Cafe",
          distanceM: 400,
          priceLevel: 2,
          rating: 4.1,
          cuisine: "filipino",
          score: 72,
          latitude: 14.62,
          longitude: 121.06,
        },
      ],
    });
    expect(assertAnonymizedEatsPayload(payload)).toEqual({ ok: true });
    expect(payload.places[0]).toMatchObject({
      name: "Secret Cafe",
      distanceBand: "near",
      priceLevel: 2,
    });
    expect(payload).not.toHaveProperty("latitude");
    expect(JSON.stringify(payload)).not.toMatch(/14\.62|121\.06/);
    expect(assertAnonymizedEatsPayload({ ...payload, latitude: 1 }).ok).toBe(false);
  });
});
