// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Externs definitions for BigInt APIs.
 * Workaround missing closure functionality.
 * https://github.com/google/closure-compiler/issues/3167
 * @externs
 */

/**
 * @param {number} n
 * @return {number}
 */
var BigInt = function(n) {};
