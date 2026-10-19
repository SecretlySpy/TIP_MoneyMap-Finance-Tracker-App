import { migrateDatabase } from "../src/db/schema";
import { OpSqliteDatabase } from "../src/db/sql";
import {
  createEatsPlacesPersistentCache,
  EATS_PLACES_CACHE_KEY,
  readEatsPlacesCacheStore,
} from "../src/services/eatsPlacesCache";
import { TestSqliteDatabase } from "./support/testDatabase";

describe("Student Eats durable places cache", () => {
  let native;
  let database;

  beforeEach(async () => {
    native = new TestSqliteDatabase();
    database = new OpSqliteDatabase(native);
    await migrateDatabase(database);
  });

  afterEach(() => {
    database.close();
  });

  it("round-trips live results through encrypted app_metadata", async () => {
    const cache = createEatsPlacesPersistentCache({ database, now: 1_700_000_000_000 });
    const places = [{ id: "saved-canteen", name: "TIP Main Canteen", distanceM: 40 }];
    await expect(cache.set("14.625,121.061,1500", { places, origin: { label: "TIP Quezon City" }, source: "overpass" })).resolves.toBe(true);

    const stored = await readEatsPlacesCacheStore({ database });
    expect(stored.entries["14.625,121.061,1500"].places[0].name).toBe("TIP Main Canteen");

    const metadata = await database.execute("SELECT value FROM app_metadata WHERE key = ?", [EATS_PLACES_CACHE_KEY]);
    expect(metadata.rows[0]?.value).toContain("TIP Main Canteen");

    const loaded = await cache.get("14.625,121.061,1500");
    expect(loaded.places).toEqual(places);
    expect(loaded.source).toBe("overpass");
  });

  it("returns null for missing or empty cache entries", async () => {
    const cache = createEatsPlacesPersistentCache({ database });
    await expect(cache.get("missing")).resolves.toBeNull();
    await expect(cache.set("empty", { places: [] })).resolves.toBe(false);
  });
});
