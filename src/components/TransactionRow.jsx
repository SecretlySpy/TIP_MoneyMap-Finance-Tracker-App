import { Pressable, View } from "react-native";
import { formatTransactionAmount } from "../domain/services/money";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";

// Shared transaction rows preserve the Figma avatar, content, and right-aligned amount layout.
export function TransactionRow({ amountMinor, compact = false, emoji, meta, title, type, onPress }) {
    const theme = useTheme(useUiStore((state) => state.themePreference));
    const currencySymbol = useUiStore((state) => state.currencySymbol);
    const amount = formatTransactionAmount(amountMinor, type, true, currencySymbol);
    const avatarSize = compact ? theme.sizes.compactAvatar : theme.sizes.avatar;
    const accessibilityLabel = `${title}, ${meta}, ${amount}`;

    const content = (
        <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.md, width: "100%" }}>
            <View style={{
                alignItems: "center",
                backgroundColor: theme.colors.avatarBg,
                borderRadius: theme.radii.round,
                height: avatarSize,
                justifyContent: "center",
                width: avatarSize,
            }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.regular, fontSize: 18 }}>
                    {emoji}
                </Text>
            </View>
            <View style={{ flex: 1, gap: theme.spacing.xxs, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
                    {title}
                </Text>
                <Text numberOfLines={1} style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
                    {meta}
                </Text>
            </View>
            <Text style={{
                color: type === "EXPENSE" ? theme.colors.expense : type === "INCOME" ? theme.colors.income : theme.colors.text,
                fontFamily: theme.fonts.bold,
                fontSize: theme.typeScale.body,
            }}>
                {amount}
            </Text>
        </View>
    );

    if (onPress) {
        return (
            <Pressable
                accessibilityLabel={accessibilityLabel}
                accessibilityRole="button"
                onPress={onPress}
                style={{ width: "100%" }}
            >
                {content}
            </Pressable>
        );
    }

    return (
        <View accessible accessibilityLabel={accessibilityLabel} style={{ width: "100%" }}>
            {content}
        </View>
    );
}
