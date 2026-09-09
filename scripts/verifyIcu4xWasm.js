const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const rootDirectory = path.resolve(__dirname, '..');
const supportedVersions = ['2.0.0', '2.1.0', '2.2.0'];
const requestedVersion = process.argv[2];
const artifactOverride = process.argv[3];

function verifyVersion(version, overridePath) {
  const artifactDirectory = path.join(rootDirectory, 'vendor/icu4x', version);
  const artifactPath = overridePath
    ? path.resolve(overridePath)
    : path.join(artifactDirectory, 'icu_capi.wasm');
  const manifestPath = path.join(artifactDirectory, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const artifact = fs.readFileSync(artifactPath);
  const hash = crypto.createHash('sha256').update(artifact).digest('hex');

  if (manifest.icu4xVersion !== version) {
    throw new Error(
      `ICU4X manifest version mismatch: expected ${version}, ` +
        `received ${manifest.icu4xVersion}.`
    );
  }

  if (artifact.byteLength !== manifest.bytes) {
    throw new Error(
      `ICU4X ${version} WASM size mismatch: expected ${manifest.bytes}, ` +
        `received ${artifact.byteLength}.`
    );
  }

  if (hash !== manifest.sha256) {
    throw new Error(
      `ICU4X ${version} WASM checksum mismatch: expected ${manifest.sha256}, ` +
        `received ${hash}.`
    );
  }

  const wasmModule = new WebAssembly.Module(artifact);
  const exportedNames = new Set(
    WebAssembly.Module.exports(wasmModule).map(({ name }) => name)
  );
  const missingExports = manifest.requiredExports.filter(
    (exportName) => !exportedNames.has(exportName)
  );

  if (missingExports.length > 0) {
    throw new Error(
      `ICU4X ${version} WASM is missing required exports: ${missingExports.join(', ')}`
    );
  }

  console.log(
    `Verified ICU4X ${manifest.icu4xVersion} formatting WASM ` +
      `(${artifact.byteLength.toLocaleString('en-US')} bytes, ` +
      `${manifest.reductionPercent}% smaller).`
  );
}

if (process.env.ICU4X_USE_FULL_WASM === '1' && !requestedVersion) {
  console.log('Using official full ICU4X WASM artifacts; custom verification skipped.');
} else if (requestedVersion) {
  if (!supportedVersions.includes(requestedVersion)) {
    throw new Error(`Unsupported ICU4X version: ${requestedVersion}`);
  }

  verifyVersion(requestedVersion, artifactOverride);
} else {
  supportedVersions.forEach((version) => verifyVersion(version));
}
