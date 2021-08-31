// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Constructor for the VT escape sequence interpreter.
 *
 * The interpreter operates on a terminal object capable of performing cursor
 * move operations, painting characters, etc.
 *
 * This interpreter is intended to be compatible with xterm, though it
 * ignores some of the more esoteric escape sequences.
 *
 * Control sequences are documented in hterm/doc/ControlSequences.md.
 *
 * @param {!hterm.Terminal} terminal Terminal to use with the interpreter.
 * @constructor
 */
hterm.VT = function(terminal) {
  /**
   * The display terminal object associated with this virtual terminal.
   */
  this.terminal = terminal;

  terminal.onMouse = this.onTerminalMouse_.bind(this);
  this.mouseReport = this.MOUSE_REPORT_DISABLED;
  this.mouseCoordinates = this.MOUSE_COORDINATES_X10;

  // We only want to report mouse moves between cells, not between pixels.
  this.lastMouseDragResponse_ = null;

  // Parse state left over from the last parse.  You should use the parseState
  // instance passed into your parse routine, rather than reading
  // this.parseState_ directly.
  this.parseState_ = new hterm.VT.ParseState(this.parseUnknown_);

  // Any "leading modifiers" for the escape sequence, such as '?', ' ', or the
  // other modifiers handled in this.parseCSI_.
  this.leadingModifier_ = '';

  // Any "trailing modifiers".  Same character set as a leading modifier,
  // except these are found after the numeric arguments.
  this.trailingModifier_ = '';

  // Whether or not to respect the escape codes for setting terminal width.
  this.allowColumnWidthChanges_ = false;

  // The amount of time we're willing to wait for the end of an OSC sequence.
  this.oscTimeLimit_ = 20000;

  /**
   * Whether to accept the 8-bit control characters.
   *
   * An 8-bit control character is one with the eighth bit set.  These
   * didn't work on 7-bit terminals so they all have two byte equivalents.
   * Most hosts still only use the two-byte versions.
   *
   * We ignore 8-bit control codes by default.  This is in order to avoid
   * issues with "accidental" usage of codes that need to be terminated.
   * The "accident" usually involves cat'ing binary data.
   */
  this.enable8BitControl = false;

  /**
   * Whether to allow the OSC 52 sequence to write to the system clipboard.
   */
  this.enableClipboardWrite = true;

  /**
   * Respect the host's attempt to change the cursor blink status using
   * the DEC Private mode 12.
   */
  this.enableDec12 = false;

  /**
   * Respect the host's attempt to clear the scrollback buffer using CSI-J-3.
   */
  this.enableCsiJ3 = true;

  /**
   * If true, emit warnings when we encounter a control character or escape
   * sequence that we don't recognize or explicitly ignore.
   *
   * We disable this by default as the console logging can be expensive when
   * dumping binary files (e.g. `cat /dev/zero`) to the point where you can't
   * recover w/out restarting.
   */
  this.warnUnimplemented = false;

  /**
   * The set of available character maps (used by G0...G3 below).
   */
  this.characterMaps = new hterm.VT.CharacterMaps();

  /**
   * The default G0...G3 character maps.
   * We default to the US/ASCII map everywhere as that aligns with other
   * terminals, and it makes it harder to accidentally switch to the graphics
   * character map (Ctrl+N).  Any program that wants to use the graphics map
   * will usually select it anyways since there's no guarantee what state any
   * of the maps are in at any particular time.
   */
  this.G0 = this.G1 = this.G2 = this.G3 =
      this.characterMaps.getMap('B');

  /**
   * The 7-bit visible character set.
   *
   * This is a mapping from inbound data to display glyph.  The GL set
   * contains the 94 bytes from 0x21 to 0x7e.
   *
   * The default GL set is 'B', US ASCII.
   */
  this.GL = 'G0';

  /**
   * The 8-bit visible character set.
   *
   * This is a mapping from inbound data to display glyph.  The GR set
   * contains the 94 bytes from 0xa1 to 0xfe.
   */
  this.GR = 'G0';

  /**
   * The current encoding of the terminal.
   *
   * We only support ECMA-35 and UTF-8, so go with a boolean here.
   * The encoding can be locked too.
   */
  this.codingSystemUtf8_ = false;
  this.codingSystemLocked_ = false;

  // Construct a regular expression to match the known one-byte control chars.
  // This is used in parseUnknown_ to quickly scan a string for the next
  // control character.
  this.cc1Pattern_ = null;
  this.updateEncodingState_();
};

/**
 * No mouse events.
 */
hterm.VT.prototype.MOUSE_REPORT_DISABLED = 0;

/**
 * DECSET mode 9.
 *
 * Report mouse down events only.
 */
hterm.VT.prototype.MOUSE_REPORT_PRESS = 1;

/**
 * DECSET mode 1000.
 *
 * Report mouse down/up events only.
 */
hterm.VT.prototype.MOUSE_REPORT_CLICK = 2;

/**
 * DECSET mode 1002.
 *
 * Report mouse down/up and movement while a button is down.
 */
hterm.VT.prototype.MOUSE_REPORT_DRAG = 3;

/**
 * DEC mode for X10 coorindates (the default).
 */
hterm.VT.prototype.MOUSE_COORDINATES_X10 = 0;

/**
 * DEC mode 1005 for UTF-8 coorindates.
 */
hterm.VT.prototype.MOUSE_COORDINATES_UTF8 = 1;

/**
 * DEC mode 1006 for SGR coorindates.
 */
hterm.VT.prototype.MOUSE_COORDINATES_SGR = 2;

/**
 * ParseState constructor.
 *
 * This object tracks the current state of the parse.  It has fields for the
 * current buffer, position in the buffer, and the parse function.
 *
 * @param {function(!hterm.VT.ParseState)=} defaultFunction The default parser
 *     function.
 * @param {?string=} buf Optional string to use as the current buffer.
 * @constructor
 */
hterm.VT.ParseState = function(defaultFunction, buf = null) {
  this.defaultFunction = defaultFunction;
  this.buf = buf;
  this.pos = 0;
  this.func = defaultFunction;
  this.args = [];
  // Whether any of the arguments in the args array have subarguments.
  // e.g. All CSI sequences are integer arguments separated by semi-colons,
  // so subarguments are further colon separated.
  this.subargs = null;
};

/**
 * Reset the parser function, buffer, and position.
 *
 * @param {string=} buf Optional string to use as the current buffer.
 */
hterm.VT.ParseState.prototype.reset = function(buf = '') {
  this.resetParseFunction();
  this.resetBuf(buf);
  this.resetArguments();
};

/**
 * Reset the parser function only.
 */
hterm.VT.ParseState.prototype.resetParseFunction = function() {
  this.func = this.defaultFunction;
};

/**
 * Reset the buffer and position only.
 *
 * @param {?string=} buf Optional new value for buf, defaults to null.
 */
hterm.VT.ParseState.prototype.resetBuf = function(buf = null) {
  this.buf = buf;
  this.pos = 0;
};

/**
 * Reset the arguments list only.
 *
 * Typically we reset arguments before parsing a sequence that uses them rather
 * than always trying to make sure they're in a good state.  This can lead to
 * confusion during debugging where args from a previous sequence appear to be
 * "sticking around" in other sequences (which in reality don't use args).
 *
 * @param {string=} arg_zero Optional initial value for args[0].
 */
hterm.VT.ParseState.prototype.resetArguments = function(arg_zero = undefined) {
  this.args.length = 0;
  if (arg_zero !== undefined) {
    this.args[0] = arg_zero;
  }
};

/**
 * Parse an argument as an integer.
 *
 * This assumes the inputs are already in the proper format.  e.g. This won't
 * handle non-numeric arguments.
 *
 * An "0" argument is treated the same as "" which means the default value will
 * be applied.  This is what most terminal sequences expect.
 *
 * @param {string} argstr The argument to parse directly.
 * @param {number=} defaultValue Default value if argstr is empty.
 * @return {number} The parsed value.
 */
hterm.VT.ParseState.prototype.parseInt = function(argstr, defaultValue) {
  if (defaultValue === undefined) {
    defaultValue = 0;
  }

  if (argstr) {
    const ret = parseInt(argstr, 10);
    // An argument of zero is treated as the default value.
    return ret == 0 ? defaultValue : ret;
  }
  return defaultValue;
};

/**
 * Get an argument as an integer.
 *
 * @param {number} argnum The argument number to retrieve.
 * @param {number=} defaultValue Default value if the argument is empty.
 * @return {number} The parsed value.
 */
hterm.VT.ParseState.prototype.iarg = function(argnum, defaultValue) {
  return this.parseInt(this.args[argnum], defaultValue);
};

/**
 * Check whether an argument has subarguments.
 *
 * @param {number} argnum The argument number to check.
 * @return {boolean} Whether the argument has subarguments.
 */
hterm.VT.ParseState.prototype.argHasSubargs = function(argnum) {
  return !!(this.subargs && this.subargs[argnum]);
};

/**
 * Mark an argument as having subarguments.
 *
 * @param {number} argnum The argument number that has subarguments.
 */
hterm.VT.ParseState.prototype.argSetSubargs = function(argnum) {
  if (this.subargs === null) {
    this.subargs = {};
  }
  this.subargs[argnum] = true;
};

/**
 * Advance the parse position.
 *
 * @param {number} count The number of bytes to advance.
 */
hterm.VT.ParseState.prototype.advance = function(count) {
  this.pos += count;
};

/**
 * Return the remaining portion of the buffer without affecting the parse
 * position.
 *
 * @return {string} The remaining portion of the buffer.
 */
hterm.VT.ParseState.prototype.peekRemainingBuf = function() {
  return this.buf.substr(this.pos);
};

/**
 * Return the next single character in the buffer without affecting the parse
 * position.
 *
 * @return {string} The next character in the buffer.
 */
hterm.VT.ParseState.prototype.peekChar = function() {
  return this.buf.substr(this.pos, 1);
};

/**
 * Return the next single character in the buffer and advance the parse
 * position one byte.
 *
 * @return {string} The next character in the buffer.
 */
hterm.VT.ParseState.prototype.consumeChar = function() {
  return this.buf.substr(this.pos++, 1);
};

/**
 * Return true if the buffer is empty, or the position is past the end.
 *
 * @return {boolean} Whether the buffer is empty, or the position is past the
 *     end.
 */
hterm.VT.ParseState.prototype.isComplete = function() {
  return this.buf == null || this.buf.length <= this.pos;
};

/**
 * Reset the VT back to baseline state.
 */
hterm.VT.prototype.reset = function() {
  this.G0 = this.G1 = this.G2 = this.G3 =
      this.characterMaps.getMap('B');

  this.GL = 'G0';
  this.GR = 'G0';

  this.mouseReport = this.MOUSE_REPORT_DISABLED;
  this.mouseCoordinates = this.MOUSE_COORDINATES_X10;
  this.lastMouseDragResponse_ = null;
};

