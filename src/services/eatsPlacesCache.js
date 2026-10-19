/**
 * Best-effort durable cache for optional live Student Eats results.
 * Lives in encrypted app_metadata. The bundled campus catalog does not depend on it.
 */

export const EATS_PLACES_CACHE_KEY = "eats-places-cache-v1";
export const EATS_PLACES_CACHE_VERSION = 1;
export const EATS_PLACES_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function emptyStore() {
  return { version: EATS_PLACES_CACHE_VERSION, entries: {} };
}

function parseStore(value) {
  if (typeof value !== "string" || value.length === 0) {
    return emptyStore();
  }
  const parsed = JSON.parse(value);
  if (parsed === null || typeof parsed !== "object" || parsed.version !== EATS_PLACES_CACHE_VERSION) {
    return emptyStore();
  }
  const entries = parsed.entries !== null && typeof parsed.entries === "object" ? parsed.entries : {};
  return { version: EATS_PLACES_CACHE_VERSION, entries };
}

async function resolveDatabase(options = {}) {
  if (options.database) {
    return options.database;
  }
  try {
    const { initializeDatabase } = await import("../db/client");
    return await initializeDatabase();
  } catch {
    return null;
  }
}

/**
 * @param {{ database?: { execute: Function } }} [options]
 * @returns {Promise<{ version: number, entries: Record<string, object> }>}
 */
export async function readEatsPlacesCacheStore(options = {}) {
  const database = await resolveDatabase(options);
  if (database === null) {
    return emptyStore();
  }
  try {
    const result = await database.execute("SELECT value FROM app_metadata WHERE key = ?", [EATS_PLACES_CACHE_KEY]);
    return parseStore(result.rows?.[0]?.value);
  } catch {
    return emptyStore();
  }
}

/**
 * @param {{ version: number, entries: Record<string, object> }} store
 * @param {{ database?: { execute: Function } }} [options]
 */
export async function writeEatsPlacesCacheStore(store, options = {}) {
  const database = await resolveDatabase(options);
  if (database === null) {
    return false;
  }
  const payload = JSON.stringify({
    version: EATS_PLACES_CACHE_VERSION,
    entries: store.entries ?? {},
  });
  try {
    await database.execute(
      `INSERT INTO app_metadata (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [EATS_PLACES_CACHE_KEY, payload],
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {{ database?: { execute: Function }, now?: number }} [options]
 */
export function createEatsPlacesPersistentCache(options = {}) {
  return {
    /**
     * @param {string} key
     * @returns {Promise<object|null>}
     */
    async get(key) {
      const store = await readEatsPlacesCacheStore(options);
      const entry = store.entries[key];
      if (entry === null || typeof entry !== "object" || !Array.isArray(entry.places) || entry.places.length === 0) {
        return null;
      }
      return entry;
    },
    /**
     * @param {string} key
     * @param {{ places: object[], origin?: object, source?: string, expiresAt?: number }} value
     */
    async set(key, value) {
      if (!Array.isArray(value?.places) || value.places.length === 0) {
        return false;
      }
      const store = await readEatsPlacesCacheStore(options);
      const now = options.now ?? Date.now();
      store.entries[key] = {
        places: value.places,
        origin: value.origin ?? null,
        source: value.source ?? "persisted",
        savedAt: now,
        expiresAt: value.expiresAt ?? now + EATS_PLACES_CACHE_TTL_MS,
      };
      return writeEatsPlacesCacheStore(store, options);
    },
  };
}

export const eatsPlacesPersistentCache = createEatsPlacesPersistentCache();
