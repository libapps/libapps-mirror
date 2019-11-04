// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-display-manager.
 *
 * lit-element has not been used for this element, due to its programmatic
 * rendering.
 *
 * @suppress {moduleLoad}
 */
import {html, render} from './lit_element.js';

/**
 * @param {!Array<?>} xs
 * @param {function(?)} compare
 * @return {number}
 */
const binarySearch = (xs, compare) => {
  let l = 0;
  let r = xs.length - 1;
  while (l <= r) {
    const m = Math.floor((l + r) / 2);
    const result = compare(xs[m]);
    if (result < 0) {
      l = m + 1;
    } else if (result > 0) {
      r = m - 1;
    } else {
      return m;
    }
  }
  return l;
};

const managerTemplate = html`
  <style>
    :host {
      display: block;
    }

    #container {
      display: grid;
      height: 100%;
      width: 100%;
    }

    .window {
      box-sizing: border-box;
      height: 100%;
      position: relative;
      width: 100%;
    }

    :host([terminal-splits-enabled="true"]) .window {
      border-bottom: 1px solid grey;
      border-right: 1px solid grey;
    }

    .controls {
      background-color: rgba(0, 0, 0, 0);
      bottom: 0;
      cursor: cell;
      display: none;
      height: 30px;
      left: 0;
      position: absolute;
      right: 0;
      top: 0;
      transition: background-color 2s cubic-bezier(0.22, 0.61, 0.36, 1);
      width: 30px;
      z-index: 1;
    }
    .controls[side="L"]
      { border-radius: 0 30px 30px 0; right: unset; height: unset; }
    .controls[side="R"]
      { border-radius: 30px 0 0 30px; left: unset; height: unset; }
    .controls[side="T"]
      { border-radius: 0 0 30px 30px; bottom: unset; width: unset; }
    .controls[side="B"]
      { border-radius: 30px 30px 0 0; top: unset; width: unset; }

    :host([terminal-splits-enabled="true"]) .controls {
      display: block;
    }

    .controls:hover {
      background-color: rgb(0, 0, 0, 0.3);
    }
  </style>
  <div id="container">
  </div>
`;

/**
 * @param {string} id
 * @param {function(!Event)} onClick
 * @return {!Element}
 */
const createWindowElement = (id, onClick) => {
  const fragment = new DocumentFragment();
  const template = html`
    <div class="window">
      <div @click="${onClick}" class="controls" side="L">
      </div>
      <div @click="${onClick}" class="controls" side="R">
      </div>
      <div @click="${onClick}" class="controls" side="T">
      </div>
      <div @click="${onClick}" class="controls" side="B">
      </div>
      <slot name="${id}">
      </slot>
    </div>
  `;
  render(template, fragment);
  return lib.notNull(fragment.firstElementChild);
};

class Grid {
  constructor(rootElement) {
    this.lastNodeId_ = 0;
    this.lastColumnId_ = 0;
    this.lastRowId_ = 0;
    this.columns = [];
    this.rows = [];
    this.nodes_ = {};
    this.root = new GridNode(
        this,
        rootElement,
        this.makeColumn_(0),
        this.makeColumn_(100),
        this.makeRow_(0),
        this.makeRow_(100));
  }

  /*
   * @param {!Element} element
   * @return {!GridNode}
   */
  getNodeFromElement(element) {
    return lib.notNull(this.nodes_[element.getAttribute('terminal-window-id')]);
  }

  /*
   * @param {string} id
   * @param {!GridNode} node
   */
  nodeCreated_(id, node) {
    this.nodes_[id] = node;
  }

  /** @return {string} */
  makeNodeId_() { return `${++this.lastNodeId_}`; }

  /*
   * @param {string} id
   * @param {!Array} edges
   * @param {number} precedingSpace
   * @return {!Object}
   */
  makeEdge_(id, edges, precedingSpace) {
    const index = binarySearch(edges, (x) => x.precedingSpace - precedingSpace);
    const edge = {id, precedingSpace};
    edges.splice(index, 0, edge);
    return edge;
  }

  /*
   * @param {number} precedingSpace
   * @return {!Object}
   */
  makeColumn_(precedingSpace) {
    return this.makeEdge_(
        `c${++this.lastColumnId_}`, this.columns, precedingSpace);
  }

  /*
   * @param {number} precedingSpace
   * @return {!Object}
   */
  makeRow_(precedingSpace) {
    return this.makeEdge_(`r${++this.lastRowId_}`, this.rows, precedingSpace);
  }
}

class GridNode {
  constructor(grid, element, leftEdge, rightEdge, topEdge, bottomEdge) {
    this.grid_ = grid;
    this.element_ = element;
    this.id_ = this.grid_.makeNodeId_();
    this.bottomEdge_ = bottomEdge;
    this.leftEdge_ = leftEdge;
    this.rightEdge_ = rightEdge;
    this.topEdge_ = topEdge;

    this.firstChild_ = null;
    this.lastChild_ = null;

    this.element_.setAttribute('terminal-window-id', this.id_);
    this.element_.style.gridArea = `${this.topEdge_.id} / ${
        this.leftEdge_.id} / ${this.bottomEdge_.id} / ${this.rightEdge_.id}`;

    this.grid_.nodeCreated_(this.id_, this);
  }

