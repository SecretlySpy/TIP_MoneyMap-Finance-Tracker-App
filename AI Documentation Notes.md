# Module / File: App.tsx
## Function: App
- **Purpose**: Load the three bundled Roboto weights and compose the application safe-area provider after native splash readiness.
- **Inputs**:
  - None (`never`): This React component accepts no properties.
- **Outputs**: `React.JSX.Element | null` containing the application provider tree once fonts resolve.
- **Dependencies**: Expo Font, Expo Splash Screen, React `useEffect`, `SafeAreaProvider`, and `MoneyMapApp`.
- **Behavior**: Starts local font loading, keeps the native launch surface visible while pending, hides it after success or a recoverable font error, then renders the safe-area application tree.
- **Side Effects**: Coordinates the native splash surface and registers the local font assets.
- **DSA Used**: A two-condition readiness gate with O(1) transitions and O(1) state.
- **Data Analysis Notes**: Exactly three font weights are loaded to minimize bundle and startup overhead.
- **Responsive & Accessibility Notes**: Avoids a font flash before accessible content appears; safe-area values protect later screens.
- **Security Notes**: Font assets are bundled locally and require no network request.

# Module / File: App.tsx
## Function: MoneyMapApp
- **Purpose**: Compose the encrypted-database gate, adaptive navigation theme, status bar, and typed root navigator.
- **Inputs**:
  - None (`never`): This internal React component accepts no properties.
- **Outputs**: `React.JSX.Element` containing the protected application shell.
- **Dependencies**: React Navigation themes, Expo StatusBar, `DatabaseGate`, `RootNavigator`, and `useTheme`.
- **Behavior**: Selects the light or dark base navigation theme, replaces its semantic colors with MoneyMap tokens, waits for encrypted storage, and renders navigation.
- **Side Effects**: Subscribes indirectly to system color-scheme changes and navigation state.
- **DSA Used**: Constant-size object composition, O(1) time and O(1) auxiliary space.
- **Data Analysis Notes**: Theme mode is a binary classification; no finance record is processed.
- **Responsive & Accessibility Notes**: Status-bar contrast and navigation surfaces follow the current accessible palette.
- **Security Notes**: Navigation remains unavailable until SQLCipher initialization succeeds; this component performs no networking.

# Module / File: src/navigation/RootNavigator.tsx
## Function: MainTabs
- **Purpose**: Define the persistent typed four-tab shell with exact Figma icons and nested-route-aware visibility.
- **Inputs**:
  - None (`never`): This internal React component accepts no properties.
- **Outputs**: `React.JSX.Element` containing Home, History, Budgets, and Settings feature stacks.
- **Dependencies**: React Navigation bottom tabs, safe-area insets, `TabIcon`, nested stack navigators, and semantic theme tokens.
- **Behavior**: Resolves each tab's focused nested route, hides the bar only for Entry, applies safe-area-aware dimensions, and renders the fixed route order with local SVG icons.
- **Side Effects**: Registers and updates tab navigation state.
- **DSA Used**: Fixed keyed icon and route maps provide O(1) lookup and O(1) fixed storage.
- **Data Analysis Notes**: The tab height adds the measured bottom inset; no finance data is processed.
- **Responsive & Accessibility Notes**: React Navigation provides selected-tab semantics, readable labels, and inset-aware touch regions.
- **Security Notes**: Typed routes accept no financial payload or unvalidated identifier.

# Module / File: src/navigation/RootNavigator.tsx
## Function: RootNavigator
- **Purpose**: Place the app-lock frame above the four-tab application shell in a typed native stack.
- **Inputs**:
  - None (`never`): This exported React component accepts no properties.
- **Outputs**: `React.JSX.Element` containing Main and AppLock routes.
- **Dependencies**: React Navigation native stack, `RootStackParamList`, `MainTabs`, and `AppLockScreen`.
- **Behavior**: Creates a headerless main route and a fade-transition lock route above it.
- **Side Effects**: Registers native-stack navigation state with React Navigation.
- **DSA Used**: A fixed two-route stack, O(1) time and O(1) auxiliary space.
- **Data Analysis Notes**: No financial data is read or transformed.
- **Responsive & Accessibility Notes**: Native-stack transitions respect Android system navigation and accessibility settings.
- **Security Notes**: Static typed routes reduce accidental sensitive-data transfer; the visual lock is not yet a functional authorization boundary.

# Module / File: babel.config.js
## Function: babelConfig
- **Purpose**: Configure cached Expo and NativeWind source transformation.
- **Inputs**:
  - `api` (`Babel.ConfigAPI`): Babel configuration API used to enable deterministic caching.
- **Outputs**: Babel configuration object with Expo and NativeWind presets.
- **Dependencies**: `babel-preset-expo` and `nativewind/babel`.
- **Behavior**: Enables Babel configuration caching and returns the transforms needed for Expo and NativeWind JSX.
- **Side Effects**: Enables Babel's configuration cache for the build process.
- **DSA Used**: Constant-size object construction, O(1) time and O(1) space.
- **Data Analysis Notes**: No runtime or financial data is processed.
- **Responsive & Accessibility Notes**: Enables utility classes used to implement responsive and theme-aware views; it does not itself render UI.
- **Security Notes**: Uses static local presets and does not load secrets.

# Module / File: metro.config.js
## Function: module initialization
- **Purpose**: Extend Expo's Metro defaults with NativeWind CSS and React component transformation for exact SVG design exports.
- **Inputs**:
  - `__dirname` (`string`): Repository root used by Expo to locate project modules.
- **Outputs**: Metro configuration object exported through CommonJS.
- **Dependencies**: `expo/metro-config`, `nativewind/metro`, `react-native-svg-transformer`, and `global.css`.
- **Behavior**: Gets Expo defaults, moves SVG from asset extensions to source extensions, assigns the Expo-aware transformer, then wraps the result with NativeWind.
- **Side Effects**: Registers CSS and SVG transformations during bundling.
- **DSA Used**: Filters and extends a short extension list in O(e) time and O(e) copied space, where `e` is the number of Metro extensions.
- **Data Analysis Notes**: No application data is processed.
- **Responsive & Accessibility Notes**: Makes theme and responsive utilities available to screens; it has no direct accessibility behavior.
- **Security Notes**: References only repository-local CSS and dependency configuration.

# Module / File: src/theme/tokens.ts
## Function: static design token exports
- **Purpose**: Centralize exact immutable light/dark palettes, typography, spacing, geometry, radius, and shadow values from Figma.
- **Inputs**:
  - None (`never`): The module consists of constant declarations.
- **Outputs**: Read-only `palettes`, `spacing`, `radii`, `sizes`, `fonts`, `typeScale`, and `shadows` maps.
- **Dependencies**: None.
- **Behavior**: Exports literal token objects without runtime computation.
- **Side Effects**: None.
- **DSA Used**: Read-only keyed maps provide expected O(1) token lookup and O(1) fixed storage.
- **Data Analysis Notes**: Geometry preserves the 412 by 892 reference frame while `maxContentWidth` bounds wider layouts.
- **Responsive & Accessibility Notes**: Light and dark palettes use high-contrast foreground/background pairs; semantic warning, success, and danger colors must be paired with text or icons rather than used as the sole state signal.
- **Security Notes**: Contains no runtime configuration, credentials, or user data.

# Module / File: src/theme/tokens.ts
## Function: getTheme
- **Purpose**: Return one deterministic semantic theme for tests and non-hook consumers.
- **Inputs**:
  - `mode` (`"light" | "dark"`): Requested system appearance classification.
- **Outputs**: `MoneyMapTheme` referencing the matching immutable token set.
- **Dependencies**: Internal `themes` map.
- **Behavior**: Performs one keyed lookup and returns the preconstructed theme.
- **Side Effects**: None.
- **DSA Used**: Keyed map lookup, O(1) time and O(1) auxiliary space.
- **Data Analysis Notes**: Supports exact two-mode comparisons in automated tests.
- **Responsive & Accessibility Notes**: Both modes retain semantic foreground/background pairings and non-color state labels.
- **Security Notes**: Processes no user data.

# Module / File: src/theme/tokens.ts
## Function: useTheme
- **Purpose**: Select the semantic MoneyMap theme reactively from the operating-system color scheme.
- **Inputs**:
  - None (`never`): The hook reads the React Native appearance context.
- **Outputs**: `MoneyMapTheme` for light or dark mode.
- **Dependencies**: React Native `useColorScheme` and the internal `themes` map.
- **Behavior**: Maps only an explicit dark result to dark and treats all other values as light.
- **Side Effects**: Subscribes to appearance changes through React Native.
- **DSA Used**: One binary conditional and keyed lookup, O(1) time and space.
- **Data Analysis Notes**: Null or unknown system appearance safely falls back to light.
- **Responsive & Accessibility Notes**: Updates every token-based component during live system mode changes.
- **Security Notes**: Appearance is non-sensitive and never persisted or transmitted.

# Module / File: src/components/DatabaseGate.tsx
## Function: DatabaseGate
- **Purpose**: Block application navigation until the encrypted finance store finishes hydrating from SQLCipher.
- **Inputs**:
  - `children` (`ReactNode`): Application content rendered only after database readiness.
- **Outputs**: `React.JSX.Element | ReactNode` containing a loading state, retryable error state, or the protected child tree.
- **Dependencies**: React state/effects, React Native accessible primitives, SafeAreaView, `AppText`, semantic theme tokens, and `useFinanceStore.ensureHydrated`.
- **Behavior**: Starts finance-store hydration on mount or retry, ignores results after unmount, renders a progress state while pending, renders a generic recoverable error without exposing internals, and returns children when ready.
- **Side Effects**: Triggers database key loading, SQLCipher opening, migration, seeding, default accounts/categories ensure, and in-memory snapshot load through the finance store.
- **DSA Used**: A three-state finite-state machine with O(1) transitions and storage.
- **Data Analysis Notes**: Initialization attempts are counted only to retrigger the effect; row inspection happens inside the store, not this gate.
- **Responsive & Accessibility Notes**: Uses safe areas, centered bounded content, scalable local typography, an announced progress role, an alert role, and a 48-dp minimum retry target.
- **Security Notes**: Fails closed by withholding navigation and presents no key, file path, or raw database exception.

# Module / File: src/navigation/RootNavigator.tsx
## Function: HomeNavigator
- **Purpose**: Group Dashboard, Entry, and Smart Tips into the Home feature stack.
- **Inputs**:
  - None (`never`): This internal component accepts no properties.
- **Outputs**: `React.JSX.Element` containing three typed, headerless native-stack routes.
- **Dependencies**: React Navigation, `DashboardScreen`, `EntryScreen`, and `SmartTipsScreen`.
- **Behavior**: Orders the dashboard first, gives Entry a bottom-sheet-like transition, and registers Smart Tips after it.
- **Side Effects**: Registers Home navigation state.
- **DSA Used**: Fixed three-route sequence, O(1) time and space.
- **Data Analysis Notes**: No finance data is transformed.
- **Responsive & Accessibility Notes**: Native transitions preserve Android back behavior and screen-reader route announcements.
- **Security Notes**: Routes accept no record payload.

# Module / File: src/navigation/RootNavigator.tsx
## Function: HistoryNavigator
- **Purpose**: Isolate the History list in its typed feature stack.
- **Inputs**:
  - None (`never`): This internal component accepts no properties.
- **Outputs**: `React.JSX.Element` containing the headerless HistoryList route.
- **Dependencies**: React Navigation and `HistoryScreen`.
- **Behavior**: Registers one history route for later detail expansion.
- **Side Effects**: Registers History navigation state.
- **DSA Used**: Fixed one-route sequence, O(1) time and space.
- **Data Analysis Notes**: No finance data is transformed.
- **Responsive & Accessibility Notes**: Uses native-stack route focus semantics.
- **Security Notes**: Route parameters are statically undefined.

# Module / File: src/navigation/RootNavigator.tsx
## Function: BudgetsNavigator
- **Purpose**: Group budget overview and recurring-reminder frames under the Budgets tab.
- **Inputs**:
  - None (`never`): This internal component accepts no properties.
- **Outputs**: `React.JSX.Element` containing two headerless routes.
- **Dependencies**: React Navigation, `BudgetsScreen`, and `RecurringScreen`.
- **Behavior**: Registers budget overview as the initial route and recurring reminders as its nested destination.
- **Side Effects**: Registers Budgets navigation state.
- **DSA Used**: Fixed two-route sequence, O(1) time and space.
- **Data Analysis Notes**: No budget values are recalculated here.
- **Responsive & Accessibility Notes**: Native-stack back behavior returns users to their prior tab context.
- **Security Notes**: Route parameters contain no bill identifiers.

# Module / File: src/navigation/RootNavigator.tsx
## Function: SettingsNavigator
- **Purpose**: Isolate the Settings overview in its typed feature stack.
- **Inputs**:
  - None (`never`): This internal component accepts no properties.
- **Outputs**: `React.JSX.Element` containing the headerless SettingsOverview route.
- **Dependencies**: React Navigation and `SettingsScreen`.
- **Behavior**: Registers Settings as the initial and only feature route for this milestone.
- **Side Effects**: Registers Settings navigation state.
- **DSA Used**: Fixed one-route sequence, O(1) time and space.
- **Data Analysis Notes**: No settings are persisted here.
- **Responsive & Accessibility Notes**: Native route focus remains distinct from tab selection.
- **Security Notes**: The route accepts no credentials or secrets.

# Module / File: src/navigation/routes.ts
## Function: static route contracts
- **Purpose**: Define every supported stack and nested-tab parameter at compile time.
- **Inputs**:
  - None (`never`): This module declares TypeScript types only.
