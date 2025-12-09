// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Various test helpers meant to be reused by other modules.
 */

import {lib} from '../../libdot/index.js';

/**
 * Listens for the next change to the specified preference.
 *
 * @param {!lib.PreferenceManager} prefMgr
 * @param {string} prefName
 * @return {!Promise<void>} Promise which resolves when preference is changed.
 */
export function listenForPrefChange(prefMgr, prefName) {
  return new Promise((resolve) => {
    const observer = () => {
      resolve();
      prefMgr.removeObserver(prefName, observer);
    };
    prefMgr.addObserver(prefName, observer);
  });
}
