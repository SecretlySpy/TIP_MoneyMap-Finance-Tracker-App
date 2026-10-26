import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { EmptyState } from "../components/EmptyState";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { deriveSmartTips } from "../domain/services/tips";
import { formatMinor } from "../domain/services/money";
import { loadOnlineSmartTips } from "../remote/smartTipsClient";
import { isAiProxyConfigured } from "../remote/aiProxyClient";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

function formatCopy(copy, currencySymbol) {
  if (typeof copy === "string") {
    return copy;
  }
  if (copy && typeof copy === "object" && typeof copy.amountMinor === "number") {
    const prefix = copy.approximate === true ? "~" : "";
    return `${copy.before || ""}${prefix}${formatMinor(copy.amountMinor, { currencySymbol, showCents: false })}${copy.after || ""}`;
  }
  return String(copy ?? "");
}

export function SmartTipsScreen({ navigation }) {
  const theme = useTheme();
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const onlinePersonalizationEnabled = useUiStore((state) => Boolean(state.onlinePersonalizationEnabled || state.smartTipsEnabled));
  const onlinePersonalizationConsentAccepted = useUiStore((state) => Boolean(state.onlinePersonalizationConsentAccepted || state.smartTipsConsentAccepted));
  const budgets = useFinanceStore((state) => state.budgets);
  const categories = useFinanceStore((state) => state.categories);
  const transactions = useFinanceStore((state) => state.transactions);
  const selectedMonthYear = useFinanceStore((state) => state.selectedMonthYear);

  const [aiTips, setAiTips] = useState(null);
  const [aiStatus, setAiStatus] = useState("idle"); // idle | loading | ready | offline

  const { categoriesById } = useMemo(
    () => mapsFromState({ accounts: [], categories }),
    [categories],
  );

  // Core offline financial calculations for monthly budget overview (retained)
  const offlineSnapshot = useMemo(
    () => deriveSmartTips({
      budgets,
      transactions,
      categories: categoriesById,
      monthYear: selectedMonthYear,
    }),
    [budgets, transactions, categoriesById, selectedMonthYear],
  );

  const loadTips = useCallback(async () => {
    if (!onlinePersonalizationEnabled) {
      setAiTips(null);
      setAiStatus("idle");
      return;
    }

    if (!onlinePersonalizationConsentAccepted) {
      setAiTips(null);
      setAiStatus("idle");
      return;
    }

    setAiStatus("loading");
    setAiTips(null);

    try {
      const online = await loadOnlineSmartTips({
        enabled: onlinePersonalizationEnabled,
        consentAccepted: onlinePersonalizationConsentAccepted,
        monthYear: selectedMonthYear,
        currencySymbol,
        budgets,
        transactions,
        categoriesById,
      });

      if (online === null || online.length === 0) {
        setAiTips(null);
        setAiStatus("offline");
        return;
      }

      setAiTips(online);
      setAiStatus("ready");
    } catch {
      setAiTips(null);
      setAiStatus("offline");
    }
  }, [
    onlinePersonalizationEnabled,
    onlinePersonalizationConsentAccepted,
    selectedMonthYear,
    currencySymbol,
    budgets,
    transactions,
    categoriesById,
  ]);

  useEffect(() => {
    void loadTips();
  }, [loadTips]);

  const statusInfo = useMemo(() => {
    if (!onlinePersonalizationEnabled || !onlinePersonalizationConsentAccepted) {
      return {
        badge: "Online personalization disabled",
        emoji: "📱",
        description: "Tips are computed from your own spending and stay on-device. Online personalization is optional.",
      };
    }
    if (!isAiProxyConfigured()) {
      return {
        badge: "Online personalization not configured",
        emoji: "⚙️",
        description: "Offline recommendations available. Secure online personalization is not configured yet.",
      };
    }
    if (aiStatus === "ready") {
      return {
        badge: "Online recommendations available",
        emoji: "✨",
        description: "Personalized suggestions when online · rules-based tips always available offline.",
      };
    }
    if (aiStatus === "loading") {
      return {
        badge: "Connecting to online personalization",
        emoji: "⏳",
        description: "Connecting to secure online personalization…",
      };
    }
    if (aiStatus === "offline") {
      return {
        badge: "Online service unavailable",
        emoji: "⚠️",
        description: "Online service unavailable. Offline recommendations available.",
      };
    }
    return {
      badge: "Online recommendations available",
      emoji: "✨",
      description: "Personalized suggestions when online.",
    };
  }, [aiStatus, onlinePersonalizationEnabled, onlinePersonalizationConsentAccepted]);

  const remainingMinor = offlineSnapshot.remainingMinor;
  const limitMinor = offlineSnapshot.limitMinor > 0 ? offlineSnapshot.limitMinor : Math.max(remainingMinor, 1);
  const spentMinor = offlineSnapshot.spentMinor;
  const dailyMinor = offlineSnapshot.dailyAllowanceMinor > 0
    ? offlineSnapshot.dailyAllowanceMinor
    : 1;
  const progressPercent = limitMinor <= 0
    ? 0
    : Math.min(100, Math.round((spentMinor / limitMinor) * 100));

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
          accessibilityLabel={`Status: ${statusInfo.badge}`}
          style={{
            backgroundColor: theme.colors.tint,
            borderRadius: theme.radii.chip,
            flexDirection: "row",
            gap: theme.spacing.xs,
            paddingHorizontal: theme.spacing.keyGap,
            paddingVertical: theme.spacing.compact,
          }}
        >
          <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.tiny }}>{statusInfo.emoji}</Text>
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.tiny }}>
            {statusInfo.badge}
          </Text>
        </View>
      </View>

      {/* Core offline financial calculations for monthly budget overview (retained) */}
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
            ? `after bills & goal · ~${formatMinor(dailyMinor, { currencySymbol, showCents: false })}/day for ${offlineSnapshot.daysLeftInMonth} day${offlineSnapshot.daysLeftInMonth === 1 ? "" : "s"} left`
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
            {statusInfo.description}
          </Text>
        </View>
        {aiStatus === "loading" ? (
          <ActivityIndicator accessibilityLabel="Loading personalized tips" color={theme.colors.primary} />
        ) : null}
      </View>

      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
        Suggestions for you
      </Text>

      {/* Online-only recommendations: No offline fallback advice */}
      {!onlinePersonalizationEnabled ? (
        <EmptyState
          actionLabel="Enable in Settings"
          emoji="📱"
          message="Online Personalization is turned off. Enable it in Settings to receive AI-powered budget tips and recommendations."
          onAction={() => navigation.navigate("Settings")}
          title="Online Personalization is off"
        />
      ) : !onlinePersonalizationConsentAccepted ? (
        <EmptyState
          actionLabel="Review Consent in Settings"
          emoji="📋"
          message="Review and accept Online Personalization consent in Settings to enable Gemini-powered budget recommendations."
          onAction={() => navigation.navigate("Settings")}
          title="Consent required"
        />
      ) : aiStatus === "loading" ? (
        <View style={{ alignItems: "center", gap: theme.spacing.md, paddingVertical: theme.spacing.xl }}>
          <ActivityIndicator accessibilityLabel="Loading personalized tips" color={theme.colors.primary} size="large" />
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body }}>
            Generating personalized budget tips…
          </Text>
        </View>
      ) : aiStatus === "offline" ? (
        <EmptyState
          actionLabel="Retry"
          emoji="⚠️"
          message="Could not reach the online personalization service. Check your connection or try again."
          onAction={() => void loadTips()}
          title="Recommendations unavailable"
        />
      ) : (!aiTips || aiTips.length === 0) ? (
        <EmptyState
          emoji="✨"
          message="Set budgets and log transactions to receive student-friendly AI suggestions."
          title="No tips yet"
        />
      ) : (
        aiTips.map((tip) => (
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
              {tip.amountMinor != null && (
                <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                  {tip.isEstimate ? "~" : ""}
                  {formatMinor(tip.amountMinor, { currencySymbol, showCents: false })}
                  {tip.category ? ` · ${tip.category}` : ""}
                </Text>
              )}
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
          Online: AI-personalized from an anonymized budget summary. Transaction notes and account details never leave this device.
        </Text>
      </View>
    </ScreenContainer>
  );
}