/**
 * Handle terminal mouse events.
 *
 * See the "Mouse Tracking" section of [xterm].
 *
 * @param {!MouseEvent} e
 */
hterm.VT.prototype.onTerminalMouse_ = function(e) {
  // Short circuit a few events to avoid unnecessary processing.
  if (this.mouseReport == this.MOUSE_REPORT_DISABLED) {
    return;
  } else if (this.mouseReport != this.MOUSE_REPORT_DRAG &&
             e.type == 'mousemove') {
    return;
  }

  // Temporary storage for our response.
  let response;

  // Modifier key state.
  let mod = 0;
  if (this.mouseReport != this.MOUSE_REPORT_PRESS) {
    if (e.shiftKey) {
      mod |= 4;
    }
    if (e.metaKey || (this.terminal.keyboard.altIsMeta && e.altKey)) {
      mod |= 8;
    }
    if (e.ctrlKey) {
      mod |= 16;
    }
  }

  // X & Y coordinate reporting.
  let x;
  let y;
  // Normally X10 has a limit of 255, but since we only want to emit UTF-8 valid
  // streams, we limit ourselves to 127 to avoid setting the 8th bit.  If we do
  // re-enable this, we should re-enable the hterm_vt_tests.js too.
  let limit = 127;
  switch (this.mouseCoordinates) {
    case this.MOUSE_COORDINATES_UTF8:
      // UTF-8 mode is the same as X10 but with higher limits.
      limit = 2047;
    case this.MOUSE_COORDINATES_X10:
      // X10 reports coordinates by encoding into strings.
      x = String.fromCharCode(lib.f.clamp(e.terminalColumn + 32, 32, limit));
      y = String.fromCharCode(lib.f.clamp(e.terminalRow + 32, 32, limit));
      break;
    case this.MOUSE_COORDINATES_SGR:
      // SGR reports coordinates by transmitting the numbers directly.
      x = e.terminalColumn;
      y = e.terminalRow;
      break;
  }

  let b;
  switch (e.type) {
    case 'wheel':
      // Mouse wheel is treated as button 1 or 2 plus an additional 64.
      b = (((e.deltaY * -1) > 0) ? 0 : 1) + 64;
      b |= mod;
      if (this.mouseCoordinates == this.MOUSE_COORDINATES_SGR) {
        response = `\x1b[<${b};${x};${y}M`;
      } else {
        // X10 based modes (including UTF8) add 32 for legacy encoding reasons.
        response = '\x1b[M' + String.fromCharCode(b + 32) + x + y;
      }

      // Keep the terminal from scrolling.
      e.preventDefault();
      break;

    case 'mousedown':
      // Buttons are encoded as button number.
      b = Math.min(e.button, 2);
      // X10 based modes (including UTF8) add 32 for legacy encoding reasons.
      if (this.mouseCoordinates != this.MOUSE_COORDINATES_SGR) {
        b += 32;
      }

      // And mix in the modifier keys.
      b |= mod;

      if (this.mouseCoordinates == this.MOUSE_COORDINATES_SGR) {
        response = `\x1b[<${b};${x};${y}M`;
      } else {
        response = '\x1b[M' + String.fromCharCode(b) + x + y;
      }
      break;

    case 'mouseup':
      if (this.mouseReport != this.MOUSE_REPORT_PRESS) {
        if (this.mouseCoordinates == this.MOUSE_COORDINATES_SGR) {
          // SGR mode can report the released button.
          response = `\x1b[<${e.button};${x};${y}m`;
        } else {
          // X10 mode has no indication of which button was released.
          response = '\x1b[M\x23' + x + y;
        }
      }
      break;

    case 'mousemove':
      if (this.mouseReport == this.MOUSE_REPORT_DRAG && e.buttons) {
        // Standard button bits.  The XTerm protocol only reports the first
        // button press (e.g. if left & right are pressed, right is ignored),
        // and it only supports the first three buttons.  If none of them are
        // pressed, then XTerm flags it as a release.  We'll do the same.
        // X10 based modes (including UTF8) add 32 for legacy encoding reasons.
        b = this.mouseCoordinates == this.MOUSE_COORDINATES_SGR ? 0 : 32;

        // Priority here matches XTerm: left, middle, right.
        if (e.buttons & 0x1) {
          // Report left button.
          b += 0;
        } else if (e.buttons & 0x4) {
          // Report middle button.
          b += 1;
        } else if (e.buttons & 0x2) {
          // Report right button.
          b += 2;
        } else {
          // Release higher buttons.
          b += 3;
        }

        // Add 32 to indicate mouse motion.
        b += 32;

        // And mix in the modifier keys.
        b |= mod;

        if (this.mouseCoordinates == this.MOUSE_COORDINATES_SGR) {
          response = `\x1b[<${b};${x};${y}M`;
        } else {
          response = '\x1b[M' + String.fromCharCode(b) + x + y;
        }

        // If we were going to report the same cell because we moved pixels
        // within, suppress the report.  This is what xterm does and cuts
        // down on duplicate messages.
        if (this.lastMouseDragResponse_ == response) {
          response = '';
        } else {
          this.lastMouseDragResponse_ = response;
        }
      }

      break;

    case 'click':
    case 'dblclick':
      break;

    default:
      console.error('Unknown mouse event: ' + e.type, e);
      break;
  }

  if (response) {
    this.terminal.io.sendString(response);
  }
};

/**
 * Interpret a string of characters, displaying the results on the associated
 * terminal object.
 *
 * @param {string} buf The buffer to interpret.
 */
hterm.VT.prototype.interpret = function(buf) {
  this.parseState_.resetBuf(buf);

  while (!this.parseState_.isComplete()) {
    const func = this.parseState_.func;
    const pos = this.parseState_.pos;
    const buf = this.parseState_.buf;

    this.parseState_.func.call(this, this.parseState_);

    if (this.parseState_.func == func && this.parseState_.pos == pos &&
        this.parseState_.buf == buf) {
      throw new Error('Parser did not alter the state!');
    }
  }
};

/**
 * Set the encoding of the terminal.
 *
 * @param {string} encoding The name of the encoding to set.
 */
hterm.VT.prototype.setEncoding = function(encoding) {
  switch (encoding) {
    default:
      console.warn('Invalid value for "terminal-encoding": ' + encoding);
      // Fall through.
    case 'iso-2022':
      this.codingSystemUtf8_ = false;
      this.codingSystemLocked_ = false;
      break;
    case 'utf-8-locked':
      this.codingSystemUtf8_ = true;
      this.codingSystemLocked_ = true;
      break;
    case 'utf-8':
      this.codingSystemUtf8_ = true;
      this.codingSystemLocked_ = false;
      break;
  }

  this.updateEncodingState_();
};

/**
 * Refresh internal state when the encoding changes.
 */
hterm.VT.prototype.updateEncodingState_ = function() {
  // If we're in UTF8 mode, don't suport 8-bit escape sequences as we'll never
  // see those -- everything should be UTF8!
  const cc1 = Object.keys(hterm.VT.CC1)
      .filter((e) => !this.codingSystemUtf8_ || e.charCodeAt() < 0x80)
      .map((e) => '\\x' + lib.f.zpad(e.charCodeAt().toString(16), 2))
      .join('');
  this.cc1Pattern_ = new RegExp(`[${cc1}]`);
};

/**
 * The default parse function.
 *
 * This will scan the string for the first 1-byte control character (C0/C1
 * characters from [CTRL]).  Any plain text coming before the code will be
 * printed to the terminal, then the control character will be dispatched.
 *
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.prototype.parseUnknown_ = function(parseState) {
  const print = (str) => {
    if (!this.codingSystemUtf8_ && this[this.GL].GL) {
      str = this[this.GL].GL(str);
    }

    this.terminal.print(str);
  };

  // Search for the next contiguous block of plain text.
  const buf = parseState.peekRemainingBuf();
  const nextControl = buf.search(this.cc1Pattern_);

  if (nextControl == 0) {
    // We've stumbled right into a control character.
    this.dispatch('CC1', buf.substr(0, 1), parseState);
    parseState.advance(1);
    return;
  }

  if (nextControl == -1) {
    // There are no control characters in this string.
    print(buf);
    parseState.reset();
    return;
  }

  print(buf.substr(0, nextControl));
  this.dispatch('CC1', buf.substr(nextControl, 1), parseState);
  parseState.advance(nextControl + 1);
};

/**
 * Parse a Control Sequence Introducer code and dispatch it.
 *
 * See [CSI] for some useful information about these codes.
 *
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.prototype.parseCSI_ = function(parseState) {
  const ch = parseState.peekChar();
  const args = parseState.args;

  const finishParsing = () => {
    // Resetting the arguments isn't strictly necessary, but it makes debugging
    // less confusing (otherwise args will stick around until the next sequence
    // that needs arguments).
    parseState.resetArguments();
    // We need to clear subargs since we explicitly set it.
    parseState.subargs = null;
    parseState.resetParseFunction();
  };

  if (ch >= '@' && ch <= '~') {
    // This is the final character.
    this.dispatch('CSI', this.leadingModifier_ + this.trailingModifier_ + ch,
                  parseState);
    finishParsing();

  } else if (ch == ';') {
    // Parameter delimiter.
    if (this.trailingModifier_) {
      // Parameter delimiter after the trailing modifier.  That's a paddlin'.
      finishParsing();

    } else {
      if (!args.length) {
        // They omitted the first param, we need to supply it.
        args.push('');
      }

      args.push('');
    }

  } else if (ch >= '0' && ch <= '9' || ch == ':') {
    // Next byte in the current parameter.

    if (this.trailingModifier_) {
      // Numeric parameter after the trailing modifier.  That's a paddlin'.
      finishParsing();
    } else {
      if (!args.length) {
        args[0] = ch;
      } else {
        args[args.length - 1] += ch;
      }

      // Possible sub-parameters.
      if (ch == ':') {
        parseState.argSetSubargs(args.length - 1);
      }
    }

  } else if (ch >= ' ' && ch <= '?') {
    // Modifier character.
    if (!args.length) {
      this.leadingModifier_ += ch;
    } else {
      this.trailingModifier_ += ch;
    }

  } else if (this.cc1Pattern_.test(ch)) {
    // Control character.
    this.dispatch('CC1', ch, parseState);

  } else {
    // Unexpected character in sequence, bail out.
    finishParsing();
  }

  parseState.advance(1);
};

/**
 * Skip over the string until the next String Terminator (ST, 'ESC \') or
 * Bell (BEL, '\x07').
 *
 * The string is accumulated in parseState.args[0].  Make sure to reset the
 * arguments (with parseState.resetArguments) before starting the parse.
 *
 * You can detect that parsing in complete by checking that the parse
 * function has changed back to the default parse function.
 *
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 * @return {boolean} If true, parsing is ongoing or complete.  If false, we've
 *     exceeded the max string sequence.
 */
