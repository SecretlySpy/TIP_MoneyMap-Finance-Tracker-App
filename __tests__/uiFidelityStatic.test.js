import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const uiFiles = [
  "src/components/AppText.jsx",
  "src/components/BottomSheet.jsx",
  "src/components/BudgetCard.jsx",
  "src/components/Buttons.jsx",
  "src/components/Chip.jsx",
  "src/components/DatabaseGate.jsx",
  "src/components/EmptyState.jsx",
  "src/components/EmojiGrid.jsx",
  "src/components/EmojiPickerRow.jsx",
  "src/components/GoalCard.jsx",
  "src/components/OptionChipRow.jsx",
  "src/components/SafeToSpendCard.jsx",
  "src/components/MonthChip.jsx",
  "src/components/ProgressBar.jsx",
  "src/components/ScreenContainer.jsx",
  "src/components/SectionCard.jsx",
  "src/components/SpendingDonut.jsx",
  "src/components/TabIcon.jsx",
  "src/components/TextPromptModal.jsx",
  "src/components/Toggle.jsx",
  "src/components/TransactionRow.jsx",
  "src/screens/AppLockScreen.jsx",
  "src/screens/BudgetsScreen.jsx",
  "src/screens/DashboardScreen.jsx",
  "src/screens/EntryScreen.jsx",
  "src/screens/GoalsScreen.jsx",
  "src/screens/HistoryScreen.jsx",
  "src/screens/ImportScreen.jsx",
  "src/screens/ManageAccountsScreen.jsx",
  "src/screens/ManageCategoriesScreen.jsx",
  "src/screens/PasteImportScreen.jsx",
  "src/screens/RecurringScreen.jsx",
  "src/screens/SettingsScreen.jsx",
  "src/screens/SmartTipsScreen.jsx",
  "src/screens/SplashScreen.jsx",
  "src/screens/StudentEatsScreen.jsx",
];

describe("static UI fidelity boundaries", () => {
  it("keeps hexadecimal colors out of screens and reusable components", () => {
    const violations = uiFiles.filter((relativePath) => {
      try {
        return /#[0-9a-f]{3,8}\b/i.test(readFileSync(join(root, relativePath), "utf8"));
      } catch {
        return false;
      }
    });
    expect(violations).toEqual([]);
  });

  it("keeps screens free of direct fetch; remote clients own networking", () => {
    const screensDir = join(root, "src/screens");
    for (const name of readdirSync(screensDir)) {
      if (!name.endsWith(".js") && !name.endsWith(".jsx")) continue;
      const src = readFileSync(join(screensDir, name), "utf8");
      expect(src).not.toMatch(/\bfetch\s*\(/);
    }
    const remoteDir = join(root, "src/remote");
    const remoteFiles = readdirSync(remoteDir).filter((n) => n.endsWith(".js"));
    expect(remoteFiles.length).toBeGreaterThanOrEqual(2);
    for (const name of remoteFiles) {
      const src = readFileSync(join(remoteDir, name), "utf8");
      expect(src).toMatch(/\bfetch\b/);
    }
  });

  it("avoids Fabric-incompatible pressed-state style callbacks", () => {
    const violations = uiFiles.filter((relativePath) => {
      const source = readFileSync(join(root, relativePath), "utf8");
      return /style\s*=\s*\{\s*\(\s*\{\s*pressed\b/.test(source);
    });
    expect(violations).toEqual([]);
  });

  it("commits all four exact Figma navigation exports", () => {
    for (const icon of ["home.svg", "history.svg", "budgets.svg", "settings.svg"]) {
      const source = readFileSync(join(root, "assets/icons", icon), "utf8");
      expect(source.startsWith("<svg")).toBe(true);
      expect(source).toContain('stroke="#6B7572"');
    }
  });

  it("ships plain JavaScript sources without TypeScript extensions in app code", () => {
    const appFiles = [
      "App.js",
      "src/domain/types.js",
      "src/store/financeStore.js",
      "src/navigation/RootNavigator.jsx",
    ];
    for (const relativePath of appFiles) {
      expect(() => readFileSync(join(root, relativePath), "utf8")).not.toThrow();
    }
  });

  it("keeps offline Smart Tips reachable when online personalization is off", () => {
    const tips = readFileSync(join(root, "src/screens/SmartTipsScreen.jsx"), "utf8");
    const dashboard = readFileSync(join(root, "src/screens/DashboardScreen.jsx"), "utf8");
    expect(tips).not.toMatch(/if \(!smartTipsEnabled\)\s*\{\s*navigation\.goBack/);
    expect(dashboard).toContain('navigation.navigate("SmartTips")');
  });

  it("keeps every dashboard destination reachable with labeled actions", () => {
    const dashboard = readFileSync(join(root, "src/screens/DashboardScreen.jsx"), "utf8");
    expect(dashboard).toContain('label: "🧾 History"');
    expect(dashboard).toContain('label: "📊 Budgets"');
    expect(dashboard).toContain('label: "🔁 Recurring"');
    expect(dashboard).toContain('accessibilityLabel="See budgets"');
    expect(dashboard).toContain('navigation.navigate("StudentEats")');
    expect(dashboard).toContain('{ screen: "Goals" }');
  });

  it("uses named account ids for Entry and removes unsupported GPS claims", () => {
    const entry = readFileSync(join(root, "src/screens/EntryScreen.jsx"), "utf8");
    const location = readFileSync(join(root, "src/services/locationService.js"), "utf8");
    const appConfig = readFileSync(join(root, "app.json"), "utf8");
    expect(entry).toContain("accountId: selectedAccountId");
    expect(location).not.toContain('import("expo-location")');
    expect(appConfig).not.toMatch(/ACCESS_(COARSE|FINE)_LOCATION/);
  });
});
