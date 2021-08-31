// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview VT test suite.
 *
 * This is more of an integration test suite for the VT and Terminal classes,
 * as each test typically sends strings into the VT parser and then reads
 * the terminal to verify that everyone did the right thing.
 */

/**
 * Create a MouseEvent/WheelEvent that the VT layer expects.
 *
 * The Terminal layer adds some extra fields to it.  We can't create an object
 * in the same way as the runtime doesn't allow it (for no real good reason).
 * i.e. these methods fail:
 * (1) MouseEvent.apply(this, [...]) -> DOM object constructor cannot be called
 * (2) https://developers.google.com/web/updates/2015/04/DOM-attributes-now-on-the-prototype-chain
 *     m = new MouseEvent(...); Object.assign(this, m); -> attrs omitted
 *
 * @param {string} type The name of the new DOM event type (e.g. 'mouseup').
 * @param {!Object=} options Fields to set in the new event.
 * @return {!MouseEvent|!WheelEvent} The new fully initialized event.
 */
const MockTerminalMouseEvent = function(type, options = {}) {
  let ret;
  if (type == 'wheel') {
    ret = new WheelEvent(type, options);
  } else {
    ret = new MouseEvent(type, options);
  }
  ret.terminalRow = options.terminalRow || 0;
  ret.terminalColumn = options.terminalColumn || 0;
  return ret;
};

describe('hterm_vt_tests.js', () => {

before(function() {
  this.visibleColumnCount = 15;
  this.visibleRowCount = 6;
});

/**
 * Clear out the current document and create a new hterm.Terminal object for
 * testing.
 *
 * Called before each test case in this suite.
 */
beforeEach(function(done) {
  this.document = window.document;

  const div = this.document.createElement('div');
  div.style.position = 'absolute';
  div.style.height = '100%';
  div.style.width = '100%';
  this.document.body.appendChild(div);

  this.div = div;

  this.terminal = new hterm.Terminal();

  this.terminal.decorate(div);
  this.terminal.setWidth(this.visibleColumnCount);
  this.terminal.setHeight(this.visibleRowCount);
  this.terminal.onTerminalReady = () => {
    this.terminal.setCursorPosition(0, 0);
    this.terminal.setCursorVisible(true);
    done();
  };

  MockNotification.start();
});

/**
 * Ensure that blink is off after the test so we don't have runaway timeouts.
 *
 * Called after each test case in this suite.
 */
afterEach(function() {
  this.document.body.removeChild(this.div);
  this.terminal.setCursorBlink(false);

  MockNotification.stop();
});

/**
 * Basic sanity test to make sure that when we insert plain text it appears
 * on the screen and scrolls into the scrollback buffer correctly.
 */
it('sanity', function() {
    this.terminal.interpret('0\r\n1\r\n2\r\n3\r\n4\r\n5\r\n6\r\n' +
                            '7\r\n8\r\n9\r\n10\r\n11\r\n12');

    const text = this.terminal.getRowsText(0, 13);
    assert.equal(text, '0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12');

    assert.equal(this.terminal.scrollbackRows_.length, 7);
  });

/**
 * Test that we parse UTF-8 properly. Parser state should persist
 * across writes and invalid sequences should result in replacement
 * characters.
 */
it('utf8', function() {
  // 11100010 10000000 10011001 split over two writes.
  this.terminal.io.writeUTF8([0xe2, 0x80]);
  this.terminal.io.writeUTF8([0x99]);
  this.terminal.io.writeUTF8([0x0d, 0x0a]);

  // Interpret some invalid UTF-8. xterm and gnome-terminal are
  // inconsistent about the number of replacement characters. We
  // match xterm.
  this.terminal.io.writelnUTF8([
    0x61, 0xf1, 0x80, 0x80, 0xe1, 0x80, 0xc2,
    0x62, 0x80,
    0x63, 0x80, 0xbf,
    0x64,
  ]);

  // Surrogate pairs turn into replacements.
  this.terminal.io.writeUTF8([
    0xed, 0xa0, 0x80,  // D800
    0xed, 0xad, 0xbf,  // D87F
    0xed, 0xae, 0x80,  // DC00
    0xed, 0xbf, 0xbf,  // DFFF
  ]);

  // Write some text to finish flushing the decoding stream.
  this.terminal.io.writeUTF8([0x0d, 0x0a, 0x64, 0x6f, 0x6e, 0x65]);

  const text = this.terminal.getRowsText(0, 4);
  assert.equal(text,
               '\u2019\n' +
               'a\ufffd\ufffd\ufffdb\ufffdc\ufffd\ufffdd\n' +
               '\ufffd'.repeat(12) +
               '\ndone');
});

/**
 * Verify we can write ArrayBuffers of UTF-8 data.
 */
it('utf8-arraybuffer', function() {
  // Test splitting a single code point over multiple writes.
  let data = new Uint8Array([0xe2, 0x80, 0x99, 0xd, 0xa]);
  for (let i = 0; i < data.length; ++i) {
    this.terminal.io.writeUTF8(data.subarray(i, i + 1));
  }

  // Interpret some invalid UTF-8. xterm and gnome-terminal are
  // inconsistent about the number of replacement characters. We
  // match xterm.
  data = new Uint8Array([0x61, 0xf1, 0x80, 0x80, 0xe1, 0x80, 0xc2, 0x62, 0x80,
                         0x63, 0x80, 0xbf, 0x64]);
  this.terminal.io.writelnUTF8(data);

  // Surrogate pairs turn into replacements.
  data = new Uint8Array([0xed, 0xa0, 0x80,    // D800
                         0xed, 0xad, 0xbf,    // D87F
                         0xed, 0xae, 0x80,    // DC00
                         0xed, 0xbf, 0xbf]);  // DFFF
  this.terminal.io.writelnUTF8(data);

  const text = this.terminal.getRowsText(0, 3);
  assert.equal('\u2019\n' +
               'a\ufffd\ufffd\ufffdb\ufffdc\ufffd\ufffdd\n' +
               '\ufffd'.repeat(12),
               text);
});

/**
 * Verify we don't drop combining characters.
 *
 * Note: The exact output here is somewhat debatable.  Combining characters
 * should follow "real" characters, not escape sequences that we filter out.
 * So you could argue that this should be âbc or abĉ.  We happen to (almost)
 * produce âbc currently, but if logic changes in hterm that makes it more
 * difficult to pull off, that's OK.  This test is partially a sanity check
 * to make sure we don't significantly regress (like we have in the past) by
 * producing something like "âc".
 */
it('utf8-combining', function() {
    this.terminal.interpret('abc\b\b\u{302}\n');
    const text = this.terminal.getRowsText(0, 1);
    assert.equal(text, 'a\u{302}bc');
  });

/**
 * Basic cursor positioning tests.
 *
 * TODO(rginda): Test the VT52 variants too.
 */
it('cursor-relative', function() {
    this.terminal.interpret('line 1\r\nline 2\r\nline 3');
    this.terminal.interpret('\x1b[A\x1b[Dtwo' +
                            '\x1b[3D' +
                            '\x1b[Aone' +
                            '\x1b[4D' +
                            '\x1b[2B' +
                            '\x1b[Cthree');
    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text, 'line one\nline two\nline three');
  });

/**
 * Test absolute cursor positioning.
 */
it('cursor-absolute', function() {
    this.terminal.interpret('line 1\r\nline 2\r\nline 3');

    this.terminal.interpret('\x1b[1Gline three' +
                            '\x1b[2;6Htwo' +
                            '\x1b[1;5f one');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text, 'line one\nline two\nline three');
  });

/**
 * Test line positioning.
 */
it('line-position', function() {
    this.terminal.interpret('line 1\r\nline 2\r\nline 3');

    this.terminal.interpret('\x1b[Fline two' +
                            '\x1b[Fline one' +
                            '\x1b[E\x1b[Eline three');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text, 'line one\nline two\nline three');
  });

/**
 * Test that a partial sequence is buffered until the entire sequence is
 * received.
 */
it('partial-sequence', function() {
    this.terminal.interpret('line 1\r\nline 2\r\nline three');

    this.terminal.interpret('\x1b');
    this.terminal.interpret('[');
    this.terminal.interpret('5');
    this.terminal.interpret('D');
    this.terminal.interpret('\x1b[');
    this.terminal.interpret('Atwo\x1b[3');
    this.terminal.interpret('D\x1b[Aone');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text, 'line one\nline two\nline three');
  });

/**
 * Test that two ESC characters in a row are handled properly.
 */
it('double-sequence', function() {
    this.terminal.interpret('line one\r\nline two\r\nline 3');

    this.terminal.interpret('\x1b[\x1b[Dthree');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text, 'line one\nline two\nline three');
  });

/**
 * Test that 8-bit control characters are properly ignored.
 */
it('8-bit-control', function() {
    let title = null;
    this.terminal.setWindowTitle = function(t) {
      // Set a default title so we can catch the potential for this function
      // to be called on accident with no parameter.
      title = t || 'XXX';
    };

    // This test checks 8-bit handling in ISO-2022 mode.
    this.terminal.vt.setEncoding('iso-2022');

    assert.isFalse(this.terminal.vt.enable8BitControl);

    // Send a "set window title" command using a disabled 8-bit
    // control. It's a C1 control, so we interpret it after UTF-8
    // decoding.
    this.terminal.interpret('\u{9d}0;test title\x07!!');

    assert.isNull(title);
    assert.equal(this.terminal.getRowsText(0, 1), '0;test title!!');

    // Try again with the two-byte version of the code.
    title = null;
    this.terminal.reset();
    this.terminal.interpret('\x1b]0;test title\x07!!');
    assert.equal(title, 'test title');
    assert.equal(this.terminal.getRowsText(0, 1), '!!');

    // Now enable 8-bit control and see how it goes.
    title = null;
    this.terminal.reset();
    this.terminal.vt.enable8BitControl = true;
    this.terminal.interpret('\u{9d}0;test title\x07!!');
    assert.equal(title, 'test title');
    assert.equal(this.terminal.getRowsText(0, 1), '!!');
  });

/**
 * If we see embedded escape sequences, we should reject them.
 */
it('embedded-escape-sequence', function() {
    let title = null;
    this.terminal.setWindowTitle = function(t) {
      // Set a default title so we can catch the potential for this function
      // to be called on accident with no parameter.
      title = t || 'XXX';
    };

    // We know we're going to cause chokes, so silence the warnings.
    this.terminal.vt.warnUnimplemented = false;

    ['\x07', '\x1b\\'].forEach((seq) => {
      // We get all the data at once with a terminated sequence.
      this.terminal.reset();
      this.terminal.interpret('\x1b]0;asdf\x1b x ' + seq);
      assert.isNull(title);

      // We get the data in pieces w/a terminated sequence.
      this.terminal.reset();
      this.terminal.interpret('\x1b]0;asdf');
      this.terminal.interpret('\x1b');
      this.terminal.interpret(' x ' + seq);
      assert.isNull(title);
    });

    // We get the data in pieces but no terminating sequence.
    this.terminal.reset();
    this.terminal.interpret('\x1b]0;asdf');
    this.terminal.interpret('\x1b');
    this.terminal.interpret(' ');
    assert.isNull(title);
  });

/**
 * Verify that split ST sequences are buffered/handled correctly.
 */
it('split-ST-sequence', function() {
    let title = null;
    this.terminal.setWindowTitle = function(t) {
      // Set a default title so we can catch the potential for this function
      // to be called on accident with no parameter.
      title = t || 'XXX';
    };

    // We get the first half of the ST with the base.
    this.terminal.interpret('\x1b]0;asdf\x1b');
    this.terminal.interpret('\\');
    assert.equal(title, 'asdf');

    // We get the first half of the ST one byte at a time.
    title = null;
    this.terminal.reset();
    this.terminal.interpret('\x1b]0;asdf');
    this.terminal.interpret('\x1b');
    this.terminal.interpret('\\');
    assert.equal(title, 'asdf');
  });

it('dec-screen-test', function() {
    this.terminal.interpret('\x1b#8');

    const text = this.terminal.getRowsText(0, 6);
    assert.equal(text,
                 'EEEEEEEEEEEEEEE\n' +
                 'EEEEEEEEEEEEEEE\n' +
                 'EEEEEEEEEEEEEEE\n' +
                 'EEEEEEEEEEEEEEE\n' +
                 'EEEEEEEEEEEEEEE\n' +
                 'EEEEEEEEEEEEEEE');
  });

it('newlines-1', function() {
    // Should be off by default.
    assert.isFalse(this.terminal.options_.autoCarriageReturn);

    // 0d: newline, 0b: vertical tab, 0c: form feed.
    this.terminal.interpret('newline\x0dvtab\x0bff\x0cbye');
    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'vtabine\n' +
                 '    ff\n' +
                 '      bye');
  });

it('newlines-2', function() {
    this.terminal.interpret('\x1b[20h');
    assert.isTrue(this.terminal.options_.autoCarriageReturn);

    this.terminal.interpret('newline\x0dvtab\x0bff\x0cbye');
    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'vtabine\n' +
                 'ff\n' +
                 'bye');
  });

/**
 * Test the default tab stops.
 */
it('tabs', function() {
    this.terminal.interpret('123456789012345\r\n');
    this.terminal.interpret('1\t2\ta\r\n');
    this.terminal.interpret('1\t2\tb\r\n');
    this.terminal.interpret('1\t2\tc\r\n');
    this.terminal.interpret('1\t2\td\r\n');
    this.terminal.interpret('1\t2\te');
    const text = this.terminal.getRowsText(0, 6);
    assert.equal(text,
                 '123456789012345\n' +
                 '1       2     a\n' +
                 '1       2     b\n' +
                 '1       2     c\n' +
                 '1       2     d\n' +
                 '1       2     e');
  });

/**
 * Test terminal reset.
 */