hterm.VT.prototype.parseUntilStringTerminator_ = function(parseState) {
  let buf = parseState.peekRemainingBuf();
  const args = parseState.args;
  // Since we might modify parse state buffer locally, if we want to advance
  // the parse state buffer later on, we need to know how many chars we added.
  let bufInserted = 0;

  if (!args.length) {
    args[0] = '';
    args[1] = new Date().getTime();
  } else {
    // If our saved buffer ends with an escape, it's because we were hoping
    // it's an ST split across two buffers.  Move it from our saved buffer
    // to the start of our current buffer for processing anew.
    if (args[0].slice(-1) == '\x1b') {
      args[0] = args[0].slice(0, -1);
      buf = '\x1b' + buf;
      bufInserted = 1;
    }
  }

  // eslint-disable-next-line no-control-regex
  const nextTerminator = buf.search(/[\x1b\x07]/);
  const terminator = buf[nextTerminator];
  let foundTerminator;

  // If the next escape we see is not a start of a ST, fall through.  This will
  // either be invalid (embedded escape), or we'll queue it up (wait for \\).
  if (terminator == '\x1b' && buf[nextTerminator + 1] != '\\') {
    foundTerminator = false;
  } else {
    foundTerminator = (nextTerminator != -1);
  }

  if (!foundTerminator) {
    // No terminator here, have to wait for the next string.

    args[0] += buf;

    let abortReason;

    // Special case: If our buffering happens to split the ST (\e\\), we have to
    // buffer the content temporarily.  So don't reject a trailing escape here,
    // instead we let it timeout or be rejected in the next pass.
    if (terminator == '\x1b' && nextTerminator != buf.length - 1) {
      abortReason = 'embedded escape: ' + nextTerminator;
    }

    // We stuffed a Date into args[1] above.
    const elapsedTime = new Date().getTime() - args[1];
    if (elapsedTime > this.oscTimeLimit_) {
      abortReason = `timeout expired: ${elapsedTime}s`;
    }

    if (abortReason) {
      if (this.warnUnimplemented) {
        console.log('parseUntilStringTerminator_: aborting: ' + abortReason,
                    args[0]);
      }
      parseState.reset(args[0]);
      return false;
    }

    parseState.advance(buf.length - bufInserted);
    return true;
  }

  args[0] += buf.substr(0, nextTerminator);

  parseState.resetParseFunction();
  parseState.advance(nextTerminator +
                     (terminator == '\x1b' ? 2 : 1) - bufInserted);

  return true;
};

/**
 * Dispatch to the function that handles a given CC1, ESC, or CSI or VT52 code.
 *
 * @param {string} type
 * @param {string} code
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.prototype.dispatch = function(type, code, parseState) {
  const handler = hterm.VT[type][code];
  if (!handler) {
    if (this.warnUnimplemented) {
      console.warn(`Unknown ${type} code: ${JSON.stringify(code)}`);
    }
    return;
  }

  if (handler == hterm.VT.ignore) {
    if (this.warnUnimplemented) {
      console.warn(`Ignored ${type} code: ${JSON.stringify(code)}`);
    }
    return;
  }

  if (parseState.subargs && !handler.supportsSubargs) {
    if (this.warnUnimplemented) {
      console.warn(`Ignored ${type} code w/subargs: ${JSON.stringify(code)}`);
    }
    return;
  }

  if (type == 'CC1' && code > '\x7f' && !this.enable8BitControl) {
    // It's kind of a hack to put this here, but...
    //
    // If we're dispatching a 'CC1' code, and it's got the eighth bit set,
    // but we're not supposed to handle 8-bit codes?  Just ignore it.
    //
    // This prevents an errant (DCS, '\x90'), (OSC, '\x9d'), (PM, '\x9e') or
    // (APC, '\x9f') from locking up the terminal waiting for its expected
    // (ST, '\x9c') or (BEL, '\x07').
    console.warn('Ignoring 8-bit control code: 0x' +
                 code.charCodeAt(0).toString(16));
    return;
  }

  handler.apply(this, [parseState, code]);
};

/**
 * Set one of the ANSI defined terminal mode bits.
 *
 * Invoked in response to SM/RM.
 *
 * Unexpected and unimplemented values are silently ignored.
 *
 * @param {string} code
 * @param {boolean} state
 */
hterm.VT.prototype.setANSIMode = function(code, state) {
  if (code == 4) {  // Insert Mode (IRM)
    this.terminal.setInsertMode(state);
  } else if (code == 20) {  // Automatic Newline (LNM)
    this.terminal.setAutoCarriageReturn(state);
  } else if (this.warnUnimplemented) {
    console.warn('Unimplemented ANSI Mode: ' + code);
  }
};

/**
 * Set or reset one of the DEC Private modes.
 *
 * Invoked in response to DECSET/DECRST.
 *
 * @param {string} code
 * @param {boolean} state
 */
hterm.VT.prototype.setDECMode = function(code, state) {
  switch (parseInt(code, 10)) {
    case 1:  // DECCKM
      this.terminal.keyboard.applicationCursor = state;
      break;

    case 3:  // DECCOLM
      if (this.allowColumnWidthChanges_) {
        this.terminal.setWidth(state ? 132 : 80);

        this.terminal.clearHome();
        this.terminal.setVTScrollRegion(null, null);
      }
      break;

    case 5:  // DECSCNM
      this.terminal.setReverseVideo(state);
      break;

    case 6:  // DECOM
      this.terminal.setOriginMode(state);
      break;

    case 7:  // DECAWM
      this.terminal.setWraparound(state);
      break;

    case 9:  // Report on mouse down events only (X10).
      this.mouseReport = (
          state ? this.MOUSE_REPORT_PRESS : this.MOUSE_REPORT_DISABLED);
      this.terminal.syncMouseStyle();
      break;

    case 12:  // Start blinking cursor
      if (this.enableDec12) {
        this.terminal.setCursorBlink(state);
      }
      break;

    case 25:  // DECTCEM
      this.terminal.setCursorVisible(state);
      break;

    case 30:  // Show scrollbar
      this.terminal.setScrollbarVisible(state);
      break;

    case 40:  // Allow 80 - 132 (DECCOLM) Mode
      this.terminal.allowColumnWidthChanges_ = state;
      break;

    case 45:  // Reverse-wraparound Mode
      this.terminal.setReverseWraparound(state);
      break;

    case 67:  // Backarrow key sends backspace (DECBKM)
      this.terminal.keyboard.backspaceSendsBackspace = state;
      break;

    case 1000:  // Report on mouse clicks only (X11).
      this.mouseReport = (
          state ? this.MOUSE_REPORT_CLICK : this.MOUSE_REPORT_DISABLED);
      this.terminal.syncMouseStyle();
      break;

    case 1002:  // Report on mouse clicks and drags
      this.mouseReport = (
          state ? this.MOUSE_REPORT_DRAG : this.MOUSE_REPORT_DISABLED);
      this.terminal.syncMouseStyle();
      break;

    case 1004:  // Report on window focus change.
      this.terminal.reportFocus = state;
      break;

    case 1005:  // Extended coordinates in UTF-8 mode.
      this.mouseCoordinates = (
          state ? this.MOUSE_COORDINATES_UTF8 : this.MOUSE_COORDINATES_X10);
      break;

    case 1006:  // Extended coordinates in SGR mode.
      this.mouseCoordinates = (
          state ? this.MOUSE_COORDINATES_SGR : this.MOUSE_COORDINATES_X10);
      break;

    case 1007:  // Enable Alternate Scroll Mode.
      this.terminal.scrollWheelArrowKeys_ = state;
      break;

    case 1010:  // Scroll to bottom on tty output
      this.terminal.scrollOnOutput = state;
      break;

    case 1011:  // Scroll to bottom on key press
      this.terminal.scrollOnKeystroke = state;
      break;

    case 1036:  // Send ESC when Meta modifies a key
      this.terminal.keyboard.metaSendsEscape = state;
      break;

    case 1039:  // Send ESC when Alt modifies a key
      if (state) {
        if (!this.terminal.keyboard.previousAltSendsWhat_) {
          this.terminal.keyboard.previousAltSendsWhat_ =
              this.terminal.keyboard.altSendsWhat;
          this.terminal.keyboard.altSendsWhat = 'escape';
        }
      } else if (this.terminal.keyboard.previousAltSendsWhat_) {
        this.terminal.keyboard.altSendsWhat =
            this.terminal.keyboard.previousAltSendsWhat_;
        this.terminal.keyboard.previousAltSendsWhat_ = null;
      }
      break;

    case 47:  // Use Alternate Screen Buffer
    case 1047:
      this.terminal.setAlternateMode(state);
      break;

    case 1048:  // Save cursor as in DECSC.
      if (state) {
        this.terminal.saveCursorAndState();
      } else {
        this.terminal.restoreCursorAndState();
      }
      break;

    case 1049:  // 1047 + 1048 + clear.
      if (state) {
        this.terminal.saveCursorAndState();
        this.terminal.setAlternateMode(state);
        this.terminal.clear();
      } else {
        this.terminal.setAlternateMode(state);
        this.terminal.restoreCursorAndState();
      }

      break;

    case 2004:  // Bracketed paste mode.
      this.terminal.setBracketedPaste(state);
      break;

    default:
      if (this.warnUnimplemented) {
        console.warn('Unimplemented DEC Private Mode: ' + code);
      }
      break;
  }
};

/**
 * Function shared by control characters and escape sequences that are
 * ignored.
 */
hterm.VT.ignore = function() {};

/**
 * Collection of control characters expressed in a single byte.
 *
 * This includes the characters from the C0 and C1 sets (see [CTRL]) that we
 * care about.  Two byte versions of the C1 codes are defined in the
 * hterm.VT.ESC collection.
 *
 * The 'CC1' mnemonic here refers to the fact that these are one-byte Control
 * Codes.  It's only used in this source file and not defined in any of the
 * referenced documents.
 */
hterm.VT.CC1 = {};

/**
 * Collection of two-byte and three-byte sequences starting with ESC.
 */
hterm.VT.ESC = {};

/**
 * Collection of CSI (Control Sequence Introducer) sequences.
 *
 * These sequences begin with 'ESC [', and may take zero or more arguments.
 */
hterm.VT.CSI = {};

/**
 * Collection of OSC (Operating System Control) sequences.
 *
 * These sequences begin with 'ESC ]', followed by a function number and a
 * string terminated by either ST or BEL.
 */
