// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-app.
 *
 * @suppress {moduleLoad}
 */

import {lib} from '../../libdot/index.js';
import {hterm} from '../../hterm/index.js';

import {getIndexeddbFileSystem} from './nassh_fs.js';

import {LitElement, createRef, css, html, ref} from './lit.js';
import {SUPPORTED_FONT_SIZES, SUPPORTED_LINE_HEIGHT,
  backgroundImageLocalStorageKeyForProfileId}
    from './terminal_common.js';
import './terminal_dropdown.js';
import './terminal_file_editor.js';
import {ICON_OPEN_IN_NEW} from './terminal_icons.js';
import {ProfileType, getProfileIds, setProfileIds}
    from './terminal_profiles.js';
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
import './terminal_settings_scrollback_limit.js';

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

      .label {
        color: var(--cros-menu-label-color);
        flex-grow: 1;
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

    return html`
      <div id="left-panel">
        <h1>${msg('PREFERENCES_HEADER_TERMINAL')}</h1>
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
      </div>
      <div id="right-panel">

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
                <div class="label">${msg('TERMINAL_NAME_PREF_COLOR')}</div>
                <terminal-settings-colorpicker
                    ariaLabel="${msg('TERMINAL_NAME_PREF_COLOR')}"
                    preference="background-color"
                    disableTransparency>
                </terminal-settings-colorpicker>
              </li>
              <li class="setting-container"
                  title="${msg('TERMINAL_SETTINGS_BACKGROUND_IMAGE_HELP')}">
                <div class="label">${msg('TERMINAL_NAME_PREF_IMAGE')}</div>
                <terminal-settings-background-image />
              </li>
            </ul>
          </section>

          <section>
            <h3>${msg('TERMINAL_TITLE_PREF_TEXT')}</h3>

            <ul class="section-body">
              <li class="setting-container">
                <div class="label">${msg('TERMINAL_NAME_PREF_FONT')}</div>
                <terminal-settings-fonts
                    ariaLabel="${msg('TERMINAL_NAME_PREF_FONT')}">
                </terminal-settings-fonts>
                <!-- TODO(lxj@google.com): We should allow user to input a
                    text size not in the list. -->
                <terminal-settings-dropdown
                    ariaLabel="${msg('HTERM_NAME_PREF_FONT_SIZE')}"
                    preference="font-size"
                    title="${msg('HTERM_PREF_FONT_SIZE')}"
                    .options="${SUPPORTED_FONT_SIZES.map((value) => ({value}))}"
                >
                </terminal-settings-dropdown>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_FOREGROUND_COLOR')}">
                <div class="label">${msg('TERMINAL_NAME_PREF_COLOR')}</div>
                <terminal-settings-colorpicker
                    ariaLabel="${msg('TERMINAL_NAME_PREF_COLOR')}"
                    preference="foreground-color">
                </terminal-settings-colorpicker>
              </li>
              <li class="setting-container"
                  title="${msg('TERMINAL_PREF_ANSI_COLORS')}">
                <div class="label">
                  ${msg('TERMINAL_NAME_PREF_ANSI_COLORS')}
                </div>
                <terminal-settings-ansi-colors
                    preference="color-palette-overrides">
                </terminal-settings-ansi-colors>
              </li>

              <li class="setting-container"
                  title="${msg('TERMINAL_PREF_LINE_HEIGHT')}">
                <div class="label">
                  ${msg('TERMINAL_NAME_PREF_LINE_HEIGHT')}
                </div>
                <terminal-settings-dropdown
                    ariaLabel="${msg('TERMINAL_NAME_PREF_LINE_HEIGHT')}"
                    preference="line-height"
                    .options="${SUPPORTED_LINE_HEIGHT.map(
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
                <div class="label">${msg('TERMINAL_NAME_PREF_SHAPE')}</div>
                <terminal-settings-dropdown
                    ariaLabel="${msg('TERMINAL_NAME_PREF_SHAPE')}"
                    preference="cursor-shape"
                    .options="${cursorShapeOptions}">
                </terminal-settings-dropdown>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_CURSOR_COLOR')}">
                <div class="label">${msg('TERMINAL_NAME_PREF_COLOR')}</div>
                <terminal-settings-colorpicker
                    ariaLabel="${msg('TERMINAL_NAME_PREF_COLOR')}"
                    preference="cursor-color">
                </terminal-settings-colorpicker>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_CURSOR_BLINK')}">
                <div class="label">${msg('TERMINAL_NAME_PREF_BLINKING')}</div>
                <terminal-settings-checkbox
                    ariaLabel="${msg('TERMINAL_NAME_PREF_BLINKING')}"
                    preference="cursor-blink">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>

          <section>
            <h3>${msg('TERMINAL_TITLE_PREF_SCROLLBAR')}</h3>

            <ul class="section-body">
              <li class="setting-container"
                  title="${msg('HTERM_PREF_SCROLLBAR_VISIBLE')}">
                <div class="label">${msg('TERMINAL_NAME_PREF_VISIBLE')}</div>
                <terminal-settings-checkbox
                    ariaLabel="${msg('TERMINAL_NAME_PREF_VISIBLE')}"
                    preference="scrollbar-visible">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>
        </section>

        <section class="terminal-settings-category"
            ?active-category="${this.isActive_('mousekeyboard')}">
          <section>
            <h3>${msg('HTERM_TITLE_PREF_KEYBOARD')}</h3>

            <ul class="section-body">
              <li class="setting-container"
                  title="${msg('HTERM_PREF_KEYBINDINGS_OS_DEFAULTS')}">
                <div class="label">
                  ${msg('HTERM_NAME_PREF_KEYBINDINGS_OS_DEFAULTS')}
                </div>
                <terminal-settings-checkbox
                    ariaLabel="${
                        msg('HTERM_NAME_PREF_KEYBINDINGS_OS_DEFAULTS')}"
                    preference="keybindings-os-defaults">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_PASS_CTRL_N')}">
                <div class="label">${msg('HTERM_NAME_PREF_PASS_CTRL_N')}</div>
                <terminal-settings-checkbox
                    ariaLabel="${msg('HTERM_NAME_PREF_PASS_CTRL_N')}"
                    preference="pass-ctrl-n">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_PASS_CTRL_T')}">
                <div class="label">${msg('HTERM_NAME_PREF_PASS_CTRL_T')}</div>
                <terminal-settings-checkbox
                    ariaLabel="${msg('HTERM_NAME_PREF_PASS_CTRL_T')}"
                    preference="pass-ctrl-t">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_PASS_CTRL_W')}">
                <div class="label">${msg('HTERM_NAME_PREF_PASS_CTRL_W')}</div>
                <terminal-settings-checkbox
                    ariaLabel="${msg('HTERM_NAME_PREF_PASS_CTRL_W')}"
                    preference="pass-ctrl-w">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_PASS_CTRL_TAB')}">
                <div class="label">
                  ${msg('HTERM_NAME_PREF_PASS_CTRL_TAB')}
                </div>
                <terminal-settings-checkbox
                    ariaLabel="${msg('HTERM_NAME_PREF_PASS_CTRL_TAB')}"
                    preference="pass-ctrl-tab">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_PASS_CTRL_NUMBER')}">
                <div class="label">
                  ${msg('HTERM_NAME_PREF_PASS_CTRL_NUMBER')}
                </div>
                <terminal-settings-checkbox
                    ariaLabel="${msg('HTERM_NAME_PREF_PASS_CTRL_NUMBER')}"
                    preference="pass-ctrl-number">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_PASS_ALT_NUMBER')}">
                <div class="label">
                  ${msg('HTERM_NAME_PREF_PASS_ALT_NUMBER')}
                </div>
                <terminal-settings-checkbox
                    ariaLabel="${msg('HTERM_NAME_PREF_PASS_ALT_NUMBER')}"
                    preference="pass-alt-number">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_CTRL_PLUS_MINUS_ZERO_ZOOM')}">
                <div class="label">
                  ${msg('HTERM_NAME_PREF_CTRL_PLUS_MINUS_ZERO_ZOOM')}
                </div>
                <terminal-settings-checkbox
                    ariaLabel="${
                        msg('HTERM_NAME_PREF_CTRL_PLUS_MINUS_ZERO_ZOOM')}"
                    preference="ctrl-plus-minus-zero-zoom">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_CTRL_C_COPY')}">
                <div class="label">${msg('HTERM_NAME_PREF_CTRL_C_COPY')}</div>
                <terminal-settings-checkbox
                    ariaLabel="${msg('HTERM_NAME_PREF_CTRL_C_COPY')}"
                    preference="ctrl-c-copy">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_CTRL_V_PASTE')}">
                <div class="label">
                  ${msg('HTERM_NAME_PREF_CTRL_V_PASTE')}
                </div>
                <terminal-settings-checkbox
                    ariaLabel="${msg('HTERM_NAME_PREF_CTRL_V_PASTE')}"
                    preference="ctrl-v-paste">
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
                <div class="label">
                  ${msg('HTERM_NAME_PREF_SCROLL_ON_KEYSTROKE')}
                </div>
                <terminal-settings-checkbox
                    ariaLabel="${
                        msg('HTERM_NAME_PREF_SCROLL_ON_KEYSTROKE')}"
                    preference="scroll-on-keystroke">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_SCROLL_ON_OUTPUT')}">
                <div class="label">
                  ${msg('HTERM_NAME_PREF_SCROLL_ON_OUTPUT')}
                </div>
                <terminal-settings-checkbox
                    ariaLabel="${msg('HTERM_NAME_PREF_SCROLL_ON_OUTPUT')}"
                    preference="scroll-on-output">
                </terminal-settings-checkbox>
              </li>
            </ul>
          </section>
          <section>
            <h3>${msg('HTERM_TITLE_PREF_COPYPASTE')}</h3>

            <ul class="section-body">
              <li class="setting-container"
                  title="${msg('HTERM_PREF_COPY_ON_SELECT')}">
                <div class="label">
                  ${msg('HTERM_NAME_PREF_COPY_ON_SELECT')}
                </div>
                <terminal-settings-checkbox
                    ariaLabel="${msg('HTERM_NAME_PREF_COPY_ON_SELECT')}"
                    preference="copy-on-select">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_ENABLE_CLIPBOARD_NOTICE')}">
                <div class="label">
                  ${msg('HTERM_NAME_PREF_ENABLE_CLIPBOARD_NOTICE')}
                </div>
                <terminal-settings-checkbox
                    ariaLabel="${
                        msg('HTERM_NAME_PREF_ENABLE_CLIPBOARD_NOTICE')}"
                    preference="enable-clipboard-notice">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_MOUSE_RIGHT_CLICK_PASTE')}">
                <div class="label">
                  ${msg('HTERM_NAME_PREF_MOUSE_RIGHT_CLICK_PASTE')}
                </div>
                <terminal-settings-checkbox
                    ariaLabel="${
                        msg('HTERM_NAME_PREF_MOUSE_RIGHT_CLICK_PASTE')}"
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
                <div class="label">${msg('TERMINAL_NAME_PREF_BELL')}</div>
                <terminal-settings-checkbox
                    ariaLabel="${msg('TERMINAL_NAME_PREF_BELL')}"
                    preference="audible-bell-sound"
                    .converter=${BELL_SOUND_CONVERTER}>
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_ENABLE_RESIZE_STATUS')}">
                <div class="label">
                  ${msg('HTERM_NAME_PREF_ENABLE_RESIZE_STATUS')}
                </div>
                <terminal-settings-checkbox
                    ariaLabel="${
                        msg('HTERM_NAME_PREF_ENABLE_RESIZE_STATUS')}"
                    preference="enable-resize-status">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('TERMINAL_NAME_PREF_SCROLLBACK_LIMIT')}">
                <div class="label">
                  ${msg('TERMINAL_NAME_PREF_SCROLLBACK_LIMIT')}
                </div>
                <terminal-settings-scrollback-limit>
                </terminal-settings-scrollback-limit>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_CLOSE_ON_EXIT')}">
                <div class="label">
                  ${msg('HTERM_NAME_PREF_CLOSE_ON_EXIT')}
                </div>
                <terminal-settings-checkbox
                    ariaLabel="${msg('HTERM_NAME_PREF_CLOSE_ON_EXIT')}"
                    preference="close-on-exit">
                </terminal-settings-checkbox>
              </li>
              <li class="setting-container"
                  title="${msg('HTERM_PREF_DESKTOP_NOTIFICATION_BELL')}">
                <div class="label">
                  ${msg('HTERM_NAME_PREF_DESKTOP_NOTIFICATION_BELL')}
                </div>
                <terminal-settings-checkbox
                    ariaLabel="${
                        msg('HTERM_NAME_PREF_DESKTOP_NOTIFICATION_BELL')}"
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
                @click="${() => lib.f.openWindow(
                    '/html/licenses.html', '_blank', 'popup')}">
                <div class="label">${msg('LICENSES')}</div>
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
    return this.activeCategory_ === 'profile' &&
         this.activeProfileCategory_ === category;
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
    let profiles = await getProfileIds(ProfileType.HTERM);
    // Ensure 'default' is the first.
    if (profiles.lastIndexOf(hterm.Terminal.DEFAULT_PROFILE_ID) != 0) {
      profiles = [hterm.Terminal.DEFAULT_PROFILE_ID,
        ...profiles.filter((i) => i !== hterm.Terminal.DEFAULT_PROFILE_ID)];
      setProfileIds(ProfileType.HTERM, profiles);
    }
    this.settingsProfiles_ = profiles;
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
    const deleted = e.detail.profile;
    // Clear any background images.
    window.localStorage.removeItem(
      backgroundImageLocalStorageKeyForProfileId(deleted));

    // Set new active profile.
    let active = this.activeSettingsProfile_;
    const activeIndex = this.settingsProfiles_.indexOf(active);
    await this.updateSettingsProfiles_();
    // If active profile is deleted, then select previous.
    if (active === deleted) {
      active = this.settingsProfiles_[activeIndex - 1];
    }
    this.clickProfile_(active);
  }
}

customElements.define('terminal-settings-app', TerminalSettingsApp);
