// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview An SSH agent that aggregates responses from multiple
 * dynamically loaded backends.
 * @suppress {moduleLoad}
 */

import {lib} from '../../libdot/index.js';

import {hterm} from '../../hterm/index.js';
import {
  IMG_VISIBILITY_URI, IMG_VISIBILITY_OFF_URI,
} from './deps_resources.rollup.js';

import {Backend} from './nassh_agent_backend.js';
import {GSC} from './nassh_agent_backend_gsc.js';
import {Message} from './nassh_agent_message.js';
import {FAILURE, MessageNumbers,
        writeMessage} from './nassh_agent_message_types.js';

/**
 * Map backend IDs to the respective classes inheriting from Backend.
 *
 * @type {!Object<string, function(new:Backend, !UserIO, boolean)>}
 * @private
 */
const registeredBackends = {};

/**
 * Used by a backend to register itself with the agent.
 *
 * @param {function(new:Backend, !UserIO, boolean)} backendClass
 */
function registerBackend(backendClass) {
  registeredBackends[backendClass.prototype.BACKEND_ID] = backendClass;
}

// Register the backend for use by Agent.
registerBackend(Backend);
registerBackend(GSC);

/**
 * Check whether a list of backend IDs is valid.
 *
 * @param {!Array<string>} backendIDs
 * @return {!Array<boolean>} An array of the same length as backendIDs, where
 *     an entry is true if and only if its backend ID corresponds to a
 *     registered backend.
 */
export function checkBackendIDs(backendIDs) {
  return backendIDs.map(
      (backendID) => registeredBackends.hasOwnProperty(backendID));
}

/**
 * Manage multiples SSH agent backends and aggregates their results.
 *
 * @param {!Array<string>} backendIDs An array of IDs of backends which should
 *     be used by the agent to reply to incoming requests.
 * @param {!hterm.Terminal} term Reference to hterm.
 * @param {boolean} isForwarded Whether the agent is being forwarded to the
 *     server.
 * @constructor
 */
export function Agent(backendIDs, term, isForwarded) {
  console.log('agent.Agent: registered backends:', registeredBackends);

  /**
   * The collection of instantiated backends that the agent is using to respond
   * to requests.
   *
   * @private {!Array<!Backend>}
   * @const
   */
  this.backends_ =
      backendIDs
          .map((backendID) => {
            if (registeredBackends.hasOwnProperty(backendID)) {
              console.log(`agent.Agent: loading backend '${backendID}'`);
              return new registeredBackends[backendID](
                  new UserIO(term), isForwarded);
            } else {
              console.error(`agent.Agent: unknown backend ID '${backendID}'`);
              return null;
            }
          })
          .filter((backend) => backend);
  if (!this.backends_) {
    throw new Error('agent.Agent: no backends loaded');
  }

  /**
   * Map backend IDs to the instantiated backend.
   *
   * @private {!Object<string, !Backend>}
   * @const
   */
  this.idToBackend_ = {};
  for (const backend of this.backends_) {
    this.idToBackend_[backend.BACKEND_ID] = backend;
  }

  /**
   * Map a string representation of an identity's key blob to the ID of the
   * backend that provides it.
   *
   * @private {!Object<string, string>}
   */
  this.identityToBackendID_ = {};
}

/**
 * Initialize all backends by calling their ping function.
 *
 * @return {!Promise<!Array<undefined>>} A resolving promise if all backends
 *     initialized successfully; a rejecting promise otherwise.
 */
Agent.prototype.ping = function() {
  return Promise.all(this.backends_.map((backend) => backend.ping()));
};

/**
 * Delegate handling a raw SSH agent request to a registered request handler.
 *
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.3
 * @param {!Uint8Array} rawRequest The bytes of a raw request.
 * @return {!Promise<!Message>} A Message object containing the aggregate
 *     responses of all backends.
 */
Agent.prototype.handleRequest = function(rawRequest) {
  const request = Message.fromRawMessage(rawRequest);
  if (!request) {
    console.error('Agent.handleRequest: invalid request', rawRequest);
    return Promise.resolve(FAILURE);
  } else {
    return this.handleRequest_(request);
  }
};

/**
 * Map message (request) types to handler functions.
 *
 * @type {!Object<!MessageNumbers,
 *     function(this:Agent, !Message):
 *     !Promise<!Message>>}
 * @private
 * @suppress {lintChecks} Allow non-primitive prototype property.
 */
Agent.prototype.requestHandlers_ = {};

/**
 * @param {!Message} request
 * @return {!Promise<!Message>}
 */
Agent.prototype.handleRequest_ = function(request) {
  if (this.requestHandlers_.hasOwnProperty(request.type)) {
    return this.requestHandlers_[request.type]
        .call(this, request)
        .catch(function(e) {
          console.error(e);
          return FAILURE;
        });
  } else {
    console.error(
        `Agent.handleRequest: message number ${request.type} not supported`);
    return Promise.resolve(FAILURE);
  }
};

/**
 * Convert a raw SSH key blob to the format used in authorized_keys files.
 *
 * @param {!Uint8Array} keyBlob The raw key blob.
 * @return {string}
 */
export function keyBlobToAuthorizedKeysFormat(keyBlob) {
  const keyBlobBase64 = btoa(lib.codec.codeUnitArrayToString(keyBlob));
  // Extract and prepend key type prefix.
  const dv = new DataView(keyBlob.buffer, keyBlob.byteOffset);
  const prefixLength = dv.getUint32(0);
  const prefixBlob = keyBlob.slice(4, 4 + prefixLength);
  const prefix = lib.codec.codeUnitArrayToString(prefixBlob);
  return `${prefix} ${keyBlobBase64}`;
}

