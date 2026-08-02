import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

import { getOrCreateDatabaseKey, type DatabaseKeyStore } from "./keyManager";

const DATABASE_KEY_NAME = "moneymap.database-key.v1";
const DATABASE_KEY_SERVICE = "com.example.financetracker.database-key";

const secureDatabaseKeyStore: DatabaseKeyStore = {
  read: () =>
    SecureStore.getItemAsync(DATABASE_KEY_NAME, {
      keychainService: DATABASE_KEY_SERVICE,
    }),
  write: (value) =>
    SecureStore.setItemAsync(DATABASE_KEY_NAME, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      keychainService: DATABASE_KEY_SERVICE,
    }),
};

export function loadDatabaseKey(): Promise<string> {
  return getOrCreateDatabaseKey(secureDatabaseKeyStore, Crypto.getRandomBytesAsync);
}
