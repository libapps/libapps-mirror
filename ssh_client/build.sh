#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

set -xe

ncpus=$(getconf _NPROCESSORS_ONLN || echo 2)

DEBUG=0

# We only support PNaCl builds now.
export NACL_ARCH=pnacl

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

./third_party/naclsdk/build
export NACL_SDK_ROOT=$(echo "${PWD}/output/naclsdk"/pepper_*)

./third_party/depot_tools/build
./third_party/webports/build

./third_party/mandoc/build
./third_party/openssh-7.9/build.sh

BUILD_ARGS=()
if [[ $DEBUG == 1 ]]; then
  BUILD_ARGS+=( DEBUG=1 )
  tarname="debug.tar"
else
  tarname="release.tar"
fi

make -C src clean && make -C src -j${ncpus} "${BUILD_ARGS[@]}"

cd output
tar cf "${tarname}" plugin/ *.pexe *.dbg.nexe
