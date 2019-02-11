// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview SFTP utility tests.
 */

nassh.sftp.packets.Tests = new lib.TestManager.Suite('nassh.sftp.packets.Tests');

/**
 * Packet constructor & basic API test.
 */
nassh.sftp.packets.Tests.addTest('sftpPacket', function(result, cx) {
  let packet = new nassh.sftp.Packet();
  assert.equal(0, packet.offset_);
  assert.equal(0, packet.getLength());
  assert.equal('', packet.toString());
  let ret = packet.toArrayBuffer();
  assert.isTrue(ret instanceof ArrayBuffer);
  assert.deepStrictEqual(new Uint8Array([]), new Uint8Array(ret));
  assert.isTrue(packet.eod());

  packet = new nassh.sftp.Packet(lib.codec.stringToCodeUnitArray('abc'));
  assert.equal(0, packet.offset_);
  assert.equal(3, packet.getLength());
  assert.equal('abc', packet.toString());
  assert.deepStrictEqual(new Uint8Array([97, 98, 99]), packet.toByteArray());
  assert.isFalse(packet.eod());

  result.pass();
});

/**
 * Checks for adding uint8's.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketSetUint8', function(result, cx) {
  const packet = new nassh.sftp.Packet();

  // Start with a NUL byte.
  packet.setUint8(0);
  assert.equal(1, packet.getLength());
  assert.deepStrictEqual(new Uint8Array([0x00]), packet.toByteArray());

  // Then some more edge case bytes.
  packet.setUint8(127);
  packet.setUint8(255);
  assert.equal(3, packet.getLength());
  assert.deepStrictEqual(new Uint8Array([0x00, 0x7f, 0xff]),
                         packet.toByteArray());

  // Then a value that's too large for uint8.
  packet.setUint8(0xabcdef);
  assert.equal(4, packet.getLength());
  assert.deepStrictEqual(new Uint8Array([0x00, 0x7f, 0xff, 0xef]),
                         packet.toByteArray());

  result.pass();
});

/**
 * Checks for adding uint32's.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketSetUint32', function(result, cx) {
  const packet = new nassh.sftp.Packet();

  // Start with a NUL byte.
  packet.setUint32(0);
  assert.equal(4, packet.getLength());
  assert.deepStrictEqual(new Uint8Array([0x00, 0x00, 0x00, 0x00]),
                         packet.toByteArray());

  // Then some more edge case bytes.
  packet.setUint32(0x7faabbcc);
  packet.setUint32(0xffffffff);
  assert.equal(12, packet.getLength());
  assert.deepStrictEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x7f, 0xaa, 0xbb, 0xcc,
                      0xff, 0xff, 0xff, 0xff]),
      packet.toByteArray());

  // Then a value that's too large for uint32.
  packet.setUint32(0xaabbccddeeff);
  assert.equal(16, packet.getLength());
  assert.deepStrictEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x7f, 0xaa, 0xbb, 0xcc,
                      0xff, 0xff, 0xff, 0xff, 0xcc, 0xdd, 0xee, 0xff]),
      packet.toByteArray());

  result.pass();
});

/**
 * Checks for adding uint64's.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketSetUint64', function(result, cx) {
  const packet = new nassh.sftp.Packet();

  // Start with a NUL byte.
  packet.setUint64(0);
  assert.equal(8, packet.getLength());
  assert.deepStrictEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      packet.toByteArray());

  // Then some more edge case bytes.
  packet.setUint64(0xffffffff);
  assert.equal(16, packet.getLength());
  assert.deepStrictEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                      0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff]),
      packet.toByteArray());

  // We can't actually test 64-bit values since JavaScript doesn't have a
  // native int type that large.
  packet.setUint64(0xaabbccddeeff);
  assert.equal(24, packet.getLength());
  assert.deepStrictEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                      0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff,
                      0x00, 0x00, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]),
      packet.toByteArray());

  result.pass();
});

/**
 * Checks for adding binary strings.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketSetString', function(result, cx) {
  const packet = new nassh.sftp.Packet();

  // Start with a NUL byte.
  packet.setString('\u{0}');
  assert.equal(5, packet.getLength());
  assert.deepStrictEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x00]),
      packet.toByteArray());

  // Then another binary string.
  packet.setString('abc\xff');
  assert.equal(13, packet.getLength());
  assert.deepStrictEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x00,
                      0x00, 0x00, 0x00, 0x04, 97, 98, 99, 0xff]),
      packet.toByteArray());

  result.pass();
});

/**
 * Checks for adding strings.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketSetUtf8String', function(result, cx) {
  const packet = new nassh.sftp.Packet();

  // Start with a NUL byte.
  packet.setUtf8String('\u{0}');
  assert.equal(5, packet.getLength());
  assert.deepStrictEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x00]),
      packet.toByteArray());

  // Then another normal string.
  packet.setUtf8String('abcdß');
  assert.equal(15, packet.getLength());
  assert.deepStrictEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x00,
                      0x00, 0x00, 0x00, 0x06, 97, 98, 99, 100, 0xc3, 0x9f]),
      packet.toByteArray());

  result.pass();
});

/**
 * Checks for adding data.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketSetData', function(result, cx) {
  const packet = new nassh.sftp.Packet();

  // Start with a NUL byte.
  packet.setData('\x00');
  assert.equal(1, packet.getLength());
  assert.deepStrictEqual(new Uint8Array([0x00]), packet.toByteArray());

  // Then another normal string.
  packet.setData('abcd');
  assert.equal(5, packet.getLength());
  assert.deepStrictEqual(new Uint8Array([0x00, 97, 98, 99, 100]),
                         packet.toByteArray());

  result.pass();
});

/**
 * Checks for reading uint8's.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketGetUint8', function(result, cx) {
  const packet = new nassh.sftp.Packet([0x00, 0x7f, 0xff]);
  assert.equal(3, packet.getLength());

  // Read a bunch of numbers.
  assert.equal(0, packet.getUint8());
  assert.isFalse(packet.eod());

  assert.equal(0x7f, packet.getUint8());
  assert.isFalse(packet.eod());

  assert.equal(0xff, packet.getUint8());
  assert.isTrue(packet.eod());

  // Check short read.
  assert.throws(() => packet.getUint8());

  result.pass();
});

/**
 * Checks for reading uint32's.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketGetUint32', function(result, cx) {
  const packet = new nassh.sftp.Packet(
      [0x00, 0x00, 0x00, 0x00, 0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
  assert.equal(12, packet.getLength());

  // Read a bunch of numbers.
  assert.equal(0, packet.getUint32());
  assert.isFalse(packet.eod());

  assert.equal(0x7fffffff, packet.getUint32());
  assert.isFalse(packet.eod());

  assert.equal(0xffffffff, packet.getUint32());
  assert.isTrue(packet.eod());

  // Check short read.
  assert.throws(() => packet.getUint32());

  result.pass();
});

/**
 * Checks for reading uint64's.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketGetUint64', function(result, cx) {
  const packet = new nassh.sftp.Packet(
      [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
       0x00, 0x00, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
  assert.equal(16, packet.getLength());

  // Read a bunch of numbers.
  assert.equal(0, packet.getUint64());
  assert.isFalse(packet.eod());

  assert.equal(0xaabbccddeeff, packet.getUint64());
  assert.isTrue(packet.eod());

  // Check short read.
  assert.throws(() => packet.getUint64());

  result.pass();
});

/**
 * Checks for reading binary strings.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketGetString', function(result, cx) {
  const packet = new nassh.sftp.Packet(
      [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 97, 98, 99, 0xff]);
  assert.equal(12, packet.getLength());

  // Read the binary strings.
  assert.equal('', packet.getString());
  assert.isFalse(packet.eod());

  assert.equal('abc\xff', packet.getString());
  assert.isTrue(packet.eod());

  // Check short read.
  assert.throws(() => packet.getString());

  result.pass();
});

/**
 * Checks for reading strings.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketGetUtf8String', function(result, cx) {
  const packet = new nassh.sftp.Packet(
      [0x00, 0x00, 0x00, 0x00,
       0x00, 0x00, 0x00, 0x06, 97, 98, 99, 100, 0xc3, 0x9f]);

  // Read the strings.
  assert.equal('', packet.getUtf8String());
  assert.isFalse(packet.eod());

  assert.equal('abcdß', packet.getUtf8String());
  assert.isTrue(packet.eod());

  // Check short read.
  assert.throws(() => packet.getUtf8String());

  result.pass();
});

/**
 * Checks for reading data.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketGetData', function(result, cx) {
  const packet = new nassh.sftp.Packet([97, 98, 99, 100]);
  assert.equal(4, packet.getLength());

  // Read the strings.
  assert.equal('abcd', packet.getData());
  assert.isTrue(packet.eod());

  assert.equal('', packet.getData());
  assert.isTrue(packet.eod());

  result.pass();
});
