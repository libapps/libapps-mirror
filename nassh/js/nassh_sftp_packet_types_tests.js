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
  result.assertEQ(true, dataPacket.eod());

  result.assertEQ(0x01020304, packet.requestId);
  result.assertEQ(0xabcdef11, packet.code);
  result.assertEQ('status', packet.message);
  result.assertEQ('', packet.lang);

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
  result.assertEQ(true, dataPacket.eod());

  result.assertEQ(0x01020304, packet.requestId);
  result.assertEQ('data', packet.data);

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
  result.assertEQ(true, dataPacket.eod());

  result.assertEQ(0x01020304, packet.requestId);
  result.assertEQ('data', packet.handle);

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
  result.assertEQ(true, dataPacket.eod());

  result.assertEQ(0x01020304, packet.requestId);
  result.assertEQ(0, packet.fileCount);
  result.assertEQ([], packet.files);

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
  result.assertEQ(true, dataPacket.eod());

  result.assertEQ(0x01020304, packet.requestId);
  result.assertEQ(3, packet.fileCount);

  // Check file 1 (empty).
  let file = packet.files[0];
  result.assertEQ('', file.filename);
  result.assertEQ('', file.long_filename);
  result.assertEQ(0, file.flags);

  // Check file 2 (normal).
  file = packet.files[1];
  result.assertEQ('abc', file.filename);
  result.assertEQ('-rwxr-xr-x  1 root  root  8560 Oct 23 23:30 abc',
                  file.long_filename);
  result.assertEQ(0, file.flags);

  // Check file 3 (unicode).
  file = packet.files[2];
  result.assertEQ('日本語', file.filename);
  result.assertEQ('-rw-rw-rw 日本語', file.long_filename);
  result.assertEQ(1, file.flags);
  result.assertEQ(3, file.size);

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
  result.assertEQ(true, dataPacket.eod());

  // Check empty attrs.
  result.assertEQ(0x01020304, packet.requestId);
  result.assertEQ(0, packet.attrs.flags);

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
  result.assertEQ(true, dataPacket.eod());

  // Check the fields.
  result.assertEQ('init', packet.requestId);
  result.assertEQ(3, packet.version);

  // Check the extensions.
  result.assertEQ([], Object.keys(packet.extensions));

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
  result.assertEQ(true, dataPacket.eod());

  // Check the fields.
  result.assertEQ('init', packet.requestId);
  result.assertEQ(6, packet.version);

  // Check the extensions.
  result.assertEQ('data', packet.extensions['ext@foo']);
  result.assertEQ('1', packet.extensions['ext@ok.com']);
  result.assertEQ(undefined, packet.extensions['name']);

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
    if (nassh.sftp.packets.ValidExtension(ext)) {
      result.fail();
    }
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
    if (!nassh.sftp.packets.ValidExtension(ext)) {
      result.fail();
    }
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
  result.assertEQ(true, dataPacket.eod());

  result.assertEQ(0x01020304, packet.requestId);
  result.assertEQ('abc', packet.data);

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
    result.assertEQ(expected, nassh.sftp.packets.bitsToUnixModeLine(mode));
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
  result.assertEQ(true, packet.eod());
  result.assertEQ(0, attrs.flags);
  result.assertEQ(undefined, attrs.size);
  result.assertEQ(undefined, attrs.uid);
  result.assertEQ(undefined, attrs.gid);
  result.assertEQ(undefined, attrs.permissions);
  result.assertEQ(undefined, attrs.last_accessed);
  result.assertEQ(undefined, attrs.last_modified);

  // Check size handling.
  packet = new nassh.sftp.Packet('\x00\x00\x00\x01' +
                                 '\x00\x00\x00\x00\x12\x34\x56\x78');
  attrs = nassh.sftp.packets.getFileAttrs(packet);
  result.assertEQ(true, packet.eod());
  result.assertEQ(nassh.sftp.packets.FileXferAttrs.SIZE, attrs.flags);
  result.assertEQ(0x12345678, attrs.size);

  // Check uid/gid handling.
  packet = new nassh.sftp.Packet('\x00\x00\x00\x02' +
                                 '\x00\x00\x03\xe8\x00\x00\x13\x88');
  attrs = nassh.sftp.packets.getFileAttrs(packet);
  result.assertEQ(true, packet.eod());
  result.assertEQ(nassh.sftp.packets.FileXferAttrs.UIDGID, attrs.flags);
  result.assertEQ(1000, attrs.uid);
  result.assertEQ(5000, attrs.gid);

  // Check permissions handling.
  packet = new nassh.sftp.Packet('\x00\x00\x00\x04\x00\x00\x0f\xff');
  attrs = nassh.sftp.packets.getFileAttrs(packet);
  result.assertEQ(true, packet.eod());
  result.assertEQ(nassh.sftp.packets.FileXferAttrs.PERMISSIONS, attrs.flags);
  result.assertEQ(0o7777, attrs.permissions);

  // Check time handling.
  packet = new nassh.sftp.Packet('\x00\x00\x00\x08' +
                                 '\x3b\x9a\xca\x00\x59\x68\x2f\x00');
  attrs = nassh.sftp.packets.getFileAttrs(packet);
  result.assertEQ(true, packet.eod());
  result.assertEQ(nassh.sftp.packets.FileXferAttrs.ACMODTIME, attrs.flags);
  result.assertEQ(1000000000, attrs.last_accessed);
  result.assertEQ(1500000000, attrs.last_modified);

  // Now altogether!
  packet = new nassh.sftp.Packet('\x00\x00\x00\x0f' +
                                 '\x00\x00\x00\x00\x12\x34\x56\x78' +
                                 '\x00\x00\x03\xe8\x00\x00\x13\x88' +
                                 '\x00\x00\x0f\xff' +
                                 '\x3b\x9a\xca\x00\x59\x68\x2f\x00');
  attrs = nassh.sftp.packets.getFileAttrs(packet);
  result.assertEQ(true, packet.eod());
  result.assertEQ(nassh.sftp.packets.FileXferAttrs.SIZE |
                  nassh.sftp.packets.FileXferAttrs.UIDGID |
                  nassh.sftp.packets.FileXferAttrs.PERMISSIONS |
                  nassh.sftp.packets.FileXferAttrs.ACMODTIME, attrs.flags);
  result.assertEQ(0x12345678, attrs.size);
  result.assertEQ(1000, attrs.uid);
  result.assertEQ(5000, attrs.gid);
  result.assertEQ(0o7777, attrs.permissions);
  result.assertEQ(1000000000, attrs.last_accessed);
  result.assertEQ(1500000000, attrs.last_modified);

  result.pass();
});

