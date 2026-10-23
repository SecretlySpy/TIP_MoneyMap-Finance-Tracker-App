import { useState } from "react";
import { LayoutAnimation, Platform, Pressable, UIManager, View } from "react-native";
import { formatMinor, formatTransactionAmount } from "../domain/services/money";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Shared transaction rows preserve the Figma avatar, content, and right-aligned amount layout.
// Supports expandable breakdown for grouped split purchases.
export function TransactionRow({
  amountMinor,
  compact = false,
  emoji,
  meta,
  title,
  type,
  onPress,
  onLongPress,
  isGroup = false,
  splitGroupId,
  allocations = [],
  onEditBreakdown,
  onViewDetails,
  initiallyExpanded = false,
}) {
  const theme = useTheme(useUiStore((state) => state.themePreference));
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);

  const amount = formatTransactionAmount(amountMinor, type, true, currencySymbol);
  const avatarSize = compact ? theme.sizes.compactAvatar : theme.sizes.avatar;
  const accessibilityLabel = `${title}, ${meta}, ${amount}${isGroup ? (isExpanded ? ", expanded breakdown" : ", collapsed breakdown") : ""}`;

  const toggleExpand = () => {
    if (LayoutAnimation?.configureNext && LayoutAnimation?.Presets?.easeInEaseOut) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setIsExpanded((prev) => !prev);
  };

  const handleRowPress = () => {
    if (isGroup) {
      toggleExpand();
    } else if (onPress) {
      onPress();
    }
  };

  const rowContent = (
    <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.md, width: "100%" }}>
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
          {emoji || (isGroup ? "🛒" : "🧾")}
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
      <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.xs }}>
        <Text
          style={{
            color: type === "EXPENSE" ? theme.colors.expense : type === "INCOME" ? theme.colors.income : theme.colors.text,
            fontFamily: theme.fonts.bold,
            fontSize: theme.typeScale.body,
          }}
        >
          {amount}
        </Text>
        {isGroup ? (
          <Pressable
            accessibilityHint={isExpanded ? "Collapse category breakdown" : "Expand category breakdown"}
            accessibilityLabel={isExpanded ? "Collapse split breakdown" : "Expand split breakdown"}
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={(e) => {
              e?.stopPropagation?.();
              toggleExpand();
            }}
            style={{
              alignItems: "center",
              justifyContent: "center",
              minHeight: 36,
              minWidth: 32,
            }}
            testID="split-expand-indicator"
          >
            <Text
              style={{
                color: theme.colors.sub,
                fontFamily: theme.fonts.bold,
                fontSize: 16,
              }}
            >
              {isExpanded ? "▴" : "▾"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={{ width: "100%" }}>
      {onPress || isGroup || onLongPress ? (
        <Pressable
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          onLongPress={onLongPress}
          onPress={handleRowPress}
          style={{ width: "100%" }}
        >
          {rowContent}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={accessibilityLabel} style={{ width: "100%" }}>
          {rowContent}
        </View>
      )}

      {/* Expanded Breakdown for Split Purchases */}
      {isGroup && isExpanded && (
        <View
          style={{
            backgroundColor: theme.colors.avatarBg,
            borderColor: theme.colors.outline,
            borderRadius: theme.radii.row,
            borderWidth: 1,
            gap: theme.spacing.sm,
            marginTop: theme.spacing.sm,
            padding: theme.spacing.md,
            width: "100%",
          }}
          testID="split-breakdown-card"
        >
          {/* Header Summary */}
          <View
            style={{
              alignItems: "center",
              borderBottomColor: theme.colors.outline,
              borderBottomWidth: 1,
              flexDirection: "row",
              justifyContent: "space-between",
              paddingBottom: theme.spacing.xs,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: theme.colors.sub,
                flex: 1,
                fontFamily: theme.fonts.medium,
                fontSize: theme.typeScale.small,
              }}
            >
              {title}
            </Text>
            <Text
              style={{
                color: theme.colors.text,
                fontFamily: theme.fonts.bold,
                fontSize: theme.typeScale.small,
              }}
            >
              Total: {formatMinor(amountMinor, { currencySymbol })}
            </Text>
          </View>

          {/* Allocation Rows */}
          {allocations.map((alloc, idx) => (
            <View
              key={alloc.id ? String(alloc.id) : `alloc-${idx}`}
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: theme.spacing.xxs,
              }}
              testID={`split-allocation-row-${idx}`}
            >
              <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.sm, flex: 1, minWidth: 0 }}>
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radii.round,
                    height: 28,
                    justifyContent: "center",
                    width: 28,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>{alloc.emoji || alloc.categoryEmoji || "🏷️"}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: theme.colors.text,
                      fontFamily: theme.fonts.medium,
                      fontSize: theme.typeScale.body,
                    }}
                  >
                    {alloc.categoryName}
                  </Text>
                  {alloc.note && alloc.note !== alloc.categoryName ? (
                    <Text
                      numberOfLines={1}
                      style={{
                        color: theme.colors.sub,
                        fontFamily: theme.fonts.regular,
                        fontSize: theme.typeScale.tiny,
                      }}
                    >
                      {alloc.note}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text
                style={{
                  color: type === "EXPENSE" ? theme.colors.expense : theme.colors.income,
                  fontFamily: theme.fonts.bold,
                  fontSize: theme.typeScale.body,
                }}
              >
                {Number.isSafeInteger(alloc.amountMinor)
                  ? formatMinor(alloc.amountMinor, { currencySymbol })
                  : (alloc.formattedAmount || "")}
              </Text>
            </View>
          ))}

          {/* Actions: Edit breakdown & View details */}
          <View
            style={{
              borderTopColor: theme.colors.outline,
              borderTopWidth: 1,
              flexDirection: "row",
              gap: theme.spacing.sm,
              marginTop: theme.spacing.xs,
              paddingTop: theme.spacing.xs,
            }}
          >
            {onEditBreakdown ? (
              <Pressable
                accessibilityLabel="Edit breakdown"
                accessibilityRole="button"
                hitSlop={theme.spacing.xs}
                onPress={onEditBreakdown}
                style={{
                  alignItems: "center",
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.outline,
                  borderRadius: theme.radii.button,
                  borderWidth: 1,
                  flex: 1,
                  justifyContent: "center",
                  minHeight: 38,
                  paddingHorizontal: theme.spacing.sm,
                }}
                testID="edit-breakdown-btn"
              >
                <Text
                  style={{
                    color: theme.colors.primary,
                    fontFamily: theme.fonts.bold,
                    fontSize: theme.typeScale.small,
                  }}
                >
                  Edit breakdown
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityLabel="View transaction details"
              accessibilityRole="button"
              hitSlop={theme.spacing.xs}
              onPress={onViewDetails || onPress}
              style={{
                alignItems: "center",
                backgroundColor: theme.colors.tint,
                borderColor: theme.colors.primary,
                borderRadius: theme.radii.button,
                borderWidth: 1,
                flex: 1,
                justifyContent: "center",
                minHeight: 38,
                paddingHorizontal: theme.spacing.sm,
              }}
              testID="view-details-btn"
            >
              <Text
                style={{
                  color: theme.colors.primary,
                  fontFamily: theme.fonts.bold,
                  fontSize: theme.typeScale.small,
                }}
              >
                View details
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
