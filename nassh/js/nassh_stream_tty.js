// Copyright 2015 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.


/**
 * The buffer for input from a terminal.
 *
 * This is necessary when /dev/tty and stdin can be separate streams. In that
 * case, the input from the user must be buffered, and data must only be given
 * to the first stream that reads it.
 *
 * @constructor
 */
nassh.InputBuffer = function() {
  // The buffered data.
  this.data_ = '';

  // The queue of readers that are waiting for data. Readers are only queued
  // when they attempt to read and there is no data available.
  /**
   * @const
   * @private {!Array<{size: number, onRead: function(string):boolean}>}
   */
  this.pendingReaders_ = [];

  // This event is fired with the value true when there is data available to be
  // read, and false when the buffer is empty. It is only fired when this
  // status changes.
  this.onDataAvailable = lib.Event();
};

/**
 * Write data to the input buffer.
 *
 * This may call callbacks for pending readers.
 *
 * @param {string} data
 */
nassh.InputBuffer.prototype.write = function(data) {
  const wasAvailable = this.data_.length != 0;
  this.data_ += data;

  // First, send data to the pending readers.
  for (let i = 0; i < this.pendingReaders_.length; i++) {
    const onRead = this.pendingReaders_[i].onRead;
    let size = this.pendingReaders_[i].size;

    if (size > this.data_.length) {
      size = this.data_.length;
    }

    if (size == 0) {
      break;
    }

    const rv = this.data_.slice(0, size);
    if (onRead(rv)) {
      this.data_ = this.data_.slice(size);
    }

    this.pendingReaders_.shift();
  }

  // Now, if data is still available, notify.
  if (this.data_.length > 0 && !wasAvailable) {
    this.onDataAvailable(true);
  }
};

/**
 * Read data from the input buffer.
 *
 * If there is no data available to be read, this read will be queued, and
 * onRead will be later called when data is written to the input buffer.
 *
 * This only happens if there is no data available in the buffer. If there is
 * not enough data available, onRead is called with all of the data in the
 * buffer.
 *
 * @param {number} size
 * @param {function(string)} onRead
 */
nassh.InputBuffer.prototype.read = function(size, onRead) {
  const avail = this.data_.length;

  if (avail == 0) {
    // No data is available. Wait for data to be available and send it to the
    // queued readers.
    this.pendingReaders_.push({size: size, onRead: onRead});
    return;
  }

  if (size > avail) {
    size = avail;
  }

  const rv = this.data_.slice(0, size);
  if (onRead(rv)) {
    this.data_ = this.data_.slice(size);
  }

  if (this.data_.length == 0) {
    this.onDataAvailable(false);
  }
};

/**
 * The /dev/tty stream.
 *
 * This stream allows reads (from an nassh.InputBuffer) and writes (to a
 * hterm.Terminal.IO). It is used for /dev/tty, as well as stdin, stdout and
 * stderr when they are reading from/writing to a terminal.
 *
 * @param {number} fd
 * @param {!Object} info
 * @constructor
 * @extends {nassh.Stream}
 */
nassh.Stream.Tty = function(fd, info) {
  nassh.Stream.apply(this, [fd]);

  this.encoder_ = new TextEncoder();
};

nassh.Stream.Tty.prototype = Object.create(nassh.Stream.prototype);
/** @override */
nassh.Stream.Tty.constructor = nassh.Stream.Tty;

/**
 * @param {!Object} settings
 * @param {function(boolean)} onOpen
 * @override
 */
nassh.Stream.Tty.prototype.asyncOpen = function(settings, onOpen) {
  this.allowRead_ = settings.allowRead;
  this.allowWrite_ = settings.allowWrite;
  this.inputBuffer_ = settings.inputBuffer;
  this.io_ = settings.io;
  this.acknowledgeCount_ = 0;

  setTimeout(function() { onOpen(true); }, 0);
};

/**
 * @param {number} size
 * @param {function(!ArrayBuffer)} onRead
 * @override
 */
nassh.Stream.Tty.prototype.asyncRead = function(size, onRead) {
  if (!this.open) {
    throw nassh.Stream.ERR_STREAM_CLOSED;
  }

  if (!this.allowRead_) {
    throw nassh.Stream.ERR_STREAM_CANT_READ;
  }

  this.inputBuffer_.read(size, (data) => {
    if (!this.open) {
      return false;
    }

    // Turn the UTF-16 JavaScript string into a UTF-8 array buffer.
    const buf = this.encoder_.encode(data).buffer;
    setTimeout(() => onRead(buf), 0);
    return true;
  });
};

/**
 * @param {!ArrayBuffer} data
 * @param {function(number)} onSuccess
 * @override
 */
nassh.Stream.Tty.prototype.asyncWrite = function(data, onSuccess) {
  if (!this.open) {
    throw nassh.Stream.ERR_STREAM_CLOSED;
  }

  if (!this.allowWrite_) {
    throw nassh.Stream.ERR_STREAM_CANT_WRITE;
  }

  this.acknowledgeCount_ += data.byteLength;

  this.io_.writeUTF8(data);

  setTimeout(() => { onSuccess(this.acknowledgeCount_); }, 0);
};
