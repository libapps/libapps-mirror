// Copyright 2025 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Manages SSH policy configurations, including SSH known hosts
 * and SSH config.
 * Provides methods for creating from json object, getters and setters.
 * This class is designed to work with plain JavaScript objects and a binary
 * (Protobuf-like) format.
 * This conforms with /proto/ssh_policy.proto
 */
export class SshPolicy {
  constructor() {
    this.sshKnownHosts = '';
    this.sshConfig = '';
  }

  getSshKnownHosts() {
    return this.sshKnownHosts;
  }

  setSshKnownHosts(value) {
    this.sshKnownHosts = value;
    return this;
  }

  getSshConfig() {
    return this.sshConfig;
  }

  setSshConfig(value) {
    this.sshConfig = value;
    return this;
  }

  static create(obj) {
    const instance = new SshPolicy();
    if (obj) {
      if (obj.sshKnownHosts) {
        instance.setSshKnownHosts(obj.sshKnownHosts);
      }
      if (obj.sshConfig) {
        instance.setSshConfig(obj.sshConfig);
      }
    }
    return instance;
  }
}
