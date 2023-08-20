// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {hterm} from '../../hterm/index.js';

import {setupForWebApp} from './nassh.js';

/**
 * CSP means that we can't kick off the initialization from the html file,
 * so we do it like this instead.
 */
globalThis.addEventListener('DOMContentLoaded', async (event) => {
  await setupForWebApp();
  hterm.messageManager.processI18nAttributes(document);

  document.body.querySelectorAll('h2.package').forEach((ele) => {
    ele.onclick = toggle;
  });
});

/**
 * Toggle display of the associated license data.
 *
 * @this {Element}
 */
function toggle() {
  const id = this.id.replace(/^[^-]*-/, '');
  const ele = document.getElementById(`license-${id}`);
  ele.style.display = ele.style.display ? '' : 'block';
}
