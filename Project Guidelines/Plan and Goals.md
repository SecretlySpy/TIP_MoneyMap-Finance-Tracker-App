# Plan and Goals

## UI/backend development-plan execution (2026-10-03)

This section is the active manual-planning record for the user-supplied
`MoneyMap-UI-Backend-Development-Plan-and-Prompt.md`. The older reconciliation and QA
sections below remain historical evidence. No native Plannable files or CLI state exist in
this checkout.

### P0 audit baseline

- Branch: `main`; inspected HEAD: `c4539bb2de7270a1570c71f7c92f3ecdaa87dab2`.
- Worktree was clean before implementation.
- Runtime used for the baseline: Node `v24.16.0`, npm `11.13.0`; the release baseline remains
  Node 22 LTS.
- `npm test -- --watch=false`: **37/37 suites and 232/232 tests passed**.
- The installed application is Expo SDK 54 / React Native 0.81 with Zustand and OP-SQLite
  SQLCipher schema version 4. There is no owned REST/GraphQL backend.
- Live Figma retrieval was attempted for file `JeEeOG1jZ0B72pA8gf7fMk`, node `75:172`, but the
  connector requires reauthentication. The supplied 52-mobile/52-tablet state inventory is
  therefore user-supplied evidence; live parity is **UNVERIFIED**.

### Conflict and gap decisions

| Evidence/location | Conflict or gap | Impact | Selected resolution | Validation |
|---|---|---|---|---|
| `src/store/financeStore.js`, `package.json` | Older design notes mention Context/useReducer, while the app uses Zustand | A second store would split financial ownership | Keep Zustand as the single UI financial source and repositories/SQLite as durable authority | Store and repository tests |
| `Project Guidelines/Design Prototype.md` vs supplied plan | Existing docs claim 22 frames; the supplied current inventory has 52 states per device | Traceability and completion claims are stale | Map state variants to existing routes/components/tests; do not create 104 route components | Updated state matrix; live Figma remains UNVERIFIED |
| `src/store/financeStore.js:addTransaction`, `EntryScreen.jsx` | New transactions always use `Date.now()` | Users cannot backdate entries; monthly aggregates may be wrong | Add explicit date selection and pass a validated date-only timestamp to the store | Store/UI regression tests across months |
| `src/components/MonthChip.jsx` | Tap means previous month and hidden long-press means next month; no direct jump or date selection | Poor discoverability/accessibility; supplied budget-calendar acceptance is unmet | Replace the gesture shortcut with an explicit calendar popover, previous/next controls, and direct month/year navigation | Component tests and budget-period checks |
| `SplashScreen.jsx`, `uiStore.js` | First run is only a welcome screen | No durable account/first-expense draft, safe resume, or explicit optional-lock step | Add a persisted resumable onboarding flow; keep skip/back and failure drafts truthful | Service/store/UI tests; SecureStore/device behavior remains UNVERIFIED |
| `ImportScreen.jsx`, `financeStore.js`, schema v4 | Candidate duplicates are reviewed, but a retry after commit plus refresh failure can write rows twice | Financial totals can duplicate after an uncertain result | Add per-row import provenance with a unique nullable transaction source key and idempotent reconciliation | Migration, repository, import retry, rollback tests |
| `ScreenContainer.jsx` | Phone-width content is merely capped at 540 dp | Tablet behavior exists but current 834 dp parity is not evidenced | Add bounded tablet-width adaptation without a desktop layout or screen fork | Static/component checks; real tablet visual check UNVERIFIED |
| SQLCipher config and native plugins | JavaScript tests cannot prove encryption, biometric, notification, or migration behavior on-device | Security/release claim risk | Preserve current native configuration; do not relabel static tests as device acceptance | Fresh dev-client/device matrix remains UNVERIFIED |

### Active requirements and implementation slices

| ID | Requirement | Acceptance | Status |
|---|---|---|---|
| FR-09 | Accessible period selection | A visible control supports previous/next, direct month/year navigation, and day selection; budget totals use the selected month | Implemented; component tests passed, device layout unverified |
| FR-10 | Backdated transaction entry | A valid selected date is saved; invalid input is rejected; successful save opens that month in History | Implemented; store/UI tests passed |
| FR-11 | Resumable onboarding | Account setup, optional first expense, optional lock, back/skip, failure retention, and restart resume avoid duplicate effects | Implemented; service/store/UI tests passed, native SecureStore unverified |
| FR-12 | Import retry idempotency | Invalid rows remain blocked, candidates start excluded, explicit includes work once, and retry reconciles committed rows without a second effect | Implemented; import, edit/re-import, paste, and rollback tests passed |
| FR-13 | Current state traceability | Supplied 52-state mobile groups are mapped to routes/components/states/checks, with matching tablet behavior identified separately | Six groups mapped; individual 104 frames and visual parity unverified without Figma access |
| NFR-05 | Offline/data boundary | Core finance stays local and usable without a hosted backend; no cloud account or sync is introduced | Source/test verified; native offline smoke test open |
| NFR-06 | Data recovery | Schema upgrade preserves existing rows; restore accepts legacy backups and validates new provenance before replacement | SQLite fixture and rollback tests passed; native SQLCipher migration open |
| NFR-07 | Responsive/accessibility | Primary actions remain reachable with keyboard/scroll, named controls, non-color errors, and practical 44 dp targets on phone/tablet | Static/component checks passed; native phone/tablet review open |

