// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Background Image Element unit tests.
 */

import {lib} from './deps_local.concat.js';

import {TerminalSettingsBackgroundImageElement}
    from './terminal_settings_background_image.js';

const key = 'background-image-test';

describe('terminal_settings_background_image_tests.js', () => {
  const svgDataUrl = 'data:image/svg+xml;base64,' +
      'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';

  beforeEach(function() {
    window.preferenceManager = new lib.PreferenceManager(
      new lib.Storage.Memory(), '/hterm/profiles/test/');
    window.localStorage.removeItem(key);

    this.el = null;
    this.createElement = async function() {
      if (this.el) {
        document.body.removeChild(this.el);
      }
      this.el = /** @type {!TerminalSettingsBackgroundImageElement} */ (
          document.createElement('terminal-settings-background-image'));
      document.body.appendChild(this.el);

      // The element renders asynchronously.
      return this.el.updateComplete;
    };
  });

  afterEach(function() {
    if (this.el) {
      document.body.removeChild(this.el);
    }
    window.localStorage.removeItem(key);
  });

  it('shows-preview-local-storage-if-exists', async function() {
    await this.createElement();
    assert.equal(this.el.imagePreviewSrc_, '');

    window.localStorage.setItem(key, svgDataUrl);
    await this.createElement();
    assert.equal(this.el.imagePreviewSrc_, svgDataUrl);
  });

  it('clears-storage-and-preview-on-remove-click', async function() {
    window.localStorage.setItem(key, svgDataUrl);
    await this.createElement();

    this.el.shadowRoot.querySelector('#bg-remove').click();

    await this.el.updateComplete;
    assert.isNull(window.localStorage.getItem(key));
    assert.equal('', this.el.imagePreviewSrc_);
  });

  it('shows-correct-elements', async function() {
    // No image is set.
    await this.createElement();
    assert.isNotNull(this.el.shadowRoot.querySelector('#bg-select'));
    assert.isNull(this.el.shadowRoot.querySelector('img'));
    assert.isNull(this.el.shadowRoot.querySelector('#bg-remove'));

    // Image from local storage.
    window.localStorage.setItem(key, svgDataUrl);
    await this.createElement();

    assert.isNull(this.el.shadowRoot.querySelector('#bg-select'));
    assert.isNotNull(this.el.shadowRoot.querySelector('img'));
    assert.isNotNull(this.el.shadowRoot.querySelector('#bg-remove'));
  });

  it('updates-preview-and-local-storage-when-file-selected', async function() {
    await this.createElement();
    this.el.onFileLoad_(svgDataUrl);
    assert.equal(svgDataUrl, window.localStorage.getItem(key));
    assert.equal(svgDataUrl, this.el.imagePreviewSrc_);
  });
});
