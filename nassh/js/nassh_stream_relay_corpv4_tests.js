// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Corp v4 relay stream tests.
 */

import {ClientAckPacket, ClientDataPacket, RelayCorpv4WsStream,
        ServerPacket} from './nassh_stream_relay_corpv4.js';

/**
 * @extends {WebSocket}
 */
class WebSocketMock {
  constructor() {
    this.readyState = WebSocket.CONNECTING;
    this.socketData = [];
  }

  /**
   * @param {!ArrayBuffer|!ArrayBufferView|!Blob|string} data
   * @override
   */
  send(data) {
    this.socketData.push(data);
  }

  /** @override */
  close() {
    this.readyState = WebSocket.CLOSED;
  }
}

/**
 * Check parsing of "empty" packets.
 */
it('ServerPacket empty', () => {
  // Big enough for the 16-bit tag.
  const buffer = new ArrayBuffer(2);
  const packet = new ServerPacket(buffer);
  assert.equal(0, packet.tag);
});

/**
 * Check parsing of unknown tags.
 */
it('ServerPacket unknown', () => {
  const u8 = new Uint8Array([
    // Tag.
    0x12, 0x34,
  ]);
  const packet = new ServerPacket(u8.buffer);
  assert.equal(0x1234, packet.tag);
});

/**
 * Check parsing of connect success commands.
 */
it('ServerPacket connect success', () => {
  const te = new TextEncoder();
  const u8 = new Uint8Array([
    // Tag.
    0x00, 0x01,
    // Length.
    0x00, 0x00, 0x00, 0x09,
    // SID.
    ...te.encode('abc_d-ef$'),
  ]);
  const packet = new ServerPacket(u8.buffer);
  assert.equal(1, packet.tag);
  assert.equal('abc_d-ef$', packet.sid);
});

/**
 * Check parsing of reconnect success commands.
 */
it('ServerPacket reconnect success', () => {
  const u8 = new Uint8Array([
    // Tag.
    0x00, 0x02,
    // Ack.
    0x00, 0x01, 0x20, 0x00, 0x30, 0x00, 0x40, 0x00,
  ]);
  const packet = new ServerPacket(u8.buffer);
  assert.equal(2, packet.tag);
  assert.equal(0x1200030004000, packet.ack);
});

/**
 * Check parsing of data commands.
 */
it('ServerPacket data', () => {
  const u8 = new Uint8Array([
    // Tag.
    0x00, 0x04,
    // Length.
    0x00, 0x00, 0x00, 0x09,
    // Data.
    0xf0, 0xff, 0xfe, 0xa0, 0x00, 0x10, 0x20, 0x01, 0x3f,
  ]);
  const packet = new ServerPacket(u8.buffer);
  assert.equal(4, packet.tag);
  assert.equal(9, packet.length);
  assert.deepStrictEqual(
      new Uint8Array([0xf0, 0xff, 0xfe, 0xa0, 0x00, 0x10, 0x20, 0x01, 0x3f]),
      packet.data);
});

/**
 * Check parsing of ack commands.
 */
it('ServerPacket ack', () => {
  const u8 = new Uint8Array([
    // Tag.
    0x00, 0x07,
    // Ack.
    0x00, 0x01, 0x20, 0x00, 0x30, 0x00, 0x40, 0x00,
  ]);
  const packet = new ServerPacket(u8.buffer);
  assert.equal(7, packet.tag);
  assert.equal(0x1200030004000, packet.ack);
});

/**
 * Check creating data packets.
 */
it('ClientDataPacket', () => {
  const data = new Uint8Array([0xf0, 0xff, 0xfe, 0xa0, 0x00, 0x10, 0x01, 0x3f]);
  const packet = new ClientDataPacket(data);
  assert.equal(4, packet.tag);
  assert.equal(8, packet.length);
  assert.deepStrictEqual(data, packet.data);
  assert.deepStrictEqual(new Uint8Array([
    0x00, 0x04,
    0x00, 0x00, 0x00, 0x08,
    0xf0, 0xff, 0xfe, 0xa0, 0x00, 0x10, 0x01, 0x3f,
  ]), new Uint8Array(packet.frame));
});

/**
 * Check creating ack packets.
 */
it('ClientAckPacket', () => {
  const packet = new ClientAckPacket(BigInt(0x123678));
  assert.equal(7, packet.tag);
  assert.equal(0x123678, packet.ack);
  assert.deepStrictEqual(new Uint8Array([
    0x00, 0x07,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x12, 0x36, 0x78,
  ]), new Uint8Array(packet.frame));
});

