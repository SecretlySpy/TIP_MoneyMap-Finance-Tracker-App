"use strict";
const { createServer } = require("node:http");
const { existsSync, readFileSync } = require("node:fs");
const { createHandler } = require("./handler.cjs");

let verifyAppCheck = null;
if (process.env.FIREBASE_PROJECT_ID) {
  const { initializeApp } = require("firebase-admin/app");
  const { getAppCheck } = require("firebase-admin/app-check");
  const app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  verifyAppCheck = (token) => getAppCheck(app).verifyToken(token);
}

function resolveApiKey() {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY.trim();
  }
  const secretPath = process.env.GEMINI_API_KEY_FILE || "/secrets/moneymap-gemini-key";
  if (existsSync(secretPath)) {
    try {
      return readFileSync(secretPath, "utf8").trim();
    } catch {
      return "";
    }
  }
  return "";
}

const apiKey = resolveApiKey();
const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const expectedAppId = (process.env.EXPECTED_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || "").trim();
const handler = createHandler({ verifyAppCheck, apiKey, model, expectedAppId });
const port = Number(process.env.PORT || 8080);

createServer(handler).listen(port, "0.0.0.0", () => {
  console.log(`MoneyMap AI backend running on port ${port} with model ${model}`);
});
