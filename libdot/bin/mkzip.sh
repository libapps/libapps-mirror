#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

FLAGS_HELP="
usage: ./bin/mkzip.sh -w WORK_DIR -s SOURCE

This is a utility script for creating and maintaining extension zip files.

It has primitive abilities to read the manifest.json file and can alter version
numbers, app names, or icon locations.

Assume you're working on a \"Pong\" app, and it has a manifest like this...

  {
    \"key\": \"...\",
    \"name\": \"Pong (tot)\",
    \"version\": \"12.1\"
    \"icons\": {
       \"128\": \"images/dev/128.png\",
       ...
    }
    ...
  }

When it's time to upload a dev version of this app, run mkzip.sh like this...

  libdot$ ./bin/mkzip.sh -w ~/obj/pong -s ~/src/pong/

This will create a zip file in ~/obj/pong/Pong-dev-12.1.zip.  The manifest file
will have the \"key\" removed (necessary to upload to the Chrome Web Store),
and the name changed from \"Pong (tot)\" to \"Pong (dev)\".

After some testing, you decide to publish that same version as stable.  Now
run mkzip.sh like this...

  libdot$ ./bin/mkzip.sh -w ~/obj/pong -s ~/obj/pong/Pong-dev-12.1.zip

This will create a *new* zip file from the old one.  The manifest \"name\" will
become \"Pong\", and the version will be promoted to \"13\".

Version numbers are promoted by removing the final decimal and incrementing the
one before it.  They can be as long as you like.

Promoting from dev to stable will also alter image paths in the manifest.  Any
image path that starts with \"/images/dev/\" will become \"/images/stable/\".
This is a small hack allow distinct dev and stable icons for the app.

The --nopromote option can be used to make a zip from source without promoting
the name or removing the key.  This is great when you want to email a zip file
to another machine or person, so they can expand it and load it as an unpacked
extension.  It looks like this...

  libdot$ ./bin/mkzip.sh -w ~/obj/pong -s ~/src/pong/ --nopromote

This time you'll get ~/obj/pong/Pong-tot-12.1.zip, and its manifest will have
the key and name intact.
"

source "$(dirname "$0")/common.sh"

DEFINE_string filename "" \
  "The new zip filename.  Computed from manifest.json if not specified." f
DEFINE_boolean promote "$FLAGS_TRUE" \
  "If true, this will promote the suffix and version number of the extension \
before packaging."
DEFINE_string source "" \
  "The source directory or zip file to package." s
DEFINE_string tmpdir "" \
  "Temporary directory.  Will default to workdir/tmp if not specified." t
DEFINE_string workdir "" \
  "Work directory.  Zip files will be created here." w

FLAGS "$@" || exit $?
eval set -- "${FLAGS_ARGV}"

# Whitelist of files to be included in the zip file as POSIX egrep expressions.
FILE_PATTERNS='
    \./manifest.json
    \./audio/.*\.ogg
    \./css/.*\.css
    \./html/.*\.html
    \./images/.*\.png
    \./js/.*\.js
    \./_locales/.*\.json
    \./plugin/.*
'

#
# Echo "yes" if a string starts with the given substring, "no" otherwise.
#
#   starts_with <str> <substr>
#
function starts_with() {
  local str="$1"
  local substr="$2"

  if [ "${str:0:${#substr}}" == "$substr" ]; then
    echo "yes"
  else
    echo "no"
  fi
}

function echo_suffix() {
  local name="$1"
  local suffix=$(echo "$name" | sed -e 's/^[^(]\+(//' -e 's/)[^)]*$//')
  if [ "$name" != "$suffix" ]; then
    echo "$suffix"
  else
    echo ""
  fi
}

