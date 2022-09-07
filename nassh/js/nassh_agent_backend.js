// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview A stub backend for the SSH agent from which all other backends
 * derive.
 */

import {UserIO} from './nassh_agent.js';
import {Identity} from './nassh_agent_message_types.js';

/**
 * Base class for SSH agent backends compatible with Agent.
 *
 * @param {!UserIO} userIO Used for user-facing terminal IO.
 * @constructor
 */
export function Backend(userIO) {
  /**
   * Reference to object with terminal IO functions.
   *
   * @private {!UserIO}
   * @const
   */
  this.userIO_ = userIO;
}

/**
 * The unique ID of the backend. This is used to reference the backend in the
 * relay options and must not match the regexp /^[a-z]{32}$/.
 *
 * @type {string}
 */
Backend.prototype.BACKEND_ID = 'stub';

/**
 *  Generic response for request types that are not implemented.
 *
 * @const {!Error}
 */
Backend.ERR_NOT_IMPLEMENTED = new Error('not implemented');

/**
 * Called once when the client connects to the agent.
 * The backend should check whether it is fully operational and run
 * initializations that can fail.
 *
 * @return {!Promise<void>} A resolving promise if the
 *     backend initialized successfully; a rejecting promise otherwise.
 */
Backend.prototype.ping = function() {
  return Promise.resolve();
};

/**
 * Called when the client sends an AGENTC_REQUEST_IDENTITIES request.
 *
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.4
 * @return {!Promise<!Array<!Identity>>} A promise resolving to an array of SSH
 *     identities; a rejecting promise with an error message if the request
 *     could not be handled.
 */
Backend.prototype.requestIdentities = function() {
  return Promise.reject(Backend.ERR_NOT_IMPLEMENTED);
};

/**
 * Called when the client sends an AGENTC_SIGN_REQUEST request.
 *
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.5
 * @param {!Uint8Array} keyBlob The key blob of the key requested to perform
 *     the signature.
 * @param {!Uint8Array} data The challenge data to be signed.
 * @param {number} flags A uint32 treated as a bitfield of signature flags.
 * @return {!Promise<!Uint8Array>|!Promise<!Error>} A promise resolving to
 *     the computed signature; a rejecting promise with an error message if the
 *     request could not be handled.
 */
Backend.prototype.signRequest = function(keyBlob, data, flags) {
  return Promise.reject(Backend.ERR_NOT_IMPLEMENTED);
};

/**
 * Show a message in the terminal window.
 *
 * @param {string} message The message to be shown. Note: The message should
 *     consist of a localized string obtained via localize.
 */
Backend.prototype.showMessage = function(message) {
  this.userIO_.showMessage(this.BACKEND_ID, message);
};

/**
 * Show a message in the terminal window and prompt the user for a string.
 *
 * @param {string} promptMessage The message that should precede the prompt.
 *     Note: The message should consist of a localized string obtained via
 *     localize.
 * @return {!Promise<string>|!Promise<void>} A promise resolving to the input
 *     if the user confirms it by pressing enter; a rejecting promise if the
 *     user cancels the prompt by pressing ESC.
 */
Backend.prototype.promptUser = async function(promptMessage) {
  return this.userIO_.promptUser(this.BACKEND_ID, promptMessage);
};
