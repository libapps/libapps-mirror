#!/bin/bash
# Copyright 2018 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

NACLSDK_VERSION="49.0.2623.87"

CDS_ROOT="https://commondatastorage.googleapis.com"
SDK_ROOT="${CDS_ROOT}/nativeclient-mirror/nacl/nacl_sdk"
NACL_SDK="${SDK_ROOT}/${NACLSDK_VERSION}/naclsdk_linux.tar.bz2"

pushd output >/dev/null

if [[ ! -f naclsdk_linux.tar.bz2 || ! -d naclsdk ]]; then
  rm -rf naclsdk_linux.tar.bz2 nacl_sdk && mkdir naclsdk
  wget "${NACL_SDK}"
  tar xf naclsdk_linux.tar.bz2 -C naclsdk
fi

popd >/dev/null
