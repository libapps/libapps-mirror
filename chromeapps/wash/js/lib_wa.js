// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.wa = {};

lib.wa.error = {
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
  UNEXPECTED_MESSAGE: 'UNEXPECTED_MESSAGE',
  UNKNOWN_SUBJECT: 'UNKNOWN_SUBJECT',
  MISSING_PARAM: 'MISSING_PARAM',
  INVALID_PARAM: 'INVALID_PARAM',
  CHANNEL_DISCONNECT: 'CHANNEL_DISCONNECT',

  // TODO(rginda): Originally these had the FS_ prefix as a namespace, but
  // that doesn't look right when displaying the error values directly on the
  // terminal.
  //
  // Eventually we'll need something better for displaying errors, but for now
  // the values doen't have the FS_ prefix, even though the identifiers do.
  FS_NO_FILESYSTEM: 'NO_FILESYSTEM',
  FS_REMOTE_DISCONNECTED: 'REMOTE_DISCONNECTED',
  FS_NOT_FOUND: 'NOT_FOUND',
  FS_NOT_LOCAL: 'NOT_LOCAL',
  FS_NOT_A_DIRECTORY: 'NOT_A_DIRECTORY',
  FS_NOT_AN_EXECUTABLE: 'NOT_AN_EXECUTABLE',
  FS_INVALID_PATH: 'INVALID_PATH',
  FS_UNKNOWN_OPERATION: 'UNKNOWN_OPERATION',
  FS_INVALID_OPERATION: 'INVALID_OPERATION',
  FS_FILE_EXISTS: 'FILE_EXISTS'
};

/**
 * Make a globally unique id.
 *
 * TODO(rginda) We probably don't need to use crypto entropy for this.
 */
lib.wa.guid = function() {
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
