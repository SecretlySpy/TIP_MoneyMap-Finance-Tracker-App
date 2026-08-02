/**
 * Route param list shapes for React Navigation (JSDoc only — runtime is untyped).
 *
 * @typedef {Object} HomeStackParamList
 * @property {undefined} Dashboard
 * @property {undefined} Entry
 * @property {undefined} SmartTips
 *
 * @typedef {Object} HistoryStackParamList
 * @property {undefined} HistoryList
 *
 * @typedef {Object} BudgetsStackParamList
 * @property {undefined} BudgetsOverview
 * @property {undefined} Recurring
 *
 * @typedef {Object} SettingsStackParamList
 * @property {undefined} SettingsOverview
 * @property {undefined} ManageCategories
 * @property {undefined} ManageAccounts
 * @property {{ mode: 'csv' | 'backup' }} PasteImport
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
 */

export {};
