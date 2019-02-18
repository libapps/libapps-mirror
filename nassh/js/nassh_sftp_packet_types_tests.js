// Copyright 2018 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview SFTP low level protocol tests.
 */

/**
 * Verify StatusPacket deserialization.
 */
nassh.sftp.packets.Tests.addTest('sftpStatusPacket', function(result, cx) {
  const dataPacket = new nassh.sftp.Packet(
      // 32-bit request id.
      '\x01\x02\x03\x04' +
      // 32-bit code.
      '\xab\xcd\xef\x11' +
      // Message string.
      '\x00\x00\x00\x06status' +
      // Language string.
      '\x00\x00\x00\x00'
  );

  const packet = new nassh.sftp.packets.StatusPacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  assert.equal(0x01020304, packet.requestId);
  assert.equal(0xabcdef11, packet.code);
  assert.equal('status', packet.message);
  assert.equal('', packet.lang);

  result.pass();
});

/**
 * Verify DataPacket deserialization.
 */
nassh.sftp.packets.Tests.addTest('sftpDataPacket', function(result, cx) {
  const dataPacket = new nassh.sftp.Packet(
      // 32-bit request id.
      '\x01\x02\x03\x04' +
      // Data string.
      '\x00\x00\x00\x04data'
  );

  const packet = new nassh.sftp.packets.DataPacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  assert.equal(0x01020304, packet.requestId);
  assert.equal('data', packet.data);

  result.pass();
});

/**
 * Verify HandlePacket deserialization.
 */
nassh.sftp.packets.Tests.addTest('sftpHandlePacket', function(result, cx) {
  const dataPacket = new nassh.sftp.Packet(
      // 32-bit request id.
      '\x01\x02\x03\x04' +
      // Handle string.
      '\x00\x00\x00\x04data'
  );

  const packet = new nassh.sftp.packets.HandlePacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  assert.equal(0x01020304, packet.requestId);
  assert.equal('data', packet.handle);

  result.pass();
});

/**
 * Verify empty NamePacket deserialization.
 */
nassh.sftp.packets.Tests.addTest('sftpNamePacketEmpty', function(result, cx) {
  const dataPacket = new nassh.sftp.Packet(
      // 32-bit request id.
      '\x01\x02\x03\x04' +
      // 32-bit file count.
      '\x00\x00\x00\x00'
  );

  const packet = new nassh.sftp.packets.NamePacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  assert.equal(0x01020304, packet.requestId);
  assert.equal(0, packet.fileCount);
  assert.deepStrictEqual([], packet.files);

  result.pass();
});

/**
 * Verify non-empty NamePacket deserialization.
 */
nassh.sftp.packets.Tests.addTest('sftpNamePacket', function(result, cx) {
  const te = new TextEncoder();
  const dataPacket = new nassh.sftp.Packet(
      // 32-bit request id.
      '\x01\x02\x03\x04' +
      // 32-bit file count.
      '\x00\x00\x00\x03' +
      // File 1: (empty) name.
      '\x00\x00\x00\x00' +
      // File 1: (empty) long name.
      '\x00\x00\x00\x00' +
      // File 1: (no) attributes.
      '\x00\x00\x00\x00' +
      // File 2: normal name.
      '\x00\x00\x00\x03abc' +
      // File 2: normal long name.
      '\x00\x00\x00\x2f-rwxr-xr-x  1 root  root  8560 Oct 23 23:30 abc' +
      // File 2: (no) attributes.
      '\x00\x00\x00\x00' +
      // File 3: unicode name.
      '\x00\x00\x00\x09' +
      lib.codec.codeUnitArrayToString(te.encode('日本語')) +
      // File 3: unicode long name.
      '\x00\x00\x00\x13-rw-rw-rw ' +
      lib.codec.codeUnitArrayToString(te.encode('日本語')) +
      // File 3: simple attributes.
      '\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00\x03'
  );

  const packet = new nassh.sftp.packets.NamePacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  assert.equal(0x01020304, packet.requestId);
  assert.equal(3, packet.fileCount);

  // Check file 1 (empty).
  let file = packet.files[0];
  assert.equal('', file.filename);
  assert.equal('', file.long_filename);
  assert.equal(0, file.flags);

  // Check file 2 (normal).
  file = packet.files[1];
  assert.equal('abc', file.filename);
  assert.equal('-rwxr-xr-x  1 root  root  8560 Oct 23 23:30 abc',
               file.long_filename);
  assert.equal(0, file.flags);

  // Check file 3 (unicode).
  file = packet.files[2];
  assert.equal('日本語', file.filename);
  assert.equal('-rw-rw-rw 日本語', file.long_filename);
  assert.equal(1, file.flags);
  assert.equal(3, file.size);

  result.pass();
});

/**
 * Verify AttrsPacket deserialization.
 *
 * This test is a bit light as we unit test getFileAttrs directly.
 */
