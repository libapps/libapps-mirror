// Copyright 2025 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test suite for functions in nassh_google.js.
 */

import {fetchSshPolicy} from './nassh_google.js';

describe('nassh_google.js', () => {
  describe('fetchSshPolicy', () => {
    const sshPolicyResponse = 'get_ssh_policy_response';
    let mockResponseData;

    const mockSendMessage = (_, __, callback) => {
      const response = mockResponseData;

      if (callback) {
        setTimeout(() => callback(response), 0);
      } else {
        return Promise.resolve(response);
      }
    };

    const createSuccessData = (sshKnownHosts = '', sshConfig = '') => {
      mockResponseData = {
        'type': sshPolicyResponse,
        'data': {
          'sshKnownHosts': sshKnownHosts,
          'sshConfig': sshConfig,
        },
      };
    };

    // We need this assignment so that chrome.runtime wouldn't be undefined.
    /** @suppress {constantProperty} */
    chrome.runtime = chrome.runtime || {};
    /** @suppress {checkTypes} */
    chrome.runtime.sendMessage = mockSendMessage;

    it('returns sshPolicy in the correct shape', async () => {
      const sshKnownHosts = 'sshKnownHosts';
      const sshConfig = 'sshConfig';
      createSuccessData(sshKnownHosts, sshConfig);

      const response = await fetchSshPolicy();

      assert.equal(response.getSshKnownHosts(), sshKnownHosts);
      assert.equal(response.getSshConfig(), sshConfig);
    });

    it('returns sshPolicy with empty data if the data returned from SKE is ' +
      'empty', async () => {
        createSuccessData();

        const response = await fetchSshPolicy();

        assert.equal(response.getSshKnownHosts(), '');
        assert.equal(response.getSshConfig(), '');
      });

    it('returns sshPolicy with empty data if the data returned from SKE does ' +
      'not include the required key', async () => {
        mockResponseData = {
          'type': sshPolicyResponse,
          'data': {},
        };

        const response = await fetchSshPolicy();

        assert.equal(response.getSshKnownHosts(), '');
        assert.equal(response.getSshConfig(), '');
      });

    it('returns sshPolicy with empty data if the data returned from SKE ' +
      'includes malformed key', async () => {
        mockResponseData = {
          'type': sshPolicyResponse,
          'data': {
            'unknown_key': 'random_key',
          },
        };

        const response = await fetchSshPolicy();

        assert.equal(response.getSshKnownHosts(), '');
        assert.equal(response.getSshConfig(), '');
      });

    it('returns sshPolicy with empty data if the SKE returns ' +
      'error', async () => {
        mockResponseData = {
          'type': 'error_response',
          'errorDetail': 'test',
          'errorReason': 'other error',
          'requestId': 1847507321,
        };

        const response = await fetchSshPolicy();

        assert.equal(response.getSshKnownHosts(), '');
        assert.equal(response.getSshConfig(), '');
      });
  });
});
