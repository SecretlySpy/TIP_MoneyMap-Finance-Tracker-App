import type { NavigatorScreenParams } from "@react-navigation/native";

export type HomeStackParamList = {
  Dashboard: undefined;
  Entry: undefined;
  SmartTips: undefined;
};

export type HistoryStackParamList = {
  HistoryList: undefined;
};

export type BudgetsStackParamList = {
  BudgetsOverview: undefined;
  Recurring: undefined;
};

export type SettingsStackParamList = {
  SettingsOverview: undefined;
  ManageCategories: undefined;
  ManageAccounts: undefined;
  PasteImport: { mode: "csv" | "backup" };
};

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  History: NavigatorScreenParams<HistoryStackParamList>;
  Budgets: NavigatorScreenParams<BudgetsStackParamList>;
  Settings: NavigatorScreenParams<SettingsStackParamList>;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
  AppLock: undefined;
};
