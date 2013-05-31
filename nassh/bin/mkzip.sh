#!/bin/sh
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

cd "$(readlink -f "$(dirname "$0")/..")"

if [ -z "$LIBDOT_SEARCH_PATH" ]; then
  export LIBDOT_SEARCH_PATH="$(readlink -f "../")"
fi

source "../libdot/bin/common.sh"

BUILT_HTERM_VERSION=$(grep -A1 "lib.resource.add('hterm/changelog/version'" \
  ./js/nassh_deps.concat.js | tail -1 | tr -d \'\+\ )

if [ -z "$BUILT_HTERM_VERSION" ]; then
  echo_err "Error reading hterm version."
  exit
fi

AVAILABLE_HTERM_VERSION="$(echo_changelog \
    "version" "../hterm/doc/changelog.txt")"

if [ "$BUILT_HTERM_VERSION" != "$AVAILABLE_HTERM_VERSION" ]; then
  echo_err "Warning: nassh_deps has hterm $BUILT_HTERM_VERSION but the" \
    "current version is $AVAILABLE_HTERM_VERSION"
  echo_err "Press ^C to cancel or enter to continue."
  read
fi

mkdir -p ./dist/zip

../libdot/bin/mkzip.sh -s "." -w ./dist/zip/ "$@"
