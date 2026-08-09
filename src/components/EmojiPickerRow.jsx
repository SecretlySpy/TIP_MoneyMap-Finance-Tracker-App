import { Pressable, View } from "react-native";
import { BUDGET_BILL_EMOJI_PRESETS } from "../domain/services/emoji";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";

/**
 * Single-select emoji chip grid for budgets & recurring bills.
 */
export function EmojiPickerRow({
  label = "Icon",
  value,
  onChange,
  presets = BUDGET_BILL_EMOJI_PRESETS,
}) {
  const theme = useTheme();
  return (
    <View accessibilityLabel={label} accessibilityRole="radiogroup" style={{ gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
        {presets.map((emoji) => {
          const selected = emoji === value;
          return (
            <Pressable
              accessibilityLabel={`Icon ${emoji}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={emoji}
              onPress={() => onChange(emoji)}
              style={{
                alignItems: "center",
                backgroundColor: selected ? theme.colors.tint : theme.colors.surface,
                borderColor: selected ? theme.colors.primary : theme.colors.outline,
                borderRadius: theme.radii.chip,
                borderWidth: selected ? 1.5 : theme.spacing.hairline,
                height: 44,
                justifyContent: "center",
                width: 44,
              }}
            >
              <Text style={{ fontSize: theme.typeScale.body }}>{emoji}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
