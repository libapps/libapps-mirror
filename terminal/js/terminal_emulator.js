// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview For supporting xterm.js and the terminal emulator.
 */

// TODO(b/236205389): add tests. For example, we should enable the test in
// terminal_tests.js for XtermTerminal.

import {LitElement, css, html} from './lit.js';
import {FontManager, ORIGINAL_URL, TERMINAL_EMULATORS, delayedScheduler,
  fontManager, getOSInfo, sleep} from './terminal_common.js';
import {ICON_COPY} from './terminal_icons.js';
import {Terminal, FitAddon, WebglAddon} from './xterm.js';

const ANSI_COLOR_NAMES = [
    'black',
    'red',
    'green',
    'yellow',
    'blue',
    'magenta',
    'cyan',
    'white',
    'brightBlack',
    'brightRed',
    'brightGreen',
    'brightYellow',
    'brightBlue',
    'brightMagenta',
    'brightCyan',
    'brightWhite',
];

const PrefToXtermOptions = {
  'font-family': 'fontFamily',
};

/**
 * @typedef {{
 *   term: !Terminal,
 *   fontManager: !FontManager,
 *   fitAddon: !FitAddon,
 * }}
 */
export let XtermTerminalTestParams;

/**
 * A "terminal io" class for xterm. We don't want the vanilla hterm.Terminal.IO
 * because it always convert utf8 data to strings, which is not necessary for
 * xterm.
 */
class XtermTerminalIO extends hterm.Terminal.IO {
  /** @override */
  writeUTF8(buffer) {
    this.terminal_.write(new Uint8Array(buffer));
  }

  /** @override */
  writelnUTF8(buffer) {
    this.terminal_.writeln(new Uint8Array(buffer));
  }

  /** @override */
  print(string) {
    this.terminal_.write(string);
  }

  /** @override */
  writeUTF16(string) {
    this.print(string);
  }

  /** @override */
  println(string) {
    this.terminal_.writeln(string);
  }

  /** @override */
  writelnUTF16(string) {
    this.println(string);
  }
}

/**
 * A terminal class that 1) uses xterm.js and 2) behaves like a `hterm.Terminal`
 * so that it can be used in existing code.
 *
 * @extends {hterm.Terminal}
 * @unrestricted
 */
export class XtermTerminal {
  /**
   * @param {{
   *   storage: !lib.Storage,
   *   profileId: string,
   *   enableWebGL: boolean,
   *   testParams: (!XtermTerminalTestParams|undefined),
   * }} args
   */
  constructor({storage, profileId, enableWebGL, testParams}) {
    this.profileId_ = profileId;
    /** @type {!hterm.PreferenceManager} */
    this.prefs_ = new hterm.PreferenceManager(storage, profileId);
    this.enableWebGL_ = enableWebGL;

    this.term = testParams?.term || new Terminal();
    this.fontManager_ = testParams?.fontManager || fontManager;
    this.fitAddon = testParams?.fitAddon || new FitAddon();

    this.term.loadAddon(this.fitAddon);
    this.scheduleFit_ = delayedScheduler(() => this.fitAddon.fit(),
        testParams ? 0 : 250);

    this.pendingFont_ = null;
    this.scheduleRefreshFont_ = delayedScheduler(
        () => this.refreshFont_(), 100);
    document.fonts.addEventListener('loadingdone',
        () => this.onFontLoadingDone_());

    this.installUnimplementedStubs_();

    this.term.onResize(({cols, rows}) => this.io.onTerminalResize(cols, rows));
    // We could also use `this.io.sendString()` except for the nassh exit
    // prompt, which only listens to onVTKeystroke().
    this.term.onData((data) => this.io.onVTKeystroke(data));
    this.term.onTitleChange((title) => document.title = title);
    this.term.onSelectionChange(() => this.onSelectionChange_());

    this.io = new XtermTerminalIO(this);
    this.notificationCenter_ = null;

    this.copyNotice_ = null;

    this.term.options.theme = {
      selection: 'rgba(174, 203, 250, .6)',
      selectionForeground: 'black',
      customGlyphs: true,
    };
    this.observePrefs_();
  }

  /**
   * Install stubs for stuff that we haven't implemented yet so that the code
   * still runs.
   */
  installUnimplementedStubs_() {
    this.keyboard = {
      keyMap: {
        keyDefs: [],
      },
      bindings: {
        clear: () => {},
        addBinding: () => {},
        addBindings: () => {},
        OsDefaults: {},
      },
    };
    this.keyboard.keyMap.keyDefs[78] = {};

    const methodNames = [
        'setAccessibilityEnabled',
        'setBackgroundImage',
        'setCursorPosition',
        'setCursorVisible',
    ];

    for (const name of methodNames) {
      this[name] = () => console.warn(`${name}() is not implemented`);
    }

    this.contextMenu = {
      setItems: () => {
        console.warn('.contextMenu.setItems() is not implemented');
      },
    };

    this.vt = {
      resetParseState: () => {
        console.warn('.vt.resetParseState() is not implemented');
      },
    };
  }

