import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const uiFiles = [
  "src/components/AppText.tsx",
  "src/components/BudgetCard.tsx",
  "src/components/Buttons.tsx",
  "src/components/Chip.tsx",
  "src/components/MonthChip.tsx",
  "src/components/ProgressBar.tsx",
  "src/components/ScreenContainer.tsx",
  "src/components/SectionCard.tsx",
  "src/components/SpendingDonut.tsx",
  "src/components/TabIcon.tsx",
  "src/components/Toggle.tsx",
  "src/components/TransactionRow.tsx",
  "src/screens/AppLockScreen.tsx",
  "src/screens/BudgetsScreen.tsx",
  "src/screens/DashboardScreen.tsx",
  "src/screens/EntryScreen.tsx",
  "src/screens/HistoryScreen.tsx",
  "src/screens/RecurringScreen.tsx",
  "src/screens/SettingsScreen.tsx",
  "src/screens/SmartTipsScreen.tsx",
];

describe("static UI fidelity boundaries", () => {
  it("keeps hexadecimal colors out of screens and reusable components", () => {
    const violations = uiFiles
      .filter((relativePath) => {
        try {
          return /#[0-9a-f]{3,8}\b/i.test(readFileSync(join(root, relativePath), "utf8"));
        } catch {
          return false;
        }
      });

    expect(violations).toEqual([]);
  });

  it("keeps the Smart Tips UI offline and free of direct fetch calls", () => {
    const smartTipsSource = readFileSync(join(root, "src/screens/SmartTipsScreen.tsx"), "utf8");
    expect(smartTipsSource).not.toMatch(/\bfetch\s*\(/);
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
      expect(source).toContain("stroke=\"#6B7572\"");
    }
  });
});
