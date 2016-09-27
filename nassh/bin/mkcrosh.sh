#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

# Pass this an existing Secure Shell zip from (made from ../nassh/bin/mkzip.sh)
# and it'll turn it into a crosh_builtin.zip file.

LIBDOT_DIR="$(dirname -- "$0")/../../libdot"
source "${LIBDOT_DIR}/bin/common.sh"

if [ -z "$1" ]; then
  echo "Missing argument."
  exit 1
fi

SSZIP="$(readlink -f "$1")"
if [ ! -e "$SSZIP" ]; then
  echo "Not found: $SSZIP"
  exit 1
fi

# Fail on error.
set -e

cd "${BIN_DIR}"

# Remove previous work
rm -f crosh_builtin.zip
rm -rf tmp

# Unzip the given Secure Shell zip
mkdir -p tmp
(cd tmp; unzip -q "$SSZIP")

# Save the manifest file.  You'll need to convert this to a crosh manifest
# file and check it into src/chrome/browser/resources/chromeos/crosh_builtin/
# manifest.json
mv tmp/manifest.json .

# Remove things we don't need for crosh.
rm -rf tmp/html/nassh.html tmp/plugin/

# Fix permissions.
chmod -R a+r tmp/
chmod a+x $(find tmp/ -type d)

# Remake the zip.
(cd tmp; zip -qr ../crosh_builtin.zip .)

# Echo the zip file listing to the terminal for verification.
unzip -l crosh_builtin.zip

echo
echo "HEY!"
echo "You'll need to convert ./manifest.json to crosh and commit it to"
echo "src/chrome/browser/resources/chromeos/crosh_builtin/manifest.json"
