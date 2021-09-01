// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview This class represents a single terminal screen full of text.
 *
 * It maintains the current cursor position and has basic methods for text
 * insert and overwrite, and adding or removing rows from the screen.
 *
 * This class has no knowledge of the scrollback buffer.
 *
 * The number of rows on the screen is determined only by the number of rows
 * that the caller inserts into the screen.  If a caller wants to ensure a
 * constant number of rows on the screen, it's their responsibility to remove a
 * row for each row inserted.
 *
 * The screen width, in contrast, is enforced locally.
 *
 *
 * In practice...
 * - The hterm.Terminal class holds two hterm.Screen instances.  One for the
 * primary screen and one for the alternate screen.
 *
 * - The html.Screen class only cares that rows are HTML Elements.  In the
 * larger context of hterm, however, the rows happen to be displayed by an
 * hterm.ScrollPort and have to follow a few rules as a result.  Each
 * row must be rooted by the custom HTML tag 'x-row', and each must have a
 * rowIndex property that corresponds to the index of the row in the context
 * of the scrollback buffer.  These invariants are enforced by hterm.Terminal
 * because that is the class using the hterm.Screen in the context of an
 * hterm.ScrollPort.
 */

/**
 * Create a new screen instance.
 *
 * The screen initially has no rows and a maximum column count of 0.
 *
 * @param {number=} columnCount The maximum number of columns for this
 *    screen.  See insertString() and overwriteString() for information about
 *    what happens when too many characters are added too a row.  Defaults to
 *    0 if not provided.
 * @constructor
 */
hterm.Screen = function(columnCount = 0) {
  /**
   * Public, read-only access to the rows in this screen.
   *
   * @type {!Array<!Element>}
   */
  this.rowsArray = [];

  // The max column width for this screen.
  this.columnCount_ = columnCount;

  // The current color, bold, underline and blink attributes.
  this.textAttributes = new hterm.TextAttributes(window.document);

  // Current zero-based cursor coordinates.
  this.cursorPosition = new hterm.RowCol(0, 0);

  // Saved state used by DECSC and related settings.  This is only for saving
  // and restoring specific state, not for the current/active state.
  this.cursorState_ = new hterm.Screen.CursorState(this);

  // The node containing the row that the cursor is positioned on.
  this.cursorRowNode_ = null;

  // The node containing the span of text that the cursor is positioned on.
  this.cursorNode_ = null;

  // The offset in column width into cursorNode_ where the cursor is positioned.
  this.cursorOffset_ = 0;

  // Regexes for expanding word selections.
  /** @type {?string} */
  this.wordBreakMatchLeft = null;
  /** @type {?string} */
  this.wordBreakMatchRight = null;
  /** @type {?string} */
  this.wordBreakMatchMiddle = null;
};

/**
 * Return the screen size as an hterm.Size object.
 *
 * @return {!hterm.Size} hterm.Size object representing the current number
 *     of rows and columns in this screen.
 */
hterm.Screen.prototype.getSize = function() {
  return new hterm.Size(this.columnCount_, this.rowsArray.length);
};

/**
 * Return the current number of rows in this screen.
 *
 * @return {number} The number of rows in this screen.
 */
hterm.Screen.prototype.getHeight = function() {
  return this.rowsArray.length;
};

/**
 * Return the current number of columns in this screen.
 *
 * @return {number} The number of columns in this screen.
 */
hterm.Screen.prototype.getWidth = function() {
  return this.columnCount_;
};

/**
 * Set the maximum number of columns per row.
 *
 * @param {number} count The maximum number of columns per row.
 */
hterm.Screen.prototype.setColumnCount = function(count) {
  this.columnCount_ = count;

  if (this.cursorPosition.column >= count) {
    this.setCursorPosition(this.cursorPosition.row, count - 1);
  }
};

/**
 * Remove the first row from the screen and return it.
 *
 * @return {!Element} The first row in this screen.
 */
hterm.Screen.prototype.shiftRow = function() {
  return this.shiftRows(1)[0];
};

/**
 * Remove rows from the top of the screen and return them as an array.
 *
 * @param {number} count The number of rows to remove.
 * @return {!Array<!Element>} The selected rows.
 */
hterm.Screen.prototype.shiftRows = function(count) {
  return this.rowsArray.splice(0, count);
};

/**
 * Insert a row at the top of the screen.
 *
 * @param {!Element} row The row to insert.
 */
hterm.Screen.prototype.unshiftRow = function(row) {
  this.rowsArray.splice(0, 0, row);
};

