// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

lib.wa.fs = {};

/**
 * List of possible entry types.
 *
 * This would probably be better as capabilities rather than a hard category.
 */
lib.wa.fs.entryType = {
  DIRECTORY: 'DIR',
  DATA: 'DATA',
  EXECUTABLE: 'EXE'
};

/**
 * Everything after the last slash.
 */
lib.wa.fs.basename = function(path) {
  var pos = path.lastIndexOf('/');
  if (pos >= 0)
    return path.substr(pos + 1);

  return path;
};

/**
 * Everything before the last slash.
 */
lib.wa.fs.dirname = function(path) {
  var pos = path.lastIndexOf('/');
  if (pos >= 0)
    return path.substr(0, pos);

  return '';
};
