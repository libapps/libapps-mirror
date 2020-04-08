// Copyright (c) 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * A general packet. Utilizes an offset to keep track of data being
 * read/written.
 *
 * @param {number|!ArrayBufferView|!Array<number>=} arg The initial data for
 *     the new packet.
 * @constructor
 */
nassh.sftp.Packet = function(arg = []) {
  this.offset_ = 0;
  const u8 = new Uint8Array(arg);
  this.packet_ = u8.buffer;
  this.dv_ = new DataView(this.packet_);
  this.encoder_ = new TextEncoder();
  this.decoder_ = new TextDecoder();
};

/**
 * Expand the array buffer storage.
 *
 * @param {number} size How many bytes to add.
 * @private
 */
nassh.sftp.Packet.prototype.addSpace_ = function(size) {
  const newSize = this.offset_ + size;
  if (newSize <= this.packet_.byteLength) {
    return;
  }

  const newu8 = new Uint8Array(newSize);
  const oldu8 = new Uint8Array(this.packet_);
  newu8.set(oldu8);
  this.packet_ = newu8.buffer;
  this.dv_ = new DataView(this.packet_);
};

/**
 * Sets a uint8 at the current offset.
 *
 * @param {number} uint8
 */
nassh.sftp.Packet.prototype.setUint8 = function(uint8) {
  this.addSpace_(1);
  this.dv_.setUint8(this.offset_, uint8);
  this.offset_ += 1;
};

/**
 * Sets a uint32 at the current offset.
 *
 * @param {number} uint32
 */
nassh.sftp.Packet.prototype.setUint32 = function(uint32) {
  this.addSpace_(4);
  this.dv_.setUint32(this.offset_, uint32);
  this.offset_ += 4;
};

/**
 * Sets a uint64 at the current offset.
 *
 * Note: Because JavaScript lacks a native 64-bit interger type, the argument
 * is actually limited to 53 bits.
 *
 * @param {number} uint64
 */
nassh.sftp.Packet.prototype.setUint64 = function(uint64) {
  this.addSpace_(8);
  this.dv_.setUint32(this.offset_, uint64 / 0x100000000);
  this.dv_.setUint32(this.offset_ + 4, uint64);
  this.offset_ += 8;
};

/**
 * Sets a binary string at the current offset.
 *
 * SFTP defines the 'string' type as a 32-bit integer followed by arbitrary
 * binary data with no encoding.  This function writes the specified string
 * to the packet with no encoding -- the bytes are directly appended.
 *
 * @param {!ArrayBufferView|string} binaryString The binary string to append
 *     to the packet.
 */
nassh.sftp.Packet.prototype.setString = function(binaryString) {
  if (typeof binaryString == 'string') {
    binaryString = lib.codec.stringToCodeUnitArray(binaryString);
  }
  this.setUint32(binaryString.length);
  this.setData(binaryString);
};

/**
 * Sets a string at the current offset.
 *
 * SFTP defines the 'string' type as a 32-bit integer followed by arbitrary
 * binary data with no encoding.  This function writes the specified string
 * to the packet by encoding it into UTF-8 code units first.
 *
 * @param {string} string The string to append to the packet.
 */
nassh.sftp.Packet.prototype.setUtf8String = function(string) {
  const data = this.encoder_.encode(string);
  this.setString(data);
};

/**
 * Sets data at the current offset.
 *
 * @param {!ArrayBufferView} data
 */
nassh.sftp.Packet.prototype.setData = function(data) {
  this.addSpace_(data.length);
  const u8 = new Uint8Array(this.packet_, this.offset_);
  u8.set(data);
  this.offset_ += data.length;
};

/**
 * Gets a uint8 from the current offset, if possible.
 *
 * @return {number}
 */
nassh.sftp.Packet.prototype.getUint8 = function() {
  const ret = this.dv_.getUint8(this.offset_);
  this.offset_ += 1;
  return ret;
};

/**
 * Gets a uint32 from the current offset, if possible.
 *
 * @return {number}
 */
nassh.sftp.Packet.prototype.getUint32 = function() {
  const ret = this.dv_.getUint32(this.offset_);
  this.offset_ += 4;
  return ret;
};

/**
 * Gets a uint64 from the current offset, if possible.
 *
 * Note: Because JavaScript lacks a native 64-bit interger type, the return is
 * actually limited to 53 bits.  The byteArrayStringToInt function will enforce
 * that limit for us.
 *
 * @return {number}
 */
nassh.sftp.Packet.prototype.getUint64 = function() {
  const hi32 = this.dv_.getUint32(this.offset_);
  const lo32 = this.dv_.getUint32(this.offset_ + 4);
  this.offset_ += 8;

  let ret = lo32;
  if (hi32) {
    ret += (hi32 * 0x100000000);
  }
  return ret;
};

/**
 * Gets a binary string from the current offset.
 *
 * SFTP defines the 'string' type as a 32-bit integer followed by arbitrary
 * binary data with no encoding.  This function reads that binary data out of
 * the packet and returns it directly -- no encoding is assumed here.
 *
 * @return {string} The binary string.
 */
nassh.sftp.Packet.prototype.getString = function() {
  const length = this.getUint32();
  return lib.codec.codeUnitArrayToString(this.getData(length));
};

/**
 * Gets a UTF-8 encoded string from the current offset.
 *
 * SFTP defines the 'string' type as a 32-bit integer followed by arbitrary
 * binary data with no encoding.  This function treats that binary data as
 * UTF-8 encoded and will decode it into native JS strings.
 *
 * @return {string} The string.
 */
nassh.sftp.Packet.prototype.getUtf8String = function() {
  const length = this.getUint32();
  return this.decoder_.decode(this.getData(length));
};

/**
 * Gets raw data from the packet at the current offset.
 *
 * @param {number=} length How many bytes to read.
 * @return {!Uint8Array} The raw bytes from the packet.
 */
nassh.sftp.Packet.prototype.getData = function(length = undefined) {
  const data = new Uint8Array(this.packet_, this.offset_, length);
  this.offset_ += data.length;
  return data;
};

/**
 * Returns the toString representation of the packet.
 *
 * @return {string}
 * @override
 */
nassh.sftp.Packet.prototype.toString = function() {
  // We don't use this.decoder_ because this is the entire packet with binary
  // data, so it won't all be valid UTF-8.
  return lib.codec.codeUnitArrayToString(this.toByteArray());
};

/**
 * Returns an Array of bytes representation of the packet.
 *
 * @return {!Uint8Array} The data bytes.
 */
nassh.sftp.Packet.prototype.toByteArray = function() {
  return new Uint8Array(this.packet_);
};

/**
 * Returns the ArrayBuffer representation of the packet.
 *
 * @return {!ArrayBuffer} The data buffer.
 */
nassh.sftp.Packet.prototype.toArrayBuffer = function() {
  return this.packet_;
};

/**
 * Returns the length of the packet.
 *
 * @return {number}
 */
nassh.sftp.Packet.prototype.getLength = function() {
  return this.packet_.byteLength;
};

/**
 * Check whether the end of the packet data has been reached.
 *
 * @return {boolean} true If the end of the packet data has been reached.
 */
nassh.sftp.Packet.prototype.eod = function() {
  return this.offset_ === this.getLength();
};
