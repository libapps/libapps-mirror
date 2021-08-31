// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Keyboard handler.
 *
 * Consumes onKey* events and invokes onVTKeystroke on the associated
 * hterm.Terminal object.
 *
 * See also: [XTERM] as referenced in vt.js.
 *
 * @param {!hterm.Terminal} terminal The Terminal object associated with this
 *     keyboard.
 * @constructor
 */
hterm.Keyboard = function(terminal) {
  // The parent vt interpreter.
  this.terminal = terminal;

  // The element we're currently capturing keyboard events for.
  this.keyboardElement_ = null;

  // The event handlers we are interested in, and their bound callbacks, saved
  // so they can be uninstalled with removeEventListener, when required.
  this.handlers_ = [
      ['focusout', this.onFocusOut_.bind(this)],
      ['keydown', this.onKeyDown_.bind(this)],
      ['keypress', this.onKeyPress_.bind(this)],
      ['keyup', this.onKeyUp_.bind(this)],
      ['textInput', this.onTextInput_.bind(this)],
  ];

  /**
   * The current key map.
   */
  this.keyMap = new hterm.Keyboard.KeyMap(this);

  this.bindings = new hterm.Keyboard.Bindings();

  /**
   * none: Disable the AltGr emulation.
   * ctrl-alt: Assume Ctrl+Alt means AltGr.
   * left-alt: Assume left Alt means AltGr.
   * right-alt: Assume right Alt means AltGr.
   */
  this.altGrMode = 'none';

  /**
   * If true, Shift+Insert will fall through to the browser as a paste.
   * If false, the keystroke will be sent to the host.
   */
  this.shiftInsertPaste = true;

  /**
   * If true, home/end will control the terminal scrollbar and shift home/end
   * will send the VT keycodes.  If false then home/end sends VT codes and
   * shift home/end scrolls.
   */
  this.homeKeysScroll = false;

  /**
   * Same as above, except for page up/page down.
   */
  this.pageKeysScroll = false;

  /**
   * If true, Ctrl+Plus/Minus/Zero controls zoom.
   * If false, Ctrl+Shift+Plus/Minus/Zero controls zoom, Ctrl+Minus sends ^_,
   * Ctrl+Plus/Zero do nothing.
   */
  this.ctrlPlusMinusZeroZoom = true;

  /**
   * Ctrl+C copies if true, sends ^C to host if false.
   * Ctrl+Shift+C sends ^C to host if true, copies if false.
   */
  this.ctrlCCopy = false;

  /**
   * Ctrl+V pastes if true, sends ^V to host if false.
   * Ctrl+Shift+V sends ^V to host if true, pastes if false.
   */
  this.ctrlVPaste = false;

  /**
   * Enable/disable application keypad.
   *
   * This changes the way numeric keys are sent from the keyboard.
   */
  this.applicationKeypad = false;

  /**
   * Enable/disable the application cursor mode.
   *
   * This changes the way cursor keys are sent from the keyboard.
   */
  this.applicationCursor = false;

  /**
   * If true, the backspace should send BS ('\x08', aka ^H).  Otherwise
   * the backspace key should send '\x7f'.
   */
  this.backspaceSendsBackspace = false;

  /**
   * Set whether the meta key sends a leading escape or not.
   */
  this.metaSendsEscape = true;

  /**
   * Set whether meta-V gets passed to host.
   */
  this.passMetaV = true;

  /**
   * Controls how the alt key is handled.
   *
   *  escape....... Send an ESC prefix.
   *  8-bit........ Add 128 to the unshifted character as in xterm.
   *  browser-key.. Wait for the keypress event and see what the browser says.
   *                (This won't work well on platforms where the browser
   *                 performs a default action for some alt sequences.)
   *
   * This setting only matters when alt is distinct from meta (altIsMeta is
   * false.)
   */
  this.altSendsWhat = 'escape';

  /**
   * Set whether the alt key acts as a meta key, instead of producing 8-bit
   * characters.
   *
   * True to enable, false to disable, null to autodetect based on platform.
   */
  this.altIsMeta = false;

  /**
   * If true, tries to detect DEL key events that are from alt-backspace on
   * Chrome OS vs from a true DEL key press.
   *
   * Background: At the time of writing, on Chrome OS, alt-backspace is mapped
   * to DEL. Some users may be happy with this, but others may be frustrated
   * that it's impossible to do meta-backspace. If the user enables this pref,
   * we use a trick to tell a true DEL keypress from alt-backspace: on
   * alt-backspace, we will see the alt key go down, then get a DEL keystroke
   * that indicates that alt is not pressed. See https://crbug.com/174410 .
   */
  this.altBackspaceIsMetaBackspace = false;

  /**
   * Used to keep track of the current alt-key state, which is necessary for
   * the altBackspaceIsMetaBackspace preference above and for the altGrMode
   * preference.  This is a bitmap with where bit positions correspond to the
   * "location" property of the key event.
   */
  this.altKeyPressed = 0;

  /**
   * If true, Chrome OS media keys will be mapped to their F-key equivalent.
   * E.g. "Back" will be mapped to F1. If false, Chrome will handle the keys.
   */
  this.mediaKeysAreFKeys = false;

  /**
   * Holds the previous setting of altSendsWhat when DECSET 1039 is used. When
   * DECRST 1039 is used, altSendsWhat is changed back to this and this is
   * nulled out.
   */
  this.previousAltSendsWhat_ = null;
};

