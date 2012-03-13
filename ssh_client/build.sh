#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

set -x
cd "$(dirname "$0")"
mkdir output

if [[ ($NACL_SDK_ROOT == "") || !(-d $NACL_SDK_ROOT) ]]; then
  pushd output
  if [[ !(-f naclsdk_linux.tgz) || !(-d naclsdk) ]]; then
    rm -rf naclsdk_linux.tgz nacl_sdk && mkdir naclsdk
    wget --no-check-certificate https://commondatastorage.googleapis.com/nativeclient-mirror/nacl/nacl_sdk/17.0.963.40/naclsdk_linux.tgz || exit 1
    tar xvzf naclsdk_linux.tgz -C naclsdk || exit 1
  fi
  export NACL_SDK_ROOT=$PWD/naclsdk
  popd
fi

if [[ ($NACL_PORTS == "") || !(-d $NACL_PORTS) ]]; then
  pushd output
  if [[ !(-d naclports/src) ]]; then
    rm -rf naclports && mkdir naclports
    cd naclports
    gclient config http://naclports.googlecode.com/svn/trunk/src || exit 1
    gclient sync --jobs=2 || exit 1
    cd ..
  fi
  export NACL_PORTS=$PWD/naclports
  popd
fi

pushd $NACL_PORTS/src
export NACL_GLIBC=1
NACL_PACKAGES_BITSIZE=32 make openssl zlib jsoncpp || exit 1
NACL_PACKAGES_BITSIZE=64 make openssl zlib jsoncpp || exit 1
popd

pushd output
if [[ !(-f libopenssh32.a) ]]; then
  NACL_PACKAGES_BITSIZE=32 ../nacl-openssh-5.9p1.sh || exit 1
fi

if [[ !(-f libopenssh64.a) ]]; then
  NACL_PACKAGES_BITSIZE=64 ../nacl-openssh-5.9p1.sh || exit 1
fi
popd

if [[ $1 == "--debug" ]]; then
  BUILD_ARGS="--build_type=debug"
  BUILD_SUFFIX="_dbg"
else
  BUILD_ARGS="--build_type=release"
  BUILD_SUFFIX=""
fi
./scons $BUILD_ARGS || exit 1

cd output
mkdir -p hterm/plugin
cp ../ssh_client.nmf hterm/plugin || exit 1
cp -R -f ../../hterm/{audio,css,html,images,js,_locales} ./hterm || exit 1
cp -R -f ../../hterm/manifest-dev.json ./hterm/manifest.json || exit 1
mkdir hterm/plugin/lib32
mkdir hterm/plugin/lib64

export GLIBC_VERSION=`ls $NACL_SDK_ROOT/toolchain/linux_x86/x86_64-nacl/lib32/libc.so.* | sed s/.*libc.so.//`
sed -i s/xxxxxxxx/$GLIBC_VERSION/ hterm/plugin/ssh_client.nmf || exit 1

cp -f ssh_client_x86_32${BUILD_SUFFIX}.nexe hterm/plugin/ssh_client_x86_32.nexe || exit 1
cp -f ssh_client_x86_64${BUILD_SUFFIX}.nexe hterm/plugin/ssh_client_x86_64.nexe || exit 1

LIBS="runnable-ld.so libppapi_cpp.so libppapi_cpp.so libstdc++.so.6 \
      libgcc_s.so.1 libpthread.so.* libresolv.so.* libdl.so.* libnsl.so.* \
      libm.so.* libc.so.*"
for i in $LIBS; do
  cp -f $NACL_SDK_ROOT/toolchain/linux_x86/x86_64-nacl/lib32/$i hterm/plugin/lib32/
  cp -f $NACL_SDK_ROOT/toolchain/linux_x86/x86_64-nacl/lib64/$i hterm/plugin/lib64/
done

if [[ -f../ssh_client.pem ]]; then
  /opt/google/chrome/chrome --pack-extension=hterm --pack-extension-key=../ssh_client.pem
fi
