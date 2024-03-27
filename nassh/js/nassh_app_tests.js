// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {lib} from '../../libdot/index.js';

import {App} from './nassh_app.js';

/**
 * @fileoverview Test suite for the App.
 */

describe('nassh_app_tests.js', () => {

/**
 * Create a stub app to test against.
 */
beforeEach(function() {
  this.storage = new lib.Storage.Memory();
  this.app = new App(this.storage);
});

/**
 * Smoke test for installOmnibox handler.
 */
it('omnibox-install', function() {
  /** @constructor */
  function EventMock() {
    this.addListener = (func) => { this.func = func; };
  }
  const omnibox = {
    setDefaultSuggestion: function(suggestion) {
      this.suggestion = suggestion;
    },
    onInputStarted: new EventMock(),
    onInputChanged: new EventMock(),
    onInputEntered: new EventMock(),
    onInputCancelled: new EventMock(),
  };
  this.app.installOmnibox(omnibox);

  assert.deepEqual(omnibox.suggestion, {description: 'OMNIBOX_DEFAULT'});
  assert.isDefined(omnibox.onInputStarted.func);
  assert.isDefined(omnibox.onInputChanged.func);
  assert.isDefined(omnibox.onInputEntered.func);
  assert.isDefined(omnibox.onInputCancelled.func);
});

/**
 * Verify OnInputStarted callback with initial (empty) settings.
 */
it('omnibox-input-started-null', function() {
  this.app.omniboxOnInputStarted_();
  assert.deepEqual([], this.app.omniMatches_);
  assert.isNull(this.app.omniDefault_);
});

/**
 * Verify OnInputStarted callback with a single profile.
 */
it('omnibox-input-started-profile', function() {
  const profile = this.app.prefs_.createProfile();
  const omniResult = {
    id: profile.id,
    uhp: 'root@localhost',
    desc: 'my desc',
  };
  profile.set('username', 'root');
  profile.set('hostname', 'localhost');
  profile.set('description', 'my desc');

  this.app.localPrefs_.set('connectDialog/lastProfileId', profile.id);
  this.app.omniboxOnInputStarted_();
  assert.deepStrictEqual([omniResult], this.app.omniMatches_);
  assert.deepStrictEqual(omniResult, this.app.omniDefault_);
});

/**
 * Verify OnInputChanged with no profiles.
 */
it('omnibox-input-changed-no-profiles', function() {
  this.app.omniboxOnInputStarted_();
  // Should be no matches.
  this.app.omniboxOnInputChanged_('xxx', (result) => { assert.fail(); });
});

/**
 * Verify OnInputChanged with no default profile.
 */
it('omnibox-input-changed-no-default', function() {
  const profile = this.app.prefs_.createProfile();
  profile.set('username', 'root');
  profile.set('hostname', 'localhost');
  profile.set('description', 'my desc');

  this.app.omniboxOnInputStarted_();
  // Should be no matches, not even the default.
  this.app.omniboxOnInputChanged_('xxx', (result) => { assert.fail(); });
});

/**
 * Verify OnInputChanged with default profile.
 */
it('omnibox-input-changed-default', function() {
  const profile = this.app.prefs_.createProfile();
  profile.set('username', 'root');
  profile.set('hostname', 'localhost');
  profile.set('description', 'my desc');

  this.app.localPrefs_.set('connectDialog/lastProfileId', profile.id);
  this.app.omniboxOnInputStarted_();
  // Should match the default profile.
  this.app.omniboxOnInputChanged_('xxx', (result) => {
    assert.deepStrictEqual([{
      content: `profile-id=${profile.id}`,
      description: 'root@localhost: my desc',
    }], result);
  });
});

/**
 * Verify OnInputChanged matching different ways.
 */
it('omnibox-input-changed-matching', function() {
  const profile = this.app.prefs_.createProfile();
  profile.set('username', 'root');
  profile.set('hostname', 'localhost');
  profile.set('description', 'my desc');

  this.app.localPrefs_.set('connectDialog/lastProfileId', profile.id);
  this.app.omniboxOnInputStarted_();
  // Empty text should match in all ways.
  this.app.omniboxOnInputChanged_('', (result) => {
    assert.equal(4, result.length);
  });
  // Username text should only match once.
  this.app.omniboxOnInputChanged_('root', (result) => {
    assert.equal(1, result.length);
  });
  // Partial description text should match once.
  this.app.omniboxOnInputChanged_('desc', (result) => {
    assert.equal(1, result.length);
  });
});

/**
 * Verify OnInputCancelled cleans up & restarts w/no profiles.
 */
it('omnibox-input-cancelled-no-profile', function() {
  // No profile.
  this.app.omniboxOnInputStarted_();
  this.app.omniboxOnInputChanged_('xxx', (result) => { assert.fail(); });
  this.app.omniboxOnInputCancelled_();

  assert.deepEqual([], this.app.omniMatches_);
  assert.isNull(this.app.omniDefault_);
});

/**
 * Verify OnInputCancelled cleans up & restarts w/one profile.
 */
it('omnibox-input-cancelled-profile-no-default', function() {
  const profile = this.app.prefs_.createProfile();
  profile.set('username', 'root');
  profile.set('hostname', 'localhost');
  profile.set('description', 'my desc');

  this.app.omniboxOnInputStarted_();
  this.app.omniboxOnInputChanged_('root', (result) => {
    assert.deepStrictEqual([{
      content: `profile-id=${profile.id}`,
      description: '<match>root@localhost</match>: my desc',
    }], result);
  });
  assert.equal(1, this.app.omniMatches_.length);
  assert.isNull(this.app.omniDefault_);
  this.app.omniboxOnInputCancelled_();

  assert.deepEqual([], this.app.omniMatches_);
  assert.isNull(this.app.omniDefault_);
});

/**
 * Verify OnInputCancelled cleans up & restarts w/one profile.
 */
it('omnibox-input-cancelled-profile-default', function() {
  const profile = this.app.prefs_.createProfile();
  profile.set('username', 'root');
  profile.set('hostname', 'localhost');
  profile.set('description', 'my desc');

  this.app.localPrefs_.set('connectDialog/lastProfileId', profile.id);
  this.app.omniboxOnInputStarted_();
  this.app.omniboxOnInputChanged_('root', (result) => {
    assert.deepStrictEqual([{
      content: `profile-id=${profile.id}`,
      description: '<match>root@localhost</match>: my desc',
    }], result);
  });
  assert.equal(1, this.app.omniMatches_.length);
  assert.isNotNull(this.app.omniDefault_);
  this.app.omniboxOnInputCancelled_();

  assert.deepEqual([], this.app.omniMatches_);
  assert.isNull(this.app.omniDefault_);
});

});
