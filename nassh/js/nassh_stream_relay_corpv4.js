// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Stream for connecting to a ssh server via a Corp v4 relay.
 */

nassh.Stream.RelayCorpv4 = {};

/**
 * Some constants for packets.
 *
 * TODO(vapier): Switch to classes once this hits stage4:
 * https://github.com/tc39/proposal-class-fields
 */
nassh.Stream.RelayCorpv4.PacketTag = {
  // Unused tag: should never show up.
  UNUSED: 0,
  // Session ID sent when connect works.
  CONNECT_SUCCESS: 1,
  // ACK sent after reconnect to help resume.
  RECONNECT_SUCCESS: 2,
  // Data passed through.
  DATA: 4,
  // ACKing data successfully processed.
  ACK: 7,
};

/**
 * Parse a packet from the server.
 */
nassh.Stream.RelayCorpv4.ServerPacket = class {
  /**
   * @param {!ArrayBuffer} data The array buffer to parse.
   */
  constructor(data) {
    this.frame = data;
    const dv = new DataView(this.frame);

    // Handle normal frames.
    this.tag = dv.getUint16(0);
    switch (this.tag) {
      case nassh.Stream.RelayCorpv4.PacketTag.CONNECT_SUCCESS: {
        this.length = dv.getUint32(2);
        const td = new TextDecoder();
        // The sid array is after the tag (2 bytes) & length (4 bytes).
        const sidBytes = new Uint8Array(this.frame, 6, this.length);
        // The SID is ASCII.
        this.sid = td.decode(sidBytes);
        break;
      }

      case nassh.Stream.RelayCorpv4.PacketTag.RECONNECT_SUCCESS:
        this.ack = dv.getBigUint64(2);
        break;

      case nassh.Stream.RelayCorpv4.PacketTag.DATA:
        this.length = dv.getUint32(2);
        // The data array is after the tag (2 bytes) & length (4 bytes).
        this.data = new Uint8Array(this.frame, 6, this.length);
        break;

      case nassh.Stream.RelayCorpv4.PacketTag.ACK:
        this.ack = dv.getBigUint64(2);
        break;
    }
  }
};

/**
 * A DATA packet to send to the server.
 */
nassh.Stream.RelayCorpv4.ClientDataPacket = class {
  /**
   * @param {!Uint8Array} data The data buffer to packetize.
   */
  constructor(data) {
    // Space for the tag (2 bytes) & length (4 bytes) & array.
    this.frame = new ArrayBuffer(6 + data.length);
    const dv = new DataView(this.frame);
    this.tag = nassh.Stream.RelayCorpv4.PacketTag.DATA;
    this.length = data.length;
    // The data array is after the tag (2 bytes) & length (4 bytes).
    this.data = new Uint8Array(this.frame, 6);

    dv.setUint16(0, this.tag);
    dv.setUint32(2, this.length);
    this.data.set(data);
  }
};

/**
 * An ACK packet to send to the server.
 */
nassh.Stream.RelayCorpv4.ClientAckPacket = class {
  /**
   * @param {bigint} ack The ack to packetize.
   * @suppress {checkTypes} Closure setBigUint64 is buggy.
   */
  constructor(ack) {
    // Space for the tag (2 bytes) & ack (8 bytes).
    this.frame = new ArrayBuffer(10);
    const dv = new DataView(this.frame);
    this.tag = nassh.Stream.RelayCorpv4.PacketTag.ACK;
    /** @const {bigint} */
    this.ack = ack;

    dv.setUint16(0, this.tag);
    dv.setBigUint64(2, this.ack);
  }
};

/**
 * WebSocket backed stream.
 *
 * This class manages the read and write through WebSocket to communicate
 * with the Corp v4 relay server.
 *
 * @param {number} fd
 * @constructor
 * @extends {nassh.Stream}
 */
nassh.Stream.RelayCorpv4WS = function(fd) {
  nassh.Stream.call(this, fd);

  // The relay connection settings.
  this.io_ = null;
  this.relay_ = null;

  // The remote ssh server settings.
  this.host_ = null;
  this.port_ = null;

  // The ssh-agent we talk to for the SSH-FE challenge.
  this.openCallback_ = null;

  // All the data we've queued but not yet sent out.
  this.writeBuffer_ = nassh.buffer.new();
  // Callback function when asyncWrite is used.
  this.onWriteSuccess_ = null;

  /**
   * The total byte count we've written during this session.
   *
   * @type {number}
   */
  this.writeCount_ = 0;

  /**
   * Data we've read so we can ack it to the server.
   *
   * @type {bigint}
   */
  this.readCount_ = BigInt(0);

  /**
   * Data we've written that the server has acked.
   *
   * @type {bigint}
   */
  this.writeAckCount_ = BigInt(0);

  /**
   * Session id for reconnecting.
   *
   * @type {?string}
   */
  this.sid_ = null;

  // Keep track of overall connection to avoid infinite recursion.
  this.connecting_ = false;

  // The actual WebSocket connected to the ssh server.
  this.socket_ = null;
};

