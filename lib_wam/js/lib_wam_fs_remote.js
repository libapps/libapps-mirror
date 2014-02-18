// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * A local stand-in for a filesystem entry located across a lib.wam.Channel.
 *
 * You should not construct one of these by hand, instead use the static
 * lib.wam.fs.Remote.create() method.
 */
lib.wam.fs.Remote = function() {
  lib.wam.fs.Entry.call(this);
  this.registerMessages(lib.wam.fs.Remote.on);

  // Any ready reply that points to a remote directory ('handshake' ready, or
  // 'open' ready).
  this.rootReadyMsg_ = null;

  // The path on the remote filesystem to mount.
  this.remotePath_ = null;

  // The 'ready' message we got when we opened the remote path.
  this.readyMsg_ = null;

  // The message that closed out the readyMsg.
  this.closeMsg_ = null;

  // The type of this file as reported by the remote filesystem.
  this.type = null;
};

/**
 * Create a new Remote object.
 *
 * @param {lib.wam.Message} rootReadyMsg An inbound 'ready' message that in
 *     response to an 'open' or 'handshake' message.  This roots the remote
 *     filesystem.
 * @param {string} remotePath The sub-directory of the remote filesystem to
 *     base this Remote on.
 * @param {function(lib.wam.fs.Remote)} onSuccess The function to call on
 *     success.
 * @param {function(lib.wam.Message)} onError The function to call on error.
 */
lib.wam.fs.Remote.create = function(
    rootReadyMsg, remotePath, onSuccess, onError) {
  var remote = new lib.wam.fs.Remote();
  remote.mount(rootReadyMsg, remotePath, onSuccess.bind(null, remote), onError);
};

lib.wam.fs.Remote.prototype = {__proto__: lib.wam.fs.Entry.prototype};

lib.wam.fs.Remote.prototype.isLocal = false;

/**
 * Using the rootReadyMsg as the remote root directory, make this
 * lib.wam.fs.Remote instance a stand-in for the path specified by remotePath.
 *
 * @param {lib.wam.Message} rootReadyMsg A 'ready' message that was the result
 *     of a 'handshake' or 'open' message.
 * @param {string} remotePath The path under rootReadyMsg to mount.
 * @param {function()} onSuccess Called on success.
 * @param {function(lib.wam.Message)} onError Called on error.
 */
lib.wam.fs.Remote.prototype.mount = function(
    rootReadyMsg, remotePath, onSuccess, onError) {
  if (this.readyMsg_ && !this.closeMsg_) {
    onError({name: lib.wam.fs.error.FILE_EXISTS, arg: remotePath});
    return;
  }

  this.rootReadyMsg_ = rootReadyMsg;
  this.remotePath_ = remotePath;

  this.readyMsg_ = null;
  this.closeMsg_ = null;

  var openMsg = rootReadyMsg.waitReady
  ('open', {path: remotePath},
   function(msg) {
     if (msg.name == 'ready') {
       this.readyMsg_ = msg;
       this.type = msg.arg.type;
       msg.parent.onClose.addListener(function(msg) {
           console.log('Remote disconnected');
         }.bind(this));

       onSuccess();
     } else if (msg.isFinalReply) {
       this.closeMsg_ = msg;
     }
   }.bind(this),
   onError);
};

/**
 * Same effect as lib.wam.fs.Directory.
 */
lib.wam.fs.Remote.prototype.resolvePath = function(path, onSuccess, onError) {
  if (this.closeMsg_) {
    console.warn('Resolve on closed remote');
    onError(lib.wam.fs.error.REMOTE_DISCONNECTED,
            {name: this.closeMsg_.name, arg: this.closeMsg_.arg});
  }

  lib.wam.fs.Remote.create(this.rootReadyMsg_, path, onSuccess, onError);
};

/**
 * Dispatch messages sent to this entry across the channel.
 */
lib.wam.fs.Remote.prototype.dispatchMessage = function(path, msg) {
  if (this.closeMsg_) {
    console.warn('Dispatch to closed remote');
    if (msg.isOpen) {
      msg.closeError(lib.wam.fs.error.REMOTE_DISCONNECTED,
                     {name: this.closeMsg_.name, arg: this.closeMsg_.arg});
    }

    return;
  }

  this.readyMsg_.forward(msg);
};
