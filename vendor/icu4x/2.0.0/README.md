# ICU4X 2.0.0 date/time WebAssembly artifact

This directory contains an application-owned, feature-sliced build of the official ICU4X 2.0.0 C API.

- Source: `unicode-org/icu4x`, tag `icu@2.0.0`
- Source commit: `5e404744dd6c9dd7f86aac82586e3fa98ea75f7f`
- Rust toolchain: `1.86.0`
- Features: `std,compiled_data,datetime,locale`
- CLDR release: `47`
- License: Unicode License v3; see [`LICENSE`](LICENSE)

Regenerate and validate this version from the repository root:

```bash
npm run build:icu4x-wasm:2.0
npm run verify:icu4x-wasm
```

The build keeps ICU4X's compiled locale data but removes unrelated components. The build script also removes the non-runtime WASM `name` custom section so temporary compiler filenames do not affect reproducibility.
