import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { StudentEatsScreen } from "../src/screens/StudentEatsScreen";
import { useUiStore } from "../src/store/uiStore";
import * as placesClient from "../src/remote/placesClient";
import * as eatsTipsClient from "../src/remote/eatsTipsClient";
import * as locationService from "../src/services/locationService";

jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
jest.mock("../src/remote/placesClient");
jest.mock("../src/remote/eatsTipsClient");
jest.mock("../src/services/locationService");

describe("StudentEatsScreen UI States and Online Personalization", () => {
  const mockNavigation = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useUiStore.setState({
      onlinePersonalizationEnabled: true,
      onlinePersonalizationConsentAccepted: true,
      smartTipsEnabled: true,
      smartTipsConsentAccepted: true,
      currencySymbol: "₱",
    });

    locationService.resolveEatsOrigin.mockResolvedValue({
      latitude: 14.62548,
      longitude: 121.06135,
      label: "TIP Quezon City (Campus)",
      isFallback: true,
      permission: "denied",
    });

    placesClient.fetchNearbyEats.mockResolvedValue({
      places: [
        {
          id: "place-1",
          name: "Campus Silog Express",
          latitude: 14.626,
          longitude: 121.062,
          distanceM: 150,
          priceLevel: 1,
          rating: 4.6,
          primaryType: "restaurant",
          address: "123 Aurora Blvd, QC",
          score: 92,
        },
      ],
      origin: { latitude: 14.62548, longitude: 121.06135 },
      source: "google_places",
      fromCache: false,
      attribution: "Powered by Google",
      errorMessage: null,
    });

    eatsTipsClient.fetchEatsAiTips.mockResolvedValue([
      {
        id: "eats-ai-0",
        emoji: "🍱",
        title: "Campus Silog Express Budget Value",
        meta: "Affordable combo meal within your daily food budget.",
      },
    ]);
  });

  it("shows disabled EmptyState when online personalization is off", async () => {
    useUiStore.setState({
      onlinePersonalizationEnabled: false,
      smartTipsEnabled: false,
    });

    const screen = await render(
      <StudentEatsScreen navigation={mockNavigation} />,
    );

    expect(screen.getByText("Online Personalization is off")).toBeTruthy();
    expect(screen.getByText("Enable in Settings")).toBeTruthy();
    expect(placesClient.fetchNearbyEats).not.toHaveBeenCalled();
    expect(screen.queryByTestId("student-eats-google-map-container")).toBeNull();

    fireEvent.press(screen.getByText("Enable in Settings"));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("Settings");
  });

  it("shows consent required EmptyState when personalization is enabled but consent is missing", async () => {
    useUiStore.setState({
      onlinePersonalizationEnabled: true,
      onlinePersonalizationConsentAccepted: false,
      smartTipsEnabled: true,
      smartTipsConsentAccepted: false,
    });

    const screen = await render(
      <StudentEatsScreen navigation={mockNavigation} />,
    );

    expect(screen.getByText("Consent Required")).toBeTruthy();
    expect(screen.getByText("Review Consent in Settings")).toBeTruthy();
    expect(placesClient.fetchNearbyEats).not.toHaveBeenCalled();
    expect(screen.queryByTestId("student-eats-google-map-container")).toBeNull();
  });

  it("renders Google Map and restaurant cards when enabled and consented", async () => {
    const screen = await render(
      <StudentEatsScreen navigation={mockNavigation} />,
    );

    await waitFor(() => {
      expect(placesClient.fetchNearbyEats).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId("student-eats-google-map-container")).toBeTruthy();
      expect(screen.getByText("Campus Silog Express")).toBeTruthy();
      expect(screen.getByText("150 m · ₱ · ★ 4.6 · restaurant")).toBeTruthy();
      expect(screen.getByText("Powered by Google")).toBeTruthy();
    });

    // Check grounded AI recommendation appears
    await waitFor(() => {
      expect(screen.getByText("🍱 Campus Silog Express Budget Value")).toBeTruthy();
    });
  });

  it("shows unavailable EmptyState on network error without offline fallback", async () => {
    placesClient.fetchNearbyEats.mockResolvedValueOnce({
      places: [],
      origin: { latitude: 14.62548, longitude: 121.06135 },
      source: "unavailable",
      fromCache: false,
      errorMessage: "Google Places is temporarily unavailable.",
    });

    const screen = await render(
      <StudentEatsScreen navigation={mockNavigation} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Nearby Places Unavailable")).toBeTruthy();
      expect(screen.getByText("Google Places is temporarily unavailable.")).toBeTruthy();
    });

    expect(screen.queryByTestId("student-eats-google-map-container")).toBeNull();
  });

  it("shows location permission fallback banner when location permission is denied", async () => {
    const screen = await render(
      <StudentEatsScreen navigation={mockNavigation} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Campus-based discovery")).toBeTruthy();
      expect(screen.getByText("Use My Location")).toBeTruthy();
    });
  });

  it("does not revive places or AI tips from an in-flight request after consent withdrawal", async () => {
    let resolvePlaces;
    placesClient.fetchNearbyEats.mockImplementation(() => new Promise((done) => { resolvePlaces = done; }));
    const screen = await render(<StudentEatsScreen navigation={mockNavigation} />);
    await waitFor(() => expect(resolvePlaces).toBeDefined());
    await act(async () => { useUiStore.setState({ onlinePersonalizationConsentAccepted: false, smartTipsConsentAccepted: true }); });
    await act(async () => { resolvePlaces({ source: "google_places", places: [{ id: "late", name: "Stale Eatery" }] }); });
    expect(screen.getByText("Consent Required")).toBeTruthy();
    expect(screen.queryByText("Stale Eatery")).toBeNull();
    expect(eatsTipsClient.fetchEatsAiTips).not.toHaveBeenCalled();
  });

  it("keeps places available but skips peso AI tips under a non-peso display setting", async () => {
    useUiStore.setState({ currencySymbol: "$" });
    const screen = await render(<StudentEatsScreen navigation={mockNavigation} />);
    await waitFor(() => expect(screen.getByText("Campus Silog Express")).toBeTruthy());
    expect(screen.getByText("AI food budget suggestions require the peso display setting. Nearby eateries remain available.")).toBeTruthy();
    expect(eatsTipsClient.fetchEatsAiTips).not.toHaveBeenCalled();
  });
});
