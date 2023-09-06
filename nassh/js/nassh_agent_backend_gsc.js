// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview An SSH agent backend that supports private keys stored on smart
 * cards, using the Google Smart Card Connector app.
 *
 * Note: A single API context with the Google Smart Card Connector Client
 * library is retained on file scope level and shared among all instances of
 * the backend.
 *
 * @suppress {moduleLoad}
 */

import {lib} from '../../libdot/index.js';

import {asn1js, pkijs} from './deps_pkijs.rollup.js';

import {concatTyped, compare} from './lib_array.js';
import {CredentialCache} from './lib_credential_cache.js';
import {localize} from './nassh.js';
import {UserIO} from './nassh_agent.js';
import {Backend} from './nassh_agent_backend.js';
import {
  decodeCurveOidWithVendorFixes, encodeAsWireMpint, encodeAsWireString,
  generateKeyBlob, KeyTypes, Identity, OidToCurveInfo,
} from './nassh_agent_message_types.js';
import {
  GoogleSmartCard,
} from '../third_party/google-smart-card/google-smart-card-client-library.js';

/**
 * An SSH agent backend that uses the Google Smart Card Connector library to
 * perform SSH authentication using private keys stored on smart cards.
 *
 * @param {!UserIO} userIO Reference to object with terminal IO functions.
 * @param {boolean} isForwarded Whether the agent is being forwarded to the
 *     server.
 * @constructor
 * @extends {Backend}
 */
export function GSC(userIO, isForwarded) {
  Backend.apply(this, [userIO]);

  /**
   * Map a string representation of an identity's key blob to the reader that
   * provides it.
   *
   * @member {!Object<string, {reader: string, readerKeyId: !Uint8Array,
   *     applet: !SmartCardManager.CardApplets}>}
   * @private
   */
  this.keyBlobToReader_ = {};

  /**
   * The cache used to offer smart card PIN caching to the user.
   *
   * @private {!CredentialCache}
   * @const
   */
  this.pinCache_ = new CredentialCache();
  if (!isForwarded) {
    this.pinCache_.setEnabled(false);
  }
}

GSC.prototype = Object.create(Backend.prototype);
/** @override */
GSC.constructor = GSC;

/**
 * The unique ID of the backend.
 *
 * @const {string}
 * @override
 */
GSC.prototype.BACKEND_ID = 'gsc';

/**
 * The title of the app (used for logging purposes by the GSC library).
 *
 * @readonly
 * @const {string}
 */
const CLIENT_TITLE = 'nassh';

/**
 * The ID of the official Google Smart Card Connector app.
 *
 * @readonly
 * @const {string}
 */
const SERVER_APP_ID =
    GoogleSmartCard.PcscLiteCommon.Constants.SERVER_OFFICIAL_APP_ID;

/**
 * The PC/SC-Lite compatible API used in the current GSC context.
 *
 * @type {?GoogleSmartCard.PcscLiteClient.API}
 */
GSC.API = null;

/**
 * The context for communication with the Google Smart Card Connector app.
 *
 * @type {?GoogleSmartCard.PcscLiteClient.Context}
 */
GSC.APIContext = null;

// clang-format off
/**
 * Constants for the hash functions as used with an RSA key and the
 * EMSA-PKCS1-v1_5 encoding in the SSH agent protocol.
 *
 * @see https://tools.ietf.org/html/rfc4880#section-5.2.2
 * @see https://tools.ietf.org/html/draft-ietf-curdle-rsa-sha2-00#section-2
 *
 * @readonly
 * @enum {{name:string, identifier:!Uint8Array, signaturePrefix:!Uint8Array}}
 */
const HashAlgorithms = {
  SHA1: {
    name: 'SHA-1',
    identifier: new Uint8Array([
      0x30, 0x21, 0x30, 0x09, 0x06, 0x05, 0x2b, 0x0E, 0x03, 0x02,
      0x1A, 0x05, 0x00, 0x04, 0x14,
    ]),
    signaturePrefix: new Uint8Array(/* 'ssh-rsa' */[
      0x73, 0x73, 0x68, 0x2d, 0x72, 0x73, 0x61,
    ]),
  },
  SHA256: {
    name: 'SHA-256',
    identifier: new Uint8Array([
      0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01,
      0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20,
    ]),
    signaturePrefix: new Uint8Array(/* 'rsa-sha2-256' */[
      0x72, 0x73, 0x61, 0x2d, 0x73, 0x68, 0x61, 0x32, 0x2d, 0x32,
      0x35, 0x36,
    ]),
  },
  SHA512: {
    name: 'SHA-512',
    identifier: new Uint8Array([
      0x30, 0x51, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01,
      0x65, 0x03, 0x04, 0x02, 0x03, 0x05, 0x00, 0x04, 0x40,
    ]),
    signaturePrefix: new Uint8Array(/* 'rsa-sha2-512' */[
      0x72, 0x73, 0x61, 0x2d, 0x73, 0x68, 0x61, 0x32, 0x2d, 0x35,
      0x31, 0x32,
    ]),
  },
};
// clang-format on

/**
 * Initialize the Google Smart Card Connector library context on first use.
 *
 * @return {!Promise<void>} A resolving Promise if the
 *     initialization succeeded; a rejecting Promise otherwise.
 * @override
 */
GSC.prototype.ping = async function() {
  try {
    await GSC.initializeAPIContext();
  } catch (e) {
    this.showMessage(localize(
        'SMART_CARD_CONNECTOR_NOT_INSTALLED',
        ['https://chrome.google.com/webstore/detail/' +
         'khpfeaanjngmcnplbdlpegiifgpfgdco']));
    throw e;
  }
};

/**
 * Retrieve a list of SSH identities from a connected reader.
 *
 * If the backend fails to retrieve the identities from the reader, this reader
 * will be skipped without interrupting the identity retrieval from other
 * readers. Blocked devices will also be skipped. The backend remembers which
 * key blobs were obtained from which reader.
 *
 * @param {!Object<string, {
 *       reader: string, readerKeyId: !Uint8Array,
 *       applet: !SmartCardManager.CardApplets}>
 *     } keyBlobToReader Maps SSH identities to the readers and applets they
 *     have been retrieved from for later use by signRequest.
 * @param {string} reader The name of the reader to connect to.
 * @return {!Promise<!Array<!Identity>>} A Promise resolving to a list of SSH
 *     identities.
 */
GSC.prototype.requestReaderIdentities_ =
    async function(keyBlobToReader, reader) {
  const manager = new SmartCardManager();
  const identities = [];
  try {
    await manager.establishContext();
    for (const applet
             of [SmartCardManager.CardApplets.OPENPGP,
                 SmartCardManager.CardApplets.PIV]) {
      // Force reconnect to change applet.
      await manager.disconnect();
      await manager.connect(reader);
      try {
        await manager.selectApplet(applet);
        // Exclude blocked readers.
        if (await manager.fetchPINVerificationTriesRemaining() === 0) {
          console.error(
              `GSC.requestIdentities: skipping blocked reader ${reader}`);
          return [];
        }
        const readerKeyBlob = await manager.fetchPublicKeyBlob();
        const readerKeyId = await manager.fetchAuthenticationPublicKeyId();
        const readerKeyBlobStr = new TextDecoder().decode(readerKeyBlob);
        keyBlobToReader[readerKeyBlobStr] = {reader, readerKeyId, applet};
        identities.push({
          keyBlob: readerKeyBlob,
          comment: new Uint8Array([]),
        });
      } catch (e) {
        // Skip non-supported or uninitialized applets instead of raising an
        // exception.
        continue;
      }
    }
    return identities;
  } catch (e) {
    console.error(e);
    console.error(
        `GSC.requestIdentities: failed to get public key ID from ` +
        `reader ${reader}, skipping`);
    return [];
  } finally {
    await manager.disconnect();
    await manager.releaseContext();
  }
};

/**
 * Retrieve a list of SSH identities from all connected readers and all applets.
 *
 * If the backend fails to retrieve the identities from a reader, this reader
 * will be skipped without interrupting the identity retrieval from other
 * readers. Blocked devices will also be skipped. The backend remembers which
 * key blobs were obtained from which reader.
 *
 * @return {!Promise<!Array<!Identity>>} A Promise resolving to a list of SSH
 *     identities; a rejecting Promise if the connected readers could not be
 *     listed or some other error occurred.
 * @override
 */
