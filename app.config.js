// Dynamic Expo config: inherits static app.json and injects secrets at build time.
// Shape must remain `{ expo: { ... } }` so expo-doctor and CNG see the same fields.
const appJson = require("./app.json");

module.exports = () => ({
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra ?? {}),
      // EAS secrets / local .env — never commit a real key.
      geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    },
  },
});
