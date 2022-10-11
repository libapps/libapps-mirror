// Copyright 2022 The ChromiumOS Authors
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
import {TerminalTooltip} from './terminal_tooltip.js';
import {Terminal, Unicode11Addon, WebLinksAddon, WebglAddon}
    from './xterm.js';


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

/**
 * @typedef {{
 *   term: !Terminal,
 *   fontManager: !FontManager,
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
 * A custom link handler that:
 *
 * - Shows a tooltip with the url on a OSC 8 link. This is following what hterm
 *   is doing. Also, showing the tooltip is better for the security of the user
 *   because the link can have arbitrary text.
 * - Uses our own way to open the window.
 */
class LinkHandler {
  /**
   * @param {!Terminal} term
   */
  constructor(term) {
    this.term_ = term;
    /** @type {?TerminalTooltip} */
    this.tooltip_ = null;
  }

  /**
   * @return {!TerminalTooltip}
   */
  getTooltip_() {
    if (!this.tooltip_) {
      this.tooltip_ = /** @type {!TerminalTooltip} */(
          document.createElement('terminal-tooltip'));
      this.tooltip_.classList.add('xterm-hover');
      lib.notNull(this.term_.element).appendChild(this.tooltip_);
    }
    return this.tooltip_;
  }

  /**
   * @param {!MouseEvent} ev
   * @param {string} url
   * @param {!Object} range
   */
  activate(ev, url, range) {
    lib.f.openWindow(url, '_blank');
  }

  /**
   * @param {!MouseEvent} ev
   * @param {string} url
   * @param {!Object} range
   */
  hover(ev, url, range) {
    this.getTooltip_().show(url, {x: ev.clientX, y: ev.clientY});
  }

  /**
   * @param {!MouseEvent} ev
   * @param {string} url
   * @param {!Object} range
   */
  leave(ev, url, range) {
    this.getTooltip_().hide();
  }
}

class Bell {
  constructor() {
    this.showNotification = false;

    /** @type {?Audio} */
    this.audio_ = null;
    /** @type {?Notification} */
    this.notification_ = null;
    this.coolDownUntil_ = 0;
  }

  /**
   * Set whether a bell audio should be played.
   *
   * @param {boolean} value
   */
  set playAudio(value) {
    this.audio_ = value ?
        new Audio(lib.resource.getDataUrl('hterm/audio/bell')) : null;
  }

  ring() {
    const now = Date.now();
    if (now < this.coolDownUntil_) {
      return;
    }
    this.coolDownUntil_ = now + 500;

    this.audio_?.play();
    if (this.showNotification && !document.hasFocus() && !this.notification_) {
      this.notification_ = new Notification(
          `\u266A ${document.title} \u266A`,
          {icon: lib.resource.getDataUrl('hterm/images/icon-96')});
      // Close the notification after a timeout. Note that this is different
      // from hterm's behavior, but I think it makes more sense to do so.
      setTimeout(() => {
        this.notification_.close();
        this.notification_ = null;
      }, 5000);
    }
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

    this.inited_ = false;
    this.profileId_ = profileId;
    /** @type {!hterm.PreferenceManager} */
    this.prefs_ = new hterm.PreferenceManager(storage, profileId);
    this.enableWebGL_ = enableWebGL;

    // TODO: we should probably pass the initial prefs to the ctor.
    this.term = testParams?.term || new Terminal({allowProposedApi: true});
    this.fontManager_ = testParams?.fontManager || fontManager;

    /** @type {?Element} */
    this.container_;
    this.bell_ = new Bell();
    this.scheduleFit_ = delayedScheduler(() => this.fit_(),
        testParams ? 0 : 250);

    this.term.loadAddon(
        new WebLinksAddon((e, uri) => lib.f.openWindow(uri, '_blank')));
    this.term.loadAddon(new Unicode11Addon());
    this.term.unicode.activeVersion = '11';

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
    this.term.onBinary((data) => this.io.onVTKeystroke(data));
    this.term.onTitleChange((title) => document.title = title);
    this.term.onSelectionChange(() => this.copySelection_());
    this.term.onBell(() => this.ringBell());

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

    this.term.options.linkHandler = new LinkHandler(this.term);
    this.term.options.theme = {
      // The webgl cursor layer also paints the character under the cursor with
      // this `cursorAccent` color. We use a completely transparent color here
      // to effectively disable that.
      cursorAccent: 'rgba(0, 0, 0, 0)',
      customGlyphs: true,
      selectionBackground: 'rgba(174, 203, 250, .6)',
      selectionInactiveBackground: 'rgba(218, 220, 224, .6)',
      selectionForeground: 'black',
    };
    this.observePrefs_();
  }

