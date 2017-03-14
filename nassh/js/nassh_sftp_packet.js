// Copyright (c) 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * A general packet. Utilizes an offset to keep track of data being read/written.
 */
nassh.sftp.Packet = function(opt_packet) {
  this.offset_ = 0;
  this.packet_ = opt_packet || '';
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
 */
nassh.sftp.Packet.prototype.setUint64 = function(uint64) {
  this.packet_ += nassh.sftp.Packet.intToNByteArrayString(uint64, 8);
  this.offset_ += 8;
};

/**
 * Sets a string at the current offset.
 */
nassh.sftp.Packet.prototype.setString = function(string) {
  var stringLength = string.length;

  this.setUint32(stringLength); //sets strings length
  this.packet_ += string;
  this.offset_ += stringLength;
};

/**
 * Sets data at the current offset.
 */
nassh.sftp.Packet.prototype.setData = function(data) {
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
 * Gets a string from the current offset, if possible.
 */
nassh.sftp.Packet.prototype.getString = function() {
  var stringLength = this.getUint32();

  if (this.offset_ + stringLength > this.packet_.length) {
    throw new Error('Packet too short to read a string');
  }

  var string = this.packet_.substr(this.offset_, stringLength);
  this.offset_ += stringLength;
  return string;
};

/**
 * Gets the remaining data from the packet at the current offset.
 */
nassh.sftp.Packet.prototype.getData = function() {
  var data = this.packet_.substr(this.offset_);
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
 * Returns the byteArray representation of the packet.
 */
nassh.sftp.Packet.prototype.toByteArray = function() {
  var array = new Uint8Array(this.packet_.length);

  for (var i = 0; i < array.length; i++) {
    array[i] = this.packet_.charCodeAt(i);
  }

  return array;
};

/**
 * Returns the length of the packet.
 */
nassh.sftp.Packet.prototype.getLength = function() {
  return this.packet_.length;
};

/**
 * Converts a byte array string to an int
 */
nassh.sftp.Packet.byteArrayStringToInt = function(byteArray) {
  var int = 0;

  // converts the byte array into its int form
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
 */
nassh.sftp.Packet.intToNByteArrayString = function(int, n) {
  var byteArray = [];

  // creates a n byte long array
  for (var i = 0; i < n; i++) {
    byteArray.push(0);
  }

  // converts the int into its byte array form
  for (var i = n-1; i >= 0; i--) {
      var byte = int & 0xff;
      byteArray[i] = byte;
      int = (int - byte) / 256;
  }

  // return the byte array represented as a string
  return String.fromCharCode.apply(String, byteArray);
};
