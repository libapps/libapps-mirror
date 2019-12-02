// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-app.
 *
 * @suppress {moduleLoad}
 */

import {css, html, LitElement} from './lit_element.js';
import './terminal_settings_app.js';
import './terminal_settings_category_selector.js';
import './terminal_settings_checkbox.js';
import './terminal_settings_colorpicker.js';
import './terminal_settings_dropdown.js';
import './terminal_settings_hue_slider.js';
import './terminal_settings_saturation_lightness_picker.js';
import './terminal_settings_theme.js';
import './terminal_settings_transparency_slider.js';

const THEME_FONT_FAMILY = "'DejaVu Sans Mono', 'Noto Sans Mono', " +
                          "'Everson Mono', FreeMono, Menlo, Terminal, " +
                          'monospace';

const BELL_SOUND_CONVERTER = {
  toChecked: value => !!value,
  fromChecked: checked => checked ? 'lib-resource:hterm/audio/bell' : '',
};

/**
 * @param {null|string} mode
 * @return {string}
 */
function altGrModeToText(mode) {
  switch (mode) {
    case null:
      return 'Auto';
    case 'none':
      return 'Disable';
    default:
      return mode;
  }
}

// TODO(lxj@google.com): These are hand picked monospace fonts available on
// Chrome OS. We might want to find a better way instead of hard coding.
const FONT_FAMILY_OPTIONS = [
    'Cousine',
    'monospace',
    'Noto Sans Mono',
    'Noto Sans Mono CJK HK',
    'Noto Sans Mono CJK JP',
    'Noto Sans Mono CJK KR',
    'Noto Sans Mono CJK SC',
    'Noto Sans Mono CJK TC',
];