it('reset', function() {
    this.terminal.interpret(
        // Switch to alternate screen and set some attributes.
        '\x1b[?47h\x1b[1;33;44m' +
        // Switch back to primary screen.
        '\x1b[?47l' +
        // Set some text attributes.
        '\x1b[1;33;44m' +
        // Clear all tab stops.
        '\x1b[3g' +
        // Set a scroll region.
        '\x1b[2;4r' +
        // Set cursor position.
        '\x1b[5;6H');

    let ta;

    assert.equal(this.terminal.tabStops_.length, 0);

    ta = this.terminal.primaryScreen_.textAttributes;
    assert.notStrictEqual(ta.foreground, ta.DEFAULT_COLOR);
    assert.notStrictEqual(ta.background, ta.DEFAULT_COLOR);

    ta = this.terminal.alternateScreen_.textAttributes;
    assert.notStrictEqual(ta.foreground, ta.DEFAULT_COLOR);
    assert.notStrictEqual(ta.background, ta.DEFAULT_COLOR);

    assert.isTrue(ta.bold);

    assert.equal(this.terminal.vtScrollTop_, 1);
    assert.equal(this.terminal.vtScrollBottom_, 3);
    assert.equal(this.terminal.screen_.cursorPosition.row, 4);
    assert.equal(this.terminal.screen_.cursorPosition.column, 5);

    // Reset.
    this.terminal.interpret('\x1bc');

    assert.equal(this.terminal.tabStops_.length, 1);

    ta = this.terminal.primaryScreen_.textAttributes;
    assert.strictEqual(ta.foreground, ta.DEFAULT_COLOR);
    assert.strictEqual(ta.background, ta.DEFAULT_COLOR);

    ta = this.terminal.alternateScreen_.textAttributes;
    assert.strictEqual(ta.foreground, ta.DEFAULT_COLOR);
    assert.strictEqual(ta.background, ta.DEFAULT_COLOR);

    assert.isFalse(ta.bold);

    assert.isNull(this.terminal.vtScrollTop_);
    assert.isNull(this.terminal.vtScrollBottom_);
    assert.equal(this.terminal.screen_.cursorPosition.row, 0);
    assert.equal(this.terminal.screen_.cursorPosition.column, 0);
  });

/**
 * Test the erase left command.
 */
it('erase-left', function() {
    this.terminal.interpret('line one\r\noooooooo\r\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A' +
                            '\x1b[1Ktw');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'line one\n' +
                 '     two\n' +
                 'line three');
  });

/**
 * Test the erase left command with widechar string.
 */
it('erase-left-widechar', function() {
    this.terminal.interpret('第一行\r\n第二行\r\n第三行');
    this.terminal.interpret('\x1b[5D' +
                            '\x1b[A' +
                            '\x1b[1KOO');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal('\u7b2c\u4e00\u884c\n' +
                 ' OO \u884c\n' +
                 '\u7b2c\u4e09\u884c',
                 text);
  });

/**
 * Test the erase right command.
 */
it('erase-right', function() {
    this.terminal.interpret('line one\r\nline XXXX\r\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A' +
                            '\x1b[0Ktwo');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'line one\n' +
                 'line two\n' +
                 'line three');
  });

/**
 * Test the erase right command with widechar string.
 */
it('erase-right-widechar', function() {
    this.terminal.interpret('第一行\r\n第二行\r\n第三行');
    this.terminal.interpret('\x1b[5D\x1b[A' +
                            '\x1b[0KOO');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal('\u7b2c\u4e00\u884c\n' +
                 ' OO\n' +
                 '\u7b2c\u4e09\u884c',
                 text);
  });

/**
 * Test the erase line command.
 */
it('erase-line', function() {
    this.terminal.interpret('line one\r\nline twoo\r\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A' +
                            '\x1b[2Ktwo');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'line one\n' +
                 '     two\n' +
                 'line three');
  });

/**
 * Test the erase above command.
 */
it('erase-above', function() {
    this.terminal.interpret('line one\r\noooooooo\r\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A' +
                            '\x1b[1Jtw');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 '\n' +
                 '     two\n' +
                 'line three');
  });

/**
 * Test the erase all command.
 */
it('erase-all', function() {
    this.terminal.interpret('line one\r\nline XXXX\r\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A' +
                            '\x1b[2Jtwo');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 '\n' +
                 '     two\n');
  });

/**
 * Test the erase below command.
 */
it('erase-below', function() {
    this.terminal.interpret('line one\r\nline XXXX\r\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A' +
                            '\x1b[0Jtwo');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'line one\n' +
                 'line two\n');
  });

/**
 * Test the erase character command.
 */
it('erase-char', function() {
    this.terminal.interpret('line one\r\nline XXXX\r\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A' +
                            '\x1b[4Xtwo');

    let text = this.terminal.getRowsText(0, 3);
    // See TODO in hterm.Terminal.prototype.eraseToRight for the extra space.
    assert.equal(text,
                 'line one\n' +
                 'line two\n' +
                 'line three');

    this.terminal.interpret('\x1b[3D' +
                            '\x1b[X');
    text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'line one\n' +
                 'line  wo\n' +
                 'line three');
  });

/**
 * Test the insert line command.
 */
it('insert-line', function() {
    this.terminal.interpret('line two\r\nline three');
    this.terminal.interpret('\x1b[5D\x1b[2A\x1b[L' +
                            'line one');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'line one\n' +
                 'line two\n' +
                 'line three');
  });

/**
 * Test the insert line command with an argument.
 */
it('insert-lines', function() {
    this.terminal.interpret('line three\r\n\r\n');
    this.terminal.interpret('\x1b[5D\x1b[2A\x1b[2L' +
                            'line one\r\nline two');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'line one\n' +
                 'line two\n' +
                 'line three');
  });

/**
 * Test that the insert line command handles overflow properly.
 */
it('insert-toomany-lines', function() {
    this.terminal.interpret('XXXXX');
    this.terminal.interpret('\x1b[6L' +
                            'line one\r\nline two\r\nline three');

    const text = this.terminal.getRowsText(0, 5);
    assert.equal(text,
                 'line one\n' +
                 'line two\n' +
                 'line three\n' +
                 '\n');
  });

/**
 * Test the delete line command.
 */
it('delete-line', function() {
    this.terminal.interpret('line one\r\nline two\r\n' +
                            'XXXXXXXX\r\n' +
                            'line XXXXX');
    this.terminal.interpret('\x1b[5D\x1b[A\x1b[Mthree');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'line one\n' +
                 'line two\n' +
                 'line three');
  });

/**
 * Test the delete line command with an argument.
 */
it('delete-lines', function() {
    this.terminal.interpret('line one\r\nline two\r\n' +
                            'XXXXXXXX\r\nXXXXXXXX\r\n' +
                            'line XXXXX');
    this.terminal.interpret('\x1b[5D\x1b[2A\x1b[2Mthree');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'line one\n' +
                 'line two\n' +
                 'line three');
  });

/**
 * Test the insert space command.
 */
it('insert-space', function() {
    this.terminal.interpret('line one\r\nlinetwo\r\nline three');
    this.terminal.interpret('\x1b[6D\x1b[A\x1b[@');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'line one\n' +
                 'line two\n' +
                 'line three');
  });

/**
 * Test the insert space command with an argument.
 */
it('insert-spaces', function() {
    this.terminal.interpret('line one\r\nlinetwo\r\nline three');
    this.terminal.interpret('\x1b[6D\x1b[A\x1b[3@');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'line one\n' +
                 'line   two\n' +
                 'line three');
  });

/**
 * Test the delete characters command.
 */
it('delete-chars', function() {
    this.terminal.interpret('line one\r\nline XXXX\r\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A\x1b[4Ptwo');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'line one\n' +
                 'line two\n' +
                 'line three');
  });

/**
 * Test that the delete characters command handles overflow properly.
 */
it('delete-toomany', function() {
    this.terminal.interpret('line one\r\nline XXXX\r\nline three');
    this.terminal.interpret('\x1b[5D\x1b[A\x1b[20Ptwo');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'line one\n' +
                 'line two\n' +
                 'line three');
  });

/**
 * Test the scroll up command.
 */
it('scroll-up', function() {
    this.terminal.interpret('\r\n\r\nline one\r\nline two\r\nline XXXXX');
    this.terminal.interpret('\x1b[5D\x1b[2A\x1b[2Sthree');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'line one\n' +
                 'line two\n' +
                 'line three');
  });

/**
 * Test the scroll down command.
 */
it('scroll-down', function() {
    this.terminal.interpret('line one\r\nline two\r\nline XXXXX\r\n');
    this.terminal.interpret('     \x1b[Tthree');

    const text = this.terminal.getRowsText(0, 5);
    assert.equal(text,
                 '\n' +
                 'line one\n' +
                 'line two\n' +
                 'line three\n' +
                 '     ');
  });

/**
 * Test the absolute line positioning command.
 */
it('line-position-absolute', function() {
    this.terminal.interpret('line XXX\r\nline YYY\r\nline ZZZZZ\r\n');
    this.terminal.interpret('     \x1b[3dthree\x1b[5D');
    this.terminal.interpret('\x1b[2dtwo\x1b[3D');
    this.terminal.interpret('\x1b[1done');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'line one\n' +
                 'line two\n' +
                 'line three');
  });

/**
 * Test the device attributes command.
 */
it('device-attributes', function() {
    let resultString;
    this.terminal.io.sendString = (str) => resultString = str;

    this.terminal.interpret('\x1b[c');

    assert.equal(resultString, '\x1b[?1;2c');
  });

/**
 * TODO(rginda): Test the clear tabstops on this line command.
 */
it.skip('clear-line-tabstops', function() {
    // '[0g';
  });

/**
 * TODO(rginda): Test the clear all tabstops command.
 */
it.skip('clear-all-tabstops', function() {
    // '[3g';
  });

/**
 * TODO(rginda): Test text attributes.
 */
it('color-change', function() {
    this.terminal.interpret('[mplain....... [0;36mHi\r\n' +
                            '[mitalic...... [3;36mHi\r\n' +
                            '[mbright...... [0;96mHi\r\n' +
                            '[mbold........ [1;36mHi\r\n' +
                            '[mbold-bright. [1;96mHi\r\n' +
                            '[mbright-bold. [96;1mHi');

    const text = this.terminal.getRowsText(0, 6);
    assert.equal(text,
                 'plain....... Hi\n' +
                 'italic...... Hi\n' +
                 'bright...... Hi\n' +
                 'bold........ Hi\n' +
                 'bold-bright. Hi\n' +
                 'bright-bold. Hi');

    for (let i = 0; i < 6; i++) {
      const row = this.terminal.getRowNode(i);
      assert.equal(row.childNodes.length, 2, 'i: ' + i);
      assert.equal(row.childNodes[0].nodeType, Node.TEXT_NODE, 'i: ' + i);
      assert.equal(row.childNodes[0].length, 13, 'i: ' + i);
      assert.equal(row.childNodes[1].nodeName, 'SPAN', 'i: ' + i);
      assert.isTrue(!!row.childNodes[1].style.color, 'i: ' + i);
      assert.isTrue(!!row.childNodes[1].style.fontWeight == (i > 2), 'i: ' + i);
      assert.equal(
          row.childNodes[1].style.fontStyle, (i == 1 ? 'italic' : ''),
          'i: ' + i);
    }
  });

it('color-change-wc', function() {
    this.terminal.io.print('[mplain....... [0;36m中\r\n' +
                           '[mitalic...... [3;36m中\r\n' +
                           '[mbright...... [0;96m中\r\n' +
                           '[mbold........ [1;36m中\r\n' +
                           '[mbold-bright. [1;96m中\r\n' +
                           '[mbright-bold. [96;1m中');

    const text = this.terminal.getRowsText(0, 6);
    assert.equal(text,
                 'plain....... \u4E2D\n' +
                 'italic...... \u4E2D\n' +
                 'bright...... \u4E2D\n' +
                 'bold........ \u4E2D\n' +
                 'bold-bright. \u4E2D\n' +
                 'bright-bold. \u4E2D');

    for (let i = 0; i < 6; i++) {
      const row = this.terminal.getRowNode(i);
      assert.equal(row.childNodes.length, 2, 'i: ' + i);
      assert.equal(row.childNodes[0].nodeType, Node.TEXT_NODE, 'i: ' + i);
      assert.equal(row.childNodes[0].length, 13, 'i: ' + i);
      assert.equal(row.childNodes[1].nodeName, 'SPAN', 'i: ' + i);
      assert.isTrue(!!row.childNodes[1].style.color, 'i: ' + i);
      assert.isTrue(!!row.childNodes[1].style.fontWeight == (i > 2), 'i: ' + i);
      assert.equal(
          row.childNodes[1].style.fontStyle, (i == 1 ? 'italic' : ''),
          'i: ' + i);
    }
  });

it('bold-as-bright', function() {
    const attrs = this.terminal.primaryScreen_.textAttributes;
    const alt_attrs = this.terminal.alternateScreen_.textAttributes;
    attrs.enableBoldAsBright = true;
    alt_attrs.enableBoldAsBright = true;

    this.terminal.interpret('[mplain....... [0;36mHi\r\n' +
                            '[mbright...... [0;96mHi\r\n' +
                            '[mbold........ [1;36mHi\r\n' +
                            '[mbold-bright. [1;96mHi\r\n' +
                            '[mbright-bold. [96;1mHi');

    const text = this.terminal.getRowsText(0, 5);
    assert.equal(text,
                 'plain....... Hi\n' +
                 'bright...... Hi\n' +
                 'bold........ Hi\n' +
                 'bold-bright. Hi\n' +
                 'bright-bold. Hi');

    const fg = 'rgb(var(--hterm-color-6))';
    const fg_bright = 'rgb(var(--hterm-color-14))';

    const row_plain = this.terminal.getRowNode(0);
    assert.equal(row_plain.childNodes[1].style.color, fg,
                 'plain color');

    const row_bright = this.terminal.getRowNode(1);
    assert.equal(row_bright.childNodes[1].style.color, fg_bright,
                 'bright color');

    const row_bold = this.terminal.getRowNode(2);
    assert.equal(row_bold.childNodes[1].style.color, fg_bright,
                 'bold color');

    const row_bold_bright = this.terminal.getRowNode(3);
    assert.equal(row_bold_bright.childNodes[1].style.color, fg_bright,
                 'bold bright color');

    const row_bright_bold = this.terminal.getRowNode(4);
    assert.equal(row_bright_bold.childNodes[1].style.color, fg_bright,
                 'bright bold color');
  });

