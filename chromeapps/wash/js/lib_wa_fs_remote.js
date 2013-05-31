// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * A local stand-in for a filesystem entry located across a lib.wa.Channel.
 *
 * You should not construct one of these by hand, instead use the static
 * lib.wa.fs.Remote.create() method.
 */
lib.wa.fs.Remote = function() {
  lib.wa.fs.Entry.call(this);
  this.registerMessages(lib.wa.fs.Remote.on);

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
 * @param {lib.wa.Message} rootReadyMsg An inbound 'ready' message that in
 *     response to an 'open' or 'handshake' message.  This roots the remote
 *     filesystem.
 * @param {string} remotePath The sub-directory of the remote filesystem to
 *     base this Remote on.
 * @param {function(lib.wa.fs.Remote)} onSuccess The function to call on
 *     success.
 * @param {function(lib.wa.Message)} onError The function to call on error.
 */
lib.wa.fs.Remote.create = function(
    rootReadyMsg, remotePath, onSuccess, onError) {
  var remote = new lib.wa.fs.Remote();
  remote.mount(rootReadyMsg, remotePath, onSuccess.bind(null, remote), onError);
};

lib.wa.fs.Remote.prototype = {__proto__: lib.wa.fs.Entry.prototype};

lib.wa.fs.Remote.prototype.isLocal = false;

/**
 * Using the rootReadyMsg as the remote root directory, make this
 * lib.wa.fs.Remote instance a stand-in for the path specified by remotePath.
 *
 * @param {lib.wa.Message} rootReadyMsg A 'ready' message that was the result of
 *     a 'handshake' or 'open' message.
 * @param {string} remotePath The path under rootReadyMsg to mount.
 * @param {function()} onSuccess Called on success.
 * @param {function(lib.wa.Message)} onError Called on error.
 */
lib.wa.fs.Remote.prototype.mount = function(
    rootReadyMsg, remotePath, onSuccess, onError) {
  if (this.readyMsg_ && !this.closeMsg_) {
    onError({name: lib.wa.fs.FS_FILE_EXISTS, arg: remotePath});
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
 * Same effect as lib.wa.fs.Directory.
 */
lib.wa.fs.Remote.prototype.resolvePath = function(path, onSuccess, onError) {
  if (this.closeMsg_) {
    console.warn('Resolve on closed remote');
    onError(lib.wa.error.FS_REMOTE_DISCONNECTED,
            {name: this.closeMsg_.name, arg: this.closeMsg_.arg});
  }

  lib.wa.fs.Remote.create(this.rootReadyMsg_, path, onSuccess, onError);
};

/**
 * Dispatch messages sent to this entry across the channel.
 */
lib.wa.fs.Remote.prototype.dispatchMessage = function(path, msg) {
  if (this.closeMsg_) {
    console.warn('Dispatch to closed remote');
    if (msg.isOpen) {
      msg.closeError(lib.wa.error.FS_REMOTE_DISCONNECTED,
                     {name: this.closeMsg_.name, arg: this.closeMsg_.arg});
    }

    return;
  }

  this.readyMsg_.forward(msg);
};
