#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ICU4X_VERSION="2.2.0"
ICU4X_TAG="icu@${ICU4X_VERSION}"
ICU4X_COMMIT="ed9cb2a8ac23f90c4042b369de43f1c998aa011c"
RUST_TOOLCHAIN="1.93.1"
FEATURES="std,compiled_data,datetime,locale"
SOURCE_DIR="${ICU4X_SOURCE_DIR:-${TMPDIR:-/tmp}/react-i18n-ui-app-icu4x-${ICU4X_VERSION}}"
OUTPUT_DIR="${ROOT_DIR}/vendor/icu4x/${ICU4X_VERSION}"
OUTPUT_FILE="${OUTPUT_DIR}/icu_capi.wasm"
TEMP_OUTPUT="${TMPDIR:-/tmp}/icu4x-${ICU4X_VERSION}-datetime.$$.wasm"
STRIPPED_OUTPUT="${TEMP_OUTPUT}.stripped"

if [[ -d /opt/homebrew/opt/rustup/bin ]]; then
  export PATH="/opt/homebrew/opt/rustup/bin:${HOME}/.cargo/bin:${PATH}"
else
  export PATH="${HOME}/.cargo/bin:${PATH}"
fi

for command_name in git rustup cargo node; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command not found: ${command_name}" >&2
    exit 1
  fi
done

if [[ ! -d "${SOURCE_DIR}/.git" ]]; then
  git clone --depth 1 --branch "${ICU4X_TAG}" \
    https://github.com/unicode-org/icu4x.git "${SOURCE_DIR}"
fi

ACTUAL_COMMIT="$(git -C "${SOURCE_DIR}" rev-parse HEAD)"
if [[ "${ACTUAL_COMMIT}" != "${ICU4X_COMMIT}" ]]; then
  echo "Unexpected ICU4X source commit in ${SOURCE_DIR}." >&2
  echo "Expected ${ICU4X_COMMIT}; found ${ACTUAL_COMMIT}." >&2
  exit 1
fi

rustup toolchain install "${RUST_TOOLCHAIN}" --profile minimal
rustup target add wasm32-unknown-unknown --toolchain "${RUST_TOOLCHAIN}"

trap 'rm -f "${TEMP_OUTPUT}" "${STRIPPED_OUTPUT}"' EXIT

(
  cd "${SOURCE_DIR}"
  RUSTFLAGS="-Copt-level=s -Clink-args=-zstack-size=100000" \
    cargo "+${RUST_TOOLCHAIN}" rustc \
      --manifest-path=ffi/capi/Cargo.toml \
      --crate-type=cdylib \
      --release \
      --config=profile.release.panic=\"abort\" \
      --config=profile.release.codegen-units=1 \
      --no-default-features \
      --features="${FEATURES}" \
      --target=wasm32-unknown-unknown \
      -- \
      --emit "link=${TEMP_OUTPUT}"
)

node "${ROOT_DIR}/scripts/stripWasmNameSection.js" \
  "${TEMP_OUTPUT}" "${STRIPPED_OUTPUT}"
node "${ROOT_DIR}/scripts/verifyIcu4xWasm.js" "${STRIPPED_OUTPUT}"

mkdir -p "${OUTPUT_DIR}"
mv "${STRIPPED_OUTPUT}" "${OUTPUT_FILE}"

echo "Generated ${OUTPUT_FILE}"
