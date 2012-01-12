#!/bin/bash
# Copyright (c) 2011 The Native Client Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.
#

# nacl-openssh-5.9p1.sh
#
# usage: nacl-openssh-5.9p1.sh
#
# download, patch and build openssh for Native Client
#

readonly PACKAGE_NAME=openssh-5.9p1
readonly OPENSSH_MIRROR=http://ftp5.usa.openbsd.org/pub/OpenBSD/OpenSSH/portable
readonly PATCH_FILE=$PWD/../${PACKAGE_NAME}.patch
readonly CONFIG_PATCH_FILE=$PWD/../${PACKAGE_NAME}.config.patch

source $NACL_PORTS/src/build_tools/common.sh

export CC=${NACLCC}
export CXX=${NACLCXX}
export AR=${NACLAR}
export RANLIB=${NACLRANLIB}
export PKG_CONFIG_PATH=${NACL_SDK_USR_LIB}/pkgconfig
export PKG_CONFIG_LIBDIR=${NACL_SDK_USR_LIB}
export PATH=${NACL_BIN_PATH}:${PATH};

rm -rf $PACKAGE_NAME/
if [[ ! -f ${PACKAGE_NAME}.tar.gz ]]
then
  wget $OPENSSH_MIRROR/${PACKAGE_NAME}.tar.gz -O ${PACKAGE_NAME}.tar.gz || exit 1
fi
tar xvzf ${PACKAGE_NAME}.tar.gz

cd $PACKAGE_NAME
patch -p0 -i $PATCH_FILE || exit 1

./configure --host=nacl --prefix=${NACL_SDK_USR} \
    CFLAGS="-DHAVE_SIGACTION -DHAVE_TRUNCATE"  || exit 1

patch -p0 -i $CONFIG_PATCH_FILE || exit 1

# will fail on link stage due to missing reference to main - it is expected
make ssh || echo "Ignore error."
$AR rcs ../libopenssh${NACL_PACKAGES_BITSIZE}.a \
    ssh.o readconf.o clientloop.o sshtty.o sshconnect.o sshconnect1.o \
    sshconnect2.o mux.o roaming_common.o roaming_client.o
cp -f libssh.a ../libssh${NACL_PACKAGES_BITSIZE}.a
cp -f openbsd-compat/libopenbsd-compat.a ../libopenbsd-compat${NACL_PACKAGES_BITSIZE}.a
