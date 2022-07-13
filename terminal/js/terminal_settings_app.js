// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-app.
 *
 * @suppress {moduleLoad}
 */

import {getDomFileSystem} from './nassh_fs.js';

import {LitElement, createRef, css, html, ref, when} from './lit.js';
import {SUPPORTED_FONT_SIZES, SUPPORTED_LINE_HEIGHT_PADDINGS,
  TERMINAL_EMULATORS, getOSInfo} from './terminal_common.js';
import './terminal_dropdown.js';
import './terminal_file_editor.js';
import {ICON_OPEN_IN_NEW} from './terminal_icons.js';
import {stylesVars} from './terminal_settings_styles.js';
import './terminal_settings_ansi_colors.js';
import './terminal_settings_background_image.js';
import './terminal_settings_category_selector.js';
import './terminal_settings_checkbox.js';
import './terminal_settings_colorpicker.js';
import './terminal_settings_fonts.js';
import './terminal_settings_profile_selector.js';
import './terminal_settings_row.js';
import './terminal_settings_theme.js';

export const BELL_SOUND_CONVERTER = {
  toChecked: (value) => !!value,
  fromChecked: (checked) => checked ? 'lib-resource:hterm/audio/bell' : '',
};

const TERMINAL_EMULATOR_OPTIONS =
    Array.from(TERMINAL_EMULATORS.keys()).map((value) => ({value}));

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

    this.fileSystemPromise_ = getDomFileSystem();
    this.sshKnownHostEditorRef_ = createRef();
    this.sshConfigEditorRef_ = createRef();
  }

  /** @override */
  static get styles() {
    return [stylesVars, css`
      :host {
        bottom: 0;
        color: rgb(95, 99, 104);
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

      h1 {
        font-size: 16px;
        font-weight: 500;
        line-height: 20px;
        margin: 18px 0 23px 0;
        padding-left: 24px;
      }

      h4 {
        color: #212121;
        font-weight: 400;
        line-height: 24px;
        margin: 12px 0;
      }

      #left-panel {
        min-width: 192px;
      }

      terminal-settings-profile-selector {
        padding-left: 32px;
      }

      .terminal-settings-category {
        display: none;
        flex-grow: 1;
        overflow: auto;
        padding: 4px 40px;
      }

      .terminal-settings-category > section {
        margin-bottom: 20px;
        width: 100%;
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

      terminal-settings-row {
        margin-left: 32px;
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

      terminal-settings-dropdown {
        min-width: 80px;
      }

      terminal-settings-dropdown[preference='terminal-emulator'] {
        min-width: 200px;
      }

      .about-link {
        cursor: pointer;
      }

      .icon svg {
        fill: rgb(95,99,104);
        height: 20px;
        width: 20px;
      }

      terminal-file-editor {
        height: 350px;
      }

      @media(max-width: 680px) {
        #left-panel {
          min-width: 168px;
        }

        .terminal-settings-category {
          padding: 4px 16px;
        }
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

    const profileCategory =
        getOSInfo().multi_profile ? 'profile-category' : '';

    return html`
        <div id="left-panel">
          <h1>${msg('PREFERENCES_HEADER_TERMINAL')}</h1>
          ${when(!!getOSInfo().multi_profile, () => html`
            <terminal-settings-profile-selector>
            </terminal-settings-profile-selector>
          `)}
          <terminal-settings-category-selector
              @category-change="${this.onCategoryChange_}">
            <div data-name="appearance" class="${profileCategory}">
              ${msg('TERMINAL_TITLE_PREF_APPEARANCE')}
            </div>
            <div data-name="mousekeyboard" class="${profileCategory}">
              ${msg('TERMINAL_TITLE_PREF_KEYBOARD_MOUSE')}
            </div>
            <div data-name="behavior" class="${profileCategory}">
              ${msg('TERMINAL_TITLE_PREF_BEHAVIOR')}
            </div>
            <div data-name="ssh">SSH</div>
            <div data-name="about">
              ${msg('TERMINAL_SETTINGS_ABOUT_LABEL')}
            </div>
          </terminal-settings-category-selector>
        </div>

        <section class="terminal-settings-category"
            ?active-category="${this.activeCategory_ === 'appearance'}">
          <section>
            <h3>${msg('TERMINAL_TITLE_THEME')}</h3>
            <terminal-settings-theme></terminal-settings-theme>
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
                <terminal-settings-background-image />
              </li>
            </ul>
          </section>

          <section>
            <h3>${msg('TERMINAL_TITLE_PREF_TEXT')}</h3>

            <ul class="section-body">
              <li class="setting-container">
                <h4>${msg('TERMINAL_NAME_PREF_FONT')}</h4>
                <terminal-settings-fonts></terminal-settings-fonts>
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
              <li class="setting-container"
                  title="${msg('HTERM_PREF_LINE_HEIGHT_PADDING_SIZE')}">
                <h4>${msg('HTERM_NAME_PREF_LINE_HEIGHT_PADDING_SIZE')}</h4>
                <!-- TODO(easy): Support text field entry. -->
                <terminal-settings-dropdown
                    preference="line-height-padding-size"
                    title="${msg('HTERM_PREF_FONT_SIZE')}"
                    .options="${SUPPORTED_LINE_HEIGHT_PADDINGS.map(
                      (value) => ({value}))}"
                >
                </terminal-settings-dropdown>
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
                  title="${msg('HTERM_PREF_PASS_ALT_NUMBER')}">
                <h4>${msg('HTERM_NAME_PREF_PASS_ALT_NUMBER')}</h4>
                <terminal-settings-checkbox preference="pass-alt-number">
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
              ${when(!!getOSInfo().alternative_emulator, () => html`
                <li class="setting-container">
                  <h4>${msg('TERMINAL_NAME_PREF_TERMINAL_EMULATOR')}</h4>
                  <terminal-settings-dropdown
                    preference="terminal-emulator"
                    .options="${TERMINAL_EMULATOR_OPTIONS}">
                  </terminal-settings-dropdown>
                </li>
              `)}

              <li class="setting-container"
                  title="${msg('TERMINAL_PREF_BELL')}">
                <h4>${msg('TERMINAL_NAME_PREF_BELL')}</h4>
                <terminal-settings-checkbox
                    preference="audible-bell-sound"
                    .converter=${BELL_SOUND_CONVERTER}>
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_ENABLE_RESIZE_STATUS')}">
                <h4>${msg('HTERM_NAME_PREF_ENABLE_RESIZE_STATUS')}</h4>
                <terminal-settings-checkbox preference="enable-resize-status">
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

        <section class="terminal-settings-category"
            ?active-category="${this.activeCategory_ === 'ssh'}">
          <h3>SSH Files</h3>

          <terminal-settings-row label="~/.ssh/known_hosts" expandable
              @expand=${() => this.sshKnownHostEditorRef_.value.load()}>
            <terminal-file-editor ${ref(this.sshKnownHostEditorRef_)}
                .fileSystemPromise=${this.fileSystemPromise_}
                path="/.ssh/known_hosts">
            </terminal-file-editor>
          </terminal-settings-row>

          <terminal-settings-row label="~/.ssh/config" expandable
              @expand=${() => this.sshConfigEditorRef_.value.load()}>
            <terminal-file-editor ${ref(this.sshConfigEditorRef_)}
                .fileSystemPromise=${this.fileSystemPromise_}
                path="/.ssh/config">
            </terminal-file-editor>
          </terminal-settings-row>
        </section>

        <section class="terminal-settings-category"
            ?active-category="${this.activeCategory_ === 'about'}">
          <h3>${msg('TERMINAL_SETTINGS_ABOUT_LABEL')}</h3>
          <ul class="section-body">
            <li class="setting-container about-link" role="link"
                @click="${() => lib.f.openWindow('/html/licenses.html')}">
                <h4>${msg('LICENSES')}</h4>
                <span class="icon">${ICON_OPEN_IN_NEW}</span>
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
