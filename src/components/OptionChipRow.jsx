import { Pressable, View } from "react-native";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";

/**
 * Accessible single-select chip row (theme / currency pickers).
 * @param {{
 *   label: string,
 *   options: Array<{ value: string, label: string }>,
 *   value: string,
 *   onChange: (value: string) => void,
 *   accessibilityLabel?: string,
 * }} props
 */
export function OptionChipRow({ label, options, value, onChange, accessibilityLabel }) {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="radiogroup"
      style={{ gap: theme.spacing.sm }}
    >
      <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={{
                alignItems: "center",
                backgroundColor: selected ? theme.colors.tint : theme.colors.surface,
                borderColor: selected ? theme.colors.primary : theme.colors.outline,
                borderRadius: theme.radii.chip,
                borderWidth: selected ? 1.5 : theme.spacing.hairline,
                justifyContent: "center",
                minHeight: 44,
                minWidth: 52,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.sm,
              }}
            >
              <Text
                style={{
                  color: selected ? theme.colors.primary : theme.colors.sub,
                  fontFamily: selected ? theme.fonts.bold : theme.fonts.medium,
                  fontSize: theme.typeScale.body,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
