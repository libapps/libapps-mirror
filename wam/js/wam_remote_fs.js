// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.remote.fs = {
  protocolName: 'x.wam.FileSystem',
  protocolVersion: '1.0'
};

/**
 * Check to see of the given message is a wam.FileSystem handshake offer.
 *
 * @return {boolean}
 */
wam.remote.fs.testOffer = function(inMessage) {
  if (!inMessage.arg.payload || typeof inMessage.arg.payload != 'object')
    return false;

  var payload = inMessage.arg.payload;
  return (payload.protocol == wam.remote.fs.protocolName &&
          payload.version == wam.remote.fs.protocolVersion);
};

/**
 * Context for a wam.FileSystem handshake request.
 */
wam.remote.fs.mount = function(channel) {
  var handshakeRequest = new wam.remote.fs.handshake.Request(channel);
  handshakeRequest.sendRequest();
  return handshakeRequest.fileSystem;
};
