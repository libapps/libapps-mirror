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
                          "monospace";

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
      return "Auto";
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

    this.activeCategory_ = "appearance";
  }

  /** @override */
  async performUpdate() {
    // A lot of elements in this page assume preference manager has been loaded.
    await window.preferenceManagerLoaded;
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
    return html`
        <!-- TODO(juwa@google.com): Add translations -->
        <terminal-settings-category-selector
            @category-change="${this.onCategoryChange_}">
          <terminal-settings-category-option for="appearance">
            <h2 slot="title">Appearance</h2>
          </terminal-settings-category-option>
          <terminal-settings-category-option for="mousekeyboard">
            <h2 slot="title">Mouse & Keyboard</h2>
          </terminal-settings-category-option>
          <terminal-settings-category-option for="behavior">
            <h2 slot="title">Behavior</h2>
          </terminal-settings-category-option>
        </terminal-settings-category-selector>

        <section class="terminal-settings-category"
            ?active-category="${this.activeCategory_ === "appearance"}">
          <section>
            <h3>Background</h3>

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
                <h4>Background color</h4>
                <terminal-settings-colorpicker preference="background-color">
                </terminal-settings-colorpicker>
              </li>
              <li class="setting-container">
                <h4>Background image</h4>
                <!-- TODO(juwa@google.com): Add element -->
                <input type="checkbox" />
              </li>
              <!-- TODO(juwa@google.com): Hide image options if no image
                  selected -->
              <li class="setting-container">
                <h4>Background image position</h4>
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
            <h3>Text</h3>

            <ul class="section-body">
              <li class="setting-container">
                <h4>Font face</h4>
                <terminal-settings-dropdown preference="font-family"
                  .options=${FONT_FAMILY_OPTIONS}>
                </terminal-settings-dropdown>
              </li>
              <li class="setting-container">
                <h4>Font size</h4>
                <!-- TODO(lxj@google.com): Options' value is taken from the UX
                    mock. We might want a wider range of choices. -->
                <terminal-settings-dropdown preference="font-size"
                  .options=${[6, 8, 10, 12, 14, 16, 18]}>
                </terminal-settings-dropdown>
              </li>
              <li class="setting-container">
                <h4>Font color</h4>
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
            <h3>Cursor</h3>

            <ul class="section-body">
              <li class="setting-container">
                <h4>Cursor shape</h4>
                <terminal-settings-dropdown preference="cursor-shape">
                </terminal-settings-dropdown>
              </li>
              <li class="setting-container">
                <h4>Cursor color</h4>
                <terminal-settings-colorpicker preference="cursor-color">
                </terminal-settings-colorpicker>
              </li>
              <li class="setting-container">
                <h4>Cursor blink</h4>
                <terminal-settings-checkbox preference="cursor-blink">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>

          <section>
            <h3>Scrollbar</h3>

            <ul class="section-body">
              <li class="setting-container">
                <h4>Scrollbar visibility</h4>
                <terminal-settings-checkbox preference="scrollbar-visible">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>
        </section>

        <section class="terminal-settings-category"
            ?active-category="${this.activeCategory_ === "mousekeyboard"}">
          <section>
            <h3>Keyboard</h3>

            <ul class="section-body">
              <li class="setting-container">
                <h4>Ctrl-+/-/0 zoom behavior</h4>
                <terminal-settings-checkbox
                    preference="ctrl-plus-minus-zero-zoom">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>Ctrl-C copy behavior</h4>
                <terminal-settings-checkbox preference="ctrl-c-copy">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>Ctrl-V paste behavior</h4>
                <terminal-settings-checkbox preference="ctrl-v-paste">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>Hide mouse cursor while typing</h4>
                <!-- TODO(juwa@google.com): Add element -->
                <select></select>
              </li>
              <li class="setting-container">
                <h4>AltGr key mode</h4>
                <terminal-settings-dropdown
                    preference="alt-gr-mode"
                    .toText=${altGrModeToText}>
                </terminal-settings-dropdown>
              </li>
              <li class="setting-container">
                <h4>Alt-Backspace is Meta-Backspace</h4>
                <terminal-settings-checkbox
                    preference="alt-backspace-is-meta-backspace">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>Treat Alt key as Meta Key</h4>
                <terminal-settings-checkbox preference="alt-is-meta">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>Alt key modifier handling</h4>
                <terminal-settings-dropdown preference="alt-sends-what">
                </terminal-settings-dropdown>
              </li>
              <li class="setting-container">
                <h4>Backspace key behavior</h4>
                <terminal-settings-checkbox
                    preference="backspace-sends-backspace">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>East Asian Ambiguous use two columns</h4>
                <terminal-settings-checkbox
                    preference="east-asian-ambiguous-as-two-column">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>Support non-UTF-8 C1 control characters</h4>
                <terminal-settings-checkbox preference="enable-8-bit-control">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>Home/End key scroll behavior</h4>
                <terminal-settings-checkbox preference="home-keys-scroll">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>
          <section>
            <h3>Mouse</h3>

            <ul class="section-body">
              <li class="setting-container">
                <h4>Scroll to bottom after keystroke</h4>
                <terminal-settings-checkbox preference="scroll-on-keystroke">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>Scroll to bottom after new output</h4>
                <terminal-settings-checkbox preference="scroll-on-output">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>Emulate arrow keys with scroll wheel</h4>
                <terminal-settings-checkbox
                    preference="scroll-wheel-may-send-arrow-keys">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>
          <section>
            <h3>Copy & paste</h3>

            <ul class="section-body">
              <li class="setting-container">
                <h4>Automatically copy selected content</h4>
                <terminal-settings-checkbox preference="copy-on-select">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>Show notification when copying content</h4>
                <terminal-settings-checkbox
                    preference="enable-clipboard-notice">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>Mouse right click pastes content</h4>
                <terminal-settings-checkbox
                    preference="mouse-right-click-paste">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>Automatically clear text selection</h4>
                <terminal-settings-checkbox
                    preference="clear-selection-after-copy">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>
        </section>

        <section class="terminal-settings-category"
            ?active-category="${this.activeCategory_ === "behavior"}">
            <h3>Behavior</h3>

            <ul class="section-body">
              <li class="setting-container">
                <h4>Terminal bell</h4>
                <terminal-settings-checkbox
                    preference="audible-bell-sound"
                    .converter=${BELL_SOUND_CONVERTER}>
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>Close window on exit</h4>
                <terminal-settings-checkbox preference="close-on-exit">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>Create desktop notifications for alert bells</h4>
                <terminal-settings-checkbox
                    preference="desktop-notification-bell">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>Allow changing of text cursor blinking</h4>
                <terminal-settings-checkbox preference="enable-dec12">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>Allow clearing of scrollback buffer</h4>
                <terminal-settings-checkbox preference="enable-csi-j-3">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container">
                <h4>Receive encoding</h4>
                <terminal-settings-dropdown preference="receive-encoding">
                </terminal-settings-dropdown>
              </li>
              <li class="setting-container">
                <h4>Terminal encoding</h4>
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