GSC.prototype.requestIdentities = async function() {
  // Written to this.keyBlobToReader_ in the end to prevent asynchronous
  // overwrites from leaving it in an inconsistent state.
  const keyBlobToReader = {};

  const manager = new SmartCardManager();
  let readers;
  try {
    await manager.establishContext();
    readers = await manager.listReaders();
  } finally {
    await manager.releaseContext();
  }
  const identityArrays = await Promise.all(
      readers.map(this.requestReaderIdentities_.bind(this, keyBlobToReader)));

  this.keyBlobToReader_ = keyBlobToReader;
  return [].concat(...identityArrays);
};

/**
 * Request a smart card PIN from the user.
 *
 * This uses hterm's subcommand support to temporarily take over control of the
 * terminal.
 *
 * @param {string} reader The name of the reader for which the user will be
 *     asked to provide the PIN.
 * @param {!Uint8Array} readerKeyId The ID of the key for which the user will
 *     be asked to provide the PIN.
 * @param {string} appletName The name of the applet on the card (OpenPGP or
 *     PIV) that provides the key.
 * @param {number} numTries The number of PIN attempts the user has left.
 * @return {!Promise<string>} A promise resolving to the PIN
 *     entered by the user; a rejecting promise if the user cancelled the PIN
 *     entry.
 */
GSC.prototype.requestPIN = async function(
    reader, readerKeyId, appletName, numTries) {
  // Show 8 hex character (4 byte) fingerprint to the user.
  const shortFingerprint = arrayToHexString(readerKeyId.slice(-4));
  return this.promptUser(localize(
      'REQUEST_PIN_PROMPT', [shortFingerprint, reader, appletName, numTries]));
};

/**
 * Unlock a key on a connected smart card reader and request the PIN from
 * the user (or the cache).
 *
 * @param {!SmartCardManager} manager A SmartCardManager object connected to the
 *     reader on which the specified key resides.
 * @param {!Uint8Array} keyId The fingerprint of the key to unlock.
 * @return {!Promise.<void>} A resolving promise if the key has been unlocked;
 *     a rejecting promise if an error occurred.
 * @private
 */
GSC.prototype.unlockKey_ = async function(manager, keyId) {
  let pinBytes;
  let triedCache = false;
  do {
    pinBytes = null;
    const currentKeyId = await manager.fetchAuthenticationPublicKeyId();
    if (!compare(keyId, currentKeyId)) {
      throw new Error(
          `GSC.unlockKey_: key ID changed for reader ${manager.reader}`);
    }
    const numTries = await manager.fetchPINVerificationTriesRemaining();
    // Only try once and only if there is no chance we block the smart card.
    if (this.pinCache_.isEnabled() && !triedCache && numTries > 1) {
      triedCache = true;
      pinBytes = await this.pinCache_.retrieve(
          `${manager.reader()}|${new TextDecoder('utf-8').decode(keyId)}`);
    }
    if (!pinBytes) {
      try {
        const pin = await this.requestPIN(
            lib.notNull(manager.readerShort()),
            keyId,
            manager.appletName(),
            numTries);
        pinBytes = new TextEncoder('utf-8').encode(pin);
      } catch (e) {
        throw new Error('GSC.signRequest: authentication canceled by user');
      }
    }
  } while (!await manager.verifyPIN(pinBytes));

  if (this.pinCache_.isEnabled() === null) {
    const reply = await this.promptUser(localize('CACHE_PIN_PROMPT'));
    this.pinCache_.setEnabled(reply.toLowerCase() === 'y');
  }
  if (this.pinCache_.isEnabled()) {
    await this.pinCache_.store(
        `${manager.reader()}|${new TextDecoder('utf-8').decode(keyId)}`,
        pinBytes);
  }

  pinBytes.fill(0);
};

/**
 * Compute a signature of a challenge on the smart card.
 *
 * Before the private key operation can be performed, the smart card PIN is
 * requested from the user.
 *
 * @param {!Uint8Array} keyBlob The blob of the key which should be used to
 *    sign the challenge.
 * @param {!Uint8Array} data The raw challenge data.
 * @param {number} flags The signature flags.
 * @return {!Promise<!Uint8Array>|!Promise<!Error>} A Promise resolving
 *     to the computed signature; a rejecting promise if unsupported signature
 *     flags are provided, there is no reader corresponding to the requested
 *     key, the key on the reader has changed since requestIdentities has been
 *     called or the user cancels the PIN entry.
 * @override
 */
GSC.prototype.signRequest = async function(keyBlob, data, flags) {
  const keyBlobStr = new TextDecoder('utf-8').decode(keyBlob);
  if (!this.keyBlobToReader_.hasOwnProperty(keyBlobStr)) {
    throw new Error(`GSC.signRequest: no reader found for key "${keyBlobStr}"`);
  }

  const {reader, readerKeyId, applet} = this.keyBlobToReader_[keyBlobStr];
  const manager = new SmartCardManager();
  try {
    await manager.establishContext();
    await manager.connect(reader);
    await manager.selectApplet(applet);

    let dataToSign;
    let rsaHashConstants;
    const keyInfo = await manager.fetchKeyInfo();
    switch (keyInfo.type) {
      case KeyTypes.RSA: {
        if (flags === 0) {
          rsaHashConstants = HashAlgorithms.SHA1;
        } else if (flags & 0b100) {
          rsaHashConstants = HashAlgorithms.SHA512;
        } else if (flags & 0b10) {
          rsaHashConstants = HashAlgorithms.SHA256;
        } else {
          throw new Error(
              `GSC.signRequest: unsupported flag value for RSA: ` +
              `0x${flags.toString(16)}`);
        }
        const hash =
            await globalThis.crypto.subtle.digest(rsaHashConstants.name, data);
        dataToSign = concatTyped(
            rsaHashConstants.identifier, new Uint8Array(hash));
        break;
      }
      case KeyTypes.ECDSA: {
        if (flags !== 0) {
          throw new Error(
              `GSC.signRequest: unsupported flag value for ECDSA: ` +
              `0x${flags.toString(16)}`);
        }
        const hashAlgorithm =
            OidToCurveInfo[lib.notNull(keyInfo.curveOid)].hashAlgorithm;
        dataToSign = new Uint8Array(
            await globalThis.crypto.subtle.digest(hashAlgorithm, data));
        break;
      }
      case KeyTypes.EDDSA:
        if (flags !== 0) {
          throw new Error(
              `GSC.signRequest: unsupported flag value for EdDSA: ` +
              `0x${flags.toString(16)}`);
        }
        dataToSign = data;
        break;
      default:
        throw new Error(
            `GSC.signRequest: unsupported key type: ` +
            `${JSON.stringify(keyInfo)}`);
    }

    await this.unlockKey_(manager, readerKeyId);
    const rawSignature = await manager.authenticate(dataToSign);

    let prefix;
    const curveOid = lib.notNull(keyInfo.curveOid);
    switch (keyInfo.type) {
      case KeyTypes.RSA:
        return concatTyped(
            encodeAsWireString(rsaHashConstants.signaturePrefix),
            encodeAsWireString(rawSignature));
      case KeyTypes.ECDSA: {
        const rRaw = rawSignature.subarray(0, rawSignature.length / 2);
        const sRaw = rawSignature.subarray(rawSignature.length / 2);
        const rMpint = encodeAsWireMpint(rRaw);
        const sMpint = encodeAsWireMpint(sRaw);
        const signatureBlob = concatTyped(rMpint, sMpint);
        prefix = new TextEncoder().encode(OidToCurveInfo[curveOid].prefix);
        const identifier =
            new TextEncoder().encode(OidToCurveInfo[curveOid].identifier);
        return concatTyped(
            encodeAsWireString(concatTyped(prefix, identifier)),
            encodeAsWireString(signatureBlob));
      }
      case KeyTypes.EDDSA:
        prefix = new TextEncoder().encode(OidToCurveInfo[curveOid].prefix);
        return concatTyped(
            encodeAsWireString(prefix),
            encodeAsWireString(rawSignature));
    }
  } finally {
    await manager.disconnect();
    await manager.releaseContext();
  }
};

/**
 * Handler for the apiContextDisposed event.
 */
GSC.apiContextDisposedListener = function() {
  console.debug('GSC: API context disposed');
  GSC.APIContext = null;
  GSC.API = null;
};

