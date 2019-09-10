// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/** Open settings page in a new window. */
terminal.Menu.HANDLERS['#options'] = function() {
  window.open('/html/terminal_settings.html');
};
