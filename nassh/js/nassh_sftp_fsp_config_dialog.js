// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Runtime SFTP connect dialog.
 */

/**
 * Constructor for the ConfigDialog instance.
 *
 * There should only be one of these, and it assumes there is only one in the
 * current window.
 *
 * @param {string} fsId The filesystem mount id.
 * @param {!nassh.External.MountInfo} info The mount information.
 * @constructor
 */
nassh.ConfigDialog = function(fsId, info) {
  this.fsId_ = fsId;
  this.info_ = info;
  this.updateLabels_();
  this.bindInputs_();
  this.refresh_();
};

/**
 * Translate the dialog.
 */
nassh.ConfigDialog.prototype.updateLabels_ = function() {
  lib.i18n.getAcceptLanguages().then((languages) => {
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
  this.info_.basePath = this.fieldMountPath_.value;
  this.info_.readChunkSize = parseInt(this.fieldReadSize_.value, 10) * 1024;
  this.info_.writeChunkSize = parseInt(this.fieldWriteSize_.value, 10) * 1024;

  nassh.runtimeSendMessage({
    command: 'setMountInfo', fileSystemId: this.fsId_, info: this.info_,
  })
    .then(({error, message}) => {
      if (error) {
        console.error(message);
      }
    });
};

/**
 * Update the user display.
 *
 * Sync the SFTP client runtime to the forms.
 */
nassh.ConfigDialog.prototype.refresh_ = function() {
  this.fieldMountPath_.value = this.info_.basePath;
  this.fieldReadSize_.value = this.info_.readChunkSize / 1024;
  this.fieldWriteSize_.value = this.info_.writeChunkSize / 1024;

  // Dump internal state.  Because why not.
  this.rawStats_.textContent =
      `protocolClientVersion: ${this.info_.protocolClientVersion}\n` +
      `protocolServerVersion: ${this.info_.protocolServerVersion}\n` +
      'protocolServerExtensions:\n' +
      this.info_.protocolServerExtensions.map(
          (x) => `  ${x[0]} = ${x[1]}`).join('\n') + '\n' +
      `requestId: ${this.info_.requestId}\n` +
      `buffer: ${this.info_.buffer}\n` +
      `pendingRequests: ${this.info_.pendingRequests}\n` +
      `openedFiles: ${this.info_.openedFiles}`;
};

/**
 * Event when the window finishes loading.
 */
window.addEventListener('DOMContentLoaded', (event) => {
  lib.init().then(() => {
    const params = new URLSearchParams(document.location.search);
    const profileId = lib.notNull(params.get('profile-id'));
    document.title = `SFTP: ${profileId}`;
    nassh.runtimeSendMessage({
      command: 'getMountInfo', fileSystemId: profileId,
    })
      .then(({error, message, info}) => {
        if (error) {
          console.error(message);
          window.close();
        } else {
          window.dialog_ = new nassh.ConfigDialog(profileId, info);
        }
      });
  });
});
