# Architecture and Operations

Updated: 2026-09-27

## Runtime context

```mermaid
flowchart LR
  U[Student] --> UI[React Native screens]
  UI --> S[Zustand stores]
  S --> D[Domain services]
  S --> R[Repositories]
  R --> DB[(SQLCipher SQLite)]
  K[SecureStore key] --> DB
  UI --> N[Local notifications]
  UI -. optional HTTPS .-> G[Gemini]
  UI -. Student Eats search .-> P[Overpass / Nominatim]
```

## Boundaries and decisions

- Finance values are integer minor units. Domain calculations stay pure where practical.
- Screens depend on store actions and view models; repositories own validation and SQL.
- SQLCipher encryption and optional App Lock solve different problems and use separate key material.
- Student Eats uses a deterministic campus origin. Removing GPS reduces permissions and prevents the UI
  from implying user-relative results.
- Import account resolution is explicit and atomic. It does not silently coerce unknown labels to Cash.

## Environments and configuration

- Supported local baseline: Node 22 LTS, npm 10+, JDK 21, Android SDK/API 35, NDK 27.1.
- Expo Go is unsupported because the app needs the SQLCipher native client.
- `app.config.js` extends Expo's normalized config; `app.json` contains no location permission request.
- Secrets belong in local/EAS secret storage. Never commit `.env`, keystores, database keys, PIN material,
  or Gemini credentials.

## Reliability and observability

- Database migrations and imports run transactionally; foreign keys and a five-second busy timeout are on.
- Recurring catch-up is idempotent for a rule/scheduled timestamp and preserves the monthly anchor day.
- UI errors stay in context; success navigation happens only after the store action resolves.
- The app currently relies on local error UI and development logs; there is no remote telemetry service.
  Do not add finance values or secrets to logs.

## Build, release, and rollback

Use `npm ci`, `npm test`, `npx expo-doctor`, Expo export, then a Node 22/JDK 21 native debug build and device
smoke test. Release remains gated by the checklist in [`docs/release-checklist.md`](../docs/release-checklist.md).
This reconciliation is locally reversible and adds no database migration. A production rollout was not
performed.

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
