import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { SplashScreen } from "../src/screens/SplashScreen";

let mockUiState;

jest.mock("../src/store/uiStore", () => ({
  useUiStore: (selector) => selector(mockUiState),
}));

jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

describe("SplashScreen onboarding routing", () => {
  beforeEach(() => {
    mockUiState = {
      beginOnboarding: jest.fn(async () => ({ version: 1, step: "account" })),
      discardInvalidOnboardingDraft: jest.fn(async () => {}),
      onboardingDraftInvalid: false,
      onboardingLoadError: null,
      splashReadError: null,
      themePreference: "light",
    };
  });

  it("starts first-run onboarding before replacing Splash", async () => {
    const navigation = {
      canGoBack: jest.fn(() => false),
      goBack: jest.fn(),
      replace: jest.fn(),
    };
    const screen = await render(<SplashScreen navigation={navigation} />);

    await fireEvent.press(screen.getByRole("button", { name: "Get started" }));

    await waitFor(() => expect(mockUiState.beginOnboarding).toHaveBeenCalledTimes(1));
    expect(navigation.replace).toHaveBeenCalledWith("Onboarding");
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it("returns from the Settings replay without restarting onboarding", async () => {
    const navigation = {
      canGoBack: jest.fn(() => true),
      goBack: jest.fn(),
      replace: jest.fn(),
    };
    const screen = await render(<SplashScreen navigation={navigation} />);

    await fireEvent.press(screen.getByRole("button", { name: "Get started" }));

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockUiState.beginOnboarding).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("does not enter setup if a marker retry finds an existing installation", async () => {
    mockUiState.splashReadError = "Saved app start state could not be read.";
    mockUiState.beginOnboarding.mockResolvedValueOnce(null);
    const navigation = { canGoBack: () => false, replace: jest.fn() };
    const screen = await render(<SplashScreen navigation={navigation} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/could not be read/i);
    await fireEvent.press(screen.getByRole("button", { name: "Get started" }));
    await waitFor(() => expect(mockUiState.beginOnboarding).toHaveBeenCalledTimes(1));
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("asks for confirmation before discarding an unsupported saved draft", async () => {
    mockUiState.onboardingDraftInvalid = true;
    mockUiState.onboardingLoadError = "Saved setup progress is from a newer version.";
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = await render(<SplashScreen navigation={{ canGoBack: () => false }} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/newer version/i);
    await fireEvent.press(screen.getByRole("button", { name: "Discard saved setup" }));
    expect(mockUiState.discardInvalidOnboardingDraft).not.toHaveBeenCalled();
    const actions = alert.mock.calls[0][2];
    expect(actions[0].text).toBe("Keep setup");
    await act(async () => { actions[1].onPress(); });
    await waitFor(() => expect(mockUiState.discardInvalidOnboardingDraft).toHaveBeenCalledTimes(1));
    alert.mockRestore();
  });
});
