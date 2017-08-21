#!/bin/bash
# Copyright 2017 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

# TODO: Should prob sort out the /int and /casting warnings.

LIBDOT_DIR="$(dirname -- "$0")/../libdot"
source "${LIBDOT_DIR}/bin/common.sh"

if [[ $# -eq 0 ]]; then
  cd "${LIBDOT_DIR}/../ssh_client"
  set -- src/*.cc src/*.h
fi
exec \
  cpplint.py \
  --filter=-build/header_guard,-build/include,-runtime/int,-readability/casting,-readability/todo \
  "$@"
