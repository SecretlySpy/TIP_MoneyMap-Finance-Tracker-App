import { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { DashedButton } from "../components/Buttons";
import { EmojiPickerRow } from "../components/EmojiPickerRow";
import { EmptyState } from "../components/EmptyState";
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
  const [step, setStep] = useState(null);
  // name | emoji | amount | due | rename | editAmount | editDue
  const [draftName, setDraftName] = useState("");
  const [draftEmoji, setDraftEmoji] = useState(BUDGET_BILL_EMOJI_PRESETS[7]);
  const [draftAmount, setDraftAmount] = useState(0);
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

  const beginAdd = () => {
    setDraftName("");
    setDraftEmoji(BUDGET_BILL_EMOJI_PRESETS[7]);
    setDraftAmount(0);
    setActiveBillId(null);
    setStep("name");
  };

  const finishCreate = async (dueIso) => {
    if (busy) return;
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
      const name = draftName.trim() || preferred.name;
      await addRecurringBill({
        amountMinor: draftAmount,
        categoryName: preferred.name,
        name,
        icon: draftEmoji,
        dueEpochMillis,
        leadDays: RECURRING_REMINDER_LEAD_DAYS,
      });
      setStep(null);
      setDraftName("");
      setDraftAmount(0);
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
        reminderLeadDays: RECURRING_REMINDER_LEAD_DAYS,
        reminderEnabled: true,
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
    // Android Alert shows at most 3 buttons — keep Cancel | Edit | Delete.
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
                  { text: "Cancel", style: "cancel" },
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
          actionLabel="＋ Add recurring bill"
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
          </Pressable>
        ))
      )}

      {bills.length > 0 ? (
        <>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.tiny }}>
            Tip: press and hold a bill card for Edit or Delete.
          </Text>
          <DashedButton disabled={busy} onPress={beginAdd}>
            {busy ? "Saving…" : "＋ Add recurring bill"}
          </DashedButton>
        </>
      ) : null}

      <TextPromptModal
        confirmLabel="Next"
        message="Name shown on the bills list."
        onCancel={() => {
          setStep(null);
          setDraftName("");
        }}
        onConfirm={(value) => {
          setDraftName(value.trim() || "Monthly bill");
          setStep("emoji");
        }}
        placeholder="Internet"
        title="Bill name"
        visible={step === "name"}
      />

      {step === "emoji" ? (
        <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.lg }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
            Icon for “{draftName}”
          </Text>
          <EmojiPickerRow onChange={setDraftEmoji} value={draftEmoji} />
          <DashedButton onPress={() => setStep("amount")}>Next: amount</DashedButton>
          <Pressable onPress={() => setStep(null)} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, textAlign: "center" }}>
              Cancel
            </Text>
          </Pressable>
        </SectionCard>
      ) : null}

      <TextPromptModal
        confirmLabel="Next"
        initialValue="1000.00"
        keyboardType="decimal-pad"
        message={`Amount for ${draftName || "this bill"}`}
        onCancel={() => setStep(null)}
        onConfirm={(value) => {
          try {
            const amountMinor = parseDecimalToMinor(value.replace(/[₱$,\s]/g, "") || "0");
            if (amountMinor <= 0) throw new Error("Enter a positive bill amount.");
            setDraftAmount(amountMinor);
            setStep("due");
          } catch (error) {
            Alert.alert("Invalid amount", error instanceof Error ? error.message : "Try again.");
          }
        }}
        placeholder="1000.00"
        title="Bill amount"
        visible={step === "amount"}
      />
      <TextPromptModal
        confirmLabel="Save bill"
        initialValue={defaultDueDateISO(RECURRING_REMINDER_LEAD_DAYS)}
        message={`Due date (YYYY-MM-DD). Reminder fires ${RECURRING_REMINDER_LEAD_DAYS} days before.`}
        onCancel={() => setStep(null)}
        onConfirm={(value) => void finishCreate(value)}
        placeholder="2026-09-01"
        title="Due date"
        visible={step === "due"}
      />
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
        message={`Due date (YYYY-MM-DD). Reminder stays ${RECURRING_REMINDER_LEAD_DAYS} days before.`}
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
