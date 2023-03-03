// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-app.
 *
 * @suppress {moduleLoad}
 */

import {hterm, lib} from './deps_local.concat.js';

import {getIndexeddbFileSystem} from './nassh_fs.js';

import {LitElement, createRef, css, html, ref, when} from './lit.js';
import {SUPPORTED_FONT_SIZES, SUPPORTED_LINE_HEIGHT,
  SUPPORTED_LINE_HEIGHT_PADDINGS, getOSInfo, isXtermJs}
    from './terminal_common.js';
import './terminal_dropdown.js';
import './terminal_file_editor.js';
import {ICON_OPEN_IN_NEW} from './terminal_icons.js';
import {ProfileType, getProfileIds} from './terminal_profiles.js';
import './terminal_settings_ansi_colors.js';
import './terminal_settings_background_image.js';
import './terminal_settings_category_selector.js';
import './terminal_settings_checkbox.js';
import './terminal_settings_colorpicker.js';
import './terminal_settings_fonts.js';
import './terminal_settings_profile_header.js';
import './terminal_settings_profile_item.js';
import './terminal_settings_row.js';
import './terminal_settings_theme.js';

export const BELL_SOUND_CONVERTER = {
  toChecked: (value) => !!value,
  fromChecked: (checked) => checked ? 'lib-resource:hterm/audio/bell' : '',
};

export class TerminalSettingsApp extends LitElement {
  /** @override */
  static get properties() {
    return {
      activeCategory_: {type: String},
      activeProfileCategory_: {type: String},
      settingsProfiles_: {state: true},
    };
  }

  constructor() {
    super();

    this.activeCategory_ = 'profile';
    this.activeProfileCategory_ = 'appearance';
    this.settingsProfiles_ = [hterm.Terminal.DEFAULT_PROFILE_ID];
    this.activeSettingsProfile_ = hterm.Terminal.DEFAULT_PROFILE_ID;
    this.updateSettingsProfiles_();

    this.fileSystemPromise_ = getIndexeddbFileSystem();
    this.sshKnownHostEditorRef_ = createRef();
    this.sshConfigEditorRef_ = createRef();
  }

