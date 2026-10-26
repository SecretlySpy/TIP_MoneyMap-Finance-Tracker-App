"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { createHandler, budget, eats, output, ALLOWED_FREE_TIER_MODELS } = require("../src/handler.cjs");

const summary = {
  period: "2026-10",
  currencySymbol: "₱",
  remainingBudgetMinor: 10000,
  limitBudgetMinor: 20000,
  spentBudgetMinor: 10000,
  categorySpendRatios: [{ category: "Food", ratio: 0.5 }],
};

const eatsSummary = {
  context: "student_eats_near_campus",
  areaHint: "TIP Quezon City vicinity",
  currencySymbol: "₱",
  dailyFoodBudgetMinor: 15000,
  places: [
    {
      name: "Campus Diner",
      distanceBand: "walkable",
      priceLevel: 1,
      rating: 4.5,
      cuisine: "Filipino",
      score: 88,
    },
  ],
};

const headers = {
  "Content-Type": "application/json",
  "X-MoneyMap-Consent": "1",
  "X-Firebase-AppCheck": "synthetic-token-for-tests",
};

async function serve(handler, fn) {
  const server = createServer(handler);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    return await fn("http://127.0.0.1:" + server.address().port);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test("rejects private fields and invalid responses", () => {
  assert.equal(budget(summary), true);
  assert.equal(budget({ ...summary, transactions: [{ note: "secret" }] }), false);
  assert.equal(budget({ ...summary, categorySpendRatios: [{ category: "Food", ratio: Infinity }] }), false);
  assert.equal(eats(eatsSummary), true);
  assert.equal(eats({ ...eatsSummary, places: [{ latitude: 14.6 }] }), false);
  assert.equal(output('[{"title":"Tip","meta":"Save daily"}]').length, 1);
  assert.equal(output('[{"title":"Tip","meta":"Save daily","notes":"secret"}]'), null);
});

test("enforces health endpoint", async () => {
  const handler = createHandler({ apiKey: "synthetic", verifyAppCheck: async () => ({ appId: "app" }) });
  await serve(handler, async (url) => {
    const res = await fetch(url + "/health");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "ok");

    const oldRes = await fetch(url + "/healthz");
    assert.equal(oldRes.status, 404);
  });
});

test("refuses to initialize with paid or unauthorized models", async () => {
  const paidHandler = createHandler({
    apiKey: "synthetic",
    verifyAppCheck: async () => ({ appId: "app" }),
    model: "gemini-1.5-pro",
  });
  await serve(paidHandler, async (url) => {
    const res = await fetch(url + "/v1/smart-tips", { method: "POST", headers, body: JSON.stringify(summary) });
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.equal(data.error, "not_configured");
  });
});

test("accepts approved free-tier models", () => {
  assert.equal(ALLOWED_FREE_TIER_MODELS.includes("gemini-3.5-flash-lite"), true);
  assert.equal(ALLOWED_FREE_TIER_MODELS.includes("gemini-1.5-flash"), true);
  assert.equal(ALLOWED_FREE_TIER_MODELS.includes("gemini-2.0-flash"), false);
  assert.equal(ALLOWED_FREE_TIER_MODELS.includes("gemini-1.5-pro"), false);
});

test("requires consent and App Check before Gemini", async () => {
  let calls = 0;
  const handler = createHandler({
    apiKey: "synthetic",
    verifyAppCheck: async () => ({ appId: "registered-app" }),
    fetchImpl: async () => { calls++; },
  });
  await serve(handler, async (url) => {
    const missing = await fetch(url + "/v1/smart-tips", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-MoneyMap-Consent": "1" },
      body: JSON.stringify(summary),
    });
    assert.equal(missing.status, 401);

    const refused = await fetch(url + "/v1/smart-tips", {
      method: "POST",
      headers: { ...headers, "X-MoneyMap-Consent": "0" },
      body: JSON.stringify(summary),
    });
    assert.equal(refused.status, 403);

    const invalid = await fetch(url + "/v1/smart-tips", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...summary, accountId: 1 }),
    });
    assert.equal(invalid.status, 422);
    assert.equal(calls, 0);
  });
});

test("rejects invalid App Check token", async () => {
  const handler = createHandler({
    apiKey: "synthetic",
    verifyAppCheck: async () => { throw new Error("Invalid token"); },
  });
  await serve(handler, async (url) => {
    const res = await fetch(url + "/v1/smart-tips", { method: "POST", headers, body: JSON.stringify(summary) });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.error, "app_check_invalid");
  });
});

test("returns validated summaries for both smart-tips and eats-tips", async () => {
  const response = '[{"title":"Pack lunch","meta":"Reduce food expenses","tag":"Food"}]';
  const handler = createHandler({
    apiKey: "synthetic",
    verifyAppCheck: async () => ({ appId: "registered-app" }),
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: response }] } }] }),
    }),
  });
  await serve(handler, async (url) => {
    const res1 = await fetch(url + "/v1/smart-tips", { method: "POST", headers, body: JSON.stringify(summary) });
    assert.equal(res1.status, 200);
    assert.equal((await res1.json()).tips[0].title, "Pack lunch");

    const res2 = await fetch(url + "/v1/eats-tips", { method: "POST", headers, body: JSON.stringify(eatsSummary) });
    assert.equal(res2.status, 200);
    assert.equal((await res2.json()).tips[0].title, "Pack lunch");
  });
});