/**
 * Insert rows at the top of the screen.
 *
 * @param {!Array<!Element>} rows The rows to insert.
 */
hterm.Screen.prototype.unshiftRows = function(rows) {
  this.rowsArray.unshift.apply(this.rowsArray, rows);
};

/**
 * Remove the last row from the screen and return it.
 *
 * @return {!Element} The last row in this screen.
 */
hterm.Screen.prototype.popRow = function() {
  return this.popRows(1)[0];
};

/**
 * Remove rows from the bottom of the screen and return them as an array.
 *
 * @param {number} count The number of rows to remove.
 * @return {!Array<!Element>} The selected rows.
 */
hterm.Screen.prototype.popRows = function(count) {
  return this.rowsArray.splice(this.rowsArray.length - count, count);
};

/**
 * Insert a row at the bottom of the screen.
 *
 * @param {!Element} row The row to insert.
 */
hterm.Screen.prototype.pushRow = function(row) {
  this.rowsArray.push(row);
};

/**
 * Insert rows at the bottom of the screen.
 *
 * @param {!Array<!Element>} rows The rows to insert.
 */
hterm.Screen.prototype.pushRows = function(rows) {
  rows.push.apply(this.rowsArray, rows);
};

/**
 * Insert a row at the specified row of the screen.
 *
 * @param {number} index The index to insert the row.
 * @param {!Element} row The row to insert.
 */
hterm.Screen.prototype.insertRow = function(index, row) {
  this.rowsArray.splice(index, 0, row);
};

/**
 * Insert rows at the specified row of the screen.
 *
 * @param {number} index The index to insert the rows.
 * @param {!Array<!Element>} rows The rows to insert.
 */
hterm.Screen.prototype.insertRows = function(index, rows) {
  for (let i = 0; i < rows.length; i++) {
    this.rowsArray.splice(index + i, 0, rows[i]);
  }
};

/**
 * Remove a row from the screen and return it.
 *
 * @param {number} index The index of the row to remove.
 * @return {!Element} The selected row.
 */
hterm.Screen.prototype.removeRow = function(index) {
  return this.rowsArray.splice(index, 1)[0];
};

/**
 * Remove rows from the bottom of the screen and return them as an array.
 *
 * @param {number} index The index to start removing rows.
 * @param {number} count The number of rows to remove.
 * @return {!Array<!Element>} The selected rows.
 */
hterm.Screen.prototype.removeRows = function(index, count) {
  return this.rowsArray.splice(index, count);
};

/**
 * Invalidate the current cursor position.
 *
 * This sets this.cursorPosition to (0, 0) and clears out some internal
 * data.
 *
 * Attempting to insert or overwrite text while the cursor position is invalid
 * will raise an obscure exception.
 */
hterm.Screen.prototype.invalidateCursorPosition = function() {
  this.cursorPosition.move(0, 0);
  this.cursorRowNode_ = null;
  this.cursorNode_ = null;
  this.cursorOffset_ = 0;
};

/**
 * Clear the contents of the cursor row.
 */
hterm.Screen.prototype.clearCursorRow = function() {
  this.cursorRowNode_.innerHTML = '';
  this.cursorRowNode_.removeAttribute('line-overflow');
  this.cursorOffset_ = 0;
  this.cursorPosition.column = 0;
  this.cursorPosition.overflow = false;

  let text;
  if (this.textAttributes.isDefault()) {
    text = '';
  } else {
    text = ' '.repeat(this.columnCount_);
  }

  // We shouldn't honor inverse colors when clearing an area, to match
  // xterm's back color erase behavior.
  const inverse = this.textAttributes.inverse;
  this.textAttributes.inverse = false;
  this.textAttributes.syncColors();

  const node = this.textAttributes.createContainer(text);
  this.cursorRowNode_.appendChild(node);
  this.cursorNode_ = node;

  this.textAttributes.inverse = inverse;
  this.textAttributes.syncColors();
};

/**
 * Mark the current row as having overflowed to the next line.
 *
 * The line overflow state is used when converting a range of rows into text.
 * It makes it possible to recombine two or more overflow terminal rows into
 * a single line.
 *
 * This is distinct from the cursor being in the overflow state.  Cursor
 * overflow indicates that printing at the cursor position will commit a
 * line overflow, unless it is preceded by a repositioning of the cursor
 * to a non-overflow state.
 */
hterm.Screen.prototype.commitLineOverflow = function() {
  this.cursorRowNode_.setAttribute('line-overflow', true);
};

