// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Shim for rollup import.
 */

/**
 * indexeddb-fs is used to provide persistance filesystem (e.g. /.ssh/).
 */
import {createFs} from 'indexeddb-fs';
export {createFs};
