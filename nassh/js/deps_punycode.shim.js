// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Shim for rollup import.
 */

/**
 * punycode is used to connect to internationalized (UTF-8) domain names.
 */
import {toASCII} from 'punycode';
const punycode = {toASCII};
export {punycode};
