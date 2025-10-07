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

/**
 * Manages SSH policy configurations.
 */
export class SshPolicy {
  /**
   * Initializes the policy with default empty values.
   * @param {{
   *   sshKnownHosts: (string|undefined),
   *   sshConfig: (string|undefined)
   * }=} options The options object.
   */
  constructor({
    sshKnownHosts = '',
    sshConfig = '',
  } = {}) {
    /** @private {string} */
    this.sshKnownHosts_ = sshKnownHosts;

    /** @private {string} */
    this.sshConfig_ = sshConfig;
  }

  /**
   * @return {string} The SSH known hosts.
   */
  getSshKnownHosts() {
    return this.sshKnownHosts_;
  }

  /**
   * @param {string} value The new SSH known hosts.
   * @return {!SshPolicy} This instance for chaining.
   */
  setSshKnownHosts(value) {
    this.sshKnownHosts_ = value;
    return this;
  }

  /**
   * @return {string} The SSH config.
   */
  getSshConfig() {
    return this.sshConfig_;
  }

  /**
   * @param {string} value The new SSH config.
   * @return {!SshPolicy} This instance for chaining.
   */
  setSshConfig(value) {
    this.sshConfig_ = value;
    return this;
  }

  /**
   * Creates an SshPolicy instance from a plain object.
   * @param {?{
   *   sshKnownHosts: (string|undefined),
   *   sshConfig: (string|undefined)
   * }=} obj The object to create the policy from.
   * @return {!SshPolicy} A new SshPolicy instance.
   */
  static from(obj) {
    return new SshPolicy({
      sshKnownHosts: obj?.sshKnownHosts ?? '',
      sshConfig: obj?.sshConfig ?? '',
    });
  }
}
