// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Stream for connecting to a ssh server via a Corp relay.
 */

/**
 * Base class of XHR or WebSocket backed streams.
 *
 * This class implements session initialization and back-off logic common for
 * both types of streams.
 *
 * @param {number} fd
 * @constructor
 * @extends {nassh.Stream}
 */
nassh.Stream.RelayCorp = function(fd) {
  nassh.Stream.apply(this, [fd]);

  this.host_ = null;
  this.port_ = null;
  this.relay_ = null;

  this.sessionID_ = null;

  this.backoffMS_ = 0;
  this.backoffTimeout_ = null;

  this.writeBuffer_ = nassh.buffer.new();
  // The total byte count we've written during this session.
  this.writeCount_ = 0;
  this.onWriteSuccess_ = null;

  this.readCount_ = 0;
};

/**
 * We are a subclass of nassh.Stream.
 */
nassh.Stream.RelayCorp.prototype = Object.create(nassh.Stream.prototype);
/** @override */
nassh.Stream.RelayCorp.constructor = nassh.Stream.RelayCorp;

/**
 * Open a relay socket.
 *
 * This fires off the /proxy request, and if it succeeds starts the /read
 * hanging GET.
 *
 * @param {!Object} settings
 * @param {function(boolean, ?string=)} onComplete
 * @override
 */
nassh.Stream.RelayCorp.prototype.asyncOpen = function(settings, onComplete) {
  this.relay_ = settings.relay;
  this.host_ = settings.host;
  this.port_ = settings.port;
  this.resume_ = settings.resume;

  const sessionRequest = new XMLHttpRequest();

  const onError = () => {
    console.error('Failed to get session id:', sessionRequest);
    onComplete(false, `${sessionRequest.status}: ${sessionRequest.statusText}`);
  };

  const onReady = () => {
    if (sessionRequest.readyState != XMLHttpRequest.DONE) {
      return;
    }

    if (sessionRequest.status != 200) {
      return onError();
    }

    this.sessionID_ = sessionRequest.responseText;
    this.resumeRead_();
    onComplete(true);
  };

  sessionRequest.open('GET', this.relay_.relayServer +
                      'proxy?host=' + this.host_ + '&port=' + this.port_,
                      true);
  sessionRequest.withCredentials = true;  // We need to see cookies for /proxy.
  sessionRequest.onabort = sessionRequest.ontimeout =
      sessionRequest.onerror = onError;
  sessionRequest.onloadend = onReady;
  sessionRequest.send();
};

/** Resume read. */
nassh.Stream.RelayCorp.prototype.resumeRead_ = function() {
  throw nassh.Stream.ERR_NOT_IMPLEMENTED;
};

/**
 * Queue up some data to write.
 *
 * @param {!ArrayBuffer} data
 * @param {function(number)} onSuccess
 * @override
 */
nassh.Stream.RelayCorp.prototype.asyncWrite = function(data, onSuccess) {
  if (!data.byteLength) {
    return;
  }

  this.writeBuffer_.write(data);
  this.onWriteSuccess_ = onSuccess;

  if (!this.backoffTimeout_) {
    this.sendWrite_();
  }
};

/**
 * Send the next pending write.
 */
nassh.Stream.RelayCorp.prototype.sendWrite_ = function() {
  throw nassh.Stream.ERR_NOT_IMPLEMENTED;
};

/**
 * Indicates that the backoff timer has expired and we can try again.
 *
 * This does not guarantee that communications have been restored, only
 * that we can try again.
 */
nassh.Stream.RelayCorp.prototype.onBackoffExpired_ = function() {
  this.backoffTimeout_ = null;
  this.resumeRead_();
  this.sendWrite_();
};

/**
 * Called after a successful read or write to indicate that communication
 * is working as expected.
 *
 * @param {boolean} isRead
 */
nassh.Stream.RelayCorp.prototype.requestSuccess_ = function(isRead) {
  this.backoffMS_ = 0;

  if (this.backoffTimeout_) {
    // Sometimes we end up clearing the backoff before the timeout actually
    // expires.  This is the case if a read and write request are in progress
    // and one fails while the other succeeds.  If the success completes *after*
    // the failure, we end up here.
    //
    // We assume we're free to clear the backoff and continue as normal.
    clearTimeout(this.backoffTimeout_);
    this.onBackoffExpired_();
  } else {
    if (isRead) {
      this.resumeRead_();
    } else {
      this.sendWrite_();
    }
  }
};

