import { act, render, waitFor } from "@testing-library/react-native";
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
      onlinePersonalizationEnabled: false,
      onlinePersonalizationConsentAccepted: false,
      smartTipsEnabled: false,
      smartTipsConsentAccepted: false,
    });

    const screen = await render(<SmartTipsScreen navigation={navigation} />);
    expect(screen.getByText("Online personalization disabled")).toBeTruthy();
    expect(screen.getByText("Your budget totals stay on this device. Personalized tips need Online Personalization.")).toBeTruthy();
  });

  it("displays 'Online personalization not configured' when enabled and consented but AI proxy not configured", async () => {
    useUiStore.setState({
      currencySymbol: "₱",
      onlinePersonalizationEnabled: true,
      onlinePersonalizationConsentAccepted: true,
      smartTipsEnabled: true,
      smartTipsConsentAccepted: true,
    });
    jest.spyOn(aiProxyClient, "isAiProxyConfigured").mockReturnValue(false);
    jest.spyOn(smartTipsClient, "loadOnlineSmartTips").mockResolvedValue(null);

    const screen = await render(<SmartTipsScreen navigation={navigation} />);
    expect(screen.getByText("Online personalization not configured")).toBeTruthy();
    expect(screen.getByText("Secure online personalization is not configured yet. Your local budget totals remain available.")).toBeTruthy();
  });

  it("displays 'Online recommendations available' when online tips are successfully loaded", async () => {
    useUiStore.setState({
      currencySymbol: "₱",
      onlinePersonalizationEnabled: true,
      onlinePersonalizationConsentAccepted: true,
      smartTipsEnabled: true,
      smartTipsConsentAccepted: true,
    });
    jest.spyOn(aiProxyClient, "isAiProxyConfigured").mockReturnValue(true);
    jest.spyOn(smartTipsClient, "loadOnlineSmartTips").mockResolvedValue([
      { id: "ai-1", title: "Eat at student diner", meta: "Choose lunch wisely", tag: "AI", emoji: "✨", amountPesos: 40 },
    ]);

    const screen = await render(<SmartTipsScreen navigation={navigation} />);
    await waitFor(() => {
      expect(screen.getByText("Online recommendations available")).toBeTruthy();
    });
    expect(screen.getByText("Eat at student diner")).toBeTruthy();
    expect(screen.getByText("₱40")).toBeTruthy();
    expect(screen.getByText("Personalized suggestions from your anonymized budget summary.")).toBeTruthy();
  });

  it("displays 'Online service unavailable' when online fetch fails/returns null", async () => {
    useUiStore.setState({
      currencySymbol: "₱",
      onlinePersonalizationEnabled: true,
      onlinePersonalizationConsentAccepted: true,
      smartTipsEnabled: true,
      smartTipsConsentAccepted: true,
    });
    jest.spyOn(aiProxyClient, "isAiProxyConfigured").mockReturnValue(true);
    jest.spyOn(smartTipsClient, "loadOnlineSmartTips").mockResolvedValue(null);

    const screen = await render(<SmartTipsScreen navigation={navigation} />);
    await waitFor(() => {
      expect(screen.getByText("Online service unavailable")).toBeTruthy();
    });
    expect(screen.getByText("Online service unavailable. Retry when you are connected.")).toBeTruthy();
  });

  it("does not display a pending response after consent is withdrawn", async () => {
    useUiStore.setState({
      onlinePersonalizationEnabled: true,
      onlinePersonalizationConsentAccepted: true,
      currencySymbol: "₱",
    });
    let resolve;
    jest.spyOn(smartTipsClient, "loadOnlineSmartTips").mockImplementation(() => new Promise((done) => { resolve = done; }));
    const screen = await render(<SmartTipsScreen navigation={navigation} />);
    await waitFor(() => expect(resolve).toBeDefined());
    await act(async () => { useUiStore.setState({ onlinePersonalizationConsentAccepted: false, smartTipsConsentAccepted: true }); });
    await act(async () => { resolve([{ id: "late", title: "Stale tip", amountPesos: 50 }]); });
    expect(screen.queryByText("Stale tip")).toBeNull();
    expect(screen.getByText("Consent required")).toBeTruthy();
  });

  it("explains non-peso personalization without requesting AI tips", async () => {
    useUiStore.setState({ onlinePersonalizationEnabled: true, onlinePersonalizationConsentAccepted: true, currencySymbol: "$" });
    const loadSpy = jest.spyOn(smartTipsClient, "loadOnlineSmartTips");
    const screen = await render(<SmartTipsScreen navigation={navigation} />);
    expect(screen.getAllByText("Peso tips only").length).toBeGreaterThan(0);
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it("displays whole-peso ₱11,200 rather than raw centavos (1120000) in AI recommendations", async () => {
    useUiStore.setState({
      currencySymbol: "₱",
      onlinePersonalizationEnabled: true,
      onlinePersonalizationConsentAccepted: true,
      smartTipsEnabled: true,
      smartTipsConsentAccepted: true,
    });
    jest.spyOn(aiProxyClient, "isAiProxyConfigured").mockReturnValue(true);
    jest.spyOn(smartTipsClient, "loadOnlineSmartTips").mockResolvedValue([
      {
        id: "ai-budget-limit",
        title: "Stay within your budget",
        meta: { before: "Monitor your ", amountPesos: 11_200, after: " limit" },
        tag: "Budget",
        emoji: "🎯",
        amountPesos: 11_200,
        isEstimate: true,
      },
    ]);

    const screen = await render(<SmartTipsScreen navigation={navigation} />);
    await waitFor(() => {
      expect(screen.getByText("Stay within your budget")).toBeTruthy();
    });
    expect(screen.getByText("Monitor your ₱11,200 limit")).toBeTruthy();
    expect(screen.getByText("~₱11,200")).toBeTruthy();
    expect(screen.queryByText(/1120000/)).toBeNull();
  });
});
