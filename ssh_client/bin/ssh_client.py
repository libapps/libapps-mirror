#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright 2018 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Common ssh_client util code."""

from __future__ import print_function

import argparse
import logging
import multiprocessing
import os
import re
import shutil
import subprocess
import sys


BIN_DIR = os.path.dirname(os.path.realpath(__file__))
DIR = os.path.dirname(BIN_DIR)
LIBAPPS_DIR = os.path.dirname(DIR)


sys.path.insert(0, os.path.join(LIBAPPS_DIR, 'libdot', 'bin'))

import libdot  # pylint: disable=wrong-import-position


# The top output directory.  Everything lives under this.
OUTPUT = os.path.join(DIR, 'output')

# Where archives are cached for fetching & unpacking.
DISTDIR = os.path.join(OUTPUT, 'distfiles')

# All package builds happen under this path.
BUILDDIR = os.path.join(OUTPUT, 'build')

# Directory to put build-time tools.
BUILD_BINDIR = os.path.join(OUTPUT, 'bin')

# Some tools like to scribble in $HOME.
HOME = os.path.join(OUTPUT, 'home')

# Where we save shared libs and headers.
SYSROOT = os.path.join(OUTPUT, 'sysroot')

# Base path to our source mirror.
SRC_URI_MIRROR = ('https://commondatastorage.googleapis.com/'
                  'chromeos-localmirror/secureshell')


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


def copy(source, dest):
    """Always copy |source| to |dest|."""
    logging.info('Copying %s -> %s', source, dest)
    shutil.copy(source, dest)


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


def emake(*args, **kwargs):
    """Run `make` with |args| and automatic -j."""
    jobs = kwargs.pop('jobs', multiprocessing.cpu_count())
    run(['make', '-j%s' % (jobs,)] + list(args), **kwargs)


def fetch(uri=None, name=None):
    """Download |uri| into DISTDIR as |name|."""
    if uri is None:
        uri = os.path.join(SRC_URI_MIRROR, name)
    if name is None:
        name = os.path.basename(uri)

    distfile = os.path.join(DISTDIR, name)
    if os.path.exists(distfile):
        logging.info('Using existing download: %s', name)
        return

    logging.info('Downloading %s to %s', uri, distfile)
    os.makedirs(DISTDIR, exist_ok=True)

    tmpfile = distfile + '.tmp'
    try:
        run(['wget', uri, '-O', tmpfile], cwd=DISTDIR)
    except SystemExit:
        unlink(tmpfile)
        raise
    os.rename(tmpfile, distfile)


def git_fetch(uri, output):
    """Clone |uri| into the |output| dir."""
    logging.info('Syncing %s repo', uri)
    if os.path.exists(output):
        run(['git', 'pull'], cwd=output)
    else:
        run(['git', 'clone', '--depth=1', uri, output])


def stamp_name(workdir, phase, unique):
    """Get a unique name for this particular step.

    This is useful for checking whether certain steps have finished (and thus
    have been given a completion "stamp").

    Args:
      workdir: The package-unique work directory.
      phase: The phase we're in e.g. "unpack" or "prepare".
      unique: A unique name for the step we're checking in this phase.

    Returns:
      The full file path to the stamp file.
    """
    return os.path.join(workdir, '.stamp.%s.%s' % (phase, unique))


def unpack(archive, cwd=None, workdir=None):
    """Unpack |archive| into |cwd|."""
    if cwd is None:
        cwd = os.getcwd()
    distfile = os.path.join(DISTDIR, archive)

    stamp = stamp_name(workdir, 'unpack', os.path.basename(archive))
    if workdir and os.path.exists(stamp):
        logging.info('Archive already unpacked: %s', archive)
    else:
        logging.info('Unpacking %s', archive)
        run(['tar', 'xf', distfile], cwd=workdir or cwd)
        touch(stamp)


