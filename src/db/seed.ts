import type { NewCategory } from "../domain/types";
import type { SqlExecutor } from "./sql";

export const DEFAULT_STUDENT_CATEGORIES = [
  {
    name: "Food",
    icon: "restaurant",
    colorHex: "#EA580C",
    type: "EXPENSE",
    isCustom: false,
  },
  {
    name: "Transport",
    icon: "bus",
    colorHex: "#2563EB",
    type: "EXPENSE",
    isCustom: false,
  },
  {
    name: "School",
    icon: "school",
    colorHex: "#7C3AED",
    type: "EXPENSE",
    isCustom: false,
  },
  {
    name: "Load/Data",
    icon: "wifi",
    colorHex: "#0891B2",
    type: "EXPENSE",
    isCustom: false,
  },
  {
    name: "Shopping",
    icon: "shopping-bag",
    colorHex: "#DB2777",
    type: "EXPENSE",
    isCustom: false,
  },
  {
    name: "Entertainment",
    icon: "game-controller",
    colorHex: "#9333EA",
    type: "EXPENSE",
    isCustom: false,
  },
  {
    name: "Other",
    icon: "ellipsis-horizontal",
    colorHex: "#64748B",
    type: "EXPENSE",
    isCustom: false,
  },
  {
    name: "Allowance",
    icon: "wallet",
    colorHex: "#16A34A",
    type: "INCOME",
    isCustom: false,
  },
  {
    name: "Part-time",
    icon: "briefcase",
    colorHex: "#0F766E",
    type: "INCOME",
    isCustom: false,
  },
  {
    name: "Scholarship",
    icon: "ribbon",
    colorHex: "#4F46E5",
    type: "INCOME",
    isCustom: false,
  },
  {
    name: "Gifts",
    icon: "gift",
    colorHex: "#C2410C",
    type: "INCOME",
    isCustom: false,
  },
  {
    name: "Other",
    icon: "ellipsis-horizontal",
    colorHex: "#15803D",
    type: "INCOME",
    isCustom: false,
  },
] as const satisfies readonly NewCategory[];

export async function seedInitialData(database: SqlExecutor): Promise<void> {
  await database.execute(
    `INSERT INTO accounts (name, type, starting_balance_minor, is_archived)
     SELECT ?, ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM accounts WHERE name = ? AND type = ? AND starting_balance_minor = ?
     )`,
    ["Cash", "CASH", 0, 0, "Cash", "CASH", 0],
  );

  for (const category of DEFAULT_STUDENT_CATEGORIES) {
    await database.execute(
      `INSERT INTO categories (name, icon, color_hex, type, is_custom)
       SELECT ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM categories WHERE name = ? AND type = ? AND is_custom = 0
       )`,
      [
        category.name,
        category.icon,
        category.colorHex,
        category.type,
        0,
        category.name,
        category.type,
      ],
    );
  }
}
