// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Implementation for dup().

#include <errno.h>
#include <unistd.h>

#include "bh-syscalls.h"
#include "debug.h"

int dup(int oldfd) {
  _ENTER("oldfd=%i", oldfd);
  int ret = fd_dup(oldfd);
  _EXIT("ret = %i", ret);
  return ret;
}
