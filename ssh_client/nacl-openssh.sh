#!/bin/bash
# Copyright (c) 2011 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.
#

# nacl-openssh.sh
#
# usage: nacl-openssh.sh
#
# download, patch and build openssh for Native Client
#

set -x

ncpus=$(getconf _NPROCESSORS_ONLN || echo 2)

readonly PACKAGE_NAME=openssh-6.6p1
readonly OPENSSH_MIRROR=http://ftp5.usa.openbsd.org/pub/OpenBSD/OpenSSH/portable
readonly ROOT=$PWD/..
readonly PATCH_FILE=${ROOT}/${PACKAGE_NAME}.patch

source $NACL_PORTS/src/build_tools/nacl_env.sh

export CC=${NACLCC}
export CXX=${NACLCXX}
export AR=${NACLAR}
export RANLIB=${NACLRANLIB}

if [ "${NACL_ARCH}" = "pnacl" ]; then
  readonly NACL_TOOLCHAIN_INSTALL=${NACL_TOOLCHAIN_ROOT}
else
  readonly NACL_TOOLCHAIN_INSTALL=${NACL_TOOLCHAIN_ROOT}/${NACL_CROSS_PREFIX}
fi

readonly NACLPORTS_PREFIX=${NACL_TOOLCHAIN_INSTALL}/usr
readonly NACLPORTS_INCLUDE=${NACLPORTS_PREFIX}/include
readonly NACLPORTS_LIBDIR=${NACLPORTS_PREFIX}/lib
readonly NACLPORTS_BIN=${NACLPORTS_PREFIX}/bin

export PKG_CONFIG_LIBDIR=${NACLPORTS_LIBDIR}
export PKG_CONFIG_PATH=${PKG_CONFIG_LIBDIR}/pkgconfig
export PATH=${NACL_BIN_PATH}:${PATH};

# Tools for generating the html man pages.
MANDOC_P="mdocml-1.13.4"
if [[ ! -x ${MANDOC_P}/mandoc ]]; then
  if [[ ! -f ${MANDOC_P}.tar.gz ]]; then
    wget http://mdocml.bsd.lv/snapshots/${MANDOC_P}.tar.gz
  fi
  rm -rf "${MANDOC_P}"
  tar xf ${MANDOC_P}.tar.gz
  pushd "${MANDOC_P}" >/dev/null
  (
    unset AR CC CFLAGS CPPFLAGS LDFLAGS
    ./configure
  )
  make -j${ncpus} mandoc
  popd >/dev/null
fi
export MANDOC="${PWD}/${MANDOC_P}/mandoc"

rm -rf $PACKAGE_NAME/
if [[ ! -f ${PACKAGE_NAME}.tar.gz ]]
then
  wget $OPENSSH_MIRROR/${PACKAGE_NAME}.tar.gz -O ${PACKAGE_NAME}.tar.gz || exit 1
fi
tar xzf ${PACKAGE_NAME}.tar.gz

cd $PACKAGE_NAME
patch -p2 -i $PATCH_FILE || exit 1

if [ ${NACL_ARCH} = "pnacl" ] ; then
  export EXTRA_CFLAGS="-DHAVE_SETSID -DHAVE_GETNAMEINFO -DHAVE_GETADDRINFO \
                       -DHAVE_GETCWD -DHAVE_STATVFS -DHAVE_FSTATVFS \
                       -DHAVE_ENDGRENT -DHAVE_FD_MASK -include sys/cdefs.h \
                       ${NACL_CPPFLAGS} \
                       -I${NACLPORTS_INCLUDE}/glibc-compat"
  export EXTRA_CONFIGURE_FLAGS="--without-stackprotect --without-hardening"
  export EXTRA_LIBS="-lglibc-compat"
  export ac_cv_func_inet_aton=no
  export ac_cv_func_inet_ntoa=no
  export ac_cv_func_inet_ntop=no
else
  export EXTRA_CFLAGS=-I${NACLPORTS_INCLUDE}
  export EXTRA_CONFIGURE_FLAGS=
  export EXTRA_LIBS=
fi

./configure --host=nacl --prefix=${NACLPORTS_PREFIX} \
    CFLAGS="-DHAVE_SIGACTION -DHAVE_TRUNCATE $EXTRA_CFLAGS" \
    LIBS=$EXTRA_LIBS \
    ${EXTRA_CONFIGURE_FLAGS}  || exit 1

# Build the html man pages.
cat <<\EOF >>Makefile
html: $(MANPAGES_IN:%=%.html)
%.html: %
	$(MANDOC) -Thtml -O man=%N.%S.html $< > $@.tmp && mv $@.tmp $@
EOF

# will fail on link stage due to missing reference to main - it is expected
objects=(
    ssh.o readconf.o clientloop.o sshtty.o sshconnect.o sshconnect1.o
    sshconnect2.o mux.o roaming_common.o roaming_client.o
)
make -j${ncpus} \
    html \
    "${objects[@]}" \
    libssh.a \
    openbsd-compat/libopenbsd-compat.a \
    || exit 1
$AR rcs ../libopenssh-${NACL_ARCH}.a "${objects[@]}" || exit 1
cp -f libssh.a ../libssh-${NACL_ARCH}.a || exit 1
cp -f openbsd-compat/libopenbsd-compat.a ../libopenbsd-compat-${NACL_ARCH}.a || exit 1
cp -f *.[0-9].html ../