/**
 * We are a subclass of nassh.Stream.
 */
nassh.Stream.RelayCorpv4WS.prototype = Object.create(nassh.Stream.prototype);
/** @override */
nassh.Stream.RelayCorpv4WS.constructor = nassh.Stream.RelayCorpv4WS;

/**
 * Open a relay socket.
 *
 * @param {!Object} settings
 * @param {function(boolean, ?string=)} onComplete
 * @override
 */
nassh.Stream.RelayCorpv4WS.prototype.asyncOpen =
    function(settings, onComplete) {
  this.io_ = settings.io;
  this.relay_ = settings.relay;
  this.resume_ = settings.resume;
  this.host_ = settings.host;
  this.port_ = settings.port;

  this.openCallback_ = onComplete;
  this.connect_();
};

/**
 * Maximum length of message that can be sent to avoid request limits.
 *
 * The spec says that 16KiB is the max length of arrays, not of the entire
 * packet itself.  The only time this limit really comes up is when we're
 * creating DATA packets ourselves.
 */
nassh.Stream.RelayCorpv4WS.prototype.maxDataWriteLength = 16 * 1024;

/**
 * URI to establish a new connection to the ssh server via the relay.
 */
nassh.Stream.RelayCorpv4WS.prototype.connectTemplate_ =
    `%(relay)/v4/connect` +
    `?host=%encodeURIComponent(host)` +
    `&port=%encodeURIComponent(port)`;

/**
 * Start a new connection to the proxy server.
 */
nassh.Stream.RelayCorpv4WS.prototype.connect_ = function() {
  if (this.socket_) {
    throw new Error('stream already connected');
  }
  this.connecting_ = true;

  const uri = lib.f.replaceVars(this.connectTemplate_, {
    host: this.host_,
    port: this.port_,
    relay: this.relay_,
  });

  this.socket_ = new WebSocket(uri, ['ssh']);
  this.socket_.binaryType = 'arraybuffer';
  this.socket_.onopen = this.onSocketOpen_.bind(this);
  this.socket_.onmessage = this.onSocketData_.bind(this);
  this.socket_.onclose = this.onSocketClose_.bind(this);
  this.socket_.onerror = this.onSocketError_.bind(this);
};

/**
 * URI to reconnect to an existing session.
 */
nassh.Stream.RelayCorpv4WS.prototype.reconnectTemplate_ =
    `%(relay)/v4/reconnect` +
    `?sid=%encodeURIComponent(sid)` +
    `&ack=%(ack)`;

/**
 * Try to resume the session.
 */
nassh.Stream.RelayCorpv4WS.prototype.reconnect_ = function() {
  if (!this.sid_) {
    throw new Error('stream not yet connected');
  }
  this.connecting_ = true;

  if (this.io_) {
    this.io_.showOverlay(nassh.msg('RELAY_RETRY'), 500);
  }

  const uri = lib.f.replaceVars(this.reconnectTemplate_, {
    ack: this.readCount_,
    relay: this.relay_,
    sid: this.sid_,
  });

  this.socket_.close();
  this.socket_ = new WebSocket(uri, ['ssh']);
  this.socket_.binaryType = 'arraybuffer';
  this.socket_.onopen = this.onSocketOpen_.bind(this);
  this.socket_.onmessage = this.onSocketData_.bind(this);
  this.socket_.onclose = this.onSocketClose_.bind(this);
  this.socket_.onerror = this.onSocketError_.bind(this);
};

/**
 * Close the connection to the proxy server and clean up.
 *
 * @param {string} reason A short message explaining the reason for closing.
 */
nassh.Stream.RelayCorpv4WS.prototype.close_ = function(reason) {
  // If we aren't open, there's nothing to do.  This allows us to call it
  // multiple times, perhaps from cascading events (write error/close/etc...).
  if (!this.socket_) {
    return;
  }

  if (this.openCallback_) {
    this.openCallback_(false, reason);
    this.openCallback_ = null;
  }

  if (this.io_) {
    this.io_.println(`Closing socket due to ${reason}`);
  }
  this.socket_.close();
  this.socket_ = null;
  this.close();
};

/**
 * Callback when the socket connects successfully.
 *
 * @param {!Event} e The event details.
 */