hterm.VT.OSC = {};

/**
 * Collection of VT52 sequences.
 *
 * When in VT52 mode, other sequences are disabled.
 */
hterm.VT.VT52 = {};

/**
 * Null (NUL).
 *
 * Silently ignored.
 */
hterm.VT.CC1['\x00'] = hterm.VT.ignore;

/**
 * Enquiry (ENQ).
 *
 * Transmit answerback message.
 *
 * The default answerback message in xterm is an empty string, so we just
 * ignore this.
 */
hterm.VT.CC1['\x05'] = hterm.VT.ignore;

/**
 * Ring Bell (BEL).
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x07'] = function() {
  this.terminal.ringBell();
};

/**
 * Backspace (BS).
 *
 * Move the cursor to the left one character position, unless it is at the
 * left margin, in which case no action occurs.
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x08'] = function() {
  this.terminal.cursorLeft(1);
};

/**
 * Horizontal Tab (HT).
 *
 * Move the cursor to the next tab stop, or to the right margin if no further
 * tab stops are present on the line.
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x09'] = function() {
  this.terminal.forwardTabStop();
};

/**
 * Line Feed (LF).
 *
 * This code causes a line feed or a new line operation.  See Automatic
 * Newline (LNM).
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x0a'] = function() {
  this.terminal.formFeed();
};

/**
 * Vertical Tab (VT).
 *
 * Interpreted as LF.
 */
hterm.VT.CC1['\x0b'] = hterm.VT.CC1['\x0a'];

/**
 * Form Feed (FF).
 *
 * Interpreted as LF.
 */
hterm.VT.CC1['\x0c'] = hterm.VT.CC1['\x0a'];

/**
 * Carriage Return (CR).
 *
 * Move cursor to the left margin on the current line.
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x0d'] = function() {
  this.terminal.setCursorColumn(0);
};

/**
 * Shift Out (SO), aka Lock Shift 0 (LS1).
 *
 * @this {!hterm.VT}
 * Invoke G1 character set in GL.
 */
hterm.VT.CC1['\x0e'] = function() {
  this.GL = 'G1';
};

/**
 * Shift In (SI), aka Lock Shift 0 (LS0).
 *
 * Invoke G0 character set in GL.
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x0f'] = function() {
  this.GL = 'G0';
};

/**
 * Transmit On (XON).
 *
 * Not currently implemented.
 *
 * TODO(rginda): Implement?
 */
hterm.VT.CC1['\x11'] = hterm.VT.ignore;

/**
 * Transmit Off (XOFF).
 *
 * Not currently implemented.
 *
 * TODO(rginda): Implement?
 */
hterm.VT.CC1['\x13'] = hterm.VT.ignore;

/**
 * Cancel (CAN).
 *
 * If sent during a control sequence, the sequence is immediately terminated
 * and not executed.
 *
 * It also causes the error character to be displayed.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CC1['\x18'] = function(parseState) {
  // If we've shifted in the G1 character set, shift it back out to
  // the default character set.
  if (this.GL == 'G1') {
    this.GL = 'G0';
  }
  parseState.resetParseFunction();
  this.terminal.print('?');
};

/**
 * Substitute (SUB).
 *
 * Interpreted as CAN.
 */
hterm.VT.CC1['\x1a'] = hterm.VT.CC1['\x18'];

/**
 * Escape (ESC).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CC1['\x1b'] = function(parseState) {
  function parseESC(parseState) {
    const ch = parseState.consumeChar();

    if (ch == '\x1b') {
      return;
    }

    this.dispatch('ESC', ch, parseState);

    if (parseState.func == parseESC) {
      parseState.resetParseFunction();
    }
  }

  parseState.func = parseESC;
};

/**
 * Delete (DEL).
 */
hterm.VT.CC1['\x7f'] = hterm.VT.ignore;

// 8 bit control characters and their two byte equivalents, below...

/**
 * Index (IND).
 *
 * Like newline, only keep the X position
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x84'] =
hterm.VT.ESC['D'] = function() {
  this.terminal.lineFeed();
};

/**
 * Next Line (NEL).
 *
 * Like newline, but doesn't add lines.
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x85'] =
hterm.VT.ESC['E'] = function() {
  this.terminal.setCursorColumn(0);
  this.terminal.cursorDown(1);
};

/**
 * Horizontal Tabulation Set (HTS).
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x88'] =
hterm.VT.ESC['H'] = function() {
  this.terminal.setTabStop(this.terminal.getCursorColumn());
};

/**
 * Reverse Index (RI).
 *
 * Move up one line.
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x8d'] =
hterm.VT.ESC['M'] = function() {
  this.terminal.reverseLineFeed();
};

/**
 * Single Shift 2 (SS2).
 *
 * Select of G2 Character Set for the next character only.
 *
 * Not currently implemented.
 */
hterm.VT.CC1['\x8e'] =
hterm.VT.ESC['N'] = hterm.VT.ignore;

/**
 * Single Shift 3 (SS3).
 *
 * Select of G3 Character Set for the next character only.
 *
 * Not currently implemented.
 */
hterm.VT.CC1['\x8f'] =
hterm.VT.ESC['O'] = hterm.VT.ignore;

/**
 * Device Control String (DCS).
 *
 * Indicate a DCS sequence.  See Device-Control functions in [XTERM].
 * Not currently implemented.
 *
 * TODO(rginda): Consider implementing DECRQSS, the rest don't seem applicable.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CC1['\x90'] =
hterm.VT.ESC['P'] = function(parseState) {
  parseState.resetArguments();
  parseState.func = this.parseUntilStringTerminator_;
};

/**
 * Start of Guarded Area (SPA).
 *
 * Will not implement.
 */
hterm.VT.CC1['\x96'] =
hterm.VT.ESC['V'] = hterm.VT.ignore;

/**
 * End of Guarded Area (EPA).
 *
 * Will not implement.
 */
hterm.VT.CC1['\x97'] =
hterm.VT.ESC['W'] = hterm.VT.ignore;

/**
 * Start of String (SOS).
 *
 * Will not implement.
 */
hterm.VT.CC1['\x98'] =
hterm.VT.ESC['X'] = hterm.VT.ignore;

/**
 * Single Character Introducer (SCI, also DECID).
 *
 * Return Terminal ID.  Obsolete form of 'ESC [ c' (DA).
 *
 * @this {!hterm.VT}
 */
hterm.VT.CC1['\x9a'] =
hterm.VT.ESC['Z'] = function() {
  this.terminal.io.sendString('\x1b[?1;2c');
};

/**
 * Control Sequence Introducer (CSI).
 *
 * The lead into most escape sequences.  See [CSI].
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CC1['\x9b'] =
hterm.VT.ESC['['] = function(parseState) {
  parseState.resetArguments();
  this.leadingModifier_ = '';
  this.trailingModifier_ = '';
  parseState.func = this.parseCSI_;
};

/**
 * String Terminator (ST).
 *
 * Used to terminate DCS/OSC/PM/APC commands which may take string arguments.
 *
 * We don't directly handle it here, as it's only used to terminate other
 * sequences.  See the 'parseUntilStringTerminator_' method.
 */
hterm.VT.CC1['\x9c'] =
hterm.VT.ESC['\\'] = hterm.VT.ignore;

/**
 * Operating System Command (OSC).
 *
 * Commands relating to the operating system.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CC1['\x9d'] =
hterm.VT.ESC[']'] = function(parseState) {
  parseState.resetArguments();

  /**
   * @param {!hterm.VT.ParseState} parseState The current parse state.
   */
  function parseOSC(parseState) {
    if (!this.parseUntilStringTerminator_(parseState)) {
      // The string sequence was too long.
      return;
    }

    if (parseState.func == parseOSC) {
      // We're not done parsing the string yet.
      return;
    }

    // We're done.
    const ary = parseState.args[0].match(/^(\d+);?(.*)$/);
    if (ary) {
      parseState.args[0] = ary[2];
      this.dispatch('OSC', ary[1], parseState);
    } else {
      console.warn('Invalid OSC: ' + JSON.stringify(parseState.args[0]));
    }

    // Resetting the arguments isn't strictly necessary, but it makes debugging
    // less confusing (otherwise args will stick around until the next sequence
    // that needs arguments).
    parseState.resetArguments();
  }

  parseState.func = parseOSC;
};

/**
 * Privacy Message (PM).
 *
 * Will not implement.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CC1['\x9e'] =
hterm.VT.ESC['^'] = function(parseState) {
  parseState.resetArguments();
  parseState.func = this.parseUntilStringTerminator_;
};

/**
 * Application Program Control (APC).
 *
 * Will not implement.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CC1['\x9f'] =
hterm.VT.ESC['_'] = function(parseState) {
  parseState.resetArguments();
  parseState.func = this.parseUntilStringTerminator_;
};

/**
 * ESC \x20 - Unclear to me where these originated, possibly in xterm.
 *
 * Not currently implemented:
 *   ESC \x20 F - Select 7 bit escape codes in responses (S7C1T).
 *   ESC \x20 G - Select 8 bit escape codes in responses (S8C1T).
 *                NB: We currently assume S7C1T always.
 *
 * Will not implement:
 *   ESC \x20 L - Set ANSI conformance level 1.
 *   ESC \x20 M - Set ANSI conformance level 2.
 *   ESC \x20 N - Set ANSI conformance level 3.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.ESC['\x20'] = function(parseState) {
  parseState.func = function(parseState) {
    const ch = parseState.consumeChar();
    if (this.warnUnimplemented) {
      console.warn('Unimplemented sequence: ESC 0x20 ' + ch);
    }
    parseState.resetParseFunction();
  };
};

/**
 * DEC 'ESC #' sequences.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.ESC['#'] = function(parseState) {
  parseState.func = function(parseState) {
    const ch = parseState.consumeChar();
    if (ch == '8') {
      // DEC Screen Alignment Test (DECALN).
      this.terminal.setCursorPosition(0, 0);
      this.terminal.fill('E');
    }

    parseState.resetParseFunction();
  };
};

/**
 * Designate Other Coding System (DOCS).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.ESC['%'] = function(parseState) {
  parseState.func = function(parseState) {
    let ch = parseState.consumeChar();

    // If we've locked the encoding, then just eat the bytes and return.
    if (this.codingSystemLocked_) {
      if (ch == '/') {
        parseState.consumeChar();
      }
      parseState.resetParseFunction();
      return;
    }

    // Process the encoding requests.
    switch (ch) {
      case '@':
        // Switch to ECMA 35.
        this.setEncoding('iso-2022');
        break;

      case 'G':
        // Switch to UTF-8.
        this.setEncoding('utf-8');
        break;

      case '/':
        // One way transition to something else.
        ch = parseState.consumeChar();
        switch (ch) {
          case 'G':  // UTF-8 Level 1.
          case 'H':  // UTF-8 Level 2.
          case 'I':  // UTF-8 Level 3.
            // We treat all UTF-8 levels the same.
            this.setEncoding('utf-8-locked');
            break;

          default:
            if (this.warnUnimplemented) {
              console.warn('Unknown ESC % / argument: ' + JSON.stringify(ch));
            }
            break;
        }
        break;

      default:
        if (this.warnUnimplemented) {
          console.warn('Unknown ESC % argument: ' + JSON.stringify(ch));
        }
        break;
    }

    parseState.resetParseFunction();
  };
};

/**
 * Character Set Selection (SCS).
 *
 *   ESC ( Ps - Set G0 character set (VT100).
 *   ESC ) Ps - Set G1 character set (VT220).
 *   ESC * Ps - Set G2 character set (VT220).
 *   ESC + Ps - Set G3 character set (VT220).
 *   ESC - Ps - Set G1 character set (VT300).
 *   ESC . Ps - Set G2 character set (VT300).
 *   ESC / Ps - Set G3 character set (VT300).
 *
 * All other sequences are echoed to the terminal.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 * @param {string} code
 */
