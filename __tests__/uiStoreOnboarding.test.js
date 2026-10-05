jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    __store: store,
    deleteItemAsync: jest.fn(async (key) => store.delete(key)),
    getItemAsync: jest.fn(async (key) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => store.set(key, value)),
  };
});

jest.mock("../src/services/appLock", () => ({
  clearPin: jest.fn(async () => {}),
  getPinLockoutStatus: jest.fn(async () => ({ lockedForSeconds: 0 })),
  hasStoredPin: jest.fn(async () => false),
  setPin: jest.fn(async () => {}),
  tryLocalAuthentication: jest.fn(async () => "unavailable"),
  verifyPinWithLockout: jest.fn(async () => ({ ok: false, lockedForSeconds: 0 })),
}));

jest.mock("../src/services/notificationScheduler", () => ({
  getReminderPermissionStatus: jest.fn(async () => ({ granted: false, status: "undetermined" })),
  syncBillReminderNotifications: jest.fn(async () => ({ permissionDenied: false, errorMessage: null })),
}));

jest.mock("../src/services/preferences", () => {
  const defaults = {
    appLockEnabled: false,
    currencySymbol: "₱",
    remindersEnabled: false,
    smartTipsEnabled: false,
    smartTipsConsentAccepted: false,
    themePreference: "light",
  };
  return {
    DEFAULT_PREFERENCES: defaults,
    SPLASH_SEEN_KEY: "moneymap.splash.seen.v1",
    loadPreferencesResult: jest.fn(async () => ({ preferences: defaults, status: "loaded" })),
    savePreferences: jest.fn(async () => {}),
  };
});

import * as SecureStore from "expo-secure-store";
import { hasStoredPin, tryLocalAuthentication } from "../src/services/appLock";
import { createOnboardingDraft, mergeOnboardingDraft, ONBOARDING_DRAFT_KEY } from "../src/services/onboarding";
import { loadPreferencesResult, savePreferences } from "../src/services/preferences";
import { useUiStore } from "../src/store/uiStore";