/**
 * Initialize the Google Smart Card Connector API context.
 *
 * @return {!Promise<void>|!Promise<!Error>} A resolving Promise if the
 *  initialization succeeded; a rejecting Promise if the Smart Card Connector
 *  app is not installed or disabled.
 */
GSC.initializeAPIContext = async function() {
  if (!GSC.API || !GSC.APIContext) {
    GSC.APIContext = new GoogleSmartCard.PcscLiteClient.Context(
        CLIENT_TITLE, SERVER_APP_ID);
    GSC.API = await new Promise((resolve) => {
      GSC.APIContext.addOnInitializedCallback((api) => {
        GSC.APIContext.addOnDisposeCallback(GSC.apiContextDisposedListener);
        resolve(api);
      });
      GSC.APIContext.addOnDisposeCallback(() => resolve(null));
      GSC.APIContext.initialize();
    });
  }
  if (!GSC.API || !GSC.APIContext) {
    throw new Error(
        'GSC.initializeAPIContext: Smart Card Connector app not ' +
        'installed or disabled.');
  }
};

/**
 * Expand a PC/SC-Lite numerical error code into a more detailed error message.
 *
 * If the error is not recognized to be a PC/SC-Lite error code or is not
 * a number, the original error is returned.
 *
 * @param {number|!Error} error A numerical PC/SC-Lite error code or an Error
 *     object, which should be transformed into its textual representation.
 * @param {!Array<string>} stack Information about the call stack at the time
 *     the error occurred.
 * @return {!Promise<!Error>}
 */
async function decodePcscError(error, stack) {
  stack = stack || '';
  // Numeric error codes signify PC/SC-Lite errors.
  if (typeof error === 'number') {
    try {
      const errorText = await GSC.API.pcsc_stringify_error(error);
      return new Error(`${errorText} (${error})\n${stack}`);
    } catch (e) {
      return new Error(`unknown PC/SC-Lite error (${error})\n${stack}`);
    }
  } else {
    return error;
  }
}

/**
 * Convert an array of bytes into a hex string.
 *
 * @param {!Uint8Array} array
 * @return {string}
 */
function arrayToHexString(array) {
  // Always include leading zeros.
  return array.reduce(
      (str, byte) => str + lib.f.zpad(byte.toString(16).toUpperCase(), 2), '');
}

/**
 * A command APDU as defined in ISO/IEC 7816-4, consisting of a header and
 * optional command data.
 *
 * @param {number} cla The CLA byte.
 * @param {number} ins The INS byte.
 * @param {number} p1 The P1 byte.
 * @param {number} p2 The P2 byte.
 * @param {!Uint8Array=} [data]
 * @param {boolean=} expectResponse If true, expect a response from the
 *     smart card.
 * @constructor
 */
function CommandAPDU(
    cla, ins, p1, p2, data = new Uint8Array([]), expectResponse = true) {
  /**
   * The header of an APDU, consisting of the CLA, INS, P1 and P2 byte in order.
   *
   * @private {!Uint8Array}
   * @const
   */
  this.header_ = new Uint8Array([cla, ins, p1, p2]);

  /**
   * The data to be sent in the body of the APDU.
   *
   * @private {!Uint8Array}
   * @const
   */
  this.data_ = data;

  /**
   * If true, a response from the smart card will be expected.
   *
   * @private {boolean}
   * @const
   */
  this.expectResponse_ = expectResponse;
}

/**
 * Get the raw commands.
 *
 * In order to simplify the command logic, we always expect the maximum amount
 * of bytes in the response (256 for normal length, 65536 for extended length).
 *
 * @param {boolean} supportsChaining Set to true if command chaining can be
 *     used with the card.
 * @param {boolean} supportsExtendedLength Set to true if extended lengths
 *     (Lc and Le) can be used with the card.
 * @return {!Array<!Uint8Array>} The raw response.
 */
CommandAPDU.prototype.commands = function(
    supportsChaining, supportsExtendedLength) {
  const MAX_LC = 255;
  const MAX_EXTENDED_LC = 65535;

  if (this.data_.length === 0 && supportsExtendedLength) {
    const extendedLe = this.expectResponse_ ?
        new Uint8Array([0x00, 0x00, 0x00]) :
        new Uint8Array([]);
    return [concatTyped(this.header_, extendedLe)];
  }
  if (this.data_.length === 0) {
    const le =
        this.expectResponse_ ? new Uint8Array([0x00]) : new Uint8Array([]);
    return [concatTyped(this.header_, le)];
  }
  if (this.data_.length <= MAX_EXTENDED_LC && supportsExtendedLength) {
    const extendedLc = new Uint8Array(
        [0x00, this.data_.length >> 8, this.data_.length & 0xFF]);
    const extendedLe = this.expectResponse_ ? new Uint8Array([0x00, 0x00]) :
                                              new Uint8Array([]);
    return [concatTyped(this.header_, extendedLc, this.data_, extendedLe)];
  }
  if (this.data_.length <= MAX_LC || supportsChaining) {
    const commands = [];
    let remainingBytes = this.data_.length;
    while (remainingBytes > MAX_LC) {
      const header = new Uint8Array(this.header_);
      // Set continuation bit in CLA byte.
      header[0] |= 1 << 4;
      const lc = new Uint8Array([MAX_LC]);
      const data = this.data_.subarray(
          this.data_.length - remainingBytes,
          this.data_.length - remainingBytes + MAX_LC);
      const le =
          this.expectResponse_ ? new Uint8Array([0x00]) : new Uint8Array([]);
      commands.push(concatTyped(header, lc, data, le));
      remainingBytes -= MAX_LC;
    }
    const lc = new Uint8Array([remainingBytes]);
    const data = this.data_.subarray(this.data_.length - remainingBytes);
    const le =
        this.expectResponse_ ? new Uint8Array([0x00]) : new Uint8Array([]);
    commands.push(concatTyped(this.header_, lc, data, le));
    return commands;
  }
  throw new Error(
      `CommandAPDU.commands: data field too long (${this.data_.length} ` +
      ` > ${MAX_LC}) and no support for chaining`);
};

/**
 * Human-readable descriptions of common data object tags for OpenPGP cards.
 *
 * @see https://g10code.com/docs/openpgp-card-2.0.pdf
 * @readonly
 * @enum {string}
 */
const DATA_OBJECT_TAG = {
  0x5E: 'Login data',
  0x5F50: 'URL to public keys',

  0x65: 'Cardholder Related Data',
  0x5B: 'Name',
  0x5F2D: 'Language preference',
  0x5F35: 'Sex',

  0x6E: 'Application Related Data',
  0x4F: 'Application Identifier',
  0x5F52: 'Historical bytes',
  0x73: 'Discretionary data objects',
  0xC0: 'Extended capabilities',
  0xC1: 'Algorithm attributes: signature',
  0xC2: 'Algorithm attributes: decryption',
  0xC3: 'Algorithm attributes: authentication',
  0xC4: 'PW Status Bytes',
  0xC5: 'Fingerprints',
  0xC6: 'CA Fingerprints',
  0xCD: 'Generation Timestamps',

  0x7A: 'Security support template',
  0x93: 'Digital signature counter',

  0x7F49: 'Public key template',
  0x81: 'Modulus',
  0x82: 'Public exponent',
};

/**
 * Human-readable descriptions of common data object tag classes for OpenPGP
 * cards.
 *
 * @see https://g10code.com/docs/openpgp-card-2.0.pdf
 * @readonly
 * @enum {string}
 */
const DATA_OBJECT_TAG_CLASS = {
  0: 'universal',
  1: 'application',
  2: 'context-specific',
  3: 'private',
};

/**
 * A TLV-encoded data object following ISO 7816-4: Annex D.
 *
 * @see https://www.cardwerk.com/smartcards/smartcard_standard_ISO7816-4_annex-d.aspx
 *
 * @constructor
 */
function DataObject() {}

/**
 * @typedef {{
 *     dataObject: ?DataObject,
 *     index: number
 * }}
 */
const DataObjectAndIndex = undefined;

/**
 * Recursively parse (a range of) the byte representation of a TLV-encoded data
 * object into a DataObject object.
 *
 * @see https://www.cardwerk.com/smartcards/smartcard_standard_ISO7816-4_annex-d.aspx
 *
 * @constructs DataObject
 * @param {!Uint8Array} bytes The raw bytes of the data object.
 * @param {number=} start The position in bytes at which the parsing should
 *     start.
 * @param {number=} end The position in bytes until which to parse.
 * @throws Will throw if the raw data does not follow the specification for
 *     TLV-encoded data objects.
 * @return {!DataObjectAndIndex} A DataObject object
 *     that is the result of the parsing and an index into the input byte array
 *     which points to the end of the part consumed so far.
 */
