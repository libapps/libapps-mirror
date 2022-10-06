// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview exports lit element utilities.
 *
 * As the rollup ouput is a compiled js file, it violates the linter in
 * numerous ways. As a consequnce, it must be suppressed and the types imported
 * from it in this file will be undefined, so must also be suppressed.
 *
 * @suppress {moduleLoad}
 */

import {lit} from './deps_lit.rollup.js';

/** @suppress {undefinedVars} */
export const {LitElement, classMap, createRef, css, html, ifDefined, live, ref,
  unsafeCSS, when} = lit;
