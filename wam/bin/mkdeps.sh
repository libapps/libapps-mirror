#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.


if [ -z "$LIBDOT_SEARCH_PATH" ]; then
  export LIBDOT_SEARCH_PATH="$(readlink -f "$(dirname "$0")/../..")"
fi

cd "$(readlink -f "$(dirname "$0")/..")"

../libdot/bin/concat.sh $1 -i ./concat/wam_test_deps.concat \
  -o ./js/wam_test_deps.concat.js
