// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Implementation for socket().

#include <errno.h>
#include <netinet/in.h>
#include <sys/socket.h>

#include <wasi/libc.h>

#include "bh-syscalls.h"
#include "debug.h"

int socket(int domain, int type, int protocol) {
  _ENTER("domain=%i type=%i protocol=%i", domain, type, protocol);

  // Make sure preopens have processed before we create a socket as that will
  // update the file descriptor table, and preopen logic will fail when it hits
  // a non-preopen fd.
  __wasilibc_populate_preopens();

  // Don't check arguments as the syscall handler will do it.
  // We don't need to optimize for bad/unknown values.

  int ret = sock_create(domain, type, protocol);
  _EXIT("ret = %i", ret);
  return ret;
}
