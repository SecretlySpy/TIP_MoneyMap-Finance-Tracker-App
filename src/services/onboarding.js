import * as SecureStore from "expo-secure-store";

export const ONBOARDING_DRAFT_KEY = "moneymap.onboarding.draft.v1";
export const ONBOARDING_FIRST_TRANSACTION_SOURCE_KEY = "onboarding:v1:first-transaction";
export const ONBOARDING_STEPS = Object.freeze(["account", "expense", "lock"]);

const ACCOUNT_TYPES = new Set(["CASH", "CARD", "EWALLET"]);

function boundedText(value, fallback, maxLength, { trim = false } = {}) {
  const source = typeof value === "string" ? value : fallback;
  const bounded = source.slice(0, maxLength);
  return trim ? bounded.trim() : bounded;
}

function normalizedAccountId(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * Keep the resumable payload deliberately small and versioned. Financial records
 * remain authoritative in SQLite; this draft only contains unfinished form state.
 */
export function normalizeOnboardingDraft(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const account = value.account && typeof value.account === "object" ? value.account : {};
  const expense = value.expense && typeof value.expense === "object" ? value.expense : {};
  const accountType = ACCOUNT_TYPES.has(account.type) ? account.type : "CASH";
  const expenseAccountType = ACCOUNT_TYPES.has(expense.accountType)
    ? expense.accountType
    : accountType;

  return {
    version: 1,
    step: ONBOARDING_STEPS.includes(value.step) ? value.step : "account",
    account: {
      name: boundedText(account.name, "Cash", 48),
      type: accountType,
      openingBalanceInput: boundedText(account.openingBalanceInput, "0", 24),
    },
    expense: {
      accountId: normalizedAccountId(expense.accountId),
      accountType: expenseAccountType,
      amountInput: boundedText(expense.amountInput, "", 24),
      categoryName: boundedText(expense.categoryName, "Food", 48, { trim: true }) || "Food",
      note: boundedText(expense.note, "", 120),
    },
  };
}

export function createOnboardingDraft() {
  return normalizeOnboardingDraft({});
}

export function mergeOnboardingDraft(current, patch) {
  const base = normalizeOnboardingDraft(current) ?? createOnboardingDraft();
  const nextPatch = patch && typeof patch === "object" ? patch : {};
  return normalizeOnboardingDraft({
    ...base,
    ...nextPatch,
    account: {
      ...base.account,
      ...(nextPatch.account && typeof nextPatch.account === "object" ? nextPatch.account : {}),
    },
    expense: {
      ...base.expense,
      ...(nextPatch.expense && typeof nextPatch.expense === "object" ? nextPatch.expense : {}),
    },
  });
}

export async function loadOnboardingDraftResult() {
  let raw;
  try {
    raw = await SecureStore.getItemAsync(ONBOARDING_DRAFT_KEY);
  } catch {
    return { draft: null, status: "unreadable" };
  }

  if (raw === null) {
    return { draft: null, status: "missing" };
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) {
      return { draft: null, status: "invalid" };
    }
    const draft = normalizeOnboardingDraft(parsed);
    return draft === null
      ? { draft: null, status: "invalid" }
      : { draft, status: "loaded" };
  } catch {
    return { draft: null, status: "invalid" };
  }
}

export async function loadOnboardingDraft() {
  return (await loadOnboardingDraftResult()).draft;
}

export async function saveOnboardingDraft(value) {
  const normalized = normalizeOnboardingDraft(value);
  if (normalized === null) {
    throw new TypeError("Onboarding draft must be an object.");
  }
  await SecureStore.setItemAsync(ONBOARDING_DRAFT_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function clearOnboardingDraft() {
  await SecureStore.deleteItemAsync(ONBOARDING_DRAFT_KEY);
}
