/**
 * @fileoverview For supporting xterm.js and the terminal emulator.
 */

// TODO(b/236205389): add tests. For example, we should enable the test in
// terminal_tests.js for XtermTerminal.

import {Terminal, FitAddon, WebglAddon} from './xterm.js';
import {TERMINAL_EMULATORS, getOSInfo} from './terminal_common.js';

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
  'font-size': 'fontSize',
};

/**
 * This class observers a PreferenceManager and sets the corresponding options
 * on the xterm.js terminal when necessary.
 */
class PrefReflector {
  /**
   * @param {!hterm.PreferenceManager} prefs
   * @param {!Terminal} xtermTerminal
   */
  constructor(prefs, xtermTerminal) {
    this.xtermTerminal_ = xtermTerminal;
    this.theme_ = {};

    for (const pref in PrefToXtermOptions) {
      prefs.addObserver(pref, (v) => {
        this.xtermTerminal_.options[PrefToXtermOptions[pref]] = v;
      });
    }

    // Theme-related preference items.
    prefs.addObservers(null, {
      'background-color': (v) => {
        this.updateTheme_({background: v});
      },
      'foreground-color': (v) => {
        this.updateTheme_({foreground: v});
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
    for (const key in theme) {
      this.theme_[key] = lib.colors.normalizeCSS(theme[key]);
    }
    // Must copy, otherwise, xterm.js will not detect the change.
    this.xtermTerminal_.options.theme = Object.assign({}, this.theme_);
  }
}

/**
 * A terminal class that 1) uses xterm.js and 2) behaves like a `hterm.Terminal`
 * so that it can be used in existing code.
 *
 * TODO: Currently, this also behaves like a `hterm.Terminal.IO` object, which
 * kind of works but it is weird. We might want to just use the real
 * `hterm.Terminal.IO`.
 *
 * @extends {hterm.Terminal}
 * @unrestricted
 */
class XtermTerminal {
  /**
   * @param {{
   *   storage: !lib.Storage,
   *   profileId: string,
   *   enableWebGL: boolean,
   * }} args
   */
  constructor({storage, profileId, enableWebGL}) {
    /** @type {!hterm.PreferenceManager} */
    this.prefs_ = new hterm.PreferenceManager(storage, profileId);
    this.enableWebGL_ = enableWebGL;

    this.term = new Terminal();
    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);

    this.installUnimplementedStubs_();

    this.prefReflector_ = new PrefReflector(this.prefs_, this.term);

    this.term.onResize(({cols, rows}) => this.onTerminalResize(cols, rows));
    this.term.onData((data) => this.sendString(data));

    // Also pretends to be a `hterm.Terminal.IO` object.
    this.io = this;
    this.terminal_ = this;
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
        'hideOverlay',
        'setAccessibilityEnabled',
        'setBackgroundImage',
        'setCursorPosition',
        'setCursorVisible',
        'setTerminalProfile',
        'showOverlay',

        // This two are for `hterm.Terminal.IO`.
        'push',
        'pop',
    ];

    for (const name of methodNames) {
      this[name] = () => console.warn(`${name}() is not implemented`);
    }

    this.contextMenu = {
      setItems: () => {
        console.warn('.contextMenu.setItems() is not implemented');
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
    this.fitAddon.fit();
    if (this.enableWebGL_) {
      this.term.loadAddon(new WebglAddon());
    }
    (new ResizeObserver(() => this.fitAddon.fit())).observe(elem);
  }

  /** @override */
  getPrefs() {
    return this.prefs_;
  }

  /** @override */
  getDocument() {
    return window.document;
  }

  /**
   * This is a method from `hterm.Terminal.IO`.
   *
   * @param {!ArrayBuffer|!Array<number>} buffer The UTF-8 data to print.
   */
  writeUTF8(buffer) {
    this.term.write(new Uint8Array(buffer));
  }

  /** @override */
  print(data) {
    this.term.write(data);
  }

  /**
   * This is a method from `hterm.Terminal.IO`.
   *
   * @param {string} data
   */
  println(data) {
    this.term.writeln(data);
  }

  /**
   * This is a method from `hterm.Terminal.IO`.
   *
   * @param {number} width
   * @param {number} height
   */
  onTerminalResize(width, height) {}

  /** @override */
  onOpenOptionsPage() {}

  /** @override */
  onTerminalReady() {}

  /**
   * This is a method from `hterm.Terminal.IO`.
   *
   * @param {string} v
   */
  onVTKeystoke(v) {}

  /**
   * This is a method from `hterm.Terminal.IO`.
   *
   * @param {string} v
   */
  sendString(v) {}
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
    const prefKey = `/hterm/profiles/${profileId}/terminal-emulator`;
    // Use the default (i.e. first) one if the pref is not set or invalid.
    config = TERMINAL_EMULATORS.get(await storage.getItem(prefKey)) ||
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
      return new hterm.Terminal({profileId, storage});
    default:
      throw new Error('incorrect emulator config');
  }
}

