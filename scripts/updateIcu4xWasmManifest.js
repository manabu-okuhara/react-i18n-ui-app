const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const rootDirectory = path.resolve(__dirname, '..');
const version = process.argv[2];
const artifactPath = path.resolve(process.argv[3] || '');
const supportedVersions = ['2.0.0', '2.1.0', '2.2.0'];
const features = ['std', 'compiled_data', 'datetime', 'decimal', 'locale', 'plurals'];
const requiredExports = [
  'diplomat_init',
  'icu4x_Locale_from_string_mv1',
  'icu4x_DateTimeFormatter_create_ymdt_mv1',
  'icu4x_DateTimeFormatter_format_iso_mv1',
  'icu4x_IsoDate_create_mv1',
  'icu4x_Time_create_mv1',
  'icu4x_Decimal_from_string_mv1',
  'icu4x_DecimalFormatter_create_with_grouping_strategy_mv1',
  'icu4x_DecimalFormatter_format_mv1',
  'icu4x_PluralOperands_from_string_mv1',
  'icu4x_PluralRules_create_cardinal_mv1',
  'icu4x_PluralRules_category_for_mv1',
  'icu4x_PluralRules_categories_mv1'
];

if (!supportedVersions.includes(version)) {
  throw new Error(`Unsupported ICU4X version: ${version}`);
}

if (!fs.existsSync(artifactPath)) {
  throw new Error(`ICU4X artifact not found: ${artifactPath}`);
}

const manifestPath = path.join(rootDirectory, 'vendor/icu4x', version, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const artifact = fs.readFileSync(artifactPath);
const exportedNames = new Set(
  WebAssembly.Module.exports(new WebAssembly.Module(artifact)).map(({ name }) => name)
);
const missingExports = requiredExports.filter((name) => !exportedNames.has(name));

if (missingExports.length > 0) {
  throw new Error(
    `ICU4X ${version} WASM is missing required formatting exports: ` +
      missingExports.join(', ')
  );
}

const updatedManifest = {
  ...manifest,
  features,
  bytes: artifact.byteLength,
  sha256: crypto.createHash('sha256').update(artifact).digest('hex'),
  reductionPercent: Number(
    ((1 - artifact.byteLength / manifest.originalNpmBytes) * 100).toFixed(1)
  ),
  requiredExports
};

fs.writeFileSync(manifestPath, `${JSON.stringify(updatedManifest, null, 2)}\n`);
console.log(`Updated ICU4X ${version} formatting manifest.`);