it('disable-bold-as-bright', function() {
    const attrs = this.terminal.primaryScreen_.textAttributes;
    const alt_attrs = this.terminal.alternateScreen_.textAttributes;
    attrs.enableBoldAsBright = false;
    alt_attrs.enableBoldAsBright = false;

    this.terminal.interpret('[mplain....... [0;36mHi\r\n' +
                            '[mbright...... [0;96mHi\r\n' +
                            '[mbold........ [1;36mHi\r\n' +
                            '[mbold-bright. [1;96mHi\r\n' +
                            '[mbright-bold. [96;1mHi');

    const text = this.terminal.getRowsText(0, 5);
    assert.equal(text,
                 'plain....... Hi\n' +
                 'bright...... Hi\n' +
                 'bold........ Hi\n' +
                 'bold-bright. Hi\n' +
                 'bright-bold. Hi');

    const fg = 'rgb(var(--hterm-color-6))';
    const fg_bright = 'rgb(var(--hterm-color-14))';

    const row_plain = this.terminal.getRowNode(0);
    assert.equal(row_plain.childNodes[1].style.color, fg,
                 'plain color');

    const row_bright = this.terminal.getRowNode(1);
    assert.equal(row_bright.childNodes[1].style.color, fg_bright,
                 'bright color');

    const row_bold = this.terminal.getRowNode(2);
    assert.equal(row_bold.childNodes[1].style.color, fg,
                 'bold color');

    const row_bold_bright = this.terminal.getRowNode(3);
    assert.equal(row_bold_bright.childNodes[1].style.color, fg_bright,
                 'bold bright color');

    const row_bright_bold = this.terminal.getRowNode(4);
    assert.equal(row_bright_bold.childNodes[1].style.color, fg_bright,
                 'bright bold color');
  });

/**
 * Test the status report command.
 */
it('status-report', function() {
    let resultString;
    this.terminal.io.sendString = (str) => resultString = str;

    this.terminal.interpret('\x1b[5n');
    assert.equal(resultString, '\x1b0n');

    resultString = '';

    this.terminal.interpret('line one\r\nline two\r\nline three');
    // Reposition the cursor and ask for a position report.
    this.terminal.interpret('\x1b[5D\x1b[A\x1b[6n');
    assert.equal(resultString, '\x1b[2;6R');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'line one\n' +
                 'line two\n' +
                 'line three');
  });

/**
 * Test that various mode commands correctly change the state of the terminal.
 *
 * Most of these should have more in-depth testing below.
 */
it('mode-bits', function() {
    this.terminal.interpret('\x1b[?1h');
    assert.isTrue(this.terminal.keyboard.applicationCursor);

    this.terminal.interpret('\x1b[?1l');
    assert.isFalse(this.terminal.keyboard.applicationCursor);

    const assertColor = (name, value) => {
      const p = this.terminal.getCssVar(`${name}-color`);
      assert.equal(`rgb(${p.replace(/,/g, ', ')})`, value);
    };
    const fg = this.terminal.prefs_.get('foreground-color');
    const bg = this.terminal.prefs_.get('background-color');

    this.terminal.interpret('\x1b[?5h');
    assertColor('foreground', bg);
    assertColor('background', fg);

    this.terminal.interpret('\x1b[?5l');
    assertColor('foreground', fg);
    assertColor('background', bg);

    this.terminal.interpret('\x1b[?5l');
    assertColor('foreground', fg);
    assertColor('background', bg);

    this.terminal.interpret('\x1b[?6h');
    assert.isTrue(this.terminal.options_.originMode);

    this.terminal.interpret('\x1b[?6l');
    assert.isFalse(this.terminal.options_.originMode);

    this.terminal.interpret('\x1b[4h');
    assert.isTrue(this.terminal.options_.insertMode);

    this.terminal.interpret('\x1b[4l');
    assert.isFalse(this.terminal.options_.insertMode);

    this.terminal.interpret('\x1b[?7h');
    assert.isTrue(this.terminal.options_.wraparound);

    this.terminal.interpret('\x1b[?7l');
    assert.isFalse(this.terminal.options_.wraparound);

    // DEC mode 12 is disabled by default.
    this.terminal.vt.enableDec12 = true;

    this.terminal.interpret('\x1b[?12h');
    assert.isTrue(this.terminal.options_.cursorBlink);
    assert.property(this.terminal.timeouts_, 'cursorBlink');

    this.terminal.interpret('\x1b[?12l');
    assert.isFalse(this.terminal.options_.cursorBlink);
    assert.notProperty(this.terminal.timeouts_, 'cursorBlink');

    // Make sure that enableDec12 is respected.
    this.terminal.vt.enableDec12 = false;

    this.terminal.interpret('\x1b[?12h');
    assert.isFalse(this.terminal.options_.cursorBlink);
    assert.notProperty(this.terminal.timeouts_, 'cursorBlink');

    this.terminal.interpret('\x1b[?25l');
    assert.isFalse(this.terminal.options_.cursorVisible);
    assert.equal(this.terminal.cursorNode_.style.opacity, '0');

    this.terminal.interpret('\x1b[?25h');
    assert.isTrue(this.terminal.options_.cursorVisible);

    // Turn off blink so we know the cursor should be on.
    this.terminal.interpret('\x1b[?12l');
    assert.equal(this.terminal.cursorNode_.style.opacity, '1');

    this.terminal.interpret('\x1b[?45h');
    assert.isTrue(this.terminal.options_.reverseWraparound);

    this.terminal.interpret('\x1b[?45l');
    assert.isFalse(this.terminal.options_.reverseWraparound);

    this.terminal.interpret('\x1b[?67h');
    assert.isTrue(this.terminal.keyboard.backspaceSendsBackspace);

    this.terminal.interpret('\x1b[?67l');
    assert.isFalse(this.terminal.keyboard.backspaceSendsBackspace);

    this.terminal.interpret('\x1b[?1004h]');
    assert.isTrue(this.terminal.reportFocus);

    this.terminal.interpret('\x1b[?1004l]');
    assert.isFalse(this.terminal.reportFocus);

    this.terminal.interpret('\x1b[?1036h');
    assert.isTrue(this.terminal.keyboard.metaSendsEscape);

    this.terminal.interpret('\x1b[?1036l');
    assert.isFalse(this.terminal.keyboard.metaSendsEscape);

    // Save the altSendsWhat setting and change the current setting to something
    // other than 'escape'.
    const previousAltSendsWhat = this.terminal.keyboard.altSendsWhat;
    this.terminal.keyboard.altSendsWhat = '8-bit';

    this.terminal.interpret('\x1b[?1039h');
    assert.equal(this.terminal.keyboard.altSendsWhat, 'escape');

    this.terminal.interpret('\x1b[?1039l');
    assert.equal(this.terminal.keyboard.altSendsWhat, '8-bit');

    // Restore the previous altSendsWhat setting.
    this.terminal.keyboard.altSendsWhat = previousAltSendsWhat;

    assert(this.terminal.screen_ === this.terminal.primaryScreen_);

    this.terminal.interpret('\x1b[?1049h');
    assert(this.terminal.screen_ === this.terminal.alternateScreen_);

    this.terminal.interpret('\x1b[?1049l');
    assert(this.terminal.screen_ === this.terminal.primaryScreen_);
  });

/**
 * Check parseInt behavior.
 */
it('parsestate-parseint', function() {
  const parserState = new hterm.VT.ParseState();

  // Check default arg handling.
  assert.equal(0, parserState.parseInt(''));
  assert.equal(0, parserState.parseInt('', 0));
  assert.equal(1, parserState.parseInt('', 1));

  // Check default arg handling when explicitly zero.
  assert.equal(0, parserState.parseInt('0'));
  assert.equal(0, parserState.parseInt('0', 0));
  assert.equal(1, parserState.parseInt('0', 1));

  // Check non-default args.
  assert.equal(5, parserState.parseInt('5'));
  assert.equal(5, parserState.parseInt('5', 0));
  assert.equal(5, parserState.parseInt('5', 1));
});

/**
 * Check iarg handling.
 */
it('parsestate-iarg', function() {
  const parserState = new hterm.VT.ParseState();

  // Check unset args.
  assert.equal(0, parserState.iarg(10));
  assert.equal(1, parserState.iarg(10, 1));

  // Check set args.
  parserState.args = [0, 5];
  assert.equal(0, parserState.iarg(10));
  assert.equal(1, parserState.iarg(10, 1));
  assert.equal(0, parserState.iarg(0));
  assert.equal(1, parserState.iarg(0, 1));
  assert.equal(5, parserState.iarg(1));
  assert.equal(5, parserState.iarg(1, 1));
});

/**
 * Check handling of subargs.
 */
it('parsestate-subargs', function() {
  const parserState = new hterm.VT.ParseState();

  // Check initial/null state.
  assert.isTrue(!parserState.argHasSubargs(0));
  assert.isTrue(!parserState.argHasSubargs(1000));

  // Mark one arg as having subargs.
  parserState.argSetSubargs(1);
  assert.isTrue(!parserState.argHasSubargs(0));
  assert.isTrue(parserState.argHasSubargs(1));
});

/**
 * Check handling of extended ISO 8613-6 colors.
 */
it('sgr-extended-colors-parser', function() {
  const parserState = new hterm.VT.ParseState();
  const ta = this.terminal.getTextAttributes();

  [
    // Fully semi-colon separated args.
    [0, '38;2;10;20;30', 4, 'rgb(10, 20, 30)'],
    [1, '4;38;2;10;20;30', 4, 'rgb(10, 20, 30)'],
    [0, '38;5;1', 2, 1],
    [1, '4;38;5;1', 2, 1],
    // Fully colon delimited, but legacy xterm form.
    [0, '38:2:10:20:30', 0, 'rgb(10, 20, 30)'],
    [1, '4;38:2:10:20:30', 0, 'rgb(10, 20, 30)'],
    // Fully colon delimited matching ISO 8613-6.
    [0, '38:0', 0, undefined],
    [0, '38:1', 0, 'rgba(0, 0, 0, 0)'],
    [0, '38:2::10:20:30', 0, 'rgb(10, 20, 30)'],
    [0, '38:2::10:20:30:', 0, 'rgb(10, 20, 30)'],
    [0, '38:2::10:20:30::', 0, 'rgb(10, 20, 30)'],
    // TODO: Add CMY & CMYK forms when we support them.
    [0, '38:5:1', 0, 1],
    [1, '4;38:5:1', 0, 1],
    // Reject the xterm form that mixes semi-colons & colons.
    [0, '38;2:10:20:30', 0, undefined],
    [0, '38;5:1', 0, undefined],
    // Reject too short forms.
    [0, '38;2', 0, undefined],
    [0, '38;2;10', 0, undefined],
    [0, '38;2;10;20', 0, undefined],
    [0, '38:2', 0, undefined],
    [0, '38:2:10', 0, undefined],
    [0, '38:2:10:20', 0, undefined],
    [0, '38:3::10:20', 0, undefined],
    [0, '38:4::10:20:30', 0, undefined],
    [0, '38:5', 0, undefined],
    // Reject non-true color & palete color forms -- require ISO 8613-6.
    [0, '38;0', 0, undefined],
    [0, '38;1', 0, undefined],
    [0, '38;3;10;20;30', 0, undefined],
    [0, '38;4;10;20;30;40', 0, undefined],
    // Reject out of range color number.
    [0, '38:5:100000', 0, undefined],
  ].forEach(([i, input, expSkipCount, expColor]) => {
    // Set up the parser state from the inputs.
    const args = input.split(';');
    parserState.args = args;
    parserState.subargs = {};
    for (let i = 0; i < args.length; ++i) {
      parserState.subargs[i] = args[i].includes(':');
    }

    const ret = this.terminal.vt.parseSgrExtendedColors(parserState, i, ta);
    assert.equal(expSkipCount, ret.skipCount, input);
    assert.equal(expColor, ret.color, input);
  });
});

/**
 * Test setting of true color mode in colon delimited formats.
 *
 * This also indirectly checks chaining SGR behavior.
 */
it('true-color-colon', function() {
  let text;
  let style;
  const ta = this.terminal.getTextAttributes();

  // Check fully semi-colon delimited: 38;2;R;G;Bm
  this.terminal.interpret('\x1b[38;2;110;120;130;48;2;10;20;30;4mHI1');
  assert.equal('solid', ta.underline);
  style = this.terminal.getRowNode(0).childNodes[0].style;
  assert.equal('rgb(110, 120, 130)', style.color);
  assert.equal('rgb(10, 20, 30)', style.backgroundColor);
  text = this.terminal.getRowText(0);
  assert.equal('HI1', text);

  this.terminal.reset();
  this.terminal.clearHome();

  // Check fully colon delimited (xterm-specific): 38:2:R:G:Bm
  this.terminal.interpret('\x1b[38:2:170:180:190;48:2:70:80:90;4mHI2');
  assert.equal('solid', ta.underline);
  style = this.terminal.getRowNode(0).childNodes[0].style;
  assert.equal('rgb(170, 180, 190)', style.color);
  assert.equal('rgb(70, 80, 90)', style.backgroundColor);
  text = this.terminal.getRowText(0);
  assert.equal('HI2', text);

  this.terminal.reset();
  this.terminal.clearHome();

  // Check fully colon delimited (ISO 8613-6): 38:2::R:G:Bm
  this.terminal.interpret('\x1b[38:2::171:181:191;48:2::71:81:91;4mHI3');
  assert.equal('solid', ta.underline);
  style = this.terminal.getRowNode(0).childNodes[0].style;
  assert.equal('rgb(171, 181, 191)', style.color);
  assert.equal('rgb(71, 81, 91)', style.backgroundColor);
  text = this.terminal.getRowText(0);
  assert.equal('HI3', text);

  this.terminal.reset();
  this.terminal.clearHome();

  // Check fully colon delimited w/extra args (ISO 8613-6): 38:2::R:G:B::m
  this.terminal.interpret('\x1b[38:2::172:182:192::;48:2::72:82:92::;4mHI4');
  assert.equal('solid', ta.underline);
  style = this.terminal.getRowNode(0).childNodes[0].style;
  assert.equal('rgb(172, 182, 192)', style.color);
  assert.equal('rgb(72, 82, 92)', style.backgroundColor);
  text = this.terminal.getRowText(0);
  assert.equal('HI4', text);

  this.terminal.reset();
  this.terminal.clearHome();

  // Check fully colon delimited w/too few args (ISO 8613-6): 38:2::R
  this.terminal.interpret('\x1b[38:2::33;48:2::44;4mHI5');
  assert.equal('solid', ta.underline);
  style = this.terminal.getRowNode(0).childNodes[0].style;
  assert.equal('', style.color);
  assert.equal('', style.backgroundColor);
  text = this.terminal.getRowText(0);
  assert.equal('HI5', text);
});

/**
 * Test setting of 256 color mode in colon delimited formats.
 */
