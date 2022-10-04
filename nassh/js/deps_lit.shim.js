// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Shim for rollup import.
 */

/**
 * lit-element is used for the terminal's settings page.
 * TODO(juwa@google.com): I know this isn't the correct place for this import,
 * and that it should be in the terminal directory. I am not sure how best to
 * accomplish this though, as the terminal app currently does not manage its
 * own dependencies, but instead includes nassh's.
 */
import {LitElement, html, css, unsafeCSS} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {live} from 'lit/directives/live.js';
import {createRef, ref} from 'lit/directives/ref.js';
import {when} from 'lit/directives/when.js';
const lit = {LitElement, classMap, css, createRef, html, ifDefined, live, ref,
  unsafeCSS, when};
export {lit};

import '@material/mwc-icon-button';
