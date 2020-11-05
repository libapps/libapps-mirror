// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Namespace for the whole nassh project.
 *
 * We export this with 'var' as we access it across background pages.
 * It's messy and probably should be cleaned up at some point.
 */
// eslint-disable-next-line no-var
var nassh = {};

/**
 * Non-null if nassh is running as an extension.
 */
nassh.browserAction =
    window.browser && browser.browserAction ? browser.browserAction :
    window.chrome && chrome.browserAction ? chrome.browserAction :
    null;

lib.registerInit(
    'nassh',
    /**
     * Register a static initializer for nassh.*.
     */
    () => {
      // Since our translation process only preserves \n (and discards \r), we
      // have to manually insert them ourselves.
      hterm.messageManager.useCrlf = true;
    });

/**
 * Modify if running in chrome-untrusted://.  We will use
 * lib.Storage.TerminalPrivate as the default storage, load messages via XHR,
 * and polyfill chrome.runtime.getManifest.
 */
nassh.setupForWebApp = function() {
  // Modifications if running as a web app.
  if (location.href.startsWith('chrome-untrusted://')) {
    lib.registerInit('terminal-private-storage', () => {
      hterm.defaultStorage = new lib.Storage.TerminalPrivate();
    });
    lib.registerInit('messages', nassh.loadMessages);
    // Polyfill chrome.runtime.getManifest since it is not available when
    // We require name, version, and icons.
    if (chrome && chrome.runtime && !chrome.runtime.getManifest) {
      chrome.runtime.getManifest = () => {
        return /** @type {!chrome.runtime.Manifest} */ ({
          'name': 'Terminal',
          'version': 'system',
          'icons': {'192': '/images/dev/crostini-192.png'},
        });
      };
    }
  }
};

/**
 * Loads messages for when chrome.i18n is not available.
 *
 * This should only be used in contexts outside of extensions/apps.
 */
nassh.loadMessages = async function() {
  // Load hterm.messageManager from /_locales/<lang>/messages.json.
  hterm.messageManager.useCrlf = true;
  const url = lib.f.getURL('/_locales/$1/messages.json');
  await hterm.messageManager.findAndLoadMessages(url);
};

/**
 * Return a formatted message in the current locale.
 *
 * @param {string} name The name of the message to return.
 * @param {!Array=} args The message arguments, if required.
 * @return {string} The localized & formatted message.
 */
nassh.msg = function(name, args) {
  return hterm.messageManager.get(name, args, name);
};

/**
 * Request the persistent HTML5 filesystem for this extension.
 *
 * This will also create the /.ssh/ directory if it does not exits.
 *
 * @return {!Promise<!FileSystem>} The root filesystem handle.
 */
nassh.getFileSystem = function() {
  const requestFS = window.requestFileSystem || window.webkitRequestFileSystem;

  return new Promise((resolve, reject) => {
    function onFileSystem(fileSystem) {
      // We create /.ssh/identity/ subdir for storing keys.  We need a dedicated
      // subdir for users to import files to avoid collisions with standard ssh
      // config files.
      lib.fs.getOrCreateDirectory(fileSystem.root, '/.ssh/identity')
        .then(() => resolve(fileSystem))
        .catch(reject);
    }

    requestFS(window.PERSISTENT,
              16 * 1024 * 1024,
              onFileSystem,
              (e) => {
                console.error(`Error initializing filesystem: ${e}`);
                reject(e);
              });
  });
};

/**
 * Export the current list of nassh connections, and any hterm profiles
 * they reference.
 *
 * This is method must be given a completion callback because the hterm
 * profiles need to be loaded asynchronously.
 *
 * @param {function(!Object)} onComplete Callback to be invoked when export is
 *     complete.
 *   The callback will receive a plain JS object representing the state of
 *   nassh preferences.  The object can be passed back to
 *   nassh.importPreferences.
 */
nassh.exportPreferences = function(onComplete) {
  let pendingReads = 0;
  const rv = {};

  const onReadStorage = function(profile, prefs) {
    rv.hterm[profile] = prefs.exportAsJson();
    if (--pendingReads < 1) {
      onComplete(rv);
    }
  };

  rv.magic = 'nassh-prefs';
  rv.version = 1;

  const nasshPrefs = new nassh.PreferenceManager();
  nasshPrefs.readStorage(function() {
    // Export all the connection settings.
    rv.nassh = nasshPrefs.exportAsJson();

    // Save all the profiles.
    rv.hterm = {};
    hterm.PreferenceManager.listProfiles(nasshPrefs.storage, (profiles) => {
      profiles.forEach((profile) => {
        rv.hterm[profile] = null;
        const prefs = new hterm.PreferenceManager(profile);
        prefs.readStorage(onReadStorage.bind(null, profile, prefs));
        pendingReads++;
      });

      if (profiles.length == 0) {
        onComplete(rv);
      }
    });
  });
};

/**
 * Import a preferences object.
 *
 * This will not overwrite any existing preferences.
 *
 * @param {!Object} prefsObject A preferences object created with
 *     nassh.exportPreferences.
 * @param {function()=} onComplete A callback to be invoked when the import is
 *     complete.
 */
nassh.importPreferences = function(prefsObject, onComplete) {
  let pendingReads = 0;

  const onReadStorage = function(terminalProfile, prefs) {
    prefs.importFromJson(prefsObject.hterm[terminalProfile]);
    if (--pendingReads < 1 && onComplete) {
      onComplete();
    }
  };

  if (prefsObject.magic != 'nassh-prefs') {
    throw new Error('Not a JSON object or bad value for \'magic\'.');
  }

  if (prefsObject.version != 1) {
    throw new Error('Bad version, expected 1, got: ' + prefsObject.version);
  }

  const nasshPrefs = new nassh.PreferenceManager();
  nasshPrefs.importFromJson(prefsObject.nassh, () => {
    for (const terminalProfile in prefsObject.hterm) {
      const prefs = new hterm.PreferenceManager(terminalProfile);
      prefs.readStorage(onReadStorage.bind(null, terminalProfile, prefs));
      pendingReads++;
    }
  });
};

