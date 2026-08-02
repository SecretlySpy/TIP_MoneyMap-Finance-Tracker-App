const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Transform exact Figma SVG exports into React Native components while keeping
// their source geometry committed and editable as ordinary design assets.
config.transformer.babelTransformerPath = require.resolve("react-native-svg-transformer/expo");
config.resolver.assetExts = config.resolver.assetExts.filter((extension) => extension !== "svg");
// Prefer plain JS/JSX sources after the TypeScript → JavaScript migration.
const sourceExts = new Set([...config.resolver.sourceExts, "svg", "jsx", "js"]);
config.resolver.sourceExts = [...sourceExts];

module.exports = withNativeWind(config, { input: "./global.css" });
