// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * Input/Output interface used by commands to communicate with the terminal.
 *
 * Commands like `nassh` and `crosh` receive an instance of this class as
 * part of their argv object.  This allows them to write to and read from the
 * terminal without exposing them to an entire hterm.Terminal instance.
 *
 * The active command must override the onVTKeystroke() and sendString() methods
 * of this class in order to receive keystrokes and send output to the correct
 * destination.
 *
 * Isolating commands from the terminal provides the following benefits:
 * - Provides a mechanism to save and restore onVTKeystroke and sendString
 *   handlers when invoking subcommands (see the push() and pop() methods).
 * - The isolation makes it easier to make changes in Terminal and supporting
 *   classes without affecting commands.
 * - In The Future commands may run in web workers where they would only be able
 *   to talk to a Terminal instance through an IPC mechanism.
 *
 * @param {!hterm.Terminal} terminal
 * @constructor
 */
hterm.Terminal.IO = function(terminal) {
  this.terminal_ = terminal;

  // The IO object to restore on IO.pop().
  this.previousIO_ = null;

  // Any data this object accumulated while not active.
  this.buffered_ = '';

  // Decoder to maintain UTF-8 decode state.
  this.textDecoder_ = new TextDecoder();
};

/**
 * Show the terminal overlay.
 *
 * @see hterm.NotificationCenter.show
 * @param {string|!Node} message The message to display.
 * @param {?number=} timeout How long to time to wait before hiding.
 */
hterm.Terminal.IO.prototype.showOverlay = function(
    message, timeout = undefined) {
  this.terminal_.showOverlay(message, timeout);
};

/**
 * Hide the current overlay immediately.
 *
 * @see hterm.NotificationCenter.hide
 */
hterm.Terminal.IO.prototype.hideOverlay = function() {
  this.terminal_.hideOverlay();
};

/**
 * Open an frame in the current terminal window, pointed to the specified
 * url.
 *
 * Eventually we'll probably need size/position/decoration options.
 * The user should also be able to move/resize the frame.
 *
 * @param {string} url The URL to load in the frame.
 * @param {!Object=} options Optional frame options.  Not implemented.
 * @return {!hterm.Frame}
 */
hterm.Terminal.IO.prototype.createFrame = function(url, options = undefined) {
  return new hterm.Frame(this.terminal_, url, options);
};

/**
 * Change the preference profile for the terminal.
 *
 * @param {string} profileName The name of the preference profile to activate.
 */
hterm.Terminal.IO.prototype.setTerminalProfile = function(profileName) {
  this.terminal_.setProfile(profileName);
};

/**
 * Create a new hterm.Terminal.IO instance and make it active on the Terminal
 * object associated with this instance.
 *
 * This is used to pass control of the terminal IO off to a subcommand.  The
 * IO.pop() method can be used to restore control when the subcommand completes.
 *
 * @return {!hterm.Terminal.IO} The new foreground IO instance.
 */
hterm.Terminal.IO.prototype.push = function() {
  const io = new hterm.Terminal.IO(this.terminal_);
  io.keyboardCaptured_ = this.keyboardCaptured_;

  io.columnCount = this.columnCount;
  io.rowCount = this.rowCount;

  io.previousIO_ = this.terminal_.io;
  this.terminal_.io = io;

  return io;
};

/**
 * Restore the Terminal's previous IO object.
 *
 * We'll flush out any queued data.
 */
hterm.Terminal.IO.prototype.pop = function() {
  this.terminal_.io = this.previousIO_;
  this.previousIO_.flush();
};

/**
 * Flush accumulated data.
 *
 * If we're not the active IO, the connected process might still be writing
 * data to us, but we won't be displaying it.  Flush any buffered data now.
 */
hterm.Terminal.IO.prototype.flush = function() {
  if (this.buffered_) {
    this.terminal_.interpret(this.buffered_);
    this.buffered_ = '';
  }
};

/**
 * Called when data needs to be sent to the current command.
 *
 * Clients should override this to receive notification of pending data.
 *
 * @param {string} string The data to send.
 */
hterm.Terminal.IO.prototype.sendString = function(string) {
  // Override this.
  console.log('Unhandled sendString: ' + string);
};

/**
 * Called when a terminal keystroke is detected.
 *
 * Clients should override this to receive notification of keystrokes.
 *
 * @param {string} string The VT key sequence.
 */
hterm.Terminal.IO.prototype.onVTKeystroke = function(string) {
  // Override this.
  console.log('Unobserverd VT keystroke: ' + JSON.stringify(string));
};

/**
 * Receives notification when the terminal is resized.
 *
 * @param {number} width The new terminal width.
 * @param {number} height The new terminal height.
 */
hterm.Terminal.IO.prototype.onTerminalResize_ = function(width, height) {
  let obj = this;
  while (obj) {
    obj.columnCount = width;
    obj.rowCount = height;
    obj = obj.previousIO_;
  }

  this.onTerminalResize(width, height);
};

/**
 * Called when terminal size is changed.
 *
 * Clients should override this to receive notification of resize.
 *
 * @param {string|number} width The new terminal width.
 * @param {string|number} height The new terminal height.
 */
hterm.Terminal.IO.prototype.onTerminalResize = function(width, height) {
  // Override this.
};

/**
 * Write UTF-8 data to the terminal.
 *
 * @param {!ArrayBuffer|!Array<number>} buffer The UTF-8 data to print.
 */
hterm.Terminal.IO.prototype.writeUTF8 = function(buffer) {
  // Handle array buffers & typed arrays by normalizing into a typed array.
  const u8 = new Uint8Array(buffer);
  const string = this.textDecoder_.decode(u8, {stream: true});
  this.print(string);
};

/**
 * Write UTF-8 data to the terminal followed by CRLF.
 *
 * @param {!ArrayBuffer|!Array<number>} buffer The UTF-8 data to print.
 */
hterm.Terminal.IO.prototype.writelnUTF8 = function(buffer) {
  this.writeUTF8(buffer);
  // We need to use writeUTF8 to make sure we flush the decoder state.
  this.writeUTF8([0x0d, 0x0a]);
};

/**
 * Write a UTF-16 JavaScript string to the terminal.
 *
 * @param {string} string The string to print.
 */
hterm.Terminal.IO.prototype.print =
hterm.Terminal.IO.prototype.writeUTF16 = function(string) {
  // If another process has the foreground IO, buffer new data sent to this IO
  // (since it's in the background).  When we're made the foreground IO again,
  // we'll flush everything.
  if (this.terminal_.io != this) {
    this.buffered_ += string;
    return;
  }

  this.terminal_.interpret(string);
};

/**
 * Print a UTF-16 JavaScript string to the terminal followed by a newline.
 *
 * @param {string} string The string to print.
 */
hterm.Terminal.IO.prototype.println =
hterm.Terminal.IO.prototype.writelnUTF16 = function(string) {
  this.print(string + '\r\n');
};
