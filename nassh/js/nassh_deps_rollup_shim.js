// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview A shim for all node dependencies that need to be
 * bundled into a single ES6 module by rollup, created by importing and
 * re-exporting only the classes and functions that are used by nassh.
 *
 * Note: The ES6 requirement of having at least one default export does not
 * apply with rollup.
 *
 * Note: After making changes to this file it is necessary to run
 * ../bin/mkdeps.sh in order for nassh to pick them up.
 */

/**
 * asn1js is used to parse ASN.1-encoded certificates, for example the
 * certificate associated to an authentication key in the PIV applet of a
 * smart card, in their BER representation into an ASN.1 schema.
 */
import {fromBER} from 'asn1js';
const asn1js = {fromBER};
export {asn1js};

/**
 * pkijs is used to extract information, in particular about the associated
 * RSA/ECC public keys, from the certificates stored in the PIV applet of smart
 * cards.
 */
import {Certificate, ECPublicKey, RSAPublicKey} from 'pkijs';
const pkijs = {
  Certificate,
  ECPublicKey,
  RSAPublicKey,
};
export {pkijs};

/**
 * punycode is used to connect to internationalized (UTF-8) domain names.
 */
import {toASCII} from 'punycode';
const punycode = {toASCII};
export {punycode};
