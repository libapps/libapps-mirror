// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Code for dealing with the specific message types used in
 * the SSH agent protocol.
 */

import {lib} from '../../libdot/index.js';

import {concatTyped} from './lib_array.js';
import {Message} from './nassh_agent_message.js';

/**
 * Types of requests/responses exchanged between client application and SSH
 * agent. All types are represented as 8-bit unsigned integers.
 *
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.5.1
 * @readonly
 * @enum {number}
 */
export const MessageNumbers = {
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
 *
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.1
 * @readonly
 * @const {!Message}
 */
export const SUCCESS = new Message(MessageNumbers.AGENT_SUCCESS);
export const FAILURE = new Message(MessageNumbers.AGENT_FAILURE);

/**
 * Map message types to reader function.
 *
 * @type {!Object<!MessageNumbers, function(!Message): !Message>}
 * @private
 */
const readers = {};

/**
 * Read the contents of a message into fields according to the format specified
 * by its type.
 *
 * @param {!Message} message
 * @return {?Message}
 */
export function readMessage(message) {
  if (readers.hasOwnProperty(message.type)) {
    try {
      return readers[message.type](message);
    } catch (e) {
      console.error(e);
      return null;
    }
  } else {
    console.warn(`messages.read: message number ${message.type} not supported`);
    return null;
  }
}

/**
 * Read an AGENTC_REQUEST_IDENTITIES request.
 *
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.4
 * @param {!Message} message A message of type AGENTC_REQUEST_IDENTITIES.
 * @return {!Message}
 */
readers[MessageNumbers.AGENTC_REQUEST_IDENTITIES] = function(message) {
  if (!message.eom()) {
    throw new Error(
        'AGENTC_REQUEST_IDENTITIES: message body longer than expected');
  }
  return message;
};

/**
 * Read an AGENTC_SIGN_REQUEST request.
 *
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.5
 * @param {!Message} message A message of type AGENTC_SIGN_REQUEST.
 * @return {!Message}
 */
readers[MessageNumbers.AGENTC_SIGN_REQUEST] = function(message) {
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
 * @param {!Message} message A message of type AGENT_PUBLIC_KEY_RESPONSE.
 * @return {!Message}
 */
readers[MessageNumbers.AGENT_PUBLIC_KEY_RESPONSE] = function(message) {
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

  const pk = new Message(
      // Stub zero value used.
      /** @type {!MessageNumbers} */ (0),
      message.fields.publicKeyRaw);
  message.fields.publicKeyAlgo =
      lib.codec.codeUnitArrayToString(pk.readString());
  if (message.fields.publicKeyAlgo.startsWith('ecdsa')) {
    message.fields.publicKeyCurve =
        lib.codec.codeUnitArrayToString(pk.readString());
    message.fields.publicKeyBytes = pk.readString();
    if (message.fields.publicKeyCurve == 'nistp256') {
      message.fields.publicKeyX = message.fields.publicKeyBytes.slice(1, 33);
      message.fields.publicKeyY = message.fields.publicKeyBytes.slice(33);
    }
  }

  return message;
};

/**
 * Map message types to writer function.
 *
 * @type {!Object<!MessageNumbers, function(...): !Message>}
 * @private
 */
const writers = {};

/**
 * Write a message of a given type.
 *
 * @param {!MessageNumbers} type
 * @param {...*} args Any number of arguments dictated by the type.
 * @return {!Message} A message of the given type encoding the
 *     supplied arguments.
 */
export function writeMessage(type, ...args) {
  if (writers.hasOwnProperty(type)) {
    try {
      return writers[type](...args);
    } catch (e) {
      console.error(e);
      return FAILURE;
    }
  } else {
    console.warn(`messages.write: message number ${type} not supported`);
    return FAILURE;
  }
}

/**
 * An SSH identity (public key), containing the wire encoding of the public key
 * and a UTF-8 encoded human-readable comment.
 *
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.4
 * @typedef {{keyBlob: !Uint8Array, comment: !Uint8Array}}
 */
export let Identity;

/**
 * Write an AGENT_IDENTITIES_ANSWER response.
 *
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.4
 * @param {!Array<!Identity>} identities An array of SSH identities.
 * @return {!Message}
 */
writers[MessageNumbers.AGENT_IDENTITIES_ANSWER] = function(identities) {
  const message = new Message(MessageNumbers.AGENT_IDENTITIES_ANSWER);
  message.writeUint32(identities.length);
  for (const identity of identities) {
    message.writeString(identity.keyBlob);
    message.writeString(identity.comment);
  }
  return message;
};

/**
 * Write an AGENT_SIGN_RESPONSE response.
 *
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.5
 * @param {!Uint8Array} signature The computed signature.
 * @return {!Message}
 */
writers[MessageNumbers.AGENT_SIGN_RESPONSE] = function(signature) {
  const message = new Message(MessageNumbers.AGENT_SIGN_RESPONSE);
  message.writeString(signature);
  return message;
};

/**
 * Write an AGENTC_SIGN_REQUEST response.
 *
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4.5
 * @param {!Uint8Array} keyBlob The public key.
 * @param {!Uint8Array} data The data to sign.
 * @param {number=} flags Command flags.
 * @return {!Message}
 */
writers[MessageNumbers.AGENTC_SIGN_REQUEST] = function(
    keyBlob, data, flags = 0) {
  const message = new Message(MessageNumbers.AGENTC_SIGN_REQUEST);
  message.writeString(keyBlob);
  message.writeString(data);
  message.writeUint32(flags);
  return message;
};

/**
 * Types of SSH identity keys.
 *
 * @readonly
 * @enum {number}
 */
export const KeyTypes = {
  RSA: 1,
  ECDSA: 19,
  EDDSA: 22,
};

/**
 * Decodes an ASN.1-encoded OID into human-readable dot notation.
 *
 * @param {!Uint8Array} asn1Bytes Individual bytes of an ASN.1-encoded OID.
 * @return {?string} The decoded human-readable OID; null if the byte
 *     representation is invalid.
 * @see https://docs.microsoft.com/en-us/windows/desktop/SecCertEnroll/about-object-identifier
 */
export function decodeOid(asn1Bytes) {
  if (asn1Bytes.length === 0) {
    return null;
  }

  let oid = Math.floor(asn1Bytes[0] / 40) + '.' + (asn1Bytes[0] % 40);

  let i = 1;
  while (i < asn1Bytes.length) {
    let acc = 0;
    do {
      acc = (acc << 7) + (asn1Bytes[i] & 0x7F);
      i++;
    } while ((asn1Bytes[i - 1] & 0x80) && (i < asn1Bytes.length));
    if ((asn1Bytes[i - 1] & 0x80) && (i === asn1Bytes.length)) {
      // The last byte in a multibyte sequence must not have the high bit set.
      return null;
    }
    oid += '.' + acc;
  }
  return oid;
}

/**
 * Information about an elliptic curve required to use it for SSH
 * authentication. This includes the prefix to be used in SSH agent responses
 * as well as the hash algorithm that should be applied to the raw challenge
 * before computing the signature (if any). The identifier of a NIST curve
 * appears twice in the public key blob and is thus specified separately. For
 * curves that are to be used with the PIV applet, the algorithm ID is
 * specified.
 *
 * @typedef {{
 *     prefix: string,
 *     identifier: string,
 *     hashAlgorithm: string,
 *     pivAlgorithmId: string,
 * }}
 */
const CurveInfo = undefined;

/**
 * Map OIDs to information about their associated elliptic curve.
 *
 * @type {!Object<string, !CurveInfo>}
 * @see https://tools.ietf.org/html/rfc5656
 * @see https://tools.ietf.org/html/draft-ietf-curdle-ssh-ed25519-02
 * @see https://tools.ietf.org/id/draft-koch-eddsa-for-openpgp-03.html#rfc.section.6
 */
export const OidToCurveInfo = {
  '1.2.840.10045.3.1.7': {
    prefix: 'ecdsa-sha2-',
    identifier: 'nistp256',
    hashAlgorithm: 'SHA-256',
    pivAlgorithmId: 0x11,
  },
  '1.3.132.0.34': {
    prefix: 'ecdsa-sha2-',
    identifier: 'nistp384',
    hashAlgorithm: 'SHA-384',
    pivAlgorithmId: 0x14,
  },
  '1.3.132.0.35': {
    prefix: 'ecdsa-sha2-',
    identifier: 'nistp521',
    hashAlgorithm: 'SHA-512',
  },
  '1.3.6.1.4.1.11591.15.1': {
    prefix: 'ssh-ed25519',
  },
};

/**
 * Decodes an ASN.1-encoded OID designating an elliptic curve into human-
 * readable dot notation, taking into account that some hardware tokens by
 * specific vendors are known to return incorrect OIDs that require further
 * processing to become valid.
 *
 * Currently, this function takes the following quirks into account:
 * - The OpenPGP applet of a Yubikey with firmware version below 5.2.8 appends
 *   a potentially arbitrary byte to the intended byte representation of an ECC
 *   curve OID. This case is handled by retrying the decoding with the last
 *   byte stripped if the resulting OID does not label a known curve. This fix
 *   applies to all readers that contain "yubikey" in their name (case-
 *   insensitively).
 *
 * @param {!Uint8Array} asn1Bytes Individual bytes of an ASN.1-encoded OID as
 *     returned by the specified reader (i.e., hardware token).
 * @param {?string} reader The name of the reader (i.e., hardware token), which
 *     determines the set of fixes to apply.
 * @return {?string} The decoded human-readable OID; null if the byte
 *     representation is invalid.
 * @see https://docs.microsoft.com/en-us/windows/desktop/SecCertEnroll/about-object-identifier
 * @see https://crbug.com/1120933#c10:
 */
export function decodeCurveOidWithVendorFixes(asn1Bytes, reader) {
  let curveOid = decodeOid(asn1Bytes);
  if (!(curveOid in OidToCurveInfo) &&
      reader != null &&
      reader.toLowerCase().includes('yubikey') &&
      asn1Bytes.length > 0) {
    // https://crbug.com/1120933#c10:
    // Certain Yubikeys (those with firmware version below 5.2.8) may
    // return an additional uninitialized byte with the OID that should
    // be ignored. Since there are no curve OIDs that are prefixes of
    // other valid curve OIDs, we get by without detecting the firmware
    // version explicitly.
    curveOid = decodeOid(asn1Bytes.slice(0, -1));
  }
  return curveOid;
}

/**
 * Map key types to generator function.
 *
 * @type {!Object<!KeyTypes, function(...): !Uint8Array>}
 * @private
 */
const keyBlobGenerators = {};

/**
 * Generate a key blob of a given type.
 *
 * @param {!KeyTypes} keyType
 * @param {...*} args Any number of arguments dictated by the key blob type.
 * @return {!Uint8Array} A key blob for use in the SSH agent protocol.
 */
export function generateKeyBlob(keyType, ...args) {
  if (keyBlobGenerators.hasOwnProperty(keyType)) {
    return keyBlobGenerators[keyType](...args);
  } else {
    throw new Error(
        `messages.generateKeyBlob: key type ${keyType} not supported`);
  }
}

/**
 * Encode a byte array as a 'string' on the wire.
 *
 * @see https://tools.ietf.org/html/rfc4251#section-5
 * @param {!Uint8Array} bytes Raw bytes.
 * @return {!Uint8Array} Wire encoding as a string.
 */
export function encodeAsWireString(bytes) {
  const data = new Uint8Array(4 + bytes.length);
  const view = new DataView(data.buffer);
  view.setUint32(0, bytes.length);
  data.set(bytes, 4);
  return data;
}

/**
 * Encode an unsigned integer as an 'mpint' on the wire.
 *
 * @see https://tools.ietf.org/html/rfc4251#section-5
 * @param {!Uint8Array} bytes Raw bytes of an unsigned integer.
 * @return {!Uint8Array} Wire encoding as an mpint.
 */
export function encodeAsWireMpint(bytes) {
  // Strip leading zeros.
  let pos = 0;
  while (pos < bytes.length && !bytes[pos]) {
    ++pos;
  }
  let mpint = bytes.subarray(pos);

  // Add a leading zero if the positive result would otherwise be treated as a
  // signed mpint.
  if (mpint.length && (mpint[0] & (1 << 7))) {
    mpint = concatTyped(new Uint8Array([0]), mpint);
  }

  return encodeAsWireString(mpint);
}

/**
 * Generate a key blob for a public key of type 'ssh-rsa'.
 *
 * @see https://www.ietf.org/rfc/rfc4253
 * @param {!Uint8Array} exponent The public exponent as an unsigned integer
 *     (big endian).
 * @param {!Uint8Array} modulus The modulus as an unsigned integer (big
 *     endian).
 * @return {!Uint8Array} A key blob for use in the SSH agent protocol.
 */
keyBlobGenerators[KeyTypes.RSA] = function(exponent, modulus) {
  const exponentMpint = encodeAsWireMpint(exponent);
  const modulusMpint = encodeAsWireMpint(modulus);
  const BYTES_SSH_RSA = new TextEncoder().encode('ssh-rsa');
  return concatTyped(
      encodeAsWireString(BYTES_SSH_RSA),
      exponentMpint,
      modulusMpint,
  );
};

/**
 * Generate a key blob for an ECDSA public key.
 *
 * @param {string} curveOid The OID of the elliptic curve.
 * @param {!Uint8Array} key The public key.
 * @return {!Uint8Array} A key blob for use in the SSH agent protocol.
 * @throws Will throw if curveOid represents an unsupported curve.
 * @see https://tools.ietf.org/html/rfc5656#section-3.1
 */
keyBlobGenerators[KeyTypes.ECDSA] = function(curveOid, key) {
  if (!(curveOid in OidToCurveInfo)) {
    throw new Error(
        `SmartCardManager.fetchKeyInfo: unsupported curve OID: ${curveOid}`);
  }
  const prefix = new TextEncoder().encode(OidToCurveInfo[curveOid].prefix);
  const identifier =
      new TextEncoder().encode(OidToCurveInfo[curveOid].identifier);
  return concatTyped(
      encodeAsWireString(concatTyped(prefix, identifier)),
      encodeAsWireString(identifier),
      encodeAsWireString(key));
};

/**
 * Generate a key blob for an EDDSA public key.
 *
 * @param {string} curveOid The OID of the elliptic curve.
 * @param {!Uint8Array} key The public key.
 * @return {!Uint8Array} A key blob for use in the SSH agent protocol.
 * @throws Will throw if curveOid represents an unsupported curve.
 * @see https://tools.ietf.org/html/draft-ietf-curdle-ssh-ed25519-02#section-4
 */
keyBlobGenerators[KeyTypes.EDDSA] = function(curveOid, key) {
  if (!(curveOid in OidToCurveInfo)) {
    throw new Error(
        `SmartCardManager.fetchKeyInfo: unsupported curve OID: ${curveOid}`);
  }
  const prefix = new TextEncoder().encode(OidToCurveInfo[curveOid].prefix);
  return concatTyped(encodeAsWireString(prefix), encodeAsWireString(key));
};