/** @param {boolean} isRead */
nassh.Stream.RelayCorp.prototype.requestError_ = function(isRead) {
  if (!this.sessionID_ || this.backoffTimeout_) {
    return;
  }

  if (!this.backoffMS_) {
    this.backoffMS_ = 1;
  } else {
    this.backoffMS_ = this.backoffMS_ * 2 + 13;
    if (this.backoffMS_ > 10000) {
      this.backoffMS_ = 10000 - (this.backoffMS_ % 9000);
    }
  }

  const requestType = isRead ? 'read' : 'write';
  console.log('Error during ' + requestType +
              ', backing off: ' + this.backoffMS_ + 'ms');

  if (this.backoffMS_ >= 1000) {
    // Browser timeouts tend to have a wide margin for error.  We want to reduce
    // the risk that a failed retry will redisplay this message just as its
    // fading away.  So we show the retry message for a little longer than we
    // expect to back off.
    this.relay_.io.showOverlay(nassh.msg('RELAY_RETRY'), this.backoffMS_ + 500);
  }

  this.backoffTimeout_ =
      setTimeout(this.onBackoffExpired_.bind(this), this.backoffMS_);
};

/**
 * XHR backed stream.
 *
 * This class manages the read and write XML http requests used to communicate
 * with the Google relay server.
 *
 * @param {number} fd
 * @constructor
 * @extends {nassh.Stream.RelayCorp}
 */
nassh.Stream.RelayCorpXHR = function(fd) {
  nassh.Stream.RelayCorp.apply(this, [fd]);

  this.writeRequest_ = new XMLHttpRequest();
  this.writeRequest_.ontimeout = this.writeRequest_.onabort =
      this.writeRequest_.onerror = this.onRequestError_.bind(this);
  this.writeRequest_.onloadend = this.onWriteDone_.bind(this);

  this.readRequest_ = new XMLHttpRequest();
  this.readRequest_.ontimeout = this.readRequest_.onabort =
      this.readRequest_.onerror = this.onRequestError_.bind(this);
  this.readRequest_.onloadend = this.onReadReady_.bind(this);

  this.lastWriteSize_ = 0;
};

/**
 * We are a subclass of nassh.Stream.RelayCorp.
 */
nassh.Stream.RelayCorpXHR.prototype =
    Object.create(nassh.Stream.RelayCorp.prototype);
/** @override */
nassh.Stream.RelayCorpXHR.constructor = nassh.Stream.RelayCorpXHR;

/**
 * Maximum length of message that can be sent to avoid request limits.
 */
nassh.Stream.RelayCorpXHR.prototype.maxMessageLength = 1024;

/**
 * Resume read.
 *
 * @override
 */
nassh.Stream.RelayCorpXHR.prototype.resumeRead_ = function() {
  if (this.isRequestBusy_(this.readRequest_)) {
    // Read request is in progress.
    return;
  }

  if (this.backoffTimeout_) {
    console.warn('Attempt to read while backing off.');
    return;
  }

  this.readRequest_.open('GET', this.relay_.relayServer + 'read?sid=' +
                         this.sessionID_ + '&rcnt=' + this.readCount_, true);
  this.readRequest_.send();
};

/**
 * Send the next pending write.
 *
 * @override
 */
nassh.Stream.RelayCorpXHR.prototype.sendWrite_ = function() {
  if (this.writeBuffer_.isEmpty() || this.isRequestBusy_(this.writeRequest_)) {
    // Nothing to write, or a write is in progress.
    return;
  }

  if (this.backoffTimeout_) {
    console.warn('Attempt to write while backing off.');
    return;
  }

  const dataBuffer = this.writeBuffer_.read(this.maxMessageLength);
  const data = nassh.base64ToBase64Url(btoa(
      lib.codec.codeUnitArrayToString(dataBuffer)));
  this.writeRequest_.open('GET', this.relay_.relayServer +
                          'write?sid=' + this.sessionID_ +
                          '&wcnt=' + this.writeCount_ + '&data=' + data, true);
  this.writeRequest_.send();
  this.lastWriteSize_ = dataBuffer.length;
};

/**
 * Called when the readRequest_ has finished loading.
 *
 * This indicates that the response entity has the data for us to send to the
 * terminal.
 *
 * @param {!Event} e
 */
nassh.Stream.RelayCorpXHR.prototype.onReadReady_ = function(e) {
  if (this.readRequest_.readyState != XMLHttpRequest.DONE) {
    return;
  }

  if (this.readRequest_.status == 410) {
    // HTTP 410 Gone indicates that the relay has dropped our ssh session.
    this.close();
    this.sessionID_ = null;
    return;
  }

  if (this.readRequest_.status != 200) {
    this.onRequestError_(e);
    return;
  }

  this.readCount_ += Math.floor(
      this.readRequest_.responseText.length * 3 / 4);
  const data = nassh.base64UrlToBase64(this.readRequest_.responseText);
  this.onDataAvailable(data);

  this.requestSuccess_(true);
};

