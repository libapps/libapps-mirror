#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

set -xe

ncpus=$(getconf _NPROCESSORS_ONLN || echo 2)

DEBUG=0

NACLSDK_VERSION=49.0.2623.87

CDS_ROOT="https://commondatastorage.googleapis.com"
SDK_ROOT="$CDS_ROOT/nativeclient-mirror/nacl/nacl_sdk"
NACL_SDK="$SDK_ROOT/$NACLSDK_VERSION/naclsdk_linux.tar.bz2"

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

if [[ ($NACL_SDK_ROOT == "") || !(-d $NACL_SDK_ROOT) ]]; then
  pushd output
  if [[ !(-f naclsdk_linux.tar.bz2) || !(-d naclsdk) ]]; then
    rm -rf naclsdk_linux.tar.bz2 nacl_sdk && mkdir naclsdk
    wget "$NACL_SDK"
    tar xjf naclsdk_linux.tar.bz2 -C naclsdk
  fi
  export NACL_SDK_ROOT=$(echo $PWD/naclsdk/pepper_*)
  popd
fi

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
