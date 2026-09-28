# MoneyMap QA Verification Report — 2026-09-28

Owner: Coding Companion, applying QA automation, architecture, data integrity, security/privacy, and reliability review. Baseline: clean checkout at `21d0efb`. No production service, user database, credentials, or public provider was load-tested. Local changes are uncommitted and reversible. Native release acceptance remains **UNVERIFIED**.

## 1. Executive Test Summary

The baseline had **168 tests: 167 passed, 1 failed**, across 28 Jest suites. The final run has **199 tests: 199 passed, 0 failed**, across **32 suites**, with no exclusions or skipped tests. Thirty-one new cases exercise persistence concurrency, screen/store/SQLite flows, corrupt backups, remote failure handling, privacy boundaries, and large-ledger aggregation. These are component/integration checks; the file named `e2eVerification.test.js` does not drive an operating-system UI.

The reproducible local stress run completed **1,829 measured operations, 0 errors (0%)**, using 10,000 starting transactions, 100 budgets, 100 recurring rules, and concurrency stages of 1, 4, 16, and 32. The final database held **18,580 transactions** with `integrity_check = ok` and **zero foreign-key violations**. Dashboard p95 fell from **109.97 ms** before the aggregation fix to **15.19 ms** in the final run. Background workload differed between runs; these are observed workstation measurements, not a controlled device benchmark.

### Inspected stack and entry points

| Item | Actual configuration |
|---|---|
| App | Expo SDK 54.0.37, React 19.1.0, React Native 0.81.5, Zustand 5.0.14 |
| Entry points | `package.json` → Expo `AppEntry.js` → `App.js`; `src/navigation/RootNavigator.jsx`; `src/store/financeStore.js` |
| Persistence | OP-SQLite 17.1.3 with SQLCipher; schema version 4; six local finance tables |
| Owned backend | **N/A**: no REST/GraphQL server, microservice deployment, connection pool, or server authentication |
| External clients | Overpass POST, Nominatim GET, and consent-gated Gemini POST; tested with injected responses/abort-aware fetch doubles |
| Functional tools | Jest/Jest Expo 54.0.18, React Native Testing Library 14.0.1, real SQLite through better-sqlite3 12.11.1 and the production SQL adapter |
| Stress tools | `scripts/qa-stress.cjs`; actual file-backed SQLite WAL, `synchronous=FULL`, worker threads, and 32 independent connections at peak |
| Host | Windows x64, Node 24.16.0, npm 11.13.0, Intel i7-10875H, 16 logical CPUs; native build attempted with an existing JDK 21 |

### Scope and evidence matrix

| Test area | Executed evidence | Status / limit |
|---|---|---|
| Entry UI → store → database → History | Successful Lunch-template submission, disabled invalid form, injected save failure, no false navigation | **PASS** in React Native component integration; navigation and OS providers are doubles |
| Import and backup | Named account resolution, transaction rollback, valid goal/transaction round trip, dangling references, malformed collections, duplicate IDs, unsafe money | **PASS** against actual SQLite |
| Money, budgets, goals, history, reminders, App Lock, preferences | Existing suites plus new exact large-ledger and concurrent-operation checks | **PASS**; SecureStore, notifications, and biometrics remain mocked |
| Remote client boundaries | Consent/disabled gates, schema rejection, HTTP 401/429/500/503, malformed JSON, stalled requests, shared fallback deadline | **PASS** with local doubles; live providers **UNVERIFIED** |
| Migrations and constraints | Fresh migrations, real version-2 upgrade, repeat migration, future-version rejection, restricted deletion and type consistency | **PASS**; SQLCipher native migration behavior **UNVERIFIED** |
| Query planning | Month-range query uses date index; recurring duplicate check uses recurring-rule index | **PASS**, plans retained in stress JSON |
| Responsive/accessibility behavior | Existing token, contrast, roles, progress/empty-state checks; form disabled/error behavior; inspected scrolling/max-width wrapper | **PARTIAL**: no native screen-reader, font-scaling, keyboard, rotation, or tablet acceptance |
| SDK/dependency consistency | `npx expo-doctor`: **18/18**; `npm ls --depth=0`: no missing/invalid direct dependency | **PASS** at direct-package level; npm emitted a transitive test-renderer peer warning |
| Android JS export | `npx expo export --platform android --output-dir .expo/qa-export` | **PASS**, Metro/Hermes bundle; not an APK test |
| Native build and device E2E | JDK 21 debug build attempted; isolated API 35 AVD booted; old APK installed and launched | **UNVERIFIED**: Kotlin daemon connection failures, terminated build, old APK package mismatch, Android system ANR |
| Production dependency audit | `npm audit --omit=dev --json`: **24 advisories, 18 moderate, 6 high** | **FAIL**; remaining release risk |
| Whitespace | `git diff --check` | **PASS** |

