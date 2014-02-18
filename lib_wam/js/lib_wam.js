// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.wam = {};

lib.wam.error = {
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
  UNEXPECTED_MESSAGE: 'UNEXPECTED_MESSAGE',
  UNKNOWN_SUBJECT: 'UNKNOWN_SUBJECT',
  MISSING_PARAM: 'MISSING_PARAM',
  INVALID_PARAM: 'INVALID_PARAM',
  CHANNEL_DISCONNECT: 'CHANNEL_DISCONNECT',
};

/**
 * Make a globally unique id.
 *
 * TODO(rginda) We probably don't need to use crypto entropy for this.
 */
lib.wam.guid = function() {
  var ary = new Uint8Array(16)
  window.crypto.getRandomValues(ary);

  var rv = '';
  for (var i = 0; i < ary.length; i++) {
    var byte = ary[i].toString(16);
    if (byte.length == 2) {
      rv += byte;
    } else {
      rv += '0' + byte;
    }
  }

  return rv;
};
