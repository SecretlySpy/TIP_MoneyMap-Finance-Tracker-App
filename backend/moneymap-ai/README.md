# MoneyMap AI backend (staged integration)

This Node.js Cloud Run service securely proxies opt-in Gemini requests. It is deliberately **not deployed** by this code commit.
Gemini credentials belong only in Google Secret Manager, never in Expo, Android source, or this repository.

## Project references
- Cloud project ID: project-50d13184-689a-4396-ab2
- Cloud Run service account: moneymap-ai-run@project-50d13184-689a-4396-ab2.iam.gserviceaccount.com
- Secret Manager secret: moneymap-gemini-key (version 1)
- The Gemini API key should belong to the separate unbilled Archim-Gemini-Default-Project.

## Endpoints and privacy
- GET /healthz returns only a health status.
- POST /v1/smart-tips accepts month, currency, integer-budget totals, category spending ratios; never raw transaction rows.
- POST /v1/eats-tips accepts up to eight place summaries with coarse distance bands; no coordinates.
- Protected POST routes require X-MoneyMap-Consent: 1 and a verifiable X-Firebase-AppCheck token.
- The server validates the summaries and returns only bounded AI tip fields; invalid/error responses fall back to offline tips in the Android application.

## Development
- Install Node.js 22 or newer.
- Run: cd backend/moneymap-ai && npm install && npm test
- Generate and review package-lock.json before any source deployment; do not commit node_modules.
- Environment: FIREBASE_PROJECT_ID=<Firebase project registered with App Check>, GEMINI_MODEL=gemini-3.5-flash-lite.
- Bind GEMINI_API_KEY from Secret Manager, not from checked-in source.

## Deployment gate: not ready for public access
1. Register the Android app com.moneymap.financetracker in Firebase, configure Play Integrity (or approved development debug provider), then implement the native Firebase App Check token provider in MoneyMap.
2. Configure Google Cloud Run to use the dedicated service identity and to read only moneymap-gemini-key:1.
3. Privately test verification of valid and invalid App Check tokens, denied consent, malformed payloads, quota errors, and network timeouts.
4. Only then consider allowing unauthenticated Cloud Run IAM invocation; the application-level App Check verification remains mandatory. A public endpoint without verified App Check would expose free AI quotas.
5. Limit Cloud Run max instances to 1 for the school demo; monitor Gemini quotas and Cloud costs. The in-process limiter is not a distributed or guaranteed spending cap.
6. On the mobile side, replace the retired direct Gemini call with this protected proxy after attestation is configured and tested.

## Safety
Do not use a static token inside the APK as a substitute for verified App Check. Do not commit Gemini keys, debug App Check tokens, service account key JSON, private transaction data, or signing credentials. Existing offline tips continue working until secure setup is complete.