nassh.sftp.packets.Tests.addTest('sftpAttrsPacket', function(result, cx) {
  const dataPacket = new nassh.sftp.Packet(
      // 32-bit request id.
      '\x01\x02\x03\x04' +
      // Attrs: no bits sent.
      '\x00\x00\x00\x00'
  );

  const packet = new nassh.sftp.packets.AttrsPacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  // Check empty attrs.
  assert.equal(0x01020304, packet.requestId);
  assert.equal(0, packet.attrs.flags);

  result.pass();
});

/**
 * Verify basic VersionPacket deserialization.
 */
nassh.sftp.packets.Tests.addTest('sftpVersionPacket', function(result, cx) {
  const dataPacket = new nassh.sftp.Packet(
      // 32-bit version.
      '\x00\x00\x00\x03'
  );

  const packet = new nassh.sftp.packets.VersionPacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  // Check the fields.
  assert.equal('init', packet.requestId);
  assert.equal(3, packet.version);

  // Check the extensions.
  assert.deepStrictEqual([], Object.keys(packet.extensions));

  result.pass();
});

/**
 * Verify VersionPacket w/extensions deserialization.
 */
nassh.sftp.packets.Tests.addTest('sftpVersionPacketExt', function(result, cx) {
  const dataPacket = new nassh.sftp.Packet(
      // 32-bit version.
      '\x00\x00\x00\x06' +
      // Extension 1: name.
      '\x00\x00\x00\x07ext@foo' +
      // Extension 1: data.
      '\x00\x00\x00\x04data' +
      // Extension 2: name.
      '\x00\x00\x00\x0aext@ok.com' +
      // Extension 2: data.
      '\x00\x00\x00\x011' +
      // Extension 3: (invalid) name.
      '\x00\x00\x00\x05n@m@e' +
      // Extension 3: data.
      '\x00\x00\x00\x04blah'
  );

  const packet = new nassh.sftp.packets.VersionPacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  // Check the fields.
  assert.equal('init', packet.requestId);
  assert.equal(6, packet.version);

  // Check the extensions.
  assert.equal('data', packet.extensions['ext@foo']);
  assert.equal('1', packet.extensions['ext@ok.com']);
  assert.isUndefined(packet.extensions['name']);

  result.pass();
});

/**
 * Check ValidExtension behavior.
 */
nassh.sftp.packets.Tests.addTest('sftpValidExtension', function(result, cx) {
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

  result.pass();
});

/**
 * Verify UnknownPacket deserialization.
 */
nassh.sftp.packets.Tests.addTest('sftpUnknownPacket', function(result, cx) {
  const dataPacket = new nassh.sftp.Packet(
      // 32-bit request id.
      '\x01\x02\x03\x04' +
      // Whatever is left.
      'abc'
  );

  const packet = new nassh.sftp.packets.UnknownPacket(dataPacket);
  assert.isTrue(dataPacket.eod());

  assert.equal(0x01020304, packet.requestId);
  assert.equal('abc', packet.data);

  result.pass();
});

/**
 * Check bitsToUnixModeLine behavior.
 */
nassh.sftp.packets.Tests.addTest('sftpBitsToUnixModeLine', function(result, cx) {
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
  result.pass();
});

/**
 * Check getFileAttrs behavior.
 */
