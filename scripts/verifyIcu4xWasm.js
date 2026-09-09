const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const rootDirectory = path.resolve(__dirname, '..');
const artifactDirectory = path.join(rootDirectory, 'vendor/icu4x/2.2.0');
const artifactPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(artifactDirectory, 'icu_capi.wasm');
const manifestPath = path.join(artifactDirectory, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const artifact = fs.readFileSync(artifactPath);
const hash = crypto.createHash('sha256').update(artifact).digest('hex');

if (artifact.byteLength !== manifest.bytes) {
  throw new Error(
    `ICU4X WASM size mismatch: expected ${manifest.bytes}, received ${artifact.byteLength}.`
  );
}

if (hash !== manifest.sha256) {
  throw new Error(`ICU4X WASM checksum mismatch: expected ${manifest.sha256}, received ${hash}.`);
}

const wasmModule = new WebAssembly.Module(artifact);
const exportedNames = new Set(
  WebAssembly.Module.exports(wasmModule).map(({ name }) => name)
);
const missingExports = manifest.requiredExports.filter(
  (exportName) => !exportedNames.has(exportName)
);

if (missingExports.length > 0) {
  throw new Error(`ICU4X WASM is missing required exports: ${missingExports.join(', ')}`);
}

console.log(
  `Verified ICU4X ${manifest.icu4xVersion} date/time WASM ` +
    `(${artifact.byteLength.toLocaleString('en-US')} bytes, ${manifest.reductionPercent}% smaller).`
);
