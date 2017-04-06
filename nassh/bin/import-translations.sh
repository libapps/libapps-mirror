#!/bin/bash
# Copyright 2017 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

LIBDOT_DIR="$(dirname -- "$0")/../../libdot"
source "${LIBDOT_DIR}/bin/common.sh"

usage() {
  cat <<EOF
Usage: import-translations.sh <build locales> [nassh locales]

Import generated translations from Google Translation Console back into nassh.
EOF
  exit ${1:-1}
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
fi
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  usage 0
fi

SRC="$(readlink -f "$1")"
if [[ $# -lt 2 ]]; then
  DST="$(readlink -f "${BIN_DIR}/../_locales")"
fi

cd "${SRC}"
LOCALES=(*)
cd "${DST}"
find -type d -exec chmod 755 {} +
find -type f -exec chmod 644 {} +
rm -f */messages.json
rmdir */

for loc in "${LOCALES[@]}"; do
  mkdir "${loc}"
  python -mjson.tool < "${SRC}/${loc}/messages.json" | \
    sed 's:    :\t:g' \
    > "${loc}"/messages.json
done

git checkout -f en/
git add .
git commit -m 'nassh: update translations' .