test("handles quota failures and rate limits gracefully", async () => {
  let callCount = 0;
  const handler = createHandler({
    apiKey: "synthetic",
    verifyAppCheck: async () => ({ appId: "rate-limited-app" }),
    fetchImpl: async () => {
      callCount++;
      return { ok: false, status: 429 };
    },
  });

  await serve(handler, async (url) => {
    // 1st call gets 429 quota_unavailable from Gemini
    const res = await fetch(url + "/v1/smart-tips", { method: "POST", headers, body: JSON.stringify(summary) });
    assert.equal(res.status, 429);
    assert.equal((await res.json()).error, "quota_unavailable");

    // Make 8 more requests to trigger the in-memory abuse rate limiter (max 8 per minute per appId/client IP)
    for (let i = 0; i < 7; i++) {
      await fetch(url + "/v1/smart-tips", { method: "POST", headers, body: JSON.stringify(summary) });
    }
    const rateLimitedRes = await fetch(url + "/v1/smart-tips", { method: "POST", headers, body: JSON.stringify(summary) });
    assert.equal(rateLimitedRes.status, 429);
    assert.equal((await rateLimitedRes.json()).error, "rate_limited");
  });
});

test("enforces expectedAppId to reject other apps from the same Firebase project", async () => {
  const handler = createHandler({
    apiKey: "synthetic",
    expectedAppId: "com.moneymap.financetracker.registered-id",
    verifyAppCheck: async () => ({ appId: "unrelated-app-in-same-project" }),
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '[{"title":"Tip","meta":"Desc"}]' }] } }] }),
    }),
  });

  await serve(handler, async (url) => {
    const res = await fetch(url + "/v1/smart-tips", { method: "POST", headers, body: JSON.stringify(summary) });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.error, "unauthorized_app");
  });

  const matchingHandler = createHandler({
    apiKey: "synthetic",
    expectedAppId: "com.moneymap.financetracker.registered-id",
    verifyAppCheck: async () => ({ appId: "com.moneymap.financetracker.registered-id" }),
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '[{"title":"Tip","meta":"Desc"}]' }] } }] }),
    }),
  });

  await serve(matchingHandler, async (url) => {
    const res = await fetch(url + "/v1/smart-tips", { method: "POST", headers, body: JSON.stringify(summary) });
    assert.equal(res.status, 200);
  });
});

test("isolates rate limiting across different client IPs", async () => {
  const handler = createHandler({
    apiKey: "synthetic",
    verifyAppCheck: async () => ({ appId: "shared-app-id" }),
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '[{"title":"Tip","meta":"Desc"}]' }] } }] }),
    }),
  });

  await serve(handler, async (url) => {
    const ip1Headers = { ...headers, "X-Forwarded-For": "203.0.113.1" };
    const ip2Headers = { ...headers, "X-Forwarded-For": "203.0.113.2" };

    // Max out IP 1 (8 requests)
    for (let i = 0; i < 8; i++) {
      const res = await fetch(url + "/v1/smart-tips", { method: "POST", headers: ip1Headers, body: JSON.stringify(summary) });
      assert.equal(res.status, 200);
    }
    // 9th request from IP 1 is rate limited
    const resIp1 = await fetch(url + "/v1/smart-tips", { method: "POST", headers: ip1Headers, body: JSON.stringify(summary) });
    assert.equal(resIp1.status, 429);
    assert.equal((await resIp1.json()).error, "rate_limited");

    // IP 2 is NOT rate limited and succeeds
    const resIp2 = await fetch(url + "/v1/smart-tips", { method: "POST", headers: ip2Headers, body: JSON.stringify(summary) });
    assert.equal(resIp2.status, 200);
  });
});

test("enforces app-level rate limiting against IP spoofing rotations", async () => {
  const handler = createHandler({
    apiKey: "synthetic",
    verifyAppCheck: async () => ({ appId: "spoofing-target-app" }),
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '[{"title":"Tip","meta":"Desc"}]' }] } }] }),
    }),
  });

  await serve(handler, async (url) => {
    for (let i = 1; i <= 60; i++) {
      const spoofedHeaders = { ...headers, "X-Forwarded-For": `198.51.100.${i}` };
      const res = await fetch(url + "/v1/smart-tips", { method: "POST", headers: spoofedHeaders, body: JSON.stringify(summary) });
      assert.equal(res.status, 200);
    }

    const spoofed61 = { ...headers, "X-Forwarded-For": "198.51.100.61" };
    const res61 = await fetch(url + "/v1/smart-tips", { method: "POST", headers: spoofed61, body: JSON.stringify(summary) });
    assert.equal(res61.status, 429);
    assert.equal((await res61.json()).error, "rate_limited");
  });
});
