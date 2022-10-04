// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Shim for rollup import.
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
