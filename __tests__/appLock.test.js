jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key) => {
      store.delete(key);
    }),
    __store: store,
  };
});

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: jest.fn(async (_algo, value) => `hash:${value}`),
  getRandomBytesAsync: jest.fn(async (size) => Uint8Array.from({ length: size }, (_, i) => i + 1)),
}));

const mockHasHardware = jest.fn();
const mockIsEnrolled = jest.fn();
const mockAuthenticate = jest.fn();

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: (...args) => mockHasHardware(...args),
  isEnrolledAsync: (...args) => mockIsEnrolled(...args),
  authenticateAsync: (...args) => mockAuthenticate(...args),
}));

const SecureStore = require("expo-secure-store");
const {
  canUseBiometrics,
  clearPin,
  hasStoredPin,
  isValidPin,
  setPin,
  tryLocalAuthentication,
  verifyPin,
} = require("../src/services/appLock");

describe("appLock PIN", () => {
  beforeEach(() => {
    SecureStore.__store.clear();
    jest.clearAllMocks();
  });

  it("validates 4-digit PINs only", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("12")).toBe(false);
    expect(isValidPin("abcd")).toBe(false);
    expect(isValidPin("12345")).toBe(false);
  });

  it("stores and verifies a PIN", async () => {
    expect(await hasStoredPin()).toBe(false);
    await setPin("2468");
    expect(await hasStoredPin()).toBe(true);
    expect(await verifyPin("2468")).toBe(true);
    expect(await verifyPin("0000")).toBe(false);
  });

  it("rejects invalid PIN on set", async () => {
    await expect(setPin("12")).rejects.toThrow(/4 digits/);
  });

  it("clears stored PIN material", async () => {
    await setPin("1357");
    await clearPin();
    expect(await hasStoredPin()).toBe(false);
    expect(await verifyPin("1357")).toBe(false);
  });
});

describe("appLock biometrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reports unavailable when hardware is missing", async () => {
    mockHasHardware.mockResolvedValue(false);
    expect(await canUseBiometrics()).toBe(false);
    expect(await tryLocalAuthentication()).toBe("unavailable");
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it("reports unavailable when nothing is enrolled", async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(false);
    expect(await canUseBiometrics()).toBe(false);
    expect(await tryLocalAuthentication()).toBe("unavailable");
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it("returns success when authenticateAsync succeeds", async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
    mockAuthenticate.mockResolvedValue({ success: true });
    expect(await canUseBiometrics()).toBe(true);
    expect(await tryLocalAuthentication()).toBe("success");
    expect(mockAuthenticate).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMessage: "Unlock MoneyMap",
        cancelLabel: "Use PIN",
        disableDeviceFallback: true,
      }),
    );
  });

  it("returns failed when the user cancels or mismatches", async () => {
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);
    mockAuthenticate.mockResolvedValue({ success: false, error: "user_cancel" });
    expect(await tryLocalAuthentication()).toBe("failed");
  });

  it("falls back to unavailable when the native module throws", async () => {
    mockHasHardware.mockRejectedValue(new Error("native missing"));
    expect(await canUseBiometrics()).toBe(false);
    expect(await tryLocalAuthentication()).toBe("unavailable");
  });
});
