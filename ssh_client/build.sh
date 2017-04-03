#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

set -xe

ncpus=$(getconf _NPROCESSORS_ONLN || echo 2)

DEBUG=0
PNACL=1

NACLSDK_VERSION=49.0.2623.87
WEBPORTS_REVISION=${NACLSDK_VERSION%%.*}

CDS_ROOT="https://commondatastorage.googleapis.com"
SDK_ROOT="$CDS_ROOT/nativeclient-mirror/nacl/nacl_sdk"
NACL_SDK="$SDK_ROOT/$NACLSDK_VERSION/naclsdk_linux.tar.bz2"

for i in $@; do
  case $i in
    "--debug")
      DEBUG=1
      ;;

    "--no-pnacl")
      PNACL=0
      ;;

    *)
      echo "usage: $0 [--no-pnacl] [--debug]"
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

if [[ ($WEB_PORTS == "") || !(-d $WEB_PORTS) ]]; then
  pushd output
  if [[ !(-d webports/src) ]]; then
    rm -rf webports && mkdir webports
    cd webports
    gclient config --name=src https://chromium.googlesource.com/webports.git
    gclient sync --jobs=8 -r src@pepper_$WEBPORTS_REVISION
    cd ..
  fi
  export WEB_PORTS=$PWD/webports
  popd
fi

build() {
  pushd $WEB_PORTS/src
  NACL_ARCH=$1 TOOLCHAIN=$2 make openssl zlib jsoncpp
  popd

  pushd output
  if [[ !(-f libopenssh-$1.a) ]]; then
    NACL_ARCH=$1 TOOLCHAIN=$2 ../nacl-openssh.sh
  fi
  popd
}

if [[ $PNACL == 1 ]]; then
  build "pnacl" "pnacl"
else
  build "i686" "glibc"
  build "x86_64" "glibc"
fi

BUILD_ARGS=()
if [[ $DEBUG == 1 ]]; then
  BUILD_ARGS+=( DEBUG=1 )
  tarname="debug.tar"
else
  tarname="release.tar"
fi

if [[ $PNACL == 1 ]]; then
  readonly DEFAULT_TARGET=all_newlib
else
  readonly DEFAULT_TARGET=all_glibc
fi
make clean && make -j${ncpus} "${BUILD_ARGS[@]}" ${DEFAULT_TARGET}

cd output
mkdir -p hterm/plugin/docs/
cp *.[0-9].html hterm/plugin/docs/

if [[ $PNACL == 1 ]]; then
  rm -rf hterm/plugin/pnacl
  mkdir -p hterm/plugin/pnacl

  cp -f ../ssh_client_newlib.nmf hterm/plugin/pnacl/ssh_client.nmf
  cp -f ssh_client_nl_x86_32.nexe hterm/plugin/pnacl/
  cp -f ssh_client_nl_x86_64.nexe hterm/plugin/pnacl/
  cp -f ssh_client_nl_arm.nexe hterm/plugin/pnacl/
else
  rm -rf hterm/plugin/nacl
  mkdir -p hterm/plugin/nacl

  cp -f ../ssh_client.nmf hterm/plugin/nacl

  GLIBC_VERSION=`ls \
      $NACL_SDK_ROOT/toolchain/linux_x86_glibc/x86_64-nacl/lib32/libc.so.* \
          | sed s/.*libc.so.//`
  sed -i s/xxxxxxxx/$GLIBC_VERSION/ hterm/plugin/nacl/ssh_client.nmf

  cp -f ssh_client_x86_32.nexe \
    hterm/plugin/nacl/ssh_client_x86_32.nexe
  cp -f ssh_client_x86_64.nexe \
    hterm/plugin/nacl/ssh_client_x86_64.nexe

  mkdir hterm/plugin/nacl/lib32
  mkdir hterm/plugin/nacl/lib64
  LIBS="runnable-ld.so libstdc++.so.6 libgcc_s.so.1 libpthread.so.* \
        libresolv.so.* libdl.so.* libnsl.so.* libm.so.* libc.so.*"
  for i in $LIBS; do
    cp -f $NACL_SDK_ROOT/toolchain/linux_x86_glibc/x86_64-nacl/lib32/$i \
        hterm/plugin/nacl/lib32/
    cp -f $NACL_SDK_ROOT/toolchain/linux_x86_glibc/x86_64-nacl/lib64/$i \
        hterm/plugin/nacl/lib64/
  done

  LIBS="libppapi_cpp.so libppapi_cpp_private.so libjsoncpp.so"
  for i in $LIBS; do
    cp -f $NACL_SDK_ROOT/lib/glibc_x86_32/Release/$i \
        hterm/plugin/nacl/lib32/
    cp -f $NACL_SDK_ROOT/lib/glibc_x86_64/Release/$i \
        hterm/plugin/nacl/lib64/
  done

  LIBS="libz.so.1 libcrypto.so.1.0.0"
  for i in $LIBS; do
    cp -f $NACL_SDK_ROOT/toolchain/linux_x86_glibc/i686-nacl/usr/lib/$i \
        hterm/plugin/nacl/lib32/
    cp -f $NACL_SDK_ROOT/toolchain/linux_x86_glibc/x86_64-nacl/usr/lib/$i \
        hterm/plugin/nacl/lib64/
  done
fi
tar cf "${tarname}" hterm/plugin/ *.pexe *.dbg.nexe

if [[ -f ../ssh_client.pem ]]; then
  /opt/google/chrome/chrome --pack-extension=hterm \
      --pack-extension-key=../ssh_client.pem
fi