/**
 * Called when the writeRequest_ has finished loading.
 *
 * This indicates that data we wrote has either been successfully written, or
 * failed somewhere along the way.
 *
 * @param {!Event} e
 */
nassh.Stream.RelayCorpXHR.prototype.onWriteDone_ = function(e) {
  if (this.writeRequest_.readyState != XMLHttpRequest.DONE) {
    return;
  }

  if (this.writeRequest_.status == 410) {
    // HTTP 410 Gone indicates that the relay has dropped our ssh session.
    this.close();
    return;
  }

  if (this.writeRequest_.status != 200) {
    this.onRequestError_(e);
    return;
  }

  this.writeBuffer_.ack(this.lastWriteSize_);
  this.writeCount_ += this.lastWriteSize_;

  this.requestSuccess_(false);

  if (typeof this.onWriteSuccess_ == 'function') {
    this.onWriteSuccess_(this.writeCount_);
  }
};

/** @param {!Event} e */
nassh.Stream.RelayCorpXHR.prototype.onRequestError_ = function(e) {
  this.requestError_(e.target == this.readRequest_);
};

/**
 * Returns true if the given XHR is busy.
 *
 * @param {!XMLHttpRequest} r
 * @return {boolean}
 */
nassh.Stream.RelayCorpXHR.prototype.isRequestBusy_ = function(r) {
  return (r.readyState != XMLHttpRequest.DONE &&
          r.readyState != XMLHttpRequest.UNSENT);
};

/**
 * WebSocket backed stream.
 *
 * This class manages the read and write through WebSocket to communicate
 * with the Google relay server.
 *
 * @param {number} fd
 * @constructor
 * @extends {nassh.Stream.RelayCorp}
 */
nassh.Stream.RelayCorpWS = function(fd) {
  nassh.Stream.RelayCorp.apply(this, [fd]);

  this.socket_ = null;

  // Amount of data in buffer that were sent but not acknowledged yet.
  this.sentCount_ = 0;

  // Time when data was sent most recently.
  this.ackTime_ = 0;

  // Ack related to most recently sent data.
  this.expectedAck_ = 0;

  // Circular list of recently observed ack times.
  this.ackTimes_ = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  // Slot to record next ack time in.
  this.ackTimesIndex_ = 0;

  // Number of connect attempts made.
  this.connectCount_ = 0;
};

/**
 * We are a subclass of nassh.Stream.RelayCorp.
 */
nassh.Stream.RelayCorpWS.prototype =
    Object.create(nassh.Stream.RelayCorp.prototype);
/** @override */
nassh.Stream.RelayCorpWS.constructor = nassh.Stream.RelayCorpWS;

/**
 * Maximum length of message that can be sent to avoid request limits.
 * -4 for 32-bit ack that is sent before payload.
 */
nassh.Stream.RelayCorpWS.prototype.maxMessageLength = 32 * 1024 - 4;

/**
 * Resume read.
 *
 * @override
 */
nassh.Stream.RelayCorpWS.prototype.resumeRead_ = function() {
  if (this.backoffTimeout_) {
    console.warn('Attempt to read while backing off.');
    return;
  }

  if (this.sessionID_ && !this.socket_) {
    let uri = this.relay_.relayServerSocket +
        'connect?sid=' + this.sessionID_ +
        '&ack=' + (this.readCount_ & 0xffffff) +
        '&pos=' + (this.writeCount_ & 0xffffff);
    if (this.relay_.reportConnectAttempts) {
      uri += '&try=' + ++this.connectCount_;
    }
    this.socket_ = new WebSocket(uri);
    this.socket_.binaryType = 'arraybuffer';
    this.socket_.onopen = this.onSocketOpen_.bind(this);
    this.socket_.onmessage = this.onSocketData_.bind(this);
    this.socket_.onclose = this.socket_.onerror =
        this.onSocketError_.bind(this);

    this.sentCount_ = 0;
  }
};

/** @param {!Event} e */
nassh.Stream.RelayCorpWS.prototype.onSocketOpen_ = function(e) {
  if (e.target !== this.socket_) {
    return;
  }

  this.connectCount_ = 0;
  this.requestSuccess_(false);
};

