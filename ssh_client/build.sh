#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

set -xe

# Default version must come first.
SSH_VERSIONS=( 8.7 8.6 )

ncpus=$(getconf _NPROCESSORS_ONLN || echo 2)

DEBUG=0

for i in $@; do
  case $i in
    "--debug")
      DEBUG=1
      ;;

    *)
      echo "usage: $0 [--debug]"
      exit 1
      ;;
  esac
done

cd "$(dirname "$0")"
mkdir -p output

# Build the toolchain packages.
pkgs=(
  # Build tools.
  gnuconfig
  mandoc
  bazel-0.17

  # NaCl toolchain.
  naclsdk
  glibc-compat

  # WASM toolchain.
  binaryen
  wabt
  wasi-sdk
  wasmtime
)
for pkg in "${pkgs[@]}"; do
  ./third_party/${pkg}/build
done

# The plugin packages.
pkgs=(
  zlib
  openssl
  ldns
  $(printf 'openssh-%s ' "${SSH_VERSIONS[@]}")
)

# Build the NaCl packages.
for pkg in "${pkgs[@]}"; do
  ./third_party/${pkg}/build --toolchain pnacl
done
./third_party/mosh-chrome/build

./wassh-libc-sup/build
# Build the WASM packages.
for pkg in "${pkgs[@]}"; do
  ./third_party/${pkg}/build --toolchain wasm
done

# Install the WASM programs.
#
# We use -O2 as that seems to provide good enough shrinkage.  -O3/-O4 take
# much longer but don't produce singificnatly larger/smaller files.  -Os/-Oz
# also aren't that much smaller than -O2.  So use this pending more testing.
#
# Only use single core here due to known bug in 89 release:
# https://github.com/WebAssembly/binaryen/issues/2273
export BINARYEN_CORES=1
PATH+=":${PWD}/output/bin"

WASM_OPTS=()
if [[ ${DEBUG} == 1 ]]; then
  WASM_OPTS+=( -O0 )
else
  WASM_OPTS+=( -O2 )
fi

pushd output >/dev/null
first="true"
for version in "${SSH_VERSIONS[@]}"; do
  dir="plugin/wasm"
  if [[ "${first}" == "true" ]]; then
    first=
  else
    dir+="-openssh-${version}"
  fi
  mkdir -p "${dir}"

  for prog in scp sftp ssh ssh-keygen; do
    wasm-opt \
      "${WASM_OPTS[@]}" \
      build/wasm/openssh-${version}*/work/openssh-*/${prog} \
      -o "${dir}/${prog}.wasm"
  done
done
popd >/dev/null

# Build the PNaCl programs.
BUILD_ARGS=()
if [[ $DEBUG == 1 ]]; then
  BUILD_ARGS+=( DEBUG=1 )
  tarname="debug.tar"
else
  tarname="release.tar"
fi

first="true"
for version in "${SSH_VERSIONS[@]}"; do
  make -C src -j${ncpus} "${BUILD_ARGS[@]}" \
    SSH_VERSION="${version}" DEFAULT_VERSION="${first}"
  first=
done

cd output
tar cf - \
  `find plugin/ -type f | LC_ALL=C sort` \
  `find build/pnacl* -name '*.pexe' -o -name '*.dbg.nexe' | LC_ALL=C sort` \
  | xz -T0 -9 >"${tarname}.xz"
