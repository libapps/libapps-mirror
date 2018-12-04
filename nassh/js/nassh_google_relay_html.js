// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

// This file handles the onload event for google_relay.html.  It would have
// been included inline in the html file if Content Security Policy (CSP) didn't
// forbid it.

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
 */
const showNasshError = function(msg) {
  showError('nassh', msg);
};

/**
 * Show an error message originating from the relay server.
 */
const showRelayError = function(msg) {
  showError('relay', msg);
};

window.onload = function() {
  var hash = document.location.hash.substr(1);

  if (hash.indexOf('@') != -1) {
    // URLs containing '@' are legacy v1 redirects.
    var ary = hash.match(/@([^:]+)(?::(\d+))?/);
    sessionStorage.setItem('googleRelay.relayHost', ary[1]);
    sessionStorage.setItem('googleRelay.relayPort', ary[2] || '');
  } else {
    // URLs not containing '@' are assumed to be v2 URL safe Base64 JSON blobs.
    var blob = atob(nassh.base64UrlToBase64(hash));
    var params = JSON.parse(blob);

    if (params['endpoint']) {
      var [host, port] = params['endpoint'].split(':');
      sessionStorage.setItem('googleRelay.relayHost', host);
      sessionStorage.setItem('googleRelay.relayPort', port || '');
    }

    if (params['error']) {
      showRelayError(params['error']);
    }
  }

  var path = sessionStorage.getItem('googleRelay.resumePath');
  if (!path) {
    showNasshError('Nowhere to resume to!');
    return;
  }

  var url = chrome.extension.getURL(path);
  console.log(url);

  // Avoid infinite loops when the relay server rejects us and we redirect
  // back and forth.
  let count = parseInt(sessionStorage.getItem('googleRelay.redirectCount'));
  if (isNaN(count))
    count = 0;
  if (++count > 3) {
    showNasshError('Redirected by relay too many times, so giving up.  Sorry.');
    sessionStorage.removeItem('googleRelay.redirectCount');
    return;
  }
  sessionStorage.setItem('googleRelay.redirectCount', count);

  document.location = url;
};