/**
 * Handle an AGENTC_REQUEST_IDENTITIES request by responding with an
 * AGENT_IDENTITIES_ANSWER.
 *
 * @this {Agent}
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.4
 * @return {!Promise<!Message>}
 */
Agent.prototype.requestHandlers_[MessageNumbers.AGENTC_REQUEST_IDENTITIES] =
    function() {
  this.identityToBackendID_ = {};
  // Request identities from all backends in "parallel" and concatenate
  // the individual arrays of identities. If a backend fails, return an empty
  // list of identities for it.
  // TODO: Using Promise.race, one could set a timeout for the backends.
  return Promise
      .all(this.backends_.map(
          (backend) => backend.requestIdentities()
                  .then((backendIdentities) => {
                    for (const identity of backendIdentities) {
                      // Turn the key blob into a string to be able to
                      // use it as a key of an object.
                      const keyBlobStr =
                          new TextDecoder('utf-8').decode(identity.keyBlob);
                      // Print the public key blob (in the format used
                      // for ~/.authorized_keys) to the console as a
                      // courtesy to the user.
                      console.log(
                          'Public key to be added as a new line to ' +
                          '~/.ssh/authorized_keys on the server:\n' +
                          keyBlobToAuthorizedKeysFormat(identity.keyBlob));
                      // Remember the backend the identity was
                      // requested from.
                      this.identityToBackendID_[keyBlobStr] =
                          backend.BACKEND_ID;
                    }
                    return backendIdentities;
                  })
                  .catch(function(e) {
                    console.error(e);
                    return [];
                  })))
      .then((arrayOfArrays) => [].concat(...arrayOfArrays))
      .then((identities) => {
        return writeMessage(MessageNumbers.AGENT_IDENTITIES_ANSWER, identities);
      });
};

/**
 * Handle an AGENTC_SIGN_REQUEST request by responding with an
 * AGENT_SIGN_RESPONSE.
 *
 * @this {Agent}
 * @param {!Message} request The request as a Message object.
 * @return {!Promise<!Message>}
 */
Agent.prototype.requestHandlers_[MessageNumbers.AGENTC_SIGN_REQUEST] =
    function(request) {
  const keyBlobStr = new TextDecoder('utf-8').decode(request.fields.keyBlob);
  if (!this.identityToBackendID_.hasOwnProperty(keyBlobStr)) {
    return Promise.reject(new Error(
        'AGENTC_SIGN_REQUEST: keyBlob could not be mapped to a backend'));
  }
  const backendId = this.identityToBackendID_[keyBlobStr];
  return this.idToBackend_[backendId]
      .signRequest(
          request.fields.keyBlob, request.fields.data, request.fields.flags)
      .then((signature) => {
        return writeMessage(MessageNumbers.AGENT_SIGN_RESPONSE, signature);
      });
};

/**
 * Provide helper functions for terminal IO tasks needed by backends.
 *
 * @param {!hterm.Terminal} term Reference to the current terminal.
 * @constructor
 */
export function UserIO(term) {
  /**
   * Reference to the current terminal.
   *
   * @private {!hterm.Terminal}
   * @const
   */
  this.term_ = term;
}

/**
 * Show a message in the terminal window.
 *
 * @param {string} backendID The ID of the backend that wants to show the
 *     message.
 * @param {string} message The message to be shown.
 */
UserIO.prototype.showMessage = function(backendID, message) {
  this.term_.io.println(`[agent '${backendID}'] ${message}`);
};

/**
 * Show a message in the terminal window and prompt the user for a string.
 *
 * @param {string} backendID The ID of the backend prompting the user.
 * @param {string} promptMessage The message that should precede the prompt.
 * @return {!Promise<string>|!Promise<void>} A promise resolving to the input
 *     if the user confirms it by pressing enter; a rejecting promise if the
 *     user cancels the prompt by pressing ESC.
 */
UserIO.prototype.promptUser = async function(backendID, promptMessage) {
  const io = this.term_.io.push();

  // Perform common cleanup tasks before exiting the prompt.
  const cleanup = () => {
    io.hideOverlay();
    io.pop();
    this.term_.focus();
  };

  const container = document.createElement('div');
  const header = document.createElement('div');
  header.style.fontWeight = 'bold';
  header.style.textAlign = 'center';
  header.textContent = `agent '${backendID}'`;
  container.appendChild(header);
  const prompt = document.createElement('div');
  prompt.textContent = promptMessage;
  container.appendChild(prompt);
  const input = document.createElement('input');
  input.type = 'password';
  input.ariaLabel = promptMessage;
  container.appendChild(input);

  const toggle = document.createElement('img');
  toggle.src = IMG_VISIBILITY_URI;
  toggle.style.cursor = 'pointer';
  toggle.style.verticalAlign = 'middle';
  toggle.addEventListener('click', (e) => {
    if (input.type === 'text') {
      input.type = 'password';
      toggle.src = IMG_VISIBILITY_URI;
    } else {
      input.type = 'text';
      toggle.src = IMG_VISIBILITY_OFF_URI;
    }
  });
  container.appendChild(toggle);

  io.showOverlay(container, null);

  // Force focus after the browser has a chance to render things.
  setTimeout(() => input.focus());

  // The terminal will eat all key events, so make sure we stop that.
  input.addEventListener('keyup', (e) => e.stopPropagation(), true);
  input.addEventListener('keypress', (e) => e.stopPropagation(), true);

  // If the terminal becomes active for some reason, force back to the input.
  io.onVTKeystroke = io.sendString = (string) => {
    input.focus();
  };

  return new Promise((resolve, reject) => {
    // Keep accepting input until they press Enter or Escape.
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        cleanup();
        resolve(input.value);
      } else if (e.key === 'Escape') {
        cleanup();
        reject();
      }
    }, true);
  });
};
