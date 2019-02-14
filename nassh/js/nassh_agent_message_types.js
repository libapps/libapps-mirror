// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Code for dealing with the specific message types used in
 * the SSH agent protocol.
 */

nassh.agent.messages = {};

/**
 * Types of requests/responses exchanged between client application and SSH
 * agent. All types are represented as 8-bit unsigned integers.
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.5.1
 *
 * @readonly
 * @enum {!number}
 */
nassh.agent.messages.Numbers = {
  AGENT_FAILURE: 5,
  AGENT_SUCCESS: 6,
  AGENTC_REQUEST_IDENTITIES: 11,
  AGENT_IDENTITIES_ANSWER: 12,
  AGENTC_SIGN_REQUEST: 13,
  AGENT_SIGN_RESPONSE: 14,
  AGENT_PUBLIC_KEY_RESPONSE: 114,
};

/**
 * Generic agent responses.
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.1
 *
 * @readonly
 * @const {!nassh.agent.Message}
 */
nassh.agent.messages.SUCCESS =
    new nassh.agent.Message(nassh.agent.messages.Numbers.AGENT_SUCCESS);
nassh.agent.messages.FAILURE =
    new nassh.agent.Message(nassh.agent.messages.Numbers.AGENT_FAILURE);

/**
 * Map message types to reader function.
 *
 * @type {Object<!nassh.agent.messages.Numbers, function(!nassh.agent.Message):
 *     void>}
 * @private
 */
nassh.agent.messages.readers_ = {};

/**
 * Read the contents of a message into fields according to the format specified
 * by its type.
 *
 * @param {nassh.agent.Message} message
 */
nassh.agent.messages.read = function(message) {
  if (nassh.agent.messages.readers_.hasOwnProperty(message.type)) {
    try {
      return nassh.agent.messages.readers_[message.type](message);
    } catch (e) {
      console.error(e);
      return null;
    }
  } else {
    console.warn(`messages.read: message number ${message.type} not supported`);
    return null;
  }
};

/**
 * Read an AGENTC_REQUEST_IDENTITIES request.
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.4
 *
 * @param {!nassh.agent.Message} message A message of type
 *     AGENTC_REQUEST_IDENTITIES.
 */
nassh.agent.messages
    .readers_[nassh.agent.messages.Numbers.AGENTC_REQUEST_IDENTITIES] =
    function(message) {
  if (!message.eom()) {
    throw new Error(
        'AGENTC_REQUEST_IDENTITIES: message body longer than expected');
  }
  return message;
};

/**
 * Read an AGENTC_SIGN_REQUEST request.
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.5
 *
 * @param {!nassh.agent.Message} message A message of type AGENTC_SIGN_REQUEST.
 */
nassh.agent.messages
    .readers_[nassh.agent.messages.Numbers.AGENTC_SIGN_REQUEST] = function(
    message) {
  message.fields.keyBlob = message.readString();
  message.fields.data = message.readString();
  message.fields.flags = message.readUint32();
  if (!message.eom()) {
    throw new Error('AGENTC_SIGN_REQUEST: message body longer than expected');
  }
  return message;
};

/**
 * Read an AGENT_PUBLIC_KEY_RESPONSE request.
 *
 * This is a Google extension.
 *
 * @param {!nassh.agent.Message} message A message of type AGENT_PUBLIC_KEY_RESPONSE.
 */