- **Outputs**: Home, History, Budgets, Settings, MainTab, and Root parameter-list types.
- **Dependencies**: React Navigation `NavigatorScreenParams`.
- **Behavior**: Composes nested navigator contracts while making every leaf route parameter explicitly undefined.
- **Side Effects**: None.
- **DSA Used**: Static keyed type maps; no runtime cost.
- **Data Analysis Notes**: The hierarchy has four tab branches and two root routes.
- **Responsive & Accessibility Notes**: Not a rendered module.
- **Security Notes**: Prevents accidental sensitive payloads from being passed through current route contracts.

# Module / File: src/domain/services/money.ts
## Function: assertMinorUnits
- **Purpose**: Reject monetary values that are not safe integer minor units.
- **Inputs**:
  - `value` (`number`): Candidate minor-unit amount.
- **Outputs**: `void` when valid; throws `RangeError` otherwise.
- **Dependencies**: `Number.isSafeInteger`.
- **Behavior**: Performs one safe-integer predicate and fails fast on violation.
- **Side Effects**: Throws for invalid input.
- **DSA Used**: Constant-time numeric validation, O(1) space.
- **Data Analysis Notes**: Enforces the exact-integer range bounded by JavaScript's safe-number limit.
- **Responsive & Accessibility Notes**: Not a UI function; callers surface validation copy.
- **Security Notes**: Prevents corrupted or imprecise currency values from crossing display boundaries.

# Module / File: src/domain/services/money.ts
## Function: groupThousands
- **Purpose**: Insert display separators into a whole-number digit string.
- **Inputs**:
  - `value` (`number`): Non-negative whole-unit value.
- **Outputs**: `string` with comma groups.
- **Dependencies**: JavaScript regular expressions.
- **Behavior**: Converts the integer to text and inserts a comma before each three-digit suffix group.
- **Side Effects**: None.
- **DSA Used**: Linear digit scan by the regular-expression engine, O(d) time and O(d) output space.
- **Data Analysis Notes**: `d` is the number of decimal digits.
- **Responsive & Accessibility Notes**: Produces conventional, screen-reader-readable grouped currency text.
- **Security Notes**: Receives only previously validated numeric data.

# Module / File: src/domain/services/money.ts
## Function: formatMinor
- **Purpose**: Convert exact integer minor units to localized MoneyMap display text without floating-point arithmetic.
- **Inputs**:
  - `amountMinor` (`number`): Signed safe integer in minor units.
  - `options` (`FormatMinorOptions`): Optional currency symbol, cent visibility, and sign policy.
- **Outputs**: `string` currency text.
- **Dependencies**: `assertMinorUnits` and `groupThousands`.
- **Behavior**: Splits absolute minor units using modulo and integer division, derives sign text, pads cents, and joins the display parts.
- **Side Effects**: Throws for unsafe or fractional input.
- **DSA Used**: O(d) time and O(d) output space for `d` digits.
- **Data Analysis Notes**: Cent values are always derived by modulo 100; no binary floating-point money math occurs.
- **Responsive & Accessibility Notes**: Keeps currency labels consistent across compact and large text roles.
- **Security Notes**: Strict validation prevents silent precision loss.

# Module / File: src/domain/services/money.ts
## Function: formatTransactionAmount
- **Purpose**: Prefix a positive stored amount with its domain-derived income or expense sign.
- **Inputs**:
  - `amountMinor` (`number`): Positive safe integer minor units.
  - `type` (`TransactionType`): `EXPENSE` or `INCOME`.
  - `showCents` (`boolean`): Whether two decimal digits are displayed.
- **Outputs**: `string` signed currency text.
- **Dependencies**: `assertMinorUnits` and `formatMinor`.
- **Behavior**: Rejects negative stored amounts, selects minus for expense or plus for income, then formats the magnitude.
- **Side Effects**: Throws for negative or unsafe stored input.
- **DSA Used**: O(d) formatting time and O(d) output space.
- **Data Analysis Notes**: Preserves the domain rule that stored transaction magnitudes are always positive.
- **Responsive & Accessibility Notes**: Sign and color can jointly communicate transaction direction.
- **Security Notes**: Prevents malformed sign encoding from being hidden in UI output.

# Module / File: src/domain/services/money.ts
## Function: parseDecimalToMinor
- **Purpose**: Parse keypad decimal text into exact integer minor units.
- **Inputs**:
  - `input` (`string`): Decimal digits with zero to two fractional digits.
- **Outputs**: `number` safe integer minor units.
- **Dependencies**: `assertMinorUnits`.
- **Behavior**: Trims and validates the text, splits whole and cents strings, pads cents to two digits, and combines them with integer arithmetic.
- **Side Effects**: Throws `RangeError` for malformed, over-precision, or unsafe input.
- **DSA Used**: O(d) validation and parsing time with O(d) temporary text.
- **Data Analysis Notes**: Empty whole text maps to zero and one fractional digit maps to tens of minor units.
- **Responsive & Accessibility Notes**: Enables deterministic validation copy for keypad users.
- **Security Notes**: Rejects injection-like or non-numeric text before domain use.

# Module / File: src/domain/services/money.ts
## Function: updateMoneyInput
- **Purpose**: Apply one bounded keypad action to the current decimal amount string.
- **Inputs**:
  - `current` (`string`): Existing normalized keypad text.
  - `key` (`string`): Digit, decimal point, or backspace glyph.
- **Outputs**: `string` next normalized input state.
- **Dependencies**: JavaScript string and regular-expression operations.
- **Behavior**: Handles deletion and decimal insertion, ignores unsupported keys, enforces two fractional digits, removes redundant leading zeros, and caps total length at 15.
- **Side Effects**: None.
- **DSA Used**: Bounded finite-state string transformation, O(d) time and O(d) output space.
- **Data Analysis Notes**: The length cap keeps later numeric conversion inside a practical safe range.
- **Responsive & Accessibility Notes**: Produces stable visible and spoken amount updates after each key.
- **Security Notes**: Unsupported input is ignored rather than evaluated.

# Module / File: src/store/uiStore.ts
## Function: useUiStore
- **Purpose**: Hold the three Figma preview switch states in a minimal in-memory Zustand store.
- **Inputs**:
  - Selector (`function`, optional through Zustand): Selects preview fields or setters.
- **Outputs**: Selected `UiPreviewState` values and update functions.
- **Dependencies**: Zustand `create`.
- **Behavior**: Initializes the visual fixture switches as enabled and replaces one Boolean field per setter call.
- **Side Effects**: Updates subscribed React components in memory only.
- **DSA Used**: Fixed record with O(1) field updates and O(s) subscriber notification managed by Zustand.
- **Data Analysis Notes**: States match the approved screenshots but are not product consent or persistent settings.
- **Responsive & Accessibility Notes**: Updates accessible switch checked states immediately.
- **Security Notes**: No value is persisted, transmitted, or used to authorize network access.

# Module / File: src/components/AppText.tsx
## Function: AppText
- **Purpose**: Normalize Android text line boxes to Figma metrics in one shared primitive.
- **Inputs**:
  - `props` (`TextProps`): Standard React Native text properties and optional style.
- **Outputs**: `React.JSX.Element` containing native Text with Android font padding disabled.
- **Dependencies**: React Native Text.
- **Behavior**: Forwards every property and prepends `includeFontPadding: false` to the style array.
- **Side Effects**: None.
- **DSA Used**: Constant-size property forwarding, O(1) time and space.
- **Data Analysis Notes**: Removes the observed 5–10 dp Android line-box drift.
- **Responsive & Accessibility Notes**: Retains all native text and screen-reader behavior while aligning visual baselines.
- **Security Notes**: Renders caller-provided text only; no HTML evaluation occurs.

# Module / File: src/components/BudgetCard.tsx
## Function: statusText
- **Purpose**: Derive explicit budget-state copy from a percentage and semantic state.
- **Inputs**:
  - `percent` (`number`): Reported budget percentage.
  - `state` (`BudgetState`): Normal, warning, or over.
- **Outputs**: `string` status label.
- **Dependencies**: None.
- **Behavior**: Appends approaching-limit or over-budget copy for the two exceptional states.
- **Side Effects**: None.
- **DSA Used**: Two constant-time branches, O(1) space.
- **Data Analysis Notes**: Keeps the reported percentage unclamped even when progress rendering clamps.
- **Responsive & Accessibility Notes**: Ensures color is not the only budget-state signal.
- **Security Notes**: Processes trusted numeric display data only.

# Module / File: src/components/BudgetCard.tsx
## Function: BudgetCard
- **Purpose**: Render one Figma budget summary with amount, accessible progress, and state copy.
- **Inputs**:
  - `props` (`BudgetCardProps`): Emoji, name, limit/spent minor units, percentage, and state.
- **Outputs**: `React.JSX.Element` containing a themed budget card.
- **Dependencies**: `SectionCard`, `ProgressBar`, `formatMinor`, `statusText`, and `useTheme`.
- **Behavior**: Selects a semantic state color, formats both integer amounts, renders progress, and labels the state.
- **Side Effects**: Subscribes to theme changes.
- **DSA Used**: Constant-time state selection plus O(d) amount formatting.
- **Data Analysis Notes**: Amount inputs stay in minor units; an over-budget percent remains visible above 100.
- **Responsive & Accessibility Notes**: Uses text plus color, a semantic progress bar, and a flexible name column.
- **Security Notes**: Does not write or transmit budget values.

# Module / File: src/components/Buttons.tsx
## Function: PrimaryButton
- **Purpose**: Render the approved full-width primary action and disabled state.
- **Inputs**:
  - `props` (`ButtonProps`): Child label, press callback, optional disabled flag, and view style.
- **Outputs**: `React.JSX.Element` containing an accessible Pressable.
- **Dependencies**: `AppText` and `useTheme`.
- **Behavior**: Applies deterministic 51 dp geometry, semantic colors, disabled opacity, and forwards the callback.
- **Side Effects**: Invokes `onPress` when enabled.
- **DSA Used**: Constant-size rendering, O(1) time and space.
- **Data Analysis Notes**: Disabled appearance is a binary state.
- **Responsive & Accessibility Notes**: Exposes button role and disabled state with a full-width touch target.
- **Security Notes**: Does not execute when disabled; action security remains the caller's responsibility.

# Module / File: src/components/Buttons.tsx
## Function: DashedButton
- **Purpose**: Render the approved secondary dashed-outline action.
- **Inputs**:
  - `props` (`ButtonProps`): Child label, press callback, optional disabled flag, and view style.
- **Outputs**: `React.JSX.Element` containing an accessible Pressable.
- **Dependencies**: `AppText` and `useTheme`.
- **Behavior**: Applies deterministic 44 dp geometry, dashed semantic outline, and disabled opacity.
- **Side Effects**: Invokes `onPress` when enabled.
- **DSA Used**: Constant-size rendering, O(1) time and space.
- **Data Analysis Notes**: No finance data is processed.
- **Responsive & Accessibility Notes**: Exposes button role and disabled state; full width supports compact screens.
- **Security Notes**: Does not itself mutate application state.

# Module / File: src/components/Chip.tsx
## Function: Chip
- **Purpose**: Render a selectable Figma filter or option chip.
- **Inputs**:
  - `props` (`ChipProps`): Child label, optional callback, selected flag, and style.
- **Outputs**: `React.JSX.Element` containing an accessible chip Pressable.
- **Dependencies**: `AppText` and `useTheme`.
- **Behavior**: Chooses surface, border, text color, and weight from selection; disables interaction when no callback exists.
- **Side Effects**: Invokes the optional callback.
- **DSA Used**: Constant-time binary style selection, O(1) space.
- **Data Analysis Notes**: Selection is represented by one Boolean.
- **Responsive & Accessibility Notes**: Exposes button role and selected state with at least 32 dp visible height plus parent spacing.
- **Security Notes**: Does not persist selection.

# Module / File: src/components/MonthChip.tsx
## Function: MonthChip
- **Purpose**: Render the shared month selector used by dashboard and budgets and advance the selected month-year.
- **Inputs**:
  - `label` (`string`, optional): Override label; defaults to `formatMonthChip(selectedMonthYear)`.
  - `onPress` (`function`, optional): Custom action; defaults to previous-month shift.
- **Outputs**: `React.JSX.Element` containing a labeled Pressable.
- **Dependencies**: `AppText`, `useTheme`, `useFinanceStore`, `formatMonthChip`, and `shiftMonthYear`.
- **Behavior**: Shows the store month label; tap shifts −1 month; long-press shifts +1 month when using the default handler.
- **Side Effects**: Updates `selectedMonthYear` in the finance store unless a custom `onPress` is supplied.
- **DSA Used**: Constant-size rendering and O(1) month arithmetic.
- **Data Analysis Notes**: Month keys stay `YYYY-MM` strings; no calendar library is required.
- **Responsive & Accessibility Notes**: Announces the selected month, exposes previous/next hints, and retains a compact pill shape.
- **Security Notes**: Does not parse free-form user date text.

# Module / File: src/components/ProgressBar.tsx
## Function: ProgressBar
- **Purpose**: Render a clamped themed progress bar while preserving an accessible numeric value.
- **Inputs**:
  - `percent` (`number`): Requested percentage.
  - `color` (`string`, optional): Semantic fill override.
- **Outputs**: `React.JSX.Element` containing track and fill Views.
- **Dependencies**: `useTheme`.
- **Behavior**: Clamps input to 0–100, exposes min/max/current values, and converts the result to a percentage width.
- **Side Effects**: Subscribes to theme changes.
- **DSA Used**: Constant-time numeric clamping, O(1) space.
- **Data Analysis Notes**: Negative and over-100 values cannot create invalid geometry.
- **Responsive & Accessibility Notes**: Uses an accessible progressbar role and scales to the parent width.
- **Security Notes**: Invalid visual range is safely bounded.

