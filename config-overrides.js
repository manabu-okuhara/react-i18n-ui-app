const fs = require('fs');
const path = require('path');
const webpack = require('webpack');

const optimizedIcu4xWasm = path.resolve(
  __dirname,
  'vendor/icu4x/2.2.0/icu_capi.wasm'
);

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

  if (
    process.env.ICU4X_USE_FULL_WASM !== '1' &&
    fs.existsSync(optimizedIcu4xWasm)
  ) {
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/icu_capi\.wasm$/, (resource) => {
        const normalizedContext = (resource.context || '').split(path.sep).join('/');

        if (normalizedContext.endsWith('/node_modules/icu4x-2-2')) {
          resource.request = optimizedIcu4xWasm;
        }
      })
    );
  }

  return config;
};
