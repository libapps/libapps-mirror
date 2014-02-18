// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * A lib.wam.fs.Entry that can be executed.
 *
 * @param {function(lib.wam.Message)} callback The function to invoke when
 *     it's time to execute.  The callback will receive the inbound 'execute'
 *     message as its parameter.
 */
lib.wam.fs.Executable = function(callback) {
  lib.wam.fs.Entry.call(this);
  this.registerMessages(lib.wam.fs.Executable.on);

  this.callback = callback;
};

lib.wam.fs.Executable.prototype = {__proto__: lib.wam.fs.Entry.prototype};

lib.wam.fs.Executable.prototype.type = lib.wam.fs.entryType.EXECUTABLE;

/**
 * Message handlers reachable via lib.wam.fs.Entry.prototype.dispatchMessage.
 */
lib.wam.fs.Executable.on = {};

lib.wam.fs.Executable.on['execute'] = function(execMsg) {
  execMsg.replyReady(null);
  this.callback.call(this, execMsg, this);
};
