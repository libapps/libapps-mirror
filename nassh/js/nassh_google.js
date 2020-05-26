// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Misc logic for Google-specific integration.
 */

/** @const */
nassh.goog = {};

/**
 * The default extension id for talking to the gnubby.
 *
 * Users can override this if needed on a per-connection basis, but probing
 * allows us to easily adapt based on whatever is installed.
 *
 * @type {string}
 */
nassh.goog.defaultGnubbyExtension = '';

/**
 * Find a usable gnubby extension.
 */
nassh.goog.findGnubbyExtension = function() {
  // If we're not in an extension context, nothing to do.
  if (!window.chrome || !chrome.runtime) {
    return;
  }

  // The possible gnubby extensions.
  const stableAppId = 'beknehfpfkghjoafdifaflglpjkojoco';
  const stableExtId = 'lkjlajklkdhaneeelolkfgbpikkgnkpk';
  // The order matches the gnubby team preferences: https://crbug.com/902588
  // Prefer the extension over the app, and dev over stable.
  const extensions = [
    'klnjmillfildbbimkincljmfoepfhjjj',  // extension (dev)
    stableExtId,                         // extension (stable)
    'dlfcjilkjfhdnfiecknlnddkmmiofjbg',  // app (dev)
    stableAppId,                         // app (stable)
    'kmendfapggjehodndflmmgagdbamhnfd',  // component
  ];

  // Ping the extension to see if it's installed/enabled/alive.
  const check = (id) => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(id, {'type': 'HELLO'}, (result) => {
      // If the remote side doesn't exist (which is normal), Chrome complains
      // if we don't read the lastError.  Clear that here.
      lib.f.lastError();

      // If the probe worked, return the id, else return nothing so we can
      // clear out all the pending promises.
      if (result !== undefined && result['rc'] == 0) {
        resolve(id);
      } else {
        resolve();
      }
    });
  });

  // Guess a reasonable default based on the OS.
  nassh.goog.defaultGnubbyExtension =
      (hterm.os == 'cros' ? stableAppId : stableExtId);

  // We don't set a timeout here as it doesn't block overall execution.
  Promise.all(extensions.map((id) => check(id))).then((results) => {
    console.log(`gnubby probe results: ${results}`);
    for (let i = 0; i < extensions.length; ++i) {
      const extId = extensions[i];
      if (results.includes(extId)) {
        nassh.goog.defaultGnubbyExtension = extId;
        break;
      }
    }
  });
};

/**
 * Register various Google extension probing.
 *
 * This could take time to resolve, so do it as part of start up.
 * It resolves using promises in the background, so this is OK.
 */
lib.registerInit('goog init', function(onInit) {
  nassh.goog.findGnubbyExtension();

  onInit();
});
