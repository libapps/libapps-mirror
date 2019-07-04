#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright 2018 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Common libdot util code."""

from __future__ import print_function

import argparse
import glob
import logging
import logging.handlers
import os
import shutil
import subprocess
import sys
import time
import urllib.request


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


def html_test_runner_parser():
    """Get a parser for our test runner."""
    parser = argparse.ArgumentParser(
        description='HTML test runner',
        formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('-d', '--debug', action='store_true',
                        help='Run with debug output.')
    parser.add_argument('--browser', default=os.getenv('CHROME_BIN'),
                        help='Browser program to run tests against.')
    parser.add_argument('--profile', default=os.getenv('CHROME_TEST_PROFILE'),
                        help='Browser profile dir to run against.')
    return parser


def html_test_runner_main(argv, path):
    """Open the test page at |path|."""
    parser = html_test_runner_parser()
    opts = parser.parse_args(argv)
    setup_logging(debug=opts.debug)

    # Try to use default X session.
    os.environ.setdefault('DISPLAY', ':0')

    # Ensure chai/mocha node modules exist.
    node_and_npm_setup();

    # Set up a unique profile to avoid colliding with user settings.
    profile_dir = opts.profile
    if not profile_dir:
        profile_dir = os.path.expanduser('~/.config/google-chrome-run_local')
    os.makedirs(profile_dir, exist_ok=True)

    # Chrome goes by many names.  We know them all!
    browser = opts.browser
    if not browser:
        for suffix in ('', '-stable', '-beta', '-unstable', '-trunk'):
            browser = 'google-chrome%s' % (suffix,)
            try:
                subprocess.check_call([browser, '--version'])
                break
            except (FileNotFoundError, subprocess.CalledProcessError):
                pass
        else:
            parser.error('Could not find a browser; please use --browser.')

    # Kick off test runner in the background so we exit.
    logging.info('Running tests against browser "%s".', browser)
    logging.info('Tests page: %s', path)
    subprocess.Popen([browser, '--user-data-dir=%s' % (profile_dir,), path])


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
    if cwd is None:
        cwd = os.getcwd()
    logging.info('Running: %s\n  (cwd = %s)', cmdstr(cmd), cwd)
    result = subprocess.run(cmd, cwd=cwd, **kwargs)
    if check and result.returncode:
        logging.error('Running %s failed!', cmd[0])
        sys.exit(result.returncode)


def unpack(archive, cwd=None):
    """Unpack |archive| into |cwd|."""
    if cwd is None:
        cwd = os.getcwd()
    logging.info('Unpacking %s', os.path.basename(archive))
    run(['tar', '-xf', archive], cwd=cwd)


def fetch(uri, output):
    """Download |uri| and save it to |output|."""
    output = os.path.abspath(output)
    distdir, name = os.path.split(output)
    if os.path.exists(output):
        logging.info('Using existing download: %s', name)
        return

    # Use kokoro build cache or Gentoo distdir if available.
    for envvar in ('KOKORO_GFILE_DIR', 'DISTDIR'):
        cache_dir = os.getenv(envvar)
        if cache_dir:
            cache_file = os.path.join(cache_dir, name)
            if os.path.exists(cache_file):
                symlink(cache_file, output)
                return

    logging.info('Downloading %s to %s', uri, output)
    os.makedirs(distdir, exist_ok=True)

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


# The hash of the node_modules that we maintain.
# Allow a long line for easy automated updating.
# pylint: disable=line-too-long
NODE_MODULES_HASH = '056b9a0eb499c5e1269d801e1a9373532f05b6e95af0591c772c2d2f0f92024b'
# pylint: enable=line-too-long

# In sync with Chromium's DEPS file because it's easier to use something that
# already exists than maintain our own.  Look for 'node_linux64' here:
# https://chromium.googlesource.com/chromium/src/+/master/DEPS
NODE_VER = '10.15.3'

# Run `./node_sync_with_chromium` to update these hashes.
NODE_LINUX_HASH = '3f578b6dec3fdddde88a9e889d9dd5d660c26db9'
NODE_MAC_HASH = '37d5bb727fa6f3f29a8981962903d0a2371a3f2d'

# Bucket maintained by Chromium.
# gsutil ls gs://chromium-nodejs/
NODE_BASE_URI = 'https://storage.googleapis.com/chromium-nodejs'

# Bucket maintained by us.
NODE_MODULES_GS_FRAGMENT = 'chromeos-localmirror/secureshell/distfiles'
NODE_MODULES_GS_URI = 'gs://%s' % (NODE_MODULES_GS_FRAGMENT,)
NODE_MODULES_BASE_URI = ('https://storage.googleapis.com/%s'
                         % (NODE_MODULES_GS_FRAGMENT,))

# The node_modules & node/npm paths.
NODE_MODULES_DIR = os.path.join(LIBAPPS_DIR, 'node_modules')
NODE_BIN_DIR = os.path.join(NODE_MODULES_DIR, '.bin')
NODE = os.path.join(NODE_BIN_DIR, 'node')
NPM = os.path.join(NODE_BIN_DIR, 'npm')
# Use a dotdir as npm expects to manage everything under node_modules/.
NODE_DIR = os.path.join(NODE_MODULES_DIR, '.node')


def node_update():
    """Download & update our copy of node."""
    osname = os.uname().sysname
    if osname == 'Linux':
        node_hash = NODE_LINUX_HASH
    elif osname == 'Darwin':
        node_hash = NODE_MAC_HASH
    # We don't support Windows yet.
    #elif osname == 'Windows':
    #    node_hash = NODE_WIN_HASH
    else:
        raise RuntimeError('Unknown OS %s' % (osname,))

    # In case of an upgrade, nuke existing dir.
    hash_file = os.path.join(NODE_DIR, node_hash)
    if not os.path.exists(hash_file):
        shutil.rmtree(NODE_DIR, ignore_errors=True)

    if not os.path.exists(NODE):
        os.makedirs(NODE_BIN_DIR, exist_ok=True)
        os.makedirs(NODE_DIR, exist_ok=True)

        # Download & unpack the archive.
        uri = os.path.join(NODE_BASE_URI, NODE_VER, node_hash)
        output = os.path.join(NODE_DIR, node_hash)
        fetch(uri, output)
        unpack(output, cwd=NODE_DIR)
        unlink(output)

        # Create canonical symlinks for node & npm.
        paths = glob.glob(os.path.join(NODE_DIR, '*', 'bin', 'node'))
        #relpath = os.path.relpath(paths[0], NODE_BIN_DIR)
        #os.symlink(relpath, NODE)
        symlink(paths[0], NODE)
        paths = glob.glob(os.path.join(NODE_DIR, '*', '*', 'node_modules',
                                       'npm', 'bin', 'npm-cli.js'))
        #relpath = os.path.relpath(paths[0], NODE_BIN_DIR)
        #os.symlink(relpath, NPM)
        symlink(paths[0], NPM)

        # Mark the hash of this checkout.
        touch(hash_file)


def node_modules_update():
    """Download & update our copy of node_modules."""
    hash_file = os.path.join(NODE_MODULES_DIR, '.hash')
    old_hash = None
    try:
        with open(hash_file, 'r', encoding='utf-8') as fp:
            old_hash = fp.read().strip()
    except FileNotFoundError:
        pass

    # In case of an upgrade, nuke existing dir.
    if old_hash != NODE_MODULES_HASH:
        shutil.rmtree(NODE_MODULES_DIR, ignore_errors=True)

    if not os.path.exists(hash_file):
        # Download & unpack the archive.
        tar = 'node_modules-%s.tar.xz' % (NODE_MODULES_HASH,)
        uri = os.path.join(NODE_MODULES_BASE_URI, tar)
        output = os.path.join(LIBAPPS_DIR, tar)
        fetch(uri, output)
        unpack(output, cwd=LIBAPPS_DIR)
        unlink(output)

        # Mark the hash of this checkout.
        with open(hash_file, 'w', encoding='utf-8') as fp:
            fp.write(NODE_MODULES_HASH)


def node_and_npm_setup():
    """Download our copies of node & npm to our tree and updates env ($PATH)."""
    # We have to update modules first as it'll nuke the dir node lives under.
    node_modules_update()
    node_update()

    # Make sure our tools show up first in $PATH to override the system.
    path = os.getenv('PATH')
    os.environ['PATH'] = '%s:%s' % (NODE_BIN_DIR, path)
