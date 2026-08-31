const {
  injectIntoOnCreate,
  MARKER,
} = require("../plugins/withAndroidSecureScreen");

const KOTLIN_ACTIVITY = `package com.moneymap.financetracker

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    super.onCreate(null)
  }
}
`;

const JAVA_ACTIVITY = `package com.moneymap.financetracker;

public class MainActivity extends ReactActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    setTheme(R.style.AppTheme);
    super.onCreate(null);
  }
}
`;

describe("withAndroidSecureScreen", () => {
  it("adds FLAG_SECURE inside onCreate for Kotlin activities", () => {
    const result = injectIntoOnCreate(KOTLIN_ACTIVITY, "kt");
    expect(result).toContain("FLAG_SECURE");
    expect(result).toContain(MARKER);
    // Must run before super.onCreate so the first frame is already protected.
    expect(result.indexOf("FLAG_SECURE")).toBeLessThan(result.indexOf("super.onCreate"));
  });

  it("adds FLAG_SECURE inside onCreate for Java activities", () => {
    const result = injectIntoOnCreate(JAVA_ACTIVITY, "java");
    expect(result).toContain("getWindow().setFlags(");
    expect(result.indexOf("FLAG_SECURE")).toBeLessThan(result.indexOf("super.onCreate"));
  });

  it("is idempotent across repeated prebuilds", () => {
    const once = injectIntoOnCreate(KOTLIN_ACTIVITY, "kt");
    const twice = injectIntoOnCreate(once, "kt");
    expect(twice).toBe(once);
    // Marker comment + the two setFlags arguments; a second pass must not add more.
    expect(twice.match(/FLAG_SECURE/g)).toHaveLength(3);
    expect(twice.match(/setFlags/g)).toHaveLength(1);
  });

  it("fails loudly when MainActivity has no recognizable onCreate", () => {
    expect(() => injectIntoOnCreate("class MainActivity {}", "kt")).toThrow(/onCreate/);
  });
});
