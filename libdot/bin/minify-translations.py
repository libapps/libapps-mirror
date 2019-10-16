#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright 2018 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Minify the translation messages.

These files don't need to be readable when shipped as no one looks at them
directly, and there's a bunch of metadata that are only for translators.
"""

from __future__ import print_function

import json
import re
import sys

import libdot


def minify_placeholders(msg):
    """Expand placeholder values where possible.

    An example input object:
      {
        "message": "Unable to parse destination: $DEST$",
        "placeholders": {
          "dest": {
            "content": "$1",
            "example": "invalid.destination"
          }
        }
      }

    We want to replace '$DEST$' in the message with '$1'.

    For more complicated replacements, we'll leave it alone (for now).
      {
        "message": "Goodbye, $USER$. Come back to $OUR_SITE$ soon!",
        "placeholders": {
          "our_site": {
            "content": "Example.com",
          }
        }
      }
    """
    assert 'message' in msg

    # Walk each of the placeholders.
    for key, settings in list(msg.get('placeholders', {}).items()):
        # Throw away the 'example' field which is meant for translators.
        settings.pop('example', None)

        # Require every replacement exist in the message.  If it's not in there,
        # then it's probably a typo, or a stale entry we want to remove.
        assert '$%s$' % (key.lower(),) in msg['message'].lower(), \
            'Missing $%s$ (case insensitive) in: %s' % (key, msg['message'])

        # If the replacement is simple, inline it.
        m = re.match(r'^[$][0-9]+$', settings['content'])
        if m:
            msg['message'] = re.sub(r'[$]%s[$]' % (key,), settings['content'],
                                    msg['message'], flags=re.I)
            msg['placeholders'].pop(key)

    # Remove the placeholders setting if it's empty after we've processed it.
    placeholders = msg.get('placeholders', {})
    if not placeholders:
        msg.pop('placeholders', None)


def minify(path, inplace=False):
    """Minify translation."""
    with open(path, encoding='utf-8') as fp:
        try:
            data = json.loads(fp.read())
        except ValueError as e:
            print('ERROR: Processing %s: %s' % (path, e), file=sys.stderr)
            return False

    # Strip out the metadata that only translators read.
    for msg in data.values():
        # Translator-aimed description of the message.
        msg.pop('description', None)

        # Expand the placeholders where possible.
        minify_placeholders(msg)

    # Throw away all whitespace.
    formatted = json.dumps(data, ensure_ascii=False, indent=None,
                           separators=(',', ':'))

    if inplace:
        with open(path, 'w', encoding='utf-8') as fp:
            fp.write(formatted)
    else:
        sys.stdout.write(formatted + '\n')

    return True


def get_parser():
    """Get a command line parser."""
    parser = libdot.ArgumentParser(description=__doc__)
    parser.add_argument('-i', '--inplace', default=False, action='store_true',
                        help='Modify files inline rather than writing stdout.')
    parser.add_argument('files', nargs='+', metavar='files',
                        help='The translations to format.')
    return parser


def main(argv):
    """The main func!"""
    parser = get_parser()
    opts = parser.parse_args(argv)

    ret = 0
    for path in opts.files:
        if not minify(path, opts.inplace):
            ret = 1
    return ret


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
