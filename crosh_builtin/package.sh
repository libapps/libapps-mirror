#!/bin/bash
# Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

rm -f crosh_builtin.zip
../hterm/bin/package.sh -t zip -w . -f crosh_builtin
echo "--- Deleting non-crosh files..."
zip crosh_builtin -qd 'manifest.json' 'html/nassh.html' 'js/nassh.js' 'plugin/*'
echo "After delete: $(du -h "crosh_builtin.zip" | cut -f1)"