nassh.agent.messages
    .readers_[nassh.agent.messages.Numbers.AGENT_PUBLIC_KEY_RESPONSE] =
    function(message) {
  // SSH_AGENTC_PUBLIC_KEY_RESPONSE packet format.
  //   byte    code
  //   uint32  num_records
  //   string  challenge
  //   string  publickey
  //   string  ecdh
  //   string  devicekey
  //   string  devicefp
  //   string  signature_format
  //   string  signature_blob
  //   string  meta

  message.fields.numRecords = message.readUint32();
  message.fields.challenge = message.readString();
  message.fields.publicKeyRaw = message.readString();
  message.fields.ecdh = message.readString();
  message.fields.deviceKey = message.readString();
  message.fields.deviceFp = message.readString();
  message.fields.signature = message.readString();
  if (!message.eom()) {
    message.fields.meta = message.readString();
  } else {
    message.fields.meta = [];
  }
  if (!message.eom()) {
    throw new Error(
        'AGENT_PUBLIC_KEY_RESPONSE: message body longer than expected');
  }

  const pk = new nassh.agent.Message(0, message.fields.publicKeyRaw);
  message.fields.publicKeyAlgo =
      lib.codec.codeUnitArrayToString(pk.readString());
  if (message.fields.publicKeyAlgo.startsWith('ecdsa')) {
    message.fields.publicKeyCurve =
        lib.codec.codeUnitArrayToString(pk.readString());
    message.fields.publicKeyBytes = pk.readString();
    if (message.fields.publicKeyCurve == 'nistp256') {
      const p256 = new nassh.agent.Message(0, message.fields.publicKeyBytes);
      message.fields.publicKeyX = message.fields.publicKeyBytes.slice(1, 33);
      message.fields.publicKeyY = message.fields.publicKeyBytes.slice(33);
    }
  }

  return message;
};

/**
 * Map message types to writer function.
 *
 * @type {Object<!nassh.agent.messages.Numbers, function(...[*]):
 *     !nassh.agent.Message>}
 * @private
 */
nassh.agent.messages.writers_ = {};

/**
 * Write a message of a given type.
 *
 * @param {!nassh.agent.messages.Numbers} type
 * @param {...*} args Any number of arguments dictated by the type.
 * @returns {!nassh.agent.Message} A message of the given type encoding the
 *     supplied arguments.
 */
nassh.agent.messages.write = function(type, ...args) {
  if (nassh.agent.messages.writers_.hasOwnProperty(type)) {
    try {
      return nassh.agent.messages.writers_[type](...args);
    } catch (e) {
      console.error(e);
      return nassh.agent.messages.FAILURE;
    }
  } else {
    console.warn(`messages.write: message number ${type} not supported`);
    return nassh.agent.messages.FAILURE;
  }
};

/**
 * An SSH identity (public key), containing the wire encoding of the public key
 * and a UTF-8 encoded human-readable comment.
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.4
 *
 * @typedef {{keyBlob: !Uint8Array, comment: !Uint8Array}} Identity
 */

/**
 * Write an AGENT_IDENTITIES_ANSWER response.
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.4
 *
 * @param {!Array<!Identity>} identities An array of SSH identities.
 * @returns {!nassh.agent.Message}
 */
nassh.agent.messages
    .writers_[nassh.agent.messages.Numbers.AGENT_IDENTITIES_ANSWER] = function(
    identities) {
  const message = new nassh.agent.Message(
      nassh.agent.messages.Numbers.AGENT_IDENTITIES_ANSWER);
  message.writeUint32(identities.length);
  for (const identity of identities) {
    message.writeString(identity.keyBlob);
    message.writeString(identity.comment);
  }
  return message;
};

/**
 * Write an AGENT_SIGN_RESPONSE response.
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.5
 *
 * @param {!Uint8Array} signature The computed signature.
 * @returns {!nassh.agent.Message}
 */
nassh.agent.messages
    .writers_[nassh.agent.messages.Numbers.AGENT_SIGN_RESPONSE] = function(
    signature) {
  const message =
      new nassh.agent.Message(nassh.agent.messages.Numbers.AGENT_SIGN_RESPONSE);
  message.writeString(signature);
  return message;
};

/**
 * Write an AGENTC_SIGN_REQUEST response.
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.5
 *
 * @param {!Uint8Array} keyBlob The public key.
 * @param {!Uint8Array} data The data to sign.
 * @param {number=} flags Command flags.
 * @returns {!nassh.agent.Message}
 */
