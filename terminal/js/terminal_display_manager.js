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
  /** @param {!Element} rootElement */
  constructor(rootElement) {
    this.lastNodeId_ = 0;
    this.lastColumnId_ = 0;
    this.lastRowId_ = 0;
    this.columns_ = [];
    this.rows_ = [];
    this.nodes_ = {};
    this.root = new GridNode(
        this,
        rootElement,
        null,
        this.makeColumn_(0),
        this.makeColumn_(100),
        this.makeRow_(0),
        this.makeRow_(100));
  }

  /**
   * @param {!Element} element
   * @return {!GridNode}
   */
  getNodeFromElement(element) {
    return lib.notNull(this.nodes_[element.getAttribute('terminal-window-id')]);
  }

  /**
   * @param {string} id
   * @param {!GridNode} node
   */
  nodeCreated_(id, node) {
    this.nodes_[id] = node;
  }

  /** @param {string} id */
  nodeRemoved_(id) {
    delete this.nodes_[id];
  }

  /** @return {string} */
  makeNodeId_() { return `${++this.lastNodeId_}`; }

  /**
   * @param {!Object} edge
   * @param {!Array} edges
   * @return {?number} index
   */
  findEdge_(edge, edges) {
    // There may be more than one edge with the same precedingSpace. so we check
    // all possible edges in a limited range.
    const l = binarySearch(
        edges, (x) => x.precedingSpace - edge.precedingSpace + 0.1);
    const r = binarySearch(
        edges, (x) => x.precedingSpace - edge.precedingSpace - 0.1);
    for (let i = l; i < r; ++i) {
      if (edges[i] === edge) {
        return i;
      }
    }
    return null;
  }

  /**
   * @param {string} id
   * @param {!Array} edges
   * @param {number} precedingSpace
   * @return {!Object}
   */
  makeEdge_(id, edges, precedingSpace) {
    // Can binary search because we don't care where exactly the edge is
    // inserted, so long as the array ends up ordered.
    const index = binarySearch(edges, (x) => x.precedingSpace - precedingSpace);
    const edge = {id, precedingSpace};
    edges.splice(index, 0, edge);
    return edge;
  }

  /**
   * @param {number} precedingSpace
   * @return {!Object}
   */
  makeColumn_(precedingSpace) {
    return this.makeEdge_(
        `c${++this.lastColumnId_}`, this.columns_, precedingSpace);
  }

  /**
   * @param {!Object} column
   */
  removeColumn_(column) {
    const index = this.findEdge_(column, this.columns_);
    if (index !== null) {
      this.columns_.splice(index, 1);
    }
  }

  /**
   * @param {number} precedingSpace
   * @return {!Object}
   */
  makeRow_(precedingSpace) {
    return this.makeEdge_(`r${++this.lastRowId_}`, this.rows_, precedingSpace);
  }

  /**
   * @param {!Object} row
   */
  removeRow_(row) {
    const index = this.findEdge_(row, this.rows_);
    if (index !== null) {
      this.rows_.splice(index, 1);
    }
  }
}

class GridNode {
  /**
   * @param {!Grid} grid
   * @param {!Element} element
   * @param {?GridNode} parentNode
   * @param {!Object} leftEdge
   * @param {!Object} rightEdge
   * @param {!Object} topEdge
   * @param {!Object} bottomEdge
   */
  constructor(
      grid, element, parentNode, leftEdge, rightEdge, topEdge, bottomEdge) {
    this.grid_ = grid;
    this.element_ = element;
    this.id_ = this.grid_.makeNodeId_();
    this.parentNode_ = parentNode;
    this.bottomEdge_ = bottomEdge;
    this.leftEdge_ = leftEdge;
    this.rightEdge_ = rightEdge;
    this.topEdge_ = topEdge;

    this.firstChild_ = null;
    this.lastChild_ = null;

    this.element_.setAttribute('terminal-window-id', this.id_);
    this.setGridArea_();

    this.grid_.nodeCreated_(this.id_, this);
  }

  setGridArea_() {
    this.element_.style.gridArea = `${this.topEdge_.id} / ${
        this.leftEdge_.id} / ${this.bottomEdge_.id} / ${this.rightEdge_.id}`;
  }

  destructor_() {
    if (!this.isLeaf()) {
      this.firstChild_.destructor_();
      this.lastChild_.destructor_();
    }
    const par = this.parentNode_;
    const isSplitVertically_ =
        !par ? null : par.firstChild_.topEdge_ === par.lastChild_.topEdge_;
    if (isSplitVertically_ === true) {
      this.grid_.removeColumn_(
          par.firstChild_ === this ? this.rightEdge_ : this.leftEdge_);
    }
    if (isSplitVertically_ === false) {
      this.grid_.removeRow_(
          par.firstChild_ === this ? this.bottomEdge_ : this.topEdge_);
    }
    this.grid_.nodeRemoved_(this.id_);
  }

