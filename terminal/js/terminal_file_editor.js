// Copyright 2022 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Implement <terminal-file-editor>
 */

import {LitElement, createRef, css, html, ref} from './lit.js';

/**
 * A text area element that binds to a file in `lib.fs`. Properties
 * `fileSystemPromise` and `path` must be set.
 */
class TerminalFileEditor extends LitElement {
  /** @override */
  static get properties() {
    return {
      fileSystemPromise: {
        attribute: false,
      },
      path: {
        type: String,
      },
    };
  }

  /** @override */
  static get styles() {
    return css`
        :host {
          border-radius: 4px;
          box-sizing: border-box;
          box-shadow: 0 0 0 1px rgba(0, 0, 0, .38);
          display: block;
          padding: 7px
        }

        :host(:hover) {
          box-shadow: 0 0 0 1px rgba(0, 0, 0, .81);
        }

        :host(:focus) {
          box-shadow: 0 0 0 2px var(--google-blue-600);
        }

        textarea {
          border: none;
          display: block;
          height: 100%;
          outline: none;
          resize: none;
          width: 100%;
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

    /** @type {!Promise<!FileSystem>} */
    this.fileSystemPromise;
    this.textareaRef_ = createRef();

    // This allows tests to inject mocks.
    this.libFs_ = lib.fs;
  }

  /** @override */
  render() {
    return html`
        <textarea ${ref(this.textareaRef_)}
            @change=${this.onChange_}></textarea>
    `;
  }

  async load() {
    let value = '';
    try {
      value = await this.libFs_.readFile(
          (await this.fileSystemPromise).root, this.path);
    } catch (e) {
      console.warn(
          `failed to read file ${this.path}. File does not exist? error:`, e);
    }
    this.textareaRef_.value.value = value;
  }

  async onChange_(e) {
    const value = e.target.value;
    this.libFs_.overwriteFile((await this.fileSystemPromise).root, this.path,
        value);
  }
}

customElements.define('terminal-file-editor', TerminalFileEditor);
