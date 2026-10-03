import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react-native";
import { StyleSheet, View } from "react-native";

jest.mock("../src/store/uiStore", () => ({
  useUiStore: (selector) => selector({ themePreference: "light" }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

import { BottomSheet } from "../src/components/BottomSheet";
import { EmojiGrid } from "../src/components/EmojiGrid";
import {
  contentMaxWidthForViewport,
  getTheme,
} from "../src/theme/tokens";

function relativeLuminance(hex) {
  const channels = hex
    .match(/[0-9a-f]{2}/gi)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4
    ));

  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("responsive and accessibility primitives", () => {
  it("uses one bounded phone/tablet content rule without a desktop fork", () => {
    expect(contentMaxWidthForViewport(412)).toBe(540);
    expect(contentMaxWidthForViewport(600)).toBe(760);
    expect(contentMaxWidthForViewport(1024)).toBe(760);
    expect(contentMaxWidthForViewport(1920)).toBe(760);
  });

  it("keeps every emoji choice at least 44 points tall", async () => {
    const screen = await render(
      <EmojiGrid onChange={jest.fn()} presets={["🍜", "📚"]} value="🍜" />,
    );

    for (const choice of screen.getAllByRole("radio")) {
      expect(StyleSheet.flatten(choice.props.style).height).toBeGreaterThanOrEqual(44);
    }
  });

  it("preserves the BottomSheet test id while rendering scrollable content", async () => {
    const screen = await render(
      <BottomSheet
        onClose={jest.fn()}
        testID="responsive-test-sheet"
        title="Responsive sheet"
        visible
      >
        <View testID="responsive-sheet-child" />
      </BottomSheet>,
    );

    expect(screen.getByTestId("responsive-test-sheet")).toBeTruthy();
    expect(screen.getByTestId("responsive-sheet-child")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dismiss sheet" })).toBeTruthy();
  });

  it("meets WCAG AA contrast for the corrected light semantic colors", () => {
    const { colors } = getTheme("light");
    expect(contrastRatio(colors.amberText, colors.amberBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.expense, colors.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps sheets scrollable and Settings rows tied to the touch-target token", () => {
    const root = join(__dirname, "..");
    const bottomSheet = readFileSync(join(root, "src/components/BottomSheet.jsx"), "utf8");
    const settings = readFileSync(join(root, "src/screens/SettingsScreen.jsx"), "utf8");

    expect(bottomSheet).toContain("<KeyboardAvoidingView");
    expect(bottomSheet).toContain("<ScrollView");
    expect(bottomSheet).toContain("maxWidth: theme.sizes.maxSheetWidth");
    expect(settings).toContain("minHeight: theme.sizes.minTouchTarget");
  });
});
