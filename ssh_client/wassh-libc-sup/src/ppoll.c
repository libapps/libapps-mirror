// Copyright 2026 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Implementation for ppoll().

#include <poll.h>

#include "debug.h"

int ppoll(struct pollfd* fds,
          nfds_t nfds,
          const struct timespec* timeout,
          const sigset_t* sigmask) {
  (void)sigmask;
  int ptimeout = timeout == NULL
                     ? -1
                     : (timeout->tv_sec * 1000 + timeout->tv_nsec / 1000000);
  _ENTER("fds=%p nfds=%zu timeout=%p sigmask=%p", fds, nfds, timeout, sigmask);
  int ret = poll(fds, nfds, ptimeout);
  if (ret < 0)
    _EXIT("ret = %i [%i:%s]", ret, errno, strerror(errno));
  else
    _EXIT("ret = %i", ret);
  return ret;
}
