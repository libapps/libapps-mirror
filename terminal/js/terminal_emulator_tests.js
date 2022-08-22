// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Unit tests for terminal_emulator.js.
 */

import {sleep} from './terminal_common.js';
import {XtermTerminal, XtermTerminalTestParams} from './terminal_emulator.js';
import {MockObject} from './terminal_test_mocks.js';

describe('terminal_emulator_tests.js', function() {
  describe('XtermTerminal', function() {
    beforeEach(async function() {
      this.mocks = {
        term: new MockObject({options: {}}),
        fontManager: new MockObject(),
        fitAddon: new MockObject(),
      };
      const testParams = {};
      for (const prop in this.mocks) {
        testParams[prop] = this.mocks[prop].proxy;
      }

      this.terminal = new XtermTerminal({
        storage: new lib.Storage.Memory(),
        profileId: 'test',
        enableWebGL: true,
        testParams: /** @type {!XtermTerminalTestParams} */(testParams),
      });
    });

    describe('updateFont_()', function() {
      it('updates font', async function() {
        const updateFontPromise = this.terminal.updateFont_('font one');
        assert.deepEqual(
            await this.mocks.fontManager.whenCalled('loadFont'),
            [['font one']]);
        assert.equal(this.mocks.term.baseObj.options.fontFamily, undefined);
        assert.isNotNull(this.terminal.pendingFont_);
        assert.deepEqual(this.mocks.fitAddon.getMethodHistory('fit'), []);

        await updateFontPromise;
        assert.equal(this.mocks.term.baseObj.options.fontFamily, 'font one');
        assert.isNull(this.terminal.pendingFont_);
        await sleep(0);
        assert.deepEqual(this.mocks.fitAddon.getMethodHistory('fit'), [[]]);
      });

      it('refresh font when the font is the same', async function() {
        this.mocks.term.baseObj.options.fontFamily = 'font one';
        const updateFontPromise = this.terminal.updateFont_('font one');
        assert.deepEqual(
            await this.mocks.fontManager.whenCalled('loadFont'),
            [['font one']]);
        assert.equal(this.mocks.term.baseObj.options.fontFamily, 'font one');
        assert.isNotNull(this.terminal.pendingFont_);
        assert.deepEqual(this.mocks.fitAddon.getMethodHistory('fit'), []);

        await updateFontPromise;
        // Note the extra space at the end.
        assert.equal(this.mocks.term.baseObj.options.fontFamily, 'font one ');
        assert.isNull(this.terminal.pendingFont_);
        await sleep(0);
        assert.deepEqual(this.mocks.fitAddon.getMethodHistory('fit'), [[]]);
      });

      it('aborts if pendingFont_ was changed', async function() {
        const updateFontPromise = this.terminal.updateFont_('font one');
        assert.deepEqual(
            await this.mocks.fontManager.whenCalled('loadFont'),
            [['font one']]);
        assert.equal(this.mocks.term.baseObj.options.fontFamily, undefined);
        assert.isNotNull(this.terminal.pendingFont_);
        assert.deepEqual(this.mocks.fitAddon.getMethodHistory('fit'), []);

        this.terminal.pendingFont_ = 'font two';

        await updateFontPromise;
        assert.equal(this.mocks.term.baseObj.options.fontFamily, undefined);
        assert.equal(this.terminal.pendingFont_, 'font two');
        await sleep(0);
        assert.deepEqual(this.mocks.fitAddon.getMethodHistory('fit'), []);
      });
    });
  });
});