function promote_name() {
  local current_name="$1"

  local suffix="$(echo_suffix "$current_name")"

  if [ -z "$suffix" ]; then
    echo_err "Current name has no suffix to promote: $current_name";
    return 1
  fi

  if [ "$suffix" == "tot" ]; then
    suffix="dev"
  elif [ "$suffix" == "dev" ]; then
    suffix=""
  fi

  local new_name="$(echo $current_name | sed 's/\s\+([^)\]\+)\s*$//')"

  if [ ! -z "$suffix" ]; then
    new_name="$new_name ($suffix)"
  fi

  echo_err "Name \"$current_name\" promoted to \"$new_name\""

  echo "$new_name"
}

function promote_version() {
  local current_version="$1"

  # First remove the final decimal place.
  local new_version="$(echo $current_version | sed 's/\.[0-9]\+$//')"

  # Then find the (new) final decimal place.
  local final="$(echo $new_version | sed 's/^\([0-9]\.\)*//')"

  # Strip this final number, add one, then put it back.
  new_version="$(echo $new_version | sed 's/\.[0-9]\+$//')"
  final=$(( $final + 1 ))
  new_version="$new_version.$final"

  echo_err "Version \"$current_version\" promoted to \"$new_version\""

  echo "$new_version"
}

function rewrite_manifest() {
  local manifest="$1"
  local new_name="$2"
  local new_version="$3"

  echo_err "Rewrite $(get_relative_path $manifest)"
  echo_err "New name: $new_name"
  echo_err "New version: $new_version"

  # Used in the regexp's below.
  local s="[[:space:]]"

  local suffix="$(echo_suffix "$new_name")"

  # Maybe change some image paths.
  local image_path_rule=""
  if [ -z "$suffix" ]; then
    image_path_rule="\
      /$s*\"([^\"]+)\"$s*:$s*\"images\/dev\/([^\"]+)\"$s*,?$s*$/ \
        { sub(/\"images\/dev\//, \"\\\"images/stable/\") }"
  fi

  # Maybe strip out the "key": "..." line.
  local strip_key_rule=""
  if [ "$suffix" != "tot" ]; then
    strip_key_rule="/$s*\"key\"$s*:$s*\"[^\"]+\"$s*,?$s*$/ { next }"
  fi

  insist cat "$manifest" |                                          \
    awk "                                                           \
      $strip_key_rule                                               \
      $image_path_rule                                              \
                                                                    \
      /$s*\"version\"$s*:$s*\"[^\"]+\"$s*,$s*$/                     \
        { sub(/\"[^\"]+\"$s*,$s*$/, \"\\\"$new_version\\\",\") }    \
                                                                    \
      /$s*\"name\"$s*:$s*\"[^\"]+\"$s*,$s*$/                        \
        { sub(/\"[^\"]+\"$s*,$s*$/, \"\\\"$new_name\\\",\") }       \
                                                                    \
                                                                    \
      {print}" > "$manifest.edited"

  # Sanity check that the whole awk mess worked.
  local edited_version=$(get_manifest_key_value "version" "$manifest.edited")

  if [ "$edited_version" != "$new_version" ]; then
    echo_err "Failed to edit manifest version."
    exit 2
  fi

  local edited_name=$(get_manifest_key_value "name" "$manifest.edited")

  if [ "$edited_name" != "$new_name" ]; then
    echo_err "Failed to edit manifest name."
    exit 2
  fi

  # Install the edited manifest.
  insist mv "$manifest.edited" "$manifest"
}