/**
 * Relocate the cursor to a give row and column.
 *
 * @param {number} row The zero based row.
 * @param {number} column The zero based column.
 */
hterm.Screen.prototype.setCursorPosition = function(row, column) {
  if (!this.rowsArray.length) {
    console.warn('Attempt to set cursor position on empty screen.');
    return;
  }

  if (row >= this.rowsArray.length) {
    console.error('Row out of bounds: ' + row);
    row = this.rowsArray.length - 1;
  } else if (row < 0) {
    console.error('Row out of bounds: ' + row);
    row = 0;
  }

  if (column >= this.columnCount_) {
    console.error('Column out of bounds: ' + column);
    column = this.columnCount_ - 1;
  } else if (column < 0) {
    console.error('Column out of bounds: ' + column);
    column = 0;
  }

  this.cursorPosition.overflow = false;

  const rowNode = this.rowsArray[row];
  let node = rowNode.firstChild;

  if (!node) {
    node = rowNode.ownerDocument.createTextNode('');
    rowNode.appendChild(node);
  }

  let currentColumn = 0;

  if (rowNode == this.cursorRowNode_) {
    if (column >= this.cursorPosition.column - this.cursorOffset_) {
      node = this.cursorNode_;
      currentColumn = this.cursorPosition.column - this.cursorOffset_;
    }
  } else {
    this.cursorRowNode_ = rowNode;
  }

  this.cursorPosition.move(row, column);

  while (node) {
    const offset = column - currentColumn;
    const width = hterm.TextAttributes.nodeWidth(node);
    if (!node.nextSibling || width > offset) {
      this.cursorNode_ = node;
      this.cursorOffset_ = offset;
      return;
    }

    currentColumn += width;
    node = node.nextSibling;
  }
};

/**
 * Set the provided selection object to be a caret selection at the current
 * cursor position.
 *
 * @param {!Selection} selection
 */
hterm.Screen.prototype.syncSelectionCaret = function(selection) {
  try {
    selection.collapse(this.cursorNode_, this.cursorOffset_);
  } catch (firefoxIgnoredException) {
    // FF can throw an exception if the range is off, rather than just not
    // performing the collapse.
  }
};

/**
 * Split a single node into two nodes at the given offset.
 *
 * For example:
 * Given the DOM fragment '<div><span>Hello World</span></div>', call splitNode_
 * passing the span and an offset of 6.  This would modify the fragment to
 * become: '<div><span>Hello </span><span>World</span></div>'.  If the span
 * had any attributes they would have been copied to the new span as well.
 *
 * The to-be-split node must have a container, so that the new node can be
 * placed next to it.
 *
 * @param {!Node} node The node to split.
 * @param {number} offset The offset into the node where the split should
 *     occur.
 */
hterm.Screen.prototype.splitNode_ = function(node, offset) {
  const afterNode = node.cloneNode(false);

  const textContent = node.textContent;
  node.textContent = hterm.TextAttributes.nodeSubstr(node, 0, offset);
  afterNode.textContent = lib.wc.substr(textContent, offset);

  if (afterNode.textContent) {
    node.parentNode.insertBefore(afterNode, node.nextSibling);
  }
  if (!node.textContent) {
    node.remove();
  }
};

/**
 * Ensure that text is clipped and the cursor is clamped to the column count.
 */
hterm.Screen.prototype.maybeClipCurrentRow = function() {
  let width = hterm.TextAttributes.nodeWidth(lib.notNull(this.cursorRowNode_));

  if (width <= this.columnCount_) {
    // Current row does not need clipping, but may need clamping.
    if (this.cursorPosition.column >= this.columnCount_) {
      this.setCursorPosition(this.cursorPosition.row, this.columnCount_ - 1);
      this.cursorPosition.overflow = true;
    }

    return;
  }

  // Save off the current column so we can maybe restore it later.
  const currentColumn = this.cursorPosition.column;

  // Move the cursor to the final column.
  this.setCursorPosition(this.cursorPosition.row, this.columnCount_ - 1);

  // Remove any text that partially overflows.
  width = hterm.TextAttributes.nodeWidth(lib.notNull(this.cursorNode_));

  if (this.cursorOffset_ < width - 1) {
    this.cursorNode_.textContent = hterm.TextAttributes.nodeSubstr(
        this.cursorNode_, 0, this.cursorOffset_ + 1);
  }

  // Remove all nodes after the cursor.
  const rowNode = this.cursorRowNode_;
  let node = this.cursorNode_.nextSibling;

  while (node) {
    rowNode.removeChild(node);
    node = this.cursorNode_.nextSibling;
  }

  if (currentColumn < this.columnCount_) {
    // If the cursor was within the screen before we started then restore its
    // position.
    this.setCursorPosition(this.cursorPosition.row, currentColumn);
  } else {
    // Otherwise leave it at the the last column in the overflow state.
    this.cursorPosition.overflow = true;
  }
};

