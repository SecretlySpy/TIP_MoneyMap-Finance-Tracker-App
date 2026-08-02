import { fireEvent, render } from "@testing-library/react-native";

jest.mock("../src/store/financeStore", () => ({
  listAccountChips: jest.fn(() => []),
  mapsFromState: jest.fn(() => ({
    accountsById: new Map(),
    categoriesById: new Map(),
  })),
  useFinanceStore: jest.fn(() => []),
}));

jest.mock("../src/store/uiStore", () => ({
  useUiStore: (selector: (state: {
    currencySymbol: string;
    themePreference: "system" | "light" | "dark";
  }) => unknown) =>
    selector({
      currencySymbol: "₱",
      themePreference: "system",
    }),
}));

import { BudgetCard } from "../src/components/BudgetCard";
import { HistoryBody } from "../src/screens/HistoryScreen";

describe("Figma reusable UI states", () => {
  it("reports over-budget percentage while clamping only the visual bar", async () => {
    const screen = await render(
      <BudgetCard
        emoji="🛍️"
        limitMinor={400_000}
        name="Shopping"
        percent={118}
        spentMinor={473_000}
        state="over"
      />,
    );

    expect(screen.getByText("₱4,730 / ₱4,000")).toBeTruthy();
    expect(screen.getByText("118% — over budget")).toBeTruthy();
    expect(screen.getByRole("progressbar").props.accessibilityValue.now).toBe(100);
  });

  it("renders and activates the approved empty-history call to action", async () => {
    const onAdd = jest.fn();
    const screen = await render(<HistoryBody groups={[]} onAdd={onAdd} />);

    expect(screen.getByText("No transactions yet")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "＋ Add your first transaction" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
