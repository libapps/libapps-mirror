// Copyright 2017 The Chromium OS Authors. All rights reserved.
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

  'plugins': [
    'jsdoc',
  ],

  // See https://eslint.org/docs/rules/ for details.
  // These rules were picked based on the existing codebase.  If you find one
  // to be too onerous and not required by the styleguide, feel free to discuss.
  'rules': {
    'array-bracket-spacing': 'error',
    'arrow-parens': ['error', 'always'],
    'arrow-spacing': ['error', {'before': true, 'after': true}],
    'block-spacing': ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
    'comma-spacing': 'error',
    'comma-style': 'error',
    'curly': 'error',
    'eol-last': 'error',
    'func-call-spacing': 'error',
    'generator-star-spacing': ['error', 'after'],
    // l/I: Depending on the font, these are hard to distinguish.
    'id-blacklist': ['error', 'l', 'I', 'self'],
    'keyword-spacing': 'error',
    'lines-between-class-members': 'error',
    'max-len': ['error', {'code': 80, 'ignoreUrls': true}],
    'new-parens': 'error',
    'no-alert': 'error',
    'no-cond-assign': 'error',
    'no-const-assign': 'error',
    'no-control-regex': 'error',
    'no-debugger': 'error',
    'no-dupe-args': 'error',
    'no-dupe-class-members': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'no-empty-character-class': 'error',
    'no-eval': 'error',
    'no-ex-assign': 'error',
    // We want 'all' (nestedBinaryExpressions=false), but this breaks
    // closure-compiler casts.
    'no-extra-parens': ['error', 'functions'],
    'no-extra-semi': 'error',
    'no-implied-eval': 'error',
    'no-invalid-regexp': 'error',
    'no-irregular-whitespace': 'error',
    'no-label-var': 'error',
    'no-mixed-spaces-and-tabs': 'error',
    'no-multiple-empty-lines': 'error',
    'no-new': 'error',
    'no-new-func': 'error',
    'no-new-object': 'error',
    'no-new-wrappers': 'error',
    'no-octal-escape': 'error',
    'no-return-await': 'error',
    'no-script-url': 'error',
    'no-self-assign': 'error',
    'no-self-compare': 'error',
    'no-sequences': 'error',
    'no-shadow-restricted-names': 'error',
    'no-tabs': 'error',
    'no-template-curly-in-string': 'error',
    'no-trailing-spaces': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unneeded-ternary': 'error',
    'no-unreachable': 'error',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-useless-escape': 'error',
    'no-useless-return': 'error',
    'no-var': 'error',
    'no-void': 'error',
    // We allow TODO comments.
    'no-warning-comments': [
      'error', {
        'terms': ['fix', 'fixme', 'xxx'],
      },
    ],
    'no-whitespace-before-property': 'error',
    'no-with': 'error',
    'object-curly-newline': ['error', {'consistent': true}],
    'object-curly-spacing': 'error',
    'one-var-declaration-per-line': 'error',
    'prefer-const': 'error',
    'prefer-numeric-literals': 'error',
    'quote-props': ['error', 'consistent'],
    'quotes': ['error', 'single',
               {'avoidEscape': true, 'allowTemplateLiterals': true}],
    'radix': 'error',
    'rest-spread-spacing': 'error',
    'semi': ['error', 'always'],
    'semi-spacing': 'error',
    'semi-style': ['error', 'last'],
    'space-before-function-paren': [
      'error', {
        'anonymous': 'never',
        'named': 'never',
        'asyncArrow': 'always',
      },
    ],
    'space-in-parens': ['error', 'never'],
    'space-infix-ops': 'error',
    'space-unary-ops': 'error',
    'spaced-comment': ['error', 'always'],
    'switch-colon-spacing': ['error', {'after': true, 'before': false}],
    'symbol-description': 'error',
    'template-curly-spacing': ['error', 'never'],
    'unicode-bom': ['error', 'never'],
    'use-isnan': 'error',
    'valid-typeof': 'error',
    'yoda': 'error',

    'jsdoc/check-alignment': 2,
    'jsdoc/check-examples': 2,
    // We want hanging indentation, but this check requires none everywhere.
    'jsdoc/check-indentation': 0,
    'jsdoc/check-param-names': 2,
    // Make sure this is disabled as this rejects closure syntax.
    'jsdoc/check-syntax': 0,
    'jsdoc/check-tag-names': 2,
    // This is disabled until this crash is resolved:
    // https://github.com/gajus/eslint-plugin-jsdoc/issues/389
    'jsdoc/check-types': 0,
    'jsdoc/implements-on-classes': 2,
    'jsdoc/newline-after-description': 2,
    // This is only for TypeScript which we don't care about.
    'jsdoc/no-types': 0,
    // TODO(vapier): Turn this on.
    'jsdoc/require-description': 0,
    // TODO(vapier): Turn this on.
    'jsdoc/require-description-complete-sentence': 0,
    // We don't want to require examples.
    'jsdoc/require-example': 0,
    'jsdoc/require-hyphen-before-param-description': ['error', 'never'],
    // TODO(vapier): Turn this on.
    'jsdoc/require-jsdoc': 0,
    'jsdoc/require-param': 1,
    // TODO(vapier): Turn this on.
    'jsdoc/require-param-description': 0,
    'jsdoc/require-param-name': 2,
    'jsdoc/require-param-type': 2,
    'jsdoc/require-returns': 2,
    'jsdoc/require-returns-check': 2,
    // TODO(vapier): Turn this on.
    'jsdoc/require-returns-description': 0,
    'jsdoc/require-returns-type': 2,
    // This would be nice to turn on, but requires a lot more research.
    'jsdoc/valid-types': 0,
  },

  'settings': {
    'jsdoc': {
      'preferredTypes': {
        'object': 'Object',
      },
      'tagNamePreference': {
        // While not explicitly defined, Google/Chromium JS style guides only
        // use these keyword forms, as does the closure compiler docs.
        'augments': 'extends',
        'constant': 'const',
        'class': 'constructor',
        'file': 'fileoverview',
        'returns': 'return',

        // Stub out closure-specific tags so they get ignored.
        'closurePrimitive': '',
        'suppress': '',
      },
    },
  },
};
