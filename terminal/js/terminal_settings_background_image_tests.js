// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Background Image Element unit tests.
 */

import {BACKGROUND_IMAGE_CONVERTER, TerminalSettingsBackgroundImageElement}
    from './terminal_settings_background_image.js';

describe('terminal_settings_background_image_tests.js', () => {
  const hubble = 'https://www.google.com/earth/images/hubble_crab_neb-lg.jpg';
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
    assert.equal('', this.el.imagePreviewSrc);

    await window.preferenceManager.set('background-image', `url(${hubble})`);
    assert.equal(this.el.imagePreviewSrc, hubble);
  });

  it('shows-preview-local-storage-if-exists-else-pref', async function() {
    await window.preferenceManager.set('background-image', `url(${hubble})`);
    assert.equal(this.el.imagePreviewSrc, hubble);
    await window.preferenceManager.set('background-image', '');
    assert.equal(this.el.imagePreviewSrc, '');

    window.localStorage.setItem('background-image', svgDataUrl);
    await window.preferenceManager.set('background-image', `url(${hubble})`);
    assert.equal(this.el.imagePreviewSrc, svgDataUrl);
  });

  it('clears-pref-and-storage-and-preview-on-remove-click', async function() {
    window.localStorage.setItem('background-image', svgDataUrl);
    await window.preferenceManager.set('background-image', `url(${hubble})`);

    this.el.shadowRoot.querySelector('#bg-remove').click();

    await this.el.updateComplete;
    assert.isNull(window.localStorage.getItem('background-image'));
    assert.equal('', window.preferenceManager.get('background-image'));
    assert.equal('', this.el.imagePreviewSrc);
  });

  it('shows-correct-elements', async function() {
    // No image is set.
    assert.isNotNull(this.el.shadowRoot.querySelector('#bg-select'));
    assert.isNull(this.el.shadowRoot.querySelector('img'));
    assert.isNull(this.el.shadowRoot.querySelector('#bg-remove'));

    // Image from local storage.
    window.localStorage.setItem('background-image', svgDataUrl);
    this.el.preferenceChanged_('');
    await this.el.updateComplete;

    assert.isNull(this.el.shadowRoot.querySelector('#bg-select'));
    assert.isNotNull(this.el.shadowRoot.querySelector('img'));
    assert.isNotNull(this.el.shadowRoot.querySelector('#bg-remove'));
    window.localStorage.removeItem('background-image');

    // Image from prefs.
    await window.preferenceManager.set('background-image', `url(${hubble})`);
    await this.el.updateComplete;

    assert.isNull(this.el.shadowRoot.querySelector('#bg-select'));
    assert.isNotNull(this.el.shadowRoot.querySelector('img'));
    assert.isNotNull(this.el.shadowRoot.querySelector('#bg-remove'));
  });

  it('restores-pref-on-cancel', async function() {
    await window.preferenceManager.set('background-image', `url(${hubble})`);
    assert.equal(
        `url(${hubble})`, window.preferenceManager.get('background-image'));
    await this.el.updateComplete;

    this.el.openDialog();
    const prefChanged1 = test.listenForPrefChange(
        window.preferenceManager, 'background-image');
    const textfield =
        this.el.shadowRoot.querySelector('terminal-settings-textfield')
            .shadowRoot.querySelector('terminal-textfield');
    textfield.value = 'foo';
    textfield.dispatchEvent(new Event('change'));
    await prefChanged1;
    assert.equal('url(http://foo)', window.preferenceManager.get('background-image'));

    const prefChanged2 = test.listenForPrefChange(
        window.preferenceManager, 'background-image');
    this.el.shadowRoot.querySelector('terminal-settings-button.cancel').click();
    await prefChanged2;
    assert.equal(
        `url(${hubble})`, window.preferenceManager.get('background-image'));
  });

  it('clears-pref-and-updates-preview-when-local-selected', async function() {
    await window.preferenceManager.set('background-image', `url(${hubble})`);
    assert.equal(
        `url(${hubble})`, window.preferenceManager.get('background-image'));
    await this.el.updateComplete;

    this.el.onFileLoad_(svgDataUrl);
    assert.equal('', window.preferenceManager.get('background-image'));
    assert.equal(svgDataUrl, this.el.imagePreviewSrc);
  });

  it('clears-local-and-updates-preview-when-pref-set', async function() {
    window.localStorage.setItem('background-image', svgDataUrl);
    this.el.value = `url(${hubble})`;
    this.el.onOk_();
    assert.isNull(window.localStorage.getItem('background-image'));
    assert.equal(hubble, this.el.imagePreviewSrc);
  });
});
