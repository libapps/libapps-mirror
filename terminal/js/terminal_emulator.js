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


/** @enum {number} */
export const Modifier = {
  Shift: 1 << 0,
  Alt: 1 << 1,
  Ctrl: 1 << 2,
  Meta: 1 << 3,
};

// This is just a static map from key names to key codes. It helps make the code
// a bit more readable.
const keyCodes = hterm.Parser.identifiers.keyCodes;

/**
 * Encode a key combo (i.e. modifiers + a normal key) to an unique number.
 *
 * @param {number} modifiers
 * @param {number} keyCode
 * @return {number}
 */
export function encodeKeyCombo(modifiers, keyCode) {
  return keyCode << 4 | modifiers;
}

const OS_DEFAULT_BINDINGS = [
  // Submit feedback.
  encodeKeyCombo(Modifier.Alt | Modifier.Shift, keyCodes.I),
  // Toggle chromevox.
  encodeKeyCombo(Modifier.Ctrl | Modifier.Alt, keyCodes.Z),
  // Switch input method.
  encodeKeyCombo(Modifier.Ctrl, keyCodes.SPACE),

  // Dock window left/right.
  encodeKeyCombo(Modifier.Alt, keyCodes.BRACKET_LEFT),
  encodeKeyCombo(Modifier.Alt, keyCodes.BRACKET_RIGHT),

  // Maximize/minimize window.
  encodeKeyCombo(Modifier.Alt, keyCodes.EQUAL),
  encodeKeyCombo(Modifier.Alt, keyCodes.MINUS),
];


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
 * Compute a control character for a given character.
 *
 * @param {string} ch
 * @return {string}
 */
