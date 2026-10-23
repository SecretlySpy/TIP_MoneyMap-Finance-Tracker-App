import { render, waitFor } from "@testing-library/react-native";
import { SmartTipsScreen } from "../src/screens/SmartTipsScreen";
import { useFinanceStore } from "../src/store/financeStore";
import { useUiStore } from "../src/store/uiStore";
import * as smartTipsClient from "../src/remote/smartTipsClient";
import * as aiProxyClient from "../src/remote/aiProxyClient";

jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

describe("SmartTipsScreen status state indicators", () => {
  const navigation = { goBack: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    useFinanceStore.setState({
      budgets: [],
      categories: [
        { id: 1, name: "Food", icon: "restaurant", colorHex: "#EA580C", type: "EXPENSE", isCustom: false },
      ],
      transactions: [],
      selectedMonthYear: "2026-10",
    });
  });

  it("displays 'Online personalization disabled' when smartTipsEnabled is false", async () => {
    useUiStore.setState({
      currencySymbol: "₱",
      smartTipsEnabled: false,
      smartTipsConsentAccepted: false,
    });

    const screen = await render(<SmartTipsScreen navigation={navigation} />);
    expect(screen.getByText("Online personalization disabled")).toBeTruthy();
    expect(screen.getByText("Tips are computed from your own spending and stay on-device. Online personalization is optional.")).toBeTruthy();
  });

  it("displays 'Online personalization not configured' when enabled and consented but AI proxy not configured", async () => {
    useUiStore.setState({
      currencySymbol: "₱",
      smartTipsEnabled: true,
      smartTipsConsentAccepted: true,
    });
    jest.spyOn(aiProxyClient, "isAiProxyConfigured").mockReturnValue(false);
    jest.spyOn(smartTipsClient, "loadOnlineSmartTips").mockResolvedValue(null);

    const screen = await render(<SmartTipsScreen navigation={navigation} />);
    expect(screen.getByText("Online personalization not configured")).toBeTruthy();
    expect(screen.getByText("Offline recommendations available. Secure online personalization is not configured yet.")).toBeTruthy();
  });

  it("displays 'Online recommendations available' when online tips are successfully loaded", async () => {
    useUiStore.setState({
      currencySymbol: "₱",
      smartTipsEnabled: true,
      smartTipsConsentAccepted: true,
    });
    jest.spyOn(aiProxyClient, "isAiProxyConfigured").mockReturnValue(true);
    jest.spyOn(smartTipsClient, "loadOnlineSmartTips").mockResolvedValue([
      { id: "ai-1", title: "Eat at student diner", meta: "Save ₱40", tag: "AI", emoji: "✨" },
    ]);

    const screen = await render(<SmartTipsScreen navigation={navigation} />);
    await waitFor(() => {
      expect(screen.getByText("Online recommendations available")).toBeTruthy();
    });
    expect(screen.getByText("Eat at student diner")).toBeTruthy();
    expect(screen.getByText("Personalized suggestions when online · rules-based tips always available offline.")).toBeTruthy();
  });

  it("displays 'Online service unavailable' when online fetch fails/returns null", async () => {
    useUiStore.setState({
      currencySymbol: "₱",
      smartTipsEnabled: true,
      smartTipsConsentAccepted: true,
    });
    jest.spyOn(aiProxyClient, "isAiProxyConfigured").mockReturnValue(true);
    jest.spyOn(smartTipsClient, "loadOnlineSmartTips").mockResolvedValue(null);

    const screen = await render(<SmartTipsScreen navigation={navigation} />);
    await waitFor(() => {
      expect(screen.getByText("Online service unavailable")).toBeTruthy();
    });
    expect(screen.getByText("Online service unavailable. Offline recommendations available.")).toBeTruthy();
  });
});
