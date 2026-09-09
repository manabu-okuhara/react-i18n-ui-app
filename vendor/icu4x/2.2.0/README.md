# ICU4X 2.2.0 formatting WebAssembly artifact

This directory contains an application-owned, feature-sliced build of the official ICU4X 2.2.0 C API.

- Source: `unicode-org/icu4x`, tag `icu@2.2.0`
- Source commit: `ed9cb2a8ac23f90c4042b369de43f1c998aa011c`
- Rust toolchain: `1.93.1`
- Features: `std,compiled_data,datetime,decimal,locale,plurals`
- CLDR release: `48.2`
- License: Unicode License v3; see [`LICENSE`](LICENSE)

Regenerate and validate the file from the repository root:

```bash
npm run build:icu4x-wasm
npm run verify:icu4x-wasm
```

The build keeps ICU4X's compiled locale data and the date/time, decimal, and plural APIs used by the app, while removing unrelated components such as collation, segmentation, normalization, and display names. Locale-data filtering is a separate future optimization.

The build script also removes the non-runtime WASM `name` custom section. This makes the output reproducible even when the compiler's temporary output filename changes.
