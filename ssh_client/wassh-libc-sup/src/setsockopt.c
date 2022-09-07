// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Implementation for setsockopt().

#include <errno.h>
#include <string.h>
#include <sys/socket.h>

#include "bh-syscalls.h"
#include "debug.h"

int setsockopt(int sockfd, int level, int optname, const void* optval,
               socklen_t optlen) {
  _ENTER("sockfd=%i level=%#x optname=%i optval=%p optlen=%i",
         sockfd, level, optname, optval, optlen);

  if (optlen != 4) {
    _MID("bad option length");
    errno = EINVAL;
    return -1;
  }

  int value;
  memcpy(&value, optval, 4);
  _MID("*optval=%u", *(const unsigned*)optval);

  int ret = sock_set_opt(sockfd, level, optname, value);
  _EXIT("ret = %i", ret);
  return ret;
}
