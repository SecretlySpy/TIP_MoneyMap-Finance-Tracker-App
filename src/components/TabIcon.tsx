import type { FunctionComponent } from "react";
import type { SvgProps } from "react-native-svg";

import BudgetsIcon from "../../assets/icons/budgets.svg";
import HistoryIcon from "../../assets/icons/history.svg";
import HomeIcon from "../../assets/icons/home.svg";
import SettingsIcon from "../../assets/icons/settings.svg";
import { sizes } from "../theme/tokens";

export type TabIconName = "budgets" | "history" | "home" | "settings";

const iconComponents: Record<TabIconName, FunctionComponent<SvgProps>> = {
  budgets: BudgetsIcon,
  history: HistoryIcon,
  home: HomeIcon,
  settings: SettingsIcon,
};

interface TabIconProps {
  readonly color: string;
  readonly name: TabIconName;
}

// Geometry comes from committed Figma exports; color is replaced from the active theme.
export function TabIcon({ color, name }: TabIconProps) {
  const Icon = iconComponents[name];
  return <Icon color={color} height={sizes.tabIcon} width={sizes.tabIcon} />;
}
