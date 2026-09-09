#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FEATURES="std,compiled_data,datetime,decimal,locale,plurals"
SOURCE_ROOT="${ICU4X_SOURCE_ROOT:-${TMPDIR:-/tmp}/react-i18n-ui-app-icu4x-sources}"
REQUESTED_VERSION="${1:-all}"
TEMP_OUTPUTS=()

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

cleanup() {
  if [[ ${#TEMP_OUTPUTS[@]} -gt 0 ]]; then
    rm -f "${TEMP_OUTPUTS[@]}"
  fi
}

trap cleanup EXIT

build_version() {
  local version="$1"
  local source_commit
  local rust_toolchain

  case "${version}" in
    2.0.0)
      source_commit="5e404744dd6c9dd7f86aac82586e3fa98ea75f7f"
      rust_toolchain="1.86.0"
      ;;
    2.1.0)
      source_commit="38a49da495248dd1ded84cf306e4ca42e64d5bb3"
      rust_toolchain="1.90.0"
      ;;
    2.2.0)
      source_commit="ed9cb2a8ac23f90c4042b369de43f1c998aa011c"
      rust_toolchain="1.93.1"
      ;;
    *)
      echo "Unsupported ICU4X version: ${version}" >&2
      exit 1
      ;;
  esac

  local source_tag="icu@${version}"
  local source_dir="${SOURCE_ROOT}/icu4x-${version}"
  local output_dir="${ROOT_DIR}/vendor/icu4x/${version}"
  local output_file="${output_dir}/icu_capi.wasm"
  local temp_output="${TMPDIR:-/tmp}/icu4x-${version}-formatting.$$.wasm"
  local stripped_output="${temp_output}.stripped"

  if [[ "${REQUESTED_VERSION}" != "all" && -n "${ICU4X_SOURCE_DIR:-}" ]]; then
    source_dir="${ICU4X_SOURCE_DIR}"
  fi

  TEMP_OUTPUTS+=("${temp_output}" "${stripped_output}")

  if [[ ! -d "${source_dir}/.git" ]]; then
    git clone --depth 1 --branch "${source_tag}" \
      https://github.com/unicode-org/icu4x.git "${source_dir}"
  fi

  local actual_commit
  actual_commit="$(git -C "${source_dir}" rev-parse HEAD)"
  if [[ "${actual_commit}" != "${source_commit}" ]]; then
    echo "Unexpected ICU4X source commit in ${source_dir}." >&2
    echo "Expected ${source_commit}; found ${actual_commit}." >&2
    exit 1
  fi

  rustup toolchain install "${rust_toolchain}" --profile minimal
  rustup target add wasm32-unknown-unknown --toolchain "${rust_toolchain}"

  (
    cd "${source_dir}"
    RUSTFLAGS="-Copt-level=s -Clink-args=-zstack-size=100000" \
      cargo "+${rust_toolchain}" rustc \
        --manifest-path=ffi/capi/Cargo.toml \
        --crate-type=cdylib \
        --release \
        --config=profile.release.panic=\"abort\" \
        --config=profile.release.codegen-units=1 \
        --no-default-features \
        --features="${FEATURES}" \
        --target=wasm32-unknown-unknown \
        -- \
        --emit "link=${temp_output}"
  )

  node "${ROOT_DIR}/scripts/stripWasmNameSection.js" \
    "${temp_output}" "${stripped_output}"
  mkdir -p "${output_dir}"
  mv "${stripped_output}" "${output_file}"
  node "${ROOT_DIR}/scripts/updateIcu4xWasmManifest.js" \
    "${version}" "${output_file}"
  node "${ROOT_DIR}/scripts/verifyIcu4xWasm.js" "${version}"

  echo "Generated ${output_file}"
}

case "${REQUESTED_VERSION}" in
  all)
    for version in 2.0.0 2.1.0 2.2.0; do
      build_version "${version}"
    done
    ;;
  2.0.0|2.1.0|2.2.0)
    build_version "${REQUESTED_VERSION}"
    ;;
  *)
    echo "Usage: $0 [all|2.0.0|2.1.0|2.2.0]" >&2
    exit 1
    ;;
esac
