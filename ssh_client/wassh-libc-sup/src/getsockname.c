// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Implementation for getpeername() & getsockname().
// https://pubs.opengroup.org/onlinepubs/9699919799/functions/getpeername.html
// https://pubs.opengroup.org/onlinepubs/9699919799/functions/getsockname.html

#include <errno.h>
#include <string.h>
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>

#include "debug.h"
#include "bh-syscalls.h"

static int get_socket_info(
    int sockfd, struct sockaddr* addr, socklen_t* addrlen, bool remote) {
  socklen_t caller_addrlen = *addrlen;
  int family;
  uint16_t port;
  union {
    struct in_addr in;
    struct in6_addr in6;
  } in_addr;

  int ret = sock_get_name(sockfd, &family, &port, (uint8_t*)&in_addr, remote);
  if (ret < 0)
    goto done;

  char node[40];
  _MID("family=%i port=%u", family, port);
  switch (family) {
    case AF_INET: {
      struct sockaddr_in sin = {
        .sin_family = family,
        .sin_port = htons(port),
        .sin_addr = in_addr.in,
      };
      *addrlen = sizeof(sin);

      inet_ntop(AF_INET, &in_addr.in, node, sizeof(node));
      _MID("addrlen=%u addr=%s", *addrlen, node);

      if (caller_addrlen < *addrlen)
        goto done;

      memcpy(addr, &sin, *addrlen);
      break;
    }

    case AF_INET6: {
      struct sockaddr_in6 sin = {
        .sin6_family = family,
        .sin6_port = htons(port),
        .sin6_addr = in_addr.in6,
      };
      *addrlen = sizeof(sin);

      inet_ntop(AF_INET6, &in_addr.in6, node, sizeof(node));
      _MID("addrlen=%u addr=%s", *addrlen, node);

      if (caller_addrlen < *addrlen)
        goto done;

      memcpy(addr, &sin, *addrlen);
      break;
    }

    default:
      errno = EINVAL;
      ret = -1;
      goto done;
  }


 done:
  _EXIT_ERRNO(ret, "");
  return ret;
}

int getpeername(int sockfd, struct sockaddr* addr, socklen_t* addrlen) {
  _ENTER("sockfd=%i addr=%p addrlen=%p[%i]", sockfd, addr, addrlen, *addrlen);
  return get_socket_info(sockfd, addr, addrlen, true);
}

int getsockname(int sockfd, struct sockaddr* addr, socklen_t* addrlen) {
  _ENTER("sockfd=%i addr=%p addrlen=%p[%i]", sockfd, addr, addrlen, *addrlen);
  return get_socket_info(sockfd, addr, addrlen, false);
}
