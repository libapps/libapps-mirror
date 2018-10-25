#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright 2017 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Reformat the plugin/ layout into _platform_specific/.

The Chrome Webstore (CWS) has a feature where it can create smaller CRX's for
users by filtering out arch-specific paths.  But it requires the files be placed
in specific subdirs.  This tool takes care of that for us.

https://developer.chrome.com/native-client/devguide/distributing
"""

from __future__ import print_function

import argparse
import json
import os
import sys


ARCHES = set(('arm', 'x86-32', 'x86-64'))


def process_manifest(opts, manifest_path, srcroot, dstroot):
    """Rewrite the manifest to use the _platform_specific feature."""
    manifest = json.load(open(manifest_path))
    if 'program' not in manifest:
        return

    srcsubpath = os.path.dirname(os.path.relpath(manifest_path, srcroot))

    update = False
    for arch in ARCHES:
        if arch not in manifest['program']:
            continue

        url = manifest['program'][arch]['url']
        if '_platform_specific' in url:
            if not opts.quiet:
                print('Already relocated: %s' % (url,))
            continue
        if not url.endswith('.nexe'):
            if not opts.quiet:
                print('Ignoring non-NaCl file: %s' % (url,))
            continue

        srcurl = os.path.join(srcroot, srcsubpath, url)
        dsturl = os.path.join(dstroot, arch, srcsubpath, url)
        os.makedirs(os.path.dirname(dsturl), exist_ok=True)
        os.rename(srcurl, dsturl)
        manifest['program'][arch]['url'] = os.path.relpath(
            dsturl, os.path.dirname(srcurl))
        update = True

    if update:
        if not opts.quiet:
            print('Rewriting manifest for _platform_specific: %s' %
                  (manifest_path,))
        with open(manifest_path, 'w') as fp:
            json.dump(manifest, fp)


def get_parser():
    """Get a command line parser."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base',
                        help='Base path for input/output defaults.')
    parser.add_argument('--input',
                        help='The plugin directory to read.')
    parser.add_argument('--output',
                        help='The nacl directory to write.')
    parser.add_argument('-q', '--quiet', default=False, action='store_true',
                        help='Only emit error messages.')
    return parser


def main(argv):
    """The main func!"""
    parser = get_parser()
    opts = parser.parse_args(argv)

    if opts.input is None and opts.output is None:
        if opts.base is None:
            parser.error('--base or --input/--output required')
        opts.input = os.path.join(opts.base, 'plugin')
        opts.output = os.path.join(opts.base, '_platform_specific')

    for root, _, files in os.walk(opts.input):
        for f in files:
            if f.endswith('.nmf'):
                process_manifest(opts, os.path.join(root, f), opts.input,
                                 opts.output)


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