# Convert the name and version into an appropriate filename.
function echo_filename() {
  local filename=${1//[ \)]/};
  filename=${filename//\(/-}
  echo "$filename-$2.zip"
}

function make_zipdir() {
  local zipdir="$FLAGS_tmpdir/$(basename $FLAGS_filename).d"

  echo_err "Zip directory: $(get_relative_path "$zipdir")"

  insist rm -rf "$zipdir"
  insist mkdir -p "$zipdir"

  echo "$zipdir"
}

function init_from_dir() {
  local source="$1"

  local name=$(get_manifest_key_value "name" "$source/manifest.json")
  local version=$(get_manifest_key_value "version" "$source/manifest.json")

  local new_name
  local new_version

  if [ "$FLAGS_promote" == "$FLAGS_TRUE" ]; then
    new_name="$(promote_name "$name")"
    local suffix="$(echo_suffix "$new_name")"
    if [ -z "$suffix" ]; then
      new_version="$(promote_version "$version")"
    else
      new_version="$version"
    fi
  else
    new_name="$name"
    new_version="$version"
  fi

  if [ -z "$FLAGS_filename" ]; then
    FLAGS_filename="$(echo_filename "$new_name" "$new_version")"
  fi

  local zipdir  # "local" overwrites the current exit code
  zipdir="$(make_zipdir)"
  insist

  echo_err "Copying from source: $(get_relative_path "$source")"
  cd "$FLAGS_source"

  set -f  # Disable filename expansion.

  local files=""
  for pat in ${FILE_PATTERNS}; do
    files="$files $(find . -regextype posix-egrep -iregex "$pat")"
  done

  set +f  # Re-enable expansion.

  rsync -qa --relative $files "$zipdir"

  cd - >/dev/null

  if [ "$FLAGS_promote" == "$FLAGS_TRUE" ]; then
    insist rewrite_manifest "$zipdir/manifest.json" "$new_name" "$new_version"
  fi
}

function init_from_zip() {
  local source="$1"

  local tmp_manifest="$FLAGS_tmpdir/$(basename $source)-manifest.json"
  unzip -qp $source manifest.json > "$tmp_manifest"
  insist

  local name="$(get_manifest_key_value "name" "$tmp_manifest")"
  local version="$(get_manifest_key_value "version" "$tmp_manifest")"

  insist rm -f "$tmp_manifest"

  local new_name="$(promote_name "$name")"

  local suffix="$(echo_suffix "$new_name")"
  if [ -z "$suffix" ]; then
    new_version="$(promote_version "$version")"
  else
    new_version="$version"
  fi

  if [ -z "$FLAGS_filename" ]; then
    FLAGS_filename="$(echo_filename "$new_name" "$new_version")"
  fi

  local zipdir  # "local" overwrites the current exit code
  zipdir="$(make_zipdir)"
  insist

  echo_err "Unzipping from: $(get_relative_path "$FLAGS_source")"
  cd "$zipdir"
  insist unzip -q "$FLAGS_source"
  cd - >/dev/null

  insist rewrite_manifest "$zipdir/manifest.json" "$new_name" "$new_version"
}

function main() {
  if [ -z "$FLAGS_source" ]; then
    echo_err "Missing argument: --source"
    exit 1
  fi

  if [ -z "$FLAGS_workdir" ]; then
    echo_err "Missing argument: --workdir"
    exit 1
  fi

  # Absolutify the paths.
  FLAGS_source="$(readlink -f $FLAGS_source)"
  FLAGS_workdir="$(readlink -f $FLAGS_workdir)"

  if [ -z "$FLAGS_tmpdir" ]; then
    FLAGS_tmpdir="$FLAGS_workdir/tmp/"
  fi

  mkdir -p "$FLAGS_tmpdir"

  if [ -d "$FLAGS_source" ]; then
    insist init_from_dir "$FLAGS_source"
  else
    FLAGS_promote="$FLAGS_TRUE"
    insist init_from_zip "$FLAGS_source"
  fi

  local zipfile="$FLAGS_workdir/$FLAGS_filename"
  if [ -e "$zipfile" ]; then
    echo_err "Zip exists: $(get_relative_path "$zipfile")"
    exit 2
  fi

  local srcdir="$FLAGS_tmpdir/$FLAGS_filename.d"
  chmod -R a+r "$srcdir"/*
  echo_err "Creating: $(get_relative_path "$zipfile")"
  (cd "$srcdir"; zip -rq "$zipfile" * 1>&2)
  insist

  local filecount=$(( $(unzip -l "$zipfile" | wc -l) - 4 ))
  echo_err "Done: $filecount files, $(du -h "$zipfile" | cut -f1)"
}

main "$@"
