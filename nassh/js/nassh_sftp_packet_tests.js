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
  result.assertEQ(0, packet.offset_);
  result.assertEQ(0, packet.getLength());
  result.assertEQ('', packet.packet_);
  result.assertEQ('', packet.toString());
  let ret = packet.toByteArray();
  result.assert(ret instanceof ArrayBuffer);
  result.assertEQ([], new Uint8Array(ret));
  result.assertEQ(true, packet.eod());

  packet = new nassh.sftp.Packet('abc');
  result.assertEQ(0, packet.offset_);
  result.assertEQ(3, packet.getLength());
  result.assertEQ('abc', packet.packet_);
  result.assertEQ('abc', packet.toString());
  result.assertEQ([97, 98, 99], new Uint8Array(packet.toByteArray()));
  result.assertEQ(false, packet.eod());

  result.pass();
});

/**
 * Checks for adding uint8's.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketSetUint8', function(result, cx) {
  const packet = new nassh.sftp.Packet();

  // Start with a NUL byte.
  packet.setUint8(0);
  result.assertEQ(1, packet.getLength());
  result.assertEQ('\x00', packet.packet_);

  // Then some more edge case bytes.
  packet.setUint8(127);
  packet.setUint8(255);
  result.assertEQ(3, packet.getLength());
  result.assertEQ('\x00\x7f\xff', packet.packet_);

  // Then a value that's too large for uint8.
  packet.setUint8(0xabcdef);
  result.assertEQ(4, packet.getLength());
  result.assertEQ('\x00\x7f\xff\xef', packet.packet_);

  result.pass();
});

/**
 * Checks for adding uint32's.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketSetUint32', function(result, cx) {
  const packet = new nassh.sftp.Packet();

  // Start with a NUL byte.
  packet.setUint32(0);
  result.assertEQ(4, packet.getLength());
  result.assertEQ('\x00\x00\x00\x00', packet.packet_);

  // Then some more edge case bytes.
  packet.setUint32(0x7faabbcc);
  packet.setUint32(0xffffffff);
  result.assertEQ(12, packet.getLength());
  result.assertEQ('\x00\x00\x00\x00\x7f\xaa\xbb\xcc\xff\xff\xff\xff',
                  packet.packet_);

  // Then a value that's too large for uint32.
  packet.setUint32(0xaabbccddeeff);
  result.assertEQ(16, packet.getLength());
  result.assertEQ('\x00\x00\x00\x00\x7f\xaa\xbb\xcc\xff\xff\xff\xff\xcc\xdd\xee\xff',
                  packet.packet_);

  result.pass();
});

/**
 * Checks for adding uint64's.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketSetUint64', function(result, cx) {
  const packet = new nassh.sftp.Packet();

  // Start with a NUL byte.
  packet.setUint64(0);
  result.assertEQ(8, packet.getLength());
  result.assertEQ('\x00\x00\x00\x00\x00\x00\x00\x00', packet.packet_);

  // Then some more edge case bytes.
  packet.setUint64(0xffffffff);
  result.assertEQ(16, packet.getLength());
  result.assertEQ('\x00\x00\x00\x00\x00\x00\x00\x00' +
                  '\x00\x00\x00\x00\xff\xff\xff\xff',
                  packet.packet_);

  // We can't actually test 64-bit values since JavaScript doesn't have a
  // native int type that large.
  packet.setUint64(0xaabbccddeeff);
  result.assertEQ(24, packet.getLength());
  result.assertEQ('\x00\x00\x00\x00\x00\x00\x00\x00' +
                  '\x00\x00\x00\x00\xff\xff\xff\xff' +
                  '\x00\x00\xaa\xbb\xcc\xdd\xee\xff',
                  packet.packet_);

  result.pass();
});

/**
 * Checks for adding binary strings.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketSetString', function(result, cx) {
  const packet = new nassh.sftp.Packet();

  // Start with a NUL byte.
  packet.setString('\u{0}');
  result.assertEQ(5, packet.getLength());
  result.assertEQ('\x00\x00\x00\x01\x00', packet.packet_);

  // Then another binary string.
  packet.setString('abc\xff');
  result.assertEQ(13, packet.getLength());
  result.assertEQ('\x00\x00\x00\x01\x00\x00\x00\x00\x04abc\xff',
                  packet.packet_);

  result.pass();
});

/**
 * Checks for adding strings.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketSetUtf8String', function(result, cx) {
  const packet = new nassh.sftp.Packet();

  // Start with a NUL byte.
  packet.setUtf8String('\u{0}');
  result.assertEQ(5, packet.getLength());
  result.assertEQ('\x00\x00\x00\x01\x00', packet.packet_);

  // Then another normal string.
  packet.setUtf8String('abcdß');
  result.assertEQ(15, packet.getLength());
  result.assertEQ('\x00\x00\x00\x01\x00\x00\x00\x00\x06abcd\xc3\x9f',
                  packet.packet_);

  result.pass();
});

/**
 * Checks for adding data.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketSetData', function(result, cx) {
  const packet = new nassh.sftp.Packet();

  // Start with a NUL byte.
  packet.setData('\x00');
  result.assertEQ(1, packet.getLength());
  result.assertEQ('\x00', packet.packet_);

  // Then another normal string.
  packet.setData('abcd');
  result.assertEQ(5, packet.getLength());
  result.assertEQ('\x00abcd', packet.packet_);

  result.pass();
});

/**
 * Checks for reading uint8's.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketGetUint8', function(result, cx) {
  const packet = new nassh.sftp.Packet('\x00\x7f\xff');
  result.assertEQ(3, packet.getLength());

  // Read a bunch of numbers.
  result.assertEQ(0, packet.getUint8());
  result.assertEQ(false, packet.eod());

  result.assertEQ(0x7f, packet.getUint8());
  result.assertEQ(false, packet.eod());

  result.assertEQ(0xff, packet.getUint8());
  result.assertEQ(true, packet.eod());

  // Check short read.
  try {
    packet.getUint8();
    result.fail();
  } catch(e) {
    result.pass();
  }
});

/**
 * Checks for reading uint32's.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketGetUint32', function(result, cx) {
  const packet = new nassh.sftp.Packet(
      '\x00\x00\x00\x00\x7f\xff\xff\xff\xff\xff\xff\xff');
  result.assertEQ(12, packet.getLength());

  // Read a bunch of numbers.
  result.assertEQ(0, packet.getUint32());
  result.assertEQ(false, packet.eod());

  result.assertEQ(0x7fffffff, packet.getUint32());
  result.assertEQ(false, packet.eod());

  result.assertEQ(0xffffffff, packet.getUint32());
  result.assertEQ(true, packet.eod());

  // Check short read.
  try {
    packet.getUint32();
    result.fail();
  } catch(e) {
    result.pass();
  }
});

/**
 * Checks for reading uint64's.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketGetUint64', function(result, cx) {
  const packet = new nassh.sftp.Packet('\x00\x00\x00\x00\x00\x00\x00\x00' +
                                       '\x00\x00\xaa\xbb\xcc\xdd\xee\xff');
  result.assertEQ(16, packet.getLength());

  // Read a bunch of numbers.
  result.assertEQ(0, packet.getUint64());
  result.assertEQ(false, packet.eod());

  result.assertEQ(0xaabbccddeeff, packet.getUint64());
  result.assertEQ(true, packet.eod());

  // Check short read.
  try {
    packet.getUint64();
    result.fail();
  } catch(e) {
    result.pass();
  }
});

/**
 * Checks for reading binary strings.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketGetString', function(result, cx) {
  const packet = new nassh.sftp.Packet('\x00\x00\x00\x00' +
                                       '\x00\x00\x00\x04abc\xff');
  result.assertEQ(12, packet.getLength());

  // Read the binary strings.
  result.assertEQ('', packet.getString());
  result.assertEQ(false, packet.eod());

  result.assertEQ('abc\xff', packet.getString());
  result.assertEQ(true, packet.eod());

  // Check short read.
  try {
    packet.getString();
    result.fail();
  } catch(e) {
    result.pass();
  }
});

/**
 * Checks for reading strings.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketGetUtf8String', function(result, cx) {
  const packet = new nassh.sftp.Packet('\x00\x00\x00\x00' +
                                       '\x00\x00\x00\x06abcd\xc3\x9f');

  // Read the strings.
  result.assertEQ('', packet.getUtf8String());
  result.assertEQ(false, packet.eod());

  result.assertEQ('abcdß', packet.getUtf8String());
  result.assertEQ(true, packet.eod());

  // Check short read.
  try {
    packet.getUtf8String();
    result.fail();
  } catch(e) {
    result.pass();
  }
});

/**
 * Checks for reading data.
 */
nassh.sftp.packets.Tests.addTest('sftpPacketGetData', function(result, cx) {
  const packet = new nassh.sftp.Packet('abcd');
  result.assertEQ(4, packet.getLength());

  // Read the strings.
  result.assertEQ('abcd', packet.getData());
  result.assertEQ(true, packet.eod());

  result.assertEQ('', packet.getData());
  result.assertEQ(true, packet.eod());

  result.pass();
});
