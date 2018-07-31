#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright 2018 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Common libdot util code."""

from __future__ import print_function

import logging
import logging.handlers
import os
import sys
import time


BIN_DIR = os.path.dirname(os.path.realpath(__file__))
DIR = os.path.dirname(BIN_DIR)


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