hterm.VT.ESC['('] =
hterm.VT.ESC[')'] =
hterm.VT.ESC['*'] =
hterm.VT.ESC['+'] =
hterm.VT.ESC['-'] =
hterm.VT.ESC['.'] =
hterm.VT.ESC['/'] = function(parseState, code) {
  parseState.func = function(parseState) {
    const ch = parseState.consumeChar();
    if (ch == '\x1b') {
      parseState.resetParseFunction();
      parseState.func();
      return;
    }

    const map = this.characterMaps.getMap(ch);
    if (map !== undefined) {
      if (code == '(') {
        this.G0 = map;
      } else if (code == ')' || code == '-') {
        this.G1 = map;
      } else if (code == '*' || code == '.') {
        this.G2 = map;
      } else if (code == '+' || code == '/') {
        this.G3 = map;
      }
    } else if (this.warnUnimplemented) {
      console.log('Invalid character set for "' + code + '": ' + ch);
    }

    parseState.resetParseFunction();
  };
};

/**
 * Back Index (DECBI).
 *
 * VT420 and up.  Not currently implemented.
 */
hterm.VT.ESC['6'] = hterm.VT.ignore;

/**
 * Save Cursor (DECSC).
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['7'] = function() {
  this.terminal.saveCursorAndState();
};

/**
 * Restore Cursor (DECRC).
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['8'] = function() {
  this.terminal.restoreCursorAndState();
};

/**
 * Forward Index (DECFI).
 *
 * VT210 and up.  Not currently implemented.
 */
hterm.VT.ESC['9'] = hterm.VT.ignore;

/**
 * Application keypad (DECKPAM).
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['='] = function() {
  this.terminal.keyboard.applicationKeypad = true;
};

/**
 * Normal keypad (DECKPNM).
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['>'] = function() {
  this.terminal.keyboard.applicationKeypad = false;
};

/**
 * Cursor to lower left corner of screen.
 *
 * Will not implement.
 *
 * This is only recognized by xterm when the hpLowerleftBugCompat resource is
 * set.
 */
hterm.VT.ESC['F'] = hterm.VT.ignore;

/**
 * Full Reset (RIS).
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['c'] = function() {
  this.terminal.reset();
};

/**
 * Memory lock/unlock.
 *
 * Will not implement.
 */
hterm.VT.ESC['l'] =
hterm.VT.ESC['m'] = hterm.VT.ignore;

/**
 * Lock Shift 2 (LS2)
 *
 * Invoke the G2 Character Set as GL.
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['n'] = function() {
  this.GL = 'G2';
};

/**
 * Lock Shift 3 (LS3)
 *
 * Invoke the G3 Character Set as GL.
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['o'] = function() {
  this.GL = 'G3';
};

/**
 * Lock Shift 2, Right (LS3R)
 *
 * Invoke the G3 Character Set as GR.
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['|'] = function() {
  this.GR = 'G3';
};

/**
 * Lock Shift 2, Right (LS2R)
 *
 * Invoke the G2 Character Set as GR.
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['}'] = function() {
  this.GR = 'G2';
};

/**
 * Lock Shift 1, Right (LS1R)
 *
 * Invoke the G1 Character Set as GR.
 *
 * @this {!hterm.VT}
 */
hterm.VT.ESC['~'] = function() {
  this.GR = 'G1';
};

/**
 * Change icon name and window title.
 *
 * We only change the window title.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['0'] = function(parseState) {
  this.terminal.setWindowTitle(parseState.args[0]);
};

/**
 * Change window title.
 */
hterm.VT.OSC['2'] = hterm.VT.OSC['0'];

/**
 * Set/read color palette.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['4'] = function(parseState) {
  // Args come in as a single 'index1;rgb1 ... ;indexN;rgbN' string.
  // We split on the semicolon and iterate through the pairs.
  const args = parseState.args[0].split(';');

  const pairCount = Math.floor(args.length / 2);
  const responseArray = [];

  for (let pairNumber = 0; pairNumber < pairCount; ++pairNumber) {
    const colorIndex = parseInt(args[pairNumber * 2], 10);
    let colorValue = args[pairNumber * 2 + 1];

    if (colorIndex >= lib.colors.stockPalette.length) {
      continue;
    }

    if (colorValue == '?') {
      // '?' means we should report back the current color value.
      colorValue = lib.colors.rgbToX11(
          this.terminal.getColorPalette(colorIndex));
      if (colorValue) {
        responseArray.push(colorIndex + ';' + colorValue);
      }

      continue;
    }

    colorValue = lib.colors.x11ToCSS(colorValue);
    if (colorValue) {
      this.terminal.setColorPalette(colorIndex, colorValue);
    }
  }

  if (responseArray.length) {
    this.terminal.io.sendString('\x1b]4;' + responseArray.join(';') + '\x07');
  }
};

/**
 * Hyperlinks.
 *
 * The first argument is optional and colon separated:
 *   id=<id>
 * The second argument is the link itself.
 *
 * Calling with a non-blank URI starts it.  A blank URI stops it.
 *
 * https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['8'] = function(parseState) {
  const args = parseState.args[0].split(';');
  let id = null;
  let uri = null;

  if (args.length != 2 || args[1].length == 0) {
    // Reset link.
  } else {
    // Pull out any colon separated parameters in the first argument.
    const params = args[0].split(':');
    id = '';
    params.forEach((param) => {
      const idx = param.indexOf('=');
      if (idx == -1) {
        return;
      }

      const key = param.slice(0, idx);
      const value = param.slice(idx + 1);
      switch (key) {
        case 'id':
          id = value;
          break;
        default:
          // Ignore unknown keys.
          break;
      }
    });

    // The URI is in the second argument.
    uri = args[1];
  }

  const attrs = this.terminal.getTextAttributes();
  attrs.uri = uri;
  attrs.uriId = id;
};

/**
 * iTerm2 growl notifications.
 *
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['9'] = function(parseState) {
  // This just dumps the entire string as the message.
  hterm.notify({'body': parseState.args[0]});
};

/**
 * Change VT100 text foreground color.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['10'] = function(parseState) {
  // Args come in as a single string, but extra args will chain to the following
  // OSC sequences.
  const args = parseState.args[0].split(';');
  if (!args) {
    return;
  }

  const colorX11 = lib.colors.x11ToCSS(args.shift());
  if (colorX11) {
    this.terminal.setForegroundColor(colorX11);
  }

  if (args.length > 0) {
    parseState.args[0] = args.join(';');
    hterm.VT.OSC['11'].apply(this, [parseState]);
  }
};

/**
 * Change VT100 text background color.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['11'] = function(parseState) {
  // Args come in as a single string, but extra args will chain to the following
  // OSC sequences.
  const args = parseState.args[0].split(';');
  if (!args) {
    return;
  }

  const colorX11 = lib.colors.x11ToCSS(args.shift());
  if (colorX11) {
    this.terminal.setBackgroundColor(colorX11);
  }

  if (args.length > 0) {
    parseState.args[0] = args.join(';');
    hterm.VT.OSC['12'].apply(this, [parseState]);
  }
};

/**
 * Change text cursor color.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['12'] = function(parseState) {
  // Args come in as a single string, but extra args will chain to the following
  // OSC sequences.
  const args = parseState.args[0].split(';');
  if (!args) {
    return;
  }

  const colorX11 = lib.colors.x11ToCSS(args.shift());
  if (colorX11) {
    this.terminal.setCursorColor(colorX11);
  }

  /* Note: If we support OSC 13+, we'd chain it here.
  if (args.length > 0) {
    parseState.args[0] = args.join(';');
    hterm.VT.OSC['13'].apply(this, [parseState]);
  }
  */
};

