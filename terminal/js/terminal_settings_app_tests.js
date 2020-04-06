// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings App Element unit tests.
 */

import {BACKGROUND_IMAGE_CONVERTER, BELL_SOUND_CONVERTER}
    from './terminal_settings_app.js';

describe('terminal_settings_app_tests.js', () => {
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

  it('converts-bell-sound', () => {
    const toChecked = BELL_SOUND_CONVERTER.toChecked;
    assert.isTrue(toChecked('lib-resource:hterm/audio/bell'));
    assert.isTrue(toChecked('foo'));
    assert.isFalse(toChecked(null));
    assert.isFalse(toChecked(''));

    const fromChecked = BELL_SOUND_CONVERTER.fromChecked;
    assert.equal(fromChecked(true), 'lib-resource:hterm/audio/bell');
    assert.equal(fromChecked(false), '');
  });
});
