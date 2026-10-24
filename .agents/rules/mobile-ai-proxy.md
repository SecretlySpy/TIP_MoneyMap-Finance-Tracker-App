---
trigger: model_decision
description: Invariants and security standards for mobile applications proxying AI services through serverless backends with app attestation (e.g. Firebase App Check, Cloud Run, Gemini).
---

# Mobile Attestation & Serverless AI Proxy Rules

When developing, refactoring, or reviewing mobile applications that interface with an authenticated serverless AI proxy:

## 1. Token Refresh Forwarding
- Client-side token provider registrations must accept and forward the `forceRefresh` boolean parameter to the underlying native SDK (`async (forceRefresh = false) => getAppCheckToken(forceRefresh)`).
- On receiving HTTP 401 from the proxy, the client must trigger exactly one retry with `forceRefresh = true` before failing closed to local offline heuristics.

## 2. Strict Development Debug Isolation
- Bundlers (such as Expo/Metro) inline public build-time environment variables (`EXPO_PUBLIC_*`). Debug tokens must never be configured unconditionally or referenced in production release builds.
- All debug token evaluation must be strictly scoped within `if (__DEV__)` blocks. Production release builds must explicitly configure native attestation (e.g. `playIntegrity`) with zero debug properties attached.

## 3. Backend App ID Cross-Verification
- In server proxies verifying attestation tokens, validating the cryptographic signature only confirms membership in the Firebase project.
- The backend MUST verify that `verified.appId === EXPECTED_APP_ID`. Requests from any other application in the same project must be rejected with HTTP 403 `unauthorized_app`.

## 4. Dual-Layer Anti-Spoofing Rate Limiting
- In-memory rate limiting must implement dual-tier protection:
  1. **Client Level:** Rate-limit individual clients by verified `appId:clientIp` (e.g. 8 req/min) to prevent user-to-user starvation.
  2. **Container / App Level:** Rate-limit total requests per application container (e.g. 60 req/min) to prevent attackers rotating spoofed `X-Forwarded-For` IPs from exhausting upstream API quotas.
- Sanitize all IP inputs with regex (`/^[\d.a-fA-F:]{3,45}$/`) and implement automatic TTL garbage collection to prevent memory leaks.

## 5. Model Lifecycle and Budget Guardrails
- Confirm active availability and free-tier eligibility of AI models (e.g., `gemini-3.5-flash-lite`); reject unlisted or retired models with HTTP 503.
- Cloud budget alerts (e.g., $1/mo alerts) must be documented as monitoring alarms, not automated kill-switches or guaranteed spending limits.
