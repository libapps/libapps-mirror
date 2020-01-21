// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview WASI API constants.
 */

// TODO(vapier): Switch to 'export * as' once closure support it.
import * as advice from './wasi/advice.js';
import * as clock from './wasi/clock.js';
import * as errno from './wasi/errno.js';
import * as eventtype from './wasi/eventtype.js';
import * as filetype from './wasi/filetype.js';
import * as signal from './wasi/signal.js';
import * as whence from './wasi/whence.js';
export {advice, clock, errno, eventtype, filetype, signal, whence};
