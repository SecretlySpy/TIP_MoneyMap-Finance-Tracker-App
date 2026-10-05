import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { PrimaryButton } from "../components/Buttons";
import { DonutMark } from "../components/DonutMark";
import { ScreenContainer } from "../components/ScreenContainer";
import { isValidPin } from "../services/appLock";
import { useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

function recoveryMessage(result) {
  if (result === "cancelled") {
    return "Device verification was cancelled. Your financial data is still locked.";
  }
  if (result === "unavailable") {
    return "Secure device verification is unavailable. Your financial data is still locked.";
  }
  return "We could not verify your device security. Your financial data is still locked.";
}

export function PinRecoveryScreen({ navigation }) {
  const theme = useTheme(useUiStore((state) => state.themePreference));
  const beginPinRecovery = useUiStore((state) => state.beginPinRecovery);
  const cancelPinRecovery = useUiStore((state) => state.cancelPinRecovery);
  const completePinRecovery = useUiStore((state) => state.completePinRecovery);
  const beginLocalReset = useUiStore((state) => state.beginLocalReset);
  const cancelLocalReset = useUiStore((state) => state.cancelLocalReset);
  const resetUiAfterLocalReset = useUiStore((state) => state.resetUiAfterLocalReset);
  const resetLocalData = useFinanceStore((state) => state.resetLocalData);
  const [step, setStep] = useState("intro");
  const [pin, setPin] = useState("");
  const [pendingPin, setPendingPin] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetAvailable, setResetAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => () => cancelPinRecovery(), [cancelPinRecovery]);

  const verifyDevice = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await beginPinRecovery();
      if (result === "success") {
        setStep("new-pin");
        setPin("");
        return;
      }
      setResetAvailable(true);
      setError(recoveryMessage(result));
    } finally {
      setBusy(false);
    }
  };

  const performReset = async () => {
    if (busy || resetConfirmation.trim().toUpperCase() !== "RESET") return;
    setBusy(true);
    setError(null);
    await beginLocalReset();
    try {
      await resetLocalData();
      resetUiAfterLocalReset();
    } catch {
      cancelLocalReset();
      setError("MoneyMap could not confirm that local reset finished. The app remains locked. Restart MoneyMap to continue cleanup safely.");
    } finally {
      setBusy(false);
    }
  };

  const continueToConfirmation = () => {
    if (!isValidPin(pin)) return;
    setPendingPin(pin);
    setPin("");
    setError(null);
    setStep("confirm-pin");
  };

  const replacePin = async () => {
    if (busy || !isValidPin(pin)) return;
    if (pin !== pendingPin) {
      setPin("");
      setPendingPin("");
      setStep("new-pin");
      setError("PINs did not match. Create your new PIN again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await completePinRecovery(pin);
      if (!result.ok) {
        setStep("intro");
        setPin("");
        setPendingPin("");
        setError("Device verification expired. Verify again to replace your PIN.");
      }
    } catch {
      setPin("");
      setError("Your new PIN could not be saved. MoneyMap remains locked.");
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.outline,
    borderRadius: theme.radii.row,
    borderWidth: theme.spacing.hairline,
    color: theme.colors.text,
    fontFamily: theme.fonts.bold,
    fontSize: theme.typeScale.screenTitle,
    minHeight: theme.sizes.primaryButton,
    paddingHorizontal: theme.spacing.xl,
    textAlign: "center",
    width: "100%",
  };
  const title = step === "intro"
    ? "Reset your PIN"
    : step === "new-pin"
      ? "Create a new PIN"
      : step === "confirm-pin"
        ? "Confirm your new PIN"
        : step === "reset-warning"
          ? "Reset MoneyMap?"
          : "Confirm local data erasure";
  const description = step === "intro"
    ? "Verify with your device security before creating a replacement PIN. Your encrypted financial data stays on this device."
    : step === "new-pin" || step === "confirm-pin"
      ? "Choose a 4-digit PIN. This changes only the app lock and does not replace your database encryption key."
      : step === "reset-warning"
        ? "If device security cannot verify access, the only safe fallback is to erase MoneyMap data stored on this device."
        : "Type RESET to confirm. This cannot be undone inside MoneyMap.";

  return (
    <ScreenContainer contentContainerStyle={{ alignItems: "center", gap: theme.spacing.xl }} safeBottom testID="pin-recovery-screen">
      <DonutMark animating={busy} size={theme.sizes.lockCircle} />
      <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.lockTitle }}>
          {title}
        </Text>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body, lineHeight: 21, textAlign: "center" }}>
          {description}
        </Text>
      </View>

      {error !== null ? (
        <Text accessibilityRole="alert" style={{ color: theme.colors.expense, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label, textAlign: "center" }}>
          {error}
        </Text>
      ) : null}

      {step === "intro" ? (
        <View style={{ gap: theme.spacing.md, maxWidth: theme.sizes.maxContentWidth, width: "100%" }}>
          <PrimaryButton disabled={busy} onPress={verifyDevice}>
            {busy ? "Verifying..." : "Verify with your device"}
          </PrimaryButton>
          {resetAvailable ? (
            <Pressable accessibilityRole="button" disabled={busy} hitSlop={theme.spacing.md} onPress={() => {
              cancelPinRecovery();
              setError(null);
              setStep("reset-warning");
            }} style={{ alignItems: "center", minHeight: theme.sizes.minTouchTarget, justifyContent: "center" }}>
              <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>Reset MoneyMap instead</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" disabled={busy} hitSlop={theme.spacing.md} onPress={() => navigation.goBack()} style={{ alignItems: "center", minHeight: theme.sizes.minTouchTarget, justifyContent: "center" }}>
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>Back to PIN entry</Text>
          </Pressable>
        </View>
      ) : step === "reset-warning" ? (
        <View style={{ gap: theme.spacing.md, maxWidth: theme.sizes.maxContentWidth, width: "100%" }}>
          <View accessible style={{ backgroundColor: theme.colors.amberBg, borderRadius: theme.radii.row, gap: theme.spacing.sm, padding: theme.spacing.xl }}>
            <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>This permanently removes:</Text>
            <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body, lineHeight: 21 }}>
              Accounts, transactions, budgets, recurring bills, goals, app settings, your app PIN, and the database encryption key.
            </Text>
            <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body, lineHeight: 21 }}>
              Backup files you exported outside MoneyMap are not deleted.
            </Text>
          </View>
          <PrimaryButton disabled={busy} onPress={() => {
            setResetConfirmation("");
            setError(null);
            setStep("reset-confirm");
          }}>Continue to reset</PrimaryButton>
          <Pressable accessibilityRole="button" disabled={busy} hitSlop={theme.spacing.md} onPress={() => setStep("intro")} style={{ alignItems: "center", minHeight: theme.sizes.minTouchTarget, justifyContent: "center" }}>
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>Keep my data</Text>
          </Pressable>
        </View>
      ) : step === "reset-confirm" ? (
        <View style={{ gap: theme.spacing.md, maxWidth: theme.sizes.lockContentWidth, width: "100%" }}>
          <TextInput
            accessibilityLabel="Type RESET to confirm local data erasure"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            onChangeText={setResetConfirmation}
            placeholder="RESET"
            placeholderTextColor={theme.colors.sub}
            style={inputStyle}
            value={resetConfirmation}
          />
          <PrimaryButton accessibilityLabel="Erase MoneyMap local data" disabled={busy || resetConfirmation.trim().toUpperCase() !== "RESET"} onPress={performReset}>
            {busy ? "Erasing local data..." : "Erase local data"}
          </PrimaryButton>
          <Pressable accessibilityRole="button" disabled={busy} hitSlop={theme.spacing.md} onPress={() => setStep("reset-warning")} style={{ alignItems: "center", minHeight: theme.sizes.minTouchTarget, justifyContent: "center" }}>
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: theme.spacing.md, maxWidth: theme.sizes.lockContentWidth, width: "100%" }}>
          <TextInput
            accessibilityLabel={step === "new-pin" ? "New 4-digit PIN" : "Confirm new 4-digit PIN"}
            accessibilityHint="Enter four numbers"
            autoFocus
            editable={!busy}
            keyboardType="number-pad"
            maxLength={4}
            onChangeText={(value) => setPin(value.replace(/\D/g, "").slice(0, 4))}
            secureTextEntry
            style={inputStyle}
            value={pin}
          />
          <PrimaryButton disabled={busy || !isValidPin(pin)} onPress={step === "new-pin" ? continueToConfirmation : replacePin}>
            {step === "new-pin" ? "Continue" : busy ? "Saving..." : "Set new PIN"}
          </PrimaryButton>
          <Pressable accessibilityRole="button" disabled={busy} hitSlop={theme.spacing.md} onPress={() => {
            cancelPinRecovery();
            navigation.goBack();
          }} style={{ alignItems: "center", minHeight: theme.sizes.minTouchTarget, justifyContent: "center" }}>
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>Cancel recovery</Text>
          </Pressable>
        </View>
      )}
    </ScreenContainer>
  );
}
