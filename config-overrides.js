module.exports = function override(config) {
  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false
  };
  config.experiments = {
    ...config.experiments,
    asyncWebAssembly: true,
    topLevelAwait: true
  };

  return config;
};