/**
 * Special handling for keyCodes in a keyboard layout.
 *
 * @enum {symbol}
 * @const
 */
hterm.Keyboard.KeyActions = {
  /**
   * Call preventDefault and stopPropagation for this key event and nothing
   * else.
   */
  CANCEL: Symbol('CANCEL'),

  /**
   * This performs the default terminal action for the key.  If used in the
   * 'normal' action and the the keystroke represents a printable key, the
   * character will be sent to the host.  If used in one of the modifier
   * actions, the terminal will perform the normal action after (possibly)
   * altering it.
   *
   *  - If the normal sequence starts with CSI, the sequence will be adjusted
   *    to include the modifier parameter as described in [XTERM] in the final
   *    table of the "PC-Style Function Keys" section.
   *
   *  - If the control key is down and the key represents a printable character,
   *    and the uppercase version of the unshifted keycap is between
   *    64 (ASCII '@') and 95 (ASCII '_'), then the uppercase version of the
   *    unshifted keycap minus 64 is sent.  This makes '^@' send '\x00' and
   *    '^_' send '\x1f'.  (Note that one higher that 0x1f is 0x20, which is
   *    the first printable ASCII value.)
   *
   *  - If the alt key is down and the key represents a printable character then
   *    the value of the character is shifted up by 128.
   *
   *  - If meta is down and configured to send an escape, '\x1b' will be sent
   *    before the normal action is performed.
   */
  DEFAULT: Symbol('DEFAULT'),

  /**
   * Causes the terminal to opt out of handling the key event, instead letting
   * the browser deal with it.
   */
  PASS: Symbol('PASS'),

  /**
   * Insert the first or second character of the keyCap, based on e.shiftKey.
   * The key will be handled in onKeyDown, and e.preventDefault() will be
   * called.
   *
   * It is useful for a modified key action, where it essentially strips the
   * modifier while preventing the browser from reacting to the key.
   */
  STRIP: Symbol('STRIP'),
};

/** @typedef {string|!hterm.Keyboard.KeyActions} */
hterm.Keyboard.KeyAction;

/**
 * Capture keyboard events sent to the associated element.
 *
 * This enables the keyboard.  Captured events are consumed by this class
 * and will not perform their default action or bubble to other elements.
 *
 * Passing a null element will uninstall the keyboard handlers.
 *
 * @param {?Element} element The element whose events should be captured, or
 *     null to disable the keyboard.
 */