/**
 * Insert a string at the current character position using the current
 * text attributes.
 *
 * You must call maybeClipCurrentRow() after in order to clip overflowed
 * text and clamp the cursor.
 *
 * It is also up to the caller to properly maintain the line overflow state
 * using hterm.Screen..commitLineOverflow().
 *
 * @param {string} str The string to insert.
 * @param {number=} wcwidth The cached lib.wc.strWidth value for |str|.  Will be
 *     calculated on demand if need be.  Passing in a cached value helps speed
 *     up processing as this is a hot codepath.
 */
hterm.Screen.prototype.insertString = function(str, wcwidth = undefined) {
  let cursorNode = this.cursorNode_;
  let cursorNodeText = cursorNode.textContent;

  this.cursorRowNode_.removeAttribute('line-overflow');

  // We may alter the width of the string by prepending some missing
  // whitespaces, so we need to record the string width ahead of time.
  if (wcwidth === undefined) {
    wcwidth = lib.wc.strWidth(str);
  }

  // No matter what, before this function exits the cursor column will have
  // moved this much.
  this.cursorPosition.column += wcwidth;

  // Local cache of the cursor offset.
  let offset = this.cursorOffset_;

  // Reverse offset is the offset measured from the end of the string.
  // Zero implies that the cursor is at the end of the cursor node.
  let reverseOffset = hterm.TextAttributes.nodeWidth(cursorNode) - offset;

  if (reverseOffset < 0) {
    // A negative reverse offset means the cursor is positioned past the end
    // of the characters on this line.  We'll need to insert the missing
    // whitespace.
    const ws = ' '.repeat(-reverseOffset);

    // This whitespace should be completely unstyled.  Underline, background
    // color, and strikethrough would be visible on whitespace, so we can't use
    // one of those spans to hold the text.
    if (!(this.textAttributes.underline ||
          this.textAttributes.strikethrough ||
          this.textAttributes.background ||
          this.textAttributes.wcNode ||
          !this.textAttributes.asciiNode ||
          this.textAttributes.tileData != null)) {
      // Best case scenario, we can just pretend the spaces were part of the
      // original string.
      str = ws + str;
    } else if (cursorNode.nodeType == Node.TEXT_NODE ||
               !(cursorNode.wcNode ||
                 !cursorNode.asciiNode ||
                 cursorNode.tileNode ||
                 cursorNode.style.textDecoration ||
                 cursorNode.style.textDecorationStyle ||
                 cursorNode.style.textDecorationLine ||
                 cursorNode.style.backgroundColor)) {
      // Second best case, the current node is able to hold the whitespace.
      cursorNode.textContent = (cursorNodeText += ws);
    } else {
      // Worst case, we have to create a new node to hold the whitespace.
      const wsNode = cursorNode.ownerDocument.createTextNode(ws);
      this.cursorRowNode_.insertBefore(wsNode, cursorNode.nextSibling);
      this.cursorNode_ = cursorNode = wsNode;
      this.cursorOffset_ = offset = -reverseOffset;
      cursorNodeText = ws;
    }

    // We now know for sure that we're at the last character of the cursor node.
    reverseOffset = 0;
  }

  if (this.textAttributes.matchesContainer(cursorNode)) {
    // The new text can be placed directly in the cursor node.
    if (reverseOffset == 0) {
      cursorNode.textContent = cursorNodeText + str;
    } else if (offset == 0) {
      cursorNode.textContent = str + cursorNodeText;
    } else {
      cursorNode.textContent =
          hterm.TextAttributes.nodeSubstr(cursorNode, 0, offset) +
          str + hterm.TextAttributes.nodeSubstr(cursorNode, offset);
    }

    this.cursorOffset_ += wcwidth;
    return;
  }

  // The cursor node is the wrong style for the new text.  If we're at the
  // beginning or end of the cursor node, then the adjacent node is also a
  // potential candidate.

  if (offset == 0) {
    // At the beginning of the cursor node, the check the previous sibling.
    const previousSibling = cursorNode.previousSibling;
    if (previousSibling &&
        this.textAttributes.matchesContainer(previousSibling)) {
      previousSibling.textContent += str;
      this.cursorNode_ = previousSibling;
      this.cursorOffset_ = lib.wc.strWidth(previousSibling.textContent);
      return;
    }

    const newNode = this.textAttributes.createContainer(str);
    this.cursorRowNode_.insertBefore(newNode, cursorNode);
    this.cursorNode_ = newNode;
    this.cursorOffset_ = wcwidth;
    return;
  }

  if (reverseOffset == 0) {
    // At the end of the cursor node, the check the next sibling.
    const nextSibling = cursorNode.nextSibling;
    if (nextSibling &&
        this.textAttributes.matchesContainer(nextSibling)) {
      nextSibling.textContent = str + nextSibling.textContent;
      this.cursorNode_ = nextSibling;
      this.cursorOffset_ = lib.wc.strWidth(str);
      return;
    }

    const newNode = this.textAttributes.createContainer(str);
    this.cursorRowNode_.insertBefore(newNode, nextSibling);
    this.cursorNode_ = newNode;
    // We specifically need to include any missing whitespace here, since it's
    // going in a new node.
    this.cursorOffset_ = hterm.TextAttributes.nodeWidth(newNode);
    return;
  }

  // Worst case, we're somewhere in the middle of the cursor node.  We'll
  // have to split it into two nodes and insert our new container in between.
  this.splitNode_(cursorNode, offset);
  const newNode = this.textAttributes.createContainer(str);
  this.cursorRowNode_.insertBefore(newNode, cursorNode.nextSibling);
  this.cursorNode_ = newNode;
  this.cursorOffset_ = wcwidth;
};

