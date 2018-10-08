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

./third_party/naclsdk/build.sh
export NACL_SDK_ROOT=$(echo "${PWD}/output/naclsdk"/pepper_*)

./third_party/webports/build.sh
export WEB_PORTS="${PWD}/output/webports"

./third_party/mandoc/build.sh

build() {
  pushd output
  if [[ ! -f libopenssh-pnacl.a ]]; then
    ../nacl-openssh.sh
  fi
  popd
}

build

BUILD_ARGS=()
if [[ $DEBUG == 1 ]]; then
  BUILD_ARGS+=( DEBUG=1 )
  tarname="debug.tar"
else
  tarname="release.tar"
fi

make clean && make -j${ncpus} "${BUILD_ARGS[@]}"

cd output
mkdir -p hterm/plugin/docs/
cp *.[0-9].html hterm/plugin/docs/

rm -rf hterm/plugin/pnacl
mkdir -p hterm/plugin/pnacl

cp -f ../ssh_client.nmf hterm/plugin/pnacl/
cp -f ssh_client_nl_x86_32.nexe hterm/plugin/pnacl/
cp -f ssh_client_nl_x86_64.nexe hterm/plugin/pnacl/
cp -f ssh_client_nl_arm.nexe hterm/plugin/pnacl/
tar cf "${tarname}" hterm/plugin/ *.pexe *.dbg.nexe
