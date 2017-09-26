// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview An SSH agent that aggregates responses from multiple
 * dynamically loaded backends.
 */

/**
 * Map backend IDs to the respective classes inheriting from
 * nassh.agent.Backend.
 *
 * @type {!Object<!string, !function(new:nassh.agent.Backend)>}
 * @private
 */
nassh.agent.registeredBackends_ = {};

/**
 * Used by a backend to register itself with the agent.
 *
 * @param {!function(new:nassh.agent.Backend)} backendClass
 */
nassh.agent.registerBackend = function(backendClass) {
  nassh.agent.registeredBackends_[backendClass.prototype.BACKEND_ID] =
      backendClass;
};

/**
 * Check whether a list of backend IDs is valid.
 *
 * @param {!Array<!string>} backendIDs
 *
 * @returns {!Array<!boolean>} An array of the same length as backendIDs, where
 *     an entry is true if and only if its backend ID corresponds to a
 *     registered backend.
 */
nassh.agent.checkBackendIDs = function(backendIDs) {
  return backendIDs.map(
      (backendID) => nassh.agent.registeredBackends_.hasOwnProperty(backendID));
};

/**
 * Manage multiples SSH agent backends and aggregates their results.
 *
 * @param {!Array<!string>} backendIDs An array of IDs of backends which should
 *     be used by the agent to reply to incoming requests.
 * @param {!hterm.Terminal} term Reference to hterm.
 * @constructor
 */
