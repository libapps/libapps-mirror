#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

if [ -z "$LIBDOT_SEARCH_PATH" ]; then
  export LIBDOT_SEARCH_PATH="$(readlink -f "$(dirname "$0")/../..")"
fi

cd "$(readlink -f "$(dirname "$0")/..")"

../libdot/bin/concat.sh -i ./concat/nassh_deps.concat \
  -o ./js/nassh_deps.concat.js $@

AXIOM_SRC_PATH=${AXIOM_SRC_PATH:-"$HOME/src/axiom/"}

cp -v "$AXIOM_SRC_PATH/dist/axiom_base/amd/lib/axiom_base.amd.concat.js" \
  ./js/axiom_base.amd.concat.js

cp -v  "$AXIOM_SRC_PATH/dist/axiom_wash/amd/lib/wash.amd.concat.js" \
  ./js/wash.amd.concat.js
