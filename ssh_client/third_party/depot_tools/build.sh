#!/bin/bash
# Copyright 2018 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

GIT_URI="https://chromium.googlesource.com/chromium/tools/depot_tools.git"

if [[ ! -d depot_tools ]]; then
  git clone --depth=1 "${GIT_URI}"
fi
