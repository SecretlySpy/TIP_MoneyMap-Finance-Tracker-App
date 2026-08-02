import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { AppText as Text } from "../components/AppText";
import { DashedButton } from "../components/Buttons";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { TextPromptModal } from "../components/TextPromptModal";
import {
  buildRecurringBills,
  categoriesForType,
  nextReminderPreview,
} from "../domain/services/financeView";
import { formatMinor, parseDecimalToMinor } from "../domain/services/money";
import type { BudgetsStackParamList } from "../navigation/routes";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

type RecurringProps = NativeStackScreenProps<BudgetsStackParamList, "Recurring">;

const DEFAULT_LEAD_DAYS = 7;

type PromptStep = "name" | "amount" | null;

// Recurring list with offline add flow; OS push notifications remain optional later.
export function RecurringScreen({ navigation }: RecurringProps) {
  const theme = useTheme(useUiStore((state) => state.themePreference));
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const remindersEnabled = useUiStore((state) => state.remindersEnabled);
  const categories = useFinanceStore((state) => state.categories);
  const recurringRules = useFinanceStore((state) => state.recurringRules);
  const addRecurringBill = useFinanceStore((state) => state.addRecurringBill);
  const [adding, setAdding] = useState(false);
  const [step, setStep] = useState<PromptStep>(null);
  const [draftName, setDraftName] = useState("");

  const { categoriesById } = useMemo(() => mapsFromState({ accounts: [], categories }), [categories]);

  const bills = useMemo(
    () => buildRecurringBills(recurringRules, categoriesById),
    [recurringRules, categoriesById],
  );

  const reminder = useMemo(() => nextReminderPreview(bills), [bills]);

  const handleAmountConfirm = async (value: string) => {
    if (adding) {
      return;
    }
    const expenseCategories = categoriesForType(categories, "EXPENSE");
    const preferred =
      expenseCategories.find((category) => category.name === "Bills") ?? expenseCategories[0];
    if (preferred === undefined) {
      Alert.alert("No categories", "Add an expense category before creating a recurring bill.");
      return;
    }
    setAdding(true);
    try {
      const amountMinor = parseDecimalToMinor(value.replace(/[₱$,]/g, "") || "0");
      if (amountMinor <= 0) {
        throw new Error("Enter a positive bill amount.");
      }
      const name = draftName.trim() || preferred.name;
      await addRecurringBill({
        amountMinor,
        categoryName: preferred.name,
        leadDays: DEFAULT_LEAD_DAYS,
        name,
      });
      setStep(null);
      setDraftName("");
    } catch (error: unknown) {
      Alert.alert("Add bill failed", error instanceof Error ? error.message : "Could not add recurring bill.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <ScreenContainer contentContainerStyle={{ gap: theme.spacing.xl }} testID="recurring-screen">
      <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.lg }}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={theme.spacing.md}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.lockTitle }}>
            ←
          </Text>
        </Pressable>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.subScreenTitle }}>
          Recurring & Reminders
        </Text>
      </View>

      {!remindersEnabled ? (
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>
          In-app reminders are off. Enable them in Settings to surface upcoming bills on the Dashboard.
        </Text>
      ) : null}

      {reminder !== null && remindersEnabled ? (
        <View
          accessible
          accessibilityRole="summary"
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.amberBg,
            borderRadius: theme.radii.row,
            flexDirection: "row",
            gap: theme.spacing.md,
            minHeight: theme.sizes.reminderPreview,
            paddingHorizontal: theme.spacing.xl,
            paddingVertical: theme.spacing.lg,
          }}
        >
          <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.subScreenTitle }}>🔔</Text>
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
              {reminder.title}
            </Text>
            <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
              Set aside {formatMinor(reminder.detailAmountMinor, { currencySymbol, showCents: false })} by{" "}
              {reminder.dueLabel} — save {formatMinor(reminder.dailyMinor, { currencySymbol, showCents: false })}/day to
              be ready.
            </Text>
          </View>
        </View>
      ) : null}

      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
        Upcoming Bills
      </Text>

      {bills.length === 0 ? (
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body }}>
          No recurring bills yet. Add one to track upcoming payments offline.
        </Text>
      ) : (
        bills.map((bill) => (
          <SectionCard key={bill.id} padding={theme.spacing.lg} style={{ gap: theme.spacing.md, minHeight: theme.sizes.billCard }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.md }}>
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: theme.colors.avatarBg,
                  borderRadius: theme.radii.round,
                  height: theme.sizes.avatar,
                  justifyContent: "center",
                  width: theme.sizes.avatar,
                }}
              >
                <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.emptyTitle }}>{bill.emoji}</Text>
              </View>
              <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.listName }}>
                  {bill.name}
                </Text>
                <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
                  Monthly · Due {bill.due}
                </Text>
              </View>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.listName }}>
                {formatMinor(bill.amountMinor, { currencySymbol, showCents: false })}
              </Text>
            </View>
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: theme.colors.tint,
                borderRadius: theme.radii.chip,
                flexDirection: "row",
                gap: theme.spacing.compact,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
              }}
            >
              <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>🔔</Text>
              <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
                Remind {bill.leadDays} days before
              </Text>
            </View>
          </SectionCard>
        ))
      )}

      <DashedButton disabled={adding} onPress={() => setStep("name")}>
        {adding ? "Adding…" : "＋ Add recurring bill"}
      </DashedButton>

      <TextPromptModal
        confirmLabel="Next"
        message="Name shown on the bills list."
        onCancel={() => {
          setStep(null);
          setDraftName("");
        }}
        onConfirm={(value) => {
          setDraftName(value.trim() || "Monthly bill");
          setStep("amount");
        }}
        placeholder="Internet"
        title="Bill name"
        visible={step === "name"}
      />
      <TextPromptModal
        confirmLabel="Save bill"
        initialValue="1000.00"
        keyboardType="decimal-pad"
        message={`Amount for ${draftName || "this bill"}`}
        onCancel={() => setStep(null)}
        onConfirm={(value) => void handleAmountConfirm(value)}
        placeholder="1000.00"
        title="Bill amount"
        visible={step === "amount"}
      />
    </ScreenContainer>
  );
}