DataObject.fromBytesInRange = function(bytes, start = 0, end = bytes.length) {
  let pos = start;
  // Skip 0x00 and 0xFF bytes before and between tags.
  while (pos < end && (bytes[pos] === 0x00 || bytes[pos] === 0xFF)) {
    ++pos;
  }
  if (pos >= end) {
    return {dataObject: null, index: start};
  }

  const dataObject = new DataObject();
  const tagByte = bytes[pos++];
  dataObject.tagClass = tagByte >>> 6;
  dataObject.tagClassDescription = DATA_OBJECT_TAG_CLASS[dataObject.tagClass];
  const isConstructed = !!(tagByte & (1 << 5));
  dataObject.isConstructed = isConstructed;

  let tagNumber = tagByte & 0b00011111;
  let numTagNumberBytes = 1;
  if (tagNumber === 0b00011111) {
    if (!(bytes[pos] & 0b01111111)) {
      throw new Error(
          'DataObject.fromBytesWithStart: first byte of the tag number is 0');
    }
    tagNumber = 0;
    do {
      tagNumber = (tagNumber << 7) + (bytes[pos] & 0b01111111);
      ++numTagNumberBytes;
    } while (bytes[pos++] & (1 << 7));
  }
  dataObject.tagNumber = tagNumber;
  dataObject.tag = bytes.slice(pos - numTagNumberBytes, pos)
                       .reverse()
                       .reduce((acc, val) => (acc << 8) + val, 0);
  dataObject.tagDescription =
      DATA_OBJECT_TAG[dataObject.tag] ||
      `<unimplemented tag: ${dataObject.tag}>`;

  const lengthByte = bytes[pos++];
  let valueLength = 0;
  if (lengthByte <= 0x7F) {
    valueLength = lengthByte;
  } else {
    const numLengthBytes = lengthByte & 0b01111111;
    for (let i = 0; i < numLengthBytes; ++i) {
      valueLength = (valueLength * 0x100) + bytes[pos++];
    }
  }
  dataObject.valueLength = valueLength;

  const valueStart = pos;
  const valueEnd = pos + valueLength;
  const value = bytes.slice(valueStart, valueEnd);

  dataObject.value = value;

  if (isConstructed) {
    dataObject.children = [];
    let child;
    do {
      ({dataObject: child, index: pos} =
           DataObject.fromBytesInRange(bytes, pos, valueEnd));
      if (child) {
        dataObject.children.push(child);
      }
    } while (child);
  }

  return {dataObject, index: valueEnd};
};

/**
 * Parse the byte representation of one or multiple TLV-encoded data objects
 * into a DataObject.
 *
 * Some smart cards return constructed data objects with their tags and
 * lengths, other cards return a list of subtags. In the latter case, this
 * function creates an artificial root object which contains all the subtags
 * in the list as children.
 *
 * @see https://www.cardwerk.com/smartcards/smartcard_standard_ISO7816-4_annex-d.aspx
 *
 * @constructs DataObject
 * @param {!Uint8Array} bytes The raw bytes of the data object.
 * @throws Will throw if the raw data does not follow the specification for
 *     TLV-encoded data objects.
 * @return {?DataObject} A DataObject that is the result of the parsing.
 */
DataObject.fromBytes = function(bytes) {
  const dataObjects = [];
  let index = 0;
  let dataObject;
  do {
    ({dataObject, index} = DataObject.fromBytesInRange(bytes, index));
    if (dataObject) {
      dataObjects.push(dataObject);
    }
  } while (dataObject);

  if (dataObjects.length === 0) {
    return null;
  }
  if (dataObjects.length === 1) {
    return dataObjects[0];
  }

  // Create an artificial root object under which all tags of a top-level
  // tag list are subsumed. This ensures a consistent structure of replies
  // to GET DATA command among different smart card brands.
  const artificialRootObject = new DataObject();
  artificialRootObject.isConstructed = true;
  artificialRootObject.children = dataObjects;
  return artificialRootObject;
};

/**
 * Return a data object with a given tag (depth-first search).
 *
 * @param {number} tag
 * @return {?DataObject} The requested data object if present; null otherwise.
 */
DataObject.prototype.lookup = function(tag) {
  if (this.tag === tag) {
    return this;
  }
  if (this.isConstructed) {
    for (const child of this.children) {
      const result = child.lookup(tag);
      if (result !== null) {
        return result;
      }
    }
  }
  return null;
};

/**
 * Representation of status bytes as returned by smart card commands.
 *
 * @param {!Uint8Array} bytes The raw status bytes.
 * @constructor
 */
function StatusBytes(bytes) {
  /**
   * The raw status bytes.
   *
   * @member {!Uint8Array}
   * @readonly
   */
  this.bytes = bytes;
}

/**
 * Calculates the 16-bit value represented by the status bytes.
 *
 * @return {number} The 16-bit value represented by the status bytes.
 */
StatusBytes.prototype.value = function() {
  return (this.bytes[0] << 8) + this.bytes[1];
};

/**
 * @return {string}
 * @override
 */
StatusBytes.prototype.toString = function() {
  return `(0x${this.bytes[0].toString(16)} 0x${this.bytes[1].toString(16)})`;
};

/**
 * A lifecycle and communication manager for smart cards with convenience
 * functions for commands commonly used for SSH authentication.
 *
 * @constructor
 */
function SmartCardManager() {
  /**
   * Whether the manager is connected to a reader.
   *
   * @member {boolean}
   * @private
   */
  this.connected_ = false;

  /**
   * The current PC/SC-Lite context.
   *
   * @member {?number}
   * @private
   */
  this.context_ = null;

  /**
   * The name of the reader the manager is connected to.
   *
   * @member {?string}
   * @private
   */
  this.reader_ = null;

  /**
   * The handle of the card the manager is currently communicating with.
   *
   * @member {?number}
   * @private
   */
  this.cardHandle_ = null;

  /**
   * The transmission protocol currently in use by the agent.
   *
   * @member {?number}
   * @private
   */
  this.activeProtocol_ = null;

  /**
   * The smart card applet that has been selected by the manager.
   *
   * @member {!SmartCardManager.CardApplets}
   * @private
   */
  this.appletSelected_ = SmartCardManager.CardApplets.NONE;

  /**
   * True if the card is known to support command chaining.
   *
   * @member {boolean}
   * @private
   */
  this.supportsChaining_ = false;

  /**
   * True if the card is known to support extended lengths (Lc and Le).
   *
   * @member {boolean}
   * @private
   */
  this.supportsExtendedLength_ = false;
}

/**
 * Smart card applets used for SSH authentication.
 *
 * @enum {number}
 */
SmartCardManager.CardApplets = {
  NONE: 0,
  OPENPGP: 1,
  PIV: 2,
};

/**
 * A list of the most descriptive parts of the names for popular smart card
 * readers and hardware tokens.
 *
 * If a reader name contains a string from the list, it is replaced by this
 * string. The strings are processed in order, thus substrings of other strings
 * should come last.
 *
 * @readonly
 * @const {!Array<string>}
 */
SmartCardManager.READER_SHORT_NAMES = [
  'Yubikey NEO-N',
  'Yubikey NEO',
  'Yubikey 4-N',
  'Yubikey 4',
  'Nitrokey Start',
  'Nitrokey Pro',
  'Nitrokey Storage',
  'Gemalto PC Twin Reader',
  'Gemalto USB Shell Token',
];

/**
 * Common status values (or individual bytes) returned by smart card applets.
 *
 * @readonly
 * @enum {number}
 */
SmartCardManager.StatusValues = {
  COMMAND_CORRECT: 0x9000,
  COMMAND_CORRECT_MORE_DATA_1: 0x6100,
  COMMAND_INCORRECT_PARAMETERS: 0x6A80,
  COMMAND_WRONG_PIN: 0x6982,
  COMMAND_BLOCKED_PIN: 0x6983,
  PIV_TRIES_LEFT_RESPONSE: 0x63C0,
};

/**
 * Get the name of the reader the manager is connected to.
 *
 * @return {?string}
 */
SmartCardManager.prototype.reader = function() {
  return this.reader_;
};

