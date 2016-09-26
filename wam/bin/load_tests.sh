#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

LIBDOT_DIR="$(dirname -- "$0")/../../libdot"
source "${LIBDOT_DIR}/bin/common.sh"

cd "${BIN_DIR}/.."

if [ -z $DISPLAY ]; then
  export DISPLAY=":0.0"
fi

if [ -z "$CHROME_TEST_PROFILE" ]; then
  CHROME_TEST_PROFILE=$HOME/.config/google-chrome-run_local
fi

mkdir -p $CHROME_TEST_PROFILE

./bin/mkdeps.sh

google-chrome \
  "file:///$(pwd)/html/wam_test.html" \
  --allow-file-access-from-files \
  --user-data-dir=$CHROME_TEST_PROFILE \
  &>/dev/null </dev/null &
