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
  this.length = packet.getUint32();
  this.data = packet.getData(this.length);
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
    const fileName = packet.getUtf8String();
    const longFileName = packet.getUtf8String();

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
 * SFTP Extended Reply Packet.
 *
 * Since extended replies need specific parsers, we just save a reference to the
 * original packet and delay parsing to whatever call made the extended request.
 *
 * @param {nassh.sftp.Packet} packet The source packet to read from.
 */
nassh.sftp.packets.ExtendedReplyPacket = function(packet) {
  this.requestId = packet.getUint32();
  this.rawPacket = packet;
};

/**
 * SFTP response to statvfs@openssh.com packets.
 *
 * @param {nassh.sftp.packets.ExtendedReplyPacket} packet The extended reply.
 */
nassh.sftp.packets.DiskFreePacket = function(packet) {
  const p = packet.rawPacket;
  this.requestId = p.requestId;
  this.bsize = p.getUint64();
  this.frsize = p.getUint64();
  this.blocks = p.getUint64();
  this.bfree = p.getUint64();
  this.bavail = p.getUint64();
  this.files = p.getUint64();
  this.ffree = p.getUint64();
  this.favail = p.getUint64();
  this.fsid_hi = p.getUint32();
  this.fsid_lo = p.getUint32();
  this.flag = p.getUint64();
  this.namemax = p.getUint64();

  this.st_rdonly = !!(this.flag & 0x1);
  this.st_nosuid = !!(this.flag & 0x2);
};

/**
 * Make sure the name conforms to the specification.
 *
 * The SFTP RFC defines the extension-name format:
 * https://tools.ietf.org/html/draft-ietf-secsh-filexfer-02#section-8
 * https://tools.ietf.org/html/draft-ietf-secsh-filexfer-13#section-4.2
 *
 * Which says to follow the SSH "Algorithm and Method Naming" RFC format:
 * https://tools.ietf.org/html/rfc4251#section-6
 *
 * Really we just need this func to filter out extensions that we don't care
 * about in our implementation.  If another one shows up, we can revisit.
 *
 * @param {string} name The protocol name to check.
 * @return {boolean} True if the name is valid.
 */
nassh.sftp.packets.ValidExtension = function(ext) {
  // The RFC is a little ambiguous, but it uses "name" to refer to the entire
  // extension name, not just sub-components (when using the @ form).
  if (ext.length > 64) {
    return false;
  }

  // Split apart the extension@domain format.
  const ary = ext.split('@');
  if (ary.length > 2) {
    return false;
  }
  const [name, domain] = ary;

  // Names cannot contain control chars or whitespace (0x00-0x20), "@" (0x40),
  // "," (0x2c), or DEL (0x7f).  So remove all valid chars and make sure the
  // result is an empty string.
  if (name.length == 0 ||
      name.replace(/[\x21-\x2b\x2d-\x3f\x41-\x7e]/g, '').length != 0) {
    return false;
  }

  // The domain part is supposed to be a bit more strict ("a valid domain"),
  // but using the same form as above should be good enough.
  if (domain !== undefined) {
    if (domain.replace(/[\x21-\x2b\x2d-\x3f\x41-\x7e]/g, '').length != 0) {
      return false;
    }
  }

  return true;
};

/**
 * SFTP Version Packet containing the version and possible extensions.
 */
nassh.sftp.packets.VersionPacket = function(packet) {
  this.requestId = 'init';
  this.version = packet.getUint32();

  // Pull out all the extensions that might exist.
  this.extensions = {};
  while (!packet.eod()) {
    const name = packet.getString();
    const data = packet.getString();
    // The SFTP RFC says we should silently ignore unknown/invalid entries.
    if (nassh.sftp.packets.ValidExtension(name)) {
      this.extensions[name] = data;
    }
  }
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
  if (fmtMap[ifmt] === undefined)
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
  ret += threebits(bits >> 3, (bits & nassh.sftp.packets.PermissionBits.ISGID),
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
    const fmt = attrs.permissions & nassh.sftp.packets.PermissionBits.IFMT;
    attrs.isCharacterDevice = (fmt == nassh.sftp.packets.PermissionBits.IFCHR);
    attrs.isDirectory = (fmt == nassh.sftp.packets.PermissionBits.IFDIR);
    attrs.isBlockDevice = (fmt == nassh.sftp.packets.PermissionBits.IFBLK);
    attrs.isRegularFile = (fmt == nassh.sftp.packets.PermissionBits.IFREG);
    attrs.isFifo = (fmt == nassh.sftp.packets.PermissionBits.IFIFO);
    attrs.isLink = (fmt == nassh.sftp.packets.PermissionBits.IFLNK);
    attrs.isSocket = (fmt == nassh.sftp.packets.PermissionBits.IFSOCK);
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
  EXTENDED: 200,
};

/**
 * Possible SFTP Response Packet types
 */
nassh.sftp.packets.ResponsePackets = {
  2: nassh.sftp.packets.VersionPacket,
  101: nassh.sftp.packets.StatusPacket,
  102: nassh.sftp.packets.HandlePacket,
  103: nassh.sftp.packets.DataPacket,
  104: nassh.sftp.packets.NamePacket,
  105: nassh.sftp.packets.AttrsPacket,
  201: nassh.sftp.packets.ExtendedReplyPacket,
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
