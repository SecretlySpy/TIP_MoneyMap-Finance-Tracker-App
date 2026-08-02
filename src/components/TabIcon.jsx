import BudgetsIcon from "../../assets/icons/budgets.svg";
import HistoryIcon from "../../assets/icons/history.svg";
import HomeIcon from "../../assets/icons/home.svg";
import SettingsIcon from "../../assets/icons/settings.svg";
import { sizes } from "../theme/tokens";
const iconComponents = {
    budgets: BudgetsIcon,
    history: HistoryIcon,
    home: HomeIcon,
    settings: SettingsIcon,
};
// Geometry comes from committed Figma exports; color is replaced from the active theme.
export function TabIcon({ color, name }) {
    const Icon = iconComponents[name];
    return <Icon color={color} height={sizes.tabIcon} width={sizes.tabIcon}/>;
}