  /**
   * One-time initialization at the beginning.
   */
  async init() {
    await new Promise((resolve) => this.prefs_.readStorage(resolve));
    this.prefs_.notifyAll();
    this.onTerminalReady();
  }

  /**
   * Write data to the terminal.
   *
   * @param {string|!Uint8Array} data string for UTF-16 data, Uint8Array for
   *     UTF-8 data
   */
  write(data) {
    this.term.write(data);
  }

  /**
   * Like `this.write()` but also write a line break.
   *
   * @param {string|!Uint8Array} data
   */
  writeln(data) {
    this.term.writeln(data);
  }

  get screenSize() {
    return new hterm.Size(this.term.cols, this.term.rows);
  }

  /**
   * Don't need to do anything.
   *
   * @override
   */
  installKeyboard() {}

  /**
   * @override
   */
  decorate(elem) {
    this.term.open(elem);
    this.scheduleFit_();
    if (this.enableWebGL_) {
      this.term.loadAddon(new WebglAddon());
    }
    this.term.focus();
    (new ResizeObserver(() => this.scheduleFit_())).observe(elem);
    // TODO: Make a11y work. Maybe we can just use `hterm.AccessibilityReader`.
    this.notificationCenter_ = new hterm.NotificationCenter(document.body);
  }

  /** @override */
  showOverlay(msg, timeout = 1500) {
    if (this.notificationCenter_) {
      this.notificationCenter_.show(msg, {timeout});
    }
  }

  /** @override */
  hideOverlay() {
    if (this.notificationCenter_) {
      this.notificationCenter_.hide();
    }
  }

  /** @override */
  getPrefs() {
    return this.prefs_;
  }

  /** @override */
  getDocument() {
    return window.document;
  }

  /** @override */
  reset() {
    this.term.reset();
  }

  /** @override */
  setProfile(profileId, callback = undefined) {
    this.prefs_.setProfile(profileId, callback);
  }

  /** @override */
  interpret(string) {
    this.term.write(string);
  }

  /** @override */
  focus() {
    this.term.focus();
  }

  /** @override */
  onOpenOptionsPage() {}

  /** @override */
  onTerminalReady() {}

  observePrefs_() {
    for (const pref in PrefToXtermOptions) {
      this.prefs_.addObserver(pref, (v) => {
        this.updateOption_(PrefToXtermOptions[pref], v);
      });
    }

    // This is for this.notificationCenter_.
    const setHtermCSSVariable = (name, value) => {
      document.body.style.setProperty(`--hterm-${name}`, value);
    };

    const setHtermColorCSSVariable = (name, color) => {
      const css = lib.notNull(lib.colors.normalizeCSS(color));
      const rgb = lib.colors.crackRGB(css).slice(0, 3).join(',');
      setHtermCSSVariable(name, rgb);
    };

    this.prefs_.addObserver('font-size', (v) => {
      this.updateOption_('fontSize', v);
      setHtermCSSVariable('font-size', `${v}px`);
    });

    // Theme-related preference items.
    this.prefs_.addObservers(null, {
      'background-color': (v) => {
        this.updateTheme_({background: v});
        setHtermColorCSSVariable('background-color', v);
      },
      'foreground-color': (v) => {
        this.updateTheme_({foreground: v});
        setHtermColorCSSVariable('foreground-color', v);
      },
      'cursor-color': (v) => {
        this.updateTheme_({cursor: v});
      },
      'color-palette-overrides': (v) => {
        if (!(v instanceof Array)) {
          // For terminal, we always expect this to be an array.
          console.warn('unexpected color palette: ', v);
          return;
        }
        const colors = {};
        for (let i = 0; i < v.length; ++i) {
          colors[ANSI_COLOR_NAMES[i]] = v[i];
        }
        this.updateTheme_(colors);
      },
    });
  }

  /**
   * @param {!Object} theme
   */
  updateTheme_(theme) {
    const newTheme = {...this.term.options.theme};
    for (const key in theme) {
      newTheme[key] = lib.colors.normalizeCSS(theme[key]);
    }
    this.updateOption_('theme', newTheme);
  }

  /**
   * Update one xterm.js option.
   *
   * @param {string} key
   * @param {*} value
   */
  updateOption_(key, value) {
    if (key === 'fontFamily') {
      this.updateFont_(/** @type {string} */(value));
      return;
    }
    // TODO: xterm supports updating multiple options at the same time. We
    // should probably do that.
    this.term.options[key] = value;
    this.scheduleFit_();
  }

