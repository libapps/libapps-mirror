// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview For supporting xterm.js and the terminal emulator.
 */

// TODO(b/236205389): support option smoothScrollDuration?

import {lib} from '../../libdot/index.js';
import {hterm} from '../../hterm/index.js';

import {LitElement, css, html} from './lit.js';
import {FontManager, ORIGINAL_URL, backgroundImageLocalStorageKey, definePrefs,
  delayedScheduler, fontManager, sleep} from './terminal_common.js';
import {TerminalContextMenu} from './terminal_context_menu.js';
import {TerminalFindBar} from './terminal_find_bar.js';
import {ICON_COPY} from './terminal_icons.js';
import {TerminalTooltip} from './terminal_tooltip.js';
import {Terminal, CanvasAddon, SearchAddon, Unicode11Addon, WebLinksAddon,
  WebglAddon} from './xterm.js';
import {XtermInternal} from './terminal_xterm_internal.js';


/** @enum {number} */
export const Modifier = {
  Shift: 1 << 0,
  Alt: 1 << 1,
  Ctrl: 1 << 2,
  Meta: 1 << 3,
};

// This is just a static map from key names to key codes. It helps make the code
// a bit more readable.
export const keyCodes = hterm.Parser.identifiers.keyCodes;

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
 * The value is the CSI code to send when no modifier keys are pressed.
 *
 * @type {!Map<number, string>}
 */
const ARROW_AND_SIX_PACK_KEYS = new Map([
    [keyCodes.UP, '\x1b[A'],
    [keyCodes.DOWN, '\x1b[B'],
    [keyCodes.RIGHT, '\x1b[C'],
    [keyCodes.LEFT, '\x1b[D'],
    // 6-pack keys.
    [keyCodes.INSERT, '\x1b[2~'],
    [keyCodes.DEL, '\x1b[3~'],
    [keyCodes.HOME, '\x1b[H'],
    [keyCodes.END, '\x1b[F'],
    [keyCodes.PAGE_UP, '\x1b[5~'],
    [keyCodes.PAGE_DOWN, '\x1b[6~'],
]);

// A z-index large enough to be on the very top.
const TOP_MOST_Z_INDEX = 10;

const SEARCH_OPTIONS = {
  decorations: {
    // We don't use `activeMatchBackground` here. The search addon starts the
    // serach from the current selection if there is one. Setting
    // `activeMatchBackbround` gives the false impression that the search starts
    // at the "active match", which is not the case if the user changes the
    // current selection by themselves.
    //
    // This is similar to what Chrome's find bar use.
    matchBackground: '#f0e13a',
  },
};

/**
 * @typedef {{
 *   term: !Terminal,
 *   fontManager: !FontManager,
 *   xtermInternal: !XtermInternal,
 *   searchAddon: !SearchAddon,
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
 * Create a notification following hterm's style.
 *
 * @param {string} title
 * @param {?string=} body
 * @return {!Notification}
 */
function createNotification(title, body) {
  const options = {icon: lib.resource.getDataUrl('hterm/images/icon-96')};
  if (body) {
    options.body = body;
  }
  return new Notification(`\u266A ${title} \u266A`, options);
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
      this.notification_ = createNotification(document.title);
      // Close the notification after a timeout. Note that this is different
      // from hterm's behavior, but I think it makes more sense to do so.
      setTimeout(() => {
        this.notification_.close();
        this.notification_ = null;
      }, 5000);
    }
  }
}

const A11Y_BUTTON_STYLE = `
position: fixed;
z-index: ${TOP_MOST_Z_INDEX};
right: 16px;
`;

// TODO: we should subscribe to the xterm.js onscroll event, and
// disable/enable the buttons accordingly. However, xterm.js does not seem to
// emit the onscroll event when the viewport is scrolled by the mouse. See
// https://github.com/xtermjs/xterm.js/issues/3864
export class A11yButtons {
  /**
   * @param {!Terminal} term
   * @param {!hterm.AccessibilityReader} htermA11yReader
   */
  constructor(term, htermA11yReader) {
    this.term_ = term;
    this.htermA11yReader_ = htermA11yReader;
    this.pageUpButton = document.createElement('button');
    this.pageUpButton.style.cssText = A11Y_BUTTON_STYLE;
    this.pageUpButton.textContent =
        hterm.messageManager.get('HTERM_BUTTON_PAGE_UP');
    this.pageUpButton.addEventListener('click',
        () => this.scrollPages_(-1));

    this.pageDownButton = document.createElement('button');
    this.pageDownButton.style.cssText = A11Y_BUTTON_STYLE;
    this.pageDownButton.textContent =
        hterm.messageManager.get('HTERM_BUTTON_PAGE_DOWN');
    this.pageDownButton.addEventListener('click',
        () => this.scrollPages_(1));

    this.resetPos_();

    this.onSelectionChange_ = this.onSelectionChange_.bind(this);
  }

