// Dynamic Expo config: inherits static app.json and injects secrets at build time.
// Prefer explicit require so plugins from app.json always resolve (avoids empty config).
const appJson = require("./app.json");

module.exports = () => {
  const expo = appJson.expo ?? appJson;
  return {
    ...expo,
    extra: {
      ...(expo.extra ?? {}),
      // EAS secrets / local .env — never commit a real key.
      geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    },
  };
};
