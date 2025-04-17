// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Misc logic for Google-specific integration.
 */

import {hterm} from '../../hterm/index.js';

import {localize, runtimeSendMessage} from './nassh.js';
import {SshPolicy} from './ssh_policy.js';

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
        defaultSkeExtension = extId;
        return true;
      }
    }
  });
}

/**
 * Try to fetch from SKE the SSH policy
 * @return {!Promise<!SshPolicy>}
 */
export async function fetchSshPolicy() {
  const response = await runtimeSendMessage(
    defaultSkeExtension, {
      type: 'get_ssh_policy_request',
    }).catch((e) => ({}));

  const data = response['data'] ?? {};

  return SshPolicy.from(data);
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
export async function refreshGoogleSshCert(io) {
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
    const hoursLeft = Math.max(0, Math.floor((result.expiry - now) / 60 / 60));
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
 * Return the extension id for Google SSH agent.
 *
 * @return {string} The extension id.
 */
export function getGoogleSshAgentExtension() {
  return defaultSkeExtension;
}

/**
 * Register various Google extension probing.
 *
 * This could take time to resolve, so do it as part of start up.
 * It resolves using promises in the background, so this is OK.
 */
export async function probeExtensions() {
  await findSkeExtension();
}