/**
 * Overwrite the text at the current cursor position.
 *
 * You must call maybeClipCurrentRow() after in order to clip overflowed
 * text and clamp the cursor.
 *
 * It is also up to the caller to properly maintain the line overflow state
 * using hterm.Screen..commitLineOverflow().
 *
 * @param {string} str The source string for overwriting existing content.
 * @param {number=} wcwidth The cached lib.wc.strWidth value for |str|.  Will be
 *     calculated on demand if need be.  Passing in a cached value helps speed
 *     up processing as this is a hot codepath.
 */
hterm.Screen.prototype.overwriteString = function(str, wcwidth = undefined) {
  const maxLength = this.columnCount_ - this.cursorPosition.column;
  if (!maxLength) {
    return;
  }

  if (wcwidth === undefined) {
    wcwidth = lib.wc.strWidth(str);
  }

  if (this.textAttributes.matchesContainer(lib.notNull(this.cursorNode_)) &&
      this.cursorNode_.textContent.substr(this.cursorOffset_) ==
          str) {
    // This overwrite would be a no-op, just move the cursor and return.
    this.cursorOffset_ += wcwidth;
    this.cursorPosition.column += wcwidth;
    return;
  }

  this.deleteChars(Math.min(wcwidth, maxLength));
  this.insertString(str, wcwidth);
};

/**
 * Forward-delete one or more characters at the current cursor position.
 *
 * Text to the right of the deleted characters is shifted left.  Only affects
 * characters on the same row as the cursor.
 *
 * @param {number} count The column width of characters to delete.  This is
 *     clamped to the column width minus the cursor column.
 * @return {number} The column width of the characters actually deleted.
 */