hterm.Keyboard.prototype.installKeyboard = function(element) {
  if (element == this.keyboardElement_) {
    return;
  }

  if (element && this.keyboardElement_) {
    this.installKeyboard(null);
  }

  for (let i = 0; i < this.handlers_.length; i++) {
    const handler = this.handlers_[i];
    if (element) {
      element.addEventListener(handler[0], handler[1]);
    } else {
      this.keyboardElement_.removeEventListener(handler[0], handler[1]);
    }
  }

  this.keyboardElement_ = element;
};

/**
 * Disable keyboard event capture.
 *
 * This will allow the browser to process key events normally.
 */
hterm.Keyboard.prototype.uninstallKeyboard = function() {
  this.installKeyboard(null);
};

/**
 * Handle textInput events.
 *
 * These are generated when using IMEs, Virtual Keyboards (VKs), compose keys,
 * Unicode input, etc...
 *
 * @param {!InputEvent} e The event to process.
 */
hterm.Keyboard.prototype.onTextInput_ = function(e) {
  if (!e.data) {
    return;
  }

  // Just pass the generated buffer straight down.  No need for us to split it
  // up or otherwise parse it ahead of times.
  this.terminal.onVTKeystroke(e.data);
};

/**
 * Handle keypress events.
 *
 * TODO(vapier): Drop this event entirely and only use keydown.
 *
 * @param {!KeyboardEvent} e The event to process.
 */
hterm.Keyboard.prototype.onKeyPress_ = function(e) {
  // FF doesn't set keyCode reliably in keypress events.  Stick to the which
  // field here until we can move to keydown entirely.
  const key = String.fromCharCode(e.which).toLowerCase();
  if ((e.ctrlKey || e.metaKey) && (key == 'c' || key == 'v')) {
    // On FF the key press (not key down) event gets fired for copy/paste.
    // Let it fall through for the default browser behavior.
    return;
  }

  if (e.keyCode == 9 /* Tab */) {
    // On FF, a key press event will be fired in addition of key down for the
    // Tab key if key down isn't handled. This would only happen if a custom
    // PASS binding has been created and therefore this should be handled by the
    // browser.
    return;
  }

  /** @type {string} */
  let ch;
  if (e.altKey && this.altSendsWhat == 'browser-key' && e.charCode == 0) {
    // If we got here because we were expecting the browser to handle an
    // alt sequence but it didn't do it, then we might be on an OS without
    // an enabled IME system.  In that case we fall back to xterm-like
    // behavior.
    //
    // This happens here only as a fallback.  Typically these platforms should
    // set altSendsWhat to either 'escape' or '8-bit'.
    ch = String.fromCharCode(e.keyCode);
    if (!e.shiftKey) {
      ch = ch.toLowerCase();
    }

  } else if (e.charCode >= 32) {
    ch = String.fromCharCode(e.charCode);
  }

  if (ch) {
    this.terminal.onVTKeystroke(ch);
  }

  e.preventDefault();
  e.stopPropagation();
};

/**
 * Handle focusout events.
 *
 * @param {!FocusEvent} e The event to process.
 */
hterm.Keyboard.prototype.onFocusOut_ = function(e) {
  this.altKeyPressed = 0;
};

/**
 * Handle keyup events.
 *
 * @param {!KeyboardEvent} e The event to process.
 */
hterm.Keyboard.prototype.onKeyUp_ = function(e) {
  if (e.keyCode == 18) {
    this.altKeyPressed = this.altKeyPressed & ~(1 << (e.location - 1));
  }
};

/**
 * Handle keydown events.
 *
 * @param {!KeyboardEvent} e The event to process.
 */
