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
| Task 12 CSV export + backup | Done — file-based share; backup v3 includes savings goals and account transfers, while the reader remains compatible with v2 |
| Task 13 CSV + Excel import | Done |
| Task 14 app lock (PIN + biometrics) | Implemented — attempt lockout plus device-authenticated PIN replacement and an explicit local-reset fallback; enrolled-device recovery remains release-gated |
| Task 15 Smart Tips offline rules | Done |
| Task 16 Smart Tips online Gemini (opt-in) | Secure Cloud Run proxy integration staged on main; requires Firebase App Check registration and Cloud Run deployment before live online suggestions work |
| Task 17 polish | Done |
| Task 18 release prep docs | Done (EAS project ID still placeholder until `eas init`) |
| Dark-mode theme consistency | Done (`useTheme` reads `themePreference`) |
| Student Eats Near Me | Done (interactive Google Maps + Google Places discovery via secure Cloud Run proxy + grounded AI recommendations) |
| Settings pickers + Dashboard polish | Done (theme/currency chips, empties, tips teaser) |
| Safe-to-Spend + Savings Goals | Done (pure calc + schema v2 + Goals screen); goal deadlines added |
| Entry quick chips + MoM trend | Done |
| Account-transfer backend | Done (schema v8, repository/store actions, balance semantics, delete guards, retry keys, backup/restore); visual flow is design-gated |

**v0.1.0** — Core complete + Student Eats + Goals / Safe-to-Spend.

### Current limits (reviewed 2026-10-07)

The current verification matrix is in [Verification and Evaluation.md](./Project%20Guidelines/Verification%20and%20Evaluation.md).
"Done" above describes implemented code, not a verified native release. Transaction backdating,
edit/delete, History search, and retry-safe imports are now implemented and covered by Jest/desktop
SQLite; live Figma and Android device acceptance remain separate.

| Gap | Impact |
|---|---|
| Native SQLCipher key/storage, PIN/biometric and notification lifecycles, phone/tablet layout and accessibility | API 35 emulator smoke verified encrypted-file header, locked startup/resume, Forgot PIN unavailable behavior, and reset confirmation UI. Enrolled recovery success, real deletion/interruption, physical phone/tablet, notifications, and assistive-technology acceptance remain **UNVERIFIED** |
| Current 52 mobile + 52 tablet state frames | Figma connector requires authentication; six feature groups are mapped to code, individual visual parity is **UNVERIFIED** |
| Dependency advisories | `npm audit --omit=dev` reports 53 advisories (32 high, 21 moderate, **0 critical**) on 2026-10-07 after overriding transitive `shell-quote` to patched `1.12.0`. `xlsx@0.20.3` is integrity-pinned from the vendor CDN; audit coverage of this tarball is incomplete. Review Expo-compatible updates before release |
| Transfer UI, reconciliation, and budget rollover | The transfer persistence/read-model backend is implemented, but no new visual flow was added before design review. Reconciliation and rollover remain planned; transaction CSV intentionally remains transaction-only while JSON backup v3 includes transfers |

The Jest suite covers domain, data-transfer, store, component, and static UI contracts. Native
device behavior still requires the Android verification path below.

## Quick start

1. Install **Node.js 22 LTS**, **JDK 21**, Android SDK (API 35 recommended).
2. `npm ci`
3. Copy `.env.example` → `.env` (optional PUBLIC Cloud Run URL only, after Firebase App Check is configured). Never bundle `GEMINI_API_KEY` in the app.
4. `npm test` (58 suites, 402 tests verified on 2026-10-19)
5. Start an emulator/device, then `npm run android` (dev client required — **Expo Go unsupported** because of SQLCipher). Scanning the Metro QR code in Expo Go shows an in-app explanation instead of a native-module crash. Default `npm run android` clears app data on the first active device (`com.example.financetracker` in the checked-in native project). Use `npm run android:preserve` to keep the local ledger across launches.

### Android Studio run button

