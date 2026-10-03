# Native Mobile Test Suite and Validation Checklist

Status: execution specification; native results are **UNVERIFIED** until recorded with device evidence  
Last updated: 2026-10-03  
Release target: Android API 26+  
Conditional target: iOS/iPadOS, when an Apple release is in scope

Live visual source: [MoneyMap - Finance Tracker, Figma file `JeEeOG1jZ0B72pA8gf7fMk`](https://www.figma.com/design/JeEeOG1jZ0B72pA8gf7fMk/MoneyMap---Finance-Tracker?m=auto&t=EWhtWgnswUW8ZrcN-6)

## 1. Purpose and evidence boundary

This suite validates the native behavior that JavaScript unit tests cannot prove:

- SQLCipher encryption, key persistence, failure recovery, and native database lifecycle.
- Optional PIN/biometric App Lock behavior across system and application lifecycle changes.
- Local notification permission, scheduling, delivery, cancellation, and notification-tap routing.
- Accessibility with real assistive technologies, large text, alternate input, and OS audits.
- Responsive visual behavior on compact phones, reference phones, and tablets.

The current Jest and desktop-SQLite suites remain prerequisite regression evidence. They do not satisfy a native case by themselves because SecureStore, LocalAuthentication, Notifications, SQLCipher, safe areas, keyboards, and accessibility services are mocked or absent.

### Release rule

- Android release is blocked by any open Critical or Major defect from an Android-required case.
- All P0 and P1 Android-required cases must pass on a fresh release-candidate binary.
- P2 cases may be deferred only with an owner, reason, impact, and review date.
- iOS/iPadOS results do not block the current Android-only release unless Apple distribution is added to scope.
- `QA_PASSED` may be recorded only for the exact build, devices, and checks executed. It does not mean universal security or accessibility compliance.

## 2. Repository coverage map

| Capability | Production surfaces | Existing non-native coverage | Native gap closed by this suite |
|---|---|---|---|
| SQLCipher | `src/db/client.js`, `databaseKey.js`, `keyManager.js`, `schema.js`, `plugins/withAndroidOpenSslJniPackaging.js` | `keyManager.test.js`, `schema.test.js`, `repositories.test.js`, persistence/stress suites, packaging-plugin test | Compiled cipher, encrypted bytes, real SecureStore key, open/reopen, upgrade, corruption, process death |
| App Lock and biometrics | `src/services/appLock.js`, `src/store/uiStore.js`, `AppLockScreen.jsx`, `RootNavigator.jsx` | `appLock.test.js`, `preferences.test.js`, `rootNavigationMode.test.js` | Real biometric prompt, hardware/enrollment states, background lock, cancellation, OS lockout, PIN fallback |
| Local notifications | `src/services/reminders.js`, `notificationScheduler.js`, `uiStore.js`, `App.js` | `remindersScheduling.test.js`, `emojiAndDueDate.test.js`, recurring tests | Runtime permission, Android channel, actual delivery, reboot/time-zone behavior, tap routing, cancellation |
| Accessibility | Screens/components, React Navigation, theme tokens | `responsiveAccessibility.test.jsx`, component roles, static contrast checks | TalkBack/VoiceOver, focus order, announcements, large text, switch/keyboard access, OS audits |
| Responsive UI | `ScreenContainer.jsx`, `BottomSheet.jsx`, `tokens.js`, all screens | 600 dp breakpoint and 540/760 dp caps checked statically | Safe areas, rotation, keyboard, system bars, split screen, phone/tablet screenshots and visual review |

## 3. Test environment and device matrix

### 3.0 Automation boundary

No Detox, Maestro, Appium, Espresso, or XCUITest harness is currently configured in this repository. Do not describe the native cases below as executable automation until a reviewed harness and stable selectors are committed.

| Layer | Current status | Intended ownership |
|---|---|---|
| Jest/RNTL and desktop SQLite | Available now | Pure logic, repository contracts, static accessibility/responsive rules, error-state regressions |
| Gradle/config/plugin inspection | Partially available | APK/AAB contents, manifest, package ID, native libraries, build configuration |
| Black-box native E2E | Not configured | Repeatable onboarding, entry, lock, permission, notification-tap, navigation, and screenshot journeys after one framework is selected |
| Native instrumentation/debug diagnostics | Not configured | Cipher version/integrity, scheduled-notification inventory, fault injection, lifecycle hooks; debug-only and never key-logging |
| Manual physical-device validation | Required | Real biometrics, TalkBack/VoiceOver, OS prompts/settings, notification delivery, reboot, safe areas, touch/keyboard behavior, visual review |

If automation is added later, choose one primary black-box framework based on Expo development-build compatibility and CI/device-lab ownership. Do not add multiple competing E2E stacks. Manual biometric, assistive-technology, and visual review remains required even after automation.

### 3.1 Required build variants

| Build | Use | Requirement |
|---|---|---|
| Android debug development client | Inspection, fault injection, database extraction from synthetic fixtures | Must be freshly generated from the release-candidate commit; Expo Go is not valid |
| Android release candidate APK/AAB | Release acceptance, performance, permissions, lifecycle, visual review | Must use package `com.moneymap.financetracker`, min SDK 26, and release-equivalent config |
| iOS development/release candidate | Conditional iPhone/iPad checks | Required only when Apple distribution enters scope; Face ID requires a development build, not Expo Go |

Record the Git commit, app version/version code, build artifact checksum, build profile, OS build, device model, locale, time zone, font scale, display size, theme, navigation mode, and tester for every run.

### 3.2 Android matrix

| ID | Form factor | Minimum coverage | Required features |
|---|---|---|---|
| `A-PHONE-MIN` | Compact phone, API 26, 320-360 dp portrait width | Minimum supported OS and constrained viewport | Fresh install, database, PIN, non-runtime notification behavior, core visual smoke |
| `A-PHONE-33` | Phone, API 33 | Android notification runtime-permission boundary | Grant, deny, deny permanently, channel and delivery |
| `A-PHONE-REF` | Physical current/representative phone, 400-430 dp width | Primary release acceptance | Hardware biometric enrollment, TalkBack, light/dark, keyboard, process death, reboot |
| `A-PHONE-CUTOUT` | Phone with cutout and gesture navigation | Insets and system UI | Portrait/landscape, bottom tab/FAB, sheets, lock screen |
| `A-PHONE-LATEST` | Phone/emulator, API 36 | Current-OS compatibility above the declared API 26 minimum | Notification/channel policy, background restrictions, system bars, edge-to-edge and permission behavior |
| `A-TABLET-600` | 7-8 inch tablet or emulator, 600 dp boundary | Breakpoint transition | All six UI groups, portrait/landscape, large text, database and PIN smoke |
| `A-TABLET-REF` | 10-13 inch tablet, at least 800 dp portrait width | Wide-layout acceptance | All six UI groups, SQLCipher reopen, App Lock/biometric fallback, notification delivery/tap, keyboard, multi-window/resizing, TalkBack smoke |

At least one required Android device must be physical and biometric-capable. Emulators may cover deterministic OS/API and display matrices but cannot be the sole biometric evidence.

### 3.3 Conditional Apple matrix

| ID | Form factor | Minimum coverage |
|---|---|---|
| `I-PHONE-COMPACT` | Small supported iPhone | Touch ID or unavailable path, compact layout, VoiceOver, Dynamic Type |
| `I-PHONE-FACE` | Face ID iPhone | Face ID grant/cancel/failure, background lock, notification permission/delivery |
| `I-PAD-REF` | Supported iPad | Database reopen, App Lock fallback, local notification, portrait/landscape, split view, VoiceOver, keyboard, tablet visuals |

Use the oldest and newest OS major versions supported by the actual release configuration when Apple release scope is defined. Do not infer iOS acceptance from Android results.

### 3.4 Figma baseline control

Figma oEmbed metadata confirmed the supplied URL, file key, title, and a 2026-10-03 modification date. The current tool connection did not expose authenticated node context or full-size frame screenshots. Before visual execution, the tester must open the live file and record:

| Field | Required value |
|---|---|
| Figma file | `JeEeOG1jZ0B72pA8gf7fMk` |
| File/page revision | Modified timestamp or version/history label used for the run |
| Frame identity | Page name, frame name, and node ID for every baseline screenshot |
| Reference viewport | Mobile 412x892 and tablet 834x1194 where those frames exist; record any different frame dimensions |
| Export | 1x PNG or equivalent lossless reference with filename containing node ID |
| Variants | Default plus applicable empty/loading/error/focus/modal/permission states |

Do not compare against a thumbnail, historical archive page, or a frame without a recorded node ID. If the live file changes during execution, freeze the reviewed version or restart affected comparisons.

The 31 captures under `docs/screenshots/2026-09-06/` are historical troubleshooting evidence only: they use an older commit, old development package, phone portrait, and light theme. They are not current visual, tablet, accessibility, notification, or release-build acceptance.

### 3.5 Secure-screen evidence constraint

`plugins/withAndroidSecureScreen.js` injects Android `FLAG_SECURE` before `super.onCreate`. A valid release candidate should therefore block ordinary screenshots and screen recording, including most emulator capture APIs.

- Use an external camera for release-candidate lifecycle, biometric, notification, accessibility, and secure-screen observations when capture is blocked.
- For Figma/pixel review, use a clearly marked, non-distributable visual-QA build from the same commit with only `FLAG_SECURE` disabled through a reviewed debug-only mechanism. The repository does not currently expose such a switch, so creating it is separate implementation work.
- Record both artifact checksums and the sole configuration difference. A visual-QA pass does not replace a release-candidate smoke test of the same state.
- Never disable `FLAG_SECURE` in the release candidate, publish the QA build, or use real finance data in either artifact.

## 4. Test data, reset states, and safety

Use synthetic finance data only. Never extract or attach a database containing real financial records, a production SQLCipher key, PIN material, tokens, signing files, or personal notification content.

Required reset states:

| State | Contents |
|---|---|
| `S0 Fresh` | App never installed or OS app data cleared |
| `S1 Seeded` | Default account/categories plus one income, one expense, one budget, one recurring bill, one goal |
| `S2 Dense` | Long labels, large amounts, 100+ transactions, over-budget state, completed goal, paused and active recurring rules |
| `S3 Locked` | App Lock enabled with a synthetic 4-digit test PIN and enrolled biometrics |
| `S4 Upgrade` | Valid older schema fixture with known row counts and values; never a copied user database |
| `S5 Fault` | Disposable debug snapshot for wrong-key, missing-key, corrupt-file, denied-permission, and interrupted-write tests |

Capture evidence into a run-specific directory such as `docs/qa/native/<YYYY-MM-DD>/<build-id>/`. Screenshots/photos must redact notification shade content from other apps, account names, device owner information, and system identifiers. Do not commit extracted database files, logs containing keys/PINs, or signing/build credentials. Label every image as release candidate, visual-QA build, or external-camera capture.

## 5. Preflight and baseline

Run from a clean dependency install and record complete output:

```bash
npm ci
npm test -- --watch=false --runInBand
npm run test:stress -- docs/qa/native/<date>/<build-id>/stress.json
npm run android:check
npx expo-doctor
npx expo prebuild --platform android --clean
```

Run `expo prebuild --clean` only in a disposable clean checkout/build worktree. It removes and regenerates native directories; do not run it over uncommitted native changes.

Use the repository's release baseline of Node 22 LTS, JDK 21, Android SDK/API 35 tooling, and NDK 27.1 unless the setup guide is deliberately updated and reverified. API 26 remains the runtime floor; API 36 remains a compatibility target in the device matrix.

Build the debug APK from generated Android sources. Confirm the APK contains `libop-sqlite.so` and `libcrypto.so` for every packaged ABI. Confirm the installed package is `com.moneymap.financetracker`; a reused `com.example.financetracker` artifact is invalid evidence.

| ID | Priority | Procedure | Pass criteria | Evidence |
|---|---:|---|---|---|
| PRE-01 | P0 | Run the commands above on the release-candidate commit. | Install, Jest, stress, launcher preflight, Expo Doctor, prebuild, and Gradle build complete without an unexplained failure. | Logs, commit, tool versions |
| PRE-02 | P0 | Inspect APK/AAB native libraries per ABI. In an isolated negative-test build only, remove/disable the SQLCipher build flag without changing production code paths. | Every shipped ABI includes OP-SQLite and its required OpenSSL `libcrypto.so`; no missing-library startup crash. The isolated non-SQLCipher build is rejected by `isSQLCipher()` at `DatabaseGate` and never creates a plaintext fallback. | Archive listing, startup log, and negative-build error capture |
| PRE-03 | P0 | Install over no prior app data and cold launch offline. | Correct package starts without Expo Go, reaches the database-gated app, and performs no required network call. | Screen recording and filtered device log |
| PRE-04 | P1 | Check Android manifest and generated config. | API 26 minimum, `USE_BIOMETRIC`, `POST_NOTIFICATIONS` where applicable, `RECEIVE_BOOT_COMPLETED`, exact-alarm policy, backup policy, and secure-screen plugin match `app.json` and the documented reminder precision. | Generated manifest/config excerpt and policy decision |
| PRE-05 | P1 | Seed `S1`, export a backup, and record expected counts/totals. | Fixture is reproducible and contains no real user data. | Fixture recipe and expected-value manifest |

## 6. SQLCipher and secure key validation

Use a debuggable build and disposable synthetic app data for byte-level inspection. Locate `moneymap.sqlite` through the app sandbox rather than assuming a fixed OP-SQLite subdirectory. If extraction is not permitted by the candidate build, repeat the byte checks on an equivalent debug build from the same commit and separately run all lifecycle cases on the release candidate.

| ID | Priority | Setup and action | Pass criteria | Evidence |
|---|---:|---|---|---|
| DB-01 | P0 | Fresh-install `S0`; launch and create `S1`; query through the app. | `isSQLCipher()` allows startup, `PRAGMA cipher_version` is non-empty, schema reaches version 7, seeded and added rows read correctly, `PRAGMA foreign_key_check` is empty, and `PRAGMA cipher_integrity_check` returns no errors when supported by the bundled SQLCipher version. | App capture plus debug-only diagnostic output without key material |
| DB-02 | P0 | Force-stop, relaunch, then reboot and relaunch `S1`. | Same rows/totals remain readable; no reseed, duplicate, or new-key behavior occurs. | Before/after counts and recording |
| DB-03 | P0 | On Android, extract the synthetic database from a debug sandbox; inspect the first bytes and search for known sentinel labels. For conditional Apple testing, first record whether an intentionally configured SQLCipher plaintext header is required. | Android file does not begin with `SQLite format 3`; schema names, notes, account labels, and sentinel values are not readable as plaintext. An approved Apple plaintext header, if later configured, exposes only documented header bytes and no schema/data. | Redacted byte/string-check output and cipher-header policy; do not commit the database |
| DB-04 | P0 | Attempt to open a copy with plain SQLite and then SQLCipher using an intentionally wrong key; perform `SELECT count(*) FROM sqlite_master`. | Plain SQLite and wrong-key SQLCipher cannot read the schema. A `PRAGMA key` call alone is not accepted because a read is required to test the key. | Error transcript without the real key |
| DB-05 | P0 | In disposable `S5`, preserve the encrypted DB but make its SecureStore key unavailable using controlled instrumentation or an emulator snapshot. | App fails closed at `DatabaseGate`; it does not generate a replacement key, overwrite/reseed the DB, or expose navigation. Retry remains possible after restoring the key. | Recording, row/file checksum before and after |
| DB-06 | P0 | Inject a malformed stored key in disposable `S5`. | Startup reports a recoverable database error and refuses replacement; existing database bytes remain unchanged. | Error capture and checksum |
| DB-07 | P0 | Open `S4` and upgrade to schema 7. | Upgrade is atomic; expected rows, IDs, balances, references, recurring provenance, and `user_version` are correct; reopen succeeds. | Pre/post manifest and integrity checks |
| DB-08 | P0 | Interrupt or kill the app during an instrumented migration/write on a disposable snapshot, then relaunch. | Database is either at the prior valid state or fully committed state; no partial schema/data state; integrity and foreign keys pass. | Fault timing, logs, integrity result |
| DB-09 | P1 | Exercise concurrent add/edit/delete, recurring catch-up, goal contribution, restore, and notification-driven cold start against `S2`. | No lock leak, duplicate financial mutation, lost update, or corruption; busy timeout resolves or a truthful error is shown. | Operation ledger and final expected totals |
| DB-10 | P1 | Inspect main DB plus `-wal` and `-shm` sidecars while WAL has pending content. | Known finance sentinel strings are not exposed in the main DB or WAL-related files. | Redacted string-check result |
| DB-11 | P1 | Corrupt a copy of the synthetic DB, then launch. | App does not silently reset or replace user data; error is actionable and retry does not compound damage. | Recording, checksum, error copy |
| DB-12 | P1 | Clear app data/uninstall, reinstall, and launch. | Old encrypted records are unavailable as expected; a clean database/key pair is created. Android backup does not restore a DB without its device key. | Install/data-reset log and empty-state capture |
| DB-13 | P1 | Run cold/warm starts and representative dashboard/history queries with `S2`. | No ANR or database-gate hang; record measured timings and compare to the release budget. Do not substitute desktop stress timings. | At least five samples per condition with device model |
| DB-14 | P2 | Inspect logs, crash reports, screenshots, and backups produced by all DB cases. | No SQLCipher key, PIN hash/salt, finance row, or full database path/content is emitted unnecessarily. | Redacted log review |
| DB-15 | P1 | Repeat DB-01/02 fresh-create and force-stop/reopen checks on `A-TABLET-REF`; repeat on iPad when Apple is in scope. | Tablet uses the same encrypted schema/key lifecycle and preserves expected rows/totals without form-factor-specific reset or error. | Tablet before/after manifest and external-camera evidence |
| DB-16 | P0 | With a disposable fixture, trigger foreground hydration and `defineRecurringCatchUpTask` near-simultaneously; exercise background catch-up before first device unlock after reboot; then invoke a debug-only `closeDatabase` hook and reopen. | Concurrent/native opens do not corrupt, duplicate, replace the key, or bypass unavailable SecureStore. Background failure is bounded, a later foreground retry opens the original data, and explicit close permits one clean reopen. | Timestamped task/app logs, counts, checksums; no key values |
| DB-17 | P0 | Inspect generated native key alias/service use and upgrade from a prior app version that stored the key under `com.example.financetracker.database-key`. | Existing key remains readable. The legacy service identifier is unchanged unless an explicitly tested read-old/write-new migration exists. | Generated config/source check and upgrade reopen evidence |
| DB-18 | P1 | Upgrade disposable encrypted v2 and v4 fixtures to v7, including recurring rows; delete a migrated rule; attempt to open a v7 copy with an older build; separately open a disposable `user_version=99` fixture. | Both upgrades preserve known data; scheduled dates survive backfill and later rule deletion. Downgrade is refused/unsupported without modifying the v7 copy. Future version 99 is rejected unchanged; neither downgrade nor forward compatibility is falsely claimed. | Pre/post manifests, checksums, older-build and future-schema errors |

## 7. App Lock, PIN, and biometric validation

App Lock is a local access gate, not account authentication and not the SQLCipher key. The system prompt is configured to use biometrics only (`disableDeviceFallback: true`); MoneyMap's 4-digit PIN is the intended fallback.

| ID | Priority | Setup and action | Pass criteria | Evidence |
|---|---:|---|---|---|
| AUTH-01 | P0 | Enable App Lock, set and confirm a valid PIN, background the app, return. | Root navigation is hidden and the lock screen appears; correct PIN restores the prior session. | Recording |
| AUTH-02 | P0 | With enrolled supported biometrics, unlock successfully. | Native prompt says `Unlock MoneyMap`; success unlocks once and does not reveal/store the biometric result in UI logs. | Physical-device recording/log review |
| AUTH-03 | P0 | Cancel the biometric prompt using `Use PIN`. | App stays locked, shows no false error/success, and PIN remains immediately operable. | Recording |
| AUTH-04 | P0 | Present a non-match/failed biometric. | App stays locked and permits a safe retry or PIN fallback; finance navigation never appears underneath. | Recording |
| AUTH-05 | P0 | Test no hardware, no enrollment, and native-service error states. | Biometric control is absent/disabled or returns to PIN without a crash or bypass. | Emulator plus device captures |
| AUTH-06 | P0 | Enter five wrong PINs, then the sixth and later failures. Relaunch during cooldown. | First five have no cooldown; persisted ladder begins at 30 seconds, then 60/300/900/3600 as exercised; input cannot bypass an active cooldown. | Timestamped recording/state log without PIN |
| AUTH-07 | P0 | After failures/cooldown, enter the correct PIN when allowed. | Unlock succeeds and the persisted failure counter resets. | Recording |
| AUTH-08 | P0 | Trigger Home/Recents, screen off/on, app switch, and process recreation. | Every true background transition relocks when enabled; sensitive screen is not briefly exposed on resume/recents. Android secure-screen behavior prevents sensitive snapshots. | External-camera recording plus blocked/black capture observation |
| AUTH-09 | P1 | Open and dismiss notification permission, biometric, share, and document-picker system surfaces without truly backgrounding. | Android `inactive`-like transitions do not unexpectedly lock mid-action; a true background still locks. | Recording per system surface |
| AUTH-10 | P1 | Change enrolled biometric data or disable device security after setup. | Biometric becomes unavailable/fails safely; stored MoneyMap PIN still works; no database loss occurs. | Before/after recording |
| AUTH-11 | P1 | Disable App Lock, background/relaunch, then re-enable with a new PIN. | Disabled state does not show the gate; cleared old PIN cannot unlock; new PIN does. | Recording |
| AUTH-12 | P1 | Launch with SecureStore preference/PIN state unreadable through controlled fault injection. | App follows the documented fail-closed route and does not expose finance navigation. | Fault log and screen capture |
| AUTH-13 | P1 | Use TalkBack/VoiceOver on the lock screen at maximum supported text size. | Digit count, delete, biometric action, error, cooldown, cancel-setup, and keypad keys are named, ordered, reachable, and not announced with raw icon names. | Screen-reader recording/transcript |
| AUTH-14 | P1 | Rapidly tap biometric and PIN actions, rotate, background, and terminate/relaunch while the prompt is open. | No duplicate prompt, unlock race, stuck overlay, crash, or bypass. Process death restarts in the locked state without retaining false success or busy state. | External-camera recording and crash log review |
| AUTH-15 | P2 | Reboot with App Lock enabled and launch before/after first device unlock. | SecureStore availability is handled without replacing secrets; app remains closed until valid unlock material can be read. | Reboot sequence recording |
| AUTH-16 | P1 | Exercise an Android Class 2/weak face method where available and a Class 3/strong method; record `biometricsSecurityLevel: "weak"` as the current policy. | Behavior matches the configured policy. Product/security review explicitly accepts Class 2 biometrics or raises a tracked change to require `strong`; no unsupported security claim is made. | Device modality/security class and recorded decision |
| AUTH-17 | P1 | Repeat enable, background relock, correct/wrong PIN, cancel, and biometric success or unavailable fallback on `A-TABLET-REF`; repeat on iPad when in scope. | Tablet never bypasses the gate; supported biometrics work, and unsupported hardware falls back cleanly to PIN without layout loss. | Tablet external-camera recording and modality record |
| AUTH-18 | P1 | Accumulate wrong-PIN failures, unlock biometrically, relock, then inspect the PIN cooldown. | Behavior matches the documented policy. Current code does not reset PIN failures on biometric success; the retained cooldown is visible and not misreported as reset. Any policy change gets a regression test. | Failure count/timestamps and external-camera recording |
| AUTH-19 | Conditional P0 | On Face ID iPhone/iPad, inspect visible copy, iconography, VoiceOver label, native prompt, permission denial, cancel, and PIN fallback. | Denial/cancel leaves PIN available without crash. Copy and accessibility labels use modality-neutral or correct Face ID language; no “fingerprint” instruction is announced/shown on a Face ID-only device. Current mismatch is filed rather than passed. | External-camera capture, VoiceOver transcript, defect ID |
| AUTH-20 | P1 | On a synthetic locked profile with unavailable biometrics, exercise a forgotten PIN scenario. | App does not provide a bypass or silently clear finance data. The absence of PIN recovery is explicitly disclosed in product/release documentation with an approved support/reset policy. | UI capture and approved product decision |

## 8. System notification validation

MoneyMap uses local bill reminders only. It does not require FCM/push delivery. New rules currently use a fixed 14-day lead. Expected scheduling is a DATE trigger at 09:00 local 14 calendar days before the due date, or an approximately two-second TIME_INTERVAL trigger when synchronization occurs inside that lead window. Foreground presentation uses banner/list without sound or badge.

| ID | Priority | Setup and action | Pass criteria | Evidence |
|---|---:|---|---|---|
| NOTIF-01 | P0 | From `undetermined`, enable reminders in app. | Permission is requested only after the user action, never on cold start; grant updates UI without duplicate prompts. | Recording |
| NOTIF-02 | P0 | Deny permission, including `canAskAgain=false` where supported. | No reminder is scheduled; the app shows an actionable system-settings hint and remains otherwise usable. | Recording and scheduled-list diagnostic |
| NOTIF-03 | P0 | Grant permission and inspect Android channel on API 26+. | `moneymap-reminders` / `Bill reminders` exists at default importance with expected vibration/light behavior; user channel changes are respected. | System settings capture |
| NOTIF-04 | P0 | Create an active recurring bill whose fire time is in the future. | Exactly one OS schedule exists with stable MoneyMap identifier, correct local date/time, bill title, amount/currency, due date, channel, and route metadata. | Scheduled request diagnostic, redacted |
| NOTIF-05 | P0 | Create/sync a bill already inside its lead window. | One reminder appears approximately two seconds after scheduling; repeated sync does not produce duplicate active reminders. | Timestamped recording and schedule count |
| NOTIF-06 | P0 | Observe due delivery with app foregrounded. | Banner/list is visible; sound and badge remain off; app content stays usable. | Recording |
| NOTIF-07 | P0 | Observe delivery with app backgrounded and terminated. | OS presents the notification once with correct content; finance data remains intact. | Recording for each state |
| NOTIF-08 | P0 | Tap a MoneyMap notification from foreground, background, killed, and locked states. | App opens Recurring & Reminders. If App Lock is active, finance content is not exposed before unlock and routing completes safely after unlock or returns to a safe default. | Recording for all four states |
| NOTIF-09 | P0 | Disable global reminders. | Existing MoneyMap schedules are cancelled; unrelated app/system notifications are unaffected; no new MoneyMap reminder fires. | Before/after schedule list |
| NOTIF-10 | P0 | Pause/delete a rule, disable its reminder, edit due date/amount/name, then resync. | Obsolete schedule is removed; one updated schedule remains when applicable; content and identifier match current data. | Before/after schedule list |
| NOTIF-11 | P1 | Advance recurring rule across a month boundary and run catch-up/sync repeatedly. | Old occurrence does not duplicate; next occurrence has a distinct stable identifier and correct new due date. | Rule/schedule manifest |
| NOTIF-12 | P1 | Change device time zone and cross a daylight-saving boundary where the locale observes one. | Due day and local 09:00 intent remain correct after resync; no day shift or duplicate. | Before/after time-zone evidence |
| NOTIF-13 | P1 | Reboot after scheduling, then open the app once with permission still granted. | Valid reminders survive or are deterministically rebuilt without duplicates; delivery remains correct. | Reboot recording and schedule list |
| NOTIF-14 | P1 | Revoke permission in system settings while app is backgrounded, then resume/relaunch. | UI detects denial, does not claim success, and restores scheduling after explicit re-grant and sync. | Recording |
| NOTIF-15 | P1 | Schedule multiple active bills with identical due times and long/non-ASCII names. | Each rule has one distinct schedule; notification content is understandable and safely truncated by the OS without collision. | Notification shade capture and count |
| NOTIF-16 | P1 | Simulate notification module/scheduling failure in a debug build. | Finance write remains committed or truthfully reported according to the initiating flow; scheduling error is visible and retryable; no crash. | Fault log and UI capture |
| NOTIF-17 | P2 | Use TalkBack/VoiceOver to inspect permission hint and delivered notification. | Hint and notification expose meaningful app/title/body/action text without relying on color or sound. | Assistive-technology recording |
| NOTIF-18 | P1 | On API 31+, test a future reminder under Doze/battery saver and inspect exact-alarm access/manifest policy. | Scheduled trigger intent remains correct. Actual timing meets the explicitly approved tolerance; if 09:00 exact delivery is required, the build has the necessary compliant exact-alarm design/permission. Delayed delivery is not reported as exact. | Manifest/settings capture and scheduled/actual timestamps |
| NOTIF-19 | P1 | Repeat permission, channel, scheduled delivery, and notification-tap routing on `A-TABLET-REF`; repeat on iPad when in scope. | Tablet schedules and presents one reminder, reports denial truthfully, and routes safely through App Lock to Recurring & Reminders. | Tablet settings capture, timestamps, and external-camera recording |
| NOTIF-20 | P0 | Cold-start the terminated app by tapping a reminder before `navigationRef` becomes ready; repeat while App Lock is enabled. | Tap intent is not silently dropped. It is queued until navigation is ready and, when locked, until safe post-unlock routing; otherwise a tracked defect blocks the routing claim. | Cold-start external-camera recording and navigation diagnostics |
| NOTIF-21 | P1 | In an instrumented debug build, force `getAllScheduledNotificationsAsync` to fail while a non-reminder app-local schedule exists, then sync reminders. | Failure does not cancel an unrelated app-local notification, or the fallback behavior is explicitly accepted and limited to a product with no other schedules. The result is logged as a safe diagnostic, not silent success. | Before/after schedule inventory and policy decision |

## 9. Accessibility compliance validation

Target WCAG 2.2 Level AA principles where they apply to native UI, plus Android and Apple platform accessibility guidance. MoneyMap's project rule is a practical minimum 44 dp touch target even though platform/WCAG exceptions may differ. Automated scanners are supporting evidence, not proof of conformance.

Run the following critical journeys using only the named assistive technology:

| Journey | Required completion |
|---|---|
| J1 First run | Splash, onboarding account/expense/lock decisions, dashboard arrival |
| J2 Daily finance | Add expense/income, verify dashboard, search history, open/edit transaction |
| J3 Planning | Create/edit budget, recurring bill/reminder, and savings goal/contribution |
| J4 Management | Manage account/category, import review/error, settings preferences |
| J5 Security/recovery | Unlock by PIN/biometric fallback, permission denial, database retry/error |

| ID | Priority | Procedure | Pass criteria | Evidence |
|---|---:|---|---|---|
| A11Y-01 | P0 | Complete J1-J5 with TalkBack on `A-PHONE-REF`. | Every task completes without sighted assistance; no focus trap, unreachable action, unlabeled actionable element, or destructive ambiguity. | Screen-reader recording and issue log |
| A11Y-02 | P1 | Repeat representative J1, J3, and J5 paths with TalkBack on `A-TABLET-REF`. | Reading/focus order follows the tablet visual order and all modal/sheet content remains reachable. | Recording |
| A11Y-03 | Conditional P0 | Complete J1-J5 with VoiceOver on supported iPhone; repeat representative flows on iPad. | Same completion standard as TalkBack; native rotor/navigation behavior is coherent. | Recording |
| A11Y-04 | P0 | Inspect every screen/state with Android Accessibility Scanner; use Xcode Accessibility Inspector/audits when Apple is in scope. | All findings are reviewed. No unresolved issue blocks task completion, labels, contrast, target size, or traversal. False positives have written rationale, not blanket suppression. | Export/screenshots and disposition list |
| A11Y-05 | P0 | Set largest system font/accessibility size and complete J1-J5 on compact phone. | Text is readable without clipping or overlap; controls remain operable; essential content/actions can be reached by scrolling; no two-dimensional scroll for ordinary content. | Screenshots and recording |
| A11Y-06 | P1 | Repeat large-text smoke on both tablet sizes and conditional iPad. | Layout reflows rather than leaving excessive unusable space or hiding actions; modal content scrolls. | Screenshots |
| A11Y-07 | P0 | Traverse each screen linearly, including Settings rows whose parent `Pressable` contains a trailing `Toggle`. | Focus order matches reading/task order; headings, selected tabs/radios, switches, progress values, disabled states, and errors are announced accurately. Parent row and nested switch do not create duplicate, conflicting, or unreachable actions. | Focus transcript |
| A11Y-08 | P0 | Open/close BottomSheet, calendar, text prompt, biometric prompt, picker, and alerts. | Focus enters the new surface, background content is not confusingly reachable, dismissal is named, and focus returns to the triggering control or a logical successor. | Recording |
| A11Y-09 | P0 | Trigger validation, permission, offline, empty, loading, success, and destructive-confirmation states. | Status is conveyed by text/semantics, not color alone; new errors and meaningful success are announced or immediately discoverable; corrective action is clear. | Recording/state matrix |
| A11Y-10 | P1 | Check all tappable controls with scanner/manual measurement. | Primary actions meet 44x44 dp; smaller visual chips use effective hit area/spacing without overlap; adjacent targets activate reliably. | Measurement screenshots |
| A11Y-11 | P0 | Measure light/dark/default/disabled/error/success/warning states. | Normal text contrast is at least 4.5:1; qualifying large text and UI component boundaries/states are at least 3:1; no essential state relies on color alone. | Contrast worksheet with sampled colors |
| A11Y-12 | P1 | Navigate with Android Switch Access or hardware keyboard; conditional iOS Switch Control/Full Keyboard Access. | All actionable controls are reachable/operable; focus is visible and unobscured; no keyboard trap; Enter/Space/Back/Escape behavior is logical. | Recording and key map |
| A11Y-13 | P1 | Enable reduced motion and repeat navigation/sheets/progress changes. | No required information depends on animation; platform reduction is respected where animation exists; no flashing content. | Setting and recording |
| A11Y-14 | P1 | Inspect spending chart, progress bars, budget state, and transaction signs. | Equivalent text communicates totals/categories/progress/direction; sign and label supplement color; progress has a meaningful value. | Screen-reader transcript |
| A11Y-15 | P1 | Exercise numeric PIN/keypad, money inputs, calendar/month controls, search, and import mapping. | Labels describe purpose, selected/value state is announced, input type does not block assistive entry, and hidden gestures are not the only path. | Recording |
| A11Y-16 | P1 | Change language/locale to a long-string locale or pseudo-localized build when available. | No essential label is clipped into ambiguity; numeric/currency/date speech remains understandable. Unsupported localization is recorded rather than claimed. | Screenshots/transcript |
| A11Y-17 | P1 | Verify screen changes after navigation, save, delete, and notification tap. | Screen title or logical first content receives/retains discoverable focus; users are not dropped at an arbitrary element. | Recording |
| A11Y-18 | P2 | Review accessibility tree for decorative icons/emoji and grouped transaction/card content. | Decorative items do not create noise; meaningful emoji has useful context; grouped elements do not hide nested actions. | Inspector/tree excerpts |

## 10. Phone and tablet visual/responsive validation

The responsive contract uses one breakpoint at 600 dp. Phone content is capped at 540 dp and tablet content at 760 dp; sheets are capped at 640 dp. This is a bounded single-column tablet treatment, not a desktop or multi-pane layout.

Review these six groups in empty, populated, loading/error, form/modal, and destructive/permission states where applicable:

| Group | Representative surfaces |
|---|---|
| V1 Onboarding/recovery | Splash, onboarding steps, database loading/error/retry |
| V2 Daily finance/history | Dashboard, entry, history, detail/edit, calendar |
| V3 Budgets/bills/goals | Budget cards/sheets, recurring list/form/reminder, goal card/contribution |
| V4 Accounts/import | Account management, file/paste import, preview/mapping/errors |
| V5 Tips/settings/categories | Settings, preferences, Smart Tips, Student Eats, category management |
| V6 Splash/App Lock | PIN setup/unlock, biometric availability/failure, cooldown/error |

The frame traceability sheet must contain: Figma page/frame/node ID, mobile/tablet pair ID, group, route/component, state trigger, expected interaction, fixture state, device/viewport, Figma revision, build checksum, baseline/candidate/diff artifact, result, defect, and reviewer. One row may reference one reusable component state used by several screens only when every affected frame is still listed.

| ID | Priority | Procedure | Pass criteria | Evidence |
|---|---:|---|---|---|
| UI-01 | P0 | In the visual-QA build, capture V1-V6 at 320/360 dp compact phone and 412 dp reference width in portrait; smoke the same states on the secure release candidate. | No horizontal clipping, overlap, unreachable action, cut-off amount, or content behind tab/system bars; long screens scroll. | Named QA screenshots plus release external-camera smoke |
| UI-02 | P0 | In the visual-QA build, capture V1-V6 at 600 dp boundary and reference tablet portrait widths; smoke the secure release candidate. | Layout switches at the intended boundary, centers within 760 dp, uses tablet padding, and does not stretch controls/cards across the full screen. | QA screenshots with viewport metadata plus release smoke |
| UI-03 | P1 | Repeat representative states immediately below/at/above 600 dp through emulator resize or split screen. | No oscillation, jump loop, blank edge, clipped sheet, or lost state at the breakpoint. | Resize recording |
| UI-04 | P0 | Rotate phone/tablet on dashboard, form, open sheet/calendar, import review, and lock screen. | Safe reflow or documented orientation behavior; no state loss, duplicated modal, keyboard trap, or inaccessible control. | Rotation recording |
| UI-05 | P0 | Open keyboards for all text/money/search/PIN/import fields on compact phone and tablet. | Focused field and primary action remain visible/reachable; keyboard dismissal works; sheet scroll and tab/FAB do not overlap input. | Recording |
| UI-06 | P0 | Test cutout, status bar, three-button navigation, gesture navigation, and bottom insets. | Top content, FAB, sheets, bottom tabs, and lock keypad remain inside safe interactive regions. | Screenshots per system mode |
| UI-07 | P1 | Use `S2` long names, largest valid amounts, many list items, empty/error copy, and non-ASCII text. | Text wraps/truncates intentionally, amount columns remain legible, rows do not collide, and lists remain performant. | Screenshots and scroll recording |
| UI-08 | P0 | Capture every representative state in light, dark, and system-following modes. Change system theme while app is open/backgrounded. | Theme updates consistently; status/navigation bars remain legible; no stale mixed-theme surface or low-contrast flash. | Paired screenshots/recording |
| UI-09 | P1 | Run at default and maximum font/display scaling on phone/tablet. | Same acceptance as A11Y-05/06; geometry adapts without essential truncation or overlap. | Screenshot pairs |
| UI-10 | P1 | Open each BottomSheet and dialog with minimum/maximum content. | Surface is centered/bounded appropriately, dismiss control is visible, content scrolls, and no action sits under keyboard/system bars. | Screenshot matrix |
| UI-11 | P1 | Check loading, empty, validation, permission denied, offline, success, and destructive confirmation states. | State is visually distinct, copy is readable, recovery action is present where applicable, and layout height changes do not jump behind controls. | State screenshots |
| UI-12 | P1 | Resize tablet in Android multi-window; conditional iPad split view. | App follows current window dimensions, crosses the 600 dp rule correctly, preserves task state, and does not assume physical screen size. | Resize recording |
| UI-13 | P1 | Compare visual-QA screenshots to the live Figma file for one representative state from every group/device class. Record page/frame/node ID, revision, QA build checksum, and secure release checksum. | No unexplained material difference in hierarchy, spacing, typography, color, assets, or state behavior. Automated pixel-diff thresholds are signals only; every material diff is reviewed. Release smoke shows no layout difference observable by external camera. | Figma baseline, QA candidate, diff, checksums, node/revision, release smoke, disposition |
| UI-14 | P1 | Measure cold launch, navigation, long-list scroll, sheet open, and save response on reference phone/tablet. | No visible ANR, prolonged blank frame, repeated input, or unusable jank; record measurements rather than claiming a universal performance result. | Timing table and recordings |
| UI-15 | P2 | Check screenshots with display color correction/grayscale and high-contrast settings where supported. | Meaning and actions remain distinguishable without hue alone; OS contrast changes do not hide content. | Screenshots |
| UI-16 | P2 | Inspect Recents/app switcher and screen capture on sensitive finance/lock screens. | Android secure-screen policy behaves as intended across phone/tablet; evidence contains no real data. | Redacted system capture |
| UI-17 | P1 | From the authenticated live Figma file, inventory the current 52 mobile and 52 matching tablet state frames. Map each frame/node to a route/component/state and native capture; exclude historical archive frames explicitly. | All 104 current references are accounted for, every mobile state has a tablet result, and every unimplemented/not-applicable state has a reviewed reason. State variants are not misreported as separate application routes. | Frame-to-code-to-capture matrix with node IDs and status |
| UI-18 | P1 | For frames representing interaction/failure variants, execute the transition that produces the state rather than only injecting or screenshotting it. | Focus, loading, error, success, permission, destructive, empty, modal, back/skip, and recovery states are reachable through the intended interaction and return safely. | State transition recording and matrix link |

## 11. Execution order and regression policy

1. Run PRE cases and reject stale/wrong-package binaries.
2. Run DB P0 cases before entering extensive data; encryption/key failures invalidate later persistence evidence.
3. Run AUTH and NOTIF P0 lifecycle cases on the primary physical phone.
4. Run DB-15, AUTH-17, and NOTIF-19 on the reference tablet.
5. Run A11Y critical journeys on the reference phone, then tablet representative paths.
6. Run UI state/device matrix and visual comparisons.
7. Repeat affected P0/P1 cases after every native dependency, Expo config/plugin, schema, SecureStore, AppState, navigation, reminder, theme, breakpoint, or shared-component change.
8. Before release, rerun PRE-01, DB-01/02/03/04/05/07/15/16/17, AUTH-01/02/03/05/08/12/17, NOTIF-01/02/04/07/08/09/10/14/19/20, A11Y-01/04/05/08/09/11, and UI-01/02/04/05/06/08/13/17/18 on the final artifact.

## 12. Evidence record template

Create one record per test ID or tightly related run:

```text
Test ID:
Status: PASS | FAIL | BLOCKED | UNVERIFIED | N/A
Priority/platform requirement:
Build commit/version/checksum/profile:
Device/model/OS/API:
Viewport/orientation/window mode:
Theme/font scale/display scale/locale/time zone:
Precondition and fixture state:
Exact steps:
Expected result:
Observed result:
Artifacts (log, screenshot, recording, audit, timing):
Defect ID and severity, if any:
Tester/date:
Notes and residual risk:
```

Use these severities:

| Severity | Native-suite meaning |
|---|---|
| Critical | Encryption bypass/key replacement/data loss, App Lock bypass, sensitive-data disclosure, unrecoverable corruption, release-wide crash |
| Major | Incorrect finance persistence, required notification failure, inaccessible critical journey, unusable phone/tablet layout, repeated crash/ANR |
| Minor | Recoverable edge defect, moderate accessibility/responsive issue, misleading noncritical state, isolated visual regression |
| Nit | Nonblocking cosmetic inconsistency with no task, accessibility, security, or data impact |

## 13. Final validation checklist

### Build and evidence

- [ ] Final artifact identity, commit, checksum, config, package ID, and device matrix are recorded.
- [ ] Jest, desktop stress, Expo Doctor, native prebuild/build, APK native-library inspection, and fresh install pass.
- [ ] Results distinguish debug instrumentation, release-candidate behavior, emulator evidence, and physical-device evidence.
- [ ] Release evidence confirms `FLAG_SECURE`; blocked capture uses an external camera, while any non-secure visual-QA build is checksum-labeled and never distributed.
- [ ] Evidence uses synthetic data and contains no database key, PIN material, credentials, or personal information.
- [ ] Every FAIL/BLOCKED/P2 deferral has a defect/owner, impact, and release decision.

### SQLCipher

- [ ] Fresh native database reports SQLCipher support, migrates to schema 7, and passes integrity/foreign-key checks.
- [ ] Extracted synthetic DB and WAL data do not expose SQLite header/schema/sentinel finance text.
- [ ] Plain SQLite and wrong-key SQLCipher cannot read `sqlite_master`.
- [ ] Correct SecureStore key survives force-stop, relaunch, and reboot.
- [ ] Foreground hydration and background recurring catch-up share the encrypted database safely, including pre-first-unlock failure/retry.
- [ ] The shipped legacy SecureStore service/alias remains readable across upgrade; no cosmetic rename or key orphaning occurs.
- [ ] Missing/malformed key and corrupt DB fail closed without replacement, reseed, or overwrite.
- [ ] Older schema upgrade and interrupted write/migration preserve atomicity and known totals.
- [ ] Clear-data/uninstall behavior and disabled Android backup are verified.
- [ ] Native performance is measured separately from desktop SQLite stress results.
- [ ] Fresh-create and reopen persistence pass on both reference phone and reference tablet.

### App Lock and biometrics

- [ ] App Lock hides root navigation after every true background transition.
- [ ] Enrolled biometric success works on physical hardware.
- [ ] Cancel, non-match, unavailable hardware, no enrollment, and native errors keep the app locked with PIN fallback.
- [ ] Android weak/Class 2 versus strong/Class 3 biometric acceptance matches a documented product/security decision.
- [ ] PIN cooldown persists and cannot be bypassed by relaunch; correct PIN resets failures.
- [ ] Permission/share/picker/biometric system surfaces do not spuriously lock unless the app truly backgrounds.
- [ ] Process death, reboot, enrollment changes, and unreadable secure state fail closed without data loss.
- [ ] Biometric unlock after PIN failures follows the documented cooldown-reset policy.
- [ ] Face ID devices use correct/modality-neutral visible and spoken copy when Apple is in scope.
- [ ] Forgotten-PIN behavior has no bypass and has an approved, truthful recovery/reset policy.
- [ ] Lock screen is usable with screen reader, large text, rotation, and rapid input.
- [ ] Recents/screenshots do not expose sensitive finance UI on Android.
- [ ] App Lock/PIN plus biometric success or unavailable fallback pass on the reference tablet.

### Notifications

- [ ] Permission is requested only after an explicit enable action.
- [ ] Grant, deny, permanent deny, system revocation, and re-grant paths are truthful and recoverable.
- [ ] Android reminder channel exists with the intended user-visible configuration.
- [ ] Future and inside-window reminders schedule once with correct local time/content/metadata.
- [ ] Foreground, background, terminated, reboot, time-zone, and month-advance delivery paths are verified.
- [ ] API 31+ exact-alarm/Doze behavior meets a documented timing tolerance and permission policy.
- [ ] Notification tap routes safely to Recurring & Reminders, including while App Lock is active.
- [ ] Terminated cold-start taps are retained until navigation and App Lock routing are ready.
- [ ] Edit, pause, delete, per-rule disable, and global disable cancel/rebuild only applicable MoneyMap schedules.
- [ ] Schedule-enumeration failure does not silently cancel unrelated app-local schedules without an explicit approved policy.
- [ ] Scheduling failures do not corrupt or falsely report finance writes.
- [ ] Permission, delivery, and tap routing pass on the reference tablet.

### Accessibility

- [ ] J1-J5 complete with TalkBack on the reference Android phone; representative paths pass on tablet.
- [ ] VoiceOver/iPad checks pass when Apple release scope applies.
- [ ] Scanner/Inspector findings are individually resolved or justified; no blanket suppression exists.
- [ ] Maximum text/display scale preserves readable, reachable actions on compact phone and tablet.
- [ ] Focus order, roles, names, values, selected/disabled state, errors, and status changes are correct.
- [ ] Sheets/dialogs/prompts manage entry, containment, dismissal, and return focus logically.
- [ ] Keyboard/Switch Access operation has visible focus and no trap.
- [ ] Text contrast, UI contrast, non-color meaning, and effective touch targets meet the documented criteria.
- [ ] Charts, progress, signs, icons, and emoji have equivalent text or useful semantics.

### Visual responsiveness

- [ ] V1-V6 representative states pass at compact/reference phone and 600 dp/reference tablet widths.
- [ ] Each visual baseline records the live Figma file revision plus exact page/frame/node ID; no thumbnail or archive-only comparison is treated as acceptance.
- [ ] Portrait, landscape, cutout, gesture/three-button navigation, keyboard-open, and multi-window states pass.
- [ ] The 600 dp breakpoint, 540/760 dp content caps, and 640 dp sheet cap behave as designed.
- [ ] Light/dark/system themes and runtime theme changes remain consistent and legible.
- [ ] Long labels, large amounts, dense lists, empty/error/loading/success states, and large text do not clip essential content.
- [ ] One approved visual comparison per UI group and form factor has no unexplained material difference.
- [ ] The authenticated 52-mobile/52-tablet current frame inventory is fully mapped to code, reachable states, native captures, and pass/fail status; archive frames are excluded.
- [ ] Interaction/failure variants are reached through actual user/system transitions, not accepted from static mock rendering alone.
- [ ] Visual-QA and secure release artifacts come from the same commit, their sole documented difference is capture enablement, and representative release states receive an external-camera smoke check.
- [ ] Native timing/jank observations are recorded for both reference phone and tablet.

## 14. Authoritative references

- [Expo SDK 54 LocalAuthentication](https://docs.expo.dev/versions/v54.0.0/sdk/local-authentication/)
- [Expo SDK 54 Notifications](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/)
- [Expo SDK 54 SecureStore](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/)
- [SQLCipher API: testing a key](https://www.zetetic.net/sqlcipher/sqlcipher-api/#testing-the-key)
- [Android: test your app's accessibility](https://developer.android.com/guide/topics/ui/accessibility/testing)
- [Android notification runtime permission](https://developer.android.com/develop/ui/views/notifications/notification-permission)
- [Android exact-alarm behavior](https://developer.android.com/about/versions/12/behavior-changes-12#exact-alarm-permission)
- [Apple: VoiceOver evaluation criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/voiceover-evaluation-criteria)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
