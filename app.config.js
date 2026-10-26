module.exports = ({ config }) => {
  return {
    ...config,

    android: {
      ...(config.android ?? {}),
      googleServicesFile: "./google-services.json",
      config: {
        ...(config.android?.config ?? {}),
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "",
        },
      },
    },

    plugins: [
      ...(config.plugins ?? []),
      "@react-native-firebase/app",
      "@react-native-firebase/app-check",
    ],

    extra: {
      ...(config.extra ?? {}),
    },
  };
};