  /**
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

  destroy() {
    lib.assert(this.isLeaf());

    if (!this.parentNode_) {
      // Cannot destroy root
      return;
    }

    const sibling = this.parentNode_.firstChild_ === this ?
                        this.parentNode_.lastChild_ :
                        this.parentNode_.firstChild_;

    if (!this.parentNode_.parentNode_) {
      this.grid_.root = sibling;
    } else if (this.parentNode_.parentNode_.firstChild_ === this.parentNode_) {
      this.parentNode_.parentNode_.firstChild_ = sibling;
    } else {
      this.parentNode_.parentNode_.lastChild_ = sibling;
    }

    this.destructor_();
    this.grid_.nodeRemoved_(this.parentNode_.id_);

    sibling.parentNode_ = this.parentNode_.parentNode_;
    for (const edge of [
        (node, edge = node.bottomEdge_) => node.bottomEdge_ = edge,
        (node, edge = node.leftEdge_) => node.leftEdge_ = edge,
        (node, edge = node.rightEdge_) => node.rightEdge_ = edge,
        (node, edge = node.topEdge_) => node.topEdge_ = edge
    ]) {
      const removedEdge = edge(sibling);
      const parentEdge = edge(this.parentNode_);
      if (removedEdge === parentEdge) {
        continue;
      }
      const recurser = (node) => {
        if (edge(node) === removedEdge) {
          edge(node, parentEdge);
          if (node.isLeaf()) {
            node.setGridArea_();
          }
        }
        if (!node.isLeaf()) {
          recurser(node.firstChild_);
          recurser(node.lastChild_);
        }
      };
      recurser(sibling);
    }
  }

  /**
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
        lib.notNull(firstElement || this.element_),
        this,
        this.leftEdge_,
        this.rightEdge_,
        this.topEdge_,
        newEdge);
    this.lastChild_ = new GridNode(
        this.grid_,
        lib.notNull(lastElement || this.element_),
        this,
        this.leftEdge_,
        this.rightEdge_,
        newEdge,
        this.bottomEdge_);
    this.element_ = null;
  }

  /**
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
        lib.notNull(firstElement || this.element_),
        this,
        this.leftEdge_,
        newEdge,
        this.topEdge_,
        this.bottomEdge_);
    this.lastChild_ = new GridNode(
        this.grid_,
        lib.notNull(lastElement || this.element_),
        this,
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

  /** @param {string} slotId */
  destroySlot(slotId) {
    const windowEl = lib.notNull(
        this.shadowRoot.querySelector(`slot[name="${slotId}"]`).parentElement);
    const node = this.grid.getNodeFromElement(windowEl);

    if (node === this.grid.root) {
      return;
    }

    node.destroy();
    this.shadowRoot.getElementById('container').removeChild(windowEl);

    this.updateColumnLineIndices_();
    this.updateRowLineIndices_();
  }

  /** @override */
  disconnectedCallback() {
    // Cleanup grid as it is reasonably memory heavy.
    this.grid = null;
  }

  updateColumnLineIndices_() {
    this.shadowRoot.getElementById('container').style.gridTemplateColumns =
        this.grid.columns_.map((x, i, xs) => !i ? `[${x.id}]` : ` ${
          x.precedingSpace - xs[i - 1].precedingSpace}% [${x.id}]`).join(' ');
  }

  updateRowLineIndices_() {
    this.shadowRoot.getElementById('container').style.gridTemplateRows =
        this.grid.rows_.map((x, i, xs) => !i ? `[${x.id}]` : ` ${
          x.precedingSpace - xs[i - 1].precedingSpace}% [${x.id}]`).join(' ');
  }

  /** @param {!Event} event */
  onControlsClick_(event) {
    // |this| is the control element, not the host element.
    const host = this.getRootNode().host;

    if (!host.getAttribute('terminal-splits-enabled')) {
      return;
    }

    const existingNode = host.grid.getNodeFromElement(this.parentElement);

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

  /**
   * @param {string} id
   * @param {!Element} windowEl
   */
  addNewSlot_(id, windowEl) {
    this.shadowRoot.getElementById('container').appendChild(windowEl);

    this.dispatchEvent(
        new CustomEvent('terminal-window-ready', {detail: {slot: id}}));
  }
}
