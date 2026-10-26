import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { EmptyState } from "../components/EmptyState";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { StudentEatsMap } from "../components/StudentEatsMap";
import {
  formatDistance,
  TIP_QC_CAMPUS,
} from "../domain/services/eatsRanking";
import { formatMinor } from "../domain/services/money";
import { deriveSmartTips } from "../domain/services/tips";
import { fetchEatsAiTips } from "../remote/eatsTipsClient";
import { fetchNearbyEats } from "../remote/placesClient";
import {
  requestEatsLocationPermission,
  resolveEatsOrigin,
} from "../services/locationService";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

function getPriceLabel(priceLevel, currencySymbol = "₱") {
  const count = Math.min(Math.max(priceLevel ?? 2, 1), 4);
  return (currencySymbol || "₱").repeat(count);
}

export function StudentEatsScreen({ navigation }) {
  const theme = useTheme();
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const onlinePersonalizationEnabled = Boolean(
    useUiStore((state) => state.onlinePersonalizationEnabled || state.smartTipsEnabled),
  );
  const onlinePersonalizationConsentAccepted = Boolean(
    useUiStore(
      (state) => state.onlinePersonalizationConsentAccepted || state.smartTipsConsentAccepted,
    ),
  );

  const budgets = useFinanceStore((state) => state.budgets);
  const categories = useFinanceStore((state) => state.categories);
  const transactions = useFinanceStore((state) => state.transactions);
  const selectedMonthYear = useFinanceStore((state) => state.selectedMonthYear);

  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [origin, setOrigin] = useState({
    ...TIP_QC_CAMPUS,
    isFallback: true,
    permission: "undetermined",
    label: "TIP Quezon City (Campus)",
  });
  const [places, setPlaces] = useState([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [attribution, setAttribution] = useState("Powered by Google");
  const [aiTips, setAiTips] = useState(null);
  const [aiStatus, setAiStatus] = useState("idle");

  const lastRequestRef = useRef({
    latitude: 0,
    longitude: 0,
    dailyBudget: null,
    timestamp: 0,
  });

  const { categoriesById } = useMemo(
    () => mapsFromState({ accounts: [], categories }),
    [categories],
  );

  const dailyFoodBudgetMinor = useMemo(() => {
    const tips = deriveSmartTips({
      budgets,
      transactions,
      categories: categoriesById,
      monthYear: selectedMonthYear,
    });
    const foodTip = tips.tips.find((t) => t.id === "food-daily");
    if (foodTip && typeof foodTip.tag === "object" && foodTip.tag?.amountMinor) {
      return foodTip.tag.amountMinor;
    }
    return tips.dailyAllowanceMinor > 0 ? tips.dailyAllowanceMinor : null;
  }, [budgets, transactions, categoriesById, selectedMonthYear]);

  const load = useCallback(
    async (force = false) => {
      if (!onlinePersonalizationEnabled) {
        setStatus("disabled");
        setPlaces([]);
        setAiTips(null);
        return;
      }

      if (!onlinePersonalizationConsentAccepted) {
        setStatus("consent_required");
        setPlaces([]);
        setAiTips(null);
        return;
      }

      setErrorMessage(null);
      setStatus("loading");

      const nextOrigin = await resolveEatsOrigin();
      setOrigin(nextOrigin);

      // Deduplication check: Avoid repeat fetches if origin and budget haven't materially changed
      const now = Date.now();
      const last = lastRequestRef.current;
      const latDiff = Math.abs(nextOrigin.latitude - last.latitude);
      const lonDiff = Math.abs(nextOrigin.longitude - last.longitude);
      const budgetDiff = dailyFoodBudgetMinor !== last.dailyBudget;
      const isFresh = now - last.timestamp < 15_000;

      if (!force && !budgetDiff && isFresh && latDiff < 0.002 && lonDiff < 0.002 && places.length > 0) {
        setStatus("ready");
        return;
      }

      lastRequestRef.current = {
        latitude: nextOrigin.latitude,
        longitude: nextOrigin.longitude,
        dailyBudget: dailyFoodBudgetMinor,
        timestamp: now,
      };

      const result = await fetchNearbyEats({
        origin: {
          latitude: nextOrigin.latitude,
          longitude: nextOrigin.longitude,
          label: nextOrigin.label,
        },
        radiusM: 1500,
        enabled: onlinePersonalizationEnabled,
        consentAccepted: onlinePersonalizationConsentAccepted,
      });

      if (result.source === "disabled") {
        setStatus("disabled");
        setPlaces([]);
        setAiTips(null);
        return;
      }

      if (result.source === "unavailable") {
        setStatus("error");
        setPlaces([]);
        setErrorMessage(result.errorMessage ?? "Google Places is temporarily unavailable.");
        setAiTips(null);
        return;
      }

      const returnedPlaces = result.places ?? [];
      setPlaces(returnedPlaces);
      setAttribution(result.attribution || "Powered by Google");
      setErrorMessage(result.errorMessage);
      setStatus("ready");
      if (returnedPlaces.length > 0 && !selectedPlaceId) {
        setSelectedPlaceId(returnedPlaces[0].id);
      }

      // Fetch grounded AI recommendations for verified places
      if (returnedPlaces.length > 0) {
        setAiStatus("loading");
        try {
          const tips = await fetchEatsAiTips({
            enabled: onlinePersonalizationEnabled,
            consentAccepted: onlinePersonalizationConsentAccepted,
            places: returnedPlaces,
            currencySymbol,
            dailyFoodBudgetMinor,
          });
          setAiTips(tips);
          setAiStatus(tips && tips.length > 0 ? "ready" : "idle");
        } catch {
          setAiStatus("error");
          setAiTips(null);
        }
      } else {
        setAiTips(null);
        setAiStatus("idle");
      }
    },
    [
      currencySymbol,
      dailyFoodBudgetMinor,
      onlinePersonalizationConsentAccepted,
      onlinePersonalizationEnabled,
      places.length,
      selectedPlaceId,
    ],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleRequestLocation = async () => {
    const res = await requestEatsLocationPermission();
    if (res.granted) {
      void load(true);
    }
  };

  const handleOpenNavigation = (place) => {
    const uri =
      place.googleMapsUri
      || `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
    Linking.openURL(uri).catch(() => {});
  };

  return (
    <ScreenContainer contentContainerStyle={{ gap: theme.spacing.xl }} testID="student-eats-screen">
      {/* Header bar */}
      <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.lg }}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={theme.spacing.md}
          onPress={() => navigation.goBack()}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.fonts.regular,
              fontSize: theme.typeScale.lockTitle,
            }}
          >
            ←
          </Text>
        </Pressable>
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.fonts.bold,
              fontSize: theme.typeScale.subScreenTitle,
            }}
          >
            Student Eats
          </Text>
          <Text
            style={{
              color: theme.colors.sub,
              fontFamily: theme.fonts.regular,
              fontSize: theme.typeScale.small,
            }}
          >
            {origin.isFallback ? "Near TIP Quezon City Campus" : "Near your current location"}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Refresh eateries"
          accessibilityRole="button"
          hitSlop={theme.spacing.sm}
          onPress={() => void load(true)}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text
            style={{
              color: theme.colors.primary,
              fontFamily: theme.fonts.bold,
              fontSize: theme.typeScale.label,
            }}
          >
            Refresh
          </Text>
        </Pressable>
      </View>

      {/* Online Personalization Disabled State */}
      {!onlinePersonalizationEnabled || status === "disabled" ? (
        <EmptyState
          actionLabel="Enable in Settings"
          emoji="🔒"
          message="Enable Online Personalization in Settings to discover nearby eateries and receive personalized food recommendations."
          onAction={() => navigation.navigate("Settings")}
          title="Online Personalization is off"
        />
      ) : null}

      {/* Consent Required State */}
      {onlinePersonalizationEnabled
      && (!onlinePersonalizationConsentAccepted || status === "consent_required") ? (
        <EmptyState
          actionLabel="Review Consent in Settings"
          emoji="📝"
          message="Accept Online Personalization consent in Settings to enable nearby food discovery and AI recommendations."
          onAction={() => navigation.navigate("Settings")}
          title="Consent Required"
        />
      ) : null}

      {/* Online Personalization Enabled & Consented Content */}
      {onlinePersonalizationEnabled && onlinePersonalizationConsentAccepted ? (
        <>
          {/* Daily food budget badge */}
          {dailyFoodBudgetMinor != null && dailyFoodBudgetMinor > 0 ? (
            <View
              style={{
                backgroundColor: theme.colors.tint,
                borderRadius: theme.radii.row,
                padding: theme.spacing.lg,
              }}
            >
              <Text
                style={{
                  color: theme.colors.primary,
                  fontFamily: theme.fonts.medium,
                  fontSize: theme.typeScale.small,
                }}
              >
                Food budget ~
                {formatMinor(dailyFoodBudgetMinor, { currencySymbol, showCents: false })}
                /day from your MoneyMap budgets (calculated offline)
              </Text>
            </View>
          ) : null}

          {/* Location permission fallback banner */}
          {origin.isFallback ? (
            <View
              style={{
                alignItems: "center",
                backgroundColor: theme.colors.avatarBg,
                borderColor: theme.colors.outline,
                borderRadius: theme.radii.row,
                borderWidth: theme.spacing.hairline,
                flexDirection: "row",
                gap: theme.spacing.md,
                padding: theme.spacing.md,
              }}
            >
              <Text style={{ fontSize: theme.typeScale.subScreenTitle }}>🎓</Text>
              <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.fonts.bold,
                    fontSize: theme.typeScale.small,
                  }}
                >
                  Campus-based discovery
                </Text>
                <Text
                  style={{
                    color: theme.colors.sub,
                    fontFamily: theme.fonts.regular,
                    fontSize: theme.typeScale.tiny,
                  }}
                >
                  Showing eateries around TIP Quezon City. Grant location permission to search around you.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Use current location"
                accessibilityRole="button"
                onPress={handleRequestLocation}
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.outline,
                  borderRadius: theme.radii.chip,
                  borderWidth: theme.spacing.hairline,
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: theme.spacing.xs,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.primary,
                    fontFamily: theme.fonts.bold,
                    fontSize: theme.typeScale.tiny,
                  }}
                >
                  Use My Location
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* Loading state */}
          {status === "loading" ? (
            <View
              accessibilityLabel="Loading nearby eateries"
              style={{
                alignItems: "center",
                gap: theme.spacing.lg,
                paddingVertical: theme.spacing.xxl,
              }}
            >
              <ActivityIndicator color={theme.colors.primary} size="large" />
              <Text
                style={{
                  color: theme.colors.sub,
                  fontFamily: theme.fonts.regular,
                  fontSize: theme.typeScale.body,
                }}
              >
                Finding budget eats with Google Places…
              </Text>
            </View>
          ) : null}

          {/* Error / Unavailable state */}
          {status === "error" ? (
            <EmptyState
              actionLabel="Retry"
              emoji="📡"
              message={
                errorMessage
                ?? "Unable to connect to Google Places. Please check your network and try again."
              }
              onAction={() => void load(true)}
              title="Nearby Places Unavailable"
            />
          ) : null}

          {/* Ready state with Places */}
          {status === "ready" && places.length > 0 ? (
            <>
              {/* Interactive Google Maps */}
              <StudentEatsMap
                onSelectPlace={setSelectedPlaceId}
                origin={origin}
                places={places}
                selectedPlaceId={selectedPlaceId}
                theme={theme}
              />

              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    color: theme.colors.sub,
                    fontFamily: theme.fonts.bold,
                    fontSize: theme.typeScale.label,
                  }}
                >
                  Nearby Eateries ({places.length})
                </Text>
                <Text
                  style={{
                    color: theme.colors.sub,
                    fontFamily: theme.fonts.regular,
                    fontSize: theme.typeScale.tiny,
                  }}
                >
                  {attribution}
                </Text>
              </View>

              {/* Restaurant Cards synchronized with Map */}
              {places.map((place, index) => {
                const isSelected = selectedPlaceId === place.id;
                return (
                  <Pressable
                    accessibilityLabel={`${place.name}, ${formatDistance(place.distanceM)}`}
                    accessibilityRole="button"
                    key={place.id}
                    onPress={() => setSelectedPlaceId(place.id)}
                  >
                    <SectionCard
                      padding={theme.spacing.lg}
                      style={{
                        borderColor: isSelected ? theme.colors.primary : theme.colors.outline,
                        borderWidth: isSelected ? 2 : theme.spacing.hairline,
                        gap: theme.spacing.sm,
                      }}
                    >
                      <View
                        style={{
                          alignItems: "center",
                          flexDirection: "row",
                          gap: theme.spacing.md,
                        }}
                      >
                        <View
                          style={{
                            alignItems: "center",
                            backgroundColor: isSelected
                              ? theme.colors.warning
                              : theme.colors.avatarBg,
                            borderRadius: theme.radii.round,
                            height: theme.sizes.avatar,
                            justifyContent: "center",
                            width: theme.sizes.avatar,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: theme.fonts.bold,
                              fontSize: theme.typeScale.body,
                              color: isSelected
                                ? theme.colors.onAccent
                                : theme.colors.primary,
                            }}
                          >
                            {index + 1}
                          </Text>
                        </View>
                        <View style={{ flex: 1, gap: theme.spacing.xxs, minWidth: 0 }}>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: theme.colors.text,
                              fontFamily: theme.fonts.bold,
                              fontSize: theme.typeScale.body,
                            }}
                          >
                            {place.name}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: theme.colors.sub,
                              fontFamily: theme.fonts.regular,
                              fontSize: theme.typeScale.small,
                            }}
                          >
                            {formatDistance(place.distanceM)}
                            {" · "}
                            {getPriceLabel(place.priceLevel, currencySymbol)}
                            {" · ★ "}
                            {place.rating}
                            {place.primaryType ? ` · ${place.primaryType}` : ""}
                          </Text>
                          {place.address ? (
                            <Text
                              numberOfLines={1}
                              style={{
                                color: theme.colors.sub,
                                fontFamily: theme.fonts.regular,
                                fontSize: theme.typeScale.tiny,
                              }}
                            >
                              {place.address}
                            </Text>
                          ) : null}
                        </View>

                        <View style={{ alignItems: "flex-end", gap: theme.spacing.xs }}>
                          <View
                            style={{
                              backgroundColor: theme.colors.tint,
                              borderRadius: theme.radii.chip,
                              paddingHorizontal: theme.spacing.keyGap,
                              paddingVertical: theme.spacing.compact,
                            }}
                          >
                            <Text
                              style={{
                                color: theme.colors.primary,
                                fontFamily: theme.fonts.bold,
                                fontSize: theme.typeScale.tag,
                              }}
                            >
                              {place.score ?? 80}
                            </Text>
                          </View>
                          <Pressable
                            accessibilityLabel={`Open ${place.name} in Google Maps`}
                            accessibilityRole="button"
                            hitSlop={theme.spacing.sm}
                            onPress={() => handleOpenNavigation(place)}
                            style={{
                              backgroundColor: theme.colors.surface,
                              borderColor: theme.colors.outline,
                              borderRadius: theme.radii.chip,
                              borderWidth: theme.spacing.hairline,
                              paddingHorizontal: theme.spacing.sm,
                              paddingVertical: theme.spacing.compact,
                            }}
                          >
                            <Text
                              style={{
                                color: theme.colors.primary,
                                fontFamily: theme.fonts.bold,
                                fontSize: theme.typeScale.tiny,
                              }}
                            >
                              Maps ↗
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    </SectionCard>
                  </Pressable>
                );
              })}
            </>
          ) : null}

          {/* No results state */}
          {status === "ready" && places.length === 0 ? (
            <EmptyState
              actionLabel="Refresh search"
              emoji="🍜"
              message="No eateries were found within 1.5 km of the current search area."
              onAction={() => void load(true)}
              title="No Eats Found"
            />
          ) : null}

          {/* Grounded AI Recommendations */}
          {aiStatus === "loading" ? (
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: theme.spacing.sm,
                paddingVertical: theme.spacing.sm,
              }}
            >
              <ActivityIndicator color={theme.colors.primary} size="small" />
              <Text
                style={{
                  color: theme.colors.sub,
                  fontFamily: theme.fonts.regular,
                  fontSize: theme.typeScale.small,
                }}
              >
                Personalizing recommendations with Gemini…
              </Text>
            </View>
          ) : null}

          {aiTips && aiTips.length > 0 ? (
            <View style={{ gap: theme.spacing.md }}>
              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    color: theme.colors.sub,
                    fontFamily: theme.fonts.bold,
                    fontSize: theme.typeScale.label,
                  }}
                >
                  AI Recommendations
                </Text>
                <View
                  style={{
                    backgroundColor: theme.colors.tint,
                    borderRadius: theme.radii.chip,
                    paddingHorizontal: theme.spacing.sm,
                    paddingVertical: theme.spacing.compact,
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.primary,
                      fontFamily: theme.fonts.bold,
                      fontSize: theme.typeScale.tiny,
                    }}
                  >
                    Gemini 1.5
                  </Text>
                </View>
              </View>

              {aiTips.map((tip) => (
                <SectionCard
                  key={tip.id}
                  padding={theme.spacing.lg}
                  style={{ gap: theme.spacing.xs }}
                >
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontFamily: theme.fonts.bold,
                      fontSize: theme.typeScale.body,
                    }}
                  >
                    {tip.emoji} {tip.title}
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.sub,
                      fontFamily: theme.fonts.regular,
                      fontSize: theme.typeScale.small,
                    }}
                  >
                    {tip.meta}
                  </Text>
                </SectionCard>
              ))}
            </View>
          ) : null}

          {/* Privacy & data notice */}
          <View
            accessibilityRole="summary"
            accessible
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outline,
              borderRadius: theme.radii.row,
              borderWidth: theme.spacing.hairline,
              gap: theme.spacing.xs,
              padding: theme.spacing.lg,
            }}
          >
            <Text
              style={{
                color: theme.colors.sub,
                fontFamily: theme.fonts.regular,
                fontSize: theme.typeScale.small,
              }}
            >
              Places discovered via Google Places API (New) authenticated with Firebase App Check.
              Coordinates are used only for live nearby searches and are never saved or uploaded to
              Gemini. AI recommendations are strictly grounded to the verified eateries above.
            </Text>
          </View>
        </>
      ) : null}
    </ScreenContainer>
  );
}
