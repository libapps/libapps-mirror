// Copyright (c) 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * A general packet. Utilizes an offset to keep track of data being read/written.
 *
 * @param {string|Array<number>=} arg The initial data for the new packet.
 */
nassh.sftp.Packet = function(arg='') {
  let packet;
  if (typeof arg == 'string') {
    packet = arg;
  } else {
    packet = lib.codec.codeUnitArrayToString(arg);
  }
  this.offset_ = 0;
  this.packet_ = packet;
  this.encoder_ = new TextEncoder();
  this.decoder_ = new TextDecoder();
};

/**
 * Sets a uint8 at the current offset.
 */
nassh.sftp.Packet.prototype.setUint8 = function(uint8) {
  this.packet_ += nassh.sftp.Packet.intToNByteArrayString(uint8, 1);
  this.offset_ += 1;
};

/**
 * Sets a uint32 at the current offset.
 */
nassh.sftp.Packet.prototype.setUint32 = function(uint32) {
  this.packet_ += nassh.sftp.Packet.intToNByteArrayString(uint32, 4);
  this.offset_ += 4;
};

/**
 * Sets a uint64 at the current offset.
 *
 * Note: Because JavaScript lacks a native 64-bit interger type, the argument
 * is actually limited to 53 bits.
 */
nassh.sftp.Packet.prototype.setUint64 = function(uint64) {
  this.packet_ += nassh.sftp.Packet.intToNByteArrayString(uint64, 8);
  this.offset_ += 8;
};

/**
 * Sets a binary string at the current offset.
 *
 * SFTP defines the 'string' type as a 32-bit integer followed by arbitrary
 * binary data with no encoding.  This function writes the specified string
 * to the packet with no encoding -- the bytes are directly appended.
 *
 * @param {string} string The binary string to append to the packet.
 */
nassh.sftp.Packet.prototype.setString = function(binaryString) {
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
  const data = lib.codec.codeUnitArrayToString(this.encoder_.encode(string));
  this.setString(data);
};

/**
 * Sets data at the current offset.
 */
nassh.sftp.Packet.prototype.setData = function(data) {
  // TODO: Support strings until we've migrated to ArrayBuffers everywhere.
  if (typeof data != 'string') {
    data = lib.codec.codeUnitArrayToString(data);
  }
  this.packet_ += data;
  this.offset_ += data.length;
};

/**
 * Gets a uint8 from the current offset, if possible.
 */
nassh.sftp.Packet.prototype.getUint8 = function() {
  if (this.offset_ + 1 > this.packet_.length) {
    throw new Error('Packet too short to read a uint8');
  }

  var uint8 = this.packet_.charCodeAt(this.offset_);

  this.offset_ += 1;
  return uint8;
};

/**
 * Gets a uint32 from the current offset, if possible.
 */
nassh.sftp.Packet.prototype.getUint32 = function() {
  if (this.offset_ + 4 > this.packet_.length) {
    throw new Error('Packet too short to read a uint32');
  }

  var uint32Slice = this.packet_.slice(this.offset_, this.offset_ + 4);
  var uint32 = nassh.sftp.Packet.byteArrayStringToInt(uint32Slice);

  this.offset_ += 4;
  return uint32;
};

/**
 * Gets a uint64 from the current offset, if possible.
 *
 * Note: Because JavaScript lacks a native 64-bit interger type, the return is
 * actually limited to 53 bits.  The byteArrayStringToInt function will enforce
 * that limit for us.
 */
nassh.sftp.Packet.prototype.getUint64 = function() {
  if (this.offset_ + 8 > this.packet_.length) {
    throw new Error('Packet too short to read a uint64');
  }

  var uint64Slice = this.packet_.slice(this.offset_, this.offset_ + 8);
  var uint64 = nassh.sftp.Packet.byteArrayStringToInt(uint64Slice);

  this.offset_ += 8;
  return uint64;
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
  var stringLength = this.getUint32();

  if (this.offset_ + stringLength > this.packet_.length) {
    throw new Error('Packet too short to read a string');
  }

  return this.getData(stringLength);
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
  return this.decoder_.decode(new Uint8Array(
      lib.codec.stringToCodeUnitArray(this.getString())));
};

/**
 * Gets raw data from the packet at the current offset.
 *
 * @param {number=} length How many bytes to read.
 */
nassh.sftp.Packet.prototype.getData = function(length=undefined) {
  const data = this.packet_.substr(this.offset_, length);
  this.offset_ += data.length;
  return data;
};

/**
 * Slices the packet from beginSlice to the optional endSlice (else end of
 * packet).
 */
nassh.sftp.Packet.prototype.slice = function(beginSlice, opt_endSlice) {
  var endSlice = opt_endSlice || this.packet_.length;
  this.packet_ = this.packet_.slice(beginSlice, endSlice);
};

/**
 * Returns the toString representation of the packet.
 */
nassh.sftp.Packet.prototype.toString = function() {
  return this.packet_;
};

/**
 * Returns an Array of bytes representation of the packet.
 *
 * @return {Uint8Array} The data bytes.
 */
nassh.sftp.Packet.prototype.toByteArray = function() {
  return lib.codec.stringToCodeUnitArray(this.packet_, Uint8Array);
};

/**
 * Returns the ArrayBuffer representation of the packet.
 *
 * @return {ArrayBuffer} The data buffer.
 */
nassh.sftp.Packet.prototype.toArrayBuffer = function() {
  return this.toByteArray().buffer;
};

/**
 * Returns the length of the packet.
 */
nassh.sftp.Packet.prototype.getLength = function() {
  return this.packet_.length;
};

/**
 * Check whether the end of the packet data has been reached.
 *
 * @returns {!boolean} true If the end of the packet data has been reached.
 */
nassh.sftp.Packet.prototype.eod = function() {
  return this.offset_ === this.packet_.length;
};

/**
 * Converts a byte array string to an int.
 *
 * This expects a big endian input.
 */
nassh.sftp.Packet.byteArrayStringToInt = function(byteArray) {
  var int = 0;

  // We can't use bitwise shifts because that creates a signed 32-bit int.
  for (var i = 0; i < byteArray.length; i++) {
    int = (int * 256) + byteArray.charCodeAt(i);
  }

  if (int > Number.MAX_SAFE_INTEGER) {
    throw new RangeError('get int failed: int is too large to represent exactly'
                         + '(was greater than 2^53-1)');
  }

  return int;
};

/**
 * Converts an int to an n byte array string.
 *
 * This produces a big endian array.
 */
nassh.sftp.Packet.intToNByteArrayString = function(int, n) {
  // Creates an n byte long array.  We don't have to zero-fill it because the
  // loop below will take care of writing zeros as needed.
  const byteArray = new Array(n);

  // Converts the int into its byte array form.
  for (let i = n - 1; i >= 0; --i) {
    const byte = int & 0xff;
    byteArray[i] = byte;
    // We can't use bitwise shifts because that creates a signed 32-bit int.
    int = (int - byte) / 256;
  }

  // Return the byte array represented as a string.
  return String.fromCharCode.apply(String, byteArray);
};
