// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.rtdep('lib.hterm.Termcap');

/**
 * A partial clone of GNU readline.
 *
 * Can be called directly, or used as a lib.wa.fs.Executable.
 */
lib.wa.Readline = function(onSend, opt_tc) {
  this.onSendCallback_ = onSend;

  this.line = '';
  this.linePosition = 0;

  // Cursor position when the read() started.
  this.cursorHome_ = null;

  // Cursor position after printing the prompt.
  this.cursorPrompt_ = null;

  this.onCompleteCallback_ = null;

  this.verbose = false;

  this.nextUndoIndex_ = 0;
  this.undo_ = [['', 0]];

  this.killRing_ = [];

  this.historyIndex_ = 0;
  this.history_ = [];

  this.promptString_ = '';
  this.promptVars_ = null;

  this.previousLineHeight_ = 0;

  this.pendingESC_ = false;

  this.tc_ = opt_tc || new lib.hterm.Termcap();

  this.rows = 0;
  this.columns = 0;

  this.bindings = {};
  this.addBindings(lib.wa.Readline.defaultBindings);
};

lib.wa.Readline.main = function(app, execMsg) {
  if (typeof execMsg.arg != 'object' ||
      !('promptString' in execMsg.arg.argv)) {
    execMsg.closeError(lib.wa.error.MISSING_PARAM, 'promptString');
    return;
  }

  if (!lib.wa.Readline.tc_)
    lib.wa.Readline.tc_ = new lib.hterm.Termcap();

  var rl = new lib.wa.Readline(execMsg.reply.bind(execMsg),
                               lib.wa.Readline.tc_);

  rl.setPrompt(execMsg.arg.argv.promptString || '', {});

  // TODO(rginda): better history management.
  if (!lib.wa.Readline.history_)
    lib.wa.Readline.history_ = [];
  rl.history_ = lib.wa.Readline.history_;

  execMsg.meta.onInput.addListener(function(msg) {
      rl.dispatchMessage(msg);
    });

  rl.read(function(line) {
      execMsg.closeOk(line);
    });
};

/**
 * Default mapping of key sequence to readline commands.
 *
 * Uses lib.hterm.Termcap syntax for the keys.
 */
lib.wa.Readline.defaultBindings = {
  '%(BACKSPACE)': 'backward-delete-char',
  '%(ENTER)': 'accept-line',

  '%(LEFT)': 'backward-char',
  '%(RIGHT)': 'forward-char',

  '%(UP)': 'previous-history',
  '%(DOWN)': 'next-history',

  '%(HOME)': 'beginning-of-line',
  '%(END)': 'end-of-line',
  '%(DELETE)': 'delete-char',

  '%ctrl("A")': 'beginning-of-line',
  '%ctrl("D")': 'delete-char',
  '%ctrl("E")': 'end-of-line',
  '%ctrl("H")': 'backward-delete-char',
  '%ctrl("K")': 'kill-line',
  '%ctrl("L")': 'redraw-line',
  '%ctrl("N")': 'next-history',
  '%ctrl("P")': 'previous-history',
  '%ctrl("Y")': 'yank',
  '%ctrl("_")': 'undo',
  '%ctrl("/")': 'undo',

  '%ctrl(LEFT)': 'backward-word',
  '%ctrl(RIGHT)': 'forward-word',

  // Meta and key at the same time.
  '%meta(BACKSPACE)': 'backward-kill-word',
  '%meta(DELETE)': 'kill-word',
  '%meta(">")': 'end-of-history',
  '%meta("<")': 'beginning-of-history',

  // Meta, then key.
  //
  // TODO(rginda): This would be better as a nested binding, like...
  //   '%(META)': { '%(DELETE)': 'kill-word', ... }
  // ...which would also allow provide for C-c and M-x multi key sequences.
  '%(META)%(DELETE)': 'kill-word',
  '%(META).': 'yank-last-arg',
};

/**
 * Read a line of input.
 *
 * Prints the given prompt, and waits while the user edits a line of text.
 * Provides editing functionality through the keys specified in defaultBindings.
 *
 * @param {function(string)} onComplete The function to invoke when the user
 *     presses ENTER.
 */
lib.wa.Readline.prototype.read = function(onComplete) {
  if (this.isBusy)
    throw new Error('read() already pending');

  this.isBusy = true;

  this.line = this.history_[0] = '';
  this.linePosition = 0;

  this.nextUndoIndex_ = 0;
  this.undo_ = [['', 0]];

  this.cursorHome_ = null;
  this.cursorPrompt_ = null;

  this.previousLineHeight_ = 0;

  this.onCompleteCallback_ = onComplete;

  this.send('isatty', null, function(msg) {
      msg.parent.close();

      if (msg.name != 'ok') {
        console.warn('lib.wa.Readline: Not connected to a tty');
        onComplete(null);
        return;
      }

      this.rows = msg.arg.rows;
      this.columns = msg.arg.columns;

      this.print('%get-row-column()');
    }.bind(this));
};

