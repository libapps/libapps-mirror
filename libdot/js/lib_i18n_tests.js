// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview i18n functions test suite.
 */

describe('lib_i18n_tests.js', () => {

/**
 * Basic sanity test.  Hard to validate real values here.
 */
it('getAcceptLanguages', (done) => {
  // Just make sure we're called with an array of some sort.
  lib.i18n.getAcceptLanguages((langs) => {
    assert.isTrue(Array.isArray(langs));
    done();
  });
});

/**
 * Basic sanity test.  Hard to validate real values here.
 */
it('getMessage', () => {
  // There shouldn't be any registered messages.
  assert.equal('', lib.i18n.getMessage('ID'));

  // Check fallback message.
  assert.equal('yes', lib.i18n.getMessage('ID', null, 'yes'));
});

/**
 * Check replacements happen as expected.
 *
 * We don't bother checking lib.i18n.getMessage.
 */
it('replaceReferences', () => {
  // Empty substitutions.
  assert.equal('foba', lib.i18n.replaceReferences('fo$1ba', null));
  assert.equal('foba', lib.i18n.replaceReferences('fo$1ba', undefined));
  assert.equal('foba', lib.i18n.replaceReferences('fo$1ba', []));

  // Too few substitutions.
  assert.equal('foXbar', lib.i18n.replaceReferences('fo$1ba$2r', ['X']));
});

/**
 * Check resolution of languages.
 */
it('resolveLanguage', () => {
  [
    ['es-RR', ['es_419']],
    ['es-ES', ['es']],
    ['es', ['es']],
    ['pt-RR', ['pt_PT']],
    ['pt-BR', ['pt_BR']],
    ['pt', ['pt_BR']],
    ['zh-TW', ['zh_TW']],
    ['zh-HK', ['zh_TW']],
    ['zh-MO', ['zh_TW']],
    ['zh-RR', ['zh_CN']],
    ['zh', ['zh_CN']],
    ['en-AU', ['en_GB']],
    ['en-CA', ['en_GB']],
    ['en-IN', ['en_GB']],
    ['en-NZ', ['en_GB']],
    ['en-ZA', ['en_GB']],
    ['en-US', ['en']],
    ['en-RR', ['en']],
    ['en', ['en']],
    ['de-DE', ['de_DE', 'de']],
    ['ll-RR', ['ll_RR', 'll']],
  ].forEach(([input, exp]) =>
      assert.deepEqual(exp, lib.i18n.resolveLanguage(input)));
});

});
