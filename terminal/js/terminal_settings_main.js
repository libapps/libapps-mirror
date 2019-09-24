// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Initializes global state used in terminal settings.
 */
import {TerminalSettingsCheckboxElement} from './terminal_settings_checkbox.js';
import {TerminalSettingsDropdownElement} from './terminal_settings_dropdown.js';

window.addEventListener('DOMContentLoaded', (event) => {
  lib.init(() => {
    window.PreferenceManager = hterm.PreferenceManager;
    window.preferenceManager = new window.PreferenceManager('default');

    window.preferenceManager.readStorage(() => {
      customElements.define(
          TerminalSettingsCheckboxElement.is,
          TerminalSettingsCheckboxElement);
      customElements.define(
          TerminalSettingsDropdownElement.is,
          TerminalSettingsDropdownElement);
    });
  });
});
