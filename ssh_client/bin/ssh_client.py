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


# Number of jobs for parallel operations.
JOBS = multiprocessing.cpu_count()


# Help simplify the API for users of ssh_client.py.
run = libdot.run
symlink = libdot.symlink
touch = libdot.touch
unlink = libdot.unlink


def copy(source, dest):
    """Always copy |source| to |dest|."""
    logging.info('Copying %s -> %s', source, dest)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.copy(source, dest)


def emake(*args, **kwargs):
    """Run `make` with |args| and automatic -j."""
    jobs = kwargs.pop('jobs', JOBS)
    run(['make', '-j%s' % (jobs,)] + list(args), **kwargs)


def fetch(uri=None, name=None):
    """Download |uri| into DISTDIR as |name|."""
    if uri is None:
        uri = '/'.join((SRC_URI_MIRROR, name))
    if name is None:
        name = os.path.basename(uri)

    libdot.fetch(uri, os.path.join(DISTDIR, name))


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
    distfile = os.path.join(DISTDIR, archive)

    stamp = stamp_name(workdir, 'unpack', os.path.basename(archive))
    if workdir and os.path.exists(stamp):
        logging.info('Archive already unpacked: %s', archive)
    else:
        libdot.unpack(distfile, cwd=workdir or cwd)
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


class ToolchainInfo:
    """Information about the active toolchain environment."""

    def __init__(self, env):
        """Initialize."""
        self._env = env
        if not env:
            return
        self._cbuild = None
        self.chost = self._env['CHOST']
        self.sysroot = self._env['SYSROOT']
        self.libdir = os.path.join(self.sysroot, 'lib')
        self.incdir = os.path.join(self.sysroot, 'include')
        self.pkgconfdir = os.path.join(self.libdir, 'pkgconfig')
        self.ar = self._env['AR']

    @classmethod
    def from_id(cls, name):
        """Figure out what environment should be used."""
        if name == 'pnacl':
            return cls(_toolchain_pnacl_env())
        elif name == 'wasm':
            return cls(_toolchain_wasm_env())

        assert name == 'build'
        return cls({})

    def activate(self):
        """Update the current environment with this toolchain."""
        os.environ.update(self._env)

    @property
    def cbuild(self):
        """Get the current build system."""
        if self._cbuild is None:
            prog = os.path.join(BUILD_BINDIR, 'config.guess')
            result = run([prog], capture_output=True)
            self._cbuild = result.stdout.strip().decode('utf-8')
        return self._cbuild


def _toolchain_pnacl_env():
    """Get custom env to build using PNaCl toolchain."""
    nacl_sdk_root = os.path.join(OUTPUT, 'naclsdk')

    toolchain_root = os.path.join(nacl_sdk_root, 'toolchain', 'linux_pnacl')
    bin_dir = os.path.join(toolchain_root, 'bin')
    compiler_prefix = os.path.join(bin_dir, 'pnacl-')
    sysroot = os.path.join(toolchain_root, 'le32-nacl')
    sysroot_libdir = os.path.join(sysroot, 'lib')
    pkgconfig_dir = os.path.join(sysroot_libdir, 'pkgconfig')

    return {
        'CHOST': 'nacl',
        'NACL_ARCH': 'pnacl',
        'NACL_SDK_ROOT': nacl_sdk_root,
        'PATH': '%s:%s' % (bin_dir, os.environ['PATH']),
        'CC': compiler_prefix + 'clang',
        'CXX': compiler_prefix + 'clang++',
        'AR': compiler_prefix + 'ar',
        'RANLIB': compiler_prefix + 'ranlib',
        'STRIP': compiler_prefix + 'strip',
        'PKG_CONFIG_PATH': pkgconfig_dir,
        'PKG_CONFIG_LIBDIR': sysroot_libdir,
        'SYSROOT': sysroot,
        'CPPFLAGS': '-I%s -I%s' % (
            os.path.join(sysroot, 'include', 'glibc-compat'),
            os.path.join(nacl_sdk_root, 'include')),
        'LDFLAGS': '-L%s' % (os.path.join(nacl_sdk_root, 'lib', 'pnacl',
                                          'Release'),),
    }


