// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Background Image Element unit tests.
 */

import {BACKGROUND_IMAGE_CONVERTER, TerminalSettingsBackgroundImageElement}
    from './terminal_settings_background_image.js';

describe('terminal_settings_background_image_tests.js', () => {
  const hubble = 'https://goo.gl/anedTK';
  const svgDataUrl = 'data:image/svg+xml;base64,' +
      'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';

  beforeEach(function() {
    window.preferenceManager =
      new lib.PreferenceManager(new lib.Storage.Memory());
    window.preferenceManager.definePreference('background-image', '');
    window.preferenceManager.definePreference('background-color', '#000');
    window.localStorage.removeItem('background-image');

    this.el = /** @type {!TerminalSettingsBackgroundImageElement} */ (
        document.createElement('terminal-settings-background-image'));
    document.body.appendChild(this.el);

    // The element renders asynchronously.
    return this.el.updateComplete;
  });

  afterEach(function() {
    document.body.removeChild(this.el);

    delete window.preferenceManager;
  });

  it('converts-background-image', async function() {
    const p2d = BACKGROUND_IMAGE_CONVERTER.preferenceToDisplay;
    assert.equal(p2d(null), '');
    assert.equal(p2d(''), '');
    assert.equal(p2d(' '), '');
    assert.equal(p2d('url(foo)'), 'foo');
    assert.equal(p2d('url("foo")'), 'foo');
    assert.equal(p2d("url('foo')"), 'foo');

    const d2p = BACKGROUND_IMAGE_CONVERTER.displayToPreference;
    assert.equal(d2p(''), '');
    assert.equal(d2p(' '), '');
    assert.equal(d2p('foo'), 'url(http://foo)');
    assert.equal(d2p('http://foo'), 'url(http://foo)');
    assert.equal(d2p('https://foo'), 'url(https://foo)');
  });

  it('updates-ui-when-preference-changes', async function() {
    assert.equal(window.preferenceManager.get('background-image'), '');
    assert.equal(this.el.imagePreviewSrc, null);

    await window.preferenceManager.set('background-image', `url(${hubble})`);
    assert.equal(this.el.imagePreviewSrc, hubble);
  });

  it('shows-pref-or-local-storage', async function() {
    window.localStorage.setItem('background-image', svgDataUrl);
    await window.preferenceManager.set('background-image', `url(${hubble})`);
    assert.equal(this.el.imagePreviewSrc, hubble);

    await window.preferenceManager.set('background-image', '');
    assert.equal(this.el.imagePreviewSrc, svgDataUrl);
  });

  it('shows-textfield-on-url-click', async function() {
    assert.isNull(this.el.querySelector('terminal-settings-textfield'));
    this.el.shadowRoot.querySelector('#bg-url').click();

    await this.el.updateComplete;
    assert.isNotNull(
        this.el.shadowRoot.querySelector('terminal-settings-textfield'));
  });

  it('clears-pref-and-storage-on-remove-click', async function() {
    window.localStorage.setItem('background-image', svgDataUrl);
    await window.preferenceManager.set('background-image', `url(${hubble})`);

    this.el.shadowRoot.querySelector('#bg-remove').click();

    await this.el.updateComplete;
    assert.isNull(window.localStorage.getItem('background-image'));
    assert.equal('', window.preferenceManager.get('background-image'));
  });

  it('shows-correct-elements', async function() {
    // No image is set.
    assert.isNull(
        this.el.shadowRoot.querySelector('terminal-settings-textfield'));
    assert.isNull(this.el.shadowRoot.querySelector('img'));
    assert.isNotNull(this.el.shadowRoot.querySelector('#bg-url'));
    assert.isNotNull(this.el.shadowRoot.querySelector('#bg-file'));
    assert.isNull(this.el.shadowRoot.querySelector('#bg-remove'));

    // Image from local storage.
    window.localStorage.setItem('background-image', svgDataUrl);
    this.el.preferenceChanged_('');
    await this.el.updateComplete;

    assert.isNull(
        this.el.shadowRoot.querySelector('terminal-settings-textfield'));
    assert.isNotNull(this.el.shadowRoot.querySelector('img'));
    assert.isNull(this.el.shadowRoot.querySelector('#bg-url'));
    assert.isNull(this.el.shadowRoot.querySelector('#bg-file'));
    assert.isNotNull(this.el.shadowRoot.querySelector('#bg-remove'));

    // Image from prefs.
    await window.preferenceManager.set('background-image', `url(${hubble})`);
    await this.el.updateComplete;

    assert.isNotNull(
        this.el.shadowRoot.querySelector('terminal-settings-textfield'));
    assert.isNotNull(this.el.shadowRoot.querySelector('img'));
    assert.isNull(this.el.shadowRoot.querySelector('#bg-url'));
    assert.isNull(this.el.shadowRoot.querySelector('#bg-file'));
    assert.isNotNull(this.el.shadowRoot.querySelector('#bg-remove'));
  });
});
