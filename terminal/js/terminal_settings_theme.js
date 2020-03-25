// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-theme.
 *
 * @suppress {moduleLoad}
 */
import {LitElement, css, html, unsafeCSS} from './lit_element.js';
import {DEFAULT_THEME, DEFAULT_ANSI_COLORS, DEFAULT_BACKGROUND_COLOR,
    DEFAULT_CURSOR_COLOR, DEFAULT_FOREGROUND_COLOR} from './terminal_common.js';
import {stylesVars, stylesButtonContainer, stylesDialog}
    from './terminal_settings_styles.js';
import './terminal_settings_button.js';

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
    PREFS.forEach(p => {
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
      'TERMINAL_THEME_LIGHT_LABEL', '#FFFFFF', '#000000',
      'rgba(66, 133, 243, 0.5)',
      ['#425B74', '#B42D25', '#1967D2', '#935236',
       '#6355BA', '#A51BB5', '#53671E', '#363A3D',
       '#4B6A88', '#D93025', '#1A73E8', '#B05E3B',
       '#7462E0', '#C61AD9', '#60781D', '#3C4043']),
  'hterm': new Theme('hterm',
      'TERMINAL_THEME_HTERM_LABEL', '#101010', '#FFFFFF',
      'rgba(255, 0, 0, 0.5)', lib.colors.stockColorPalette.slice(0, 16)),
  'solarizedDark': new Theme('solarizedDark',
      'TERMINAL_THEME_SOLARIZED_DARK_LABEL', '#002B36', '#839496',
      'rgba(147, 161, 161, 0.5)',
      ['#073642', '#DC322F', '#859900', '#B58900',
       '#268BD2', '#D33682', '#2AA198', '#EEE8D5',
       '#002B36', '#CB4B16', '#586E75', '#657B83',
       '#839496', '#6C71C4', '#93A1A1', '#FDF6E3']),
  'solarizedLight': new Theme('solarizedLight',
      'TERMINAL_THEME_SOLARIZED_LIGHT_LABEL', '#FDF6E3', '#657B83',
      'rgba(88, 110, 117, 0.5)',
      ['#EEE8D5', '#DC322F', '#859900', '#B58900',
       '#268BD2', '#D33682', '#2AA198', '#073642',
       '#FDF6E3', '#CB4B16', '#93A1A1', '#839496',
       '#657B83', '#6C71C4', '#586E75', '#002B36']),
  'haze': new Theme('haze',
      'TERMINAL_THEME_HAZE_LABEL', '#31375A', '#E8EAED',
      'rgba(235, 189, 252, 0.5)',
      ['#FF8BCB', '#FFA07A', '#25E387', '#CEE000',
       '#8AB4F8', '#E3A1FA', '#30E2EA', '#BDC1C6',
       '#FBA9D6', '#FFB395', '#87FFC5', '#F1FF67',
       '#AECBFA', '#F1D0FD', '#80F9F9', '#F8F9FA']),
};

/**
 * Reset svg icon.
 *
 * @type {string}
 */
const RESET =
    '<svg width="16px" height="16px" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M3,5 A6,6 0 1,1 2,9 M2,2 v4 h4" ' +
    'fill="none" stroke-width="2" stroke="white"/></svg>';

export class TerminalSettingsThemeElement extends LitElement {
  static get is() { return 'terminal-settings-theme'; }

  constructor() {
    super();

    /** @private {!Theme} */
    this.theme_;
    this.boundPreferenceChanged_ = this.preferenceChanged_.bind(this);
  }

  /** @override */
  connectedCallback() {
    super.connectedCallback();

    Object.values(THEMES).forEach(t => {
      t.init(window.preferenceManager);
    });
    this.preferenceChanged_(
        window.preferenceManager.get('theme'), 'theme');
    PREFS.forEach(p => {
      window.preferenceManager.addObserver(
          p, this.boundPreferenceChanged_);
    });
  }

  /** @override */
  disconnectedCallback() {
    super.disconnectedCallback();

    PREFS.forEach(p => {
      window.preferenceManager.removeObserver(
        p, this.boundPreferenceChanged_);
    });
  }

