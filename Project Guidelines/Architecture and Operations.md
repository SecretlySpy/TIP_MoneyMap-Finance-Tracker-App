# Architecture and Operations

Updated: 2026-10-07

## Runtime context

```mermaid
flowchart LR
  U[Student] --> UI[React Native screens]
  UI --> S[Zustand stores]
  S --> D[Domain services]
  S --> R[Repositories]
  R --> DB[(SQLCipher SQLite)]
  SS[SecureStore] --> K[SQLCipher key]
  K --> DB
  SS --> O[Onboarding / preferences / PIN]
  UI --> N[Local notifications]
  UI -. optional HTTPS .-> G[Gemini]
  UI -. Student Eats search .-> P[Overpass / Nominatim]
```

## Boundaries and decisions

- Finance values are integer minor units. Domain calculations stay pure where practical.
- Screens depend on store actions and view models; repositories own validation and SQL.
- Income, expense, and transfer are distinct ledger semantics. A transfer is one atomic row and conserves
  total value across owned accounts; it never masquerades as income or spending.
- SQLCipher encryption and optional App Lock solve different problems and use separate key material.
- Forgot PIN uses a separate strong native-authentication policy and a five-minute in-memory authorization;
  PIN replacement writes one versioned SecureStore record and leaves the SQLCipher key/database untouched.
- Destructive local reset writes a SecureStore pending marker, blocks database initialization, checkpoints
  and deletes the OP-SQLite database, removes key/PIN/preferences/onboarding state, clears app notifications,
  and deletes the marker last. Startup resumes any pending reset before database hydration.
- The app is local-only: it owns no application server, remote user account, server database, or sync API.
- First-run onboarding persists a bounded, versioned SecureStore draft; SQLCipher remains authoritative for
  accounts and transactions. Root navigation chooses one mutually exclusive shell: loading, first-run,
  locked, or main.
- Retry-safe mutations use nullable transaction source keys. Imports derive deterministic keys from local
  content/mapping/row identity; a user-edited prior import is reported as skipped while new rows commit,
  not overwritten or double-posted. Direct conflicting repository mutations fail.
- Recurring occurrence provenance lives on the transaction as a scheduled timestamp, so deleting a template
  does not make a historical occurrence appear manual.
- Student Eats uses a deterministic campus origin. Removing GPS reduces permissions and prevents the UI
  from implying user-relative results.
- Import account resolution is explicit and atomic. It does not silently coerce unknown labels to Cash.
- The public database executor serializes unrelated work. Code already inside a transaction must use the
  callback's scoped executor; it is the only path allowed to join that open transaction.

## Environments and configuration

- Supported local baseline: Node 22 LTS, npm 10+, JDK 21, Android SDK/API 35, NDK 27.1.
- Expo Go is unsupported because the app needs the SQLCipher native client.
- `app.config.js` extends Expo's normalized config; `app.json` contains no location permission request.
- Secrets belong in local/EAS secret storage. Never commit `.env`, keystores, database keys, PIN material,
  or Gemini credentials.

## Reliability and observability

QA update (2026-10-07): schema version 8 adds account transfers. The full suite is 52/52 suites and 347/347 tests. An isolated synthetic file-backed SQLite workload completed 1,829 operations with zero errors, dashboard p95 7.66 ms and 32-writer p99 4,146.24 ms; both remain inside the documented local budgets. Android export and Expo Doctor 18/18 pass. Earlier API 35 emulator evidence remains valid but was not repeated for schema v8; native migration/transfer persistence is therefore still unverified. See [Verification and Evaluation](./Verification%20and%20Evaluation.md).

- Database migrations and imports run transactionally; foreign keys and a five-second busy timeout are on.
- Recurring catch-up is idempotent for a rule/scheduled timestamp and preserves the monthly anchor day.
- Restore and undo use the same validated transactional replacement path. One recovery snapshot is kept and consumed by undo.
- If an existing PIN is found while its preferences are missing, invalid, or unreadable, startup fails closed
  to the lock shell; PIN unlock restores an enabled lock preference when SecureStore permits.
- UI errors stay in context; success navigation happens only after the store action resolves.
- The app currently relies on local error UI and development logs; there is no remote telemetry service.
  Do not add finance values or secrets to logs.

## Build, release, and rollback

Use `npm ci`, `npm test`, `npx expo-doctor`, Expo export, then a Node 22/JDK 21 native debug build and device
smoke test. Release remains gated by the checklist in [`docs/release-checklist.md`](../docs/release-checklist.md).
Schema migrations 5–8 are additive and have no automated downgrade. Do not release an older build against a
database already upgraded to v8. A production rollout was not performed.

Static/Jest/desktop-SQLite evidence does not establish native acceptance. The API 35 development-build smoke
partially covers startup, encrypted-file appearance, lock-shell layout, unavailable recovery, and relock.
Enrolled recovery success, known-record/key preservation, correct/wrong PIN and cooldown, real reset/process
death, SecureStore fault recovery, notifications, file-picker import, restore/undo, physical accessibility,
tablet layout, and live providers remain **UNVERIFIED**. Expo Go is not a substitute for these checks.

## Repository layout and cleanup

Audit date: 2026-09-28. The repository keeps Expo configuration and entry points at the root; `src/` owns application modules, `assets/` bundled images/SVGs, `plugins/` native config plugins, `__tests__/` Jest checks, `scripts/` build helpers, `docs/` published documentation and screenshot evidence, `AI Skills/` the 15 specialist instructions, and `Project Guidelines/` canonical engineering documentation. `.kilo/` contains agent plans and local session configuration; `.vscode/` and `.idea/` contain development tooling. Ignored `android/`, `.expo/`, `dist/`, `coverage/`, and `node_modules/` contain local/generated state and were not pruned.

### Path change register

| Path | Action and owner | Reason and references | Recovery |
|---|---|---|---|
| Root `AI Documentation Notes.md` -> `Project Guidelines/AI Documentation Notes.md` | Already deleted at root and present untracked at destination before this audit; not moved by this cleanup | Canonical documentation location per `AGENTS.md`; historical notes retained intact and a current navigation map added | Preserve/add the destination before recording a Git rename; original remains in Git history |
| Root `Tech Stack Setup Guide.md` -> `Project Guidelines/Tech Stack Setup Guide.md` | Already deleted at root and present untracked at destination before this audit; not moved by this cleanup | Canonical location; repaired its links to root `index.html` and `docs/screenshots/` | Preserve/add the destination before recording a Git rename; original remains in Git history |
| `README.md`, `docs/index.html`, `index.html` | No file move; corrected two README links, regenerated the published mirror with `npm run build:readme-page`, and repaired the root page's setup-guide URL | Root documentation paths no longer resolve after the pre-existing relocations; the QA pointer now targets `Verification and Evaluation.md` | Re-run `npm run build:readme-page` after README edits |
| `src/screens/fixtures.js` | Candidate only, retained | Deprecated empty export with no imports found; deletion tool failed, so no removal is claimed | Re-evaluate with a working deletion tool and rerun Jest/Expo export |

No application module, asset, schema, migration, service endpoint, or package path was relocated or deleted by this cleanup. The existing root `.nojekyll`, `docs/.nojekyll`, gallery ZIP, environment audits, and agent worktrees were retained because publication targets, distribution, environment evidence, or live session state may depend on them. See [Verification and Evaluation](./Verification%20and%20Evaluation.md#repository-cleanup-audit-2026-09-28) for executed checks and baseline gaps.
