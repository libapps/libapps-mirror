// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Minimal externs definitions for asn1js as used in nassh.
 *
 * @externs
 */

var asn1js$$module$js$nassh_deps_rollup = {};

/**
 * @param {!ArrayBuffer} buffer
 * @return {{offset: number, result: !BaseBlock}}
 */
asn1js$$module$js$nassh_deps_rollup.fromBER = function(buffer) {};

class BaseBlock {
  constructor() {
    /** @type {!ValueBlock} */
    this.valueBlock;
  }
  /**
   * @param {boolean=} sizeOnly
   * @return {!ArrayBuffer}
   */
  toBER(sizeOnly = false) {}
}

class ValueBlock {
  constructor() {
    /** @type {!ArrayBuffer} */
    this.valueHex;
    /** @type {!Array<!BaseBlock>} */
    this.value;
  }
}