  /** @override */
  static get styles() {
    return [stylesVars, stylesButtonContainer, stylesDialog, css`
      .theme {
        border: 1px solid #e5e5e5;
        border-radius: 8px;
        cursor: pointer;
        display: inline-block;
        margin: 0 8px 8px 0;
        overflow: hidden;
      }

      .preview {
        position: relative;
      }

      .preview pre {
        font-family: 'Noto Sans Mono';
        font-size: 5px;
        line-height: 6px;
        margin: 0;
        padding: 4px;
      }

      .label {
        color: rgb(95, 99, 104);
        font-weight: 500;
        padding: 10px;
      }

      .theme[active-theme] .label {
        background-color: var(--active-bg);
        color: var(--google-blue-600);
      }

      .reset {
        background: rgba(0, 0, 0, 0.5) no-repeat 16px 12px
          url('data:image/svg+xml;utf8,${unsafeCSS(RESET)}');
        bottom: 0;
        color: #fff;
        display: none;
        font-weight: bold;
        left: 0;
        margin: 0;
        padding: 12px 0 0 40px;
        position: absolute;
        right: 0;
        top: 0;
        z-index: 10;
      }

      .theme[active-theme][reset-theme] .reset {
        display: block;
      }
    `];
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);
    const span = (color, text) =>
        html`<span style="color:${color};font-weight:bold">${text}</span>`;
    return html`
        <div id="themes">${Object.values(THEMES).map(t => html`
          <div id="${t.id}" class="theme"
              @click="${this.onClicked_.bind(this, t.id)}"
              ?active-theme="${this.theme_.id === t.id}"
              ?reset-theme="${this.theme_.hasVariations()}">
          <div class="preview" aria-hidden="true"
              style="background-color:${t.background};color:${t.font}">
<pre>drwxr-xr-x 1 joel 13:28 ${span(t.ansi[12], '.')}
drwxr-xr-x 1 root 07:00 ${span(t.ansi[12], '..')}
-rw-r--r-- 1 joel 15:24 .bashrc
drwxr-xr-x 1 joel 10:38 ${span(t.ansi[12], '.config')}
-rwxr-xr-x 1 joel 14:30 ${span(t.ansi[10], 'autoexec.bat')}
${span(t.ansi[10], 'joel@penguin')}:${span(t.ansi[12], '~')
}$ ls -al<span style="background:${t.cursor}"> </span></pre>
              <div class="reset">${msg('TERMINAL_SETTINGS_RESET_LABEL')}</div>
            </div>
            <div class="label">${msg(t.translationKey)}</div>
          </div>`)}
        </div>
        <dialog>
          <div id="dialog-title">
            ${msg('TERMINAL_SETTINGS_RESET_DIALOG_TITLE')}
          </div>
          <div id="dialog-message">
            ${msg('TERMINAL_SETTINGS_RESET_DIALOG_MESSAGE')}
          </div>
          <div class="button-container">
            <terminal-settings-button class="cancel"
                @click="${this.onCancelClick_}">
              ${msg('CANCEL_BUTTON_LABEL')}
            </terminal-settings-button>
            <terminal-settings-button class="action"
                @click="${this.onResetClick_}">
              ${msg('TERMINAL_SETTINGS_RESET_LABEL')}
            </terminal-settings-button>
          </div>
        </dialog>
    `;
  }

  /**
   * @param {string} id Theme clicked.
   * @private
   */
  onClicked_(id) {
    if (!THEMES.hasOwnProperty(id)) {
      console.error(`Unknown theme: ${id}`);
      return;
    }
    if (this.theme_.id === id && this.theme_.hasVariations()) {
      this.shadowRoot.querySelector('dialog').showModal();
    } else {
      this.theme_ = THEMES[id];
      this.theme_.writeToPrefs();
    }
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

  /**
   * Detects clicks on the dialog cancel button.
   *
   * @param {!Event} event
   */
  onCancelClick_(event) {
    this.shadowRoot.querySelector('dialog').close();
  }

  /**
   * Detects clicks on the dialog cancel button.
   *
   * @param {!Event} event
   */
  onResetClick_(event) {
    this.shadowRoot.querySelector('dialog').close();
    this.theme_.clearVariations();
  }
}

customElements.define(TerminalSettingsThemeElement.is,
    TerminalSettingsThemeElement);
