import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { PrimaryButton } from "../components/Buttons";
import { ScreenContainer } from "../components/ScreenContainer";
import { parseDecimalToMinor } from "../domain/services/money";
import {
  createOnboardingDraft,
  mergeOnboardingDraft,
  ONBOARDING_STEPS,
} from "../services/onboarding";
import { useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

const ACCOUNT_TYPE_OPTIONS = [
  { value: "CASH", label: "💵 Cash" },
  { value: "CARD", label: "💳 Card" },
  { value: "EWALLET", label: "📱 E-wallet" },
];

function ChoiceChip({ label, onPress, selected }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        alignItems: "center",
        backgroundColor: selected ? theme.colors.tint : theme.colors.surface,
        borderColor: selected ? theme.colors.primary : theme.colors.outline,
        borderRadius: theme.radii.chip,
        borderWidth: theme.spacing.hairline,
        minHeight: 44,
        justifyContent: "center",
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <Text style={{ color: selected ? theme.colors.primary : theme.colors.text, fontFamily: selected ? theme.fonts.bold : theme.fonts.medium, fontSize: theme.typeScale.body }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Field({ accessibilityLabel, keyboardType, onChangeText, placeholder, value }) {
  const theme = useTheme();
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      keyboardType={keyboardType}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.sub}
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.outline,
        borderRadius: theme.radii.row,
        borderWidth: theme.spacing.hairline,
        color: theme.colors.text,
        fontFamily: theme.fonts.regular,
        fontSize: theme.typeScale.body,
        minHeight: 48,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
      }}
      value={value}
    />
  );
}

function StepHeading({ emoji, subtitle, title }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
      <Text style={{ fontSize: theme.typeScale.heroAmount }}>{emoji}</Text>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.screenTitle, textAlign: "center" }}>
        {title}
      </Text>
      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body, lineHeight: 21, textAlign: "center" }}>
        {subtitle}
      </Text>
    </View>
  );
}