# Module / File: src/components/ScreenContainer.tsx
## Function: ScreenContainer
- **Purpose**: Apply shared safe areas, bounded responsive width, Figma padding, scrolling, and optional floating content.
- **Inputs**:
  - `props` (`ScreenContainerProps`): Children, optional content style/floating node, safe-bottom flag, scroll flag, and test ID.
- **Outputs**: `React.JSX.Element` containing a SafeAreaView and ScrollView or View.
- **Dependencies**: React Native layout primitives, SafeAreaView, and `useTheme`.
- **Behavior**: Builds one content-style array, selects scrolling or static layout, forwards test identity, and overlays an optional floating node.
- **Side Effects**: ScrollView tracks user scroll and keyboard tap behavior.
- **DSA Used**: Fixed-depth wrapper construction, O(1) time and auxiliary space.
- **Data Analysis Notes**: Content width is capped at 540 dp while filling compact screens.
- **Responsive & Accessibility Notes**: Handles top/side safe areas, optional bottom inset, compact-height scrolling, and hidden visual scrollbars.
- **Security Notes**: Does not inspect children or data.

# Module / File: src/components/SectionCard.tsx
## Function: SectionCard
- **Purpose**: Render one reusable Figma surface with consistent radius, padding, and optional elevation.
- **Inputs**:
  - `props` (`SectionCardProps`): Children, optional padding, shadow flag, and style.
- **Outputs**: `React.JSX.Element` containing a themed View.
- **Dependencies**: `useTheme`.
- **Behavior**: Applies semantic surface, radius, shadow color, optional shadow recipe, then caller style.
- **Side Effects**: Subscribes to theme changes.
- **DSA Used**: Constant-size style composition, O(1) time and space.
- **Data Analysis Notes**: One shared recipe removes card-by-card token drift.
- **Responsive & Accessibility Notes**: Caller provides semantic grouping when required; geometry adapts to its parent width.
- **Security Notes**: Contains no interaction or data access.

# Module / File: src/components/SpendingDonut.tsx
## Function: SpendingDonut
- **Purpose**: Draw the approved category donut and its exact legend from percentage segments.
- **Inputs**:
  - `segments` (`readonly DonutSegment[]`): Label, semantic color, and percentage per arc.
  - `totalMinor` (`number`): Center total in minor units.
- **Outputs**: `React.JSX.Element` containing an SVG chart, center label, and legend.
- **Dependencies**: React Native SVG, `formatMinor`, `AppText`, and `useTheme`.
- **Behavior**: Computes circumference once, accumulates prior percentages into dash offsets, renders each arc, formats the total, and maps the same segments to legend rows.
- **Side Effects**: None beyond theme subscription.
- **DSA Used**: Two linear passes over `s` segments, O(s) time and O(s) rendered nodes.
- **Data Analysis Notes**: Segment order determines clockwise arc and legend order; approved fixtures total 100 percent.
- **Responsive & Accessibility Notes**: The adjacent text legend communicates values independently of color and chart perception.
- **Security Notes**: Reads immutable local aggregate fixtures only.

# Module / File: src/components/TabIcon.tsx
## Function: TabIcon
- **Purpose**: Render one exact Figma tab SVG with active or inactive semantic color.
- **Inputs**:
  - `name` (`TabIconName`): Home, History, Budgets, or Settings.
  - `color` (`string`): React Navigation tint.
- **Outputs**: `React.JSX.Element` containing a 24 dp SVG component.
- **Dependencies**: Four committed Figma SVG assets and React Native SVG.
- **Behavior**: Performs a keyed component lookup and renders the chosen asset at the shared icon size.
- **Side Effects**: None.
- **DSA Used**: O(1) keyed lookup and O(1) fixed storage.
- **Data Analysis Notes**: Geometry remains unchanged; only the approved neutral stroke is replaced by theme tint during transformation.
- **Responsive & Accessibility Notes**: The parent tab supplies the accessible label and selected state.
- **Security Notes**: Assets are static local XML and contain no remote references.

# Module / File: src/components/Toggle.tsx
## Function: Toggle
- **Purpose**: Render and operate the exact 44 by 24 Figma switch as a semantic control.
- **Inputs**:
  - `enabled` (`boolean`): Current checked state.
  - `label` (`string`): Accessible control name.
  - `onChange` (`function`): Receives the inverted state.
- **Outputs**: `React.JSX.Element` containing a switch-role Pressable and track/knob Views.
- **Dependencies**: `useTheme`.
- **Behavior**: Announces checked state, inverts it on press, and aligns the knob to the matching edge.
- **Side Effects**: Calls `onChange`.
- **DSA Used**: Constant-time Boolean inversion and style selection, O(1) space.
- **Data Analysis Notes**: No tri-state ambiguity exists.
- **Responsive & Accessibility Notes**: Adds hit slop, switch role, label, and checked state independent of the visual track.
- **Security Notes**: The control itself grants no consent or permission.

# Module / File: src/components/TransactionRow.tsx
## Function: TransactionRow
- **Purpose**: Render a shared transaction row with category avatar, metadata, and signed amount.
- **Inputs**:
  - `props` (`TransactionRowProps`): Positive minor units, optional compact mode, emoji, metadata, title, and transaction type.
- **Outputs**: `React.JSX.Element` containing one accessible row.
- **Dependencies**: `formatTransactionAmount`, `AppText`, and `useTheme`.
- **Behavior**: Formats sign from type, chooses avatar size, truncates long copy, and colors income or expense semantically.
- **Side Effects**: None beyond theme subscription.
- **DSA Used**: O(d) amount formatting and constant-size layout.
- **Data Analysis Notes**: Amount direction comes from type rather than a stored negative magnitude.
- **Responsive & Accessibility Notes**: Announces title, metadata, and amount as one label; flexible text avoids horizontal overflow.
- **Security Notes**: Does not expose identifiers or notes beyond supplied display copy.

# Module / File: src/screens/fixtures.ts
## Function: static UI fixture exports
- **Purpose**: Provide immutable integer-money data matching every approved Figma screen and visual state.
- **Inputs**:
  - None (`never`): This module declares typed constants.
- **Outputs**: Dashboard totals, transactions, budget snapshots/cards, history groups, recurring bills, Smart Tips, and structured copy types.
- **Dependencies**: Finance domain and shared component prop types.
- **Behavior**: Exports deterministic arrays and records in the exact Figma ordering.
- **Side Effects**: None.
- **DSA Used**: Read-only ordered arrays with O(1) index access and O(n) mapping.
- **Data Analysis Notes**: Every monetary value, including incidental tip copy, originates as integer minor units.
- **Responsive & Accessibility Notes**: Copy is short enough for the approved compact layout and long rows truncate safely.
- **Security Notes**: Contains synthetic local data only and no real identifiers, notes, or credentials.

# Module / File: src/screens/DashboardScreen.tsx
## Function: DashboardScreen
- **Purpose**: Reproduce Figma dashboard frames 7:2 and 15:94 with live SQLCipher-backed aggregates.
- **Inputs**:
  - `navigation` (`NativeStackNavigationProp`): Home stack route controller.
- **Outputs**: `React.JSX.Element` containing balance hero, donut, budget status, transactions, and add FAB.
- **Dependencies**: Shared cards/chart/rows, integer-money formatting, `financeView` mappers, `useFinanceStore`, typed tab navigation, and `useTheme`.
- **Behavior**: Derives month totals, spending segments, top budgets, and recent rows from the store; shows empty copy when no data exists; routes see-all actions to their tabs; opens Entry from the FAB.
- **Side Effects**: Registers navigation actions and store/theme subscriptions.
- **DSA Used**: O(t + b + c) memoized aggregation over transactions, budgets, and categories.
- **Data Analysis Notes**: Lifetime balance uses starting balances plus all income minus all expense; month income/expense and donut use the selected `YYYY-MM`.
- **Responsive & Accessibility Notes**: Uses a scrolling bounded column, labeled FAB/buttons, semantic progress, text legend, safe areas, and automatic dark mode.
- **Security Notes**: Reads only local encrypted-store snapshots and performs no network access.

# Module / File: src/screens/EntryScreen.tsx
## Function: EntryScreen
- **Purpose**: Reproduce the three-step transaction-entry frame and persist integer-money rows to SQLCipher.
- **Inputs**:
  - `navigation` (`NativeStackNavigationProp`): Home stack controller for close/save return.
- **Outputs**: `React.JSX.Element` containing type tabs, amount, category/account options, keypad, and save action.
- **Dependencies**: React local state/memoization, `Chip`, `PrimaryButton`, money parse/update/format services, `financeView` helpers, `useFinanceStore.addTransaction`, and theme tokens.
- **Behavior**: Tracks transaction type, bounded amount text, category, and account type; loads categories/accounts from the store; disables save for zero/missing category/in-flight save; writes through `addTransaction` then navigates back.
- **Side Effects**: Inserts a transaction row, refreshes the finance snapshot, may show an alert on failure, and navigates back on success.
- **DSA Used**: O(d) keypad updates and parsing for at most 15 characters; O(c) category filter for the active type.
- **Data Analysis Notes**: Decimal text is never converted through floating point; stored amounts remain positive minor units.
- **Responsive & Accessibility Notes**: Type controls expose tab semantics, every option exposes selected state, keys have explicit labels, and compact heights scroll safely.
- **Security Notes**: Writes only validated local repository payloads; no free-form SQL or network call.

# Module / File: src/screens/HistoryScreen.tsx
## Function: HistoryBody
- **Purpose**: Render either grouped history or the approved explicit empty-history frame.
- **Inputs**:
  - `groups` (`readonly HistoryGroup[]`): Ordered day groups and UI transactions.
  - `onAdd` (`function`): Empty-state add action.
- **Outputs**: `React.JSX.Element` containing grouped cards or centered empty-state content.
- **Dependencies**: `SectionCard`, `TransactionRow`, `PrimaryButton`, and theme tokens.
- **Behavior**: Tests group length once; empty input produces illustration/copy/action, otherwise maps groups then transactions in source order.
- **Side Effects**: Calls `onAdd` only from the empty-state action.
- **DSA Used**: O(g + n) rendering time and O(g + n) nodes for groups and total transactions.
- **Data Analysis Notes**: Empty-state selection is deterministic from array length.
- **Responsive & Accessibility Notes**: Empty action is centered and labeled; populated rows announce combined transaction content.
- **Security Notes**: Renders caller-supplied display models without direct SQL access.

# Module / File: src/screens/HistoryScreen.tsx
## Function: HistoryScreen
- **Purpose**: Show month-scoped, filterable transaction history from the encrypted store.
- **Inputs**:
  - `navigation` (`NativeStackNavigationProp`): History stack controller used to reach Entry through the parent tabs.
- **Outputs**: `React.JSX.Element` containing title, filter chips, and `HistoryBody`.
- **Dependencies**: Typed tab navigation, `Chip`, `HistoryBody`, `groupHistory`, `useFinanceStore`, and theme tokens.
- **Behavior**: Filters store transactions by selected month, optional category name, and optional account type; groups by local day; cycles filters via chips; search icon clears filters.
- **Side Effects**: May navigate to Home/Entry and update `selectedMonthYear` / local filter state.
- **DSA Used**: O(t) filter plus O(t log t) sort/group for month transactions.
- **Data Analysis Notes**: Filters are AND-combined; empty month/filter results reuse the Figma empty frame.
- **Responsive & Accessibility Notes**: Filter chips are buttons, content scrolls below the fixed tab shell, and clear-filters control is labeled.
- **Security Notes**: Filtering stays on-device; no search text leaves the device.

# Module / File: src/screens/BudgetsScreen.tsx
## Function: BudgetsScreen
- **Purpose**: Show monthly budget overview with live spent/limit cards and one-tap add.
- **Inputs**:
  - `_props` (`BudgetsProps`): Typed route props reserved for later detail routes.
- **Outputs**: `React.JSX.Element` containing month header, summary strip, budget cards, and add action.
- **Dependencies**: `BudgetCard`, `MonthChip`, `DashedButton`, `buildBudgetCards`, `budgetSummary`, `useFinanceStore.addBudget`, `formatMinor`, and theme tokens.
- **Behavior**: Builds cards for the selected month, summarizes spent/limit, and adds the next unused expense category at a ₱5,000 default limit.
- **Side Effects**: May insert/update a budget row and refresh the finance snapshot.
- **DSA Used**: O(b + t) card construction and O(c) next-category scan.
- **Data Analysis Notes**: Percent/state use integer minor units; warning ≥80%, over ≥100%.
- **Responsive & Accessibility Notes**: Progress state is announced numerically and textually; the list scrolls on compact heights.
- **Security Notes**: Writes only repository-validated local budget payloads.

# Module / File: src/screens/SettingsScreen.tsx
## Function: SettingsRow
- **Purpose**: Render one icon-label-trailing-control row with optional navigation action.
- **Inputs**:
  - `props` (`SettingsRowProps`): Emoji, label, optional callback, and optional trailing node.
- **Outputs**: `React.JSX.Element` containing a flex row or Pressable row.
- **Dependencies**: `AppText` and `useTheme`.
- **Behavior**: Builds shared row content and wraps it in a deterministic Pressable only when an action exists.
- **Side Effects**: Invokes the optional callback.
- **DSA Used**: Constant-size rendering, O(1) time and space.
- **Data Analysis Notes**: Multiline labels preserve the exact Figma copy.
- **Responsive & Accessibility Notes**: Action rows expose a button role; flexible labels coexist with trailing values or switches.
- **Security Notes**: Does not execute inert placeholder actions or expose secret setting values.

