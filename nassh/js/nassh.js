// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../../libdot/index.js';

import {hterm} from '../../hterm/index.js';

/**
 * Non-null if nassh is running as an extension.
 */
export const browserAction =
    globalThis.browser?.browserAction ? browser.browserAction :
    globalThis.chrome?.browserAction ? chrome.browserAction :
    globalThis.chrome?.action ? chrome.action :
    null;

hterm.initPromise.then(() => {
  // Since our translation process only preserves \n (and discards \r), we
  // have to manually insert them ourselves.
  hterm.messageManager.useCrlf = true;
});

/**
 * Returns true if this is running as a ChromeOS System App such as Terminal
 * or crosh at chrome-untrusted://.
 *
 * @return {boolean}
 */
export function isCrOSSystemApp() {
  return location.href.startsWith('chrome-untrusted://');
}

/**
 * Modify if nassh is running within ChromeOS Terminal System App. We will
 * use lib.Storage.TerminalPrivate as the default storage, load messages via
 * XHR, and polyfill chrome.runtime.getManifest().
 *
 * @return {!Promise<void>}
 */
export function setupForWebApp() {
  // Modifications if running as ChromeOS Terminal SWA.
  if (isCrOSSystemApp()) {
    if (chrome?.runtime && !chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage = (message, callback) => {
        setTimeout(/** @type {function(!Object)} */ (callback), 0, {});
      };
    }

    return loadMessages();
  }

  // This tracks the message manager setup like above.
  return hterm.initPromise;
}

/**
 * Add a listener to 'background-color' pref and set it on the outer body.
 * to update tab and frame colors.
 *
 * @param {!lib.PreferenceManager} prefs The preference manager.
 */
export function watchBackgroundColor(prefs) {
  document.body.style.backgroundColor = prefs.getString('background-color');
  prefs.addObserver('background-color', (color) => {
    document.body.style.backgroundColor = /** @type {string} */ (color);
  });
}

/**
 * Loads messages for when chrome.i18n is not available.
 *
 * This should only be used in contexts outside of extensions/apps.
 */
export async function loadMessages() {
  // Load hterm.messageManager from /_locales/<lang>/messages.json.
  await hterm.initPromise;
  hterm.messageManager.useCrlf = true;
  const url = lib.f.getURL('/_locales/$1/messages.json');
  await hterm.messageManager.findAndLoadMessages(url);
}

/**
 * Return a formatted message in the current locale.
 *
 * @param {string} name The name of the message to return.
 * @param {!Array=} args The message arguments, if required.
 * @return {string} The localized & formatted message.
 */
export function localize(name, args) {
  return hterm.messageManager.get(name, args, name);
}

/**
 * Create a new window to the options page for customizing preferences.
 *
 * @param {string=} page The specific options page to navigate to.
 */
export function openOptionsPage(page = '') {
  const fallback = () => {
    lib.f.openWindow(`/html/nassh_preferences_editor.html#${page}`);
  };

  if (!page && globalThis.chrome?.runtime?.openOptionsPage) {
    // This is a bit convoluted because, in some scenarios (e.g. crosh), the
    // openOptionsPage helper might fail.  If it does, fallback to a tab.
    chrome.runtime.openOptionsPage(() => {
      const err = lib.f.lastError();
      if (err) {
        console.warn(err);
        fallback();
      }
    });
  } else {
    fallback();
  }
}

/**
 * Trigger the flow for sending feedback.
 */
export function sendFeedback() {
  const manifest = getManifest();
  lib.f.openWindow(`https://hterm.org/x/newbug?labels=ver-${manifest.version}`);
}

/**
 * Register this extension to handle URIs like ssh://.
 *
 * The protocol should be one allowed by the specifications:
 * https://html.spec.whatwg.org/multipage/webappapis.html#webappapis
 * https://chromium.googlesource.com/chromium/src/+blame/HEAD/third_party/WebKit/Source/modules/navigatorcontentutils/NavigatorContentUtils.cpp
 * https://www.iana.org/assignments/uri-schemes/prov/sftp
 *
 * @param {string} proto The protocol name to register.
 */