it('256-color-colon', function() {
  let text;
  let style;
  const ta = this.terminal.getTextAttributes();

  // Check fully semi-colon delimited: 38;5;Pm
  this.terminal.interpret('\x1b[38;5;10;48;5;20;4mHI1');
  assert.equal('solid', ta.underline);
  style = this.terminal.getRowNode(0).childNodes[0].style;
  assert.equal('rgb(var(--hterm-color-10))', style.color);
  assert.equal('rgb(var(--hterm-color-20))', style.backgroundColor);
  text = this.terminal.getRowText(0);
  assert.equal('HI1', text);

  this.terminal.reset();
  this.terminal.clearHome();

  // Check fully colon delimited: 38:5:Pm
  this.terminal.interpret('\x1b[38:5:50;48:5:60;4mHI2');
  assert.equal('solid', ta.underline);
  style = this.terminal.getRowNode(0).childNodes[0].style;
  assert.equal('rgb(var(--hterm-color-50))', style.color);
  assert.equal('rgb(var(--hterm-color-60))', style.backgroundColor);
  text = this.terminal.getRowText(0);
  assert.equal('HI2', text);
});

/**
 * Test setting of true color mode on text
 */
it('true-color-mode', function() {
    function getEscape(row, fg) {
      return '\x1b[' + (fg == true ? 38 : 48) + ';2;' + row[1] + ';' +
             row[2] + ';' + row[3] + 'm';
    }

    function getRGB(row) {
      return 'rgb(' + row[1] + ', ' + row[2] + ', ' + row[3] + ')';
    }

    this.terminal.setWidth(80);

    const colors = [
      ['Aero', 124, 185, 232],
      ['Amber', 255, 191, 0],
      ['Bitter Lime', 191, 255, 0],
      ['Coffee', 111, 78, 55],
      ['Electric Crimson', 255, 0, 63],
      ['French Rose', 246, 74, 138],
    ];

    for (let i = 0; i < 6; i++) {
      const fg = getRGB(colors[i]);
      for (let j = 0; j < 6; j++) {
        this.terminal.interpret('[mTrue Color Test ' +
                                getEscape(colors[i], true) +
                                getEscape(colors[j], false) + colors[i][0] +
                                ' and ' + colors[j][0] + '\r\n');

        const text = this.terminal.getRowText(6 * i + j, 1);
        assert.equal(text, 'True Color Test ' + colors[i][0] + ' and ' +
                     colors[j][0]);

        const bg = getRGB(colors[j]);
        const style = this.terminal.getRowNode(6 * i + j).childNodes[1].style;
        assert.equal(style.color, fg);
        assert.equal(style.backgroundColor, bg);
      }
    }
  });

/**
 * Check chained SGR sequences.
 */
it('chained-sgr', function() {
  let text;
  let style;
  const ta = this.terminal.getTextAttributes();

  // Check true color parsing.
  this.terminal.interpret('\x1b[' +
                          // Reset everything.
                          '0;' +
                          // Enable bold.
                          '1;' +
                          // Set foreground via true color.
                          '38;2;11;22;33;' +
                          // Enable italic.
                          '3;' +
                          // Set background via true color.
                          '48;2;33;22;11;' +
                          // Enable underline.
                          '4' +
                          'mHI1');
  assert.isTrue(ta.bold);
  assert.isTrue(ta.italic);
  assert.equal('solid', ta.underline);
  assert.isFalse(ta.faint);
  assert.isFalse(ta.strikethrough);
  style = this.terminal.getRowNode(0).childNodes[0].style;
  assert.equal('rgb(11, 22, 33)', style.color);
  assert.equal('rgb(33, 22, 11)', style.backgroundColor);
  text = this.terminal.getRowText(0);
  assert.equal('HI1', text);

  this.terminal.reset();
  this.terminal.clearHome();
  assert.isFalse(ta.bold);
  assert.isFalse(ta.italic);
  assert.isFalse(ta.underline);
  assert.isFalse(ta.faint);
  assert.isFalse(ta.strikethrough);

  // Check 256 color parsing.
  this.terminal.interpret('\x1b[' +
                          // Reset everything.
                          '0;' +
                          // Enable bold.
                          '1;' +
                          // Set foreground via true color.
                          '38;5;11;' +
                          // Enable italic.
                          '3;' +
                          // Set background via true color.
                          '48;5;22;' +
                          // Enable underline.
                          '4' +
                          'mHI2');
  assert.isTrue(ta.bold);
  assert.isTrue(ta.italic);
  assert.equal('solid', ta.underline);
  assert.isFalse(ta.faint);
  assert.isFalse(ta.strikethrough);
  style = this.terminal.getRowNode(0).childNodes[0].style;
  assert.equal('rgb(var(--hterm-color-11))', style.color);
  assert.equal('rgb(var(--hterm-color-22))', style.backgroundColor);
  text = this.terminal.getRowText(0);
  assert.equal('HI2', text);
});

/**
 * Check various underline modes.
 */
it('underline-sgr', function() {
  const ta = this.terminal.getTextAttributes();

  // Default mode 4: plain underline.
  this.terminal.interpret('\x1b[0;4m');
  assert.equal('solid', ta.underline);

  // 0 subarg turns it off.
  this.terminal.interpret('\x1b[0;4:0m');
  assert.isFalse(ta.underline);

  // 1 subarg is a single underline.
  this.terminal.interpret('\x1b[0;4:1m');
  assert.equal('solid', ta.underline);

  // 2 subarg is double underline.
  this.terminal.interpret('\x1b[0;4:2m');
  assert.equal('double', ta.underline);

  // 3 subarg is wavy underline.
  this.terminal.interpret('\x1b[0;4:3m');
  assert.equal('wavy', ta.underline);

  // 4 subarg is dotted underline.
  this.terminal.interpret('\x1b[0;4:4m');
  assert.equal('dotted', ta.underline);

  // 5 subarg is dashed underline.
  this.terminal.interpret('\x1b[0;4:5m');
  assert.equal('dashed', ta.underline);

  // 6 subarg is unknown -> none.
  this.terminal.interpret('\x1b[0;4:6m');
  assert.isFalse(ta.underline);

  // Check coloring (lightly as SGR 38/48 tests cover it).
  this.terminal.interpret('\x1b[0;4;58:2:10:20:30m');
  assert.equal('solid', ta.underline);
  assert.equal('rgb(10, 20, 30)', ta.underlineSource);

  // Check reset behavior.
  this.terminal.interpret('\x1b[0m');
  assert.isFalse(ta.underline);
  assert.equal(ta.SRC_DEFAULT, ta.underlineSource);
});

/**
 * TODO(rginda): Test origin mode.
 */
it.skip('origin-mode', function() {
  });

/**
 * Test insert/overwrite mode.
 */
it('insert-mode', function() {
    // Should be off by default.
    assert.isFalse(this.terminal.options_.insertMode);

    this.terminal.interpret('\x1b[4h');
    this.terminal.interpret(' one\x1b[4Dline\r\n');

    this.terminal.interpret('\x1b[4l');
    this.terminal.interpret('XXXXXXXX\x1b[8Dline two\r\n');

    this.terminal.interpret('\x1b[4h');
    this.terminal.interpret(' three\x1b[6Dline');

    const text = this.terminal.getRowsText(0, 3);
    assert.equal(text,
                 'line one\n' +
                 'line two\n' +
                 'line three');
  });

/**
 * Test wraparound mode.
 */
it('wraparound-mode-on', function() {
    // Should be on by default.
    assert.isTrue(this.terminal.options_.wraparound);

    this.terminal.interpret('-----  1  ----a');
    this.terminal.interpret('-----  2  ----b');
    this.terminal.interpret('-----  3  ----c');
    this.terminal.interpret('-----  4  ----d');
    this.terminal.interpret('-----  5  ----e');
    this.terminal.interpret('-----  6  ----f');

    const text = this.terminal.getRowsText(0, 6);
    assert.equal(text,
                 '-----  1  ----a' +
                 '-----  2  ----b' +
                 '-----  3  ----c' +
                 '-----  4  ----d' +
                 '-----  5  ----e' +
                 '-----  6  ----f');

    assert.equal(this.terminal.getCursorRow(), 5);
    assert.equal(this.terminal.getCursorColumn(), 14);
  });

it('wraparound-mode-off', function() {
    this.terminal.interpret('\x1b[?7l');
    assert.isFalse(this.terminal.options_.wraparound);

    this.terminal.interpret('-----  1  ----a');
    this.terminal.interpret('-----  2  ----b');
    this.terminal.interpret('-----  3  ----c');
    this.terminal.interpret('-----  4  ----d');
    this.terminal.interpret('-----  5  ----e');
    this.terminal.interpret('-----  6  ----f');

    const text = this.terminal.getRowsText(0, 6);
    assert.equal(text,
                 '-----  1  ----f\n' +
                 '\n' +
                 '\n' +
                 '\n' +
                 '\n');

    assert.equal(this.terminal.getCursorRow(), 0);
    assert.equal(this.terminal.getCursorColumn(), 14);
  });

/**
 * Test the interactions between insert and wraparound modes.
 */
it('insert-wrap', function() {
    // Should be on by default.
    assert.isTrue(this.terminal.options_.wraparound);

    this.terminal.interpret('' + // Insert off, wrap on (default).
                            '[15GAAAA[1GXX\r\n' +
                            '[4h[?7l' +  // Insert on, wrap off.
                            '[15GAAAA[1GXX\r\n' +
                            '[4h[?7h' +  // Insert on, wrap on.
                            '[15GAAAA[1GXX\r\n' +
                            '[4l[?7l' +  // Insert off, wrap off.
                            '[15GAAAA[1GXX');

    assert.equal(this.terminal.getRowText(0), '              A');
    assert.equal(this.terminal.getRowText(1), 'XXA');
    assert.equal(this.terminal.getRowText(2), 'XX             ');
    assert.equal(this.terminal.getRowText(3), '              A');
    assert.equal(this.terminal.getRowText(4), 'XXAAA');
    assert.equal(this.terminal.getRowText(5), 'XX            A');
  });

/**
 * Test a line that is long enough to need to be wrapped more than once.
 */
it('long-wrap', function() {
    let str = '';
    for (let i = 0; i < this.visibleColumnCount * 3; i++) {
      str += 'X';
    }

    this.terminal.interpret(str);

    assert.equal(this.terminal.getRowText(0), 'XXXXXXXXXXXXXXX');
    assert.equal(this.terminal.getRowText(1), 'XXXXXXXXXXXXXXX');
    assert.equal(this.terminal.getRowText(2), 'XXXXXXXXXXXXXXX');
  });

/**
 * Test reverse wraparound.
 */
it('reverse-wrap', function() {
    // A line ending with a hard CRLF.
    let str = 'AAAA\r\n';

    // Enough X's to wrap once and leave the cursor in the overflow state at
    // the end of the third row.
    for (let i = 0; i < this.visibleColumnCount * 2; i++) {
      str += 'X';
    }

    // CR to put us at col 0, backspace to put us at the last column of the
    // previous row, if reverse wraparound is enabled.
    str += '\r\bBB';

    // Without reverse wraparound, we should get stuck at column 0 of the third
    // row.
    this.terminal.interpret(str);

    assert.equal(this.terminal.getRowText(0), 'AAAA');
    assert.equal(this.terminal.getRowText(1), 'XXXXXXXXXXXXXXX');
    assert.equal(this.terminal.getRowText(2), 'BBXXXXXXXXXXXXX');

    // With reverse wraparound, we'll back up to the previous row.
    this.terminal.clearHome();
    this.terminal.interpret('\x1b[?45h' + str);

    assert.equal(this.terminal.getRowText(0), 'AAAA');
    assert.equal(this.terminal.getRowText(1), 'XXXXXXXXXXXXXXB');
    assert.equal(this.terminal.getRowText(2), 'BXXXXXXXXXXXXXX');

    // Reverse wrapping should always go the the final column of the previous
    // row, even if that row was not full of text.
    this.terminal.interpret('\r\b\r\bCC');

    assert.equal(this.terminal.getRowText(0), 'AAAA          C');
    assert.equal(this.terminal.getRowText(1), 'CXXXXXXXXXXXXXB');
    assert.equal(this.terminal.getRowText(2), 'BXXXXXXXXXXXXXX');

    // Reverse wrapping past the first row should put us at the last row.
    this.terminal.interpret('\r\b\r\bX');
    assert.equal(this.terminal.getRowText(0), 'AAAA          C');
    assert.equal(this.terminal.getRowText(1), 'CXXXXXXXXXXXXXB');
    assert.equal(this.terminal.getRowText(2), 'BXXXXXXXXXXXXXX');
    assert.equal(this.terminal.getRowText(3), '');
    assert.equal(this.terminal.getRowText(4), '');
    assert.equal(this.terminal.getRowText(5), '              X');
  });

/**
 * Test interactions between the cursor overflow bit and various
 * escape sequences.
 */
it('cursor-overflow', function() {
    // Should be on by default.
    assert.isTrue(this.terminal.options_.wraparound);

    // Fill a row with the last hyphen wrong, then run a command that
    // modifies the screen, then add a hyphen. The wrap bit should be
    // cleared, so the extra hyphen can fix the row.

    // We expect the EL in the presence of cursor overflow to be ignored.
    // See hterm.Terminal.prototype.eraseToRight.
    this.terminal.interpret('-----  1  ----X');
    this.terminal.interpret('\x1b[K-');  // EL

    this.terminal.interpret('----  2  ----X');
    this.terminal.interpret('\x1b[J-');  // ED

    this.terminal.interpret('-----  3  ----X');
    this.terminal.interpret('\x1b[@-');  // ICH

    this.terminal.interpret('-----  4  ----X');
    this.terminal.interpret('\x1b[P-');  // DCH

    // ECH is also ignored in the presence of cursor overflow.
    this.terminal.interpret('-----  5  ----X');
    this.terminal.interpret('\x1b[X-');  // ECH

    // DL will delete the entire line but clear the wrap bit, so we
    // expect a hyphen at the end and nothing else.
    this.terminal.interpret('XXXXXXXXXXXXXX');
    this.terminal.interpret('\x1b[M-');  // DL

    const text = this.terminal.getRowsText(0, 6);
    assert.equal(text,
                 '-----  1  ----X' +
                 '-----  2  -----' +
                 '-----  3  -----' +
                 '-----  4  -----' +
                 '-----  5  ----X' +
                 '              -');

    assert.equal(this.terminal.getCursorRow(), 5);
    assert.equal(this.terminal.getCursorColumn(), 14);
  });