# Module / File: src/screens/SettingsScreen.tsx
## Function: SettingsSection
- **Purpose**: Group titled settings rows in the approved card treatment.
- **Inputs**:
  - `children` (`ReactNode`): Ordered settings rows.
  - `title` (`string`): Uppercase section label.
- **Outputs**: `React.JSX.Element` containing title and surface card.
- **Dependencies**: `SectionCard`, `AppText`, and theme tokens.
- **Behavior**: Renders the label then places child rows in a zero-padding card.
- **Side Effects**: None.
- **DSA Used**: Fixed wrapper construction, O(1) excluding child rendering.
- **Data Analysis Notes**: Section order follows Security, Data, Preferences, and Smart Features.
- **Responsive & Accessibility Notes**: Visual grouping and headings improve scanability; callers provide row semantics.
- **Security Notes**: Does not read settings values.

# Module / File: src/screens/SettingsScreen.tsx
## Function: SettingsScreen
- **Purpose**: Reproduce the complete settings frame and route the three implemented nested visual destinations.
- **Inputs**:
  - `navigation` (`NativeStackNavigationProp`): Settings stack controller used to reach the root lock and sibling feature stacks.
- **Outputs**: `React.JSX.Element` containing four sections and the offline-first disclosure.
- **Dependencies**: Typed root/tab navigation, Zustand preview store, `Toggle`, settings helpers, and theme tokens.
- **Behavior**: Reads three preview Booleans, builds fixed rows, routes App Lock, Smart Tips, and Recurring, updates in-memory switches, and leaves unimplemented data actions inert.
- **Side Effects**: Updates ephemeral Zustand fields and may navigate.
- **DSA Used**: Fixed O(1) section and row rendering with O(s) Zustand subscriber notification.
- **Data Analysis Notes**: Enabled Smart Tips appearance mirrors Figma only and is not persistent consent.
- **Responsive & Accessibility Notes**: Rows, switches, headings, and summary disclosure are semantically labeled; the long screen scrolls.
- **Security Notes**: No export, backup, restore, import, network, biometric, or credential operation occurs.

# Module / File: src/screens/RecurringScreen.tsx
## Function: RecurringScreen
- **Purpose**: Show live recurring bills from SQLCipher and allow offline add without scheduling notifications.
- **Inputs**:
  - `navigation` (`NativeStackNavigationProp`): Budgets stack controller for back navigation.
- **Outputs**: `React.JSX.Element` containing reminder preview, upcoming bill cards, lead chips, and add action.
- **Dependencies**: `SectionCard`, `DashedButton`, `buildRecurringBills`, `nextReminderPreview`, `useFinanceStore.addRecurringBill`, `formatMinor`, and theme tokens.
- **Behavior**: Maps active rules to bill cards, derives the next-reminder preview, and adds a default monthly bill (₱1,000 / 7-day lead) under the Bills or first expense category.
- **Side Effects**: May insert a recurring rule and refresh the finance snapshot; no OS notification is scheduled.
- **DSA Used**: O(r log r) sort by next run plus O(r) render.
- **Data Analysis Notes**: Daily set-aside uses integer ceil division of amount by lead days.
- **Responsive & Accessibility Notes**: Preview is a summary, back is labeled, and the bill list scrolls without clipping the tab bar.
- **Security Notes**: Requests no notification permission; writes only local repository payloads.

# Module / File: src/screens/SmartTipsScreen.tsx
## Function: formatCopy
- **Purpose**: Convert structured Smart Tips copy containing integer money into one display string.
- **Inputs**:
  - `copy` (`UiCopy`): Plain string or before/amount/after object with optional approximation marker.
- **Outputs**: `string` rendered copy.
- **Dependencies**: `formatMinor`.
- **Behavior**: Returns plain strings unchanged or formats the embedded minor-unit amount between surrounding text.
- **Side Effects**: None.
- **DSA Used**: O(d) amount formatting and string concatenation.
- **Data Analysis Notes**: Even incidental price, savings, and comparison amounts preserve integer-money provenance.
- **Responsive & Accessibility Notes**: Produces ordinary readable text with explicit approximation glyph where required.
- **Security Notes**: Does not evaluate or interpolate executable content.

# Module / File: src/screens/SmartTipsScreen.tsx
## Function: SmartTipsScreen
- **Purpose**: Reproduce the hybrid Smart Tips frame as a strictly offline visual fixture.
- **Inputs**:
  - `navigation` (`NativeStackNavigationProp`): Home stack controller for back navigation.
- **Outputs**: `React.JSX.Element` containing weekly hero, tip preview, suggestion cards, and hybrid disclosure.
- **Dependencies**: Smart Tip fixtures, `formatCopy`, `formatMinor`, `SectionCard`, and theme tokens.
- **Behavior**: Formats weekly and daily allowance amounts, maps four local suggestions, renders the Figma online badge, and explains offline fallback; it makes no request.
- **Side Effects**: May navigate back; no network or persistence effect exists.
- **DSA Used**: O(t * d) rendering for `t` suggestions with short formatted money strings.
- **Data Analysis Notes**: Weekly values are fixed integer minor units; the 67 percent bar is visual fixture data.
- **Responsive & Accessibility Notes**: Back action is labeled, long content scrolls, tags truncate safely, and the footer is exposed as a summary.
- **Security Notes**: Contains no `fetch`, API key, raw transaction, note, or account identifier.

# Module / File: src/screens/AppLockScreen.tsx
## Function: AppLockScreen
- **Purpose**: Reproduce the PIN and fingerprint lock frame with bounded local feedback and no stored credential.
- **Inputs**:
  - `navigation` (`NativeStackNavigationProp`): Root controller used to leave the visual lock.
- **Outputs**: `React.JSX.Element` containing lock icon, PIN dots, 12-key pad, and fingerprint action.
- **Dependencies**: React local state, `ScreenContainer`, `AppText`, and theme tokens.
- **Behavior**: Starts with the two-digit Figma preview, deletes or appends up to four characters, and treats fingerprint actions as navigation back only.
- **Side Effects**: Updates local PIN preview state and may navigate back.
- **DSA Used**: O(p) string append/slice for `p <= 4`, effectively constant time and space.
- **Data Analysis Notes**: Four dot positions derive solely from current preview length.
- **Responsive & Accessibility Notes**: Announces entered digit count, labels delete/fingerprint keys, uses a non-scrolling bounded keypad, and respects safe areas.
- **Security Notes**: This is not an authentication boundary; no PIN hash, biometric prompt, or credential persistence exists yet.

# Module / File: src/domain/types.ts
## Function: static finance domain contracts
- **Purpose**: Define strict TypeScript contracts for all five persisted finance entities and their create/update inputs.
- **Inputs**:
  - None (`never`): The module contains type and immutable enum declarations.
- **Outputs**: `Account`, `Category`, `Transaction`, `Budget`, `RecurringRule`, enum unions, and typed input aliases.
- **Dependencies**: None.
- **Behavior**: Restricts account, transaction, and recurrence discriminator values while preserving all money and timestamps as JavaScript numbers representing integers.
- **Side Effects**: None.
- **DSA Used**: Immutable tuples provide O(1) fixed-space enum membership sources.
- **Data Analysis Notes**: Monetary fields represent minor units; signs are derived from transaction type and are never encoded in stored amounts.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Compile-time contracts reduce invalid states; repository validation still treats runtime values as untrusted.

# Module / File: src/db/sql.ts
## Function: OpSqliteDatabase.execute
- **Purpose**: Execute one parameterized statement through OP-SQLite and normalize its result to the application database contract.
- **Inputs**:
  - `query` (`string`): Repository-owned SQL statement.
  - `parameters` (`readonly SqlValue[]`): Values bound to SQL placeholders.
- **Outputs**: `Promise<SqlQueryResult>` containing rows, affected count, and an optional inserted identifier.
- **Dependencies**: OP-SQLite `DB.execute` and the internal `OpSqliteExecutor` adapter.
- **Behavior**: Copies the read-only parameter list, delegates execution, and returns only the normalized result fields used by the data layer.
- **Side Effects**: May read or mutate the open SQLite database according to the supplied statement.
- **DSA Used**: Parameter copying is O(p) time and space for p bound values; SQLite query complexity depends on the selected index or scan.
- **Data Analysis Notes**: SQLite scalar rows are preserved without floating-point money transformations.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Values are bound separately from SQL text; repositories own all query text.

# Module / File: src/db/sql.ts
## Function: OpSqliteDatabase.transaction
- **Purpose**: Execute a sequence of writes atomically through OP-SQLite.
- **Inputs**:
  - `work` (`(transaction: SqlExecutor) => Promise<void>`): Callback containing all statements in the atomic unit.
- **Outputs**: `Promise<void>` resolved only after commit.
- **Dependencies**: OP-SQLite `DB.transaction` and transaction executor.
- **Behavior**: Wraps the native transaction executor, awaits the callback, commits on success, and relies on OP-SQLite to roll back thrown failures.
- **Side Effects**: Atomically commits or rolls back database changes.
- **DSA Used**: O(q) adapter overhead for q statements, excluding SQLite query costs.
- **Data Analysis Notes**: Prevents partial multi-row and migration states.
- **Responsive & Accessibility Notes**: Not a UI module; asynchronous execution avoids intentional synchronous JavaScript-thread blocking.
- **Security Notes**: Atomic writes protect integrity during crashes and validation failures.

# Module / File: src/db/sql.ts
## Function: OpSqliteDatabase.close
- **Purpose**: Release the native OP-SQLite connection.
- **Inputs**:
  - None (`never`): Operates on the wrapped connection.
- **Outputs**: `void`.
- **Dependencies**: OP-SQLite `DB.close`.
- **Behavior**: Delegates connection closure exactly once per owning lifecycle.
- **Side Effects**: Releases native database resources.
- **DSA Used**: O(1) wrapper work.
- **Data Analysis Notes**: No rows are transformed.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Prevents stale native handles during failed initialization or explicit shutdown.

# Module / File: src/db/keyManager.ts
## Function: bytesToHex
- **Purpose**: Encode cryptographically random bytes as a fixed-width lowercase hexadecimal SQLCipher key string.
- **Inputs**:
  - `bytes` (`Uint8Array`): Random key material.
- **Outputs**: `string` containing two hexadecimal characters per input byte.
- **Dependencies**: JavaScript array mapping and string joining.
- **Behavior**: Converts each byte to base 16, pads it to two characters, and concatenates the sequence.
- **Side Effects**: None.
- **DSA Used**: Linear traversal, O(n) time and O(n) output space.
- **Data Analysis Notes**: Thirty-two bytes become exactly 64 hexadecimal characters without numeric precision loss.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Performs encoding only and never logs or persists the key.

# Module / File: src/db/keyManager.ts
## Function: getOrCreateDatabaseKey
- **Purpose**: Reuse a valid stored database key or generate and persist a new 256-bit key exactly once.
- **Inputs**:
  - `keyStore` (`DatabaseKeyStore`): Abstract secure read/write storage.
  - `randomBytes` (`RandomBytesProvider`): Cryptographically secure byte source.
- **Outputs**: `Promise<string>` containing a validated 64-character hexadecimal key.
- **Dependencies**: `bytesToHex` and injected secure-storage/random providers.
- **Behavior**: Reads the stored value, validates and returns it when present, otherwise requests exactly 32 bytes, validates the length, encodes, stores, and returns the new key.
- **Side Effects**: May write one key to the injected secure store.
- **DSA Used**: Regex validation is O(k); generation and encoding are O(k) for fixed k=32.
- **Data Analysis Notes**: A 256-bit source provides 2^256 possible keys before encoding.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Fails closed on malformed stored material and never replaces it, avoiding silent loss of access to an existing encrypted database.

# Module / File: src/db/databaseKey.ts
## Function: loadDatabaseKey
- **Purpose**: Bind the pure database-key manager to Expo Crypto and device-backed SecureStore.
- **Inputs**:
  - None (`never`): Uses module-scoped native adapters.
- **Outputs**: `Promise<string>` containing the SQLCipher key.
- **Dependencies**: Expo Crypto `getRandomBytesAsync`, Expo SecureStore, and `getOrCreateDatabaseKey`.
- **Behavior**: Reads or stores the key under a versioned name and a dedicated keychain service with device-only unlocked accessibility.
- **Side Effects**: Reads Android Keystore-backed preferences and may persist a new key.
- **DSA Used**: O(1) fixed-size key processing.
- **Data Analysis Notes**: Only 32 random bytes are stored; no financial record is placed in SecureStore.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: The key is device-local, excluded from Android backup, and never sourced from environment files.

# Module / File: src/db/seed.ts
## Function: seedInitialData
- **Purpose**: Insert the first-launch Cash account and twelve student-focused categories without creating duplicates.
- **Inputs**:
  - `database` (`SqlExecutor`): Executor already inside the initial migration transaction.
- **Outputs**: `Promise<void>` after all seed statements execute.
- **Dependencies**: `DEFAULT_STUDENT_CATEGORIES` and SQLite parameter binding.
- **Behavior**: Inserts Cash when no matching account exists, then performs a guarded insert for each default category keyed by name, type, and non-custom status.
- **Side Effects**: Inserts up to one account and twelve categories.
- **DSA Used**: Fixed 12-element iteration, O(k) statements and O(1) auxiliary space for k defaults.
- **Data Analysis Notes**: The distribution is seven expense and five income categories, reflecting student spending and income patterns.
- **Responsive & Accessibility Notes**: Not a UI module; category names are plain-language labels for later accessible UI.
- **Security Notes**: All seed values are bound parameters; the routine runs atomically with schema version 1 and does not rerun on ordinary launches.

# Module / File: src/db/schema.ts
## Function: getSchemaVersion
- **Purpose**: Read and validate SQLite's current user schema version.
- **Inputs**:
  - `database` (`SqlExecutor`): Open database executor.