  /**
   * @param {number} amount
   */
  scrollPages_(amount) {
    this.term_.scrollPages(amount);
    this.announceScreenContent_();
  }

  announceScreenContent_() {
    const activeBuffer = this.term_.buffer.active;

    let percentScrolled = 100;
    if (activeBuffer.baseY !== 0) {
      percentScrolled = Math.round(
          100 * activeBuffer.viewportY / activeBuffer.baseY);
    }

    let currentScreenContent = hterm.messageManager.get(
        'HTERM_ANNOUNCE_CURRENT_SCREEN_HEADER',
        [percentScrolled],
        '$1% scrolled,');

    currentScreenContent += '\n';

    const rowEnd = Math.min(activeBuffer.viewportY + this.term_.rows,
        activeBuffer.length);
    for (let i = activeBuffer.viewportY; i < rowEnd; ++i) {
      currentScreenContent +=
          activeBuffer.getLine(i).translateToString(true) + '\n';
    }
    currentScreenContent = currentScreenContent.trim();

    this.htermA11yReader_.assertiveAnnounce(currentScreenContent);
  }

  /**
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    if (enabled) {
      document.addEventListener('selectionchange', this.onSelectionChange_);
    } else {
      this.resetPos_();
      document.removeEventListener('selectionchange', this.onSelectionChange_);
    }
  }

  resetPos_() {
    this.pageUpButton.style.top = '-200px';
    this.pageDownButton.style.bottom = '-200px';
  }

  onSelectionChange_() {
    this.resetPos_();

    const selectedElement = document.getSelection().anchorNode?.parentElement;
    if (selectedElement === this.pageUpButton) {
      this.pageUpButton.style.top = '16px';
    } else if (selectedElement === this.pageDownButton) {
      this.pageDownButton.style.bottom = '16px';
    }
  }
}

const BACKGROUND_IMAGE_KEY = 'background-image';

class BackgroundImageWatcher {
  /**
   * @param {!hterm.PreferenceManager} prefs
   * @param {function(string)} onChange This is called with the background image
   *     (could be empty) whenever it changes.
   */
  constructor(prefs, onChange) {
    this.prefs_ = prefs;
    this.onChange_ = onChange;
    this.localStorageKey_ = backgroundImageLocalStorageKey(prefs);
  }

  /**
   * Call once to start watching for background image changes.
   */
  watch() {
    window.addEventListener('storage', (e) => {
      if (e.key === this.localStorageKey_) {
        this.onChange_(this.getBackgroundImage());
      }
    });
    this.prefs_.addObserver(BACKGROUND_IMAGE_KEY, () => {
      this.onChange_(this.getBackgroundImage());
    });
  }

  getBackgroundImage() {
    const image = window.localStorage.getItem(this.localStorageKey_);
    if (image) {
      return `url(${image})`;
    }

    return this.prefs_.getString(BACKGROUND_IMAGE_KEY);
  }
}

