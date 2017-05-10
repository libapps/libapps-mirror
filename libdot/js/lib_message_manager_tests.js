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
  result.assertEQ(node.getAttribute('tattr'), 'FOO');

  // Test $id handling.
  node.setAttribute('i18n', '{"tattr": "$id"}');
  mm.processI18nAttribute(node);
  result.assertEQ(node.getAttribute('tattr'), 'SPIC_AND_SPAN_TATTR');

  // Test _ handling for the textContent.
  node.setAttribute('i18n', '{"_": "THIS_IS_A_TEST"}');
  mm.processI18nAttribute(node);
  result.assertEQ(node.textContent, 'THIS_IS_A_TEST');

  // Test =attr handling.
  node.setAttribute('i18n', '{"tattr": "CONTENT", "tind": "=tattr"}');
  mm.processI18nAttribute(node);
  result.assertEQ(node.getAttribute('tattr'), 'CONTENT');
  result.assertEQ(node.getAttribute('tind'), 'CONTENT');

  result.pass();
});
