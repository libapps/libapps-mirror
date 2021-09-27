// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Implementation for the corp-relay-v4@google.com proxy.
 */

/**
 * Corp v4 relay implementation.
 */
nassh.relay.Corpv4 = class extends nassh.relay.Corp {
  /** @inheritDoc */
  getStreamClass() {
    return nassh.Stream.RelayCorpv4WS;
  }
};

/**
 * @override
 * @type {number}
 */
nassh.relay.Corpv4.prototype.defaultProxyPort = 443;
