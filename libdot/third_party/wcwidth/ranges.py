#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright 2017 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Helper for extracting ranges for wcwidth.

In download mode, we'll automatically fetch the latest known release.

In print mode, we'll display the new tables.  Useful for comparing against
older releases and debugging this script.

In update mode, we'll update lib_wc.js directly.  Useful for lazy devs.

You'll need to provide the relevant Unicode database files.
The latest version can be found here:
https://www.unicode.org/Public/UNIDATA/UCD.zip
"""

from __future__ import print_function

import argparse
import re
from pathlib import Path
import sys
import urllib.request
import zipfile


def load_proplist():
    """Return codepoints based on their various properties."""
    db = {}

    data = Path('PropList.txt').read_text(encoding='utf-8')

    for line in data.splitlines():
        line = line.split('#', 1)[0].strip()
        if not line:
            continue

        codepoint, prop = line.split(';')
        if '..' in codepoint:
            first, last = codepoint.split('..')
        else:
            first = last = codepoint
        first = int(first, 16)
        last = int(last, 16)
        prop = prop.strip()

        db.setdefault(prop, set())
        db[prop].update(range(first, last + 1))

    return db


def load_unicode_data():
    """Return codepoints based on their General Category.

    See these docs for details on the UnicodeData.txt format.
    https://unicode.org/reports/tr44/#UnicodeData.txt
    https://unicode.org/reports/tr44/#General_Category_Values
    """
    db = {
        'Cc': set(),
        # Format Character: https://unicode.org/glossary/#format_character
        'Cf': set(),
        'Co': set(),
        'Cs': set(),
        'Ll': set(),
        'Lm': set(),
        'Lo': set(),
        'Lt': set(),
        'Lu': set(),
        'Mc': set(),
        # Enclosing Mark: https://unicode.org/glossary/#enclosing_mark
        'Me': set(),
        # Nonspacing Mark: https://unicode.org/glossary/#nonspacing_mark
        'Mn': set(),
        'Nd': set(),
        'Nl': set(),
        'No': set(),
        'Pc': set(),
        'Pd': set(),
        'Pe': set(),
        'Pf': set(),
        'Pi': set(),
        'Po': set(),
        'Ps': set(),
        'Sc': set(),
        'Sk': set(),
        'Sm': set(),
        'So': set(),
        'Zl': set(),
        'Zp': set(),
        'Zs': set(),
    }

    data = Path('UnicodeData.txt').read_text(encoding='utf-8')

    for line in data.splitlines():
        line = line.split('#', 1)[0].strip()
        if not line:
            continue

        eles = line.split(';')
        codepoint = eles[0]
        cat = eles[2]

        assert cat in db, line

        db[cat].add(int(codepoint, 16))

    return db


def load_east_asian():
    """Return codepoints based on their east asian width.

    See these docs for details on the EastAsianWidth.txt format.
    https://unicode.org/reports/tr44/#EastAsianWidth.txt
    https://www.unicode.org/reports/tr11/
    """
    db = {
        'A': set(),  # Ambiguous.
        'F': set(),  # Full-width.
        'H': set(),  # Half-width.
        'N': set(),  # Neutral.
        'Na': set(),  # Narrow.
        'W': set(),  # Wide.
    }

    data = Path('EastAsianWidth.txt').read_text(encoding='utf-8')

    for line in data.splitlines():
        line = line.split('#', 1)[0].strip()
        if not line:
            continue

        codepoint, width = line.split(';')
        assert width in db, 'Missing classification: %s' % width

        if '..' in codepoint:
            first, last = codepoint.split('..')
        else:
            first = last = codepoint
        first = int(first, 16)
        last = int(last, 16)

        db[width].update(range(first, last + 1))

    # The Unicode database only lists allocated codepoints.  While not a problem
    # by itself, it causes holes to appear in our output tables which we could
    # optimize around.  Specifically, if there's a block of codepoints that have
    # been preallocated for certain character classes, then we can pretty safely
    # assume that future codepoints in those blocks will have the same width.
    # Here we add entire blocks to fill in unallocated holes which in turn helps
    # collapse adjacent ranges which shrinks the table.  And it makes us a bit
    # future proof for when those codepoints are allocated but we haven't yet
    # updated.  It's pretty uncommon to mix codepoints of different widths in a
    # single block, so it shouldn't bite us.  If it does happen, the add_block
    # check below will catch it!

    def add_block(start, end):
        block = set(range(start, end + 1))
        db['W'].update(block)
        # Make sure some codepoints weren't allocated with different width.
        # This is for future proofing to avoid silent corruption.
        non_wide = db['A'] | db['H'] | db['N'] | db['Na']
        overlap = ['U+%04X' % x for x in sorted(non_wide & block)]
        assert not overlap, 'duplicates found: %s' % overlap

    # CJK Radicals Supplement.
    add_block(0x2e80, 0x2eff)
    # Kangxi Radicals.
    add_block(0x2f00, 0x2fdf)
    # Ideographic Description Characters.
    add_block(0x2ff0, 0x2fff)
    # Hiragana.
    add_block(0x3040, 0x309f)
    # Katakana.
    add_block(0x30a0, 0x30ff)
    # Bopomofo.
    add_block(0x3100, 0x312f)
    # Hangul Compatibility Jamo.
    add_block(0x3130, 0x318f)
    # Bopomofo Extended.
    add_block(0x31a0, 0x31bf)
    # CJK Strokes.
    add_block(0x31c0, 0x31ef)
    # Enclosed CJK Letters and Months.
    # This block has a few narrow chars in the middle.
    add_block(0x3200, 0x3247)
    add_block(0x3250, 0x32ff)
    # CJK Compatibility.
    add_block(0x3300, 0x33ff)
    # CJK Unified Ideographs Extension A.
    add_block(0x3400, 0x4dbf)
    # CJK Unified Ideographs.
    add_block(0x4e00, 0x9fff)
    # Yi Syllables.
    add_block(0xa000, 0xa48f)
    # Yi Radicals.
    add_block(0xa490, 0xa4cf)
    # Hangul Jamo Extended-A.
    add_block(0xa960, 0xa97f)
    # CJK Compatibility Ideographs.
    add_block(0xf900, 0xfaff)
    # CJK Small Form Variants.
    add_block(0xfe50, 0xfe6f)
    # Tangut.
    add_block(0x17000, 0x187ff)
    # Tangut Components.
    add_block(0x18800, 0x18aff)
    # Kana Supplement.
    add_block(0x1b000, 0x1b0ff)
    # Kana Extended-A.
    add_block(0x1b100, 0x1b12f)
    # Nushu.
    add_block(0x1b170, 0x1b2ff)

    return db


def gen_table(codepoints):
    """Generate a binary search table using |codepoints|."""
    codepoints = sorted(codepoints)

    ranges = []
    start = last = codepoints.pop(0)
    for codepoint in codepoints:
        if codepoint != last + 1:
            ranges.append([start, last])
            start = last = codepoint
        else:
            last = codepoint
    ranges.append([start, last])
    return ranges


def js_dumps(ranges):
    """Dump a binary search table |ranges| as a Javascript object.

    This is currently ad-hoc code but could easily use the json
    module.  We do this to have better control over output format.
    """
    ret = '[\n'
    i = 0
    for r in ranges:
        if i == 0:
            # Indent this new line.
            ret += '  '
        else:
            # Add a space after the previous element.
            ret += ' '
        ret += '[%#06x, %#06x],' % (r[0], r[1])
        i += 1
        if i == 3:
            ret += '\n'
            i = 0
    if i:
        ret += '\n'
    ret += '];\n'

    return ret


def gen_combining(db, prob_db):
    """Generate the table of all zero-width/combining characters."""
    # The classes that are explicitly zero width.
    combining_chars = db['Me'] | db['Mn'] | db['Cf']

    # A note on soft-hyphen (U+OOAD): Previous versions that used the tables
    # from Markus Kuhn's code marked this as wcwidth of 1.  Unicode has changed
    # it to a wcwidth of 0.  Chrome and Firefox treat it as invisible.  We now
    # treat this as 0 to keep aligned with those platforms.  If those change,
    # then we can adopt as well.
    # https://www.cs.tut.fi/~jkorpela/shy.html
    # https://sourceware.org/bugzilla/show_bug.cgi?id=22073
    # https://github.com/jquast/wcwidth/issues/8

    # Remove Arabic Signs Spanning Numbers (0600-0605).
    # https://www.unicode.org/versions/Unicode10.0.0/ch09.pdf
    # Unicode 10.0.0 chapter 9 section 2 page 377 states:
    # Signs Spanning Numbers. Several other special signs are written in
    # association with numbers in the Arabic script. All of these signs can
    # span multiple-digit numbers, rather than just a single digit. They are
    # not formally considered combining marks in the sense used by the Unicode
    # Standard, although they clearly interact graphically with their associated
    # sequence of digits. In the text representation they precede the sequence
    # of digits that they span, rather than follow a base character, as would be
    # the case for a combining mark. Their General_Category value is Cf (format
    # character). Unlike most other format characters, however, they should be
    # rendered with a visible glyph, even in circumstances where no Middle
    # East-I 378 9.2 Arabic suitable digit or sequence of digits follows them
    # in logical order.
    # A few similar signs spanning numbers or letters are associated with
    # scripts other than Arabic. See the discussion of U+070F syriac
    # abbreviation mark in Section 9.3, Syriac, and the discussion of U+110BD
    # kaithi number sign in Section 15.2, Kaithi. All of these prefixed format
    # controls, including the non-Arabic ones, are given the property value
    # Prepended_Concatenation_Mark=True, to identify them as a class. They also
    # have special behavior in text segmentation. (See Unicode Standard Annex
    # #29, "Unicode Text Segmentation.")
    combining_chars -= set(prob_db['Prepended_Concatenation_Mark'])

    # Add the Hangul Jungseong and Jongseong block (1160-11FF).
    # While they are not marked as combining characters, they are used
    # with the Hangul Choseong block to form complete characters.
    # TODO: This is actually more nuanced than "always 1" or "always 0".
    # https://sourceware.org/bugzilla/show_bug.cgi?id=22074
    combining_chars |= set(range(0x1160, 0x11FF + 1))

    return gen_table(combining_chars)


def gen_east_asian(db):
    """Generate the table of all explicitly wide east asian characters."""
    return gen_table(db['W'] | db['F'])


def gen_east_asian_ambiguous(db):
    """Generate the table of explicit & ambiguous wide east asian characters."""
    return gen_table(db['W'] | db['F'] | db['A'])


def find_js(js):
    """Locate the JavaScript file to update."""
    if js is None:
        js = Path(__file__).resolve().parent / 'lib_wc.js'

    return js


def download(version):
    """Download the release archive for |version|."""
    # This is the timeout used on each blocking operation, not the entire
    # life of the connection.  So it's used for initial urlopen and for each
    # read attempt (which may be partial reads).  5 minutes should be fine.
    TIMEOUT = 5 * 60

    if version == 'latest':
        uri = 'https://www.unicode.org/Public/UNIDATA/UCD.zip'
        output = Path.cwd() / f'UCD.zip'

        if output.exists():
            req = urllib.request.Request(uri, method='HEAD')
            with urllib.request.urlopen(req, timeout=TIMEOUT) as f:
                length = int(f.getheader('Content-Length'))
            if length != output.stat().st_size:
                print(f'Refreshing {output}')
                output.unlink()
    else:
        uri = f'https://www.unicode.org/Public/zipped/{version}/UCD.zip'
        output = Path.cwd() / f'UCD-{version}.zip'

    # Fetch the archive if it doesn't exist.
    if not output.exists():
        print(f'Downloading {uri}')
        tmpfile = output.with_suffix('.tmp')

        with open(tmpfile, 'wb') as outfp:
            with urllib.request.urlopen(uri, timeout=TIMEOUT) as infp:
                while True:
                    data = infp.read(1024 * 1024)
                    if not data:
                        break
                    outfp.write(data)

        tmpfile.rename(output)

    print('Extracting files')
    with zipfile.ZipFile(output) as archive:
        archive.extract('EastAsianWidth.txt')
        archive.extract('PropList.txt')
        archive.extract('UnicodeData.txt')


def get_parser():
    """Return an argparse parser for the CLI."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', default='latest',
                        help='The Unicode version to use (%(default)s)')
    parser.add_argument('--js', type=Path,
                        help='JavaScript file to update')
    parser.add_argument('action', choices=('download', 'print', 'update'),
                        help='Operating mode')
    return parser


def main(argv):
    """The main entry point!"""
    parser = get_parser()
    opts = parser.parse_args(argv)

    prop_db = load_proplist()
    uni_db = load_unicode_data()
    cjk_db = load_east_asian()

    tables = (
        ('lib.wc.combining', js_dumps(gen_combining(uni_db, prop_db))),
        ('lib.wc.unambiguous', js_dumps(gen_east_asian(cjk_db))),
        ('lib.wc.ambiguous', js_dumps(gen_east_asian_ambiguous(cjk_db))),
    )

    if opts.action == 'download':
        download(opts.version)
    elif opts.action == 'print':
        for name, text in tables:
            print(name + ' = ' + text)
    else:
        js = find_js(opts.js)
        data = js.read_text(encoding='utf-8')

        for name, text in tables:
            data = re.sub(r'^%s = .*?^\];\n$' % name, name + ' = ' + text, data,
                          flags=re.M|re.S)

        js.write_text(data, encoding='utf-8')


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
