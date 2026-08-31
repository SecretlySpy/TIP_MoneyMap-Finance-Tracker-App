import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { getOrCreateDatabaseKey } from "./keyManager";
const DATABASE_KEY_NAME = "moneymap.database-key.v1";
// DO NOT RENAME. The value reads "com.example..." rather than the real package id
// (com.moneymap.financetracker) because it shipped that way. keychainService forms part
// of the SecureStore entry's identity: changing it orphans the stored key, and the key is
// the only thing that can decrypt moneymap.sqlite. Renaming without a read-old/write-new
// migration destroys every existing user's data. Cosmetic only -- leave it alone.
const DATABASE_KEY_SERVICE = "com.example.financetracker.database-key";
const secureDatabaseKeyStore = {
    read: () => SecureStore.getItemAsync(DATABASE_KEY_NAME, {
        keychainService: DATABASE_KEY_SERVICE,
    }),
    write: (value) => SecureStore.setItemAsync(DATABASE_KEY_NAME, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        keychainService: DATABASE_KEY_SERVICE,
    }),
};
export function loadDatabaseKey() {
    return getOrCreateDatabaseKey(secureDatabaseKeyStore, Crypto.getRandomBytesAsync);
}
