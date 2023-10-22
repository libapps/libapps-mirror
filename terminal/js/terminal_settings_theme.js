// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-theme.
 *
 * @suppress {moduleLoad}
 */

import {lib} from '../../libdot/index.js';
import {hterm} from '../../hterm/index.js';

import {LitElement, css, html, unsafeCSS} from './lit.js';
import {DEFAULT_THEME, DEFAULT_ANSI_COLORS, DEFAULT_BACKGROUND_COLOR,
    DEFAULT_CURSOR_COLOR, DEFAULT_FOREGROUND_COLOR} from './terminal_common.js';
import './terminal_button.js';
import './terminal_dialog.js';

/** @typedef {!Object<string, *>} */
let ThemeVariation;

/** @typedef {!Object<string, !ThemeVariation>} */
let ThemeVariations;

/**
 * Set of prefs to observe.
 *
 * @type {!Array<string>}
 */
const PREFS = [
    'theme',
    'background-color',
    'foreground-color',
    'cursor-color',
    'color-palette-overrides',
  ];

class Theme {
  /**
   * @param {string} id Theme ID.
   * @param {string} translationKey Translation key.
   * @param {string} background Background color.
   * @param {string} font Font color.
   * @param {string} cursor Cursor color.
   * @param {!Array<string>} ansi ANSI 16 colors.
   */
  constructor(id, translationKey, background, font, cursor, ansi) {
    this.id = id;
    this.translationKey = translationKey;

    /**
     * @private {!ThemeVariation}
     * @const
     */
    this.defaults_ = {
        'theme': id,
        'background-color': background,
        'foreground-color': font,
        'cursor-color': cursor,
        'color-palette-overrides': ansi,
      };

    /** @private {!lib.PreferenceManager} */
    this.preferenceManager_;
    /** @private {!ThemeVariation} */
    this.variations_ = {};
  }

  /**
   * Initialize object with PreferenceManager and read variations.
   *
   * @param {!lib.PreferenceManager} preferenceManager
   */
  init(preferenceManager) {
    this.preferenceManager_ = preferenceManager;
    this.variations_ = preferenceManager.get('theme-variations')[this.id] || {};
  }

  /**
   * Get the theme's current value of the specified pref.
   *
   * @param {string} name Preference name.
   * @return {*}
   * @private
   */
  getPref_(name) {
    return this.variations_.hasOwnProperty(name)
        ? this.variations_[name] : this.defaults_[name];
  }

  /** @return {string} */
  get background() {
    return /** @type {string} */ (this.getPref_('background-color'));
  }

  /** @return {string} */
  get font() {
    return /** @type {string} */ (this.getPref_('foreground-color'));
  }

  /** @return {string} */
  get cursor() { return /** @type {string} */ (this.getPref_('cursor-color')); }

  /** @return {!Array<string>} */
  get ansi() {
    return /** @type {!Array<string>} */ (
        this.getPref_('color-palette-overrides'));
  }

  /**
   * Write current state to prefs.
   */
  writeToPrefs() {
    // Any non-priimitive stored into prefs must be duplicated to avoid storing
    // the live copy which makes comparisons void.
    PREFS.forEach((p) => {
      let v = this.getPref_(p);
      if (Array.isArray(v)) {
        v = v.slice();
      }
      this.preferenceManager_.set(p, v);
    });
  }

  /**
   * Add a variation to this theme.
   *
   * @param {string} name
   * @param {*} value
   */
  setVariation(name, value) {
    // Store local this.variations_ if it is different to default.
    const d = this.defaults_[name];
    if ((value === d) || (JSON.stringify(value) === JSON.stringify(d))) {
      delete this.variations_[name];
    } else {
      this.variations_[name] = value;
    }

    // Update 'theme-variations' pref.
    /** @type {!ThemeVariations} */
    const tvs = /** @type {!ThemeVariations} */ (
        this.preferenceManager_.get('theme-variations'));
    const tv = tvs[this.id];
    if (!this.hasVariations()) {
      if (tv === undefined) {
        return;
      }
      delete tvs[this.id];
    } else {
      const s = JSON.stringify(this.variations_);
      if (s === JSON.stringify(tv)) {
        return;
      }
      // Stringify and parse to duplicate before updating pref.
      tvs[this.id] = /** @type {!ThemeVariation} */(JSON.parse(s));
    }
    this.preferenceManager_.set('theme-variations', tvs);
  }

