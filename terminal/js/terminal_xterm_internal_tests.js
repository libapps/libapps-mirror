// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Tests for terminal_xterm_internal.js
 */

import {Terminal} from './xterm.js';
import {XtermInternal} from './terminal_xterm_internal.js';

const COLS = 80;
const ROWS = 24;

describe('terminal_xterm_internal.js', function() {
  beforeEach(function() {
    this.elem = document.createElement('div');
    this.elem.style.height = '500px';
    this.elem.style.width = '500px';
    document.body.appendChild(this.elem);

    this.terminal = new Terminal({cols: COLS, rows: ROWS,
      allowProposedApi: true});
    this.terminal.open(this.elem);
    this.terminal.options.fontFamily = '"Noto Sans Mono"';
    this.terminal.options.fontSize = 16;
    this.xtermInternal = new XtermInternal(this.terminal);

    this.write = async (content) => {
      return new Promise((resolve) => this.terminal.write(content, resolve));
    };
  });

  afterEach(function() {
    this.terminal.dispose();
    document.body.removeChild(this.elem);
  });

  it('getActualCellDimensions()', async function() {
    const {width, height} = this.xtermInternal.getActualCellDimensions();
    assert.isAbove(width, 0);
    assert.isAbove(height, 0);
  });

  it('print()', async function() {
    this.xtermInternal.print('hello world');
    assert.equal(this.terminal.buffer.active.getLine(0).translateToString(true),
        'hello world');
  });

  it('newLine()', async function() {
    await this.write('012');
    const buffer = this.terminal.buffer.active;
    assert.equal(buffer.cursorX, 3);
    assert.equal(buffer.cursorY, 0);
    this.xtermInternal.newLine();
    assert.equal(buffer.cursorX, 0);
    assert.equal(buffer.cursorY, 1);
  });

  it('cursorLeft()', async function() {
    await this.write('012');
    const buffer = this.terminal.buffer.active;
    assert.equal(buffer.cursorX, 3);
    assert.equal(buffer.cursorY, 0);
    this.xtermInternal.cursorLeft(1);
    assert.equal(this.terminal.buffer.active.cursorX, 2);
    assert.equal(buffer.cursorY, 0);
  });

  it('installEscKHandler()', async function() {
    await this.write('\x1bkhello world\x1b\\');
    assert.equal(this.terminal.buffer.active.getLine(0).translateToString(true),
        'hello world',
        'before installing the handler, the string will be printed');

    this.xtermInternal.installEscKHandler();
    await this.write('abc\x1bk1234\x1b\\def');
    assert.equal(this.terminal.buffer.active.getLine(0).translateToString(true),
        'hello worldabcdef',
        'after installing the handler, the string should be ignored');
  });

  it('installTmuxControlModeHandler()', async function() {
    const tmuxLines = [];

    this.xtermInternal.installTmuxControlModeHandler((line) => {
      tmuxLines.push(line);
    });

    for (const input of [
      'hello world\x1bP',
      '1000phello ',
      'tmux\r',
      '\nhello',
      ' again\r\nbye',
    ]) {
      await this.write(input);
    }

    assert.equal(this.terminal.buffer.active.getLine(0).translateToString(true),
        'hello world');
    assert.deepEqual(tmuxLines, ['hello tmux', 'hello again']);
    tmuxLines.length = 0;

    await this.write(' tmux\r\n\x1b\\abcd');
    assert.deepEqual(tmuxLines, ['bye tmux', null]);

    assert.equal(this.terminal.buffer.active.getLine(0).translateToString(true),
        'hello worldabcd');
  });
});
