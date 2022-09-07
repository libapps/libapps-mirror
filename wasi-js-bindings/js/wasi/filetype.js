// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview WASI filetype API constants from wasi/api.h.
 */

export const UNKNOWN = 0;
export const BLOCK_DEVICE = 1;
export const CHARACTER_DEVICE = 2;
export const DIRECTORY = 3;
export const REGULAR_FILE = 4;
export const SOCKET_DGRAM = 5;
export const SOCKET_STREAM = 6;
export const SYMBOLIC_LINK = 7;
