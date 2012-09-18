#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

set -x

DEBUG=0
PNACL=0

for i in $@; do
  case $i in
    "--debug")
      DEBUG=1
      ;;

    "--pnacl")
      PNACL=1
      ;;

    *)
      echo "usage: $0 [--pnacl] [--debug]"
      exit 1
      ;;
  esac
done

cd "$(dirname "$0")"
mkdir output

if [[ ($NACL_SDK_ROOT == "") || !(-d $NACL_SDK_ROOT) ]]; then
  pushd output
  if [[ $PNACL == 1 ]]; then
    if [[ !(-f pnaclsdk_linux.tar.bz2) || !(-d pnaclsdk) ]]; then
      rm -rf pnaclsdk_linux.tar.bz2 pnacl_sdk && mkdir pnaclsdk
      wget --no-check-certificate https://commondatastorage.googleapis.com/nativeclient-mirror/nacl/nacl_sdk/trunk.157509/pnaclsdk_linux.tar.bz2
      tar xvjf pnaclsdk_linux.tar.bz2 -C pnaclsdk || exit 1
    fi
    export NACL_SDK_ROOT=$PWD/pnaclsdk/pepper_23
  else
    if [[ !(-f naclsdk_linux.tar.bz2) || !(-d naclsdk) ]]; then
      rm -rf naclsdk_linux.tar.bz2 nacl_sdk && mkdir naclsdk
      wget --no-check-certificate https://commondatastorage.googleapis.com/nativeclient-mirror/nacl/nacl_sdk/trunk.157509/naclsdk_linux.tar.bz2
      tar xvjf naclsdk_linux.tar.bz2 -C naclsdk || exit 1
    fi
    export NACL_SDK_ROOT=$PWD/naclsdk/pepper_23
  fi
  popd
fi

if [[ ($NACL_PORTS == "") || !(-d $NACL_PORTS) ]]; then
  pushd output
  if [[ !(-d naclports/src) ]]; then
    rm -rf naclports && mkdir naclports
    cd naclports
    gclient config http://naclports.googlecode.com/svn/trunk/src || exit 1
    gclient sync --jobs=4 || exit 1
    cd ..
  fi
  export NACL_PORTS=$PWD/naclports
  popd
fi

build() {
  pushd $NACL_PORTS/src
  NACL_PACKAGES_BITSIZE=$1 make openssl zlib jsoncpp || exit 1
  popd

  pushd output
  if [[ !(-f libopenssh$1.a) ]]; then
    NACL_PACKAGES_BITSIZE=$1 ../nacl-openssh-5.9p1.sh || exit 1
  fi
  popd
}

if [[ $PNACL == 1 ]]; then
  build "pnacl"
else
  export NACL_GLIBC=1
  build "32"
  build "64"
fi

if [[ $DEBUG == 1 ]]; then
  BUILD_ARGS="CXXFLAGS=-g -O0 -DDEBUG"
else
  BUILD_ARGS="CXXFLAGS=-g -O2 -DNDEBUG"
fi

if [[ $PNACL == 1 ]]; then
  readonly DEFAULT_TARGET=all_newlib
else
  readonly DEFAULT_TARGET=all_glibc
fi
make clean && make -j "$BUILD_ARGS" $DEFAULT_TARGET || exit 1

cd output
rm -rf hterm
mkdir -p hterm/plugin

cp -R -f ../../hterm/{audio,css,html,images,js,_locales} ./hterm || exit 1
cp -R -f ../../hterm/manifest-dev.json ./hterm/manifest.json || exit 1

if [[ $PNACL == 1 ]]; then
  cp -f ../ssh_client_newlib.nmf hterm/plugin/ssh_client.nmf || exit 1

  cp -f ssh_client_nl_x86_32.nexe hterm/plugin/ || exit 1
  cp -f ssh_client_nl_x86_64.nexe hterm/plugin/ || exit 1
  cp -f ssh_client_nl_arm.nexe hterm/plugin/ || exit 1
else
  cp -f ../ssh_client.nmf hterm/plugin || exit 1

  GLIBC_VERSION=`ls \
      $NACL_SDK_ROOT/toolchain/linux_x86_glibc/x86_64-nacl/lib32/libc.so.* \
          | sed s/.*libc.so.//`
  sed -i s/xxxxxxxx/$GLIBC_VERSION/ hterm/plugin/ssh_client.nmf || exit 1

  cp -f ssh_client_x86_32.nexe hterm/plugin/ssh_client_x86_32.nexe || exit 1
  cp -f ssh_client_x86_64.nexe hterm/plugin/ssh_client_x86_64.nexe || exit 1

  mkdir hterm/plugin/lib32
  mkdir hterm/plugin/lib64
  LIBS="runnable-ld.so libppapi_cpp.so libppapi_cpp.so libstdc++.so.6 \
        libgcc_s.so.1 libpthread.so.* libresolv.so.* libdl.so.* libnsl.so.* \
        libm.so.* libc.so.*"
  for i in $LIBS; do
    cp -f $NACL_SDK_ROOT/toolchain/linux_x86_glibc/x86_64-nacl/lib32/$i \
        hterm/plugin/lib32/
    cp -f $NACL_SDK_ROOT/toolchain/linux_x86_glibc/x86_64-nacl/lib64/$i \
        hterm/plugin/lib64/
  done
fi

if [[ -f ../ssh_client.pem ]]; then
  /opt/google/chrome/chrome --pack-extension=hterm \
      --pack-extension-key=../ssh_client.pem
fi