  /** @override */
  ringBell() {
    this.bell_.ring();
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
    this.container_ = elem;
    (async () => {
      await new Promise((resolve) => this.prefs_.readStorage(resolve));
      // This will trigger all the observers to set the terminal options before
      // we call `this.term.open()`.
      this.prefs_.notifyAll();

      const screenPaddingSize = /** @type {number} */(
          this.prefs_.get('screen-padding-size'));
      elem.style.paddingTop = elem.style.paddingLeft = `${screenPaddingSize}px`;

      this.inited_ = true;
      this.term.open(elem);

      this.scheduleFit_();
      if (this.enableWebGL_) {
        this.term.loadAddon(new WebglAddon());
      }
      this.term.focus();
      (new ResizeObserver(() => this.scheduleFit_())).observe(elem);
      // TODO: Make a11y work. Maybe we can just use hterm.AccessibilityReader.
      this.notificationCenter_ = new hterm.NotificationCenter(document.body);

      // Block right-click context menu from popping up.
      elem.addEventListener('contextmenu', (e) => e.preventDefault());

      // Add a handler for pasting with the mouse.
      elem.addEventListener('mousedown', async (e) => {
        if (this.term.modes.mouseTrackingMode !== 'none') {
          // xterm.js is in mouse mode and will handle the event.
          return;
        }
        const MIDDLE = 1;
        const RIGHT = 2;
        if (e.button === MIDDLE || (e.button === RIGHT &&
                this.prefs_.getBoolean('mouse-right-click-paste'))) {
          // Paste.
          if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            this.term.paste(text);
          }
        }
      });

      this.onTerminalReady();
    })();
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
      this.updateOption_('fontSize', v, true);
      setHtermCSSVariable('font-size', `${v}px`);
    });

    // TODO(lxj): support option "lineHeight", "scrollback".
    this.prefs_.addObservers(null, {
      'audible-bell-sound': (v) => {
        this.bell_.playAudio = !!v;
      },
      'desktop-notification-bell': (v) => {
        this.bell_.showNotification = v;
      },
      'background-color': (v) => {
        this.updateTheme_({background: v});
        setHtermColorCSSVariable('background-color', v);
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
      'cursor-blink': (v) => this.updateOption_('cursorBlink', v, false),
      'cursor-color': (v) => this.updateTheme_({cursor: v}),
      'cursor-shape': (v) => {
        let shape;
        if (v === 'BEAM') {
          shape = 'bar';
        } else {
          shape = v.toLowerCase();
        }
        this.updateOption_('cursorStyle', shape, false);
      },
      'font-family': (v) => this.updateFont_(v),
      'foreground-color': (v) => {
        this.updateTheme_({foreground: v});
        setHtermColorCSSVariable('foreground-color', v);
      },
    });

    for (const name of ['keybindings-os-defaults', 'pass-ctrl-n', 'pass-ctrl-t',
        'pass-ctrl-w', 'pass-ctrl-tab', 'pass-ctrl-number', 'pass-alt-number',
        'ctrl-plus-minus-zero-zoom', 'ctrl-c-copy', 'ctrl-v-paste']) {
      this.prefs_.addObserver(name, this.scheduleResetKeyDownHandlers_);
    }
  }

  /**
   * Fit the terminal to the containing HTML element.
   */
  fit_() {
    if (!this.inited_) {
      return;
    }

    const screenPaddingSize = /** @type {number} */(
        this.prefs_.get('screen-padding-size'));

    const calc = (size, cellSize) => {
      return Math.floor((size - 2 * screenPaddingSize) / cellSize);
    };

    // Unfortunately, it looks like we have to use private API from xterm.js.
    // Maybe we should patch the FitAddon so that it works for us.
    const dimensions = this.term._core._renderService.dimensions;
    const cols = calc(this.container_.offsetWidth, dimensions.actualCellWidth);
    const rows = calc(this.container_.offsetHeight,
        dimensions.actualCellHeight);
    if (cols >= 0 && rows >= 0) {
      this.term.resize(cols, rows);
    }
  }

  /**
   * @param {!Object} theme
   */
  updateTheme_(theme) {
    const updateTheme = (target) => {
      for (const [key, value] of Object.entries(theme)) {
        target[key] = lib.colors.normalizeCSS(value);
      }
    };

    // Must use a new theme object to trigger re-render if we have initialized.
    if (this.inited_) {
      const newTheme = {...this.term.options.theme};
      updateTheme(newTheme);
      this.term.options.theme = newTheme;
      return;
    }

    updateTheme(this.term.options.theme);
  }

  /**
   * Update one xterm.js option. Use updateTheme_()/updateFont_() for
   * theme/font.
   *
   * @param {string} key
   * @param {*} value
   * @param {boolean} scheduleFit
   */
  updateOption_(key, value, scheduleFit) {
    // TODO: xterm supports updating multiple options at the same time. We
    // should probably do that.
    this.term.options[key] = value;
    if (scheduleFit) {
      this.scheduleFit_();
    }
  }

  /**
   * Called when there is a "fontloadingdone" event. We need this because
   * `FontManager.loadFont()` does not guarantee loading all the font files.
   */
  async onFontLoadingDone_() {
    // If there is a pending font, the font is going to be refresh soon, so we
    // don't need to do anything.
    if (this.inited_ && !this.pendingFont_) {
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

    this.updateOption_('fontSize', Math.max(1, newFontSize), true);
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

    // Temporary shortcut to refresh the rendering in case of rendering errors.
    // TODO(lxj): remove after this is fixed:
    // https://github.com/xtermjs/xterm.js/issues/3878
    set(Modifier.Ctrl | Modifier.Shift, keyCodes.L,
        /** @suppress {missingProperties} */
        () => {
          this.scheduleRefreshFont_();
          // Refresh the cursor layer.
          if (this.enableWebGL_) {
            this.term?._core?._renderService?._renderer?._renderLayers[1]
                ?._clearAll();
          }
        },
    );

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