/**
 * Create a new window to the options page for customizing preferences.
 *
 * @param {string=} page The specific options page to navigate to.
 */
nassh.openOptionsPage = function(page = '') {
  const fallback = () => {
    lib.f.openWindow(`/html/nassh_preferences_editor.html#${page}`);
  };

  if (!page && window.chrome && chrome.runtime &&
      chrome.runtime.openOptionsPage) {
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
};

/**
 * Trigger the flow for sending feedback.
 */
nassh.sendFeedback = function() {
  lib.f.openWindow('https://goo.gl/vb94JY');
};

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
nassh.registerProtocolHandler = function(proto) {
  try {
    navigator.registerProtocolHandler(
        proto,
        chrome.runtime.getURL('/html/nassh.html#uri:%s'),
        chrome.runtime.getManifest().name);
  } catch (e) {
    console.error(`Unable to register '${proto}' handler:`, e);
  }

  // Not all runtimes allow direct registration, so also register with the
  // 'web+' prefix just in case.
  if (!proto.startsWith('web+')) {
    nassh.registerProtocolHandler(`web+${proto}`);
  }
};

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
nassh.disableTabDiscarding = function() {
  if (window.chrome && chrome.tabs) {
    chrome.tabs.getCurrent((tab) => {
      chrome.tabs.update(tab.id, {autoDiscardable: false});
    });
  }
};

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
nassh.base64UrlToBase64 = function(data) {
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
};

/**
 * Convert a base64 encoded string to the base64url encoding.
 *
 * This is the inverse of nassh.base64UrlToBase64.
 *
 * We strip off any = padding characters too.
 *
 * @param {string} data The base64 encoded data.
 * @return {string} The data in base64url encoding.
 */
nassh.base64ToBase64Url = function(data) {
  const replacements = {'+': '-', '/': '_', '=': ''};
  return data.replace(/[+/=]/g, (ch) => replacements[ch]);
};

/**
 * Workaround missing chrome.runtime in older versions of Chrome.
 *
 * As detailed in https://crbug.com/925118, the chrome.runtime object might be
 * missing when we run.  In order to workaround it, we need to reload the page.
 * While this is fixed in R72+, we unfortunately have EOL Chromebooks that will
 * never be able to upgrade to that version, so we have to keep this around for
 * a long time -- once we update minimum_chrome_version in the manifest to 72+.
 *
 * @return {boolean} True if bug was detected and the caller should halt all
 *     processing.
 */
nassh.workaroundMissingChromeRuntime = function() {
  // Chrome has a bug where it sometimes doesn't initialize chrome.runtime.
  // Try and workaround it by forcing a refresh.  https://crbug.com/924656
  if (window.chrome && !window.chrome.runtime) {
    console.warn('chrome.runtime is undefined; reloading to workaround ' +
                 'https://crbug.com/925118');
    document.location.reload();
    return true;
  }

  return false;
};

/**
 * Helper to get the background page once it's fully initialized.
 *
 * If the background page doesn't exist yet (fresh startup, or it's gone quiet
 * and Chrome automatically exited it), then the getBackgroundPage helper will
 * create a new instance on the fly and return it.  Unfortunately, we will often
 * then try to call funcs in it directly before it's finished initializing which
 * will cause random failures as it hits race conditions.
 *
 * @return {!Promise<!Window>} A promise resolving to the background page once
 *     it is fully initialized.
 */
nassh.getBackgroundPage = function() {
  if (!window.chrome || !chrome.runtime || !chrome.runtime.getBackgroundPage) {
    return Promise.reject();
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.getBackgroundPage((bg) => {
      if (bg === undefined) {
        return reject();
      }

      const checkInitialized = () => {
        if (bg.loaded) {
          return resolve(bg);
        }
        console.log('Background page not initialized; retrying');
        setTimeout(checkInitialized, 100);
      };
      checkInitialized();
    });
  });
};

/**
 * Generate an SGR escape sequence.
 *
 * @param {!Object=} settings
 * @return {string} The SGR escape sequence.
 */
nassh.sgrSequence = function(
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
};

/**
 * Apply SGR styling to text.
 *
 * This will reset the SGR style to the default.
 *
 * @param {string} text The text to be stylized.
 * @param {!Object=} settings The SGR settings to apply.
 * @return {string} The text wrapped in SGR escape sequences.
 */
nassh.sgrText = function(text, settings) {
  return nassh.sgrSequence(settings) + text + nassh.sgrSequence();
};

/**
 * Generate a hyperlink using OSC-8 escape sequence.
 *
 * @param {string} url The link target.
 * @param {string=} text The user visible text.
 * @return {string} The hyperlink with OSC-8 escape sequences.
 */
nassh.osc8Link = function(url, text = url) {
  if (url.startsWith('/')) {
    url = lib.f.getURL(url);
  }
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
};

/**
 * @typedef {{
 *     name: string,
 *     isWebFont: boolean,
 * }}
 */
nassh.Font;

/** @type {!Array<!nassh.Font>} */
nassh.FONTS = [
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
nassh.loadWebFonts = function(document) {
  const imports = [];
  const fontFaces = [];
  for (const font of nassh.FONTS) {
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
};

/**
 * A Promise wrapper for the chrome.runtime.sendMessage API.
 *
 * @param {*} args The arguments to sendMessage.
 * @return {!Promise<*>} A promise to resolve with the remote's response.
 */
nassh.runtimeSendMessage = function(...args) {
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
};
