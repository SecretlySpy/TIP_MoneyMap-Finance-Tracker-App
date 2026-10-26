# MoneyMap AI Backend (Google Cloud Run + Firebase App Check)

This Node.js service securely proxies optional, opt-in Gemini AI requests for **Smart Tips** and **Student Eats**.
No Gemini API credentials, private tokens, or transaction histories are shipped in the mobile application.

## 1. Cloud Architecture & Resource Mapping

| Component | Configuration | Notes |
|---|---|---|
| **Google Cloud Project** | `Google-Developer-Program-Trial` | Project ID: `project-50d13184-689a-4396-ab2` |
| **Cloud Run Service** | `moneymap-ai-proxy` | Regional deployment (`asia-southeast1` recommended) |
| **Runtime Service Account** | `moneymap-ai-run@project-50d13184-689a-4396-ab2.iam.gserviceaccount.com` | Minimum privilege: Secret Accessor only |
| **Secret Manager Secret** | `moneymap-gemini-key` (version 1) | Gemini API key from Archim-Gemini-Default-Project |
| **Gemini Tier & Model** | Free Tier only (`gemini-3.5-flash-lite`) | Enforced by whitelist; paid models rejected |
| **Verification Gate** | Firebase App Check (Admin SDK) | Attests genuine Android app before Gemini is called |
| **Cost Control** | $1 monthly budget alert + max 1 instance | School project guardrails |

---

## 2. API Endpoints

### `GET /health`
- Returns HTTP 200 `{"status":"ok"}`. Used by Cloud Run readiness, liveness, and startup health checks.

### `POST /v1/smart-tips`
- **Headers Required:**
  - `Content-Type: application/json`
  - `X-MoneyMap-Consent: 1`
  - `X-Firebase-AppCheck: <valid-app-check-token>`
- **Payload Schema:**
  - `period`: string (`YYYY-MM`)
  - `currencySymbol`: string (e.g., `₱`)
  - `remainingBudgetMinor`: integer centavos
  - `limitBudgetMinor`: integer centavos
  - `spentBudgetMinor`: integer centavos
  - `categorySpendRatios`: array of `{ category: string, ratio: number }` (max 16)
  - **Strictly Forbidden:** transactions, notes, personal memos, accounts, rule IDs.

### `POST /v1/eats-tips`
- **Headers Required:**
  - `Content-Type: application/json`
  - `X-MoneyMap-Consent: 1`
  - `X-Firebase-AppCheck: <valid-app-check-token>`
- **Payload Schema:**
  - `context`: `"student_eats_near_campus"`
  - `areaHint`: `"TIP Quezon City vicinity"`
  - `currencySymbol`: string
  - `dailyFoodBudgetMinor`: integer centavos or null
  - `places`: array of up to 8 places with coarse distance bands (`very_near`, `near`, `walkable`, `farther`).
  - **Strictly Forbidden:** latitude, longitude, device coordinates.

---

## 3. Security, Rate Limiting & Abuse Prevention

1. **Mandatory App Check Attestation & App ID Verification:**
   Requests without `X-Firebase-AppCheck` or with invalid tokens return HTTP 401 (`app_check_required` or `app_check_invalid`) and never reach the Gemini API. When `EXPECTED_FIREBASE_APP_ID` is configured, tokens minted for unrelated apps in the same Firebase project are rejected with HTTP 403 (`unauthorized_app`).
2. **Consent Gating:**
   Requests without `X-MoneyMap-Consent: 1` return HTTP 403 (`consent_required`).
3. **Payload Sanitization:**
   Incoming JSON is size-limited (max 8 KB) and schema-validated. Any unexpected fields trigger HTTP 422 (`invalid_summary`).
4. **Per-Client Abuse Brake:**
   In-memory rate limiter caps requests to at most 8 requests per minute keyed by `${appId}:${clientIp}`. This prevents an individual user from exhausting the rate-limiting allowance for all other users. Exceeding requests return HTTP 429 (`rate_limited`).
5. **Quota & AI Error Handling:**
   If Gemini returns HTTP 429, the proxy returns HTTP 429 `{"error":"quota_unavailable"}`. The mobile app cleanly falls back to offline rule-based tips.
6. **No Remote Financial Ledger:**
   The service is completely stateless; no user data is stored, cached on disk, or logged.

---

## 4. Local Testing & Verification

```bash
cd backend/moneymap-ai
npm install
npm test
```

All unit tests verify:
- Health check endpoint
- Rejection of unapproved paid models (e.g. `gemini-1.5-pro` returns 503)
- Acceptance of Free Tier models (`gemini-3.5-flash-lite`, `gemini-1.5-flash`)
- App Check verification failure paths (401)
- User consent enforcement (403)
- Rate limiting and quota failure responses (429)

---

## 5. Deployment Commands (Cloud Run)

To deploy to Cloud Run using Google Cloud SDK:

```bash
# 1. Authenticate with Google Cloud
gcloud auth login
gcloud config set project project-50d13184-689a-4396-ab2

# 2. Deploy to Cloud Run from the backend/moneymap-ai directory
gcloud run deploy moneymap-ai-proxy \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --service-account moneymap-ai-run@project-50d13184-689a-4396-ab2.iam.gserviceaccount.com \
  --set-secrets="GEMINI_API_KEY=moneymap-gemini-key:1" \
  --set-env-vars="FIREBASE_PROJECT_ID=project-50d13184-689a-4396-ab2,GEMINI_MODEL=gemini-3.5-flash-lite,EXPECTED_FIREBASE_APP_ID=1:644502021888:android:b55d182b7c556e414f35e5" \
  --max-instances 1 \
  --memory 256Mi \
  --cpu 1 \
  --timeout 15s

# 3. Copy the assigned Service URL and set it in your local mobile .env
# EXPO_PUBLIC_MONEYMAP_AI_URL=https://moneymap-ai-proxy-<hash>-as.a.run.app

# 4. Verify deployment health check
curl -i https://moneymap-ai-proxy-<hash>-as.a.run.app/health
# Expected: HTTP 200 {"status":"ok"}
```

> [!WARNING]
> **Cost & Budget Limits:** Google Cloud budget alerts send notifications when spend approaches $1/month, but budget alerts are monitoring signals—they do NOT automatically terminate running services or hard-cap spend. Setting `--max-instances 1` and using Gemini Free Tier models (`gemini-3.5-flash-lite`) provides cost isolation, but service usage should be monitored via the Google Cloud Console.

> [!IMPORTANT]
> The service is protected at the application layer by Firebase App Check verification. Do NOT bypass App Check verification in production.
