import { useMemo, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { BottomSheet } from "../components/BottomSheet";
import { PrimaryButton } from "../components/Buttons";
import { EmojiGrid } from "../components/EmojiGrid";
import { EmptyState } from "../components/EmptyState";
import { OptionChipRow } from "../components/OptionChipRow";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { TextPromptModal } from "../components/TextPromptModal";
import {
  BUDGET_BILL_EMOJI_PRESETS,
  RECURRING_REMINDER_LEAD_DAYS,
  defaultDueDateISO,
  formatLocalDateISO,
  parseLocalDateToNoonEpoch,
} from "../domain/services/emoji";
import { buildRecurringBills, categoriesForType, nextReminderPreview } from "../domain/services/financeView";
import { formatMinor, parseDecimalToMinor } from "../domain/services/money";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

export function RecurringScreen({ navigation }) {
  const theme = useTheme();
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const remindersEnabled = useUiStore((state) => state.remindersEnabled);
  const notificationPermissionDenied = useUiStore((state) => state.notificationPermissionDenied);
  const notificationHint = useUiStore((state) => state.notificationHint);
  const categories = useFinanceStore((state) => state.categories);
  const recurringRules = useFinanceStore((state) => state.recurringRules);
  const addRecurringBill = useFinanceStore((state) => state.addRecurringBill);
  const updateRecurringRule = useFinanceStore((state) => state.updateRecurringRule);
  const deleteRecurringById = useFinanceStore((state) => state.deleteRecurringById);

  const [busy, setBusy] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [step, setStep] = useState(null); // rename | editAmount | editDue

  // Form draft state for 09b Add Recurring Bill
  const [draftName, setDraftName] = useState("");
  const [draftEmoji, setDraftEmoji] = useState("🧾");
  const [draftAmountText, setDraftAmountText] = useState("");
  const [draftDueText, setDraftDueText] = useState(defaultDueDateISO(RECURRING_REMINDER_LEAD_DAYS));
  const [draftFrequency, setDraftFrequency] = useState("MONTHLY");
  const [draftCategory, setDraftCategory] = useState(null);
  const [draftLeadDays, setDraftLeadDays] = useState(RECURRING_REMINDER_LEAD_DAYS);

  const [activeBillId, setActiveBillId] = useState(null);

  const { categoriesById } = useMemo(
    () => mapsFromState({ accounts: [], categories }),
    [categories],
  );
  const bills = useMemo(
    () => buildRecurringBills(recurringRules, categoriesById),
    [recurringRules, categoriesById],
  );
  const reminder = useMemo(() => nextReminderPreview(bills), [bills]);

  const expenseCategoryOptions = useMemo(
    () => categoriesForType(categories, "EXPENSE").map((c) => ({ value: c.name, label: c.name })),
    [categories],
  );

  const beginAdd = () => {
    setDraftName("");
    setDraftEmoji("🧾");
    setDraftAmountText("");
    setDraftDueText(defaultDueDateISO(RECURRING_REMINDER_LEAD_DAYS));
    setActiveBillId(null);
    setDraftFrequency("MONTHLY");
    setDraftCategory(expenseCategoryOptions[0]?.value ?? null);
    setDraftLeadDays(RECURRING_REMINDER_LEAD_DAYS);
    setIsAddOpen(true);
  };

  const finishCreate = async () => {
    if (busy) return;
    const trimmedName = draftName.trim();
    if (!trimmedName) {
      Alert.alert("Name required", "Enter a name for this recurring bill.");
      return;
    }

    let amountMinor = 0;
    try {
      amountMinor = parseDecimalToMinor(draftAmountText.replace(/[₱$,\s]/g, "") || "0");
      if (amountMinor <= 0) throw new Error("Enter a positive bill amount.");
    } catch (err) {
      Alert.alert("Invalid amount", err instanceof Error ? err.message : "Enter a valid amount.");
      return;
    }

    const dueIso = draftDueText.trim() || defaultDueDateISO(draftLeadDays);
    const expenseCategories = categoriesForType(categories, "EXPENSE");
    const preferred =
      expenseCategories.find((category) => category.name === "Bills") ?? expenseCategories[0];
    if (preferred === undefined) {
      Alert.alert("No categories", "Add an expense category before creating a recurring bill.");
      return;
    }

    setBusy(true);
    try {
      const dueEpochMillis = parseLocalDateToNoonEpoch(dueIso);
      await addRecurringBill({
        amountMinor,
        categoryName: draftCategory ?? preferred.name,
        name: trimmedName,
        icon: draftEmoji,
        dueEpochMillis,
        frequency: draftFrequency,
        leadDays: draftLeadDays,
      });
      setIsAddOpen(false);
      setDraftName("");
      setDraftAmountText("");
    } catch (error) {
      Alert.alert("Add bill failed", error instanceof Error ? error.message : "Could not add bill.");
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (value) => {
    if (activeBillId === null || busy) return;
    const name = value.trim();
    if (!name) {
      Alert.alert("Name required", "Enter a bill name.");
      return;
    }
    setBusy(true);
    try {
      await updateRecurringRule(activeBillId, { note: name });
      setStep(null);
      setActiveBillId(null);
    } catch (error) {
      Alert.alert("Rename failed", error instanceof Error ? error.message : "Could not rename.");
    } finally {
      setBusy(false);
    }
  };

  const handleEditAmount = async (value) => {
    if (activeBillId === null || busy) return;
    setBusy(true);
    try {
      const amountMinor = parseDecimalToMinor(value.replace(/[₱$,\s]/g, "") || "0");
      if (amountMinor <= 0) throw new Error("Enter a positive amount.");
      await updateRecurringRule(activeBillId, { amountMinor });
      setStep(null);
      setActiveBillId(null);
    } catch (error) {
      Alert.alert("Update failed", error instanceof Error ? error.message : "Could not update.");
    } finally {
      setBusy(false);
    }
  };

  const handleEditDue = async (value) => {
    if (activeBillId === null || busy) return;
    setBusy(true);
    try {
      const dueEpochMillis = parseLocalDateToNoonEpoch(value);
      await updateRecurringRule(activeBillId, {
        nextRunEpochMillis: dueEpochMillis,
        anchorDay: new Date(dueEpochMillis).getDate(),
      });
      setStep(null);
      setActiveBillId(null);
    } catch (error) {
      Alert.alert("Update failed", error instanceof Error ? error.message : "Could not update due date.");
    } finally {
      setBusy(false);
    }
  };

  const openBillActions = (bill) => {
    const id = Number(bill.id);
    Alert.alert(bill.name, "Manage this recurring bill.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Edit",
        onPress: () => {
          Alert.alert(bill.name, "What do you want to change?", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Rename",
              onPress: () => {
                setActiveBillId(id);
                setDraftName(bill.name);
                setStep("rename");
              },
            },
            {
              text: "More…",
              onPress: () => {
                Alert.alert(bill.name, "Edit details", [
                  {
                    text: bill.isActive ? "Pause" : "Resume",
                    onPress: () => {
                      void updateRecurringRule(id, { isActive: !bill.isActive }).catch((error) => {
                        Alert.alert("Update failed", error instanceof Error ? error.message : "Could not update.");
                      });
                    },
                  },
                  {
                    text: "Amount",
                    onPress: () => {
                      setActiveBillId(id);
                      setStep("editAmount");
                    },
                  },
                  {
                    text: "Due date",
                    onPress: () => {
                      setActiveBillId(id);
                      setStep("editDue");
                    },
                  },
                ]);
              },
            },
          ]);
        },
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Alert.alert("Delete bill?", `Remove “${bill.name}”? This cannot be undone.`, [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => {
                void deleteRecurringById(id).catch((error) => {
                  Alert.alert(
                    "Delete failed",
                    error instanceof Error ? error.message : "Could not delete.",
                  );
                });
              },
            },
          ]);
        },
      },
    ]);
  };

  const activeRule = recurringRules.find((r) => r.id === activeBillId);

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
          Bill reminders are off. Enable them in Settings to schedule local notifications.
        </Text>
      ) : notificationPermissionDenied || notificationHint ? (
        <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>
          {notificationHint
            ?? "Notification permission denied. Upcoming bills still show in the app."}
        </Text>
      ) : (
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
          Reminders fire {RECURRING_REMINDER_LEAD_DAYS} days before each bill’s due date.
        </Text>
      )}

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
              {reminder.dueLabel}
            </Text>
          </View>
        </View>
      ) : null}

      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
        Upcoming Bills
      </Text>

      {bills.length === 0 ? (
        <EmptyState
          actionLabel="+ Add recurring bill"
          emoji="🔔"
          message="Name, icon, amount, and due date. You’ll be reminded 14 days before. Long-press a card to edit or delete."
          onAction={beginAdd}
          title="No recurring bills yet"
        />
      ) : (
        bills.map((bill) => (
          <Pressable
            key={bill.id}
            accessibilityHint="Long press to rename, edit amount or due date, or delete"
            accessibilityLabel={bill.name}
            accessibilityRole="button"
            delayLongPress={350}
            onLongPress={() => openBillActions(bill)}
          >
            <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.md, minHeight: theme.sizes.billCard }}>
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
                  <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.emptyTitle }}>
                    {bill.emoji}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.listName }}>
                    {bill.name}
                  </Text>
                  <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
                    {bill.frequencyLabel} · Due {bill.due}
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
                <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
                  {bill.reminderEnabled ? "🔔" : "🔕"}
                </Text>
                <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
                  {bill.reminderEnabled
                    ? (bill.leadDays === 0 ? "Remind on the due date" : `Remind ${bill.leadDays} day${bill.leadDays === 1 ? "" : "s"} before`)
                    : "Reminders off"}
                </Text>
              </View>
            </SectionCard>
          </Pressable>
        ))
      )}

      {bills.length > 0 ? (
        <>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.tiny }}>
            Tip: press and hold a bill card to edit or delete.
          </Text>
          <PrimaryButton disabled={busy} onPress={beginAdd}>
            {busy ? "Saving…" : "+ Add recurring bill"}
          </PrimaryButton>
        </>
      ) : null}

      {/* Figma 09b Add Recurring Bill Bottom Sheet */}
      <BottomSheet
        onClose={() => setIsAddOpen(false)}
        title="Add recurring bill"
        visible={isAddOpen}
      >
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ gap: theme.spacing.xs }}>
            <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
              Bill name
            </Text>
            <TextInput
              accessibilityLabel="Bill name"
              onChangeText={setDraftName}
              placeholder="Internet plan"
              placeholderTextColor={theme.colors.sub}
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outline,
                borderRadius: theme.radii.card,
                borderWidth: 1,
                color: theme.colors.text,
                fontFamily: theme.fonts.regular,
                fontSize: theme.typeScale.body,
                minHeight: 48,
                paddingHorizontal: theme.spacing.lg,
              }}
              value={draftName}
            />
          </View>

          <View style={{ gap: theme.spacing.xs }}>
            <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
              Amount ({currencySymbol})
            </Text>
            <TextInput
              accessibilityLabel="Bill amount"
              keyboardType="decimal-pad"
              onChangeText={setDraftAmountText}
              placeholder="999.00"
              placeholderTextColor={theme.colors.sub}
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outline,
                borderRadius: theme.radii.card,
                borderWidth: 1,
                color: theme.colors.text,
                fontFamily: theme.fonts.regular,
                fontSize: theme.typeScale.body,
                minHeight: 48,
                paddingHorizontal: theme.spacing.lg,
              }}
              value={draftAmountText}
            />
          </View>

          <View style={{ gap: theme.spacing.xs }}>
            <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
              Due date (YYYY-MM-DD)
            </Text>
            <TextInput
              accessibilityLabel="Due date"
              maxLength={10}
              onChangeText={setDraftDueText}
              placeholder={defaultDueDateISO(draftLeadDays)}
              placeholderTextColor={theme.colors.sub}
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outline,
                borderRadius: theme.radii.card,
                borderWidth: 1,
                color: theme.colors.text,
                fontFamily: theme.fonts.regular,
                fontSize: theme.typeScale.body,
                minHeight: 48,
                paddingHorizontal: theme.spacing.lg,
              }}
              value={draftDueText}
            />
          </View>

          <OptionChipRow
            accessibilityLabel="Repeat frequency"
            label="Repeats"
            onChange={setDraftFrequency}
            options={[
              { value: "DAILY", label: "Daily" },
              { value: "WEEKLY", label: "Weekly" },
              { value: "MONTHLY", label: "Monthly" },
            ]}
            value={draftFrequency}
          />

          {expenseCategoryOptions.length > 0 ? (
            <OptionChipRow
              accessibilityLabel="Bill category"
              label="Category"
              onChange={setDraftCategory}
              options={expenseCategoryOptions}
              value={draftCategory ?? expenseCategoryOptions[0].value}
            />
          ) : null}

          <OptionChipRow
            accessibilityLabel="Reminder lead time"
            label="Remind me"
            onChange={(value) => setDraftLeadDays(Number(value))}
            options={[
              { value: "0", label: "On the day" },
              { value: "1", label: "1 day" },
              { value: "3", label: "3 days" },
              { value: "7", label: "7 days" },
              { value: "14", label: "14 days" },
            ]}
            value={String(draftLeadDays)}
          />

          <View style={{ gap: theme.spacing.xs }}>
            <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
              Choose icon
            </Text>
            <EmojiGrid onChange={setDraftEmoji} value={draftEmoji} />
          </View>

          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
            <PrimaryButton disabled={busy} onPress={() => void finishCreate()}>
              {busy ? "Saving…" : "Save bill"}
            </PrimaryButton>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsAddOpen(false)}
              style={{ alignItems: "center", justifyContent: "center", minHeight: 44 }}
            >
              <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>

      {/* Edit modals for existing bills */}
      <TextPromptModal
        confirmLabel="Rename"
        initialValue={draftName}
        onCancel={() => {
          setStep(null);
          setActiveBillId(null);
        }}
        onConfirm={(value) => void handleRename(value)}
        placeholder="Bill name"
        title="Rename bill"
        visible={step === "rename"}
      />
      <TextPromptModal
        confirmLabel="Save"
        initialValue={activeRule ? (activeRule.amountMinor / 100).toFixed(2) : "1000.00"}
        keyboardType="decimal-pad"
        onCancel={() => {
          setStep(null);
          setActiveBillId(null);
        }}
        onConfirm={(value) => void handleEditAmount(value)}
        placeholder="1000.00"
        title="Edit amount"
        visible={step === "editAmount"}
      />
      <TextPromptModal
        confirmLabel="Save"
        initialValue={
          activeRule
            ? formatLocalDateISO(activeRule.nextRunEpochMillis)
            : defaultDueDateISO(RECURRING_REMINDER_LEAD_DAYS)
        }
        message={`Due date (YYYY-MM-DD). Reminder stays ${activeRule?.reminderLeadDays ?? RECURRING_REMINDER_LEAD_DAYS} day${(activeRule?.reminderLeadDays ?? RECURRING_REMINDER_LEAD_DAYS) === 1 ? "" : "s"} before.`}
        onCancel={() => {
          setStep(null);
          setActiveBillId(null);
        }}
        onConfirm={(value) => void handleEditDue(value)}
        placeholder="2026-09-01"
        title="Edit due date"
        visible={step === "editDue"}
      />
    </ScreenContainer>
  );
}
