// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../../libdot/index.js';

import {OmniboxHandler} from './nassh_omnibox.js';

/**
 * @fileoverview Test suite for the omnibox wrapper.
 */

/** @constructor */
function EventMock() {
  this.addListener = (func) => { this.func = func; };
}

/**
 * Create a stub app to test against.
 */
beforeEach(function() {
  this.omnibox = /** @type {!typeof chrome.omnibox} */({
    setDefaultSuggestion: function(suggestion) {
      this.suggestion = suggestion;
    },
    onInputStarted: new EventMock(),
    onInputChanged: new EventMock(),
    onInputEntered: new EventMock(),
    onInputCancelled: new EventMock(),
  });
  this.handler = new OmniboxHandler({
    omnibox: this.omnibox,
    storage: new lib.Storage.Memory(),
  });
});

/**
 * Smoke test for installOmnibox handler.
 */
it('install', async function() {
  await this.handler.install();

  const omnibox = this.omnibox;
  assert.deepEqual(omnibox.suggestion, {description: 'OMNIBOX_DEFAULT'});
  assert.isDefined(omnibox.onInputStarted.func);
  assert.isDefined(omnibox.onInputChanged.func);
  assert.isDefined(omnibox.onInputEntered.func);
  assert.isDefined(omnibox.onInputCancelled.func);
});

/**
 * Verify OnInputStarted callback with initial (empty) settings.
 */
it('input-started-null', function() {
  this.handler.onInputStarted_();
  assert.deepEqual([], this.handler.matches_);
  assert.isNull(this.handler.default_);
});

/**
 * Verify OnInputStarted callback with a single profile.
 */
it('input-started-profile', function() {
  const profile = this.handler.prefs_.createProfile();
  const omniResult = {
    id: profile.id,
    uhp: 'root@localhost',
    desc: 'my desc',
  };
  profile.set('username', 'root');
  profile.set('hostname', 'localhost');
  profile.set('description', 'my desc');

  this.handler.localPrefs_.set('connectDialog/lastProfileId', profile.id);
  this.handler.onInputStarted_();
  assert.deepStrictEqual([omniResult], this.handler.matches_);
  assert.deepStrictEqual(omniResult, this.handler.default_);
});

/**
 * Verify OnInputChanged with no profiles.
 */
it('input-changed-no-profiles', function() {
  this.handler.onInputStarted_();
  // Should be no matches.
  this.handler.onInputChanged_('xxx', (result) => { assert.fail(); });
});

/**
 * Verify OnInputChanged with no default profile.
 */
it('input-changed-no-default', function() {
  const profile = this.handler.prefs_.createProfile();
  profile.set('username', 'root');
  profile.set('hostname', 'localhost');
  profile.set('description', 'my desc');

  this.handler.onInputStarted_();
  // Should be no matches, not even the default.
  this.handler.onInputChanged_('xxx', (result) => { assert.fail(); });
});

/**
 * Verify OnInputChanged with default profile.
 */
it('input-changed-default', function() {
  const profile = this.handler.prefs_.createProfile();
  profile.set('username', 'root');
  profile.set('hostname', 'localhost');
  profile.set('description', 'my desc');

  this.handler.localPrefs_.set('connectDialog/lastProfileId', profile.id);
  this.handler.onInputStarted_();
  // Should match the default profile.
  this.handler.onInputChanged_('xxx', (result) => {
    assert.deepStrictEqual([{
      content: `profile-id=${profile.id}`,
      description: 'root@localhost: my desc',
    }], result);
  });
});

/**
 * Verify OnInputChanged matching different ways.
 */
it('input-changed-matching', function() {
  const profile = this.handler.prefs_.createProfile();
  profile.set('username', 'root');
  profile.set('hostname', 'localhost');
  profile.set('description', 'my desc');

  this.handler.localPrefs_.set('connectDialog/lastProfileId', profile.id);
  this.handler.onInputStarted_();
  // Empty text should match in all ways.
  this.handler.onInputChanged_('', (result) => {
    assert.equal(4, result.length);
  });
  // Username text should only match once.
  this.handler.onInputChanged_('root', (result) => {
    assert.equal(1, result.length);
  });
  // Partial description text should match once.
  this.handler.onInputChanged_('desc', (result) => {
    assert.equal(1, result.length);
  });
});

/**
 * Verify OnInputCancelled cleans up & restarts w/no profiles.
 */
it('input-cancelled-no-profile', function() {
  // No profile.
  this.handler.onInputStarted_();
  this.handler.onInputChanged_('xxx', (result) => { assert.fail(); });
  this.handler.onInputCancelled_();

  assert.deepEqual([], this.handler.matches_);
  assert.isNull(this.handler.default_);
});

/**
 * Verify OnInputCancelled cleans up & restarts w/one profile.
 */
it('input-cancelled-profile-no-default', function() {
  const profile = this.handler.prefs_.createProfile();
  profile.set('username', 'root');
  profile.set('hostname', 'localhost');
  profile.set('description', 'my desc');

  this.handler.onInputStarted_();
  this.handler.onInputChanged_('root', (result) => {
    assert.deepStrictEqual([{
      content: `profile-id=${profile.id}`,
      description: '<match>root@localhost</match>: my desc',
    }], result);
  });
  assert.equal(1, this.handler.matches_.length);
  assert.isNull(this.handler.default_);
  this.handler.onInputCancelled_();

  assert.deepEqual([], this.handler.matches_);
  assert.isNull(this.handler.default_);
});

/**
 * Verify OnInputCancelled cleans up & restarts w/one profile.
 */
it('input-cancelled-profile-default', function() {
  const profile = this.handler.prefs_.createProfile();
  profile.set('username', 'root');
  profile.set('hostname', 'localhost');
  profile.set('description', 'my desc');

  this.handler.localPrefs_.set('connectDialog/lastProfileId', profile.id);
  this.handler.onInputStarted_();
  this.handler.onInputChanged_('root', (result) => {
    assert.deepStrictEqual([{
      content: `profile-id=${profile.id}`,
      description: '<match>root@localhost</match>: my desc',
    }], result);
  });
  assert.equal(1, this.handler.matches_.length);
  assert.isNotNull(this.handler.default_);
  this.handler.onInputCancelled_();

  assert.deepEqual([], this.handler.matches_);
  assert.isNull(this.handler.default_);
});
