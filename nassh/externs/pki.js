// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Minimal externs definitions for pkijs as used in nassh.
 *
 * @externs
 */

var pkijs$$module$js$nassh_deps_rollup = {};
pkijs$$module$js$nassh_deps_rollup.Certificate = Certificate;
pkijs$$module$js$nassh_deps_rollup.RSAPublicKey = RSAPublicKey;

class AlgorithmIdentifier {
  constructor() {
    /** @type {string} */
    this.algorithmId;
    /** @type {!BaseBlock} */
    this.algorithmParams;
  }
}

class Certificate {
  /** @param {{schema: !BaseBlock}} asn1Result */
  constructor(asn1Result) {
    /** @type {!PublicKeyInfo} */
    this.subjectPublicKeyInfo;
  }
}

class PublicKeyInfo {
  constructor() {
    /** @type {!AlgorithmIdentifier} */
    this.algorithm;
    /** @type {!BaseBlock} */
    this.subjectPublicKey;
  }
  /** @return {!BaseBlock} */
  toSchema() {}
}

class RSAPublicKey {
  /** @param {{schema: !BaseBlock}} asn1Result */
  constructor(asn1Result) {
    /** @type {!BaseBlock} */
    this.modulus;
    /** @type {!BaseBlock} */
    this.publicExponent;
  }
}