hterm.Screen.prototype.deleteChars = function(count) {
  let node = this.cursorNode_;
  let offset = this.cursorOffset_;

  const currentCursorColumn = this.cursorPosition.column;
  count = Math.min(count, this.columnCount_ - currentCursorColumn);
  if (!count) {
    return 0;
  }

  const rv = count;
  let startLength, endLength;

  while (node && count) {
    // Sanity check so we don't loop forever, but we don't also go quietly.
    if (count < 0) {
      console.error(`Deleting ${rv} chars went negative: ${count}`);
      break;
    }

    startLength = hterm.TextAttributes.nodeWidth(node);
    node.textContent = hterm.TextAttributes.nodeSubstr(node, 0, offset) +
        hterm.TextAttributes.nodeSubstr(node, offset + count);
    endLength = hterm.TextAttributes.nodeWidth(node);

    // Deal with splitting wide characters.  There are two ways: we could delete
    // the first column or the second column.  In both cases, we delete the wide
    // character and replace one of the columns with a space (since the other
    // was deleted).  If there are more chars to delete, the next loop will pick
    // up the slack.
    if (node.wcNode && offset < startLength &&
        ((endLength && startLength == endLength) ||
         (!endLength && offset == 1))) {
      // No characters were deleted when there should be.  We're probably trying
      // to delete one column width from a wide character node.  We remove the
      // wide character node here and replace it with a single space.
      const spaceNode = this.textAttributes.createContainer(' ');
      node.parentNode.insertBefore(spaceNode, offset ? node : node.nextSibling);
      node.textContent = '';
      endLength = 0;
      count -= 1;
    } else {
      count -= startLength - endLength;
    }

    const nextNode = node.nextSibling;
    if (endLength == 0 && node != this.cursorNode_) {
      node.remove();
    }
    node = nextNode;
    offset = 0;
  }

  // Remove this.cursorNode_ if it is an empty non-text node.
  if (this.cursorNode_.nodeType != Node.TEXT_NODE &&
      !this.cursorNode_.textContent) {
    const cursorNode = this.cursorNode_;
    if (cursorNode.previousSibling) {
      this.cursorNode_ = cursorNode.previousSibling;
      this.cursorOffset_ = hterm.TextAttributes.nodeWidth(
          cursorNode.previousSibling);
    } else if (cursorNode.nextSibling) {
      this.cursorNode_ = cursorNode.nextSibling;
      this.cursorOffset_ = 0;
    } else {
      const emptyNode = this.cursorRowNode_.ownerDocument.createTextNode('');
      this.cursorRowNode_.appendChild(emptyNode);
      this.cursorNode_ = emptyNode;
      this.cursorOffset_ = 0;
    }
    this.cursorRowNode_.removeChild(cursorNode);
  }

  return rv;
};

/**
 * Finds first X-ROW of a line containing specified X-ROW.
 * Used to support line overflow.
 *
 * @param {!Node} row X-ROW to begin search for first row of line.
 * @return {!Node} The X-ROW that is at the beginning of the line.
 **/
hterm.Screen.prototype.getLineStartRow_ = function(row) {
  while (row.previousSibling &&
         row.previousSibling.hasAttribute('line-overflow')) {
    row = row.previousSibling;
  }
  return row;
};

/**
 * Gets text of a line beginning with row.
 * Supports line overflow.
 *
 * @param {!Node} row First X-ROW of line.
 * @return {string} Text content of line.
 **/
hterm.Screen.prototype.getLineText_ = function(row) {
  let rowText = '';
  let rowOrNull = row;
  while (rowOrNull) {
    rowText += rowOrNull.textContent;
    if (rowOrNull.hasAttribute('line-overflow')) {
      rowOrNull = rowOrNull.nextSibling;
    } else {
      break;
    }
  }
  return rowText;
};

/**
 * Returns X-ROW that is ancestor of the node.
 *
 * @param {!Node} node Node to get X-ROW ancestor for.
 * @return {?Node} X-ROW ancestor of node, or null if not found.
 **/
hterm.Screen.prototype.getXRowAncestor_ = function(node) {
  let nodeOrNull = node;
  while (nodeOrNull) {
    if (nodeOrNull.nodeName === 'X-ROW') {
      break;
    }
    nodeOrNull = nodeOrNull.parentNode;
  }
  return nodeOrNull;
};

/**
 * Returns position within line of character at offset within node.
 * Supports line overflow.
 *
 * @param {!Node} row X-ROW at beginning of line.
 * @param {!Node} node Node to get position of.
 * @param {number} offset Offset into node.
 * @return {number} Position within line of character at offset within node.
 **/
hterm.Screen.prototype.getPositionWithOverflow_ = function(row, node, offset) {
  if (!node) {
    return -1;
  }
  const ancestorRow = this.getXRowAncestor_(node);
  if (!ancestorRow) {
    return -1;
  }
  let position = 0;
  while (ancestorRow != row) {
    position += hterm.TextAttributes.nodeWidth(row);
    if (row.hasAttribute('line-overflow') && row.nextSibling) {
      row = row.nextSibling;
    } else {
      return -1;
    }
  }
  return position + this.getPositionWithinRow_(row, node, offset);
};

/**
 * Returns position within row of character at offset within node.
 * Does not support line overflow.
 *
 * @param {!Node} row X-ROW to get position within.
 * @param {!Node} node Node to get position for.
 * @param {number} offset Offset within node to get position for.
 * @return {number} Position within row of character at offset within node.
 **/