it('alternate-screen', function() {
    this.terminal.interpret('1\r\n2\r\n3\r\n4\r\n5\r\n6\r\n7\r\n8\r\n9\r\n10');
    this.terminal.interpret('\x1b[3;3f');  // Leave the cursor at (3,3)
    let text = this.terminal.getRowsText(0, 10);
    assert.equal(text, '1\n2\n3\n4\n5\n6\n7\n8\n9\n10');

    // Switch to alternate screen.
    this.terminal.interpret('\x1b[?1049h');
    text = this.terminal.getRowsText(0, 10);
    assert.equal(text, '1\n2\n3\n4\n\n\n\n\n\n');

    this.terminal.interpret('\r\nhi');
    text = this.terminal.getRowsText(0, 10);
    assert.equal(text, '1\n2\n3\n4\n\n\n\nhi\n\n');

    // Switch back to primary screen.
    this.terminal.interpret('\x1b[?1049l');
    text = this.terminal.getRowsText(0, 10);
    assert.equal(text, '1\n2\n3\n4\n5\n6\n7\n8\n9\n10');

    this.terminal.interpret('XX');
    text = this.terminal.getRowsText(0, 10);
    assert.equal(text, '1\n2\n3\n4\n5\n6\n7 XX\n8\n9\n10');

    // And back to alternate screen.
    this.terminal.interpret('\x1b[?1049h');
    text = this.terminal.getRowsText(0, 10);
    assert.equal(text, '1\n2\n3\n4\n\n\n\n\n\n');

    this.terminal.interpret('XX');
    text = this.terminal.getRowsText(0, 10);
    assert.equal(text, '1\n2\n3\n4\n\n\n    XX\n\n\n');
  });

/**
 * Test basic hyperlinks.
 */
it('OSC-8', function() {
  const tattrs = this.terminal.getTextAttributes();

  // Start with links off.
  assert.isNull(tattrs.uriId);
  assert.isNull(tattrs.uri);

  // Start to linkify some text.
  this.terminal.interpret('\x1b]8;id=foo;http://foo\x07');
  assert.equal('foo', tattrs.uriId);
  assert.equal('http://foo', tattrs.uri);

  // Add the actual text.
  this.terminal.interpret('click me');

  // Stop the link.
  this.terminal.interpret('\x1b]8;\x07');
  assert.isNull(tattrs.uriId);
  assert.isNull(tattrs.uri);

  // Check the link.
  // Note: Can't check the URI target due to binding via event listener.
  const row = this.terminal.getRowNode(0);
  const span = row.childNodes[0];
  assert.equal('foo', span.uriId);
  assert.equal('click me', span.textContent);
  assert.equal('uri-node', span.className);
});

/**
 * Test hyperlinks with blank ids.
 */
it('OSC-8-blank-id', function() {
  const tattrs = this.terminal.getTextAttributes();

  // Create a link with a blank id.
  this.terminal.interpret('\x1b]8;;http://foo\x07click\x1b]8;\x07');
  assert.isNull(tattrs.uriId);
  assert.isNull(tattrs.uri);

  // Check the link.
  // Note: Can't check the URI target due to binding via event listener.
  const row = this.terminal.getRowNode(0);
  const span = row.childNodes[0];
  assert.equal('', span.uriId);
  assert.equal('click', span.textContent);
  assert.equal('uri-node', span.className);
});

/**
 * Test changing hyperlinks midstream.
 */
it('OSC-8-switch-uri', function() {
  const tattrs = this.terminal.getTextAttributes();

  // Create a link then change it.
  this.terminal.interpret(
      '\x1b]8;id=foo;http://foo\x07click\x1b]8;;http://bar\x07bat\x1b]8;\x07');
  assert.isNull(tattrs.uriId);
  assert.isNull(tattrs.uri);

  // Check the links.
  // Note: Can't check the URI target due to binding via event listener.
  const row = this.terminal.getRowNode(0);
  let span = row.childNodes[0];
  assert.equal('foo', span.uriId);
  assert.equal('click', span.textContent);
  assert.equal('uri-node', span.className);

  span = row.childNodes[1];
  assert.equal('', span.uriId);
  assert.equal('bat', span.textContent);
  assert.equal('uri-node', span.className);
});

/**
 * Test iTerm2 growl notifications.
 */
it('OSC-9', function() {
    assert.equal(0, Notification.count);

    // We don't test the title as it's generated, and the iTerm2 API doesn't
    // support changing it.

    // An empty notification.
    this.terminal.interpret('\x1b]9;\x07');
    assert.equal(1, Notification.count);
    assert.equal('', Notification.lastCall.body);

    // A random notification.
    this.terminal.interpret('\x1b]9;this is a title\x07');
    assert.equal(2, Notification.count);
    assert.equal('this is a title', Notification.lastCall.body);
  });

/**
 * Verify setting text foreground color.
 */
it('OSC-10', function() {
    // Make sure other colors aren't changed by accident.
    const backColor = this.terminal.getBackgroundColor();
    const cursorColor = this.terminal.getCursorColor();

    this.terminal.interpret('\x1b]10;red\x07');
    assert.equal('rgb(255, 0, 0)', this.terminal.getForegroundColor());

    this.terminal.interpret('\x1b]10;white\x07');
    assert.equal('rgb(255, 255, 255)', this.terminal.getForegroundColor());

    // Make sure other colors aren't changed by accident.
    assert.equal(backColor, this.terminal.getBackgroundColor());
    assert.equal(cursorColor, this.terminal.getCursorColor());
  });

/**
 * Verify setting text background color.
 */
it('OSC-11', function() {
    // Make sure other colors aren't changed by accident.
    const foreColor = this.terminal.getForegroundColor();
    const cursorColor = this.terminal.getCursorColor();

    this.terminal.interpret('\x1b]11;red\x07');
    assert.equal('rgb(255, 0, 0)', this.terminal.getBackgroundColor());

    this.terminal.interpret('\x1b]11;white\x07');
    assert.equal('rgb(255, 255, 255)', this.terminal.getBackgroundColor());

    // Make sure other colors aren't changed by accident.
    assert.equal(foreColor, this.terminal.getForegroundColor());
    assert.equal(cursorColor, this.terminal.getCursorColor());
  });

/**
 * Verify setting text cursor color (not the mouse cursor).
 */
it('OSC-12', function() {
    // Make sure other colors aren't changed by accident.
    const foreColor = this.terminal.getForegroundColor();
    const backColor = this.terminal.getBackgroundColor();

    this.terminal.interpret('\x1b]12;red\x07');
    assert.equal('rgb(255, 0, 0)', this.terminal.getCursorColor());

    this.terminal.interpret('\x1b]12;white\x07');
    assert.equal('rgb(255, 255, 255)', this.terminal.getCursorColor());

    // Make sure other colors aren't changed by accident.
    assert.equal(foreColor, this.terminal.getForegroundColor());
    assert.equal(backColor, this.terminal.getBackgroundColor());
  });

/**
 * Verify chaining color change requests.
 */
it('OSC-10-11-12', function() {
    // Set 10-11-12 at once.
    this.terminal.interpret('\x1b]10;red;green;blue\x07');
    assert.equal('rgb(255, 0, 0)', this.terminal.getForegroundColor());
    assert.equal('rgb(0, 255, 0)', this.terminal.getBackgroundColor());
    assert.equal('rgb(0, 0, 255)', this.terminal.getCursorColor());

    // Set 11-12 at once (and 10 stays the same).
    this.terminal.interpret('\x1b]11;white;black\x07');
    assert.equal('rgb(255, 0, 0)', this.terminal.getForegroundColor());
    assert.equal('rgb(255, 255, 255)', this.terminal.getBackgroundColor());
    assert.equal('rgb(0, 0, 0)', this.terminal.getCursorColor());
  });

/**
 * Test that we can use OSC 52 to copy to the system clipboard.
 */
it('OSC-52', function(done) {
    // Mock this out since we can't document.execCommand from the
    // test harness.
    const old_cCSTC = hterm.copySelectionToClipboard;
    hterm.copySelectionToClipboard = function(document, str) {
      hterm.copySelectionToClipboard = old_cCSTC;
      assert.equal(str, 'copypasta!');
      done();
      return Promise.resolve();
    };

    this.terminal.interpret('\x1b]52;c;Y29weXBhc3RhIQ==\x07');
  });

/**
 * Verify invalid OSC 52 content is ignored.
 */
it('OSC-52-invalid', function() {
  // Mock this out since we can't document.execCommand from the
  // test harness.
  const old_cCSTC = hterm.copySelectionToClipboard;
  hterm.copySelectionToClipboard = function(document, str) {
    hterm.copySelectionToClipboard = old_cCSTC;
    assert.fail();
    return Promise.resolve();
  };

  this.terminal.interpret('\x1b]52;c;!@#$%^&*\x07hello');
  const text = this.terminal.getRowsText(0, 1);
  assert.equal(text, 'hello');
});

/**
 * Test that OSC 52 works when large strings are split across multiple interpret
 * calls.
 */
it('OSC-52-big', function(done) {
    // Mock this out since we can't document.execCommand from the
    // test harness.
    const old_cCSTC = hterm.copySelectionToClipboard;
    hterm.copySelectionToClipboard = function(document, str) {
      hterm.copySelectionToClipboard = old_cCSTC;
      assert.equal(str, expect);
      done();
      return Promise.resolve();
    };

    let expect = '';
    for (let i = 0; i < 996; i++) {
      expect += 'x';
    }

    let encode = '';
    for (let i = 0; i < expect.length / 6; i++) {
      encode += 'eHh4';
    }

    this.terminal.interpret('\x1b]52;c;');
    this.terminal.interpret(encode);
    this.terminal.interpret(encode);
    this.terminal.interpret('\x07');
  });

it('OSC-4', function() {
    let resultString;

    this.terminal.io.sendString = (str) => resultString = str;
    // Change the terminal palette, then read it back.
    this.terminal.interpret('\x1b]4;1;rgb:0100/0100/0100;' +
                            '2;rgb:beef/beef/beef\x07');
    this.terminal.interpret('\x1b]4;1;?;2;?\x07');
    // The values go through some normalization, so what we read isn't
    // *exactly* what went in.
    assert.equal(resultString, '\x1b]4;1;rgb:0101/0101/0101;' +
                               '2;rgb:bebe/bebe/bebe\x07');

    // Round trip the normalized values, to check that the normalization is
    // idempotent.
    this.terminal.interpret('\x1b]4;1;rgb:0101/0101/0101;2;' +
                            'rgb:bebe/bebe/bebe\x07');
    assert.equal(resultString, '\x1b]4;1;rgb:0101/0101/0101;' +
                               '2;rgb:bebe/bebe/bebe\x07');
  });

/**
 * Test the cursor shape changes using OSC 50.
 */
it('OSC-50, cursor shapes', function() {
    assert.strictEqual(this.terminal.getCursorShape(),
                       hterm.Terminal.cursorShape.BLOCK);

    this.terminal.interpret('\x1b]50;CursorShape=1\x07');
    this.terminal.syncCursorPosition_();
    assert.strictEqual(this.terminal.getCursorShape(),
                       hterm.Terminal.cursorShape.BEAM);

    this.terminal.interpret('\x1b]50;CursorShape=0\x07');
    this.terminal.syncCursorPosition_();
    assert.strictEqual(this.terminal.getCursorShape(),
                       hterm.Terminal.cursorShape.BLOCK);

    this.terminal.interpret('\x1b]50;CursorShape=2\x07');
    this.terminal.syncCursorPosition_();
    assert.strictEqual(this.terminal.getCursorShape(),
                       hterm.Terminal.cursorShape.UNDERLINE);

    // Invalid shape, should be set cursor to block
    this.terminal.interpret('\x1b]50;CursorShape=a\x07');
    this.terminal.syncCursorPosition_();
    assert.strictEqual(this.terminal.getCursorShape(),
                       hterm.Terminal.cursorShape.BLOCK);
  });

/**
 * Verify resetting the color palette.
 */
it('OSC-104', function() {
  let resultString;
  this.terminal.io.sendString = (str) => resultString = str;

  // Change the terminal palette.
  this.terminal.interpret('\x1b]4;1;rgb:0100/0100/0100\x07');

  // Verify it changed.
  this.terminal.interpret('\x1b]4;1;?\x07');
  assert.equal(resultString, '\x1b]4;1;rgb:0101/0101/0101\x07');

  // Reset it.  We omit the ; here on purpose.
  resultString = '';
  this.terminal.interpret('\x1b]104\x07');

  // Verify it changed.
  this.terminal.interpret('\x1b]4;1;?\x07');
  assert.equal(resultString, '\x1b]4;1;rgb:cccc/0000/0000\x07');
});

/**
 * Verify resetting text foreground color.
 */
it('OSC-110', function() {
  // Make sure other colors aren't changed by accident.
  const backColor = this.terminal.getBackgroundColor();
  const cursorColor = this.terminal.getCursorColor();

  this.terminal.interpret('\x1b]10;red\x07');
  assert.equal('rgb(255, 0, 0)', this.terminal.getForegroundColor());

  this.terminal.interpret('\x1b]110;\x07');
  assert.equal('rgb(240, 240, 240)', this.terminal.getForegroundColor());

  // Make sure other colors aren't changed by accident.
  assert.equal(backColor, this.terminal.getBackgroundColor());
  assert.equal(cursorColor, this.terminal.getCursorColor());
});

/**
 * Verify resetting text background color.
 */
it('OSC-111', function() {
  // Make sure other colors aren't changed by accident.
  const foreColor = this.terminal.getForegroundColor();
  const cursorColor = this.terminal.getCursorColor();

  this.terminal.interpret('\x1b]11;red\x07');
  assert.equal('rgb(255, 0, 0)', this.terminal.getBackgroundColor());

  this.terminal.interpret('\x1b]111;\x07');
  assert.equal('rgb(16, 16, 16)', this.terminal.getBackgroundColor());

  // Make sure other colors aren't changed by accident.
  assert.equal(foreColor, this.terminal.getForegroundColor());
  assert.equal(cursorColor, this.terminal.getCursorColor());
});

/**
 * Verify resetting text cursor color (not the mouse cursor).
 */
it('OSC-112', function() {
  // Make sure other colors aren't changed by accident.
  const foreColor = this.terminal.getForegroundColor();
  const backColor = this.terminal.getBackgroundColor();

  this.terminal.interpret('\x1b]12;red\x07');
  assert.equal('rgb(255, 0, 0)', this.terminal.getCursorColor());

  this.terminal.interpret('\x1b]112;\x07');
  assert.equal('rgba(255, 0, 0, 0.5)', this.terminal.getCursorColor());

  // Make sure other colors aren't changed by accident.
  assert.equal(foreColor, this.terminal.getForegroundColor());
  assert.equal(backColor, this.terminal.getBackgroundColor());
});

/**
 * Test URxvt notify module.
 */