### Final peak-load metrics

All latencies are milliseconds. Quantiles use the nearest-rank method over successful operation durations. Worker startup is excluded from writer throughput; SQLite lock wait and commit time are included. Single-operation import duration is a batch measurement, not a statistically meaningful p95/p99.

| Scenario | Operations | p95 | p99 | Successes/second | Errors |
|---|---:|---:|---:|---:|---:|
| Dashboard: 10k rows, 100 budgets, 100 rules | 100 | 15.19 | 15.97 | See JSON | 0 |
| Goal contributions, concurrency 32 | 512 | 28.75 | 66.27 | See JSON | 0 |
| Catch-up callers, concurrency 32 | 32 | 56.61 | 56.71 | See JSON | 0 |
| WAL writers, concurrency 1 | 16 | 16.75 | 16.75 | 97.63 | 0 |
| WAL writers, concurrency 4 | 64 | 25.47 | 154.72 | 294.23 | 0 |
| WAL writers, concurrency 16 | 256 | 171.03 | 1,191.19 | 176.33 | 0 |
| WAL writers, concurrency 32 | 512 | 335.27 | 2,517.33 | 165.54 | 0 |

The remaining stages are goal concurrency 1/4/16 (16/64/256 operations) and one atomic 10,000-row insert batch (**1,436.67 ms**). Writer operations each commit 10 rows. All 100 due bills were posted exactly once across 32 simultaneous callers; all 848 goal contributions were retained exactly.

The selected desktop baseline met all three recorded targets: zero operation errors, dashboard p95 below 50 ms, and writer p99 below the 5,000 ms busy timeout. Lock contention caused throughput degradation after four writers and increasing tail latency at 16/32 writers. This is a local SQLite saturation result, not HTTP RPS or a guarantee for concurrent mobile users.

Main-process CPU time was 9.77 user seconds plus 2.17 system seconds. Event-loop p95/p99/max delay was 20.84/51.31/942.15 ms. RSS increased from 104.6 MiB to 363.1 MiB while measured heap changed from 28.93 MiB to 28.84 MiB. Samples include module loading, seeding, worker lifecycle, and warmup; they do not establish leak freedom, thermal throttling, device memory use, or total worker CPU/memory. A long-duration native soak remains open.

## 2. Itemized Issues & Fix Log

