#!/bin/bash
set -e
cd "$(dirname "$(realpath "$0")")"
OUT="${PWD}/../ssh_client/output"
export PATH="${OUT}/bin:${OUT}/wasi-sdk/bin:${PATH}"
doit() {
  clang \
    -Wall \
    --sysroot="${OUT}/wasi-sdk/share/wasi-sysroot" \
    -I"${OUT}/wasi-sdk/share/wasi-sysroot/include/wassh-libc-sup" \
    -O3 test.c "$@"
}

doit \
  -o test.wasm.dbg \
  -s \
  -Wl,--allow-undefined-file="${OUT}/wasi-sdk/share/wasi-sysroot/lib/wassh-libc-sup.imports" \
  -L"${OUT}/wasi-sdk/share/wasi-sysroot/lib" \
  -lwassh-libc-sup

doit -E -dD -o test.i

# Only use single core here due to known bug in 89 release:
# https://github.com/WebAssembly/binaryen/issues/2273
export BINARYEN_CORES=1
wasm-opt -O2 \
  test.wasm.dbg -o test.wasm
