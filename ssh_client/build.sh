#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

set -xe

# Default version must come first.
SSH_VERSIONS=( 8.4 )

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

  # NaCl toolchain.
  naclsdk
  glibc-compat
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
