# Plan and Goals

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
