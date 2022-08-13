// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Implementation for listen().

#include <sys/socket.h>

#include "bh-syscalls.h"
#include "debug.h"

int listen(int sock, int backlog) {
  _ENTER("sock=%i backlog=%i", sock, backlog);
  int ret = sock_listen(sock, backlog);
  _EXIT_ERRNO(ret, "");
  return ret;
}
