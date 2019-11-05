// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Initializes global state used in terminal settings.
 */
import {HueSliderElement} from './terminal_settings_hue_slider.js';
import {TransparencySliderElement} from
    './terminal_settings_transparency_slider.js';
import {SaturationLightnessPickerElement} from
    './terminal_settings_saturation_lightness_picker.js';
import {TerminalSettingsCheckboxElement} from './terminal_settings_checkbox.js';
import {TerminalSettingsDropdownElement} from './terminal_settings_dropdown.js';
import {TerminalSettingsColorpickerElement} from
    './terminal_settings_colorpicker.js';
import {
  TerminalSettingsCategoryOptionElement,
  TerminalSettingsCategorySelectorElement
} from './terminal_settings_category_selector.js';
import {TerminalSettingsThemeElement} from './terminal_settings_theme.js';
import {TerminalSettingsApp} from './terminal_settings_app.js';

window.addEventListener('DOMContentLoaded', (event) => {
  lib.init(() => {
    window.PreferenceManager = hterm.PreferenceManager;
    window.preferenceManager = new window.PreferenceManager('default');

    window.preferenceManager.readStorage(() => {
      const elements = [
          HueSliderElement,
          SaturationLightnessPickerElement,
          TerminalSettingsApp,
          TerminalSettingsCheckboxElement,
          TerminalSettingsDropdownElement,
          TerminalSettingsColorpickerElement,
          TerminalSettingsCategoryOptionElement,
          TerminalSettingsCategorySelectorElement,
          TerminalSettingsThemeElement,
          TransparencySliderElement,
      ];

      for (const element of elements) {
        customElements.define(element.is, element);
      }
    });
  });
});
