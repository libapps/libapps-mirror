// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports the base class for terminal settings elements.
 * This element automatically handles data binding between the managed
 * preferences and the preferences being displayed in the ui.
 *
 * @suppress {moduleLoad}
 */
import {LitElement} from './lit.js';

export class TerminalSettingsElement extends LitElement {
  constructor() {
    super();

    /** @type {string} */
    this.preference;
    /** @protected {*} */
    this.value;
    this.boundPreferenceChanged_ = this.preferenceChanged_.bind(this);
  }

  /** @override */
  connectedCallback() {
    super.connectedCallback();

    this.preferenceChanged_(
        window.preferenceManager.get(this.preference));
    window.preferenceManager.addObserver(
        this.preference,
        this.boundPreferenceChanged_);
  }

  /** @override */
  disconnectedCallback() {
    super.disconnectedCallback();

    window.preferenceManager.removeObserver(
        this.preference,
        this.boundPreferenceChanged_);
  }

  /**
   * @param {*} value
   * @protected
   */
  uiChanged_(value) {
    this.value = value;
    window.preferenceManager.set(this.preference, value);
  }

  /**
   * @param {*} value
   * @protected
   */
  preferenceChanged_(value) {
    this.value = value;
  }
}
