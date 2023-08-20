// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Misc logic for Google-specific integration.
 */

import {hterm} from '../../hterm/index.js';

import {localize, runtimeSendMessage} from './nassh.js';

/**
 * The different certificate slots in the gnubby.
 *
 * @enum {number}
 */
const gnubbySlot = {
  CORP_NORMAL_CERT_SLOT: 0,
  PROD_NORMAL_CERT_SLOT: 1,
  CORP_EMRGCY_CERT_SLOT: 2,
  PROD_EMRGCY_CERT_SLOT: 3,
  NON_ROTATING_SLOT: 4,
  SSO_SLOT: 5,
  E2E_NO_CONSUME_SLOT: 6,
  E2E_CONSUME_SLOT: 7,
};

/**
 * The different errors SKE can return.
 *
 * @enum {string}
 */
const gnubbyErrReason = {
  OTHER_ERROR: 'other error',
  REQUEST_EXPIRED: 'request expired',
  ACL_FAIL: 'acl failed',
  BAD_REQUEST_DATA: 'bad request data',
  NATIVE_HELPER_ERROR: 'native helper error',
  NETWORK_ERROR: 'network error',
  GNUBBY_CERT_NOT_FOUND: 'gnubby SSH cert missing',
  CANCELLED: 'request is cancelled',
};

/**
 * A SKE response.
 *
 * @typedef {{
 *   type: string,
 *   expiry: number,
 *   errorReason: !gnubbyErrReason,
 *   errorDetail: string,
 * }}
 */
let skeResponse;

/**
 * The default extension id for talking to SKE.
 *
 * @type {string}
 */
let defaultSkeExtension = '';

/**
 * Find a usable SKE.
 *
 * @return {!Promise<boolean>} Resolve true if SKE was found.
 */
async function findSkeExtension() {
  // If we're not in an extension context, nothing to do.
  if (!globalThis.chrome?.runtime) {
    return false;
  }

  // The possible extensions.
  // The order matches the SKE team preferences: https://crbug.com/1275205
  const extensions = [
    'ckcendljdlmgnhghiaomidhiiclmapok',  // v3 ext (dev)
    'lfboplenmmjcmpbkeemecobbadnmpfhi',  // v3 ext (stable)
  ];

  // Ping the extension to see if it's installed/enabled/alive.
  const check = async (id) => {
    let result;
    try {
      result = /** @type {!skeResponse} */ (await runtimeSendMessage(
          id, {'type': 'HELLO'}));
    } catch (e) {
      return;
    }

    // If the probe worked, return the id, else return nothing so we can
    // clear out all the pending promises.
    if (result !== undefined && result.type === 'HELLO') {
      return id;
    }
  };

  return Promise.all(extensions.map(check)).then((results) => {
    console.log(`ske probe results: ${results}`);
    for (let i = 0; i < extensions.length; ++i) {
      const extId = extensions[i];
      if (results.includes(extId)) {
        defaultSkeExtension = defaultGnubbyExtension = defaultGcseExtension =
            extId;
        return true;
      }
    }
  });
}

/**
 * Try to refresh the SSH cert if it's old.
 *
 * If the request works, we'll wait for it, otherwise we'll continue on even if
 * we received an error.  Messages will be logged, but we won't throw errors.
 *
 * @param {!hterm.Terminal.IO} io Handle to the terminal for showing status.
 * @return {!Promise<boolean>} Resolve true if certificate is up-to-date.
 */
async function skeRefresh(io) {
  io.print(localize('SSH_CERT_CHECK_START'));

  let result;
  try {
    result = /** @type {!skeResponse} */ (await runtimeSendMessage(
        defaultSkeExtension, {
          type: 'cert_status_request',
          slot: gnubbySlot.CORP_NORMAL_CERT_SLOT,
        }));
  } catch (e) {
    io.println(localize('SSH_CERT_CHECK_ERROR', [e]));
    return false;
  }

  const now = new Date().getTime() / 1000;

  // If no certificate exists at all, we still want to refresh, so rewrite the
  // message as if it was a valid expire of right now.
  if (result.type === 'error_response' &&
      result.errorReason === gnubbyErrReason.GNUBBY_CERT_NOT_FOUND) {
    result.type = 'cert_status_response';
    result.expiry = now;
  }

  if (result.type !== 'error_response') {
    // Refresh the certificate if it expires in the next hour.
    const hoursLeft = Math.floor((result.expiry - now) / 60 / 60);
    io.println(localize('SSH_CERT_CHECK_RESULT', [hoursLeft]));
    if (hoursLeft < 1) {
      io.showOverlay(localize('SSH_CERT_CHECK_REFRESH'));
      result = /** @type {!skeResponse} */ (await runtimeSendMessage(
          defaultSkeExtension, {
            type: 'get_new_cert_request',
            slot: gnubbySlot.CORP_NORMAL_CERT_SLOT,
          }));
      // Fall thru.
    }
  }

  if (result.type === 'error_response') {
    io.println(localize(
        'SSH_CERT_CHECK_ERROR',
        [`${result.errorReason} ${result.errorDetail}`]));
    return false;
  }

  return true;
}

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
 *
 * @return {!Promise}
 */
function findGnubbyExtension() {
  // If we're not in an extension context, nothing to do.
  if (!globalThis.chrome?.runtime) {
    return Promise.resolve();
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
    return runtimeSendMessage(id, {'type': 'HELLO'}).then((result) => {
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
  return Promise.all(extensions.map(check)).then((results) => {
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
 *
 * @return {!Promise}
 */
function findGcseExtension() {
  // If we're not in an extension context, nothing to do.
  if (!globalThis.chrome?.runtime) {
    return Promise.resolve();
  }

  const devId = 'oncenbbimcccjedkmajnncfllmbnmbnp';

  // Ping the dev extension to see if it's installed/enabled/alive.
  return runtimeSendMessage(devId, {'action': 'hello'}).then((result) => {
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
export async function gcseRefreshCert(io) {
  if (defaultGcseExtension === defaultSkeExtension) {
    await skeRefresh(io);
    return;
  }

  io.print(localize('SSH_CERT_CHECK_START'));
  return runtimeSendMessage(defaultGcseExtension,
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
        io.println(localize('SSH_CERT_CHECK_RESULT', [hoursLeft]));
        if (hoursLeft < 1) {
          io.showOverlay(localize('SSH_CERT_CHECK_REFRESH'));
          return runtimeSendMessage(
              defaultGcseExtension,
              {action: 'request_certificate', wait: true});
        }
      } else {
        io.println(localize('SSH_CERT_CHECK_ERROR', [result.error]));
      }
    })
    .catch((result) => io.println(localize('SSH_CERT_CHECK_ERROR', [result])));
}

/**
 * Register various Google extension probing.
 *
 * This could take time to resolve, so do it as part of start up.
 * It resolves using promises in the background, so this is OK.
 */
export async function probeExtensions() {
  const ske = await findSkeExtension();
  if (ske !== true) {
    await Promise.all([
      findGnubbyExtension(),
      findGcseExtension(),
    ]);
  }
}
