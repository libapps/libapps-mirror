// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Unit tests for terminal_emulator.js.
 */

import {hterm, lib} from './deps_local.concat.js';

import {sleep} from './terminal_common.js';
import {A11yButtons, Modifier, XtermTerminal, XtermTerminalTestParams,
  encodeKeyCombo} from './terminal_emulator.js';
import {MockFunction, MockObject} from './terminal_test_mocks.js';
import {Terminal} from './xterm.js';

describe('terminal_emulator_tests.js', function() {
  describe('XtermTerminal', function() {
    beforeEach(async function() {
      this.mocks = {
        term: new MockObject({
          options: {},
          parser: {
            registerOscHandler: () => {},
          },
        }),
        fontManager: new MockObject(),
        xtermInternal: new MockObject({
          getActualCellDimensions: () => ({width: 9, height: 22}),
        }),
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

      // Some hacking because we don't run the decorate() function. Maybe we
      // should just run it.
      this.terminal.container_ = /** @type {!Element} */({
        offsetWidth: 1000,
        offsetHeight: 500,
      });
      this.terminal.inited_ = true;
    });

    describe('updateFont_()', function() {
      it('updates font', async function() {
        const updateFontPromise = this.terminal.updateFont_('font one');
        assert.deepEqual(
            await this.mocks.fontManager.whenCalled('loadFont'),
            [['font one']]);
        assert.equal(this.mocks.term.baseObj.options.fontFamily, undefined);
        assert.isNotNull(this.terminal.pendingFont_);
        assert.equal(this.mocks.term.popMethodHistory('resize').length, 0);

        await updateFontPromise;
        assert.equal(this.mocks.term.baseObj.options.fontFamily, 'font one');
        assert.isNull(this.terminal.pendingFont_);
        await sleep(0);
        assert.equal(this.mocks.term.popMethodHistory('resize').length, 1);
      });

      it('refresh font when the font is the same', async function() {
        this.mocks.term.baseObj.options.fontFamily = 'font one';
        const updateFontPromise = this.terminal.updateFont_('font one');
        assert.deepEqual(
            await this.mocks.fontManager.whenCalled('loadFont'),
            [['font one']]);
        assert.equal(this.mocks.term.baseObj.options.fontFamily, 'font one');
        assert.isNotNull(this.terminal.pendingFont_);
        assert.equal(this.mocks.term.popMethodHistory('resize').length, 0);

        await updateFontPromise;
        // Note the extra space at the end.
        assert.equal(this.mocks.term.baseObj.options.fontFamily, 'font one ');
        assert.isNull(this.terminal.pendingFont_);
        await sleep(0);
        assert.equal(this.mocks.term.popMethodHistory('resize').length, 1);
      });

      it('aborts if pendingFont_ was changed', async function() {
        const updateFontPromise = this.terminal.updateFont_('font one');
        assert.deepEqual(
            await this.mocks.fontManager.whenCalled('loadFont'),
            [['font one']]);
        assert.equal(this.mocks.term.baseObj.options.fontFamily, undefined);
        assert.isNotNull(this.terminal.pendingFont_);
        assert.equal(this.mocks.term.popMethodHistory('resize').length, 0);

        this.terminal.pendingFont_ = 'font two';

        await updateFontPromise;
        assert.equal(this.mocks.term.baseObj.options.fontFamily, undefined);
        assert.equal(this.terminal.pendingFont_, 'font two');
        await sleep(0);
        assert.equal(this.mocks.term.popMethodHistory('resize').length, 0);
      });
    });

    it('customKeyEventHandler_', async function() {
      const mockHandler = new MockFunction();
      const fakeEvent = {
        type: 'keydown',
        keyCode: 65,
        ctrlKey: true,
      };
      this.terminal.keyDownHandlers_.set(encodeKeyCombo(Modifier.Ctrl, 65),
          mockHandler.proxy);
      assert.isFalse(this.terminal.customKeyEventHandler_(fakeEvent));
      const history = mockHandler.popHistory();
      assert.equal(history.length, 1);
      assert.equal(history[0][0], fakeEvent);

      assert.isFalse(this.terminal.customKeyEventHandler_({...fakeEvent,
        type: 'keypress'}));
      assert.isEmpty(mockHandler.popHistory());

      assert.isTrue(this.terminal.customKeyEventHandler_({...fakeEvent,
        shiftKey: true}));
      assert.isEmpty(mockHandler.popHistory());

      assert.isTrue(this.terminal.customKeyEventHandler_({...fakeEvent,
        keyCode: 66}));
      assert.isEmpty(mockHandler.popHistory());

      assert.isTrue(this.terminal.customKeyEventHandler_({...fakeEvent,
        ctrlKey: false}));
      assert.isEmpty(mockHandler.popHistory());
    });
  });

  describe('A11yButtons', () => {
    const ROWS = 5;

    beforeEach(function() {
      this.elem = document.createElement('div');
      this.elem.style.height = '500px';
      this.elem.style.width = '500px';
      document.body.appendChild(this.elem);

      this.terminal = new Terminal({cols: 80, rows: ROWS,
        allowProposedApi: true});
      this.htermA11yReaderMock = new MockObject();
      this.a11yButtons = new A11yButtons(this.terminal,
          /** @type {!hterm.AccessibilityReader} */(
              this.htermA11yReaderMock.proxy));

      this.write = async (content) => {
        return new Promise((resolve) => this.terminal.write(content, resolve));
      };
    });

    afterEach(function() {
      this.terminal.dispose();
      document.body.removeChild(this.elem);
    });

    it('announceScreenContent_', async function() {
      this.a11yButtons.announceScreenContent_();
      assert.deepEqual(
          this.htermA11yReaderMock.popMethodHistory('assertiveAnnounce'),
          [['100% scrolled,']]);

      await this.write('hello');
      this.a11yButtons.announceScreenContent_();
      assert.deepEqual(
          this.htermA11yReaderMock.popMethodHistory('assertiveAnnounce'),
          [['100% scrolled,\nhello']]);

      await this.write('\r\nworld');
      this.a11yButtons.announceScreenContent_();
      assert.deepEqual(
          this.htermA11yReaderMock.popMethodHistory('assertiveAnnounce'),
          [['100% scrolled,\nhello\nworld']]);

      for (let i = 0; i < ROWS; ++i) {
        await this.write(`\r\n${i}`);
      }
      this.a11yButtons.announceScreenContent_();
      assert.deepEqual(
          this.htermA11yReaderMock.popMethodHistory('assertiveAnnounce'),
          [['100% scrolled,\n0\n1\n2\n3\n4']]);

      this.terminal.scrollLines(-1);
      this.a11yButtons.announceScreenContent_();
      assert.deepEqual(
          this.htermA11yReaderMock.popMethodHistory('assertiveAnnounce'),
          [['50% scrolled,\nworld\n0\n1\n2\n3']]);

      this.terminal.scrollLines(-1);
      this.a11yButtons.announceScreenContent_();
      assert.deepEqual(
          this.htermA11yReaderMock.popMethodHistory('assertiveAnnounce'),
          [['0% scrolled,\nhello\nworld\n0\n1\n2']]);
    });
  });
});
