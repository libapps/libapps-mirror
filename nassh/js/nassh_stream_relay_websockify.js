// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Stream for connecting to a ssh server via a Websocket relay.
 */

import {lib} from '../../libdot/index.js';

import {newBuffer} from './nassh_buffer.js';
import {Stream} from './nassh_stream.js';

/**
 * WebSocket backed stream.
 *
 * This class manages the read and write through WebSocket to communicate
 * with the SSH server.
 *
 * Resuming of connections is not supported.
 */
export class RelayWebsockifyStream extends Stream {
  /**
   * @param {number} fd
   */
  constructor(fd) {
    super(fd);

    // The relay connection settings.
    this.relayHost_ = null;
    this.relayPort_ = null;
    this.protocol_ = null;

    // The remote ssh server settings.
    this.host_ = null;
    this.port_ = null;

    // All the data we've queued but not yet sent out.
    this.writeBuffer_ = newBuffer();
    // Callback function when asyncWrite is used.
    this.onWriteSuccess_ = null;

    // The actual WebSocket connected to the ssh server.
    this.socket_ = null;
  }

  /**
   * Open a relay socket.
   *
   * @param {!Object} settings
   * @param {function(boolean, string=)} onComplete
   * @override
   */
  async asyncOpen(settings, onComplete) {
    this.relayHost_ = settings.relayHost;
    this.relayPort_ = settings.relayPort;
    this.host_ = settings.host;
    this.port_ = settings.port;
    this.protocol_ = settings.protocol;

    this.connect_();
    onComplete(true);
  }

  /**
   * Start a new connection to the proxy server.
   */
  connect_() {
    if (this.socket_) {
      throw new Error('stream already connected');
    }

    // Since websockify will usually be running on the same host as the ssh
    // server, default the relay host/port to the ssh settings.
    const uri = lib.f.replaceVars(this.connectTemplate_, {
      protocol: this.protocol_,
      relayHost: this.relayHost_ ?? this.host_,
      relayPort: this.relayPort_ || this.port_,
    });

    this.socket_ = new WebSocket(uri);
    this.socket_.binaryType = 'arraybuffer';
    this.socket_.onopen = this.onSocketOpen_.bind(this);
    this.socket_.onmessage = this.onSocketData_.bind(this);
    this.socket_.onclose = this.onSocketClose_.bind(this);
    this.socket_.onerror = this.onSocketError_.bind(this);
  }

  /**
   * Close the connection to the proxy server and clean up.
   *
   * @param {string} reason A short message explaining the reason for closing.
   */
  close_(reason) {
    // If we aren't open, there's nothing to do.  This allows us to call it
    // multiple times, perhaps from cascading events (write error/close/etc...).
    if (!this.socket_) {
      return;
    }

    console.log(`Closing socket due to ${reason}`);
    this.socket_.close();
    this.socket_ = null;

    super.close();
  }

  /**
   * Callback when the socket connects successfully.
   *
   * @param {!Event} e The event details.
   */
  onSocketOpen_(e) {
    // If we had any pending writes, kick them off.  We can't call sendWrite
    // directly as the socket isn't in the correct state until after this
    // handler finishes executing.
    setTimeout(this.sendWrite_.bind(this), 0);
  }

  /**
   * Callback when the socket closes when the connection is finished.
   *
   * @param {!CloseEvent} e The event details.
   */
  onSocketClose_(e) {
    this.close_(`server closed socket: [${e.code}] ${e.reason}`);
  }

  /**
   * Callback when the socket closes due to an error.
   *
   * @param {!Event} e The event details.
   */
  onSocketError_(e) {
    this.close_(`server sent an error: ${e}`);
  }

  /**
   * Callback when new data is available from the server.
   *
   * @param {!MessageEvent} e The message with data to read.
   */
  onSocketData_(e) {
    this.onDataAvailable(e.data);
  }

  /**
   * Queue up some data to write asynchronously.
   *
   * @param {!ArrayBuffer} data The SSH data.
   * @param {function(number)=} onSuccess Optional callback.
   * @override
   */
  asyncWrite(data, onSuccess) {
    if (!data.byteLength) {
      return;
    }

    this.writeBuffer_.write(data);
    this.onWriteSuccess_ = onSuccess;
    this.sendWrite_();
  }

  /**
   * Send out any queued data.
   */
  sendWrite_() {
    if (!this.socket_ || this.socket_.readyState != 1 ||
        this.writeBuffer_.isEmpty()) {
      // Nothing to write or socket is not ready.
      return;
    }

    // If we've queued too much already, go back to sleep.
    // NB: This check is fuzzy at best, so we don't need to include the size of
    // the data we're about to write below into the calculation.
    if (this.socket_.bufferedAmount >= this.maxWebSocketBufferLength) {
      setTimeout(this.sendWrite_.bind(this));
      return;
    }

    const buf = this.writeBuffer_.read(this.maxWebSocketBufferLength);
    const size = buf.length;
    this.socket_.send(buf);
    this.writeBuffer_.ack(size);

    if (this.onWriteSuccess_) {
      // Notify nassh that we are ready to consume more data.
      this.onWriteSuccess_(size);
    }

    if (!this.writeBuffer_.isEmpty()) {
      // We have more data to send but due to message limit we didn't send it.
      setTimeout(this.sendWrite_.bind(this), 0);
    }
  }
}

/**
 * URI to establish a new connection to the ssh server via the relay.
 */
RelayWebsockifyStream.prototype.connectTemplate_ =
    '%(protocol)://%(relayHost):%(relayPort)';
