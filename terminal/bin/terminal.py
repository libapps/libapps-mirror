#!/usr/bin/env python3
# Copyright 2019 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Common terminal util code."""

import logging
import sys
from pathlib import Path


BIN_DIR = Path(__file__).resolve().parent
DIR = BIN_DIR.parent
LIBAPPS_DIR = DIR.parent
NASSH_DIR = LIBAPPS_DIR / 'nassh'
JS_DIR = DIR / 'js'


sys.path.insert(0, str(LIBAPPS_DIR / 'libdot' / 'bin'))
sys.path.insert(0, str(LIBAPPS_DIR / 'nassh' / 'bin'))

# pylint: disable=unused-import
import libdot  # pylint: disable=wrong-import-position


class SymlinkNasshFiles():
    """A context manager to symlink nassh files.

    All the symlinked files will be deleted when the context manager exits.
    """
    def __init__(self):
        self.filenames = []

    def __enter__(self):
        paths = {
            p for p in (NASSH_DIR / 'js').glob('nas*.js')
            if 'test' not in p.name
        }
        # Manually adding them since they might not exist until mkdeps() is run.
        paths.add(NASSH_DIR / 'js/nassh_deps.concat.js')
        paths.add(NASSH_DIR / 'js/nassh_deps.rollup.js')

        logging.info('symlinking nassh files')
        for path in paths:
            try:
                (JS_DIR / path.name).symlink_to(path)
            except FileExistsError:
                logging.warning('file %s already exists in terminal/js',
                                path.name)
            else:
                self.filenames.append(path.name)

    def __exit__(self, *args):
        logging.info('removing symlinked files')
        for filename in self.filenames:
            (JS_DIR / filename).unlink()


def mkdeps(_opt):
    """Build the required deps for the testing/linting."""
    libdot.run([NASSH_DIR / 'bin/mkdeps'])
