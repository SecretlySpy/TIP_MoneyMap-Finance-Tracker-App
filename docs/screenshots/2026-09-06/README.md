# MoneyMap full-page Android screenshots — 2026-09-06

Native Android captures of the current JavaScript application at commit `33b4c83`.
**31 PNGs cover all 14 screen components** registered in `src/navigation/RootNavigator.jsx`.
Additional captures cover distinct modes and populated states. Open the
[searchable gallery](index.html) or [download the ZIP](../moneymap-full-page-2026-09-06.zip).

## Capture method

- Fixed portrait width: 1080 physical pixels, approximately 411.43 density-independent pixels at 420 dpi.
- Baseline display: 1080 × 2400, Android 16 / API 36, light appearance.
- Read the actual native ScrollView content and viewport dimensions, scroll to its end,
  then expand only the emulator height until the complete content fits.
- Verify that content height is unchanged and that no vertical overflow remains.
- Android limits this emulator's height to 7200 pixels. Longer pages use overlapping
  native frames joined at measured pixel offsets. Headers and navigation are included
  once, with overlap pixels checked before the result is accepted.
- Capture the real native framebuffer. These are application screenshots, not mockups.

`manifest.json` records original, bottom-of-scroll, expanded and (when needed)
stitched measurements. Matching XML files in `evidence/` record Android's visible UI hierarchy.
The import preview has left, middle and right captures whose measured intervals
cover all 720 dp of the table, including all six columns.

## Assumptions and boundaries

- **Assumption A-01**: Android portrait in the default light appearance is the target.
  - **Reason**: The project is Android-first and the user requested mobile screenshots.
  - **Impact if wrong**: Other platforms, orientations or themes need separate captures.
  - **Status**: assumed
- **Assumption A-02**: Every page includes all registered screens and distinct page modes,
  with populated examples where empty states hide content.
  - **Reason**: The request explicitly requires full scrolling content with no omitted sections.
  - **Impact if wrong**: Additional transient dialog or theme combinations could be requested.
  - **Status**: verified against the 14 registered screen components

The installed local development APK uses `com.example.financetracker`, while the current
release configuration uses `com.moneymap.financetracker`. Metro serves the current source.
The older local development APK permits screenshots; the source's production
`FLAG_SECURE` plugin is unchanged. Native release packaging and iOS are not validated here.
The locally installed `expo-location` package is a stub, so Student Eats uses the
application's TIP Quezon City campus fallback and live OpenStreetMap results.

Sample finance data exists only in memory during capture and is restored afterward.
Import previews use a synthetic picker result and the application's real parsing and
validation flow; no import or backup restore is submitted. App lock is captured at PIN
setup without setting a PIN. Online Gemini requests remain disabled.

## Verification

- **Executed**: Native screen inventory, native scrolling/measurement, complete PNG decoding,
  dimension and SHA-256 checks, and overlap verification for the 7379-pixel Student Eats image.
  `node tools/verify.mjs` reports `QA_PASSED` for 31 captures and 14 registered screens.
  Chrome gallery checks at 1440 and 390 px loaded all 31 images without cropping or
  horizontal page overflow, and the search filter returned the expected result.
- **Observed**: Every registered screen has a screenshot. Dashboard includes all sections
  through Recent Transactions; Settings includes its final offline-first notice.
- **Not verified**: Release-device rendering, iOS, landscape, every possible transient alert,
  and theme combinations. This is screenshot coverage, not an application test-suite result.
- **Residual risk**: Live Student Eats results can change on a later capture.

## Coverage

| Pages | Captured views |
|---|---|
| Dashboard, History, Budgets, Recurring, Goals, Smart Tips | Empty and populated |
| Entry | Expense and income, complete keypad and save control |
| Settings, Manage Categories, Manage Accounts | Full pages, including bottom sections and archived sample account |
| Import | File selection, three horizontal preview positions, column mapping and validation |
| Paste Import | CSV and JSON backup modes |
| App Lock | PIN creation page, without setting credentials |
| Embedded forms | Budget icon, recurring frequency/category/reminder, account type |

## Reproduction and handover

The captured APK was already available locally; this task did not create a release build.
To repeat the snapshot, use a fresh, screenshot-capable Android development profile at
420 dpi and Node 22 with the repository dependencies installed. The recorded dev-client
package is `com.example.financetracker`; current release settings enable screenshot blocking.

From the repository root, start Metro in one terminal:

```bash
EXPO_NO_DOTENV=1 GEMINI_API_KEY= npm start -- --localhost --port 8082
```

Connect the development client to port 8082 (`adb -s emulator-5554 reverse tcp:8082 tcp:8082`),
close its developer welcome sheet, and wait for Dashboard. Run from another terminal:

```bash
node docs/screenshots/2026-09-06/tools/capture.mjs
node docs/screenshots/2026-09-06/tools/verify.mjs
node docs/screenshots/2026-09-06/tools/build-gallery.mjs
```

Pass one or more filename slugs to capture a subset. The preserved script was smoke-tested
with `31-import-preview-middle`. `MONEYMAP_CAPTURE_SERIAL`, `MONEYMAP_CAPTURE_PORT` and
`MONEYMAP_CAPTURE_APP_ID` override the connection defaults. The script restores temporary
sample state, the picker seam and the display override in `finally`.

The capture directory contains `verification.json`, gallery checks in `evidence/gallery-qa.json`,
and [HANDOVER.md](HANDOVER.md). Native release security behavior and app business logic tests
remain outside this screenshot task. The original application source and secure-screen plugin
were not edited.
