import { View } from "react-native";

import { formatTransactionAmount } from "../domain/services/money";
import type { TransactionType } from "../domain/types";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";

export interface TransactionRowProps {
  readonly amountMinor: number;
  readonly compact?: boolean;
  readonly emoji: string;
  readonly meta: string;
  readonly title: string;
  readonly type: TransactionType;
}

// Shared transaction rows preserve the Figma avatar, content, and right-aligned amount layout.
export function TransactionRow({ amountMinor, compact = false, emoji, meta, title, type }: TransactionRowProps) {
  const theme = useTheme();
  const amount = formatTransactionAmount(amountMinor, type);
  const avatarSize = compact ? theme.sizes.compactAvatar : theme.sizes.avatar;

  return (
    <View
      accessible
      accessibilityLabel={`${title}, ${meta}, ${amount}`}
      style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.md, width: "100%" }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.avatarBg,
          borderRadius: theme.radii.round,
          height: avatarSize,
          justifyContent: "center",
          width: avatarSize,
        }}
      >
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.regular, fontSize: 18 }}>
          {emoji}
        </Text>
      </View>
      <View style={{ flex: 1, gap: theme.spacing.xxs, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}
        >
          {meta}
        </Text>
      </View>
      <Text
        style={{
          color: type === "EXPENSE" ? theme.colors.expense : theme.colors.income,
          fontFamily: theme.fonts.bold,
          fontSize: theme.typeScale.body,
        }}
      >
        {amount}
      </Text>
    </View>
  );
}
