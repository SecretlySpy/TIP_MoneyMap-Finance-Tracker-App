import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { EmptyState } from "../components/EmptyState";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
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

const PRICE_LABEL = { 1: "₱", 2: "₱₱", 3: "₱₱₱", 4: "₱₱₱₱" };

/**
 * Mini map: relative plot of places around origin (no native maps dependency).
 */
function EatsMiniMap({ origin, places, theme }) {
  const size = 280;
  const pad = 16;
  const maxM = Math.max(
    400,
    ...places.slice(0, 12).map((p) => p.distanceM),
    1,
  );
  const scale = (size / 2 - pad) / maxM;

  const toXY = (lat, lon) => {
    // Equirectangular local projection (short distances near QC).
    const mPerDegLat = 111_320;
    const mPerDegLon = 111_320 * Math.cos((origin.latitude * Math.PI) / 180);
    const dx = (lon - origin.longitude) * mPerDegLon;
    const dy = (lat - origin.latitude) * mPerDegLat;
    return {
      x: size / 2 + dx * scale,
      y: size / 2 - dy * scale,
    };
  };

  return (
    <View
      accessibilityLabel="Map of nearby eats"
      style={{
        alignSelf: "center",
        backgroundColor: theme.colors.avatarBg,
        borderColor: theme.colors.outline,
        borderRadius: theme.radii.card,
        borderWidth: theme.spacing.hairline,
        height: size,
        overflow: "hidden",
        width: "100%",
        maxWidth: size + 40,
      }}
    >
      {/* Grid rings */}
      {[0.33, 0.66, 1].map((f) => (
        <View
          key={f}
          style={{
            borderColor: theme.colors.outline,
            borderRadius: theme.radii.round,
            borderWidth: theme.spacing.hairline,
            height: (size - pad * 2) * f,
            left: (size - (size - pad * 2) * f) / 2,
            position: "absolute",
            top: (size - (size - pad * 2) * f) / 2,
            width: (size - pad * 2) * f,
          }}
        />
      ))}
      {/* Origin (you / campus) */}
      <View
        style={{
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.onPrimary,
          borderRadius: theme.radii.round,
          borderWidth: 2,
          height: 14,
          left: size / 2 - 7,
          position: "absolute",
          top: size / 2 - 7,
          width: 14,
          zIndex: 2,
        }}
      />
      {places.slice(0, 12).map((place, index) => {
        const { x, y } = toXY(place.latitude, place.longitude);
        const clampedX = Math.min(size - 10, Math.max(10, x));
        const clampedY = Math.min(size - 10, Math.max(10, y));
        return (
          <View
            key={place.id}
            style={{
              alignItems: "center",
              backgroundColor: index === 0 ? theme.colors.warning : theme.colors.expense,
              borderRadius: theme.radii.round,
              height: 10,
              justifyContent: "center",
              left: clampedX - 5,
              position: "absolute",
              top: clampedY - 5,
              width: 10,
            }}
          />
        );
      })}
      <Text
        style={{
          bottom: theme.spacing.sm,
          color: theme.colors.sub,
          fontFamily: theme.fonts.regular,
          fontSize: theme.typeScale.tiny,
          left: theme.spacing.sm,
          position: "absolute",
        }}
      >
        {origin.isFallback ? "TIP QC campus" : "You"} · rings ≈ distance
      </Text>
    </View>
  );
}

