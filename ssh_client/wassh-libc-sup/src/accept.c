// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Implementation for accept().

#include <errno.h>
#include <string.h>
#include <netinet/in.h>
#include <sys/socket.h>

#include "bh-syscalls.h"
#include "debug.h"

int accept(int sockfd, struct sockaddr* addr, socklen_t* addrlen) {
  _ENTER("sockfd=%i addr=%p addrlen=%p", sockfd, addr, addrlen);

  int newsock;
  int ret = sock_accept(sockfd, &newsock);
  if (ret < 0)
    goto done;

  ret = newsock;

  // TODO(vapier): Should we bother supporting passing back addr?
  if (addrlen) {
    *addrlen = 0;
  }

 done:
  _EXIT_ERRNO(ret, "");
  return ret;
}