it('OSC-777-notify', function() {
    assert.equal(0, Notification.count);

    // An empty notification.  We don't test the title as it's generated.
    this.terminal.interpret('\x1b]777;notify\x07');
    assert.equal(1, Notification.count);
    assert.notEqual(Notification.lastCall.title, '');
    assert.isUndefined(Notification.lastCall.body);

    // Same as above, but covers slightly different parsing.
    this.terminal.interpret('\x1b]777;notify;\x07');
    assert.equal(2, Notification.count);
    assert.notEqual(Notification.lastCall.title, '');
    assert.isUndefined(Notification.lastCall.body);

    // A notification with a title.
    this.terminal.interpret('\x1b]777;notify;my title\x07');
    assert.equal(3, Notification.count);
    assert.include(Notification.lastCall.title, 'my title');
    assert.isUndefined(Notification.lastCall.body);

    // A notification with a title & body.
    this.terminal.interpret('\x1b]777;notify;my title;my body\x07');
    assert.equal(4, Notification.count);
    assert.include(Notification.lastCall.title, 'my title');
    assert.include(Notification.lastCall.body, 'my body');

    // A notification with a title & body, covering more parsing.
    this.terminal.interpret('\x1b]777;notify;my title;my body;and a semi\x07');
    assert.equal(5, Notification.count);
    assert.include(Notification.lastCall.title, 'my title');
    assert.include(Notification.lastCall.body, 'my body;and a semi');
  });

/**
 * Test iTerm2 1337 non-file transfers.
 */
it('OSC-1337-ignore', function() {
  this.terminal.displayImage =
      () => assert.fail('Unknown should not trigger file display');

  this.terminal.interpret('\x1b]1337;CursorShape=1\x07');
});

/**
 * Test iTerm2 1337 file transfer defaults.
 */
it('OSC-1337-file-defaults', function(done) {
  this.terminal.displayImage = (options) => {
    assert.equal('', options.name);
    assert.equal(0, options.size);
    assert.isTrue(options.preserveAspectRatio);
    assert.isFalse(options.inline);
    assert.equal('auto', options.width);
    assert.equal('auto', options.height);
    assert.equal('left', options.align);
    assert.isUndefined(options.uri);
    assert.deepStrictEqual(new Uint8Array([10]).buffer, options.buffer);
    done();
  };

  this.terminal.interpret('\x1b]1337;File=:Cg==\x07');
});

/**
 * Test iTerm2 1337 invalid values.
 */
it('OSC-1337-file-invalid', function(done) {
  this.terminal.displayImage = (options) => {
    assert.equal('', options.name);
    assert.equal(1, options.size);
    assert.isUndefined(options['unk']);
    done();
  };

  this.terminal.interpret(
      '\x1b]1337;File=' +
      // Ignore unknown keys.
      'unk=key;' +
      // The name is supposed to be base64 encoded.
      'name=[oo]ps;' +
      // Include a valid field to make sure we parsed it all
      'size=1;;;:Cg==\x07');
});

/**
 * Test iTerm2 1337 valid options.
 */
it('OSC-1337-file-valid', function(done) {
  // Check "false" values.
  this.terminal.displayImage = (options) => {
    assert.isFalse(options.preserveAspectRatio);
    assert.isFalse(options.inline);
  };
  this.terminal.interpret(
      '\x1b]1337;File=preserveAspectRatio=0;inline=0:Cg==\x07');

  // Check "true" values.
  this.terminal.displayImage = (options) => {
    assert.isTrue(options.preserveAspectRatio);
    assert.isTrue(options.inline);
  };
  this.terminal.interpret(
      '\x1b]1337;File=preserveAspectRatio=1;inline=1:Cg==\x07');

  // Check the rest.
  this.terminal.displayImage = (options) => {
    assert.equal('yes', options.name);
    assert.equal(1234, options.size);
    assert.equal('12px', options.width);
    assert.equal('50%', options.height);
    assert.equal('center', options.align);

    done();
  };
  this.terminal.interpret(
      '\x1b]1337;File=' +
      'name=eWVz;' +
      'size=1234;' +
      'width=12px;' +
      'height=50%;' +
      'align=center;' +
      ':Cg==\x07');
});

/**
 * Test handling of extra data after an iTerm2 1337 file sequence.
 */
it('OSC-1337-file-queue', function(done) {
  let text;

  // For non-inline files, things will be processed right away.
  this.terminal.displayImage = () => {};
  this.terminal.interpret('\x1b]1337;File=:Cg==\x07OK');
  text = this.terminal.getRowsText(0, 1);
  assert.equal('OK', text);

  // For inline files, things should be delayed.
  // The io/timeout logic is supposed to mock the normal behavior.
  this.terminal.displayImage = function() {
    const io = this.io.push();
    setTimeout(() => {
      io.pop();
      text = this.getRowsText(0, 1);
      assert.equal('OK', text);
      done();
    }, 0);
  };
  this.terminal.clearHome();
  this.terminal.interpret('\x1b]1337;File=inline=1:Cg==\x07OK');
  text = this.terminal.getRowsText(0, 1);
  assert.equal('', text);
});

/**
 * Test the cursor shape changes using DECSCUSR.
 */
it('DECSCUSR, cursor shapes', function() {
    assert.strictEqual(this.terminal.getCursorShape(),
                       hterm.Terminal.cursorShape.BLOCK);
    assert.isFalse(this.terminal.options_.cursorBlink);

    this.terminal.interpret('\x1b[ 3q');
    this.terminal.syncCursorPosition_();
    assert.strictEqual(this.terminal.getCursorShape(),
                       hterm.Terminal.cursorShape.UNDERLINE);
    assert.isTrue(this.terminal.options_.cursorBlink);

    this.terminal.interpret('\x1b[ 0q');
    this.terminal.syncCursorPosition_();
    assert.strictEqual(this.terminal.getCursorShape(),
                       hterm.Terminal.cursorShape.BLOCK);
    assert.isTrue(this.terminal.options_.cursorBlink);

    this.terminal.interpret('\x1b[ 1q');
    this.terminal.syncCursorPosition_();
    assert.strictEqual(this.terminal.getCursorShape(),
                       hterm.Terminal.cursorShape.BLOCK);
    assert.isTrue(this.terminal.options_.cursorBlink);

    this.terminal.interpret('\x1b[ 4q');
    this.terminal.syncCursorPosition_();
    assert.strictEqual(this.terminal.getCursorShape(),
                       hterm.Terminal.cursorShape.UNDERLINE);
    assert.isFalse(this.terminal.options_.cursorBlink);

    this.terminal.interpret('\x1b[ 2q');
    this.terminal.syncCursorPosition_();
    assert.strictEqual(this.terminal.getCursorShape(),
                       hterm.Terminal.cursorShape.BLOCK);
    assert.isFalse(this.terminal.options_.cursorBlink);
  });

it('bracketed-paste', function() {
    let resultString;
    this.terminal.io.sendString = (str) => resultString = str;

    assert.isFalse(this.terminal.options_.bracketedPaste);

    this.terminal.interpret('\x1b[?2004h');
    assert.isTrue(this.terminal.options_.bracketedPaste);

    this.terminal.onPaste_({text: 'hello world'});
    assert.equal(resultString, '\x1b[200~hello world\x1b[201~');

    this.terminal.interpret('\x1b[?2004l');
    assert.isFalse(this.terminal.options_.bracketedPaste);

    this.terminal.onPaste_({text: 'hello world'});
    assert.equal(resultString, 'hello world');
  });

it('fullscreen', function(done) {
  this.div.style.height = '100%';
  this.div.style.width = '100%';

  setTimeout(() => {
    for (let i = 0; i < 1000; i++) {
      let indent = i % 40;
      if (indent > 20) {
        indent = 40 - indent;
      }

      this.terminal.interpret(`Line ${lib.f.zpad(i, 3)}: ` +
                              ' '.repeat(indent) + '*\n');
    }

    done();
  }, 100);
});

/**
 * Verify switching character maps works.
 */
it('character-maps', function() {
    // This test checks graphics handling in ISO-2022 mode.
    this.terminal.vt.setEncoding('iso-2022');

    // Create a line with all the printable characters.
    let line = '';
    for (let i = 0x20; i < 0x7f; ++i) {
      line += String.fromCharCode(i);
    }

    this.terminal.setWidth(line.length);

    // Start with sanity check -- no translations are active.
    this.terminal.clearHome();
    this.terminal.interpret(line);
    assert.equal(this.terminal.getRowText(0), line);

    // Loop through all the maps.
    let map, gl;
    for (map in hterm.VT.CharacterMaps.DefaultMaps) {
      // If this map doesn't do any translations, skip it.
      gl = hterm.VT.CharacterMaps.DefaultMaps[map].GL;
      if (!gl) {
        continue;
      }

      // Point G0 to the specified map (and assume GL points to G0).
      this.terminal.clearHome();
      this.terminal.interpret('\x1b(' + map + line);
      assert.equal(this.terminal.getRowText(0), gl(line));
    }
  });

/**
 * Verify DOCS (encoding) switching behavior.
 */
it('docs', function() {
    // This test checks graphics handling in ISO-2022 mode.
    this.terminal.vt.setEncoding('iso-2022');

    // Create a line with all the printable characters.
    let line = '';
    for (let i = 0x20; i < 0x7f; ++i) {
      line += String.fromCharCode(i);
    }
    const graphicsLine = hterm.VT.CharacterMaps.DefaultMaps['0'].GL(line);

    this.terminal.setWidth(line.length);

    // Check the default encoding (ECMA-35).
    assert.isFalse(this.terminal.vt.codingSystemUtf8_);
    assert.isFalse(this.terminal.vt.codingSystemLocked_);
    this.terminal.clearHome();
    this.terminal.interpret(line);
    assert.equal(this.terminal.getRowText(0), line);

    // Switch to the graphics map and make sure it translates.
    this.terminal.clearHome();
    this.terminal.interpret('\x1b(0' + line);
    assert.equal(this.terminal.getRowText(0), graphicsLine);

    // Switch to UTF-8 encoding.  The graphics map should not translate.
    this.terminal.clearHome();
    this.terminal.interpret('\x1b%G' + line);
    assert.isTrue(this.terminal.vt.codingSystemUtf8_);
    assert.isFalse(this.terminal.vt.codingSystemLocked_);
    assert.equal(this.terminal.getRowText(0), line);

    // Switch to ECMA-35 encoding.  The graphics map should translate.
    this.terminal.clearHome();
    this.terminal.interpret('\x1b%@' + line);
    assert.isFalse(this.terminal.vt.codingSystemUtf8_);
    assert.isFalse(this.terminal.vt.codingSystemLocked_);
    assert.equal(this.terminal.getRowText(0), graphicsLine);

    // Switch to UTF-8 encoding (and lock).
    this.terminal.clearHome();
    this.terminal.interpret('\x1b%/G' + line);
    assert.isTrue(this.terminal.vt.codingSystemUtf8_);
    assert.isTrue(this.terminal.vt.codingSystemLocked_);
    assert.equal(this.terminal.getRowText(0), line);

    // Switching back to ECMA-35 should not work now.
    this.terminal.clearHome();
    this.terminal.interpret('\x1b%@' + line);
    assert.isTrue(this.terminal.vt.codingSystemUtf8_);
    assert.isTrue(this.terminal.vt.codingSystemLocked_);
    assert.equal(this.terminal.getRowText(0), line);

    // Try other UTF-8 modes (although they're the same as /G).
    this.terminal.clearHome();
    this.terminal.interpret('\x1b%/H' + line);
    assert.isTrue(this.terminal.vt.codingSystemUtf8_);
    assert.isTrue(this.terminal.vt.codingSystemLocked_);
    assert.equal(this.terminal.getRowText(0), line);

    this.terminal.clearHome();
    this.terminal.interpret('\x1b%/I' + line);
    assert.isTrue(this.terminal.vt.codingSystemUtf8_);
    assert.isTrue(this.terminal.vt.codingSystemLocked_);
    assert.equal(this.terminal.getRowText(0), line);
  });

/**
 * Verify DOCS (encoding) invalid escapes don't mess things up.
 */
it('docs-invalid', function() {
    // This test checks graphics handling in ISO-2022 mode.
    this.terminal.vt.setEncoding('iso-2022');

    // Check the default encoding (ECMA-35).
    assert.isFalse(this.terminal.vt.codingSystemUtf8_);
    assert.isFalse(this.terminal.vt.codingSystemLocked_);

    // Try switching to a random set of invalid escapes.
    ['a', '9', 'X', '(', '}'].forEach((ch) => {
      // First in ECMA-35 encoding.
      this.terminal.interpret('\x1b%@');
      this.terminal.interpret('\x1b%' + ch);
      assert.isFalse(this.terminal.vt.codingSystemUtf8_);
      assert.isFalse(this.terminal.vt.codingSystemLocked_);
      assert.equal(this.terminal.getRowText(0), '');

      this.terminal.interpret('\x1b%/' + ch);
      assert.isFalse(this.terminal.vt.codingSystemUtf8_);
      assert.isFalse(this.terminal.vt.codingSystemLocked_);
      assert.equal(this.terminal.getRowText(0), '');

      // Then in UTF-8 encoding.
      this.terminal.interpret('\x1b%G');
      this.terminal.interpret('\x1b%' + ch);
      assert.isTrue(this.terminal.vt.codingSystemUtf8_);
      assert.isFalse(this.terminal.vt.codingSystemLocked_);
      assert.equal(this.terminal.getRowText(0), '');

      this.terminal.interpret('\x1b%/' + ch);
      assert.isTrue(this.terminal.vt.codingSystemUtf8_);
      assert.isFalse(this.terminal.vt.codingSystemLocked_);
      assert.equal(this.terminal.getRowText(0), '');
    });
  });

/**
 * Check cursor save/restore behavior.
 */
it('cursor-save-restore', function() {
  let tattrs;

  // Save the current cursor state.
  this.terminal.interpret('\x1b[?1048h');

  // Change cursor attributes.
  this.terminal.interpret('\x1b[1;4m');
  tattrs = this.terminal.getTextAttributes();
  assert.isTrue(tattrs.bold);
  assert.equal('solid', tattrs.underline);

  // Change color palette a bit.
  assert.equal('rgb(0, 0, 0)', this.terminal.getColorPalette(0));
  assert.equal('rgb(204, 0, 0)', this.terminal.getColorPalette(1));
  this.terminal.interpret('\x1b]4;1;#112233;\x07');
  assert.equal('rgb(0, 0, 0)', this.terminal.getColorPalette(0));
  assert.equal('rgb(17, 34, 51)', this.terminal.getColorPalette(1));

  // Restore the saved cursor state.
  this.terminal.interpret('\x1b[?1048l');

  // Check attributes were restored correctly.
  tattrs = this.terminal.getTextAttributes();
  assert.isFalse(tattrs.bold);
  assert.isFalse(tattrs.underline);

  // Make sure color palette did not change.
  assert.equal('rgb(0, 0, 0)', this.terminal.getColorPalette(0));
  assert.equal('rgb(17, 34, 51)', this.terminal.getColorPalette(1));
});

