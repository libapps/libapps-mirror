// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Common code for terminal and it settings page.
 */

import {migrateFilesystemFromDomToIndexeddb} from './nassh_fs.js';

// The value of an entry is true if it is a web font from fonts.google.com,
// otherwise it is a local font. Note that the UI shows the fonts in the same
// order as the entries'.
//
// @type {!Map<string, boolean>}
export const SUPPORTED_FONT_FAMILIES = new Map([
  // The first font is the default font. It must be a local font.
  ['Noto Sans Mono', false],
  ['Cousine', false],
  ['Roboto Mono', true],
  ['Inconsolata', true],
  ['Source Code Pro', true],
]);
export const DEFAULT_FONT_FAMILY = SUPPORTED_FONT_FAMILIES.keys().next().value;
export const SUPPORTED_FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20];
export const SUPPORTED_LINE_HEIGHT_PADDINGS = [-2, -1.5, -1, -0.5, 0, 0.5, 1,
  1.5, 2, 3, 4, 5];

export const TERMINAL_EMULATORS = new Map([
    ['xterm.js', {lib: 'xterm.js', webgl: true}],
    ['xterm.js (disable WebGl)', {lib: 'xterm.js', webgl: false}],
    ['hterm', {lib: 'hterm', webgl: false}],
]);

// Numeric chrome version (e.g. 78). `null` if fail to detect.
export const CHROME_VERSION = (function() {
  const matches = navigator.userAgent.match(/Chrome\/(\d+)/);
  if (matches) {
    return parseInt(matches[1], 10);
  }
  return null;
})();

/** @type {!Array<string>} */
export const DEFAULT_ANSI_COLORS = [
  '#3C4043',
  '#F28B82',
  '#137356',
  '#E37400',
  '#8AB4F8',
  '#EE5FFA',
  '#03BFC8',
  '#FFFFFF',
  '#9AA0A6',
  '#F6AEA9',
  '#87FFC5',
  '#FDD663',
  '#AECBFA',
  '#F4B5FB',
  '#80F9F9',
  '#F8F9FA',
];
export const DEFAULT_BACKGROUND_COLOR = '#202124';
export const DEFAULT_BACKGROUND_SIZE = '100% 100%';
export const DEFAULT_FOREGROUND_COLOR = '#FFFFFF';
export const DEFAULT_CURSOR_COLOR = '#669DF680';
export const DEFAULT_FONT_SIZE = 13;
export const DEFAULT_SCREEN_PADDING_SIZE = 8;
export const DEFAULT_THEME = 'dark';

export const DEFAULT_VM_NAME = 'termina';
export const DEFAULT_CONTAINER_NAME = 'penguin';

export const SETTINGS_PROFILE_PARAM_NAME = 'settings_profile';
export const TMUX_PARAM_NAME = 'tmux';

// Cache the url at the first opportunity. The url normally should not change,
// so this is being defensive.
export const ORIGINAL_URL = new URL(document.location.href);

/**
 * Convert a font family to a CSS string.
 *
 * @param {string} fontFamily one of the font in SUPPORTED_FONT_FAMILIES.
 * @return {string}
 */
export function fontFamilyToCSS(fontFamily) {
  if (fontFamily === DEFAULT_FONT_FAMILY) {
    return `'${fontFamily}', 'Powerline For ${fontFamily}'`;
  }
  return `'${fontFamily}', 'Powerline For ${fontFamily}', ` +
      `'${DEFAULT_FONT_FAMILY}'`;
}

/**
 * Normalize a css font family string and return one of the font family in
 * SUPPORTED_FONT_FAMILIES.
 *
 * @param {string} cssFontFamily The css font family string.
 * @return {string} The normalized font.
 */
