# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

#
# Echo all arguments to stderr.
#
function echo_err() {
  echo "-*- $*" 1>&2
}

if [[ -z "${LIBDOT_DIR}" ]]; then
  echo_err "LIBDOT_DIR: required variable not set"
  exit 1
fi

READLINK="${LIBDOT_DIR}/bin/readlink"
READLINK="$("${READLINK}" -f -- "${READLINK}")"
LIBDOT_DIR="$("${READLINK}" -f -- "${LIBDOT_DIR}")"
LIBDOT_BIN_DIR="${LIBDOT_DIR}/bin"
LIBAPPS_DIR="$("${READLINK}" -f -- "${LIBDOT_DIR}/..")"
BIN_DIR="$(dirname "$("${READLINK}" -f -- "$0")")"
PATH="${LIBDOT_BIN_DIR}:${PATH}"

# Run a command, exiting if it returns a non-zero exit code.
#
# If you intend to capture the output of a command this should be used
# immediately AFTER running running the command.
function insist() {
  local err=$?

  if [ ! -z "$1" ]; then
    "$@"
    err=$?
  fi

  if [ $err != 0 ]; then
    if [ -z "$1" ]; then
      echo_err "Command returned exit code: $err"
    else
      echo_err "Command $* returned exit code: $err"
    fi

    exit $err
  fi
}

# Read a value from a manifest.json file.
#
#   get_key_value <key> <manifest_file>
#
# This only works on manifest files that have one key per line.
#
function get_manifest_key_value() {
  local key="$1"
  local file="$2"
  local line="$(grep "\"$key\":" "$file")"
  echo "$(expr "$line" : '.*\":[[:space:]]*\"\([^\"]*\)')"
}

# TODO: Remove this $PN hack once we have a better solution for crosh.
if [[ "${PN}" != "crosh"* ]]; then
  source "${LIBDOT_BIN_DIR}/node.sh"
fi