export function OnboardingScreen({ navigation }) {
  const theme = useTheme(useUiStore((state) => state.themePreference));
  const storedDraft = useUiStore((state) => state.onboardingDraft);
  const saveOnboardingProgress = useUiStore((state) => state.saveOnboardingProgress);
  const completeOnboarding = useUiStore((state) => state.completeOnboarding);
  const hasPin = useUiStore((state) => state.hasPin);
  const accounts = useFinanceStore((state) => state.accounts);
  const categories = useFinanceStore((state) => state.categories);
  const updateAccount = useFinanceStore((state) => state.updateAccount);
  const createAccount = useFinanceStore((state) => state.createAccount);
  const saveOnboardingExpense = useFinanceStore((state) => state.saveOnboardingExpense);
  const [draft, setDraft] = useState(() => storedDraft ?? createOnboardingDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => !account.isArchived),
    [accounts],
  );
  const expenseCategories = useMemo(() => {
    const names = categories
      .filter((category) => category.type === "EXPENSE")
      .map((category) => category.name);
    const visible = names.slice(0, 6);
    if (draft.expense.categoryName && !visible.includes(draft.expense.categoryName)) {
      visible.push(draft.expense.categoryName);
    }
    return visible;
  }, [categories, draft.expense.categoryName]);
  const stepIndex = Math.max(0, ONBOARDING_STEPS.indexOf(draft.step));

  const persistDraft = (next) => {
    setDraft(next);
    setError(null);
    void saveOnboardingProgress(next).catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Could not save setup progress.");
    });
    return next;
  };

  const patchDraft = (patch) => persistDraft(mergeOnboardingDraft(draft, patch));

  const saveStep = async (next) => {
    const saved = await saveOnboardingProgress(next);
    setDraft(saved);
    return saved;
  };

  const finishSetup = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveOnboardingProgress(draft);
      await completeOnboarding();
      navigation?.replace?.("Main");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not finish setup. Your inputs were kept.");
    } finally {
      setBusy(false);
    }
  };

  const handleBack = async () => {
    if (busy) return;
    if (draft.step === "account") {
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
      } else {
        navigation?.navigate?.("Splash");
      }
      return;
    }
    const previousStep = draft.step === "lock" ? "expense" : "account";
    setBusy(true);
    setError(null);
    try {
      await saveStep(mergeOnboardingDraft(draft, { step: previousStep }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save setup progress.");
    } finally {
      setBusy(false);
    }
  };

  const handleAccountContinue = async () => {
    if (busy) return;
    const name = draft.account.name.trim();
    if (!name) {
      setError("Enter an account name.");
      return;
    }

    let startingBalanceMinor;
    try {
      startingBalanceMinor = parseDecimalToMinor(
        draft.account.openingBalanceInput.replace(/[₱$,\s]/g, "") || "0",
        { allowNegative: true },
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enter a valid opening balance.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // Reuse an active account first, then revive an archived one before creating a duplicate type.
      const reusable = accounts.find((account) => account.type === draft.account.type && !account.isArchived)
        ?? accounts.find((account) => account.type === draft.account.type);
      const savedAccount = reusable
        ? await updateAccount({
            id: reusable.id,
            isArchived: false,
            name,
            startingBalanceMinor,
          })
        : await createAccount({
            name,
            reuseExistingType: true,
            type: draft.account.type,
            startingBalanceMinor,
          });
      const next = mergeOnboardingDraft(draft, {
        step: "expense",
        expense: {
          accountId: savedAccount.id,
          accountType: savedAccount.type,
        },
      });
      await saveStep(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the account. Your inputs were kept.");
    } finally {
      setBusy(false);
    }
  };

  const movePastExpense = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveStep(mergeOnboardingDraft(draft, { step: "lock" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save setup progress.");
    } finally {
      setBusy(false);
    }
  };

  const handleExpenseContinue = async () => {
    if (busy) return;
    let amountMinor;
    try {
      amountMinor = parseDecimalToMinor(draft.expense.amountInput.replace(/[₱$,\s]/g, ""));
      if (amountMinor <= 0) {
        throw new RangeError("Expense amount must be greater than zero.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enter a valid expense amount.");
      return;
    }

    const account = activeAccounts.find((candidate) => candidate.id === draft.expense.accountId)
      ?? activeAccounts.find((candidate) => candidate.type === draft.expense.accountType);
    if (!account) {
      setError("Choose an available account for this expense.");
      return;
    }
    if (!categories.some((category) => category.type === "EXPENSE" && category.name === draft.expense.categoryName)) {
      setError("Choose an available expense category.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await saveOnboardingExpense({
        accountId: account.id,
        amountMinor,
        categoryName: draft.expense.categoryName,
        note: draft.expense.note.trim() || null,
        type: "EXPENSE",
      });
      await saveStep(mergeOnboardingDraft(draft, { step: "lock" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the expense. Your inputs were kept.");
    } finally {
      setBusy(false);
    }
  };

  const openAppLock = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveOnboardingProgress(draft);
      navigation?.navigate?.("AppLock");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save setup progress.");
    } finally {
      setBusy(false);
    }
  };

  const fieldLabelStyle = {
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
    fontSize: theme.typeScale.label,
  };
  const panelStyle = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.outline,
    borderRadius: theme.radii.card,
    borderWidth: theme.spacing.hairline,
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
  };

  return (
    <ScreenContainer contentContainerStyle={{ gap: theme.spacing.xl }} safeBottom testID="onboarding-screen">
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" disabled={busy} hitSlop={theme.spacing.md} onPress={() => void handleBack()}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.lockTitle }}>←</Text>
        </Pressable>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
          Step {stepIndex + 1} of 3
        </Text>
        <Pressable accessibilityRole="button" disabled={busy} hitSlop={theme.spacing.md} onPress={() => void finishSetup()}>
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>Skip setup</Text>
        </Pressable>
      </View>

      <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 3, now: stepIndex + 1 }} style={{ backgroundColor: theme.colors.track, borderRadius: theme.radii.progress, height: theme.sizes.progress, overflow: "hidden" }}>
        <View style={{ backgroundColor: theme.colors.primary, borderRadius: theme.radii.progress, height: "100%", width: `${((stepIndex + 1) / 3) * 100}%` }} />
      </View>

      {draft.step === "account" ? (
        <>
          <StepHeading emoji="🏦" subtitle="Name your main account and add its current balance. Existing accounts of this type are updated instead of duplicated." title="Set up an account" />
          <View style={panelStyle}>
            <Text style={fieldLabelStyle}>Account name</Text>
            <Field accessibilityLabel="Account name" onChangeText={(name) => patchDraft({ account: { name } })} placeholder="Cash" value={draft.account.name} />
            <Text style={fieldLabelStyle}>Account type</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
              {ACCOUNT_TYPE_OPTIONS.map((option) => (
                <ChoiceChip key={option.value} label={option.label} onPress={() => patchDraft({ account: { type: option.value }, expense: { accountType: option.value, accountId: null } })} selected={draft.account.type === option.value} />
              ))}
            </View>
            <Text style={fieldLabelStyle}>Opening balance</Text>
            <Field accessibilityLabel="Opening balance" keyboardType="decimal-pad" onChangeText={(openingBalanceInput) => patchDraft({ account: { openingBalanceInput } })} placeholder="0.00" value={draft.account.openingBalanceInput} />
          </View>
          <PrimaryButton disabled={busy} onPress={() => void handleAccountContinue()}>{busy ? "Saving…" : "Save and continue"}</PrimaryButton>
        </>
      ) : null}

      {draft.step === "expense" ? (
        <>
          <StepHeading emoji="🧾" subtitle="Add one real expense to see MoneyMap update. This step is optional." title="Add your first expense" />
          <View style={panelStyle}>
            <Text style={fieldLabelStyle}>Amount</Text>
            <Field accessibilityLabel="Expense amount" keyboardType="decimal-pad" onChangeText={(amountInput) => patchDraft({ expense: { amountInput } })} placeholder="80.00" value={draft.expense.amountInput} />
            <Text style={fieldLabelStyle}>Category</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
              {expenseCategories.map((name) => (
                <ChoiceChip key={name} label={name} onPress={() => patchDraft({ expense: { categoryName: name } })} selected={draft.expense.categoryName === name} />
              ))}
            </View>
            <Text style={fieldLabelStyle}>Account</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
              {activeAccounts.map((account) => (
                <ChoiceChip key={account.id} label={account.name} onPress={() => patchDraft({ expense: { accountId: account.id, accountType: account.type } })} selected={draft.expense.accountId === account.id} />
              ))}
            </View>
            <Text style={fieldLabelStyle}>Note (optional)</Text>
            <Field accessibilityLabel="Expense note" onChangeText={(note) => patchDraft({ expense: { note } })} placeholder="Lunch" value={draft.expense.note} />
          </View>
          <PrimaryButton disabled={busy} onPress={() => void handleExpenseContinue()}>{busy ? "Saving…" : "Add expense and continue"}</PrimaryButton>
          <PrimaryButton disabled={busy} onPress={() => void movePastExpense()}>Skip this expense</PrimaryButton>
        </>
      ) : null}

      {draft.step === "lock" ? (
        <>
          <StepHeading emoji={hasPin ? "✅" : "🔒"} subtitle="A PIN protects app access. Your SQLCipher database key stays separate and device-managed." title={hasPin ? "App lock is ready" : "Protect MoneyMap"} />
          <View style={panelStyle}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body, lineHeight: 21 }}>
              {hasPin ? "Your four-digit PIN is configured. Finish setup to open the dashboard." : "App lock is optional. You can set a four-digit PIN now or enable it later in Settings."}
            </Text>
          </View>
          {hasPin ? (
            <PrimaryButton disabled={busy} onPress={() => void finishSetup()}>{busy ? "Finishing…" : "Finish setup"}</PrimaryButton>
          ) : (
            <>
              <PrimaryButton disabled={busy} onPress={() => void openAppLock()}>Set up app lock</PrimaryButton>
              <PrimaryButton disabled={busy} onPress={() => void finishSetup()}>Finish without app lock</PrimaryButton>
            </>
          )}
        </>
      ) : null}

      {error !== null ? (
        <Text accessibilityRole="alert" style={{ color: theme.colors.expense, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label, lineHeight: 18, textAlign: "center" }}>
          {error}
        </Text>
      ) : null}
    </ScreenContainer>
  );
}
