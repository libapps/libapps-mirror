// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports the base class for terminal settings elements.
 * This element automatically handles data binding between the managed
 * preferences and the preferences being displayed in the ui.
 *
 * @suppress {checkTypes}
 */
import {LitElement} from './lit_element.js';

export class TerminalSettingsElement extends LitElement {
  constructor() {
    super();

    this.preferenceValue_ = null;
    this.boundPreferenceChanged_ = this.preferenceChanged_.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();

    this.preferenceChanged_(
        window.preferenceManager.get(this.preference));
    window.preferenceManager.addObserver(
        this.preference,
        this.boundPreferenceChanged_);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    window.preferenceManager.removeObserver(
        this.preference,
        this.boundPreferenceChanged_);
  }

  isConsistent() {
    return this.preferenceValue_ === this.uiValue_;
  }

  uiChanged_(value) {
    this.uiValue_ = value;
    window.preferenceManager.set(this.preference, this.uiValue_);
  }

  preferenceChanged_(value) {
    this.preferenceValue_ = this.uiValue_ = value;
  }
}