  /**
   * Called when there is a "fontloadingdone" event. We need this because
   * `FontManager.loadFont()` does not guarantee loading all the font files.
   */
  async onFontLoadingDone_() {
    // If there is a pending font, the font is going to be refresh soon, so we
    // don't need to do anything.
    if (!this.pendingFont_) {
      this.scheduleRefreshFont_();
    }
  }

  onSelectionChange_() {
    const selection = this.term.getSelection();
    if (!selection) {
      return;
    }
    navigator.clipboard?.writeText(selection);
    if (!this.copyNotice_) {
      this.copyNotice_ = document.createElement('terminal-copy-notice');
    }
    setTimeout(() => this.showOverlay(lib.notNull(this.copyNotice_), 500), 200);
  }

  /**
   * Refresh xterm rendering for a font related event.
   */
  refreshFont_() {
    // We have to set the fontFamily option to a different string to trigger the
    // re-rendering. Appending a space at the end seems to be the easiest
    // solution. Note that `clearTextureAtlas()` and `refresh()` do not work for
    // us.
    //
    // TODO: Report a bug to xterm.js and ask for exposing a public function for
    // the refresh so that we don't need to do this hack.
    this.term.options.fontFamily += ' ';
  }

  /**
   * Update a font.
   *
   * @param {string} cssFontFamily
   */
  async updateFont_(cssFontFamily) {
    this.pendingFont_ = cssFontFamily;
    await this.fontManager_.loadFont(cssFontFamily);
    // Sleep a bit to wait for flushing fontloadingdone events. This is not
    // strictly necessary, but it should prevent `this.onFontLoadingDone_()`
    // to refresh font unnecessarily in some cases.
    await sleep(30);

    if (this.pendingFont_ !== cssFontFamily) {
      // `updateFont_()` probably is called again. Abort what we are doing.
      console.log(`pendingFont_ (${this.pendingFont_}) is changed` +
          ` (expecting ${cssFontFamily})`);
      return;
    }

    if (this.term.options.fontFamily !== cssFontFamily) {
      this.term.options.fontFamily = cssFontFamily;
    } else {
      // If the font is already the same, refresh font just to be safe.
      this.refreshFont_();
    }
    this.pendingFont_ = null;
    this.scheduleFit_();
  }
}

class HtermTerminal extends hterm.Terminal {
  /** @override */
  decorate(div) {
    super.decorate(div);

    const fontManager = new FontManager(this.getDocument());
    fontManager.loadPowerlineCSS().then(() => {
      const prefs = this.getPrefs();
      fontManager.loadFont(/** @type {string} */(prefs.get('font-family')));
      prefs.addObserver(
          'font-family',
          (v) => fontManager.loadFont(/** @type {string} */(v)));
    });
  }
}

/**
 * Constructs and returns a `hterm.Terminal` or a compatible one based on the
 * preference value.
 *
 * @param {{
 *   storage: !lib.Storage,
 *   profileId: string,
 * }} args
 * @return {!Promise<!hterm.Terminal>}
 */
export async function createEmulator({storage, profileId}) {
  let config = TERMINAL_EMULATORS.get('hterm');

  if (getOSInfo().alternative_emulator) {
    // TODO: remove the url param logic. This is temporary to make manual
    // testing a bit easier, which is also why this is not in
    // './js/terminal_info.js'.
    const emulator = ORIGINAL_URL.searchParams.get('emulator') ||
        await storage.getItem(`/hterm/profiles/${profileId}/terminal-emulator`);
    // Use the default (i.e. first) one if the pref is not set or invalid.
    config = TERMINAL_EMULATORS.get(emulator) ||
        TERMINAL_EMULATORS.values().next().value;
    console.log('Terminal emulator config: ', config);
  }

  switch (config.lib) {
    case 'xterm.js':
      {
        const terminal = new XtermTerminal({
          storage,
          profileId,
          enableWebGL: config.webgl,
        });
        // Don't await it so that the caller can override
        // `terminal.onTerminalReady()` before the terminal is ready.
        terminal.init();
        return terminal;
      }
    case 'hterm':
      return new HtermTerminal({profileId, storage});
    default:
      throw new Error('incorrect emulator config');
  }
}

class TerminalCopyNotice extends LitElement {
  /** @override */
  static get styles() {
    return css`
        :host {
          display: block;
          text-align: center;
        }

        svg {
          fill: currentColor;
        }
    `;
  }

  /** @override */
  render() {
    return html`
       ${ICON_COPY}
       <div>${hterm.messageManager.get('HTERM_NOTIFY_COPY')}</div>
    `;
  }
}

customElements.define('terminal-copy-notice', TerminalCopyNotice);