  /** @return {boolean} Returns true if theme has a variation. */
  hasVariations() {
    return Object.keys(this.variations_).length > 0;
  }

  /** Reset theme and clear variations. */
  clearVariations() {
    this.variations_ = {};
    /** @type {!ThemeVariations} */
    const tvs = /** @type {!ThemeVariations} */ (
        this.preferenceManager_.get('theme-variations'));
    delete tvs[this.id];
    this.preferenceManager_.set('theme-variations', tvs);
    this.writeToPrefs();
  }
}

/** @type {!Object<string, !Theme>} */
const THEMES = {
  'dark': new Theme('dark',
      'TERMINAL_THEME_DARK_LABEL', DEFAULT_BACKGROUND_COLOR,
      DEFAULT_FOREGROUND_COLOR, DEFAULT_CURSOR_COLOR, DEFAULT_ANSI_COLORS),
  'light': new Theme('light',
      'TERMINAL_THEME_LIGHT_LABEL', '#FFFFFF', '#000000', '#1967D280',
      ['#E8EAED', '#F28B82', '#108468', '#F29900',
       '#8AB4F8', '#F882FF', '#03BFC8', '#202124',
       '#F8F9FA', '#EE675C', '#108468', '#DB7000',
       '#1A73E8', '#AA00B8', '#009099', '#9AA0A6']),
  'classic': new Theme('classic',
      'TERMINAL_THEME_CLASSIC_LABEL', '#101010', '#FFFFFF', '#FF000080',
      lib.colors.stockPalette.slice(0, 16)),
  'solarizedDark': new Theme('solarizedDark',
      'TERMINAL_THEME_SOLARIZED_DARK_LABEL', '#002B36', '#83949680',
      '#93A1A180',
      ['#073642', '#DC322F', '#859900', '#B58900',
       '#268BD2', '#D33682', '#2AA198', '#EEE8D5',
       '#002B36', '#CB4B16', '#586E75', '#657B83',
       '#839496', '#6C71C4', '#93A1A1', '#FDF6E3']),
  'solarizedLight': new Theme('solarizedLight',
      'TERMINAL_THEME_SOLARIZED_LIGHT_LABEL', '#FDF6E3', '#657B83', '#586E7580',
      ['#EEE8D5', '#DC322F', '#859900', '#B58900',
       '#268BD2', '#D33682', '#2AA198', '#073642',
       '#FDF6E3', '#CB4B16', '#93A1A1', '#839496',
       '#657B83', '#6C71C4', '#586E75', '#002B36']),
  'dusk': new Theme('dusk',
      'TERMINAL_THEME_DUSK_LABEL', '#22273E', '#FFFFFF', '#87FFC580',
      ['#2D3452', '#F4B5FB', '#E3FEEF', '#E7F936',
       '#9573F5', '#FFA08B', '#30E2EA', '#434D7B',
       '#8D9CF6', '#F882FF', '#87FFC5', '#F1FF67',
       '#B39AF5', '#FFBCAD', '#80F9F9', '#414976']),
  'haze': new Theme('haze',
      'TERMINAL_THEME_HAZE_LABEL', '#3E1C43', '#FFFFFF', '#FEEFC380',
      ['#5B3062', '#F6AEA9', '#CDD8FA', '#F7FFA4',
       '#956FE4', '#F994FF', '#87FFC5', '#2C222E',
       '#FBE1FF', '#F9C6C3', '#97B0FC', '#F1FF67',
       '#D3BEFF', '#FBB4FF', '#ABFFD6', '#76427D']),
  'forest': new Theme('forest',
      'TERMINAL_THEME_FOREST_LABEL', '#1F3334', '#FFFFFF', '#CCB4FF80',
      ['#2B4E50', '#FFA07A', '#7097B0', '#F1FF67',
       '#C6FFE3', '#FAA5FF', '#8584CD', '#202124',
       '#AAFCFF', '#FFB79A', '#A2D3F2', '#DCF775',
       '#87FFC5', '#FBB4FF', '#8B88FF', '#486B6C']),
};