Local implementation slices (1) date/period controls, (2) schema 5–7 provenance, migration/recovery,
(3) resumable onboarding, and (4) bounded responsive behavior have been implemented and exercised in
Jest/desktop SQLite. Phase P5 is **partial**: 45 suites / 307 tests, Android JS export, Expo Doctor,
and desktop stress passed on 2026-10-03, but per-frame Figma parity, native SQLCipher/security and
notification flows, and real phone/tablet acceptance remain open. No deployment, publication,
production data change, hosted backend, cloud sync, or paid service was authorized or performed.

## QA execution scope (2026-09-28)

The subsequent user request authorizes direct remediation of QA findings and a documented local stress baseline. This is a manual Markdown adaptation, with no native Plannable state. Scope: the existing mobile UI/store/repository flow, local SQLite integrity/concurrency, mocked external-client failures/privacy, SDK patch compatibility, and synthetic load up to 10,000 starting transactions / 100 budgets and recurring rules / 32 local operations or connections. No owned HTTP server exists, and no production/public-provider load was performed. The five SDK 54 patch updates are part of this later QA scope; the earlier reconciliation non-goals remain historical.

Acceptance: exact accounting under concurrent writes, atomic negative cases, valid backup round trips with corrupt-input rejection, controlled network deadlines, full Jest regression, and separately labeled native/external gaps. Desktop stress targets are zero errors, dashboard p95 below 50 ms, and writer p99 below 5,000 ms. Local implementation and checks passed; native release acceptance and dependency security remain open. See [QA Verification Report](./QA%20Verification%20Report%202026-09-28.md).

Updated: 2026-09-27  
Status: implementation complete; native device verification open

## Outcome

Reconcile the MoneyMap app, tests, documentation, and the approved Figma page without changing the
offline-first architecture, persisted IDs, or v0.1.0 product boundary.

## Scope and acceptance

| ID | Requirement | Acceptance | Status |
|---|---|---|---|
| FR-01 | Safe to Spend | Monthly budget headroom minus unposted in-month recurring expenses and the monthly deadline-goal contribution; no double count; show a shortfall below zero | Complete |
| FR-02 | Account fidelity | Entry and History use named accounts; imports preserve each source label and require an existing/new-account resolution | Complete |
| FR-03 | Atomic import | Invalid/unresolved input creates no accounts or transactions; success commits all changes together and opens History | Complete |
| FR-04 | Optional lock | PIN/biometrics gate access only; PIN material never becomes the SQLCipher key | Complete |
| FR-05 | Student Eats | Use fixed TIP Quezon City origin; request no device location; describe network/cache behavior truthfully | Complete |
| FR-06 | Navigation | Successful entry/import opens History; failures remain in context | Complete |
| FR-07 | Recurring defaults | New reminder lead time is 14 days; existing persisted values remain unchanged | Complete |
| FR-08 | App/Figma parity | Approved templates, categories, copy, actions, forms, and prototype routes agree | Complete |
| NFR-01 | Privacy | Offline core; no new permission, backend, credential flow, or sensitive-data transmission | Complete |
| NFR-02 | Integrity | Integer minor units, existing database IDs, foreign keys, and schema migration history remain stable | Complete |
| NFR-03 | Accessibility | Named controls, readable warning/empty states, and at least 44 px primary quick targets | Complete by static review; device check open |
| NFR-04 | Verification | Unit/static suite, Expo config, export, native build, and device flows are reported separately | Partial: native/device open |

## Non-goals

- Backend or cloud sync, account transfers, budget rollover, transaction editing/search, or import de-duplication.
- GPS-based Student Eats, new packages, schema-ID rewrites, production release, or deployment.
- Automatic dependency upgrades in response to audit/Expo Doctor output.

## Assumptions

| ID | Assumption | Reason | Impact if wrong | Status |
|---|---|---|---|---|
| A-01 | Hydration runs recurring catch-up before the Dashboard snapshot | Existing store lifecycle | Stale rules could make a projection incomplete | Verified in code path |
| A-02 | A posted recurrence keeps its scheduled run timestamp | Catch-up idempotency contract | Safe-to-Spend could reserve it twice | Verified in service and tests |
| A-03 | TIP Quezon City is the only Student Eats origin for v0.1.0 | Approved decision | Search relevance differs for remote users | Approved |
| A-04 | Re-importing a file may duplicate transactions | De-duplication is out of scope | User can overstate totals | Documented warning |

## Milestones

1. Inspect and establish baseline — complete (`main` at `fe14d83bb5aeb4c5b4ecb499a6c79c1b3f34139d`).
2. Reconcile calculations, import, account identity, navigation, lock copy, tips, Student Eats, and reminders — complete.
3. Reconcile the named Figma page and routes — complete.
4. Run JS/config/export checks and record native/device gaps — complete.

See [Verification and Evaluation.md](./Verification%20and%20Evaluation.md) and
[Decisions and Handover.md](./Decisions%20and%20Handover.md).
