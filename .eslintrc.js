// Copyright 2017 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

module.exports = {
  'root': true,
  'env': {
    'browser': true,
    // This allows the runtime environment (i.e. objects).
    'es6': true,
  },
  'parserOptions': {
    // This sets the syntax parsing level.
    'ecmaVersion': 2018,
    'sourceType': 'module',
  },
  'rules': {
    // Enabled checks.
    'no-extra-semi': 'error',
    'no-new-wrappers': 'error',
    'semi': ['error', 'always'],
  },
};
