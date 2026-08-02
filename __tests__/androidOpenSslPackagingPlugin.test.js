const { injectAndroidOpenSslJniPackaging } = require("../plugins/withAndroidOpenSslJniPackaging");
const GENERATED_GRADLE = `android {
    namespace "com.example.financetracker"
}

dependencies {
    implementation("com.facebook.react:react-android")
}
`;
describe("Android OpenSSL JNI packaging plugin", () => {
    it("adds the SQLCipher runtime extraction before native-library merging", () => {
        const result = injectAndroidOpenSslJniPackaging(GENERATED_GRADLE);
        expect(result).toContain('configurations.create("moneyMapOpenSsl")');
        expect(result).toContain('io.github.ronickg:openssl:3.3.2-1');
        expect(result).toContain('include "prefab/modules/crypto/libs/android.*/libcrypto.so"');
        expect(result).toContain('nativeMergeTask.name.endsWith("JniLibFolders")');
        expect(result).toContain('nativeMergeTask.name.endsWith("NativeLibs")');
        expect(result).toContain('nativeMergeTask.dependsOn(prepareMoneyMapOpenSslJni)');
        expect(result.indexOf("prepareMoneyMapOpenSslJni")).toBeLessThan(result.indexOf("dependencies {"));
    });
    it("is idempotent across repeated Expo prebuilds", () => {
        const once = injectAndroidOpenSslJniPackaging(GENERATED_GRADLE);
        const twice = injectAndroidOpenSslJniPackaging(once);
        expect(twice).toBe(once);
        expect(twice.match(/tasks\.register\("prepareMoneyMapOpenSslJni"/g)).toHaveLength(1);
    });
    it("fails loudly when Expo's Gradle template no longer has the expected anchor", () => {
        expect(() => injectAndroidOpenSslJniPackaging("android {\n}\n")).toThrow("MoneyMap could not locate Android's dependencies block for OpenSSL packaging.");
    });
});
