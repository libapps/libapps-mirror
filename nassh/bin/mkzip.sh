#!/bin/sh
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

cd "$(readlink -f "$(dirname "$0")/..")"

if [ -z "$LIBDOT_SEARCH_PATH" ]; then
  export LIBDOT_SEARCH_PATH="$(readlink -f "../")"
fi

mkdir -p ./dist/zip

../libdot/bin/mkzip.sh -s "." -w ./dist/zip/ "$@"