/**
 * Connect, send some data, disconnect.
 */
it('RelayCorpv4WS basic', async () => {
  // Initialize state.
  const stream = new RelayCorpv4WsStream();
  /** @this {RelayCorpv4WsStream} */
  stream.connect_ = function() {
    this.socket_ = new WebSocketMock();
  };
  const streamData = [];
  stream.onDataAvailable = (data) => {
    streamData.push(Array.from(new Uint8Array(data)));
  };
  let streamClosed;
  stream.onClose = () => {
    streamClosed = true;
  };

  // A write should be queued.
  await stream.write(new Uint8Array([0xa0]).buffer);
  assert.equal(0, stream.writeCount_);

  // Start the connection.
  const open = stream.open({});
  const socketData = /** @type {!WebSocketMock} */ (stream.socket_).socketData;

  // Writes should still be queued.
  await stream.write(new Uint8Array([0xa1]).buffer);
  assert.equal(0, stream.writeCount_);

  // The connection is opened.
  stream.socket_.readyState = WebSocket.OPEN;
  stream.onSocketOpen_(new Event('open'));

  // Wait for the open to finish now that it's "connected".
  await open;

  // We queued a write, but didn't call it.
  assert.equal(0, stream.writeCount_);

  // Handle CONNECT SUCCESS message from the server.
  stream.onSocketData_(new MessageEvent('message', {
    data: new Uint8Array([
      0x00, 0x01, 0x00, 0x00, 0x00, 0x03, 0x53, 0x49, 0x44,
    ]).buffer,
  }));
  assert.equal('SID', stream.sid_);
  assert.equal(0, stream.readCount_);

  // Handle DATA message from the server.
  stream.onSocketData_(new MessageEvent('message', {
    data: new Uint8Array([
      0x00, 0x04, 0x00, 0x00, 0x00, 0x03, 0xff, 0x00, 0x03,
    ]).buffer,
  }));
  assert.equal(3, stream.readCount_);
  assert.deepStrictEqual([0xff, 0x00, 0x03], streamData[0]);

  // Check the ACK we sent for it.
  assert.deepStrictEqual(new Uint8Array([
    0x00, 0x07,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03,
  ]), new Uint8Array(socketData[0]));

  // Reschedule ourselves to allow the stream to attempt some writes.
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.deepStrictEqual(new Uint8Array([
    0x00, 0x04,
    0x00, 0x00, 0x00, 0x02,
    0xa0, 0xa1,
  ]), new Uint8Array(socketData[1]));
  assert.equal(2, stream.writeCount_);

  // Close the socket.
  assert.isNotTrue(streamClosed);
  stream.onSocketClose_(new CloseEvent('close', {code: 1006, reason: ''}));
  assert.isTrue(streamClosed);
});

/**
 * Receive onSocketError() before completing connect.
 */
it('RelayCorpv4WS error in connect', async () => {
  // Initialize state.
  const stream = new RelayCorpv4WsStream();
  /** @this {RelayCorpv4WsStream} */
  stream.connect_ = function() {
    this.socket_ = new WebSocketMock();
    this.onSocketError_(/** @type {!Event} */ ({}));
  };

  // Start the connection, then get server error.
  await stream.open({}).catch((e) => {
    assert.equal('server sent an error', e);
  });
});

/**
 * Reconnect on dirty close.
 */
it('RelayCorpv4WS reconnect on dirty close', async () => {
  // Initialize state.
  const stream = new RelayCorpv4WsStream();
  /** @this {RelayCorpv4WsStream} */
  stream.connect_ = function() {
    this.socket_ = new WebSocketMock();
    this.onSocketOpen_(new Event('open'));
  };
  let closeReason;
  stream.close_ = (reason) => {
    closeReason = reason;
  };
  let reconnectCalled = false;
  stream.reconnect_ = () => {
    reconnectCalled = true;
    return true;
  };

  // Start the connection.
  await stream.open({});

  // Clean close - closes with no reconnect.
  const e = /** @type {!CloseEvent} */(
      {wasClean: true, code: 'foo', reason: 'bar'});
  stream.onSocketClose_(e);
  assert.isFalse(reconnectCalled);
  assert.equal('server closed socket: [foo] bar', closeReason);

  // Dirty close - reconnects.
  e.wasClean = false;
  closeReason = null;
  stream.onSocketClose_(e);
  assert.isTrue(reconnectCalled);
  assert.isNull(closeReason);
});
