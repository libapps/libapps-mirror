// Copyright (c) 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

nassh.sftp.packets = {};

/**
 * Possible status code values.
 */
nassh.sftp.packets.StatusCodes = {
  OK:                0,
  EOF:               1,
  NO_SUCH_FILE:      2,
  PERMISSION_DENIED: 3,
  FAILURE:           4,
  BAD_MESSAGE:       5,
  NO_CONNECTION:     6,
  CONNECTION_LOST:   7,
  OP_UNSUPPORTED:    8,
};

/**
 * SFTP Status Packet containing the request id, status codes, status message
 * and language.
 */
nassh.sftp.packets.StatusPacket = function(packet) {
  this.requestId = packet.getUint32();
  this.code = packet.getUint32();
  this.message = packet.getString();
  this.lang = packet.getString();
};

/**
 * SFTP Data Packet containing the request id and associated data.
 */
nassh.sftp.packets.DataPacket = function(packet) {
  this.requestId = packet.getUint32();
  this.data = packet.getString();
};

/**
 * SFTP Handle Packet containing the request id and a file handle.
 */
nassh.sftp.packets.HandlePacket = function(packet) {
  this.requestId = packet.getUint32();
  this.handle = packet.getString();
};

/**
 * SFTP Name Packet containing the request id, file count and an array of file
 * attributes.
 */
nassh.sftp.packets.NamePacket = function(packet) {
  this.requestId = packet.getUint32();
  this.fileCount = packet.getUint32();
  this.files = [];

  for(var i = 0; i < this.fileCount; i++) {
    var fileName = packet.getString();
    var longFileName = packet.getString();

    var fileData = nassh.sftp.packets.getFileAttrs(packet);

    fileData.filename = fileName;
    fileData.long_filename = longFileName;

    this.files.push(fileData);
  }
};

/**
 * SFTP Attrs Packet containing the request id and a file's attributes.
 */
nassh.sftp.packets.AttrsPacket = function(packet) {
  this.requestId = packet.getUint32();
  this.attrs = nassh.sftp.packets.getFileAttrs(packet);
};

/**
 * Unknown Packet containing the request id (potentially garbage) and associated
 * data (also potentially garbage).
 */
nassh.sftp.packets.UnknownPacket = function(packet) {
  this.requestId = packet.getUint32();
  this.data = packet.getData();
};

/**
 * Possible SFTP File Transfer flags attributes (SSH_FILEXFER_ATTR_XXX).
 */
nassh.sftp.packets.FileXferAttrs = {
  SIZE:        0x00000001,
  UIDGID:      0x00000002,
  PERMISSIONS: 0x00000004,
  ACMODTIME:   0x00000008,
  EXTENDED:    0x10000000,
};

/**
 * Possible SFTP permission bits.
 *
 * Note: The RFC says:
 *   The `permissions' field contains a bit mask of file permissions as
 *   defined by posix.
 * Except that POSIX only defines the bit values for permissions (ones that
 * start with S_Ixxx).  It does not define the bit values for file types
 * (ones that start with S_IFxxx).  We use "common" Linux ones for that.
 */
nassh.sftp.packets.PermissionBits = {
  SMODE:  0o007777,  // Mask for file mode bits.
  ISVTX:  0o001000,  // Sticky directory.
  ISGID:  0o002000,  // Setgid.
  ISUID:  0o004000,  // Setuid.

  IFMT:   0o170000,  // Mask for IFxxx fields below.
  IFCHR:  0o020000,  // Character special.
  IFDIR:  0o040000,  // Directory.
  IFBLK:  0o060000,  // Block special.
  IFREG:  0o100000,  // Regular file.
  IFIFO:  0o010000,  // FIFO special.
  IFLNK:  0o120000,  // Symbolic link.
  IFSOCK: 0o140000,  // Socket.
};

/**
 * Convert permission bits into a standard UNIX summary.
 *
 * Typically used in conjunction with AttrsPacket and the permissions field.
 *
 * The output will look similar to `ls -l`.  e.g. "drwxr-xr-x".
 *
 * @param {integer} bits The permission bits to convert.
 * @return {string} The short `ls -l`-like summary.
 */
nassh.sftp.packets.bitsToUnixModeLine = function(bits) {
  var ret = '';

  // First handle the file type.
  var ifmt = bits & nassh.sftp.packets.PermissionBits.IFMT;
  var fmtMap = {
    [nassh.sftp.packets.PermissionBits.IFCHR]: 'c',
    [nassh.sftp.packets.PermissionBits.IFDIR]: 'd',
    [nassh.sftp.packets.PermissionBits.IFBLK]: 'b',
    [nassh.sftp.packets.PermissionBits.IFREG]: '-',
    [nassh.sftp.packets.PermissionBits.IFIFO]: 'p',
    [nassh.sftp.packets.PermissionBits.IFLNK]: 'l',
    [nassh.sftp.packets.PermissionBits.IFSOCK]: 's',
  };
  if (fmtMap[ifmt] === null)
    ret += '?';
  else
    ret += fmtMap[ifmt];

  // Then handle user/group/other permissions.
  function threebits(bits, sid, x, X) {
    if (!sid)
      x = 'x', X = '-';
    return ((bits & 0o4) ? 'r' : '-') +
           ((bits & 0o2) ? 'w' : '-') +
           ((bits & 0o1) ? x : X);
  }

  ret += threebits(bits >> 6, (bits & nassh.sftp.packets.PermissionBits.ISUID),
                   's', 'S');
  ret += threebits(bits >> 3, (bits & nassh.sftp.packets.PermissionBits.IGUID),
                   's', 'S');
  ret += threebits(bits >> 0, (bits & nassh.sftp.packets.PermissionBits.ISVTX),
                   't', 'T');

  return ret;
};

