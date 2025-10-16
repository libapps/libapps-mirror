#!/bin/bash
# Copyright 2012 The ChromiumOS Authors
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

set -xe

# Default version must come first.
SSH_VERSIONS=( 9.3 8.6 )

ncpus=$(getconf _NPROCESSORS_ONLN || echo 2)

DEBUG=0
OFFICIAL_RELEASE=0

for i in $@; do
  case $i in
    "--debug")
      DEBUG=1
      ;;
    "--official-release")
      OFFICIAL_RELEASE=1
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
tc_pkgs=(
  # Build tools.
  gnuconfig
  mandoc

  # WASM toolchain.
  binaryen
  wabt
  wasi-sdk
)
for tc_pkg in "${tc_pkgs[@]}"; do
  ./third_party/${tc_pkg}/build
done

# The plugin packages.
pkgs=(
  zlib
  openssl
  ldns
  $(printf 'openssh-%s ' "${SSH_VERSIONS[@]}")
)

./wassh-libc-sup/build --toolchain wasip1
for pkg in "${pkgs[@]}"; do
  ./third_party/${pkg}/build --toolchain wasip1
done

# Packages for mosh.
mosh_pkgs=(
  zlib
  openssl
  ncurses
)
./wassh-libc-sup/build --toolchain wasip1-threads
for pkg in "${mosh_pkgs[@]}"; do
  ./third_party/${pkg}/build --toolchain wasip1-threads
done

# Install the WASM programs.
#
# We use -O2 as that seems to provide good enough shrinkage.  -O3/-O4 take
# much longer but don't produce singificnatly larger/smaller files.  -Os/-Oz
# also aren't that much smaller than -O2.  So use this pending more testing.
WASM_OPTS=()
if [[ ${DEBUG} == 1 ]]; then
  WASM_OPTS+=( -O0 )
else
  WASM_OPTS+=( -O2 )
fi

pushd output >/dev/null
cat <<EOF >Makefile.wasm-opt
# Only use single core because versions <102 are known to segfault, and upstream
# doesn't seem to have any idea if they actually fixed it, or if it just happens
# to mostly work now.
# https://github.com/WebAssembly/binaryen/issues/2273
#
# Also force single core because it significantly outperforms multicore runs due
# to some extreme internal threading overhead.
# https://github.com/WebAssembly/binaryen/issues/2740
export BINARYEN_CORES = 1

# Disable implicit rules we don't need.
MAKEFLAGS += --no-builtin-rules
.SUFFIXES:

WASM_OPTS = ${WASM_OPTS[*]}

WASM_OPT = ${PWD}/bin/wasm-opt

all:
EOF
first="true"
for version in "${SSH_VERSIONS[@]}"; do
  if [[ "${first}" == "true" ]]; then
    first=
    dir="plugin/wasm"
  else
    dir+="-openssh-${version}"
  fi
  mkdir -p "${dir}"

  for prog in scp sftp ssh ssh-keygen; do
    (
      echo "all: ${dir}/${prog}.wasm"
      echo "${dir}/${prog}.wasm:" \
        build/wasm32-wasip1/openssh-${version}*/work/openssh-*/${prog}
      printf '\t$(WASM_OPT) ${WASM_OPTS} $< -o $@\n'
    ) >>Makefile.wasm-opt
  done
done
make -f Makefile.wasm-opt -j${ncpus} -O
popd >/dev/null

# Generate the final artifacts.
if [[ $DEBUG == 1 ]]; then
  tarname="debug.tar"
else
  tarname="release.tar"
fi

cd output
# Only spend extra time on this on official release builders.  All other modes
# can get by with slightly larger file.
if [[ "${OFFICIAL_RELEASE}" == 1 ]]; then
  comp_level="-9"
else
  comp_level="-0"
fi
# Use reproducible options since the inputs should be reproducible too.
(
find plugin/ -type f -print0
) | \
LC_ALL=C tar \
  --numeric-owner \
  --owner=0 --group=0 \
  --mtime="1970-01-01" \
  --sort=name \
  --null --files-from - \
  -cf - \
  | xz -T0 ${comp_level} >"${tarname}.xz"