describe("uiStore onboarding lifecycle", () => {
  beforeEach(() => {
    SecureStore.__store.clear();
    jest.clearAllMocks();
    useUiStore.setState({
      appLockEnabled: false,
      hasPin: false,
      hasSeenSplash: false,
      isLocked: false,
      onboardingDraft: null,
      onboardingLoadError: null,
      onboardingDraftInvalid: false,
      splashReadError: null,
      preferenceLoadError: null,
      preferencesReady: false,
      remindersEnabled: false,
    });
  });

  it("fails closed when a PIN exists but preferences cannot be verified", async () => {
    hasStoredPin.mockResolvedValueOnce(true);
    loadPreferencesResult.mockResolvedValueOnce({
      preferences: {
        appLockEnabled: false,
        currencySymbol: "₱",
        remindersEnabled: false,
        smartTipsEnabled: false,
        smartTipsConsentAccepted: false,
        themePreference: "light",
      },
      status: "invalid",
    });

    await useUiStore.getState().ensurePreferencesLoaded();

    expect(useUiStore.getState()).toMatchObject({
      hasPin: true,
      isLocked: true,
      preferencesReady: true,
    });
    expect(useUiStore.getState().preferenceLoadError).toMatch(/could not be verified/i);
  });

  it("restores background relocking after biometric recovery from invalid preferences", async () => {
    tryLocalAuthentication.mockResolvedValueOnce("success");
    useUiStore.setState({
      appLockEnabled: false,
      hasPin: true,
      isLocked: true,
      preferenceLoadError: "Preferences could not be verified.",
    });

    await expect(useUiStore.getState().unlockWithBiometrics()).resolves.toBe("success");

    expect(useUiStore.getState()).toMatchObject({
      appLockEnabled: true,
      isLocked: false,
      preferenceLoadError: null,
    });
    expect(savePreferences).toHaveBeenCalledWith(expect.objectContaining({ appLockEnabled: true }));
  });

  it("restores an unfinished draft during preference hydration", async () => {
    const draft = mergeOnboardingDraft(createOnboardingDraft(), {
      step: "expense",
      account: { name: "Campus cash" },
    });
    SecureStore.__store.set(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));

    await useUiStore.getState().ensurePreferencesLoaded();

    expect(useUiStore.getState().preferencesReady).toBe(true);
    expect(useUiStore.getState().hasSeenSplash).toBe(false);
    expect(useUiStore.getState().onboardingDraft).toEqual(draft);
  });

  it("finishes hydration in a locked state when required PIN data is unreadable", async () => {
    hasStoredPin.mockRejectedValueOnce(new Error("secure storage unavailable"));
    loadPreferencesResult.mockResolvedValueOnce({
      preferences: {
        appLockEnabled: true,
        currencySymbol: "₱",
        remindersEnabled: false,
        smartTipsEnabled: false,
        smartTipsConsentAccepted: false,
        themePreference: "light",
      },
      status: "loaded",
    });

    await useUiStore.getState().ensurePreferencesLoaded();

    expect(useUiStore.getState()).toMatchObject({
      hasPin: true,
      isLocked: true,
      preferencesReady: true,
    });
    expect(useUiStore.getState().preferenceLoadError).toMatch(/could not be read/i);
  });

  it("does not overwrite an onboarding draft while secure storage is unreadable", async () => {
    SecureStore.getItemAsync
      .mockImplementationOnce(async () => null)
      .mockRejectedValueOnce(new Error("draft read unavailable"));
    await useUiStore.getState().ensurePreferencesLoaded();
    expect(useUiStore.getState().onboardingLoadError).toMatch(/could not be read/i);

    SecureStore.getItemAsync.mockRejectedValueOnce(new Error("draft still unavailable"));
    await expect(useUiStore.getState().beginOnboarding()).rejects.toThrow(/No new draft was written/i);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
      ONBOARDING_DRAFT_KEY,
      expect.any(String),
    );
  });

  it("does not start setup when the prior completion marker cannot be read", async () => {
    SecureStore.getItemAsync.mockRejectedValueOnce(new Error("start marker unavailable"));
    await useUiStore.getState().ensurePreferencesLoaded();
    expect(useUiStore.getState().splashReadError).toMatch(/could not be read/i);

    SecureStore.getItemAsync.mockRejectedValueOnce(new Error("still unavailable"));
    await expect(useUiStore.getState().beginOnboarding()).rejects.toThrow(/No setup draft was written/i);
    expect(SecureStore.__store.has(ONBOARDING_DRAFT_KEY)).toBe(false);

    SecureStore.__store.set("moneymap.splash.seen.v1", "true");
    await expect(useUiStore.getState().beginOnboarding()).resolves.toBeNull();
    expect(useUiStore.getState().hasSeenSplash).toBe(true);
    expect(SecureStore.__store.has(ONBOARDING_DRAFT_KEY)).toBe(false);
  });

  it("blocks replacement of an unsupported draft until explicitly discarded", async () => {
    const original = JSON.stringify({ version: 2, account: { name: "Saved wallet" } });
    SecureStore.__store.set(ONBOARDING_DRAFT_KEY, original);
    await useUiStore.getState().ensurePreferencesLoaded();

    expect(useUiStore.getState().onboardingDraftInvalid).toBe(true);
    await expect(useUiStore.getState().beginOnboarding()).rejects.toThrow(/Discard it explicitly/i);
    expect(SecureStore.__store.get(ONBOARDING_DRAFT_KEY)).toBe(original);

    await useUiStore.getState().discardInvalidOnboardingDraft();
    expect(SecureStore.__store.has(ONBOARDING_DRAFT_KEY)).toBe(false);
    expect(useUiStore.getState().onboardingDraftInvalid).toBe(false);
    await expect(useUiStore.getState().beginOnboarding()).resolves.toMatchObject({ version: 1 });
  });

  it("never discards a draft that became valid or unreadable before confirmation", async () => {
    SecureStore.__store.set(ONBOARDING_DRAFT_KEY, JSON.stringify({ version: 2 }));
    await useUiStore.getState().ensurePreferencesLoaded();

    SecureStore.getItemAsync.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(useUiStore.getState().discardInvalidOnboardingDraft()).rejects.toThrow(/Nothing was deleted/i);
    expect(SecureStore.__store.has(ONBOARDING_DRAFT_KEY)).toBe(true);

    const recovered = createOnboardingDraft();
    SecureStore.__store.set(ONBOARDING_DRAFT_KEY, JSON.stringify(recovered));
    await useUiStore.getState().discardInvalidOnboardingDraft();
    expect(useUiStore.getState().onboardingDraft).toEqual(recovered);
    expect(SecureStore.__store.has(ONBOARDING_DRAFT_KEY)).toBe(true);
  });

  it("clears the draft and persists splash completion together", async () => {
    const draft = await useUiStore.getState().beginOnboarding();
    expect(draft.step).toBe("account");
    expect(SecureStore.__store.has(ONBOARDING_DRAFT_KEY)).toBe(true);

    await useUiStore.getState().completeOnboarding();

    expect(useUiStore.getState().onboardingDraft).toBeNull();
    expect(useUiStore.getState().hasSeenSplash).toBe(true);
    expect(SecureStore.__store.has(ONBOARDING_DRAFT_KEY)).toBe(false);
    expect(SecureStore.__store.get("moneymap.splash.seen.v1")).toBe("true");
  });

  it("keeps the saved draft when writing the completion marker fails", async () => {
    const draft = await useUiStore.getState().beginOnboarding();
    SecureStore.setItemAsync.mockRejectedValueOnce(new Error("marker write unavailable"));

    await expect(useUiStore.getState().completeOnboarding()).rejects.toThrow(/marker write unavailable/);
    expect(SecureStore.__store.get(ONBOARDING_DRAFT_KEY)).toBe(JSON.stringify(draft));
    expect(useUiStore.getState().hasSeenSplash).toBe(false);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});
