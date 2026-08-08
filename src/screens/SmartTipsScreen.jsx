import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { EmptyState } from "../components/EmptyState";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { deriveSmartTips } from "../domain/services/tips";
import { formatMinor } from "../domain/services/money";
import { loadOnlineSmartTips } from "../remote/smartTipsClient";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

function formatCopy(copy, currencySymbol) {
  if (typeof copy === "string") {
    return copy;
  }
  const prefix = copy.approximate === true ? "~" : "";
  return `${copy.before}${prefix}${formatMinor(copy.amountMinor, { currencySymbol, showCents: false })}${copy.after}`;
}

// Offline rules always available; optional Gemini layer when enabled + consented + online.
export function SmartTipsScreen({ navigation }) {
  const theme = useTheme();
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const smartTipsEnabled = useUiStore((state) => state.smartTipsEnabled);
  const smartTipsConsentAccepted = useUiStore((state) => state.smartTipsConsentAccepted);
  const budgets = useFinanceStore((state) => state.budgets);
  const categories = useFinanceStore((state) => state.categories);
  const transactions = useFinanceStore((state) => state.transactions);
  const selectedMonthYear = useFinanceStore((state) => state.selectedMonthYear);

  const [aiTips, setAiTips] = useState(null);
  const [aiStatus, setAiStatus] = useState("idle"); // idle | loading | ready | offline

  useEffect(() => {
    if (!smartTipsEnabled) {
      navigation.goBack();
    }
  }, [navigation, smartTipsEnabled]);

  const { categoriesById } = useMemo(
    () => mapsFromState({ accounts: [], categories }),
    [categories],
  );

  const offlineSnapshot = useMemo(
    () => deriveSmartTips({
      budgets,
      transactions,
      categories: categoriesById,
      monthYear: selectedMonthYear,
    }),
    [budgets, transactions, categoriesById, selectedMonthYear],
  );

  useEffect(() => {
    let cancelled = false;
    if (!smartTipsEnabled) {
      return undefined;
    }
    // Always start from offline tips; AI is additive/fallback merge.
    setAiStatus(smartTipsConsentAccepted ? "loading" : "idle");
    setAiTips(null);

    if (!smartTipsConsentAccepted) {
      return undefined;
    }

    void (async () => {
      const online = await loadOnlineSmartTips({
        enabled: smartTipsEnabled,
        consentAccepted: smartTipsConsentAccepted,
        monthYear: selectedMonthYear,
        currencySymbol,
        budgets,
        transactions,
        categoriesById,
      });
      if (cancelled) {
        return;
      }
      if (online === null || online.length === 0) {
        setAiTips(null);
        setAiStatus("offline");
        return;
      }
      setAiTips(online);
      setAiStatus("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [
    smartTipsEnabled,
    smartTipsConsentAccepted,
    selectedMonthYear,
    currencySymbol,
    budgets,
    transactions,
    categoriesById,
  ]);

  const remainingMinor = offlineSnapshot.remainingMinor;
  const limitMinor = offlineSnapshot.limitMinor > 0 ? offlineSnapshot.limitMinor : Math.max(remainingMinor, 1);
  const spentMinor = offlineSnapshot.spentMinor;
  const dailyMinor = offlineSnapshot.dailyAllowanceMinor > 0
    ? offlineSnapshot.dailyAllowanceMinor
    : 1;
  const progressPercent = limitMinor <= 0
    ? 0
    : Math.min(100, Math.round((spentMinor / limitMinor) * 100));

  const displayTips = useMemo(() => {
    const offline = offlineSnapshot.tips.filter((tip) => tip.id !== "empty-data");
    if (aiTips && aiTips.length > 0) {
      // Prefer AI cards first, then fill with offline rules (dedupe by title).
      const seen = new Set(aiTips.map((tip) => String(tip.title).toLowerCase()));
      const extras = offline.filter((tip) => !seen.has(String(tip.title).toLowerCase()));
      return [...aiTips, ...extras].slice(0, 6);
    }
    return offlineSnapshot.tips;
  }, [aiTips, offlineSnapshot.tips]);

  if (!smartTipsEnabled) {
    return null;
  }

  return (
    <ScreenContainer contentContainerStyle={{ gap: theme.spacing.xl }} testID="smart-tips-screen">
      <View style={{ alignItems: "center", flexDirection: "row" }}>
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
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.fonts.bold,
            fontSize: theme.typeScale.subScreenTitle,
            marginLeft: theme.spacing.lg,
          }}
        >
          Smart Tips
        </Text>
        <View style={{ flex: 1 }} />
        <View
          style={{
            backgroundColor: theme.colors.tint,
            borderRadius: theme.radii.chip,
            flexDirection: "row",
            gap: theme.spacing.xs,
            paddingHorizontal: theme.spacing.keyGap,
            paddingVertical: theme.spacing.compact,
          }}
        >
          <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.tiny }}>✨</Text>
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.tiny }}>
            {aiStatus === "ready" ? "Online + offline" : "Offline"}
          </Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: theme.colors.deepPrimary,
          borderRadius: theme.radii.hero,
          gap: theme.spacing.compact,
          minHeight: theme.sizes.smartHero,
          padding: theme.spacing.screen,
        }}
      >
        <Text style={{ color: theme.colors.heroSubtext, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
          Left this month
        </Text>
        <Text style={{ color: theme.colors.onPrimary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.smartHeroAmount }}>
          {formatMinor(remainingMinor, { currencySymbol, showCents: false })}
        </Text>
        <Text style={{ color: theme.colors.heroMeta, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
          {offlineSnapshot.limitMinor > 0
            ? `of ${formatMinor(limitMinor, { currencySymbol, showCents: false })} budget · ~${formatMinor(dailyMinor, { currencySymbol, showCents: false })}/day for ${offlineSnapshot.daysLeftInMonth} day${offlineSnapshot.daysLeftInMonth === 1 ? "" : "s"} left`
            : "Add category budgets to unlock a monthly allowance plan"}
        </Text>
        <View
          style={{
            backgroundColor: theme.colors.heroTrack,
            borderRadius: theme.radii.progress,
            height: theme.sizes.progress,
            marginTop: theme.spacing.xs,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.onPrimary,
              borderRadius: theme.radii.progress,
              height: "100%",
              width: `${progressPercent}%`,
            }}
          />
        </View>
      </View>

      <View
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.tint,
          borderRadius: theme.radii.row,
          flexDirection: "row",
          gap: theme.spacing.md,
          minHeight: theme.sizes.smartPreview,
          padding: theme.spacing.xl,
        }}
      >
        <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.subScreenTitle }}>💡</Text>
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
            {remainingMinor > 0
              ? `You've got ${formatMinor(remainingMinor, { currencySymbol, showCents: false })} left this month`
              : offlineSnapshot.limitMinor > 0
                ? "You're at or over budget this month"
                : "Set budgets to get a daily allowance"}
          </Text>
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
            {aiStatus === "loading"
              ? "Checking for personalized tips…"
              : aiStatus === "ready"
                ? "Personalized suggestions when online · rules-based tips always available offline."
                : "Tips from your own spending stay on-device. Online personalization is optional."}
          </Text>
        </View>
        {aiStatus === "loading" ? (
          <ActivityIndicator accessibilityLabel="Loading personalized tips" color={theme.colors.primary} />
        ) : null}
      </View>

      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
        Suggestions for you
      </Text>

      {displayTips.length === 0 ? (
        <EmptyState
          emoji="✨"
          message="Log transactions and budgets to unlock student-friendly suggestions. Everything stays on-device until you opt into online tips."
          title="No tips yet"
        />
      ) : (
        displayTips.map((tip) => (
          <SectionCard
            key={tip.id}
            padding={theme.spacing.lg}
            style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.md, minHeight: theme.sizes.tipCard }}
          >
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
              <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.emptyTitle }}>{tip.emoji}</Text>
            </View>
            <View style={{ flex: 1, gap: theme.spacing.xxs, minWidth: 0 }}>
              <Text numberOfLines={2} style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                {formatCopy(tip.title, currencySymbol)}
              </Text>
              <Text numberOfLines={2} style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
                {formatCopy(tip.meta, currencySymbol)}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: theme.colors.tint,
                borderRadius: theme.radii.chip,
                height: theme.sizes.tag,
                justifyContent: "center",
                maxWidth: 110,
                paddingHorizontal: theme.spacing.keyGap,
              }}
            >
              <Text numberOfLines={1} style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.tag }}>
                {formatCopy(tip.tag, currencySymbol)}
              </Text>
            </View>
          </SectionCard>
        ))
      )}

      <View
        accessible
        accessibilityRole="summary"
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outline,
          borderRadius: theme.radii.row,
          borderWidth: theme.spacing.hairline,
          flexDirection: "row",
          gap: theme.spacing.sm,
          minHeight: theme.sizes.hybridNote,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
        }}
      >
        <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>🔀</Text>
        <Text style={{ color: theme.colors.sub, flex: 1, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
          Online: AI-personalized from an anonymized budget summary · Offline: from your own spending. Raw transactions never leave this device.
        </Text>
      </View>
    </ScreenContainer>
  );
}