/**
 * Get the shortened name of the reader the manager is connected to.
 *
 * Uses a list of name parts of popular "smart cards".
 *
 * @return {?string}
 */
SmartCardManager.prototype.readerShort = function() {
  if (!this.reader_) {
    return null;
  }

  for (const shortName of SmartCardManager.READER_SHORT_NAMES) {
    if (this.reader_.includes(shortName)) {
      return shortName;
    }
  }
  return this.reader_;
};

/**
 * Get the name of applet that is currently selected.
 *
 * @return {string}
 */
SmartCardManager.prototype.appletName = function() {
  switch (this.appletSelected_) {
    case SmartCardManager.CardApplets.OPENPGP:
      return 'OpenPGP';
    case SmartCardManager.CardApplets.PIV:
      return 'PIV';
    default:
      return 'None';
  }
};

/**
 * Wrap a GSC-internal thenable into a vanilla Promise for execution.
 *
 * Packs the return values of the thenable into an array if there is not just a
 * single one.
 *
 * @param {!Promise<!GoogleSmartCard.PcscLiteClient.API.Result>} sCardPromise
 * @return {!Promise} A promise resolving to the
 *     return values of the GSC thenable; a rejecting promise containing an
 *     Error object if an error occurred.
 * @private
 */
SmartCardManager.prototype.execute_ = function(sCardPromise) {
  // Retain call stack for logging purposes.
  const stack = lib.f.getStack();
  return sCardPromise.then((result) => {
    return new Promise(function(resolve, reject) {
        result.get(
            (...args) => args.length > 1 ? resolve(args) : resolve(args[0]),
            reject);
    }).catch((e) => {
      return decodePcscError(
          /** @type {number|!Error} */ (e), stack)
          .then((e) => Promise.reject(e));
    });
  });
};

/**
 * Establish a PC/SC-lite context if the current context is not valid.
 *
 * @return {!Promise<void>}
 */
SmartCardManager.prototype.establishContext = async function() {
  if (!await this.hasValidContext()) {
    this.context_ = await this.execute_(GSC.API.SCardEstablishContext(
        GoogleSmartCard.PcscLiteClient.API.SCARD_SCOPE_SYSTEM, null, null));
  }
};

/**
 * Check whether the current PC/SC-lite context is valid.
 *
 * @return {!Promise<boolean>}
 */
SmartCardManager.prototype.hasValidContext = async function() {
  if (!this.context_) {
    return false;
  }
  try {
    await this.execute_(GSC.API.SCardIsValidContext(this.context_));
  } catch (_) {
    return false;
  }
  return true;
};

/**
 * Retrieve a list of names of connected readers known to the Smart Card
 * Connector app.
 *
 * @return {!Promise<!Array<string>>|!Promise<!Error>} A Promise resolving
 *     to a list of readers; a rejecting Promise if the context is invalid.
 */
SmartCardManager.prototype.listReaders = async function() {
  if (await this.hasValidContext()) {
    return this.execute_(GSC.API.SCardListReaders(this.context_, null));
  } else {
    throw new Error('SmartCardManager.listReaders: invalid context');
  }
};

/**
 * Connect to the reader with the given name.
 *
 * Requests exclusive access to the reader and uses the T1 protocol.
 *
 * @param {string} reader
 * @return {!Promise<void>|!Promise<?Error>} A resolving Promise if the
 *     initiation of the connection was successful; a rejecting Promise if the
 *     context is invalid or the connection failed.
 */
SmartCardManager.prototype.connect = async function(reader) {
  if (!await this.hasValidContext()) {
    throw new Error('SmartCardManager.connect: invalid context');
  }
  if (this.connected_) {
    await this.disconnect();
  }
  if (await this.hasValidContext() && !this.connected_) {
    [this.cardHandle_, this.activeProtocol_] =
        await this.execute_(GSC.API.SCardConnect(
            this.context_,
            reader,
            GoogleSmartCard.PcscLiteClient.API.SCARD_SHARE_EXCLUSIVE,
            GoogleSmartCard.PcscLiteClient.API.SCARD_PROTOCOL_T1));
    this.reader_ = reader;
    this.connected_ = true;
  }
};

/**
 * Transmit a command APDU to the card and retrieve the result.
 *
 * Supports command chaining and continued responses.
 *
 * @param {!CommandAPDU} commandAPDU
 * @return {!Promise<!Uint8Array>|
 *    !Promise<!StatusBytes>} A Promise resolving to the response; a rejecting
 *    Promise containing the status bytes if they signal an error.
 */
SmartCardManager.prototype.transmit = async function(commandAPDU) {
  if (!this.connected_) {
    throw new Error('SmartCardManager.transmit: not connected');
  }
  let data;
  for (const command of commandAPDU.commands(
           this.supportsChaining_, this.supportsExtendedLength_)) {
    const result = await this.execute_(GSC.API.SCardTransmit(
        this.cardHandle_,
        GoogleSmartCard.PcscLiteClient.API.SCARD_PCI_T1,
        Array.from(command)));
    data = await this.getData_(result);
  }
  return data;
};

/**
 * Parse the raw result of a command APDU received from the smart card and
 * handle the status bytes.
 *
 * Supports continued responses.
 *
 * @param {!Uint8Array} rawResult A result array formed using execute_ on the
 *     result returned asynchronously by SCardTransmit.
 * @return {!Promise<!Uint8Array>|
 *    !Promise<!StatusBytes>} A Promise resolving to the response; a rejecting
 *    Promise containing the status bytes if they signal an error.
 * @private
 */
SmartCardManager.prototype.getData_ = async function(rawResult) {
  /**
   * Command APDU for the 'GET RESPONSE' command.
   *
   * Used to retrieve the continuation of a long response.
   *
   * @see https://g10code.com/docs/openpgp-card-2.0.pdf
   */
  const GET_RESPONSE_APDU = new CommandAPDU(0x00, 0xC0, 0x00, 0x00);
  const result = new Uint8Array(rawResult[1]);
  let data = result.slice(0, -2);
  const statusBytes = new StatusBytes(result.slice(-2));
  if ((statusBytes.value() & 0xFF00) ===
      SmartCardManager.StatusValues.COMMAND_CORRECT_MORE_DATA_1) {
    // transmit recursively calls getData_ to assemble the complete response.
    const dataContinued = await this.transmit(GET_RESPONSE_APDU);
    data = concatTyped(data, dataContinued);
  } else if (
      this.appletSelected_ === SmartCardManager.CardApplets.PIV &&
      (statusBytes.value() & 0xFFF0) ===
          SmartCardManager.StatusValues.PIV_TRIES_LEFT_RESPONSE) {
    // Show no error if special status bytes are returned containing the
    // number of remaining PIN verification tries.
    throw statusBytes;
  } else if (
      statusBytes.value() !== SmartCardManager.StatusValues.COMMAND_CORRECT) {
    console.warn(
        'SmartCardManager.getData_: operation returned specific status bytes ' +
        statusBytes);
    throw statusBytes;
  }
  return data;
};

/**
 * Select a specific applet on the smart card.
 *
 * @param {!SmartCardManager.CardApplets} applet
 * @return {!Promise<void>|!Promise<!Error>} A Promise resolving to the key
 *     blob; a rejecting Promise if the manager is not connected to a smart
 *     card, an applet has already been selected or the selected applet is not
 *     supported.
 */
