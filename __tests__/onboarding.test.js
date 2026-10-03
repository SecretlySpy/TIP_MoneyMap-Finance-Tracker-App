jest.mock("expo-secure-store", () => {
  const values = new Map();
  return {
    __values: values,
    deleteItemAsync: jest.fn(async (key) => {
      values.delete(key);
    }),
    getItemAsync: jest.fn(async (key) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => {
      values.set(key, value);
    }),
  };
});

import * as SecureStore from "expo-secure-store";
import {
  clearOnboardingDraft,
  createOnboardingDraft,
  loadOnboardingDraft,
  loadOnboardingDraftResult,
  mergeOnboardingDraft,
  normalizeOnboardingDraft,
  ONBOARDING_DRAFT_KEY,
  saveOnboardingDraft,
} from "../src/services/onboarding";

describe("resumable onboarding draft", () => {
  beforeEach(() => {
    SecureStore.__values.clear();
    jest.clearAllMocks();
  });

  it("normalizes the versioned draft to a small supported shape", () => {
    const normalized = normalizeOnboardingDraft({
      version: 99,
      step: "unknown",
      ignored: "not persisted",
      account: { name: "Campus wallet", type: "CRYPTO", openingBalanceInput: "125.50", extra: true },
      expense: { accountId: -2, accountType: "CARD", amountInput: "80", categoryName: "  Food  ", note: "Lunch" },
    });

    expect(normalized).toEqual({
      version: 1,
      step: "account",
      account: { name: "Campus wallet", type: "CASH", openingBalanceInput: "125.50" },
      expense: { accountId: null, accountType: "CARD", amountInput: "80", categoryName: "Food", note: "Lunch" },
    });
  });

  it("persists, reloads, merges, and clears a resumable draft", async () => {
    const draft = mergeOnboardingDraft(createOnboardingDraft(), {
      step: "expense",
      account: { name: "Allowance", type: "EWALLET" },
      expense: { accountId: 7, amountInput: "42.75" },
    });

    await expect(saveOnboardingDraft(draft)).resolves.toEqual(draft);
    await expect(loadOnboardingDraft()).resolves.toEqual(draft);
    expect(JSON.parse(SecureStore.__values.get(ONBOARDING_DRAFT_KEY))).toEqual(draft);

    await clearOnboardingDraft();
    await expect(loadOnboardingDraft()).resolves.toBeNull();
  });

  it("preserves corrupt or unsupported drafts until the user explicitly discards them", async () => {
    SecureStore.__values.set(ONBOARDING_DRAFT_KEY, "not-json");
    await expect(loadOnboardingDraftResult()).resolves.toEqual({ draft: null, status: "invalid" });
    expect(SecureStore.__values.get(ONBOARDING_DRAFT_KEY)).toBe("not-json");

    const futureDraft = JSON.stringify({ version: 2, step: "account" });
    SecureStore.__values.set(ONBOARDING_DRAFT_KEY, futureDraft);
    await expect(loadOnboardingDraftResult()).resolves.toEqual({ draft: null, status: "invalid" });
    expect(SecureStore.__values.get(ONBOARDING_DRAFT_KEY)).toBe(futureDraft);
    await expect(loadOnboardingDraftResult()).resolves.toEqual({ draft: null, status: "invalid" });
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it("distinguishes an unreadable draft from a missing draft", async () => {
    SecureStore.getItemAsync.mockRejectedValueOnce(new Error("secure storage unavailable"));
    await expect(loadOnboardingDraftResult()).resolves.toEqual({
      draft: null,
      status: "unreadable",
    });
  });
});
