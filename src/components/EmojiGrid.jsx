import { Pressable, View } from "react-native";
import { BUDGET_BILL_EMOJI_PRESETS } from "../domain/services/emoji";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";

/**
 * 3x6 Grid of 18 curated emoji icons matching Figma Design System.
 */
export function EmojiGrid({
  onChange,
  presets = BUDGET_BILL_EMOJI_PRESETS,
  value,
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityLabel="Icon choices"
      accessibilityRole="radiogroup"
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: theme.spacing.sm,
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      {presets.map((emoji) => {
        const selected = emoji === value;
        return (
          <Pressable
            accessibilityLabel={`Icon ${emoji}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            key={emoji}
            onPress={() => onChange?.(emoji)}
            style={{
              alignItems: "center",
              backgroundColor: selected ? theme.colors.tint : theme.colors.surface,
              borderColor: selected ? theme.colors.primary : theme.colors.outline,
              borderRadius: theme.radii.small,
              borderWidth: selected ? 1.5 : theme.spacing.hairline,
              height: 43,
              justifyContent: "center",
              width: "14.5%",
            }}
          >
            <Text style={{ fontSize: theme.typeScale.cardHeader }}>{emoji}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