nassh.sftp.packets.Tests.addTest('sftpGetFileAttrs', function(result, cx) {
  // Start with a simple packet.
  let packet = new nassh.sftp.Packet('\x00\x00\x00\x00');
  let attrs = nassh.sftp.packets.getFileAttrs(packet);
  assert.isTrue(packet.eod());
  assert.equal(0, attrs.flags);
  assert.isUndefined(attrs.size);
  assert.isUndefined(attrs.uid);
  assert.isUndefined(attrs.gid);
  assert.isUndefined(attrs.permissions);
  assert.isUndefined(attrs.last_accessed);
  assert.isUndefined(attrs.last_modified);

  // Check size handling.
  packet = new nassh.sftp.Packet('\x00\x00\x00\x01' +
                                 '\x00\x00\x00\x00\x12\x34\x56\x78');
  attrs = nassh.sftp.packets.getFileAttrs(packet);
  assert.isTrue(packet.eod());
  assert.equal(nassh.sftp.packets.FileXferAttrs.SIZE, attrs.flags);
  assert.equal(0x12345678, attrs.size);

  // Check uid/gid handling.
  packet = new nassh.sftp.Packet('\x00\x00\x00\x02' +
                                 '\x00\x00\x03\xe8\x00\x00\x13\x88');
  attrs = nassh.sftp.packets.getFileAttrs(packet);
  assert.isTrue(packet.eod());
  assert.equal(nassh.sftp.packets.FileXferAttrs.UIDGID, attrs.flags);
  assert.equal(1000, attrs.uid);
  assert.equal(5000, attrs.gid);

  // Check permissions handling.
  packet = new nassh.sftp.Packet('\x00\x00\x00\x04\x00\x00\x0f\xff');
  attrs = nassh.sftp.packets.getFileAttrs(packet);
  assert.isTrue(packet.eod());
  assert.equal(nassh.sftp.packets.FileXferAttrs.PERMISSIONS, attrs.flags);
  assert.equal(0o7777, attrs.permissions);

  // Check time handling.
  packet = new nassh.sftp.Packet('\x00\x00\x00\x08' +
                                 '\x3b\x9a\xca\x00\x59\x68\x2f\x00');
  attrs = nassh.sftp.packets.getFileAttrs(packet);
  assert.isTrue(packet.eod());
  assert.equal(nassh.sftp.packets.FileXferAttrs.ACMODTIME, attrs.flags);
  assert.equal(1000000000, attrs.last_accessed);
  assert.equal(1500000000, attrs.last_modified);

  // Now altogether!
  packet = new nassh.sftp.Packet('\x00\x00\x00\x0f' +
                                 '\x00\x00\x00\x00\x12\x34\x56\x78' +
                                 '\x00\x00\x03\xe8\x00\x00\x13\x88' +
                                 '\x00\x00\x0f\xff' +
                                 '\x3b\x9a\xca\x00\x59\x68\x2f\x00');
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
  assert.equal(1000000000, attrs.last_accessed);
  assert.equal(1500000000, attrs.last_modified);

  result.pass();
});

/**
 * Check setFileAttrs behavior.
 */
nassh.sftp.packets.Tests.addTest('sftpSetFileAttrs', function(result, cx) {
  // Start with a simple packet.
  let packet = new nassh.sftp.Packet();
  nassh.sftp.packets.setFileAttrs(packet, {flags: 0});
  assert.equal(4, packet.getLength());
  assert.equal('\x00\x00\x00\x00', packet.toString());

  // Check size handling.
  packet = new nassh.sftp.Packet();
  nassh.sftp.packets.setFileAttrs(packet, {
    flags: nassh.sftp.packets.FileXferAttrs.SIZE,
    size: 0x12345678,
  });
  assert.equal(12, packet.getLength());
  assert.equal('\x00\x00\x00\x01\x00\x00\x00\x00\x12\x34\x56\x78',
               packet.toString());

  // Check uid/gid handling.
  packet = new nassh.sftp.Packet();
  nassh.sftp.packets.setFileAttrs(packet, {
    flags: nassh.sftp.packets.FileXferAttrs.UIDGID,
    uid: 1000,
    gid: 5000,
  });
  assert.equal(12, packet.getLength());
  assert.equal('\x00\x00\x00\x02\x00\x00\x03\xe8\x00\x00\x13\x88',
               packet.toString());

  // Check permissions handling.
  packet = new nassh.sftp.Packet();
  nassh.sftp.packets.setFileAttrs(packet, {
    flags: nassh.sftp.packets.FileXferAttrs.PERMISSIONS,
    permissions: 0o7777,
  });
  assert.equal(8, packet.getLength());
  assert.equal('\x00\x00\x00\x04\x00\x00\x0f\xff',
               packet.toString());

  // Check time handling.
  packet = new nassh.sftp.Packet();
  nassh.sftp.packets.setFileAttrs(packet, {
    flags: nassh.sftp.packets.FileXferAttrs.ACMODTIME,
    last_accessed: 1000000000,
    last_modified: 1500000000,
  });
  assert.equal(12, packet.getLength());
  assert.equal('\x00\x00\x00\x08\x3b\x9a\xca\x00\x59\x68\x2f\x00',
               packet.toString());

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
    last_accessed: 1000000000,
    last_modified: 1500000000,
  });
  assert.equal(32, packet.getLength());
  assert.equal('\x00\x00\x00\x0f' +
               '\x00\x00\x00\x00\x12\x34\x56\x78' +
               '\x00\x00\x03\xe8\x00\x00\x13\x88' +
               '\x00\x00\x0f\xff' +
               '\x3b\x9a\xca\x00\x59\x68\x2f\x00',
               packet.toString());

  result.pass();
});

/**
 * Check epochToLocal behavior.
 */
nassh.sftp.packets.Tests.addTest('sftpEpochToLocal', function(result, cx) {
  const data = [
    ['Thu, 01 Jan 1970 00:00:00 GMT', 0],
    ['Sun, 09 Sep 2001 01:46:40 GMT', 1000000000],
    ['Fri, 14 Jul 2017 02:40:00 GMT', 1500000000],
  ];
  data.forEach(([expected, seconds]) => {
    assert.equal(expected,
                 nassh.sftp.packets.epochToLocal(seconds).toUTCString());
  });
  result.pass();
});
