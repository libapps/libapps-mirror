// Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

// Add a global shortcut to the assert API.
const assert = chai.assert;

window.onload = function() {
  lib.init(() => {
    mocha.checkLeaks();
    mocha.run();
  });
};
