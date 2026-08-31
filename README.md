# MoneyMap Finance Tracker

An Android-first, offline-first personal finance tracker for **students**, built with React Native and Expo (JavaScript).

**Live docs (GitHub Pages):** https://secretlyspy.github.io/TIP_MoneyMap-Finance-Tracker-App/

The Pages site is the polished setup guide: root [`index.html`](./index.html) (self-contained HTML, OS tabs, SVG app previews, troubleshooting). A static README mirror is also generated at [`docs/index.html`](./docs/index.html) via `npm run build:readme-page`.

## Status

| Area | State |
|---|---|
| Tasks 1–9 core product | Done |
| Task 10 recurring catch-up | Done |
| Task 11 bill reminders (local notifications) | Done |
| Task 12 CSV export + backup | Done — file-based share; backup now includes savings goals (QA 2026-08-31) |
| Task 13 CSV + Excel import | Done |
| Task 14 app lock (PIN + biometrics) | Done — with attempt lockout; **no forgot-PIN recovery** |
| Task 15 Smart Tips offline rules | Done |
| Task 16 Smart Tips online Gemini (opt-in) | Done |
| Task 17 polish | Done |
| Task 18 release prep docs | Done (EAS project ID still placeholder until `eas init`) |
| Dark-mode theme consistency | Done (`useTheme` reads `themePreference`) |
| Student Eats Near Me | Done (Overpass/Nominatim + ranking + optional AI) |
| Settings pickers + Dashboard polish | Done (theme/currency chips, empties, tips teaser) |
| Safe-to-Spend + Savings Goals | Done (pure calc + schema v2 + Goals screen); goal deadlines added |
| Entry quick chips + MoM trend | Done |

**v0.1.0** — Core complete + Student Eats + Goals / Safe-to-Spend.

### Known gaps (QA audit 2026-08-31)

A full QA pass is recorded in [AI Documentation Notes.md](./AI%20Documentation%20Notes.md#qa-audit--2026-08-31).
"Done" above means the feature ships, not that it matches every expectation of a mainstream
expense tracker. Still missing:

| Gap | Impact |
|---|---|
| Transactions cannot be **backdated** (always `Date.now()`) or **edited** after saving | High — the biggest deviation from standard trackers |
| No transaction **search**; the History filter cycles one category per tap | Medium |
| Custom accounts are not selectable on Entry (chips are the three fixed types) | Medium |
| `xlsx@0.18.5` has two unpatched high-severity advisories and parses user files | **Security — action required** |
| No account transfers, budget rollover, import de-duplication, or "delete all data" reset | Low–medium |

Test coverage excludes `src/screens`, `src/store`, `src/components` and `src/navigation`.

## Quick start

1. Install **Node.js 22 LTS**, **JDK 21**, Android SDK (API 35 recommended).
2. `npm ci`
3. Copy `.env.example` → `.env` (optional `GEMINI_API_KEY` for online tips).
4. `npm test` (25 suites, 141 tests)
5. Start an emulator/device, then `npm run android` (dev client required — **Expo Go unsupported** because of SQLCipher).

Full walkthrough (Windows / macOS / Linux): **[index.html](./index.html)** or the [live Pages site](https://secretlyspy.github.io/TIP_MoneyMap-Finance-Tracker-App/). Also see [Tech Stack Setup Guide.md](./Tech%20Stack%20Setup%20Guide.md) and [docs/local-environment-audit-linux.md](./docs/local-environment-audit-linux.md).

## Architecture (short)

- Screens → Zustand stores → repositories → SQLCipher
- Money is always **integer minor units** (`src/domain/services/money.js`)
- Theme tokens only (`src/theme/tokens.js`) — no hardcoded hex in screens
- Bare `useTheme()` reads `themePreference` from `uiStore` (shared components stay dark-mode correct)
- Outbound HTTPS only from `src/remote/*` (`smartTipsClient`, `placesClient`, `eatsTipsClient`)

## Smart Tips privacy

- Default **off**. First enable shows a consent sheet.
- Offline: `deriveSmartTips` from local budgets/transactions.
- Online: anonymized summary only (period, totals, category ratios, currency) to Gemini.
- Never: raw transactions, notes, account names/IDs.

## Student Eats Near Me

- Dashboard → **Student Eats** (location permission only when opened).
- Places via Overpass (Nominatim fallback); ranked by distance + price + rating + student heuristics.
- Mini-map is on-device relative plot (no map SDK).
- Fallback origin: TIP Quezon City campus. Coordinates never persisted.
- Optional AI tips reuse Smart Tips consent; payload uses distance **bands** only (no lat/lon).

## Release

- Package: `com.moneymap.financetracker`
- Privacy: [docs/privacy-policy.md](./docs/privacy-policy.md)
- Play Data safety: [docs/play-data-safety.md](./docs/play-data-safety.md)
- Checklist: [docs/release-checklist.md](./docs/release-checklist.md)

Replace the all-zero EAS `projectId` after `eas init` before cloud builds.
