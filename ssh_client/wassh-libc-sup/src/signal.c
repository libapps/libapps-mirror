// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Signal implementation.

#include <errno.h>
#include <signal.h>
#include <string.h>

#include "debug.h"

// This symbol is exported for the WASI runtime to call directly.
// We zero initialize it as a shortcut to SIG_DFL.
sighandler_t __wassh_signal_handlers[64];

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
  if (oldact) {
    memset(oldact, 0, sizeof(*oldact));
  }
  return signal(signum, (sighandler_t)act->sa_sigaction) == SIG_ERR ? -1 : 0;
}

#define P(s) [s] = #s,
static const char* const sys_siglist[] = {
  P(SIGHUP)
  P(SIGINT)
  P(SIGQUIT)
  P(SIGILL)
  P(SIGTRAP)
  P(SIGABRT)
  P(SIGBUS)
  P(SIGFPE)
  P(SIGKILL)
  P(SIGUSR1)
  P(SIGSEGV)
  P(SIGUSR2)
  P(SIGPIPE)
  P(SIGALRM)
  P(SIGTERM)
  P(SIGCHLD)
  P(SIGCONT)
  P(SIGSTOP)
  P(SIGTSTP)
  P(SIGTTIN)
  P(SIGTTOU)
  P(SIGURG)
  P(SIGXCPU)
  P(SIGXFSZ)
  P(SIGVTALRM)
  P(SIGPROF)
  P(SIGWINCH)
  P(SIGIO)
  P(SIGPWR)
};
#undef P
char* strsignal(int signum) {
  if (signum < 0 || signum >= 64) {
    return "Unknown signal";
  }

  return (char*)sys_siglist[signum];
}
