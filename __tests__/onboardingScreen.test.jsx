import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { createOnboardingDraft, mergeOnboardingDraft } from "../src/services/onboarding";
import { OnboardingScreen } from "../src/screens/OnboardingScreen";

let mockFinanceState;
let mockUiState;

jest.mock("../src/store/financeStore", () => ({
  useFinanceStore: (selector) => selector(mockFinanceState),
}));

jest.mock("../src/store/uiStore", () => ({
  useUiStore: (selector) => selector(mockUiState),
}));

jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

function navigationDouble() {
  return {
    canGoBack: jest.fn(() => true),
    goBack: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  };
}

describe("OnboardingScreen", () => {
  beforeEach(() => {
    const baseDraft = createOnboardingDraft();
    mockUiState = {
      completeOnboarding: jest.fn(async () => {}),
      currencySymbol: "₱",
      hasPin: false,
      onboardingDraft: baseDraft,
      saveOnboardingProgress: jest.fn(async (draft) => draft),
      themePreference: "light",
    };
    mockFinanceState = {
      accounts: [
        { id: 1, name: "Cash", type: "CASH", startingBalanceMinor: 0, isArchived: false },
        { id: 2, name: "Card", type: "CARD", startingBalanceMinor: 0, isArchived: false },
      ],
      categories: [{ id: 1, name: "Food", type: "EXPENSE" }],
      saveOnboardingExpense: jest.fn(async () => ({ id: 11 })),
      createAccount: jest.fn(async (input) => ({ id: 9, isArchived: false, ...input })),
      updateAccount: jest.fn(async (input) => ({
        ...mockFinanceState.accounts.find((account) => account.id === input.id),
        ...input,
      })),
    };
  });

  it("updates an existing account of the selected type instead of creating a duplicate", async () => {
    const navigation = navigationDouble();
    const screen = await render(<OnboardingScreen navigation={navigation} />);

    await fireEvent.changeText(screen.getByLabelText("Account name"), "Daily cash");
    await fireEvent.changeText(screen.getByLabelText("Opening balance"), "125.50");
    await fireEvent.press(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => {
      expect(mockFinanceState.updateAccount).toHaveBeenCalledWith({
        id: 1,
        isArchived: false,
        name: "Daily cash",
        startingBalanceMinor: 12_550,
      });
    });
    expect(mockFinanceState.createAccount).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("Add your first expense")).toBeTruthy());
    expect(mockUiState.saveOnboardingProgress).toHaveBeenCalledWith(expect.objectContaining({
      step: "expense",
      expense: expect.objectContaining({ accountId: 1, accountType: "CASH" }),
    }));
  });

  it("keeps account input visible when the financial write fails", async () => {
    mockFinanceState.updateAccount.mockRejectedValueOnce(new Error("Account write failed"));
    const screen = await render(<OnboardingScreen navigation={navigationDouble()} />);

    await fireEvent.changeText(screen.getByLabelText("Account name"), "Campus wallet");
    await fireEvent.press(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Account write failed"));
    expect(screen.getByLabelText("Account name").props.value).toBe("Campus wallet");
    expect(screen.getByText("Set up an account")).toBeTruthy();
  });

  it("saves the optional first expense through the retry-safe store action", async () => {
    mockUiState.onboardingDraft = mergeOnboardingDraft(createOnboardingDraft(), {
      step: "expense",
      expense: { accountId: 1, accountType: "CASH", categoryName: "Food" },
    });
    const screen = await render(<OnboardingScreen navigation={navigationDouble()} />);

    await fireEvent.changeText(screen.getByLabelText("Expense amount"), "80.25");
    await fireEvent.changeText(screen.getByLabelText("Expense note"), "Lunch");
    await fireEvent.press(screen.getByRole("button", { name: "Add expense and continue" }));

    await waitFor(() => {
      expect(mockFinanceState.saveOnboardingExpense).toHaveBeenCalledWith({
        accountId: 1,
        amountMinor: 8_025,
        categoryName: "Food",
        note: "Lunch",
        type: "EXPENSE",
      });
    });
    await waitFor(() => expect(screen.getByText("Protect MoneyMap")).toBeTruthy());
  });

  it("lets the first expense be corrected after going back from lock setup", async () => {
    mockUiState.onboardingDraft = mergeOnboardingDraft(createOnboardingDraft(), {
      step: "expense",
      expense: { accountId: 1, accountType: "CASH", categoryName: "Food" },
    });
    const screen = await render(<OnboardingScreen navigation={navigationDouble()} />);

    await fireEvent.changeText(screen.getByLabelText("Expense amount"), "100");
    await fireEvent.press(screen.getByRole("button", { name: "Add expense and continue" }));
    await waitFor(() => expect(screen.getByText("Protect MoneyMap")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Go back" }));
    await waitFor(() => expect(screen.getByText("Add your first expense")).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText("Expense amount"), "150");
    await fireEvent.press(screen.getByRole("button", { name: "Add expense and continue" }));

    await waitFor(() => expect(mockFinanceState.saveOnboardingExpense).toHaveBeenCalledTimes(2));
    expect(mockFinanceState.saveOnboardingExpense.mock.calls.map(([input]) => input.amountMinor)).toEqual([10_000, 15_000]);
    await waitFor(() => expect(screen.getByText("Protect MoneyMap")).toBeTruthy());
  });
});
