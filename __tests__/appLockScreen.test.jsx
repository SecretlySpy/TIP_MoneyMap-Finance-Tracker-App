import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { AppLockScreen } from "../src/screens/AppLockScreen";

let mockUiState;
const mockCanUseBiometrics = jest.fn(async () => false);

jest.mock("../src/services/appLock", () => ({
  canUseBiometrics: (...args) => mockCanUseBiometrics(...args),
  isValidPin: (pin) => /^\d{4}$/.test(pin),
}));

jest.mock("../src/store/uiStore", () => ({
  useUiStore: (selector) => selector(mockUiState),
}));

jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

function navigationDouble() {
  return {
    canGoBack: jest.fn(() => false),
    goBack: jest.fn(),
    navigate: jest.fn(),
  };
}

async function enterPin(screen, pin) {
  for (const digit of pin) {
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: digit }));
      await Promise.resolve();
    });
  }
}

describe("AppLockScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUiState = {
      appLockEnabled: true,
      hasPin: true,
      isLocked: true,
      preferenceLoadError: null,
      setAppLockEnabled: jest.fn(async () => {}),
      setupPin: jest.fn(async () => {}),
      themePreference: "light",
      unlockWithBiometrics: jest.fn(async () => "unavailable"),
      unlockWithPin: jest.fn(async () => ({ ok: true, failures: 0, lockedForSeconds: 0 })),
    };
  });

  it("submits exactly once on the fourth digit without a separate action", async () => {
    const screen = await render(<AppLockScreen navigation={navigationDouble()} />);
    await enterPin(screen, "123");
    expect(mockUiState.unlockWithPin).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /submit|continue|confirm/i })).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "4" }));
      await Promise.resolve();
    });

    await waitFor(() => expect(mockUiState.unlockWithPin).toHaveBeenCalledWith("1234"));
    expect(mockUiState.unlockWithPin).toHaveBeenCalledTimes(1);
  });

  it("keeps the app locked and clears the entered PIN after a failed attempt", async () => {
    mockUiState.unlockWithPin.mockResolvedValueOnce({ ok: false, failures: 1, lockedForSeconds: 0 });
    const screen = await render(<AppLockScreen navigation={navigationDouble()} />);

    await enterPin(screen, "0000");

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Incorrect PIN."));
    expect(screen.getByLabelText("0 of 4 PIN digits entered")).toBeTruthy();
    expect(mockUiState.isLocked).toBe(true);
  });

  it("opens recovery only from the locked existing-PIN flow", async () => {
    const navigation = navigationDouble();
    const screen = await render(<AppLockScreen navigation={navigation} />);

    fireEvent.press(screen.getByRole("button", { name: "Forgot PIN?" }));
    expect(navigation.navigate).toHaveBeenCalledWith("PinRecovery");
  });
});
