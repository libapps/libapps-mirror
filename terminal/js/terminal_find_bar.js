// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Exports an element: terminal-find-bar
 *
 * @suppress {moduleLoad}
 */

import {hterm} from './deps_local.concat.js';

import {LitElement, createRef, css, html, ifDefined, ref, when} from './lit.js';
import {delayedScheduler} from './terminal_common.js';

// The find bar UI element. The user interact with it by calling the public
// methods and listening to "find-bar" events.
export class TerminalFindBar extends LitElement {
  /** @override */
  static get properties() {
    return {
      counter_: {
        state: true,
      },
      inputIsEmpty_: {
        state: true,
      },
    };
  }

  constructor() {
    super();

    this.counter_ = null;
    this.inputIsEmpty_ = true;
    this.inputRef_ = createRef();
    this.scheduleFindNextEvent_ = delayedScheduler(() => {
      this.fireFindEvent({backward: false});
    }, 300);
  }

  /** @override */
  static get styles() {
    return css`
        :host {
          display: none;
          align-items: center;
          border: 1px solid var(--google-grey-600);
          border-radius: 2px;
          box-shadow: 0 2px 2px 1px rgba(var(--google-grey-600-rgb), .1);
          background: white;
          padding: 5px 15px;
          width: 320px;
        }

        input {
          background-color: inherit;
          border: none;
          flex-grow: 1;
          margin: 8px 0;
          min-width: 100px;
          outline: none;
        }

        #counter {
          color: var(--google-grey-800);
          font-size: smaller;
          user-select: none;
        }

        #vertical-separator {
          align-self: stretch;
          border-left: 1px solid var(--google-grey-400);
          margin-left: 10px;
        }

        [role="button"] {
          align-items: center;
          border-radius: 50%;
          display: flex;
          flex-shrink: 0;
          height: 24px;
          justify-content: center;
          margin-left: 8px;
          transition: background-color 0.3s linear;
          width: 24px;
        }

        [role="button"]:not([aria-disabled="true"]):hover {
          background-color: var(--google-grey-200);
        }

        [role="button"]:not([aria-disabled="true"]):active {
          background-color: var(--google-grey-400);
          transition: background-color 0s;
        }

        [role="button"]:not([aria-disabled="true"]) > svg {
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
    const msg = hterm.messageManager.get.bind(hterm.messageManager);
    const searchButtonDisabled = this.inputIsEmpty_ ? 'true' : undefined;

    // TODO: Uses the icons from terminal_icons.js. We will need to scale them a
    // bit larger though. We should also consider using <mwc-icon-button>, but
    // I couldn't get it to display the image in the center when I tried it.
    return html`
        <input ${ref(this.inputRef_)} type="text" @input=${this.onInput_}
            @keydown=${this.onInputKeyDown_}
            aria-label=${msg('HTERM_BUTTON_FIND')}>
        ${when(!this.inputIsEmpty_ && !!this.counter_, () => html`
          <div id="counter">${this.counter_}</div>
        `)}

        <div id="vertical-separator" tabindex="-1"></div>

        <div role="button" tabindex="0"
            title=${msg('HTERM_BUTTON_PREVIOUS')}
            aria-label=${msg('HTERM_BUTTON_PREVIOUS')}
            aria-disabled=${ifDefined(searchButtonDisabled)}
            @click=${() => this.fireFindEvent({backward: true})}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M17.29 15.71L12 10.41l-5.29 5.3-1.42-1.42L12 7.59l6.71 6.7z"/><path fill="none" d="M0 0h24v24H0V0z"/></svg>
        </div>
        <div role="button" tabindex="0"
            title=${msg('HTERM_BUTTON_NEXT')}
            aria-label=${msg('HTERM_BUTTON_NEXT')}
            aria-disabled=${ifDefined(searchButtonDisabled)}
            @click=${() => this.fireFindEvent({backward: false})}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 16.41l-6.71-6.7 1.42-1.42 5.29 5.3 5.29-5.3 1.42 1.42z"/><path fill="none" d="M0 0h24v24H0V0z"/></svg>
        </div>
        <div role="button" tabindex="0"
            title=${msg('HTERM_BUTTON_CLOSE_FIND_BAR')}
            aria-label=${msg('HTERM_BUTTON_CLOSE_FIND_BAR')}
            @click=${this.close_}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/><path fill="none" d="M0 0h24v24H0V0z"/></svg>
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
    this.scheduleFindNextEvent_();
  }

  /**
   * @param {{backward: boolean}} arg
   * @private
   */
  fireFindEvent({backward}) {
    this.dispatchEvent(new CustomEvent('find-bar', {
      detail: {
        type: 'find',
        backward,
      },
    }));
  }

  /** @private */
  close_() {
    this.counter_ = null;
    this.style.display = 'none';
    this.dispatchEvent(new CustomEvent('find-bar', {
      detail: {
        type: 'close',
      },
    }));
  }

  show() {
    this.style.display = 'flex';
    setTimeout(() => {
      const input = this.inputRef_.value;
      input.select();
      input.focus();
    });
  }

  setCounter(index, count) {
    this.counter_ = `${index + 1}/${count}`;
  }

  /**
   * @param {!KeyboardEvent} e
   * @private
   */
  onInputKeyDown_(e) {
    console.log(e);
    switch (e.key) {
      case 'Enter':
        this.fireFindEvent({backward: e.shiftKey});
        e.preventDefault();
        break;
      case 'Escape':
        this.close_();
        e.preventDefault();
        break;
    }

    // Use `e.keyCode` to work the same as chrome with different languages and
    // keyboard layouts.
    switch (e.keyCode) {
      // 'g'
      case 71:
        if (e.ctrlKey) {
          this.fireFindEvent({backward: e.shiftKey});
          e.preventDefault();
        }
      break;
      // 'f'
      case 70:
        if (e.ctrlKey) {
          this.inputRef_.value.select();
          e.preventDefault();
        }
      break;
    }

    e.stopPropagation();
  }
}

customElements.define('terminal-find-bar', TerminalFindBar);
