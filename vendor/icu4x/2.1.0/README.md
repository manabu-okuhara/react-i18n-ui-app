# ICU4X 2.1.0 date/time WebAssembly artifact

This directory contains an application-owned, feature-sliced build for the official ICU4X 2.1.0 JavaScript package. That package's generated bindings reference ICU crate 2.1.1 APIs.

- Source: `unicode-org/icu4x`, tag `icu@2.1.0`
- Source commit: `38a49da495248dd1ded84cf306e4ca42e64d5bb3`
- Rust toolchain: `1.90.0`
- Features: `std,compiled_data,datetime,locale`
- CLDR release: `48`
- License: Unicode License v3; see [`LICENSE`](LICENSE)

Regenerate and validate this version from the repository root:

```bash
npm run build:icu4x-wasm:2.1
npm run verify:icu4x-wasm
```

The build keeps ICU4X's compiled locale data but removes unrelated components. The build script also removes the non-runtime WASM `name` custom section so temporary compiler filenames do not affect reproducibility.
