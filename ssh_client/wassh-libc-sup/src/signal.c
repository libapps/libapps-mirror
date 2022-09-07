// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Signal implementation.

#include <err.h>
#include <errno.h>
#include <signal.h>
#include <string.h>

#include "debug.h"

// This is exported so the JS side can call us directly to deliver a signal.
//
// NB: The signal number uses musl ABI, not WASI ABI, and many signal numbers
// are different between the two!
void __wassh_signal_deliver(int signum) {
  if (signum < 0 || signum >= NSIG)
    return;

  // There is no API to just read the current signal handler.  So we have to set
  // it to get the old value, use it, then restore it.
  int old_errno = errno;
  sighandler_t handler = signal(signum, SIG_IGN);
  errno = old_errno;
  if (handler == SIG_IGN)
    return;

  // Signals that have SIG_IGN as their default disposition don't register it as
  // such initially.  So we have to handle it ourselves.
  if (handler == SIG_DFL &&
      (signum == SIGCHLD || signum == SIGURG || signum == SIGWINCH)) {
    goto done;
  }

  // SIG_ERR only happens with signals we can't catch.
  if (handler == SIG_DFL || handler == SIG_ERR) {
    errx(128 + signum, "Terminated by signal %i handler %p: %s", signum,
         handler, strsignal(signum));
  }

  // Call the custom handler.
  handler(signum);

 done:
  // Restore the handler.
  signal(signum, handler);
}

#define sigmask(sig) (1 << ((sig) - 1))

int sigemptyset(sigset_t* set) {
  if (set == NULL) {
    errno = EINVAL;
    return -1;
  }

  *set = 0;
  return 0;
}

int sigfillset(sigset_t* set) {
  if (set == NULL) {
    errno = EINVAL;
    return -1;
  }

  *set = -1;
  return 0;
}

int sigaddset(sigset_t* set, int signum) {
  if (set == NULL) {
    errno = EINVAL;
    return -1;
  }

  *set |= sigmask(signum);
  return 0;
}

int sigdelset(sigset_t* set, int signum) {
  if (set == NULL) {
    errno = EINVAL;
    return -1;
  }

  *set &= ~sigmask(signum);
  return 0;
}

int sigismember(const sigset_t* set, int signum) {
  if (set == NULL) {
    errno = EINVAL;
    return -1;
  }

  return *set | sigmask(signum);
}

int sigaction(int signum, const struct sigaction* act,
              struct sigaction* oldact) {
  if (oldact)
    memset(oldact, 0, sizeof(*oldact));

  if (act->sa_flags & SA_SIGINFO)
    errx(1, "sigaction(%i): SA_SIGINFO not supported", signum);

  return signal(signum, act->sa_handler) == SIG_ERR ? -1 : 0;
}
