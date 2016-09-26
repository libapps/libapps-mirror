#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

LIBDOT_DIR="$(dirname -- "$0")/../../libdot"
source "${LIBDOT_DIR}/bin/common.sh"

cd "${BIN_DIR}/.."

./bin/mkdeps.sh

mkdir -p ./dist/zip

export MORE_FILE_PATTERNS='
  \./[^/]*\.nmf
  \./[^/]*\.pexe
  \./[^/]*\.tar
'

mkzip.sh -s "." -w ./dist/zip/ "$@"
