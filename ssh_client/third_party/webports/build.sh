#!/bin/bash
# Copyright 2018 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

PV="49"

GIR_URI="https://chromium.googlesource.com/webports.git"

pushd output >/dev/null

if [[ ! -d webports/src ]]; then
  # Get own copy of depot_tools for gclient.
  ../third_party/depot_tools/build.sh
  PATH="${PWD}/depot_tools:${PATH}"

  rm -rf webports && mkdir webports
  pushd webports >/dev/null
  gclient config --name=src "${GIR_URI}"
  gclient sync --jobs=8 -r "src@pepper_${PV}"
  popd >/dev/null
fi

make -C webports/src openssl zlib jsoncpp

popd >/dev/null
