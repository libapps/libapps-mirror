#!/bin/bash
# Copyright 2017 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

LIBDOT_DIR="$(dirname -- "$0")/../../libdot"
source "${LIBDOT_DIR}/bin/common.sh"

usage() {
  cat <<EOF
Usage: promote.sh <zip>

Promote an existing dev zip file to stable.
EOF
  exit ${1:-1}
}

if [[ $# -ne 1 ]]; then
  usage
fi
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  usage 0
fi

zip="$(realpath "$1")"
if [[ ! -e "${zip}" ]]; then
  echo_err "ZIP file does not exist: ${zip}"
  exit 1
fi

cd "${BIN_DIR}/.."

mkdir -p ./dist/zip/
mkzip.sh -s "${zip}" -w ./dist/zip/
