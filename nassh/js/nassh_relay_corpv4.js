// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Implementation for the corp-relay-v4@google.com proxy.
 */

import {Corp} from './nassh_relay_corp.js';

/**
 * Corp v4 relay implementation.
 */
export class Corpv4 extends Corp {
  /** @inheritDoc */
  getStreamClass() {
    return nassh.Stream.RelayCorpv4WS;
  }
}

/**
 * @override
 * @type {number}
 */
Corpv4.prototype.defaultProxyPort = 443;