SmartCardManager.prototype.selectApplet = async function(applet) {
  if (!this.connected_) {
    throw new Error('SmartCardManager.selectApplet: not connected');
  }
  if (this.appletSelected_ !== SmartCardManager.CardApplets.NONE) {
    throw new Error('SmartCardManager.selectApplet: applet already selected');
  }
  switch (applet) {
    case SmartCardManager.CardApplets.OPENPGP: {
      /**
       * Command APDU for the 'SELECT APPLET' command with the OpenPGP
       * Application Identifier (AID) as data.
       *
       * Used to select the OpenPGP applet on a smart card.
       *
       * @see https://g10code.com/docs/openpgp-card-2.0.pdf
       */
      const SELECT_APPLET_OPENPGP_APDU =
          new CommandAPDU(
              0x00,
              0xA4,
              0x04,
              0x00,
              new Uint8Array([0xD2, 0x76, 0x00, 0x01, 0x24, 0x01]));
      await this.transmit(SELECT_APPLET_OPENPGP_APDU);
      await this.determineOpenPGPCardCapabilities();
      break;
    }
    case SmartCardManager.CardApplets.PIV: {
      /**
       * Command APDU for the 'SELECT APPLET' command with the PIV Application
       * Identifier (AID) as data.
       *
       * Used to select the PIV applet on a smart card.
       *
       * @see https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-73-4.pdf
       *
       * @readonly
       * @const {!CommandAPDU}
       */
      const SELECT_APPLET_PIV_APDU = new CommandAPDU(
          0x00,
          0xA4,
          0x04,
          0x00,
          new Uint8Array(
              [0xA0, 0x00, 0x00, 0x03, 0x08, 0x00, 0x00, 0x10, 0x00]));
      await this.transmit(SELECT_APPLET_PIV_APDU);
      // Chaining support is part of the specification for the PIV applet.
      this.supportsChaining_ = true;
      break;
    }
    default:
      throw new Error(
          `SmartCardManager.selectApplet: applet ID ${applet} not supported`);
  }
  if (this.appletSelected_ !== SmartCardManager.CardApplets.NONE) {
    throw new Error(
        'SmartCardManager.selectApplet: applet already selected (race)');
  }
  this.appletSelected_ = applet;
};

/**
 * Information about an SSH public key, including its type and perhaps
 * additional data depending on the type.
 *
 * @typedef {{
 *     type: !KeyTypes,
 *     curveOid: ?string,
 * }}
 */
const KeyInfo = undefined;

/**
 * Fetch the key type and additional information from the algorithm attributes
 * of the authentication subkey.
 *
 * @return {!Promise<!KeyInfo>} A Promise resolving to a KeyInfo object; a
 *     rejecting Promise if no supported type could be extracted.
 */
SmartCardManager.prototype.fetchKeyInfo = async function() {
  switch (this.appletSelected_) {
    case SmartCardManager.CardApplets.OPENPGP: {
      /**
       * Command APDU for the 'GET DATA' command with the identifier of the
       * 'Application Related Data' data object as data.
       *
       * Used to retrieve the 'Algorithm attributes authentication' contained
       * in the 'Application Related Data'.
       *
       * @see https://g10code.com/docs/openpgp-card-2.0.pdf
       */
      const FETCH_APPLICATION_RELATED_DATA_APDU =
          new CommandAPDU(0x00, 0xCA, 0x00, 0x6E);
      const appRelatedData = DataObject.fromBytes(
          await this.transmit(FETCH_APPLICATION_RELATED_DATA_APDU));
      const type = appRelatedData.lookup(0xC3).value[0];
      let curveOid = null;
      switch (type) {
        case KeyTypes.RSA:
          return {type, curveOid};
        case KeyTypes.ECDSA:
        case KeyTypes.EDDSA: {
          // Curve is determined by the subsequent bytes encoding the OID.
          const curveOidBytes = appRelatedData.lookup(0xC3).value.slice(1);
          curveOid =
              decodeCurveOidWithVendorFixes(curveOidBytes, this.reader());
          if (!(curveOid in OidToCurveInfo)) {
            throw new Error(
                `SmartCardManager.fetchKeyInfo: unsupported curve OID: ` +
                `${curveOid}`);
          }
          return {type, curveOid};
        }
        default:
          throw new Error(
              `SmartCardManager.fetchKeyInfo: unsupported algorithm ID: ` +
              `${type}`);
      }
    }
    case SmartCardManager.CardApplets.PIV: {
      /**
       * Command APDU for the 'GET DATA' command for the 'X.509 Certificate
       * for PIV Authentication' data object.
       *
       * Used to retrieve information on the public part of the authentication
       * subkey.
       *
       * @see https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-73-4.pdf
       */
      const READ_AUTHENTICATION_CERTIFICATE_APDU =
          new CommandAPDU(
              0x00,
              0xCB,
              0x3F,
              0xFF,
              new Uint8Array([0x5C, 0x03, 0x5F, 0xC1, 0x05]));
      const certificateObject = DataObject.fromBytes(
          await this.transmit(READ_AUTHENTICATION_CERTIFICATE_APDU));
      const certificateBytes =
          DataObject
              .fromBytes(certificateObject.lookup(0x53).value)
              .lookup(0x70)
              .value;
      const asn1Certificate = asn1js.fromBER(certificateBytes.buffer);
      const certificate =
          new pkijs.Certificate({schema: asn1Certificate.result});
      const algorithmId =
          certificate.subjectPublicKeyInfo.algorithm.algorithmId;
      switch (algorithmId) {
        case '1.2.840.113549.1.1.1':
          // RSA
          return {type: KeyTypes.RSA, curveOid: null};
        case '1.2.840.10045.2.1': {
          // ECDSA
          // We deviate from the PIV spec by allowing curves other than P-256.
          // If curve detection fails, we fall back to the default.
          let curveOid;
          try {
            const algorithmParams =
                certificate.subjectPublicKeyInfo.algorithm.algorithmParams;
            curveOid = algorithmParams.valueBlock.toJSON().value;
          } catch (e) {
            return {type: KeyTypes.ECDSA, curveOid: '1.2.840.10045.3.1.7'};
          }
          if (!(curveOid in OidToCurveInfo &&
                'pivAlgorithmId' in OidToCurveInfo[curveOid])) {
            throw new Error(
                `SmartCardManager.fetchKeyInfo: unsupported curve OID for ` +
                `PIV: ${curveOid}`);
          }
          return {type: KeyTypes.ECDSA, curveOid};
        }
        default:
          throw new Error(
              `SmartCardManager.fetchKeyInfo: unsupported PIV algorithm OID: ` +
              `${algorithmId}`);
      }
    }
    default:
      throw new Error(
          `SmartCardManager.fetchKeyInfo: no or unsupported applet ` +
          `selected: ${this.appletSelected_}`);
  }
};

/**
 * Fetch the public key blob of the authentication subkey on the smart card.
 *
 * @return {!Promise<!Uint8Array>|!Promise<!Error>} A Promise resolving to
 *     the key blob; a rejecting Promise if the selected applet is not
 *     supported.
 */
SmartCardManager.prototype.fetchPublicKeyBlob = async function() {
  switch (this.appletSelected_) {
    case SmartCardManager.CardApplets.OPENPGP: {
      /**
       * Command APDU for the 'GENERATE ASYMMETRIC KEY PAIR' command in
       * 'reading' mode with the identifier of the authentication subkey as
       * data.
       *
       * Used to retrieve information on the public part of the authentication
       * subkey.
       *
       * @see https://g10code.com/docs/openpgp-card-2.0.pdf
       * @see RFC 4253, Section 6.6 and RFC 4251, Section 5.
       */
      const READ_AUTHENTICATION_PUBLIC_KEY_APDU =
          new CommandAPDU(0x00, 0x47, 0x81, 0x00, new Uint8Array([0xA4, 0x00]));
      const publicKeyTemplate = DataObject.fromBytes(
          await this.transmit(READ_AUTHENTICATION_PUBLIC_KEY_APDU));
      const keyInfo = await this.fetchKeyInfo();
      switch (keyInfo.type) {
        case KeyTypes.RSA: {
          const exponent = publicKeyTemplate.lookup(0x82).value;
          const modulus = publicKeyTemplate.lookup(0x81).value;
          return generateKeyBlob(keyInfo.type, exponent, modulus);
        }
        case KeyTypes.ECDSA:
        case KeyTypes.EDDSA: {
          const key = publicKeyTemplate.lookup(0x86).value;
          return generateKeyBlob(keyInfo.type, keyInfo.curveOid, key);
        }
        default:
          throw new Error(
              `SmartCardManager.fetchPublicKeyBlob: unsupported key type: ` +
              `${JSON.stringify(keyInfo)}`);
      }
    }
    case SmartCardManager.CardApplets.PIV: {
      /**
       * Command APDU for the 'GET DATA' command for the 'X.509 Certificate
       * for PIV Authentication' data object.
       *
       * Used to retrieve information on the public part of the authentication
       * subkey.
       *
       * @see https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-73-4.pdf
       */
      const READ_AUTHENTICATION_CERTIFICATE_APDU =
          new CommandAPDU(
              0x00,
              0xCB,
              0x3F,
              0xFF,
              new Uint8Array([0x5C, 0x03, 0x5F, 0xC1, 0x05]));
      const certificateObject = DataObject.fromBytes(
          await this.transmit(READ_AUTHENTICATION_CERTIFICATE_APDU));
      const certificateBytes =
          DataObject
              .fromBytes(certificateObject.lookup(0x53).value)
              .lookup(0x70)
              .value;
      const asn1Certificate = asn1js.fromBER(certificateBytes.buffer);
      const certificate =
          new pkijs.Certificate({schema: asn1Certificate.result});
      const rawPublicKey =
          certificate.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHex;
      const keyInfo = await this.fetchKeyInfo();
      switch (keyInfo.type) {
        case KeyTypes.RSA: {
          const asn1PublicKey = asn1js.fromBER(rawPublicKey);
          const rsaPublicKey =
              new pkijs.RSAPublicKey({schema: asn1PublicKey.result});
          const exponent =
              new Uint8Array(rsaPublicKey.publicExponent.valueBlock.valueHex);
          const modulus =
              new Uint8Array(rsaPublicKey.modulus.valueBlock.valueHex);
          return generateKeyBlob(keyInfo.type, exponent, modulus);
        }
        case KeyTypes.ECDSA:
          return generateKeyBlob(
              keyInfo.type, keyInfo.curveOid, new Uint8Array(rawPublicKey));
        default:
          throw new Error(
              `SmartCardManager.fetchPublicKeyBlob: unsupported key type: ` +
              `${JSON.stringify(keyInfo)}`);
      }
    }
    default:
      throw new Error(
          `SmartCardManager.fetchPublicKeyBlob: no or unsupported applet ` +
          `selected: ${this.appletSelected_}`);
  }
};

