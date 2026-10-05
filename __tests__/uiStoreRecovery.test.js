jest.mock("expo-secure-store", () => ({
  deleteItemAsync: jest.fn(async () => {}),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
}));

jest.mock("../src/services/appLock", () => ({
  clearPin: jest.fn(async () => {}),
  getPinLockoutStatus: jest.fn(async () => ({ failures: 0, lockedForSeconds: 0 })),
  hasStoredPin: jest.fn(async () => true),
  setPin: jest.fn(async () => {}),
  tryLocalAuthentication: jest.fn(async () => "unavailable"),
  tryRecoveryAuthentication: jest.fn(async () => "unavailable"),
  verifyPinWithLockout: jest.fn(async () => ({ ok: false, failures: 0, lockedForSeconds: 0 })),
}));

jest.mock("../src/services/notificationScheduler", () => ({
  getReminderPermissionStatus: jest.fn(async () => ({ granted: false, status: "undetermined" })),
  syncBillReminderNotifications: jest.fn(async () => ({ permissionDenied: false, errorMessage: null })),
}));

jest.mock("../src/services/onboarding", () => ({
  clearOnboardingDraft: jest.fn(async () => {}),
  createOnboardingDraft: jest.fn(() => ({ version: 1, step: "account" })),
  loadOnboardingDraftResult: jest.fn(async () => ({ draft: null, status: "missing" })),
  saveOnboardingDraft: jest.fn(async (draft) => draft),
}));

jest.mock("../src/services/preferences", () => ({
  DEFAULT_PREFERENCES: {
    appLockEnabled: false,
    currencySymbol: "₱",
    remindersEnabled: false,
    smartTipsEnabled: false,
    smartTipsConsentAccepted: false,
    themePreference: "light",
  },
  SPLASH_SEEN_KEY: "moneymap.splash.seen.v1",
  loadPreferencesResult: jest.fn(async () => ({
    preferences: {
      appLockEnabled: false,
      currencySymbol: "₱",
      remindersEnabled: false,
      smartTipsEnabled: false,
      smartTipsConsentAccepted: false,
      themePreference: "light",
    },
    status: "loaded",
  })),
  savePreferences: jest.fn(async () => {}),
}));

import { setPin, tryRecoveryAuthentication } from "../src/services/appLock";
import { savePreferences } from "../src/services/preferences";
import { PIN_RECOVERY_AUTHORIZATION_MILLIS, useUiStore } from "../src/store/uiStore";

describe("uiStore PIN recovery authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useUiStore.setState({
      appLockEnabled: true,
      hasPin: true,
      isLocked: true,
      pinRecoveryAuthorizedAt: null,
      preferenceLoadError: null,
    });
  });

  it("records a short-lived grant only after successful native authentication", async () => {
    jest.spyOn(Date, "now").mockReturnValueOnce(10_000);
    tryRecoveryAuthentication.mockResolvedValueOnce("success");

    await expect(useUiStore.getState().beginPinRecovery()).resolves.toBe("success");
    expect(useUiStore.getState().pinRecoveryAuthorizedAt).toBe(10_000);
    Date.now.mockRestore();
  });

  it("does not authorize recovery after cancellation", async () => {
    tryRecoveryAuthentication.mockResolvedValueOnce("cancelled");
    await expect(useUiStore.getState().beginPinRecovery()).resolves.toBe("cancelled");
    expect(useUiStore.getState().pinRecoveryAuthorizedAt).toBeNull();
  });

  it("replaces the PIN and unlocks only while the native grant is valid", async () => {
    useUiStore.setState({ pinRecoveryAuthorizedAt: 1_000 });

    await expect(useUiStore.getState().completePinRecovery("2468", 2_000)).resolves.toEqual({ ok: true });

    expect(setPin).toHaveBeenCalledWith("2468");
    expect(savePreferences).toHaveBeenCalledWith(expect.objectContaining({ appLockEnabled: true }));
    expect(useUiStore.getState()).toMatchObject({
      appLockEnabled: true,
      hasPin: true,
      isLocked: false,
      pinRecoveryAuthorizedAt: null,
    });
  });

  it("rejects an absent or expired recovery grant without changing the PIN", async () => {
    await expect(useUiStore.getState().completePinRecovery("2468", 2_000)).resolves.toEqual({
      ok: false,
      reason: "authorization-expired",
    });
    useUiStore.setState({ pinRecoveryAuthorizedAt: 1_000 });
    await expect(useUiStore.getState().completePinRecovery("2468", 1_000 + PIN_RECOVERY_AUTHORIZATION_MILLIS + 1)).resolves.toEqual({
      ok: false,
      reason: "authorization-expired",
    });
    expect(setPin).not.toHaveBeenCalled();
    expect(useUiStore.getState().isLocked).toBe(true);
  });

  it("clears recovery authorization when the app is explicitly locked", () => {
    useUiStore.setState({ pinRecoveryAuthorizedAt: 1_000 });
    useUiStore.getState().lockNow();
    expect(useUiStore.getState()).toMatchObject({ isLocked: true, pinRecoveryAuthorizedAt: null });
  });

  it("returns UI state to a clean first launch after local data erasure", () => {
    useUiStore.setState({
      appLockEnabled: true,
      hasPin: true,
      hasSeenSplash: true,
      isLocked: true,
      localDataGeneration: 4,
      localResetInProgress: true,
      onboardingDraft: { step: "expense" },
      remindersEnabled: true,
      smartTipsConsentAccepted: true,
      smartTipsEnabled: true,
      themePreference: "dark",
    });

    useUiStore.getState().resetUiAfterLocalReset();

    expect(useUiStore.getState()).toMatchObject({
      appLockEnabled: false,
      hasPin: false,
      hasSeenSplash: false,
      isLocked: false,
      localDataGeneration: 5,
      localResetInProgress: false,
      onboardingDraft: null,
      remindersEnabled: false,
      smartTipsConsentAccepted: false,
      smartTipsEnabled: false,
      themePreference: "light",
    });
  });
});
