// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

// CSP means that we can't kick off the initialization from the html file,
// so we do it like this instead.
window.onload = function() {
  document.body.querySelectorAll('h2.package').forEach((ele) => {
    ele.onclick = toggle;
  });
};

/**
 * Toggle display of the associated license data.
 */
function toggle() {
  const id = this.id.replace(/^[^-]*-/, '');
  const ele = document.getElementById(`license-${id}`);
  ele.style.display = ele.style.display ? '' : 'block';
};
