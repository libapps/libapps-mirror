// Copyright 2021 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Unit tests for tmux.js.
 */

import {MockFunction, MockObject} from './terminal_test_mocks.js';
import {Controller, LayoutType, parseWindowLayout} from './tmux.js';

// TODO(crbug.com/1252271): add all the missing tests.

const parseWindowLayoutTestData = [{
  str: '190x79,0,0,9',
  layout: {
    xSize: 190,
    ySize: 79,
    xOffset: 0,
    yOffset: 0,
    paneId: '%9',
  },
}, {
  // Complex layouts with multi-level of splits.
  str: '190x79,0,0{95x79,0,0[95x39,0,0,0,95x39,0,40,8],47x79,96,0,2,' +
    '46x79,144,0[46x39,144,0,3,46x39,144,40,4]}',
  layout: {
    xSize: 190,
    ySize: 79,
    xOffset: 0,
    yOffset: 0,
    childrenLayout: LayoutType.LEFT_RIGHT,
    children: [{
      xSize: 95,
      ySize: 79,
      xOffset: 0,
      yOffset: 0,
      childrenLayout: LayoutType.TOP_BOTTOM,
      children: [{
        xSize: 95,
        ySize: 39,
        xOffset: 0,
        yOffset: 0,
        paneId: '%0',
      }, {
        xSize: 95,
        ySize: 39,
        xOffset: 0,
        yOffset: 40,
        paneId: '%8',
      }],
    }, {
      xSize: 47,
      ySize: 79,
      xOffset: 96,
      yOffset: 0,
      paneId: '%2',
    }, {
      xSize: 46,
      ySize: 79,
      xOffset: 144,
      yOffset: 0,
      childrenLayout: LayoutType.TOP_BOTTOM,
      children: [{
        xSize: 46,
        ySize: 39,
        xOffset: 144,
        yOffset: 0,
        paneId: '%3',
      }, {
        xSize: 46,
        ySize: 39,
        xOffset: 144,
        yOffset: 40,
        paneId: '%4',
      }],
    }],
  },
}];


describe('tmux.js', function() {
  parseWindowLayoutTestData.forEach(({str, layout}, i) => it(
      `parseWindowLayout${i}`,
      async function() {
        assert.deepEqual(parseWindowLayout(str), layout,
            `failed parsing ${str}`);
      },
  ));

  describe('controller', function() {
    beforeEach(function() {
      this.testWindowData = {
        '@3': {
          windowMock: new MockObject(),
          layoutStr: 'd6be,190x79,0,0,1',
          paneIds: ['%1'],
        },
        '@9': {
          windowMock: new MockObject(),
          layoutStr: '6f9b,127x79,0,0[127x39,0,0,2,127x39,0,40,10]',
          paneIds: ['%2', '%10'],
        },
      };

      this.openWindowMock = new MockFunction();
      this.inputMock = new MockFunction();
      this.controller = new Controller({
        openWindow: (args) => {
          this.openWindowMock.called(args);
          return this.testWindowData[args.windowId].windowMock.proxy;
        },
        input: this.inputMock.proxy,
      });

      this.interpretAllLines = (lines) => {
        for (const line of lines) {
          this.controller.interpretLine(line);
        }
      };

      this.interpretBeginEndBlock = (lines) => {
        this.controller.interpretLine('%begin');
        this.interpretAllLines(lines);
        this.controller.interpretLine('%end');
      };

      // Tmux prints a empty %begin/%end block at the very beginning.
      this.interpretBeginEndBlock([]);
    });

    it('start() and internalOpenWindow_()', function() {
      this.controller.start();

      // Controller first queries the version number.
      assert.equal(this.inputMock.getHistory().length, 1);
      this.interpretBeginEndBlock(['3.2a']);
      assert.deepEqual(this.controller.tmuxVersion_, {major: 3.2, minor: 'a'});

      // Controller list windows. After this, some handlers should be installed.
      const handlerToBeInstalled = ['%window-add'];
      assert.equal(this.inputMock.getHistory().length, 2);
      assert.isFalse(handlerToBeInstalled.some(
          (handler) => !!this.controller.handlers_[handler]));
      this.interpretBeginEndBlock([
          `@3 ${this.testWindowData['@3'].layoutStr}`,
          `@9 ${this.testWindowData['@9'].layoutStr}`,
      ]);
      assert.isTrue(handlerToBeInstalled.every(
          (handler) => !!this.controller.handlers_[handler]));
      assert.deepEqual(
          this.openWindowMock.getHistory().map(([{windowId}]) => windowId)
              .sort(),
          ['@3', '@9'],
      );
      assert.deepEqual(
          Array.from(this.controller.windows_.keys()).sort(),
          ['@3', '@9'],
      );
      assert.deepEqual(
          Array.from(this.controller.panes_.keys()).sort(),
          ['%1', '%10', '%2'],
      );
      assert.equal(this.controller.panes_.get('%1').winInfo.id, '@3');
      assert.equal(this.controller.panes_.get('%10').winInfo.id, '@9');
      assert.equal(this.controller.panes_.get('%2').winInfo.id, '@9');
    });

    it('queueCommand() and %begin/%end block', function() {
      const callbackMock = new MockFunction();
      this.controller.queueCommand('foo bar', callbackMock.proxy);
      assert.deepEqual(this.inputMock.getHistory(), [['foo bar\r']]);

      this.interpretAllLines([
          '%random-tag abc',
          // Legit %begin tag.
          '%begin 123 455 1',
          'hello',
          // Another %begin tag. This is unusual, but should be treated as
          // content of the block.
          '%begin 123 455 1',
          // A %end tag with unmatched args. This is unusual, but should be
          // treated as content of the block.
          '%end 124 455 1',
          // A %error tag with unmatched args. This is unusual, but should be
          // treated as content of the block.
          '%error 124 455 1',
          // This should just be treated as content of the block.
          '%random-tag2 abc',
          // Legit %end tag with matching args.
          '%end 123 455 1',
          '%random-tag3 abc',
      ]);

      assert.deepEqual(callbackMock.getHistory(), [[[
          'hello',
          '%begin 123 455 1',
          '%end 124 455 1',
          '%error 124 455 1',
          '%random-tag2 abc',
      ]]]);
    });

    // This is basically the same as the `%end` one and only the callback is
    // different, so we don't repeatedly test the tricky cases.
    it('queueCommand() and %begin/%error block', function() {
      const callbackMock = new MockFunction();
      this.controller.queueCommand('foo bar', () => assert.fail(),
          callbackMock.proxy);
      assert.deepEqual(this.inputMock.getHistory(), [['foo bar\r']]);

      this.interpretAllLines([
          '%random-tag abc',
          '%begin 123 455 1',
          'hello',
          'world',
          '%error 123 455 1',
      ]);

      assert.deepEqual(callbackMock.getHistory(), [[[
          'hello',
          'world',
      ]]]);
    });

    // This test when the tag is not %begin/%end/%error
    it('interpretLine()', function() {
      const handlerMock = new MockFunction();
      this.controller.handlers_['%random-tag'] = handlerMock.proxy;

      this.interpretAllLines([
          '%random-tag abc',
          '%random-tag 123 456',
      ]);

      assert.deepEqual(handlerMock.getHistory(), [['abc'], ['123 456']]);
    });

  });
});
