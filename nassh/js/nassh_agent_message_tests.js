// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test suite for the SSH agent message handling primitives in
 *     Message.
 */

import {Message} from './nassh_agent_message.js';
import {MessageNumbers} from './nassh_agent_message_types.js';

describe('nassh_agent_message_tests.js', () => {

it('rawMessage', () => {
  const msg = new Message(
      MessageNumbers.AGENT_SUCCESS,
      new Uint8Array([2, 3, 4]));
  const rawMsg = msg.rawMessage();
  assert.deepStrictEqual(Array.from(rawMsg), [0, 0, 0, 4, 6, 2, 3, 4]);
});

it('eom', () => {
  const msg = new Message(MessageNumbers.AGENT_SUCCESS);
  assert.isTrue(msg.eom(), 'empty message');
  msg.writeUint32(2);
  assert.isTrue(!msg.eom(), 'non-empty message');
  msg.readUint32();
  assert.isTrue(msg.eom(), 'end of non-empty message');
});

it('readUint32', () => {
  const msg = new Message(
      MessageNumbers.AGENT_SUCCESS,
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1]));
  assert.equal(msg.readUint32(), 0x01020304, 'big endian');
  assert.equal(msg.readUint32(), 0x05060708, 'correct offset');

  // Check end reached.
  assert.throws(() => msg.readUint32());
});

it('writeUint32', /** @suppress {visibility} msg.data_ */ () => {
  const msg = new Message(MessageNumbers.AGENT_SUCCESS);

  // Check unsafe integer.
  assert.throws(() => msg.writeUint32(0.5));

  msg.writeUint32(0x01020304);
  msg.writeUint32(0x05060708);
  assert.deepStrictEqual(Array.from(msg.data_), [1, 2, 3, 4, 5, 6, 7, 8]);
});

it('readString', () => {
  const msg = new Message(
      MessageNumbers.AGENT_SUCCESS,
      new Uint8Array(
          [0, 0, 0, 3, 1, 2, 3, 0, 0, 0, 4, 4, 5, 6, 7, 0, 0, 0, 2, 8]));
  assert.deepStrictEqual(Array.from(msg.readString()), [1, 2, 3],
                         'valid length');
  assert.deepStrictEqual(Array.from(msg.readString()), [4, 5, 6, 7],
                         'correct offset');

  // Check end reached.
  assert.throws(() => msg.readString());
});

it('writeString', /** @suppress {visibility} msg.data_ */ () => {
  const msg = new Message(MessageNumbers.AGENT_SUCCESS);

  msg.writeString(new Uint8Array([1, 2, 3]));
  msg.writeString(new Uint8Array([4, 5, 6, 7]));
  assert.deepStrictEqual(
      Array.from(msg.data_), [0, 0, 0, 3, 1, 2, 3, 0, 0, 0, 4, 4, 5, 6, 7]);
});

it('fromRawMessage', () => {
  assert.strictEqual(
      Message.fromRawMessage(new Uint8Array([1, 2, 3, 4])), null,
      'raw message too short');
  assert.strictEqual(
      Message.fromRawMessage(new Uint8Array([0, 0, 0, 4, 1, 2, 3])),
      null, 'length field invalid (too small)');
  assert.strictEqual(
      Message.fromRawMessage(
          new Uint8Array([0, 0, 0, 4, 1, 2, 3, 4, 5])),
      null, 'length field invalid (too large)');
});

// clang-format off
it('fromRawMessage_requestIdentities', () => {
  assert.deepStrictEqual(
      Message.fromRawMessage(
          new Uint8Array([0, 0, 0, 5, 11, 1, 2, 3, 4])),
      null, 'invalid message (SSH_AGENTC_REQUEST_IDENTITIES)');
  const requestIdentitiesMsg =
      Message.fromRawMessage(new Uint8Array([0, 0, 0, 1, 11]));
  assert.isTrue(
      requestIdentitiesMsg.eom(), 'eom (SSH_AGENTC_REQUEST_IDENTITIES)');
  assert.equal(
      requestIdentitiesMsg.type, 11,
      'valid type (SSH_AGENTC_REQUEST_IDENTITIES)');
  assert.equal(
      Object.keys(requestIdentitiesMsg.fields).length, 0,
      'no fields (SSH_AGENTC_REQUEST_IDENTITIES)');
});
// clang-format on

// clang-format off
it('fromRawMessage_signRequest', () => {
  assert.deepStrictEqual(
      Message.fromRawMessage(new Uint8Array([
        0, 0, 0, 18, 13, 0, 0, 0, 2, 1, 2, 6, 7, 8, 9, 0, 0, 0, 3, 3, 4, 5,
      ])),
      null, 'invalid message (SSH_AGENTC_REQUEST_IDENTITIES)');
  const signRequestMsg = Message.fromRawMessage(new Uint8Array([
    0, 0, 0, 18, 13, 0, 0, 0, 2, 1, 2, 0, 0, 0, 3, 3, 4, 5, 6, 7, 8, 9,
  ]));
  assert.isTrue(signRequestMsg.eom(), 'eom (SSH_AGENTC_SIGN_REQUEST)');
  assert.equal(
      signRequestMsg.type, 13, 'valid type (SSH_AGENTC_SIGN_REQUEST)');
  assert.equal(
      Object.keys(signRequestMsg.fields).length, 3,
      'three fields (SSH_AGENTC_SIGN_REQUEST)');
  assert.deepStrictEqual(
      Array.from(signRequestMsg.fields.keyBlob), [1, 2],
      'key blob (SSH_AGENTC_SIGN_REQUEST)');
  assert.deepStrictEqual(
      Array.from(signRequestMsg.fields.data), [3, 4, 5],
      'data (SSH_AGENTC_SIGN_REQUEST)');
  assert.equal(
      signRequestMsg.fields.flags, 0x06070809,
      'flags (SSH_AGENTC_SIGN_REQUEST)');
});
// clang-format on

});
