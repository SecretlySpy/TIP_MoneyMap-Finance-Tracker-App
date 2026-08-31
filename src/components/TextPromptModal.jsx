import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View, } from "react-native";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";
import { PrimaryButton } from "./Buttons";
// Android-friendly text prompt used where Alert.prompt is unavailable.
export function TextPromptModal({ cancelLabel = "Cancel", confirmLabel = "Save", initialValue = "", keyboardType = "default", maxLength = 60, message, onCancel, onConfirm, placeholder, title, visible, }) {
    const theme = useTheme();
    const [value, setValue] = useState(initialValue);
    useEffect(() => {
        if (visible) {
            setValue(initialValue);
        }
    }, [initialValue, visible]);
    return (<Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{
            alignItems: "center",
            backgroundColor: theme.colors.shadow + "73",
            flex: 1,
            justifyContent: "center",
            paddingHorizontal: theme.spacing.screen,
        }}>
        <View style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.card,
            gap: theme.spacing.lg,
            maxWidth: theme.sizes.maxContentWidth,
            padding: theme.spacing.xl,
            width: "100%",
        }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.cardHeader }}>
            {title}
          </Text>
          {message !== undefined ? (<Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body }}>
              {message}
            </Text>) : null}
          <TextInput autoFocus keyboardType={keyboardType} maxLength={maxLength} onChangeText={setValue} placeholder={placeholder} placeholderTextColor={theme.colors.sub} style={{
            borderColor: theme.colors.outline,
            borderRadius: theme.radii.row,
            borderWidth: theme.spacing.hairline,
            color: theme.colors.text,
            fontFamily: theme.fonts.medium,
            fontSize: theme.typeScale.body,
            minHeight: 48,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
        }} value={value}/>
          <PrimaryButton onPress={() => onConfirm(value.trim())}>{confirmLabel}</PrimaryButton>
          <Pressable accessibilityRole="button" onPress={onCancel} style={{ alignItems: "center", minHeight: 44, justifyContent: "center" }}>
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
              {cancelLabel}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>);
}
