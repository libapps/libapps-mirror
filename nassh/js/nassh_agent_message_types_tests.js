// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Test suite for the SSH agent message handling primitives in
 * nassh.agent.messages.
 */

nassh.agent.messages.Tests =
    new lib.TestManager.Suite('nassh.agent.messages.Tests');

nassh.agent.messages.Tests.addTest('write', function(result, cx) {
  result.assertEQ(
      nassh.agent.messages.write(1).type,
      nassh.agent.messages.Numbers.AGENT_FAILURE, 'invalid type');

  result.pass();
});

// clang-format off
nassh.agent.messages.Tests.addTest(
    'write_identitiesAnswer', function(result, cx) {
  const identitiesAnswerMsg = nassh.agent.messages.write(
      nassh.agent.messages.Numbers.AGENT_IDENTITIES_ANSWER, [
        {
          keyBlob: new Uint8Array([1, 2]),
          comment: new Uint8Array([3, 4, 5])
        },
        {
          keyBlob: new Uint8Array([6, 7, 8, 9]),
          comment: new Uint8Array()
        }
      ]);
  result.assertEQ(
      identitiesAnswerMsg.type,
      nassh.agent.messages.Numbers.AGENT_IDENTITIES_ANSWER,
      'type (SSH_AGENT_IDENTITIES_ANSWER)');
  result.assertEQ(
      Array.from(identitiesAnswerMsg.data_),
      [
        0, 0, 0, 2, 0, 0, 0, 2, 1, 2, 0, 0, 0, 3, 3,
        4, 5, 0, 0, 0, 4, 6, 7, 8, 9, 0, 0, 0, 0
      ],
      'data (SSH_AGENT_IDENTITIES_ANSWER)');

  result.pass();
});
// clang-format on

nassh.agent.messages.Tests.addTest('write_signResponse', function(result, cx) {
  const signResponseMsg = nassh.agent.messages.write(
      nassh.agent.messages.Numbers.AGENT_SIGN_RESPONSE,
      new Uint8Array([1, 2, 3, 4]));
  result.assertEQ(
      signResponseMsg.type, nassh.agent.messages.Numbers.AGENT_SIGN_RESPONSE,
      'type (SSH_AGENT_SIGN_RESPONSE)');
  result.assertEQ(
      Array.from(signResponseMsg.data_), [0, 0, 0, 4, 1, 2, 3, 4],
      'data (SSH_AGENT_SIGN_RESPONSE)');

  result.pass();
});
