import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const uiFiles = [
  "src/components/AppText.jsx",
  "src/components/BudgetCard.jsx",
  "src/components/Buttons.jsx",
  "src/components/Chip.jsx",
  "src/components/DatabaseGate.jsx",
  "src/components/EmptyState.jsx",
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
  "src/screens/HistoryScreen.jsx",
  "src/screens/ImportScreen.jsx",
  "src/screens/ManageAccountsScreen.jsx",
  "src/screens/ManageCategoriesScreen.jsx",
  "src/screens/PasteImportScreen.jsx",
  "src/screens/RecurringScreen.jsx",
  "src/screens/SettingsScreen.jsx",
  "src/screens/SmartTipsScreen.jsx",
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
});
