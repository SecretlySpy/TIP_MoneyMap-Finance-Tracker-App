/**
 * Resolve the root shell from persisted state. Keeping this decision pure makes
 * lock and first-run routing testable without mounting native navigators.
 */
export function selectRootNavigationMode({ preferencesReady, hasSeenSplash, onboardingDraft, splashReadError, isLocked }) {
  if (!preferencesReady) {
    return "loading";
  }
  if (isLocked) {
    return "locked";
  }
  if (!hasSeenSplash) {
    return splashReadError || onboardingDraft === null ? "first-run-splash" : "first-run-onboarding";
  }
  return "main";
}

/**
 * Route param list shapes for React Navigation (JSDoc only — runtime is untyped).
 *
 * @typedef {Object} HomeStackParamList
 * @property {undefined} Dashboard
 * @property {undefined} Entry
 * @property {undefined} SmartTips
 * @property {undefined} StudentEats
 * @property {undefined} Reports
 * @property {{ transactionId: number }} TransactionDetail
 * @property {{ transactionId: number }} EditTransaction
 *
 * @typedef {Object} HistoryStackParamList
 * @property {undefined} HistoryList
 * @property {{ transactionId: number }} TransactionDetail
 * @property {{ transactionId: number }} EditTransaction
 *
 * @typedef {Object} BudgetsStackParamList
 * @property {undefined} BudgetsOverview
 * @property {undefined} Recurring
 * @property {undefined} Import
 * @property {{ transactionId: number }} TransactionDetail
 * @property {{ transactionId: number }} EditTransaction
 *
 * @typedef {Object} SettingsStackParamList
 * @property {undefined} SettingsOverview
 * @property {undefined} Goals
 * @property {undefined} ManageCategories
 * @property {undefined} ManageAccounts
 * @property {undefined} Import
 * @property {undefined} Reports
 * @property {{ mode: 'csv' | 'backup' }} PasteImport
 * @property {{ transactionId: number }} TransactionDetail
 * @property {{ transactionId: number }} EditTransaction
 *
 * @typedef {Object} MainTabParamList
 * @property {import('@react-navigation/native').NavigatorScreenParams<HomeStackParamList> | undefined} Home
 * @property {import('@react-navigation/native').NavigatorScreenParams<HistoryStackParamList> | undefined} History
 * @property {import('@react-navigation/native').NavigatorScreenParams<BudgetsStackParamList> | undefined} Budgets
 * @property {import('@react-navigation/native').NavigatorScreenParams<SettingsStackParamList> | undefined} Settings
 *
 * @typedef {Object} RootStackParamList
 * @property {import('@react-navigation/native').NavigatorScreenParams<MainTabParamList> | undefined} Main
 * @property {undefined} AppLock
 * @property {undefined} PinRecovery
 * @property {undefined} Onboarding
 * @property {undefined} Splash
 */

export {};
