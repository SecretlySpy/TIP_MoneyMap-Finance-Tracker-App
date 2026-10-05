import { render, userEvent, waitFor } from "@testing-library/react-native";
import { PinRecoveryScreen } from "../src/screens/PinRecoveryScreen";

let mockFinanceState;
let mockUiState;

jest.mock("../src/services/appLock", () => ({
  isValidPin: (pin) => /^\d{4}$/.test(pin),
}));
jest.mock("../src/store/financeStore", () => ({
  useFinanceStore: (selector) => selector(mockFinanceState),
}));
jest.mock("../src/store/uiStore", () => ({
  useUiStore: (selector) => selector(mockUiState),
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

function navigationDouble() {
  return { goBack: jest.fn() };
}

async function press(user, screen, name) {
  await user.press(screen.getByRole("button", { name }));
}

describe("PinRecoveryScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFinanceState = {
      resetLocalData: jest.fn(async () => {}),
    };
    mockUiState = {
      beginLocalReset: jest.fn(async () => {}),
      beginPinRecovery: jest.fn(async () => "success"),
      cancelLocalReset: jest.fn(),
      cancelPinRecovery: jest.fn(),
      completePinRecovery: jest.fn(async () => ({ ok: true })),
      resetUiAfterLocalReset: jest.fn(),
      themePreference: "light",
    };
  });

  it("uses native verification before accepting and confirming a replacement PIN", async () => {
    const user = userEvent.setup();
    const screen = await render(<PinRecoveryScreen navigation={navigationDouble()} />);

    await press(user, screen, "Verify with your device");
    await waitFor(() => expect(screen.getByLabelText("New 4-digit PIN")).toBeTruthy());
    await user.type(screen.getByLabelText("New 4-digit PIN"), "2468");
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue" }).props.accessibilityState.disabled).toBe(false));
    await press(user, screen, "Continue");
    await waitFor(() => expect(screen.getByLabelText("Confirm new 4-digit PIN")).toBeTruthy());
    await user.type(screen.getByLabelText("Confirm new 4-digit PIN"), "2468");
    await waitFor(() => expect(screen.getByRole("button", { name: "Set new PIN" }).props.accessibilityState.disabled).toBe(false));
    await press(user, screen, "Set new PIN");

    await waitFor(() => expect(mockUiState.completePinRecovery).toHaveBeenCalledWith("2468"));
    expect(mockUiState.beginPinRecovery).toHaveBeenCalledTimes(1);
    expect(mockFinanceState.resetLocalData).not.toHaveBeenCalled();
  });

  it("does not expose PIN replacement after native verification fails", async () => {
    const user = userEvent.setup();
    mockUiState.beginPinRecovery.mockResolvedValueOnce("failed");
    const screen = await render(<PinRecoveryScreen navigation={navigationDouble()} />);

    await press(user, screen, "Verify with your device");

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/still locked/i));
    expect(screen.queryByLabelText("New 4-digit PIN")).toBeNull();
    expect(screen.getByRole("button", { name: "Reset MoneyMap instead" })).toBeTruthy();
  });

  it("requires two reset steps and the explicit RESET phrase", async () => {
    const user = userEvent.setup();
    mockUiState.beginPinRecovery.mockResolvedValueOnce("unavailable");
    const screen = await render(<PinRecoveryScreen navigation={navigationDouble()} />);

    await press(user, screen, "Verify with your device");
    await waitFor(() => screen.getByRole("button", { name: "Reset MoneyMap instead" }));
    await press(user, screen, "Reset MoneyMap instead");
    await waitFor(() => expect(screen.getByText(/Backup files you exported outside MoneyMap are not deleted/)).toBeTruthy());
    await press(user, screen, "Continue to reset");

    const eraseButton = screen.getByRole("button", { name: "Erase MoneyMap local data" });
    expect(eraseButton.props.accessibilityState.disabled).toBe(true);
    await user.type(screen.getByLabelText("Type RESET to confirm local data erasure"), "RESET");
    await waitFor(() => expect(screen.getByRole("button", { name: "Erase MoneyMap local data" }).props.accessibilityState.disabled).toBe(false));
    await press(user, screen, "Erase MoneyMap local data");

    await waitFor(() => expect(mockUiState.beginLocalReset).toHaveBeenCalledTimes(1));
    expect(mockFinanceState.resetLocalData).toHaveBeenCalledTimes(1);
    expect(mockUiState.resetUiAfterLocalReset).toHaveBeenCalledTimes(1);
    expect(mockUiState.cancelLocalReset).not.toHaveBeenCalled();
  });

  it("keeps the locked UI and pending cleanup path when reset is interrupted", async () => {
    const user = userEvent.setup();
    mockUiState.beginPinRecovery.mockResolvedValueOnce("unavailable");
    mockFinanceState.resetLocalData.mockRejectedValueOnce(new Error("interrupted"));
    const screen = await render(<PinRecoveryScreen navigation={navigationDouble()} />);

    await press(user, screen, "Verify with your device");
    await waitFor(() => screen.getByRole("button", { name: "Reset MoneyMap instead" }));
    await press(user, screen, "Reset MoneyMap instead");
    await waitFor(() => screen.getByRole("button", { name: "Continue to reset" }));
    await press(user, screen, "Continue to reset");
    await user.type(screen.getByLabelText("Type RESET to confirm local data erasure"), "RESET");
    await waitFor(() => expect(screen.getByRole("button", { name: "Erase MoneyMap local data" }).props.accessibilityState.disabled).toBe(false));
    await press(user, screen, "Erase MoneyMap local data");

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/continue cleanup safely/i));
    expect(mockUiState.cancelLocalReset).toHaveBeenCalledTimes(1);
    expect(mockUiState.resetUiAfterLocalReset).not.toHaveBeenCalled();
  });
});
