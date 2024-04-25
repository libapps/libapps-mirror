// Copyright 2015 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Unit tests for hterm.TextAttributes.
 */

import {hterm} from '../index.js';

describe('hterm_text_attributes_tests.js', () => {

/**
 * Make sure isDefault works reasonably.
 */
it('isDefault', () => {
  const tattrs = new hterm.TextAttributes();

  // We should be in the default state initially.
  assert.isTrue(tattrs.isDefault());

  // Changing an attribute should take it out of the default state.
  tattrs.asciiNode = false;
  assert.isFalse(tattrs.isDefault());

  // But resetting it gets us back.
  tattrs.reset();
  assert.isTrue(tattrs.isDefault());
});

/**
 * Make sure createContainer works reasonably.
 */
it('createContainer', () => {
  const tattrs = new hterm.TextAttributes(globalThis.document);
  let node;

  // We don't check all the fields currently.  Not clear it's worth the effort.
  // Focus on fields that have had issues in the past.

  // This should create a default text node.
  node = tattrs.createContainer('asdf');
  assert.equal('asdf', node.textContent);
  assert.equal(Node.TEXT_NODE, node.nodeType);
  assert.isFalse(!!node.blinkNode);
  assert.isTrue(node.asciiNode);

  // Get a non-default node.
  tattrs.blink = true;
  node = tattrs.createContainer('asdf');
  assert.equal('asdf', node.textContent);
  assert.equal(Node.ELEMENT_NODE, node.nodeType);
  assert.isTrue(node.blinkNode);
  assert.isTrue(node.asciiNode);
});

/**
 * Make sure matchesContainer works correctly.
 */
it('matchesContainer', () => {
  const tattrs = new hterm.TextAttributes(globalThis.document);
  let node;

  // For plain string, this is just isDefault.
  assert.isTrue(tattrs.matchesContainer(''));

  // For basic text nodes (which this returns by default), we should match.
  node = tattrs.createContainer('asdf');
  assert.equal(Node.TEXT_NODE, node.nodeType);
  assert.isTrue(tattrs.matchesContainer(node));

  // Now create a node to play with.  Make sure it's not a default node.
  tattrs.underline = true;
  node = tattrs.createContainer('asdf');
  assert.equal(Node.ELEMENT_NODE, node.nodeType);
  assert.isTrue(tattrs.matchesContainer(node));
});

/**
 * Check combination of text decorations.
 */
it('decoration-combos', () => {
  const tattrs = new hterm.TextAttributes(globalThis.document);
  let node;

  // Underline.
  tattrs.underline = 'solid';
  tattrs.strikethrough = false;
  node = tattrs.createContainer('asdf');
  assert.equal('underline', node.style.textDecorationLine);
  assert.equal('solid', node.style.textDecorationStyle);

  // Double underline.
  tattrs.underline = 'double';
  tattrs.strikethrough = false;
  node = tattrs.createContainer('asdf');
  assert.equal('underline', node.style.textDecorationLine);
  assert.equal('double', node.style.textDecorationStyle);

  // Strikethrough.
  tattrs.underline = false;
  tattrs.strikethrough = true;
  node = tattrs.createContainer('asdf');
  assert.equal('line-through', node.style.textDecorationLine);
  assert.equal('', node.style.textDecorationStyle);

  // Underline + strikethrough.
  tattrs.underline = 'solid';
  tattrs.strikethrough = true;
  node = tattrs.createContainer('asdf');
  assert.equal('underline line-through', node.style.textDecorationLine);
  assert.equal('solid', node.style.textDecorationStyle);

  // Double underline + strikethrough.
  tattrs.underline = 'double';
  tattrs.strikethrough = true;
  node = tattrs.createContainer('asdf');
  assert.equal('underline line-through', node.style.textDecorationLine);
  assert.equal('double', node.style.textDecorationStyle);
});

/**
 * Underline colors.
 */
it('underline-colors', () => {
  const tattrs = new hterm.TextAttributes(globalThis.document);
  let node;

  tattrs.underline = 'solid';

  // Default color.
  node = tattrs.createContainer('asdf');
  assert.equal('underline', node.style.textDecorationLine);
  assert.equal('solid', node.style.textDecorationStyle);
  assert.equal('', node.style.textDecorationColor);

  // Indexed color.
  tattrs.underlineSource = 1;
  tattrs.syncColors();
  node = tattrs.createContainer('asdf');
  assert.equal('underline', node.style.textDecorationLine);
  assert.equal('solid', node.style.textDecorationStyle);
  assert.equal('rgb(var(--hterm-color-1))', node.style.textDecorationColor);

  // True color.
  tattrs.underlineSource = 'rgb(1, 2, 3)';
  tattrs.syncColors();
  node = tattrs.createContainer('asdf');
  assert.equal('underline', node.style.textDecorationLine);
  assert.equal('solid', node.style.textDecorationStyle);
  assert.equal('rgb(1, 2, 3)', node.style.textDecorationColor);
});

/**
 * Inverse color processing.
 */
it('inverse-colors', () => {
  const tattrs = new hterm.TextAttributes(globalThis.document);
  let node;

  // Set an attribute to force a container (rather than a text node),
  // but doesn't affect the color behavior in syncColors.
  tattrs.underline = true;
  globalThis.document.documentElement.style.setProperty(
      '--hterm-foreground-color', 'rgb(1, 2, 3)');
  globalThis.document.documentElement.style.setProperty(
      '--hterm-background-color', 'rgb(3, 2, 1)');

  // Test with default colors.
  tattrs.inverse = false;
  tattrs.syncColors();
  node = tattrs.createContainer('asdf');
  assert.equal('', node.style.color);
  assert.equal('', node.style.backgroundColor);

  tattrs.inverse = true;
  tattrs.syncColors();
  node = tattrs.createContainer('asdf');
  assert.strictEqual(tattrs.defaultBackground, node.style.color);
  assert.strictEqual(tattrs.defaultForeground, node.style.backgroundColor);

  // Test with indexed colors.
  tattrs.foregroundSource = 0;
  tattrs.backgroundSource = 1;
  tattrs.inverse = false;
  tattrs.syncColors();
  node = tattrs.createContainer('asdf');
  assert.equal('rgb(var(--hterm-color-0))', node.style.color);
  assert.equal('rgb(var(--hterm-color-1))', node.style.backgroundColor);

  tattrs.inverse = true;
  tattrs.syncColors();
  node = tattrs.createContainer('asdf');
  assert.equal('rgb(var(--hterm-color-1))', node.style.color);
  assert.equal('rgb(var(--hterm-color-0))', node.style.backgroundColor);

  // Test with true colors.
  tattrs.foregroundSource = 'rgb(1, 1, 1)';
  tattrs.backgroundSource = 'rgb(2, 2, 2)';
  tattrs.inverse = false;
  tattrs.syncColors();
  node = tattrs.createContainer('asdf');
  assert.equal(tattrs.foregroundSource, node.style.color);
  assert.equal(tattrs.backgroundSource, node.style.backgroundColor);

  tattrs.inverse = true;
  tattrs.syncColors();
  node = tattrs.createContainer('asdf');
  assert.equal(tattrs.backgroundSource, node.style.color);
  assert.equal(tattrs.foregroundSource, node.style.backgroundColor);
});

/**
 * Handling of invisible tags.
 */
it('invisible', () => {
  const tattrs = new hterm.TextAttributes(globalThis.document);

  // Set an attribute to force a container (rather than a text node),
  // but doesn't affect the color behavior in syncColors.
  tattrs.underline = true;
  globalThis.document.documentElement.style.setProperty(
      '--hterm-foreground-color', 'rgb(1, 2, 3)');
  globalThis.document.documentElement.style.setProperty(
      '--hterm-background-color', 'rgb(3, 2, 1)');

  // Set colors to something other than the default.
  tattrs.foregroundSource = 'rgb(1, 1, 1)';
  tattrs.backgroundSource = 'rgb(2, 2, 2)';

  // Invisible settings should have same colors.
  tattrs.invisible = true;
  tattrs.syncColors();
  const node = tattrs.createContainer('asdf');
  assert.equal(tattrs.backgroundSource, node.style.color);
  assert.equal(tattrs.backgroundSource, node.style.backgroundColor);
});

/**
 * Handling of URIs.
 */
describe('uris', () => {
  const tattrs = new hterm.TextAttributes(globalThis.document);

  [
    ['http://example.com', 'http://example.com\n(example.com)'],
    ['example.com', 'example.com'],
    ['mailto:u@example.com', 'mailto:u@example.com'],
    ['https://日本.com/foo', 'https://日本.com/foo\n(xn--wgv71a.com)'],
    ['http://\u202E@example.com/moc.elgoog\u202D',
     'http://‮@example.com/moc.elgoog‭\n(example.com)'],
  ].forEach(([uri, exp]) => {
    it(uri, () => {
      tattrs.uri = uri;
      const node = tattrs.createContainer('asdf');
      assert.equal(node.title, exp);
    });
  });
});

it('splitWidecharString-ascii', () => {
  const text = 'abcdefghijklmn';

  const actual = hterm.TextAttributes.splitWidecharString(text);
  assert.equal(actual.length, 1, "Normal text shouldn't be split.");
  assert.equal(actual[0].str, text,
               "The text doesn't have enough content.");
  assert.isTrue(!actual[0].wcNode, "The text shouldn't be wide.");
});

it('splitWidecharString-wide', () => {
  const text = 'abcd\u3041\u3042def\u3043ghi';

  const actual = hterm.TextAttributes.splitWidecharString(text);
  assert.equal(actual.length, 6, 'Failed to split wide chars.');
  assert.equal(actual[0].str, 'abcd',
               'Failed to obtain the first segment');
  assert.isTrue(!actual[0].wcNode, "First segment shouldn't be wide");
  assert.equal(actual[1].str, '\u3041',
               'Failed to obtain the second segment');
  assert.isTrue(actual[1].wcNode, 'Second segment should be wide');
  assert.equal(actual[2].str, '\u3042',
               'Failed to obtain the third segment');
  assert.isTrue(actual[2].wcNode, 'Third segment should be wide');
  assert.equal(actual[3].str, 'def',
               'Failed to obtain the forth segment');
  assert.isTrue(!actual[3].wcNode, "Forth segment shouldn't be wide");
  assert.equal(actual[4].str, '\u3043',
               'Failed to obtain the fifth segment');
  assert.isTrue(actual[4].wcNode, 'Fifth segment should be wide');
  assert.equal(actual[5].str, 'ghi',
               'Failed to obtain the sixth segment');
  assert.isTrue(!actual[5].wcNode, "Sixth segment shouldn't be wide");
});

it('splitWidecharString-surrogates', () => {
  const text = 'abc\uD834\uDD00\uD842\uDD9D';

  const actual = hterm.TextAttributes.splitWidecharString(text);
  assert.equal(actual.length, 2, 'Failed to split surrogate pairs.');
  assert.equal(actual[0].str, 'abc\uD834\uDD00',
               'Failed to obtain the first segment');
  assert.isTrue(!actual[0].wcNode, "First segment shouldn't be wide");
  assert.equal(actual[1].str, '\uD842\uDD9D',
               'The second segment should be a wide character built by ' +
               'a surrogate pair');
  assert.isTrue(actual[1].wcNode, 'The second segment should be wide');
});

it('splitWidecharString-ccs', () => {
  const text = 'xA\u030Ax';

  const actual = hterm.TextAttributes.splitWidecharString(text);
  assert.equal(actual.length, 1, 'Failed to split combining sequences.');
  assert.equal(actual[0].str, text);
});

});
