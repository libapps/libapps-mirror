// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Stub Chrome APIs for tests.
 */

/** @suppress {constantProperty} Allow tests in browsers. */
globalThis.chrome = globalThis.chrome || {};

class FspEventTarget {
  /** @param {!Function} method */
  addListener(method) {}
}

/** @suppress {checkTypes,constantProperty} */
chrome.fileSystemProvider = {
  onCloseFileRequested: new FspEventTarget(),
  onConfigureRequested: new FspEventTarget(),
  onCopyEntryRequested: new FspEventTarget(),
  onCreateDirectoryRequested: new FspEventTarget(),
  onCreateFileRequested: new FspEventTarget(),
  onDeleteEntryRequested: new FspEventTarget(),
  onGetMetadataRequested: new FspEventTarget(),
  onMountRequested: new FspEventTarget(),
  onMoveEntryRequested: new FspEventTarget(),
  onOpenFileRequested: new FspEventTarget(),
  onReadDirectoryRequested: new FspEventTarget(),
  onReadFileRequested: new FspEventTarget(),
  onTruncateRequested: new FspEventTarget(),
  onUnmountRequested: new FspEventTarget(),
  onWriteFileRequested: new FspEventTarget(),

  unmount: function(options, callback) {},

  /** @type {!chrome.fileSystemProvider.ProviderError} */
  ProviderError: {
    FAILED: 'FAILED',
    INVALID_OPERATION: 'INVALID_OPERATION',
    NOT_FOUND: 'NOT_FOUND',
  },
};