/**
 * Find the start of the word under linePosition in the given line.
 */
lib.wa.Readline.getWordStart = function(line, linePosition) {
  var left = line.substr(0, linePosition);

  var searchEnd = left.search(/[a-z0-9][^a-z0-9]*$/i);
  left = left.substr(0, searchEnd);

  var wordStart = left.search(/[^a-z0-9][a-z0-9]*$/i);
  return (wordStart > 0) ? wordStart + 1 : 0;
};

/**
 * Find the end of the word under linePosition in the given line.
 */
lib.wa.Readline.getWordEnd = function(line, linePosition) {
  var right = line.substr(linePosition);

  var searchStart = right.search(/[a-z0-9]/i);
  right = right.substr(searchStart);

  var wordEnd = right.search(/[^a-z0-9]/i);

  if (wordEnd == -1)
    return line.length;

  return linePosition + searchStart + wordEnd;
};

/**
 * Register multiple key bindings.
 */
lib.wa.Readline.prototype.addBindings = function(obj) {
  for (var key in obj) {
    this.addBinding(key, obj[key]);
  }
};

/**
 * Register a single key binding.
 */
lib.wa.Readline.prototype.addBinding = function(str, commandName) {
  this.addRawBinding(this.tc_.input(str), commandName);
};

/**
 * Register a binding without passing through termcap.
 */
lib.wa.Readline.prototype.addRawBinding = function(bytes, commandName) {
  this.bindings[bytes] = commandName;
};

lib.wa.Readline.prototype.print = function(str, opt_vars) {
  this.send('strout', this.tc_.output(str, opt_vars || {}));
}

/**
 * Send a message back to the thing that executed us.
 */
lib.wa.Readline.prototype.send = function(name, arg, opt_onReply) {
  if (!this.isBusy)
    throw new Error('Not busy');

  this.onSendCallback_(name, arg, opt_onReply);
};

lib.wa.Readline.prototype.setPrompt = function(str, vars) {
  this.promptString_ = str;
  this.promptVars_ = vars;

  this.cursorPrompt_ = null;

  if (this.isBusy)
    this.dispatch('redraw-line');
};

lib.wa.Readline.prototype.dispatch = function(name, arg) {
  this.commands[name].call(this, arg);
};

/**
 * Instance method version of getWordStart.
 */
lib.wa.Readline.prototype.getWordStart = function() {
  return lib.wa.Readline.getWordStart(this.line, this.linePosition);
};

/**
 * Instance method version of getWordEnd.
 */
lib.wa.Readline.prototype.getWordEnd = function() {
  return lib.wa.Readline.getWordEnd(this.line, this.linePosition);
};

lib.wa.Readline.prototype.killSlice = function(start, length) {
  if (length == -1)
    length = this.line.length - start;

  var killed = this.line.substr(start, length);
  this.killRing_.unshift(killed);

  this.line = (this.line.substr(0, start) + this.line.substr(start + length));
};

lib.wa.Readline.prototype.dispatchMessage = function(msg) {
  msg.dispatch(this, lib.wa.Readline.on);
};

/**
 * Called when the terminal replys with the current cursor position.
 */
lib.wa.Readline.prototype.onCursorReport = function(row, column) {
  if (!this.cursorHome_) {
    this.cursorHome_ = {row: row, column: column};
    this.dispatch('redraw-line');
    return;
  }

  if (!this.cursorPrompt_) {
    this.cursorPrompt_ = {row: row, column: column};
    if (this.cursorHome_.row == this.cursorPrompt_.row) {
      this.promptLength_ =
          this.cursorPrompt_.column - this.cursorHome_.column;
    } else {
      var top = this.columns - this.cursorPrompt_.column;
      var bottom = this.cursorHome_.column;
      var middle = this.columns * (this.cursorPrompt_.row -
                                   this.cursorHome_.row);
      this.promptLength_ = top + middle + bottom;
    }

    this.dispatch('redraw-line');
    return;
  }

  console.warn('Unexpected cursor position report: ' + string);
  return;
};

/**
 * Messages we want to act on.
 */
lib.wa.Readline.on = {};

lib.wa.Readline.on['tty-resize'] = function(msg) {
  this.rows = msg.arg.rows;
  this.columns = msg.arg.columns;
};