- **Outputs**: `Promise<number>` containing a safe integer version.
- **Dependencies**: `PRAGMA user_version`, `readInteger`, and `DataIntegrityError`.
- **Behavior**: Executes the pragma, requires a result row, and rejects malformed version data.
- **Side Effects**: Reads connection metadata only.
- **DSA Used**: O(1) query and validation work.
- **Data Analysis Notes**: Schema versions are monotonic non-fractional integers.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Rejects malformed metadata instead of assuming a compatible schema.

# Module / File: src/db/schema.ts
## Function: migrateDatabase
- **Purpose**: Configure SQLite safely and apply every pending ordered migration atomically.
- **Inputs**:
  - `database` (`SqlDatabase`): Open SQLCipher-backed database connection.
- **Outputs**: `Promise<MigrationResult>` containing previous/current versions and the applied version list.
- **Dependencies**: SQLite pragmas, the immutable migration registry, `seedInitialData`, `getSchemaVersion`, and transaction support.
- **Behavior**: Enables foreign keys, busy timeout, WAL, full synchronous durability, and untrusted-schema mode; rejects future schemas; filters pending migrations; applies each with its version pragma in one transaction; then runs a foreign-key integrity check.
- **Side Effects**: Creates five strict tables, indexes, and seed rows on a fresh database; updates `user_version`.
- **DSA Used**: O(m+s) migration orchestration for m pending migrations and s statements; indexed schema operations use SQLite B-trees.
- **Data Analysis Notes**: Version 1 enforces positive minor-unit values, valid month strings, booleans, enums, category/type consistency, and unique category-month budgets.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Uses atomic migrations, foreign keys, strict tables, full durability, fixed SQL, parameterized seed values, and fails on a newer schema.

# Module / File: src/db/client.ts
## Function: initializeDatabase
- **Purpose**: Create or reuse the single initialized SQLCipher database promise for the application process.
- **Inputs**:
  - None (`never`): Uses fixed database configuration.
- **Outputs**: `Promise<SqlDatabase>` containing the ready application connection.
- **Dependencies**: OP-SQLite SQLCipher capability, `loadDatabaseKey`, `OpSqliteDatabase`, and `migrateDatabase`.
- **Behavior**: Returns an in-flight or ready singleton when available; otherwise verifies SQLCipher, loads the key, opens the database, migrates it, closes on failure, clears the failed singleton for retry, and returns the connection on success.
- **Side Effects**: Reads secure key material, opens `moneymap.sqlite`, and may migrate/seed it.
- **DSA Used**: Promise memoization provides O(1) connection lookup and coalesces concurrent callers.
- **Data Analysis Notes**: The database is the sole on-device source of truth; no rows are sent elsewhere.
- **Responsive & Accessibility Notes**: Its pending/error state is represented accessibly by `DatabaseGate`.
- **Security Notes**: Refuses to run on a build not compiled with SQLCipher and never falls back to plaintext SQLite.

# Module / File: src/db/client.ts
## Function: closeDatabase
- **Purpose**: Clear and close the process-wide database connection when explicit shutdown is required.
- **Inputs**:
  - None (`never`): Operates on the module singleton.
- **Outputs**: `Promise<void>`.
- **Dependencies**: The initialized database promise and `SqlDatabase.close`.
- **Behavior**: Clears the singleton first, returns when absent, otherwise awaits initialization and closes the resulting connection.
- **Side Effects**: Releases the SQLCipher connection.
- **DSA Used**: O(1) state and wrapper work.
- **Data Analysis Notes**: Does not delete or transform stored data.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Clearing the reference prevents reuse of a closed native handle.

# Module / File: src/db/validation.ts
## Function: validation and row-decoding helpers
- **Purpose**: Enforce runtime input invariants and decode SQLite rows without unchecked domain casts.
- **Inputs**:
  - `value/row` (`number | string | object | SqlRow`): Runtime-untrusted repository input or database output.
  - `fieldName/columnName` (`string`): Diagnostic field identifier.
- **Outputs**: `void`, a validated primitive, boolean, nullable string, or enum value depending on the helper.
- **Dependencies**: `Number.isSafeInteger`, regular expressions, immutable enum tuples, and `DataIntegrityError`.
- **Behavior**: `assertSafeInteger`, `assertPositiveInteger`, `assertNonNegativeInteger`, `assertNonBlank`, `assertColorHex`, `assertMonthYear`, and `assertOneOf` reject invalid inputs; `readInteger`, `readString`, `readNullableString`, `readBoolean`, and `readEnum` reject corrupt rows.
- **Side Effects**: None beyond throwing typed errors.
- **DSA Used**: Constant-time scalar checks except O(n) regex/string or short enum scans.
- **Data Analysis Notes**: Safe-integer checks preserve exact minor units within JavaScript's ±(2^53−1) range.
- **Responsive & Accessibility Notes**: Not a UI module; messages are developer diagnostics rather than end-user copy.
- **Security Notes**: Provides defense in depth against malformed imports, unsafe money values, unsupported discriminators, and corrupt database rows.

# Module / File: src/db/repositories/shared.ts
## Function: insertRow, updateRow, deleteRow, findRowById, listRows, requireCreatedEntity
- **Purpose**: Centralize transactional writes and indexed common CRUD mechanics for the five typed repositories.
- **Inputs**:
  - `database` (`SqlDatabase`): Active application connection.
  - `table` (`RepositoryTable`): Compile-time allowlisted table name.
  - `id/statement/parameters/assignments` (`number | string | SqlValue[] | UpdateAssignment[]`): Operation-specific trusted metadata and bound values.
- **Outputs**: Inserted ID, update/delete boolean, row/null, row list, or required entity depending on the helper.
- **Dependencies**: `SqlDatabase`, validation helpers, and `DataIntegrityError`.
- **Behavior**: Runs every mutation in a transaction, verifies inserted IDs, builds update clauses only from repository-owned assignments, binds values, performs primary-key reads and ordered lists, and rejects impossible post-insert disappearance.
- **Side Effects**: Reads or mutates exactly one allowlisted table per call.
- **DSA Used**: Dynamic update construction is O(f) for f changed fields; ID access is expected O(log n); full lists are O(n).
- **Data Analysis Notes**: Affected-row counts are converted into explicit booleans and never used as money.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: User values are always placeholders, table names are a closed union, and empty/unsafe updates fail before SQL execution.

# Module / File: src/db/repositories/accountRepository.ts
## Function: AccountRepository.create
- **Purpose**: Validate and persist one typed account.
- **Inputs**:
  - `account` (`NewAccount`): Name, account type, integer starting balance, and archive state.
- **Outputs**: `Promise<Account>` containing the inserted row and generated ID.
- **Dependencies**: Account validation, `insertRow`, `getById`, and row decoder.
- **Behavior**: Validates nonblank name, supported type, and safe integer balance; inserts in a transaction; then reads and returns the created entity.
- **Side Effects**: Inserts one `accounts` row.
- **DSA Used**: O(1) validation and insert plus expected O(log n) primary-key read.
- **Data Analysis Notes**: Starting balance may be signed but must remain an exact safe integer in minor units.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Uses bound parameters and database enum/boolean checks.

# Module / File: src/db/repositories/accountRepository.ts
## Function: AccountRepository.getById
- **Purpose**: Retrieve and decode one account by primary key.
- **Inputs**:
  - `id` (`number`): Positive safe-integer account ID.
- **Outputs**: `Promise<Account | null>`.
- **Dependencies**: `findRowById` and strict account row decoder.
- **Behavior**: Validates the ID, performs a parameterized lookup, and maps a found row to camel-case domain fields.
- **Side Effects**: Reads the database.
- **DSA Used**: Expected O(log n) B-tree lookup and O(1) decoding.
- **Data Analysis Notes**: SQLite 0/1 archive state is converted to boolean.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Rejects corrupt enum, integer, text, or boolean columns.

# Module / File: src/db/repositories/accountRepository.ts
## Function: AccountRepository.list
- **Purpose**: Return every account in stable ID order.
- **Inputs**:
  - None (`never`): Uses the repository connection.
- **Outputs**: `Promise<Account[]>`.
- **Dependencies**: `listRows` and strict account row decoder.
- **Behavior**: Reads all account rows ordered by ascending ID and decodes each.
- **Side Effects**: Reads the database.
- **DSA Used**: O(n) time and output space for n accounts.
- **Data Analysis Notes**: Includes archived accounts so callers can decide presentation/filtering.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Performs no interpolation and validates every returned row.

# Module / File: src/db/repositories/accountRepository.ts
## Function: AccountRepository.update
- **Purpose**: Apply a validated partial update to one account.
- **Inputs**:
  - `id` (`number`): Positive account ID.
  - `patch` (`AccountUpdate`): Defined account fields to change.
- **Outputs**: `Promise<Account | null>` containing the updated row or null when absent.
- **Dependencies**: Field validators, allowlisted assignments, `updateRow`, and `getById`.
- **Behavior**: Converts only defined fields to fixed SQL columns, validates each value, writes atomically, and reloads a matched row.
- **Side Effects**: Updates at most one `accounts` row.
- **DSA Used**: O(f) patch construction for at most four fields plus expected O(log n) write/read.
- **Data Analysis Notes**: Preserves exact integer starting balances.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Empty/undefined-only patches fail and values remain parameterized.

# Module / File: src/db/repositories/accountRepository.ts
## Function: AccountRepository.delete
- **Purpose**: Delete an unreferenced account by ID.
- **Inputs**:
  - `id` (`number`): Positive account ID.
- **Outputs**: `Promise<boolean>` indicating whether one row was deleted.
- **Dependencies**: `deleteRow` and SQLite foreign keys.
- **Behavior**: Runs a parameterized transactional delete and returns true only for one affected row.
- **Side Effects**: Deletes one account when no transaction or recurring rule references it.
- **DSA Used**: Expected O(log n) primary-key deletion.
- **Data Analysis Notes**: Does not cache balances or derived values.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Foreign-key `RESTRICT` prevents orphaned financial rows.

# Module / File: src/db/repositories/categoryRepository.ts
## Function: CategoryRepository.create
- **Purpose**: Validate and persist one predefined or custom category.
- **Inputs**:
  - `category` (`NewCategory`): Label, icon ID, color, transaction type, and custom flag.
- **Outputs**: `Promise<Category>` containing the inserted row.
- **Dependencies**: Category validators, `insertRow`, and `getById`.
- **Behavior**: Validates nonblank text, `#RRGGBB` color, and supported type; inserts transactionally; reloads the row.
- **Side Effects**: Inserts one `categories` row.

# Module / File: scripts/build-readme-page.mjs
## Function: buildReadmePage
- **Purpose**: Convert the repository README into a standalone static HTML landing page under `docs/index.html`.
- **Inputs**:
  - None (`never`): The script reads `README.md` and repository Git metadata from the workspace.
- **Outputs**: Writes `docs/index.html` containing rendered HTML and inline styling.
- **Dependencies**: Node built-in modules `fs/promises`, `path`, `url`, `child_process`, and `util`.
- **Behavior**: Reads README markdown, converts headings, lists, code spans, links, and paragraphs into HTML, builds a styled single-page document, and writes it to the `docs` directory.
- **Side Effects**: Creates or updates the generated static page at `docs/index.html`.
- **DSA Used**: Streaming line-by-line markdown parsing with O(n) time and O(n) output for input size n.
- **Data Analysis Notes**: Relative markdown links are rewritten to GitHub blob URLs when possible, preserving documentation references for the static page.
- **Responsive & Accessibility Notes**: The generated page includes responsive typography, readable spacing, and link focus states for browser users.
- **Security Notes**: Markdown text is escaped before HTML injection, avoiding raw HTML injection from the source file.

# Module / File: docs/index.html
## Function: static landing page
- **Purpose**: Serve the repository README as a static GitHub Pages landing page.
- **Inputs**:
  - None: This is a generated static HTML document.
- **Outputs**: Browser-rendered project documentation.
- **Dependencies**: None at runtime; content is generated by `scripts/build-readme-page.mjs`.
- **Behavior**: Presents README content with a simple responsive layout and inline CSS.
- **Side Effects**: None.
- **DSA Used**: None.
- **Data Analysis Notes**: The page is render-only and mirrors the top-level README structure.
- **Responsive & Accessibility Notes**: Uses fluid headings, container padding, accessible link contrast, and monospaced inline code styling.
- **Security Notes**: Generated HTML contains escaped source content, preventing markdown-sourced HTML from executing.

# Module / File: docs/.nojekyll
## Function: disableJekyllBuild
- **Purpose**: Ensure GitHub Pages serves the `docs` directory assets exactly as written without Jekyll preprocessing.
- **Inputs**: None.
- **Outputs**: A marker file recognized by GitHub Pages.
- **Dependencies**: None.
- **Behavior**: Serves only as a repository marker; no runtime behavior.
- **Side Effects**: Prevents GitHub Pages from applying Jekyll processing to the `docs` folder.
- **DSA Used**: None.
- **Data Analysis Notes**: Not applicable.
- **Responsive & Accessibility Notes**: Not applicable.
- **Security Notes**: Not applicable.
- **DSA Used**: O(1) fixed-field validation and expected O(log n) lookup.
- **Data Analysis Notes**: Category type partitions later income and expense aggregation.
- **Responsive & Accessibility Notes**: Stores icon/color metadata; later UI must not use color as the sole state signal.
- **Security Notes**: Uses bound values and strict database checks.

# Module / File: src/db/repositories/categoryRepository.ts
## Function: CategoryRepository.getById
- **Purpose**: Retrieve and decode one category by primary key.
- **Inputs**:
  - `id` (`number`): Positive category ID.
