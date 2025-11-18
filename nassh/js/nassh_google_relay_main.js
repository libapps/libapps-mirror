// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Handles the onload event for google_relay.html.
 */

import {lib} from '../../libdot/index.js';

import {base64UrlToBase64} from './nassh.js';

/**
 * Show an error message.
 *
 * @param {string} id The base id for this error.
 * @param {string} msg The error message to display to the user.
 */
const showError = function(id, msg) {
  console.error(msg);
  document.getElementById(id).style.display = 'block';
  document.getElementById(`${id}-message`).innerText = msg;
};

/**
 * Show an error message originating from the Secure Shell app.
 *
 * @param {string} msg
 */
const showNasshError = function(msg) {
  showError('nassh', msg);
};

/**
 * Show an error message originating from the relay server.
 *
 * @param {string} msg
 */
const showRelayError = function(msg) {
  showError('relay', msg);
};

/** On load. */
globalThis.addEventListener('DOMContentLoaded', (event) => {
  const hash = globalThis.location.hash.substr(1);

  if (hash.indexOf('@') != -1) {
    // URLs containing '@' are legacy v1 redirects.
    const ary = hash.match(/@([^:]+)(?::(\d+))?/);
    globalThis.sessionStorage.setItem('googleRelay.relayHost', ary[1]);
    globalThis.sessionStorage.setItem('googleRelay.relayPort', ary[2] || '');
  } else {
    // URLs not containing '@' are assumed to be v2 URL safe Base64 JSON blobs.
    const blob = atob(base64UrlToBase64(hash));
    const params = JSON.parse(blob);

    if (params['endpoint']) {
      const [host, port] = params['endpoint'].split(':');
      globalThis.sessionStorage.setItem('googleRelay.relayHost', host);
      globalThis.sessionStorage.setItem('googleRelay.relayPort', port || '');
    }

    if (params['error']) {
      showRelayError(params['error']);
    }
  }

  const path = globalThis.sessionStorage.getItem('googleRelay.resumePath');
  if (!path) {
    showNasshError('Nowhere to resume to!');
    return;
  }

  const url = lib.f.getURL(path);
  console.log(url);

  // Avoid infinite loops when the relay server rejects us and we redirect
  // back and forth.
  let count = parseInt(
      globalThis.sessionStorage.getItem('googleRelay.redirectCount'), 10);
  if (isNaN(count)) {
    count = 0;
  }
  if (++count > 3) {
    showNasshError('Redirected by relay too many times, so giving up.  Sorry.');
    globalThis.sessionStorage.removeItem('googleRelay.redirectCount');
    return;
  }
  globalThis.sessionStorage.setItem(
      'googleRelay.redirectCount', count.toString());

  globalThis.location.replace(url);
});