def _toolchain_wasm_env():
    """Get custom env to build using WASM toolchain."""
    sdk_root = os.path.join(OUTPUT, 'wasi-sdk')

    bin_dir = os.path.join(sdk_root, 'bin')
    sysroot = os.path.join(sdk_root, 'share', 'wasi-sysroot')
    libdir = os.path.join(sysroot, 'lib')
    incdir = os.path.join(sysroot, 'include')
    pcdir = os.path.join(libdir, 'pkgconfig')

    return {
        'CHOST': 'wasm32-wasi',
        'CC': os.path.join(bin_dir, 'clang') + ' --sysroot=%s' % sysroot,
        'CXX': os.path.join(bin_dir, 'clang++') + ' --sysroot=%s' % sysroot,
        'AR': os.path.join(bin_dir, 'llvm-ar'),
        'RANLIB': os.path.join(bin_dir, 'llvm-ranlib'),
        'STRIP': os.path.join(BUILD_BINDIR, 'wasm-strip'),
        'PKG_CONFIG_SYSROOT_DIR': sysroot,
        'PKG_CONFIG_LIBDIR': pcdir,
        'SYSROOT': sysroot,
        'CPPFLAGS': '-isystem %s' % (incdir,),
        'LDFLAGS': '-L%s' % (libdir,),
    }


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


def get_parser(desc, default_toolchain):
    """Get a command line parser."""
    parser = argparse.ArgumentParser(description=desc)
    parser.add_argument('--toolchain', choices=('build', 'pnacl', 'wasm'),
                        default=default_toolchain,
                        help='Which toolchain to use (default: %(default)s).')
    parser.add_argument('-d', '--debug', action='store_true',
                        help='Run with debug output.')
    parser.add_argument('-j', '--jobs', type=int,
                        help='Number of jobs to use in parallel.')
    return parser


def update_gnuconfig(metadata, sourcedir):
    """Update config.guess/config.sub files in |sourcedir|."""
    # Special case the sorce of gnuconfig.
    if metadata['PN'] == 'gnuconfig':
        return

    for prog in ('config.guess', 'config.sub'):
        source = os.path.join(BUILD_BINDIR, prog)
        target = os.path.join(sourcedir, prog)
        if os.path.exists(source) and os.path.exists(target):
            copy(source, target)


def build_package(module, default_toolchain):
    """Build the package in the |module|.

    The file system layout is:
    output/                    OUTPUT
      build/                   BUILDDIR
        build/                 toolchain
          mandoc-1.14.3/         metadata['basedir']
            work/                metadata['workdir']
              $p/                metadata['S']
            temp/                metadata['T']
        pnacl/                 toolchain
          zlib-1.2.11/           metadata['basedir']
            work/                metadata['workdir']
              $p/                metadata['S']
            temp/                metadata['T']
    """
    parser = get_parser(module.__doc__, default_toolchain)
    opts = parser.parse_args()
    libdot.setup_logging(debug=opts.debug)

    if opts.jobs:
        global JOBS  # pylint: disable=global-statement
        JOBS = opts.jobs

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
    basedir = os.path.join(BUILDDIR, opts.toolchain, metadata['p'])
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

    toolchain = ToolchainInfo.from_id(opts.toolchain)
    toolchain.activate()
    metadata['toolchain'] = toolchain

    os.environ['HOME'] = HOME
    os.environ['PATH'] = '%s:%s' % (BUILD_BINDIR, os.environ['PATH'])

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
    update_gnuconfig(metadata, sourcedir)
    run_phase('src_prepare', sourcedir)
    run_phase('src_configure', sourcedir)
    run_phase('src_compile', sourcedir)
    run_phase('src_install', sourcedir)