- **Outputs**: `Promise<Category | null>`.
- **Dependencies**: `findRowById` and category row decoder.
- **Behavior**: Performs an indexed parameterized lookup and validates all returned fields.
- **Side Effects**: Reads the database.
- **DSA Used**: Expected O(log n) lookup and O(1) decoding.
- **Data Analysis Notes**: Converts `is_custom` from 0/1 to boolean.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Rejects malformed colors, types indirectly on write, and corrupt row primitives on read.

# Module / File: src/db/repositories/categoryRepository.ts
## Function: CategoryRepository.list
- **Purpose**: Return every category in stable ID order.
- **Inputs**:
  - None (`never`): Uses the repository connection.
- **Outputs**: `Promise<Category[]>`.
- **Dependencies**: `listRows` and category row decoder.
- **Behavior**: Reads all categories and decodes each row.
- **Side Effects**: Reads the database.
- **DSA Used**: O(n) time and output space.
- **Data Analysis Notes**: Returns both income and expense partitions and both default/custom rows.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Validates each persisted discriminator before exposing it.

# Module / File: src/db/repositories/categoryRepository.ts
## Function: CategoryRepository.update
- **Purpose**: Apply a validated partial update to one category.
- **Inputs**:
  - `id` (`number`): Positive category ID.
  - `patch` (`CategoryUpdate`): Defined fields to change.
- **Outputs**: `Promise<Category | null>`.
- **Dependencies**: Category validators, `updateRow`, composite category/type foreign keys, and `getById`.
- **Behavior**: Maps defined fields to allowlisted columns, validates them, writes atomically, and reloads the row.
- **Side Effects**: Updates at most one category.
- **DSA Used**: O(f) patch construction for at most five fields plus indexed write/read.
- **Data Analysis Notes**: A type change is rejected by SQLite when it would conflict with existing transaction or recurrence types.
- **Responsive & Accessibility Notes**: Updated icon/color metadata is available to later UI.
- **Security Notes**: Composite foreign keys preserve category/type consistency across dependent rows.

# Module / File: src/db/repositories/categoryRepository.ts
## Function: CategoryRepository.delete
- **Purpose**: Delete an unused category by ID.
- **Inputs**:
  - `id` (`number`): Positive category ID.
- **Outputs**: `Promise<boolean>`.
- **Dependencies**: `deleteRow` and SQLite foreign keys.
- **Behavior**: Deletes transactionally and reports whether a row existed.
- **Side Effects**: Deletes one unreferenced category.
- **DSA Used**: Expected O(log n) primary-key deletion.
- **Data Analysis Notes**: Seed categories are not specially protected and remain user-removable when unused.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: `RESTRICT` prevents deletion when transactions, budgets, or recurring rules depend on the category.

# Module / File: src/db/repositories/transactionRepository.ts
## Function: TransactionRepository.create
- **Purpose**: Validate and persist one expense or income transaction using integer minor units.
- **Inputs**:
  - `transaction` (`NewTransaction`): Amount, type, category/account IDs, epoch date, note, and optional recurrence link.
- **Outputs**: `Promise<Transaction>` containing the inserted row.
- **Dependencies**: Transaction validators, `insertRow`, composite category/type foreign key, and `getById`.
- **Behavior**: Requires a positive safe amount and IDs, a supported type, a safe timestamp, and a positive optional rule ID; inserts atomically and reloads the row.
- **Side Effects**: Inserts one `transactions` row.
- **DSA Used**: O(1) validation and expected O(log n) index work.
- **Data Analysis Notes**: Amount is always positive; expense/income sign is derived from `type`.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Parameter binding prevents injection and composite foreign keys prevent category/type mismatch.

# Module / File: src/db/repositories/transactionRepository.ts
## Function: TransactionRepository.getById
- **Purpose**: Retrieve and decode one transaction by primary key.
- **Inputs**:
  - `id` (`number`): Positive transaction ID.
- **Outputs**: `Promise<Transaction | null>`.
- **Dependencies**: `findRowById` and strict transaction row decoder.
- **Behavior**: Performs an indexed lookup, decodes all integer/enum/text fields, and preserves nullable note/rule values.
- **Side Effects**: Reads the database.
- **DSA Used**: Expected O(log n) lookup and O(1) decoding.
- **Data Analysis Notes**: No money division or floating-point operation occurs.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Corrupt unsafe integers or discriminator values are rejected.

# Module / File: src/db/repositories/transactionRepository.ts
## Function: TransactionRepository.list
- **Purpose**: Return every transaction in stable ID order for current repository-contract use.
- **Inputs**:
  - None (`never`): Uses the repository connection.
- **Outputs**: `Promise<Transaction[]>`.
- **Dependencies**: `listRows` and transaction row decoder.
- **Behavior**: Reads all rows and validates each domain mapping.
- **Side Effects**: Reads the database.
- **DSA Used**: O(n) time and output space.
- **Data Analysis Notes**: Task 5/6 will add date ordering, filters, search, and pagination-oriented queries.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Does not expose raw SQL row objects.

# Module / File: src/db/repositories/transactionRepository.ts
## Function: TransactionRepository.update
- **Purpose**: Apply a validated partial update to one transaction.
- **Inputs**:
  - `id` (`number`): Positive transaction ID.
  - `patch` (`TransactionUpdate`): Defined fields to change.
- **Outputs**: `Promise<Transaction | null>`.
- **Dependencies**: Transaction validators, `updateRow`, database constraints, and `getById`.
- **Behavior**: Validates and maps defined fields, preserves explicit null for note/rule link, updates atomically, and reloads a matched row.
- **Side Effects**: Updates at most one transaction.
- **DSA Used**: O(f) patch construction for at most seven fields plus indexed write/read.
- **Data Analysis Notes**: Money remains positive safe integer minor units after updates.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Foreign keys and checks reject invalid references, type mismatches, and nonpositive amounts.

# Module / File: src/db/repositories/transactionRepository.ts
## Function: TransactionRepository.delete
- **Purpose**: Delete one transaction by ID.
- **Inputs**:
  - `id` (`number`): Positive transaction ID.
- **Outputs**: `Promise<boolean>`.
- **Dependencies**: `deleteRow`.
- **Behavior**: Executes an atomic parameterized delete and reports whether one row existed.
- **Side Effects**: Deletes at most one transaction; future derived balances change automatically because they are queried, not stored.
- **DSA Used**: Expected O(log n) primary-key deletion.
- **Data Analysis Notes**: No cached balance requires repair.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Deletes only the requested bound ID.

# Module / File: src/db/repositories/budgetRepository.ts
## Function: BudgetRepository.create
- **Purpose**: Validate and persist one monthly expense-category budget.
- **Inputs**:
  - `budget` (`NewBudget`): Expense category ID, `YYYY-MM` period, and positive minor-unit limit.
- **Outputs**: `Promise<Budget>` containing the inserted row.
- **Dependencies**: Format/integer validators, expense-category lookup, `insertRow`, uniqueness constraint, and `getById`.
- **Behavior**: Requires a positive category ID and limit, validates the calendar-month string, verifies an existing expense category, inserts atomically, and reloads the row.
- **Side Effects**: Inserts one `budgets` row.
- **DSA Used**: Expected O(log n) category lookup and unique-index insert.
- **Data Analysis Notes**: Limits are exact minor units and keyed to calendar months.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Rejects income/missing categories and relies on a unique `(category_id, month_year)` index against duplicates/races.

# Module / File: src/db/repositories/budgetRepository.ts
## Function: BudgetRepository.getById
- **Purpose**: Retrieve and decode one budget by primary key.
- **Inputs**:
  - `id` (`number`): Positive budget ID.
- **Outputs**: `Promise<Budget | null>`.
- **Dependencies**: `findRowById` and budget row decoder.
- **Behavior**: Performs an indexed lookup and maps snake-case fields to the domain contract.
- **Side Effects**: Reads the database.
- **DSA Used**: Expected O(log n) lookup.
- **Data Analysis Notes**: Returns the stored limit only; spent amount remains derived.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Validates all integer/text row primitives.

# Module / File: src/db/repositories/budgetRepository.ts
## Function: BudgetRepository.list
- **Purpose**: Return every budget in stable ID order.
- **Inputs**:
  - None (`never`): Uses the repository connection.
- **Outputs**: `Promise<Budget[]>`.
- **Dependencies**: `listRows` and budget row decoder.
- **Behavior**: Reads and decodes all budget rows.
- **Side Effects**: Reads the database.
- **DSA Used**: O(n) time and output space.
- **Data Analysis Notes**: Task 7 adds month/category queries and computed spend totals.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Exposes typed entities rather than raw rows.

# Module / File: src/db/repositories/budgetRepository.ts
## Function: BudgetRepository.update
- **Purpose**: Apply a validated partial update to one budget.
- **Inputs**:
  - `id` (`number`): Positive budget ID.
  - `patch` (`BudgetUpdate`): Defined category, month, or limit changes.
- **Outputs**: `Promise<Budget | null>`.
- **Dependencies**: Expense-category/format/integer validators, `updateRow`, unique constraint, and `getById`.
- **Behavior**: Validates defined fields, verifies a replacement category is expense-type, updates atomically, and reloads the row.
- **Side Effects**: Updates at most one budget.
- **DSA Used**: O(f) construction for at most three fields plus indexed validation/write/read.
- **Data Analysis Notes**: Enforces exact positive limits and valid calendar month buckets.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Empty patches fail; uniqueness and foreign keys remain database-enforced.

# Module / File: src/db/repositories/budgetRepository.ts
## Function: BudgetRepository.delete
- **Purpose**: Delete one monthly budget by ID.
- **Inputs**:
  - `id` (`number`): Positive budget ID.
- **Outputs**: `Promise<boolean>`.
- **Dependencies**: `deleteRow`.
- **Behavior**: Performs an atomic bound-ID delete and returns whether it matched.
- **Side Effects**: Deletes at most one budget.
- **DSA Used**: Expected O(log n) primary-key deletion.
- **Data Analysis Notes**: Does not alter transactions or category spend.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Scope is limited to the requested budget row.

# Module / File: src/db/repositories/recurringRepository.ts
## Function: RecurringRepository.create
- **Purpose**: Validate and persist one recurring transaction rule with reminder settings.
- **Inputs**:
  - `rule` (`NewRecurringRule`): Amount/type, category/account references, note, frequency, next run, active state, and reminder configuration.
- **Outputs**: `Promise<RecurringRule>` containing the inserted row.
- **Dependencies**: Recurrence validators, `insertRow`, composite category/type foreign key, and `getById`.
- **Behavior**: Validates positive amount/IDs, supported discriminators, safe timestamp, and nonnegative lead days; inserts atomically; reloads the row.
- **Side Effects**: Inserts one `recurring_rules` row; it does not schedule work or notifications in Task 2.
- **DSA Used**: O(1) fixed-field validation and expected O(log n) index work.
- **Data Analysis Notes**: Amount remains exact minor units; next run is a safe epoch-millisecond integer.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Parameter binding, checks, and composite foreign keys preserve reference/type integrity.

# Module / File: src/db/repositories/recurringRepository.ts
## Function: RecurringRepository.getById
- **Purpose**: Retrieve and decode one recurring rule by primary key.
- **Inputs**:
  - `id` (`number`): Positive recurring-rule ID.
- **Outputs**: `Promise<RecurringRule | null>`.
- **Dependencies**: `findRowById` and recurring-rule row decoder.
- **Behavior**: Performs an indexed lookup and validates money, IDs, enums, booleans, timestamp, note, and lead days.
- **Side Effects**: Reads the database.
- **DSA Used**: Expected O(log n) lookup and O(1) decoding.
- **Data Analysis Notes**: SQLite booleans are normalized to TypeScript booleans.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Corrupt discriminator or scalar fields fail before reaching consumers.

# Module / File: src/db/repositories/recurringRepository.ts
## Function: RecurringRepository.list
- **Purpose**: Return every recurring rule in stable ID order.
- **Inputs**:
  - None (`never`): Uses the repository connection.
- **Outputs**: `Promise<RecurringRule[]>`.
- **Dependencies**: `listRows` and recurring-rule row decoder.
- **Behavior**: Reads and validates all recurring-rule rows.
- **Side Effects**: Reads the database.
- **DSA Used**: O(n) time and output space.
- **Data Analysis Notes**: Includes active and inactive rules; due-rule filtering is reserved for Task 10.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Exposes typed domain objects only.

# Module / File: src/db/repositories/recurringRepository.ts
## Function: RecurringRepository.update
- **Purpose**: Apply a validated partial update to one recurring rule.
- **Inputs**:
  - `id` (`number`): Positive recurring-rule ID.
  - `patch` (`RecurringRuleUpdate`): Defined recurrence or reminder fields to change.
- **Outputs**: `Promise<RecurringRule | null>`.
- **Dependencies**: Recurrence validators, `updateRow`, database constraints, and `getById`.
- **Behavior**: Validates and maps each defined field, preserves explicit nullable note, updates atomically, and reloads a matched row.
- **Side Effects**: Updates at most one recurring rule; Task 11 will reschedule notifications after such writes.
- **DSA Used**: O(f) patch construction for at most ten fields plus indexed write/read.
- **Data Analysis Notes**: Prevents negative reminder lead days and unsafe time/money integers.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Empty patches, invalid references, and category/type mismatches are rejected.

# Module / File: src/db/repositories/recurringRepository.ts
## Function: RecurringRepository.delete
- **Purpose**: Delete one recurring rule while detaching already-posted transactions safely.
- **Inputs**:
  - `id` (`number`): Positive recurring-rule ID.
