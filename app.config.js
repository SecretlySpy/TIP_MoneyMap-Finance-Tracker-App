const appJson = require("./app.json");

module.exports = () => {
  const expo = appJson.expo;
  return {
    ...expo,
    extra: {
      ...(expo.extra ?? {}),
      // EAS secrets / .env — never commit a real key.
      geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    },
  };
};
