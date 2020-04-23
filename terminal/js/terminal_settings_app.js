// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-app.
 *
 * @suppress {moduleLoad}
 */

import {css, html, LitElement} from './lit_element.js';
import {SUPPORTED_FONT_SIZES} from './terminal_common.js';
import {stylesVars} from './terminal_settings_styles.js';
import './terminal_settings_ansi_colors.js';
import './terminal_settings_app.js';
import './terminal_settings_category_selector.js';
import './terminal_settings_checkbox.js';
import './terminal_settings_colorpicker.js';
import './terminal_settings_dropdown.js';
import './terminal_settings_fonts.js';
import './terminal_settings_textfield.js';
import './terminal_settings_theme.js';
import './terminal_settings_transparency_slider.js';

export const BACKGROUND_IMAGE_CONVERTER = {
  preferenceToDisplay: (preference) => {
    preference = preference ? preference.toString().trim() : '';
    const result = preference.match(/^url\(['"]?(.*?)['"]?\)$/i);
    return result ? result[1] : preference;
  },
  displayToPreference: (display) => {
    display = display.trim();
    if (!display) {
      return '';
    }
    const prefix = RegExp('^https?://', 'i').test(display) ? '' : 'http://';
    return `url(${prefix}${display})`;
  },
};

export const BELL_SOUND_CONVERTER = {
  toChecked: (value) => !!value,
  fromChecked: (checked) => checked ? 'lib-resource:hterm/audio/bell' : '',
};

export class TerminalSettingsApp extends LitElement {
  /** @override */
  static get properties() {
    return {
      activeCategory_: {type: String},
    };
  }

  constructor() {
    super();

    this.activeCategory_ = 'appearance';
  }

  /** @override */
  async performUpdate() {
    // A lot of elements in this page assume libdot has finished initialization.
    await window.libdotInitialized;
    super.performUpdate();
  }

  /** @override */
  static get styles() {
    return [stylesVars, css`
      :host {
        bottom: 0;
        color: #80868B;
        display: flex;
        flex-wrap: nowrap;
        font-family: 'Roboto';
        font-size: 13px;
        left: 0;
        margin: 0;
        padding: 0;
        position: absolute;
        right: 0;
        top: 0;
      }

      h4 {
        color: #212121;
        font-weight: 400;
        line-height: 24px;
        margin: 12px 0;
      }

      terminal-settings-category-selector {
        min-width: 192px;
      }

      terminal-settings-category-option {
        cursor: pointer;
        outline: none;
      }

      terminal-settings-category-option > h2 {
        border-radius: 0 16px 16px 0;
        font-size: 13px;
        line-height: 32px;
        margin: 8px 0;
        padding: 0 24px 0 32px;
        user-select: none;
      }

      terminal-settings-category-option:hover > h2 {
        background-color: rgb(240, 240, 240);
      }

      terminal-settings-category-option[active] > h2 {
        background-color: var(--active-bg);
        color: rgb(26, 115, 232);
      }

      .terminal-settings-category {
        display: none;
        flex-grow: 1;
        overflow: auto;
        padding: 0 40px;
      }

      .terminal-settings-category > section {
        margin-bottom: 20px;
      }

      .terminal-settings-category[active-category] {
        display: block;
      }

      .terminal-settings-category h3 {
        color: rgb(95, 99, 104);
        font-size: 13px;
        font-weight: 500;
        line-height: 20px;
        margin: 0;
        padding: 14px 20px;
      }

      .section-body {
        margin: 0;
        padding: 0;
      }

      .setting-container {
        align-items: center;
        border-bottom: 1px solid rgba(0, 0, 0, 0.14);
        display: flex;
        flex-wrap: nowrap;
        margin: 0 0 0 32px;
        padding: 0;
      }

      .setting-container>h4:first-child {
        flex-grow: 1;
      }

      terminal-settings-ansi-colors {
        margin-right: -6px;
        padding: 6px 0;
      }

      terminal-settings-fonts {
        margin-right: 6px;
        min-width: 170px;
      }

      terminal-settings-dropdown[preference='font-size'] {
        min-width: 80px;
      }
    `];
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);

    const cursorShapeOptions =
        window.PreferenceManager.defaultPreferences['cursor-shape'].type.map(
            (value) => ({
              value,
              label: msg(`TERMINAL_SETTINGS_DROPDOWN_CURSOR_SHAPE_${value}`),
            }),
        );

    return html`
        <terminal-settings-category-selector
            @category-change="${this.onCategoryChange_}">
          <terminal-settings-category-option for="appearance">
            <h2 slot="title">${msg('TERMINAL_TITLE_PREF_APPEARANCE')}</h2>
          </terminal-settings-category-option>
          <terminal-settings-category-option for="mousekeyboard">
            <h2 slot="title">${msg('TERMINAL_TITLE_PREF_KEYBOARD_MOUSE')}</h2>
          </terminal-settings-category-option>
          <terminal-settings-category-option for="behavior">
            <h2 slot="title">${msg('TERMINAL_TITLE_PREF_BEHAVIOR')}</h2>
          </terminal-settings-category-option>
        </terminal-settings-category-selector>

        <section class="terminal-settings-category"
            ?active-category="${this.activeCategory_ === 'appearance'}">
          <section>
            <h3>${msg('TERMINAL_TITLE_THEME')}</h3>
            <ul class="section-body">
              <li class="setting-container">
                <terminal-settings-theme />
              </li>
            </ul>
          </section>

          <section>
            <h3>${msg('TERMINAL_TITLE_PREF_BACKGROUND')}</h3>

            <ul class="section-body">
              <li class="setting-container"
                  title="${msg('HTERM_PREF_BACKGROUND_COLOR')}">
                <h4>${msg('TERMINAL_NAME_PREF_COLOR')}</h4>
                <terminal-settings-colorpicker preference="background-color"
                    disableTransparency>
                </terminal-settings-colorpicker>
              </li>
              <li class="setting-container"
                  title="${msg('TERMINAL_SETTINGS_BACKGROUND_IMAGE_HELP')}">
                <h4>${msg('TERMINAL_NAME_PREF_IMAGE')}</h4>
                <terminal-settings-textfield preference="background-image"
                    .converter=${BACKGROUND_IMAGE_CONVERTER}>
                </terminal-settings-textfield>
              </li>
            </ul>
          </section>

          <section>
            <h3>${msg('TERMINAL_TITLE_PREF_TEXT')}</h3>

            <ul class="section-body">
              <li class="setting-container">
                <h4>${msg('TERMINAL_NAME_PREF_FONT')}</h4>
                <terminal-settings-fonts
                    title="${msg('HTERM_PREF_FONT_FAMILY')}">
                </terminal-settings-fonts
                <!-- TODO(lxj@google.com): We should allow user to input a
                    text size not in the list. -->
                <terminal-settings-dropdown preference="font-size"
                    title="${msg('HTERM_PREF_FONT_SIZE')}"
                    .options="${SUPPORTED_FONT_SIZES.map((value) => ({value}))}"
                >
                </terminal-settings-dropdown>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_FOREGROUND_COLOR')}">
                <h4>${msg('TERMINAL_NAME_PREF_COLOR')}</h4>
                <terminal-settings-colorpicker preference="foreground-color">
                </terminal-settings-colorpicker>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_FONT_SMOOTHING')}">
                <h4>${msg('TERMINAL_NAME_PREF_ANTI_ALIAS')}</h4>
                <terminal-settings-checkbox preference="font-smoothing">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('TERMINAL_PREF_ANSI_COLORS')}">
                <h4>${msg('TERMINAL_NAME_PREF_ANSI_COLORS')}</h4>
                <terminal-settings-ansi-colors
                    preference="color-palette-overrides">
                </terminal-settings-ansi-colors>
              </li>
            </ul>
          </section>

          <section>
            <h3>${msg('TERMINAL_TITLE_PREF_CURSOR')}</h3>

            <ul class="section-body">
              <li class="setting-container"
                  title="${msg('HTERM_PREF_CURSOR_SHAPE')}">
                <h4>${msg('TERMINAL_NAME_PREF_SHAPE')}</h4>
                <terminal-settings-dropdown preference="cursor-shape"
                    .options="${cursorShapeOptions}">
                </terminal-settings-dropdown>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_CURSOR_COLOR')}">
                <h4>${msg('TERMINAL_NAME_PREF_COLOR')}</h4>
                <terminal-settings-colorpicker preference="cursor-color">
                </terminal-settings-colorpicker>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_CURSOR_BLINK')}">
                <h4>${msg('TERMINAL_NAME_PREF_BLINKING')}</h4>
                <terminal-settings-checkbox preference="cursor-blink">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>

          <section>
            <h3>${msg('TERMINAL_TITLE_PREF_SCROLLBAR')}</h3>

            <ul class="section-body">
              <li class="setting-container"
                  title="${msg('HTERM_PREF_SCROLLBAR_VISIBLE')}">
                <h4>${msg('TERMINAL_NAME_PREF_VISIBLE')}</h4>
                <terminal-settings-checkbox preference="scrollbar-visible">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>
        </section>

        <section class="terminal-settings-category"
            ?active-category="${this.activeCategory_ === 'mousekeyboard'}">
          <section>
            <h3>${msg('HTERM_TITLE_PREF_KEYBOARD')}</h3>

            <ul class="section-body">
              <li class="setting-container"
                  title="${msg('HTERM_PREF_KEYBINDINGS_OS_DEFAULTS')}">
                <h4>${msg('HTERM_NAME_PREF_KEYBINDINGS_OS_DEFAULTS')}</h4>
                <terminal-settings-checkbox
                    preference="keybindings-os-defaults">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_PASS_CTRL_N')}">
                <h4>${msg('HTERM_NAME_PREF_PASS_CTRL_N')}</h4>
                <terminal-settings-checkbox preference="pass-ctrl-n">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_PASS_CTRL_T')}">
                <h4>${msg('HTERM_NAME_PREF_PASS_CTRL_T')}</h4>
                <terminal-settings-checkbox preference="pass-ctrl-t">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_PASS_CTRL_W')}">
                <h4>${msg('HTERM_NAME_PREF_PASS_CTRL_W')}</h4>
                <terminal-settings-checkbox preference="pass-ctrl-w">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_PASS_CTRL_TAB')}">
                <h4>${msg('HTERM_NAME_PREF_PASS_CTRL_TAB')}</h4>
                <terminal-settings-checkbox preference="pass-ctrl-tab">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_PASS_CTRL_NUMBER')}">
                <h4>${msg('HTERM_NAME_PREF_PASS_CTRL_NUMBER')}</h4>
                <terminal-settings-checkbox preference="pass-ctrl-number">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_CTRL_PLUS_MINUS_ZERO_ZOOM')}">
                <h4>${msg('HTERM_NAME_PREF_CTRL_PLUS_MINUS_ZERO_ZOOM')}</h4>
                <terminal-settings-checkbox
                    preference="ctrl-plus-minus-zero-zoom">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_CTRL_C_COPY')}">
                <h4>${msg('HTERM_NAME_PREF_CTRL_C_COPY')}</h4>
                <terminal-settings-checkbox preference="ctrl-c-copy">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_CTRL_V_PASTE')}">
                <h4>${msg('HTERM_NAME_PREF_CTRL_V_PASTE')}</h4>
                <terminal-settings-checkbox preference="ctrl-v-paste">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>
          <section>
            <h3>${msg('TERMINAL_TITLE_PREF_MOUSE')}</h3>

            <ul class="section-body">
              <li class="setting-container"
                  title="${msg('HTERM_PREF_SCROLL_ON_KEYSTROKE')}">
                <h4>${msg('HTERM_NAME_PREF_SCROLL_ON_KEYSTROKE')}</h4>
                <terminal-settings-checkbox preference="scroll-on-keystroke">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_SCROLL_ON_OUTPUT')}">
                <h4>${msg('HTERM_NAME_PREF_SCROLL_ON_OUTPUT')}</h4>
                <terminal-settings-checkbox preference="scroll-on-output">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>
          <section>
            <h3>${msg('HTERM_TITLE_PREF_COPYPASTE')}</h3>

            <ul class="section-body">
              <li class="setting-container"
                  title="${msg('HTERM_PREF_COPY_ON_SELECT')}">
                <h4>${msg('HTERM_NAME_PREF_COPY_ON_SELECT')}</h4>
                <terminal-settings-checkbox preference="copy-on-select">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_ENABLE_CLIPBOARD_NOTICE')}">
                <h4>${msg('HTERM_NAME_PREF_ENABLE_CLIPBOARD_NOTICE')}</h4>
                <terminal-settings-checkbox
                    preference="enable-clipboard-notice">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_MOUSE_RIGHT_CLICK_PASTE')}">
                <h4>${msg('HTERM_NAME_PREF_MOUSE_RIGHT_CLICK_PASTE')}</h4>
                <terminal-settings-checkbox
                    preference="mouse-right-click-paste">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>
        </section>

        <section class="terminal-settings-category"
            ?active-category="${this.activeCategory_ === 'behavior'}">
            <h3>${msg('TERMINAL_TITLE_PREF_BEHAVIOR')}</h3>

            <ul class="section-body">
              <li class="setting-container"
                  title="${msg('TERMINAL_PREF_BELL')}">
                <h4>${msg('TERMINAL_NAME_PREF_BELL')}</h4>
                <terminal-settings-checkbox
                    preference="audible-bell-sound"
                    .converter=${BELL_SOUND_CONVERTER}>
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_CLOSE_ON_EXIT')}">
                <h4>${msg('HTERM_NAME_PREF_CLOSE_ON_EXIT')}</h4>
                <terminal-settings-checkbox preference="close-on-exit">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_DESKTOP_NOTIFICATION_BELL')}">
                <h4>${msg('HTERM_NAME_PREF_DESKTOP_NOTIFICATION_BELL')}</h4>
                <terminal-settings-checkbox
                    preference="desktop-notification-bell">
                </terminal-settings-checkbox>
              </li>
            </ul>
        </section>
    `;
  }

  /**
   * @param {!Event} e
   * @private
   */
  onCategoryChange_(e) {
    this.activeCategory_ = e.detail.category;
  }
}

customElements.define('terminal-settings-app', TerminalSettingsApp);