| Test ID / Area | Observed failure | Root cause | Files modified / applied change | Resolution status |
|---|---|---|---|---|
| QA-DB-01 / composed CRUD | Baseline `cannot start a transaction within a transaction`; production-shaped executor reproduced `database.transaction is not a function` | Single-statement helpers opened their own transaction even inside a caller-owned transaction | `src/db/repositories/shared.js`: execute atomic SQL statements on the supplied executor; test adapter now queues transactions and exposes the same scoped shape as production | **Verified resolved**: original suite, composed CRUD/rollback, stress batch |
| QA-DB-02 / goal contributions | 32 simultaneous +100 contributions stored 100 instead of 3,200 | Read/current + write/new allowed lost updates | `src/db/repositories/goalRepository.js`: guarded atomic SQL increment with `RETURNING`; reject missing goals/unsafe totals | **Verified resolved**: exact 32-call result, overflow negative case, 848 stress contributions |
| QA-DB-03 / recurring races | 32 callers created 32 copies of one scheduled bill | Duplicate check and insertion ran outside a shared transaction; each caller read the same stale schedule | `src/services/recurringCatchUp.js`: read rules, check prior posts, insert, and advance within one queued transaction | **Verified resolved**: 32-call reproduction and 100-rule stress burst |
| QA-DB-04 / recurring partial failure | Schedule-update failure left a committed bill post | Posts and schedule advancement had separate commits | Same recurring service transaction; scoped failure injection in `qaPersistence.test.js` | **Verified resolved**: injected advance failure leaves zero posts and unchanged due date |
| QA-DATA-01 / damaged backups | Restore silently omitted a transaction with an unknown account; malformed collection became empty data | Restore loops used `continue`; parser coerced malformed collections; duplicate IDs overwrote ID maps | `src/services/dataTransfer.js`, `src/store/financeStore.js`: validate collections, unique IDs and references before replacement; fail on unmapped rows | **Verified resolved**: corrupt input preserves original rows; valid backup still round-trips; omitted legacy optional collections remain supported |
| QA-DATA-02 / unsafe backup money | Oversized goal target committed, then refresh threw; original goal ID/value was replaced | SQLite accepts 64-bit integers outside JS's exact integer range; validation happened after COMMIT | `src/services/dataTransfer.js`: validate persisted money/timestamps and optional goal deadline as safe integers before any destructive restore statement | **Verified resolved**: failure reproduction asserts original SQL rows remain unchanged |
| QA-NET-01 / places fallback | HTTP-error branch returned an unawaited fallback; fallback had no abort signal and could reject or stall outside the deadline | Promise returned past `finally`, and fallback fetch did not share cancellation | `src/remote/placesClient.js`: one controlled fallback in catch, awaited under the original deadline, propagated AbortSignal | **Verified resolved**: both HTTP providers fail safely; stalled fallback aborts at 18 seconds; timers released |
| QA-PRIV-01 / Smart Tips payload | Validator accepted an unexpected address field, nested notes, invalid month, negative/infinite ratios | Denylist missed unknown fields; numerical/calendar validation was incomplete | `src/remote/smartTipsClient.js`: allowlist top-level/ratio keys; real month and finite [0,1] ratios | **Verified resolved**: five malformed/privacy payloads rejected before fetch |
| QA-PERF-01 / dashboard aggregation | Pre-fix p95/p99 109.97/128.97 ms | Budget cards scanned the full ledger per budget; recurring projection scanned it per rule | `src/domain/services/financeView.js`, `safeToSpend.js`: one category aggregate and one posted-run index | **Performance optimized**: final p95/p99 15.19/15.97 ms; independent 10k-row exact-total regression and existing approved figures pass |
| QA-ENV-01 / SDK patch drift | Expo Doctor 17/18: five expected patch versions differed | Manifest/lockfile lagged the installed SDK's compatibility table | `package.json`, `package-lock.json`: patch Expo, Constants, File System, Local Authentication, Jest Expo within SDK 54 | **Verified resolved**: 18/18, direct dependency inventory, full Jest run and export |

Harness changes: `__tests__/support/testDatabase.js` preserves in-memory unit isolation and adds file-backed WAL support; `qaPersistence.test.js`, `qaRemoteResilience.test.js`, `qaStoreFlows.test.jsx`, and `qaAggregation.test.js` provide focused regressions. `scripts/qa-stress.cjs` and `npm run test:stress` reproduce load locally. Native SQLite constraint assertions match SQLite error codes instead of relying on a JavaScript Error prototype across Jest VM contexts; RESTRICT may report either FOREIGNKEY or TRIGGER constraint codes.

No schema migration or unique index was added. Recurring idempotency is enforced through the service transaction. The aggregation cost changes from repeated scans to O(T + B log B) for budget cards, including their existing sort, and O(T + scheduled occurrences) for recurrence projection; extra maps consume O(categories + posted occurrences) memory. These are code-only fixes with unchanged persisted IDs/contracts.

## 3. Residual Gaps & Recommendations