/**
 * Check setFileAttrs behavior.
 */
nassh.sftp.packets.Tests.addTest('sftpSetFileAttrs', function(result, cx) {
  // Start with a simple packet.
  let packet = new nassh.sftp.Packet();
  nassh.sftp.packets.setFileAttrs(packet, {flags: 0});
  result.assertEQ(4, packet.getLength());
  result.assertEQ('\x00\x00\x00\x00', packet.toString());

  // Check size handling.
  packet = new nassh.sftp.Packet();
  nassh.sftp.packets.setFileAttrs(packet, {
    flags: nassh.sftp.packets.FileXferAttrs.SIZE,
    size: 0x12345678,
  });
  result.assertEQ(12, packet.getLength());
  result.assertEQ('\x00\x00\x00\x01\x00\x00\x00\x00\x12\x34\x56\x78',
                  packet.toString());

  // Check uid/gid handling.
  packet = new nassh.sftp.Packet();
  nassh.sftp.packets.setFileAttrs(packet, {
    flags: nassh.sftp.packets.FileXferAttrs.UIDGID,
    uid: 1000,
    gid: 5000,
  });
  result.assertEQ(12, packet.getLength());
  result.assertEQ('\x00\x00\x00\x02\x00\x00\x03\xe8\x00\x00\x13\x88',
                  packet.toString());

  // Check permissions handling.
  packet = new nassh.sftp.Packet();
  nassh.sftp.packets.setFileAttrs(packet, {
    flags: nassh.sftp.packets.FileXferAttrs.PERMISSIONS,
    permissions: 0o7777,
  });
  result.assertEQ(8, packet.getLength());
  result.assertEQ('\x00\x00\x00\x04\x00\x00\x0f\xff',
                  packet.toString());

  // Check time handling.
  packet = new nassh.sftp.Packet();
  nassh.sftp.packets.setFileAttrs(packet, {
    flags: nassh.sftp.packets.FileXferAttrs.ACMODTIME,
    last_accessed: 1000000000,
    last_modified: 1500000000,
  });
  result.assertEQ(12, packet.getLength());
  result.assertEQ('\x00\x00\x00\x08\x3b\x9a\xca\x00\x59\x68\x2f\x00',
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
  result.assertEQ(32, packet.getLength());
  result.assertEQ('\x00\x00\x00\x0f' +
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
    result.assertEQ(expected,
                    nassh.sftp.packets.epochToLocal(seconds).toUTCString());
  });
  result.pass();
});
