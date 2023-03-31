// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Implementation for socket().

#include <errno.h>
#include <netinet/in.h>
#include <sys/socket.h>

#include "bh-syscalls.h"
#include "debug.h"

int socket(int domain, int c_type, int protocol) {
  _ENTER("domain=%i type=%i protocol=%i", domain, c_type, protocol);

  // We don't support much here currently.
  // 0: The default for most things.
  // -1: Our fake delayed hostname logic from getaddrinfo.
  if (protocol != 0 && protocol != -1 &&
      !(c_type == SOCK_STREAM && protocol == IPPROTO_TCP) &&
      !(c_type == SOCK_DGRAM && protocol == IPPROTO_UDP)) {
    _EXIT("|protocol| unknown");
    errno = EINVAL;
    return -1;
  }

  // Only support UNIX sockets (ssh-agent), IPv4, and IPv6.
  switch (domain) {
  case AF_UNIX:
  case AF_INET:
  case AF_INET6:
    break;
  default:
    _EXIT("|domain| unknown");
    errno = EINVAL;
    return -1;
  }

  // Maybe add these if anyone wants them.
  if (c_type & (SOCK_NONBLOCK | SOCK_CLOEXEC)) {
    _EXIT("|type| flags unsupported");
    errno = EINVAL;
    return -1;
  }

  // Only support TCP & UDP protocols.
  int sys_type;
  switch (c_type) {
  case SOCK_DGRAM:
  case SOCK_STREAM:
    sys_type = c_type;
    break;
  default:
    _EXIT("|type| unknown");
    errno = EINVAL;
    return -1;
  }

  int ret = sock_create(domain, sys_type, protocol);
  _EXIT("ret = %i", ret);
  return ret;
}
