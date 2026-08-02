import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { Pressable, View } from "react-native";

import { AppText as Text } from "../components/AppText";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import {
  budgetSummary,
  buildBudgetCards,
} from "../domain/services/financeView";
import { formatMinor } from "../domain/services/money";
import type { HomeStackParamList } from "../navigation/routes";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";
import { smartTips, type UiCopy } from "./fixtures";

type SmartTipsProps = NativeStackScreenProps<HomeStackParamList, "SmartTips">;

function formatCopy(copy: UiCopy, currencySymbol: string): string {
  if (typeof copy === "string") return copy;
  const prefix = copy.approximate === true ? "~" : "";
  return `${copy.before}${prefix}${formatMinor(copy.amountMinor, { currencySymbol, showCents: false })}${copy.after}`;
}

// Offline sample tips only — no network client. Hero numbers come from live budgets when available.
export function SmartTipsScreen({ navigation }: SmartTipsProps) {
  const theme = useTheme(useUiStore((state) => state.themePreference));
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const budgets = useFinanceStore((state) => state.budgets);
  const categories = useFinanceStore((state) => state.categories);
  const transactions = useFinanceStore((state) => state.transactions);
  const selectedMonthYear = useFinanceStore((state) => state.selectedMonthYear);

  const { categoriesById } = useMemo(() => mapsFromState({ accounts: [], categories }), [categories]);
  const cards = useMemo(
    () => buildBudgetCards(budgets, transactions, categoriesById, selectedMonthYear),
    [budgets, transactions, categoriesById, selectedMonthYear],
  );
  const summary = useMemo(() => budgetSummary(cards), [cards]);

  const weeklyLimitMinor = summary.limitMinor > 0 ? Math.max(1, Math.round(summary.limitMinor / 4)) : 150_000;
  const weeklySpentMinor =
    summary.limitMinor > 0
      ? Math.min(weeklyLimitMinor, Math.round(summary.spentMinor / 4))
      : 50_000;
  const weeklyLeftMinor = Math.max(0, weeklyLimitMinor - weeklySpentMinor);
  const dailyMinor = Math.max(1, Math.ceil(weeklyLeftMinor / 7));
  const progressPercent =
    weeklyLimitMinor <= 0 ? 0 : Math.min(100, Math.round((weeklySpentMinor / weeklyLimitMinor) * 100));

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
            Offline samples
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
          Left this week
        </Text>
        <Text style={{ color: theme.colors.onPrimary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.smartHeroAmount }}>
          {formatMinor(weeklyLeftMinor, { currencySymbol, showCents: false })}
        </Text>
        <Text style={{ color: theme.colors.heroMeta, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
          of {formatMinor(weeklyLimitMinor, { currencySymbol, showCents: false })} weekly budget · ~
          {formatMinor(dailyMinor, { currencySymbol, showCents: false })}/day remaining
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
            You've got {formatMinor(weeklyLeftMinor, { currencySymbol, showCents: false })} for the week
          </Text>
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
            That's ~{formatMinor(dailyMinor, { currencySymbol, showCents: false })}/day. Here are budget-friendly sample
            picks (no internet used).
          </Text>
        </View>
      </View>

      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
        Suggestions for you
      </Text>

      {smartTips.map((tip) => (
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
            <Text
              numberOfLines={1}
              style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}
            >
              {formatCopy(tip.title, currencySymbol)}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}
            >
              {formatCopy(tip.meta, currencySymbol)}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: theme.colors.tint,
              borderRadius: theme.radii.chip,
              height: theme.sizes.tag,
              justifyContent: "center",
              paddingHorizontal: theme.spacing.keyGap,
            }}
          >
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.tag }}>
              {formatCopy(tip.tag, currencySymbol)}
            </Text>
          </View>
        </SectionCard>
      ))}

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
          Offline-first: sample tips stay local. A future network client can personalize tips only with opt-in consent.
        </Text>
      </View>
    </ScreenContainer>
  );
}
