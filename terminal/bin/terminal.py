#!/usr/bin/env python3
# Copyright 2019 The ChromiumOS Authors
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Common terminal util code."""

import logging
import sys
from pathlib import Path


BIN_DIR = Path(__file__).resolve().parent
DIR = BIN_DIR.parent
LIBAPPS_DIR = DIR.parent
NASSH_DIR = LIBAPPS_DIR / "nassh"
JS_DIR = DIR / "js"


sys.path.insert(0, str(LIBAPPS_DIR / "libdot" / "bin"))

# pylint: disable=wrong-import-position
import libdot  # pylint: disable=unused-import


def nassh_files(inc_rollup: bool = False) -> list[Path]:
    """Get the list of files we import from nassh."""
    paths = []
    for p in (NASSH_DIR / "js").glob("*.js"):
        if p.name.endswith(".shim.js"):
            # The shim file is an input to rollup.  Add outputs.
            if inc_rollup:
                paths.append(p.parent / f"{p.name[:-8]}.rollup.js")
        elif p.name.endswith(".rollup.js"):
            # Already handled via the .shim.js case.
            pass
        elif "_test" not in p.name:
            paths.append(p)
    return sorted(x.relative_to(NASSH_DIR) for x in paths)


def _symlink_nassh_files() -> None:
    """Symlink nassh files for testing & developing locally."""
    logging.info("Symlinking nassh files")
    for path in nassh_files(inc_rollup=True):
        dest = JS_DIR / path.name
        try:
            dest.symlink_to(NASSH_DIR / path)
        except FileExistsError:
            if dest.exists() and not dest.is_symlink():
                logging.error(
                    "file %s already exists in terminal/js", path.name
                )
                raise

    # Clear stale links.
    for path in JS_DIR.glob("*.js"):
        if not path.exists():
            logging.info("Removing stale symlink: %s", path)
            path.unlink()


def mkdeps(_opt):
    """Build the required deps for the testing/linting."""
    libdot.run([NASSH_DIR / "bin/mkdeps"])
    # Must come after nassh mkdeps.
    _symlink_nassh_files()
