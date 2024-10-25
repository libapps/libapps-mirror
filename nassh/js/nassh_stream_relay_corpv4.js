// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Stream for connecting to a ssh server via a Corp v4 relay.
 */

import {lib} from '../../libdot/index.js';

import {localize} from './nassh.js';
import {newBuffer} from './nassh_buffer.js';
import {GoogMetricsReporter} from './nassh_goog_metrics_reporter.js';
import {Stream} from './nassh_stream.js';

/**
 * Some constants for packets.
 *
 * TODO(vapier): Switch to classes once this hits stage4:
 * https://github.com/tc39/proposal-class-fields
 */
const PacketTag = {
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
 * Maximum number of failed reconnect attempts until we give up.
 */
const RECONNECT_LIMIT = 3;

/**
 * Delay in ms for creating a new WebSocket when reconnecting. When a connection
 * is closed due to close-lid-suspend, it is best to not reconnect immmediately,
 * but delay enough time for system to fully suspend, and then reconnect after
 * open-lid-resume.  2s seems to be enough time for suspend to stop network,
 * then also stop JS execution.
 */
const RECONNECT_DELAY = 2000;

/**
 * Parse a packet from the server.
 */
export class ServerPacket {
  /**
   * @param {!ArrayBuffer} data The array buffer to parse.
   */
  constructor(data) {
    this.frame = data;
    const dv = new DataView(this.frame);

    // Handle normal frames.
    this.tag = dv.getUint16(0);
    switch (this.tag) {
      case PacketTag.CONNECT_SUCCESS: {
        this.length = dv.getUint32(2);
        const td = new TextDecoder();
        // The sid array is after the tag (2 bytes) & length (4 bytes).
        const sidBytes = new Uint8Array(this.frame, 6, this.length);
        // The SID is ASCII.
        this.sid = td.decode(sidBytes);
        break;
      }

      case PacketTag.RECONNECT_SUCCESS:
        this.ack = dv.getBigUint64(2);
        break;

      case PacketTag.DATA:
        this.length = dv.getUint32(2);
        // The data array is after the tag (2 bytes) & length (4 bytes).
        this.data = new Uint8Array(this.frame, 6, this.length);
        break;

      case PacketTag.ACK:
        this.ack = dv.getBigUint64(2);
        break;
    }
  }
}

/**
 * A DATA packet to send to the server.
 */
export class ClientDataPacket {
  /**
   * @param {!Uint8Array} data The data buffer to packetize.
   */
  constructor(data) {
    // Space for the tag (2 bytes) & length (4 bytes) & array.
    this.frame = new ArrayBuffer(6 + data.length);
    const dv = new DataView(this.frame);
    this.tag = PacketTag.DATA;
    this.length = data.length;
    // The data array is after the tag (2 bytes) & length (4 bytes).
    this.data = new Uint8Array(this.frame, 6);

    dv.setUint16(0, this.tag);
    dv.setUint32(2, this.length);
    this.data.set(data);
  }
}

/**
 * An ACK packet to send to the server.
 */
export class ClientAckPacket {
  /**
   * @param {bigint} ack The ack to packetize.
   */
  constructor(ack) {
    // Space for the tag (2 bytes) & ack (8 bytes).
    this.frame = new ArrayBuffer(10);
    const dv = new DataView(this.frame);
    this.tag = PacketTag.ACK;
    /** @const {bigint} */
    this.ack = ack;

    dv.setUint16(0, this.tag);
    dv.setBigUint64(2, this.ack);
  }
}

/**
 * WebSocket backed stream.
 *
 * This class manages the read and write through WebSocket to communicate
 * with the Corp v4 relay server.
 *
 * @param {number} fd
 * @constructor
 * @extends {Stream}
 */
export function RelayCorpv4WsStream(fd) {
  Stream.call(this, fd);

  // The relay connection settings.
  this.io_ = null;
  this.relayServerSocket_ = null;
  this.relayUser_ = null;

  // The remote ssh server settings.
  this.host_ = null;
  this.port_ = null;

  // The ssh-agent we talk to for the SSH-FE challenge.
  this.openCallback_ = null;

  // All the data we've queued but not yet sent out.
  this.writeBuffer_ = newBuffer();
  // Callback function when asyncWrite is used.
  this.onWriteSuccess_ = null;

  /**
   * The total byte count we've written during this session.
   *
   * @type {number}
   */
  this.writeCount_ = 0;

  /**
   * this.writeCount_'s previous value.
   *
   * @type {number}
   */
   this.previousWriteCount_ = 0;

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

  // Current count of failed reconnect attempts.
  this.reconnectCount_ = 0;

  // The actual WebSocket connected to the ssh server.
  this.socket_ = null;

  // Time data was most recently sent.
  this.timeSent_ = 0;

  // Circular list of recently observed ack times.
  this.ackTimes_ = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  // Slot to record next ack time in.
  this.ackTimesIndex_ = 0;

  /**
   * Sends metrics to designated storage.
   *
   * @type {?GoogMetricsReporter}
   */
   this.googMetricsReporter_ = null;
}

/**
 * We are a subclass of Stream.
 */
RelayCorpv4WsStream.prototype = Object.create(Stream.prototype);
/** @override */
RelayCorpv4WsStream.constructor = RelayCorpv4WsStream;

/**
 * Open a relay socket. Setup metrics reporter.
 *
 * @param {!Object} settings
 * @param {function(boolean, ?string=)} onComplete
 * @override
 */
RelayCorpv4WsStream.prototype.asyncOpen = async function(settings, onComplete) {
  this.io_ = settings.io;
  this.relayServerSocket_ = settings.relayServerSocket;
  this.relayUser_ = settings.relayUser;
  this.resume_ = settings.resume;
  this.egressDomain_ = settings.egressDomain;
  this.host_ = settings.host;
  this.port_ = settings.port;

  if (settings.reportAckLatency) {
    try {
      this.googMetricsReporter_ =
          new GoogMetricsReporter(this.io_, this.host_, settings.localPrefs);
      const hasChromePermissions =
          await this.googMetricsReporter_.checkChromePermissions();
      if (!hasChromePermissions) {
        await this.googMetricsReporter_.requestChromePermissions();
      }
      await this.googMetricsReporter_.initClientMetadata();
    } catch (e) {
      console.error('Error configuring GoogMetricsReporter', e);
    }
  }

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
RelayCorpv4WsStream.prototype.maxDataWriteLength = 16 * 1024;

/**
 * URI to establish a new connection to the ssh server via the relay.
 */
RelayCorpv4WsStream.prototype.connectTemplate_ =
    `%(relay)v4/connect` +
    `?host=%encodeURIComponent(host)` +
    `&port=%encodeURIComponent(port)` +
    `&dstUsername=%encodeURIComponent(user)`;

/**
 * Start a new connection to the proxy server.
 */
RelayCorpv4WsStream.prototype.connect_ = function() {
  if (this.socket_) {
    throw new Error('stream already connected');
  }

  let uri = lib.f.replaceVars(this.connectTemplate_, {
    host: this.host_,
    port: this.port_,
    relay: this.relayServerSocket_,
    user: this.relayUser_,
  });

  if (this.egressDomain_) {
    uri = uri.concat(`&egressDomain=${encodeURIComponent(this.egressDomain_)}`);
  }

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
RelayCorpv4WsStream.prototype.reconnectTemplate_ =
    `%(relay)v4/reconnect` +
    `?sid=%encodeURIComponent(sid)` +
    `&ack=%(ack)`;

/**
 * Try to resume the session.
 *
 * @return {boolean} returns false if resume is not set for this connection,
 *     or reconnect already in progress.
 */
RelayCorpv4WsStream.prototype.reconnect_ = function() {
  if (!this.resume_ || ++this.reconnectCount_ > RECONNECT_LIMIT || !this.sid_) {
    console.warn(`Not reconnecting, resume=${this.resume_}, sid=${
      !!this.sid_} count=${this.reconnectCount_}`);
    return false;
  }

  if (this.io_) {
    this.io_.showOverlay(localize('RELAY_RETRY'), null);
  }

  const uri = lib.f.replaceVars(this.reconnectTemplate_, {
    ack: this.readCount_,
    relay: this.relayServerSocket_,
    sid: this.sid_,
  });

  // Remove old callbacks to stop any potential late onclose/onerror calls to
  // the old socket.
  this.socket_.onopen = null;
  this.socket_.onmessage = null;
  this.socket_.onclose = null;
  this.socket_.onerror = null;
  this.socket_.close();

  // Delay creating new socket to ensure it only happens after any suspend is
  // resumed (lid close/open).
  setTimeout(() => {
    this.socket_ = new WebSocket(uri, ['ssh']);
    this.socket_.binaryType = 'arraybuffer';
    this.socket_.onopen = this.onSocketOpen_.bind(this);
    this.socket_.onmessage = this.onSocketData_.bind(this);
    this.socket_.onclose = this.onSocketClose_.bind(this);
    this.socket_.onerror = this.onSocketError_.bind(this);
  }, RECONNECT_DELAY);
  return true;
};

/**
 * Close the connection to the proxy server and clean up.
 *
 * @param {string} reason A short message explaining the reason for closing.
 */
RelayCorpv4WsStream.prototype.close_ = function(reason) {
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
    this.io_.hideOverlay();
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
RelayCorpv4WsStream.prototype.onSocketOpen_ = function(e) {
  if (this.openCallback_) {
    this.openCallback_(true);
    this.openCallback_ = null;
  }

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
RelayCorpv4WsStream.prototype.onSocketClose_ = function(e) {
  // When a socket closes uncleanly, CloseEvent.wasClean is false.
  // Treat this like an error and possibly reconnect.
  if (e.wasClean || !this.reconnect_()) {
    this.close_(`server closed socket: [${e.code}] ${e.reason}`);
  }
};

/**
 * Callback when the socket closes due to an error.
 *
 * @param {!Event} e The event details.
 */
RelayCorpv4WsStream.prototype.onSocketError_ = function(e) {
  if (!this.reconnect_()) {
    this.close_('server sent an error');
  }
};

/**
 * Callback when new data is available from the server.
 *
 * @param {!MessageEvent} e The message with data to read.
 */
RelayCorpv4WsStream.prototype.onSocketData_ = function(e) {
  const packet = new ServerPacket(e.data);

  switch (packet.tag) {
    case PacketTag.CONNECT_SUCCESS:
      this.sid_ = packet.sid;
      break;

    case PacketTag.DATA: {
      // This creates a copy of the ArrayBuffer, but there doesn't seem to be an
      // alternative -- PPAPI doesn't accept views like Uint8Array.  If it did,
      // it would probably still serialize the entire underlying ArrayBuffer
      // (which in this case wouldn't be a big deal as it's only 4 extra bytes).
      const data = packet.data;
      this.onDataAvailable(data.buffer.slice(
          data.byteOffset, data.byteOffset + data.byteLength));

      this.readCount_ += BigInt(packet.length);
      const ackPacket = new ClientAckPacket(this.readCount_);
      this.socket_.send(ackPacket.frame);
      break;
    }

    case PacketTag.RECONNECT_SUCCESS:
      // Reset reconnect counter and hide retry overlay.
      this.reconnectCount_ = 0;
      if (this.io_) {
        this.io_.hideOverlay();
      }
      // Queue the output after we resync our ack state below.
      setTimeout(this.sendWrite_.bind(this), 0);
      // Fallthrough.

    case PacketTag.ACK: {
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

      // Track ACK latency.
      if (this.timeSent_ !== 0 &&
          this.writeAckCount_ > BigInt(this.previousWriteCount_)) {
        this.recordAckTime_(Date.now() - this.timeSent_);
        this.timeSent_ = 0;
      }

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
RelayCorpv4WsStream.prototype.asyncWrite = function(data, onSuccess) {
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
RelayCorpv4WsStream.prototype.sendWrite_ = function() {
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
  const dataPacket = new ClientDataPacket(readBuffer);
  this.socket_.send(dataPacket.frame);
  this.previousWriteCount_ = this.writeCount_;
  this.writeCount_ += dataPacket.length;

  // Start ack latency measurement.
  if (this.googMetricsReporter_) {
    this.timeSent_ = Date.now();
  }

  if (this.onWriteSuccess_) {
    // Notify nassh that we are ready to consume more data.
    this.onWriteSuccess_(this.writeCount_);
  }

  if (!this.writeBuffer_.isEmpty()) {
    // We have more data to send but due to message limit we didn't send it.
    setTimeout(this.sendWrite_.bind(this), 0);
  }
};

/**
 * Append ack time to ack times circular array. If array is full, find and send
 * average.
 *
 * @param {number} deltaTime Time elapsed before ack is received.
 */
RelayCorpv4WsStream.prototype.recordAckTime_ = function(deltaTime) {
  this.ackTimes_[this.ackTimesIndex_] = deltaTime;
  this.ackTimesIndex_ = (this.ackTimesIndex_ + 1) % this.ackTimes_.length;

  if (this.ackTimesIndex_ === 0) {
    // Filled the circular buffer, compute average.
    const ackTimeSum = this.ackTimes_.reduce(
        (sum, ackTime) => sum + ackTime, 0);
    const average = ackTimeSum / this.ackTimes_.length;

    // TODO: Report observed average to relay.
    this.googMetricsReporter_.reportLatency(average);
  }
};
