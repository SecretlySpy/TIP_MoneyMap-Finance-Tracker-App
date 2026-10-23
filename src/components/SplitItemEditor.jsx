import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppText as Text } from "./AppText";
import { resolveDisplayEmoji } from "../domain/services/emoji";
import { formatMinor } from "../domain/services/money";
import { useTheme } from "../theme/tokens";

/**
 * SplitItemEditor component (P2 Power Tools)
 * Provides independent editing of category and monetary amount for a split entry.
 * Clear active/editing state, touch targets, and accessibility.
 */
export function SplitItemEditor({
  split,
  index,
  isActive = false,
  onSelect,
  onCategoryPress,
  onAmountChange,
  onAmountFocus,
  onRemove,
  canRemove = true,
  currencySymbol = "₱",
  categoryIcon,
}) {
  const theme = useTheme();
  const emoji = resolveDisplayEmoji({
    icon: categoryIcon,
    name: split.categoryName || "Expense",
  });

  const rawDisplay =
    split.rawAmount !== undefined
      ? split.rawAmount
      : split.amountMinor === 0
      ? "0"
      : split.amountMinor % 100 === 0
      ? String(split.amountMinor / 100)
      : (split.amountMinor / 100).toFixed(2);

  return (
    <Pressable
      accessibilityLabel={`Split #${index + 1}: ${split.categoryName || "Uncategorized"}, ${formatMinor(split.amountMinor || 0, { currencySymbol })}${isActive ? ", active" : ""}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      onPress={onSelect}
      style={[
        styles.container,
        {
          backgroundColor: isActive ? theme.colors.avatarBg : theme.colors.surface,
          borderColor: isActive ? theme.colors.primary : theme.colors.outline,
          borderRadius: theme.radii.row,
          borderWidth: isActive ? 2 : 1,
          gap: theme.spacing.xs,
          padding: theme.spacing.sm,
        },
      ]}
      testID={`split-item-${index}`}
    >
      {/* Header Row: Badge & Status */}
      <View style={styles.headerRow}>
        <View style={styles.badgeGroup}>
          <View
            style={[
              styles.splitBadge,
              {
                backgroundColor: isActive ? theme.colors.primary : theme.colors.track,
                borderRadius: theme.radii.chip,
                paddingHorizontal: theme.spacing.xs,
              },
            ]}
          >
            <Text
              style={{
                color: isActive ? theme.colors.surface : theme.colors.sub,
                fontFamily: theme.fonts.bold,
                fontSize: theme.typeScale.tiny,
              }}
            >
              Split #{index + 1}
            </Text>
          </View>
          {isActive ? (
            <Text
              style={{
                color: theme.colors.primary,
                fontFamily: theme.fonts.bold,
                fontSize: theme.typeScale.tiny,
              }}
            >
              ● Active
            </Text>
          ) : null}
        </View>

        {onRemove ? (
          <Pressable
            accessibilityLabel={`Remove Split #${index + 1}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canRemove }}
            disabled={!canRemove}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={(e) => {
              e?.stopPropagation?.();
              if (canRemove && onRemove) {
                onRemove();
              }
            }}
            style={[
              styles.removeBtn,
              !canRemove && { opacity: 0.3 },
            ]}
            testID={`split-remove-${index}`}
          >
            <Text
              style={{
                color: canRemove ? theme.colors.expense : theme.colors.sub,
                fontFamily: theme.fonts.bold,
                fontSize: theme.typeScale.body,
              }}
            >
              ✕
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Main Editing Row: Category & Amount */}
      <View style={styles.editRow}>
        {/* Category Selector */}
        <Pressable
          accessibilityLabel={`Split #${index + 1} category ${split.categoryName || "Select category"}`}
          accessibilityRole="button"
          onPress={() => {
            onSelect?.();
            onCategoryPress?.();
          }}
          style={[
            styles.categoryBtn,
            {
              backgroundColor: isActive ? theme.colors.surface : theme.colors.track,
              borderColor: isActive ? theme.colors.primary : theme.colors.outline,
              borderRadius: theme.radii.chip,
              borderWidth: 1,
              paddingHorizontal: theme.spacing.sm,
            },
          ]}
          testID={`split-category-${index}`}
        >
          <Text style={{ fontSize: 16 }}>{emoji}</Text>
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.text,
              fontFamily: theme.fonts.bold,
              fontSize: theme.typeScale.small,
              maxWidth: 120,
            }}
          >
            {split.categoryName || "Category"}
          </Text>
          <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.tiny }}>▾</Text>
        </Pressable>

        {/* Amount Input */}
        <View style={styles.amountContainer}>
          <Text
            style={{
              color: theme.colors.expense,
              fontFamily: theme.fonts.bold,
              fontSize: theme.typeScale.body,
              marginRight: 2,
            }}
          >
            {currencySymbol}
          </Text>
          <TextInput
            accessibilityLabel={`Split #${index + 1} amount`}
            keyboardType="decimal-pad"
            onChangeText={onAmountChange}
            onFocus={() => {
              onSelect?.();
              onAmountFocus?.();
            }}
            selectTextOnFocus
            showSoftInputOnFocus={false}
            style={[
              styles.amountInput,
              {
                borderBottomColor: isActive ? theme.colors.primary : theme.colors.outline,
                borderBottomWidth: isActive ? 2 : 1,
                color: theme.colors.expense,
                fontFamily: theme.fonts.bold,
                fontSize: theme.typeScale.body,
              },
            ]}
            testID={`split-amount-${index}`}
            value={rawDisplay}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  amountContainer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  amountInput: {
    minHeight: 38,
    minWidth: 80,
    paddingHorizontal: 6,
    paddingVertical: 4,
    textAlign: "right",
  },
  badgeGroup: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  categoryBtn: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 38,
    paddingVertical: 6,
  },
  container: {
    width: "100%",
  },
  editRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  removeBtn: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    minWidth: 36,
  },
  splitBadge: {
    paddingVertical: 2,
  },
});
