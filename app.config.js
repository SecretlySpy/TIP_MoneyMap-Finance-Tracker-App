module.exports = ({ config }) => {
  return {
    ...config,

    android: {
      ...(config.android ?? {}),
      googleServicesFile: "./google-services.json",
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