nassh.agent.messages
    .writers_[nassh.agent.messages.Numbers.AGENTC_SIGN_REQUEST] = function(
    keyBlob, data, flags=0) {
  const message =
      new nassh.agent.Message(nassh.agent.messages.Numbers.AGENTC_SIGN_REQUEST);
  message.writeString(keyBlob);
  message.writeString(data);
  message.writeUint32(flags);
  return message;
};

/**
 * Types of SSH identity key blobs.
 *
 * @readonly
 * @enum {!number}
 */
nassh.agent.messages.KeyBlobTypes = {
  SSH_RSA: 1,
};

/**
 * Map key blob types to generator function.
 *
 * @type {Object<!nassh.agent.messages.KeyBlobTypes,
 *     function(...[*]): !Uint8Arrays>}
 * @private
 */
nassh.agent.messages.keyBlobGenerators_ = {};

/**
 * Generate a key blob of a given type.
 *
 * @param {!nassh.agent.messages.KeyBlobTypes} type
 * @param {...*} args Any number of arguments dictated by the key blob type.
 * @returns {!Uint8Array} A key blob for use in the SSH agent protocol.
 */
nassh.agent.messages.generateKeyBlob = function(keyBlobType, ...args) {
  if (nassh.agent.messages.keyBlobGenerators_.hasOwnProperty(keyBlobType)) {
    return nassh.agent.messages.keyBlobGenerators_[keyBlobType](...args);
  } else {
    throw new Error(
        `messages.generateKeyBlob: key blob type ${keyBlobType} not supported`);
  }
};

/**
 * Encode a byte array as a 'string' on the wire.
 * @see https://tools.ietf.org/html/rfc4251#section-5
 *
 * @param {!Uint8Array} bytes Raw bytes.
 * @returns {!Uint8Array} Wire encoding as a string.
 */
nassh.agent.messages.encodeAsWireString = function(bytes) {
  const data = new Uint8Array(4 + bytes.length);
  const view = new DataView(data.buffer);
  view.setUint32(0, bytes.length);
  data.set(bytes, 4);
  return data;
};

/**
 * Encode an unsigned integer as an 'mpint' on the wire.
 * @see https://tools.ietf.org/html/rfc4251#section-5
 *
 * @param {!Uint8Array} bytes Raw bytes of an unsigned integer.
 * @returns {!Uint8Array} Wire encoding as an mpint.
 */
nassh.agent.messages.encodeAsWireMpint = function(bytes) {
  // Strip leading zeros.
  let pos = 0;
  while (pos < bytes.length && !bytes[pos]) {
    ++pos;
  }
  let mpint = bytes.subarray(pos);

  // Add a leading zero if the positive result would otherwise be treated as a
  // signed mpint.
  if (mpint.length && (mpint[0] & (1 << 7))) {
    mpint = lib.array.concatTyped(new Uint8Array([0]), mpint);
  }

  return nassh.agent.messages.encodeAsWireString(mpint);
};

/**
 * Generate a key blob for a public key of type 'ssh-rsa'.
 * @see https://www.ietf.org/rfc/rfc4253
 *
 * @param {!Uint8Array} exponent The public exponent as an unsigned integer
 *     (big endian).
 * @param {!Uint8Array} modulus The modulus as an unsigned integer (big
 *     endian).
 * @returns {!Uint8Array} A key blob for use in the SSH agent protocol.
 */
nassh.agent.messages
    .keyBlobGenerators_[nassh.agent.messages.KeyBlobTypes.SSH_RSA] = function(
    exponent, modulus) {
  const exponentMpint = nassh.agent.messages.encodeAsWireMpint(exponent);
  const modulusMpint = nassh.agent.messages.encodeAsWireMpint(modulus);
  const BYTES_SSH_RSA = new TextEncoder().encode('ssh-rsa');
  return lib.array.concatTyped(
      nassh.agent.messages.encodeAsWireString(BYTES_SSH_RSA),
      exponentMpint,
      modulusMpint,
  );
};