- **Outputs**: `Promise<boolean>`.
- **Dependencies**: `deleteRow` and transaction `ON DELETE SET NULL` foreign key.
- **Behavior**: Deletes the rule transactionally and reports whether it existed; SQLite nulls the link on historical transactions.
- **Side Effects**: Deletes at most one rule and may set related `transactions.recurring_rule_id` values to null.
- **DSA Used**: Expected O(log n + r) work for primary-key deletion and r referencing-index updates.
- **Data Analysis Notes**: Historical transaction amounts/types remain unchanged.
- **Responsive & Accessibility Notes**: Not a UI module.
- **Security Notes**: Referential action avoids orphan IDs while preserving immutable financial history.

# Module / File: scripts/render-splash-icon.mjs
## Function: module initialization
- **Purpose**: Deterministically rasterize the exact Figma Home SVG geometry into Expo's source splash PNG.
- **Inputs**:
  - `assets/icons/home.svg` (`UTF-8 SVG`): Committed source geometry and neutral design stroke.
- **Outputs**: `assets/splash-icon.png`, a transparent 384 by 384 PNG.
- **Dependencies**: Node path/file APIs and development-only Sharp 0.35.3.
- **Behavior**: Resolves repository paths from the module URL, reads the SVG, substitutes the MoneyMap primary color, rasterizes at high density, resizes with contain semantics, and writes PNG output.
- **Side Effects**: Replaces only the generated splash PNG when the npm asset script runs.
- **DSA Used**: O(n + p) time for `n` SVG bytes and `p` output pixels; O(n + p) temporary memory in the rasterizer.
- **Data Analysis Notes**: Repeated generation from identical input produces the same SHA-256 hash.
- **Responsive & Accessibility Notes**: Expo derives density-specific native drawables from the high-resolution transparent source.
- **Security Notes**: Reads and writes fixed repository-local paths and performs no network operation.

# Module / File: package.json / app.json / jest.config.js
## Function: build, UI, security, and test configuration
- **Purpose**: Configure SQLCipher, native splash/font/SVG UI support, secure storage, Android privacy controls, Jest, and reproducible quality commands.
- **Inputs**:
  - None (`never`): Declarative project configuration.
- **Outputs**: Expo/Gradle/Metro/Jest/npm configuration consumed by build and test tools.
- **Dependencies**: Expo SDK 54, OP-SQLite, SQLCipher, OpenSSL Prefab, SecureStore, Expo Crypto, Splash Screen, Expo Font/Roboto, React Native SVG, Zustand, NativeWind peers, Jest Expo, RNTL, better-sqlite3, and development-only Sharp 0.35.3.
- **Behavior**: Names the app MoneyMap, enables SQLCipher, registers OpenSSL and native launch plugins with a generated local icon, disables Android automatic backup, fixes API 26, declares required future permissions, configures UI tests, provides asset/test/typecheck scripts, and pins a non-vulnerable PostCSS override.
- **Side Effects**: Alters native generation and dependency resolution; does not execute at application runtime by itself.
- **DSA Used**: Declarative keyed-map lookup, O(1) for fixed configuration size.
- **Data Analysis Notes**: Jest executes 38 database, key, native packaging, money, finance-view, theme, component, accessibility, and static-boundary tests.
- **Responsive & Accessibility Notes**: Automatic system theme, local typography, splash handoff, safe-area layout, SVG icons, and component semantics are enabled and tested.
- **Security Notes**: SQLCipher is mandatory, backup is disabled to prevent key/database separation, secrets remain gitignored, and the production audit has no high or critical advisory.

# Module / File: plugins/withAndroidCmakeObjectPathLimit.js
## Function: withAndroidCmakeObjectPathLimit
- **Purpose**: Inject idempotent CMake staging and object-path controls into Expo's generated Android application build.
- **Inputs**:
  - `config` (`ExpoConfig`): Mutable Expo application configuration passed through the config-plugin pipeline.
- **Outputs**: `ExpoConfig` containing an Android application Gradle mod.
- **Dependencies**: `withAppBuildGradle` from Expo Config Plugins and the generated Groovy `defaultConfig` block.
- **Behavior**: Verifies Groovy output, independently detects both markers, fails if either stable anchor is absent, adds a per-checkout Java-temp staging directory, and adds `CMAKE_OBJECT_PATH_MAX=250` exactly once.
- **Side Effects**: Modifies only generated `android/app/build.gradle` during Expo prebuild and directs generated CMake/Ninja files to a stable operating-system temporary child directory.
- **DSA Used**: Constant-count substring and regular-expression searches plus at most two replacements, O(n) time and space in the generated Gradle file length.
- **Data Analysis Notes**: The shortened staging root creates room for CMake's deterministic hash; the 250-character ceiling retains a ten-character margin below Ninja's Windows limit.
- **Responsive & Accessibility Notes**: Not a UI module; it enables native compilation without changing rendered behavior.
- **Security Notes**: Fixed strings and a non-secret checkout-path hash are inserted; loud anchor/language validation prevents silent or ambiguous native configuration drift.

# Module / File: plugins/withAndroidOpenSslJniPackaging.js
## Function: injectAndroidOpenSslJniPackaging
- **Purpose**: Add the OpenSSL shared-library extraction and Android JNI merge dependencies required by OP-SQLite's SQLCipher build.
- **Inputs**:
  - `contents` (`string`): Expo-generated Groovy application Gradle source.
- **Outputs**: `string` containing exactly one deterministic OpenSSL packaging block.
- **Dependencies**: Gradle `Configuration`, `Sync`, `zipTree`, Android source sets, the `io.github.ronickg:openssl:3.3.2-1` Prefab AAR, and Expo's generated top-level dependencies anchor.
- **Behavior**: Returns an already-configured file unchanged, otherwise validates the Gradle anchor, creates a resolvable OpenSSL configuration, extracts only each ABI's `libcrypto.so`, rewrites Prefab ABI paths to JNI paths, registers the generated directory, and orders both JNI-folder and native-library merge tasks after extraction.
- **Side Effects**: None in JavaScript; the returned Gradle source creates build-time extraction work when Gradle later executes.
- **DSA Used**: One marker lookup, one anchored regular-expression lookup, and one replacement, O(n) time and space in Gradle source length; Gradle extraction is O(a + b) for archive traversal and the four selected ABI binaries.
- **Data Analysis Notes**: The four supported ABI labels are derived from the AAR paths rather than duplicated in application configuration; only `libcrypto.so` is selected because it is the runtime dependency recorded by `libop-sqlite.so`.
- **Responsive & Accessibility Notes**: Not a UI module; successful native loading allows the accessible database gate and screens to render.
- **Security Notes**: Uses a pinned Maven coordinate, excludes unrelated archive files, stores generated binaries under the ignored build directory, and fails loudly when Expo's Gradle structure drifts.

# Module / File: plugins/withAndroidOpenSslJniPackaging.js
## Function: withAndroidOpenSslJniPackaging
- **Purpose**: Register the unit-tested OpenSSL JNI transformation in Expo's Android prebuild pipeline.
- **Inputs**:
  - `config` (`ExpoConfig`): Mutable Expo application configuration supplied to config plugins.
- **Outputs**: `ExpoConfig` containing one Android application Gradle mod.
- **Dependencies**: Expo Config Plugins `withAppBuildGradle` and `injectAndroidOpenSslJniPackaging`.
- **Behavior**: Verifies that Expo emitted Groovy, transforms the generated application Gradle text, and returns the updated configuration.
- **Side Effects**: Modifies generated `android/app/build.gradle` during Expo prebuild; repository-native source remains the plugin and `app.json` registration.
- **DSA Used**: Delegates one O(n) source transformation with O(n) output space.
- **Data Analysis Notes**: Unit coverage verifies insertion, idempotency, and unsupported-template failure; the native APK gate separately verifies both `libcrypto.so` and `libop-sqlite.so` for x86_64.
- **Responsive & Accessibility Notes**: Not a UI module; it removes the pre-render native crash that otherwise blocks every interface.
- **Security Notes**: SQLCipher retains its OpenSSL cryptographic provider at runtime, and explicit merge ordering prevents nondeterministic APKs that omit the provider.

# Module / File: src/store/financeStore.ts
## Function: useFinanceStore
- **Purpose**: Own the offline finance snapshot and CRUD entry points used by live screens.
- **Inputs**:
  - Zustand selectors/actions (`FinanceState`): status, entities, selected month, ensureHydrated/refresh/add* methods.
- **Outputs**: Reactive in-memory finance state plus async write helpers.
- **Dependencies**: `initializeDatabase`, typed repositories, `financeView.toMonthYear`, domain types.
- **Behavior**: Hydrates once from SQLCipher, ensures default accounts/entry categories, exposes list snapshots, and refreshes after each successful write.
- **Side Effects**: Opens SQLCipher, inserts/updates repository rows, mutates Zustand state, and caches the database handle.
- **DSA Used**: O(n) snapshot loads; Map helpers for O(1) id lookup; single-flight hydrate promise.
- **Data Analysis Notes**: All money fields remain integer minor units; month scope is `YYYY-MM`.
- **Responsive & Accessibility Notes**: Not a UI module; screens subscribe and re-render empty/populated states.
- **Security Notes**: Never logs keys; all persistence stays on-device through SQLCipher repositories.

# Module / File: src/domain/services/financeView.ts
## Function: computeDashboardTotals / groupHistory / buildBudgetCards / spendingByCategory / buildRecurringBills
- **Purpose**: Pure mappers from domain entities to Figma-aligned UI models and aggregates.
- **Inputs**:
  - Domain collections (`Account[]`, `Transaction[]`, `Budget[]`, `Category` maps, `RecurringRule[]`) and `monthYear` (`string`).
- **Outputs**: Totals, `UiTransaction` rows, history groups, budget cards, donut segments, recurring bill views.
- **Dependencies**: Domain types and UI model interfaces from fixtures/components.
- **Behavior**: Filters by month, aggregates with integer arithmetic, ranks categories, clamps/normalizes percents, and labels local calendar days.
- **Side Effects**: None.
- **DSA Used**: O(t + b + c + r) linear scans with optional O(t log t) sorts; Map/Set for grouping.
- **Data Analysis Notes**: Percent sums are adjusted to 100 for donut stability; budget states use 80/100 thresholds.
- **Responsive & Accessibility Notes**: Produces display strings and percents consumed by accessible components.
- **Security Notes**: Pure functions with no I/O; safe for unit tests without native modules.

# Module / File: Development Environment (Linux Mint 22.3)
## Function: bootstrapLocalToolchain
- **Purpose**: Establish a fully functional MoneyMap development environment (Node, JDK 21, Android SDK, npm deps, AVD, editor extension) on Linux without requiring Expo Go.
- **Inputs**:
  - Host OS (`Linux x86_64`): Linux Mint 22.3 / Ubuntu 24.04 base with Git, gcc/g++/make/python3, libsqlite3, KVM device, VS Code.
  - Network (`HTTPS`): nodejs.org, adoptium.net, dl.google.com, registry.npmjs.org.
- **Outputs**: Runnable JS tooling, encrypted-DB-capable native build path, green unit tests, passing expo-doctor.
- **Dependencies**: nvm + Node 22 LTS, Temurin JDK 21, Android cmdline-tools/SDK packages, npm lockfile, VS Code React Native Tools (`msjsdiag.vscode-react-native`), optional KVM.
- **Behavior**: Install Node via nvm; install user-space JDK 21; install Android SDK packages (platform 35, build-tools 35, NDK 27.1, cmake 3.22.1, emulator, google_apis x86_64 image); create AVD `MoneyMap_VSCode_API_35`; copy `.env.example` → `.env`; run `npm ci`; verify with `npm test`, `npx expo-doctor`, `npx expo export --platform android`.
- **Side Effects**: Writes `~/.nvm`, `~/.local/share/MoneyMap/toolchains/temurin-21`, `~/Android/Sdk`, `~/.android/avd`, project `node_modules/`, `dist/`, and `~/.moneymap-env.sh` PATH exports.
- **DSA Used**: Linear package install and test execution O(p + t); environment resolution is constant-time path lookup.
- **Data Analysis Notes**: Disk footprint observed ~0.2 GB nvm, ~0.3 GB JDK, ~6.8 GB Android SDK, ~0.8 GB node_modules. Jest: 11 suites / 44 tests. Peer warning only: nested `react-reconciler@0.33.0` wants `react@^19.2.0` while Expo pins `react@19.1.0` (non-blocking). npm audit high-omit-dev: moderate Expo transitive advisories only.
- **Responsive & Accessibility Notes**: Not a UI module; enables building the accessible Android client and running UI unit tests.
- **Security Notes**: Never commit `.env`, keystores, or SQLCipher keys. GEMINI_API_KEY unused until Smart Tips networking. Prefer JDK 21 only for Gradle (Java 25/26 EA breaks the stack). KVM access via group `kvm` or ACL; do not expose ADB over the network.

# Module / File: package.json
## Function: scripts and dependency surface
- **Purpose**: Declare Expo 54 / RN 0.81.5 application dependencies, OP-SQLite SQLCipher flag, and developer scripts.
- **Inputs**:
  - npm lifecycle (`install`/`ci`): resolves lockfile v3 graph.
