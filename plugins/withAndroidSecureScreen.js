const { withMainActivity } = require("@expo/config-plugins");

/**
 * A7: set FLAG_SECURE on MainActivity.
 *
 * Without it, Android renders the app's balances into the recents/app-switcher
 * thumbnail and allows screenshots and screen recording of account data. FLAG_SECURE
 * is per-window with no manifest equivalent, so it must be applied in onCreate.
 *
 * Trade-off: this also blocks the user's own screenshots. That is the standard
 * posture for finance apps; flip SECURE_SCREEN_ENABLED to false to opt out.
 */
const SECURE_SCREEN_ENABLED = true;

// Doubles as the idempotency marker across repeated Expo prebuilds.
const MARKER = "MoneyMap FLAG_SECURE";

const KOTLIN_SNIPPET = `    // ${MARKER}: keep balances out of screenshots and the recents thumbnail.
    window.setFlags(
      android.view.WindowManager.LayoutParams.FLAG_SECURE,
      android.view.WindowManager.LayoutParams.FLAG_SECURE
    )
`;

const JAVA_SNIPPET = `    // ${MARKER}: keep balances out of screenshots and the recents thumbnail.
    getWindow().setFlags(
      android.view.WindowManager.LayoutParams.FLAG_SECURE,
      android.view.WindowManager.LayoutParams.FLAG_SECURE
    );
`;

function injectIntoOnCreate(contents, language) {
  if (contents.includes(MARKER)) {
    return contents;
  }
  const snippet = language === "java" ? JAVA_SNIPPET : KOTLIN_SNIPPET;
  // Insert immediately after the opening brace of onCreate, before super.onCreate.
  const pattern = language === "java"
    ? /(protected\s+void\s+onCreate\s*\([^)]*\)\s*\{\r?\n)/
    : /(override\s+fun\s+onCreate\s*\([^)]*\)\s*\{\r?\n)/;
  if (!pattern.test(contents)) {
    throw new Error("withAndroidSecureScreen: could not locate MainActivity.onCreate.");
  }
  return contents.replace(pattern, `$1${snippet}`);
}

module.exports = function withAndroidSecureScreen(config) {
  if (!SECURE_SCREEN_ENABLED) {
    return config;
  }
  return withMainActivity(config, (modConfig) => {
    modConfig.modResults.contents = injectIntoOnCreate(
      modConfig.modResults.contents,
      modConfig.modResults.language,
    );
    return modConfig;
  });
};

module.exports.injectIntoOnCreate = injectIntoOnCreate;
module.exports.MARKER = MARKER;
