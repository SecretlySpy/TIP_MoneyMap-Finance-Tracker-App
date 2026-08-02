import { getTheme } from "../src/theme/tokens";

describe("approved Figma theme tokens", () => {
  it("matches the exact light palette", () => {
    const theme = getTheme("light");
    expect(theme.colors.bg).toBe("#F7F9F8");
    expect(theme.colors.primary).toBe("#0F6E5C");
    expect(theme.colors.text).toBe("#1A1C1B");
    expect(theme.colors.expense).toBe("#D64545");
    expect(theme.sizes.designWidth).toBe(412);
  });

  it("uses the approved dark surfaces and brighter accent", () => {
    const theme = getTheme("dark");
    expect(theme.colors.bg).toBe("#0F1413");
    expect(theme.colors.surface).toBe("#1A211F");
    expect(theme.colors.primary).toBe("#3DBF9A");
    expect(theme.colors.text).toBe("#E8ECEA");
  });
});