/**
 * Set the cursor shape.
 *
 * Parameter is expected to be in the form "CursorShape=number", where number is
 * one of:
 *
 *   0 - Block
 *   1 - I-Beam
 *   2 - Underline
 *
 * This is a bit of a de-facto standard supported by iTerm 2 and Konsole.  See
 * also: DECSCUSR.
 *
 * Invalid numbers will restore the cursor to the block shape.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['50'] = function(parseState) {
  const args = parseState.args[0].match(/CursorShape=(.)/i);
  if (!args) {
    console.warn('Could not parse OSC 50 args: ' + parseState.args[0]);
    return;
  }

  switch (args[1]) {
    case '1':  // CursorShape=1: I-Beam.
      this.terminal.setCursorShape(hterm.Terminal.cursorShape.BEAM);
      break;

    case '2':  // CursorShape=2: Underline.
      this.terminal.setCursorShape(hterm.Terminal.cursorShape.UNDERLINE);
      break;

    default:  // CursorShape=0: Block.
      this.terminal.setCursorShape(hterm.Terminal.cursorShape.BLOCK);
  }
};

/**
 * Set/read system clipboard.
 *
 * Read is not implemented due to security considerations.  A remote app
 * that is able to both write and read to the clipboard could essentially
 * take over your session.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['52'] = function(parseState) {
  if (!this.enableClipboardWrite) {
    return;
  }

  // Args come in as a single 'clipboard;b64-data' string.  The clipboard
  // parameter is used to select which of the X clipboards to address.  Since
  // we're not integrating with X, we treat them all the same.
  const args = parseState.args[0].match(/^[cps01234567]*;(.*)/);
  if (!args) {
    return;
  }

  let data;
  try {
    data = window.atob(args[1]);
  } catch (e) {
    // If the user sent us invalid base64 content, silently ignore it.
    return;
  }
  const decoder = new TextDecoder();
  const bytes = lib.codec.stringToCodeUnitArray(data);
  data = decoder.decode(bytes);
  if (data) {
    this.terminal.copyStringToClipboard(data);
  }
};

/**
 * Reset color palette.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['104'] = function(parseState) {
  // If there are no args, we reset the entire palette.
  if (!parseState.args[0]) {
    this.terminal.resetColorPalette();
    return;
  }

  // Args come in as a single 'index1;index2;...;indexN' string.
  // Split on the semicolon and iterate through the colors.
  const args = parseState.args[0].split(';');
  args.forEach((c) => this.terminal.resetColor(c));
};

/**
 * Reset foreground color.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['110'] = function(parseState) {
  this.terminal.setForegroundColor();
};

/**
 * Reset background color.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['111'] = function(parseState) {
  this.terminal.setBackgroundColor();
};

/**
 * Reset text cursor color.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['112'] = function(parseState) {
  this.terminal.setCursorColor();
};

/**
 * iTerm2 extended sequences.
 *
 * We only support image display atm.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['1337'] = function(parseState) {
  // Args come in as a set of key value pairs followed by data.
  // File=name=<base64>;size=123;inline=1:<base64 data>
  const args = parseState.args[0].match(/^File=([^:]*):([\s\S]*)$/m);
  if (!args) {
    if (this.warnUnimplemented) {
      console.log(`iTerm2 1337: unsupported sequence: ${args[1]}`);
    }
    return;
  }

  const options = {
    name: '',
    size: 0,
    preserveAspectRatio: true,
    inline: false,
    width: 'auto',
    height: 'auto',
    align: 'left',
    type: '',
    buffer: lib.codec.stringToCodeUnitArray(atob(args[2])).buffer,
  };
  // Walk the "key=value;" sets.
  args[1].split(';').forEach((ele) => {
    const kv = ele.match(/^([^=]+)=(.*)$/m);
    if (!kv) {
      return;
    }

    // Sanitize values nicely.
    switch (kv[1]) {
      case 'name':
        try {
          options.name = window.atob(kv[2]);
        } catch (e) {
          // Ignore invalid base64 from user.
        }
        break;
      case 'size':
        try {
          options.size = parseInt(kv[2], 10);
        } catch (e) {
          // Ignore invalid numbers from user.
        }
        break;
      case 'width':
        options.width = kv[2];
        break;
      case 'height':
        options.height = kv[2];
        break;
      case 'preserveAspectRatio':
        options.preserveAspectRatio = !(kv[2] == '0');
        break;
      case 'inline':
        options.inline = !(kv[2] == '0');
        break;
      // hterm-specific keys.
      case 'align':
        options.align = kv[2];
        break;
      case 'type':
        options.type = kv[2];
        break;
      default:
        // Ignore unknown keys.  Don't want remote stuffing our JS env.
        break;
    }
  });

  // This is a bit of a hack.  If the buffer has data following the image, we
  // need to delay processing of it until after we've finished with the image.
  // Otherwise while we wait for the the image to load asynchronously, the new
  // text data will intermingle with the image.
  if (options.inline) {
    const io = this.terminal.io;
    const queued = parseState.peekRemainingBuf();
    parseState.advance(queued.length);
    this.terminal.displayImage(options);
    io.print(queued);
  } else {
    this.terminal.displayImage(options);
  }
};

/**
 * URxvt perl modules.
 *
 * This is the escape system used by rxvt-unicode and its perl modules.
 * Obviously we don't support perl or custom modules, so we list a few common
 * ones that we find useful.
 *
 * Technically there is no format here, but most modules obey:
 * <module name>;<module args, usually ; delimited>
 *
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.OSC['777'] = function(parseState) {
  let ary;
  const urxvtMod = parseState.args[0].split(';', 1)[0];

  switch (urxvtMod) {
    case 'notify': {
      // Format:
      // notify;title;message
      let title;
      let message;
      ary = parseState.args[0].match(/^[^;]+;([^;]*)(;([\s\S]*))?$/);
      if (ary) {
        title = ary[1];
        message = ary[3];
      }
      hterm.notify({'title': title, 'body': message});
      break;
    }

    default:
      console.warn('Unknown urxvt module: ' + parseState.args[0]);
      break;
  }
};

/**
 * Insert (blank) characters (ICH).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['@'] = function(parseState) {
  this.terminal.insertSpace(parseState.iarg(0, 1));
};

/**
 * Cursor Up (CUU).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['A'] = function(parseState) {
  this.terminal.cursorUp(parseState.iarg(0, 1));
};

/**
 * Cursor Down (CUD).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['B'] = function(parseState) {
  this.terminal.cursorDown(parseState.iarg(0, 1));
};

/**
 * Cursor Forward (CUF).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['C'] = function(parseState) {
  this.terminal.cursorRight(parseState.iarg(0, 1));
};

/**
 * Cursor Backward (CUB).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['D'] = function(parseState) {
  this.terminal.cursorLeft(parseState.iarg(0, 1));
};

/**
 * Cursor Next Line (CNL).
 *
 * This is like Cursor Down, except the cursor moves to the beginning of the
 * line as well.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['E'] = function(parseState) {
  this.terminal.cursorDown(parseState.iarg(0, 1));
  this.terminal.setCursorColumn(0);
};

/**
 * Cursor Preceding Line (CPL).
 *
 * This is like Cursor Up, except the cursor moves to the beginning of the
 * line as well.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['F'] = function(parseState) {
  this.terminal.cursorUp(parseState.iarg(0, 1));
  this.terminal.setCursorColumn(0);
};

/**
 * Cursor Horizontal Absolute (CHA).
 *
 * Xterm calls this Cursor Character Absolute.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['G'] = function(parseState) {
  this.terminal.setCursorColumn(parseState.iarg(0, 1) - 1);
};

/**
 * Cursor Position (CUP).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['H'] = function(parseState) {
  this.terminal.setCursorPosition(parseState.iarg(0, 1) - 1,
                                  parseState.iarg(1, 1) - 1);
};

/**
 * Cursor Forward Tabulation (CHT).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['I'] = function(parseState) {
  let count = parseState.iarg(0, 1);
  count = lib.f.clamp(count, 1, this.terminal.screenSize.width);
  for (let i = 0; i < count; i++) {
    this.terminal.forwardTabStop();
  }
};

/**
 * Erase in Display (ED, DECSED).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['J'] =
hterm.VT.CSI['?J'] = function(parseState) {
  const arg = parseState.args[0];

  if (!arg || arg == 0) {
    this.terminal.eraseBelow();
  } else if (arg == 1) {
    this.terminal.eraseAbove();
  } else if (arg == 2) {
    this.terminal.clear();
  } else if (arg == 3) {
    if (this.enableCsiJ3) {
      this.terminal.clearScrollback();
    }
  }
};

/**
 * Erase in line (EL, DECSEL).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['K'] =
hterm.VT.CSI['?K'] = function(parseState) {
  const arg = parseState.args[0];

  if (!arg || arg == 0) {
    this.terminal.eraseToRight();
  } else if (arg == 1) {
    this.terminal.eraseToLeft();
  } else if (arg == 2) {
    this.terminal.eraseLine();
  }
};

/**
 * Insert Lines (IL).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['L'] = function(parseState) {
  this.terminal.insertLines(parseState.iarg(0, 1));
};

/**
 * Delete Lines (DL).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['M'] = function(parseState) {
  this.terminal.deleteLines(parseState.iarg(0, 1));
};

/**
 * Delete Characters (DCH).
 *
 * This command shifts the line contents left, starting at the cursor position.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['P'] = function(parseState) {
  this.terminal.deleteChars(parseState.iarg(0, 1));
};

/**
 * Scroll Up (SU).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['S'] = function(parseState) {
  this.terminal.vtScrollUp(parseState.iarg(0, 1));
};

/**
 * Scroll Down (SD).
 * Also 'Initiate highlight mouse tracking'.  Will not implement this part.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['T'] = function(parseState) {
  if (parseState.args.length <= 1) {
    this.terminal.vtScrollDown(parseState.iarg(0, 1));
  }
};

/**
 * Reset one or more features of the title modes to the default value.
 *
 *   ESC [ > Ps T
 *
 * Normally, "reset" disables the feature. It is possible to disable the
 * ability to reset features by compiling a different default for the title
 * modes into xterm.
 *
 * Ps values:
 *   0 - Do not set window/icon labels using hexadecimal.
 *   1 - Do not query window/icon labels using hexadecimal.
 *   2 - Do not set window/icon labels using UTF-8.
 *   3 - Do not query window/icon labels using UTF-8.
 *
 * Will not implement.
 */
hterm.VT.CSI['>T'] = hterm.VT.ignore;

/**
 * Erase Characters (ECH).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['X'] = function(parseState) {
  this.terminal.eraseToRight(parseState.iarg(0, 1));
};

/**
 * Cursor Backward Tabulation (CBT).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['Z'] = function(parseState) {
  let count = parseState.iarg(0, 1);
  count = lib.f.clamp(count, 1, this.terminal.screenSize.width);
  for (let i = 0; i < count; i++) {
    this.terminal.backwardTabStop();
  }
};

/**
 * Character Position Absolute (HPA).
 *
 * Same as Cursor Horizontal Absolute (CHA).
 */
hterm.VT.CSI['`'] = hterm.VT.CSI['G'];

/**
 * Character Position Relative (HPR).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['a'] = function(parseState) {
  this.terminal.setCursorColumn(this.terminal.getCursorColumn() +
                                parseState.iarg(0, 1));
};

/**
 * Repeat the preceding graphic character.
 *
 * Not currently implemented.
 */
hterm.VT.CSI['b'] = hterm.VT.ignore;

/**
 * Send Device Attributes (Primary DA).
 *
 * TODO(rginda): This is hardcoded to send back 'VT100 with Advanced Video
 * Option', but it may be more correct to send a VT220 response once
 * we fill out the 'Not currently implemented' parts.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['c'] = function(parseState) {
  if (!parseState.args[0] || parseState.args[0] == 0) {
    this.terminal.io.sendString('\x1b[?1;2c');
  }
};

/**
 * Send Device Attributes (Secondary DA).
 *
 * TODO(rginda): This is hardcoded to send back 'VT100' but it may be more
 * correct to send a VT220 response once we fill out more 'Not currently
 * implemented' parts.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['>c'] = function(parseState) {
  this.terminal.io.sendString('\x1b[>0;256;0c');
};

/**
 * Line Position Absolute (VPA).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['d'] = function(parseState) {
  this.terminal.setAbsoluteCursorRow(parseState.iarg(0, 1) - 1);
};

/**
 * Horizontal and Vertical Position (HVP).
 *
 * Same as Cursor Position (CUP).
 */
