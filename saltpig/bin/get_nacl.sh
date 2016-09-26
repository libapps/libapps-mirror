#!/bin/bash
# Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

LIBDOT_DIR="$(dirname -- "$0")/../../libdot"
source "${LIBDOT_DIR}/bin/common.sh"

cd "${BIN_DIR}/.."

VPATH="pepper_36/1260"
BASE="http://gsdview.appspot.com/nativeclient-mirror/naclports/$VPATH/publish/"

PATHS="\
  curl/pnacl/curl.nmf \
  curl/pnacl/curl_ppapi_pnacl.pexe \
  nano/pnacl/nano/nano.nmf \
  nano/pnacl/nano/nano_pnacl.pexe \
  nano/pnacl/nano/nano.tar \
  nethack/pnacl/nethack/nethack.nmf \
  nethack/pnacl/nethack/nethack_pnacl.pexe \
  nethack/pnacl/nethack/nethack.tar \
  python/pnacl/python.nmf \
  python/pnacl/python.pexe \
  python/pnacl/pydata_pnacl.tar \
  unzip/pnacl/unzip.nmf \
  unzip/pnacl/unzip_pnacl.pexe \
  vim/pnacl/vim/vim.nmf \
  vim/pnacl/vim/vim_pnacl.pexe \
  vim/pnacl/vim/vim.tar \
"

for path in $PATHS; do
  rm -f "$(basename $path)"
  wget -nv "$BASE$path" || exit
done
