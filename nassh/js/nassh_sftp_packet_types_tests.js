// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview SFTP low level protocol tests.
 */

describe('nassh_sftp_packet_types_tests.js', () => {

/**
 * Verify StatusPacket deserialization.
 */
it('sftpStatusPacket', () => {
  const te = new TextEncoder();
  const dataPacket = new nassh.sftp.Packet([
      // 32-bit request id.
      0x01, 0x02, 0x03, 0x04,
      // 32-bit code.
      0xab, 0xcd, 0xef, 0x11,
      // Message string.
      0x00, 0x00, 0x00, 0x06, ...te.encode('status'),
      // Language string.
      0x00, 0x00, 0x00, 0x00,
  ]);

  const packet = new nassh.sftp.packets.StatusPacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  assert.equal(0x01020304, packet.requestId);
  assert.equal(0xabcdef11, packet.code);
  assert.equal('status', packet.message);
  assert.equal('', packet.lang);
});

/**
 * Verify DataPacket deserialization.
 */
it('sftpDataPacket', () => {
  const te = new TextEncoder();
  const dataPacket = new nassh.sftp.Packet([
      // 32-bit request id.
      0x01, 0x02, 0x03, 0x04,
      // Data string.
      0x00, 0x00, 0x00, 0x04, ...te.encode('data'),
  ]);

  const packet = new nassh.sftp.packets.DataPacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  assert.equal(0x01020304, packet.requestId);
  assert.deepStrictEqual(new Uint8Array([100, 97, 116, 97]), packet.data);
});

/**
 * Verify HandlePacket deserialization.
 */
it('sftpHandlePacket', () => {
  const te = new TextEncoder();
  const dataPacket = new nassh.sftp.Packet([
      // 32-bit request id.
      0x01, 0x02, 0x03, 0x04,
      // Handle string.
      0x00, 0x00, 0x00, 0x04, ...te.encode('data'),
  ]);

  const packet = new nassh.sftp.packets.HandlePacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  assert.equal(0x01020304, packet.requestId);
  assert.equal('data', packet.handle);
});

/**
 * Verify empty NamePacket deserialization.
 */
it('sftpNamePacketEmpty', () => {
  const dataPacket = new nassh.sftp.Packet([
      // 32-bit request id.
      0x01, 0x02, 0x03, 0x04,
      // 32-bit file count.
      0x00, 0x00, 0x00, 0x00,
  ]);

  const packet = new nassh.sftp.packets.NamePacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  assert.equal(0x01020304, packet.requestId);
  assert.equal(0, packet.fileCount);
  assert.deepStrictEqual([], packet.files);
});

/**
 * Verify non-empty NamePacket deserialization.
 */
it('sftpNamePacket', () => {
  const te = new TextEncoder();
  const dataPacket = new nassh.sftp.Packet([
      // 32-bit request id.
      0x01, 0x02, 0x03, 0x04,
      // 32-bit file count.
      0x00, 0x00, 0x00, 0x03,
      // File 1: (empty) name.
      0x00, 0x00, 0x00, 0x00,
      // File 1: (empty) long name.
      0x00, 0x00, 0x00, 0x00,
      // File 1: (no) attributes.
      0x00, 0x00, 0x00, 0x00,
      // File 2: normal name.
      0x00, 0x00, 0x00, 0x03, ...te.encode('abc'),
      // File 2: normal long name.
      0x00, 0x00, 0x00, 0x2f,
      ...te.encode('-rwxr-xr-x  1 root  root  8560 Oct 23 23:30 abc'),
      // File 2: (no) attributes.
      0x00, 0x00, 0x00, 0x00,
      // File 3: unicode name.
      0x00, 0x00, 0x00, 0x09, ...te.encode('日本語'),
      // File 3: unicode long name.
      0x00, 0x00, 0x00, 0x13, ...te.encode('-rw-rw-rw 日本語'),
      // File 3: simple attributes.
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03,
  ]);

  const packet = new nassh.sftp.packets.NamePacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  assert.equal(0x01020304, packet.requestId);
  assert.equal(3, packet.fileCount);

  // Check file 1 (empty).
  let file = packet.files[0];
  assert.equal('', file.filename);
  assert.equal('', file.longFilename);
  assert.equal(0, file.flags);

  // Check file 2 (normal).
  file = packet.files[1];
  assert.equal('abc', file.filename);
  assert.equal('-rwxr-xr-x  1 root  root  8560 Oct 23 23:30 abc',
               file.longFilename);
  assert.equal(0, file.flags);

  // Check file 3 (unicode).
  file = packet.files[2];
  assert.equal('日本語', file.filename);
  assert.equal('-rw-rw-rw 日本語', file.longFilename);
  assert.equal(1, file.flags);
  assert.equal(3, file.size);
});

/**
 * Verify AttrsPacket deserialization.
 *
 * This test is a bit light as we unit test getFileAttrs directly.
 */
it('sftpAttrsPacket', () => {
  const dataPacket = new nassh.sftp.Packet([
      // 32-bit request id.
      0x01, 0x02, 0x03, 0x04,
      // Attrs: no bits sent.
      0x00, 0x00, 0x00, 0x00,
  ]);

  const packet = new nassh.sftp.packets.AttrsPacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  // Check empty attrs.
  assert.equal(0x01020304, packet.requestId);
  assert.equal(0, packet.attrs.flags);
});

/**
 * Verify basic VersionPacket deserialization.
 */
it('sftpVersionPacket', () => {
  const dataPacket = new nassh.sftp.Packet([
      // 32-bit version.
      0x00, 0x00, 0x00, 0x03,
  ]);

  const packet = new nassh.sftp.packets.VersionPacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  // Check the fields.
  assert.equal('init', packet.requestId);
  assert.equal(3, packet.version);

  // Check the extensions.
  assert.deepStrictEqual([], Object.keys(packet.extensions));
});

/**
 * Verify VersionPacket w/extensions deserialization.
 */
it('sftpVersionPacketExt', () => {
  const te = new TextEncoder();
  const dataPacket = new nassh.sftp.Packet([
      // 32-bit version.
      0x00, 0x00, 0x00, 0x06,
      // Extension 1: name.
      0x00, 0x00, 0x00, 0x07, ...te.encode('ext@foo'),
      // Extension 1: data.
      0x00, 0x00, 0x00, 0x04, ...te.encode('data'),
      // Extension 2: name.
      0x00, 0x00, 0x00, 0x0a, ...te.encode('ext@ok.com'),
      // Extension 2: data.
      0x00, 0x00, 0x00, 0x01, ...te.encode('1'),
      // Extension 3: (invalid) name.
      0x00, 0x00, 0x00, 0x05, ...te.encode('n@m@e'),
      // Extension 3: data.
      0x00, 0x00, 0x00, 0x04, ...te.encode('blah'),
  ]);

  const packet = new nassh.sftp.packets.VersionPacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  // Check the fields.
  assert.equal('init', packet.requestId);
  assert.equal(6, packet.version);

  // Check the extensions.
  assert.equal('data', packet.extensions['ext@foo']);
  assert.equal('1', packet.extensions['ext@ok.com']);
  assert.isUndefined(packet.extensions['name']);
});

/**
 * Check ValidExtension behavior.
 */
it('sftpValidExtension', () => {
  const invalidExtensions = [
    // Empty.
    '',
    // Too long.
    'abc@foo.commmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
    // Too many @.
    'na@me@foo.com',
    // Invalid characters in name.
    'na\x00me',
    'na,me',
    'na me',
    'na\x7fme',
  ];
  invalidExtensions.forEach((ext) => {
    assert.isFalse(nassh.sftp.packets.ValidExtension(ext), ext);
  });

  const validExtensions = [
    // No @.
    'name',
    // Full valid ASCII set for the name.
    '!"#$%&\'()*+-./0123456789:;<=>?[\\]^_`{|}',
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
    // Name & domain.
    'x@blah.blah.www.org',
  ];
  validExtensions.forEach((ext) => {
    assert.isTrue(nassh.sftp.packets.ValidExtension(ext), ext);
  });
});

/**
 * Verify UnknownPacket deserialization.
 */
it('sftpUnknownPacket', () => {
  const te = new TextEncoder();
  const dataPacket = new nassh.sftp.Packet([
      // 32-bit request id.
      0x01, 0x02, 0x03, 0x04,
      // Whatever is left.
      ...te.encode('abc'),
  ]);

  const packet = new nassh.sftp.packets.UnknownPacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  assert.equal(0x01020304, packet.requestId);
  assert.deepStrictEqual(new Uint8Array([97, 98, 99]), packet.data);
});

/**
 * Check bitsToUnixModeLine behavior.
 */
it('sftpBitsToUnixModeLine', () => {
  const data = [
    // No mode bits.
    ['?---------', 0o0000],
    // All mode bits.
    ['?rwsrwsrwt', 0o7777],
    // Check the file types.
    ['c---------', 0o0000 | nassh.sftp.packets.PermissionBits.IFCHR],
    ['d---------', 0o0000 | nassh.sftp.packets.PermissionBits.IFDIR],
    ['b---------', 0o0000 | nassh.sftp.packets.PermissionBits.IFBLK],
    ['----------', 0o0000 | nassh.sftp.packets.PermissionBits.IFREG],
    ['p---------', 0o0000 | nassh.sftp.packets.PermissionBits.IFIFO],
    ['l---------', 0o0000 | nassh.sftp.packets.PermissionBits.IFLNK],
    ['s---------', 0o0000 | nassh.sftp.packets.PermissionBits.IFSOCK],
    // Check the extended bits.
    ['?--s--x--x', 0o4111],
    ['?--x--s--x', 0o2111],
    ['?--x--x--t', 0o1111],
    // Check the permission bits with common modes.
    ['?rwxrwxrwx', 0o0777],
    ['?rwxr-xr-x', 0o0755],
    ['?rw-rw-rw-', 0o0666],
    ['?rw-r--r--', 0o0644],
  ];
  data.forEach(([expected, mode]) => {
    assert.equal(expected, nassh.sftp.packets.bitsToUnixModeLine(mode));
  });
});

/**
 * Check getFileAttrs behavior.
 */
it('sftpGetFileAttrs', () => {
  // Start with a simple packet.
  let packet = new nassh.sftp.Packet([0x00, 0x00, 0x00, 0x00]);
  let attrs = nassh.sftp.packets.getFileAttrs(packet);
  assert.isTrue(packet.eod());
  assert.equal(0, attrs.flags);
  assert.isUndefined(attrs.size);
  assert.isUndefined(attrs.uid);
  assert.isUndefined(attrs.gid);
  assert.isUndefined(attrs.permissions);
  assert.isUndefined(attrs.lastAccessed);
  assert.isUndefined(attrs.lastModified);

  // Check size handling.
  packet = new nassh.sftp.Packet(
      [0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x12, 0x34, 0x56, 0x78]);
  attrs = nassh.sftp.packets.getFileAttrs(packet);
  assert.isTrue(packet.eod());
  assert.equal(nassh.sftp.packets.FileXferAttrs.SIZE, attrs.flags);
  assert.equal(0x12345678, attrs.size);

  // Check uid/gid handling.
  packet = new nassh.sftp.Packet(
      [0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x03, 0xe8, 0x00, 0x00, 0x13, 0x88]);
  attrs = nassh.sftp.packets.getFileAttrs(packet);
  assert.isTrue(packet.eod());
  assert.equal(nassh.sftp.packets.FileXferAttrs.UIDGID, attrs.flags);
  assert.equal(1000, attrs.uid);
  assert.equal(5000, attrs.gid);

  // Check permissions handling.
  packet = new nassh.sftp.Packet(
      [0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x0f, 0xff]);
  attrs = nassh.sftp.packets.getFileAttrs(packet);
  assert.isTrue(packet.eod());
  assert.equal(nassh.sftp.packets.FileXferAttrs.PERMISSIONS, attrs.flags);
  assert.equal(0o7777, attrs.permissions);

  // Check time handling.
  packet = new nassh.sftp.Packet(
      [0x00, 0x00, 0x00, 0x08, 0x3b, 0x9a, 0xca, 0x00, 0x59, 0x68, 0x2f, 0x00]);
  attrs = nassh.sftp.packets.getFileAttrs(packet);
  assert.isTrue(packet.eod());
  assert.equal(nassh.sftp.packets.FileXferAttrs.ACMODTIME, attrs.flags);
  assert.equal(1000000000, attrs.lastAccessed);
  assert.equal(1500000000, attrs.lastModified);

  // Now altogether!
  packet = new nassh.sftp.Packet([
      0x00, 0x00, 0x00, 0x0f,
      0x00, 0x00, 0x00, 0x00, 0x12, 0x34, 0x56, 0x78,
      0x00, 0x00, 0x03, 0xe8, 0x00, 0x00, 0x13, 0x88,
      0x00, 0x00, 0x0f, 0xff,
      0x3b, 0x9a, 0xca, 0x00, 0x59, 0x68, 0x2f, 0x00,
  ]);
  attrs = nassh.sftp.packets.getFileAttrs(packet);
  assert.isTrue(packet.eod());
  assert.equal(nassh.sftp.packets.FileXferAttrs.SIZE |
               nassh.sftp.packets.FileXferAttrs.UIDGID |
               nassh.sftp.packets.FileXferAttrs.PERMISSIONS |
               nassh.sftp.packets.FileXferAttrs.ACMODTIME, attrs.flags);
  assert.equal(0x12345678, attrs.size);
  assert.equal(1000, attrs.uid);
  assert.equal(5000, attrs.gid);
  assert.equal(0o7777, attrs.permissions);
  assert.equal(1000000000, attrs.lastAccessed);
  assert.equal(1500000000, attrs.lastModified);
});

/**
 * Check setFileAttrs behavior.
 */
it('sftpSetFileAttrs', () => {
  // Start with a simple packet.
  let packet = new nassh.sftp.Packet();
  nassh.sftp.packets.setFileAttrs(packet, {flags: 0});
  assert.equal(4, packet.getLength());
  assert.deepStrictEqual(new Uint8Array([0x00, 0x00, 0x00, 0x00]),
                         packet.toByteArray());

  // Check size handling.
  packet = new nassh.sftp.Packet();
  nassh.sftp.packets.setFileAttrs(packet, {
    flags: nassh.sftp.packets.FileXferAttrs.SIZE,
    size: 0x12345678,
  });
  assert.equal(12, packet.getLength());
  assert.deepStrictEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x01,
                      0x00, 0x00, 0x00, 0x00, 0x12, 0x34, 0x56, 0x78]),
      packet.toByteArray());

  // Check uid/gid handling.
  packet = new nassh.sftp.Packet();
  nassh.sftp.packets.setFileAttrs(packet, {
    flags: nassh.sftp.packets.FileXferAttrs.UIDGID,
    uid: 1000,
    gid: 5000,
  });
  assert.equal(12, packet.getLength());
  assert.deepStrictEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x02,
                      0x00, 0x00, 0x03, 0xe8, 0x00, 0x00, 0x13, 0x88]),
      packet.toByteArray());

  // Check permissions handling.
  packet = new nassh.sftp.Packet();
  nassh.sftp.packets.setFileAttrs(packet, {
    flags: nassh.sftp.packets.FileXferAttrs.PERMISSIONS,
    permissions: 0o7777,
  });
  assert.equal(8, packet.getLength());
  assert.deepStrictEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x0f, 0xff]),
      packet.toByteArray());

  // Check time handling.
  packet = new nassh.sftp.Packet();
  nassh.sftp.packets.setFileAttrs(packet, {
    flags: nassh.sftp.packets.FileXferAttrs.ACMODTIME,
    lastAccessed: 1000000000,
    lastModified: 1500000000,
  });
  assert.equal(12, packet.getLength());
  assert.deepStrictEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x08,
                      0x3b, 0x9a, 0xca, 0x00, 0x59, 0x68, 0x2f, 0x00]),
      packet.toByteArray());

  // Now altogether!
  packet = new nassh.sftp.Packet();
  nassh.sftp.packets.setFileAttrs(packet, {
    flags: nassh.sftp.packets.FileXferAttrs.SIZE |
           nassh.sftp.packets.FileXferAttrs.UIDGID |
           nassh.sftp.packets.FileXferAttrs.PERMISSIONS |
           nassh.sftp.packets.FileXferAttrs.ACMODTIME,
    size: 0x12345678,
    uid: 1000,
    gid: 5000,
    permissions: 0o7777,
    lastAccessed: 1000000000,
    lastModified: 1500000000,
  });
  assert.equal(32, packet.getLength());
  assert.deepStrictEqual(
      new Uint8Array([0x00, 0x00, 0x00, 0x0f,
                      0x00, 0x00, 0x00, 0x00, 0x12, 0x34, 0x56, 0x78,
                      0x00, 0x00, 0x03, 0xe8, 0x00, 0x00, 0x13, 0x88,
                      0x00, 0x00, 0x0f, 0xff,
                      0x3b, 0x9a, 0xca, 0x00, 0x59, 0x68, 0x2f, 0x00]),
      packet.toByteArray());
});

/**
 * Check epochToLocal behavior.
 */
it('sftpEpochToLocal', () => {
  const data = [
    ['Thu, 01 Jan 1970 00:00:00 GMT', 0],
    ['Sun, 09 Sep 2001 01:46:40 GMT', 1000000000],
    ['Fri, 14 Jul 2017 02:40:00 GMT', 1500000000],
  ];
  data.forEach(([expected, seconds]) => {
    assert.equal(expected,
                 nassh.sftp.packets.epochToLocal(seconds).toUTCString());
  });
});

});
