// Copyright (c) 2012 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * UI Element that controls the multi-column list in the connect dialog.
 *
 * Maybe it should be promoted to a shared lib at some point.
 *
 * @param {!Element} div
 * @param {!Object} items
 * @param {number=} columnCount
 * @constructor
 */
nassh.ColumnList = function(div, items, columnCount = 2) {
  this.div_ = div || null;
  this.items_ = items;
  this.columnCount = columnCount;
  this.activeIndex = 0;

  // List of callbacks to invoke after the next redraw().
  this.afterRedraw_ = [];

  this.document_ = null;

  if (div) {
    this.decorate(div);
  }
};

/**
 * Turn a div into a ColumnList.
 *
 * @param {!Element} div
 */
nassh.ColumnList.prototype.decorate = function(div) {
  this.div_ = div;
  this.document_ = div.ownerDocument;

  this.div_.style.overflowY = 'auto';
  this.div_.style.overflowX = 'hidden';
  this.div_.addEventListener('keydown',
      /** @type {!EventListener} */ (this.onKeyDown_.bind(this)));

  let baseId = this.div_.getAttribute('id');
  if (!baseId) {
    baseId = lib.f.randomInt(1, 0xffff).toString(16);
    baseId = lib.f.zpad(baseId, 4);
    baseId = 'columnlist-' + baseId;
  }

  this.baseId_ = baseId;

  this.redraw();
};

/**
 * Focus the ColumnList.
 */
nassh.ColumnList.prototype.focus = function() {
  if (!this.div_) {
    throw new Error('Not initialized.');
  }

  this.div_.focus();
};

/**
 * Add an event listener.
 *
 * @param {...*} args
 */
nassh.ColumnList.prototype.addEventListener = function(...args) {
  if (!this.div_) {
    throw new Error('Not initialized.');
  }

  this.div_.addEventListener.apply(this.div_, args);
};

/**
 * Have the ColumnList redraw after a brief timeout.
 *
 * Coalesces multiple invocations during the timeout period.
 */
nassh.ColumnList.prototype.scheduleRedraw = function() {
  if (this.redrawTimeout_) {
    return;
  }

  this.redrawTimeout_ = setTimeout(() => {
    this.redrawTimeout_ = null;
    this.redraw();
  }, 100);
};

/**
 * Emoty out and redraw the list.
 */
nassh.ColumnList.prototype.redraw = function() {
  const div = this.div_;

  while (div.firstChild) {
    div.removeChild(div.firstChild);
  }

  div.setAttribute('tabindex', '0');
  div.setAttribute('role', 'listbox');

  if (!this.items_.length) {
    return;
  }

  const columnWidth = (1 / this.columnCount * 100) + '%';

  const table = this.document_.createElement('table');
  table.style.tableLayout = 'fixed';
  table.style.width = '100%';
  div.appendChild(table);

  const tbody = this.document_.createElement('tbody');
  table.appendChild(tbody);

  let tr;

  for (let i = 0; i < this.items_.length; i++) {
    const row = Math.floor(i / this.columnCount);
    const column = i % this.columnCount;

    const td = this.document_.createElement('td');
    td.setAttribute('role', 'option');
    td.setAttribute('id', this.baseId_ + '-item-' + i);
    td.setAttribute('row', row);
    td.setAttribute('column', column);
    td.style.width = columnWidth;
    td.className = 'column-list-item';

    const item = this.document_.createElement('div');
    item.textContent = this.items_[i].textContent || 'no-name';
    item.addEventListener('click', this.onItemClick_.bind(this, td));
    item.addEventListener('dblclick', this.onItemClick_.bind(this, td));
    td.appendChild(item);

    if (column == 0) {
      tr = this.document_.createElement('tr');
      tbody.appendChild(tr);
    }

    tr.appendChild(td);
  }

  this.setActiveIndex(Math.min(this.activeIndex, this.items_.length - 1));

  while (this.afterRedraw_.length) {
    const callback = this.afterRedraw_.pop();
    callback();
  }
};

/**
 * Function to invoke after the next redraw() happens.
 *
 * Use this if you're doing something that will cause a redraw (like modifying a
 * preference linked to the list), and you have something to finish after the
 * redraw.
 *
 * @param {function()} callback
 */
nassh.ColumnList.prototype.afterNextRedraw = function(callback) {
  this.afterRedraw_.push(callback);
};

/** @typedef {{before: number, now: number}} */
nassh.ColumnList.ActiveIndexChangedEvent;

/**
 * Set the index of the item that should be considered "active".
 *
 * @param {number} i
 */
nassh.ColumnList.prototype.setActiveIndex = function(i) {
  if (isNaN(i)) {
    throw new Error('Index is NaN');
  }

  const before = this.activeIndex;

  if (i != this.activeIndex) {
    const n = this.getActiveNode_();
    if (n) {
      n.classList.remove('active');
    }

    setTimeout(
        this.onActiveIndexChanged.bind(this, {before: before, now: i}), 0);
  }

  this.activeIndex = i;
  const node = this.getActiveNode_();
  node.classList.add('active');
  this.div_.setAttribute('aria-activedescendant', node.getAttribute('id'));

  setTimeout(node.scrollIntoViewIfNeeded.bind(node), 0);
};

/**
 * Return the outer DOM node for the active item.
 *
 * @return {!Node}
 */
nassh.ColumnList.prototype.getActiveNode_ = function() {
  return this.getNodeByIndex_(this.activeIndex);
};

