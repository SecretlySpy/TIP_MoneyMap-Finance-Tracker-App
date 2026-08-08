// Dynamic Expo config: inherits static app.json and injects secrets at build time.
// Shape must remain `{ expo: { ... } }` so expo-doctor and CNG see the same fields.
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra ?? {}),
    // EAS secrets / local .env — never commit a real key.
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  },
});