export function registerProtocolHandler(proto) {
  try {
    navigator.registerProtocolHandler(
        proto,
        lib.f.getURL('/html/nassh.html#uri:%s'),
        getManifest().name);
  } catch (e) {
    console.error(`Unable to register '${proto}' handler:`, e);
  }

  // Not all runtimes allow direct registration, so also register with the
  // 'web+' prefix just in case.
  if (!proto.startsWith('web+')) {
    registerProtocolHandler(`web+${proto}`);
  }
}

/**
 * Disable automatic tab discarding for our windows.
 *
 * Newer versions of Chrome are a bit more proactive in discarding tabs.  Signal
 * that we shouldn't be discarded as restarting crosh/ssh sessions is not easy
 * for users.
 * https://crbug.com/868155
 *
 * Note: This code updates tab properties asynchronously, but that should be
 * fine for our usage as we don't generally create windows/tabs on the fly.
 */
export function disableTabDiscarding() {
  if (globalThis.chrome?.tabs?.getCurrent) {
    chrome.tabs.getCurrent((tab) => {
      chrome.tabs.update(tab.id, {autoDiscardable: false});
    });
  }
}

/**
 * Convert a base64url encoded string to the base64 encoding.
 *
 * The difference here is in the last two characters of the alphabet.
 * So converting between them is easy.
 *
 * base64: https://tools.ietf.org/html/rfc4648#section-4
 *   62 +
 *   63 /
 * base64url: https://tools.ietf.org/html/rfc4648#section-5
 *   62 -
 *   63 _
 *
 * We re-add any trailing = padding characters.
 *
 * @param {string} data The base64url encoded data.
 * @return {string} The data in base64 encoding.
 */
export function base64UrlToBase64(data) {
  const replacements = {'-': '+', '_': '/'};
  let ret = data.replace(/[-_]/g, (ch) => replacements[ch]);

  switch (ret.length % 4) {
    case 1:
      throw new Error(`Invalid base64url length: ${ret.length}`);

    case 2:
      ret += '==';
      break;

    case 3:
      ret += '=';
      break;
  }

  return ret;
}

/**
 * Convert a base64 encoded string to the base64url encoding.
 *
 * This is the inverse of base64UrlToBase64.
 *
 * We strip off any = padding characters too.
 *
 * @param {string} data The base64 encoded data.
 * @return {string} The data in base64url encoding.
 */
export function base64ToBase64Url(data) {
  const replacements = {'+': '-', '/': '_', '=': ''};
  return data.replace(/[+/=]/g, (ch) => replacements[ch]);
}

/**
 * Generate an SGR escape sequence.
 *
 * @param {!Object=} settings
 * @return {string} The SGR escape sequence.
 */
export function sgrSequence(
    {bold, faint, italic, underline, blink, fg, bg} = {}) {
  const parts = [];
  if (bold) {
    parts.push('1');
  }
  if (faint) {
    parts.push('2');
  }
  if (italic) {
    parts.push('3');
  }
  if (underline) {
    if (underline === true) {
      parts.push('4');
    } else {
      parts.push(`4:${underline}`);
    }
  }
  if (blink) {
    parts.push('5');
  }
  if (fg) {
    parts.push(fg);
  }
  if (bg) {
    parts.push(bg);
  }
  return `\x1b[${parts.join(';')}m`;
}

/**
 * Apply SGR styling to text.
 *
 * This will reset the SGR style to the default.
 *
 * @param {string} text The text to be stylized.
 * @param {!Object=} settings The SGR settings to apply.
 * @return {string} The text wrapped in SGR escape sequences.
 */
export function sgrText(text, settings) {
  return sgrSequence(settings) + text + sgrSequence();
}

