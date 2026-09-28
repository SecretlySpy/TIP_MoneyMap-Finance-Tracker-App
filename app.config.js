// Dynamic Expo config: inherits Expo's normalized app.json values and injects secrets at build time.
module.exports = ({ config }) => {
  return {
    ...config,
    extra: {
      ...(config.extra ?? {}),
    },
  };
};
