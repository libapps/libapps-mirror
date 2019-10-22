// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Initializes global state used in terminal settings.
 */
import {TerminalSettingsCheckboxElement} from './terminal_settings_checkbox.js';
import {TerminalSettingsDropdownElement} from './terminal_settings_dropdown.js';
import {TerminalSettingsColorpickerElement} from
    './terminal_settings_colorpicker.js';
import {
  TerminalSettingsCategoryOptionElement,
  TerminalSettingsCategorySelectorElement
} from './terminal_settings_category_selector.js';
import {TerminalSettingsThemeElement} from './terminal_settings_theme.js';

window.addEventListener('DOMContentLoaded', (event) => {
  lib.init(() => {
    window.PreferenceManager = hterm.PreferenceManager;
    window.preferenceManager = new window.PreferenceManager('default');

    window.preferenceManager.readStorage(() => {
      const elements = [
          TerminalSettingsCheckboxElement,
          TerminalSettingsDropdownElement,
          TerminalSettingsColorpickerElement,
          TerminalSettingsCategoryOptionElement,
          TerminalSettingsCategorySelectorElement,
          TerminalSettingsThemeElement];

      for (const element of elements) {
        customElements.define(element.is, element);
      }
    });
  });
});
