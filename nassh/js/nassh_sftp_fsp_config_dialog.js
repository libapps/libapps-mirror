// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview: Runtime SFTP connect dialog.
 */

/**
 * Constructor for the ConfigDialog instance.
 *
 * There should only be one of these, and it assumes there is only one in the
 * current window.
 *
 * @param {nassh.sftp.Client} client The SFTP client to dynamically config.
 */
nassh.ConfigDialog = function(client) {
  this.client_ = client;
  this.updateLabels_();
  this.bindInputs_();
  this.refresh_();
};

/**
 * Translate the dialog.
 */
nassh.ConfigDialog.prototype.updateLabels_ = function() {
  lib.i18n.getAcceptLanguages((languages) => {
    const mm = new lib.MessageManager(languages);
    mm.processI18nAttributes(document.body);

    const labels = document.querySelectorAll('.aligned-dialog-labels');
    let maxWidth = 0;
    labels.forEach((el) => maxWidth = Math.max(maxWidth, el.clientWidth));
    labels.forEach((el) => el.style.width = `${maxWidth}px`);
  });
};

/**
 * Bind all the labels and inputs to our runtime state.
 */
nassh.ConfigDialog.prototype.bindInputs_ = function() {
  this.fieldMountPath_ = document.querySelector('#field-mount-path');
  this.fieldMountPath_.onchange = this.onInputChange_.bind(this);
  this.fieldReadSize_ = document.querySelector('#field-read-size');
  this.fieldReadSize_.onchange = this.onInputChange_.bind(this);
  this.fieldWriteSize_ = document.querySelector('#field-write-size');
  this.fieldWriteSize_.onchange = this.onInputChange_.bind(this);
  this.rawStats_ = document.querySelector('#raw-stats');
};

/**
 * Callback whenever the user changes things.
 *
 * Sync the data from the forms to our SFTP client runtime.
 */
nassh.ConfigDialog.prototype.onInputChange_ = function() {
  this.client_.basePath_ = this.fieldMountPath_.value;
  this.client_.readChunkSize = parseInt(this.fieldReadSize_.value, 10) * 1024;
  this.client_.writeChunkSize = parseInt(this.fieldWriteSize_.value, 10) * 1024;
};

/**
 * Update the user display.
 *
 * Sync the SFTP client runtime to the forms.
 */
nassh.ConfigDialog.prototype.refresh_ = function() {
  this.fieldMountPath_.value = this.client_.basePath_;
  this.fieldReadSize_.value = this.client_.readChunkSize / 1024;
  this.fieldWriteSize_.value = this.client_.writeChunkSize / 1024;

  // Dump internal state.  Because why not.
  let summary = '';
  const append = (name, obj) => {
    const entries = Object.entries(obj);
    summary += `${name}:`;
    if (entries.length == 0) {
      summary += ' <empty>\n';
    } else {
      summary += '\n';
      entries.forEach(([key, value]) => {
        summary += `  ${key} = ${value}\n`;
      });
    }
  };
  summary =
      `protocolClientVersion: ${this.client_.protocolClientVersion}\n` +
      `protocolServerVersion: ${this.client_.protocolServerVersion}\n`;
  append('protocolServerExtensions', this.client_.protocolServerExtensions);
  summary += '\n';
  summary +=
      `requestId: ${this.client_.requestId_}\n` +
      `buffer: [${this.client_.buffer_}]\n`;
  append('pendingRequests', this.client_.pendingRequests_);
  append('openedFiles', this.client_.openedFiles);
  this.rawStats_.textContent = summary;
};

/**
 * Get the SFTP client from the background page handle.
 *
 * @param {window} bg The extension's background page.
 * @param {string} fsId The unique filesystem id.
 * @return {nassh.ConfigDialog} The new runtime dialog.
 */
nassh.ConfigDialog.fromBackgroundPage = function(bg, fsId) {
  if (!bg.nassh.sftp.fsp.sftpInstances[fsId]) {
    return null;
  }

  const client = bg.nassh.sftp.fsp.sftpInstances[fsId].sftpClient;
  return new nassh.ConfigDialog(client);
};

/**
 * Event when the window finishes loading.
 */
window.onload = function() {
  lib.init(() => {
    const params = new URLSearchParams(document.location.search);
    const profileId = params.get('profile-id');
    document.title = `SFTP: ${profileId}`;
    nassh.getBackgroundPage()
      .then((bg) => {
        window.dialog_ = nassh.ConfigDialog.fromBackgroundPage(bg, profileId);
        if (!window.dialog_) {
          window.close();
        }
      });
  });
};
