// Copyright 2023 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Implementation for sendto().

#include <errno.h>
#include <netinet/in.h>
#include <sys/socket.h>

#include "bh-syscalls.h"
#include "debug.h"

ssize_t recvfrom(int sockfd, void* buf, size_t len, int flags,
                 struct sockaddr* addr, socklen_t* addrlen) {
  _ENTER("sockfd=%i buf=%p len=%zu flags=%x addr=%p addrlen=%p",
         sockfd, buf, len, flags, addr, addrlen);

  int domain;
  uint8_t s_addr[16];
  uint16_t port;
  size_t written;
  int ret = sock_recvfrom(
      sockfd, buf, len, &written, flags, &domain, s_addr, &port);
  if (ret != 0 || addr == NULL) {
    goto done;
  }

  if (addr != NULL && addrlen == NULL) {
    errno = EINVAL;
    goto done;
  }

  // TODO(vapier) Verify this code works :).
  switch (domain) {
  case AF_INET: {
    struct sockaddr_in* sin = (void*)addr;
    if (*addrlen < sizeof(*sin)) {
      errno = EINVAL;
      goto done;
    }
    *addrlen = sizeof(*sin);
    sin->sin_port = htons(port);
    memcpy(&sin->sin_addr.s_addr, s_addr, sizeof(sin->sin_addr.s_addr));
    _MID("IPv4 addr=%p port=%i", addr, port);
    break;
  }

  case AF_INET6: {
    struct sockaddr_in6* sin6 = (void*)addr;
    if (*addrlen < sizeof(*sin6)) {
      errno = EINVAL;
      goto done;
    }
    *addrlen = sizeof(*sin6);
    sin6->sin6_flowinfo = 0;
    // This would be nice to support.
    sin6->sin6_scope_id = 0;
    sin6->sin6_port = htons(port);
    memcpy(&sin6->sin6_addr.s6_addr, s_addr, sizeof(sin6->sin6_addr.s6_addr));
    _MID("IPv6 addr=%p port=%i", addr, port);
    break;
  }

  default:
    _EXIT("|sa_family| unknown");
    errno = EINVAL;
    goto done;
  }
  addr->sa_family = domain;

 done:
  _EXIT_ERRNO(ret, " written=%zu", written);
  return ret ? ret : written;
}

ssize_t recv(int sockfd, void* buf, size_t len, int flags) {
  return recvfrom(sockfd, buf, len, flags, NULL, NULL);
}
