#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright 2018 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Common nassh util code."""

from __future__ import print_function

from pathlib import Path
import sys


BIN_DIR = Path(__file__).resolve().parent
DIR = BIN_DIR.parent
LIBAPPS_DIR = DIR.parent


sys.path.insert(0, str(LIBAPPS_DIR / 'libdot' / 'bin'))

# pylint: disable=unused-import
import libdot  # pylint: disable=wrong-import-position


# Wrappers around nassh/bin/ programs for other tools to access directly.
class HelperProgram(libdot.HelperProgram):
    """Avoid copying & pasting BIN_DIR setting."""
    _BIN_DIR = BIN_DIR

generate_changelog = HelperProgram('generate-changelog')
mkdeps = HelperProgram('mkdeps')
