// Copyright 2025 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Google prettier config settings.  Changes pulled from
 * google3/devtools/prettier/prettier.config.js.
 * @suppress {lintChecks} Doesn't like "export default"
 */

const shared = {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'preserve',
  bracketSpacing: false,
  trailingComma: 'all',
  arrowParens: 'always',
  embeddedLanguageFormatting: 'off',
  bracketSameLine: true,
  singleAttributePerLine: false,
  jsxSingleQuote: false,
  htmlWhitespaceSensitivity: 'strict',
};

const config = {
  overrides: [
    {
      /** TSX/TS/JS-specific configuration. */
      files: '*.tsx',
      options: shared,
    },
    {
      files: '*.ts',
      options: shared,
    },
    /* TODO(vapier): Enable.
    {
      files: '*.js',
      options: shared,
    },
    */
    {
      /** Sass-specific configuration. */
      files: '*.scss',
      options: {
        singleQuote: true,
      },
    },
    {
      files: '*.html',
      options: {
        printWidth: 100,
      },
    },
    {
      files: '*.html.in',
      options: {
        parser: 'html',
        printWidth: 100,
      },
    },
    {
      files: '*.acx.html',
      options: {
        parser: 'angular',
        singleQuote: true,
      },
    },
    {
      files: '*.ng.html',
      options: {
        parser: 'angular',
        embeddedLanguageFormatting: 'auto',
        singleQuote: true,
        printWidth: 100,
      },
    },
  ],
};

export default config;