let xtermTerminalStringsLoaded = false;

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
   *   testParams: (!XtermTerminalTestParams|undefined),
   * }} args
   */
  constructor({storage, profileId, testParams}) {
    this.ctrlCKeyDownHandler_ = this.ctrlCKeyDownHandler_.bind(this);
    this.ctrlVKeyDownHandler_ = this.ctrlVKeyDownHandler_.bind(this);
    this.zoomKeyDownHandler_ = this.zoomKeyDownHandler_.bind(this);

    this.inited_ = false;
    this.profileId_ = profileId;
    /** @type {!hterm.PreferenceManager} */
    this.prefs_ = new hterm.PreferenceManager(storage, profileId);
    definePrefs(this.prefs_);

    // TODO: we should probably pass the initial prefs to the ctor.
    this.term = testParams?.term || new Terminal({allowProposedApi: true});
    this.xtermInternal_ = testParams?.xtermInternal ||
        new XtermInternal(this.term);
    this.fontManager_ = testParams?.fontManager || fontManager;

    this.renderAddonType_ = WebglAddon;
    if (!document.createElement('canvas').getContext('webgl2')) {
      console.warn('Webgl2 is not supported. Fall back to canvas renderer');
      this.renderAddonType_ = CanvasAddon;
    }

    /** @type {?Element} */
    this.container_;
    this.bell_ = new Bell();
    this.scheduleFit_ = delayedScheduler(() => this.fit_(),
        testParams ? 0 : 250);

    if (!testParams) {
      this.term.loadAddon(
          new WebLinksAddon((e, uri) => lib.f.openWindow(uri, '_blank')));
      this.term.loadAddon(new Unicode11Addon());
      this.term.unicode.activeVersion = '11';
    }

    // This tracks whether an search is in progress. Note that you can get false
    // negative. For example, when the the terminal has new output, the search
    // addon will start search automatically, but this variable will not be set
    // to true.
    this.searchInProgress_ = false;

    this.searchAddon_ = testParams?.searchAddon || new SearchAddon();
    this.searchAddon_.onDidChangeResults(({resultIndex, resultCount}) => {
      this.searchInProgress_ = false;
      this.findBar_.setCounter(resultIndex, resultCount);
    });
    this.term.loadAddon(this.searchAddon_);

    this.pendingFont_ = null;
    this.scheduleRefreshFont_ = delayedScheduler(
        () => this.refreshFont_(), 100);
    document.fonts.addEventListener('loadingdone',
        () => this.onFontLoadingDone_());

    this.installUnimplementedStubs_();
    this.installEscapeSequenceHandlers_();

    this.term.onResize(({cols, rows}) => {
      this.io.onTerminalResize(cols, rows);
      if (this.prefs_.get('enable-resize-status')) {
        this.showOverlay(`${cols} × ${rows}`);
      }
    });
    // We could also use `this.io.sendString()` except for the nassh exit
    // prompt, which only listens to onVTKeystroke().
    this.term.onData((data) => this.io.onVTKeystroke(data));
    this.term.onBinary((data) => this.io.onVTKeystroke(data));
    this.term.onTitleChange((title) => this.setWindowTitle(title));
    this.term.onSelectionChange(() => {
      // The search addon might change the current selection to a match. This is
      // a best effort attempt (because `searchInProgress` can have false
      // nagative) to avoid copying when this happens.
      if (!this.searchInProgress_ && this.prefs_.get('copy-on-select')) {
        this.copySelection_();
      }
    });
    this.term.onBell(() => this.ringBell());

    // This is for supporting `this.keyboard.bindings.addBindings()`, which is
    // used by nasftp_cli.js.
    this.htermKeyBindings_ = new hterm.Keyboard.Bindings();
    this.keyboard = {
      bindings: this.htermKeyBindings_,
    };
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

    this.term.attachCustomKeyEventHandler((ev) => !this.handleKeyEvent_(ev));

    this.io = new XtermTerminalIO(this);
    this.notificationCenter_ = null;
    this.htermA11yReader_ = null;
    this.a11yEnabled_ = false;
    this.a11yButtons_ = null;
    this.copyNotice_ = null;
    this.scrollOnOutputListener_ = null;
    this.backgroundImageWatcher_ = new BackgroundImageWatcher(this.prefs_,
        this.setBackgroundImage.bind(this));
    this.renderAddon_ = null;
    this.userCSSElement_ = null;
    this.userCSSTextElement_ = null;

    this.contextMenu_ = /** @type {!TerminalContextMenu} */(
        document.createElement('terminal-context-menu'));
    this.contextMenu_.style.zIndex = TOP_MOST_Z_INDEX;
    this.contextMenu = {
      setItems: (items) => this.contextMenu_.items = items,
    };

    this.findBar_ = /** @type {!TerminalFindBar} */(
        document.createElement('terminal-find-bar'));
    Object.assign(this.findBar_.style, {
      position: 'absolute',
      right: '16px',
      top: '0',
      zIndex: TOP_MOST_Z_INDEX,
    });

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
    if (!xtermTerminalStringsLoaded) {
      xtermTerminalStringsLoaded = true;
      Terminal.strings.promptLabel =
          hterm.messageManager.get('TERMINAL_INPUT_LABEL');
      Terminal.strings.tooMuchOutput =
          hterm.messageManager.get('TERMINAL_TOO_MUCH_OUTPUT_MESSAGE');
    }
  }

  /** @override */
  setWindowTitle(title) {
    document.title = title;
  }

  /** @override */
  ringBell() {
    this.bell_.ring();
  }

  /** @override */
  print(str) {
    this.xtermInternal_.print(str);
  }

  /** @override */
  wipeContents() {
    this.term.clear();
  }

  /** @override */
  clearHome() {
    for (let i = 0; i < this.term.rows; ++i) {
      this.xtermInternal_.eraseInBufferLine(i, 0, this.term.cols);
    }
    this.xtermInternal_.setCursor(0, 0);
  }

  /** @override */
  eraseToLeft() {
    const {cursorX, cursorY} = this.term.buffer.active;
    this.xtermInternal_.eraseInBufferLine(cursorY, 0, cursorX + 1);
  }

  /** @override */
  eraseLine() {
    const {cursorY} = this.term.buffer.active;
    this.xtermInternal_.eraseInBufferLine(cursorY, 0, this.term.cols);
  }

  /** @override */
  setCursorPosition(row, column) {
    this.xtermInternal_.setCursor(column, row);
  }

  /** @override */
  setCursorColumn(column) {
    this.xtermInternal_.setCursor(column, this.term.buffer.active.cursorY);
  }

  /** @override */
  newLine() {
    this.xtermInternal_.newLine();
  }

  /** @override */
  cursorLeft(number) {
    this.xtermInternal_.moveCursor(-(number ?? 1), 0);
  }

  /** @override */
  setAccessibilityEnabled(enabled) {
    if (enabled === this.a11yEnabled_) {
      return;
    }
    this.a11yEnabled_ = enabled;

    this.a11yButtons_.setEnabled(enabled);
    this.htermA11yReader_.setAccessibilityEnabled(enabled);

    if (enabled) {
      this.xtermInternal_.enableA11y(this.a11yButtons_.pageUpButton,
          this.a11yButtons_.pageDownButton);
    } else {
      this.xtermInternal_.disableA11y();
    }
  }

  hasBackgroundImage() {
    return !!this.container_.style.backgroundImage;
  }

  /** @override */
  setBackgroundImage(image) {
    this.container_.style.backgroundImage = image || '';
    this.updateBackgroundColor_(this.prefs_.getString('background-color'));
  }

  /**
   * Install stubs for stuff that we haven't implemented yet so that the code
   * still runs.
   */
  installUnimplementedStubs_() {
    const methodNames = [
        'setCursorVisible',
        'uninstallKeyboard',
    ];

    for (const name of methodNames) {
      this[name] = () => console.warn(`${name}() is not implemented`);
    }

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

    // URxvt perl modules. We only support "notify".
    this.term.parser.registerOscHandler(777, (args) => {
      // Match 'notify;<title>[;<message>]'.
      const match = args.match(/^notify;([^;]*)(?:;(.*))?$/);
      if (match) {
        createNotification(match[1], match[2]);
      }

      return true;
    });

    this.xtermInternal_.installTmuxControlModeHandler(
        (data) => this.onTmuxControlModeLine(data));
    this.xtermInternal_.installEscKHandler();
  }

  installA11yKeyPressHandler_() {
    // Handle keypress when the user focuses the a11y tree with ChromeVox.
    // Note that we check the target against <body> instead of the a11y tree
    // because of bug https://issuetracker.google.com/298164476.
    document.body.addEventListener('keydown', (e) => {
      if (e.target === document.body) {
        switch (e.keyCode) {
          case keyCodes.C:
            // For both <ctrl-c> and <ctrl-shift-c>
            if (e.ctrlKey) {
              this.copySelection_();
            }
            break;
          case keyCodes.ESCAPE:
            this.focus();
            break;
          default:
            return;
        }
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  /**
   * Write data to the terminal.
   *
   * @param {string|!Uint8Array} data string for UTF-16 data, Uint8Array for
   *     UTF-8 data
   * @param {function()=} callback Optional callback that fires when the data
   *     was processed by the parser.
   */
  write(data, callback) {
    this.term.write(data, callback);
  }

  /**
   * Like `this.write()` but also write a line break.
   *
   * @param {string|!Uint8Array} data
   * @param {function()=} callback Optional callback that fires when the data
   *     was processed by the parser.
   */
  writeln(data, callback) {
    this.term.writeln(data, callback);
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
    elem.style.backgroundSize = '100% 100%';

    (async () => {
      await this.prefs_.readStorage();
      // This will trigger all the observers to set the terminal options before
      // we call `this.term.open()`.
      this.prefs_.notifyAll();

      const screenPaddingSize = /** @type {number} */(
          this.prefs_.get('screen-padding-size'));
      elem.style.paddingTop = elem.style.paddingLeft = `${screenPaddingSize}px`;

      this.setBackgroundImage(
          this.backgroundImageWatcher_.getBackgroundImage());
      this.backgroundImageWatcher_.watch();

      this.inited_ = true;
      this.term.open(elem);
      this.xtermInternal_.addDimensionsObserver(() => this.scheduleFit_());

      this.reloadRenderAddon_();
      this.term.focus();
      (new ResizeObserver(() => this.scheduleFit_())).observe(elem);
      this.htermA11yReader_ = new hterm.AccessibilityReader(elem);
      this.notificationCenter_ = new hterm.NotificationCenter(document.body,
          this.htermA11yReader_);

      elem.appendChild(this.contextMenu_);
      elem.appendChild(this.findBar_);

      this.findBar_.addEventListener('find-bar',
          (e) => this.onFindBarEvent_(e));

      elem.addEventListener('dragover', (e) => e.preventDefault());
      elem.addEventListener('drop',
          (e) => this.onDrop_(/** @type {!DragEvent} */(e)));

      // Block the default context menu from popping up.
      elem.addEventListener('contextmenu', (e) => e.preventDefault());

      // Add a handler for pasting with the mouse.
      elem.addEventListener('mousedown',
          (e) => this.onMouseDown_(/** @type {!MouseEvent} */(e)));

      await this.scheduleFit_();
      this.a11yButtons_ = new A11yButtons(this.term, this.htermA11yReader_);
      if (!this.prefs_.get('scrollbar-visible')) {
        this.xtermInternal_.setScrollbarVisible(false);
      }

      this.installA11yKeyPressHandler_();

      this.onTerminalReady();
    })();
  }

  /** @override */
  showOverlay(msg, timeout = 1500) {
    this.notificationCenter_?.show(msg, {timeout});
  }

  /** @override */
  hideOverlay() {
    this.notificationCenter_?.hide();
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
    this.prefs_.setProfile(profileId).then(callback);
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
      this.term.options.fontSize = v;
      setHtermCSSVariable('font-size', `${v}px`);
    });

    this.prefs_.addObservers(null, {
      'audible-bell-sound': (v) => {
        this.bell_.playAudio = !!v;
      },
      'desktop-notification-bell': (v) => {
        this.bell_.showNotification = v;
      },
      'background-color': (v) => {
        this.updateBackgroundColor_(v);
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
      'cursor-blink': (v) => {
        this.term.options.cursorBlink = v;
      },
      'cursor-color': (v) => this.updateTheme_({cursor: v}),
      'cursor-shape': (v) => {
        let shape;
        if (v === 'BEAM') {
          shape = 'bar';
        } else {
          shape = v.toLowerCase();
        }
        this.term.options.cursorStyle = shape;
      },
      'font-family': (v) => this.updateFont_(v),
      'foreground-color': (v) => {
        this.updateTheme_({foreground: v});
        setHtermColorCSSVariable('foreground-color', v);
      },
      'line-height': (v) => {
        this.term.options.lineHeight = v;
      },
      'scrollback-limit': (v) => {
        if (typeof v !== 'number' || v < 0) {
          // xterm.js does not have an "unlimited" option, so we just use a
          // large number here.
          v = 10000000;
        }
        this.term.options.scrollback = v;
      },
      'scroll-on-keystroke': (v) => {
        this.term.options.scrollOnUserInput = v;
      },
      'scroll-on-output': (v) => {
        if (!v) {
          this.scrollOnOutputListener_?.dispose();
          this.scrollOnOutputListener_ = null;
          return;
        }
        if (!this.scrollOnOutputListener_) {
          this.scrollOnOutputListener_ = this.term.onWriteParsed(
              () => this.term.scrollToBottom());
        }
      },
      'scrollbar-visible': (v) => {
        this.xtermInternal_.setScrollbarVisible(v);
      },
      'user-css': (v) => {
        if (this.userCSSElement_) {
          this.userCSSElement_.remove();
        }
        if (v) {
          this.userCSSElement_ = document.createElement('link');
          this.userCSSElement_.setAttribute('rel', 'stylesheet');
          this.userCSSElement_.setAttribute('href', v);
          document.head.appendChild(this.userCSSElement_);
        }
      },
      'user-css-text': (v) => {
        if (!this.userCSSTextElement_) {
          this.userCSSTextElement_ = document.createElement('style');
          document.head.appendChild(this.userCSSTextElement_);
        }
        this.userCSSTextElement_.textContent = v;
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

    const cellDimensions = this.xtermInternal_.getActualCellDimensions();
    const cols = calc(this.container_.offsetWidth, cellDimensions.width);
    const rows = calc(this.container_.offsetHeight, cellDimensions.height);
    if (cols >= 0 && rows >= 0) {
      this.term.resize(cols, rows);
    }
  }

  reloadRenderAddon_() {
    if (this.renderAddon_) {
      this.renderAddon_.dispose();
    }
    this.renderAddon_ = new this.renderAddonType_();
    this.term.loadAddon(this.renderAddon_);
  }

  /**
   * Update the background color. This will also adjust the transparency based
   * on whether there is a background image.
   *
   * @param {string} color
   */
  updateBackgroundColor_(color) {
    const hasBackgroundImage = this.hasBackgroundImage();

    // We only set allowTransparency when it is necessary becuase 1) xterm.js
    // documentation states that allowTransparency can affect performance; 2) I
    // find that the rendering is better with allowTransparency being false.
    // This could be a bug with xterm.js.
    if (!!this.term.options.allowTransparency !== hasBackgroundImage) {
      this.term.options.allowTransparency = hasBackgroundImage;
      if (this.inited_) {
        // Setting allowTransparency in the middle messes up rendering, so we
        // need to reload it here.
        this.reloadRenderAddon_();
      }
    }

    if (this.hasBackgroundImage()) {
      const css = lib.notNull(lib.colors.normalizeCSS(color));
      const rgb = lib.colors.crackRGB(css).slice(0, 3).join(',');
      // Note that we still want to set the RGB part correctly even though it is
      // completely transparent. This is because the background color without
      // the alpha channel is used in reverse video mode.
      color = `rgba(${rgb}, 0)`;
    }

    this.updateTheme_({background: color});
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

  /**
   * @param {!DragEvent} e
   */
  onDrop_(e) {
    e.preventDefault();

    // If the shift key active, try to find a "rich" text source (but not plain
    // text).  e.g. text/html is OK. This is the same behavior as hterm.
    if (e.shiftKey) {
      for (const type of e.dataTransfer.types) {
        if (type !== 'text/plain' && type.startsWith('text/')) {
          this.term.paste(e.dataTransfer.getData(type));
          return;
        }
      }
    }

    this.term.paste(e.dataTransfer.getData('text/plain'));
  }

  /**
   * @param {!MouseEvent} e
   */
  onMouseDown_(e) {
    if (this.term.modes.mouseTrackingMode !== 'none') {
      // xterm.js is in mouse mode and will handle the event.
      return;
    }
    const MIDDLE = 1;
    const RIGHT = 2;

    if (e.button === RIGHT && e.ctrlKey) {
      this.contextMenu_.show({x: e.clientX, y: e.clientY});
      return;
    }

    if (e.button === MIDDLE || (e.button === RIGHT &&
          this.prefs_.getBoolean('mouse-right-click-paste'))) {
      this.pasteFromClipboard_();
    }
  }

  onFindBarEvent_(e) {
    switch (e.detail.type) {
      case 'find':
        {
          const value = e.target.value;
          if (!value) {
            break;
          }
          this.searchInProgress_ = true;
          // The selection is the starting point of the search. If there is no
          // current selection, we will try to select something so that the
          // search starts from the current viewport.
          if (!this.term.hasSelection()) {
            this.selectCloestOffScreenChar_(!e.detail.backward);
          }

          if (e.detail.backward) {
            this.searchAddon_.findPrevious(value, SEARCH_OPTIONS);
          } else {
            this.searchAddon_.findNext(value, SEARCH_OPTIONS);
          }
        }
        break;
      case 'close':
        this.term.clearSelection();
        this.searchAddon_.clearDecorations();
        this.term.focus();
        break;
    }
  }

  /**
   * If `top` is true, select the last character on the row right above the top
   * of the viewport. Otherwise, select the first character on the row right
   * below the bottom of the viewport.
   *
   * @param {boolean} top
   * @return {boolean} return false if we cannot select the character because
   *     the row does not exist.
   */
  selectCloestOffScreenChar_(top) {
    // viewportY is the row number of the top of the viewport.
    const {viewportY, length} = this.term.buffer.active;
    if (top) {
      if (viewportY > 0) {
        this.term.select(this.term.cols - 1, viewportY - 1, 1);
        return true;
      }
    } else {
      const row = viewportY + this.term.rows;
      if (row < length) {
        this.term.select(0, row, 1);
        return true;
      }
    }
    return false;
  }

  async pasteFromClipboard_() {
    const text = await navigator.clipboard?.readText?.();
    if (text) {
      this.term.paste(text);
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

    if (this.prefs_.get('enable-clipboard-notice')) {
      if (!this.copyNotice_) {
        this.copyNotice_ = document.createElement('terminal-copy-notice');
      }
      setTimeout(() => this.showOverlay(lib.notNull(this.copyNotice_), 500),
          200);
    }
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
  }

  /**
   * @param {!KeyboardEvent} ev
   * @return {boolean} Return true if the key event is handled.
   */
  handleKeyEvent_(ev) {
    // Without this, <alt-tab> (or <alt-shift-tab) is consumed by xterm.js
    // (instead of the OS) when terminal is full screen.
    if (ev.altKey && ev.keyCode === 9) {
      return true;
    }

    const modifiers = (ev.shiftKey ? Modifier.Shift : 0) |
        (ev.altKey ? Modifier.Alt : 0) |
        (ev.ctrlKey ? Modifier.Ctrl : 0) |
        (ev.metaKey ? Modifier.Meta : 0);

    if (this.handleArrowAndSixPackKeys_(ev, modifiers)) {
      ev.preventDefault();
      ev.stopPropagation();
      return true;
    }

    if (this.handleHtermKeyBindings_(ev)) {
      return true;
    }

    const handler = this.keyDownHandlers_.get(
        encodeKeyCombo(modifiers, ev.keyCode));
    if (handler) {
      if (ev.type === 'keydown') {
        handler(ev);
      }
      return true;
    }

    return false;
  }

  /**
   * @param {!KeyboardEvent} ev
   * @return {boolean} Return true if the key event is handled.
   */
  handleHtermKeyBindings_(ev) {
    // The logic here is a simplified version of
    // hterm.Keyboard.prototype.onKeyDown_;
    const htermKeyDown = {
      keyCode: ev.keyCode,
      shift: ev.shiftKey,
      ctrl: ev.ctrlKey,
      alt: ev.altKey,
      meta: ev.metaKey,
    };
    const htermBinding = this.htermKeyBindings_.getBinding(htermKeyDown);

    if (!htermBinding) {
      return false;
    }

    // If there is a handler but the event is not keydown (e.g. keypress,
    // keyup), we just do nothing.
    if (ev.type !== 'keydown') {
      ev.preventDefault();
      ev.stopPropagation();
      return true;
    }

    let action;
    if (typeof htermBinding.action === 'function') {
      action = htermBinding.action.call(this.keyboard, this, htermKeyDown);
    } else {
      action = htermBinding.action;
    }

    const KeyActions = hterm.Keyboard.KeyActions;
    switch (action) {
      case KeyActions.DEFAULT:
        return false;
      case KeyActions.PASS:
        return true;
      default:
        console.warn(`KeyAction ${action} is not supported`);
        // Fall through.
      case KeyActions.CANCEL:
        ev.preventDefault();
        ev.stopPropagation();
        return true;
    }
  }

  /**
   * Handle arrow keys and the "six pack keys" (e.g. home, insert...) because
   * xterm.js does not always handle them correctly with modifier keys.
   *
   * The behavior here is mostly the same as hterm, but there are some
   * differences. For example, we send a code instead of scrolling the screen
   * with shift+up/down to follow the behavior of xterm and other popular
   * terminals (e.g. gnome-terminal).
   *
   * We don't use `this.keyDownHandlers_` for this because it needs one entry
   * per modifier combination.
   *
   * @param {!KeyboardEvent} ev
   * @param {number} modifiers
   * @return {boolean} Return true if the key event is handled.
   */
  handleArrowAndSixPackKeys_(ev, modifiers) {
    let code = ARROW_AND_SIX_PACK_KEYS.get(ev.keyCode);
    if (!code) {
      return false;
    }

    // For this case, we need to consider the "application cursor mode". We will
    // just let xterm.js handle it.
    if (modifiers === 0) {
      return false;
    }

    if (ev.type !== 'keydown') {
      // Do nothing for non-keydown event, and also don't let xterm.js handle
      // it.
      return true;
    }

    // Special handling if only shift is depressed.
    if (modifiers === Modifier.Shift) {
      switch (ev.keyCode) {
        case keyCodes.INSERT:
          this.pasteFromClipboard_();
          return true;
        case keyCodes.PAGE_UP:
          this.term.scrollPages(-1);
          return true;
        case keyCodes.PAGE_DOWN:
          this.term.scrollPages(1);
          return true;
        case keyCodes.HOME:
          this.term.scrollToTop();
          return true;
        case keyCodes.END:
          this.term.scrollToBottom();
          return true;
      }
    }

    const mod = `;${modifiers + 1}`;
    if (code.length === 3) {
      // Convert code from "CSI x" to "CSI 1 mod x";
      code = '\x1b[1' + mod + code[2];
    } else {
      // Convert code from "CSI ... ~" to "CSI ... mod ~";
      code = code.slice(0, -1) + mod + '~';
    }
    this.io.onVTKeystroke(code);
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

    this.term.options.fontSize = Math.max(1, newFontSize);
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

    /** @param {!KeyboardEvent} ev */
    const newTab = (ev) => {
      ev.preventDefault();
      chrome.terminalPrivate.openWindow(
          {asTab: true, url: '/html/terminal.html'});
    };
    set(Modifier.Ctrl | Modifier.Shift, keyCodes.T, newTab);
    if (this.prefs_.get('pass-ctrl-t')) {
      set(Modifier.Ctrl, keyCodes.T, newTab);
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

    set(Modifier.Ctrl | Modifier.Shift, keyCodes.F, () => this.findBar_.show());

    // ctrl+alt+. for switching between logged-in users.
    set(Modifier.Ctrl | Modifier.Alt, 190, noop);
  }

  handleOnTerminalReady() {}
}

class HtermTerminal extends hterm.Terminal {
  /** @override */
  decorate(div) {
    super.decorate(div);

    definePrefs(this.getPrefs());
  }

  /**
   * This needs to be called in the `onTerminalReady()` callback. This is
   * awkward, but it is temporary since we will drop support for hterm at some
   * point.
   */
  handleOnTerminalReady() {
    this.addBindings_();

    const fontManager = new FontManager(this.getDocument());
    const prefs = this.getPrefs();
    fontManager.loadFont(/** @type {string} */(prefs.get('font-family')));
    prefs.addObserver(
        'font-family',
        (v) => fontManager.loadFont(/** @type {string} */(v)));

    const backgroundImageWatcher = new BackgroundImageWatcher(this.getPrefs(),
        (image) => this.setBackgroundImage(image));
    this.setBackgroundImage(backgroundImageWatcher.getBackgroundImage());
    backgroundImageWatcher.watch();
  }

  /**
   * Write data to the terminal.
   *
   * @param {string|!Uint8Array} data string for UTF-16 data, Uint8Array for
   *     UTF-8 data
   * @param {function()=} callback Optional callback that fires when the data
   *     was processed by the parser.
   */
  write(data, callback) {
    if (typeof data === 'string') {
      this.io.print(data);
    } else {
      this.io.writeUTF8(data);
    }
    // Hterm processes the data synchronously, so we can call the callback
    // immediately.
    if (callback) {
      setTimeout(callback);
    }
  }

  /**
   * Adds bindings for terminal such as options page and some extra ChromeOS
   * system key bindings when 'keybindings-os-defaults' pref is set. Reloads
   * current bindings if needed.
   */
  addBindings_() {
    this.keyboard.keyMap.keyDefs[78].control = HtermTerminal.onCtrlN_;
    this.keyboard.keyMap.keyDefs[84].control = HtermTerminal.onCtrlT_;

    Object.assign(hterm.Keyboard.Bindings.OsDefaults['cros'], {
      // Dock window left/right.
      'Alt+BRACKET_LEFT': 'PASS',
      'Alt+BRACKET_RIGHT': 'PASS',
      // Maximize/minimize window.
      'Alt+EQUAL': 'PASS',
      'Alt+MINUS': 'PASS',
    });
    if (this.getPrefs().get('keybindings-os-defaults')) {
      this.keyboard.bindings.clear();
      this.keyboard.bindings.addBindings(
          /** @type {!Object} */ (this.getPrefs().get('keybindings') || {}),
          true);
    }

    this.keyboard.bindings.addBinding('Ctrl+Shift+P', () => {
      this.onOpenOptionsPage();
      return hterm.Keyboard.KeyActions.CANCEL;
    });
  }

  /**
   * Either send a ^N or open a new tabbed terminal window.
   *
   * @this {!hterm.Keyboard.KeyMap}
   * @param {!KeyboardEvent} e The event to process.
   * @param {!hterm.Keyboard.KeyDef} k
   * @return {!hterm.Keyboard.KeyDefFunction|string} Key action or sequence.
   */
  static onCtrlN_(e, k) {
    if (e.shiftKey || this.keyboard.terminal.passCtrlN) {
      return function(e, k) {
        chrome.terminalPrivate.openWindow();
        return hterm.Keyboard.KeyActions.CANCEL;
      };
    }

    return '\x0e';
  }

  /**
   * Either send a ^T or open a new tab in the current terminal window.
   *
   * @this {!hterm.Keyboard.KeyMap}
   * @param {!KeyboardEvent} e The event to process.
   * @param {!hterm.Keyboard.KeyDef} k
   * @return {!hterm.Keyboard.KeyDefFunction|string} Key action or sequence.
   */
  static onCtrlT_(e, k) {
    if (this.keyboard.terminal.passCtrlT) {
      return function(e, k) {
        chrome.terminalPrivate.openWindow(
            {asTab: true, url: '/html/terminal.html'});
        return hterm.Keyboard.KeyActions.CANCEL;
      };
    }

    return '\x14';
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
  let emulator_type = 'hterm';

  // TODO: remove the url param logic. This is temporary to make manual
  // testing a bit easier.
  if (ORIGINAL_URL.searchParams.get('emulator') !== 'hterm') {
    emulator_type = 'xterm.js';
  }
  console.log('Terminal emulator type: ', emulator_type);

  if (emulator_type === 'hterm') {
    return new HtermTerminal({profileId, storage});
  }

  return new XtermTerminal({
    storage,
    profileId,
  });
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
  connectedCallback() {
    super.connectedCallback();
    if (!this.childNodes.length) {
      // This is not visible since we use shadow dom. But this will allow the
      // hterm.NotificationCenter to announce the the copy text.
      this.append(hterm.messageManager.get('HTERM_NOTIFY_COPY'));
    }
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
