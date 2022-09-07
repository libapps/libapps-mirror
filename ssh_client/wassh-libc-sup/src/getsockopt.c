// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Implementation for getsockopt().

#include <errno.h>
#include <sys/socket.h>

#include "bh-syscalls.h"
#include "debug.h"

int getsockopt(int sockfd, int level, int optname, void* optval,
               socklen_t* optlen) {
  _ENTER("sockfd=%i level=%#x optname=%i optval=%p optlen=%p[%lu]",
         sockfd, level, optname, optval, optlen, (unsigned long)*optlen);

  if (*optlen != 4) {
    _MID("bad option length");
    errno = EINVAL;
    return -1;
  }

  int ret = sock_get_opt(sockfd, level, optname, optval);
  _EXIT("ret = %i", ret);
  return ret;
}