  /*
   * @return {boolean}
   */
  isLeaf() {
    if (this.firstChild_) {
      lib.notNull(this.lastChild_);
      lib.assert(this.element_ === null);
      return false;
    } else {
      lib.assert(this.lastChild_ === null);
      lib.notNull(this.element_);
      return true;
    }
  }

  /*
   * @param {?Element} firstElement
   * @param {?Element} lastElement
   */
  splitHorizontally(firstElement, lastElement) {
    lib.assert(this.isLeaf());
    lib.assert(
        (firstElement === null && lastElement !== null) ||
        (firstElement !== null && lastElement === null));

    const midpoint =
        (this.topEdge_.precedingSpace + this.bottomEdge_.precedingSpace) / 2;
    const newEdge = this.grid_.makeRow_(midpoint);
    this.firstChild_ = new GridNode(
        this.grid_,
        firstElement || this.element_,
        this.leftEdge_,
        this.rightEdge_,
        this.topEdge_,
        newEdge);
    this.lastChild_ = new GridNode(
        this.grid_,
        lastElement || this.element_,
        this.leftEdge_,
        this.rightEdge_,
        newEdge,
        this.bottomEdge_);
    this.element_ = null;
  }

  /*
   * @param {?Element} firstElement
   * @param {?Element} lastElement
   */
  splitVertically(firstElement, lastElement) {
    lib.assert(this.isLeaf());
    lib.assert(
        (firstElement === null && lastElement !== null) ||
        (firstElement !== null && lastElement === null));

    const midpoint =
        (this.leftEdge_.precedingSpace + this.rightEdge_.precedingSpace) / 2;
    const newEdge = this.grid_.makeColumn_(midpoint);
    this.firstChild_ = new GridNode(
        this.grid_,
        firstElement || this.element_,
        this.leftEdge_,
        newEdge,
        this.topEdge_,
        this.bottomEdge_);
    this.lastChild_ = new GridNode(
        this.grid_,
        lastElement || this.element_,
        newEdge,
        this.rightEdge_,
        this.topEdge_,
        this.bottomEdge_);
    this.element_ = null;
  }
}

export class TerminalDisplayManagerElement extends HTMLElement {
  static get is() { return 'terminal-display-manager'; }

  constructor() {
    super();

    /** @public {?Grid} */
    this.grid = null;

    this.lastSlotId = 0;
    this.attachShadow({mode: 'open'});
  }

  /** @override */
  connectedCallback() {
    render(managerTemplate, lib.notNull(this.shadowRoot));

    const id = `tdm-slot-${++this.lastSlotId}`;
    const windowEl = createWindowElement(id, this.onControlsClick_);

    this.grid = new Grid(windowEl);

    this.updateColumnLineIndices_();
    this.updateRowLineIndices_();

    this.addNewSlot_(id, windowEl);
  }

  /** @override */
  disconnectedCallback() {
    // Cleanup grid as it is reasonably memory heavy.
    this.grid = null;
  }

  updateColumnLineIndices_() {
    this.shadowRoot.getElementById('container').style.gridTemplateColumns =
        this.grid.columns.map((x, i, xs) => !i ? `[${x.id}]` : ` ${
          x.precedingSpace - xs[i - 1].precedingSpace}% [${x.id}]`).join(' ');
  }

  updateRowLineIndices_() {
    this.shadowRoot.getElementById('container').style.gridTemplateRows =
        this.grid.rows.map((x, i, xs) => !i ? `[${x.id}]` : ` ${
          x.precedingSpace - xs[i - 1].precedingSpace}% [${x.id}]`).join(' ');
  }

  /** @param {!Event} event */
  onControlsClick_(event) {
    // |this| is the control element, not the host element.
    const host = this.getRootNode().host;

    if (!host.getAttribute('terminal-splits-enabled')) {
      return;
    }

    const existingNode = host.grid.getNodeFromElement(this.parentNode);

    const newId = `tdm-slot-${++host.lastSlotId}`;
    const newWindowEl = createWindowElement(newId, host.onControlsClick_);

    switch (this.getAttribute('side')) {
      case 'B':
        existingNode.splitHorizontally(null, newWindowEl);
        host.updateRowLineIndices_();
        break;
      case 'L':
        existingNode.splitVertically(newWindowEl, null);
        host.updateColumnLineIndices_();
        break;
      case 'R':
        existingNode.splitVertically(null, newWindowEl);
        host.updateColumnLineIndices_();
        break;
      case 'T':
        existingNode.splitHorizontally(newWindowEl, null);
        host.updateRowLineIndices_();
        break;
    }

    host.addNewSlot_(newId, newWindowEl);
  }

  /*
   * @param {string} id
   * @param {!Element} windowEl
   */
  addNewSlot_(id, windowEl) {
    this.shadowRoot.getElementById('container').appendChild(windowEl);

    this.dispatchEvent(
        new CustomEvent('terminal-window-ready', {detail: {slot: id}}));
  }
}