hterm.Screen.prototype.getPositionWithinRow_ = function(row, node, offset) {
  if (node.parentNode != row) {
    // If we traversed to the top node, then there's nothing to find here.
    if (node.parentNode == null) {
      return -1;
    }

    return this.getPositionWithinRow_(node.parentNode, node, offset) +
           this.getPositionWithinRow_(row, node.parentNode, 0);
  }
  let position = 0;
  for (let i = 0; i < row.childNodes.length; i++) {
    const currentNode = row.childNodes[i];
    if (currentNode == node) {
      return position + offset;
    }
    position += hterm.TextAttributes.nodeWidth(currentNode);
  }
  return -1;
};

/**
 * Returns the node and offset corresponding to position within line.
 * Supports line overflow.
 *
 * @param {!Node} row X-ROW at beginning of line.
 * @param {number} position Position within line to retrieve node and offset.
 * @return {?Array} Two element array containing node and offset respectively.
 **/
hterm.Screen.prototype.getNodeAndOffsetWithOverflow_ = function(row, position) {
  while (row && position > hterm.TextAttributes.nodeWidth(row)) {
    if (row.hasAttribute('line-overflow') && row.nextSibling) {
      position -= hterm.TextAttributes.nodeWidth(row);
      row = row.nextSibling;
    } else {
      return [null, -1];
    }
  }
  return this.getNodeAndOffsetWithinRow_(row, position);
};

/**
 * Returns the node and offset corresponding to position within row.
 * Does not support line overflow.
 *
 * @param {!Node} row X-ROW to get position within.
 * @param {number} position Position within row to retrieve node and offset.
 * @return {?Array} Two element array containing node and offset respectively.
 **/
hterm.Screen.prototype.getNodeAndOffsetWithinRow_ = function(row, position) {
  for (let i = 0; i < row.childNodes.length; i++) {
    const node = row.childNodes[i];
    const nodeTextWidth = hterm.TextAttributes.nodeWidth(node);
    if (position <= nodeTextWidth) {
      if (node.nodeName === 'SPAN') {
        /** Drill down to node contained by SPAN. **/
        return this.getNodeAndOffsetWithinRow_(node, position);
      } else {
        return [node, position];
      }
    }
    position -= nodeTextWidth;
  }
  return null;
};

/**
 * Returns the node and offset corresponding to position within line.
 * Supports line overflow.
 *
 * @param {!Node} row X-ROW at beginning of line.
 * @param {number} start Start position of range within line.
 * @param {number} end End position of range within line.
 * @param {!Range} range Range to modify.
 **/
hterm.Screen.prototype.setRange_ = function(row, start, end, range) {
  const startNodeAndOffset = this.getNodeAndOffsetWithOverflow_(row, start);
  if (startNodeAndOffset == null) {
    return;
  }
  const endNodeAndOffset = this.getNodeAndOffsetWithOverflow_(row, end);
  if (endNodeAndOffset == null) {
    return;
  }
  range.setStart(startNodeAndOffset[0], startNodeAndOffset[1]);
  range.setEnd(endNodeAndOffset[0], endNodeAndOffset[1]);
};

/**
 * Expands selection to surrounding string with word break matches.
 *
 * @param {?Selection} selection Selection to expand.
 * @param {string} leftMatch left word break match.
 * @param {string} rightMatch right word break match.
 * @param {string} insideMatch inside word break match.
 */
hterm.Screen.prototype.expandSelectionWithWordBreakMatches_ =
    function(selection, leftMatch, rightMatch, insideMatch) {
  if (!selection) {
    return;
  }

  const range = selection.getRangeAt(0);
  if (!range || range.toString().match(/\s/)) {
    return;
  }

  const rowElement = this.getXRowAncestor_(lib.notNull(range.startContainer));
  if (!rowElement) {
    return;
  }
  const row = this.getLineStartRow_(rowElement);
  if (!row) {
    return;
  }

  const startPosition = this.getPositionWithOverflow_(
      row, lib.notNull(range.startContainer), range.startOffset);
  if (startPosition == -1) {
    return;
  }
  const endPosition = this.getPositionWithOverflow_(
      row, lib.notNull(range.endContainer), range.endOffset);
  if (endPosition == -1) {
    return;
  }

  // Move start to the left.
  const rowText = this.getLineText_(row);
  const lineUpToRange = lib.wc.substring(rowText, 0, endPosition);
  const leftRegularExpression = new RegExp(leftMatch + insideMatch + '$');
  const expandedStart = lineUpToRange.search(leftRegularExpression);
  if (expandedStart == -1 || expandedStart > startPosition) {
    return;
  }

  // Move end to the right.
  const lineFromRange = lib.wc.substring(rowText, startPosition,
                                         lib.wc.strWidth(rowText));
  const rightRegularExpression = new RegExp('^' + insideMatch + rightMatch);
  const found = lineFromRange.match(rightRegularExpression);
  if (!found) {
    return;
  }
  const expandedEnd = startPosition + lib.wc.strWidth(found[0]);
  if (expandedEnd == -1 || expandedEnd < endPosition) {
    return;
  }

  this.setRange_(row, expandedStart, expandedEnd, range);
  selection.addRange(range);
};