/**
 * Fetch the fingerprint of the public key the authentication subkey on the
 * smart card.
 *
 * @return {!Promise<!Uint8Array>|!Promise<!Error>} A Promise resolving
 *     to the fingerprint; a rejecting Promise if the selected applet is not
 *     supported.
 */
SmartCardManager.prototype.fetchAuthenticationPublicKeyId = async function() {
  switch (this.appletSelected_) {
    case SmartCardManager.CardApplets.OPENPGP: {
      /**
       * Command APDU for the 'GET DATA' command with the identifier of the
       * 'Application Related Data' data object as data.
       *
       * Used to retrieve the 'Application Related Data'.
       *
       * @see https://g10code.com/docs/openpgp-card-2.0.pdf
       */
      const FETCH_APPLICATION_RELATED_DATA_APDU =
          new CommandAPDU(0x00, 0xCA, 0x00, 0x6E);
      const appRelatedData = DataObject.fromBytes(
          await this.transmit(FETCH_APPLICATION_RELATED_DATA_APDU));
      return appRelatedData.lookup(0xC5).value.subarray(40, 60);
    }
    case SmartCardManager.CardApplets.PIV: {
      /**
       * Command APDU for the 'GET DATA' command for the 'X.509 Certificate
       * for PIV Authentication' data object.
       *
       * Used to retrieve information on the public part of the authentication
       * subkey.
       *
       * @see https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-73-4.pdf
       */
      const READ_AUTHENTICATION_CERTIFICATE_PIV_APDU =
          new CommandAPDU(
              0x00,
              0xCB,
              0x3F,
              0xFF,
              new Uint8Array([0x5C, 0x03, 0x5F, 0xC1, 0x05]));
      const certificateObject = DataObject.fromBytes(
          await this.transmit(READ_AUTHENTICATION_CERTIFICATE_PIV_APDU));
      const certificateBytes =
          DataObject
              .fromBytes(certificateObject.lookup(0x53).value)
              .lookup(0x70)
              .value;
      const asn1Certificate = asn1js.fromBER(certificateBytes.buffer);
      const pkijsCertificate =
          new pkijs.Certificate({schema: asn1Certificate.result});
      const subjectPublicKeyInfo =
          pkijsCertificate.subjectPublicKeyInfo.toSchema().toBER(false);
      return new Uint8Array(
          await globalThis.crypto.subtle.digest('SHA-1', subjectPublicKeyInfo));
    }
    default:
      throw new Error(
          `SmartCardManager.fetchAuthenticationPublicKeyId: no or ` +
          `unsupported applet selected: ${this.appletSelected_}`);
  }
};

/**
 * Fetch the number of PIN verification attempts that remain.
 *
 * @return {!Promise<number>|!Promise<!Error>} A Promise resolving to the
 *     number of PIN verification attempts; a rejecting Promise if the selected
 *     applet is not supported.
 */
SmartCardManager.prototype.fetchPINVerificationTriesRemaining =
    async function() {
  switch (this.appletSelected_) {
    case SmartCardManager.CardApplets.OPENPGP: {
      /**
       * Command APDU for the 'GET DATA' command with the identifier of the
       * 'Application Related Data' data object as data.
       *
       * Used to retrieve the 'Application Related Data'.
       *
       * @see https://g10code.com/docs/openpgp-card-2.0.pdf
       */
      const FETCH_APPLICATION_RELATED_DATA_APDU =
          new CommandAPDU(0x00, 0xCA, 0x00, 0x6E);
      const appRelatedData = DataObject.fromBytes(
          await this.transmit(FETCH_APPLICATION_RELATED_DATA_APDU));
      return appRelatedData.lookup(0xC4).value[4];
    }
    case SmartCardManager.CardApplets.PIV: {
      /**
       * Header bytes of the command APDU for the 'VERIFY PIN' command (PIV).
       *
       * Used to unlock private key operations on the smart card.
       *
       * @see https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-73-4.pdf
       */
      const VERIFY_PIN_PIV_APDU_HEADER = [0x00, 0x20, 0x00, 0x80];
      // The PIV applet returns the number of remaining tries encoded into the
      // status bytes, hence we expect the following command to throw.
      try {
        await this.transmit(new CommandAPDU(
            ...VERIFY_PIN_PIV_APDU_HEADER,
            [] /* data */,
            false /* expectResponse */));
      } catch (statusBytes) {
        if ((statusBytes.value() & 0xFFF0) ===
            SmartCardManager.StatusValues.PIV_TRIES_LEFT_RESPONSE) {
          return statusBytes.value() & 0xF;
        }
        throw new Error(
            `SmartCardManager.fetchPINVerificationTriesRemaining: expected ` +
            `status bytes of the form 0x63 0xCX, but got` +
            `${statusBytes.toString()}`);
      }
      break;
    }
    default:
      throw new Error(
          `SmartCardManager.fetchPINVerificationTriesRemaining: no or ` +
          `unsupported applet selected: ${this.appletSelected_}`);
  }
};

/**
 * Determine the card capabilities of an OpenPGP card. This includes support for
 * command chaining and extended lengths.
 *
 * @return {!Promise.<void>}
 */
SmartCardManager.prototype.determineOpenPGPCardCapabilities = async function() {
  /**
   * Command APDU for the 'GET DATA' command with the identifier of the
   * 'Historical Bytes' data object as data.
   *
   * Used to retrieve the 'Historical Bytes", which contain information on the
   * communication capabilities of the card.
   *
   * @see https://g10code.com/docs/openpgp-card-2.0.pdf
   */
  const FETCH_HISTORICAL_BYTES_APDU = new CommandAPDU(0x00, 0xCA, 0x5F, 0x52);
  const historicalBytes = await this.transmit(FETCH_HISTORICAL_BYTES_APDU);
  // Parse data objects in COMPACT-TLV.
  // First byte is assumed to be 0x00, last three bytes are status bytes.
  const compactTLVData = historicalBytes.slice(1, -3);
  let pos = 0;
  let capabilitiesBytes = null;
  while (pos < compactTLVData.length) {
    const tag = compactTLVData[pos];
    if (tag === 0x73) {
      capabilitiesBytes = compactTLVData.slice(pos + 1, pos + 4);
      break;
    } else {
      // The length of the tag is encoded in the second nibble.
      pos += 1 + (tag & 0x0F);
    }
  }

  if (capabilitiesBytes) {
    this.supportsChaining_ = capabilitiesBytes[2] & (1 << 7);
    this.supportsExtendedLength_ = capabilitiesBytes[2] & (1 << 6);
  } else {
    console.error(
        'SmartCardManager.determineOpenPGPCardCapabilities: ' +
        'capabilities tag not found');
  }
};

/**
 * Verify the smart card PIN to unlock private key operations.
 *
 * @param {!Uint8Array} pinBytes The PIN encoded as UTF-8.
 * @return {!Promise<boolean>|!Promise<!Error>} A Promise resolving to true
 *     if the supplied PIN was correct; a Promise resolving to false if the
 *     supplied PIN was incorrect; a rejecting Promise if the device is
 *     blocked or unrecognized status bytes were returned or the selected applet
 *     is not supported.
 */
