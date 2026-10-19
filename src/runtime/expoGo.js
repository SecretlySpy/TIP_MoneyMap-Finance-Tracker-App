/**
 * Expo Go cannot load OP-SQLite/SQLCipher. Detect it before importing native DB code.
 * @param {{ appOwnership?: string|null, executionEnvironment?: string|null }|null} [constants]
 */
export function isExpoGoRuntime(constants) {
  const source = constants ?? getExpoConstants();
  if (source === null || typeof source !== "object") {
    return false;
  }
  return source.appOwnership === "expo" || source.executionEnvironment === "storeClient";
}

function getExpoConstants() {
  try {
    const imported = require("expo-constants");
    return imported?.default ?? imported ?? null;
  } catch {
    return null;
  }
}
