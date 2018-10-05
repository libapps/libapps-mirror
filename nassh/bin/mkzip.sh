#!/bin/sh
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

LIBDOT_DIR="$(dirname -- "$0")/../../libdot"
source "${LIBDOT_DIR}/bin/common.sh"

cd "${BIN_DIR}/.."

"${BIN_DIR}"/mkdeps.sh

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
  #                $1  $2  $3  $4  $5  $6
  set -- $(date +'%_y %_m %_d %_H %_M %_S')

  # The first field is the date.
  # %y: last two digits of the year [0..99]
  # %m: month [1..12]
  # %d: day [1..31]
  # Field = (year + 12 + 31) + (month + 31) + day
  # This is OK because 99 + 12 + 31 = 142 < 255.
  local stamp_date=$(( ($1 + 12 + 31) + ($2 + 31) + $3 ))

  # The second field is the time.
  # %H: hour [0..23]
  # %M: minute [0..59]
  # %S: seconds [0..60] -- includes leap second
  # Field = (hour + 59 + 60) + (minute + 59) + second
  # This is OK because 23 + 59 + 60 = 142 < 255.
  local stamp_time=$(( ($4 + 59 + 60) + ($5 + 59) + $6 ))

  stamp="${stamp_date}.${stamp_time}"
}
set_stamp

for manifest in manifest_*.json; do
  mkzip.sh --append_version "${stamp}" \
    -s "." -w ./dist/zip/ -m "${manifest}" "$@"
done