SmartCardManager.prototype.verifyPIN = async function(pinBytes) {
  switch (this.appletSelected_) {
    case SmartCardManager.CardApplets.OPENPGP: {
      /**
       * Header bytes of the command APDU for the 'VERIFY PIN' command.
       *
       * Used to unlock private key operations on the smart card.
       *
       * @see https://g10code.com/docs/openpgp-card-2.0.pdf
       */
      const VERIFY_PIN_APDU_HEADER_OPENPGP = [0x00, 0x20, 0x00, 0x82];
      try {
        await this.transmit(new CommandAPDU(
            ...VERIFY_PIN_APDU_HEADER_OPENPGP,
            pinBytes,
            false /* expectResponse */));
        return true;
      } catch (error) {
        if (error instanceof StatusBytes) {
          switch (error.value()) {
            case SmartCardManager.StatusValues.COMMAND_INCORRECT_PARAMETERS:
              // This happens if the PIN entered by the user is too short,
              // e.g. less than six characters long for OpenPGP.
            case SmartCardManager.StatusValues.COMMAND_WRONG_PIN:
              return false;
            case SmartCardManager.StatusValues.COMMAND_BLOCKED_PIN:
              throw new Error('SmartCardManager.verifyPIN: device is blocked');
            default:
              throw new Error(
                  `SmartCardManager.verifyPIN: failed (${error.toString()})`);
          }
        } else {
          throw error;
        }
      }
    }
    case SmartCardManager.CardApplets.PIV: {
      /**
       * Header bytes of the command APDU for the 'VERIFY PIN' command (PIV).
       *
       * Used to unlock private key operations on the smart card.
       *
       * @see https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-73-4.pdf
       */
      const VERIFY_PIN_APDU_HEADER_PIV = [0x00, 0x20, 0x00, 0x80];
      // PIV Application PIN can only be numeric and between 6 and 8 digits
      // long per spec (see PIV specification Section 2.4.3). Real-life cards
      // and applications are more permissive, hence we allow all characters
      // while keeping the length requirement.
      if (pinBytes.length < 6 || pinBytes.length > 8) {
        return false;
      }
      // Pad to 8 bytes by appending (at most two) 0xFF bytes.
      const paddedPinBytes =
          concatTyped(pinBytes, new Uint8Array([0xFF, 0xFF])).subarray(0, 8);
      try {
        await this.transmit(new CommandAPDU(
            ...VERIFY_PIN_APDU_HEADER_PIV,
            paddedPinBytes,
            false /* expectResponse */));
        paddedPinBytes.fill(0);
        return true;
      } catch (error) {
        if (error instanceof StatusBytes) {
          if ((error.value() & 0x6300) === 0x6300) {
            return false;
          } else if (error.value() ===
                     SmartCardManager.StatusValues.COMMAND_BLOCKED_PIN) {
            throw new Error('SmartCardManager.verifyPIN: device is blocked');
          } else {
            throw new Error(
                `SmartCardManager.verifyPIN: failed (${error.toString()})`);
          }
        } else {
          throw error;
        }
      }
    }
    default:
      throw new Error(
          `SmartCardManager.verifyPIN: no or unsupported applet selected: ` +
          `${this.appletSelected_}`);
  }
};

/**
 * Sign a challenge with the authentication subkey.
 *
 * Has to be used after a successful verifyPIN command.
 *
 * @param {!Uint8Array} data The raw challenge to be signed.
 * @return {!Promise<!Uint8Array>|!Promise<!Error>} A Promise resolving to
 *     the computed signature; a rejecting Promise if the selected applet is not
 *     supported.
 */
SmartCardManager.prototype.authenticate = async function(data) {
  switch (this.appletSelected_) {
    case SmartCardManager.CardApplets.OPENPGP: {
      /**
       * Header bytes of the command APDU for the 'INTERNAL AUTHENTICATE'
       * command (OpenPGP).
       *
       * Used to perform a signature operation using the authentication subkey
       * on the smart card.
       *
       * @see https://g10code.com/docs/openpgp-card-2.0.pdf
       */
      const INTERNAL_AUTHENTICATE_APDU_HEADER = [0x00, 0x88, 0x00, 0x00];
      return this.transmit(
          new CommandAPDU(...INTERNAL_AUTHENTICATE_APDU_HEADER, data));
    }
    case SmartCardManager.CardApplets.PIV: {
      /**
       * Header bytes of the command APDU for the 'GENERAL AUTHENTICATE'
       * command (PIV), using the RSA-2048 algorithm (0x07) resp. ECC P-256
       * algorithm (0x11) with the certificate in slot 9A (0x9A).
       *
       * Used to perform a signature operation using the authentication subkey
       * on the smart card.
       *
       * @see https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-73-4.pdf
       */
      const keyInfo = await this.fetchKeyInfo();
      switch (keyInfo.type) {
        case KeyTypes.RSA: {
          const paddedData = concatTyped(
              new Uint8Array([0x00, 0x01]),
              new Uint8Array(new Array(256 - 3 - data.length).fill(0xFF)),
              new Uint8Array([0x00]),
              data);
          // Create Dynamic Authentication Template.
          // @see Section 3.2.4, Table 7 & Table 20
          const authTemplate = concatTyped(
              new Uint8Array(
                  [0x7C, 0x82, 0x01, 0x06, 0x82, 0x00, 0x81, 0x82, 0x01, 0x00]),
              paddedData);
          const GENERAL_AUTHENTICATE_RSA_APDU_HEADER = [0x00, 0x87, 0x07, 0x9A];
          const signedAuthTemplate =
              DataObject.fromBytes(await this.transmit(new CommandAPDU(
                  ...GENERAL_AUTHENTICATE_RSA_APDU_HEADER, authTemplate)));
          return signedAuthTemplate.lookup(0x82).value;
        }
        case KeyTypes.ECDSA: {
          // Create Dynamic Authentication Template.
          // @see Section 3.2.4, Table 7 & Table 20 (adapted to ECC)
          const authTemplate = concatTyped(
              new Uint8Array(
                  [0x7C, 4 + data.length, 0x82, 0x00, 0x81, data.length]),
              data);
          const algorithmId =
              OidToCurveInfo[lib.notNull(keyInfo.curveOid)].pivAlgorithmId;
          const GENERAL_AUTHENTICATE_ECC_APDU_HEADER =
              [0x00, 0x87, algorithmId, 0x9A];
          const signedAuthTemplate =
              DataObject.fromBytes(await this.transmit(new CommandAPDU(
                  ...GENERAL_AUTHENTICATE_ECC_APDU_HEADER, authTemplate)));
          const asn1SignatureBytes = signedAuthTemplate.lookup(0x82).value;
          const asn1Signature = asn1js.fromBER(asn1SignatureBytes.buffer);
          const asn1SequenceBlock = asn1Signature.result.valueBlock;
          const x = asn1SequenceBlock.value[0].valueBlock.valueHex;
          const y = asn1SequenceBlock.value[1].valueBlock.valueHex;
          return concatTyped(new Uint8Array(x), new Uint8Array(y));
        }
      }
    }
    default:
      throw new Error(
          `SmartCardManager.authenticate: no or unsupported applet ` +
          `selected: ${this.appletSelected_}`);
  }
};

/**
 * Disconnect from the currently connected reader.
 *
 * @return {!Promise<void>}
 */
SmartCardManager.prototype.disconnect = async function() {
  if (this.connected_) {
    await this.execute_(GSC.API.SCardDisconnect(
        this.cardHandle_, GoogleSmartCard.PcscLiteClient.API.SCARD_LEAVE_CARD));
    this.connected_ = false;
    this.reader_ = null;
    this.cardHandle_ = null;
    this.activeProtocol_ = null;
    this.appletSelected_ = SmartCardManager.CardApplets.NONE;
  }
};

/**
 * Release the current PC/SC-Lite context.
 *
 * @return {!Promise<void>}
 */
SmartCardManager.prototype.releaseContext = async function() {
  if (!await this.hasValidContext()) {
    this.context_ = null;
    return;
  }
  if (this.connected_) {
    await this.disconnect();
  }
  await this.execute_(GSC.API.SCardReleaseContext(this.context_));
  this.context_ = null;
};
