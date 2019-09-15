#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright 2018 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Common libdot util code."""

from __future__ import print_function

import importlib.machinery
import logging
import logging.handlers
import os
import shutil
import subprocess
import sys
import time
import types
import urllib.request


# Require recent Python 3 versions as a sanity check.
assert (sys.version_info.major, sys.version_info.minor) >= (3, 5), (
    'Python 3.5 or newer is required')

BIN_DIR = os.path.dirname(os.path.realpath(__file__))
DIR = os.path.dirname(BIN_DIR)
LIBAPPS_DIR = os.path.dirname(DIR)


def setup_logging(debug=False):
    """Setup the logging module."""
    fmt = u'%(asctime)s: %(levelname)-7s: '
    if debug:
        fmt += u'%(filename)s:%(funcName)s: '
    fmt += u'%(message)s'

    # 'Sat, 05 Oct 2013 18:58:50 -0400 (EST)'
    tzname = time.strftime('%Z', time.localtime())
    datefmt = u'%a, %d %b %Y %H:%M:%S ' + tzname

    level = logging.DEBUG if debug else logging.INFO

    formatter = logging.Formatter(fmt, datefmt)
    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(formatter)

    logger = logging.getLogger()
    logger.addHandler(handler)
    logger.setLevel(level)


def touch(path):
    """Touch (and truncate) |path|."""
    open(path, 'w').close()


def unlink(path):
    """Remove |path| and ignore errors if it doesn't exist."""
    try:
        os.unlink(path)
    except FileNotFoundError:
        pass


def symlink(target, path):
    """Always symlink |path| to a relativized |target|."""
    unlink(path)
    path = os.path.realpath(path)
    target = os.path.relpath(os.path.realpath(target), os.path.dirname(path))
    logging.info('Symlinking %s -> %s', path, target)
    os.symlink(target, path)


def cmdstr(cmd):
    """Return a string for the |cmd| list w/reasonable quoting."""
    quoted = []
    for arg in cmd:
        if ' ' in arg:
            arg = '"%s"' % (arg,)
        quoted.append(arg)
    return ' '.join(quoted)


def run(cmd, check=True, cwd=None, **kwargs):
    """Run |cmd| inside of |cwd| and exit if it fails."""
    # Python 3.6 doesn't support capture_output.
    if sys.version_info < (3, 7):
        capture_output = kwargs.pop('capture_output', None)
        if capture_output:
            assert 'stdout' not in kwargs and 'stderr' not in kwargs
            kwargs['stdout'] = subprocess.PIPE
            kwargs['stderr'] = subprocess.PIPE

    if cwd is None:
        cwd = os.getcwd()
    logging.info('Running: %s\n  (cwd = %s)', cmdstr(cmd), cwd)
    result = subprocess.run(cmd, cwd=cwd, **kwargs)
    if check and result.returncode:
        logging.error('Running %s failed!', cmd[0])
        sys.exit(result.returncode)
    return result


def unpack(archive, cwd=None, files=()):
    """Unpack |archive| into |cwd|."""
    if cwd is None:
        cwd = os.getcwd()
    if files:
        files = ['--'] + list(files)
    else:
        files = []

    logging.info('Unpacking %s', os.path.basename(archive))
    run(['tar', '-xf', archive] + files, cwd=cwd)


def fetch(uri, output):
    """Download |uri| and save it to |output|."""
    output = os.path.abspath(output)
    distdir, name = os.path.split(output)
    if os.path.exists(output):
        logging.info('Using existing download: %s', name)
        return

    logging.info('Downloading %s to %s', uri, output)
    os.makedirs(distdir, exist_ok=True)

    # Use kokoro build cache or Gentoo distdir if available.
    for envvar in ('KOKORO_GFILE_DIR', 'DISTDIR'):
        cache_dir = os.getenv(envvar)
        if cache_dir:
            cache_file = os.path.join(cache_dir, name)
            if os.path.exists(cache_file):
                symlink(cache_file, output)
                return

    # Don't be verbose if running on CI systems.
    verbose = os.isatty(sys.stdout.fileno())

    # We use urllib rather than wget or curl to avoid external utils & libs.
    # This seems to be good enough for our needs.
    tmpfile = output + '.tmp'
    with open(tmpfile, 'wb') as outfp:
        with urllib.request.urlopen(uri) as infp:
            mb = 0
            length = infp.length
            while True:
                data = infp.read(1024 * 1024)
                if not data:
                    break
                # Show a simple progress bar if the user is interactive.
                if verbose:
                    mb += 1
                    print('~%i MiB downloaded' % (mb,), end='')
                    if length:
                        print(' (%.2f%%)' % (mb * 1024 * 1024 * 100 / length,),
                              end='')
                    print('\r', end='', flush=True)
                outfp.write(data)
    # Clear the progress bar.
    if verbose:
        print(' ' * 80, end='\r')

    os.rename(tmpfile, output)


