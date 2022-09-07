// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * JS dynamic import moved into its own file so that it can be hidden from
 * closure compiler which does not support it.
 *
 * @param {string} module
 * @return {!Promise<!Object>}
 */
export function terminalImport(module) {
  return import(module);
}
