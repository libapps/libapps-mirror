// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-button.
 *
 * @suppress {moduleLoad}
 */

import {LitElement, css, html, ifDefined} from './lit.js';

export class TerminalButtonElement extends LitElement {
  /** @override */
  static get properties() {
    return {
      ariaLabel: {
        type: String,
      },
      disabled: {
        type: Boolean,
      },
    };
  }

  /** @override */
  static get styles() {
    // The styling follows chrome's <cr-button>
    return css`
        :host {
          --button-bg: var(--cros-bg-color);
          --button-bg-action: var(--cros-button-background-color-primary);
          --button-border-color: var(--cros-button-stroke-color-secondary);
          --button-hover-bg:
            var(--cros-button-background-color-secondary-hover);
          --button-hover-bg-action:
            rgba(var(--cros-button-background-color-primary-rgb), .9);
          --button-text-color: var(--cros-button-label-color-secondary);
          --button-text-color-action: var(--cros-button-label-color-primary);
          --button-disabled-bg-action:
            var(--cros-button-background-color-primary-disabled);
          --button-disabled-bg:
            var(--cros-button-stroke-color-secondary-disabled);
          --button-disabled-border-color:
            var(--cros-button-stroke-color-secondary-disabled);
          --button-disabled-text-color:
            var(--cros-button-label-color-secondary-disabled);
          --button-focus-shadow-color: var(--cros-color-prominent);
        }

        button {
          background-color: var(--button-bg);
          border: 1px solid var(--button-border-color);
          border-radius: 4px;
          color: var(--button-text-color);
          cursor: pointer;
          font-family: var(--cros-body-1-font-family);
          font-weight: 500;
          min-width: 5.14em;
          outline: none;
          padding: 7px 15px;
        }

        button:focus-visible {
          box-shadow: 0 0 0 2px var(--button-focus-shadow-color);
        }

        button:hover {
          background-color: var(--button-hover-bg);
        }

        :host(.action) > button {
          background-color: var(--button-bg-action);
          color: var(--button-text-color-action);
        }

        :host(.action) > button:hover {
          background-color: var(--button-hover-bg-action);
        }

        :host(.cancel) {
          margin-inline-end: 8px;
        }

        :host([disabled]) > button {
          background-color: var(--button-disabled-bg);
          border-color: var(--button-disabled-border-color);
          color: var(--button-disabled-text-color);
          cursor: auto;
          pointer-events: none;
        }

        :host(.action[disabled]) > button {
          background-color: var(--button-disabled-bg-action);
          border-color: transparent;
        }
    `;
  }

  /** @override */
  static get shadowRootOptions() {
    return {
      ...super.shadowRootOptions,
      delegatesFocus: true,
    };
  }

  constructor() {
    super();
    this.ariaLabel = undefined;
    this.disabled = false;
  }

  /** @override */
  render() {
    return html`
      <button aria-label="${ifDefined(this.ariaLabel)}">
        <slot></slot>
      </button>`;
  }

  /** @override */
  updated() {
    this.setAttribute('aria-disabled', `${this.disabled}`);
  }
}

customElements.define('terminal-button', TerminalButtonElement);
