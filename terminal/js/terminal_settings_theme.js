// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-settings-theme.
 *
 * @suppress {moduleLoad}
 */
import {css, html, unsafeCSS} from './lit_element.js';
import {TerminalSettingsElement} from './terminal_settings_element.js';
import {DEFAULT_ANSI_COLORS, DEFAULT_BACKGROUND_COLOR, DEFAULT_CURSOR_COLOR,
    DEFAULT_FOREGROUND_COLOR} from './terminal_common.js';
import {stylesVars} from './terminal_settings_styles.js';

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
    this.background = background;
    this.font = font;
    this.cursor = cursor;
    this.ansi = ansi;
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
      'TERMINAL_THEME_SOLARIZED_DARK_LABEL', '#002b36', '#839496',
      'rgba(147, 161, 161, 0.5)',
      ['#073642', '#dc322f', '#859900', '#b58900',
       '#268bd2', '#d33682', '#2aa198', '#eee8d5',
       '#002b36', '#cb4b16', '#586e75', '#657b83',
       '#839496', '#6c71c4', '#93a1a1', '#fdf6e3']),
  'solarizedLight': new Theme('solarizedLight',
      'TERMINAL_THEME_SOLARIZED_LIGHT_LABEL', '#fdf6e3', '#657b83',
      'rgba(88, 110, 117, 0.5)',
      ['#eee8d5', '#dc322f', '#859900', '#b58900',
       '#268bd2', '#d33682', '#2aa198', '#073642',
       '#fdf6e3', '#cb4b16', '#93a1a1', '#839496',
       '#657b83', '#6c71c4', '#586e75', '#002b36']),
  'haze': new Theme('haze',
      'TERMINAL_THEME_HAZE_LABEL', '#31375A', '#E8EAED',
      'rgba(235, 189, 252, 0.5)',
      ['#FF8BCB', '#FFA07A', '#25E387', '#CEE000',
       '#8AB4F8', '#E3A1FA', '#30E2EA', '#BDC1C6',
       '#FBA9D6', '#FFB395', '#87FFC5', '#F1FF67',
       '#AECBFA', '#F1D0FD', '#80F9F9', '#F8F9FA']),
};

export class TerminalSettingsThemeElement extends TerminalSettingsElement {
  static get is() { return 'terminal-settings-theme'; }

  /** @override */
  static get properties() {
    return {
      // The selected theme.
      value: {
        attribute: false,
      },
    };
  }

  constructor() {
    super();

    /** @type {string} */
    this.preference = 'theme';
  }

  /** @override */
  static get styles() {
    return [stylesVars, css`
      .theme {
        border: 1px solid #e5e5e5;
        border-radius: 8px;
        display: inline-block;
        margin: 0 8px 8px 0;
        overflow: hidden;
      }

      .preview {
        font-family: 'Noto Sans Mono';
        font-size: 5px;
        line-height: 6px;
        padding: 4px;
        white-space: pre;
      }

      .label h4 {
        margin: 0 1em 0 1em;
      }

      .theme[active-theme] .label {
        background-color: var(--active-bg);
        color: var(--google-blue-600);
      }
     `].concat(Object.values(THEMES).map(t => css`
      #${unsafeCSS(t.id)} .preview {
        background: ${unsafeCSS(t.background)};
        color: ${unsafeCSS(t.font)};
      }
      #${unsafeCSS(t.id)} .ansi10 {
        color: ${unsafeCSS(t.ansi[10])};
        font-weight: bold;
      }
      #${unsafeCSS(t.id)} .ansi12 {
        color: ${unsafeCSS(t.ansi[12])};
        font-weight: bold;
      }
      #${unsafeCSS(t.id)} .cursor {
        background: ${unsafeCSS(t.cursor)};
        display: inline-block;
      }
    `));
  }

  /** @override */
  render() {
    const msg = hterm.messageManager.get.bind(hterm.messageManager);
    return html`
        <div id="themes">${Object.values(THEMES).map(t => html`
          <div id="${t.id}" class="theme"
              @click="${this.onUiChanged_.bind(this, t.id)}"
              ?active-theme="${this.value === t.id}">
<div class="preview" aria-hidden="true"
>drwxr-xr-x 1 joel 13:28 <span class="ansi12">.</span>
drwxr-xr-x 1 root 07:00 <span class="ansi12">..</span>
-rw-r--r-- 1 root 15:24 .bashrc
drwxr-xr-x 1 root 10:38 <span class="ansi12">.config</span>
-rwxr-xr-x 1 root 14:30 <span class="ansi10">autoexec.bat</span>
<span class="ansi10">joel@penguin</span>:<span class="ansi12">~</span
>$ ls -al<span class="cursor">&nbsp;</span></div>
            <div class="label"><h4>${msg(t.translationKey)}</h4></div>
          </div>`)}
        </div>
    `;
  }

  /**
   * @param {string} id Theme clicked.
   * @private
   */
  onUiChanged_(id) {
    if (!THEMES.hasOwnProperty(id)) {
      return;
    }
    super.uiChanged_(id);
    const theme = THEMES[id];
    window.preferenceManager.set('background-color', theme.background);
    window.preferenceManager.set('foreground-color', theme.font);
    window.preferenceManager.set('cursor-color', theme.cursor);
    window.preferenceManager.set('color-palette-overrides', theme.ansi);
  }
}

customElements.define(TerminalSettingsThemeElement.is,
    TerminalSettingsThemeElement);
