import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { BottomSheet } from "../components/BottomSheet";
import { PrimaryButton } from "../components/Buttons";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { categoryEmoji, resolveDisplayEmoji } from "../domain/services/emoji";
import { formatTransactionAmount } from "../domain/services/money";
import { useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

export function TransactionDetailScreen({ navigation, route }) {
  const theme = useTheme(useUiStore((state) => state.themePreference));
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const transactions = useFinanceStore((state) => state.transactions);
  const categories = useFinanceStore((state) => state.categories);
  const accounts = useFinanceStore((state) => state.accounts);
  const recurringRules = useFinanceStore((state) => state.recurringRules);
  const deleteTransactionById = useFinanceStore((state) => state.deleteTransactionById);

  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const transactionId = Number(route?.params?.transactionId);
  const transaction = transactions.find((item) => item.id === transactionId);

  if (!transaction) {
    return (
      <ScreenContainer contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} testID="missing-transaction-screen">
        <View
          style={{
            alignItems: "center",
            gap: theme.spacing.lg,
            justifyContent: "center",
            paddingHorizontal: theme.spacing.screen,
            paddingVertical: theme.spacing.xxl,
          }}
        >
          <View
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.avatarBg,
              borderRadius: theme.radii.round,
              height: 64,
              justifyContent: "center",
              width: 64,
            }}
          >
            <Text style={{ fontSize: 32 }}>⚠️</Text>
          </View>
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.fonts.bold,
              fontSize: theme.typeScale.screenTitle,
              textAlign: "center",
            }}
          >
            Transaction unavailable
          </Text>
          <Text
            style={{
              color: theme.colors.sub,
              fontFamily: theme.fonts.regular,
              fontSize: theme.typeScale.body,
              maxWidth: 320,
              textAlign: "center",
            }}
          >
            This transaction could not be found. It may have been deleted or moved.
          </Text>
          <PrimaryButton
            accessibilityLabel="Back to History"
            onPress={() => navigation.goBack()}
            style={{ marginTop: theme.spacing.md }}
          >
            Back to History
          </PrimaryButton>
        </View>
      </ScreenContainer>
    );
  }

  const category = categories.find((item) => item.id === transaction.categoryId);
  const account = accounts.find((item) => item.id === transaction.accountId);
  const recurringRule = transaction.recurringRuleId !== null
    ? recurringRules.find((item) => item.id === transaction.recurringRuleId)
    : null;
  const isRecurring = transaction.recurringRuleId !== null;

  const categoryName = category?.name ?? "Other";
  const displayEmoji = category
    ? resolveDisplayEmoji({ icon: category.icon, name: category.name })
    : categoryEmoji("Other");
  const formattedAmount = formatTransactionAmount(
    transaction.amountMinor,
    transaction.type,
    true,
    currencySymbol,
  );

  const dateObj = new Date(transaction.dateEpochMillis);
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteTransactionById(transaction.id);
      setDeleteSheetVisible(false);
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        "Delete failed",
        error instanceof Error ? error.message : "Could not delete transaction.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ScreenContainer contentContainerStyle={{ flexGrow: 1, gap: theme.spacing.xl }} testID="transaction-detail-screen">
      {/* Top Header */}
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Pressable
          accessibilityLabel="Back to History"
          accessibilityRole="button"
          hitSlop={theme.spacing.md}
          onPress={() => navigation.goBack()}
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outline,
            borderRadius: theme.radii.round,
            borderWidth: 1,
            height: 40,
            justifyContent: "center",
            width: 40,
          }}
        >
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: 18 }}>
            ‹
          </Text>
        </Pressable>
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.fonts.bold,
            fontSize: theme.typeScale.screenTitle,
          }}
        >
          Transaction Detail
        </Text>
        <Pressable
          accessibilityLabel="Edit transaction"
          accessibilityRole="button"
          hitSlop={theme.spacing.md}
          onPress={() => navigation.navigate("EditTransaction", { transactionId: transaction.id })}
        >
          <Text
            style={{
              color: theme.colors.primary,
              fontFamily: theme.fonts.bold,
              fontSize: theme.typeScale.body,
            }}
          >
            Edit
          </Text>
        </Pressable>
      </View>

      {/* Hero Card */}
      <SectionCard style={{ alignItems: "center", gap: theme.spacing.md, paddingVertical: theme.spacing.xl }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.avatarBg,
            borderRadius: theme.radii.round,
            height: 64,
            justifyContent: "center",
            width: 64,
          }}
        >
          <Text style={{ fontSize: 32 }}>{displayEmoji}</Text>
        </View>

        <Text
          numberOfLines={2}
          style={{
            color: theme.colors.text,
            fontFamily: theme.fonts.bold,
            fontSize: theme.typeScale.subScreenTitle,
            textAlign: "center",
          }}
        >
          {transaction.note?.trim() || categoryName}
        </Text>

        <Text
          style={{
            color: transaction.type === "EXPENSE" ? theme.colors.expense : theme.colors.income,
            fontFamily: theme.fonts.bold,
            fontSize: 32,
          }}
        >
          {formattedAmount}
        </Text>

        {/* Badge: Manual vs Recurring */}
        {isRecurring ? (
          <View
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.tint,
              borderRadius: theme.radii.chip,
              flexDirection: "row",
              gap: theme.spacing.xs,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.compact,
            }}
          >
            <Text style={{ fontSize: 14 }}>🔁</Text>
            <Text
              style={{
                color: theme.colors.primary,
                fontFamily: theme.fonts.bold,
                fontSize: theme.typeScale.small,
              }}
            >
              Recurring transaction
            </Text>
          </View>
        ) : (
          <View
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.avatarBg,
              borderRadius: theme.radii.chip,
              flexDirection: "row",
              gap: theme.spacing.xs,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.compact,
            }}
          >
            <Text style={{ fontSize: 14 }}>✍️</Text>
            <Text
              style={{
                color: theme.colors.sub,
                fontFamily: theme.fonts.medium,
                fontSize: theme.typeScale.small,
              }}
            >
              Manually recorded
            </Text>
          </View>
        )}
      </SectionCard>

      {/* Recurring Guidance Banner */}
      {isRecurring ? (
        <View
          style={{
            backgroundColor: theme.colors.amberBg,
            borderColor: theme.colors.warning,
            borderRadius: theme.radii.card,
            borderWidth: 1,
            gap: theme.spacing.xs,
            padding: theme.spacing.md,
          }}
        >
          <Text
            style={{
              color: theme.colors.amberText,
              fontFamily: theme.fonts.bold,
              fontSize: theme.typeScale.body,
            }}
          >
            Generated from recurring bill
          </Text>
          <Text
            style={{
              color: theme.colors.amberText,
              fontFamily: theme.fonts.regular,
              fontSize: theme.typeScale.small,
            }}
          >
            This occurrence was automatically created from your “{recurringRule?.note || "recurring bill"}”. Deleting or editing this entry will not affect your recurring rule schedule.
          </Text>
        </View>
      ) : null}

      {/* Details List */}
      <SectionCard style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
            Date
          </Text>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
            {formattedDate}
          </Text>
        </View>

        <View style={{ backgroundColor: theme.colors.outline, height: 1 }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
            Category
          </Text>
          <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.xs }}>
            <Text style={{ fontSize: 16 }}>{displayEmoji}</Text>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
              {categoryName}
            </Text>
          </View>
        </View>

        <View style={{ backgroundColor: theme.colors.outline, height: 1 }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
            Account
          </Text>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
            {account?.name ?? "Account"}
          </Text>
        </View>

        <View style={{ backgroundColor: theme.colors.outline, height: 1 }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
            Type
          </Text>
          <Text
            style={{
              color: transaction.type === "EXPENSE" ? theme.colors.expense : theme.colors.income,
              fontFamily: theme.fonts.bold,
              fontSize: theme.typeScale.body,
            }}
          >
            {transaction.type === "EXPENSE" ? "Expense" : "Income"}
          </Text>
        </View>

        <View style={{ backgroundColor: theme.colors.outline, height: 1 }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
            Note
          </Text>
          <Text
            numberOfLines={2}
            style={{
              color: theme.colors.text,
              flex: 1,
              fontFamily: theme.fonts.regular,
              fontSize: theme.typeScale.body,
              textAlign: "right",
            }}
          >
            {transaction.note?.trim() || "None"}
          </Text>
        </View>

        {isRecurring && recurringRule ? (
          <>
            <View style={{ backgroundColor: theme.colors.outline, height: 1 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
                Recurring rule
              </Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                {recurringRule.note}
              </Text>
            </View>
          </>
        ) : null}
      </SectionCard>

      {/* Delete Transaction Button */}
      <Pressable
        accessibilityLabel="Delete transaction"
        accessibilityRole="button"
        onPress={() => setDeleteSheetVisible(true)}
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.expense,
          borderRadius: theme.radii.button,
          borderWidth: 1.5,
          height: theme.sizes.primaryButton,
          justifyContent: "center",
          marginTop: theme.spacing.md,
          width: "100%",
        }}
      >
        <Text
          style={{
            color: theme.colors.expense,
            fontFamily: theme.fonts.bold,
            fontSize: theme.typeScale.cardHeader,
          }}
        >
          Delete transaction
        </Text>
      </Pressable>

      {/* Frame 18d Delete Confirmation Bottom Sheet */}
      <BottomSheet
        onClose={() => setDeleteSheetVisible(false)}
        testID="delete-confirmation-sheet"
        title="Delete transaction?"
        visible={deleteSheetVisible}
      >
        <View style={{ gap: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
          <Text
            style={{
              color: theme.colors.sub,
              fontFamily: theme.fonts.regular,
              fontSize: theme.typeScale.body,
              lineHeight: 22,
            }}
          >
            {isRecurring
              ? "This will only delete this specific transaction occurrence. Your recurring bill schedule and future entries will not be affected."
              : "This will permanently remove this transaction from your history."}
          </Text>

          <View style={{ gap: theme.spacing.sm }}>
            <Pressable
              accessibilityLabel="Confirm delete"
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={handleDelete}
              style={{
                alignItems: "center",
                backgroundColor: theme.colors.expense,
                borderRadius: theme.radii.button,
                height: theme.sizes.primaryButton,
                justifyContent: "center",
                opacity: isDeleting ? 0.6 : 1,
                width: "100%",
              }}
            >
              <Text
                style={{
                  color: theme.colors.onPrimary,
                  fontFamily: theme.fonts.bold,
                  fontSize: theme.typeScale.cardHeader,
                }}
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Keep transaction"
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={() => setDeleteSheetVisible(false)}
              style={{
                alignItems: "center",
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outline,
                borderRadius: theme.radii.button,
                borderWidth: 1,
                height: theme.sizes.primaryButton,
                justifyContent: "center",
                width: "100%",
              }}
            >
              <Text
                style={{
                  color: theme.colors.text,
                  fontFamily: theme.fonts.medium,
                  fontSize: theme.typeScale.body,
                }}
              >
                Keep transaction
              </Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}
