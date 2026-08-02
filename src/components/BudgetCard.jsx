import { View } from "react-native";
import { formatMinor } from "../domain/services/money";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";
import { ProgressBar } from "./ProgressBar";
import { SectionCard } from "./SectionCard";
function statusText(percent, state) {
    if (state === "warning")
        return `${percent}% — approaching limit`;
    if (state === "over")
        return `${percent}% — over budget`;
    return `${percent}%`;
}
// Budget state selects one semantic color while reported percentages remain unclamped.
export function BudgetCard({ currencySymbol, emoji, limitMinor, name, percent, spentMinor, state, }) {
    const theme = useTheme(useUiStore((store) => store.themePreference));
    const preferredCurrency = useUiStore((store) => store.currencySymbol);
    const symbol = currencySymbol ?? preferredCurrency;
    const stateColor = state === "warning"
        ? theme.colors.warning
        : state === "over"
            ? theme.colors.expense
            : theme.colors.primary;
    return (<SectionCard style={{ gap: theme.spacing.keyGap }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.sm }}>
        <Text style={{ fontFamily: theme.fonts.regular, fontSize: 17 }}>{emoji}</Text>
        <Text style={{ color: theme.colors.text, flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.listName }}>
          {name}
        </Text>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
          {formatMinor(spentMinor, { currencySymbol: symbol, showCents: false })} /{" "}
          {formatMinor(limitMinor, { currencySymbol: symbol, showCents: false })}
        </Text>
      </View>
      <ProgressBar color={stateColor} percent={percent}/>
      <Text style={{ color: stateColor, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
        {statusText(percent, state)}
      </Text>
    </SectionCard>);
}
