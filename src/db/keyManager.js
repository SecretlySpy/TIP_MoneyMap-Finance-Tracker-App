const DATABASE_KEY_BYTES = 32;
const DATABASE_KEY_PATTERN = /^[0-9a-f]{64}$/;
export function bytesToHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function getOrCreateDatabaseKey(keyStore, randomBytes) {
    const storedKey = await keyStore.read();
    if (storedKey !== null) {
        if (!DATABASE_KEY_PATTERN.test(storedKey)) {
            throw new Error("The stored database key is invalid; refusing to replace it.");
        }
        return storedKey;
    }
    const generatedBytes = await randomBytes(DATABASE_KEY_BYTES);
    if (generatedBytes.byteLength !== DATABASE_KEY_BYTES) {
        throw new Error("The cryptographic random source returned an invalid key length.");
    }
    const generatedKey = bytesToHex(generatedBytes);
    await keyStore.write(generatedKey);
    return generatedKey;
}
