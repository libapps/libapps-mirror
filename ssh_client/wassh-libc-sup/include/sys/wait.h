// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/sys_wait.h.html

#ifndef WASSH_SYS_WAIT_H
#define WASSH_SYS_WAIT_H

#include <sys/cdefs.h>
#include <sys/types.h>

__BEGIN_DECLS

// Bit flags for waitpid.
#define WNOHANG    1
#define WUNTRACED  2
#define WCONTINUED 4

// The low status byte is the exit status/signal.
#define WTERMSIG(w)    ((w) & 0x7f)
#define WEXITSTATUS(w) ((w) & 0x7f)
// The high status byte tells us the event type.
#define WIFEXITED(w)   ((w) & 0x100)
#define WIFSIGNALED(w) ((w) & 0x200)
#define WIFSTOPPED(w)  ((w) & 0x400)

pid_t waitpid(pid_t, int*, int);

__END_DECLS

#endif
