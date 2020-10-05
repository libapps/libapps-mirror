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
    'html',
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
    'default-param-last': 'error',
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
    'no-case-declarations': 'error',
    'no-cond-assign': 'error',
    'no-const-assign': 'error',
    'no-control-regex': 'error',
    'no-debugger': 'error',
    'no-dupe-args': 'error',
    'no-dupe-class-members': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'no-empty': 'error',
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
    'no-multi-spaces': ['error', {'ignoreEOLComments': true}],
    'no-multiple-empty-lines': 'error',
    'no-new': 'error',
    'no-new-func': 'error',
    'no-new-object': 'error',
    'no-new-wrappers': 'error',
    'no-obj-calls': 'error',
    'no-octal': 'error',
    'no-octal-escape': 'error',
    'no-return-await': 'error',
    'no-script-url': 'error',
    'no-self-assign': 'error',
    'no-self-compare': 'error',
    'no-sequences': 'error',
    'no-shadow-restricted-names': 'error',
    'no-tabs': 'error',
    'no-template-curly-in-string': 'error',
    'no-throw-literal': 'error',
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
    'prefer-rest-params': 'error',
    'quote-props': ['error', 'consistent'],
    'quotes': ['error', 'single',
               {'avoidEscape': true, 'allowTemplateLiterals': true}],
    'radix': 'error',
    'rest-spread-spacing': 'error',
    'semi': ['error', 'always'],
    'semi-spacing': 'error',
    'semi-style': ['error', 'last'],
    'space-before-blocks': ['error', 'always'],
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
    'yield-star-spacing': ['error', 'after'],
    'yoda': 'error',

    'jsdoc/check-alignment': 'error',
    'jsdoc/check-examples': 'error',
    // We want hanging indentation, but this check requires none everywhere.
    'jsdoc/check-indentation': 'off',
    'jsdoc/check-param-names': 'error',
    // Make sure this is disabled as this rejects closure syntax.
    'jsdoc/check-syntax': 'off',
    'jsdoc/check-tag-names': 'error',
    // This is disabled until this crash is resolved:
    // https://github.com/gajus/eslint-plugin-jsdoc/issues/389
    'jsdoc/check-types': 'off',
    'jsdoc/implements-on-classes': 'error',
    'jsdoc/newline-after-description': 'error',
    // This is only for TypeScript which we don't care about.
    'jsdoc/no-types': 'off',
    // TODO(vapier): Turn this on.
    'jsdoc/require-description': 'off',
    // TODO(vapier): Turn this on.
    'jsdoc/require-description-complete-sentence': 'off',
    // We don't want to require examples.
    'jsdoc/require-example': 'off',
    'jsdoc/require-hyphen-before-param-description': ['error', 'never'],
    // TODO(vapier): Turn this on.
    'jsdoc/require-jsdoc': 'off',
    'jsdoc/require-param': 'error',
    // TODO(vapier): Turn this on.
    'jsdoc/require-param-description': 'off',
    'jsdoc/require-param-name': 'error',
    'jsdoc/require-param-type': 'error',
    'jsdoc/require-returns': 'error',
    'jsdoc/require-returns-check': 'error',
    // TODO(vapier): Turn this on.
    'jsdoc/require-returns-description': 'off',
    'jsdoc/require-returns-type': 'error',
    // This would be nice to turn on, but requires a lot more research.
    'jsdoc/valid-types': 'off',
  },

  'settings': {
    // https://github.com/BenoitZugmeyer/eslint-plugin-html#settings
    'html': {
      // TODO(vapier): Would like to use .html.in, but doesn't work right.
      // https://github.com/BenoitZugmeyer/eslint-plugin-html/issues/127
      'html-extensions': ['.html', '.in'],
    },

    // https://github.com/gajus/eslint-plugin-jsdoc#eslint-plugin-jsdoc
    'jsdoc': {
      'mode': 'closure',
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
        'yields': 'yield',

        // Stub out closure-specific tags so they get ignored.
        // TODO(vapier): Delete this after upgrade to newer jsdoc.
        'closurePrimitive': '',
      },
    },
  },
};
