#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

LIBDOT_DIR="$(dirname -- "$0")/../../libdot"
source "${LIBDOT_DIR}/bin/common.sh"

cd "${BIN_DIR}/.."

"${BIN_DIR}"/mkdeps.sh

mkdir -p ./dist/zip

export MORE_FILE_PATTERNS_EXCLUDE='
  .*_tests?\.\(js\|html\)$
  .*/images/\(promo\|screenshot\)-.*\.\(jpg\|png\)$
'

stamp="$(date +%Y%m%d.%H%M%S)"
for manifest in manifest_*.json; do
  mkzip.sh --append_version "${stamp}" \
    -s "." -w ./dist/zip/ -m "${manifest}" "$@"
done
