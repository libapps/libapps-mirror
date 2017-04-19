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
: "${LIBDOT_SEARCH_PATH:=${LIBAPPS_DIR}}"
PATH="${LIBDOT_BIN_DIR}:${PATH}"

# Find a file in the LIBDOT_SEARCH_PATH.
function search_file() {
  local filename="$1"

  local IFS=":"

  for dir in $LIBDOT_SEARCH_PATH; do
    local dir=$(eval "echo $dir")
    if [ -e "$dir/$filename" ]; then
      echo "$dir/$filename"
      return
    fi
  done

  echo_err "$filename not found in $LIBDOT_SEARCH_PATH"
}

# See <https://github.com/kward/shflags>.
source "$(search_file "libdot/bin/shflags")"

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

# Compute a relative path for a given absolute path.
#
#   get_relative_path <source_dir> [<pwd>]
#
# If <pwd> is not provided, the return value will be relative to the present
# working directory.
#
function get_relative_path() {
  local source_dir="$(readlink -fm "$1")"
  local pwd="$(readlink -fm "$2")"

  if [ -z "$pwd" ]; then
    pwd="$(readlink -f "$(pwd)")/"
  fi

  # First, find the common prefix
  local common_dirs="$source_dir"

  # Keep removing directories from the end of the candidate until it is a
  # prefix of the pwd.
  while [[ "$common_dirs" != "/" && \
    "$(starts_with "$pwd" "$common_dirs")" == "no" ]]; do
    common_dirs="$(readlink -fm $common_dirs/..)"
  done

  if [ "$common_dirs" == "/" ]; then
    # If the only shared directory is "/", then just return the source
    # directory.
    echo "$source_dir"
    return
  fi

  # Return value starts with everything after the common directories.
  local rv="${source_dir:$((${#common_dirs} + 1))}"

  # Then prepend a "../" for every directory that we have to backtrack from
  # pwd to get to the common directory.
  local uncommon_dirs="${pwd:${#common_dirs}}"
  uncommon_dirs="${uncommon_dirs##/}"
  uncommon_dirs="${uncommon_dirs%%/}"

  if [ ! -z "$uncommon_dirs" ]; then
    while [[ "$uncommon_dirs" != "." && "$uncommon_dirs" != "/" ]]; do
      rv="../$rv"
      uncommon_dirs="$(dirname $uncommon_dirs)"
    done
  fi

  if [ -z "$rv" ]; then
    rv="$(pwd)"
  fi

  local home="$(readlink -fm "$HOME")"
  if [ "$pwd" !=  "$home" ]; then
    # Check to see if it's shorter to express the path relative to $HOME
    local fromhome="~/$(get_relative_path "$source_dir" "$home")"
    if [ ${#fromhome} -le ${#rv} ]; then
      echo "$fromhome"
      return
    fi
  fi

  echo "$rv"
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

function echo_changelog() {
  local key="$1"
  local file="${2:-../doc/ChangeLog.md}"

  if [ -z "$key" ]; then
    head -n1 "$file"
  elif [ "$key" = "version" ]; then
    head -n1 "$file" | cut -f1 -d',' | sed -e 's/[ #]//g'
  elif [ "$key" = "date" ]; then
    head -n1 "$file" | cut -f2 -d',' | sed -e 's/ //g'
  else
    echo_err "Unknown key: $key"
    return 1
  fi
}
