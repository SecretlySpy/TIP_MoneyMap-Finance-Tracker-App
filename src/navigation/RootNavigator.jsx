import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText as Text } from "../components/AppText";
import { TabIcon } from "../components/TabIcon";
import { AppLockScreen } from "../screens/AppLockScreen";
import { BudgetsScreen } from "../screens/BudgetsScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { EntryScreen } from "../screens/EntryScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { ManageAccountsScreen } from "../screens/ManageAccountsScreen";
import { ManageCategoriesScreen } from "../screens/ManageCategoriesScreen";
import { PasteImportScreen } from "../screens/PasteImportScreen";
import { ImportScreen } from "../screens/ImportScreen";
import { RecurringScreen } from "../screens/RecurringScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { SmartTipsScreen } from "../screens/SmartTipsScreen";
import { StudentEatsScreen } from "../screens/StudentEatsScreen";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";
const RootStack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const HistoryStack = createNativeStackNavigator();
const BudgetsStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();
function HomeNavigator() {
    return (<HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Dashboard" component={DashboardScreen}/>
      <HomeStack.Screen name="Entry" component={EntryScreen} options={{ animation: "slide_from_bottom" }}/>
      <HomeStack.Screen name="SmartTips" component={SmartTipsScreen}/>
      <HomeStack.Screen name="StudentEats" component={StudentEatsScreen}/>
    </HomeStack.Navigator>);
}
function HistoryNavigator() {
    return (<HistoryStack.Navigator screenOptions={{ headerShown: false }}>
      <HistoryStack.Screen name="HistoryList" component={HistoryScreen}/>
    </HistoryStack.Navigator>);
}
function BudgetsNavigator() {
    return (<BudgetsStack.Navigator screenOptions={{ headerShown: false }}>
      <BudgetsStack.Screen name="BudgetsOverview" component={BudgetsScreen}/>
      <BudgetsStack.Screen name="Recurring" component={RecurringScreen}/>
    </BudgetsStack.Navigator>);
}
function SettingsNavigator() {
    return (<SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="SettingsOverview" component={SettingsScreen}/>
      <SettingsStack.Screen name="ManageCategories" component={ManageCategoriesScreen}/>
      <SettingsStack.Screen name="ManageAccounts" component={ManageAccountsScreen}/>
      <SettingsStack.Screen name="PasteImport" component={PasteImportScreen}/>
      <SettingsStack.Screen name="Import" component={ImportScreen}/>
    </SettingsStack.Navigator>);
}
const tabIcons = {
    Home: "home",
    History: "history",
    Budgets: "budgets",
    Settings: "settings",
};
function MainTabs() {
    const theme = useTheme(useUiStore((state) => state.themePreference));
    const insets = useSafeAreaInsets();
    return (<Tabs.Navigator screenOptions={({ route }) => {
            const nestedRoute = getFocusedRouteNameFromRoute(route) ?? "Dashboard";
            const hideForEntry = route.name === "Home" && nestedRoute === "Entry";
            return {
                headerShown: false,
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: theme.colors.sub,
                tabBarIcon: ({ color }) => <TabIcon color={color} name={tabIcons[route.name]}/>,
                tabBarIconStyle: { marginTop: theme.spacing.xs },
                tabBarLabelStyle: {
                    fontFamily: theme.fonts.medium,
                    fontSize: theme.typeScale.small,
                    marginTop: theme.spacing.xs,
                },
                tabBarStyle: hideForEntry
                    ? { display: "none" }
                    : {
                        backgroundColor: theme.colors.surface,
                        borderTopColor: theme.colors.outline,
                        borderTopWidth: theme.spacing.hairline,
                        height: theme.sizes.tabBar + insets.bottom,
                        paddingBottom: Math.max(insets.bottom, theme.spacing.xl),
                        paddingHorizontal: theme.spacing.screen,
                        paddingTop: theme.spacing.md,
                    },
            };
        }}>
      <Tabs.Screen name="Home" component={HomeNavigator}/>
      <Tabs.Screen name="History" component={HistoryNavigator}/>
      <Tabs.Screen name="Budgets" component={BudgetsNavigator}/>
      <Tabs.Screen name="Settings" component={SettingsNavigator}/>
    </Tabs.Navigator>);
}
// App Lock sits above navigation when enabled; unlocked sessions reach the tab shell.
export function RootNavigator() {
    const isLocked = useUiStore((state) => state.isLocked);
    const preferencesReady = useUiStore((state) => state.preferencesReady);
    const ensurePreferencesLoaded = useUiStore((state) => state.ensurePreferencesLoaded);
    const themePreference = useUiStore((state) => state.themePreference);
    const theme = useTheme(themePreference);
    useEffect(() => {
        void ensurePreferencesLoaded();
    }, [ensurePreferencesLoaded]);
    if (!preferencesReady) {
        return (
          <View
            accessibilityLabel="Loading preferences"
            accessibilityRole="progressbar"
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.bg,
              flex: 1,
              gap: theme.spacing.xl,
              justifyContent: "center",
            }}
          >
            <ActivityIndicator color={theme.colors.primary} size="large" />
            <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
              Restoring your settings…
            </Text>
          </View>
        );
    }
    return (<RootStack.Navigator screenOptions={{ headerShown: false }}>
      {isLocked ? (<RootStack.Screen name="AppLock" component={AppLockScreen} options={{ animation: "fade" }}/>) : (<>
          <RootStack.Screen name="Main" component={MainTabs}/>
          <RootStack.Screen name="AppLock" component={AppLockScreen} options={{ animation: "fade" }}/>
        </>)}
    </RootStack.Navigator>);
}
