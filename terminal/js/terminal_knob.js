// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.


/**
 * @fileoverview Exports an element: terminal-knob
 *
 * @suppress {moduleLoad}
 */
import {LitElement, css} from './lit.js';

export class TerminalKnob extends LitElement {
  /** @override */
  static get styles() {
    return css`
        :host {
          cursor: pointer;
          display: block;
          border-radius: 100%;
          border: 3px solid var(--cros-bg-color);
          box-shadow: 0 0 0 1px var(--cros-button-stroke-color-secondary);
          box-sizing: border-box;
          height: 32px;
          outline: none;
          transform: translate(-50%, -50%);
          width: 32px;
        }

        :host(:focus-visible), :host-context(terminal-slider[focusVisible]) {
          box-shadow: 0 0 0 3px var(--cros-color-prominent),
                      0 0 0 1px var(--cros-color-secondary);
        }
    `;
  }
}

customElements.define('terminal-knob', TerminalKnob);
