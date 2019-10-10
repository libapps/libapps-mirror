// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview exports lit element utilities.
 *
 * As nassh_deps.rollup.js is a compiled js file, it violates the linter in
 * numerous ways. As a consequnce, it must be suppressed and the types imported
 * from it in this file will be undefined, so must also be suppressed.
 *
 * @suppress {moduleLoad}
 */
import {litelement} from './nassh_deps.rollup.js';

/** @suppress {undefinedVars} */
const {LitElement, html, css} = litelement;

export {LitElement, html, css};