  /** @override */
  static get styles() {
    return css`
      :host {
        background: var(--cros-bg-color);
        bottom: 0;
        color: var(--cros-color-secondary);
        display: flex;
        flex-wrap: nowrap;
        font-family: var(--cros-body-1-font-family);
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
        color: var(--cros-menu-label-color);
        font-weight: 400;
        line-height: 24px;
        margin: 12px 0;
      }

      #left-panel {
        min-width: 192px;
      }

      #right-panel {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
      }

      terminal-settings-profile-header {
        padding-left: 32px;
      }

      .terminal-settings-category.profile {
        overflow: visible;
      }

      .terminal-settings-category {
        display: none;
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
        color: var(--cros-color-secondary);
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
        border-bottom: 1px solid var(--cros-separator-color);
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

      .about-link {
        cursor: pointer;
      }

      .icon svg {
        fill: var(--cros-color-secondary);
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
    `;
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

    const xtermJs = isXtermJs(window.preferenceManager);

    return html`
      <div id="left-panel">
        <h1>${msg('PREFERENCES_HEADER_TERMINAL')}</h1>
        ${when(!!getOSInfo().multi_profile, () => html`
          <terminal-settings-profile-header
              @settings-profile-add=${this.onSettingsProfileAdd_}>
          </terminal-settings-profile-header>
          <terminal-settings-category-selector
              @category-change=${this.onCategoryChange_}>
            ${this.settingsProfiles_.map((profile) => html`
              <terminal-settings-profile-item
                  data-name="profile"
                  aria-label="${profile}"
                  .profile="${profile}"
                  @settings-profile-click=${this.onSettingsProfileClick_}
                  @settings-profile-delete=${this.onSettingsProfileDelete_}>
              </terminal-settings-profile-item>
            `)}
            <div data-name="ssh">SSH</div>
            <div data-name="about">
              ${msg('TERMINAL_SETTINGS_ABOUT_LABEL')}
            </div>
          </terminal-settings-category-selector>
        `, () => html`
          <terminal-settings-category-selector
              @category-change=${this.onCategoryChange_}>
            <div data-name="appearance">
              ${msg('TERMINAL_TITLE_PREF_APPEARANCE')}
            </div>
            <div data-name="mousekeyboard">
              ${msg('TERMINAL_TITLE_PREF_KEYBOARD_MOUSE')}
            </div>
            <div data-name="behavior">
              ${msg('TERMINAL_TITLE_PREF_BEHAVIOR')}
            </div>
            <div data-name="ssh">SSH</div>
            <div data-name="about">
              ${msg('TERMINAL_SETTINGS_ABOUT_LABEL')}
            </div>
          </terminal-settings-category-selector>
        `)}
      </div>
      <div id="right-panel">

        ${when(!!getOSInfo().multi_profile, () => html`
          <section class="terminal-settings-category profile"
              ?active-category="${this.activeCategory_ === 'profile'}">
            <terminal-settings-category-selector tabs
                @category-change=${this.onProfileCategoryChange_}>
              <div data-name="appearance">
                ${msg('TERMINAL_TITLE_PREF_APPEARANCE')}
              </div>
              <div data-name="mousekeyboard">
                ${msg('TERMINAL_TITLE_PREF_KEYBOARD_MOUSE')}
              </div>
              <div data-name="behavior">
                ${msg('TERMINAL_TITLE_PREF_BEHAVIOR')}
              </div>
            </terminal-settings-category-selector>
          </section>
        `)}

        <section class="terminal-settings-category"
            ?active-category="${this.isActive_('appearance')}">
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
              ${when(!xtermJs, () => html`
                <li class="setting-container"
                    title="${msg('HTERM_PREF_FONT_SMOOTHING')}">
                  <h4>${msg('TERMINAL_NAME_PREF_ANTI_ALIAS')}</h4>
                  <terminal-settings-checkbox preference="font-smoothing">
                  </terminal-settings-checkbox>
                </li>
              `)}
              <li class="setting-container"
                  title="${msg('TERMINAL_PREF_ANSI_COLORS')}">
                <h4>${msg('TERMINAL_NAME_PREF_ANSI_COLORS')}</h4>
                <terminal-settings-ansi-colors
                    preference="color-palette-overrides">
                </terminal-settings-ansi-colors>
              </li>

              ${when(xtermJs, () => html`
                <li class="setting-container"
                    title="${msg('TERMINAL_PREF_LINE_HEIGHT')}">
                  <h4>${msg('TERMINAL_NAME_PREF_LINE_HEIGHT')}</h4>
                  <terminal-settings-dropdown
                      preference="line-height"
                      .options="${SUPPORTED_LINE_HEIGHT.map(
                        (value) => ({value}))}"
                  >
                  </terminal-settings-dropdown>
                </li>
              `, () => html`
                <li class="setting-container"
                    title="${msg('HTERM_PREF_LINE_HEIGHT_PADDING_SIZE')}">
                  <h4>${msg('HTERM_NAME_PREF_LINE_HEIGHT_PADDING_SIZE')}</h4>
                  <!-- TODO(easy): Support text field entry. -->
                  <terminal-settings-dropdown
                      preference="line-height-padding-size"
                      .options="${SUPPORTED_LINE_HEIGHT_PADDINGS.map(
                        (value) => ({value}))}"
                  >
                  </terminal-settings-dropdown>
                </li>
              `)}
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

          ${when(!xtermJs, () => html`
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
          `)}
        </section>

        <section class="terminal-settings-category"
            ?active-category="${this.isActive_('mousekeyboard')}">
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

            <!-- TODO(lxj): it might make more sense to move these to the
                behavior section. -->
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
            ?active-category="${this.isActive_('behavior')}">
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
      </div>
    `;
  }

  /**
   * @param {string} category
   * @return {boolean}
   */
  isActive_(category) {
    if (getOSInfo().multi_profile) {
      return this.activeCategory_ === 'profile' &&
           this.activeProfileCategory_ === category;
    } else {
      return this.activeCategory_ === category;
    }
  }

  /**
   * @param {!Event} e
   * @private
   */
  onCategoryChange_(e) {
    this.activeCategory_ = e.detail.category;
  }

  /**
   * @param {!Event} e
   * @private
   */
  onProfileCategoryChange_(e) {
    this.activeProfileCategory_ = e.detail.category;
  }

  async updateSettingsProfiles_() {
    const profiles = await getProfileIds(ProfileType.HTERM);
    this.settingsProfiles_ = [hterm.Terminal.DEFAULT_PROFILE_ID,
        ...profiles.filter((i) => i !== hterm.Terminal.DEFAULT_PROFILE_ID)];
  }

  /**
   * @param {!Event} e
   * @private
   */
  onSettingsProfileClick_(e) {
    const profile = e.detail.profile;
    const i = this.settingsProfiles_.indexOf(profile);
    if (i === -1) {
      console.error(`Could not switch to profile ${profile}`);
      return;
    }
    this.activeSettingsProfile_ = profile;
    window.preferenceManager.setProfile(profile);
  }

  /**
   * @param {string} profile
   */
  clickProfile_(profile) {
    const i = this.settingsProfiles_.indexOf(profile);
    if (i === -1) {
      console.error(`Could not click profile ${profile}`);
      return;
    }
    this.shadowRoot.querySelectorAll(
        'terminal-settings-profile-item')[i].click();
  }

  /**
   * @param {!Event} e
   * @private
   */
  async onSettingsProfileAdd_(e) {
    await this.updateSettingsProfiles_();
    this.clickProfile_(e.detail.profile);
  }

  /**
   * @param {!Event} e
   * @private
   */
  async onSettingsProfileDelete_(e) {
    let active = this.activeSettingsProfile_;
    const activeIndex = this.settingsProfiles_.indexOf(active);
    await this.updateSettingsProfiles_();
    // If active profile is deleted, then select previous.
    if (active === e.detail.profile) {
      active = this.settingsProfiles_[activeIndex - 1];
    }
    this.clickProfile_(active);
  }
}

customElements.define('terminal-settings-app', TerminalSettingsApp);