- **Outputs**: Installed `node_modules` and runnable scripts: `start`, `android`, `ios`, `prebuild`, `test`, `test:coverage`, `asset:splash`, `build:readme-page`.
- **Dependencies**: Expo `~54`, React `19.1.0`, RN `0.81.5`, `@op-engineering/op-sqlite` with `"op-sqlite": { "sqlcipher": true }`, NativeWind 4, React Navigation 7, Zustand 5, Jest Expo, better-sqlite3 (tests).
- **Behavior**: `npm ci` installs locked graph; `overrides.postcss` pins `8.5.25`; native Android path requires prebuild + Gradle with JDK 21 and Android SDK 35.
- **Side Effects**: Native module compile for `better-sqlite3`/`sharp` during install; no network at app runtime for core finance features.
- **DSA Used**: npm dependency DAG resolution; O(packages) install.
- **Data Analysis Notes**: No `typecheck` script (JS migration). Expo Go unsupported due to native SQLCipher.
- **Responsive & Accessibility Notes**: Test scripts cover UI fidelity static contracts and component a11y-related cases.
- **Security Notes**: `allowBackup: false` in app.json; SecureStore holds DB key; release Gemini key via EAS secrets only.

# Module / File: src/services/appLock.js
## Function: tryLocalAuthentication / canUseBiometrics
- **Purpose**: Unlock MoneyMap via system biometrics with silent PIN fallback when hardware or enrollment is missing.
- **Inputs**:
  - none for canUseBiometrics; authenticateAsync options are fixed inside tryLocalAuthentication.
- **Outputs**: `canUseBiometrics` → `Promise<boolean>`; `tryLocalAuthentication` → `Promise<"success"|"failed"|"unavailable">`.
- **Dependencies**: `expo-local-authentication`, `expo-secure-store` (PIN path), `expo-crypto` (PIN hash).
- **Behavior**: hasHardwareAsync → isEnrolledAsync → authenticateAsync; any throw or missing capability yields unavailable so UI stays on PIN.
- **Side Effects**: Shows OS biometric prompt when enrolled; never mutates preferences.
- **DSA Used**: O(1) SecureStore key lookups for PIN path; constant-time string compare of digests.
- **Data Analysis Notes**: PIN is 4 digits; salt is 16 random bytes hex-encoded.
- **Responsive & Accessibility Notes**: AppLockScreen offers fingerprint key + "Use fingerprint instead" only when biometricsAvailable.
- **Security Notes**: disableDeviceFallback true so device PIN does not replace in-app PIN; DB key remains in SecureStore separate from app lock PIN.

# Module / File: src/screens/AppLockScreen.jsx
## Function: AppLockScreen
- **Purpose**: PIN create/confirm/unlock UI with one-shot auto biometric prompt on cold lock.
- **Inputs**:
  - `navigation` (React Navigation): pop after setup from Settings.
- **Outputs**: JSX lock surface; unlock clears `isLocked` via uiStore.
- **Dependencies**: uiStore, canUseBiometrics, appLock PIN helpers, theme tokens.
- **Behavior**: Auto-prompts biometrics once when locked+enrolled; failures leave PIN pad active; cancel setup disables lock when not gated.
- **Side Effects**: Calls unlockWithBiometrics / setupPin / setAppLockEnabled.
- **DSA Used**: Fixed 4-slot PIN buffer; O(1) keypad map.
- **Data Analysis Notes**: None.
- **Responsive & Accessibility Notes**: Key labels for fingerprint/delete; PIN digit progress accessibilityLabel.
- **Security Notes**: Root navigator replaces Main with AppLock when isLocked; AppState background re-locks when enabled.

# Module / File: src/domain/services/recurringCatchUp.js
## Function: planRecurringCatchUp / advanceNextRunEpochMillis
- **Purpose**: Pure planner for overdue recurring posts and next-run advancement.
- **Inputs**:
  - `rule` (`RecurringRule`-like): isActive, frequency, nextRunEpochMillis
  - `nowEpochMillis` (`number`): catch-up horizon
- **Outputs**: `{ posts: [{ runEpochMillis }], nextRunEpochMillis, skippedInactive }`
- **Dependencies**: none (pure)
- **Behavior**: While nextRun ≤ now, enqueue a post and advance by DAILY/WEEKLY/MONTHLY (month-end clamp).
- **Side Effects**: none
- **DSA Used**: O(k) loop bounded by 366 posts/rule; O(1) calendar arithmetic
- **Data Analysis Notes**: Multi-day downtime expands to k posts; month boundary Jan 31 → Feb 28/29
- **Responsive & Accessibility Notes**: n/a
- **Security Notes**: No I/O; amounts unchanged (integer minor units preserved by caller)

# Module / File: src/services/recurringCatchUp.js
## Function: runRecurringCatchUp
- **Purpose**: Persist planned posts and advance rules idempotently.
- **Inputs**:
  - `database`: SQLite handle
  - `options.nowEpochMillis` (`number`, optional)
- **Outputs**: `{ rulesProcessed, transactionsCreated, transactionsSkippedDuplicate }`
- **Dependencies**: RecurringRepository, TransactionRepository, planRecurringCatchUp
- **Behavior**: For each active rule, insert missing (ruleId, runEpoch) txs then set nextRun to plan.nextRunEpochMillis.
- **Side Effects**: Writes transactions + recurring_rules
- **DSA Used**: Per-run existence SELECT; O(rules × posts)
- **Data Analysis Notes**: Re-run yields zero creates once nextRun is future
- **Responsive & Accessibility Notes**: Invoked before first UI snapshot in financeStore.ensureHydrated
- **Security Notes**: On-device only; no network

# Module / File: src/tasks/recurringTask.js
## Function: defineRecurringCatchUpTask / registerRecurringCatchUpTask
- **Purpose**: Register expo-background-task worker for recurring catch-up when OS allows.
- **Inputs**: none
- **Outputs**: registration boolean
- **Dependencies**: expo-background-task, expo-task-manager, initializeDatabase, runRecurringCatchUp
- **Behavior**: defineTask once; register if BackgroundTaskStatus.Available
- **Side Effects**: OS background registration; DB writes when worker runs
- **DSA Used**: n/a
- **Data Analysis Notes**: minimumInterval 12 hours; on-open catch-up remains source of truth after downtime
- **Responsive & Accessibility Notes**: n/a
- **Security Notes**: Uses same SQLCipher DB as foreground; failures return Failed without crashing UI

# Module / File: src/services/reminders.js
## Function: buildReminderNotificationPlan
- **Purpose**: Pure planner for local OS bill reminder notifications from recurring rules.
- **Inputs**:
  - `rules` (`RecurringRule[]`): active rules with reminder fields
  - `categoriesById` (`Map`): category lookup for bill names
  - `options` (`object`): nowEpochMillis, currencySymbol, remindersEnabled
- **Outputs**: Ordered plan entries with identifier, fire time, triggerMode date|asap, title/body, deep-link data
- **Dependencies**: buildRecurringBills, formatMinor
- **Behavior**: Fire at 09:00 local on dueDay−leadDays; ASAP if already inside lead window; skip past-due and disabled
- **Side Effects**: none
- **DSA Used**: O(n) scan; identifiers encode ruleId+nextRun for idempotent reschedule across month boundaries
- **Data Analysis Notes**: Amounts stay minor units until formatMinor at copy boundary
- **Responsive & Accessibility Notes**: n/a (OS notification text)
- **Security Notes**: Local only; payload carries ruleId + screen, no account secrets

# Module / File: src/services/notificationScheduler.js
## Function: syncBillReminderNotifications
- **Purpose**: Cancel prior MoneyMap schedules and apply the pure plan via expo-notifications.
- **Inputs**:
  - rules, categoriesById, remindersEnabled, currencySymbol, requestPermissionIfNeeded
- **Outputs**: `{ scheduled, cancelled, permissionGranted, permissionDenied, errorMessage }`
- **Dependencies**: expo-notifications (dynamic import), buildReminderNotificationPlan
- **Behavior**: Never prompts on cold start unless requestPermissionIfNeeded; toggle-off cancels all; permission denial is non-fatal
- **Side Effects**: OS notification channel + scheduled locals; deep-link listener via subscribeReminderNotificationResponses
- **DSA Used**: Full replace of prefixed identifiers O(s + p)
- **Data Analysis Notes**: n/a
- **Responsive & Accessibility Notes**: Settings/Recurring show amber permission hint when denied
- **Security Notes**: No FCM/push; POST_NOTIFICATIONS only when user enables reminders

# Module / File: src/domain/services/importParser.js
## Function: parseImportGrid / parseImportFile / xlsxToGrid / csvTextToGrid
- **Purpose**: Single CSV/XLSX → validated import-row pipeline; row failures are skipped and reported.
- **Inputs**:
  - grid or file content (`csv text` | `xlsx base64`)
  - optional column mappings (`ImportColumnMappings`)
- **Outputs**: `{ rows, skipped, headers, dataRowCount }` with integer minor-unit amounts
- **Dependencies**: papaparse, SheetJS/xlsx, parseDecimalToMinor
- **Behavior**: Detect headers, map columns, parse date/amount/type/account; never throws on bad rows
- **Side Effects**: none
- **DSA Used**: O(n) row scan; first-match header map O(h)
- **Data Analysis Notes**: Excel serial dates supported; amounts always positive minor units; type from column or default EXPENSE
- **Responsive & Accessibility Notes**: n/a
- **Security Notes**: Local file parse only; no network

# Module / File: src/services/importFile.js
## Function: pickAndParseImportFile
- **Purpose**: Document picker + format detect + shared parse for ImportScreen.
- **Inputs**: user-selected file URI
- **Outputs**: fileName, format, grid, mappings, preview parse result
- **Dependencies**: expo-document-picker, expo-file-system/legacy (xlsx base64), importParser
- **Behavior**: Accepts csv/xlsx MIME types; reads text or base64; returns null on cancel
- **Side Effects**: Reads local file into memory
- **DSA Used**: n/a
- **Data Analysis Notes**: n/a
- **Responsive & Accessibility Notes**: Import UI shows skip summary before confirm
- **Security Notes**: copyToCacheDirectory; no upload

# Module / File: src/store/financeStore.js
## Function: importCsvRows
- **Purpose**: Transactional bulk insert of validated import rows with auto category/account create.
- **Inputs**: rows[], optional skipped meta
- **Outputs**: `{ created, skipped, skippedRows }` (valueOf → created for legacy numeric use)
- **Dependencies**: SQL transaction, categories/accounts/transactions tables
- **Behavior**: One DB transaction for all inserts; refresh after commit; partial failure rolls back all
- **Side Effects**: Writes DB; refreshes Zustand snapshot
- **DSA Used**: Map caches for category/account O(1) lookup during import
- **Data Analysis Notes**: Money remains integer minor units
- **Responsive & Accessibility Notes**: n/a
- **Security Notes**: On-device only

# Module / File: src/domain/services/tips.js
## Function: deriveSmartTips
- **Purpose**: Pure offline Smart Tips from the user's budgets and transactions (FR-10a).
- **Inputs**:
  - `budgets`, `transactions`, `categories`/`Map`, `monthYear`, optional `now`
- **Outputs**: `{ remainingMinor, limitMinor, spentMinor, daysLeftInMonth, dailyAllowanceMinor, tips[] }`
- **Dependencies**: financeView (buildBudgetCards, budgetSummary, shiftMonthYear, transactionInMonth)
- **Behavior**: Builds tips for daily allowance, food/day, pace-to-over, repeat small spends, MoM category compare; empty-data fallback tip
- **Side Effects**: none — never calls fetch/network
- **DSA Used**: O(t + b + c) scans; Map grouping for repeats O(t)
- **Data Analysis Notes**: All money integer minor units; daily = ceil(remaining/daysLeft); pace projects linear spend to month end
- **Responsive & Accessibility Notes**: Tip copy consumed by SmartTipsScreen cards
- **Security Notes**: On-device only; no identifiers leave the device

# Module / File: src/screens/SmartTipsScreen.jsx
## Function: SmartTipsScreen
- **Purpose**: Render offline-derived tips; hide/exit when smartTipsEnabled is false.
- **Inputs**: navigation
- **Outputs**: JSX tip list + monthly hero
- **Dependencies**: deriveSmartTips, financeStore, uiStore
- **Behavior**: useEffect goBack when disabled; maps tip title/meta/tag through formatMinor
- **Side Effects**: navigation.goBack when toggle off
- **DSA Used**: n/a
- **Data Analysis Notes**: Hero uses monthly remaining (not fixture weekly split)
- **Responsive & Accessibility Notes**: Empty tips message; offline badge
- **Security Notes**: No fetch (static test enforces)

# Module / File: src/remote/smartTipsClient.js
## Function: buildAnonymizedSmartTipsPayload / fetchSmartTipsFromGemini / loadOnlineSmartTips
- **Purpose**: Sole networked module (FR-10b); Gemini tips from anonymized budget summary only.
- **Inputs**: enabled, consentAccepted, budgets/transactions for payload build; optional fetchImpl
- **Outputs**: tip cards or null (caller falls back to deriveSmartTips)
- **Dependencies**: expo-constants (API key), financeView aggregates, global fetch
- **Behavior**: Gate on enabled+consent; assert payload; cache 30m; timeout 12s; parse JSON tip array
- **Side Effects**: HTTPS POST to Gemini when gated open; in-memory cache
- **DSA Used**: Map cache O(1); payload build O(t+b)
- **Data Analysis Notes**: Ratios from spend/total; minor-unit integers only
- **Responsive & Accessibility Notes**: SmartTipsScreen shows loading indicator during AI fetch
- **Security Notes**: Forbidden fields enforced; no notes/accounts/raw txs; key from EAS/env only

# Module / File: docs/privacy-policy.md
## Function: privacy policy
- **Purpose**: Disclose opt-in AI and on-device encryption for store / users
- **Inputs**: n/a
- **Outputs**: markdown policy
- **Dependencies**: none
- **Behavior**: Documents SQLCipher, Smart Tips payload limits, local notifications
- **Side Effects**: none
- **DSA Used**: n/a
- **Data Analysis Notes**: n/a
- **Responsive & Accessibility Notes**: n/a
- **Security Notes**: Aligns Play Data safety checklist