/**
 * Generate a hyperlink using OSC-8 escape sequence.
 *
 * @param {string} url The link target.
 * @param {string=} text The user visible text.
 * @return {string} The hyperlink with OSC-8 escape sequences.
 */
export function osc8Link(url, text = url) {
  if (url.startsWith('/')) {
    url = lib.f.getURL(url);
  }
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

/**
 * @typedef {{
 *     name: string,
 *     isWebFont: boolean,
 * }}
 */
let Font;

/** @type {!Array<!Font>} */
const FONTS = [
  {name: 'Noto Sans Mono', isWebFont: false},
  {name: 'Cousine', isWebFont: true},
  {name: 'Inconsolata', isWebFont: true},
  {name: 'Roboto Mono', isWebFont: true},
  {name: 'Source Code Pro', isWebFont: true},
];

/**
 * Add css to load web fonts from fonts.googleapis.com.
 *
 * @param {!Document} document The document to load into.
 */
export function loadWebFonts(document) {
  const imports = [];
  const fontFaces = [];
  for (const font of FONTS) {
    if (font.isWebFont) {
      // Load normal (400) and bold (700).
      imports.push(`@import url('https://fonts.googleapis.com/css2?family=` +
        `${encodeURIComponent(font.name)}:wght@400;700&display=swap');`);
    }
    fontFaces.push(`
      @font-face {
        font-family: 'Powerline For ${font.name}';
        src: url('../fonts/PowerlineFor${font.name.replace(/\s/g, '')}.woff2')
             format('woff2');
        font-weight: normal bold;
        unicode-range:
            U+2693,U+26A1,U+2699,U+270E,U+2714,U+2718,U+273C,U+279C,U+27A6,
            U+2B06-2B07,U+E0A0-E0D4;
      }`);
  }

  const style = document.createElement('style');
  style.textContent = imports.join('\n') + fontFaces.join('');
  document.head.appendChild(style);
}

/**
 * A Promise wrapper for the chrome.runtime.sendMessage API.
 *
 * @param {*} args The arguments to sendMessage.
 * @return {!Promise<*>} A promise to resolve with the remote's response.
 */
export function runtimeSendMessage(...args) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(...args, (response) => {
      // If the remote side doesn't exist (which is normal), Chrome complains
      // if we don't read the lastError.  Clear that here.
      const err = lib.f.lastError();
      if (err) {
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Returns the manifest (or a manifest polyfill if loaded as a web page).
 *
 * @return {!chrome.runtime.Manifest}
 */
export function getManifest() {
  if (globalThis.chrome?.runtime?.getManifest) {
    return chrome.runtime.getManifest();
  } else {
    return /** @type {!chrome.runtime.Manifest} */ ({
      'name': 'SSH',
      'version': lib.f.getChromeMilestone().toString(),
      'icons': {'192': '/images/dev/crostini-192.png'},
    });
  }
}

/**
 * Returns a Storage instance that syncs between devices, falling back
 * to local storage if no sync storage API is available.
 *
 * @return {!lib.Storage}
 */
export function getSyncStorage() {
  if (isCrOSSystemApp()) {
    return new lib.Storage.TerminalPrivate();
  }
  if (globalThis.chrome?.storage?.sync) {
    return new lib.Storage.Chrome(chrome.storage.sync);
  }
  return new lib.Storage.Local();
}

/**
 * Sanitizes the given URL source into a TrustedScriptURL, or a string if the
 * Trusted Types API is not available.
 *
 * For now, we wrap the given URL into a TrustedScriptURL without modifying it.
 *
 * @param {string} url
 * @return {!TrustedScriptURL|string}
 */
 export function sanitizeScriptUrl(url) {
  if (globalThis.trustedTypes?.createPolicy) {
    if (!sanitizeScriptUrl.policy) {
      sanitizeScriptUrl.policy = trustedTypes.createPolicy('nassh', {
        createScriptURL: (url) => url,
      });
    }
    return sanitizeScriptUrl.policy.createScriptURL(url);
  }
  return url;
}
