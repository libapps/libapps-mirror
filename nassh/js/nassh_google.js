// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Misc logic for Google-specific integration.
 */

/**
 * The default extension id for talking to the gnubby.
 *
 * Users can override this if needed on a per-connection basis, but probing
 * allows us to easily adapt based on whatever is installed.
 *
 * @type {string}
 */
let defaultGnubbyExtension = '';

/**
 * Return the current gnubby extension id.
 *
 * @return {string} The extension id.
 */
export function getGnubbyExtension() {
  return defaultGnubbyExtension;
}

/**
 * Find a usable gnubby extension.
 */
function findGnubbyExtension() {
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
  const check = (id) => {
    return nassh.runtimeSendMessage(id, {'type': 'HELLO'}).then((result) => {
      // If the probe worked, return the id, else return nothing so we can
      // clear out all the pending promises.
      if (result !== undefined && result['rc'] == 0) {
        return id;
      }
    }).catch((e) => {});
  };

  // Guess a reasonable default based on the OS.
  defaultGnubbyExtension = (hterm.os == 'cros' ? stableAppId : stableExtId);

  // We don't set a timeout here as it doesn't block overall execution.
  Promise.all(extensions.map(check)).then((results) => {
    console.log(`gnubby probe results: ${results}`);
    for (let i = 0; i < extensions.length; ++i) {
      const extId = extensions[i];
      if (results.includes(extId)) {
        defaultGnubbyExtension = extId;
        break;
      }
    }
  });
}

/**
 * The default extension id for managing certs.
 *
 * We default to the stable version.  If the dev version is available, we'll
 * switch on the fly below.  We don't currently allow people to control this.
 * This aligns with the gnubby team preferences: https://crbug.com/902588
 *
 * @type {string}
 */
let defaultGcseExtension = 'cfmgaohenjcikllcgjpepfadgbflcjof';

/**
 * Find a usable GCSE extension.
 */
function findGcseExtension() {
  // If we're not in an extension context, nothing to do.
  if (!window.chrome || !chrome.runtime) {
    return;
  }

  const devId = 'oncenbbimcccjedkmajnncfllmbnmbnp';

  // Ping the dev extension to see if it's installed/enabled/alive.
  nassh.runtimeSendMessage(devId, {'action': 'hello'}).then((result) => {
    // If the probe worked, return the id, else return nothing so we can
    // clear out all the pending promises.  We don't check the value of the
    // status field as it will be "error" which is confusing -- while the
    // "hello" action is specifically reserved, it isn't handled :).
    if (result !== undefined && result['status']) {
      console.log(`found GCSE dev extension ${devId}`);
      defaultGcseExtension = devId;
    }
  }).catch((e) => {});
}

/**
 * Try to refresh the SSH cert if it's old.
 *
 * If the request works, we'll wait for it, otherwise we'll continue on even if
 * we received an error.  Messages will be logged, but we won't throw errors.
 *
 * @param {!hterm.Terminal.IO} io Handle to the terminal for showing status.
 * @return {!Promise<void>} Resolve once things are in sync.
 */
export function gcseRefreshCert(io) {
  io.print(nassh.msg('SSH_CERT_CHECK_START'));
  return nassh.runtimeSendMessage(defaultGcseExtension,
                                  {'action': 'certificate_expiry'})
    .then((result) => {
      const now = new Date().getTime() / 1000;

      // GCSE doesn't return a structured response, so sniff the error message.
      // It's terrible, but it works well enough.  And if it's "wrong", then
      // there's not really much harm here as it just means we refresh sooner.
      if (result.status === 'error' &&
          result.error === 'Unable to determine expiry undefined') {
        result.status = 'OK';
        result.expires = now;
      }

      if (result.status === 'OK') {
        // Refresh the certificate if it expires in the next hour.
        const hoursLeft = Math.floor((result.expires - now) / 60 / 60);
        io.println(nassh.msg('SSH_CERT_CHECK_RESULT', [hoursLeft]));
        if (hoursLeft < 1) {
          io.showOverlay(nassh.msg('SSH_CERT_CHECK_REFRESH'));
          return nassh.runtimeSendMessage(
              defaultGcseExtension,
              {action: 'request_certificate', wait: true});
        }
      } else {
        io.println(nassh.msg('SSH_CERT_CHECK_ERROR', [result.error]));
      }
    })
    .catch((result) => io.println(nassh.msg('SSH_CERT_CHECK_ERROR', [result])));
}

/**
 * Register various Google extension probing.
 *
 * This could take time to resolve, so do it as part of start up.
 * It resolves using promises in the background, so this is OK.
 */
lib.registerInit('goog init', () => {
  findGnubbyExtension();
  findGcseExtension();
});
