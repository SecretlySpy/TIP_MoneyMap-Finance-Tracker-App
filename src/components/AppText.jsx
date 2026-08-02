import { Text as NativeText } from "react-native";
// Android font padding differs from Figma/CSS line boxes, so the app removes it once here.
export function AppText({ style, ...props }) {
    return <NativeText {...props} style={[{ includeFontPadding: false }, style]}/>;
}
