// Copyright (c) 2014 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

wam.remote.fs = {};

wam.remote.fs.protocolName = 'x.wam.FileSystem';

/**
 * Check to see of the given message is a wam.FileSystem handshake offer.
 *
 * @return {boolean}
 */
wam.remote.fs.testOffer = function(inMessage) {
  if (!wam.changelogVersion)
    throw new Error('Unknown changelog version');

  if (!inMessage.arg.payload || typeof inMessage.arg.payload != 'object')
    return false;

  var payload = inMessage.arg.payload;
  if (payload.protocol != wam.remote.fs.protocolName)
    return false;

  var pos = wam.changelogVersion.indexOf('.');
  var expectedMajor = wam.changelogVersion.substr(0, pos);

  pos = payload.version.indexOf('.');
  var offeredMajor = payload.version.substr(0, pos);

  return (expectedMajor == offeredMajor);
};

/**
 * Context for a wam.FileSystem handshake request.
 */
wam.remote.fs.mount = function(channel) {
  var handshakeRequest = new wam.remote.fs.handshake.Request(channel);
  handshakeRequest.sendRequest();
  return handshakeRequest.fileSystem;
};
