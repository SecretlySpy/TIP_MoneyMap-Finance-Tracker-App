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
    useUiStore: (selector) => selector({
        currencySymbol: "₱",
        themePreference: "system",
    }),
}));
import { BudgetCard } from "../src/components/BudgetCard";
import { HistoryBody } from "../src/screens/HistoryScreen";
import { TransactionRow } from "../src/components/TransactionRow";

describe("Figma reusable UI states", () => {
    it("reports over-budget percentage while clamping only the visual bar", async () => {
        const screen = await render(<BudgetCard emoji="🛍️" limitMinor={400_000} name="Shopping" percent={118} spentMinor={473_000} state="over"/>);
        expect(screen.getByText("₱4,730 / ₱4,000")).toBeTruthy();
        expect(screen.getByText("118% — over budget")).toBeTruthy();
        expect(screen.getByRole("progressbar").props.accessibilityValue.now).toBe(100);
    });
    it("renders and activates the approved empty-history call to action", async () => {
        const onAdd = jest.fn();
        const screen = await render(<HistoryBody groups={[]} onAdd={onAdd}/>);
        expect(screen.getByText("No transactions yet")).toBeTruthy();
        await fireEvent.press(screen.getByRole("button", { name: "+ Add your first transaction" }));
        expect(onAdd).toHaveBeenCalledTimes(1);
    });
    it("distinguishes an empty filter result from an empty ledger", async () => {
        const onClearFilters = jest.fn();
        const screen = await render(
          <HistoryBody groups={[]} isFiltered onClearFilters={onClearFilters}/>,
        );
        expect(screen.getByText("No matching transactions")).toBeTruthy();
        await fireEvent.press(screen.getByRole("button", { name: "Clear filters" }));
        expect(onClearFilters).toHaveBeenCalledTimes(1);
    });
    it("renders TransactionRow as an interactive button when onPress is provided", async () => {
        const onPress = jest.fn();
        const screen = await render(
            <TransactionRow
                amountMinor={35_000}
                emoji="📚"
                meta="School · E-wallet"
                onPress={onPress}
                title="School supplies"
                type="EXPENSE"
            />,
        );
        const button = screen.getByRole("button", { name: /School supplies/ });
        expect(button).toBeTruthy();
        await fireEvent.press(button);
        expect(onPress).toHaveBeenCalledTimes(1);
    });
    it("renders TransactionRow as accessible static container when onPress is omitted", async () => {
        const screen = await render(
            <TransactionRow
                amountMinor={150_000}
                emoji="💵"
                meta="Allowance · Cash"
                title="Monthly allowance"
                type="INCOME"
            />,
        );
        expect(screen.getByText("Monthly allowance")).toBeTruthy();
        expect(screen.getByText("+₱1,500.00")).toBeTruthy();
        expect(screen.queryByRole("button")).toBeNull();
    });
});
