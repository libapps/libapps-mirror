// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Implementation for dup2().

#include <errno.h>
#include <unistd.h>

#include "bh-syscalls.h"
#include "debug.h"

int dup2(int oldfd, int newfd) {
  _ENTER("oldfd=%i newfd=%i", oldfd, newfd);
  int ret = fd_dup2(oldfd, newfd);
  _EXIT("ret = %i", ret);
  return ret;
}
