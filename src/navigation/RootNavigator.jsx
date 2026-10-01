// Import the navigation factories, routed screens, shared UI, state, and theme
// dependencies used to assemble the application's complete navigation tree.
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
import { TransactionDetailScreen } from "../screens/TransactionDetailScreen";
import { EditTransactionScreen } from "../screens/EditTransactionScreen";
import { ManageAccountsScreen } from "../screens/ManageAccountsScreen";
import { ManageCategoriesScreen } from "../screens/ManageCategoriesScreen";
import { PasteImportScreen } from "../screens/PasteImportScreen";
import { ImportScreen } from "../screens/ImportScreen";
import { RecurringScreen } from "../screens/RecurringScreen";
import { GoalsScreen } from "../screens/GoalsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { SmartTipsScreen } from "../screens/SmartTipsScreen";
import { SplashScreen } from "../screens/SplashScreen";
import { StudentEatsScreen } from "../screens/StudentEatsScreen";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

// Give each feature area its own stack so screens can push details or editors
// without resetting the other bottom tabs' navigation history.
const RootStack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const HistoryStack = createNativeStackNavigator();
const BudgetsStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

// Own the dashboard flow and every route launched from its primary actions.
function HomeNavigator() {
    return (<HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Dashboard" component={DashboardScreen}/>
      <HomeStack.Screen name="Entry" component={EntryScreen} options={{ animation: "slide_from_bottom" }}/>
      <HomeStack.Screen name="SmartTips" component={SmartTipsScreen}/>
      <HomeStack.Screen name="StudentEats" component={StudentEatsScreen}/>
      <HomeStack.Screen name="TransactionDetail" component={TransactionDetailScreen}/>
      <HomeStack.Screen name="EditTransaction" component={EditTransactionScreen}/>
    </HomeStack.Navigator>);
}

// Keep transaction review, detail, and edit screens in one history workflow.
function HistoryNavigator() {
    return (<HistoryStack.Navigator screenOptions={{ headerShown: false }}>
      <HistoryStack.Screen name="HistoryList" component={HistoryScreen}/>
      <HistoryStack.Screen name="TransactionDetail" component={TransactionDetailScreen}/>
      <HistoryStack.Screen name="EditTransaction" component={EditTransactionScreen}/>
    </HistoryStack.Navigator>);
}

// Keep budget overview and recurring-payment routes in the budget workflow.
function BudgetsNavigator() {
    return (<BudgetsStack.Navigator screenOptions={{ headerShown: false }}>
      <BudgetsStack.Screen name="BudgetsOverview" component={BudgetsScreen}/>
      <BudgetsStack.Screen name="Recurring" component={RecurringScreen}/>
      <BudgetsStack.Screen name="TransactionDetail" component={TransactionDetailScreen}/>
      <BudgetsStack.Screen name="EditTransaction" component={EditTransactionScreen}/>
    </BudgetsStack.Navigator>);
}

// Group preference, data-management, goal, and splash-preview screens together.
function SettingsNavigator() {
    return (<SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="SettingsOverview" component={SettingsScreen}/>
      <SettingsStack.Screen name="Goals" component={GoalsScreen}/>
      <SettingsStack.Screen name="ManageCategories" component={ManageCategoriesScreen}/>
      <SettingsStack.Screen name="ManageAccounts" component={ManageAccountsScreen}/>
      <SettingsStack.Screen name="PasteImport" component={PasteImportScreen}/>
      <SettingsStack.Screen name="Import" component={ImportScreen}/>
      <SettingsStack.Screen name="TransactionDetail" component={TransactionDetailScreen}/>
      <SettingsStack.Screen name="EditTransaction" component={EditTransactionScreen}/>
      <SettingsStack.Screen name="Splash" component={SplashScreen}/>
    </SettingsStack.Navigator>);
}

// Map route names to the shared icon component's stable semantic icon keys.
const tabIcons = {
    Home: "home",
    History: "history",
    Budgets: "budgets",
    Settings: "settings",
};

// Build the persistent four-tab shell and derive its appearance from the active
// theme plus the device's bottom safe-area inset.
function MainTabs() {
    const theme = useTheme(useUiStore((state) => state.themePreference));
    const insets = useSafeAreaInsets();
    return (<Tabs.Navigator screenOptions={({ route }) => {
            // Inspect the focused child route so the full-screen entry form can
            // temporarily hide the tab bar without changing global navigation.
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
      {/* Register each feature stack as one persistent bottom-tab destination. */}
      <Tabs.Screen name="Home" component={HomeNavigator}/>
      <Tabs.Screen name="History" component={HistoryNavigator}/>
      <Tabs.Screen name="Budgets" component={BudgetsNavigator}/>
      <Tabs.Screen name="Settings" component={SettingsNavigator}/>
    </Tabs.Navigator>);
}
// App Lock sits above navigation when enabled; unlocked sessions reach the tab shell.
export function RootNavigator() {
    // Subscribe only to the UI state required to select the initial root route.
    const isLocked = useUiStore((state) => state.isLocked);
    const hasSeenSplash = useUiStore((state) => state.hasSeenSplash);
    const preferencesReady = useUiStore((state) => state.preferencesReady);
    const ensurePreferencesLoaded = useUiStore((state) => state.ensurePreferencesLoaded);
    const themePreference = useUiStore((state) => state.themePreference);
    const theme = useTheme(themePreference);

    // Restore persisted preferences once when the store action becomes available.
    useEffect(() => {
        void ensurePreferencesLoaded();
    }, [ensurePreferencesLoaded]);

    // Keep navigation hidden until persisted lock, splash, and theme state is ready.
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

    // First-time users see Splash before Main; AppLock remains registered so the
    // application can enable or enter its security flow without rebuilding the root.
    if (!hasSeenSplash) {
        return (
          <RootStack.Navigator screenOptions={{ headerShown: false }}>
            <RootStack.Screen name="Splash" component={SplashScreen} />
            <RootStack.Screen name="Main" component={MainTabs} />
            <RootStack.Screen name="AppLock" component={AppLockScreen} options={{ animation: "fade" }} />
          </RootStack.Navigator>
        );
    }

    // Put the active initial screen first while keeping both Main and AppLock
    // registered for later navigation during the same application session.
    return (<RootStack.Navigator screenOptions={{ headerShown: false }}>
      {isLocked ? (
        <>
          <RootStack.Screen name="AppLock" component={AppLockScreen} options={{ animation: "fade" }} />
          <RootStack.Screen name="Main" component={MainTabs} />
        </>
      ) : (
        <>
          <RootStack.Screen name="Main" component={MainTabs} />
          <RootStack.Screen name="AppLock" component={AppLockScreen} options={{ animation: "fade" }} />
        </>
      )}
      <RootStack.Screen name="Splash" component={SplashScreen} />
    </RootStack.Navigator>);
}
