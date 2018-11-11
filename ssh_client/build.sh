#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

set -xe

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

./third_party/naclsdk/build

./third_party/depot_tools/build
./third_party/webports/build
./third_party/zlib/build
./third_party/openssl/build
./third_party/jsoncpp/build

./third_party/mandoc/build
./third_party/openssh-7.9/build

BUILD_ARGS=()
if [[ $DEBUG == 1 ]]; then
  BUILD_ARGS+=( DEBUG=1 )
  tarname="debug.tar"
else
  tarname="release.tar"
fi

make -C src clean && make -C src -j${ncpus} "${BUILD_ARGS[@]}"

cd output
tar cf "${tarname}" \
	`find plugin/ -type f | LC_ALL=C sort` \
	`find build/pnacl* -name '*.pexe' -o -name '*.dbg.nexe' | LC_ALL=C sort`