lib.wa.Readline.on['strin'] = function(msg) {
  var string = msg.arg;

  var ary = string.match(/^\x1b\[(\d+);(\d+)R$/);
  if (ary) {
    this.onCursorReport(parseInt(ary[1]), parseInt(ary[2]));
    return;
  }

  if (string == '\x1b') {
    this.pendingESC_ = true;
    return;
  }

  if (this.pendingESC_) {
    string = '\x1b' + string;
    this.pendingESC_ = false;
  }

  var commandName = this.bindings[string];

  if (commandName) {
    if (this.verbose)
      console.log('dispatch: ' + JSON.stringify(string) + ' => ' + commandName);

    if (!(commandName in this.commands)) {
      throw new Error('Unknown command "' + commandName + '", bound to: ' +
                      string);
    }

    var previousLine = this.line;
    var previousPosition = this.linePosition;

    if (commandName != 'undo')
      this.nextUndoIndex_ = 0;

    this.dispatch(commandName, string);

    if (previousLine != this.line && previousLine != this.undo_[0][0])
      this.undo_.unshift([previousLine, previousPosition]);

  } else if (/^[\x20-\xff]+$/.test(string)) {
    this.nextUndoIndex_ = 0;
    this.commands['self-insert'].call(this, string);
  } else {
    console.log('unhandled: ' + JSON.stringify(string));
  }
};

lib.wa.Readline.prototype.commands = {};

lib.wa.Readline.prototype.commands['redraw-line'] = function(string) {
  if (!this.cursorHome_) {
    console.warn('readline: Home cursor position unknown, won\'t redraw.');
    return;
  }

  if (!this.cursorPrompt_) {
    // We don't know where the cursor ends up after printing the prompt.
    // We can't just depend on the string length of the prompt because
    // it may have non-printing escapes.  Instead we echo the prompt and then
    // locate the cursor.
    this.print('%set-row-column(row, column)',
               { row: this.cursorHome_.row,
                 column: this.cursorHome_.column,
               });
    this.print(this.promptString_, this.promptVars_);
    this.print('%get-row-column()');
    return;
  }

  this.print('%set-row-column(row, column)%(line)',
             { row: this.cursorPrompt_.row,
               column: this.cursorPrompt_.column,
               line: this.line
             });

  var totalLineLength = this.cursorHome_.column - 1 + this.promptLength_ +
      this.line.length;
  var totalLineHeight = Math.ceil(totalLineLength / this.columns);
  var additionalLineHeight = totalLineHeight - 1;

  var lastRowFilled = !(totalLineLength % this.columns);
  if (!lastRowFilled)
    this.print('%erase-right()');

  if (totalLineHeight < this.previousLineHeight_) {
    for (var i = totalLineHeight; i < this.previousLineHeight_; i++) {
      this.print('%set-row-column(row, 1)%erase-right()',
                 {row: this.cursorPrompt_.row + i});
    }
  }

  this.previousLineHeight_ = totalLineHeight;

  if (totalLineLength >= this.columns) {
    // This line overflowed the terminal width.  We need to see if it also
    // overflowed the height causing a scroll that would invalidate our idea
    // of the cursor home row.
    var scrollCount;

    if (this.cursorHome_.row + additionalLineHeight == this.rows &&
        lastRowFilled) {
      // The line was exactly long enough to fill the terminal width and
      // and height.  Insert a newline to hold the new cursor position.
      this.print('\n');
      scrollCount = 1;
    } else {
      scrollCount = this.cursorHome_.row + additionalLineHeight -
          this.rows;
    }

    if (scrollCount > 0) {
      this.cursorPrompt_.row -= scrollCount;
      this.cursorHome_.row -= scrollCount;
    }
  }

  this.dispatch('reposition-cursor');
};

lib.wa.Readline.prototype.commands['reposition-cursor'] = function(string) {
  // Count the number or rows it took to render the current line at the
  // current terminal width.
  var rowOffset = Math.floor((this.cursorPrompt_.column - 1 +
                              this.linePosition) / this.columns);
  var column = (this.cursorPrompt_.column + this.linePosition -
                (rowOffset * this.columns));
  this.print('%set-row-column(row, column)',
             { row: this.cursorPrompt_.row + rowOffset,
               column: column
             });
};

lib.wa.Readline.prototype.commands['self-insert'] = function(string) {
  if (this.linePosition == this.line.length) {
    this.line += string;
  } else {
    this.line = this.line.substr(0, this.linePosition) + string +
        this.line.substr(this.linePosition);
  }

  this.linePosition += string.length;

  this.history_[0] = this.line;

  this.dispatch('redraw-line');
};

lib.wa.Readline.prototype.commands['accept-line'] = function() {
  this.historyIndex_ = 0;
  if (this.line && this.line != this.history_[1])
    this.history_.splice(1, 0, this.line);
  this.print('\r\n');
  this.onComplete_();
};

lib.wa.Readline.prototype.commands['beginning-of-history'] = function() {
  this.historyIndex_ = this.history_.length - 1;
  this.line = this.history_[this.historyIndex_];
  this.linePosition = this.line.length;

  this.dispatch('redraw-line');
};

lib.wa.Readline.prototype.commands['end-of-history'] = function() {
  this.historyIndex_ = this.history_.length - 1;
  this.line = this.history_[this.historyIndex_];
  this.linePosition = this.line.length;

  this.dispatch('redraw-line');
};

lib.wa.Readline.prototype.commands['previous-history'] = function() {
  if (this.historyIndex_ == this.history_.length - 1) {
    this.print('%bell()');
    return;
  }

  this.historyIndex_ += 1;
  this.line = this.history_[this.historyIndex_];
  this.linePosition = this.line.length;

  this.dispatch('redraw-line');
};

lib.wa.Readline.prototype.commands['next-history'] = function() {
  if (this.historyIndex_ == 0) {
    this.print('%bell()');
    return;
  }

  this.historyIndex_ -= 1;
  this.line = this.history_[this.historyIndex_];
  this.linePosition = this.line.length;

  this.dispatch('redraw-line');
};

lib.wa.Readline.prototype.commands['kill-word'] = function() {
  var start = this.linePosition;
  var length =  this.getWordEnd() - start;
  this.killSlice(start, length);

  this.dispatch('redraw-line');
};

lib.wa.Readline.prototype.commands['backward-kill-word'] = function() {
  var start = this.getWordStart();
  var length = this.linePosition - start;
  this.killSlice(start, length);
  this.linePosition = start;

  this.dispatch('redraw-line');
};

lib.wa.Readline.prototype.commands['kill-line'] = function() {
  this.killSlice(this.linePosition, -1);

  this.dispatch('redraw-line');
};

lib.wa.Readline.prototype.commands['yank'] = function() {
  var text = this.killRing_[0];
  this.line = (this.line.substr(0, this.linePosition) +
               text +
               this.line.substr(this.linePosition));
  this.linePosition += text.length;

  this.dispatch('redraw-line');
};

lib.wa.Readline.prototype.commands['yank-last-arg'] = function() {
  if (this.history_.length < 2)
    return;

  var last = this.history_[1];
  var i = lib.wa.Readline.getWordStart(last, last.length - 1);
  if (i != -1)
    this.dispatch('self-insert', last.substr(i));
};

lib.wa.Readline.prototype.commands['delete-char'] = function() {
  if (this.linePosition < this.line.length) {
    this.line = (this.line.substr(0, this.linePosition) +
                 this.line.substr(this.linePosition + 1));
    this.dispatch('redraw-line');
  } else {
    this.print('%bell()');
  }
};

lib.wa.Readline.prototype.commands['backward-delete-char'] = function() {
  if (this.linePosition > 0) {
    this.linePosition -= 1;
    this.line = (this.line.substr(0, this.linePosition) +
                 this.line.substr(this.linePosition + 1));
    this.dispatch('redraw-line');
  } else {
    this.print('%bell()');
  }
};

lib.wa.Readline.prototype.commands['backward-char'] = function() {
  if (this.linePosition > 0) {
    this.linePosition -= 1;
    this.dispatch('reposition-cursor');
  } else {
    this.print('%bell()');
  }
};

lib.wa.Readline.prototype.commands['forward-char'] = function() {
  if (this.linePosition < this.line.length) {
    this.linePosition += 1;
    this.dispatch('reposition-cursor');
  } else {
    this.print('%bell()');
  }
};

lib.wa.Readline.prototype.commands['backward-word'] = function() {
  this.linePosition = this.getWordStart();
  this.dispatch('reposition-cursor');
};


lib.wa.Readline.prototype.commands['forward-word'] = function() {
  this.linePosition = this.getWordEnd();
  this.dispatch('reposition-cursor');
};

lib.wa.Readline.prototype.commands['beginning-of-line'] = function() {
  if (this.linePosition == 0) {
    this.print('%bell()');
    return;
  }

  this.linePosition = 0;
  this.dispatch('reposition-cursor');
};

lib.wa.Readline.prototype.commands['end-of-line'] = function() {
  if (this.linePosition == this.line.length) {
    this.print('%bell()');
    return;
  }

  this.linePosition = this.line.length;
  this.dispatch('reposition-cursor');
};

lib.wa.Readline.prototype.commands['undo'] = function() {
  if ((this.nextUndoIndex_ == this.undo_.length)) {
    this.print('%bell()');
    return;
  }

  this.line = this.undo_[this.nextUndoIndex_][0];
  this.linePosition = this.undo_[this.nextUndoIndex_][1];

  this.dispatch('redraw-line');

  this.nextUndoIndex_ += 2;
};

lib.wa.Readline.prototype.onComplete_ = function() {
  this.isBusy = false;
  var cb = this.onCompleteCallback_;
  this.onCompleteCallback_= null;

  cb(this.line);
};
