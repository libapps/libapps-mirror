// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview WASI rights API constants from wasi/api.h.
 */

export const FD_DATASYNC = 1n;
export const FD_READ = 2n;
export const FD_SEEK = 4n;
export const FD_FDSTAT_SET_FLAGS = 8n;
export const FD_SYNC = 16n;
export const FD_TELL = 32n;
export const FD_WRITE = 64n;
export const FD_ADVISE = 128n;
export const FD_ALLOCATE = 256n;
export const PATH_CREATE_DIRECTORY = 512n;
export const PATH_CREATE_FILE = 1024n;
export const PATH_LINK_SOURCE = 2048n;
export const PATH_LINK_TARGET = 4096n;
export const PATH_OPEN = 8192n;
export const FD_READDIR = 16384n;
export const PATH_READLINK = 32768n;
export const PATH_RENAME_SOURCE = 65536n;
export const PATH_RENAME_TARGET = 131072n;
export const PATH_FILESTAT_GET = 262144n;
export const PATH_FILESTAT_SET_SIZE = 524288n;
export const PATH_FILESTAT_SET_TIMES = 1048576n;
export const FD_FILESTAT_GET = 2097152n;
export const FD_FILESTAT_SET_SIZE = 4194304n;
export const FD_FILESTAT_SET_TIMES = 8388608n;
export const PATH_SYMLINK = 16777216n;
export const PATH_REMOVE_DIRECTORY = 33554432n;
export const PATH_UNLINK_FILE = 67108864n;
export const POLL_FD_READWRITE = 134217728n;
export const SOCK_SHUTDOWN = 268435456n;
