// Copyright 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview General message handling in accordance with the SSH agent
 * protocol.
 */

nassh.agent = {};

/**
 * Create an SSH agent message from a raw byte array containing the message
 * contents.
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4
 *
 * @param {!nassh.agent.messages.Numbers} type The type of the message as per
 *     Section 7.1 of the specification.
 * @param {?Uint8Array} [data] The raw data of the message, if any.
 * @constructor
 */
nassh.agent.Message = function(type, data) {
  /**
   * Type of the message.
   * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.7.1
   *
   * @member {!nassh.agent.messages.Numbers}
   */
  this.type = type;

  /**
   * The raw data of the message.
   *
   * @member {?Uint8Array}
   * @private
   */
  this.data_ = data || new Uint8Array(0);

  /**
   * The current offset into the raw message data. This is only used when
   * reading raw messages (i.e. requests).
   *
   * @member {!number}
   * @private
   */
  this.offset_ = 0;

  /**
   * The fields encoded in the message data. This is only used when reading raw
   * messages (i.e. requests) that contain data.
   *
   * @member {!Object}
   */
  this.fields = {};
};

/**
 * Get the raw, length-encoded representation of the message.
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.3
 *
 * @returns {!Uint8Array}
 */
nassh.agent.Message.prototype.rawMessage = function() {
  const header =
      new Uint8Array(lib.array.uint32ToArrayBigEndian(1 + this.data_.length));
  const body = lib.array.concatTyped(new Uint8Array([this.type]), this.data_);
  return lib.array.concatTyped(header, body);
};

/**
 * Check whether the end of the raw message data has been reached.
 *
 * @returns {!boolean} true if the end of the raw message data has been reached;
 *  false otherwise.
 */
nassh.agent.Message.prototype.eom = function() {
  return this.offset_ === this.data_.length;
};

/**
 * Read a uint32 from the raw message data.
 * @see https://tools.ietf.org/html/rfc4251#section-5
 * @throws Will throw an error if there are less than four more bytes available.
 *
 * @returns {!number}
 */
nassh.agent.Message.prototype.readUint32 = function() {
  if (this.data_.length < this.offset_ + 4) {
    throw new Error('Message.readUint32: end of data_ reached prematurely');
  }
  const uint32 = lib.array.arrayBigEndianToUint32(
      this.data_.slice(this.offset_, this.offset_ + 4));
  this.offset_ += 4;
  return uint32;
};

/**
 * Write a uint32 to the raw message data.
 * @see https://tools.ietf.org/html/rfc4251#section-5
 * @param {!number} uint32 An unsigned 32-bit integer.
 */
nassh.agent.Message.prototype.writeUint32 = function(uint32) {
  if (!Number.isSafeInteger(uint32)) {
    throw new Error(`Message.writeUint32: ${uint32} is not a (safe) integer`);
  }
  const array = new Uint8Array(lib.array.uint32ToArrayBigEndian(uint32));
  this.data_ = lib.array.concatTyped(this.data_, array);
};

/**
 * Read a string from the raw message data.
 * @see https://tools.ietf.org/html/rfc4251#section-5
 * @throws Will throw an error if there are less bytes available than indicated
 *  by the length field.
 *
 * @returns {!Uint8Array}
 */
nassh.agent.Message.prototype.readString = function() {
  const length = this.readUint32();
  if (this.data_.length < this.offset_ + length) {
    throw new Error('Message.readString: end of data_ reached prematurely');
  }
  const string = this.data_.slice(this.offset_, this.offset_ + length);
  this.offset_ += length;
  return string;
};

/**
 * Write a string to the raw message data.
 * @see https://tools.ietf.org/html/rfc4251#section-5
 *
 * @param {!Uint8Array} string
 */
nassh.agent.Message.prototype.writeString = function(string) {
  if (!(string instanceof Uint8Array)) {
    throw new Error('Message.writeString: string is not of type Uint8Array');
  }
  const length = string.length;
  this.writeUint32(length);
  this.data_ = lib.array.concatTyped(this.data_, string);
};

/**
 * Parse a raw SSH agent message into a Message object.
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.3
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4
 *
 * @constructs nassh.agent.Message
 * @param {!Uint8Array} rawMessage
 * @returns {?nassh.agent.Message} A Message object created from the raw message
 *     data; null if the raw message data is malformed.
 */
nassh.agent.Message.fromRawMessage = function(rawMessage) {
  if (rawMessage.length < 5) {
    return null;
  }
  const length = lib.array.arrayBigEndianToUint32(rawMessage);
  if (length + 4 !== rawMessage.length) {
    return null;
  }
  const message = new nassh.agent.Message(rawMessage[4], rawMessage.slice(5));
  return nassh.agent.messages.read(message);
};
