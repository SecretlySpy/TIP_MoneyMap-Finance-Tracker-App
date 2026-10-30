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
const SECURE_SCREEN_ENABLED = false;

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

function removeFromOnCreate(contents) {
  if (!contents.includes(MARKER)) {
    return contents;
  }
  const pattern = new RegExp(
    `[ \\t]*\\/\\/\\s*${MARKER}[^\\r\\n]*\\r?\\n[ \\t]*(?:window|getWindow\\(\\))\\.setFlags\\([\\s\\S]*?FLAG_SECURE\\s*\\);?\\r?\\n?`,
    "g"
  );
  return contents.replace(pattern, "");
}

function isSecureScreenEnabled(options) {
  if (options && typeof options.enabled === "boolean") {
    return options.enabled;
  }
  if (process.env.SECURE_SCREEN_ENABLED !== undefined) {
    return (
      process.env.SECURE_SCREEN_ENABLED === "true" ||
      process.env.SECURE_SCREEN_ENABLED === "1"
    );
  }
  return SECURE_SCREEN_ENABLED;
}

module.exports = function withAndroidSecureScreen(config, options) {
  return withMainActivity(config, (modConfig) => {
    if (isSecureScreenEnabled(options)) {
      modConfig.modResults.contents = injectIntoOnCreate(
        modConfig.modResults.contents,
        modConfig.modResults.language,
      );
    } else {
      modConfig.modResults.contents = removeFromOnCreate(
        modConfig.modResults.contents,
      );
    }
    return modConfig;
  });
};

module.exports.injectIntoOnCreate = injectIntoOnCreate;
module.exports.removeFromOnCreate = removeFromOnCreate;
module.exports.isSecureScreenEnabled = isSecureScreenEnabled;
module.exports.MARKER = MARKER;