/**
 * Check different mouse mode selection.
 */
it('mouse-switching', function() {
  const terminal = this.terminal;

  const assertMouse = (report, coordinates) => {
    assert.strictEqual(report, terminal.vt.mouseReport);
    assert.strictEqual(coordinates, terminal.vt.mouseCoordinates);
  };

  // Mouse reporting is turned off by default (and in legacy X10).
  assertMouse(terminal.vt.MOUSE_REPORT_DISABLED,
              terminal.vt.MOUSE_COORDINATES_X10);

  // Turn on presses.
  terminal.interpret('\x1b[?9h');
  assertMouse(terminal.vt.MOUSE_REPORT_PRESS,
              terminal.vt.MOUSE_COORDINATES_X10);
  // Reset back.
  terminal.interpret('\x1b[?9l');
  assertMouse(terminal.vt.MOUSE_REPORT_DISABLED,
              terminal.vt.MOUSE_COORDINATES_X10);

  // Turn on drags.
  terminal.interpret('\x1b[?1002h');
  assertMouse(terminal.vt.MOUSE_REPORT_DRAG,
              terminal.vt.MOUSE_COORDINATES_X10);
  // Reset back.
  terminal.interpret('\x1b[?1002l');
  assertMouse(terminal.vt.MOUSE_REPORT_DISABLED,
              terminal.vt.MOUSE_COORDINATES_X10);

  // Resetting a different mode should also work.
  terminal.interpret('\x1b[?9h');
  assertMouse(terminal.vt.MOUSE_REPORT_PRESS,
              terminal.vt.MOUSE_COORDINATES_X10);
  terminal.interpret('\x1b[?1002l');
  assertMouse(terminal.vt.MOUSE_REPORT_DISABLED,
              terminal.vt.MOUSE_COORDINATES_X10);

  // Enable extended encoding.
  terminal.interpret('\x1b[?1005h');
  assertMouse(terminal.vt.MOUSE_REPORT_DISABLED,
              terminal.vt.MOUSE_COORDINATES_UTF8);
  terminal.interpret('\x1b[?9h');
  assertMouse(terminal.vt.MOUSE_REPORT_PRESS,
              terminal.vt.MOUSE_COORDINATES_UTF8);

  // Enable SGR encoding.
  terminal.interpret('\x1b[?1006h');
  assertMouse(terminal.vt.MOUSE_REPORT_PRESS,
              terminal.vt.MOUSE_COORDINATES_SGR);
});

/**
 * Check mouse behavior when reporting is disabled.
 */
it('mouse-disabled', function() {
  const terminal = this.terminal;
  let e;

  let resultString;
  terminal.io.sendString = (str) => resultString = str;

  // Nothing should be generated when reporting is disabled (the default).
  e = MockTerminalMouseEvent('mousedown');
  terminal.vt.onTerminalMouse_(e);
  e = MockTerminalMouseEvent('mouseup');
  terminal.vt.onTerminalMouse_(e);

  assert.isUndefined(resultString);
});

/**
 * Check mouse behavior when press reports are enabled.
 */
it('mouse-report-press', function() {
  const terminal = this.terminal;
  let e;

  let resultString;
  terminal.io.sendString = (str) => resultString = str;

  // Turn on presses.
  terminal.interpret('\x1b[?9h');

  // Send a mousedown event and check the report.
  e = MockTerminalMouseEvent('mousedown');
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M   ', resultString);
  resultString = undefined;

  // Mouse move events should be ignored.
  e = MockTerminalMouseEvent('mousemove', {terminalRow: 1, buttons: 1});
  terminal.vt.onTerminalMouse_(e);
  assert.isUndefined(resultString);

  // Mouse up events should be ignored.
  e = MockTerminalMouseEvent('mouseup');
  terminal.vt.onTerminalMouse_(e);
  assert.isUndefined(resultString);
});

/**
 * Check mouse press behavior with keyboard modifiers.
 *
 * Namely, keyboard modifiers shouldn't be reported.
 */
