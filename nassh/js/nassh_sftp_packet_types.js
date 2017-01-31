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
 * Given a packet (at the correct offset), will read one file's attributes.
 */
nassh.sftp.packets.getFileAttrs = function(packet) {
  var attrs = {};

  attrs.flags = packet.getUint32();
  if (attrs.flags & 0x00000001) { // If SSH_FILEXFER_ATTR_SIZE is set.
    attrs.size = packet.getUint64();
  }
  if (attrs.flags & 0x00000002) { // If SSH_FILEXFER_ATTR_UIDGID is set.
    attrs.uid = packet.getUint32();
    attrs.gid = packet.getUint32();
  }
  if (attrs.flags & 0x00000004) { // If SSH_FILEXFER_ATTR_PERMISSIONS is set.
    attrs.permissions = packet.getUint32();
  }
  if (attrs.flags & 0x00000008) { // If SSH_FILEXFER_ACMODTIME is set.
    attrs.last_accessed = packet.getUint32();
    attrs.last_modified = packet.getUint32();
  }
  if (attrs.flags & 0x10000000) { // If SSH_FILEXFER_ATTR_EXTENDED is set.
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
}

/**
 * Possible SFTP Request Packet types
 */
nassh.sftp.packets.RequestPackets = {
  INIT_PACKET:    1,
  OPEN_PACKET:    3,
  CLOSE_PACKET:   4,
  READ_PACKET:    5,
  WRITE_PACKET:   6,
  OPENDIR_PACKET: 11,
  READDIR_PACKET: 12,
  REMOVE_PACKET:  13,
  MKDIR_PACKET:   14,
  RMDIR_PACKET:   15,
  STAT_PACKET:    17,
  RENAME_PACKET:  18,
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