// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * A lib.wa.fs.Entry that can be executed.
 *
 * @param {function(lib.wa.Message)} callback The function to invoke when
 *     it's time to execute.  The callback will receive the inbound 'execute'
 *     message as its parameter.
 */
lib.wa.fs.Executable = function(callback) {
  lib.wa.fs.Entry.call(this);
  this.registerMessages(lib.wa.fs.Executable.on);

  this.callback = callback;
};

lib.wa.fs.Executable.prototype = {__proto__: lib.wa.fs.Entry.prototype};

lib.wa.fs.Executable.prototype.type = lib.wa.fs.entryType.EXECUTABLE;

/**
 * Message handlers reachable via lib.wa.fs.Entry.prototype.dispatchMessage.
 */
lib.wa.fs.Executable.on = {};

lib.wa.fs.Executable.on['execute'] = function(execMsg) {
  execMsg.replyReady(null);
  this.callback.call(this, execMsg, this);
};
