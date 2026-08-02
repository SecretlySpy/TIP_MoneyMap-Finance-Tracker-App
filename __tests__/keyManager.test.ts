import { bytesToHex, getOrCreateDatabaseKey, type DatabaseKeyStore } from "../src/db/keyManager";

class MemoryKeyStore implements DatabaseKeyStore {
  public value: string | null = null;
  public writeCount = 0;

  public async read(): Promise<string | null> {
    return this.value;
  }

  public async write(value: string): Promise<void> {
    this.value = value;
    this.writeCount += 1;
  }
}

describe("database key manager", () => {
  test("encodes bytes as fixed-width lowercase hexadecimal", () => {
    expect(bytesToHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe("00010f10ff");
  });

  test("creates one 256-bit key and then reuses it", async () => {
    const keyStore = new MemoryKeyStore();
    const randomBytes = jest.fn(async (byteCount: number) =>
      Uint8Array.from({ length: byteCount }, (_, index) => index),
    );

    const firstKey = await getOrCreateDatabaseKey(keyStore, randomBytes);
    const secondKey = await getOrCreateDatabaseKey(keyStore, randomBytes);

    expect(firstKey).toHaveLength(64);
    expect(secondKey).toBe(firstKey);
    expect(randomBytes).toHaveBeenCalledTimes(1);
    expect(randomBytes).toHaveBeenCalledWith(32);
    expect(keyStore.writeCount).toBe(1);
  });

  test("fails closed when a stored key is malformed", async () => {
    const keyStore = new MemoryKeyStore();
    keyStore.value = "not-a-valid-key";

    await expect(
      getOrCreateDatabaseKey(keyStore, async () => new Uint8Array(32)),
    ).rejects.toThrow("refusing to replace it");
    expect(keyStore.writeCount).toBe(0);
  });

  test("rejects a random provider that returns the wrong byte count", async () => {
    const keyStore = new MemoryKeyStore();

    await expect(
      getOrCreateDatabaseKey(keyStore, async () => new Uint8Array(31)),
    ).rejects.toThrow("invalid key length");
    expect(keyStore.writeCount).toBe(0);
  });
});
