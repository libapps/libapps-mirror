// Copyright 2021 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Unit tests for terminal_tmux.js.
 */

import {hterm} from '../../hterm/index.js';

import {MockFunction, MockObject} from './terminal_test_mocks.js';
import {DriverChannel, PseudoTmuxCommand, TmuxControllerDriver}
    from './terminal_tmux.js';
import * as tmux from './tmux.js';

// TODO(crbug.com/1252271): add all the missing tests.

const document = window.document;

describe('terminal_tmux.js', function() {

  describe('PseudoTmuxCommand', function() {

    beforeEach(function() {
      this.mockHtermTerminal = new MockObject();
      this.mockController = new MockObject();
      this.pseudoTmuxCommand = new PseudoTmuxCommand(
          /** @type {!hterm.Terminal} */(this.mockHtermTerminal.proxy),
          /** @type {!tmux.Controller} */(this.mockController.proxy),
      );

      // Add a few shortcut functions.
      this.controllerHistory =
          (method) => this.mockController.getMethodHistory(method);
      this.controllerLastArgs =
          (method) => this.mockController.getMethodLastArgs(method);
    });

    describe('onUserInput', function() {
      [
        {name: 'ctrl-c', code: '\x03'},
        {name: 'ctrl-d', code: '\x04'},
      ].forEach(function({name, code}) {
        it(`detaches on ${name}`, function() {
          assert.equal(this.controllerHistory('detach').length, 0);
          this.pseudoTmuxCommand.onUserInput(code);
          assert.equal(this.controllerHistory('detach').length, 1);
        });
      });

      it('backspace', function() {
        this.pseudoTmuxCommand.onUserInput('hello');
        assert.equal(this.pseudoTmuxCommand.buffer_, 'hello');
        this.pseudoTmuxCommand.onUserInput('\x7f');
        assert.equal(this.pseudoTmuxCommand.buffer_, 'hell');
      });

      it('sends command on enter', function() {
        this.pseudoTmuxCommand.onUserInput('hello');
        assert.equal(this.controllerHistory('queueCommand').length, 0);

        this.pseudoTmuxCommand.onUserInput('\r');
        assert.equal(this.controllerHistory('queueCommand').length, 1);
        assert.equal(this.controllerLastArgs('queueCommand')[0], 'hello');
      });

      it('supports user input before the last command returns', function() {
        this.pseudoTmuxCommand.onUserInput('hello\r');
        assert.equal(this.controllerHistory('queueCommand').length, 1);
        assert.equal(this.controllerLastArgs('queueCommand')[0], 'hello');

        // More user input without calling the last command callback.
        this.pseudoTmuxCommand.onUserInput('world\r');
        assert.equal(this.controllerHistory('queueCommand').length, 2);
        assert.equal(this.controllerLastArgs('queueCommand')[0], 'world');
      });
    });
  });

  describe('DriverChannel', function() {
    beforeEach(function() {
      this.onRequestOpenWindowMock = new MockFunction();
      this.driverChannel = new DriverChannel(
          this.onRequestOpenWindowMock.proxy);

      this.onMessageMock = new MockFunction();
      this.broadcastChannel = new BroadcastChannel(
          this.driverChannel.channelName);
      this.broadcastChannel.onmessage = this.onMessageMock.proxy;

      this.requestOpenWindowWrapper = async function() {
        try {
          return {
            windowChannelName: await DriverChannel.requestOpenWindow(
                this.driverChannel.channelName),
          };
        } catch (error) {
          return {error: error.message};
        }
      };
    });

    afterEach(function() {
      this.broadcastChannel.close();
    });

    [{
      windowChannelName: 'channel-1',
    }, {
      error: 'error-1',
    }].forEach(function(testData) {
      it('requestOpenWindow() and resolve()', async function() {
        assert.equal(this.onMessageMock.getHistory().length, 0);

        const requestPromise = this.requestOpenWindowWrapper();
        await this.onMessageMock.whenCalled();
        const id = this.onMessageMock.popHistory()[0][0].data.id;

        this.driverChannel.resolve('wrongid', 'channel-2', undefined);
        this.driverChannel.resolve(id, testData.windowChannelName,
            testData.error);

        assert.deepEqual(await requestPromise, testData);
      });
    });

  });

  describe('TmuxControllerDriver', function() {
    beforeEach(function() {
      this.termMock = new MockObject({io: (new MockObject()).proxy});
      this.onOpenWindowMock = new MockFunction();
      this.driver = new TmuxControllerDriver({
        term: /** @type {!hterm.Terminal} */(this.termMock.proxy),
        onOpenWindow: this.onOpenWindowMock.proxy,
      });
    });

    it('open window', function() {
      this.driver.onStart_();

      this.driver.openWindow_({windowId: '@123', controller: new MockObject()});
      const serverWindows = Array.from(this.driver.serverWindows_);
      assert.equal(serverWindows.length, 1);
      assert.deepEqual(
          this.onOpenWindowMock.popHistory().map(
              ([{driver, channelName}]) => channelName),
          [serverWindows[0].channelName],
      );

      this.driver.onStop_();
    });

    it('open window with pending request', function() {
      const driverChannelMock = new MockObject();
      this.driver.driverChannel_ = driverChannelMock.proxy;

      this.driver.onStart_();

      this.driver.onRequestOpenWindow_('abc');

      this.driver.openWindow_({windowId: '@123', controller: new MockObject()});
      const serverWindows = Array.from(this.driver.serverWindows_);
      assert.equal(serverWindows.length, 1);
      // onOpenWindow() shouldn't be called since there is a pending request.
      assert.equal(this.onOpenWindowMock.popHistory().length, 0);

      assert.deepEqual(driverChannelMock.popMethodHistory('resolve'),
          [['abc', serverWindows[0].channelName, undefined]]);

      this.driver.onStop_();
    });

  });

});
