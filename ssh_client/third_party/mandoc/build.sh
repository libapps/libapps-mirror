#!/bin/bash
# Copyright 2018 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

ncpus=$(getconf _NPROCESSORS_ONLN || echo 2)
readonly OPENSSH_MIRROR="https://commondatastorage.googleapis.com/chromeos-localmirror/secureshell"

pushd output >/dev/null

MANDOC_P="mandoc-1.14.3"
if [[ ! -x ${MANDOC_P}/mandoc ]]; then
  rm -f mandoc
  if [[ ! -f ${MANDOC_P}.tar.gz ]]; then
    wget "${OPENSSH_MIRROR}/${MANDOC_P}.tar.gz"
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

if [[ ! -x mandoc ]]; then
  ln -sf "${MANDOC_P}/mandoc" ./mandoc
fi

popd >/dev/null