def parse_metadata(metadata):
    """Turn the |metadata| file into a dict."""
    ret = {}
    re_field = re.compile(r'^(name|version): "(.*)"')

    with open(metadata, 'r') as f:
        for line in f:
            line = line.strip()

            m = re_field.match(line)
            if m:
                ret[m.group(1)] = m.group(2)

    return ret


def default_src_unpack(metadata):
    """Default src_unpack phase."""
    for archive in metadata['archives']:
        name = archive % metadata
        fetch(name=name)
        unpack(name, workdir=metadata['workdir'])


def default_src_prepare(metadata):
    """Default src_prepare phase."""
    filesdir = metadata['filesdir']
    workdir = metadata['workdir']
    for patch in metadata['patches']:
        patch = patch % metadata
        name = os.path.basename(patch)
        stamp = stamp_name(workdir, 'prepare', name)
        if os.path.exists(stamp):
            logging.info('Patch already applied: %s', name)
        else:
            patch = os.path.join(filesdir, patch)
            logging.info('Applying patch %s', name)
            run(['patch', '-p1'], stdin=open(patch, 'rb'))
            touch(stamp)


def default_src_configure(_metadata):
    """Default src_configure phase."""


def default_src_compile(_metadata):
    """Default src_compile phase."""
    if os.path.exists('Makefile'):
        emake()


def default_src_install(_metadata):
    """Default src_install phase."""


def get_parser(desc):
    """Get a command line parser."""
    parser = argparse.ArgumentParser(description=desc)
    parser.add_argument('-d', '--debug', action='store_true',
                        help='Run with debug output.')
    return parser


def build_package(module):
    """Build the package in the |module|.

    The file system layout is:
    output/                    OUTPUT
      build/                   BUILDDIR
        mandoc-1.14.3/         metadata['basedir']
          work/                metadata['workdir']
            $p/                metadata['S']
          temp/                metadata['T']
    """
    parser = get_parser(module.__doc__)
    opts = parser.parse_args()
    libdot.setup_logging(debug=opts.debug)

    # Create a metadata object from the METADATA file and other settings.
    # This object will be used throughout the build to pass around vars.
    filesdir = getattr(module, 'FILESDIR')
    metadata_file = os.path.join(filesdir, 'METADATA')
    metadata = parse_metadata(metadata_file)
    metadata.update({
        'P': '%(name)s-%(version)s' % metadata,
        'PN': '%(name)s' % metadata,
        'PV': '%(version)s' % metadata,
    })
    metadata.update({
        'p': metadata['P'].lower(),
        'pn': metadata['PN'].lower(),
    })

    # All package-specific build state is under this directory.
    basedir = os.path.join(BUILDDIR, metadata['p'])
    workdir = os.path.join(basedir, 'work')
    # Package-specific source directory with all the source.
    sourcedir = getattr(module, 'S', os.path.join(workdir, metadata['p']))
    # Package-specific temp directory.
    tempdir = os.path.join(basedir, 'temp')

    metadata.update({
        'archives': getattr(module, 'ARCHIVES', ()),
        'patches': getattr(module, 'PATCHES', ()),
        'filesdir': filesdir,
        'workdir': workdir,
        'T': tempdir,
    })
    metadata.update({
        'S': sourcedir % metadata,
    })

    sourcedir = metadata['S']

    for path in (tempdir, workdir, BUILD_BINDIR, HOME):
        os.makedirs(path, exist_ok=True)

    os.environ['HOME'] = HOME

    # Run all the source phases now to build it.
    common_module = sys.modules[__name__]
    def run_phase(phase, cwd):
        """Run this single source phase."""
        logging.info('>>> %s: Running phase %s', metadata['P'], phase)
        func = getattr(module, phase,
                       getattr(common_module, 'default_%s' % phase))
        os.chdir(cwd)
        func(metadata)

    run_phase('src_unpack', workdir)
    run_phase('src_prepare', sourcedir)
    run_phase('src_configure', sourcedir)
    run_phase('src_compile', sourcedir)
    run_phase('src_install', sourcedir)
