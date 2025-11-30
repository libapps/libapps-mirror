// Copyright 2025 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test suite for functions in nassh_google.js.
 */

import {fetchSshPolicy} from './nassh_google.js';

/**
 * A mock for the chrome.runtime.sendMessage API.
 */
class MockChromeRuntime {
  constructor() {
    // We need this assignment so that chrome.runtime wouldn't be undefined.
    /** @suppress {constantProperty} */
    chrome.runtime = chrome.runtime || {};
    this.originalSendMessage_ = chrome.runtime.sendMessage;
    this.mockResponseData_ = undefined;
  }

  /**
   * Starts the mock, replacing the original sendMessage with our mock version.
   */
  start() {
    chrome.runtime.sendMessage = (...args) => {
      const callback = args[args.length - 1];

      if (callback instanceof Function) {
        /** @type {function(*)} */
        const fn = callback;
        setTimeout(() => fn(this.mockResponseData_), 0);
      } else {
        return this.mockResponseData_;
      }
    };
  }

  /**
   * Stops the mock and restores the original sendMessage function.
   */
  stop() {
    chrome.runtime.sendMessage = this.originalSendMessage_;
  }

  /**
   * Sets the data that the mock sendMessage function will return.
   * @param {*} data The data to return.
   */
  setResponseData(data) {
    this.mockResponseData_ = data;
  }
}

  describe('fetchSshPolicy', function() {
    const sshPolicyResponse = 'get_ssh_policy_response';

    beforeEach(function() {
      this.mockRuntime = new MockChromeRuntime();
      this.mockRuntime.start();
      this.createSuccessData = (sshKnownHosts = '', sshConfig = '') => {
        this.mockRuntime.setResponseData({
          'type': sshPolicyResponse,
          'data': {
            sshKnownHosts,
            sshConfig,
          },
        });
      };
    });

    afterEach(function() {
      this.mockRuntime.stop();
    });

    it('returns sshPolicy in the correct shape', async function() {
      const sshKnownHosts = 'sshKnownHosts';
      const sshConfig = 'sshConfig';
      this.createSuccessData(sshKnownHosts, sshConfig);

      const response = await fetchSshPolicy();

      assert.equal(response.getSshKnownHosts(), sshKnownHosts);
      assert.equal(response.getSshConfig(), sshConfig);
    });

    it('returns sshPolicy with empty data if the data returned from SKE is ' +
      'empty', async function() {
        this.createSuccessData();

        const response = await fetchSshPolicy();

        assert.equal(response.getSshKnownHosts(), '');
        assert.equal(response.getSshConfig(), '');
      });

    it('returns sshPolicy with empty data if the data returned from SKE does ' +
      'not include the required key', async function() {
        this.createSuccessData();

        const response = await fetchSshPolicy();

        assert.equal(response.getSshKnownHosts(), '');
        assert.equal(response.getSshConfig(), '');
      });

    it('returns sshPolicy with empty data if the data returned from SKE ' +
      'includes malformed key', async function() {
        this.mockRuntime.setResponseData({
          'type': sshPolicyResponse,
          'data': {
            'unknown_key': 'random_key',
          },
        });

        const response = await fetchSshPolicy();

        assert.equal(response.getSshKnownHosts(), '');
        assert.equal(response.getSshConfig(), '');
      });

    it('returns sshPolicy with empty data if the SKE returns ' +
      'error', async function() {
        this.mockRuntime.setResponseData({
          'type': 'error_response',
          'errorDetail': 'test',
          'errorReason': 'other error',
          'requestId': 1847507321,
        });

        const response = await fetchSshPolicy();

        assert.equal(response.getSshKnownHosts(), '');
        assert.equal(response.getSshConfig(), '');
      });
  });