/**
 * Reset svg icon.
 *
 * @type {string}
 */
const RESET =
    '<svg width="20px" height="20px" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M3,5 A6,6 0 1,1 2,9 M2,2 v4 h4" ' +
    'fill="none" stroke-width="1.75" stroke="white"/></svg>';

export class TerminalSettingsThemeElement extends LitElement {
  static get is() { return 'terminal-settings-theme'; }

  constructor() {
    super();

    /** @private {!Theme} */
    this.theme_;
    this.boundProfileChanged_ = this.profileChanged_.bind(this);
    this.boundPreferenceChanged_ = this.preferenceChanged_.bind(this);
  }

  /** @override */
  connectedCallback() {
    super.connectedCallback();

    this.profileChanged_();
    window.preferenceManager.onPrefixChange.addListener(
        this.boundProfileChanged_);
    PREFS.forEach((p) => {
      window.preferenceManager.addObserver(
          p, this.boundPreferenceChanged_);
    });
  }

  /** @override */
  disconnectedCallback() {
    super.disconnectedCallback();

    window.preferenceManager.onPrefixChange.removeListener(
        this.boundProfileChanged_);
    PREFS.forEach((p) => {
      window.preferenceManager.removeObserver(
        p, this.boundPreferenceChanged_);
    });
  }

  /** @override */
  static get styles() {
    return css`
      #themes {
        display: flex;
        flex-wrap: wrap;
        margin: 0;
        max-width: 600px;
        width: 100%;
      }

      .theme {
        flex-basis: 25%;
        margin: 0;
        max-width: 150px;
      }

      .theme-inner {
        border: 1px solid var(--cros-separator-color);
        border-radius: 8px;
        cursor: pointer;
        height: 88px;
        margin: 8px 0 0 8px;
        outline: none;
        overflow: hidden;
        position: relative;
      }

      .theme-inner:focus-visible {
        box-shadow: 0 0 0 2px var(--cros-color-prominent);
      }

      .theme:nth-child(-n+4) > .theme-inner {
        margin: 0 0 0 8px;
      }

      .preview {
        height: 48px;
        min-width: 100%;
        overflow: hidden;
        position: relative;
      }

      .preview pre {
        font-family: 'Noto Sans Mono';
        font-size: 5px;
        line-height: 6px;
        margin: 0;
        padding: 6px 8px;
        position: absolute;
        white-space: pre;
      }

      .label {
        background-color: var(--cros-bg-color);
        bottom: 0;
        color: var(--cros-color-primary);
        font-weight: 400;
        line-height: 40px;
        position: absolute;
        width: 100%;
      }

      .label p {
        margin: 0 10px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .theme[active-theme] .label {
        background-color: var(--cros-highlight-color);
        color: var(--cros-color-prominent);
      }

      .reset {
        background-color: rgba(var(--cros-app-shield-color-rgb), 0.6);
        bottom: 0;
        color: #fff;
        display: none;
        font-size: 13px;
        font-weight: 500;
        left: 0;
        margin: 0;
        padding: 0;
        position: absolute;
        right: 0;
        top: 0;
        width: 100%;
        z-index: 10;
      }

      .reset div {
        background: url('data:image/svg+xml;utf8,${unsafeCSS(RESET)}')
                    no-repeat left;
        line-height: 20px;
        margin: 14px auto;
        padding: 0 0 0 28px;
        width: 38px;
      }

      .theme[active-theme][reset-theme] .reset {
        display: block;
      }
    `;
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);
    const span = (color, text) => {
      return html`<span style="color:${color};font-weight:bold">${text}</span>`;
    };
    return html`
        <div id="themes">${Object.values(THEMES).map((t) => html`
          <div id="${t.id}" class="theme"
              ?active-theme="${this.theme_.id === t.id}"
              ?reset-theme="${this.theme_.hasVariations()}">
            <div class="theme-inner" tabindex="0"
                aria-label="${
                    msg('TERMINAL_TITLE_THEME')} ${msg(t.translationKey)}"
                @click="${this.onClicked_}"
                @keydown="${this.onKeydown_}">
              <div class="preview" aria-hidden="true"
                  style="background-color:${t.background};color:${t.font}">
