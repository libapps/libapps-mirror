#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

LIBDOT_DIR="$(dirname -- "$0")/../../libdot"
source "${LIBDOT_DIR}/bin/common.sh"

cd "${BIN_DIR}/.."

BUILT_HTERM_VERSION=$(grep -A1 "lib.resource.add('hterm/changelog/version'" \
  ./js/nassh_deps.concat.js | tail -1 | tr -d \'\+\ )

if [ -z "$BUILT_HTERM_VERSION" ]; then
  echo_err "Error reading hterm version."
  exit
fi

AVAILABLE_HTERM_VERSION="$(echo_changelog \
    "version" "../hterm/doc/ChangeLog.md")"

if [ "$BUILT_HTERM_VERSION" != "$AVAILABLE_HTERM_VERSION" ]; then
  echo_err "Warning: nassh_deps has hterm $BUILT_HTERM_VERSION but the" \
    "current version is $AVAILABLE_HTERM_VERSION"
  echo_err "Press ^C to cancel or enter to continue."
  read
fi

mkdir -p ./dist/zip

export MORE_FILE_PATTERNS_EXCLUDE='
  .*_tests?.\(js\|html\)$
'

mkzip.sh -s "." -w ./dist/zip/ "$@"
