// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Common code for terminal and it settings page.
 */

import {lib} from '../../libdot/index.js';
import {hterm} from '../../hterm/index.js';

import {migrateFilesystemFromDomToIndexeddb} from './nassh_fs.js';

// Fonts which are installed in ChromeOS.
/** @type {!Array<string>} */
const LOCAL_FONTS = [
  'Noto Sans Mono',
  'Cousine',
];
// Fonts available as web fonts from fonts.google.com.
/** @type {!Array<string>} */
export const SUPPORTED_FONT_FAMILIES = [
  'Anonymous Pro',
  'Courier Prime',
  'Cousine',
  'Cutive Mono',
  'Fira Code',
  'Fira Mono',
  'IBM Plex Mono',
  'Inconsolata',
  'JetBrains Mono',
  'Nanum Gothic Coding',
  'Noto Sans Mono',
  'PT Mono',
  'Roboto Mono',
  'Share Tech Mono',
  'Source Code Pro',
  'Space Mono',
  'Ubuntu Mono',
];
// 'Noto Sans Mono' is the default local font.
export const DEFAULT_FONT_FAMILY = 'Noto Sans Mono';
export const SUPPORTED_FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20];
export const SUPPORTED_LINE_HEIGHT = [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8,
  1.9, 2];

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

export const PARAM_NAME_MOUNT_PATH = 'mount_path';
export const PARAM_NAME_MOUNT = 'mount';
export const PARAM_NAME_SETTINGS_PROFILE = 'settings_profile';
export const PARAM_NAME_SFTP = 'sftp';
export const PARAM_NAME_TMUX = 'tmux';

// Cache the url at the first opportunity. The url normally should not change,
// so this is being defensive.
export const ORIGINAL_URL = new URL(globalThis.location.href);

/**
 * Convert a font family to a CSS string.
 *
 * @param {string} fontFamily one of the font in SUPPORTED_FONT_FAMILIES.
 * @return {string}
 */
export function fontFamilyToCSS(fontFamily) {
  const fallback =
      fontFamily === DEFAULT_FONT_FAMILY ? '' : `, '${DEFAULT_FONT_FAMILY}'`;
  return `'${fontFamily}'${fallback}`;
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
    if (SUPPORTED_FONT_FAMILIES.includes(fontFamily)) {
      return fontFamily;
    }
  }
  return DEFAULT_FONT_FAMILY;
}

/**
 * Local storage key for background image.
 *
 * @param {!lib.PreferenceManager} prefs The preference manager.
 * @return {string}
 */
export function backgroundImageLocalStorageKey(prefs) {
  return backgroundImageLocalStorageKeyForProfileId(
    prefs.prefix.split('/')[3]);
}

/**
 * Local storage key for background image.
 *
 * @param {string} profileId profile ID
 * @return {string}
 */
export function backgroundImageLocalStorageKeyForProfileId(profileId) {
  return 'background-image-' + profileId;
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
  prefs.definePreference('line-height', 1);
  // Negative value means "unlimited".
  prefs.definePreference('scrollback-limit', 10000);

  // Background image multi-profile migration.
  // TODO(joelhockey): Remove after M120.
  const oldKey = 'background-image';
  const newKey = 'background-image-default';
  const img = window.localStorage.getItem(oldKey);
  if (img) {
    window.localStorage.setItem(newKey, img);
    window.localStorage.removeItem(oldKey);
  }
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
    link.href = `data:image/svg+xml,
      <svg xmlns="http://www.w3.org/2000/svg" width="48px" height="48px"
          viewBox="0 0 48 48">
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

    if (LOCAL_FONTS.includes(fontFamily)) {
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
      tast: false,
    };
  }
}

/**
 * Common initialization logic that should be executed once at the beginning.
 *
 * @return {!Promise<void>}
 */
export async function init() {
  // See https://crbug.com/1364172#c6 for why we are overriding it. Note that
  // this is safe because Terminal SWA sets a restricted
  // CrossOriginOpenerPolicy.
  lib.f.openWindow = window.open.bind(window);

  // These initialization tasks should not affect each other, so we run them
  // concurrently.
  return Promise.all([
      hterm.initPromise.then(() => {
        hterm.messageManager.useCrlf = true;
        return hterm.messageManager.findAndLoadMessages(
                   lib.f.getURL('/_locales/$1/messages.json'));
      }),
      prefetchOSInfo(),
      // Load hterm.messageManager from /_locales/<lang>/messages.json.
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
      `&${PARAM_NAME_SETTINGS_PROFILE}=${settingsProfileId}` : '';
  url.search = `?${PARAM_NAME_TMUX}=${paramValue}${settingsProfileParam}`;

  return url.toString();
}

/**
 * @param {{
 *   settingsProfileId: (string|null|undefined),
 *   hash: (string|undefined),
 *   isSftp: (boolean|undefined),
 *   isMount: (boolean|undefined),
 *   mountPath: (?string|undefined),
 * }} params
 * @return {string}
 */
export function composeSshUrl(params) {
  const url = new URL(ORIGINAL_URL.origin);
  url.pathname = '/html/terminal_ssh.html';
  if (params.hash) {
    url.hash = params.hash;
  }
  if (params.settingsProfileId &&
        params.settingsProfileId !== hterm.Terminal.DEFAULT_PROFILE_ID) {
    url.searchParams.append(
        PARAM_NAME_SETTINGS_PROFILE, params.settingsProfileId);
  }
  if (params.isSftp) {
    url.searchParams.append(PARAM_NAME_SFTP, 'true');
  }
  if (params.isMount) {
    url.searchParams.append(PARAM_NAME_MOUNT, 'true');
  }
  if (params.mountPath) {
    url.searchParams.append(PARAM_NAME_MOUNT_PATH, params.mountPath);
  }
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
 * schedule the `callback` to be called after `delay` time. It also returns a
 * promise, which is fulfilled after the callback is called. The function does
 * nothing if it is called again and the last one hasn't timed out yet.
 *
 * TODO: This can probably replace some other existing scheduling code (search
 * "schedule" in the source code).
 *
 * @param {function()} callback
 * @param {number} delay
 * @return {function(): !Promise<void>} The schedule function.
 */
export function delayedScheduler(callback, delay) {
  let donePromise = null;
  return () => {
    if (!donePromise) {
      donePromise = new Promise((resolve) => {
        setTimeout(() => {
          donePromise = null;
          callback();
          resolve();
        }, delay);
      });
    }
    return donePromise;
  };
}

/**
 * Position an element by setting the "top" and "left" css value. The position
 * will be adjusted if the element's bottom right corner is outside the window.
 *
 * @param {!HTMLElement} element
 * @param {{x: number, y: number}} position
 */
export function positionElementWithinWindow(element, position) {
  function adjust(pos, size, boundary) {
    if (pos + size <= boundary) {
      return pos;
    }
    // The right/bottom of the element exceeds the boundary. We need to move
    // left/up to make room for it.
    return Math.max(0, boundary - size);
  }

  const {height, width} = element.getBoundingClientRect();
  element.style.top = `${adjust(position.y, height, window.innerHeight)}px`;
  element.style.left = `${adjust(position.x, width, window.innerWidth)}px`;
}