export function StudentEatsScreen({ navigation }) {
  const theme = useTheme();
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const smartTipsEnabled = useUiStore((state) => state.smartTipsEnabled);
  const smartTipsConsentAccepted = useUiStore((state) => state.smartTipsConsentAccepted);
  const budgets = useFinanceStore((state) => state.budgets);
  const categories = useFinanceStore((state) => state.categories);
  const transactions = useFinanceStore((state) => state.transactions);
  const selectedMonthYear = useFinanceStore((state) => state.selectedMonthYear);

  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [origin, setOrigin] = useState({ ...TIP_QC_CAMPUS, isFallback: true, permission: "undetermined" });
  const [places, setPlaces] = useState([]);
  const [source, setSource] = useState("");
  const [errorMessage, setErrorMessage] = useState(null);
  const [aiTips, setAiTips] = useState(null);
  const [aiStatus, setAiStatus] = useState("idle");

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

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    setAiTips(null);
    setAiStatus("idle");

    await requestEatsLocationPermission();
    const nextOrigin = await resolveEatsOrigin();
    setOrigin(nextOrigin);

    const result = await fetchNearbyEats({
      origin: {
        latitude: nextOrigin.latitude,
        longitude: nextOrigin.longitude,
        label: nextOrigin.label,
      },
      radiusM: 1500,
    });
    setPlaces(result.places);
    setSource(result.source);
    setErrorMessage(result.errorMessage);
    setStatus(result.places.length > 0 || !result.errorMessage ? "ready" : "error");

    if (
      smartTipsEnabled
      && smartTipsConsentAccepted
      && result.places.length > 0
    ) {
      setAiStatus("loading");
      const tips = await fetchEatsAiTips({
        enabled: smartTipsEnabled,
        consentAccepted: smartTipsConsentAccepted,
        places: result.places,
        currencySymbol,
        dailyFoodBudgetMinor,
      });
      setAiTips(tips);
      setAiStatus(tips && tips.length > 0 ? "ready" : "offline");
    }
  }, [
    currencySymbol,
    dailyFoodBudgetMinor,
    smartTipsConsentAccepted,
    smartTipsEnabled,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScreenContainer contentContainerStyle={{ gap: theme.spacing.xl }} testID="student-eats-screen">
      <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.lg }}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={theme.spacing.md}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.lockTitle }}>
            ←
          </Text>
        </Pressable>
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.subScreenTitle }}>
            Student Eats Near Me
          </Text>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
            {origin.isFallback
              ? `Using ${TIP_QC_CAMPUS.label} (location ${origin.permission})`
              : "Ranked by walk distance, price, and student fit"}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Refresh places"
          accessibilityRole="button"
          hitSlop={theme.spacing.sm}
          onPress={() => void load()}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
            Refresh
          </Text>
        </Pressable>
      </View>

      {dailyFoodBudgetMinor != null && dailyFoodBudgetMinor > 0 ? (
        <View
          style={{
            backgroundColor: theme.colors.tint,
            borderRadius: theme.radii.row,
            padding: theme.spacing.lg,
          }}
        >
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
            Food budget ~
            {formatMinor(dailyFoodBudgetMinor, { currencySymbol, showCents: false })}
            /day from your MoneyMap data (stays on device)
          </Text>
        </View>
      ) : null}

      {status === "loading" ? (
        <View style={{ alignItems: "center", gap: theme.spacing.lg, paddingVertical: theme.spacing.xxl }}>
          <ActivityIndicator accessibilityLabel="Loading places" color={theme.colors.primary} size="large" />
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body }}>
            Finding budget eats nearby…
          </Text>
        </View>
      ) : null}

      {status !== "loading" && places.length > 0 ? (
        <>
          <EatsMiniMap origin={origin} places={places} theme={theme} />
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
            Top picks {source ? `· ${source}` : ""}
          </Text>
          {places.map((place, index) => (
            <SectionCard
              key={place.id}
              padding={theme.spacing.lg}
              style={{ gap: theme.spacing.sm }}
            >
              <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.md }}>
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.colors.avatarBg,
                    borderRadius: theme.radii.round,
                    height: theme.sizes.avatar,
                    justifyContent: "center",
                    width: theme.sizes.avatar,
                  }}
                >
                  <Text style={{ fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body, color: theme.colors.primary }}>
                    {index + 1}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: theme.spacing.xxs, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                    {place.name}
                  </Text>
                  <Text numberOfLines={1} style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
                    {formatDistance(place.distanceM)}
                    {" · "}
                    {PRICE_LABEL[place.priceLevel] ?? "₱₱"}
                    {" · ★ "}
                    {place.rating}
                    {place.cuisine ? ` · ${place.cuisine}` : ""}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: theme.colors.tint,
                    borderRadius: theme.radii.chip,
                    paddingHorizontal: theme.spacing.keyGap,
                    paddingVertical: theme.spacing.compact,
                  }}
                >
                  <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.tag }}>
                    {place.score}
                  </Text>
                </View>
              </View>
            </SectionCard>
          ))}
        </>
      ) : null}

      {status !== "loading" && places.length === 0 ? (
        <EmptyState
          actionLabel="Try again"
          emoji="🍜"
          message={
            errorMessage
              ?? "No places loaded. Check your connection or allow location. Campus fallback still works when offline data is cached."
          }
          onAction={() => void load()}
          title="No eats found"
        />
      ) : null}

      {aiStatus === "loading" ? (
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
          Loading optional AI tips…
        </Text>
      ) : null}

      {aiTips && aiTips.length > 0 ? (
        <View style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
            AI picks (anonymized summary only)
          </Text>
          {aiTips.map((tip) => (
            <SectionCard key={tip.id} padding={theme.spacing.lg} style={{ gap: theme.spacing.xs }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                {tip.emoji} {tip.title}
              </Text>
              <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
                {tip.meta}
              </Text>
            </SectionCard>
          ))}
        </View>
      ) : null}

      <View
        accessible
        accessibilityRole="summary"
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outline,
          borderRadius: theme.radii.row,
          borderWidth: theme.spacing.hairline,
          gap: theme.spacing.xs,
          padding: theme.spacing.lg,
        }}
      >
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
          Location is requested only for this screen and never saved. AI tips (if Smart Tips is on) receive place names, distance bands, and price levels — never your coordinates.
        </Text>
      </View>
    </ScreenContainer>
  );
}
