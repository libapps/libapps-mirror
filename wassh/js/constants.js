// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Various constants that submodules export.  Placed in a single
 * common module to avoid excess imports otherwise.
 */

// const AF_UNSPEC = 0;
export const AF_INET = 1;
export const AF_INET6 = 2;
export const AF_UNIX = 3;

export const MSG_DONTWAIT = 0x40;