function ctl(ch) {
  return String.fromCharCode(ch.charCodeAt(0) - 64);
}

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
    this.ctrlCKeyDownHandler_ = this.ctrlCKeyDownHandler_.bind(this);
    this.ctrlVKeyDownHandler_ = this.ctrlVKeyDownHandler_.bind(this);
    this.zoomKeyDownHandler_ = this.zoomKeyDownHandler_.bind(this);

    this.profileId_ = profileId;
    /** @type {!hterm.PreferenceManager} */
    this.prefs_ = new hterm.PreferenceManager(storage, profileId);
    this.enableWebGL_ = enableWebGL;

    // TODO: we should probably pass the initial prefs to the ctor.
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
    this.installEscapeSequenceHandlers_();

    this.term.onResize(({cols, rows}) => this.io.onTerminalResize(cols, rows));
    // We could also use `this.io.sendString()` except for the nassh exit
    // prompt, which only listens to onVTKeystroke().
    this.term.onData((data) => this.io.onVTKeystroke(data));
    this.term.onTitleChange((title) => document.title = title);
    this.term.onSelectionChange(() => this.copySelection_());

    /**
     * A mapping from key combo (see encodeKeyCombo()) to a handler function.
     *
     * If a key combo is in the map:
     *
     * - The handler instead of xterm.js will handle the keydown event.
     * - Keyup and keypress will be ignored by both us and xterm.js.
     *
     * We re-generate this map every time a relevant pref value is changed. This
     * is ok because pref changes are rare.
     *
     * @type {!Map<number, function(!KeyboardEvent)>}
     */
    this.keyDownHandlers_ = new Map();
    this.scheduleResetKeyDownHandlers_ =
        delayedScheduler(() => this.resetKeyDownHandlers_(), 250);

    this.term.attachCustomKeyEventHandler(
        this.customKeyEventHandler_.bind(this));

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

  installEscapeSequenceHandlers_() {
    // OSC 52 for copy.
    this.term.parser.registerOscHandler(52, (args) => {
      // Args comes in as a single 'clipboard;b64-data' string.  The clipboard
      // parameter is used to select which of the X clipboards to address. Since
      // we're not integrating with X, we treat them all the same.
      const parsedArgs = args.match(/^[cps01234567]*;(.*)/);
      if (!parsedArgs) {
        return true;
      }

      let data;
      try {
        data = window.atob(parsedArgs[1]);
      } catch (e) {
        // If the user sent us invalid base64 content, silently ignore it.
        return true;
      }
      const decoder = new TextDecoder();
      const bytes = lib.codec.stringToCodeUnitArray(data);
      this.copyString_(decoder.decode(bytes));

      return true;
    });
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

    for (const name of ['keybindings-os-defaults', 'pass-ctrl-n', 'pass-ctrl-t',
        'pass-ctrl-w', 'pass-ctrl-tab', 'pass-ctrl-number', 'pass-alt-number',
        'ctrl-plus-minus-zero-zoom', 'ctrl-c-copy', 'ctrl-v-paste']) {
      this.prefs_.addObserver(name, this.scheduleResetKeyDownHandlers_);
    }
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

  copySelection_() {
    this.copyString_(this.term.getSelection());
  }

  /** @param {string} data */
  copyString_(data) {
    if (!data) {
      return;
    }
    navigator.clipboard?.writeText(data);
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

  /**
   * @param {!KeyboardEvent} ev
   * @return {boolean} Return false if xterm.js should not handle the key event.
   */
  customKeyEventHandler_(ev) {
    const modifiers = (ev.shiftKey ? Modifier.Shift : 0) |
        (ev.altKey ? Modifier.Alt : 0) |
        (ev.ctrlKey ? Modifier.Ctrl : 0) |
        (ev.metaKey ? Modifier.Meta : 0);
    const handler = this.keyDownHandlers_.get(
        encodeKeyCombo(modifiers, ev.keyCode));
    if (handler) {
      if (ev.type === 'keydown') {
        handler(ev);
      }
      return false;
    }

    return true;
  }

  /**
   * A keydown handler for zoom-related keys.
   *
   * @param {!KeyboardEvent} ev
   */
  zoomKeyDownHandler_(ev) {
    ev.preventDefault();

    if (this.prefs_.get('ctrl-plus-minus-zero-zoom') === ev.shiftKey) {
      // The only one with a control code.
      if (ev.keyCode === keyCodes.MINUS) {
        this.io.onVTKeystroke('\x1f');
      }
      return;
    }

    let newFontSize;
    switch (ev.keyCode) {
      case keyCodes.ZERO:
        newFontSize = this.prefs_.get('font-size');
        break;
      case keyCodes.MINUS:
        newFontSize = this.term.options.fontSize - 1;
        break;
      default:
        newFontSize = this.term.options.fontSize + 1;
        break;
    }

    this.updateOption_('fontSize', Math.max(1, newFontSize));
  }

  /** @param {!KeyboardEvent} ev */
  ctrlCKeyDownHandler_(ev) {
    ev.preventDefault();
    if (this.prefs_.get('ctrl-c-copy') !== ev.shiftKey &&
        this.term.hasSelection()) {
      this.copySelection_();
      return;
    }

    this.io.onVTKeystroke('\x03');
  }

  /** @param {!KeyboardEvent} ev */
  ctrlVKeyDownHandler_(ev) {
    if (this.prefs_.get('ctrl-v-paste') !== ev.shiftKey) {
      // Don't do anything and let the browser handles the key.
      return;
    }

    ev.preventDefault();
    this.io.onVTKeystroke('\x16');
  }

  resetKeyDownHandlers_() {
    this.keyDownHandlers_.clear();

    /**
     * Don't do anything and let the browser handles the key.
     *
     * @param {!KeyboardEvent} ev
     */
    const noop = (ev) => {};

    /**
     * @param {number} modifiers
     * @param {number} keyCode
     * @param {function(!KeyboardEvent)} func
     */
    const set = (modifiers, keyCode, func) => {
      this.keyDownHandlers_.set(encodeKeyCombo(modifiers, keyCode),
          func);
    };

    /**
     * @param {number} modifiers
     * @param {number} keyCode
     * @param {function(!KeyboardEvent)} func
     */
    const setWithShiftVersion = (modifiers, keyCode, func) => {
      set(modifiers, keyCode, func);
      set(modifiers | Modifier.Shift, keyCode, func);
    };


    // Ctrl+/
    set(Modifier.Ctrl, 191, (ev) => {
      ev.preventDefault();
      this.io.onVTKeystroke(ctl('_'));
    });

    // Settings page.
    set(Modifier.Ctrl | Modifier.Shift, keyCodes.P, (ev) => {
      ev.preventDefault();
      chrome.terminalPrivate.openOptionsPage(() => {});
    });

    if (this.prefs_.get('keybindings-os-defaults')) {
      for (const binding of OS_DEFAULT_BINDINGS) {
        this.keyDownHandlers_.set(binding, noop);
      }
    }

    /** @param {!KeyboardEvent} ev */
    const newWindow = (ev) => {
      ev.preventDefault();
      chrome.terminalPrivate.openWindow();
    };
    set(Modifier.Ctrl | Modifier.Shift, keyCodes.N, newWindow);
    if (this.prefs_.get('pass-ctrl-n')) {
      set(Modifier.Ctrl, keyCodes.N, newWindow);
    }

    if (this.prefs_.get('pass-ctrl-t')) {
      setWithShiftVersion(Modifier.Ctrl, keyCodes.T, noop);
    }

    if (this.prefs_.get('pass-ctrl-w')) {
      setWithShiftVersion(Modifier.Ctrl, keyCodes.W, noop);
    }

    if (this.prefs_.get('pass-ctrl-tab')) {
      setWithShiftVersion(Modifier.Ctrl, keyCodes.TAB, noop);
    }

    const passCtrlNumber = this.prefs_.get('pass-ctrl-number');

    /**
     * Set a handler for the key combo ctrl+<number>.
     *
     * @param {number} number 1 to 9
     * @param {string} controlCode The control code to send if we don't want to
     *     let the browser to handle it.
     */
    const setCtrlNumberHandler = (number, controlCode) => {
      let func = noop;
      if (!passCtrlNumber) {
        func = (ev) => {
          ev.preventDefault();
          this.io.onVTKeystroke(controlCode);
        };
      }
      set(Modifier.Ctrl, keyCodes.ZERO + number, func);
    };

    setCtrlNumberHandler(1, '1');
    setCtrlNumberHandler(2, ctl('@'));
    setCtrlNumberHandler(3, ctl('['));
    setCtrlNumberHandler(4, ctl('\\'));
    setCtrlNumberHandler(5, ctl(']'));
    setCtrlNumberHandler(6, ctl('^'));
    setCtrlNumberHandler(7, ctl('_'));
    setCtrlNumberHandler(8, '\x7f');
    setCtrlNumberHandler(9, '9');

    if (this.prefs_.get('pass-alt-number')) {
      for (let keyCode = keyCodes.ZERO; keyCode <= keyCodes.NINE; ++keyCode) {
        set(Modifier.Alt, keyCode, noop);
      }
    }

    for (const keyCode of [keyCodes.ZERO, keyCodes.MINUS, keyCodes.EQUAL]) {
      setWithShiftVersion(Modifier.Ctrl, keyCode, this.zoomKeyDownHandler_);
    }

    setWithShiftVersion(Modifier.Ctrl, keyCodes.C, this.ctrlCKeyDownHandler_);
    setWithShiftVersion(Modifier.Ctrl, keyCodes.V, this.ctrlVKeyDownHandler_);
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
