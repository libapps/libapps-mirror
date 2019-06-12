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
#   get_manifest_key_value <key> <manifest_file>
function get_manifest_key_value() {
  local key="$1"
  local file="$2"
  python \
    -c 'import json, sys; d = json.load(open(sys.argv[1])); print(d[sys.argv[2]]);' \
    "${file}" "${key}"
}

# Delete a key from a manifest.json file.
#
#   delete_manifest_key <key> <manifest_file>
delete_manifest_key() {
  local key="$1"
  local file="$2"
  python \
    -c 'import json, sys; d = json.load(open(sys.argv[1])); d.pop(sys.argv[2], None); json.dump(d, open(sys.argv[1], "w"), indent=2);' \
    "${file}" "${key}"
}

# Set a key to a value in a manifest.json file.
#
#   set_manifest_key_value <key> <value> <manifest_file>
set_manifest_key_value() {
  local key="$1"
  local value="$2"
  local file="$3"
  python \
    -c 'import json, sys; d = json.load(open(sys.argv[1])); d[sys.argv[2]] = sys.argv[3]; json.dump(d, open(sys.argv[1], "w"), indent=2);' \
    "${file}" "${key}" "${value}"
}