hterm.VT.CSI['f'] = hterm.VT.CSI['H'];

/**
 * Tab Clear (TBC).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['g'] = function(parseState) {
  if (!parseState.args[0] || parseState.args[0] == 0) {
    // Clear tab stop at cursor.
    this.terminal.clearTabStopAtCursor();
  } else if (parseState.args[0] == 3) {
    // Clear all tab stops.
    this.terminal.clearAllTabStops();
  }
};

/**
 * Set Mode (SM).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['h'] = function(parseState) {
  for (let i = 0; i < parseState.args.length; i++) {
    this.setANSIMode(parseState.args[i], true);
  }
};

/**
 * DEC Private Mode Set (DECSET).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['?h'] = function(parseState) {
  for (let i = 0; i < parseState.args.length; i++) {
    this.setDECMode(parseState.args[i], true);
  }
};

/**
 * Media Copy (MC).
 * Media Copy (MC, DEC Specific).
 *
 * These commands control the printer.  Will not implement.
 */
hterm.VT.CSI['i'] =
hterm.VT.CSI['?i'] = hterm.VT.ignore;

/**
 * Reset Mode (RM).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['l'] = function(parseState) {
  for (let i = 0; i < parseState.args.length; i++) {
    this.setANSIMode(parseState.args[i], false);
  }
};

/**
 * DEC Private Mode Reset (DECRST).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current parse state.
 */
hterm.VT.CSI['?l'] = function(parseState) {
  for (let i = 0; i < parseState.args.length; i++) {
    this.setDECMode(parseState.args[i], false);
  }
};

/**
 * Parse extended SGR 38/48 sequences.
 *
 * This deals with the various ISO 8613-6 forms, and with legacy xterm forms
 * that are common in the wider application world.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState The current input state.
 * @param {number} i The argument in parseState to start processing.
 * @param {!hterm.TextAttributes} attrs The current text attributes.
 * @return {!Object} The skipCount member defines how many arguments to skip
 *     (i.e. how many were processed), and the color member is the color that
 *     was successfully processed, or undefined if not.
 */
hterm.VT.prototype.parseSgrExtendedColors = function(parseState, i, attrs) {
  let ary;
  let usedSubargs;

  if (parseState.argHasSubargs(i)) {
    // The ISO 8613-6 compliant form.
    // e.g. 38:[color choice]:[arg1]:[arg2]:...
    ary = parseState.args[i].split(':');
    ary.shift();  // Remove "38".
    usedSubargs = true;
  } else if (parseState.argHasSubargs(i + 1)) {
    // The xterm form which isn't ISO 8613-6 compliant.  Not many emulators
    // support this, and others actively do not want to.  We'll ignore it so
    // at least the rest of the stream works correctly.  e.g. 38;2:R:G:B
    // We return 0 here so we only skip the "38" ... we can't be confident the
    // next arg is actually supposed to be part of it vs a typo where the next
    // arg is legit.
    return {skipCount: 0};
  } else {
    // The xterm form which isn't ISO 8613-6 compliant, but many emulators
    // support, and many applications rely on.
    // e.g. 38;2;R;G;B
    ary = parseState.args.slice(i + 1);
    usedSubargs = false;
  }

  // Figure out which form to parse.
  switch (parseInt(ary[0], 10)) {
    default:  // Unknown.
    case 0:  // Implementation defined.  We ignore it.
      return {skipCount: 0};

    case 1: {  // Transparent color.
      // Require ISO 8613-6 form.
      if (!usedSubargs) {
        return {skipCount: 0};
      }

      return {
        color: 'rgba(0, 0, 0, 0)',
        skipCount: 0,
      };
    }

    case 2: {  // RGB color.
      // Skip over the color space identifier, if it exists.
      let start;
      if (usedSubargs) {
        // The ISO 8613-6 compliant form:
        //   38:2:<color space id>:R:G:B[:...]
        // The xterm form isn't ISO 8613-6 compliant.
        //   38:2:R:G:B
        // Since the ISO 8613-6 form requires at least 5 arguments,
        // we can still support the xterm form unambiguously.
        if (ary.length == 4) {
          start = 1;
        } else {
          start = 2;
        }
      } else {
        // The legacy xterm form: 38;2;R;G;B
        start = 1;
      }

      // We need at least 3 args for RGB.  If we don't have them, assume this
      // sequence is corrupted, so don't eat anything more.
      // We ignore more than 3 args on purpose since ISO 8613-6 defines some,
      // and we don't care about them.
      if (ary.length < start + 3) {
        return {skipCount: 0};
      }

      const r = parseState.parseInt(ary[start + 0]);
      const g = parseState.parseInt(ary[start + 1]);
      const b = parseState.parseInt(ary[start + 2]);
      return {
        color: `rgb(${r}, ${g}, ${b})`,
        skipCount: usedSubargs ? 0 : 4,
      };
    }

    case 3: {  // CMY color.
      // No need to support xterm/legacy forms as xterm doesn't support CMY.
      if (!usedSubargs) {
        return {skipCount: 0};
      }

      // We need at least 4 args for CMY.  If we don't have them, assume
      // this sequence is corrupted.  We ignore the color space identifier,
      // tolerance, etc...
      if (ary.length < 4) {
        return {skipCount: 0};
      }

      // TODO: See CMYK below.
      // const c = parseState.parseInt(ary[1]);
      // const m = parseState.parseInt(ary[2]);
      // const y = parseState.parseInt(ary[3]);
      return {skipCount: 0};
    }

    case 4: {  // CMYK color.
      // No need to support xterm/legacy forms as xterm doesn't support CMYK.
      if (!usedSubargs) {
        return {skipCount: 0};
      }

      // We need at least 5 args for CMYK.  If we don't have them, assume
      // this sequence is corrupted.  We ignore the color space identifier,
      // tolerance, etc...
      if (ary.length < 5) {
        return {skipCount: 0};
      }

      // TODO: Implement this.
      // Might wait until CSS4 is adopted for device-cmyk():
      // https://www.w3.org/TR/css-color-4/#cmyk-colors
      // Or normalize it to RGB ourselves:
      // https://www.w3.org/TR/css-color-4/#cmyk-rgb
      // const c = parseState.parseInt(ary[1]);
      // const m = parseState.parseInt(ary[2]);
      // const y = parseState.parseInt(ary[3]);
      // const k = parseState.parseInt(ary[4]);
      return {skipCount: 0};
    }

    case 5: {  // Color palette index.
      // If we're short on args, assume this sequence is corrupted, so don't
      // eat anything more.
      if (ary.length < 2) {
        return {skipCount: 0};
      }

      // Support 38:5:P (ISO 8613-6) and 38;5;P (xterm/legacy).
      // We also ignore extra args with 38:5:P:[...], but more for laziness.
      const ret = {
        skipCount: usedSubargs ? 0 : 2,
      };
      const color = parseState.parseInt(ary[1]);
      if (color < lib.colors.stockPalette.length) {
        ret.color = color;
      }
      return ret;
    }
  }
};

/**
 * Character Attributes (SGR).
 *
 * Iterate through the list of arguments, applying the attribute changes based
 * on the argument value...
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState
 */
hterm.VT.CSI['m'] = function(parseState) {
  const attrs = this.terminal.getTextAttributes();

  if (!parseState.args.length) {
    attrs.reset();
    return;
  }

  for (let i = 0; i < parseState.args.length; i++) {
    // If this argument has subargs (i.e. it has args followed by colons),
    // the iarg logic will implicitly truncate that off for us.
    const arg = parseState.iarg(i, 0);

    if (arg < 30) {
      if (arg == 0) {  // Normal (default).
        attrs.reset();
      } else if (arg == 1) {  // Bold.
        attrs.bold = true;
      } else if (arg == 2) {  // Faint.
        attrs.faint = true;
      } else if (arg == 3) {  // Italic.
        attrs.italic = true;
      } else if (arg == 4) {  // Underline.
        if (parseState.argHasSubargs(i)) {
          const uarg = parseState.args[i].split(':')[1];
          if (uarg == 0) {
            attrs.underline = false;
          } else if (uarg == 1) {
            attrs.underline = 'solid';
          } else if (uarg == 2) {
            attrs.underline = 'double';
          } else if (uarg == 3) {
            attrs.underline = 'wavy';
          } else if (uarg == 4) {
            attrs.underline = 'dotted';
          } else if (uarg == 5) {
            attrs.underline = 'dashed';
          }
        } else {
          attrs.underline = 'solid';
        }
      } else if (arg == 5) {  // Blink.
        attrs.blink = true;
      } else if (arg == 7) {  // Inverse.
        attrs.inverse = true;
      } else if (arg == 8) {  // Invisible.
        attrs.invisible = true;
      } else if (arg == 9) {  // Crossed out.
        attrs.strikethrough = true;
      } else if (arg == 21) {  // Double underlined.
        attrs.underline = 'double';
      } else if (arg == 22) {  // Not bold & not faint.
        attrs.bold = false;
        attrs.faint = false;
      } else if (arg == 23) {  // Not italic.
        attrs.italic = false;
      } else if (arg == 24) {  // Not underlined.
        attrs.underline = false;
      } else if (arg == 25) {  // Not blink.
        attrs.blink = false;
      } else if (arg == 27) {  // Steady.
        attrs.inverse = false;
      } else if (arg == 28) {  // Visible.
        attrs.invisible = false;
      } else if (arg == 29) {  // Not crossed out.
        attrs.strikethrough = false;
      }

    } else if (arg < 50) {
      // Select fore/background color from bottom half of 16 color palette
      // or from the 256 color palette or alternative specify color in fully
      // qualified rgb(r, g, b) form.
      if (arg < 38) {
        attrs.foregroundSource = arg - 30;

      } else if (arg == 38) {
        const result = this.parseSgrExtendedColors(parseState, i, attrs);
        if (result.color !== undefined) {
          attrs.foregroundSource = result.color;
        }
        i += result.skipCount;

      } else if (arg == 39) {
        attrs.foregroundSource = attrs.SRC_DEFAULT;

      } else if (arg < 48) {
        attrs.backgroundSource = arg - 40;

      } else if (arg == 48) {
        const result = this.parseSgrExtendedColors(parseState, i, attrs);
        if (result.color !== undefined) {
          attrs.backgroundSource = result.color;
        }
        i += result.skipCount;

      } else {
        attrs.backgroundSource = attrs.SRC_DEFAULT;
      }

    } else if (arg == 58) {  // Underline coloring.
      const result = this.parseSgrExtendedColors(parseState, i, attrs);
      if (result.color !== undefined) {
        attrs.underlineSource = result.color;
      }
      i += result.skipCount;

    } else if (arg == 59) {  // Disable underline coloring.
      attrs.underlineSource = attrs.SRC_DEFAULT;

    } else if (arg >= 90 && arg <= 97) {
      attrs.foregroundSource = arg - 90 + 8;

    } else if (arg >= 100 && arg <= 107) {
      attrs.backgroundSource = arg - 100 + 8;
    }
  }

  attrs.syncColors();
};