def node_and_npm_setup():
    """Download our copies of node & npm to our tree and updates env ($PATH)."""
    # We have to update modules first as it'll nuke the dir node lives under.
    node.modules_update()
    node.update()

    # Make sure our tools show up first in $PATH to override the system.
    path = os.getenv('PATH')
    os.environ['PATH'] = '%s:%s' % (node.NODE_BIN_DIR, path)


# A snapshot of Chrome that we update from time to time.
# $ uribase='https://dl.google.com/linux/chrome/deb'
# $ filename=$(
#     curl -s "${uribase}/dists/stable/main/binary-amd64/Packages.gz" | \
#         zcat | \
#         awk '$1 == "Filename:" && $2 ~ /google-chrome-stable/ {print $NF}')
# $ wget "${uribase}/${filename}"
# $ gsutil cp -a public-read google-chrome-stable_*.deb \
#       gs://chromeos-localmirror/secureshell/distfiles/
CHROME_VERSION = 'google-chrome-stable_75.0.3770.142-1'


def chrome_setup():
    """Download our copy of Chrome for headless testing."""
    puppeteer = os.path.join(node.NODE_MODULES_DIR, 'puppeteer')
    download_dir = os.path.join(puppeteer, '.local-chromium')
    chrome_dir = os.path.join(download_dir, CHROME_VERSION)
    chrome_bin = os.path.join(chrome_dir, 'opt', 'google', 'chrome', 'chrome')
    if os.path.exists(chrome_bin):
        return chrome_bin

    # Create a tempdir to unpack everything into.
    tmpdir = chrome_dir + '.tmp'
    shutil.rmtree(tmpdir, ignore_errors=True)
    os.makedirs(tmpdir, exist_ok=True)

    # Get the snapshot deb archive.
    chrome_deb = os.path.join(tmpdir, 'deb')
    uri = '%s/%s_amd64.deb' % (node.NODE_MODULES_BASE_URI, CHROME_VERSION)
    fetch(uri, chrome_deb)

    # Unpack the deb archive, then clean it all up.
    run(['ar', 'x', 'deb', 'data.tar.xz'], cwd=tmpdir)
    unpack('data.tar.xz', cwd=tmpdir)
    unlink(chrome_deb)
    unlink(os.path.join(tmpdir, 'data.tar.xz'))

    # Finally move the tempdir to the saved location.
    os.rename(tmpdir, chrome_dir)

    return chrome_bin


def load_module(name, path):
    """Load a module from the filesystem.

    Args:
      name: The name of the new module to import.
      path: The full path to the file to import.
    """
    loader = importlib.machinery.SourceFileLoader(name, path)
    module = types.ModuleType(loader.name)
    loader.exec_module(module)
    return module


class HelperProgram:
    """Wrapper around local programs that get reused by other projects.

    This allows people to do inprocess execution rather than having to fork+exec
    another Python instance.

    This allows us to avoid filesystem symlinks (which aren't portable), and to
    avoid naming programs with .py extensions, and to avoid clashes between
    projects that use the same program name (e.g. "import lint" would confuse
    libdot/bin/lint & nassh/bin/lint), and to avoid merging all libdot helpers
    into the single libdot.py module.
    """

    def __init__(self, name, path=None):
        """Initialize.

        Args:
          name: The base name of the program to import.
          path: The full path to the file.  It defaults to libdot/bin/|name|.
        """
        self._name = name
        if path is None:
            path = os.path.join(BIN_DIR, name)
        self._path = path
        self._module_cache = None

    @property
    def _module(self):
        """Load & cache the program module."""
        if self._module_cache is None:
            self._module_cache = load_module(self._name, self._path)
        return self._module_cache

    def __getattr__(self, name):
        """Dynamic forwarder to module members."""
        return getattr(self._module, name)


# Wrappers around libdot/bin/ programs for other tools to access directly.
concat = HelperProgram('concat')
lint = HelperProgram('lint')
load_tests = HelperProgram('load_tests')
node = HelperProgram('node')