/** @param {number} deltaTime */
nassh.Stream.RelayCorpWS.prototype.recordAckTime_ = function(deltaTime) {
  this.ackTimes_[this.ackTimesIndex_] = deltaTime;
  this.ackTimesIndex_ = (this.ackTimesIndex_ + 1) % this.ackTimes_.length;

  if (this.ackTimesIndex_ == 0) {
    // Filled the circular buffer; compute average.
    let average = 0;
    for (let i = 0; i < this.ackTimes_.length; ++i) {
      average += this.ackTimes_[i];
    }
    average /= this.ackTimes_.length;

    if (this.relay_.reportAckLatency) {
      // Report observed average to relay.
      // Send this meta-data as string vs. the normal binary payloads.
      const msg = 'A:' + Math.round(average);
      this.socket_.send(msg);
    }
  }
};

/** @param {!Event} e */
nassh.Stream.RelayCorpWS.prototype.onSocketData_ = function(e) {
  if (e.target !== this.socket_) {
    return;
  }

  const dv = new DataView(e.data);
  const ack = dv.getUint32(0);

  // Acks are unsigned 24 bits. Negative means error.
  if (ack > 0xffffff) {
    this.close();
    this.sessionID_ = null;
    return;
  }

  // Track ack latency.
  if (this.ackTime_ != 0 && ack == this.expectedAck_) {
    this.recordAckTime_(Date.now() - this.ackTime_);
    this.ackTime_ = 0;
  }

  // Unsigned 24 bits wrap-around delta.
  const delta = ((ack & 0xffffff) - (this.writeCount_ & 0xffffff)) & 0xffffff;
  this.writeBuffer_.ack(delta);
  this.sentCount_ -= delta;
  this.writeCount_ += delta;

  // This creates a copy of the ArrayBuffer, but there doesn't seem to be an
  // alternative -- PPAPI doesn't accept views like Uint8Array.  And if it did,
  // it would probably still serialize the entire underlying ArrayBuffer (which
  // in this case wouldn't be a big deal as it's only 4 extra bytes).
  const data = e.data.slice(4);
  if (data.byteLength) {
    this.onDataAvailable(data);
    this.readCount_ += data.byteLength;
  }

  // isRead == false since for WebSocket we don't need to send another read
  // request, we will get new data as soon as it comes.
  this.requestSuccess_(false);
};

/** @param {!Event} e */
nassh.Stream.RelayCorpWS.prototype.onSocketError_ = function(e) {
  if (e.target !== this.socket_) {
    return;
  }

  this.socket_.close();
  this.socket_ = null;
  if (this.resume_) {
    this.requestError_(true);
  } else {
    nassh.Stream.prototype.close.call(this);
  }
};

/**
 * Send write.
 *
 * @override
 */
nassh.Stream.RelayCorpWS.prototype.sendWrite_ = function() {
  if (!this.socket_ || this.socket_.readyState != 1 ||
      this.writeBuffer_.isEmpty()) {
    // Nothing to write or socket is not ready.
    return;
  }

  if (this.backoffTimeout_) {
    console.warn('Attempt to write while backing off.');
    return;
  }

  // If we've queued too much already, go back to sleep.
  // NB: This check is fuzzy at best, so we don't need to include the size of
  // the data we're about to write below into the calculation.
  if (this.socket_.bufferedAmount >= this.maxWebSocketBufferLength) {
    setTimeout(this.sendWrite_.bind(this));
    return;
  }

  const dataBuffer = this.writeBuffer_.read(this.maxMessageLength);
  const buf = new ArrayBuffer(dataBuffer.length + 4);
  const u8 = new Uint8Array(buf, 4);
  const dv = new DataView(buf);

  // Every ws.send() maps to a Websocket frame on wire.
  // Use first 4 bytes to send ack.
  dv.setUint32(0, this.readCount_ & 0xffffff);

  // Copy over the buffer.
  u8.set(dataBuffer);

  this.socket_.send(buf);
  this.sentCount_ += dataBuffer.length;

  // Track ack latency.
  this.ackTime_ = Date.now();
  this.expectedAck_ = (this.writeCount_ + this.sentCount_) & 0xffffff;

  if (typeof this.onWriteSuccess_ == 'function') {
    // Notify nassh that we are ready to consume more data.
    this.onWriteSuccess_(this.writeCount_ + this.sentCount_);
  }

  if (!this.writeBuffer_.isEmpty()) {
    // We have more data to send but due to message limit we didn't send it.
    // We don't know when data was sent so just send new portion async.
    setTimeout(this.sendWrite_.bind(this), 0);
  }
};