/**
 * Given a packet (at the correct offset), will read one file's attributes.
 */
nassh.sftp.packets.getFileAttrs = function(packet) {
  var attrs = {};

  attrs.flags = packet.getUint32();
  if (attrs.flags & nassh.sftp.packets.FileXferAttrs.SIZE) {
    attrs.size = packet.getUint64();
  }
  if (attrs.flags & nassh.sftp.packets.FileXferAttrs.UIDGID) {
    attrs.uid = packet.getUint32();
    attrs.gid = packet.getUint32();
  }
  if (attrs.flags & nassh.sftp.packets.FileXferAttrs.PERMISSIONS) {
    attrs.permissions = packet.getUint32();
  }
  if (attrs.flags & nassh.sftp.packets.FileXferAttrs.ACMODTIME) {
    attrs.last_accessed = packet.getUint32();
    attrs.last_modified = packet.getUint32();
  }
  if (attrs.flags & nassh.sftp.packets.FileXferAttrs.EXTENDED) {
    var extendedCount = packet.getUint32();
    attrs.extendedCount = extendedCount;
    var extendedData = [];

    for(var i = 0; i < extendedCount; i++) {
      extendedData.push({
        'type': packet.getString(),
        'data': packet.getString()
      });
    }

    attrs.extensions = extendedData;
  }

  return attrs;
};

/**
 * Serialize an attribute object back into a packet.
 */
nassh.sftp.packets.setFileAttrs = function(packet, attrs) {
  // We only add fields we know how to handle.
  packet.setUint32(attrs.flags & (
    nassh.sftp.packets.FileXferAttrs.SIZE |
    nassh.sftp.packets.FileXferAttrs.UIDGID |
    nassh.sftp.packets.FileXferAttrs.PERMISSIONS |
    nassh.sftp.packets.FileXferAttrs.ACMODTIME
  ));

  if (attrs.flags & nassh.sftp.packets.FileXferAttrs.SIZE) {
    packet.setUint64(attrs.size);
  }
  if (attrs.flags & nassh.sftp.packets.FileXferAttrs.UIDGID) {
    packet.setUint32(attrs.uid);
    packet.setUint32(attrs.gid);
  }
  if (attrs.flags & nassh.sftp.packets.FileXferAttrs.PERMISSIONS) {
    packet.setUint32(attrs.permissions);
  }
  if (attrs.flags & nassh.sftp.packets.FileXferAttrs.ACMODTIME) {
    packet.setUint32(attrs.last_accessed);
    packet.setUint32(attrs.last_modified);
  }
};

/**
 * Convert UTC epoch timestamps that we get from the server to local time.
 *
 * Typically used in conjunction with AttrsPacket and the last_accessed &
 * last_modified fields.  This is the same thing as "UNIX time".
 *
 * @param {integer} epoch The epoch time to convert.
 * @return {Date} A standard Date object.
 */
nassh.sftp.packets.epochToLocal = function(epoch) {
  var date = new Date(0);
  date.setUTCSeconds(epoch);
  return date;
};

/**
 * Possible SFTP Request Packet types
 */
nassh.sftp.packets.RequestPackets = {
  INIT:     1,
  VERSION:  2,
  OPEN:     3,
  CLOSE:    4,
  READ:     5,
  WRITE:    6,
  LSTAT:    7,
  FSTAT:    8,
  SETSTAT:  9,
  FSETSTAT: 10,
  OPENDIR:  11,
  READDIR:  12,
  REMOVE:   13,
  MKDIR:    14,
  RMDIR:    15,
  REALPATH: 16,
  STAT:     17,
  RENAME:   18,
  READLINK: 19,
  SYMLINK:  20,
};

/**
 * Possible SFTP Response Packet types
 */
nassh.sftp.packets.ResponsePackets = {
  101: nassh.sftp.packets.StatusPacket,
  102: nassh.sftp.packets.HandlePacket,
  103: nassh.sftp.packets.DataPacket,
  104: nassh.sftp.packets.NamePacket,
  105: nassh.sftp.packets.AttrsPacket,
};

/**
 * Possible bit flags with open packets.
 */
nassh.sftp.packets.OpenFlags = {
  READ:   0x00000001,
  WRITE:  0x00000002,
  APPEND: 0x00000004,
  CREAT:  0x00000008,
  TRUNC:  0x00000010,
  EXCL:   0x00000020,
};
