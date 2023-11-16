// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Implementation for sendto().

#include <errno.h>
#include <netinet/in.h>
#include <sys/socket.h>

#include "bh-syscalls.h"
#include "debug.h"

ssize_t sendto(int sockfd, const void* buf, size_t len, int flags,
               const struct sockaddr* addr, socklen_t addrlen) {
  _ENTER("sockfd=%i buf=%p len=%zu flags=%x addr=%p addrlen=%u",
         sockfd, buf, len, flags, addr, addrlen);

  // Only support IPv4 & IPv6.
  int ret = -1;
  size_t written = 0;
  int sys_domain = addr->sa_family;
  const uint8_t* sys_addr;
  uint16_t sys_port;
  switch (sys_domain) {
  case AF_INET: {
    const struct sockaddr_in* sin = (void*)addr;
    if (addrlen < sizeof(*sin)) {
      errno = EINVAL;
      goto done;
    }
    sys_addr = (const uint8_t*)&sin->sin_addr.s_addr;
    sys_port = ntohs(sin->sin_port);
    _MID("IPv4 addr=%p port=%i", sys_addr, sys_port);
    break;
  }

  case AF_INET6: {
    const struct sockaddr_in6* sin6 = (void*)addr;
    if (addrlen < sizeof(*sin6)) {
      errno = EINVAL;
      goto done;
    }
    if (sin6->sin6_flowinfo) {
      _EXIT("|sin6_flowinfo| unsupported");
      errno = EINVAL;
      goto done;
    }
    // This would be nice to support.
    if (sin6->sin6_scope_id) {
      _EXIT("|sin6_scope_id| unsupported");
      errno = EINVAL;
      goto done;
    }
    sys_addr = (const uint8_t*)&sin6->sin6_addr.s6_addr;
    sys_port = ntohs(sin6->sin6_port);
    _MID("IPv6 addr=%p port=%i", sys_addr, sys_port);
    break;
  }

  default:
    _EXIT("|sa_family| unknown");
    errno = EINVAL;
    goto done;
  }

  ret = sock_sendto(
      sockfd, buf, len, &written, flags, sys_domain, sys_addr, sys_port);
 done:
  _EXIT_ERRNO(ret, " written=%zu", written);
  return ret ? ret : written;
}

ssize_t send(int sockfd, const void* buf, size_t len, int flags) {
  _ENTER("sockfd=%i buf=%p len=%zu flags=%x", sockfd, buf, len, flags);
  size_t written;
  int ret = sock_sendto(sockfd, buf, len, &written, flags, 0, NULL, 0);
  _EXIT_ERRNO(ret, " written=%zu", written);
  return ret ? ret : written;
}
