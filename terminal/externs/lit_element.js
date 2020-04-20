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
class CSSResult {}

/** @extends {HTMLElement} */
class LitElement$$module$js$lit_element{
  /**
   * @return {!Object<string, PropertyDeclaration>}
   * @protected
   */
  static get properties() {};

  /**
   * @return {!CSSResult|!Array<CSSResult>}
   * @protected
   */
  static get styles() {};

  /**
   * @return {?Promise}
   * @protected
   */
  performUpdate() {}

  /**
   * @return {!TemplateResult}
   * @protected
   */
  render() {}

  /**
   * @param {string=} propertyName
   * @param {*=} oldValue
   * @return {!Promise<void>}
   */
  requestUpdate(propertyName, oldValue) {}

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
* @return {!TemplateResult}
 */
function html$$module$js$lit_element(strings, ...values) {}

/**
 * @param {!TemplateResult} template
 * @param {!Element|!ShadowRoot|!DocumentFragment} element
 */
function render$$module$js$lit_element(template, element) {}

/**
 * @param {*} value
 * @return {CSSResult}
 */
function unsafeCSS$$module$js$lit_element(value) {}

/**
 * @param {*} value
 */
function live$$module$js$lit_element(value) {}