export function normalizeCSSFontFamily(cssFontFamily) {
  for (let fontFamily of cssFontFamily.split(',')) {
    // The regex can never fail, so it is safe to just use the result.
    fontFamily = fontFamily.match(/^\s*['"]?(.*?)['"]?\s*$/)[1];
    if (SUPPORTED_FONT_FAMILIES.has(fontFamily)) {
      return fontFamily;
    }
  }
  return DEFAULT_FONT_FAMILY;
}

/**
 * Change default values for some existing prefs and define new ones. Note that
 * for the new prefs, you might get incorrect value if this is called after
 * `prefs.readStorage()`.
 *
 * @param {!lib.PreferenceManager} prefs The preference manager.
 */
export function definePrefs(prefs) {
  // Set terminal default overrides from hterm.
  prefs.definePreference('audible-bell-sound', '');
  prefs.definePreference('background-color', DEFAULT_BACKGROUND_COLOR);
  prefs.definePreference('background-size', DEFAULT_BACKGROUND_SIZE);
  prefs.definePreference('cursor-color', DEFAULT_CURSOR_COLOR);
  prefs.definePreference('color-palette-overrides', DEFAULT_ANSI_COLORS);
  prefs.definePreference('font-family', fontFamilyToCSS(DEFAULT_FONT_FAMILY));
  prefs.definePreference('font-size', DEFAULT_FONT_SIZE);
  prefs.definePreference('foreground-color', DEFAULT_FOREGROUND_COLOR);
  prefs.definePreference('pass-alt-number', false);
  prefs.definePreference('pass-ctrl-number', false);
  prefs.definePreference('pass-ctrl-tab', true);
  prefs.definePreference('screen-padding-size', DEFAULT_SCREEN_PADDING_SIZE);

  // Add new prefs.
  prefs.definePreference('theme', DEFAULT_THEME);
  prefs.definePreference('theme-variations', {});
  prefs.definePreference('terminal-emulator',
      TERMINAL_EMULATORS.keys().next().value);
}

/**
 * Make sure preference values are valid.
 *
 * @param {!lib.PreferenceManager} prefs The preference manager.
 */
export function normalizePrefsInPlace(prefs) {
  // Remove alpha from background-color.
  const backgroundColor = lib.colors.normalizeCSS(
      /** @type {string} */(prefs.get('background-color')));
  if (!backgroundColor) {
    // The color value is invalid.
    prefs.reset('background-color');
  } else {
    // Store uppercase hex to help detect when a value is set to default.
    const rgb = lib.colors.setAlpha(backgroundColor, 1);
    prefs.set('background-color', lib.colors.rgbToHex(rgb).toUpperCase());
  }
}

/**
 * Add a listener to 'foreground-color' and 'background-color' prefs to update
 * outer body color and favicon.
 *
 * @param {!lib.PreferenceManager} prefs The preference manager.
 */
export function watchColors(prefs) {
  const esc = encodeURIComponent;
  const updateFavicon = (fg, bg) => {
    const link = document.querySelector('head link[rel="icon"]');
    if (!getOSInfo().multi_profile) {
      link.href = '../images/terminal-icon.svg';
      return;
    }
    link.href = `data:image/svg+xml,
      <svg xmlns="http://www.w3.org/2000/svg" width="48px" height="48px"
          viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="24" fill="${esc(bg)}"/>
        <polyline points="7,17 20,24 7,31" stroke-width="5" fill="none"
            stroke="${esc(fg)}"/>
        <line x1="23" y1="36" x2="38" y2="36" stroke-width="5"
            stroke="${esc(fg)}"/>
      </svg>`;
  };
  prefs.addObserver('foreground-color', (color) => {
    updateFavicon(color, prefs.get('background-color'));
  });
  prefs.addObserver('background-color', (color) => {
    document.body.style.backgroundColor = /** @type {string} */ (color);
    updateFavicon(prefs.get('foreground-color'), color);
  });
}

/**
 * A font manager to load (web) fonts. Normally, a `document` should only have
 * one font manager.
 */
export class FontManager {
  /**
   * @param {!Document} doc
   */
  constructor(doc) {
    this.document_ = doc;
    // Store ongoing or successful promises for loading fonts.
    this.loadFontsPromises_ = new Map();
  }

  /**
   * Load a font. Note that normally, only the latin font set is guaranteed to
   * be loaded when this function is done.
   *
   * @param {string} cssFontFamily We will call normalizeCSSFontFamily() on
   *     this, and load the returning font family.
   * @return {!Promise<void>}
   */
  async loadFont(cssFontFamily) {
    const fontFamily = normalizeCSSFontFamily(cssFontFamily);

    if (!SUPPORTED_FONT_FAMILIES.get(fontFamily)) {
      // Not a web font.
      return;
    }

    let promise = this.loadFontsPromises_.get(fontFamily);
    if (!promise) {
      promise = this.loadFontImpl_(fontFamily).catch((error) => {
        /* eslint-disable-next-line no-new */
        new Notification(
            hterm.messageManager.get('TERMINAL_FONT_UNAVAILABLE', [fontFamily]),
            {
              body: hterm.messageManager.get(
                  'TERMINAL_TRY_AGAIN_WITH_INTERNET'),
              tag: 'TERMINAL_FONT_UNAVAILABLE',
            },
        );

        // Delete it from the cache so that we will retry the next time.
        this.loadFontsPromises_.delete(fontFamily);

        throw error;
      });

      this.loadFontsPromises_.set(fontFamily, promise);
    }

    return promise;
  }

  /**
   * Load the powerline css. This is only necessary for hterm, which uses it own
   * document object inside an iframe.
   */
  async loadPowerlineCSS() {
    await this.insertStyleSheet_('../css/powerline_fonts.css');
  }

  /**
   * @param {string} fontFamily Not cssFontFamily.
   * @return {!Promise<void>}
   */
  async loadFontImpl_(fontFamily) {
    await this.insertStyleSheet_(`https://fonts.googleapis.com/css2?family=` +
        `${encodeURIComponent(fontFamily)}&display=swap`);
    // 'X' is the character from which hterm measures the size. For the font
    // size, the default one is used because it probably does not matter.
    const fonts = await this.document_.fonts.load(
        `${DEFAULT_FONT_SIZE}px "${fontFamily}"`, 'X');
    if (fonts.length === 0) {
      throw new Error(`Unable to load fonts ${fontFamily}`);
    }
  }

  /**
   * @param {string} url Url to the style sheet.
   * @return {!Promise<void>}
   */
  async insertStyleSheet_(url) {
    const link = this.document_.createElement('link');
    link.href = url;
    link.rel = 'stylesheet';
    return new Promise((resolve, reject) => {
      link.addEventListener('load', () => resolve());
      link.addEventListener('error',
          () => reject(new Error(`Unable to insert style sheet for ${url}`)));
      this.document_.head.appendChild(link);
    });
  }
}

export const fontManager = new FontManager(document);

/**
 * @typedef {{
 *            alternative_emulator: (boolean|undefined),
 *            multi_profile: (boolean|undefined),
 *            tmux_integration: (boolean|undefined),
 *          }}
 */
export let OsInfo;

/**
 * @type {?OsInfo}
 */
let OS_INFO;

/**
 * Pre-fetch data for getOSInfo().
 *
 * @return {!Promise<void>}
 */
async function prefetchOSInfo() {
  if (chrome.terminalPrivate) {
    return new Promise((resolve) => {
      chrome.terminalPrivate.getOSInfo((info) => {
        OS_INFO = info;
        resolve();
      });
    });
  } else {
    // Set it to something approriate for the testing environment.
    OS_INFO = {
      multi_profile: true,
    };
  }
}

/**
 * Common initialization logic that should be executed once at the beginning.
 *
 * @return {!Promise<void>}
 */
export async function init() {
  await lib.init();

  // See https://crbug.com/1364172#c6 for why we are overriding it. Note that
  // this is safe because Terminal SWA sets a restricted
  // CrossOriginOpenerPolicy.
  lib.f.openWindow = window.open.bind(window);

  hterm.messageManager.useCrlf = true;

  // These initialization tasks should not affect each other, so we run them
  // concurrently.
  return Promise.all([
      prefetchOSInfo(),
      // Load hterm.messageManager from /_locales/<lang>/messages.json.
      hterm.messageManager.findAndLoadMessages(
          lib.f.getURL('/_locales/$1/messages.json')),
      // Migrate over the DOM filesystem to the new indexeddb-fs.
      // TODO(vapier): Delete this with R110+.
      migrateFilesystemFromDomToIndexeddb().catch((e) => {
        console.error('Error migrating filesystem', e);
      }),
  ]).then(() => {});
}

/**
 * Return the pre-fetched os info from `chrome.terminalPrivate.getOSInfo()`.
 *
 * @return {!OsInfo}
 */
export function getOSInfo() {
  if (!OS_INFO) {
    throw new Error('OS_INFO is not initialized');
  }
  return OS_INFO;
}

/**
 * @param {{
 *   windowChannelName: string,
 *   driverChannelName: string,
 *   settingsProfileId: (?string|undefined)
 * }} obj
 * @return {string}
 */
export function composeTmuxUrl(
    {windowChannelName, driverChannelName, settingsProfileId}) {
  const url = new URL(ORIGINAL_URL.origin);
  url.pathname = '/html/terminal.html';

  const paramValue = JSON.stringify({windowChannelName, driverChannelName});
  const settingsProfileParam = settingsProfileId ?
      `&${SETTINGS_PROFILE_PARAM_NAME}=${settingsProfileId}` : '';
  url.search = `?${TMUX_PARAM_NAME}=${paramValue}${settingsProfileParam}`;

  return url.toString();
}

/**
 * Re-dispatch an event on the element. Note that some events are "composed" and
 * can cross shadow boundary [1], so you don't need this for them.
 *
 * [1] https://developers.google.com/web/fundamentals/web-components/shadowdom#events
 *
 * @param {!HTMLElement} element
 * @param {!Event} event
 */
export function redispatchEvent(element, event) {
    element.dispatchEvent(new event.constructor(event.type, event));
}

/**
 * Await to sleep.
 *
 * @param {number} ms
 * @return {!Promise<void>}
 */
export async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Return a new "scheduler" function. When the function is called, it will
 * schedule the `callback` to be called after `delay` time. The function does
 * nothing if it is called again and the last one hasn't timed out yet.
 *
 * TODO: This can probably replace some other existing scheduling code (search
 * "schedule" in the source code).
 *
 * @param {function()} callback
 * @param {number} delay
 * @return {function()} The schedule function.
 */
export function delayedScheduler(callback, delay) {
  let pending = false;
  return () => {
    if (!pending) {
      pending = true;
      setTimeout(() => {
        pending = false;
        callback();
      }, delay);
    }
  };
}
