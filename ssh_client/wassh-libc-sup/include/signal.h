// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/signal.h.html

#ifndef WASSH_SIGNAL_H
#define WASSH_SIGNAL_H

#include_next <signal.h>

#include <sys/cdefs.h>

__BEGIN_DECLS

#define kill(...) 0

// Signal dispositions.
// NB: SIG_DFL must be zero for __wassh_signal_handlers to work.
#define SIG_ERR  ((void*)(uintptr_t)-1)
#define SIG_DFL  ((void*)(uintptr_t)0)
#define SIG_IGN  ((void*)(uintptr_t)1)

typedef void (*sighandler_t)(int);
sighandler_t signal(int signum, sighandler_t handler);

int sigaction(int, const struct sigaction*, struct sigaction*);

int sigemptyset(sigset_t*);
int sigfillset(sigset_t*);
int sigaddset(sigset_t*, int);
int sigdelset(sigset_t*, int);
int sigismember(const sigset_t*, int);

__END_DECLS

#endif
