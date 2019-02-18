// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Message manager test suite.
 */

lib.MessageManager.Tests = new lib.TestManager.Suite('lib.MessageManager.Tests');

/**
 * Run processI18nAttribute through tests.
 * Note: This relies on no message ids actually matching.
 */
lib.MessageManager.Tests.addTest('processI18nAttribute', function(result, cx) {
  var mm = new lib.MessageManager([]);
  var node = cx.window.document.createElement('span');
  node.setAttribute('id', 'spic-and-span');

  // Test missing i18n.
  mm.processI18nAttribute(node);

  // Test empty i18n.
  node.setAttribute('i18n', '');
  mm.processI18nAttribute(node);

  // Test empty i18n object.
  node.setAttribute('i18n', '{}');
  mm.processI18nAttribute(node);

  // Test direct message name.
  node.setAttribute('i18n', '{"tattr": "FOO"}');
  mm.processI18nAttribute(node);
  assert.equal(node.getAttribute('tattr'), 'FOO');

  // Test $id handling.
  node.setAttribute('i18n', '{"tattr": "$id"}');
  mm.processI18nAttribute(node);
  assert.equal(node.getAttribute('tattr'), 'SPIC_AND_SPAN_TATTR');

  // Test _ handling for the textContent.
  node.setAttribute('i18n', '{"_": "THIS_IS_A_TEST"}');
  mm.processI18nAttribute(node);
  assert.equal(node.textContent, 'THIS_IS_A_TEST');

  // Test =attr handling.
  node.setAttribute('i18n', '{"tattr": "CONTENT", "tind": "=tattr"}');
  mm.processI18nAttribute(node);
  assert.equal(node.getAttribute('tattr'), 'CONTENT');
  assert.equal(node.getAttribute('tind'), 'CONTENT');

  result.pass();
});

/**
 * Check addMessages behavior.
 */
lib.MessageManager.Tests.addTest('add-messages', function(result, cx) {
  const mm = new lib.MessageManager([]);

  mm.addMessages({
    'SOME_ID': {
      'description': 'This is goodness',
      'message': 'text',
    },
    'ID_REPLACE': {
      'message': 'foo $1 bar $2',
    },
  });
  assert.equal('text', mm.messages['SOME_ID']);
  assert.equal('foo $1 bar $2', mm.messages['ID_REPLACE']);

  result.pass();
});

/**
 * Verify get with registered messages work.
 */
lib.MessageManager.Tests.addTest('get-local', function(result, cx) {
  const mm = new lib.MessageManager([]);

  mm.addMessages({
    'SOME_ID': {
      'description': 'This is goodness',
      'message': 'text',
    },
    'ID_REPLACE': {
      'message': 'foo $1 bar $2',
    },
  });

  assert.equal('text', mm.get('SOME_ID'));
  assert.equal('text', mm.get('SOME_ID', []));
  assert.equal('text', mm.get('SOME_ID', [], 'not used'));
  assert.equal('foo', mm.get('UNKNOWN', [], 'foo'));
  assert.equal('foo X bar Y', mm.get('ID_REPLACE', ['X', 'Y']));

  result.pass();
});
