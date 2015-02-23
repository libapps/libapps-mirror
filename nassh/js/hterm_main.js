// Copyright (c) 2015 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

window.addEventListener('load', function() {
  if (window.attached) {
    // We were loaded programmatically by /exe/hterm, they will perform the
    // initialization.
    return;
  }

  chrome.runtime.getBackgroundPage(function(bg) {
    // TODO(rginda) We need to use the background page's Object
    // constructor in order to pass an instanceof check.  The instanceof
    // check should probably be relaxed.
    var arg = new bg.Object();
    arg['terminal-dom'] = document.querySelector('#terminal');
    bg.app.execute('/exe/hterm', arg);
  });
});
