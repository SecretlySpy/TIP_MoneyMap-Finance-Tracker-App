const mockGetApp = jest.fn(() => ({ name: "[DEFAULT]" }));
const mockConfigure = jest.fn();
const mockReactNativeFirebaseAppCheckProvider = jest.fn().mockImplementation(() => ({
  configure: mockConfigure,
}));
const mockInitializeAppCheck = jest.fn((app, options) => ({
  app,
  options,
}));
const mockGetToken = jest.fn(async () => ({ token: "mock-app-check-token-123" }));

jest.mock("@react-native-firebase/app", () => ({
  getApp: mockGetApp,
}));

jest.mock("@react-native-firebase/app-check", () => ({
  ReactNativeFirebaseAppCheckProvider: mockReactNativeFirebaseAppCheckProvider,
  initializeAppCheck: mockInitializeAppCheck,
  getToken: mockGetToken,
}));

describe("firebaseAppCheck", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("initializes App Check with debug provider in dev environment and returns token", async () => {
    const { getMoneyMapAppCheckToken } = require("../src/remote/firebaseAppCheck");

    const token = await getMoneyMapAppCheckToken();

    expect(token).toBe("mock-app-check-token-123");
    expect(mockReactNativeFirebaseAppCheckProvider).toHaveBeenCalledTimes(1);
    expect(mockConfigure).toHaveBeenCalledWith({
      android: {
        provider: "debug",
      },
    });
    expect(mockInitializeAppCheck).toHaveBeenCalledWith(
      { name: "[DEFAULT]" },
      expect.objectContaining({
        isTokenAutoRefreshEnabled: false,
      })
    );
    expect(mockGetToken).toHaveBeenCalledTimes(1);
  });

  it("reuses initialized App Check promise across multiple token requests", async () => {
    const { getMoneyMapAppCheckToken } = require("../src/remote/firebaseAppCheck");

    const token1 = await getMoneyMapAppCheckToken();
    const token2 = await getMoneyMapAppCheckToken();

    expect(token1).toBe("mock-app-check-token-123");
    expect(token2).toBe("mock-app-check-token-123");
    expect(mockReactNativeFirebaseAppCheckProvider).toHaveBeenCalledTimes(1);
    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
    expect(mockGetToken).toHaveBeenCalledTimes(2);
  });

  it("resets promise and allows retry if initialization throws", async () => {
    mockInitializeAppCheck.mockImplementationOnce(() => {
      throw new Error("Init failure");
    });

    const { getMoneyMapAppCheckToken } = require("../src/remote/firebaseAppCheck");

    await expect(getMoneyMapAppCheckToken()).rejects.toThrow("Init failure");

    // Second attempt should re-try initialization
    mockInitializeAppCheck.mockImplementationOnce((app, options) => ({ app, options }));
    const token = await getMoneyMapAppCheckToken();
    expect(token).toBe("mock-app-check-token-123");
    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(2);
  });
});
