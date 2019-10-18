// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Externs definitions for LitElement used in terminal.
 *
 * @externs
 */

/** @typedef {{type: Function}} */
var PropertyDeclaration;

class TemplateResult {}

/** @extends {HTMLElement} */
class LitElement$$module$js$lit_element{
  /**
   * @return {!Object<string, PropertyDeclaration>}
   * @protected
   */
  static get properties() {};

  /**
   * @return {?TemplateResult}
   * @protected
   */
  render() {}

  /**
   * @param {(string|Array<(string|number)>)} path
   * @param {*} value
   * @param {Object=} root
   */
  set(path, value, root) {}

  /** @return {!Promise<boolean>} */
  updateComplete() {}
}

/**
 * @param {ITemplateArray} strings
 * @param {...*} values
 */
function css$$module$js$lit_element(strings, ...values) {}

/**
 * @param {ITemplateArray} strings
 * @param {...*} values
 */
function html$$module$js$lit_element(strings, ...values) {}