/**
 * Given an index into the list, return the (row, column) location.
 *
 * @param {number} i
 * @return {{row:number, column:number}}
 */
nassh.ColumnList.prototype.getRowColByIndex_ = function(i) {
  return {
    row: parseInt(i / this.columnCount, 10),
    column: i % this.columnCount,
  };
};

/**
 * Given a 1d index into the list, return the DOM node.
 *
 * @param {number} i
 * @return {!Node}
 */
nassh.ColumnList.prototype.getNodeByIndex_ = function(i) {
  const rc = this.getRowColByIndex_(i);
  return this.getNodeByRowCol_(rc.row, rc.column);
};

/**
 * Given a (row, column) location, return an index into the list.
 *
 * @param {number} row
 * @param {number} column
 * @return {number}
 */
nassh.ColumnList.prototype.getIndexByRowCol_ = function(
    row, column) {
  return this.columnCount * row + column;
};

/**
 * Given a (row, column) location, return a DOM node.
 *
 * @param {number} row
 * @param {number} column
 * @return {!Element}
 */
nassh.ColumnList.prototype.getNodeByRowCol_ = function(row, column) {
  return lib.notNull(this.div_.querySelector(
      '[row="' + row + '"][column="' + column + '"]'));
};

/**
 * Someone clicked on an item in the list.
 *
 * @param {!Node} srcNode
 * @param {!Event} e
 * @return {boolean}
 */
nassh.ColumnList.prototype.onItemClick_ = function(srcNode, e) {
  const i = this.getIndexByRowCol_(
      parseInt(srcNode.getAttribute('row'), 10),
      parseInt(srcNode.getAttribute('column'), 10));
  this.setActiveIndex(i);

  e.preventDefault();
  return false;
};

/**
 * Return the height (in items) of a given, zero-based column.
 *
 * @param {number} column
 * @return {number}
 */
nassh.ColumnList.prototype.getColumnHeight_ = function(column) {
  const tallestColumn = Math.ceil(this.items_.length / this.columnCount);

  if (column + 1 <= Math.floor(this.columnCount / column + 1)) {
    return tallestColumn;
  }

  return tallestColumn - 1;
};

/**
 * Clients can override this to learn when the active index changes.
 *
 * @param {!nassh.ColumnList.ActiveIndexChangedEvent} e
 */
nassh.ColumnList.prototype.onActiveIndexChanged = function(e) { };

/**
 * Clients can override this to handle onKeyDown events.
 *
 * They can return false (literally) to block the ColumnList from also
 * handling the event.
 *
 * @param {!KeyboardEvent} e
 */
nassh.ColumnList.prototype.onKeyDown = function(e) { };

/**
 * Handle a key down event on the div.
 *
 * @param {!KeyboardEvent} e
 */
nassh.ColumnList.prototype.onKeyDown_ = function(e) {
  if (this.onKeyDown(e) === false) {
    return;
  }

  let i = this.activeIndex;
  const rc = this.getRowColByIndex_(i);

  switch (e.keyCode) {
    case 38:  // UP
      if (i == 0) {
        // UP from the first item, warp to the last.
        i = this.items_.length - 1;
      } else if (rc.row == 0) {
       // UP from the first row, warp to bottom of previous column.
        i = this.getIndexByRowCol_(this.getColumnHeight_(rc.column - 1) - 1,
                                   rc.column - 1);
      } else {
        // UP from anywhere else, just move up a row.
        i = this.getIndexByRowCol_(rc.row - 1, rc.column);
      }
      break;

    case 40:  // DOWN
      if (i == this.items_.length - 1) {
        // DOWN from last item, warp to the first.
        i = 0;
      } else if (rc.row == this.getColumnHeight_(rc.column) - 1) {
        // DOWN from the bottom row, warp to top of the next.
        i = this.getIndexByRowCol_(0, rc.column + 1);
      } else {
        // DOWN from anywhere else, move down a row.
        i = this.getIndexByRowCol_(rc.row + 1, rc.column);
        // If the next row is incomplete, warp to top of the next.
        if (i > this.items_.length - 1) {
          if (rc.column >= this.columnCount - 1) {
            i = 0;
          } else {
            i = this.getIndexByRowCol_(0, rc.column + 1);
          }
        }
      }
      break;

    case 39:  // RIGHT
      if (i == this.items_.length - 1) {
        // RIGHT from last item, warp to the first.
        i = 0;
      } else if (rc.column >= this.columnCount - 1 ||
                 rc.row >= this.getColumnHeight_(rc.column + 1)) {
        // RIGHT from last column (of this row), warp to the first column of
        // next row.
        i = this.getIndexByRowCol_(rc.row + 1, 0);
      } else {
        // RIGHT from anywhere else, move right a column.
        i = this.getIndexByRowCol_(rc.row, rc.column + 1);
      }
      break;

    case 37:  // LEFT
      if (i == 0) {
        // LEFT from first item, warp to the last.
        i = this.items_.length - 1;
      } else if (rc.column == 0) {
        // LEFT from first column, warp to the last column of previous row.
        i = this.getIndexByRowCol_(rc.row - 1, this.columnCount - 1);
      } else {
        // LEFT from anywhere else, move left a column.
        i = this.getIndexByRowCol_(rc.row, rc.column - 1);
      }
      break;
  }

  if (i != this.activeIndex) {
    this.setActiveIndex(i);
  }
};