<pre>drwxr-xr-x 1 joel 13:28 ${span(t.ansi[12], '.')}
drwxr-xr-x 1 root 07:00 ${span(t.ansi[12], '..')}
-rw-r--r-- 1 joel 15:24 .bashrc
drwxr-xr-x 1 joel 10:38 ${span(t.ansi[12], '.config')}
-rwxr-xr-x 1 joel 14:30 ${span(t.ansi[10], 'a.out')}
${span(t.ansi[10], 'joel@penguin')}:${span(t.ansi[12], '~')
}$ ls -al<span style="background:${t.cursor}"> </span></pre>
                <div class="reset">
                  <div>${msg('TERMINAL_SETTINGS_RESET_LABEL')}</div>
                </div>
              </div>
              <div class="label"><p>${msg(t.translationKey)}</p></div>
            </div>
          </div>`)}
        </div>
        <terminal-dialog acceptText="${msg('TERMINAL_SETTINGS_RESET_LABEL')}"
            @close=${this.onDialogClose}>
          <div slot="title">${msg('TERMINAL_SETTINGS_RESET_DIALOG_TITLE')}</div>
          ${msg('TERMINAL_SETTINGS_RESET_DIALOG_MESSAGE')}
        </terminal-dialog>
    `;
  }

  /**
   * @param {string} id Theme clicked.
   * @private
   */
  onActivated_(id) {
    if (!THEMES.hasOwnProperty(id)) {
      console.error(`Unknown theme: ${id}`);
      return;
    }
    if (this.theme_.id === id && this.theme_.hasVariations()) {
      this.shadowRoot.querySelector('terminal-dialog').show();
    } else {
      this.theme_ = THEMES[id];
      this.theme_.writeToPrefs();
    }
  }

  /**
   * @param {!Event} event
   * @private
   */
  onClicked_(event) {
    this.onActivated_(event.currentTarget.parentNode.id);
    event.preventDefault();
  }

  /**
   * @param {!Event} event
   * @private
   */
  onKeydown_(event) {
    switch (event.code) {
      case 'Enter':
      case 'Space':
        this.onActivated_(event.currentTarget.parentNode.id);
        event.preventDefault();
        break;
    }
  }

  /** @private */
  profileChanged_() {
    Object.values(THEMES).forEach((t) => {
      t.init(window.preferenceManager);
    });
    this.preferenceChanged_(
        window.preferenceManager.get('theme'), 'theme');
  }

  /**
   * @param {*} value
   * @param {string} name
   * @protected
   */
  preferenceChanged_(value, name) {
    if (name === 'theme') {
      if (!THEMES.hasOwnProperty(value)) {
        value = DEFAULT_THEME;
      }
      this.theme_ = THEMES[/** @type {string} */(value)];
    } else {
      this.theme_.setVariation(name, value);
    }
    this.requestUpdate();
  }

  onDialogClose(event) {
    if (event.detail.accept) {
      this.theme_.clearVariations();
    }
  }
}

customElements.define(TerminalSettingsThemeElement.is,
    TerminalSettingsThemeElement);
