#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

LIBDOT_DIR="$(dirname -- "$0")/../../libdot"
. "${LIBDOT_DIR}/bin/common.sh"

cd "${BIN_DIR}/.."

"${BIN_DIR}"/mkdeps

mkdir -p ./dist/zip

export MORE_FILE_PATTERNS_EXCLUDE='
  .*_tests?\.\(js\|html\)$
  .*/images/\(promo\|screenshot\)-.*\.\(jpg\|png\)$
'

# The CWS limits each dotted field to 16bits (65535), and allows only 4 fields.
# That means we have to pack the year/month/day and hour/minutes/seconds.
#   https://developer.chrome.com/extensions/manifest/version
# If we're creative, we can pack these so the version is always increasing.
#
# We're really just worried about two consecutive builds not decreasing.
# Keep in mind that we hand maintain the first two components of the version in
# the manifest.json.
set_stamp() {
  # The _ prefix is to use spaces instead of leading zeros.
  #                $1  $2  $3  $4  $5
  set -- $(date +'%_y %_j %_H %_M %_S')

  # The first field is the date.
  # %y: last two digits of the year [0..99]
  # %j: day of the year [1..366] -- we subtract 1 to get [0..365]
  #
  # Field = (year * 366) + day_of_year
  # This is OK because (99 * 366) + 366 = 36600 < 65535.
  local stamp_date=$(( ($1 * 366) + ($2 - 1) ))

  # The second field is the time.
  # %H: hour [0..23]
  # %M: minute [0..59]
  # %S: seconds [0..60] -- includes leap second
  #
  # But 23 * 60 * 60 = 82800 which exceeds 65535.
  # If we divide seconds by 2, then everything fits.
  #
  # Field = (hour * 60 * 30) + (minute * 30) + (second / 2)
  # This is OK because (23 * 60 * 30) + (59 * 30) + 30 = 43200 < 65535.
  local stamp_time=$(( ($3 * 60 * 30) + ($4 * 30) + ($5 / 2) ))

  stamp="${stamp_date}.${stamp_time}"
}
set_stamp

for manifest in manifest_*.json; do
  mkzip.sh --append_version "${stamp}" \
    -s "." -w ./dist/zip/ -m "${manifest}" "$@"
done
