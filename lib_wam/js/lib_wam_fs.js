// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.wam.fs = {};

lib.wam.fs.error = {
  NO_FILESYSTEM: 'NO_FILESYSTEM',
  REMOTE_DISCONNECTED: 'REMOTE_DISCONNECTED',
  NOT_FOUND: 'NOT_FOUND',
  NOT_LOCAL: 'NOT_LOCAL',
  NOT_A_DIRECTORY: 'NOT_A_DIRECTORY',
  NOT_AN_EXECUTABLE: 'NOT_AN_EXECUTABLE',
  INVALID_PATH: 'INVALID_PATH',
  UNKNOWN_OPERATION: 'UNKNOWN_OPERATION',
  INVALID_OPERATION: 'INVALID_OPERATION',
  FILE_EXISTS: 'FILE_EXISTS'
};

/**
 * List of possible entry types.
 *
 * This would probably be better as capabilities rather than a hard category.
 */
lib.wam.fs.entryType = {
  DIRECTORY: 'DIR',
  DATA: 'DATA',
  EXECUTABLE: 'EXE'
};

/**
 * Everything after the last slash.
 */
lib.wam.fs.basename = function(path) {
  var pos = path.lastIndexOf('/');
  if (pos >= 0)
    return path.substr(pos + 1);

  return path;
};

/**
 * Everything before the last slash.
 */
lib.wam.fs.dirname = function(path) {
  var pos = path.lastIndexOf('/');
  if (pos >= 0)
    return path.substr(0, pos);

  return '';
};
