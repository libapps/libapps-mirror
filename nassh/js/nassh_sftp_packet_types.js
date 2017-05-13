// Copyright (c) 2017 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

nassh.sftp.packets = {};

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