The shared **MoneyMap: Run on Android** configuration uses Android Studio's bundled Shell Script runner with `node` as the interpreter. It executes the project-owned `scripts/run-android.mjs` launcher directly, without Bash, `~/.moneymap-env.sh`, an optional npm plugin, or a developer-specific home path.

1. Install Node 22 LTS and confirm `node --version` works in Android Studio's built-in terminal. If Node is managed by NVM on macOS/Linux, start Android Studio from a terminal after `nvm use 22`, or otherwise expose a stable `node` executable to GUI applications.
2. Open **Run → Edit Configurations**, select **MoneyMap: Run on Android**, and verify that its interpreter is `node` and its script is `scripts/run-android.mjs`.
3. Run `npm run android:check` once. It reports the selected Android SDK, compatible JDK, and local Expo CLI without starting an emulator or build.
4. Start an Android device or AVD, select **MoneyMap: Run on Android**, and press the green Run button.

The launcher discovers standard SDK/JDK locations on Windows, macOS, and Linux. Explicit `ANDROID_SDK_ROOT`, `ANDROID_HOME`, `MONEYMAP_JAVA_HOME`, and compatible `JAVA_HOME` values take priority.

Full walkthrough (Windows / macOS / Linux): **[index.html](./index.html)** or the [live Pages site](https://secretlyspy.github.io/TIP_MoneyMap-Finance-Tracker-App/). Also see [Tech Stack Setup Guide.md](./Project%20Guidelines/Tech%20Stack%20Setup%20Guide.md) and [docs/local-environment-audit-linux.md](./docs/local-environment-audit-linux.md).

## Architecture (short)

- Screens → Zustand stores → repositories → SQLCipher
- First-class account transfers move value between owned accounts without inflating income, expenses, or budgets
- Money is always **integer minor units** (`src/domain/services/money.js`)
- Theme tokens only (`src/theme/tokens.js`) — no hardcoded hex in screens
- Bare `useTheme()` reads `themePreference` from `uiStore` (shared components stay dark-mode correct)
- Outbound HTTPS only from `src/remote/*` (`smartTipsClient`, `placesClient`, `eatsTipsClient`) via stateless Cloud Run AI proxy.

## Online Personalization (Smart Tips & Student Eats)

- Unified setting in **Settings → Online Personalization** with explicit informed consent.
- Default **off**. When disabled, all optional AI and online discovery calls cease, and recommendation cards are hidden.
- Core financial calculations (budgets, balances, ledger, safe-to-spend) remain 100% **offline-first**.
- Online Smart Tips: Minimized, anonymized summary (period, minor totals, spend ratios, currency) sent through Cloud Run proxy to Google Gemini with Firebase App Check. No raw ledger rows, notes, or account IDs are ever sent.
- Structured output validation ensures realistic, grounded amounts (minor unit handling) adapted to Metro Manila student budgeting.

## Student Eats Near Me

- Real-time nearby restaurant discovery using **Google Places API (New)** via Cloud Run proxy.
- Interactive **Google Maps** integration using `react-native-maps` on Android with actual street tiles, synchronized markers, and external directions links.
- Location: Optional foreground location permission. When permission is denied or undetermined, discovery defaults cleanly to the fixed TIP Quezon City campus origin with clear labeling. Coordinates are never continuously tracked or sent to Gemini.
- Grounded AI Recommendations: Gemini recommendations reference only verified places returned by Google Places.
- Provider Compliance: In-memory session caching (10 min TTL) complies with Google Maps Platform Terms of Service without long-term offline database persistence.

## Release

- Package: `com.moneymap.financetracker`
- Privacy: [docs/privacy-policy.md](./docs/privacy-policy.md)
- Play Data safety: [docs/play-data-safety.md](./docs/play-data-safety.md)
- Checklist: [docs/release-checklist.md](./docs/release-checklist.md)

Replace the all-zero EAS `projectId` after `eas init` before cloud builds.
