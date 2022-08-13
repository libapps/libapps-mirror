// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Implementation for bind().

#include <errno.h>
#include <string.h>
#include <netinet/in.h>
#include <sys/socket.h>

#include "bh-syscalls.h"
#include "debug.h"

int bind(int sock, const struct sockaddr* addr, socklen_t addrlen) {
  _ENTER("sock=%i addr=%p addrlen=%i", sock, addr, addrlen);

  // Only support IPv4 & IPv6.
  int sys_domain = addr->sa_family;
  const uint8_t* sys_addr;
  uint16_t sys_port;
  switch (addr->sa_family) {
  case AF_INET: {
    const struct sockaddr_in* sin = (void*)addr;
    sys_addr = (const uint8_t*)&sin->sin_addr.s_addr;
    sys_port = ntohs(sin->sin_port);
    _MID("IPv4 addr=%p port=%i", sys_addr, sys_port);
    break;
  }

  case AF_INET6: {
    const struct sockaddr_in6* sin6 = (void*)addr;
    if (sin6->sin6_flowinfo) {
      _EXIT("|sin6_flowinfo| unsupported");
      errno = EINVAL;
      return -1;
    }
    // This would be nice to support.
    if (sin6->sin6_scope_id) {
      _EXIT("|sin6_scope_id| unsupported");
      errno = EINVAL;
      return -1;
    }
    sys_addr = (const uint8_t*)&sin6->sin6_addr.s6_addr;
    sys_port = ntohs(sin6->sin6_port);
    _MID("IPv6 addr=%p port=%i", sys_addr, sys_port);
    break;
  }

  default:
    _EXIT("|sa_family| unknown");
    errno = EINVAL;
    return -1;
  }

  int ret = sock_bind(sock, sys_domain, sys_addr, sys_port);
  _EXIT_ERRNO(ret, "");
  return ret;
}