nassh.agent.Agent = function(backendIDs, term) {
  console.log(
      'agent.Agent: registered backends:', nassh.agent.registeredBackends_);

  /**
   * The collection of instantiated backends that the agent is using to respond
   * to requests.
   *
   * @member {!Array<!nassh.agent.Backend>}
   * @private
   */
  this.backends_ =
      backendIDs
          .map((backendID) => {
            if (nassh.agent.registeredBackends_.hasOwnProperty(backendID)) {
              console.log(`agent.Agent: loading backend '${backendID}'`);
              return new nassh.agent.registeredBackends_[backendID](
                  new nassh.agent.Agent.UserIO(term));
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
   * @member {!Object<!string, !nassh.agent.Backend>}
   * @private
   */
  this.idToBackend_ = {};
  for (const backend of this.backends_) {
    this.idToBackend_[backend.BACKEND_ID] = backend;
  }

  /**
   * Map a string representation of an identity's key blob to the ID of the
   * backend that provides it.
   *
   * @member {!Object<!string, !string>}
   * @private
   */
  this.identityToBackendID_ = {};
};

/**
 * Initialize all backends by calling their ping function.
 *
 * @returns {!Promise<void>} A resolving promise if all backends initialized
 *     successfully; a rejecting promise otherwise.
 */
nassh.agent.Agent.prototype.ping = function() {
  return Promise.all(this.backends_.map((backend) => backend.ping()));
};

/**
 * Delegate handling a raw SSH agent request to a registered request handler.
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.3
 *
 * @param {!Uint8Array} rawRequest The bytes of a raw request.
 *
 * @returns {!Promise<!nassh.agent.Message>} A Message object containing the
 *     aggregate responses of all backends.
 */
nassh.agent.Agent.prototype.handleRequest = function(rawRequest) {
  const request = nassh.agent.Message.fromRawMessage(rawRequest);
  if (!request) {
    console.error('Agent.handleRequest: invalid request', rawRequest);
    return Promise.resolve(nassh.agent.messages.FAILURE);
  } else
    return this.handleRequest_(request);
};

/**
 * Map message (request) types to handler functions.
 *
 * @type {Object<nassh.agent.messages.Numbers, function(this:nassh.agent.Agent,
 *     !nassh.agent.Message): !nassh.agent.Message>}
 * @private
 */
nassh.agent.Agent.prototype.requestHandlers_ = {};
nassh.agent.Agent.prototype.handleRequest_ = function(request) {
  if (this.requestHandlers_.hasOwnProperty(request.type)) {
    return this.requestHandlers_[request.type]
        .call(this, request)
        .catch(function(e) {
          console.error(e);
          return nassh.agent.messages.FAILURE;
        });
  } else {
    console.error(
        `Agent.handleRequest: message number ${request.type} not supported`);
    return Promise.resolve(nassh.agent.messages.FAILURE);
  }
};

/**
 * Convert a raw SSH key blob to the format used in authorized_keys files.
 * @param {!Uint8Array} keyBlob The raw key blob.
 * @returns {!string}
 */
nassh.agent.Agent.keyBlobToAuthorizedKeysFormat = function(keyBlob) {
  const keyBlobBase64 = btoa(String.fromCharCode(...keyBlob));
  // Extract and prepend key type prefix.
  const prefixLength = lib.array.arrayBigEndianToUint32(keyBlob);
  const prefix = String.fromCharCode(...keyBlob.slice(4, 4 + prefixLength));
  return `${prefix} ${keyBlobBase64}`;
};

/**
 * Handle an AGENTC_REQUEST_IDENTITIES request by responding with an
 * AGENT_IDENTITIES_ANSWER.
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.4
 *
 * @returns {!Promise<!nassh.agent.Message>}
 */
nassh.agent.Agent.prototype
    .requestHandlers_[nassh.agent.messages.Numbers.AGENTC_REQUEST_IDENTITIES] =
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
                                   new TextDecoder('utf-8').decode(
                                       identity.keyBlob);
                               // Print the public key blob (in the format used
                               // for ~/.authorized_keys) to the console as a
                               // courtesy to the user.
                               console.log(
                                   'Public key to be added as a new line to ' +
                                   '~/.ssh/authorized_keys on the server:\n' +
                                   nassh.agent.Agent
                                   .keyBlobToAuthorizedKeysFormat(
                                       identity.keyBlob));
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
      .then(
          (identities) => nassh.agent.messages.write(
              nassh.agent.messages.Numbers.AGENT_IDENTITIES_ANSWER,
              identities));
};

/**
 * Handle an AGENTC_SIGN_REQUEST request by responding with an
 * AGENT_SIGN_RESPONSE.
 *
 * @param {nassh.agent.Message} request The request as a Message object.
 * @returns {Promise<nassh.agent.Message>}
 */
nassh.agent.Agent.prototype
    .requestHandlers_[nassh.agent.messages.Numbers.AGENTC_SIGN_REQUEST] =
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
      .then(
          (signature) => nassh.agent.messages.write(
              nassh.agent.messages.Numbers.AGENT_SIGN_RESPONSE, signature));
};

/**
 * Provide helper functions for terminal IO tasks needed by backends.
 *
 * @param {!hterm.Terminal} term Reference to the current terminal.
 * @constructor
 */
nassh.agent.Agent.UserIO = function(term) {
  /**
   * Reference to the current terminal.
   *
   * @member {!hterm.Terminal}
   * @private
   */
  this.term_ = term;
};

/**
 * Show a message in the terminal window.
 *
 * @param {!string} backendID The ID of the backend that wants to show the
 *     message.
 * @param {!string} message The message to be shown.
 */
nassh.agent.Agent.UserIO.prototype.showMessage = function(backendID, message) {
  this.term_.io.println(`[agent '${backendID}'] ${message}`);
};

/**
 * Show a message in the terminal window and prompt the user for a string.
 *
 * @param {!string} backendID The ID of the backend prompting the user.
 * @param {!string} promptMessage The message that should precede the prompt.
 * @returns {!Promise<!string>|!Promise<void>} A promise resolving to the input
 *     if the user confirms it by pressing enter; a rejecting promise if the
 *     user cancels the prompt by pressing ESC.
 */
nassh.agent.Agent.UserIO.prototype.promptUser =
    async function(backendID, promptMessage) {
  const io = this.term_.io.push();
  const leaveIO = () => {
    io.println('');
    this.term_.io.pop();
  };

  io.print(`[agent '${backendID}'] ${promptMessage}`);
  return new Promise(function(resolve, reject) {
    let input = '';
    // Allow pasting.
    io.sendString = (str) => input += str;
    io.onVTKeystroke = (ch) => {
      switch (ch) {
        case '\x1b':  // ESC
          leaveIO();
          reject();
          break;
        case '\r':  // enter
          leaveIO();
          resolve(input);
          break;
        case '\b':    // backspace
        case '\x7F':  // delete
          input = input.slice(0, -1);
          break;
        default:
          input += ch;
          break;
      }
    };
  });
};
