// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports a Polymer element terminal-settings-checkbox.
 * This element automatically handles data binding between the managed
 * preferences and the preferences being displayed in the ui.
 *
 * @suppress {checkTypes}
 */
import {PolymerElement, html} from './polymer.js';

export class TerminalSettingsCheckboxElement extends PolymerElement {
  static get is() { return 'terminal-settings-checkbox'; }

  static get properties() {
    return {
      description: {
        type: String,
      },
      preference: {
        type: String,
      },
      uiValue_: {
        type: Boolean,
        observer: 'uiChanged_',
      },
    };
  }

  static get template() {
    return html`
        <label for="checkbox">[[description]]</label>
        <input id="checkbox" type="checkbox" checked="{{uiValue_::change}}" />
    `;
  }

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

  uiChanged_() {
    window.preferenceManager.set(this.preference, this.uiValue_);
  }

  preferenceChanged_(value) {
    this.preferenceValue_ = this.uiValue_ = value;
  }
}