it('mouse-report-press-keyboard', function() {
  const terminal = this.terminal;
  let e;

  let resultString;
  terminal.io.sendString = (str) => resultString = str;

  // Turn on clicks.
  terminal.interpret('\x1b[?9h');

  // Switch to SGR coordinates to make tests below easier.
  terminal.interpret('\x1b[?1006h');

  // Check left mouse w/no keyboard.
  e = MockTerminalMouseEvent('mousedown');
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0M', resultString);
  resultString = undefined;

  // Check various key combos are not reported.
  e = MockTerminalMouseEvent('mousedown', {shiftKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0M', resultString);
  resultString = undefined;

  e = MockTerminalMouseEvent('mousedown', {altKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0M', resultString);
  resultString = undefined;

  e = MockTerminalMouseEvent('mousedown', {metaKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0M', resultString);
  resultString = undefined;

  e = MockTerminalMouseEvent('mousedown', {ctrlKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0M', resultString);
  resultString = undefined;

  e = MockTerminalMouseEvent('mousedown', {shiftKey: true, metaKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0M', resultString);
  resultString = undefined;
});

/**
 * Check mouse press behavior in X10 coordinates.
 */
it('mouse-press-x10-coord', function() {
  const terminal = this.terminal;
  let e;

  let resultString;
  terminal.io.sendString = (str) => resultString = str;

  // Turn on presses.  Default is X10 coordinates.
  terminal.interpret('\x1b[?9h');

  // Check 0,0 cell.
  e = MockTerminalMouseEvent('mousedown');
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M   ', resultString);

  // Check the 7-bit limit.
  e = MockTerminalMouseEvent(
      'mousedown', {terminalRow: 95, terminalColumn: 94});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M \x7e\x7f', resultString);

/*
  These are disabled because we currently clamp X10 reporting to 7-bit.

  // Check 150,100 cell.
  e = MockTerminalMouseEvent(
      'mousedown', {terminalRow: 150, terminalColumn: 100});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M \x84\xb6', resultString);

  // Check 222,222 cell (just below max range).
  e = MockTerminalMouseEvent(
      'mousedown', {terminalRow: 222, terminalColumn: 222});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M \xfe\xfe', resultString);

  // Check 223,223 cell (max range).
  e = MockTerminalMouseEvent(
      'mousedown', {terminalRow: 223, terminalColumn: 223});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M \xff\xff', resultString);

  // Check 300,300 cell (out of range).
  e = MockTerminalMouseEvent(
      'mousedown', {terminalRow: 300, terminalColumn: 300});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M \xff\xff', resultString);
*/
});

/**
 * Check mouse press behavior in UTF8 coordinates.
 */
it('mouse-press-utf8-coord', function() {
  const terminal = this.terminal;
  let e;

  let resultString;
  terminal.io.sendString = (str) => resultString = str;

  // Turn on presses.
  terminal.interpret('\x1b[?9h');

  // Switch to UTF8 coordinates.
  terminal.interpret('\x1b[?1005h');

  // Check 0,0 cell.
  e = MockTerminalMouseEvent('mousedown');
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M   ', resultString);

  // Check 150,100 cell.
  e = MockTerminalMouseEvent(
      'mousedown', {terminalRow: 150, terminalColumn: 100});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M \x84\xb6', resultString);

  // Check 2000,2000 cell.
  e = MockTerminalMouseEvent(
      'mousedown', {terminalRow: 2000, terminalColumn: 2000});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M \u07f0\u07f0', resultString);

  // Check 2014,2014 cell (just below max range).
  e = MockTerminalMouseEvent(
      'mousedown', {terminalRow: 2014, terminalColumn: 2014});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M \u07fe\u07fe', resultString);

  // Check 2015,2015 cell (max range).
  e = MockTerminalMouseEvent(
      'mousedown', {terminalRow: 2015, terminalColumn: 2015});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M \u07ff\u07ff', resultString);

  // Check 3000,3000 cell (out of range).
  e = MockTerminalMouseEvent(
      'mousedown', {terminalRow: 3000, terminalColumn: 3000});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M \u07ff\u07ff', resultString);
});

/**
 * Check mouse press behavior in SGR coordinates.
 */
it('mouse-press-sgr-coord', function() {
  const terminal = this.terminal;
  let e;

  let resultString;
  terminal.io.sendString = (str) => resultString = str;

  // Turn on presses.
  terminal.interpret('\x1b[?9h');

  // Switch to SGR coordinates.
  terminal.interpret('\x1b[?1006h');

  // Check 0,0 cell.
  e = MockTerminalMouseEvent('mousedown');
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0M', resultString);

  // Check 150,100 cell.
  e = MockTerminalMouseEvent(
      'mousedown', {terminalRow: 150, terminalColumn: 100});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;100;150M', resultString);

  // Check 2000,3000 cell.
  e = MockTerminalMouseEvent(
      'mousedown', {terminalRow: 2000, terminalColumn: 3000});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;3000;2000M', resultString);

  // Check 99999,55555 cell.
  e = MockTerminalMouseEvent(
      'mousedown', {terminalRow: 99999, terminalColumn: 55555});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;55555;99999M', resultString);
});

/**
 * Check mouse behavior when press clicks are enabled.
 */
it('mouse-report-click', function() {
  const terminal = this.terminal;
  let e;

  let resultString;
  terminal.io.sendString = (str) => resultString = str;

  // Turn on clicks.
  terminal.interpret('\x1b[?1000h');

  // Send a mousedown event and check the report.
  e = MockTerminalMouseEvent('mousedown');
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M   ', resultString);
  resultString = undefined;

  // Mouse move events should be ignored.
  e = MockTerminalMouseEvent('mousemove', {terminalRow: 1, buttons: 1});
  terminal.vt.onTerminalMouse_(e);
  assert.isUndefined(resultString);

  // Mouse up events should be reported.
  e = MockTerminalMouseEvent('mouseup');
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M#  ', resultString);
});

/**
 * Check mouse click behavior with buttons.
 *
 * Note: Most of the mouseup events in here lie and say that a button was
 * released ('mouseup') while saying it's still pressed ('buttons').  The
 * VT code doesn't check for this, so (ab)use this to simplify the test.
 */
it('mouse-report-click-buttons', function() {
  const terminal = this.terminal;
  let e;

  let resultString;
  terminal.io.sendString = (str) => resultString = str;

  // Turn on clicks.
  terminal.interpret('\x1b[?1000h');

  // Switch to SGR coordinates to make tests below easier.
  terminal.interpret('\x1b[?1006h');

  // Check left mouse w/no keyboard.
  e = MockTerminalMouseEvent('mousedown', {button: 0, buttons: 1});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0M', resultString);

  e = MockTerminalMouseEvent('mouseup', {button: 0, buttons: 1});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0m', resultString);

  // Check right mouse w/no keyboard.
  e = MockTerminalMouseEvent('mousedown', {button: 2, buttons: 2});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<2;0;0M', resultString);

  e = MockTerminalMouseEvent('mouseup', {button: 2, buttons: 2});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<2;0;0m', resultString);

  // Check middle mouse w/no keyboard.
  e = MockTerminalMouseEvent('mousedown', {button: 1, buttons: 4});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<1;0;0M', resultString);

  e = MockTerminalMouseEvent('mouseup', {button: 1, buttons: 4});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<1;0;0m', resultString);

  // Check pressing multiple buttons and then releasing them.
  e = MockTerminalMouseEvent('mousedown', {button: 0, buttons: 1});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0M', resultString);
  e = MockTerminalMouseEvent('mousedown', {button: 2, buttons: 3});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<2;0;0M', resultString);
  e = MockTerminalMouseEvent('mousedown', {button: 1, buttons: 7});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<1;0;0M', resultString);

  e = MockTerminalMouseEvent('mouseup', {button: 0, buttons: 7});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0m', resultString);
  e = MockTerminalMouseEvent('mouseup', {button: 0, buttons: 6});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0m', resultString);
  e = MockTerminalMouseEvent('mouseup', {button: 2, buttons: 4});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<2;0;0m', resultString);
  e = MockTerminalMouseEvent('mouseup', {button: 1, buttons: 0});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<1;0;0m', resultString);
});

/**
 * Check mouse click behavior with keyboard modifiers.
 */
it('mouse-report-click-keyboard', function() {
  const terminal = this.terminal;
  let e;

  let resultString;
  terminal.io.sendString = (str) => resultString = str;

  // Turn on clicks.
  terminal.interpret('\x1b[?1000h');

  // Switch to SGR coordinates to make tests below easier.
  terminal.interpret('\x1b[?1006h');

  // Check left mouse w/no keyboard.
  e = MockTerminalMouseEvent('mousedown');
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0M', resultString);

  // Check mouse down w/various key combos.
  e = MockTerminalMouseEvent('mousedown', {shiftKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<4;0;0M', resultString);

  e = MockTerminalMouseEvent('mousedown', {altKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0M', resultString);

  e = MockTerminalMouseEvent('mousedown', {metaKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<8;0;0M', resultString);

  e = MockTerminalMouseEvent('mousedown', {ctrlKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<16;0;0M', resultString);

  e = MockTerminalMouseEvent('mousedown', {shiftKey: true, metaKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<12;0;0M', resultString);

  // Check buttons & keys together.
  e = MockTerminalMouseEvent('mousedown', {button: 2, shiftKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<6;0;0M', resultString);

  // Check mouse up doesn't report any key combos, only mouse buttons.
  e = MockTerminalMouseEvent('mouseup', {shiftKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0m', resultString);

  e = MockTerminalMouseEvent('mouseup', {altKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0m', resultString);

  e = MockTerminalMouseEvent('mouseup', {metaKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0m', resultString);

  e = MockTerminalMouseEvent('mouseup', {ctrlKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0m', resultString);

  e = MockTerminalMouseEvent('mouseup', {shiftKey: true, metaKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<0;0;0m', resultString);

  // Check buttons & keys together.
  e = MockTerminalMouseEvent('mouseup', {button: 2, shiftKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<2;0;0m', resultString);
});

/**
 * Check mouse behavior when drags are enabled.
 */
it('mouse-report-drag', function() {
  const terminal = this.terminal;
  let e;

  let resultString;
  terminal.io.sendString = (str) => resultString = str;

  // Turn on clicks.
  terminal.interpret('\x1b[?1002h');

  // Send a mousedown event and check the report.
  e = MockTerminalMouseEvent('mousedown');
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M   ', resultString);

  // Mouse move events should be reported.
  e = MockTerminalMouseEvent('mousemove', {terminalRow: 1, buttons: 1});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M@ !', resultString);

  // Duplicate move events should not be reported.
  resultString = undefined;
  terminal.vt.onTerminalMouse_(e);
  assert.isUndefined(resultString);

  // Mouse up events should be reported.
  e = MockTerminalMouseEvent('mouseup');
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M#  ', resultString);
});

/**
 * Check mouse drag behavior with buttons.
 */
it('mouse-report-drag-buttons', function() {
  const terminal = this.terminal;
  let e;

  let resultString;
  terminal.io.sendString = (str) => resultString = str;

  // Turn on clicks.
  terminal.interpret('\x1b[?1002h');

  // Switch to SGR coordinates to make tests below easier.
  terminal.interpret('\x1b[?1006h');

  // Check mouse button priority.
  e = MockTerminalMouseEvent('mousemove', {buttons: 8});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<35;0;0M', resultString);

  e = MockTerminalMouseEvent('mousemove', {buttons: 2});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<34;0;0M', resultString);

  e = MockTerminalMouseEvent('mousemove', {buttons: 6});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<33;0;0M', resultString);

  e = MockTerminalMouseEvent('mousemove', {buttons: 7});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<32;0;0M', resultString);
});

/**
 * Check mouse drag behavior with keyboard modifiers.
 */
it('mouse-report-drag-keyboard', function() {
  const terminal = this.terminal;
  let e;

  let resultString;
  terminal.io.sendString = (str) => resultString = str;

  // Turn on clicks.
  terminal.interpret('\x1b[?1002h');

  // Switch to SGR coordinates to make tests below easier.
  terminal.interpret('\x1b[?1006h');

  // Check various key combos.
  e = MockTerminalMouseEvent('mousemove', {buttons: 1, shiftKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<36;0;0M', resultString);

  e = MockTerminalMouseEvent('mousemove', {buttons: 1, altKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<32;0;0M', resultString);

  e = MockTerminalMouseEvent('mousemove', {buttons: 1, metaKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<40;0;0M', resultString);

  e = MockTerminalMouseEvent('mousemove', {buttons: 1, ctrlKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<48;0;0M', resultString);

  e = MockTerminalMouseEvent(
      'mousemove', {buttons: 1, shiftKey: true, ctrlKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<52;0;0M', resultString);

  e = MockTerminalMouseEvent(
      'mousemove', {buttons: 1, shiftKey: true, ctrlKey: true, metaKey: true});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<60;0;0M', resultString);
});

/**
 * Check mouse wheel behavior when reports are enabled.
 */
it('mouse-report-wheel', function() {
  const terminal = this.terminal;
  let e;

  let resultString;
  terminal.io.sendString = (str) => resultString = str;

  // Turn on presses.
  terminal.interpret('\x1b[?9h');

  // Send a wheel down event and check the report.
  e = MockTerminalMouseEvent('wheel', {deltaY: 1});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[Ma  ', resultString);

  // Send a wheel up event and check the report.
  e = MockTerminalMouseEvent('wheel', {deltaY: -1});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[M`  ', resultString);
});

/**
 * Check mouse wheel behavior in X10 coordinates.
 */
it('mouse-wheel-x10-coord', function() {
  const terminal = this.terminal;
  let e;

  let resultString;
  terminal.io.sendString = (str) => resultString = str;

  // Turn on presses.  Default is X10 coordinates.
  terminal.interpret('\x1b[?9h');

  // Check 0,0 cell.
  e = MockTerminalMouseEvent('wheel');
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[Ma  ', resultString);

  // Check the 7-bit limit.
  e = MockTerminalMouseEvent('wheel', {terminalRow: 95, terminalColumn: 94});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[Ma\x7e\x7f', resultString);

/*
  These are disabled because we currently clamp X10 reporting to 7-bit.

  // Check 150,100 cell.
  e = MockTerminalMouseEvent('wheel', {terminalRow: 150, terminalColumn: 100});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[Ma\x84\xb6', resultString);

  // Check 222,222 cell (just below max range).
  e = MockTerminalMouseEvent('wheel', {terminalRow: 222, terminalColumn: 222});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[Ma\xfe\xfe', resultString);

  // Check 223,223 cell (max range).
  e = MockTerminalMouseEvent('wheel', {terminalRow: 223, terminalColumn: 223});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[Ma\xff\xff', resultString);

  // Check 300,300 cell (out of range).
  e = MockTerminalMouseEvent('wheel', {terminalRow: 300, terminalColumn: 300});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[Ma\xff\xff', resultString);
*/
});

/**
 * Check mouse wheel behavior in UTF8 coordinates.
 */
it('mouse-wheel-utf8-coord', function() {
  const terminal = this.terminal;
  let e;

  let resultString;
  terminal.io.sendString = (str) => resultString = str;

  // Turn on presses.
  terminal.interpret('\x1b[?9h');

  // Switch to UTF8 coordinates.
  terminal.interpret('\x1b[?1005h');

  // Check 0,0 cell.
  e = MockTerminalMouseEvent('wheel');
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[Ma  ', resultString);

  // Check 150,100 cell.
  e = MockTerminalMouseEvent('wheel', {terminalRow: 150, terminalColumn: 100});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[Ma\x84\xb6', resultString);

  // Check 2000,2000 cell.
  e = MockTerminalMouseEvent(
      'wheel', {terminalRow: 2000, terminalColumn: 2000});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[Ma\u07f0\u07f0', resultString);

  // Check 2014,2014 cell (just below max range).
  e = MockTerminalMouseEvent(
      'wheel', {terminalRow: 2014, terminalColumn: 2014});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[Ma\u07fe\u07fe', resultString);

  // Check 2015,2015 cell (max range).
  e = MockTerminalMouseEvent(
      'wheel', {terminalRow: 2015, terminalColumn: 2015});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[Ma\u07ff\u07ff', resultString);

  // Check 3000,3000 cell (out of range).
  e = MockTerminalMouseEvent(
      'wheel', {terminalRow: 3000, terminalColumn: 3000});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[Ma\u07ff\u07ff', resultString);
});

/**
 * Check mouse wheel behavior in SGR coordinates.
 */
it('mouse-wheel-sgr-coord', function() {
  const terminal = this.terminal;
  let e;

  let resultString;
  terminal.io.sendString = (str) => resultString = str;

  // Turn on presses.
  terminal.interpret('\x1b[?9h');

  // Switch to SGR coordinates.
  terminal.interpret('\x1b[?1006h');

  // Check 0,0 cell.
  e = MockTerminalMouseEvent('wheel');
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<65;0;0M', resultString);

  // Check 150,100 cell.
  e = MockTerminalMouseEvent('wheel', {terminalRow: 150, terminalColumn: 100});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<65;100;150M', resultString);

  // Check 2000,3000 cell.
  e = MockTerminalMouseEvent(
      'wheel', {terminalRow: 2000, terminalColumn: 3000});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<65;3000;2000M', resultString);

  // Check 99999,55555 cell.
  e = MockTerminalMouseEvent(
      'wheel', {terminalRow: 99999, terminalColumn: 55555});
  terminal.vt.onTerminalMouse_(e);
  assert.equal('\x1b[<65;55555;99999M', resultString);
});

/**
 * Verify CSI-J-0 (erase below) works.
 */
it('csi-j-0', function() {
  const terminal = this.terminal;

  // Fill the screen with something useful.
  for (let i = 0; i < this.visibleRowCount * 2; ++i) {
    terminal.interpret(`ab${i}\n\r`);
  }
  const rowCount = terminal.getRowCount();
  terminal.scrollEnd();
  terminal.scrollPort_.redraw_();

  // Move to the middle of the screen.
  terminal.setCursorPosition(3, 1);
  assert.equal('ab9', terminal.getRowText(9));
  assert.equal('ab10', terminal.getRowText(10));

  // Clear after & including the cursor (implicit arg=0).
  terminal.interpret('\x1b[J');
  assert.equal(3, terminal.getCursorRow());
  assert.equal(1, terminal.getCursorColumn());
  assert.equal('ab9', terminal.getRowText(9));
  assert.equal('a', terminal.getRowText(10));
  assert.equal('', terminal.getRowText(11));

  // Move up and clear after & including the cursor (explicit arg=0).
  terminal.setCursorPosition(2, 1);
  terminal.interpret('\x1b[0J');
  assert.equal(2, terminal.getCursorRow());
  assert.equal(1, terminal.getCursorColumn());
  assert.equal('ab8', terminal.getRowText(8));
  assert.equal('a', terminal.getRowText(9));
  assert.equal('', terminal.getRowText(10));

  // The scrollback should stay intact.
  assert.equal('ab0', terminal.getRowText(0));
  assert.equal(rowCount, terminal.getRowCount());
});

/**
 * Verify CSI-J-1 (erase above) works.
 */
it('csi-j-1', function() {
  const terminal = this.terminal;

  // Fill the screen with something useful.
  for (let i = 0; i < this.visibleRowCount * 2; ++i) {
    terminal.interpret(`ab${i}\n\r`);
  }
  const rowCount = terminal.getRowCount();
  terminal.scrollEnd();
  terminal.scrollPort_.redraw_();

  // Move to the middle of the screen.
  terminal.setCursorPosition(3, 1);
  assert.equal('ab9', terminal.getRowText(9));
  assert.equal('ab10', terminal.getRowText(10));

  // Clear before & including the cursor (arg=1).
  terminal.interpret('\x1b[1J');
  assert.equal(3, terminal.getCursorRow());
  assert.equal(1, terminal.getCursorColumn());
  assert.equal('', terminal.getRowText(9));
  assert.equal('  10', terminal.getRowText(10));
  assert.equal('ab11', terminal.getRowText(11));

  // The scrollback should stay intact.
  assert.equal('ab0', terminal.getRowText(0));
  assert.equal(rowCount, terminal.getRowCount());
});

/**
 * Verify CSI-J-2 (erase screen) works.
 */
it('csi-j-2', function() {
  const terminal = this.terminal;

  // Fill the screen with something useful.
  for (let i = 0; i < this.visibleRowCount * 2; ++i) {
    terminal.interpret(`ab${i}\n\r`);
  }
  const rowCount = terminal.getRowCount();
  terminal.scrollEnd();
  terminal.scrollPort_.redraw_();

  // Move to the middle of the screen.
  terminal.setCursorPosition(3, 1);
  assert.equal('ab9', terminal.getRowText(9));
  assert.equal('ab10', terminal.getRowText(10));

  // Clear the screen (arg=2).
  terminal.interpret('\x1b[2J');
  assert.equal(3, terminal.getCursorRow());
  assert.equal(1, terminal.getCursorColumn());
  assert.equal('', terminal.getRowText(9));
  assert.equal('', terminal.getRowText(10));
  assert.equal('', terminal.getRowText(11));

  // The scrollback should stay intact.
  assert.equal('ab0', terminal.getRowText(0));
  assert.equal(rowCount, terminal.getRowCount());
});

/**
 * Verify CSI-J-3 (erase scrollback) works.
 */
it('csi-j-3', function() {
  const terminal = this.terminal;

  // Fill the screen with something useful.
  for (let i = 0; i < this.visibleRowCount * 2; ++i) {
    terminal.interpret(`ab${i}\n\r`);
  }
  const rowCount = terminal.getRowCount();
  terminal.scrollEnd();
  terminal.scrollPort_.redraw_();

  // Move to the middle of the screen.
  terminal.setCursorPosition(3, 1);
  assert.equal('ab9', terminal.getRowText(9));
  assert.equal('ab10', terminal.getRowText(10));

  // Disable this feature.  It should make it a nop.
  terminal.vt.enableCsiJ3 = false;
  terminal.interpret('\x1b[3J');
  assert.equal(3, terminal.getCursorRow());
  assert.equal(1, terminal.getCursorColumn());
  assert.equal('ab0', terminal.getRowText(0));
  assert.equal(rowCount, terminal.getRowCount());

  // Re-enable the feature.
  terminal.vt.enableCsiJ3 = true;

  // Clear the scrollback (arg=3).
  // The current screen should stay intact.
  terminal.interpret('\x1b[3J');
  assert.equal(3, terminal.getCursorRow());
  assert.equal(1, terminal.getCursorColumn());
  assert.equal('ab7', terminal.getRowText(0));
  assert.equal('ab8', terminal.getRowText(1));
  assert.equal('ab11', terminal.getRowText(this.visibleRowCount - 2));

  // The scrollback should be gone.
  assert.equal(this.visibleRowCount, terminal.getRowCount());
  assert.deepStrictEqual([], terminal.scrollbackRows_);
});

/**
 * Verify CSI-N DECSTBM (set scrolling region) works.
 */
it('scroll-region', function() {
  const terminal = this.terminal;

  // Initially scroll region is the full screen.
  assert.isNull(terminal.vtScrollTop_);
  assert.isNull(terminal.vtScrollBottom_);

  // Set reduced scrolling region.
  this.terminal.interpret('\x1b[2;4r');
  assert.equal(terminal.vtScrollTop_, 1);
  assert.equal(terminal.vtScrollBottom_, 3);

  // Some edge cases.
  this.terminal.interpret('\x1b[0r');
  assert.isNull(terminal.vtScrollTop_);
  assert.isNull(terminal.vtScrollBottom_);
  this.terminal.interpret('\x1b[1r');
  assert.isNull(terminal.vtScrollTop_);
  assert.isNull(terminal.vtScrollBottom_);
  this.terminal.interpret('\x1b[1;5r');
  assert.equal(terminal.vtScrollTop_, 0);
  assert.equal(terminal.vtScrollBottom_, 4);
  this.terminal.interpret('\x1b[1;6r');
  assert.isNull(terminal.vtScrollTop_);
  assert.isNull(terminal.vtScrollBottom_);

  // Reset.
  this.terminal.interpret('\x1b[r');
  assert.isNull(this.terminal.vtScrollTop_);
  assert.isNull(this.terminal.vtScrollBottom_);

  // Valid ways to reset.
  ['', '0', ';6', '0;6'].forEach((args) => {
    terminal.interpret('\x1b[2;4r');
    terminal.interpret(`\x1b[${args}r`);
    assert.isNull(terminal.vtScrollTop_);
    assert.isNull(terminal.vtScrollBottom_);
  });

  // Ignore invalid args.
  ['-1;4', '2;7', '2;2'].forEach((args) => {
    terminal.interpret(`\x1b[${args}r`);
    assert.isNull(terminal.vtScrollTop_);
    assert.isNull(terminal.vtScrollBottom_);
  });
});

});
