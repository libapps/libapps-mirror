// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/signal.h.html

#ifndef WASSH_SIGNAL_H
#define WASSH_SIGNAL_H

// Force sigset/etc... definition ourselves as wasi-sdk elides it atm.
#include <sys/types.h>

// wasi-sdk provides basic signal support currently.
#define _WASI_EMULATED_SIGNAL

#include_next <signal.h>

#include <sys/cdefs.h>

__BEGIN_DECLS

#define kill(...) 0

// Flags for sa_flags.
#define SA_NOCLDSTOP 0x0001
#define SA_ONSTACK   0x0002
#define SA_RESETHAND 0x0004
#define SA_RESTART   0x0008
#define SA_SIGINFO   0x0010
#define SA_NOCLDWAIT 0x0020
#define SA_NODEFER   0x0040

typedef void (*sighandler_t)(int);
sighandler_t signal(int signum, sighandler_t handler);

union sigval {
  int sival_int;
  void* sival_ptr;
};

typedef struct {
  int si_signo;
  int si_code;
  int si_errno;
  pid_t si_pid;
  uid_t si_uid;
  void* si_addr;
  int si_status;
  union sigval si_value;
} siginfo_t;

struct sigaction {
  union {
    void (*sa_handler)(int);
    void (*sa_sigaction)(int, siginfo_t*, void*);
  };
  sigset_t sa_mask;
  int sa_flags;
};

int sigaction(int, const struct sigaction*, struct sigaction*);

int sigemptyset(sigset_t*);
int sigfillset(sigset_t*);
int sigaddset(sigset_t*, int);
int sigdelset(sigset_t*, int);
int sigismember(const sigset_t*, int);

__END_DECLS

#endif