// SGR calls can handle subargs.
hterm.VT.CSI['m'].supportsSubargs = true;

/**
 * Set xterm-specific keyboard modes.
 *
 * Will not implement.
 */
hterm.VT.CSI['>m'] = hterm.VT.ignore;

/**
 * Device Status Report (DSR, DEC Specific).
 *
 * 5 - Status Report. Result (OK) is CSI 0 n
 * 6 - Report Cursor Position (CPR) [row;column]. Result is CSI r ; c R
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState
 */
hterm.VT.CSI['n'] = function(parseState) {
  if (parseState.args[0] == 5) {
    this.terminal.io.sendString('\x1b0n');
  } else if (parseState.args[0] == 6) {
    const row = this.terminal.getCursorRow() + 1;
    const col = this.terminal.getCursorColumn() + 1;
    this.terminal.io.sendString('\x1b[' + row + ';' + col + 'R');
  }
};

/**
 * Disable modifiers which may be enabled via CSI['>m'].
 *
 * Will not implement.
 */
hterm.VT.CSI['>n'] = hterm.VT.ignore;

/**
 * Device Status Report (DSR, DEC Specific).
 *
 * 6  - Report Cursor Position (CPR) [row;column] as CSI ? r ; c R
 * 15 - Report Printer status as CSI ? 1 0 n (ready) or
 *      CSI ? 1 1 n (not ready).
 * 25 - Report UDK status as CSI ? 2 0 n (unlocked) or CSI ? 2 1 n (locked).
 * 26 - Report Keyboard status as CSI ? 2 7 ; 1 ; 0 ; 0 n (North American).
 *      The last two parameters apply to VT400 & up, and denote keyboard ready
 *      and LK01 respectively.
 * 53 - Report Locator status as CSI ? 5 3 n Locator available, if compiled-in,
 *      or CSI ? 5 0 n No Locator, if not.
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState
 */
hterm.VT.CSI['?n'] = function(parseState) {
  if (parseState.args[0] == 6) {
    const row = this.terminal.getCursorRow() + 1;
    const col = this.terminal.getCursorColumn() + 1;
    this.terminal.io.sendString('\x1b[' + row + ';' + col + 'R');
  } else if (parseState.args[0] == 15) {
    this.terminal.io.sendString('\x1b[?11n');
  } else if (parseState.args[0] == 25) {
    this.terminal.io.sendString('\x1b[?21n');
  } else if (parseState.args[0] == 26) {
    this.terminal.io.sendString('\x1b[?12;1;0;0n');
  } else if (parseState.args[0] == 53) {
    this.terminal.io.sendString('\x1b[?50n');
  }
};

/**
 * This is used by xterm to decide whether to hide the pointer cursor as the
 * user types.
 *
 * Valid values for the parameter:
 *   0 - Never hide the pointer.
 *   1 - Hide if the mouse tracking mode is not enabled.
 *   2 - Always hide the pointer.
 *
 * If no parameter is given, xterm uses the default, which is 1.
 *
 * Not currently implemented.
 */
hterm.VT.CSI['>p'] = hterm.VT.ignore;

/**
 * Soft terminal reset (DECSTR).
 *
 * @this {!hterm.VT}
 */
hterm.VT.CSI['!p'] = function() {
  this.terminal.softReset();
};

/**
 * Request ANSI Mode (DECRQM).
 *
 * Not currently implemented.
 */
hterm.VT.CSI['$p'] = hterm.VT.ignore;
hterm.VT.CSI['?$p'] = hterm.VT.ignore;

/**
 * Set conformance level (DECSCL).
 *
 * Not currently implemented.
 */
hterm.VT.CSI['"p'] = hterm.VT.ignore;

/**
 * Load LEDs (DECLL).
 *
 * Not currently implemented.  Could be implemented as virtual LEDs overlaying
 * the terminal if anyone cares.
 */
hterm.VT.CSI['q'] = hterm.VT.ignore;

/**
 * Set cursor style (DECSCUSR, VT520).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState
 */
hterm.VT.CSI[' q'] = function(parseState) {
  const arg = parseState.args[0];

  if (arg == 0 || arg == 1) {
    this.terminal.setCursorShape(hterm.Terminal.cursorShape.BLOCK);
    this.terminal.setCursorBlink(true);
  } else if (arg == 2) {
    this.terminal.setCursorShape(hterm.Terminal.cursorShape.BLOCK);
    this.terminal.setCursorBlink(false);
  } else if (arg == 3) {
    this.terminal.setCursorShape(hterm.Terminal.cursorShape.UNDERLINE);
    this.terminal.setCursorBlink(true);
  } else if (arg == 4) {
    this.terminal.setCursorShape(hterm.Terminal.cursorShape.UNDERLINE);
    this.terminal.setCursorBlink(false);
  } else if (arg == 5) {
    this.terminal.setCursorShape(hterm.Terminal.cursorShape.BEAM);
    this.terminal.setCursorBlink(true);
  } else if (arg == 6) {
    this.terminal.setCursorShape(hterm.Terminal.cursorShape.BEAM);
    this.terminal.setCursorBlink(false);
  } else {
    console.warn('Unknown cursor style: ' + arg);
  }
};

/**
 * Select character protection attribute (DECSCA).
 *
 * Will not implement.
 */
hterm.VT.CSI['"q'] = hterm.VT.ignore;

/**
 * Set Scrolling Region (DECSTBM).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState
 */
hterm.VT.CSI['r'] = function(parseState) {
  const args = parseState.args;
  const top = args[0] ? parseInt(args[0], 10) : 0;
  const bottom =
      args[1] ? parseInt(args[1], 10) : this.terminal.screenSize.height;
  // Silently ignore bad args.
  if (top < 0 || bottom > this.terminal.screenSize.height || bottom <= top) {
    return;
  }
  // Convert from 1-based to 0-based with special case for zero.
  this.terminal.setVTScrollRegion(top === 0 ? null : top - 1, bottom - 1);
  this.terminal.setCursorPosition(0, 0);
};

/**
 * Restore DEC Private Mode Values.
 *
 * Will not implement.
 */
hterm.VT.CSI['?r'] = hterm.VT.ignore;

/**
 * Change Attributes in Rectangular Area (DECCARA)
 *
 * Will not implement.
 */
hterm.VT.CSI['$r'] = hterm.VT.ignore;

/**
 * Save cursor (ANSI.SYS)
 *
 * @this {!hterm.VT}
 */
hterm.VT.CSI['s'] = function() {
  this.terminal.saveCursorAndState();
};

/**
 * Save DEC Private Mode Values.
 *
 * Will not implement.
 */
hterm.VT.CSI['?s'] = hterm.VT.ignore;

/**
 * Window manipulation (from dtterm, as well as extensions).
 *
 * Will not implement.
 */
hterm.VT.CSI['t'] = hterm.VT.ignore;

/**
 * Reverse Attributes in Rectangular Area (DECRARA).
 *
 * Will not implement.
 */
hterm.VT.CSI['$t'] = hterm.VT.ignore;

/**
 * Set one or more features of the title modes.
 *
 * Will not implement.
 */
hterm.VT.CSI['>t'] = hterm.VT.ignore;

/**
 * Set warning-bell volume (DECSWBV, VT520).
 *
 * Will not implement.
 */
hterm.VT.CSI[' t'] = hterm.VT.ignore;

/**
 * Restore cursor (ANSI.SYS).
 *
 * @this {!hterm.VT}
 */
hterm.VT.CSI['u'] = function() {
  this.terminal.restoreCursorAndState();
};

/**
 * Set margin-bell volume (DECSMBV, VT520).
 *
 * Will not implement.
 */
hterm.VT.CSI[' u'] = hterm.VT.ignore;

/**
 * Copy Rectangular Area (DECCRA, VT400 and up).
 *
 * Will not implement.
 */
hterm.VT.CSI['$v'] = hterm.VT.ignore;

/**
 * Enable Filter Rectangle (DECEFR).
 *
 * Will not implement.
 */
hterm.VT.CSI['\'w'] = hterm.VT.ignore;

/**
 * Request Terminal Parameters (DECREQTPARM).
 *
 * Not currently implemented.
 */
hterm.VT.CSI['x'] = hterm.VT.ignore;

/**
 * Select Attribute Change Extent (DECSACE).
 *
 * Will not implement.
 */
hterm.VT.CSI['*x'] = hterm.VT.ignore;

/**
 * Fill Rectangular Area (DECFRA), VT420 and up.
 *
 * Will not implement.
 */
hterm.VT.CSI['$x'] = hterm.VT.ignore;

/**
 * vt_tiledata (as used by NAOhack and UnNetHack)
 * (see https://nethackwiki.com/wiki/Vt_tiledata for more info)
 *
 * Implemented as far as we care (start a glyph and end a glyph).
 *
 * @this {!hterm.VT}
 * @param {!hterm.VT.ParseState} parseState
 */
hterm.VT.CSI['z'] = function(parseState) {
  if (parseState.args.length < 1) {
    return;
  }
  const arg = parseState.args[0];
  if (arg == 0) {
    // Start a glyph (one parameter, the glyph number).
    if (parseState.args.length < 2) {
      return;
    }
    this.terminal.getTextAttributes().tileData = parseState.args[1];
  } else if (arg == 1) {
    // End a glyph.
    this.terminal.getTextAttributes().tileData = null;
  }
};

/**
 * Enable Locator Reporting (DECELR).
 *
 * Not currently implemented.
 */
hterm.VT.CSI['\'z'] = hterm.VT.ignore;

/**
 * Erase Rectangular Area (DECERA), VT400 and up.
 *
 * Will not implement.
 */
hterm.VT.CSI['$z'] = hterm.VT.ignore;

/**
 * Select Locator Events (DECSLE).
 *
 * Not currently implemented.
 */
hterm.VT.CSI['\'{'] = hterm.VT.ignore;

/**
 * Request Locator Position (DECRQLP).
 *
 * Not currently implemented.
 */
hterm.VT.CSI['\'|'] = hterm.VT.ignore;

/**
 * Insert Columns (DECIC), VT420 and up.
 *
 * Will not implement.
 */
hterm.VT.CSI['\'}'] = hterm.VT.ignore;

/**
 * Delete P s Columns (DECDC), VT420 and up.
 *
 * Will not implement.
 */
hterm.VT.CSI['\'~'] = hterm.VT.ignore;