/**
 * Expands selection to surrounding string using the user's settings.
 *
 * @param {?Selection} selection Selection to expand.
 */
hterm.Screen.prototype.expandSelection = function(selection) {
  this.expandSelectionWithWordBreakMatches_(
      selection,
      lib.notNull(this.wordBreakMatchLeft),
      lib.notNull(this.wordBreakMatchRight),
      lib.notNull(this.wordBreakMatchMiddle));
};

/**
 * Expands selection to surrounding URL using a set of fixed match settings.
 *
 * @param {?Selection} selection Selection to expand.
 */
hterm.Screen.prototype.expandSelectionForUrl = function(selection) {
  this.expandSelectionWithWordBreakMatches_(
      selection,
      '[^\\s[\\](){}<>"\'^!@#$%&*,;:`\u{2018}\u{201c}\u{2039}\u{ab}]',
      '[^\\s[\\](){}<>"\'^!@#$%&*,;:~.`\u{2019}\u{201d}\u{203a}\u{bb}]',
      '[^\\s[\\](){}<>"\'^]*');
};

/**
 * Save the current cursor state to the corresponding screens.
 *
 * @param {!hterm.VT} vt The VT object to read graphic codeset details from.
 */
hterm.Screen.prototype.saveCursorAndState = function(vt) {
  this.cursorState_.save(vt);
};

/**
 * Restore the saved cursor state in the corresponding screens.
 *
 * @param {!hterm.VT} vt The VT object to write graphic codeset details to.
 */
hterm.Screen.prototype.restoreCursorAndState = function(vt) {
  this.cursorState_.restore(vt);
};

/**
 * Track all the things related to the current "cursor".
 *
 * The set of things saved & restored here is defined by DEC:
 * https://vt100.net/docs/vt510-rm/DECSC.html
 * - Cursor position
 * - Character attributes set by the SGR command
 * - Character sets (G0, G1, G2, or G3) currently in GL and GR
 * - Wrap flag (autowrap or no autowrap)
 * - State of origin mode (DECOM)
 * - Selective erase attribute
 * - Any single shift 2 (SS2) or single shift 3 (SS3) functions sent
 *
 * These are done on a per-screen basis.
 *
 * @param {!hterm.Screen} screen The screen this cursor is tied to.
 * @constructor
 */
hterm.Screen.CursorState = function(screen) {
  this.screen_ = screen;
  this.cursor = null;
  this.textAttributes = null;
  this.GL = this.GR = this.G0 = this.G1 = this.G2 = this.G3 = null;
};

/**
 * Save all the cursor state.
 *
 * @param {!hterm.VT} vt The VT object to read graphic codeset details from.
 */
hterm.Screen.CursorState.prototype.save = function(vt) {
  this.cursor = vt.terminal.saveCursor();

  this.textAttributes = this.screen_.textAttributes.clone();

  this.GL = vt.GL;
  this.GR = vt.GR;

  this.G0 = vt.G0;
  this.G1 = vt.G1;
  this.G2 = vt.G2;
  this.G3 = vt.G3;
};

/**
 * Restore the previously saved cursor state.
 *
 * @param {!hterm.VT} vt The VT object to write graphic codeset details to.
 */
hterm.Screen.CursorState.prototype.restore = function(vt) {
  vt.terminal.restoreCursor(this.cursor);

  // Cursor restore includes char attributes (bold/etc...), but does not change
  // the color palette (which are a terminal setting).
  const tattrs = this.textAttributes.clone();
  tattrs.colorPaletteOverrides =
      this.screen_.textAttributes.colorPaletteOverrides;
  tattrs.syncColors();

  this.screen_.textAttributes = tattrs;

  vt.GL = this.GL;
  vt.GR = this.GR;

  vt.G0 = this.G0;
  vt.G1 = this.G1;
  vt.G2 = this.G2;
  vt.G3 = this.G3;
};
