// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

describe('hterm_scrollport_tests.js', () => {

describe('scrollport', () => {

/**
 * A mock accessibility reader which will simply record the last string passed
 * to assertiveAnnounce.
 *
 * @constructor
 */
const MockAccessibilityReader = function() {
  this.accessibilityEnabled = false;
  this.lastStringAnnounced = '';
};

/**
 * Record the string passed to this function, which in a real implementation
 * would be announced by the screen reader.
 *
 * @param {string} str The string to announce.
 */
MockAccessibilityReader.prototype.assertiveAnnounce = function(str) {
  this.lastStringAnnounced = str;
};

/**
 * Set up some common state.
 */
before(function() {
  this.visibleColumnCount = 80;
  this.visibleRowCount = 25;
  this.totalRowCount = 10000;

  const document = window.document;

  this.rowProvider = new MockRowProvider(document, this.totalRowCount);

  // The scrollport will attach to this.
  const div = document.createElement('div');
  this.div = div;
  div.style.position = 'relative';
  div.style.height = '100%';
  div.style.width = '100%';
  document.body.appendChild(div);
});

/**
 * Remove the scrollport we added earlier.
 */
after(function() {
  document.body.removeChild(this.div);
});

/**
 * Ensure the selection is collapsed, row caching is on, and we've got a fresh
 * scrollport to test on.
 */
beforeEach(function(done) {
  const selection = window.getSelection();
  if (!selection.isCollapsed) {
    selection.collapseToStart();
  }

  this.rowProvider.setCacheEnabled(true);

  this.scrollPort = new hterm.ScrollPort(this.rowProvider);
  this.scrollPort.decorate(this.div, () => {
    this.div.style.height = (this.scrollPort.characterSize.height *
                             this.visibleRowCount + 1 + 'px');
    this.scrollPort.resize();
    done();
  });
});

/**
 * Delete the scrollport we created for the test.
 */
afterEach(function() {
  while (this.div.firstChild) {
    this.div.removeChild(this.div.firstChild);
  }
});

/**
 * Basic test to make sure that the viewport contains the right number of
 * rows at the right places after some scrolling.
 */
it('basic-scroll', function() {
    let topRow = this.scrollPort.getTopRowIndex();
    assert.equal(topRow, 0);
    assert.equal(this.scrollPort.getBottomRowIndex(topRow),
                 this.visibleRowCount - 1);

    this.scrollPort.scrollRowToBottom(this.totalRowCount);
    topRow = this.scrollPort.getTopRowIndex();
    assert.equal(topRow, this.totalRowCount - this.visibleRowCount);
    assert.equal(this.scrollPort.getBottomRowIndex(topRow),
                 this.totalRowCount - 1);
  });

/**
 * Make sure the hterm.ScrollPort is reusing the same row nodes when it can.
 */
it('node-recycler', function() {
    // Force a sync redraw before we get started so we know we're done
    // calling getRowNode.
    this.scrollPort.redraw_();

    this.rowProvider.resetCallCount('getRowNode');
    this.scrollPort.scrollRowToTop(1);

    // Sync redraw so we know getRowNode was called again.
    this.scrollPort.redraw_();

    const count = this.rowProvider.getCallCount('getRowNode');

    // Scrolling from 0 to 1 should result in only one call to getRowNode.
    assert.equal(count, 1);
  });

/**
 * Make sure the selection is maintained even after scrolling off screen.
 */
it('scroll-selection', function() {
    const doc = this.scrollPort.getDocument();

    const s = doc.getSelection();
    // IE does not supposed the extend method on selections.  They support
    // an approximation using addRange, but it automatically merges sibling
    // ranges and selects the parent node.  Ignore this test on IE for now.
    if (!s.extend) {
      return;
    }

    // Scroll into a part of the buffer that can be scrolled off the top
    // and the bottom of the screen.
    this.scrollPort.scrollRowToTop(50);

    // Force a synchronous redraw.  We'll need to DOM to be correct in order
    // to alter the selection.
    this.scrollPort.redraw_();

    // And select some text in the middle of the visible range.
    const anchorRow = this.rowProvider.getRowNode(55);
    let anchorNode = anchorRow;
    while (anchorNode.firstChild) {
      anchorNode = anchorNode.firstChild;
    }
    s.collapse(anchorNode, 0);

    const focusRow = this.rowProvider.getRowNode(
        55 + this.visibleRowCount - 10);
    let focusNode = focusRow;
    while (focusNode.lastChild) {
      focusNode = focusNode.lastChild;
    }
    s.extend(focusNode, focusNode.length || 0);

    for (let i = 0; i < this.visibleRowCount; i++) {
      this.scrollPort.scrollRowToTop(50 - i);
      this.scrollPort.redraw_();
      assert.strictEqual(anchorNode, s.anchorNode);
      assert.strictEqual(focusNode, s.focusNode);
    }

    for (let i = 0; i < this.visibleRowCount; i++) {
      this.scrollPort.scrollRowToTop(50 + i);
      this.scrollPort.redraw_();
      assert.strictEqual(anchorNode, s.anchorNode);
      assert.strictEqual(focusNode, s.focusNode);
    }
  });

/**
 * Make sure the selection is maintained for a collapsed selection.
 */
it('scroll-selection-collapsed', function() {
  const doc = this.scrollPort.getDocument();

  const s = doc.getSelection();

  // Scroll into a part of the buffer that can be scrolled off the top
  // and the bottom of the screen.
  this.scrollPort.scrollRowToTop(50);

  // Force a synchronous redraw.  We'll need to DOM to be correct in order
  // to alter the selection.
  this.scrollPort.redraw_();

  // Create a collapsed selection.
  s.removeAllRanges();
  const anchorRow = this.rowProvider.getRowNode(53);
  const anchorNode = anchorRow;
  const range = doc.createRange();
  range.selectNode(anchorNode.firstChild);
  range.collapse(true);
  s.addRange(range);

  assert.strictEqual(anchorNode, s.anchorNode);
  assert.strictEqual(anchorNode, s.focusNode);
  assert.isTrue(s.isCollapsed);

  // The selection should be preserved after scrolling.
  for (let i = 0; i < this.visibleRowCount; i++) {
    this.scrollPort.scrollRowToTop(50 - i);
    this.scrollPort.redraw_();
    assert.strictEqual(anchorNode, s.anchorNode);
    assert.strictEqual(anchorNode, s.focusNode);
  }

  for (let i = 0; i < this.visibleRowCount; i++) {
    this.scrollPort.scrollRowToTop(50 + i);
    this.scrollPort.redraw_();
    assert.strictEqual(anchorNode, s.anchorNode);
    assert.strictEqual(anchorNode, s.focusNode);
  }
});

/**
 * Set focus to top or bottom row when focus moves off rows.
 */
it('scroll-selection-moves-off-rows', function() {
  const doc = this.scrollPort.getDocument();

  const s = doc.getSelection();

  // Start with row 3 at top.
  this.scrollPort.scrollRowToTop(3);
  this.scrollPort.redraw_();

  // Select row 7, startRow and endRow should be 7.
  const row7 = this.rowProvider.getRowNode(7);
  s.collapse(row7.lastChild, 0);
  s.extend(row7.firstChild, 0);
  this.scrollPort.selection.sync();
  assert.equal(7, this.scrollPort.selection.startRow.rowIndex);
  assert.equal(7, this.scrollPort.selection.endRow.rowIndex);

  // Extend focus to row 5, startRow should be 5.
  const row5 = this.rowProvider.getRowNode(5);
  s.extend(row5.firstChild, 0);
  this.scrollPort.selection.sync();
  assert.equal(5, this.scrollPort.selection.startRow.rowIndex);
  assert.equal(7, this.scrollPort.selection.endRow.rowIndex);

  // Extend focus off rows to top fold, startRow should be 3.
  const topFold = doc.getElementById('hterm:top-fold-for-row-selection');
  s.extend(topFold, 0);
  this.scrollPort.selection.sync();
  assert.equal(3, this.scrollPort.selection.startRow.rowIndex);
  assert.equal(7, this.scrollPort.selection.endRow.rowIndex);

  // Extend focus off rows to bottom fold, startRow should be 3.
  const bottomFold = doc.getElementById('hterm:bottom-fold-for-row-selection');
  s.extend(bottomFold, 0);
  this.scrollPort.selection.sync();
  assert.equal(7, this.scrollPort.selection.startRow.rowIndex);
  const bottomRow = 3 + this.visibleRowCount - 1;
  assert.equal(bottomRow, this.scrollPort.selection.endRow.rowIndex);
});

/**
 * Keep focus row in fold if this is not auto scroll, else change focus to
 * adjacent row.
 */
it('scroll-selection-focus-row-in-fold', function() {
  const doc = this.scrollPort.getDocument();

  const s = doc.getSelection();

  // Select rows 2 and 3 then scroll them into top fold.
  this.scrollPort.redraw_();
  const row2 = this.rowProvider.getRowNode(2);
  const row3 = this.rowProvider.getRowNode(3);
  s.collapse(row3.lastChild, 0);
  s.extend(row2.firstChild, 0);
  this.scrollPort.selection.sync();
  assert.equal(2, this.scrollPort.selection.startRow.rowIndex);
  assert.equal(3, this.scrollPort.selection.endRow.rowIndex);
  this.scrollPort.scrollRowToTop(5);
  this.scrollPort.redraw_();

  // If auto scroll is not enabled, focus should not change.
  this.scrollPort.autoScrollEnabled_ = false;
  this.scrollPort.selection.sync();
  assert.equal(2, this.scrollPort.selection.startRow.rowIndex);
  assert.equal(3, this.scrollPort.selection.endRow.rowIndex);

  // If auto scroll is enabled, focus should change to top row.
  this.scrollPort.autoScrollEnabled_ = true;
  this.scrollPort.selection.sync();
  assert.equal(3, this.scrollPort.selection.startRow.rowIndex);
  assert.equal(5, this.scrollPort.selection.endRow.rowIndex);
});

/**
 * Test redraw_() handles selection rows and folds.
 */
it('redraw-with-selection', function() {
  const doc = this.scrollPort.getDocument();
  const s = doc.getSelection();

  // Select 4 rows 2 pages in.
  const start = this.visibleRowCount * 2;
  const startRow = this.rowProvider.getRowNode(start);
  const end = start + 4;
  const endRow = this.rowProvider.getRowNode(end);
  this.scrollPort.scrollRowToTop(start);
  this.scrollPort.redraw_();
  s.collapse(startRow.firstChild, 0);
  s.extend(endRow.firstChild, 0);
  this.scrollPort.redraw_();
  assert.isNull(this.scrollPort.topFold_.previousSibling);
  assert.isNull(this.scrollPort.bottomFold_.nextSibling);

  // Start and end in bottom fold.
  this.scrollPort.scrollRowToTop(0);
  this.scrollPort.redraw_();
  assert.isNull(this.scrollPort.topFold_.previousSibling);
  assert.equal(startRow, this.scrollPort.bottomFold_.nextSibling);
  assert.equal(endRow, startRow.nextSibling);
  assert.isNull(endRow.nextSibling);

  // Start on screen, end in bottom fold.
  this.scrollPort.scrollRowToTop(start - this.visibleRowCount + 2);
  this.scrollPort.redraw_();
  assert.isNull(this.scrollPort.topFold_.previousSibling);
  assert.equal(endRow, this.scrollPort.bottomFold_.nextSibling);
  assert.isNull(endRow.nextSibling);

  // Start and end in screen.
  this.scrollPort.scrollRowToTop(start);
  this.scrollPort.redraw_();
  assert.isNull(this.scrollPort.topFold_.previousSibling);
  assert.isNull(this.scrollPort.bottomFold_.nextSibling);

  // Start in top fold, end on screen.
  this.scrollPort.scrollRowToTop(end);
  this.scrollPort.redraw_();
  assert.equal(startRow, this.scrollPort.topFold_.previousSibling);
  assert.isNull(startRow.previousSibling);
  assert.isNull(this.scrollPort.bottomFold_.nextSibling);

  // Start and end in top fold.
  this.scrollPort.scrollRowToTop(end + this.visibleRowCount);
  this.scrollPort.redraw_();
  assert.equal(endRow, this.scrollPort.topFold_.previousSibling);
  assert.equal(startRow, endRow.previousSibling);
  assert.isNull(this.scrollPort.bottomFold_.nextSibling);

  // Start in top fold, end in bottom fold.
  const endFar = start + this.visibleRowCount + 4;
  const endFarRow = this.rowProvider.getRowNode(endFar);
  this.scrollPort.scrollRowToTop(start + this.visibleRowCount);
  this.scrollPort.redraw_();
  s.extend(endFarRow.firstChild, 0);
  this.scrollPort.selection.sync();
  this.scrollPort.scrollRowToTop(start + 2);
  this.scrollPort.redraw_();
  assert.equal(startRow, this.scrollPort.topFold_.previousSibling);
  assert.isNull(startRow.previousSibling);
  assert.equal(endFarRow, this.scrollPort.bottomFold_.nextSibling);
  assert.isNull(endFarRow.nextSibling);
});

/**
 * Test auto scroll starts and stops correctly with correct direction.
 */
it('auto-scroll-start-stop', function() {
  const padding = this.scrollPort.screenPaddingSize;
  const rowsHeight = this.scrollPort.visibleRowsHeight;
  const mouseAboveRows = {pageY: -1};
  const mouseInRows = {pageY: padding + 1};
  const mouseBelowRows = {pageY: padding + rowsHeight + 1};
  this.scrollPort.selection.autoScrollEnabled_ = true;

  assert.isNull(this.scrollPort.selection.autoScrollInterval_);

  // Moving mouse below rows should start scroll.
  this.scrollPort.selection.autoScrollOnMouseMove_(mouseBelowRows);
  assert.isNotNull(this.scrollPort.selection.autoScrollInterval_);
  assert.equal(1, this.scrollPort.selection.autoScrollDirection_);

  // Moving mouse above rows should make direction up.
  this.scrollPort.selection.autoScrollOnMouseMove_(mouseAboveRows);
  assert.isNotNull(this.scrollPort.selection.autoScrollInterval_);
  assert.equal(-1, this.scrollPort.selection.autoScrollDirection_);

  // Moving mouse back into rows should stop scroll.
  this.scrollPort.selection.autoScrollOnMouseMove_(mouseInRows);
  assert.isNull(this.scrollPort.selection.autoScrollInterval_);

  // Auto scroll does not start if it is not enabled.
  this.scrollPort.selection.autoScrollEnabled_ = false;
  this.scrollPort.selection.autoScrollOnMouseMove_(mouseBelowRows);
  assert.isNull(this.scrollPort.selection.autoScrollInterval_);
});

/**
 * Test the auto scroll delta acceleration.
 */
it('auto-scroll-delta', function() {
  const doc = this.scrollPort.getDocument();
  const s = doc.getSelection();
  this.scrollPort.redraw_();

  // Select from row 10 to row 12.
  const row10 = this.rowProvider.getRowNode(10);
  const row12 = this.rowProvider.getRowNode(12);
  s.collapse(row10.firstChild, 0);
  s.extend(row12.firstChild, 0);
  this.scrollPort.selection.sync();

  // Delta should increase each time it is called.
  assert.equal(1, this.scrollPort.selection.autoScrollDelta_);
  assert.equal(0, this.scrollPort.getTopRowIndex());
  this.scrollPort.selection.autoScroll_();
  assert.equal(1.2, this.scrollPort.selection.autoScrollDelta_);
  assert.equal(1, this.scrollPort.getTopRowIndex());
  this.scrollPort.selection.autoScrollDelta_ = 10;
  this.scrollPort.selection.autoScroll_();
  assert.equal(12, this.scrollPort.selection.autoScrollDelta_);
  assert.equal(13, this.scrollPort.getTopRowIndex());

  // Delta should be reset on stop.
  this.scrollPort.selection.stopAutoScroll_();
  assert.equal(1, this.scrollPort.selection.autoScrollDelta_);

  // Scroll should move up if direction is up.
  this.scrollPort.selection.autoScrollDirection_ = -1;
  this.scrollPort.selection.autoScroll_();
  assert.equal(1.2, this.scrollPort.selection.autoScrollDelta_);
  assert.equal(12, this.scrollPort.getTopRowIndex());
});

/**
 * Test the select-all function.
 */
it('select-all', function() {
  // Scroll at top.
  this.scrollPort.scrollRowToTop(0);
  this.scrollPort.redraw_();
  this.scrollPort.selectAll();
  assert.equal(0, this.scrollPort.selection.startRow.rowIndex);
  assert.equal(this.totalRowCount - 1,
               this.scrollPort.selection.endRow.rowIndex);

  // Scroll in middle.
  this.scrollPort.scrollRowToTop(50);
  this.scrollPort.redraw_();
  this.scrollPort.selectAll();
  assert.equal(0, this.scrollPort.selection.startRow.rowIndex);
  assert.equal(this.totalRowCount - 1,
               this.scrollPort.selection.endRow.rowIndex);

  // Scroll at bottom.
  this.scrollPort.scrollRowToBottom(this.totalRowCount);
  this.scrollPort.redraw_();
  this.scrollPort.selectAll();
  assert.equal(0, this.scrollPort.selection.startRow.rowIndex);
  assert.equal(this.totalRowCount - 1,
               this.scrollPort.selection.endRow.rowIndex);
});

/**
 * Test that the page up/down buttons are onscreen when selected but offscreen
 * otherwise.
 */
it('page-up-down-options-visible', function() {
  const doc = this.scrollPort.getDocument();

  this.scrollPort.allowA11yButtonsToDisplay_ = true;
  const mockAccessibilityReader = new MockAccessibilityReader();
  mockAccessibilityReader.accessibilityEnabled = true;
  this.scrollPort.setAccessibilityReader(mockAccessibilityReader);

  const selection = doc.getSelection();

  const pageUp = doc.getElementById('hterm:a11y:page-up');
  assert.isAtMost(pageUp.getBoundingClientRect().bottom, 0);

  selection.removeAllRanges();
  let range = document.createRange();
  range.selectNodeContents(pageUp.firstChild);
  selection.addRange(range);
  doc.dispatchEvent(new Event('selectionchange'));

  assert.isAtLeast(pageUp.getBoundingClientRect().top, 0);

  const pageDown = doc.getElementById('hterm:a11y:page-down');
  assert.isAtLeast(pageDown.getBoundingClientRect().top,
                   this.scrollPort.getScreenHeight());

  selection.removeAllRanges();
  range = document.createRange();
  range.selectNodeContents(pageDown.firstChild);
  selection.addRange(range);
  doc.dispatchEvent(new Event('selectionchange'));

  assert.isAtMost(pageDown.getBoundingClientRect().bottom,
                  this.scrollPort.getScreenHeight());

  const options = doc.getElementById('hterm:a11y:options');
  assert.isAtLeast(options.getBoundingClientRect().top,
                   this.scrollPort.getScreenHeight());

  selection.removeAllRanges();
  range = document.createRange();
  range.selectNodeContents(options.firstChild);
  selection.addRange(range);
  doc.dispatchEvent(new Event('selectionchange'));

  assert.isAtMost(options.getBoundingClientRect().bottom,
                  this.scrollPort.getScreenHeight());
});

/**
 * Test that the page up/down buttons aren't moved onscreen when accessibility
 * isn't enabled.
 *
 */
it('page-up-down-options-hidden', function() {
  const doc = this.scrollPort.getDocument();

  this.scrollPort.allowA11yButtonsToDisplay_ = true;
  const mockAccessibilityReader = new MockAccessibilityReader();
  mockAccessibilityReader.accessibilityEnabled = false;
  this.scrollPort.setAccessibilityReader(mockAccessibilityReader);

  const selection = doc.getSelection();

  const pageUp = doc.getElementById('hterm:a11y:page-up');
  assert.isAtMost(pageUp.getBoundingClientRect().bottom, 0);

  selection.removeAllRanges();
  let range = document.createRange();
  range.selectNodeContents(pageUp.firstChild);
  selection.addRange(range);
  doc.dispatchEvent(new Event('selectionchange'));

  assert.isAtMost(pageUp.getBoundingClientRect().bottom, 0);

  const pageDown = doc.getElementById('hterm:a11y:page-down');
  assert.isAtLeast(pageDown.getBoundingClientRect().top,
                   this.scrollPort.getScreenHeight());

  selection.removeAllRanges();
  range = document.createRange();
  range.selectNodeContents(pageDown.firstChild);
  selection.addRange(range);
  doc.dispatchEvent(new Event('selectionchange'));

  assert.isAtLeast(pageDown.getBoundingClientRect().top,
                   this.scrollPort.getScreenHeight());

  const options = doc.getElementById('hterm:a11y:options');
  assert.isAtLeast(options.getBoundingClientRect().top,
                   this.scrollPort.getScreenHeight());

  selection.removeAllRanges();
  range = document.createRange();
  range.selectNodeContents(options.firstChild);
  selection.addRange(range);
  doc.dispatchEvent(new Event('selectionchange'));

  assert.isAtLeast(options.getBoundingClientRect().top,
                   this.scrollPort.getScreenHeight());
});

/**
 * Test that clicking page up/down causes the viewport to scroll up/down.
 */
it('page-up-down-scroll', function() {
  const doc = this.scrollPort.getDocument();

  const topRow = 50;
  this.scrollPort.scrollRowToTop(topRow);
  assert.equal(this.scrollPort.getTopRowIndex(), topRow);

  const pageDown = doc.getElementById('hterm:a11y:page-down');
  pageDown.dispatchEvent(new Event('click'));
  assert.equal(this.scrollPort.getTopRowIndex(), topRow + 24);

  const pageUp = doc.getElementById('hterm:a11y:page-up');
  pageUp.dispatchEvent(new Event('click'));
  assert.equal(this.scrollPort.getTopRowIndex(), topRow);
});

/**
 * Test that the page up/down buttons are enabled/disabled correctly at the top
 * and bottom of the scrollport.
 */
it('page-up-down-state', function() {
  const doc = this.scrollPort.getDocument();
  const pageUp = doc.getElementById('hterm:a11y:page-up');
  const pageDown = doc.getElementById('hterm:a11y:page-down');

  this.scrollPort.scrollRowToTop(0);
  this.scrollPort.redraw_();
  assert.equal(pageUp.getAttribute('aria-disabled'), 'true');
  assert.equal(pageDown.getAttribute('aria-disabled'), 'false');

  this.scrollPort.scrollRowToTop(50);
  this.scrollPort.redraw_();
  assert.equal(pageUp.getAttribute('aria-disabled'), 'false');
  assert.equal(pageDown.getAttribute('aria-disabled'), 'false');

  this.scrollPort.scrollRowToTop(10000);
  this.scrollPort.redraw_();
  assert.equal(pageUp.getAttribute('aria-disabled'), 'false');
  assert.equal(pageDown.getAttribute('aria-disabled'), 'true');
});

/**
 * Test that paging up/down causes the screen contents to be announced
 * correctly.
 */
it('page-up-down-announce', function() {
  const doc = this.scrollPort.getDocument();

  this.scrollPort.scrollRowToTop(0);
  const mockAccessibilityReader = new MockAccessibilityReader();
  this.scrollPort.setAccessibilityReader(mockAccessibilityReader);

  const pageDown = doc.getElementById('hterm:a11y:page-down');
  pageDown.dispatchEvent(new Event('click'));
  assert.equal(
      mockAccessibilityReader.lastStringAnnounced,
      '0% scrolled,\n' +
      'This is line 24 red green yellow blue magenta cyan\n' +
      'This is line 25 red green yellow blue magenta cyan\n' +
      'This is line 26 red green yellow blue magenta cyan\n' +
      'This is line 27 red green yellow blue magenta cyan\n' +
      'This is line 28 red green yellow blue magenta cyan\n' +
      'This is line 29 red green yellow blue magenta cyan\n' +
      'This is line 30 red green yellow blue magenta cyan\n' +
      'This is line 31 red green yellow blue magenta cyan\n' +
      'This is line 32 red green yellow blue magenta cyan\n' +
      'This is line 33 red green yellow blue magenta cyan\n' +
      'This is line 34 red green yellow blue magenta cyan\n' +
      'This is line 35 red green yellow blue magenta cyan\n' +
      'This is line 36 red green yellow blue magenta cyan\n' +
      'This is line 37 red green yellow blue magenta cyan\n' +
      'This is line 38 red green yellow blue magenta cyan\n' +
      'This is line 39 red green yellow blue magenta cyan\n' +
      'This is line 40 red green yellow blue magenta cyan\n' +
      'This is line 41 red green yellow blue magenta cyan\n' +
      'This is line 42 red green yellow blue magenta cyan\n' +
      'This is line 43 red green yellow blue magenta cyan\n' +
      'This is line 44 red green yellow blue magenta cyan\n' +
      'This is line 45 red green yellow blue magenta cyan\n' +
      'This is line 46 red green yellow blue magenta cyan\n' +
      'This is line 47 red green yellow blue magenta cyan\n' +
      'This is line 48 red green yellow blue magenta cyan\n');

  const pageUp = doc.getElementById('hterm:a11y:page-up');
  pageUp.dispatchEvent(new Event('click'));
  const linesOneToTwentyFive = '0% scrolled,\n' +
      'This is line 0 red green yellow blue magenta cyan\n' +
      'This is line 1 red green yellow blue magenta cyan\n' +
      'This is line 2 red green yellow blue magenta cyan\n' +
      'This is line 3 red green yellow blue magenta cyan\n' +
      'This is line 4 red green yellow blue magenta cyan\n' +
      'This is line 5 red green yellow blue magenta cyan\n' +
      'This is line 6 red green yellow blue magenta cyan\n' +
      'This is line 7 red green yellow blue magenta cyan\n' +
      'This is line 8 red green yellow blue magenta cyan\n' +
      'This is line 9 red green yellow blue magenta cyan\n' +
      'This is line 10 red green yellow blue magenta cyan\n' +
      'This is line 11 red green yellow blue magenta cyan\n' +
      'This is line 12 red green yellow blue magenta cyan\n' +
      'This is line 13 red green yellow blue magenta cyan\n' +
      'This is line 14 red green yellow blue magenta cyan\n' +
      'This is line 15 red green yellow blue magenta cyan\n' +
      'This is line 16 red green yellow blue magenta cyan\n' +
      'This is line 17 red green yellow blue magenta cyan\n' +
      'This is line 18 red green yellow blue magenta cyan\n' +
      'This is line 19 red green yellow blue magenta cyan\n' +
      'This is line 20 red green yellow blue magenta cyan\n' +
      'This is line 21 red green yellow blue magenta cyan\n' +
      'This is line 22 red green yellow blue magenta cyan\n' +
      'This is line 23 red green yellow blue magenta cyan\n' +
      'This is line 24 red green yellow blue magenta cyan\n';
  assert.equal(mockAccessibilityReader.lastStringAnnounced,
               linesOneToTwentyFive);

  // Test that other forms of scrolling won't cause announcements.
  this.scrollPort.scrollRowToTop(2000);
  assert.equal(mockAccessibilityReader.lastStringAnnounced,
               linesOneToTwentyFive);

  // Ensure the percentage is computed correctly.
  pageDown.dispatchEvent(new Event('click'));
  assert.equal(
      mockAccessibilityReader.lastStringAnnounced,
      '20% scrolled,\n' +
      'This is line 2024 red green yellow blue magenta cyan\n' +
      'This is line 2025 red green yellow blue magenta cyan\n' +
      'This is line 2026 red green yellow blue magenta cyan\n' +
      'This is line 2027 red green yellow blue magenta cyan\n' +
      'This is line 2028 red green yellow blue magenta cyan\n' +
      'This is line 2029 red green yellow blue magenta cyan\n' +
      'This is line 2030 red green yellow blue magenta cyan\n' +
      'This is line 2031 red green yellow blue magenta cyan\n' +
      'This is line 2032 red green yellow blue magenta cyan\n' +
      'This is line 2033 red green yellow blue magenta cyan\n' +
      'This is line 2034 red green yellow blue magenta cyan\n' +
      'This is line 2035 red green yellow blue magenta cyan\n' +
      'This is line 2036 red green yellow blue magenta cyan\n' +
      'This is line 2037 red green yellow blue magenta cyan\n' +
      'This is line 2038 red green yellow blue magenta cyan\n' +
      'This is line 2039 red green yellow blue magenta cyan\n' +
      'This is line 2040 red green yellow blue magenta cyan\n' +
      'This is line 2041 red green yellow blue magenta cyan\n' +
      'This is line 2042 red green yellow blue magenta cyan\n' +
      'This is line 2043 red green yellow blue magenta cyan\n' +
      'This is line 2044 red green yellow blue magenta cyan\n' +
      'This is line 2045 red green yellow blue magenta cyan\n' +
      'This is line 2046 red green yellow blue magenta cyan\n' +
      'This is line 2047 red green yellow blue magenta cyan\n' +
      'This is line 2048 red green yellow blue magenta cyan\n');
});

/**
 * Test that paging up/down when at the top/bottom of the screen doesn't trigger
 * any announcement.
 */
it('page-up-down-dont-announce', function() {
  const doc = this.scrollPort.getDocument();

  this.scrollPort.scrollRowToTop(0);
  const mockAccessibilityReader = new MockAccessibilityReader();
  this.scrollPort.setAccessibilityReader(mockAccessibilityReader);

  const pageUp = doc.getElementById('hterm:a11y:page-up');
  pageUp.dispatchEvent(new Event('click'));
  assert.equal(mockAccessibilityReader.lastStringAnnounced, '');

  this.scrollPort.scrollRowToTop(10000);
  const pageDown = doc.getElementById('hterm:a11y:page-down');
  pageDown.dispatchEvent(new Event('click'));
  assert.equal(mockAccessibilityReader.lastStringAnnounced, '');
});

/**
 * Make sure that offscreen elements are marked aria-hidden.
 */
it('scroll-selection-hidden', function() {
  const doc = this.scrollPort.getDocument();

  const s = doc.getSelection();
  // IE does not supposed the extend method on selections.  They support
  // an approximation using addRange, but it automatically merges sibling
  // ranges and selects the parent node.  Ignore this test on IE for now.
  if (!s.extend) {
    return;
  }

  // Scroll into a part of the buffer that can be scrolled off the top
  // and the bottom of the screen.
  this.scrollPort.scrollRowToTop(1000);

  // Force a synchronous redraw.  We'll need to DOM to be correct in order
  // to alter the selection.
  this.scrollPort.redraw_();

  // And select some text in the middle of the visible range.
  const anchorRow = this.rowProvider.getRowNode(1003);
  let anchorNode = anchorRow;
  while (anchorNode.firstChild) {
    anchorNode = anchorNode.firstChild;
  }
  s.collapse(anchorNode, 0);

  const focusRow = this.rowProvider.getRowNode(1004);
  let focusNode = focusRow;
  while (focusNode.lastChild) {
    focusNode = focusNode.lastChild;
  }
  s.extend(focusNode, focusNode.length || 0);

  assert.isNull(anchorRow.getAttribute('aria-hidden'));
  assert.isNull(focusRow.getAttribute('aria-hidden'));

  this.scrollPort.scrollRowToTop(0);
  this.scrollPort.redraw_();

  assert.equal(anchorRow.getAttribute('aria-hidden'), 'true');
  assert.equal(focusRow.getAttribute('aria-hidden'), 'true');

  this.scrollPort.scrollRowToTop(1000);
  this.scrollPort.redraw_();

  assert.isNull(anchorRow.getAttribute('aria-hidden'));
  assert.isNull(focusRow.getAttribute('aria-hidden'));

  this.scrollPort.scrollRowToTop(2000);
  this.scrollPort.redraw_();

  assert.equal(anchorRow.getAttribute('aria-hidden'), 'true');
  assert.equal(focusRow.getAttribute('aria-hidden'), 'true');
});

/**
 * Remove the scrollPort that was set up and leave the user with a full-page
 * scroll port.
 *
 * This should always be the last test of the suite, since it leaves the user
 * with a full page scrollPort to poke at.
 */
it('fullscreen', function() {
    const document = window.document;

    const rowProvider = new MockRowProvider(document, this.totalRowCount);

    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.height = '100%';
    div.style.width = '100%';
    document.body.appendChild(div);

    const scrollPort = new hterm.ScrollPort(rowProvider);
    scrollPort.decorate(div);

    const divSize = div.getBoundingClientRect();

    assert.isAbove(divSize.height, 0);
    assert.isAbove(divSize.width, 0);
    assert.equal(divSize.height,
                 scrollPort.iframe_.getBoundingClientRect().height);

    document.body.removeChild(div);
  });

});

describe('DragAndDrop', () => {

/**
 * We can't generate useful DragEvents as the dataTransfer member is forced
 * read-only, so create a fake object and call the drag handler directly.
 * This is a bit ugly, but the web makes us do it.
 *
 * @param {boolean=} shift The shift key is pressed.
 * @constructor
 */
const MockDragEvent = function(shift) {
  this.dataTransfer = new DataTransfer();
  this.shiftKey = !!shift;
  this.preventDefault = () => {};
};

beforeEach(function() {
  // Create a new port since so the subscribe event doesn't stick to
  // this.scrollPort across multiple tests.
  this.scrollPort = new hterm.ScrollPort(
      new MockRowProvider(window.document, 0));
});

/**
 * A single text/plain element.
 */
it('drag-drop-text', function(done) {
  const e = new MockDragEvent();
  e.dataTransfer.setData('text/plain', 'plain');

  this.scrollPort.subscribe('paste', (e) => {
    assert.equal('plain', e.text);
    done();
  });
  this.scrollPort.onDragAndDrop_(e);
});

/**
 * Pick between text & html based on shift key not pressed.
 */
it('drag-drop-text-no-shift', function(done) {
  const e = new MockDragEvent();
  e.dataTransfer.setData('text/html', 'html');
  e.dataTransfer.setData('text/plain', 'plain');

  this.scrollPort.subscribe('paste', (e) => {
    assert.equal('plain', e.text);
    done();
  });
  this.scrollPort.onDragAndDrop_(e);
});

/**
 * Pick between text & html based on shift key pressed.
 */
it('drag-drop-text-shift', function(done) {
  const e = new MockDragEvent(true /* shift */);
  e.dataTransfer.setData('text/html', 'html');
  e.dataTransfer.setData('text/plain', 'plain');

  this.scrollPort.subscribe('paste', (e) => {
    assert.equal('html', e.text);
    done();
  });
  this.scrollPort.onDragAndDrop_(e);
});

/**
 * Verify fallback when first source is empty & shift key is not pressed.
 */
it('drag-drop-text-fallback-no-shift', function(done) {
  const e = new MockDragEvent();
  e.dataTransfer.setData('text/html', '');
  e.dataTransfer.setData('text/plain', 'plain');

  this.scrollPort.subscribe('paste', (e) => {
    assert.equal('plain', e.text);
    done();
  });
  this.scrollPort.onDragAndDrop_(e);
});

/**
 * Verify fallback when first source is empty & shift key is pressed.
 */
it('drag-drop-text-fallback-shift', function(done) {
  const e = new MockDragEvent(true /* shift */);
  e.dataTransfer.setData('text/html', '');
  e.dataTransfer.setData('text/plain', 'plain');

  this.scrollPort.subscribe('paste', (e) => {
    assert.equal('plain', e.text);
    done();
  });
  this.scrollPort.onDragAndDrop_(e);
});

/**
 * Verify paste doesn't happen if it's disabled.
 */
it('drag-drop-disabled', function() {
  const e = new MockDragEvent();
  this.scrollPort.subscribe('paste', assert.fail);

  this.scrollPort.setPasteOnDrop(false);

  e.dataTransfer.setData('text/plain', 'plain');
  this.scrollPort.onDragAndDrop_(e);
});

/**
 * Verify bad sources don't trigger paste events.
 */
it('drag-drop-unusable', function() {
  const e = new MockDragEvent();
  this.scrollPort.subscribe('paste', assert.fail);

  // Binary only data shouldn't trigger an event.
  e.dataTransfer.setData('application/x-executable', 'plain');
  this.scrollPort.onDragAndDrop_(e);

  // Neither should empty text.
  e.dataTransfer.setData('text/plain', '');
  this.scrollPort.onDragAndDrop_(e);
});

});

});
