import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View, } from "react-native";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";
import { PrimaryButton } from "./Buttons";
// Android-friendly text prompt used where Alert.prompt is unavailable.
export function TextPromptModal({
  busy = false,
  cancelLabel = "Cancel",
  confirmLabel = "Save",
  disabled = false,
  initialValue = "",
  keyboardType = "default",
  maxLength = 60,
  message,
  onCancel,
  onConfirm,
  placeholder,
  title,
  visible,
}) {
  const theme = useTheme();
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      setSubmitting(false);
    }
  }, [initialValue, visible]);

  const handleConfirm = async () => {
    if (submitting || busy || disabled) return;
    setSubmitting(true);
    try {
      await onConfirm(value.trim());
    } finally {
      setSubmitting(false);
    }
  };

  const isActionDisabled = disabled || busy || submitting;

  return (
    <Modal animationType="fade" onRequestClose={isActionDisabled ? undefined : onCancel} transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.shadow + "73",
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: theme.spacing.screen,
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.card,
            gap: theme.spacing.lg,
            maxWidth: theme.sizes.maxContentWidth,
            padding: theme.spacing.xl,
            width: "100%",
          }}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.fonts.bold,
              fontSize: theme.typeScale.cardHeader,
            }}
          >
            {title}
          </Text>
          {message !== undefined ? (
            <Text
              style={{
                color: theme.colors.sub,
                fontFamily: theme.fonts.regular,
                fontSize: theme.typeScale.body,
              }}
            >
              {message}
            </Text>
          ) : null}
          <TextInput
            autoFocus
            editable={!isActionDisabled}
            keyboardType={keyboardType}
            maxLength={maxLength}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.sub}
            style={{
              borderColor: theme.colors.outline,
              borderRadius: theme.radii.row,
              borderWidth: theme.spacing.hairline,
              color: theme.colors.text,
              fontFamily: theme.fonts.medium,
              fontSize: theme.typeScale.body,
              minHeight: 48,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
            }}
            value={value}
          />
          <PrimaryButton disabled={isActionDisabled} onPress={() => void handleConfirm()}>
            {submitting || busy ? "Please wait…" : confirmLabel}
          </PrimaryButton>
          <Pressable
            accessibilityRole="button"
            disabled={isActionDisabled}
            onPress={onCancel}
            style={{ alignItems: "center", justifyContent: "center", minHeight: 44 }}
          >
            <Text
              style={{
                color: isActionDisabled ? theme.colors.sub : theme.colors.primary,
                fontFamily: theme.fonts.bold,
                fontSize: theme.typeScale.body,
              }}
            >
              {cancelLabel}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