hterm.Keyboard.prototype.onKeyDown_ = function(e) {
  if (e.keyCode == 18) {
    this.altKeyPressed = this.altKeyPressed | (1 << (e.location - 1));
  }

  let keyDef = this.keyMap.keyDefs[e.keyCode];
  if (!keyDef) {
    // If this key hasn't been explicitly registered, fall back to the unknown
    // key mapping (keyCode == 0), and then automatically register it to avoid
    // any further warnings here.
    console.warn(`No definition for key ${e.key} (keyCode ${e.keyCode})`);
    keyDef = this.keyMap.keyDefs[0];
    this.keyMap.addKeyDef(e.keyCode, keyDef);
  }

  // The type of action we're going to use: control, alt, meta, or normal.
  let resolvedActionType = null;

  /**
   * Get the default key definition action for the given modifier name.
   *
   * @param {string} name 'control', 'alt', 'meta', or 'normal'.
   * @return {!hterm.Keyboard.KeyDefAction}
   */
  const getKeyDefAction = (name) => {
    // Get the key action for the given action name.  If the action is a
    // function, dispatch it.  If the action defers to the normal action,
    // resolve that instead.

    resolvedActionType = name;

    let action = keyDef[name];
    if (typeof action == 'function') {
      action = action.call(this.keyMap, e, keyDef);
    }

    if (action === DEFAULT && name != 'normal') {
      action = getKeyDefAction('normal');
    }

    return action;
  };

  // Note that we use the triple-equals ('===') operator to test equality for
  // these constants, in order to distinguish usage of the constant from usage
  // of a literal string that happens to contain the same bytes.
  const CANCEL = hterm.Keyboard.KeyActions.CANCEL;
  const DEFAULT = hterm.Keyboard.KeyActions.DEFAULT;
  const PASS = hterm.Keyboard.KeyActions.PASS;
  const STRIP = hterm.Keyboard.KeyActions.STRIP;

  let control = e.ctrlKey;
  let shift = e.shiftKey;
  let alt = this.altIsMeta ? false : e.altKey;
  let meta = this.altIsMeta ? (e.altKey || e.metaKey) : e.metaKey;

  // In the key-map, we surround the keyCap for non-printables in "[...]"
  const isPrintable = !(/^\[\w+\]$/.test(keyDef.keyCap));

  switch (this.altGrMode) {
    case 'ctrl-alt':
    if (isPrintable && control && alt) {
      // ctrl-alt-printable means altGr.  We clear out the control and
      // alt modifiers and wait to see the charCode in the keydown event.
      control = false;
      alt = false;
    }
    break;

    case 'right-alt':
    if (isPrintable && (this.terminal.keyboard.altKeyPressed & 2)) {
      control = false;
      alt = false;
    }
    break;

    case 'left-alt':
    if (isPrintable && (this.terminal.keyboard.altKeyPressed & 1)) {
      control = false;
      alt = false;
    }
    break;
  }

  /** @type {!hterm.Keyboard.KeyDown} */
  const keyDown = {
    keyCode: e.keyCode,
    shift: e.shiftKey, // not `var shift` from above.
    ctrl: control,
    alt: alt,
    meta: meta,
  };

  /** @type {?hterm.Keyboard.KeyDefAction} */
  let action;

  // Allow user specified keybindings to override default keyDef.
  const binding = this.bindings.getBinding(keyDown);
  if (binding) {
    // Clear out the modifier bits so we don't try to munge the sequence
    // further.
    shift = control = alt = meta = false;
    resolvedActionType = 'normal';

    if (typeof binding.action == 'function') {
      const bindingFn =
          /** @type {!hterm.Keyboard.KeyBindingFunction} */ (binding.action);
      action = bindingFn.call(this, this.terminal, keyDown);
    } else {
      action = /** @type {!hterm.Keyboard.KeyAction} */ (binding.action);
    }
  } else {
    // No user keybinding, so use default keyDef.
    if (control) {
      action = getKeyDefAction('control');
    } else if (alt) {
      action = getKeyDefAction('alt');
    } else if (meta) {
      action = getKeyDefAction('meta');
    } else {
      action = getKeyDefAction('normal');
    }

    // If e.maskShiftKey was set (during getKeyDefAction) it means the shift key
    // is already accounted for in the action, and we should not act on it any
    // further. This is currently only used for Ctrl+Shift+Tab, which should
    // send "CSI Z", not "CSI 1 ; 2 Z".
    shift = !e.maskShiftKey && e.shiftKey;
  }

  // Call keyDef function now that we have given bindings a chance to override.
  if (typeof action == 'function') {
    action = action.call(this.keyMap, e, keyDef);
  }

  if (alt && this.altSendsWhat == 'browser-key' && action == DEFAULT) {
    // When altSendsWhat is 'browser-key', we wait for the keypress event.
    // In keypress, the browser should have set the event.charCode to the
    // appropriate character.
    // TODO(rginda): Character compositions will need some black magic.
    action = PASS;
  }

  // If we are going to handle the key, we most likely want to hide the context
  // menu before doing so.  This way we hide it when pressing a printable key,
  // or navigate (arrow keys/etc...), or press Escape.  But we don't want to
  // hide it when only pressing modifiers like Alt/Ctrl/Meta because those might
  // be used by the OS & hterm to show the context menu in the first place.  The
  // bare modifier keys are all marked as PASS.
  if (action !== PASS) {
    this.terminal.contextMenu.hide();
  }

  if (action === PASS || (action === DEFAULT && !(control || alt || meta))) {
    // If this key is supposed to be handled by the browser, or it is an
    // unmodified key with the default action, then exit this event handler.
    // If it's an unmodified key, it'll be handled in onKeyPress where we
    // can tell for sure which ASCII code to insert.
    //
    // This block needs to come before the STRIP test, otherwise we'll strip
    // the modifier and think it's ok to let the browser handle the keypress.
    // The browser won't know we're trying to ignore the modifiers and might
    // perform some default action.
    return;
  }

  if (action === STRIP) {
    alt = control = false;
    action = keyDef.normal;
    if (typeof action == 'function') {
      action = action.call(this.keyMap, e, keyDef);
    }

    if (action == DEFAULT && keyDef.keyCap.length == 2) {
      action = keyDef.keyCap.substr((shift ? 1 : 0), 1);
    }
  }

  e.preventDefault();
  e.stopPropagation();

  if (action === CANCEL) {
    return;
  }

  if (action !== DEFAULT && typeof action != 'string') {
    console.warn('Invalid action: ' + JSON.stringify(action));
    return;
  }

  // Strip the modifier that is associated with the action, since we assume that
  // modifier has already been accounted for in the action.
  if (resolvedActionType == 'control') {
    control = false;
  } else if (resolvedActionType == 'alt') {
    alt = false;
  } else if (resolvedActionType == 'meta') {
    meta = false;
  }

  if (typeof action == 'string' && action.substr(0, 2) == '\x1b[' &&
      (alt || control || shift || meta)) {
    // The action is an escape sequence that and it was triggered in the
    // presence of a keyboard modifier, we may need to alter the action to
    // include the modifier before sending it.

    // The math is funky but aligns w/xterm.
    let imod = 1;
    if (shift) {
      imod += 1;
    }
    if (alt) {
      imod += 2;
    }
    if (control) {
      imod += 4;
    }
    if (meta) {
      imod += 8;
    }
    const mod = ';' + imod;

    if (action.length == 3) {
      // Some of the CSI sequences have zero parameters unless modified.
      action = '\x1b[1' + mod + action.substr(2, 1);
    } else {
      // Others always have at least one parameter.
      action = action.substr(0, action.length - 1) + mod +
          action.substr(action.length - 1);
    }

  } else {
    if (action === DEFAULT) {
      action = keyDef.keyCap.substr((shift ? 1 : 0), 1);

      if (control) {
        const unshifted = keyDef.keyCap.substr(0, 1);
        const code = unshifted.charCodeAt(0);
        if (code >= 64 && code <= 95) {
          action = String.fromCharCode(code - 64);
        }
      }
    }

    if (alt && this.altSendsWhat == '8-bit' && action.length == 1) {
      const code = action.charCodeAt(0) + 128;
      action = String.fromCharCode(code);
    }

    // We respect alt/metaSendsEscape even if the keymap action was a literal
    // string.  Otherwise, every overridden alt/meta action would have to
    // check alt/metaSendsEscape.
    if ((alt && this.altSendsWhat == 'escape') ||
        (meta && this.metaSendsEscape)) {
      action = '\x1b' + action;
    }
  }

  this.terminal.onVTKeystroke(/** @type {string} */ (action));
};
