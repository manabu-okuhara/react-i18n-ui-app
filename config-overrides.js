const fs = require('fs');
const path = require('path');
const webpack = require('webpack');

const optimizedIcu4xWasmByPackage = {
  'icu4x-2-0': path.resolve(__dirname, 'vendor/icu4x/2.0.0/icu_capi.wasm'),
  'icu4x-2-1': path.resolve(__dirname, 'vendor/icu4x/2.1.0/icu_capi.wasm'),
  'icu4x-2-2': path.resolve(__dirname, 'vendor/icu4x/2.2.0/icu_capi.wasm')
};

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

  if (process.env.ICU4X_USE_FULL_WASM !== '1') {
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/icu_capi\.wasm$/, (resource) => {
        const normalizedContext = (resource.context || '').split(path.sep).join('/');
        const packageName = Object.keys(optimizedIcu4xWasmByPackage).find((name) =>
          normalizedContext.endsWith(`/node_modules/${name}`)
        );

        if (packageName) {
          const optimizedWasm = optimizedIcu4xWasmByPackage[packageName];

          if (fs.existsSync(optimizedWasm)) {
            resource.request = optimizedWasm;
          }
        }
      })
    );
  }

  return config;
};