export class TerminalSettingsApp extends LitElement {
  /** @override */
  static get properties() {
    return {
      activeCategory_: { type: String },
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
    return css`
      :host {
        bottom: 0;
        color: rgb(95, 99, 104);
        display: flex;
        flex-wrap: nowrap;
        font-family: 'Roboto';
        font-size: small;
        left: 0;
        line-height: 2.65em;
        margin: 0;
        padding: 0;
        position: absolute;
        right: 0;
        top: 0;
      }

      terminal-settings-category-option {
        cursor: pointer;
      }

      terminal-settings-category-option > h2 {
        border-radius: 0 20px 20px 0;
        padding: 0 40px 0 20px;
        user-select: none;
      }

      terminal-settings-category-option:hover > h2 {
        background-color: rgb(240, 240, 240);
      }

      terminal-settings-category-option[active] > h2 {
        background-color: rgb(210, 227, 252);
        color: rgb(26, 115, 232);
      }

      .terminal-settings-category {
        display: none;
        flex-grow: 1;
        margin: 0 40px;
        overflow: auto;
      }

      .terminal-settings-category[active-category] {
        display: block;
      }

      .section-body {
        margin: 0;
        padding: 0;
      }

      .setting-container {
        align-items: center;
        border-bottom: 1px solid lightgrey;
        display: flex;
        flex-wrap: nowrap;
        justify-content: space-between;
        margin: 0;
        padding: 0 20px;
      }

      .theme-setting-container {
        display: block;
        padding-bottom: 15px;
      }

      .theme-picker > terminal-settings-theme {
        box-shadow: 3px 3px 2px rgba(0, 0, 0, 0.2);
        display: inline-block;
        height: 140px;
        margin: 5px;
        width: 140px;
      }
    `;
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);

    return html`
        <!-- TODO(juwa@google.com): Add translations -->
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
            <h3>${msg('TERMINAL_TITLE_PREF_BACKGROUND')}</h3>

            <ul class="section-body">
              <li class="setting-container theme-setting-container">
                <h4>Pick a theme, or fully customize your Terminal</h4>
                <div class="theme-picker">
                  <terminal-settings-theme
                      name="Small dark mode"
                      backgroundcolor="#444444"
                      fontcolor="#0cd44b"
                      fontsize="15"
                      fontfamily="${THEME_FONT_FAMILY}">
                  </terminal-settings-theme>
                  <terminal-settings-theme
                      name="Big dark mode"
                      backgroundcolor="#444444"
                      fontcolor="#0cd44b"
                      fontsize="20"
                      fontfamily="${THEME_FONT_FAMILY}">
                  </terminal-settings-theme>
                  <terminal-settings-theme
                      name="Small light mode"
                      backgroundcolor="#dddddd"
                      fontcolor="#7d0f5b"
                      fontsize="15"
                      fontfamily="${THEME_FONT_FAMILY}">
                  </terminal-settings-theme>
                  <terminal-settings-theme
                      name="Big light mode"
                      backgroundcolor="#dddddd"
                      fontcolor="#7d0f5b"
                      fontsize="20"
                      fontfamily="${THEME_FONT_FAMILY}">
                  </terminal-settings-theme>
                </div>
              </li>
              <li class="setting-container">
                <h4>${msg('TERMINAL_NAME_PREF_COLOR')}</h4>
                <terminal-settings-colorpicker preference="background-color">
                </terminal-settings-colorpicker>
              </li>
              <li class="setting-container">
                <h4>${msg('TERMINAL_NAME_PREF_IMAGE')}</h4>
                <!-- TODO(juwa@google.com): Add element -->
                <input type="checkbox" />
              </li>
              <!-- TODO(juwa@google.com): Hide image options if no image
                  selected -->
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_BACKGROUND_POSITION')}</h4>
                <!-- TODO(juwa@google.com): Add element -->
                <select></select>
              </li>
              <li class="setting-container">
                <h4>Background image blending</h4>
                <!-- TODO(juwa@google.com): Add element -->
                <input type="range" />
              </li>
            </ul>
          </section>

          <section>
            <h3>${msg('TERMINAL_TITLE_PREF_TEXT')}</h3>

            <ul class="section-body">
              <!-- TODO(lxj@google.com): merge options font family and font
                  size -->
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_FONT_FAMILY')}</h4>
                <terminal-settings-dropdown preference="font-family"
                  .options=${FONT_FAMILY_OPTIONS}>
                </terminal-settings-dropdown>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_FONT_SIZE')}</h4>
                <!-- TODO(lxj@google.com): Options' value is taken from the UX
                    mock. We might want a wider range of choices. -->
                <terminal-settings-dropdown preference="font-size"
                  .options=${[6, 8, 10, 12, 14, 16, 18]}>
                </terminal-settings-dropdown>
              </li>
              <li class="setting-container">
                <h4>${msg('TERMINAL_NAME_PREF_COLOR')}</h4>
                <terminal-settings-colorpicker preference="foreground-color">
                </terminal-settings-colorpicker>
              </li>
              <li class="setting-container">
                <h4>Anti-alias</h4>
                <!-- TODO(juwa@google.com): Add element -->
                <terminal-settings-checkbox preference="font-smoothing">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>

          <section>
            <h3>${msg('TERMINAL_TITLE_PREF_CURSOR')}</h3>

            <ul class="section-body">
              <li class="setting-container">
                <h4>${msg('TERMINAL_NAME_PREF_SHAPE')}</h4>
                <terminal-settings-dropdown preference="cursor-shape">
                </terminal-settings-dropdown>
              </li>
              <li class="setting-container">
                <h4>${msg('TERMINAL_NAME_PREF_COLOR')}</h4>
                <terminal-settings-colorpicker preference="cursor-color">
                </terminal-settings-colorpicker>
              </li>
              <li class="setting-container">
                <h4>${msg('TERMINAL_NAME_PREF_BLINKING')}</h4>
                <terminal-settings-checkbox preference="cursor-blink">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>

          <section>
            <h3>${msg('TERMINAL_TITLE_PREF_SCROLLBAR')}</h3>

            <ul class="section-body">
              <li class="setting-container">
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
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_CTRL_PLUS_MINUS_ZERO_ZOOM')}</h4>
                <terminal-settings-checkbox
                    preference="ctrl-plus-minus-zero-zoom">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_CTRL_C_COPY')}</h4>
                <terminal-settings-checkbox preference="ctrl-c-copy">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_CTRL_V_PASTE')}</h4>
                <terminal-settings-checkbox preference="ctrl-v-paste">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_HIDE_MOUSE_WHILE_TYPING')}</h4>
                <!-- TODO(juwa@google.com): Add element -->
                <select></select>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_ALT_GR_MODE')}</h4>
                <terminal-settings-dropdown
                    preference="alt-gr-mode"
                    .toText=${altGrModeToText}>
                </terminal-settings-dropdown>
              </li>
              <li class="setting-container">
                <h4>
                  ${msg('HTERM_NAME_PREF_ALT_BACKSPACE_IS_META_BACKSPACE')}
                </h4>
                <terminal-settings-checkbox
                    preference="alt-backspace-is-meta-backspace">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_ALT_IS_META')}</h4>
                <terminal-settings-checkbox preference="alt-is-meta">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_ALT_SENDS_WHAT')}</h4>
                <terminal-settings-dropdown preference="alt-sends-what">
                </terminal-settings-dropdown>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_BACKSPACE_SENDS_BACKSPACE')}</h4>
                <terminal-settings-checkbox
                    preference="backspace-sends-backspace">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>
                  ${msg('HTERM_NAME_PREF_EAST_ASIAN_AMBIGUOUS_AS_TWO_COLUMN')}
                </h4>
                <terminal-settings-checkbox
                    preference="east-asian-ambiguous-as-two-column">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_ENABLE_8_BIT_CONTROL')}</h4>
                <terminal-settings-checkbox preference="enable-8-bit-control">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_HOME_KEYS_SCROLL')}</h4>
                <terminal-settings-checkbox preference="home-keys-scroll">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>
          <section>
            <h3>${msg('TERMINAL_TITLE_PREF_MOUSE')}</h3>

            <ul class="section-body">
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_SCROLL_ON_KEYSTROKE')}</h4>
                <terminal-settings-checkbox preference="scroll-on-keystroke">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_SCROLL_ON_OUTPUT')}</h4>
                <terminal-settings-checkbox preference="scroll-on-output">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>
                  ${msg('HTERM_NAME_PREF_SCROLL_WHEEL_MAY_SEND_ARROW_KEYS')}
                </h4>
                <terminal-settings-checkbox
                    preference="scroll-wheel-may-send-arrow-keys">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>
          <section>
            <h3>${msg('HTERM_TITLE_PREF_COPYPASTE')}</h3>

            <ul class="section-body">
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_COPY_ON_SELECT')}</h4>
                <terminal-settings-checkbox preference="copy-on-select">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_ENABLE_CLIPBOARD_NOTICE')}</h4>
                <terminal-settings-checkbox
                    preference="enable-clipboard-notice">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_MOUSE_RIGHT_CLICK_PASTE')}</h4>
                <terminal-settings-checkbox
                    preference="mouse-right-click-paste">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_CLEAR_SELECTION_AFTER_COPY')}</h4>
                <terminal-settings-checkbox
                    preference="clear-selection-after-copy">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>
        </section>

        <section class="terminal-settings-category"
            ?active-category="${this.activeCategory_ === 'behavior'}">
            <h3>${msg('TERMINAL_TITLE_PREF_BEHAVIOR')}</h3>

            <ul class="section-body">
              <li class="setting-container">
                <h4>${msg('TERMINAL_NAME_PREF_BELL')}</h4>
                <terminal-settings-checkbox
                    preference="audible-bell-sound"
                    .converter=${BELL_SOUND_CONVERTER}>
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_CLOSE_ON_EXIT')}</h4>
                <terminal-settings-checkbox preference="close-on-exit">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_DESKTOP_NOTIFICATION_BELL')}</h4>
                <terminal-settings-checkbox
                    preference="desktop-notification-bell">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_ENABLE_DEC12')}</h4>
                <terminal-settings-checkbox preference="enable-dec12">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_ENABLE_CSI_J_3')}</h4>
                <terminal-settings-checkbox preference="enable-csi-j-3">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_RECEIVE_ENCODING')}</h4>
                <terminal-settings-dropdown preference="receive-encoding">
                </terminal-settings-dropdown>
              </li>
              <li class="setting-container">
                <h4>${msg('HTERM_NAME_PREF_TERMINAL_ENCODING')}</h4>
                <terminal-settings-dropdown preference="terminal-encoding">
                </terminal-settings-dropdown>
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