nassh.Stream.RelayCorpv4WS.prototype.onSocketOpen_ = function(e) {
  if (this.openCallback_) {
    this.openCallback_(true);
    this.openCallback_ = null;
  }

  // We've finished the connection, so we can retry if needed.
  this.connecting_ = false;

  // If we had any pending writes, kick them off.  We can't call sendWrite
  // directly as the socket isn't in the correct state until after this handler
  // finishes executing.
  //
  // We only do this in the initial connect state as we need to resync acks when
  // we reconnect.
  if (this.writeAckCount_ == 0) {
    setTimeout(this.sendWrite_.bind(this), 0);
  }
};

/**
 * Callback when the socket closes when the connection is finished.
 *
 * @param {!CloseEvent} e The event details.
 */
nassh.Stream.RelayCorpv4WS.prototype.onSocketClose_ = function(e) {
  this.close_(`server closed socket: [${e.code}] ${e.reason}`);
};

/**
 * Callback when the socket closes due to an error.
 *
 * @param {!Event} e The event details.
 */
nassh.Stream.RelayCorpv4WS.prototype.onSocketError_ = function(e) {
  // If (re)connection is in progress, don't attempt it again.
  if (!this.connecting_ && this.resume_) {
    this.reconnect_();
  } else {
    this.close_('server sent an error');
  }
};

/**
 * Callback when new data is available from the server.
 *
 * @param {!MessageEvent} e The message with data to read.
 */
nassh.Stream.RelayCorpv4WS.prototype.onSocketData_ = function(e) {
  const packet = new nassh.Stream.RelayCorpv4.ServerPacket(e.data);

  switch (packet.tag) {
    case nassh.Stream.RelayCorpv4.PacketTag.CONNECT_SUCCESS:
      this.sid_ = packet.sid;
      break;

    case nassh.Stream.RelayCorpv4.PacketTag.DATA: {
      // This creates a copy of the ArrayBuffer, but there doesn't seem to be an
      // alternative -- PPAPI doesn't accept views like Uint8Array.  If it did,
      // it would probably still serialize the entire underlying ArrayBuffer
      // (which in this case wouldn't be a big deal as it's only 4 extra bytes).
      this.onDataAvailable(Array.from(packet.data));

      this.readCount_ += BigInt(packet.length);
      const ackPacket = new nassh.Stream.RelayCorpv4.ClientAckPacket(
          this.readCount_);
      this.socket_.send(ackPacket.frame);
      break;
    }

    case nassh.Stream.RelayCorpv4.PacketTag.RECONNECT_SUCCESS:
      // Queue the output after we resync our ack state below.
      setTimeout(this.sendWrite_.bind(this), 0);
      // Fallthrough.

    case nassh.Stream.RelayCorpv4.PacketTag.ACK: {
      /**
       * Closure compiler hasn't finished bigint support yet, so this expression
       * between 2 bigints is unknown.  Disable for now.
       *
       * @suppress {strictPrimitiveOperators}
       */
      const acked = Number(packet.ack - this.writeAckCount_);
      if (acked == 0) {
        // This can come up with reconnects, but should handle it either way.
        return;
      } else if (acked < 0) {
        this.close_(`Reverse ack ${this.writeAckCount_} -> ${packet.ack}`);
        return;
      }

      // Adjust our write buffer.
      this.writeBuffer_.ack(acked);
      this.writeAckCount_ = packet.ack;
      break;
    }

    default:
      console.warn(`Ignoring unknown tag ${packet.tag}`);
      break;
  }
};

/**
 * Queue up some data to write asynchronously.
 *
 * @param {!ArrayBuffer} data The data to send out.
 * @param {function(number)=} onSuccess Optional callback.
 * @override
 */
nassh.Stream.RelayCorpv4WS.prototype.asyncWrite = function(data, onSuccess) {
  if (!data.byteLength) {
    return;
  }

  this.writeBuffer_.write(data);
  this.onWriteSuccess_ = onSuccess;
  this.sendWrite_();
};

/**
 * Send out any queued data.
 */
nassh.Stream.RelayCorpv4WS.prototype.sendWrite_ = function() {
  if (!this.socket_ || this.socket_.readyState != WebSocket.OPEN ||
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

  // Send the data packet.
  const readBuffer = this.writeBuffer_.read(this.maxDataWriteLength);
  const dataPacket = new nassh.Stream.RelayCorpv4.ClientDataPacket(readBuffer);
  this.socket_.send(dataPacket.frame);
  this.writeCount_ += dataPacket.length;

  if (this.onWriteSuccess_) {
    // Notify nassh that we are ready to consume more data.
    this.onWriteSuccess_(this.writeCount_);
  }

  if (!this.writeBuffer_.isEmpty()) {
    // We have more data to send but due to message limit we didn't send it.
    setTimeout(this.sendWrite_.bind(this), 0);
  }
};
