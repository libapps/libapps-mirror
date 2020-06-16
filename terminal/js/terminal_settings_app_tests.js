// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings App Element unit tests.
 */

import {BELL_SOUND_CONVERTER} from './terminal_settings_app.js';

describe('terminal_settings_app_tests.js', () => {
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
