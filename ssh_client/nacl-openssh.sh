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

set -xe

ncpus=$(getconf _NPROCESSORS_ONLN || echo 2)

readonly PACKAGE_NAME=openssh-7.8p1
readonly OPENSSH_MIRROR="https://commondatastorage.googleapis.com/chromeos-localmirror/secureshell"
readonly ROOT=$PWD/..
readonly PATCH_FILE=${ROOT}/${PACKAGE_NAME}.patch

source $WEB_PORTS/src/build_tools/nacl-env.sh

export CC=${NACLCC}
export CXX=${NACLCXX}
export AR=${NACLAR}
export RANLIB=${NACLRANLIB}

# Assume PNaCl toolchain.
readonly NACL_ARCH="pnacl"
readonly NACL_TOOLCHAIN_INSTALL=${NACL_TOOLCHAIN_ROOT}/le32-nacl

readonly WEBPORTS_PREFIX=${NACL_TOOLCHAIN_INSTALL}/usr
readonly WEBPORTS_INCLUDE=${WEBPORTS_PREFIX}/include
readonly WEBPORTS_LIBDIR=${WEBPORTS_PREFIX}/lib
readonly WEBPORTS_BIN=${WEBPORTS_PREFIX}/bin

export PKG_CONFIG_LIBDIR=${WEBPORTS_LIBDIR}
export PKG_CONFIG_PATH=${PKG_CONFIG_LIBDIR}/pkgconfig
export PATH=${NACL_BIN_PATH}:${PATH};
export MANDOC="${PWD}/mandoc"

if [[ ! -f ${PACKAGE_NAME}.tar.gz ]]; then
  wget "${OPENSSH_MIRROR}/${PACKAGE_NAME}.tar.gz" -O "${PACKAGE_NAME}.tar.gz"
fi

# If we haven't gotten past `./configure`, start over.
if [[ ! -e ${PACKAGE_NAME}/Makefile ]]; then
  rm -rf "${PACKAGE_NAME}"
  tar xzf ${PACKAGE_NAME}.tar.gz
  cd "${PACKAGE_NAME}"
  patch -p1 -i "${PATCH_FILE}"
else
  cd "${PACKAGE_NAME}"
fi

EXTRA_LIBS=( -lglibc-compat )
EXTRA_CFLAGS=(
  -DHAVE_SIGACTION -DHAVE_TRUNCATE
  -DHAVE_SETSID -DHAVE_GETNAMEINFO -DHAVE_GETADDRINFO
  -DHAVE_GETCWD -DHAVE_STATVFS -DHAVE_FSTATVFS
  -DHAVE_ENDGRENT -DHAVE_FD_MASK -include sys/cdefs.h
  ${NACL_CPPFLAGS}
  -I"${WEBPORTS_INCLUDE}/glibc-compat"
)
EXTRA_CONFIGURE_FLAGS=(
  # Log related settings.
  --disable-lastlog
  --disable-{u,w}tmp{,x}
  --disable-putut{,x}line

  # Various toolchain settings.
  --without-rpath
  --without-Werror

  # Features we don't use.
  --without-audit
  --without-ldns
  --without-libedit
  --without-pam
  --without-sandbox
  --without-selinux
  --without-shadow
  --without-ssl-engine

  # Features we want.
  --with-openssl  # Needed for DSA/RSA key support.
  --with-zlib --without-zlib-version-check

  # These don't work with newlib (used in PNaCl).
  --without-stackprotect
  --without-hardening
)
export ac_cv_func_inet_aton=no
export ac_cv_func_inet_ntoa=no
export ac_cv_func_inet_ntop=no

# The prefix path matches what is used at runtime.
if [[ ! -e Makefile ]]; then
  ./configure --host=nacl --prefix="/" \
      --cache-file="../config.cache" \
      CFLAGS="${EXTRA_CFLAGS[*]}" \
      LIBS="${EXTRA_LIBS[*]}" \
      "${EXTRA_CONFIGURE_FLAGS[@]}"
fi

# Build the html man pages.
cat <<\EOF >>Makefile
html: $(MANPAGES_IN:%=%.html)
%.html: %
	$(MANDOC) -Thtml -I os='$(PACKAGE_NAME)' -O man=%N.%S.html $< > $@.tmp && mv $@.tmp $@
EOF
export PACKAGE_NAME

# will fail on link stage due to missing reference to main - it is expected
objects=(
    ssh.o readconf.o clientloop.o sshtty.o sshconnect.o sshconnect2.o mux.o
)
make -j${ncpus} \
    html \
    "${objects[@]}" \
    libssh.a \
    openbsd-compat/libopenbsd-compat.a
$AR rcs ../libopenssh-${NACL_ARCH}.a "${objects[@]}"
cp -f libssh.a ../libssh-${NACL_ARCH}.a
cp -f openbsd-compat/libopenbsd-compat.a ../libopenbsd-compat-${NACL_ARCH}.a
cp -f *.[0-9].html ../
