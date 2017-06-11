// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Test suite for the SSH agent message handling primitives in
 * nassh.agent.Message.
 */

nassh.agent.Message.Tests =
    new lib.TestManager.Suite('nassh.agent.Message.Tests');

nassh.agent.Message.Tests.addTest('rawMessage', function(result, cx) {
  const msg = new nassh.agent.Message(1, new Uint8Array([2, 3, 4]));
  const rawMsg = msg.rawMessage();
  result.assertEQ(Array.from(rawMsg), [0, 0, 0, 4, 1, 2, 3, 4]);

  result.pass();
});

nassh.agent.Message.Tests.addTest('eom', function(result, cx) {
  const msg = new nassh.agent.Message(1);
  result.assert(msg.eom(), 'empty message');
  msg.writeUint32(2);
  result.assert(!msg.eom(), 'non-empty message');
  msg.readUint32();
  result.assert(msg.eom(), 'end of non-empty message');

  result.pass();
});

nassh.agent.Message.Tests.addTest('readUint32', function(result, cx) {
  const msg = new nassh.agent.Message(
      1, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1]));
  result.assertEQ(msg.readUint32(), 0x01020304, 'big endian');
  result.assertEQ(msg.readUint32(), 0x05060708, 'correct offset');

  let exceptionThrown = false;
  try {
    msg.readUint32();
  } catch (_) {
    exceptionThrown = true;
  }
  result.assert(exceptionThrown, 'throw (end reached)');

  result.pass();
});

nassh.agent.Message.Tests.addTest('writeUint32', function(result, cx) {
  const msg = new nassh.agent.Message(1);

  let exceptionThrown = false;
  try {
    msg.writeUint32(0.5);
  } catch (_) {
    exceptionThrown = true;
  }
  result.assert(exceptionThrown, 'throw (unsafe integer)');

  msg.writeUint32(0x01020304);
  msg.writeUint32(0x05060708);
  result.assertEQ(Array.from(msg.data_), [1, 2, 3, 4, 5, 6, 7, 8]);

  result.pass();
});

nassh.agent.Message.Tests.addTest('readString', function(result, cx) {
  const msg = new nassh.agent.Message(
      1,
      new Uint8Array(
          [0, 0, 0, 3, 1, 2, 3, 0, 0, 0, 4, 4, 5, 6, 7, 0, 0, 0, 2, 8]));
  result.assertEQ(Array.from(msg.readString()), [1, 2, 3], 'valid length');
  result.assertEQ(Array.from(msg.readString()), [4, 5, 6, 7], 'correct offset');

  let exceptionThrown = false;
  try {
    msg.readString();
  } catch (_) {
    exceptionThrown = true;
  }
  result.assert(exceptionThrown, 'throw (end reached)');

  result.pass();
});

nassh.agent.Message.Tests.addTest('writeString', function(result, cx) {
  const msg = new nassh.agent.Message(1);

  let exceptionThrown = false;
  try {
    msg.writeString([1, 2, 3, 4]);
  } catch (_) {
    exceptionThrown = true;
  }
  result.assert(exceptionThrown, 'throw (not Uint8Array)');

  msg.writeString(new Uint8Array([1, 2, 3]));
  msg.writeString(new Uint8Array([4, 5, 6, 7]));
  result.assertEQ(
      Array.from(msg.data_), [0, 0, 0, 3, 1, 2, 3, 0, 0, 0, 4, 4, 5, 6, 7]);

  result.pass();
});

nassh.agent.Message.Tests.addTest('fromRawMessage', function(result, cx) {
  result.assertEQ(
      nassh.agent.Message.fromRawMessage(new Uint8Array([1, 2, 3, 4])), null,
      'raw message too short');
  result.assertEQ(
      nassh.agent.Message.fromRawMessage(new Uint8Array([0, 0, 0, 4, 1, 2, 3])),
      null, 'length field invalid (too small)');
  result.assertEQ(
      nassh.agent.Message.fromRawMessage(
          new Uint8Array([0, 0, 0, 4, 1, 2, 3, 4, 5])),
      null, 'length field invalid (too large)');

  result.pass();
});

// clang-format off
nassh.agent.Message.Tests.addTest(
    'fromRawMessage_requestIdentities', function(result, cx) {
  result.assertEQ(
      nassh.agent.Message.fromRawMessage(
          new Uint8Array([0, 0, 0, 5, 11, 1, 2, 3, 4])),
      null, 'invalid message (SSH_AGENTC_REQUEST_IDENTITIES)');
  const requestIdentitiesMsg =
      nassh.agent.Message.fromRawMessage(new Uint8Array([0, 0, 0, 1, 11]));
  result.assert(
      requestIdentitiesMsg.eom(), 'eom (SSH_AGENTC_REQUEST_IDENTITIES)');
  result.assertEQ(
      requestIdentitiesMsg.type, 11,
      'valid type (SSH_AGENTC_REQUEST_IDENTITIES)');
  result.assertEQ(
      Object.keys(requestIdentitiesMsg.fields).length, 0,
      'no fields (SSH_AGENTC_REQUEST_IDENTITIES)');

  result.pass();
});
// clang-format on

// clang-format off
nassh.agent.Message.Tests.addTest(
    'fromRawMessage_signRequest', function(result, cx) {
  result.assertEQ(
      nassh.agent.Message.fromRawMessage(new Uint8Array([
        0, 0, 0, 18, 13, 0, 0, 0, 2, 1, 2,
        6, 7, 8, 9,  0,  0, 0, 3, 3, 4, 5
      ])),
      null, 'invalid message (SSH_AGENTC_REQUEST_IDENTITIES)');
  const signRequestMsg = nassh.agent.Message.fromRawMessage(new Uint8Array([
    0, 0, 0, 18, 13, 0, 0, 0, 2, 1, 2, 0, 0, 0, 3, 3, 4, 5, 6, 7, 8, 9
  ]));
  result.assert(signRequestMsg.eom(), 'eom (SSH_AGENTC_SIGN_REQUEST)');
  result.assertEQ(
      signRequestMsg.type, 13, 'valid type (SSH_AGENTC_SIGN_REQUEST)');
  result.assertEQ(
      Object.keys(signRequestMsg.fields).length, 3,
      'three fields (SSH_AGENTC_SIGN_REQUEST)');
  result.assertEQ(
      Array.from(signRequestMsg.fields.keyBlob), [1, 2],
      'key blob (SSH_AGENTC_SIGN_REQUEST)');
  result.assertEQ(
      Array.from(signRequestMsg.fields.data), [3, 4, 5],
      'data (SSH_AGENTC_SIGN_REQUEST)');
  result.assertEQ(
      signRequestMsg.fields.flags, 0x06070809,
      'flags (SSH_AGENTC_SIGN_REQUEST)');

  result.pass();
});
// clang-format on