1. **Native E2E / SQLCipher / device acceptance — UNVERIFIED.** The current code exports successfully but no fresh debug APK completed. JDK 21 build logs show Kotlin compile-daemon connection failures and fallback compilation before the attempt was terminated. This SDK installation also lacks `build-tools/`. The reused APK installs as `com.example.financetracker`, while current configuration requires `com.moneymap.financetracker`; its launch is not acceptance of the current native project. The isolated API 35 AVD showed `Process system isn't responding`. Retry sequentially on a stable device/AVD with Node 22/JDK 21 and required SDK/build tools, build a fresh matching client, then drive entry/history, budgets, recurring bills, goals, imports/restore, PIN/biometrics, permissions and offline recovery. QA Metro/emulator/build-client helpers were stopped.
2. **Dependency security — OPEN / release risk.** Final production audit remains 24 advisories (18 moderate, 6 high). `xlsx@0.18.5` is affected by [prototype pollution](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) and [regular-expression denial of service](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9). The npm package has no fixed release listed by those advisories. Select and verify a maintained parser or reviewed upstream distribution, including malicious workbook and bundle tests; the SDK patch update does not resolve this. No forced major downgrade/upgrade was applied. npm also reported the existing test-renderer reconciler peer expectation against React 19.1; the direct dependency check and tests pass but are not transitive compatibility certification.
3. **Live providers — UNVERIFIED.** All network failure/consent/schema checks use injected responses and a synthetic API key. Real Gemini availability/model/key configuration, OSM quotas and response compatibility were not exercised. Never stress public providers with this harness. Keep credential-bearing requests and payloads out of public logs.
4. **Accessibility, responsiveness and lifecycle — PARTIAL.** Component roles/disabled states/contrast checks passed. Screen-reader navigation, large text, keyboard overlays, rotation/tablet sizing, notification delivery, background task scheduling, SQLCipher key recovery and biometric behavior require native execution.
5. **Long-running performance — UNVERIFIED.** The finite 32-connection burst passed without SQLite busy errors or corruption. It does not prove absence of leaks, deadlocks at other schedules, battery/thermal degradation, or indefinite stability. A device soak and representative large-history scrolling/refresh measurements should precede performance claims. Further pagination/index work should follow those measurements; no speculative schema change was introduced.

### Reproduction and artifacts

Run from the repository root after installing the committed lockfile:

```powershell
npm ci
npm test -- --runInBand
npm run test:stress -- .expo/qa-stress.json
npx expo-doctor
npx expo export --platform android --output-dir .expo/qa-export
npm audit --omit=dev --audit-level=high
git diff --check
```

`npm ci` was not executed in this QA run; it is the clean-checkout reproduction path. The compatible patch install was repaired after Windows ENOTEMPTY/EPERM errors by stopping the owned Metro process and rerunning npm installation. Verification occurred after the completed install, not during its partial state. Windows execution is observed; Linux/macOS commands and the documented Node 22 baseline remain unverified here.

- [Functional check summary](../docs/qa/2026-09-28/check-summary.json)
- [Final stress metrics and query plans](../docs/qa/2026-09-28/stress-final.json)
- [Pre-aggregation stress metrics](../docs/qa/2026-09-28/stress-before-aggregation-fix.json)
- Full local logs/reproductions: `.expo/qa-final-tests.log`, `qa-persistence-before.json`, `qa-store-before.json`, `qa-unsafe-backup-before.log`, `qa-native-build.log`, `qa-native-window.xml`, and `qa-audit-final.json` (ignored local evidence; no private database/key material was exported).
- Current engineering owners: [Verification and Evaluation](./Verification%20and%20Evaluation.md), [Database Structure](./Database%20Structure.md), [Backend Functionalities](./Backend%20Functionalities.md), [Decisions and Handover](./Decisions%20and%20Handover.md).

Rollback is scoped restoration of the changed source, test harness and the five dependency patch updates, followed by dependency reinstall and verification. Do not reset unrelated changes or rewrite shared history. This rollback would reintroduce the confirmed defects; no production deployment or destructive user-data action occurred.
