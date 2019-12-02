// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-find-bar
 *
 * @suppress {moduleLoad}
 */
import {css, html, LitElement} from './lit_element.js';

export class TerminalFindBar extends LitElement {
  /** @override */
  static get properties() {
    return {
      inputIsEmpty_: {
        type: Boolean,
        attribute: false,
      }
    };
  }

  constructor() {
    super();

    this.inputIsEmpty_ = true;
  }

  /** @override */
  static get styles() {
    // TODO(lxj@google.com): we should consider putting the "--google--..."
    // css variables in a shared file. Potentially, we should just copy
    // "shared_vars_css.html" from chrome.
    return css`
        :host {
          --google-grey-200-rgb: 232, 234, 237;  /* #e8eaed */
          --google-grey-200: rgb(var(--google-grey-200-rgb));
          --google-grey-400-rgb: 189, 193, 198;  /* #bdc1c6 */
          --google-grey-400: rgb(var(--google-grey-400-rgb));
          --google-grey-600-rgb: 128, 134, 139;  /* #80868b */
          --google-grey-600: rgb(var(--google-grey-600-rgb));
          --google-grey-800-rgb: 60, 64, 67;  /* #3c4043 */
          --google-grey-800: rgb(var(--google-grey-800-rgb));
        }

        #root {
          align-items: center;
          border: 1px solid var(--google-grey-600);
          border-radius: 2px;
          box-shadow: 0 2px 2px 1px rgba(var(--google-grey-600-rgb), .1);
          background: white;
          display: flex;
          padding: 5px 15px;
        }

        input {
          border: 0;
          margin: 8px 0;
          outline: none;
          width: 200px;
        }

        #vertical-separator {
          align-self: stretch;
          border-left: 1px solid var(--google-grey-400);
          margin-left: 10px;
        }

        .button {
          align-items: center;
          border-radius: 50%;
          display: flex;
          height: 24px;
          justify-content: center;
          margin-left: 8px;
          transition: background-color 0.3s linear;
          width: 24px;
        }

        .button.enabled:hover {
          background-color: var(--google-grey-200);
        }

        .button.enabled:active {
          background-color: var(--google-grey-400);
          transition: background-color 0s;
        }

        .button.enabled > svg {
          fill: var(--google-grey-800);
        }

        svg {
          width: 16px;
          height: 16px;
          fill: var(--google-grey-400);
        }
    `;
  }

  /** @override */
  render() {
    const nextPreviousButtonClass =
        this.inputIsEmpty_ ? "button" : "button enabled";

    // TODO(lxj@google.com): i18n the accessibility label
    return html`
        <div id="root">
          <input type="text" @input=${this.onInput_}
              @keydown=${this.onInputKeyDown_} aria-label="find">
          <div id="vertical-separator" tabindex="-1"></div>
          <div class="${nextPreviousButtonClass}" @click=${this.onFindPrevious_}
              role="button" aria-label="previous">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M17.29 15.71L12 10.41l-5.29 5.3-1.42-1.42L12 7.59l6.71 6.7z"/><path fill="none" d="M0 0h24v24H0V0z"/></svg>
          </div>
          <div class="${nextPreviousButtonClass}" @click=${this.onFindNext_}
              role="button" aria-label="next">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 16.41l-6.71-6.7 1.42-1.42 5.29 5.3 5.29-5.3 1.42 1.42z"/><path fill="none" d="M0 0h24v24H0V0z"/></svg>
          </div>
          <div class="button enabled" @click=${this.onCloseClick_}
              role="button" aria-label="close find bar">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/><path fill="none" d="M0 0h24v24H0V0z"/></svg>
          </div>
        </div>
    `;
  }

  /**
   * @return {string}
   */
  get value() {
    return this.shadowRoot.querySelector('input').value;
  }

  /**
   * @param {!InputEvent} event
   * @private
   */
  onInput_(event) {
    this.inputIsEmpty_ = !event.target.value;
  }

  /**
   * @param {string} type Either "find-next" or "find-previous".
   * @private
   */
  fireFindEventIfHasValue_(type) {
    const value = this.value;
    if (value) {
      this.dispatchEvent(new CustomEvent('find-bar-event', {
        detail: {
          type: type,
          value,
        }
      }));
    }
  }

  /** @private */
  onFindPrevious_() {
    this.fireFindEventIfHasValue_('find-previous');
  }

  /** @private */
  onFindNext_() {
    this.fireFindEventIfHasValue_('find-next');
  }

  /** @private */
  onCloseClick_() {
    this.dispatchEvent(new CustomEvent('find-bar-event', {
      detail: {
        type: 'close'
      }
    }));
  }

  /**
   * @param {!KeyboardEvent} event
   * @private
   */
  onInputKeyDown_(event) {
    if (event.key == 'Enter') {
      if (event.shiftKey) {
        this.onFindPrevious_();
      } else {
        this.onFindNext_();
      }
      event.preventDefault();
    }
  }
}

customElements.define('terminal-find-bar', TerminalFindBar);
