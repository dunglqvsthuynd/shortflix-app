const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Bundle the large subtitles file as a downloadable asset (loaded lazily at runtime
// via expo-asset) instead of inlining ~21MB into the JS bundle.
config.resolver.assetExts.push("bin");

module.exports = withNativeWind(config, { input: "./global.css" });
